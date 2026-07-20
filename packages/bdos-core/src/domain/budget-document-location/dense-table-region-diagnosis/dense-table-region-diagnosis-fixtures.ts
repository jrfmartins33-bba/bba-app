import type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "../tabular-region-detection/testing/tabular-region-detection-test-bridge";

/**
 * Fixtures exclusivamente diagnósticas da Sprint 21.4B.1, sem qualquer
 * relação com o caso real Lagoa do Arroz — geometria sintética, genérica,
 * inventada apenas para isolar a hipótese de que descrições que quebram em
 * duas linhas físicas fragmentam a detecção de região tabular (f.2a) em
 * tabelas densas. Nunca importada por código de produção; nunca usada fora
 * do módulo `dense-table-region-diagnosis`.
 */

export const DIAGNOSIS_PAGE_WIDTH = 900;
export const DIAGNOSIS_PAGE_HEIGHT = 792;
export const DIAGNOSIS_ROW_HEIGHT = 12;
export const DIAGNOSIS_ROW_STEP = 25;
/** Espaçamento entre a primeira e a segunda linha física de uma descrição quebrada — bem mais apertado que o espaçamento entre linhas distintas da tabela, imitando entrelinha de texto contínuo. */
export const DIAGNOSIS_WRAP_STEP_REALISTIC = 13;

export interface DiagnosisColumn {
  readonly name: string;
  readonly leftPoints: number;
  readonly rightPoints: number;
}

/** Dez colunas densas, com folga horizontal de 30pt entre colunas (acima do limiar de 24pt = 2.0 × altura de 12pt que uniria duas colunas no mesmo segmento). */
export const DENSE_COLUMNS: ReadonlyArray<DiagnosisColumn> = [
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

/** Apenas duas colunas (código + descrição) — usada para separar o efeito da densidade (muitas colunas) do efeito puro da quebra de descrição. */
export const SIMPLE_COLUMNS: ReadonlyArray<DiagnosisColumn> = [
  { name: "ITEM", leftPoints: 40, rightPoints: 70 },
  { name: "DESCRICAO", leftPoints: 100, rightPoints: 430 },
];

export interface DenseTableRowSpec {
  /** Linha 0-based dentro da tabela. */
  readonly rowIndex: number;
  /** Se ausente, a linha é populada normalmente (uma linha física, todas as colunas). */
  readonly wrap?: {
    /** Espaçamento vertical entre a primeira e a segunda linha física da descrição. */
    readonly wrapStep: number;
    /** Largura da segunda linha física (texto de continuação, tipicamente mais curto). */
    readonly continuationRightPoints: number;
  };
  /** Linha esparsa legítima: só a coluna de descrição é populada, no espaçamento normal entre linhas (nunca o espaçamento apertado de quebra). Nunca combinado com `wrap`. */
  readonly sparseDescriptionOnly?: boolean;
}

function rowTopPoints(rowIndex: number, startTopPoints: number): number {
  return startTopPoints - rowIndex * DIAGNOSIS_ROW_STEP;
}

/**
 * Constrói uma tabela sintética com as colunas dadas, uma linha por
 * `rowIndex` de 0 a `rowCount - 1`, aplicando as especificações de `specs`
 * (quebra de descrição ou linha esparsa) às linhas nomeadas — todas as
 * demais linhas são populadas normalmente em todas as colunas, numa única
 * linha física.
 */
export function buildDenseTableCase(
  columns: ReadonlyArray<DiagnosisColumn>,
  rowCount: number,
  specs: ReadonlyArray<DenseTableRowSpec> = [],
  startTopPoints = 700,
): SyntheticGeometryPage {
  const specByRowIndex = new Map(specs.map((spec) => [spec.rowIndex, spec]));
  const items: SyntheticGeometryTextItem[] = [];
  const descriptionColumnIndex = columns.findIndex((column) => column.name === "DESCRICAO");

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const spec = specByRowIndex.get(rowIndex);
    const top = rowTopPoints(rowIndex, startTopPoints);
    const bottom = top + DIAGNOSIS_ROW_HEIGHT;

    if (spec?.sparseDescriptionOnly) {
      const descColumn = columns[descriptionColumnIndex >= 0 ? descriptionColumnIndex : columns.length - 1];
      /** Mesma largura de uma linha de continuação de quebra (nunca a largura total da coluna) — deliberado: isola o único sinal geométrico que pode distinguir uma linha esparsa legítima de uma continuação de quebra, que é o espaçamento vertical, nunca a largura ocupada. */
      const sparseRightPoints = Math.min(descColumn.rightPoints, descColumn.leftPoints + 95);
      items.push({
        text: `row${rowIndex}-sparse-description`,
        leftPoints: descColumn.leftPoints,
        topPoints: top,
        rightPoints: sparseRightPoints,
        bottomPoints: bottom,
      });
      continue;
    }

    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex];
      const isDescriptionColumn = columnIndex === descriptionColumnIndex;

      if (isDescriptionColumn && spec?.wrap) {
        items.push({
          text: `row${rowIndex}-description-line1`,
          leftPoints: column.leftPoints,
          topPoints: top,
          rightPoints: column.rightPoints,
          bottomPoints: bottom,
        });
        const wrapTop = top - spec.wrap.wrapStep;
        items.push({
          text: `row${rowIndex}-description-line2-continuation`,
          leftPoints: column.leftPoints,
          topPoints: wrapTop,
          rightPoints: spec.wrap.continuationRightPoints,
          bottomPoints: wrapTop + DIAGNOSIS_ROW_HEIGHT,
        });
        continue;
      }

      items.push({
        text: `row${rowIndex}-${column.name.toLowerCase()}`,
        leftPoints: column.leftPoints,
        topPoints: top,
        rightPoints: column.rightPoints,
        bottomPoints: bottom,
      });
    }
  }

  return { widthPoints: DIAGNOSIS_PAGE_WIDTH, heightPoints: DIAGNOSIS_PAGE_HEIGHT, items };
}

/** Caso A — controle denso, sem nenhuma quebra de descrição: 10 colunas, 6 linhas, todas de uma única linha física. */
export function caseA_denseTableNoWrap(): SyntheticGeometryPage {
  return buildDenseTableCase(DENSE_COLUMNS, 6);
}

/** Caso B — denso, com DUAS linhas cuja descrição quebra em duas linhas físicas (linhas 2 e 4, 0-based). */
export function caseB_denseTableTwoWraps(): SyntheticGeometryPage {
  return buildDenseTableCase(DENSE_COLUMNS, 6, [
    { rowIndex: 2, wrap: { wrapStep: DIAGNOSIS_WRAP_STEP_REALISTIC, continuationRightPoints: 340 } },
    { rowIndex: 4, wrap: { wrapStep: DIAGNOSIS_WRAP_STEP_REALISTIC, continuationRightPoints: 320 } },
  ]);
}

/** Caso C — simples (2 colunas), com a mesma quebra de descrição isolada na linha 2 — separa o efeito da densidade do efeito da quebra. */
export function caseC_simpleTableWithWrap(): SyntheticGeometryPage {
  return buildDenseTableCase(SIMPLE_COLUMNS, 6, [
    { rowIndex: 2, wrap: { wrapStep: DIAGNOSIS_WRAP_STEP_REALISTIC, continuationRightPoints: 340 } },
  ]);
}

/** Caso D — denso, exatamente UMA quebra isolada (linha 2), geometria perfeitamente uniforme nas demais linhas — a reprodução mínima controlada. */
export function caseD_denseTableSingleCleanWrap(): SyntheticGeometryPage {
  return buildDenseTableCase(DENSE_COLUMNS, 6, [
    { rowIndex: 2, wrap: { wrapStep: DIAGNOSIS_WRAP_STEP_REALISTIC, continuationRightPoints: 340 } },
  ]);
}

/**
 * Caso E — mesma tabela do Caso D, variando `wrapStep` para testar
 * sensibilidade à tolerância geométrica de junção de linha física (f.1):
 * limiar algébrico exato = 6pt (ver relatório de diagnóstico). `wrapStep`
 * ≤ 6 deve fundir as duas linhas físicas da descrição na mesma linha;
 * `wrapStep` ≥ 7 deve mantê-las como linhas físicas distintas.
 */
export function caseE_wrapStepVariant(wrapStep: number): SyntheticGeometryPage {
  return buildDenseTableCase(DENSE_COLUMNS, 6, [{ rowIndex: 2, wrap: { wrapStep, continuationRightPoints: 340 } }]);
}

export const CASE_E_WRAP_STEP_VARIANTS: ReadonlyArray<number> = [13, 7, 6, 3];

/** Caso F — linha esparsa legítima (só descrição, sem quebra, no espaçamento normal entre linhas) — nunca deve ser confundida com uma continuação de quebra por uma correção futura. */
export function caseF_denseTableWithLegitimateSparseRow(): SyntheticGeometryPage {
  return buildDenseTableCase(DENSE_COLUMNS, 6, [{ rowIndex: 3, sparseDescriptionOnly: true }]);
}

/** Caso G — reaproveita exatamente o Caso D: fixture de "antes" para a associação lógica (linha de continuação pertence ao mesmo item), fora do escopo de f.1/f.2a hoje — ver relatório. */
export function caseG_legitimateContinuationFixture(): SyntheticGeometryPage {
  return caseD_denseTableSingleCleanWrap();
}

function denseRowItems(top: number, rowLabel: string): SyntheticGeometryTextItem[] {
  return DENSE_COLUMNS.map((column) => ({
    text: `${rowLabel}-${column.name.toLowerCase()}`,
    leftPoints: column.leftPoints,
    topPoints: top,
    rightPoints: column.rightPoints,
    bottomPoints: top + DIAGNOSIS_ROW_HEIGHT,
  }));
}

/**
 * Caso H — título externo largo entre dois blocos tabulares independentes,
 * sem nenhuma borda coincidente com qualquer coluna — nunca deve ser
 * absorvido nem servir de ponte entre os dois blocos. `verticalOrder`
 * cresce com `topPoints` crescente neste espaço de coordenadas (confirmado
 * empiricamente nos Casos A-G) — os `topPoints` abaixo são, portanto,
 * explícitos e crescentes na ordem de leitura pretendida.
 */
export function caseH_externalTitleBetweenTabularBlocks(): SyntheticGeometryPage {
  const topBlock = [500, 525, 550].flatMap((top, i) => denseRowItems(top, `top${i}`));
  const titleTop = 575;
  const title: SyntheticGeometryTextItem = {
    text: "titulo-externo-largo",
    leftPoints: 10,
    topPoints: titleTop,
    rightPoints: 890,
    bottomPoints: titleTop + DIAGNOSIS_ROW_HEIGHT,
  };
  const bottomBlock = [600, 625, 650].flatMap((top, i) => denseRowItems(top, `bottom${i}`));
  return { widthPoints: DIAGNOSIS_PAGE_WIDTH, heightPoints: DIAGNOSIS_PAGE_HEIGHT, items: [...topBlock, title, ...bottomBlock] };
}

/** Caso I — nota lateral inteiramente fora do envelope horizontal das 10 colunas (à direita da última coluna, folga de 30pt — acima do limiar de junção de segmento) — não deve ser absorvida. */
export function caseI_lateralNoteOutsideEnvelope(): SyntheticGeometryPage {
  const rows = [500, 525, 550, 575, 600, 625].flatMap((top, i) => denseRowItems(top, `row${i}`));
  const note: SyntheticGeometryTextItem = { text: "nota-lateral", leftPoints: 875, topPoints: 550, rightPoints: 898, bottomPoints: 550 + DIAGNOSIS_ROW_HEIGHT };
  return { widthPoints: DIAGNOSIS_PAGE_WIDTH, heightPoints: DIAGNOSIS_PAGE_HEIGHT, items: [...rows, note] };
}

/**
 * Caso J — ADVERSARIAL: parágrafo comum inserido dentro de uma única tabela
 * contínua (nunca entre duas tabelas independentes), no espaçamento
 * vertical NORMAL entre linhas, cuja borda esquerda coincide
 * propositalmente com a borda esquerda da coluna ITEM (compartilha
 * exatamente 1 alinhamento por coincidência geométrica) — a borda direita
 * (600pt) nunca coincide com nenhuma outra coluna. Testa diretamente se um
 * discriminador ingênuo baseado apenas em "subconjunto de alinhamentos
 * ativos" absorveria incorretamente conteúdo não tabular.
 */
export function caseJ_accidentalSingleAlignmentParagraph(): SyntheticGeometryPage {
  const rowCount = 6;
  const items: SyntheticGeometryTextItem[] = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const top = rowTopPoints(rowIndex, 700);
    if (rowIndex === 3) {
      items.push({ text: "paragrafo-acidental", leftPoints: 40, topPoints: top, rightPoints: 600, bottomPoints: top + DIAGNOSIS_ROW_HEIGHT });
      continue;
    }
    for (const column of DENSE_COLUMNS) {
      items.push({ text: `row${rowIndex}-${column.name.toLowerCase()}`, leftPoints: column.leftPoints, topPoints: top, rightPoints: column.rightPoints, bottomPoints: top + DIAGNOSIS_ROW_HEIGHT });
    }
  }
  return { widthPoints: DIAGNOSIS_PAGE_WIDTH, heightPoints: DIAGNOSIS_PAGE_HEIGHT, items };
}

/** Caso K — cabeçalho interno esparso (ITEM + DESCRICAO apenas, largura de coluna cheia, espaçamento normal) — pertence semanticamente à tabela, deve permanecer na região. */
export function caseK_sparseInternalHeader(): SyntheticGeometryPage {
  const rowCount = 6;
  const items: SyntheticGeometryTextItem[] = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const top = rowTopPoints(rowIndex, 700);
    if (rowIndex === 3) {
      items.push({ text: "header-item", leftPoints: DENSE_COLUMNS[0].leftPoints, topPoints: top, rightPoints: DENSE_COLUMNS[0].rightPoints, bottomPoints: top + DIAGNOSIS_ROW_HEIGHT });
      items.push({ text: "header-descricao", leftPoints: DENSE_COLUMNS[3].leftPoints, topPoints: top, rightPoints: DENSE_COLUMNS[3].rightPoints, bottomPoints: top + DIAGNOSIS_ROW_HEIGHT });
      continue;
    }
    for (const column of DENSE_COLUMNS) {
      items.push({ text: `row${rowIndex}-${column.name.toLowerCase()}`, leftPoints: column.leftPoints, topPoints: top, rightPoints: column.rightPoints, bottomPoints: top + DIAGNOSIS_ROW_HEIGHT });
    }
  }
  return { widthPoints: DIAGNOSIS_PAGE_WIDTH, heightPoints: DIAGNOSIS_PAGE_HEIGHT, items };
}
