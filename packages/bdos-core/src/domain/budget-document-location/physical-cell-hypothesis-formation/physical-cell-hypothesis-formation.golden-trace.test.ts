import { buildPhysicalColumnHypothesisReconstructionFixture, type SyntheticGeometryPage, type SyntheticGeometryTextItem } from "../physical-column-hypothesis-reconstruction/testing/physical-column-hypothesis-reconstruction-test-bridge";
import { reconstructBudgetDocumentPhysicalColumnHypotheses } from "../physical-column-hypothesis-reconstruction";
import { formBudgetDocumentPhysicalCellHypotheses } from "./form-budget-document-physical-cell-hypotheses";

const items: SyntheticGeometryTextItem[] = Array.from({ length: 4 }, (_, row) => {
  const top = 700 - row * 25;
  return [
    { text: `right-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + 12, index: row },
    ...(row < 3 ? [{ text: `left-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + 12, index: 4 + row }] : []),
  ];
}).flat();
const page: SyntheticGeometryPage = { widthPoints: 612, heightPoints: 792, items };
const upstream = buildPhysicalColumnHypothesisReconstructionFixture("golden-trace-four-lines", [page]);
const input = { ...upstream, physicalColumnHypothesisReconstruction: reconstructBudgetDocumentPhysicalColumnHypotheses(upstream) };
const result = formBudgetDocumentPhysicalCellHypotheses(input);
if (result.status === "failed") throw new Error(`golden trace failed: ${JSON.stringify(result.technicalProblems)}`);
const region = result.groups[0].pages[0].regions[0];
const snapshot = {
  status: result.status,
  regionStatus: region.status,
  intersections: region.gridIntersections.length,
  cells: region.cellHypotheses.length,
  empty: region.gridIntersections.filter((entry) => entry.status === "empty").length,
  dispositions: region.segmentDispositions.length,
  fingerprint: result.formationContextFingerprint,
};
const expected = { status: "completed", regionStatus: "formed", intersections: 8, cells: 7, empty: 1, dispositions: 7, fingerprint: "29713aa3c03caa2aa08e50bb387bf22f2da7ec56e77443611fa6d6087d94e22e" };
if (JSON.stringify(snapshot) !== JSON.stringify(expected)) throw new Error(`golden trace changed: ${JSON.stringify(snapshot)}`);
console.log("ok - four-line golden trace preserves the real f.2b minimum-support contract and full f.2c fingerprint");
