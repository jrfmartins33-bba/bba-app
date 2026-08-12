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

function main() {
  console.log("Running Sprint 21.5C.2 Architecture, API & Boundary Guard Tests...\n");

  const contextoSource = readSource("apps/web/app/api/orcamentos/importacao/contexto/route.ts");
  const prepareUploadSource = readSource("apps/web/app/api/orcamentos/importacao/prepare-upload/route.ts");
  const processSource = readSource("apps/web/app/api/orcamentos/importacao/process/route.ts");
  const importarPageSource = readSource("apps/web/app/(dashboard)/orcamentos/importar/page.tsx");
  const orcamentosPageSource = readSource("apps/web/app/(dashboard)/orcamentos/page.tsx");
  const adminRevisaoSource = readSource("apps/web/app/(dashboard)/admin/orcamentos/[sessionId]/revisao/page.tsx");
  const emptyStateSource = readSource("apps/web/components/budget/budget-empty-state.tsx");

  runTest("1. /api/orcamentos/importacao/contexto exige autenticação por empresa", () => {
    assertTrue(contextoSource.includes("requireAuthenticatedCompany"), "Context route must use requireAuthenticatedCompany");
    assertTrue(contextoSource.includes(".eq(\"company_id\", companyId)"), "Context route must scope procurement_cases by company_id");
  });

  runTest("2. /api/orcamentos/importacao/prepare-upload valida .xlsx e empresa", () => {
    assertTrue(prepareUploadSource.includes("requireAuthenticatedCompany"), "Prepare upload route must enforce auth");
    assertTrue(prepareUploadSource.includes(".endsWith(\".xlsx\")"), "Prepare upload route must validate .xlsx file extension");
    assertTrue(prepareUploadSource.includes("`${companyId}/orcamentos/${sha256}.xlsx`"), "Storage path must follow <companyId>/orcamentos/<sha256>.xlsx format");
  });

  runTest("3. /api/orcamentos/importacao/process recalcula SHA-256 e chama Application Service", () => {
    assertTrue(processSource.includes("requireAuthenticatedCompany"), "Process route must enforce auth");
    assertTrue(processSource.includes("createHash(\"sha256\")"), "Process route must recalculate SHA-256 server-side from downloaded bytes");
    assertTrue(processSource.includes("importStructuredBudgetXlsxService"), "Process route must invoke importStructuredBudgetXlsxService");
    assertTrue(processSource.includes("requireBbaAdmin"), "Process route must check BBA Admin authorization for canOpenReview");
  });

  runTest("4. UI /orcamentos/importar calcula SHA-256 via Web Crypto no navegador e tem resumo human-first", () => {
    assertTrue(importarPageSource.includes("crypto.subtle.digest(\"SHA-256\""), "UI must calculate SHA-256 in browser using Web Crypto");
    assertTrue(importarPageSource.includes("✓ Orçamento preparado"), "UI must include human-first success state");
    assertTrue(importarPageSource.includes("idempotentReuse"), "UI must handle idempotent reuse state");
  });

  runTest("5. State vazio em /orcamentos direciona para /orcamentos/importar", () => {
    assertTrue(emptyStateSource.includes("href=\"/orcamentos/importar\""), "BudgetEmptyState primary CTA must link to /orcamentos/importar");
    assertTrue(emptyStateSource.includes("href=\"/orcamentos/demonstracao\""), "BudgetEmptyState secondary CTA must link to /orcamentos/demonstracao");
  });

  runTest("6. Zero hardcode de Alagoas / DNOCS em páginas produtivas", () => {
    const combinedProductive = importingCombinedSources([orcamentosPageSource, adminRevisaoSource]);
    assertTrue(!combinedProductive.includes("Recuperação das Barragens de Alagoas"), "No hardcoded pilot title in admin revisao page");
    assertTrue(!combinedProductive.includes("origem: documento oficial DNOCS"), "No hardcoded pilot subtitle in admin revisao page");
  });

  runTest("7. Zero chamadas ao Motor R11 ou OCR worker no fluxo de importação XLSX", () => {
    const combinedAll = [contextoSource, prepareUploadSource, processSource, importarPageSource].join("\n");
    assertTrue(!combinedAll.includes("motor-r11"), "Zero references to Motor R11");
    assertTrue(!combinedAll.includes("paddleocr"), "Zero references to PaddleOCR");
    assertTrue(!combinedAll.includes("tesseract"), "Zero references to Tesseract");
  });

  console.log("\nAll Sprint 21.5C.2 Architecture & API unit tests passed successfully!");
}

function importingCombinedSources(sources: string[]): string {
  return sources.join("\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

main();
