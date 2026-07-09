import type { Decision } from "../domain/decision";
import type { Recommendation } from "../engines/decision/recommendation";
import type { EngineeringAdvisorHistoricalFacts } from "./advisor-historical-facts.types";

// Epic 14 (BBA Advisor Evolution), Sprint 14.4 — extraído de
// advisor-prompt-context-builder.ts (Sprint 14.3) para ser a única fonte
// de verdade de "o que é novo/recorrente/mudou de prioridade". Usado por
// buildEngineeringAdvisorPromptContext() (o que vai para o Claude) e por
// buildEngineeringAdvisorExplanations() (a prova que o BDOS monta depois
// — Sprint 14.4) — as duas chamam exatamente esta função, nunca
// recalculam o limiar de recorrência ou a comparação de prioridade cada
// uma à sua maneira.

export const RECOMMENDATION_RECURRING_THRESHOLD = 3;

export interface RecommendationTemporalFacts {
  readonly isNew: boolean;
  readonly openSinceImportCount: number;
  readonly recurring: boolean;
}

export function deriveRecommendationTemporalFacts(
  recommendation: Recommendation,
  historicalFacts: EngineeringAdvisorHistoricalFacts
): RecommendationTemporalFacts {
  const openSinceImportCount =
    historicalFacts.recommendationOpenSinceImportCountByRefId[recommendation.id] ?? 1;

  return {
    isNew: openSinceImportCount <= 1,
    openSinceImportCount,
    recurring: openSinceImportCount >= RECOMMENDATION_RECURRING_THRESHOLD
  };
}

export interface DecisionTemporalFacts {
  readonly isNew: boolean;
  readonly previousPriority: string | null;
  readonly priorityChanged: boolean;
}

export function deriveDecisionTemporalFacts(
  decision: Decision,
  historicalFacts: EngineeringAdvisorHistoricalFacts
): DecisionTemporalFacts {
  const previousPriority =
    historicalFacts.previousDecisions.find((previous) => previous.id === decision.id)?.priority ?? null;

  return {
    isNew: previousPriority === null,
    previousPriority,
    priorityChanged: previousPriority !== null && previousPriority !== decision.priority
  };
}
