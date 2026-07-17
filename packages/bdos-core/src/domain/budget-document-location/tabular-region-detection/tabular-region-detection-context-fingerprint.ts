import { createHash } from "node:crypto";
import type { BudgetDocumentStructureReconstructionResult } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import { TABULAR_REGION_DETECTION_CONTEXT_FINGERPRINT_VERSION } from "./budget-document-tabular-region-detection.types";

/**
 * Entrada da identidade de detecção (Sprint 21.4A.2.f.2a, §17). Resume,
 * nunca substitui, as identidades individuais já presentes em
 * `BudgetDocumentStructureReconstructionResult` — todas elas também
 * expostas individualmente em `BudgetDocumentTabularRegionDetectionResult`.
 * Não exportada pelo barrel público. Usada exclusivamente para semear as
 * chaves determinísticas (`tabular-region-detection-keys.ts`) — nunca
 * incorpora o conteúdo canônico de evidências ou regiões, que só entra no
 * fingerprint final exposto no resultado.
 */
export interface TabularRegionDetectionIdentityFingerprintInput {
  readonly sourceByteHash: string;
  readonly sourceReconstructionSchemaVersion: number;
  readonly sourceReconstructorName: string;
  readonly sourceReconstructorVersion: string;
  readonly sourceReconstructionProfileId: string;
  readonly sourceReconstructionProfileVersion: number;
  readonly sourceReconstructionContextFingerprintVersion: string;
  readonly sourceReconstructionContextFingerprint: string;
  readonly detectorName: string;
  readonly detectorVersion: string;
  readonly profileId: string;
  readonly profileVersion: number;
  readonly alignmentFormationRuleId: string;
  readonly alignmentFormationRuleVersion: number;
  readonly regionFormationRuleId: string;
  readonly regionFormationRuleVersion: number;
  readonly geometryCanonicalizationVersion: string;
}

/** Constrói a entrada da identidade diretamente do contrato de origem e das identidades do detector — nunca recalcula nem duplica os valores de origem. */
export function buildTabularRegionDetectionIdentityFingerprintInput(
  structureReconstruction: BudgetDocumentStructureReconstructionResult,
  detectorName: string,
  detectorVersion: string,
  profileId: string,
  profileVersion: number,
  alignmentFormationRuleId: string,
  alignmentFormationRuleVersion: number,
  regionFormationRuleId: string,
  regionFormationRuleVersion: number,
  geometryCanonicalizationVersion: string,
): TabularRegionDetectionIdentityFingerprintInput {
  return {
    sourceByteHash: structureReconstruction.sourceByteHash,
    sourceReconstructionSchemaVersion: structureReconstruction.schemaVersion,
    sourceReconstructorName: structureReconstruction.reconstructorName,
    sourceReconstructorVersion: structureReconstruction.reconstructorVersion,
    sourceReconstructionProfileId: structureReconstruction.reconstructionProfileId,
    sourceReconstructionProfileVersion: structureReconstruction.reconstructionProfileVersion,
    sourceReconstructionContextFingerprintVersion: structureReconstruction.reconstructionContextFingerprintVersion,
    sourceReconstructionContextFingerprint: structureReconstruction.reconstructionContextFingerprint,
    detectorName,
    detectorVersion,
    profileId,
    profileVersion,
    alignmentFormationRuleId,
    alignmentFormationRuleVersion,
    regionFormationRuleId,
    regionFormationRuleVersion,
    geometryCanonicalizationVersion,
  };
}

/** SHA-256, em hexadecimal, de um array JSON com ordem fixa — nunca concatenação ambígua, nunca UUID, nunca timestamp. Determinístico. */
export function computeTabularRegionDetectionIdentityFingerprint(input: TabularRegionDetectionIdentityFingerprintInput): string {
  const canonicalRepresentation: ReadonlyArray<string | number> = [
    TABULAR_REGION_DETECTION_CONTEXT_FINGERPRINT_VERSION,
    input.sourceByteHash,
    input.sourceReconstructionSchemaVersion,
    input.sourceReconstructorName,
    input.sourceReconstructorVersion,
    input.sourceReconstructionProfileId,
    input.sourceReconstructionProfileVersion,
    input.sourceReconstructionContextFingerprintVersion,
    input.sourceReconstructionContextFingerprint,
    input.detectorName,
    input.detectorVersion,
    input.profileId,
    input.profileVersion,
    input.alignmentFormationRuleId,
    input.alignmentFormationRuleVersion,
    input.regionFormationRuleId,
    input.regionFormationRuleVersion,
    input.geometryCanonicalizationVersion,
  ];
  return createHash("sha256").update(JSON.stringify(canonicalRepresentation)).digest("hex");
}

/**
 * Fingerprint final da detecção (§17), exposto em
 * `BudgetDocumentTabularRegionDetectionResult.detectionContextFingerprint`.
 * Incorpora a identidade de detecção *e* o conteúdo canônico dos grupos
 * processados (evidências de alinhamento, regiões, disposições, problemas,
 * métricas) — nunca apenas identidades pré-processamento, ao contrário da
 * chave interna de detecção. `canonicalGroupsRepresentation` deve ser
 * produzida a partir de estruturas já ordenadas canonicamente (nunca a
 * ordem original dos arrays de entrada) para permanecer independente de
 * permutação.
 */
export function computeTabularRegionDetectionContentFingerprint(
  identityFingerprint: string,
  canonicalGroupsRepresentation: unknown,
): string {
  const canonicalRepresentation: ReadonlyArray<unknown> = [
    TABULAR_REGION_DETECTION_CONTEXT_FINGERPRINT_VERSION,
    identityFingerprint,
    canonicalGroupsRepresentation,
  ];
  return createHash("sha256").update(JSON.stringify(canonicalRepresentation)).digest("hex");
}
