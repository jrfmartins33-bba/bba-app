import type { BudgetDocumentTabularRegionDetectionProfile } from "./budget-document-tabular-region-detection.types";
import { TABULAR_REGION_DETECTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION } from "./tabular-region-detection-output-geometry-canonicalization";

/**
 * Perfil de detecção versionado e único (Sprint 21.4A.2.f.2a). Todas as
 * constantes usadas pela observação de alinhamentos e pela formação de
 * regiões vivem aqui — nenhum número mágico é permitido nos módulos de
 * detecção. Nenhum valor foi calibrado por documento real (nenhum
 * documento real foi acessado por esta Sprint); todos são decisões
 * conservadoras de engenharia, cada uma justificada abaixo e testada
 * explicitamente nos seus limiares exatos, e passíveis de revisão em
 * Sprint futura com corpus real — nunca nesta.
 *
 * `minimumRegionLineCount` (3), `minimumRecurrentAlignmentCount` (2) e
 * `minimumLinesSustainingAlignment` (3): valores mínimos aprovados
 * explicitamente no enunciado da Sprint (§9) — não derivados nem
 * calibrados por esta implementação.
 *
 * `maximumAlignmentPositionDeviationToMinimumLineHeightRatio` (0.5):
 * reaproveita deliberadamente a mesma classe de razão, com a mesma
 * normalização pela **menor** altura do par (nunca a mediana), já aprovada
 * e testada no limiar exato pela Sprint anterior
 * (`maximumPairCenterDistanceToMinimumHeightRatio` de
 * `structure-reconstruction-profile.ts`) — "distância de posição
 * normalizada pela menor altura do par" é exatamente a mesma medida
 * física; apenas o eixo comparado muda (posição horizontal de borda/centro
 * de segmento, em vez de centro vertical de item). Reutilizar o mesmo
 * valor e a mesma normalização, já validados, evita introduzir uma segunda
 * escala arbitrária não calibrada. Testado abaixo, exatamente no limite e
 * acima (`vertical-alignment-observation.test.ts`).
 *
 * Nenhuma "lacuna vertical máxima" foi introduzida: a contiguidade de uma
 * região é definida por `verticalOrder` consecutivo entre as linhas de uma
 * mesma página — uma propriedade estrutural já produzida e testada pela
 * Sprint anterior — nunca por uma tolerância física adicional não
 * aprovada (§10, "lacuna vertical máxima" permanece explicitamente fora
 * desta Sprint).
 *
 * `alignmentTypePriorityOrder`: ordem fixa `["left_edge", "right_edge",
 * "horizontal_center"]`, usada apenas para desempate determinístico (nunca
 * para atribuir significado) — segue a mesma convenção de leitura
 * esquerda-para-direita já usada em `chooseBestCandidate` (bloco físico) e
 * `sortEligibleItemsCanonically` (linha física) da Sprint anterior.
 */
export const BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1: BudgetDocumentTabularRegionDetectionProfile = {
  profileId: "budget-document-tabular-region-detection-profile-v1",
  profileVersion: 1,

  minimumRegionLineCount: 3,
  minimumRecurrentAlignmentCount: 2,
  minimumLinesSustainingAlignment: 3,

  requireFullPairwiseAlignmentCompatibility: true,
  forbidRegionOverlap: true,

  maximumAlignmentPositionDeviationToMinimumLineHeightRatio: 0.5,

  alignmentTypePriorityOrder: ["left_edge", "right_edge", "horizontal_center"],

  geometryCanonicalizationVersion: TABULAR_REGION_DETECTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION,
};
