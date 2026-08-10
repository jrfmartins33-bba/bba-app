import type { SelectedHeaderProvenance } from "./budget-table-reconstruction-column-resolution";
import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import { parseNumericEvidence } from "./budget-table-reconstruction-numeric-evidence";
import { headerVocabularyRoles } from "./budget-table-reconstruction-profile";
import { cellText, isCompactCaption } from "./budget-table-reconstruction-text";
import type {
  EvidenceLine,
  EvidenceTextItem,
  ReconstructedCell,
  ReconstructedLogicalRow,
  ReconstructedRowKind,
  SourceFragment,
} from "./budget-table-reconstruction.types";

const ECONOMIC_ROLES = new Set([
  "quantity",
  "unit_cost",
  "bdi_rate",
  "unit_price",
  "total_price",
]);

/**
 * The economic roles that only a DETAILED budget line can carry. A grouping
 * or aggregation row legitimately shows a rolled-up money total and nothing
 * else; it never shows how much of something was priced, at what rate, or at
 * what price per unit. Distinguishing the two by these roles -- rather than
 * by how deep the row's code happens to be -- is what lets a real item stay
 * an item and a real group stay a group.
 */
const DETAIL_ECONOMIC_ROLES = new Set(["quantity", "unit_cost", "bdi_rate", "unit_price"]);

/** A structurally plausible item identity: a single compact token -- a
 * sentence/paragraph geometrically misassigned to item_code always has
 * internal whitespace, this never does -- built only from letters/digits
 * joined by the usual code separators (., -, /), containing at least one
 * digit (every observed item-code convention does; a bare narrative word
 * never does). This is not a validator for every legitimate code format
 * that could ever exist, and deliberately doesn't try to be -- it only
 * needs to reject "a paragraph landed in the item_code column", which the
 * whitespace/digit checks do on their own. The length cap is a backstop,
 * not the primary mechanism. */
const MAX_ITEM_IDENTITY_LENGTH = 24;

export function isPlausibleItemIdentity(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ITEM_IDENTITY_LENGTH) {
    return false;
  }
  if (/\s/.test(trimmed) || !/\d/.test(trimmed)) {
    return false;
  }
  return /^[A-Za-z0-9]+(?:[.\-/][A-Za-z0-9]+)*$/.test(trimmed);
}

/**
 * A cell counts as positive economic-anchor evidence only when its own,
 * individual text is independently interpretable as a number by the same
 * deterministic grammar the rest of the domain already trusts
 * (parseNumericEvidence) -- never a bare /\d/ test, which also matches
 * narrative text that merely contains a digit ("prazo de 8 meses", a
 * hierarchical reference "9.3.2.2", a norm "1234/2020": none of these
 * parse as a number once R$/%/whitespace are stripped, because letters,
 * slashes or extra separators remain). "ambiguous" still counts: it
 * proves the text is a numeric candidate (a single-separator grammar
 * collision), even though its exact value isn't resolved -- membership
 * and value-resolution are different questions, the latter stays the
 * responsibility of numericForRole/recordRelevantStatus in
 * record-classification.ts. "invalid" never counts. A later
 * divergent-source-cells-v1 conflict between multiple cells for the same
 * role (handled in record-classification.ts, not here) does not undo
 * membership either: each individual cell can still be independently a
 * valid economic anchor even when they disagree with each other --
 * membership and value-conflict are different questions too.
 */
export function isEconomicAnchor(
  cell: ReconstructedCell,
  fragments: ReadonlyArray<SourceFragment>,
  textItems: ReadonlyArray<EvidenceTextItem>,
): boolean {
  if (!ECONOMIC_ROLES.has(cell.role)) {
    return false;
  }
  const text = cellText(cell, fragments, textItems);
  if (text === null) {
    return false;
  }
  const evidence = parseNumericEvidence(text, [cell.cellId], cell.fragmentIds, null);
  return evidence.status === "resolved" || evidence.status === "ambiguous";
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** A unit of measurement is a compact symbol, never prose. The length cap is
 * a backstop; the real mechanism is the absence of internal whitespace plus
 * the restricted character set -- exactly the reasoning already used for
 * item identities. */
const MAX_UNIT_TOKEN_LENGTH = 12;

/**
 * Structural plausibility of unit evidence. Previously ANY non-empty text
 * geometrically landing in the unit column counted as a unit, so a document
 * title stretching across several columns turned a metadata line into a
 * budget item purely by overlapping the unit band.
 *
 * A unit is recognised by lexical structure, never by a whitelist of known
 * units (which would silently reject every unit convention not yet seen):
 * a single compact token, containing at least one letter, built only from
 * letters, digits, superscript digits, ordinal marks and the separators
 * that appear inside compound units. Currency and percentage markers
 * disqualify it -- those are amounts, not units -- and so does any internal
 * whitespace or sentence punctuation, which is what every misassigned
 * phrase has and no real unit does. No score, no threshold on "how
 * unit-like" the text is: each condition is a yes/no property of the text
 * itself.
 */
export function isPlausibleUnitEvidence(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_UNIT_TOKEN_LENGTH) {
    return false;
  }
  if (/\s/.test(trimmed)) {
    return false;
  }
  if (/%|R\$|\$|\u20ac/i.test(trimmed)) {
    return false;
  }
  if (!/\p{L}/u.test(trimmed)) {
    return false;
  }
  return /^[\p{L}\d\u00b2\u00b3\u00aa\u00ba\u00b0./-]+$/u.test(trimmed);
}

/** An aggregate row labels itself; it does not narrate. The label/prose
 * distinction is the domain's single shared `isCompactCaption` rule -- the
 * same one that separates a column title from a description that merely
 * reuses a schema word. */
const isCompactLabel = isCompactCaption;

/**
 * Positive aggregate evidence. The previous rule promoted a row to
 * total/subtotal as soon as ANY of its text contained the word "total",
 * which made an aggregate out of a legal note observing that some payment
 * tracks "5% do total da obra", and out of a column title reading
 * "PRE\u00c7O TOTAL R$".
 *
 * An aggregate now has to look like one structurally:
 *
 *   - it carries an aggregate LABEL: a compact caption, not a sentence,
 *     containing the aggregate word as a whole word; and
 *   - it carries an aggregated AMOUNT: a cell in the page's own total_price
 *     column whose text is independently interpretable as a number by the
 *     domain's numeric grammar.
 *
 * Both are required, so prose (label fails) and header titles (amount
 * fails) are excluded without knowing a single phrase of either. Subtotal
 * outranks total because "subtotal" is the more specific claim.
 */
function aggregateKind(
  presentCells: ReadonlyArray<ReconstructedCell>,
  fragments: ReadonlyArray<SourceFragment>,
  textItems: ReadonlyArray<EvidenceTextItem>,
): "subtotal" | "total" | null {
  const hasAggregatedAmount = presentCells.some(
    (cell) => cell.role === "total_price" && isEconomicAnchor(cell, fragments, textItems),
  );
  if (!hasAggregatedAmount) {
    return null;
  }
  let sawTotalLabel = false;
  for (const cell of presentCells) {
    const text = cellText(cell, fragments, textItems);
    if (text === null || !isCompactLabel(text)) continue;
    const normalized = normalize(text);
    if (/\bsubtotal\b/.test(normalized)) return "subtotal";
    if (/\btotal\b/.test(normalized)) sawTotalLabel = true;
  }
  return sawTotalLabel ? "total" : null;
}

/**
 * Positive budget-row membership evidence for service_item: description
 * alone (the previous rule) is not enough, and neither is "some economic
 * role cell contains a digit" -- narrative/legal text routinely contains
 * digits (dates, norm references, hierarchical section numbers, spans of
 * months) without being a budget line. A row must combine description
 * with at least one of three independent, structural evidence paths:
 *
 *   A: a plausible item identity (item_code) + >=1 economic anchor
 *   B: a structural unit + >=1 economic anchor
 *   C: >=2 *distinct* economic-anchor roles (no code/unit needed)
 *
 * Each path requires its own kind of corroboration beyond "a number
 * appeared somewhere" -- identity, structural unit, or plurality of
 * independently-parseable economic roles. No score, no threshold,
 * no percentage: each path is a fixed, auditable minimum combination.
 * Geometry (which column a cell fell into) is necessary to know a
 * cell's role at all, but never sufficient by itself -- every path here
 * still requires the cell's own text to carry genuine numeric evidence
 * (isEconomicAnchor) or a genuine compact identity (isPlausibleItemIdentity).
 */
export function hasPositiveServiceItemMembership(
  presentCells: ReadonlyArray<ReconstructedCell>,
  fragments: ReadonlyArray<SourceFragment>,
  textItems: ReadonlyArray<EvidenceTextItem>,
): boolean {
  const codeCell = presentCells.find((cell) => cell.role === "item_code");
  const codeText = codeCell === undefined ? null : cellText(codeCell, fragments, textItems);
  const hasPlausibleItemIdentity = codeText !== null && isPlausibleItemIdentity(codeText);

  const hasUnit = presentCells.some(
    (cell) =>
      cell.role === "unit" && isPlausibleUnitEvidence(cellText(cell, fragments, textItems) ?? ""),
  );

  const economicAnchorRoles = new Set(
    presentCells
      .filter((cell) => isEconomicAnchor(cell, fragments, textItems))
      .map((cell) => cell.role),
  );
  const hasEconomicAnchor = economicAnchorRoles.size > 0;
  const hasDetailEconomicAnchor = [...economicAnchorRoles].some((role) =>
    DETAIL_ECONOMIC_ROLES.has(role),
  );

  return (
    (hasPlausibleItemIdentity && hasDetailEconomicAnchor) ||
    (hasUnit && hasEconomicAnchor) ||
    economicAnchorRoles.size >= 2
  );
}

/** A row shows detailed pricing when at least one of the per-unit or
 * quantity roles carries genuine numeric evidence of its own. */
function hasDetailEconomicEvidence(
  presentCells: ReadonlyArray<ReconstructedCell>,
  fragments: ReadonlyArray<SourceFragment>,
  textItems: ReadonlyArray<EvidenceTextItem>,
): boolean {
  return presentCells.some(
    (cell) =>
      DETAIL_ECONOMIC_ROLES.has(cell.role) && isEconomicAnchor(cell, fragments, textItems),
  );
}

function lineKind(
  line: EvidenceLine,
  cells: ReadonlyArray<ReconstructedCell>,
  fragments: ReadonlyArray<SourceFragment>,
  textItems: ReadonlyArray<EvidenceTextItem>,
  headerProvenance: SelectedHeaderProvenance,
): ReconstructedRowKind {
  const presentCells = cells.filter((cell) => cell.state !== "missing");

  /**
   * Header membership is decided by the schema that column resolution
   * actually selected, not by re-reading the line's words. A hierarchical
   * header's parent row ("PRE\u00c7O TOTAL R$" alone, spanning three sub-columns)
   * produces only one vocabulary role on its own and used to fall straight
   * through to the aggregate rule -- one phantom Total per page. It is a
   * header because the resolved header block says so, and a proven header
   * line can never become a business record.
   *
   * Where no header block was proven the question was never answered, so
   * the previous per-line reading still applies there rather than silently
   * asserting that the page has no header lines at all.
   */
  if (headerProvenance.pageNumbers.has(line.pageNumber)) {
    if (headerProvenance.lineIds.has(line.lineId)) {
      return "header";
    }
  } else {
    const texts = presentCells
      .map((cell) => normalize(cellText(cell, fragments, textItems) ?? ""))
      .filter((text) => text.length > 0);
    if (new Set(texts.flatMap((text) => headerVocabularyRoles(text))).size >= 2) {
      return "header";
    }
  }

  const aggregate = aggregateKind(presentCells, fragments, textItems);
  if (aggregate !== null) {
    return aggregate;
  }

  const hasDescription = presentCells.some((cell) => cell.role === "description");
  const hasEconomicAnchor = presentCells.some((cell) => isEconomicAnchor(cell, fragments, textItems));
  if (hasDescription && hasPositiveServiceItemMembership(presentCells, fragments, textItems)) {
    return "service_item";
  }

  // A group's own identity anchor is held to the same compactness bar as
  // a service_item's item_code (\u00a717): a paragraph that lands in the
  // item_code column must not be able to manufacture a fake group either.
  // A grouping row may legitimately display its rolled-up money total; what
  // it must not display is DETAILED pricing (quantity, unit cost, BDI rate,
  // unit price), which is the evidence that makes a row an item. Service
  // membership is therefore evaluated first, above, and grouping only
  // afterwards -- a real item is never demoted to a group merely because
  // its economic columns were reconstructed.
  const codeCell = presentCells.find((cell) => cell.role === "item_code");
  const codeText = codeCell === undefined ? null : cellText(codeCell, fragments, textItems);
  const hasPlausibleItemIdentity = codeText !== null && isPlausibleItemIdentity(codeText);
  if (
    hasDescription &&
    hasPlausibleItemIdentity &&
    !hasDetailEconomicEvidence(presentCells, fragments, textItems)
  ) {
    return "group";
  }
  if (
    presentCells.length === 1 &&
    presentCells[0]!.role === "description" &&
    !hasEconomicAnchor
  ) {
    return "description_continuation";
  }
  return "unclassified";
}

function descriptionFor(
  cells: ReadonlyArray<ReconstructedCell>,
  fragments: ReadonlyArray<SourceFragment>,
  textItems: ReadonlyArray<EvidenceTextItem>,
): string | null {
  const description = cells
    .filter((cell) => cell.role === "description" && cell.state !== "missing")
    .map((cell) => cellText(cell, fragments, textItems))
    .filter((value): value is string => value !== null)
    .join(" ")
    .trim();
  return description.length === 0 ? null : description;
}

function eligibleContinuationReceivers(
  rows: ReadonlyArray<ReconstructedLogicalRow>,
  continuationIndex: number,
  cells: ReadonlyArray<ReconstructedCell>,
): ReadonlyArray<ReconstructedLogicalRow> {
  const continuation = rows[continuationIndex]!;
  const immediate = rows[continuationIndex - 1];
  if (
    immediate === undefined ||
    immediate.pageNumber !== continuation.pageNumber ||
    (immediate.kind !== "service_item" && immediate.kind !== "group")
  ) return [];

  const rowCells = (row: ReconstructedLogicalRow) => {
    const ids = new Set(row.cellIds);
    return cells.filter((cell) => ids.has(cell.cellId) && cell.role === "description");
  };
  const continuationCells = rowCells(continuation);
  const physicallyEquivalent = rows
    .slice(0, continuationIndex - 1)
    .reverse()
    .find((candidate) => {
      if (
        candidate.pageNumber !== continuation.pageNumber ||
        (candidate.kind !== "service_item" && candidate.kind !== "group")
      ) return false;
      return rowCells(candidate).some((candidateCell) =>
        continuationCells.some(
          (continuationCell) =>
            candidateCell.sourceSegmentIds.some((id) =>
              continuationCell.sourceSegmentIds.includes(id),
            ) ||
            candidateCell.upstreamCellHypothesisIds.some((id) =>
              continuationCell.upstreamCellHypothesisIds.includes(id),
            ),
        ),
      );
    });
  return physicallyEquivalent === undefined ? [immediate] : [immediate, physicallyEquivalent];
}

export function formLogicalRows(
  lines: ReadonlyArray<EvidenceLine>,
  cells: ReadonlyArray<ReconstructedCell>,
  fragments: ReadonlyArray<SourceFragment>,
  textItems: ReadonlyArray<EvidenceTextItem>,
  headerProvenance: SelectedHeaderProvenance = { lineIds: new Set(), pageNumbers: new Set() },
): ReadonlyArray<ReconstructedLogicalRow> {
  const rows = [...lines].map((line): ReconstructedLogicalRow => {
      const lineCells = cells.filter((cell) => cell.lineId === line.lineId);
      const kind = lineKind(line, lineCells, fragments, textItems, headerProvenance);
      return {
        rowId: `row:${fingerprintCanonical({ locatorId: line.locatorId })}`,
        pageNumber: line.pageNumber,
        locatorId: line.locatorId,
        kind,
        status:
          kind === "unclassified"
            ? "insufficient_evidence"
            : lineCells.some((cell) => cell.state === "ambiguous")
              ? "ambiguous"
              : "resolved",
        cellIds: lineCells.map((cell) => cell.cellId).sort(),
        description: descriptionFor(lineCells, fragments, textItems),
        descriptionSourceRowIds: [],
        continuationCandidateRowIds: [],
      };
  });

  return rows.map((row, index) => {
    if (row.kind !== "description_continuation") {
      return row;
    }
    const receivers = eligibleContinuationReceivers(rows, index, cells);
    return {
      ...row,
      status:
        receivers.length === 1
          ? "resolved"
          : receivers.length > 1
            ? "ambiguous"
            : "insufficient_evidence",
      descriptionSourceRowIds: receivers.length === 1 ? [receivers[0]!.rowId] : [],
      continuationCandidateRowIds: receivers.map((receiver) => receiver.rowId),
    };
  });
}
