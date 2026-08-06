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
  buildReproduciblePhysicalSegmentLocator,
  buildCanonicalSpatialProjection,
  parseReferenceTruthCellPhysicalOrigin,
  type ReferenceTruthCellGeometry,
  type ReferenceTruthCellGeometryPageBounds,
  type ReferenceTruthPhysicalSegmentGeometry,
} from "../../../../domain/budget-document-location/tabular-region-detection/testing/discovery/reference-truth/cell-geometry/discovery-reference-truth-cell-geometry";
import { renderReferenceTruthCellGeometryPageSvg } from "../../../../domain/budget-document-location/tabular-region-detection/testing/discovery/reference-truth/cell-geometry/discovery-reference-truth-cell-geometry-svg";

/**
 * Hash canônico espacial (nunca de proveniência) capturado a partir dos
 * dados publicados sob schemaVersion 1, ANTES da correção de proveniência
 * (verificação probatória final da PR #82, §6). Recalculado neste
 * gerador sobre a nova geração (schemaVersion 2) — os dois devem ser
 * idênticos, provando que a correção de identidade nunca alterou nenhuma
 * coordenada, faixa, fragmento ou envelope já publicado.
 */
const PREVIOUS_FULL_ARTIFACT_SHA256 = "b0724ca46e4018b182bcb9d95b5016e7704440a5c5bbaba71e4d9272f02c1da7";
const PREVIOUS_CANONICAL_SPATIAL_GEOMETRY_SHA256 = "9221d8bb0f7994cdde106cdf1ba718380881d2d4cbe1710add52705bec62680b";

/**
 * Resultado objetivo, já obtido e aceito, da prova histórica direta
 * (replay no commit `ccd8f8f1627e4f628f8787c36a2b27517a42e29b`, worktree
 * isolado com lockfile congelado — ver
 * `EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md`). Não
 * reexecutado por este gerador — apenas registrado, para não repetir uma
 * investigação histórica já concluída.
 */
const HISTORICAL_REPLAY_RESULT = {
  historicalCommitSha: "ccd8f8f1627e4f628f8787c36a2b27517a42e29b",
  directLineKeyResolutionAttemptCount: 186,
  directLineKeyResolutionSuccessCount: 0,
  directLineKeyResolutionAbsentCount: 186,
  directLineKeyResolutionAmbiguityCount: 0,
} as const;

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
  // BASE FORMAL DA ASSOCIAÇÃO (verificação probatória final da PR #82;
  // documentado por completo em
  // EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md): uma
  // prova histórica direta — replay desta mesma cadeia física exatamente
  // no commit em que a verdade de referência foi congelada
  // (ccd8f8f1627e4f628f8787c36a2b27517a42e29b), com lockfile congelado,
  // contra o documento exato — mostrou que a `lineKey`/`segmentKey` já
  // declarada em `physicalOriginPt`/`ReferenceTruthPhysicalRegion.segmentKeys`
  // não é reproduzível por nenhuma execução conhecida da cadeia física
  // (0/186 regiões resolvidas diretamente por lineKey). Essas chaves
  // permanecem no contrato exclusivamente como identificadores históricos
  // internos congelados (`legacyDeclaredSegmentKey`, status
  // `legacy_unreproducible`) — nunca mais como identidade física
  // reproduzível.
  //
  // A identidade canônica de cada segmento passa a ser o localizador
  // estrutural reproduzível, associado por
  // `exact_structural_position_with_region_geometry_validation`: mesma
  // página + mesma posição vertical da região física congelada + caixa
  // da região exatamente igual (pareamento estrutural contra uma
  // reconstrução física fresca) + mesma quantidade de segmentos + mesma
  // ordem horizontal do segmento dentro da linha + duas execuções físicas
  // independentes e idênticas + zero ambiguidade estrutural — nunca
  // resolução direta por chave, nunca fuzzy matching, nunca aproximação.
  // Confirmado: 186/186 regiões pareadas por página, verticalOrder e
  // caixa total exatamente igual (zero tolerância); mesma quantidade de
  // segmentos em cada par; 936 ocorrências de segmento associadas
  // estruturalmente pela mesma ordem horizontal dentro de cada par; zero
  // ambiguidade. Não existia caixa histórica individual congelada para
  // comparar cada segmento — portanto isto nunca é "936/936 pares de
  // segmento bateram exatamente em bounding box" (não houve 936
  // comparações individuais de bounding box; ver
  // EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md).
  // ---------------------------------------------------------------------
  interface RemapEntry {
    readonly boundingBox: { leftPoints: number; topPoints: number; rightPoints: number; bottomPoints: number };
    readonly frozenPhysicalRegionId: string;
    readonly regionVerticalOrder: number;
    readonly regionBoundingBox: { leftPoints: number; topPoints: number; rightPoints: number; bottomPoints: number };
    readonly segmentHorizontalOrder: number;
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
        const newEntry: RemapEntry = {
          boundingBox: box,
          frozenPhysicalRegionId: region.id,
          regionVerticalOrder: region.verticalOrder,
          regionBoundingBox: { leftPoints: region.boundingBox.leftPoints, topPoints: region.boundingBox.topPoints, rightPoints: region.boundingBox.rightPoints, bottomPoints: region.boundingBox.bottomPoints },
          segmentHorizontalOrder: s + 1,
        };
        const existing = remapByPageAndOldKey.get(mapKey);
        if (existing !== undefined && JSON.stringify(existing.boundingBox) !== JSON.stringify(box)) {
          remapConflicts.push(mapKey);
          continue;
        }
        remapByPageAndOldKey.set(mapKey, newEntry);
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
  const physicalAdapterVersionSha256 = sha256Hex(EXPECTED_ADAPTER_VERSION);
  const physicalUnderlyingLibraryVersionSha256 = sha256Hex(EXPECTED_UNDERLYING_LIBRARY_VERSION);

  function buildPhysicalSegments(): ReadonlyArray<ReferenceTruthPhysicalSegmentGeometry> {
    const out: ReferenceTruthPhysicalSegmentGeometry[] = [];
    TARGET_PAGES.forEach((page) => {
      const keys = [...referencedSegmentKeysByPage.get(page)!].sort();
      keys.forEach((key) => {
        const entry = remapByPageAndOldKey.get(`${page}:${key}`)!;
        const reproducibleLocator = buildReproduciblePhysicalSegmentLocator({
          sourceDocumentSha256: actualHash,
          realPageNumber: page,
          frozenPhysicalRegionId: entry.frozenPhysicalRegionId,
          regionVerticalOrder: entry.regionVerticalOrder,
          segmentHorizontalOrder: entry.segmentHorizontalOrder,
          regionBoundingBox: entry.regionBoundingBox,
          segmentBoundingBox: entry.boundingBox,
          physicalAdapterVersionSha256,
          physicalUnderlyingLibraryVersionSha256,
          reconstructionContextFingerprint: result.reconstructionContextFingerprint,
          physicalGeometryContextFingerprint: result.physicalGeometryContextFingerprint,
        });
        out.push({
          legacyDeclaredSegmentKey: key,
          legacyDeclaredSegmentKeyStatus: "legacy_unreproducible",
          realPageNumber: page,
          boundingBox: entry.boundingBox,
          associationBasis: "exact_structural_position_with_region_geometry_validation",
          reproducibleLocator,
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
  // Prova espacial (verificação probatória final da PR #82, §6): a
  // correção de proveniência nunca pode alterar nenhuma coordenada, faixa,
  // fragmento ou envelope já publicado. Recalcula o hash canônico
  // exclusivamente espacial sobre a nova geração e exige igualdade exata
  // com o hash já capturado a partir dos dados publicados sob
  // schemaVersion 1 (antes desta correção).
  // ---------------------------------------------------------------------
  const canonicalSpatialProjection = buildCanonicalSpatialProjection(gen1.geometries);
  const canonicalSpatialGeometrySha256 = sha256Hex(JSON.stringify(canonicalSpatialProjection));
  console.log(`Canonical spatial geometry sha256 (new, schemaVersion 2): ${canonicalSpatialGeometrySha256}`);
  console.log(`Canonical spatial geometry sha256 (previous, schemaVersion 1): ${PREVIOUS_CANONICAL_SPATIAL_GEOMETRY_SHA256}`);
  if (canonicalSpatialGeometrySha256 !== PREVIOUS_CANONICAL_SPATIAL_GEOMETRY_SHA256) {
    fail("canonical spatial geometry hash changed after the provenance correction — this must never happen, cannot proceed");
  }
  console.log("Canonical spatial geometry hash confirmed UNCHANGED by the provenance correction.");

  // ---------------------------------------------------------------------
  // Bloco de verificação da prova histórica negativa (§7 e §9 da
  // verificação probatória final da PR #82) — resultado já obtido e
  // aceito (ver HISTORICAL_REPLAY_RESULT acima); esta seção apenas
  // computa as contagens e hashes que dependem exclusivamente da verdade
  // congelada e do registro publicado, sem reexecutar o replay histórico.
  // ---------------------------------------------------------------------
  const historicalDistinctKeySet = new Set<string>();
  let historicalSegmentOccurrenceCount = 0;
  allRegionsForCrossCheck.forEach((region) => {
    region.segmentKeys.forEach((key) => {
      historicalSegmentOccurrenceCount++;
      historicalDistinctKeySet.add(`${region.realPageNumber}:${key}`);
    });
  });

  const historicalDirectRegistrySha256 = sha256Hex(JSON.stringify([]));

  const bridgeRegistryCanonical = [...remapByPageAndOldKey.entries()]
    .map(([mapKey, entry]) => ({ mapKey, ...entry }))
    .sort((a, b) => a.mapKey.localeCompare(b.mapKey));
  const currentStructuralBridgeRegistrySha256 = sha256Hex(JSON.stringify(bridgeRegistryCanonical));

  const publishedRegistryCanonical = [...physicalSegments].sort((a, b) => (a.realPageNumber - b.realPageNumber) || a.legacyDeclaredSegmentKey.localeCompare(b.legacyDeclaredSegmentKey));
  const publishedRegistrySha256 = sha256Hex(JSON.stringify(publishedRegistryCanonical));

  // Campos explícitos de aplicabilidade (correção factual da PR #82): a
  // resolução direta de lineKey foi de fato tentada e falhou por
  // ausência (nunca ambiguidade) em 186/186 casos. A resolução direta de
  // segmentKey NUNCA foi tentada — depende de uma linha já resolvida, e
  // nenhuma linha resolveu — portanto é "bloqueada", nunca "tentada e
  // reprovada". A comparação individual de bounding box também nunca foi
  // tentada, pelo mesmo motivo: não existe caixa histórica individual
  // para comparar. `individualBoundingBoxMismatchCount` é `null`
  // (nunca `0`) precisamente porque "zero comparações tentadas" não é o
  // mesmo fato que "zero divergências encontradas entre comparações
  // realizadas".
  const historicalReplayVerification = {
    historicalReferenceTruthCommitSha: HISTORICAL_REPLAY_RESULT.historicalCommitSha,

    historicalLineCount: totalRegionLinePairs,
    directLineKeyResolutionAttemptCount: HISTORICAL_REPLAY_RESULT.directLineKeyResolutionAttemptCount,
    directLineKeyResolutionSuccessCount: HISTORICAL_REPLAY_RESULT.directLineKeyResolutionSuccessCount,
    directLineKeyResolutionAbsentCount: HISTORICAL_REPLAY_RESULT.directLineKeyResolutionAbsentCount,
    directLineKeyResolutionAmbiguityCount: HISTORICAL_REPLAY_RESULT.directLineKeyResolutionAmbiguityCount,

    historicalSegmentOccurrenceCount,
    historicalDistinctSegmentKeyCount: historicalDistinctKeySet.size,

    directSegmentKeyResolutionApplicability: "not_applicable_due_to_zero_resolved_lines" as const,
    directSegmentKeyResolutionAttemptCount: 0,
    directSegmentKeyResolutionSuccessCount: 0,
    directSegmentKeyResolutionFailureCount: 0,
    directSegmentKeyResolutionBlockedCount: historicalSegmentOccurrenceCount,

    individualBoundingBoxComparisonApplicability: "not_applicable_due_to_zero_resolved_segments" as const,
    individualBoundingBoxComparisonAttemptCount: 0,
    individualBoundingBoxMismatchCount: null as number | null,

    publishedCellReferencedSegmentKeyCount: physicalSegments.length,

    historicalDirectRegistrySha256,
    currentStructuralBridgeRegistrySha256,
    publishedRegistrySha256,
  };
  console.log("Historical replay verification block:", historicalReplayVerification);

  // ---------------------------------------------------------------------
  // Escreve os arquivos de dados congelados.
  // ---------------------------------------------------------------------
  writePhysicalSegmentsFiles(physicalSegments);
  writeGeometryPageFiles(gen1.geometries);
  writeManifest({
    documentHash: actualHash,
    generationHash,
    totalCells: gen1.geometries.length,
    byResolutionKind: Object.fromEntries(byResolutionKind),
    sharedGroupCount: sharedGroupIds.size,
    previousFullArtifactSha256: PREVIOUS_FULL_ARTIFACT_SHA256,
    canonicalSpatialGeometrySha256,
    historicalReplayVerification,
  });
  writeSvgFiles(gen1.geometries);

  console.log("Generation complete.");
}

function tsStringLiteral(value: string): string {
  return JSON.stringify(value);
}

function boxLiteral(box: { leftPoints: number; topPoints: number; rightPoints: number; bottomPoints: number }): string {
  return `{ leftPoints: ${box.leftPoints}, topPoints: ${box.topPoints}, rightPoints: ${box.rightPoints}, bottomPoints: ${box.bottomPoints} }`;
}

function locatorLiteral(l: ReferenceTruthPhysicalSegmentGeometry["reproducibleLocator"]): string {
  return (
    `{ sourceDocumentSha256: ${tsStringLiteral(l.sourceDocumentSha256)}, realPageNumber: ${l.realPageNumber}, ` +
    `frozenPhysicalRegionId: ${tsStringLiteral(l.frozenPhysicalRegionId)}, regionVerticalOrder: ${l.regionVerticalOrder}, segmentHorizontalOrder: ${l.segmentHorizontalOrder}, ` +
    `regionBoundingBox: ${boxLiteral(l.regionBoundingBox)}, segmentBoundingBox: ${boxLiteral(l.segmentBoundingBox)}, ` +
    `physicalAdapterVersionSha256: ${tsStringLiteral(l.physicalAdapterVersionSha256)}, physicalUnderlyingLibraryVersionSha256: ${tsStringLiteral(l.physicalUnderlyingLibraryVersionSha256)}, ` +
    `reconstructionContextFingerprint: ${tsStringLiteral(l.reconstructionContextFingerprint)}, physicalGeometryContextFingerprint: ${tsStringLiteral(l.physicalGeometryContextFingerprint)}, ` +
    `reproducibleLineKey: ${tsStringLiteral(l.reproducibleLineKey)}, reproducibleSegmentKey: ${tsStringLiteral(l.reproducibleSegmentKey)} }`
  );
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
    lines.push(` * Docling, leitura óptica de caracteres ou qualquer motor. legacyDeclaredSegmentKey é`);
    lines.push(` * apenas o ponteiro interno histórico (status legacy_unreproducible — ver`);
    lines.push(` * EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md); a identidade canônica é`);
    lines.push(` * reproducibleLocator. Não editar manualmente: regenerar via`);
    lines.push(` * o gerador único de dados reais desta Sprint (ver EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md, §2, para o caminho exato).`);
    lines.push(` */`);
    lines.push(`import type { ReferenceTruthPhysicalSegmentGeometry } from "./discovery-reference-truth-cell-geometry.types";`);
    lines.push(``);
    lines.push(`export const REFERENCE_TRUTH_CELL_GEOMETRY_PHYSICAL_SEGMENTS_PAGE_${page}: ReadonlyArray<ReferenceTruthPhysicalSegmentGeometry> = [`);
    pageSegments.forEach((s) => {
      lines.push(
        `  { legacyDeclaredSegmentKey: ${tsStringLiteral(s.legacyDeclaredSegmentKey)}, legacyDeclaredSegmentKeyStatus: ${tsStringLiteral(s.legacyDeclaredSegmentKeyStatus)}, realPageNumber: ${s.realPageNumber}, boundingBox: ${boxLiteral(s.boundingBox)}, associationBasis: ${tsStringLiteral(s.associationBasis)}, reproducibleLocator: ${locatorLiteral(s.reproducibleLocator)} },`,
      );
    });
    lines.push(`];`);
    lines.push(``);
    const filePath = join(CELL_GEOMETRY_DIR, `discovery-reference-truth-cell-geometry-physical-segments-page-${page}.ts`);
    writeFileSync(filePath, lines.join("\n"), "utf8");
    console.log(`  wrote ${filePath} (${pageSegments.length} segments)`);
  });
}

function geometryLiteral(g: ReferenceTruthCellGeometry): string {
  const fragments = g.fragments
    .map(
      (f) =>
        `{ id: ${tsStringLiteral(f.id)}, legacyDeclaredSegmentKey: ${f.legacyDeclaredSegmentKey === null ? "null" : tsStringLiteral(f.legacyDeclaredSegmentKey)}, legacyDeclaredSegmentKeyStatus: ${f.legacyDeclaredSegmentKeyStatus === null ? "null" : tsStringLiteral(f.legacyDeclaredSegmentKeyStatus)}, reproducibleLocator: ${f.reproducibleLocator === null ? "null" : locatorLiteral(f.reproducibleLocator)}, associationBasis: ${f.associationBasis === null ? "null" : tsStringLiteral(f.associationBasis)}, sourceBoundingBox: ${f.sourceBoundingBox === null ? "null" : boxLiteral(f.sourceBoundingBox)}, projectionKind: ${tsStringLiteral(f.projectionKind)}, projectedBoundingBox: ${boxLiteral(f.projectedBoundingBox)} }`,
    )
    .join(", ");
  const p = g.provenance;
  return (
    `{ schemaVersion: ${g.schemaVersion}, cellId: ${tsStringLiteral(g.cellId)}, realPageNumber: ${g.realPageNumber}, logicalRowId: ${tsStringLiteral(g.logicalRowId)}, columnId: ${tsStringLiteral(g.columnId)}, ` +
    `resolutionKind: ${tsStringLiteral(g.resolutionKind)}, spatialSemantics: ${tsStringLiteral(g.spatialSemantics)}, ` +
    `legacyDeclaredSegmentKeys: [${g.legacyDeclaredSegmentKeys.map(tsStringLiteral).join(", ")}], sourcePhysicalRegionIds: [${g.sourcePhysicalRegionIds.map(tsStringLiteral).join(", ")}], ` +
    `rowBand: ${boxLiteral(g.rowBand)}, columnBand: { leftPoints: ${g.columnBand.leftPoints}, rightPoints: ${g.columnBand.rightPoints} }, ` +
    `fragments: [${fragments}], expectedEnvelope: ${boxLiteral(g.expectedEnvelope)}, ` +
    `sharedGeometryGroupId: ${g.sharedGeometryGroupId === null ? "null" : tsStringLiteral(g.sharedGeometryGroupId)}, sharedWithCellIds: [${g.sharedWithCellIds.map(tsStringLiteral).join(", ")}], ` +
    `provenance: { cellId: ${tsStringLiteral(p.cellId)}, logicalRowId: ${tsStringLiteral(p.logicalRowId)}, columnId: ${tsStringLiteral(p.columnId)}, columnRole: ${tsStringLiteral(p.columnRole)}, physicalOriginPt: ${tsStringLiteral(p.physicalOriginPt)}, legacyDeclaredSegmentKeys: [${p.legacyDeclaredSegmentKeys.map(tsStringLiteral).join(", ")}], rowPhysicalRegionIds: [${p.rowPhysicalRegionIds.map(tsStringLiteral).join(", ")}], resolutionNotesPt: ${tsStringLiteral(p.resolutionNotesPt)} } }`
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

interface HistoricalReplayVerificationInfo {
  readonly historicalReferenceTruthCommitSha: string;

  readonly historicalLineCount: number;
  readonly directLineKeyResolutionAttemptCount: number;
  readonly directLineKeyResolutionSuccessCount: number;
  readonly directLineKeyResolutionAbsentCount: number;
  readonly directLineKeyResolutionAmbiguityCount: number;

  readonly historicalSegmentOccurrenceCount: number;
  readonly historicalDistinctSegmentKeyCount: number;

  readonly directSegmentKeyResolutionApplicability: "not_applicable_due_to_zero_resolved_lines";
  readonly directSegmentKeyResolutionAttemptCount: number;
  readonly directSegmentKeyResolutionSuccessCount: number;
  readonly directSegmentKeyResolutionFailureCount: number;
  readonly directSegmentKeyResolutionBlockedCount: number;

  readonly individualBoundingBoxComparisonApplicability: "not_applicable_due_to_zero_resolved_segments";
  readonly individualBoundingBoxComparisonAttemptCount: number;
  readonly individualBoundingBoxMismatchCount: number | null;

  readonly publishedCellReferencedSegmentKeyCount: number;

  readonly historicalDirectRegistrySha256: string;
  readonly currentStructuralBridgeRegistrySha256: string;
  readonly publishedRegistrySha256: string;
}

function writeManifest(info: {
  documentHash: string;
  generationHash: string;
  totalCells: number;
  byResolutionKind: Record<string, number>;
  sharedGroupCount: number;
  previousFullArtifactSha256: string;
  canonicalSpatialGeometrySha256: string;
  historicalReplayVerification: HistoricalReplayVerificationInfo;
}): void {
  const h = info.historicalReplayVerification;
  const lines: string[] = [];
  lines.push(`/**`);
  lines.push(` * Manifesto determinístico da geometria esperada real (schemaVersion 2 — verificação`);
  lines.push(` * probatória final da PR #82: proveniência corrigida, geometria espacial inalterada).`);
  lines.push(` * Não editar manualmente: regenerar via o gerador único de dados reais desta Sprint`);
  lines.push(` * (ver EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md, §2, para o caminho exato).`);
  lines.push(` *`);
  lines.push(` * A identidade do adaptador físico e da biblioteca subjacente (dentro de`);
  lines.push(` * reproducibleLocator, nos registros de segmento) é registrada apenas por hash (nunca`);
  lines.push(` * como literal de texto): este arquivo vive fora do único diretório do pacote`);
  lines.push(` * autorizado a mencionar essa dependência de infraestrutura (guarda arquitetural`);
  lines.push(` * pré-existente, não desta Sprint). O valor literal completo está documentado em`);
  lines.push(` * EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md, §1.`);
  lines.push(` *`);
  lines.push(` * historicalReplayVerification registra o resultado, já obtido e aceito, da prova`);
  lines.push(` * histórica direta (replay no commit de congelamento da verdade de referência, com`);
  lines.push(` * lockfile congelado — ver EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md):`);
  lines.push(` * as lineKey/segmentKey históricas não são reproduzíveis por nenhuma execução`);
  lines.push(` * conhecida da cadeia física. A geometria em si permanece intacta e é a mesma`);
  lines.push(` * publicada antes desta correção (ver previousFullArtifactSha256/canonicalSpatialGeometrySha256).`);
  lines.push(` *`);
  lines.push(` * Campos de aplicabilidade explícitos (correção factual): a resolução direta de`);
  lines.push(` * lineKey foi de fato tentada e ausente em 186/186 casos (nunca ambígua). A`);
  lines.push(` * resolução direta de segmentKey NUNCA foi tentada — depende de uma linha já`);
  lines.push(` * resolvida, e nenhuma resolveu — por isso "bloqueada", nunca "tentada e`);
  lines.push(` * reprovada". Pelo mesmo motivo, individualBoundingBoxMismatchCount é \`null\`,`);
  lines.push(` * nunca \`0\`: "zero comparações tentadas" não é o mesmo fato que "zero`);
  lines.push(` * divergências encontradas entre comparações realizadas".`);
  lines.push(` */`);
  lines.push(`export const REFERENCE_TRUTH_CELL_GEOMETRY_MANIFEST = {`);
  lines.push(`  schemaVersion: 2,`);
  lines.push(`  sourceDocumentSha256: ${tsStringLiteral(info.documentHash)},`);
  lines.push(`  realPageNumbers: [${TARGET_PAGES.join(", ")}],`);
  lines.push(`  totalCellCount: ${info.totalCells},`);
  lines.push(`  countByResolutionKind: ${JSON.stringify(info.byResolutionKind)},`);
  lines.push(`  sharedGeometryGroupCount: ${info.sharedGroupCount},`);
  lines.push(`  canonicalGenerationSha256: ${tsStringLiteral(info.generationHash)},`);
  lines.push(`  previousFullArtifactSha256: ${tsStringLiteral(info.previousFullArtifactSha256)},`);
  lines.push(`  canonicalSpatialGeometrySha256: ${tsStringLiteral(info.canonicalSpatialGeometrySha256)},`);
  lines.push(`  historicalReplayVerification: {`);
  lines.push(`    historicalReferenceTruthCommitSha: ${tsStringLiteral(h.historicalReferenceTruthCommitSha)},`);
  lines.push(``);
  lines.push(`    historicalLineCount: ${h.historicalLineCount},`);
  lines.push(`    directLineKeyResolutionAttemptCount: ${h.directLineKeyResolutionAttemptCount},`);
  lines.push(`    directLineKeyResolutionSuccessCount: ${h.directLineKeyResolutionSuccessCount},`);
  lines.push(`    directLineKeyResolutionAbsentCount: ${h.directLineKeyResolutionAbsentCount},`);
  lines.push(`    directLineKeyResolutionAmbiguityCount: ${h.directLineKeyResolutionAmbiguityCount},`);
  lines.push(``);
  lines.push(`    historicalSegmentOccurrenceCount: ${h.historicalSegmentOccurrenceCount},`);
  lines.push(`    historicalDistinctSegmentKeyCount: ${h.historicalDistinctSegmentKeyCount},`);
  lines.push(``);
  lines.push(`    directSegmentKeyResolutionApplicability: ${tsStringLiteral(h.directSegmentKeyResolutionApplicability)},`);
  lines.push(`    directSegmentKeyResolutionAttemptCount: ${h.directSegmentKeyResolutionAttemptCount},`);
  lines.push(`    directSegmentKeyResolutionSuccessCount: ${h.directSegmentKeyResolutionSuccessCount},`);
  lines.push(`    directSegmentKeyResolutionFailureCount: ${h.directSegmentKeyResolutionFailureCount},`);
  lines.push(`    directSegmentKeyResolutionBlockedCount: ${h.directSegmentKeyResolutionBlockedCount},`);
  lines.push(``);
  lines.push(`    individualBoundingBoxComparisonApplicability: ${tsStringLiteral(h.individualBoundingBoxComparisonApplicability)},`);
  lines.push(`    individualBoundingBoxComparisonAttemptCount: ${h.individualBoundingBoxComparisonAttemptCount},`);
  lines.push(`    individualBoundingBoxMismatchCount: ${h.individualBoundingBoxMismatchCount === null ? "null" : h.individualBoundingBoxMismatchCount},`);
  lines.push(``);
  lines.push(`    publishedCellReferencedSegmentKeyCount: ${h.publishedCellReferencedSegmentKeyCount},`);
  lines.push(``);
  lines.push(`    historicalDirectRegistrySha256: ${tsStringLiteral(h.historicalDirectRegistrySha256)},`);
  lines.push(`    currentStructuralBridgeRegistrySha256: ${tsStringLiteral(h.currentStructuralBridgeRegistrySha256)},`);
  lines.push(`    publishedRegistrySha256: ${tsStringLiteral(h.publishedRegistrySha256)},`);
  lines.push(`  },`);
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
