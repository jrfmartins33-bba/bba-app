/**
 * "Revisar medição" — evolução econômica (Orçamento Oficial × Proposta
 * Vencedora) por item medido. Função pura, sem I/O: recebe um
 * `BudgetVersionComparison` já calculado (via
 * `getBudgetComparisonService`, `@bba/bdos-core/services/procurement-engineering`
 * -- o mesmo motor já usado e testado por /orcamentos) e liga cada
 * item medido ao `BudgetComparedItem` correspondente.
 *
 * CORREÇÃO CIRÚRGICA (pós-Preview): a primeira versão ligava por texto
 * (managed_service_items.code == BudgetComparedItem.proposalCode/
 * officialCode) e por isso nunca encontrava nada -- causa raiz
 * confirmada contra o BM_08 real: `managed_service_items.code` é o
 * código hierárquico interno da medição ("01.02.01"), enquanto
 * `budget_lines.external_code` é o código da composição/catálogo
 * ("73847/002") -- dois espaços de código independentes, nenhuma
 * relação textual entre eles. A identidade correta já está persistida
 * em `contract_execution_item_links` (managed_service_item_id ->
 * proposal_budget_line_id, UNIQUE por contract_baseline_id +
 * managed_service_item_id -- nunca ambíguo por construção), então esse
 * vínculo é a fonte PRIMÁRIA de correspondência; o casamento por
 * código só roda como reserva para itens sem vínculo persistido
 * (nunca fuzzy, nunca escolhe candidato ambíguo).
 *
 * Nunca recalcula preço oficial/contratado -- unitPrice.officialCents/
 * winnerCents já vêm exatos de compareBudgetVersions. Este módulo só
 * (a) localiza o BudgetComparedItem do item medido e (b) multiplica
 * quantidade × preço com aritmética decimal exata
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

  const byItemId = new Map<string, MeasurementItemEconomicComparison>();
  const officialValues: string[] = [];
  const contractedValues: string[] = [];

  for (const item of items) {
    const matched = resolveMatchedItem(item, executionItemLinks, byProposalLineId, byCode);
    if (!matched) continue;
    if (matched.unitPrice.officialCents === null || matched.unitPrice.winnerCents === null || matched.unitPrice.differenceCents === null) continue;

    const officialUnitPriceDecimal = centsToDecimalString(matched.unitPrice.officialCents);
    const contractedUnitPriceDecimal = centsToDecimalString(matched.unitPrice.winnerCents);
    const unitPriceDifferenceDecimal = subtractMeasurementDecimals(officialUnitPriceDecimal, contractedUnitPriceDecimal, MONEY_SCALE);

    const interpretation: MeasurementItemEconomicInterpretation =
      matched.unitPrice.differenceCents === 0 ? "no_relevant_variation" : matched.unitPrice.differenceCents > 0 ? "economy" : "above_official";

    byItemId.set(item.id, {
      officialUnitPriceDecimal,
      contractedUnitPriceDecimal,
      unitPriceDifferenceDecimal,
      unitPriceDifferencePercentage: formatBasisPoints(matched.unitPrice.percentageBasisPoints),
      interpretation
    });

    officialValues.push(calculateMeasurementLineValue({ quantity: item.quantityDecimal, unitValue: officialUnitPriceDecimal, policy: MONEY_POLICY }));
    contractedValues.push(calculateMeasurementLineValue({ quantity: item.quantityDecimal, unitValue: contractedUnitPriceDecimal, policy: MONEY_POLICY }));
  }

  if (byItemId.size === 0) {
    return { byItemId, summary: null };
  }

  const measuredValueAtOfficialPricesDecimal = addMeasurementDecimals(officialValues, MONEY_SCALE);
  const measuredValueAtContractedPricesDecimal = addMeasurementDecimals(contractedValues, MONEY_SCALE);

  return {
    byItemId,
    summary: {
      matchedItemCount: byItemId.size,
      totalItemCount: items.length,
      measuredValueAtOfficialPricesDecimal,
      measuredValueAtContractedPricesDecimal,
      economyDecimal: subtractMeasurementDecimals(measuredValueAtOfficialPricesDecimal, measuredValueAtContractedPricesDecimal, MONEY_SCALE)
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
