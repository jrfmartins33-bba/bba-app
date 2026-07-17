import { pdfjsPhysicalDocumentReader, PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION } from "./pdfjs-physical-document-reader";
import { buildSyntheticPdfBytes } from "./testing/synthetic-pdf-bytes";
import { observeDocumentSignals, locateBudgetDocumentPages, reconstructBudgetDocumentStructure, detectBudgetDocumentTabularRegions } from "../../../domain/budget-document-location";
import type { BudgetDocumentTabularRegionDetectionResult } from "../../../domain/budget-document-location";

/**
 * Prova real da cadeia completa até a detecção de regiões tabulares
 * (Sprint 21.4A.2.f.2a) — mesmo padrão de
 * `reconstruct-budget-document-structure.real-pdf-chain.test.ts` (Sprint
 * anterior, §31.2 do domínio). Bytes de PDF sintéticos (nunca um documento
 * real, nunca `_local-documents`) lidos pelo adaptador
 * `pdfjsPhysicalDocumentReader` real — o mesmo usado em produção —
 * encadeados com o observador, o localizador, o reconstrutor estrutural e
 * o detector de regiões tabulares reais, todos consumidos apenas pelo
 * barrel público do domínio. Vive no diretório do adaptador (não em
 * `domain/`) porque é o único lugar do pacote em que a direção de
 * dependência já permitida (adaptador → domínio) comporta importar tanto o
 * leitor físico real quanto o detector — nunca o inverso.
 */

async function runTest(name: string, testCase: () => Promise<void>): Promise<void> {
  await testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const ROW_HEIGHT = 18;
const ROW_STEP = 34;

function twoColumnRow(row: number, startY: number): ReadonlyArray<{ text: string; x: number; y: number; fontSize: number }> {
  const y = startY - row * ROW_STEP;
  return [
    { text: `1.${row + 1} Escavacao manual tipo ${row}`, x: 72, y, fontSize: ROW_HEIGHT },
    { text: `${(row + 1) * 10},00`, x: 400, y, fontSize: ROW_HEIGHT },
  ];
}

const FOUR_ROW_TABULAR_PDF_BYTES = buildSyntheticPdfBytes([
  {
    items: [0, 1, 2, 3].flatMap((row) => twoColumnRow(row, 700)),
  },
]);

/**
 * Mesmas quatro linhas tabulares, com um item "BDI" adicional posicionado
 * na mesma linha física da primeira fileira (mesmo `y`, `x` muito à
 * direita da segunda coluna) — nunca uma quinta linha própria. Necessário
 * porque `structural-service-item-identification` sozinho produz
 * `classification: "ambiguous"` no localizador real (nenhum grupo
 * candidato é formado): o par de sinais positivos exigido por
 * `candidate-service-item-and-bdi-v1` (item de serviço + menção a BDI) só
 * se completa com este segundo sinal textual. Verificado empiricamente
 * (§ prova positiva abaixo) que este item extra vira um terceiro segmento
 * da primeira linha, nunca um alinhamento recorrente próprio (aparece em
 * uma única linha) e nunca altera a contagem de quatro linhas físicas da
 * página.
 */
const FOUR_ROW_TABULAR_PDF_WITH_BDI_BYTES = buildSyntheticPdfBytes([
  {
    items: [...[0, 1, 2, 3].flatMap((row) => twoColumnRow(row, 700)), { text: "BDI", x: 500, y: 700, fontSize: ROW_HEIGHT }],
  },
]);

async function runRealPdfChain(bytes: Uint8Array): Promise<{
  physicalRead: Awaited<ReturnType<typeof pdfjsPhysicalDocumentReader.read>>;
  detection: BudgetDocumentTabularRegionDetectionResult;
}> {
  const physicalRead = await pdfjsPhysicalDocumentReader.read(bytes);
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const structureReconstruction = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  const detection = detectBudgetDocumentTabularRegions({ structureReconstruction });
  return { physicalRead, detection };
}

async function main(): Promise<void> {
  await runTest("real PDF bytes -> reader -> observer -> locator -> reconstructor -> detectBudgetDocumentTabularRegions produces a real adapter identity", async () => {
    const { physicalRead } = await runRealPdfChain(FOUR_ROW_TABULAR_PDF_BYTES.slice());
    assertEqual(physicalRead.status, "completed");
    assertEqual(physicalRead.adapterVersion, PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION);
  });

  await runTest("real PDF chain: detection accepts the real reconstructor's contract and completes, never source_contract_version_unsupported", async () => {
    const { detection } = await runRealPdfChain(FOUR_ROW_TABULAR_PDF_BYTES.slice());
    assertEqual(detection.status === "completed" || detection.status === "completed_with_problems", true, `unexpected status: ${detection.status}`);
    assertEqual(detection.technicalProblems.some((p) => p.code === "source_contract_version_unsupported"), false);
  });

  await runTest("real PDF chain: preserves every source reconstruction identity through to the detection result", async () => {
    const { detection } = await runRealPdfChain(FOUR_ROW_TABULAR_PDF_BYTES.slice());
    assertEqual(detection.sourceByteHash.length, 64);
    assertEqual(detection.sourceReconstructorName, "budget-document-structure-reconstructor");
  });

  await runTest("real PDF chain: two independent readings of independently-copied bytes produce a JSON-equivalent detection result", async () => {
    const firstBytesCopy = FOUR_ROW_TABULAR_PDF_BYTES.slice();
    const secondBytesCopy = FOUR_ROW_TABULAR_PDF_BYTES.slice();
    assertEqual(firstBytesCopy === secondBytesCopy, false, "test setup: the two byte buffers must be independent instances, not the same reference");

    const first = await runRealPdfChain(firstBytesCopy);
    const second = await runRealPdfChain(secondBytesCopy);

    assertEqual(JSON.stringify(first.detection), JSON.stringify(second.detection));
  });

  await runTest("real PDF chain: a genuine tabular block (service item + BDI signal, real candidate classification) is positively detected as one candidate region with four included lines and at least two recurring alignments", async () => {
    const { detection } = await runRealPdfChain(FOUR_ROW_TABULAR_PDF_WITH_BDI_BYTES.slice());

    assertEqual(detection.status, "completed", `expected a clean completion, got ${detection.status}. technicalProblems: ${JSON.stringify(detection.technicalProblems)}`);
    assertEqual(detection.technicalProblems.length, 0);

    assertEqual(detection.groups.length, 1, "expected exactly one candidate group from the real page locator (service item + BDI signal)");
    const group = detection.groups[0];
    assertEqual(group.status, "detected");
    assertEqual(group.technicalProblems.length, 0);
    assertEqual(group.pages.length, 1, "expected exactly one page in the group");

    const page = group.pages[0];
    assertEqual(page.status, "detected");
    assertEqual(page.technicalProblems.length, 0);

    assertEqual(page.regions.length, 1, "expected exactly one candidate region");
    const region = page.regions[0];
    assertEqual(region.lineKeys.length, 4, "expected exactly four physical lines belonging to the region");
    assertEqual(region.supportingAlignmentKeys.length >= 2, true, `expected at least two recurring alignments sustaining the region, got ${region.supportingAlignmentKeys.length}`);
    assertEqual(page.alignments.length >= 2, true, `expected at least two recurring alignments observed on the page, got ${page.alignments.length}`);

    assertEqual(page.lineDispositions.length, 4, "expected exactly four physical lines on this page");
    assertEqual(
      page.lineDispositions.every((disposition) => disposition.status === "included_in_candidate_region"),
      true,
      `expected every physical line to be included in the candidate region, got ${JSON.stringify(page.lineDispositions)}`,
    );
    assertEqual(
      page.lineDispositions.every((disposition) => disposition.status !== "included_in_candidate_region" || disposition.regionKey === region.regionKey),
      true,
      "every included line must reference the one confirmed region",
    );

    assertEqual(page.metrics.totalLineCount, 4);
    assertEqual(page.metrics.includedInCandidateRegionLineCount, 4);
    assertEqual(page.metrics.notInTabularRegionLineCount, 0);
    assertEqual(page.metrics.unresolvedAmbiguityLineCount, 0);
    assertEqual(page.metrics.unresolvedDetectionFailedLineCount, 0);
    assertEqual(page.metrics.regionCount, 1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
