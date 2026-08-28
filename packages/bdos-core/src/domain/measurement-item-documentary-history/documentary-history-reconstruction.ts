import {
  addMeasurementDecimals,
  calculateMeasurementLineValue,
  canonicalizeMeasurementDecimal,
  subtractMeasurementDecimals,
  MeasurementDecimalQuantizationMode
} from "../measurement-certification";
import type { MeasurementMonetaryPolicy } from "../measurement-certification";
import type { MemoriaSheetLayout, ParsedMemoriaResumo } from "./measurement-item-documentary-history.types";
import { classifyMemoriaResumo, type DocumentaryFieldObservation } from "./documentary-history-taxonomy";

/**
 * Camada B — reconstrução do histórico documental ITEM × PERÍODO a
 * partir das memórias de cálculo + reconciliação determinística contra
 * a Curva S (ITENS → GRUPO → OBRA). NÃO persiste nada. Dinheiro sempre
 * em decimal exato (measurement-certification), nunca float para
 * decisão. Divergência é REPORTADA, nunca compensada, nunca rateada.
 *
 * QUANTIDADE DOCUMENTAL × VALOR DERIVADO — distinção obrigatória:
 * as memórias trazem SÓ QUANTIDADE. Qualquer `quantidade × preço
 * unitário contratado` é VALOR DERIVADO DE REFERÊNCIA — NUNCA
 * "valor documental", NUNCA evidência de reconciliação financeira
 * histórica. A política monetária do valor derivado entra
 * EXPLICITAMENTE como input; sem política comprovada, o valor derivado
 * fica `null` (não se inventa política).
 *
 * REALIDADE DOCUMENTADA (arquivo real BM_08): as 177 abas de memória
 * estão em CORTES HETEROGÊNEOS (MED-01, 02, 04, 05, 06, 07, 08) — não
 * há um "acumulado item a item no mês X" para X < junho/2026. Só o
 * BM nº 08 (junho) tem valor por item AUTORITATIVO (as 15 linhas
 * formais do boletim). O parser expõe o que existe; a reconciliação
 * classifica honestamente o que fecha e o que fica "sem base documental".
 */

const MONEY_SCALE = 2;
const QUANTITY_SCALE = 6;
const MONEY = MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero;
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

export type IdentityResolutionBasis = "operational_item_id" | "unresolved";

export interface ItemDocumentaryObservation {
  readonly itemCode: string;
  /** SEMPRE não-nulo: só abas que resolvem contra um dos itens oficiais entram no universo item a item. */
  readonly managedServiceItemId: string;
  readonly identityBasis: IdentityResolutionBasis;
  readonly groupCode: string | null;
  readonly sourceSheet: string;
  readonly layout: MemoriaSheetLayout;
  readonly measurementRef: number | null;
  readonly measurementPeriodLabel: string | null;
  readonly semanticField: DocumentaryFieldObservation["semanticField"];
  readonly scope: DocumentaryFieldObservation["scope"];
  readonly unit: string | null;
  /** QUANTIDADE DOCUMENTAL — o que a memória realmente traz. null = ausência, nunca 0. */
  readonly quantityDecimal: string | null;
  readonly unitPriceDecimal: string | null;
  /**
   * VALOR DERIVADO DE REFERÊNCIA = quantidade × preço unitário do
   * contrato, quantizado pela política monetária EXPLÍCITA fornecida.
   * NÃO é valor documental; NÃO é evidência de reconciliação financeira.
   * null quando falta quantidade, preço ou política comprovada.
   */
  readonly derivedReferenceValueDecimal: string | null;
  /** true só quando `derivedReferenceValueDecimal` foi calculado. */
  readonly derivedReferenceValueAvailable: boolean;
  /** Chave da política monetária usada no valor derivado (rastreabilidade). null quando não houve valor derivado. */
  readonly derivedReferenceMonetaryPolicyKey: string | null;
  readonly derivedFromCumulative: boolean;
  readonly isUnambiguous: boolean;
  readonly reasonIfAmbiguous: string | null;
  readonly sourceCells: ReadonlyArray<string>;
}

export interface BuildItemDocumentaryObservationsInput {
  readonly memorias: ReadonlyArray<ParsedMemoriaResumo>;
  /** APENAS os itens de serviço contratuais autoritativos (300 na Base Contratual da Lagoa). Grupos/subgrupos NUNCA entram. */
  readonly contractItems: ReadonlyArray<DocumentaryContractItem>;
  /**
   * Política monetária do VALOR DERIVADO DE REFERÊNCIA. Sem ela, o valor
   * derivado fica null (não se inventa política). Para BM08/Lagoa a
   * política documental comprovada é `source-document-truncation-to-cents`
   * (scale 2, truncate toward zero) — deve ser passada explicitamente.
   */
  readonly derivedReferenceMonetaryPolicy?: MeasurementMonetaryPolicy | null;
}

export interface ItemDocumentaryObservationsResult {
  readonly observations: ReadonlyArray<ItemDocumentaryObservation>;
  /** Códigos de aba de memória que NÃO resolvem contra nenhum dos itens oficiais — ficam FORA do universo item a item. */
  readonly memoriaCodesWithoutContractItem: ReadonlyArray<string>;
  /** Quantas das abas de memória correspondem a um dos itens oficiais. */
  readonly memoriasMatchingContractItems: number;
}

const PERIOD_RELEVANT_FIELDS = new Set<DocumentaryFieldObservation["semanticField"]>([
  "quantity_to_measure_in_period",
  "measured_accumulated_quantity_prior",
  "executed_accumulated_quantity",
  "monthly_series_quantity"
]);

export function buildItemDocumentaryObservations(
  input: BuildItemDocumentaryObservationsInput
): ItemDocumentaryObservationsResult {
  const itemByCode = new Map(input.contractItems.map((item) => [item.code, item]));
  const policy = input.derivedReferenceMonetaryPolicy ?? null;
  const observations: ItemDocumentaryObservation[] = [];
  const withoutItem: string[] = [];
  let matching = 0;

  for (const memoria of input.memorias) {
    const contractItem = itemByCode.get(memoria.itemCode) ?? null;
    if (contractItem === null) {
      // Aba de memória sem item oficial correspondente (código estrutural
      // de grupo/subgrupo, item renomeado, etc.). FORA do universo item a
      // item — nunca vira observação, nunca conta como item contratual.
      withoutItem.push(memoria.itemCode);
      continue;
    }
    matching += 1;

    for (const field of classifyMemoriaResumo(memoria)) {
      if (!PERIOD_RELEVANT_FIELDS.has(field.semanticField)) {
        continue;
      }

      const derivedReferenceValueDecimal =
        field.quantityDecimal !== null && contractItem.unitPriceDecimal !== null && policy !== null
          ? calculateMeasurementLineValue({
              quantity: field.quantityDecimal,
              unitValue: contractItem.unitPriceDecimal,
              policy
            })
          : null;

      observations.push({
        itemCode: memoria.itemCode,
        managedServiceItemId: contractItem.managedServiceItemId,
        identityBasis: "operational_item_id",
        groupCode: contractItem.groupCode,
        sourceSheet: memoria.sheetName,
        layout: memoria.layout,
        measurementRef: field.measurementRef,
        measurementPeriodLabel: field.measurementPeriodLabel,
        semanticField: field.semanticField,
        scope: field.scope,
        unit: field.unit,
        quantityDecimal: field.quantityDecimal,
        unitPriceDecimal: contractItem.unitPriceDecimal,
        derivedReferenceValueDecimal,
        derivedReferenceValueAvailable: derivedReferenceValueDecimal !== null,
        derivedReferenceMonetaryPolicyKey: derivedReferenceValueDecimal !== null ? policy?.key ?? null : null,
        derivedFromCumulative: field.derivedFromCumulative,
        isUnambiguous: field.isUnambiguous,
        reasonIfAmbiguous: field.reasonIfAmbiguous,
        sourceCells: field.sourceCells
      });
    }
  }

  return {
    observations,
    memoriaCodesWithoutContractItem: withoutItem,
    memoriasMatchingContractItems: matching
  };
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
  /** = quantidade de itens de serviço AUTORITATIVOS passados (300 na Lagoa). NUNCA linhas estruturais. */
  readonly totalContractItems: number;
  readonly totalMemoriasFound: number;
  /** Das memórias, quantas resolvem contra um dos itens oficiais (entram no universo item a item). */
  readonly memoriasMatchingContractItems: number;
  /** Códigos de aba de memória SEM item oficial correspondente (grupo/subgrupo, renomeado…). Ficam de fora. */
  readonly memoriaCodesWithoutContractItem: ReadonlyArray<string>;
  readonly layoutCounts: Readonly<Record<MemoriaSheetLayout, number>>;
  readonly itemsWithAtLeastOneUnambiguousPeriod: number;
  readonly totalItemPeriodObservations: number;
  readonly ambiguousObservations: number;
  readonly periodsCoveredByMeasurementRef: ReadonlyArray<number>;
  /** QUANTIDADE DOCUMENTAL: nº de observações de quantidade por MED de referência (unidades heterogêneas -> nunca somadas). */
  readonly documentaryQuantityObservationsByMeasurementRef: ReadonlyArray<{ readonly measurementRef: number | null; readonly observationCount: number }>;
  /**
   * VALOR DERIVADO DE REFERÊNCIA por MED (qtd × preço unitário, política
   * monetária explícita). NÃO é histórico financeiro autoritativo e NÃO
   * é usado em nenhuma reconciliação. Vazio quando nenhuma política foi
   * fornecida ao builder de observações.
   */
  readonly derivedReferenceValueByMeasurementRef: ReadonlyArray<{ readonly measurementRef: number | null; readonly derivedReferenceValueDecimal: string }>;
  readonly derivedReferenceMonetaryPolicyKey: string | null;
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
  /** APENAS os itens de serviço contratuais autoritativos (300 na Lagoa). */
  readonly contractItems: ReadonlyArray<DocumentaryContractItem>;
  readonly observations: ReadonlyArray<ItemDocumentaryObservation>;
  readonly reconciliation: DocumentaryReconciliation;
}

export function buildDocumentaryHistoryPreview(input: BuildDocumentaryHistoryPreviewInput): DocumentaryHistoryPreview {
  const contractCodes = new Set(input.contractItems.map((item) => item.code));
  // Universo item a item = SÓ as memórias que resolvem contra um dos itens oficiais.
  const officialMemorias = input.memorias.filter((memoria) => contractCodes.has(memoria.itemCode));
  const memoriaCodesWithoutContractItem = input.memorias
    .filter((memoria) => !contractCodes.has(memoria.itemCode))
    .map((memoria) => memoria.itemCode);

  const periodFieldObservations = input.observations.filter(
    (observation) =>
      observation.semanticField === "quantity_to_measure_in_period" ||
      observation.semanticField === "monthly_series_quantity"
  );

  const unambiguousPeriodItemCodes = new Set(
    periodFieldObservations
      .filter((observation) => observation.isUnambiguous && observation.quantityDecimal !== null)
      .map((observation) => observation.itemCode)
  );

  const ambiguousObservations = input.observations.filter((observation) => !observation.isUnambiguous).length;

  const refSet = new Set<number>();
  for (const memoria of officialMemorias) {
    if (memoria.measurementNumber !== null) refSet.add(memoria.measurementNumber);
  }
  const periodsCoveredByMeasurementRef = Array.from(refSet).sort((a, b) => a - b);

  // QUANTIDADE DOCUMENTAL: contagem de observações por MED (unidades
  // diferentes -> nunca somar quantidades).
  const qtyCountByRef = new Map<number | null, number>();
  // VALOR DERIVADO DE REFERÊNCIA: só quando o builder derivou (política explícita).
  const derivedByRef = new Map<number | null, string[]>();
  let derivedPolicyKey: string | null = null;
  for (const observation of periodFieldObservations) {
    if (observation.quantityDecimal !== null) {
      qtyCountByRef.set(observation.measurementRef, (qtyCountByRef.get(observation.measurementRef) ?? 0) + 1);
    }
    if (observation.derivedReferenceValueDecimal !== null) {
      const bucket = derivedByRef.get(observation.measurementRef) ?? [];
      bucket.push(observation.derivedReferenceValueDecimal);
      derivedByRef.set(observation.measurementRef, bucket);
      derivedPolicyKey = observation.derivedReferenceMonetaryPolicyKey;
    }
  }
  const documentaryQuantityObservationsByMeasurementRef = Array.from(qtyCountByRef.entries())
    .map(([measurementRef, observationCount]) => ({ measurementRef, observationCount }))
    .sort((a, b) => (a.measurementRef ?? -1) - (b.measurementRef ?? -1));
  const derivedReferenceValueByMeasurementRef = Array.from(derivedByRef.entries())
    .map(([measurementRef, values]) => ({
      measurementRef,
      derivedReferenceValueDecimal: addMeasurementDecimals(values, MONEY_SCALE)
    }))
    .sort((a, b) => (a.measurementRef ?? -1) - (b.measurementRef ?? -1));

  const divergences = input.reconciliation.byGroupPeriod.filter((row) => row.status === "divergent");
  const partialCoverage = input.reconciliation.byGroupPeriod.filter((row) => row.status === "partial_coverage");

  const itemsAboveContractQuantity = officialMemorias
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

  const executedNotProvenAsMeasured = officialMemorias
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

  // Sem histórico recuperável = itens oficiais SEM nenhuma observação de
  // período inequívoca (a base é sempre os 300, nunca as memórias).
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

  return {
    totalContractItems: input.contractItems.length,
    totalMemoriasFound: input.memorias.length,
    memoriasMatchingContractItems: officialMemorias.length,
    memoriaCodesWithoutContractItem,
    layoutCounts: input.layoutCounts,
    itemsWithAtLeastOneUnambiguousPeriod: unambiguousPeriodItemCodes.size,
    totalItemPeriodObservations: periodFieldObservations.length,
    ambiguousObservations,
    periodsCoveredByMeasurementRef,
    documentaryQuantityObservationsByMeasurementRef,
    derivedReferenceValueByMeasurementRef,
    derivedReferenceMonetaryPolicyKey: derivedPolicyKey,
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
