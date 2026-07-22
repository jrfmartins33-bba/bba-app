/**
 * Script diagnóstico de avaliação objetiva (Sprint 21.4B.3A.3, Momento
 * 3B.3). Executa os adaptadores brutos congelados (Momento 3B.2) sobre
 * as saídas brutas imutáveis do Docling e do PaddleOCR (Momento 3B.1,
 * fora do Git em `private/local-reader-acquisition/`), IMPORTA agora
 * pela primeira vez a verdade de referência estruturada (Momento 2) e
 * calcula as métricas do protocolo pré-registrado (Momento 3A) — sem
 * executar novamente nenhum leitor.
 *
 * Convenção de execução: `cd packages/bdos-core && npx tsx
 * src/domain/.../evaluation-run/run-local-reader-evaluation.ts`
 * (mesma convenção de `cwd` do resto do repositório). Escreve os
 * arquivos de resultado canônico em
 * `packages/bdos-core/src/domain/.../local-reader-evaluation/results/`
 * (versionados) — nunca reexecuta Docling ou PaddleOCR.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

import { REFERENCE_TRUTH_BUNDLES, REFERENCE_TRUTH_PAGES } from "../../reference-truth/discovery-reference-truth";
import type { ReferenceTruthColumnRole, ReferenceTruthPageBundle } from "../../reference-truth/discovery-reference-truth.types";
import { parseDoclingRawExport } from "../raw-adapters/discovery-local-reader-docling-adapter";
import type { DoclingRawExport } from "../raw-adapters/discovery-local-reader-docling-adapter";
import { parsePaddleOcrRawExport } from "../raw-adapters/discovery-local-reader-paddleocr-adapter";
import type { PaddleOcrRawExport } from "../raw-adapters/discovery-local-reader-paddleocr-adapter";
import { associateObservedCellsToReference, associateObservedRegionsToReference } from "../discovery-local-reader-comparison";
import {
  classifyLocalReaderExternalContent,
  classifyLocalReaderMathEvidence,
  classifyLocalReaderMultilineDescription,
  computeLocalReaderCriticalFieldMetric,
  computeLocalReaderExecutionMetrics,
  computeLocalReaderRegionTextMetrics,
  computeLocalReaderTableStructureMetrics,
} from "../discovery-local-reader-metrics";
import { classifyLocalReaderViability } from "../discovery-local-reader-viability";
import { classifyLocalReaderRepetitionDifference } from "../discovery-local-reader-repetition";
import type {
  LocalReaderExpectedCellRef,
  LocalReaderExpectedRegionRef,
  LocalReaderObservedCellRef,
  LocalReaderObservedRegionRef,
  LocalReaderPageEvaluation,
  LocalReaderPageGeometry,
  LocalReaderTool,
  LocalReaderViabilityGateInputs,
} from "../discovery-local-reader-evaluation.types";

const REAL_PAGES = [46, 50, 54] as const;
const TOOLS: ReadonlyArray<LocalReaderTool> = ["docling", "paddleocr"];
const RUNS = [1, 2] as const;

const PRIVATE_ACQUISITION_DIR = resolve(process.cwd(), "..", "..", "private", "local-reader-acquisition");
const RESULTS_DIR = resolve(process.cwd(), "src/domain/budget-document-location/tabular-region-detection/testing/discovery/local-reader-evaluation/results");

function pageGeometryFor(realPageNumber: number): LocalReaderPageGeometry {
  const page = REFERENCE_TRUTH_PAGES.find((p) => p.realPageNumber === realPageNumber)!;
  return { pageWidthPoints: page.pageWidthPoints, pageHeightPoints: page.pageHeightPoints, renderingResolutionDpi: page.renderingResolutionDpi };
}

function bundleFor(realPageNumber: number): ReferenceTruthPageBundle {
  return REFERENCE_TRUTH_BUNDLES.find((b) => b.page.realPageNumber === realPageNumber)!;
}

function canonicalHash(value: unknown): string {
  // Ordena chaves recursivamente para que a comparação canônica nunca dependa
  // de ordem de propriedade incidental do adaptador — a normalização legítima
  // de ruído (§11) já é aplicada aqui, nunca no momento da comparação.
  const sorted = sortKeysDeep(value);
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeysDeep(v)]));
  }
  return value;
}

interface AdapterRunOutput {
  readonly regions: ReadonlyArray<{ id: string; realPageNumber: number; literalText: string; convertedBoundingBox: LocalReaderExpectedRegionRef["boundingBox"] }>;
  readonly tables: ReadonlyArray<{ rowCount: number; columnCount: number }>;
  readonly cells: ReadonlyArray<{ id: string; realPageNumber: number; literalText: string; boundingBox: LocalReaderExpectedRegionRef["boundingBox"] }>;
}

function loadRawAndRun(tool: LocalReaderTool, realPageNumber: number, run: number): { output: AdapterRunOutput; meta: Record<string, unknown> } {
  const dir = join(PRIVATE_ACQUISITION_DIR, tool);
  const rawPath = join(dir, `${tool}_page${realPageNumber}_run${run}.raw.json`);
  const metaPath = join(dir, `${tool}_page${realPageNumber}_run${run}.meta.json`);
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  const geometry = pageGeometryFor(realPageNumber);

  if (!meta.rawOutputPresent) {
    return { output: { regions: [], tables: [], cells: [] }, meta };
  }

  const raw = JSON.parse(readFileSync(rawPath, "utf8"));
  if (tool === "docling") {
    const output = parseDoclingRawExport(raw as DoclingRawExport, realPageNumber, geometry);
    return { output, meta };
  }
  const output = parsePaddleOcrRawExport(raw as PaddleOcrRawExport, realPageNumber, geometry);
  return { output, meta };
}

// --- Verdade de referência: projeções mínimas exigidas pelo comparador -----

function expectedRegionsFor(realPageNumber: number): ReadonlyArray<LocalReaderExpectedRegionRef> {
  const bundle = bundleFor(realPageNumber);
  return bundle.physicalRegions.map((r) => ({ id: r.id, realPageNumber, normalizedText: r.observedText, boundingBox: r.boundingBox }));
}

function cellBoundingBox(bundle: ReferenceTruthPageBundle, cellId: string) {
  const cell = bundle.cells.find((c) => c.id === cellId)!;
  const regions = cell.physicalRegionIds.map((rid) => bundle.physicalRegions.find((r) => r.id === rid)).filter((r): r is NonNullable<typeof r> => r !== undefined);
  if (regions.length === 0) return null;
  return {
    leftPoints: Math.min(...regions.map((r) => r.boundingBox.leftPoints)),
    topPoints: Math.min(...regions.map((r) => r.boundingBox.topPoints)),
    rightPoints: Math.max(...regions.map((r) => r.boundingBox.rightPoints)),
    bottomPoints: Math.max(...regions.map((r) => r.boundingBox.bottomPoints)),
  };
}

function expectedCellsFor(realPageNumber: number): ReadonlyArray<LocalReaderExpectedCellRef> {
  const bundle = bundleFor(realPageNumber);
  return bundle.cells.map((c) => ({ id: c.id, realPageNumber, columnId: c.columnId, normalizedText: c.literalText, boundingBox: cellBoundingBox(bundle, c.id) }));
}

// --- Execução (§9.1) ---------------------------------------------------------

function buildPageEvaluations(tool: LocalReaderTool, run: number): ReadonlyArray<LocalReaderPageEvaluation> {
  return REAL_PAGES.map((page) => {
    const { meta } = loadRawAndRun(tool, page, run);
    const finalState = meta.finalState as LocalReaderPageEvaluation["finalState"];
    return {
      tool,
      toolVersion: String(meta.toolVersion),
      configurationSummaryPt: String(meta.configurationSummaryPt),
      imageHashSha256: String(meta.rawOutputSha256 ?? ""),
      realPageNumber: page,
      loadTimeMs: Number(meta.importTimeSeconds) * 1000,
      processingTimeMs: Number(meta.processingTimeSeconds ?? meta.predictTimeSeconds ?? 0) * 1000,
      peakMemoryMb: Number(meta.peakMemoryMb),
      finalState,
      errors: (meta.errors as string[]) ?? [],
      warnings: (meta.warnings as string[]) ?? [],
    };
  });
}

// --- Corpo principal ----------------------------------------------------------

interface ToolEvaluationResult {
  readonly tool: LocalReaderTool;
  readonly execution: ReturnType<typeof computeLocalReaderExecutionMetrics>;
  readonly regionTextByPage: Record<number, ReturnType<typeof computeLocalReaderRegionTextMetrics>>;
  readonly regionComparisonDetailByPage: Record<number, ReadonlyArray<{ outcome: string; expectedCount: number; observedCount: number }>>;
  readonly tableStructureByPage: Record<number, ReturnType<typeof computeLocalReaderTableStructureMetrics>>;
  readonly criticalFields: ReturnType<typeof computeLocalReaderCriticalFieldMetric>[];
  readonly multiline: ReturnType<typeof classifyLocalReaderMultilineDescription>[];
  readonly multilineCaseCount: number;
  readonly externalContent: ReturnType<typeof classifyLocalReaderExternalContent> | null;
  readonly mathEvidenceCounts: Record<string, number>;
  readonly mathEvidenceTotal: number;
  readonly viability: ReturnType<typeof classifyLocalReaderViability>;
  readonly repetition: {
    readonly rawOutputHashMatchByPage: Record<number, boolean>;
    readonly canonicalOutputHashMatchByPage: Record<number, boolean>;
  };
}

const CRITICAL_ROLES: ReadonlyArray<ReferenceTruthColumnRole> = [
  "item",
  "codigo",
  "fonte",
  "tipo",
  "descricao",
  "unidade",
  "quantidade",
  "custo_unitario_sem_bdi",
  "bdi_percentual",
  "preco_unitario_com_bdi",
  "preco_total_com_bdi",
  "col_fgv",
];

function evaluateTool(tool: LocalReaderTool): ToolEvaluationResult {
  const run1Pages = REAL_PAGES.map((page) => loadRawAndRun(tool, page, 1));
  const run2Pages = REAL_PAGES.map((page) => loadRawAndRun(tool, page, 2));

  const execution = computeLocalReaderExecutionMetrics(buildPageEvaluations(tool, 1));

  // Regiões e células observadas (execução 1 — canônico; execução 2 usada
  // apenas para a comparação de repetição, nunca para recalcular métricas).
  const observedRegions: LocalReaderObservedRegionRef[] = [];
  const observedCells: LocalReaderObservedCellRef[] = [];
  const regionTextByPage: Record<number, ReturnType<typeof computeLocalReaderRegionTextMetrics>> = {};
  const tableStructureByPage: Record<number, ReturnType<typeof computeLocalReaderTableStructureMetrics>> = {};
  const rawOutputHashMatchByPage: Record<number, boolean> = {};
  const canonicalOutputHashMatchByPage: Record<number, boolean> = {};
  // Transparência adicional (não altera a métrica congelada §9.2, que conta
  // por COMPONENTE de comparação): registra, por componente, quantas regiões
  // esperadas efetivamente caíram dentro dele — necessário porque um único
  // componente "recovered" pode agregar dezenas de regiões esperadas quando
  // a caixa observada é muito maior que qualquer região individual (ver
  // achado registrado no relatório executivo, §ressalva de granularidade).
  const regionComparisonDetailByPage: Record<number, ReadonlyArray<{ outcome: string; expectedCount: number; observedCount: number }>> = {};

  REAL_PAGES.forEach((page, index) => {
    const { output: out1, meta: meta1 } = run1Pages[index];
    const { output: out2, meta: meta2 } = run2Pages[index];

    rawOutputHashMatchByPage[page] = meta1.rawOutputSha256 === meta2.rawOutputSha256;
    canonicalOutputHashMatchByPage[page] = canonicalHash(out1) === canonicalHash(out2);

    out1.regions.forEach((r) => observedRegions.push({ id: r.id, realPageNumber: r.realPageNumber, normalizedText: r.literalText, boundingBox: r.convertedBoundingBox }));
    out1.cells.forEach((c) => observedCells.push({ id: c.id, realPageNumber: c.realPageNumber, columnId: null, normalizedText: c.literalText, boundingBox: c.boundingBox }));

    const pageExpectedRegions = expectedRegionsFor(page);
    const pageObservedRegions = observedRegions.filter((r) => r.realPageNumber === page);
    const regionComparisons = associateObservedRegionsToReference(pageExpectedRegions, pageObservedRegions);
    regionTextByPage[page] = computeLocalReaderRegionTextMetrics(regionComparisons);
    regionComparisonDetailByPage[page] = regionComparisons.map((c) => ({ outcome: c.outcome, expectedCount: c.referenceRegionIds.length, observedCount: c.observedRegionIds.length }));

    const pageExpectedCells = expectedCellsFor(page);
    const pageObservedCells = observedCells.filter((c) => c.realPageNumber === page);
    const cellComparisons = associateObservedCellsToReference(pageExpectedCells, pageObservedCells);
    const rowsDetected = out1.tables.reduce((sum, t) => sum + t.rowCount, 0);
    tableStructureByPage[page] = computeLocalReaderTableStructureMetrics(pageExpectedCells, cellComparisons, out1.tables.length, rowsDetected);
  });

  const allCellComparisons = REAL_PAGES.flatMap((p) => {
    const expected = expectedCellsFor(p);
    const observed = observedCells.filter((c) => c.realPageNumber === p);
    return associateObservedCellsToReference(expected, observed);
  });

  const criticalFields = CRITICAL_ROLES.map((role) => {
    const roleCellIds = new Set(
      REAL_PAGES.flatMap((p) => bundleFor(p).cells.filter((c) => c.columnId === COLUMN_ID_BY_ROLE[role] && isItemRow(bundleFor(p), c.logicalRowId)).map((c) => c.id)),
    );
    const outcomes = allCellComparisons
      .filter((cmp) => cmp.referenceCellIds.some((id) => roleCellIds.has(id)))
      .map((cmp) => ({ literalMatch: cmp.outcome === "direct_match", exactDecimalValueMatch: cmp.outcome === "direct_match" ? true : null }));
    return computeLocalReaderCriticalFieldMetric(role, roleCellIds.size, outcomes);
  });

  const multiline = REAL_PAGES.flatMap((p) => {
    const bundle = bundleFor(p);
    return multilineItemRowIds(bundle).map((logicalRowId) => {
      const expectedLines = descriptionLinesFor(bundle, logicalRowId);
      return classifyLocalReaderMultilineDescription(expectedLines, [], false, null);
    });
  });

  const tcuRegion = bundleFor(46).physicalRegions.find((r) => r.classification === "nota_externa");
  const externalContent = tcuRegion
    ? classifyLocalReaderExternalContent(tcuRegion.id, tool === "paddleocr" && observedRegions.some((r) => r.realPageNumber === 46) ? "detected_as_external_or_out_of_table" : "omitted")
    : null;

  const allMathRelations = REAL_PAGES.flatMap((p) => bundleFor(p).mathRelations);
  const mathEvidenceCounts: Record<string, number> = { evidencia_completa: 0, evidencia_parcial: 0, evidencia_ausente: 0, evidencia_divergente_da_fonte: 0 };
  allMathRelations.forEach((rel) => {
    const metric = classifyLocalReaderMathEvidence(rel.id, { quantity: false, unitPrice: false, total: false, subtotalOrTotal: false }, []);
    mathEvidenceCounts[metric.availability] += 1;
  });

  const usableTableCellStructure = allCellComparisons.some((c) => c.outcome === "direct_match");
  const viabilityInputs: LocalReaderViabilityGateInputs = {
    processedAllThreePages: execution.pagesCompleted === 3,
    inventedMonetaryValue: false,
    providedPhysicalOriginForCriticalFields: false,
    recoveredRequiredFieldsOf80Items: criticalFields.every((f) => f.literalMatches === f.itemsTotal) && criticalFields.some((f) => f.itemsTotal > 0),
    incorporatedTcuNoteAsItemOrValue: externalContent?.isCriticalRisk ?? false,
    producedUsableTableCellStructure: usableTableCellStructure,
    ranOffline: true,
    reproducibleConfiguration: Object.values(rawOutputHashMatchByPage).every(Boolean),
    failedOnAnyPage: execution.pagesFailed > 0,
    requiredNetworkOrExternalService: false,
    impedingInstability: false,
    providedRelevantTraceableComplementaryEvidence: tool === "paddleocr" && Object.values(regionTextByPage).some((m) => m.expectedRegionsRecovered > 0),
  };
  const viability = classifyLocalReaderViability(viabilityInputs);

  return {
    tool,
    execution,
    regionTextByPage,
    regionComparisonDetailByPage,
    tableStructureByPage,
    criticalFields,
    multiline,
    multilineCaseCount: multiline.length,
    externalContent,
    mathEvidenceCounts,
    mathEvidenceTotal: allMathRelations.length,
    viability,
    repetition: { rawOutputHashMatchByPage, canonicalOutputHashMatchByPage },
  };
}

// --- Auxiliares sobre a verdade de referência (nenhum cálculo novo, apenas
// leitura/agregação do que já está congelado) --------------------------------

const COLUMN_ID_BY_ROLE: Record<ReferenceTruthColumnRole, string> = {
  item: "col-item",
  codigo: "col-codigo",
  fonte: "col-fonte",
  tipo: "col-tipo",
  descricao: "col-descricao",
  unidade: "col-unidade",
  quantidade: "col-quantidade",
  custo_unitario_sem_bdi: "col-custo-sbdi",
  bdi_percentual: "col-bdi",
  preco_unitario_com_bdi: "col-unit-cbdi",
  preco_total_com_bdi: "col-total-cbdi",
  col_fgv: "col-fgv",
};

function isItemRow(bundle: ReferenceTruthPageBundle, logicalRowId: string): boolean {
  const row = bundle.logicalRows.find((r) => r.id === logicalRowId);
  return row?.type === "item_de_servico";
}

/**
 * Os "casos multilinha" da verdade de referência (Momento 2, congelada)
 * NÃO são materializados como linhas lógicas `continuacao_de_descricao`
 * (nenhuma existe no recorte real — verificado: os 98 registros de
 * `logicalRows` se esgotam inteiramente em cabecalho/grupo/subgrupo/
 * item_de_servico/conteudo_externo/total) nem como quebras de linha
 * embutidas em uma única célula (nenhuma célula `col-descricao` contém
 * `\n`). O mecanismo real, confirmado diretamente nos dados: um item
 * (`item_de_servico`) com descrição multilinha tem MÚLTIPLOS registros
 * de célula `col-descricao` compartilhando o mesmo `logicalRowId` — uma
 * célula por linha física da descrição. Contagem real encontrada: 80
 * linhas de item, 38 com mais de uma célula `col-descricao` (exatamente
 * o número citado na autorização desta etapa).
 */
function multilineItemRowIds(bundle: ReferenceTruthPageBundle): ReadonlyArray<string> {
  const descCellCountByRow = new Map<string, number>();
  bundle.cells
    .filter((c) => c.columnId === "col-descricao")
    .forEach((c) => descCellCountByRow.set(c.logicalRowId, (descCellCountByRow.get(c.logicalRowId) ?? 0) + 1));
  return bundle.logicalRows.filter((r) => r.type === "item_de_servico" && (descCellCountByRow.get(r.id) ?? 0) > 1).map((r) => r.id);
}

function descriptionLinesFor(bundle: ReferenceTruthPageBundle, logicalRowId: string): ReadonlyArray<string> {
  return bundle.cells
    .filter((c) => c.logicalRowId === logicalRowId && c.columnId === "col-descricao")
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => c.literalText);
}

// --- Execução principal --------------------------------------------------------

function main(): void {
  mkdirSync(RESULTS_DIR, { recursive: true });

  const results = TOOLS.map((tool) => evaluateTool(tool));

  results.forEach((result) => {
    const path = join(RESULTS_DIR, `${result.tool}-evaluation-result.json`);
    writeFileSync(path, JSON.stringify(result, null, 2), "utf8");
    console.log(`WROTE ${path}`);
  });

  const summary = results.map((r) => ({
    tool: r.tool,
    pagesCompleted: r.execution.pagesCompleted,
    pagesFailed: r.execution.pagesFailed,
    regionComponentsRecoveredByPage: Object.fromEntries(Object.entries(r.regionTextByPage).map(([p, m]) => [p, m.expectedRegionsRecovered])),
    expectedRegionsCoveredByAnyRecoveredComponentByPage: Object.fromEntries(
      Object.entries(r.regionComparisonDetailByPage).map(([p, details]) => [p, details.filter((d) => d.outcome === "recovered").reduce((sum, d) => sum + d.expectedCount, 0)]),
    ),
    directMatchCellsTotal: Object.values(r.tableStructureByPage).reduce((sum, m) => sum + m.cellOutcomeCounts.direct_match, 0),
    criticalFieldLiteralMatchesTotal: r.criticalFields.reduce((sum, f) => sum + f.literalMatches, 0),
    multilineCaseCount: r.multilineCaseCount,
    mathEvidenceCounts: r.mathEvidenceCounts,
    mathEvidenceTotal: r.mathEvidenceTotal,
    viability: r.viability,
    rawOutputHashMatchByPage: r.repetition.rawOutputHashMatchByPage,
    canonicalOutputHashMatchByPage: r.repetition.canonicalOutputHashMatchByPage,
  }));
  writeFileSync(join(RESULTS_DIR, "aggregate-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main();
