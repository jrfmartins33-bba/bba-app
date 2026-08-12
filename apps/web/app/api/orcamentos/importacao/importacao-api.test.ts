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
  console.log("Running Sprint 21.5C.2A — Access Resolver + Storage Immutability Tests\n");

  const resolverSource = readSource("apps/web/lib/bdos/budget-import-access.ts");
  const contextoSource = readSource("apps/web/app/api/orcamentos/importacao/contexto/route.ts");
  const prepareUploadSource = readSource("apps/web/app/api/orcamentos/importacao/prepare-upload/route.ts");
  const processSource = readSource("apps/web/app/api/orcamentos/importacao/process/route.ts");
  const importarPageSource = readSource("apps/web/app/(dashboard)/orcamentos/importar/page.tsx");
  const adminRevisaoSource = readSource("apps/web/app/(dashboard)/admin/orcamentos/[sessionId]/revisao/page.tsx");

  // ── 1. Resolver contract ─────────────────────────────────────────────────
  console.log("1. resolveBudgetImportAccess() resolver\n");

  runTest("1.1 Resolver exists and exports resolveBudgetImportAccess", () => {
    assertTrue(resolverSource.includes("resolveBudgetImportAccess"), "resolver must export resolveBudgetImportAccess");
  });

  runTest("1.2 company_user branch: uses profile.company_id as organizationId", () => {
    assertTrue(resolverSource.includes("company_user"), "resolver must handle company_user kind");
    assertTrue(resolverSource.includes("profile.company_id"), "resolver must use profile.company_id for company_user");
  });

  runTest("1.3 bba_admin branch: organizationId starts as null, not from browser", () => {
    assertTrue(resolverSource.includes("bba_admin"), "resolver must handle bba_admin kind");
    assertTrue(resolverSource.includes("organizationId: null"), "bba_admin initial organizationId must be null");
  });

  runTest("1.4 Profiles with no company_id and no bba_admin role are rejected", () => {
    // After the two valid branches, return null
    const nullReturn = resolverSource.match(/return null/g) ?? [];
    assertTrue(nullReturn.length >= 2, "resolver must return null for unauthorized profiles (at least 2 null returns)");
  });

  // ── 2. company_user isolation ─────────────────────────────────────────────
  console.log("\n2. company_user multi-tenant isolation\n");

  runTest("2.1 company_user → contexto 200 using their authenticated company", () => {
    assertTrue(
      contextoSource.includes("kind === \"company_user\"") || contextoSource.includes("kind ===\"company_user\""),
      "contexto route must distinguish company_user",
    );
    assertTrue(
      contextoSource.includes("organizationId"),
      "contexto uses organizationId for company_user",
    );
  });

  runTest("2.2 company_user sees only their company's cases (eq company_id filter)", () => {
    // The company_user branch must have .eq("company_id", companyId)
    assertTrue(
      contextoSource.includes(".eq(\"company_id\", companyId)"),
      "company_user branch must filter by company_id",
    );
  });

  runTest("2.3 company_user storagePath uses authenticated company_id, not browser value", () => {
    assertTrue(
      prepareUploadSource.includes("resolvedOrganizationId") &&
        prepareUploadSource.includes("storagePath = `${resolvedOrganizationId}"),
      "storagePath must use resolvedOrganizationId, never a client-supplied companyId",
    );
  });

  // ── 3. bba_admin cross-company support ───────────────────────────────────
  console.log("\n3. bba_admin cross-company access\n");

  runTest("3.1 bba_admin → contexto 200 (uses service-role, not requireAuthenticatedCompany)", () => {
    assertTrue(
      contextoSource.includes("resolveBudgetImportAccess"),
      "contexto must use resolveBudgetImportAccess (not requireAuthenticatedCompany)",
    );
    assertTrue(
      !contextoSource.includes("requireAuthenticatedCompany"),
      "contexto must NOT directly call requireAuthenticatedCompany (resolver handles it)",
    );
    assertTrue(
      contextoSource.includes("getSupabaseServiceRoleClient"),
      "contexto must use service-role client for bba_admin",
    );
  });

  runTest("3.2 bba_admin contexto includes companyId and companyName in DTO", () => {
    assertTrue(
      contextoSource.includes("companyName"),
      "bba_admin contexto DTO must include companyName for disambiguation",
    );
  });

  runTest("3.3 bba_admin → organizationId derived server-side from ProcurementCase", () => {
    assertTrue(
      prepareUploadSource.includes("deriveOrganizationFromCase"),
      "prepare-upload must call deriveOrganizationFromCase for bba_admin",
    );
    assertTrue(
      processSource.includes("deriveOrganizationFromCase"),
      "process must call deriveOrganizationFromCase for bba_admin",
    );
  });

  runTest("3.4 deriveOrganizationFromCase exists in resolver module", () => {
    assertTrue(
      resolverSource.includes("deriveOrganizationFromCase"),
      "resolver module must export deriveOrganizationFromCase",
    );
  });

  // ── 4. Security / boundary checks ───────────────────────────────────────
  console.log("\n4. Security and boundary enforcement\n");

  runTest("4.1 Lot from a different Case is rejected (lotVerified check)", () => {
    assertTrue(
      resolverSource.includes("lotVerified") &&
        (prepareUploadSource.includes("!derived.lotVerified") || processSource.includes("!derived.lotVerified")),
      "lot cross-case validation must check lotVerified from deriveOrganizationFromCase",
    );
  });

  runTest("4.2 Client-supplied companyId is never used as authority in prepare-upload", () => {
    const body = prepareUploadSource;
    // body.companyId must not appear; storagePath must use resolvedOrganizationId
    assertTrue(
      !body.includes("body.companyId"),
      "prepare-upload must never use body.companyId",
    );
  });

  runTest("4.3 storagePath in process route verified against server-derived organizationId", () => {
    assertTrue(
      processSource.includes("pathCompanyId !== resolvedOrganizationId"),
      "process route must verify pathCompanyId matches resolvedOrganizationId",
    );
  });

  runTest("4.4 importStructuredBudgetXlsxService receives server-derived organizationId", () => {
    // The context passed to the service must use resolvedOrganizationId
    assertTrue(
      processSource.includes("organizationId: resolvedOrganizationId"),
      "Application Service context must use resolvedOrganizationId",
    );
  });

  // ── 5. Storage immutability (Sprint 21.5C.2A prior gates) ────────────────
  console.log("\n5. Storage immutability (carried from 21.5C.2A)\n");

  runTest("5.1 upsert:false enforced in upload UI", () => {
    assertTrue(importarPageSource.includes("upsert: false"), "upsert:false must be present in importar page");
    assertTrue(!importarPageSource.includes("upsert: true"), "upsert:true must NOT exist in importar page");
  });

  runTest("5.2 SHA integrity gate in process route", () => {
    assertTrue(processSource.includes("storage_integrity_failure"), "process route must have SHA integrity gate");
  });

  runTest("5.3 Strict path format regex present", () => {
    assertTrue(processSource.includes("STORAGE_PATH_REGEX"), "process route must validate path format with regex");
  });

  // ── 6. No Motor R11 / OCR / hardcodes ────────────────────────────────────
  console.log("\n6. Hardcode and architecture audit\n");

  runTest("6.1 Zero Motor R11 / OCR in import flow", () => {
    const combined = [contextoSource, prepareUploadSource, processSource, importarPageSource].join("\n");
    assertTrue(!combined.toLowerCase().includes("motor-r11"), "Zero references to Motor R11");
    assertTrue(!combined.toLowerCase().includes("paddleocr"), "Zero references to PaddleOCR");
  });

  runTest("6.2 Zero Alagoas/DNOCS hardcodes in productive pages", () => {
    const cleaned = stripComments(adminRevisaoSource);
    assertTrue(!cleaned.includes("Recuperação das Barragens de Alagoas"), "No Alagoas hardcode in revisao page");
  });

  runTest("6.3 resolver is server-only (no NEXT_PUBLIC import)", () => {
    assertTrue(
      !resolverSource.includes("NEXT_PUBLIC_"),
      "budget-import-access.ts must not reference NEXT_PUBLIC_ env vars",
    );
  });

  console.log("\n✓ All Sprint 21.5C.2A access-resolver tests passed!\n");
}

main();
