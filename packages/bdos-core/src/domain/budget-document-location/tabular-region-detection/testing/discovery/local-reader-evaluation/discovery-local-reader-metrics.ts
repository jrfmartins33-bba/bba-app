/**
 * Métricas congeladas (§9 do protocolo, Momento 3A). Uma função por
 * subseção do enunciado. Todas puras e determinísticas, operando
 * exclusivamente sobre o formato canônico e os resultados de
 * comparação já congelados — nunca sobre saída bruta de ferramenta.
 *
 * Convenções de contagem registradas aqui porque o enunciado não as
 * detalha ao nível de implementação (nunca ajustadas após observar
 * dados reais, §12):
 * - §9.3 `cellOutcomeCounts`: contado por CÉLULA ESPERADA (cada uma
 *   das células de referência cai em exatamente um balde), exceto
 *   `invented_cell`, que é contado por CÉLULA OBSERVADA (não tem
 *   contraparte esperada, portanto não participa do total de 1.019).
 * - §9.3 `columnsMerged`: contado por PAR de colunas esperadas
 *   distintas cujas células caíram no mesmo componente de fusão
 *   (fusão dentro da mesma coluna, ex. descrição multilinha, não
 *   conta como "coluna fundida").
 * - §9.2 `textWithoutCoordinate`/`coordinateWithoutText`: derivados de
 *   `hasUsableCoordinateOnBothSides` cruzado com o resultado textual
 *   do componente (ver comentário nos ramos abaixo).
 */

import type {
  LocalReaderCellComparisonResult,
  LocalReaderCellOutcomeCounts,
  LocalReaderCriticalFieldMetric,
  LocalReaderExecutionMetrics,
  LocalReaderExpectedCellRef,
  LocalReaderExternalContentMetric,
  LocalReaderExternalContentOutcome,
  LocalReaderMathEvidenceAvailability,
  LocalReaderMathEvidenceMetric,
  LocalReaderMultilineDescriptionOutcome,
  LocalReaderPageEvaluation,
  LocalReaderRegionComparisonResult,
  LocalReaderRegionTextMetrics,
  LocalReaderTableStructureMetrics,
} from "./discovery-local-reader-evaluation.types";
import type { ReferenceTruthColumnRole } from "../reference-truth/discovery-reference-truth.types";

// --- §9.1 Execução -----------------------------------------------------------

export function computeLocalReaderExecutionMetrics(pages: ReadonlyArray<LocalReaderPageEvaluation>): LocalReaderExecutionMetrics {
  const pagesCompleted = pages.filter((p) => p.finalState !== "failed").length;
  const pagesFailed = pages.filter((p) => p.finalState === "failed").length;
  const coldStartTimeMs = pages.length > 0 ? Math.max(...pages.map((p) => p.loadTimeMs)) : 0;
  const perPageTimeMs = pages.map((p) => ({ realPageNumber: p.realPageNumber, timeMs: p.processingTimeMs }));
  const peakMemoryMb = pages.length > 0 ? Math.max(...pages.map((p) => p.peakMemoryMb)) : 0;
  const warnings = pages.flatMap((p) => p.warnings);
  const partialFailures = pages.filter((p) => p.finalState === "completed_with_warnings").map((p) => `página ${p.realPageNumber}: ${p.warnings.join("; ")}`);
  return { pagesCompleted, pagesFailed, coldStartTimeMs, perPageTimeMs, peakMemoryMb, warnings, partialFailures };
}

// --- §9.2 Regiões e texto -----------------------------------------------------

export function computeLocalReaderRegionTextMetrics(comparisons: ReadonlyArray<LocalReaderRegionComparisonResult>): LocalReaderRegionTextMetrics {
  let expectedRegionsRecovered = 0;
  let regionsOmitted = 0;
  let regionsAdditional = 0;
  let exactTextMatches = 0;
  let divergentText = 0;
  let textWithoutCoordinate = 0;
  let coordinateWithoutText = 0;

  for (const c of comparisons) {
    switch (c.outcome) {
      case "recovered":
        expectedRegionsRecovered += 1;
        if (c.hasUsableCoordinateOnBothSides) exactTextMatches += 1;
        else textWithoutCoordinate += 1;
        break;
      case "omitted":
        regionsOmitted += 1;
        break;
      case "additional":
        regionsAdditional += 1;
        break;
      case "text_divergent":
        divergentText += 1;
        if (c.hasUsableCoordinateOnBothSides) coordinateWithoutText += 1;
        break;
    }
  }

  return { expectedRegionsRecovered, regionsOmitted, regionsAdditional, exactTextMatches, divergentText, textWithoutCoordinate, coordinateWithoutText };
}

// --- §9.3 Tabelas, linhas, colunas e células ----------------------------------

const EMPTY_CELL_OUTCOME_COUNTS: LocalReaderCellOutcomeCounts = {
  direct_match: 0,
  expected_cell_split_into_multiple_observed: 0,
  multiple_expected_cells_merged: 0,
  expected_cell_omitted: 0,
  invented_cell: 0,
  correct_text_wrong_column: 0,
  correct_text_no_usable_coordinate: 0,
  correct_coordinate_wrong_text: 0,
};

export function computeLocalReaderTableStructureMetrics(
  expectedCells: ReadonlyArray<LocalReaderExpectedCellRef>,
  cellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>,
  tablesDetected: number,
  rowsDetected: number,
): LocalReaderTableStructureMetrics {
  const columnIdByCellId = new Map(expectedCells.map((e) => [e.id, e.columnId]));
  const cellOutcomeCounts: { -readonly [K in keyof LocalReaderCellOutcomeCounts]: number } = { ...EMPTY_CELL_OUTCOME_COUNTS };
  const recoveredColumns = new Set<string>();
  const splitColumns = new Set<string>();
  const mergedColumnPairs = new Set<string>();
  let cellsTotal = 0;

  for (const c of cellComparisons) {
    if (c.outcome === "invented_cell") {
      cellOutcomeCounts.invented_cell += c.observedCellIds.length;
      continue;
    }
    cellOutcomeCounts[c.outcome] += c.referenceCellIds.length;
    cellsTotal += c.referenceCellIds.length;

    const cols = c.referenceCellIds.map((id) => columnIdByCellId.get(id)).filter((v): v is string => v !== undefined);
    if (c.outcome === "direct_match") cols.forEach((col) => recoveredColumns.add(col));
    if (c.outcome === "expected_cell_split_into_multiple_observed") cols.forEach((col) => splitColumns.add(col));
    if (c.outcome === "multiple_expected_cells_merged") {
      const distinctCols = [...new Set(cols)];
      for (let i = 0; i < distinctCols.length; i += 1) {
        for (let j = i + 1; j < distinctCols.length; j += 1) {
          mergedColumnPairs.add([distinctCols[i], distinctCols[j]].sort().join("|"));
        }
      }
    }
  }

  return {
    tablesDetected,
    expectedColumnsRecovered: recoveredColumns.size,
    expectedColumnsTotal: 12,
    columnsSplit: splitColumns.size,
    columnsMerged: mergedColumnPairs.size,
    rowsDetected,
    cellOutcomeCounts,
    cellsTotal,
  };
}

// --- §9.4 Campos críticos dos 80 itens -----------------------------------------

export interface LocalReaderCriticalFieldOutcome {
  readonly literalMatch: boolean;
  readonly exactDecimalValueMatch: boolean | null;
}

const NUMERIC_CRITICAL_ROLES: ReadonlySet<ReferenceTruthColumnRole> = new Set(["quantidade", "custo_unitario_sem_bdi", "bdi_percentual", "preco_unitario_com_bdi", "preco_total_com_bdi"]);

export function computeLocalReaderCriticalFieldMetric(role: ReferenceTruthColumnRole, itemsTotal: number, outcomes: ReadonlyArray<LocalReaderCriticalFieldOutcome>): LocalReaderCriticalFieldMetric {
  const literalMatches = outcomes.filter((o) => o.literalMatch).length;
  const isNumeric = NUMERIC_CRITICAL_ROLES.has(role);
  const exactDecimalValueMatches = isNumeric ? outcomes.filter((o) => o.exactDecimalValueMatch === true).length : null;
  const mismatches = itemsTotal - literalMatches;
  return { role, itemsTotal, literalMatches, exactDecimalValueMatches, mismatches };
}

// --- §9.5 Descrições multilinha ------------------------------------------------

export function classifyLocalReaderMultilineDescription(
  expectedLinesInOrder: ReadonlyArray<string>,
  observedLinesInOrder: ReadonlyArray<string>,
  splitAcrossIncompatibleCells: boolean,
  mergedWithNeighborItemText: string | null,
): LocalReaderMultilineDescriptionOutcome {
  if (observedLinesInOrder.length === 0) return "omitted";
  if (mergedWithNeighborItemText !== null) return "merged_with_neighbor_item";
  if (splitAcrossIncompatibleCells) return "split_into_incompatible_cells";

  const expectedEqualsObserved = expectedLinesInOrder.length === observedLinesInOrder.length && expectedLinesInOrder.every((line, i) => line === observedLinesInOrder[i]);
  if (expectedEqualsObserved) return "fully_preserved";

  const expectedMultiset = [...expectedLinesInOrder].sort();
  const observedMultiset = [...observedLinesInOrder].sort();
  const sameMultiset = expectedMultiset.length === observedMultiset.length && expectedMultiset.every((line, i) => line === observedMultiset[i]);
  if (sameMultiset) return "lines_out_of_order";

  return "partially_preserved";
}

// --- §9.6 Conteúdo externo (bloco do TCU, página 46) ---------------------------

export function classifyLocalReaderExternalContent(regionId: string, outcome: LocalReaderExternalContentOutcome): LocalReaderExternalContentMetric {
  const isCriticalRisk = outcome === "incorporated_into_item_description" || outcome === "incorporated_into_table";
  return { regionId, outcome, isCriticalRisk };
}

// --- §9.7 Evidência matemática disponível --------------------------------------

export type LocalReaderMathEvidenceFieldKey = "quantity" | "unitPrice" | "total" | "subtotalOrTotal";

const MATH_EVIDENCE_FIELD_LABELS_PT: Record<LocalReaderMathEvidenceFieldKey, string> = {
  quantity: "quantidade",
  unitPrice: "preço unitário",
  total: "total",
  subtotalOrTotal: "subtotal ou total oficial aplicável",
};

export function classifyLocalReaderMathEvidence(
  mathRelationId: string,
  fieldsPresent: Record<LocalReaderMathEvidenceFieldKey, boolean>,
  fieldsDivergentFromSource: ReadonlyArray<LocalReaderMathEvidenceFieldKey>,
): LocalReaderMathEvidenceMetric {
  const missingFieldsPt = (Object.keys(fieldsPresent) as LocalReaderMathEvidenceFieldKey[]).filter((k) => !fieldsPresent[k]).map((k) => MATH_EVIDENCE_FIELD_LABELS_PT[k]);

  let availability: LocalReaderMathEvidenceAvailability;
  let divergenceDescriptionPt: string | null = null;
  if (fieldsDivergentFromSource.length > 0) {
    availability = "evidencia_divergente_da_fonte";
    divergenceDescriptionPt = `Campo(s) divergente(s) da fonte: ${fieldsDivergentFromSource.map((k) => MATH_EVIDENCE_FIELD_LABELS_PT[k]).join(", ")}.`;
  } else if (missingFieldsPt.length === 0) {
    availability = "evidencia_completa";
  } else if (missingFieldsPt.length === Object.keys(fieldsPresent).length) {
    availability = "evidencia_ausente";
  } else {
    availability = "evidencia_parcial";
  }

  return { mathRelationId, availability, missingFieldsPt, divergenceDescriptionPt };
}
