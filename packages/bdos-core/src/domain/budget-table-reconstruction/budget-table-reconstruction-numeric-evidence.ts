import { rational } from "./budget-table-reconstruction-exact-rational";
import type {
  ExactRational,
  ParsedNumericEvidence,
} from "./budget-table-reconstruction.types";

export type NumericGrammarHint = "decimal_comma" | "decimal_point" | null;

function decimalValue(
  sign: string,
  whole: string,
  fraction: string,
): ExactRational {
  const digits = `${whole}${fraction}`;
  const signedNumerator =
    BigInt(digits.length === 0 ? "0" : digits) * (sign === "-" ? -1n : 1n);
  return rational(signedNumerator, 10n ** BigInt(fraction.length));
}

function parseWithDecimalSeparator(
  text: string,
  decimalSeparator: "." | ",",
): ExactRational | null {
  const thousandsSeparator = decimalSeparator === "." ? "," : ".";
  const escapedDecimal = decimalSeparator === "." ? "\\." : ",";
  const escapedThousands = thousandsSeparator === "." ? "\\." : ",";
  const pattern = new RegExp(
    `^([+-]?)(\\d{1,3}(?:${escapedThousands}\\d{3})*|\\d+)(?:${escapedDecimal}(\\d+))?$`,
  );
  const match = pattern.exec(text);
  if (match === null) {
    return null;
  }
  return decimalValue(
    match[1] ?? "",
    (match[2] ?? "").split(thousandsSeparator).join(""),
    match[3] ?? "",
  );
}

function distinctRationals(
  values: ReadonlyArray<ExactRational | null>,
): ReadonlyArray<ExactRational> {
  return values
    .filter((value): value is ExactRational => value !== null)
    .filter(
      (value, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.numerator === value.numerator &&
            candidate.denominator === value.denominator,
        ) === index,
    );
}

export function parseNumericEvidence(
  rawText: string,
  sourceCellIds: ReadonlyArray<string>,
  sourceFragmentIds: ReadonlyArray<string>,
  grammarHint: NumericGrammarHint = null,
): ParsedNumericEvidence {
  const normalizedText = rawText
    .normalize("NFKC")
    .replace(/(?:R\$|%)/gi, "")
    .replace(/\s+/g, "")
    .trim();
  const separators = [...normalizedText].filter(
    (character) => character === "." || character === ",",
  );
  const finalSeparator = separators.at(-1);
  const displayedScale =
    finalSeparator === undefined
      ? 0
      : normalizedText.length - normalizedText.lastIndexOf(finalSeparator) - 1;
  const commaValue = parseWithDecimalSeparator(normalizedText, ",");
  const pointValue = parseWithDecimalSeparator(normalizedText, ".");
  const ambiguousSingleSeparator =
    grammarHint === null &&
    /^[-+]?\d{1,3}[.,]\d{3}$/.test(normalizedText) &&
    distinctRationals([commaValue, pointValue]).length > 1;

  const values =
    grammarHint === "decimal_comma"
      ? distinctRationals([commaValue])
      : grammarHint === "decimal_point"
        ? distinctRationals([pointValue])
        : distinctRationals([commaValue, pointValue]);

  return {
    rawText,
    normalizedText,
    displayedScale,
    grammarId:
      grammarHint ??
      (ambiguousSingleSeparator
        ? "ambiguous-single-separator-v1"
        : commaValue !== null && normalizedText.includes(",")
          ? "decimal-comma-v1"
          : "decimal-point-v1"),
    exactValue:
      values.length === 1 && !ambiguousSingleSeparator ? values[0]! : null,
    alternativeValues: ambiguousSingleSeparator ? values : [],
    status: ambiguousSingleSeparator
      ? "ambiguous"
      : values.length === 1
        ? "resolved"
        : "invalid",
    sourceCellIds: [...sourceCellIds],
    sourceFragmentIds: [...sourceFragmentIds],
  };
}
