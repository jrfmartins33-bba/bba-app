import type { PhysicalDocumentPage } from "../physical-document-read.types";
import type { ReconstructedBudgetDocumentPage } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalCellHypothesisFormationRegion } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalCellTextEvidence, RegionPhysicalCellTextEvidenceFormationMetrics } from "./budget-document-physical-cell-text-evidence-formation.types";
import { classifyCell, classifyItemDisposition, classifySegmentOutcome } from "./physical-cell-text-evidence-formation-metrics";
import { cellStatusFor } from "./physical-cell-text-segment-formation";
import { buildSegmentOwnerByTextItemIndex, buildTextItemByIndex, conflictingReferencesFor, findRegionWideDuplicateOccurrences, resolveTextItemOccurrence, type CandidateTextItemOccurrence } from "./physical-cell-text-item-resolution";
import { normalizePhysicalCellTextItem } from "./physical-cell-text-evidence-normalization";

/**
 * Portão 1: toda PhysicalCellHypothesis da região upstream produz exatamente
 * uma PhysicalCellTextEvidence, com a mesma gridIntersectionKey, e o campo
 * `status` publicado é exatamente igual ao status rederivado por
 * cellStatusFor a partir dos próprios segmentOutcomes/disposições — nunca
 * apenas confiado.
 */
export function validateCellHypothesisConservation(region: PhysicalCellHypothesisFormationRegion, cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>): boolean {
  if (region.cellHypotheses.length !== cellTextEvidences.length) return false;
  if (new Set(cellTextEvidences.map((entry) => entry.cellHypothesisKey)).size !== cellTextEvidences.length) return false;
  const cellByKey = new Map(region.cellHypotheses.map((cell) => [cell.cellHypothesisKey, cell]));
  return cellTextEvidences.every((evidence) => {
    const cell = cellByKey.get(evidence.cellHypothesisKey);
    if (!cell) return false;
    if (evidence.gridIntersectionKey !== cell.gridIntersectionKey) return false;
    return evidence.status === cellStatusFor(evidence.segmentOutcomes);
  });
}

/**
 * Portão 2: todo segmentKey de PhysicalCellHypothesis.segmentKeys produz
 * exatamente um PhysicalCellTextSegmentOutcome, na mesma ordem, sem perda
 * nem duplicação; quando resolvido, sua lineKey publicada é revalidada
 * diretamente contra o segmento real de structurePage.
 */
export function validateSegmentOutcomeConservation(region: PhysicalCellHypothesisFormationRegion, structurePage: ReconstructedBudgetDocumentPage, cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>): boolean {
  const structureSegmentByKey = new Map(structurePage.segments.map((segment) => [segment.segmentKey, segment]));
  const evidenceByKey = new Map(cellTextEvidences.map((entry) => [entry.cellHypothesisKey, entry]));
  return region.cellHypotheses.every((cell) => {
    const evidence = evidenceByKey.get(cell.cellHypothesisKey);
    if (!evidence) return false;
    if (evidence.segmentOutcomes.length !== cell.segmentKeys.length) return false;
    return evidence.segmentOutcomes.every((outcome, index) => {
      if (outcome.segmentKey !== cell.segmentKeys[index]) return false;
      if (outcome.status !== "resolved") return true;
      const segment = structureSegmentByKey.get(outcome.segmentKey);
      return segment !== undefined && outcome.lineKey === segment.lineKey;
    });
  });
}

/**
 * Portão 3: rederiva, de forma independente e a partir dos próprios
 * contratos upstream (region + structurePage + physicalPage, nunca do
 * resultado já publicado), a ocorrência esperada em cada posição de cada
 * segmento resolvido — índice, duplicidade regional, propriedade do item —
 * e compara campo a campo com a disposição publicada. Reaproveita os
 * mesmos resolvedores puros já usados na formação (fonte única), nunca uma
 * segunda fórmula de classificação.
 */
export function validateTextItemOccurrenceConservation(
  region: PhysicalCellHypothesisFormationRegion,
  structurePage: ReconstructedBudgetDocumentPage,
  physicalPage: PhysicalDocumentPage,
  cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>,
): boolean {
  const structureSegmentByKey = new Map(structurePage.segments.map((segment) => [segment.segmentKey, segment]));
  const textItemByIndex = buildTextItemByIndex(physicalPage);
  const segmentOwnerByTextItemIndex = buildSegmentOwnerByTextItemIndex(structurePage);

  const allOccurrences: CandidateTextItemOccurrence[] = [];
  for (const cell of region.cellHypotheses) {
    for (const segmentKey of cell.segmentKeys) {
      const segment = structureSegmentByKey.get(segmentKey);
      if (!segment) continue;
      segment.sourceTextItemIndices.forEach((textItemIndex, position) => {
        allOccurrences.push({ cellHypothesisKey: cell.cellHypothesisKey, segmentKey, sourceReferenceOrder: position + 1, textItemIndex });
      });
    }
  }
  const duplicates = findRegionWideDuplicateOccurrences(allOccurrences);
  const duplicatesList = [...duplicates];

  return cellTextEvidences.every((evidence) =>
    evidence.segmentOutcomes.every((outcome) => {
      if (outcome.status !== "resolved") return true;
      const segment = structureSegmentByKey.get(outcome.segmentKey);
      if (!segment) return false;
      if (outcome.itemDispositions.length !== segment.sourceTextItemIndices.length) return false;

      return segment.sourceTextItemIndices.every((expectedTextItemIndex, position) => {
        const disposition = outcome.itemDispositions[position];
        if (disposition.segmentKey !== outcome.segmentKey) return false;
        if (disposition.sourceReferenceOrder !== position + 1) return false;
        if (disposition.textItemIndex !== expectedTextItemIndex) return false;

        const occurrence = allOccurrences.find((entry) => entry.segmentKey === outcome.segmentKey && entry.sourceReferenceOrder === position + 1);
        if (!occurrence) return false;
        const isDuplicate = duplicates.has(occurrence);

        if (isDuplicate) {
          if (disposition.status !== "unresolved_source_text_item_duplicate_reference") return false;
          const expectedConflicts = conflictingReferencesFor(occurrence, duplicatesList).map((entry) => `${entry.segmentKey}:${entry.sourceReferenceOrder}`).sort();
          const actualConflicts = disposition.conflictingReferences.map((entry) => `${entry.segmentKey}:${entry.sourceReferenceOrder}`).sort();
          return JSON.stringify(expectedConflicts) === JSON.stringify(actualConflicts);
        }

        const expectedResolution = resolveTextItemOccurrence(occurrence, textItemByIndex, segmentOwnerByTextItemIndex);
        if (disposition.status !== expectedResolution.disposition.status) return false;
        if (disposition.status === "unresolved_source_text_item_segment_mismatch" && expectedResolution.disposition.status === "unresolved_source_text_item_segment_mismatch") {
          return disposition.actualOwningSegmentKey === expectedResolution.disposition.actualOwningSegmentKey;
        }
        return true;
      });
    }),
  );
}

/**
 * Portão 4: bijeção exata entre fragments e as disposições
 * included_in_text_fragment do mesmo segmento resolvido — identidade
 * completa (sourceReferenceOrder, textItemIndex), sem duplicidade de
 * identidade em nenhum dos dois lados, e o texto do fragmento revalidado
 * contra o item físico real e a regra de normalização vigente.
 */
export function validateFragmentDispositionConservation(cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>, physicalPage: PhysicalDocumentPage): boolean {
  const itemByIndex = new Map(physicalPage.textItems.map((item) => [item.index, item]));
  return cellTextEvidences.every((evidence) =>
    evidence.segmentOutcomes.every((outcome) => {
      if (outcome.status !== "resolved") return true;

      const fragmentKeys = outcome.fragments.map((fragment) => `${fragment.sourceReferenceOrder}:${fragment.textItemIndex}`);
      if (new Set(fragmentKeys).size !== fragmentKeys.length) return false;

      const includedDispositions = outcome.itemDispositions.filter((disposition) => disposition.status === "included_in_text_fragment");
      const includedKeys = includedDispositions.map((disposition) => `${disposition.sourceReferenceOrder}:${disposition.textItemIndex}`);
      if (new Set(includedKeys).size !== includedKeys.length) return false;

      if (fragmentKeys.length !== includedKeys.length) return false;
      const fragmentKeySet = new Set(fragmentKeys);
      const includedKeySet = new Set(includedKeys);
      for (const key of fragmentKeySet) if (!includedKeySet.has(key)) return false;
      for (const key of includedKeySet) if (!fragmentKeySet.has(key)) return false;

      return outcome.fragments.every((fragment) => {
        const sourceItem = itemByIndex.get(fragment.textItemIndex);
        if (!sourceItem) return false;
        return fragment.originalText === sourceItem.text && fragment.normalizedText === normalizePhysicalCellTextItem(sourceItem.text);
      });
    }),
  );
}

/** Portão 5: recalcula as categorias a partir dos dados reais (mesmos classificadores de computeRegionMetrics, com status de célula sempre rederivado) e compara campo a campo com as métricas publicadas. */
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
