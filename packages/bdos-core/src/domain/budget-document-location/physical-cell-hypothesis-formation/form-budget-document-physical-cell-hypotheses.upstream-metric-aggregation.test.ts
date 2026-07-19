import { buildPhysicalColumnHypothesisReconstructionFixture, type SyntheticGeometryPage, type SyntheticGeometryTextItem } from "../physical-column-hypothesis-reconstruction/testing/physical-column-hypothesis-reconstruction-test-bridge";
import { reconstructBudgetDocumentPhysicalColumnHypotheses } from "../physical-column-hypothesis-reconstruction";
import { formBudgetDocumentPhysicalCellHypotheses } from "./form-budget-document-physical-cell-hypotheses";
import { replaceAndResignColumnGroups } from "./testing/physical-cell-hypothesis-formation-test-bridge";

const items: SyntheticGeometryTextItem[] = Array.from({ length: 4 }, (_, row) => { const top = 700 - row * 25; return [{ text: `a-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + 12, index: row * 2 }, { text: `b-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + 12, index: row * 2 + 1 }]; }).flat();
const page: SyntheticGeometryPage = { widthPoints: 612, heightPoints: 792, items };

const upstream = buildPhysicalColumnHypothesisReconstructionFixture("hierarchical-aggregation", [page, page, page]);
const input = { ...upstream, physicalColumnHypothesisReconstruction: reconstructBudgetDocumentPhysicalColumnHypotheses(upstream) };
const group = input.physicalColumnHypothesisReconstruction.groups[0];

const formedPage = group.pages[0];
const notProcessablePage = group.pages[1];
const notProcessableRegion = notProcessablePage.regions[0];

const failurePage = group.pages[2];
const failureRegion = failurePage.regions[0];
const failureDisposition = failureRegion.segmentDispositions[0];
const failedDisposition = { status: "unresolved_physical_column_hypothesis_detection_failed" as const, segmentKey: failureDisposition.segmentKey, lineKey: failureDisposition.lineKey, failedPhase: "hypothesis_formation" as const };
const failureHypotheses = failureRegion.hypotheses.map((hypothesis) => {
  const position = hypothesis.segmentKeys.indexOf(failureDisposition.segmentKey);
  return position < 0 ? hypothesis : { ...hypothesis, segmentKeys: hypothesis.segmentKeys.filter((_, index) => index !== position), lineKeys: hypothesis.lineKeys.filter((_, index) => index !== position) };
});

const changed = replaceAndResignColumnGroups(input, [{
  ...group,
  status: "hypotheses_reconstructed_with_problems",
  pages: [
    formedPage,
    { ...notProcessablePage, status: "hypotheses_reconstructed_with_problems", regions: [{ ...notProcessableRegion, status: "region_not_processable" }] },
    { ...failurePage, regions: [{ ...failureRegion, hypotheses: failureHypotheses, segmentDispositions: [failedDisposition, ...failureRegion.segmentDispositions.slice(1)] }] },
  ],
}]);

const result = formBudgetDocumentPhysicalCellHypotheses(changed);
const outputPages = result.groups[0].pages;
if (outputPages.length !== 3) throw new Error("expected exactly three pages: formed, upstream-not-processable and inherited-failure");

const formedOutput = outputPages[0].regions[0];
const notProcessableOutput = outputPages[1].regions[0];
const failureOutput = outputPages[2].regions[0];

if (notProcessableOutput.sourceRegionKey !== notProcessableRegion.sourceRegionKey) throw new Error("unexpected page ordering: not-processable region key mismatch");
if (failureOutput.sourceRegionKey !== failureRegion.sourceRegionKey) throw new Error("unexpected page ordering: inherited-failure region key mismatch");
if (notProcessableOutput.status !== "region_not_processable") throw new Error("second region was not preserved as region_not_processable");
if (failureOutput.status !== "region_not_processable") throw new Error("third region was not invalidated by the inherited f.2b failure");

if (formedOutput.metrics.upstreamRegionNotProcessableSegmentCount !== 0 || formedOutput.metrics.inheritedPhysicalColumnHypothesisFailureSegmentCount !== 0) throw new Error("formed region falsely reported upstream-not-processable or inherited-failure segments");
if (notProcessableOutput.metrics.upstreamRegionNotProcessableSegmentCount !== notProcessableOutput.segmentDispositions.length) throw new Error("not-processable region did not count every segment as upstream-not-processable");
if (notProcessableOutput.metrics.inheritedPhysicalColumnHypothesisFailureSegmentCount !== 0) throw new Error("not-processable region falsely reported an inherited f.2b failure");
if (failureOutput.metrics.inheritedPhysicalColumnHypothesisFailureSegmentCount !== 1) throw new Error("inherited-failure region did not count exactly one inherited f.2b failure segment");
if (failureOutput.metrics.upstreamRegionNotProcessableSegmentCount !== failureOutput.segmentDispositions.length - 1) throw new Error("inherited-failure region did not count remaining segments as upstream-not-processable");

const regions = [formedOutput, notProcessableOutput, failureOutput];
const expectedUpstreamTotal = regions.reduce((sum, region) => sum + region.metrics.upstreamRegionNotProcessableSegmentCount, 0);
const expectedInheritedFailureTotal = regions.reduce((sum, region) => sum + region.metrics.inheritedPhysicalColumnHypothesisFailureSegmentCount, 0);

for (const outputPage of outputPages) {
  const pageExpectedUpstream = outputPage.regions.reduce((sum, region) => sum + region.metrics.upstreamRegionNotProcessableSegmentCount, 0);
  const pageExpectedInheritedFailure = outputPage.regions.reduce((sum, region) => sum + region.metrics.inheritedPhysicalColumnHypothesisFailureSegmentCount, 0);
  if (outputPage.metrics.upstreamRegionNotProcessableSegmentCount !== pageExpectedUpstream) throw new Error("page metrics lost or duplicated upstreamRegionNotProcessableSegmentCount");
  if (outputPage.metrics.inheritedPhysicalColumnHypothesisFailureSegmentCount !== pageExpectedInheritedFailure) throw new Error("page metrics lost or duplicated inheritedPhysicalColumnHypothesisFailureSegmentCount");
}

const group0 = result.groups[0];
if (group0.metrics.upstreamRegionNotProcessableSegmentCount !== expectedUpstreamTotal) throw new Error("group metrics lost or duplicated upstreamRegionNotProcessableSegmentCount");
if (group0.metrics.inheritedPhysicalColumnHypothesisFailureSegmentCount !== expectedInheritedFailureTotal) throw new Error("group metrics lost or duplicated inheritedPhysicalColumnHypothesisFailureSegmentCount");

if (result.metrics.upstreamRegionNotProcessableSegmentCount !== expectedUpstreamTotal) throw new Error("global metrics lost or duplicated upstreamRegionNotProcessableSegmentCount");
if (result.metrics.inheritedPhysicalColumnHypothesisFailureSegmentCount !== expectedInheritedFailureTotal) throw new Error("global metrics lost or duplicated inheritedPhysicalColumnHypothesisFailureSegmentCount");

if (expectedUpstreamTotal === 0) throw new Error("fixture did not actually exercise upstreamRegionNotProcessableSegmentCount");
if (expectedInheritedFailureTotal !== 1) throw new Error("fixture did not actually exercise exactly one inheritedPhysicalColumnHypothesisFailureSegmentCount");

console.log("ok - upstreamRegionNotProcessableSegmentCount and inheritedPhysicalColumnHypothesisFailureSegmentCount aggregate losslessly across page, group and global metrics for a formed region, an upstream-not-processable region and an inherited-f.2b-failure region");
