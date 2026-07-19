import type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "./testing/physical-cell-text-evidence-formation-test-bridge";
import { buildPhysicalCellTextEvidenceFormationFixture, formBudgetDocumentPhysicalCellTextEvidenceWithDependencies, getDefaultPhysicalCellTextEvidenceFormationDependencies } from "./testing/physical-cell-text-evidence-formation-test-bridge";

const items: SyntheticGeometryTextItem[] = Array.from({ length: 4 }, (_, row) => {
  const top = 700 - row * 25;
  return [
    { text: `a-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + 12, index: row * 2 },
    { text: `b-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + 12, index: row * 2 + 1 },
  ];
}).flat();
const page: SyntheticGeometryPage = { widthPoints: 612, heightPoints: 792, items };
function fixture() {
  return buildPhysicalCellTextEvidenceFormationFixture("failure", [page]);
}

function fail(name: string, overrides: Partial<ReturnType<typeof getDefaultPhysicalCellTextEvidenceFormationDependencies>>, expectedRegion: string, expectedGlobal = "completed_with_problems"): void {
  const dependencies = { ...getDefaultPhysicalCellTextEvidenceFormationDependencies(), ...overrides };
  const result = formBudgetDocumentPhysicalCellTextEvidenceWithDependencies(fixture(), dependencies);
  if (result.status !== expectedGlobal || result.groups[0]?.pages[0]?.regions[0]?.status !== expectedRegion) {
    throw new Error(`${name}: ${JSON.stringify({ status: result.status, regionStatus: result.groups[0]?.pages[0]?.regions[0]?.status })}`);
  }
  console.log(`ok - ${name}`);
}

const throwing = () => {
  throw new Error("controlled");
};
fail("formRegionCellTextEvidences failure materializes a formed_with_problems region", { formRegionCellTextEvidences: throwing }, "formed_with_problems");
fail("runConservationGates failure is reported locally", { runConservationGates: () => "text_item_occurrence" }, "formed_with_problems");

const global = formBudgetDocumentPhysicalCellTextEvidenceWithDependencies(fixture(), { ...getDefaultPhysicalCellTextEvidenceFormationDependencies(), beforeGlobalProcessing: throwing });
if (global.status !== "failed" || global.technicalProblems[0]?.code !== "physical_cell_text_evidence_formation_unexpected_failure") throw new Error("global failure seam was not honored");
console.log("ok - genuinely global unexpected failure remains global");
