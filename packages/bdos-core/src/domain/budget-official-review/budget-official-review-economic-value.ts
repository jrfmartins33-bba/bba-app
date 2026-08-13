import { centsFromDecimalString, sumCents, type MoneyCents } from "../budget-version";

/**
 * Conversão de texto decimal no formato brasileiro da fonte documental
 * (ex.: "1.862.109,66" — ponto como separador de milhar, vírgula como
 * separador decimal) para o formato exigido por `centsFromDecimalString`
 * (ex.: "1862109.66"). Puramente sintática — nunca arredonda, nunca aceita
 * mais de duas casas decimais (o próprio `centsFromDecimalString` rejeita
 * isso). `null`/texto em branco retornam `null`, nunca zero.
 */
export function moneyCentsFromBrazilianText(text: string | null): MoneyCents | null {
  const normalized = normalizeBrazilianDecimal(text);
  if (normalized === null) {
    return null;
  }
  return centsFromDecimalString(normalized);
}

/**
 * Representação exata de uma quantidade decimal, preservada como inteiro
 * escalado (`scaledValue`) + número de casas decimais (`scale`) — nunca
 * `number` de ponto flutuante. Suporta até 6 casas decimais (suficiente
 * para as quantidades observadas na fonte, tipicamente 2); mais que isso é
 * rejeitado explicitamente, nunca truncado.
 */
export interface ExactQuantity {
  readonly scaledValue: bigint;
  readonly scale: number;
}

const MAX_QUANTITY_SCALE = 6;

export function exactQuantityFromBrazilianText(text: string | null): ExactQuantity | null {
  const normalized = normalizeBrazilianDecimal(text);
  if (normalized === null) {
    return null;
  }

  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (match === null) {
    throw new RangeError(`Invalid exact quantity text "${text}": expected a non-negative decimal.`);
  }

  const wholePart = match[1];
  const fractionPart = match[2] ?? "";

  if (fractionPart.length > MAX_QUANTITY_SCALE) {
    throw new RangeError(
      `Quantity text "${text}" has ${fractionPart.length} decimal places, exceeding the supported maximum of ${MAX_QUANTITY_SCALE}.`,
    );
  }

  const scale = fractionPart.length;
  const scaledValue = BigInt(wholePart + fractionPart);
  return { scaledValue, scale };
}

/**
 * Percentual exato (ex.: BDI "24,18%") representado da mesma forma que
 * `ExactQuantity` — escalado, nunca ponto flutuante.
 */
export function exactPercentFromBrazilianText(text: string | null): ExactQuantity | null {
  if (text === null) {
    return null;
  }
  const withoutPercentSign = text.trim().replace(/%\s*$/, "");
  return exactQuantityFromBrazilianText(withoutPercentSign);
}

/**
 * Multiplicação exata quantidade × preço unitário (centavos), retornando
 * centavos inteiros arredondados apenas na última etapa de forma
 * determinística (metade para cima) — nunca ponto flutuante em nenhuma
 * etapa intermediária. Lança erro se o resultado não for representável
 * como inteiro seguro.
 */
export function multiplyQuantityByUnitPriceCents(quantity: ExactQuantity, unitPriceCents: MoneyCents): MoneyCents {
  const numerator = quantity.scaledValue * BigInt(unitPriceCents);
  const denominator = 10n ** BigInt(quantity.scale);
  const halfDenominator = denominator / 2n;
  const rounded = (numerator + halfDenominator) / denominator;

  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`Derived total ${rounded.toString()} exceeds the safe integer range.`);
  }

  return Number(rounded);
}

export function sumMoneyCents(values: ReadonlyArray<MoneyCents | null>): MoneyCents {
  return sumCents(values.filter((value): value is MoneyCents => value !== null));
}

function normalizeBrazilianDecimal(text: string | null): string | null {
  if (text === null) {
    return null;
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }
  // Remove thousands separators ('.'), then convert the decimal comma to a dot.
  const withoutThousands = trimmed.replace(/\.(?=\d{3}(?:\D|$))/g, "");
  const withDotDecimal = withoutThousands.replace(",", ".");
  return withDotDecimal;
}

/**
 * Soma exata em centavos de todas as linhas de tipo ServiceItem do orçamento oficial importado
 * (`extracted.totalPriceText`). Ignora Groups e Subgroups para evitar dupla contagem.
 */
export function calculateOfficialBudgetCents(
  rows: ReadonlyArray<{
    readonly kind: string;
    readonly extracted?: { readonly totalPriceText?: string | null } | null;
  }>,
): bigint {
  let totalCents = 0n;
  for (const row of rows) {
    if (row.kind === "ServiceItem" && row.extracted?.totalPriceText) {
      const cents = moneyCentsFromBrazilianText(row.extracted.totalPriceText);
      if (cents !== null) {
        totalCents += BigInt(cents);
      }
    }
  }
  return totalCents;
}

export function calculateOfficialBudgetTotalText(
  rows: ReadonlyArray<{
    readonly kind: string;
    readonly extracted?: { readonly totalPriceText?: string | null } | null;
  }>,
): string {
  const totalCents = calculateOfficialBudgetCents(rows);
  const dollars = totalCents / 100n;
  const cents = totalCents % 100n;
  return `${dollars.toString()}.${cents.toString().padStart(2, "0")}`;
}
