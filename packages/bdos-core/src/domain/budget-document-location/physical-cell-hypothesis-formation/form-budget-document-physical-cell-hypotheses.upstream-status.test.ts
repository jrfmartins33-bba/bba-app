import { buildPhysicalColumnHypothesisReconstructionFixture, type SyntheticGeometryPage, type SyntheticGeometryTextItem } from "../physical-column-hypothesis-reconstruction/testing/physical-column-hypothesis-reconstruction-test-bridge";
import { reconstructBudgetDocumentPhysicalColumnHypotheses } from "../physical-column-hypothesis-reconstruction";
import { formBudgetDocumentPhysicalCellHypotheses } from "./form-budget-document-physical-cell-hypotheses";
import { replaceAndResignColumnGroups } from "./testing/physical-cell-hypothesis-formation-test-bridge";
import type { RegionPhysicalCellHypothesisFormationMetrics } from "./budget-document-physical-cell-hypothesis-formation.types";

function segmentEquationHolds(metrics: RegionPhysicalCellHypothesisFormationMetrics): boolean {
  return metrics.totalRegionSegmentCount === metrics.includedSegmentCount + metrics.outsideSegmentCount + metrics.inheritedAmbiguousSegmentCount + metrics.partialIntersectionSegmentCount + metrics.multipleClaimSegmentCount + metrics.sourceContractInconsistentSegmentCount + metrics.upstreamRegionNotProcessableSegmentCount + metrics.inheritedPhysicalColumnHypothesisFailureSegmentCount + metrics.formationFailedSegmentCount;
}

const items: SyntheticGeometryTextItem[] = Array.from({ length: 4 }, (_, row) => { const top = 700 - row * 25; return [{ text: `a-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + 12, index: row * 2 }, { text: `b-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + 12, index: row * 2 + 1 }]; }).flat();
const page: SyntheticGeometryPage = { widthPoints: 612, heightPoints: 792, items };
function fixture() { const upstream = buildPhysicalColumnHypothesisReconstructionFixture("status", [page]); return { ...upstream, physicalColumnHypothesisReconstruction: reconstructBudgetDocumentPhysicalColumnHypotheses(upstream) }; }

{
  const input = fixture(); const group = input.physicalColumnHypothesisReconstruction.groups[0]; const columnPage = group.pages[0]; const region = columnPage.regions[0];
  const changed = replaceAndResignColumnGroups(input, [{ ...group, status: "hypotheses_reconstructed_with_problems", pages: [{ ...columnPage, status: "hypotheses_reconstructed_with_problems", regions: [{ ...region, status: "region_not_processable" }] }] }]);
  const result = formBudgetDocumentPhysicalCellHypotheses(changed); const output = result.groups[0].pages[0].regions[0];
  if (output.status !== "region_not_processable" || output.gridIntersections.length !== 0 || output.cellHypotheses.length !== 0) throw new Error("region_not_processable was reprocessed");
  if (output.segmentDispositions.some((entry) => entry.status === "outside_all_physical_cell_hypotheses" || entry.status === "unresolved_cell_hypothesis_formation_failed")) throw new Error("unprocessed region published a false physical observation");
  if (!output.segmentDispositions.some((entry) => entry.status === "unresolved_upstream_region_not_processable")) throw new Error("upstream non-processability was not preserved");
  if (output.metrics.upstreamRegionNotProcessableSegmentCount !== output.segmentDispositions.length) throw new Error("upstreamRegionNotProcessableSegmentCount did not count every unprocessed segment");
  if (output.metrics.inheritedPhysicalColumnHypothesisFailureSegmentCount !== 0) throw new Error("region_not_processable falsely reported an f.2b inherited failure");
  if (!segmentEquationHolds(output.metrics)) throw new Error("region_not_processable segment metric equation did not close");
  const resultPage = result.groups[0].pages[0]; const resultGroup = result.groups[0];
  if (resultPage.metrics.upstreamRegionNotProcessableSegmentCount !== output.metrics.upstreamRegionNotProcessableSegmentCount) throw new Error("page metrics did not aggregate upstreamRegionNotProcessableSegmentCount");
  if (resultGroup.metrics.upstreamRegionNotProcessableSegmentCount !== output.metrics.upstreamRegionNotProcessableSegmentCount) throw new Error("group metrics did not aggregate upstreamRegionNotProcessableSegmentCount");
  if (result.metrics.upstreamRegionNotProcessableSegmentCount !== output.metrics.upstreamRegionNotProcessableSegmentCount) throw new Error("global metrics did not aggregate upstreamRegionNotProcessableSegmentCount");
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
  const hypotheses = region.hypotheses.map((hypothesis) => { const position = hypothesis.segmentKeys.indexOf(disposition.segmentKey); return position < 0 ? hypothesis : { ...hypothesis, segmentKeys: hypothesis.segmentKeys.filter((_, index) => index !== position), lineKeys: hypothesis.lineKeys.filter((_, index) => index !== position) }; });
  const changed = replaceAndResignColumnGroups(input, [{ ...group, pages: [{ ...columnPage, regions: [{ ...region, hypotheses, segmentDispositions: [failed, ...region.segmentDispositions.slice(1)] }] }] }]);
  const result = formBudgetDocumentPhysicalCellHypotheses(changed);
  const output = result.groups[0].pages[0].regions[0];
  if (output.status !== "region_not_processable" || output.gridIntersections.length !== 0 || output.technicalProblems[0]?.code !== "source_physical_column_hypothesis_contract_invalid") throw new Error("detection_failed was hidden");
  const inheritedFailure = output.segmentDispositions.find((entry) => entry.status === "unresolved_inherited_physical_column_hypothesis_failure");
  if (!inheritedFailure || inheritedFailure.upstreamFailedPhase !== "hypothesis_formation" || inheritedFailure.upstreamDispositionStatus !== "unresolved_physical_column_hypothesis_detection_failed") throw new Error("upstream failure origin was not preserved");
  if (output.metrics.inheritedPhysicalColumnHypothesisFailureSegmentCount !== 1) throw new Error("inheritedPhysicalColumnHypothesisFailureSegmentCount did not count the inherited f.2b failure");
  if (output.metrics.upstreamRegionNotProcessableSegmentCount !== output.segmentDispositions.length - 1) throw new Error("remaining segments were not counted as upstream region not processable");
  if (!segmentEquationHolds(output.metrics)) throw new Error("inherited-failure region segment metric equation did not close");
  const resultPage = result.groups[0].pages[0]; const resultGroup = result.groups[0];
  if (resultPage.metrics.inheritedPhysicalColumnHypothesisFailureSegmentCount !== 1) throw new Error("page metrics did not aggregate inheritedPhysicalColumnHypothesisFailureSegmentCount");
  if (resultGroup.metrics.inheritedPhysicalColumnHypothesisFailureSegmentCount !== 1) throw new Error("group metrics did not aggregate inheritedPhysicalColumnHypothesisFailureSegmentCount");
  if (result.metrics.inheritedPhysicalColumnHypothesisFailureSegmentCount !== 1) throw new Error("global metrics did not aggregate inheritedPhysicalColumnHypothesisFailureSegmentCount");
  console.log("ok - upstream detection_failed invalidates only its region and is never hidden as outside");
}
