import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BudgetVersionRepository,
  ProcurementCaseRepository,
  SaveBudgetVersionResult,
} from "@bba/bdos-core/services/procurement-engineering";
import {
  budgetVersionDraftRpcParams,
  budgetVersionSnapshotRpcParams,
  mapBudgetVersionAggregate,
  mapProcurementCaseRow,
  mapProcurementLotRow,
  procurementCaseInsertRow,
  procurementLotInsertRow,
} from "./procurement-engineering-mappers";

// Adaptador de persistência (Sprint 21.3C) — implementa os contratos de
// packages/bdos-core/src/services/procurement-engineering/*.repository.ts
// contra o schema de 20260714000000_bdos_procurement_engineering_schema.sql.
// Vive em apps/web, não em bdos-core, pelo mesmo motivo de todo repositório
// existente (repository.ts, measurement-repository.ts): depende do
// SupabaseClient autenticado, injetado por chamada — nunca module-global.
// Nunca recalcula regra econômica; apenas mapeia domínio <-> banco,
// converte organizationId <-> company_id, e traduz erros físicos.

const PROCUREMENT_CASE_COLUMNS = "id, company_id, title, external_reference, metadata";
const PROCUREMENT_LOT_COLUMNS = "id, company_id, procurement_case_id, title, external_reference, metadata";
const BUDGET_VERSION_COLUMNS =
  "id, company_id, procurement_case_id, scope_kind, procurement_lot_id, origin_kind, origin_reference, status, revision, metadata";
const BUDGET_LINE_COLUMNS =
  "id, budget_version_id, kind, description_status, description_text, external_code, parent_line_id, position, scope_kind, scope_procurement_lot_id, total_cents, metadata";
const LINEAGE_RELATION_COLUMNS = "id, budget_version_id, nature, origin_kind, origin_reference";

export function createProcurementCaseRepository(supabase: SupabaseClient): ProcurementCaseRepository {
  return {
    async createProcurementCase(organizationId, procurementCase) {
      const { data, error } = await supabase
        .from("procurement_cases")
        .insert(procurementCaseInsertRow(organizationId, procurementCase))
        .select(PROCUREMENT_CASE_COLUMNS)
        .single();

      if (error || !data) {
        throw error ?? new Error("Falha ao persistir o Processo de Licitação e Contratação.");
      }

      return mapProcurementCaseRow(data);
    },

    async findProcurementCaseById(organizationId, id) {
      const { data, error } = await supabase
        .from("procurement_cases")
        .select(PROCUREMENT_CASE_COLUMNS)
        .eq("company_id", organizationId)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data === null ? null : mapProcurementCaseRow(data);
    },

    async createProcurementLot(organizationId, procurementLot) {
      const { data, error } = await supabase
        .from("procurement_lots")
        .insert(procurementLotInsertRow(organizationId, procurementLot))
        .select(PROCUREMENT_LOT_COLUMNS)
        .single();

      if (error || !data) {
        throw error ?? new Error("Falha ao persistir o Lote da Licitação.");
      }

      return mapProcurementLotRow(data);
    },

    async findProcurementLotById(organizationId, procurementCaseId, id) {
      const { data, error } = await supabase
        .from("procurement_lots")
        .select(PROCUREMENT_LOT_COLUMNS)
        .eq("company_id", organizationId)
        .eq("procurement_case_id", procurementCaseId)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data === null ? null : mapProcurementLotRow(data);
    },
  };
}

export function createBudgetVersionRepository(supabase: SupabaseClient): BudgetVersionRepository {
  return {
    async createDraftBudgetVersion(organizationId, budgetVersion) {
      const { data, error } = await supabase.rpc(
        "create_budget_version_draft",
        budgetVersionDraftRpcParams(organizationId, budgetVersion),
      );

      if (error || !data) {
        throw error ?? new Error("Falha ao persistir a Versão do Orçamento em rascunho.");
      }

      if (typeof data.revision !== "number") {
        throw new Error("create_budget_version_draft did not return a numeric revision.");
      }

      // O retrato retornado é o mesmo já validado pelo domínio (Sprint
      // 21.3B) que originou este INSERT — nenhuma releitura é necessária
      // para confiar nele; a fidelidade de round-trip continua coberta por
      // loadBudgetVersion, sempre exercitado nos testes de integração após
      // qualquer criação.
      return { entity: budgetVersion, revision: data.revision };
    },

    async loadBudgetVersion(organizationId, id) {
      const { data: versionRow, error: versionError } = await supabase
        .from("budget_versions")
        .select(BUDGET_VERSION_COLUMNS)
        .eq("company_id", organizationId)
        .eq("id", id)
        .maybeSingle();

      if (versionError) {
        throw versionError;
      }

      if (versionRow === null) {
        return null;
      }

      const { data: lineRows, error: linesError } = await supabase
        .from("budget_lines")
        .select(BUDGET_LINE_COLUMNS)
        .eq("company_id", organizationId)
        .eq("budget_version_id", id);

      if (linesError) {
        throw linesError;
      }

      const { data: lineageRow, error: lineageError } = await supabase
        .from("budget_version_lineage_relations")
        .select(LINEAGE_RELATION_COLUMNS)
        .eq("company_id", organizationId)
        .eq("budget_version_id", id)
        .maybeSingle();

      if (lineageError) {
        throw lineageError;
      }

      return mapBudgetVersionAggregate(versionRow, lineRows ?? [], lineageRow);
    },

    async saveBudgetVersion(organizationId, budgetVersion, expectedRevision): Promise<SaveBudgetVersionResult> {
      const { data, error } = await supabase.rpc(
        "persist_budget_version_snapshot",
        budgetVersionSnapshotRpcParams(organizationId, budgetVersion, expectedRevision),
      );

      if (error || !data) {
        throw error ?? new Error("Falha ao persistir a alteração da Versão do Orçamento.");
      }

      if (data.conflict) {
        return { outcome: "concurrency_conflict" };
      }

      if (typeof data.revision !== "number") {
        throw new Error("persist_budget_version_snapshot did not return a numeric revision on success.");
      }

      return { outcome: "saved", revision: data.revision };
    },
  };
}
