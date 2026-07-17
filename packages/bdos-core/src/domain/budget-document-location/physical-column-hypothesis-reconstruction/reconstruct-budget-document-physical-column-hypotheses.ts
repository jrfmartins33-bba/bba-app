import type { ReconstructedBudgetDocumentGroup, ReconstructedBudgetDocumentPage } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { TabularRegionCandidate, TabularRegionDetectionGroup, TabularRegionDetectionPage } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import {
  BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTOR_NAME,
  BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTOR_VERSION,
  BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_SCHEMA_VERSION,
  PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION,
} from "./budget-document-physical-column-hypothesis-reconstruction.types";
import type {
  BudgetDocumentPhysicalColumnHypothesisReconstructionInput,
  BudgetDocumentPhysicalColumnHypothesisReconstructionResult,
  GlobalPhysicalColumnHypothesisReconstructionMetrics,
  GroupPhysicalColumnHypothesisReconstructionMetrics,
  PagePhysicalColumnHypothesisReconstructionMetrics,
  PhysicalColumnHypothesis,
  PhysicalColumnHypothesisReconstructionGroup,
  PhysicalColumnHypothesisReconstructionGroupStatus,
  PhysicalColumnHypothesisReconstructionLimitationCode,
  PhysicalColumnHypothesisReconstructionPage,
  PhysicalColumnHypothesisReconstructionPageStatus,
  PhysicalColumnHypothesisReconstructionRegion,
  PhysicalColumnHypothesisReconstructionRegionStatus,
  PhysicalColumnHypothesisReconstructionStatus,
  PhysicalColumnHypothesisReconstructionTechnicalProblem,
  PhysicalColumnHypothesisSegmentDisposition,
  RegionPhysicalColumnHypothesisReconstructionMetrics,
} from "./budget-document-physical-column-hypothesis-reconstruction.types";
import { validatePhysicalColumnHypothesisReconstructionInput } from "./physical-column-hypothesis-reconstruction-input-validation";
import { BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_PROFILE_V1 } from "./physical-column-hypothesis-reconstruction-profile";
import {
  buildPhysicalColumnHypothesisReconstructionIdentityFingerprintInput,
  computePhysicalColumnHypothesisReconstructionContentFingerprint,
  computePhysicalColumnHypothesisReconstructionIdentityFingerprint,
} from "./physical-column-hypothesis-reconstruction-context-fingerprint";
import { computeGroupProcessedKey, computeHypothesisKey, computePageProcessedKey, computeRegionProcessedKey } from "./physical-column-hypothesis-reconstruction-keys";
import { createPhysicalColumnHypothesisReconstructionTechnicalProblem } from "./physical-column-hypothesis-reconstruction-technical-problem";
import { canonicalizePhysicalColumnHypothesisOutputGeometryBounds } from "./physical-column-hypothesis-reconstruction-output-geometry-canonicalization";
import type { BandConstructionAlignmentInput, BandConstructionSegmentGeometry, PhysicalVerticalBandDraft } from "./physical-vertical-band-construction";
import { PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_ID, PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_VERSION, constructPhysicalVerticalBands } from "./physical-vertical-band-construction";
import type { PhysicalColumnHypothesisFormationCandidate } from "./physical-column-hypothesis-formation";
import { PHYSICAL_COLUMN_HYPOTHESIS_FORMATION_RULE_ID, PHYSICAL_COLUMN_HYPOTHESIS_FORMATION_RULE_VERSION, formPhysicalColumnHypothesisCandidates } from "./physical-column-hypothesis-formation";

const PROFILE = BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_PROFILE_V1;

/**
 * Seam de injeção interno — exclusivamente para testes exercitarem, uma
 * fase por vez, a falha de construção de faixa ou de formação de hipótese
 * de forma controlada e direta (mesmo padrão das duas Sprints anteriores).
 * Nunca parte da API pública: não exportado por nenhum barrel.
 * `reconstructBudgetDocumentPhysicalColumnHypotheses` — a única função
 * pública — não aceita nenhum parâmetro de dependências.
 */
export interface PhysicalColumnHypothesisReconstructionDependencies {
  readonly constructBands: typeof constructPhysicalVerticalBands;
  readonly formCandidates: typeof formPhysicalColumnHypothesisCandidates;
}

const DEFAULT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_DEPENDENCIES: PhysicalColumnHypothesisReconstructionDependencies = {
  constructBands: constructPhysicalVerticalBands,
  formCandidates: formPhysicalColumnHypothesisCandidates,
};

const LIMITATIONS: ReadonlyArray<PhysicalColumnHypothesisReconstructionLimitationCode> = [
  "physical_column_hypothesis_is_not_a_confirmed_column",
  "physical_column_hypothesis_is_not_a_cell",
  "no_header_identified",
  "no_footer_identified",
  "no_cross_page_continuity_evaluated",
  "no_textual_semantics_applied",
  "no_service_code_read",
  "no_description_interpreted",
  "no_unit_read",
  "no_quantity_read",
  "no_price_read",
  "no_total_read",
  "no_economic_bdi_interpreted",
  "no_budget_line_created",
  "no_budget_version_created",
  "no_numeric_fusion_tolerance_applied",
  "orphan_segments_never_absorbed_by_contention_or_proximity",
  "unresolved_structures_remain_explicit",
  "real_document_out_of_scope",
  "no_commercial_readiness_claim",
];

function assertUnreachableDisposition(value: never): never {
  throw new Error(`Disposição de segmento não tratada: ${JSON.stringify(value)}`);
}

interface RegionOutcome {
  readonly region: PhysicalColumnHypothesisReconstructionRegion;
}

function buildHypothesis(
  hypothesisKey: string,
  pageNumber: number,
  order: number,
  candidate: PhysicalColumnHypothesisFormationCandidate,
): PhysicalColumnHypothesis {
  const canonicalBounds = canonicalizePhysicalColumnHypothesisOutputGeometryBounds({
    leftPoints: candidate.leftPoints,
    topPoints: candidate.topPoints,
    rightPoints: candidate.rightPoints,
    bottomPoints: candidate.bottomPoints,
    widthPoints: candidate.widthPoints,
    heightPoints: candidate.heightPoints,
    centerXPoints: candidate.centerXPoints,
    centerYPoints: candidate.centerYPoints,
  });
  return {
    hypothesisKey,
    pageNumber,
    order,
    contributingAlignmentKeys: candidate.contributingAlignmentKeys,
    lineKeys: candidate.signature.map((member) => member.lineKey),
    segmentKeys: candidate.signature.map((member) => member.segmentKey),
    ...canonicalBounds,
    formationRuleId: PHYSICAL_COLUMN_HYPOTHESIS_FORMATION_RULE_ID,
    formationRuleVersion: PHYSICAL_COLUMN_HYPOTHESIS_FORMATION_RULE_VERSION,
    profileId: PROFILE.profileId,
    profileVersion: PROFILE.profileVersion,
  };
}

function computeRegionMetrics(
  dispositions: ReadonlyArray<PhysicalColumnHypothesisSegmentDisposition>,
  hypothesisCount: number,
): RegionPhysicalColumnHypothesisReconstructionMetrics {
  const counters = { included: 0, notIncluded: 0, ambiguous: 0, failed: 0 };
  dispositions.forEach((disposition) => {
    switch (disposition.status) {
      case "included_in_physical_column_hypothesis":
        counters.included += 1;
        break;
      case "not_in_physical_column_hypothesis":
        counters.notIncluded += 1;
        break;
      case "unresolved_physical_column_hypothesis_ambiguity":
        counters.ambiguous += 1;
        break;
      case "unresolved_physical_column_hypothesis_detection_failed":
        counters.failed += 1;
        break;
      default:
        return assertUnreachableDisposition(disposition);
    }
  });
  return {
    totalSegmentCount: dispositions.length,
    includedSegmentCount: counters.included,
    notIncludedSegmentCount: counters.notIncluded,
    ambiguousSegmentCount: counters.ambiguous,
    detectionFailedSegmentCount: counters.failed,
    hypothesisCount,
  };
}

function buildFailedRegion(
  regionProcessedKey: string,
  sourceRegionKey: string,
  pageNumber: number,
  groupKey: string,
  regionSegments: ReadonlyArray<{ readonly lineKey: string; readonly segmentKey: string }>,
  failedPhase: "band_construction" | "hypothesis_formation",
  problemCode: "physical_vertical_band_construction_failed" | "physical_column_hypothesis_formation_failed",
): RegionOutcome {
  const dispositions: PhysicalColumnHypothesisSegmentDisposition[] = regionSegments.map((member) => ({
    status: "unresolved_physical_column_hypothesis_detection_failed" as const,
    segmentKey: member.segmentKey,
    lineKey: member.lineKey,
    failedPhase,
  }));
  return {
    region: {
      regionProcessedKey,
      sourceRegionKey,
      pageNumber,
      status: "region_not_processable",
      hypotheses: [],
      segmentDispositions: dispositions,
      technicalProblems: [createPhysicalColumnHypothesisReconstructionTechnicalProblem(problemCode, failedPhase, groupKey, pageNumber, sourceRegionKey)],
      metrics: computeRegionMetrics(dispositions, 0),
      profileId: PROFILE.profileId,
      profileVersion: PROFILE.profileVersion,
    },
  };
}

function reconstructRegion(
  region: TabularRegionCandidate,
  pageAlignments: ReadonlyArray<BandConstructionAlignmentInput>,
  structurePage: ReconstructedBudgetDocumentPage,
  regionProcessedKey: string,
  groupKey: string,
  dependencies: PhysicalColumnHypothesisReconstructionDependencies,
): RegionOutcome {
  const regionLineKeySet = new Set(region.lineKeys);
  const lineByKey = new Map(structurePage.lines.map((line) => [line.lineKey, line]));
  const segmentByKey = new Map(structurePage.segments.map((segment) => [segment.segmentKey, segment]));

  const regionSegments: Array<{ lineKey: string; segmentKey: string }> = [];
  region.lineKeys.forEach((lineKey) => {
    const line = lineByKey.get(lineKey)!;
    line.segmentKeys.forEach((segmentKey) => regionSegments.push({ lineKey, segmentKey }));
  });

  const segmentGeometryByKey = new Map<string, BandConstructionSegmentGeometry>();
  regionSegments.forEach(({ segmentKey }) => {
    const segment = segmentByKey.get(segmentKey)!;
    segmentGeometryByKey.set(segmentKey, { leftPoints: segment.leftPoints, topPoints: segment.topPoints, rightPoints: segment.rightPoints, bottomPoints: segment.bottomPoints });
  });

  let bands: ReadonlyArray<PhysicalVerticalBandDraft>;
  try {
    bands = dependencies.constructBands(pageAlignments, regionLineKeySet, segmentGeometryByKey);
  } catch {
    return buildFailedRegion(regionProcessedKey, region.regionKey, region.pageNumber, groupKey, regionSegments, "band_construction", "physical_vertical_band_construction_failed");
  }

  let candidates: ReadonlyArray<PhysicalColumnHypothesisFormationCandidate>;
  try {
    candidates = dependencies.formCandidates(bands);
  } catch {
    return buildFailedRegion(regionProcessedKey, region.regionKey, region.pageNumber, groupKey, regionSegments, "hypothesis_formation", "physical_column_hypothesis_formation_failed");
  }

  const candidatesWithKeys = candidates.map((candidate) => ({
    candidate,
    hypothesisKey: computeHypothesisKey(regionProcessedKey, candidate.signature.map((member) => member.segmentKey)),
  }));

  const confirmed = candidatesWithKeys.filter((entry) => !entry.candidate.conflicted);
  const conflicting = candidatesWithKeys.filter((entry) => entry.candidate.conflicted);
  const hasOverlapConflict = conflicting.length > 0;

  const hypotheses = confirmed.map((entry, index) => buildHypothesis(entry.hypothesisKey, region.pageNumber, index + 1, entry.candidate));

  const segmentToHypothesisKey = new Map<string, string>();
  confirmed.forEach((entry) => entry.candidate.signature.forEach((member) => segmentToHypothesisKey.set(member.segmentKey, entry.hypothesisKey)));

  const segmentToConflictingKeys = new Map<string, string[]>();
  conflicting.forEach((entry) => {
    entry.candidate.signature.forEach((member) => {
      const existing = segmentToConflictingKeys.get(member.segmentKey) ?? [];
      existing.push(entry.hypothesisKey);
      segmentToConflictingKeys.set(member.segmentKey, existing);
    });
  });

  const dispositions: PhysicalColumnHypothesisSegmentDisposition[] = regionSegments.map(({ lineKey, segmentKey }) => {
    const conflictingKeys = segmentToConflictingKeys.get(segmentKey);
    if (conflictingKeys !== undefined) {
      return { status: "unresolved_physical_column_hypothesis_ambiguity", segmentKey, lineKey, conflictingCandidateHypothesisKeys: [...conflictingKeys].sort() };
    }
    const hypothesisKey = segmentToHypothesisKey.get(segmentKey);
    if (hypothesisKey !== undefined) {
      return { status: "included_in_physical_column_hypothesis", segmentKey, lineKey, hypothesisKey };
    }
    return { status: "not_in_physical_column_hypothesis", segmentKey, lineKey };
  });

  const technicalProblems: PhysicalColumnHypothesisReconstructionTechnicalProblem[] = [];
  if (hasOverlapConflict) {
    technicalProblems.push(
      createPhysicalColumnHypothesisReconstructionTechnicalProblem("physical_column_hypothesis_overlap_detected", "hypothesis_formation", groupKey, region.pageNumber, region.regionKey),
    );
  }

  const metrics = computeRegionMetrics(dispositions, hypotheses.length);
  const conservationHolds = metrics.includedSegmentCount + metrics.notIncludedSegmentCount + metrics.ambiguousSegmentCount + metrics.detectionFailedSegmentCount === metrics.totalSegmentCount;
  if (!conservationHolds) {
    technicalProblems.push(
      createPhysicalColumnHypothesisReconstructionTechnicalProblem("physical_column_hypothesis_conservation_failed", "conservation_validation", groupKey, region.pageNumber, region.regionKey),
    );
    return buildFailedRegion(regionProcessedKey, region.regionKey, region.pageNumber, groupKey, regionSegments, "hypothesis_formation", "physical_column_hypothesis_formation_failed");
  }

  const hasAmbiguity = metrics.ambiguousSegmentCount > 0;
  let status: PhysicalColumnHypothesisReconstructionRegionStatus;
  if (hypotheses.length === 0 && !hasAmbiguity) {
    status = "no_physical_column_hypothesis";
  } else if (hasAmbiguity) {
    status = "hypotheses_reconstructed_with_ambiguity";
  } else {
    status = "hypotheses_reconstructed";
  }

  return {
    region: {
      regionProcessedKey,
      sourceRegionKey: region.regionKey,
      pageNumber: region.pageNumber,
      status,
      hypotheses,
      segmentDispositions: dispositions,
      technicalProblems,
      metrics,
      profileId: PROFILE.profileId,
      profileVersion: PROFILE.profileVersion,
    },
  };
}

function computePageMetrics(regions: ReadonlyArray<PhysicalColumnHypothesisReconstructionRegion>): PagePhysicalColumnHypothesisReconstructionMetrics {
  return {
    totalRegionCount: regions.length,
    hypothesesReconstructedRegionCount: regions.filter((r) => r.status === "hypotheses_reconstructed").length,
    hypothesesReconstructedWithAmbiguityRegionCount: regions.filter((r) => r.status === "hypotheses_reconstructed_with_ambiguity").length,
    noPhysicalColumnHypothesisRegionCount: regions.filter((r) => r.status === "no_physical_column_hypothesis").length,
    regionNotProcessableRegionCount: regions.filter((r) => r.status === "region_not_processable").length,
    segmentCount: regions.reduce((sum, r) => sum + r.metrics.totalSegmentCount, 0),
    hypothesisCount: regions.reduce((sum, r) => sum + r.hypotheses.length, 0),
  };
}

function computePageStatus(regions: ReadonlyArray<PhysicalColumnHypothesisReconstructionRegion>): PhysicalColumnHypothesisReconstructionPageStatus {
  if (regions.length === 0) {
    return "no_physical_column_hypothesis";
  }
  if (regions.every((r) => r.status === "region_not_processable")) {
    return "page_not_processable";
  }
  if (regions.every((r) => r.status === "no_physical_column_hypothesis")) {
    return "no_physical_column_hypothesis";
  }
  if (regions.every((r) => r.status === "hypotheses_reconstructed")) {
    return "hypotheses_reconstructed";
  }
  return "hypotheses_reconstructed_with_problems";
}

function reconstructPage(
  detectionPage: TabularRegionDetectionPage,
  structurePage: ReconstructedBudgetDocumentPage,
  groupProcessedKey: string,
  groupKey: string,
  dependencies: PhysicalColumnHypothesisReconstructionDependencies,
): PhysicalColumnHypothesisReconstructionPage {
  const pageProcessedKey = computePageProcessedKey(groupProcessedKey, detectionPage.pageNumber);

  if (detectionPage.status === "not_detectable") {
    return {
      pageProcessedKey,
      pageNumber: detectionPage.pageNumber,
      status: "page_not_processable",
      regions: [],
      technicalProblems: [
        createPhysicalColumnHypothesisReconstructionTechnicalProblem("source_tabular_region_detection_contract_invalid", "candidate_page_processing", groupKey, detectionPage.pageNumber),
      ],
      metrics: computePageMetrics([]),
    };
  }

  const pageAlignments: ReadonlyArray<BandConstructionAlignmentInput> = detectionPage.alignments.map((alignment) => ({
    alignmentKey: alignment.alignmentKey,
    lineKeys: alignment.lineKeys,
    segmentKeys: alignment.segmentKeys,
  }));

  const orderedRegions = [...detectionPage.regions].sort((a, b) => a.order - b.order);
  const regions = orderedRegions.map(
    (region) => reconstructRegion(region, pageAlignments, structurePage, computeRegionProcessedKey(pageProcessedKey, region.regionKey), groupKey, dependencies).region,
  );

  return {
    pageProcessedKey,
    pageNumber: detectionPage.pageNumber,
    status: computePageStatus(regions),
    regions,
    technicalProblems: regions.flatMap((r) => r.technicalProblems),
    metrics: computePageMetrics(regions),
  };
}

function computeGroupMetrics(pages: ReadonlyArray<PhysicalColumnHypothesisReconstructionPage>): GroupPhysicalColumnHypothesisReconstructionMetrics {
  return {
    totalPageCount: pages.length,
    hypothesesReconstructedPageCount: pages.filter((p) => p.status === "hypotheses_reconstructed").length,
    hypothesesReconstructedWithProblemsPageCount: pages.filter((p) => p.status === "hypotheses_reconstructed_with_problems").length,
    noPhysicalColumnHypothesisPageCount: pages.filter((p) => p.status === "no_physical_column_hypothesis").length,
    pageNotProcessablePageCount: pages.filter((p) => p.status === "page_not_processable").length,
    segmentCount: pages.reduce((sum, p) => sum + p.metrics.segmentCount, 0),
    hypothesisCount: pages.reduce((sum, p) => sum + p.metrics.hypothesisCount, 0),
  };
}

function computeGroupStatus(pages: ReadonlyArray<PhysicalColumnHypothesisReconstructionPage>): PhysicalColumnHypothesisReconstructionGroupStatus {
  if (pages.length === 0) {
    return "no_physical_column_hypothesis";
  }
  if (pages.every((p) => p.status === "page_not_processable")) {
    return "group_not_processable";
  }
  if (pages.every((p) => p.status === "no_physical_column_hypothesis")) {
    return "no_physical_column_hypothesis";
  }
  if (pages.every((p) => p.status === "hypotheses_reconstructed")) {
    return "hypotheses_reconstructed";
  }
  return "hypotheses_reconstructed_with_problems";
}

function reconstructGroup(
  detectionGroup: TabularRegionDetectionGroup,
  structureGroup: ReconstructedBudgetDocumentGroup,
  identityFingerprint: string,
  dependencies: PhysicalColumnHypothesisReconstructionDependencies,
): PhysicalColumnHypothesisReconstructionGroup {
  const groupProcessedKey = computeGroupProcessedKey(identityFingerprint, detectionGroup.sourceCandidateGroupKey);
  const structurePagesByNumber = new Map(structureGroup.pages.map((page) => [page.pageNumber, page]));
  const orderedPages = [...detectionGroup.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const pages = orderedPages.map((page) => reconstructPage(page, structurePagesByNumber.get(page.pageNumber)!, groupProcessedKey, detectionGroup.sourceCandidateGroupKey, dependencies));

  return {
    groupProcessedKey,
    sourceCandidateGroupKey: detectionGroup.sourceCandidateGroupKey,
    status: computeGroupStatus(pages),
    pageKeys: pages.map((p) => p.pageProcessedKey),
    pages,
    technicalProblems: pages.flatMap((p) => p.technicalProblems),
    metrics: computeGroupMetrics(pages),
  };
}

function computeGlobalMetrics(groups: ReadonlyArray<PhysicalColumnHypothesisReconstructionGroup>): GlobalPhysicalColumnHypothesisReconstructionMetrics {
  return {
    receivedGroupCount: groups.length,
    hypothesesReconstructedGroupCount: groups.filter((g) => g.status === "hypotheses_reconstructed").length,
    hypothesesReconstructedWithProblemsGroupCount: groups.filter((g) => g.status === "hypotheses_reconstructed_with_problems").length,
    noPhysicalColumnHypothesisGroupCount: groups.filter((g) => g.status === "no_physical_column_hypothesis").length,
    groupNotProcessableGroupCount: groups.filter((g) => g.status === "group_not_processable").length,
    candidateRegionCount: groups.reduce((sum, g) => sum + g.pages.reduce((pageSum, p) => pageSum + p.metrics.totalRegionCount, 0), 0),
    segmentCount: groups.reduce((sum, g) => sum + g.metrics.segmentCount, 0),
    hypothesisCount: groups.reduce((sum, g) => sum + g.metrics.hypothesisCount, 0),
  };
}

function buildResult(
  input: BudgetDocumentPhysicalColumnHypothesisReconstructionInput,
  identityFingerprint: string,
  status: PhysicalColumnHypothesisReconstructionStatus,
  groups: ReadonlyArray<PhysicalColumnHypothesisReconstructionGroup>,
  technicalProblems: ReadonlyArray<PhysicalColumnHypothesisReconstructionTechnicalProblem>,
): BudgetDocumentPhysicalColumnHypothesisReconstructionResult {
  const { structureReconstruction: s, tabularRegionDetection: t } = input;
  const reconstructionContextFingerprint = computePhysicalColumnHypothesisReconstructionContentFingerprint(identityFingerprint, groups);
  return {
    schemaVersion: BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_SCHEMA_VERSION,
    reconstructorName: BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTOR_NAME,
    reconstructorVersion: BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTOR_VERSION,
    reconstructionProfileId: PROFILE.profileId,
    reconstructionProfileVersion: PROFILE.profileVersion,
    reconstructionContextFingerprintVersion: PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION,
    reconstructionContextFingerprint,
    sourceByteHash: s.sourceByteHash,
    sourceStructureReconstructionSchemaVersion: s.schemaVersion,
    sourceStructureReconstructorName: s.reconstructorName,
    sourceStructureReconstructorVersion: s.reconstructorVersion,
    sourceStructureReconstructionProfileId: s.reconstructionProfileId,
    sourceStructureReconstructionProfileVersion: s.reconstructionProfileVersion,
    sourceStructureReconstructionContextFingerprintVersion: s.reconstructionContextFingerprintVersion,
    sourceStructureReconstructionContextFingerprint: s.reconstructionContextFingerprint,
    sourceTabularRegionDetectionSchemaVersion: t.schemaVersion,
    sourceTabularRegionDetectorName: t.detectorName,
    sourceTabularRegionDetectorVersion: t.detectorVersion,
    sourceTabularRegionDetectionProfileId: t.detectionProfileId,
    sourceTabularRegionDetectionProfileVersion: t.detectionProfileVersion,
    sourceTabularRegionDetectionContextFingerprintVersion: t.detectionContextFingerprintVersion,
    sourceTabularRegionDetectionContextFingerprint: t.detectionContextFingerprint,
    status,
    groups,
    technicalProblems,
    metrics: computeGlobalMetrics(groups),
    limitations: LIMITATIONS,
  };
}

/**
 * Reconstrói hipóteses de coluna física, deterministicamente, a partir da
 * reconstrução estrutural e da detecção de regiões candidatas já
 * produzidas (Sprint 21.4A.2.f.2b) — nunca reclassifica páginas, nunca
 * reabre regiões, nunca interpreta significado econômico. Determinístico:
 * mesma entrada e mesmas versões produzem resultado JSON-equivalente.
 * Sempre usa as duas funções puras reais de construção de faixa e
 * formação de hipótese — esta é a única função pública, e ela não aceita
 * nenhum parâmetro de dependências.
 */
export function reconstructBudgetDocumentPhysicalColumnHypotheses(
  input: BudgetDocumentPhysicalColumnHypothesisReconstructionInput,
): BudgetDocumentPhysicalColumnHypothesisReconstructionResult {
  return reconstructBudgetDocumentPhysicalColumnHypothesesWithDependencies(input, DEFAULT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_DEPENDENCIES);
}

/**
 * Mesma reconstrução, com as funções de construção de faixa e formação de
 * hipótese injetáveis — exclusivamente para testes provarem o
 * comportamento de cada fase de falha técnica de forma direta e
 * controlada. Não exportada por nenhum barrel público; produção nunca a
 * chama — apenas `reconstructBudgetDocumentPhysicalColumnHypotheses`.
 */
export function reconstructBudgetDocumentPhysicalColumnHypothesesWithDependencies(
  input: BudgetDocumentPhysicalColumnHypothesisReconstructionInput,
  dependencies: PhysicalColumnHypothesisReconstructionDependencies,
): BudgetDocumentPhysicalColumnHypothesisReconstructionResult {
  const { structureReconstruction, tabularRegionDetection } = input;

  const identityFingerprint = computePhysicalColumnHypothesisReconstructionIdentityFingerprint(
    buildPhysicalColumnHypothesisReconstructionIdentityFingerprintInput(
      structureReconstruction,
      tabularRegionDetection,
      BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTOR_NAME,
      BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTOR_VERSION,
      PROFILE.profileId,
      PROFILE.profileVersion,
      PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_ID,
      PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_VERSION,
      PHYSICAL_COLUMN_HYPOTHESIS_FORMATION_RULE_ID,
      PHYSICAL_COLUMN_HYPOTHESIS_FORMATION_RULE_VERSION,
      PROFILE.geometryCanonicalizationVersion,
    ),
  );

  const validation = validatePhysicalColumnHypothesisReconstructionInput(input);
  if (validation.kind !== "valid") {
    return buildResult(input, identityFingerprint, "failed", [], validation.problems);
  }

  try {
    const structureGroupBySourceCandidateGroupKey = new Map(structureReconstruction.groups.map((group) => [group.sourceCandidateGroupKey, group]));
    const orderedDetectionGroups = [...tabularRegionDetection.groups].sort((a, b) => {
      const structureA = structureGroupBySourceCandidateGroupKey.get(a.sourceCandidateGroupKey)!;
      const structureB = structureGroupBySourceCandidateGroupKey.get(b.sourceCandidateGroupKey)!;
      return structureA.startPageNumber - structureB.startPageNumber;
    });

    const groups = orderedDetectionGroups.map((detectionGroup) =>
      reconstructGroup(detectionGroup, structureGroupBySourceCandidateGroupKey.get(detectionGroup.sourceCandidateGroupKey)!, identityFingerprint, dependencies),
    );

    const status: PhysicalColumnHypothesisReconstructionStatus = groups.every((g) => g.status === "hypotheses_reconstructed" || g.status === "no_physical_column_hypothesis")
      ? "completed"
      : "completed_with_problems";
    return buildResult(input, identityFingerprint, status, groups, []);
  } catch {
    return buildResult(input, identityFingerprint, "failed", [], [
      createPhysicalColumnHypothesisReconstructionTechnicalProblem("physical_column_hypothesis_reconstruction_failed", "candidate_group_processing"),
    ]);
  }
}
