/**
 * Testes de integridade do protocolo de avaliação de leitores locais
 * (Sprint 21.4B.3A.3, Momento 3A). Exclusivamente sintético — nenhuma
 * saída real de Docling ou PaddleOCR aparece neste arquivo ou em
 * qualquer módulo irmão (verificado por varredura de arquivo, último
 * teste). Ver
 * `packages/bdos-core/docs/EPIC_21_SPRINT_4B3A3_MOMENTO3A_LOCAL_READER_EVALUATION_PROTOCOL.md`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { convertLocalReaderBoundingBox } from "./discovery-local-reader-coordinates";
import { associateObservedCellsToReference, associateObservedRegionsToReference, boxesOverlapStrictly } from "./discovery-local-reader-comparison";
import {
  classifyLocalReaderExternalContent,
  classifyLocalReaderMathEvidence,
  classifyLocalReaderMultilineDescription,
  computeLocalReaderCriticalFieldMetric,
  computeLocalReaderExecutionMetrics,
  computeLocalReaderRegionTextMetrics,
  computeLocalReaderTableStructureMetrics,
} from "./discovery-local-reader-metrics";
import { computeLocalReaderTextualDistance, normalizeLocalReaderText } from "./discovery-local-reader-normalization";
import { NONSEMANTIC_PROPERTY_ORDER_DIFFERENCE_PATH, classifyLocalReaderRepetitionDifference } from "./discovery-local-reader-repetition";
import { classifyLocalReaderViability } from "./discovery-local-reader-viability";
import type {
  LocalReaderConvertedBoundingBox,
  LocalReaderExpectedCellRef,
  LocalReaderExpectedRegionRef,
  LocalReaderObservedCellRef,
  LocalReaderObservedRegionRef,
  LocalReaderPageEvaluation,
  LocalReaderPageGeometry,
  LocalReaderViabilityGateInputs,
} from "./discovery-local-reader-evaluation.types";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertClose(actual: number, expected: number, epsilon: number, message?: string): void {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message ?? "values differ"}: expected ~${expected} (±${epsilon}), got ${actual}`);
  }
}

// Fatos de página já congelados (Momento 2, `discovery-reference-truth-document.ts`)
// — reutilizados aqui apenas como geometria de página, nunca como saída de leitor.
const PAGE_GEOMETRY: LocalReaderPageGeometry = { pageWidthPoints: 1190.52, pageHeightPoints: 841.92, renderingResolutionDpi: 200 };

const box = (leftPoints: number, topPoints: number, rightPoints: number, bottomPoints: number): LocalReaderConvertedBoundingBox => ({ leftPoints, topPoints, rightPoints, bottomPoints });

// --- §6 Normalização de texto ------------------------------------------------

runTest("normalização: NFC — forma composta e decomposta do mesmo caractere produzem o mesmo resultado", () => {
  const decomposed = "Descrição"; // ç e ã construídos por combinação
  const composed = "Descriçã" + "o".normalize("NFC");
  assertEqual(normalizeLocalReaderText(decomposed), normalizeLocalReaderText("Descrição"), "forma decomposta deveria normalizar igual à forma composta de referência");
  assertEqual(normalizeLocalReaderText(composed), normalizeLocalReaderText("Descrição"));
});

runTest("normalização: remove espaços nas extremidades e colapsa espaço/tab horizontal interno", () => {
  assertEqual(normalizeLocalReaderText("  01.00.00   SERVIÇOS\t\tPRELIMINARES  "), "01.00.00 SERVIÇOS PRELIMINARES");
});

runTest("normalização: quebras de linha \\r\\n e \\r viram \\n, preservando linhas múltiplas", () => {
  assertEqual(normalizeLocalReaderText("linha 1\r\nlinha 2\rlinha 3"), "linha 1\nlinha 2\nlinha 3");
});

runTest("normalização: NUNCA corrige ortografia, símbolo monetário, vírgula decimal ou código — texto preservado literalmente", () => {
  assertEqual(normalizeLocalReaderText("R$ 1.234,56"), "R$ 1.234,56");
  assertEqual(normalizeLocalReaderText("01.01.04-A"), "01.01.04-A");
  assertEqual(normalizeLocalReaderText("descriçao errada propositalmente"), "descriçao errada propositalmente");
});

runTest("distância textual: 0 para textos idênticos; valor conhecido para exemplo pequeno; exclusivamente informativa", () => {
  assertEqual(computeLocalReaderTextualDistance("abc", "abc"), 0);
  assertEqual(computeLocalReaderTextualDistance("gato", "pato"), 1);
  assertEqual(computeLocalReaderTextualDistance("", "abc"), 3);
  assertEqual(computeLocalReaderTextualDistance("abc", ""), 3);
});

// --- §7 Mapeamento de coordenadas --------------------------------------------

runTest("coordenadas: canto superior esquerdo em pixels (origem top_left) converte próximo de (0,0)", () => {
  const result = convertLocalReaderBoundingBox({ originConvention: "top_left", unit: "pixels", xMin: 0, yMin: 0, xMax: 1, yMax: 1 }, PAGE_GEOMETRY);
  assert(result.box !== null, "conversão não deveria ser interrompida");
  assertClose(result.box!.leftPoints, 0, 0.01);
  assertClose(result.box!.topPoints, 0, 0.01);
});

runTest("coordenadas: canto superior direito em pixels aproxima a largura da página em pontos", () => {
  const result = convertLocalReaderBoundingBox({ originConvention: "top_left", unit: "pixels", xMin: 3307, yMin: 0, xMax: 3308, yMax: 1 }, PAGE_GEOMETRY);
  assertClose(result.box!.rightPoints, PAGE_GEOMETRY.pageWidthPoints, 1);
});

runTest("coordenadas: canto inferior esquerdo em pixels aproxima a altura da página em pontos", () => {
  const result = convertLocalReaderBoundingBox({ originConvention: "top_left", unit: "pixels", xMin: 0, yMin: 2338, xMax: 1, yMax: 2339 }, PAGE_GEOMETRY);
  assertClose(result.box!.bottomPoints, PAGE_GEOMETRY.pageHeightPoints, 1);
});

runTest("coordenadas: canto inferior direito em pixels aproxima largura e altura simultaneamente", () => {
  const result = convertLocalReaderBoundingBox({ originConvention: "top_left", unit: "pixels", xMin: 3307, yMin: 2338, xMax: 3308, yMax: 2339 }, PAGE_GEOMETRY);
  assertClose(result.box!.rightPoints, PAGE_GEOMETRY.pageWidthPoints, 1);
  assertClose(result.box!.bottomPoints, PAGE_GEOMETRY.pageHeightPoints, 1);
});

runTest("coordenadas: centro da página em pixels aproxima metade da largura e da altura em pontos", () => {
  const result = convertLocalReaderBoundingBox({ originConvention: "top_left", unit: "pixels", xMin: 1653, yMin: 1168, xMax: 1655, yMax: 1170 }, PAGE_GEOMETRY);
  assertClose(result.box!.leftPoints, PAGE_GEOMETRY.pageWidthPoints / 2, 1);
  assertClose(result.box!.topPoints, PAGE_GEOMETRY.pageHeightPoints / 2, 1);
});

runTest("coordenadas: caixa integral da página em pixels converte para aproximadamente a página inteira em pontos", () => {
  const result = convertLocalReaderBoundingBox({ originConvention: "top_left", unit: "pixels", xMin: 0, yMin: 0, xMax: 3308, yMax: 2339 }, PAGE_GEOMETRY);
  assertClose(result.box!.leftPoints, 0, 0.01);
  assertClose(result.box!.topPoints, 0, 0.01);
  assertClose(result.box!.rightPoints, PAGE_GEOMETRY.pageWidthPoints, 1);
  assertClose(result.box!.bottomPoints, PAGE_GEOMETRY.pageHeightPoints, 1);
});

runTest("coordenadas: fator de conversão pixel→ponto é exatamente 72/DPI", () => {
  const result = convertLocalReaderBoundingBox({ originConvention: "top_left", unit: "pixels", xMin: 100, yMin: 0, xMax: 200, yMax: 0 }, PAGE_GEOMETRY);
  assertClose(result.box!.leftPoints, 100 * (72 / 200), 1e-9);
  assertClose(result.box!.rightPoints, 200 * (72 / 200), 1e-9);
});

runTest("coordenadas: unidade em pontos não é reescalada", () => {
  const result = convertLocalReaderBoundingBox({ originConvention: "top_left", unit: "points", xMin: 100, yMin: 50, xMax: 200, yMax: 150 }, PAGE_GEOMETRY);
  assertEqual(result.box!.leftPoints, 100);
  assertEqual(result.box!.topPoints, 50);
  assertEqual(result.box!.rightPoints, 200);
  assertEqual(result.box!.bottomPoints, 150);
});

runTest("coordenadas: inversão vertical — origem bottom_left produz topPoints/bottomPoints espelhados pela altura da página", () => {
  const topLeftResult = convertLocalReaderBoundingBox({ originConvention: "top_left", unit: "points", xMin: 0, yMin: 100, xMax: 10, yMax: 200 }, PAGE_GEOMETRY);
  const bottomLeftResult = convertLocalReaderBoundingBox({ originConvention: "bottom_left", unit: "points", xMin: 0, yMin: 100, xMax: 10, yMax: 200 }, PAGE_GEOMETRY);
  assertEqual(topLeftResult.box!.topPoints, 100);
  assertEqual(topLeftResult.box!.bottomPoints, 200);
  assertEqual(bottomLeftResult.box!.topPoints, PAGE_GEOMETRY.pageHeightPoints - 200);
  assertEqual(bottomLeftResult.box!.bottomPoints, PAGE_GEOMETRY.pageHeightPoints - 100);
});

runTest("coordenadas: convenção de origem desconhecida interrompe a métrica espacial, nunca adivinha", () => {
  const result = convertLocalReaderBoundingBox({ originConvention: "unknown", unit: "points", xMin: 0, yMin: 0, xMax: 10, yMax: 10 }, PAGE_GEOMETRY);
  assertEqual(result.box, null);
  assert(result.interruptedPt !== null && result.interruptedPt.length > 0, "razão da interrupção deveria estar preenchida");
});

runTest("coordenadas: unidade desconhecida interrompe a métrica espacial, nunca adivinha", () => {
  const result = convertLocalReaderBoundingBox({ originConvention: "top_left", unit: "unknown", xMin: 0, yMin: 0, xMax: 10, yMax: 10 }, PAGE_GEOMETRY);
  assertEqual(result.box, null);
  assert(result.interruptedPt !== null && result.interruptedPt.length > 0, "razão da interrupção deveria estar preenchida");
});

// --- §8 Algoritmo de comparação (células) ------------------------------------

runTest("comparação de células: correspondência direta 1:1 (mesma página, sobreposição espacial, texto idêntico, mesma coluna)", () => {
  const expected: LocalReaderExpectedCellRef[] = [{ id: "ref-1", realPageNumber: 46, columnId: "col-quantidade", normalizedText: "12,50", boundingBox: box(0, 0, 10, 10) }];
  const observed: LocalReaderObservedCellRef[] = [{ id: "obs-1", realPageNumber: 46, columnId: "col-quantidade", normalizedText: "12,50", boundingBox: box(1, 1, 9, 9) }];
  const results = associateObservedCellsToReference(expected, observed);
  assertEqual(results.length, 1);
  assertEqual(results[0].outcome, "direct_match");
});

runTest("comparação de células: uma célula esperada dividida em múltiplas observadas", () => {
  const expected: LocalReaderExpectedCellRef[] = [{ id: "ref-1", realPageNumber: 46, columnId: "col-descricao", normalizedText: "ABC DEF", boundingBox: box(0, 0, 20, 10) }];
  const observed: LocalReaderObservedCellRef[] = [
    { id: "obs-1", realPageNumber: 46, columnId: "col-descricao", normalizedText: "ABC", boundingBox: box(0, 0, 9, 10) },
    { id: "obs-2", realPageNumber: 46, columnId: "col-descricao", normalizedText: "DEF", boundingBox: box(11, 0, 20, 10) },
  ];
  const results = associateObservedCellsToReference(expected, observed);
  assertEqual(results.length, 1);
  assertEqual(results[0].outcome, "expected_cell_split_into_multiple_observed");
  assertEqual(results[0].observedCellIds.length, 2);
});

runTest("comparação de células: múltiplas células esperadas fundidas em uma única observada", () => {
  const expected: LocalReaderExpectedCellRef[] = [
    { id: "ref-1", realPageNumber: 46, columnId: "col-custo-sbdi", normalizedText: "100,00", boundingBox: box(0, 0, 10, 10) },
    { id: "ref-2", realPageNumber: 46, columnId: "col-bdi", normalizedText: "20%", boundingBox: box(10, 0, 20, 10) },
  ];
  const observed: LocalReaderObservedCellRef[] = [{ id: "obs-1", realPageNumber: 46, columnId: null, normalizedText: "100,00 20%", boundingBox: box(0, 0, 20, 10) }];
  const results = associateObservedCellsToReference(expected, observed);
  assertEqual(results.length, 1);
  assertEqual(results[0].outcome, "multiple_expected_cells_merged");
  assertEqual(results[0].referenceCellIds.length, 2);
});

runTest("comparação de células: célula esperada omitida — nenhuma correspondência espacial ou textual", () => {
  const expected: LocalReaderExpectedCellRef[] = [{ id: "ref-1", realPageNumber: 46, columnId: "col-item", normalizedText: "01.01.01", boundingBox: box(0, 0, 10, 10) }];
  const observed: LocalReaderObservedCellRef[] = [{ id: "obs-1", realPageNumber: 46, columnId: "col-item", normalizedText: "99.99.99", boundingBox: box(500, 500, 510, 510) }];
  const results = associateObservedCellsToReference(expected, observed);
  const omitted = results.filter((r) => r.outcome === "expected_cell_omitted");
  assertEqual(omitted.length, 1);
  assertEqual(omitted[0].referenceCellIds[0], "ref-1");
});

runTest("comparação de células: célula inventada — observada sem nenhuma contraparte esperada", () => {
  const expected: LocalReaderExpectedCellRef[] = [{ id: "ref-1", realPageNumber: 46, columnId: "col-item", normalizedText: "01.01.01", boundingBox: box(0, 0, 10, 10) }];
  const observed: LocalReaderObservedCellRef[] = [{ id: "obs-1", realPageNumber: 46, columnId: "col-item", normalizedText: "01.01.01", boundingBox: box(1, 1, 9, 9) }, { id: "obs-2", realPageNumber: 46, columnId: null, normalizedText: "texto sem origem", boundingBox: box(900, 900, 910, 910) }];
  const results = associateObservedCellsToReference(expected, observed);
  const invented = results.filter((r) => r.outcome === "invented_cell");
  assertEqual(invented.length, 1);
  assertEqual(invented[0].observedCellIds[0], "obs-2");
});

runTest("comparação de células: texto correto em coluna errada", () => {
  const expected: LocalReaderExpectedCellRef[] = [{ id: "ref-1", realPageNumber: 46, columnId: "col-unit-cbdi", normalizedText: "1.500,00", boundingBox: box(0, 0, 10, 10) }];
  const observed: LocalReaderObservedCellRef[] = [{ id: "obs-1", realPageNumber: 46, columnId: "col-total-cbdi", normalizedText: "1.500,00", boundingBox: null }];
  const results = associateObservedCellsToReference(expected, observed);
  assertEqual(results.length, 1);
  assertEqual(results[0].outcome, "correct_text_wrong_column");
});

runTest("comparação de células: texto correto sem coordenada utilizável", () => {
  const expected: LocalReaderExpectedCellRef[] = [{ id: "ref-1", realPageNumber: 46, columnId: "col-fonte", normalizedText: "SINAPI", boundingBox: box(0, 0, 10, 10) }];
  const observed: LocalReaderObservedCellRef[] = [{ id: "obs-1", realPageNumber: 46, columnId: "col-fonte", normalizedText: "SINAPI", boundingBox: null }];
  const results = associateObservedCellsToReference(expected, observed);
  assertEqual(results.length, 1);
  assertEqual(results[0].outcome, "correct_text_no_usable_coordinate");
});

runTest("comparação de células: coordenada correta com texto incorreto", () => {
  const expected: LocalReaderExpectedCellRef[] = [{ id: "ref-1", realPageNumber: 46, columnId: "col-unidade", normalizedText: "M2", boundingBox: box(0, 0, 10, 10) }];
  const observed: LocalReaderObservedCellRef[] = [{ id: "obs-1", realPageNumber: 46, columnId: "col-unidade", normalizedText: "M3", boundingBox: box(1, 1, 9, 9) }];
  const results = associateObservedCellsToReference(expected, observed);
  assertEqual(results.length, 1);
  assertEqual(results[0].outcome, "correct_coordinate_wrong_text");
});

runTest("comparação de células: mesma página é obrigatória — nenhuma correspondência entre páginas diferentes", () => {
  const expected: LocalReaderExpectedCellRef[] = [{ id: "ref-1", realPageNumber: 46, columnId: "col-item", normalizedText: "IGUAL", boundingBox: box(0, 0, 10, 10) }];
  const observed: LocalReaderObservedCellRef[] = [{ id: "obs-1", realPageNumber: 50, columnId: "col-item", normalizedText: "IGUAL", boundingBox: box(0, 0, 10, 10) }];
  const results = associateObservedCellsToReference(expected, observed);
  assertEqual(results.length, 2);
  assert(results.every((r) => r.outcome === "expected_cell_omitted" || r.outcome === "invented_cell"), "resultados entre páginas diferentes deveriam ser omitida/inventada, nunca correspondência");
});

runTest("comparação de células: determinismo — duas execuções sobre a mesma entrada produzem exatamente o mesmo resultado serializado", () => {
  const expected: LocalReaderExpectedCellRef[] = [
    { id: "ref-1", realPageNumber: 46, columnId: "col-quantidade", normalizedText: "12,50", boundingBox: box(0, 0, 10, 10) },
    { id: "ref-2", realPageNumber: 46, columnId: "col-unidade", normalizedText: "M2", boundingBox: box(20, 0, 30, 10) },
  ];
  const observed: LocalReaderObservedCellRef[] = [
    { id: "obs-1", realPageNumber: 46, columnId: "col-quantidade", normalizedText: "12,50", boundingBox: box(1, 1, 9, 9) },
    { id: "obs-2", realPageNumber: 46, columnId: "col-unidade", normalizedText: "M2", boundingBox: box(21, 1, 29, 9) },
  ];
  const first = JSON.stringify(associateObservedCellsToReference(expected, observed));
  const second = JSON.stringify(associateObservedCellsToReference(expected, observed));
  assertEqual(first, second);
});

runTest("compatibilidade espacial estrita: caixas apenas tangentes (sem área de sobreposição) não são compatíveis", () => {
  assertEqual(boxesOverlapStrictly(box(0, 0, 10, 10), box(10, 0, 20, 10)), false, "caixas que apenas tocam a borda não sobrepõem estritamente");
  assertEqual(boxesOverlapStrictly(box(0, 0, 10, 10), box(5, 5, 15, 15)), true);
});

// --- §9.2 Comparação de regiões -----------------------------------------------

runTest("comparação de regiões: recuperada, omitida, adicional e texto divergente", () => {
  const expected: LocalReaderExpectedRegionRef[] = [
    { id: "reg-ref-1", realPageNumber: 46, normalizedText: "TÍTULO", boundingBox: box(0, 0, 10, 10) },
    { id: "reg-ref-2", realPageNumber: 46, normalizedText: "RODAPÉ", boundingBox: box(0, 800, 10, 810) },
    { id: "reg-ref-3", realPageNumber: 46, normalizedText: "NOTA EXTERNA", boundingBox: box(0, 400, 10, 410) },
  ];
  const observed: LocalReaderObservedRegionRef[] = [
    { id: "reg-obs-1", realPageNumber: 46, normalizedText: "TÍTULO", boundingBox: box(1, 1, 9, 9) },
    { id: "reg-obs-2", realPageNumber: 46, normalizedText: "NOTA DIFERENTE", boundingBox: box(1, 401, 9, 409) },
    { id: "reg-obs-3", realPageNumber: 46, normalizedText: "REGIÃO SEM REFERÊNCIA", boundingBox: box(200, 200, 210, 210) },
  ];
  const results = associateObservedRegionsToReference(expected, observed);
  const outcomeOf = (refId: string) => results.find((r) => r.referenceRegionIds.includes(refId))?.outcome;
  assertEqual(outcomeOf("reg-ref-1"), "recovered");
  assertEqual(outcomeOf("reg-ref-2"), "omitted");
  assertEqual(outcomeOf("reg-ref-3"), "text_divergent");
  assert(results.some((r) => r.outcome === "additional" && r.observedRegionIds.includes("reg-obs-3")), "reg-obs-3 deveria ser classificada como adicional");
});

// --- §9.1 Métricas de execução -------------------------------------------------

runTest("métricas de execução: agregação de páginas concluídas/falhas, tempo a frio, memória máxima e avisos", () => {
  const pages: LocalReaderPageEvaluation[] = [
    { tool: "docling", toolVersion: "x", configurationSummaryPt: "-", imageHashSha256: "h46", realPageNumber: 46, loadTimeMs: 1000, processingTimeMs: 5000, peakMemoryMb: 500, finalState: "completed", errors: [], warnings: [] },
    { tool: "docling", toolVersion: "x", configurationSummaryPt: "-", imageHashSha256: "h50", realPageNumber: 50, loadTimeMs: 900, processingTimeMs: 6000, peakMemoryMb: 700, finalState: "completed_with_warnings", errors: [], warnings: ["aviso X"] },
    { tool: "docling", toolVersion: "x", configurationSummaryPt: "-", imageHashSha256: "h54", realPageNumber: 54, loadTimeMs: 950, processingTimeMs: 4000, peakMemoryMb: 300, finalState: "failed", errors: ["erro Y"], warnings: [] },
  ];
  const metrics = computeLocalReaderExecutionMetrics(pages);
  assertEqual(metrics.pagesCompleted, 2);
  assertEqual(metrics.pagesFailed, 1);
  assertEqual(metrics.coldStartTimeMs, 1000);
  assertEqual(metrics.peakMemoryMb, 700);
  assertEqual(metrics.warnings.length, 1);
  assertEqual(metrics.partialFailures.length, 1);
});

// --- §9.2 Métricas de regiões e texto ------------------------------------------

runTest("métricas de regiões: contagens derivadas corretamente de recuperada/omitida/adicional/divergente e disponibilidade de coordenada", () => {
  const metrics = computeLocalReaderRegionTextMetrics([
    { id: "c1", referenceRegionIds: ["r1"], observedRegionIds: ["o1"], outcome: "recovered", hasUsableCoordinateOnBothSides: true },
    { id: "c2", referenceRegionIds: ["r2"], observedRegionIds: ["o2"], outcome: "recovered", hasUsableCoordinateOnBothSides: false },
    { id: "c3", referenceRegionIds: ["r3"], observedRegionIds: [], outcome: "omitted", hasUsableCoordinateOnBothSides: false },
    { id: "c4", referenceRegionIds: [], observedRegionIds: ["o4"], outcome: "additional", hasUsableCoordinateOnBothSides: false },
    { id: "c5", referenceRegionIds: ["r5"], observedRegionIds: ["o5"], outcome: "text_divergent", hasUsableCoordinateOnBothSides: true },
  ]);
  assertEqual(metrics.expectedRegionsRecovered, 2);
  assertEqual(metrics.regionsOmitted, 1);
  assertEqual(metrics.regionsAdditional, 1);
  assertEqual(metrics.exactTextMatches, 1);
  assertEqual(metrics.textWithoutCoordinate, 1);
  assertEqual(metrics.divergentText, 1);
  assertEqual(metrics.coordinateWithoutText, 1);
});

// --- §9.3 Métricas de estrutura tabular -----------------------------------------

runTest("métricas de tabela: cellOutcomeCounts, colunas recuperadas/fundidas (fusão intra-coluna não conta) e cellsTotal", () => {
  const expectedCells: LocalReaderExpectedCellRef[] = [
    { id: "ref-1", realPageNumber: 46, columnId: "col-quantidade", normalizedText: "1", boundingBox: box(0, 0, 10, 10) },
    { id: "ref-2", realPageNumber: 46, columnId: "col-descricao", normalizedText: "linha 1", boundingBox: box(20, 0, 30, 10) },
    { id: "ref-3", realPageNumber: 46, columnId: "col-descricao", normalizedText: "linha 2", boundingBox: box(30, 0, 40, 10) },
    { id: "ref-4", realPageNumber: 46, columnId: "col-custo-sbdi", normalizedText: "100", boundingBox: box(50, 0, 60, 10) },
    { id: "ref-5", realPageNumber: 46, columnId: "col-bdi", normalizedText: "20%", boundingBox: box(60, 0, 70, 10) },
    { id: "ref-6", realPageNumber: 46, columnId: "col-item", normalizedText: "01", boundingBox: box(900, 900, 910, 910) },
  ];
  const cellComparisons = associateObservedCellsToReference(expectedCells, [
    { id: "obs-1", realPageNumber: 46, columnId: "col-quantidade", normalizedText: "1", boundingBox: box(1, 1, 9, 9) },
    { id: "obs-2", realPageNumber: 46, columnId: null, normalizedText: "linha 1 linha 2", boundingBox: box(20, 0, 40, 10) },
    { id: "obs-3", realPageNumber: 46, columnId: null, normalizedText: "100 20%", boundingBox: box(50, 0, 70, 10) },
    // ref-6 (item) permanece omitida (nenhuma observada próxima)
  ]);

  const mergedIntraColumn = cellComparisons.find((c) => c.referenceCellIds.includes("ref-2"));
  const mergedCrossColumn = cellComparisons.find((c) => c.referenceCellIds.includes("ref-4"));
  assertEqual(mergedIntraColumn?.outcome, "multiple_expected_cells_merged");
  assertEqual(mergedCrossColumn?.outcome, "multiple_expected_cells_merged");

  const structureMetrics = computeLocalReaderTableStructureMetrics(expectedCells, cellComparisons, 1, 6);
  assertEqual(structureMetrics.cellOutcomeCounts.direct_match, 1, "ref-1");
  assertEqual(structureMetrics.cellOutcomeCounts.multiple_expected_cells_merged, 4, "ref-2,ref-3,ref-4,ref-5");
  assertEqual(structureMetrics.cellOutcomeCounts.expected_cell_omitted, 1, "ref-6");
  assertEqual(structureMetrics.cellsTotal, 6);
  assertEqual(structureMetrics.columnsMerged, 1, "apenas col-custo-sbdi × col-bdi conta — a fusão de ref-2/ref-3 é intra-coluna (col-descricao) e não conta");
  assertEqual(structureMetrics.expectedColumnsRecovered, 1, "apenas col-quantidade (direct_match) conta como recuperada");
  assertEqual(structureMetrics.expectedColumnsTotal, 12);
});

runTest("métricas de campo crítico: papel numérico mede valor decimal exato; papel textual nunca mede valor decimal", () => {
  const numericMetric = computeLocalReaderCriticalFieldMetric("quantidade", 5, [
    { literalMatch: true, exactDecimalValueMatch: true },
    { literalMatch: true, exactDecimalValueMatch: false },
    { literalMatch: false, exactDecimalValueMatch: false },
  ]);
  assertEqual(numericMetric.itemsTotal, 5);
  assertEqual(numericMetric.literalMatches, 2);
  assertEqual(numericMetric.exactDecimalValueMatches, 1);
  assertEqual(numericMetric.mismatches, 3);

  const textualMetric = computeLocalReaderCriticalFieldMetric("descricao", 5, [{ literalMatch: true, exactDecimalValueMatch: true }]);
  assertEqual(textualMetric.exactDecimalValueMatches, null, "papel textual nunca mede valor decimal, mesmo que o campo de entrada esteja true");
});

// --- §9.5 Descrições multilinha -------------------------------------------------

runTest("descrição multilinha: seis desfechos distintos, classificação determinística", () => {
  assertEqual(classifyLocalReaderMultilineDescription(["A", "B"], ["A", "B"], false, null), "fully_preserved");
  assertEqual(classifyLocalReaderMultilineDescription(["A", "B"], ["B", "A"], false, null), "lines_out_of_order");
  assertEqual(classifyLocalReaderMultilineDescription(["A", "B", "C"], ["A", "B"], false, null), "partially_preserved");
  assertEqual(classifyLocalReaderMultilineDescription(["A", "B"], [], false, null), "omitted");
  assertEqual(classifyLocalReaderMultilineDescription(["A", "B"], ["A"], true, null), "split_into_incompatible_cells");
  assertEqual(classifyLocalReaderMultilineDescription(["A", "B"], ["A", "B", "item vizinho"], false, "item vizinho"), "merged_with_neighbor_item");
});

// --- §9.6 Conteúdo externo (bloco do TCU) --------------------------------------

runTest("conteúdo externo: incorporação a item ou a tabela é sinalizada como risco crítico; demais desfechos não", () => {
  assertEqual(classifyLocalReaderExternalContent("tcu-note", "detected_as_external_or_out_of_table").isCriticalRisk, false);
  assertEqual(classifyLocalReaderExternalContent("tcu-note", "omitted").isCriticalRisk, false);
  assertEqual(classifyLocalReaderExternalContent("tcu-note", "split").isCriticalRisk, false);
  assertEqual(classifyLocalReaderExternalContent("tcu-note", "incorporated_into_table").isCriticalRisk, true);
  assertEqual(classifyLocalReaderExternalContent("tcu-note", "incorporated_into_item_description").isCriticalRisk, true);
});

// --- §9.7 Evidência matemática disponível ---------------------------------------

runTest("evidência matemática: completa, parcial, ausente e divergente da fonte", () => {
  const complete = classifyLocalReaderMathEvidence("rel-1", { quantity: true, unitPrice: true, total: true, subtotalOrTotal: true }, []);
  assertEqual(complete.availability, "evidencia_completa");
  assertEqual(complete.missingFieldsPt.length, 0);

  const partial = classifyLocalReaderMathEvidence("rel-2", { quantity: true, unitPrice: false, total: true, subtotalOrTotal: true }, []);
  assertEqual(partial.availability, "evidencia_parcial");
  assertEqual(partial.missingFieldsPt.length, 1);

  const absent = classifyLocalReaderMathEvidence("rel-3", { quantity: false, unitPrice: false, total: false, subtotalOrTotal: false }, []);
  assertEqual(absent.availability, "evidencia_ausente");
  assertEqual(absent.missingFieldsPt.length, 4);

  const divergent = classifyLocalReaderMathEvidence("rel-4", { quantity: true, unitPrice: true, total: true, subtotalOrTotal: true }, ["total"]);
  assertEqual(divergent.availability, "evidencia_divergente_da_fonte");
  assert(divergent.divergenceDescriptionPt !== null && divergent.divergenceDescriptionPt.length > 0, "descrição de divergência deveria estar preenchida");
});

// --- §10 Classificação de viabilidade --------------------------------------------

const FULL_VIABILITY_INPUTS: LocalReaderViabilityGateInputs = {
  processedAllThreePages: true,
  inventedMonetaryValue: false,
  providedPhysicalOriginForCriticalFields: true,
  recoveredRequiredFieldsOf80Items: true,
  incorporatedTcuNoteAsItemOrValue: false,
  producedUsableTableCellStructure: true,
  ranOffline: true,
  reproducibleConfiguration: true,
  failedOnAnyPage: false,
  requiredNetworkOrExternalService: false,
  impedingInstability: false,
  providedRelevantTraceableComplementaryEvidence: false,
};

runTest("viabilidade: candidato principal quando todos os critérios do portão principal são satisfeitos", () => {
  const result = classifyLocalReaderViability(FULL_VIABILITY_INPUTS);
  assertEqual(result.classification, "candidato_principal");
});

runTest("viabilidade: candidato complementar quando o portão principal falha mas há evidência complementar rastreável", () => {
  const result = classifyLocalReaderViability({ ...FULL_VIABILITY_INPUTS, recoveredRequiredFieldsOf80Items: false, providedRelevantTraceableComplementaryEvidence: true });
  assertEqual(result.classification, "candidato_complementar");
});

runTest("viabilidade: não viável quando falha em qualquer página, mesmo que outros critérios sejam satisfeitos", () => {
  const result = classifyLocalReaderViability({ ...FULL_VIABILITY_INPUTS, failedOnAnyPage: true, providedRelevantTraceableComplementaryEvidence: true });
  assertEqual(result.classification, "nao_viavel_nesta_configuracao");
});

runTest("viabilidade: não viável quando inventa valor monetário, mesmo com evidência complementar", () => {
  const result = classifyLocalReaderViability({ ...FULL_VIABILITY_INPUTS, inventedMonetaryValue: true, providedRelevantTraceableComplementaryEvidence: true });
  assertEqual(result.classification, "nao_viavel_nesta_configuracao");
});

runTest("viabilidade: não viável quando exige rede ou serviço externo", () => {
  const result = classifyLocalReaderViability({ ...FULL_VIABILITY_INPUTS, requiredNetworkOrExternalService: true });
  assertEqual(result.classification, "nao_viavel_nesta_configuracao");
});

runTest("viabilidade: não viável quando falha o portão principal sem nenhuma evidência complementar", () => {
  const result = classifyLocalReaderViability({ ...FULL_VIABILITY_INPUTS, recoveredRequiredFieldsOf80Items: false, providedRelevantTraceableComplementaryEvidence: false });
  assertEqual(result.classification, "nao_viavel_nesta_configuracao");
});

// --- §11 Diferenças de repetição --------------------------------------------------

runTest("diferenças de repetição: timestamp, diretório temporário, identificador aleatório, ordem de propriedade e diferença semântica", () => {
  assertEqual(classifyLocalReaderRepetitionDifference({ path: "$.page.processedAt", valueRun1: "2026-07-21T10:00:00Z", valueRun2: "2026-07-21T10:00:03Z" }).category, "known_noise_timestamp");
  assertEqual(
    classifyLocalReaderRepetitionDifference({ path: "$.debug.tempDir", valueRun1: "C:\\Users\\x\\AppData\\Local\\Temp\\run1", valueRun2: "C:\\Users\\x\\AppData\\Local\\Temp\\run2" }).category,
    "known_noise_temp_directory",
  );
  assertEqual(
    classifyLocalReaderRepetitionDifference({ path: "$.debug.runId", valueRun1: "3fa85f64-5717-4562-b3fc-2c963f66afa6", valueRun2: "7c9e6679-7425-40de-944b-e07fc1f90ae7" }).category,
    "known_noise_random_identifier",
  );
  assertEqual(classifyLocalReaderRepetitionDifference({ path: NONSEMANTIC_PROPERTY_ORDER_DIFFERENCE_PATH, valueRun1: "a", valueRun2: "b" }).category, "known_noise_nonsemantic_property_order");
  assertEqual(classifyLocalReaderRepetitionDifference({ path: "$.cells[3].literalText", valueRun1: "12,50", valueRun2: "12,00" }).category, "semantic_difference");
});

// --- Integridade: ausência de saída real de Docling/PaddleOCR ------------------

runTest("integridade: nenhum hash real de renderização ou versão real de ferramenta aparece em nenhum módulo de implementação deste diretório", () => {
  // Literais montados por concatenação para que este próprio arquivo de
  // teste (a lista negativa) nunca contenha o literal contíguo — o que
  // faria a varredura acusar a si mesma. Os módulos de implementação
  // (não-teste) são a superfície real sob verificação.
  const forbiddenLiterals = [
    ["e89b4482222a59d2ebd2e8e1b645cd", "9f71a786ac0d575ff52877aeced6c118ffb92c5"].join(""),
    ["dd325528863d7091df9335ce99acf1", "0b6beaa9aafc953a178a77002a06f7d974"].join(""),
    ["8f16be2d96c2e48c9828cbbcd7380b", "794864325a1b0c78544dc8e900211fc62b"].join(""),
    ["docling", " 2.114.0"].join(""),
    ["paddleocr", " 3.7.0"].join(""),
    ["paddlepaddle", " 3.3.1"].join(""),
    ["paddlex", " 3.7.2"].join(""),
  ];
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const implementationFiles = readdirSync(currentDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  assert(implementationFiles.length >= 8, "diretório deveria conter os módulos de implementação do protocolo");
  for (const file of implementationFiles) {
    const content = readFileSync(join(currentDir, file), "utf8");
    for (const literal of forbiddenLiterals) {
      assert(!content.includes(literal), `${file} contém literal proibido de saída real: '${literal}'`);
    }
  }
});
