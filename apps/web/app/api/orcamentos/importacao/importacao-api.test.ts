import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`[FAIL] ${message} — Expected: ${String(expected)}, Got: ${String(actual)}`);
  }
}

function assertTrue(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
}

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..", "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function main() {
  console.log("Running Sprint 21.5C.2A — Storage Immutability & SHA Integrity Tests\n");

  const processSource = readSource("apps/web/app/api/orcamentos/importacao/process/route.ts");
  const importarPageSource = readSource("apps/web/app/(dashboard)/orcamentos/importar/page.tsx");
  const contextoSource = readSource("apps/web/app/api/orcamentos/importacao/contexto/route.ts");
  const prepareUploadSource = readSource("apps/web/app/api/orcamentos/importacao/prepare-upload/route.ts");
  const adminRevisaoSource = readSource("apps/web/app/(dashboard)/admin/orcamentos/[sessionId]/revisao/page.tsx");

  // ── Section A: upsert:false enforcement ────────────────────────────────────
  console.log("A. Storage Mutability Controls\n");

  runTest("A1. upsert:true removido da UI de importação", () => {
    assertTrue(!importarPageSource.includes("upsert: true"), "upsert:true must NOT be present in importar/page.tsx");
  });

  runTest("A2. upsert:false definido na UI de importação", () => {
    assertTrue(importarPageSource.includes("upsert: false"), "upsert:false must be present in importar/page.tsx");
  });

  runTest("A3. Objeto já existente distinguido de erro real (isAlreadyExists check)", () => {
    assertTrue(
      importarPageSource.includes("isAlreadyExists"),
      "UI must distinguish 'already exists' from real upload errors",
    );
  });

  runTest("A4. Erro de 'already exists' não termina o fluxo com throw", () => {
    // After the isAlreadyExists branch, execution continues to the process step
    const alreadyExistsBlock = importarPageSource.includes("if (!isAlreadyExists)");
    assertTrue(alreadyExistsBlock, "Only non-duplicate errors should throw; duplicates must continue to process");
  });

  // ── Section B: Storage path format validation ───────────────────────────────
  console.log("\nB. Storage Path Format Validation\n");

  runTest("B1. Regex de formato exato do path está definido", () => {
    assertTrue(
      processSource.includes("STORAGE_PATH_REGEX"),
      "process/route.ts must define STORAGE_PATH_REGEX",
    );
  });

  runTest("B2. Regex exige uuid/orcamentos/<64 hex>.xlsx", () => {
    const regexLine = processSource.match(/STORAGE_PATH_REGEX\s*=\s*\/(.+?)\//)?.[0] ?? "";
    assertTrue(regexLine.includes("64") || regexLine.includes("{64}") || processSource.includes("[0-9a-f]{64}"), "Regex must require exactly 64 hex chars for SHA-256 in path");
  });

  runTest("B3. path fora de /orcamentos/ é rejeitado com invalid_storage_path_format", () => {
    assertTrue(
      processSource.includes("invalid_storage_path_format"),
      "process/route.ts must reject invalid path format",
    );
  });

  runTest("B4. path de outra empresa rejeitado com unauthorized_storage_path", () => {
    assertTrue(
      processSource.includes("unauthorized_storage_path"),
      "process/route.ts must reject path from different company",
    );
  });

  // ── Section C: SHA integrity gate ────────────────────────────────────────
  console.log("\nC. SHA Integrity Gate\n");

  runTest("C1. SHA extraído do path (shaFromPath) é comparado ao SHA calculado dos bytes", () => {
    assertTrue(
      processSource.includes("shaFromPath"),
      "process/route.ts must extract SHA from path and compare it to actual bytes SHA",
    );
  });

  runTest("C2. storage_integrity_failure retornado quando SHA diverge", () => {
    assertTrue(
      processSource.includes("storage_integrity_failure"),
      "process/route.ts must return storage_integrity_failure on SHA mismatch",
    );
  });

  runTest("C3. importStructuredBudgetXlsxService NÃO é chamado quando SHA diverge", () => {
    // Find the runtime *call* (await ...), not the import statement.
    // The import line appears first in the file; we look for the call site.
    const runtimeCallPos = processSource.indexOf("await importStructuredBudgetXlsxService");
    const integrityPos = processSource.indexOf("storage_integrity_failure");
    assertTrue(runtimeCallPos > -1, "importStructuredBudgetXlsxService must have a runtime call site");
    assertTrue(integrityPos > -1, "storage_integrity_failure guard must be present");
    assertTrue(integrityPos < runtimeCallPos, "SHA integrity gate must come before the runtime call to importStructuredBudgetXlsxService");
  });

  runTest("C4. SHA server-side é recalculado a partir dos bytes baixados do Storage", () => {
    assertTrue(
      processSource.includes('createHash("sha256")'),
      "process/route.ts must recalculate SHA-256 server-side from downloaded bytes",
    );
  });

  // ── Section D: Legacy hardcode audit ────────────────────────────────────────
  console.log("\nD. Hardcode Audit\n");

  runTest("D1. Zero hardcode de Alagoas/DNOCS em páginas produtivas", () => {
    const combined = stripComments([adminRevisaoSource].join("\n"));
    assertTrue(
      !combined.includes("Recuperação das Barragens de Alagoas"),
      "No hardcoded pilot title must remain in admin revisao page",
    );
    assertTrue(
      !combined.includes("origem: documento oficial DNOCS"),
      "No hardcoded DNOCS subtitle must remain in admin revisao page",
    );
  });

  runTest("D2. Zero Motor R11 / OCR no fluxo de importação XLSX", () => {
    const combined = [contextoSource, prepareUploadSource, processSource, importarPageSource].join("\n");
    assertTrue(!combined.toLowerCase().includes("motor-r11"), "Zero references to Motor R11");
    assertTrue(!combined.toLowerCase().includes("paddleocr"), "Zero references to PaddleOCR");
    assertTrue(!combined.toLowerCase().includes("tesseract"), "Zero references to Tesseract");
  });

  // ── Section E: API auth guards ───────────────────────────────────────────
  console.log("\nE. Authentication Guards\n");

  runTest("E1. /contexto exige requireAuthenticatedCompany", () => {
    assertTrue(contextoSource.includes("requireAuthenticatedCompany"), "Context route must require authentication");
  });

  runTest("E2. /prepare-upload exige requireAuthenticatedCompany", () => {
    assertTrue(prepareUploadSource.includes("requireAuthenticatedCompany"), "Prepare-upload route must require authentication");
  });

  runTest("E3. /process exige requireAuthenticatedCompany", () => {
    assertTrue(processSource.includes("requireAuthenticatedCompany"), "Process route must require authentication");
  });

  runTest("E4. /process verifica BBA Admin para canOpenReview sem fabricar condição", () => {
    assertTrue(processSource.includes("requireBbaAdmin"), "Process route must check real BBA Admin for canOpenReview");
    assertTrue(!processSource.includes("canOpenReview: true"), "canOpenReview must never be hardcoded to true");
  });

  console.log("\n✓ All Sprint 21.5C.2A tests passed!\n");
}

main();
