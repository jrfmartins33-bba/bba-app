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
  procurementCaseCreateRpcParams,
  procurementLotRegisterRpcParams,
} from "./procurement-engineering-mappers";

// Adaptador de persistência (Sprint 21.3C) — implementa os contratos de
// packages/bdos-core/src/services/procurement-engineering/*.repository.ts.
//
// *** EXCLUSIVO DE SERVIDOR — NUNCA IMPORTAR DE CÓDIGO CLIENTE ***
//
// As quatro operações de escrita (createProcurementCase, createProcurementLot,
// createDraftBudgetVersion, saveBudgetVersion) chamam funções SQL cujo
// EXECUTE foi revogado de `authenticated`/`anon`/PUBLIC e concedido somente
// a `service_role` (20260714000004_..._server_only_functions.sql) — este
// módulo só funciona, para escrita, com um `SupabaseClient` construído com
// a chave de `service_role`, nunca com a chave pública/anônima
// (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) usada por
// apps/web/lib/supabase/server.ts (`getSupabaseRouteHandlerClient`).
//
// Fluxo de servidor pretendido (a construir em Sprint futura, junto da
// rota/Server Action que ainda não existe nesta Sprint):
//   1. `getSupabaseRouteHandlerClient()` + `requireAuthenticatedCompany()`
//      (apps/web/lib/supabase/server.ts, mecanismo já existente) resolvem
//      e REVALIDAM `{ userId, companyId }` a partir do cookie de sessão —
//      nunca a partir de um corpo de requisição não confiável.
//   2. Um cliente separado, autenticado com a chave de `service_role`
//      (variável de ambiente exclusiva de servidor, nunca `NEXT_PUBLIC_*`,
//      nunca embutida em nenhum bundle do navegador), é passado para as
//      funções deste módulo.
//   3. `userId`/`companyId` já revalidados no passo 1 tornam-se
//      `actor`/`organizationId` aqui — nunca um valor recebido cru do
//      corpo da requisição.
//
// As operações de LEITURA (findProcurementCaseById, findProcurementLotById,
// loadBudgetVersion) continuam funcionando normalmente com um cliente
// autenticado comum (`getSupabaseRouteHandlerClient()`), protegidas por RLS
// como antes — nada aqui obriga toda leitura a usar `service_role`.
//
// Nunca recalcula regra econômica; apenas mapeia domínio <-> banco,
// converte organizationId <-> company_id, actor <-> ator autorizado, e
// traduz erros físicos.

const PROCUREMENT_CASE_COLUMNS = "id, company_id, title, external_reference, metadata";
const PROCUREMENT_LOT_COLUMNS = "id, company_id, procurement_case_id, title, external_reference, metadata";
const BUDGET_VERSION_COLUMNS =
  "id, company_id, procurement_case_id, scope_kind, procurement_lot_id, origin_kind, origin_reference, status, revision, metadata";
const BUDGET_LINE_COLUMNS =
  "id, budget_version_id, kind, description_status, description_text, external_code, parent_line_id, position, scope_kind, scope_procurement_lot_id, total_cents, metadata";
const LINEAGE_RELATION_COLUMNS = "id, budget_version_id, nature, origin_kind, origin_reference";

export function createProcurementCaseRepository(supabase: SupabaseClient): ProcurementCaseRepository {
  return {
    async createProcurementCase(organizationId, actor, procurementCase) {
      // `supabase` precisa ser um cliente de service_role aqui — EXECUTE
      // desta função foi revogado de authenticated/anon/PUBLIC
      // (20260714000004_..._server_only_functions.sql). `actor` é
      // verificado dentro da função contra profiles.company_id/role antes
      // de qualquer escrita; created_by é sempre o próprio actor.
      const { data, error } = await supabase.rpc(
        "create_procurement_case",
        procurementCaseCreateRpcParams(organizationId, actor, procurementCase),
      );

      if (error || !data) {
        throw error ?? new Error("Falha ao persistir o Processo de Licitação e Contratação.");
      }

      // O retrato retornado é o mesmo já validado pelo domínio (Sprint
      // 21.3B) que originou este INSERT — mesma disciplina de
      // createDraftBudgetVersion, nenhuma releitura necessária.
      return procurementCase;
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

    async createProcurementLot(organizationId, actor, procurementLot) {
      // Mesma disciplina de createProcurementCase — service_role
      // obrigatório, actor verificado dentro da função.
      const { data, error } = await supabase.rpc(
        "register_procurement_lot",
        procurementLotRegisterRpcParams(organizationId, actor, procurementLot),
      );

      if (error || !data) {
        throw error ?? new Error("Falha ao persistir o Lote da Licitação.");
      }

      return procurementLot;
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
    async createDraftBudgetVersion(organizationId, actor, budgetVersion) {
      // service_role obrigatório — mesma disciplina de createProcurementCase.
      const { data, error } = await supabase.rpc(
        "create_budget_version_draft",
        budgetVersionDraftRpcParams(organizationId, actor, budgetVersion),
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

    async saveBudgetVersion(organizationId, actor, budgetVersion, expectedRevision): Promise<SaveBudgetVersionResult> {
      // service_role obrigatório. `actor` é sempre quem está executando
      // ESTA chamada — nunca extraído de budgetVersion.metadata.createdBy
      // (ver comentário em budgetVersionSnapshotRpcParams).
      const { data, error } = await supabase.rpc(
        "persist_budget_version_snapshot",
        budgetVersionSnapshotRpcParams(organizationId, actor, budgetVersion, expectedRevision),
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
