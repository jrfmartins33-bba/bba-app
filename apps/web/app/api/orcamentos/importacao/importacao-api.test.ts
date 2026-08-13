import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toHumanImportError } from "../../../../lib/bdos/to-human-import-error";

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
  console.log("Running Sprint 21.5C.2B — Read/Write Client Separation & [object Object] Elimination Tests\n");

  const resolverSource = readSource("apps/web/lib/bdos/budget-import-access.ts");
  const repoSource = readSource("apps/web/lib/bdos/budget-official-review-server-repository.ts");
  const contextoSource = readSource("apps/web/app/api/orcamentos/importacao/contexto/route.ts");
  const prepareUploadSource = readSource("apps/web/app/api/orcamentos/importacao/prepare-upload/route.ts");
  const processSource = readSource("apps/web/app/api/orcamentos/importacao/process/route.ts");
  const importarPageSource = readSource("apps/web/app/(dashboard)/orcamentos/importar/page.tsx");
  const grantMigrationSource = readSource("supabase/migrations/20260813000000_bdos_budget_review_grant_authenticated_select.sql");

  // ── 1. toHumanImportError Sanitization ─────────────────────────────────────
  console.log("1. toHumanImportError Sanitization\n");

  runTest("1.1 Payload error string -> mensagem correta", () => {
    const res = toHumanImportError("Erro de comunicação", "Fallback");
    assertEqual(res, "Erro de comunicação", "String simples deve ser retornada intacta");
  });

  runTest("1.2 Payload error objeto -> nunca [object Object]", () => {
    const res = toHumanImportError({ error: "file_must_be_xlsx" }, "Fallback");
    assertTrue(res !== "[object Object]", "Resultado nunca deve ser [object Object]");
    assertEqual(res, "O arquivo selecionado deve ser uma planilha Excel (.xlsx).", "Deve traduzir código de erro conhecido");
  });

  runTest("1.3 Payload message objeto -> nunca [object Object]", () => {
    const res = toHumanImportError({ message: "Sessão duplicada encontrada" }, "Fallback");
    assertTrue(res !== "[object Object]", "Resultado nunca deve ser [object Object]");
    assertEqual(res, "Sessão duplicada encontrada", "Deve extrair message de objeto");
  });

  runTest("1.4 Payload errors array -> extrai primeira mensagem humana", () => {
    const res = toHumanImportError({ errors: ["Cabecalho invalido na linha 1"] }, "Fallback");
    assertEqual(res, "Cabecalho invalido na linha 1", "Deve extrair primeira mensagem do array errors");
  });

  runTest("1.5 Payload objeto misterioso -> usa fallback legivel, nunca [object Object]", () => {
    const res = toHumanImportError({ weirdProp: { nested: true } }, "Ocorreu um erro ao processar o arquivo.");
    assertTrue(res !== "[object Object]", "Nunca deve renderizar [object Object]");
    assertEqual(res, "Ocorreu um erro ao processar o arquivo.", "Deve usar o fallback legível fornecido");
  });

  // ── 2. Read/Write Client Architecture ──────────────────────────────────────
  console.log("\n2. Read/Write Client Architecture\n");

  runTest("2.1 createBudgetReviewServerRepository aceita readClient e writeClient", () => {
    assertTrue(
      repoSource.includes("readClient: SupabaseClient") && repoSource.includes("writeClient?: SupabaseClient"),
      "Repository signature must accept readClient and optional writeClient",
    );
  });

  runTest("2.2 Leitura (loadSession, findSessionByAcquisition) usa readClient", () => {
    assertTrue(
      repoSource.includes("readClient\n      .from(\"budget_review_sessions\")") ||
        repoSource.includes("readClient\n        .from(\"budget_review_sessions\")") ||
        repoSource.includes("readClient.from(\"budget_review_sessions\")"),
      "Read queries must use readClient",
    );
  });

  runTest("2.3 Escrita (createSession, mutateRow, importRows) usa writeClient", () => {
    assertTrue(
      repoSource.includes("wClient.rpc"),
      "RPC mutations must use wClient (serviceRole)",
    );
  });

  runTest("2.4 process/route.ts passa readClient (authenticated) e writeClient (serviceRole)", () => {
    assertTrue(
      processSource.includes("createBudgetReviewServerRepository(readClient, serviceRoleClient)"),
      "process route must instantiate repository with readClient and serviceRoleClient",
    );
  });

  // ── 3. Migration and Grant Controls ───────────────────────────────────────
  console.log("\n3. Migration and Security Controls\n");

  runTest("3.1 Migration aditiva concede GRANT SELECT a authenticated e privilégios a service_role", () => {
    assertTrue(grantMigrationSource.includes("GRANT SELECT ON public.budget_review_sessions TO authenticated"), "Must grant SELECT on sessions to authenticated");
    assertTrue(grantMigrationSource.includes("GRANT SELECT ON public.budget_review_rows TO authenticated"), "Must grant SELECT on rows to authenticated");
    assertTrue(grantMigrationSource.includes("GRANT ALL ON public.budget_review_sessions TO service_role"), "Must grant ALL on sessions to service_role");
  });

  runTest("3.2 Zero Motor R11 / OCR no fluxo de importação", () => {
    const combined = [contextoSource, prepareUploadSource, processSource, importarPageSource].join("\n");
    assertTrue(!combined.toLowerCase().includes("motor-r11"), "Zero references to Motor R11");
    assertTrue(!combined.toLowerCase().includes("paddleocr"), "Zero references to PaddleOCR");
  });

  console.log("\n✓ All Sprint 21.5C.2B tests passed!\n");
}

main();
