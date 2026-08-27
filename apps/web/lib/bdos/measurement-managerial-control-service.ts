/**
 * "Controle Gerencial da Execução" — posição item a item do CONTRATO
 * (Base Contratual da Obra), não de um boletim. Função pura, sem I/O.
 *
 * DUAS CAMADAS DE VERDADE (nunca confundidas):
 *   - Camada A (esta): contrato + período do BM atual + posição
 *     CERTIFICADA no BDOS + contexto do grupo. Tudo já persistido e
 *     autoritativo.
 *   - Camada B (futura): histórico documental item a item das memórias
 *     de cálculo (MED-01…MED-N). NÃO importado. Aqui só marcamos
 *     `documentaryHistoryImported: false` e NUNCA tratamos "acumulado
 *     registrado = 0" como "sem execução histórica".
 *
 * O único "acumulado" que esta camada calcula honestamente é a
 * POSIÇÃO REGISTRADA NO BDOS = certificado acumulado + medido no BM
 * atual. Sem certificações (caso atual), = medido no BM atual.
 *
 * Nunca inventa planejado do item, nunca rateia planejamento/ajuste do
 * grupo pelos itens, nunca aplica ao item um rótulo de adiantamento ou
 * atraso — o planejamento oficial é por grupo. Todo dinheiro em decimal
 * canônico (measurement-certification); nada de float. Percentuais por
 * bigint sobre a menor escala relevante.
 */

import {
  addMeasurementDecimals,
  calculateMeasurementLineValue,
  canonicalizeMeasurementDecimal,
  subtractMeasurementDecimals,
  MeasurementDecimalQuantizationMode
} from "@bba/bdos-core/domain/measurement-certification";
import { resolveGroupCode } from "./measurement-physical-financial-analysis-service";
import type { MeasurementPhysicalFinancialAnalysis, PhysicalFinancialSituation } from "./measurement-physical-financial-analysis-service";

const MONEY_SCALE = 2;
const QUANTITY_SCALE = 6;
const MONEY = MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero;

export type ManagerialItemStatus =
  | "no_bdos_measurement"
  | "in_execution_bdos"
  | "contract_quantity_reached"
  | "above_contract_quantity"
  | "insufficient_basis";

export interface ManagerialControlItemFlags {
  readonly measuredThisPeriod: boolean;
  readonly notMeasuredThisPeriod: boolean;
  readonly contractQuantityReached: boolean;
  readonly aboveContractQuantity: boolean;
  readonly contractBalanceZeroed: boolean;
  readonly noPhysicalFinancialGroup: boolean;
  readonly documentaryHistoryPending: boolean;
  readonly unitMismatchWithBulletin: boolean;
}

export interface ManagerialGroupContext {
  readonly groupCode: string;
  readonly groupName: string;
  readonly plannedAccumulatedValueDecimal: string;
  readonly actualAccumulatedValueDecimal: string;
  readonly deviationValueDecimal: string;
  readonly deviationPercentPoints: string | null;
  readonly situation: PhysicalFinancialSituation;
}

export interface ManagerialTraceability {
  readonly sheetName: string;
  readonly row: number;
  readonly columns: ReadonlyArray<string>;
  readonly bulletinNumber: number | null;
  readonly periodLabel: string | null;
}

export interface ManagerialControlItem {
  readonly id: string;
  readonly code: string;
  readonly description: string;
  readonly unit: string | null;
  readonly groupCode: string | null;
  readonly groupName: string | null;

  readonly contractQuantityDecimal: string;
  readonly unitPriceDecimal: string;
  readonly contractedValueDecimal: string;

  readonly periodQuantityDecimal: string | null;
  readonly periodValueDecimal: string | null;

  readonly certifiedAccumulatedQuantityDecimal: string;
  readonly certifiedAccumulatedValueDecimal: string;

  /** = certificado acumulado + medido no BM atual. O único acumulado honesto desta camada. */
  readonly bdosRegisteredQuantityDecimal: string;
  readonly bdosRegisteredValueDecimal: string;

  readonly quantityBalanceDecimal: string;
  readonly financialBalanceDecimal: string;
  /** quantidade registrada ÷ quantidade contratada × 100. Pode superar 100. null quando base insuficiente. */
  readonly executedPercent: string | null;

  readonly documentaryHistoryImported: boolean;
  readonly status: ManagerialItemStatus;
  readonly flags: ManagerialControlItemFlags;
  readonly groupContext: ManagerialGroupContext | null;
  readonly traceability: ManagerialTraceability | null;
}

export interface ManagerialControlSummary {
  readonly totalItems: number;
  readonly itemsWithBdosMeasurement: number;
  readonly itemsWithoutBdosMeasurement: number;
  readonly itemsMeasuredThisPeriod: number;
  readonly itemsContractQuantityReached: number;
  readonly itemsAboveContractQuantity: number;
  readonly itemsInsufficientBasis: number;

  readonly contractedValueTotalDecimal: string;
  readonly contractOfficialValueDecimal: string | null;
  /** soma dos itens − valor de contrato oficial. Exibido à parte, NUNCA rateado. */
  readonly contractAdjustmentDecimal: string | null;

  readonly bdosRegisteredValueTotalDecimal: string;
  readonly contractBalanceTotalDecimal: string;
  /** valor registrado no BDOS ÷ valor contratual × 100 -- SOMENTE o que o BDOS registrou (BM atual + certificado). NÃO é o % financeiro acumulado da obra. */
  readonly bdosRegisteredFinancialPercent: string | null;

  /** Referência do cronograma físico-financeiro consolidado (Curva S) -- posição REAL da obra, para contraste com o registrado no BDOS. null quando não há físico-financeiro. */
  readonly obraReference: {
    readonly actualAccumulatedValueDecimal: string;
    readonly actualAccumulatedPercent: string | null;
    readonly plannedAccumulatedValueDecimal: string;
  } | null;

  readonly documentaryHistoryImported: boolean;
  readonly certificationRegistered: boolean;

  readonly currentBulletinNumber: number | null;
  readonly currentPeriodLabel: string | null;
  readonly currentBulletinTotalValueDecimal: string | null;
  /** soma das linhas do BM atual reconciliada com o total do boletim. */
  readonly currentBulletinLinesSumDecimal: string | null;
}

export interface ManagerialRankedItem {
  readonly code: string;
  readonly description: string;
  readonly groupCode: string | null;
  readonly valueDecimal: string;
}

export interface ManagerialControlAnalyses {
  readonly topByRegisteredValue: ReadonlyArray<ManagerialRankedItem>;
  readonly topByContractBalance: ReadonlyArray<ManagerialRankedItem>;
  readonly itemsAboveContractQuantity: ReadonlyArray<{ readonly code: string; readonly description: string; readonly executedPercent: string | null }>;
  readonly itemsAtFullContractQuantity: ReadonlyArray<{ readonly code: string; readonly description: string }>;
  readonly itemsMeasuredThisPeriod: ReadonlyArray<{ readonly code: string; readonly description: string; readonly periodValueDecimal: string }>;
  readonly itemsWithoutMeasurementCount: number;
  readonly valueConcentration: {
    readonly topCount: number;
    readonly topValueDecimal: string;
    readonly totalValueDecimal: string;
    readonly sharePercent: string | null;
  } | null;
}

export interface ManagerialControlView {
  readonly available: boolean;
  readonly unavailableReason: string | null;
  readonly items: ReadonlyArray<ManagerialControlItem>;
  readonly summary: ManagerialControlSummary;
  readonly analyses: ManagerialControlAnalyses;
}

// -------------------------------------------------------------------

export interface ManagerialControlContractItemInput {
  readonly id: string;
  readonly code: string;
  readonly description: string;
  readonly unit: string | null;
  readonly contractQuantityDecimal: string;
  readonly unitPriceDecimal: string;
  readonly measurementType: string;
}

export interface ManagerialControlCertifiedBalanceInput {
  readonly managedServiceItemId: string;
  readonly contractedValueDecimal: string | null;
  readonly certifiedAccumulatedQuantityDecimal: string;
  readonly certifiedAccumulatedValueDecimal: string;
}

export interface ManagerialControlBulletinLineInput {
  readonly managedServiceItemId: string | null;
  readonly code: string;
  readonly unit: string | null;
  readonly quantityDecimal: string;
  readonly valueDecimal: string;
  readonly sheetName: string | null;
  readonly row: number | null;
  readonly columns: ReadonlyArray<string>;
}

export interface ManagerialControlBulletinInput {
  readonly bulletinNumber: number | null;
  readonly periodLabel: string | null;
  readonly totalValueDecimal: string | null;
  readonly lines: ReadonlyArray<ManagerialControlBulletinLineInput>;
}

export interface BuildManagerialControlViewInput {
  readonly contractItems: ReadonlyArray<ManagerialControlContractItemInput>;
  readonly certifiedBalances: ReadonlyArray<ManagerialControlCertifiedBalanceInput>;
  readonly currentBulletin: ManagerialControlBulletinInput | null;
  readonly physicalFinancial: MeasurementPhysicalFinancialAnalysis | null;
  readonly certificationRegistered: boolean;
  /** valor de contrato oficial (Curva S) -- para o ajuste/reconciliação. null quando não há físico-financeiro consolidado. */
  readonly contractOfficialValueDecimal: string | null;
}

const TOP_N = 5;

export function buildManagerialControlView(input: BuildManagerialControlViewInput): ManagerialControlView {
  if (input.contractItems.length === 0) {
    return {
      available: false,
      unavailableReason: "Ainda não há base contratual de itens importada para esta obra.",
      items: [],
      summary: emptySummary(input),
      analyses: emptyAnalyses()
    };
  }

  const balanceByItemId = new Map(input.certifiedBalances.map((b) => [b.managedServiceItemId, b]));
  const bulletinLineByItemId = new Map<string, ManagerialControlBulletinLineInput>();
  for (const line of input.currentBulletin?.lines ?? []) {
    if (line.managedServiceItemId) {
      bulletinLineByItemId.set(line.managedServiceItemId, line);
    }
  }
  const groupByCode = new Map((input.physicalFinancial?.groups ?? []).map((g) => [g.groupCode, g]));

  const items = input.contractItems
    .map((item) => buildItem(item, balanceByItemId.get(item.id) ?? null, bulletinLineByItemId.get(item.id) ?? null, groupByCode, input.currentBulletin))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const summary = buildSummary(items, input);
  const analyses = buildAnalyses(items);

  return { available: true, unavailableReason: null, items, summary, analyses };
}

function buildItem(
  item: ManagerialControlContractItemInput,
  balance: ManagerialControlCertifiedBalanceInput | null,
  bulletinLine: ManagerialControlBulletinLineInput | null,
  groupByCode: ReadonlyMap<string, MeasurementPhysicalFinancialAnalysis["groups"][number]>,
  currentBulletin: ManagerialControlBulletinInput | null
): ManagerialControlItem {
  const contractQuantityDecimal = canonQty(item.contractQuantityDecimal);
  const unitPriceDecimal = canonMoney(item.unitPriceDecimal);
  // §7: total contratual autoritativo persistido, quando presente; senão qty × preço.
  const contractedValueDecimal =
    balance?.contractedValueDecimal != null
      ? canonMoney(balance.contractedValueDecimal)
      : calculateMeasurementLineValue({ quantity: item.contractQuantityDecimal, unitValue: item.unitPriceDecimal, policy: { key: "BRL", scale: MONEY_SCALE, quantizationMode: MONEY } });

  const periodQuantityDecimal = bulletinLine ? canonQty(bulletinLine.quantityDecimal) : null;
  const periodValueDecimal = bulletinLine ? canonMoney(bulletinLine.valueDecimal) : null;
  const measuredThisPeriod = bulletinLine !== null && !isZero(periodValueDecimal ?? "0", MONEY_SCALE);

  const certifiedAccumulatedQuantityDecimal = canonQty(balance?.certifiedAccumulatedQuantityDecimal ?? "0");
  const certifiedAccumulatedValueDecimal = canonMoney(balance?.certifiedAccumulatedValueDecimal ?? "0");

  const bdosRegisteredQuantityDecimal = addMeasurementDecimals([certifiedAccumulatedQuantityDecimal, periodQuantityDecimal ?? "0"], QUANTITY_SCALE);
  const bdosRegisteredValueDecimal = addMeasurementDecimals([certifiedAccumulatedValueDecimal, periodValueDecimal ?? "0"], MONEY_SCALE);

  const quantityBalanceDecimal = subtractMeasurementDecimals(contractQuantityDecimal, bdosRegisteredQuantityDecimal, QUANTITY_SCALE);
  const financialBalanceDecimal = subtractMeasurementDecimals(contractedValueDecimal, bdosRegisteredValueDecimal, MONEY_SCALE);

  const hasContractQuantity = !isZero(contractQuantityDecimal, QUANTITY_SCALE);
  const isQuantityType = item.measurementType === "quantity";
  const unitMismatchWithBulletin =
    bulletinLine?.unit != null && item.unit != null && normalizeUnit(bulletinLine.unit) !== normalizeUnit(item.unit);

  const executedPercent = hasContractQuantity && isQuantityType ? ratioPercent(bdosRegisteredQuantityDecimal, contractQuantityDecimal) : null;

  const qtyCmp = compareDecimals(bdosRegisteredQuantityDecimal, contractQuantityDecimal);
  const status: ManagerialItemStatus = !hasContractQuantity || !isQuantityType
    ? "insufficient_basis"
    : isZero(bdosRegisteredQuantityDecimal, QUANTITY_SCALE)
      ? "no_bdos_measurement"
      : qtyCmp > 0
        ? "above_contract_quantity"
        : qtyCmp === 0
          ? "contract_quantity_reached"
          : "in_execution_bdos";

  const groupCode = resolveGroupCode(item.code);
  const group = groupCode !== null ? groupByCode.get(groupCode) : undefined;
  const groupContext: ManagerialGroupContext | null = group
    ? {
        groupCode: group.groupCode,
        groupName: group.groupName,
        plannedAccumulatedValueDecimal: group.plannedAccumulatedValueDecimal,
        actualAccumulatedValueDecimal: group.actualAccumulatedValueDecimal,
        deviationValueDecimal: group.deviationValueDecimal,
        deviationPercentPoints: group.deviationPercentPoints,
        situation: group.situation
      }
    : null;

  const traceability: ManagerialTraceability | null =
    bulletinLine && bulletinLine.sheetName != null && bulletinLine.row != null
      ? {
          sheetName: bulletinLine.sheetName,
          row: bulletinLine.row,
          columns: bulletinLine.columns,
          bulletinNumber: currentBulletin?.bulletinNumber ?? null,
          periodLabel: currentBulletin?.periodLabel ?? null
        }
      : null;

  return {
    id: item.id,
    code: item.code,
    description: item.description,
    unit: item.unit,
    groupCode,
    groupName: groupContext?.groupName ?? null,
    contractQuantityDecimal,
    unitPriceDecimal,
    contractedValueDecimal,
    periodQuantityDecimal,
    periodValueDecimal,
    certifiedAccumulatedQuantityDecimal,
    certifiedAccumulatedValueDecimal,
    bdosRegisteredQuantityDecimal,
    bdosRegisteredValueDecimal,
    quantityBalanceDecimal,
    financialBalanceDecimal,
    executedPercent,
    documentaryHistoryImported: false,
    status,
    flags: {
      measuredThisPeriod,
      notMeasuredThisPeriod: !measuredThisPeriod,
      contractQuantityReached: status === "contract_quantity_reached",
      aboveContractQuantity: status === "above_contract_quantity",
      contractBalanceZeroed: isZero(financialBalanceDecimal, MONEY_SCALE) || financialBalanceDecimal.startsWith("-"),
      noPhysicalFinancialGroup: groupContext === null,
      documentaryHistoryPending: true,
      unitMismatchWithBulletin
    },
    groupContext,
    traceability
  };
}

function buildSummary(items: ReadonlyArray<ManagerialControlItem>, input: BuildManagerialControlViewInput): ManagerialControlSummary {
  const contractedValueTotalDecimal = addMeasurementDecimals(items.map((i) => i.contractedValueDecimal), MONEY_SCALE);
  const bdosRegisteredValueTotalDecimal = addMeasurementDecimals(items.map((i) => i.bdosRegisteredValueDecimal), MONEY_SCALE);
  const contractBalanceTotalDecimal = subtractMeasurementDecimals(contractedValueTotalDecimal, bdosRegisteredValueTotalDecimal, MONEY_SCALE);

  const contractOfficialValueDecimal = input.contractOfficialValueDecimal != null ? canonMoney(input.contractOfficialValueDecimal) : null;
  const contractAdjustmentDecimal =
    contractOfficialValueDecimal != null ? subtractMeasurementDecimals(contractedValueTotalDecimal, contractOfficialValueDecimal, MONEY_SCALE) : null;

  const bdosRegisteredFinancialPercent = isZero(contractedValueTotalDecimal, MONEY_SCALE)
    ? null
    : ratioPercent(bdosRegisteredValueTotalDecimal, contractedValueTotalDecimal);

  const obra = input.physicalFinancial?.obra ?? null;
  const obraReference = obra
    ? {
        actualAccumulatedValueDecimal: obra.actualAccumulatedValueDecimal,
        actualAccumulatedPercent: obra.actualAccumulatedPercent,
        plannedAccumulatedValueDecimal: obra.plannedAccumulatedValueDecimal
      }
    : null;

  const currentBulletinLinesSumDecimal = input.currentBulletin
    ? addMeasurementDecimals(input.currentBulletin.lines.map((l) => l.valueDecimal), MONEY_SCALE)
    : null;

  return {
    totalItems: items.length,
    itemsWithBdosMeasurement: items.filter((i) => !isZero(i.bdosRegisteredQuantityDecimal, QUANTITY_SCALE) && i.status !== "insufficient_basis").length,
    itemsWithoutBdosMeasurement: items.filter((i) => i.status === "no_bdos_measurement").length,
    itemsMeasuredThisPeriod: items.filter((i) => i.flags.measuredThisPeriod).length,
    itemsContractQuantityReached: items.filter((i) => i.status === "contract_quantity_reached").length,
    itemsAboveContractQuantity: items.filter((i) => i.status === "above_contract_quantity").length,
    itemsInsufficientBasis: items.filter((i) => i.status === "insufficient_basis").length,
    contractedValueTotalDecimal,
    contractOfficialValueDecimal,
    contractAdjustmentDecimal,
    bdosRegisteredValueTotalDecimal,
    contractBalanceTotalDecimal,
    bdosRegisteredFinancialPercent,
    obraReference,
    documentaryHistoryImported: false,
    certificationRegistered: input.certificationRegistered,
    currentBulletinNumber: input.currentBulletin?.bulletinNumber ?? null,
    currentPeriodLabel: input.currentBulletin?.periodLabel ?? null,
    currentBulletinTotalValueDecimal: input.currentBulletin?.totalValueDecimal ?? null,
    currentBulletinLinesSumDecimal
  };
}

function buildAnalyses(items: ReadonlyArray<ManagerialControlItem>): ManagerialControlAnalyses {
  const withValue = items.filter((i) => !isZero(i.bdosRegisteredValueDecimal, MONEY_SCALE));
  const topByRegisteredValue = [...withValue]
    .sort((a, b) => -compareDecimals(a.bdosRegisteredValueDecimal, b.bdosRegisteredValueDecimal))
    .slice(0, TOP_N)
    .map((i) => ({ code: i.code, description: i.description, groupCode: i.groupCode, valueDecimal: i.bdosRegisteredValueDecimal }));

  const topByContractBalance = [...items]
    .sort((a, b) => -compareDecimals(a.financialBalanceDecimal, b.financialBalanceDecimal))
    .slice(0, TOP_N)
    .map((i) => ({ code: i.code, description: i.description, groupCode: i.groupCode, valueDecimal: i.financialBalanceDecimal }));

  const totalRegisteredValueDecimal = addMeasurementDecimals(items.map((i) => i.bdosRegisteredValueDecimal), MONEY_SCALE);
  const topValueDecimal = addMeasurementDecimals(topByRegisteredValue.map((i) => i.valueDecimal), MONEY_SCALE);
  const valueConcentration = isZero(totalRegisteredValueDecimal, MONEY_SCALE)
    ? null
    : {
        topCount: topByRegisteredValue.length,
        topValueDecimal,
        totalValueDecimal: totalRegisteredValueDecimal,
        sharePercent: ratioPercent(topValueDecimal, totalRegisteredValueDecimal)
      };

  return {
    topByRegisteredValue,
    topByContractBalance,
    itemsAboveContractQuantity: items
      .filter((i) => i.status === "above_contract_quantity")
      .map((i) => ({ code: i.code, description: i.description, executedPercent: i.executedPercent })),
    itemsAtFullContractQuantity: items
      .filter((i) => i.status === "contract_quantity_reached")
      .map((i) => ({ code: i.code, description: i.description })),
    itemsMeasuredThisPeriod: items
      .filter((i) => i.flags.measuredThisPeriod)
      .map((i) => ({ code: i.code, description: i.description, periodValueDecimal: i.periodValueDecimal ?? "0.00" })),
    itemsWithoutMeasurementCount: items.filter((i) => i.status === "no_bdos_measurement").length,
    valueConcentration
  };
}

// ---- helpers ----

function canonMoney(decimal: string): string {
  return canonicalizeMeasurementDecimal(decimal, MONEY_SCALE, MONEY);
}
function canonQty(decimal: string): string {
  return canonicalizeMeasurementDecimal(decimal, QUANTITY_SCALE, MONEY);
}
function normalizeUnit(unit: string): string {
  return unit.trim().toUpperCase().replace(/\s+/g, "").replace(/[.]/g, "").replace(/²/g, "2").replace(/³/g, "3");
}

function toCents(decimal: string, scale: number): bigint {
  const negative = decimal.startsWith("-");
  const unsigned = negative ? decimal.slice(1) : decimal;
  const [int, frac = ""] = unsigned.split(".");
  const padded = (frac + "0".repeat(scale)).slice(0, scale);
  const value = BigInt(int || "0") * 10n ** BigInt(scale) + BigInt(padded || "0");
  return negative ? -value : value;
}
function isZero(decimal: string, scale: number): boolean {
  return toCents(decimal, scale) === 0n;
}
function compareDecimals(a: string, b: string): number {
  const scale = 8;
  const diff = toCents(a, scale) - toCents(b, scale);
  return diff > 0n ? 1 : diff < 0n ? -1 : 0;
}
/** |num| ÷ |den| × 100, duas casas, bigint (sem float). Pode superar 100. null se den = 0. */
function ratioPercent(numeratorDecimal: string, denominatorDecimal: string): string | null {
  const scale = 8;
  const den = absBig(toCents(denominatorDecimal, scale));
  if (den === 0n) return null;
  const num = absBig(toCents(numeratorDecimal, scale));
  const sign = numeratorDecimal.startsWith("-") ? -1n : 1n;
  const basisPoints = (num * 10_000n + den / 2n) / den;
  const whole = basisPoints / 100n;
  const frac = (basisPoints % 100n).toString().padStart(2, "0");
  return `${sign < 0n && basisPoints !== 0n ? "-" : ""}${whole.toString()}.${frac}`;
}
function absBig(v: bigint): bigint {
  return v < 0n ? -v : v;
}

function emptySummary(input: BuildManagerialControlViewInput): ManagerialControlSummary {
  return {
    totalItems: 0,
    itemsWithBdosMeasurement: 0,
    itemsWithoutBdosMeasurement: 0,
    itemsMeasuredThisPeriod: 0,
    itemsContractQuantityReached: 0,
    itemsAboveContractQuantity: 0,
    itemsInsufficientBasis: 0,
    contractedValueTotalDecimal: "0.00",
    contractOfficialValueDecimal: input.contractOfficialValueDecimal,
    contractAdjustmentDecimal: null,
    bdosRegisteredValueTotalDecimal: "0.00",
    contractBalanceTotalDecimal: "0.00",
    bdosRegisteredFinancialPercent: null,
    obraReference: null,
    documentaryHistoryImported: false,
    certificationRegistered: input.certificationRegistered,
    currentBulletinNumber: input.currentBulletin?.bulletinNumber ?? null,
    currentPeriodLabel: input.currentBulletin?.periodLabel ?? null,
    currentBulletinTotalValueDecimal: input.currentBulletin?.totalValueDecimal ?? null,
    currentBulletinLinesSumDecimal: null
  };
}
function emptyAnalyses(): ManagerialControlAnalyses {
  return {
    topByRegisteredValue: [],
    topByContractBalance: [],
    itemsAboveContractQuantity: [],
    itemsAtFullContractQuantity: [],
    itemsMeasuredThisPeriod: [],
    itemsWithoutMeasurementCount: 0,
    valueConcentration: null
  };
}
