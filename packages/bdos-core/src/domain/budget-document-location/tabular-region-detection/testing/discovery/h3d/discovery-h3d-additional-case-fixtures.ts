import type { SyntheticGeometryPage } from "../../tabular-region-detection-test-bridge";
import { buildDiscoverySequence, COLUMNS, GAP_RATIO_NORMAL } from "../discovery-case-fixtures";
import type { DiscoverySequenceLineSpec } from "../discovery-case-fixtures";

/**
 * Casos sintéticos adicionais, exclusivos de H3d (Sprint 21.4B.3A.2, §12.2
 * do enunciado) — testam especificamente a regra de corroboração vertical
 * de fronteira (§7.5), que não existe em nenhuma candidata anterior (H0-H4/
 * H3b/H3c/H3c-r1). Reaproveitam exclusivamente as primitivas geométricas
 * já existentes de `discovery-case-fixtures.ts` (`buildDiscoverySequence`,
 * `COLUMNS`) — nunca uma nova convenção geométrica.
 */

const ITEM_COLUMN = COLUMNS[0];
const TOTAL_COLUMN = COLUMNS[9];

// --- ADD1: cabeçalho interno multicoluna na fronteira SUPERIOR (positivo) --
// Cabeçalho com 2 colunas populadas (ITEM+DESCRICAO), posicionado como a
// PRIMEIRA linha da página — imediatamente antes de um bloco de 3 linhas
// âncora completas. Testa a admissão de cabeçalhos internos multicoluna na
// fronteira (§7.5, caso de fronteira: "corresponde a >= minimumRecurrentAlignmentCount
// envelopes distintos").
export function caseH3dAdd1_multiColumnHeaderAtUpperBoundary(): SyntheticGeometryPage {
  const rows: DiscoverySequenceLineSpec[] = [
    { kind: "two-column-sparse", gapRatioBefore: 0, label: "h3dadd1header", secondColumn: ITEM_COLUMN },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "h3dadd1row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "h3dadd1row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "h3dadd1row2" },
  ];
  return buildDiscoverySequence(rows);
}
export const H3D_ADD1_TARGET_LABEL = "h3dadd1header-descricao";

// --- ADD2: total multicoluna na fronteira INFERIOR (positivo) -------------
// Total com 2 colunas populadas (DESCRICAO+TOTAL_CBDI), posicionado como a
// ÚLTIMA linha da página — imediatamente após um bloco de 3 linhas âncora
// completas. Mesmo mecanismo de ADD1, fronteira oposta.
export function caseH3dAdd2_multiColumnTotalAtLowerBoundary(): SyntheticGeometryPage {
  const rows: DiscoverySequenceLineSpec[] = [
    { kind: "full", gapRatioBefore: 0, label: "h3dadd2row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "h3dadd2row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "h3dadd2row2" },
    { kind: "two-column-sparse", gapRatioBefore: GAP_RATIO_NORMAL, label: "h3dadd2total", secondColumn: TOTAL_COLUMN },
  ];
  return buildDiscoverySequence(rows);
}
export const H3D_ADD2_TARGET_LABEL = "h3dadd2total-descricao";

// --- ADD3: rodapé de UMA coluna só na fronteira (ADVERSARIAL, negativo) ---
// Linha com um único segmento, alinhado exatamente à borda real de UMA
// coluna (ITEM), posicionada imediatamente após um bloco de 3 linhas
// âncora completas — ancorada e contida na coluna ITEM isoladamente, mas
// nunca corresponde a >= minimumRecurrentAlignmentCount(2) envelopes
// distintos. Testa que a salvaguarda extra da fronteira (§7.5) rejeita
// corretamente ruído de coluna única, distinguindo-o de ADD1/ADD2.
export function caseH3dAdd3_singleColumnFooterAtBoundaryAdversarial(): SyntheticGeometryPage {
  const rows: DiscoverySequenceLineSpec[] = [
    { kind: "full", gapRatioBefore: 0, label: "h3dadd3row0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "h3dadd3row1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "h3dadd3row2" },
    {
      kind: "description-only",
      gapRatioBefore: GAP_RATIO_NORMAL,
      label: "h3dadd3footer",
      leftPoints: ITEM_COLUMN.leftPoints,
      rightPoints: ITEM_COLUMN.rightPoints,
    },
  ];
  return buildDiscoverySequence(rows);
}
export const H3D_ADD3_TARGET_LABEL = "h3dadd3footer-continuation";
