import type { Decision } from "../domain/decision";
import type { EngineeringAdvisorContext } from "./advisor-context.types";
import type {
  EngineeringAdvisorExplanation,
  EngineeringAdvisorExplanationEvidence
} from "./advisor-explanation.types";
import type { EngineeringAdvisorHistoricalFacts } from "./advisor-historical-facts.types";
import type { EngineeringAdvisorSummary } from "./advisor-summary.types";
import { deriveRecommendationTemporalFacts } from "./advisor-temporal-facts";

// Epic 14 (BBA Advisor Evolution), Sprint 14.4 — Engineering Advisor
// Explainability. Função pura, sem I/O: recebe o EngineeringAdvisorSummary
// já validado (Validator, inalterado), o EngineeringAdvisorContext
// completo e o EngineeringAdvisorHistoricalFacts já buscados — nenhuma
// chamada nova ao Claude, nenhum dado novo do banco. Só junta id → objeto
// para cada insight, exatamente como o Validator já confirmou que existe.
//
// isNew/recurring de cada recommendation citada reusam
// deriveRecommendationTemporalFacts (advisor-temporal-facts.ts) — a mesma
// função que buildEngineeringAdvisorPromptContext usa — para nunca haver
// duas implementações do limiar de recorrência.
export function buildEngineeringAdvisorExplanations(
  summary: EngineeringAdvisorSummary,
  context: EngineeringAdvisorContext,
  historicalFacts: EngineeringAdvisorHistoricalFacts
): ReadonlyArray<EngineeringAdvisorExplanation> {
  const decisionsById = new Map(context.decisions.map((decision) => [decision.id, decision]));
  const recommendationsById = new Map(context.recommendations.map((recommendation) => [recommendation.id, recommendation]));

  return summary.insights.map((insight) => {
    const missingDecisionIds: string[] = [];
    const decisions = insight.decisionIds.flatMap((id) => {
      const decision = decisionsById.get(id);
      if (!decision) {
        missingDecisionIds.push(id);
        return [];
      }
      return [toExplanationDecision(decision)];
    });

    const missingRecommendationIds: string[] = [];
    const recommendations = insight.recommendationIds.flatMap((id) => {
      const recommendation = recommendationsById.get(id);
      if (!recommendation) {
        missingRecommendationIds.push(id);
        return [];
      }
      const temporalFacts = deriveRecommendationTemporalFacts(recommendation, historicalFacts);
      return [
        {
          id: recommendation.id,
          title: recommendation.title,
          isNew: temporalFacts.isNew,
          recurring: temporalFacts.recurring
        }
      ];
    });

    const missingEvidenceDecisionIds: string[] = [];
    const evidence = insight.evidenceDecisionIds.flatMap((decisionId) => {
      const evidenceList = context.evidenceIndex[decisionId];
      if (!evidenceList || evidenceList.length === 0) {
        missingEvidenceDecisionIds.push(decisionId);
        return [];
      }
      return evidenceList.map(
        (evidenceItem): EngineeringAdvisorExplanationEvidence => ({
          decisionId,
          source: evidenceItem.source,
          description: evidenceItem.description
        })
      );
    });

    return {
      insightTitle: insight.title,
      decisions,
      recommendations,
      evidence,
      missingReferences: {
        decisionIds: missingDecisionIds,
        recommendationIds: missingRecommendationIds,
        evidenceDecisionIds: missingEvidenceDecisionIds
      }
    };
  });
}

function toExplanationDecision(decision: Decision) {
  return {
    id: decision.id,
    title: decision.title,
    priority: decision.priority
  };
}
