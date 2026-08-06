/**
 * Executor v2 — resultados corrigidos (Sprint 21.4B.3A.3, fechamento
 * consolidado). Espelha a estrutura de `run-local-reader-evaluation.ts`
 * (v1, NUNCA alterado por este arquivo) para facilitar auditoria lado a
 * lado, mas usa exclusivamente as funções v2 congeladas para regiões
 * (Problema A/B), descrições multilinha (Problema C), evidência
 * matemática (Problema D), insumos de viabilidade (Problema E) e
 * conteúdo externo (§4.1 do fechamento).
 *
 * Reaproveita, sem alteração: os adaptadores brutos congelados
 * (`raw-adapters/`), as MESMAS saídas brutas imutáveis
 * (`private/local-reader-acquisition/`, fora do Git), a comparação de
 * células (`associateObservedCellsToReference`, v1), a métrica de
 * estrutura tabular (`computeLocalReaderTableStructureMetrics`, v1) e os
 * classificadores finais v1 (`classifyLocalReaderMultilineDescription`,
 * `classifyLocalReaderViability`, `classifyLocalReaderExternalContent`)
 * — apenas seus insumos deixam de ser constantes.
 *
 * Nunca reexecuta Docling ou PaddleOCR. Nenhum valor final hardcoded.
 * Nenhuma importação de `results/corrected-v2` previamente produzido.
 * Nenhuma condição específica de ferramenta/página além da configuração
 * já congelada (REAL_PAGES/TOOLS, idênticas ao v1). Nenhum código, valor
 * ou texto específico do documento fora da verdade de referência
 * (importada aqui, exclusivamente no executor de avaliação — nunca nas
 * funções v2 genéricas).
 *
 * Execução imutável (fechamento consolidado §4.4): `--output-dir` é
 * OBRIGATÓRIO — sem ele, falha antes de ler qualquer saída bruta. Nunca
 * escreve automaticamente em `results/corrected-v2/`; o destino é
 * sempre explícito, decidido por quem chama (tipicamente o
 * orquestrador, `orchestrate-corrected-evaluation-v2.ts`).
 *
 * Convenção de execução: `cd packages/bdos-core && npx tsx
 * src/domain/.../evaluation-run/run-local-reader-evaluation-v2.ts
 * --output-dir <caminho>`.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

import { REFERENCE_TRUTH_BUNDLES, REFERENCE_TRUTH_PAGES, REFERENCE_TRUTH_COLUMNS } from "../../reference-truth/discovery-reference-truth";
import type { ReferenceTruthColumnRole, ReferenceTruthPageBundle } from "../../reference-truth/discovery-reference-truth.types";
import { parseDoclingRawExport } from "../raw-adapters/discovery-local-reader-docling-adapter";
import type { DoclingRawExport } from "../raw-adapters/discovery-local-reader-docling-adapter";
import { parsePaddleOcrRawExport } from "../raw-adapters/discovery-local-reader-paddleocr-adapter";
import type { PaddleOcrRawExport } from "../raw-adapters/discovery-local-reader-paddleocr-adapter";
import { associateObservedCellsToReference } from "../discovery-local-reader-comparison";
import { computeLocalReaderCriticalFieldMetric, computeLocalReaderExecutionMetrics, computeLocalReaderTableStructureMetrics } from "../discovery-local-reader-metrics";
import { classifyLocalReaderMultilineDescription } from "../discovery-local-reader-metrics";
import { classifyLocalReaderViability } from "../discovery-local-reader-viability";
import type {
  LocalReaderExpectedCellRef,
  LocalReaderExpectedRegionRef,
  LocalReaderExternalContentMetric,
  LocalReaderObservedCellRef,
  LocalReaderObservedRegionRef,
  LocalReaderPageEvaluation,
  LocalReaderPageGeometry,
  LocalReaderTableStructureMetrics,
  LocalReaderTool,
} from "../discovery-local-reader-evaluation.types";
import { associateObservedRegionsToReferenceV2 } from "../v2/discovery-local-reader-comparison-v2";
import { computeLocalReaderRegionTextMetricsV2 } from "../v2/discovery-local-reader-metrics-v2";
import { deriveObservedDescriptionLinesV2 } from "../v2/discovery-local-reader-multiline-v2";
import { classifyLocalReaderMathEvidenceV2, deriveMathEvidenceFieldStatesV2 } from "../v2/discovery-local-reader-math-evidence-v2";
import { deriveViabilityInputsV2 } from "../v2/discovery-local-reader-viability-inputs-v2";
import type { LocalReaderMathEvidenceResultV2, LocalReaderRegionComponentResultV2, LocalReaderRegionTextMetricsV2 } from "../v2/discovery-local-reader-evaluation-v2.types";
import { deriveExternalContentV2 } from "./derive-external-content-v2";
import { parseOutputDirArg } from "./parse-output-dir-arg-v2";

const REAL_PAGES = [46, 50, 54] as const;
const TOOLS: ReadonlyArray<LocalReaderTool> = ["docling", "paddleocr"];

const PRIVATE_ACQUISITION_DIR = resolve(process.cwd(), "..", "..", "private", "local-reader-acquisition");

function pageGeometryFor(realPageNumber: number): LocalReaderPageGeometry {
  const page = REFERENCE_TRUTH_PAGES.find((p) => p.realPageNumber === realPageNumber)!;
  return { pageWidthPoints: page.pageWidthPoints, pageHeightPoints: page.pageHeightPoints, renderingResolutionDpi: page.renderingResolutionDpi };
}

function bundleFor(realPageNumber: number): ReferenceTruthPageBundle {
  return REFERENCE_TRUTH_BUNDLES.find((b) => b.page.realPageNumber === realPageNumber)!;
}

function canonicalHash(value: unknown): string {
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

// --- Verdade de referência: projeções mínimas exigidas pelo comparador (idêntico a v1) ---

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

// --- Execução (§9.1, idêntico a v1) ------------------------------------------

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

interface ToolEvaluationResultV2 {
  readonly tool: LocalReaderTool;
  readonly execution: ReturnType<typeof computeLocalReaderExecutionMetrics>;
  readonly regionTextByPage: Record<number, LocalReaderRegionTextMetricsV2>;
  readonly tableStructureByPage: Record<number, LocalReaderTableStructureMetrics>;
  readonly criticalFields: ReturnType<typeof computeLocalReaderCriticalFieldMetric>[];
  readonly directMatchCellsTotal: number;
  readonly multiline: ReturnType<typeof classifyLocalReaderMultilineDescription>[];
  readonly multilineCaseCount: number;
  readonly mathEvidence: LocalReaderMathEvidenceResultV2[];
  readonly mathEvidenceCounts: Record<string, number>;
  readonly mathEvidenceTotal: number;
  readonly externalContent: LocalReaderExternalContentMetric | null;
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

const COLUMN_ROLE_BY_COLUMN_ID = new Map(REFERENCE_TRUTH_COLUMNS.map((c) => [c.id, c.role]));

function isItemRow(bundle: ReferenceTruthPageBundle, logicalRowId: string): boolean {
  const row = bundle.logicalRows.find((r) => r.id === logicalRowId);
  return row?.type === "item_de_servico";
}

function multilineItemRowIds(bundle: ReferenceTruthPageBundle): ReadonlyArray<string> {
  const descCellCountByRow = new Map<string, number>();
  bundle.cells.filter((c) => c.columnId === "col-descricao").forEach((c) => descCellCountByRow.set(c.logicalRowId, (descCellCountByRow.get(c.logicalRowId) ?? 0) + 1));
  return bundle.logicalRows.filter((r) => r.type === "item_de_servico" && (descCellCountByRow.get(r.id) ?? 0) > 1).map((r) => r.id);
}

function descriptionLinesFor(bundle: ReferenceTruthPageBundle, logicalRowId: string): ReadonlyArray<string> {
  return bundle.cells
    .filter((c) => c.logicalRowId === logicalRowId && c.columnId === "col-descricao")
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => c.literalText);
}

function evaluateToolV2(tool: LocalReaderTool): ToolEvaluationResultV2 {
  const run1Pages = REAL_PAGES.map((page) => loadRawAndRun(tool, page, 1));
  const run2Pages = REAL_PAGES.map((page) => loadRawAndRun(tool, page, 2));

  const execution = computeLocalReaderExecutionMetrics(buildPageEvaluations(tool, 1));

  const observedRegions: LocalReaderObservedRegionRef[] = [];
  const observedCells: LocalReaderObservedCellRef[] = [];
  const regionTextByPage: Record<number, LocalReaderRegionTextMetricsV2> = {};
  const tableStructureByPage: Record<number, LocalReaderTableStructureMetrics> = {};
  const regionComponentsByPage: Record<number, ReadonlyArray<LocalReaderRegionComponentResultV2>> = {};
  const rawOutputHashMatchByPage: Record<number, boolean> = {};
  const canonicalOutputHashMatchByPage: Record<number, boolean> = {};

  REAL_PAGES.forEach((page, index) => {
    const { output: out1, meta: meta1 } = run1Pages[index];
    const { output: out2, meta: meta2 } = run2Pages[index];

    rawOutputHashMatchByPage[page] = meta1.rawOutputSha256 === meta2.rawOutputSha256;
    canonicalOutputHashMatchByPage[page] = canonicalHash(out1) === canonicalHash(out2);

    out1.regions.forEach((r) => observedRegions.push({ id: r.id, realPageNumber: r.realPageNumber, normalizedText: r.literalText, boundingBox: r.convertedBoundingBox }));
    out1.cells.forEach((c) => observedCells.push({ id: c.id, realPageNumber: c.realPageNumber, columnId: null, normalizedText: c.literalText, boundingBox: c.boundingBox }));

    const pageExpectedRegions = expectedRegionsFor(page);
    const pageObservedRegions = observedRegions.filter((r) => r.realPageNumber === page);
    const regionComponents = associateObservedRegionsToReferenceV2(pageExpectedRegions, pageObservedRegions);
    regionComponentsByPage[page] = regionComponents;
    regionTextByPage[page] = computeLocalReaderRegionTextMetricsV2(regionComponents, pageExpectedRegions, pageObservedRegions);

    // §4.2 do fechamento: métrica de estrutura tabular preservada, reusando
    // computeLocalReaderTableStructureMetrics (v1, inalterada) — a correção
    // v2 nunca remove uma métrica v1 válida.
    const pageExpectedCells = expectedCellsFor(page);
    const pageObservedCells = observedCells.filter((c) => c.realPageNumber === page);
    const pageCellComparisons = associateObservedCellsToReference(pageExpectedCells, pageObservedCells);
    const rowsDetected = out1.tables.reduce((sum, t) => sum + t.rowCount, 0);
    tableStructureByPage[page] = computeLocalReaderTableStructureMetrics(pageExpectedCells, pageCellComparisons, out1.tables.length, rowsDetected);
  });

  const allCellComparisons = REAL_PAGES.flatMap((p) => {
    const expected = expectedCellsFor(p);
    const observed = observedCells.filter((c) => c.realPageNumber === p);
    return associateObservedCellsToReference(expected, observed);
  });

  // §4.3 do fechamento: directMatchCellsTotal (TODAS as células) mantido
  // separado de criticalFieldLiteralMatchesTotal (apenas papéis críticos) —
  // a mesma separação que v1 já fazia corretamente.
  const directMatchCellsTotal = allCellComparisons.filter((c) => c.outcome === "direct_match").length;

  const criticalFieldCellIds = new Set<string>(
    REAL_PAGES.flatMap((p) => CRITICAL_ROLES.flatMap((role) => bundleFor(p).cells.filter((c) => c.columnId === COLUMN_ID_BY_ROLE[role] && isItemRow(bundleFor(p), c.logicalRowId)).map((c) => c.id))),
  );

  const criticalFields = CRITICAL_ROLES.map((role) => {
    const roleCellIds = new Set(REAL_PAGES.flatMap((p) => bundleFor(p).cells.filter((c) => c.columnId === COLUMN_ID_BY_ROLE[role] && isItemRow(bundleFor(p), c.logicalRowId)).map((c) => c.id)));
    const outcomes = allCellComparisons
      .filter((cmp) => cmp.referenceCellIds.some((id) => roleCellIds.has(id)))
      .map((cmp) => ({ literalMatch: cmp.outcome === "direct_match", exactDecimalValueMatch: cmp.outcome === "direct_match" ? true : null }));
    return computeLocalReaderCriticalFieldMetric(role, roleCellIds.size, outcomes);
  });

  const multiline = REAL_PAGES.flatMap((p) => {
    const bundle = bundleFor(p);
    return multilineItemRowIds(bundle).map((logicalRowId) => {
      const expectedLines = descriptionLinesFor(bundle, logicalRowId);
      const derived = deriveObservedDescriptionLinesV2(bundle, logicalRowId, allCellComparisons);
      return classifyLocalReaderMultilineDescription(expectedLines, derived.observedLinesInOrder, derived.splitAcrossIncompatibleCells, derived.mergedWithNeighborItemText);
    });
  });

  // ReferenceTruthMathRelation não carrega a própria página — cada relação
  // já vem escopada dentro do bundle da página que a contém, então a
  // página é mantida junto ao mapear, nunca redescoberta por busca.
  const allMathRelationsWithBundle = REAL_PAGES.flatMap((p) => {
    const bundle = bundleFor(p);
    return bundle.mathRelations.map((rel) => ({ rel, bundle }));
  });
  const allMathRelations = allMathRelationsWithBundle.map(({ rel }) => rel);
  const mathEvidence: LocalReaderMathEvidenceResultV2[] = allMathRelationsWithBundle.map(({ rel, bundle }) => {
    const fieldStates = deriveMathEvidenceFieldStatesV2(rel, allCellComparisons, bundle);
    return classifyLocalReaderMathEvidenceV2(rel.id, fieldStates);
  });
  const mathEvidenceCounts: Record<string, number> = { evidencia_completa: 0, evidencia_parcial: 0, evidencia_ausente: 0, evidencia_divergente_da_fonte: 0 };
  mathEvidence.forEach((m) => {
    mathEvidenceCounts[m.availability] += 1;
  });

  // §4.1 do fechamento: conteúdo externo derivado de verdade — região
  // externa esperada + regiões observadas correspondentes (comparação v2
  // real) + comparações de célula reais. Nunca `tool === "paddleocr"`
  // hardcoded como em v1.
  const tcuRegion = bundleFor(46).physicalRegions.find((r) => r.classification === "nota_externa");
  const observedRegionTextById = new Map(observedRegions.map((r) => [r.id, r.normalizedText]));
  const expectedCellColumnById = new Map(REAL_PAGES.flatMap((p) => bundleFor(p).cells.map((c) => [c.id, c.columnId] as const)));
  const externalContent = deriveExternalContentV2(tcuRegion, regionComponentsByPage[46] ?? [], observedRegionTextById, allCellComparisons, expectedCellColumnById, COLUMN_ROLE_BY_COLUMN_ID);

  const regionTextByPageV2 = regionTextByPage;
  const viabilityInputs = deriveViabilityInputsV2({
    tool,
    execution,
    allCellComparisons,
    allObservedCells: observedCells,
    criticalFields,
    criticalFieldCellIds,
    regionTextByPageV2,
    incorporatedTcuNoteAsItemOrValue: externalContent?.isCriticalRisk ?? false,
    rawOutputHashMatchByPage,
    acquisitionMetaByPage: Object.fromEntries(REAL_PAGES.map((p, i) => [p, run1Pages[i].meta])),
  });
  const viability = classifyLocalReaderViability(viabilityInputs);

  return {
    tool,
    execution,
    regionTextByPage,
    tableStructureByPage,
    criticalFields,
    directMatchCellsTotal,
    multiline,
    multilineCaseCount: multiline.length,
    mathEvidence,
    mathEvidenceCounts,
    mathEvidenceTotal: allMathRelations.length,
    externalContent,
    viability,
    repetition: { rawOutputHashMatchByPage, canonicalOutputHashMatchByPage },
  };
}

// --- Execução principal --------------------------------------------------------

function main(): void {
  const outputDir = resolve(parseOutputDirArg(process.argv.slice(2)));
  mkdirSync(outputDir, { recursive: true });

  const results = TOOLS.map((tool) => evaluateToolV2(tool));

  results.forEach((result) => {
    const path = join(outputDir, `${result.tool}-evaluation-result.v2.json`);
    writeFileSync(path, JSON.stringify(result, null, 2), "utf8");
    console.log(`WROTE ${path}`);
  });

  const summary = results.map((r) => ({
    tool: r.tool,
    pagesCompleted: r.execution.pagesCompleted,
    pagesFailed: r.execution.pagesFailed,
    regionTextByPage: r.regionTextByPage,
    tableStructureByPage: r.tableStructureByPage,
    directMatchCellsTotal: r.directMatchCellsTotal,
    criticalFieldLiteralMatchesTotal: r.criticalFields.reduce((sum, f) => sum + f.literalMatches, 0),
    multilineCaseCount: r.multilineCaseCount,
    multilineOutcomeCounts: r.multiline.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o]: (acc[o] ?? 0) + 1 }), {}),
    mathEvidenceCounts: r.mathEvidenceCounts,
    mathEvidenceTotal: r.mathEvidenceTotal,
    externalContent: r.externalContent,
    viability: r.viability,
    rawOutputHashMatchByPage: r.repetition.rawOutputHashMatchByPage,
    canonicalOutputHashMatchByPage: r.repetition.canonicalOutputHashMatchByPage,
  }));
  writeFileSync(join(outputDir, "aggregate-summary.v2.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main();
