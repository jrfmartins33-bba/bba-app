// Epic 14 (BBA Advisor Evolution), Sprint 14.5 — Engineering Advisor
// Confidence & Operational Readiness. EngineeringAdvisorConfidence é
// calculado inteiramente pelo BDOS, depois do Validator e depois da
// Explainability — nunca pelo Claude. "reasons" sempre emite o par
// positivo/negativo de cada checagem (nunca omite uma condição
// verificada), para ser totalmente auditável.

export type EngineeringAdvisorConfidenceLevel = "high" | "medium" | "low";

export type EngineeringAdvisorConfidenceReason =
  | "validator_passed"
  | "validator_failed"
  | "history_available"
  | "history_unavailable"
  | "all_decisions_traceable"
  | "some_decisions_untraceable"
  | "all_recommendations_traceable"
  | "some_recommendations_untraceable"
  | "evidence_complete"
  | "evidence_incomplete"
  // Decision Copilot (Epic 15, Fase 2) — turno resolvido de forma
  // determinística (Clarifying Questions, unsupported_action), sem
  // insight validado a avaliar. Ver DECISION_COPILOT_PHASE2.md §2/§6.
  | "clarifying_question"
  | "unsupported_action_request"
  // Decision Copilot (Epic 16.7) — aprovação estrutural de uma
  // Recommendation, materializada via Execution Engine. Também
  // determinística (nunca chama o Claude). Ver
  // COPILOT_WORKFLOW_HANDOFF.md.
  | "recommendation_approved";

export interface EngineeringAdvisorConfidenceMetrics {
  readonly insightCount: number;
  readonly explainedInsightCount: number;
  readonly traceabilityCoverage: number;
  readonly evidenceCoverage: number;
  readonly recommendationCoverage: number;
  readonly missingReferenceCount: number;
}

export interface EngineeringAdvisorConfidence {
  readonly overall: EngineeringAdvisorConfidenceLevel;
  readonly reasons: ReadonlyArray<EngineeringAdvisorConfidenceReason>;
  readonly metrics: EngineeringAdvisorConfidenceMetrics;
}
