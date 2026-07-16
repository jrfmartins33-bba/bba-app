import type {
  BudgetDocumentPageDecision,
  BudgetPageCandidateGroup,
  BudgetPageCandidateGroupMember,
  BudgetPageLocationSatisfiedRule,
} from "./budget-page-location.types";
import {
  BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION,
  CANDIDATE_GROUP_FORMATION_RULE_ID,
  CANDIDATE_GROUP_FORMATION_RULE_VERSION,
  PAGE_LOCATION_DECISION_RULE_SET_VERSION,
} from "./budget-page-location.types";

function uniqueSupportingRules(decisions: ReadonlyArray<BudgetDocumentPageDecision>): ReadonlyArray<BudgetPageLocationSatisfiedRule> {
  const rules = new Map<string, BudgetPageLocationSatisfiedRule>();
  decisions.forEach((decision) => {
    decision.satisfiedRules.forEach((rule) => {
      rules.set(`${rule.ruleId}:${rule.ruleVersion}`, rule);
    });
  });
  return [...rules.values()].sort((left, right) => {
    const byId = left.ruleId.localeCompare(right.ruleId);
    return byId !== 0 ? byId : left.ruleVersion - right.ruleVersion;
  });
}

function toMember(decision: BudgetDocumentPageDecision): BudgetPageCandidateGroupMember {
  if (decision.candidateType === null) {
    throw new Error("A candidate decision must have a candidate type.");
  }
  return {
    pageNumber: decision.pageNumber,
    candidateType: decision.candidateType,
    primaryRuleId: decision.primaryRuleId,
    primaryRuleVersion: decision.primaryRuleVersion,
  };
}

function buildGroup(
  sourceByteHash: string,
  candidates: ReadonlyArray<BudgetDocumentPageDecision>,
  decisionsByPage: ReadonlyMap<number, BudgetDocumentPageDecision>,
): BudgetPageCandidateGroup {
  const startPageNumber = candidates[0].pageNumber;
  const endPageNumber = candidates[candidates.length - 1].pageNumber;
  const previous = decisionsByPage.get(startPageNumber - 1);
  const following = decisionsByPage.get(endPageNumber + 1);
  return {
    groupKey: [
      sourceByteHash,
      startPageNumber,
      endPageNumber,
      BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION,
      PAGE_LOCATION_DECISION_RULE_SET_VERSION,
    ].join(":"),
    sourceByteHash,
    startPageNumber,
    endPageNumber,
    pageNumbers: candidates.map((candidate) => candidate.pageNumber),
    members: candidates.map(toMember),
    supportingRules: uniqueSupportingRules(candidates),
    immediatelyPreviousContextPageNumber:
      previous?.classification === "documentary_context" ? previous.pageNumber : null,
    immediatelyFollowingContextPageNumber:
      following?.classification === "documentary_context" ? following.pageNumber : null,
    formationRuleId: CANDIDATE_GROUP_FORMATION_RULE_ID,
    formationRuleVersion: CANDIDATE_GROUP_FORMATION_RULE_VERSION,
    locatorVersion: BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION,
    decisionRuleSetVersion: PAGE_LOCATION_DECISION_RULE_SET_VERSION,
  };
}

export function formCandidateGroups(
  sourceByteHash: string,
  pageDecisions: ReadonlyArray<BudgetDocumentPageDecision>,
): ReadonlyArray<BudgetPageCandidateGroup> {
  const orderedDecisions = [...pageDecisions].sort((left, right) => left.pageNumber - right.pageNumber);
  const decisionsByPage = new Map(orderedDecisions.map((decision) => [decision.pageNumber, decision]));
  const candidates = orderedDecisions.filter((decision) => decision.classification === "candidate");
  if (candidates.length === 0) {
    return [];
  }

  const runs: BudgetDocumentPageDecision[][] = [];
  candidates.forEach((candidate) => {
    const currentRun = runs[runs.length - 1];
    if (currentRun === undefined || candidate.pageNumber !== currentRun[currentRun.length - 1].pageNumber + 1) {
      runs.push([candidate]);
      return;
    }
    currentRun.push(candidate);
  });

  return runs.map((run) => buildGroup(sourceByteHash, run, decisionsByPage));
}
