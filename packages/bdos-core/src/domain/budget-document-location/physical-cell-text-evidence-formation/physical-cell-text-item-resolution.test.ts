import { buildStructurePage, cellFormationRegion, cellHypothesis, gridIntersection, physicalItem, physicalPage, placedOutcome, structureLine, structureSegment } from "./testing/physical-cell-text-evidence-formation-fixture-builders";
import { formRegionCellTextEvidences } from "./physical-cell-text-segment-formation";
import { normalizePhysicalCellTextItem } from "./physical-cell-text-evidence-normalization";

const CONTEXT = { groupKey: "group-1", regionKey: "region-1" };

// --- vetores normativos de normalização (Correção 21 do prompt) --------------
const normalizationVectors: ReadonlyArray<[string, string]> = [
  ["A  B", "A B"],
  ["A\tB", "A B"],
  ["A\r\nB", "A\nB"],
  ["A   ", "A"],
  ["", ""],
  ["   ", ""],
];
for (const [input, expected] of normalizationVectors) {
  const actual = normalizePhysicalCellTextItem(input);
  if (actual !== expected) throw new Error(`normalization vector failed: ${JSON.stringify(input)} -> expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
console.log("ok - normalization vectors match normalizePageText([originalText]) exactly");

// --- referência de item inexistente ------------------------------------------
{
  const page = physicalPage(1, [physicalItem(0, "only-item")]);
  const structurePage = buildStructurePage(1, [structureLine("line-1", 1, ["seg-1"])], [structureSegment("seg-1", "line-1", 1, 1, [7])], [placedOutcome(7, "line-1", "seg-1")]);
  const intersection = gridIntersection("gi-1", "line-1", 1, 1, "cell-1", 1, "region-1");
  const cell = cellHypothesis("cell-1", "gi-1", ["seg-1"]);
  const region = cellFormationRegion("region-1", 1, [intersection], [cell]);
  const { cellTextEvidences, technicalProblems } = formRegionCellTextEvidences(region, structurePage, page, CONTEXT);
  const outcome = cellTextEvidences[0].segmentOutcomes[0];
  if (outcome.status !== "resolved") throw new Error("segment itself should resolve; only the item reference is invalid");
  const disposition = outcome.itemDispositions[0];
  if (disposition.status !== "unresolved_source_text_item_reference_invalid" || disposition.textItemIndex !== 7) throw new Error("nonexistent textItemIndex was not reported");
  if (outcome.fragments.length !== 0) throw new Error("no fragment may exist for an invalid reference");
  if (!technicalProblems.some((p) => p.code === "source_text_item_reference_invalid")) throw new Error("missing source_text_item_reference_invalid problem");
  console.log("ok - textItemIndex absent from the physical page is unresolved_source_text_item_reference_invalid, resolved by item.index");
}

// --- item pertencente a outro segmento ----------------------------------------
{
  const page = physicalPage(1, [physicalItem(0, "text")]);
  const structurePage = buildStructurePage(1, [structureLine("line-1", 1, ["seg-1"])], [structureSegment("seg-1", "line-1", 1, 1, [0])], [placedOutcome(0, "line-1", "other-segment")]);
  const intersection = gridIntersection("gi-1", "line-1", 1, 1, "cell-1", 1, "region-1");
  const cell = cellHypothesis("cell-1", "gi-1", ["seg-1"]);
  const region = cellFormationRegion("region-1", 1, [intersection], [cell]);
  const { cellTextEvidences, technicalProblems } = formRegionCellTextEvidences(region, structurePage, page, CONTEXT);
  const outcome = cellTextEvidences[0].segmentOutcomes[0];
  if (outcome.status !== "resolved") throw new Error("segment itself should resolve");
  const disposition = outcome.itemDispositions[0];
  if (disposition.status !== "unresolved_source_text_item_segment_mismatch" || disposition.actualOwningSegmentKey !== "other-segment") throw new Error("item ownership mismatch was not detected via structureReconstruction's own item outcomes");
  if (!technicalProblems.some((p) => p.code === "source_text_item_segment_mismatch")) throw new Error("missing source_text_item_segment_mismatch problem");
  console.log("ok - item owned by a different segment per structureReconstruction is unresolved_source_text_item_segment_mismatch, ownership never silently reassigned");
}

// --- item sem outcome "placed" nenhum (actualOwningSegmentKey null) ----------
{
  const page = physicalPage(1, [physicalItem(0, "text")]);
  const structurePage = buildStructurePage(1, [structureLine("line-1", 1, ["seg-1"])], [structureSegment("seg-1", "line-1", 1, 1, [0])], []); // sem nenhum outcome para o índice 0
  const intersection = gridIntersection("gi-1", "line-1", 1, 1, "cell-1", 1, "region-1");
  const cell = cellHypothesis("cell-1", "gi-1", ["seg-1"]);
  const region = cellFormationRegion("region-1", 1, [intersection], [cell]);
  const { cellTextEvidences } = formRegionCellTextEvidences(region, structurePage, page, CONTEXT);
  const disposition = cellTextEvidences[0].segmentOutcomes[0];
  if (disposition.status !== "resolved") throw new Error("segment itself should resolve");
  if (disposition.itemDispositions[0]?.status !== "unresolved_source_text_item_segment_mismatch" || (disposition.itemDispositions[0] as { actualOwningSegmentKey: string | null }).actualOwningSegmentKey !== null) throw new Error("item with no placed outcome at all must report actualOwningSegmentKey: null");
  console.log("ok - item with no placed outcome at all reports actualOwningSegmentKey: null, never invented");
}

// --- duplicidade regional: mesmo textItemIndex em duas células diferentes ----
{
  const page = physicalPage(1, [physicalItem(9, "shared")]);
  const structurePage = buildStructurePage(
    1,
    [structureLine("line-1", 1, ["seg-a"]), structureLine("line-2", 1, ["seg-b"])],
    [structureSegment("seg-a", "line-1", 1, 1, [9]), structureSegment("seg-b", "line-2", 1, 1, [9])],
    [placedOutcome(9, "line-1", "seg-a")],
  );
  const intersectionA = gridIntersection("gi-a", "line-1", 1, 1, "cell-a", 1, "region-1");
  const intersectionB = gridIntersection("gi-b", "line-2", 2, 1, "cell-b", 1, "region-1");
  const cellA = cellHypothesis("cell-a", "gi-a", ["seg-a"]);
  const cellB = cellHypothesis("cell-b", "gi-b", ["seg-b"]);
  const region = cellFormationRegion("region-1", 1, [intersectionA, intersectionB], [cellA, cellB]);
  const { cellTextEvidences, technicalProblems } = formRegionCellTextEvidences(region, structurePage, page, CONTEXT);
  for (const evidence of cellTextEvidences) {
    const outcome = evidence.segmentOutcomes[0];
    if (outcome.status !== "resolved") throw new Error("segments themselves should resolve; only the item occurrence is disputed");
    const disposition = outcome.itemDispositions[0];
    if (disposition.status !== "unresolved_source_text_item_duplicate_reference") throw new Error("shared textItemIndex across two different cells was not marked duplicate in both");
    if (disposition.conflictingReferences.length !== 1) throw new Error("conflictingReferences must list the other occurrence");
    if (outcome.fragments.length !== 0) throw new Error("no fragment may be formed for either duplicate occurrence");
  }
  if (technicalProblems.filter((p) => p.code === "source_text_item_duplicate_reference").length !== 2) throw new Error("expected one duplicate problem per conflicting occurrence");
  console.log("ok - the same textItemIndex referenced by segments of two different cells is duplicate in both, no winner chosen, even across cells");
}

console.log("ok - physical-cell-text-item-resolution covers reference invalid, segment mismatch, region-wide duplicate detection and normalization vectors");
