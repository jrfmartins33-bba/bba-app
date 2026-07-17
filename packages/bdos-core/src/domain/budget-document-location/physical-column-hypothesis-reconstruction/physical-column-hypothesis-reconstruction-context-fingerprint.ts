import { createHash } from "node:crypto";
import type { BudgetDocumentStructureReconstructionResult } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { BudgetDocumentTabularRegionDetectionResult } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import { PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION } from "./budget-document-physical-column-hypothesis-reconstruction.types";

/**
 * Entrada da identidade de reconstrução (Sprint 21.4A.2.f.2b). Resume,
 * nunca substitui, as identidades individuais já presentes nos dois
 * contratos de origem — todas elas também expostas individualmente em
 * `BudgetDocumentPhysicalColumnHypothesisReconstructionResult`. Não
 * exportada pelo barrel público. Usada exclusivamente para semear as
 * chaves determinísticas — nunca incorpora o conteúdo canônico de
 * hipóteses ou disposições, que só entra no fingerprint final exposto no
 * resultado.
 */
export interface PhysicalColumnHypothesisReconstructionIdentityFingerprintInput {
  readonly sourceByteHash: string;
  readonly sourceStructureReconstructionSchemaVersion: number;
  readonly sourceStructureReconstructorName: string;
  readonly sourceStructureReconstructorVersion: string;
  readonly sourceStructureReconstructionProfileId: string;
  readonly sourceStructureReconstructionProfileVersion: number;
  readonly sourceStructureReconstructionContextFingerprintVersion: string;
  readonly sourceStructureReconstructionContextFingerprint: string;
  readonly sourceTabularRegionDetectionSchemaVersion: number;
  readonly sourceTabularRegionDetectorName: string;
  readonly sourceTabularRegionDetectorVersion: string;
  readonly sourceTabularRegionDetectionProfileId: string;
  readonly sourceTabularRegionDetectionProfileVersion: number;
  readonly sourceTabularRegionDetectionContextFingerprintVersion: string;
  readonly sourceTabularRegionDetectionContextFingerprint: string;
  readonly reconstructorName: string;
  readonly reconstructorVersion: string;
  readonly profileId: string;
  readonly profileVersion: number;
  readonly bandConstructionRuleId: string;
  readonly bandConstructionRuleVersion: number;
  readonly hypothesisFormationRuleId: string;
  readonly hypothesisFormationRuleVersion: number;
  readonly geometryCanonicalizationVersion: string;
}

/** Constrói a entrada da identidade diretamente dos dois contratos de origem e das identidades do reconstrutor — nunca recalcula nem duplica os valores de origem. */
export function buildPhysicalColumnHypothesisReconstructionIdentityFingerprintInput(
  structureReconstruction: BudgetDocumentStructureReconstructionResult,
  tabularRegionDetection: BudgetDocumentTabularRegionDetectionResult,
  reconstructorName: string,
  reconstructorVersion: string,
  profileId: string,
  profileVersion: number,
  bandConstructionRuleId: string,
  bandConstructionRuleVersion: number,
  hypothesisFormationRuleId: string,
  hypothesisFormationRuleVersion: number,
  geometryCanonicalizationVersion: string,
): PhysicalColumnHypothesisReconstructionIdentityFingerprintInput {
  return {
    sourceByteHash: structureReconstruction.sourceByteHash,
    sourceStructureReconstructionSchemaVersion: structureReconstruction.schemaVersion,
    sourceStructureReconstructorName: structureReconstruction.reconstructorName,
    sourceStructureReconstructorVersion: structureReconstruction.reconstructorVersion,
    sourceStructureReconstructionProfileId: structureReconstruction.reconstructionProfileId,
    sourceStructureReconstructionProfileVersion: structureReconstruction.reconstructionProfileVersion,
    sourceStructureReconstructionContextFingerprintVersion: structureReconstruction.reconstructionContextFingerprintVersion,
    sourceStructureReconstructionContextFingerprint: structureReconstruction.reconstructionContextFingerprint,
    sourceTabularRegionDetectionSchemaVersion: tabularRegionDetection.schemaVersion,
    sourceTabularRegionDetectorName: tabularRegionDetection.detectorName,
    sourceTabularRegionDetectorVersion: tabularRegionDetection.detectorVersion,
    sourceTabularRegionDetectionProfileId: tabularRegionDetection.detectionProfileId,
    sourceTabularRegionDetectionProfileVersion: tabularRegionDetection.detectionProfileVersion,
    sourceTabularRegionDetectionContextFingerprintVersion: tabularRegionDetection.detectionContextFingerprintVersion,
    sourceTabularRegionDetectionContextFingerprint: tabularRegionDetection.detectionContextFingerprint,
    reconstructorName,
    reconstructorVersion,
    profileId,
    profileVersion,
    bandConstructionRuleId,
    bandConstructionRuleVersion,
    hypothesisFormationRuleId,
    hypothesisFormationRuleVersion,
    geometryCanonicalizationVersion,
  };
}

/** SHA-256, em hexadecimal, de um array JSON com ordem fixa — nunca concatenação ambígua, nunca UUID, nunca timestamp. Determinístico. */
export function computePhysicalColumnHypothesisReconstructionIdentityFingerprint(
  input: PhysicalColumnHypothesisReconstructionIdentityFingerprintInput,
): string {
  const canonicalRepresentation: ReadonlyArray<string | number> = [
    PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION,
    input.sourceByteHash,
    input.sourceStructureReconstructionSchemaVersion,
    input.sourceStructureReconstructorName,
    input.sourceStructureReconstructorVersion,
    input.sourceStructureReconstructionProfileId,
    input.sourceStructureReconstructionProfileVersion,
    input.sourceStructureReconstructionContextFingerprintVersion,
    input.sourceStructureReconstructionContextFingerprint,
    input.sourceTabularRegionDetectionSchemaVersion,
    input.sourceTabularRegionDetectorName,
    input.sourceTabularRegionDetectorVersion,
    input.sourceTabularRegionDetectionProfileId,
    input.sourceTabularRegionDetectionProfileVersion,
    input.sourceTabularRegionDetectionContextFingerprintVersion,
    input.sourceTabularRegionDetectionContextFingerprint,
    input.reconstructorName,
    input.reconstructorVersion,
    input.profileId,
    input.profileVersion,
    input.bandConstructionRuleId,
    input.bandConstructionRuleVersion,
    input.hypothesisFormationRuleId,
    input.hypothesisFormationRuleVersion,
    input.geometryCanonicalizationVersion,
  ];
  return createHash("sha256").update(JSON.stringify(canonicalRepresentation)).digest("hex");
}

/**
 * Fingerprint final da reconstrução, exposto em
 * `BudgetDocumentPhysicalColumnHypothesisReconstructionResult.reconstructionContextFingerprint`.
 * Incorpora a identidade *e* o conteúdo canônico dos grupos processados
 * (hipóteses, disposições, problemas, métricas) — mesmo padrão de duas
 * camadas já usado pela Sprint 21.4A.2.f.2a.
 */
export function computePhysicalColumnHypothesisReconstructionContentFingerprint(
  identityFingerprint: string,
  canonicalGroupsRepresentation: unknown,
): string {
  const canonicalRepresentation: ReadonlyArray<unknown> = [
    PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION,
    identityFingerprint,
    canonicalGroupsRepresentation,
  ];
  return createHash("sha256").update(JSON.stringify(canonicalRepresentation)).digest("hex");
}
