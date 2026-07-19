import type { PhysicalDocumentPage } from "../physical-document-read.types";
import type { ReconstructedBudgetDocumentPage, ReconstructedHorizontalSegment } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalCellHypothesis, PhysicalCellHypothesisFormationRegion } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { FailedPhysicalCellTextSegmentOutcome, InvalidPhysicalCellTextSegmentLineReference, InvalidPhysicalCellTextSegmentReference, PhysicalCellTextEvidence, PhysicalCellTextEvidenceFormationTechnicalProblem, PhysicalCellTextSegmentLineMismatch, PhysicalCellTextSegmentMultipleCellReference, PhysicalCellTextSegmentOutcome, PhysicalCellTextSegmentPageMismatch, ResolvedPhysicalCellTextSegmentOutcome } from "./budget-document-physical-cell-text-evidence-formation.types";
import { buildSegmentOwnerByTextItemIndex, buildTextItemByIndex, conflictingReferencesFor, findRegionWideDuplicateOccurrences, resolveTextItemOccurrence, type CandidateTextItemOccurrence } from "./physical-cell-text-item-resolution";
import { problem } from "./physical-cell-text-evidence-formation-technical-problem";

type SegmentOutcomeFailure = InvalidPhysicalCellTextSegmentReference | InvalidPhysicalCellTextSegmentLineReference | PhysicalCellTextSegmentLineMismatch | PhysicalCellTextSegmentPageMismatch | PhysicalCellTextSegmentMultipleCellReference;

type SegmentOutcomeDraft =
  | { readonly kind: "failure"; readonly outcome: SegmentOutcomeFailure }
  | { readonly kind: "pending"; readonly segmentKey: string; readonly lineKey: string; readonly segment: ReconstructedHorizontalSegment };

function problemForSegmentFailure(failure: SegmentOutcomeFailure, context: { readonly groupKey: string; readonly pageNumber: number; readonly regionKey: string; readonly cellHypothesisKey: string }): PhysicalCellTextEvidenceFormationTechnicalProblem {
  const base = { groupKey: context.groupKey, pageNumber: context.pageNumber, regionKey: context.regionKey, cellHypothesisKey: context.cellHypothesisKey, segmentKey: failure.segmentKey };
  if (failure.status === "unresolved_segment_reference_invalid") return problem("source_segment_reference_invalid", "segment_resolution", base);
  if (failure.reason === "line_reference_invalid") return problem("source_line_reference_invalid", "segment_resolution", base);
  return problem("source_segment_incompatible", "segment_resolution", base);
}

/** Resolve um único segmentKey contra a interseção da célula, a linha e a página esperadas — sem ainda tocar itens textuais. */
function resolveSegmentReference(
  segmentKey: string,
  expectedLineKey: string,
  expectedPageNumber: number,
  conflictingCellHypothesisKeys: ReadonlyArray<string>,
  structureSegmentByKey: ReadonlyMap<string, ReconstructedHorizontalSegment>,
  structureLineByKey: ReadonlyMap<string, unknown>,
): SegmentOutcomeDraft {
  if (conflictingCellHypothesisKeys.length > 1) {
    return { kind: "failure", outcome: { status: "unresolved_segment_incompatible", reason: "referenced_by_multiple_cell_hypotheses", segmentKey, conflictingCellHypothesisKeys } };
  }
  const segment = structureSegmentByKey.get(segmentKey);
  if (!segment) return { kind: "failure", outcome: { status: "unresolved_segment_reference_invalid", segmentKey } };
  if (!structureLineByKey.has(segment.lineKey)) {
    return { kind: "failure", outcome: { status: "unresolved_segment_incompatible", reason: "line_reference_invalid", segmentKey, referencedLineKey: segment.lineKey } };
  }
  if (segment.lineKey !== expectedLineKey) {
    return { kind: "failure", outcome: { status: "unresolved_segment_incompatible", reason: "line_mismatch", segmentKey, expectedLineKey, actualLineKey: segment.lineKey } };
  }
  if (segment.pageNumber !== expectedPageNumber) {
    return { kind: "failure", outcome: { status: "unresolved_segment_incompatible", reason: "page_mismatch", segmentKey, expectedPageNumber, actualPageNumber: segment.pageNumber } };
  }
  return { kind: "pending", segmentKey, lineKey: segment.lineKey, segment };
}

function cellStatusFor(segmentOutcomes: ReadonlyArray<PhysicalCellTextSegmentOutcome>): PhysicalCellTextEvidence["status"] {
  const allResolved = segmentOutcomes.every((outcome) => outcome.status === "resolved");
  const dispositions = segmentOutcomes.flatMap((outcome) => (outcome.status === "resolved" ? outcome.itemDispositions : []));
  const anyIncluded = dispositions.some((disposition) => disposition.status === "included_in_text_fragment");
  const allIncluded = dispositions.length > 0 && dispositions.every((disposition) => disposition.status === "included_in_text_fragment");
  if (allResolved && allIncluded) return "formed";
  if (!anyIncluded) return "unresolved_technical_failure";
  return "partially_formed";
}

export function formRegionCellTextEvidences(
  region: PhysicalCellHypothesisFormationRegion,
  structurePage: ReconstructedBudgetDocumentPage,
  physicalPage: PhysicalDocumentPage,
  context: { readonly groupKey: string; readonly regionKey: string },
): { readonly cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>; readonly technicalProblems: ReadonlyArray<PhysicalCellTextEvidenceFormationTechnicalProblem> } {
  const structureSegmentByKey = new Map(structurePage.segments.map((segment) => [segment.segmentKey, segment]));
  const structureLineByKey = new Map(structurePage.lines.map((line) => [line.lineKey, line]));
  const intersectionByKey = new Map(region.gridIntersections.map((entry) => [entry.gridIntersectionKey, entry]));
  const segmentClaims = new Map<string, string[]>();
  region.cellHypotheses.forEach((cell) => {
    cell.segmentKeys.forEach((segmentKey) => {
      const existing = segmentClaims.get(segmentKey);
      if (existing) existing.push(cell.cellHypothesisKey);
      else segmentClaims.set(segmentKey, [cell.cellHypothesisKey]);
    });
  });

  const textItemByIndex = buildTextItemByIndex(physicalPage);
  const segmentOwnerByTextItemIndex = buildSegmentOwnerByTextItemIndex(structurePage);

  const orderedCells = [...region.cellHypotheses].sort((a, b) => {
    const intersectionA = intersectionByKey.get(a.gridIntersectionKey);
    const intersectionB = intersectionByKey.get(b.gridIntersectionKey);
    const rowA = intersectionA && "rowOrder" in intersectionA ? intersectionA.rowOrder : 0;
    const rowB = intersectionB && "rowOrder" in intersectionB ? intersectionB.rowOrder : 0;
    const columnA = intersectionA && "columnOrder" in intersectionA ? intersectionA.columnOrder : 0;
    const columnB = intersectionB && "columnOrder" in intersectionB ? intersectionB.columnOrder : 0;
    return rowA - rowB || columnA - columnB || a.cellHypothesisKey.localeCompare(b.cellHypothesisKey);
  });

  const technicalProblems: PhysicalCellTextEvidenceFormationTechnicalProblem[] = [];
  const allOccurrences: CandidateTextItemOccurrence[] = [];

  interface CellState {
    readonly cell: PhysicalCellHypothesis;
    readonly drafts: ReadonlyArray<SegmentOutcomeDraft>;
    readonly orderInvalid: boolean;
  }
  const cellStates: CellState[] = orderedCells.map((cell) => {
    const intersection = intersectionByKey.get(cell.gridIntersectionKey)!;
    const expectedLineKey = intersection.sourceLineKey;
    const expectedPageNumber = region.pageNumber;
    const drafts = cell.segmentKeys.map((segmentKey) =>
      resolveSegmentReference(segmentKey, expectedLineKey, expectedPageNumber, segmentClaims.get(segmentKey) ?? [], structureSegmentByKey, structureLineByKey),
    );

    const pendingWithOrder = drafts
      .map((draft, position) => ({ draft, position }))
      .filter((entry): entry is { draft: Extract<SegmentOutcomeDraft, { kind: "pending" }>; position: number } => entry.draft.kind === "pending");
    const orderInvalid = pendingWithOrder.some((entry, index) => index > 0 && entry.draft.segment.horizontalOrder <= pendingWithOrder[index - 1].draft.segment.horizontalOrder);

    return { cell, drafts, orderInvalid };
  });

  cellStates.forEach(({ cell, drafts, orderInvalid }) => {
    if (orderInvalid) {
      technicalProblems.push(problem("source_cell_hypothesis_segment_order_invalid", "segment_resolution", { groupKey: context.groupKey, pageNumber: region.pageNumber, regionKey: context.regionKey, cellHypothesisKey: cell.cellHypothesisKey }));
      return;
    }
    drafts.forEach((draft) => {
      if (draft.kind === "failure") {
        technicalProblems.push(problemForSegmentFailure(draft.outcome, { groupKey: context.groupKey, pageNumber: region.pageNumber, regionKey: context.regionKey, cellHypothesisKey: cell.cellHypothesisKey }));
        return;
      }
      draft.segment.sourceTextItemIndices.forEach((textItemIndex, position) => {
        allOccurrences.push({ cellHypothesisKey: cell.cellHypothesisKey, segmentKey: draft.segmentKey, sourceReferenceOrder: position + 1, textItemIndex });
      });
    });
  });

  const duplicateOccurrences = findRegionWideDuplicateOccurrences(allOccurrences);
  const allDuplicatesList = [...duplicateOccurrences];
  const occurrencesBySegment = new Map<string, CandidateTextItemOccurrence[]>();
  allOccurrences.forEach((occurrence) => {
    const existing = occurrencesBySegment.get(occurrence.segmentKey);
    if (existing) existing.push(occurrence);
    else occurrencesBySegment.set(occurrence.segmentKey, [occurrence]);
  });

  const cellTextEvidences: PhysicalCellTextEvidence[] = cellStates.map(({ cell, drafts, orderInvalid }) => {
    if (orderInvalid) {
      const segmentOutcomes: FailedPhysicalCellTextSegmentOutcome[] = cell.segmentKeys.map((segmentKey) => ({ status: "unresolved_segment_formation_failed", segmentKey, failedPhase: "segment_resolution" }));
      return { status: "unresolved_technical_failure", cellHypothesisKey: cell.cellHypothesisKey, gridIntersectionKey: cell.gridIntersectionKey, segmentOutcomes };
    }
    const segmentOutcomes: PhysicalCellTextSegmentOutcome[] = drafts.map((draft) => {
      if (draft.kind === "failure") return draft.outcome;
      const occurrences = occurrencesBySegment.get(draft.segmentKey) ?? [];
      const fragments: ResolvedPhysicalCellTextSegmentOutcome["fragments"][number][] = [];
      const itemDispositions: ResolvedPhysicalCellTextSegmentOutcome["itemDispositions"][number][] = [];
      occurrences.forEach((occurrence) => {
        if (duplicateOccurrences.has(occurrence)) {
          const conflictingReferences = conflictingReferencesFor(occurrence, allDuplicatesList);
          itemDispositions.push({ status: "unresolved_source_text_item_duplicate_reference", segmentKey: occurrence.segmentKey, sourceReferenceOrder: occurrence.sourceReferenceOrder, textItemIndex: occurrence.textItemIndex, conflictingReferences });
          technicalProblems.push(problem("source_text_item_duplicate_reference", "text_item_resolution", { groupKey: context.groupKey, pageNumber: region.pageNumber, regionKey: context.regionKey, cellHypothesisKey: cell.cellHypothesisKey, segmentKey: occurrence.segmentKey, sourceReferenceOrder: occurrence.sourceReferenceOrder, textItemIndex: occurrence.textItemIndex }));
          return;
        }
        const resolution = resolveTextItemOccurrence(occurrence, textItemByIndex, segmentOwnerByTextItemIndex);
        itemDispositions.push(resolution.disposition);
        if (resolution.fragment) fragments.push(resolution.fragment);
        if (resolution.disposition.status !== "included_in_text_fragment") {
          const code = resolution.disposition.status === "unresolved_source_text_item_reference_invalid" ? "source_text_item_reference_invalid" : "source_text_item_segment_mismatch";
          technicalProblems.push(problem(code, "text_item_resolution", { groupKey: context.groupKey, pageNumber: region.pageNumber, regionKey: context.regionKey, cellHypothesisKey: cell.cellHypothesisKey, segmentKey: occurrence.segmentKey, sourceReferenceOrder: occurrence.sourceReferenceOrder, textItemIndex: occurrence.textItemIndex }));
        }
      });
      const resolved: ResolvedPhysicalCellTextSegmentOutcome = { status: "resolved", segmentKey: draft.segmentKey, lineKey: draft.lineKey, fragments, itemDispositions };
      return resolved;
    });
    return { status: cellStatusFor(segmentOutcomes), cellHypothesisKey: cell.cellHypothesisKey, gridIntersectionKey: cell.gridIntersectionKey, segmentOutcomes };
  });

  return { cellTextEvidences, technicalProblems };
}
