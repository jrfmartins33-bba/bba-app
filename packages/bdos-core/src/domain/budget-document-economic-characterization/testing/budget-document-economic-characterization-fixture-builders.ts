import type { NeutralDocumentGroup, NeutralDocumentPage, NeutralDocumentRegion } from "../../budget-document-location/page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import type { BudgetDocumentPageBoundaryNeutralContinuityEvaluationResult } from "../../budget-document-location/page-boundary-neutral-continuity-evaluation/budget-document-page-boundary-neutral-continuity-evaluation.types";
import { evaluateBudgetDocumentPageBoundaryNeutralContinuity } from "../../budget-document-location/page-boundary-neutral-continuity-evaluation";
import {
  cellHypothesis, gridIntersection, structureLine, structureSegment,
} from "../../budget-document-location/page-local-neutral-structured-evidence-formation/testing/page-local-neutral-structured-evidence-formation-fixture-builders";
import { pageLocalResultFixture, positionFixture as pageBoundaryPositionFixture, regionCandidateFixture as pageBoundaryRegionCandidateFixture } from "../../budget-document-location/page-boundary-neutral-continuity-evaluation/testing/page-boundary-neutral-continuity-evaluation-fixture-builders";
import { formNeutralDocumentRegion } from "../../budget-document-location/page-local-neutral-structured-evidence-formation/form-neutral-document-region";
import type { BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult } from "../../budget-document-location/page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import type { PhysicalCellHypothesisFormationRegion } from "../../budget-document-location/physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalCellTextEvidence, PhysicalCellTextEvidenceFormationRegion, PhysicalCellTextSegmentOutcome } from "../../budget-document-location/physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";
import type { TabularRegionCandidate } from "../../budget-document-location/tabular-region-detection/budget-document-tabular-region-detection.types";
import type { ReconstructedHorizontalSegment, ReconstructedPhysicalLine } from "../../budget-document-location/structure-reconstruction/budget-document-structure-reconstruction.types";

/**
 * Helpers de fixture mínimos, exclusivamente de teste, para construir uma
 * "planilha orçamentária" sintética linha a linha — reaproveita os mesmos
 * construtores de baixo nível já usados pelo golden trace da g.2
 * (`gridIntersection`, `cellHypothesis`) e chama a função REAL de
 * construção de região da g.2 (`formNeutralDocumentRegion`), nunca um
 * objeto de região montado à mão. Nunca fixture de produção.
 */

export type RowSpec = ReadonlyArray<string | null>;

const zeroCellFormationRegionMetrics = {
  sourceLineCount: 0, sourcePhysicalColumnHypothesisCount: 0, totalGridIntersectionCount: 0, cellHypothesisFormedIntersectionCount: 0, emptyGridIntersectionCount: 0, ambiguousGridIntersectionCount: 0, formationFailedGridIntersectionCount: 0,
  totalRegionSegmentCount: 0, includedSegmentCount: 0, outsideSegmentCount: 0, inheritedAmbiguousSegmentCount: 0, partialIntersectionSegmentCount: 0, multipleClaimSegmentCount: 0, sourceContractInconsistentSegmentCount: 0, upstreamRegionNotProcessableSegmentCount: 0, inheritedPhysicalColumnHypothesisFailureSegmentCount: 0, formationFailedSegmentCount: 0,
  cellHypothesisCount: 0, multiSegmentCellHypothesisCount: 0, technicalProblemCount: 0,
};

const zeroTextEvidenceRegionMetrics = {
  sourceCellHypothesisCount: 0, cellTextEvidenceFormedCount: 0, cellTextEvidencePartiallyFormedCount: 0, cellTextEvidenceFailedCount: 0,
  sourceSegmentReferenceCount: 0, segmentResolvedCount: 0, segmentReferenceInvalidCount: 0, segmentIncompatibleCount: 0, segmentFormationFailedCount: 0,
  totalEligibleTextItemReferenceCount: 0, includedTextItemReferenceCount: 0, invalidReferenceTextItemCount: 0, duplicateReferenceTextItemCount: 0, segmentMismatchTextItemCount: 0, formationFailedTextItemCount: 0, technicalProblemCount: 0,
};

/**
 * Constrói uma região documental neutra real (via `formNeutralDocumentRegion`,
 * nunca um objeto montado à mão) a partir de uma tabela de linhas simples:
 * cada `RowSpec` é uma linha, cada célula não-nula da linha vira um
 * segmento físico + uma interseção de malha resolvida + uma hipótese de
 * célula + evidência textual com um único fragmento — texto original ==
 * texto normalizado (irrelevante para os testes desta capacidade, que
 * nunca depende de normalização de texto).
 */
export function budgetTableRegion(regionKey: string, pageNumber: number, order: number, rows: ReadonlyArray<RowSpec>, geometry: Parameters<typeof pageBoundaryRegionCandidateFixture>[4] = {}): NeutralDocumentRegion {
  const lines: ReconstructedPhysicalLine[] = [];
  const segments: ReconstructedHorizontalSegment[] = [];
  const intersections: ReturnType<typeof gridIntersection>[] = [];
  const cellHypotheses: ReturnType<typeof cellHypothesis>[] = [];
  const textEvidences: PhysicalCellTextEvidence[] = [];
  const lineKeys: string[] = [];

  rows.forEach((row, rowIndex) => {
    const lineKey = `${regionKey}-L${rowIndex}`;
    lineKeys.push(lineKey);
    const rowSegmentKeys: string[] = [];
    row.forEach((cellText, columnIndex) => {
      if (cellText === null) return;
      const segmentKey = `${lineKey}-S${columnIndex}`;
      rowSegmentKeys.push(segmentKey);
      segments.push(structureSegment(segmentKey, lineKey, pageNumber, columnIndex + 1, [rowIndex * 100 + columnIndex]));

      const gridIntersectionKey = `${lineKey}-GI${columnIndex}`;
      const cellHypothesisKey = `${lineKey}-CH${columnIndex}`;
      intersections.push(gridIntersection(gridIntersectionKey, lineKey, rowIndex + 1, columnIndex + 1, cellHypothesisKey, pageNumber, regionKey));
      cellHypotheses.push(cellHypothesis(cellHypothesisKey, gridIntersectionKey, [segmentKey]));

      const segmentOutcome: PhysicalCellTextSegmentOutcome = {
        status: "resolved", segmentKey, lineKey,
        fragments: [{ sourceReferenceOrder: 1, textItemIndex: rowIndex * 100 + columnIndex, originalText: cellText, normalizedText: cellText }],
        itemDispositions: [{ status: "included_in_text_fragment", segmentKey, sourceReferenceOrder: 1, textItemIndex: rowIndex * 100 + columnIndex }],
      };
      textEvidences.push({ status: "formed", cellHypothesisKey, gridIntersectionKey, segmentOutcomes: [segmentOutcome] } as PhysicalCellTextEvidence);
    });
    lines.push({ ...structureLine(lineKey, pageNumber, rowSegmentKeys), verticalOrder: rowIndex + 1 });
  });

  const regionCandidate: TabularRegionCandidate = pageBoundaryRegionCandidateFixture(regionKey, pageNumber, order, lineKeys, geometry);
  const cellFormationRegion: PhysicalCellHypothesisFormationRegion = {
    regionProcessedKey: `region-${regionKey}`, sourceRegionKey: regionKey, pageNumber, sourcePhysicalColumnHypothesisRegionStatus: "hypotheses_reconstructed",
    status: "formed_with_ambiguities", gridIntersections: intersections, cellHypotheses, segmentDispositions: [], technicalProblems: [], metrics: zeroCellFormationRegionMetrics, profileId: "fixture", profileVersion: 1,
  };
  const textEvidenceRegion: PhysicalCellTextEvidenceFormationRegion = {
    regionProcessedKey: `text-region-${regionKey}`, sourceRegionKey: regionKey, pageNumber, sourcePhysicalCellHypothesisFormationRegionStatus: "formed",
    status: "formed", cellTextEvidences: textEvidences, technicalProblems: [], metrics: zeroTextEvidenceRegionMetrics,
  };
  const lineByKey = new Map(lines.map((line) => [line.lineKey, line]));
  const segmentByKey = new Map(segments.map((segment) => [segment.segmentKey, segment]));

  return formNeutralDocumentRegion(regionCandidate, cellFormationRegion, textEvidenceRegion, lineByKey, segmentByKey, { groupKey: "fixture-group" });
}

export function budgetTablePage(pageNumber: number, regions: ReadonlyArray<NeutralDocumentRegion>): NeutralDocumentPage {
  return {
    pageNumber, status: "structured",
    sourceTabularRegionDetectionPageStatus: "detected",
    sourcePhysicalCellHypothesisFormationPageStatus: null,
    sourcePhysicalCellTextEvidenceFormationPageStatus: null,
    regions, technicalProblems: [],
    metrics: {
      totalRegionCount: regions.length, structuredRegionCount: regions.length, structuredWithAmbiguitiesRegionCount: 0, structuredWithProblemsRegionCount: 0,
      gridWithoutCellsRegionCount: 0, withoutPhysicalGridRegionCount: 0, upstreamNotProcessableRegionCount: 0, failedRegionCount: 0,
      documentLineCount: 0, physicalSegmentPreservedCount: 0, positionCount: 0, emptyPositionCount: 0, cellStructuredPositionCount: 0,
      ambiguousPositionCount: 0, technicalFailurePositionCount: 0, documentCellCount: 0, cellStructuredCount: 0, cellStructuredWithTextProblemsCount: 0,
      cellStructuredWithoutResolvedTextCount: 0, cellFailedCount: 0, fragmentPreservedCount: 0, technicalProblemCount: 0,
    },
  };
}

export function budgetTableGroup(groupKey: string, pages: ReadonlyArray<NeutralDocumentPage>): NeutralDocumentGroup {
  return {
    sourceCandidateGroupKey: groupKey, status: "structured",
    sourceTabularRegionDetectionGroupStatus: "detected", sourcePhysicalCellHypothesisFormationGroupStatus: null, sourcePhysicalCellTextEvidenceFormationGroupStatus: null,
    pages, technicalProblems: [],
    metrics: {
      totalPageCount: pages.length, structuredPageCount: pages.length, structuredWithProblemsPageCount: 0, partiallyStructuredPageCount: 0,
      withoutNeutralStructurePageCount: 0, upstreamNotProcessablePageCount: 0, failedPageCount: 0, totalRegionCount: 0, documentLineCount: 0,
      physicalSegmentPreservedCount: 0, positionCount: 0, emptyPositionCount: 0, cellStructuredPositionCount: 0, ambiguousPositionCount: 0,
      technicalFailurePositionCount: 0, documentCellCount: 0, cellStructuredCount: 0, cellStructuredWithTextProblemsCount: 0,
      cellStructuredWithoutResolvedTextCount: 0, cellFailedCount: 0, fragmentPreservedCount: 0, technicalProblemCount: 0,
    },
  };
}

/** Constrói a entrada completa (g.2 real + g.3 real, chamada de verdade) a partir de grupos de tabela sintéticos. */
export function economicCharacterizationInputFromGroups(groups: ReadonlyArray<NeutralDocumentGroup>): { pageLocalNeutralStructuredEvidence: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult; pageBoundaryNeutralContinuity: BudgetDocumentPageBoundaryNeutralContinuityEvaluationResult } {
  const pageLocalNeutralStructuredEvidence = pageLocalResultFixture(groups);
  const pageBoundaryNeutralContinuity = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence });
  return { pageLocalNeutralStructuredEvidence, pageBoundaryNeutralContinuity };
}

export { pageBoundaryPositionFixture };
