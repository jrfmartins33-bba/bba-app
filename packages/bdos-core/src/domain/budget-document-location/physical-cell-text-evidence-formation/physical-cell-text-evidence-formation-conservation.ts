import type { PhysicalDocumentPage } from "../physical-document-read.types";
import type { ReconstructedBudgetDocumentPage } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalCellHypothesisFormationRegion } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalCellTextEvidence, RegionPhysicalCellTextEvidenceFormationMetrics } from "./budget-document-physical-cell-text-evidence-formation.types";
import { classifyCell, classifyItemDisposition, classifySegmentOutcome } from "./physical-cell-text-evidence-formation-metrics";
import { normalizePhysicalCellTextItem } from "./physical-cell-text-evidence-normalization";

/** Portão 1: toda PhysicalCellHypothesis da região upstream produz exatamente uma PhysicalCellTextEvidence. */
export function validateCellHypothesisConservation(region: PhysicalCellHypothesisFormationRegion, cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>): boolean {
  if (region.cellHypotheses.length !== cellTextEvidences.length) return false;
  if (new Set(cellTextEvidences.map((entry) => entry.cellHypothesisKey)).size !== cellTextEvidences.length) return false;
  const sourceKeys = new Set(region.cellHypotheses.map((cell) => cell.cellHypothesisKey));
  if (cellTextEvidences.some((entry) => !sourceKeys.has(entry.cellHypothesisKey))) return false;
  return region.cellHypotheses.every((cell) => cellTextEvidences.some((entry) => entry.cellHypothesisKey === cell.cellHypothesisKey));
}

/** Portão 2: todo segmentKey de PhysicalCellHypothesis.segmentKeys produz exatamente um PhysicalCellTextSegmentOutcome, na mesma ordem, sem perda nem duplicação. */
export function validateSegmentOutcomeConservation(region: PhysicalCellHypothesisFormationRegion, cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>): boolean {
  const evidenceByKey = new Map(cellTextEvidences.map((entry) => [entry.cellHypothesisKey, entry]));
  return region.cellHypotheses.every((cell) => {
    const evidence = evidenceByKey.get(cell.cellHypothesisKey);
    if (!evidence) return false;
    if (evidence.segmentOutcomes.length !== cell.segmentKeys.length) return false;
    return evidence.segmentOutcomes.every((outcome, index) => outcome.segmentKey === cell.segmentKeys[index]);
  });
}

/**
 * Portão 3: para cada segmento resolvido, itemDispositions.length ===
 * segment.sourceTextItemIndices.length — baseado em ocorrências, nunca em
 * índices distintos. A contagem esperada é recalculada de forma independente
 * a partir de structurePage, nunca confiando na aritmética do próprio módulo
 * de formação.
 */
export function validateTextItemOccurrenceConservation(structurePage: ReconstructedBudgetDocumentPage, cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>): boolean {
  const structureSegmentByKey = new Map(structurePage.segments.map((segment) => [segment.segmentKey, segment]));
  return cellTextEvidences.every((evidence) =>
    evidence.segmentOutcomes.every((outcome) => {
      if (outcome.status !== "resolved") return true;
      const expected = structureSegmentByKey.get(outcome.segmentKey)?.sourceTextItemIndices.length ?? -1;
      if (outcome.itemDispositions.length !== expected) return false;
      return outcome.itemDispositions.every((disposition, index) => disposition.sourceReferenceOrder === index + 1);
    }),
  );
}

/**
 * Portão 4: para cada fragmento existe exatamente uma disposição
 * included_in_text_fragment com a mesma tripla (segmentKey, sourceReferenceOrder,
 * textItemIndex), e vice-versa; o texto do fragmento bate com o item físico
 * real e com a regra de normalização vigente.
 */
export function validateFragmentDispositionConservation(cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>, physicalPage: PhysicalDocumentPage): boolean {
  const itemByIndex = new Map(physicalPage.textItems.map((item) => [item.index, item]));
  return cellTextEvidences.every((evidence) =>
    evidence.segmentOutcomes.every((outcome) => {
      if (outcome.status !== "resolved") return true;
      const includedDispositions = outcome.itemDispositions.filter((disposition) => disposition.status === "included_in_text_fragment");
      if (includedDispositions.length !== outcome.fragments.length) return false;
      return outcome.fragments.every((fragment) => {
        const disposition = includedDispositions.find((entry) => entry.sourceReferenceOrder === fragment.sourceReferenceOrder && entry.textItemIndex === fragment.textItemIndex);
        if (!disposition) return false;
        const sourceItem = itemByIndex.get(fragment.textItemIndex);
        if (!sourceItem) return false;
        return fragment.originalText === sourceItem.text && fragment.normalizedText === normalizePhysicalCellTextItem(sourceItem.text);
      });
    }),
  );
}

/** Portão 5: recalcula as categorias a partir dos dados reais (mesmos classificadores de computeRegionMetrics) e compara campo a campo com as métricas publicadas. */
export function validateMetricCategoryConservation(
  sourceCellHypothesisCount: number,
  cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>,
  metrics: RegionPhysicalCellTextEvidenceFormationMetrics,
): boolean {
  if (metrics.sourceCellHypothesisCount !== sourceCellHypothesisCount) return false;
  const cellCategories = cellTextEvidences.map(classifyCell);
  if (metrics.cellTextEvidenceFormedCount !== cellCategories.filter((c) => c === "formed").length) return false;
  if (metrics.cellTextEvidencePartiallyFormedCount !== cellCategories.filter((c) => c === "partiallyFormed").length) return false;
  if (metrics.cellTextEvidenceFailedCount !== cellCategories.filter((c) => c === "failed").length) return false;
  if (sourceCellHypothesisCount !== metrics.cellTextEvidenceFormedCount + metrics.cellTextEvidencePartiallyFormedCount + metrics.cellTextEvidenceFailedCount) return false;

  const segmentOutcomes = cellTextEvidences.flatMap((entry) => entry.segmentOutcomes);
  const segmentCategories = segmentOutcomes.map(classifySegmentOutcome);
  if (metrics.sourceSegmentReferenceCount !== segmentOutcomes.length) return false;
  if (metrics.segmentResolvedCount !== segmentCategories.filter((c) => c === "resolved").length) return false;
  if (metrics.segmentReferenceInvalidCount !== segmentCategories.filter((c) => c === "referenceInvalid").length) return false;
  if (metrics.segmentIncompatibleCount !== segmentCategories.filter((c) => c === "incompatible").length) return false;
  if (metrics.segmentFormationFailedCount !== segmentCategories.filter((c) => c === "formationFailed").length) return false;
  if (metrics.sourceSegmentReferenceCount !== metrics.segmentResolvedCount + metrics.segmentReferenceInvalidCount + metrics.segmentIncompatibleCount + metrics.segmentFormationFailedCount) return false;

  const itemDispositions = segmentOutcomes.flatMap((outcome) => (outcome.status === "resolved" ? outcome.itemDispositions : []));
  const itemCategories = itemDispositions.map(classifyItemDisposition);
  if (metrics.totalEligibleTextItemReferenceCount !== itemDispositions.length) return false;
  if (metrics.includedTextItemReferenceCount !== itemCategories.filter((c) => c === "included").length) return false;
  if (metrics.invalidReferenceTextItemCount !== itemCategories.filter((c) => c === "invalidReference").length) return false;
  if (metrics.duplicateReferenceTextItemCount !== itemCategories.filter((c) => c === "duplicateReference").length) return false;
  if (metrics.segmentMismatchTextItemCount !== itemCategories.filter((c) => c === "segmentMismatch").length) return false;
  if (metrics.formationFailedTextItemCount !== itemCategories.filter((c) => c === "formationFailed").length) return false;
  if (metrics.totalEligibleTextItemReferenceCount !== metrics.includedTextItemReferenceCount + metrics.invalidReferenceTextItemCount + metrics.duplicateReferenceTextItemCount + metrics.segmentMismatchTextItemCount + metrics.formationFailedTextItemCount) return false;

  return true;
}
