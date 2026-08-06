import type { ReferenceTruthColumn } from "./discovery-reference-truth.types";

/**
 * Colunas esperadas, derivadas de evidência geométrica real (alinhamentos
 * verticais recorrentes observados nas 3 páginas, via
 * `observeVerticalAlignments`, já testada e aprovada em sprints anteriores —
 * nunca eyeballed a partir da imagem). Posições byte-idênticas nas 3
 * páginas (mesmo template).
 *
 * Achado real e confirmado (nenhuma instância em contrário nas 3 páginas):
 * CUSTO_UNIT_SEM_BDI e BDI_PERCENTUAL SEMPRE compartilham o mesmo segmento
 * físico de texto extraído — nunca aparecem como segmentos separados nesta
 * amostra. O intervalo horizontal registrado é o do bloco fundido; a
 * distinção entre as duas células é feita por padrão de texto (decimal vs.
 * percentual), nunca por posição.
 */
export const REFERENCE_TRUTH_COLUMNS: ReadonlyArray<ReferenceTruthColumn> = [
  {
    id: "col-item",
    role: "item",
    observedHeaderLabelPt: "ITEM",
    horizontalIntervalPoints: { leftPoints: 57.82, rightPoints: 88.73 },
    presentOnPages: [46, 50, 54],
    variationAcrossPagesPt: "Posição byte-idêntica nas 3 páginas (mesmo template de cabeçalho, confirmado por alinhamento geométrico real).",
    frequentPhysicalMergeWithColumnId: null,
  },
  {
    id: "col-codigo",
    role: "codigo",
    observedHeaderLabelPt: "CÓDIGO",
    horizontalIntervalPoints: { leftPoints: 141.71, rightPoints: 178.86 },
    presentOnPages: [46, 50, 54],
    variationAcrossPagesPt: "Posição byte-idêntica nas 3 páginas (mesmo template de cabeçalho, confirmado por alinhamento geométrico real).",
    frequentPhysicalMergeWithColumnId: null,
  },
  {
    id: "col-fonte",
    role: "fonte",
    observedHeaderLabelPt: "FONTE",
    horizontalIntervalPoints: { leftPoints: 217.17, rightPoints: 260.28 },
    presentOnPages: [46, 50, 54],
    variationAcrossPagesPt: "Posição byte-idêntica nas 3 páginas (mesmo template de cabeçalho, confirmado por alinhamento geométrico real).",
    frequentPhysicalMergeWithColumnId: null,
  },
  {
    id: "col-tipo",
    role: "tipo",
    observedHeaderLabelPt: "TIPO",
    horizontalIntervalPoints: { leftPoints: 281.18, rightPoints: 304.66 },
    presentOnPages: [46, 50, 54],
    variationAcrossPagesPt: "Posição byte-idêntica nas 3 páginas (mesmo template de cabeçalho, confirmado por alinhamento geométrico real).",
    frequentPhysicalMergeWithColumnId: null,
  },
  {
    id: "col-descricao",
    role: "descricao",
    observedHeaderLabelPt: "DESCRIÇÃO",
    horizontalIntervalPoints: { leftPoints: 304.66, rightPoints: 719.62 },
    presentOnPages: [46, 50, 54],
    variationAcrossPagesPt: "Posição byte-idêntica nas 3 páginas (mesmo template de cabeçalho, confirmado por alinhamento geométrico real).",
    frequentPhysicalMergeWithColumnId: null,
  },
  {
    id: "col-unidade",
    role: "unidade",
    observedHeaderLabelPt: "UNID",
    horizontalIntervalPoints: { leftPoints: 717.36, rightPoints: 736.07 },
    presentOnPages: [46, 50, 54],
    variationAcrossPagesPt: "Posição byte-idêntica nas 3 páginas (mesmo template de cabeçalho, confirmado por alinhamento geométrico real).",
    frequentPhysicalMergeWithColumnId: null,
  },
  {
    id: "col-quantidade",
    role: "quantidade",
    observedHeaderLabelPt: "QUANT.",
    horizontalIntervalPoints: { leftPoints: 780.6, rightPoints: 804.3 },
    presentOnPages: [46, 50, 54],
    variationAcrossPagesPt: "Posição byte-idêntica nas 3 páginas (mesmo template de cabeçalho, confirmado por alinhamento geométrico real).",
    frequentPhysicalMergeWithColumnId: null,
  },
  {
    id: "col-custo-sbdi",
    role: "custo_unitario_sem_bdi",
    observedHeaderLabelPt: "CUSTO UNIT.S/BDI",
    horizontalIntervalPoints: { leftPoints: 824.19, rightPoints: 894.83 },
    presentOnPages: [46, 50, 54],
    variationAcrossPagesPt: "Posição byte-idêntica nas 3 páginas (mesmo template de cabeçalho, confirmado por alinhamento geométrico real).",
    frequentPhysicalMergeWithColumnId: "col-bdi",
  },
  {
    id: "col-bdi",
    role: "bdi_percentual",
    observedHeaderLabelPt: "BDI (%)",
    horizontalIntervalPoints: { leftPoints: 824.19, rightPoints: 894.83 },
    presentOnPages: [46, 50, 54],
    variationAcrossPagesPt: "Posição byte-idêntica nas 3 páginas (mesmo template de cabeçalho, confirmado por alinhamento geométrico real).",
    frequentPhysicalMergeWithColumnId: "col-custo-sbdi",
  },
  {
    id: "col-unit-cbdi",
    role: "preco_unitario_com_bdi",
    observedHeaderLabelPt: "UNIT. C/BDI",
    horizontalIntervalPoints: { leftPoints: 913.32, rightPoints: 947.82 },
    presentOnPages: [46, 50, 54],
    variationAcrossPagesPt: "Posição byte-idêntica nas 3 páginas (mesmo template de cabeçalho, confirmado por alinhamento geométrico real).",
    frequentPhysicalMergeWithColumnId: null,
  },
  {
    id: "col-total-cbdi",
    role: "preco_total_com_bdi",
    observedHeaderLabelPt: "TOTAL C/BDI",
    horizontalIntervalPoints: { leftPoints: 970.2, rightPoints: 1015.5 },
    presentOnPages: [46, 50, 54],
    variationAcrossPagesPt: "Posição byte-idêntica nas 3 páginas (mesmo template de cabeçalho, confirmado por alinhamento geométrico real).",
    frequentPhysicalMergeWithColumnId: null,
  },
  {
    id: "col-fgv",
    role: "col_fgv",
    observedHeaderLabelPt: "COL. FGV",
    horizontalIntervalPoints: { leftPoints: 1037.65, rightPoints: 1148.01 },
    presentOnPages: [46, 50, 54],
    variationAcrossPagesPt: "Posição byte-idêntica nas 3 páginas (mesmo template de cabeçalho, confirmado por alinhamento geométrico real).",
    frequentPhysicalMergeWithColumnId: null,
  },
];
