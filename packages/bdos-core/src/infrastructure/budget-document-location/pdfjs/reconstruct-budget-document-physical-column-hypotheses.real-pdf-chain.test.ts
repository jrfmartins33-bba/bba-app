import { pdfjsPhysicalDocumentReader, PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION } from "./pdfjs-physical-document-reader";
import { buildSyntheticPdfBytes } from "./testing/synthetic-pdf-bytes";
import {
  observeDocumentSignals,
  locateBudgetDocumentPages,
  reconstructBudgetDocumentStructure,
  detectBudgetDocumentTabularRegions,
  reconstructBudgetDocumentPhysicalColumnHypotheses,
} from "../../../domain/budget-document-location";
import type { BudgetDocumentPhysicalColumnHypothesisReconstructionResult } from "../../../domain/budget-document-location";

/**
 * Prova real da cadeia completa até a reconstrução de hipóteses de coluna
 * física (Sprint 21.4A.2.f.2b) — mesmo padrão de
 * `detect-budget-document-tabular-regions.real-pdf-chain.test.ts` (Sprint
 * 21.4A.2.f.2a). Bytes de PDF sintéticos (nunca um documento real, nunca
 * `_local-documents`) lidos pelo adaptador `pdfjsPhysicalDocumentReader`
 * real, encadeados com o observador, o localizador, o reconstrutor
 * estrutural, o detector de regiões e o reconstrutor de hipóteses de
 * coluna física reais — todos consumidos apenas pelo barrel público do
 * domínio.
 *
 * A fixture usa item de serviço + menção a "BDI" (mesma lição da
 * auditoria pós-revisão da f.2a): sozinho, o sinal de item de serviço
 * produz `classification: "ambiguous"` no localizador real e nenhum grupo
 * candidato é formado. O item "BDI" é posicionado na mesma linha física
 * da primeira fileira (nunca uma quinta linha), completando o par de
 * sinais exigido por `candidate-service-item-and-bdi-v1`.
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

const FOUR_ROW_TABULAR_PDF_WITH_BDI_BYTES = buildSyntheticPdfBytes([
  {
    items: [...[0, 1, 2, 3].flatMap((row) => twoColumnRow(row, 700)), { text: "BDI", x: 500, y: 700, fontSize: ROW_HEIGHT }],
  },
]);

async function runRealPdfChain(bytes: Uint8Array): Promise<{
  physicalRead: Awaited<ReturnType<typeof pdfjsPhysicalDocumentReader.read>>;
  hypotheses: BudgetDocumentPhysicalColumnHypothesisReconstructionResult;
}> {
  const physicalRead = await pdfjsPhysicalDocumentReader.read(bytes);
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const structureReconstruction = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  const tabularRegionDetection = detectBudgetDocumentTabularRegions({ structureReconstruction });
  const hypotheses = reconstructBudgetDocumentPhysicalColumnHypotheses({ structureReconstruction, tabularRegionDetection });
  return { physicalRead, hypotheses };
}

async function main(): Promise<void> {
  await runTest("real PDF bytes -> reader -> observer -> locator -> reconstructor -> detector -> reconstructBudgetDocumentPhysicalColumnHypotheses produces a real adapter identity", async () => {
    const { physicalRead } = await runRealPdfChain(FOUR_ROW_TABULAR_PDF_WITH_BDI_BYTES.slice());
    assertEqual(physicalRead.status, "completed");
    assertEqual(physicalRead.adapterVersion, PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION);
  });

  await runTest("real PDF chain: a genuine two-column tabular block (service item + BDI signal) is positively reconstructed as two physical column hypotheses with all eight segments included", async () => {
    const { hypotheses } = await runRealPdfChain(FOUR_ROW_TABULAR_PDF_WITH_BDI_BYTES.slice());

    assertEqual(hypotheses.status, "completed", `expected a clean completion, got ${hypotheses.status}. technicalProblems: ${JSON.stringify(hypotheses.technicalProblems)}`);
    assertEqual(hypotheses.technicalProblems.length, 0);

    assertEqual(hypotheses.groups.length, 1, "expected exactly one processed group");
    const group = hypotheses.groups[0];
    assertEqual(group.status, "hypotheses_reconstructed");
    assertEqual(group.pages.length, 1);

    const page = group.pages[0];
    assertEqual(page.status, "hypotheses_reconstructed");
    assertEqual(page.regions.length, 1, "expected exactly one processed region");

    const region = page.regions[0];
    assertEqual(region.status, "hypotheses_reconstructed");
    assertEqual(region.technicalProblems.length, 0);

    assertEqual(region.hypotheses.length, 2, "expected exactly two physical column hypotheses (left column, right column)");
    region.hypotheses.forEach((hypothesis) => {
      assertEqual(hypothesis.lineKeys.length, 4, "each hypothesis spans all four physical lines");
      assertEqual(hypothesis.contributingAlignmentKeys.length >= 1, true, "each hypothesis is sustained by at least one recurring alignment");
    });

    // Nine segments, not eight: a real "BDI" item was merged onto the same physical line as row 0 (§ documentação
    // desta Sprint) to satisfy the real page locator's candidate-classification signal pair — it becomes a ninth,
    // never-recurring segment on that line, correctly preserved as an orphan (never absorbed, never discarded).
    assertEqual(region.metrics.totalSegmentCount, 9);
    assertEqual(region.metrics.includedSegmentCount, 8, "the eight table-column segments are included in the two hypotheses");
    assertEqual(region.metrics.notIncludedSegmentCount, 1, "the BDI segment is preserved as an orphan, never absorbed by proximity or contention");
    assertEqual(region.metrics.ambiguousSegmentCount, 0);
    assertEqual(region.metrics.detectionFailedSegmentCount, 0);
    assertEqual(region.metrics.hypothesisCount, 2);

    const includedCount = region.segmentDispositions.filter((d) => d.status === "included_in_physical_column_hypothesis").length;
    const notIncludedCount = region.segmentDispositions.filter((d) => d.status === "not_in_physical_column_hypothesis").length;
    assertEqual(includedCount, 8);
    assertEqual(notIncludedCount, 1);
  });

  await runTest("real PDF chain: preserves every source identity from both consumed contracts through to the result", async () => {
    const { hypotheses } = await runRealPdfChain(FOUR_ROW_TABULAR_PDF_WITH_BDI_BYTES.slice());
    assertEqual(hypotheses.sourceByteHash.length, 64);
    assertEqual(hypotheses.sourceStructureReconstructorName, "budget-document-structure-reconstructor");
    assertEqual(hypotheses.sourceTabularRegionDetectorName, "budget-document-tabular-region-detector");
  });

  await runTest("real PDF chain: two independent readings of independently-copied bytes produce a JSON-equivalent result", async () => {
    const firstBytesCopy = FOUR_ROW_TABULAR_PDF_WITH_BDI_BYTES.slice();
    const secondBytesCopy = FOUR_ROW_TABULAR_PDF_WITH_BDI_BYTES.slice();
    assertEqual(firstBytesCopy === secondBytesCopy, false, "test setup: the two byte buffers must be independent instances, not the same reference");

    const first = await runRealPdfChain(firstBytesCopy);
    const second = await runRealPdfChain(secondBytesCopy);

    assertEqual(JSON.stringify(first.hypotheses), JSON.stringify(second.hypotheses));
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
