import type { ReconstructedHorizontalSegment, ReconstructedPhysicalLine } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalColumnHypothesis, PhysicalColumnHypothesisSegmentDisposition } from "../physical-column-hypothesis-reconstruction/budget-document-physical-column-hypothesis-reconstruction.types";
import { computeStructureReconstructionContextFingerprint } from "../structure-reconstruction/structure-reconstruction-context-fingerprint";
import { computeTabularRegionDetectionIdentityFingerprint, buildTabularRegionDetectionIdentityFingerprintInput, computeTabularRegionDetectionContentFingerprint } from "../tabular-region-detection/tabular-region-detection-context-fingerprint";
import { VERTICAL_ALIGNMENT_OBSERVATION_RULE_ID, VERTICAL_ALIGNMENT_OBSERVATION_RULE_VERSION } from "../tabular-region-detection/vertical-alignment-observation";
import { TABULAR_REGION_FORMATION_RULE_ID, TABULAR_REGION_FORMATION_RULE_VERSION } from "../tabular-region-detection/tabular-region-formation";
import { BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1 } from "../tabular-region-detection/tabular-region-detection-profile";
import { buildPhysicalColumnHypothesisReconstructionIdentityFingerprintInput, computePhysicalColumnHypothesisReconstructionContentFingerprint, computePhysicalColumnHypothesisReconstructionIdentityFingerprint } from "../physical-column-hypothesis-reconstruction/physical-column-hypothesis-reconstruction-context-fingerprint";
import { BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_PROFILE_V1 } from "../physical-column-hypothesis-reconstruction/physical-column-hypothesis-reconstruction-profile";
import { PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_ID, PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_VERSION } from "../physical-column-hypothesis-reconstruction/physical-vertical-band-construction";
import { PHYSICAL_COLUMN_HYPOTHESIS_FORMATION_RULE_ID as COLUMN_RULE_ID, PHYSICAL_COLUMN_HYPOTHESIS_FORMATION_RULE_VERSION as COLUMN_RULE_VERSION } from "../physical-column-hypothesis-reconstruction/physical-column-hypothesis-formation";
import type { BudgetDocumentPhysicalCellHypothesisFormationInput, BudgetDocumentPhysicalCellHypothesisFormationResult, PhysicalCellHypothesisFormationGroup, PhysicalCellHypothesisFormationPage, PhysicalCellHypothesisFormationRegion, PhysicalCellHypothesisFormationTechnicalProblem, PhysicalCellHypothesisSegmentDisposition, PhysicalGridIntersection } from "./budget-document-physical-cell-hypothesis-formation.types";
import { BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_ENGINE_NAME, BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_ENGINE_VERSION, BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_SCHEMA_VERSION, PHYSICAL_CELL_HYPOTHESIS_FORMATION_CONTEXT_FINGERPRINT_VERSION } from "./budget-document-physical-cell-hypothesis-formation.types";
import type { ValidatedGroupSources, ValidatedRegionSources } from "./physical-cell-hypothesis-formation-input-validation";
import { validatePhysicalCellHypothesisFormationInput } from "./physical-cell-hypothesis-formation-input-validation";
import { computeContentFingerprint, computeIdentityFingerprint } from "./physical-cell-hypothesis-formation-context-fingerprint";
import { computeGroupProcessedKey, computePageProcessedKey, computeRegionProcessedKey } from "./physical-cell-hypothesis-formation-keys";
import { LIMITATIONS, PROFILE } from "./physical-cell-hypothesis-formation-profile";
import { canonicalizePhysicalCellFormationBounds } from "./physical-cell-hypothesis-formation-output-geometry-canonicalization";
import { problem } from "./physical-cell-hypothesis-formation-technical-problem";
import type { PhysicalGridIntersectionDraft } from "./physical-grid-formation";
import { createBounds, formPhysicalGrid } from "./physical-grid-formation";
import type { PhysicalSegmentGridAssociationResult } from "./physical-segment-grid-association";
import { associateSegmentsToPhysicalGrid } from "./physical-segment-grid-association";
import type { PhysicalCellFormationResult } from "./physical-cell-hypothesis-formation";
import { formPhysicalCellHypotheses } from "./physical-cell-hypothesis-formation";
import type { ConservationFailure } from "./physical-cell-hypothesis-formation-conservation";
import { validatePhysicalCellFormationConservation } from "./physical-cell-hypothesis-formation-conservation";
import { computeGlobalMetrics, computeGroupMetrics, computePageMetrics, computeRegionMetrics } from "./physical-cell-hypothesis-formation-metrics";

export interface PhysicalCellFormationDependencies {
  readonly beforeGlobalProcessing: () => void;
  readonly formGrid: typeof formPhysicalGrid;
  readonly associateSegments: typeof associateSegmentsToPhysicalGrid;
  readonly formCells: typeof formPhysicalCellHypotheses;
  readonly validateContainment: (result: PhysicalCellFormationResult) => void;
  readonly validateConservation: typeof validatePhysicalCellFormationConservation;
  readonly validateCanonicalization: (result: PhysicalCellFormationResult) => void;
}

const DEFAULT_DEPENDENCIES: PhysicalCellFormationDependencies = {
  beforeGlobalProcessing: () => undefined,
  formGrid: formPhysicalGrid,
  associateSegments: associateSegmentsToPhysicalGrid,
  formCells: formPhysicalCellHypotheses,
  validateContainment: (result) => {
    const intersections = new Map(result.intersections.map((entry) => [entry.gridIntersectionKey, entry]));
    result.cells.forEach((cell) => {
      const intersection = intersections.get(cell.gridIntersectionKey);
      if (!intersection || cell.observedContentBounds.leftPoints < intersection.gridBounds.leftPoints || cell.observedContentBounds.rightPoints > intersection.gridBounds.rightPoints || cell.observedContentBounds.topPoints < intersection.gridBounds.topPoints || cell.observedContentBounds.bottomPoints > intersection.gridBounds.bottomPoints) throw new Error("containment");
    });
  },
  validateConservation: validatePhysicalCellFormationConservation,
  validateCanonicalization: (result) => {
    result.intersections.forEach((entry) => {
      if (JSON.stringify(entry.gridBounds) !== JSON.stringify(canonicalizePhysicalCellFormationBounds(entry.gridBounds))) throw new Error("canonicalization");
    });
    result.cells.forEach((entry) => {
      if (JSON.stringify(entry.observedContentBounds) !== JSON.stringify(canonicalizePhysicalCellFormationBounds(entry.observedContentBounds))) throw new Error("canonicalization");
    });
  },
};

/** Internal test seam. Never exported by a public barrel. */
export function getDefaultPhysicalCellFormationDependencies(): PhysicalCellFormationDependencies {
  return DEFAULT_DEPENDENCIES;
}

function coherentGeometry(value: { leftPoints: number; topPoints: number; rightPoints: number; bottomPoints: number; widthPoints: number; heightPoints: number; centerXPoints: number; centerYPoints: number }): boolean {
  return [value.leftPoints, value.topPoints, value.rightPoints, value.bottomPoints, value.widthPoints, value.heightPoints, value.centerXPoints, value.centerYPoints].every(Number.isFinite)
    && value.rightPoints > value.leftPoints && value.bottomPoints > value.topPoints
    && value.widthPoints === value.rightPoints - value.leftPoints && value.heightPoints === value.bottomPoints - value.topPoints
    && value.centerXPoints === (value.leftPoints + value.rightPoints) / 2 && value.centerYPoints === (value.topPoints + value.bottomPoints) / 2;
}

function mapUnprocessedDispositions(source: ReadonlyArray<PhysicalColumnHypothesisSegmentDisposition>): ReadonlyArray<PhysicalCellHypothesisSegmentDisposition> {
  return source.map((entry) => {
    if (entry.status === "unresolved_physical_column_hypothesis_ambiguity") return { status: "unresolved_inherited_column_ambiguity" as const, segmentKey: entry.segmentKey, lineKey: entry.lineKey, conflictingCandidateHypothesisKeys: entry.conflictingCandidateHypothesisKeys };
    if (entry.status === "unresolved_physical_column_hypothesis_detection_failed") return { status: "unresolved_cell_hypothesis_formation_failed" as const, segmentKey: entry.segmentKey, lineKey: entry.lineKey, failedPhase: "segment_association" as const };
    return { status: "outside_all_physical_cell_hypotheses" as const, segmentKey: entry.segmentKey, lineKey: entry.lineKey };
  });
}

function emptyRegion(source: ValidatedRegionSources, regionProcessedKey: string, status: PhysicalCellHypothesisFormationRegion["status"], problems: ReadonlyArray<PhysicalCellHypothesisFormationTechnicalProblem> = []): PhysicalCellHypothesisFormationRegion {
  const dispositions = mapUnprocessedDispositions(source.columnRegion.segmentDispositions);
  return { regionProcessedKey, sourceRegionKey: source.columnRegion.sourceRegionKey, pageNumber: source.columnRegion.pageNumber, sourcePhysicalColumnHypothesisRegionStatus: source.columnRegion.status, status, gridIntersections: [], cellHypotheses: [], segmentDispositions: dispositions, technicalProblems: problems, metrics: computeRegionMetrics([], [], dispositions, source.detectionRegion.lineKeys.length, source.columnRegion.hypotheses.length, problems.length), profileId: PROFILE.profileId, profileVersion: PROFILE.profileVersion };
}

function publicFailedIntersections(drafts: ReadonlyArray<PhysicalGridIntersectionDraft>, failedPhase: "segment_association" | "cell_hypothesis_formation" | "containment_validation", segmentKeys: ReadonlyArray<string>): ReadonlyArray<PhysicalGridIntersection> {
  return drafts.map(({ sourceLine: _line, sourceColumn: _column, ...entry }) => ({ ...entry, gridBounds: canonicalizePhysicalCellFormationBounds(entry.gridBounds), status: "unresolved_technical_failure" as const, failedPhase, affectedSegmentKeys: segmentKeys }));
}

function failedAfterGrid(source: ValidatedRegionSources, regionProcessedKey: string, drafts: ReadonlyArray<PhysicalGridIntersectionDraft>, segments: ReadonlyArray<ReconstructedHorizontalSegment>, failedPhase: "segment_association" | "cell_hypothesis_formation" | "containment_validation", code: Parameters<typeof problem>[0], phase: Parameters<typeof problem>[1]): PhysicalCellHypothesisFormationRegion {
  const intersections = publicFailedIntersections(drafts, failedPhase, segments.map((entry) => entry.segmentKey));
  const dispositions = segments.map((entry) => ({ status: "unresolved_cell_hypothesis_formation_failed" as const, segmentKey: entry.segmentKey, lineKey: entry.lineKey, failedPhase: failedPhase === "segment_association" ? "segment_association" as const : "cell_hypothesis_formation" as const }));
  const technicalProblem = problem(code, phase, { pageNumber: source.columnRegion.pageNumber, regionKey: source.columnRegion.sourceRegionKey });
  return { regionProcessedKey, sourceRegionKey: source.columnRegion.sourceRegionKey, pageNumber: source.columnRegion.pageNumber, sourcePhysicalColumnHypothesisRegionStatus: source.columnRegion.status, status: "formed_with_problems", gridIntersections: intersections, cellHypotheses: [], segmentDispositions: dispositions, technicalProblems: [technicalProblem], metrics: computeRegionMetrics(intersections, [], dispositions, source.detectionRegion.lineKeys.length, source.columnRegion.hypotheses.length, 1), profileId: PROFILE.profileId, profileVersion: PROFILE.profileVersion };
}

function processRegion(source: ValidatedRegionSources, regionProcessedKey: string, dependencies: PhysicalCellFormationDependencies): PhysicalCellHypothesisFormationRegion {
  if (source.columnRegion.status === "region_not_processable") return emptyRegion(source, regionProcessedKey, "region_not_processable");
  if (source.columnRegion.segmentDispositions.some((entry) => entry.status === "unresolved_physical_column_hypothesis_detection_failed")) {
    return emptyRegion(source, regionProcessedKey, "region_not_processable", [problem("source_physical_column_hypothesis_contract_invalid", "source_validation", { pageNumber: source.columnRegion.pageNumber, regionKey: source.columnRegion.sourceRegionKey })]);
  }

  const lineByKey = new Map(source.structurePage.lines.map((entry) => [entry.lineKey, entry]));
  const segmentByKey = new Map(source.structurePage.segments.map((entry) => [entry.segmentKey, entry]));
  const lines = source.detectionRegion.lineKeys.map((key) => lineByKey.get(key)!).sort((a, b) => a.verticalOrder - b.verticalOrder || a.lineKey.localeCompare(b.lineKey));
  const columns = [...source.columnRegion.hypotheses].sort((a, b) => a.order - b.order || a.leftPoints - b.leftPoints || a.hypothesisKey.localeCompare(b.hypothesisKey));
  const segments = lines.flatMap((line) => line.segmentKeys.map((key) => segmentByKey.get(key)!)).sort((a, b) => a.lineKey.localeCompare(b.lineKey) || a.horizontalOrder - b.horizontalOrder || a.segmentKey.localeCompare(b.segmentKey));

  const invalidLine = lines.find((entry) => !coherentGeometry(entry));
  if (invalidLine) return emptyRegion(source, regionProcessedKey, "region_not_processable", [problem(invalidLine.widthPoints <= 0 || invalidLine.heightPoints <= 0 ? "source_line_geometry_degenerate" : "source_geometry_incoherent", "source_validation", { pageNumber: source.columnRegion.pageNumber, regionKey: source.columnRegion.sourceRegionKey, lineKey: invalidLine.lineKey })]);
  const invalidColumn = columns.find((entry) => !coherentGeometry(entry));
  if (invalidColumn) return emptyRegion(source, regionProcessedKey, "region_not_processable", [problem(invalidColumn.widthPoints <= 0 || invalidColumn.heightPoints <= 0 ? "source_physical_column_hypothesis_geometry_degenerate" : "source_geometry_incoherent", "source_validation", { pageNumber: source.columnRegion.pageNumber, regionKey: source.columnRegion.sourceRegionKey, physicalColumnHypothesisKey: invalidColumn.hypothesisKey })]);
  for (let left = 0; left < columns.length; left += 1) for (let right = left + 1; right < columns.length; right += 1) {
    if (Math.min(columns[left].rightPoints, columns[right].rightPoints) - Math.max(columns[left].leftPoints, columns[right].leftPoints) > 0) return emptyRegion(source, regionProcessedKey, "region_not_processable", [problem("source_valid_column_hypotheses_overlap", "source_validation", { pageNumber: source.columnRegion.pageNumber, regionKey: source.columnRegion.sourceRegionKey })]);
    if (columns[left].segmentKeys.some((key) => columns[right].segmentKeys.includes(key))) return emptyRegion(source, regionProcessedKey, "region_not_processable", [problem("source_segment_claimed_by_multiple_valid_column_hypotheses", "source_validation", { pageNumber: source.columnRegion.pageNumber, regionKey: source.columnRegion.sourceRegionKey })]);
  }
  if (lines.length === 0 || columns.length === 0) return emptyRegion(source, regionProcessedKey, "no_physical_grid");

  let drafts: ReadonlyArray<PhysicalGridIntersectionDraft>;
  try { drafts = dependencies.formGrid(regionProcessedKey, source.columnRegion.sourceRegionKey, source.columnRegion.pageNumber, lines, columns); }
  catch { return emptyRegion(source, regionProcessedKey, "region_not_processable", [problem("physical_grid_formation_failed", "grid_formation", { pageNumber: source.columnRegion.pageNumber, regionKey: source.columnRegion.sourceRegionKey })]); }

  let associations: PhysicalSegmentGridAssociationResult;
  try { associations = dependencies.associateSegments(segments, drafts, source.columnRegion.segmentDispositions); }
  catch { return failedAfterGrid(source, regionProcessedKey, drafts, segments, "segment_association", "physical_segment_association_failed", "segment_association"); }

  let formed: PhysicalCellFormationResult;
  try { formed = dependencies.formCells(drafts, segments, associations); }
  catch { return failedAfterGrid(source, regionProcessedKey, drafts, segments, "cell_hypothesis_formation", "physical_cell_hypothesis_formation_failed", "cell_hypothesis_formation"); }
  try { dependencies.validateContainment(formed); }
  catch { return failedAfterGrid(source, regionProcessedKey, drafts, segments, "containment_validation", "physical_cell_hypothesis_containment_failed", "containment_validation"); }
  try { dependencies.validateCanonicalization(formed); }
  catch { return failedAfterGrid(source, regionProcessedKey, drafts, segments, "containment_validation", "source_geometry_incoherent", "containment_validation"); }

  let conservation: ConservationFailure;
  try { conservation = dependencies.validateConservation(lines.length, columns.length, segments.map((entry) => entry.segmentKey), formed.intersections, formed.cells, formed.dispositions); }
  catch { conservation = "references"; }
  if (conservation) {
    const code = conservation === "intersections" ? "physical_grid_intersection_conservation_failed" : conservation === "segments" ? "physical_segment_conservation_failed" : "physical_cell_hypothesis_containment_failed";
    const technicalProblem = problem(code, "conservation_validation", { pageNumber: source.columnRegion.pageNumber, regionKey: source.columnRegion.sourceRegionKey });
    return { regionProcessedKey, sourceRegionKey: source.columnRegion.sourceRegionKey, pageNumber: source.columnRegion.pageNumber, sourcePhysicalColumnHypothesisRegionStatus: source.columnRegion.status, status: "formed_with_problems", gridIntersections: formed.intersections, cellHypotheses: formed.cells, segmentDispositions: formed.dispositions, technicalProblems: [technicalProblem], metrics: computeRegionMetrics(formed.intersections, formed.cells, formed.dispositions, lines.length, columns.length, 1), profileId: PROFILE.profileId, profileVersion: PROFILE.profileVersion };
  }
  const metrics = computeRegionMetrics(formed.intersections, formed.cells, formed.dispositions, lines.length, columns.length, 0);
  const hasAmbiguity = metrics.ambiguousGridIntersectionCount > 0 || metrics.inheritedAmbiguousSegmentCount > 0 || metrics.multipleClaimSegmentCount > 0;
  const status = hasAmbiguity ? "formed_with_ambiguities" : formed.cells.length === 0 ? "grid_without_cell_hypotheses" : "formed";
  return { regionProcessedKey, sourceRegionKey: source.columnRegion.sourceRegionKey, pageNumber: source.columnRegion.pageNumber, sourcePhysicalColumnHypothesisRegionStatus: source.columnRegion.status, status, gridIntersections: formed.intersections, cellHypotheses: formed.cells, segmentDispositions: formed.dispositions, technicalProblems: [], metrics, profileId: PROFILE.profileId, profileVersion: PROFILE.profileVersion };
}

function pageStatus(regions: ReadonlyArray<PhysicalCellHypothesisFormationRegion>): PhysicalCellHypothesisFormationPage["status"] {
  if (regions.length > 0 && regions.every((entry) => entry.status === "region_not_processable")) return "page_not_processable";
  if (regions.some((entry) => entry.status === "formed_with_problems" || entry.status === "region_not_processable")) return "formed_with_problems";
  if (regions.some((entry) => entry.status === "formed_with_ambiguities")) return "formed_with_ambiguities";
  if (regions.length === 0 || regions.every((entry) => entry.status === "no_physical_grid")) return "no_physical_grid";
  return "formed";
}

function processGroup(source: ValidatedGroupSources, identityFingerprint: string, dependencies: PhysicalCellFormationDependencies): PhysicalCellHypothesisFormationGroup {
  const groupProcessedKey = computeGroupProcessedKey(identityFingerprint, source.columnGroup.sourceCandidateGroupKey);
  if (source.columnGroup.status === "group_not_processable") return { groupProcessedKey, sourceCandidateGroupKey: source.columnGroup.sourceCandidateGroupKey, sourcePhysicalColumnHypothesisGroupStatus: source.columnGroup.status, status: "group_not_processable", pageKeys: [], pages: [], technicalProblems: [], metrics: computeGroupMetrics([]) };
  const pages = source.pages.map((pageSource) => {
    const pageProcessedKey = computePageProcessedKey(groupProcessedKey, pageSource.columnPage.pageNumber);
    if (pageSource.columnPage.status === "page_not_processable") return { pageProcessedKey, pageNumber: pageSource.columnPage.pageNumber, sourcePhysicalColumnHypothesisPageStatus: pageSource.columnPage.status, status: "page_not_processable" as const, regions: [], technicalProblems: [], metrics: computePageMetrics([]) };
    const regions = pageSource.regions.map((regionSource) => processRegion(regionSource, computeRegionProcessedKey(pageProcessedKey, regionSource.columnRegion.sourceRegionKey), dependencies));
    return { pageProcessedKey, pageNumber: pageSource.columnPage.pageNumber, sourcePhysicalColumnHypothesisPageStatus: pageSource.columnPage.status, status: pageStatus(regions), regions, technicalProblems: [], metrics: computePageMetrics(regions) };
  });
  const status = pages.length > 0 && pages.every((entry) => entry.status === "page_not_processable") ? "group_not_processable" : pages.some((entry) => entry.status === "formed_with_problems" || entry.status === "page_not_processable") ? "formed_with_problems" : pages.some((entry) => entry.status === "formed_with_ambiguities") ? "formed_with_ambiguities" : pages.length === 0 || pages.every((entry) => entry.status === "no_physical_grid") ? "no_physical_grid" : "formed";
  return { groupProcessedKey, sourceCandidateGroupKey: source.columnGroup.sourceCandidateGroupKey, sourcePhysicalColumnHypothesisGroupStatus: source.columnGroup.status, status, pageKeys: pages.map((entry) => entry.pageProcessedKey), pages, technicalProblems: [], metrics: computeGroupMetrics(pages) };
}

function fingerprintsAreValid(input: BudgetDocumentPhysicalCellHypothesisFormationInput): boolean {
  const s = input.structureReconstruction; const t = input.tabularRegionDetection; const c = input.physicalColumnHypothesisReconstruction;
  const structureFingerprint = computeStructureReconstructionContextFingerprint({ sourceByteHash: s.sourceByteHash, physicalReadSchemaVersion: s.physicalReadSchemaVersion, physicalReaderName: s.physicalReaderName, physicalReaderVersion: s.physicalReaderVersion, physicalAdapterVersion: s.physicalAdapterVersion, physicalUnderlyingLibraryVersion: s.physicalUnderlyingLibraryVersion, textItemCoordinateSpaceVersion: s.physicalTextItemCoordinateSpaceVersion, textItemGeometryProfileVersion: s.physicalTextItemGeometryProfileVersion, geometryContextFingerprintVersion: s.physicalGeometryContextFingerprintVersion, geometryContextFingerprint: s.physicalGeometryContextFingerprint, pageLocationSchemaVersion: s.pageLocationSchemaVersion, pageLocatorName: s.pageLocatorName, pageLocatorVersion: s.pageLocatorVersion, pageLocationDecisionRuleSetVersion: s.pageLocationDecisionRuleSetVersion, sourceObservationSchemaVersion: s.sourceObservationSchemaVersion, sourceObserverName: s.sourceObserverName, pageLocationCatalogVersion: s.sourceCatalogVersion, pageLocationObserverVersion: s.sourceObserverVersion, pageLocationObservationRuleSetVersion: s.sourceObservationRuleSetVersion, reconstructorName: s.reconstructorName, reconstructorVersion: s.reconstructorVersion, profileId: s.reconstructionProfileId, profileVersion: s.reconstructionProfileVersion, geometryCanonicalizationVersion: "structure-reconstruction-output-geometry-canonicalization-v1" });
  const detectionIdentity = computeTabularRegionDetectionIdentityFingerprint(buildTabularRegionDetectionIdentityFingerprintInput(s, t.detectorName, t.detectorVersion, t.detectionProfileId, t.detectionProfileVersion, VERTICAL_ALIGNMENT_OBSERVATION_RULE_ID, VERTICAL_ALIGNMENT_OBSERVATION_RULE_VERSION, TABULAR_REGION_FORMATION_RULE_ID, TABULAR_REGION_FORMATION_RULE_VERSION, BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1.geometryCanonicalizationVersion));
  const columnIdentity = computePhysicalColumnHypothesisReconstructionIdentityFingerprint(buildPhysicalColumnHypothesisReconstructionIdentityFingerprintInput(s, t, c.reconstructorName, c.reconstructorVersion, c.reconstructionProfileId, c.reconstructionProfileVersion, PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_ID, PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_VERSION, COLUMN_RULE_ID, COLUMN_RULE_VERSION, BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_PROFILE_V1.geometryCanonicalizationVersion));
  return structureFingerprint === s.reconstructionContextFingerprint && computeTabularRegionDetectionContentFingerprint(detectionIdentity, t.groups) === t.detectionContextFingerprint && computePhysicalColumnHypothesisReconstructionContentFingerprint(columnIdentity, c.groups) === c.reconstructionContextFingerprint;
}

function buildResult(input: BudgetDocumentPhysicalCellHypothesisFormationInput, identityFingerprint: string, groups: ReadonlyArray<PhysicalCellHypothesisFormationGroup>, technicalProblems: ReadonlyArray<PhysicalCellHypothesisFormationTechnicalProblem>, status: BudgetDocumentPhysicalCellHypothesisFormationResult["status"]): BudgetDocumentPhysicalCellHypothesisFormationResult {
  const s = input.structureReconstruction; const t = input.tabularRegionDetection; const c = input.physicalColumnHypothesisReconstruction; const metrics = computeGlobalMetrics(groups);
  return { schemaVersion: BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_SCHEMA_VERSION, formationEngineName: BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_ENGINE_NAME, formationEngineVersion: BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_ENGINE_VERSION, formationProfileId: PROFILE.profileId, formationProfileVersion: PROFILE.profileVersion, formationContextFingerprintVersion: PHYSICAL_CELL_HYPOTHESIS_FORMATION_CONTEXT_FINGERPRINT_VERSION, formationContextFingerprint: computeContentFingerprint(identityFingerprint, { status, groups, technicalProblems, metrics, limitations: LIMITATIONS }), sourceByteHash: s.sourceByteHash, sourceStructureReconstructionSchemaVersion: s.schemaVersion, sourceStructureReconstructorName: s.reconstructorName, sourceStructureReconstructorVersion: s.reconstructorVersion, sourceStructureReconstructionProfileId: s.reconstructionProfileId, sourceStructureReconstructionProfileVersion: s.reconstructionProfileVersion, sourceStructureReconstructionContextFingerprintVersion: s.reconstructionContextFingerprintVersion, sourceStructureReconstructionContextFingerprint: s.reconstructionContextFingerprint, sourceTabularRegionDetectionSchemaVersion: t.schemaVersion, sourceTabularRegionDetectorName: t.detectorName, sourceTabularRegionDetectorVersion: t.detectorVersion, sourceTabularRegionDetectionProfileId: t.detectionProfileId, sourceTabularRegionDetectionProfileVersion: t.detectionProfileVersion, sourceTabularRegionDetectionContextFingerprintVersion: t.detectionContextFingerprintVersion, sourceTabularRegionDetectionContextFingerprint: t.detectionContextFingerprint, sourcePhysicalColumnHypothesisReconstructionSchemaVersion: c.schemaVersion, sourcePhysicalColumnHypothesisReconstructorName: c.reconstructorName, sourcePhysicalColumnHypothesisReconstructorVersion: c.reconstructorVersion, sourcePhysicalColumnHypothesisReconstructionProfileId: c.reconstructionProfileId, sourcePhysicalColumnHypothesisReconstructionProfileVersion: c.reconstructionProfileVersion, sourcePhysicalColumnHypothesisReconstructionContextFingerprintVersion: c.reconstructionContextFingerprintVersion, sourcePhysicalColumnHypothesisReconstructionContextFingerprint: c.reconstructionContextFingerprint, status, groups, technicalProblems, metrics, limitations: LIMITATIONS };
}

export function formBudgetDocumentPhysicalCellHypotheses(input: BudgetDocumentPhysicalCellHypothesisFormationInput): BudgetDocumentPhysicalCellHypothesisFormationResult {
  return formBudgetDocumentPhysicalCellHypothesesWithDependencies(input, DEFAULT_DEPENDENCIES);
}

export function formBudgetDocumentPhysicalCellHypothesesWithDependencies(input: BudgetDocumentPhysicalCellHypothesisFormationInput, dependencies: PhysicalCellFormationDependencies): BudgetDocumentPhysicalCellHypothesisFormationResult {
  const identityFingerprint = computeIdentityFingerprint(input);
  try {
    dependencies.beforeGlobalProcessing();
    const validation = validatePhysicalCellHypothesisFormationInput(input);
    if (validation.kind === "invalid") return buildResult(input, identityFingerprint, [], validation.problems, "failed");
    if (!fingerprintsAreValid(input)) return buildResult(input, identityFingerprint, [], [problem("source_fingerprint_invalid", "source_validation")], "failed");
    const groups = [...validation.groups].sort((a, b) => a.structureGroup.startPageNumber - b.structureGroup.startPageNumber || a.columnGroup.sourceCandidateGroupKey.localeCompare(b.columnGroup.sourceCandidateGroupKey)).map((group) => processGroup(group, identityFingerprint, dependencies));
    const status = groups.some((entry) => entry.status === "formed_with_problems" || entry.status === "group_not_processable") ? "completed_with_problems" : groups.some((entry) => entry.status === "formed_with_ambiguities") ? "completed_with_ambiguities" : "completed";
    return buildResult(input, identityFingerprint, groups, [], status);
  } catch {
    return buildResult(input, identityFingerprint, [], [problem("physical_cell_hypothesis_formation_unexpected_failure", "candidate_group_processing")], "failed");
  }
}
