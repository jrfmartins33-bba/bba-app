import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pdfjsPhysicalDocumentReader } from "../src/infrastructure/budget-document-location/pdfjs/pdfjs-physical-document-reader";
import type { PhysicalDocumentReadResult } from "../src/domain/budget-document-location/physical-document-read.types";
import {
  observeDocumentSignals, locateBudgetDocumentPages, reconstructBudgetDocumentStructure, detectBudgetDocumentTabularRegions,
  reconstructBudgetDocumentPhysicalColumnHypotheses, formBudgetDocumentPhysicalCellHypotheses, formBudgetDocumentPhysicalCellTextEvidence,
  formBudgetDocumentPageLocalNeutralStructuredEvidence, evaluateBudgetDocumentPageBoundaryNeutralContinuity,
} from "../src/domain/budget-document-location";
import { characterizeBudgetDocumentEconomicStructure } from "../src/domain/budget-document-economic-characterization";
import type { IndependentBudgetReferenceLine } from "../src/domain/budget-document-economic-characterization";
import { LAGOA_DO_ARROZ_OFFICIAL_LINES } from "../src/domain/budget-version/lagoa-do-arroz.official-fixture";

/**
 * Diagnóstico manual, local, do documento oficial real (Sprint 21.4B).
 * NUNCA roda em CI (não termina em `.test.ts`, `scripts/run-tests.mjs` não
 * o descobre). NUNCA recebe caminho hardcoded — sempre um argumento de
 * linha de comando. A saída fica em `/private/`, já ignorado pelo Git; o
 * PDF em si nunca é lido a partir do repositório nem copiado para dentro
 * dele.
 *
 * Fica fora de `src/` deliberadamente: é o único ponto do pacote que
 * legitimamente cruza f.1→g.3 (leitura real de PDF), a caracterização
 * econômica e a fixture real de `budget-version` — nenhum guard
 * arquitetural de `src/` deveria (nem deve) permitir essa combinação em
 * código de produção ou de domínio.
 *
 * Uso:
 *   cd packages/bdos-core
 *   npx tsx scripts/diagnose-real-budget-document.ts "<caminho absoluto do PDF>" [páginaInicial-páginaFinal]
 *   (ou: pnpm diagnose:real-budget-document -- "<caminho>" [páginaInicial-páginaFinal])
 *
 * Exemplo (caso real desta Sprint, nunca hardcoded aqui — só documentado em texto):
 *   npx tsx scripts/diagnose-real-budget-document.ts "C:/.../05_Anexo_Tecnico_Termo_Referencia.pdf" 46-54
 */

/**
 * `locateBudgetDocumentPages` exige páginas densas a partir de 1 ("Pages
 * must be unique, ordered, and dense from 1 through totalPageCount") — um
 * recorte de página do meio de um PDF de 1033 páginas precisa ser
 * renumerado para satisfazer esse invariante da cadeia real. A
 * renumeração é EXCLUSIVA deste script de diagnóstico local (nunca
 * produção): o `offset` é preservado para traduzir de volta ao número de
 * página real do documento em todo o relatório final.
 */
function sliceReadResult(full: PhysicalDocumentReadResult, range: readonly [number, number] | null): { readonly result: PhysicalDocumentReadResult; readonly offset: number } {
  if (range === null) return { result: full, offset: 0 };
  const [start, end] = range;
  const selected = full.pages.filter((page) => page.pageNumber >= start && page.pageNumber <= end).sort((a, b) => a.pageNumber - b.pageNumber);
  const offset = start - 1;
  const pages = selected.map((page, index) => ({ ...page, pageNumber: index + 1 }));
  return { result: { ...full, pages, totalPageCount: pages.length }, offset };
}

function toReferenceLines(): ReadonlyArray<IndependentBudgetReferenceLine> {
  return LAGOA_DO_ARROZ_OFFICIAL_LINES.map((line) => ({
    externalCode: line.externalSourceCode,
    hierarchicalCode: line.hierarchicalCode,
    classification: line.classification === "Grupo" ? "group" : line.classification === "Subgrupo" ? "subgroup" : "service_item",
    description: line.descricao.status === "ConfirmedFromSource" ? line.descricao.text : null,
    unit: line.unidade,
    quantityDecimalText: line.quantidade,
    totalCents: line.totalComBdiReais !== null ? Math.round(Number(line.totalComBdiReais) * 100) : null,
  }));
}

async function main() {
  const pdfPathArg = process.argv[2];
  if (!pdfPathArg) {
    console.error("uso: diagnose-real-budget-document.ts <caminho-do-pdf> [paginaInicial-paginaFinal]");
    process.exit(1);
  }
  const rangeArg = process.argv[3];
  const range: [number, number] | null = rangeArg ? (() => {
    const [s, e] = rangeArg.split("-").map(Number);
    return [s, e] as [number, number];
  })() : null;

  const bytes = readFileSync(resolve(pdfPathArg));
  const sourceByteHashFull = createHash("sha256").update(bytes).digest("hex");
  console.log(`arquivo: ${pdfPathArg.split(/[\\/]/).pop()}`);
  console.log(`tamanho: ${bytes.length} bytes`);
  console.log(`sha256: ${sourceByteHashFull}`);

  const fullPhysicalRead = await pdfjsPhysicalDocumentReader.read(new Uint8Array(bytes));
  console.log(`páginas no documento completo: ${fullPhysicalRead.pages.length}`);

  const { result: physicalRead, offset: pageNumberOffset } = sliceReadResult(fullPhysicalRead, range);
  const toRealPageNumber = (localPageNumber: number): number => localPageNumber + pageNumberOffset;
  console.log(`páginas processadas nesta execução: ${physicalRead.pages.length}${range ? ` (páginas reais ${range[0]}-${range[1]}, renumeradas 1-${physicalRead.pages.length} apenas para satisfazer o invariante de numeração densa da localização de páginas)` : ""}`);

  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const structureReconstruction = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  const tabularRegionDetection = detectBudgetDocumentTabularRegions({ structureReconstruction });
  const physicalColumnHypothesisReconstruction = reconstructBudgetDocumentPhysicalColumnHypotheses({ structureReconstruction, tabularRegionDetection });
  const physicalCellHypothesisFormation = formBudgetDocumentPhysicalCellHypotheses({ structureReconstruction, tabularRegionDetection, physicalColumnHypothesisReconstruction });
  const physicalCellTextEvidenceFormation = formBudgetDocumentPhysicalCellTextEvidence({ physicalRead, structureReconstruction, physicalCellHypothesisFormation });
  const pageLocalNeutralStructuredEvidence = formBudgetDocumentPageLocalNeutralStructuredEvidence({ structureReconstruction, tabularRegionDetection, physicalCellHypothesisFormation, physicalCellTextEvidenceFormation });
  const pageBoundaryNeutralContinuity = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence });

  console.log(`\n=== cadeia documental ===`);
  console.log(`localização de páginas: ${pageLocation.status} — candidatas: ${pageLocation.pageDecisions.filter((p) => p.classification === "candidate").length}`);
  console.log(`reconstrução estrutural: ${structureReconstruction.status}`);
  console.log(`detecção de regiões: ${tabularRegionDetection.status}`);
  console.log(`hipóteses de célula: ${physicalCellHypothesisFormation.status}`);
  console.log(`evidência textual: ${physicalCellTextEvidenceFormation.status}`);
  console.log(`estrutura neutra (g.2): ${pageLocalNeutralStructuredEvidence.status} — grupos: ${pageLocalNeutralStructuredEvidence.groups.length}`);
  console.log(`continuidade entre páginas (g.3): ${pageBoundaryNeutralContinuity.status} — avaliações: ${pageBoundaryNeutralContinuity.evaluations.length}`);
  for (const evaluation of pageBoundaryNeutralContinuity.evaluations) {
    console.log(`  página real ${toRealPageNumber(evaluation.originPageNumber)} -> ${toRealPageNumber(evaluation.targetPageNumber)}: ${evaluation.status}`);
  }

  const referenceLines = toReferenceLines();
  const characterization = characterizeBudgetDocumentEconomicStructure(
    { pageLocalNeutralStructuredEvidence, pageBoundaryNeutralContinuity },
    { referenceLines, referenceSourceDescription: "LAGOA_DO_ARROZ_OFFICIAL_LINES (extraída de planilha XLSX distinta, sem desoneração)" },
  );

  console.log(`\n=== caracterização econômica ===`);
  console.log(`status: ${characterization.status}`);
  console.log(`grupos: ${characterization.metrics.groupCount}`);
  console.log(`subgrupos: ${characterization.metrics.subgroupCount}`);
  console.log(`itens de serviço: ${characterization.metrics.serviceItemCount}`);
  console.log(`total extraído (centavos): ${characterization.metrics.declaredTotalCents}`);
  console.log(`ambíguas: ${characterization.metrics.ambiguousCount}, requer revisão: ${characterization.metrics.requiresReviewCount}, incompletas: ${characterization.metrics.incompleteCount}`);

  const cot015 = characterization.proposedLines.find((line) => line.externalCode === "COT-015");
  console.log(`\nCOT-015: ${cot015 ? `encontrado, tipo=${cot015.type}, status=${cot015.extractionStatus}, pai=${cot015.parentResolutionMethod}` : "NÃO encontrado"}`);

  const officialTotalCents = 980908718;
  console.log(`\n=== reconciliação contra referência oficial ===`);
  console.log(`| Critério | Oficial | Extraído | Diferença |`);
  console.log(`| Grupos | 11 | ${characterization.metrics.groupCount} | ${characterization.metrics.groupCount - 11} |`);
  console.log(`| Subgrupos | 25 | ${characterization.metrics.subgroupCount} | ${characterization.metrics.subgroupCount - 25} |`);
  console.log(`| Itens | 300 | ${characterization.metrics.serviceItemCount} | ${characterization.metrics.serviceItemCount - 300} |`);
  console.log(`| Total (centavos) | ${officialTotalCents} | ${characterization.metrics.declaredTotalCents} | ${(characterization.metrics.declaredTotalCents ?? 0) - officialTotalCents} |`);

  const diffSummary = {
    matched: characterization.independentReferenceDiff.entries.filter((e) => e.outcome === "matched").length,
    missing: characterization.independentReferenceDiff.entries.filter((e) => e.outcome === "missing_from_extraction").length,
    extra: characterization.independentReferenceDiff.entries.filter((e) => e.outcome === "extra_in_extraction").length,
    duplicate: characterization.independentReferenceDiff.entries.filter((e) => e.outcome === "duplicate_code_in_extraction").length,
  };
  console.log(`\ndiff linha a linha: matched=${diffSummary.matched} missing=${diffSummary.missing} extra=${diffSummary.extra} duplicate=${diffSummary.duplicate}`);

  const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../private/budget-import-diagnostics");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `lagoa-do-arroz-diagnostic-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify({
    file: pdfPathArg.split(/[\\/]/).pop(),
    sha256: sourceByteHashFull,
    pageRange: range,
    pageNumberOffset,
    pageNumberNote: pageNumberOffset > 0 ? `pageNumber em proposedLines/technicalProblems é LOCAL a este recorte (1-based); página real do documento = pageNumber + ${pageNumberOffset}` : "pageNumber já é a página real do documento",
    chainStatuses: {
      pageLocation: pageLocation.status,
      structureReconstruction: structureReconstruction.status,
      tabularRegionDetection: tabularRegionDetection.status,
      physicalCellHypothesisFormation: physicalCellHypothesisFormation.status,
      physicalCellTextEvidenceFormation: physicalCellTextEvidenceFormation.status,
      pageLocalNeutralStructuredEvidence: pageLocalNeutralStructuredEvidence.status,
      pageBoundaryNeutralContinuity: pageBoundaryNeutralContinuity.status,
      economicCharacterization: characterization.status,
    },
    metrics: characterization.metrics,
    diffSummary,
    independentReferenceDiff: characterization.independentReferenceDiff,
    selfConsistencyDiagnostic: characterization.selfConsistencyDiagnostic,
    technicalProblems: characterization.technicalProblems,
    cot015: cot015 ?? null,
    proposedLines: characterization.proposedLines,
  }, null, 2), "utf8");
  console.log(`\nrelatório completo salvo em: ${outPath}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
