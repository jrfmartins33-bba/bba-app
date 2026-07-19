import { buildPhysicalColumnHypothesisReconstructionFixture, type SyntheticGeometryPage, type SyntheticGeometryTextItem } from "../physical-column-hypothesis-reconstruction/testing/physical-column-hypothesis-reconstruction-test-bridge";
import { reconstructBudgetDocumentPhysicalColumnHypotheses } from "../physical-column-hypothesis-reconstruction";
import { formBudgetDocumentPhysicalCellHypothesesWithDependencies, getDefaultPhysicalCellFormationDependencies, type PhysicalCellFormationDependencies } from "./testing/physical-cell-hypothesis-formation-test-bridge";

const items: SyntheticGeometryTextItem[] = Array.from({ length: 4 }, (_, row) => { const top = 700 - row * 25; return [{ text: `a-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + 12, index: row * 2 }, { text: `b-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + 12, index: row * 2 + 1 }]; }).flat();
const page: SyntheticGeometryPage = { widthPoints: 612, heightPoints: 792, items };
function fixture() { const upstream = buildPhysicalColumnHypothesisReconstructionFixture("two-independent-regions", [page, page]); return { ...upstream, physicalColumnHypothesisReconstruction: reconstructBudgetDocumentPhysicalColumnHypotheses(upstream) }; }

type InjectablePhase = "formGrid" | "associateSegments" | "formCells" | "validateContainment" | "validateConservation";
function failFirstCall(phase: InjectablePhase): PhysicalCellFormationDependencies {
  const defaults = getDefaultPhysicalCellFormationDependencies(); let calls = 0;
  const original = defaults[phase] as (...args: never[]) => unknown;
  return { ...defaults, [phase]: (...args: never[]) => { calls += 1; if (calls === 1) { if (phase === "validateConservation") return "segments"; throw new Error("first region only"); } return original(...args); } } as PhysicalCellFormationDependencies;
}

for (const phase of ["formGrid", "associateSegments", "formCells", "validateContainment", "validateConservation"] as const) {
  const result = formBudgetDocumentPhysicalCellHypothesesWithDependencies(fixture(), failFirstCall(phase));
  const regions = result.groups.flatMap((group) => group.pages.flatMap((candidatePage) => candidatePage.regions));
  if (result.status !== "completed_with_problems" || regions.length !== 2) throw new Error(`${phase}: global isolation status failed`);
  if (!new Set(["region_not_processable", "formed_with_problems"]).has(regions[0].status) || regions[0].technicalProblems.length !== 1) throw new Error(`${phase}: first region classification failed`);
  if (regions[1].status !== "formed" || regions[1].technicalProblems.length !== 0 || regions[1].gridIntersections.length === 0 || regions[1].cellHypotheses.length === 0) throw new Error(`${phase}: independent second region was lost`);
  if (result.metrics.technicalProblemCount !== 1) throw new Error(`${phase}: technical problem was lost or duplicated`);
}
console.log("ok - five phase failures stay in the first of two independent regions while the second remains fully formed");
