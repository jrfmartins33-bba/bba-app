import type {
  ColumnSignatureSignalOutcome,
  HorizontalGeometrySignalOutcome,
  PageBoundaryNeutralContinuityEvaluationStatus,
  PageBoundaryNeutralContinuityEvidence,
} from "./budget-document-page-boundary-neutral-continuity-evaluation.types";

export interface MeritClassificationResult {
  /** Sempre uma das três categorias de mérito — nunca `continuity_not_processable`/`continuity_evaluation_failed`, decididas antes de chegar aqui. */
  readonly status: PageBoundaryNeutralContinuityEvaluationStatus;
  readonly favorableEvidence: ReadonlyArray<PageBoundaryNeutralContinuityEvidence>;
  readonly contraryEvidence: ReadonlyArray<PageBoundaryNeutralContinuityEvidence>;
}

/**
 * Classificador único de mérito (§4): a ÚNICA fonte da síntese categórica a
 * partir dos sinais D e E, usada tanto na formação quanto na conservação
 * (rederivação independente, nunca duas implementações paralelas). Função
 * total, sem score, peso ou média:
 *
 *   1. qualquer evidência contrária presente  → continuity_not_sustained
 *   2. ambos os sinais de mérito favoráveis
 *      e nenhuma contrária                    → continuity_sustained
 *   3. demais combinações sem contrária        → continuity_ambiguous
 *
 * Resultados inconclusivos nunca produzem evidência favorável nem contrária.
 */
export function classifyMeritSignals(columnSignatureOutcome: ColumnSignatureSignalOutcome, geometryOutcome: HorizontalGeometrySignalOutcome): MeritClassificationResult {
  const favorableEvidence: PageBoundaryNeutralContinuityEvidence[] = [];
  const contraryEvidence: PageBoundaryNeutralContinuityEvidence[] = [];

  if (columnSignatureOutcome === "column_signature_match") favorableEvidence.push({ evidence: "matching_column_signature", sourceSignal: "column_signature_compatibility", sourceOutcome: "column_signature_match" });
  if (columnSignatureOutcome === "column_signature_mismatch") contraryEvidence.push({ evidence: "mismatching_column_signature", sourceSignal: "column_signature_compatibility", sourceOutcome: "column_signature_mismatch" });
  if (geometryOutcome === "geometry_compatible") favorableEvidence.push({ evidence: "compatible_horizontal_geometry", sourceSignal: "horizontal_geometry_compatibility", sourceOutcome: "geometry_compatible" });
  if (geometryOutcome === "geometry_incompatible") contraryEvidence.push({ evidence: "incompatible_horizontal_geometry", sourceSignal: "horizontal_geometry_compatibility", sourceOutcome: "geometry_incompatible" });

  const status: PageBoundaryNeutralContinuityEvaluationStatus = contraryEvidence.length > 0
    ? "continuity_not_sustained"
    : columnSignatureOutcome === "column_signature_match" && geometryOutcome === "geometry_compatible"
      ? "continuity_sustained"
      : "continuity_ambiguous";

  return { status, favorableEvidence, contraryEvidence };
}

/** Classificador único de status global (mesma disciplina: única fonte, reutilizada por formação e conservação). */
export function deriveGlobalStatus(
  incoherentGroupCount: number,
  evaluations: ReadonlyArray<{ readonly status: PageBoundaryNeutralContinuityEvaluationStatus }>,
  globalTechnicalProblemCount: number,
): "evaluated" | "evaluated_with_problems" {
  const anyFailedEvaluation = evaluations.some((evaluation) => evaluation.status === "continuity_evaluation_failed");
  if (incoherentGroupCount > 0 || anyFailedEvaluation || globalTechnicalProblemCount > 0) return "evaluated_with_problems";
  return "evaluated";
}
