import type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "../tabular-region-detection-test-bridge";

/**
 * Fixtures exclusivamente diagnósticas da Sprint 21.4B.3A (Descoberta
 * Arquitetural da Invariante Segura de Pertencimento à Grade Tabular).
 * Geometria sintética, genérica — nunca o caso real Lagoa do Arroz. Nunca
 * importada por código de produção; nunca usada fora de
 * `tabular-region-detection/testing/discovery/`.
 *
 * Vários casos abaixo são reconstruções deliberadas (não cópias literais)
 * de fixtures descritas em Sprints diagnósticas anteriores, preservadas
 * apenas em branches não mescladas a `main` (confirmado nesta Sprint: os
 * commits citados não são ancestrais de `HEAD`). Cada função documenta
 * explicitamente sua origem:
 *
 * - Casos A, H, J, K: reconstruídos a partir da descrição/parâmetros de
 *   `dense-table-region-diagnosis-fixtures.ts`, commit
 *   `0e7fc0883f73b4f9fb868173d773e434b5362606` (Sprint 21.4B.1).
 * - Casos L1, L2, L3, L4, L6, L7, L8, L9, L10, L11, L12: reconstruídos a
 *   partir de `multiline-cell-continuity-fixtures.ts`, commit
 *   `13257242e38273c3a816db2619f847112c466794` (Sprint 21.4B.2).
 * - Casos identificados como "novo" abaixo (P7, P9, P10, N7, N9) não têm
 *   precedente em nenhuma Sprint anterior — construídos nesta Sprint para
 *   preencher a matriz obrigatória do enunciado (§10).
 */

export const ROW_HEIGHT = 12;
/** Espaçamento vertical normal entre linhas de dados distintas (mesma convenção da 21.4B.1/21.4B.2). */
export const GAP_RATIO_NORMAL = 13 / ROW_HEIGHT;
/** Intervalo quase nulo de uma continuação real de descrição (mesma convenção da 21.4B.2). */
export const GAP_RATIO_TIGHT = 1 / ROW_HEIGHT;

export const PAGE_WIDTH = 900;
export const PAGE_HEIGHT = 792;

export interface DiscoveryColumn {
  readonly name: string;
  readonly leftPoints: number;
  readonly rightPoints: number;
}

/** Dez colunas densas — idênticas em espírito a `DENSE_COLUMNS` da Sprint 21.4B.1 (commit `0e7fc088`), com a mesma folga horizontal entre colunas. */
export const COLUMNS: ReadonlyArray<DiscoveryColumn> = [
  { name: "ITEM", leftPoints: 40, rightPoints: 70 },
  { name: "FONTE", leftPoints: 100, rightPoints: 150 },
  { name: "TIPO", leftPoints: 180, rightPoints: 215 },
  { name: "DESCRICAO", leftPoints: 245, rightPoints: 430 },
  { name: "UNID", leftPoints: 460, rightPoints: 485 },
  { name: "QUANT", leftPoints: 515, rightPoints: 555 },
  { name: "CUSTO_UNIT_SBDI", leftPoints: 585, rightPoints: 635 },
  { name: "BDI", leftPoints: 665, rightPoints: 690 },
  { name: "UNIT_CBDI", leftPoints: 720, rightPoints: 765 },
  { name: "TOTAL_CBDI", leftPoints: 795, rightPoints: 845 },
];

const DESCRICAO_COLUMN = COLUMNS[3];
const ITEM_COLUMN = COLUMNS[0];

export type DiscoverySequenceLineKind = "full" | "description-only" | "wide-external" | "two-column-sparse";

export interface DiscoverySequenceLineSpec {
  readonly kind: DiscoverySequenceLineKind;
  readonly gapRatioBefore: number;
  /** Rótulo estável — usado pela matriz para identificar a linha-alvo de cada caso (nunca conteúdo econômico real). */
  readonly label: string;
  readonly leftPoints?: number;
  readonly rightPoints?: number;
  /** Somente para `two-column-sparse`: segunda coluna populada (além de DESCRICAO). */
  readonly secondColumn?: DiscoveryColumn;
}

function fullRowItems(top: number, label: string): SyntheticGeometryTextItem[] {
  return COLUMNS.map((column) => ({
    text: `${label}-${column.name.toLowerCase()}`,
    leftPoints: column.leftPoints,
    topPoints: top,
    rightPoints: column.rightPoints,
    bottomPoints: top + ROW_HEIGHT,
  }));
}

/**
 * Constrói uma sequência de linhas lendo topo a baixo (`verticalOrder`
 * crescente), cada uma posicionada a `gapRatioBefore * ROW_HEIGHT` pontos
 * abaixo do fim da anterior — nunca por subtração a partir de uma linha
 * "principal" (mesma convenção de `buildSequence`, Sprint 21.4B.2, commit
 * `13257242e38273c3a816db2619f847112c466794`).
 */
export function buildDiscoverySequence(specs: ReadonlyArray<DiscoverySequenceLineSpec>): SyntheticGeometryPage {
  const items: SyntheticGeometryTextItem[] = [];
  let cursorBottom = 40;
  specs.forEach((spec, index) => {
    const gapPoints = spec.gapRatioBefore * ROW_HEIGHT;
    const top = index === 0 ? cursorBottom : cursorBottom + gapPoints;
    const bottom = top + ROW_HEIGHT;
    if (spec.kind === "full") {
      items.push(...fullRowItems(top, spec.label));
    } else if (spec.kind === "description-only") {
      items.push({
        text: `${spec.label}-continuation`,
        leftPoints: spec.leftPoints ?? DESCRICAO_COLUMN.leftPoints,
        topPoints: top,
        rightPoints: spec.rightPoints ?? DESCRICAO_COLUMN.leftPoints + 95,
        bottomPoints: bottom,
      });
    } else if (spec.kind === "two-column-sparse") {
      const second = spec.secondColumn ?? ITEM_COLUMN;
      items.push({ text: `${spec.label}-item`, leftPoints: second.leftPoints, topPoints: top, rightPoints: second.rightPoints, bottomPoints: bottom });
      items.push({ text: `${spec.label}-descricao`, leftPoints: DESCRICAO_COLUMN.leftPoints, topPoints: top, rightPoints: DESCRICAO_COLUMN.rightPoints, bottomPoints: bottom });
    } else {
      items.push({
        text: spec.label,
        leftPoints: spec.leftPoints ?? 10,
        topPoints: top,
        rightPoints: spec.rightPoints ?? 890,
        bottomPoints: bottom,
      });
    }
    cursorBottom = bottom;
  });
  return { widthPoints: PAGE_WIDTH, heightPoints: PAGE_HEIGHT, items };
}

function anchorBlock(count: number, labelPrefix: string): DiscoverySequenceLineSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    kind: "full" as const,
    gapRatioBefore: i === 0 ? 0 : GAP_RATIO_NORMAL,
    label: `${labelPrefix}${i}`,
  }));
}

// --- P1: região densa convencional (controle) ------------------------------
// Reconstrução do Caso A, commit `0e7fc088` (Sprint 21.4B.1).
export function caseP1_denseControlRegion(): SyntheticGeometryPage {
  return buildDiscoverySequence(anchorBlock(6, "p1row"));
}

// --- P2/P3/P4: 1/2/3 continuações esparsas consecutivas --------------------
// Reconstrução dos Casos L1/L2/L3, commit `13257242e3` (Sprint 21.4B.2).
function continuationCase(continuationCount: number, labelPrefix: string): SyntheticGeometryPage {
  const before = anchorBlock(3, `${labelPrefix}before`);
  const continuations: DiscoverySequenceLineSpec[] = Array.from({ length: continuationCount }, (_, i) => ({
    kind: "description-only" as const,
    gapRatioBefore: GAP_RATIO_TIGHT,
    label: `${labelPrefix}cont${i}`,
  }));
  const after: DiscoverySequenceLineSpec[] = Array.from({ length: 3 }, (_, i) => ({
    kind: "full" as const,
    gapRatioBefore: GAP_RATIO_NORMAL,
    label: `${labelPrefix}after${i}`,
  }));
  return buildDiscoverySequence([...before, ...continuations, ...after]);
}

export function caseP2_singleTightContinuation(): SyntheticGeometryPage {
  return continuationCase(1, "p2");
}
export function caseP3_twoConsecutiveTightContinuations(): SyntheticGeometryPage {
  return continuationCase(2, "p3");
}
export function caseP4_threeConsecutiveTightContinuations(): SyntheticGeometryPage {
  return continuationCase(3, "p4");
}
/** Alvo (linha-teste) de P2/P3/P4: a primeira continuação inserida. */
export const P2_TARGET_LABEL = "p2cont0-continuation";
export const P3_TARGET_LABEL = "p3cont0-continuation";
export const P4_TARGET_LABEL = "p4cont0-continuation";

// --- P5/P6: linha de grupo/subgrupo e cabeçalho interno esparsos -----------
// Reconstrução do Caso K, commit `0e7fc088` (Sprint 21.4B.1): ITEM +
// DESCRICAO apenas, largura de coluna cheia, espaçamento normal.
export function caseP6_sparseInternalHeader(): SyntheticGeometryPage {
  const rows: DiscoverySequenceLineSpec[] = [];
  for (let i = 0; i < 6; i += 1) {
    if (i === 3) {
      rows.push({ kind: "two-column-sparse", gapRatioBefore: GAP_RATIO_NORMAL, label: "p6header", secondColumn: ITEM_COLUMN });
    } else {
      rows.push({ kind: "full", gapRatioBefore: i === 0 ? 0 : GAP_RATIO_NORMAL, label: `p6row${i}` });
    }
  }
  return buildDiscoverySequence(rows);
}
export const P6_TARGET_LABEL = "p6header-descricao";

/** P5 reaproveita a mesma geometria de P6 como proxy estrutural de linha de grupo/subgrupo (poucas colunas, mesmo padrão físico — nenhuma capacidade distingue "grupo" de "cabeçalho" fisicamente hoje). */
export function caseP5_groupOrSubgroupLine(): SyntheticGeometryPage {
  const rows: DiscoverySequenceLineSpec[] = [];
  for (let i = 0; i < 6; i += 1) {
    if (i === 3) {
      rows.push({ kind: "two-column-sparse", gapRatioBefore: GAP_RATIO_NORMAL, label: "p5group", secondColumn: ITEM_COLUMN });
    } else {
      rows.push({ kind: "full", gapRatioBefore: i === 0 ? 0 : GAP_RATIO_NORMAL, label: `p5row${i}` });
    }
  }
  return buildDiscoverySequence(rows);
}
export const P5_TARGET_LABEL = "p5group-descricao";

// --- P7: subtotal/total com subconjunto de colunas (novo) ------------------
// Novo nesta Sprint: linha com apenas DESCRICAO ("SUBTOTAL") e TOTAL_CBDI
// preenchidas, espaçamento normal, entre linhas completas.
export function caseP7_subtotalRow(): SyntheticGeometryPage {
  const rows: DiscoverySequenceLineSpec[] = [];
  for (let i = 0; i < 6; i += 1) {
    if (i === 3) {
      rows.push({ kind: "two-column-sparse", gapRatioBefore: GAP_RATIO_NORMAL, label: "p7subtotal", secondColumn: COLUMNS[9] });
    } else {
      rows.push({ kind: "full", gapRatioBefore: i === 0 ? 0 : GAP_RATIO_NORMAL, label: `p7row${i}` });
    }
  }
  return buildDiscoverySequence(rows);
}
export const P7_TARGET_LABEL = "p7subtotal-descricao";

// --- P8: duas linhas tabulares completas muito próximas --------------------
// Reconstrução do Caso L10, commit `13257242e3` (Sprint 21.4B.2).
export function caseP8_twoLegitimateTabularRowsVeryClose(): SyntheticGeometryPage {
  return buildDiscoverySequence([
    { kind: "full", gapRatioBefore: 0, label: "p8row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "p8row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_TIGHT, label: "p8row2close" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "p8row3" },
  ]);
}
export const P8_TARGET_LABEL = "p8row2close-descricao";

// --- P9/P10: linha esparsa sustentada no início/fim da região --------------
// Contrapartes POSITIVAS de L11/L12 (commit `13257242e3`, Sprint 21.4B.2 —
// lá, negativas por FALTA de sustentação: nenhum predecessor/sucessor
// tabular válido). Aqui, construídas com evidência suficiente: a linha
// esparsa é a PRIMEIRA/ÚLTIMA de um bloco cujas 3 linhas seguintes/
// anteriores são âncoras tabulares completas, satisfazendo
// `minimumRegionLineCount`/`minimumRecurrentAlignmentCount` a partir dela
// mesma — novo nesta Sprint (P9/P10 não têm precedente direto: L11/L12
// testam exatamente o oposto, ausência de sustentação).
export function caseP9_sparseLineAtRegionStartSupported(): SyntheticGeometryPage {
  return buildDiscoverySequence([
    { kind: "description-only", gapRatioBefore: 0, label: "p9sparsestart" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "p9row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "p9row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "p9row2" },
  ]);
}
export const P9_TARGET_LABEL = "p9sparsestart-continuation";

export function caseP10_sparseLineAtRegionEndSupported(): SyntheticGeometryPage {
  return buildDiscoverySequence([
    { kind: "full", gapRatioBefore: 0, label: "p10row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "p10row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "p10row2" },
    { kind: "description-only", gapRatioBefore: GAP_RATIO_NORMAL, label: "p10sparseend" },
  ]);
}
export const P10_TARGET_LABEL = "p10sparseend-continuation";

// --- N1/N2: parágrafo externo, espaçamento normal/apertado -----------------
// Reconstrução dos Casos L6/L7, commit `13257242e3` (Sprint 21.4B.2). N2 é
// o caso ADVERSARIAL OBRIGATÓRIO (Caso L7 original).
export function caseN1_externalParagraphNormalSpacing(): SyntheticGeometryPage {
  return buildDiscoverySequence([
    ...anchorBlock(3, "n1before"),
    { kind: "wide-external", gapRatioBefore: GAP_RATIO_NORMAL, label: "n1-paragrafo-normal", leftPoints: ITEM_COLUMN.leftPoints, rightPoints: 600 },
    ...anchorBlock(3, "n1after").map((s) => ({ ...s, gapRatioBefore: GAP_RATIO_NORMAL })),
  ]);
}
export const N1_TARGET_LABEL = "n1-paragrafo-normal";

export function caseN2_externalParagraphTightSpacingAdversarial(): SyntheticGeometryPage {
  return buildDiscoverySequence([
    ...anchorBlock(3, "n2before"),
    { kind: "wide-external", gapRatioBefore: GAP_RATIO_TIGHT, label: "n2-paragrafo-apertado", leftPoints: ITEM_COLUMN.leftPoints, rightPoints: 600 },
    ...anchorBlock(3, "n2after").map((s) => ({ ...s, gapRatioBefore: GAP_RATIO_NORMAL })),
  ]);
}
export const N2_TARGET_LABEL = "n2-paragrafo-apertado";

// --- N3: título externo apertado --------------------------------------------
// Reconstrução do Caso L8, commit `13257242e3`.
export function caseN3_externalTitleTightSpacing(): SyntheticGeometryPage {
  return buildDiscoverySequence([
    ...anchorBlock(3, "n3before"),
    { kind: "wide-external", gapRatioBefore: GAP_RATIO_TIGHT, label: "n3-titulo-apertado", leftPoints: 10, rightPoints: 890 },
    ...anchorBlock(3, "n3after").map((s) => ({ ...s, gapRatioBefore: GAP_RATIO_NORMAL })),
  ]);
}
export const N3_TARGET_LABEL = "n3-titulo-apertado";

// --- N4: nota lateral apertada, fora do envelope horizontal ----------------
// Reconstrução do Caso L9, commit `13257242e3`.
export function caseN4_lateralNoteTightSpacing(): SyntheticGeometryPage {
  return buildDiscoverySequence([
    ...anchorBlock(3, "n4before"),
    { kind: "wide-external", gapRatioBefore: GAP_RATIO_TIGHT, label: "n4-nota-apertada", leftPoints: 875, rightPoints: 898 },
    ...anchorBlock(3, "n4after").map((s) => ({ ...s, gapRatioBefore: GAP_RATIO_NORMAL })),
  ]);
}
export const N4_TARGET_LABEL = "n4-nota-apertada";

// --- N5: rodapé/observação externa após o fim da tabela --------------------
// Reconstrução do Caso L12 original, commit `13257242e3` (lá, negativo por
// ausência de reconfirmação estrutural posterior).
export function caseN5_footerAfterTableEnd(): SyntheticGeometryPage {
  return buildDiscoverySequence([
    ...anchorBlock(3, "n5"),
    { kind: "wide-external", gapRatioBefore: GAP_RATIO_TIGHT, label: "n5-rodape-apertado", leftPoints: 10, rightPoints: 890 },
  ]);
}
export const N5_TARGET_LABEL = "n5-rodape-apertado";

// --- N6/N10: linha separadora / elemento largo entre duas regiões ----------
// Reconstrução do Caso H, commit `0e7fc088` (Sprint 21.4B.1). Papel duplo
// documentado no pré-registro (§7/§8 da matriz): mesma fixture cobre "linha
// separadora entre duas tabelas" (N6) e "elemento largo entre duas regiões
// independentes" (N10).
export function caseN6N10_wideElementBetweenIndependentRegions(): SyntheticGeometryPage {
  const topBlock = [0, 1, 2].flatMap((i) => fullRowItems(500 + i * 25, `n6top${i}`));
  const titleTop = 575;
  const title: SyntheticGeometryTextItem = { text: "n6-titulo-largo", leftPoints: 10, topPoints: titleTop, rightPoints: 890, bottomPoints: titleTop + ROW_HEIGHT };
  const bottomBlock = [0, 1, 2].flatMap((i) => fullRowItems(600 + i * 25, `n6bottom${i}`));
  return { widthPoints: PAGE_WIDTH, heightPoints: PAGE_HEIGHT, items: [...topBlock, title, ...bottomBlock] };
}
export const N6_TARGET_LABEL = "n6-titulo-largo";

// --- N7: conteúdo externo dentro do envelope horizontal geral (novo) -------
// Novo nesta Sprint: elemento cuja largura total corresponde ao envelope
// físico de TODAS as colunas somadas (bordas coincidindo com a primeira e
// a última coluna), mas sem coincidir com nenhuma coluna INDIVIDUAL —
// distingue "dentro do envelope geral" de "alinhado a uma coluna" (Caso J
// testa apenas coincidência com uma única borda).
export function caseN7_wideElementWithinOverallEnvelope(): SyntheticGeometryPage {
  const firstColumn = COLUMNS[0];
  const lastColumn = COLUMNS[COLUMNS.length - 1];
  return buildDiscoverySequence([
    ...anchorBlock(3, "n7before"),
    { kind: "wide-external", gapRatioBefore: GAP_RATIO_NORMAL, label: "n7-dentro-envelope", leftPoints: firstColumn.leftPoints + 2, rightPoints: lastColumn.rightPoints - 2 },
    ...anchorBlock(3, "n7after").map((s) => ({ ...s, gapRatioBefore: GAP_RATIO_NORMAL })),
  ]);
}
export const N7_TARGET_LABEL = "n7-dentro-envelope";

// --- N8: conteúdo externo coincidindo com borda de coluna ------------------
// Reconstrução do Caso J, commit `0e7fc088` (Sprint 21.4B.1): borda
// esquerda coincide com ITEM, borda direita nunca coincide com outra
// coluna, espaçamento vertical NORMAL (nunca apertado — distingue de N2).
export function caseN8_externalContentCoincidingWithColumnBorder(): SyntheticGeometryPage {
  const rows: DiscoverySequenceLineSpec[] = [];
  for (let i = 0; i < 6; i += 1) {
    if (i === 3) {
      rows.push({ kind: "wide-external", gapRatioBefore: GAP_RATIO_NORMAL, label: "n8-paragrafo-acidental", leftPoints: ITEM_COLUMN.leftPoints, rightPoints: 600 });
    } else {
      rows.push({ kind: "full", gapRatioBefore: i === 0 ? 0 : GAP_RATIO_NORMAL, label: `n8row${i}` });
    }
  }
  return buildDiscoverySequence(rows);
}
export const N8_TARGET_LABEL = "n8-paragrafo-acidental";

// --- N9: múltiplas linhas externas repetidas, alinhamento privado (novo) --
// Novo nesta Sprint: observação de que o Caso L3 (positivo, três
// continuações idênticas) forma seu próprio alinhamento privado local
// (Sprint 21.4B.2, commit `13257242e3`) é aqui reaproveitada como
// NEGATIVO deliberado — três parágrafos externos IDÊNTICOS (largura fora
// de qualquer envelope de coluna), inseridos entre dois blocos âncora,
// que também formam um alinhamento privado local entre si. Testa se um
// discriminador ingênuo por "componente de alinhamento" confundiria as
// duas situações (que só diferem pela largura/posição do conteúdo
// repetido, nunca pela topologia de alinhamento).
export function caseN9_repeatedExternalLinesPrivateAlignment(): SyntheticGeometryPage {
  return buildDiscoverySequence([
    ...anchorBlock(3, "n9before"),
    { kind: "wide-external", gapRatioBefore: GAP_RATIO_TIGHT, label: "n9-externo1", leftPoints: 10, rightPoints: 890 },
    { kind: "wide-external", gapRatioBefore: GAP_RATIO_TIGHT, label: "n9-externo2", leftPoints: 10, rightPoints: 890 },
    { kind: "wide-external", gapRatioBefore: GAP_RATIO_TIGHT, label: "n9-externo3", leftPoints: 10, rightPoints: 890 },
    ...anchorBlock(3, "n9after").map((s) => ({ ...s, gapRatioBefore: GAP_RATIO_NORMAL })),
  ]);
}
export const N9_TARGET_LABEL = "n9-externo1";

// --- Adversariais preservados: Caso J, L3, L7 (aliases explícitos) ---------
export const caseJ_accidentalSingleAlignmentParagraph = caseN8_externalContentCoincidingWithColumnBorder;
export const caseL3_threeConsecutiveTightContinuations = caseP4_threeConsecutiveTightContinuations;
export const caseL7_externalParagraphTightSpacing = caseN2_externalParagraphTightSpacingAdversarial;

/** Caso F original (Sprint 21.4B.1, commit `0e7fc088`): linha esparsa legítima (só descrição), largura de continuação, espaçamento NORMAL — alias para P6/P5 não se aplica; reconstrução direta e independente abaixo para preservar a identidade exata do Caso F usada na prova de indistinguibilidade (§5 do pré-registro). */
export function caseF_denseTableWithLegitimateSparseRow(): SyntheticGeometryPage {
  const rows: DiscoverySequenceLineSpec[] = [];
  for (let i = 0; i < 6; i += 1) {
    if (i === 3) {
      rows.push({ kind: "description-only", gapRatioBefore: GAP_RATIO_NORMAL, label: "f-sparse" });
    } else {
      rows.push({ kind: "full", gapRatioBefore: i === 0 ? 0 : GAP_RATIO_NORMAL, label: `frow${i}` });
    }
  }
  return buildDiscoverySequence(rows);
}
export const F_TARGET_LABEL = "f-sparse-continuation";
