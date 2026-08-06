import {
  addExact,
  equalExact,
  multiplyExact,
  rational,
} from "./budget-table-reconstruction-exact-rational";
import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import type {
  ArithmeticEvaluation,
  ArithmeticEvaluationOutcome,
  BudgetColumnRole,
  ExactRational,
  ParsedNumericEvidence,
  ReconstructedBudgetRecord,
  ResolvedColumn,
} from "./budget-table-reconstruction.types";

function sourceCellIds(
  values: ReadonlyArray<ParsedNumericEvidence | null>,
): ReadonlyArray<string> {
  return [...new Set(values.flatMap((value) => value?.sourceCellIds ?? []))].sort();
}

function sourceFragmentIds(
  values: ReadonlyArray<ParsedNumericEvidence | null>,
): ReadonlyArray<string> {
  return [...new Set(values.flatMap((value) => value?.sourceFragmentIds ?? []))].sort();
}

function hasInventedEvidence(value: ParsedNumericEvidence | null): boolean {
  return (
    value !== null &&
    (value.sourceCellIds.length === 0 || value.sourceFragmentIds.length === 0)
  );
}

function hasDivergence(value: ParsedNumericEvidence | null): boolean {
  return value?.grammarId === "divergent-source-cells-v1";
}

function powerOfTen(scale: number): bigint {
  return 10n ** BigInt(scale);
}

function presentedValue(
  value: ExactRational,
  scale: number,
  rule: "truncate_to_displayed_scale" | "half_away_from_zero",
): ExactRational {
  const denominator = BigInt(value.denominator);
  const scaledNumerator = BigInt(value.numerator) * powerOfTen(scale);
  let quotient = scaledNumerator / denominator;
  const remainder = scaledNumerator % denominator;
  if (
    rule === "half_away_from_zero" &&
    (remainder < 0n ? -remainder : remainder) * 2n >= denominator
  ) {
    quotient += scaledNumerator < 0n ? -1n : 1n;
  }
  return rational(quotient, powerOfTen(scale));
}

function provesUndisplayedPrecision(
  computed: ExactRational,
  displayed: ParsedNumericEvidence,
  operands: ReadonlyArray<ParsedNumericEvidence | null>,
): boolean {
  if (displayed.exactValue === null) {
    return false;
  }
  const hasHigherPrecisionSource = operands.some(
    (operand) => operand !== null && operand.displayedScale > displayed.displayedScale,
  );
  if (!hasHigherPrecisionSource) {
    return false;
  }
  const presentations = [
    presentedValue(computed, displayed.displayedScale, "truncate_to_displayed_scale"),
    presentedValue(computed, displayed.displayedScale, "half_away_from_zero"),
  ];
  return presentations.every((candidate) => equalExact(candidate, displayed.exactValue!));
}

function outcomeForRelation(
  operands: ReadonlyArray<ParsedNumericEvidence | null>,
  displayed: ParsedNumericEvidence | null,
  computed: ExactRational | null,
  applicable: boolean,
): ArithmeticEvaluationOutcome {
  if (!applicable) {
    return "not_applicable";
  }
  const allValues = [...operands, displayed];
  if (allValues.some(hasInventedEvidence)) {
    return "invented_evidence";
  }
  if (allValues.some(hasDivergence)) {
    return "divergent_cell";
  }
  if (allValues.some((value) => value === null)) {
    return "missing_cell";
  }
  if (displayed === null) {
    return "missing_cell";
  }
  if (
    allValues.some(
      (value) => value?.status === "ambiguous" || value?.status === "invalid",
    )
  ) {
    return "insufficient_evidence";
  }
  if (
    computed === null ||
    displayed.exactValue === null ||
    operands.some((value) => value?.exactValue === null)
  ) {
    return "insufficient_evidence";
  }
  if (equalExact(computed, displayed.exactValue)) {
    return "direct_correspondence";
  }
  if (provesUndisplayedPrecision(computed, displayed, operands)) {
    return "undisplayed_precision";
  }
  return "source_arithmetic_inconsistency";
}

function evaluation(
  record: ReconstructedBudgetRecord,
  relation: ArithmeticEvaluation["relation"],
  operands: ReadonlyArray<ParsedNumericEvidence | null>,
  displayed: ParsedNumericEvidence | null,
  computed: ExactRational | null,
  applicable: boolean,
  summandRecordIds: ReadonlyArray<string> = [],
): ArithmeticEvaluation {
  const allValues = [...operands, displayed];
  return {
    evaluationId: `arithmetic:${fingerprintCanonical({
      recordId: record.recordId,
      relation,
    })}`,
    relation,
    recordId: record.recordId,
    outcome: outcomeForRelation(operands, displayed, computed, applicable),
    operandCellIds: sourceCellIds(allValues),
    operandFragmentIds: sourceFragmentIds(allValues),
    exactComputedValue: computed,
    displayedValue: displayed?.exactValue ?? null,
    summandRecordIds: [...summandRecordIds],
  };
}

function schemaHasRole(
  columns: ReadonlyArray<ResolvedColumn>,
  pageNumber: number,
  role: BudgetColumnRole,
): boolean {
  return columns.some(
    (column) =>
      column.pageNumber === pageNumber &&
      column.status === "resolved" &&
      column.role === role,
  );
}

function quantityTotalEvaluation(
  record: ReconstructedBudgetRecord,
  columns: ReadonlyArray<ResolvedColumn>,
): ArithmeticEvaluation {
  const quantity = record.quantity?.exactValue ?? null;
  const unitPrice = record.unitPrice?.exactValue ?? null;
  const applicable = ["quantity", "unit_price", "total_price"].every((role) =>
    schemaHasRole(columns, record.pageNumber, role as BudgetColumnRole),
  );
  return evaluation(
    record,
    "quantity_times_unit_price",
    [record.quantity, record.unitPrice],
    record.totalPrice,
    quantity !== null && unitPrice !== null
      ? multiplyExact(quantity, unitPrice)
      : null,
    applicable,
  );
}

function bdiEvaluation(
  record: ReconstructedBudgetRecord,
  columns: ReadonlyArray<ResolvedColumn>,
): ArithmeticEvaluation {
  const applicable = ["unit_cost", "bdi_rate", "unit_price"].every((role) =>
    schemaHasRole(columns, record.pageNumber, role as BudgetColumnRole),
  );
  const unitCost = record.unitCost?.exactValue ?? null;
  const bdiRate = record.bdiRate?.exactValue ?? null;
  const multiplier =
    bdiRate === null
      ? null
      : addExact(rational(1n, 1n), multiplyExact(bdiRate, rational(1n, 100n)));
  return evaluation(
    record,
    "unit_cost_with_bdi",
    [record.unitCost, record.bdiRate],
    record.unitPrice,
    unitCost !== null && multiplier !== null
      ? multiplyExact(unitCost, multiplier)
      : null,
    applicable,
  );
}

function summandsForTotal(
  target: ReconstructedBudgetRecord,
  records: ReadonlyArray<ReconstructedBudgetRecord>,
): ReadonlyArray<ReconstructedBudgetRecord> {
  const before = records.filter(
    (record) =>
      record.documentOrder < target.documentOrder &&
      record.pageNumber === target.pageNumber,
  );
  let boundaryIndex = -1;
  for (let index = before.length - 1; index >= 0; index -= 1) {
    const record = before[index]!;
    const isBoundary =
      target.kind === "subtotal"
        ? record.kind === "total" || record.kind === "subtotal"
        : record.kind === "total";
    if (isBoundary) {
      boundaryIndex = index;
      break;
    }
  }
  const window = before.slice(boundaryIndex + 1);

  if (target.kind === "subtotal") {
    const reversedItems: ReconstructedBudgetRecord[] = [];
    for (const candidate of [...window].reverse()) {
      if (candidate.kind !== "service_item") {
        break;
      }
      reversedItems.push(candidate);
    }
    return reversedItems.reverse();
  }

  const subtotals = window.filter((candidate) => candidate.kind === "subtotal");
  if (subtotals.length > 0) {
    return subtotals;
  }
  return window.filter((candidate) => candidate.kind === "service_item");
}

function totalEvaluation(
  record: ReconstructedBudgetRecord,
  records: ReadonlyArray<ReconstructedBudgetRecord>,
): ArithmeticEvaluation {
  const summands = summandsForTotal(record, records);
  const applicable = summands.length > 0;
  let sum: ExactRational | null = applicable ? rational(0n, 1n) : null;
  for (const summand of summands) {
    if (summand.totalPrice?.exactValue === null || summand.totalPrice === null) {
      sum = null;
      break;
    }
    sum = addExact(sum!, summand.totalPrice.exactValue);
  }
  return evaluation(
    record,
    "descendant_sum",
    summands.map((summand) => summand.totalPrice),
    record.totalPrice,
    sum,
    applicable,
    summands.map((summand) => summand.recordId),
  );
}

export function evaluateArithmetic(
  records: ReadonlyArray<ReconstructedBudgetRecord>,
  columns: ReadonlyArray<ResolvedColumn>,
): ReadonlyArray<ArithmeticEvaluation> {
  const evaluations: ArithmeticEvaluation[] = [];
  for (const record of records) {
    if (record.kind === "service_item") {
      evaluations.push(quantityTotalEvaluation(record, columns));
      evaluations.push(bdiEvaluation(record, columns));
    }
    if (record.kind === "subtotal" || record.kind === "total") {
      evaluations.push(totalEvaluation(record, records));
    }
  }
  return evaluations;
}
