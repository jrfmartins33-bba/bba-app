import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import { isEconomicAnchor } from "./budget-table-reconstruction-logical-row-formation";
import { parseNumericEvidence } from "./budget-table-reconstruction-numeric-evidence";
import { cellText } from "./budget-table-reconstruction-text";
import type {
  BudgetColumnRole,
  BudgetTableSchemaExpectation,
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
  /** What each page's proven table schema was expected to carry. Absent when
   * the caller has no schema evidence to offer -- in which case expectation
   * can only be what the page itself resolved, which is exactly the pre-schema
   * behaviour. */
  readonly schemaExpectations?: ReadonlyArray<BudgetTableSchemaExpectation>;
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
 * A role counts toward a record's status when it is part of its kind's own
 * contract AND the table schema this page belongs to was proven to carry it.
 *
 * The distinction matters enormously and used to be got wrong. Previously
 * this intersected the kind contract with the roles RESOLVED ON THAT PAGE,
 * which quietly conflated two opposite situations:
 *
 *   - the document genuinely has no such column (a budget with no separate
 *     BDI rate) -- the field is not applicable, and a record must not be
 *     penalised for it; and
 *   - the document has the column and this page failed to resolve it -- the
 *     field is EXPECTED AND UNRESOLVED, which is structural insufficiency.
 *
 * Under the old rule the second case silently became the first: the engine's
 * own failure removed the role from the applicable set, nothing was reported
 * missing, and a record carrying none of its economic evidence could be
 * published as "resolved". Expectation therefore comes from the proven
 * header schema family (see BudgetTableSchemaExpectation), never from this
 * page's success at reading it. Where no schema was ever demonstrated for a
 * page, expectation and resolution coincide and behaviour is unchanged.
 */
function applicableSemanticRoles(
  kind: ReconstructedRecordKind,
  pageNumber: number,
  context: RecordFormationContext,
): ReadonlySet<BudgetColumnRole> {
  const base = SEMANTIC_ROLES_BY_KIND[kind];
  if (base === undefined) {
    return new Set();
  }
  const expectation = context.schemaExpectations?.find(
    (candidate) => candidate.pageNumber === pageNumber,
  );
  const expectedRoles = new Set(
    expectation === undefined
      ? context.columns
          .filter((column) => column.pageNumber === pageNumber && column.status === "resolved")
          .map((column) => column.role)
      : expectation.expectedRoles,
  );
  return new Set([...base].filter((role) => expectedRoles.has(role)));
}

/**
 * A grouping row is normally only identity: a group header names a section,
 * it does not price it. But when the grouping row itself carries a
 * consolidated amount in the page's own total_price column, that amount is
 * part of what the document says about THAT record, and losing it would be
 * losing budget. Applicability is therefore extended by positive evidence on
 * the record's own row -- never by a universal rule that every group must
 * show a total, which would invent an obligation the source never made.
 */
function positivelyApplicableAggregateRoles(
  row: ReconstructedLogicalRow,
  kind: ReconstructedRecordKind,
  context: RecordFormationContext,
): ReadonlySet<BudgetColumnRole> {
  if (kind !== "group" && kind !== "subgroup") {
    return new Set();
  }
  /**
   * Positive evidence is that the row's own total_price cell CARRIES A
   * DOCUMENTED AMOUNT -- numeric content, not merely a currency marker on an
   * otherwise blank cell. Keying this on whether the amount successfully
   * parsed would be exactly backwards: a cell holding two sibling amounts the
   * engine failed to separate would drop out of the applicable set and the
   * record would be published as resolved with no total at all. A cell that
   * genuinely shows nothing but "R$" is a blank in the source and stays
   * honestly missing rather than becoming an obligation the document never
   * made.
   */
  const hasDocumentedTotal = cellsForRole(row, "total_price", context).some((cell) =>
    /\d/.test(cellText(cell, context.fragments, context.textItems) ?? ""),
  );
  return hasDocumentedTotal ? new Set<BudgetColumnRole>(["total_price"]) : new Set();
}

/** The single semantic role a description continuation continues. A
 * continuation carries more description text and nothing else; it is not a
 * second economic line. */
const CONTINUED_ROLE: BudgetColumnRole = "description";

/** The roles a record's status must answer for: its kind's contract
 * intersected with the roles its table schema was proven to have, plus any
 * role the record's own row positively documents beyond that contract. */
function recordApplicableRoles(
  row: ReconstructedLogicalRow,
  kind: ReconstructedRecordKind,
  context: RecordFormationContext,
): ReadonlySet<BudgetColumnRole> {
  return new Set([
    ...applicableSemanticRoles(kind, row.pageNumber, context),
    ...positivelyApplicableAggregateRoles(row, kind, context),
  ]);
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
  const applicableRoles = recordApplicableRoles(row, kind, context);
  const baseCellIds = new Set(row.cellIds);
  const continuationCellIds = new Set(continuations.flatMap((candidate) => candidate.cellIds));
  /**
   * A description continuation continues exactly one thing -- the
   * description -- and opens no new obligation of its own. Its cells for
   * every other role are structurally absent because a continuation line has
   * no economic content to show, not because the item failed to state it:
   * the base row already answered for those roles. Folding the continuation's
   * whole cell set into the record's status (as this used to) meant every
   * multi-line description made its own complete item look incomplete.
   */
  const semanticCells = context.cells.filter(
    (cell) =>
      applicableRoles.has(cell.role) &&
      (baseCellIds.has(cell.cellId) ||
        (continuationCellIds.has(cell.cellId) && cell.role === CONTINUED_ROLE)),
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

function schemaFamilyIdFor(
  pageNumber: number,
  context: RecordFormationContext,
): string | null {
  return (
    context.schemaExpectations?.find((candidate) => candidate.pageNumber === pageNumber)
      ?.schemaFamilyId ?? null
  );
}

function pagesHavePositiveContinuity(
  originPage: number,
  targetPage: number,
  context: RecordFormationContext,
): boolean {
  if (targetPage !== originPage + 1) return false;
  /**
   * A repeated header is not a new table. Two consecutive pages that were
   * proven to reconstruct the SAME header schema family are the same table
   * continued, so a group opened on the first page still owns the items that
   * follow on the second. Treating the reprinted header as a boundary broke
   * every hierarchy at every page break: sub-groups of a section became
   * top-level groups of their own the moment the section spilled over.
   */
  const originFamilyId = schemaFamilyIdFor(originPage, context);
  if (originFamilyId !== null && originFamilyId === schemaFamilyIdFor(targetPage, context)) {
    return true;
  }
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

/**
 * The roles a finished record was EXPECTED to carry: its kind's own contract
 * intersected with the roles its page's proven table schema has. Published so
 * completeness can be audited against the schema rather than against whatever
 * the engine happened to manage on the day.
 */
export function expectedRolesForRecord(
  record: ReconstructedBudgetRecord,
  schemaExpectations: ReadonlyArray<BudgetTableSchemaExpectation>,
): ReadonlyArray<BudgetColumnRole> {
  const base = SEMANTIC_ROLES_BY_KIND[record.kind];
  if (base === undefined) return [];
  const expectation = schemaExpectations.find(
    (candidate) => candidate.pageNumber === record.pageNumber,
  );
  if (expectation === undefined) return [];
  return [...base].filter((role) => expectation.expectedRoles.includes(role));
}

/** The roles a finished record actually carries a usable value for. */
export function reconstructedRolesForRecord(
  record: ReconstructedBudgetRecord,
): ReadonlySet<BudgetColumnRole> {
  const roles = new Set<BudgetColumnRole>();
  if (record.itemCode !== null) roles.add("item_code");
  if (record.description !== null) roles.add("description");
  if (record.unit !== null) roles.add("unit");
  if (record.quantity?.status === "resolved") roles.add("quantity");
  if (record.unitCost?.status === "resolved") roles.add("unit_cost");
  if (record.bdiRate?.status === "resolved") roles.add("bdi_rate");
  if (record.unitPrice?.status === "resolved") roles.add("unit_price");
  if (record.totalPrice?.status === "resolved") roles.add("total_price");
  return roles;
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
    /** Continuations whose attribution to THIS row was positively resolved:
     * only these contribute their text to the record's description. */
    const continuations = rows.filter(
      (candidate) =>
        candidate.kind === "description_continuation" &&
        candidate.descriptionSourceRowIds.includes(row.rowId),
    );
    /** Every continuation whose own evidence bears on this record: those
     * attributed to it, plus those that merely NAME it as a possible
     * receiver. When a continuation could belong to two rows, neither row may
     * claim its text -- but neither may pretend the ambiguity does not exist
     * either, so it still contaminates both records' status. */
    const bearingContinuations = rows.filter(
      (candidate) =>
        candidate.kind === "description_continuation" &&
        (candidate.descriptionSourceRowIds.includes(row.rowId) ||
          candidate.continuationCandidateRowIds.includes(row.rowId)),
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
          : recordRelevantStatus(row, bearingContinuations, kind, numericFields, context),
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
