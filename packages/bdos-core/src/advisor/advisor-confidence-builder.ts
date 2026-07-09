import type { EngineeringAdvisorExplanation } from "./advisor-explanation.types";
import type { EngineeringAdvisorHistoricalFacts } from "./advisor-historical-facts.types";
import type { EngineeringAdvisorValidationResult } from "./advisor-response-validator";
import type {
  EngineeringAdvisorConfidence,
  EngineeringAdvisorConfidenceLevel,
  EngineeringAdvisorConfidenceReason
} from "./advisor-confidence.types";

// Epic 14 (BBA Advisor Evolution), Sprint 14.5 — Engineering Advisor
// Confidence & Operational Readiness. Função pura, sem I/O, sem consulta
// nova: só agrega o que buildEngineeringAdvisorExplanations() (Sprint
// 14.4) já calculou. Nunca recalcula resolução de id — cada
// EngineeringAdvisorExplanation já carrega o que resolveu (decisions/
// recommendations/evidence) e o que faltou (missingReferences); aqui só
// somamos. Zero duplicação de lógica com Explainability.
//
// Regra de "overall" deliberadamente simples (sem limiar percentual, sem
// número mágico não pedido): "low" se o Validator reprovou (não há
// summary confiável para medir nada); "high" se o Validator aprovou e
// nenhuma referência ficou ausente; "medium" caso contrário (aprovado,
// mas com alguma referência ausente).
export function buildEngineeringAdvisorConfidence(
  validation: EngineeringAdvisorValidationResult,
  explanations: ReadonlyArray<EngineeringAdvisorExplanation> | null,
  historicalFacts: EngineeringAdvisorHistoricalFacts
): EngineeringAdvisorConfidence {
  const historyAvailable = historicalFacts.previousDecisions.length > 0;

  if (!validation.valid || !explanations) {
    return {
      overall: "low",
      reasons: ["validator_failed", historyAvailable ? "history_available" : "history_unavailable"],
      metrics: {
        insightCount: 0,
        explainedInsightCount: 0,
        traceabilityCoverage: 0,
        evidenceCoverage: 0,
        recommendationCoverage: 0,
        missingReferenceCount: 0
      }
    };
  }

  let explainedInsightCount = 0;
  let totalDecisionRefs = 0;
  let missingDecisionRefs = 0;
  let totalRecommendationRefs = 0;
  let missingRecommendationRefs = 0;
  let totalEvidenceRefs = 0;
  let missingEvidenceRefs = 0;

  for (const explanation of explanations) {
    const missing = explanation.missingReferences;

    totalDecisionRefs += explanation.decisions.length + missing.decisionIds.length;
    missingDecisionRefs += missing.decisionIds.length;

    totalRecommendationRefs += explanation.recommendations.length + missing.recommendationIds.length;
    missingRecommendationRefs += missing.recommendationIds.length;

    totalEvidenceRefs += explanation.evidence.length + missing.evidenceDecisionIds.length;
    missingEvidenceRefs += missing.evidenceDecisionIds.length;

    const isFullyExplained =
      missing.decisionIds.length === 0 &&
      missing.recommendationIds.length === 0 &&
      missing.evidenceDecisionIds.length === 0;

    if (isFullyExplained) {
      explainedInsightCount += 1;
    }
  }

  const missingReferenceCount = missingDecisionRefs + missingRecommendationRefs + missingEvidenceRefs;
  const totalRefs = totalDecisionRefs + totalRecommendationRefs + totalEvidenceRefs;

  const traceabilityCoverage = coverageRatio(totalRefs, missingReferenceCount);
  const evidenceCoverage = coverageRatio(totalEvidenceRefs, missingEvidenceRefs);
  const recommendationCoverage = coverageRatio(totalRecommendationRefs, missingRecommendationRefs);

  const reasons: EngineeringAdvisorConfidenceReason[] = [
    "validator_passed",
    historyAvailable ? "history_available" : "history_unavailable",
    missingDecisionRefs === 0 ? "all_decisions_traceable" : "some_decisions_untraceable",
    missingRecommendationRefs === 0 ? "all_recommendations_traceable" : "some_recommendations_untraceable",
    missingEvidenceRefs === 0 ? "evidence_complete" : "evidence_incomplete"
  ];

  const overall: EngineeringAdvisorConfidenceLevel = missingReferenceCount === 0 ? "high" : "medium";

  return {
    overall,
    reasons,
    metrics: {
      insightCount: explanations.length,
      explainedInsightCount,
      traceabilityCoverage,
      evidenceCoverage,
      recommendationCoverage,
      missingReferenceCount
    }
  };
}

function coverageRatio(total: number, missing: number): number {
  if (total === 0) {
    return 1;
  }
  return (total - missing) / total;
}
