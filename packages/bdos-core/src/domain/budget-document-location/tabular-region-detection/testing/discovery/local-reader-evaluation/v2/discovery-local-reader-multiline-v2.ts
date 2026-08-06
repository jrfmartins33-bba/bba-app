/**
 * Problema C (Sprint 21.4B.3A.3, Momento 3C.1 → implementado no Momento
 * 3C.2A). Assinatura e algoritmo congelados em
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`
 * §5. Deriva os três argumentos de `classifyLocalReaderMultilineDescription`
 * (v1, `discovery-local-reader-metrics.ts`, NUNCA alterada) a partir de
 * comparações de célula reais — nunca de `[]`/`false`/`null` fixos como em
 * `run-local-reader-evaluation.ts` (v1).
 *
 * Nenhum fuzzy matching, nenhuma coordenada reconstruída, nenhum uso
 * direto de conteúdo bruto do PaddleOCR, nenhuma regra específica de
 * página, nenhum código/descrição do Lagoa do Arroz hardcoded, nenhuma
 * correção de OCR — toda a derivação usa exclusivamente os `outcome` já
 * produzidos pela comparação de células congelada (v1).
 *
 * Decisão de interpretação registrada (não coberta literalmente pelo
 * texto do §5): quando `multiple_expected_cells_merged` agrupa
 * exclusivamente células de descrição da PRÓPRIA linha (nunca de uma
 * linha vizinha), nenhuma linha é contribuída e `mergedWithNeighborItemText`
 * permanece `null` — apenas fusão com uma linha vizinha é sinalizada,
 * como o §5 define explicitamente. Uma fusão puramente interna à mesma
 * linha reduz naturalmente o total de linhas observadas, refletido no
 * desfecho `partially_preserved` de `classifyLocalReaderMultilineDescription`
 * (v1) sem necessidade de um sinal adicional.
 *
 * Correção descoberta na implementação (não presumível a partir do texto
 * do §5 sozinho): `classifyLocalReaderMultilineDescription` (v1,
 * `discovery-local-reader-metrics.ts`) verifica
 * `observedLinesInOrder.length === 0 → "omitted"` ANTES de verificar
 * `mergedWithNeighborItemText !== null → "merged_with_neighbor_item"`.
 * Uma fusão com vizinho que não contribuísse nenhuma linha resultaria
 * sempre em `"omitted"`, nunca em `"merged_with_neighbor_item"` — o
 * desfecho ficaria estruturalmente inalcançável. Por isso, quando a
 * fusão referencia uma linha vizinha, o texto fundido É contribuído como
 * linha (única exceção à regra "fusão não contribui linha" acima).
 */

import type { LocalReaderCellComparisonResult } from "../discovery-local-reader-evaluation.types";
import type { ReferenceTruthPageBundle } from "../../reference-truth/discovery-reference-truth.types";
import type { LocalReaderMultilineObservedInputV2 } from "./discovery-local-reader-evaluation-v2.types";

export function deriveObservedDescriptionLinesV2(
  bundle: ReferenceTruthPageBundle,
  logicalRowId: string,
  cellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>,
): LocalReaderMultilineObservedInputV2 {
  const descriptionCells = bundle.cells.filter((c) => c.logicalRowId === logicalRowId && c.columnId === "col-descricao").sort((a, b) => a.id.localeCompare(b.id));

  const itemRowsOnPage = bundle.logicalRows.filter((r) => r.type === "item_de_servico").sort((a, b) => a.id.localeCompare(b.id));
  const rowIndex = itemRowsOnPage.findIndex((r) => r.id === logicalRowId);
  const neighborRowIds = new Set<string>();
  if (rowIndex > 0) neighborRowIds.add(itemRowsOnPage[rowIndex - 1].id);
  if (rowIndex >= 0 && rowIndex < itemRowsOnPage.length - 1) neighborRowIds.add(itemRowsOnPage[rowIndex + 1].id);

  const observedLinesInOrder: string[] = [];
  let splitAcrossIncompatibleCells = false;
  let mergedWithNeighborItemText: string | null = null;

  for (const cell of descriptionCells) {
    const result = cellComparisons.find((c) => c.referenceCellIds.includes(cell.id));
    if (result === undefined) continue; // nenhuma comparação encontrada — nenhuma linha contribuída

    if (result.outcome === "direct_match") {
      observedLinesInOrder.push(result.normalizedObservedText ?? "");
    } else if (result.outcome === "expected_cell_split_into_multiple_observed") {
      observedLinesInOrder.push(result.normalizedObservedText ?? "");
      splitAcrossIncompatibleCells = true;
    } else if (result.outcome === "multiple_expected_cells_merged") {
      const referencesNeighborRow = result.referenceCellIds.some((rid) => {
        const otherCell = bundle.cells.find((c) => c.id === rid);
        return otherCell !== undefined && otherCell.logicalRowId !== logicalRowId && neighborRowIds.has(otherCell.logicalRowId);
      });
      if (referencesNeighborRow) {
        if (mergedWithNeighborItemText === null) mergedWithNeighborItemText = result.normalizedObservedText ?? null;
        // contribui a linha fundida — necessário para que "merged_with_neighbor_item"
        // seja alcançável (ver "Correção descoberta na implementação" no cabeçalho).
        observedLinesInOrder.push(result.normalizedObservedText ?? "");
      }
      // fusão puramente interna à própria linha (sem vizinho): nenhuma linha contribuída (ver decisão de interpretação no cabeçalho)
    }
    // expected_cell_omitted e demais desfechos: nenhuma linha contribuída
  }

  return { observedLinesInOrder, splitAcrossIncompatibleCells, mergedWithNeighborItemText };
}
