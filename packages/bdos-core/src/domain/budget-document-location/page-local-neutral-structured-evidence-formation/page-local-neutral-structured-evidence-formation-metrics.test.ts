import type { ReconstructedPhysicalLine } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { NeutralDocumentGroup, NeutralDocumentPage, NeutralDocumentRegion } from "./budget-document-page-local-neutral-structured-evidence-formation.types";
import { cellFormationRegion, cellHypothesis, emptyIntersection, fragment, gridIntersection, regionCandidate, resolvedSegment, structureLine, structureMaps, structureSegment, textEvidence, textEvidenceRegion } from "./testing/page-local-neutral-structured-evidence-formation-fixture-builders";
import { formNeutralDocumentRegion } from "./form-neutral-document-region";
import { computeGlobalMetrics, computeGroupMetrics, computePageMetrics } from "./page-local-neutral-structured-evidence-formation-metrics";
import { deriveGroupStatus, derivePageStatus } from "./page-local-neutral-structured-evidence-formation-classifiers";

const lineWithOrder = (key: string, verticalOrder: number, segs: ReadonlyArray<string>): ReconstructedPhysicalLine => ({ ...structureLine(key, 1, segs), verticalOrder });

function structuredRegion(regionKey: string): NeutralDocumentRegion {
  const lines = [lineWithOrder("A", 1, ["Aseg"])];
  const segments = [structureSegment("Aseg", "A", 1, 1, [0])];
  const candidate = regionCandidate(regionKey, 1, 1, ["A"]);
  const intersections = [gridIntersection("gi1", "A", 1, 1, "cA", 1, regionKey), emptyIntersection("gi2", "A", 1, 2, 1, regionKey)];
  const cells = [cellHypothesis("cA", "gi1", ["Aseg"])];
  const evidences = [textEvidence("cA", "gi1", "formed", [resolvedSegment("Aseg", "A", [fragment(1, 0, "x", "x")])])];
  const maps = structureMaps(lines, segments);
  return formNeutralDocumentRegion(candidate, cellFormationRegion(regionKey, 1, "formed", intersections, cells), textEvidenceRegion(regionKey, 1, "formed", evidences), maps.lineByKey, maps.segmentByKey, { groupKey: "G1" });
}

function upstreamNotProcessableRegion(regionKey: string): NeutralDocumentRegion {
  const lines = [lineWithOrder("A", 1, ["Aseg"])];
  const segments = [structureSegment("Aseg", "A", 1, 1, [0])];
  const candidate = regionCandidate(regionKey, 1, 1, ["A"]);
  const maps = structureMaps(lines, segments);
  return formNeutralDocumentRegion(candidate, null, null, maps.lineByKey, maps.segmentByKey, { groupKey: "G1" });
}

const regions = [structuredRegion("R1"), upstreamNotProcessableRegion("R2")];
const pageMetrics = computePageMetrics(regions, []);

// Partição categórica de região dentro da página.
if (pageMetrics.totalRegionCount !== pageMetrics.structuredRegionCount + pageMetrics.structuredWithAmbiguitiesRegionCount + pageMetrics.structuredWithProblemsRegionCount + pageMetrics.gridWithoutCellsRegionCount + pageMetrics.withoutPhysicalGridRegionCount + pageMetrics.upstreamNotProcessableRegionCount + pageMetrics.failedRegionCount) throw new Error("page region partition broken");
if (pageMetrics.structuredRegionCount !== 1 || pageMetrics.upstreamNotProcessableRegionCount !== 1) throw new Error("expected one structured and one upstream-not-processable region");
// Agregação sem perda: soma das métricas de região.
if (pageMetrics.documentCellCount !== regions.reduce((t, r) => t + r.metrics.documentCellCount, 0)) throw new Error("page documentCellCount must equal the sum of region documentCellCount");
if (pageMetrics.positionCount !== regions.reduce((t, r) => t + r.metrics.positionProducedCount, 0)) throw new Error("page positionCount must equal the sum of region positions");
if (pageMetrics.physicalSegmentPreservedCount !== regions.reduce((t, r) => t + r.metrics.physicalSegmentPreservedCount, 0)) throw new Error("page segment preservation must aggregate without loss");

const page: NeutralDocumentPage = { pageNumber: 1, status: derivePageStatus(regions, false), sourceTabularRegionDetectionPageStatus: "detected", sourcePhysicalCellHypothesisFormationPageStatus: "formed", sourcePhysicalCellTextEvidenceFormationPageStatus: "formed", regions, technicalProblems: [], metrics: pageMetrics };
if (page.status !== "partially_structured") throw new Error("a page mixing a structured region and an upstream-not-processable region must be partially_structured");

const groupMetrics = computeGroupMetrics([page], []);
if (groupMetrics.totalPageCount !== groupMetrics.structuredPageCount + groupMetrics.structuredWithProblemsPageCount + groupMetrics.partiallyStructuredPageCount + groupMetrics.withoutNeutralStructurePageCount + groupMetrics.upstreamNotProcessablePageCount + groupMetrics.failedPageCount) throw new Error("group page partition broken");
if (groupMetrics.documentCellCount !== pageMetrics.documentCellCount) throw new Error("group must aggregate the page cell count without loss");

const group: NeutralDocumentGroup = { sourceCandidateGroupKey: "G1", status: deriveGroupStatus([page], false), sourceTabularRegionDetectionGroupStatus: "detected", sourcePhysicalCellHypothesisFormationGroupStatus: "formed", sourcePhysicalCellTextEvidenceFormationGroupStatus: "formed", pages: [page], technicalProblems: [], metrics: groupMetrics };
const globalMetrics = computeGlobalMetrics([group], []);
if (globalMetrics.receivedGroupCount !== globalMetrics.structuredGroupCount + globalMetrics.structuredWithProblemsGroupCount + globalMetrics.partiallyStructuredGroupCount + globalMetrics.withoutNeutralStructureGroupCount + globalMetrics.upstreamNotProcessableGroupCount + globalMetrics.failedGroupCount) throw new Error("global group partition broken");
if (globalMetrics.candidatePageCount !== 1 || globalMetrics.candidateRegionCount !== 2) throw new Error("global candidate page/region counts must aggregate");
if (globalMetrics.documentCellCount !== groupMetrics.documentCellCount) throw new Error("global must aggregate the group cell count without loss");

console.log("ok - categorical partition holds at region/page/group/global and every aggregate equals the exact sum of its children with no loss or duplication");
