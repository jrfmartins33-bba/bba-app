export {
  formBudgetDocumentPhysicalCellHypothesesWithDependencies,
  getDefaultPhysicalCellFormationDependencies,
} from "../form-budget-document-physical-cell-hypotheses";
export type { PhysicalCellFormationDependencies } from "../form-budget-document-physical-cell-hypotheses";
import type { BudgetDocumentPhysicalCellHypothesisFormationInput } from "../budget-document-physical-cell-hypothesis-formation.types";
import type { BudgetDocumentPhysicalColumnHypothesisReconstructionResult, PhysicalColumnHypothesisReconstructionGroup } from "../../physical-column-hypothesis-reconstruction/budget-document-physical-column-hypothesis-reconstruction.types";
import { buildPhysicalColumnHypothesisReconstructionIdentityFingerprintInput, computePhysicalColumnHypothesisReconstructionContentFingerprint, computePhysicalColumnHypothesisReconstructionIdentityFingerprint } from "../../physical-column-hypothesis-reconstruction/physical-column-hypothesis-reconstruction-context-fingerprint";
import { PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_ID, PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_VERSION } from "../../physical-column-hypothesis-reconstruction/physical-vertical-band-construction";
import { PHYSICAL_COLUMN_HYPOTHESIS_FORMATION_RULE_ID, PHYSICAL_COLUMN_HYPOTHESIS_FORMATION_RULE_VERSION } from "../../physical-column-hypothesis-reconstruction/physical-column-hypothesis-formation";
import { BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_PROFILE_V1 } from "../../physical-column-hypothesis-reconstruction/physical-column-hypothesis-reconstruction-profile";

export function replaceAndResignColumnGroups(input: BudgetDocumentPhysicalCellHypothesisFormationInput, groups: ReadonlyArray<PhysicalColumnHypothesisReconstructionGroup>): BudgetDocumentPhysicalCellHypothesisFormationInput {
  const current = input.physicalColumnHypothesisReconstruction;
  const identity = computePhysicalColumnHypothesisReconstructionIdentityFingerprint(buildPhysicalColumnHypothesisReconstructionIdentityFingerprintInput(
    input.structureReconstruction, input.tabularRegionDetection, current.reconstructorName, current.reconstructorVersion,
    current.reconstructionProfileId, current.reconstructionProfileVersion,
    PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_ID, PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_VERSION,
    PHYSICAL_COLUMN_HYPOTHESIS_FORMATION_RULE_ID, PHYSICAL_COLUMN_HYPOTHESIS_FORMATION_RULE_VERSION,
    BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_PROFILE_V1.geometryCanonicalizationVersion,
  ));
  const replacement: BudgetDocumentPhysicalColumnHypothesisReconstructionResult = { ...current, groups, reconstructionContextFingerprint: computePhysicalColumnHypothesisReconstructionContentFingerprint(identity, groups) };
  return { ...input, physicalColumnHypothesisReconstruction: replacement };
}
