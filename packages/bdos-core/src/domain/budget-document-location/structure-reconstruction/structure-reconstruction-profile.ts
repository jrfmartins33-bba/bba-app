import type { BudgetDocumentStructureReconstructionProfile } from "./budget-document-structure-reconstruction.types";
import { STRUCTURE_RECONSTRUCTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION } from "./structure-reconstruction-output-geometry-canonicalization";

/**
 * Perfil de reconstrução versionado e único (Sprint 21.4A.2.f.1). Todas as
 * constantes geométricas usadas por linhas, segmentos e blocos vivem aqui —
 * nenhum número mágico é permitido nos módulos de reconstrução. Nenhum valor
 * foi calibrado por documento real (nenhum documento real foi acessado por
 * esta Sprint); são valores de engenharia geométrica genéricos, cada um
 * testado explicitamente nos seus limiares exatos, e passíveis de revisão em
 * Sprint futura com corpus real — nunca nesta.
 */
export const BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1: BudgetDocumentStructureReconstructionProfile = {
  profileId: "budget-document-structure-reconstruction-profile-v1",
  profileVersion: 1,

  minimumPairVerticalOverlapRatio: 0.5,
  maximumPairCenterDistanceToMinimumHeightRatio: 0.5,

  maximumSegmentGapToMedianItemHeightRatio: 2.0,

  maximumBlockVerticalGapToMedianLineHeightRatio: 1.5,
  minimumBlockHorizontalOverlapRatio: 0.3,
  maximumBlockHorizontalGapToMedianSegmentHeightRatio: 3.0,

  requireCompleteLineCompatibility: true,
  requireMutualBlockAdjacency: true,

  geometryCanonicalizationVersion: STRUCTURE_RECONSTRUCTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION,
};
