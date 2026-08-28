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
  readonly percentage: string | null;
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
  readonly nature: CostDataNature;
  readonly natureLabel: string;
  readonly competence: string;
  readonly allocationStatus: CostEntryStatus;
  readonly unallocatedDecimal: string;
  readonly allocations: ReadonlyArray<ReadModelAllocationView>;
}

export interface ReadModelCostCenterView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly consortiumMemberId: string | null;
  readonly consortiumMemberName: string | null;
  readonly consortiumSharePercent: string | null;
  readonly allocatedCostDecimal: string;
  readonly costSharePercent: string | null;
}

export interface ReadModelFamilyCostCenterView {
  readonly costCenterId: string;
  readonly costCenterCode: string;
  readonly amountDecimal: string;
}

export interface ReadModelFamilyView {
  readonly family: CostFamily;
  readonly familyLabel: string;
  readonly amountDecimal: string;
  readonly sharePercent: string | null;
  readonly costCenters: ReadonlyArray<ReadModelFamilyCostCenterView>;
}

export interface ReadModelMeasurementComparisonView {
  readonly available: boolean;
  readonly measurementLabel: string | null;
  readonly measuredValueDecimal: string | null;
  readonly demonstrativeCostValueDecimal: string | null;
  readonly demonstrativeDifferenceDecimal: string | null;
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
  readonly allocatedCostDecimal: string;
  readonly unallocatedCostDecimal: string;
  readonly costCenters: ReadonlyArray<ReadModelCostCenterView>;
  readonly families: ReadonlyArray<ReadModelFamilyView>;
  readonly entries: ReadonlyArray<ReadModelEntryView>;
  readonly measurementComparison: ReadModelMeasurementComparisonView;
  /** Nota gerencial fixa: consórcio ≠ distribuição de custos. */
  readonly consortiumVsCostNote: string;
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
    const allocated = allocatedByCostCenter.get(cc.id) ?? "0.00";
    return {
      id: cc.id,
      code: cc.code,
      name: cc.name,
      consortiumMemberId: cc.consortiumMemberId,
      consortiumMemberName: cc.consortiumMemberName,
      consortiumSharePercent:
        cc.consortiumShareBasisPoints !== null
          ? formatBasisPointsPercent(cc.consortiumShareBasisPoints)
          : null,
      allocatedCostDecimal: canonMoney(allocated),
      costSharePercent: sharePercent(allocated, totalCostDecimal),
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

  const families: ReadModelFamilyView[] = FAMILY_ORDER.filter((f) => familyTotals.has(f)).map((family) => {
    const amountDecimal = canonMoney(familyTotals.get(family) ?? "0.00");
    const perCenter = familyByCostCenter.get(family) ?? new Map<string, string>();
    const familyCostCenters: ReadModelFamilyCostCenterView[] = input.costCenters
      .filter((cc) => perCenter.has(cc.id))
      .map((cc) => ({
        costCenterId: cc.id,
        costCenterCode: cc.code,
        amountDecimal: canonMoney(perCenter.get(cc.id) ?? "0.00"),
      }));
    return {
      family,
      familyLabel: COST_FAMILY_LABELS_PT_BR[family],
      amountDecimal,
      sharePercent: sharePercent(amountDecimal, totalCostDecimal),
      costCenters: familyCostCenters,
    };
  });

  // ---- Despesas ----
  const entries: ReadModelEntryView[] = input.costEntries.map(({ entry, allocations }, index) => {
    const report = reports[index];
    return {
      id: entry.id,
      description: entry.description,
      family: entry.costFamily,
      familyLabel: COST_FAMILY_LABELS_PT_BR[entry.costFamily],
      category: entry.categoryLabel,
      supplierName: entry.supplierName,
      amountDecimal: canonMoney(entry.amountDecimal),
      nature: entry.dataNature,
      natureLabel: COST_DATA_NATURE_LABELS_PT_BR[entry.dataNature],
      competence: entry.competencePeriod,
      allocationStatus: entry.status,
      unallocatedDecimal: report.unallocatedDecimal,
      allocations: allocations.map((alloc) => {
        const cc = costCentersById.get(alloc.projectCostCenterId);
        return {
          costCenterId: alloc.projectCostCenterId,
          costCenterCode: cc?.code ?? alloc.projectCostCenterId,
          costCenterName: cc?.name ?? alloc.projectCostCenterId,
          amountDecimal: canonMoney(alloc.allocatedAmountDecimal),
          percentage: sharePercent(alloc.allocatedAmountDecimal, entry.amountDecimal),
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
    allocatedCostDecimal: canonMoney(allocatedCostDecimal),
    unallocatedCostDecimal: canonMoney(unallocatedCostDecimal),
    costCenters,
    families,
    entries,
    measurementComparison,
    consortiumVsCostNote:
      "A participação no consórcio não determina automaticamente a distribuição dos custos.",
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
      demonstrativeCostValueDecimal: null,
      demonstrativeDifferenceDecimal: null,
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
    demonstrativeCostValueDecimal: cost,
    demonstrativeDifferenceDecimal: difference,
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
