import type { PhysicalDocumentPage } from "../physical-document-read.types";
import type { PhysicalCellHypothesisFormationRegion } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { BudgetDocumentPhysicalCellTextEvidenceFormationInput, BudgetDocumentPhysicalCellTextEvidenceFormationResult, PhysicalCellTextEvidenceFormationGroup, PhysicalCellTextEvidenceFormationGroupStatus, PhysicalCellTextEvidenceFormationPage, PhysicalCellTextEvidenceFormationPageStatus, PhysicalCellTextEvidenceFormationRegion, PhysicalCellTextEvidenceFormationRegionStatus, PhysicalCellTextEvidenceFormationTechnicalProblem } from "./budget-document-physical-cell-text-evidence-formation.types";
import { BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_NAME, BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_VERSION, BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_SCHEMA_VERSION, PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_CONTEXT_FINGERPRINT_VERSION, PHYSICAL_CELL_TEXT_EVIDENCE_NORMALIZATION_VERSION, PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_ID, PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_VERSION } from "./budget-document-physical-cell-text-evidence-formation.types";
import type { ValidatedGroupSources, ValidatedPageSources, ValidatedRegionSources } from "./physical-cell-text-evidence-formation-input-validation";
import { validatePhysicalCellTextEvidenceFormationInput } from "./physical-cell-text-evidence-formation-input-validation";
import { computeContentFingerprint, computeIdentityFingerprint } from "./physical-cell-text-evidence-formation-context-fingerprint";
import { computeGroupProcessedKey, computePageProcessedKey, computeRegionProcessedKey } from "./physical-cell-text-evidence-formation-keys";
import { LIMITATIONS, PROFILE } from "./physical-cell-text-evidence-formation-profile";
import { problem } from "./physical-cell-text-evidence-formation-technical-problem";
import { formRegionCellTextEvidences } from "./physical-cell-text-segment-formation";
import { validateCellHypothesisConservation, validateFragmentDispositionConservation, validateMetricCategoryConservation, validateSegmentOutcomeConservation, validateTextItemOccurrenceConservation } from "./physical-cell-text-evidence-formation-conservation";
import { computeGlobalMetrics, computeGroupMetrics, computePageMetrics, computeRegionMetrics } from "./physical-cell-text-evidence-formation-metrics";

export type TextEvidenceConservationFailure = "cell_hypothesis" | "segment_outcome" | "text_item_occurrence" | "fragment_disposition" | null;

function runConservationGates(
  region: PhysicalCellHypothesisFormationRegion,
  cellTextEvidences: ReturnType<typeof formRegionCellTextEvidences>["cellTextEvidences"],
  structurePage: ValidatedRegionSources["structurePage"],
  physicalPage: PhysicalDocumentPage,
): TextEvidenceConservationFailure {
  if (!validateCellHypothesisConservation(region, cellTextEvidences)) return "cell_hypothesis";
  if (!validateSegmentOutcomeConservation(region, cellTextEvidences)) return "segment_outcome";
  if (!validateTextItemOccurrenceConservation(structurePage, cellTextEvidences)) return "text_item_occurrence";
  if (!validateFragmentDispositionConservation(cellTextEvidences, physicalPage)) return "fragment_disposition";
  return null;
}

export interface PhysicalCellTextEvidenceFormationDependencies {
  readonly beforeGlobalProcessing: () => void;
  readonly formRegionCellTextEvidences: typeof formRegionCellTextEvidences;
  readonly runConservationGates: typeof runConservationGates;
}

const DEFAULT_DEPENDENCIES: PhysicalCellTextEvidenceFormationDependencies = {
  beforeGlobalProcessing: () => undefined,
  formRegionCellTextEvidences,
  runConservationGates,
};

/** Internal test seam. Never exported by a public barrel. */
export function getDefaultPhysicalCellTextEvidenceFormationDependencies(): PhysicalCellTextEvidenceFormationDependencies {
  return DEFAULT_DEPENDENCIES;
}

const CONSERVATION_FAILURE_CODE = {
  cell_hypothesis: "cell_text_evidence_conservation_failed",
  segment_outcome: "segment_outcome_conservation_failed",
  text_item_occurrence: "text_item_conservation_failed",
  fragment_disposition: "text_item_conservation_failed",
} as const;

function emptyRegion(region: PhysicalCellHypothesisFormationRegion, regionProcessedKey: string, status: PhysicalCellTextEvidenceFormationRegionStatus): PhysicalCellTextEvidenceFormationRegion {
  return {
    regionProcessedKey, sourceRegionKey: region.sourceRegionKey, pageNumber: region.pageNumber,
    sourcePhysicalCellHypothesisFormationRegionStatus: region.status, status,
    cellTextEvidences: [], technicalProblems: [], metrics: computeRegionMetrics(region.cellHypotheses.length, [], 0),
  };
}

function formationFailedRegion(region: PhysicalCellHypothesisFormationRegion, regionProcessedKey: string, groupProcessedKey: string): PhysicalCellTextEvidenceFormationRegion {
  const technicalProblem = problem("cell_text_evidence_formation_failed", "fragment_assembly", { groupKey: groupProcessedKey, pageNumber: region.pageNumber, regionKey: region.sourceRegionKey });
  return {
    regionProcessedKey, sourceRegionKey: region.sourceRegionKey, pageNumber: region.pageNumber,
    sourcePhysicalCellHypothesisFormationRegionStatus: region.status, status: "formed_with_problems",
    cellTextEvidences: [], technicalProblems: [technicalProblem], metrics: computeRegionMetrics(region.cellHypotheses.length, [], 1),
  };
}

function processRegion(
  source: ValidatedRegionSources,
  regionProcessedKey: string,
  groupProcessedKey: string,
  physicalPageByNumber: ReadonlyMap<number, PhysicalDocumentPage>,
  dependencies: PhysicalCellTextEvidenceFormationDependencies,
): PhysicalCellTextEvidenceFormationRegion {
  const region = source.cellFormationRegion;
  if (region.status === "region_not_processable" || region.status === "no_physical_grid") return emptyRegion(region, regionProcessedKey, "region_not_processable");
  if (region.cellHypotheses.length === 0) return emptyRegion(region, regionProcessedKey, "no_cell_hypotheses");

  const physicalPage = physicalPageByNumber.get(region.pageNumber);
  if (!physicalPage) {
    const technicalProblem = problem("source_physical_read_contract_invalid", "candidate_region_processing", { groupKey: groupProcessedKey, pageNumber: region.pageNumber, regionKey: region.sourceRegionKey });
    return { regionProcessedKey, sourceRegionKey: region.sourceRegionKey, pageNumber: region.pageNumber, sourcePhysicalCellHypothesisFormationRegionStatus: region.status, status: "formed_with_problems", cellTextEvidences: [], technicalProblems: [technicalProblem], metrics: computeRegionMetrics(region.cellHypotheses.length, [], 1) };
  }

  let formed: ReturnType<typeof formRegionCellTextEvidences>;
  try {
    formed = dependencies.formRegionCellTextEvidences(region, source.structurePage, physicalPage, { groupKey: groupProcessedKey, regionKey: region.sourceRegionKey });
  } catch {
    return formationFailedRegion(region, regionProcessedKey, groupProcessedKey);
  }

  let conservationFailure: TextEvidenceConservationFailure;
  try {
    conservationFailure = dependencies.runConservationGates(region, formed.cellTextEvidences, source.structurePage, physicalPage);
  } catch {
    conservationFailure = "fragment_disposition";
  }

  const problemsWithConservation = conservationFailure
    ? [...formed.technicalProblems, problem(CONSERVATION_FAILURE_CODE[conservationFailure], "conservation_validation", { groupKey: groupProcessedKey, pageNumber: region.pageNumber, regionKey: region.sourceRegionKey })]
    : formed.technicalProblems;

  const metrics = computeRegionMetrics(region.cellHypotheses.length, formed.cellTextEvidences, problemsWithConservation.length);
  const metricConservationFailed = !conservationFailure && !validateMetricCategoryConservation(region.cellHypotheses.length, formed.cellTextEvidences, metrics);
  const finalProblems = metricConservationFailed
    ? [...problemsWithConservation, problem("cell_text_evidence_conservation_failed", "conservation_validation", { groupKey: groupProcessedKey, pageNumber: region.pageNumber, regionKey: region.sourceRegionKey })]
    : problemsWithConservation;
  const finalMetrics = metricConservationFailed ? computeRegionMetrics(region.cellHypotheses.length, formed.cellTextEvidences, finalProblems.length) : metrics;

  const hasProblem = conservationFailure !== null || metricConservationFailed;
  const status: PhysicalCellTextEvidenceFormationRegionStatus = hasProblem || formed.cellTextEvidences.some((entry) => entry.status !== "formed") ? "formed_with_problems" : "formed";

  return { regionProcessedKey, sourceRegionKey: region.sourceRegionKey, pageNumber: region.pageNumber, sourcePhysicalCellHypothesisFormationRegionStatus: region.status, status, cellTextEvidences: formed.cellTextEvidences, technicalProblems: finalProblems, metrics: finalMetrics };
}

function pageStatusFromRegions(regions: ReadonlyArray<PhysicalCellTextEvidenceFormationRegion>): PhysicalCellTextEvidenceFormationPageStatus {
  if (regions.length > 0 && regions.every((entry) => entry.status === "region_not_processable")) return "page_not_processable";
  if (regions.some((entry) => entry.status === "formed_with_problems" || entry.status === "region_not_processable")) return "formed_with_problems";
  if (regions.length === 0 || regions.every((entry) => entry.status === "no_cell_hypotheses")) return "no_cell_hypotheses";
  return "formed";
}

function groupStatusFromPages(pages: ReadonlyArray<PhysicalCellTextEvidenceFormationPage>): PhysicalCellTextEvidenceFormationGroupStatus {
  if (pages.length > 0 && pages.every((entry) => entry.status === "page_not_processable")) return "group_not_processable";
  if (pages.some((entry) => entry.status === "formed_with_problems" || entry.status === "page_not_processable")) return "formed_with_problems";
  if (pages.length === 0 || pages.every((entry) => entry.status === "no_cell_hypotheses")) return "no_cell_hypotheses";
  return "formed";
}

function processPage(
  source: ValidatedPageSources,
  groupProcessedKey: string,
  physicalPageByNumber: ReadonlyMap<number, PhysicalDocumentPage>,
  dependencies: PhysicalCellTextEvidenceFormationDependencies,
): PhysicalCellTextEvidenceFormationPage {
  const pageProcessedKey = computePageProcessedKey(groupProcessedKey, source.cellFormationPage.pageNumber);
  if (source.cellFormationPage.status === "page_not_processable") {
    return { pageProcessedKey, pageNumber: source.cellFormationPage.pageNumber, sourcePhysicalCellHypothesisFormationPageStatus: source.cellFormationPage.status, status: "page_not_processable", regions: [], technicalProblems: [], metrics: computePageMetrics([]) };
  }
  const regions = [...source.regions]
    .sort((a, b) => a.cellFormationRegion.sourceRegionKey.localeCompare(b.cellFormationRegion.sourceRegionKey))
    .map((regionSource) => processRegion(regionSource, computeRegionProcessedKey(pageProcessedKey, regionSource.cellFormationRegion.sourceRegionKey), groupProcessedKey, physicalPageByNumber, dependencies));
  return { pageProcessedKey, pageNumber: source.cellFormationPage.pageNumber, sourcePhysicalCellHypothesisFormationPageStatus: source.cellFormationPage.status, status: pageStatusFromRegions(regions), regions, technicalProblems: [], metrics: computePageMetrics(regions) };
}

function processGroup(
  source: ValidatedGroupSources,
  identityFingerprint: string,
  physicalPageByNumber: ReadonlyMap<number, PhysicalDocumentPage>,
  dependencies: PhysicalCellTextEvidenceFormationDependencies,
): PhysicalCellTextEvidenceFormationGroup {
  const groupProcessedKey = computeGroupProcessedKey(identityFingerprint, source.cellFormationGroup.sourceCandidateGroupKey);
  if (source.cellFormationGroup.status === "group_not_processable") {
    return { groupProcessedKey, sourceCandidateGroupKey: source.cellFormationGroup.sourceCandidateGroupKey, sourcePhysicalCellHypothesisFormationGroupStatus: source.cellFormationGroup.status, status: "group_not_processable", pageKeys: [], pages: [], technicalProblems: [], metrics: computeGroupMetrics([]) };
  }
  const pages = [...source.pages]
    .sort((a, b) => a.cellFormationPage.pageNumber - b.cellFormationPage.pageNumber)
    .map((pageSource) => processPage(pageSource, groupProcessedKey, physicalPageByNumber, dependencies));
  return { groupProcessedKey, sourceCandidateGroupKey: source.cellFormationGroup.sourceCandidateGroupKey, sourcePhysicalCellHypothesisFormationGroupStatus: source.cellFormationGroup.status, status: groupStatusFromPages(pages), pageKeys: pages.map((page) => page.pageProcessedKey), pages, technicalProblems: [], metrics: computeGroupMetrics(pages) };
}

function buildResult(
  input: BudgetDocumentPhysicalCellTextEvidenceFormationInput,
  identityFingerprint: string,
  groups: ReadonlyArray<PhysicalCellTextEvidenceFormationGroup>,
  technicalProblems: ReadonlyArray<PhysicalCellTextEvidenceFormationTechnicalProblem>,
  status: BudgetDocumentPhysicalCellTextEvidenceFormationResult["status"],
): BudgetDocumentPhysicalCellTextEvidenceFormationResult {
  const p = input.physicalRead; const s = input.structureReconstruction; const c = input.physicalCellHypothesisFormation;
  const metrics = computeGlobalMetrics(groups);
  return {
    schemaVersion: BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_SCHEMA_VERSION,
    formationEngineName: BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_NAME,
    formationEngineVersion: BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_VERSION,
    formationProfileId: PROFILE.profileId,
    formationProfileVersion: PROFILE.profileVersion,
    normalizationVersion: PHYSICAL_CELL_TEXT_EVIDENCE_NORMALIZATION_VERSION,
    fragmentAssemblyRuleId: PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_ID,
    fragmentAssemblyRuleVersion: PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_VERSION,
    formationContextFingerprintVersion: PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_CONTEXT_FINGERPRINT_VERSION,
    formationContextFingerprint: computeContentFingerprint(identityFingerprint, { status, groups, technicalProblems, metrics, limitations: LIMITATIONS }),
    sourceByteHash: p.sourceByteHash,
    sourcePhysicalReadSchemaVersion: p.schemaVersion, sourcePhysicalReaderName: p.readerName, sourcePhysicalReaderVersion: p.readerVersion,
    sourcePhysicalAdapterVersion: p.adapterVersion, sourcePhysicalUnderlyingLibraryVersion: p.underlyingLibraryVersion,
    sourcePhysicalTextItemCoordinateSpaceVersion: p.textItemCoordinateSpaceVersion, sourcePhysicalTextItemGeometryProfileVersion: p.textItemGeometryProfileVersion,
    sourcePhysicalGeometryContextFingerprintVersion: p.geometryContextFingerprintVersion, sourcePhysicalGeometryContextFingerprint: p.geometryContextFingerprint,
    sourcePhysicalReadStatus: p.status,
    sourceStructureReconstructionSchemaVersion: s.schemaVersion, sourceStructureReconstructorName: s.reconstructorName, sourceStructureReconstructorVersion: s.reconstructorVersion,
    sourceStructureReconstructionProfileId: s.reconstructionProfileId, sourceStructureReconstructionProfileVersion: s.reconstructionProfileVersion,
    sourceStructureReconstructionContextFingerprintVersion: s.reconstructionContextFingerprintVersion, sourceStructureReconstructionContextFingerprint: s.reconstructionContextFingerprint,
    sourceStructureReconstructionStatus: s.status,
    sourcePhysicalCellHypothesisFormationSchemaVersion: c.schemaVersion, sourcePhysicalCellHypothesisFormationEngineName: c.formationEngineName, sourcePhysicalCellHypothesisFormationEngineVersion: c.formationEngineVersion,
    sourcePhysicalCellHypothesisFormationProfileId: c.formationProfileId, sourcePhysicalCellHypothesisFormationProfileVersion: c.formationProfileVersion,
    sourcePhysicalCellHypothesisFormationContextFingerprintVersion: c.formationContextFingerprintVersion, sourcePhysicalCellHypothesisFormationContextFingerprint: c.formationContextFingerprint,
    sourcePhysicalCellHypothesisFormationStatus: c.status,
    status, groups, technicalProblems, metrics, limitations: LIMITATIONS,
  };
}

export function formBudgetDocumentPhysicalCellTextEvidence(input: BudgetDocumentPhysicalCellTextEvidenceFormationInput): BudgetDocumentPhysicalCellTextEvidenceFormationResult {
  return formBudgetDocumentPhysicalCellTextEvidenceWithDependencies(input, DEFAULT_DEPENDENCIES);
}

export function formBudgetDocumentPhysicalCellTextEvidenceWithDependencies(
  input: BudgetDocumentPhysicalCellTextEvidenceFormationInput,
  dependencies: PhysicalCellTextEvidenceFormationDependencies,
): BudgetDocumentPhysicalCellTextEvidenceFormationResult {
  const identityFingerprint = computeIdentityFingerprint(input);
  try {
    dependencies.beforeGlobalProcessing();
    const validation = validatePhysicalCellTextEvidenceFormationInput(input);
    if (validation.kind === "invalid") return buildResult(input, identityFingerprint, [], validation.problems, "failed");

    const physicalPageByNumber = new Map(input.physicalRead.pages.map((page) => [page.pageNumber, page]));
    const groups = [...validation.groups]
      .sort((a, b) => a.structureGroup.startPageNumber - b.structureGroup.startPageNumber || a.cellFormationGroup.sourceCandidateGroupKey.localeCompare(b.cellFormationGroup.sourceCandidateGroupKey))
      .map((group) => processGroup(group, identityFingerprint, physicalPageByNumber, dependencies));

    const status = groups.some((entry) => entry.status === "formed_with_problems" || entry.status === "group_not_processable") ? "completed_with_problems" : "completed";
    return buildResult(input, identityFingerprint, groups, [], status);
  } catch {
    return buildResult(input, identityFingerprint, [], [problem("physical_cell_text_evidence_formation_unexpected_failure", "candidate_group_processing")], "failed");
  }
}
