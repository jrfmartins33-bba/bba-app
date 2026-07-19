import { buildPhysicalColumnHypothesisReconstructionFixture, type SyntheticGeometryPage, type SyntheticGeometryTextItem } from "../physical-column-hypothesis-reconstruction/testing/physical-column-hypothesis-reconstruction-test-bridge";
import { reconstructBudgetDocumentPhysicalColumnHypotheses } from "../physical-column-hypothesis-reconstruction";
import { formBudgetDocumentPhysicalCellHypothesesWithDependencies, getDefaultPhysicalCellFormationDependencies } from "./testing/physical-cell-hypothesis-formation-test-bridge";

const items: SyntheticGeometryTextItem[] = Array.from({ length: 4 }, (_, row) => { const top = 700 - row * 25; return [{ text: `a-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + 12, index: row * 2 }, { text: `b-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + 12, index: row * 2 + 1 }]; }).flat();
const page: SyntheticGeometryPage = { widthPoints: 612, heightPoints: 792, items };
function fixture() { const upstream = buildPhysicalColumnHypothesisReconstructionFixture("failure", [page]); return { ...upstream, physicalColumnHypothesisReconstruction: reconstructBudgetDocumentPhysicalColumnHypotheses(upstream) }; }
function fail(name: string, overrides: Partial<ReturnType<typeof getDefaultPhysicalCellFormationDependencies>>, expectedRegion: string, expectedGlobal = "completed_with_problems"): void { const dependencies = { ...getDefaultPhysicalCellFormationDependencies(), ...overrides }; const result = formBudgetDocumentPhysicalCellHypothesesWithDependencies(fixture(), dependencies); if (result.status !== expectedGlobal || result.groups[0]?.pages[0]?.regions[0]?.status !== expectedRegion) throw new Error(`${name}: ${JSON.stringify(result)}`); console.log(`ok - ${name}`); }
const throwing = () => { throw new Error("controlled"); };
fail("grid failure is isolated as region_not_processable", { formGrid: throwing }, "region_not_processable");
fail("association failure materializes failed intersections", { associateSegments: throwing }, "formed_with_problems");
fail("cell formation failure materializes failed intersections", { formCells: throwing }, "formed_with_problems");
fail("containment failure materializes failed intersections", { validateContainment: throwing }, "formed_with_problems");
fail("canonicalization failure materializes failed intersections", { validateCanonicalization: throwing }, "formed_with_problems");
fail("conservation failure is reported locally", { validateConservation: () => "segments" }, "formed_with_problems");
const global = formBudgetDocumentPhysicalCellHypothesesWithDependencies(fixture(), { ...getDefaultPhysicalCellFormationDependencies(), beforeGlobalProcessing: throwing });
if (global.status !== "failed" || global.technicalProblems[0]?.code !== "physical_cell_hypothesis_formation_unexpected_failure") throw new Error("global failure seam was not honored");
console.log("ok - genuinely global unexpected failure remains global");
