import type { BudgetDocumentStructureReconstructionResult } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { BudgetDocumentTabularRegionDetectionResult } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import type { BudgetDocumentPhysicalCellHypothesisFormationResult } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { BudgetDocumentPhysicalCellTextEvidenceFormationResult } from "../physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";
import { findCompatibleStructureReconstructionContract } from "../tabular-region-detection/tabular-region-detection-source-contracts";
import { isSupportedPhysicalCellHypothesisFormationContract } from "../physical-cell-text-evidence-formation/physical-cell-text-evidence-formation-source-contracts";

/**
 * Portão de compatibilidade exata (§28 Fase 1). Aprova apenas os contratos de
 * origem literalmente listados aqui — nunca comparação lexical de versões,
 * nunca aceitação de versão desconhecida, nunca melhor esforço com um
 * contrato futuro. Os valores foram lidos diretamente dos contratos reais.
 */

export const SUPPORTED_TABULAR_REGION_DETECTION_SOURCE_CONTRACT = Object.freeze({
  schemaVersion: 1,
  detectorName: "budget-document-tabular-region-detector",
  detectorVersion: "budget-document-tabular-region-detector-v1",
  profileId: "budget-document-tabular-region-detection-profile-v1",
  profileVersion: 1,
  fingerprintVersion: "budget-document-tabular-region-detection-context-fingerprint-v1",
});

export const SUPPORTED_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_SOURCE_CONTRACT = Object.freeze({
  schemaVersion: 1,
  engineName: "budget-document-physical-cell-text-evidence-formation-engine",
  engineVersion: "budget-document-physical-cell-text-evidence-formation-engine-v1",
  profileId: "budget-document-physical-cell-text-evidence-formation-profile-v1",
  profileVersion: 1,
  fingerprintVersion: "budget-document-physical-cell-text-evidence-formation-context-fingerprint-v1",
  normalizationVersion: "physical-cell-text-evidence-normalization-v1",
  fragmentAssemblyRuleId: "physical-cell-text-fragment-assembly-source-order-v1",
  fragmentAssemblyRuleVersion: 1,
});

export function isSupportedStructureReconstructionContract(source: BudgetDocumentStructureReconstructionResult): boolean {
  return findCompatibleStructureReconstructionContract(source) !== null;
}

export function isSupportedTabularRegionDetectionContract(source: BudgetDocumentTabularRegionDetectionResult): boolean {
  const expected = SUPPORTED_TABULAR_REGION_DETECTION_SOURCE_CONTRACT;
  return source.schemaVersion === expected.schemaVersion
    && source.detectorName === expected.detectorName
    && source.detectorVersion === expected.detectorVersion
    && source.detectionProfileId === expected.profileId
    && source.detectionProfileVersion === expected.profileVersion
    && source.detectionContextFingerprintVersion === expected.fingerprintVersion;
}

export function isSupportedPhysicalCellHypothesisFormationContractReexport(source: BudgetDocumentPhysicalCellHypothesisFormationResult): boolean {
  return isSupportedPhysicalCellHypothesisFormationContract(source);
}

export function isSupportedPhysicalCellTextEvidenceFormationContract(source: BudgetDocumentPhysicalCellTextEvidenceFormationResult): boolean {
  const expected = SUPPORTED_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_SOURCE_CONTRACT;
  return source.schemaVersion === expected.schemaVersion
    && source.formationEngineName === expected.engineName
    && source.formationEngineVersion === expected.engineVersion
    && source.formationProfileId === expected.profileId
    && source.formationProfileVersion === expected.profileVersion
    && source.formationContextFingerprintVersion === expected.fingerprintVersion
    && source.normalizationVersion === expected.normalizationVersion
    && source.fragmentAssemblyRuleId === expected.fragmentAssemblyRuleId
    && source.fragmentAssemblyRuleVersion === expected.fragmentAssemblyRuleVersion;
}
