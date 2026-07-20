import type {
  BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput,
  BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult,
  NeutralDocumentGroup,
  NeutralDocumentPage,
  NeutralDocumentRegion,
  PageLocalNeutralStructuredEvidenceFormationTechnicalProblem,
} from "./budget-document-page-local-neutral-structured-evidence-formation.types";
import {
  BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_NAME,
  BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_VERSION,
  BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_SCHEMA_VERSION,
  NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_ID,
  NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_VERSION,
  NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_ID,
  NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_VERSION,
  PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_CANONICAL_SERIALIZATION_VERSION,
  PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_IDENTITY_FINGERPRINT_VERSION,
  PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_RESULT_FINGERPRINT_VERSION,
} from "./budget-document-page-local-neutral-structured-evidence-formation.types";
import type { ValidatedGroupSources, ValidatedPageSources, ValidatedRegionSources } from "./page-local-neutral-structured-evidence-formation-input-validation";
import { validatePageLocalNeutralStructuredEvidenceFormationInput } from "./page-local-neutral-structured-evidence-formation-input-validation";
import { computeIdentityFingerprint } from "./page-local-neutral-structured-evidence-formation-context-fingerprint";
import { computeResultFingerprint } from "./page-local-neutral-structured-evidence-formation-result-fingerprint";
import { LIMITATIONS, PROFILE } from "./page-local-neutral-structured-evidence-formation-profile";
import { problem } from "./page-local-neutral-structured-evidence-formation-technical-problem";
import { deriveGlobalStatus, deriveGroupStatus, derivePageStatus, deriveRegionStatus } from "./page-local-neutral-structured-evidence-formation-classifiers";
import { computeGlobalMetrics, computeGroupMetrics, computePageMetrics, computeRegionMetrics } from "./page-local-neutral-structured-evidence-formation-metrics";
import { validateGlobalMetricConservation, validateGroupMetricConservation, validatePageMetricConservation, validateRegionConservation, validateRegionMetricConservation } from "./page-local-neutral-structured-evidence-formation-conservation";
import { formNeutralDocumentRegion } from "./form-neutral-document-region";

const CONSERVATION_FAILURE_CODE = {
  region_conservation_failed: "region_conservation_failed",
  line_conservation_failed: "line_conservation_failed",
  segment_conservation_failed: "segment_conservation_failed",
  position_conservation_failed: "position_conservation_failed",
  cell_conservation_failed: "cell_conservation_failed",
  text_evidence_conservation_failed: "text_evidence_conservation_failed",
  fragment_conservation_failed: "fragment_conservation_failed",
} as const;

export interface PageLocalNeutralStructuredEvidenceFormationDependencies {
  readonly beforeGlobalProcessing: () => void;
  readonly formNeutralDocumentRegion: typeof formNeutralDocumentRegion;
  readonly validateRegionConservation: typeof validateRegionConservation;
}

const DEFAULT_DEPENDENCIES: PageLocalNeutralStructuredEvidenceFormationDependencies = {
  beforeGlobalProcessing: () => undefined,
  formNeutralDocumentRegion,
  validateRegionConservation,
};

/** Internal test seam. Never exported by the public barrel (§33). */
export function getDefaultPageLocalNeutralStructuredEvidenceFormationDependencies(): PageLocalNeutralStructuredEvidenceFormationDependencies {
  return DEFAULT_DEPENDENCIES;
}

function failedRegionShell(source: ValidatedRegionSources, groupKey: string): NeutralDocumentRegion {
  const problems = [problem("neutral_region_formation_failed", "candidate_region_processing", { groupKey, pageNumber: source.regionCandidate.pageNumber, regionKey: source.regionCandidate.regionKey })];
  return {
    sourceRegionKey: source.regionCandidate.regionKey,
    pageNumber: source.regionCandidate.pageNumber,
    order: source.regionCandidate.order,
    status: "failed",
    sourceRegionCandidate: source.regionCandidate,
    sourcePhysicalCellHypothesisFormationRegionStatus: source.cellFormationRegion ? source.cellFormationRegion.status : null,
    sourcePhysicalCellTextEvidenceFormationRegionStatus: source.textEvidenceRegion ? source.textEvidenceRegion.status : null,
    documentLines: [],
    technicalProblems: problems,
    metrics: computeRegionMetrics(source.regionCandidate, source.cellFormationRegion, source.textEvidenceRegion, [], problems),
  };
}

function processRegion(
  source: ValidatedRegionSources,
  groupKey: string,
  structureLineByKey: ReadonlyMap<string, import("../structure-reconstruction/budget-document-structure-reconstruction.types").ReconstructedPhysicalLine>,
  structureSegmentByKey: ReadonlyMap<string, import("../structure-reconstruction/budget-document-structure-reconstruction.types").ReconstructedHorizontalSegment>,
  dependencies: PageLocalNeutralStructuredEvidenceFormationDependencies,
): NeutralDocumentRegion {
  let built: NeutralDocumentRegion;
  try {
    built = dependencies.formNeutralDocumentRegion(source.regionCandidate, source.cellFormationRegion, source.textEvidenceRegion, structureLineByKey, structureSegmentByKey, { groupKey });
  } catch {
    return failedRegionShell(source, groupKey);
  }

  const problems: PageLocalNeutralStructuredEvidenceFormationTechnicalProblem[] = [];
  let structuralFailure: ReturnType<typeof validateRegionConservation>;
  try {
    structuralFailure = dependencies.validateRegionConservation(built, source.regionCandidate, source.cellFormationRegion, source.textEvidenceRegion);
  } catch {
    structuralFailure = "region_conservation_failed";
  }
  if (structuralFailure) problems.push(problem(CONSERVATION_FAILURE_CODE[structuralFailure], "conservation_validation", { groupKey, pageNumber: source.regionCandidate.pageNumber, regionKey: source.regionCandidate.regionKey }));
  else if (!validateRegionMetricConservation(built, source.regionCandidate, source.cellFormationRegion, source.textEvidenceRegion)) {
    problems.push(problem("metric_conservation_failed", "conservation_validation", { groupKey, pageNumber: source.regionCandidate.pageNumber, regionKey: source.regionCandidate.regionKey }));
  }

  if (problems.length === 0) return built;

  const metrics = computeRegionMetrics(source.regionCandidate, source.cellFormationRegion, source.textEvidenceRegion, built.documentLines, problems);
  const ambiguousPositionCount = metrics.ambiguousPartialIntersectionPositionCount + metrics.ambiguousMultipleIntersectionsPositionCount + metrics.ambiguousContentOutsideGridBoundsPositionCount;
  const upstreamNotProcessable = source.cellFormationRegion === null || source.cellFormationRegion.status === "region_not_processable";
  const withoutPhysicalGrid = source.cellFormationRegion !== null && source.cellFormationRegion.status === "no_physical_grid";
  const status = deriveRegionStatus({ upstreamNotProcessable, withoutPhysicalGrid, documentCellCount: metrics.documentCellCount, ambiguousPositionCount, technicalProblemCount: metrics.technicalProblemCount, formationFailed: false });
  return { ...built, status, technicalProblems: [...built.technicalProblems, ...problems], metrics };
}

function processPage(source: ValidatedPageSources, groupKey: string, dependencies: PageLocalNeutralStructuredEvidenceFormationDependencies): NeutralDocumentPage {
  const regions = [...source.regions]
    .sort((a, b) => a.regionCandidate.order - b.regionCandidate.order || a.regionCandidate.regionKey.localeCompare(b.regionCandidate.regionKey))
    .map((regionSource) => processRegion(regionSource, groupKey, source.structureLineByKey, source.structureSegmentByKey, dependencies));

  const base = {
    pageNumber: source.pageNumber,
    sourceTabularRegionDetectionPageStatus: source.candidatePage.status,
    sourcePhysicalCellHypothesisFormationPageStatus: source.cellFormationPage ? source.cellFormationPage.status : null,
    sourcePhysicalCellTextEvidenceFormationPageStatus: source.textEvidencePage ? source.textEvidencePage.status : null,
    regions,
  };
  const page0: NeutralDocumentPage = { ...base, status: derivePageStatus(regions, false), technicalProblems: [], metrics: computePageMetrics(regions, []) };
  if (validatePageMetricConservation(page0)) return page0;
  const problems = [problem("metric_conservation_failed", "conservation_validation", { groupKey, pageNumber: source.pageNumber })];
  return { ...base, status: "structured_with_problems", technicalProblems: problems, metrics: computePageMetrics(regions, problems) };
}

function processGroup(source: ValidatedGroupSources, dependencies: PageLocalNeutralStructuredEvidenceFormationDependencies): NeutralDocumentGroup {
  const pages = [...source.pages]
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((pageSource) => processPage(pageSource, source.sourceCandidateGroupKey, dependencies));

  const base = {
    sourceCandidateGroupKey: source.sourceCandidateGroupKey,
    sourceTabularRegionDetectionGroupStatus: source.candidateGroup.status,
    sourcePhysicalCellHypothesisFormationGroupStatus: source.cellFormationGroup.status,
    sourcePhysicalCellTextEvidenceFormationGroupStatus: source.textEvidenceGroup.status,
    pages,
  };
  const group0: NeutralDocumentGroup = { ...base, status: deriveGroupStatus(pages, false), technicalProblems: [], metrics: computeGroupMetrics(pages, []) };
  if (validateGroupMetricConservation(group0)) return group0;
  const problems = [problem("metric_conservation_failed", "conservation_validation", { groupKey: source.sourceCandidateGroupKey })];
  return { ...base, status: "structured_with_problems", technicalProblems: problems, metrics: computeGroupMetrics(pages, problems) };
}

function buildResult(
  input: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput,
  identityFingerprint: string,
  groups: ReadonlyArray<NeutralDocumentGroup>,
  technicalProblems: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem>,
  status: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult["status"],
): BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult {
  const s = input.structureReconstruction; const t = input.tabularRegionDetection; const c = input.physicalCellHypothesisFormation; const g = input.physicalCellTextEvidenceFormation;
  const metrics = computeGlobalMetrics(groups, technicalProblems);
  return {
    schemaVersion: BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_SCHEMA_VERSION,
    formationEngineName: BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_NAME,
    formationEngineVersion: BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_VERSION,
    formationProfileId: PROFILE.profileId,
    formationProfileVersion: PROFILE.profileVersion,
    linePositionOrganizationRuleId: NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_ID,
    linePositionOrganizationRuleVersion: NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_VERSION,
    textEvidenceMaterializationRuleId: NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_ID,
    textEvidenceMaterializationRuleVersion: NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_VERSION,
    canonicalSerializationVersion: PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_CANONICAL_SERIALIZATION_VERSION,
    identityFingerprintVersion: PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_IDENTITY_FINGERPRINT_VERSION,
    identityFingerprint,
    resultFingerprintVersion: PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_RESULT_FINGERPRINT_VERSION,
    resultFingerprint: computeResultFingerprint(identityFingerprint, { status, groups, technicalProblems, metrics, limitations: LIMITATIONS }),
    sourceByteHash: s.sourceByteHash,
    sourceStructureReconstructionSchemaVersion: s.schemaVersion, sourceStructureReconstructorName: s.reconstructorName, sourceStructureReconstructorVersion: s.reconstructorVersion,
    sourceStructureReconstructionProfileId: s.reconstructionProfileId, sourceStructureReconstructionProfileVersion: s.reconstructionProfileVersion,
    sourceStructureReconstructionContextFingerprintVersion: s.reconstructionContextFingerprintVersion, sourceStructureReconstructionContextFingerprint: s.reconstructionContextFingerprint,
    sourceStructureReconstructionStatus: s.status,
    sourceTabularRegionDetectionSchemaVersion: t.schemaVersion, sourceTabularRegionDetectorName: t.detectorName, sourceTabularRegionDetectorVersion: t.detectorVersion,
    sourceTabularRegionDetectionProfileId: t.detectionProfileId, sourceTabularRegionDetectionProfileVersion: t.detectionProfileVersion,
    sourceTabularRegionDetectionContextFingerprintVersion: t.detectionContextFingerprintVersion, sourceTabularRegionDetectionContextFingerprint: t.detectionContextFingerprint,
    sourceTabularRegionDetectionStatus: t.status,
    sourcePhysicalCellHypothesisFormationSchemaVersion: c.schemaVersion, sourcePhysicalCellHypothesisFormationEngineName: c.formationEngineName, sourcePhysicalCellHypothesisFormationEngineVersion: c.formationEngineVersion,
    sourcePhysicalCellHypothesisFormationProfileId: c.formationProfileId, sourcePhysicalCellHypothesisFormationProfileVersion: c.formationProfileVersion,
    sourcePhysicalCellHypothesisFormationContextFingerprintVersion: c.formationContextFingerprintVersion, sourcePhysicalCellHypothesisFormationContextFingerprint: c.formationContextFingerprint,
    sourcePhysicalCellHypothesisFormationStatus: c.status,
    sourcePhysicalCellTextEvidenceFormationSchemaVersion: g.schemaVersion, sourcePhysicalCellTextEvidenceFormationEngineName: g.formationEngineName, sourcePhysicalCellTextEvidenceFormationEngineVersion: g.formationEngineVersion,
    sourcePhysicalCellTextEvidenceFormationProfileId: g.formationProfileId, sourcePhysicalCellTextEvidenceFormationProfileVersion: g.formationProfileVersion,
    sourcePhysicalCellTextEvidenceFormationContextFingerprintVersion: g.formationContextFingerprintVersion, sourcePhysicalCellTextEvidenceFormationContextFingerprint: g.formationContextFingerprint,
    sourcePhysicalCellTextEvidenceFormationStatus: g.status,
    status, groups, technicalProblems, metrics, limitations: LIMITATIONS,
  };
}

export function formBudgetDocumentPageLocalNeutralStructuredEvidence(input: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput): BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult {
  return formBudgetDocumentPageLocalNeutralStructuredEvidenceWithDependencies(input, DEFAULT_DEPENDENCIES);
}

export function formBudgetDocumentPageLocalNeutralStructuredEvidenceWithDependencies(
  input: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput,
  dependencies: PageLocalNeutralStructuredEvidenceFormationDependencies,
): BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult {
  const identityFingerprint = computeIdentityFingerprint(input);
  try {
    dependencies.beforeGlobalProcessing();
    const validation = validatePageLocalNeutralStructuredEvidenceFormationInput(input);
    if (validation.kind === "invalid") return buildResult(input, identityFingerprint, [], validation.problems, "failed");

    const groups = [...validation.groups]
      .sort((a, b) => a.startPageNumber - b.startPageNumber || a.sourceCandidateGroupKey.localeCompare(b.sourceCandidateGroupKey))
      .map((group) => processGroup(group, dependencies));

    const globalMetrics = computeGlobalMetrics(groups, []);
    const globalProblems = validateGlobalMetricConservation(groups, globalMetrics) ? [] : [problem("metric_conservation_failed", "conservation_validation")];
    const status = globalProblems.length > 0 ? "structured_with_problems" : deriveGlobalStatus(groups);
    return buildResult(input, identityFingerprint, groups, globalProblems, status);
  } catch {
    return buildResult(input, identityFingerprint, [], [problem("page_local_neutral_structure_unexpected_failure", "candidate_group_processing")], "failed");
  }
}
