import { buildPhysicalColumnHypothesisReconstructionFixture, type SyntheticGeometryPage, type SyntheticGeometryTextItem } from "../physical-column-hypothesis-reconstruction/testing/physical-column-hypothesis-reconstruction-test-bridge";
import { reconstructBudgetDocumentPhysicalColumnHypotheses } from "../physical-column-hypothesis-reconstruction";
import { formBudgetDocumentPhysicalCellHypotheses } from "./form-budget-document-physical-cell-hypotheses";
import { validatePhysicalCellFormationConservation, validateSegmentMetricConservation } from "./physical-cell-hypothesis-formation-conservation";
import type { PhysicalCellHypothesis, PhysicalCellHypothesisSegmentDisposition, PhysicalGridIntersection, RegionPhysicalCellHypothesisFormationMetrics } from "./budget-document-physical-cell-hypothesis-formation.types";

const items: SyntheticGeometryTextItem[] = Array.from({ length: 4 }, (_, row) => { const top = 700 - row * 25; return [{ text: `a${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + 12, index: row * 2 }, { text: `b${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + 12, index: row * 2 + 1 }]; }).flat();
const page: SyntheticGeometryPage = { widthPoints: 612, heightPoints: 792, items };
const upstream = buildPhysicalColumnHypothesisReconstructionFixture("conservation", [page]);
const result = formBudgetDocumentPhysicalCellHypotheses({ ...upstream, physicalColumnHypothesisReconstruction: reconstructBudgetDocumentPhysicalColumnHypotheses(upstream) });
const region = result.groups[0].pages[0].regions[0];
const segmentKeys = region.segmentDispositions.map((entry) => entry.segmentKey);
const validate = (intersections: ReadonlyArray<PhysicalGridIntersection>, cells: ReadonlyArray<PhysicalCellHypothesis>, dispositions: ReadonlyArray<PhysicalCellHypothesisSegmentDisposition>) => validatePhysicalCellFormationConservation(4, 2, segmentKeys, intersections, cells, dispositions);
if (validate(region.gridIntersections, region.cellHypotheses, region.segmentDispositions) !== null) throw new Error("valid conservation fixture failed");

const cell = region.cellHypotheses[0];
const included = region.segmentDispositions.find((entry) => entry.status === "included_in_physical_cell_hypothesis" && entry.cellHypothesisKey === cell.cellHypothesisKey)!;
const wrongCell = region.cellHypotheses[1];
const cases: ReadonlyArray<[string, ReadonlyArray<PhysicalGridIntersection>, ReadonlyArray<PhysicalCellHypothesis>, ReadonlyArray<PhysicalCellHypothesisSegmentDisposition>]> = [
  ["cell segment outside region", region.gridIntersections, [{ ...cell, segmentKeys: [...cell.segmentKeys, "outside"] }, ...region.cellHypotheses.slice(1)], region.segmentDispositions],
  ["cell segment without included disposition", region.gridIntersections, region.cellHypotheses, region.segmentDispositions.filter((entry) => entry.segmentKey !== included.segmentKey)],
  ["included points to another cell", region.gridIntersections, region.cellHypotheses, region.segmentDispositions.map((entry) => entry === included ? { ...included, cellHypothesisKey: wrongCell.cellHypothesisKey } : entry)],
  ["included points to another intersection", region.gridIntersections, region.cellHypotheses, region.segmentDispositions.map((entry) => entry === included ? { ...included, gridIntersectionKey: wrongCell.gridIntersectionKey } : entry)],
  ["included segment absent from cell", region.gridIntersections, [{ ...cell, segmentKeys: [] }, ...region.cellHypotheses.slice(1)], region.segmentDispositions],
  ["missing disposition marker", region.gridIntersections, region.cellHypotheses, region.segmentDispositions.map((entry) => entry === included ? { status: "unresolved_cell_hypothesis_formation_failed", segmentKey: entry.segmentKey, lineKey: entry.lineKey, failedPhase: "cell_hypothesis_formation" } : entry)],
];
for (const [name, intersections, cells, dispositions] of cases) {
  if (validate(intersections, cells, dispositions) === null) throw new Error(`conservation did not reject ${name}`);
}
console.log("ok - conservation proves every cell/disposition/intersection/region-segment reference in both directions");

const categoryDispositions: ReadonlyArray<PhysicalCellHypothesisSegmentDisposition> = [
  { status: "included_in_physical_cell_hypothesis", segmentKey: "included", lineKey: "line-1", gridIntersectionKey: "grid-1", cellHypothesisKey: "cell-1" },
  { status: "outside_all_physical_cell_hypotheses", segmentKey: "outside", lineKey: "line-1" },
  { status: "unresolved_inherited_column_ambiguity", segmentKey: "inherited-ambiguous", lineKey: "line-2", conflictingCandidateHypothesisKeys: ["candidate-a", "candidate-b"] },
  { status: "unresolved_partial_grid_intersection", segmentKey: "partial", lineKey: "line-2", partiallyIntersectedGridIntersectionKeys: ["grid-2"] },
  { status: "unresolved_multiple_grid_intersection_claim", segmentKey: "multiple-claim", lineKey: "line-3", claimingGridIntersectionKeys: ["grid-3", "grid-4"] },
  { status: "unresolved_source_contract_inconsistency", segmentKey: "source-inconsistent", lineKey: "line-3", claimingPhysicalColumnHypothesisKeys: ["hypothesis-a", "hypothesis-b"] },
  { status: "unresolved_upstream_region_not_processable", segmentKey: "upstream-not-processable", lineKey: "line-4", sourcePhysicalColumnHypothesisRegionStatus: "region_not_processable", upstreamDispositionStatus: "not_in_physical_column_hypothesis" },
  { status: "unresolved_inherited_physical_column_hypothesis_failure", segmentKey: "inherited-failure", lineKey: "line-4", upstreamFailedPhase: "band_construction", upstreamDispositionStatus: "unresolved_physical_column_hypothesis_detection_failed" },
  { status: "unresolved_cell_hypothesis_formation_failed", segmentKey: "formation-failed", lineKey: "line-5", failedPhase: "segment_association" },
];
const validCategoryMetrics: RegionPhysicalCellHypothesisFormationMetrics = {
  sourceLineCount: 5, sourcePhysicalColumnHypothesisCount: 1, totalGridIntersectionCount: 9,
  cellHypothesisFormedIntersectionCount: 1, emptyGridIntersectionCount: 0, ambiguousGridIntersectionCount: 0, formationFailedGridIntersectionCount: 0,
  totalRegionSegmentCount: 9, includedSegmentCount: 1, outsideSegmentCount: 1, inheritedAmbiguousSegmentCount: 1, partialIntersectionSegmentCount: 1, multipleClaimSegmentCount: 1, sourceContractInconsistentSegmentCount: 1, upstreamRegionNotProcessableSegmentCount: 1, inheritedPhysicalColumnHypothesisFailureSegmentCount: 1, formationFailedSegmentCount: 1,
  cellHypothesisCount: 1, multiSegmentCellHypothesisCount: 0, technicalProblemCount: 0,
};
if (!validateSegmentMetricConservation(categoryDispositions, validCategoryMetrics)) throw new Error("valid segment metric conservation fixture was rejected");

const adversarialCases: ReadonlyArray<[string, ReadonlyArray<PhysicalCellHypothesisSegmentDisposition>, RegionPhysicalCellHypothesisFormationMetrics]> = [
  ["missing count (category undercounted, total left stale)", categoryDispositions, { ...validCategoryMetrics, upstreamRegionNotProcessableSegmentCount: 0 }],
  ["duplicated count (category overcounted, total left stale)", categoryDispositions, { ...validCategoryMetrics, includedSegmentCount: 2 }],
  ["wrong category (swap between two categories, total still closes)", categoryDispositions, { ...validCategoryMetrics, includedSegmentCount: 0, outsideSegmentCount: 2 }],
  ["total different from the sum of correct categories", categoryDispositions, { ...validCategoryMetrics, totalRegionSegmentCount: 10 }],
  ["disposition unrecognized by the internal classifier", [...categoryDispositions, { status: "unknown_disposition_status", segmentKey: "bogus", lineKey: "line-6" } as unknown as PhysicalCellHypothesisSegmentDisposition], { ...validCategoryMetrics, totalRegionSegmentCount: 10 }],
];
for (const [name, dispositions, metrics] of adversarialCases) {
  if (validateSegmentMetricConservation(dispositions, metrics)) throw new Error(`segment metric conservation did not reject ${name}`);
}
console.log("ok - segment metric conservation gate rejects missing, duplicated, mis-categorized, mis-totaled and unrecognized dispositions");
