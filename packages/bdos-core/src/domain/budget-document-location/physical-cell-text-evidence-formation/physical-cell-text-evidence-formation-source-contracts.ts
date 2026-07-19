import type { PhysicalDocumentReadResult } from "../physical-document-read.types";
import type { BudgetDocumentStructureReconstructionResult } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { BudgetDocumentPhysicalCellHypothesisFormationResult } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import { findCompatiblePhysicalReadContract } from "../structure-reconstruction/structure-reconstruction-source-contracts";
import { findCompatibleStructureReconstructionContract } from "../tabular-region-detection/tabular-region-detection-source-contracts";

export const SUPPORTED_PHYSICAL_CELL_HYPOTHESIS_FORMATION_SOURCE_CONTRACT = Object.freeze({
  schemaVersion: 1,
  formationEngineName: "budget-document-physical-cell-hypothesis-formation-engine",
  formationEngineVersion: "budget-document-physical-cell-hypothesis-formation-engine-v1",
  profileId: "budget-document-physical-cell-hypothesis-formation-profile-v1",
  profileVersion: 1,
  fingerprintVersion: "budget-document-physical-cell-hypothesis-formation-context-fingerprint-v1",
});

export function isSupportedPhysicalReadContract(source: PhysicalDocumentReadResult): boolean {
  return findCompatiblePhysicalReadContract(source) !== null;
}

export function isSupportedStructureReconstructionContract(source: BudgetDocumentStructureReconstructionResult): boolean {
  return findCompatibleStructureReconstructionContract(source) !== null;
}

export function isSupportedPhysicalCellHypothesisFormationContract(source: BudgetDocumentPhysicalCellHypothesisFormationResult): boolean {
  const expected = SUPPORTED_PHYSICAL_CELL_HYPOTHESIS_FORMATION_SOURCE_CONTRACT;
  return source.schemaVersion === expected.schemaVersion
    && source.formationEngineName === expected.formationEngineName
    && source.formationEngineVersion === expected.formationEngineVersion
    && source.formationProfileId === expected.profileId
    && source.formationProfileVersion === expected.profileVersion
    && source.formationContextFingerprintVersion === expected.fingerprintVersion;
}
