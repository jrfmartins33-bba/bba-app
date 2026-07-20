import { createHash } from "node:crypto";
import type { BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult } from "../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import {
  BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_NAME,
  BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_VERSION,
  NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_ID,
  NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_VERSION,
  NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_ID,
  NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_VERSION,
  PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_CANONICAL_SERIALIZATION_VERSION,
  PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_IDENTITY_FINGERPRINT_VERSION,
} from "../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import { PROFILE as PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_PROFILE } from "../page-local-neutral-structured-evidence-formation/page-local-neutral-structured-evidence-formation-profile";
import { computeResultFingerprint } from "../page-local-neutral-structured-evidence-formation/page-local-neutral-structured-evidence-formation-result-fingerprint";

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Recomputa o fingerprint de IDENTIDADE da g.2 a partir exclusivamente dos
 * campos que ela mesma já publica em seu resultado (nunca a partir dos
 * quatro contratos originais, que a g.3 não consome) — mesma ordem exata da
 * função real interna da g.2 (`computeIdentityFingerprint`), reconstruída
 * aqui porque aquela função exige o `Input` de quatro contratos brutos que a
 * g.3 nunca recebe. As constantes de versão/engine/perfil/regra são
 * importadas diretamente da g.2, nunca copiadas manualmente (§2 da
 * especificação aprovada).
 */
export function recomputePageLocalNeutralStructuredEvidenceFormationIdentityFingerprint(
  result: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult,
): string {
  return hash([
    PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_IDENTITY_FINGERPRINT_VERSION,
    result.sourceByteHash,
    result.sourceStructureReconstructionSchemaVersion, result.sourceStructureReconstructorName, result.sourceStructureReconstructorVersion,
    result.sourceStructureReconstructionProfileId, result.sourceStructureReconstructionProfileVersion,
    result.sourceStructureReconstructionContextFingerprintVersion, result.sourceStructureReconstructionContextFingerprint, result.sourceStructureReconstructionStatus,
    result.sourceTabularRegionDetectionSchemaVersion, result.sourceTabularRegionDetectorName, result.sourceTabularRegionDetectorVersion,
    result.sourceTabularRegionDetectionProfileId, result.sourceTabularRegionDetectionProfileVersion,
    result.sourceTabularRegionDetectionContextFingerprintVersion, result.sourceTabularRegionDetectionContextFingerprint, result.sourceTabularRegionDetectionStatus,
    result.sourcePhysicalCellHypothesisFormationSchemaVersion, result.sourcePhysicalCellHypothesisFormationEngineName, result.sourcePhysicalCellHypothesisFormationEngineVersion,
    result.sourcePhysicalCellHypothesisFormationProfileId, result.sourcePhysicalCellHypothesisFormationProfileVersion,
    result.sourcePhysicalCellHypothesisFormationContextFingerprintVersion, result.sourcePhysicalCellHypothesisFormationContextFingerprint, result.sourcePhysicalCellHypothesisFormationStatus,
    result.sourcePhysicalCellTextEvidenceFormationSchemaVersion, result.sourcePhysicalCellTextEvidenceFormationEngineName, result.sourcePhysicalCellTextEvidenceFormationEngineVersion,
    result.sourcePhysicalCellTextEvidenceFormationProfileId, result.sourcePhysicalCellTextEvidenceFormationProfileVersion,
    result.sourcePhysicalCellTextEvidenceFormationContextFingerprintVersion, result.sourcePhysicalCellTextEvidenceFormationContextFingerprint, result.sourcePhysicalCellTextEvidenceFormationStatus,
    BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_NAME, BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_VERSION,
    PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_PROFILE.profileId, PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_PROFILE.profileVersion,
    NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_ID, NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_VERSION,
    NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_ID, NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_VERSION,
    PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_CANONICAL_SERIALIZATION_VERSION,
  ]);
}

/**
 * Valida integralmente o fingerprint de identidade E o fingerprint final da
 * g.2 consumida. O fingerprint final reaproveita a função REAL da g.2
 * (`computeResultFingerprint`, importada diretamente) — nunca uma fórmula
 * paralela — aplicada exatamente ao mesmo conteúdo que a g.2 usa para
 * publicar o seu próprio `resultFingerprint`.
 */
export function isPageLocalNeutralStructuredEvidenceFormationFingerprintValid(
  result: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult,
): boolean {
  const identity = recomputePageLocalNeutralStructuredEvidenceFormationIdentityFingerprint(result);
  if (identity !== result.identityFingerprint) return false;
  const content = { status: result.status, groups: result.groups, technicalProblems: result.technicalProblems, metrics: result.metrics, limitations: result.limitations };
  return computeResultFingerprint(identity, content) === result.resultFingerprint;
}
