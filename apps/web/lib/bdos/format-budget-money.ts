/**
 * Formats a monetary value string or number into Brazilian Portuguese format (pt-BR).
 * Example: "361.52" -> "361,52"
 * Example: "4489.30" -> "4.489,30"
 * Example: "46656.22" -> "46.656,22"
 * Example: "316292.87" -> "316.292,87"
 * Example: "0.90" -> "0,90"
 *
 * Uses deterministic string transformation to preserve 100% exact precision
 * without floating-point rounding errors.
 */
export function formatBudgetMoneyPtBr(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const str = String(value).trim();
  if (str.length === 0 || str === "—") return "—";

  const isNegative = str.startsWith("-");
  const cleanStr = isNegative ? str.slice(1) : str;

  // Verify numerical validity
  const num = Number(cleanStr);
  if (Number.isNaN(num)) return str;

  const parts = cleanStr.split(".");
  let integerPart = parts[0] || "0";
  let decimalPart = parts[1] || "00";

  if (decimalPart.length === 1) decimalPart += "0";
  if (decimalPart.length > 2) decimalPart = decimalPart.slice(0, 2);

  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const formatted = `${integerPart},${decimalPart}`;
  return isNegative ? `-${formatted}` : formatted;
}
