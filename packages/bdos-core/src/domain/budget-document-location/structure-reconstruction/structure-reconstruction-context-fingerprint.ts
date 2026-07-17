import { createHash } from "node:crypto";
import type { PhysicalDocumentReadResult } from "../physical-document-read.types";
import type { BudgetDocumentPageLocationResult } from "../page-location/budget-page-location.types";
import { STRUCTURE_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION } from "./budget-document-structure-reconstruction.types";

/**
 * Entrada do fingerprint canônico de reconstrução estrutural (Sprint
 * 21.4A.2.f.1, §45). Resume, nunca substitui, as identidades individuais já
 * presentes em `PhysicalDocumentReadResult` e `BudgetDocumentPageLocationResult`.
 * Não exportado pelo barrel público — detalhe de implementação da fronteira
 * do contrato, análogo a `computeGeometryContextFingerprint`.
 */
export interface StructureReconstructionContextFingerprintInput {
  readonly sourceByteHash: string;
  readonly physicalReadSchemaVersion: number;
  readonly physicalReaderName: string;
  readonly physicalReaderVersion: string;
  readonly physicalAdapterVersion: string;
  readonly physicalUnderlyingLibraryVersion: string | null;
  readonly textItemCoordinateSpaceVersion: string;
  readonly textItemGeometryProfileVersion: string;
  readonly geometryContextFingerprintVersion: string;
  readonly geometryContextFingerprint: string;
  readonly pageLocationSchemaVersion: number;
  readonly pageLocatorName: string;
  readonly pageLocatorVersion: string;
  readonly pageLocationDecisionRuleSetVersion: string;
  readonly pageLocationCatalogVersion: string | null;
  readonly pageLocationObserverVersion: string | null;
  readonly pageLocationObservationRuleSetVersion: string | null;
  readonly reconstructorName: string;
  readonly reconstructorVersion: string;
  readonly profileId: string;
  readonly profileVersion: number;
}

/** SHA-256, em hexadecimal, de um array JSON com ordem fixa — nunca concatenação ambígua, nunca UUID, nunca timestamp. Determinístico. */
export function computeStructureReconstructionContextFingerprint(
  input: StructureReconstructionContextFingerprintInput,
): string {
  const canonicalRepresentation: ReadonlyArray<string | number | null> = [
    STRUCTURE_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION,
    input.sourceByteHash,
    input.physicalReadSchemaVersion,
    input.physicalReaderName,
    input.physicalReaderVersion,
    input.physicalAdapterVersion,
    input.physicalUnderlyingLibraryVersion,
    input.textItemCoordinateSpaceVersion,
    input.textItemGeometryProfileVersion,
    input.geometryContextFingerprintVersion,
    input.geometryContextFingerprint,
    input.pageLocationSchemaVersion,
    input.pageLocatorName,
    input.pageLocatorVersion,
    input.pageLocationDecisionRuleSetVersion,
    input.pageLocationCatalogVersion,
    input.pageLocationObserverVersion,
    input.pageLocationObservationRuleSetVersion,
    input.reconstructorName,
    input.reconstructorVersion,
    input.profileId,
    input.profileVersion,
  ];

  return createHash("sha256").update(JSON.stringify(canonicalRepresentation)).digest("hex");
}

/** Constrói a entrada do fingerprint diretamente dos dois contratos de origem e das identidades do reconstrutor — nunca recalcula nem duplica os valores de origem. */
export function buildStructureReconstructionContextFingerprintInput(
  physicalRead: PhysicalDocumentReadResult,
  pageLocation: BudgetDocumentPageLocationResult,
  reconstructorName: string,
  reconstructorVersion: string,
  profileId: string,
  profileVersion: number,
): StructureReconstructionContextFingerprintInput {
  return {
    sourceByteHash: physicalRead.sourceByteHash,
    physicalReadSchemaVersion: physicalRead.schemaVersion,
    physicalReaderName: physicalRead.readerName,
    physicalReaderVersion: physicalRead.readerVersion,
    physicalAdapterVersion: physicalRead.adapterVersion,
    physicalUnderlyingLibraryVersion: physicalRead.underlyingLibraryVersion,
    textItemCoordinateSpaceVersion: physicalRead.textItemCoordinateSpaceVersion,
    textItemGeometryProfileVersion: physicalRead.textItemGeometryProfileVersion,
    geometryContextFingerprintVersion: physicalRead.geometryContextFingerprintVersion,
    geometryContextFingerprint: physicalRead.geometryContextFingerprint,
    pageLocationSchemaVersion: pageLocation.schemaVersion,
    pageLocatorName: pageLocation.locatorName,
    pageLocatorVersion: pageLocation.locatorVersion,
    pageLocationDecisionRuleSetVersion: pageLocation.decisionRuleSetVersion,
    pageLocationCatalogVersion: pageLocation.sourceCatalogVersion,
    pageLocationObserverVersion: pageLocation.sourceObserverVersion,
    pageLocationObservationRuleSetVersion: pageLocation.sourceObservationRuleSetVersion,
    reconstructorName,
    reconstructorVersion,
    profileId,
    profileVersion,
  };
}
