import { createHash } from "node:crypto";
import type { BudgetDocumentTabularRegionDetectionResult } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import type { BudgetDocumentPhysicalCellTextEvidenceFormationResult } from "../physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";
import type { TabularRegionDetectionIdentityFingerprintInput } from "../tabular-region-detection/tabular-region-detection-context-fingerprint";
import { computeTabularRegionDetectionContentFingerprint, computeTabularRegionDetectionIdentityFingerprint } from "../tabular-region-detection/tabular-region-detection-context-fingerprint";
import { VERTICAL_ALIGNMENT_OBSERVATION_RULE_ID, VERTICAL_ALIGNMENT_OBSERVATION_RULE_VERSION } from "../tabular-region-detection/vertical-alignment-observation";
import { TABULAR_REGION_FORMATION_RULE_ID, TABULAR_REGION_FORMATION_RULE_VERSION } from "../tabular-region-detection/tabular-region-formation";
import { TABULAR_REGION_DETECTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION } from "../tabular-region-detection/tabular-region-detection-output-geometry-canonicalization";
import { BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_NAME, BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_VERSION, PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_CONTEXT_FINGERPRINT_VERSION, PHYSICAL_CELL_TEXT_EVIDENCE_NORMALIZATION_VERSION, PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_ID, PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_VERSION } from "../physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";
import { computeContentFingerprint as computeCellTextEvidenceContentFingerprint } from "../physical-cell-text-evidence-formation/physical-cell-text-evidence-formation-context-fingerprint";
import { PROFILE as CELL_TEXT_EVIDENCE_PROFILE } from "../physical-cell-text-evidence-formation/physical-cell-text-evidence-formation-profile";

// A validação do fingerprint da reconstrução estrutural e da formação física
// de células reutiliza literalmente os validadores reais já publicados pela
// g.1 — nunca uma fórmula nova (§28 Fase 3). Falha de qualquer um é sempre
// global (`source_fingerprint_invalid`), nunca localizada.
export { isPhysicalCellHypothesisFormationFingerprintValid, isStructureReconstructionFingerprintValid } from "../physical-cell-text-evidence-formation/physical-cell-text-evidence-formation-upstream-fingerprint-validation";

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Recalcula o fingerprint final da detecção de regiões (f.2a) a partir dos
 * campos que ela mesma expõe, usando exatamente as funções reais da f.2a
 * (`computeTabularRegionDetectionIdentityFingerprint` +
 * `computeTabularRegionDetectionContentFingerprint`). As identidades das
 * regras de alinhamento/região e da canonicalização são as únicas que o
 * perfil suportado (`...-profile-v1`) pode produzir — importadas diretamente
 * das constantes reais, nunca adivinhadas.
 */
export function isTabularRegionDetectionFingerprintValid(source: BudgetDocumentTabularRegionDetectionResult): boolean {
  const identityInput: TabularRegionDetectionIdentityFingerprintInput = {
    sourceByteHash: source.sourceByteHash,
    sourceReconstructionSchemaVersion: source.sourceReconstructionSchemaVersion,
    sourceReconstructorName: source.sourceReconstructorName,
    sourceReconstructorVersion: source.sourceReconstructorVersion,
    sourceReconstructionProfileId: source.sourceReconstructionProfileId,
    sourceReconstructionProfileVersion: source.sourceReconstructionProfileVersion,
    sourceReconstructionContextFingerprintVersion: source.sourceReconstructionContextFingerprintVersion,
    sourceReconstructionContextFingerprint: source.sourceReconstructionContextFingerprint,
    detectorName: source.detectorName,
    detectorVersion: source.detectorVersion,
    profileId: source.detectionProfileId,
    profileVersion: source.detectionProfileVersion,
    alignmentFormationRuleId: VERTICAL_ALIGNMENT_OBSERVATION_RULE_ID,
    alignmentFormationRuleVersion: VERTICAL_ALIGNMENT_OBSERVATION_RULE_VERSION,
    regionFormationRuleId: TABULAR_REGION_FORMATION_RULE_ID,
    regionFormationRuleVersion: TABULAR_REGION_FORMATION_RULE_VERSION,
    geometryCanonicalizationVersion: TABULAR_REGION_DETECTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION,
  };
  const identity = computeTabularRegionDetectionIdentityFingerprint(identityInput);
  return computeTabularRegionDetectionContentFingerprint(identity, source.groups) === source.detectionContextFingerprint;
}

/**
 * Recalcula o fingerprint de identidade da g.1 a partir dos campos achatados
 * que ela mesma expõe em seu resultado, na mesma ordem exata de
 * `computeIdentityFingerprint` (arquivo interno da g.1). Constantes reais
 * (engine, perfil, normalização, montagem) são importadas diretamente da g.1
 * — nunca copiadas manualmente.
 */
export function recomputePhysicalCellTextEvidenceFormationIdentityFingerprint(result: BudgetDocumentPhysicalCellTextEvidenceFormationResult): string {
  return hash([
    PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_CONTEXT_FINGERPRINT_VERSION,
    result.sourceByteHash,
    result.sourcePhysicalReadSchemaVersion, result.sourcePhysicalReaderName, result.sourcePhysicalReaderVersion, result.sourcePhysicalAdapterVersion, result.sourcePhysicalUnderlyingLibraryVersion,
    result.sourcePhysicalTextItemCoordinateSpaceVersion, result.sourcePhysicalTextItemGeometryProfileVersion, result.sourcePhysicalGeometryContextFingerprintVersion, result.sourcePhysicalGeometryContextFingerprint, result.sourcePhysicalReadStatus,
    result.sourceStructureReconstructionSchemaVersion, result.sourceStructureReconstructorName, result.sourceStructureReconstructorVersion, result.sourceStructureReconstructionProfileId, result.sourceStructureReconstructionProfileVersion, result.sourceStructureReconstructionContextFingerprintVersion, result.sourceStructureReconstructionContextFingerprint, result.sourceStructureReconstructionStatus,
    result.sourcePhysicalCellHypothesisFormationSchemaVersion, result.sourcePhysicalCellHypothesisFormationEngineName, result.sourcePhysicalCellHypothesisFormationEngineVersion, result.sourcePhysicalCellHypothesisFormationProfileId, result.sourcePhysicalCellHypothesisFormationProfileVersion, result.sourcePhysicalCellHypothesisFormationContextFingerprintVersion, result.sourcePhysicalCellHypothesisFormationContextFingerprint, result.sourcePhysicalCellHypothesisFormationStatus,
    BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_NAME, BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_VERSION,
    CELL_TEXT_EVIDENCE_PROFILE.profileId, CELL_TEXT_EVIDENCE_PROFILE.profileVersion,
    PHYSICAL_CELL_TEXT_EVIDENCE_NORMALIZATION_VERSION,
    PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_ID, PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_VERSION,
  ]);
}

export function isPhysicalCellTextEvidenceFormationFingerprintValid(result: BudgetDocumentPhysicalCellTextEvidenceFormationResult): boolean {
  const identity = recomputePhysicalCellTextEvidenceFormationIdentityFingerprint(result);
  const content = { status: result.status, groups: result.groups, technicalProblems: result.technicalProblems, metrics: result.metrics, limitations: result.limitations };
  return computeCellTextEvidenceContentFingerprint(identity, content) === result.formationContextFingerprint;
}
