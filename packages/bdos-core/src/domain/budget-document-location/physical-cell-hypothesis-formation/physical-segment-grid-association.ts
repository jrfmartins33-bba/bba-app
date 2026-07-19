import type { ReconstructedHorizontalSegment } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalColumnHypothesisSegmentDisposition } from "../physical-column-hypothesis-reconstruction/budget-document-physical-column-hypothesis-reconstruction.types";
import type { PhysicalCellHypothesisSegmentDisposition } from "./budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalGridIntersectionDraft } from "./physical-grid-formation";
import { createBounds } from "./physical-grid-formation";

export interface PhysicalSegmentGridAssociationResult {
  readonly containedByIntersection: ReadonlyMap<string, ReadonlyArray<ReconstructedHorizontalSegment>>;
  readonly partialByIntersection: ReadonlyMap<string, ReadonlyArray<string>>;
  readonly multipleByIntersection: ReadonlyMap<string, { readonly segmentKeys: ReadonlyArray<string>; readonly conflictingIntersectionKeys: ReadonlyArray<string> }>;
  readonly dispositions: ReadonlyMap<string, PhysicalCellHypothesisSegmentDisposition>;
}

function contains(segment: ReconstructedHorizontalSegment, grid: PhysicalGridIntersectionDraft): boolean {
  return segment.leftPoints >= grid.gridBounds.leftPoints && segment.rightPoints <= grid.gridBounds.rightPoints
    && segment.topPoints >= grid.gridBounds.topPoints && segment.bottomPoints <= grid.gridBounds.bottomPoints;
}

function positivelyIntersects(segment: ReconstructedHorizontalSegment, grid: PhysicalGridIntersectionDraft): boolean {
  const segmentBounds = createBounds(segment.leftPoints, segment.topPoints, segment.rightPoints, segment.bottomPoints);
  return Math.min(segmentBounds.rightPoints, grid.gridBounds.rightPoints) - Math.max(segmentBounds.leftPoints, grid.gridBounds.leftPoints) > 0
    && Math.min(segmentBounds.bottomPoints, grid.gridBounds.bottomPoints) - Math.max(segmentBounds.topPoints, grid.gridBounds.topPoints) > 0;
}

export function associateSegmentsToPhysicalGrid(
  segments: ReadonlyArray<ReconstructedHorizontalSegment>,
  intersections: ReadonlyArray<PhysicalGridIntersectionDraft>,
  upstreamDispositions: ReadonlyArray<PhysicalColumnHypothesisSegmentDisposition>,
): PhysicalSegmentGridAssociationResult {
  const intersectionsByLine = new Map<string, PhysicalGridIntersectionDraft[]>();
  intersections.forEach((intersection) => intersectionsByLine.set(intersection.sourceLineKey, [...(intersectionsByLine.get(intersection.sourceLineKey) ?? []), intersection]));
  const inherited = new Map(upstreamDispositions.filter((entry) => entry.status === "unresolved_physical_column_hypothesis_ambiguity").map((entry) => [entry.segmentKey, entry]));
  const contained = new Map<string, ReconstructedHorizontalSegment[]>();
  const partial = new Map<string, string[]>();
  const multiple = new Map<string, { segmentKeys: string[]; conflicting: Set<string> }>();
  const dispositions = new Map<string, PhysicalCellHypothesisSegmentDisposition>();

  for (const segment of segments) {
    const inheritedDisposition = inherited.get(segment.segmentKey);
    if (inheritedDisposition) {
      dispositions.set(segment.segmentKey, { status: "unresolved_inherited_column_ambiguity", segmentKey: segment.segmentKey, lineKey: segment.lineKey, conflictingCandidateHypothesisKeys: inheritedDisposition.conflictingCandidateHypothesisKeys });
      continue;
    }
    const candidates = intersectionsByLine.get(segment.lineKey) ?? [];
    const full = candidates.filter((intersection) => contains(segment, intersection));
    const partialCandidates = candidates.filter((intersection) => !contains(segment, intersection) && positivelyIntersects(segment, intersection));
    if (partialCandidates.length > 0) {
      const keys = partialCandidates.map((entry) => entry.gridIntersectionKey);
      dispositions.set(segment.segmentKey, { status: "unresolved_partial_grid_intersection", segmentKey: segment.segmentKey, lineKey: segment.lineKey, partiallyIntersectedGridIntersectionKeys: keys });
      partialCandidates.forEach((entry) => partial.set(entry.gridIntersectionKey, [...(partial.get(entry.gridIntersectionKey) ?? []), segment.segmentKey]));
    } else if (full.length > 1) {
      const keys = full.map((entry) => entry.gridIntersectionKey);
      dispositions.set(segment.segmentKey, { status: "unresolved_multiple_grid_intersection_claim", segmentKey: segment.segmentKey, lineKey: segment.lineKey, claimingGridIntersectionKeys: keys });
      full.forEach((entry) => {
        const current = multiple.get(entry.gridIntersectionKey) ?? { segmentKeys: [], conflicting: new Set<string>() };
        current.segmentKeys.push(segment.segmentKey);
        keys.filter((key) => key !== entry.gridIntersectionKey).forEach((key) => current.conflicting.add(key));
        multiple.set(entry.gridIntersectionKey, current);
      });
    } else if (full.length === 1) {
      contained.set(full[0].gridIntersectionKey, [...(contained.get(full[0].gridIntersectionKey) ?? []), segment]);
    } else {
      dispositions.set(segment.segmentKey, { status: "outside_all_physical_cell_hypotheses", segmentKey: segment.segmentKey, lineKey: segment.lineKey });
    }
  }

  return {
    containedByIntersection: contained,
    partialByIntersection: partial,
    multipleByIntersection: new Map([...multiple].map(([key, value]) => [key, { segmentKeys: value.segmentKeys, conflictingIntersectionKeys: [...value.conflicting].sort() }])),
    dispositions,
  };
}
