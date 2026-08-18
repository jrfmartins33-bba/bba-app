import type { SupabaseClient } from "@supabase/supabase-js";
import type { BudgetReviewRepository, AuditEventToPersist } from "@bba/bdos-core/services/budget-official-review";
import { createHash } from "crypto";
import {
  consolidateBudgetReviewSessionRpcParams,
  createBudgetReviewSessionRpcParams,
  mapBudgetReviewSessionRow,
  recordBudgetReviewReconciliationDecisionRpcParams,
  recordBudgetReviewRowMutationRpcParams,
} from "./budget-official-review-mappers";

// Adaptador de persistência (Epic 21.5A / Sprint 21.5C.2B)
// Implementa BudgetReviewRepository (packages/bdos-core/src/services/budget-official-review/budget-review.repository.ts).
//
// *** EXCLUSIVO DE SERVIDOR — NUNCA IMPORTAR DE CÓDIGO CLIENTE ***
//
// Arquitetura BDOS de separação Read / Write:
// - Operações de LEITURA (findOrganizationIdForSession, loadSession, findSessionByAcquisition, loadRowsForSession)
//   utilizam `readClient` (cliente autenticado do usuário), protegidas pelas políticas de RLS de SELECT
//   (`budget_review_sessions_select_company_or_admin` e `budget_review_rows_select_admin_only`).
// - Operações de ESCRITA (createSession, mutateRow, recordReconciliationDecision, consolidateSession, importRows)
//   utilizam `writeClient` (cliente de `service_role`), invocando RPCs SQL cujas permissões de EXECUTE foram
//   concedidas estritamente a `service_role` (20260810000000_bdos_budget_official_review.sql).

const SESSION_COLUMNS =
  "id, company_id, procurement_case_id, procurement_lot_id, budget_version_id, document_version_id, source_sha256, acquisition_mechanism, acquisition_mechanism_version, status, metadata, created_by, created_at";
const ROW_COLUMNS =
  "id, company_id, session_id, kind, lot_reference, parent_row_id, position, state, extracted, revised, page, evidence_text, justification, inserted_manually, reconciliation_decision_status, reconciliation_decision_actor, reconciliation_decision_justification, reconciliation_decision_at, metadata, created_by, created_at";

function toValidUuid(id: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  const hash = createHash("sha256").update(id).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function createBudgetReviewServerRepository(
  readClient: SupabaseClient,
  writeClient?: SupabaseClient,
): BudgetReviewRepository {
  const wClient = writeClient ?? readClient;

  async function loadRowsForSession(organizationId: string, sessionId: string) {
    const { data, error } = await readClient
      .from("budget_review_rows")
      .select(ROW_COLUMNS)
      .eq("company_id", organizationId)
      .eq("session_id", sessionId);
    if (error) throw error;
    return data ?? [];
  }

  return {
    async findOrganizationIdForSession(sessionId) {
      const { data, error } = await readClient
        .from("budget_review_sessions")
        .select("company_id")
        .eq("id", sessionId)
        .maybeSingle();

      if (error) throw error;
      return data === null ? null : String(data.company_id);
    },

    async loadSession(organizationId, sessionId) {
      const { data: sessionRow, error: sessionError } = await readClient.from("budget_review_sessions")
        .select(SESSION_COLUMNS)
        .eq("company_id", organizationId)
        .eq("id", sessionId)
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (sessionRow === null) return null;

      const rowRows = await loadRowsForSession(organizationId, sessionId);
      return mapBudgetReviewSessionRow(sessionRow, rowRows);
    },

    async findSessionByAcquisition(organizationId, procurementCaseId, sourceSha256, acquisitionMechanism, procurementLotId) {
      let query = readClient.from("budget_review_sessions")
        .select(SESSION_COLUMNS)
        .eq("company_id", organizationId)
        .eq("procurement_case_id", procurementCaseId)
        .eq("source_sha256", sourceSha256)
        .eq("acquisition_mechanism", acquisitionMechanism);

      if (procurementLotId) {
        query = query.eq("procurement_lot_id", procurementLotId);
      } else {
        query = query.is("procurement_lot_id", null);
      }

      const { data: sessionRow, error: sessionError } = await query.maybeSingle();

      if (sessionError) throw sessionError;
      if (sessionRow === null) return null;

      const rowRows = await loadRowsForSession(organizationId, sessionRow.id);
      return mapBudgetReviewSessionRow(sessionRow, rowRows);
    },

    async createSession(organizationId, actor, session) {
      const { data, error } = await wClient.rpc(
        "create_budget_review_session",
        createBudgetReviewSessionRpcParams(organizationId, actor, session),
      );

      if (error || !data) {
        throw error ?? new Error("Falha ao persistir a Sessão de Revisão do Orçamento Oficial.");
      }

      if (data.outcome !== "created" && data.outcome !== "reused") {
        throw new Error(`create_budget_review_session retornou outcome inesperado: ${String(data.outcome)}`);
      }

      return { outcome: data.outcome, sessionId: String(data.sessionId) };
    },

    async mutateRow(organizationId, actor, session, row, isNewRow, auditEvent) {
      const { data, error } = await wClient.rpc(
        "record_budget_review_row_mutation",
        recordBudgetReviewRowMutationRpcParams(organizationId, actor, {
          isNewRow,
          session,
          row,
          auditEventId: auditEvent?.id ?? null,
          auditAction: auditEvent?.action ?? null,
          auditActor: auditEvent?.actor ?? null,
          auditOccurredAt: auditEvent?.occurredAt ?? null,
          auditFieldChanges: auditEvent?.fieldChanges ?? [],
          auditJustification: auditEvent?.justification ?? null,
          auditMetadata: auditEvent?.metadata ?? {},
        }),
      );

      if (error || !data?.success) {
        throw error ?? new Error("Falha ao persistir a alteração da Linha de Revisão.");
      }
    },

    async recordReconciliationDecision(organizationId, actor, sessionId, rowId, decision, auditEvent) {
      const { data, error } = await wClient.rpc(
        "record_budget_review_reconciliation_decision",
        recordBudgetReviewReconciliationDecisionRpcParams(organizationId, actor, {
          sessionId,
          rowId,
          decision,
          auditEventId: auditEvent.id,
          auditAction: auditEvent.action,
          auditActor: auditEvent.actor,
          auditOccurredAt: auditEvent.occurredAt,
          auditJustification: auditEvent.justification,
          auditMetadata: auditEvent.metadata,
        }),
      );

      if (error || !data?.success) {
        throw error ?? new Error("Falha ao persistir a Decisão de Reconciliação.");
      }
    },

    async consolidateSession(organizationId, actor, sessionId, auditEventId) {
      const { data, error } = await wClient.rpc(
        "consolidate_budget_review_session",
        consolidateBudgetReviewSessionRpcParams(organizationId, actor, sessionId, auditEventId, {}),
      );

      if (error) throw error;
      return { success: Boolean(data?.success) };
    },

    async importRows(organizationId, actor, sessionId, rows, occurredAt) {
      const { data, error } = await wClient.rpc("bulk_import_budget_review_rows", {
        p_actor_id: actor,
        p_company_id: organizationId,
        p_session_id: sessionId,
        p_rows: rows.map((row) => ({
          id: toValidUuid(row.id),
          kind: row.kind,
          lotReference: row.lotReference,
          parentRowId: row.parentRowId ? toValidUuid(row.parentRowId) : null,
          position: row.position,
          fields: row.revised,
          page: row.page,
          evidenceText: row.evidenceText,
        })),
        p_audit_occurred_at: occurredAt,
      });

      if (error || !data) {
        throw error ?? new Error("Falha ao importar as Linhas de Revisão em lote.");
      }

      return Number(data.imported ?? 0);
    },

    async bulkMutateRows(organizationId, actor, sessionId, mutations) {
      const { data, error } = await wClient.rpc("bulk_mutate_budget_review_rows", {
        p_actor_id: actor,
        p_company_id: organizationId,
        p_session_id: sessionId,
        p_mutations: mutations.map((m) => ({
          row_id: toValidUuid(m.rowId),
          new_state: m.newState,
          revised: m.revised,
          justification: m.justification ?? null,
          evidence_text: m.evidenceText ?? null,
          audit_event_id: m.auditEvent.id,
          audit_action: m.auditEvent.action,
          audit_actor: m.auditEvent.actor,
          audit_occurred_at: m.auditEvent.occurredAt,
          audit_field_changes: m.auditEvent.fieldChanges ?? [],
          audit_justification: m.auditEvent.justification ?? null,
          audit_metadata: m.auditEvent.metadata ?? {},
        })),
      });

      if (error || typeof data !== "number") {
        throw error ?? new Error("Falha ao salvar as mutações em lote.");
      }

      return Number(data);
    },

    async bulkRecordReconciliationDecisions(organizationId, actor, sessionId, decisions) {
      const { data, error } = await wClient.rpc("bulk_record_budget_review_reconciliation_decisions", {
        p_actor_id: actor,
        p_company_id: organizationId,
        p_session_id: sessionId,
        p_decisions: decisions.map((d) => ({
          row_id: toValidUuid(d.rowId),
          status: d.status,
          justification: d.justification,
          decided_at: d.decidedAt,
          audit_event_id: d.auditEvent.id,
          audit_action: d.auditEvent.action,
          audit_actor: d.auditEvent.actor,
          audit_occurred_at: d.auditEvent.occurredAt,
          audit_justification: d.auditEvent.justification ?? null,
          audit_metadata: d.auditEvent.metadata ?? {},
        })),
      });

      if (error || typeof data !== "number") {
        throw error ?? new Error("Falha ao salvar as decisões em lote.");
      }

      return Number(data);
    },
  };
}

export type { AuditEventToPersist };
