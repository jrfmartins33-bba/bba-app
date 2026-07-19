import type { PhysicalDocumentPage, PhysicalDocumentTextItem } from "../../physical-document-read.types";
import type { ReconstructedBudgetDocumentPage, ReconstructedHorizontalSegment, ReconstructedPhysicalLine, SourceTextItemReconstructionOutcome } from "../../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalCellHypothesis, PhysicalCellHypothesisFormationRegion, PhysicalGridIntersectionWithCell } from "../../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";

/**
 * Helpers de fixture mínimos, exclusivamente de teste, para exercitar
 * `formRegionCellTextEvidences` e os portões de conservação diretamente, sem
 * atravessar a cadeia real inteira — mesma disciplina de
 * `physical-cell-hypothesis-formation.golden-trace.test.ts` (funções `line`/
 * `segment`/`column`). Nunca vira fixture de produção; não exportada pelo
 * barrel público.
 */

export function physicalItem(index: number, text: string): PhysicalDocumentTextItem {
  return {
    index,
    text,
    placement: { status: "placed", geometry: { leftPoints: 0, topPoints: 0, rightPoints: 10, bottomPoints: 10, widthPoints: 10, heightPoints: 10, centerXPoints: 5, centerYPoints: 5, pageBoundsRelation: "inside", coordinateSpaceVersion: "physical-document-text-item-coordinate-space-v1" as never, geometryProfileVersion: "physical-document-text-item-geometry-profile-v1" as never }, reasonCode: null },
  };
}

export function physicalPage(pageNumber: number, items: ReadonlyArray<PhysicalDocumentTextItem>): PhysicalDocumentPage {
  return {
    pageNumber, widthPoints: 612, heightPoints: 792, rotationDegrees: 0, orientation: "portrait",
    textItems: items, normalizedText: items.map((item) => item.text).join("\n"),
    metrics: { textItemCount: items.length, nonEmptyCharacterCount: 0, replacementCharacterCount: 0, unexpectedControlCharacterCount: 0 },
    textItemPlacementMetrics: { totalAdmittedTextItemCount: items.length, placedTextItemCount: items.length, unresolvedMissingGeometryCount: 0, unresolvedInvalidGeometryCount: 0, unresolvedUnsupportedOrientationCount: 0, unresolvedNormalizationFailedCount: 0 },
    extractionAvailability: "text_available", technicalProblems: [],
  };
}

export function structureLine(lineKey: string, pageNumber: number, segmentKeys: ReadonlyArray<string>): ReconstructedPhysicalLine {
  return { lineKey, pageNumber, verticalOrder: 1, leftPoints: 0, topPoints: 0, rightPoints: 100, bottomPoints: 10, widthPoints: 100, heightPoints: 10, centerXPoints: 50, centerYPoints: 5, seedSourceTextItemIndex: 0, sourceTextItemIndices: [], segmentKeys, formationRuleId: "fixture", formationRuleVersion: 1, profileId: "fixture", profileVersion: 1 };
}

export function structureSegment(segmentKey: string, lineKey: string, pageNumber: number, horizontalOrder: number, sourceTextItemIndices: ReadonlyArray<number>): ReconstructedHorizontalSegment {
  return { segmentKey, lineKey, pageNumber, horizontalOrder, leftPoints: 0, topPoints: 0, rightPoints: 50, bottomPoints: 10, widthPoints: 50, heightPoints: 10, centerXPoints: 25, centerYPoints: 5, sourceTextItemIndices, observedInternalGaps: sourceTextItemIndices.length > 1 ? sourceTextItemIndices.slice(1).map(() => 0) : [], formationRuleId: "fixture", formationRuleVersion: 1, profileId: "fixture", profileVersion: 1 };
}

export function placedOutcome(sourceTextItemIndex: number, lineKey: string, segmentKey: string): SourceTextItemReconstructionOutcome {
  return { status: "placed", sourceTextItemIndex, lineKey, segmentKey };
}

export function buildStructurePage(pageNumber: number, lines: ReadonlyArray<ReconstructedPhysicalLine>, segments: ReadonlyArray<ReconstructedHorizontalSegment>, sourceItemOutcomes: ReadonlyArray<SourceTextItemReconstructionOutcome>): ReconstructedBudgetDocumentPage {
  return {
    pageReconstructionKey: `page-${pageNumber}`, pageNumber, candidateType: "direct", sourceDecisionReasonCode: "candidate_service_item_and_total",
    status: "reconstructed", sourceItemOutcomes, lines, segments, blocks: [], technicalProblems: [],
    metrics: { totalSourceTextItemCount: sourceItemOutcomes.length, placedTextItemCount: sourceItemOutcomes.filter((o) => o.status === "placed").length, ignoredWhitespaceOnlyCount: 0, excludedOutsidePageCount: 0, unresolvedMissingGeometryCount: 0, unresolvedInvalidGeometryCount: 0, unresolvedUnsupportedOrientationCount: 0, unresolvedNormalizationFailedCount: 0, unresolvedStructureReconstructionFailedCount: 0, lineCount: lines.length, segmentCount: segments.length, blockCount: 0 },
    profileId: "fixture", profileVersion: 1,
  };
}

export function gridIntersection(gridIntersectionKey: string, sourceLineKey: string, rowOrder: number, columnOrder: number, cellHypothesisKey: string, pageNumber: number, sourceRegionKey: string): PhysicalGridIntersectionWithCell {
  return {
    gridIntersectionKey, sourceLineKey, sourcePhysicalColumnHypothesisKey: `column-${columnOrder}`, sourceRegionKey, pageNumber, rowOrder, columnOrder,
    gridBounds: { leftPoints: 0, topPoints: 0, rightPoints: 10, bottomPoints: 10, widthPoints: 10, heightPoints: 10, centerXPoints: 5, centerYPoints: 5 },
    gridFormationRuleId: "fixture", gridFormationRuleVersion: 1, profileId: "fixture", profileVersion: 1,
    status: "cell_hypothesis_formed", cellHypothesisKey,
  };
}

export function cellHypothesis(cellHypothesisKey: string, gridIntersectionKey: string, segmentKeys: ReadonlyArray<string>): PhysicalCellHypothesis {
  return {
    cellHypothesisKey, gridIntersectionKey,
    observedContentBounds: { leftPoints: 0, topPoints: 0, rightPoints: 10, bottomPoints: 10, widthPoints: 10, heightPoints: 10, centerXPoints: 5, centerYPoints: 5 },
    segmentKeys, cellFormationRuleId: "fixture", cellFormationRuleVersion: 1, profileId: "fixture", profileVersion: 1,
  };
}

export function cellFormationRegion(sourceRegionKey: string, pageNumber: number, gridIntersections: ReadonlyArray<PhysicalGridIntersectionWithCell>, cellHypotheses: ReadonlyArray<PhysicalCellHypothesis>): PhysicalCellHypothesisFormationRegion {
  return {
    regionProcessedKey: `region-${sourceRegionKey}`, sourceRegionKey, pageNumber, sourcePhysicalColumnHypothesisRegionStatus: "hypotheses_reconstructed",
    status: "formed", gridIntersections, cellHypotheses, segmentDispositions: [], technicalProblems: [],
    metrics: { sourceLineCount: 0, sourcePhysicalColumnHypothesisCount: 0, totalGridIntersectionCount: gridIntersections.length, cellHypothesisFormedIntersectionCount: gridIntersections.length, emptyGridIntersectionCount: 0, ambiguousGridIntersectionCount: 0, formationFailedGridIntersectionCount: 0, totalRegionSegmentCount: 0, includedSegmentCount: 0, outsideSegmentCount: 0, inheritedAmbiguousSegmentCount: 0, partialIntersectionSegmentCount: 0, multipleClaimSegmentCount: 0, sourceContractInconsistentSegmentCount: 0, upstreamRegionNotProcessableSegmentCount: 0, inheritedPhysicalColumnHypothesisFailureSegmentCount: 0, formationFailedSegmentCount: 0, cellHypothesisCount: cellHypotheses.length, multiSegmentCellHypothesisCount: cellHypotheses.filter((cell) => cell.segmentKeys.length > 1).length, technicalProblemCount: 0 },
    profileId: "fixture", profileVersion: 1,
  };
}
