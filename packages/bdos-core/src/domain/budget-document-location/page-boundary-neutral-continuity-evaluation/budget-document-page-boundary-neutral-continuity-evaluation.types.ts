import type {
  BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult,
  NeutralDocumentLineStatus,
  NeutralDocumentRegionStatus,
  PageLocalNeutralStructuredEvidenceFormationStatus,
} from "../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";

/**
 * Contrato puro da Sprint 21.4A.2.g.3 — "Avaliação Neutra de Continuidade na
 * Fronteira entre Páginas". Responde apenas "quais fronteiras entre páginas
 * consecutivas do mesmo grupo apresentam evidência estrutural (nunca
 * econômica) suficiente para serem tratadas como candidatas de continuidade?"
 * — nunca "o que esta linha significa economicamente?", nunca funde,
 * concatena ou escolhe entre páginas. Consome exclusivamente o resultado já
 * publicado pela g.2 (`BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult`)
 * — nunca relê f.0/f.1/f.2a/f.2c/g.1 diretamente. A g.2 continua sendo a
 * única fonte da verdade para grupos, páginas, regiões, linhas, posições e
 * células; esta capacidade nunca os altera, apenas avalia relações entre
 * fronteiras já publicadas por ela.
 */

export const BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_SCHEMA_VERSION = 1 as const;
export const BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_ENGINE_NAME = "budget-document-page-boundary-neutral-continuity-evaluation-engine" as const;
export const BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_ENGINE_VERSION = "budget-document-page-boundary-neutral-continuity-evaluation-engine-v1" as const;
export const PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_IDENTITY_FINGERPRINT_VERSION = "budget-document-page-boundary-neutral-continuity-evaluation-identity-fingerprint-v1" as const;
export const PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_RESULT_FINGERPRINT_VERSION = "budget-document-page-boundary-neutral-continuity-evaluation-result-fingerprint-v1" as const;
export const PAGE_BOUNDARY_NEUTRAL_CONTINUITY_CANONICAL_SERIALIZATION_VERSION = "page-boundary-neutral-continuity-canonical-serialization-v1" as const;

/** Identidade da regra de população normativa: uma avaliação por par de páginas consecutivas do mesmo grupo (§5/§12). */
export const PAGE_BOUNDARY_CONSECUTIVE_PAIR_POPULATION_RULE_ID = "page-boundary-consecutive-pair-population-v1" as const;
export const PAGE_BOUNDARY_CONSECUTIVE_PAIR_POPULATION_RULE_VERSION = 1 as const;
/** Identidade da regra de seleção extremal de região/linha de fronteira (maior order/verticalOrder na origem, menor no destino) (§6). */
export const PAGE_BOUNDARY_EXTREMAL_SELECTION_RULE_ID = "page-boundary-extremal-region-and-line-selection-v1" as const;
export const PAGE_BOUNDARY_EXTREMAL_SELECTION_RULE_VERSION = 1 as const;
/** Identidade da regra de avaliação dos cinco sinais estruturais (§7). */
export const PAGE_BOUNDARY_CONTINUITY_SIGNAL_EVALUATION_RULE_ID = "page-boundary-neutral-continuity-signal-evaluation-v1" as const;
export const PAGE_BOUNDARY_CONTINUITY_SIGNAL_EVALUATION_RULE_VERSION = 1 as const;
/** Identidade da matriz de classificação determinística (§4). */
export const PAGE_BOUNDARY_CONTINUITY_CLASSIFICATION_RULE_ID = "page-boundary-neutral-continuity-classification-v1" as const;
export const PAGE_BOUNDARY_CONTINUITY_CLASSIFICATION_RULE_VERSION = 1 as const;

/** Porta de entrada: exclusivamente o resultado já publicado pela g.2. */
export interface BudgetDocumentPageBoundaryNeutralContinuityEvaluationInput {
  readonly pageLocalNeutralStructuredEvidence: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult;
}

// --- elegibilidade estrutural de fronteira (§6, emenda 1) --------------------

export const ELIGIBLE_BOUNDARY_REGION_STATES: ReadonlyArray<NeutralDocumentRegionStatus> = [
  "structured", "structured_with_ambiguities", "structured_with_problems", "grid_without_cells", "without_physical_grid",
];

/** Emenda 1: `upstream_not_processable` NUNCA é elegível — só `failed` seria insuficiente. */
export const ELIGIBLE_BOUNDARY_LINE_STATUSES: ReadonlyArray<NeutralDocumentLineStatus> = [
  "structured", "structured_with_problems", "without_positions",
];

export const PROCESSABLE_PAGE_STATES: ReadonlyArray<import("../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types").NeutralDocumentPageStatus> = [
  "structured", "structured_with_problems", "partially_structured",
];

// --- sinais observados (§7) --------------------------------------------------

export type PageProcessabilitySignalOutcome =
  | "both_pages_processable" | "origin_page_not_processable" | "target_page_not_processable" | "both_pages_not_processable";
export type BoundaryRegionSignalOutcome =
  | "both_boundary_regions_available" | "origin_boundary_region_missing" | "target_boundary_region_missing" | "both_boundary_regions_missing";
export type BoundaryLineSignalOutcome =
  | "both_boundary_lines_available" | "origin_boundary_line_missing" | "target_boundary_line_missing" | "both_boundary_lines_missing";
export type ColumnSignatureSignalOutcome =
  | "column_signature_match" | "column_signature_mismatch" | "column_signature_inconclusive";
export type HorizontalGeometrySignalOutcome =
  | "geometry_compatible" | "geometry_incompatible" | "geometry_inconclusive";

export type PageBoundaryNeutralContinuitySignal =
  | { readonly signal: "page_processability"; readonly outcome: PageProcessabilitySignalOutcome }
  | { readonly signal: "boundary_region_existence"; readonly outcome: BoundaryRegionSignalOutcome }
  | { readonly signal: "boundary_line_existence"; readonly outcome: BoundaryLineSignalOutcome }
  | { readonly signal: "column_signature_compatibility"; readonly outcome: ColumnSignatureSignalOutcome; readonly originPositionCount: number; readonly targetPositionCount: number }
  | {
      readonly signal: "horizontal_geometry_compatibility";
      readonly outcome: HorizontalGeometrySignalOutcome;
      readonly horizontalOverlapRatio: number | null;
      readonly widthSimilarityRatio: number | null;
      readonly leftBoundaryDeviationRatio: number | null;
      readonly rightBoundaryDeviationRatio: number | null;
    };

// --- evidência (§ emenda 3, união fechada) -----------------------------------

export type PageBoundaryNeutralContinuityEvidence =
  | { readonly evidence: "matching_column_signature"; readonly sourceSignal: "column_signature_compatibility"; readonly sourceOutcome: "column_signature_match" }
  | { readonly evidence: "compatible_horizontal_geometry"; readonly sourceSignal: "horizontal_geometry_compatibility"; readonly sourceOutcome: "geometry_compatible" }
  | { readonly evidence: "mismatching_column_signature"; readonly sourceSignal: "column_signature_compatibility"; readonly sourceOutcome: "column_signature_mismatch" }
  | { readonly evidence: "incompatible_horizontal_geometry"; readonly sourceSignal: "horizontal_geometry_compatibility"; readonly sourceOutcome: "geometry_incompatible" };

// --- problemas técnicos -------------------------------------------------------

export type PageBoundaryNeutralContinuityTechnicalProblemCode =
  | "source_contract_version_unsupported" | "source_status_invalid" | "source_fingerprint_invalid"
  | "source_group_reference_invalid"
  | "source_group_page_population_incoherent" | "source_region_reference_invalid" | "source_line_reference_invalid"
  | "boundary_region_selection_ambiguous" | "boundary_line_selection_ambiguous"
  | "signal_evaluation_failed"
  | "evaluation_population_conservation_failed" | "evaluation_reference_conservation_failed" | "evaluation_direction_conservation_failed"
  | "evaluation_selection_conservation_failed" | "evaluation_signal_conservation_failed" | "evaluation_evidence_conservation_failed"
  | "evaluation_status_conservation_failed" | "evaluation_partition_conservation_failed" | "metric_conservation_failed"
  | "page_boundary_continuity_unexpected_failure";

export type PageBoundaryNeutralContinuityTechnicalProblemPhase =
  | "source_validation" | "population_formation" | "boundary_selection" | "signal_evaluation" | "classification" | "conservation_validation";

export interface PageBoundaryNeutralContinuityTechnicalProblem {
  readonly code: PageBoundaryNeutralContinuityTechnicalProblemCode;
  readonly phase: PageBoundaryNeutralContinuityTechnicalProblemPhase;
  readonly sourceCandidateGroupKey: string | null;
  readonly originPageNumber: number | null;
  readonly targetPageNumber: number | null;
  readonly originRegionKey: string | null;
  readonly targetRegionKey: string | null;
  readonly originBoundaryLineKey: string | null;
  readonly targetBoundaryLineKey: string | null;
  readonly message: string;
}

// --- avaliação (§3, unidade normativa) ---------------------------------------

export type PageBoundaryNeutralContinuityEvaluationStatus =
  | "continuity_sustained" | "continuity_ambiguous" | "continuity_not_sustained" | "continuity_not_processable" | "continuity_evaluation_failed";

export interface PageBoundaryNeutralContinuityEvaluation {
  readonly sourceCandidateGroupKey: string;
  readonly originPageNumber: number;
  readonly targetPageNumber: number;
  readonly originRegionKey: string | null;
  readonly targetRegionKey: string | null;
  readonly originBoundaryLineKey: string | null;
  readonly targetBoundaryLineKey: string | null;
  readonly status: PageBoundaryNeutralContinuityEvaluationStatus;
  readonly observedSignals: ReadonlyArray<PageBoundaryNeutralContinuitySignal>;
  readonly favorableEvidence: ReadonlyArray<PageBoundaryNeutralContinuityEvidence>;
  readonly contraryEvidence: ReadonlyArray<PageBoundaryNeutralContinuityEvidence>;
  readonly technicalProblems: ReadonlyArray<PageBoundaryNeutralContinuityTechnicalProblem>;
}

// --- métricas -----------------------------------------------------------------

export interface GlobalPageBoundaryNeutralContinuityMetrics {
  readonly receivedGroupCount: number;
  readonly incoherentGroupCount: number;
  readonly receivedPageCount: number;
  readonly expectedPageBoundaryCount: number;
  readonly producedEvaluationCount: number;
  readonly sustainedCount: number;
  readonly ambiguousCount: number;
  readonly notSustainedCount: number;
  readonly notProcessableCount: number;
  readonly failedCount: number;
  readonly favorableEvidenceCount: number;
  readonly contraryEvidenceCount: number;
  readonly technicalProblemCount: number;
}

// --- limitações ----------------------------------------------------------------

export type PageBoundaryNeutralContinuityLimitationCode =
  | "page_boundary_evaluation_is_not_confirmed_continuity"
  | "candidate_region_is_not_a_confirmed_table" | "neutral_document_line_is_not_a_budget_line"
  | "structural_thresholds_not_validated_against_real_budget_documents"
  | "textual_repetition_not_evaluated_in_v1" | "page_skip_continuity_not_evaluated_in_v1"
  | "no_page_or_line_merge_performed" | "no_region_merge_performed" | "no_multi_page_line_created"
  | "no_economic_characterization_performed" | "no_numeric_parsing_performed"
  | "no_budget_line_created" | "no_budget_version_created" | "no_import_proposal_created"
  | "no_persistence" | "no_api_or_route" | "no_user_interface" | "no_physical_audit_viewer"
  | "no_ai_or_ocr_applied" | "real_document_out_of_scope" | "no_commercial_readiness_claim";

// --- estado global e resultado -------------------------------------------------

export type PageBoundaryNeutralContinuityEvaluationGlobalStatus = "evaluated" | "evaluated_with_problems" | "failed";

export interface BudgetDocumentPageBoundaryNeutralContinuityEvaluationResult {
  readonly schemaVersion: typeof BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_SCHEMA_VERSION;
  readonly evaluationEngineName: typeof BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_ENGINE_NAME;
  readonly evaluationEngineVersion: typeof BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_ENGINE_VERSION;
  readonly evaluationProfileId: string;
  readonly evaluationProfileVersion: number;
  readonly populationRuleId: typeof PAGE_BOUNDARY_CONSECUTIVE_PAIR_POPULATION_RULE_ID;
  readonly populationRuleVersion: typeof PAGE_BOUNDARY_CONSECUTIVE_PAIR_POPULATION_RULE_VERSION;
  readonly boundarySelectionRuleId: typeof PAGE_BOUNDARY_EXTREMAL_SELECTION_RULE_ID;
  readonly boundarySelectionRuleVersion: typeof PAGE_BOUNDARY_EXTREMAL_SELECTION_RULE_VERSION;
  readonly signalEvaluationRuleId: typeof PAGE_BOUNDARY_CONTINUITY_SIGNAL_EVALUATION_RULE_ID;
  readonly signalEvaluationRuleVersion: typeof PAGE_BOUNDARY_CONTINUITY_SIGNAL_EVALUATION_RULE_VERSION;
  readonly classificationRuleId: typeof PAGE_BOUNDARY_CONTINUITY_CLASSIFICATION_RULE_ID;
  readonly classificationRuleVersion: typeof PAGE_BOUNDARY_CONTINUITY_CLASSIFICATION_RULE_VERSION;
  readonly canonicalSerializationVersion: typeof PAGE_BOUNDARY_NEUTRAL_CONTINUITY_CANONICAL_SERIALIZATION_VERSION;
  readonly identityFingerprintVersion: typeof PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_IDENTITY_FINGERPRINT_VERSION;
  readonly identityFingerprint: string;
  readonly resultFingerprintVersion: typeof PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_RESULT_FINGERPRINT_VERSION;
  readonly resultFingerprint: string;
  readonly sourceByteHash: string;

  readonly sourcePageLocalNeutralStructuredEvidenceFormationSchemaVersion: number;
  readonly sourcePageLocalNeutralStructuredEvidenceFormationEngineName: string;
  readonly sourcePageLocalNeutralStructuredEvidenceFormationEngineVersion: string;
  readonly sourcePageLocalNeutralStructuredEvidenceFormationProfileId: string;
  readonly sourcePageLocalNeutralStructuredEvidenceFormationProfileVersion: number;
  readonly sourcePageLocalNeutralStructuredEvidenceFormationIdentityFingerprintVersion: string;
  readonly sourcePageLocalNeutralStructuredEvidenceFormationIdentityFingerprint: string;
  readonly sourcePageLocalNeutralStructuredEvidenceFormationResultFingerprintVersion: string;
  readonly sourcePageLocalNeutralStructuredEvidenceFormationResultFingerprint: string;
  readonly sourcePageLocalNeutralStructuredEvidenceFormationStatus: PageLocalNeutralStructuredEvidenceFormationStatus;

  readonly status: PageBoundaryNeutralContinuityEvaluationGlobalStatus;
  readonly evaluations: ReadonlyArray<PageBoundaryNeutralContinuityEvaluation>;
  readonly technicalProblems: ReadonlyArray<PageBoundaryNeutralContinuityTechnicalProblem>;
  readonly metrics: GlobalPageBoundaryNeutralContinuityMetrics;
  readonly limitations: ReadonlyArray<PageBoundaryNeutralContinuityLimitationCode>;
}
