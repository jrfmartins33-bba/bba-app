import type { GlobalPhysicalCellTextEvidenceFormationMetrics, GroupPhysicalCellTextEvidenceFormationMetrics, PagePhysicalCellTextEvidenceFormationMetrics, PhysicalCellTextEvidence, PhysicalCellTextEvidenceFormationGroup, PhysicalCellTextEvidenceFormationPage, PhysicalCellTextEvidenceFormationRegion, PhysicalCellTextItemDisposition, PhysicalCellTextSegmentOutcome, RegionPhysicalCellTextEvidenceFormationMetrics } from "./budget-document-physical-cell-text-evidence-formation.types";
import { cellStatusFor } from "./physical-cell-text-segment-formation";

export type CellCategory = "formed" | "partiallyFormed" | "failed";
export type SegmentCategory = "resolved" | "referenceInvalid" | "incompatible" | "formationFailed";
export type ItemCategory = "included" | "invalidReference" | "duplicateReference" | "segmentMismatch" | "formationFailed";

/**
 * Classifica pelo status rederivado a partir de segmentOutcomes/disposições
 * reais (via cellStatusFor, a mesma regra usada na formação) — nunca
 * confiando diretamente em evidence.status. Isso garante que as métricas
 * nunca fecham em torno de um status publicado incorretamente; a Seção
 * "Portão 1" da conservação audita separadamente se o campo publicado bate
 * com esta reclassificação.
 */
export function classifyCell(evidence: PhysicalCellTextEvidence): CellCategory {
  const recomputed = cellStatusFor(evidence.segmentOutcomes);
  if (recomputed === "formed") return "formed";
  if (recomputed === "partially_formed") return "partiallyFormed";
  return "failed";
}

export function classifySegmentOutcome(outcome: PhysicalCellTextSegmentOutcome): SegmentCategory {
  if (outcome.status === "resolved") return "resolved";
  if (outcome.status === "unresolved_segment_reference_invalid") return "referenceInvalid";
  if (outcome.status === "unresolved_segment_incompatible") return "incompatible";
  return "formationFailed";
}

export function classifyItemDisposition(disposition: PhysicalCellTextItemDisposition): ItemCategory {
  if (disposition.status === "included_in_text_fragment") return "included";
  if (disposition.status === "unresolved_source_text_item_reference_invalid") return "invalidReference";
  if (disposition.status === "unresolved_source_text_item_duplicate_reference") return "duplicateReference";
  if (disposition.status === "unresolved_source_text_item_segment_mismatch") return "segmentMismatch";
  return "formationFailed";
}

export function computeRegionMetrics(
  sourceCellHypothesisCount: number,
  cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>,
  technicalProblemCount: number,
): RegionPhysicalCellTextEvidenceFormationMetrics {
  const cellCategories = cellTextEvidences.map(classifyCell);
  const segmentOutcomes = cellTextEvidences.flatMap((entry) => entry.segmentOutcomes);
  const segmentCategories = segmentOutcomes.map(classifySegmentOutcome);
  const itemDispositions = segmentOutcomes.flatMap((outcome) => (outcome.status === "resolved" ? outcome.itemDispositions : []));
  const itemCategories = itemDispositions.map(classifyItemDisposition);

  return {
    sourceCellHypothesisCount,
    cellTextEvidenceFormedCount: cellCategories.filter((c) => c === "formed").length,
    cellTextEvidencePartiallyFormedCount: cellCategories.filter((c) => c === "partiallyFormed").length,
    cellTextEvidenceFailedCount: cellCategories.filter((c) => c === "failed").length,
    sourceSegmentReferenceCount: segmentOutcomes.length,
    segmentResolvedCount: segmentCategories.filter((c) => c === "resolved").length,
    segmentReferenceInvalidCount: segmentCategories.filter((c) => c === "referenceInvalid").length,
    segmentIncompatibleCount: segmentCategories.filter((c) => c === "incompatible").length,
    segmentFormationFailedCount: segmentCategories.filter((c) => c === "formationFailed").length,
    totalEligibleTextItemReferenceCount: itemDispositions.length,
    includedTextItemReferenceCount: itemCategories.filter((c) => c === "included").length,
    invalidReferenceTextItemCount: itemCategories.filter((c) => c === "invalidReference").length,
    duplicateReferenceTextItemCount: itemCategories.filter((c) => c === "duplicateReference").length,
    segmentMismatchTextItemCount: itemCategories.filter((c) => c === "segmentMismatch").length,
    formationFailedTextItemCount: itemCategories.filter((c) => c === "formationFailed").length,
    technicalProblemCount,
  };
}

export function computePageMetrics(regions: ReadonlyArray<PhysicalCellTextEvidenceFormationRegion>): PagePhysicalCellTextEvidenceFormationMetrics {
  const metrics = regions.map((entry) => entry.metrics);
  const sum = (selector: (entry: RegionPhysicalCellTextEvidenceFormationMetrics) => number) => metrics.reduce((total, entry) => total + selector(entry), 0);
  return {
    totalRegionCount: regions.length,
    formedRegionCount: regions.filter((entry) => entry.status === "formed").length,
    formedWithProblemsRegionCount: regions.filter((entry) => entry.status === "formed_with_problems").length,
    noCellHypothesesRegionCount: regions.filter((entry) => entry.status === "no_cell_hypotheses").length,
    regionNotProcessableCount: regions.filter((entry) => entry.status === "region_not_processable").length,
    sourceCellHypothesisCount: sum((entry) => entry.sourceCellHypothesisCount),
    cellTextEvidenceFormedCount: sum((entry) => entry.cellTextEvidenceFormedCount),
    cellTextEvidencePartiallyFormedCount: sum((entry) => entry.cellTextEvidencePartiallyFormedCount),
    cellTextEvidenceFailedCount: sum((entry) => entry.cellTextEvidenceFailedCount),
    sourceSegmentReferenceCount: sum((entry) => entry.sourceSegmentReferenceCount),
    segmentResolvedCount: sum((entry) => entry.segmentResolvedCount),
    segmentReferenceInvalidCount: sum((entry) => entry.segmentReferenceInvalidCount),
    segmentIncompatibleCount: sum((entry) => entry.segmentIncompatibleCount),
    segmentFormationFailedCount: sum((entry) => entry.segmentFormationFailedCount),
    totalEligibleTextItemReferenceCount: sum((entry) => entry.totalEligibleTextItemReferenceCount),
    includedTextItemReferenceCount: sum((entry) => entry.includedTextItemReferenceCount),
    invalidReferenceTextItemCount: sum((entry) => entry.invalidReferenceTextItemCount),
    duplicateReferenceTextItemCount: sum((entry) => entry.duplicateReferenceTextItemCount),
    segmentMismatchTextItemCount: sum((entry) => entry.segmentMismatchTextItemCount),
    formationFailedTextItemCount: sum((entry) => entry.formationFailedTextItemCount),
    technicalProblemCount: sum((entry) => entry.technicalProblemCount),
  };
}

export function computeGroupMetrics(pages: ReadonlyArray<PhysicalCellTextEvidenceFormationPage>): GroupPhysicalCellTextEvidenceFormationMetrics {
  const metrics = pages.map((entry) => entry.metrics);
  const sum = (selector: (entry: PagePhysicalCellTextEvidenceFormationMetrics) => number) => metrics.reduce((total, entry) => total + selector(entry), 0);
  return {
    totalPageCount: pages.length,
    formedPageCount: pages.filter((entry) => entry.status === "formed").length,
    formedWithProblemsPageCount: pages.filter((entry) => entry.status === "formed_with_problems").length,
    noCellHypothesesPageCount: pages.filter((entry) => entry.status === "no_cell_hypotheses").length,
    pageNotProcessableCount: pages.filter((entry) => entry.status === "page_not_processable").length,
    sourceCellHypothesisCount: sum((entry) => entry.sourceCellHypothesisCount),
    cellTextEvidenceFormedCount: sum((entry) => entry.cellTextEvidenceFormedCount),
    cellTextEvidencePartiallyFormedCount: sum((entry) => entry.cellTextEvidencePartiallyFormedCount),
    cellTextEvidenceFailedCount: sum((entry) => entry.cellTextEvidenceFailedCount),
    sourceSegmentReferenceCount: sum((entry) => entry.sourceSegmentReferenceCount),
    segmentResolvedCount: sum((entry) => entry.segmentResolvedCount),
    segmentReferenceInvalidCount: sum((entry) => entry.segmentReferenceInvalidCount),
    segmentIncompatibleCount: sum((entry) => entry.segmentIncompatibleCount),
    segmentFormationFailedCount: sum((entry) => entry.segmentFormationFailedCount),
    totalEligibleTextItemReferenceCount: sum((entry) => entry.totalEligibleTextItemReferenceCount),
    includedTextItemReferenceCount: sum((entry) => entry.includedTextItemReferenceCount),
    invalidReferenceTextItemCount: sum((entry) => entry.invalidReferenceTextItemCount),
    duplicateReferenceTextItemCount: sum((entry) => entry.duplicateReferenceTextItemCount),
    segmentMismatchTextItemCount: sum((entry) => entry.segmentMismatchTextItemCount),
    formationFailedTextItemCount: sum((entry) => entry.formationFailedTextItemCount),
    technicalProblemCount: sum((entry) => entry.technicalProblemCount),
  };
}

export function computeGlobalMetrics(groups: ReadonlyArray<PhysicalCellTextEvidenceFormationGroup>): GlobalPhysicalCellTextEvidenceFormationMetrics {
  const metrics = groups.map((entry) => entry.metrics);
  const sum = (selector: (entry: GroupPhysicalCellTextEvidenceFormationMetrics) => number) => metrics.reduce((total, entry) => total + selector(entry), 0);
  return {
    receivedGroupCount: groups.length,
    formedGroupCount: groups.filter((entry) => entry.status === "formed").length,
    formedWithProblemsGroupCount: groups.filter((entry) => entry.status === "formed_with_problems").length,
    noCellHypothesesGroupCount: groups.filter((entry) => entry.status === "no_cell_hypotheses").length,
    groupNotProcessableCount: groups.filter((entry) => entry.status === "group_not_processable").length,
    candidatePageCount: sum((entry) => entry.totalPageCount),
    candidateRegionCount: groups.reduce((total, group) => total + group.pages.reduce((pageTotal, page) => pageTotal + page.metrics.totalRegionCount, 0), 0),
    sourceCellHypothesisCount: sum((entry) => entry.sourceCellHypothesisCount),
    cellTextEvidenceFormedCount: sum((entry) => entry.cellTextEvidenceFormedCount),
    cellTextEvidencePartiallyFormedCount: sum((entry) => entry.cellTextEvidencePartiallyFormedCount),
    cellTextEvidenceFailedCount: sum((entry) => entry.cellTextEvidenceFailedCount),
    sourceSegmentReferenceCount: sum((entry) => entry.sourceSegmentReferenceCount),
    segmentResolvedCount: sum((entry) => entry.segmentResolvedCount),
    segmentReferenceInvalidCount: sum((entry) => entry.segmentReferenceInvalidCount),
    segmentIncompatibleCount: sum((entry) => entry.segmentIncompatibleCount),
    segmentFormationFailedCount: sum((entry) => entry.segmentFormationFailedCount),
    totalEligibleTextItemReferenceCount: sum((entry) => entry.totalEligibleTextItemReferenceCount),
    includedTextItemReferenceCount: sum((entry) => entry.includedTextItemReferenceCount),
    invalidReferenceTextItemCount: sum((entry) => entry.invalidReferenceTextItemCount),
    duplicateReferenceTextItemCount: sum((entry) => entry.duplicateReferenceTextItemCount),
    segmentMismatchTextItemCount: sum((entry) => entry.segmentMismatchTextItemCount),
    formationFailedTextItemCount: sum((entry) => entry.formationFailedTextItemCount),
    technicalProblemCount: sum((entry) => entry.technicalProblemCount),
  };
}
