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
  readonly leftPoints: number;
  readonly rightPoints: number;
  readonly leafText: string;
  readonly parentTexts: ReadonlyArray<string>;
  readonly candidateRoles: ReadonlyArray<BudgetColumnRole>;
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

/**
 * Real documents carry front matter above the table -- running headers,
 * page numbers, report titles -- that is not itself part of any economic
 * column and can contain bare numbers (a page number, a date, a percentage
 * caption unrelated to the table). Assuming the header starts at the first
 * line of the page truncates the block before the real table header is ever
 * reached. Instead: partition the page into maximal contiguous runs of
 * lines with no economic literal, then take the first such run in which at
 * least one line carries a recognized header-vocabulary term. A run
 * qualifies as a whole (not line by line) so a parent line that itself
 * matches no vocabulary term (e.g. a bare "Preço" spanning two children)
 * is still included whenever any other line in the same run does.
 */
function headerBlockLines(graph: EvidenceGraph, pageNumber: number): ReadonlyArray<EvidenceLine> {
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

  const qualifying = runs.find((run) => run.some((line) => lineHasVocabularyHit(graph, line)));
  return qualifying ?? [];
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
 * Builds one HeaderPath per leaf HeaderAtom on the page's header block.
 *
 * Parent/child linkage (Correction A) requires only a positively observed
 * horizontal overlap between an atom and an atom on the immediately
 * preceding header line -- never full containment, which real centered
 * headers routinely fail even when the visual parent/child relation is
 * unambiguous. A child is linked to a parent only when EXACTLY ONE parent
 * candidate overlaps it: zero candidates leaves the atom parentless (it
 * still resolves on its own text); more than one candidate is a genuine
 * structural ambiguity and is never resolved by a nearest/narrowest/score
 * tie-break -- the atom is left without an assigned parent rather than
 * guessed.
 *
 * A parent atom is excluded from ever becoming its own leaf/column
 * (Correction C) whenever ANY atom on the next line positively overlaps it
 * -- independent of whether that specific child link was unique enough to
 * be assigned above. A three-way overlap ambiguity still marks the parent
 * as "has children" even though none of its children received a resolved
 * parent link; otherwise the parent could wrongly fall back to being
 * treated as its own independent column merely because none of its
 * children could be uniquely linked to it.
 */
function buildHeaderPaths(graph: EvidenceGraph, pageNumber: number): ReadonlyArray<HeaderPath> {
  const block = headerBlockLines(graph, pageNumber);
  if (block.length === 0) return [];

  const atomsByLine = block.map((line) => atomsForLine(graph, line));
  const parentOf = new Map<string, HeaderAtom>();
  const hasOverlappingChild = new Set<string>();

  for (let lineIndex = 1; lineIndex < atomsByLine.length; lineIndex += 1) {
    const parentAtoms = atomsByLine[lineIndex - 1]!;
    const childAtoms = atomsByLine[lineIndex]!;
    for (const child of childAtoms) {
      const overlapping = parentAtoms.filter((parent) => atomsPositivelyOverlap(parent, child));
      for (const parent of overlapping) hasOverlappingChild.add(parent.textItemEvidenceId);
      if (overlapping.length !== 1) continue;
      parentOf.set(child.textItemEvidenceId, overlapping[0]!);
    }
  }

  const allAtoms = atomsByLine.flat();
  const leaves = allAtoms.filter((atom) => !hasOverlappingChild.has(atom.textItemEvidenceId));

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
      return {
        headerPathId: `header-path:${fingerprintCanonical({
          pageNumber,
          atomIds: chain.map((atom) => atom.textItemEvidenceId),
        })}`,
        pageNumber,
        atomIds: chain.map((atom) => atom.textItemEvidenceId),
        atomLocatorIds: uniqueSorted(chain.map((atom) => atom.locatorId)),
        atomLineIds: uniqueSorted(chain.map((atom) => atom.lineId)),
        leftPoints: leaf.leftPoints,
        rightPoints: leaf.rightPoints,
        leafText: leaf.rawText,
        parentTexts,
        candidateRoles: headerPathRoles([...parentTexts, leaf.normalizedText]),
      };
    })
    .sort((left, right) => left.leftPoints - right.leftPoints);
}

function headerPathsWithinBand(
  headerPaths: ReadonlyArray<HeaderPath>,
  band: { readonly leftPoints: number; readonly rightPoints: number },
): ReadonlyArray<HeaderPath> {
  return headerPaths.filter((path) =>
    rangesPositivelyOverlap(path.leftPoints, path.rightPoints, band.leftPoints, band.rightPoints),
  );
}

function canonicalBandFromHeaderPath(pageNumber: number, path: HeaderPath): CanonicalBand {
  return {
    pageNumber,
    horizontalOrder: 0,
    leftPoints: path.leftPoints,
    rightPoints: path.rightPoints,
    candidateRoles: path.candidateRoles,
    evidenceLocatorIds: path.atomLocatorIds,
    sourcePhysicalColumnHypothesisIds: [],
    contributingRegionIds: [],
    contributingLineIds: path.atomLineIds,
    contributingSegmentIds: [],
    groupingRuleId: "header-band-v1",
    representativePhysicalColumnHypothesisId: null,
    nonGroupingReasonCodes: [],
    bandProvenance: "header-derived",
    headerAtomIds: path.atomIds,
    splitReasonCode: null,
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

/**
 * A grouped upstream band is only split when there is positive structural
 * proof it contains more than one real column: at least two mutually
 * non-overlapping HeaderPaths inside it, whose combined roles would
 * otherwise be ambiguous, each independently recurring on at least two data
 * rows. No epsilon, no width heuristic, no score -- the new boundaries are
 * exactly the observed leaf HeaderAtom bounds.
 *
 * Recurrence (Correction B) is proven at EvidenceTextItem granularity, not
 * Segment granularity: a data line counts toward a header path's recurrence
 * only when at least one of that line's own text items has geometry
 * positively overlapping the header path's range. A segment's own reported
 * bounds can be wider or narrower than the individual text items it
 * contains (upstream sometimes merges tokens into one segment without
 * widening its bounds to match, or reports a bounding box that does not
 * tightly track a right-aligned value); the text item is the only unit
 * whose geometry is directly observed for that specific value. Multiple
 * text items on the same line still count as one recurrence for that line,
 * never as multiple.
 */
function refineWideBand(
  graph: EvidenceGraph,
  pageNumber: number,
  headerBlockLineIds: ReadonlySet<string>,
  headerPaths: ReadonlyArray<HeaderPath>,
  textItemById: ReadonlyMap<string, EvidenceGraph["textItems"][number]>,
  band: CanonicalBand,
): ReadonlyArray<CanonicalBand> {
  const covering = headerPathsWithinBand(headerPaths, band);
  if (covering.length < 2) return [band];

  const sorted = [...covering].sort((left, right) => left.leftPoints - right.leftPoints);
  for (let index = 1; index < sorted.length; index += 1) {
    if (
      rangesPositivelyOverlap(
        sorted[index - 1]!.leftPoints,
        sorted[index - 1]!.rightPoints,
        sorted[index]!.leftPoints,
        sorted[index]!.rightPoints,
      )
    ) {
      return [band];
    }
  }

  const unionRoles = uniqueSortedRoles(sorted.flatMap((path) => path.candidateRoles)).filter(
    (role) => role !== "unknown",
  );
  if (unionRoles.length < 2) return [band];

  const dataLines = graph.lines.filter(
    (line) => line.pageNumber === pageNumber && !headerBlockLineIds.has(line.lineId),
  );
  const lineHasIntersectingTextItem = (
    line: EvidenceLine,
    leftPoints: number,
    rightPoints: number,
  ): boolean =>
    line.textItemEvidenceIds.some((id) => {
      const item = textItemById.get(id);
      if (item === undefined) return false;
      const bounds = boundsForLocatorId(graph, item.locatorId);
      return bounds !== null && bounds[0] < rightPoints && bounds[1] > leftPoints;
    });
  const recurrence = (leftPoints: number, rightPoints: number): number =>
    dataLines.filter((line) => lineHasIntersectingTextItem(line, leftPoints, rightPoints)).length;
  const minimumRecurrence = Math.min(2, dataLines.length);
  if (minimumRecurrence === 0) return [band];
  for (const path of sorted) {
    if (recurrence(path.leftPoints, path.rightPoints) < minimumRecurrence) return [band];
  }

  return sorted.map((path) => ({
    ...band,
    leftPoints: path.leftPoints,
    rightPoints: path.rightPoints,
    candidateRoles: path.candidateRoles,
    evidenceLocatorIds: uniqueSorted([...band.evidenceLocatorIds, ...path.atomLocatorIds]),
    groupingRuleId: "wide-band-geometric-split-v1" as const,
    bandProvenance: "upstream-refined" as const,
    headerAtomIds: uniqueSorted([...band.headerAtomIds, ...path.atomIds]),
    splitReasonCode:
      "distinct_non_overlapping_header_paths_with_incompatible_roles_and_data_recurrence",
  }));
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

function resolvePageColumns(
  input: BudgetTableReconstructionInput,
  graph: EvidenceGraph,
  pageNumber: number,
): ReadonlyArray<ResolvedColumn> {
  const headers = headerCandidates(graph, pageNumber);
  const headerPaths = buildHeaderPaths(graph, pageNumber);
  const headerBlockLineIds = new Set(headerBlockLines(graph, pageNumber).map((line) => line.lineId));
  const textItemById = new Map(graph.textItems.map((item) => [item.evidenceId, item]));

  const rawBands = rawBandsFromUpstream(input, graph, pageNumber, headerPaths);
  const grouped = rawBands.length > 0 ? groupRawBands(rawBands) : [];
  const refined = grouped.flatMap((band) =>
    refineWideBand(graph, pageNumber, headerBlockLineIds, headerPaths, textItemById, band),
  );

  const coveredHeaderPathIds = new Set(
    refined.flatMap((band) => headerPathsWithinBand(headerPaths, band).map((path) => path.headerPathId)),
  );
  const structural = headerPaths
    .filter((path) => !coveredHeaderPathIds.has(path.headerPathId))
    .map((path) => canonicalBandFromHeaderPath(pageNumber, path));

  const bands = [...refined, ...structural]
    .sort((left, right) => left.leftPoints - right.leftPoints || left.rightPoints - right.rightPoints)
    .map((band, index) => ({ ...band, horizontalOrder: index + 1 }));

  const preliminary = bands.map((band) => assembleResolvedColumn(pageNumber, band, headers));
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

export { headerCandidates as detectBudgetHeaderCandidates };
