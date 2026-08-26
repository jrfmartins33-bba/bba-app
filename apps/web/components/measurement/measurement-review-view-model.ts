import type { MeasurementItemEconomicInterpretation } from "@/lib/bdos/measurement-item-economic-comparison-service";

/**
 * "Revisar medição" — formatação puramente textual, mesma disciplina
 * de measurement-bulletin-formal-status-view-model.ts: nunca passa uma
 * quantidade/valor decimal por `Number()` (perderia precisão).
 */

// Vocabulário aprovado (item 3 da especificação de evolução econômica)
// -- nunca rótulos genéricos de resultado, sempre nomeando a
// referência (orçamento oficial) explicitamente.
const ECONOMIC_INTERPRETATION_LABELS: Record<MeasurementItemEconomicInterpretation, string> = {
  economy: "Economia frente ao orçamento oficial",
  above_official: "Acima do orçamento oficial",
  no_relevant_variation: "Sem variação relevante"
};

export function formatMeasurementEconomicInterpretation(interpretation: MeasurementItemEconomicInterpretation): string {
  return ECONOMIC_INTERPRETATION_LABELS[interpretation];
}

/** "-1234" (percentual em texto, já formatado como "-12.34" pelo serviço) -> "-12,34%". Nunca refaz a matemática, só troca ponto por vírgula. */
export function formatMeasurementEconomicPercentage(percentageDecimal: string | null): string | null {
  if (percentageDecimal === null) return null;
  return `${percentageDecimal.replace(".", ",")}%`;
}

export const PLANNING_COMPARISON_UNAVAILABLE_MESSAGE = "Comparação com o planejamento ainda não disponível";

/** Rótulo compacto para a coluna Situação da tabela principal -- a frase completa fica em Ver análise → Planejamento físico-financeiro. */
export const PLANNING_UNAVAILABLE_COMPACT_LABEL = "Planejamento indisponível";

/** "125.5000" -> "125,5". Remove zeros à direita supérfluos, mantém a vírgula decimal pt-BR. */
export function formatMeasurementReviewQuantity(decimalString: string): string {
  const negative = decimalString.startsWith("-");
  const unsigned = negative ? decimalString.slice(1) : decimalString;
  const [integerPart, fractionalPart = ""] = unsigned.split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const trimmedFraction = fractionalPart.replace(/0+$/, "");
  return trimmedFraction.length > 0 ? `${negative ? "-" : ""}${groupedInteger},${trimmedFraction}` : `${negative ? "-" : ""}${groupedInteger}`;
}
