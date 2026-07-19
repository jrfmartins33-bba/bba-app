import type { PhysicalCellHypothesis, PhysicalCellHypothesisSegmentDisposition, PhysicalGridIntersection } from "./budget-document-physical-cell-hypothesis-formation.types";

export type ConservationFailure = "intersections" | "segments" | "references" | null;

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
