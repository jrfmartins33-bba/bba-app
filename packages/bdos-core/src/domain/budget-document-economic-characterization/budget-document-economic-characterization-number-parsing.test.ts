import { parseBrazilianMoney, parseBrazilianQuantity } from "./budget-document-economic-characterization-number-parsing";

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// --- dinheiro brasileiro ------------------------------------------------------

equal(parseBrazilianMoney("R$ 1.234,56").cents, 123456, "R$ 1.234,56 must parse to 123456 cents");
equal(parseBrazilianMoney("9.809.087,18").cents, 980908718, "the real official total must parse to exact cents, matching the known reference value");
equal(parseBrazilianMoney("1234,56").cents, 123456, "money without thousands separator must still parse");
equal(parseBrazilianMoney("100").cents, 10000, "a whole-reais value with no comma must parse as N,00");
equal(parseBrazilianMoney("0").cents, 0, "zero must parse");
equal(parseBrazilianMoney(null).status, "absent", "null input must be 'absent', never 'unparseable'");
equal(parseBrazilianMoney("").status, "absent", "empty string must be 'absent'");
equal(parseBrazilianMoney("1234.56").status, "unparseable", "American decimal-point format must never be reinterpreted, only unparseable");
equal(parseBrazilianMoney("-123,45").status, "unparseable", "a negative value must be unparseable, never silently made positive or rejected as absent");
equal(parseBrazilianMoney("abc").status, "unparseable", "non-numeric text must be unparseable");
equal(parseBrazilianMoney("1.234,5").status, "unparseable", "money with only one decimal digit must be unparseable, never padded silently");
const preserved = parseBrazilianMoney("R$   9.809.087,18  ");
equal(preserved.originalText, "R$   9.809.087,18  ", "original text must always be preserved verbatim, including incidental whitespace, regardless of parse outcome");

// --- quantidade (escala variável) --------------------------------------------

const q1 = parseBrazilianQuantity("430,92");
equal(q1.status, "parsed", "quantity with two decimals must parse");
equal(q1.exactDecimalText, "430.92", "quantity exact decimal text must use the same scale as the source, never rounded");
equal(q1.decimalPlaces, 2, "decimal place count must be preserved");

const q2 = parseBrazilianQuantity("1,0000");
equal(q2.decimalPlaces, 4, "a quantity with four decimal places must preserve all four, never truncated to two");
equal(q2.exactDecimalText, "1.0000", "four-decimal quantity exact text must retain all digits");

const q3 = parseBrazilianQuantity("81.600,00");
equal(q3.exactDecimalText, "81600.00", "quantity with thousands separator must strip only the separator, never altering the value");

equal(parseBrazilianQuantity("1").decimalPlaces, 0, "a whole-number quantity with no comma must have zero decimal places, never assumed two");
equal(parseBrazilianQuantity(null).status, "absent", "null quantity must be absent");
equal(parseBrazilianQuantity("N/A").status, "unparseable", "non-numeric quantity text must be unparseable, never silently zero");

console.log("ok - Brazilian money parsing (thousands/decimal separators, whole values, zero, negative rejection, American-format rejection, verbatim preservation) and quantity parsing (variable decimal scale from zero to four+ places, thousands separator, absent vs unparseable)");
