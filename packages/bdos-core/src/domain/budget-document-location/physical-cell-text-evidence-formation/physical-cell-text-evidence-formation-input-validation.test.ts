import type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "./testing/physical-cell-text-evidence-formation-test-bridge";
import { buildPhysicalCellTextEvidenceFormationFixture } from "./testing/physical-cell-text-evidence-formation-test-bridge";
import { validatePhysicalCellTextEvidenceFormationInput } from "./physical-cell-text-evidence-formation-input-validation";
import type { BudgetDocumentPhysicalCellTextEvidenceFormationInput } from "./budget-document-physical-cell-text-evidence-formation.types";

const items: SyntheticGeometryTextItem[] = Array.from({ length: 4 }, (_, row) => {
  const top = 700 - row * 25;
  return [
    { text: `a-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + 12, index: row * 2 },
    { text: `b-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + 12, index: row * 2 + 1 },
  ];
}).flat();
const page: SyntheticGeometryPage = { widthPoints: 612, heightPoints: 792, items };
function fixture(): BudgetDocumentPhysicalCellTextEvidenceFormationInput {
  return buildPhysicalCellTextEvidenceFormationFixture("input-validation", [page]);
}

// --- fixture válida -----------------------------------------------------------
{
  const result = validatePhysicalCellTextEvidenceFormationInput(fixture());
  if (result.kind !== "valid") throw new Error("valid fixture was rejected by input validation");
  console.log("ok - a valid three-contract fixture is accepted");
}

// --- versão de contrato incompatível -------------------------------------------
{
  const input = fixture();
  const corrupted = { ...input, physicalRead: { ...input.physicalRead, schemaVersion: 999 as never } };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_contract_version_unsupported") throw new Error("incompatible physicalRead schema version was not rejected");
  console.log("ok - an unsupported physicalRead schema version is rejected globally");
}

// --- status failed upstream -----------------------------------------------------
{
  const input = fixture();
  const failedRead = { ...input, physicalRead: { ...input.physicalRead, status: "failed" as const } };
  const result = validatePhysicalCellTextEvidenceFormationInput(failedRead);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_physical_read_contract_invalid") throw new Error("physicalRead.status === failed was not rejected");
  console.log("ok - physicalRead.status === failed is rejected globally");
}
{
  const input = fixture();
  const failedStructure = { ...input, structureReconstruction: { ...input.structureReconstruction, status: "failed" as const } };
  const result = validatePhysicalCellTextEvidenceFormationInput(failedStructure);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_structure_reconstruction_contract_invalid") throw new Error("structureReconstruction.status === failed was not rejected");
  console.log("ok - structureReconstruction.status === failed is rejected globally");
}
{
  const input = fixture();
  const failedCell = { ...input, physicalCellHypothesisFormation: { ...input.physicalCellHypothesisFormation, status: "failed" as const } };
  const result = validatePhysicalCellTextEvidenceFormationInput(failedCell);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_physical_cell_hypothesis_formation_contract_invalid") throw new Error("physicalCellHypothesisFormation.status === failed was not rejected");
  console.log("ok - physicalCellHypothesisFormation.status === failed is rejected globally");
}

// --- sourceByteHash divergente ---------------------------------------------------
{
  const input = fixture();
  const corrupted = { ...input, structureReconstruction: { ...input.structureReconstruction, sourceByteHash: "divergent" } };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_lineage_mismatch") throw new Error("divergent sourceByteHash was not rejected");
  console.log("ok - a divergent sourceByteHash between contracts is rejected globally");
}

// --- cada campo físico achatado divergente (linhagem direta, nunca fingerprint) --
{
  const physicalFieldChecks: ReadonlyArray<[string, (s: ReturnType<typeof fixture>["structureReconstruction"]) => ReturnType<typeof fixture>["structureReconstruction"]]> = [
    ["physicalReaderName", (s) => ({ ...s, physicalReaderName: "divergent-reader" })],
    ["physicalReaderVersion", (s) => ({ ...s, physicalReaderVersion: "divergent-version" })],
    ["physicalAdapterVersion", (s) => ({ ...s, physicalAdapterVersion: "divergent-adapter" })],
    ["physicalTextItemCoordinateSpaceVersion", (s) => ({ ...s, physicalTextItemCoordinateSpaceVersion: "divergent-coordinate-space" as never })],
    ["physicalTextItemGeometryProfileVersion", (s) => ({ ...s, physicalTextItemGeometryProfileVersion: "divergent-geometry-profile" as never })],
    ["physicalGeometryContextFingerprint", (s) => ({ ...s, physicalGeometryContextFingerprint: "divergent-fingerprint" })],
  ];
  for (const [label, corrupt] of physicalFieldChecks) {
    const input = fixture();
    const corrupted = { ...input, structureReconstruction: corrupt(input.structureReconstruction) };
    const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
    if (result.kind !== "invalid" || result.problems[0]?.code !== "source_lineage_mismatch") throw new Error(`divergent ${label} was not rejected as source_lineage_mismatch`);
  }
  console.log("ok - each flattened physicalRead identity field on structureReconstruction is validated by direct equality, never by fingerprint alone");
}
{
  const structureFieldChecks: ReadonlyArray<[string, (c: ReturnType<typeof fixture>["physicalCellHypothesisFormation"]) => ReturnType<typeof fixture>["physicalCellHypothesisFormation"]]> = [
    ["sourceStructureReconstructorName", (c) => ({ ...c, sourceStructureReconstructorName: "divergent-reconstructor" })],
    ["sourceStructureReconstructionProfileId", (c) => ({ ...c, sourceStructureReconstructionProfileId: "divergent-profile" })],
    ["sourceStructureReconstructionContextFingerprint", (c) => ({ ...c, sourceStructureReconstructionContextFingerprint: "divergent-fingerprint" })],
  ];
  for (const [label, corrupt] of structureFieldChecks) {
    const input = fixture();
    const corrupted = { ...input, physicalCellHypothesisFormation: corrupt(input.physicalCellHypothesisFormation) };
    const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
    if (result.kind !== "invalid" || result.problems[0]?.code !== "source_lineage_mismatch") throw new Error(`divergent ${label} was not rejected as source_lineage_mismatch`);
  }
  console.log("ok - each flattened structureReconstruction identity field on physicalCellHypothesisFormation is validated by direct equality");
}

// --- referência de grupo/página/região sem contexto estrutural confiável -----
{
  const input = fixture();
  const corrupted = {
    ...input,
    physicalCellHypothesisFormation: {
      ...input.physicalCellHypothesisFormation,
      groups: input.physicalCellHypothesisFormation.groups.map((group) => ({ ...group, sourceCandidateGroupKey: "ghost-group" })),
    },
  };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_group_reference_invalid") throw new Error("a group without structural correspondence was not rejected");
  console.log("ok - a group with no corresponding structureReconstruction group is rejected globally");
}
{
  const input = fixture();
  const corrupted = {
    ...input,
    physicalCellHypothesisFormation: {
      ...input.physicalCellHypothesisFormation,
      groups: input.physicalCellHypothesisFormation.groups.map((group) => ({
        ...group,
        pages: group.pages.map((page) => ({ ...page, pageNumber: 9999 })),
      })),
    },
  };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_page_reference_invalid") throw new Error("a page without structural correspondence was not rejected");
  console.log("ok - a page with no corresponding structureReconstruction page is rejected globally");
}

// --- gridIntersectionKey sem interseção correspondente ------------------------
{
  const input = fixture();
  const corrupted = {
    ...input,
    physicalCellHypothesisFormation: {
      ...input.physicalCellHypothesisFormation,
      groups: input.physicalCellHypothesisFormation.groups.map((group) => ({
        ...group,
        pages: group.pages.map((page) => ({
          ...page,
          regions: page.regions.map((region) => ({
            ...region,
            cellHypotheses: region.cellHypotheses.map((cell, index) => (index === 0 ? { ...cell, gridIntersectionKey: "ghost-intersection" } : cell)),
          })),
        })),
      })),
    },
  };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_grid_intersection_reference_invalid") throw new Error("a cell hypothesis without a corresponding intersection was not rejected globally");
  console.log("ok - a PhysicalCellHypothesis without a corresponding intersection is rejected globally, not treated as a local defect");
}

console.log("ok - physical-cell-text-evidence-formation-input-validation covers contracts, status, lineage and structural cross-references");
