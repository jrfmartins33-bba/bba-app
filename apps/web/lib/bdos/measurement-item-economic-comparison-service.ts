/**
 * "Revisar medição" — referência econômica (Orçamento Oficial ×
 * Proposta Vencedora) por item medido. Função pura, sem I/O: recebe
 * um `BudgetVersionComparison` já calculado (via
 * `getBudgetComparisonService`, `@bba/bdos-core/services/procurement-engineering`
 * -- o mesmo motor já usado e testado por /orcamentos) e liga cada
 * item medido ao `BudgetComparedItem` correspondente, preferindo a
 * identidade persistida (contract_execution_item_links) ao código de
 * texto (ver `resolveMatchedItem` para a causa raiz e a correção).
 *
 * CORREÇÃO SEMÂNTICA (pós-Preview): esta comparação é
 * DESÁGIO/REDUÇÃO NA CONTRATAÇÃO -- quanto o preço contratado está
 * abaixo (ou acima) do orçamento de referência para vencer a
 * licitação -- nunca "economia"/"ganho"/"margem"/"lucro". Esses
 * termos description só fariam sentido comparando a Proposta
 * Vencedora contra o CUSTO REAL de execução, que o BDOS ainda não
 * integra por item/período (confirmado nesta rodada: cost_centers é
 * só uma categorização organizacional, sem valor realizado; nenhuma
 * outra tabela de custo real existe). Por isso o tipo/rótulo interno
 * também mudou de economy/above_official para contract_discount/
 * contract_premium.
 *
 * Nunca recalcula preço oficial/contratado -- unitPrice.officialCents/
 * winnerCents já vêm exatos de compareBudgetVersions. Este módulo só
 * (a) localiza o BudgetComparedItem do item medido e (b) multiplica
 * quantidade × preço/diferença com aritmética decimal exata
 * (measurement-certification, mesma convenção já usada pela prévia de
 * certificação), nunca ponto flutuante.
 *
 * METODOLOGIA DO TOTAL (correção da inconsistência de R$0,01): o
 * impacto agregado é a SOMA dos impactos monetários canônicos de cada
 * linha (quantidade × diferença de preço unitário, arredondado uma
 * única vez por linha) -- nunca a diferença entre dois totais somados
 * separadamente (que arredondaria duas vezes por linha e pode
 * divergir por centavos do valor real linha a linha).
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

/** contract_discount: contratado abaixo do oficial (deságio). contract_premium: contratado acima do oficial. no_variation: preços idênticos. Nunca um rótulo de resultado de execução -- essa comparação não mede isso. */
export type MeasurementItemEconomicInterpretation = "contract_discount" | "contract_premium" | "no_variation";

export interface MeasurementItemEconomicComparison {
  readonly officialUnitPriceDecimal: string;
  readonly contractedUnitPriceDecimal: string;
  /** oficial - contratado (positivo = deságio/redução na contratação). */
  readonly unitPriceDifferenceDecimal: string;
  /** Percentual com sinal, duas casas -- "22.40" (positivo = deságio). */
  readonly unitPriceDifferencePercentage: string | null;
  readonly interpretation: MeasurementItemEconomicInterpretation;
  /** Impacto monetário canônico desta linha: quantidade medida × diferença de preço unitário, arredondado uma única vez -- é a unidade atômica que soma para o impacto agregado (nunca a diferença entre dois totais). */
  readonly lineImpactDecimal: string;
  /** Participação deste item no impacto agregado do deságio -- "59.74" (%). null quando o impacto agregado é zero. */
  readonly participationPercentage: string | null;
}

export interface MeasurementEconomicComparisonSummary {
  readonly matchedItemCount: number;
  readonly totalItemCount: number;
  readonly measuredValueAtOfficialPricesDecimal: string;
  readonly measuredValueAtContractedPricesDecimal: string;
  /** Soma dos lineImpactDecimal de cada item correspondido -- "impacto do deságio contratual nesta medição", nunca economia/ganho operacional. */
  readonly contractDiscountImpactDecimal: string;
}

export interface MeasurementEconomicComparisonResult {
  /** Chave: o id da própria linha medida (item.id) -- nunca o código, que não é garantidamente único. */
  readonly byItemId: ReadonlyMap<string, MeasurementItemEconomicComparison>;
  /** null quando nenhum item teve correspondência confiável -- nunca um resumo com zeros artificiais. */
  readonly summary: MeasurementEconomicComparisonSummary | null;
}

export interface MeasurementEconomicComparisonItemInput {
  readonly id: string;
  readonly code: string;
  readonly quantityDecimal: string;
  /** managed_service_items.id -- usado para consultar contract_execution_item_links; null quando o boletim não carrega essa identidade. */
  readonly managedServiceItemId: string | null;
}

export function buildMeasurementItemEconomicComparisons(
  items: ReadonlyArray<MeasurementEconomicComparisonItemInput>,
  comparison: BudgetVersionComparison | null,
  /** managed_service_item_id -> proposal_budget_line_id, de contract_execution_item_links -- identidade persistida, sempre preferida ao código de texto. */
  executionItemLinks: ReadonlyMap<string, string>
): MeasurementEconomicComparisonResult {
  if (comparison === null) {
    return { byItemId: new Map(), summary: null };
  }

  const byProposalLineId = new Map(comparison.items.map((item) => [item.proposalLineId, item] as const));
  const byCode = indexComparedItemsByCode(comparison.items);

  interface RawMatch {
    readonly itemId: string;
    readonly officialUnitPriceDecimal: string;
    readonly contractedUnitPriceDecimal: string;
    readonly unitPriceDifferenceDecimal: string;
    readonly unitPriceDifferencePercentage: string | null;
    readonly interpretation: MeasurementItemEconomicInterpretation;
    readonly lineImpactDecimal: string;
  }

  const rawMatches: RawMatch[] = [];

  for (const item of items) {
    const matched = resolveMatchedItem(item, executionItemLinks, byProposalLineId, byCode);
    if (!matched) continue;
    if (matched.unitPrice.officialCents === null || matched.unitPrice.winnerCents === null || matched.unitPrice.differenceCents === null) continue;

    const officialUnitPriceDecimal = centsToDecimalString(matched.unitPrice.officialCents);
    const contractedUnitPriceDecimal = centsToDecimalString(matched.unitPrice.winnerCents);
    const unitPriceDifferenceDecimal = subtractMeasurementDecimals(officialUnitPriceDecimal, contractedUnitPriceDecimal, MONEY_SCALE);

    const interpretation: MeasurementItemEconomicInterpretation =
      matched.unitPrice.differenceCents === 0 ? "no_variation" : matched.unitPrice.differenceCents > 0 ? "contract_discount" : "contract_premium";

    // Impacto canônico da linha: quantidade × diferença de preço
    // unitário, arredondado UMA vez -- nunca (quantidade×oficial)
    // arredondado menos (quantidade×contratado) arredondado, que
    // acumula duas rodadas de arredondamento por linha.
    const lineImpactDecimal = calculateMeasurementLineValue({
      quantity: item.quantityDecimal,
      unitValue: unitPriceDifferenceDecimal,
      policy: MONEY_POLICY
    });

    rawMatches.push({
      itemId: item.id,
      officialUnitPriceDecimal,
      contractedUnitPriceDecimal,
      unitPriceDifferenceDecimal,
      unitPriceDifferencePercentage: formatBasisPoints(matched.unitPrice.percentageBasisPoints),
      interpretation,
      lineImpactDecimal
    });
  }

  if (rawMatches.length === 0) {
    return { byItemId: new Map(), summary: null };
  }

  const contractDiscountImpactDecimal = addMeasurementDecimals(
    rawMatches.map((match) => match.lineImpactDecimal),
    MONEY_SCALE
  );

  // Valores de contexto (quanto esta medição valeria a cada tabela de
  // preços) -- somas independentes, cada uma já arredondada linha a
  // linha; nunca a fonte do impacto agregado (ver contractDiscountImpactDecimal acima).
  const officialValues: string[] = [];
  const contractedValues: string[] = [];
  for (const item of items) {
    const match = rawMatches.find((candidate) => candidate.itemId === item.id);
    if (!match) continue;
    officialValues.push(calculateMeasurementLineValue({ quantity: item.quantityDecimal, unitValue: match.officialUnitPriceDecimal, policy: MONEY_POLICY }));
    contractedValues.push(calculateMeasurementLineValue({ quantity: item.quantityDecimal, unitValue: match.contractedUnitPriceDecimal, policy: MONEY_POLICY }));
  }

  const byItemId = new Map<string, MeasurementItemEconomicComparison>(
    rawMatches.map((match) => [
      match.itemId,
      {
        officialUnitPriceDecimal: match.officialUnitPriceDecimal,
        contractedUnitPriceDecimal: match.contractedUnitPriceDecimal,
        unitPriceDifferenceDecimal: match.unitPriceDifferenceDecimal,
        unitPriceDifferencePercentage: match.unitPriceDifferencePercentage,
        interpretation: match.interpretation,
        lineImpactDecimal: match.lineImpactDecimal,
        participationPercentage: computeParticipationPercentage(match.lineImpactDecimal, contractDiscountImpactDecimal)
      }
    ])
  );

  return {
    byItemId,
    summary: {
      matchedItemCount: rawMatches.length,
      totalItemCount: items.length,
      measuredValueAtOfficialPricesDecimal: addMeasurementDecimals(officialValues, MONEY_SCALE),
      measuredValueAtContractedPricesDecimal: addMeasurementDecimals(contractedValues, MONEY_SCALE),
      contractDiscountImpactDecimal
    }
  };
}

function resolveMatchedItem(
  item: MeasurementEconomicComparisonItemInput,
  executionItemLinks: ReadonlyMap<string, string>,
  byProposalLineId: ReadonlyMap<string, BudgetComparedItem>,
  byCode: ReadonlyMap<string, BudgetComparedItem>
): BudgetComparedItem | undefined {
  // Preferencial: identidade persistida (contract_execution_item_links)
  // -- vínculo é UNIQUE(contract_baseline_id, managed_service_item_id)
  // no banco, então nunca ambíguo por construção.
  const linkedProposalLineId = item.managedServiceItemId !== null ? executionItemLinks.get(item.managedServiceItemId) : undefined;
  if (linkedProposalLineId !== undefined) {
    const linked = byProposalLineId.get(linkedProposalLineId);
    if (linked) {
      return linked;
    }
  }

  // Reserva: só quando o item não tem vínculo persistido. Ainda assim
  // exige código único nos dois lados (ver indexComparedItemsByCode) --
  // nunca fuzzy, nunca escolhe candidato ambíguo.
  const normalizedCode = normalizeCode(item.code);
  return normalizedCode !== null ? byCode.get(normalizedCode) : undefined;
}

// Indexa por proposalCode E officialCode (reserva, ver resolveMatchedItem)
// -- um código que aponta para mais de um BudgetComparedItem distinto é
// descartado (null), nunca escolhido arbitrariamente.
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

/** Compara dois valores monetários canônicos (strings "123.45") em ordem decrescente -- para ordenar a composição do impacto do deságio por maior contribuição, sem `Number()`. */
export function compareMoneyDecimalsDescending(a: string, b: string): number {
  const diff = decimalToCents(b) - decimalToCents(a);
  return diff > 0n ? 1 : diff < 0n ? -1 : 0;
}

function decimalToCents(decimal: string): bigint {
  const negative = decimal.startsWith("-");
  const unsigned = negative ? decimal.slice(1) : decimal;
  const [integerPart, fractionalPart = ""] = unsigned.split(".");
  const cents = BigInt(integerPart || "0") * 100n + BigInt((fractionalPart + "00").slice(0, 2) || "0");
  return negative ? -cents : cents;
}

/** Percentual exato (bigint, arredondamento half-up em pontos base) -- mesma técnica já usada em budget-version-comparison.ts, aplicada aqui sobre decimais de centavo em vez de cents inteiros. */
function computeParticipationPercentage(lineImpactDecimal: string, totalImpactDecimal: string): string | null {
  const totalCents = decimalToCents(totalImpactDecimal);
  if (totalCents === 0n) return null;
  const lineCents = decimalToCents(lineImpactDecimal);
  const sign = lineCents < 0n === totalCents < 0n ? 1n : -1n;
  const numerator = absBigInt(lineCents) * 10_000n;
  const denominator = absBigInt(totalCents);
  const roundedBasisPoints = (numerator + denominator / 2n) / denominator;
  return formatBasisPoints(Number(sign * roundedBasisPoints));
}

function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}
