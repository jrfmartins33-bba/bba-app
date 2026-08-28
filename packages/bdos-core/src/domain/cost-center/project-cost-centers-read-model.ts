/**
 * Read model determinístico de Centros de Custo — Camada Operacional.
 *
 * BDOS calcula, a UI apenas apresenta. Função pura, sem I/O. Todo
 * dinheiro em decimal exato (centavos, bigint); todo percentual em
 * string de 2 casas derivada por bigint. Nunca float.
 *
 * Responde: quanto está atribuído a cada Centro de Custo, participação
 * de cada um nos custos do período, quais categorias/famílias concentram
 * custo, como cada despesa foi distribuída e por qual método, valor
 * ainda não atribuído, e a comparação (neutra) entre custos
 * demonstrativos e o valor medido do período — sem nunca chamar a
 * diferença de lucro, margem, ganho ou economia quando a natureza é
 * Demonstrative.
 */

import {
  addMeasurementDecimals,
  subtractMeasurementDecimals,
} from "../measurement-certification";
import {
  canonMoney,
  moneyToCents,
  sharePercent,
  validateCostEntryAllocations,
} from "./project-cost-allocation";
import {
  CostAllocationMethod,
  CostDataNature,
  CostEntryStatus,
  CostFamily,
  type AllocatableCostCenter,
  type ProjectCostAllocation,
  type ProjectCostEntry,
} from "./project-cost-allocation.types";

const MONEY_SCALE = 2;

export const COST_FAMILY_LABELS_PT_BR: Record<CostFamily, string> = {
  [CostFamily.RH]: "RH",
  [CostFamily.Combustivel]: "Combustível",
  [CostFamily.LocacaoEquipamentos]: "Locação de Equipamentos",
  [CostFamily.Outros]: "Outros",
};

export const COST_ALLOCATION_METHOD_LABELS_PT_BR: Record<CostAllocationMethod, string> = {
  [CostAllocationMethod.Direct]: "Atribuição direta",
  [CostAllocationMethod.EqualSplit]: "Rateio igual",
  [CostAllocationMethod.CustomSplit]: "Rateio específico",
};

export const COST_DATA_NATURE_LABELS_PT_BR: Record<CostDataNature, string> = {
  [CostDataNature.Demonstrative]: "Demonstrativo",
  [CostDataNature.Actual]: "Real",
};

/** Termos proibidos para a comparação quando a natureza é Demonstrative. */
export const FORBIDDEN_COMPARISON_TERMS = ["lucro", "margem", "ganho", "economia"] as const;

export interface ReadModelCostCenterInput extends AllocatableCostCenter {
  readonly consortiumMemberId: string | null;
  readonly consortiumMemberName: string | null;
  /** Participação societária no consórcio, em basis points (0..10000). null quando não há consórcio. */
  readonly consortiumShareBasisPoints: number | null;
}

export interface ReadModelEntryInput {
  readonly entry: ProjectCostEntry;
  readonly allocations: ReadonlyArray<ProjectCostAllocation>;
}

export interface MeasurementComparisonInput {
  /** true só quando a medição formal do período foi localizada deterministicamente. */
  readonly available: boolean;
  /** Valor medido do período (decimal exato). null quando indisponível. */
  readonly measuredValueDecimal: string | null;
  /** Rótulo da medição localizada (ex. "BM 08 · jun/2026"). Apenas leitura. */
  readonly measurementLabel: string | null;
}

export interface BuildProjectCostCentersReadModelInput {
  readonly organizationId: string;
  readonly engineeringProjectId: string;
  readonly projectName: string | null;
  /** Período gerencial — "YYYY-MM". */
  readonly period: string;
  readonly periodLabel: string;
  readonly dataNature: CostDataNature;
  /** Centros de Custo já persistidos (project_cost_centers). Podem existir sem nenhum custo. */
  readonly costCenters: ReadonlyArray<ReadModelCostCenterInput>;
  /** Custos + alocações do período. Vazio quando a camada ainda não foi materializada. */
  readonly costEntries: ReadonlyArray<ReadModelEntryInput>;
  /** true quando as tabelas operacionais existem e foram consultadas. */
  readonly operationalLayerMaterialized: boolean;
  readonly measurementComparison: MeasurementComparisonInput;
}

export interface ReadModelAllocationView {
  readonly costCenterId: string;
  readonly costCenterCode: string;
  readonly costCenterName: string;
  readonly amountDecimal: string;
  /** Apresentação pronta: "R$ 54.000,00". A UI nunca reformata dinheiro. */
  readonly amountFormatted: string;
  readonly percentage: string | null;
  /** Apresentação pronta: "100,00%" | "—". */
  readonly percentageFormatted: string;
  readonly method: CostAllocationMethod;
  readonly methodLabel: string;
  readonly basisPoints: number;
  readonly rationale: string | null;
}

export interface ReadModelEntryView {
  readonly id: string;
  readonly description: string;
  readonly family: CostFamily;
  readonly familyLabel: string;
  readonly category: string | null;
  readonly supplierName: string | null;
  readonly amountDecimal: string;
  readonly amountFormatted: string;
  readonly nature: CostDataNature;
  readonly natureLabel: string;
  readonly competence: string;
  readonly allocationStatus: CostEntryStatus;
  readonly unallocatedDecimal: string;
  readonly unallocatedFormatted: string;
  /** Decisão do domínio, não da UI: existe valor não atribuído nesta despesa? */
  readonly hasUnallocatedAmount: boolean;
  /** true quando a despesa tem uma única atribuição de 100% (atribuição direta simples). */
  readonly isSingleDirect: boolean;
  /** Rótulo pronto do critério predominante da despesa ("Atribuição direta" | "Rateio igual" | "Rateio específico"). */
  readonly criterionLabel: string;
  /** Explicação pronta do rateio, quando houver (ex.: 50/50 não decorre do consórcio). null para atribuição direta. */
  readonly distributionNote: string | null;
  readonly allocations: ReadonlyArray<ReadModelAllocationView>;
}

export interface ReadModelCostCenterView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly consortiumMemberId: string | null;
  readonly consortiumMemberName: string | null;
  readonly consortiumSharePercent: string | null;
  readonly consortiumShareFormatted: string;
  /** Largura de barra 0..100 (inteiro) — dica de layout, não valor financeiro. */
  readonly consortiumShareBarWidthPercent: number;
  readonly allocatedCostDecimal: string;
  readonly allocatedCostFormatted: string;
  readonly costSharePercent: string | null;
  readonly costShareFormatted: string;
  readonly costShareBarWidthPercent: number;
}

export interface ReadModelFamilyCostCenterView {
  readonly costCenterId: string;
  readonly costCenterCode: string;
  readonly amountDecimal: string;
  readonly amountFormatted: string;
}

export interface ReadModelFamilyView {
  readonly family: CostFamily;
  readonly familyLabel: string;
  readonly amountDecimal: string;
  readonly amountFormatted: string;
  readonly sharePercent: string | null;
  readonly shareFormatted: string;
  /** Largura de barra 0..100 (inteiro), normalizada pela maior família — layout, não valor. */
  readonly barWidthPercent: number;
  readonly costCenters: ReadonlyArray<ReadModelFamilyCostCenterView>;
}

/** Matriz "Custos por Centro de Custo e Categoria" — pronta para render. */
export interface ReadModelMatrixCell {
  readonly costCenterId: string;
  readonly amountDecimal: string;
  readonly amountFormatted: string;
}
export interface ReadModelMatrixRow {
  readonly family: CostFamily;
  readonly familyLabel: string;
  /** Uma célula por Centro de Custo, na MESMA ordem de `costMatrix.costCenters`. */
  readonly cells: ReadonlyArray<ReadModelMatrixCell>;
  readonly totalDecimal: string;
  readonly totalFormatted: string;
}
export interface ReadModelCostMatrix {
  /** Colunas da matriz — todos os Centros de Custo da obra, em ordem estável. */
  readonly costCenters: ReadonlyArray<{ readonly id: string; readonly code: string; readonly name: string }>;
  readonly rows: ReadonlyArray<ReadModelMatrixRow>;
  /** Linha "TOTAL" — uma célula por Centro de Custo, na mesma ordem das colunas. */
  readonly columnTotals: ReadonlyArray<ReadModelMatrixCell>;
  readonly grandTotalDecimal: string;
  readonly grandTotalFormatted: string;
}

export interface ReadModelMeasurementComparisonView {
  readonly available: boolean;
  readonly measurementLabel: string | null;
  readonly measuredValueDecimal: string | null;
  readonly measuredValueFormatted: string | null;
  readonly demonstrativeCostValueDecimal: string | null;
  readonly demonstrativeCostValueFormatted: string | null;
  readonly demonstrativeDifferenceDecimal: string | null;
  readonly demonstrativeDifferenceFormatted: string | null;
  /** Texto neutro pronto do domínio. Nunca usa lucro/margem/ganho/economia para natureza Demonstrative. */
  readonly neutralStatement: string | null;
  readonly disclaimer: string | null;
}

export interface ProjectCostCentersReadModel {
  readonly organizationId: string;
  readonly engineeringProjectId: string;
  readonly projectName: string | null;
  readonly period: string;
  readonly periodLabel: string;
  readonly dataNature: CostDataNature;
  readonly dataNatureLabel: string;
  /**
   * "materialized"        → camada operacional existe e foi lida (pode ter 0 custos).
   * "not_materialized"    → tabelas ainda não existem; Centros de Custo exibidos, sem custos.
   */
  readonly operationalState: "materialized" | "not_materialized";
  readonly hasCostEntries: boolean;
  readonly totalCostDecimal: string;
  readonly totalCostFormatted: string;
  readonly allocatedCostDecimal: string;
  readonly allocatedCostFormatted: string;
  readonly unallocatedCostDecimal: string;
  readonly unallocatedCostFormatted: string;
  /** Decisão do domínio: há valor não atribuído no período? */
  readonly hasUnallocatedAmount: boolean;
  readonly costCenters: ReadonlyArray<ReadModelCostCenterView>;
  readonly families: ReadonlyArray<ReadModelFamilyView>;
  /** Matriz Categoria × Centro de Custo pronta para apresentação. */
  readonly costMatrix: ReadModelCostMatrix;
  readonly entries: ReadonlyArray<ReadModelEntryView>;
  readonly measurementComparison: ReadModelMeasurementComparisonView;
  /** Nota gerencial curta: consórcio ≠ distribuição de custos. */
  readonly consortiumVsCostNote: string;
  /** Nota gerencial completa (bloco "Participação societária × distribuição dos custos"). */
  readonly consortiumVsCostDetailNote: string;
}

const FAMILY_ORDER: ReadonlyArray<CostFamily> = [
  CostFamily.RH,
  CostFamily.Combustivel,
  CostFamily.LocacaoEquipamentos,
  CostFamily.Outros,
];

export function buildProjectCostCentersReadModel(
  input: BuildProjectCostCentersReadModelInput,
): ProjectCostCentersReadModel {
  const costCentersById = new Map<string, AllocatableCostCenter>(
    input.costCenters.map((cc) => [
      cc.id,
      {
        id: cc.id,
        organizationId: cc.organizationId,
        engineeringProjectId: cc.engineeringProjectId,
        code: cc.code,
        name: cc.name,
      },
    ]),
  );

  // Valida cada custo + alocações contra todas as invariantes (lança em violação).
  const reports = input.costEntries.map((e) =>
    validateCostEntryAllocations(e.entry, e.allocations, costCentersById),
  );

  const totalCostDecimal = addMeasurementDecimals(
    input.costEntries.map((e) => e.entry.amountDecimal),
    MONEY_SCALE,
  );
  const allocatedCostDecimal = addMeasurementDecimals(
    reports.map((r) => r.allocatedDecimal),
    MONEY_SCALE,
  );
  const unallocatedCostDecimal = subtractMeasurementDecimals(
    totalCostDecimal,
    allocatedCostDecimal,
    MONEY_SCALE,
  );

  // ---- Por Centro de Custo ----
  const allocatedByCostCenter = new Map<string, string>();
  for (const { allocations } of input.costEntries) {
    for (const alloc of allocations) {
      const prev = allocatedByCostCenter.get(alloc.projectCostCenterId) ?? "0.00";
      allocatedByCostCenter.set(
        alloc.projectCostCenterId,
        addMeasurementDecimals([prev, alloc.allocatedAmountDecimal], MONEY_SCALE),
      );
    }
  }

  const costCenters: ReadModelCostCenterView[] = input.costCenters.map((cc) => {
    const allocated = canonMoney(allocatedByCostCenter.get(cc.id) ?? "0.00");
    const consortiumSharePercent =
      cc.consortiumShareBasisPoints !== null
        ? formatBasisPointsPercent(cc.consortiumShareBasisPoints)
        : null;
    const costSharePercent = sharePercent(allocated, totalCostDecimal);
    return {
      id: cc.id,
      code: cc.code,
      name: cc.name,
      consortiumMemberId: cc.consortiumMemberId,
      consortiumMemberName: cc.consortiumMemberName,
      consortiumSharePercent,
      consortiumShareFormatted: formatPercentPtBr(consortiumSharePercent),
      consortiumShareBarWidthPercent: percentStringToBarWidth(consortiumSharePercent),
      allocatedCostDecimal: allocated,
      allocatedCostFormatted: formatBrlFromDecimal(allocated),
      costSharePercent,
      costShareFormatted: formatPercentPtBr(costSharePercent),
      costShareBarWidthPercent: percentStringToBarWidth(costSharePercent),
    };
  });

  // ---- Por família + família × centro de custo ----
  const familyTotals = new Map<CostFamily, string>();
  const familyByCostCenter = new Map<CostFamily, Map<string, string>>();
  for (const { entry, allocations } of input.costEntries) {
    familyTotals.set(
      entry.costFamily,
      addMeasurementDecimals([familyTotals.get(entry.costFamily) ?? "0.00", entry.amountDecimal], MONEY_SCALE),
    );
    const perCenter = familyByCostCenter.get(entry.costFamily) ?? new Map<string, string>();
    for (const alloc of allocations) {
      const prev = perCenter.get(alloc.projectCostCenterId) ?? "0.00";
      perCenter.set(
        alloc.projectCostCenterId,
        addMeasurementDecimals([prev, alloc.allocatedAmountDecimal], MONEY_SCALE),
      );
    }
    familyByCostCenter.set(entry.costFamily, perCenter);
  }

  const orderedFamilies = FAMILY_ORDER.filter((f) => familyTotals.has(f));
  const maxFamilyCents = orderedFamilies.reduce((max, f) => {
    const cents = moneyToCents(canonMoney(familyTotals.get(f) ?? "0.00"));
    return cents > max ? cents : max;
  }, 0n);

  const families: ReadModelFamilyView[] = orderedFamilies.map((family) => {
    const amountDecimal = canonMoney(familyTotals.get(family) ?? "0.00");
    const perCenter = familyByCostCenter.get(family) ?? new Map<string, string>();
    const familyCostCenters: ReadModelFamilyCostCenterView[] = input.costCenters
      .filter((cc) => perCenter.has(cc.id))
      .map((cc) => {
        const centerAmount = canonMoney(perCenter.get(cc.id) ?? "0.00");
        return {
          costCenterId: cc.id,
          costCenterCode: cc.code,
          amountDecimal: centerAmount,
          amountFormatted: formatBrlFromDecimal(centerAmount),
        };
      });
    const share = sharePercent(amountDecimal, totalCostDecimal);
    return {
      family,
      familyLabel: COST_FAMILY_LABELS_PT_BR[family],
      amountDecimal,
      amountFormatted: formatBrlFromDecimal(amountDecimal),
      sharePercent: share,
      shareFormatted: formatPercentPtBr(share),
      barWidthPercent:
        maxFamilyCents > 0n ? Number((moneyToCents(amountDecimal) * 100n) / maxFamilyCents) : 0,
      costCenters: familyCostCenters,
    };
  });

  // ---- Matriz Categoria × Centro de Custo (pronta para render) ----
  const matrixColumns = input.costCenters.map((cc) => ({ id: cc.id, code: cc.code, name: cc.name }));
  const matrixRows: ReadModelMatrixRow[] = orderedFamilies.map((family) => {
    const perCenter = familyByCostCenter.get(family) ?? new Map<string, string>();
    const cells: ReadModelMatrixCell[] = input.costCenters.map((cc) => {
      const amt = canonMoney(perCenter.get(cc.id) ?? "0.00");
      return { costCenterId: cc.id, amountDecimal: amt, amountFormatted: formatBrlFromDecimal(amt) };
    });
    const totalDecimal = canonMoney(familyTotals.get(family) ?? "0.00");
    return {
      family,
      familyLabel: COST_FAMILY_LABELS_PT_BR[family],
      cells,
      totalDecimal,
      totalFormatted: formatBrlFromDecimal(totalDecimal),
    };
  });
  const matrixColumnTotals: ReadModelMatrixCell[] = input.costCenters.map((cc) => {
    const amt = canonMoney(allocatedByCostCenter.get(cc.id) ?? "0.00");
    return { costCenterId: cc.id, amountDecimal: amt, amountFormatted: formatBrlFromDecimal(amt) };
  });
  const costMatrix: ReadModelCostMatrix = {
    costCenters: matrixColumns,
    rows: matrixRows,
    columnTotals: matrixColumnTotals,
    grandTotalDecimal: canonMoney(allocatedCostDecimal),
    grandTotalFormatted: formatBrlFromDecimal(allocatedCostDecimal),
  };

  // ---- Despesas ----
  const entries: ReadModelEntryView[] = input.costEntries.map(({ entry, allocations }, index) => {
    const report = reports[index];
    const entryAmount = canonMoney(entry.amountDecimal);
    const primaryMethod = allocations[0]?.allocationMethod ?? null;
    const isSingleDirect = allocations.length === 1 && primaryMethod === CostAllocationMethod.Direct;
    const criterionLabel = primaryMethod !== null ? COST_ALLOCATION_METHOD_LABELS_PT_BR[primaryMethod] : "—";
    const storedRationale = allocations
      .map((a) => a.rationale)
      .find((r): r is string => typeof r === "string" && r.trim() !== "");
    const distributionNote =
      storedRationale ??
      (primaryMethod === CostAllocationMethod.EqualSplit || primaryMethod === CostAllocationMethod.CustomSplit
        ? "Critério de rateio definido especificamente para esta despesa. Não decorre da participação societária do consórcio."
        : null);
    return {
      id: entry.id,
      description: entry.description,
      family: entry.costFamily,
      familyLabel: COST_FAMILY_LABELS_PT_BR[entry.costFamily],
      category: entry.categoryLabel,
      supplierName: entry.supplierName,
      amountDecimal: entryAmount,
      amountFormatted: formatBrlFromDecimal(entryAmount),
      nature: entry.dataNature,
      natureLabel: COST_DATA_NATURE_LABELS_PT_BR[entry.dataNature],
      competence: entry.competencePeriod,
      allocationStatus: entry.status,
      unallocatedDecimal: report.unallocatedDecimal,
      unallocatedFormatted: formatBrlFromDecimal(report.unallocatedDecimal),
      hasUnallocatedAmount: moneyToCents(report.unallocatedDecimal) !== 0n,
      isSingleDirect,
      criterionLabel,
      distributionNote,
      allocations: allocations.map((alloc) => {
        const cc = costCentersById.get(alloc.projectCostCenterId);
        const allocAmount = canonMoney(alloc.allocatedAmountDecimal);
        const percentage = sharePercent(alloc.allocatedAmountDecimal, entry.amountDecimal);
        return {
          costCenterId: alloc.projectCostCenterId,
          costCenterCode: cc?.code ?? alloc.projectCostCenterId,
          costCenterName: cc?.name ?? alloc.projectCostCenterId,
          amountDecimal: allocAmount,
          amountFormatted: formatBrlFromDecimal(allocAmount),
          percentage,
          percentageFormatted: formatPercentPtBr(percentage),
          method: alloc.allocationMethod,
          methodLabel: COST_ALLOCATION_METHOD_LABELS_PT_BR[alloc.allocationMethod],
          basisPoints: alloc.allocationBasisPoints,
          rationale: alloc.rationale,
        };
      }),
    };
  });

  // ---- Comparação com a medição do período (neutra) ----
  const measurementComparison = buildMeasurementComparisonView(
    input.measurementComparison,
    input.dataNature,
    totalCostDecimal,
    input.costEntries.length > 0,
  );

  return {
    organizationId: input.organizationId,
    engineeringProjectId: input.engineeringProjectId,
    projectName: input.projectName,
    period: input.period,
    periodLabel: input.periodLabel,
    dataNature: input.dataNature,
    dataNatureLabel: COST_DATA_NATURE_LABELS_PT_BR[input.dataNature],
    operationalState: input.operationalLayerMaterialized ? "materialized" : "not_materialized",
    hasCostEntries: input.costEntries.length > 0,
    totalCostDecimal: canonMoney(totalCostDecimal),
    totalCostFormatted: formatBrlFromDecimal(totalCostDecimal),
    allocatedCostDecimal: canonMoney(allocatedCostDecimal),
    allocatedCostFormatted: formatBrlFromDecimal(allocatedCostDecimal),
    unallocatedCostDecimal: canonMoney(unallocatedCostDecimal),
    unallocatedCostFormatted: formatBrlFromDecimal(unallocatedCostDecimal),
    hasUnallocatedAmount: moneyToCents(unallocatedCostDecimal) !== 0n,
    costCenters,
    families,
    costMatrix,
    entries,
    measurementComparison,
    consortiumVsCostNote:
      "A participação no consórcio não determina automaticamente a distribuição dos custos.",
    consortiumVsCostDetailNote:
      "A participação no consórcio não determina automaticamente a distribuição dos custos. " +
      "Cada despesa pode ter atribuição direta ou critério específico de rateio.",
  };
}

function buildMeasurementComparisonView(
  input: MeasurementComparisonInput,
  dataNature: CostDataNature,
  totalCostDecimal: string,
  hasCostEntries: boolean,
): ReadModelMeasurementComparisonView {
  if (!input.available || input.measuredValueDecimal === null || !hasCostEntries) {
    return {
      available: false,
      measurementLabel: input.measurementLabel,
      measuredValueDecimal: null,
      measuredValueFormatted: null,
      demonstrativeCostValueDecimal: null,
      demonstrativeCostValueFormatted: null,
      demonstrativeDifferenceDecimal: null,
      demonstrativeDifferenceFormatted: null,
      neutralStatement: null,
      disclaimer: null,
    };
  }

  const measured = canonMoney(input.measuredValueDecimal);
  const cost = canonMoney(totalCostDecimal);
  const difference = subtractMeasurementDecimals(measured, cost, MONEY_SCALE);
  const isDemonstrative = dataNature === CostDataNature.Demonstrative;

  return {
    available: true,
    measurementLabel: input.measurementLabel,
    measuredValueDecimal: measured,
    measuredValueFormatted: formatBrlFromDecimal(measured),
    demonstrativeCostValueDecimal: cost,
    demonstrativeCostValueFormatted: formatBrlFromDecimal(cost),
    demonstrativeDifferenceDecimal: difference,
    demonstrativeDifferenceFormatted: formatBrlFromDecimal(difference),
    neutralStatement: isDemonstrative
      ? "Diferença demonstrativa entre o valor medido e os custos utilizados nesta simulação."
      : "Diferença entre o valor medido no período e os custos apropriados.",
    disclaimer: isDemonstrative
      ? "Esta diferença utiliza custos demonstrativos e não representa lucro, margem ou resultado econômico real da obra."
      : null,
  };
}

/** basis points (0..10000) → "50.00". */
export function formatBasisPointsPercent(basisPoints: number): string {
  const clamped = Math.max(0, Math.min(10_000, Math.round(basisPoints)));
  const whole = Math.floor(clamped / 100);
  const frac = (clamped % 100).toString().padStart(2, "0");
  return `${whole}.${frac}`;
}

/**
 * "54000.00" → "R$ 54.000,00". Puramente por manipulação de string sobre
 * o decimal canônico de 2 casas — NUNCA converte para Number/float. É a
 * apresentação pronta que a UI renderiza sem recalcular nada.
 */
export function formatBrlFromDecimal(decimal: string): string {
  const canon = canonMoney(decimal);
  const negative = canon.startsWith("-");
  const unsigned = negative ? canon.slice(1) : canon;
  const [intPartRaw, fracPartRaw = "00"] = unsigned.split(".");
  const fracPart = (fracPartRaw + "00").slice(0, 2);
  const intPart = intPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "- " : ""}R$ ${intPart},${fracPart}`;
}

/** "51.32" → "51,32%". null → "—". Apresentação; sem recálculo. */
export function formatPercentPtBr(value: string | null): string {
  return value === null ? "—" : `${value.replace(".", ",")}%`;
}

/**
 * String percentual "51.32" → inteiro 0..100 para largura de barra CSS.
 * É uma dica de layout derivada de um percentual JÁ calculado pelo
 * domínio — não recalcula valor financeiro nem participação.
 */
function percentStringToBarWidth(value: string | null): number {
  if (value === null) return 0;
  const [wholeRaw] = value.split(".");
  const whole = Number.parseInt(wholeRaw, 10);
  if (!Number.isFinite(whole)) return 0;
  return Math.max(0, Math.min(100, whole));
}
