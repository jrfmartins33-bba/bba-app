import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildConsolidatedBudgetCatalog,
  type ConsolidatedBudgetCatalogDto,
  type ConsolidatedBudgetVersionRow,
  type ProcurementCaseSummaryRow,
  type ProcurementLotSummaryRow,
  type ServiceItemEconomyRow,
} from "@/lib/budget/consolidated-budget-catalog";

interface VersionDbRow {
  readonly id: string;
  readonly procurement_case_id: string;
  readonly procurement_lot_id: string | null;
  readonly scope_kind: string;
  readonly status: string;
  readonly revision: number;
  readonly updated_at: string;
}

interface CaseDbRow { readonly id: string; readonly title: string }
interface LotDbRow { readonly id: string; readonly procurement_case_id: string; readonly title: string }
interface ServiceItemDbRow { readonly budget_version_id: string; readonly total_cents: string | number }

export async function loadConsolidatedBudgetCatalog(
  client: SupabaseClient,
  organizationId: string,
): Promise<ConsolidatedBudgetCatalogDto> {
  const { data: rawVersions, error: versionsError } = await client
    .from("budget_versions")
    .select("id, procurement_case_id, procurement_lot_id, scope_kind, status, revision, updated_at")
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
  const serviceItemsPromise = client
    .from("budget_lines")
    .select("budget_version_id, total_cents")
    .eq("company_id", organizationId)
    .eq("kind", "ServiceItem")
    .in("budget_version_id", budgetIds);
  const lineCountPromises = budgetIds.map(async (budgetVersionId) => {
    const { count, error } = await client
      .from("budget_lines")
      .select("id", { count: "exact", head: true })
      .eq("company_id", organizationId)
      .eq("budget_version_id", budgetVersionId);
    if (error) throw error;
    return [budgetVersionId, count] as const;
  });

  const [casesResult, lotsResult, serviceItemsResult, lineCountEntries] = await Promise.all([
    casesPromise,
    lotsPromise,
    serviceItemsPromise,
    Promise.all(lineCountPromises),
  ]);
  if (casesResult.error) throw casesResult.error;
  if (lotsResult.error) throw lotsResult.error;
  if (serviceItemsResult.error) throw serviceItemsResult.error;

  const versions: ConsolidatedBudgetVersionRow[] = versionRows.map((row) => ({
    id: row.id,
    procurementCaseId: row.procurement_case_id,
    procurementLotId: row.procurement_lot_id,
    scopeKind: parseScopeKind(row.scope_kind),
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
  const serviceItems: ServiceItemEconomyRow[] = ((serviceItemsResult.data ?? []) as ServiceItemDbRow[]).map((row) => ({
    budgetVersionId: row.budget_version_id,
    totalCents: parseMoney(row.total_cents),
  }));

  return buildConsolidatedBudgetCatalog({
    versions,
    procurementCases,
    procurementLots,
    serviceItems,
    lineCounts: Object.fromEntries(lineCountEntries),
  });
}

function parseScopeKind(value: string): "WholeCase" | "Lot" {
  if (value === "WholeCase" || value === "Lot") return value;
  throw new Error(`Escopo de orçamento desconhecido: ${value}.`);
}

function parseMoney(value: string | number): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Valor monetário inválido no orçamento consolidado.");
  return parsed;
}
