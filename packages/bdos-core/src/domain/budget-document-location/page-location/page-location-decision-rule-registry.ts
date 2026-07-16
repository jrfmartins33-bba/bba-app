import type { BudgetDocumentSignalId } from "../budget-document-signal-catalog.types";
import type { SignalNotEvaluableReasonCode } from "../signal-observation/signal-observation.types";
import type {
  BudgetDocumentPageClassification,
  BudgetPageCandidateType,
  BudgetPageLocationDecisionPhase,
  BudgetPageLocationReasonCode,
} from "./budget-page-location.types";

export const CONTENT_DECISION_SIGNAL_IDS = [
  "referential-budget-spreadsheet-mention",
  "structural-service-item-identification",
  "structural-bdi-documentary-mention",
  "closure-general-total-mention",
] as const satisfies ReadonlyArray<BudgetDocumentSignalId>;

export type ContentDecisionSignalId = (typeof CONTENT_DECISION_SIGNAL_IDS)[number];

export const PAGE_LOCATION_SOURCE_SIGNAL_IDS = {
  reference: "referential-budget-spreadsheet-mention",
  serviceItem: "structural-service-item-identification",
  bdi: "structural-bdi-documentary-mention",
  total: "closure-general-total-mention",
  stableGeometry: "continuity-stable-geometry",
  textAvailable: "extraction-text-available",
  noExtractableText: "extraction-no-extractable-text",
  extractionError: "extraction-error",
} as const satisfies Readonly<Record<string, BudgetDocumentSignalId>>;

export interface PageLocationSourceObservationRuleContract {
  readonly signalId: BudgetDocumentSignalId;
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly evidenceKind: "text" | "geometry" | "extraction_field";
}

export interface SupportedSourceObservationContract {
  readonly schemaVersion: number;
  readonly observerName: string;
  readonly observerVersion: string;
  readonly observationRuleSetVersion: string;
  readonly catalogVersion: string;
  readonly signalRules: ReadonlyArray<PageLocationSourceObservationRuleContract>;
}

/** Exact source contracts approved for this locator version. */
export const SUPPORTED_SOURCE_OBSERVATION_CONTRACTS: ReadonlyArray<SupportedSourceObservationContract> = [
  {
    schemaVersion: 1,
    observerName: "document-signal-observer",
    observerVersion: "document-signal-observer-v1",
    observationRuleSetVersion: "document-signal-observation-rules-v1",
    catalogVersion: "budget-document-signal-catalog-v1",
    signalRules: [
      {
        signalId: PAGE_LOCATION_SOURCE_SIGNAL_IDS.reference,
        ruleId: "referential-budget-spreadsheet-mention-literal-phrase-v1",
        ruleVersion: 1,
        evidenceKind: "text",
      },
      {
        signalId: PAGE_LOCATION_SOURCE_SIGNAL_IDS.serviceItem,
        ruleId: "structural-service-item-identification-line-start-pattern-v1",
        ruleVersion: 1,
        evidenceKind: "text",
      },
      {
        signalId: PAGE_LOCATION_SOURCE_SIGNAL_IDS.bdi,
        ruleId: "structural-bdi-documentary-mention-token-boundary-v2",
        ruleVersion: 2,
        evidenceKind: "text",
      },
      {
        signalId: PAGE_LOCATION_SOURCE_SIGNAL_IDS.total,
        ruleId: "closure-general-total-mention-adjacent-numeric-token-v3",
        ruleVersion: 3,
        evidenceKind: "text",
      },
      {
        signalId: PAGE_LOCATION_SOURCE_SIGNAL_IDS.textAvailable,
        ruleId: "extraction-text-available-field-v1",
        ruleVersion: 1,
        evidenceKind: "extraction_field",
      },
      {
        signalId: PAGE_LOCATION_SOURCE_SIGNAL_IDS.noExtractableText,
        ruleId: "extraction-no-extractable-text-field-v1",
        ruleVersion: 1,
        evidenceKind: "extraction_field",
      },
      {
        signalId: PAGE_LOCATION_SOURCE_SIGNAL_IDS.extractionError,
        ruleId: "extraction-error-field-v1",
        ruleVersion: 1,
        evidenceKind: "extraction_field",
      },
      {
        signalId: PAGE_LOCATION_SOURCE_SIGNAL_IDS.stableGeometry,
        ruleId: "continuity-stable-geometry-adjacent-match-v1",
        ruleVersion: 1,
        evidenceKind: "geometry",
      },
    ],
  },
] as const;

export interface PageLocationDecisionRule {
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly classification: BudgetDocumentPageClassification;
  readonly candidateType: BudgetPageCandidateType | null;
  readonly decisionPhase: BudgetPageLocationDecisionPhase;
  readonly reasonCode: BudgetPageLocationReasonCode;
  readonly requiredObservedSignalIds: ReadonlyArray<BudgetDocumentSignalId>;
  readonly requiredAnyObservedSignalIds: ReadonlyArray<BudgetDocumentSignalId>;
  readonly requiredNotObservedSignalIds: ReadonlyArray<BudgetDocumentSignalId>;
  readonly dependsOnNeighborCandidate: boolean;
  readonly canAnchor: boolean;
  readonly precedence: number;
}

export const PAGE_LOCATION_DECISION_RULE_REGISTRY: ReadonlyArray<PageLocationDecisionRule> = [
  {
    ruleId: "not-evaluable-no-extractable-text-v1",
    ruleVersion: 1,
    classification: "not_evaluable",
    candidateType: null,
    decisionPhase: "technical_classification",
    reasonCode: "not_evaluable_no_extractable_text",
    requiredObservedSignalIds: [PAGE_LOCATION_SOURCE_SIGNAL_IDS.noExtractableText],
    requiredAnyObservedSignalIds: [],
    requiredNotObservedSignalIds: [],
    dependsOnNeighborCandidate: false,
    canAnchor: false,
    precedence: 10,
  },
  {
    ruleId: "not-evaluable-extraction-error-v1",
    ruleVersion: 1,
    classification: "not_evaluable",
    candidateType: null,
    decisionPhase: "technical_classification",
    reasonCode: "not_evaluable_extraction_error",
    requiredObservedSignalIds: [PAGE_LOCATION_SOURCE_SIGNAL_IDS.extractionError],
    requiredAnyObservedSignalIds: [],
    requiredNotObservedSignalIds: [],
    dependsOnNeighborCandidate: false,
    canAnchor: false,
    precedence: 11,
  },
  {
    ruleId: "candidate-service-item-and-bdi-v1",
    ruleVersion: 1,
    classification: "candidate",
    candidateType: "direct",
    decisionPhase: "direct_classification",
    reasonCode: "candidate_service_item_and_bdi",
    requiredObservedSignalIds: [PAGE_LOCATION_SOURCE_SIGNAL_IDS.serviceItem, PAGE_LOCATION_SOURCE_SIGNAL_IDS.bdi],
    requiredAnyObservedSignalIds: [],
    requiredNotObservedSignalIds: [],
    dependsOnNeighborCandidate: false,
    canAnchor: true,
    precedence: 20,
  },
  {
    ruleId: "candidate-service-item-and-total-v1",
    ruleVersion: 1,
    classification: "candidate",
    candidateType: "direct",
    decisionPhase: "direct_classification",
    reasonCode: "candidate_service_item_and_total",
    requiredObservedSignalIds: [PAGE_LOCATION_SOURCE_SIGNAL_IDS.serviceItem, PAGE_LOCATION_SOURCE_SIGNAL_IDS.total],
    requiredAnyObservedSignalIds: [],
    requiredNotObservedSignalIds: [],
    dependsOnNeighborCandidate: false,
    canAnchor: false,
    precedence: 21,
  },
  {
    ruleId: "not-evaluable-content-rule-failure-v1",
    ruleVersion: 1,
    classification: "not_evaluable",
    candidateType: null,
    decisionPhase: "technical_classification",
    reasonCode: "not_evaluable_content_rule_failure",
    requiredObservedSignalIds: [],
    requiredAnyObservedSignalIds: [],
    requiredNotObservedSignalIds: [],
    dependsOnNeighborCandidate: false,
    canAnchor: false,
    precedence: 30,
  },
  {
    ruleId: "candidate-service-item-by-continuity-v1",
    ruleVersion: 1,
    classification: "candidate",
    candidateType: "structural_continuity",
    decisionPhase: "structural_continuity",
    reasonCode: "candidate_service_item_by_continuity",
    requiredObservedSignalIds: [PAGE_LOCATION_SOURCE_SIGNAL_IDS.serviceItem, PAGE_LOCATION_SOURCE_SIGNAL_IDS.stableGeometry],
    requiredAnyObservedSignalIds: [],
    requiredNotObservedSignalIds: [],
    dependsOnNeighborCandidate: true,
    canAnchor: true,
    precedence: 40,
  },
  {
    ruleId: "candidate-closing-page-by-continuity-v1",
    ruleVersion: 1,
    classification: "candidate",
    candidateType: "closing",
    decisionPhase: "closing",
    reasonCode: "candidate_closing_page_by_continuity",
    requiredObservedSignalIds: [PAGE_LOCATION_SOURCE_SIGNAL_IDS.total, PAGE_LOCATION_SOURCE_SIGNAL_IDS.stableGeometry],
    requiredAnyObservedSignalIds: [],
    requiredNotObservedSignalIds: [],
    dependsOnNeighborCandidate: true,
    canAnchor: false,
    precedence: 50,
  },
  {
    ruleId: "documentary-context-budget-reference-v1",
    ruleVersion: 1,
    classification: "documentary_context",
    candidateType: null,
    decisionPhase: "remaining_classification",
    reasonCode: "documentary_context_budget_reference",
    requiredObservedSignalIds: [PAGE_LOCATION_SOURCE_SIGNAL_IDS.reference],
    requiredAnyObservedSignalIds: [],
    requiredNotObservedSignalIds: [
      PAGE_LOCATION_SOURCE_SIGNAL_IDS.serviceItem,
      PAGE_LOCATION_SOURCE_SIGNAL_IDS.bdi,
      PAGE_LOCATION_SOURCE_SIGNAL_IDS.total,
    ],
    dependsOnNeighborCandidate: false,
    canAnchor: false,
    precedence: 60,
  },
  {
    ruleId: "ambiguous-positive-content-evidence-v1",
    ruleVersion: 1,
    classification: "ambiguous",
    candidateType: null,
    decisionPhase: "remaining_classification",
    reasonCode: "ambiguous_positive_content_evidence",
    requiredObservedSignalIds: [],
    requiredAnyObservedSignalIds: CONTENT_DECISION_SIGNAL_IDS,
    requiredNotObservedSignalIds: [],
    dependsOnNeighborCandidate: false,
    canAnchor: false,
    precedence: 70,
  },
  {
    ruleId: "no-positive-content-evidence-v1",
    ruleVersion: 1,
    classification: "no_positive_evidence",
    candidateType: null,
    decisionPhase: "remaining_classification",
    reasonCode: "no_positive_content_evidence",
    requiredObservedSignalIds: [],
    requiredAnyObservedSignalIds: [],
    requiredNotObservedSignalIds: CONTENT_DECISION_SIGNAL_IDS,
    dependsOnNeighborCandidate: false,
    canAnchor: false,
    precedence: 80,
  },
] as const;

export interface UnsupportedSignalContract {
  readonly signalId: BudgetDocumentSignalId;
  readonly reasonCode: SignalNotEvaluableReasonCode;
  readonly dimension: "quality" | "composition" | null;
}

export const UNSUPPORTED_SOURCE_SIGNAL_CONTRACTS: ReadonlyArray<UnsupportedSignalContract> = [
  { signalId: "referential-annex-listing", reasonCode: "unsupported_missing_list_structure_capability", dimension: null },
  { signalId: "structural-unit-quantity-price-block", reasonCode: "unsupported_missing_row_reconstruction_capability", dimension: null },
  { signalId: "structural-total-value-column", reasonCode: "unsupported_missing_row_reconstruction_capability", dimension: null },
  { signalId: "structural-tabular-row-repetition", reasonCode: "unsupported_missing_row_reconstruction_capability", dimension: null },
  { signalId: "continuity-repeated-header", reasonCode: "unsupported_missing_row_reconstruction_capability", dimension: null },
  { signalId: "continuity-repeated-row-pattern", reasonCode: "unsupported_missing_row_reconstruction_capability", dimension: null },
  { signalId: "closure-density-drop", reasonCode: "unsupported_missing_row_reconstruction_capability", dimension: null },
  { signalId: "closure-structural-break", reasonCode: "unsupported_missing_row_reconstruction_capability", dimension: null },
  { signalId: "extraction-acceptable-quality", reasonCode: "unsupported_missing_evaluation_profile", dimension: "quality" },
  { signalId: "extraction-degraded-quality", reasonCode: "unsupported_missing_evaluation_profile", dimension: "quality" },
  { signalId: "extraction-indeterminate-quality", reasonCode: "unsupported_missing_evaluation_profile", dimension: "quality" },
  { signalId: "extraction-composition-predominantly-textual", reasonCode: "unsupported_missing_evaluation_profile", dimension: "composition" },
  { signalId: "extraction-composition-mixed", reasonCode: "unsupported_missing_evaluation_profile", dimension: "composition" },
  { signalId: "extraction-composition-graphic-or-image", reasonCode: "unsupported_missing_evaluation_profile", dimension: "composition" },
  { signalId: "extraction-composition-not-determinable", reasonCode: "unsupported_missing_evaluation_profile", dimension: "composition" },
] as const;

export function getPageLocationDecisionRule(ruleId: string): PageLocationDecisionRule {
  const rule = PAGE_LOCATION_DECISION_RULE_REGISTRY.find((entry) => entry.ruleId === ruleId);
  if (rule === undefined) {
    throw new Error(`Unknown page-location decision rule: ${ruleId}`);
  }
  return rule;
}
