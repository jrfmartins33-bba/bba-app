import { createHash } from "node:crypto";
import type { BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput } from "./budget-document-page-local-neutral-structured-evidence-formation.types";
import {
  BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_NAME,
  BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_VERSION,
  NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_ID,
  NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_VERSION,
  NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_ID,
  NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_VERSION,
  PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_CANONICAL_SERIALIZATION_VERSION,
  PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_IDENTITY_FINGERPRINT_VERSION,
} from "./budget-document-page-local-neutral-structured-evidence-formation.types";
import { PROFILE } from "./page-local-neutral-structured-evidence-formation-profile";

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Fingerprint de identidade (§26): resume as identidades completas dos quatro
 * contratos de origem (incluindo seus estados globais upstream), o
 * `sourceByteHash`, a identidade/perfil da g.2 e as versões das regras da
 * g.2. NUNCA incorpora o conteúdo produzido — este entra apenas no
 * fingerprint final. Ordem fixa, SHA-256 sobre JSON canônico por valor.
 */
export function computeIdentityFingerprint(input: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput): string {
  const s = input.structureReconstruction; const t = input.tabularRegionDetection;
  const c = input.physicalCellHypothesisFormation; const g = input.physicalCellTextEvidenceFormation;
  return hash([
    PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_IDENTITY_FINGERPRINT_VERSION,
    s.sourceByteHash,
    s.schemaVersion, s.reconstructorName, s.reconstructorVersion, s.reconstructionProfileId, s.reconstructionProfileVersion, s.reconstructionContextFingerprintVersion, s.reconstructionContextFingerprint, s.status,
    t.schemaVersion, t.detectorName, t.detectorVersion, t.detectionProfileId, t.detectionProfileVersion, t.detectionContextFingerprintVersion, t.detectionContextFingerprint, t.status,
    c.schemaVersion, c.formationEngineName, c.formationEngineVersion, c.formationProfileId, c.formationProfileVersion, c.formationContextFingerprintVersion, c.formationContextFingerprint, c.status,
    g.schemaVersion, g.formationEngineName, g.formationEngineVersion, g.formationProfileId, g.formationProfileVersion, g.formationContextFingerprintVersion, g.formationContextFingerprint, g.status,
    BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_NAME, BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_VERSION,
    PROFILE.profileId, PROFILE.profileVersion,
    NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_ID, NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_VERSION,
    NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_ID, NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_VERSION,
    PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_CANONICAL_SERIALIZATION_VERSION,
  ]);
}
