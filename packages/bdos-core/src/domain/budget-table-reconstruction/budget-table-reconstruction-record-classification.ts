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

/** The semantic fields each record kind's own structural contract actually
 * expects it to carry -- never a universal eight-field requirement. A group
 * or subgroup header is only identity (item_code, description); a subtotal
 * or total is only description and the aggregated total_price. Requiring
 * the full economic set from every kind would wrongly treat a legitimate
 * grouping/aggregation line as missing evidence it was never expected to
 * carry in the first place. */
const SEMANTIC_ROLES_BY_KIND: Partial<Record<ReconstructedRecordKind, ReadonlySet<BudgetColumnRole>>> = {
  service_item: new Set([
    "item_code",
    "description",
    "unit",
    "quantity",
    "unit_cost",
    "bdi_rate",
    "unit_price",
    "total_price",
  ]),
  group: new Set(["item_code", "description"]),
  subgroup: new Set(["item_code", "description"]),
  subtotal: new Set(["description", "total_price"]),
  total: new Set(["description", "total_price"]),
};

/**
 * A role only counts toward a record's status when the page's own schema
 * actually resolved a column for it -- kind-membership in
 * SEMANTIC_ROLES_BY_KIND is necessary but not sufficient. A page whose
 * schema never resolved unit_cost/bdi_rate at all (a budget with no
 * cost-breakdown columns) must not treat every service_item on that page as
 * missing those fields: the field was never structurally present to begin
 * with, so it is not applicable rather than absent.
 */
function applicableSemanticRoles(
  kind: ReconstructedRecordKind,
  pageNumber: number,
  columns: ReadonlyArray<ResolvedColumn>,
): ReadonlySet<BudgetColumnRole> {
  const base = SEMANTIC_ROLES_BY_KIND[kind];
  if (base === undefined) {
    return new Set();
  }
  const resolvedRolesOnPage = new Set(
    columns
      .filter((column) => column.pageNumber === pageNumber && column.status === "resolved")
      .map((column) => column.role),
  );
  return new Set([...base].filter((role) => resolvedRolesOnPage.has(role)));
}

/** The five roles that carry a ParsedNumericEvidence field on a record,
 * rather than a plain string (unit) or the identity fields. */
const NUMERIC_ROLES: ReadonlySet<BudgetColumnRole> = new Set([
  "quantity",
  "unit_cost",
  "bdi_rate",
  "unit_price",
  "total_price",
]);

/**
 * A "resolved" applicable numeric cell can still carry an evidence-level
 * interpretation that never became a usable number: `numericForRole` can
 * mark it "failed" (grammarId "divergent-source-cells-v1") when two or more
 * physically distinct, individually cell.state === "present" cells share
 * the role but disagree on text -- a genuine conflict between documentary
 * evidence, not a crash and not something to resolve by picking a side.
 * `parseNumericEvidence` itself can separately mark a single, undisputed
 * text "ambiguous" (a single-separator grammar collision) or "invalid" (no
 * grammar parsed it at all). None of these are "resolved" in any sense a
 * record's own status can honestly ignore.
 *
 * Verified by inspection: today there are exactly two producers of
 * ParsedNumericEvidence in this domain -- `parseNumericEvidence` itself
 * (statuses "resolved" | "ambiguous" | "invalid", never "not_applicable",
 * never "failed") and `numericForRole` below (delegates to
 * `parseNumericEvidence` for a single undisputed text, or produces "failed"
 * itself for the divergent-source-cells-v1 case). "not_applicable" has no
 * producer today, and "failed" has exactly one (divergent-source-cells-v1);
 * this function still classifies both defensively, by their formal status
 * value, rather than assuming they can never occur -- matching the
 * ReconstructedCell.state === "divergent" precedent from the previous round
 * (also formally possible, also unproduced today, also honored anyway).
 */
function numericFieldContamination(
  value: ParsedNumericEvidence | null,
): "ambiguous" | "insufficient_evidence" | null {
  if (value === null) return "insufficient_evidence";
  if (value.status === "ambiguous") return "ambiguous";
  if (value.status === "failed") return "ambiguous";
  if (value.status === "invalid") return "insufficient_evidence";
  if (value.status === "not_applicable") return "insufficient_evidence";
  if (value.exactValue === null) return "insufficient_evidence";
  return null;
}

/**
 * A record's status reflects only cells feeding a role that is both part of
 * its kind's own semantic contract and actually resolved on its page --
 * never a cell whose role is "unknown" (an unresolved auxiliary column) and
 * never a role the kind was never expected to carry. Within that applicable
 * set, precedence is ambiguous > insufficient_evidence > resolved: an
 * ambiguous or divergent cell, an ambiguous/failed numeric interpretation,
 * or an ambiguous continuation always contaminates first; absent that, a
 * missing cell, a numeric field that is invalid/not_applicable/exactValue-
 * less, or an insufficient_evidence continuation means the record cannot
 * honestly be called "resolved" (evidence was expected and never usably
 * observed), so it downgrades to insufficient_evidence instead. `resolved`
 * itself never contaminates -- it is the absence of every case above.
 */
function recordRelevantStatus(
  row: ReconstructedLogicalRow,
  continuations: ReadonlyArray<ReconstructedLogicalRow>,
  kind: ReconstructedRecordKind,
  numericFields: ReadonlyMap<BudgetColumnRole, ParsedNumericEvidence | null>,
  context: RecordFormationContext,
): "resolved" | "ambiguous" | "insufficient_evidence" {
  const applicableRoles = applicableSemanticRoles(kind, row.pageNumber, context.columns);
  const rowCellIds = new Set([row, ...continuations].flatMap((candidate) => candidate.cellIds));
  const semanticCells = context.cells.filter(
    (cell) => rowCellIds.has(cell.cellId) && applicableRoles.has(cell.role),
  );

  const continuationAmbiguous = continuations.some((candidate) => candidate.status === "ambiguous");
  const continuationInsufficient = continuations.some(
    (candidate) => candidate.status === "insufficient_evidence",
  );
  const cellsAmbiguousOrDivergent = semanticCells.some(
    (cell) => cell.state === "ambiguous" || cell.state === "divergent",
  );
  const cellsMissing = semanticCells.some((cell) => cell.state === "missing");

  const numericContaminations = [...applicableRoles]
    .filter((role) => NUMERIC_ROLES.has(role))
    .map((role) => numericFieldContamination(numericFields.get(role) ?? null));
  const numericAmbiguous = numericContaminations.includes("ambiguous");
  const numericInsufficient = numericContaminations.includes("insufficient_evidence");

  if (continuationAmbiguous || cellsAmbiguousOrDivergent || numericAmbiguous) {
    return "ambiguous";
  }
  if (continuationInsufficient || cellsMissing || numericInsufficient) {
    return "insufficient_evidence";
  }
  return "resolved";
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

    const quantity = numericForRole(row, "quantity", context);
    const unitCost = numericForRole(row, "unit_cost", context);
    const bdiRate = numericForRole(row, "bdi_rate", context);
    const unitPrice = numericForRole(row, "unit_price", context);
    const totalPrice = numericForRole(row, "total_price", context);
    const numericFields = new Map<BudgetColumnRole, ParsedNumericEvidence | null>([
      ["quantity", quantity],
      ["unit_cost", unitCost],
      ["bdi_rate", bdiRate],
      ["unit_price", unitPrice],
      ["total_price", totalPrice],
    ]);

    records.push({
      recordId,
      pageNumber: row.pageNumber,
      documentOrder,
      kind,
      status:
        kind === "unclassified"
          ? "insufficient_evidence"
          : recordRelevantStatus(row, continuations, kind, numericFields, context),
      rowIds: [row.rowId, ...continuations.map((candidate) => candidate.rowId)],
      parentRecordId: parent?.recordId ?? null,
      itemCode: code,
      description: description.length === 0 ? null : description,
      unit: textForRole(row, "unit", context),
      quantity,
      unitCost,
      bdiRate,
      unitPrice,
      totalPrice,
    });
  }

  return records;
}
