import type { BudgetDocumentStructureReconstructionResult } from "../structure-reconstruction/budget-document-structure-reconstruction.types";

/**
 * Portão de compatibilidade exata (Sprint 21.4A.2.f.2a). Aprova apenas o
 * contrato de origem literalmente listado aqui — nunca comparação lexical
 * de versões, nunca aceitação de versão desconhecida, nunca melhor esforço
 * com um contrato futuro. Os valores abaixo foram lidos diretamente de
 * `structure-reconstruction/budget-document-structure-reconstruction.types.ts`,
 * `structure-reconstruction-profile.ts` e
 * `structure-reconstruction-output-geometry-canonicalization.ts` — nunca
 * adivinhados.
 *
 * `geometryCanonicalizationVersion` participa do portão porque não é
 * exposto individualmente em `BudgetDocumentStructureReconstructionResult`
 * (apenas via `reconstructionProfileId`/`reconstructionProfileVersion`) — o
 * valor pinado aqui é o único que o perfil suportado (`...-profile-v1`)
 * pode produzir, permitindo recompor a entrada exata do fingerprint da
 * reconstrução para validação (`tabular-region-detection-input-validation.ts`)
 * sem duplicar a lógica de canonicalização em si.
 */

export interface SupportedStructureReconstructionSourceContract {
  readonly schemaVersion: number;
  readonly reconstructorName: string;
  readonly reconstructorVersion: string;
  readonly reconstructionProfileId: string;
  readonly reconstructionProfileVersion: number;
  readonly reconstructionContextFingerprintVersion: string;
  readonly geometryCanonicalizationVersion: string;
}

export const SUPPORTED_TABULAR_REGION_DETECTION_SOURCE_CONTRACTS = {
  structureReconstruction: [
    {
      schemaVersion: 1,
      reconstructorName: "budget-document-structure-reconstructor",
      reconstructorVersion: "budget-document-structure-reconstructor-v1",
      reconstructionProfileId: "budget-document-structure-reconstruction-profile-v1",
      reconstructionProfileVersion: 1,
      reconstructionContextFingerprintVersion: "budget-document-structure-reconstruction-context-fingerprint-v1",
      geometryCanonicalizationVersion: "structure-reconstruction-output-geometry-canonicalization-v1",
    },
  ],
} as const satisfies {
  readonly structureReconstruction: ReadonlyArray<SupportedStructureReconstructionSourceContract>;
};

export function findCompatibleStructureReconstructionContract(
  source: BudgetDocumentStructureReconstructionResult,
): SupportedStructureReconstructionSourceContract | null {
  return (
    SUPPORTED_TABULAR_REGION_DETECTION_SOURCE_CONTRACTS.structureReconstruction.find(
      (contract) =>
        source.schemaVersion === contract.schemaVersion &&
        source.reconstructorName === contract.reconstructorName &&
        source.reconstructorVersion === contract.reconstructorVersion &&
        source.reconstructionProfileId === contract.reconstructionProfileId &&
        source.reconstructionProfileVersion === contract.reconstructionProfileVersion &&
        source.reconstructionContextFingerprintVersion === contract.reconstructionContextFingerprintVersion,
    ) ?? null
  );
}
