import type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "./testing/physical-cell-text-evidence-formation-test-bridge";
import { buildPhysicalCellTextEvidenceFormationFixture, resignPhysicalCellHypothesisFormationResult } from "./testing/physical-cell-text-evidence-formation-test-bridge";
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

// --- cada campo achatado de physicalRead em structureReconstruction, individualmente --
{
  const physicalFieldChecks: ReadonlyArray<[string, (s: ReturnType<typeof fixture>["structureReconstruction"]) => ReturnType<typeof fixture>["structureReconstruction"]]> = [
    ["physicalReadSchemaVersion", (s) => ({ ...s, physicalReadSchemaVersion: 999 })],
    ["physicalReaderName", (s) => ({ ...s, physicalReaderName: "divergent-reader" })],
    ["physicalReaderVersion", (s) => ({ ...s, physicalReaderVersion: "divergent-version" })],
    ["physicalAdapterVersion", (s) => ({ ...s, physicalAdapterVersion: "divergent-adapter" })],
    ["physicalUnderlyingLibraryVersion", (s) => ({ ...s, physicalUnderlyingLibraryVersion: "divergent-library" })],
    ["physicalTextItemCoordinateSpaceVersion", (s) => ({ ...s, physicalTextItemCoordinateSpaceVersion: "divergent-coordinate-space" as never })],
    ["physicalTextItemGeometryProfileVersion", (s) => ({ ...s, physicalTextItemGeometryProfileVersion: "divergent-geometry-profile" as never })],
    ["physicalGeometryContextFingerprintVersion", (s) => ({ ...s, physicalGeometryContextFingerprintVersion: "divergent-fingerprint-version" as never })],
    ["physicalGeometryContextFingerprint", (s) => ({ ...s, physicalGeometryContextFingerprint: "divergent-fingerprint" })],
  ];
  for (const [label, corrupt] of physicalFieldChecks) {
    const input = fixture();
    const corrupted = { ...input, structureReconstruction: corrupt(input.structureReconstruction) };
    const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
    if (result.kind !== "invalid" || result.problems[0]?.code !== "source_lineage_mismatch") throw new Error(`divergent ${label} was not rejected as source_lineage_mismatch`);
  }
  console.log("ok - every flattened physicalRead identity field on structureReconstruction is validated individually by direct equality, never by fingerprint alone");
}

// --- cada campo achatado de structureReconstruction em physicalCellHypothesisFormation, individualmente --
{
  const structureFieldChecks: ReadonlyArray<[string, (c: ReturnType<typeof fixture>["physicalCellHypothesisFormation"]) => ReturnType<typeof fixture>["physicalCellHypothesisFormation"]]> = [
    ["sourceStructureReconstructionSchemaVersion", (c) => ({ ...c, sourceStructureReconstructionSchemaVersion: 999 })],
    ["sourceStructureReconstructorName", (c) => ({ ...c, sourceStructureReconstructorName: "divergent-reconstructor" })],
    ["sourceStructureReconstructorVersion", (c) => ({ ...c, sourceStructureReconstructorVersion: "divergent-version" })],
    ["sourceStructureReconstructionProfileId", (c) => ({ ...c, sourceStructureReconstructionProfileId: "divergent-profile" })],
    ["sourceStructureReconstructionProfileVersion", (c) => ({ ...c, sourceStructureReconstructionProfileVersion: 999 })],
    ["sourceStructureReconstructionContextFingerprintVersion", (c) => ({ ...c, sourceStructureReconstructionContextFingerprintVersion: "divergent-fingerprint-version" })],
    ["sourceStructureReconstructionContextFingerprint", (c) => ({ ...c, sourceStructureReconstructionContextFingerprint: "divergent-fingerprint" })],
  ];
  for (const [label, corrupt] of structureFieldChecks) {
    const input = fixture();
    const corrupted = { ...input, physicalCellHypothesisFormation: corrupt(input.physicalCellHypothesisFormation) };
    const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
    if (result.kind !== "invalid" || result.problems[0]?.code !== "source_lineage_mismatch") throw new Error(`divergent ${label} was not rejected as source_lineage_mismatch`);
  }
  console.log("ok - every flattened structureReconstruction identity field on physicalCellHypothesisFormation is validated individually by direct equality");
}

// --- fingerprints upstream: cada um recalculado e validado de forma independente --
// Nota: physicalRead.geometryContextFingerprint também é copiado em
// structureReconstruction.physicalGeometryContextFingerprint (verificado por
// igualdade direta de linhagem). Adulterar apenas um dos dois seria
// capturado por essa igualdade antes de alcançar o portão de fingerprint —
// por isso ambas as cópias são adulteradas para o mesmo valor inválido,
// isolando exatamente o portão de fingerprint.
{
  const input = fixture();
  const tampered = "0".repeat(64);
  const corrupted = { ...input, physicalRead: { ...input.physicalRead, geometryContextFingerprint: tampered }, structureReconstruction: { ...input.structureReconstruction, physicalGeometryContextFingerprint: tampered } };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_fingerprint_invalid") throw new Error("a tampered physicalRead.geometryContextFingerprint was not rejected as source_fingerprint_invalid");
  console.log("ok - physicalRead.geometryContextFingerprint is recomputed and validated independently");
}
{
  const input = fixture();
  const tampered = "0".repeat(64);
  const corrupted = { ...input, structureReconstruction: { ...input.structureReconstruction, reconstructionContextFingerprint: tampered }, physicalCellHypothesisFormation: { ...input.physicalCellHypothesisFormation, sourceStructureReconstructionContextFingerprint: tampered } };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_fingerprint_invalid") throw new Error("a tampered structureReconstruction.reconstructionContextFingerprint was not rejected as source_fingerprint_invalid");
  console.log("ok - structureReconstruction.reconstructionContextFingerprint is recomputed and validated independently, using the real f.1 formula");
}
{
  const input = fixture();
  const corrupted = { ...input, physicalCellHypothesisFormation: { ...input.physicalCellHypothesisFormation, formationContextFingerprint: "0".repeat(64) } };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_fingerprint_invalid") throw new Error("a tampered physicalCellHypothesisFormation.formationContextFingerprint was not rejected as source_fingerprint_invalid");
  console.log("ok - physicalCellHypothesisFormation.formationContextFingerprint is recomputed and validated independently, using the real f.2c formula reconstructed from its own flattened fields");
}

// --- cobertura integral de grupos: ausente, extra e duplicado -----------------
{
  const input = fixture();
  const group = input.physicalCellHypothesisFormation.groups[0];
  const groups = [group, { ...group, groupProcessedKey: "extra-group-processed", sourceCandidateGroupKey: "extra-group" }];
  const corrupted = { ...input, physicalCellHypothesisFormation: resignPhysicalCellHypothesisFormationResult(input.physicalCellHypothesisFormation, { groups }) };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_group_reference_invalid") throw new Error("an extra f.2c group with no structural counterpart was not rejected globally");
  console.log("ok - an f.2c group with no corresponding structural group (extra group) is rejected globally");
}
{
  const input = fixture();
  const structureGroup = input.structureReconstruction.groups[0];
  const structureReconstruction = { ...input.structureReconstruction, groups: [...input.structureReconstruction.groups, { ...structureGroup, groupReconstructionKey: "extra-structure-group", sourceCandidateGroupKey: "extra-structural-group" }] };
  const corrupted = { ...input, structureReconstruction };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_group_reference_invalid") throw new Error("a structural group with no f.2c counterpart (missing group) was not rejected globally");
  console.log("ok - a structural group with no f.2c counterpart (a group silently disappearing) is rejected globally");
}
{
  const input = fixture();
  const group = input.physicalCellHypothesisFormation.groups[0];
  const groups = [group, { ...group }];
  const corrupted = { ...input, physicalCellHypothesisFormation: resignPhysicalCellHypothesisFormationResult(input.physicalCellHypothesisFormation, { groups }) };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_group_reference_invalid") throw new Error("a duplicated sourceCandidateGroupKey was not rejected globally");
  console.log("ok - a duplicated sourceCandidateGroupKey in f.2c's own groups is rejected globally");
}

// --- cobertura integral de páginas: ausente, extra e duplicada ----------------
{
  const input = fixture();
  const group = input.physicalCellHypothesisFormation.groups[0];
  const columnPage = group.pages[0];
  const groups = [{ ...group, pages: [columnPage, { ...columnPage, pageProcessedKey: "extra-page-processed", pageNumber: columnPage.pageNumber + 1000 }] }];
  const corrupted = { ...input, physicalCellHypothesisFormation: resignPhysicalCellHypothesisFormationResult(input.physicalCellHypothesisFormation, { groups }) };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_page_reference_invalid") throw new Error("an extra f.2c page with no structural counterpart was not rejected globally");
  console.log("ok - an f.2c page with no corresponding structural page (extra page) is rejected globally");
}
{
  const input = fixture();
  const structureGroup = input.structureReconstruction.groups[0];
  const structurePage = structureGroup.pages[0];
  const structureReconstruction = { ...input.structureReconstruction, groups: [{ ...structureGroup, pages: [structurePage, { ...structurePage, pageReconstructionKey: "extra-structure-page", pageNumber: structurePage.pageNumber + 1000 }] }] };
  const corrupted = { ...input, structureReconstruction };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_page_reference_invalid") throw new Error("a structural page with no f.2c counterpart (missing page) was not rejected globally");
  console.log("ok - a structural page with no f.2c counterpart (a page silently disappearing) is rejected globally");
}
{
  const input = fixture();
  const group = input.physicalCellHypothesisFormation.groups[0];
  const columnPage = group.pages[0];
  const groups = [{ ...group, pages: [columnPage, { ...columnPage }] }];
  const corrupted = { ...input, physicalCellHypothesisFormation: resignPhysicalCellHypothesisFormationResult(input.physicalCellHypothesisFormation, { groups }) };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_page_reference_invalid") throw new Error("a duplicated pageNumber was not rejected globally");
  console.log("ok - a duplicated pageNumber in f.2c's own group is rejected globally");
}

// --- gridIntersectionKey sem interseção correspondente ------------------------
{
  const input = fixture();
  const group = input.physicalCellHypothesisFormation.groups[0];
  const groups = [{
    ...group,
    pages: group.pages.map((columnPage) => ({
      ...columnPage,
      regions: columnPage.regions.map((region) => ({
        ...region,
        cellHypotheses: region.cellHypotheses.map((cell, index) => (index === 0 ? { ...cell, gridIntersectionKey: "ghost-intersection" } : cell)),
      })),
    })),
  }];
  const corrupted = { ...input, physicalCellHypothesisFormation: resignPhysicalCellHypothesisFormationResult(input.physicalCellHypothesisFormation, { groups }) };
  const result = validatePhysicalCellTextEvidenceFormationInput(corrupted);
  if (result.kind !== "invalid" || result.problems[0]?.code !== "source_grid_intersection_reference_invalid") throw new Error("a cell hypothesis without a corresponding intersection was not rejected globally");
  console.log("ok - a PhysicalCellHypothesis without a corresponding intersection is rejected globally, not treated as a local defect");
}

console.log("ok - physical-cell-text-evidence-formation-input-validation covers contracts, status, lineage, fingerprints and full group/page coverage");
