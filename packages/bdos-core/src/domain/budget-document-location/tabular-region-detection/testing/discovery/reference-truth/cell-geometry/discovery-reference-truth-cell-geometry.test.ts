/**
 * Testes sintéticos do algoritmo genérico de geometria esperada (§14 do
 * enunciado da Sprint). Nenhum dado real: nenhuma página 46/50/54,
 * nenhum hash real de segmento, nenhum código de item real, nenhum
 * texto do documento — apenas fixtures sintéticas construídas neste
 * próprio arquivo, cobrindo cada cenário exigido.
 */
import { createHash } from "node:crypto";
import type { ReferenceTruthCell, ReferenceTruthColumn, ReferenceTruthLogicalRow, ReferenceTruthPhysicalRegion } from "../discovery-reference-truth.types";
import {
  projectReferenceTruthCellGeometry,
  buildReferenceTruthCellGeometry,
} from "./discovery-reference-truth-cell-geometry";
import { validateReferenceTruthCellGeometries } from "./discovery-reference-truth-cell-geometry-validation";
import { parseReferenceTruthCellPhysicalOrigin } from "./discovery-reference-truth-cell-geometry-origin-parser";
import type { ReferenceTruthCellGeometryPageBounds, ReferenceTruthCellGeometryProjectionInput } from "./discovery-reference-truth-cell-geometry.types";

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

/** Chave sintética de 64 caracteres hex, derivada apenas de um rótulo sintético local — nunca um hash real de documento ou segmento. */
function syntheticSegmentKey(label: string): string {
  return createHash("sha256").update(`synthetic-fixture:${label}`).digest("hex");
}

const PAGE = 9001;
const OTHER_PAGE = 9002;
const PAGE_WIDTH = 1000;
const PAGE_HEIGHT = 800;

const PAGE_BOUNDS: ReadonlyArray<ReferenceTruthCellGeometryPageBounds> = [
  { realPageNumber: PAGE, pageWidthPoints: PAGE_WIDTH, pageHeightPoints: PAGE_HEIGHT },
  { realPageNumber: OTHER_PAGE, pageWidthPoints: PAGE_WIDTH, pageHeightPoints: PAGE_HEIGHT },
];

const COLUMNS: ReadonlyArray<ReferenceTruthColumn> = [
  { id: "col-separate-a", role: "item", observedHeaderLabelPt: "A", horizontalIntervalPoints: { leftPoints: 0, rightPoints: 100 }, presentOnPages: [PAGE], variationAcrossPagesPt: "n/a", frequentPhysicalMergeWithColumnId: null },
  { id: "col-separate-b", role: "codigo", observedHeaderLabelPt: "B", horizontalIntervalPoints: { leftPoints: 200, rightPoints: 300 }, presentOnPages: [PAGE], variationAcrossPagesPt: "n/a", frequentPhysicalMergeWithColumnId: null },
  { id: "col-overlap-c", role: "fonte", observedHeaderLabelPt: "C", horizontalIntervalPoints: { leftPoints: 400, rightPoints: 500 }, presentOnPages: [PAGE], variationAcrossPagesPt: "n/a", frequentPhysicalMergeWithColumnId: null },
  { id: "col-overlap-d", role: "tipo", observedHeaderLabelPt: "D", horizontalIntervalPoints: { leftPoints: 470, rightPoints: 560 }, presentOnPages: [PAGE], variationAcrossPagesPt: "n/a", frequentPhysicalMergeWithColumnId: null },
  { id: "col-identical-e", role: "unidade", observedHeaderLabelPt: "E", horizontalIntervalPoints: { leftPoints: 600, rightPoints: 700 }, presentOnPages: [PAGE], variationAcrossPagesPt: "n/a", frequentPhysicalMergeWithColumnId: "col-identical-f" },
  { id: "col-identical-f", role: "quantidade", observedHeaderLabelPt: "F", horizontalIntervalPoints: { leftPoints: 600, rightPoints: 700 }, presentOnPages: [PAGE], variationAcrossPagesPt: "n/a", frequentPhysicalMergeWithColumnId: "col-identical-e" },
  { id: "col-descricao", role: "descricao", observedHeaderLabelPt: "DESCR", horizontalIntervalPoints: { leftPoints: 700, rightPoints: 900 }, presentOnPages: [PAGE], variationAcrossPagesPt: "n/a", frequentPhysicalMergeWithColumnId: null },
];

function column(id: string): ReferenceTruthColumn {
  const found = COLUMNS.find((c) => c.id === id);
  if (found === undefined) throw new Error(`unknown synthetic column ${id}`);
  return found;
}

function region(id: string, page: number, box: { left: number; top: number; right: number; bottom: number }, segmentKeys: ReadonlyArray<string>): ReferenceTruthPhysicalRegion {
  return {
    id,
    realPageNumber: page,
    verticalOrder: 1,
    boundingBox: { leftPoints: box.left, topPoints: box.top, rightPoints: box.right, bottomPoints: box.bottom },
    observedText: "synthetic fixture text",
    lineKey: null,
    segmentKeys,
    classification: "conteudo_tabular",
    classificationBasisPt: "synthetic fixture",
    classificationProvenancePt: "synthetic fixture",
  };
}

function row(id: string, regionIds: ReadonlyArray<string>, cellIds: ReadonlyArray<string>): ReferenceTruthLogicalRow {
  return {
    id,
    type: "item_de_servico",
    cellIds,
    physicalRegionIds: regionIds,
    continuityRelationPt: "synthetic fixture",
    startRealPageNumber: PAGE,
    endRealPageNumber: PAGE,
    observedHierarchicalCode: null,
    parentLogicalRowId: null,
  };
}

function cell(id: string, logicalRowId: string, columnId: string, literalText: string, physicalOriginPt: string, page: number = PAGE): ReferenceTruthCell {
  return {
    id,
    realPageNumber: page,
    logicalRowId,
    columnId,
    physicalRegionIds: [],
    literalText,
    interpretedValue: literalText.length === 0 ? null : { kind: "text", value: literalText },
    observedType: literalText.length === 0 ? "vazio_intencional" : "incerto",
    displayedDecimalPrecision: null,
    physicalOriginPt,
  };
}

function origin(...keys: ReadonlyArray<string>): string {
  return `Segmento(s): ${keys.join(", ")}`;
}

// ============================================================================
// Cenário 1: uma célula, um segmento (caso exclusivo simples).
// ============================================================================
runTest("uma célula com um segmento produz single_source_fragment/exclusive com fragmento por interseção de coluna", () => {
  const segKey = syntheticSegmentKey("single-cell-single-segment");
  const reg = region("reg-1", PAGE, { left: 0, top: 10, right: 100, bottom: 20 }, [segKey]);
  const r = row("row-1", ["reg-1"], ["cell-1"]);
  const c = cell("cell-1", "row-1", "col-separate-a", "VALOR", origin(segKey));

  const input: ReferenceTruthCellGeometryProjectionInput = {
    cells: [c],
    logicalRows: [r],
    physicalRegions: [reg],
    columns: [column("col-separate-a")],
    physicalSegments: [{ segmentKey: segKey, realPageNumber: PAGE, boundingBox: { leftPoints: 5, topPoints: 10, rightPoints: 95, bottomPoints: 20 } }],
    pageBounds: PAGE_BOUNDS,
  };

  const result = projectReferenceTruthCellGeometry(input);
  assertEqual(result.integrityIssues.length, 0);
  assertEqual(result.geometries.length, 1);
  const g = result.geometries[0];
  assertEqual(g.resolutionKind, "single_source_fragment");
  assertEqual(g.spatialSemantics, "exclusive");
  assertEqual(g.fragments.length, 1);
  assertEqual(g.fragments[0].projectionKind, "source_segment_column_intersection");
  assertEqual(g.sharedGeometryGroupId, null);
});

// ============================================================================
// Cenário 2: uma célula, vários segmentos (multi_fragment) — preserva ordem.
// ============================================================================
runTest("uma célula com vários segmentos produz multiple_source_fragments/multi_fragment preservando a ordem declarada", () => {
  const segA = syntheticSegmentKey("multi-segment-a");
  const segB = syntheticSegmentKey("multi-segment-b");
  const reg = region("reg-2", PAGE, { left: 700, top: 10, right: 900, bottom: 40 }, [segA, segB]);
  const r = row("row-2", ["reg-2"], ["cell-2"]);
  const c = cell("cell-2", "row-2", "col-descricao", "LINHA A LINHA B", origin(segA, segB));

  const input: ReferenceTruthCellGeometryProjectionInput = {
    cells: [c],
    logicalRows: [r],
    physicalRegions: [reg],
    columns: [column("col-descricao")],
    physicalSegments: [
      { segmentKey: segA, realPageNumber: PAGE, boundingBox: { leftPoints: 710, topPoints: 10, rightPoints: 800, bottomPoints: 20 } },
      { segmentKey: segB, realPageNumber: PAGE, boundingBox: { leftPoints: 710, topPoints: 25, rightPoints: 810, bottomPoints: 35 } },
    ],
    pageBounds: PAGE_BOUNDS,
  };

  const result = projectReferenceTruthCellGeometry(input);
  assertEqual(result.integrityIssues.length, 0);
  const g = result.geometries[0];
  assertEqual(g.resolutionKind, "multiple_source_fragments");
  assertEqual(g.spatialSemantics, "multi_fragment");
  assertEqual(g.fragments.length, 2);
  assertEqual(g.fragments[0].sourceSegmentKey, segA, "fragment order must follow the declared physicalOriginPt order, not any other order");
  assertEqual(g.fragments[1].sourceSegmentKey, segB);
  assert(g.expectedEnvelope.topPoints === 10 && g.expectedEnvelope.bottomPoints === 35, "envelope must be the union of both fragments");
});

// ============================================================================
// Cenário 3: várias células, um segmento — colunas separadas (grupo compartilhado).
// ============================================================================
runTest("várias células compartilhando um segmento sobre colunas separadas recebem spatialSemantics=shared com fragmentos distintos por interseção", () => {
  const sharedKey = syntheticSegmentKey("shared-separate-columns");
  const reg = region("reg-3", PAGE, { left: 0, top: 50, right: 300, bottom: 60 }, [sharedKey]);
  const r = row("row-3", ["reg-3"], ["cell-3a", "cell-3b"]);
  const cA = cell("cell-3a", "row-3", "col-separate-a", "X", origin(sharedKey));
  const cB = cell("cell-3b", "row-3", "col-separate-b", "Y", origin(sharedKey));

  const input: ReferenceTruthCellGeometryProjectionInput = {
    cells: [cA, cB],
    logicalRows: [r],
    physicalRegions: [reg],
    columns: [column("col-separate-a"), column("col-separate-b")],
    // The single physical segment spans across both non-overlapping columns (0-100 and 200-300).
    physicalSegments: [{ segmentKey: sharedKey, realPageNumber: PAGE, boundingBox: { leftPoints: 10, topPoints: 50, rightPoints: 290, bottomPoints: 60 } }],
    pageBounds: PAGE_BOUNDS,
  };

  const result = projectReferenceTruthCellGeometry(input);
  assertEqual(result.integrityIssues.length, 0);
  assertEqual(result.geometries.length, 2);
  const [gA, gB] = result.geometries;
  assertEqual(gA.resolutionKind, "shared_source_geometry");
  assertEqual(gA.spatialSemantics, "shared");
  assertEqual(gB.spatialSemantics, "shared");
  assertEqual(gA.sharedGeometryGroupId, `shared-geometry:${PAGE}:${sharedKey}`);
  assertEqual(gA.sharedGeometryGroupId, gB.sharedGeometryGroupId);
  assert(gA.sharedWithCellIds.includes("cell-3b"), "cell-3a must list cell-3b as a partner");
  assert(gB.sharedWithCellIds.includes("cell-3a"), "cell-3b must list cell-3a as a partner (symmetry)");
  // Because the two columns are separated and the shared segment spans both, each cell still gets a distinct intersection fragment.
  assertEqual(gA.fragments[0].projectionKind, "source_segment_column_intersection");
  assertEqual(gB.fragments[0].projectionKind, "source_segment_column_intersection");
  assert(gA.fragments[0].projectedBoundingBox.rightPoints <= 100, "cell-3a's fragment must stay within col-separate-a");
  assert(gB.fragments[0].projectedBoundingBox.leftPoints >= 200, "cell-3b's fragment must stay within col-separate-b");
});

// ============================================================================
// Cenário 4: colunas sobrepostas — segmento compartilhado sem subdivisão física real cai para exact_box.
// ============================================================================
runTest("colunas sobrepostas: quando o segmento compartilhado não permite subdivisão física real, o fragmento usa source_segment_exact_box", () => {
  const sharedKey = syntheticSegmentKey("shared-overlapping-columns");
  const reg = region("reg-4", PAGE, { left: 400, top: 70, right: 560, bottom: 80 }, [sharedKey]);
  const r = row("row-4", ["reg-4"], ["cell-4a", "cell-4b"]);
  const cA = cell("cell-4a", "row-4", "col-overlap-c", "X", origin(sharedKey));
  const cB = cell("cell-4b", "row-4", "col-overlap-d", "Y", origin(sharedKey));

  const input: ReferenceTruthCellGeometryProjectionInput = {
    cells: [cA, cB],
    logicalRows: [r],
    physicalRegions: [reg],
    columns: [column("col-overlap-c"), column("col-overlap-d")],
    // Segment box is entirely inside col-overlap-c's range (400-500) and does not reach col-overlap-d (470-560) at all... adjust to force zero intersection with d:
    physicalSegments: [{ segmentKey: sharedKey, realPageNumber: PAGE, boundingBox: { leftPoints: 405, topPoints: 70, rightPoints: 460, bottomPoints: 80 } }],
    pageBounds: PAGE_BOUNDS,
  };

  const result = projectReferenceTruthCellGeometry(input);
  assertEqual(result.integrityIssues.length, 0);
  const gA = result.geometries.find((g) => g.cellId === "cell-4a")!;
  const gB = result.geometries.find((g) => g.cellId === "cell-4b")!;
  assertEqual(gA.fragments[0].projectionKind, "source_segment_column_intersection", "cell-4a's column does intersect the segment");
  assertEqual(gB.fragments[0].projectionKind, "source_segment_exact_box", "cell-4b's column does not intersect the segment at all, but the segment is legitimately shared, so the full physical box is preserved");
  assert(gB.fragments[0].projectedBoundingBox.leftPoints === 405 && gB.fragments[0].projectedBoundingBox.rightPoints === 460, "exact_box fragment must reproduce the untouched physical segment box");
});

// ============================================================================
// Cenário 5: colunas idênticas — ambas as células recebem a mesma interseção (a própria coluna), sem separação artificial.
// ============================================================================
runTest("colunas idênticas: duas células lógicas distintas sobre a mesma faixa de coluna não são artificialmente separadas", () => {
  const sharedKey = syntheticSegmentKey("shared-identical-columns");
  const reg = region("reg-5", PAGE, { left: 600, top: 90, right: 700, bottom: 100 }, [sharedKey]);
  const r = row("row-5", ["reg-5"], ["cell-5a", "cell-5b"]);
  const cA = cell("cell-5a", "row-5", "col-identical-e", "X", origin(sharedKey));
  const cB = cell("cell-5b", "row-5", "col-identical-f", "Y", origin(sharedKey));

  const input: ReferenceTruthCellGeometryProjectionInput = {
    cells: [cA, cB],
    logicalRows: [r],
    physicalRegions: [reg],
    columns: [column("col-identical-e"), column("col-identical-f")],
    physicalSegments: [{ segmentKey: sharedKey, realPageNumber: PAGE, boundingBox: { leftPoints: 605, topPoints: 90, rightPoints: 695, bottomPoints: 100 } }],
    pageBounds: PAGE_BOUNDS,
  };

  const result = projectReferenceTruthCellGeometry(input);
  assertEqual(result.integrityIssues.length, 0);
  const gA = result.geometries.find((g) => g.cellId === "cell-5a")!;
  const gB = result.geometries.find((g) => g.cellId === "cell-5b")!;
  assertEqual(gA.spatialSemantics, "shared");
  assertEqual(gB.spatialSemantics, "shared");
  assert(
    gA.fragments[0].projectedBoundingBox.leftPoints === gB.fragments[0].projectedBoundingBox.leftPoints &&
      gA.fragments[0].projectedBoundingBox.rightPoints === gB.fragments[0].projectedBoundingBox.rightPoints,
    "identical column bands must yield identical (never artificially separated) horizontal fragment bounds",
  );
});

// ============================================================================
// Cenário 6: descrição multilinha — cada célula física mantém seu próprio registro geométrico, ordem preservada, sem colapso.
// ============================================================================
runTest("descrição multilinha: três células físicas permanecem três registros geométricos distintos, em ordem vertical crescente", () => {
  const seg1 = syntheticSegmentKey("multiline-1");
  const seg2 = syntheticSegmentKey("multiline-2");
  const seg3 = syntheticSegmentKey("multiline-3");
  const reg1 = region("reg-6a", PAGE, { left: 700, top: 100, right: 900, bottom: 110 }, [seg1]);
  const reg2 = region("reg-6b", PAGE, { left: 700, top: 111, right: 900, bottom: 121 }, [seg2]);
  const reg3 = region("reg-6c", PAGE, { left: 700, top: 122, right: 900, bottom: 132 }, [seg3]);
  const r = row("row-6", ["reg-6a", "reg-6b", "reg-6c"], ["cell-6a", "cell-6b", "cell-6c"]);
  const cA = cell("cell-6a", "row-6", "col-descricao", "linha um", origin(seg1));
  const cB = cell("cell-6b", "row-6", "col-descricao", "linha dois", origin(seg2));
  const cC = cell("cell-6c", "row-6", "col-descricao", "linha tres", origin(seg3));

  const input: ReferenceTruthCellGeometryProjectionInput = {
    cells: [cA, cB, cC],
    logicalRows: [r],
    physicalRegions: [reg1, reg2, reg3],
    columns: [column("col-descricao")],
    physicalSegments: [
      { segmentKey: seg1, realPageNumber: PAGE, boundingBox: { leftPoints: 710, topPoints: 100, rightPoints: 800, bottomPoints: 110 } },
      { segmentKey: seg2, realPageNumber: PAGE, boundingBox: { leftPoints: 710, topPoints: 111, rightPoints: 800, bottomPoints: 121 } },
      { segmentKey: seg3, realPageNumber: PAGE, boundingBox: { leftPoints: 710, topPoints: 122, rightPoints: 800, bottomPoints: 132 } },
    ],
    pageBounds: PAGE_BOUNDS,
  };

  const result = projectReferenceTruthCellGeometry(input);
  assertEqual(result.integrityIssues.length, 0);
  assertEqual(result.geometries.length, 3, "three physical description cells must remain three geometry records, never collapsed into one");
  const tops = result.geometries.map((g) => g.expectedEnvelope.topPoints);
  assert(tops[0] < tops[1] && tops[1] < tops[2], "vertical order must be strictly increasing, never inverted or collapsed");
  result.geometries.forEach((g) => assertEqual(g.logicalRowId, "row-6"));
});

// ============================================================================
// Cenário 7: célula fisicamente vazia -> row_column_empty_slot.
// ============================================================================
runTest("célula fisicamente vazia produz empty_slot_projection a partir da faixa da linha x faixa da coluna", () => {
  const anchorSeg = syntheticSegmentKey("empty-slot-anchor");
  const reg = region("reg-7", PAGE, { left: 200, top: 140, right: 300, bottom: 150 }, [anchorSeg]);
  const r = row("row-7", ["reg-7"], ["cell-7"]);
  const c = cell("cell-7", "row-7", "col-separate-b", "", "Vazio: nenhuma origem física declarada na verdade de referência");

  const input: ReferenceTruthCellGeometryProjectionInput = {
    cells: [c],
    logicalRows: [r],
    physicalRegions: [reg],
    columns: [column("col-separate-b")],
    physicalSegments: [],
    pageBounds: PAGE_BOUNDS,
  };

  const result = projectReferenceTruthCellGeometry(input);
  assertEqual(result.integrityIssues.length, 0);
  const g = result.geometries[0];
  assertEqual(g.resolutionKind, "empty_slot_projection");
  assertEqual(g.spatialSemantics, "empty_slot");
  assertEqual(g.fragments[0].projectionKind, "row_column_empty_slot");
  assertEqual(g.fragments[0].sourceSegmentKey, null);
  assertEqual(g.expectedEnvelope.topPoints, g.rowBand.topPoints);
  assertEqual(g.expectedEnvelope.leftPoints, 200);
  assertEqual(g.expectedEnvelope.rightPoints, 300);
});

runTest("célula vazia cujo physicalOriginPt declara um segmento real é um erro de integridade, nunca empty_slot silencioso", () => {
  const segKey = syntheticSegmentKey("empty-but-declares-origin");
  const reg = region("reg-7b", PAGE, { left: 200, top: 140, right: 300, bottom: 150 }, [segKey]);
  const r = row("row-7b", ["reg-7b"], ["cell-7b"]);
  const c = cell("cell-7b", "row-7b", "col-separate-b", "", origin(segKey));

  const input: ReferenceTruthCellGeometryProjectionInput = {
    cells: [c],
    logicalRows: [r],
    physicalRegions: [reg],
    columns: [column("col-separate-b")],
    physicalSegments: [{ segmentKey: segKey, realPageNumber: PAGE, boundingBox: { leftPoints: 205, topPoints: 140, rightPoints: 295, bottomPoints: 150 } }],
    pageBounds: PAGE_BOUNDS,
  };

  const result = projectReferenceTruthCellGeometry(input);
  assertEqual(result.geometries.length, 0);
  assertEqual(result.integrityIssues.length, 1);
  assertEqual(result.integrityIssues[0].code, "empty_cell_declares_origin");
});

// ============================================================================
// Cenário 8: segmento inexistente.
// ============================================================================
runTest("segmentKey inexistente no registro físico é um erro de integridade, nunca aproximado", () => {
  const reg = region("reg-8", PAGE, { left: 0, top: 160, right: 100, bottom: 170 }, []);
  const r = row("row-8", ["reg-8"], ["cell-8"]);
  const missingKey = syntheticSegmentKey("does-not-exist-in-registry");
  const c = cell("cell-8", "row-8", "col-separate-a", "X", origin(missingKey));

  const result = projectReferenceTruthCellGeometry({
    cells: [c],
    logicalRows: [r],
    physicalRegions: [reg],
    columns: [column("col-separate-a")],
    physicalSegments: [],
    pageBounds: PAGE_BOUNDS,
  });

  assertEqual(result.geometries.length, 0);
  assertEqual(result.integrityIssues.length, 1);
  assertEqual(result.integrityIssues[0].code, "segment_not_found");
});

// ============================================================================
// Cenário 9: segmento de página incorreta.
// ============================================================================
runTest("segmentKey resolvido em página diferente da célula é um erro de integridade, nunca aceito", () => {
  const segKey = syntheticSegmentKey("wrong-page-segment");
  const reg = region("reg-9", PAGE, { left: 0, top: 180, right: 100, bottom: 190 }, [segKey]);
  const r = row("row-9", ["reg-9"], ["cell-9"]);
  const c = cell("cell-9", "row-9", "col-separate-a", "X", origin(segKey));

  const result = projectReferenceTruthCellGeometry({
    cells: [c],
    logicalRows: [r],
    physicalRegions: [reg],
    columns: [column("col-separate-a")],
    physicalSegments: [{ segmentKey: segKey, realPageNumber: OTHER_PAGE, boundingBox: { leftPoints: 5, topPoints: 180, rightPoints: 95, bottomPoints: 190 } }],
    pageBounds: PAGE_BOUNDS,
  });

  assertEqual(result.geometries.length, 0);
  assertEqual(result.integrityIssues.length, 1);
  assertEqual(result.integrityIssues[0].code, "segment_wrong_page");
});

// ============================================================================
// Cenário 10: origem ambígua (registro físico contém a mesma chave com duas geometrias distintas).
// ============================================================================
runTest("segmentKey ambíguo no registro físico (duas geometrias distintas para a mesma chave) é um erro de integridade", () => {
  const ambiguousKey = syntheticSegmentKey("ambiguous-registry-key");
  const reg = region("reg-10", PAGE, { left: 0, top: 200, right: 100, bottom: 210 }, [ambiguousKey]);
  const r = row("row-10", ["reg-10"], ["cell-10"]);
  const c = cell("cell-10", "row-10", "col-separate-a", "X", origin(ambiguousKey));

  const result = projectReferenceTruthCellGeometry({
    cells: [c],
    logicalRows: [r],
    physicalRegions: [reg],
    columns: [column("col-separate-a")],
    physicalSegments: [
      { segmentKey: ambiguousKey, realPageNumber: PAGE, boundingBox: { leftPoints: 5, topPoints: 200, rightPoints: 95, bottomPoints: 210 } },
      { segmentKey: ambiguousKey, realPageNumber: PAGE, boundingBox: { leftPoints: 6, topPoints: 200, rightPoints: 96, bottomPoints: 210 } },
    ],
    pageBounds: PAGE_BOUNDS,
  });

  assertEqual(result.geometries.length, 0);
  assertEqual(result.integrityIssues.length, 1);
  assertEqual(result.integrityIssues[0].code, "segment_key_ambiguous_in_registry");
});

runTest("physicalOriginPt malformado (prefixo ausente, chave inválida ou chave duplicada) é rejeitado pelo parser estrito", () => {
  assertEqual(parseReferenceTruthCellPhysicalOrigin("nao comeca com o prefixo esperado").kind, "malformed");
  assertEqual(parseReferenceTruthCellPhysicalOrigin("Segmento(s): ").kind, "malformed");
  assertEqual(parseReferenceTruthCellPhysicalOrigin("Segmento(s): abc123").kind, "malformed", "chave curta demais nunca é aceita");
  assertEqual(parseReferenceTruthCellPhysicalOrigin(`Segmento(s): ${"g".repeat(64)}`).kind, "malformed", "caractere fora de [0-9a-f] nunca é aceito");
  assertEqual(parseReferenceTruthCellPhysicalOrigin(`Segmento(s): ${"a".repeat(64)}, ${"a".repeat(64)}`).kind, "malformed", "chave duplicada na mesma declaração nunca é aceita");
  const ok = parseReferenceTruthCellPhysicalOrigin(`Segmento(s): ${"a".repeat(64)}, ${"b".repeat(64)}`);
  assertEqual(ok.kind, "ok");
  if (ok.kind === "ok") assertEqual(ok.segmentKeys.length, 2);
});

// ============================================================================
// Cenário 11: caixa fora da página.
// ============================================================================
runTest("fragmento com caixa fora dos limites da página é sinalizado pelo validador", () => {
  const segKey = syntheticSegmentKey("outside-page-box");
  // Vertical range is never clipped by the column intersection (only the horizontal range is) — a
  // negative topPoints therefore survives unchanged into the projected fragment box.
  const reg = region("reg-11", PAGE, { left: 0, top: -20, right: 50, bottom: 5 }, [segKey]);
  const r = row("row-11", ["reg-11"], ["cell-11"]);
  const c = cell("cell-11", "row-11", "col-separate-a", "X", origin(segKey));

  const build = buildReferenceTruthCellGeometry(
    {
      cells: [c],
      logicalRows: [r],
      physicalRegions: [reg],
      columns: [column("col-separate-a")],
      // Segment box extends to topPoints = -20, above the page (page starts at 0).
      physicalSegments: [{ segmentKey: segKey, realPageNumber: PAGE, boundingBox: { leftPoints: 5, topPoints: -20, rightPoints: 50, bottomPoints: 5 } }],
      pageBounds: PAGE_BOUNDS,
    },
    PAGE_BOUNDS,
  );

  assertEqual(build.integrityIssues.length, 0, "projection itself succeeds — page-bounds checking is the validator's responsibility");
  assert(
    build.validationIssues.some((issue) => issue.code === "fragment_outside_page" || issue.code === "envelope_outside_page"),
    "validator must flag a fragment/envelope that extends beyond the page bounds",
  );
});

// ============================================================================
// Cenário 12: fragmento sem interseção de coluna (não compartilhado).
// ============================================================================
runTest("fragmento sem interseção de coluna e sem justificativa de compartilhamento é um erro de integridade", () => {
  const segKey = syntheticSegmentKey("no-column-intersection");
  const reg = region("reg-12", PAGE, { left: 400, top: 240, right: 460, bottom: 250 }, [segKey]);
  const r = row("row-12", ["reg-12"], ["cell-12"]);
  // col-separate-a spans [0,100]; the segment sits entirely at [400,460] — no possible intersection, and the segment is used by only this one cell.
  const c = cell("cell-12", "row-12", "col-separate-a", "X", origin(segKey));

  const result = projectReferenceTruthCellGeometry({
    cells: [c],
    logicalRows: [r],
    physicalRegions: [reg],
    columns: [column("col-separate-a")],
    physicalSegments: [{ segmentKey: segKey, realPageNumber: PAGE, boundingBox: { leftPoints: 400, topPoints: 240, rightPoints: 460, bottomPoints: 250 } }],
    pageBounds: PAGE_BOUNDS,
  });

  assertEqual(result.geometries.length, 0);
  assertEqual(result.integrityIssues.length, 1);
  assertEqual(result.integrityIssues[0].code, "fragment_no_column_intersection");
});

// ============================================================================
// Cenário 13: linha incorreta (fragmento fora da faixa vertical da linha).
// ============================================================================
runTest("fragmento cuja posição vertical não sobrepõe a faixa da linha é sinalizado pelo validador", () => {
  const segKey = syntheticSegmentKey("wrong-row-band");
  // Row band sits at y=[260,270], but the segment (and therefore the fragment) sits far away at y=[700,710].
  const reg = region("reg-13", PAGE, { left: 0, top: 260, right: 100, bottom: 270 }, [segKey]);
  const r = row("row-13", ["reg-13"], ["cell-13"]);
  const c = cell("cell-13", "row-13", "col-separate-a", "X", origin(segKey));

  const build = buildReferenceTruthCellGeometry(
    {
      cells: [c],
      logicalRows: [r],
      physicalRegions: [reg],
      columns: [column("col-separate-a")],
      physicalSegments: [{ segmentKey: segKey, realPageNumber: PAGE, boundingBox: { leftPoints: 5, topPoints: 700, rightPoints: 95, bottomPoints: 710 } }],
      pageBounds: PAGE_BOUNDS,
    },
    PAGE_BOUNDS,
  );

  assertEqual(build.integrityIssues.length, 0);
  assert(build.validationIssues.some((issue) => issue.code === "fragment_outside_row_band"), "validator must flag a fragment with no vertical overlap with its own row band");
});

// ============================================================================
// Cenário 14: determinismo.
// ============================================================================
runTest("a mesma entrada produz exatamente a mesma saída (determinismo, duas execuções independentes)", () => {
  const segKey = syntheticSegmentKey("determinism-check");
  const reg = region("reg-14", PAGE, { left: 0, top: 280, right: 100, bottom: 290 }, [segKey]);
  const r = row("row-14", ["reg-14"], ["cell-14"]);
  const c = cell("cell-14", "row-14", "col-separate-a", "X", origin(segKey));
  const input: ReferenceTruthCellGeometryProjectionInput = {
    cells: [c],
    logicalRows: [r],
    physicalRegions: [reg],
    columns: [column("col-separate-a")],
    physicalSegments: [{ segmentKey: segKey, realPageNumber: PAGE, boundingBox: { leftPoints: 5, topPoints: 280, rightPoints: 95, bottomPoints: 290 } }],
    pageBounds: PAGE_BOUNDS,
  };

  const first = projectReferenceTruthCellGeometry(input);
  const second = projectReferenceTruthCellGeometry(input);
  assertEqual(JSON.stringify(first), JSON.stringify(second));
});

// ============================================================================
// Erros de estrutura defensivos.
// ============================================================================
runTest("coluna inexistente é um erro de integridade", () => {
  const r = row("row-15", [], ["cell-15"]);
  const c = cell("cell-15", "row-15", "col-does-not-exist", "X", origin(syntheticSegmentKey("dangling")));
  const result = projectReferenceTruthCellGeometry({ cells: [c], logicalRows: [r], physicalRegions: [], columns: [], physicalSegments: [], pageBounds: PAGE_BOUNDS });
  assertEqual(result.integrityIssues[0].code, "column_not_found");
});

runTest("linha lógica inexistente é um erro de integridade", () => {
  const c = cell("cell-16", "row-does-not-exist", "col-separate-a", "X", origin(syntheticSegmentKey("dangling-2")));
  const result = projectReferenceTruthCellGeometry({ cells: [c], logicalRows: [], physicalRegions: [], columns: [column("col-separate-a")], physicalSegments: [], pageBounds: PAGE_BOUNDS });
  assertEqual(result.integrityIssues[0].code, "logical_row_not_found");
});

runTest("linha lógica sem nenhuma região física declarada é um erro de integridade", () => {
  const r = row("row-17", [], ["cell-17"]);
  const c = cell("cell-17", "row-17", "col-separate-a", "X", origin(syntheticSegmentKey("dangling-3")));
  const result = projectReferenceTruthCellGeometry({ cells: [c], logicalRows: [r], physicalRegions: [], columns: [column("col-separate-a")], physicalSegments: [], pageBounds: PAGE_BOUNDS });
  assertEqual(result.integrityIssues[0].code, "row_has_no_physical_regions");
});

// ============================================================================
// Guarda de grupo compartilhado simétrico (validador).
// ============================================================================
runTest("validador confirma simetria de grupo compartilhado a partir de um cenário conhecido-válido", () => {
  const sharedKey = syntheticSegmentKey("symmetry-check");
  const reg = region("reg-18", PAGE, { left: 0, top: 300, right: 300, bottom: 310 }, [sharedKey]);
  const r = row("row-18", ["reg-18"], ["cell-18a", "cell-18b"]);
  const cA = cell("cell-18a", "row-18", "col-separate-a", "X", origin(sharedKey));
  const cB = cell("cell-18b", "row-18", "col-separate-b", "Y", origin(sharedKey));

  const build = buildReferenceTruthCellGeometry(
    {
      cells: [cA, cB],
      logicalRows: [r],
      physicalRegions: [reg],
      columns: [column("col-separate-a"), column("col-separate-b")],
      physicalSegments: [{ segmentKey: sharedKey, realPageNumber: PAGE, boundingBox: { leftPoints: 10, topPoints: 300, rightPoints: 290, bottomPoints: 310 } }],
      pageBounds: PAGE_BOUNDS,
    },
    PAGE_BOUNDS,
  );

  assertEqual(build.integrityIssues.length, 0);
  const symmetryIssues = build.validationIssues.filter((i) => i.code === "shared_group_asymmetric" || i.code === "shared_group_id_mismatch" || i.code === "shared_group_missing_partner");
  assertEqual(symmetryIssues.length, 0, "a correctly formed shared group must never be flagged as asymmetric");
});

runTest("validateReferenceTruthCellGeometries sinaliza grupo compartilhado assimétrico construído artificialmente", () => {
  const sharedKey = syntheticSegmentKey("asymmetric-check");
  const groupId = `shared-geometry:${PAGE}:${sharedKey}`;
  const box = { leftPoints: 0, topPoints: 0, rightPoints: 10, bottomPoints: 10 };
  const fragment = { id: "f1", sourceSegmentKey: sharedKey, sourceBoundingBox: box, projectionKind: "source_segment_exact_box" as const, projectedBoundingBox: box };
  const baseGeometry = {
    schemaVersion: 1 as const,
    realPageNumber: PAGE,
    logicalRowId: "row-x",
    columnId: "col-x",
    resolutionKind: "shared_source_geometry" as const,
    spatialSemantics: "shared" as const,
    sourceSegmentKeys: [sharedKey],
    sourcePhysicalRegionIds: [],
    rowBand: box,
    columnBand: { leftPoints: 0, rightPoints: 10 },
    fragments: [fragment],
    expectedEnvelope: box,
    provenance: { cellId: "n/a", logicalRowId: "row-x", columnId: "col-x", columnRole: "item" as const, physicalOriginPt: origin(sharedKey), parsedSegmentKeys: [sharedKey], rowPhysicalRegionIds: [], resolutionNotesPt: "" },
  };
  // cell-A declares cell-B as a partner, but cell-B does not declare cell-A back.
  const geometryA = { ...baseGeometry, cellId: "cell-a", sharedGeometryGroupId: groupId, sharedWithCellIds: ["cell-b"] };
  const geometryB = { ...baseGeometry, cellId: "cell-b", sharedGeometryGroupId: groupId, sharedWithCellIds: [] };

  const issues = validateReferenceTruthCellGeometries([geometryA, geometryB], PAGE_BOUNDS);
  assert(issues.some((i) => i.code === "shared_group_asymmetric"), "an asymmetric shared group must be flagged");
});
