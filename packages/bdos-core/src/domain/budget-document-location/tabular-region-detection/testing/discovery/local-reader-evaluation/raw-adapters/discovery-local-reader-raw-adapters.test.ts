/**
 * Testes dos adaptadores brutos (Sprint 21.4B.3A.3, Momento 3B.2).
 * Fixtures estruturais mínimas e anonimizadas — contêm apenas o schema
 * necessário (nomes de campo reais do Docling/PaddleOCR), nunca
 * códigos, valores, descrições, totais ou textos reais do documento
 * Lagoa do Arroz.
 */
import type { LocalReaderPageGeometry } from "../discovery-local-reader-evaluation.types";
import { parseDoclingRawExport } from "./discovery-local-reader-docling-adapter";
import type { DoclingRawExport } from "./discovery-local-reader-docling-adapter";
import { parsePaddleOcrRawExport } from "./discovery-local-reader-paddleocr-adapter";
import type { PaddleOcrRawExport } from "./discovery-local-reader-paddleocr-adapter";

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

const PAGE_GEOMETRY: LocalReaderPageGeometry = { pageWidthPoints: 1190.52, pageHeightPoints: 841.92, renderingResolutionDpi: 200 };

// --- Docling ------------------------------------------------------------------

runTest("docling: região de texto — página, texto literal e caixa convertida (origem TOPLEFT, pixels)", () => {
  const raw: DoclingRawExport = {
    texts: [{ text: "TEXTO ANONIMIZADO 1", label: "text", prov: [{ page_no: 1, bbox: { l: 100, t: 50, r: 300, b: 90, coord_origin: "TOPLEFT" } }] }],
  };
  const result = parseDoclingRawExport(raw, 46, PAGE_GEOMETRY);
  assertEqual(result.regions.length, 1);
  assertEqual(result.regions[0].realPageNumber, 46, "página real deveria ser o parâmetro explícito, nunca o page_no interno (sempre 1)");
  assertEqual(result.regions[0].literalText, "TEXTO ANONIMIZADO 1");
  assert(result.regions[0].convertedBoundingBox !== null, "caixa deveria ser convertida com sucesso");
});

runTest("docling: região de figura — texto literal vazio, ainda assim registrada como região", () => {
  const raw: DoclingRawExport = { pictures: [{ label: "picture", prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 10, b: 10, coord_origin: "TOPLEFT" } }] }] };
  const result = parseDoclingRawExport(raw, 46, PAGE_GEOMETRY);
  assertEqual(result.regions.length, 1);
  assertEqual(result.regions[0].literalText, "");
  assertEqual(result.regions[0].readerNativeType, "picture");
});

runTest("docling: tabela e células — contagens, indicação nativa de mesclagem quando row_span/col_span > 1", () => {
  const raw: DoclingRawExport = {
    tables: [
      {
        label: "table",
        prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 1000, b: 500, coord_origin: "TOPLEFT" } }],
        data: {
          num_rows: 2,
          num_cols: 2,
          table_cells: [
            { bbox: { l: 0, t: 0, r: 100, b: 50, coord_origin: "TOPLEFT" }, row_span: 1, col_span: 1, start_row_offset_idx: 0, start_col_offset_idx: 0, text: "CÉLULA ANONIMIZADA A" },
            { bbox: { l: 100, t: 0, r: 300, b: 50, coord_origin: "TOPLEFT" }, row_span: 1, col_span: 2, start_row_offset_idx: 0, start_col_offset_idx: 1, text: "CÉLULA ANONIMIZADA B (mesclada)" },
          ],
        },
      },
    ],
  };
  const result = parseDoclingRawExport(raw, 50, PAGE_GEOMETRY);
  assertEqual(result.tables.length, 1);
  assertEqual(result.tables[0].rowCount, 2);
  assertEqual(result.tables[0].columnCount, 2);
  assertEqual(result.cells.length, 2);
  assertEqual(result.cells[0].nativeMergeIndicationPt, null);
  assert(result.cells[1].nativeMergeIndicationPt !== null && result.cells[1].nativeMergeIndicationPt!.includes("col_span=2"), "célula com col_span>1 deveria indicar mesclagem nativa");
});

runTest("docling: célula sem bbox — ausência de coordenada preservada como null, nunca inventada", () => {
  const raw: DoclingRawExport = {
    tables: [
      {
        label: "table",
        prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 100, b: 100, coord_origin: "TOPLEFT" } }],
        data: { num_rows: 1, num_cols: 1, table_cells: [{ bbox: null, start_row_offset_idx: 0, start_col_offset_idx: 0, text: "SEM COORDENADA" }] },
      },
    ],
  };
  const result = parseDoclingRawExport(raw, 54, PAGE_GEOMETRY);
  assertEqual(result.cells[0].boundingBox, null);
});

runTest("docling: convenção de origem desconhecida — nunca adivinhada, métrica espacial interrompida", () => {
  const raw: DoclingRawExport = { texts: [{ text: "TEXTO", prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 10, b: 10, coord_origin: "SOME_UNEXPECTED_VALUE" } }] }] };
  const result = parseDoclingRawExport(raw, 46, PAGE_GEOMETRY);
  assertEqual(result.regions[0].convertedBoundingBox, null);
  assert(result.regions[0].conversionInterruptionReasonPt !== null, "razão da interrupção deveria estar preenchida");
});

runTest("docling: export vazio (nenhum texts/pictures/tables) — nenhuma invenção, listas vazias", () => {
  const result = parseDoclingRawExport({}, 46, PAGE_GEOMETRY);
  assertEqual(result.regions.length, 0);
  assertEqual(result.tables.length, 0);
  assertEqual(result.cells.length, 0);
});

runTest("docling: confiança sempre null (campo inexistente neste schema) — nunca inventada", () => {
  const raw: DoclingRawExport = { texts: [{ text: "TEXTO", prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 10, b: 10, coord_origin: "TOPLEFT" } }] }] };
  const result = parseDoclingRawExport(raw, 46, PAGE_GEOMETRY);
  assertEqual(result.regions[0].readerConfidence, null);
});

// --- PaddleOCR ------------------------------------------------------------------

runTest("paddleocr: região de texto — página, texto literal, confiança repassada como metadado, caixa convertida (top_left, pixels)", () => {
  const raw: PaddleOcrRawExport = [{ res: { rec_texts: ["TEXTO ANONIMIZADO 1"], rec_scores: [0.987], rec_boxes: [[100, 50, 300, 90]] } }];
  const result = parsePaddleOcrRawExport(raw, 46, PAGE_GEOMETRY);
  assertEqual(result.regions.length, 1);
  assertEqual(result.regions[0].realPageNumber, 46);
  assertEqual(result.regions[0].literalText, "TEXTO ANONIMIZADO 1");
  assertEqual(result.regions[0].readerConfidence, 0.987);
  assert(result.regions[0].convertedBoundingBox !== null, "caixa deveria ser convertida com sucesso");
});

runTest("paddleocr: nunca produz tabelas ou células — pipeline de OCR geral sem submódulo de estrutura", () => {
  const raw: PaddleOcrRawExport = [{ res: { rec_texts: ["A", "B"], rec_scores: [0.9, 0.8], rec_boxes: [[0, 0, 10, 10], [10, 10, 20, 20]] } }];
  const result = parsePaddleOcrRawExport(raw, 50, PAGE_GEOMETRY);
  assertEqual(result.tables.length, 0);
  assertEqual(result.cells.length, 0);
});

runTest("paddleocr: região sem rec_boxes correspondente — ausência de coordenada preservada como null, nunca inventada", () => {
  const raw: PaddleOcrRawExport = [{ res: { rec_texts: ["TEXTO SEM CAIXA"], rec_scores: [0.5], rec_boxes: [] } }];
  const result = parsePaddleOcrRawExport(raw, 46, PAGE_GEOMETRY);
  assertEqual(result.regions[0].convertedBoundingBox, null);
  assert(result.regions[0].conversionInterruptionReasonPt !== null, "razão da interrupção deveria estar preenchida");
});

runTest("paddleocr: saída parcial/ausente (res vazio) — nenhuma invenção, lista de regiões vazia", () => {
  const rawMissingRes: PaddleOcrRawExport = [{}];
  const resultMissing = parsePaddleOcrRawExport(rawMissingRes, 54, PAGE_GEOMETRY);
  assertEqual(resultMissing.regions.length, 0);

  const rawEmptyArray: PaddleOcrRawExport = [];
  const resultEmpty = parsePaddleOcrRawExport(rawEmptyArray, 54, PAGE_GEOMETRY);
  assertEqual(resultEmpty.regions.length, 0);
});
