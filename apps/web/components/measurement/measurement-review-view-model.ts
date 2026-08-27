import type { MeasurementItemEconomicInterpretation } from "@/lib/bdos/measurement-item-economic-comparison-service";
import type { PhysicalFinancialSituation } from "./measurement-review-client";

/**
 * "Revisar medição" — formatação puramente textual, mesma disciplina
 * de measurement-bulletin-formal-status-view-model.ts: nunca passa uma
 * quantidade/valor decimal por `Number()` (perderia precisão).
 */

/**
 * Correção semântica pós-Preview: Orçamento Oficial × Proposta
 * Vencedora é DESÁGIO/REDUÇÃO NA CONTRATAÇÃO -- nunca um rótulo de
 * resultado de execução (esse conceito só fará sentido comparando a
 * Proposta Vencedora contra o custo real de execução, que o BDOS
 * ainda não integra por item/período -- ver "Resultado da execução"
 * em measurement-review-item-row.tsx). A sentença nomeia sempre a
 * referência (orçamento oficial) explicitamente, com o percentual
 * real embutido -- nunca um rótulo genérico solto.
 */
export function formatMeasurementEconomicInterpretationSentence(
  interpretation: MeasurementItemEconomicInterpretation,
  percentageDecimal: string | null
): string {
  if (interpretation === "no_variation") {
    return "Preço contratado sem variação frente ao orçamento oficial.";
  }
  const magnitude = formatMeasurementEconomicPercentage(absolutePercentage(percentageDecimal)) ?? "—";
  return interpretation === "contract_discount"
    ? `Preço contratado ${magnitude} abaixo do orçamento oficial.`
    : `Preço contratado ${magnitude} acima do orçamento oficial.`;
}

function absolutePercentage(percentageDecimal: string | null): string | null {
  if (percentageDecimal === null) return null;
  return percentageDecimal.startsWith("-") ? percentageDecimal.slice(1) : percentageDecimal;
}

/** "-1234" (percentual em texto, já formatado como "-12.34" pelo serviço) -> "-12,34%". Nunca refaz a matemática, só troca ponto por vírgula. */
export function formatMeasurementEconomicPercentage(percentageDecimal: string | null): string | null {
  if (percentageDecimal === null) return null;
  return `${percentageDecimal.replace(".", ",")}%`;
}

export const PLANNING_COMPARISON_UNAVAILABLE_MESSAGE = "Comparação com o planejamento ainda não disponível";

/** Rótulo compacto para a coluna Situação da tabela principal -- a frase completa fica em Ver análise → Planejamento físico-financeiro. */
export const PLANNING_UNAVAILABLE_COMPACT_LABEL = "Planejamento indisponível";

/** Nota fixa em qualquer bloco por item: a situação é do GRUPO do cronograma, nunca do item individual (o físico-financeiro não planeja item a item). */
export const GROUP_SITUATION_ITEM_NOTE =
  "Esta situação refere-se ao grupo do cronograma físico-financeiro, não ao item individual.";

const PHYSICAL_FINANCIAL_SITUATION_LABEL: Record<PhysicalFinancialSituation, string> = {
  above_planned: "Acima do previsto",
  on_planned: "No previsto",
  below_planned: "Abaixo do previsto"
};

/** "Acima do previsto" / "No previsto" / "Abaixo do previsto". Vocabulário fixo, sem conotação temporal -- a fonte não traz datas/durações por grupo. */
export function formatPhysicalFinancialSituation(situation: PhysicalFinancialSituation): string {
  return PHYSICAL_FINANCIAL_SITUATION_LABEL[situation];
}

/** Badge compacto para a coluna Situação da tabela principal quando há grupo correlacionado. */
export function formatGroupSituationBadge(situation: PhysicalFinancialSituation): string {
  return `Grupo ${PHYSICAL_FINANCIAL_SITUATION_LABEL[situation].toLowerCase()}`;
}

/**
 * Tom visual da situação (item 9): acima → positivo, por ser
 * inequivocamente favorável executar além do previsto; no previsto →
 * neutro; abaixo → atenção (amber). Evita vermelho nesta primeira
 * versão.
 */
export function physicalFinancialSituationTone(situation: PhysicalFinancialSituation): "positive" | "neutral" | "caution" {
  if (situation === "above_planned") return "positive";
  if (situation === "on_planned") return "neutral";
  return "caution";
}

/** "94.14" -> "94,14%". "-31.44" -> "−31,44 p.p." quando `asPoints`. null passa direto. */
export function formatPercentPoints(decimal: string | null, options?: { readonly asPoints?: boolean }): string | null {
  if (decimal === null) return null;
  const negative = decimal.startsWith("-");
  const body = (negative ? decimal.slice(1) : decimal).replace(".", ",");
  const suffix = options?.asPoints ? " p.p." : "%";
  return `${negative ? "−" : ""}${body}${suffix}`;
}

/** Desvio monetário com sinal explícito: "+R$ 1.000,00" / "−R$ 1.000,00". */
export function formatDeviationBRL(decimal: string): string {
  const negative = decimal.startsWith("-");
  const unsigned = negative ? decimal.slice(1) : decimal;
  const [integerPart, fractionalPart = "00"] = unsigned.split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = fractionalPart.padEnd(2, "0").slice(0, 2);
  return `${negative ? "−" : "+"}R$ ${groupedInteger},${cents}`;
}

/** "125.5000" -> "125,5". Remove zeros à direita supérfluos, mantém a vírgula decimal pt-BR. */
export function formatMeasurementReviewQuantity(decimalString: string): string {
  const negative = decimalString.startsWith("-");
  const unsigned = negative ? decimalString.slice(1) : decimalString;
  const [integerPart, fractionalPart = ""] = unsigned.split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const trimmedFraction = fractionalPart.replace(/0+$/, "");
  return trimmedFraction.length > 0 ? `${negative ? "-" : ""}${groupedInteger},${trimmedFraction}` : `${negative ? "-" : ""}${groupedInteger}`;
}
