import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildConsolidatedBudgetCatalog,
  type ConsolidatedBudgetCatalogDto,
  type ConsolidatedBudgetVersionRow,
  type ContractStatus,
  type ProcurementCaseSummaryRow,
  type ProcurementLotSummaryRow,
  type ServiceItemEconomyRow,
} from "@/lib/budget/consolidated-budget-catalog";
import { readAllSupabasePages } from "@/lib/bdos/supabase-complete-read";

interface VersionDbRow {
  readonly id: string;
  readonly procurement_case_id: string;
  readonly procurement_lot_id: string | null;
  readonly scope_kind: string;
  readonly origin_kind: string;
  readonly status: string;
  readonly revision: number;
  readonly updated_at: string;
}

interface CaseDbRow { readonly id: string; readonly title: string }
interface LotDbRow { readonly id: string; readonly procurement_case_id: string; readonly title: string }
interface BudgetLineDbRow {
  readonly id: string;
  readonly budget_version_id: string;
  readonly kind: string;
  readonly total_cents: string | number | null;
}
interface LineageDbRow { readonly budget_version_id: string; readonly source_budget_version_id: string | null }
interface ContractBaselineDbRow {
  readonly source_budget_version_id: string | null;
  readonly contractor_name_snapshot: string;
  readonly consortium_id: string | null;
  readonly contract_number: string;
  readonly status: string;
}
interface ConsortiumDbRow { readonly id: string; readonly legal_name: string; readonly trade_name: string | null }

export async function loadConsolidatedBudgetCatalog(
  client: SupabaseClient,
  organizationId: string,
): Promise<ConsolidatedBudgetCatalogDto> {
  const { data: rawVersions, error: versionsError } = await client
    .from("budget_versions")
    .select("id, procurement_case_id, procurement_lot_id, scope_kind, origin_kind, status, revision, updated_at")
    .eq("company_id", organizationId)
    .eq("status", "Consolidated")
    .order("updated_at", { ascending: false });

  if (versionsError) throw versionsError;
  const versionRows = (rawVersions ?? []) as VersionDbRow[];
  if (versionRows.length === 0) return { budgets: [], processes: [] };

  const budgetIds = versionRows.map((row) => row.id);
  const caseIds = Array.from(new Set(versionRows.map((row) => row.procurement_case_id)));
  const lotIds = Array.from(new Set(versionRows.flatMap((row) => row.procurement_lot_id ? [row.procurement_lot_id] : [])));

  const casesPromise = client
    .from("procurement_cases")
    .select("id, title")
    .eq("company_id", organizationId)
    .in("id", caseIds);
  const lotsPromise = lotIds.length === 0
    ? Promise.resolve({ data: [] as LotDbRow[], error: null })
    : client
      .from("procurement_lots")
      .select("id, procurement_case_id, title")
      .eq("company_id", organizationId)
      .in("id", lotIds);
  const budgetLinesPromise = Promise.all(budgetIds.map((budgetVersionId) =>
    readAllSupabasePages<BudgetLineDbRow>((from, to) => client
      .from("budget_lines")
      .select("id, budget_version_id, kind, total_cents")
      .eq("company_id", organizationId)
      .eq("budget_version_id", budgetVersionId)
      .order("id", { ascending: true })
      .range(from, to)),
  ));
  const lineagePromise = readAllSupabasePages<LineageDbRow>((from, to) => client
    .from("budget_version_lineage_relations")
    .select("budget_version_id, source_budget_version_id")
    .eq("company_id", organizationId)
    .in("budget_version_id", budgetIds)
    .order("budget_version_id", { ascending: true })
    .range(from, to));
  const contractsPromise = readAllSupabasePages<ContractBaselineDbRow>((from, to) => client
    .from("contract_baselines")
    .select("source_budget_version_id, contractor_name_snapshot, consortium_id, contract_number, status")
    .eq("company_id", organizationId)
    .in("source_budget_version_id", budgetIds)
    .order("created_at", { ascending: false })
    .range(from, to));

  const [casesResult, lotsResult, linePages, lineageRows, contractRows] = await Promise.all([
    casesPromise,
    lotsPromise,
    budgetLinesPromise,
    lineagePromise,
    contractsPromise,
  ]);
  if (casesResult.error) throw casesResult.error;
  if (lotsResult.error) throw lotsResult.error;
  const rawLines = linePages.flat();

  const consortiumIds = Array.from(new Set(contractRows.flatMap((row) => row.consortium_id ? [row.consortium_id] : [])));
  const consortiumRows = consortiumIds.length === 0
    ? []
    : await readAllSupabasePages<ConsortiumDbRow>((from, to) => client
      .from("consortia")
      .select("id, legal_name, trade_name")
      .eq("company_id", organizationId)
      .in("id", consortiumIds)
      .order("id", { ascending: true })
      .range(from, to));
  const consortiaById = new Map(consortiumRows.map((row) => [row.id, row]));

  const lineCounts: Record<string, number> = {};
  const serviceItems: ServiceItemEconomyRow[] = [];

  for (const row of rawLines) {
    lineCounts[row.budget_version_id] = (lineCounts[row.budget_version_id] ?? 0) + 1;
    if (row.kind === "ServiceItem" && row.total_cents !== null && row.total_cents !== undefined) {
      serviceItems.push({
        budgetVersionId: row.budget_version_id,
        totalCents: parseMoney(row.total_cents),
      });
    }
  }

  const versions: ConsolidatedBudgetVersionRow[] = versionRows.map((row) => ({
    id: row.id,
    procurementCaseId: row.procurement_case_id,
    procurementLotId: row.procurement_lot_id,
    scopeKind: parseScopeKind(row.scope_kind),
    originKind: parseOriginKind(row.origin_kind),
    status: "Consolidated",
    revision: row.revision,
    updatedAt: row.updated_at,
  }));
  const procurementCases: ProcurementCaseSummaryRow[] = ((casesResult.data ?? []) as CaseDbRow[]).map((row) => ({ id: row.id, title: row.title }));
  const procurementLots: ProcurementLotSummaryRow[] = ((lotsResult.data ?? []) as LotDbRow[]).map((row) => ({
    id: row.id,
    procurementCaseId: row.procurement_case_id,
    title: row.title,
  }));

  return buildConsolidatedBudgetCatalog({
    versions,
    procurementCases,
    procurementLots,
    serviceItems,
    lineCounts,
    lineageRelations: lineageRows.map((row) => ({
      budgetVersionId: row.budget_version_id,
      sourceBudgetVersionId: row.source_budget_version_id,
    })),
    contractedVersions: contractRows.reduce<Array<{
      budgetVersionId: string;
      contractorName: string | null;
      contractNumber: string;
      contractStatus: ContractStatus;
    }>>((contracts, row) => {
      if (row.source_budget_version_id === null || contracts.some((item) => item.budgetVersionId === row.source_budget_version_id)) {
        return contracts;
      }
      const consortium = row.consortium_id === null ? null : consortiaById.get(row.consortium_id) ?? null;
      contracts.push({
        budgetVersionId: row.source_budget_version_id,
        contractorName: consortium?.trade_name ?? consortium?.legal_name ?? row.contractor_name_snapshot ?? null,
        contractNumber: row.contract_number,
        contractStatus: parseContractStatus(row.status),
      });
      return contracts;
    }, []),
  });
}

function parseScopeKind(value: string): "WholeCase" | "Lot" {
  if (value === "WholeCase" || value === "Lot") return value;
  throw new Error(`Escopo de orçamento desconhecido: ${value}.`);
}

function parseOriginKind(value: string): "Native" | "DocumentaryOpaqueReference" {
  if (value === "Native" || value === "DocumentaryOpaqueReference") return value;
  throw new Error(`Origem de orçamento desconhecida: ${value}.`);
}

function parseContractStatus(value: string): ContractStatus {
  if (value === "Draft" || value === "InExecution" || value === "Suspended" || value === "Completed" || value === "Cancelled") {
    return value;
  }
  throw new Error(`Estado contratual desconhecido: ${value}.`);
}

function parseMoney(value: string | number): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Valor monetário inválido no orçamento consolidado.");
  return parsed;
}
