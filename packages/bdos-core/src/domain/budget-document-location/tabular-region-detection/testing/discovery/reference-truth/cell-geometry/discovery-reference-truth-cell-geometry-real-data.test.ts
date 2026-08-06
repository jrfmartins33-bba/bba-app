/**
 * Testes reais (§19 do enunciado da Sprint) sobre a geometria esperada
 * publicada das 1.019 células (páginas 46, 50 e 54). Nunca lê o PDF de
 * origem nem depende de `infrastructure/` — reproduz a geometria
 * inteiramente a partir do registro de segmentos físicos já congelado
 * (`*-physical-segments-page-*.ts`) através do mesmo algoritmo genérico
 * já congelado no Commit 1, e compara o resultado, campo a campo, com os
 * arquivos de página já publicados. Isso prova, a cada execução de
 * `pnpm test`, que os dados publicados são reproduzíveis sem precisar
 * reexecutar o reconstrutor físico nem acessar o documento original.
 */
import { createHash } from "node:crypto";
import { REFERENCE_TRUTH_BUNDLES, REFERENCE_TRUTH_COLUMNS } from "../discovery-reference-truth";
import { buildReferenceTruthCellGeometry } from "./discovery-reference-truth-cell-geometry";
import type { ReferenceTruthCellGeometryPageBounds } from "./discovery-reference-truth-cell-geometry.types";
import { REFERENCE_TRUTH_CELL_GEOMETRY_PHYSICAL_SEGMENTS_PAGE_46 } from "./discovery-reference-truth-cell-geometry-physical-segments-page-46";
import { REFERENCE_TRUTH_CELL_GEOMETRY_PHYSICAL_SEGMENTS_PAGE_50 } from "./discovery-reference-truth-cell-geometry-physical-segments-page-50";
import { REFERENCE_TRUTH_CELL_GEOMETRY_PHYSICAL_SEGMENTS_PAGE_54 } from "./discovery-reference-truth-cell-geometry-physical-segments-page-54";
import { REFERENCE_TRUTH_CELL_GEOMETRY_PAGE_46 } from "./discovery-reference-truth-cell-geometry-page-46";
import { REFERENCE_TRUTH_CELL_GEOMETRY_PAGE_50 } from "./discovery-reference-truth-cell-geometry-page-50";
import { REFERENCE_TRUTH_CELL_GEOMETRY_PAGE_54 } from "./discovery-reference-truth-cell-geometry-page-54";
import { REFERENCE_TRUTH_CELL_GEOMETRY_MANIFEST } from "./discovery-reference-truth-cell-geometry-manifest";

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

const ALL_CELLS = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.cells);
const ALL_ROWS = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.logicalRows);
const ALL_REGIONS = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.physicalRegions);
const TARGET_PAGES = [46, 50, 54] as const;

const PUBLISHED_GEOMETRIES = [...REFERENCE_TRUTH_CELL_GEOMETRY_PAGE_46, ...REFERENCE_TRUTH_CELL_GEOMETRY_PAGE_50, ...REFERENCE_TRUTH_CELL_GEOMETRY_PAGE_54];
const PUBLISHED_SEGMENTS = [...REFERENCE_TRUTH_CELL_GEOMETRY_PHYSICAL_SEGMENTS_PAGE_46, ...REFERENCE_TRUTH_CELL_GEOMETRY_PHYSICAL_SEGMENTS_PAGE_50, ...REFERENCE_TRUTH_CELL_GEOMETRY_PHYSICAL_SEGMENTS_PAGE_54];

const PAGE_BOUNDS: ReadonlyArray<ReferenceTruthCellGeometryPageBounds> = REFERENCE_TRUTH_BUNDLES.filter((b) => (TARGET_PAGES as readonly number[]).includes(b.page.realPageNumber)).map((b) => ({
  realPageNumber: b.page.realPageNumber,
  pageWidthPoints: b.page.pageWidthPoints,
  pageHeightPoints: b.page.pageHeightPoints,
}));

runTest("1.019 células esperadas = 1.019 disposições geométricas publicadas", () => {
  assertEqual(ALL_CELLS.length, 1019);
  assertEqual(PUBLISHED_GEOMETRIES.length, 1019);
});

runTest("contagem por página: 46, 50 e 54 batem exatamente entre células e geometrias publicadas", () => {
  TARGET_PAGES.forEach((page) => {
    const cellCount = ALL_CELLS.filter((c) => c.realPageNumber === page).length;
    const geometryCount = PUBLISHED_GEOMETRIES.filter((g) => g.realPageNumber === page).length;
    assertEqual(geometryCount, cellCount, `page ${page}: geometry count must equal cell count`);
  });
});

runTest("nenhuma geometria duplicada; todo cellId é único", () => {
  const seen = new Set<string>();
  PUBLISHED_GEOMETRIES.forEach((g) => {
    assert(!seen.has(g.cellId), `duplicate geometry for cellId "${g.cellId}"`);
    seen.add(g.cellId);
  });
  assertEqual(seen.size, 1019);
});

runTest("todo cellId da verdade de referência possui exatamente uma geometria publicada, e vice-versa (completude bidirecional)", () => {
  const cellIds = new Set(ALL_CELLS.map((c) => c.id));
  const geometryCellIds = new Set(PUBLISHED_GEOMETRIES.map((g) => g.cellId));
  assertEqual(cellIds.size, geometryCellIds.size);
  cellIds.forEach((id) => assert(geometryCellIds.has(id), `cell "${id}" has no published geometry`));
  geometryCellIds.forEach((id) => assert(cellIds.has(id), `published geometry references unknown cellId "${id}"`));
});

runTest("cada geometria referencia um logicalRowId e columnId que realmente existem na verdade de referência", () => {
  const rowIds = new Set(ALL_ROWS.map((r) => r.id));
  const columnIds = new Set(REFERENCE_TRUTH_COLUMNS.map((c) => c.id));
  PUBLISHED_GEOMETRIES.forEach((g) => {
    assert(rowIds.has(g.logicalRowId), `geometry "${g.cellId}" references unknown logicalRowId "${g.logicalRowId}"`);
    assert(columnIds.has(g.columnId), `geometry "${g.cellId}" references unknown columnId "${g.columnId}"`);
  });
});

runTest("todo sourcePhysicalRegionIds de cada geometria referencia uma região física existente na mesma página (vínculo apenas diagnóstico, nunca escrito de volta na célula)", () => {
  const regionIdsByPage = new Map<number, Set<string>>();
  ALL_REGIONS.forEach((r) => {
    if (!regionIdsByPage.has(r.realPageNumber)) regionIdsByPage.set(r.realPageNumber, new Set());
    regionIdsByPage.get(r.realPageNumber)!.add(r.id);
  });
  PUBLISHED_GEOMETRIES.forEach((g) => {
    const ids = regionIdsByPage.get(g.realPageNumber) ?? new Set();
    g.sourcePhysicalRegionIds.forEach((id) => assert(ids.has(id), `geometry "${g.cellId}" references unknown physical region "${id}" on page ${g.realPageNumber}`));
  });
});

runTest("nenhuma célula não vazia usa empty_slot_projection; nenhuma célula vazia usa outra coisa que não empty_slot_projection", () => {
  const geometryByCellId = new Map(PUBLISHED_GEOMETRIES.map((g) => [g.cellId, g] as const));
  ALL_CELLS.forEach((cell) => {
    const g = geometryByCellId.get(cell.id)!;
    const isEmpty = cell.literalText.trim().length === 0;
    if (isEmpty) {
      assertEqual(g.resolutionKind, "empty_slot_projection", `empty cell "${cell.id}" must use empty_slot_projection`);
    } else {
      assert(g.resolutionKind !== "empty_slot_projection", `non-empty cell "${cell.id}" must never use empty_slot_projection`);
    }
  });
});

runTest("todos os grupos de geometria compartilhada são simétricos: sharedWithCellIds sempre referencia um parceiro com o mesmo sharedGeometryGroupId e que aponta de volta", () => {
  const byId = new Map(PUBLISHED_GEOMETRIES.map((g) => [g.cellId, g] as const));
  PUBLISHED_GEOMETRIES.forEach((g) => {
    if (g.sharedGeometryGroupId === null) {
      assertEqual(g.sharedWithCellIds.length, 0, `cell "${g.cellId}" has no sharedGeometryGroupId but a non-empty sharedWithCellIds`);
      return;
    }
    assert(g.sharedWithCellIds.length > 0, `cell "${g.cellId}" declares sharedGeometryGroupId but sharedWithCellIds is empty`);
    g.sharedWithCellIds.forEach((partnerId) => {
      const partner = byId.get(partnerId);
      assert(partner !== undefined, `cell "${g.cellId}" references unknown partner "${partnerId}"`);
      assertEqual(partner!.sharedGeometryGroupId, g.sharedGeometryGroupId, `partner "${partnerId}" does not share the same group id as "${g.cellId}"`);
      assert(partner!.sharedWithCellIds.includes(g.cellId), `partner "${partnerId}" does not list "${g.cellId}" back`);
    });
  });
});

runTest("nenhuma célula com descrição multilinha foi colapsada: cada região de continuação permanece um cellId geométrico distinto, em ordem vertical crescente", () => {
  const geometryByCellId = new Map(PUBLISHED_GEOMETRIES.map((g) => [g.cellId, g] as const));
  const descriptionCellsByRow = new Map<string, string[]>();
  ALL_CELLS.filter((c) => c.columnId === "col-descricao").forEach((c) => {
    if (!descriptionCellsByRow.has(c.logicalRowId)) descriptionCellsByRow.set(c.logicalRowId, []);
    descriptionCellsByRow.get(c.logicalRowId)!.push(c.id);
  });
  let multilineRowCount = 0;
  descriptionCellsByRow.forEach((cellIds, rowId) => {
    if (cellIds.length <= 1) return;
    multilineRowCount++;
    const tops = cellIds.map((id) => geometryByCellId.get(id)!.expectedEnvelope.topPoints);
    for (let i = 1; i < tops.length; i++) {
      assert(tops[i] > tops[i - 1], `row "${rowId}": description fragments must be in strictly increasing vertical order, never inverted or collapsed`);
    }
  });
  assert(multilineRowCount > 0, "expected at least one real multiline description row among the 1,019 cells");
  console.log(`  (${multilineRowCount} multiline description row(s) confirmed non-collapsed)`);
});

runTest("regeneração determinística: reconstruir a geometria a partir do registro de segmentos físicos já congelado reproduz exatamente os arquivos de página publicados", () => {
  const result = buildReferenceTruthCellGeometry(
    {
      cells: ALL_CELLS,
      logicalRows: ALL_ROWS,
      physicalRegions: ALL_REGIONS,
      columns: REFERENCE_TRUTH_COLUMNS,
      physicalSegments: PUBLISHED_SEGMENTS,
      pageBounds: PAGE_BOUNDS,
    },
    PAGE_BOUNDS,
  );

  assertEqual(result.integrityIssues.length, 0, "regeneration from the frozen segment registry must produce zero integrity issues");
  assertEqual(result.validationIssues.length, 0, "regeneration from the frozen segment registry must produce zero validation issues");
  assertEqual(result.geometries.length, PUBLISHED_GEOMETRIES.length);
  assertEqual(JSON.stringify(result.geometries), JSON.stringify(PUBLISHED_GEOMETRIES), "regenerated geometry must be byte-identical (JSON-equivalent) to the published page files");
});

runTest("o manifesto reflete exatamente a distribuição real publicada por tipo de resolução e a contagem de grupos compartilhados", () => {
  const counts: Record<string, number> = {};
  PUBLISHED_GEOMETRIES.forEach((g) => {
    counts[g.resolutionKind] = (counts[g.resolutionKind] ?? 0) + 1;
  });
  assertEqual(JSON.stringify(counts), JSON.stringify(REFERENCE_TRUTH_CELL_GEOMETRY_MANIFEST.countByResolutionKind));

  const sharedGroupIds = new Set(PUBLISHED_GEOMETRIES.map((g) => g.sharedGeometryGroupId).filter((id): id is string => id !== null));
  assertEqual(sharedGroupIds.size, REFERENCE_TRUTH_CELL_GEOMETRY_MANIFEST.sharedGeometryGroupCount);

  assertEqual(REFERENCE_TRUTH_CELL_GEOMETRY_MANIFEST.totalCellCount, 1019);
});

runTest("o hash canônico de geração declarado no manifesto é reprodutível a partir dos dados publicados", () => {
  const result = buildReferenceTruthCellGeometry(
    {
      cells: ALL_CELLS,
      logicalRows: ALL_ROWS,
      physicalRegions: ALL_REGIONS,
      columns: REFERENCE_TRUTH_COLUMNS,
      physicalSegments: PUBLISHED_SEGMENTS,
      pageBounds: PAGE_BOUNDS,
    },
    PAGE_BOUNDS,
  );
  const recomputedHash = createHash("sha256").update(JSON.stringify(result)).digest("hex");
  assertEqual(recomputedHash, REFERENCE_TRUTH_CELL_GEOMETRY_MANIFEST.canonicalGenerationSha256);
});

runTest("nenhum segmento do registro físico está órfão: todo segmento publicado é referenciado por ao menos uma célula", () => {
  const referenced = new Set<string>();
  ALL_CELLS.forEach((cell) => {
    const m = cell.physicalOriginPt.match(/^Segmento\(s\):\s*(.*)$/);
    if (!m) return;
    m[1].split(",").forEach((k) => referenced.add(`${cell.realPageNumber}:${k.trim()}`));
  });
  PUBLISHED_SEGMENTS.forEach((s) => {
    assert(referenced.has(`${s.realPageNumber}:${s.segmentKey}`), `published segment "${s.segmentKey}" on page ${s.realPageNumber} is never referenced by any cell`);
  });
});

runTest("todas as caixas publicadas são finitas, corretamente ordenadas (left<right, top<bottom) e contidas na página", () => {
  const pageBoundsByPage = new Map(PAGE_BOUNDS.map((p) => [p.realPageNumber, p] as const));
  PUBLISHED_GEOMETRIES.forEach((g) => {
    const bounds = pageBoundsByPage.get(g.realPageNumber)!;
    [g.expectedEnvelope, ...g.fragments.map((f) => f.projectedBoundingBox)].forEach((box) => {
      assert(Number.isFinite(box.leftPoints) && Number.isFinite(box.topPoints) && Number.isFinite(box.rightPoints) && Number.isFinite(box.bottomPoints), `cell "${g.cellId}" has a non-finite bounding box`);
      assert(box.leftPoints < box.rightPoints && box.topPoints < box.bottomPoints, `cell "${g.cellId}" has an invalidly ordered bounding box`);
      assert(box.leftPoints >= 0 && box.topPoints >= 0 && box.rightPoints <= bounds.pageWidthPoints && box.bottomPoints <= bounds.pageHeightPoints, `cell "${g.cellId}" has a bounding box outside the page`);
    });
  });
});
