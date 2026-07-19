import { createHash } from "node:crypto";
import type { PhysicalDocumentReadResult } from "../physical-document-read.types";
import type { BudgetDocumentStructureReconstructionResult } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { BudgetDocumentPhysicalCellHypothesisFormationResult } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import { computeGeometryContextFingerprint } from "../physical-document-geometry-context-fingerprint";
import { computeStructureReconstructionContextFingerprint } from "../structure-reconstruction/structure-reconstruction-context-fingerprint";
import { computeContentFingerprint as computeCellHypothesisFormationContentFingerprint } from "../physical-cell-hypothesis-formation/physical-cell-hypothesis-formation-context-fingerprint";
import { PHYSICAL_GRID_FORMATION_RULE_ID, PHYSICAL_GRID_FORMATION_RULE_VERSION, PHYSICAL_CELL_HYPOTHESIS_FORMATION_RULE_ID, PHYSICAL_CELL_HYPOTHESIS_FORMATION_RULE_VERSION, PROFILE as CELL_HYPOTHESIS_FORMATION_PROFILE } from "../physical-cell-hypothesis-formation/physical-cell-hypothesis-formation-profile";
import { BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_ENGINE_NAME, BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_ENGINE_VERSION, PHYSICAL_CELL_HYPOTHESIS_FORMATION_CONTEXT_FINGERPRINT_VERSION } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";

/**
 * Reaproveita as regras reais de fingerprint já publicadas por cada
 * capacidade upstream (nunca uma fórmula nova, nunca duplicando valores —
 * apenas a montagem, inevitável porque a g.1 nunca recebe os contratos
 * intermediários de f.2a/f.2b necessários para chamar
 * `computeIdentityFingerprint` da f.2c diretamente). Falha de qualquer um dos
 * três é sempre global (`source_fingerprint_invalid`), nunca localizada.
 */

export function isPhysicalReadFingerprintValid(physicalRead: PhysicalDocumentReadResult): boolean {
  return computeGeometryContextFingerprint({
    sourceByteHash: physicalRead.sourceByteHash,
    physicalReadSchemaVersion: physicalRead.schemaVersion,
    readerName: physicalRead.readerName,
    readerVersion: physicalRead.readerVersion,
    adapterVersion: physicalRead.adapterVersion,
    underlyingLibraryVersion: physicalRead.underlyingLibraryVersion,
    coordinateSpaceVersion: physicalRead.textItemCoordinateSpaceVersion,
    geometryProfileVersion: physicalRead.textItemGeometryProfileVersion,
  }) === physicalRead.geometryContextFingerprint;
}

export function isStructureReconstructionFingerprintValid(structureReconstruction: BudgetDocumentStructureReconstructionResult): boolean {
  return computeStructureReconstructionContextFingerprint({
    sourceByteHash: structureReconstruction.sourceByteHash,
    physicalReadSchemaVersion: structureReconstruction.physicalReadSchemaVersion,
    physicalReaderName: structureReconstruction.physicalReaderName,
    physicalReaderVersion: structureReconstruction.physicalReaderVersion,
    physicalAdapterVersion: structureReconstruction.physicalAdapterVersion,
    physicalUnderlyingLibraryVersion: structureReconstruction.physicalUnderlyingLibraryVersion,
    textItemCoordinateSpaceVersion: structureReconstruction.physicalTextItemCoordinateSpaceVersion,
    textItemGeometryProfileVersion: structureReconstruction.physicalTextItemGeometryProfileVersion,
    geometryContextFingerprintVersion: structureReconstruction.physicalGeometryContextFingerprintVersion,
    geometryContextFingerprint: structureReconstruction.physicalGeometryContextFingerprint,
    pageLocationSchemaVersion: structureReconstruction.pageLocationSchemaVersion,
    pageLocatorName: structureReconstruction.pageLocatorName,
    pageLocatorVersion: structureReconstruction.pageLocatorVersion,
    pageLocationDecisionRuleSetVersion: structureReconstruction.pageLocationDecisionRuleSetVersion,
    sourceObservationSchemaVersion: structureReconstruction.sourceObservationSchemaVersion,
    sourceObserverName: structureReconstruction.sourceObserverName,
    pageLocationCatalogVersion: structureReconstruction.sourceCatalogVersion,
    pageLocationObserverVersion: structureReconstruction.sourceObserverVersion,
    pageLocationObservationRuleSetVersion: structureReconstruction.sourceObservationRuleSetVersion,
    reconstructorName: structureReconstruction.reconstructorName,
    reconstructorVersion: structureReconstruction.reconstructorVersion,
    profileId: structureReconstruction.reconstructionProfileId,
    profileVersion: structureReconstruction.reconstructionProfileVersion,
    // Mesmo literal hardcoded já usado pela própria f.2c em `fingerprintsAreValid` — não é um valor inventado aqui.
    geometryCanonicalizationVersion: "structure-reconstruction-output-geometry-canonicalization-v1",
  }) === structureReconstruction.reconstructionContextFingerprint;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Recalcula o fingerprint de identidade da f.2c a partir dos campos
 * achatados que ela mesma já expõe em seu resultado, na mesma ordem exata de
 * `computeIdentityFingerprint` (arquivo interno da f.2c, não reexportável
 * sem os objetos intermediários de f.2a/f.2b que a g.1 nunca recebe).
 * Constantes reais (engine, perfil, regras) são importadas diretamente da
 * f.2c — nunca copiadas manualmente.
 */
export function recomputePhysicalCellHypothesisFormationIdentityFingerprint(result: BudgetDocumentPhysicalCellHypothesisFormationResult): string {
  return hash([
    PHYSICAL_CELL_HYPOTHESIS_FORMATION_CONTEXT_FINGERPRINT_VERSION,
    result.sourceByteHash,
    result.sourceStructureReconstructionSchemaVersion, result.sourceStructureReconstructorName, result.sourceStructureReconstructorVersion,
    result.sourceStructureReconstructionProfileId, result.sourceStructureReconstructionProfileVersion,
    result.sourceStructureReconstructionContextFingerprintVersion, result.sourceStructureReconstructionContextFingerprint,
    result.sourceTabularRegionDetectionSchemaVersion, result.sourceTabularRegionDetectorName, result.sourceTabularRegionDetectorVersion,
    result.sourceTabularRegionDetectionProfileId, result.sourceTabularRegionDetectionProfileVersion,
    result.sourceTabularRegionDetectionContextFingerprintVersion, result.sourceTabularRegionDetectionContextFingerprint,
    result.sourcePhysicalColumnHypothesisReconstructionSchemaVersion, result.sourcePhysicalColumnHypothesisReconstructorName, result.sourcePhysicalColumnHypothesisReconstructorVersion,
    result.sourcePhysicalColumnHypothesisReconstructionProfileId, result.sourcePhysicalColumnHypothesisReconstructionProfileVersion,
    result.sourcePhysicalColumnHypothesisReconstructionContextFingerprintVersion, result.sourcePhysicalColumnHypothesisReconstructionContextFingerprint,
    BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_ENGINE_NAME, BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_ENGINE_VERSION,
    CELL_HYPOTHESIS_FORMATION_PROFILE.profileId, CELL_HYPOTHESIS_FORMATION_PROFILE.profileVersion,
    PHYSICAL_GRID_FORMATION_RULE_ID, PHYSICAL_GRID_FORMATION_RULE_VERSION,
    PHYSICAL_CELL_HYPOTHESIS_FORMATION_RULE_ID, PHYSICAL_CELL_HYPOTHESIS_FORMATION_RULE_VERSION,
    CELL_HYPOTHESIS_FORMATION_PROFILE.geometryCanonicalizationVersion,
  ]);
}

export function isPhysicalCellHypothesisFormationFingerprintValid(result: BudgetDocumentPhysicalCellHypothesisFormationResult): boolean {
  const identity = recomputePhysicalCellHypothesisFormationIdentityFingerprint(result);
  const content = { status: result.status, groups: result.groups, technicalProblems: result.technicalProblems, metrics: result.metrics, limitations: result.limitations };
  return computeCellHypothesisFormationContentFingerprint(identity, content) === result.formationContextFingerprint;
}
