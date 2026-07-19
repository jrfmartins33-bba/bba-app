import type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "./testing/physical-cell-text-evidence-formation-test-bridge";
import { buildPhysicalCellTextEvidenceFormationFixture, formBudgetDocumentPhysicalCellTextEvidenceWithDependencies, getDefaultPhysicalCellTextEvidenceFormationDependencies, type PhysicalCellTextEvidenceFormationDependencies } from "./testing/physical-cell-text-evidence-formation-test-bridge";

const items: SyntheticGeometryTextItem[] = Array.from({ length: 4 }, (_, row) => {
  const top = 700 - row * 25;
  return [
    { text: `a-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + 12, index: row * 2 },
    { text: `b-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + 12, index: row * 2 + 1 },
  ];
}).flat();
const page: SyntheticGeometryPage = { widthPoints: 612, heightPoints: 792, items };
function fixture() {
  return buildPhysicalCellTextEvidenceFormationFixture("two-independent-regions", [page, page]);
}

type InjectablePhase = "formRegionCellTextEvidences" | "runConservationGates";
function failFirstCall(phase: InjectablePhase): PhysicalCellTextEvidenceFormationDependencies {
  const defaults = getDefaultPhysicalCellTextEvidenceFormationDependencies();
  let calls = 0;
  const original = defaults[phase] as (...args: never[]) => unknown;
  return {
    ...defaults,
    [phase]: (...args: never[]) => {
      calls += 1;
      if (calls === 1) {
        if (phase === "runConservationGates") return "cell_hypothesis";
        throw new Error("first region only");
      }
      return original(...args);
    },
  } as PhysicalCellTextEvidenceFormationDependencies;
}

for (const phase of ["formRegionCellTextEvidences", "runConservationGates"] as const) {
  const result = formBudgetDocumentPhysicalCellTextEvidenceWithDependencies(fixture(), failFirstCall(phase));
  const regions = result.groups.flatMap((group) => group.pages.flatMap((candidatePage) => candidatePage.regions));
  if (result.status !== "completed_with_problems" || regions.length !== 2) throw new Error(`${phase}: global isolation status failed`);
  if (regions[0].status !== "formed_with_problems" || regions[0].technicalProblems.length !== 1) throw new Error(`${phase}: first region classification failed`);
  if (regions[1].status !== "formed" || regions[1].technicalProblems.length !== 0 || regions[1].cellTextEvidences.length === 0) throw new Error(`${phase}: independent second region was lost`);
  if (result.metrics.technicalProblemCount !== 1) throw new Error(`${phase}: technical problem was lost or duplicated`);
}
console.log("ok - a failure in either formRegionCellTextEvidences or runConservationGates stays isolated to the first of two independent regions while the second remains fully formed");
