import type { BudgetDocumentPageLocationResult } from "../page-location/budget-page-location.types";
import type { PhysicalDocumentReadResult } from "../physical-document-read.types";

/**
 * Portão de compatibilidade exata (Sprint 21.4A.2.f.1, §15). Aprova apenas
 * os contratos de origem literalmente listados aqui — nunca comparação
 * lexical de versões, nunca aceitação de versão desconhecida, nunca melhor
 * esforço com um contrato futuro. Os valores abaixo foram lidos diretamente
 * dos contratos reais (`physical-document-read.types.ts`,
 * `budget-page-location.types.ts`, `signal-observation.types.ts`,
 * `page-location-decision-rule-registry.ts`) — nunca adivinhados.
 */

export interface SupportedPhysicalReadSourceContract {
  readonly schemaVersion: number;
  readonly readerName: string;
  readonly readerVersion: string;
  readonly coordinateSpaceVersion: string;
  readonly geometryProfileVersion: string;
  readonly geometryContextFingerprintVersion: string;
}

export interface SupportedPageLocationSourceContract {
  readonly schemaVersion: number;
  readonly locatorName: string;
  readonly locatorVersion: string;
  readonly decisionRuleSetVersion: string;
  readonly observerVersion: string;
  readonly observationRuleSetVersion: string;
  readonly catalogVersion: string;
}

export const SUPPORTED_STRUCTURE_RECONSTRUCTION_SOURCE_CONTRACTS = {
  physicalRead: [
    {
      schemaVersion: 2,
      readerName: "physical-document-reader",
      readerVersion: "physical-document-reader-v2",
      coordinateSpaceVersion: "physical-document-text-item-coordinate-space-v1",
      geometryProfileVersion: "physical-document-text-item-geometry-profile-v1",
      geometryContextFingerprintVersion: "physical-document-geometry-context-fingerprint-v1",
    },
  ],
  pageLocation: [
    {
      schemaVersion: 1,
      locatorName: "budget-document-page-locator",
      locatorVersion: "budget-document-page-locator-v1",
      decisionRuleSetVersion: "budget-document-page-location-rules-v1",
      observerVersion: "document-signal-observer-v1",
      observationRuleSetVersion: "document-signal-observation-rules-v1",
      catalogVersion: "budget-document-signal-catalog-v1",
    },
  ],
} as const satisfies {
  readonly physicalRead: ReadonlyArray<SupportedPhysicalReadSourceContract>;
  readonly pageLocation: ReadonlyArray<SupportedPageLocationSourceContract>;
};

export function findCompatiblePhysicalReadContract(
  source: PhysicalDocumentReadResult,
): SupportedPhysicalReadSourceContract | null {
  return (
    SUPPORTED_STRUCTURE_RECONSTRUCTION_SOURCE_CONTRACTS.physicalRead.find(
      (contract) =>
        source.schemaVersion === contract.schemaVersion &&
        source.readerName === contract.readerName &&
        source.readerVersion === contract.readerVersion &&
        source.textItemCoordinateSpaceVersion === contract.coordinateSpaceVersion &&
        source.textItemGeometryProfileVersion === contract.geometryProfileVersion &&
        source.geometryContextFingerprintVersion === contract.geometryContextFingerprintVersion,
    ) ?? null
  );
}

export function findCompatiblePageLocationContract(
  source: BudgetDocumentPageLocationResult,
): SupportedPageLocationSourceContract | null {
  return (
    SUPPORTED_STRUCTURE_RECONSTRUCTION_SOURCE_CONTRACTS.pageLocation.find(
      (contract) =>
        source.schemaVersion === contract.schemaVersion &&
        source.locatorName === contract.locatorName &&
        source.locatorVersion === contract.locatorVersion &&
        source.decisionRuleSetVersion === contract.decisionRuleSetVersion &&
        source.sourceObserverVersion === contract.observerVersion &&
        source.sourceObservationRuleSetVersion === contract.observationRuleSetVersion &&
        source.sourceCatalogVersion === contract.catalogVersion,
    ) ?? null
  );
}
