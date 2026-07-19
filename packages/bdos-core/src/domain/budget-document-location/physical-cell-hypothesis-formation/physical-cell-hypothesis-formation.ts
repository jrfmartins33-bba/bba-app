import type { ReconstructedHorizontalSegment } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalCellHypothesis, PhysicalCellHypothesisSegmentDisposition, PhysicalGridIntersection } from "./budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalGridIntersectionDraft } from "./physical-grid-formation";
import type { PhysicalSegmentGridAssociationResult } from "./physical-segment-grid-association";
import { createBounds } from "./physical-grid-formation";
import { computeCellHypothesisKey } from "./physical-cell-hypothesis-formation-keys";
import { canonicalizePhysicalCellFormationBounds } from "./physical-cell-hypothesis-formation-output-geometry-canonicalization";
import { PHYSICAL_CELL_HYPOTHESIS_FORMATION_RULE_ID, PHYSICAL_CELL_HYPOTHESIS_FORMATION_RULE_VERSION, PROFILE } from "./physical-cell-hypothesis-formation-profile";

export interface PhysicalCellFormationResult {
  readonly intersections: ReadonlyArray<PhysicalGridIntersection>;
  readonly cells: ReadonlyArray<PhysicalCellHypothesis>;
  readonly dispositions: ReadonlyArray<PhysicalCellHypothesisSegmentDisposition>;
}

function contained(observed: ReturnType<typeof createBounds>, grid: ReturnType<typeof createBounds>): boolean {
  return observed.leftPoints >= grid.leftPoints && observed.rightPoints <= grid.rightPoints
    && observed.topPoints >= grid.topPoints && observed.bottomPoints <= grid.bottomPoints;
}

function publicIdentity(draft: PhysicalGridIntersectionDraft) {
  const { sourceLine: _line, sourceColumn: _column, ...identity } = draft;
  return { ...identity, gridBounds: canonicalizePhysicalCellFormationBounds(identity.gridBounds) };
}

export function formPhysicalCellHypotheses(
  drafts: ReadonlyArray<PhysicalGridIntersectionDraft>,
  segments: ReadonlyArray<ReconstructedHorizontalSegment>,
  associations: PhysicalSegmentGridAssociationResult,
): PhysicalCellFormationResult {
  const cells: PhysicalCellHypothesis[] = [];
  const dispositions = new Map(associations.dispositions);
  const intersections: PhysicalGridIntersection[] = [];
  for (const draft of drafts) {
    const identity = publicIdentity(draft);
    const partial = associations.partialByIntersection.get(draft.gridIntersectionKey);
    if (partial) {
      intersections.push({ ...identity, status: "unresolved_segment_association_ambiguity", ambiguityReason: "partial_segment_intersection", partiallyIntersectingSegmentKeys: [...partial].sort() });
      continue;
    }
    const multiple = associations.multipleByIntersection.get(draft.gridIntersectionKey);
    if (multiple) {
      intersections.push({ ...identity, status: "unresolved_segment_association_ambiguity", ambiguityReason: "segment_claimed_by_multiple_intersections", disputedSegmentKeys: [...multiple.segmentKeys].sort(), conflictingGridIntersectionKeys: multiple.conflictingIntersectionKeys });
      continue;
    }
    const members = [...(associations.containedByIntersection.get(draft.gridIntersectionKey) ?? [])].sort((a, b) => a.horizontalOrder - b.horizontalOrder || a.segmentKey.localeCompare(b.segmentKey));
    if (members.length === 0) {
      intersections.push({ ...identity, status: "empty" });
      continue;
    }
    const observed = canonicalizePhysicalCellFormationBounds(createBounds(
      Math.min(...members.map((entry) => entry.leftPoints)), Math.min(...members.map((entry) => entry.topPoints)),
      Math.max(...members.map((entry) => entry.rightPoints)), Math.max(...members.map((entry) => entry.bottomPoints)),
    ));
    if (!contained(observed, identity.gridBounds)) {
      intersections.push({ ...identity, status: "unresolved_segment_association_ambiguity", ambiguityReason: "observed_content_outside_grid_bounds", evidenceSegmentKeys: members.map((entry) => entry.segmentKey), observedContentBounds: observed });
      members.forEach((segment) => dispositions.set(segment.segmentKey, { status: "unresolved_partial_grid_intersection", segmentKey: segment.segmentKey, lineKey: segment.lineKey, partiallyIntersectedGridIntersectionKeys: [draft.gridIntersectionKey] }));
      continue;
    }
    const segmentKeys = members.map((entry) => entry.segmentKey);
    const cellHypothesisKey = computeCellHypothesisKey(draft.gridIntersectionKey, segmentKeys);
    cells.push({ cellHypothesisKey, gridIntersectionKey: draft.gridIntersectionKey, observedContentBounds: observed, segmentKeys, cellFormationRuleId: PHYSICAL_CELL_HYPOTHESIS_FORMATION_RULE_ID, cellFormationRuleVersion: PHYSICAL_CELL_HYPOTHESIS_FORMATION_RULE_VERSION, profileId: PROFILE.profileId, profileVersion: PROFILE.profileVersion });
    intersections.push({ ...identity, status: "cell_hypothesis_formed", cellHypothesisKey });
    members.forEach((segment) => dispositions.set(segment.segmentKey, { status: "included_in_physical_cell_hypothesis", segmentKey: segment.segmentKey, lineKey: segment.lineKey, gridIntersectionKey: draft.gridIntersectionKey, cellHypothesisKey }));
  }
  return { intersections, cells, dispositions: segments.map((segment) => dispositions.get(segment.segmentKey)!).filter(Boolean) };
}
