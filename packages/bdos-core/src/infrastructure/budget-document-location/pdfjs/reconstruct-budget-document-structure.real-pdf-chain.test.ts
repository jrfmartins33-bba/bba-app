import { pdfjsPhysicalDocumentReader, PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION } from "./pdfjs-physical-document-reader";
import { buildSyntheticPdfBytes } from "./testing/synthetic-pdf-bytes";
import { observeDocumentSignals, locateBudgetDocumentPages, reconstructBudgetDocumentStructure } from "../../../domain/budget-document-location";
import type { BudgetDocumentStructureReconstructionResult } from "../../../domain/budget-document-location";

/**
 * Prova real da cadeia completa (auditoria pós-PR #69, §2): bytes de PDF
 * sintéticos (nunca um documento real, nunca `_local-documents`) lidos
 * pelo adaptador `pdfjsPhysicalDocumentReader` de verdade — o mesmo usado
 * em produção — encadeados com o observador, o localizador e o
 * reconstrutor reais, todos consumidos apenas pelo barrel público do
 * domínio. Vive no diretório do adaptador (não em `domain/`) porque é o
 * único lugar do pacote em que a direção de dependência já permitida
 * (adaptador → domínio) comporta importar tanto o leitor físico real
 * quanto o reconstrutor — nunca o inverso. Distinta de
 * `structure-reconstruction/reconstruct-budget-document-structure.test.ts`
 * (que usa `structure-reconstruction-test-bridge.ts`, uma ponte
 * exclusivamente de teste que nunca lê PDF nem carrega a biblioteca
 * concreta) — esta é a única prova de que o contrato produzido pelo
 * adaptador real atravessa o portão de compatibilidade e produz uma
 * reconstrução válida.
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

const TWO_PAGE_BUDGET_LIKE_PDF = buildSyntheticPdfBytes([
  {
    items: [
      { text: "1.1 Escavacao manual", x: 72, y: 700, fontSize: 18 },
      { text: "BDI", x: 72, y: 650, fontSize: 18 },
      { text: "1.2 Concreto armado", x: 72, y: 600, fontSize: 18 },
    ],
  },
  {
    items: [{ text: "Total Geral: 1000", x: 72, y: 700, fontSize: 18 }],
  },
]);

async function runRealPdfChain(bytes: Uint8Array): Promise<{
  physicalRead: Awaited<ReturnType<typeof pdfjsPhysicalDocumentReader.read>>;
  result: BudgetDocumentStructureReconstructionResult;
}> {
  const physicalRead = await pdfjsPhysicalDocumentReader.read(bytes);
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const result = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  return { physicalRead, result };
}

async function main(): Promise<void> {
  await runTest("real PDF bytes -> pdfjsPhysicalDocumentReader -> observeDocumentSignals -> locateBudgetDocumentPages -> reconstructBudgetDocumentStructure produces a real adapter identity", async () => {
    const { physicalRead } = await runRealPdfChain(TWO_PAGE_BUDGET_LIKE_PDF.slice());
    assertEqual(physicalRead.status, "completed");
    assertEqual(physicalRead.adapterVersion, PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION);
    assertEqual(physicalRead.underlyingLibraryVersion, "pdfjs-dist@6.1.200");
  });

  await runTest("real PDF chain: reconstruction accepts the real adapter's contract and completes, never source_contract_version_unsupported", async () => {
    const { result } = await runRealPdfChain(TWO_PAGE_BUDGET_LIKE_PDF.slice());
    assertEqual(result.status === "completed" || result.status === "completed_with_problems", true, `unexpected status: ${result.status}`);
    assertEqual(result.technicalProblems.some((p) => p.code === "source_contract_version_unsupported"), false);
  });

  await runTest("real PDF chain: produces at least one candidate group with real lines, segments and blocks", async () => {
    const { result } = await runRealPdfChain(TWO_PAGE_BUDGET_LIKE_PDF.slice());
    assertEqual(result.groups.length > 0, true, "expected the real PDF fixture to produce at least one candidate group");
    const totalLines = result.groups.reduce((sum, g) => sum + g.metrics.lineCount, 0);
    const totalSegments = result.groups.reduce((sum, g) => sum + g.metrics.segmentCount, 0);
    const totalBlocks = result.groups.reduce((sum, g) => sum + g.metrics.blockCount, 0);
    assertEqual(totalLines > 0, true, "expected at least one line reconstructed from real pdfjs-dist geometry");
    assertEqual(totalSegments > 0, true, "expected at least one segment reconstructed from real pdfjs-dist geometry");
    assertEqual(totalBlocks > 0, true, "expected at least one block reconstructed from real pdfjs-dist geometry");
  });

  await runTest("real PDF chain: preserves every physical and page-location identity through to the result", async () => {
    const { physicalRead, result } = await runRealPdfChain(TWO_PAGE_BUDGET_LIKE_PDF.slice());
    assertEqual(result.sourceByteHash, physicalRead.sourceByteHash);
    assertEqual(result.physicalReaderVersion, physicalRead.readerVersion);
    assertEqual(result.physicalAdapterVersion, physicalRead.adapterVersion);
    assertEqual(result.physicalUnderlyingLibraryVersion, physicalRead.underlyingLibraryVersion);
    assertEqual(result.physicalGeometryContextFingerprint, physicalRead.geometryContextFingerprint);
  });

  await runTest("real PDF chain: two independent readings of independently-copied bytes produce a JSON-equivalent result", async () => {
    const firstBytesCopy = TWO_PAGE_BUDGET_LIKE_PDF.slice();
    const secondBytesCopy = TWO_PAGE_BUDGET_LIKE_PDF.slice();
    assertEqual(firstBytesCopy === secondBytesCopy, false, "test setup: the two byte buffers must be independent instances, not the same reference");

    const first = await runRealPdfChain(firstBytesCopy);
    const second = await runRealPdfChain(secondBytesCopy);

    assertEqual(JSON.stringify(first.result), JSON.stringify(second.result));
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
