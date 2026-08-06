/**
 * Testes sintéticos do fechamento consolidado (Sprint 21.4B.3A.3, §9) —
 * executados ANTES de qualquer processamento das saídas reais. Cobrem
 * os módulos puros do executor/orquestrador v2: parser de argumentos,
 * validação das 12 entradas, comparação semântica A×B, decisão de
 * publicação, derivação de conteúdo externo, geração da comparação
 * v1×v2, e os dois padrões de cálculo do §4.2/§4.3 (estrutura tabular
 * preservada; contagem total vs. crítica separada).
 *
 * Nenhum teste aqui importa `run-local-reader-evaluation-v2.ts` nem
 * `orchestrate-corrected-evaluation-v2.ts` diretamente — ambos chamam
 * `main()` incondicionalmente ao carregar o módulo (mesma convenção do
 * executor v1, nunca testado por importação direta), o que tentaria ler
 * saídas brutas reais ou exigir `--output-dir`/`--final-output-dir`
 * fora de um teste. Em vez disso, os módulos que ELES importam
 * (extraídos como funções puras) são testados isoladamente, e os
 * padrões de cálculo (§4.2/§4.3) são testados diretamente contra as
 * funções v1 reais que o executor reutiliza — nunca contra dados reais.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseOutputDirArg } from "./parse-output-dir-arg-v2";
import { validateRawAcquisitionInputs } from "./validate-raw-inputs-v2";
import { compareCanonicalRunDirectories } from "./compare-canonical-runs-v2";
import { decidePublicationV2 } from "./decide-publication-v2";
import { buildComparisonRowsV1V2 } from "./generate-comparison-v1-v2";
import { deriveExternalContentV2 } from "./derive-external-content-v2";
import { parseFinalOutputDirArg } from "./parse-final-output-dir-arg-v2";

import { associateObservedCellsToReference } from "../discovery-local-reader-comparison";
import { computeLocalReaderCriticalFieldMetric, computeLocalReaderTableStructureMetrics } from "../discovery-local-reader-metrics";
import type { LocalReaderCellComparisonResult, LocalReaderConvertedBoundingBox, LocalReaderExpectedCellRef, LocalReaderObservedCellRef } from "../discovery-local-reader-evaluation.types";
import type { LocalReaderRegionComponentResultV2 } from "../v2/discovery-local-reader-evaluation-v2.types";
import type { ReferenceTruthPhysicalRegion } from "../../reference-truth/discovery-reference-truth.types";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertThrowsWithMessage(fn: () => void, expectedSubstring: string, context: string): void {
  try {
    fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(msg.includes(expectedSubstring), `${context}: mensagem deveria conter "${expectedSubstring}", recebeu "${msg}"`);
    return;
  }
  throw new Error(`${context}: deveria ter lançado`);
}

const box = (leftPoints: number, topPoints: number, rightPoints: number, bottomPoints: number): LocalReaderConvertedBoundingBox => ({ leftPoints, topPoints, rightPoints, bottomPoints });

// ============================================================================
// §9 — parser de argumentos
// ============================================================================

runTest("parseOutputDirArg: ausência de --output-dir lança antes de qualquer leitura", () => {
  assertThrowsWithMessage(() => parseOutputDirArg([]), "--output-dir", "sem --output-dir");
  assertThrowsWithMessage(() => parseOutputDirArg(["--other-flag", "x"]), "--output-dir", "flag não relacionada");
});

runTest("parseOutputDirArg: --output-dir sem valor, ou com valor parecendo outra flag, lança", () => {
  assertThrowsWithMessage(() => parseOutputDirArg(["--output-dir"]), "--output-dir", "sem valor no final");
  assertThrowsWithMessage(() => parseOutputDirArg(["--output-dir", "--another-flag"]), "não vazio", "valor parece outra flag");
});

runTest("parseOutputDirArg: valor válido é retornado", () => {
  assertEqual(parseOutputDirArg(["--output-dir", "/tmp/some-dir"]), "/tmp/some-dir");
  assertEqual(parseOutputDirArg(["--foo", "1", "--output-dir", "C:/out"]), "C:/out");
});

runTest("parseFinalOutputDirArg (orquestrador): mesma disciplina — ausência lança antes de qualquer leitura", () => {
  assertThrowsWithMessage(() => parseFinalOutputDirArg([]), "--final-output-dir", "sem --final-output-dir");
  assertEqual(parseFinalOutputDirArg(["--final-output-dir", "/tmp/final"]), "/tmp/final");
});

// ============================================================================
// §9 — validação das 12 entradas brutas (fixtures sintéticas em diretório
// temporário — nunca toca private/local-reader-acquisition real)
// ============================================================================

function makeSyntheticAcquisitionDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "raw-input-validation-fixture-"));
  mkdirSync(join(dir, "docling"), { recursive: true });
  mkdirSync(join(dir, "paddleocr"), { recursive: true });
  return dir;
}

interface SyntheticEntrySpec {
  readonly tool: "docling" | "paddleocr";
  readonly page: number;
  readonly run: number;
  readonly rawContent?: string;
  readonly toolVersion?: string;
  readonly finalState?: string;
  readonly skipRaw?: boolean;
  readonly skipMeta?: boolean;
}

function writeSyntheticEntries(dir: string, entries: ReadonlyArray<SyntheticEntrySpec>): ReadonlyArray<Record<string, unknown>> {
  const manifest: Record<string, unknown>[] = [];
  entries.forEach((e) => {
    const rawContent = e.rawContent ?? `{"page":${e.page},"run":${e.run},"tool":"${e.tool}"}`;
    const rawPath = join(dir, e.tool, `${e.tool}_page${e.page}_run${e.run}.raw.json`);
    const metaPath = join(dir, e.tool, `${e.tool}_page${e.page}_run${e.run}.meta.json`);
    const sha256 = createHash("sha256").update(Buffer.from(rawContent, "utf8")).digest("hex");

    if (!e.skipRaw) writeFileSync(rawPath, rawContent, "utf8");
    const meta = {
      toolVersion: e.toolVersion ?? (e.tool === "docling" ? "2.114.0" : "3.7.0"),
      configurationSummaryPt: "fixture sintética",
      finalState: e.finalState ?? "completed",
      rawOutputSha256: sha256,
      rawOutputPresent: true,
      errors: [],
      warnings: [],
    };
    if (!e.skipMeta) writeFileSync(metaPath, JSON.stringify(meta), "utf8");

    manifest.push({ tool: e.tool, realPageNumber: e.page, runIndex: e.run, toolVersion: meta.toolVersion, rawOutputSha256: sha256 });
  });
  return manifest;
}

function allTwelveSpecs(overrides: Partial<Record<string, Partial<SyntheticEntrySpec>>> = {}): SyntheticEntrySpec[] {
  const specs: SyntheticEntrySpec[] = [];
  (["docling", "paddleocr"] as const).forEach((tool) => {
    [46, 50, 54].forEach((page) => {
      [1, 2].forEach((run) => {
        const key = `${tool}_${page}_${run}`;
        specs.push({ tool, page, run, ...(overrides[key] ?? {}) });
      });
    });
  });
  return specs;
}

runTest("validateRawAcquisitionInputs: 12 entradas válidas → overallValid true", () => {
  const dir = makeSyntheticAcquisitionDir();
  try {
    const manifest = writeSyntheticEntries(dir, allTwelveSpecs());
    const result = validateRawAcquisitionInputs(dir, manifest);
    assertEqual(result.entries.length, 12);
    assertEqual(result.overallValid, true, JSON.stringify(result.entries.filter((e) => !e.present || !e.hashMatch || !e.toolVersionMatch || !e.finalStateOk)));
    assertEqual(result.unexpectedFiles.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

runTest("validateRawAcquisitionInputs: arquivo ausente → overallValid false", () => {
  const dir = makeSyntheticAcquisitionDir();
  try {
    const manifest = writeSyntheticEntries(dir, allTwelveSpecs({ docling_46_1: { skipRaw: true } }));
    const result = validateRawAcquisitionInputs(dir, manifest);
    assertEqual(result.overallValid, false);
    const entry = result.entries.find((e) => e.tool === "docling" && e.realPageNumber === 46 && e.runIndex === 1)!;
    assertEqual(entry.present, false);
    assert(entry.issues.some((i) => i.includes("missing")), "deveria registrar issue de arquivo ausente");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

runTest("validateRawAcquisitionInputs: hash divergente → overallValid false", () => {
  const dir = makeSyntheticAcquisitionDir();
  try {
    const manifest = writeSyntheticEntries(dir, allTwelveSpecs());
    // Corrompe o conteúdo bruto DEPOIS do manifesto já ter sido gerado a partir do conteúdo original.
    writeFileSync(join(dir, "docling", "docling_page46_run1.raw.json"), '{"corrupted":true}', "utf8");
    const result = validateRawAcquisitionInputs(dir, manifest);
    assertEqual(result.overallValid, false);
    const entry = result.entries.find((e) => e.tool === "docling" && e.realPageNumber === 46 && e.runIndex === 1)!;
    assertEqual(entry.hashMatch, false);
    assert(entry.issues.some((i) => i.includes("hash mismatch")), "deveria registrar issue de hash divergente");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

runTest("validateRawAcquisitionInputs: metadado divergente (toolVersion e finalState) → overallValid false", () => {
  const dir = makeSyntheticAcquisitionDir();
  try {
    const manifest = writeSyntheticEntries(dir, allTwelveSpecs({ paddleocr_50_2: { finalState: "failed" } }));
    // toolVersion divergente: sobrescreve o meta.json com uma versão diferente da registrada no manifesto.
    const metaPath = join(dir, "paddleocr", "paddleocr_page50_run2.meta.json");
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    writeFileSync(metaPath, JSON.stringify({ ...meta, toolVersion: "9.9.9" }), "utf8");

    const result = validateRawAcquisitionInputs(dir, manifest);
    assertEqual(result.overallValid, false);
    const entry = result.entries.find((e) => e.tool === "paddleocr" && e.realPageNumber === 50 && e.runIndex === 2)!;
    assertEqual(entry.toolVersionMatch, false);
    assertEqual(entry.finalStateOk, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

runTest("validateRawAcquisitionInputs: arquivo inesperado no diretório → overallValid false, listado em unexpectedFiles", () => {
  const dir = makeSyntheticAcquisitionDir();
  try {
    const manifest = writeSyntheticEntries(dir, allTwelveSpecs());
    writeFileSync(join(dir, "docling", "docling_page99_run1.raw.json"), "{}", "utf8");
    const result = validateRawAcquisitionInputs(dir, manifest);
    assertEqual(result.overallValid, false);
    assert(result.unexpectedFiles.includes("docling/docling_page99_run1.raw.json"), "arquivo inesperado deveria ser listado");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ============================================================================
// §9 — comparação semântica A×B
// ============================================================================

function makeRunDir(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "run-fixture-"));
  Object.entries(files).forEach(([name, content]) => writeFileSync(join(dir, name), JSON.stringify(content), "utf8"));
  return dir;
}

runTest("compareCanonicalRunDirectories: execuções idênticas → identical true", () => {
  const dirA = makeRunDir({ "x.json": { a: 1, b: 2 } });
  const dirB = makeRunDir({ "x.json": { a: 1, b: 2 } });
  try {
    const result = compareCanonicalRunDirectories(dirA, dirB);
    assertEqual(result.identical, true);
  } finally {
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  }
});

runTest("compareCanonicalRunDirectories: diferença apenas na ordem de chaves NÃO conta como divergência", () => {
  const dirA = makeRunDir({ "x.json": { a: 1, b: 2 } });
  const dirB = mkdtempSync(join(tmpdir(), "run-fixture-"));
  writeFileSync(join(dirB, "x.json"), '{"b":2,"a":1}', "utf8"); // mesmas chaves, ordem diferente
  try {
    const result = compareCanonicalRunDirectories(dirA, dirB);
    assertEqual(result.identical, true, "ordem de chaves não deveria contar como divergência");
  } finally {
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  }
});

runTest("compareCanonicalRunDirectories: diferença de valor conta como divergência", () => {
  const dirA = makeRunDir({ "x.json": { a: 1 } });
  const dirB = makeRunDir({ "x.json": { a: 2 } });
  try {
    const result = compareCanonicalRunDirectories(dirA, dirB);
    assertEqual(result.identical, false);
  } finally {
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  }
});

runTest("compareCanonicalRunDirectories: classificação divergente conta como divergência", () => {
  const dirA = makeRunDir({ "viability.json": { classification: "candidato_principal" } });
  const dirB = makeRunDir({ "viability.json": { classification: "nao_viavel_nesta_configuracao" } });
  try {
    const result = compareCanonicalRunDirectories(dirA, dirB);
    assertEqual(result.identical, false);
  } finally {
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  }
});

runTest("compareCanonicalRunDirectories: arquivo ausente em B conta como divergência", () => {
  const dirA = makeRunDir({ "x.json": { a: 1 }, "y.json": { a: 2 } });
  const dirB = makeRunDir({ "x.json": { a: 1 } });
  try {
    const result = compareCanonicalRunDirectories(dirA, dirB);
    assertEqual(result.identical, false);
    const yFile = result.files.find((f) => f.file === "y.json")!;
    assertEqual(yFile.presentInB, false);
  } finally {
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  }
});

runTest("compareCanonicalRunDirectories: arquivo adicional em B conta como divergência", () => {
  const dirA = makeRunDir({ "x.json": { a: 1 } });
  const dirB = makeRunDir({ "x.json": { a: 1 }, "extra.json": { z: 9 } });
  try {
    const result = compareCanonicalRunDirectories(dirA, dirB);
    assertEqual(result.identical, false);
    const extraFile = result.files.find((f) => f.file === "extra.json")!;
    assertEqual(extraFile.presentInA, false);
  } finally {
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  }
});

// ============================================================================
// §9 — decisão de publicação: só publica com validação E repetição OK
// ============================================================================

const VALID_RAW: ReturnType<typeof validateRawAcquisitionInputs> = { expectedCount: 12, entries: [], unexpectedFiles: [], overallValid: true };
const INVALID_RAW: ReturnType<typeof validateRawAcquisitionInputs> = { expectedCount: 12, entries: [], unexpectedFiles: ["x"], overallValid: false };
const IDENTICAL_REPETITION: ReturnType<typeof compareCanonicalRunDirectories> = { files: [{ file: "x.json", presentInA: true, presentInB: true, semanticallyEqual: true, differenceSummary: null }], identical: true };
const DIVERGENT_REPETITION: ReturnType<typeof compareCanonicalRunDirectories> = { files: [{ file: "x.json", presentInA: true, presentInB: true, semanticallyEqual: false, differenceSummary: "diff" }], identical: false };

runTest("decidePublicationV2: ausência de publicação quando a validação das 12 entradas falha", () => {
  const decision = decidePublicationV2(INVALID_RAW, IDENTICAL_REPETITION);
  assertEqual(decision.shouldPublish, false);
});

runTest("decidePublicationV2: ausência de publicação quando A×B diverge, mesmo com entradas válidas", () => {
  const decision = decidePublicationV2(VALID_RAW, DIVERGENT_REPETITION);
  assertEqual(decision.shouldPublish, false);
});

runTest("decidePublicationV2: publicação somente quando ambas as checagens passam", () => {
  const decision = decidePublicationV2(VALID_RAW, IDENTICAL_REPETITION);
  assertEqual(decision.shouldPublish, true);
});

// ============================================================================
// §9 — conteúdo externo (§4.1): muda conforme a entrada, nunca hardcoded
// ============================================================================

function syntheticTcuRegion(): ReferenceTruthPhysicalRegion {
  return {
    id: "reg-tcu-fixture",
    realPageNumber: 46,
    verticalOrder: 4,
    boundingBox: box(0, 60, 100, 80),
    observedText: "Nota externa TCU sintética",
    lineKey: null,
    segmentKeys: [],
    classification: "nota_externa",
    classificationBasisPt: "fixture sintética",
    classificationProvenancePt: "fixture sintética",
  };
}

runTest("deriveExternalContentV2: sem região TCU → null", () => {
  const result = deriveExternalContentV2(undefined, [], new Map(), [], new Map(), new Map());
  assertEqual(result, null);
});

runTest("deriveExternalContentV2: componente omitido (0 observado) → omitted", () => {
  const tcu = syntheticTcuRegion();
  const components: LocalReaderRegionComponentResultV2[] = [{ id: "c1", referenceRegionIds: [tcu.id], observedRegionIds: [], outcome: "expected_region_omitted" }];
  const result = deriveExternalContentV2(tcu, components, new Map(), [], new Map(), new Map());
  assertEqual(result?.outcome, "omitted");
  assertEqual(result?.isCriticalRisk, false);
});

runTest("deriveExternalContentV2: detectado mas sem incorporação em célula → detected_as_external_or_out_of_table", () => {
  const tcu = syntheticTcuRegion();
  const components: LocalReaderRegionComponentResultV2[] = [{ id: "c1", referenceRegionIds: [tcu.id], observedRegionIds: ["obs-tcu"], outcome: "spatial_and_textual_match" }];
  const observedTextById = new Map([["obs-tcu", "Nota externa TCU sintética"]]);
  const result = deriveExternalContentV2(tcu, components, observedTextById, [], new Map(), new Map());
  assertEqual(result?.outcome, "detected_as_external_or_out_of_table");
  assertEqual(result?.isCriticalRisk, false);
});

runTest("deriveExternalContentV2: incorporação real em célula de descrição → incorporated_into_item_description (isCriticalRisk true)", () => {
  const tcu = syntheticTcuRegion();
  const components: LocalReaderRegionComponentResultV2[] = [{ id: "c1", referenceRegionIds: [tcu.id], observedRegionIds: ["obs-tcu"], outcome: "spatial_and_textual_match" }];
  const observedTextById = new Map([["obs-tcu", "Nota externa TCU sintética"]]);
  const cellComparisons: LocalReaderCellComparisonResult[] = [
    { id: "cmp1", referenceCellIds: ["cell-desc-1"], observedCellIds: ["obs-cell-1"], outcome: "direct_match", normalizedExpectedText: "x", normalizedObservedText: "Nota externa TCU sintética", textualDistance: 0, associationBasisPt: "fixture" },
  ];
  const expectedCellColumnById = new Map([["cell-desc-1", "col-descricao"]]);
  const columnRoleByColumnId = new Map<string, "descricao">([["col-descricao", "descricao"]]);
  const result = deriveExternalContentV2(tcu, components, observedTextById, cellComparisons, expectedCellColumnById, columnRoleByColumnId);
  assertEqual(result?.outcome, "incorporated_into_item_description");
  assertEqual(result?.isCriticalRisk, true);
});

runTest("deriveExternalContentV2: incorporação real em célula não-descrição → incorporated_into_table (isCriticalRisk true)", () => {
  const tcu = syntheticTcuRegion();
  const components: LocalReaderRegionComponentResultV2[] = [{ id: "c1", referenceRegionIds: [tcu.id], observedRegionIds: ["obs-tcu"], outcome: "spatial_and_textual_match" }];
  const observedTextById = new Map([["obs-tcu", "Nota externa TCU sintética"]]);
  const cellComparisons: LocalReaderCellComparisonResult[] = [
    { id: "cmp1", referenceCellIds: ["cell-qty-1"], observedCellIds: ["obs-cell-1"], outcome: "direct_match", normalizedExpectedText: "x", normalizedObservedText: "Nota externa TCU sintética", textualDistance: 0, associationBasisPt: "fixture" },
  ];
  const expectedCellColumnById = new Map([["cell-qty-1", "col-quantidade"]]);
  const columnRoleByColumnId = new Map<string, "quantidade">([["col-quantidade", "quantidade"]]);
  const result = deriveExternalContentV2(tcu, components, observedTextById, cellComparisons, expectedCellColumnById, columnRoleByColumnId);
  assertEqual(result?.outcome, "incorporated_into_table");
  assertEqual(result?.isCriticalRisk, true);
});

// ============================================================================
// §9 — §4.2: estrutura tabular preservada (computeLocalReaderTableStructureMetrics, v1, reusada)
// ============================================================================

runTest("padrão §4.2 — computeLocalReaderTableStructureMetrics (v1, reusada pelo executor v2) produz estrutura por página com todos os campos esperados", () => {
  const expected: LocalReaderExpectedCellRef = { id: "cell-ts-1", realPageNumber: 999, columnId: "col-quantidade", normalizedText: "10,00", boundingBox: box(0, 0, 50, 20) };
  const observed: LocalReaderObservedCellRef = { id: "obs-ts-1", realPageNumber: 999, columnId: null, normalizedText: "10,00", boundingBox: box(0, 0, 50, 20) };
  const comparisons = associateObservedCellsToReference([expected], [observed]);
  const structure = computeLocalReaderTableStructureMetrics([expected], comparisons, 1, 1);

  assertEqual(structure.tablesDetected, 1);
  assertEqual(structure.rowsDetected, 1);
  assertEqual(structure.cellsTotal, 1);
  assertEqual(structure.cellOutcomeCounts.direct_match, 1);
  assert(typeof structure.expectedColumnsRecovered === "number", "expectedColumnsRecovered deveria existir");
  assert(typeof structure.expectedColumnsTotal === "number", "expectedColumnsTotal deveria existir");
  assert(typeof structure.columnsSplit === "number", "columnsSplit deveria existir");
  assert(typeof structure.columnsMerged === "number", "columnsMerged deveria existir");
});

// ============================================================================
// §9 — §4.3: contagem total (todas as células) vs. crítica (só papéis críticos) separadas
// ============================================================================

runTest("padrão §4.3 — directMatchCellsTotal (todas as células) vs. criticalFieldLiteralMatchesTotal (só papel crítico): 1 crítica + 1 não crítica → 2 vs 1", () => {
  const criticalExpected: LocalReaderExpectedCellRef = { id: "cell-critical", realPageNumber: 999, columnId: "col-quantidade", normalizedText: "10,00", boundingBox: box(0, 0, 50, 20) };
  const criticalObserved: LocalReaderObservedCellRef = { id: "obs-critical", realPageNumber: 999, columnId: null, normalizedText: "10,00", boundingBox: box(0, 0, 50, 20) };
  const nonCriticalExpected: LocalReaderExpectedCellRef = { id: "cell-noncritical", realPageNumber: 999, columnId: "col-fgv", normalizedText: "N/A", boundingBox: box(0, 30, 50, 50) };
  const nonCriticalObserved: LocalReaderObservedCellRef = { id: "obs-noncritical", realPageNumber: 999, columnId: null, normalizedText: "N/A", boundingBox: box(0, 30, 50, 50) };

  const allComparisons = associateObservedCellsToReference([criticalExpected, nonCriticalExpected], [criticalObserved, nonCriticalObserved]);
  assertEqual(allComparisons.length, 2);
  assertEqual(allComparisons.every((c) => c.outcome === "direct_match"), true, "pré-condição: ambas deveriam ser direct_match");

  // directMatchCellsTotal: TODAS as células (§4.3) — nunca restrito a papéis críticos.
  const directMatchCellsTotal = allComparisons.filter((c) => c.outcome === "direct_match").length;
  assertEqual(directMatchCellsTotal, 2);

  // criticalFieldLiteralMatchesTotal: apenas o papel crítico "quantidade" (col-quantidade).
  const criticalCellIds = new Set([criticalExpected.id]);
  const criticalOutcomes = allComparisons
    .filter((cmp) => cmp.referenceCellIds.some((id) => criticalCellIds.has(id)))
    .map((cmp) => ({ literalMatch: cmp.outcome === "direct_match", exactDecimalValueMatch: cmp.outcome === "direct_match" ? true : null }));
  const criticalMetric = computeLocalReaderCriticalFieldMetric("quantidade", criticalCellIds.size, criticalOutcomes);
  const criticalFieldLiteralMatchesTotal = criticalMetric.literalMatches;
  assertEqual(criticalFieldLiteralMatchesTotal, 1);

  assert(directMatchCellsTotal !== criticalFieldLiteralMatchesTotal, "as duas contagens devem permanecer distintas quando há células não críticas com direct_match");
});

// ============================================================================
// §9 — comparação v1×v2: sem números reais hardcoded, categorias corretas
// ============================================================================

runTest("buildComparisonRowsV1V2: métrica fora do escopo, sem mudança → unchanged (valores vêm da fixture, nunca hardcoded)", () => {
  const v1 = { execution: { pagesCompleted: 3, pagesFailed: 0 } };
  const v2 = { execution: { pagesCompleted: 3, pagesFailed: 0 } };
  const rows = buildComparisonRowsV1V2("fixture-tool", v1, v2);
  const row = rows.find((r) => r.metric === "execution.pagesCompleted")!;
  assertEqual(row.v1Value, 3);
  assertEqual(row.v2Value, 3);
  assertEqual(row.changeType, "unchanged");
  assertEqual(row.interpretationCategory, "unchanged");
});

runTest("buildComparisonRowsV1V2: métrica corrigida (mathEvidenceCounts) que de fato mudou → corrected_misleading_v1_metric", () => {
  const v1 = { mathEvidenceCounts: { evidencia_completa: 0, evidencia_parcial: 0, evidencia_ausente: 84, evidencia_divergente_da_fonte: 0 } };
  const v2 = { mathEvidenceCounts: { evidencia_completa: 5, evidencia_parcial: 3, evidencia_ausente: 76, evidencia_divergente_da_fonte: 0 } };
  const rows = buildComparisonRowsV1V2("fixture-tool", v1, v2);
  const row = rows.find((r) => r.metric === "mathEvidenceCounts")!;
  assertEqual(row.changeType, "changed");
  assertEqual(row.interpretationCategory, "corrected_misleading_v1_metric");
});

runTest("buildComparisonRowsV1V2: métrica corrigida (mathEvidenceCounts) que NÃO mudou de valor → same_conclusion_now_derived", () => {
  const same = { evidencia_completa: 0, evidencia_parcial: 0, evidencia_ausente: 84, evidencia_divergente_da_fonte: 0 };
  const v1 = { mathEvidenceCounts: same };
  const v2 = { mathEvidenceCounts: { ...same } };
  const rows = buildComparisonRowsV1V2("fixture-tool", v1, v2);
  const row = rows.find((r) => r.metric === "mathEvidenceCounts")!;
  assertEqual(row.changeType, "unchanged");
  assertEqual(row.interpretationCategory, "same_conclusion_now_derived");
});

runTest("buildComparisonRowsV1V2: métrica presente apenas em v2 (detalhe novo de auditoria) → new_v2_audit_detail", () => {
  const v1 = {};
  const v2 = { regionTextByPage: { "46": { expectedRegionsWithExactTextualMatch: 7 } } };
  const rows = buildComparisonRowsV1V2("fixture-tool", v1, v2);
  const row = rows.find((r) => r.metric === "regions.page46.expectedRegionsWithExactTextualMatch")!;
  assertEqual(row.v1Value, undefined);
  assertEqual(row.v2Value, 7);
  assertEqual(row.changeType, "missing_in_v1");
  assertEqual(row.interpretationCategory, "new_v2_audit_detail");
});
