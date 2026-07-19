import type { PhysicalCellHypothesis, PhysicalCellHypothesisSegmentDisposition, PhysicalGridIntersection, RegionPhysicalCellHypothesisFormationMetrics } from "./budget-document-physical-cell-hypothesis-formation.types";
import { classifyPhysicalCellSegmentMetricCategory, tallySegmentMetricCategories, type PhysicalCellSegmentMetricCategory } from "./physical-cell-hypothesis-formation-metrics";

export type ConservationFailure = "intersections" | "segments" | "references" | null;

const SEGMENT_METRIC_CATEGORY_FIELDS: Record<PhysicalCellSegmentMetricCategory, keyof RegionPhysicalCellHypothesisFormationMetrics> = {
  included: "includedSegmentCount",
  outside: "outsideSegmentCount",
  inheritedAmbiguous: "inheritedAmbiguousSegmentCount",
  partialIntersection: "partialIntersectionSegmentCount",
  multipleClaim: "multipleClaimSegmentCount",
  sourceContractInconsistent: "sourceContractInconsistentSegmentCount",
  upstreamRegionNotProcessable: "upstreamRegionNotProcessableSegmentCount",
  inheritedPhysicalColumnHypothesisFailure: "inheritedPhysicalColumnHypothesisFailureSegmentCount",
  formationFailed: "formationFailedSegmentCount",
};

/**
 * Prova que totalRegionSegmentCount é exatamente a soma das nove categorias
 * públicas de segmento e que cada disposição foi contabilizada em exatamente
 * uma delas — nunca omitida, duplicada ou classificada na categoria errada.
 * Não confia apenas em dispositions.length: recalcula a contagem real de cada
 * categoria a partir das próprias disposições (via a mesma fonte única de
 * classificação usada por computeRegionMetrics) e compara campo a campo com
 * as métricas publicadas.
 */
export function validateSegmentMetricConservation(dispositions: ReadonlyArray<PhysicalCellHypothesisSegmentDisposition>, metrics: RegionPhysicalCellHypothesisFormationMetrics): boolean {
  if (metrics.totalRegionSegmentCount !== dispositions.length) return false;
  if (dispositions.some((entry) => classifyPhysicalCellSegmentMetricCategory(entry) === null)) return false;
  const counts = tallySegmentMetricCategories(dispositions);
  const sumOfCategories = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (metrics.totalRegionSegmentCount !== sumOfCategories) return false;
  for (const category of Object.keys(counts) as ReadonlyArray<PhysicalCellSegmentMetricCategory>) {
    if (metrics[SEGMENT_METRIC_CATEGORY_FIELDS[category]] !== counts[category]) return false;
  }
  return true;
}

export function validatePhysicalCellFormationConservation(
  sourceLineCount: number,
  sourceColumnCount: number,
  sourceSegmentKeys: ReadonlyArray<string>,
  intersections: ReadonlyArray<PhysicalGridIntersection>,
  cells: ReadonlyArray<PhysicalCellHypothesis>,
  dispositions: ReadonlyArray<PhysicalCellHypothesisSegmentDisposition>,
): ConservationFailure {
  if (intersections.length !== sourceLineCount * sourceColumnCount) return "intersections";
  if (new Set(intersections.map((entry) => entry.gridIntersectionKey)).size !== intersections.length) return "intersections";
  const classifiedIntersections = intersections.filter((entry) => entry.status === "cell_hypothesis_formed" || entry.status === "empty" || entry.status === "unresolved_segment_association_ambiguity" || entry.status === "unresolved_technical_failure").length;
  if (classifiedIntersections !== intersections.length) return "intersections";

  if (dispositions.length !== sourceSegmentKeys.length || new Set(dispositions.map((entry) => entry.segmentKey)).size !== dispositions.length) return "segments";
  if (sourceSegmentKeys.some((key) => !dispositions.some((entry) => entry.segmentKey === key))) return "segments";
  if (dispositions.some((entry) => entry.status === "unresolved_cell_hypothesis_formation_failed")) return "segments";

  if (new Set(cells.map((entry) => entry.cellHypothesisKey)).size !== cells.length) return "references";
  const intersectionByKey = new Map(intersections.map((entry) => [entry.gridIntersectionKey, entry]));
  const cellByKey = new Map(cells.map((entry) => [entry.cellHypothesisKey, entry]));
  for (const cell of cells) {
    const intersection = intersectionByKey.get(cell.gridIntersectionKey);
    if (!intersection || intersection.status !== "cell_hypothesis_formed" || intersection.cellHypothesisKey !== cell.cellHypothesisKey || cell.segmentKeys.length === 0) return "references";
  }
  for (const intersection of intersections) {
    if (intersection.status === "cell_hypothesis_formed" && cellByKey.get(intersection.cellHypothesisKey)?.gridIntersectionKey !== intersection.gridIntersectionKey) return "references";
  }
  const included = dispositions.filter((entry) => entry.status === "included_in_physical_cell_hypothesis");
  if (new Set(included.map((entry) => entry.segmentKey)).size !== included.length) return "segments";
  const cellSegmentKeys = cells.flatMap((entry) => entry.segmentKeys);
  if (new Set(cellSegmentKeys).size !== cellSegmentKeys.length) return "segments";
  const sourceSegmentSet = new Set(sourceSegmentKeys);
  const includedBySegment = new Map(included.map((entry) => [entry.segmentKey, entry]));
  for (const cell of cells) {
    const intersection = intersectionByKey.get(cell.gridIntersectionKey);
    for (const segmentKey of cell.segmentKeys) {
      const disposition = includedBySegment.get(segmentKey);
      if (!sourceSegmentSet.has(segmentKey) || !disposition
        || disposition.cellHypothesisKey !== cell.cellHypothesisKey
        || disposition.gridIntersectionKey !== cell.gridIntersectionKey
        || intersection?.status !== "cell_hypothesis_formed"
        || intersection.cellHypothesisKey !== cell.cellHypothesisKey) return "segments";
    }
  }
  for (const disposition of included) {
    const cell = cellByKey.get(disposition.cellHypothesisKey);
    const intersection = intersectionByKey.get(disposition.gridIntersectionKey);
    if (!cell || !cell.segmentKeys.includes(disposition.segmentKey)
      || cell.gridIntersectionKey !== disposition.gridIntersectionKey
      || intersection?.status !== "cell_hypothesis_formed"
      || intersection.cellHypothesisKey !== disposition.cellHypothesisKey) return "segments";
  }
  return null;
}
