export interface ConsolidatedBudgetVersionRow {
  readonly id: string;
  readonly procurementCaseId: string;
  readonly procurementLotId: string | null;
  readonly scopeKind: "WholeCase" | "Lot";
  readonly originKind: "Native" | "DocumentaryOpaqueReference";
  readonly status: "Consolidated";
  readonly revision: number;
  readonly updatedAt: string;
}

export interface BudgetVersionLineageSummaryRow {
  readonly budgetVersionId: string;
  readonly sourceBudgetVersionId: string | null;
}

export interface ContractedBudgetVersionSummaryRow {
  readonly budgetVersionId: string;
  readonly contractorName: string | null;
  readonly contractNumber: string;
  readonly contractStatus: ContractStatus;
}

export type BudgetDocumentKind = "OfficialBudget" | "WinningProposal" | "DerivedVersion";
export type BudgetProcessPresentationKind = "Lots" | "DocumentChain";
export type ContractStatus = "Draft" | "InExecution" | "Suspended" | "Completed" | "Cancelled";

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
  readonly originKind: "Native" | "DocumentaryOpaqueReference";
  readonly documentKind: BudgetDocumentKind;
  readonly sourceBudgetVersionId: string | null;
  readonly contractorName: string | null;
  readonly contractNumber: string | null;
  readonly contractStatus: ContractStatus | null;
  readonly scenarioCreationAllowed: boolean;
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
  readonly presentationKind: BudgetProcessPresentationKind;
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

export interface ContractedDocumentChain {
  readonly officialBudget: ConsolidatedBudgetSummaryDto;
  readonly winningProposal: ConsolidatedBudgetSummaryDto;
  readonly differenceCents: number;
  readonly differenceBasisPoints: number | null;
  readonly officialBarBasisPoints: number;
  readonly contractedBarBasisPoints: number;
  readonly comparisonKind: "Reduction" | "Increase" | "Equal";
}

export function buildConsolidatedBudgetCatalog(input: {
  readonly versions: ReadonlyArray<ConsolidatedBudgetVersionRow>;
  readonly procurementCases: ReadonlyArray<ProcurementCaseSummaryRow>;
  readonly procurementLots: ReadonlyArray<ProcurementLotSummaryRow>;
  readonly serviceItems: ReadonlyArray<ServiceItemEconomyRow>;
  readonly lineCounts: Readonly<Record<string, number | null>>;
  readonly lineageRelations?: ReadonlyArray<BudgetVersionLineageSummaryRow>;
  readonly contractedVersions?: ReadonlyArray<ContractedBudgetVersionSummaryRow>;
}): ConsolidatedBudgetCatalogDto {
  const casesById = new Map(input.procurementCases.map((item) => [item.id, item]));
  const lotsById = new Map(input.procurementLots.map((item) => [item.id, item]));
  const economicsByBudgetId = new Map<string, { total: number; count: number }>();
  const lineageByBudgetId = new Map((input.lineageRelations ?? []).map((relation) => [relation.budgetVersionId, relation]));
  const contractByBudgetId = new Map((input.contractedVersions ?? []).map((contract) => [contract.budgetVersionId, contract]));

  for (const item of input.serviceItems) {
    const current = economicsByBudgetId.get(item.budgetVersionId) ?? { total: 0, count: 0 };
    const total = current.total + item.totalCents;
    if (!Number.isSafeInteger(total)) throw new Error("Valor oficial fora do intervalo seguro.");
    economicsByBudgetId.set(item.budgetVersionId, { total, count: current.count + 1 });
  }

  const classifiedBudgets = input.versions.map((version): ConsolidatedBudgetSummaryDto => {
    const procurementCase = casesById.get(version.procurementCaseId);
    if (!procurementCase) throw new Error(`Processo não encontrado para a versão ${version.id}.`);

    const procurementLot = version.procurementLotId === null ? null : lotsById.get(version.procurementLotId) ?? null;
    if (version.scopeKind === "Lot") {
      if (!procurementLot || procurementLot.procurementCaseId !== version.procurementCaseId) {
        throw new Error(`Lote canônico não encontrado para a versão ${version.id}.`);
      }
    }

    const economics = economicsByBudgetId.get(version.id) ?? { total: 0, count: 0 };
    const sourceBudgetVersionId = lineageByBudgetId.get(version.id)?.sourceBudgetVersionId ?? null;
    const contract = contractByBudgetId.get(version.id) ?? null;
    const documentKind: BudgetDocumentKind = sourceBudgetVersionId === null
      ? "OfficialBudget"
      : contract === null ? "DerivedVersion" : "WinningProposal";
    return {
      id: version.id,
      procurementCaseId: version.procurementCaseId,
      procurementLotId: version.procurementLotId,
      procurementCaseTitle: procurementCase.title,
      procurementLotTitle: procurementLot?.title ?? null,
      scopeKind: version.scopeKind,
      originKind: version.originKind,
      documentKind,
      sourceBudgetVersionId,
      contractorName: contract?.contractorName ?? null,
      contractNumber: contract?.contractNumber ?? null,
      contractStatus: contract?.contractStatus ?? null,
      scenarioCreationAllowed: false,
      status: version.status,
      revision: version.revision,
      officialValueCents: economics.total,
      lineCount: input.lineCounts[version.id] ?? null,
      serviceItemCount: economics.count,
      updatedAt: version.updatedAt,
    };
  });

  const contractedScopeKeys = new Set(
    classifiedBudgets
      .filter((budget) => budget.documentKind === "WinningProposal")
      .map(budgetScopeKey),
  );
  const budgets = classifiedBudgets.map((budget): ConsolidatedBudgetSummaryDto => ({
    ...budget,
    scenarioCreationAllowed: budget.documentKind === "OfficialBudget"
      && !contractedScopeKeys.has(budgetScopeKey(budget)),
  }));

  const grouped = new Map<string, ConsolidatedBudgetSummaryDto[]>();
  for (const budget of budgets) {
    const current = grouped.get(budget.procurementCaseId) ?? [];
    current.push(budget);
    grouped.set(budget.procurementCaseId, current);
  }

  const processes = Array.from(grouped.entries()).map(([procurementCaseId, processBudgets]) => {
    const presentationKind: BudgetProcessPresentationKind = processBudgets.some((budget) => budget.scopeKind === "Lot") ? "Lots" : "DocumentChain";
    const sortedBudgets = presentationKind === "Lots"
      ? sortBudgetsByLotAscending(processBudgets)
      : sortBudgetsByDocumentChain(processBudgets);
    const totalOfficialValueCents = sortedBudgets.reduce((total, budget) => {
      const next = total + budget.officialValueCents;
      if (!Number.isSafeInteger(next)) throw new Error("Total dos lotes fora do intervalo seguro.");
      return next;
    }, 0);
    return {
      procurementCaseId,
      title: sortedBudgets[0].procurementCaseTitle,
      budgets: sortedBudgets,
      presentationKind,
      totalOfficialValueCents,
    };
  });

  return { budgets, processes };
}

export function resolveContractedDocumentChain(
  process: ConsolidatedBudgetProcessDto,
): ContractedDocumentChain | null {
  const winningProposal = process.budgets.find((budget) => budget.documentKind === "WinningProposal") ?? null;
  if (!winningProposal?.sourceBudgetVersionId) return null;
  const officialBudget = process.budgets.find((budget) => (
    budget.id === winningProposal.sourceBudgetVersionId
    && budget.documentKind === "OfficialBudget"
  )) ?? null;
  if (!officialBudget) return null;

  const signedDifference = officialBudget.officialValueCents - winningProposal.officialValueCents;
  if (!Number.isSafeInteger(signedDifference)) throw new Error("Diferença contratual fora do intervalo seguro.");
  const differenceCents = Math.abs(signedDifference);
  const comparisonMaximumCents = Math.max(
    officialBudget.officialValueCents,
    winningProposal.officialValueCents,
    1,
  );
  return {
    officialBudget,
    winningProposal,
    differenceCents,
    differenceBasisPoints: officialBudget.officialValueCents === 0
      ? null
      : percentageBasisPoints(differenceCents, officialBudget.officialValueCents),
    officialBarBasisPoints: percentageBasisPoints(officialBudget.officialValueCents, comparisonMaximumCents),
    contractedBarBasisPoints: percentageBasisPoints(winningProposal.officialValueCents, comparisonMaximumCents),
    comparisonKind: signedDifference > 0 ? "Reduction" : signedDifference < 0 ? "Increase" : "Equal",
  };
}

export function formatPercentageBasisPointsPtBr(basisPoints: number | null): string {
  if (basisPoints === null) return "—";
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) throw new Error("Percentual contratual inválido.");
  const whole = Math.floor(basisPoints / 100);
  const fraction = (basisPoints % 100).toString().padStart(2, "0");
  return `${whole.toLocaleString("pt-BR")},${fraction}%`;
}

export function contractStatusLabel(status: ContractStatus | null): string {
  switch (status) {
    case "Draft": return "Em preparação";
    case "InExecution": return "Em execução";
    case "Suspended": return "Suspenso";
    case "Completed": return "Concluído";
    case "Cancelled": return "Cancelado";
    default: return "Contratado";
  }
}

function budgetScopeKey(budget: Pick<ConsolidatedBudgetSummaryDto, "procurementCaseId" | "procurementLotId" | "scopeKind">): string {
  return budget.scopeKind === "Lot"
    ? `${budget.procurementCaseId}:lot:${budget.procurementLotId ?? "missing"}`
    : `${budget.procurementCaseId}:whole`;
}

function percentageBasisPoints(value: number, total: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(total) || total <= 0) {
    throw new Error("Base percentual contratual inválida.");
  }
  return Math.round((value / total) * 10_000);
}

export function sortBudgetsByDocumentChain(
  budgets: ReadonlyArray<ConsolidatedBudgetSummaryDto>,
): ReadonlyArray<ConsolidatedBudgetSummaryDto> {
  const remaining = new Map(budgets.map((budget) => [budget.id, budget]));
  const sorted: ConsolidatedBudgetSummaryDto[] = [];
  const included = new Set<string>();

  while (remaining.size > 0) {
    const next = [...remaining.values()]
      .filter((budget) => budget.sourceBudgetVersionId === null || included.has(budget.sourceBudgetVersionId))
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id))[0]
      ?? [...remaining.values()].sort((left, right) => left.id.localeCompare(right.id))[0];
    sorted.push(next);
    included.add(next.id);
    remaining.delete(next.id);
  }

  return sorted;
}

export function extractLotNumber(title: string | null): number {
  if (!title) return Number.MAX_SAFE_INTEGER;
  const match = title.match(/lote\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

export function sortBudgetsByLotAscending(
  budgets: ReadonlyArray<ConsolidatedBudgetSummaryDto>,
): ReadonlyArray<ConsolidatedBudgetSummaryDto> {
  return [...budgets].sort((left, right) => {
    const numLeft = extractLotNumber(left.procurementLotTitle);
    const numRight = extractLotNumber(right.procurementLotTitle);
    if (numLeft !== numRight) return numLeft - numRight;
    const titleLeft = left.procurementLotTitle ?? left.id;
    const titleRight = right.procurementLotTitle ?? right.id;
    return titleLeft.localeCompare(titleRight, "pt-BR", { numeric: true });
  });
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
