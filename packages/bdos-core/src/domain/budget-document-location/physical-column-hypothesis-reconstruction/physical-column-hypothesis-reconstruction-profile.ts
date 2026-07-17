import type { BudgetDocumentPhysicalColumnHypothesisReconstructionProfile } from "./budget-document-physical-column-hypothesis-reconstruction.types";
import { PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION } from "./physical-column-hypothesis-reconstruction-output-geometry-canonicalization";

/**
 * Perfil de reconstrução versionado e único (Sprint 21.4A.2.f.2b). Ao
 * contrário das duas Sprints anteriores, este perfil não declara nenhuma
 * razão numérica de tolerância — decisão vinculante aprovada
 * explicitamente: consolidação de faixas em hipótese exige assinatura
 * física (`(lineKey, segmentKey)` ordenados) exatamente idêntica; conflito
 * exige segmento compartilhado ou sobreposição horizontal estritamente
 * positiva entre envelopes de assinaturas diferentes. Nenhuma proximidade,
 * nenhum envelope "semelhante", nenhum tipo de alinhamento preferencial.
 * Apenas identidades e invariantes fixas (tipadas como literais `true`,
 * mesmo padrão de `requireFullPairwiseAlignmentCompatibility`/
 * `forbidRegionOverlap` da Sprint 21.4A.2.f.2a).
 */
export const BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_PROFILE_V1: BudgetDocumentPhysicalColumnHypothesisReconstructionProfile = {
  profileId: "budget-document-physical-column-hypothesis-reconstruction-profile-v1",
  profileVersion: 1,

  requireExactSignatureEquality: true,
  forbidPhysicalColumnHypothesisOverlap: true,

  alignmentTypePriorityOrder: ["left_edge", "right_edge", "horizontal_center"],

  geometryCanonicalizationVersion: PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION,
};
