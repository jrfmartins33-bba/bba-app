export interface ConsolidatedBudgetVersionRow {
  readonly id: string;
  readonly procurementCaseId: string;
  readonly procurementLotId: string | null;
  readonly scopeKind: "WholeCase" | "Lot";
  readonly status: "Consolidated";
  readonly revision: number;
  readonly updatedAt: string;
}

export interface ProcurementCaseSummaryRow {
  readonly id: string;
  readonly title: string;
}

export interface ProcurementLotSummaryRow {
  readonly id: string;
  readonly procurementCaseId: string;
  readonly title: string;
}

export interface ServiceItemEconomyRow {
  readonly budgetVersionId: string;
  readonly totalCents: number;
}

export interface ConsolidatedBudgetSummaryDto {
  readonly id: string;
  readonly procurementCaseId: string;
  readonly procurementLotId: string | null;
  readonly procurementCaseTitle: string;
  readonly procurementLotTitle: string | null;
  readonly scopeKind: "WholeCase" | "Lot";
  readonly status: "Consolidated";
  readonly revision: number;
  readonly officialValueCents: number;
  readonly lineCount: number | null;
  readonly serviceItemCount: number;
  readonly updatedAt: string;
}

export interface ConsolidatedBudgetProcessDto {
  readonly procurementCaseId: string;
  readonly title: string;
  readonly budgets: ReadonlyArray<ConsolidatedBudgetSummaryDto>;
  readonly totalOfficialValueCents: number;
}

export interface ConsolidatedBudgetCatalogDto {
  readonly budgets: ReadonlyArray<ConsolidatedBudgetSummaryDto>;
  readonly processes: ReadonlyArray<ConsolidatedBudgetProcessDto>;
}

export interface LotPresentation {
  readonly title: string;
  readonly detail: string | null;
}

export function buildConsolidatedBudgetCatalog(input: {
  readonly versions: ReadonlyArray<ConsolidatedBudgetVersionRow>;
  readonly procurementCases: ReadonlyArray<ProcurementCaseSummaryRow>;
  readonly procurementLots: ReadonlyArray<ProcurementLotSummaryRow>;
  readonly serviceItems: ReadonlyArray<ServiceItemEconomyRow>;
  readonly lineCounts: Readonly<Record<string, number | null>>;
}): ConsolidatedBudgetCatalogDto {
  const casesById = new Map(input.procurementCases.map((item) => [item.id, item]));
  const lotsById = new Map(input.procurementLots.map((item) => [item.id, item]));
  const economicsByBudgetId = new Map<string, { total: number; count: number }>();

  for (const item of input.serviceItems) {
    const current = economicsByBudgetId.get(item.budgetVersionId) ?? { total: 0, count: 0 };
    const total = current.total + item.totalCents;
    if (!Number.isSafeInteger(total)) throw new Error("Valor oficial fora do intervalo seguro.");
    economicsByBudgetId.set(item.budgetVersionId, { total, count: current.count + 1 });
  }

  const budgets = input.versions.map((version): ConsolidatedBudgetSummaryDto => {
    const procurementCase = casesById.get(version.procurementCaseId);
    if (!procurementCase) throw new Error(`Processo não encontrado para a versão ${version.id}.`);

    const procurementLot = version.procurementLotId === null ? null : lotsById.get(version.procurementLotId) ?? null;
    if (version.scopeKind === "Lot") {
      if (!procurementLot || procurementLot.procurementCaseId !== version.procurementCaseId) {
        throw new Error(`Lote canônico não encontrado para a versão ${version.id}.`);
      }
    }

    const economics = economicsByBudgetId.get(version.id) ?? { total: 0, count: 0 };
    return {
      id: version.id,
      procurementCaseId: version.procurementCaseId,
      procurementLotId: version.procurementLotId,
      procurementCaseTitle: procurementCase.title,
      procurementLotTitle: procurementLot?.title ?? null,
      scopeKind: version.scopeKind,
      status: version.status,
      revision: version.revision,
      officialValueCents: economics.total,
      lineCount: input.lineCounts[version.id] ?? null,
      serviceItemCount: economics.count,
      updatedAt: version.updatedAt,
    };
  });

  const grouped = new Map<string, ConsolidatedBudgetSummaryDto[]>();
  for (const budget of budgets) {
    const current = grouped.get(budget.procurementCaseId) ?? [];
    current.push(budget);
    grouped.set(budget.procurementCaseId, current);
  }

  const processes = Array.from(grouped.entries()).map(([procurementCaseId, processBudgets]) => {
    const totalOfficialValueCents = processBudgets.reduce((total, budget) => {
      const next = total + budget.officialValueCents;
      if (!Number.isSafeInteger(next)) throw new Error("Total dos lotes fora do intervalo seguro.");
      return next;
    }, 0);
    return {
      procurementCaseId,
      title: processBudgets[0].procurementCaseTitle,
      budgets: processBudgets,
      totalOfficialValueCents,
    };
  });

  return { budgets, processes };
}

export function lotPresentation(title: string | null, scopeKind: "WholeCase" | "Lot"): LotPresentation {
  if (scopeKind === "WholeCase") return { title: "Processo completo", detail: null };
  if (!title) return { title: "Lote", detail: null };
  const match = title.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return match ? { title: match[1].trim(), detail: match[2].trim() } : { title, detail: null };
}

export function resolveScenarioSourceBudget(
  budgets: ReadonlyArray<ConsolidatedBudgetSummaryDto>,
  selection: {
    readonly requestedBudgetId: string | null;
    readonly selectedBudgetId: string | null;
    readonly duplicateSourceBudgetId: string | null;
  },
): ConsolidatedBudgetSummaryDto | null {
  const sourceId = selection.duplicateSourceBudgetId
    ?? selection.selectedBudgetId
    ?? selection.requestedBudgetId;
  if (sourceId) return budgets.find((budget) => budget.id === sourceId) ?? null;
  return budgets.length === 1 ? budgets[0] : null;
}
