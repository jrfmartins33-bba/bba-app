import type { BudgetDocumentPhysicalColumnHypothesisReconstructionProfile } from "./budget-document-physical-column-hypothesis-reconstruction.types";
import { PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION } from "./physical-column-hypothesis-reconstruction-output-geometry-canonicalization";
import { BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1 } from "../tabular-region-detection/tabular-region-detection-profile";

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
 *
 * `minimumLinesSustainingProjectedAlignment` (auditoria pós-revisão, §1):
 * nunca um valor novo — lido em tempo de execução de
 * `BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1.minimumLinesSustainingAlignment`
 * (perfil v1 da Sprint 21.4A.2.f.2a, importado por caminho relativo
 * direto, nunca pelo barrel — mesmo padrão já usado para
 * `findCompatibleStructureReconstructionContract`). `RecurrentVerticalAlignment`
 * é observado no nível da página inteira; ao projetar um alinhamento para
 * dentro de uma região (mantendo apenas os pares cuja linha pertence à
 * região), a sustentação pode cair abaixo do mínimo já exigido pela f.2a
 * para o alinhamento como um todo. Este campo garante que a projeção
 * nunca transforme um alinhamento recorrente em evidência de menos linhas
 * do que a f.2a já exige — nunca uma nova tolerância calibrada.
 */
export const BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_PROFILE_V1: BudgetDocumentPhysicalColumnHypothesisReconstructionProfile = {
  profileId: "budget-document-physical-column-hypothesis-reconstruction-profile-v1",
  profileVersion: 1,

  requireExactSignatureEquality: true,
  forbidPhysicalColumnHypothesisOverlap: true,

  minimumLinesSustainingProjectedAlignment: BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1.minimumLinesSustainingAlignment,

  alignmentTypePriorityOrder: ["left_edge", "right_edge", "horizontal_center"],

  geometryCanonicalizationVersion: PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION,
};
