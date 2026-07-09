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
  | "evidence_incomplete";

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
