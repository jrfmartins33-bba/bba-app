import type { BudgetDocumentSignalId } from "../budget-document-signal-catalog.types";
import type {
  DocumentSignalObservationSourceMetadata,
  DocumentSignalObservationStatus,
  DocumentSignalObservationTechnicalProblem,
  SignalEvaluation,
} from "../signal-observation/signal-observation.types";

export const BUDGET_DOCUMENT_PAGE_LOCATION_SCHEMA_VERSION = 1 as const;

export const BUDGET_DOCUMENT_PAGE_LOCATOR_NAME = "budget-document-page-locator" as const;

export const BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION = "budget-document-page-locator-v1" as const;

export const PAGE_LOCATION_DECISION_RULE_SET_VERSION = "budget-document-page-location-rules-v1" as const;

export const CANDIDATE_GROUP_FORMATION_RULE_ID = "contiguous-candidate-pages-v1" as const;

export const CANDIDATE_GROUP_FORMATION_RULE_VERSION = 1 as const;

export type BudgetDocumentPageClassification =
  | "candidate"
  | "documentary_context"
  | "ambiguous"
  | "no_positive_evidence"
  | "not_evaluable";

export type BudgetPageCandidateType = "direct" | "structural_continuity" | "closing";

export type BudgetPageLocationDecisionPhase =
  | "technical_classification"
  | "direct_classification"
  | "structural_continuity"
  | "closing"
  | "remaining_classification";

export type BudgetPageLocationDecisionOrigin = "technical" | "direct" | "propagated" | "derived";

export type BudgetPageLocationEvidenceFunction =
  | "direct_support"
  | "continuity_support"
  | "closing_support"
  | "context_support"
  | "ambiguity_support"
  | "absence_support"
  | "technical_limitation";

export type BudgetPageLocationReasonCode =
  | "candidate_service_item_and_bdi"
  | "candidate_service_item_and_total"
  | "candidate_service_item_by_continuity"
  | "candidate_closing_page_by_continuity"
  | "documentary_context_budget_reference"
  | "ambiguous_positive_content_evidence"
  | "no_positive_content_evidence"
  | "not_evaluable_no_extractable_text"
  | "not_evaluable_extraction_error"
  | "not_evaluable_content_rule_failure";

export interface BudgetPageLocationSatisfiedRule {
  readonly ruleId: string;
  readonly ruleVersion: number;
}

/**
 * Referência imutável à avaliação produzida pelo observador. A avaliação
 * original, inclusive sua evidência, é reutilizada sem reconstrução,
 * concatenação de texto ou alteração de significado.
 */
export interface BudgetPageLocationSignalReference {
  readonly signalId: BudgetDocumentSignalId;
  readonly functionInDecision: BudgetPageLocationEvidenceFunction;
  readonly sourceEvaluation: SignalEvaluation;
}

export interface BudgetDocumentPageDecision {
  readonly pageNumber: number;
  readonly classification: BudgetDocumentPageClassification;
  readonly candidateType: BudgetPageCandidateType | null;
  readonly primaryRuleId: string;
  readonly primaryRuleVersion: number;
  readonly satisfiedRules: ReadonlyArray<BudgetPageLocationSatisfiedRule>;
  readonly supportingSignals: ReadonlyArray<BudgetPageLocationSignalReference>;
  readonly limitingSignals: ReadonlyArray<BudgetPageLocationSignalReference>;
  readonly neighborPageNumbersUsed: ReadonlyArray<number>;
  readonly decisionPhase: BudgetPageLocationDecisionPhase;
  readonly decisionOrigin: BudgetPageLocationDecisionOrigin;
  readonly canAnchor: boolean;
  readonly reasonCode: BudgetPageLocationReasonCode;
  readonly locatorVersion: typeof BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION;
  readonly decisionRuleSetVersion: typeof PAGE_LOCATION_DECISION_RULE_SET_VERSION;
  readonly sourceObserverVersion: string;
  readonly sourceObservationRuleSetVersion: string;
  readonly sourceCatalogVersion: string;
  readonly sourceByteHash: string;
}

export interface BudgetPageCandidateGroupMember {
  readonly pageNumber: number;
  readonly candidateType: BudgetPageCandidateType;
  readonly primaryRuleId: string;
  readonly primaryRuleVersion: number;
}

export interface BudgetPageCandidateGroup {
  readonly groupKey: string;
  readonly sourceByteHash: string;
  readonly startPageNumber: number;
  readonly endPageNumber: number;
  readonly pageNumbers: ReadonlyArray<number>;
  readonly members: ReadonlyArray<BudgetPageCandidateGroupMember>;
  readonly supportingRules: ReadonlyArray<BudgetPageLocationSatisfiedRule>;
  readonly immediatelyPreviousContextPageNumber: number | null;
  readonly immediatelyFollowingContextPageNumber: number | null;
  readonly formationRuleId: typeof CANDIDATE_GROUP_FORMATION_RULE_ID;
  readonly formationRuleVersion: typeof CANDIDATE_GROUP_FORMATION_RULE_VERSION;
  readonly locatorVersion: typeof BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION;
  readonly decisionRuleSetVersion: typeof PAGE_LOCATION_DECISION_RULE_SET_VERSION;
}

export type BudgetPageLocationStatus = "completed" | "completed_with_problems" | "failed";

export type BudgetPageLocationTechnicalProblemCode =
  | "source_observation_failed"
  | "source_observation_version_unsupported"
  | "source_observation_contract_invalid"
  | "source_observation_evidence_inconsistent"
  | "page_location_rule_execution_failed"
  | "candidate_group_formation_failed";

export type BudgetPageLocationTechnicalProblemPhase =
  | "source_validation"
  | "direct_classification"
  | "structural_continuity"
  | "closing"
  | "remaining_classification"
  | "candidate_group_formation";

export interface BudgetPageLocationTechnicalProblem {
  readonly code: BudgetPageLocationTechnicalProblemCode;
  readonly phase: BudgetPageLocationTechnicalProblemPhase;
  readonly pageNumber: number | null;
  readonly signalId: BudgetDocumentSignalId | null;
  readonly ruleId: string | null;
  /** Mensagem controlada pelo domínio, nunca mensagem bruta ou stack trace. */
  readonly message: string;
}

export type BudgetPageLocationLimitationCode =
  | "only_8_of_23_signals_supported"
  | "service_item_identification_may_match_non_budget_lists"
  | "bdi_mention_may_be_explanatory"
  | "total_mention_may_be_non_budget"
  | "stable_geometry_does_not_prove_continuity"
  | "candidate_pages_are_provisional"
  | "no_table_reconstruction"
  | "no_column_identification"
  | "no_economic_interpretation"
  | "no_human_confirmation"
  | "no_positive_evidence_is_not_discard"
  | "fragmented_documents_may_produce_false_negatives";

export interface BudgetDocumentPageLocationResult {
  readonly schemaVersion: typeof BUDGET_DOCUMENT_PAGE_LOCATION_SCHEMA_VERSION;
  readonly locatorName: typeof BUDGET_DOCUMENT_PAGE_LOCATOR_NAME;
  readonly locatorVersion: typeof BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION;
  readonly decisionRuleSetVersion: typeof PAGE_LOCATION_DECISION_RULE_SET_VERSION;
  readonly sourceByteHash: string;
  readonly sourceObservationSchemaVersion: number | null;
  readonly sourceObserverName: string | null;
  readonly sourceObserverVersion: string | null;
  readonly sourceObservationRuleSetVersion: string | null;
  readonly sourceCatalogVersion: string | null;
  readonly sourceReadMetadata: DocumentSignalObservationSourceMetadata | null;
  readonly sourceObservationStatus: DocumentSignalObservationStatus | null;
  readonly sourceObservationTechnicalProblems: ReadonlyArray<DocumentSignalObservationTechnicalProblem>;
  readonly totalPageCount: number;
  readonly supportedSignalIds: ReadonlyArray<BudgetDocumentSignalId>;
  readonly unsupportedSignalIds: ReadonlyArray<BudgetDocumentSignalId>;
  readonly status: BudgetPageLocationStatus;
  readonly pageDecisions: ReadonlyArray<BudgetDocumentPageDecision>;
  readonly candidateGroups: ReadonlyArray<BudgetPageCandidateGroup>;
  readonly technicalProblems: ReadonlyArray<BudgetPageLocationTechnicalProblem>;
  readonly limitations: ReadonlyArray<BudgetPageLocationLimitationCode>;
}
