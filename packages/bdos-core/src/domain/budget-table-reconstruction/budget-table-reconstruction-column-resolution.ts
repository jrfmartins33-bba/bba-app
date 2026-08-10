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
import type {
  BudgetColumnRole,
  BudgetTableReconstructionInput,
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

function lineHasVocabularyHit(graph: EvidenceGraph, line: EvidenceLine): boolean {
  const segments = graph.segments.filter((segment) => segment.lineId === line.lineId);
  return segments.some((segment) => headerVocabularyRoles(segment.rawText).length > 0);
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

  return runs
    .flatMap((run) => headerSignatureSubRuns(graph, run))
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
): ReadonlyArray<ReadonlyArray<EvidenceLine>> {
  const subRuns: EvidenceLine[][] = [];
  let current: EvidenceLine[] = [];
  for (const line of run) {
    if (lineHasVocabularyHit(graph, line)) {
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
 * what makes them columns. If any two collide, that line's atoms all fall
 * back to their raw label boxes rather than being reconciled by a
 * preference: a collision means the geometry did not in fact demonstrate a
 * partition, and inventing one would be guessing.
 */
function observedAtomBands(
  atoms: ReadonlyArray<HeaderAtom>,
  bodyIntervals: ReadonlyArray<HorizontalRange>,
): ReadonlyMap<string, HorizontalRange> {
  const bands = new Map<string, HorizontalRange>();
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
    bands.set(atom.textItemEvidenceId, { leftPoints, rightPoints });
  }

  for (const left of atoms) {
    for (const right of atoms) {
      if (left.textItemEvidenceId >= right.textItemEvidenceId) continue;
      const leftBand = bands.get(left.textItemEvidenceId)!;
      const rightBand = bands.get(right.textItemEvidenceId)!;
      if (
        rangesPositivelyOverlap(
          leftBand.leftPoints,
          leftBand.rightPoints,
          rightBand.leftPoints,
          rightBand.rightPoints,
        )
      ) {
        return new Map(
          atoms.map((atom) => [
            atom.textItemEvidenceId,
            { leftPoints: atom.leftPoints, rightPoints: atom.rightPoints },
          ]),
        );
      }
    }
  }
  return bands;
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
function buildHeaderPathsForLines(
  graph: EvidenceGraph,
  pageNumber: number,
  block: ReadonlyArray<EvidenceLine>,
): ReadonlyArray<HeaderPath> {
  if (block.length === 0) return [];

  const textItemById = new Map(graph.textItems.map((item) => [item.evidenceId, item]));
  const bodyIntervals = bodyTextIntervals(graph, pageNumber, block, textItemById);
  const atomsByLine = block.map((line) => atomsForLine(graph, line));
  const allAtoms = atomsByLine.flat();

  const lineIndexByAtomId = new Map<string, number>();
  const bandByAtomId = new Map<string, HorizontalRange>();
  for (const [lineIndex, atoms] of atomsByLine.entries()) {
    for (const atom of atoms) lineIndexByAtomId.set(atom.textItemEvidenceId, lineIndex);
    for (const [atomId, band] of observedAtomBands(atoms, bodyIntervals)) {
      bandByAtomId.set(atomId, band);
    }
  }
  const labelRange = (atom: HeaderAtom): HorizontalRange => ({
    leftPoints: atom.leftPoints,
    rightPoints: atom.rightPoints,
  });
  const bandOf = (atom: HeaderAtom): HorizontalRange =>
    bandByAtomId.get(atom.textItemEvidenceId) ?? labelRange(atom);

  const parentOf = new Map<string, HeaderAtom>();
  for (const child of allAtoms) {
    const childLineIndex = lineIndexByAtomId.get(child.textItemEvidenceId)!;
    if (childLineIndex === 0) continue;
    const containing = allAtoms.filter(
      (candidate) =>
        lineIndexByAtomId.get(candidate.textItemEvidenceId)! < childLineIndex &&
        rangeContains(bandOf(candidate), labelRange(child)),
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
    if (innermost.length === 1) parentOf.set(child.textItemEvidenceId, innermost[0]!);
  }

  const hasOverlappingChild = new Set<string>();
  for (let lineIndex = 1; lineIndex < atomsByLine.length; lineIndex += 1) {
    const parentAtoms = atomsByLine[lineIndex - 1]!;
    const childAtoms = atomsByLine[lineIndex]!;
    for (const child of childAtoms) {
      const overlapping = parentAtoms.filter((parent) => atomsPositivelyOverlap(parent, child));
      for (const parent of overlapping) hasOverlappingChild.add(parent.textItemEvidenceId);
      if (overlapping.length !== 1) continue;
      if (parentOf.has(child.textItemEvidenceId)) continue;
      parentOf.set(child.textItemEvidenceId, overlapping[0]!);
    }
  }

  const assignedParentIds = new Set(
    [...parentOf.values()].map((atom) => atom.textItemEvidenceId),
  );
  const leaves = allAtoms.filter(
    (atom) =>
      !assignedParentIds.has(atom.textItemEvidenceId) &&
      !hasOverlappingChild.has(atom.textItemEvidenceId),
  );

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
        const parent = parentOf.get(cursor.textItemEvidenceId);
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

function buildHeaderPaths(graph: EvidenceGraph, pageNumber: number): ReadonlyArray<HeaderPath> {
  return buildHeaderPathsForLines(graph, pageNumber, headerBlockLines(graph, pageNumber));
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
): ReadonlyArray<ResolvedColumn> {
  const headers = headerCandidates(graph, pageNumber);
  const headerBlock = headerBlockLines(graph, pageNumber);
  const headerPaths = resolveItemIdentitySpecificity(
    buildHeaderPathsForLines(graph, pageNumber, headerBlock),
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

export function resolveColumns(
  input: BudgetTableReconstructionInput,
  graph: EvidenceGraph,
): ReadonlyArray<ResolvedColumn> {
  const pageNumbers = [...new Set(graph.lines.map((line) => line.pageNumber))].sort(
    (left, right) => left - right,
  );
  const resolvedByPage = new Map<number, ReadonlyArray<ResolvedColumn>>();

  for (const pageNumber of pageNumbers) {
    const current = resolvePageColumns(input, graph, pageNumber);
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
    } else {
      resolvedByPage.set(pageNumber, current);
    }
  }

  return pageNumbers.flatMap((pageNumber) => resolvedByPage.get(pageNumber) ?? []);
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
