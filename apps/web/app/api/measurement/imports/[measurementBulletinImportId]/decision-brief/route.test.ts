import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MeasurementAnalysisResult } from "@bba/bdos-core/services/measurement-bulletin-import";
import { buildMeasurementDecisionBriefImportReader, handleGetMeasurementDecisionBrief } from "./measurement-decision-brief-route-handler";
import { insertMeasurementBulletinImport } from "../../../../../../lib/bdos/measurement-repository";
import { createFakeSupabaseClient, type FakeSupabaseClient } from "../../../../../../lib/bdos/test-helpers/fake-supabase-client";
import type { MeasurementDecisionBriefImportReader } from "../../../../../../lib/bdos/measurement-decision-brief-service";

// Epic 20, Sprint 20.1D. Primeira rota testada neste repositório --
// nenhum precedente de `route.test.ts` existia antes. `GET` em si
// (que depende de `cookies()`/Request reais do Next.js) não é
// executado aqui -- o que os testes exercitam é
// `handleGetMeasurementDecisionBrief` (a orquestração testável,
// desacoplada de `next/server`) e, separadamente,
// `buildMeasurementDecisionBriefImportReader` (a composição do reader
// contra o repository real, com o fake in-memory de SupabaseClient já
// usado pelo resto de apps/web/lib/bdos).

const COMPANY_ID = "company-1";
const OTHER_COMPANY_ID = "company-2";
const ENGINEERING_PROJECT_ID = "project-1";

const NEEDS_REVIEW_ANALYSIS: MeasurementAnalysisResult = {
  schemaVersion: 1,
  parserKey: "dnocs-measurement-bulletin-v1",
  generatedAt: "2026-01-01T00:00:00.000Z",
  measurementBulletinImportId: "import-needs-review",
  engineeringProjectId: ENGINEERING_PROJECT_ID,
  declaredBulletinNumber: 8,
  declaredPeriod: { startDate: "2026-06-01", endDate: "2026-06-30", labels: ["MED-08"] },
  structuralIssues: [
    {
      code: "missing_work_package_code",
      severity: "warning",
      message: 'Linha com dado parcial (código ou nome ausente) na aba "BOLETIM DE MEDIÇÃO 08", linha 347.',
      sourceLocation: { sheetName: "BOLETIM DE MEDIÇÃO 08", rowNumber: 347 }
    }
  ],
  skippedSheets: [],
  status: "needs_review",
  measurementWorkspaceId: "workspace-2",
  officialPeriodTotal: 252654.78,
  recalculatedTotal: 252654.78,
  totalDifference: 0,
  workPackages: { created: 336, matched: 0 },
  serviceItems: { created: 300, matched: 0 },
  lines: { imported: 15, alreadyPresent: 0, updated: 0, skippedZeroValue: 0 }
};

// --- fake reader (para handleGetMeasurementDecisionBrief, sem Supabase) ---

interface SeedRecord {
  readonly measurementBulletinImportId: string;
  readonly companyId: string;
  readonly analysisResult: unknown;
}

interface FakeReader extends MeasurementDecisionBriefImportReader {
  readonly calls: Array<{ measurementBulletinImportId: string; companyId: string }>;
}

function createFakeReader(seed: ReadonlyArray<SeedRecord>): FakeReader {
  const calls: Array<{ measurementBulletinImportId: string; companyId: string }> = [];
  return {
    calls,
    async findById(query) {
      calls.push(query);
      const found = seed.find((entry) => entry.measurementBulletinImportId === query.measurementBulletinImportId && entry.companyId === query.companyId);
      return found ? { analysisResult: found.analysisResult } : null;
    }
  };
}

async function main(): Promise<void> {
  // 1, 8, 9, 10, 11, 13, 14, 15. Usuário autenticado, import válido:
  // companyId vem só de auth (nunca do cliente), sucesso devolve o
  // Brief completo (readiness/confidence/metadata/source references
  // preservados), reader chamado com os IDs corretos.
  await runTest("200 com o Brief completo quando autenticado e a importação existe -- companyId nunca vem do input, só de auth", async () => {
    const reader = createFakeReader([{ measurementBulletinImportId: "import-1", companyId: COMPANY_ID, analysisResult: NEEDS_REVIEW_ANALYSIS }]);

    const outcome = await handleGetMeasurementDecisionBrief(
      { auth: { companyId: COMPANY_ID, userId: "user-1" }, measurementBulletinImportId: "import-1", generatedAt: "2026-07-13T12:00:00.000Z" },
      { importReader: reader }
    );

    assertEqual(outcome.status, 200);
    const body = outcome.body as { data: { metadata: { generatedAt: string; sourceImportId: string }; executiveConclusion: { readiness: string }; confidence: { status: string }; criticalItems: unknown[] } };
    assertEqual(body.data.metadata.generatedAt, "2026-07-13T12:00:00.000Z", "generatedAt preservado");
    assertEqual(body.data.metadata.sourceImportId, "import-1", "sourceImportId preservado");
    assertEqual(body.data.executiveConclusion.readiness, "ready_with_reservations", "readiness não recalculada");
    assertEqual(body.data.confidence.status, "unavailable", "confidence não recalculada");
    assertEqual(body.data.criticalItems.length, 1, "source references/critical items preservados");

    assertEqual(reader.calls.length, 1, "reader chamado uma única vez");
    assertEqual(JSON.stringify(reader.calls[0]), JSON.stringify({ measurementBulletinImportId: "import-1", companyId: COMPANY_ID }), "reader recebe os IDs corretos");
  });

  // 4. Usuário não autenticado.
  await runTest("401 quando não autenticado", async () => {
    const reader = createFakeReader([]);
    const outcome = await handleGetMeasurementDecisionBrief({ auth: null, measurementBulletinImportId: "import-1", generatedAt: "2026-07-13T12:00:00.000Z" }, { importReader: reader });

    assertEqual(outcome.status, 401);
    assertEqual((outcome.body as { error: string }).error, "unauthenticated");
    assertEqual(reader.calls.length, 0, "reader nunca chamado sem autenticação");
  });

  // 4. Parâmetro ausente/inválido.
  await runTest("400 quando measurementBulletinImportId está ausente", async () => {
    const reader = createFakeReader([]);
    const outcome = await handleGetMeasurementDecisionBrief(
      { auth: { companyId: COMPANY_ID, userId: "user-1" }, measurementBulletinImportId: undefined, generatedAt: "2026-07-13T12:00:00.000Z" },
      { importReader: reader }
    );

    assertEqual(outcome.status, 400);
    assertEqual((outcome.body as { error: string }).error, "missing_measurement_bulletin_import_id");
    assertEqual(reader.calls.length, 0, "reader nunca chamado com parâmetro inválido");
  });

  // 5. Importação inexistente.
  await runTest("404 quando a importação não existe", async () => {
    const reader = createFakeReader([]);
    const outcome = await handleGetMeasurementDecisionBrief(
      { auth: { companyId: COMPANY_ID, userId: "user-1" }, measurementBulletinImportId: "id-inexistente", generatedAt: "2026-07-13T12:00:00.000Z" },
      { importReader: reader }
    );

    assertEqual(outcome.status, 404);
    assertEqual((outcome.body as { error: string }).error, "import_not_found");
  });

  // 6. Importação de outro tenant -- indistinguível de inexistente.
  await runTest("404 quando a importação pertence a outra company -- mesmo status/erro de inexistente", async () => {
    const reader = createFakeReader([{ measurementBulletinImportId: "import-1", companyId: OTHER_COMPANY_ID, analysisResult: NEEDS_REVIEW_ANALYSIS }]);
    const outcome = await handleGetMeasurementDecisionBrief(
      { auth: { companyId: COMPANY_ID, userId: "user-1" }, measurementBulletinImportId: "import-1", generatedAt: "2026-07-13T12:00:00.000Z" },
      { importReader: reader }
    );

    assertEqual(outcome.status, 404);
    assertEqual((outcome.body as { error: string }).error, "import_not_found", "nenhuma distinção externa de cross-tenant");
  });

  // 7. Análise ainda indisponível -- 409, nunca 404 (recurso existe).
  await runTest("409 quando a importação existe mas ainda não tem analysis_result", async () => {
    const reader = createFakeReader([{ measurementBulletinImportId: "import-1", companyId: COMPANY_ID, analysisResult: null }]);
    const outcome = await handleGetMeasurementDecisionBrief(
      { auth: { companyId: COMPANY_ID, userId: "user-1" }, measurementBulletinImportId: "import-1", generatedAt: "2026-07-13T12:00:00.000Z" },
      { importReader: reader }
    );

    assertEqual(outcome.status, 409);
    assertEqual((outcome.body as { error: string }).error, "analysis_not_available");
  });

  // 18. Nenhuma chamada direta ao builder -- garantida estruturalmente
  // (handleGetMeasurementDecisionBrief só importa getMeasurementDecisionBrief,
  // nunca buildMeasurementDecisionBrief -- ver relatório/grep).

  // 20. Nenhum aggregate criado.
  await runTest("nenhum campo do corpo da resposta carrega id de Decision/Recommendation/ActionPlan/Action/ExecutionWorkflow/ExecutionTask", async () => {
    const reader = createFakeReader([{ measurementBulletinImportId: "import-1", companyId: COMPANY_ID, analysisResult: NEEDS_REVIEW_ANALYSIS }]);
    const outcome = await handleGetMeasurementDecisionBrief(
      { auth: { companyId: COMPANY_ID, userId: "user-1" }, measurementBulletinImportId: "import-1", generatedAt: "2026-07-13T12:00:00.000Z" },
      { importReader: reader }
    );

    const serialized = JSON.stringify(outcome.body);
    ["decisionId", "recommendationId", "actionPlanId", "actionId", "executionWorkflowId", "executionTaskId"].forEach((forbiddenKey) => {
      assertTrue(!serialized.includes(forbiddenKey), `resposta não deve conter a chave "${forbiddenKey}"`);
    });
  });

  // Composição real do reader contra o repository do Epic 19 (fake
  // in-memory de SupabaseClient, mesmo padrão do resto de
  // apps/web/lib/bdos).
  await runTest("buildMeasurementDecisionBriefImportReader adapta getMeasurementBulletinImportById -- só analysisResult, escopado por company", async () => {
    const supabase = createFakeSupabaseClient({
      tables: { measurement_bulletin_imports: { defaults: { status: "pending_upload" } } }
    }) as FakeSupabaseClient;
    const importId = randomUUID();
    await insertMeasurementBulletinImport(supabase as any, {
      id: importId,
      companyId: COMPANY_ID,
      engineeringProjectId: ENGINEERING_PROJECT_ID,
      fileName: "boletim.xlsx",
      storagePath: `${COMPANY_ID}/measurement/${ENGINEERING_PROJECT_ID}/${importId}/boletim.xlsx`,
      uploadedBy: "user-1",
      status: "completed"
    });
    supabase.__tables.measurement_bulletin_imports[0]!.analysis_result = NEEDS_REVIEW_ANALYSIS;

    const reader = buildMeasurementDecisionBriefImportReader(supabase as any);
    const found = await reader.findById({ measurementBulletinImportId: importId, companyId: COMPANY_ID });
    assertTrue(found !== null);
    assertEqual(JSON.stringify(found!.analysisResult), JSON.stringify(NEEDS_REVIEW_ANALYSIS), "analysisResult repassado sem transformação");
    assertEqual(Object.keys(found!).length, 1, "record só carrega analysisResult, nenhum outro campo de persistência");

    const crossTenant = await reader.findById({ measurementBulletinImportId: importId, companyId: OTHER_COMPANY_ID });
    assertEqual(crossTenant, null, "reader escopa por company_id, mesma disciplina do repository real");
  });

  // Verificação estática de route.ts -- arquivo especial do App
  // Router só pode exportar métodos HTTP e configurações oficiais de
  // segmento (achado real desta Sprint: um export extra quebrou
  // `next build`, Next.js 14.2.23). Mesma disciplina de scanner
  // textual de engineering-boundaries.test.ts, aplicada aqui a um
  // único arquivo.
  await runTest("route.ts só exporta GET e dynamic -- nenhum helper de aplicação, nenhum import do builder/Claude/Execution Engine", async () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(currentDir, "route.ts"), "utf8");

    const exportedNames = Array.from(source.matchAll(/^export\s+(?:async\s+function|const)\s+(\w+)/gm)).map((match) => match[1]);
    assertEqual(JSON.stringify(exportedNames.sort()), JSON.stringify(["GET", "dynamic"].sort()), "route.ts só exporta GET e dynamic");

    assertTrue(!source.includes("buildMeasurementDecisionBrief("), "route.ts não chama o builder diretamente");
    assertTrue(!/anthropic|claude/i.test(source), "route.ts não importa Claude/LLM");
    assertTrue(!/execution-management|execution-repository/i.test(source), "route.ts não importa Execution Engine");
    assertTrue(!/from ["']react["']|@bba\/ui/.test(source), "route.ts não importa React/packages-ui");
    assertTrue(source.includes("handleGetMeasurementDecisionBrief("), "route.ts delega ao handler auxiliar");
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
