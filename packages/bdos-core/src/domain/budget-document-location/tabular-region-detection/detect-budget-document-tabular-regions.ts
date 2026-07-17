import type { ReconstructedBudgetDocumentGroup, ReconstructedBudgetDocumentPage } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import {
  BUDGET_DOCUMENT_TABULAR_REGION_DETECTOR_NAME,
  BUDGET_DOCUMENT_TABULAR_REGION_DETECTOR_VERSION,
  BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_SCHEMA_VERSION,
  TABULAR_REGION_DETECTION_CONTEXT_FINGERPRINT_VERSION,
} from "./budget-document-tabular-region-detection.types";
import type {
  BudgetDocumentTabularRegionDetectionInput,
  BudgetDocumentTabularRegionDetectionResult,
  GlobalTabularRegionDetectionMetrics,
  GroupTabularRegionDetectionMetrics,
  PageTabularRegionDetectionMetrics,
  RecurrentVerticalAlignment,
  TabularRegionCandidate,
  TabularRegionDetectionGroup,
  TabularRegionDetectionGroupStatus,
  TabularRegionDetectionLimitationCode,
  TabularRegionDetectionPage,
  TabularRegionDetectionPageStatus,
  TabularRegionDetectionStatus,
  TabularRegionDetectionTechnicalProblem,
  TabularRegionLineDisposition,
} from "./budget-document-tabular-region-detection.types";
import { validateTabularRegionDetectionInput } from "./tabular-region-detection-input-validation";
import { BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1 } from "./tabular-region-detection-profile";
import {
  buildTabularRegionDetectionIdentityFingerprintInput,
  computeTabularRegionDetectionContentFingerprint,
  computeTabularRegionDetectionIdentityFingerprint,
} from "./tabular-region-detection-context-fingerprint";
import { computeAlignmentKey, computeGroupProcessedKey, computePageProcessedKey, computeRegionKey } from "./tabular-region-detection-keys";
import { createTabularRegionDetectionTechnicalProblem } from "./tabular-region-detection-technical-problem";
import {
  canonicalizeTabularRegionDetectionOutputGeometry,
  canonicalizeTabularRegionDetectionOutputGeometryPoints,
  canonicalizeTabularRegionOutputGeometryBounds,
} from "./tabular-region-detection-output-geometry-canonicalization";
import type { AlignmentCandidateSegment, VerticalAlignmentDraft } from "./vertical-alignment-observation";
import { VERTICAL_ALIGNMENT_OBSERVATION_RULE_ID, VERTICAL_ALIGNMENT_OBSERVATION_RULE_VERSION, buildAlignmentCandidateSegments, observeVerticalAlignments } from "./vertical-alignment-observation";
import type { TabularRegionFormationWindow } from "./tabular-region-formation";
import { TABULAR_REGION_FORMATION_RULE_ID, TABULAR_REGION_FORMATION_RULE_VERSION, formTabularRegionCandidateWindows } from "./tabular-region-formation";

const PROFILE = BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1;

/**
 * Seam de injeção interno — exclusivamente para testes exercitarem, uma
 * fase por vez, a falha de observação de alinhamentos ou de formação de
 * regiões de forma controlada e direta (mesmo padrão de
 * `StructureReconstructionDependencies` na Sprint anterior). Nunca parte
 * da API pública: não exportado por nenhum barrel. `detectBudgetDocumentTabularRegions`
 * — a única função pública — não aceita nenhum parâmetro de dependências.
 */
export interface TabularRegionDetectionDependencies {
  readonly observeAlignments: typeof observeVerticalAlignments;
  readonly formRegions: typeof formTabularRegionCandidateWindows;
}

const DEFAULT_TABULAR_REGION_DETECTION_DEPENDENCIES: TabularRegionDetectionDependencies = {
  observeAlignments: observeVerticalAlignments,
  formRegions: formTabularRegionCandidateWindows,
};

const LIMITATIONS: ReadonlyArray<TabularRegionDetectionLimitationCode> = [
  "candidate_region_is_not_a_confirmed_table",
  "recurrent_alignment_is_not_a_column",
  "no_physical_column_created",
  "no_cell_created",
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
  "unresolved_structures_remain_explicit",
  "real_document_out_of_scope",
  "no_commercial_readiness_claim",
];

/** Guarda de exaustividade: uma variante futura de `TabularRegionLineDisposition` sem `case` correspondente vira erro de compilação, nunca desaparece silenciosamente da contagem. */
function assertUnreachableDisposition(value: never): never {
  throw new Error(`Disposição de linha não tratada: ${JSON.stringify(value)}`);
}

function alignmentSortKey(alignment: RecurrentVerticalAlignment): [number, number, string] {
  const typeIndex = PROFILE.alignmentTypePriorityOrder.indexOf(alignment.alignmentType);
  return [typeIndex, alignment.canonicalPositionPoints, alignment.alignmentKey];
}

function buildAlignments(
  pageProcessedKey: string,
  pageNumber: number,
  drafts: ReadonlyArray<VerticalAlignmentDraft>,
): ReadonlyArray<RecurrentVerticalAlignment> {
  const built = drafts.map((draft) => {
    const orderedSegmentKeys = draft.members.map((member) => member.segmentKey);
    return {
      alignmentKey: computeAlignmentKey(pageProcessedKey, draft.alignmentType, orderedSegmentKeys),
      pageNumber,
      alignmentType: draft.alignmentType,
      canonicalPositionPoints: canonicalizeTabularRegionDetectionOutputGeometry(draft.canonicalPositionPoints),
      lineKeys: draft.members.map((member) => member.lineKey),
      segmentKeys: orderedSegmentKeys,
      observedPositionsPoints: canonicalizeTabularRegionDetectionOutputGeometryPoints(draft.members.map((member) => member.positionPoints)),
      formationRuleId: VERTICAL_ALIGNMENT_OBSERVATION_RULE_ID,
      formationRuleVersion: VERTICAL_ALIGNMENT_OBSERVATION_RULE_VERSION,
      profileId: PROFILE.profileId,
      profileVersion: PROFILE.profileVersion,
    };
  });
  return [...built].sort((a, b) => {
    const [aType, aPos, aKey] = alignmentSortKey(a);
    const [bType, bPos, bKey] = alignmentSortKey(b);
    if (aType !== bType) return aType - bType;
    if (aPos !== bPos) return aPos - bPos;
    return aKey.localeCompare(bKey);
  });
}

interface RegionBoundsSource {
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
}

function buildRegion(
  regionKey: string,
  pageNumber: number,
  order: number,
  lineKeys: ReadonlyArray<string>,
  supportingAlignmentKeys: ReadonlyArray<string>,
  memberLines: ReadonlyArray<RegionBoundsSource>,
): TabularRegionCandidate {
  const left = Math.min(...memberLines.map((line) => line.leftPoints));
  const top = Math.min(...memberLines.map((line) => line.topPoints));
  const right = Math.max(...memberLines.map((line) => line.rightPoints));
  const bottom = Math.max(...memberLines.map((line) => line.bottomPoints));
  const canonicalBounds = canonicalizeTabularRegionOutputGeometryBounds({
    leftPoints: left,
    topPoints: top,
    rightPoints: right,
    bottomPoints: bottom,
    widthPoints: right - left,
    heightPoints: bottom - top,
    centerXPoints: (left + right) / 2,
    centerYPoints: (top + bottom) / 2,
  });
  return {
    regionKey,
    pageNumber,
    order,
    lineKeys,
    supportingAlignmentKeys,
    ...canonicalBounds,
    formationRuleId: TABULAR_REGION_FORMATION_RULE_ID,
    formationRuleVersion: TABULAR_REGION_FORMATION_RULE_VERSION,
    profileId: PROFILE.profileId,
    profileVersion: PROFILE.profileVersion,
  };
}

interface PageDetectionOutcome {
  readonly page: TabularRegionDetectionPage;
}

function buildFailedDetectionPage(
  physicalPage: ReconstructedBudgetDocumentPage,
  pageProcessedKey: string,
  groupKey: string,
  failedPhase: "alignment_detection" | "region_formation",
  problemCode: "vertical_alignment_detection_failed" | "tabular_region_formation_failed",
): PageDetectionOutcome {
  const dispositions: TabularRegionLineDisposition[] = physicalPage.lines
    .slice()
    .sort((a, b) => a.verticalOrder - b.verticalOrder)
    .map((line) => ({ status: "unresolved_tabular_region_detection_failed" as const, lineKey: line.lineKey, failedPhase }));
  return {
    page: {
      pageReconstructionKey: pageProcessedKey,
      pageNumber: physicalPage.pageNumber,
      status: "not_detectable",
      alignments: [],
      regions: [],
      lineDispositions: dispositions,
      technicalProblems: [createTabularRegionDetectionTechnicalProblem(problemCode, failedPhase, groupKey, physicalPage.pageNumber)],
      metrics: computePageMetrics(dispositions, 0, 0),
      profileId: PROFILE.profileId,
      profileVersion: PROFILE.profileVersion,
    },
  };
}

function detectPage(
  physicalPage: ReconstructedBudgetDocumentPage,
  groupProcessedKey: string,
  groupKey: string,
  dependencies: TabularRegionDetectionDependencies,
): PageDetectionOutcome {
  const pageProcessedKey = computePageProcessedKey(groupProcessedKey, physicalPage.pageNumber);

  if (physicalPage.status === "not_reconstructable") {
    return {
      page: {
        pageReconstructionKey: pageProcessedKey,
        pageNumber: physicalPage.pageNumber,
        status: "not_detectable",
        alignments: [],
        regions: [],
        lineDispositions: [],
        technicalProblems: [createTabularRegionDetectionTechnicalProblem("candidate_page_not_reconstructable", "candidate_page_processing", groupKey, physicalPage.pageNumber)],
        metrics: computePageMetrics([], 0, 0),
        profileId: PROFILE.profileId,
        profileVersion: PROFILE.profileVersion,
      },
    };
  }

  const candidateSegments: ReadonlyArray<AlignmentCandidateSegment> = buildAlignmentCandidateSegments(physicalPage.lines, physicalPage.segments);

  let alignmentDrafts: ReadonlyArray<VerticalAlignmentDraft>;
  try {
    alignmentDrafts = dependencies.observeAlignments(candidateSegments, PROFILE);
  } catch {
    return buildFailedDetectionPage(physicalPage, pageProcessedKey, groupKey, "alignment_detection", "vertical_alignment_detection_failed");
  }

  const alignments = buildAlignments(pageProcessedKey, physicalPage.pageNumber, alignmentDrafts);

  let windows: ReadonlyArray<TabularRegionFormationWindow>;
  try {
    windows = dependencies.formRegions(
      physicalPage.lines.map((line) => ({ lineKey: line.lineKey, verticalOrder: line.verticalOrder })),
      alignmentDrafts.map((draft) => ({
        alignmentKey: computeAlignmentKey(pageProcessedKey, draft.alignmentType, draft.members.map((member) => member.segmentKey)),
        lineKeys: draft.members.map((member) => member.lineKey),
      })),
      PROFILE,
    );
  } catch {
    return buildFailedDetectionPage(physicalPage, pageProcessedKey, groupKey, "region_formation", "tabular_region_formation_failed");
  }

  const lineByKey = new Map(physicalPage.lines.map((line) => [line.lineKey, line]));
  const windowsWithKeys = windows.map((window) => ({ window, regionKey: computeRegionKey(pageProcessedKey, window.lineKeys) }));

  const confirmedWindows = windowsWithKeys.filter((entry) => !entry.window.conflicted);
  const conflictedWindows = windowsWithKeys.filter((entry) => entry.window.conflicted);
  const hasOverlapConflict = conflictedWindows.length > 0;

  const orderedConfirmed = [...confirmedWindows].sort((a, b) => {
    const aFirst = lineByKey.get(a.window.lineKeys[0])!.verticalOrder;
    const bFirst = lineByKey.get(b.window.lineKeys[0])!.verticalOrder;
    return aFirst - bFirst;
  });

  const regions = orderedConfirmed.map((entry, index) =>
    buildRegion(
      entry.regionKey,
      physicalPage.pageNumber,
      index + 1,
      entry.window.lineKeys,
      entry.window.supportingAlignmentKeys,
      entry.window.lineKeys.map((lineKey) => lineByKey.get(lineKey)!),
    ),
  );

  const includedLineToRegionKey = new Map<string, string>();
  confirmedWindows.forEach((entry) => {
    entry.window.lineKeys.forEach((lineKey) => includedLineToRegionKey.set(lineKey, entry.regionKey));
  });

  const ambiguousLineToConflictingKeys = new Map<string, string[]>();
  conflictedWindows.forEach((entry) => {
    entry.window.lineKeys.forEach((lineKey) => {
      const existing = ambiguousLineToConflictingKeys.get(lineKey) ?? [];
      existing.push(entry.regionKey);
      ambiguousLineToConflictingKeys.set(lineKey, existing);
    });
  });

  const orderedLines = [...physicalPage.lines].sort((a, b) => a.verticalOrder - b.verticalOrder);
  const dispositions: TabularRegionLineDisposition[] = orderedLines.map((line) => {
    const ambiguousKeys = ambiguousLineToConflictingKeys.get(line.lineKey);
    if (ambiguousKeys !== undefined) {
      return { status: "unresolved_tabular_region_ambiguity", lineKey: line.lineKey, conflictingCandidateRegionKeys: [...ambiguousKeys].sort() };
    }
    const regionKey = includedLineToRegionKey.get(line.lineKey);
    if (regionKey !== undefined) {
      return { status: "included_in_candidate_region", lineKey: line.lineKey, regionKey };
    }
    return { status: "not_in_tabular_region", lineKey: line.lineKey };
  });

  const technicalProblems: TabularRegionDetectionTechnicalProblem[] = [];
  if (physicalPage.status === "reconstructed_with_problems") {
    technicalProblems.push(createTabularRegionDetectionTechnicalProblem("candidate_page_has_unresolved_structure", "candidate_page_processing", groupKey, physicalPage.pageNumber));
  }
  if (hasOverlapConflict) {
    technicalProblems.push(createTabularRegionDetectionTechnicalProblem("tabular_region_overlap_detected", "region_formation", groupKey, physicalPage.pageNumber));
  }

  const metrics = computePageMetrics(dispositions, alignments.length, regions.length);
  const conservationHolds =
    metrics.includedInCandidateRegionLineCount + metrics.notInTabularRegionLineCount + metrics.unresolvedAmbiguityLineCount + metrics.unresolvedDetectionFailedLineCount === metrics.totalLineCount;
  if (!conservationHolds) {
    return buildFailedDetectionPage(physicalPage, pageProcessedKey, groupKey, "region_formation", "tabular_region_formation_failed");
  }

  const hasAmbiguity = metrics.unresolvedAmbiguityLineCount > 0;
  const hasProblems = hasAmbiguity || hasOverlapConflict || physicalPage.status === "reconstructed_with_problems";

  let status: TabularRegionDetectionPageStatus;
  if (regions.length === 0 && !hasAmbiguity) {
    status = "no_candidate_region";
  } else if (hasProblems) {
    status = "detected_with_problems";
  } else {
    status = "detected";
  }

  return {
    page: {
      pageReconstructionKey: pageProcessedKey,
      pageNumber: physicalPage.pageNumber,
      status,
      alignments,
      regions,
      lineDispositions: dispositions,
      technicalProblems,
      metrics,
      profileId: PROFILE.profileId,
      profileVersion: PROFILE.profileVersion,
    },
  };
}

function computePageMetrics(
  dispositions: ReadonlyArray<TabularRegionLineDisposition>,
  alignmentCount: number,
  regionCount: number,
): PageTabularRegionDetectionMetrics {
  const counters = { included: 0, notIn: 0, ambiguous: 0, failed: 0 };
  dispositions.forEach((disposition) => {
    switch (disposition.status) {
      case "included_in_candidate_region":
        counters.included += 1;
        break;
      case "not_in_tabular_region":
        counters.notIn += 1;
        break;
      case "unresolved_tabular_region_ambiguity":
        counters.ambiguous += 1;
        break;
      case "unresolved_tabular_region_detection_failed":
        counters.failed += 1;
        break;
      default:
        return assertUnreachableDisposition(disposition);
    }
  });
  return {
    totalLineCount: dispositions.length,
    includedInCandidateRegionLineCount: counters.included,
    notInTabularRegionLineCount: counters.notIn,
    unresolvedAmbiguityLineCount: counters.ambiguous,
    unresolvedDetectionFailedLineCount: counters.failed,
    alignmentCount,
    regionCount,
  };
}

function computeGroupStatus(pages: ReadonlyArray<TabularRegionDetectionPage>): TabularRegionDetectionGroupStatus {
  if (pages.every((page) => page.status === "not_detectable")) {
    return "not_detectable";
  }
  if (pages.every((page) => page.status === "no_candidate_region")) {
    return "no_candidate_region";
  }
  if (pages.every((page) => page.status === "detected")) {
    return "detected";
  }
  return "detected_with_problems";
}

function computeGroupMetrics(pages: ReadonlyArray<TabularRegionDetectionPage>): GroupTabularRegionDetectionMetrics {
  return {
    totalPageCount: pages.length,
    detectedPageCount: pages.filter((p) => p.status === "detected").length,
    detectedWithProblemsPageCount: pages.filter((p) => p.status === "detected_with_problems").length,
    noCandidateRegionPageCount: pages.filter((p) => p.status === "no_candidate_region").length,
    notDetectablePageCount: pages.filter((p) => p.status === "not_detectable").length,
    lineCount: pages.reduce((sum, p) => sum + p.metrics.totalLineCount, 0),
    alignmentCount: pages.reduce((sum, p) => sum + p.alignments.length, 0),
    regionCount: pages.reduce((sum, p) => sum + p.regions.length, 0),
  };
}

function detectGroup(
  sourceGroup: ReconstructedBudgetDocumentGroup,
  identityFingerprint: string,
  dependencies: TabularRegionDetectionDependencies,
): TabularRegionDetectionGroup {
  const groupProcessedKey = computeGroupProcessedKey(identityFingerprint, sourceGroup.groupReconstructionKey);
  const orderedPages = [...sourceGroup.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const pages = orderedPages.map((page) => detectPage(page, groupProcessedKey, sourceGroup.groupReconstructionKey, dependencies).page);

  return {
    groupReconstructionKey: groupProcessedKey,
    sourceCandidateGroupKey: sourceGroup.sourceCandidateGroupKey,
    status: computeGroupStatus(pages),
    pageKeys: pages.map((p) => p.pageReconstructionKey),
    pages,
    technicalProblems: pages.flatMap((p) => p.technicalProblems),
    metrics: computeGroupMetrics(pages),
  };
}

function computeGlobalMetrics(groups: ReadonlyArray<TabularRegionDetectionGroup>): GlobalTabularRegionDetectionMetrics {
  return {
    receivedGroupCount: groups.length,
    detectedGroupCount: groups.filter((g) => g.status === "detected").length,
    detectedWithProblemsGroupCount: groups.filter((g) => g.status === "detected_with_problems").length,
    noCandidateRegionGroupCount: groups.filter((g) => g.status === "no_candidate_region").length,
    notDetectableGroupCount: groups.filter((g) => g.status === "not_detectable").length,
    candidatePageCount: groups.reduce((sum, g) => sum + g.pages.length, 0),
    lineCount: groups.reduce((sum, g) => sum + g.metrics.lineCount, 0),
    alignmentCount: groups.reduce((sum, g) => sum + g.metrics.alignmentCount, 0),
    regionCount: groups.reduce((sum, g) => sum + g.metrics.regionCount, 0),
  };
}

function buildResult(
  structureReconstruction: BudgetDocumentTabularRegionDetectionInput["structureReconstruction"],
  identityFingerprint: string,
  status: TabularRegionDetectionStatus,
  groups: ReadonlyArray<TabularRegionDetectionGroup>,
  technicalProblems: ReadonlyArray<TabularRegionDetectionTechnicalProblem>,
): BudgetDocumentTabularRegionDetectionResult {
  const detectionContextFingerprint = computeTabularRegionDetectionContentFingerprint(identityFingerprint, groups);
  return {
    schemaVersion: BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_SCHEMA_VERSION,
    detectorName: BUDGET_DOCUMENT_TABULAR_REGION_DETECTOR_NAME,
    detectorVersion: BUDGET_DOCUMENT_TABULAR_REGION_DETECTOR_VERSION,
    detectionProfileId: PROFILE.profileId,
    detectionProfileVersion: PROFILE.profileVersion,
    detectionContextFingerprintVersion: TABULAR_REGION_DETECTION_CONTEXT_FINGERPRINT_VERSION,
    detectionContextFingerprint,
    sourceByteHash: structureReconstruction.sourceByteHash,
    sourceReconstructionSchemaVersion: structureReconstruction.schemaVersion,
    sourceReconstructorName: structureReconstruction.reconstructorName,
    sourceReconstructorVersion: structureReconstruction.reconstructorVersion,
    sourceReconstructionProfileId: structureReconstruction.reconstructionProfileId,
    sourceReconstructionProfileVersion: structureReconstruction.reconstructionProfileVersion,
    sourceReconstructionContextFingerprintVersion: structureReconstruction.reconstructionContextFingerprintVersion,
    sourceReconstructionContextFingerprint: structureReconstruction.reconstructionContextFingerprint,
    status,
    groups,
    technicalProblems,
    metrics: computeGlobalMetrics(groups),
    limitations: LIMITATIONS,
  };
}

/**
 * Detecta regiões candidatas a estrutura tabular, deterministicamente, a
 * partir da reconstrução estrutural física já produzida (Sprint
 * 21.4A.2.f.2a) — nunca reclassifica páginas, nunca reconstrói linhas ou
 * segmentos, nunca interpreta significado econômico. Determinístico: mesma
 * entrada e mesmas versões produzem resultado JSON-equivalente. Sempre usa
 * as duas funções puras reais de observação de alinhamento e formação de
 * região — esta é a única função pública, e ela não aceita nenhum
 * parâmetro de dependências.
 */
export function detectBudgetDocumentTabularRegions(
  input: BudgetDocumentTabularRegionDetectionInput,
): BudgetDocumentTabularRegionDetectionResult {
  return detectBudgetDocumentTabularRegionsWithDependencies(input, DEFAULT_TABULAR_REGION_DETECTION_DEPENDENCIES);
}

/**
 * Mesma detecção, com as funções de observação de alinhamento e formação
 * de região injetáveis — exclusivamente para testes provarem o
 * comportamento de cada fase de falha técnica de forma direta e
 * controlada. Não exportada por nenhum barrel público; produção nunca a
 * chama — apenas `detectBudgetDocumentTabularRegions`.
 */
export function detectBudgetDocumentTabularRegionsWithDependencies(
  input: BudgetDocumentTabularRegionDetectionInput,
  dependencies: TabularRegionDetectionDependencies,
): BudgetDocumentTabularRegionDetectionResult {
  const { structureReconstruction } = input;

  const identityFingerprint = computeTabularRegionDetectionIdentityFingerprint(
    buildTabularRegionDetectionIdentityFingerprintInput(
      structureReconstruction,
      BUDGET_DOCUMENT_TABULAR_REGION_DETECTOR_NAME,
      BUDGET_DOCUMENT_TABULAR_REGION_DETECTOR_VERSION,
      PROFILE.profileId,
      PROFILE.profileVersion,
      VERTICAL_ALIGNMENT_OBSERVATION_RULE_ID,
      VERTICAL_ALIGNMENT_OBSERVATION_RULE_VERSION,
      TABULAR_REGION_FORMATION_RULE_ID,
      TABULAR_REGION_FORMATION_RULE_VERSION,
      PROFILE.geometryCanonicalizationVersion,
    ),
  );

  const validation = validateTabularRegionDetectionInput(input);
  if (validation.kind !== "valid") {
    return buildResult(structureReconstruction, identityFingerprint, "failed", [], validation.problems);
  }

  try {
    const orderedGroups = [...structureReconstruction.groups].sort((a, b) => a.startPageNumber - b.startPageNumber);
    const groups = orderedGroups.map((group) => detectGroup(group, identityFingerprint, dependencies));

    const status: TabularRegionDetectionStatus = groups.every((g) => g.status === "detected" || g.status === "no_candidate_region")
      ? "completed"
      : "completed_with_problems";
    return buildResult(structureReconstruction, identityFingerprint, status, groups, []);
  } catch {
    return buildResult(structureReconstruction, identityFingerprint, "failed", [], [
      createTabularRegionDetectionTechnicalProblem("tabular_region_detection_failed", "candidate_group_processing"),
    ]);
  }
}
