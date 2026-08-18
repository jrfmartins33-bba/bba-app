import { formatBasisPointsPtBr, formatCentsPtBr, parseBrlToCents } from "./proposal-scenarios";

equal(parseBrlToCents("12.200.000,00"), 1_220_000_000, "pt-BR money parses to exact cents");
equal(parseBrlToCents("R$ 0,01"), 1, "one cent remains exact");
equal(parseBrlToCents("12.00"), null, "ambiguous dot decimal is rejected");
equal(parseBrlToCents("1,001"), null, "more than two decimal places are rejected");
equal(formatCentsPtBr(1_365_119_673), "R$ 13.651.196,73", "money formats without floating point");
equal(formatBasisPointsPtBr("1063", "Reduction"), "− 10,63%", "basis points format exactly");
equal(formatBasisPointsPtBr("255", "Increase"), "+ 2,55%", "increase is visibly classified");

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  console.log(`ok - ${message}`);
}
