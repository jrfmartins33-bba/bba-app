import { createHash } from "node:crypto";
import type { BudgetDocumentPhysicalCellTextEvidenceFormationInput } from "./budget-document-physical-cell-text-evidence-formation.types";
import { BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_NAME, BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_VERSION, PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_CONTEXT_FINGERPRINT_VERSION, PHYSICAL_CELL_TEXT_EVIDENCE_NORMALIZATION_VERSION, PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_ID, PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_VERSION } from "./budget-document-physical-cell-text-evidence-formation.types";
import { PROFILE } from "./physical-cell-text-evidence-formation-profile";

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function computeIdentityFingerprint(input: BudgetDocumentPhysicalCellTextEvidenceFormationInput): string {
  const p = input.physicalRead; const s = input.structureReconstruction; const c = input.physicalCellHypothesisFormation;
  return hash([
    PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_CONTEXT_FINGERPRINT_VERSION,
    p.sourceByteHash,
    p.schemaVersion, p.readerName, p.readerVersion, p.adapterVersion, p.underlyingLibraryVersion,
    p.textItemCoordinateSpaceVersion, p.textItemGeometryProfileVersion, p.geometryContextFingerprintVersion, p.geometryContextFingerprint, p.status,
    s.schemaVersion, s.reconstructorName, s.reconstructorVersion, s.reconstructionProfileId, s.reconstructionProfileVersion, s.reconstructionContextFingerprintVersion, s.reconstructionContextFingerprint, s.status,
    c.schemaVersion, c.formationEngineName, c.formationEngineVersion, c.formationProfileId, c.formationProfileVersion, c.formationContextFingerprintVersion, c.formationContextFingerprint, c.status,
    BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_NAME, BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_VERSION,
    PROFILE.profileId, PROFILE.profileVersion,
    PHYSICAL_CELL_TEXT_EVIDENCE_NORMALIZATION_VERSION,
    PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_ID, PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_VERSION,
  ]);
}

export function computeContentFingerprint(identity: string, content: unknown): string {
  return hash([PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_CONTEXT_FINGERPRINT_VERSION, identity, content]);
}
