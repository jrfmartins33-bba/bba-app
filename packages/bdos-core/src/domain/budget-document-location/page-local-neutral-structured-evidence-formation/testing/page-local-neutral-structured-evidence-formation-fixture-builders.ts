import type { ReconstructedBudgetDocumentPage, ReconstructedHorizontalSegment, ReconstructedPhysicalLine } from "../../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { AmbiguousPhysicalGridIntersection, EmptyPhysicalGridIntersection, FailedPhysicalGridIntersection, PhysicalCellHypothesis, PhysicalCellHypothesisFormationRegion, PhysicalGridIntersection, PhysicalGridIntersectionWithCell } from "../../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalCellTextEvidence, PhysicalCellTextEvidenceFormationRegion, PhysicalCellTextFragment, PhysicalCellTextSegmentOutcome } from "../../physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";
import type { TabularRegionCandidate } from "../../tabular-region-detection/budget-document-tabular-region-detection.types";

/**
 * Helpers de fixture mínimos, exclusivamente de teste, para exercitar os
 * construtores documentais e os portões de conservação diretamente, sem
 * atravessar a cadeia real inteira — mesma disciplina da g.1. Reaproveita os
 * construtores da g.1 para linha/segmento/interseção/hipótese; nunca vira
 * fixture de produção; não exportada pelo barrel público.
 */
export { structureLine, structureSegment, gridIntersection, cellHypothesis } from "../../physical-cell-text-evidence-formation/testing/physical-cell-text-evidence-formation-fixture-builders";

const bounds = { leftPoints: 0, topPoints: 0, rightPoints: 10, bottomPoints: 10, widthPoints: 10, heightPoints: 10, centerXPoints: 5, centerYPoints: 5 };

export function regionCandidate(regionKey: string, pageNumber: number, order: number, lineKeys: ReadonlyArray<string>): TabularRegionCandidate {
  return {
    regionKey, pageNumber, order, lineKeys, supportingAlignmentKeys: ["align-1", "align-2"],
    leftPoints: 0, topPoints: 0, rightPoints: 100, bottomPoints: 50, widthPoints: 100, heightPoints: 50, centerXPoints: 50, centerYPoints: 25,
    formationRuleId: "fixture", formationRuleVersion: 1, profileId: "fixture", profileVersion: 1,
  };
}

export function emptyIntersection(gridIntersectionKey: string, sourceLineKey: string, rowOrder: number, columnOrder: number, pageNumber: number, sourceRegionKey: string): EmptyPhysicalGridIntersection {
  return { gridIntersectionKey, sourceLineKey, sourcePhysicalColumnHypothesisKey: `column-${columnOrder}`, sourceRegionKey, pageNumber, rowOrder, columnOrder, gridBounds: bounds, gridFormationRuleId: "fixture", gridFormationRuleVersion: 1, profileId: "fixture", profileVersion: 1, status: "empty" };
}

export function ambiguousIntersection(gridIntersectionKey: string, sourceLineKey: string, rowOrder: number, columnOrder: number, pageNumber: number, sourceRegionKey: string, reason: AmbiguousPhysicalGridIntersection["ambiguityReason"]): AmbiguousPhysicalGridIntersection {
  const base = { gridIntersectionKey, sourceLineKey, sourcePhysicalColumnHypothesisKey: `column-${columnOrder}`, sourceRegionKey, pageNumber, rowOrder, columnOrder, gridBounds: bounds, gridFormationRuleId: "fixture", gridFormationRuleVersion: 1, profileId: "fixture", profileVersion: 1, status: "unresolved_segment_association_ambiguity" as const };
  if (reason === "partial_segment_intersection") return { ...base, ambiguityReason: "partial_segment_intersection", partiallyIntersectingSegmentKeys: ["seg-x"] };
  if (reason === "segment_claimed_by_multiple_intersections") return { ...base, ambiguityReason: "segment_claimed_by_multiple_intersections", disputedSegmentKeys: ["seg-x"], conflictingGridIntersectionKeys: ["gi-other"] };
  return { ...base, ambiguityReason: "observed_content_outside_grid_bounds", evidenceSegmentKeys: ["seg-x"], observedContentBounds: bounds };
}

export function failedIntersection(gridIntersectionKey: string, sourceLineKey: string, rowOrder: number, columnOrder: number, pageNumber: number, sourceRegionKey: string): FailedPhysicalGridIntersection {
  return { gridIntersectionKey, sourceLineKey, sourcePhysicalColumnHypothesisKey: `column-${columnOrder}`, sourceRegionKey, pageNumber, rowOrder, columnOrder, gridBounds: bounds, gridFormationRuleId: "fixture", gridFormationRuleVersion: 1, profileId: "fixture", profileVersion: 1, status: "unresolved_technical_failure", failedPhase: "cell_hypothesis_formation", affectedSegmentKeys: ["seg-x"] };
}

export function fragment(sourceReferenceOrder: number, textItemIndex: number, originalText: string, normalizedText: string): PhysicalCellTextFragment {
  return { sourceReferenceOrder, textItemIndex, originalText, normalizedText };
}

export function resolvedSegment(segmentKey: string, lineKey: string, fragments: ReadonlyArray<PhysicalCellTextFragment>): PhysicalCellTextSegmentOutcome {
  return { status: "resolved", segmentKey, lineKey, fragments, itemDispositions: fragments.map((f) => ({ status: "included_in_text_fragment", segmentKey, sourceReferenceOrder: f.sourceReferenceOrder, textItemIndex: f.textItemIndex })) };
}

export function textEvidence(cellHypothesisKey: string, gridIntersectionKey: string, status: PhysicalCellTextEvidence["status"], segmentOutcomes: ReadonlyArray<PhysicalCellTextSegmentOutcome>): PhysicalCellTextEvidence {
  return { status, cellHypothesisKey, gridIntersectionKey, segmentOutcomes } as PhysicalCellTextEvidence;
}

const zeroCellHypothesisRegionMetrics = {
  sourceLineCount: 0, sourcePhysicalColumnHypothesisCount: 0, totalGridIntersectionCount: 0, cellHypothesisFormedIntersectionCount: 0, emptyGridIntersectionCount: 0, ambiguousGridIntersectionCount: 0, formationFailedGridIntersectionCount: 0,
  totalRegionSegmentCount: 0, includedSegmentCount: 0, outsideSegmentCount: 0, inheritedAmbiguousSegmentCount: 0, partialIntersectionSegmentCount: 0, multipleClaimSegmentCount: 0, sourceContractInconsistentSegmentCount: 0, upstreamRegionNotProcessableSegmentCount: 0, inheritedPhysicalColumnHypothesisFailureSegmentCount: 0, formationFailedSegmentCount: 0,
  cellHypothesisCount: 0, multiSegmentCellHypothesisCount: 0, technicalProblemCount: 0,
};

export function cellFormationRegion(sourceRegionKey: string, pageNumber: number, status: PhysicalCellHypothesisFormationRegion["status"], gridIntersections: ReadonlyArray<PhysicalGridIntersection>, cellHypotheses: ReadonlyArray<PhysicalCellHypothesis>): PhysicalCellHypothesisFormationRegion {
  return {
    regionProcessedKey: `region-${sourceRegionKey}`, sourceRegionKey, pageNumber, sourcePhysicalColumnHypothesisRegionStatus: "hypotheses_reconstructed",
    status, gridIntersections, cellHypotheses, segmentDispositions: [], technicalProblems: [], metrics: zeroCellHypothesisRegionMetrics, profileId: "fixture", profileVersion: 1,
  };
}

const zeroTextEvidenceRegionMetrics = {
  sourceCellHypothesisCount: 0, cellTextEvidenceFormedCount: 0, cellTextEvidencePartiallyFormedCount: 0, cellTextEvidenceFailedCount: 0,
  sourceSegmentReferenceCount: 0, segmentResolvedCount: 0, segmentReferenceInvalidCount: 0, segmentIncompatibleCount: 0, segmentFormationFailedCount: 0,
  totalEligibleTextItemReferenceCount: 0, includedTextItemReferenceCount: 0, invalidReferenceTextItemCount: 0, duplicateReferenceTextItemCount: 0, segmentMismatchTextItemCount: 0, formationFailedTextItemCount: 0, technicalProblemCount: 0,
};

export function textEvidenceRegion(sourceRegionKey: string, pageNumber: number, status: PhysicalCellTextEvidenceFormationRegion["status"], cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>): PhysicalCellTextEvidenceFormationRegion {
  return {
    regionProcessedKey: `text-region-${sourceRegionKey}`, sourceRegionKey, pageNumber, sourcePhysicalCellHypothesisFormationRegionStatus: "formed",
    status, cellTextEvidences, technicalProblems: [], metrics: zeroTextEvidenceRegionMetrics,
  };
}

export function structureMaps(lines: ReadonlyArray<ReconstructedPhysicalLine>, segments: ReadonlyArray<ReconstructedHorizontalSegment>): { lineByKey: ReadonlyMap<string, ReconstructedPhysicalLine>; segmentByKey: ReadonlyMap<string, ReconstructedHorizontalSegment> } {
  return { lineByKey: new Map(lines.map((line) => [line.lineKey, line])), segmentByKey: new Map(segments.map((segment) => [segment.segmentKey, segment])) };
}

export type { ReconstructedBudgetDocumentPage, PhysicalGridIntersectionWithCell };
