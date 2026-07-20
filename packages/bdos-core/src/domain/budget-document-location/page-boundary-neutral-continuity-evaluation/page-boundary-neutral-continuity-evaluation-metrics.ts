import type { GlobalPageBoundaryNeutralContinuityMetrics, PageBoundaryNeutralContinuityEvaluation, PageBoundaryNeutralContinuityTechnicalProblem } from "./budget-document-page-boundary-neutral-continuity-evaluation.types";

/**
 * Métricas globais (§11): partição categórica exata sobre `evaluations`, mais
 * a contagem de grupos incoerentes (Gate 0) e a contagem bruta de páginas
 * recebidas. `expectedPageBoundaryCount === producedEvaluationCount` sempre
 * — toda fronteira esperada produz exatamente uma avaliação, inclusive
 * `continuity_evaluation_failed` (isolamento nunca omite).
 */
export function computeGlobalMetrics(
  receivedGroupCount: number,
  incoherentGroupCount: number,
  receivedPageCount: number,
  evaluations: ReadonlyArray<PageBoundaryNeutralContinuityEvaluation>,
  globalTechnicalProblems: ReadonlyArray<PageBoundaryNeutralContinuityTechnicalProblem>,
): GlobalPageBoundaryNeutralContinuityMetrics {
  const sustainedCount = evaluations.filter((evaluation) => evaluation.status === "continuity_sustained").length;
  const ambiguousCount = evaluations.filter((evaluation) => evaluation.status === "continuity_ambiguous").length;
  const notSustainedCount = evaluations.filter((evaluation) => evaluation.status === "continuity_not_sustained").length;
  const notProcessableCount = evaluations.filter((evaluation) => evaluation.status === "continuity_not_processable").length;
  const failedCount = evaluations.filter((evaluation) => evaluation.status === "continuity_evaluation_failed").length;
  const favorableEvidenceCount = evaluations.reduce((total, evaluation) => total + evaluation.favorableEvidence.length, 0);
  const contraryEvidenceCount = evaluations.reduce((total, evaluation) => total + evaluation.contraryEvidence.length, 0);
  const evaluationTechnicalProblemCount = evaluations.reduce((total, evaluation) => total + evaluation.technicalProblems.length, 0);
  return {
    receivedGroupCount,
    incoherentGroupCount,
    receivedPageCount,
    expectedPageBoundaryCount: evaluations.length,
    producedEvaluationCount: evaluations.length,
    sustainedCount, ambiguousCount, notSustainedCount, notProcessableCount, failedCount,
    favorableEvidenceCount, contraryEvidenceCount,
    technicalProblemCount: globalTechnicalProblems.length + evaluationTechnicalProblemCount,
  };
}
