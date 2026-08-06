/**
 * Testes reais da implementação v2 (Sprint 21.4B.3A.3, Momento 3C.2A).
 * Substitui as fixtures declarativas dos Momentos 3C.1/3C.1A/3C.1B (que
 * apenas verificavam auto-consistência de dados, já que as funções v2
 * eram stubs) por chamadas reais às funções agora implementadas.
 *
 * Exclusivamente sintético — nenhuma saída real de Docling/PaddleOCR,
 * nenhuma saída bruta processada. Todas as fixtures usam page=999 (ou
 * outra fora de {46,50,54}) e ids/textos claramente sintéticos, nunca
 * dados do documento Lagoa do Arroz.
 *
 * Ver:
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`,
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1A_MATH_APPLICABILITY_AND_CELL_PROVENANCE_ADDENDUM.md`,
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1B_FINAL_V2_CONTRACT_ADDENDUM.md`.
 */

import { associateObservedCellsToReference, associateObservedRegionsToReference } from "../discovery-local-reader-comparison";
import { classifyLocalReaderMultilineDescription } from "../discovery-local-reader-metrics";
import { classifyLocalReaderViability } from "../discovery-local-reader-viability";
import type {
  LocalReaderCellComparisonResult,
  LocalReaderConvertedBoundingBox,
  LocalReaderExpectedCellRef,
  LocalReaderExpectedRegionRef,
  LocalReaderObservedCellRef,
  LocalReaderObservedRegionRef,
  LocalReaderViabilityGateInputs,
} from "../discovery-local-reader-evaluation.types";
import { associateObservedRegionsToReferenceV2 } from "./discovery-local-reader-comparison-v2";
import { computeLocalReaderRegionTextMetricsV2 } from "./discovery-local-reader-metrics-v2";
import { deriveObservedDescriptionLinesV2 } from "./discovery-local-reader-multiline-v2";
import { classifyLocalReaderMathEvidenceV2, deriveMathEvidenceFieldStatesV2, deriveMathEvidenceFieldsV2 } from "./discovery-local-reader-math-evidence-v2";
import { deriveViabilityInputsV2 } from "./discovery-local-reader-viability-inputs-v2";
import type { LocalReaderMathEvidenceFieldStatesV2, LocalReaderRegionComponentOutcomeV2 } from "./discovery-local-reader-evaluation-v2.types";
import type { ReferenceTruthCell, ReferenceTruthLogicalRow, ReferenceTruthMathRelation, ReferenceTruthPage, ReferenceTruthPageBundle, ReferenceTruthPhysicalRegion } from "../../reference-truth/discovery-reference-truth.types";

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

function assertThrows(fn: () => void, message: string): void {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(message);
}

function assertThrowsWithMessage(fn: () => void, expectedSubstring: string, context: string): void {
  try {
    fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(msg.includes(expectedSubstring), `${context}: mensagem de erro deveria conter "${expectedSubstring}", recebeu "${msg}"`);
    return;
  }
  throw new Error(`${context}: deveria ter lançado`);
}

const box = (leftPoints: number, topPoints: number, rightPoints: number, bottomPoints: number): LocalReaderConvertedBoundingBox => ({ leftPoints, topPoints, rightPoints, bottomPoints });

// ============================================================================
// §A — Regiões (Problemas A+B). Momento 3C.1 §3-§4.
// ============================================================================

const REGION_PAGE = 46;

const REGION_EXPECTED: ReadonlyArray<LocalReaderExpectedRegionRef> = [
  { id: "reg-r1", realPageNumber: REGION_PAGE, normalizedText: "Alpha", boundingBox: box(0, 0, 100, 20) },
  { id: "reg-r2", realPageNumber: REGION_PAGE, normalizedText: "Beta", boundingBox: box(0, 30, 100, 50) },
  { id: "reg-r3", realPageNumber: REGION_PAGE, normalizedText: "GammaSplit", boundingBox: box(0, 60, 100, 100) },
  { id: "reg-r4a", realPageNumber: REGION_PAGE, normalizedText: "DeltaMergedA", boundingBox: box(0, 110, 100, 130) },
  { id: "reg-r4b", realPageNumber: REGION_PAGE, normalizedText: "DeltaMergedB", boundingBox: box(0, 130, 100, 150) },
  { id: "reg-r5", realPageNumber: REGION_PAGE, normalizedText: "EpsilonOmitted", boundingBox: box(0, 160, 100, 180) },
  { id: "reg-r8", realPageNumber: REGION_PAGE, normalizedText: "EtaEmptyText", boundingBox: box(0, 220, 100, 240) },
  { id: "reg-nm1", realPageNumber: REGION_PAGE, normalizedText: "GammaSharedNM", boundingBox: null },
  { id: "reg-nm2", realPageNumber: REGION_PAGE, normalizedText: "GammaSharedNM", boundingBox: null },
];

const REGION_OBSERVED: ReadonlyArray<LocalReaderObservedRegionRef> = [
  { id: "reg-o1", realPageNumber: REGION_PAGE, normalizedText: "Alpha", boundingBox: box(0, 0, 100, 20) },
  { id: "reg-o2", realPageNumber: REGION_PAGE, normalizedText: "BetaObserved", boundingBox: box(0, 30, 100, 50) },
  { id: "reg-o3a", realPageNumber: REGION_PAGE, normalizedText: "GammaSplitPart1", boundingBox: box(0, 60, 100, 80) },
  { id: "reg-o3b", realPageNumber: REGION_PAGE, normalizedText: "GammaSplitPart2", boundingBox: box(0, 80, 100, 100) },
  { id: "reg-o4", realPageNumber: REGION_PAGE, normalizedText: "DeltaMergedA", boundingBox: box(0, 110, 100, 150) },
  { id: "reg-o6", realPageNumber: REGION_PAGE, normalizedText: "ZetaAdditional", boundingBox: box(0, 190, 100, 210) },
  { id: "reg-o8", realPageNumber: REGION_PAGE, normalizedText: "", boundingBox: box(0, 220, 100, 240) },
  { id: "reg-o-nm1", realPageNumber: REGION_PAGE, normalizedText: "GammaSharedNM", boundingBox: null },
  { id: "reg-o-nm2", realPageNumber: REGION_PAGE, normalizedText: "GammaSharedNM", boundingBox: null },
  { id: "reg-o-nm3", realPageNumber: REGION_PAGE, normalizedText: "GammaSharedNM", boundingBox: null },
];
// r5 (omitido) e r-nm* / o-nm* (N:M) já incluídos acima; nenhum expected/observed correspondente para r5.

const EXPECTED_OUTCOME_BY_COMPONENT: ReadonlyArray<{ readonly ids: ReadonlyArray<string>; readonly outcome: LocalReaderRegionComponentOutcomeV2 }> = [
  { ids: ["reg-r1"], outcome: "spatial_and_textual_match" },
  { ids: ["reg-r2"], outcome: "spatial_overlap_without_text_match" },
  { ids: ["reg-r3"], outcome: "expected_regions_split_across_observed" },
  { ids: ["reg-r4a", "reg-r4b"], outcome: "multiple_expected_regions_merged" },
  { ids: ["reg-r5"], outcome: "expected_region_omitted" },
  { ids: ["reg-o6"], outcome: "observed_region_additional" },
  { ids: ["reg-r8"], outcome: "spatial_overlap_without_text_match" },
  { ids: ["reg-nm1", "reg-nm2"], outcome: "expected_regions_split_across_observed" },
];

runTest("§A — associateObservedRegionsToReferenceV2: 8 componentes, cada um com a classificação esperada (1:1 textual, 1:1 espacial, 1:N, N:1, omitido, adicional, texto vazio, N:M)", () => {
  const components = associateObservedRegionsToReferenceV2(REGION_EXPECTED, REGION_OBSERVED);
  assertEqual(components.length, 8, "quantidade de componentes inesperada");

  EXPECTED_OUTCOME_BY_COMPONENT.forEach(({ ids, outcome }) => {
    const match = components.find((c) => [...c.referenceRegionIds, ...c.observedRegionIds].some((id) => ids.includes(id)));
    assert(match !== undefined, `nenhum componente encontrado contendo ${ids.join(",")}`);
    assertEqual(match!.outcome, outcome, `componente ${ids.join(",")}: outcome inesperado`);
  });
});

runTest("§A — computeLocalReaderRegionTextMetricsV2: contagem por região individual, invariantes satisfeitas, correspondência textual real distinguida de sobreposição espacial", () => {
  const components = associateObservedRegionsToReferenceV2(REGION_EXPECTED, REGION_OBSERVED);
  const metrics = computeLocalReaderRegionTextMetricsV2(components, REGION_EXPECTED, REGION_OBSERVED);

  assertEqual(metrics.associationComponents, 8);
  assertEqual(metrics.expectedRegionsOmitted, 1, "reg-r5 é a única região omitida");
  assertEqual(metrics.observedRegionsAdditional, 1, "reg-o6 é a única região observada adicional");
  // r1 (match), r4a (match dentro do componente fundido), nm1, nm2 (match textual, N:M)
  assertEqual(metrics.expectedRegionsWithExactTextualMatch, 4, "r1, r4a, nm1, nm2 têm correspondência textual exata");
  // r2, r3, r4b, r8 cobertas apenas espacialmente (ou, no caso de r3, sem nenhuma correspondência textual entre as partes)
  assertEqual(metrics.expectedRegionsCoveredSpatiallyOnly, 4);

  assertEqual(metrics.expectedRegionsCoveredByAnyComponent, metrics.expectedRegionsWithExactTextualMatch + metrics.expectedRegionsCoveredSpatiallyOnly, "invariante 1 (coveredByAnyComponent = exactMatch + spatialOnly) violada");
  assertEqual(metrics.expectedRegionsCoveredByAnyComponent + metrics.expectedRegionsOmitted, REGION_EXPECTED.length, "invariante 2 (coveredByAnyComponent + omitted = totalExpectedRegions) violada");
});

runTest("§A — Problema 2 corrigido: componente N:1 com texto observado vazio NUNCA é classificado como correspondência textual exata (r4b, r8)", () => {
  const components = associateObservedRegionsToReferenceV2(REGION_EXPECTED, REGION_OBSERVED);
  const r8Component = components.find((c) => c.referenceRegionIds.includes("reg-r8"))!;
  assertEqual(r8Component.outcome, "spatial_overlap_without_text_match", "texto observado vazio não pode ser confundido com correspondência textual");
});

runTest("§A/§B — equivalência estrutural v1×v2: mesmos componentes (mesmos ids esperados, mesmos ids observados) para a mesma entrada; apenas a classificação final diverge", () => {
  const v1Results = associateObservedRegionsToReference(REGION_EXPECTED, REGION_OBSERVED);
  const v2Results = associateObservedRegionsToReferenceV2(REGION_EXPECTED, REGION_OBSERVED);

  assertEqual(v1Results.length, v2Results.length, "v1 e v2 deveriam produzir a mesma quantidade de componentes");
  v1Results.forEach((v1r, i) => {
    const v2r = v2Results[i];
    assertEqual(v1r.id, v2r.id, `componente ${i}: id divergente entre v1 e v2 (a formação de grafo/componentes deveria ser idêntica)`);
    assertEqual(JSON.stringify([...v1r.referenceRegionIds].sort()), JSON.stringify([...v2r.referenceRegionIds].sort()), `componente ${i}: referenceRegionIds divergente entre v1 e v2`);
    assertEqual(JSON.stringify([...v1r.observedRegionIds].sort()), JSON.stringify([...v2r.observedRegionIds].sort()), `componente ${i}: observedRegionIds divergente entre v1 e v2`);
  });
});

// ============================================================================
// §B — Descrições multilinha (Problema C). Momento 3C.1 §5.
// ============================================================================

const SYNTHETIC_PAGE_META: ReferenceTruthPage = {
  realPageNumber: 999,
  renderingHashSha256: "0".repeat(64),
  pageWidthPoints: 1000,
  pageHeightPoints: 1000,
  renderedWidthPixels: 1000,
  renderedHeightPixels: 1000,
  renderingResolutionDpi: 100,
  renderingMethodIdentity: "fixture sintética do Momento 3C.2A — nunca corresponde ao documento real",
  pageSelectionRulePt: "fixture sintética",
};

function syntheticRow(id: string, type: ReferenceTruthLogicalRow["type"], cellIds: ReadonlyArray<string>): ReferenceTruthLogicalRow {
  return { id, type, cellIds, physicalRegionIds: [], continuityRelationPt: "fixture sintética", startRealPageNumber: 999, endRealPageNumber: 999, observedHierarchicalCode: null, parentLogicalRowId: null };
}

function syntheticDescCell(id: string, logicalRowId: string, text: string): ReferenceTruthCell {
  return {
    id,
    realPageNumber: 999,
    logicalRowId,
    columnId: "col-descricao",
    physicalRegionIds: [],
    literalText: text,
    interpretedValue: { kind: "text", value: text },
    observedType: "descricao",
    displayedDecimalPrecision: null,
    physicalOriginPt: "fixture sintética",
  };
}

function bundleWithCellsAndRows(cells: ReadonlyArray<ReferenceTruthCell>, rows: ReadonlyArray<ReferenceTruthLogicalRow>, physicalRegions: ReadonlyArray<ReferenceTruthPhysicalRegion> = [], mathRelations: ReadonlyArray<ReferenceTruthMathRelation> = []): ReferenceTruthPageBundle {
  return { page: SYNTHETIC_PAGE_META, physicalRegions, logicalRows: rows, cells, mathRelations };
}

function cellRefsForComparison(cells: ReadonlyArray<ReferenceTruthCell>, boundingBox: LocalReaderConvertedBoundingBox | null = null): ReadonlyArray<LocalReaderExpectedCellRef> {
  return cells.map((c) => ({ id: c.id, realPageNumber: c.realPageNumber, columnId: c.columnId, normalizedText: c.literalText, boundingBox }));
}

/**
 * `ReferenceTruthCell` (verdade de referência) não carrega caixa
 * delimitadora própria — apenas `physicalRegionIds`. Para testes que
 * precisam de `direct_match`/`correct_coordinate_wrong_text` reais (que
 * exigem `boundingBox !== null` em ambos os lados — ver v1
 * `discovery-local-reader-comparison.ts` `classifyComponent`), a caixa é
 * mantida à parte e emparelhada aqui, nunca inferida.
 */
function expectedCellRefsWithBoxes(pairs: ReadonlyArray<readonly [ReferenceTruthCell, LocalReaderConvertedBoundingBox]>): ReadonlyArray<LocalReaderExpectedCellRef> {
  return pairs.map(([c, boundingBox]) => ({ id: c.id, realPageNumber: c.realPageNumber, columnId: c.columnId, normalizedText: c.literalText, boundingBox }));
}

runTest("§B — deriveObservedDescriptionLinesV2 + classifyLocalReaderMultilineDescription: fully_preserved (2 linhas, ambas direct_match, ordem preservada)", () => {
  const rowId = "row-ml-full";
  const cellA = syntheticDescCell("cell-ml-full-a", rowId, "Linha Um");
  const cellB = syntheticDescCell("cell-ml-full-b", rowId, "Linha Dois");
  const row = syntheticRow(rowId, "item_de_servico", [cellA.id, cellB.id]);
  const bundle = bundleWithCellsAndRows([cellA, cellB], [row]);

  const expectedA: LocalReaderExpectedCellRef = { id: cellA.id, realPageNumber: 999, columnId: "col-descricao", normalizedText: "Linha Um", boundingBox: box(0, 0, 100, 20) };
  const expectedB: LocalReaderExpectedCellRef = { id: cellB.id, realPageNumber: 999, columnId: "col-descricao", normalizedText: "Linha Dois", boundingBox: box(0, 30, 100, 50) };
  const observed: ReadonlyArray<LocalReaderObservedCellRef> = [
    { id: "obs-ml-full-a", realPageNumber: 999, columnId: null, normalizedText: "Linha Um", boundingBox: box(0, 0, 100, 20) },
    { id: "obs-ml-full-b", realPageNumber: 999, columnId: null, normalizedText: "Linha Dois", boundingBox: box(0, 30, 100, 50) },
  ];
  const comparisons = associateObservedCellsToReference([expectedA, expectedB], observed);

  const derived = deriveObservedDescriptionLinesV2(bundle, rowId, comparisons);
  assertEqual(JSON.stringify(derived.observedLinesInOrder), JSON.stringify(["Linha Um", "Linha Dois"]));

  const outcome = classifyLocalReaderMultilineDescription(["Linha Um", "Linha Dois"], derived.observedLinesInOrder, derived.splitAcrossIncompatibleCells, derived.mergedWithNeighborItemText);
  assertEqual(outcome, "fully_preserved");
});

runTest("§B — partially_preserved (2 linhas esperadas, apenas 1 recuperada — a segunda expected_cell_omitted)", () => {
  const rowId = "row-ml-partial";
  const cellA = syntheticDescCell("cell-ml-partial-a", rowId, "Linha A");
  const cellB = syntheticDescCell("cell-ml-partial-b", rowId, "Linha B");
  const row = syntheticRow(rowId, "item_de_servico", [cellA.id, cellB.id]);
  const bundle = bundleWithCellsAndRows([cellA, cellB], [row]);

  const expectedA: LocalReaderExpectedCellRef = { id: cellA.id, realPageNumber: 999, columnId: "col-descricao", normalizedText: "Linha A", boundingBox: box(0, 0, 100, 20) };
  const expectedB: LocalReaderExpectedCellRef = { id: cellB.id, realPageNumber: 999, columnId: "col-descricao", normalizedText: "Linha B", boundingBox: box(0, 30, 100, 50) };
  const observed: ReadonlyArray<LocalReaderObservedCellRef> = [{ id: "obs-ml-partial-a", realPageNumber: 999, columnId: null, normalizedText: "Linha A", boundingBox: box(0, 0, 100, 20) }];
  const comparisons = associateObservedCellsToReference([expectedA, expectedB], observed);

  const derived = deriveObservedDescriptionLinesV2(bundle, rowId, comparisons);
  const outcome = classifyLocalReaderMultilineDescription(["Linha A", "Linha B"], derived.observedLinesInOrder, derived.splitAcrossIncompatibleCells, derived.mergedWithNeighborItemText);
  assertEqual(outcome, "partially_preserved");
});

runTest("§B — omitted (nenhuma linha recuperada)", () => {
  const rowId = "row-ml-omitted";
  const cellA = syntheticDescCell("cell-ml-omitted-a", rowId, "Linha Sozinha");
  const row = syntheticRow(rowId, "item_de_servico", [cellA.id]);
  const bundle = bundleWithCellsAndRows([cellA], [row]);

  const comparisons = associateObservedCellsToReference(cellRefsForComparison([cellA]), []);
  const derived = deriveObservedDescriptionLinesV2(bundle, rowId, comparisons);
  assertEqual(derived.observedLinesInOrder.length, 0);

  const outcome = classifyLocalReaderMultilineDescription(["Linha Sozinha"], derived.observedLinesInOrder, derived.splitAcrossIncompatibleCells, derived.mergedWithNeighborItemText);
  assertEqual(outcome, "omitted");
});

runTest("§B — split_into_incompatible_cells (1 célula esperada dividida em 2 observadas, mesma caixa)", () => {
  const rowId = "row-ml-split";
  const cellA = syntheticDescCell("cell-ml-split-a", rowId, "Linha Unica");
  const row = syntheticRow(rowId, "item_de_servico", [cellA.id]);
  const bundle = bundleWithCellsAndRows([cellA], [row]);

  const expected: ReadonlyArray<LocalReaderExpectedCellRef> = [{ id: cellA.id, realPageNumber: 999, columnId: "col-descricao", normalizedText: "Linha Unica", boundingBox: box(0, 0, 100, 20) }];
  const observed: ReadonlyArray<LocalReaderObservedCellRef> = [
    { id: "obs-ml-split-1", realPageNumber: 999, columnId: null, normalizedText: "Parte1", boundingBox: box(0, 0, 100, 20) },
    { id: "obs-ml-split-2", realPageNumber: 999, columnId: null, normalizedText: "Parte2", boundingBox: box(0, 0, 100, 20) },
  ];
  const comparisons = associateObservedCellsToReference(expected, observed);
  assertEqual(comparisons[0]?.outcome, "expected_cell_split_into_multiple_observed", "pré-condição: comparador v1 deveria classificar como divisão");

  const derived = deriveObservedDescriptionLinesV2(bundle, rowId, comparisons);
  assertEqual(derived.splitAcrossIncompatibleCells, true);
  const outcome = classifyLocalReaderMultilineDescription(["Linha Unica"], derived.observedLinesInOrder, derived.splitAcrossIncompatibleCells, derived.mergedWithNeighborItemText);
  assertEqual(outcome, "split_into_incompatible_cells");
});

runTest("§B — merged_with_neighbor_item (célula de descrição fundida com a de uma linha item_de_servico vizinha)", () => {
  const targetRowId = "row-ml-merge-target";
  const neighborRowId = "row-ml-merge-neighbor";
  const targetCell = syntheticDescCell("cell-ml-merge-target", targetRowId, "Linha Alvo");
  const neighborCell = syntheticDescCell("cell-ml-merge-neighbor", neighborRowId, "Linha Vizinha");
  const targetRow = syntheticRow(targetRowId, "item_de_servico", [targetCell.id]);
  const neighborRow = syntheticRow(neighborRowId, "item_de_servico", [neighborCell.id]);
  const bundle = bundleWithCellsAndRows([targetCell, neighborCell], [targetRow, neighborRow]);

  const expected = cellRefsForComparison([targetCell, neighborCell]).map((c) => ({ ...c, boundingBox: box(0, 0, 100, 40) }));
  const observed: ReadonlyArray<LocalReaderObservedCellRef> = [{ id: "obs-ml-merge-1", realPageNumber: 999, columnId: null, normalizedText: "Alvo E Vizinha Combinados", boundingBox: box(0, 0, 100, 40) }];
  const comparisons = associateObservedCellsToReference(expected, observed);
  assertEqual(comparisons[0]?.outcome, "multiple_expected_cells_merged", "pré-condição: comparador v1 deveria classificar como fusão");

  const derived = deriveObservedDescriptionLinesV2(bundle, targetRowId, comparisons);
  assertEqual(derived.mergedWithNeighborItemText, "Alvo E Vizinha Combinados");
  assert(derived.observedLinesInOrder.length > 0, "fusão com vizinho deve contribuir uma linha (senão 'omitted' seria retornado antes de 'merged_with_neighbor_item' ser verificado)");

  const outcome = classifyLocalReaderMultilineDescription(["Linha Alvo"], derived.observedLinesInOrder, derived.splitAcrossIncompatibleCells, derived.mergedWithNeighborItemText);
  assertEqual(outcome, "merged_with_neighbor_item");
});

runTest("§B — limitação registrada: 'lines_out_of_order' não é alcançável através de deriveObservedDescriptionLinesV2 com dados reais (cada linha derivada é sempre colocada na posição de sua própria célula esperada correspondente) — testado diretamente contra classifyLocalReaderMultilineDescription (v1, já congelada e aprovada)", () => {
  const outcome = classifyLocalReaderMultilineDescription(["Linha X", "Linha Y"], ["Linha Y", "Linha X"], false, null);
  assertEqual(outcome, "lines_out_of_order", "o classificador v1 em si deve continuar reconhecendo este desfecho — apenas a derivação v2 não o produz a partir de comparações reais");
});

// ============================================================================
// §C — Evidência matemática (Problema D). Momento 3C.1B §1-§3.
// ============================================================================

function syntheticMathRelation(overrides: Partial<ReferenceTruthMathRelation> & Pick<ReferenceTruthMathRelation, "id" | "logicalRowId">): ReferenceTruthMathRelation {
  return {
    quantityScaled: null,
    displayedUnitPriceCents: null,
    displayedTotalCents: null,
    officialSubtotalOrTotalCents: null,
    verifiableOperationPt: "fixture sintética do Momento 3C.2A",
    result: "reconciliado_diretamente",
    undisplayedPrecisionProof: null,
    sourceArithmeticInconsistency: null,
    groupCompletenessProof: null,
    notesPt: "fixture sintética do Momento 3C.2A — nunca dado real",
    ...overrides,
  };
}

/**
 * `boundingBox` é aceito apenas para documentar, ao lado de cada chamada,
 * a caixa que o teste pretende usar mais adiante — NUNCA armazenado aqui
 * (`ReferenceTruthCell`, verdade de referência, não tem campo de caixa
 * própria, apenas `physicalRegionIds`). A caixa real usada na comparação
 * vem de `expectedCellRefsWithBoxes`, nunca desta função — confundir os
 * dois foi a causa de um bug real corrigido durante a escrita destes
 * testes (ver histórico do commit).
 */
function syntheticMathCell(id: string, logicalRowId: string, columnId: string, text: string, boundingBox: LocalReaderConvertedBoundingBox | null): ReferenceTruthCell {
  void boundingBox;
  return {
    id,
    realPageNumber: 999,
    logicalRowId,
    columnId,
    physicalRegionIds: [],
    literalText: text,
    interpretedValue: { kind: "text", value: text },
    observedType: "incerto",
    displayedDecimalPrecision: null,
    physicalOriginPt: "fixture sintética",
  };
}

// --- §C.1: os 7 mapeamentos outcome → estado, um por vez, isolados por posição de página ---

interface OutcomeMappingCaseV2 {
  readonly description: string;
  readonly expected: LocalReaderExpectedCellRef;
  readonly observed: ReadonlyArray<LocalReaderObservedCellRef>;
  readonly expectedOutcome: LocalReaderCellComparisonResult["outcome"];
  readonly expectedState: LocalReaderMathEvidenceFieldStatesV2["quantity"];
}

const OUTCOME_MAPPING_CASES: ReadonlyArray<OutcomeMappingCaseV2> = [
  {
    description: "direct_match → present",
    expected: { id: "cell-map-direct", realPageNumber: 999, columnId: "col-quantidade", normalizedText: "10,00", boundingBox: box(0, 0, 50, 20) },
    observed: [{ id: "obs-map-direct", realPageNumber: 999, columnId: null, normalizedText: "10,00", boundingBox: box(0, 0, 50, 20) }],
    expectedOutcome: "direct_match",
    expectedState: "present",
  },
  {
    description: "correct_coordinate_wrong_text → divergent",
    expected: { id: "cell-map-divergent", realPageNumber: 999, columnId: "col-quantidade", normalizedText: "10,00", boundingBox: box(0, 30, 50, 50) },
    observed: [{ id: "obs-map-divergent", realPageNumber: 999, columnId: null, normalizedText: "99,00", boundingBox: box(0, 30, 50, 50) }],
    expectedOutcome: "correct_coordinate_wrong_text",
    expectedState: "divergent",
  },
  {
    description: "expected_cell_omitted → missing",
    expected: { id: "cell-map-omitted", realPageNumber: 999, columnId: "col-quantidade", normalizedText: "10,00", boundingBox: box(0, 60, 50, 80) },
    observed: [],
    expectedOutcome: "expected_cell_omitted",
    expectedState: "missing",
  },
  {
    description: "correct_text_wrong_column → missing",
    expected: { id: "cell-map-wrongcol", realPageNumber: 999, columnId: "col-quantidade", normalizedText: "10,00", boundingBox: box(0, 90, 50, 110) },
    observed: [{ id: "obs-map-wrongcol", realPageNumber: 999, columnId: "col-unit-cbdi", normalizedText: "10,00", boundingBox: box(0, 90, 50, 110) }],
    expectedOutcome: "correct_text_wrong_column",
    expectedState: "missing",
  },
  {
    description: "correct_text_no_usable_coordinate → missing",
    expected: { id: "cell-map-nocoord", realPageNumber: 999, columnId: "col-quantidade", normalizedText: "10,00", boundingBox: null },
    observed: [{ id: "obs-map-nocoord", realPageNumber: 999, columnId: null, normalizedText: "10,00", boundingBox: null }],
    expectedOutcome: "correct_text_no_usable_coordinate",
    expectedState: "missing",
  },
  {
    description: "expected_cell_split_into_multiple_observed → missing",
    expected: { id: "cell-map-split", realPageNumber: 999, columnId: "col-quantidade", normalizedText: "10,00", boundingBox: box(0, 130, 50, 150) },
    observed: [
      { id: "obs-map-split-1", realPageNumber: 999, columnId: null, normalizedText: "1", boundingBox: box(0, 130, 50, 150) },
      { id: "obs-map-split-2", realPageNumber: 999, columnId: null, normalizedText: "0,00", boundingBox: box(0, 130, 50, 150) },
    ],
    expectedOutcome: "expected_cell_split_into_multiple_observed",
    expectedState: "missing",
  },
];

OUTCOME_MAPPING_CASES.forEach((testCase) => {
  runTest(`§C.1 — mapeamento definitivo (3C.1B §2): ${testCase.description}`, () => {
    const comparisons = associateObservedCellsToReference([testCase.expected], testCase.observed);
    const result = comparisons.find((c) => c.referenceCellIds.includes(testCase.expected.id));
    assert(result !== undefined, "pré-condição: comparação deveria existir para a célula esperada");
    assertEqual(result!.outcome, testCase.expectedOutcome, "pré-condição: outcome real do comparador v1 diverge do esperado pela fixture");

    const relation = syntheticMathRelation({ id: `rel-${testCase.expected.id}`, logicalRowId: `row-${testCase.expected.id}`, quantityScaled: { scaledValue: 1000, scale: 2 } });
    const bundle = bundleWithCellsAndRows([syntheticMathCell(testCase.expected.id, relation.logicalRowId, "col-quantidade", testCase.expected.normalizedText, testCase.expected.boundingBox)], []);
    const states = deriveMathEvidenceFieldStatesV2(relation, comparisons, bundle);
    assertEqual(states.quantity, testCase.expectedState);
  });
});

runTest("§C.1 — multiple_expected_cells_merged → missing (2 células esperadas fundidas em 1 observada)", () => {
  const expected1: LocalReaderExpectedCellRef = { id: "cell-map-merge-a", realPageNumber: 999, columnId: "col-quantidade", normalizedText: "10,00", boundingBox: box(0, 160, 50, 180) };
  const expected2: LocalReaderExpectedCellRef = { id: "cell-map-merge-b", realPageNumber: 999, columnId: "col-quantidade", normalizedText: "20,00", boundingBox: box(0, 160, 50, 180) };
  const observed: ReadonlyArray<LocalReaderObservedCellRef> = [{ id: "obs-map-merge", realPageNumber: 999, columnId: null, normalizedText: "10,00 e 20,00", boundingBox: box(0, 160, 50, 180) }];
  const comparisons = associateObservedCellsToReference([expected1, expected2], observed);
  const result = comparisons.find((c) => c.referenceCellIds.includes(expected1.id));
  assertEqual(result?.outcome, "multiple_expected_cells_merged", "pré-condição");

  const relation = syntheticMathRelation({ id: "rel-map-merge", logicalRowId: "row-map-merge", quantityScaled: { scaledValue: 1000, scale: 2 } });
  const bundle = bundleWithCellsAndRows([syntheticMathCell(expected1.id, relation.logicalRowId, "col-quantidade", expected1.normalizedText, expected1.boundingBox)], []);
  const states = deriveMathEvidenceFieldStatesV2(relation, comparisons, bundle);
  assertEqual(states.quantity, "missing");
});

runTest("§C.1 — invented_cell estruturalmente excluído: nunca produz referenceCellIds não vazio, portanto nunca é encontrado ao derivar o estado de uma célula esperada", () => {
  const observed: ReadonlyArray<LocalReaderObservedCellRef> = [{ id: "obs-map-invented", realPageNumber: 999, columnId: null, normalizedText: "999,99", boundingBox: box(500, 500, 550, 520) }];
  const comparisons = associateObservedCellsToReference([], observed);
  assertEqual(comparisons.length, 1);
  assertEqual(comparisons[0].outcome, "invented_cell");
  assertEqual(comparisons[0].referenceCellIds.length, 0, "invented_cell deve sempre ter referenceCellIds vazio (fato estrutural do comparador v1)");
});

// --- §C.2: erros de integridade (3C.1B §1-§2), agora lançados de verdade ---

runTest("§C.2 — integrity_error_applicable_field_without_expected_cell: relação declara quantity aplicável, mas nenhuma célula col-quantidade existe para a linha", () => {
  const relation = syntheticMathRelation({ id: "rel-integrity-a", logicalRowId: "row-integrity-a", quantityScaled: { scaledValue: 500, scale: 2 } });
  const bundle = bundleWithCellsAndRows([], []); // nenhuma célula
  assertThrowsWithMessage(() => deriveMathEvidenceFieldStatesV2(relation, [], bundle), "integrity_error_applicable_field_without_expected_cell", "§C.2 (a)");
});

runTest("§C.2 — integrity_error_not_applicable_field_has_expected_cell: relação declara quantity não aplicável, mas uma célula col-quantidade existe mesmo assim", () => {
  const relation = syntheticMathRelation({ id: "rel-integrity-b", logicalRowId: "row-integrity-b", quantityScaled: null });
  const bundle = bundleWithCellsAndRows([syntheticMathCell("cell-integrity-b", "row-integrity-b", "col-quantidade", "10,00", null)], []);
  assertThrowsWithMessage(() => deriveMathEvidenceFieldStatesV2(relation, [], bundle), "integrity_error_not_applicable_field_has_expected_cell", "§C.2 (b)");
});

runTest("§C.2 — integrity_error_ambiguous_comparison_result_for_expected_cell: zero resultados de comparação para uma célula aplicável", () => {
  const relation = syntheticMathRelation({ id: "rel-integrity-c1", logicalRowId: "row-integrity-c1", quantityScaled: { scaledValue: 1, scale: 0 } });
  const bundle = bundleWithCellsAndRows([syntheticMathCell("cell-integrity-c1", "row-integrity-c1", "col-quantidade", "1", null)], []);
  assertThrowsWithMessage(() => deriveMathEvidenceFieldStatesV2(relation, [], bundle), "integrity_error_ambiguous_comparison_result_for_expected_cell", "§C.2 (c1, zero)");
});

runTest("§C.2 — integrity_error_ambiguous_comparison_result_for_expected_cell: mais de um resultado de comparação para a mesma célula aplicável", () => {
  const relation = syntheticMathRelation({ id: "rel-integrity-c2", logicalRowId: "row-integrity-c2", quantityScaled: { scaledValue: 1, scale: 0 } });
  const bundle = bundleWithCellsAndRows([syntheticMathCell("cell-integrity-c2", "row-integrity-c2", "col-quantidade", "1", null)], []);
  const fakeDuplicateResults: ReadonlyArray<LocalReaderCellComparisonResult> = [
    { id: "dup-1", referenceCellIds: ["cell-integrity-c2"], observedCellIds: ["obs-x"], outcome: "direct_match", normalizedExpectedText: "1", normalizedObservedText: "1", textualDistance: 0, associationBasisPt: "fixture" },
    { id: "dup-2", referenceCellIds: ["cell-integrity-c2"], observedCellIds: ["obs-y"], outcome: "direct_match", normalizedExpectedText: "1", normalizedObservedText: "1", textualDistance: 0, associationBasisPt: "fixture" },
  ];
  assertThrowsWithMessage(() => deriveMathEvidenceFieldStatesV2(relation, fakeDuplicateResults, bundle), "integrity_error_ambiguous_comparison_result_for_expected_cell", "§C.2 (c2, múltiplos)");
});

runTest("§C.2 — integrity_error_no_applicable_field (classifyLocalReaderMathEvidenceV2): relação sem nenhum campo aplicável", () => {
  const allNotApplicable: LocalReaderMathEvidenceFieldStatesV2 = { quantity: "not_applicable", unitPrice: "not_applicable", total: "not_applicable", subtotalOrTotal: "not_applicable" };
  assertThrowsWithMessage(() => classifyLocalReaderMathEvidenceV2("rel-no-applicable", allNotApplicable), "integrity_error_no_applicable_field", "§C.2 (nenhum campo aplicável)");
});

// --- §C.3: os 7 cenários de evidência (3C.1A §4), agora via relação+bundle+comparações reais ---

function evaluateMathScenario(relation: ReferenceTruthMathRelation, bundle: ReferenceTruthPageBundle, comparisons: ReadonlyArray<LocalReaderCellComparisonResult>) {
  const states = deriveMathEvidenceFieldStatesV2(relation, comparisons, bundle);
  return classifyLocalReaderMathEvidenceV2(relation.id, states);
}

runTest("§C.3 — item 1: item de serviço sem evidência (3 campos aplicáveis, todos expected_cell_omitted) → evidencia_ausente", () => {
  const rowId = "row-math-item-none";
  const relation = syntheticMathRelation({ id: "rel-math-item-none", logicalRowId: rowId, quantityScaled: { scaledValue: 1000, scale: 2 }, displayedUnitPriceCents: 10000, displayedTotalCents: 100000 });
  const cells = [
    syntheticMathCell("cell-mi-none-q", rowId, "col-quantidade", "10,00", null),
    syntheticMathCell("cell-mi-none-u", rowId, "col-unit-cbdi", "100,00", null),
    syntheticMathCell("cell-mi-none-t", rowId, "col-total-cbdi", "1.000,00", null),
  ];
  const bundle = bundleWithCellsAndRows(cells, []);
  const comparisons = associateObservedCellsToReference(cellRefsForComparison(cells), []);
  const result = evaluateMathScenario(relation, bundle, comparisons);
  assertEqual(result.availability, "evidencia_ausente");
  assertEqual(JSON.stringify([...result.missingFieldsPt].sort()), JSON.stringify(["preço unitário", "quantidade", "total"].sort()));
  assertEqual(result.divergentFieldsPt.length, 0);
});

runTest("§C.3 — item 2: item de serviço completo (3 campos, todos direct_match) → evidencia_completa", () => {
  const rowId = "row-math-item-full";
  const relation = syntheticMathRelation({ id: "rel-math-item-full", logicalRowId: rowId, quantityScaled: { scaledValue: 1000, scale: 2 }, displayedUnitPriceCents: 10000, displayedTotalCents: 100000 });
  const qCell = syntheticMathCell("cell-mi-full-q", rowId, "col-quantidade", "10,00", box(0, 300, 50, 320));
  const uCell = syntheticMathCell("cell-mi-full-u", rowId, "col-unit-cbdi", "100,00", box(0, 330, 50, 350));
  const tCell = syntheticMathCell("cell-mi-full-t", rowId, "col-total-cbdi", "1.000,00", box(0, 360, 50, 380));
  const bundle = bundleWithCellsAndRows([qCell, uCell, tCell], []);
  const observed: ReadonlyArray<LocalReaderObservedCellRef> = [
    { id: "obs-mi-full-q", realPageNumber: 999, columnId: null, normalizedText: "10,00", boundingBox: box(0, 300, 50, 320) },
    { id: "obs-mi-full-u", realPageNumber: 999, columnId: null, normalizedText: "100,00", boundingBox: box(0, 330, 50, 350) },
    { id: "obs-mi-full-t", realPageNumber: 999, columnId: null, normalizedText: "1.000,00", boundingBox: box(0, 360, 50, 380) },
  ];
  const comparisons = associateObservedCellsToReference(
    expectedCellRefsWithBoxes([
      [qCell, box(0, 300, 50, 320)],
      [uCell, box(0, 330, 50, 350)],
      [tCell, box(0, 360, 50, 380)],
    ]),
    observed,
  );
  const result = evaluateMathScenario(relation, bundle, comparisons);
  assertEqual(result.availability, "evidencia_completa");
  assertEqual(result.missingFieldsPt.length, 0);
  assertEqual(result.divergentFieldsPt.length, 0);
});

runTest("§C.3 — item 3: item de serviço parcial (2 direct_match, 1 expected_cell_omitted) → evidencia_parcial", () => {
  const rowId = "row-math-item-partial";
  const relation = syntheticMathRelation({ id: "rel-math-item-partial", logicalRowId: rowId, quantityScaled: { scaledValue: 1000, scale: 2 }, displayedUnitPriceCents: 10000, displayedTotalCents: 100000 });
  const qCell = syntheticMathCell("cell-mi-partial-q", rowId, "col-quantidade", "10,00", box(0, 400, 50, 420));
  const uCell = syntheticMathCell("cell-mi-partial-u", rowId, "col-unit-cbdi", "100,00", box(0, 430, 50, 450));
  const tCell = syntheticMathCell("cell-mi-partial-t", rowId, "col-total-cbdi", "1.000,00", box(0, 460, 50, 480));
  const bundle = bundleWithCellsAndRows([qCell, uCell, tCell], []);
  const observed: ReadonlyArray<LocalReaderObservedCellRef> = [
    { id: "obs-mi-partial-q", realPageNumber: 999, columnId: null, normalizedText: "10,00", boundingBox: box(0, 400, 50, 420) },
    { id: "obs-mi-partial-u", realPageNumber: 999, columnId: null, normalizedText: "100,00", boundingBox: box(0, 430, 50, 450) },
    // total: nenhum observado correspondente -> expected_cell_omitted
  ];
  const comparisons = associateObservedCellsToReference(
    expectedCellRefsWithBoxes([
      [qCell, box(0, 400, 50, 420)],
      [uCell, box(0, 430, 50, 450)],
      [tCell, box(0, 460, 50, 480)],
    ]),
    observed,
  );
  const result = evaluateMathScenario(relation, bundle, comparisons);
  assertEqual(result.availability, "evidencia_parcial");
  assertEqual(JSON.stringify(result.missingFieldsPt), JSON.stringify(["total"]));
  assertEqual(result.divergentFieldsPt.length, 0);
});

runTest("§C.3 — item 4: item de serviço divergente (unitPrice correct_coordinate_wrong_text) → evidencia_divergente_da_fonte", () => {
  const rowId = "row-math-item-divergent";
  const relation = syntheticMathRelation({ id: "rel-math-item-divergent", logicalRowId: rowId, quantityScaled: { scaledValue: 1000, scale: 2 }, displayedUnitPriceCents: 10000, displayedTotalCents: 100000 });
  const qCell = syntheticMathCell("cell-mi-div-q", rowId, "col-quantidade", "10,00", box(0, 500, 50, 520));
  const uCell = syntheticMathCell("cell-mi-div-u", rowId, "col-unit-cbdi", "100,00", box(0, 530, 50, 550));
  const tCell = syntheticMathCell("cell-mi-div-t", rowId, "col-total-cbdi", "1.000,00", box(0, 560, 50, 580));
  const bundle = bundleWithCellsAndRows([qCell, uCell, tCell], []);
  const observed: ReadonlyArray<LocalReaderObservedCellRef> = [
    { id: "obs-mi-div-q", realPageNumber: 999, columnId: null, normalizedText: "10,00", boundingBox: box(0, 500, 50, 520) },
    { id: "obs-mi-div-u", realPageNumber: 999, columnId: null, normalizedText: "999,99", boundingBox: box(0, 530, 50, 550) }, // mesma caixa, texto diferente
    { id: "obs-mi-div-t", realPageNumber: 999, columnId: null, normalizedText: "1.000,00", boundingBox: box(0, 560, 50, 580) },
  ];
  const comparisons = associateObservedCellsToReference(
    expectedCellRefsWithBoxes([
      [qCell, box(0, 500, 50, 520)],
      [uCell, box(0, 530, 50, 550)],
      [tCell, box(0, 560, 50, 580)],
    ]),
    observed,
  );
  const result = evaluateMathScenario(relation, bundle, comparisons);
  assertEqual(result.availability, "evidencia_divergente_da_fonte");
  assertEqual(JSON.stringify(result.divergentFieldsPt), JSON.stringify(["preço unitário"]));
});

runTest("§C.3 — item 5: grupo completo (subtotalOrTotal aplicável e direct_match; quantity/unitPrice/total not_applicable) → evidencia_completa", () => {
  const rowId = "row-math-group-full";
  const relation = syntheticMathRelation({ id: "rel-math-group-full", logicalRowId: rowId, officialSubtotalOrTotalCents: 500000 });
  const stCell = syntheticMathCell("cell-mg-full-st", rowId, "col-total-cbdi", "5.000,00", box(0, 600, 50, 620));
  const bundle = bundleWithCellsAndRows([stCell], []);
  const observed: ReadonlyArray<LocalReaderObservedCellRef> = [{ id: "obs-mg-full-st", realPageNumber: 999, columnId: null, normalizedText: "5.000,00", boundingBox: box(0, 600, 50, 620) }];
  const comparisons = associateObservedCellsToReference(expectedCellRefsWithBoxes([[stCell, box(0, 600, 50, 620)]]), observed);
  const result = evaluateMathScenario(relation, bundle, comparisons);
  assertEqual(result.availability, "evidencia_completa");
  assertEqual(result.fieldStates.quantity, "not_applicable");
  assertEqual(result.fieldStates.unitPrice, "not_applicable");
  assertEqual(result.fieldStates.total, "not_applicable");
  assertEqual(result.fieldStates.subtotalOrTotal, "present");
});

runTest("§C.3 — item 6: grupo ausente (subtotalOrTotal aplicável mas expected_cell_omitted) → evidencia_ausente", () => {
  const rowId = "row-math-group-missing";
  const relation = syntheticMathRelation({ id: "rel-math-group-missing", logicalRowId: rowId, officialSubtotalOrTotalCents: 500000 });
  const stCell = syntheticMathCell("cell-mg-missing-st", rowId, "col-total-cbdi", "5.000,00", null);
  const bundle = bundleWithCellsAndRows([stCell], []);
  const comparisons = associateObservedCellsToReference(cellRefsForComparison([stCell]), []);
  const result = evaluateMathScenario(relation, bundle, comparisons);
  assertEqual(result.availability, "evidencia_ausente");
  assertEqual(JSON.stringify(result.missingFieldsPt), JSON.stringify(["subtotal ou total oficial aplicável"]));
});

runTest("§C.3 — item 7: relação sem campo aplicável → integrity_error_no_applicable_field (via deriveMathEvidenceFieldStatesV2 + classifyLocalReaderMathEvidenceV2 encadeados)", () => {
  const rowId = "row-math-none-applicable";
  const relation = syntheticMathRelation({ id: "rel-math-none-applicable", logicalRowId: rowId });
  const bundle = bundleWithCellsAndRows([], []);
  const states = deriveMathEvidenceFieldStatesV2(relation, [], bundle);
  assertEqual(states.quantity, "not_applicable");
  assertEqual(states.unitPrice, "not_applicable");
  assertEqual(states.total, "not_applicable");
  assertEqual(states.subtotalOrTotal, "not_applicable");
  assertThrowsWithMessage(() => classifyLocalReaderMathEvidenceV2(relation.id, states), "integrity_error_no_applicable_field", "§C.3 item 7");
});

runTest("§C.3 — not_applicable nunca aparece em missingFieldsPt nem divergentFieldsPt, em nenhum dos cenários acima com resultado válido", () => {
  const rowId = "row-math-audit";
  const relation = syntheticMathRelation({ id: "rel-math-audit", logicalRowId: rowId, quantityScaled: { scaledValue: 1, scale: 0 } });
  const qCell = syntheticMathCell("cell-math-audit-q", rowId, "col-quantidade", "1", null);
  const bundle = bundleWithCellsAndRows([qCell], []);
  const comparisons = associateObservedCellsToReference(cellRefsForComparison([qCell]), []);
  const result = evaluateMathScenario(relation, bundle, comparisons);
  assert(!result.missingFieldsPt.includes("preço unitário"), "unitPrice é not_applicable nesta relação — não deveria aparecer em missingFieldsPt");
  assert(!result.missingFieldsPt.includes("total"), "total é not_applicable nesta relação — não deveria aparecer em missingFieldsPt");
  assert(!result.missingFieldsPt.includes("subtotal ou total oficial aplicável"), "subtotalOrTotal é not_applicable nesta relação — não deveria aparecer em missingFieldsPt");
  assertEqual(result.divergentFieldsPt.length, 0);
});

runTest("stub v1 histórico: deriveMathEvidenceFieldsV2 (Record<4,boolean>, superado) continua lançando 'not implemented'", () => {
  assertThrows(() => deriveMathEvidenceFieldsV2({} as never, [], {} as never), "deveria continuar lançando — nunca reimplementado, apenas registro histórico");
});

// ============================================================================
// §D — Insumos de viabilidade (Problema E). Momento 3C.1B §... / enunciado 3C.2 §3.5.
// ============================================================================

const VIABILITY_PAGE = 999;

function baseViabilityScenario(): {
  readonly execution: Parameters<typeof deriveViabilityInputsV2>[0]["execution"];
  readonly allCellComparisons: LocalReaderCellComparisonResult[];
  readonly allObservedCells: LocalReaderObservedCellRef[];
  readonly criticalFields: Parameters<typeof deriveViabilityInputsV2>[0]["criticalFields"];
  readonly criticalFieldCellIds: Set<string>;
  readonly regionTextByPageV2: Record<number, ReturnType<typeof computeLocalReaderRegionTextMetricsV2>>;
  readonly rawOutputHashMatchByPage: Record<number, boolean>;
  readonly acquisitionMetaByPage: Record<number, Record<string, unknown>>;
} {
  const criticalCellId = "cell-viability-critical";
  const observedCellId = "obs-viability-critical";
  const directMatch: LocalReaderCellComparisonResult = {
    id: "cmp-viability-critical",
    referenceCellIds: [criticalCellId],
    observedCellIds: [observedCellId],
    outcome: "direct_match",
    normalizedExpectedText: "10,00",
    normalizedObservedText: "10,00",
    textualDistance: 0,
    associationBasisPt: "fixture sintética",
  };
  return {
    execution: { pagesCompleted: 3, pagesFailed: 0, coldStartTimeMs: 100, perPageTimeMs: [], peakMemoryMb: 100, warnings: [], partialFailures: [] },
    allCellComparisons: [directMatch],
    allObservedCells: [{ id: observedCellId, realPageNumber: VIABILITY_PAGE, columnId: null, normalizedText: "10,00", boundingBox: box(0, 0, 50, 20) }],
    criticalFields: [
      { role: "quantidade", itemsTotal: 1, literalMatches: 1, exactDecimalValueMatches: 1, mismatches: 0 },
      { role: "item", itemsTotal: 0, literalMatches: 0, exactDecimalValueMatches: null, mismatches: 0 },
    ],
    criticalFieldCellIds: new Set([criticalCellId]),
    regionTextByPageV2: { [VIABILITY_PAGE]: { associationComponents: 1, expectedRegionsCoveredByAnyComponent: 1, expectedRegionsWithExactTextualMatch: 1, expectedRegionsCoveredSpatiallyOnly: 0, expectedRegionsOmitted: 0, observedRegionsAdditional: 0 } },
    rawOutputHashMatchByPage: { [VIABILITY_PAGE]: true },
    acquisitionMetaByPage: { [VIABILITY_PAGE]: { hfHubOffline: "1", transformersOffline: "1", warnings: [], errors: [], configurationSummaryPt: "fixture offline docling" } },
  };
}

runTest("§D — cenário base: todos os insumos corrigidos corretamente derivados (nenhuma constante mascarando entrada) → candidato_principal", () => {
  const s = baseViabilityScenario();
  const inputs = deriveViabilityInputsV2({ tool: "docling", incorporatedTcuNoteAsItemOrValue: false, ...s });
  const expectedInputs: LocalReaderViabilityGateInputs = {
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
    providedRelevantTraceableComplementaryEvidence: true,
  };
  assertEqual(JSON.stringify(inputs), JSON.stringify(expectedInputs));
  assertEqual(classifyLocalReaderViability(inputs).classification, "candidato_principal");
});

runTest("§D — impedingInstability: aviso real em execution.warnings muda o veredito para não viável (nenhuma constante false mascarando)", () => {
  const s = baseViabilityScenario();
  const inputs = deriveViabilityInputsV2({ tool: "docling", incorporatedTcuNoteAsItemOrValue: false, ...s, execution: { ...s.execution, warnings: ["aviso real de execução"] } });
  assertEqual(inputs.impedingInstability, true);
  assertEqual(classifyLocalReaderViability(inputs).classification, "nao_viavel_nesta_configuracao");
});

runTest("§D — requiredNetworkOrExternalService: evidência registrada (não ausência presumida) de tentativa de rede muda o veredito", () => {
  const s = baseViabilityScenario();
  const inputs = deriveViabilityInputsV2({
    tool: "docling",
    incorporatedTcuNoteAsItemOrValue: false,
    ...s,
    acquisitionMetaByPage: { [VIABILITY_PAGE]: { ...s.acquisitionMetaByPage[VIABILITY_PAGE], warnings: ["download attempt failed, retrying"] } },
  });
  assertEqual(inputs.requiredNetworkOrExternalService, true);
  assertEqual(classifyLocalReaderViability(inputs).classification, "nao_viavel_nesta_configuracao");
});

runTest("§D — inventedMonetaryValue: invented_cell com texto monetário congelado muda o veredito", () => {
  const s = baseViabilityScenario();
  const invented: LocalReaderCellComparisonResult = {
    id: "cmp-invented",
    referenceCellIds: [],
    observedCellIds: ["obs-invented"],
    outcome: "invented_cell",
    normalizedExpectedText: null,
    normalizedObservedText: "1.234,56",
    textualDistance: null,
    associationBasisPt: "fixture sintética",
  };
  const inputs = deriveViabilityInputsV2({ tool: "docling", incorporatedTcuNoteAsItemOrValue: false, ...s, allCellComparisons: [...s.allCellComparisons, invented] });
  assertEqual(inputs.inventedMonetaryValue, true);
  assertEqual(classifyLocalReaderViability(inputs).classification, "nao_viavel_nesta_configuracao");
});

runTest("§D — providedPhysicalOriginForCriticalFields: remover a coordenada convertida da célula observada muda o veredito (nunca usa physicalRegionIds da célula esperada)", () => {
  const s = baseViabilityScenario();
  const inputs = deriveViabilityInputsV2({
    tool: "docling",
    incorporatedTcuNoteAsItemOrValue: false,
    ...s,
    allObservedCells: s.allObservedCells.map((o) => ({ ...o, boundingBox: null })),
  });
  assertEqual(inputs.providedPhysicalOriginForCriticalFields, false);
  assertEqual(classifyLocalReaderViability(inputs).classification, "nao_viavel_nesta_configuracao");
});

runTest("§D — candidato_complementar: portão principal falha (reproducibleConfiguration=false) mas evidência complementar rastreável permanece", () => {
  const s = baseViabilityScenario();
  const inputs = deriveViabilityInputsV2({ tool: "docling", incorporatedTcuNoteAsItemOrValue: false, ...s, rawOutputHashMatchByPage: { [VIABILITY_PAGE]: false } });
  assertEqual(inputs.reproducibleConfiguration, false);
  assertEqual(inputs.providedRelevantTraceableComplementaryEvidence, true);
  assertEqual(classifyLocalReaderViability(inputs).classification, "candidato_complementar");
});

runTest("§D — não viável (nem portão principal nem evidência complementar): reproducibleConfiguration=false e nenhuma correspondência textual exata", () => {
  const s = baseViabilityScenario();
  const inputs = deriveViabilityInputsV2({
    tool: "docling",
    incorporatedTcuNoteAsItemOrValue: false,
    ...s,
    rawOutputHashMatchByPage: { [VIABILITY_PAGE]: false },
    regionTextByPageV2: { [VIABILITY_PAGE]: { ...s.regionTextByPageV2[VIABILITY_PAGE], expectedRegionsWithExactTextualMatch: 0 } },
  });
  assertEqual(inputs.providedRelevantTraceableComplementaryEvidence, false);
  assertEqual(classifyLocalReaderViability(inputs).classification, "nao_viavel_nesta_configuracao");
});

runTest("§D — providedRelevantTraceableComplementaryEvidence: usa apenas correspondência textual exata (Problema A), nunca sobreposição espacial grosseira isolada", () => {
  const s = baseViabilityScenario();
  const inputs = deriveViabilityInputsV2({
    tool: "paddleocr",
    incorporatedTcuNoteAsItemOrValue: false,
    ...s,
    regionTextByPageV2: { [VIABILITY_PAGE]: { associationComponents: 1, expectedRegionsCoveredByAnyComponent: 1, expectedRegionsWithExactTextualMatch: 0, expectedRegionsCoveredSpatiallyOnly: 1, expectedRegionsOmitted: 0, observedRegionsAdditional: 0 } },
  });
  assertEqual(inputs.providedRelevantTraceableComplementaryEvidence, false, "cobertura apenas espacial (sem correspondência textual exata) não deveria contar como evidência complementar rastreável");
});
