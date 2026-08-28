import {
  addMeasurementDecimals,
  calculateMeasurementLineValue,
  canonicalizeMeasurementDecimal,
  subtractMeasurementDecimals,
  MeasurementDecimalQuantizationMode
} from "../measurement-certification";
import type { MemoriaSheetLayout, ParsedMemoriaResumo } from "./measurement-item-documentary-history.types";
import { classifyMemoriaResumo, type DocumentaryFieldObservation } from "./documentary-history-taxonomy";

/**
 * Camada B — reconstrução do histórico documental ITEM × PERÍODO a
 * partir das memórias de cálculo + reconciliação determinística contra
 * a Curva S (ITENS → GRUPO → OBRA). NÃO persiste nada. Dinheiro sempre
 * em decimal exato (measurement-certification), nunca float para
 * decisão. Divergência é REPORTADA, nunca compensada, nunca rateada.
 *
 * REALIDADE DOCUMENTADA (arquivo real BM_08): as 177 abas de memória
 * estão em CORTES HETEROGÊNEOS (MED-01, 02, 04, 05, 06, 07, 08) — não
 * há um "acumulado item a item no mês X" para X < junho/2026. Só o
 * BM nº 08 (junho) tem valor por item AUTORITATIVO (as 15 linhas
 * formais). O parser expõe o que existe; a reconciliação classifica
 * honestamente o que fecha e o que fica "sem base documental".
 */

const MONEY_SCALE = 2;
const QUANTITY_SCALE = 6;
const MONEY = MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero;
const MONEY_POLICY = { key: "BRL", scale: MONEY_SCALE, quantizationMode: MONEY };
/** Política de centavos: até 1 centavo por grupo/período é "dentro da política", acima é divergência. */
const CENTS_TOLERANCE_DECIMAL = "0.01";

export interface DocumentaryContractItem {
  readonly code: string;
  readonly managedServiceItemId: string;
  readonly unitPriceDecimal: string;
  readonly contractQuantityDecimal: string;
  readonly groupCode: string | null; // "1.0" .. "11.0"
}

/** Linha AUTORITATIVA do boletim formal (Camada A) — valor por item já decidido. */
export interface DocumentaryFormalPeriodLine {
  readonly itemCode: string;
  readonly groupCode: string | null;
  readonly periodDate: string; // ISO
  readonly valueDecimal: string;
}

/** Realizado NO PERÍODO da Curva S (Parte A), por grupo e por obra. */
export interface DocumentaryCurvaSPeriod {
  readonly periodDate: string;
  readonly groupCode: string; // "1.0" .. "11.0"
  readonly actualPeriodValueDecimal: string;
}
export interface DocumentaryCurvaSObraPeriod {
  readonly periodDate: string;
  readonly actualPeriodValueDecimal: string | null;
}

export type IdentityResolutionBasis = "operational_item_id" | "documentary_code_only" | "unresolved";

export interface ItemDocumentaryObservation {
  readonly itemCode: string;
  readonly managedServiceItemId: string | null;
  readonly identityBasis: IdentityResolutionBasis;
  readonly groupCode: string | null;
  readonly sourceSheet: string;
  readonly layout: MemoriaSheetLayout;
  readonly measurementRef: number | null;
  readonly measurementPeriodLabel: string | null;
  readonly semanticField: DocumentaryFieldObservation["semanticField"];
  readonly scope: DocumentaryFieldObservation["scope"];
  readonly unit: string | null;
  readonly quantityDecimal: string | null;
  readonly unitPriceDecimal: string | null;
  /** quantidade × preço unitário — SEMPRE derivado (as memórias não trazem valor). null quando falta insumo. */
  readonly valueDecimal: string | null;
  readonly valueIsDerived: boolean;
  readonly derivedFromCumulative: boolean;
  readonly isUnambiguous: boolean;
  readonly reasonIfAmbiguous: string | null;
  readonly sourceCells: ReadonlyArray<string>;
}

export interface BuildItemDocumentaryObservationsInput {
  readonly memorias: ReadonlyArray<ParsedMemoriaResumo>;
  readonly contractItems: ReadonlyArray<DocumentaryContractItem>;
}

export function buildItemDocumentaryObservations(
  input: BuildItemDocumentaryObservationsInput
): ReadonlyArray<ItemDocumentaryObservation> {
  const itemByCode = new Map(input.contractItems.map((item) => [item.code, item]));
  const out: ItemDocumentaryObservation[] = [];

  for (const memoria of input.memorias) {
    const contractItem = itemByCode.get(memoria.itemCode) ?? null;
    const managedServiceItemId = contractItem?.managedServiceItemId ?? null;
    const identityBasis: IdentityResolutionBasis =
      managedServiceItemId !== null ? "operational_item_id" : "documentary_code_only";
    const unitPriceDecimal = contractItem?.unitPriceDecimal ?? null;
    const groupCode = contractItem?.groupCode ?? null;

    for (const field of classifyMemoriaResumo(memoria)) {
      // Só os campos relevantes à reconstrução de execução por período /
      // acumulado entram como observação de item; `contract_quantity` e
      // `contract_balance_quantity` são contexto, não execução.
      if (
        field.semanticField !== "quantity_to_measure_in_period" &&
        field.semanticField !== "measured_accumulated_quantity_prior" &&
        field.semanticField !== "executed_accumulated_quantity" &&
        field.semanticField !== "monthly_series_quantity"
      ) {
        continue;
      }

      const valueDecimal =
        field.quantityDecimal !== null && unitPriceDecimal !== null
          ? calculateMeasurementLineValue({ quantity: field.quantityDecimal, unitValue: unitPriceDecimal, policy: MONEY_POLICY })
          : null;

      out.push({
        itemCode: memoria.itemCode,
        managedServiceItemId,
        identityBasis,
        groupCode,
        sourceSheet: memoria.sheetName,
        layout: memoria.layout,
        measurementRef: field.measurementRef,
        measurementPeriodLabel: field.measurementPeriodLabel,
        semanticField: field.semanticField,
        scope: field.scope,
        unit: field.unit,
        quantityDecimal: field.quantityDecimal,
        unitPriceDecimal,
        valueDecimal,
        valueIsDerived: valueDecimal !== null,
        derivedFromCumulative: field.derivedFromCumulative,
        isUnambiguous: field.isUnambiguous,
        reasonIfAmbiguous: field.reasonIfAmbiguous,
        sourceCells: field.sourceCells
      });
    }
  }

  return out;
}

// -------------------------------------------------------------------
// RECONCILIAÇÃO: ITENS → GRUPO → OBRA → CURVA S, por período.
// -------------------------------------------------------------------

export type GroupPeriodReconciliationStatus =
  | "reconciled_exact"
  | "reconciled_within_cents"
  | "divergent"
  | "partial_coverage"
  | "insufficient_documentary_basis";

export interface GroupPeriodReconciliation {
  readonly periodDate: string;
  readonly groupCode: string;
  readonly documentaryItemsCount: number;
  readonly documentarySumDecimal: string | null;
  readonly curvaSGroupRealizedDecimal: string;
  readonly differenceDecimal: string | null;
  readonly status: GroupPeriodReconciliationStatus;
  /** Códigos de item do grupo SEM valor documental para este período. */
  readonly itemsWithoutBasis: ReadonlyArray<string>;
}

export interface ObraPeriodReconciliation {
  readonly periodDate: string;
  readonly documentaryGroupsSumDecimal: string | null;
  readonly curvaSObraRealizedDecimal: string | null;
  readonly differenceDecimal: string | null;
  readonly status: GroupPeriodReconciliationStatus;
}

export interface DocumentaryReconciliation {
  readonly byGroupPeriod: ReadonlyArray<GroupPeriodReconciliation>;
  readonly byObraPeriod: ReadonlyArray<ObraPeriodReconciliation>;
}

export interface ReconcileDocumentaryHistoryInput {
  /** Valores por item AUTORITATIVOS por período (hoje só junho/2026 — as 15 linhas formais do BM nº 08). */
  readonly formalPeriodLines: ReadonlyArray<DocumentaryFormalPeriodLine>;
  readonly curvaSGroupPeriods: ReadonlyArray<DocumentaryCurvaSPeriod>;
  readonly curvaSObraPeriods: ReadonlyArray<DocumentaryCurvaSObraPeriod>;
  /** Itens do contrato por grupo — para saber quantos itens de um grupo ficaram sem base documental. */
  readonly contractItems: ReadonlyArray<DocumentaryContractItem>;
}

function classifyDifference(differenceDecimal: string): GroupPeriodReconciliationStatus {
  const absDiff = differenceDecimal.startsWith("-") ? differenceDecimal.slice(1) : differenceDecimal;
  if (isCanonicalZero(absDiff)) return "reconciled_exact";
  return compareDecimals(absDiff, CENTS_TOLERANCE_DECIMAL) <= 0 ? "reconciled_within_cents" : "divergent";
}

export function reconcileDocumentaryHistory(input: ReconcileDocumentaryHistoryInput): DocumentaryReconciliation {
  const periodDates = Array.from(
    new Set([
      ...input.curvaSObraPeriods.map((p) => p.periodDate),
      ...input.curvaSGroupPeriods.map((p) => p.periodDate)
    ])
  ).sort();

  const groupCodes = Array.from(new Set(input.curvaSGroupPeriods.map((p) => p.groupCode))).sort(
    (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)
  );

  const curvaSGroupByKey = new Map(input.curvaSGroupPeriods.map((p) => [`${p.periodDate}|${p.groupCode}`, p.actualPeriodValueDecimal]));
  const curvaSObraByDate = new Map(input.curvaSObraPeriods.map((p) => [p.periodDate, p.actualPeriodValueDecimal]));

  const formalByGroupPeriod = new Map<string, DocumentaryFormalPeriodLine[]>();
  for (const line of input.formalPeriodLines) {
    if (line.groupCode === null) continue;
    const key = `${line.periodDate}|${line.groupCode}`;
    const bucket = formalByGroupPeriod.get(key) ?? [];
    bucket.push(line);
    formalByGroupPeriod.set(key, bucket);
  }

  const itemsByGroup = new Map<string, DocumentaryContractItem[]>();
  for (const item of input.contractItems) {
    if (item.groupCode === null) continue;
    const bucket = itemsByGroup.get(item.groupCode) ?? [];
    bucket.push(item);
    itemsByGroup.set(item.groupCode, bucket);
  }

  const byGroupPeriod: GroupPeriodReconciliation[] = [];
  for (const periodDate of periodDates) {
    for (const groupCode of groupCodes) {
      const curvaSGroupRealizedDecimal = canonMoney(curvaSGroupByKey.get(`${periodDate}|${groupCode}`) ?? "0.00");
      const formalLines = formalByGroupPeriod.get(`${periodDate}|${groupCode}`) ?? [];
      const groupItems = itemsByGroup.get(groupCode) ?? [];

      if (formalLines.length === 0) {
        // Sem valor por item AUTORITATIVO para este (grupo, período).
        // Se a Curva S também não teve realização no grupo/período, é
        // "reconciliado exato" (0 = 0); caso contrário, não há base
        // documental item a item para reconciliar.
        byGroupPeriod.push({
          periodDate,
          groupCode,
          documentaryItemsCount: 0,
          documentarySumDecimal: null,
          curvaSGroupRealizedDecimal,
          differenceDecimal: null,
          status: isCanonicalZero(curvaSGroupRealizedDecimal) ? "reconciled_exact" : "insufficient_documentary_basis",
          itemsWithoutBasis: groupItems.map((item) => item.code)
        });
        continue;
      }

      const documentarySumDecimal = addMeasurementDecimals(formalLines.map((line) => line.valueDecimal), MONEY_SCALE);
      const differenceDecimal = subtractMeasurementDecimals(documentarySumDecimal, curvaSGroupRealizedDecimal, MONEY_SCALE);
      const coveredCodes = new Set(formalLines.map((line) => line.itemCode));
      const itemsWithoutBasis = groupItems.filter((item) => !coveredCodes.has(item.code)).map((item) => item.code);

      byGroupPeriod.push({
        periodDate,
        groupCode,
        documentaryItemsCount: formalLines.length,
        documentarySumDecimal,
        curvaSGroupRealizedDecimal,
        differenceDecimal,
        status: classifyDifference(differenceDecimal),
        itemsWithoutBasis
      });
    }
  }

  const byObraPeriod: ObraPeriodReconciliation[] = periodDates.map((periodDate) => {
    const curvaSObraRaw = curvaSObraByDate.get(periodDate) ?? null;
    const curvaSObraRealizedDecimal = curvaSObraRaw === null ? null : canonMoney(curvaSObraRaw);
    const groupRows = byGroupPeriod.filter((row) => row.periodDate === periodDate);
    const anyBasis = groupRows.some((row) => row.documentarySumDecimal !== null);
    if (!anyBasis || curvaSObraRealizedDecimal === null) {
      return {
        periodDate,
        documentaryGroupsSumDecimal: null,
        curvaSObraRealizedDecimal,
        differenceDecimal: null,
        status: curvaSObraRealizedDecimal !== null && isCanonicalZero(curvaSObraRealizedDecimal)
          ? "reconciled_exact"
          : "insufficient_documentary_basis"
      };
    }
    const documentaryGroupsSumDecimal = addMeasurementDecimals(
      groupRows.map((row) => row.documentarySumDecimal ?? "0.00"),
      MONEY_SCALE
    );
    const differenceDecimal = subtractMeasurementDecimals(documentaryGroupsSumDecimal, curvaSObraRealizedDecimal, MONEY_SCALE);
    const allGroupsCovered = groupRows.every(
      (row) => row.documentarySumDecimal !== null || isCanonicalZero(row.curvaSGroupRealizedDecimal)
    );
    const baseStatus = classifyDifference(differenceDecimal);
    return {
      periodDate,
      documentaryGroupsSumDecimal,
      curvaSObraRealizedDecimal,
      differenceDecimal,
      status: allGroupsCovered ? baseStatus : baseStatus === "reconciled_exact" ? "partial_coverage" : baseStatus
    };
  });

  return { byGroupPeriod, byObraPeriod };
}

// -------------------------------------------------------------------
// PRÉVIA DE PERSISTÊNCIA — números exatos, nunca texto genérico.
// -------------------------------------------------------------------

export interface DocumentaryHistoryPreview {
  readonly totalContractItems: number;
  readonly totalMemoriasFound: number;
  readonly layoutCounts: Readonly<Record<MemoriaSheetLayout, number>>;
  readonly itemsWithAtLeastOneUnambiguousPeriod: number;
  readonly totalItemPeriodObservations: number;
  readonly ambiguousObservations: number;
  readonly periodsCoveredByMeasurementRef: ReadonlyArray<number>;
  readonly documentaryValueByMeasurementRef: ReadonlyArray<{ readonly measurementRef: number | null; readonly valueDecimal: string }>;
  readonly reconciliationByObraPeriod: ReadonlyArray<ObraPeriodReconciliation>;
  readonly reconciliationByGroupPeriod: ReadonlyArray<GroupPeriodReconciliation>;
  readonly divergences: ReadonlyArray<GroupPeriodReconciliation>;
  readonly partialCoverage: ReadonlyArray<GroupPeriodReconciliation>;
  readonly itemsWithoutRecoverableHistory: number;
  readonly itemsAboveContractQuantity: ReadonlyArray<{ readonly itemCode: string; readonly contractQuantityDecimal: string | null; readonly executedAccumulatedQuantityDecimal: string | null; readonly contractBalanceQuantityDecimal: string | null; readonly sourceSheet: string }>;
  readonly executedNotProvenAsMeasured: ReadonlyArray<{ readonly itemCode: string; readonly executedAccumulatedQuantityDecimal: string | null; readonly measuredAccumulatedQuantityDecimal: string | null; readonly sourceSheet: string }>;
  readonly derivedFromCumulativeCount: number;
  readonly exceptionSourceCells: ReadonlyArray<{ readonly kind: string; readonly itemCode: string; readonly cells: ReadonlyArray<string> }>;
}

export interface BuildDocumentaryHistoryPreviewInput {
  readonly memorias: ReadonlyArray<ParsedMemoriaResumo>;
  readonly layoutCounts: Readonly<Record<MemoriaSheetLayout, number>>;
  readonly contractItems: ReadonlyArray<DocumentaryContractItem>;
  readonly observations: ReadonlyArray<ItemDocumentaryObservation>;
  readonly reconciliation: DocumentaryReconciliation;
}

export function buildDocumentaryHistoryPreview(input: BuildDocumentaryHistoryPreviewInput): DocumentaryHistoryPreview {
  const periodFieldObservations = input.observations.filter(
    (observation) =>
      observation.semanticField === "quantity_to_measure_in_period" ||
      observation.semanticField === "monthly_series_quantity"
  );

  const unambiguousPeriodItemCodes = new Set(
    periodFieldObservations.filter((observation) => observation.isUnambiguous && observation.quantityDecimal !== null).map((o) => o.itemCode)
  );

  const ambiguousObservations = input.observations.filter((observation) => !observation.isUnambiguous).length;

  const refSet = new Set<number>();
  for (const memoria of input.memorias) {
    if (memoria.measurementNumber !== null) refSet.add(memoria.measurementNumber);
  }
  const periodsCoveredByMeasurementRef = Array.from(refSet).sort((a, b) => a - b);

  const valueByRef = new Map<number | null, string[]>();
  for (const observation of periodFieldObservations) {
    if (observation.valueDecimal === null) continue;
    const key = observation.measurementRef;
    const bucket = valueByRef.get(key) ?? [];
    bucket.push(observation.valueDecimal);
    valueByRef.set(key, bucket);
  }
  const documentaryValueByMeasurementRef = Array.from(valueByRef.entries())
    .map(([measurementRef, values]) => ({ measurementRef, valueDecimal: addMeasurementDecimals(values, MONEY_SCALE) }))
    .sort((a, b) => (a.measurementRef ?? -1) - (b.measurementRef ?? -1));

  const divergences = input.reconciliation.byGroupPeriod.filter((row) => row.status === "divergent");
  const partialCoverage = input.reconciliation.byGroupPeriod.filter((row) => row.status === "partial_coverage");

  const memoriaByCode = new Map(input.memorias.map((memoria) => [memoria.itemCode, memoria]));

  const itemsAboveContractQuantity = input.memorias
    .filter((memoria) => {
      const balanceNegative = memoria.contractBalanceQuantity !== null && memoria.contractBalanceQuantity < 0;
      const executedOver =
        memoria.executedAccumulatedQuantity !== null &&
        memoria.contractQuantity !== null &&
        memoria.executedAccumulatedQuantity > memoria.contractQuantity;
      return balanceNegative || executedOver;
    })
    .map((memoria) => ({
      itemCode: memoria.itemCode,
      contractQuantityDecimal: numOrNull(memoria.contractQuantity),
      executedAccumulatedQuantityDecimal: numOrNull(memoria.executedAccumulatedQuantity),
      contractBalanceQuantityDecimal: numOrNull(memoria.contractBalanceQuantity),
      sourceSheet: memoria.sheetName
    }));

  const executedNotProvenAsMeasured = input.memorias
    .filter(
      (memoria) =>
        memoria.executedAccumulatedQuantity !== null &&
        memoria.measuredAccumulatedQuantity !== null &&
        memoria.executedAccumulatedQuantity !== memoria.measuredAccumulatedQuantity
    )
    .map((memoria) => ({
      itemCode: memoria.itemCode,
      executedAccumulatedQuantityDecimal: numOrNull(memoria.executedAccumulatedQuantity),
      measuredAccumulatedQuantityDecimal: numOrNull(memoria.measuredAccumulatedQuantity),
      sourceSheet: memoria.sheetName
    }));

  const matchedCodes = new Set(input.observations.map((observation) => observation.itemCode));
  const itemsWithoutRecoverableHistory = input.contractItems.filter(
    (item) => !unambiguousPeriodItemCodes.has(item.code)
  ).length;

  const exceptionSourceCells = [
    ...divergences.map((row) => ({ kind: "divergent_group_period", itemCode: `${row.groupCode}@${row.periodDate}`, cells: row.itemsWithoutBasis })),
    ...itemsAboveContractQuantity.map((row) => ({
      kind: "above_contract_quantity",
      itemCode: row.itemCode,
      cells: [`${row.sourceSheet}!RESUMO/Saldo contratual`, `${row.sourceSheet}!RESUMO/Quantidade executada acumulada`]
    })),
    ...executedNotProvenAsMeasured.map((row) => ({
      kind: "executed_not_proven_measured",
      itemCode: row.itemCode,
      cells: [`${row.sourceSheet}!RESUMO/Quantidade executada acumulada`, `${row.sourceSheet}!RESUMO/Quantidade medida acumulada em medições anteriores`]
    }))
  ];

  void memoriaByCode;
  void matchedCodes;

  return {
    totalContractItems: input.contractItems.length,
    totalMemoriasFound: input.memorias.length,
    layoutCounts: input.layoutCounts,
    itemsWithAtLeastOneUnambiguousPeriod: unambiguousPeriodItemCodes.size,
    totalItemPeriodObservations: periodFieldObservations.length,
    ambiguousObservations,
    periodsCoveredByMeasurementRef,
    documentaryValueByMeasurementRef,
    reconciliationByObraPeriod: input.reconciliation.byObraPeriod,
    reconciliationByGroupPeriod: input.reconciliation.byGroupPeriod,
    divergences,
    partialCoverage,
    itemsWithoutRecoverableHistory,
    itemsAboveContractQuantity,
    executedNotProvenAsMeasured,
    derivedFromCumulativeCount: input.observations.filter((observation) => observation.derivedFromCumulative).length,
    exceptionSourceCells
  };
}

// ---- helpers (decimal exato) ----

function canonMoney(decimal: string): string {
  return canonicalizeMeasurementDecimal(decimal, MONEY_SCALE, MONEY);
}
function numOrNull(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return canonicalizeMeasurementDecimal(value, QUANTITY_SCALE, MONEY);
}
function isCanonicalZero(decimal: string): boolean {
  return /^-?0(\.0+)?$/.test(decimal);
}
function compareDecimals(a: string, b: string): number {
  const scale = 8;
  const diff = toScaledBigInt(a, scale) - toScaledBigInt(b, scale);
  return diff > 0n ? 1 : diff < 0n ? -1 : 0;
}
function toScaledBigInt(decimal: string, scale: number): bigint {
  const negative = decimal.startsWith("-");
  const unsigned = negative ? decimal.slice(1) : decimal;
  const [int, frac = ""] = unsigned.split(".");
  const padded = (frac + "0".repeat(scale)).slice(0, scale);
  const value = BigInt(int || "0") * 10n ** BigInt(scale) + BigInt(padded || "0");
  return negative ? -value : value;
}
