import type { BudgetDocumentPageLocationResult } from "../page-location/budget-page-location.types";
import type { PhysicalDocumentReadResult } from "../physical-document-read.types";

/**
 * Portão de compatibilidade exata (Sprint 21.4A.2.f.1, §15; endurecido na
 * auditoria do PR #69). Aprova apenas os contratos de origem literalmente
 * listados aqui — nunca comparação lexical de versões, nunca aceitação de
 * versão desconhecida, nunca melhor esforço com um contrato futuro. Os
 * valores abaixo foram lidos diretamente dos contratos reais
 * (`physical-document-read.types.ts`, `budget-page-location.types.ts`,
 * `signal-observation.types.ts`, `page-location-decision-rule-registry.ts`,
 * `pdfjs-physical-document-reader.ts`) — nunca adivinhados.
 *
 * `adapterVersion` e `underlyingLibraryVersion` participam do portão por
 * igualdade exata, não apenas do fingerprint geométrico: um resultado
 * produzido por outro adaptador ou outra versão da biblioteca concreta
 * pode, em tese, recalcular seu próprio fingerprint corretamente e ainda
 * assim não ser o contrato técnico que este reconstrutor foi construído e
 * testado contra — por isso a igualdade exata destes dois campos é uma
 * checagem própria, independente do fingerprint (auditoria pós-PR #69).
 */

export interface SupportedPhysicalReadSourceContract {
  readonly schemaVersion: number;
  readonly readerName: string;
  readonly readerVersion: string;
  readonly adapterVersion: string;
  readonly underlyingLibraryVersion: string;
  readonly coordinateSpaceVersion: string;
  readonly geometryProfileVersion: string;
  readonly geometryContextFingerprintVersion: string;
}

export interface SupportedPageLocationSourceContract {
  readonly schemaVersion: number;
  readonly locatorName: string;
  readonly locatorVersion: string;
  readonly decisionRuleSetVersion: string;
  readonly sourceObservationSchemaVersion: number;
  readonly observerName: string;
  readonly observerVersion: string;
  readonly observationRuleSetVersion: string;
  readonly catalogVersion: string;
}

/**
 * As duas únicas identidades do adaptador/biblioteca concreta hoje
 * suportadas, isoladas em constantes nomeadas e exportadas — o único lugar
 * do domínio `budget-document-location` autorizado a citar o nome da
 * biblioteca concreta como valor literal (guard: exceção nomeada e
 * documentada em `architecture/budget-document-location-boundaries.test.ts`).
 * Qualquer outro consumidor de teste (ex.: a ponte geométrica local) deve
 * importar estas constantes em vez de redeclarar o literal.
 */
export const SUPPORTED_PHYSICAL_ADAPTER_VERSION = "pdfjs-physical-document-reader-adapter-v2" as const;
export const SUPPORTED_PHYSICAL_UNDERLYING_LIBRARY_VERSION = "pdfjs-dist@6.1.200" as const;

export const SUPPORTED_STRUCTURE_RECONSTRUCTION_SOURCE_CONTRACTS = {
  physicalRead: [
    {
      schemaVersion: 2,
      readerName: "physical-document-reader",
      readerVersion: "physical-document-reader-v2",
      adapterVersion: SUPPORTED_PHYSICAL_ADAPTER_VERSION,
      underlyingLibraryVersion: SUPPORTED_PHYSICAL_UNDERLYING_LIBRARY_VERSION,
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
      sourceObservationSchemaVersion: 1,
      observerName: "document-signal-observer",
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
        source.adapterVersion === contract.adapterVersion &&
        source.underlyingLibraryVersion === contract.underlyingLibraryVersion &&
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
        source.sourceObservationSchemaVersion === contract.sourceObservationSchemaVersion &&
        source.sourceObserverName === contract.observerName &&
        source.sourceObserverVersion === contract.observerVersion &&
        source.sourceObservationRuleSetVersion === contract.observationRuleSetVersion &&
        source.sourceCatalogVersion === contract.catalogVersion,
    ) ?? null
  );
}
