import type {
  BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult,
  EmptyNeutralDocumentPosition,
  NeutralDocumentGroup,
  NeutralDocumentGroupStatus,
  NeutralDocumentLine,
  NeutralDocumentLineStatus,
  NeutralDocumentPage,
  NeutralDocumentPageStatus,
  NeutralDocumentPosition,
  NeutralDocumentRegion,
  NeutralDocumentRegionStatus,
  PageLocalNeutralStructuredEvidenceFormationStatus,
  PageLocalNeutralStructuredEvidenceFormationTechnicalProblem,
} from "../../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
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
} from "../../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import { LIMITATIONS as G2_LIMITATIONS, PROFILE as G2_PROFILE } from "../../page-local-neutral-structured-evidence-formation/page-local-neutral-structured-evidence-formation-profile";
import { computeGroupMetrics, computeLineMetrics, computePageMetrics, computeRegionMetrics } from "../../page-local-neutral-structured-evidence-formation/page-local-neutral-structured-evidence-formation-metrics";
import { computeResultFingerprint } from "../../page-local-neutral-structured-evidence-formation/page-local-neutral-structured-evidence-formation-result-fingerprint";
import { deriveGlobalStatus as deriveG2GlobalStatus } from "../../page-local-neutral-structured-evidence-formation/page-local-neutral-structured-evidence-formation-classifiers";
import { emptyIntersection, structureLine, structureSegment } from "../../page-local-neutral-structured-evidence-formation/testing/page-local-neutral-structured-evidence-formation-fixture-builders";
import type { TabularRegionCandidate } from "../../tabular-region-detection/budget-document-tabular-region-detection.types";
import { recomputePageLocalNeutralStructuredEvidenceFormationIdentityFingerprint } from "../page-boundary-neutral-continuity-evaluation-upstream-fingerprint-validation";

/**
 * Helpers de fixture mínimos, exclusivamente de teste, para construir
 * diretamente objetos no FORMATO DE SAÍDA da g.2 (`NeutralDocumentGroup` →
 * `NeutralDocumentPage` → `NeutralDocumentRegion` → `NeutralDocumentLine` →
 * `NeutralDocumentPosition`), sem executar o pipeline real f.1→g.2. Nunca
 * fixture de produção; não exportada pelo barrel público. A cadeia real
 * (f.1→...→g.2→g.3) é exercitada separadamente pelo teste de cadeia real,
 * com PDF sintético.
 */

let regionCandidateSequence = 0;

export function regionCandidateFixture(
  regionKey: string,
  pageNumber: number,
  order: number,
  lineKeys: ReadonlyArray<string>,
  geometry: Partial<Pick<TabularRegionCandidate, "leftPoints" | "topPoints" | "rightPoints" | "bottomPoints" | "widthPoints" | "heightPoints" | "centerXPoints" | "centerYPoints">> = {},
): TabularRegionCandidate {
  regionCandidateSequence += 1;
  const left = geometry.leftPoints ?? 0;
  const right = geometry.rightPoints ?? 100;
  const top = geometry.topPoints ?? 0;
  const bottom = geometry.bottomPoints ?? 50;
  return {
    regionKey, pageNumber, order, lineKeys, supportingAlignmentKeys: [`align-${regionCandidateSequence}`],
    leftPoints: left, topPoints: top, rightPoints: right, bottomPoints: bottom,
    widthPoints: geometry.widthPoints ?? right - left, heightPoints: geometry.heightPoints ?? bottom - top,
    centerXPoints: geometry.centerXPoints ?? (left + right) / 2, centerYPoints: geometry.centerYPoints ?? (top + bottom) / 2,
    formationRuleId: "fixture", formationRuleVersion: 1, profileId: "fixture", profileVersion: 1,
  };
}

/** Posição documental vazia (`status: "empty"`) — suficiente para exercitar `columnOrder`, que é tudo que a g.3 lê de uma posição. */
export function positionFixture(gridIntersectionKey: string, sourceLineKey: string, rowOrder: number, columnOrder: number, pageNumber: number, sourceRegionKey: string): EmptyNeutralDocumentPosition {
  return {
    gridIntersectionKey, sourceLineKey, rowOrder, columnOrder,
    sourceGridIntersection: emptyIntersection(gridIntersectionKey, sourceLineKey, rowOrder, columnOrder, pageNumber, sourceRegionKey),
    status: "empty", cell: null,
  };
}

export function lineFixture(
  sourceLineKey: string,
  pageNumber: number,
  verticalOrder: number,
  status: NeutralDocumentLineStatus,
  positions: ReadonlyArray<NeutralDocumentPosition>,
): NeutralDocumentLine {
  const segmentKey = `${sourceLineKey}-seg`;
  const sourceLine = { ...structureLine(sourceLineKey, pageNumber, [segmentKey]), verticalOrder };
  const physicalSegments = [structureSegment(segmentKey, sourceLineKey, pageNumber, 1, [0])];
  return {
    sourceLineKey, pageNumber, verticalOrder, status,
    sourceLine, physicalSegments,
    positions: status === "failed" ? [] : positions,
    technicalProblems: [],
    metrics: computeLineMetrics(status === "failed" ? [] : positions, [], physicalSegments.length),
  };
}

export function regionFixture(
  sourceRegionKey: string,
  pageNumber: number,
  order: number,
  status: NeutralDocumentRegionStatus,
  documentLines: ReadonlyArray<NeutralDocumentLine>,
  geometry: Parameters<typeof regionCandidateFixture>[4] = {},
): NeutralDocumentRegion {
  const sourceRegionCandidate = regionCandidateFixture(sourceRegionKey, pageNumber, order, documentLines.map((line) => line.sourceLineKey), geometry);
  return {
    sourceRegionKey, pageNumber, order, status,
    sourceRegionCandidate,
    sourcePhysicalCellHypothesisFormationRegionStatus: null,
    sourcePhysicalCellTextEvidenceFormationRegionStatus: null,
    documentLines,
    technicalProblems: [],
    metrics: computeRegionMetrics(sourceRegionCandidate, null, null, documentLines, []),
  };
}

export function pageFixture(pageNumber: number, status: NeutralDocumentPageStatus, regions: ReadonlyArray<NeutralDocumentRegion>): NeutralDocumentPage {
  return {
    pageNumber, status,
    sourceTabularRegionDetectionPageStatus: "detected",
    sourcePhysicalCellHypothesisFormationPageStatus: null,
    sourcePhysicalCellTextEvidenceFormationPageStatus: null,
    regions,
    technicalProblems: [],
    metrics: computePageMetrics(regions, []),
  };
}

export function groupFixture(sourceCandidateGroupKey: string, status: NeutralDocumentGroupStatus, pages: ReadonlyArray<NeutralDocumentPage>): NeutralDocumentGroup {
  return {
    sourceCandidateGroupKey, status,
    sourceTabularRegionDetectionGroupStatus: "detected",
    sourcePhysicalCellHypothesisFormationGroupStatus: null,
    sourcePhysicalCellTextEvidenceFormationGroupStatus: null,
    pages,
    technicalProblems: [],
    metrics: computeGroupMetrics(pages, []),
  };
}

/**
 * Constrói um `BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult`
 * completo e auto-consistente, com fingerprints reais (recomputados pela
 * mesma função que a g.3 usa para validar — nunca uma fórmula paralela), a
 * partir apenas dos grupos já construídos. Os campos `source*` dos quatro
 * contratos originais da g.2 recebem valores fixos de fixture — a g.3 nunca
 * os lê além de reproduzi-los no fingerprint de identidade.
 */
export function pageLocalResultFixture(
  unsortedGroups: ReadonlyArray<NeutralDocumentGroup>,
  options: { readonly status?: PageLocalNeutralStructuredEvidenceFormationStatus; readonly technicalProblems?: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem> } = {},
): BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult {
  // A real g.2 orchestrator always sorts groups canonically before publishing (never by
  // incidental input order) — this fixture mirrors that so it is itself order-invariant,
  // exactly like the real contract it stands in for.
  const groups = [...unsortedGroups].sort((a, b) => a.sourceCandidateGroupKey.localeCompare(b.sourceCandidateGroupKey));
  const technicalProblems = options.technicalProblems ?? [];
  const status = options.status ?? deriveG2GlobalStatus(groups);
  const shellWithoutFingerprint = {
    schemaVersion: BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_SCHEMA_VERSION,
    formationEngineName: BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_NAME,
    formationEngineVersion: BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_VERSION,
    formationProfileId: G2_PROFILE.profileId,
    formationProfileVersion: G2_PROFILE.profileVersion,
    linePositionOrganizationRuleId: NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_ID,
    linePositionOrganizationRuleVersion: NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_VERSION,
    textEvidenceMaterializationRuleId: NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_ID,
    textEvidenceMaterializationRuleVersion: NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_VERSION,
    canonicalSerializationVersion: PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_CANONICAL_SERIALIZATION_VERSION,
    identityFingerprintVersion: PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_IDENTITY_FINGERPRINT_VERSION,
    resultFingerprintVersion: PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_RESULT_FINGERPRINT_VERSION,
    sourceByteHash: "fixture-source-byte-hash",
    sourceStructureReconstructionSchemaVersion: 1, sourceStructureReconstructorName: "fixture-structure-reconstructor", sourceStructureReconstructorVersion: "fixture-structure-reconstructor-v1",
    sourceStructureReconstructionProfileId: "fixture-structure-reconstruction-profile", sourceStructureReconstructionProfileVersion: 1,
    sourceStructureReconstructionContextFingerprintVersion: "fixture-structure-reconstruction-fingerprint-v1", sourceStructureReconstructionContextFingerprint: "fixture-structure-reconstruction-fingerprint",
    sourceStructureReconstructionStatus: "completed" as const,
    sourceTabularRegionDetectionSchemaVersion: 1, sourceTabularRegionDetectorName: "fixture-tabular-region-detector", sourceTabularRegionDetectorVersion: "fixture-tabular-region-detector-v1",
    sourceTabularRegionDetectionProfileId: "fixture-tabular-region-detection-profile", sourceTabularRegionDetectionProfileVersion: 1,
    sourceTabularRegionDetectionContextFingerprintVersion: "fixture-tabular-region-detection-fingerprint-v1", sourceTabularRegionDetectionContextFingerprint: "fixture-tabular-region-detection-fingerprint",
    sourceTabularRegionDetectionStatus: "completed" as const,
    sourcePhysicalCellHypothesisFormationSchemaVersion: 1, sourcePhysicalCellHypothesisFormationEngineName: "fixture-physical-cell-hypothesis-formation-engine", sourcePhysicalCellHypothesisFormationEngineVersion: "fixture-physical-cell-hypothesis-formation-engine-v1",
    sourcePhysicalCellHypothesisFormationProfileId: "fixture-physical-cell-hypothesis-formation-profile", sourcePhysicalCellHypothesisFormationProfileVersion: 1,
    sourcePhysicalCellHypothesisFormationContextFingerprintVersion: "fixture-physical-cell-hypothesis-formation-fingerprint-v1", sourcePhysicalCellHypothesisFormationContextFingerprint: "fixture-physical-cell-hypothesis-formation-fingerprint",
    sourcePhysicalCellHypothesisFormationStatus: "completed" as const,
    sourcePhysicalCellTextEvidenceFormationSchemaVersion: 1, sourcePhysicalCellTextEvidenceFormationEngineName: "fixture-physical-cell-text-evidence-formation-engine", sourcePhysicalCellTextEvidenceFormationEngineVersion: "fixture-physical-cell-text-evidence-formation-engine-v1",
    sourcePhysicalCellTextEvidenceFormationProfileId: "fixture-physical-cell-text-evidence-formation-profile", sourcePhysicalCellTextEvidenceFormationProfileVersion: 1,
    sourcePhysicalCellTextEvidenceFormationContextFingerprintVersion: "fixture-physical-cell-text-evidence-formation-fingerprint-v1", sourcePhysicalCellTextEvidenceFormationContextFingerprint: "fixture-physical-cell-text-evidence-formation-fingerprint",
    sourcePhysicalCellTextEvidenceFormationStatus: "completed" as const,
  };
  const identityFingerprint = recomputePageLocalNeutralStructuredEvidenceFormationIdentityFingerprint(shellWithoutFingerprint as BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult);
  const metrics = computeGlobalMetricsFor(groups, technicalProblems);
  const content = { status, groups, technicalProblems, metrics, limitations: G2_LIMITATIONS };
  return {
    ...shellWithoutFingerprint,
    identityFingerprint,
    resultFingerprint: computeResultFingerprint(identityFingerprint, content),
    status, groups, technicalProblems, metrics, limitations: G2_LIMITATIONS,
  };
}

function computeGlobalMetricsFor(groups: ReadonlyArray<NeutralDocumentGroup>, technicalProblems: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem>) {
  const sum = (selector: (metrics: NeutralDocumentGroup["metrics"]) => number) => groups.reduce((total, group) => total + selector(group.metrics), 0);
  return {
    receivedGroupCount: groups.length,
    structuredGroupCount: groups.filter((group) => group.status === "structured").length,
    structuredWithProblemsGroupCount: groups.filter((group) => group.status === "structured_with_problems").length,
    partiallyStructuredGroupCount: groups.filter((group) => group.status === "partially_structured").length,
    withoutNeutralStructureGroupCount: groups.filter((group) => group.status === "without_neutral_structure").length,
    upstreamNotProcessableGroupCount: groups.filter((group) => group.status === "upstream_not_processable").length,
    failedGroupCount: groups.filter((group) => group.status === "failed").length,
    candidatePageCount: sum((m) => m.totalPageCount),
    candidateRegionCount: sum((m) => m.totalRegionCount),
    documentLineCount: sum((m) => m.documentLineCount),
    physicalSegmentPreservedCount: sum((m) => m.physicalSegmentPreservedCount),
    positionCount: sum((m) => m.positionCount),
    emptyPositionCount: sum((m) => m.emptyPositionCount),
    cellStructuredPositionCount: sum((m) => m.cellStructuredPositionCount),
    ambiguousPositionCount: sum((m) => m.ambiguousPositionCount),
    technicalFailurePositionCount: sum((m) => m.technicalFailurePositionCount),
    documentCellCount: sum((m) => m.documentCellCount),
    cellStructuredCount: sum((m) => m.cellStructuredCount),
    cellStructuredWithTextProblemsCount: sum((m) => m.cellStructuredWithTextProblemsCount),
    cellStructuredWithoutResolvedTextCount: sum((m) => m.cellStructuredWithoutResolvedTextCount),
    cellFailedCount: sum((m) => m.cellFailedCount),
    fragmentPreservedCount: sum((m) => m.fragmentPreservedCount),
    technicalProblemCount: technicalProblems.length + sum((m) => m.technicalProblemCount),
  };
}
