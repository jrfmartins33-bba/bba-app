import type { NeutralDocumentGroup, NeutralDocumentPage } from "../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import type { GlobalPageBoundaryNeutralContinuityMetrics, PageBoundaryNeutralContinuityEvaluation, PageBoundaryNeutralContinuityTechnicalProblem } from "./budget-document-page-boundary-neutral-continuity-evaluation.types";
import { computeExpectedBoundaryPopulation } from "./page-boundary-neutral-continuity-evaluation-input-validation";
import { evaluateBoundaryPair } from "./page-boundary-neutral-continuity-evaluation-pair-evaluator";
import { computeGlobalMetrics } from "./page-boundary-neutral-continuity-evaluation-metrics";

export type EvaluationConservationFailure =
  | "evaluation_population_conservation_failed"
  | "evaluation_reference_conservation_failed"
  | "evaluation_direction_conservation_failed"
  | "evaluation_selection_conservation_failed"
  | "evaluation_signal_conservation_failed"
  | "evaluation_evidence_conservation_failed"
  | "evaluation_status_conservation_failed"
  | "evaluation_partition_conservation_failed"
  | null;

function boundaryKey(groupKey: string, originPageNumber: number, targetPageNumber: number): string {
  return `${groupKey}::${originPageNumber}::${targetPageNumber}`;
}

/**
 * Portões 1-8 (§10/§11): cada um recalcula a partir dos grupos REAIS
 * publicados pela g.2, nunca a partir do próprio resultado da g.3 —
 * inclusive a seleção de fronteira e os sinais, rederivados pela mesma
 * `evaluateBoundaryPair` usada na formação (emenda arquitetural: único
 * classificador de par, nunca duas implementações paralelas).
 */
export function validateEvaluationConservation(
  evaluations: ReadonlyArray<PageBoundaryNeutralContinuityEvaluation>,
  groups: ReadonlyArray<NeutralDocumentGroup>,
): EvaluationConservationFailure {
  const expected = computeExpectedBoundaryPopulation(groups);

  // Gate 1 (população): conjunto de fronteiras produzidas === conjunto recalculado, sem duplicatas.
  const expectedKeys = expected.pairs.map((pair) => boundaryKey(pair.sourceCandidateGroupKey, pair.originPage.pageNumber, pair.targetPage.pageNumber));
  const producedKeys = evaluations.map((evaluation) => boundaryKey(evaluation.sourceCandidateGroupKey, evaluation.originPageNumber, evaluation.targetPageNumber));
  if (new Set(producedKeys).size !== producedKeys.length) return "evaluation_population_conservation_failed";
  if (new Set(expectedKeys).size !== new Set(producedKeys).size) return "evaluation_population_conservation_failed";
  for (const key of expectedKeys) if (!producedKeys.includes(key)) return "evaluation_population_conservation_failed";

  const pageByGroupAndNumber = new Map<string, NeutralDocumentPage>();
  for (const group of groups) for (const page of group.pages) pageByGroupAndNumber.set(`${group.sourceCandidateGroupKey}::${page.pageNumber}`, page);

  for (const evaluation of evaluations) {
    // Gate 3 (direção/grupo): recalculada a partir dos próprios campos publicados da avaliação.
    if (evaluation.targetPageNumber !== evaluation.originPageNumber + 1) return "evaluation_direction_conservation_failed";

    const originPage = pageByGroupAndNumber.get(`${evaluation.sourceCandidateGroupKey}::${evaluation.originPageNumber}`);
    const targetPage = pageByGroupAndNumber.get(`${evaluation.sourceCandidateGroupKey}::${evaluation.targetPageNumber}`);
    if (!originPage || !targetPage) return "evaluation_reference_conservation_failed";

    // Gate 2 (referência): toda chave não-nula publicada existe de fato na g.2 consumida.
    const originRegion = evaluation.originRegionKey === null ? null : originPage.regions.find((region) => region.sourceRegionKey === evaluation.originRegionKey) ?? null;
    if (evaluation.originRegionKey !== null && !originRegion) return "evaluation_reference_conservation_failed";
    const targetRegion = evaluation.targetRegionKey === null ? null : targetPage.regions.find((region) => region.sourceRegionKey === evaluation.targetRegionKey) ?? null;
    if (evaluation.targetRegionKey !== null && !targetRegion) return "evaluation_reference_conservation_failed";
    if (evaluation.originBoundaryLineKey !== null && (!originRegion || !originRegion.documentLines.some((line) => line.sourceLineKey === evaluation.originBoundaryLineKey))) return "evaluation_reference_conservation_failed";
    if (evaluation.targetBoundaryLineKey !== null && (!targetRegion || !targetRegion.documentLines.some((line) => line.sourceLineKey === evaluation.targetBoundaryLineKey))) return "evaluation_reference_conservation_failed";

    // Gates 4-7 (seleção/sinais/evidência/estado): rederivação independente, mesma função usada na formação.
    const recomputed = evaluateBoundaryPair(evaluation.sourceCandidateGroupKey, originPage, targetPage);
    if (recomputed.originRegionKey !== evaluation.originRegionKey || recomputed.targetRegionKey !== evaluation.targetRegionKey
      || recomputed.originBoundaryLineKey !== evaluation.originBoundaryLineKey || recomputed.targetBoundaryLineKey !== evaluation.targetBoundaryLineKey) {
      return "evaluation_selection_conservation_failed";
    }
    if (JSON.stringify(recomputed.observedSignals) !== JSON.stringify(evaluation.observedSignals)) return "evaluation_signal_conservation_failed";
    if (JSON.stringify(recomputed.favorableEvidence) !== JSON.stringify(evaluation.favorableEvidence) || JSON.stringify(recomputed.contraryEvidence) !== JSON.stringify(evaluation.contraryEvidence)) {
      return "evaluation_evidence_conservation_failed";
    }
    if (recomputed.status !== evaluation.status && evaluation.technicalProblems.length === 0) return "evaluation_status_conservation_failed";
  }

  // Gate 8 (partição categórica): total produzido == soma exata das categorias.
  const sustainedCount = evaluations.filter((evaluation) => evaluation.status === "continuity_sustained").length;
  const ambiguousCount = evaluations.filter((evaluation) => evaluation.status === "continuity_ambiguous").length;
  const notSustainedCount = evaluations.filter((evaluation) => evaluation.status === "continuity_not_sustained").length;
  const notProcessableCount = evaluations.filter((evaluation) => evaluation.status === "continuity_not_processable").length;
  const failedCount = evaluations.filter((evaluation) => evaluation.status === "continuity_evaluation_failed").length;
  if (evaluations.length !== sustainedCount + ambiguousCount + notSustainedCount + notProcessableCount + failedCount) return "evaluation_partition_conservation_failed";

  return null;
}

/** Portão 9 (§9/§11): métricas publicadas === recalculadas a partir das avaliações e problemas técnicos globais publicados — deep equal. */
export function validateMetricConservation(
  evaluations: ReadonlyArray<PageBoundaryNeutralContinuityEvaluation>,
  globalTechnicalProblems: ReadonlyArray<PageBoundaryNeutralContinuityTechnicalProblem>,
  receivedGroupCount: number,
  incoherentGroupCount: number,
  receivedPageCount: number,
  publishedMetrics: GlobalPageBoundaryNeutralContinuityMetrics,
): boolean {
  const recomputed = computeGlobalMetrics(receivedGroupCount, incoherentGroupCount, receivedPageCount, evaluations, globalTechnicalProblems);
  return JSON.stringify(recomputed) === JSON.stringify(publishedMetrics);
}
