import { buildPhysicalColumnHypothesisReconstructionFixture, type SyntheticGeometryPage, type SyntheticGeometryTextItem } from "../physical-column-hypothesis-reconstruction/testing/physical-column-hypothesis-reconstruction-test-bridge";
import { reconstructBudgetDocumentPhysicalColumnHypotheses } from "../physical-column-hypothesis-reconstruction";
import { formBudgetDocumentPhysicalCellHypotheses } from "./form-budget-document-physical-cell-hypotheses";
import { replaceAndResignColumnGroups } from "./testing/physical-cell-hypothesis-formation-test-bridge";

const items: SyntheticGeometryTextItem[] = Array.from({ length: 4 }, (_, row) => { const top = 700 - row * 25; return [{ text: `a-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + 12, index: row * 2 }, { text: `b-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + 12, index: row * 2 + 1 }]; }).flat();
const page: SyntheticGeometryPage = { widthPoints: 612, heightPoints: 792, items };
function fixture() { const upstream = buildPhysicalColumnHypothesisReconstructionFixture("status", [page]); return { ...upstream, physicalColumnHypothesisReconstruction: reconstructBudgetDocumentPhysicalColumnHypotheses(upstream) }; }

{
  const input = fixture(); const group = input.physicalColumnHypothesisReconstruction.groups[0]; const columnPage = group.pages[0]; const region = columnPage.regions[0];
  const changed = replaceAndResignColumnGroups(input, [{ ...group, status: "hypotheses_reconstructed_with_problems", pages: [{ ...columnPage, status: "hypotheses_reconstructed_with_problems", regions: [{ ...region, status: "region_not_processable" }] }] }]);
  const result = formBudgetDocumentPhysicalCellHypotheses(changed); const output = result.groups[0].pages[0].regions[0];
  if (output.status !== "region_not_processable" || output.gridIntersections.length !== 0 || output.cellHypotheses.length !== 0) throw new Error("region_not_processable was reprocessed");
  console.log("ok - upstream region_not_processable is preserved without grid formation");
}
{
  const input = fixture(); const group = input.physicalColumnHypothesisReconstruction.groups[0]; const columnPage = group.pages[0];
  const changed = replaceAndResignColumnGroups(input, [{ ...group, status: "hypotheses_reconstructed_with_problems", pages: [{ ...columnPage, status: "page_not_processable", regions: [] }] }]);
  const output = formBudgetDocumentPhysicalCellHypotheses(changed).groups[0].pages[0];
  if (output.status !== "page_not_processable" || output.regions.length !== 0) throw new Error("page_not_processable was reprocessed");
  console.log("ok - upstream page_not_processable is preserved");
}
{
  const input = fixture(); const group = input.physicalColumnHypothesisReconstruction.groups[0];
  const changed = replaceAndResignColumnGroups(input, [{ ...group, status: "group_not_processable", pages: [] }]);
  const output = formBudgetDocumentPhysicalCellHypotheses(changed).groups[0];
  if (output.status !== "group_not_processable" || output.pages.length !== 0) throw new Error("group_not_processable was reprocessed");
  console.log("ok - upstream group_not_processable is preserved");
}
{
  const input = fixture(); const group = input.physicalColumnHypothesisReconstruction.groups[0]; const columnPage = group.pages[0]; const region = columnPage.regions[0]; const disposition = region.segmentDispositions[0];
  const failed = { status: "unresolved_physical_column_hypothesis_detection_failed" as const, segmentKey: disposition.segmentKey, lineKey: disposition.lineKey, failedPhase: "hypothesis_formation" as const };
  const changed = replaceAndResignColumnGroups(input, [{ ...group, pages: [{ ...columnPage, regions: [{ ...region, segmentDispositions: [failed, ...region.segmentDispositions.slice(1)] }] }] }]);
  const output = formBudgetDocumentPhysicalCellHypotheses(changed).groups[0].pages[0].regions[0];
  if (output.status !== "region_not_processable" || output.gridIntersections.length !== 0 || output.technicalProblems[0]?.code !== "source_physical_column_hypothesis_contract_invalid") throw new Error("detection_failed was hidden");
  console.log("ok - upstream detection_failed invalidates only its region and is never hidden as outside");
}
