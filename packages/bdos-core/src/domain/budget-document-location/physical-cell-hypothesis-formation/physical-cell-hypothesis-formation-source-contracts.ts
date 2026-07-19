import type { BudgetDocumentStructureReconstructionResult } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { BudgetDocumentTabularRegionDetectionResult } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import type { BudgetDocumentPhysicalColumnHypothesisReconstructionResult } from "../physical-column-hypothesis-reconstruction/budget-document-physical-column-hypothesis-reconstruction.types";
import { findCompatibleStructureReconstructionContract } from "../tabular-region-detection/tabular-region-detection-source-contracts";
import { findCompatibleTabularRegionDetectionContract } from "../physical-column-hypothesis-reconstruction/physical-column-hypothesis-reconstruction-source-contracts";

export const SUPPORTED_PHYSICAL_COLUMN_HYPOTHESIS_SOURCE_CONTRACT = Object.freeze({
  schemaVersion: 1,
  reconstructorName: "budget-document-physical-column-hypothesis-reconstructor",
  reconstructorVersion: "budget-document-physical-column-hypothesis-reconstructor-v1",
  profileId: "budget-document-physical-column-hypothesis-reconstruction-profile-v1",
  profileVersion: 1,
  fingerprintVersion: "budget-document-physical-column-hypothesis-reconstruction-context-fingerprint-v1",
});

export function isSupportedStructureContract(source: BudgetDocumentStructureReconstructionResult): boolean {
  return findCompatibleStructureReconstructionContract(source) !== null;
}

export function isSupportedRegionContract(source: BudgetDocumentTabularRegionDetectionResult): boolean {
  return findCompatibleTabularRegionDetectionContract(source) !== null;
}

export function isSupportedColumnContract(source: BudgetDocumentPhysicalColumnHypothesisReconstructionResult): boolean {
  const expected = SUPPORTED_PHYSICAL_COLUMN_HYPOTHESIS_SOURCE_CONTRACT;
  return source.schemaVersion === expected.schemaVersion
    && source.reconstructorName === expected.reconstructorName
    && source.reconstructorVersion === expected.reconstructorVersion
    && source.reconstructionProfileId === expected.profileId
    && source.reconstructionProfileVersion === expected.profileVersion
    && source.reconstructionContextFingerprintVersion === expected.fingerprintVersion;
}
