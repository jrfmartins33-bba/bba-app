import { buildStructurePage, cellFormationRegion, cellHypothesis, gridIntersection, physicalItem, physicalPage, placedOutcome, structureLine, structureSegment } from "./testing/physical-cell-text-evidence-formation-fixture-builders";
import { formRegionCellTextEvidences } from "./physical-cell-text-segment-formation";

const CONTEXT = { groupKey: "group-1", regionKey: "region-1" };

function run(structurePageParam: ReturnType<typeof buildStructurePage>, physicalPageParam: ReturnType<typeof physicalPage>, region: ReturnType<typeof cellFormationRegion>) {
  return formRegionCellTextEvidences(region, structurePageParam, physicalPageParam, CONTEXT);
}

// --- resolved: caso simples --------------------------------------------------
{
  const items = [physicalItem(0, "hello")];
  const page = physicalPage(1, items);
  const structurePage = buildStructurePage(1, [structureLine("line-1", 1, ["seg-1"])], [structureSegment("seg-1", "line-1", 1, 1, [0])], [placedOutcome(0, "line-1", "seg-1")]);
  const intersection = gridIntersection("gi-1", "line-1", 1, 1, "cell-1", 1, "region-1");
  const cell = cellHypothesis("cell-1", "gi-1", ["seg-1"]);
  const region = cellFormationRegion("region-1", 1, [intersection], [cell]);
  const { cellTextEvidences, technicalProblems } = run(structurePage, page, region);
  if (cellTextEvidences.length !== 1 || cellTextEvidences[0].status !== "formed") throw new Error("simple resolved segment did not form the cell");
  const outcome = cellTextEvidences[0].segmentOutcomes[0];
  if (outcome.status !== "resolved" || outcome.fragments[0]?.originalText !== "hello") throw new Error("fragment text was not preserved");
  if (technicalProblems.length !== 0) throw new Error("no technical problem expected for a fully resolved cell");
  console.log("ok - resolved segment forms the cell with a verbatim fragment");
}

// --- unresolved_segment_reference_invalid ------------------------------------
{
  const items = [physicalItem(0, "x")];
  const page = physicalPage(1, items);
  const structurePage = buildStructurePage(1, [structureLine("line-1", 1, [])], [], []);
  const intersection = gridIntersection("gi-1", "line-1", 1, 1, "cell-1", 1, "region-1");
  const cell = cellHypothesis("cell-1", "gi-1", ["missing-segment"]);
  const region = cellFormationRegion("region-1", 1, [intersection], [cell]);
  const { cellTextEvidences, technicalProblems } = run(structurePage, page, region);
  const outcome = cellTextEvidences[0].segmentOutcomes[0];
  if (outcome.status !== "unresolved_segment_reference_invalid" || outcome.segmentKey !== "missing-segment") throw new Error("missing segment was not reported as reference_invalid");
  if (cellTextEvidences[0].status !== "unresolved_technical_failure") throw new Error("cell with only an invalid segment reference must have zero safe fragments");
  if (!technicalProblems.some((p) => p.code === "source_segment_reference_invalid")) throw new Error("missing source_segment_reference_invalid problem");
  console.log("ok - nonexistent segmentKey is reported without being silently dropped");
}

// --- unresolved_segment_incompatible: line_reference_invalid -----------------
{
  const items = [physicalItem(0, "x")];
  const page = physicalPage(1, items);
  const structurePage = buildStructurePage(1, [], [structureSegment("seg-1", "ghost-line", 1, 1, [0])], [placedOutcome(0, "ghost-line", "seg-1")]);
  const intersection = gridIntersection("gi-1", "line-1", 1, 1, "cell-1", 1, "region-1");
  const cell = cellHypothesis("cell-1", "gi-1", ["seg-1"]);
  const region = cellFormationRegion("region-1", 1, [intersection], [cell]);
  const { cellTextEvidences, technicalProblems } = run(structurePage, page, region);
  const outcome = cellTextEvidences[0].segmentOutcomes[0];
  if (outcome.status !== "unresolved_segment_incompatible" || outcome.reason !== "line_reference_invalid" || outcome.referencedLineKey !== "ghost-line") throw new Error("segment with a nonexistent line was not reported as line_reference_invalid");
  if (!technicalProblems.some((p) => p.code === "source_line_reference_invalid")) throw new Error("missing source_line_reference_invalid problem");
  console.log("ok - segment whose own lineKey does not exist in structureReconstruction is line_reference_invalid");
}

// --- unresolved_segment_incompatible: line_mismatch --------------------------
{
  const items = [physicalItem(0, "x")];
  const page = physicalPage(1, items);
  const structurePage = buildStructurePage(1, [structureLine("line-2", 1, ["seg-1"])], [structureSegment("seg-1", "line-2", 1, 1, [0])], [placedOutcome(0, "line-2", "seg-1")]);
  const intersection = gridIntersection("gi-1", "line-1", 1, 1, "cell-1", 1, "region-1"); // expects line-1, segment belongs to line-2
  const cell = cellHypothesis("cell-1", "gi-1", ["seg-1"]);
  const region = cellFormationRegion("region-1", 1, [intersection], [cell]);
  const { cellTextEvidences, technicalProblems } = run(structurePage, page, region);
  const outcome = cellTextEvidences[0].segmentOutcomes[0];
  if (outcome.status !== "unresolved_segment_incompatible" || outcome.reason !== "line_mismatch" || outcome.expectedLineKey !== "line-1" || outcome.actualLineKey !== "line-2") throw new Error("line mismatch was not detected objectively");
  if (!technicalProblems.some((p) => p.code === "source_segment_incompatible")) throw new Error("missing source_segment_incompatible problem for line_mismatch");
  console.log("ok - segment belonging to a different line than the cell's own intersection is line_mismatch");
}

// --- unresolved_segment_incompatible: page_mismatch --------------------------
{
  const items = [physicalItem(0, "x")];
  const page = physicalPage(1, items);
  const structurePage = buildStructurePage(1, [structureLine("line-1", 1, ["seg-1"])], [structureSegment("seg-1", "line-1", 2, 1, [0])], [placedOutcome(0, "line-1", "seg-1")]); // segment declares pageNumber 2
  const intersection = gridIntersection("gi-1", "line-1", 1, 1, "cell-1", 1, "region-1"); // region pageNumber 1
  const cell = cellHypothesis("cell-1", "gi-1", ["seg-1"]);
  const region = cellFormationRegion("region-1", 1, [intersection], [cell]);
  const { cellTextEvidences } = run(structurePage, page, region);
  const outcome = cellTextEvidences[0].segmentOutcomes[0];
  if (outcome.status !== "unresolved_segment_incompatible" || outcome.reason !== "page_mismatch" || outcome.expectedPageNumber !== 1 || outcome.actualPageNumber !== 2) throw new Error("page mismatch was not detected objectively");
  console.log("ok - segment declaring a different pageNumber than the region is page_mismatch");
}

// --- unresolved_segment_incompatible: referenced_by_multiple_cell_hypotheses -
{
  const items = [physicalItem(0, "x")];
  const page = physicalPage(1, items);
  const structurePage = buildStructurePage(1, [structureLine("line-1", 1, ["seg-1"])], [structureSegment("seg-1", "line-1", 1, 1, [0])], [placedOutcome(0, "line-1", "seg-1")]);
  const intersectionA = gridIntersection("gi-a", "line-1", 1, 1, "cell-a", 1, "region-1");
  const intersectionB = gridIntersection("gi-b", "line-1", 1, 2, "cell-b", 1, "region-1");
  const cellA = cellHypothesis("cell-a", "gi-a", ["seg-1"]);
  const cellB = cellHypothesis("cell-b", "gi-b", ["seg-1"]);
  const region = cellFormationRegion("region-1", 1, [intersectionA, intersectionB], [cellA, cellB]);
  const { cellTextEvidences, technicalProblems } = run(structurePage, page, region);
  for (const evidence of cellTextEvidences) {
    const outcome = evidence.segmentOutcomes[0];
    if (outcome.status !== "unresolved_segment_incompatible" || outcome.reason !== "referenced_by_multiple_cell_hypotheses") throw new Error("segment claimed by two cells was not defensively rejected in both");
    if (outcome.conflictingCellHypothesisKeys.length !== 2) throw new Error("conflictingCellHypothesisKeys did not list both claimants");
  }
  if (technicalProblems.filter((p) => p.code === "source_segment_incompatible").length !== 2) throw new Error("expected one problem per conflicting cell");
  console.log("ok - a segment structurally impossible to claim by two cells is rejected defensively in both, with no winner chosen");
}

// --- ordem inválida dos segmentos da célula ----------------------------------
{
  const items = [physicalItem(0, "x"), physicalItem(1, "y")];
  const page = physicalPage(1, items);
  const segA = structureSegment("seg-a", "line-1", 1, 1, [0]); // horizontalOrder 1
  const segB = structureSegment("seg-b", "line-1", 1, 2, [1]); // horizontalOrder 2
  const structurePage = buildStructurePage(1, [structureLine("line-1", 1, ["seg-a", "seg-b"])], [segA, segB], [placedOutcome(0, "line-1", "seg-a"), placedOutcome(1, "line-1", "seg-b")]);
  const intersection = gridIntersection("gi-1", "line-1", 1, 1, "cell-1", 1, "region-1");
  const cell = cellHypothesis("cell-1", "gi-1", ["seg-b", "seg-a"]); // ordem declarada invertida
  const region = cellFormationRegion("region-1", 1, [intersection], [cell]);
  const { cellTextEvidences, technicalProblems } = run(structurePage, page, region);
  const evidence = cellTextEvidences[0];
  if (evidence.status !== "unresolved_technical_failure") throw new Error("segment order violation must invalidate the whole cell");
  if (evidence.segmentOutcomes.some((o) => o.status !== "unresolved_segment_formation_failed" || (o.status === "unresolved_segment_formation_failed" && o.failedPhase !== "segment_resolution"))) throw new Error("all segments must become unresolved_segment_formation_failed/segment_resolution");
  if (evidence.segmentOutcomes.map((o) => o.segmentKey).join(",") !== "seg-b,seg-a") throw new Error("segmentKeys must remain represented, none lost");
  if (!technicalProblems.some((p) => p.code === "source_cell_hypothesis_segment_order_invalid")) throw new Error("missing source_cell_hypothesis_segment_order_invalid problem");
  console.log("ok - segmentKeys order inconsistent with horizontalOrder invalidates the whole cell without inventing a silent order");
}

console.log("ok - physical-cell-text-segment-formation covers all segment outcome variants and order validation");
