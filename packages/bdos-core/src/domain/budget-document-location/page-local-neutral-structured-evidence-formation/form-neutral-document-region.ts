import type { ReconstructedHorizontalSegment, ReconstructedPhysicalLine } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalCellHypothesis, PhysicalCellHypothesisFormationRegion, PhysicalGridIntersection } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalCellTextEvidence, PhysicalCellTextEvidenceFormationRegion } from "../physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";
import type { TabularRegionCandidate } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import type { NeutralDocumentLine, NeutralDocumentRegion } from "./budget-document-page-local-neutral-structured-evidence-formation.types";
import { deriveRegionStatus } from "./page-local-neutral-structured-evidence-formation-classifiers";
import { computeRegionMetrics } from "./page-local-neutral-structured-evidence-formation-metrics";
import { formFailedNeutralDocumentLineShell, formNeutralDocumentLine } from "./form-neutral-document-line";
import type { LineFormationDependencies } from "./form-neutral-document-line";
import { formNeutralDocumentPosition } from "./form-neutral-document-position";

export interface RegionFormationContext {
  readonly groupKey: string;
}

export interface RegionFormationDependencies {
  readonly formNeutralDocumentLine: typeof formNeutralDocumentLine;
  readonly lineDependencies: LineFormationDependencies;
}

const DEFAULT_REGION_FORMATION_DEPENDENCIES: RegionFormationDependencies = {
  formNeutralDocumentLine,
  lineDependencies: { formNeutralDocumentPosition },
};

/**
 * Região documental neutra. A população NORMATIVA das linhas é
 * `regionCandidate.lineKeys` (detecção de regiões, §6/§20.2) — NUNCA apenas as
 * linhas com interseção. Quando a f.2c não pôde processar a região (ausente
 * ou `region_not_processable`), toda linha recebe `positions: []` e estado
 * `upstream_not_processable`; quando a f.2c formou malha, as posições vêm
 * exclusivamente das interseções físicas. Nenhuma geometria é recalculada,
 * nenhuma célula ou posição é sintetizada.
 *
 * Correção B1 (§18/§22): uma falha ao formar UMA linha (exceção genuinamente
 * inesperada de `formNeutralDocumentLine`, distinta de qualquer falha de
 * posição/célula, já isoladas internamente por ela) é isolada aqui como um
 * shell de linha `failed` — as demais linhas da região, e a região em si,
 * permanecem intactas. `neutral_region_formation_failed` fica restrito ao
 * chamador (orquestrador) para falhas genuinamente do próprio contêiner da
 * região (ex.: as estruturas de índice compartilhadas abaixo).
 */
export function formNeutralDocumentRegion(
  regionCandidate: TabularRegionCandidate,
  cellFormationRegion: PhysicalCellHypothesisFormationRegion | null,
  textEvidenceRegion: PhysicalCellTextEvidenceFormationRegion | null,
  structureLineByKey: ReadonlyMap<string, ReconstructedPhysicalLine>,
  structureSegmentByKey: ReadonlyMap<string, ReconstructedHorizontalSegment>,
  context: RegionFormationContext,
  dependencies: RegionFormationDependencies = DEFAULT_REGION_FORMATION_DEPENDENCIES,
): NeutralDocumentRegion {
  const upstreamNotProcessable = cellFormationRegion === null || cellFormationRegion.status === "region_not_processable";
  const withoutPhysicalGrid = cellFormationRegion !== null && cellFormationRegion.status === "no_physical_grid";

  const intersectionsByLineKey = new Map<string, PhysicalGridIntersection[]>();
  if (cellFormationRegion) {
    for (const intersection of cellFormationRegion.gridIntersections) {
      const existing = intersectionsByLineKey.get(intersection.sourceLineKey);
      if (existing) existing.push(intersection);
      else intersectionsByLineKey.set(intersection.sourceLineKey, [intersection]);
    }
  }
  const cellHypothesisByKey = new Map<string, PhysicalCellHypothesis>((cellFormationRegion?.cellHypotheses ?? []).map((cell) => [cell.cellHypothesisKey, cell]));
  const textEvidenceByCellKey = new Map<string, PhysicalCellTextEvidence>((textEvidenceRegion?.cellTextEvidences ?? []).map((evidence) => [evidence.cellHypothesisKey, evidence]));

  const lineContext = { groupKey: context.groupKey, pageNumber: regionCandidate.pageNumber, regionKey: regionCandidate.regionKey };
  const documentLines: NeutralDocumentLine[] = regionCandidate.lineKeys.map((lineKey) => {
    const structureLine = structureLineByKey.get(lineKey)!;
    const physicalSegments = structureLine.segmentKeys.map((segmentKey) => structureSegmentByKey.get(segmentKey)!);
    const intersectionsForLine = intersectionsByLineKey.get(lineKey) ?? [];
    try {
      return dependencies.formNeutralDocumentLine(structureLine, physicalSegments, intersectionsForLine, cellHypothesisByKey, textEvidenceByCellKey, upstreamNotProcessable, lineContext, dependencies.lineDependencies);
    } catch {
      return formFailedNeutralDocumentLineShell(structureLine, structureSegmentByKey, lineContext);
    }
  });
  documentLines.sort((a, b) => a.verticalOrder - b.verticalOrder || a.sourceLineKey.localeCompare(b.sourceLineKey));

  const metrics = computeRegionMetrics(regionCandidate, cellFormationRegion, textEvidenceRegion, documentLines, []);
  const ambiguousPositionCount = metrics.ambiguousPartialIntersectionPositionCount + metrics.ambiguousMultipleIntersectionsPositionCount + metrics.ambiguousContentOutsideGridBoundsPositionCount;
  const status = deriveRegionStatus({
    upstreamNotProcessable,
    withoutPhysicalGrid,
    documentCellCount: metrics.documentCellCount,
    ambiguousPositionCount,
    technicalProblemCount: metrics.technicalProblemCount,
    formationFailed: false,
  });

  return {
    sourceRegionKey: regionCandidate.regionKey,
    pageNumber: regionCandidate.pageNumber,
    order: regionCandidate.order,
    status,
    sourceRegionCandidate: regionCandidate,
    sourcePhysicalCellHypothesisFormationRegionStatus: cellFormationRegion ? cellFormationRegion.status : null,
    sourcePhysicalCellTextEvidenceFormationRegionStatus: textEvidenceRegion ? textEvidenceRegion.status : null,
    documentLines,
    technicalProblems: [],
    metrics,
  };
}
