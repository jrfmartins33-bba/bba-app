import type { DecisionId } from "../domain/decision";
import type { RecommendationId } from "../engines/decision/recommendation";

// Epic 14 (BBA Advisor Evolution), Sprint 14.2 — Structured Advisor
// Summary: o que o Claude deve responder no lugar de texto livre (ver
// claude-narrator.ts). Cada insight precisa ser auditável — validado por
// advisor-response-validator.ts antes de qualquer persistência.
//
// "priority" reaproveita o vocabulário de DecisionPriority
// (low/medium/high/critical) em vez de inventar uma terceira taxonomia —
// o Home hoje já usa outra própria (critical/attention/info/trend) para
// os itens template, que não é tocada por esta Sprint.

export type EngineeringAdvisorInsightPriority = "low" | "medium" | "high" | "critical";

export interface EngineeringAdvisorInsight {
  readonly title: string;
  readonly summary: string;
  readonly priority: EngineeringAdvisorInsightPriority;
  readonly decisionIds: ReadonlyArray<DecisionId>;
  readonly recommendationIds: ReadonlyArray<RecommendationId>;
  readonly evidenceDecisionIds: ReadonlyArray<DecisionId>;
}

export interface EngineeringAdvisorSummary {
  readonly insights: ReadonlyArray<EngineeringAdvisorInsight>;
}
