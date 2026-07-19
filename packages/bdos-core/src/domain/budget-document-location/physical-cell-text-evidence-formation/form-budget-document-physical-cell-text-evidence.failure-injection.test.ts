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

// --- a falha inesperada regional nunca quebra a conservação pública ----------
{
  const baseline = formBudgetDocumentPhysicalCellTextEvidenceWithDependencies(fixture(), getDefaultPhysicalCellTextEvidenceFormationDependencies());
  const sourceRegion = baseline.groups[0].pages[0].regions[0];
  const sourceCellHypothesisCount = sourceRegion.cellTextEvidences.length;
  const sourceSegmentKeyCounts = sourceRegion.cellTextEvidences.map((entry) => entry.segmentOutcomes.length);

  const failed = formBudgetDocumentPhysicalCellTextEvidenceWithDependencies(fixture(), { ...getDefaultPhysicalCellTextEvidenceFormationDependencies(), formRegionCellTextEvidences: throwing });
  const region = failed.groups[0].pages[0].regions[0];

  if (region.metrics.sourceCellHypothesisCount !== sourceCellHypothesisCount) throw new Error("substitute region lost the source cell hypothesis count");
  if (region.cellTextEvidences.length !== sourceCellHypothesisCount) throw new Error("substitute region did not materialize one PhysicalCellTextEvidence per source cell hypothesis");
  if (region.metrics.sourceCellHypothesisCount !== region.metrics.cellTextEvidenceFormedCount + region.metrics.cellTextEvidencePartiallyFormedCount + region.metrics.cellTextEvidenceFailedCount) {
    throw new Error("substitute region violated sourceCellHypothesisCount === formed + partiallyFormed + failed");
  }
  if (region.metrics.cellTextEvidenceFailedCount !== sourceCellHypothesisCount) throw new Error("every substitute cell must be unresolved_technical_failure");
  if (!region.cellTextEvidences.every((entry) => entry.status === "unresolved_technical_failure")) throw new Error("substitute cells must all report unresolved_technical_failure");
  region.cellTextEvidences.forEach((entry, index) => {
    if (entry.segmentOutcomes.length !== sourceSegmentKeyCounts[index]) throw new Error("substitute cell lost a segmentKey that the source cell hypothesis declared");
    if (!entry.segmentOutcomes.every((outcome) => outcome.status === "unresolved_segment_formation_failed" && outcome.failedPhase === "fragment_assembly")) {
      throw new Error("every segmentKey of a substitute cell must report unresolved_segment_formation_failed with a coherent failedPhase");
    }
  });
  if (!region.technicalProblems.some((problem) => problem.code === "cell_text_evidence_formation_failed")) throw new Error("missing cell_text_evidence_formation_failed problem for the substitute region");
  console.log("ok - an unexpected regional failure materializes exactly one PhysicalCellTextEvidence per source cell hypothesis, one outcome per segmentKey, and never breaks sourceCellHypothesisCount === formed + partiallyFormed + failed");
}

const global = formBudgetDocumentPhysicalCellTextEvidenceWithDependencies(fixture(), { ...getDefaultPhysicalCellTextEvidenceFormationDependencies(), beforeGlobalProcessing: throwing });
if (global.status !== "failed" || global.technicalProblems[0]?.code !== "physical_cell_text_evidence_formation_unexpected_failure") throw new Error("global failure seam was not honored");
console.log("ok - genuinely global unexpected failure remains global");
