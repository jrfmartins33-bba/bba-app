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
import { buildReferenceTruthCellGeometry, buildCanonicalSpatialProjection } from "./discovery-reference-truth-cell-geometry";
import type { ReferenceTruthCellGeometryPageBounds } from "./discovery-reference-truth-cell-geometry.types";

/** Hash canônico espacial capturado a partir dos dados publicados sob schemaVersion 1, antes da correção de proveniência (verificação probatória final da PR #82, §6) — ver EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md. */
const PREVIOUS_CANONICAL_SPATIAL_GEOMETRY_SHA256 = "9221d8bb0f7994cdde106cdf1ba718380881d2d4cbe1710add52705bec62680b";
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
    assert(referenced.has(`${s.realPageNumber}:${s.legacyDeclaredSegmentKey}`), `published segment "${s.legacyDeclaredSegmentKey}" on page ${s.realPageNumber} is never referenced by any cell`);
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

// ============================================================================
// schemaVersion 2 — verificação probatória final da PR #82: proveniência
// reproduzível, geometria espacial inalterada (ver
// EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md).
// ============================================================================

runTest("nenhuma caixa espacial mudou: o hash canônico espacial recalculado sobre os dados publicados é idêntico ao hash já registrado no manifesto", () => {
  const projection = buildCanonicalSpatialProjection(PUBLISHED_GEOMETRIES);
  const recomputed = createHash("sha256").update(JSON.stringify(projection)).digest("hex");
  assertEqual(recomputed, REFERENCE_TRUTH_CELL_GEOMETRY_MANIFEST.canonicalSpatialGeometrySha256);
});

runTest("hash espacial anterior (schemaVersion 1, pré-correção) é idêntico ao hash espacial novo (schemaVersion 2) — a correção de proveniência nunca alterou nenhuma geometria", () => {
  assertEqual(REFERENCE_TRUTH_CELL_GEOMETRY_MANIFEST.canonicalSpatialGeometrySha256, PREVIOUS_CANONICAL_SPATIAL_GEOMETRY_SHA256);
});

runTest("toda geometria não-vazia possui, em cada fragmento, um localizador estrutural reproduzível com página/ordens/caixas/fingerprints válidos", () => {
  PUBLISHED_GEOMETRIES.forEach((g) => {
    g.fragments.forEach((f) => {
      if (f.projectionKind === "row_column_empty_slot") {
        assertEqual(f.reproducibleLocator, null, `empty-slot fragment "${f.id}" must never carry a reproducibleLocator`);
        assertEqual(f.legacyDeclaredSegmentKey, null);
        assertEqual(f.legacyDeclaredSegmentKeyStatus, null);
        assertEqual(f.associationBasis, null);
        return;
      }
      const locator = f.reproducibleLocator;
      assert(locator !== null, `fragment "${f.id}" of cell "${g.cellId}" must have a reproducibleLocator`);
      assertEqual(locator!.realPageNumber, g.realPageNumber, `fragment "${f.id}" locator page must match the cell's page`);
      assert(Number.isInteger(locator!.regionVerticalOrder) && locator!.regionVerticalOrder > 0, `fragment "${f.id}" locator has an invalid regionVerticalOrder`);
      assert(Number.isInteger(locator!.segmentHorizontalOrder) && locator!.segmentHorizontalOrder > 0, `fragment "${f.id}" locator has an invalid segmentHorizontalOrder`);
      assert(locator!.regionBoundingBox.leftPoints < locator!.regionBoundingBox.rightPoints && locator!.regionBoundingBox.topPoints < locator!.regionBoundingBox.bottomPoints, `fragment "${f.id}" locator has an invalid regionBoundingBox`);
      assert(locator!.segmentBoundingBox.leftPoints < locator!.segmentBoundingBox.rightPoints && locator!.segmentBoundingBox.topPoints < locator!.segmentBoundingBox.bottomPoints, `fragment "${f.id}" locator has an invalid segmentBoundingBox`);
      assert(locator!.sourceDocumentSha256.length === 64, `fragment "${f.id}" locator has an invalid sourceDocumentSha256`);
      assert(locator!.physicalAdapterVersionSha256.length === 64, `fragment "${f.id}" locator has an invalid physicalAdapterVersionSha256`);
      assert(locator!.physicalUnderlyingLibraryVersionSha256.length === 64, `fragment "${f.id}" locator has an invalid physicalUnderlyingLibraryVersionSha256`);
      assert(locator!.reconstructionContextFingerprint.length === 64, `fragment "${f.id}" locator has an invalid reconstructionContextFingerprint`);
      assert(locator!.physicalGeometryContextFingerprint.length === 64, `fragment "${f.id}" locator has an invalid physicalGeometryContextFingerprint`);
      assert(locator!.reproducibleLineKey.length === 64 && locator!.reproducibleSegmentKey.length === 64, `fragment "${f.id}" locator has invalid reproducible keys`);
    });
  });
});

runTest("nenhuma geometria usa a chave histórica declarada como identidade canônica: reproducibleSegmentKey nunca é igual a legacyDeclaredSegmentKey", () => {
  let checked = 0;
  PUBLISHED_GEOMETRIES.forEach((g) => {
    g.fragments.forEach((f) => {
      if (f.reproducibleLocator === null || f.legacyDeclaredSegmentKey === null) return;
      checked++;
      assert(f.reproducibleLocator.reproducibleSegmentKey !== f.legacyDeclaredSegmentKey, `fragment "${f.id}" must never use the legacy declared key as its reproducible identity`);
    });
  });
  assert(checked > 0, "expected at least one resolved fragment to check");
});

runTest("toda legacyDeclaredSegmentKey publicada possui exatamente o status legacy_unreproducible", () => {
  PUBLISHED_SEGMENTS.forEach((s) => {
    assertEqual(s.legacyDeclaredSegmentKeyStatus, "legacy_unreproducible", `segment "${s.legacyDeclaredSegmentKey}" must have status legacy_unreproducible`);
    assertEqual(s.associationBasis, "exact_structural_position_with_region_geometry_validation", `segment "${s.legacyDeclaredSegmentKey}" must declare the exact structural association basis`);
  });
  PUBLISHED_GEOMETRIES.forEach((g) => {
    g.fragments.forEach((f) => {
      if (f.legacyDeclaredSegmentKey === null) return;
      assertEqual(f.legacyDeclaredSegmentKeyStatus, "legacy_unreproducible", `fragment "${f.id}" must have status legacy_unreproducible`);
      assertEqual(f.associationBasis, "exact_structural_position_with_region_geometry_validation", `fragment "${f.id}" must declare the exact structural association basis`);
    });
  });
});

runTest("distribuição preservada: 683 geometrias exclusivas (single_source_fragment) e 336 compartilhadas (shared_source_geometry), 167 grupos compartilhados", () => {
  const single = PUBLISHED_GEOMETRIES.filter((g) => g.resolutionKind === "single_source_fragment").length;
  const shared = PUBLISHED_GEOMETRIES.filter((g) => g.resolutionKind === "shared_source_geometry").length;
  assertEqual(single, 683);
  assertEqual(shared, 336);
  assertEqual(single + shared, 1019);
  const sharedGroupIds = new Set(PUBLISHED_GEOMETRIES.map((g) => g.sharedGeometryGroupId).filter((id): id is string => id !== null));
  assertEqual(sharedGroupIds.size, 167);
});

runTest("prova histórica negativa registrada no manifesto: 186/186 falhas de lineKey direta, 0 ambiguidades, commit histórico correto", () => {
  const h = REFERENCE_TRUTH_CELL_GEOMETRY_MANIFEST.historicalReplayVerification;
  assertEqual(h.historicalReferenceTruthCommitSha, "ccd8f8f1627e4f628f8787c36a2b27517a42e29b");
  assertEqual(h.historicalLineCount, 186);
  assertEqual(h.directLineKeyResolutionFailureCount, 186);
  assertEqual(h.ambiguityCount, 0);
  assertEqual(h.individualBoundingBoxMismatchCount, 0);
  assertEqual(h.publishedCellReferencedSegmentKeyCount, PUBLISHED_SEGMENTS.length);
});
