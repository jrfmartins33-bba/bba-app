import {
  addExact,
  equalExact,
  multiplyExact,
  rational,
} from "./budget-table-reconstruction-exact-rational";
import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import { BUDGET_TABLE_RECONSTRUCTION_PROFILE } from "./budget-table-reconstruction-profile";
import type {
  ArithmeticEvaluation,
  ArithmeticEvaluationOutcome,
  BudgetColumnRole,
  ExactRational,
  ParsedNumericEvidence,
  ReconstructedBudgetRecord,
  ReconstructedLogicalRow,
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

/**
 * Correction E1. The exact computed value can carry more decimal digits
 * than any operand's own displayed scale even when every operand has the
 * same scale as the result -- multiplication does not preserve scale
 * (19,24 x 45,59 = 877,1516 from two scale-2 operands). Requiring some
 * operand to individually exceed the displayed scale was never a valid
 * precondition and is dropped entirely. The only question is whether the
 * displayed value is an exact presentation of the computed value under one
 * of the profile's own declared rounding rules -- ANY one of them, not all
 * simultaneously, since a source only ever applies one presentation
 * convention to a given figure.
 */
function provesUndisplayedPrecision(
  computed: ExactRational,
  displayed: ParsedNumericEvidence,
): boolean {
  if (displayed.exactValue === null) {
    return false;
  }
  return BUDGET_TABLE_RECONSTRUCTION_PROFILE.presentationRules.some((rule) =>
    equalExact(presentedValue(computed, displayed.displayedScale, rule), displayed.exactValue!),
  );
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
  if (provesUndisplayedPrecision(computed, displayed)) {
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

interface SummandsForTotal {
  readonly summands: ReadonlyArray<ReconstructedBudgetRecord>;
  readonly scopeProven: boolean;
}

function summandsForTotal(
  target: ReconstructedBudgetRecord,
  records: ReadonlyArray<ReconstructedBudgetRecord>,
  columns: ReadonlyArray<ResolvedColumn>,
  rows: ReadonlyArray<ReconstructedLogicalRow>,
): SummandsForTotal {
  const previousPageContinues = (() => {
    const originPage = target.pageNumber - 1;
    if (rows.some((row) => row.pageNumber === target.pageNumber && row.kind === "header")) {
      return false;
    }
    const origin = columns
      .filter((column) => column.pageNumber === originPage && column.status === "resolved")
      .sort((left, right) => left.horizontalOrder - right.horizontalOrder);
    const current = columns
      .filter((column) => column.pageNumber === target.pageNumber && column.status === "resolved")
      .sort((left, right) => left.horizontalOrder - right.horizontalOrder);
    return (
      origin.length > 0 &&
      origin.length === current.length &&
      origin.every(
        (column, index) =>
          column.role === current[index]!.role &&
          column.leftPoints === current[index]!.leftPoints &&
          column.rightPoints === current[index]!.rightPoints,
      )
    );
  })();
  const before = records.filter(
    (record) =>
      record.documentOrder < target.documentOrder &&
      (record.pageNumber === target.pageNumber ||
        (previousPageContinues && record.pageNumber === target.pageNumber - 1)),
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

  /**
   * Correction E2: an explicit prior total/subtotal boundary found inside
   * `before` proves this window is bounded by real evidence on both sides.
   * Absent that boundary, the window is only provably complete when there
   * is no earlier page by definition -- i.e. `target` (or the earliest
   * record actually pulled into `before`) sits on page 1. Any other page
   * number could have earlier summands sitting on a page the current page
   * selection never reconstructed (a non-consecutive page selection skips
   * pages that may hold unreconstructed content); in that case only an
   * explicit boundary record counts as proof, never an assumption that
   * "nothing came before what we saw".
   */
  const earliestBeforePage =
    before.length > 0 ? Math.min(...before.map((record) => record.pageNumber)) : target.pageNumber;
  const scopeProven = boundaryIndex !== -1 || earliestBeforePage <= 1;

  if (target.kind === "subtotal") {
    const reversedItems: ReconstructedBudgetRecord[] = [];
    for (const candidate of [...window].reverse()) {
      if (candidate.kind !== "service_item") {
        break;
      }
      reversedItems.push(candidate);
    }
    return { summands: reversedItems.reverse(), scopeProven };
  }

  const subtotals = window.filter((candidate) => candidate.kind === "subtotal");
  if (subtotals.length > 0) {
    return { summands: subtotals, scopeProven };
  }
  return {
    summands: window.filter((candidate) => candidate.kind === "service_item"),
    scopeProven,
  };
}

function totalEvaluation(
  record: ReconstructedBudgetRecord,
  records: ReadonlyArray<ReconstructedBudgetRecord>,
  columns: ReadonlyArray<ResolvedColumn>,
  rows: ReadonlyArray<ReconstructedLogicalRow>,
): ArithmeticEvaluation {
  const { summands, scopeProven } = summandsForTotal(record, records, columns, rows);
  const applicable = summands.length > 0;
  let sum: ExactRational | null = applicable ? rational(0n, 1n) : null;
  for (const summand of summands) {
    if (summand.totalPrice?.exactValue === null || summand.totalPrice === null) {
      sum = null;
      break;
    }
    sum = addExact(sum!, summand.totalPrice.exactValue);
  }
  const evaluated = evaluation(
    record,
    "descendant_sum",
    summands.map((summand) => summand.totalPrice),
    record.totalPrice,
    sum,
    applicable,
    summands.map((summand) => summand.recordId),
  );
  if (
    !scopeProven &&
    (evaluated.outcome === "direct_correspondence" ||
      evaluated.outcome === "undisplayed_precision" ||
      evaluated.outcome === "source_arithmetic_inconsistency")
  ) {
    return { ...evaluated, outcome: "insufficient_evidence" };
  }
  return evaluated;
}

export function evaluateArithmetic(
  records: ReadonlyArray<ReconstructedBudgetRecord>,
  columns: ReadonlyArray<ResolvedColumn>,
  rows: ReadonlyArray<ReconstructedLogicalRow> = [],
): ReadonlyArray<ArithmeticEvaluation> {
  const evaluations: ArithmeticEvaluation[] = [];
  for (const record of records) {
    if (record.kind === "service_item") {
      evaluations.push(quantityTotalEvaluation(record, columns));
      evaluations.push(bdiEvaluation(record, columns));
    }
    if (record.kind === "subtotal" || record.kind === "total") {
      evaluations.push(totalEvaluation(record, records, columns, rows));
    }
  }
  return evaluations;
}
