import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pdfjsPhysicalDocumentReader } from "../src/infrastructure/budget-document-location/pdfjs/pdfjs-physical-document-reader";
import type { PhysicalDocumentReadResult } from "../src/domain/budget-document-location/physical-document-read.types";
import { observeDocumentSignals, locateBudgetDocumentPages, reconstructBudgetDocumentStructure } from "../src/domain/budget-document-location";

/**
 * Inventário real, exclusivamente de identidade e localização (Sprint
 * 21.4B.3A.1, §9.1 do enunciado) — NUNCA importa o módulo de candidatas
 * (`discovery-candidate-hypotheses.ts` e correlatos), NUNCA chama H0, H1,
 * H2, H3, H3b ou H4, NUNCA calcula ou registra resultado de
 * pertencimento. Roda apenas a cadeia real de PRODUÇÃO já existente e
 * inalterada (leitura física → observação de sinais → localização de
 * páginas → reconstrução estrutural) para obter identidade
 * (`realPageNumber`, `lineKey`, `verticalOrder`) e o texto de origem de
 * cada linha física — nada além disso.
 *
 * NUNCA roda em CI (não termina em `.test.ts`). NUNCA recebe caminho
 * hardcoded. A saída fica em `/private/`, já ignorado pelo Git; o PDF
 * nunca é lido a partir do repositório nem copiado para dentro dele.
 *
 * Uso:
 *   cd packages/bdos-core
 *   npx tsx scripts/inventory-h3c-real-lines.ts "<caminho-do-pdf>" [paginaInicial-paginaFinal]
 */

export interface H3cInventoryEntry {
  readonly realPageNumber: number;
  readonly lineKey: string;
  readonly verticalOrder: number;
  readonly sourceText: string;
}

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
    console.error("uso: inventory-h3c-real-lines.ts <caminho-do-pdf> [paginaInicial-paginaFinal]");
    process.exit(1);
  }
  const rangeArg = process.argv[3] ?? "46-54";
  const [rangeStart, rangeEnd] = rangeArg.split("-").map(Number);
  const range: [number, number] = [rangeStart, rangeEnd];

  const bytes = readFileSync(resolve(pdfPathArg));
  const sourceByteHashFull = createHash("sha256").update(bytes).digest("hex");
  console.log(`arquivo: ${pdfPathArg.split(/[\\/]/).pop()}`);
  console.log(`sha256: ${sourceByteHashFull}`);

  const fullPhysicalRead = await pdfjsPhysicalDocumentReader.read(new Uint8Array(bytes));
  const { result: physicalRead, offset: pageNumberOffset } = sliceReadResult(fullPhysicalRead, range);
  const toRealPageNumber = (localPageNumber: number): number => localPageNumber + pageNumberOffset;

  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const structureReconstruction = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });

  console.log(`localização de páginas: ${pageLocation.status}`);
  console.log(`reconstrução estrutural: ${structureReconstruction.status}`);

  const entries: H3cInventoryEntry[] = [];

  structureReconstruction.groups.forEach((group) => {
    group.pages.forEach((page) => {
      const realPageNumber = toRealPageNumber(page.pageNumber);
      const physicalPage = physicalRead.pages.find((p) => p.pageNumber === page.pageNumber)!;
      const orderedLines = [...page.lines].sort((a, b) => a.verticalOrder - b.verticalOrder);
      orderedLines.forEach((line) => {
        entries.push({
          realPageNumber,
          lineKey: line.lineKey,
          verticalOrder: line.verticalOrder,
          sourceText: lineSourceText(physicalPage, line.sourceTextItemIndices),
        });
      });
      console.log(`página real ${realPageNumber}: ${orderedLines.length} linhas físicas`);
    });
  });

  console.log(`\ntotal de linhas físicas nas páginas ${range[0]}-${range[1]}: ${entries.length}`);

  const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../private/tabular-membership-discovery");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `h3c-real-inventory-${Date.now()}.json`);
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        file: pdfPathArg.split(/[\\/]/).pop(),
        sha256: sourceByteHashFull,
        pageRange: range,
        chainStatuses: { pageLocation: pageLocation.status, structureReconstruction: structureReconstruction.status },
        entryCount: entries.length,
        entries,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\ninventário completo salvo em: ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
