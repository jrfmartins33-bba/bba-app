import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pdfjsPhysicalDocumentReader } from "../src/infrastructure/budget-document-location/pdfjs/pdfjs-physical-document-reader";
import type { PhysicalDocumentReadResult } from "../src/domain/budget-document-location/physical-document-read.types";
import {
  observeDocumentSignals,
  locateBudgetDocumentPages,
  reconstructBudgetDocumentStructure,
  detectBudgetDocumentTabularRegions,
} from "../src/domain/budget-document-location";
import {
  buildCandidatePageEvidence,
  CANDIDATES,
  H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO,
} from "../src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-candidate-hypotheses";
import type { CandidatePageEvidence } from "../src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-candidate-hypotheses";

function computeH3DiagnosticRatio(evidence: CandidatePageEvidence, lineKey: string): number | null {
  const segments = evidence.segments.filter((s) => s.lineKey === lineKey);
  if (segments.length === 0) return null;
  const targetWidth = Math.max(...segments.map((s) => s.rightPoints - s.leftPoints));
  return targetWidth;
}

/**
 * Diagnóstico manual, local, do documento oficial real (Sprint 21.4B.3A,
 * §5/§10/§11 do enunciado — Pregão Eletrônico 90006/2025, DNOCS, Lagoa do
 * Arroz). NUNCA roda em CI (não termina em `.test.ts`, `scripts/run-tests.mjs`
 * não o descobre). NUNCA recebe caminho hardcoded — sempre um argumento de
 * linha de comando. A saída completa fica em `/private/`, já ignorado pelo
 * Git; o PDF em si nunca é lido a partir do repositório nem copiado para
 * dentro dele.
 *
 * Roda a cadeia real de produção (f.0-f.2a, INALTERADA, ainda reprovada)
 * para obter a linha de base, e adicionalmente constrói a evidência de
 * capacidade completa (`buildCandidatePageEvidence`) para avaliar as
 * hipóteses candidatas H1-H4 (exclusivamente diagnósticas, nunca
 * produção) sobre cada linha que a regra atual deixa de fora
 * (`not_in_tabular_region`) dentro de páginas que já têm ao menos uma
 * região confirmada — candidatas a "linha esparsa ponte" ou a "elemento
 * externo corretamente excluído", que só uma inspeção humana do texto de
 * origem pode rotular (nunca os algoritmos candidatos, que nunca usam
 * texto).
 *
 * Uso:
 *   cd packages/bdos-core
 *   npx tsx scripts/discover-tabular-membership-real-document.ts "<caminho-do-pdf>" [paginaInicial-paginaFinal]
 */

function sliceReadResult(full: PhysicalDocumentReadResult, range: readonly [number, number] | null): { readonly result: PhysicalDocumentReadResult; readonly offset: number } {
  if (range === null) return { result: full, offset: 0 };
  const [start, end] = range;
  const selected = full.pages.filter((page) => page.pageNumber >= start && page.pageNumber <= end).sort((a, b) => a.pageNumber - b.pageNumber);
  const offset = start - 1;
  const pages = selected.map((page, index) => ({ ...page, pageNumber: index + 1 }));
  return { result: { ...full, pages, totalPageCount: pages.length }, offset };
}

function lineSourceText(physicalPage: PhysicalDocumentReadResult["pages"][number], sourceTextItemIndices: ReadonlyArray<number>): string {
  return sourceTextItemIndices
    .map((i) => physicalPage.textItems[i]?.text ?? "")
    .join(" ")
    .trim();
}

async function main() {
  const pdfPathArg = process.argv[2];
  if (!pdfPathArg) {
    console.error("uso: discover-tabular-membership-real-document.ts <caminho-do-pdf> [paginaInicial-paginaFinal]");
    process.exit(1);
  }
  const rangeArg = process.argv[3] ?? "46-54";
  const [rangeStart, rangeEnd] = rangeArg.split("-").map(Number);
  const range: [number, number] = [rangeStart, rangeEnd];

  const bytes = readFileSync(resolve(pdfPathArg));
  const sourceByteHashFull = createHash("sha256").update(bytes).digest("hex");
  console.log(`arquivo: ${pdfPathArg.split(/[\\/]/).pop()}`);
  console.log(`tamanho: ${bytes.length} bytes`);
  console.log(`sha256: ${sourceByteHashFull}`);

  const fullPhysicalRead = await pdfjsPhysicalDocumentReader.read(new Uint8Array(bytes));
  console.log(`páginas no documento completo: ${fullPhysicalRead.pages.length}`);

  const { result: physicalRead, offset: pageNumberOffset } = sliceReadResult(fullPhysicalRead, range);
  const toRealPageNumber = (localPageNumber: number): number => localPageNumber + pageNumberOffset;
  console.log(`páginas processadas nesta execução: ${physicalRead.pages.length} (páginas reais ${range[0]}-${range[1]})`);

  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const structureReconstruction = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  const tabularRegionDetection = detectBudgetDocumentTabularRegions({ structureReconstruction });

  console.log(`\n=== cadeia documental (produção, inalterada) ===`);
  console.log(`localização de páginas: ${pageLocation.status}`);
  console.log(`reconstrução estrutural: ${structureReconstruction.status}`);
  console.log(`detecção de regiões (f.2a, reprovada): ${tabularRegionDetection.status}`);

  const flippedSamples: Array<{
    readonly realPageNumber: number;
    readonly lineKey: string;
    readonly sourceText: string;
    readonly decisions: Record<string, string>;
    readonly targetSegmentWidthPoints: number | null;
  }> = [];

  tabularRegionDetection.groups.forEach((group) => {
    group.pages.forEach((page) => {
      const realPageNumber = toRealPageNumber(page.pageNumber);
      console.log(
        `\npágina real ${realPageNumber}: status=${page.status} regiões=${page.regions.length} linhas=${page.metrics.totalLineCount} ` +
          `incluídas=${page.metrics.includedInCandidateRegionLineCount} excluídas=${page.metrics.notInTabularRegionLineCount} ` +
          `ambíguas=${page.metrics.unresolvedAmbiguityLineCount}`,
      );

      if (page.regions.length === 0) {
        return;
      }

      const reconstructedPage = structureReconstruction.groups.find((g) => g.pages.some((p) => p.pageNumber === page.pageNumber))!.pages.find((p) => p.pageNumber === page.pageNumber)!;
      const evidence = buildCandidatePageEvidence(reconstructedPage);
      const physicalPage = physicalRead.pages.find((p) => p.pageNumber === page.pageNumber)!;

      const excludedLineKeys = page.lineDispositions.filter((d) => d.status === "not_in_tabular_region").map((d) => d.lineKey);
      excludedLineKeys.forEach((lineKey) => {
        const line = reconstructedPage.lines.find((l) => l.lineKey === lineKey)!;
        const decisions: Record<string, string> = {};
        CANDIDATES.forEach((c) => {
          decisions[c.id] = c.evaluate(evidence, lineKey);
        });
        const sourceText = lineSourceText(physicalPage, line.sourceTextItemIndices);
        const targetWidth = computeH3DiagnosticRatio(evidence, lineKey);
        flippedSamples.push({ realPageNumber, lineKey, sourceText, decisions, targetSegmentWidthPoints: targetWidth });
      });
    });
  });

  console.log(`\n=== linhas excluídas pela regra atual, avaliadas pelas candidatas H1-H4 (${flippedSamples.length} amostras) ===`);
  flippedSamples.forEach((sample) => {
    console.log(`página ${sample.realPageNumber} | largura=${sample.targetSegmentWidthPoints?.toFixed(1)} | ${JSON.stringify(sample.decisions)} | texto: "${sample.sourceText.slice(0, 80)}"`);
  });

  console.log(`\n=== casos onde H3 DIVERGE de H1/H2/H4 (H3 exclui, os demais incluem) — foco da inspeção manual ===`);
  flippedSamples
    .filter((s) => s.decisions.H3 === "must_exclude" && s.decisions.H1 !== "must_exclude")
    .forEach((sample) => {
      console.log(`página ${sample.realPageNumber} | largura_segmento=${sample.targetSegmentWidthPoints?.toFixed(1)}pt | limiar_H3=${H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO}x | H3b=${sample.decisions.H3b} | texto: "${sample.sourceText}"`);
    });

  console.log(`\n=== casos onde H3b DIVERGE de H1/H2/H4 (H3b exclui, os demais incluem) — mesma inspeção, envelope global ===`);
  flippedSamples
    .filter((s) => s.decisions.H3b === "must_exclude" && s.decisions.H1 !== "must_exclude")
    .forEach((sample) => {
      console.log(`página ${sample.realPageNumber} | largura_segmento=${sample.targetSegmentWidthPoints?.toFixed(1)}pt | texto: "${sample.sourceText}"`);
    });

  const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../private/tabular-membership-discovery");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `lagoa-do-arroz-discovery-${Date.now()}.json`);
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        file: pdfPathArg.split(/[\\/]/).pop(),
        sha256: sourceByteHashFull,
        pageRange: range,
        chainStatuses: {
          pageLocation: pageLocation.status,
          structureReconstruction: structureReconstruction.status,
          tabularRegionDetection: tabularRegionDetection.status,
        },
        pageMetrics: tabularRegionDetection.groups.flatMap((g) => g.pages.map((p) => ({ realPageNumber: toRealPageNumber(p.pageNumber), status: p.status, regionCount: p.regions.length, metrics: p.metrics }))),
        flippedSamples,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\nrelatório completo salvo em: ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
