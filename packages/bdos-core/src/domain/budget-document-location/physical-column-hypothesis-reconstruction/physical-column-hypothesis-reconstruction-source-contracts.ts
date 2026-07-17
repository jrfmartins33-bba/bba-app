import type { BudgetDocumentTabularRegionDetectionResult } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import { findCompatibleStructureReconstructionContract } from "../tabular-region-detection/tabular-region-detection-source-contracts";

/**
 * Portões de compatibilidade exata (Sprint 21.4A.2.f.2b). Aprovam apenas os
 * contratos de origem literalmente listados aqui — nunca comparação
 * lexical de versões, nunca aceitação de versão desconhecida.
 *
 * O portão de `structureReconstruction` é reaproveitado diretamente da
 * Sprint 21.4A.2.f.2a (`findCompatibleStructureReconstructionContract`,
 * importado por caminho relativo direto, nunca pelo barrel) — nunca
 * duplicado. A f.2b não redeclara as identidades físicas/de localização
 * que a f.2a já pina; apenas reutiliza a mesma função de portão.
 *
 * O portão de `tabularRegionDetection` é novo desta Sprint — os valores
 * abaixo foram lidos diretamente de
 * `tabular-region-detection/budget-document-tabular-region-detection.types.ts`,
 * nunca adivinhados.
 */

export { findCompatibleStructureReconstructionContract };

export interface SupportedTabularRegionDetectionSourceContract {
  readonly schemaVersion: number;
  readonly detectorName: string;
  readonly detectorVersion: string;
  readonly detectionProfileId: string;
  readonly detectionProfileVersion: number;
  readonly detectionContextFingerprintVersion: string;
}

export const SUPPORTED_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_SOURCE_CONTRACTS = {
  tabularRegionDetection: [
    {
      schemaVersion: 1,
      detectorName: "budget-document-tabular-region-detector",
      detectorVersion: "budget-document-tabular-region-detector-v1",
      detectionProfileId: "budget-document-tabular-region-detection-profile-v1",
      detectionProfileVersion: 1,
      detectionContextFingerprintVersion: "budget-document-tabular-region-detection-context-fingerprint-v1",
    },
  ],
} as const satisfies {
  readonly tabularRegionDetection: ReadonlyArray<SupportedTabularRegionDetectionSourceContract>;
};

export function findCompatibleTabularRegionDetectionContract(
  source: BudgetDocumentTabularRegionDetectionResult,
): SupportedTabularRegionDetectionSourceContract | null {
  return (
    SUPPORTED_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_SOURCE_CONTRACTS.tabularRegionDetection.find(
      (contract) =>
        source.schemaVersion === contract.schemaVersion &&
        source.detectorName === contract.detectorName &&
        source.detectorVersion === contract.detectorVersion &&
        source.detectionProfileId === contract.detectionProfileId &&
        source.detectionProfileVersion === contract.detectionProfileVersion &&
        source.detectionContextFingerprintVersion === contract.detectionContextFingerprintVersion,
    ) ?? null
  );
}
