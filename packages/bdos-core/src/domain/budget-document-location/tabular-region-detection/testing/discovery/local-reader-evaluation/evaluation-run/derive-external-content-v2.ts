/**
 * Sprint 21.4B.3A.3 — fechamento consolidado, lacuna §4.1. Deriva
 * `LocalReaderExternalContentMetric` a partir da região externa
 * esperada (verdade de referência), das regiões observadas
 * correspondentes (comparação real v2, Problema A/B) e das comparações
 * de célula reais — nunca de uma constante que ignora os dados, nunca
 * de `tool === "paddleocr"` hardcoded como em v1.
 *
 * Reaproveita `classifyLocalReaderExternalContent` (v1,
 * `discovery-local-reader-metrics.ts`, NUNCA alterada) e o mesmo
 * vocabulário de 5 desfechos (`LocalReaderExternalContentOutcome`) — não
 * redesenha a métrica, apenas corrige a origem dos dados que a
 * alimentam.
 */
import { classifyLocalReaderExternalContent } from "../discovery-local-reader-metrics";
import type { LocalReaderCellComparisonResult, LocalReaderExternalContentMetric } from "../discovery-local-reader-evaluation.types";
import type { LocalReaderRegionComponentResultV2 } from "../v2/discovery-local-reader-evaluation-v2.types";
import type { ReferenceTruthColumnRole, ReferenceTruthPhysicalRegion } from "../../reference-truth/discovery-reference-truth.types";

export function deriveExternalContentV2(
  tcuRegion: ReferenceTruthPhysicalRegion | undefined,
  regionComponents: ReadonlyArray<LocalReaderRegionComponentResultV2>,
  observedRegionTextById: ReadonlyMap<string, string>,
  cellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>,
  expectedCellColumnById: ReadonlyMap<string, string>,
  columnRoleByColumnId: ReadonlyMap<string, ReferenceTruthColumnRole>,
): LocalReaderExternalContentMetric | null {
  if (tcuRegion === undefined) return null;

  const component = regionComponents.find((c) => c.referenceRegionIds.includes(tcuRegion.id));
  if (component === undefined || component.observedRegionIds.length === 0) {
    return classifyLocalReaderExternalContent(tcuRegion.id, "omitted");
  }

  const tcuObservedTexts = new Set(component.observedRegionIds.map((id) => observedRegionTextById.get(id) ?? "").filter((text) => text.length > 0));

  // Incorporação real: um resultado de comparação de célula (não omitido,
  // não inventado) cujo texto observado é exatamente o mesmo texto que
  // casou com a região do TCU — evidência real de que o mesmo conteúdo
  // acabou dentro de uma célula tabular, nunca presumido.
  const incorporation =
    tcuObservedTexts.size === 0
      ? undefined
      : cellComparisons.find(
          (cmp) =>
            cmp.outcome !== "expected_cell_omitted" &&
            cmp.outcome !== "invented_cell" &&
            cmp.normalizedObservedText !== null &&
            tcuObservedTexts.has(cmp.normalizedObservedText) &&
            cmp.referenceCellIds.length > 0,
        );

  if (incorporation !== undefined) {
    const columnId = expectedCellColumnById.get(incorporation.referenceCellIds[0]);
    const role = columnId !== undefined ? columnRoleByColumnId.get(columnId) : undefined;
    return classifyLocalReaderExternalContent(tcuRegion.id, role === "descricao" ? "incorporated_into_item_description" : "incorporated_into_table");
  }

  return classifyLocalReaderExternalContent(tcuRegion.id, "detected_as_external_or_out_of_table");
}
