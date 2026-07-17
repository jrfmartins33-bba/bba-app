import type { PhysicalDocumentPage, PhysicalDocumentTextItemLayoutGeometry } from "../physical-document-read.types";
import type { BudgetPageCandidateGroup, BudgetPageCandidateType, BudgetPageLocationReasonCode } from "../page-location/budget-page-location.types";
import {
  BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_SCHEMA_VERSION,
  BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTOR_NAME,
  BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTOR_VERSION,
  STRUCTURE_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION,
} from "./budget-document-structure-reconstruction.types";
import type {
  BudgetDocumentStructureReconstructionInput,
  BudgetDocumentStructureReconstructionResult,
  GlobalStructureReconstructionMetrics,
  GroupStructureReconstructionMetrics,
  PageStructureReconstructionMetrics,
  ReconstructedBudgetDocumentGroup,
  ReconstructedBudgetDocumentPage,
  ReconstructedGroupStatus,
  ReconstructedPageStatus,
  ReconstructedPhysicalLine,
  ReconstructedHorizontalSegment,
  ReconstructedPhysicalTextBlock,
  SourceTextItemReconstructionOutcome,
  StructureReconstructionLimitationCode,
  StructureReconstructionStatus,
  StructureReconstructionTechnicalProblem,
} from "./budget-document-structure-reconstruction.types";
import { validateStructureReconstructionInput } from "./structure-reconstruction-input-validation";
import { BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1 } from "./structure-reconstruction-profile";
import {
  buildStructureReconstructionContextFingerprintInput,
  computeStructureReconstructionContextFingerprint,
} from "./structure-reconstruction-context-fingerprint";
import {
  computeBlockKey,
  computeGroupReconstructionKey,
  computeLineKey,
  computePageReconstructionKey,
  computeSegmentKey,
} from "./structure-reconstruction-keys";
import { createStructureReconstructionTechnicalProblem } from "./structure-reconstruction-technical-problem";
import { canonicalizeOutputGaps, canonicalizeOutputGeometryBounds } from "./structure-reconstruction-output-geometry-canonicalization";
import type { SourceItemEligibility } from "./source-item-reconstruction-outcomes";
import { classifySourceTextItem } from "./source-item-reconstruction-outcomes";
import { PHYSICAL_LINE_FORMATION_RULE_ID, PHYSICAL_LINE_FORMATION_RULE_VERSION, reconstructPhysicalLines } from "./physical-line-reconstruction";
import type { ReconstructedLineDraft } from "./physical-line-reconstruction";
import {
  HORIZONTAL_SEGMENT_FORMATION_RULE_ID,
  HORIZONTAL_SEGMENT_FORMATION_RULE_VERSION,
  reconstructHorizontalSegments,
} from "./horizontal-segment-reconstruction";
import type { ReconstructedSegmentDraft } from "./horizontal-segment-reconstruction";
import type { BlockReconstructionSegmentInput } from "./physical-text-block-reconstruction";
import { PHYSICAL_BLOCK_FORMATION_RULE_ID, PHYSICAL_BLOCK_FORMATION_RULE_VERSION, reconstructPhysicalTextBlocks } from "./physical-text-block-reconstruction";

const PROFILE = BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1;

const LIMITATIONS: ReadonlyArray<StructureReconstructionLimitationCode> = [
  "physical_line_is_not_a_budget_line",
  "horizontal_segment_is_not_a_column",
  "physical_block_is_not_a_table",
  "no_textual_semantics_applied",
  "no_header_identified",
  "no_footer_identified",
  "no_cell_created",
  "no_service_code_read",
  "no_unit_read",
  "no_quantity_read",
  "no_price_read",
  "no_total_read",
  "no_economic_bdi_interpreted",
  "no_economic_group_created",
  "no_budget_version_created",
  "cross_page_continuity_is_future_work",
  "unresolved_items_remain_explicit",
  "outside_page_items_excluded_but_audited",
  "rtl_ttb_skew_shear_are_source_limitations",
  "no_commercial_readiness_claim",
  "real_document_out_of_scope",
];

function assertUnreachableEligibility(value: never): never {
  throw new Error(`reconstructBudgetDocumentStructure: unhandled eligibility kind: ${JSON.stringify(value)}`);
}

interface PageReconstructionOutcome {
  readonly page: ReconstructedBudgetDocumentPage;
}

/** Disposição final para os itens não elegíveis (mapeamento 1:1 direto, sem falha estrutural possível nestas variantes). */
function nonEligibleOutcome(
  eligibility: Exclude<SourceItemEligibility, { kind: "eligible" }>,
): SourceTextItemReconstructionOutcome {
  if (
    eligibility.kind === "ignored_whitespace_only" ||
    eligibility.kind === "excluded_outside_page" ||
    eligibility.kind === "unresolved_source_geometry_missing" ||
    eligibility.kind === "unresolved_source_geometry_invalid" ||
    eligibility.kind === "unresolved_source_orientation_unsupported" ||
    eligibility.kind === "unresolved_source_geometry_normalization_failed"
  ) {
    return { status: eligibility.kind, sourceTextItemIndex: eligibility.sourceTextItemIndex };
  }
  return assertUnreachableEligibility(eligibility);
}

/** Página sem nenhum item elegível: `not_reconstructable`, nunca uma falha estrutural (não há estrutura a reconstruir). */
function buildNoEligibleItemsPage(
  physicalPage: PhysicalDocumentPage,
  candidateType: BudgetPageCandidateType,
  sourceDecisionReasonCode: BudgetPageLocationReasonCode,
  pageReconstructionKey: string,
  groupKey: string,
  eligibilities: ReadonlyArray<SourceItemEligibility>,
): PageReconstructionOutcome {
  const noText = physicalPage.textItems.length === 0 || physicalPage.extractionAvailability !== "text_available";
  const technicalProblems = [
    createStructureReconstructionTechnicalProblem(
      noText ? "candidate_page_text_unavailable" : "candidate_page_has_no_eligible_items",
      "candidate_page_processing",
      groupKey,
      physicalPage.pageNumber,
    ),
  ];
  const outcomes: SourceTextItemReconstructionOutcome[] = eligibilities.map((e) => nonEligibleOutcome(e as Exclude<SourceItemEligibility, { kind: "eligible" }>));

  return {
    page: {
      pageReconstructionKey,
      pageNumber: physicalPage.pageNumber,
      candidateType,
      sourceDecisionReasonCode,
      status: "not_reconstructable",
      sourceItemOutcomes: outcomes,
      lines: [],
      segments: [],
      blocks: [],
      technicalProblems,
      metrics: computePageMetrics(outcomes, 0, 0, 0),
      profileId: PROFILE.profileId,
      profileVersion: PROFILE.profileVersion,
    },
  };
}

/**
 * Página cuja falha ocorreu na reconstrução de linha ou de segmento
 * (auditoria pós-PR #69, §3): `not_reconstructable`, nenhuma estrutura
 * parcial inconsistente, e todo item elegível recebe
 * `unresolved_structure_reconstruction_failed` — nunca
 * `excluded_outside_page`, que descreveria uma observação geométrica que
 * nunca ocorreu.
 */
function buildStructureFailurePage(
  physicalPage: PhysicalDocumentPage,
  candidateType: BudgetPageCandidateType,
  sourceDecisionReasonCode: BudgetPageLocationReasonCode,
  pageReconstructionKey: string,
  groupKey: string,
  eligibilities: ReadonlyArray<SourceItemEligibility>,
  failedPhase: "line_reconstruction" | "segment_reconstruction",
): PageReconstructionOutcome {
  const technicalProblems = [
    createStructureReconstructionTechnicalProblem(
      failedPhase === "line_reconstruction" ? "physical_line_reconstruction_failed" : "horizontal_segment_reconstruction_failed",
      failedPhase,
      groupKey,
      physicalPage.pageNumber,
    ),
  ];
  const outcomes: SourceTextItemReconstructionOutcome[] = eligibilities.map((eligibility) =>
    eligibility.kind === "eligible"
      ? { status: "unresolved_structure_reconstruction_failed", sourceTextItemIndex: eligibility.sourceTextItemIndex, failedPhase }
      : nonEligibleOutcome(eligibility as Exclude<SourceItemEligibility, { kind: "eligible" }>),
  );

  return {
    page: {
      pageReconstructionKey,
      pageNumber: physicalPage.pageNumber,
      candidateType,
      sourceDecisionReasonCode,
      status: "not_reconstructable",
      sourceItemOutcomes: outcomes,
      lines: [],
      segments: [],
      blocks: [],
      technicalProblems,
      metrics: computePageMetrics(outcomes, 0, 0, 0),
      profileId: PROFILE.profileId,
      profileVersion: PROFILE.profileVersion,
    },
  };
}

function reconstructPage(
  physicalPage: PhysicalDocumentPage,
  candidateType: BudgetPageCandidateType,
  sourceDecisionReasonCode: BudgetPageLocationReasonCode,
  pageReconstructionKey: string,
  groupKey: string,
): PageReconstructionOutcome {
  const eligibilities: SourceItemEligibility[] = physicalPage.textItems.map(classifySourceTextItem);
  const geometryByIndex = new Map<number, PhysicalDocumentTextItemLayoutGeometry>();
  eligibilities.forEach((eligibility) => {
    if (eligibility.kind === "eligible") {
      geometryByIndex.set(eligibility.sourceTextItemIndex, eligibility.geometry);
    }
  });

  const eligibleItems = eligibilities.filter((e): e is Extract<SourceItemEligibility, { kind: "eligible" }> => e.kind === "eligible");

  if (eligibleItems.length === 0) {
    return buildNoEligibleItemsPage(physicalPage, candidateType, sourceDecisionReasonCode, pageReconstructionKey, groupKey, eligibilities);
  }

  // Fase 1: linhas. Falha aqui é fatal para a página inteira — nenhuma
  // estrutura parcial, nenhum item elegível pode ser declarado "fora da
  // página" por causa de uma falha de processamento (§3).
  let lineDrafts: ReadonlyArray<ReconstructedLineDraft>;
  try {
    lineDrafts = reconstructPhysicalLines(
      eligibleItems.map((item) => ({ sourceTextItemIndex: item.sourceTextItemIndex, geometry: item.geometry })),
      PROFILE,
    );
  } catch {
    return buildStructureFailurePage(physicalPage, candidateType, sourceDecisionReasonCode, pageReconstructionKey, groupKey, eligibilities, "line_reconstruction");
  }

  // Fase 2: segmentos, por linha. Se qualquer linha falhar, a página
  // inteira é `not_reconstructable` — nunca uma mistura de linhas com e
  // sem segmentos (§3).
  const segmentDraftsByLine = new Map<ReconstructedLineDraft, ReadonlyArray<ReconstructedSegmentDraft>>();
  for (const draft of lineDrafts) {
    try {
      segmentDraftsByLine.set(draft, reconstructHorizontalSegments(draft.sourceTextItemIndices, geometryByIndex, PROFILE));
    } catch {
      return buildStructureFailurePage(physicalPage, candidateType, sourceDecisionReasonCode, pageReconstructionKey, groupKey, eligibilities, "segment_reconstruction");
    }
  }

  // A partir daqui, linha e segmento tiveram sucesso: todo item elegível
  // terá exatamente uma chave de linha e de segmento, por construção.
  const lines: ReconstructedPhysicalLine[] = [];
  const segments: ReconstructedHorizontalSegment[] = [];
  const blockSegmentInputs: BlockReconstructionSegmentInput[] = [];
  const lineKeyBySourceIndex = new Map<number, string>();
  const segmentKeyBySourceIndex = new Map<number, string>();

  lineDrafts.forEach((draft) => {
    const lineKey = computeLineKey(pageReconstructionKey, draft.sourceTextItemIndices);
    draft.sourceTextItemIndices.forEach((index) => lineKeyBySourceIndex.set(index, lineKey));

    const segmentDrafts = segmentDraftsByLine.get(draft)!;
    const segmentKeys: string[] = [];

    segmentDrafts.forEach((segmentDraft) => {
      const segmentKey = computeSegmentKey(lineKey, segmentDraft.sourceTextItemIndices);
      segmentKeys.push(segmentKey);
      segmentDraft.sourceTextItemIndices.forEach((index) => segmentKeyBySourceIndex.set(index, segmentKey));

      const canonicalSegmentBounds = canonicalizeOutputGeometryBounds(segmentDraft);
      segments.push({
        segmentKey,
        lineKey,
        pageNumber: physicalPage.pageNumber,
        horizontalOrder: segmentDraft.horizontalOrder,
        leftPoints: canonicalSegmentBounds.leftPoints,
        topPoints: canonicalSegmentBounds.topPoints,
        rightPoints: canonicalSegmentBounds.rightPoints,
        bottomPoints: canonicalSegmentBounds.bottomPoints,
        widthPoints: canonicalSegmentBounds.widthPoints,
        heightPoints: canonicalSegmentBounds.heightPoints,
        centerXPoints: canonicalSegmentBounds.centerXPoints,
        centerYPoints: canonicalSegmentBounds.centerYPoints,
        sourceTextItemIndices: segmentDraft.sourceTextItemIndices,
        observedInternalGaps: canonicalizeOutputGaps(segmentDraft.observedInternalGaps),
        formationRuleId: HORIZONTAL_SEGMENT_FORMATION_RULE_ID,
        formationRuleVersion: HORIZONTAL_SEGMENT_FORMATION_RULE_VERSION,
        profileId: PROFILE.profileId,
        profileVersion: PROFILE.profileVersion,
      });
      blockSegmentInputs.push({
        segmentKey,
        lineKey,
        lineVerticalOrder: draft.verticalOrder,
        lineHeightPoints: draft.heightPoints,
        leftPoints: segmentDraft.leftPoints,
        topPoints: segmentDraft.topPoints,
        rightPoints: segmentDraft.rightPoints,
        bottomPoints: segmentDraft.bottomPoints,
        widthPoints: segmentDraft.widthPoints,
        heightPoints: segmentDraft.heightPoints,
        centerXPoints: segmentDraft.centerXPoints,
        centerYPoints: segmentDraft.centerYPoints,
      });
    });

    const canonicalLineBounds = canonicalizeOutputGeometryBounds(draft);
    lines.push({
      lineKey,
      pageNumber: physicalPage.pageNumber,
      verticalOrder: draft.verticalOrder,
      leftPoints: canonicalLineBounds.leftPoints,
      topPoints: canonicalLineBounds.topPoints,
      rightPoints: canonicalLineBounds.rightPoints,
      bottomPoints: canonicalLineBounds.bottomPoints,
      widthPoints: canonicalLineBounds.widthPoints,
      heightPoints: canonicalLineBounds.heightPoints,
      centerXPoints: canonicalLineBounds.centerXPoints,
      centerYPoints: canonicalLineBounds.centerYPoints,
      seedSourceTextItemIndex: draft.seedSourceTextItemIndex,
      sourceTextItemIndices: draft.sourceTextItemIndices,
      segmentKeys,
      formationRuleId: PHYSICAL_LINE_FORMATION_RULE_ID,
      formationRuleVersion: PHYSICAL_LINE_FORMATION_RULE_VERSION,
      profileId: PROFILE.profileId,
      profileVersion: PROFILE.profileVersion,
    });
  });

  // Fase 3: blocos. Falha aqui nunca é fatal — linhas e segmentos já
  // reconstruídos permanecem, itens permanecem `placed`, blocos ficam
  // vazios, página `reconstructed_with_problems` (§3).
  const technicalProblems: StructureReconstructionTechnicalProblem[] = [];
  let blocks: ReconstructedPhysicalTextBlock[] = [];
  try {
    const blockDrafts = reconstructPhysicalTextBlocks(blockSegmentInputs, PROFILE);
    blocks = blockDrafts.map((draft) => {
      const canonicalBlockBounds = canonicalizeOutputGeometryBounds(draft);
      return {
        blockKey: computeBlockKey(pageReconstructionKey, draft.segmentKeys),
        pageNumber: physicalPage.pageNumber,
        order: draft.order,
        lineKeys: draft.lineKeys,
        segmentKeys: draft.segmentKeys,
        leftPoints: canonicalBlockBounds.leftPoints,
        topPoints: canonicalBlockBounds.topPoints,
        rightPoints: canonicalBlockBounds.rightPoints,
        bottomPoints: canonicalBlockBounds.bottomPoints,
        widthPoints: canonicalBlockBounds.widthPoints,
        heightPoints: canonicalBlockBounds.heightPoints,
        centerXPoints: canonicalBlockBounds.centerXPoints,
        centerYPoints: canonicalBlockBounds.centerYPoints,
        formationRuleId: PHYSICAL_BLOCK_FORMATION_RULE_ID,
        formationRuleVersion: PHYSICAL_BLOCK_FORMATION_RULE_VERSION,
        profileId: PROFILE.profileId,
        profileVersion: PROFILE.profileVersion,
      };
    });
  } catch {
    technicalProblems.push(createStructureReconstructionTechnicalProblem("physical_block_reconstruction_failed", "block_reconstruction", groupKey, physicalPage.pageNumber));
    blocks = [];
  }

  const outcomes: SourceTextItemReconstructionOutcome[] = eligibilities.map((eligibility) => {
    if (eligibility.kind === "eligible") {
      const lineKey = lineKeyBySourceIndex.get(eligibility.sourceTextItemIndex)!;
      const segmentKey = segmentKeyBySourceIndex.get(eligibility.sourceTextItemIndex)!;
      return { status: "placed", sourceTextItemIndex: eligibility.sourceTextItemIndex, lineKey, segmentKey };
    }
    return nonEligibleOutcome(eligibility as Exclude<SourceItemEligibility, { kind: "eligible" }>);
  });

  const hasUnresolved = eligibilities.some((e) => e.kind.startsWith("unresolved_"));
  const hasOutside = eligibilities.some((e) => e.kind === "excluded_outside_page");
  const hasPartiallyOutside = eligibleItems.some((e) => e.geometry.pageBoundsRelation === "partially_outside");
  const hasBlockFailure = technicalProblems.length > 0;

  if (hasUnresolved) {
    technicalProblems.push(createStructureReconstructionTechnicalProblem("candidate_page_contains_unresolved_items", "candidate_page_processing", groupKey, physicalPage.pageNumber));
  }
  if (hasOutside) {
    technicalProblems.push(createStructureReconstructionTechnicalProblem("candidate_page_contains_outside_items", "candidate_page_processing", groupKey, physicalPage.pageNumber));
  }
  if (hasPartiallyOutside) {
    technicalProblems.push(createStructureReconstructionTechnicalProblem("candidate_page_contains_partially_outside_items", "candidate_page_processing", groupKey, physicalPage.pageNumber));
  }

  const status: ReconstructedPageStatus = hasUnresolved || hasOutside || hasPartiallyOutside || hasBlockFailure ? "reconstructed_with_problems" : "reconstructed";

  return {
    page: {
      pageReconstructionKey,
      pageNumber: physicalPage.pageNumber,
      candidateType,
      sourceDecisionReasonCode,
      status,
      sourceItemOutcomes: outcomes,
      lines,
      segments,
      blocks,
      technicalProblems,
      metrics: computePageMetrics(outcomes, lines.length, segments.length, blocks.length),
      profileId: PROFILE.profileId,
      profileVersion: PROFILE.profileVersion,
    },
  };
}

function computePageMetrics(
  outcomes: ReadonlyArray<SourceTextItemReconstructionOutcome>,
  lineCount: number,
  segmentCount: number,
  blockCount: number,
): PageStructureReconstructionMetrics {
  const counters = {
    placed: 0,
    ignoredWhitespaceOnly: 0,
    excludedOutsidePage: 0,
    unresolvedMissingGeometry: 0,
    unresolvedInvalidGeometry: 0,
    unresolvedUnsupportedOrientation: 0,
    unresolvedNormalizationFailed: 0,
    unresolvedStructureReconstructionFailed: 0,
  };
  outcomes.forEach((outcome) => {
    switch (outcome.status) {
      case "placed":
        counters.placed += 1;
        break;
      case "ignored_whitespace_only":
        counters.ignoredWhitespaceOnly += 1;
        break;
      case "excluded_outside_page":
        counters.excludedOutsidePage += 1;
        break;
      case "unresolved_source_geometry_missing":
        counters.unresolvedMissingGeometry += 1;
        break;
      case "unresolved_source_geometry_invalid":
        counters.unresolvedInvalidGeometry += 1;
        break;
      case "unresolved_source_orientation_unsupported":
        counters.unresolvedUnsupportedOrientation += 1;
        break;
      case "unresolved_source_geometry_normalization_failed":
        counters.unresolvedNormalizationFailed += 1;
        break;
      case "unresolved_structure_reconstruction_failed":
        counters.unresolvedStructureReconstructionFailed += 1;
        break;
    }
  });
  return {
    totalSourceTextItemCount: outcomes.length,
    placedTextItemCount: counters.placed,
    ignoredWhitespaceOnlyCount: counters.ignoredWhitespaceOnly,
    excludedOutsidePageCount: counters.excludedOutsidePage,
    unresolvedMissingGeometryCount: counters.unresolvedMissingGeometry,
    unresolvedInvalidGeometryCount: counters.unresolvedInvalidGeometry,
    unresolvedUnsupportedOrientationCount: counters.unresolvedUnsupportedOrientation,
    unresolvedNormalizationFailedCount: counters.unresolvedNormalizationFailed,
    unresolvedStructureReconstructionFailedCount: counters.unresolvedStructureReconstructionFailed,
    lineCount,
    segmentCount,
    blockCount,
  };
}

function computeGroupStatus(pages: ReadonlyArray<ReconstructedBudgetDocumentPage>): ReconstructedGroupStatus {
  if (pages.every((page) => page.status === "not_reconstructable")) {
    return "not_reconstructable";
  }
  if (pages.every((page) => page.status === "reconstructed")) {
    return "reconstructed";
  }
  return "reconstructed_with_problems";
}

function computeGroupMetrics(pages: ReadonlyArray<ReconstructedBudgetDocumentPage>): GroupStructureReconstructionMetrics {
  return {
    totalPageCount: pages.length,
    reconstructedPageCount: pages.filter((p) => p.status === "reconstructed").length,
    reconstructedWithProblemsPageCount: pages.filter((p) => p.status === "reconstructed_with_problems").length,
    notReconstructablePageCount: pages.filter((p) => p.status === "not_reconstructable").length,
    lineCount: pages.reduce((sum, p) => sum + p.lines.length, 0),
    segmentCount: pages.reduce((sum, p) => sum + p.segments.length, 0),
    blockCount: pages.reduce((sum, p) => sum + p.blocks.length, 0),
  };
}

function reconstructGroup(
  sourceGroup: BudgetPageCandidateGroup,
  physicalPagesByNumber: ReadonlyMap<number, PhysicalDocumentPage>,
  reasonCodeByPageNumber: ReadonlyMap<number, BudgetPageLocationReasonCode>,
  reconstructionContextFingerprint: string,
): ReconstructedBudgetDocumentGroup {
  const groupReconstructionKey = computeGroupReconstructionKey(reconstructionContextFingerprint, sourceGroup.groupKey);

  const pages = sourceGroup.members.map((member) => {
    const physicalPage = physicalPagesByNumber.get(member.pageNumber)!;
    const reasonCode = reasonCodeByPageNumber.get(member.pageNumber)!;
    const pageReconstructionKey = computePageReconstructionKey(groupReconstructionKey, member.pageNumber);
    return reconstructPage(physicalPage, member.candidateType, reasonCode, pageReconstructionKey, sourceGroup.groupKey).page;
  });

  return {
    sourceCandidateGroupKey: sourceGroup.groupKey,
    groupReconstructionKey,
    startPageNumber: sourceGroup.startPageNumber,
    endPageNumber: sourceGroup.endPageNumber,
    candidateTypesPresent: [...new Set(sourceGroup.members.map((m) => m.candidateType))],
    hasClosingPage: sourceGroup.members.some((m) => m.candidateType === "closing"),
    status: computeGroupStatus(pages),
    pageKeys: pages.map((p) => p.pageReconstructionKey),
    pages,
    technicalProblems: pages.flatMap((p) => p.technicalProblems),
    metrics: computeGroupMetrics(pages),
  };
}

function computeGlobalMetrics(groups: ReadonlyArray<ReconstructedBudgetDocumentGroup>): GlobalStructureReconstructionMetrics {
  return {
    receivedGroupCount: groups.length,
    reconstructedGroupCount: groups.filter((g) => g.status === "reconstructed").length,
    reconstructedWithProblemsGroupCount: groups.filter((g) => g.status === "reconstructed_with_problems").length,
    notReconstructableGroupCount: groups.filter((g) => g.status === "not_reconstructable").length,
    candidatePageCount: groups.reduce((sum, g) => sum + g.pages.length, 0),
    sourceTextItemCount: groups.reduce((sum, g) => sum + g.pages.reduce((pageSum, p) => pageSum + p.metrics.totalSourceTextItemCount, 0), 0),
    lineCount: groups.reduce((sum, g) => sum + g.metrics.lineCount, 0),
    segmentCount: groups.reduce((sum, g) => sum + g.metrics.segmentCount, 0),
    blockCount: groups.reduce((sum, g) => sum + g.metrics.blockCount, 0),
  };
}

function buildResult(
  physicalRead: BudgetDocumentStructureReconstructionInput["physicalRead"],
  pageLocation: BudgetDocumentStructureReconstructionInput["pageLocation"],
  reconstructionContextFingerprint: string,
  status: StructureReconstructionStatus,
  groups: ReadonlyArray<ReconstructedBudgetDocumentGroup>,
  technicalProblems: ReadonlyArray<StructureReconstructionTechnicalProblem>,
): BudgetDocumentStructureReconstructionResult {
  return {
    schemaVersion: BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_SCHEMA_VERSION,
    reconstructorName: BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTOR_NAME,
    reconstructorVersion: BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTOR_VERSION,
    reconstructionProfileId: PROFILE.profileId,
    reconstructionProfileVersion: PROFILE.profileVersion,
    reconstructionContextFingerprintVersion: STRUCTURE_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION,
    reconstructionContextFingerprint,
    sourceByteHash: physicalRead.sourceByteHash,
    physicalReadSchemaVersion: physicalRead.schemaVersion,
    physicalReaderName: physicalRead.readerName,
    physicalReaderVersion: physicalRead.readerVersion,
    physicalAdapterVersion: physicalRead.adapterVersion,
    physicalUnderlyingLibraryVersion: physicalRead.underlyingLibraryVersion,
    physicalTextItemCoordinateSpaceVersion: physicalRead.textItemCoordinateSpaceVersion,
    physicalTextItemGeometryProfileVersion: physicalRead.textItemGeometryProfileVersion,
    physicalGeometryContextFingerprintVersion: physicalRead.geometryContextFingerprintVersion,
    physicalGeometryContextFingerprint: physicalRead.geometryContextFingerprint,
    pageLocationSchemaVersion: pageLocation.schemaVersion,
    pageLocatorName: pageLocation.locatorName,
    pageLocatorVersion: pageLocation.locatorVersion,
    pageLocationDecisionRuleSetVersion: pageLocation.decisionRuleSetVersion,
    sourceObservationSchemaVersion: pageLocation.sourceObservationSchemaVersion,
    sourceObserverName: pageLocation.sourceObserverName,
    sourceObserverVersion: pageLocation.sourceObserverVersion,
    sourceObservationRuleSetVersion: pageLocation.sourceObservationRuleSetVersion,
    sourceCatalogVersion: pageLocation.sourceCatalogVersion,
    status,
    groups,
    technicalProblems,
    metrics: computeGlobalMetrics(groups),
    limitations: LIMITATIONS,
  };
}

/**
 * Reconstrói a estrutura física auditável (linhas, segmentos, blocos) dos
 * grupos candidatos já localizados — nunca reclassifica páginas, recalcula
 * sinais, recalcula grupos ou interpreta significado econômico (Sprint
 * 21.4A.2.f.1). Determinístico: mesma entrada e mesmas versões produzem
 * resultado JSON-equivalente.
 */
export function reconstructBudgetDocumentStructure(
  input: BudgetDocumentStructureReconstructionInput,
): BudgetDocumentStructureReconstructionResult {
  const { physicalRead, pageLocation } = input;

  const fingerprintInput = buildStructureReconstructionContextFingerprintInput(
    physicalRead,
    pageLocation,
    BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTOR_NAME,
    BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTOR_VERSION,
    PROFILE.profileId,
    PROFILE.profileVersion,
    PROFILE.geometryCanonicalizationVersion,
  );
  const reconstructionContextFingerprint = computeStructureReconstructionContextFingerprint(fingerprintInput);

  const validation = validateStructureReconstructionInput(input);
  if (validation.kind !== "valid") {
    return buildResult(physicalRead, pageLocation, reconstructionContextFingerprint, "failed", [], validation.problems);
  }

  try {
    const physicalPagesByNumber = new Map(physicalRead.pages.map((page) => [page.pageNumber, page]));
    const reasonCodeByPageNumber = new Map(pageLocation.pageDecisions.map((decision) => [decision.pageNumber, decision.reasonCode]));

    const groups = pageLocation.candidateGroups.map((sourceGroup) =>
      reconstructGroup(sourceGroup, physicalPagesByNumber, reasonCodeByPageNumber, reconstructionContextFingerprint),
    );

    const status: StructureReconstructionStatus = groups.every((g) => g.status === "reconstructed") ? "completed" : "completed_with_problems";
    return buildResult(physicalRead, pageLocation, reconstructionContextFingerprint, status, groups, []);
  } catch {
    return buildResult(physicalRead, pageLocation, reconstructionContextFingerprint, "failed", [], [
      createStructureReconstructionTechnicalProblem("structure_reconstruction_failed", "candidate_group_processing"),
    ]);
  }
}
