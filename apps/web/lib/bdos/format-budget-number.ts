/**
 * Formatadores numéricos determinísticos para o padrão brasileiro (pt-BR).
 * Preservam a precisão original sem arredondamentos por ponto flutuante.
 */

/**
 * Formata valor monetário (ex.: "361.52" -> "361,52", "4489.30" -> "4.489,30").
 */
export function formatBudgetMoneyPtBr(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const str = String(value).trim();
  if (str.length === 0 || str === "—") return "—";

  const isNegative = str.startsWith("-");
  const cleanStr = isNegative ? str.slice(1) : str;

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

/**
 * Formata quantidade (ex.: "46656.22" -> "46.656,22", "7157.99" -> "7.157,99", "14" -> "14").
 */
export function formatBudgetNumberPtBr(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const str = String(value).trim();
  if (str.length === 0 || str === "—") return "—";

  const isNegative = str.startsWith("-");
  const cleanStr = isNegative ? str.slice(1) : str;

  const num = Number(cleanStr);
  if (Number.isNaN(num)) return str;

  const parts = cleanStr.split(".");
  let integerPart = parts[0] || "0";
  const decimalPart = parts[1];

  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (decimalPart !== undefined && decimalPart.length > 0) {
    const formatted = `${integerPart},${decimalPart}`;
    return isNegative ? `-${formatted}` : formatted;
  }

  return isNegative ? `-${integerPart}` : integerPart;
}

/**
 * Formata percentual (ex.: "24.18" ou "24.18%" -> "24,18%").
 */
export function formatBudgetPercentPtBr(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  let str = String(value).trim();
  if (str.length === 0 || str === "—") return "—";

  if (str.endsWith("%")) {
    str = str.slice(0, -1).trim();
  }

  const num = Number(str);
  if (Number.isNaN(num)) return `${str}%`;

  const formattedNum = formatBudgetNumberPtBr(str);
  return `${formattedNum}%`;
}
