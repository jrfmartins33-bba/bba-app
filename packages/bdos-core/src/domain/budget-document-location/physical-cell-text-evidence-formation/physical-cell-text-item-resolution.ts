import type { PhysicalDocumentPage, PhysicalDocumentTextItem } from "../physical-document-read.types";
import type { ReconstructedBudgetDocumentPage } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalCellTextFragment, PhysicalCellTextItemDisposition } from "./budget-document-physical-cell-text-evidence-formation.types";
import { normalizePhysicalCellTextItem } from "./physical-cell-text-evidence-normalization";

/** Resolve por PhysicalDocumentTextItem.index — nunca por posição no array. */
export function buildTextItemByIndex(physicalPage: PhysicalDocumentPage): ReadonlyMap<number, PhysicalDocumentTextItem> {
  const byIndex = new Map<number, PhysicalDocumentTextItem>();
  physicalPage.textItems.forEach((item) => {
    byIndex.set(item.index, item);
  });
  return byIndex;
}

/** Propriedade real do item segundo a reconstrução estrutural — nunca inferida procurando o índice em todos os segmentos. */
export function buildSegmentOwnerByTextItemIndex(structurePage: ReconstructedBudgetDocumentPage): ReadonlyMap<number, string> {
  const ownerByIndex = new Map<number, string>();
  structurePage.sourceItemOutcomes.forEach((outcome) => {
    if (outcome.status === "placed") {
      ownerByIndex.set(outcome.sourceTextItemIndex, outcome.segmentKey);
    }
  });
  return ownerByIndex;
}

export interface CandidateTextItemOccurrence {
  readonly cellHypothesisKey: string;
  readonly segmentKey: string;
  readonly sourceReferenceOrder: number;
  readonly textItemIndex: number;
}

/** Ocorrências cujo textItemIndex aparece mais de uma vez no universo da região — nunca deduplicadas, nunca com vencedora escolhida. */
export function findRegionWideDuplicateOccurrences(occurrences: ReadonlyArray<CandidateTextItemOccurrence>): ReadonlySet<CandidateTextItemOccurrence> {
  const byIndex = new Map<number, CandidateTextItemOccurrence[]>();
  occurrences.forEach((occurrence) => {
    const existing = byIndex.get(occurrence.textItemIndex);
    if (existing) existing.push(occurrence);
    else byIndex.set(occurrence.textItemIndex, [occurrence]);
  });
  const duplicates = new Set<CandidateTextItemOccurrence>();
  byIndex.forEach((group) => {
    if (group.length > 1) group.forEach((occurrence) => duplicates.add(occurrence));
  });
  return duplicates;
}

export function conflictingReferencesFor(occurrence: CandidateTextItemOccurrence, allDuplicates: ReadonlyArray<CandidateTextItemOccurrence>): ReadonlyArray<{ readonly segmentKey: string; readonly sourceReferenceOrder: number }> {
  return allDuplicates
    .filter((entry) => entry.textItemIndex === occurrence.textItemIndex && entry !== occurrence)
    .map((entry) => ({ segmentKey: entry.segmentKey, sourceReferenceOrder: entry.sourceReferenceOrder }));
}

export interface TextItemResolution {
  readonly disposition: PhysicalCellTextItemDisposition;
  readonly fragment: PhysicalCellTextFragment | null;
}

/**
 * Classifica uma única ocorrência não duplicada, nesta ordem de prioridade:
 * item inexistente > pertence a outro segmento > incluído com segurança.
 * A duplicidade regional já foi decidida antes desta chamada.
 */
export function resolveTextItemOccurrence(
  occurrence: CandidateTextItemOccurrence,
  textItemByIndex: ReadonlyMap<number, PhysicalDocumentTextItem>,
  segmentOwnerByTextItemIndex: ReadonlyMap<number, string>,
): TextItemResolution {
  const { segmentKey, sourceReferenceOrder, textItemIndex } = occurrence;
  const item = textItemByIndex.get(textItemIndex);
  if (!item) {
    return { disposition: { status: "unresolved_source_text_item_reference_invalid", segmentKey, sourceReferenceOrder, textItemIndex }, fragment: null };
  }
  const owningSegmentKey = segmentOwnerByTextItemIndex.get(textItemIndex) ?? null;
  if (owningSegmentKey !== segmentKey) {
    return { disposition: { status: "unresolved_source_text_item_segment_mismatch", segmentKey, sourceReferenceOrder, textItemIndex, actualOwningSegmentKey: owningSegmentKey }, fragment: null };
  }
  const fragment: PhysicalCellTextFragment = { sourceReferenceOrder, textItemIndex, originalText: item.text, normalizedText: normalizePhysicalCellTextItem(item.text) };
  return { disposition: { status: "included_in_text_fragment", segmentKey, sourceReferenceOrder, textItemIndex }, fragment };
}
