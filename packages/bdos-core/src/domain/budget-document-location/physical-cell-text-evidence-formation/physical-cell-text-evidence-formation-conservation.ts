import type { PhysicalDocumentPage } from "../physical-document-read.types";
import type { ReconstructedBudgetDocumentPage } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalCellHypothesisFormationRegion } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalCellTextEvidence, PhysicalCellTextSegmentOutcome, RegionPhysicalCellTextEvidenceFormationMetrics } from "./budget-document-physical-cell-text-evidence-formation.types";
import { classifyCell, classifyItemDisposition, classifySegmentOutcome } from "./physical-cell-text-evidence-formation-metrics";
import { buildEligibleTextItemOccurrences, cellStatusFor, deriveRegionCellSegmentDrafts, type SegmentOutcomeDraft } from "./physical-cell-text-segment-formation";
import { buildSegmentOwnerByTextItemIndex, buildTextItemByIndex, conflictingReferencesFor, findRegionWideDuplicateOccurrences, resolveTextItemOccurrence, type CandidateTextItemOccurrence } from "./physical-cell-text-item-resolution";
import { normalizePhysicalCellTextItem } from "./physical-cell-text-evidence-normalization";

/**
 * Compara o outcome publicado com o draft esperado (rederivado por
 * `deriveRegionCellSegmentDrafts`, nunca a partir do resultado publicado)
 * campo a campo. Para o caso "pending", apenas confirma status "resolved" e
 * a lineKey — fragments/itemDispositions são responsabilidade dos Portões 3
 * e 4. Para qualquer variante de falha, todo campo próprio da variante é
 * comparado, nunca apenas o status/reason.
 */
function segmentOutcomeMatchesDraft(actual: PhysicalCellTextSegmentOutcome, draft: SegmentOutcomeDraft): boolean {
  if (draft.kind === "pending") {
    return actual.status === "resolved" && actual.segmentKey === draft.segmentKey && actual.lineKey === draft.lineKey;
  }
  const expected = draft.outcome;
  if (actual.status !== expected.status || actual.segmentKey !== expected.segmentKey) return false;
  if (expected.status === "unresolved_segment_reference_invalid") return true;
  if (actual.status !== "unresolved_segment_incompatible" || expected.status !== "unresolved_segment_incompatible") return false;
  if (actual.reason !== expected.reason) return false;
  if (expected.reason === "line_reference_invalid" && actual.reason === "line_reference_invalid") return actual.referencedLineKey === expected.referencedLineKey;
  if (expected.reason === "line_mismatch" && actual.reason === "line_mismatch") return actual.expectedLineKey === expected.expectedLineKey && actual.actualLineKey === expected.actualLineKey;
  if (expected.reason === "page_mismatch" && actual.reason === "page_mismatch") return actual.expectedPageNumber === expected.expectedPageNumber && actual.actualPageNumber === expected.actualPageNumber;
  if (expected.reason === "referenced_by_multiple_cell_hypotheses" && actual.reason === "referenced_by_multiple_cell_hypotheses") {
    const expectedKeys = [...expected.conflictingCellHypothesisKeys].sort();
    const actualKeys = [...actual.conflictingCellHypothesisKeys].sort();
    return expectedKeys.length === actualKeys.length && expectedKeys.every((key, index) => key === actualKeys[index]);
  }
  return false;
}

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
 * Confirma a forma uniforme que `buildFormationFailedSubstitute` produz para
 * toda a região quando `formRegionCellTextEvidences` lança uma exceção ou a
 * página física está genuinamente ausente: toda evidência
 * `unresolved_technical_failure`, todo outcome `unresolved_segment_formation_failed`,
 * e a mesma `failedPhase` (`text_item_resolution` ou `fragment_assembly`,
 * nunca `segment_resolution` — reservada ao caminho de ordem de célula
 * inválida) em toda a região. Nunca usada isoladamente para *decidir* que um
 * resultado é um substituto legítimo — a forma sozinha é ambígua com uma
 * região de uma única célula cuja `failedPhase` foi adulterada. A decisão de
 * confiança pertence exclusivamente ao chamador (o orquestrador, que sabe
 * factualmente se invocou `buildFormationFailedSubstitute`); esta função
 * apenas confirma que, quando o chamador afirma um substituto, a forma
 * publicada realmente corresponde a ele.
 */
function isUniformSubstituteFailureShape(cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>): boolean {
  if (cellTextEvidences.length === 0) return false;
  let uniformPhase: "text_item_resolution" | "fragment_assembly" | null = null;
  for (const evidence of cellTextEvidences) {
    if (evidence.status !== "unresolved_technical_failure") return false;
    if (evidence.segmentOutcomes.length === 0) return false;
    for (const outcome of evidence.segmentOutcomes) {
      if (outcome.status !== "unresolved_segment_formation_failed") return false;
      if (outcome.failedPhase === "segment_resolution") return false;
      if (uniformPhase === null) uniformPhase = outcome.failedPhase;
      else if (uniformPhase !== outcome.failedPhase) return false;
    }
  }
  return true;
}

/**
 * Portão 2: todo segmentKey de PhysicalCellHypothesis.segmentKeys produz
 * exatamente um PhysicalCellTextSegmentOutcome, na mesma ordem, sem perda
 * nem duplicação — e o outcome publicado é integralmente rederivado (nunca
 * apenas aceito quando não-resolved) contra a mesma precedência objetiva
 * usada pela formação (`deriveRegionCellSegmentDrafts`): ordem da célula
 * inválida, segmento referenciado por múltiplas células, segmento
 * inexistente, lineKey inexistente, line_mismatch, page_mismatch ou
 * pendente — comparado campo a campo, nunca confiando no status publicado.
 * O único desvio legítimo desta rederivação é o substituto uniforme de
 * falha regional produzido por `buildFormationFailedSubstitute` — nunca
 * inferido da forma do resultado sozinha (ambígua com uma região de célula
 * única com `failedPhase` adulterada), sempre afirmado explicitamente pelo
 * chamador via `isWholeRegionFormationFailureSubstitute` (o orquestrador é o
 * único que sabe factualmente se o substituto foi de fato usado) e sempre
 * reconfirmado estruturalmente por `isUniformSubstituteFailureShape` antes
 * de ser aceito — mesmo nesse caso, segmentKeys e sua ordem continuam sendo
 * exigidos integralmente.
 */
export function validateSegmentOutcomeConservation(
  region: PhysicalCellHypothesisFormationRegion,
  structurePage: ReconstructedBudgetDocumentPage,
  cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>,
  isWholeRegionFormationFailureSubstitute = false,
): boolean {
  const evidenceByKey = new Map(cellTextEvidences.map((entry) => [entry.cellHypothesisKey, entry]));
  const structuralConservationHolds = region.cellHypotheses.every((cell) => {
    const evidence = evidenceByKey.get(cell.cellHypothesisKey);
    if (!evidence) return false;
    if (evidence.segmentOutcomes.length !== cell.segmentKeys.length) return false;
    return evidence.segmentOutcomes.every((outcome, index) => outcome.segmentKey === cell.segmentKeys[index]);
  });
  if (!structuralConservationHolds) return false;

  if (isWholeRegionFormationFailureSubstitute) return isUniformSubstituteFailureShape(cellTextEvidences);

  const cellStateByKey = new Map(deriveRegionCellSegmentDrafts(region, structurePage).map((state) => [state.cell.cellHypothesisKey, state]));
  return region.cellHypotheses.every((cell) => {
    const evidence = evidenceByKey.get(cell.cellHypothesisKey)!;
    const state = cellStateByKey.get(cell.cellHypothesisKey);
    if (!state) return false;

    if (state.orderInvalid) {
      return evidence.segmentOutcomes.every((outcome, index) =>
        outcome.segmentKey === cell.segmentKeys[index]
        && outcome.status === "unresolved_segment_formation_failed"
        && outcome.failedPhase === "segment_resolution",
      );
    }

    return evidence.segmentOutcomes.every((outcome, index) => {
      const draft = state.drafts[index];
      return segmentOutcomeMatchesDraft(outcome, draft);
    });
  });
}

/**
 * Portão 3: rederiva, de forma independente e a partir dos próprios
 * contratos upstream (region + structurePage + physicalPage, nunca do
 * resultado já publicado), a ocorrência esperada em cada posição de cada
 * segmento resolvido — índice, duplicidade regional, propriedade do item —
 * e compara campo a campo com a disposição publicada. A população elegível
 * de ocorrências é construída pela mesma função usada pela formação
 * (`buildEligibleTextItemOccurrences` sobre `deriveRegionCellSegmentDrafts`),
 * nunca por uma segunda reconstrução ad-hoc — um segmentKey pertencente a
 * uma célula com ordem inválida, ou já classificado como referência
 * inválida/incompatível, nunca entra nesta população, exatamente como na
 * formação real.
 */
export function validateTextItemOccurrenceConservation(
  region: PhysicalCellHypothesisFormationRegion,
  structurePage: ReconstructedBudgetDocumentPage,
  physicalPage: PhysicalDocumentPage,
  cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>,
): boolean {
  const textItemByIndex = buildTextItemByIndex(physicalPage);
  const segmentOwnerByTextItemIndex = buildSegmentOwnerByTextItemIndex(structurePage);

  const cellStates = deriveRegionCellSegmentDrafts(region, structurePage);
  const allOccurrences = buildEligibleTextItemOccurrences(cellStates);
  const duplicates = findRegionWideDuplicateOccurrences(allOccurrences);
  const duplicatesList = [...duplicates];
  const occurrencesBySegment = new Map<string, CandidateTextItemOccurrence[]>();
  allOccurrences.forEach((occurrence) => {
    const existing = occurrencesBySegment.get(occurrence.segmentKey);
    if (existing) existing.push(occurrence);
    else occurrencesBySegment.set(occurrence.segmentKey, [occurrence]);
  });

  return cellTextEvidences.every((evidence) =>
    evidence.segmentOutcomes.every((outcome) => {
      if (outcome.status !== "resolved") return true;
      const expectedOccurrences = occurrencesBySegment.get(outcome.segmentKey) ?? [];
      if (outcome.itemDispositions.length !== expectedOccurrences.length) return false;

      return expectedOccurrences.every((occurrence, position) => {
        const disposition = outcome.itemDispositions[position];
        if (disposition.segmentKey !== occurrence.segmentKey) return false;
        if (disposition.sourceReferenceOrder !== occurrence.sourceReferenceOrder) return false;
        if (disposition.textItemIndex !== occurrence.textItemIndex) return false;

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
