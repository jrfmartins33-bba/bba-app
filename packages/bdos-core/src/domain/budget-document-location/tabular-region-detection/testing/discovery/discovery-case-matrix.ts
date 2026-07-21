import type { SyntheticGeometryPage } from "../tabular-region-detection-test-bridge";
import * as fixtures from "./discovery-case-fixtures";

/**
 * Matriz pré-registrada da Sprint 21.4B.3A (§10 do enunciado). Dados e
 * rótulos esperados apenas — nenhum algoritmo candidato, nenhum resultado
 * de experimento. Congelada no commit de pré-registro; qualquer alteração
 * posterior exige novo commit que explique a necessidade e invalide
 * execuções anteriores sob o critério antigo.
 *
 * CORREÇÃO (commit `docs(architecture): correct tabular discovery
 * evidence claims`): a matriz abaixo tem 20 ENTRADAS classificadas
 * (P1-P10, N1-N10), mas apenas 19 GEOMETRIAS DISTINTAS — N6 e N10
 * reaproveitam deliberadamente a mesma função construtora (`buildPage`)
 * e a mesma linha-alvo (`caseN6N10_wideElementBetweenIndependentRegions`
 * / `N6_TARGET_LABEL`), documentado explicitamente na atribuição de N10
 * ("papel duplo") desde o pré-registro original. Qualquer contagem de
 * "casos passados/reprovados" deve declarar se está contando entradas
 * classificadas (20) ou geometrias distintas (19) — os testes desta
 * Sprint contam ENTRADAS (20), nunca geometrias, o que é consistente mas
 * deve ser lido com essa ressalva.
 */

export type DiscoveryExpectedLabel = "must_include" | "must_exclude";
export type DiscoveryCaseCategory = "positive" | "negative";

export interface DiscoveryCase {
  readonly id: string;
  readonly descriptionPt: string;
  readonly category: DiscoveryCaseCategory;
  readonly adversarial: boolean;
  readonly expectedLabel: DiscoveryExpectedLabel;
  readonly attributionPt: string;
  readonly buildPage: () => SyntheticGeometryPage;
  /** Texto exato do item de origem da linha física sob teste (nunca conteúdo econômico real). */
  readonly targetLineSourceText: string;
}

export const DISCOVERY_CASE_MATRIX: ReadonlyArray<DiscoveryCase> = [
  {
    id: "P1",
    descriptionPt: "Região densa convencional (controle).",
    category: "positive",
    adversarial: false,
    expectedLabel: "must_include",
    attributionPt: "Reconstrução do Caso A, commit 0e7fc0883f73b4f9fb868173d773e434b5362606 (Sprint 21.4B.1).",
    buildPage: fixtures.caseP1_denseControlRegion,
    targetLineSourceText: "p1row3-descricao",
  },
  {
    id: "P2",
    descriptionPt: "Uma continuação esparsa legítima.",
    category: "positive",
    adversarial: false,
    expectedLabel: "must_include",
    attributionPt: "Reconstrução do Caso L1, commit 13257242e38273c3a816db2619f847112c466794 (Sprint 21.4B.2).",
    buildPage: fixtures.caseP2_singleTightContinuation,
    targetLineSourceText: fixtures.P2_TARGET_LABEL,
  },
  {
    id: "P3",
    descriptionPt: "Duas continuações esparsas consecutivas.",
    category: "positive",
    adversarial: false,
    expectedLabel: "must_include",
    attributionPt: "Reconstrução do Caso L2, commit 13257242e38273c3a816db2619f847112c466794 (Sprint 21.4B.2).",
    buildPage: fixtures.caseP3_twoConsecutiveTightContinuations,
    targetLineSourceText: fixtures.P3_TARGET_LABEL,
  },
  {
    id: "P4",
    descriptionPt: "Três continuações esparsas consecutivas.",
    category: "positive",
    adversarial: false,
    expectedLabel: "must_include",
    attributionPt: "Reconstrução do Caso L3, commit 13257242e38273c3a816db2619f847112c466794 (Sprint 21.4B.2).",
    buildPage: fixtures.caseP4_threeConsecutiveTightContinuations,
    targetLineSourceText: fixtures.P4_TARGET_LABEL,
  },
  {
    id: "P5",
    descriptionPt: "Linha legítima de grupo/subgrupo, poucas colunas.",
    category: "positive",
    adversarial: false,
    expectedLabel: "must_include",
    attributionPt: "Proxy estrutural do Caso K (commit 0e7fc0883f73b4f9fb868173d773e434b5362606, Sprint 21.4B.1) — nenhuma capacidade distingue fisicamente 'grupo' de 'cabeçalho interno' hoje; mesmo padrão físico (ITEM+DESCRICAO, largura cheia, espaçamento normal).",
    buildPage: fixtures.caseP5_groupOrSubgroupLine,
    targetLineSourceText: fixtures.P5_TARGET_LABEL,
  },
  {
    id: "P6",
    descriptionPt: "Cabeçalho interno pertencente à tabela.",
    category: "positive",
    adversarial: false,
    expectedLabel: "must_include",
    attributionPt: "Reconstrução do Caso K, commit 0e7fc0883f73b4f9fb868173d773e434b5362606 (Sprint 21.4B.1).",
    buildPage: fixtures.caseP6_sparseInternalHeader,
    targetLineSourceText: fixtures.P6_TARGET_LABEL,
  },
  {
    id: "P7",
    descriptionPt: "Linha de subtotal/total com subconjunto de colunas.",
    category: "positive",
    adversarial: false,
    expectedLabel: "must_include",
    attributionPt: "Novo nesta Sprint — sem precedente em 21.4B.1/21.4B.2.",
    buildPage: fixtures.caseP7_subtotalRow,
    targetLineSourceText: fixtures.P7_TARGET_LABEL,
  },
  {
    id: "P8",
    descriptionPt: "Duas linhas tabulares completas muito próximas.",
    category: "positive",
    adversarial: false,
    expectedLabel: "must_include",
    attributionPt: "Reconstrução do Caso L10, commit 13257242e38273c3a816db2619f847112c466794 (Sprint 21.4B.2).",
    buildPage: fixtures.caseP8_twoLegitimateTabularRowsVeryClose,
    targetLineSourceText: fixtures.P8_TARGET_LABEL,
  },
  {
    id: "P9",
    descriptionPt: "Linha esparsa no início de uma região tabular, sustentada por evidência suficiente.",
    category: "positive",
    adversarial: false,
    expectedLabel: "must_include",
    attributionPt: "Contraparte positiva do Caso L11 (commit 13257242e38273c3a816db2619f847112c466794, Sprint 21.4B.2, onde a mesma topologia é negativa por FALTA de sustentação) — novo nesta Sprint: aqui a linha esparsa é sustentada por 3 linhas âncora completas imediatamente após.",
    buildPage: fixtures.caseP9_sparseLineAtRegionStartSupported,
    targetLineSourceText: fixtures.P9_TARGET_LABEL,
  },
  {
    id: "P10",
    descriptionPt: "Linha esparsa no fim de uma região tabular, sustentada por evidência suficiente.",
    category: "positive",
    adversarial: false,
    expectedLabel: "must_include",
    attributionPt: "Contraparte positiva do Caso L12 (commit 13257242e38273c3a816db2619f847112c466794, Sprint 21.4B.2) — novo nesta Sprint, mesma observação de P9.",
    buildPage: fixtures.caseP10_sparseLineAtRegionEndSupported,
    targetLineSourceText: fixtures.P10_TARGET_LABEL,
  },
  {
    id: "N1",
    descriptionPt: "Parágrafo externo com espaçamento normal.",
    category: "negative",
    adversarial: false,
    expectedLabel: "must_exclude",
    attributionPt: "Reconstrução do Caso L6, commit 13257242e38273c3a816db2619f847112c466794 (Sprint 21.4B.2).",
    buildPage: fixtures.caseN1_externalParagraphNormalSpacing,
    targetLineSourceText: fixtures.N1_TARGET_LABEL,
  },
  {
    id: "N2",
    descriptionPt: "Parágrafo externo com espaçamento apertado (ADVERSARIAL OBRIGATÓRIO — mesma assinatura de alinhamento de uma continuação legítima).",
    category: "negative",
    adversarial: true,
    expectedLabel: "must_exclude",
    attributionPt: "Reconstrução do Caso L7, commit 13257242e38273c3a816db2619f847112c466794 (Sprint 21.4B.2).",
    buildPage: fixtures.caseN2_externalParagraphTightSpacingAdversarial,
    targetLineSourceText: fixtures.N2_TARGET_LABEL,
  },
  {
    id: "N3",
    descriptionPt: "Título externo apertado.",
    category: "negative",
    adversarial: false,
    expectedLabel: "must_exclude",
    attributionPt: "Reconstrução do Caso L8, commit 13257242e38273c3a816db2619f847112c466794 (Sprint 21.4B.2).",
    buildPage: fixtures.caseN3_externalTitleTightSpacing,
    targetLineSourceText: fixtures.N3_TARGET_LABEL,
  },
  {
    id: "N4",
    descriptionPt: "Nota lateral apertada, fora do envelope horizontal.",
    category: "negative",
    adversarial: false,
    expectedLabel: "must_exclude",
    attributionPt: "Reconstrução do Caso L9, commit 13257242e38273c3a816db2619f847112c466794 (Sprint 21.4B.2).",
    buildPage: fixtures.caseN4_lateralNoteTightSpacing,
    targetLineSourceText: fixtures.N4_TARGET_LABEL,
  },
  {
    id: "N5",
    descriptionPt: "Rodapé/observação externa após o fim da tabela.",
    category: "negative",
    adversarial: false,
    expectedLabel: "must_exclude",
    attributionPt: "Reconstrução do Caso L12 original, commit 13257242e38273c3a816db2619f847112c466794 (Sprint 21.4B.2).",
    buildPage: fixtures.caseN5_footerAfterTableEnd,
    targetLineSourceText: fixtures.N5_TARGET_LABEL,
  },
  {
    id: "N6",
    descriptionPt: "Linha separadora entre duas tabelas.",
    category: "negative",
    adversarial: false,
    expectedLabel: "must_exclude",
    attributionPt: "Reconstrução do Caso H, commit 0e7fc0883f73b4f9fb868173d773e434b5362606 (Sprint 21.4B.1).",
    buildPage: fixtures.caseN6N10_wideElementBetweenIndependentRegions,
    targetLineSourceText: fixtures.N6_TARGET_LABEL,
  },
  {
    id: "N7",
    descriptionPt: "Conteúdo externo dentro do envelope horizontal geral da tabela (mas não alinhado a nenhuma coluna individual).",
    category: "negative",
    adversarial: false,
    expectedLabel: "must_exclude",
    attributionPt: "Novo nesta Sprint — sem precedente em 21.4B.1/21.4B.2.",
    buildPage: fixtures.caseN7_wideElementWithinOverallEnvelope,
    targetLineSourceText: fixtures.N7_TARGET_LABEL,
  },
  {
    id: "N8",
    descriptionPt: "Conteúdo externo coincidindo com borda de coluna (ADVERSARIAL — mesma assinatura de alinhamento de uma linha esparsa legítima).",
    category: "negative",
    adversarial: true,
    expectedLabel: "must_exclude",
    attributionPt: "Reconstrução do Caso J, commit 0e7fc0883f73b4f9fb868173d773e434b5362606 (Sprint 21.4B.1).",
    buildPage: fixtures.caseN8_externalContentCoincidingWithColumnBorder,
    targetLineSourceText: fixtures.N8_TARGET_LABEL,
  },
  {
    id: "N9",
    descriptionPt: "Múltiplas linhas externas repetidas, formando alinhamento privado próprio (ADVERSARIAL — mesma topologia de alinhamento do Caso L3/P4, positivo).",
    category: "negative",
    adversarial: true,
    expectedLabel: "must_exclude",
    attributionPt: "Observação do Caso L3 (commit 13257242e38273c3a816db2619f847112c466794, Sprint 21.4B.2) reaproveitada como negativo deliberado — novo nesta Sprint.",
    buildPage: fixtures.caseN9_repeatedExternalLinesPrivateAlignment,
    targetLineSourceText: fixtures.N9_TARGET_LABEL,
  },
  {
    id: "N10",
    descriptionPt: "Elemento largo entre duas regiões independentes.",
    category: "negative",
    adversarial: false,
    expectedLabel: "must_exclude",
    attributionPt: "Reconstrução do Caso H, commit 0e7fc0883f73b4f9fb868173d773e434b5362606 (Sprint 21.4B.1) — mesma fixture de N6, papel duplo documentado no pré-registro.",
    buildPage: fixtures.caseN6N10_wideElementBetweenIndependentRegions,
    targetLineSourceText: fixtures.N6_TARGET_LABEL,
  },
];

/** Casos F/J e L1/L4/L7 usados especificamente na prova de indistinguibilidade (§5 do pré-registro) — subconjunto nomeado da matriz acima, mais o Caso F original preservado à parte (não duplicado em P1-P10/N1-N10 porque sua identidade exata importa para a prova). */
export const INDISTINGUISHABILITY_PAIRS: ReadonlyArray<{
  readonly pairId: string;
  readonly positive: { readonly buildPage: () => SyntheticGeometryPage; readonly targetLineSourceText: string };
  readonly negative: { readonly buildPage: () => SyntheticGeometryPage; readonly targetLineSourceText: string };
}> = [
  {
    pairId: "F-vs-J",
    positive: { buildPage: fixtures.caseF_denseTableWithLegitimateSparseRow, targetLineSourceText: fixtures.F_TARGET_LABEL },
    negative: { buildPage: fixtures.caseN8_externalContentCoincidingWithColumnBorder, targetLineSourceText: fixtures.N8_TARGET_LABEL },
  },
  {
    pairId: "L1-vs-L7",
    positive: { buildPage: fixtures.caseP2_singleTightContinuation, targetLineSourceText: fixtures.P2_TARGET_LABEL },
    negative: { buildPage: fixtures.caseN2_externalParagraphTightSpacingAdversarial, targetLineSourceText: fixtures.N2_TARGET_LABEL },
  },
];
