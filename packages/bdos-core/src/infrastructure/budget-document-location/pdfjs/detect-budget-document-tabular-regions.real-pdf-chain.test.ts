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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
