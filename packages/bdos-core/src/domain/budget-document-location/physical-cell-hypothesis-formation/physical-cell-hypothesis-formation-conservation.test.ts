import { buildPhysicalColumnHypothesisReconstructionFixture, type SyntheticGeometryPage, type SyntheticGeometryTextItem } from "../physical-column-hypothesis-reconstruction/testing/physical-column-hypothesis-reconstruction-test-bridge";
import { reconstructBudgetDocumentPhysicalColumnHypotheses } from "../physical-column-hypothesis-reconstruction";
import { formBudgetDocumentPhysicalCellHypotheses } from "./form-budget-document-physical-cell-hypotheses";
import { validatePhysicalCellFormationConservation } from "./physical-cell-hypothesis-formation-conservation";
import type { PhysicalCellHypothesis, PhysicalCellHypothesisSegmentDisposition, PhysicalGridIntersection } from "./budget-document-physical-cell-hypothesis-formation.types";

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
