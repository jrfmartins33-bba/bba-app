import { classifyCell, computeGlobalMetrics, computeGroupMetrics, computePageMetrics, computeRegionMetrics } from "./physical-cell-text-evidence-formation-metrics";
import type { PhysicalCellTextEvidence, PhysicalCellTextEvidenceFormationGroup, PhysicalCellTextEvidenceFormationPage, PhysicalCellTextEvidenceFormationRegion } from "./budget-document-physical-cell-text-evidence-formation.types";

const includedDisposition = (segmentKey: string, order: number, index: number) => ({ status: "included_in_text_fragment" as const, segmentKey, sourceReferenceOrder: order, textItemIndex: index });
const invalidDisposition = (segmentKey: string, order: number, index: number) => ({ status: "unresolved_source_text_item_reference_invalid" as const, segmentKey, sourceReferenceOrder: order, textItemIndex: index });

// --- regra de estado da célula (Correção 3 / Seção 14.1) ---------------------
{
  const allIncluded: PhysicalCellTextEvidence = { status: "formed", cellHypothesisKey: "c1", gridIntersectionKey: "gi1", segmentOutcomes: [{ status: "resolved", segmentKey: "s1", lineKey: "l1", fragments: [{ sourceReferenceOrder: 1, textItemIndex: 0, originalText: "a", normalizedText: "a" }], itemDispositions: [includedDisposition("s1", 1, 0)] }] };
  if (classifyCell(allIncluded) !== "formed") throw new Error("all-included cell must classify as formed");

  const mixed: PhysicalCellTextEvidence = { status: "partially_formed", cellHypothesisKey: "c2", gridIntersectionKey: "gi2", segmentOutcomes: [{ status: "resolved", segmentKey: "s1", lineKey: "l1", fragments: [{ sourceReferenceOrder: 1, textItemIndex: 0, originalText: "a", normalizedText: "a" }], itemDispositions: [includedDisposition("s1", 1, 0), invalidDisposition("s1", 2, 1)] }] };
  if (classifyCell(mixed) !== "partiallyFormed") throw new Error("a cell with one safe fragment and one failure must classify as partiallyFormed");

  const noneIncluded: PhysicalCellTextEvidence = { status: "unresolved_technical_failure", cellHypothesisKey: "c3", gridIntersectionKey: "gi3", segmentOutcomes: [{ status: "resolved", segmentKey: "s1", lineKey: "l1", fragments: [], itemDispositions: [invalidDisposition("s1", 1, 0)] }] };
  if (classifyCell(noneIncluded) !== "failed") throw new Error("a cell with zero safe fragments must classify as failed");
  console.log("ok - a cell is never called formed without a safe fragment; partial and total failure are distinguished");
}

// --- agregação hierárquica: região -> página -> grupo -> global -------------
{
  const formedEvidence: PhysicalCellTextEvidence = { status: "formed", cellHypothesisKey: "c1", gridIntersectionKey: "gi1", segmentOutcomes: [{ status: "resolved", segmentKey: "s1", lineKey: "l1", fragments: [{ sourceReferenceOrder: 1, textItemIndex: 0, originalText: "a", normalizedText: "a" }], itemDispositions: [includedDisposition("s1", 1, 0)] }] };
  const failedEvidence: PhysicalCellTextEvidence = { status: "unresolved_technical_failure", cellHypothesisKey: "c2", gridIntersectionKey: "gi2", segmentOutcomes: [{ status: "unresolved_segment_reference_invalid", segmentKey: "s2" }] };

  const regionMetrics = computeRegionMetrics(2, [formedEvidence, failedEvidence], 1);
  if (regionMetrics.cellTextEvidenceFormedCount !== 1 || regionMetrics.cellTextEvidenceFailedCount !== 1) throw new Error("region metrics did not classify cells correctly");
  if (regionMetrics.segmentReferenceInvalidCount !== 1 || regionMetrics.segmentResolvedCount !== 1) throw new Error("region metrics did not classify segments correctly");
  if (regionMetrics.includedTextItemReferenceCount !== 1) throw new Error("region metrics did not count the included item");

  const region: PhysicalCellTextEvidenceFormationRegion = { regionProcessedKey: "r1", sourceRegionKey: "region-1", pageNumber: 1, sourcePhysicalCellHypothesisFormationRegionStatus: "formed", status: "formed_with_problems", cellTextEvidences: [formedEvidence, failedEvidence], technicalProblems: [], metrics: regionMetrics };
  const pageMetrics = computePageMetrics([region]);
  if (pageMetrics.cellTextEvidenceFormedCount !== 1 || pageMetrics.cellTextEvidenceFailedCount !== 1) throw new Error("page metrics lost or duplicated cell counts from its region");
  if (pageMetrics.formedWithProblemsRegionCount !== 1) throw new Error("page metrics did not count the region's own status");

  const page: PhysicalCellTextEvidenceFormationPage = { pageProcessedKey: "p1", pageNumber: 1, sourcePhysicalCellHypothesisFormationPageStatus: "formed", status: "formed_with_problems", regions: [region], technicalProblems: [], metrics: pageMetrics };
  const groupMetrics = computeGroupMetrics([page]);
  if (groupMetrics.cellTextEvidenceFormedCount !== 1 || groupMetrics.cellTextEvidenceFailedCount !== 1) throw new Error("group metrics lost or duplicated cell counts from its page");

  const group: PhysicalCellTextEvidenceFormationGroup = { groupProcessedKey: "g1", sourceCandidateGroupKey: "group-1", sourcePhysicalCellHypothesisFormationGroupStatus: "formed", status: "formed_with_problems", pageKeys: ["p1"], pages: [page], technicalProblems: [], metrics: groupMetrics };
  const globalMetrics = computeGlobalMetrics([group]);
  if (globalMetrics.cellTextEvidenceFormedCount !== 1 || globalMetrics.cellTextEvidenceFailedCount !== 1) throw new Error("global metrics lost or duplicated cell counts from its group");
  if (globalMetrics.candidateRegionCount !== 1 || globalMetrics.candidatePageCount !== 1) throw new Error("global metrics did not aggregate candidate page/region counts");
  console.log("ok - no category disappears or duplicates across region -> page -> group -> global aggregation");
}
