import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import type { EvidenceGraph } from "./budget-table-reconstruction-evidence-graph";
import {
  addExact,
  equalExact,
  multiplyExact,
  rational,
} from "./budget-table-reconstruction-exact-rational";
import { parseNumericEvidence } from "./budget-table-reconstruction-numeric-evidence";
import {
  headerPathRoles,
  headerVocabularyRoles,
  normalizeBudgetHeaderText,
} from "./budget-table-reconstruction-profile";
import { isCompactCaption } from "./budget-table-reconstruction-text";
import type {
  BudgetColumnRole,
  BudgetTableReconstructionInput,
  BudgetTableSchemaExpectation,
  EvidenceLine,
  EvidenceSegment,
  ResolvedColumn,
  StructuralLocator,
} from "./budget-table-reconstruction.types";

/**
 * HeaderAtom = one physical header text box (one EvidenceTextItem), never a
 * concatenated segment. HeaderPath = a leaf atom plus its vertically-stacked
 * ancestor atoms, discovered only from positively observed horizontal
 * coverage between consecutive header lines -- no tolerance, no invented
 * geometry.
 */
interface HeaderAtom {
  readonly textItemEvidenceId: string;
  readonly locatorId: string;
  readonly lineId: string;
  readonly pageNumber: number;
  readonly verticalOrder: number;
  readonly rawText: string;
  readonly normalizedText: string;
  readonly leftPoints: number;
  readonly rightPoints: number;
}

interface HeaderPath {
  readonly headerPathId: string;
  readonly pageNumber: number;
  readonly atomIds: ReadonlyArray<string>;
  readonly atomLocatorIds: ReadonlyArray<string>;
  readonly atomLineIds: ReadonlyArray<string>;
  /** The leaf's semantic band: the horizontal extent of the data column this
   * leaf governs, never merely the width of its own label. */
  readonly leftPoints: number;
  readonly rightPoints: number;
  /** The leaf label's own observed text box, kept separately so band
   * widening can always be audited against the raw evidence it started
   * from. */
  readonly labelLeftPoints: number;
  readonly labelRightPoints: number;
  readonly bandWidened: boolean;
  readonly leafText: string;
  readonly parentTexts: ReadonlyArray<string>;
  readonly candidateRoles: ReadonlyArray<BudgetColumnRole>;
}

interface HorizontalRange {
  readonly leftPoints: number;
  readonly rightPoints: number;
}

interface RawColumnBand {
  readonly pageNumber: number;
  readonly physicalColumnHypothesisId: string;
  readonly regionId: string;
  readonly leftPoints: number;
  readonly rightPoints: number;
  readonly lineIds: ReadonlyArray<string>;
  readonly segmentIds: ReadonlyArray<string>;
  readonly evidenceLocatorIds: ReadonlyArray<string>;
  readonly headerEvidenceLocatorIds: ReadonlyArray<string>;
  readonly headerAtomIds: ReadonlyArray<string>;
  readonly candidateRoles: ReadonlyArray<BudgetColumnRole>;
}

interface CanonicalBand {
  readonly pageNumber: number;
  readonly horizontalOrder: number;
  readonly leftPoints: number;
  readonly rightPoints: number;
  readonly candidateRoles: ReadonlyArray<BudgetColumnRole>;
  readonly evidenceLocatorIds: ReadonlyArray<string>;
  readonly sourcePhysicalColumnHypothesisIds: ReadonlyArray<string>;
  readonly contributingRegionIds: ReadonlyArray<string>;
  readonly contributingLineIds: ReadonlyArray<string>;
  readonly contributingSegmentIds: ReadonlyArray<string>;
  readonly groupingRuleId: ResolvedColumn["groupingRuleId"];
  readonly representativePhysicalColumnHypothesisId: string | null;
  readonly nonGroupingReasonCodes: ReadonlyArray<string>;
  readonly bandProvenance: ResolvedColumn["bandProvenance"];
  readonly headerAtomIds: ReadonlyArray<string>;
  readonly splitReasonCode: string | null;
}

interface HeaderCandidate {
  readonly lineId: string;
  readonly roles: ReadonlyArray<BudgetColumnRole>;
}

const ECONOMIC_NUMBER_ROLES: ReadonlyArray<BudgetColumnRole> = [
  "unit_cost",
  "bdi_rate",
  "unit_price",
  "total_price",
];

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSorted(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...new Set(values)].sort(ordinalCompare);
}

function uniqueSortedRoles(
  values: ReadonlyArray<BudgetColumnRole>,
): ReadonlyArray<BudgetColumnRole> {
  return [...new Set(values)].sort(ordinalCompare) as ReadonlyArray<BudgetColumnRole>;
}

function sameStrings(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasEconomicLiteral(text: string): boolean {
  const trimmed = text.trim();
  if (/^[+-]?\d+(?:[.,]\d+)?%?$/.test(trimmed)) return true;
  return /\d/.test(text) && /(?:[.,]\d|%|R\$)/i.test(text);
}

function locatorFor(graph: EvidenceGraph, locatorId: string): StructuralLocator | null {
  return graph.locatorCatalog.get(locatorId);
}

function lineVerticalOrder(graph: EvidenceGraph, line: EvidenceLine): number {
  return locatorFor(graph, line.locatorId)?.lineVerticalOrder ?? 0;
}

function boundsForLocatorId(
  graph: EvidenceGraph,
  locatorId: string,
): readonly [number, number] | null {
  const locator = locatorFor(graph, locatorId);
  return locator?.bounds == null ? null : [locator.bounds[0], locator.bounds[2]];
}

function boundsForSegment(
  graph: EvidenceGraph,
  segment: EvidenceSegment,
): readonly [number, number] | null {
  return boundsForLocatorId(graph, segment.locatorId);
}

function segmentIntersects(
  graph: EvidenceGraph,
  segment: EvidenceSegment,
  leftPoints: number,
  rightPoints: number,
): boolean {
  const bounds = boundsForSegment(graph, segment);
  return bounds !== null && bounds[0] < rightPoints && bounds[1] > leftPoints;
}

function rangesPositivelyOverlap(
  leftA: number,
  rightA: number,
  leftB: number,
  rightB: number,
): boolean {
  return leftA < rightB && leftB < rightA;
}

/**
 * Legacy line-level header detector. Kept only to populate
 * ResolvedColumn.headerLineIds (an existing, already-consumed field) and the
 * public `detectBudgetHeaderCandidates` diagnostic export. Semantic role
 * resolution no longer depends on this -- see buildHeaderPaths below.
 */
function headerCandidates(graph: EvidenceGraph, pageNumber: number): ReadonlyArray<HeaderCandidate> {
  const candidates: HeaderCandidate[] = [];
  for (const line of graph.lines.filter((candidate) => candidate.pageNumber === pageNumber)) {
    const segments = graph.segments.filter((segment) => segment.lineId === line.lineId);
    const roles = uniqueSorted(
      segments.flatMap((segment) => headerVocabularyRoles(segment.rawText)),
    ) as ReadonlyArray<BudgetColumnRole>;
    if (roles.length >= 2 && !segments.some((segment) => hasEconomicLiteral(segment.rawText))) {
      candidates.push({ lineId: line.lineId, roles });
    }
  }
  return candidates;
}

/**
 * A line makes a positive HEADER statement only when one of its own physical
 * text boxes is a compact caption that carries a header vocabulary term.
 *
 * The compactness requirement is what separates a column title from prose
 * that merely reuses a schema word. A service description ending in a rate
 * annotation carries no digits of its own, sits directly under the real
 * header, and satisfied a bare vocabulary test -- so it was absorbed into the
 * header block as an extra generation, turned the description caption above
 * it into its "parent", and cost that page both its description column and
 * its rate column. Testing the individual text box rather than the merged
 * segment matters for the same reason: captioning happens per box, and a
 * segment that merges several captions is not itself prose.
 */
function lineHasVocabularyHit(
  graph: EvidenceGraph,
  line: EvidenceLine,
  textItemById: ReadonlyMap<string, EvidenceGraph["textItems"][number]>,
): boolean {
  return line.textItemEvidenceIds.some((textItemId) => {
    const item = textItemById.get(textItemId);
    if (item === undefined) return false;
    return isCompactCaption(item.rawText) && headerVocabularyRoles(item.rawText).length > 0;
  });
}

function lineHasEconomicLiteral(graph: EvidenceGraph, line: EvidenceLine): boolean {
  const items = line.textItemEvidenceIds
    .map((id) => graph.textItems.find((candidate) => candidate.evidenceId === id))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);
  return items.length === 0 || items.some((item) => hasEconomicLiteral(item.rawText));
}

const IDENTITY_ROLES: ReadonlySet<BudgetColumnRole> = new Set(["item_code", "description"]);
const CONTENT_ROLES: ReadonlySet<BudgetColumnRole> = new Set([
  "unit",
  "quantity",
  "unit_cost",
  "bdi_rate",
  "unit_price",
  "total_price",
]);

interface HeaderBlockCandidate {
  readonly lines: ReadonlyArray<EvidenceLine>;
  readonly paths: ReadonlyArray<HeaderPath>;
  readonly roleSet: ReadonlySet<BudgetColumnRole>;
}

function hasTwoNonOverlappingPaths(paths: ReadonlyArray<HeaderPath>): boolean {
  for (let left = 0; left < paths.length; left += 1) {
    for (let right = left + 1; right < paths.length; right += 1) {
      if (
        !rangesPositivelyOverlap(
          paths[left]!.leftPoints,
          paths[left]!.rightPoints,
          paths[right]!.leftPoints,
          paths[right]!.rightPoints,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * A candidate run only counts as a genuine tabular budget header -- not a
 * document metadata/title block that happens to reuse a vocabulary word as
 * a field label (e.g. "Descrição:" naming the project) -- when it
 * demonstrates, via physically distinct EvidenceTextItems, at least two
 * horizontally non-overlapping leaf paths, at least two distinct semantic
 * roles, and a combination of at least one IDENTITY role (item_code or
 * description) with at least one CONTENT role (unit/quantity/unit_cost/
 * bdi_rate/unit_price/total_price). This is a discrete structural
 * condition -- set membership and counting -- never a score or threshold.
 */
function qualifiesAsBudgetHeaderBlock(candidate: HeaderBlockCandidate): boolean {
  if (candidate.roleSet.size < 2) return false;
  if (!hasTwoNonOverlappingPaths(candidate.paths)) return false;
  let hasIdentity = false;
  let hasContent = false;
  for (const role of candidate.roleSet) {
    if (IDENTITY_ROLES.has(role)) hasIdentity = true;
    if (CONTENT_ROLES.has(role)) hasContent = true;
  }
  return hasIdentity && hasContent;
}

function isStrictSuperset(
  left: ReadonlySet<BudgetColumnRole>,
  right: ReadonlySet<BudgetColumnRole>,
): boolean {
  if (left.size <= right.size) return false;
  for (const role of right) {
    if (!left.has(role)) return false;
  }
  return true;
}

/**
 * Real documents carry front matter above the table -- running headers,
 * page numbers, report titles, or a metadata block naming the project --
 * that is not itself part of any economic column and can contain bare
 * numbers (a page number, a date, a percentage caption unrelated to the
 * table). Assuming the header starts at the first line of the page, or
 * accepting the first run that merely contains any vocabulary word, both
 * truncate the block before the real table header is reached: a metadata
 * label like "Descrição:" naming the project satisfies a bare
 * vocabulary-hit check without being a table header at all.
 *
 * Instead: partition the page into maximal contiguous runs of lines with no
 * economic literal (unchanged), but qualify each run using the structural
 * signature in `qualifiesAsBudgetHeaderBlock` rather than a bare
 * vocabulary-hit check. If exactly one run qualifies, select it. If several
 * qualify, select the one whose role set is a strict superset of every
 * other qualifying run's role set (unambiguous semantic dominance); if no
 * single run dominates all the others, the candidates are genuinely
 * incomparable and no block is selected -- never resolved by position,
 * width, atom count, or any other tie-break.
 */
function headerBlockCandidates(
  graph: EvidenceGraph,
  pageNumber: number,
): ReadonlyArray<HeaderBlockCandidate> {
  const pageLines = [...graph.lines.filter((line) => line.pageNumber === pageNumber)].sort(
    (left, right) => lineVerticalOrder(graph, left) - lineVerticalOrder(graph, right),
  );

  const runs: EvidenceLine[][] = [];
  let current: EvidenceLine[] = [];
  for (const line of pageLines) {
    if (lineHasEconomicLiteral(graph, line)) {
      if (current.length > 0) runs.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) runs.push(current);

  const textItemById = new Map(graph.textItems.map((item) => [item.evidenceId, item]));
  return runs
    .flatMap((run) => headerSignatureSubRuns(graph, run, textItemById))
    .map((run) => {
      const paths = buildHeaderPathsForLines(graph, pageNumber, run);
      const roleSet = new Set(
        paths.flatMap((path) => path.candidateRoles).filter((role) => role !== "unknown"),
      );
      return { lines: run, paths, roleSet };
    });
}

/**
 * "No economic literal on the line" is necessary to be inside a header block
 * but nowhere near sufficient: a service description carries no currency or
 * percentage of its own, a bare auxiliary reference code carries no decimal
 * separator, and a one-word metadata caption carries nothing at all.
 * Every one of those sits immediately above or below a real multi-line
 * header and was therefore being absorbed into the same run, which is how
 * body text became header evidence: its text items turned into HeaderAtoms,
 * widened the block's apparent vocabulary, and (worse) inserted a spurious
 * generation between a parent label and its real qualifier row.
 *
 * A line only belongs to a header block when it makes a positive header
 * statement of its own -- at least one of its segments carries a header
 * vocabulary term. Runs are therefore split into their maximal contiguous
 * sub-runs of such lines. This is set membership over the profile
 * vocabulary, not a score, a position, or a text blacklist: a data line is
 * excluded because it says nothing about the schema, never because of what
 * it happens to say.
 */
function headerSignatureSubRuns(
  graph: EvidenceGraph,
  run: ReadonlyArray<EvidenceLine>,
  textItemById: ReadonlyMap<string, EvidenceGraph["textItems"][number]>,
): ReadonlyArray<ReadonlyArray<EvidenceLine>> {
  const subRuns: EvidenceLine[][] = [];
  let current: EvidenceLine[] = [];
  for (const line of run) {
    if (lineHasVocabularyHit(graph, line, textItemById)) {
      current.push(line);
      continue;
    }
    if (current.length > 0) subRuns.push(current);
    current = [];
  }
  if (current.length > 0) subRuns.push(current);
  return subRuns;
}

function selectBudgetHeaderBlock(
  candidates: ReadonlyArray<HeaderBlockCandidate>,
): ReadonlyArray<EvidenceLine> {
  const qualifying = candidates.filter(qualifiesAsBudgetHeaderBlock);
  if (qualifying.length === 0) return [];
  if (qualifying.length === 1) return qualifying[0]!.lines;

  const dominant = qualifying.filter((candidate) =>
    qualifying
      .filter((other) => other !== candidate)
      .every((other) => isStrictSuperset(candidate.roleSet, other.roleSet)),
  );
  return dominant.length === 1 ? dominant[0]!.lines : [];
}

function headerBlockLines(graph: EvidenceGraph, pageNumber: number): ReadonlyArray<EvidenceLine> {
  return selectBudgetHeaderBlock(headerBlockCandidates(graph, pageNumber));
}

function atomsForLine(graph: EvidenceGraph, line: EvidenceLine): ReadonlyArray<HeaderAtom> {
  const order = lineVerticalOrder(graph, line);
  const atoms: HeaderAtom[] = [];
  for (const textItemId of line.textItemEvidenceIds) {
    const item = graph.textItems.find((candidate) => candidate.evidenceId === textItemId);
    if (item === undefined || item.rawText.trim().length === 0) continue;
    const bounds = boundsForLocatorId(graph, item.locatorId);
    if (bounds === null) continue;
    atoms.push({
      textItemEvidenceId: item.evidenceId,
      locatorId: item.locatorId,
      lineId: line.lineId,
      pageNumber: line.pageNumber,
      verticalOrder: order,
      rawText: item.rawText,
      normalizedText: normalizeBudgetHeaderText(item.rawText),
      leftPoints: bounds[0],
      rightPoints: bounds[1],
    });
  }
  return atoms.sort((left, right) => left.leftPoints - right.leftPoints);
}

function atomsPositivelyOverlap(left: HeaderAtom, right: HeaderAtom): boolean {
  return rangesPositivelyOverlap(left.leftPoints, left.rightPoints, right.leftPoints, right.rightPoints);
}

/**
 * The horizontal intervals of every EvidenceTextItem that belongs to the
 * page's BODY: a line that is not part of the header block and that follows
 * it in document order (§ document order, never a fixed coordinate and never
 * a fraction of the page). Body text is used here purely as GEOMETRIC
 * evidence of where the document's columns physically are. It never becomes
 * a HeaderAtom, never joins a HeaderPath, and never contributes a single
 * vocabulary term -- header semantics stay sealed inside the header block.
 */
function bodyTextIntervals(
  graph: EvidenceGraph,
  pageNumber: number,
  block: ReadonlyArray<EvidenceLine>,
  textItemById: ReadonlyMap<string, EvidenceGraph["textItems"][number]>,
): ReadonlyArray<HorizontalRange> {
  if (block.length === 0) return [];
  const blockLineIds = new Set(block.map((line) => line.lineId));
  const lastHeaderOrder = block.reduce(
    (highest, line) => Math.max(highest, lineVerticalOrder(graph, line)),
    Number.NEGATIVE_INFINITY,
  );

  const intervals: HorizontalRange[] = [];
  for (const line of graph.lines) {
    if (line.pageNumber !== pageNumber) continue;
    if (blockLineIds.has(line.lineId)) continue;
    if (lineVerticalOrder(graph, line) <= lastHeaderOrder) continue;
    for (const textItemId of line.textItemEvidenceIds) {
      const item = textItemById.get(textItemId);
      if (item === undefined || item.rawText.trim().length === 0) continue;
      const bounds = boundsForLocatorId(graph, item.locatorId);
      if (bounds === null || !(bounds[0] < bounds[1])) continue;
      intervals.push({ leftPoints: bounds[0], rightPoints: bounds[1] });
    }
  }
  return intervals;
}

/**
 * A header atom's OBSERVED BAND: its own label box, extended over every body
 * text item that positively overlaps it and overlaps none of its siblings on
 * the same header line.
 *
 * Two independent defects are fixed by this single construction.
 *
 * First, a label is almost never as wide as the column it names: the word
 * "DESCRIÇÃO" occupies a fraction of the description column, and a
 * right-aligned "QTD" sits to the left of the digits beneath it. Treating
 * the label box as the semantic band silently drops every value whose own
 * box happens to start past the label's right edge -- the value is not
 * ambiguous, it is simply never seen.
 *
 * Second, a hierarchical parent label ("PREÇO TOTAL R$" centered over three
 * sub-columns) frequently fails to overlap its own outer children, so
 * parent/child linkage by label overlap cannot see the relation that a human
 * reader takes for granted. The parent's observed band does reach them,
 * because the parent's band is the union of the data it governs.
 *
 * The sibling-exclusivity condition is what keeps this honest. A full-width
 * narrative paragraph beneath the table overlaps every atom on the line, so
 * it is excluded from all of them and cannot collapse the page into one
 * band. Nothing here is a tolerance, a margin, or a proportion: an interval
 * either positively overlaps exactly one atom of the line or it is not
 * evidence for that line at all.
 *
 * Finally, the bands of one header line must be mutually disjoint -- that is
 * what makes them columns. A collision means the geometry did not in fact
 * demonstrate a partition THERE, so the widening that produced it is
 * withdrawn -- but only for the atoms actually involved. Reverting the whole
 * line, as this used to, let one auxiliary column's accidental reach destroy
 * every other column on the line, including the description band, and with
 * it every row whose description happened to start left of the label.
 *
 * Which side withdraws is decided structurally, never by preference: an
 * atom that the profile positively identifies with a semantic role (see
 * semanticallyIdentifiedAtomIds) is making a documented claim about a
 * column; an atom it does not identify is auxiliary evidence making no such
 * claim. When exactly one side of a collision is semantic, the auxiliary
 * side falls back to its own label box -- its evidence is preserved, never
 * discarded, it simply stops asserting an extent the header never named.
 * When both sides are semantic, or neither is, there is nothing to
 * distinguish them and both fall back, exactly as before. The loop runs to a
 * fixpoint so a fallback that exposes a further collision is resolved too.
 */
function observedAtomBands(
  atoms: ReadonlyArray<HeaderAtom>,
  bodyIntervals: ReadonlyArray<HorizontalRange>,
  semanticAtomIds: ReadonlySet<string>,
): ReadonlyMap<string, HorizontalRange> {
  const labelRangeOf = (atom: HeaderAtom): HorizontalRange => ({
    leftPoints: atom.leftPoints,
    rightPoints: atom.rightPoints,
  });

  const widenedBands = new Map<string, HorizontalRange>();
  for (const atom of atoms) {
    let leftPoints = atom.leftPoints;
    let rightPoints = atom.rightPoints;
    for (const interval of bodyIntervals) {
      if (!rangesPositivelyOverlap(atom.leftPoints, atom.rightPoints, interval.leftPoints, interval.rightPoints)) {
        continue;
      }
      const claimedBySibling = atoms.some(
        (sibling) =>
          sibling.textItemEvidenceId !== atom.textItemEvidenceId &&
          rangesPositivelyOverlap(
            sibling.leftPoints,
            sibling.rightPoints,
            interval.leftPoints,
            interval.rightPoints,
          ),
      );
      if (claimedBySibling) continue;
      leftPoints = Math.min(leftPoints, interval.leftPoints);
      rightPoints = Math.max(rightPoints, interval.rightPoints);
    }
    widenedBands.set(atom.textItemEvidenceId, { leftPoints, rightPoints });
  }

  const withdrawnAtomIds = new Set<string>();
  const bandOf = (atom: HeaderAtom): HorizontalRange =>
    withdrawnAtomIds.has(atom.textItemEvidenceId)
      ? labelRangeOf(atom)
      : widenedBands.get(atom.textItemEvidenceId) ?? labelRangeOf(atom);

  for (let round = 0; round <= atoms.length; round += 1) {
    let withdrewThisRound = false;
    for (const left of atoms) {
      for (const right of atoms) {
        if (left.textItemEvidenceId >= right.textItemEvidenceId) continue;
        const leftBand = bandOf(left);
        const rightBand = bandOf(right);
        if (
          !rangesPositivelyOverlap(
            leftBand.leftPoints,
            leftBand.rightPoints,
            rightBand.leftPoints,
            rightBand.rightPoints,
          )
        ) {
          continue;
        }
        const leftIsSemantic = semanticAtomIds.has(left.textItemEvidenceId);
        const rightIsSemantic = semanticAtomIds.has(right.textItemEvidenceId);
        const withdrawing =
          leftIsSemantic === rightIsSemantic ? [left, right] : leftIsSemantic ? [right] : [left];
        for (const atom of withdrawing) {
          if (withdrawnAtomIds.has(atom.textItemEvidenceId)) continue;
          withdrawnAtomIds.add(atom.textItemEvidenceId);
          withdrewThisRound = true;
        }
      }
    }
    if (!withdrewThisRound) break;
  }

  return new Map(atoms.map((atom) => [atom.textItemEvidenceId, bandOf(atom)]));
}

/**
 * The atoms of a header block that the profile positively identifies with a
 * semantic role, read atom by atom, after the same explicit-item-identity
 * specificity rule page-level resolution already applies (see
 * resolveItemIdentitySpecificity): when exactly one atom of the block spells
 * out item identity explicitly, every other generic identifier atom stops
 * competing for item_code and, having no other role of its own, makes no
 * semantic claim at all.
 *
 * This is the structural difference between AUXILIARY WIDE EVIDENCE and a
 * SEMANTIC BODY BAND. It is decided from profile vocabulary membership only
 * -- never from a particular column name, never from a position, a width, or
 * a count.
 */
function semanticallyIdentifiedAtomIds(atoms: ReadonlyArray<HeaderAtom>): ReadonlySet<string> {
  const rolesByAtomId = new Map<string, ReadonlyArray<BudgetColumnRole>>(
    atoms.map((atom) => [
      atom.textItemEvidenceId,
      headerPathRoles([atom.normalizedText]) as ReadonlyArray<BudgetColumnRole>,
    ]),
  );
  const identifierAtoms = atoms.filter((atom) =>
    rolesByAtomId.get(atom.textItemEvidenceId)!.includes("item_code"),
  );
  const explicitIdentifierAtoms = identifierAtoms.filter((atom) =>
    /\bitem\b/.test(atom.normalizedText),
  );
  if (explicitIdentifierAtoms.length === 1) {
    const explicitAtomId = explicitIdentifierAtoms[0]!.textItemEvidenceId;
    for (const atom of identifierAtoms) {
      if (atom.textItemEvidenceId === explicitAtomId) continue;
      rolesByAtomId.set(
        atom.textItemEvidenceId,
        rolesByAtomId.get(atom.textItemEvidenceId)!.filter((role) => role !== "item_code"),
      );
    }
  }
  return new Set(
    atoms
      .filter((atom) => rolesByAtomId.get(atom.textItemEvidenceId)!.length > 0)
      .map((atom) => atom.textItemEvidenceId),
  );
}

function rangeContains(outer: HorizontalRange, inner: HorizontalRange): boolean {
  return outer.leftPoints <= inner.leftPoints && outer.rightPoints >= inner.rightPoints;
}

/**
 * Builds one HeaderPath per leaf HeaderAtom on the page's header block.
 *
 * Ancestry is established in two ordered passes, both positive, neither
 * resolved by a nearest/narrowest/score tie-break.
 *
 * Pass 1 -- observed containment. A child belongs to a parent when the
 * child's own label box lies inside the parent's OBSERVED band (see
 * observedAtomBands) and the parent sits on a strictly higher header line.
 * When several ancestors contain it, the innermost one wins -- the candidate
 * whose band is contained in every other candidate's band -- which is
 * ordinary tree nesting, not a preference; if no single candidate is
 * innermost, the atom is left for pass 2. This pass sees relations that
 * label overlap cannot: parents two or more lines above their qualifier
 * row, and centered parents narrower than their own outer children.
 *
 * Pass 2 -- label overlap on the immediately preceding line, the original
 * rule, applied only to atoms pass 1 left unparented. It still resolves the
 * stacked-label case ("PREÇO" over "TOTAL" over one column), where parent
 * and child govern exactly the same data and containment therefore proves
 * nothing. Exactly one overlapping candidate is required, as before.
 *
 * A parent atom never becomes a column of its own: it is excluded from the
 * leaf set both when some atom was actually linked to it and when any atom
 * on the next line merely overlaps it (an unresolved three-way overlap must
 * not let a parent fall back to being treated as its own column).
 *
 * Each surviving leaf carries its observed band as its geometry, so a leaf
 * spans the data it governs rather than the width of its label. If two
 * leaves' bands positively overlap -- which would mean one documented value
 * could be claimed by two different semantic columns at once -- both revert
 * to their raw label boxes instead of one being preferred.
 */
type HeaderAtomPosition = string;

/** A header atom's STRUCTURAL identity inside its block: which header line it
 * sits on and its left-to-right rank on that line. Two pages that repeat the
 * same table header repeat these positions exactly, whatever their page
 * numbers or their absolute coordinates happen to be. */
function headerAtomPosition(lineIndex: number, atomIndex: number): HeaderAtomPosition {
  return `${lineIndex}:${atomIndex}`;
}

interface HeaderBlockGeometry {
  readonly pageNumber: number;
  readonly atomsByLine: ReadonlyArray<ReadonlyArray<HeaderAtom>>;
  readonly allAtoms: ReadonlyArray<HeaderAtom>;
  readonly positionByAtomId: ReadonlyMap<string, HeaderAtomPosition>;
  readonly atomByPosition: ReadonlyMap<HeaderAtomPosition, HeaderAtom>;
  readonly bandByAtomId: ReadonlyMap<string, HorizontalRange>;
  /** The structural signature of the block: per line, left to right, the
   * normalized text of each atom. Text and ordering only -- never a
   * coordinate, never a page number. */
  readonly signature: ReadonlyArray<ReadonlyArray<string>>;
}

function labelRangeOfAtom(atom: HeaderAtom): HorizontalRange {
  return { leftPoints: atom.leftPoints, rightPoints: atom.rightPoints };
}

function buildHeaderBlockGeometry(
  graph: EvidenceGraph,
  pageNumber: number,
  block: ReadonlyArray<EvidenceLine>,
): HeaderBlockGeometry | null {
  if (block.length === 0) return null;
  const textItemById = new Map(graph.textItems.map((item) => [item.evidenceId, item]));
  const bodyIntervals = bodyTextIntervals(graph, pageNumber, block, textItemById);
  const atomsByLine = block.map((line) => atomsForLine(graph, line));
  const allAtoms = atomsByLine.flat();
  const semanticAtomIds = semanticallyIdentifiedAtomIds(allAtoms);

  const positionByAtomId = new Map<string, HeaderAtomPosition>();
  const atomByPosition = new Map<HeaderAtomPosition, HeaderAtom>();
  const bandByAtomId = new Map<string, HorizontalRange>();
  for (const [lineIndex, atoms] of atomsByLine.entries()) {
    for (const [atomIndex, atom] of atoms.entries()) {
      const position = headerAtomPosition(lineIndex, atomIndex);
      positionByAtomId.set(atom.textItemEvidenceId, position);
      atomByPosition.set(position, atom);
    }
    for (const [atomId, band] of observedAtomBands(atoms, bodyIntervals, semanticAtomIds)) {
      bandByAtomId.set(atomId, band);
    }
  }

  return {
    pageNumber,
    atomsByLine,
    allAtoms,
    positionByAtomId,
    atomByPosition,
    bandByAtomId,
    signature: atomsByLine.map((atoms) => atoms.map((atom) => atom.normalizedText)),
  };
}

interface HeaderBlockAncestry {
  readonly parentByPosition: ReadonlyMap<HeaderAtomPosition, HeaderAtomPosition>;
  readonly positionsWithOverlappingChild: ReadonlySet<HeaderAtomPosition>;
}

/**
 * Ancestry OBSERVED on one page, in two ordered passes, both positive,
 * neither resolved by a nearest/narrowest/score tie-break.
 *
 * Pass 1 -- observed containment. A child belongs to a parent when the
 * child's own label box lies inside the parent's OBSERVED band (see
 * observedAtomBands) and the parent sits on a strictly higher header line.
 * When several ancestors contain it, the innermost one wins -- the candidate
 * whose band is contained in every other candidate's band -- which is
 * ordinary tree nesting, not a preference; if no single candidate is
 * innermost, the atom is left for pass 2.
 *
 * Pass 2 -- label overlap on the immediately preceding line, applied only to
 * atoms pass 1 left unparented. It resolves the stacked-label case ("PREÇO"
 * over "TOTAL" over one column), where parent and child govern exactly the
 * same data and containment therefore proves nothing. Exactly one
 * overlapping candidate is required.
 */
function observeHeaderBlockAncestry(geometry: HeaderBlockGeometry): HeaderBlockAncestry {
  const { atomsByLine, allAtoms, positionByAtomId, bandByAtomId } = geometry;
  const bandOf = (atom: HeaderAtom): HorizontalRange =>
    bandByAtomId.get(atom.textItemEvidenceId) ?? labelRangeOfAtom(atom);
  const lineIndexOf = (atom: HeaderAtom): number =>
    Number(positionByAtomId.get(atom.textItemEvidenceId)!.split(":")[0]);

  const parentByPosition = new Map<HeaderAtomPosition, HeaderAtomPosition>();
  for (const child of allAtoms) {
    const childLineIndex = lineIndexOf(child);
    if (childLineIndex === 0) continue;
    const containing = allAtoms.filter(
      (candidate) =>
        lineIndexOf(candidate) < childLineIndex &&
        rangeContains(bandOf(candidate), labelRangeOfAtom(child)),
    );
    if (containing.length === 0) continue;
    const innermost = containing.filter(
      (candidate) =>
        !containing.some(
          (other) =>
            other.textItemEvidenceId !== candidate.textItemEvidenceId &&
            rangeContains(bandOf(candidate), bandOf(other)) &&
            !rangeContains(bandOf(other), bandOf(candidate)),
        ),
    );
    if (innermost.length === 1) {
      parentByPosition.set(
        positionByAtomId.get(child.textItemEvidenceId)!,
        positionByAtomId.get(innermost[0]!.textItemEvidenceId)!,
      );
    }
  }

  const positionsWithOverlappingChild = new Set<HeaderAtomPosition>();
  for (let lineIndex = 1; lineIndex < atomsByLine.length; lineIndex += 1) {
    const parentAtoms = atomsByLine[lineIndex - 1]!;
    const childAtoms = atomsByLine[lineIndex]!;
    for (const child of childAtoms) {
      const overlapping = parentAtoms.filter((parent) => atomsPositivelyOverlap(parent, child));
      for (const parent of overlapping) {
        positionsWithOverlappingChild.add(positionByAtomId.get(parent.textItemEvidenceId)!);
      }
      if (overlapping.length !== 1) continue;
      const childPosition = positionByAtomId.get(child.textItemEvidenceId)!;
      if (parentByPosition.has(childPosition)) continue;
      parentByPosition.set(
        childPosition,
        positionByAtomId.get(overlapping[0]!.textItemEvidenceId)!,
      );
    }
  }

  return { parentByPosition, positionsWithOverlappingChild };
}

function buildHeaderPathsForLines(
  graph: EvidenceGraph,
  pageNumber: number,
  block: ReadonlyArray<EvidenceLine>,
  family?: HeaderSchemaFamily,
): ReadonlyArray<HeaderPath> {
  const geometry = buildHeaderBlockGeometry(graph, pageNumber, block);
  if (geometry === null) return [];
  return headerPathsFromGeometry(geometry, family);
}

function headerPathsFromGeometry(
  geometry: HeaderBlockGeometry,
  family?: HeaderSchemaFamily,
): ReadonlyArray<HeaderPath> {
  const { pageNumber, allAtoms, positionByAtomId, atomByPosition, bandByAtomId } = geometry;
  const observed = observeHeaderBlockAncestry(geometry);
  const ancestry = family?.ancestry ?? observed.parentByPosition;
  const excludedParentPositions =
    family?.positionsWithOverlappingChild ?? observed.positionsWithOverlappingChild;

  const labelRange = labelRangeOfAtom;
  const bandOf = (atom: HeaderAtom): HorizontalRange =>
    bandByAtomId.get(atom.textItemEvidenceId) ?? labelRange(atom);
  const parentOf = (atom: HeaderAtom): HeaderAtom | undefined => {
    const parentPosition = ancestry.get(positionByAtomId.get(atom.textItemEvidenceId)!);
    return parentPosition === undefined ? undefined : atomByPosition.get(parentPosition);
  };

  const assignedParentPositions = new Set(ancestry.values());
  const leaves = allAtoms.filter((atom) => {
    const position = positionByAtomId.get(atom.textItemEvidenceId)!;
    return !assignedParentPositions.has(position) && !excludedParentPositions.has(position);
  });

  const collidingLeafIds = new Set<string>();
  for (const left of leaves) {
    for (const right of leaves) {
      if (left.textItemEvidenceId >= right.textItemEvidenceId) continue;
      const leftBand = bandOf(left);
      const rightBand = bandOf(right);
      if (
        rangesPositivelyOverlap(
          leftBand.leftPoints,
          leftBand.rightPoints,
          rightBand.leftPoints,
          rightBand.rightPoints,
        )
      ) {
        collidingLeafIds.add(left.textItemEvidenceId);
        collidingLeafIds.add(right.textItemEvidenceId);
      }
    }
  }

  return leaves
    .map((leaf): HeaderPath => {
      const chain: HeaderAtom[] = [leaf];
      let cursor: HeaderAtom | undefined = leaf;
      while (cursor !== undefined) {
        const parent = parentOf(cursor);
        if (parent === undefined) break;
        chain.unshift(parent);
        cursor = parent;
      }
      const parentTexts = chain.slice(0, -1).map((atom) => atom.normalizedText);
      const band = collidingLeafIds.has(leaf.textItemEvidenceId) ? labelRange(leaf) : bandOf(leaf);
      return {
        headerPathId: `header-path:${fingerprintCanonical({
          pageNumber,
          atomIds: chain.map((atom) => atom.textItemEvidenceId),
        })}`,
        pageNumber,
        atomIds: chain.map((atom) => atom.textItemEvidenceId),
        atomLocatorIds: uniqueSorted(chain.map((atom) => atom.locatorId)),
        atomLineIds: uniqueSorted(chain.map((atom) => atom.lineId)),
        leftPoints: band.leftPoints,
        rightPoints: band.rightPoints,
        labelLeftPoints: leaf.leftPoints,
        labelRightPoints: leaf.rightPoints,
        bandWidened:
          band.leftPoints !== leaf.leftPoints || band.rightPoints !== leaf.rightPoints,
        leafText: leaf.rawText,
        parentTexts,
        candidateRoles: headerPathRoles([...parentTexts, leaf.normalizedText]),
      };
    })
    .sort(
      (left, right) =>
        left.leftPoints - right.leftPoints ||
        left.rightPoints - right.rightPoints ||
        ordinalCompare(left.headerPathId, right.headerPathId),
    );
}

/**
 * A REPEATED TABLE SCHEMA, proven positively and structurally: every page
 * whose selected header block has the same signature -- the same lines, each
 * carrying the same normalized atom texts in the same left-to-right order --
 * is reconstructing the same table header. Nothing here uses a page number, a
 * document name, a score, a percentage or a threshold; the proof is textual
 * identity plus ordering, and it fails closed (a page whose header differs in
 * any atom simply forms its own family).
 *
 * A multi-page budget must not be reconstructed as N unrelated tables when
 * the document itself demonstrates it is one table repeated. Where one page's
 * geometry proves a parent/child relation that another page's geometry leaves
 * unproven -- the ordinary case, because a centered parent title only reaches
 * its outer children through whatever body values that particular page
 * happens to contain -- the relation belongs to the SCHEMA and is shared.
 * Disagreement is never resolved: a structural position whose observed
 * parents differ between pages gets no family ancestry at all.
 *
 * Only SCHEMA SEMANTICS travel between pages: ancestry, and the expected role
 * set derived from it. PAGE GEOMETRY never does -- every page keeps its own
 * observed bands, so a shifted or rescaled repeat of the same header is still
 * measured where it actually is.
 */
export interface HeaderSchemaFamily {
  readonly familyId: string;
  readonly signature: ReadonlyArray<ReadonlyArray<string>>;
  readonly pageNumbers: ReadonlyArray<number>;
  readonly ancestry: ReadonlyMap<HeaderAtomPosition, HeaderAtomPosition>;
  readonly positionsWithOverlappingChild: ReadonlySet<HeaderAtomPosition>;
  /** The roles this table schema demonstrably HAS, independent of whether any
   * particular page succeeded in resolving them. A page's local failure to
   * resolve a column can therefore never be mistaken for the document not
   * having that column. */
  readonly expectedRoles: ReadonlyArray<BudgetColumnRole>;
}

function familyExpectedRoles(
  signature: ReadonlyArray<ReadonlyArray<string>>,
  ancestry: ReadonlyMap<HeaderAtomPosition, HeaderAtomPosition>,
  positionsWithOverlappingChild: ReadonlySet<HeaderAtomPosition>,
): ReadonlyArray<BudgetColumnRole> {
  const allPositions: HeaderAtomPosition[] = [];
  const textByPosition = new Map<HeaderAtomPosition, string>();
  signature.forEach((line, lineIndex) =>
    line.forEach((text, atomIndex) => {
      const position = headerAtomPosition(lineIndex, atomIndex);
      allPositions.push(position);
      textByPosition.set(position, text);
    }),
  );

  const parentPositions = new Set(ancestry.values());
  const leafPositions = allPositions.filter(
    (position) =>
      !parentPositions.has(position) && !positionsWithOverlappingChild.has(position),
  );

  const rolesByLeaf = new Map<HeaderAtomPosition, ReadonlyArray<BudgetColumnRole>>();
  const pathTextByLeaf = new Map<HeaderAtomPosition, string>();
  for (const leafPosition of leafPositions) {
    const chain: string[] = [];
    const visited = new Set<HeaderAtomPosition>();
    let cursor: HeaderAtomPosition | undefined = leafPosition;
    while (cursor !== undefined && !visited.has(cursor)) {
      visited.add(cursor);
      chain.unshift(textByPosition.get(cursor)!);
      cursor = ancestry.get(cursor);
    }
    pathTextByLeaf.set(leafPosition, chain.join(" "));
    rolesByLeaf.set(leafPosition, headerPathRoles(chain) as ReadonlyArray<BudgetColumnRole>);
  }

  const identifierLeaves = leafPositions.filter((position) =>
    rolesByLeaf.get(position)!.includes("item_code"),
  );
  const explicitIdentifierLeaves = identifierLeaves.filter((position) =>
    /\bitem\b/.test(pathTextByLeaf.get(position)!),
  );
  if (explicitIdentifierLeaves.length === 1) {
    for (const position of identifierLeaves) {
      if (position === explicitIdentifierLeaves[0]!) continue;
      rolesByLeaf.set(
        position,
        rolesByLeaf.get(position)!.filter((role) => role !== "item_code"),
      );
    }
  }

  const leafCountByRole = new Map<BudgetColumnRole, number>();
  for (const leafPosition of leafPositions) {
    const roles = rolesByLeaf.get(leafPosition)!;
    if (roles.length !== 1) continue;
    leafCountByRole.set(roles[0]!, (leafCountByRole.get(roles[0]!) ?? 0) + 1);
  }
  return [...leafCountByRole.entries()]
    .filter(([, count]) => count === 1)
    .map(([role]) => role)
    .sort(ordinalCompare);
}

function buildHeaderSchemaFamilies(
  geometries: ReadonlyArray<HeaderBlockGeometry>,
): ReadonlyMap<number, HeaderSchemaFamily> {
  const geometriesBySignature = new Map<string, HeaderBlockGeometry[]>();
  for (const geometry of geometries) {
    const key = fingerprintCanonical(geometry.signature);
    const existing = geometriesBySignature.get(key);
    if (existing === undefined) geometriesBySignature.set(key, [geometry]);
    else existing.push(geometry);
  }

  const familyByPage = new Map<number, HeaderSchemaFamily>();
  for (const [key, members] of geometriesBySignature) {
    const observations = members.map((geometry) => observeHeaderBlockAncestry(geometry));

    const observedParentsByChild = new Map<HeaderAtomPosition, Set<HeaderAtomPosition>>();
    const positionsWithOverlappingChild = new Set<HeaderAtomPosition>();
    for (const observation of observations) {
      for (const [childPosition, parentPosition] of observation.parentByPosition) {
        const existing = observedParentsByChild.get(childPosition);
        if (existing === undefined) {
          observedParentsByChild.set(childPosition, new Set([parentPosition]));
        } else {
          existing.add(parentPosition);
        }
      }
      for (const position of observation.positionsWithOverlappingChild) {
        positionsWithOverlappingChild.add(position);
      }
    }

    const ancestry = new Map<HeaderAtomPosition, HeaderAtomPosition>();
    for (const [childPosition, parentPositions] of [...observedParentsByChild].sort(
      ([left], [right]) => ordinalCompare(left, right),
    )) {
      if (parentPositions.size !== 1) continue;
      ancestry.set(childPosition, [...parentPositions][0]!);
    }

    const signature = members[0]!.signature;
    const family: HeaderSchemaFamily = {
      familyId: `header-family:${key}`,
      signature,
      pageNumbers: members.map((geometry) => geometry.pageNumber).sort((a, b) => a - b),
      ancestry,
      positionsWithOverlappingChild,
      expectedRoles: familyExpectedRoles(signature, ancestry, positionsWithOverlappingChild),
    };
    for (const geometry of members) familyByPage.set(geometry.pageNumber, family);
  }
  return familyByPage;
}

function headerPathsWithinBand(
  headerPaths: ReadonlyArray<HeaderPath>,
  band: { readonly leftPoints: number; readonly rightPoints: number },
): ReadonlyArray<HeaderPath> {
  return headerPaths.filter((path) =>
    rangesPositivelyOverlap(path.leftPoints, path.rightPoints, band.leftPoints, band.rightPoints),
  );
}

function canonicalBandFromHeaderPath(
  pageNumber: number,
  path: HeaderPath,
  upstreamBands: ReadonlyArray<RawColumnBand>,
  siblingBands: ReadonlyArray<HorizontalRange>,
): CanonicalBand {
  /**
   * Upstream physical column hypotheses stay positive evidence (they are
   * never an exclusion gate): every hypothesis that positively overlaps this
   * leaf and no other leaf is recorded as this column's provenance, so
   * several jittered observations of one physical column all attach to the
   * single semantic column they describe, downstream g.1 / f.2c
   * physical-cell preference keeps working, and the column stays traceable
   * to the physical read. A hypothesis straddling two leaves is deliberately
   * attributed to neither -- it does not demonstrate either column on its
   * own, so claiming it would be inventing support and would let one
   * sibling's values be preferred into the other.
   */
  const contained = upstreamBands.filter(
    (band) =>
      rangesPositivelyOverlap(band.leftPoints, band.rightPoints, path.leftPoints, path.rightPoints) &&
      !siblingBands.some((sibling) =>
        rangesPositivelyOverlap(
          band.leftPoints,
          band.rightPoints,
          sibling.leftPoints,
          sibling.rightPoints,
        ),
      ),
  );
  return {
    pageNumber,
    horizontalOrder: 0,
    leftPoints: path.leftPoints,
    rightPoints: path.rightPoints,
    candidateRoles: path.candidateRoles,
    evidenceLocatorIds: uniqueSorted([
      ...path.atomLocatorIds,
      ...contained.flatMap((band) => band.evidenceLocatorIds),
    ]),
    sourcePhysicalColumnHypothesisIds: uniqueSorted(
      contained.map((band) => band.physicalColumnHypothesisId),
    ),
    contributingRegionIds: uniqueSorted(contained.map((band) => band.regionId)),
    contributingLineIds: uniqueSorted([
      ...path.atomLineIds,
      ...contained.flatMap((band) => band.lineIds),
    ]),
    contributingSegmentIds: uniqueSorted(contained.flatMap((band) => band.segmentIds)),
    groupingRuleId: "header-band-v1",
    representativePhysicalColumnHypothesisId:
      contained.length === 1 ? contained[0]!.physicalColumnHypothesisId : null,
    nonGroupingReasonCodes: [],
    bandProvenance: "header-derived",
    headerAtomIds: path.atomIds,
    splitReasonCode: path.bandWidened
      ? "leaf_band_widened_to_sibling_exclusive_observed_body_geometry"
      : null,
  };
}

function rawBandsFromUpstream(
  input: BudgetTableReconstructionInput,
  graph: EvidenceGraph,
  pageNumber: number,
  headerPaths: ReadonlyArray<HeaderPath>,
): ReadonlyArray<RawColumnBand> {
  if (input.columnEvidence.availability === "unavailable") return [];
  const pages = input.columnEvidence.result.groups.flatMap((group) => group.pages);
  const sourcePage = pages.find((page) => page.pageNumber === pageNumber);
  if (sourcePage === undefined) return [];

  return sourcePage.regions
    .flatMap((region) =>
      region.hypotheses.map((hypothesis) => {
        const coveringPaths = headerPathsWithinBand(headerPaths, hypothesis);
        const stableHypothesisId = `physical-column:${fingerprintCanonical({
          pageNumber,
          order: hypothesis.order,
          leftPoints: hypothesis.leftPoints,
          rightPoints: hypothesis.rightPoints,
          lineCount: hypothesis.lineKeys.length,
          segmentCount: hypothesis.segmentKeys.length,
        })}`;
        return {
          pageNumber,
          physicalColumnHypothesisId: stableHypothesisId,
          regionId: `physical-region:${fingerprintCanonical({
            pageNumber,
            bands: region.hypotheses.map((candidate) => [
              candidate.leftPoints,
              candidate.rightPoints,
            ]),
          })}`,
          leftPoints: hypothesis.leftPoints,
          rightPoints: hypothesis.rightPoints,
          lineIds: uniqueSorted(
            graph.lines
              .filter(
                (line) =>
                  line.runtimeReference.lineKey !== null &&
                  hypothesis.lineKeys.includes(line.runtimeReference.lineKey),
              )
              .map((line) => line.lineId),
          ),
          segmentIds: uniqueSorted(
            graph.segments
              .filter(
                (segment) =>
                  segment.runtimeReference.segmentKey !== null &&
                  hypothesis.segmentKeys.includes(segment.runtimeReference.segmentKey),
              )
              .map((segment) => segment.segmentId),
          ),
          evidenceLocatorIds: uniqueSorted(
            graph.segments
              .filter(
                (segment) =>
                  segment.runtimeReference.segmentKey !== null &&
                  hypothesis.segmentKeys.includes(segment.runtimeReference.segmentKey),
              )
              .map((segment) => segment.locatorId),
          ),
          headerEvidenceLocatorIds: uniqueSorted(
            coveringPaths.flatMap((path) => path.atomLocatorIds),
          ),
          headerAtomIds: uniqueSorted(coveringPaths.flatMap((path) => path.atomIds)),
          candidateRoles: uniqueSortedRoles(coveringPaths.flatMap((path) => path.candidateRoles)),
        };
      }),
    )
    .sort(
      (left, right) =>
        left.leftPoints - right.leftPoints ||
        left.rightPoints - right.rightPoints ||
        ordinalCompare(left.physicalColumnHypothesisId, right.physicalColumnHypothesisId),
    );
}

function positivelyOverlaps(left: RawColumnBand, right: RawColumnBand): boolean {
  return rangesPositivelyOverlap(left.leftPoints, left.rightPoints, right.leftPoints, right.rightPoints);
}

function simultaneouslyOccupied(left: RawColumnBand, right: RawColumnBand): boolean {
  const rightSegments = new Set(right.segmentIds);
  return left.lineIds.some((lineId) =>
    right.lineIds.includes(lineId) &&
    left.segmentIds.some((segmentId) => !rightSegments.has(segmentId)),
  );
}

function semanticallyEquivalent(left: RawColumnBand, right: RawColumnBand): boolean {
  const leftRoles = uniqueSortedRoles(left.candidateRoles);
  const rightRoles = uniqueSortedRoles(right.candidateRoles);
  const sameRoleSet = leftRoles.length > 0 && sameStrings(leftRoles, rightRoles);
  const sharedHeaderEvidence = left.headerEvidenceLocatorIds.some((locatorId) =>
    right.headerEvidenceLocatorIds.includes(locatorId),
  );
  return sameRoleSet || sharedHeaderEvidence;
}

function edgeWouldViolateHorizontalOrder(
  left: RawColumnBand,
  right: RawColumnBand,
  all: ReadonlyArray<RawColumnBand>,
): boolean {
  const lowerCenter = Math.min(
    left.leftPoints + left.rightPoints,
    right.leftPoints + right.rightPoints,
  );
  const upperCenter = Math.max(
    left.leftPoints + left.rightPoints,
    right.leftPoints + right.rightPoints,
  );
  return all.some((candidate) => {
    if (candidate === left || candidate === right) return false;
    const center = candidate.leftPoints + candidate.rightPoints;
    return (
      center > lowerCenter &&
      center < upperCenter &&
      (!positivelyOverlaps(candidate, left) || !semanticallyEquivalent(candidate, left))
    );
  });
}

function groupingRejectionReasons(
  left: RawColumnBand,
  right: RawColumnBand,
  all: ReadonlyArray<RawColumnBand>,
): ReadonlyArray<string> {
  const reasons: string[] = [];
  if (left.pageNumber !== right.pageNumber) reasons.push("different_page");
  if (!positivelyOverlaps(left, right)) reasons.push("no_positive_horizontal_intersection");
  if (!semanticallyEquivalent(left, right)) reasons.push("different_header_semantic_evidence");
  if (simultaneouslyOccupied(left, right)) reasons.push("simultaneous_distinct_segment_occupancy");
  if (edgeWouldViolateHorizontalOrder(left, right, all)) reasons.push("horizontal_order_violation");
  return reasons;
}

function canonicalRepresentative(component: ReadonlyArray<RawColumnBand>): RawColumnBand {
  return [...component].sort((left, right) => {
    const leftDistance = component.reduce(
      (sum, candidate) =>
        sum +
        Math.abs(left.leftPoints - candidate.leftPoints) +
        Math.abs(left.rightPoints - candidate.rightPoints),
      0,
    );
    const rightDistance = component.reduce(
      (sum, candidate) =>
        sum +
        Math.abs(right.leftPoints - candidate.leftPoints) +
        Math.abs(right.rightPoints - candidate.rightPoints),
      0,
    );
    return (
      leftDistance - rightDistance ||
      left.leftPoints - right.leftPoints ||
      left.rightPoints - right.rightPoints ||
      ordinalCompare(left.physicalColumnHypothesisId, right.physicalColumnHypothesisId)
    );
  })[0]!;
}

function groupRawBands(rawBands: ReadonlyArray<RawColumnBand>): ReadonlyArray<CanonicalBand> {
  const parent = rawBands.map((_, index) => index);
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]!]!;
      index = parent[index]!;
    }
    return index;
  };
  const union = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  for (let left = 0; left < rawBands.length; left += 1) {
    for (let right = left + 1; right < rawBands.length; right += 1) {
      if (groupingRejectionReasons(rawBands[left]!, rawBands[right]!, rawBands).length === 0) {
        union(left, right);
      }
    }
  }

  const components = new Map<number, RawColumnBand[]>();
  rawBands.forEach((band, index) => {
    const root = find(index);
    components.set(root, [...(components.get(root) ?? []), band]);
  });

  const grouped = [...components.values()].map((component) => {
    const representative = canonicalRepresentative(component);
    const otherBands = rawBands.filter((candidate) => !component.includes(candidate));
    const nonGroupingReasonCodes = uniqueSorted(
      component.flatMap((member) =>
        otherBands
          .filter((candidate) => positivelyOverlaps(member, candidate))
          .flatMap((candidate) => groupingRejectionReasons(member, candidate, rawBands)),
      ),
    );
    return {
      pageNumber: representative.pageNumber,
      horizontalOrder: 0,
      leftPoints: representative.leftPoints,
      rightPoints: representative.rightPoints,
      candidateRoles: uniqueSortedRoles(component.flatMap((band) => band.candidateRoles)),
      evidenceLocatorIds: uniqueSorted(component.flatMap((band) => band.evidenceLocatorIds)),
      sourcePhysicalColumnHypothesisIds: uniqueSorted(
        component.map((band) => band.physicalColumnHypothesisId),
      ),
      contributingRegionIds: uniqueSorted(component.map((band) => band.regionId)),
      contributingLineIds: uniqueSorted(component.flatMap((band) => band.lineIds)),
      contributingSegmentIds: uniqueSorted(component.flatMap((band) => band.segmentIds)),
      groupingRuleId: "overlap-semantic-noncooccupancy-components-v1" as const,
      representativePhysicalColumnHypothesisId: representative.physicalColumnHypothesisId,
      nonGroupingReasonCodes,
      bandProvenance: "upstream" as const,
      headerAtomIds: uniqueSorted(component.flatMap((band) => band.headerAtomIds)),
      splitReasonCode: null,
    };
  });

  return grouped.sort(
    (left, right) =>
      left.leftPoints - right.leftPoints ||
      left.rightPoints - right.rightPoints ||
      ordinalCompare(
        left.representativePhysicalColumnHypothesisId!,
        right.representativePhysicalColumnHypothesisId!,
      ),
  );
}

function assembleResolvedColumn(
  pageNumber: number,
  band: CanonicalBand,
  headers: ReadonlyArray<HeaderCandidate>,
): ResolvedColumn {
  const candidateRoles = band.candidateRoles;
  const role = candidateRoles.length === 1 ? candidateRoles[0]! : "unknown";
  return {
    columnId: `column:${fingerprintCanonical({
      pageNumber,
      leftPoints: band.leftPoints,
      rightPoints: band.rightPoints,
      headerAtomIds: band.headerAtomIds,
      sourcePhysicalColumnHypothesisIds: band.sourcePhysicalColumnHypothesisIds,
    })}`,
    pageNumber,
    horizontalOrder: band.horizontalOrder,
    leftPoints: band.leftPoints,
    rightPoints: band.rightPoints,
    candidateRoles: candidateRoles.length === 0 ? ["unknown"] : candidateRoles,
    role,
    status:
      candidateRoles.length === 1
        ? "resolved"
        : candidateRoles.length > 1
          ? "ambiguous"
          : "insufficient_evidence",
    headerLineIds: headers.map((header) => header.lineId).sort(ordinalCompare),
    evidenceLocatorIds: band.evidenceLocatorIds,
    sourcePhysicalColumnHypothesisIds: band.sourcePhysicalColumnHypothesisIds,
    contributingRegionIds: band.contributingRegionIds,
    contributingLineIds: band.contributingLineIds,
    contributingSegmentIds: band.contributingSegmentIds,
    groupingRuleId: band.groupingRuleId,
    representativePhysicalColumnHypothesisId: band.representativePhysicalColumnHypothesisId,
    nonGroupingReasonCodes: band.nonGroupingReasonCodes,
    bandProvenance: band.bandProvenance,
    headerAtomIds: band.headerAtomIds,
    splitReasonCode: band.splitReasonCode,
  };
}

function trialNumericValue(
  graph: EvidenceGraph,
  line: EvidenceLine,
  leftPoints: number,
  rightPoints: number,
): ReturnType<typeof parseNumericEvidence>["exactValue"] {
  const segments = graph.segments.filter(
    (segment) => segment.lineId === line.lineId && segmentIntersects(graph, segment, leftPoints, rightPoints),
  );
  if (segments.length !== 1) return null;
  const parsed = parseNumericEvidence(segments[0]!.rawText, [], []);
  return parsed.status === "resolved" ? parsed.exactValue : null;
}

/**
 * Last-resort disambiguation: when two or more bands are ambiguous purely
 * among the economic-number roles, try every role bijection consistent with
 * each band's own candidateRoles and keep it only if it is the single
 * bijection under which BOTH known exact-rational relations
 * (quantity x unit_price = total_price; unit_cost x (1 + bdi/100) =
 * unit_price) hold for every data row where the operands are extractable
 * unambiguously. No tolerance: exact rational equality only. If zero or
 * more than one bijection is consistent, nothing changes.
 */
function resolveEconomicAmbiguityByArithmetic(
  graph: EvidenceGraph,
  pageNumber: number,
  headerBlockLineIds: ReadonlySet<string>,
  columns: ReadonlyArray<ResolvedColumn>,
): ReadonlyArray<ResolvedColumn> {
  const dataLines = graph.lines.filter(
    (line) => line.pageNumber === pageNumber && !headerBlockLineIds.has(line.lineId),
  );
  const resolvedByRole = new Map<BudgetColumnRole, ResolvedColumn>();
  for (const column of columns) {
    if (column.candidateRoles.length === 1) {
      resolvedByRole.set(column.candidateRoles[0]!, column);
    }
  }
  const ambiguous = columns.filter(
    (column) =>
      column.candidateRoles.length > 1 &&
      column.candidateRoles.every((role) => ECONOMIC_NUMBER_ROLES.includes(role)),
  );
  if (ambiguous.length === 0 || ambiguous.length > 4) return columns;

  function* bijections(
    remaining: ReadonlyArray<ResolvedColumn>,
    used: Set<BudgetColumnRole>,
    assignment: ReadonlyMap<string, BudgetColumnRole>,
  ): Generator<ReadonlyMap<string, BudgetColumnRole>> {
    if (remaining.length === 0) {
      yield assignment;
      return;
    }
    const [head, ...rest] = remaining;
    for (const role of head!.candidateRoles) {
      if (used.has(role)) continue;
      const nextUsed = new Set(used);
      nextUsed.add(role);
      const nextAssignment = new Map(assignment);
      nextAssignment.set(head!.columnId, role);
      yield* bijections(rest, nextUsed, nextAssignment);
    }
  }

  const rangeForRole = (
    role: BudgetColumnRole,
    assignment: ReadonlyMap<string, BudgetColumnRole>,
  ): { readonly leftPoints: number; readonly rightPoints: number } | undefined => {
    const resolved = resolvedByRole.get(role);
    if (resolved !== undefined) return resolved;
    return ambiguous.find((column) => assignment.get(column.columnId) === role);
  };

  const consistentAssignments: ReadonlyArray<ReadonlyMap<string, BudgetColumnRole>> = [
    ...bijections(ambiguous, new Set(), new Map()),
  ].filter((assignment) => {
    let sawEvidence = false;
    for (const line of dataLines) {
      const quantity = resolvedByRole.get("quantity");
      const quantityValue = quantity ? trialNumericValue(graph, line, quantity.leftPoints, quantity.rightPoints) : null;
      const unitPriceRange = rangeForRole("unit_price", assignment);
      const totalRange = rangeForRole("total_price", assignment);
      const unitCostRange = rangeForRole("unit_cost", assignment);
      const bdiRange = rangeForRole("bdi_rate", assignment);
      const unitPriceValue = unitPriceRange
        ? trialNumericValue(graph, line, unitPriceRange.leftPoints, unitPriceRange.rightPoints)
        : null;
      const totalValue = totalRange
        ? trialNumericValue(graph, line, totalRange.leftPoints, totalRange.rightPoints)
        : null;
      const unitCostValue = unitCostRange
        ? trialNumericValue(graph, line, unitCostRange.leftPoints, unitCostRange.rightPoints)
        : null;
      const bdiValue = bdiRange
        ? trialNumericValue(graph, line, bdiRange.leftPoints, bdiRange.rightPoints)
        : null;
      if (quantityValue !== null && unitPriceValue !== null && totalValue !== null) {
        sawEvidence = true;
        if (!equalExact(multiplyExact(quantityValue, unitPriceValue), totalValue)) return false;
      }
      if (unitCostValue !== null && bdiValue !== null && unitPriceValue !== null) {
        sawEvidence = true;
        const multiplier = addExact(rational(1n, 1n), multiplyExact(bdiValue, rational(1n, 100n)));
        if (!equalExact(multiplyExact(unitCostValue, multiplier), unitPriceValue)) return false;
      }
    }
    return sawEvidence;
  });

  if (consistentAssignments.length !== 1) return columns;
  const winning = consistentAssignments[0]!;
  return columns.map((column) => {
    const assignedRole = winning.get(column.columnId);
    if (assignedRole === undefined) return column;
    return {
      ...column,
      role: assignedRole,
      status: "resolved" as const,
      candidateRoles: [assignedRole],
    };
  });
}

/**
 * Correction C: "ITEM" and "CÓDIGO" both independently satisfy the flat
 * item_code vocabulary, which is correct when a document uses only one of
 * them but wrong when both appear as distinct columns (the duplicate-role
 * guard then demotes both to unknown, destroying an identity a human reader
 * would read unambiguously from "ITEM" alone). A header path demonstrates
 * EXPLICIT item identity when the literal word "item" appears anywhere in
 * its path text (the leaf, or an ancestor, e.g. "ITEM" alone or "CÓDIGO DO
 * ITEM"); a path that only matches through "codigo" without the word
 * "item" anywhere is a GENERIC auxiliary identifier. When exactly one path
 * on the page has explicit item identity, every other item_code-candidate
 * path has item_code removed from its candidate roles -- it does not
 * compete for the role and does not trigger the duplicate-role guard,
 * falling back to "unknown" if it has no other role. When there is no
 * explicit path (0) or more than one (2+, an unresolved ambiguity in its
 * own right), nothing is touched here: a lone generic "codigo" path still
 * resolves to item_code as before (fallback compatibility for documents
 * that only ever call it "Código"), and multiple equally-generic
 * candidates continue to collide through the existing duplicate-role guard
 * -- never chosen by position.
 */
function hasExplicitItemIdentity(path: HeaderPath): boolean {
  const fullPath = [...path.parentTexts, normalizeBudgetHeaderText(path.leafText)].join(" ");
  return /\bitem\b/.test(fullPath);
}

function resolveItemIdentitySpecificity(
  headerPaths: ReadonlyArray<HeaderPath>,
): ReadonlyArray<HeaderPath> {
  const itemCodePaths = headerPaths.filter((path) => path.candidateRoles.includes("item_code"));
  const explicit = itemCodePaths.filter(hasExplicitItemIdentity);
  if (explicit.length !== 1) return headerPaths;

  const explicitPathId = explicit[0]!.headerPathId;
  return headerPaths.map((path) => {
    if (path.headerPathId === explicitPathId || !path.candidateRoles.includes("item_code")) {
      return path;
    }
    return {
      ...path,
      candidateRoles: path.candidateRoles.filter((role) => role !== "item_code"),
    };
  });
}

/**
 * When a page proves it has a real tabular header, that header IS the page's
 * semantic schema: one column per leaf, each with its own identity, its own
 * ancestry, its own evidence and -- critically -- its own band. Deriving the
 * semantic columns from grouped upstream hypotheses instead lets a single
 * coarse hypothesis swallow several documented leaves, and whichever leaf
 * happened to resolve a role then collected the values of its siblings as
 * if the source had contradicted itself. Sibling leaves of a hierarchical
 * header ("... SEM BDI | BDI | COM BDI") are exactly the case that breaks.
 *
 * Upstream evidence is not discarded: hypotheses inside a leaf band become
 * that column's provenance, and any grouped hypothesis that overlaps no leaf
 * at all is still emitted as an auxiliary column so evidence outside the
 * header's schema keeps a home. Pages that prove no header keep the previous
 * upstream-only construction unchanged -- no header gate is invented where
 * no header was demonstrated.
 */
function resolvePageColumns(
  input: BudgetTableReconstructionInput,
  graph: EvidenceGraph,
  pageNumber: number,
  headerBlock: ReadonlyArray<EvidenceLine>,
  headerGeometry: HeaderBlockGeometry | null,
  family: HeaderSchemaFamily | undefined,
): ReadonlyArray<ResolvedColumn> {
  const headers = headerCandidates(graph, pageNumber);
  const headerPaths = resolveItemIdentitySpecificity(
    headerGeometry === null ? [] : headerPathsFromGeometry(headerGeometry, family),
  );
  const headerBlockLineIds = new Set(headerBlock.map((line) => line.lineId));

  const rawBands = rawBandsFromUpstream(input, graph, pageNumber, headerPaths);
  const grouped = rawBands.length > 0 ? groupRawBands(rawBands) : [];

  let bands: ReadonlyArray<CanonicalBand>;
  if (headerPaths.length > 0) {
    const leafBands = headerPaths.map((path, index) =>
      canonicalBandFromHeaderPath(
        pageNumber,
        path,
        rawBands,
        headerPaths
          .filter((_, otherIndex) => otherIndex !== index)
          .map((other) => ({ leftPoints: other.leftPoints, rightPoints: other.rightPoints })),
      ),
    );
    const auxiliary = grouped.filter(
      (band) =>
        !leafBands.some((leaf) =>
          rangesPositivelyOverlap(
            leaf.leftPoints,
            leaf.rightPoints,
            band.leftPoints,
            band.rightPoints,
          ),
        ),
    );
    bands = [...leafBands, ...auxiliary];
  } else {
    bands = grouped;
  }

  const orderedBands = [...bands]
    .sort((left, right) => left.leftPoints - right.leftPoints || left.rightPoints - right.rightPoints)
    .map((band, index) => ({ ...band, horizontalOrder: index + 1 }));

  const preliminary = orderedBands.map((band) => assembleResolvedColumn(pageNumber, band, headers));
  const arithmeticRefined = resolveEconomicAmbiguityByArithmetic(
    graph,
    pageNumber,
    headerBlockLineIds,
    preliminary,
  );

  const duplicateRoles = new Set(
    arithmeticRefined
      .filter(
        (column, index, all) =>
          column.role !== "unknown" &&
          all.findIndex((candidate) => candidate.role === column.role) !== index,
      )
      .map((column) => column.role),
  );
  return arithmeticRefined.map((column) =>
    duplicateRoles.has(column.role)
      ? { ...column, role: "unknown" as const, status: "ambiguous" as const }
      : column,
  );
}

function schemasAreExactlyCompatible(
  previous: ReadonlyArray<ResolvedColumn>,
  current: ReadonlyArray<ResolvedColumn>,
): boolean {
  return (
    previous.length === current.length &&
    previous.every(
      (column, index) =>
        column.leftPoints === current[index]!.leftPoints &&
        column.rightPoints === current[index]!.rightPoints,
    )
  );
}

export interface BudgetTableColumnResolution {
  readonly columns: ReadonlyArray<ResolvedColumn>;
  readonly schemaExpectations: ReadonlyArray<BudgetTableSchemaExpectation>;
  readonly headerProvenance: SelectedHeaderProvenance;
}

/**
 * Resolves every page's columns once, against the document's proven header
 * schema families, and publishes -- alongside the columns -- what each page's
 * schema was EXPECTED to carry. The two are deliberately separate answers:
 * "which columns did this page resolve" and "which columns does this table
 * have" are different questions, and conflating them is what let a page's own
 * resolution failure silently redefine a documented field as inapplicable.
 */
export function resolveBudgetTableColumns(
  input: BudgetTableReconstructionInput,
  graph: EvidenceGraph,
): BudgetTableColumnResolution {
  const pageNumbers = [...new Set(graph.lines.map((line) => line.pageNumber))].sort(
    (left, right) => left - right,
  );

  const blockByPage = new Map<number, ReadonlyArray<EvidenceLine>>();
  const geometryByPage = new Map<number, HeaderBlockGeometry>();
  for (const pageNumber of pageNumbers) {
    const block = headerBlockLines(graph, pageNumber);
    blockByPage.set(pageNumber, block);
    const geometry = buildHeaderBlockGeometry(graph, pageNumber, block);
    if (geometry !== null) geometryByPage.set(pageNumber, geometry);
  }
  const familyByPage = buildHeaderSchemaFamilies([...geometryByPage.values()]);

  const resolvedByPage = new Map<number, ReadonlyArray<ResolvedColumn>>();
  const expectationSourceByPage = new Map<number, HeaderSchemaFamily>();

  for (const pageNumber of pageNumbers) {
    const family = familyByPage.get(pageNumber);
    if (family !== undefined) expectationSourceByPage.set(pageNumber, family);
    const current = resolvePageColumns(
      input,
      graph,
      pageNumber,
      blockByPage.get(pageNumber) ?? [],
      geometryByPage.get(pageNumber) ?? null,
      family,
    );
    const previousPageNumber = pageNumber - 1;
    const previous = resolvedByPage.get(previousPageNumber);
    const currentIntroducesHeader = current.some((column) => column.headerLineIds.length > 0);
    if (
      previous !== undefined &&
      current.length > 0 &&
      !currentIntroducesHeader &&
      current.every((column) => column.status === "insufficient_evidence") &&
      schemasAreExactlyCompatible(previous, current) &&
      previous.every((column) => column.status === "resolved")
    ) {
      resolvedByPage.set(
        pageNumber,
        current.map((column, index) => ({
          ...column,
          role: previous[index]!.role,
          candidateRoles: previous[index]!.candidateRoles,
          status: "resolved",
        })),
      );
      // A page that proved no header of its own but continues the previous
      // page's exact schema continues its EXPECTATIONS too -- otherwise the
      // continuation page would be held to nothing at all.
      const inherited = expectationSourceByPage.get(previousPageNumber);
      if (family === undefined && inherited !== undefined) {
        expectationSourceByPage.set(pageNumber, inherited);
      }
    } else {
      resolvedByPage.set(pageNumber, current);
    }
  }

  const columns = pageNumbers.flatMap((pageNumber) => resolvedByPage.get(pageNumber) ?? []);
  const schemaExpectations = pageNumbers.map((pageNumber): BudgetTableSchemaExpectation => {
    const pageColumns = resolvedByPage.get(pageNumber) ?? [];
    const resolvedRoles = uniqueSortedRoles(
      pageColumns
        .filter((column) => column.status === "resolved" && column.role !== "unknown")
        .map((column) => column.role),
    );
    const source = expectationSourceByPage.get(pageNumber);
    const expectedRoles =
      source === undefined ? resolvedRoles : uniqueSortedRoles(source.expectedRoles);
    return {
      pageNumber,
      schemaFamilyId: source?.familyId ?? null,
      expectedRoles,
      resolvedRoles,
      unresolvedExpectedRoles: expectedRoles.filter((role) => !resolvedRoles.includes(role)),
    };
  });

  const headerLineIds = new Set<string>();
  const headerPageNumbers = new Set<number>();
  for (const pageNumber of pageNumbers) {
    const block = blockByPage.get(pageNumber) ?? [];
    if (block.length === 0) continue;
    headerPageNumbers.add(pageNumber);
    for (const line of block) headerLineIds.add(line.lineId);
  }

  return {
    columns,
    schemaExpectations,
    headerProvenance: { lineIds: headerLineIds, pageNumbers: headerPageNumbers },
  };
}

export function resolveColumns(
  input: BudgetTableReconstructionInput,
  graph: EvidenceGraph,
): ReadonlyArray<ResolvedColumn> {
  return resolveBudgetTableColumns(input, graph).columns;
}

export interface SelectedHeaderProvenance {
  /** Lines proven to belong to a page's selected header block. */
  readonly lineIds: ReadonlySet<string>;
  /** Pages that proved a header block at all. On any other page the absence
   * of this evidence must not be read as "no line here is a header" -- it
   * means the question was never positively answered, and downstream
   * classification keeps its previous per-line reasoning there. */
  readonly pageNumbers: ReadonlySet<number>;
}

/**
 * The header block selected by exactly the same routine column resolution
 * uses, so header provenance can never drift from the schema it produced.
 * A line proven to be part of the header is a header line whatever its text
 * happens to say -- a lone "PREÇO TOTAL R$" spanning three sub-columns is a
 * column title, not an aggregation of the budget, and no amount of literal
 * text matching can tell the difference.
 */
export function selectBudgetHeaderProvenance(graph: EvidenceGraph): SelectedHeaderProvenance {
  const lineIds = new Set<string>();
  const pageNumbers = new Set<number>();
  for (const pageNumber of [...new Set(graph.lines.map((line) => line.pageNumber))].sort(
    (left, right) => left - right,
  )) {
    const block = headerBlockLines(graph, pageNumber);
    if (block.length === 0) continue;
    pageNumbers.add(pageNumber);
    for (const line of block) lineIds.add(line.lineId);
  }
  return { lineIds, pageNumbers };
}

export { headerCandidates as detectBudgetHeaderCandidates };
