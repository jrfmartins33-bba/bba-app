import type { BudgetDocumentSignalId } from "../budget-document-signal-catalog.types";
import type { DocumentSignalObservationResult } from "../signal-observation/signal-observation.types";
import {
  BUDGET_DOCUMENT_PAGE_LOCATION_SCHEMA_VERSION,
  BUDGET_DOCUMENT_PAGE_LOCATOR_NAME,
  BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION,
  PAGE_LOCATION_DECISION_RULE_SET_VERSION,
} from "./budget-page-location.types";
import type {
  BudgetDocumentPageDecision,
  BudgetDocumentPageLocationResult,
  BudgetPageCandidateGroup,
  BudgetPageLocationLimitationCode,
  BudgetPageLocationStatus,
  BudgetPageLocationTechnicalProblem,
} from "./budget-page-location.types";
import { formCandidateGroups } from "./page-location-candidate-groups";
import { classifyRemainingPages, classifyTechnicalAndDirectPages } from "./page-location-classification";
import type { PageLocationWorkingPage } from "./page-location-classification";
import { validatePageLocationInput } from "./page-location-input-validation";
import {
  SUPPORTED_SOURCE_OBSERVATION_CONTRACTS,
  UNSUPPORTED_SOURCE_SIGNAL_CONTRACTS,
} from "./page-location-decision-rule-registry";
import { classifyClosingCandidates, propagateStructuralCandidates } from "./page-location-propagation";

const PAGE_LOCATION_LIMITATIONS: ReadonlyArray<BudgetPageLocationLimitationCode> = [
  "only_8_of_23_signals_supported",
  "service_item_identification_may_match_non_budget_lists",
  "bdi_mention_may_be_explanatory",
  "total_mention_may_be_non_budget",
  "stable_geometry_does_not_prove_continuity",
  "candidate_pages_are_provisional",
  "no_table_reconstruction",
  "no_column_identification",
  "no_economic_interpretation",
  "no_human_confirmation",
  "no_positive_evidence_is_not_discard",
  "fragmented_documents_may_produce_false_negatives",
] as const;

const SUPPORTED_SIGNAL_IDS: ReadonlyArray<BudgetDocumentSignalId> = SUPPORTED_SOURCE_OBSERVATION_CONTRACTS[0].signalRules.map(
  (entry) => entry.signalId,
);
const UNSUPPORTED_SIGNAL_IDS: ReadonlyArray<BudgetDocumentSignalId> = UNSUPPORTED_SOURCE_SIGNAL_CONTRACTS.map(
  (entry) => entry.signalId,
);

function result(
  source: DocumentSignalObservationResult,
  status: BudgetPageLocationStatus,
  pageDecisions: ReadonlyArray<BudgetDocumentPageDecision>,
  candidateGroups: ReadonlyArray<BudgetPageCandidateGroup>,
  technicalProblems: ReadonlyArray<BudgetPageLocationTechnicalProblem>,
): BudgetDocumentPageLocationResult {
  return {
    schemaVersion: BUDGET_DOCUMENT_PAGE_LOCATION_SCHEMA_VERSION,
    locatorName: BUDGET_DOCUMENT_PAGE_LOCATOR_NAME,
    locatorVersion: BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION,
    decisionRuleSetVersion: PAGE_LOCATION_DECISION_RULE_SET_VERSION,
    sourceByteHash: source.sourceByteHash,
    sourceObservationSchemaVersion: source.schemaVersion,
    sourceObserverName: source.observerName,
    sourceObserverVersion: source.observerVersion,
    sourceObservationRuleSetVersion: source.ruleSetVersion,
    sourceCatalogVersion: source.catalogVersion,
    sourceReadMetadata: source.sourceReadMetadata,
    sourceObservationStatus: source.status,
    sourceObservationTechnicalProblems: source.technicalProblems,
    totalPageCount: Number.isInteger(source.totalPageCount) && source.totalPageCount > 0 ? source.totalPageCount : 0,
    supportedSignalIds: SUPPORTED_SIGNAL_IDS,
    unsupportedSignalIds: UNSUPPORTED_SIGNAL_IDS,
    status,
    pageDecisions,
    candidateGroups,
    technicalProblems,
    limitations: PAGE_LOCATION_LIMITATIONS,
  };
}

function phaseFailure(
  phase: BudgetPageLocationTechnicalProblem["phase"],
  code: BudgetPageLocationTechnicalProblem["code"],
  message: string,
): BudgetPageLocationTechnicalProblem {
  return { code, phase, pageNumber: null, signalId: null, ruleId: null, message };
}

function decisionsFrom(pages: ReadonlyArray<PageLocationWorkingPage>): ReadonlyArray<BudgetDocumentPageDecision> {
  return pages.map((page) => {
    if (page.decision === null) {
      throw new Error(`Page ${page.pageNumber} has no final decision.`);
    }
    return page.decision;
  });
}

/**
 * Deterministic page location over an already produced observation contract.
 * It never reads bytes, paths, PDF objects, or page text.
 */
export function locateBudgetDocumentPages(source: DocumentSignalObservationResult): BudgetDocumentPageLocationResult {
  const validation = validatePageLocationInput(source);
  if (validation.kind !== "valid") {
    return result(source, "failed", [], [], validation.problems);
  }

  let pages: ReadonlyArray<PageLocationWorkingPage>;
  try {
    pages = classifyTechnicalAndDirectPages(source);
  } catch {
    return result(
      source,
      "failed",
      [],
      [],
      [phaseFailure("direct_classification", "page_location_rule_execution_failed", "Direct page classification failed.")],
    );
  }

  try {
    pages = propagateStructuralCandidates(source, pages);
  } catch {
    return result(
      source,
      "failed",
      [],
      [],
      [
        phaseFailure(
          "structural_continuity",
          "page_location_rule_execution_failed",
          "Structural continuity propagation failed.",
        ),
      ],
    );
  }

  try {
    pages = classifyClosingCandidates(source, pages);
  } catch {
    return result(
      source,
      "failed",
      [],
      [],
      [phaseFailure("closing", "page_location_rule_execution_failed", "Closing page classification failed.")],
    );
  }

  let pageDecisions: ReadonlyArray<BudgetDocumentPageDecision>;
  try {
    pages = classifyRemainingPages(source, pages);
    pageDecisions = decisionsFrom(pages);
  } catch {
    return result(
      source,
      "failed",
      [],
      [],
      [
        phaseFailure(
          "remaining_classification",
          "page_location_rule_execution_failed",
          "Remaining page classification failed.",
        ),
      ],
    );
  }

  try {
    const candidateGroups = formCandidateGroups(source.sourceByteHash, pageDecisions);
    const status =
      source.technicalProblems.length > 0 || source.sourceReadMetadata.sourceReadStatus === "completed_with_page_failures"
        ? "completed_with_problems"
        : "completed";
    return result(source, status, pageDecisions, candidateGroups, []);
  } catch {
    return result(
      source,
      "completed_with_problems",
      pageDecisions,
      [],
      [
        phaseFailure(
          "candidate_group_formation",
          "candidate_group_formation_failed",
          "Candidate group formation failed.",
        ),
      ],
    );
  }
}
