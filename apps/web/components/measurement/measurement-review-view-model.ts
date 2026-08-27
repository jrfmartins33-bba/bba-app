import type { MeasurementItemEconomicInterpretation } from "@/lib/bdos/measurement-item-economic-comparison-service";

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

/** "125.5000" -> "125,5". Remove zeros à direita supérfluos, mantém a vírgula decimal pt-BR. */
export function formatMeasurementReviewQuantity(decimalString: string): string {
  const negative = decimalString.startsWith("-");
  const unsigned = negative ? decimalString.slice(1) : decimalString;
  const [integerPart, fractionalPart = ""] = unsigned.split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const trimmedFraction = fractionalPart.replace(/0+$/, "");
  return trimmedFraction.length > 0 ? `${negative ? "-" : ""}${groupedInteger},${trimmedFraction}` : `${negative ? "-" : ""}${groupedInteger}`;
}
