import type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "../tabular-region-detection/testing/tabular-region-detection-test-bridge";
import { DENSE_COLUMNS, DIAGNOSIS_PAGE_HEIGHT, DIAGNOSIS_PAGE_WIDTH, DIAGNOSIS_ROW_HEIGHT } from "./dense-table-region-diagnosis-fixtures";

/**
 * Fixtures exclusivamente diagnósticas da Sprint 21.4B.2 — geometria
 * sintética genérica, nunca o caso real Lagoa do Arroz. Intervalos
 * expressos como proporção da altura de linha (`GAP_RATIO_*`), nunca só em
 * pontos absolutos — o valor em pontos é sempre `ratio * DIAGNOSIS_ROW_HEIGHT`,
 * calculado no momento da construção. Nunca importada por código de
 * produção.
 *
 * Convenção de leitura confirmada empiricamente (Sprints 21.4B.1):
 * `verticalOrder` cresce com `topPoints` crescente. Cada linha é
 * construída explicitamente a partir da anterior via `bottomPoints +
 * gap`, nunca por subtração — garante que "continuação" sempre lê
 * DEPOIS de sua linha primária, como no documento real.
 */

/** Espaçamento normal entre linhas de dados distintas — mesma convenção da 21.4B.1 (gap=13, altura=12). */
export const GAP_RATIO_NORMAL = 13 / DIAGNOSIS_ROW_HEIGHT;
/** Intervalo quase nulo de uma continuação real de descrição (documento real: gapPrev ≈ -0.01, aqui um valor positivo mínimo para nunca disparar sobreposição em f.1). */
export const GAP_RATIO_TIGHT = 1 / DIAGNOSIS_ROW_HEIGHT;
/** Sonda de fronteira entre apertado e normal — usada apenas pelo Caso L4. */
export const GAP_RATIO_BOUNDARY_PROBE = 5 / DIAGNOSIS_ROW_HEIGHT;

interface SequenceLineSpec {
  readonly kind: "full" | "description-only" | "wide-external";
  readonly gapRatioBefore: number;
  readonly label: string;
  /** Para `description-only`/`wide-external`: bordas explícitas; para `full`, usa `DENSE_COLUMNS`. */
  readonly leftPoints?: number;
  readonly rightPoints?: number;
}

function fullRowItems(top: number, label: string): SyntheticGeometryTextItem[] {
  return DENSE_COLUMNS.map((column) => ({
    text: `${label}-${column.name.toLowerCase()}`,
    leftPoints: column.leftPoints,
    topPoints: top,
    rightPoints: column.rightPoints,
    bottomPoints: top + DIAGNOSIS_ROW_HEIGHT,
  }));
}

const DESCRICAO_COLUMN = DENSE_COLUMNS[3];

/**
 * Constrói uma sequência de linhas lendo topo a baixo (`verticalOrder`
 * crescente), cada uma posicionada a `gapRatioBefore * DIAGNOSIS_ROW_HEIGHT`
 * pontos abaixo do fim da anterior — nunca por subtração a partir de uma
 * linha "principal".
 */
function buildSequence(specs: ReadonlyArray<SequenceLineSpec>): SyntheticGeometryPage {
  const items: SyntheticGeometryTextItem[] = [];
  let cursorBottom = 40; // topo inicial arbitrário, bem dentro da página
  specs.forEach((spec, index) => {
    const gapPoints = spec.gapRatioBefore * DIAGNOSIS_ROW_HEIGHT;
    const top = index === 0 ? cursorBottom : cursorBottom + gapPoints;
    const bottom = top + DIAGNOSIS_ROW_HEIGHT;
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
  return { widthPoints: DIAGNOSIS_PAGE_WIDTH, heightPoints: DIAGNOSIS_PAGE_HEIGHT, items };
}

/** L1 — uma continuação apertada entre duas linhas tabulares completas, com 3 linhas completas de cada lado (mínimo para região independente). Esperado: continuação pertence à região. */
export function caseL1_singleTightContinuation(): SyntheticGeometryPage {
  return buildSequence([
    { kind: "full", gapRatioBefore: 0, label: "row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row2" },
    { kind: "description-only", gapRatioBefore: GAP_RATIO_TIGHT, label: "row2cont" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row3" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row4" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row5" },
  ]);
}

/** L2 — duas continuações consecutivas da mesma descrição, 3+3 linhas completas. Esperado: ambas pertencem à região. */
export function caseL2_twoConsecutiveTightContinuations(): SyntheticGeometryPage {
  return buildSequence([
    { kind: "full", gapRatioBefore: 0, label: "row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row2" },
    { kind: "description-only", gapRatioBefore: GAP_RATIO_TIGHT, label: "row2cont1" },
    { kind: "description-only", gapRatioBefore: GAP_RATIO_TIGHT, label: "row2cont2" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row3" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row4" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row5" },
  ]);
}

/** L3 — três continuações consecutivas, 3+3 linhas completas. Esperado: a regra não pode ficar limitada a uma única ponte. */
export function caseL3_threeConsecutiveTightContinuations(): SyntheticGeometryPage {
  return buildSequence([
    { kind: "full", gapRatioBefore: 0, label: "row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row2" },
    { kind: "description-only", gapRatioBefore: GAP_RATIO_TIGHT, label: "row2cont1" },
    { kind: "description-only", gapRatioBefore: GAP_RATIO_TIGHT, label: "row2cont2" },
    { kind: "description-only", gapRatioBefore: GAP_RATIO_TIGHT, label: "row2cont3" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row3" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row4" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row5" },
  ]);
}

/** L4 — continuação com intervalo positivo pequeno, próximo da fronteira tipográfica escolhida (ver relatório), 3+3 linhas completas. */
export function caseL4_boundaryProbeContinuation(): SyntheticGeometryPage {
  return buildSequence([
    { kind: "full", gapRatioBefore: 0, label: "row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row2" },
    { kind: "description-only", gapRatioBefore: GAP_RATIO_BOUNDARY_PROBE, label: "row2cont" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row3" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row4" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row5" },
  ]);
}

/** L5 — linha normal subsequente, nunca confundida com continuação (controle, densa, sem quebra nenhuma). */
export function caseL5_normalSubsequentRow(): SyntheticGeometryPage {
  return buildSequence([
    { kind: "full", gapRatioBefore: 0, label: "row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row2" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row3" },
  ]);
}

/** L6 — parágrafo externo com espaçamento normal, 3+3 linhas completas. Deve permanecer fora. */
export function caseL6_externalParagraphNormalSpacing(): SyntheticGeometryPage {
  return buildSequence([
    { kind: "full", gapRatioBefore: 0, label: "row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row2" },
    { kind: "wide-external", gapRatioBefore: GAP_RATIO_NORMAL, label: "paragrafo-normal", leftPoints: DENSE_COLUMNS[0].leftPoints, rightPoints: 600 },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row3" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row4" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row5" },
  ]);
}

/** L7 — ADVERSARIAL OBRIGATÓRIO: parágrafo externo deliberadamente apertado (mesmo intervalo de uma continuação real), borda esquerda coincidindo com a coluna ITEM, 3+3 linhas completas. Deve permanecer fora. */
export function caseL7_externalParagraphTightSpacing(): SyntheticGeometryPage {
  return buildSequence([
    { kind: "full", gapRatioBefore: 0, label: "row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row2" },
    { kind: "wide-external", gapRatioBefore: GAP_RATIO_TIGHT, label: "paragrafo-apertado", leftPoints: DENSE_COLUMNS[0].leftPoints, rightPoints: 600 },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row3" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row4" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row5" },
  ]);
}

/** L8 — título externo apertado, 3+3 linhas completas. Deve permanecer fora (largura total, sem coincidir com nenhuma coluna). */
export function caseL8_externalTitleTightSpacing(): SyntheticGeometryPage {
  return buildSequence([
    { kind: "full", gapRatioBefore: 0, label: "row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row2" },
    { kind: "wide-external", gapRatioBefore: GAP_RATIO_TIGHT, label: "titulo-apertado", leftPoints: 10, rightPoints: 890 },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row3" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row4" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row5" },
  ]);
}

/** L9 — nota lateral apertada, fora do envelope horizontal das 10 colunas, 3+3 linhas completas. Deve permanecer fora. */
export function caseL9_lateralNoteTightSpacing(): SyntheticGeometryPage {
  return buildSequence([
    { kind: "full", gapRatioBefore: 0, label: "row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row2" },
    { kind: "wide-external", gapRatioBefore: GAP_RATIO_TIGHT, label: "nota-apertada", leftPoints: 875, rightPoints: 898 },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row3" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row4" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row5" },
  ]);
}

/** L10 — duas linhas tabulares legítimas muito próximas (ambas COMPLETAS, nunca esparsas) — continuam duas linhas físicas na região, sem associação lógica prematura. */
export function caseL10_twoLegitimateTabularRowsVeryClose(): SyntheticGeometryPage {
  return buildSequence([
    { kind: "full", gapRatioBefore: 0, label: "row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_TIGHT, label: "row2-close" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row3" },
  ]);
}

/** L11 — início da tabela: uma linha apertada ANTES da primeira linha tabular, sem predecessor tabular válido. Não pode ser absorvida como continuação. */
export function caseL11_tightLineBeforeTableStart(): SyntheticGeometryPage {
  return buildSequence([
    { kind: "wide-external", gapRatioBefore: 0, label: "titulo-antes-apertado", leftPoints: 10, rightPoints: 890 },
    { kind: "full", gapRatioBefore: GAP_RATIO_TIGHT, label: "row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row2" },
  ]);
}

/** L12 — final da tabela: uma linha apertada DEPOIS da última linha tabular, sem reconfirmação estrutural posterior. Não pode ser absorvida. */
export function caseL12_tightLineAfterTableEnd(): SyntheticGeometryPage {
  return buildSequence([
    { kind: "full", gapRatioBefore: 0, label: "row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "row2" },
    { kind: "wide-external", gapRatioBefore: GAP_RATIO_TIGHT, label: "rodape-apertado", leftPoints: 10, rightPoints: 890 },
  ]);
}
