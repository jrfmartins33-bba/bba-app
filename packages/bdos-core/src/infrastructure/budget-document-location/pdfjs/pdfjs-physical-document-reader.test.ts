import { createHash } from "node:crypto";
import { pdfjsPhysicalDocumentReader, PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION } from "./pdfjs-physical-document-reader";
import { buildSyntheticPdfBytes, buildSyntheticPdfBytesWithBrokenPage } from "./testing/synthetic-pdf-bytes";
import type { PhysicalDocumentReadResult } from "../../../domain/budget-document-location";

async function runTest(name: string, testCase: () => Promise<void>): Promise<void> {
  await testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(actual: boolean, message: string): void {
  if (!actual) {
    throw new Error(message);
  }
}

function stableFieldsOf(result: PhysicalDocumentReadResult): unknown {
  // Everything in this contract is documented as deterministic (Sprint
  // 21.4A.2.c, section 29) — there is no field excluded from repeatability.
  return result;
}

async function main(): Promise<void> {
  // 1. PDF válido com uma página e texto.
  await runTest("case 1: valid single-page PDF with text produces text_available", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: "AB" }]);
    const result = await pdfjsPhysicalDocumentReader.read(bytes);
    assertEqual(result.status, "completed");
    assertEqual(result.totalPageCount, 1);
    assertEqual(result.pages[0].extractionAvailability, "text_available");
    assertEqual(result.pages[0].textItems.length > 0, true);
  });

  // 2. PDF válido com múltiplas páginas.
  await runTest("case 2: valid multi-page PDF is read in full", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: "P1" }, { text: "P2" }, { text: "P3" }]);
    const result = await pdfjsPhysicalDocumentReader.read(bytes);
    assertEqual(result.status, "completed");
    assertEqual(result.totalPageCount, 3);
    assertEqual(result.pages.length, 3);
  });

  // 3. Preservação da ordem física.
  await runTest("case 3: pages are returned in physical order, matching their own content", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: "First" }, { text: "Second" }, { text: "Third" }]);
    const result = await pdfjsPhysicalDocumentReader.read(bytes);
    assertEqual(result.pages[0].textItems[0]?.text, "First");
    assertEqual(result.pages[1].textItems[0]?.text, "Second");
    assertEqual(result.pages[2].textItems[0]?.text, "Third");
  });

  // 4. Numeração física iniciada em 1.
  await runTest("case 4: physical page numbering starts at 1", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: "P1" }, { text: "P2" }]);
    const result = await pdfjsPhysicalDocumentReader.read(bytes);
    assertEqual(result.pages[0].pageNumber, 1);
    assertEqual(result.pages[1].pageNumber, 2);
  });

  // 5. Página em retrato.
  await runTest("case 5: an unrotated page is portrait", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: "Portrait" }]);
    const result = await pdfjsPhysicalDocumentReader.read(bytes);
    assertEqual(result.pages[0].orientation, "portrait");
    assertEqual(result.pages[0].widthPoints, 612);
    assertEqual(result.pages[0].heightPoints, 792);
  });

  // 6. Página em paisagem.
  await runTest("case 6: a page rotated 90 degrees is landscape, with effective dimensions already swapped", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: "Landscape", rotateDegrees: 90 }]);
    const result = await pdfjsPhysicalDocumentReader.read(bytes);
    assertEqual(result.pages[0].orientation, "landscape");
    assertEqual(result.pages[0].widthPoints, 792);
    assertEqual(result.pages[0].heightPoints, 612);
    assertEqual(result.pages[0].rotationDegrees, 90);
  });

  // 7. Documento com página sem texto extraível (não é falha).
  await runTest("case 7: a page with an empty content stream has no_extractable_text and no problems", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: null }]);
    const result = await pdfjsPhysicalDocumentReader.read(bytes);
    assertEqual(result.status, "completed");
    assertEqual(result.pages[0].extractionAvailability, "no_extractable_text");
    assertEqual(result.pages[0].textItems.length, 0);
    assertEqual(result.pages[0].technicalProblems.length, 0);
  });

  // 8. Bytes inválidos.
  await runTest("case 8: invalid (garbage) bytes produce a failed document-level result", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 255, 254, 0, 9, 8]);
    const result = await pdfjsPhysicalDocumentReader.read(bytes);
    assertEqual(result.status, "failed");
    assertEqual(result.totalPageCount, 0);
    assertEqual(result.pages.length, 0);
    assertEqual(result.technicalProblems.length, 1);
    assertEqual(result.technicalProblems[0].code, "document_invalid_structure");
    assertEqual(result.technicalProblems[0].level, "document");
    assertEqual(result.technicalProblems[0].pageNumber, null);
    assertTrue(result.underlyingLibraryVersion !== null, "expected underlyingLibraryVersion to be populated once pdfjs-dist was loaded");
  });

  // 9. Bytes vazios.
  await runTest("case 9: empty bytes produce a failed document-level result without loading pdfjs-dist", async () => {
    const result = await pdfjsPhysicalDocumentReader.read(new Uint8Array(0));
    assertEqual(result.status, "failed");
    assertEqual(result.technicalProblems[0].code, "document_bytes_empty");
    assertEqual(result.underlyingLibraryVersion, null);
  });

  // 10. Hash SHA-256 estável.
  await runTest("case 10: sourceByteHash is the SHA-256 of the original bytes, unmodified", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: "Hash me" }]);
    const expectedHash = createHash("sha256").update(bytes).digest("hex");
    const first = await pdfjsPhysicalDocumentReader.read(bytes);
    const second = await pdfjsPhysicalDocumentReader.read(bytes);
    assertEqual(first.sourceByteHash, expectedHash);
    assertEqual(second.sourceByteHash, expectedHash);
  });

  // 11. Ordem estável dos itens textuais.
  await runTest("case 11: text item indices are stable, 0-based and in extraction order across two reads", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: "Alpha Beta Gamma" }]);
    const first = await pdfjsPhysicalDocumentReader.read(bytes);
    const second = await pdfjsPhysicalDocumentReader.read(bytes);
    const firstItems = first.pages[0].textItems;
    const secondItems = second.pages[0].textItems;
    assertEqual(firstItems[0]?.index, 0);
    assertEqual(JSON.stringify(firstItems), JSON.stringify(secondItems));
  });

  // 12. Normalização repetível.
  await runTest("case 12: normalizedText is repeatable across two reads of the same bytes", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: "Repeat me" }]);
    const first = await pdfjsPhysicalDocumentReader.read(bytes);
    const second = await pdfjsPhysicalDocumentReader.read(bytes);
    assertEqual(first.pages[0].normalizedText, second.pages[0].normalizedText);
  });

  // 13. Duas leituras dos mesmos bytes produzem o mesmo resultado estável (todos os campos).
  await runTest("case 13: two reads of the same bytes produce an equivalent stable result across every field", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: "Stable" }, { text: null }, { text: "Third", rotateDegrees: 180 }]);
    const first = await pdfjsPhysicalDocumentReader.read(bytes);
    const second = await pdfjsPhysicalDocumentReader.read(bytes);
    assertEqual(JSON.stringify(stableFieldsOf(first)), JSON.stringify(stableFieldsOf(second)));
  });

  // 14. Disponibilidade distinta de qualidade (a ausência de texto não carrega juízo de qualidade).
  await runTest("case 14: no_extractable_text carries no quality-like field, only the availability and empty metrics", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: null }]);
    const result = await pdfjsPhysicalDocumentReader.read(bytes);
    const page = result.pages[0];
    assertEqual(page.extractionAvailability, "no_extractable_text");
    assertEqual(page.metrics.textItemCount, 0);
    assertEqual(Object.keys(page).sort().join(","), [
      "extractionAvailability",
      "heightPoints",
      "metrics",
      "normalizedText",
      "orientation",
      "pageNumber",
      "rotationDegrees",
      "technicalProblems",
      "textItems",
      "widthPoints",
    ].sort().join(","));
  });

  // 15. Erro distinto de ausência de texto.
  await runTest("case 15: an isolated page load failure is extraction_failed with a problem, not no_extractable_text", async () => {
    const bytes = buildSyntheticPdfBytesWithBrokenPage(2, 2);
    const result = await pdfjsPhysicalDocumentReader.read(bytes);
    assertEqual(result.status, "completed_with_page_failures");
    assertEqual(result.pages[0].extractionAvailability, "text_available");
    assertEqual(result.pages[0].technicalProblems.length, 0);
    assertEqual(result.pages[1].extractionAvailability, "extraction_failed");
    assertEqual(result.pages[1].technicalProblems.length, 1);
    assertEqual(result.pages[1].technicalProblems[0].code, "page_load_failed");
    assertEqual(result.pages[1].technicalProblems[0].pageNumber, 2);
  });

  // 16. Ausência de decisão documental no resultado (verificação leve local; a proteção
  // estrutural completa vive em architecture/physical-document-read-no-decision-boundaries.test.ts).
  await runTest("case 16: the result never carries a candidate/score/threshold-shaped key", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: "No decision here" }]);
    const result = await pdfjsPhysicalDocumentReader.read(bytes);
    const serialized = JSON.stringify(result).toLowerCase();
    ["candidate", "score", "threshold", "confidence", "isbudget", "classification"].forEach((forbidden) => {
      assertEqual(serialized.includes(forbidden), false, `result must not mention "${forbidden}"`);
    });
  });

  // 17. Problemas técnicos com códigos controlados.
  await runTest("case 17: technical problems always carry one of the controlled stable codes", async () => {
    const bytes = buildSyntheticPdfBytesWithBrokenPage(2, 1);
    const result = await pdfjsPhysicalDocumentReader.read(bytes);
    const allProblems = [...result.technicalProblems, ...result.pages.flatMap((page) => page.technicalProblems)];
    const knownCodes = new Set([
      "document_bytes_empty",
      "document_invalid_structure",
      "document_protected",
      "document_open_failed",
      "page_load_failed",
      "page_geometry_unavailable",
      "page_text_extraction_failed",
      "page_processing_failed",
    ]);
    allProblems.forEach((problem) => assertTrue(knownCodes.has(problem.code), `unexpected problem code "${problem.code}"`));
  });

  // 18. Ausência de stack trace no contrato.
  await runTest("case 18: no technical problem message contains a stack trace or file path", async () => {
    const invalid = await pdfjsPhysicalDocumentReader.read(new Uint8Array([9, 9, 9, 9]));
    const broken = await pdfjsPhysicalDocumentReader.read(buildSyntheticPdfBytesWithBrokenPage(1, 1));
    const allMessages = [
      ...invalid.technicalProblems.map((p) => p.message),
      ...broken.technicalProblems.map((p) => p.message),
      ...broken.pages.flatMap((page) => page.technicalProblems.map((p) => p.message)),
    ];
    assertTrue(allMessages.length > 0, "expected at least one technical problem message to inspect");
    allMessages.forEach((message) => {
      assertTrue(!message.includes("\n"), `message must not be multiline (stack trace-shaped): ${message}`);
      assertTrue(!message.includes("    at "), `message must not contain a stack trace frame: ${message}`);
      assertTrue(!/[a-zA-Z]:\\\\|\/Users\/|\/home\//.test(message), `message must not contain an absolute path: ${message}`);
    });
  });

  // 19. Versão do schema presente.
  await runTest("case 19: schemaVersion is present", async () => {
    const result = await pdfjsPhysicalDocumentReader.read(buildSyntheticPdfBytes([{ text: "x" }]));
    assertEqual(result.schemaVersion, 1);
  });

  // 20. Versões do leitor e do adaptador presentes.
  await runTest("case 20: readerName, readerVersion and adapterVersion are present", async () => {
    const result = await pdfjsPhysicalDocumentReader.read(buildSyntheticPdfBytes([{ text: "x" }]));
    assertEqual(result.readerName, "physical-document-reader");
    assertEqual(result.readerVersion, "physical-document-reader-v1");
    assertEqual(result.adapterVersion, PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION);
  });

  // 21. Largura e altura preservadas.
  await runTest("case 21: width and height are preserved from the page geometry", async () => {
    const result = await pdfjsPhysicalDocumentReader.read(buildSyntheticPdfBytes([{ text: "x" }]));
    assertEqual(result.pages[0].widthPoints, 612);
    assertEqual(result.pages[0].heightPoints, 792);
  });

  // 22. Contagens objetivas corretas.
  await runTest("case 22: metrics are wired from the actually extracted text items", async () => {
    const result = await pdfjsPhysicalDocumentReader.read(buildSyntheticPdfBytes([{ text: "AB" }]));
    const page = result.pages[0];
    assertEqual(page.metrics.textItemCount, page.textItems.length);
    assertEqual(page.metrics.nonEmptyCharacterCount, page.textItems.reduce((sum, item) => sum + item.text.replace(/\s/gu, "").length, 0));
  });

  // 23. Liberação de recursos (verificação comportamental: leituras sequenciais não degradam nem falham por estado vazado).
  await runTest("case 23: sequential reads do not fail or degrade, consistent with resources being released between reads", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: "Reuse" }]);
    for (let i = 0; i < 5; i++) {
      const result = await pdfjsPhysicalDocumentReader.read(bytes);
      assertEqual(result.status, "completed");
    }
  });

  // Casos adicionais de robustez, além do mínimo de 23.
  await runTest("extra: a truncated/corrupted PDF header is classified as invalid structure, not a crash", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4\n");
    const result = await pdfjsPhysicalDocumentReader.read(bytes);
    assertEqual(result.status, "failed");
    assertEqual(result.technicalProblems[0].code, "document_invalid_structure");
  });

  await runTest("extra: totalPageCount matches pages.length on success", async () => {
    const result = await pdfjsPhysicalDocumentReader.read(buildSyntheticPdfBytes([{ text: "a" }, { text: "b" }]));
    assertEqual(result.totalPageCount, result.pages.length);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
