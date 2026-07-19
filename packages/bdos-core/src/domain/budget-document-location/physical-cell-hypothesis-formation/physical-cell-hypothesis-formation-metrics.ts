import type { GlobalPhysicalCellHypothesisFormationMetrics, GroupPhysicalCellHypothesisFormationMetrics, PagePhysicalCellHypothesisFormationMetrics, PhysicalCellHypothesis, PhysicalCellHypothesisFormationGroup, PhysicalCellHypothesisFormationPage, PhysicalCellHypothesisFormationRegion, PhysicalCellHypothesisSegmentDisposition, PhysicalGridIntersection, RegionPhysicalCellHypothesisFormationMetrics } from "./budget-document-physical-cell-hypothesis-formation.types";

/**
 * Fonte única de classificação de disposição de segmento em categoria métrica
 * pública. Usada por computeRegionMetrics e pelo portão de conservação de
 * métricas (physical-cell-hypothesis-formation-conservation.ts) para que as
 * duas nunca possam divergir por definição. Retorna null para um status não
 * reconhecido — nunca deve ocorrer para uma PhysicalCellHypothesisSegmentDisposition
 * real, mas o portão de conservação trata isso como falha, não como omissão silenciosa.
 */
export type PhysicalCellSegmentMetricCategory =
  | "included" | "outside" | "inheritedAmbiguous" | "partialIntersection" | "multipleClaim"
  | "sourceContractInconsistent" | "upstreamRegionNotProcessable" | "inheritedPhysicalColumnHypothesisFailure" | "formationFailed";

export function classifyPhysicalCellSegmentMetricCategory(disposition: PhysicalCellHypothesisSegmentDisposition): PhysicalCellSegmentMetricCategory | null {
  switch (disposition.status) {
    case "included_in_physical_cell_hypothesis": return "included";
    case "outside_all_physical_cell_hypotheses": return "outside";
    case "unresolved_inherited_column_ambiguity": return "inheritedAmbiguous";
    case "unresolved_partial_grid_intersection": return "partialIntersection";
    case "unresolved_multiple_grid_intersection_claim": return "multipleClaim";
    case "unresolved_source_contract_inconsistency": return "sourceContractInconsistent";
    case "unresolved_upstream_region_not_processable": return "upstreamRegionNotProcessable";
    case "unresolved_inherited_physical_column_hypothesis_failure": return "inheritedPhysicalColumnHypothesisFailure";
    case "unresolved_cell_hypothesis_formation_failed": return "formationFailed";
    default: return null;
  }
}

function emptySegmentMetricCategoryCounts(): Record<PhysicalCellSegmentMetricCategory, number> {
  return { included: 0, outside: 0, inheritedAmbiguous: 0, partialIntersection: 0, multipleClaim: 0, sourceContractInconsistent: 0, upstreamRegionNotProcessable: 0, inheritedPhysicalColumnHypothesisFailure: 0, formationFailed: 0 };
}

export function tallySegmentMetricCategories(dispositions: ReadonlyArray<PhysicalCellHypothesisSegmentDisposition>): Record<PhysicalCellSegmentMetricCategory, number> {
  const counts = emptySegmentMetricCategoryCounts();
  for (const disposition of dispositions) {
    const category = classifyPhysicalCellSegmentMetricCategory(disposition);
    if (category) counts[category] += 1;
  }
  return counts;
}

export function computeRegionMetrics(intersections: ReadonlyArray<PhysicalGridIntersection>, cells: ReadonlyArray<PhysicalCellHypothesis>, dispositions: ReadonlyArray<PhysicalCellHypothesisSegmentDisposition>, lineCount: number, columnCount: number, problemCount: number): RegionPhysicalCellHypothesisFormationMetrics {
  const categoryCounts = tallySegmentMetricCategories(dispositions);
  return {
    sourceLineCount: lineCount, sourcePhysicalColumnHypothesisCount: columnCount, totalGridIntersectionCount: intersections.length,
    cellHypothesisFormedIntersectionCount: intersections.filter((entry) => entry.status === "cell_hypothesis_formed").length,
    emptyGridIntersectionCount: intersections.filter((entry) => entry.status === "empty").length,
    ambiguousGridIntersectionCount: intersections.filter((entry) => entry.status === "unresolved_segment_association_ambiguity").length,
    formationFailedGridIntersectionCount: intersections.filter((entry) => entry.status === "unresolved_technical_failure").length,
    totalRegionSegmentCount: dispositions.length,
    includedSegmentCount: categoryCounts.included,
    outsideSegmentCount: categoryCounts.outside,
    inheritedAmbiguousSegmentCount: categoryCounts.inheritedAmbiguous,
    partialIntersectionSegmentCount: categoryCounts.partialIntersection,
    multipleClaimSegmentCount: categoryCounts.multipleClaim,
    sourceContractInconsistentSegmentCount: categoryCounts.sourceContractInconsistent,
    upstreamRegionNotProcessableSegmentCount: categoryCounts.upstreamRegionNotProcessable,
    inheritedPhysicalColumnHypothesisFailureSegmentCount: categoryCounts.inheritedPhysicalColumnHypothesisFailure,
    formationFailedSegmentCount: categoryCounts.formationFailed,
    cellHypothesisCount: cells.length, multiSegmentCellHypothesisCount: cells.filter((entry) => entry.segmentKeys.length > 1).length, technicalProblemCount: problemCount,
  };
}

export function computePageMetrics(regions: ReadonlyArray<PhysicalCellHypothesisFormationRegion>): PagePhysicalCellHypothesisFormationMetrics {
  const metrics = regions.map((entry) => entry.metrics);
  return { totalRegionCount: regions.length, formedRegionCount: regions.filter((entry) => entry.status === "formed").length, formedWithAmbiguitiesRegionCount: regions.filter((entry) => entry.status === "formed_with_ambiguities").length, formedWithProblemsRegionCount: regions.filter((entry) => entry.status === "formed_with_problems").length, gridWithoutCellHypothesesRegionCount: regions.filter((entry) => entry.status === "grid_without_cell_hypotheses").length, noPhysicalGridRegionCount: regions.filter((entry) => entry.status === "no_physical_grid").length, regionNotProcessableCount: regions.filter((entry) => entry.status === "region_not_processable").length, gridIntersectionCount: metrics.reduce((sum, entry) => sum + entry.totalGridIntersectionCount, 0), emptyGridIntersectionCount: metrics.reduce((sum, entry) => sum + entry.emptyGridIntersectionCount, 0), cellHypothesisCount: metrics.reduce((sum, entry) => sum + entry.cellHypothesisCount, 0), multiSegmentCellHypothesisCount: metrics.reduce((sum, entry) => sum + entry.multiSegmentCellHypothesisCount, 0), segmentCount: metrics.reduce((sum, entry) => sum + entry.totalRegionSegmentCount, 0), includedSegmentCount: metrics.reduce((sum, entry) => sum + entry.includedSegmentCount, 0), upstreamRegionNotProcessableSegmentCount: metrics.reduce((sum, entry) => sum + entry.upstreamRegionNotProcessableSegmentCount, 0), inheritedPhysicalColumnHypothesisFailureSegmentCount: metrics.reduce((sum, entry) => sum + entry.inheritedPhysicalColumnHypothesisFailureSegmentCount, 0), ambiguousSegmentCount: metrics.reduce((sum, entry) => sum + entry.inheritedAmbiguousSegmentCount + entry.partialIntersectionSegmentCount + entry.multipleClaimSegmentCount, 0), formationFailedSegmentCount: metrics.reduce((sum, entry) => sum + entry.formationFailedSegmentCount, 0), technicalProblemCount: metrics.reduce((sum, entry) => sum + entry.technicalProblemCount, 0) };
}

export function computeGroupMetrics(pages: ReadonlyArray<PhysicalCellHypothesisFormationPage>): GroupPhysicalCellHypothesisFormationMetrics {
  const metrics = pages.map((entry) => entry.metrics);
  return { totalPageCount: pages.length, formedPageCount: pages.filter((entry) => entry.status === "formed").length, formedWithAmbiguitiesPageCount: pages.filter((entry) => entry.status === "formed_with_ambiguities").length, formedWithProblemsPageCount: pages.filter((entry) => entry.status === "formed_with_problems").length, noPhysicalGridPageCount: pages.filter((entry) => entry.status === "no_physical_grid").length, pageNotProcessableCount: pages.filter((entry) => entry.status === "page_not_processable").length, gridIntersectionCount: metrics.reduce((sum, entry) => sum + entry.gridIntersectionCount, 0), emptyGridIntersectionCount: metrics.reduce((sum, entry) => sum + entry.emptyGridIntersectionCount, 0), cellHypothesisCount: metrics.reduce((sum, entry) => sum + entry.cellHypothesisCount, 0), multiSegmentCellHypothesisCount: metrics.reduce((sum, entry) => sum + entry.multiSegmentCellHypothesisCount, 0), segmentCount: metrics.reduce((sum, entry) => sum + entry.segmentCount, 0), includedSegmentCount: metrics.reduce((sum, entry) => sum + entry.includedSegmentCount, 0), upstreamRegionNotProcessableSegmentCount: metrics.reduce((sum, entry) => sum + entry.upstreamRegionNotProcessableSegmentCount, 0), inheritedPhysicalColumnHypothesisFailureSegmentCount: metrics.reduce((sum, entry) => sum + entry.inheritedPhysicalColumnHypothesisFailureSegmentCount, 0), ambiguousSegmentCount: metrics.reduce((sum, entry) => sum + entry.ambiguousSegmentCount, 0), formationFailedSegmentCount: metrics.reduce((sum, entry) => sum + entry.formationFailedSegmentCount, 0), technicalProblemCount: metrics.reduce((sum, entry) => sum + entry.technicalProblemCount, 0) };
}

export function computeGlobalMetrics(groups: ReadonlyArray<PhysicalCellHypothesisFormationGroup>): GlobalPhysicalCellHypothesisFormationMetrics {
  const metrics = groups.map((entry) => entry.metrics);
  return { receivedGroupCount: groups.length, formedGroupCount: groups.filter((entry) => entry.status === "formed").length, formedWithAmbiguitiesGroupCount: groups.filter((entry) => entry.status === "formed_with_ambiguities").length, formedWithProblemsGroupCount: groups.filter((entry) => entry.status === "formed_with_problems").length, noPhysicalGridGroupCount: groups.filter((entry) => entry.status === "no_physical_grid").length, groupNotProcessableCount: groups.filter((entry) => entry.status === "group_not_processable").length, candidatePageCount: metrics.reduce((sum, entry) => sum + entry.totalPageCount, 0), candidateRegionCount: groups.reduce((sum, group) => sum + group.pages.reduce((pageSum, page) => pageSum + page.metrics.totalRegionCount, 0), 0), gridIntersectionCount: metrics.reduce((sum, entry) => sum + entry.gridIntersectionCount, 0), emptyGridIntersectionCount: metrics.reduce((sum, entry) => sum + entry.emptyGridIntersectionCount, 0), cellHypothesisCount: metrics.reduce((sum, entry) => sum + entry.cellHypothesisCount, 0), multiSegmentCellHypothesisCount: metrics.reduce((sum, entry) => sum + entry.multiSegmentCellHypothesisCount, 0), segmentCount: metrics.reduce((sum, entry) => sum + entry.segmentCount, 0), includedSegmentCount: metrics.reduce((sum, entry) => sum + entry.includedSegmentCount, 0), upstreamRegionNotProcessableSegmentCount: metrics.reduce((sum, entry) => sum + entry.upstreamRegionNotProcessableSegmentCount, 0), inheritedPhysicalColumnHypothesisFailureSegmentCount: metrics.reduce((sum, entry) => sum + entry.inheritedPhysicalColumnHypothesisFailureSegmentCount, 0), ambiguousSegmentCount: metrics.reduce((sum, entry) => sum + entry.ambiguousSegmentCount, 0), formationFailedSegmentCount: metrics.reduce((sum, entry) => sum + entry.formationFailedSegmentCount, 0), technicalProblemCount: metrics.reduce((sum, entry) => sum + entry.technicalProblemCount, 0) };
}
