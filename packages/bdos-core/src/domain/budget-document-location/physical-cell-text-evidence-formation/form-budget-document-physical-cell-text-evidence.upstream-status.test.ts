import type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "./testing/physical-cell-text-evidence-formation-test-bridge";
import { buildPhysicalCellTextEvidenceFormationFixture, resignPhysicalCellHypothesisFormationResult } from "./testing/physical-cell-text-evidence-formation-test-bridge";
import { formBudgetDocumentPhysicalCellTextEvidence } from "./form-budget-document-physical-cell-text-evidence";

const items: SyntheticGeometryTextItem[] = Array.from({ length: 4 }, (_, row) => {
  const top = 700 - row * 25;
  return [
    { text: `a-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + 12, index: row * 2 },
    { text: `b-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + 12, index: row * 2 + 1 },
  ];
}).flat();
const page: SyntheticGeometryPage = { widthPoints: 612, heightPoints: 792, items };
function fixture() {
  return buildPhysicalCellTextEvidenceFormationFixture("upstream-status", [page]);
}

// --- região region_not_processable herdada da f.2c ---------------------------
{
  const input = fixture();
  const group = input.physicalCellHypothesisFormation.groups[0];
  const columnPage = group.pages[0];
  const region = columnPage.regions[0];
  const groups = [{ ...group, pages: [{ ...columnPage, regions: [{ ...region, status: "region_not_processable" as const, gridIntersections: [], cellHypotheses: [] }] }] }];
  const corrupted = { ...input, physicalCellHypothesisFormation: resignPhysicalCellHypothesisFormationResult(input.physicalCellHypothesisFormation, { groups }) };
  const result = formBudgetDocumentPhysicalCellTextEvidence(corrupted);
  const output = result.groups[0].pages[0].regions[0];
  if (output.status !== "region_not_processable" || output.cellTextEvidences.length !== 0) throw new Error("region_not_processable was reprocessed instead of preserved");
  if (output.sourcePhysicalCellHypothesisFormationRegionStatus !== "region_not_processable") throw new Error("upstream region status was not preserved");
  console.log("ok - f.2c region_not_processable is preserved without inventing text evidence");
}

// --- região sem malha física (no_physical_grid) -------------------------------
{
  const input = fixture();
  const group = input.physicalCellHypothesisFormation.groups[0];
  const columnPage = group.pages[0];
  const region = columnPage.regions[0];
  const groups = [{ ...group, pages: [{ ...columnPage, regions: [{ ...region, status: "no_physical_grid" as const, gridIntersections: [], cellHypotheses: [] }] }] }];
  const corrupted = { ...input, physicalCellHypothesisFormation: resignPhysicalCellHypothesisFormationResult(input.physicalCellHypothesisFormation, { groups }) };
  const result = formBudgetDocumentPhysicalCellTextEvidence(corrupted);
  const output = result.groups[0].pages[0].regions[0];
  if (output.status !== "no_cell_hypotheses" || output.cellTextEvidences.length !== 0) throw new Error("no_physical_grid must classify as no_cell_hypotheses, never as region_not_processable");
  if (output.sourcePhysicalCellHypothesisFormationRegionStatus !== "no_physical_grid") throw new Error("upstream no_physical_grid status was not preserved");
  if (result.groups[0].pages[0].status !== "no_cell_hypotheses") throw new Error("page aggregation did not propagate no_cell_hypotheses from its only region");
  if (result.groups[0].status !== "no_cell_hypotheses") throw new Error("group aggregation did not propagate no_cell_hypotheses from its only page");
  console.log("ok - a region legitimately without physical grid is no_cell_hypotheses, distinct from region_not_processable, and aggregates correctly to page and group");
}

// --- região sem hipóteses de célula (grid_without_cell_hypotheses) -----------
{
  const input = fixture();
  const group = input.physicalCellHypothesisFormation.groups[0];
  const columnPage = group.pages[0];
  const region = columnPage.regions[0];
  const groups = [{ ...group, pages: [{ ...columnPage, regions: [{ ...region, status: "grid_without_cell_hypotheses" as const, cellHypotheses: [] }] }] }];
  const corrupted = { ...input, physicalCellHypothesisFormation: resignPhysicalCellHypothesisFormationResult(input.physicalCellHypothesisFormation, { groups }) };
  const result = formBudgetDocumentPhysicalCellTextEvidence(corrupted);
  const output = result.groups[0].pages[0].regions[0];
  if (output.status !== "no_cell_hypotheses" || output.cellTextEvidences.length !== 0) throw new Error("a region with zero cell hypotheses must classify as no_cell_hypotheses without materializing evidence");
  console.log("ok - a region with zero cell hypotheses is no_cell_hypotheses, distinct from region_not_processable");
}

// --- página page_not_processable herdada -------------------------------------
{
  const input = fixture();
  const group = input.physicalCellHypothesisFormation.groups[0];
  const columnPage = group.pages[0];
  const groups = [{ ...group, pages: [{ ...columnPage, status: "page_not_processable" as const, regions: [] }] }];
  const corrupted = { ...input, physicalCellHypothesisFormation: resignPhysicalCellHypothesisFormationResult(input.physicalCellHypothesisFormation, { groups }) };
  const result = formBudgetDocumentPhysicalCellTextEvidence(corrupted);
  const output = result.groups[0].pages[0];
  if (output.status !== "page_not_processable" || output.regions.length !== 0) throw new Error("page_not_processable was reprocessed instead of preserved");
  console.log("ok - f.2c page_not_processable is preserved");
}

// --- grupo group_not_processable herdado --------------------------------------
{
  const input = fixture();
  const group = input.physicalCellHypothesisFormation.groups[0];
  const groups = [{ ...group, status: "group_not_processable" as const, pages: [] }];
  const corrupted = { ...input, physicalCellHypothesisFormation: resignPhysicalCellHypothesisFormationResult(input.physicalCellHypothesisFormation, { groups }) };
  const result = formBudgetDocumentPhysicalCellTextEvidence(corrupted);
  const output = result.groups[0];
  if (output.status !== "group_not_processable" || output.pages.length !== 0) throw new Error("group_not_processable was reprocessed instead of preserved");
  console.log("ok - f.2c group_not_processable is preserved");
}

// --- status globais dos três contratos preservados no resultado --------------
{
  const input = fixture();
  const result = formBudgetDocumentPhysicalCellTextEvidence(input);
  if (result.sourcePhysicalReadStatus !== input.physicalRead.status) throw new Error("sourcePhysicalReadStatus was not preserved");
  if (result.sourceStructureReconstructionStatus !== input.structureReconstruction.status) throw new Error("sourceStructureReconstructionStatus was not preserved");
  if (result.sourcePhysicalCellHypothesisFormationStatus !== input.physicalCellHypothesisFormation.status) throw new Error("sourcePhysicalCellHypothesisFormationStatus was not preserved");
  console.log("ok - the three upstream global statuses are preserved even on a fully successful textual execution");
}

console.log("ok - form-budget-document-physical-cell-text-evidence.upstream-status covers region/page/group inherited states, no_physical_grid, and global upstream statuses");
