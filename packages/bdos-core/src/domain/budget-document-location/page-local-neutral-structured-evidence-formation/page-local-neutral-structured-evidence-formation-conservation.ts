import type { PhysicalCellHypothesisFormationRegion } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalCellTextEvidenceFormationRegion } from "../physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";
import type { TabularRegionCandidate } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import type { NeutralDocumentGroup, NeutralDocumentLine, NeutralDocumentPage, NeutralDocumentRegion, PageLocalNeutralStructuredEvidenceFormationTechnicalProblem } from "./budget-document-page-local-neutral-structured-evidence-formation.types";
import { classifyCellStatus, deriveLineStatus, deriveRegionStatus, mapIntersectionToPositionStatus } from "./page-local-neutral-structured-evidence-formation-classifiers";
import { computeGroupMetrics, computePageMetrics, computeRegionMetrics } from "./page-local-neutral-structured-evidence-formation-metrics";

export type RegionConservationFailure =
  | "region_conservation_failed" | "line_conservation_failed" | "segment_conservation_failed"
  | "position_conservation_failed" | "cell_conservation_failed" | "text_evidence_conservation_failed"
  | "fragment_conservation_failed" | null;

function multisetEqual(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const value of a) counts.set(value, (counts.get(value) ?? 0) + 1);
  for (const value of b) {
    const next = (counts.get(value) ?? 0) - 1;
    if (next < 0) return false;
    counts.set(value, next);
  }
  return [...counts.values()].every((count) => count === 0);
}

/**
 * Portões estruturais de conservação da região (§20), cada um recalculando a
 * partir dos contratos upstream reais (regionCandidate + f.2c + g.1), nunca a
 * partir do próprio resultado publicado, e comparando campo a campo. Todos os
 * estados publicados (linha, posição, célula, região) são REDERIVADOS pelos
 * mesmos classificadores usados na formação (emenda 2) — nunca apenas aceitos.
 * A partição categórica `total = soma exata das categorias` é exigida em
 * posições, células e linhas.
 */
export function validateRegionConservation(
  region: NeutralDocumentRegion,
  regionCandidate: TabularRegionCandidate,
  cellFormationRegion: PhysicalCellHypothesisFormationRegion | null,
  textEvidenceRegion: PhysicalCellTextEvidenceFormationRegion | null,
): RegionConservationFailure {
  const upstreamNotProcessable = cellFormationRegion === null || cellFormationRegion.status === "region_not_processable";
  const withoutPhysicalGrid = cellFormationRegion !== null && cellFormationRegion.status === "no_physical_grid";

  // Conjunto de gridIntersectionKey/cellHypothesisKey com falha localizada
  // REGISTRADA (correção B1) — a rederivação estrita de status a partir da
  // interseção física legitimamente diverge apenas para esses, e apenas
  // porque um problema técnico correspondente foi de fato registrado (nunca
  // uma divergência muda ou silenciosa).
  const allTechnicalProblems = region.documentLines.flatMap((line) => line.technicalProblems);
  const positionFailureKeys = new Set(allTechnicalProblems.filter((p) => p.code === "neutral_position_formation_failed").map((p) => p.gridIntersectionKey).filter((key): key is string => key !== null));
  const cellFailureKeys = new Set(allTechnicalProblems.filter((p) => p.code === "neutral_cell_formation_failed").map((p) => p.cellHypothesisKey).filter((key): key is string => key !== null));
  const lineFailureKeys = new Set(allTechnicalProblems.filter((p) => p.code === "neutral_line_formation_failed").map((p) => p.lineKey).filter((key): key is string => key !== null));

  // Gate 1 (linha/região): multiset das linhas documentais == lineKeys da região candidata (§20.1/§20.2).
  // Uma linha `failed` continua fazendo parte da população — nunca desaparece (correção B1).
  if (!multisetEqual(region.documentLines.map((line) => line.sourceLineKey), regionCandidate.lineKeys)) return "line_conservation_failed";

  // Gate 2 (segmento): cada linha preserva exatamente os segmentos físicos da linha estrutural, em ordem (§20.3).
  // Uma linha `failed` genuína (correção B1) exige problema registrado e preserva apenas os segmentos que
  // puderam ser relacionados com segurança — sem ordem/completude exigida, mas sem segmento inventado ou duplicado.
  for (const line of region.documentLines) {
    const expected = line.sourceLine.segmentKeys;
    if (line.status === "failed") {
      if (!lineFailureKeys.has(line.sourceLineKey)) return "line_conservation_failed";
      const seen = new Set<string>();
      for (const segment of line.physicalSegments) {
        if (!expected.includes(segment.segmentKey) || segment.lineKey !== line.sourceLineKey || seen.has(segment.segmentKey)) return "segment_conservation_failed";
        seen.add(segment.segmentKey);
      }
      if (line.sourceLine.lineKey !== line.sourceLineKey || line.positions.length !== 0) return "line_conservation_failed";
      continue;
    }
    if (line.physicalSegments.length !== expected.length) return "segment_conservation_failed";
    for (let index = 0; index < expected.length; index += 1) {
      if (line.physicalSegments[index].segmentKey !== expected[index] || line.physicalSegments[index].lineKey !== line.sourceLineKey) return "segment_conservation_failed";
    }
    if (line.sourceLine.lineKey !== line.sourceLineKey) return "line_conservation_failed";
  }

  // Gate 3 (posição): multiset das posições == interseções da f.2c (só sobre linhas não-failed, cuja
  // montagem de posições genuinamente ocorreu); posição na linha correta; status rederivado (§20.4).
  // Uma posição com falha registrada (correção B1) pode legitimamente divergir da rederivação estrita,
  // mas só na forma exata `technical_failure` ou `cell_structured` com célula `failed` — nunca outra coisa.
  const nonFailedLines = region.documentLines.filter((line) => line.status !== "failed");
  const allPositions = nonFailedLines.flatMap((line) => line.positions.map((position) => ({ position, lineKey: line.sourceLineKey })));
  const expectedIntersectionKeys = cellFormationRegion ? cellFormationRegion.gridIntersections.filter((entry) => nonFailedLines.some((line) => line.sourceLineKey === entry.sourceLineKey)).map((entry) => entry.gridIntersectionKey) : [];
  if (!multisetEqual(allPositions.map((entry) => entry.position.gridIntersectionKey), expectedIntersectionKeys)) return "position_conservation_failed";
  for (const { position, lineKey } of allPositions) {
    if (position.sourceLineKey !== lineKey) return "position_conservation_failed";
    if (position.sourceGridIntersection.gridIntersectionKey !== position.gridIntersectionKey) return "position_conservation_failed";
    const hasRecordedPositionFailure = positionFailureKeys.has(position.gridIntersectionKey);
    const hasRecordedCellFailure = position.status === "cell_structured" && position.cell !== null && cellFailureKeys.has(position.cell.cellHypothesisKey);
    if (!hasRecordedPositionFailure && !hasRecordedCellFailure) {
      if (mapIntersectionToPositionStatus(position.sourceGridIntersection) !== position.status) return "position_conservation_failed";
    } else if (hasRecordedPositionFailure) {
      if (position.status !== "technical_failure") return "position_conservation_failed";
    } else {
      if (position.status !== "cell_structured" || position.cell === null || position.cell.status !== "failed") return "position_conservation_failed";
    }
    if (position.status === "cell_structured" && position.cell === null) return "position_conservation_failed";
    if (position.status !== "cell_structured" && position.cell !== null) return "position_conservation_failed";
  }

  // Gate 4 (célula): multiset das células == cellHypotheses da f.2c (sobre linhas não-failed);
  // identidade e status rederivados (§20.5). Uma célula `failed` (correção B1) exige problema
  // registrado; `sourceCellHypothesis`/`sourceTextEvidence` podem ser `null`, mas quando presentes
  // devem ser internamente consistentes com a identidade da célula. Uma hipótese cuja interseção
  // sofreu uma falha de POSIÇÃO (não de célula) nunca produz objeto de célula algum — nem
  // estruturado, nem `failed` — porque a formação nunca chegou a tentar resolver a célula; essas
  // hipóteses são excluídas de `expectedCellKeys` (a posição virou `technical_failure`, sem célula).
  const cells = allPositions.flatMap((entry) => (entry.position.status === "cell_structured" && entry.position.cell !== null ? [entry.position.cell] : []));
  const expectedCellKeys = cellFormationRegion ? cellFormationRegion.cellHypotheses.filter((cell) => expectedIntersectionKeys.includes(cell.gridIntersectionKey) && !positionFailureKeys.has(cell.gridIntersectionKey)).map((cell) => cell.cellHypothesisKey) : [];
  if (!multisetEqual(cells.map((cell) => cell.cellHypothesisKey), expectedCellKeys)) return "cell_conservation_failed";
  for (const cell of cells) {
    if (cell.status === "failed") {
      if (!cellFailureKeys.has(cell.cellHypothesisKey)) return "cell_conservation_failed";
      if (cell.sourceCellHypothesis && (cell.sourceCellHypothesis.cellHypothesisKey !== cell.cellHypothesisKey || cell.sourceCellHypothesis.gridIntersectionKey !== cell.gridIntersectionKey)) return "cell_conservation_failed";
      if (cell.sourceTextEvidence && (cell.sourceTextEvidence.cellHypothesisKey !== cell.cellHypothesisKey || cell.sourceTextEvidenceStatus !== cell.sourceTextEvidence.status)) return "cell_conservation_failed";
      continue;
    }
    if (!cell.sourceCellHypothesis || !cell.sourceTextEvidence) return "cell_conservation_failed";
    if (cell.sourceCellHypothesis.cellHypothesisKey !== cell.cellHypothesisKey) return "cell_conservation_failed";
    if (cell.sourceCellHypothesis.gridIntersectionKey !== cell.gridIntersectionKey) return "cell_conservation_failed";
    if (classifyCellStatus(cell.sourceTextEvidence.status, false) !== cell.status) return "cell_conservation_failed";
  }

  // Gate 5 (evidência textual): cada célula não-failed carrega a evidência textual da g.1 com a mesma chave (§20.6).
  const textEvidenceByKey = new Map((textEvidenceRegion?.cellTextEvidences ?? []).map((evidence) => [evidence.cellHypothesisKey, evidence]));
  for (const cell of cells) {
    if (cell.status === "failed") continue; // já validado no Gate 4 acima.
    if (!cell.sourceTextEvidence) return "text_evidence_conservation_failed";
    if (cell.sourceTextEvidence.cellHypothesisKey !== cell.cellHypothesisKey) return "text_evidence_conservation_failed";
    if (cell.sourceTextEvidenceStatus !== cell.sourceTextEvidence.status) return "text_evidence_conservation_failed";
    const upstream = textEvidenceByKey.get(cell.cellHypothesisKey);
    if (!upstream || upstream.gridIntersectionKey !== cell.gridIntersectionKey) return "text_evidence_conservation_failed";
    if (upstream.segmentOutcomes.length !== cell.sourceTextEvidence.segmentOutcomes.length) return "text_evidence_conservation_failed";
  }

  // Gate 6 (fragmento): fragmentos preservados por ocorrência, iguais aos da g.1, restrito às células
  // cuja evidência textual foi de fato preservada — uma célula `failed` sem evidência não tem fragmento
  // produzido, e nunca é comparada contra fragmentos que porventura existam upstream para essa chave
  // (a ausência já foi contabilizada e registrada pelo Gate 4, não deve ser contada duas vezes aqui) (§20.8).
  const fragmentTuple = (cellKey: string, outcomes: ReadonlyArray<{ readonly status: string; readonly segmentKey: string; readonly fragments?: ReadonlyArray<{ readonly sourceReferenceOrder: number; readonly textItemIndex: number; readonly originalText: string; readonly normalizedText: string }> }>): ReadonlyArray<string> =>
    outcomes.flatMap((outcome) => (outcome.status === "resolved" && outcome.fragments ? outcome.fragments.map((fragment) => `${cellKey}::${outcome.segmentKey}::${fragment.sourceReferenceOrder}::${fragment.textItemIndex}::${fragment.originalText}::${fragment.normalizedText}`) : []));
  const cellsWithPreservedEvidence = cells.filter((cell) => cell.sourceTextEvidence !== null);
  const producedFragments = cellsWithPreservedEvidence.flatMap((cell) => fragmentTuple(cell.cellHypothesisKey, cell.sourceTextEvidence!.segmentOutcomes));
  const preservedCellKeys = new Set(cellsWithPreservedEvidence.map((cell) => cell.cellHypothesisKey));
  const upstreamFragments = (textEvidenceRegion?.cellTextEvidences ?? [])
    .filter((evidence) => preservedCellKeys.has(evidence.cellHypothesisKey))
    .flatMap((evidence) => fragmentTuple(evidence.cellHypothesisKey, evidence.segmentOutcomes));
  if (!multisetEqual(producedFragments, upstreamFragments)) return "fragment_conservation_failed";

  // Gate 7 (partição categórica de cada nível, emenda 2) + rederivação de estado — só sobre linhas não-failed;
  // uma linha `failed` já foi integralmente validada nos Gates 1-2 acima.
  for (const line of nonFailedLines) {
    if (!lineCategoricalPartitionHolds(line)) return "line_conservation_failed";
    if (deriveLineStatus({ positionCount: line.positions.length, technicalProblemCount: line.technicalProblems.length, regionUpstreamNotProcessable: upstreamNotProcessable, formationFailed: false }) !== line.status) return "line_conservation_failed";
  }

  const documentCellCount = cells.length;
  const ambiguousPositionCount = allPositions.filter((entry) => entry.position.status === "ambiguous_partial_intersection" || entry.position.status === "ambiguous_multiple_intersections" || entry.position.status === "ambiguous_content_outside_grid_bounds").length;
  const rederivedRegionStatus = deriveRegionStatus({ upstreamNotProcessable, withoutPhysicalGrid, documentCellCount, ambiguousPositionCount, technicalProblemCount: region.metrics.technicalProblemCount, formationFailed: region.status === "failed" });
  if (rederivedRegionStatus !== region.status) return "region_conservation_failed";

  return null;
}

function lineCategoricalPartitionHolds(line: NeutralDocumentLine): boolean {
  const m = line.metrics;
  if (m.positionCount !== m.emptyPositionCount + m.cellStructuredPositionCount + m.ambiguousPartialIntersectionPositionCount + m.ambiguousMultipleIntersectionsPositionCount + m.ambiguousContentOutsideGridBoundsPositionCount + m.technicalFailurePositionCount) return false;
  if (m.documentCellCount !== m.cellStructuredCount + m.cellStructuredWithTextProblemsCount + m.cellStructuredWithoutResolvedTextCount + m.cellFailedCount) return false;
  if (m.cellStructuredPositionCount !== m.documentCellCount) return false;
  return true;
}

/**
 * Portão 8 (§20.9): as métricas publicadas da região são exatamente as
 * recalculadas a partir dos objetos publicados e das fontes upstream — deep
 * equal — e a partição `total = soma das categorias` vale para linhas,
 * posições e células no nível da região.
 */
export function validateRegionMetricConservation(
  region: NeutralDocumentRegion,
  regionCandidate: TabularRegionCandidate,
  cellFormationRegion: PhysicalCellHypothesisFormationRegion | null,
  textEvidenceRegion: PhysicalCellTextEvidenceFormationRegion | null,
): boolean {
  const recomputed = computeRegionMetrics(regionCandidate, cellFormationRegion, textEvidenceRegion, region.documentLines, region.technicalProblems);
  if (JSON.stringify(recomputed) !== JSON.stringify(region.metrics)) return false;
  const m = region.metrics;
  if (m.documentLineProducedCount !== m.documentLineStructuredCount + m.documentLineStructuredWithProblemsCount + m.documentLineWithoutPositionsCount + m.documentLineUpstreamNotProcessableCount + m.documentLineFailedCount) return false;
  if (m.positionProducedCount !== m.emptyPositionCount + m.cellStructuredPositionCount + m.ambiguousPartialIntersectionPositionCount + m.ambiguousMultipleIntersectionsPositionCount + m.ambiguousContentOutsideGridBoundsPositionCount + m.technicalFailurePositionCount) return false;
  if (m.documentCellCount !== m.cellStructuredCount + m.cellStructuredWithTextProblemsCount + m.cellStructuredWithoutResolvedTextCount + m.cellFailedCount) return false;
  if (m.fragmentPreservedCount !== m.fragmentReceivedCount) return false;
  return true;
}

export function validatePageMetricConservation(page: NeutralDocumentPage): boolean {
  const recomputed = computePageMetrics(page.regions, page.technicalProblems);
  if (JSON.stringify(recomputed) !== JSON.stringify(page.metrics)) return false;
  const m = page.metrics;
  return m.totalRegionCount === m.structuredRegionCount + m.structuredWithAmbiguitiesRegionCount + m.structuredWithProblemsRegionCount + m.gridWithoutCellsRegionCount + m.withoutPhysicalGridRegionCount + m.upstreamNotProcessableRegionCount + m.failedRegionCount;
}

export function validateGroupMetricConservation(group: NeutralDocumentGroup): boolean {
  const recomputed = computeGroupMetrics(group.pages, group.technicalProblems);
  if (JSON.stringify(recomputed) !== JSON.stringify(group.metrics)) return false;
  const m = group.metrics;
  return m.totalPageCount === m.structuredPageCount + m.structuredWithProblemsPageCount + m.partiallyStructuredPageCount + m.withoutNeutralStructurePageCount + m.upstreamNotProcessablePageCount + m.failedPageCount;
}

export function validateGlobalMetricConservation(groups: ReadonlyArray<NeutralDocumentGroup>, globalMetrics: import("./budget-document-page-local-neutral-structured-evidence-formation.types").GlobalNeutralDocumentFormationMetrics): boolean {
  return groups.length === globalMetrics.receivedGroupCount
    && globalMetrics.receivedGroupCount === globalMetrics.structuredGroupCount + globalMetrics.structuredWithProblemsGroupCount + globalMetrics.partiallyStructuredGroupCount + globalMetrics.withoutNeutralStructureGroupCount + globalMetrics.upstreamNotProcessableGroupCount + globalMetrics.failedGroupCount;
}
