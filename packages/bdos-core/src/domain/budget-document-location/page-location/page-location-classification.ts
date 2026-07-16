import type { BudgetDocumentSignalId } from "../budget-document-signal-catalog.types";
import type {
  DocumentSignalObservationResult,
  DocumentSignalPageObservation,
  SignalEvaluation,
  SignalEvaluationOutcome,
} from "../signal-observation/signal-observation.types";
import type {
  BudgetDocumentPageDecision,
  BudgetPageLocationEvidenceFunction,
  BudgetPageLocationSignalReference,
  BudgetPageLocationSatisfiedRule,
} from "./budget-page-location.types";
import {
  BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION,
  PAGE_LOCATION_DECISION_RULE_SET_VERSION,
} from "./budget-page-location.types";
import {
  CONTENT_DECISION_SIGNAL_IDS,
  PAGE_LOCATION_SOURCE_SIGNAL_IDS,
  SUPPORTED_SOURCE_OBSERVATION_CONTRACTS,
  getPageLocationDecisionRule,
} from "./page-location-decision-rule-registry";
import type { ContentDecisionSignalId, PageLocationDecisionRule } from "./page-location-decision-rule-registry";

export interface PageLocationWorkingPage {
  readonly pageNumber: number;
  readonly sourcePage: DocumentSignalPageObservation;
  readonly evaluations: ReadonlyMap<BudgetDocumentSignalId, SignalEvaluation>;
  readonly decision: BudgetDocumentPageDecision | null;
}

type CompleteLocalResolution =
  | "candidate_item_and_bdi"
  | "candidate_item_and_total"
  | "documentary_context"
  | "ambiguous"
  | "no_positive_evidence";

function evaluationFor(page: PageLocationWorkingPage, signalId: BudgetDocumentSignalId): SignalEvaluation {
  const evaluation = page.evaluations.get(signalId);
  if (evaluation === undefined) {
    throw new Error(`Validated page ${page.pageNumber} is missing signal ${signalId}.`);
  }
  return evaluation;
}

export function isSignalObserved(page: PageLocationWorkingPage, signalId: BudgetDocumentSignalId): boolean {
  return evaluationFor(page, signalId).outcome === "observed";
}

export function isObserverRuleFailure(page: PageLocationWorkingPage, signalId: BudgetDocumentSignalId): boolean {
  return evaluationFor(page, signalId).notEvaluableReasonCode === "observer_rule_execution_failed";
}

export function listLimitingEvaluations(page: PageLocationWorkingPage): ReadonlyArray<SignalEvaluation> {
  const supportedIds = new Set(SUPPORTED_SOURCE_OBSERVATION_CONTRACTS[0].signalRules.map((entry) => entry.signalId));
  return page.sourcePage.signalEvaluations.filter(
    (evaluation) =>
      supportedIds.has(evaluation.signalId) &&
      evaluation.outcome === "not_evaluable" &&
      evaluation.notEvaluableReasonCode !== null,
  );
}

function signalReferences(
  evaluations: ReadonlyArray<SignalEvaluation>,
  functionInDecision: BudgetPageLocationEvidenceFunction,
): ReadonlyArray<BudgetPageLocationSignalReference> {
  return evaluations.map((sourceEvaluation) => ({
    signalId: sourceEvaluation.signalId,
    functionInDecision,
    sourceEvaluation,
  }));
}

function uniqueSatisfiedRules(rules: ReadonlyArray<PageLocationDecisionRule>): ReadonlyArray<BudgetPageLocationSatisfiedRule> {
  const seen = new Set<string>();
  return rules
    .filter((rule) => {
      const key = `${rule.ruleId}:${rule.ruleVersion}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((rule) => ({ ruleId: rule.ruleId, ruleVersion: rule.ruleVersion }));
}

export function createPageDecision(
  source: DocumentSignalObservationResult,
  page: PageLocationWorkingPage,
  primaryRule: PageLocationDecisionRule,
  satisfiedRules: ReadonlyArray<PageLocationDecisionRule>,
  supportingSignalIds: ReadonlyArray<BudgetDocumentSignalId>,
  functionInDecision: BudgetPageLocationEvidenceFunction,
  neighborPageNumbersUsed: ReadonlyArray<number> = [],
): BudgetDocumentPageDecision {
  const supportingEvaluations = supportingSignalIds.map((signalId) => evaluationFor(page, signalId));
  const limitingEvaluations = listLimitingEvaluations(page);
  return {
    pageNumber: page.pageNumber,
    classification: primaryRule.classification,
    candidateType: primaryRule.candidateType,
    primaryRuleId: primaryRule.ruleId,
    primaryRuleVersion: primaryRule.ruleVersion,
    satisfiedRules: uniqueSatisfiedRules(satisfiedRules),
    supportingSignals: signalReferences(supportingEvaluations, functionInDecision),
    limitingSignals: signalReferences(limitingEvaluations, "technical_limitation"),
    neighborPageNumbersUsed: [...new Set(neighborPageNumbersUsed)].sort((left, right) => left - right),
    decisionPhase: primaryRule.decisionPhase,
    decisionOrigin:
      primaryRule.decisionPhase === "technical_classification"
        ? "technical"
        : primaryRule.decisionPhase === "direct_classification"
          ? "direct"
          : primaryRule.decisionPhase === "structural_continuity"
            ? "propagated"
            : "derived",
    canAnchor: primaryRule.canAnchor,
    reasonCode: primaryRule.reasonCode,
    locatorVersion: BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION,
    decisionRuleSetVersion: PAGE_LOCATION_DECISION_RULE_SET_VERSION,
    sourceObserverVersion: source.observerVersion,
    sourceObservationRuleSetVersion: source.ruleSetVersion,
    sourceCatalogVersion: source.catalogVersion,
    sourceByteHash: source.sourceByteHash,
  };
}

function completeLocalResolution(outcomes: ReadonlyMap<ContentDecisionSignalId, "observed" | "not_observed">): CompleteLocalResolution {
  const observed = (signalId: ContentDecisionSignalId): boolean => outcomes.get(signalId) === "observed";
  if (observed(PAGE_LOCATION_SOURCE_SIGNAL_IDS.serviceItem) && observed(PAGE_LOCATION_SOURCE_SIGNAL_IDS.bdi)) {
    return "candidate_item_and_bdi";
  }
  if (observed(PAGE_LOCATION_SOURCE_SIGNAL_IDS.serviceItem) && observed(PAGE_LOCATION_SOURCE_SIGNAL_IDS.total)) {
    return "candidate_item_and_total";
  }
  if (
    observed(PAGE_LOCATION_SOURCE_SIGNAL_IDS.reference) &&
    !observed(PAGE_LOCATION_SOURCE_SIGNAL_IDS.serviceItem) &&
    !observed(PAGE_LOCATION_SOURCE_SIGNAL_IDS.bdi) &&
    !observed(PAGE_LOCATION_SOURCE_SIGNAL_IDS.total)
  ) {
    return "documentary_context";
  }
  if (CONTENT_DECISION_SIGNAL_IDS.some((signalId) => observed(signalId))) {
    return "ambiguous";
  }
  return "no_positive_evidence";
}

function enumerateFailureCompletions(
  known: ReadonlyMap<ContentDecisionSignalId, "observed" | "not_observed">,
  failedSignalIds: ReadonlyArray<ContentDecisionSignalId>,
  index: number,
  resolutions: Set<CompleteLocalResolution>,
): void {
  if (index >= failedSignalIds.length) {
    resolutions.add(completeLocalResolution(known));
    return;
  }

  const signalId = failedSignalIds[index];
  const observedCompletion = new Map(known);
  observedCompletion.set(signalId, "observed");
  enumerateFailureCompletions(observedCompletion, failedSignalIds, index + 1, resolutions);

  const notObservedCompletion = new Map(known);
  notObservedCompletion.set(signalId, "not_observed");
  enumerateFailureCompletions(notObservedCompletion, failedSignalIds, index + 1, resolutions);
}

/**
 * A content failure blocks only when at least two valid completions produce
 * different local decisions. Geometry is intentionally outside this model.
 */
export function determineWhetherContentFailuresBlockClassification(page: PageLocationWorkingPage): boolean {
  const known = new Map<ContentDecisionSignalId, "observed" | "not_observed">();
  const failedSignalIds: ContentDecisionSignalId[] = [];

  CONTENT_DECISION_SIGNAL_IDS.forEach((signalId) => {
    const evaluation = evaluationFor(page, signalId);
    if (evaluation.outcome === "observed" || evaluation.outcome === "not_observed") {
      known.set(signalId, evaluation.outcome);
    } else if (evaluation.notEvaluableReasonCode === "observer_rule_execution_failed") {
      failedSignalIds.push(signalId);
    }
  });

  if (failedSignalIds.length === 0) {
    return false;
  }

  const resolutions = new Set<CompleteLocalResolution>();
  enumerateFailureCompletions(known, failedSignalIds, 0, resolutions);
  return resolutions.size > 1;
}

function observedRulesForDirectCandidate(page: PageLocationWorkingPage): ReadonlyArray<PageLocationDecisionRule> {
  const itemAndBdi = getPageLocationDecisionRule("candidate-service-item-and-bdi-v1");
  const itemAndTotal = getPageLocationDecisionRule("candidate-service-item-and-total-v1");
  return [itemAndBdi, itemAndTotal].filter((rule) =>
    rule.requiredObservedSignalIds.every((signalId) => isSignalObserved(page, signalId)),
  );
}

function buildInitialWorkingPage(page: DocumentSignalPageObservation): PageLocationWorkingPage {
  return {
    pageNumber: page.pageNumber,
    sourcePage: page,
    evaluations: new Map(page.signalEvaluations.map((evaluation) => [evaluation.signalId, evaluation])),
    decision: null,
  };
}

export function classifyTechnicalAndDirectPages(
  source: DocumentSignalObservationResult,
): ReadonlyArray<PageLocationWorkingPage> {
  return source.pages.map((sourcePage) => {
    const page = buildInitialWorkingPage(sourcePage);
    if (isSignalObserved(page, PAGE_LOCATION_SOURCE_SIGNAL_IDS.noExtractableText)) {
      const rule = getPageLocationDecisionRule("not-evaluable-no-extractable-text-v1");
      return {
        ...page,
        decision: createPageDecision(source, page, rule, [rule], [PAGE_LOCATION_SOURCE_SIGNAL_IDS.noExtractableText], "technical_limitation"),
      };
    }
    if (isSignalObserved(page, PAGE_LOCATION_SOURCE_SIGNAL_IDS.extractionError)) {
      const rule = getPageLocationDecisionRule("not-evaluable-extraction-error-v1");
      return {
        ...page,
        decision: createPageDecision(source, page, rule, [rule], [PAGE_LOCATION_SOURCE_SIGNAL_IDS.extractionError], "technical_limitation"),
      };
    }

    const directRules = observedRulesForDirectCandidate(page);
    if (directRules.length > 0) {
      const primaryRule = directRules.reduce((selected, rule) => (rule.precedence < selected.precedence ? rule : selected));
      const supportingSignalIds = [
        ...new Set(directRules.flatMap((rule) => rule.requiredObservedSignalIds)),
      ];
      return {
        ...page,
        decision: createPageDecision(source, page, primaryRule, directRules, supportingSignalIds, "direct_support"),
      };
    }

    if (determineWhetherContentFailuresBlockClassification(page)) {
      const rule = getPageLocationDecisionRule("not-evaluable-content-rule-failure-v1");
      const failedSignals = CONTENT_DECISION_SIGNAL_IDS.filter((signalId) => isObserverRuleFailure(page, signalId));
      return {
        ...page,
        decision: createPageDecision(source, page, rule, [rule], failedSignals, "technical_limitation"),
      };
    }

    return page;
  });
}

export function classifyRemainingPages(
  source: DocumentSignalObservationResult,
  pages: ReadonlyArray<PageLocationWorkingPage>,
): ReadonlyArray<PageLocationWorkingPage> {
  return pages.map((page) => {
    if (page.decision !== null) {
      return page;
    }

    const contentOutcomes = new Map<ContentDecisionSignalId, SignalEvaluationOutcome>(
      CONTENT_DECISION_SIGNAL_IDS.map((signalId) => [signalId, evaluationFor(page, signalId).outcome]),
    );
    const observedContentSignalIds = CONTENT_DECISION_SIGNAL_IDS.filter(
      (signalId) => contentOutcomes.get(signalId) === "observed",
    );
    const isContext =
      contentOutcomes.get(PAGE_LOCATION_SOURCE_SIGNAL_IDS.reference) === "observed" &&
      [
        PAGE_LOCATION_SOURCE_SIGNAL_IDS.serviceItem,
        PAGE_LOCATION_SOURCE_SIGNAL_IDS.bdi,
        PAGE_LOCATION_SOURCE_SIGNAL_IDS.total,
      ].every((signalId) => contentOutcomes.get(signalId) === "not_observed");

    if (isContext) {
      const rule = getPageLocationDecisionRule("documentary-context-budget-reference-v1");
      return {
        ...page,
        decision: createPageDecision(
          source,
          page,
          rule,
          [rule],
          CONTENT_DECISION_SIGNAL_IDS,
          "context_support",
        ),
      };
    }

    if (observedContentSignalIds.length > 0) {
      const rule = getPageLocationDecisionRule("ambiguous-positive-content-evidence-v1");
      const ambiguitySignals = rule.requiredAnyObservedSignalIds.filter((signalId) =>
        observedContentSignalIds.includes(signalId as ContentDecisionSignalId),
      );
      return {
        ...page,
        decision: createPageDecision(source, page, rule, [rule], ambiguitySignals, "ambiguity_support"),
      };
    }

    const rule = getPageLocationDecisionRule("no-positive-content-evidence-v1");
    return {
      ...page,
      decision: createPageDecision(source, page, rule, [rule], CONTENT_DECISION_SIGNAL_IDS, "absence_support"),
    };
  });
}
