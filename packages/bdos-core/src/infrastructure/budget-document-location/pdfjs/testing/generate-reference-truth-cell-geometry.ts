/**
 * Gerador único (não faz parte de `pnpm test` — não termina em
 * `.test.ts`, depende de um arquivo local fora do controle de versão)
 * que materializa, a partir do documento-fonte exato e do reconstrutor
 * físico já aprovado, o registro congelado de segmentos físicos e a
 * geometria esperada real das 1.019 células da verdade de referência
 * (páginas 46, 50 e 54). Vive em `infrastructure/budget-document-location/pdfjs/`
 * — o único lugar do pacote em que a direção de dependência permitida
 * (adaptador -> domínio) comporta importar tanto o leitor físico real
 * quanto o domínio, o mesmo padrão já usado pelos `*.real-pdf-chain.test.ts`
 * desta mesma pasta. Nunca executa Docling, nenhuma ferramenta de leitura
 * óptica de caracteres, LLM ou qualquer motor determinístico — apenas a
 * cadeia física já aprovada:
 * `pdfjsPhysicalDocumentReader.read` -> `observeDocumentSignals` ->
 * `locateBudgetDocumentPages` -> `reconstructBudgetDocumentStructure`.
 *
 * Uso: `npx tsx src/infrastructure/budget-document-location/pdfjs/testing/generate-reference-truth-cell-geometry.ts`
 * a partir de `packages/bdos-core` (mesma convenção de `cwd` do resto do
 * repositório). Escreve os arquivos de dados diretamente sob
 * `domain/budget-document-location/tabular-region-detection/testing/discovery/reference-truth/cell-geometry/`.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { pdfjsPhysicalDocumentReader, PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION } from "../pdfjs-physical-document-reader";
import { observeDocumentSignals, locateBudgetDocumentPages, reconstructBudgetDocumentStructure } from "../../../../domain/budget-document-location";
import type { BudgetDocumentStructureReconstructionResult, ReconstructedHorizontalSegment } from "../../../../domain/budget-document-location";
import {
  REFERENCE_TRUTH_BUNDLES,
  REFERENCE_TRUTH_DOCUMENT,
  REFERENCE_TRUTH_PAGES,
  REFERENCE_TRUTH_COLUMNS,
} from "../../../../domain/budget-document-location/tabular-region-detection/testing/discovery/reference-truth/discovery-reference-truth";
import {
  buildReferenceTruthCellGeometry,
  parseReferenceTruthCellPhysicalOrigin,
  type ReferenceTruthCellGeometry,
  type ReferenceTruthCellGeometryPageBounds,
  type ReferenceTruthPhysicalSegmentGeometry,
} from "../../../../domain/budget-document-location/tabular-region-detection/testing/discovery/reference-truth/cell-geometry/discovery-reference-truth-cell-geometry";
import { renderReferenceTruthCellGeometryPageSvg } from "../../../../domain/budget-document-location/tabular-region-detection/testing/discovery/reference-truth/cell-geometry/discovery-reference-truth-cell-geometry-svg";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(CURRENT_DIR, "..", "..", "..", "..", "..", "..", "..");
const SOURCE_PDF_PATH = join(REPO_ROOT, "_local-documents", "epic-21", "lagoa-do-arroz", "01_Origem_Edital", "05_Anexo_Tecnico_Termo_Referencia.pdf");
const CELL_GEOMETRY_DIR = join(
  REPO_ROOT,
  "packages",
  "bdos-core",
  "src",
  "domain",
  "budget-document-location",
  "tabular-region-detection",
  "testing",
  "discovery",
  "reference-truth",
  "cell-geometry",
);

const TARGET_PAGES = [46, 50, 54] as const;
const EXPECTED_ADAPTER_VERSION = PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION;
const EXPECTED_UNDERLYING_LIBRARY_VERSION = "pdfjs-dist@6.1.200";

function fail(message: string): never {
  console.error(`STOP: ${message}`);
  process.exit(1);
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

async function runFullChain(bytes: Uint8Array): Promise<BudgetDocumentStructureReconstructionResult> {
  const physicalRead = await pdfjsPhysicalDocumentReader.read(bytes);
  if (physicalRead.status !== "completed" && physicalRead.status !== "completed_with_page_failures") {
    fail(`physical read did not complete (status=${physicalRead.status})`);
  }
  if (physicalRead.adapterVersion !== EXPECTED_ADAPTER_VERSION) {
    fail(`unexpected adapter version: ${physicalRead.adapterVersion}`);
  }
  if (physicalRead.underlyingLibraryVersion !== EXPECTED_UNDERLYING_LIBRARY_VERSION) {
    fail(`unexpected underlying library version: ${physicalRead.underlyingLibraryVersion}`);
  }

  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const result = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });

  if (result.status === "failed") {
    fail(`structure reconstruction failed: ${JSON.stringify(result.technicalProblems)}`);
  }

  return result;
}

async function main(): Promise<void> {
  console.log(`Reading source PDF from ${SOURCE_PDF_PATH}`);
  const rawBytes = readFileSync(SOURCE_PDF_PATH);
  const actualHash = createHash("sha256").update(rawBytes).digest("hex");

  if (actualHash !== REFERENCE_TRUTH_DOCUMENT.sourceFingerprintSha256) {
    fail(`source document SHA-256 mismatch: expected ${REFERENCE_TRUTH_DOCUMENT.sourceFingerprintSha256}, got ${actualHash}`);
  }
  console.log(`Source document SHA-256 verified: ${actualHash}`);

  const bytes1 = new Uint8Array(rawBytes).slice();
  const bytes2 = new Uint8Array(rawBytes).slice();

  console.log("Running physical reconstruction chain (run 1/2)...");
  const result1 = await runFullChain(bytes1);
  console.log("Running physical reconstruction chain (run 2/2)...");
  const result2 = await runFullChain(bytes2);

  const json1 = JSON.stringify(result1);
  const json2 = JSON.stringify(result2);
  if (json1 !== json2) {
    fail("two independent reconstruction runs produced different results — reconstruction is not deterministic, cannot proceed");
  }
  console.log(`Two independent reconstruction runs are byte-identical (sha256 of serialized result: ${sha256Hex(json1)})`);

  const result = result1;

  // Coleta todos os segmentos de todas as páginas-alvo, em todos os grupos candidatos (a localização de páginas pode formar mais de um grupo candidato ao longo do documento inteiro).
  const segmentsByPage = new Map<number, ReconstructedHorizontalSegment[]>();
  TARGET_PAGES.forEach((p) => segmentsByPage.set(p, []));

  let foundPages = 0;
  result.groups.forEach((group) => {
    group.pages.forEach((page) => {
      if (!(TARGET_PAGES as readonly number[]).includes(page.pageNumber)) return;
      foundPages++;
      segmentsByPage.get(page.pageNumber)!.push(...page.segments);
      console.log(`  page ${page.pageNumber}: status=${page.status}, segments=${page.segments.length}, lines=${page.lines.length}, blocks=${page.blocks.length}`);
    });
  });

  if (foundPages !== TARGET_PAGES.length) {
    fail(`expected to find exactly ${TARGET_PAGES.length} target pages (46, 50, 54) across all reconstructed groups, found ${foundPages}`);
  }

  // ---------------------------------------------------------------------
  // MATERIAL FINDING (documented in full in
  // EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md): direct lookup of the
  // frozen reference truth's segmentKeys (from `physicalOriginPt` and
  // `ReferenceTruthPhysicalRegion.segmentKeys`) against this fresh
  // reconstruction's segmentKeys fails 100% of the time — 0/186 regions
  // resolve. `computeSegmentKey` is not a content hash: it is
  // `sha256(["segment", lineKey, ...sourceTextItemIndices])`, and
  // `lineKey` chains up through a `reconstructionContextFingerprint`
  // that folds in the page-location/structure-reconstruction rule-set
  // identity — which has been versioned forward since the reference
  // truth was frozen (Sprint 21.4B.3A.3). The *geometry* is untouched by
  // this: pairing frozen regions to fresh lines purely by
  // `verticalOrder` (both already 1-based, sequential, deterministic,
  // non-textual fields that are part of the frozen contract itself) and
  // frozen `segmentKeys` to fresh `segmentKeys` purely by array position
  // produces an EXACT (zero-tolerance) bounding-box match for every
  // single region (186/186) and every single segment (936/936), with
  // zero ambiguity (no old key ever maps to more than one distinct new
  // key). This is never text-content inference, never proximity/fuzzy
  // matching, and never a hash correction — it is an exact geometric
  // identity recovered through the domain's own pre-existing structural
  // ordering. The remap is used only to recover each already-declared
  // segmentKey's bounding box; every segmentKey emitted in this Sprint's
  // output is the ORIGINAL key already present in `physicalOriginPt`,
  // never the freshly recomputed one.
  // ---------------------------------------------------------------------
  interface RemapEntry {
    readonly boundingBox: { leftPoints: number; topPoints: number; rightPoints: number; bottomPoints: number };
  }
  const remapByPageAndOldKey = new Map<string, RemapEntry>();
  const remapConflicts: string[] = [];

  let totalRegionLinePairs = 0;
  let regionLevelBoxMismatches = 0;
  let segmentCountMismatches = 0;

  TARGET_PAGES.forEach((pageNum) => {
    const page = result.groups.flatMap((g) => g.pages).find((p) => p.pageNumber === pageNum);
    if (page === undefined) return;
    const frozenRegionsThisPage = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.physicalRegions).filter((r) => r.realPageNumber === pageNum);
    const linesSorted = [...page.lines].sort((a, b) => a.verticalOrder - b.verticalOrder);
    const regionsSorted = [...frozenRegionsThisPage].sort((a, b) => a.verticalOrder - b.verticalOrder);

    if (linesSorted.length !== regionsSorted.length) {
      fail(`page ${pageNum}: frozen region count (${regionsSorted.length}) does not match fresh reconstructed line count (${linesSorted.length}) — cannot establish a positional remap`);
    }

    const segByKeyThisPage = new Map(page.segments.map((s) => [s.segmentKey, s] as const));

    for (let i = 0; i < linesSorted.length; i++) {
      totalRegionLinePairs++;
      const line = linesSorted[i];
      const region = regionsSorted[i];
      const boxMatches =
        line.leftPoints === region.boundingBox.leftPoints &&
        line.topPoints === region.boundingBox.topPoints &&
        line.rightPoints === region.boundingBox.rightPoints &&
        line.bottomPoints === region.boundingBox.bottomPoints;
      if (!boxMatches) {
        regionLevelBoxMismatches++;
        console.error(`  region-level box mismatch: region=${region.id} frozen=${JSON.stringify(region.boundingBox)} fresh=${JSON.stringify({ leftPoints: line.leftPoints, topPoints: line.topPoints, rightPoints: line.rightPoints, bottomPoints: line.bottomPoints })}`);
        continue;
      }
      if (line.segmentKeys.length !== region.segmentKeys.length) {
        segmentCountMismatches++;
        console.error(`  segment count mismatch: region=${region.id} frozen=${region.segmentKeys.length} fresh=${line.segmentKeys.length}`);
        continue;
      }
      for (let s = 0; s < line.segmentKeys.length; s++) {
        const oldKey = region.segmentKeys[s];
        const freshKey = line.segmentKeys[s];
        const freshSeg = segByKeyThisPage.get(freshKey);
        if (freshSeg === undefined) {
          fail(`page ${pageNum}: fresh segment key "${freshKey}" (declared on its own line) was not found among the page's own reconstructed segments — internal inconsistency`);
        }
        const box = { leftPoints: freshSeg.leftPoints, topPoints: freshSeg.topPoints, rightPoints: freshSeg.rightPoints, bottomPoints: freshSeg.bottomPoints };
        const mapKey = `${pageNum}:${oldKey}`;
        const existing = remapByPageAndOldKey.get(mapKey);
        if (existing !== undefined && JSON.stringify(existing.boundingBox) !== JSON.stringify(box)) {
          remapConflicts.push(mapKey);
          continue;
        }
        remapByPageAndOldKey.set(mapKey, { boundingBox: box });
      }
    }
  });

  console.log(`Positional remap: ${totalRegionLinePairs} region/line pairs, ${regionLevelBoxMismatches} region-level box mismatches, ${segmentCountMismatches} segment-count mismatches, ${remapConflicts.length} ambiguous old-key conflicts, ${remapByPageAndOldKey.size} remap entries built`);

  if (regionLevelBoxMismatches > 0) fail(`${regionLevelBoxMismatches} region(s) do not match the fresh reconstruction by exact bounding box even after positional pairing — cannot proceed`);
  if (segmentCountMismatches > 0) fail(`${segmentCountMismatches} region/line pair(s) have a different segment count between frozen truth and fresh reconstruction — cannot proceed`);
  if (remapConflicts.length > 0) fail(`${remapConflicts.length} old segmentKey(s) map to more than one distinct fresh bounding box — ambiguous, cannot proceed`);

  // Redundant safety net: re-verify, via the remap, that every region's own union bbox still matches the frozen truth exactly (defense in depth beyond the positional pairing above).
  const allRegionsForCrossCheck = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.physicalRegions).filter((r) => (TARGET_PAGES as readonly number[]).includes(r.realPageNumber));
  let redundantMismatches = 0;
  allRegionsForCrossCheck.forEach((region) => {
    const boxes = region.segmentKeys.map((key) => remapByPageAndOldKey.get(`${region.realPageNumber}:${key}`)!.boundingBox);
    const union = {
      leftPoints: Math.min(...boxes.map((b) => b.leftPoints)),
      topPoints: Math.min(...boxes.map((b) => b.topPoints)),
      rightPoints: Math.max(...boxes.map((b) => b.rightPoints)),
      bottomPoints: Math.max(...boxes.map((b) => b.bottomPoints)),
    };
    const frozen = region.boundingBox;
    if (union.leftPoints !== frozen.leftPoints || union.topPoints !== frozen.topPoints || union.rightPoints !== frozen.rightPoints || union.bottomPoints !== frozen.bottomPoints) {
      redundantMismatches++;
    }
  });
  if (redundantMismatches > 0) fail(`${redundantMismatches} region(s) failed the redundant remap-based union-bbox cross-check — cannot proceed`);
  console.log(`Redundant cross-check passed: all ${allRegionsForCrossCheck.length} regions' union bbox (via remap) match the frozen truth exactly.`);

  // ---------------------------------------------------------------------
  // Resolve, para cada uma das 1.019 células, os segmentKeys declarados
  // em physicalOriginPt através do remap posicional verificado acima —
  // coletando apenas os segmentos efetivamente referenciados.
  // ---------------------------------------------------------------------
  const allCells = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.cells);
  const referencedSegmentKeysByPage = new Map<number, Set<string>>();
  TARGET_PAGES.forEach((p) => referencedSegmentKeysByPage.set(p, new Set()));

  let cellsWithUnresolvableOrigin = 0;
  allCells.forEach((cell) => {
    if (cell.literalText.trim().length === 0) return;
    const parsed = parseReferenceTruthCellPhysicalOrigin(cell.physicalOriginPt);
    if (parsed.kind !== "ok") {
      cellsWithUnresolvableOrigin++;
      console.error(`  cell ${cell.id}: physicalOriginPt malformed: ${parsed.reason}`);
      return;
    }
    parsed.segmentKeys.forEach((key) => {
      if (!remapByPageAndOldKey.has(`${cell.realPageNumber}:${key}`)) {
        cellsWithUnresolvableOrigin++;
        console.error(`  cell ${cell.id}: segmentKey "${key}" not found in the verified remap for page ${cell.realPageNumber}`);
        return;
      }
      referencedSegmentKeysByPage.get(cell.realPageNumber)!.add(key);
    });
  });

  if (cellsWithUnresolvableOrigin > 0) {
    fail(`${cellsWithUnresolvableOrigin} cell(s) have an unresolvable physicalOriginPt against the verified remap — cannot proceed`);
  }
  console.log(`All non-empty cells' physicalOriginPt segment keys resolved successfully against the verified remap.`);
  TARGET_PAGES.forEach((p) => console.log(`  page ${p}: ${referencedSegmentKeysByPage.get(p)!.size} distinct referenced segment keys`));

  // ---------------------------------------------------------------------
  // Constrói o registro de segmentos físicos (apenas os referenciados) e
  // gera a geometria real via o algoritmo já congelado (Commit 1),
  // executando a geração duas vezes e exigindo hashes idênticos antes de
  // publicar.
  // ---------------------------------------------------------------------
  function buildPhysicalSegments(): ReadonlyArray<ReferenceTruthPhysicalSegmentGeometry> {
    const out: ReferenceTruthPhysicalSegmentGeometry[] = [];
    TARGET_PAGES.forEach((page) => {
      const keys = [...referencedSegmentKeysByPage.get(page)!].sort();
      keys.forEach((key) => {
        const entry = remapByPageAndOldKey.get(`${page}:${key}`)!;
        out.push({
          segmentKey: key,
          realPageNumber: page,
          boundingBox: entry.boundingBox,
        });
      });
    });
    return out;
  }

  const physicalSegments = buildPhysicalSegments();
  const pageBounds: ReadonlyArray<ReferenceTruthCellGeometryPageBounds> = REFERENCE_TRUTH_PAGES.filter((p) => (TARGET_PAGES as readonly number[]).includes(p.realPageNumber)).map((p) => ({
    realPageNumber: p.realPageNumber,
    pageWidthPoints: p.pageWidthPoints,
    pageHeightPoints: p.pageHeightPoints,
  }));

  const allLogicalRows = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.logicalRows);
  const allPhysicalRegions = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.physicalRegions);

  function runGeneration() {
    return buildReferenceTruthCellGeometry(
      {
        cells: allCells,
        logicalRows: allLogicalRows,
        physicalRegions: allPhysicalRegions,
        columns: REFERENCE_TRUTH_COLUMNS,
        physicalSegments,
        pageBounds,
      },
      pageBounds,
    );
  }

  const gen1 = runGeneration();
  const gen2 = runGeneration();
  const gen1Json = JSON.stringify(gen1);
  const gen2Json = JSON.stringify(gen2);
  if (gen1Json !== gen2Json) {
    fail("two independent geometry generation runs produced different results — generation is not deterministic, cannot proceed");
  }
  const generationHash = sha256Hex(gen1Json);
  console.log(`Two independent geometry generation runs are byte-identical (sha256: ${generationHash})`);

  if (gen1.integrityIssues.length > 0) {
    console.error(`${gen1.integrityIssues.length} integrity issue(s):`);
    gen1.integrityIssues.forEach((i) => console.error(`  ${i.cellId}: ${i.code} — ${i.message}`));
    fail(`${gen1.integrityIssues.length} cell(s) could not be resolved into geometry — cannot proceed`);
  }
  if (gen1.validationIssues.length > 0) {
    console.error(`${gen1.validationIssues.length} validation issue(s):`);
    gen1.validationIssues.forEach((i) => console.error(`  ${i.cellId}: ${i.code} — ${i.message}`));
    fail(`${gen1.validationIssues.length} geometry record(s) failed post-hoc validation — cannot proceed`);
  }

  if (gen1.geometries.length !== allCells.length) {
    fail(`expected ${allCells.length} geometries (one per cell), got ${gen1.geometries.length}`);
  }
  console.log(`${gen1.geometries.length}/${allCells.length} cells resolved into valid geometry. 0 integrity issues, 0 validation issues.`);

  // ---------------------------------------------------------------------
  // Estatísticas para o relatório.
  // ---------------------------------------------------------------------
  const byResolutionKind = new Map<string, number>();
  gen1.geometries.forEach((g) => byResolutionKind.set(g.resolutionKind, (byResolutionKind.get(g.resolutionKind) ?? 0) + 1));
  console.log("Distribution by resolutionKind:", Object.fromEntries(byResolutionKind));

  const sharedGroupIds = new Set(gen1.geometries.map((g) => g.sharedGeometryGroupId).filter((id): id is string => id !== null));
  console.log(`Distinct shared geometry groups: ${sharedGroupIds.size}`);

  const multilineCells = gen1.geometries.filter((g) => g.resolutionKind === "multiple_source_fragments").length;
  console.log(`Cells with multiple own fragments: ${multilineCells}`);

  const emptyCells = gen1.geometries.filter((g) => g.resolutionKind === "empty_slot_projection").length;
  console.log(`Empty-slot cells: ${emptyCells}`);

  // ---------------------------------------------------------------------
  // Escreve os arquivos de dados congelados.
  // ---------------------------------------------------------------------
  writePhysicalSegmentsFiles(physicalSegments);
  writeGeometryPageFiles(gen1.geometries);
  writeManifest({
    documentHash: actualHash,
    adapterVersion: EXPECTED_ADAPTER_VERSION,
    underlyingLibraryVersion: EXPECTED_UNDERLYING_LIBRARY_VERSION,
    generationHash,
    totalCells: gen1.geometries.length,
    byResolutionKind: Object.fromEntries(byResolutionKind),
    sharedGroupCount: sharedGroupIds.size,
  });
  writeSvgFiles(gen1.geometries);

  console.log("Generation complete.");
}

function tsStringLiteral(value: string): string {
  return JSON.stringify(value);
}

function writePhysicalSegmentsFiles(segments: ReadonlyArray<ReferenceTruthPhysicalSegmentGeometry>): void {
  TARGET_PAGES.forEach((page) => {
    const pageSegments = segments.filter((s) => s.realPageNumber === page);
    const lines: string[] = [];
    lines.push(`/**`);
    lines.push(` * Registro congelado de segmentos físicos resolvidos, exclusivamente os efetivamente`);
    lines.push(` * referenciados por physicalOriginPt de alguma célula da página ${page}. Gerado por`);
    lines.push(` * uma execução determinística do reconstrutor físico já aprovado do domínio contra o`);
    lines.push(` * documento-fonte exato (ver EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md) — nunca por`);
    lines.push(` * Docling, leitura óptica de caracteres ou qualquer motor. Não editar manualmente: regenerar via`);
    lines.push(` * o gerador único de dados reais desta Sprint (ver EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md, §2, para o caminho exato).`);
    lines.push(` */`);
    lines.push(`import type { ReferenceTruthPhysicalSegmentGeometry } from "./discovery-reference-truth-cell-geometry.types";`);
    lines.push(``);
    lines.push(`export const REFERENCE_TRUTH_CELL_GEOMETRY_PHYSICAL_SEGMENTS_PAGE_${page}: ReadonlyArray<ReferenceTruthPhysicalSegmentGeometry> = [`);
    pageSegments.forEach((s) => {
      lines.push(
        `  { segmentKey: ${tsStringLiteral(s.segmentKey)}, realPageNumber: ${s.realPageNumber}, boundingBox: { leftPoints: ${s.boundingBox.leftPoints}, topPoints: ${s.boundingBox.topPoints}, rightPoints: ${s.boundingBox.rightPoints}, bottomPoints: ${s.boundingBox.bottomPoints} } },`,
      );
    });
    lines.push(`];`);
    lines.push(``);
    const filePath = join(CELL_GEOMETRY_DIR, `discovery-reference-truth-cell-geometry-physical-segments-page-${page}.ts`);
    writeFileSync(filePath, lines.join("\n"), "utf8");
    console.log(`  wrote ${filePath} (${pageSegments.length} segments)`);
  });
}

function boxLiteral(box: { leftPoints: number; topPoints: number; rightPoints: number; bottomPoints: number }): string {
  return `{ leftPoints: ${box.leftPoints}, topPoints: ${box.topPoints}, rightPoints: ${box.rightPoints}, bottomPoints: ${box.bottomPoints} }`;
}

function geometryLiteral(g: ReferenceTruthCellGeometry): string {
  const fragments = g.fragments
    .map(
      (f) =>
        `{ id: ${tsStringLiteral(f.id)}, sourceSegmentKey: ${f.sourceSegmentKey === null ? "null" : tsStringLiteral(f.sourceSegmentKey)}, sourceBoundingBox: ${f.sourceBoundingBox === null ? "null" : boxLiteral(f.sourceBoundingBox)}, projectionKind: ${tsStringLiteral(f.projectionKind)}, projectedBoundingBox: ${boxLiteral(f.projectedBoundingBox)} }`,
    )
    .join(", ");
  const p = g.provenance;
  return (
    `{ schemaVersion: ${g.schemaVersion}, cellId: ${tsStringLiteral(g.cellId)}, realPageNumber: ${g.realPageNumber}, logicalRowId: ${tsStringLiteral(g.logicalRowId)}, columnId: ${tsStringLiteral(g.columnId)}, ` +
    `resolutionKind: ${tsStringLiteral(g.resolutionKind)}, spatialSemantics: ${tsStringLiteral(g.spatialSemantics)}, ` +
    `sourceSegmentKeys: [${g.sourceSegmentKeys.map(tsStringLiteral).join(", ")}], sourcePhysicalRegionIds: [${g.sourcePhysicalRegionIds.map(tsStringLiteral).join(", ")}], ` +
    `rowBand: ${boxLiteral(g.rowBand)}, columnBand: { leftPoints: ${g.columnBand.leftPoints}, rightPoints: ${g.columnBand.rightPoints} }, ` +
    `fragments: [${fragments}], expectedEnvelope: ${boxLiteral(g.expectedEnvelope)}, ` +
    `sharedGeometryGroupId: ${g.sharedGeometryGroupId === null ? "null" : tsStringLiteral(g.sharedGeometryGroupId)}, sharedWithCellIds: [${g.sharedWithCellIds.map(tsStringLiteral).join(", ")}], ` +
    `provenance: { cellId: ${tsStringLiteral(p.cellId)}, logicalRowId: ${tsStringLiteral(p.logicalRowId)}, columnId: ${tsStringLiteral(p.columnId)}, columnRole: ${tsStringLiteral(p.columnRole)}, physicalOriginPt: ${tsStringLiteral(p.physicalOriginPt)}, parsedSegmentKeys: [${p.parsedSegmentKeys.map(tsStringLiteral).join(", ")}], rowPhysicalRegionIds: [${p.rowPhysicalRegionIds.map(tsStringLiteral).join(", ")}], resolutionNotesPt: ${tsStringLiteral(p.resolutionNotesPt)} } }`
  );
}

function writeGeometryPageFiles(geometries: ReadonlyArray<ReferenceTruthCellGeometry>): void {
  TARGET_PAGES.forEach((page) => {
    const pageGeometries = geometries.filter((g) => g.realPageNumber === page);
    const lines: string[] = [];
    lines.push(`/**`);
    lines.push(` * Geometria esperada real, congelada, das células da página ${page} (verdade de`);
    lines.push(` * referência). Produzida pelo algoritmo genérico já congelado (Commit 1) a partir do`);
    lines.push(` * registro de segmentos físicos desta mesma página, executada duas vezes com`);
    lines.push(` * resultado byte-idêntico antes da publicação (ver EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md).`);
    lines.push(` * Não editar manualmente: regenerar via`);
    lines.push(` * o gerador único de dados reais desta Sprint (ver EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md, §2, para o caminho exato).`);
    lines.push(` */`);
    lines.push(`import type { ReferenceTruthCellGeometry } from "./discovery-reference-truth-cell-geometry.types";`);
    lines.push(``);
    lines.push(`export const REFERENCE_TRUTH_CELL_GEOMETRY_PAGE_${page}: ReadonlyArray<ReferenceTruthCellGeometry> = [`);
    pageGeometries.forEach((g) => {
      lines.push(`  ${geometryLiteral(g)},`);
    });
    lines.push(`];`);
    lines.push(``);
    const filePath = join(CELL_GEOMETRY_DIR, `discovery-reference-truth-cell-geometry-page-${page}.ts`);
    writeFileSync(filePath, lines.join("\n"), "utf8");
    console.log(`  wrote ${filePath} (${pageGeometries.length} cells)`);
  });
}

function writeManifest(info: {
  documentHash: string;
  adapterVersion: string;
  underlyingLibraryVersion: string;
  generationHash: string;
  totalCells: number;
  byResolutionKind: Record<string, number>;
  sharedGroupCount: number;
}): void {
  const lines: string[] = [];
  lines.push(`/**`);
  lines.push(` * Manifesto determinístico da geometria esperada real (Commit 2). Não editar`);
  lines.push(` * manualmente: regenerar via`);
  lines.push(` * o gerador único de dados reais desta Sprint (ver EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md, §2, para o caminho exato).`);
  lines.push(` *`);
  lines.push(` * A identidade do adaptador físico e da biblioteca subjacente é registrada aqui`);
  lines.push(` * apenas por hash (nunca como literal de texto): este arquivo vive fora do único`);
  lines.push(` * diretório do pacote autorizado a mencionar essa dependência de infraestrutura`);
  lines.push(` * (guarda arquitetural pré-existente, não desta Sprint). O valor literal completo`);
  lines.push(` * está documentado em EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md, §1.`);
  lines.push(` */`);
  lines.push(`export const REFERENCE_TRUTH_CELL_GEOMETRY_MANIFEST = {`);
  lines.push(`  schemaVersion: 1,`);
  lines.push(`  sourceDocumentSha256: ${tsStringLiteral(info.documentHash)},`);
  lines.push(`  physicalAdapterVersionSha256: ${tsStringLiteral(sha256Hex(info.adapterVersion))},`);
  lines.push(`  physicalUnderlyingLibraryVersionSha256: ${tsStringLiteral(sha256Hex(info.underlyingLibraryVersion))},`);
  lines.push(`  realPageNumbers: [${TARGET_PAGES.join(", ")}],`);
  lines.push(`  totalCellCount: ${info.totalCells},`);
  lines.push(`  countByResolutionKind: ${JSON.stringify(info.byResolutionKind)},`);
  lines.push(`  sharedGeometryGroupCount: ${info.sharedGroupCount},`);
  lines.push(`  canonicalGenerationSha256: ${tsStringLiteral(info.generationHash)},`);
  lines.push(`} as const;`);
  lines.push(``);
  const filePath = join(CELL_GEOMETRY_DIR, "discovery-reference-truth-cell-geometry-manifest.ts");
  writeFileSync(filePath, lines.join("\n"), "utf8");
  console.log(`  wrote ${filePath}`);
}

function writeSvgFiles(geometries: ReadonlyArray<ReferenceTruthCellGeometry>): void {
  const pagesById = new Map(REFERENCE_TRUTH_PAGES.map((p) => [p.realPageNumber, p] as const));
  const rowsByPage = new Map<number, Array<{ id: string; band: { leftPoints: number; topPoints: number; rightPoints: number; bottomPoints: number } }>>();
  const allLogicalRows = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.logicalRows);
  const regionsById = new Map(REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.physicalRegions).map((r) => [r.id, r] as const));

  TARGET_PAGES.forEach((page) => {
    const rows = allLogicalRows
      .filter((r) => r.physicalRegionIds.some((id) => regionsById.get(id)?.realPageNumber === page))
      .map((r) => {
        const boxes = r.physicalRegionIds.map((id) => regionsById.get(id)!.boundingBox);
        return {
          id: r.id,
          band: {
            leftPoints: Math.min(...boxes.map((b) => b.leftPoints)),
            topPoints: Math.min(...boxes.map((b) => b.topPoints)),
            rightPoints: Math.max(...boxes.map((b) => b.rightPoints)),
            bottomPoints: Math.max(...boxes.map((b) => b.bottomPoints)),
          },
        };
      });
    rowsByPage.set(page, rows);
  });

  TARGET_PAGES.forEach((page) => {
    const pageInfo = pagesById.get(page)!;
    const svg = renderReferenceTruthCellGeometryPageSvg({
      realPageNumber: page,
      pageWidthPoints: pageInfo.pageWidthPoints,
      pageHeightPoints: pageInfo.pageHeightPoints,
      columns: REFERENCE_TRUTH_COLUMNS.map((c) => ({ id: c.id, leftPoints: c.horizontalIntervalPoints.leftPoints, rightPoints: c.horizontalIntervalPoints.rightPoints })),
      rows: rowsByPage.get(page)!,
      geometries: geometries.filter((g) => g.realPageNumber === page),
    });
    const filePath = join(CELL_GEOMETRY_DIR, `diagnostics`, `page-${page}.svg`);
    writeFileSync(filePath, svg, "utf8");
    console.log(`  wrote ${filePath}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
