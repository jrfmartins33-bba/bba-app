import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMeasurementImportsListReader, handleListMeasurementImports } from "./measurement-imports-list-route-handler";
import { insertMeasurementBulletinImport } from "../../../../lib/bdos/measurement-repository";
import { createFakeSupabaseClient, type FakeSupabaseClient } from "../../../../lib/bdos/test-helpers/fake-supabase-client";
import type { MeasurementImportListItem, MeasurementImportsListReader } from "../../../../lib/bdos/measurement-imports-listing-service";

// Epic 20, Sprint 20.1E.1A. `GET` em si não é executado (mesma
// limitação já registrada no 20.1D -- depende de `cookies()`/Request
// reais do Next.js); os testes exercitam `handleListMeasurementImports`
// e `buildMeasurementImportsListReader`.

const COMPANY_ID = "company-1";
const OTHER_COMPANY_ID = "company-2";
const ENGINEERING_PROJECT_ID = "project-1";

interface FakeReader extends MeasurementImportsListReader {
  readonly calls: Array<{ companyId: string }>;
}

function createFakeReader(itemsByCompany: Record<string, ReadonlyArray<MeasurementImportListItem>>): FakeReader {
  const calls: Array<{ companyId: string }> = [];
  return {
    calls,
    async listByCompany(input) {
      calls.push(input);
      return itemsByCompany[input.companyId] ?? [];
    }
  };
}

async function main(): Promise<void> {
  await runTest("401 quando não autenticado -- reader nunca chamado", async () => {
    const reader = createFakeReader({});
    const outcome = await handleListMeasurementImports({ auth: null }, { importsListReader: reader });

    assertEqual(outcome.status, 401);
    assertEqual((outcome.body as { error: string }).error, "unauthenticated");
    assertEqual(reader.calls.length, 0);
  });

  await runTest("200 com a lista da company autenticada -- companyId nunca vem do input, só de auth", async () => {
    const item: MeasurementImportListItem = {
      measurementBulletinImportId: "import-1",
      humanLabel: "BM_08.xlsx",
      status: "completed",
      createdAt: "2026-07-10T10:00:00.000Z",
      updatedAt: "2026-07-10T10:05:00.000Z",
      analysisAvailable: true
    };
    const reader = createFakeReader({ [COMPANY_ID]: [item] });

    const outcome = await handleListMeasurementImports({ auth: { companyId: COMPANY_ID, userId: "user-1" } }, { importsListReader: reader });

    assertEqual(outcome.status, 200);
    assertEqual(JSON.stringify(outcome.body), JSON.stringify({ imports: [item] }));
    assertEqual(reader.calls.length, 1);
    assertEqual(JSON.stringify(reader.calls[0]), JSON.stringify({ companyId: COMPANY_ID }));
  });

  await runTest("200 com lista vazia quando a company não tem importações -- nunca 404", async () => {
    const reader = createFakeReader({});
    const outcome = await handleListMeasurementImports({ auth: { companyId: COMPANY_ID, userId: "user-1" } }, { importsListReader: reader });

    assertEqual(outcome.status, 200);
    assertEqual(JSON.stringify(outcome.body), JSON.stringify({ imports: [] }));
  });

  // Composição real do reader contra o repository do Epic 19.
  await runTest("buildMeasurementImportsListReader adapta listMeasurementBulletinImportsByCompany -- escopado por company, campos mínimos", async () => {
    const supabase = createFakeSupabaseClient({
      tables: { measurement_bulletin_imports: { defaults: { status: "pending_upload" } } }
    }) as FakeSupabaseClient;

    const importId = randomUUID();
    await insertMeasurementBulletinImport(supabase as any, {
      id: importId,
      companyId: COMPANY_ID,
      engineeringProjectId: ENGINEERING_PROJECT_ID,
      fileName: "BM_08.xlsx",
      storagePath: `${COMPANY_ID}/measurement/${ENGINEERING_PROJECT_ID}/${importId}/boletim.xlsx`,
      uploadedBy: "user-1",
      status: "completed"
    });
    // Fake client não simula DEFAULT NOW() de uploaded_at/updated_at --
    // atribuídos explicitamente aqui para o teste, mesmo padrão já
    // usado nos demais testes deste diretório para analysis_result.
    supabase.__tables.measurement_bulletin_imports[0]!.uploaded_at = "2026-07-10T10:00:00.000Z";
    supabase.__tables.measurement_bulletin_imports[0]!.updated_at = "2026-07-10T10:05:00.000Z";
    supabase.__tables.measurement_bulletin_imports[0]!.analysis_result = { status: "needs_review" };

    // Import de outra company -- nunca deve aparecer.
    const otherImportId = randomUUID();
    await insertMeasurementBulletinImport(supabase as any, {
      id: otherImportId,
      companyId: OTHER_COMPANY_ID,
      engineeringProjectId: ENGINEERING_PROJECT_ID,
      fileName: "outro-boletim.xlsx",
      storagePath: `${OTHER_COMPANY_ID}/measurement/${ENGINEERING_PROJECT_ID}/${otherImportId}/boletim.xlsx`,
      uploadedBy: "user-2",
      status: "completed"
    });

    const reader = buildMeasurementImportsListReader(supabase as any);
    const items = await reader.listByCompany({ companyId: COMPANY_ID });

    assertEqual(items.length, 1, "só o import da company correta");
    assertEqual(items[0]!.measurementBulletinImportId, importId);
    assertEqual(items[0]!.humanLabel, "BM_08.xlsx", "humanLabel é o fileName real, verbatim");
    assertEqual(items[0]!.analysisAvailable, true, "analysis_result presente -- analysisAvailable=true");
    assertEqual(items[0]!.createdAt, "2026-07-10T10:00:00.000Z");
  });

  await runTest("route.ts só exporta GET e dynamic -- nenhum import de Supabase/Claude/Execution Engine/React", async () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(currentDir, "route.ts"), "utf8");

    const exportedNames = Array.from(source.matchAll(/^export\s+(?:async\s+function|const)\s+(\w+)/gm)).map((match) => match[1]);
    assertEqual(JSON.stringify(exportedNames.sort()), JSON.stringify(["GET", "dynamic"].sort()));

    assertTrue(!/anthropic|claude/i.test(source), "route.ts não importa Claude/LLM");
    assertTrue(!/execution-management|execution-repository/i.test(source), "route.ts não importa Execution Engine");
    assertTrue(!/from ["']react["']|@bba\/ui/.test(source), "route.ts não importa React/packages-ui");
    assertTrue(source.includes("handleListMeasurementImports("), "route.ts delega ao handler auxiliar");
  });
}

async function runTest(name: string, testCase: () => Promise<void>): Promise<void> {
  await testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "valores diferentes"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(message ?? "esperava true, recebeu false");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
