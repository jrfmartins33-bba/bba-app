import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import { parseNumericEvidence } from "./budget-table-reconstruction-numeric-evidence";
import { cellText } from "./budget-table-reconstruction-text";
import type {
  BudgetColumnRole,
  EvidenceTextItem,
  ParsedNumericEvidence,
  ReconstructedBudgetRecord,
  ReconstructedCell,
  ReconstructedLogicalRow,
  ReconstructedRecordKind,
  ResolvedColumn,
  SourceFragment,
} from "./budget-table-reconstruction.types";

interface RecordFormationContext {
  readonly cells: ReadonlyArray<ReconstructedCell>;
  readonly fragments: ReadonlyArray<SourceFragment>;
  readonly textItems: ReadonlyArray<EvidenceTextItem>;
  readonly columns: ReadonlyArray<ResolvedColumn>;
  readonly rows: ReadonlyArray<ReconstructedLogicalRow>;
}

/** The eight fields a ReconstructedBudgetRecord actually carries. A cell with
 * any other role -- most commonly "unknown" for an auxiliary/reference
 * column the schema never resolved -- feeds none of them and must never by
 * itself make an otherwise-complete record ambiguous. */
const RECORD_SEMANTIC_ROLES: ReadonlySet<BudgetColumnRole> = new Set([
  "item_code",
  "description",
  "unit",
  "quantity",
  "unit_cost",
  "bdi_rate",
  "unit_price",
  "total_price",
]);

/**
 * Correction D: a record's status reflects only evidence that feeds its own
 * semantic fields -- never a cell whose role does not correspond to any of
 * them. An ambiguous or divergent cell under a recognized role (quantity,
 * unit_price, ...) still contaminates the record, exactly as before; an
 * ambiguous cell under an unresolved auxiliary column ("unknown") does not.
 * A description continuation that could not be uniquely attributed to this
 * row still contaminates, since it directly affects the description field.
 */
function recordRelevantStatus(
  row: ReconstructedLogicalRow,
  continuations: ReadonlyArray<ReconstructedLogicalRow>,
  context: RecordFormationContext,
): "resolved" | "ambiguous" {
  const continuationUnresolved = continuations.some((candidate) => candidate.status !== "resolved");
  const rowCellIds = new Set([row, ...continuations].flatMap((candidate) => candidate.cellIds));
  const semanticCells = context.cells.filter(
    (cell) => rowCellIds.has(cell.cellId) && RECORD_SEMANTIC_ROLES.has(cell.role),
  );
  const semanticCellsContaminated = semanticCells.some(
    (cell) => cell.state === "ambiguous" || cell.state === "divergent",
  );
  return continuationUnresolved || semanticCellsContaminated ? "ambiguous" : "resolved";
}

function pagesHavePositiveContinuity(
  originPage: number,
  targetPage: number,
  context: RecordFormationContext,
): boolean {
  if (targetPage !== originPage + 1) return false;
  if (context.rows.some((row) => row.pageNumber === targetPage && row.kind === "header")) {
    return false;
  }
  const origin = context.columns
    .filter((column) => column.pageNumber === originPage && column.status === "resolved")
    .sort((left, right) => left.horizontalOrder - right.horizontalOrder);
  const target = context.columns
    .filter((column) => column.pageNumber === targetPage && column.status === "resolved")
    .sort((left, right) => left.horizontalOrder - right.horizontalOrder);
  return (
    origin.length > 0 &&
    origin.length === target.length &&
    origin.every(
      (column, index) =>
        column.role === target[index]!.role &&
        column.leftPoints === target[index]!.leftPoints &&
        column.rightPoints === target[index]!.rightPoints,
    )
  );
}

function pageIsLinked(
  candidatePage: number,
  currentPage: number,
  context: RecordFormationContext,
): boolean {
  return (
    candidatePage === currentPage ||
    pagesHavePositiveContinuity(candidatePage, currentPage, context)
  );
}

function cellsForRole(
  row: ReconstructedLogicalRow,
  role: BudgetColumnRole,
  context: RecordFormationContext,
): ReadonlyArray<ReconstructedCell> {
  const rowCellIds = new Set(row.cellIds);
  return context.cells.filter(
    (cell) => rowCellIds.has(cell.cellId) && cell.role === role && cell.state !== "missing",
  );
}

function textForRole(
  row: ReconstructedLogicalRow,
  role: BudgetColumnRole,
  context: RecordFormationContext,
): string | null {
  const values = cellsForRole(row, role, context)
    .map((cell) => cellText(cell, context.fragments, context.textItems))
    .filter((value): value is string => value !== null);
  const distinct = [...new Set(values)];
  return distinct.length === 1 ? distinct[0]! : distinct.length === 0 ? null : values.join(" | ");
}

function numericForRole(
  row: ReconstructedLogicalRow,
  role: BudgetColumnRole,
  context: RecordFormationContext,
): ParsedNumericEvidence | null {
  const cells = cellsForRole(row, role, context);
  if (cells.length === 0) {
    return null;
  }
  const values = cells
    .map((cell) => ({ cell, text: cellText(cell, context.fragments, context.textItems) }))
    .filter((entry): entry is { cell: ReconstructedCell; text: string } => entry.text !== null);
  if (values.length === 0) {
    return null;
  }
  const distinctTexts = [...new Set(values.map((entry) => entry.text))];
  const sourceCellIds = values.map((entry) => entry.cell.cellId);
  const sourceFragmentIds = [...new Set(values.flatMap((entry) => entry.cell.fragmentIds))];
  if (distinctTexts.length > 1 || values.some((entry) => entry.cell.state === "divergent")) {
    return {
      rawText: distinctTexts.join(" | "),
      normalizedText: distinctTexts.join("|"),
      displayedScale: 0,
      grammarId: "divergent-source-cells-v1",
      exactValue: null,
      alternativeValues: [],
      status: "failed",
      sourceCellIds,
      sourceFragmentIds,
    };
  }
  return parseNumericEvidence(
    distinctTexts[0]!,
    sourceCellIds,
    sourceFragmentIds,
  );
}

function hierarchicalDepth(code: string | null): number | null {
  if (code === null || !/^\d+(?:\.\d+)*$/.test(code)) {
    return null;
  }
  return code.split(".").length;
}

function isPrefix(parentCode: string, childCode: string): boolean {
  return childCode.startsWith(`${parentCode}.`);
}

function recordKindForRow(
  row: ReconstructedLogicalRow,
  code: string | null,
  previousHeaders: ReadonlyArray<ReconstructedBudgetRecord>,
  context: RecordFormationContext,
): ReconstructedRecordKind {
  if (row.kind !== "group") {
    return row.kind === "header" || row.kind === "description_continuation"
      ? "unclassified"
      : row.kind;
  }
  const depth = hierarchicalDepth(code);
  if (depth === null || code === null) {
    return "unclassified";
  }
  const localParent = [...previousHeaders]
    .reverse()
    .find(
      (candidate) =>
        pageIsLinked(candidate.pageNumber, row.pageNumber, context) &&
        candidate.itemCode !== null &&
        isPrefix(candidate.itemCode, code) &&
        hierarchicalDepth(candidate.itemCode) === depth - 1,
    );
  return localParent === undefined ? "group" : "subgroup";
}

function parentForRecord(
  pageNumber: number,
  code: string | null,
  records: ReadonlyArray<ReconstructedBudgetRecord>,
  context: RecordFormationContext,
): ReconstructedBudgetRecord | undefined {
  const headers = [...records]
    .reverse()
    .filter(
      (record) =>
        pageIsLinked(record.pageNumber, pageNumber, context) &&
        (record.kind === "group" || record.kind === "subgroup"),
    );
  if (code !== null && hierarchicalDepth(code) !== null) {
    const prefixed = headers.find(
      (candidate) =>
        candidate.itemCode !== null && isPrefix(candidate.itemCode, code),
    );
    if (prefixed !== undefined) {
      return prefixed;
    }
  }
  return headers[0];
}

export function classifyRecords(
  rows: ReadonlyArray<ReconstructedLogicalRow>,
  context: RecordFormationContext,
): ReadonlyArray<ReconstructedBudgetRecord> {
  const records: ReconstructedBudgetRecord[] = [];
  const recordRows = rows.filter(
    (row) => row.kind !== "header" && row.kind !== "description_continuation",
  );

  for (const [documentOrder, row] of recordRows.entries()) {
    const code = textForRole(row, "item_code", context);
    const kind = recordKindForRow(row, code, records, context);
    const continuations = rows.filter(
      (candidate) =>
        candidate.kind === "description_continuation" &&
        candidate.descriptionSourceRowIds.includes(row.rowId),
    );
    const description = [row.description, ...continuations.map((candidate) => candidate.description)]
      .filter((value): value is string => value !== null)
      .join(" ")
      .trim();
    const parent =
      kind === "group"
        ? undefined
        : parentForRecord(row.pageNumber, code, records, context);
    const recordId = `record:${fingerprintCanonical({
      rowId: row.rowId,
      kind,
      documentOrder,
    })}`;

    records.push({
      recordId,
      pageNumber: row.pageNumber,
      documentOrder,
      kind,
      status:
        kind === "unclassified"
          ? "insufficient_evidence"
          : recordRelevantStatus(row, continuations, context),
      rowIds: [row.rowId, ...continuations.map((candidate) => candidate.rowId)],
      parentRecordId: parent?.recordId ?? null,
      itemCode: code,
      description: description.length === 0 ? null : description,
      unit: textForRole(row, "unit", context),
      quantity: numericForRole(row, "quantity", context),
      unitCost: numericForRole(row, "unit_cost", context),
      bdiRate: numericForRole(row, "bdi_rate", context),
      unitPrice: numericForRole(row, "unit_price", context),
      totalPrice: numericForRole(row, "total_price", context),
    });
  }

  return records;
}
