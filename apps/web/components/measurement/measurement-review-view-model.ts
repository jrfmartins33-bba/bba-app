/**
 * "Revisar medição" — formatação puramente textual, mesma disciplina
 * de measurement-bulletin-formal-status-view-model.ts: nunca passa uma
 * quantidade/valor decimal por `Number()` (perderia precisão).
 */

/** "125.5000" -> "125,5". Remove zeros à direita supérfluos, mantém a vírgula decimal pt-BR. */
export function formatMeasurementReviewQuantity(decimalString: string): string {
  const negative = decimalString.startsWith("-");
  const unsigned = negative ? decimalString.slice(1) : decimalString;
  const [integerPart, fractionalPart = ""] = unsigned.split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const trimmedFraction = fractionalPart.replace(/0+$/, "");
  return trimmedFraction.length > 0 ? `${negative ? "-" : ""}${groupedInteger},${trimmedFraction}` : `${negative ? "-" : ""}${groupedInteger}`;
}
