import type { PhysicalCellHypothesisFormationRegion } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalCellTextEvidence, PhysicalCellTextEvidenceFormationRegion } from "../physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";
import type { TabularRegionCandidate } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import type {
  GlobalNeutralDocumentFormationMetrics,
  NeutralDocumentCell,
  NeutralDocumentGroup,
  NeutralDocumentGroupMetrics,
  NeutralDocumentLine,
  NeutralDocumentLineMetrics,
  NeutralDocumentPage,
  NeutralDocumentPageMetrics,
  NeutralDocumentPosition,
  NeutralDocumentRegion,
  NeutralDocumentRegionMetrics,
  PageLocalNeutralStructuredEvidenceFormationTechnicalProblem,
} from "./budget-document-page-local-neutral-structured-evidence-formation.types";

/** Conta fragmentos preservados por ocorrência (§20.8) sobre um array de evidências textuais. */
function countFragments(textEvidences: ReadonlyArray<PhysicalCellTextEvidence>): number {
  return textEvidences.reduce((total, evidence) => total + evidence.segmentOutcomes.reduce((segTotal, outcome) => segTotal + (outcome.status === "resolved" ? outcome.fragments.length : 0), 0), 0);
}

/** Filtra evidências textuais indisponíveis (`null`) de uma célula `failed` (correção B1) antes de contar. */
function definedTextEvidences(cells: ReadonlyArray<NeutralDocumentCell>): ReadonlyArray<PhysicalCellTextEvidence> {
  return cells.map((c) => c.sourceTextEvidence).filter((evidence): evidence is PhysicalCellTextEvidence => evidence !== null);
}

function collectCells(positions: ReadonlyArray<NeutralDocumentPosition>): ReadonlyArray<NeutralDocumentCell> {
  return positions.flatMap((position) => (position.status === "cell_structured" ? [position.cell] : []));
}

export function computeLineMetrics(positions: ReadonlyArray<NeutralDocumentPosition>, technicalProblems: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem>, physicalSegmentCount: number): NeutralDocumentLineMetrics {
  const cells = collectCells(positions);
  return {
    physicalSegmentCount,
    positionCount: positions.length,
    emptyPositionCount: positions.filter((p) => p.status === "empty").length,
    cellStructuredPositionCount: positions.filter((p) => p.status === "cell_structured").length,
    ambiguousPartialIntersectionPositionCount: positions.filter((p) => p.status === "ambiguous_partial_intersection").length,
    ambiguousMultipleIntersectionsPositionCount: positions.filter((p) => p.status === "ambiguous_multiple_intersections").length,
    ambiguousContentOutsideGridBoundsPositionCount: positions.filter((p) => p.status === "ambiguous_content_outside_grid_bounds").length,
    technicalFailurePositionCount: positions.filter((p) => p.status === "technical_failure").length,
    documentCellCount: cells.length,
    cellStructuredCount: cells.filter((c) => c.status === "structured").length,
    cellStructuredWithTextProblemsCount: cells.filter((c) => c.status === "structured_with_text_problems").length,
    cellStructuredWithoutResolvedTextCount: cells.filter((c) => c.status === "structured_without_resolved_text").length,
    cellFailedCount: cells.filter((c) => c.status === "failed").length,
    fragmentPreservedCount: countFragments(definedTextEvidences(cells)),
    technicalProblemCount: technicalProblems.length,
  };
}

export function computeRegionMetrics(
  regionCandidate: TabularRegionCandidate,
  cellFormationRegion: PhysicalCellHypothesisFormationRegion | null,
  textEvidenceRegion: PhysicalCellTextEvidenceFormationRegion | null,
  documentLines: ReadonlyArray<NeutralDocumentLine>,
  regionTechnicalProblems: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem>,
): NeutralDocumentRegionMetrics {
  const lineMetrics = documentLines.map((line) => line.metrics);
  const sum = (selector: (metrics: NeutralDocumentLineMetrics) => number) => lineMetrics.reduce((total, entry) => total + selector(entry), 0);
  const allCells = documentLines.flatMap((line) => collectCells(line.positions));
  return {
    physicalLineReceivedCount: regionCandidate.lineKeys.length,
    documentLineProducedCount: documentLines.length,
    documentLineStructuredCount: documentLines.filter((line) => line.status === "structured").length,
    documentLineStructuredWithProblemsCount: documentLines.filter((line) => line.status === "structured_with_problems").length,
    documentLineWithoutPositionsCount: documentLines.filter((line) => line.status === "without_positions").length,
    documentLineUpstreamNotProcessableCount: documentLines.filter((line) => line.status === "upstream_not_processable").length,
    documentLineFailedCount: documentLines.filter((line) => line.status === "failed").length,
    physicalSegmentPreservedCount: sum((m) => m.physicalSegmentCount),
    gridIntersectionReceivedCount: cellFormationRegion ? cellFormationRegion.gridIntersections.length : 0,
    positionProducedCount: sum((m) => m.positionCount),
    emptyPositionCount: sum((m) => m.emptyPositionCount),
    cellStructuredPositionCount: sum((m) => m.cellStructuredPositionCount),
    ambiguousPartialIntersectionPositionCount: sum((m) => m.ambiguousPartialIntersectionPositionCount),
    ambiguousMultipleIntersectionsPositionCount: sum((m) => m.ambiguousMultipleIntersectionsPositionCount),
    ambiguousContentOutsideGridBoundsPositionCount: sum((m) => m.ambiguousContentOutsideGridBoundsPositionCount),
    technicalFailurePositionCount: sum((m) => m.technicalFailurePositionCount),
    physicalCellHypothesisCount: cellFormationRegion ? cellFormationRegion.cellHypotheses.length : 0,
    documentCellCount: sum((m) => m.documentCellCount),
    cellStructuredCount: sum((m) => m.cellStructuredCount),
    cellStructuredWithTextProblemsCount: sum((m) => m.cellStructuredWithTextProblemsCount),
    cellStructuredWithoutResolvedTextCount: sum((m) => m.cellStructuredWithoutResolvedTextCount),
    cellFailedCount: sum((m) => m.cellFailedCount),
    textEvidenceCount: textEvidenceRegion ? textEvidenceRegion.cellTextEvidences.length : 0,
    segmentOutcomeCount: allCells.reduce((total, cell) => total + (cell.sourceTextEvidence ? cell.sourceTextEvidence.segmentOutcomes.length : 0), 0),
    // Correção B1: restrito às células REALMENTE tentadas (toda posição `cell_structured`,
    // estruturada ou `failed` — `allCells` já reflete isso). Uma hipótese cuja interseção sofreu
    // falha de POSIÇÃO (nunca chegou a tentar resolver célula) nunca teve chance de preservar
    // fragmento algum, então também não deve ser contada como "recebida" para efeito desta
    // comparação — o par recebido/preservado precisa estar sobre a mesma população, senão uma
    // falha de posição isolada pareceria incorretamente uma perda de fragmento.
    fragmentReceivedCount: textEvidenceRegion ? countFragments(textEvidenceRegion.cellTextEvidences.filter((evidence) => allCells.some((cell) => cell.cellHypothesisKey === evidence.cellHypothesisKey))) : 0,
    fragmentPreservedCount: sum((m) => m.fragmentPreservedCount),
    technicalProblemCount: regionTechnicalProblems.length + sum((m) => m.technicalProblemCount),
  };
}

export function computePageMetrics(regions: ReadonlyArray<NeutralDocumentRegion>, pageTechnicalProblems: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem>): NeutralDocumentPageMetrics {
  const metrics = regions.map((region) => region.metrics);
  const sum = (selector: (m: NeutralDocumentRegionMetrics) => number) => metrics.reduce((total, entry) => total + selector(entry), 0);
  return {
    totalRegionCount: regions.length,
    structuredRegionCount: regions.filter((r) => r.status === "structured").length,
    structuredWithAmbiguitiesRegionCount: regions.filter((r) => r.status === "structured_with_ambiguities").length,
    structuredWithProblemsRegionCount: regions.filter((r) => r.status === "structured_with_problems").length,
    gridWithoutCellsRegionCount: regions.filter((r) => r.status === "grid_without_cells").length,
    withoutPhysicalGridRegionCount: regions.filter((r) => r.status === "without_physical_grid").length,
    upstreamNotProcessableRegionCount: regions.filter((r) => r.status === "upstream_not_processable").length,
    failedRegionCount: regions.filter((r) => r.status === "failed").length,
    documentLineCount: sum((m) => m.documentLineProducedCount),
    physicalSegmentPreservedCount: sum((m) => m.physicalSegmentPreservedCount),
    positionCount: sum((m) => m.positionProducedCount),
    emptyPositionCount: sum((m) => m.emptyPositionCount),
    cellStructuredPositionCount: sum((m) => m.cellStructuredPositionCount),
    ambiguousPositionCount: sum((m) => m.ambiguousPartialIntersectionPositionCount + m.ambiguousMultipleIntersectionsPositionCount + m.ambiguousContentOutsideGridBoundsPositionCount),
    technicalFailurePositionCount: sum((m) => m.technicalFailurePositionCount),
    documentCellCount: sum((m) => m.documentCellCount),
    cellStructuredCount: sum((m) => m.cellStructuredCount),
    cellStructuredWithTextProblemsCount: sum((m) => m.cellStructuredWithTextProblemsCount),
    cellStructuredWithoutResolvedTextCount: sum((m) => m.cellStructuredWithoutResolvedTextCount),
    cellFailedCount: sum((m) => m.cellFailedCount),
    fragmentPreservedCount: sum((m) => m.fragmentPreservedCount),
    technicalProblemCount: pageTechnicalProblems.length + sum((m) => m.technicalProblemCount),
  };
}

export function computeGroupMetrics(pages: ReadonlyArray<NeutralDocumentPage>, groupTechnicalProblems: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem>): NeutralDocumentGroupMetrics {
  const metrics = pages.map((page) => page.metrics);
  const sum = (selector: (m: NeutralDocumentPageMetrics) => number) => metrics.reduce((total, entry) => total + selector(entry), 0);
  return {
    totalPageCount: pages.length,
    structuredPageCount: pages.filter((p) => p.status === "structured").length,
    structuredWithProblemsPageCount: pages.filter((p) => p.status === "structured_with_problems").length,
    partiallyStructuredPageCount: pages.filter((p) => p.status === "partially_structured").length,
    withoutNeutralStructurePageCount: pages.filter((p) => p.status === "without_neutral_structure").length,
    upstreamNotProcessablePageCount: pages.filter((p) => p.status === "upstream_not_processable").length,
    failedPageCount: pages.filter((p) => p.status === "failed").length,
    totalRegionCount: sum((m) => m.totalRegionCount),
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
    technicalProblemCount: groupTechnicalProblems.length + sum((m) => m.technicalProblemCount),
  };
}

export function computeGlobalMetrics(groups: ReadonlyArray<NeutralDocumentGroup>, globalTechnicalProblems: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem>): GlobalNeutralDocumentFormationMetrics {
  const metrics = groups.map((group) => group.metrics);
  const sum = (selector: (m: NeutralDocumentGroupMetrics) => number) => metrics.reduce((total, entry) => total + selector(entry), 0);
  return {
    receivedGroupCount: groups.length,
    structuredGroupCount: groups.filter((g) => g.status === "structured").length,
    structuredWithProblemsGroupCount: groups.filter((g) => g.status === "structured_with_problems").length,
    partiallyStructuredGroupCount: groups.filter((g) => g.status === "partially_structured").length,
    withoutNeutralStructureGroupCount: groups.filter((g) => g.status === "without_neutral_structure").length,
    upstreamNotProcessableGroupCount: groups.filter((g) => g.status === "upstream_not_processable").length,
    failedGroupCount: groups.filter((g) => g.status === "failed").length,
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
    technicalProblemCount: globalTechnicalProblems.length + sum((m) => m.technicalProblemCount),
  };
}
