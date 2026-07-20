import { centsFromDecimalString } from "../budget-version";
import type { ParsedMoneyValue, ParsedQuantityValue } from "./budget-document-economic-characterization.types";

/**
 * Parsing determinístico e versionado de números decimais brasileiros
 * (§14) — separador de milhar `.`, separador decimal `,`. Nunca interpreta
 * o padrão americano (`.` decimal); um texto nesse formato é
 * `unparseable`, nunca reinterpretado. Nunca arredonda; nunca aceita
 * negativo (mesma restrição de `MoneyCents`, §14.1) — um valor negativo
 * observado é registrado como `unparseable`, nunca descartado do texto
 * original.
 */
const BRAZILIAN_MONEY_PATTERN = /^R\$\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{2}))?$/;
const BRAZILIAN_QUANTITY_PATTERN = /^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?$/;

export function parseBrazilianMoney(rawText: string | null): ParsedMoneyValue {
  if (rawText === null || rawText.trim().length === 0) return { originalText: rawText, cents: null, status: "absent" };
  const trimmed = rawText.trim();
  const withCurrency = trimmed.startsWith("R$") ? trimmed : `R$ ${trimmed}`;
  const match = BRAZILIAN_MONEY_PATTERN.exec(withCurrency.replace(/\s+/g, " "));
  if (!match) return { originalText: rawText, cents: null, status: "unparseable" };
  const wholePart = match[1].replace(/\./g, "");
  const centsPart = match[2] ?? "00";
  try {
    const cents = centsFromDecimalString(`${wholePart}.${centsPart}`);
    return { originalText: rawText, cents, status: "parsed" };
  } catch {
    return { originalText: rawText, cents: null, status: "unparseable" };
  }
}

export function parseBrazilianQuantity(rawText: string | null): ParsedQuantityValue {
  if (rawText === null || rawText.trim().length === 0) return { originalText: rawText, exactDecimalText: null, decimalPlaces: null, status: "absent" };
  const trimmed = rawText.trim();
  const match = BRAZILIAN_QUANTITY_PATTERN.exec(trimmed);
  if (!match) return { originalText: rawText, exactDecimalText: null, decimalPlaces: null, status: "unparseable" };
  const wholePart = match[1].replace(/\./g, "");
  const fractionPart = match[2] ?? "";
  const exactDecimalText = fractionPart.length > 0 ? `${wholePart}.${fractionPart}` : wholePart;
  return { originalText: rawText, exactDecimalText, decimalPlaces: fractionPart.length, status: "parsed" };
}
