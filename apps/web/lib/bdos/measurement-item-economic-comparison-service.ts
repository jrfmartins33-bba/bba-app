/**
 * "Revisar medição" — evolução econômica (Orçamento Oficial × Proposta
 * Vencedora) por item medido. Função pura, sem I/O: recebe um
 * `BudgetVersionComparison` já calculado (via
 * `getBudgetComparisonService`, `@bba/bdos-core/services/procurement-engineering`
 * -- o mesmo motor já usado e testado por /orcamentos) e a lista de
 * itens medidos (código + quantidade), e liga os dois por código,
 * linha a linha, sem desconto uniforme e sem inventar limiar de
 * "variação relevante" (0 é a única fronteira determinística possível
 * sem hardcode).
 *
 * Nunca recalcula preço oficial/contratado -- unitPrice.officialCents/
 * winnerCents já vêm exatos de compareBudgetVersions. Este módulo só
 * (a) localiza o item comparado pelo código do item medido e (b)
 * multiplica quantidade × preço com aritmética decimal exata
 * (measurement-certification, mesma convenção já usada pela prévia de
 * certificação), nunca ponto flutuante.
 */

import type { BudgetComparedItem, BudgetVersionComparison } from "@bba/bdos-core/services/procurement-engineering";
import {
  addMeasurementDecimals,
  calculateMeasurementLineValue,
  subtractMeasurementDecimals,
  MeasurementDecimalQuantizationMode
} from "@bba/bdos-core/domain/measurement-certification";

const MONEY_SCALE = 2;
const MONEY_POLICY = { key: "BRL", scale: MONEY_SCALE, quantizationMode: MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero };

export type MeasurementItemEconomicInterpretation = "economy" | "above_official" | "no_relevant_variation";

export interface MeasurementItemEconomicComparison {
  readonly officialUnitPriceDecimal: string;
  readonly contractedUnitPriceDecimal: string;
  readonly unitPriceDifferenceDecimal: string;
  /** Percentual com sinal, duas casas -- "12.34" (positivo = economia). */
  readonly unitPriceDifferencePercentage: string | null;
  readonly interpretation: MeasurementItemEconomicInterpretation;
}

export interface MeasurementEconomicComparisonSummary {
  readonly matchedItemCount: number;
  readonly totalItemCount: number;
  readonly measuredValueAtOfficialPricesDecimal: string;
  readonly measuredValueAtContractedPricesDecimal: string;
  /** officialPrices - contractedPrices; positivo = economia nesta medição. */
  readonly economyDecimal: string;
}

export interface MeasurementEconomicComparisonResult {
  readonly byItemCode: ReadonlyMap<string, MeasurementItemEconomicComparison>;
  /** null quando nenhum item teve correspondência confiável -- nunca um resumo com zeros artificiais. */
  readonly summary: MeasurementEconomicComparisonSummary | null;
}

export function buildMeasurementItemEconomicComparisons(
  items: ReadonlyArray<{ readonly code: string; readonly quantityDecimal: string }>,
  comparison: BudgetVersionComparison | null
): MeasurementEconomicComparisonResult {
  if (comparison === null) {
    return { byItemCode: new Map(), summary: null };
  }

  const matchByCode = indexComparedItemsByCode(comparison.items);
  const byItemCode = new Map<string, MeasurementItemEconomicComparison>();
  const officialValues: string[] = [];
  const contractedValues: string[] = [];

  for (const item of items) {
    const normalizedCode = normalizeCode(item.code);
    if (normalizedCode === null) continue;

    const matched = matchByCode.get(normalizedCode);
    if (!matched) continue;
    if (matched.unitPrice.officialCents === null || matched.unitPrice.winnerCents === null || matched.unitPrice.differenceCents === null) continue;

    const officialUnitPriceDecimal = centsToDecimalString(matched.unitPrice.officialCents);
    const contractedUnitPriceDecimal = centsToDecimalString(matched.unitPrice.winnerCents);
    const unitPriceDifferenceDecimal = subtractMeasurementDecimals(officialUnitPriceDecimal, contractedUnitPriceDecimal, MONEY_SCALE);

    const interpretation: MeasurementItemEconomicInterpretation =
      matched.unitPrice.differenceCents === 0 ? "no_relevant_variation" : matched.unitPrice.differenceCents > 0 ? "economy" : "above_official";

    byItemCode.set(normalizedCode, {
      officialUnitPriceDecimal,
      contractedUnitPriceDecimal,
      unitPriceDifferenceDecimal,
      unitPriceDifferencePercentage: formatBasisPoints(matched.unitPrice.percentageBasisPoints),
      interpretation
    });

    officialValues.push(calculateMeasurementLineValue({ quantity: item.quantityDecimal, unitValue: officialUnitPriceDecimal, policy: MONEY_POLICY }));
    contractedValues.push(calculateMeasurementLineValue({ quantity: item.quantityDecimal, unitValue: contractedUnitPriceDecimal, policy: MONEY_POLICY }));
  }

  if (byItemCode.size === 0) {
    return { byItemCode, summary: null };
  }

  const measuredValueAtOfficialPricesDecimal = addMeasurementDecimals(officialValues, MONEY_SCALE);
  const measuredValueAtContractedPricesDecimal = addMeasurementDecimals(contractedValues, MONEY_SCALE);

  return {
    byItemCode,
    summary: {
      matchedItemCount: byItemCode.size,
      totalItemCount: items.length,
      measuredValueAtOfficialPricesDecimal,
      measuredValueAtContractedPricesDecimal,
      economyDecimal: subtractMeasurementDecimals(measuredValueAtOfficialPricesDecimal, measuredValueAtContractedPricesDecimal, MONEY_SCALE)
    }
  };
}

// Indexa por proposalCode E officialCode (o item medido pode ter sido
// transcrito de qualquer um dos dois documentos) -- um código que
// aponta para mais de um BudgetComparedItem distinto é descartado
// (null), nunca escolhido arbitrariamente.
function indexComparedItemsByCode(comparedItems: ReadonlyArray<BudgetComparedItem>): ReadonlyMap<string, BudgetComparedItem> {
  const index = new Map<string, BudgetComparedItem | null>();
  for (const item of comparedItems) {
    for (const rawCode of [item.proposalCode, item.officialCode]) {
      const code = normalizeCode(rawCode);
      if (code === null) continue;
      const existing = index.get(code);
      if (existing === undefined) {
        index.set(code, item);
      } else if (existing !== null && existing.proposalLineId !== item.proposalLineId) {
        index.set(code, null);
      }
    }
  }
  const result = new Map<string, BudgetComparedItem>();
  for (const [code, item] of index) {
    if (item !== null) result.set(code, item);
  }
  return result;
}

/** Exportado para o route-handler indexar `byItemCode` com a mesma normalização usada aqui dentro. */
export function normalizeMeasurementItemCode(code: string | null | undefined): string | null {
  return normalizeCode(code);
}

function normalizeCode(code: string | null | undefined): string | null {
  if (typeof code !== "string") return null;
  const trimmed = code.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : null;
}

function formatBasisPoints(basisPoints: number | null): string | null {
  if (basisPoints === null) return null;
  const negative = basisPoints < 0;
  const abs = Math.trunc(Math.abs(basisPoints));
  const whole = Math.trunc(abs / 100);
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function centsToDecimalString(cents: number): string {
  const negative = cents < 0;
  const abs = Math.trunc(Math.abs(cents));
  const whole = Math.trunc(abs / 100);
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${negative && abs !== 0 ? "-" : ""}${whole}.${fraction}`;
}
