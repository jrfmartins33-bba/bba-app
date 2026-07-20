import type { BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult } from "../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import type {
  BudgetDocumentPageBoundaryNeutralContinuityEvaluationInput,
  BudgetDocumentPageBoundaryNeutralContinuityEvaluationResult,
  PageBoundaryNeutralContinuityEvaluation,
  PageBoundaryNeutralContinuityEvaluationGlobalStatus,
  PageBoundaryNeutralContinuityTechnicalProblem,
} from "./budget-document-page-boundary-neutral-continuity-evaluation.types";
import {
  BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_ENGINE_NAME,
  BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_ENGINE_VERSION,
  BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_SCHEMA_VERSION,
  PAGE_BOUNDARY_CONSECUTIVE_PAIR_POPULATION_RULE_ID,
  PAGE_BOUNDARY_CONSECUTIVE_PAIR_POPULATION_RULE_VERSION,
  PAGE_BOUNDARY_CONTINUITY_CLASSIFICATION_RULE_ID,
  PAGE_BOUNDARY_CONTINUITY_CLASSIFICATION_RULE_VERSION,
  PAGE_BOUNDARY_CONTINUITY_SIGNAL_EVALUATION_RULE_ID,
  PAGE_BOUNDARY_CONTINUITY_SIGNAL_EVALUATION_RULE_VERSION,
  PAGE_BOUNDARY_EXTREMAL_SELECTION_RULE_ID,
  PAGE_BOUNDARY_EXTREMAL_SELECTION_RULE_VERSION,
  PAGE_BOUNDARY_NEUTRAL_CONTINUITY_CANONICAL_SERIALIZATION_VERSION,
  PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_IDENTITY_FINGERPRINT_VERSION,
  PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_RESULT_FINGERPRINT_VERSION,
} from "./budget-document-page-boundary-neutral-continuity-evaluation.types";
import { validatePageBoundaryNeutralContinuityEvaluationInput, computeExpectedBoundaryPopulation } from "./page-boundary-neutral-continuity-evaluation-input-validation";
import { evaluateBoundaryPair } from "./page-boundary-neutral-continuity-evaluation-pair-evaluator";
import { deriveGlobalStatus } from "./page-boundary-neutral-continuity-evaluation-classifiers";
import { computeGlobalMetrics } from "./page-boundary-neutral-continuity-evaluation-metrics";
import { validateEvaluationConservation, validateMetricConservation } from "./page-boundary-neutral-continuity-evaluation-conservation";
import { computeIdentityFingerprint } from "./page-boundary-neutral-continuity-evaluation-context-fingerprint";
import { computeResultFingerprint } from "./page-boundary-neutral-continuity-evaluation-result-fingerprint";
import { LIMITATIONS, PROFILE } from "./page-boundary-neutral-continuity-evaluation-profile";
import { problem } from "./page-boundary-neutral-continuity-evaluation-technical-problem";

export interface PageBoundaryNeutralContinuityEvaluationDependencies {
  readonly beforeGlobalProcessing: () => void;
  readonly evaluateBoundaryPair: typeof evaluateBoundaryPair;
}

const DEFAULT_DEPENDENCIES: PageBoundaryNeutralContinuityEvaluationDependencies = {
  beforeGlobalProcessing: () => undefined,
  evaluateBoundaryPair,
};

/** Internal test seam. Never exported by the public barrel. */
export function getDefaultPageBoundaryNeutralContinuityEvaluationDependencies(): PageBoundaryNeutralContinuityEvaluationDependencies {
  return DEFAULT_DEPENDENCIES;
}

function buildResult(
  source: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult,
  evaluations: ReadonlyArray<PageBoundaryNeutralContinuityEvaluation>,
  technicalProblems: ReadonlyArray<PageBoundaryNeutralContinuityTechnicalProblem>,
  status: PageBoundaryNeutralContinuityEvaluationGlobalStatus,
  receivedGroupCount: number,
  incoherentGroupCount: number,
  receivedPageCount: number,
): BudgetDocumentPageBoundaryNeutralContinuityEvaluationResult {
  const identityFingerprint = computeIdentityFingerprint(source);
  const metrics = computeGlobalMetrics(receivedGroupCount, incoherentGroupCount, receivedPageCount, evaluations, technicalProblems);
  return {
    schemaVersion: BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_SCHEMA_VERSION,
    evaluationEngineName: BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_ENGINE_NAME,
    evaluationEngineVersion: BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_ENGINE_VERSION,
    evaluationProfileId: PROFILE.profileId,
    evaluationProfileVersion: PROFILE.profileVersion,
    populationRuleId: PAGE_BOUNDARY_CONSECUTIVE_PAIR_POPULATION_RULE_ID,
    populationRuleVersion: PAGE_BOUNDARY_CONSECUTIVE_PAIR_POPULATION_RULE_VERSION,
    boundarySelectionRuleId: PAGE_BOUNDARY_EXTREMAL_SELECTION_RULE_ID,
    boundarySelectionRuleVersion: PAGE_BOUNDARY_EXTREMAL_SELECTION_RULE_VERSION,
    signalEvaluationRuleId: PAGE_BOUNDARY_CONTINUITY_SIGNAL_EVALUATION_RULE_ID,
    signalEvaluationRuleVersion: PAGE_BOUNDARY_CONTINUITY_SIGNAL_EVALUATION_RULE_VERSION,
    classificationRuleId: PAGE_BOUNDARY_CONTINUITY_CLASSIFICATION_RULE_ID,
    classificationRuleVersion: PAGE_BOUNDARY_CONTINUITY_CLASSIFICATION_RULE_VERSION,
    canonicalSerializationVersion: PAGE_BOUNDARY_NEUTRAL_CONTINUITY_CANONICAL_SERIALIZATION_VERSION,
    identityFingerprintVersion: PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_IDENTITY_FINGERPRINT_VERSION,
    identityFingerprint,
    resultFingerprintVersion: PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_RESULT_FINGERPRINT_VERSION,
    resultFingerprint: computeResultFingerprint(identityFingerprint, { status, evaluations, technicalProblems, metrics, limitations: LIMITATIONS }),
    sourceByteHash: source.sourceByteHash,
    sourcePageLocalNeutralStructuredEvidenceFormationSchemaVersion: source.schemaVersion,
    sourcePageLocalNeutralStructuredEvidenceFormationEngineName: source.formationEngineName,
    sourcePageLocalNeutralStructuredEvidenceFormationEngineVersion: source.formationEngineVersion,
    sourcePageLocalNeutralStructuredEvidenceFormationProfileId: source.formationProfileId,
    sourcePageLocalNeutralStructuredEvidenceFormationProfileVersion: source.formationProfileVersion,
    sourcePageLocalNeutralStructuredEvidenceFormationIdentityFingerprintVersion: source.identityFingerprintVersion,
    sourcePageLocalNeutralStructuredEvidenceFormationIdentityFingerprint: source.identityFingerprint,
    sourcePageLocalNeutralStructuredEvidenceFormationResultFingerprintVersion: source.resultFingerprintVersion,
    sourcePageLocalNeutralStructuredEvidenceFormationResultFingerprint: source.resultFingerprint,
    sourcePageLocalNeutralStructuredEvidenceFormationStatus: source.status,
    status, evaluations, technicalProblems, metrics, limitations: LIMITATIONS,
  };
}

export function evaluateBudgetDocumentPageBoundaryNeutralContinuity(input: BudgetDocumentPageBoundaryNeutralContinuityEvaluationInput): BudgetDocumentPageBoundaryNeutralContinuityEvaluationResult {
  return evaluateBudgetDocumentPageBoundaryNeutralContinuityWithDependencies(input, DEFAULT_DEPENDENCIES);
}

export function evaluateBudgetDocumentPageBoundaryNeutralContinuityWithDependencies(
  input: BudgetDocumentPageBoundaryNeutralContinuityEvaluationInput,
  dependencies: PageBoundaryNeutralContinuityEvaluationDependencies,
): BudgetDocumentPageBoundaryNeutralContinuityEvaluationResult {
  const source = input.pageLocalNeutralStructuredEvidence;
  try {
    dependencies.beforeGlobalProcessing();
    const validation = validatePageBoundaryNeutralContinuityEvaluationInput(input);
    if (validation.kind === "invalid") return buildResult(source, [], validation.problems, "failed", 0, 0, 0);

    const groups = validation.groups;
    const population = computeExpectedBoundaryPopulation(groups);
    const populationProblems: PageBoundaryNeutralContinuityTechnicalProblem[] = population.incoherentGroups.map((incoherent) =>
      problem(incoherent.code, "population_formation", { sourceCandidateGroupKey: incoherent.sourceCandidateGroupKey }));

    const evaluations = [...population.pairs]
      .map((pair) => dependencies.evaluateBoundaryPair(pair.sourceCandidateGroupKey, pair.originPage, pair.targetPage))
      .sort((a, b) => a.sourceCandidateGroupKey.localeCompare(b.sourceCandidateGroupKey) || a.originPageNumber - b.originPageNumber || a.targetPageNumber - b.targetPageNumber);

    const receivedGroupCount = groups.length;
    const incoherentGroupCount = population.incoherentGroups.length;
    const receivedPageCount = groups.reduce((total, group) => total + group.pages.length, 0);

    const conservationFailure = validateEvaluationConservation(evaluations, groups);
    const problemsAfterConservation = conservationFailure
      ? [...populationProblems, problem(conservationFailure, "conservation_validation")]
      : populationProblems;

    const provisionalMetrics = computeGlobalMetrics(receivedGroupCount, incoherentGroupCount, receivedPageCount, evaluations, problemsAfterConservation);
    const metricConservationOk = validateMetricConservation(evaluations, problemsAfterConservation, receivedGroupCount, incoherentGroupCount, receivedPageCount, provisionalMetrics);
    const finalProblems = metricConservationOk ? problemsAfterConservation : [...problemsAfterConservation, problem("metric_conservation_failed", "conservation_validation")];

    const status = deriveGlobalStatus(incoherentGroupCount, evaluations, finalProblems.length);
    return buildResult(source, evaluations, finalProblems, status, receivedGroupCount, incoherentGroupCount, receivedPageCount);
  } catch {
    return buildResult(source, [], [problem("page_boundary_continuity_unexpected_failure", "population_formation")], "failed", 0, 0, 0);
  }
}
