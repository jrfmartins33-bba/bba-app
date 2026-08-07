import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import type { EvidenceGraph } from "./budget-table-reconstruction-evidence-graph";
import {
  headerVocabularyRoles,
} from "./budget-table-reconstruction-profile";
import type {
  BudgetColumnRole,
  BudgetTableReconstructionInput,
  EvidenceSegment,
  ResolvedColumn,
} from "./budget-table-reconstruction.types";

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
}

interface HeaderCandidate {
  readonly lineId: string;
  readonly roles: ReadonlyArray<BudgetColumnRole>;
}

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSorted(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...new Set(values)].sort(ordinalCompare);
}

function sameStrings(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasEconomicLiteral(text: string): boolean {
  return /\d/.test(text) && /(?:[.,]\d|%|R\$)/i.test(text);
}

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

function boundsForSegment(
  graph: EvidenceGraph,
  segment: EvidenceSegment,
): readonly [number, number] | null {
  const locator = graph.locatorCatalog
    .entries()
    .find((entry) => entry.locatorId === segment.locatorId)?.locator;
  return locator?.bounds == null ? null : [locator.bounds[0], locator.bounds[2]];
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

function rolesAndHeaderEvidence(
  graph: EvidenceGraph,
  band: Pick<RawColumnBand, "pageNumber" | "leftPoints" | "rightPoints">,
  headers: ReadonlyArray<HeaderCandidate>,
): { roles: ReadonlyArray<BudgetColumnRole>; locatorIds: ReadonlyArray<string> } {
  const headerIds = new Set(headers.map((header) => header.lineId));
  const headerSegments = graph.segments.filter(
    (segment) =>
      segment.pageNumber === band.pageNumber &&
      headerIds.has(segment.lineId) &&
      segmentIntersects(graph, segment, band.leftPoints, band.rightPoints),
  );
  return {
    roles: uniqueSorted(
      headerSegments.flatMap((segment) => headerVocabularyRoles(segment.rawText)),
    ) as ReadonlyArray<BudgetColumnRole>,
    locatorIds: uniqueSorted(headerSegments.map((segment) => segment.locatorId)),
  };
}

function rawBandsFromUpstream(
  input: BudgetTableReconstructionInput,
  graph: EvidenceGraph,
  pageNumber: number,
  headers: ReadonlyArray<HeaderCandidate>,
): ReadonlyArray<RawColumnBand> {
  if (input.columnEvidence.availability === "unavailable") return [];
  const pages = input.columnEvidence.result.groups.flatMap((group) => group.pages);
  const sourcePage = pages.find((page) => page.pageNumber === pageNumber);
  if (sourcePage === undefined) return [];

  return sourcePage.regions
    .flatMap((region) =>
      region.hypotheses.map((hypothesis) => {
        const semantic = rolesAndHeaderEvidence(graph, hypothesis, headers);
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
              .filter((line) =>
                line.runtimeReference.lineKey !== null &&
                hypothesis.lineKeys.includes(line.runtimeReference.lineKey),
              )
              .map((line) => line.lineId),
          ),
          segmentIds: uniqueSorted(
            graph.segments
              .filter((segment) =>
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
          headerEvidenceLocatorIds: semantic.locatorIds,
          candidateRoles: semantic.roles,
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
  return left.leftPoints < right.rightPoints && right.leftPoints < left.rightPoints;
}

function simultaneouslyOccupied(left: RawColumnBand, right: RawColumnBand): boolean {
  const rightSegments = new Set(right.segmentIds);
  return left.lineIds.some((lineId) =>
    right.lineIds.includes(lineId) &&
    left.segmentIds.some((segmentId) => !rightSegments.has(segmentId)),
  );
}

function semanticallyEquivalent(left: RawColumnBand, right: RawColumnBand): boolean {
  const leftRoles = uniqueSorted(left.candidateRoles);
  const rightRoles = uniqueSorted(right.candidateRoles);
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
      candidateRoles: uniqueSorted(
        component.flatMap((band) => band.candidateRoles),
      ) as ReadonlyArray<BudgetColumnRole>,
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
    };
  });

  return grouped
    .sort(
      (left, right) =>
        left.leftPoints - right.leftPoints ||
        left.rightPoints - right.rightPoints ||
        ordinalCompare(
          left.representativePhysicalColumnHypothesisId!,
          right.representativePhysicalColumnHypothesisId!,
        ),
    )
    .map((band, index) => ({ ...band, horizontalOrder: index + 1 }));
}

function bandsFromHeaderGeometry(
  graph: EvidenceGraph,
  pageNumber: number,
  headers: ReadonlyArray<HeaderCandidate>,
): ReadonlyArray<CanonicalBand> {
  if (headers.length !== 1) return [];
  return graph.segments
    .filter((segment) => segment.lineId === headers[0]!.lineId)
    .map((segment) => ({ segment, bounds: boundsForSegment(graph, segment) }))
    .filter(
      (entry): entry is { segment: EvidenceSegment; bounds: readonly [number, number] } =>
        entry.bounds !== null,
    )
    .sort((left, right) => left.bounds[0] - right.bounds[0])
    .map((entry, index) => ({
      pageNumber,
      horizontalOrder: index + 1,
      leftPoints: entry.bounds[0],
      rightPoints: entry.bounds[1],
      candidateRoles: headerVocabularyRoles(entry.segment.rawText),
      evidenceLocatorIds: [entry.segment.locatorId],
      sourcePhysicalColumnHypothesisIds: [],
      contributingRegionIds: [],
      contributingLineIds: [entry.segment.lineId],
      contributingSegmentIds: [entry.segment.segmentId],
      groupingRuleId: "header-band-v1",
      representativePhysicalColumnHypothesisId: null,
      nonGroupingReasonCodes: [],
    }));
}

function resolvePageColumns(
  input: BudgetTableReconstructionInput,
  graph: EvidenceGraph,
  pageNumber: number,
): ReadonlyArray<ResolvedColumn> {
  const headers = headerCandidates(graph, pageNumber);
  const rawBands = rawBandsFromUpstream(input, graph, pageNumber, headers);
  const bands = rawBands.length > 0
    ? groupRawBands(rawBands)
    : bandsFromHeaderGeometry(graph, pageNumber, headers);

  const preliminary = bands.map((band): ResolvedColumn => {
    const candidateRoles = band.candidateRoles;
    const role = candidateRoles.length === 1 ? candidateRoles[0]! : "unknown";
    return {
      columnId: `column:${fingerprintCanonical({
        pageNumber,
        sourcePhysicalColumnHypothesisIds: band.sourcePhysicalColumnHypothesisIds,
        representative: [band.leftPoints, band.rightPoints],
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
      representativePhysicalColumnHypothesisId:
        band.representativePhysicalColumnHypothesisId,
      nonGroupingReasonCodes: band.nonGroupingReasonCodes,
    };
  });

  const duplicateRoles = new Set(
    preliminary
      .filter(
        (column, index, all) =>
          column.role !== "unknown" &&
          all.findIndex((candidate) => candidate.role === column.role) !== index,
      )
      .map((column) => column.role),
  );
  return preliminary.map((column) =>
    duplicateRoles.has(column.role)
      ? { ...column, role: "unknown", status: "ambiguous" }
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
