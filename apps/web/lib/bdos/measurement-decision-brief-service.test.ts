import type { MeasurementAnalysisResult } from "@bba/bdos-core/services/measurement-bulletin-import";
import { buildMeasurementDecisionBrief } from "@bba/bdos-core/services/measurement-bulletin-import";
import {
  getMeasurementDecisionBrief,
  type GetMeasurementDecisionBriefDependencies,
  type MeasurementDecisionBriefImportReader,
  type MeasurementDecisionBriefImportRecord
} from "./measurement-decision-brief-service";

// Epic 20, Sprint 20.1C -- testa getMeasurementDecisionBrief contra um
// fake do reader (nunca SupabaseClient, nunca banco real). Correção
// pós-revisão de arquitetura: o serviço não conhece mais infra de
// persistência, então o teste também não precisa do fake-supabase-client
// usado pelos demais serviços de apps/web/lib/bdos.

const COMPANY_ID = "company-1";
const OTHER_COMPANY_ID = "company-2";

interface SeedRecord {
  readonly measurementBulletinImportId: string;
  readonly companyId: string;
  readonly record: MeasurementDecisionBriefImportRecord;
}

interface FakeImportReader extends MeasurementDecisionBriefImportReader {
  readonly calls: Array<{ measurementBulletinImportId: string; companyId: string }>;
}

function createFakeImportReader(seed: ReadonlyArray<SeedRecord>): FakeImportReader {
  const calls: Array<{ measurementBulletinImportId: string; companyId: string }> = [];
  return {
    calls,
    async findById(query) {
      calls.push(query);
      const found = seed.find((entry) => entry.measurementBulletinImportId === query.measurementBulletinImportId && entry.companyId === query.companyId);
      return found ? found.record : null;
    }
  };
}

function deps(reader: MeasurementDecisionBriefImportReader): GetMeasurementDecisionBriefDependencies {
  return { importReader: reader };
}

// Derivada do BM_08 real, mesma fixture usada nos Sprints 20.1B/20.1C anteriores.
const NEEDS_REVIEW_ANALYSIS: MeasurementAnalysisResult = {
  schemaVersion: 1,
  parserKey: "dnocs-measurement-bulletin-v1",
  generatedAt: "2026-01-01T00:00:00.000Z",
  measurementBulletinImportId: "import-needs-review",
  engineeringProjectId: "project-1",
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

async function main(): Promise<void> {
  // 1, 2, 3, 4, 13. Importação válida: reader chamado exatamente uma
  // vez, com exatamente measurementBulletinImportId/companyId; Brief
  // idêntico ao builder chamado diretamente; generatedAt preservado;
  // readiness/confidence do builder, não recalculados.
  await runTest("reader chamado exatamente uma vez, com os dois campos exatos, e o Brief é idêntico ao builder chamado diretamente", async () => {
    const reader = createFakeImportReader([{ measurementBulletinImportId: "import-1", companyId: COMPANY_ID, record: { analysisResult: NEEDS_REVIEW_ANALYSIS } }]);

    const result = await getMeasurementDecisionBrief(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, generatedAt: "2026-07-13T12:00:00.000Z" },
      deps(reader)
    );

    assertTrue(result.success, "deveria ter sucesso");
    if (!result.success) return;

    assertEqual(reader.calls.length, 1, "reader chamado exatamente uma vez");
    assertEqual(JSON.stringify(reader.calls[0]), JSON.stringify({ measurementBulletinImportId: "import-1", companyId: COMPANY_ID }), "reader recebe exatamente os dois campos, nenhum a mais");

    const expected = buildMeasurementDecisionBrief({
      analysisResult: NEEDS_REVIEW_ANALYSIS,
      sourceImportId: "import-1",
      generatedAt: "2026-07-13T12:00:00.000Z"
    });
    assertEqual(JSON.stringify(result.decisionBrief), JSON.stringify(expected), "serviço não reinterpreta nada -- saída idêntica ao builder chamado diretamente com o mesmo input");
    assertEqual(result.decisionBrief.metadata.generatedAt, "2026-07-13T12:00:00.000Z", "generatedAt preservado exatamente como injetado");
    assertEqual(result.decisionBrief.executiveConclusion.readiness, "ready_with_reservations", "readiness do builder, não recalculada aqui");
    assertEqual(result.decisionBrief.confidence.status, "unavailable", "confidence do builder, não recalculada aqui");
  });

  // 5. import_not_found quando o reader devolve null.
  await runTest("import_not_found quando o reader devolve null", async () => {
    const reader = createFakeImportReader([]);

    const result = await getMeasurementDecisionBrief({ measurementBulletinImportId: "id-inexistente", companyId: COMPANY_ID, generatedAt: "2026-07-13T12:00:00.000Z" }, deps(reader));

    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "import_not_found");
  });

  // 6. Outro tenant continua indistinguível de importação inexistente
  // -- a responsabilidade de escopar por companyId agora é do reader
  // (mesma disciplina do getMeasurementBulletinImportById real:
  // filtra id+companyId na mesma consulta), simulada aqui no fake.
  await runTest("import_not_found quando o registro existe só para outra company -- reader nunca revela isso ao serviço", async () => {
    const reader = createFakeImportReader([{ measurementBulletinImportId: "import-1", companyId: OTHER_COMPANY_ID, record: { analysisResult: NEEDS_REVIEW_ANALYSIS } }]);

    const result = await getMeasurementDecisionBrief({ measurementBulletinImportId: "import-1", companyId: COMPANY_ID, generatedAt: "2026-07-13T12:00:00.000Z" }, deps(reader));

    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "import_not_found", "mesmo código de erro, nenhuma distinção externa");
  });

  // 7. analysis_not_available quando a análise está ausente.
  await runTest("analysis_not_available quando o registro existe mas analysisResult é null", async () => {
    const reader = createFakeImportReader([{ measurementBulletinImportId: "import-1", companyId: COMPANY_ID, record: { analysisResult: null } }]);

    const result = await getMeasurementDecisionBrief({ measurementBulletinImportId: "import-1", companyId: COMPANY_ID, generatedAt: "2026-07-13T12:00:00.000Z" }, deps(reader));

    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "analysis_not_available");
  });

  // 8. Erro lançado pelo reader propaga, nunca vira um branch do Result.
  await runTest("erro lançado pelo reader propaga como exceção, nunca é convertido silenciosamente em erro de negócio", async () => {
    const throwingReader: MeasurementDecisionBriefImportReader = {
      async findById() {
        throw new Error("conexão perdida");
      }
    };

    let threw = false;
    try {
      await getMeasurementDecisionBrief({ measurementBulletinImportId: "any-id", companyId: COMPANY_ID, generatedAt: "2026-07-13T12:00:00.000Z" }, deps(throwingReader));
    } catch {
      threw = true;
    }
    assertTrue(threw, "erro do reader deveria propagar como exceção");
  });

  // 9. Mesma entrada e mesmo fake produzem a mesma saída.
  await runTest("mesma entrada produz exatamente a mesma saída (determinístico)", async () => {
    const reader = createFakeImportReader([{ measurementBulletinImportId: "import-1", companyId: COMPANY_ID, record: { analysisResult: NEEDS_REVIEW_ANALYSIS } }]);
    const input = { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, generatedAt: "2026-07-13T12:00:00.000Z" };

    const first = await getMeasurementDecisionBrief(input, deps(reader));
    const second = await getMeasurementDecisionBrief(input, deps(reader));
    assertEqual(JSON.stringify(first), JSON.stringify(second));
  });

  // 14. Nenhum aggregate criado -- inspeção estrutural do resultado inteiro.
  await runTest("nenhum campo do resultado carrega id de Decision/Recommendation/ActionPlan/Action/ExecutionWorkflow/ExecutionTask", async () => {
    const reader = createFakeImportReader([{ measurementBulletinImportId: "import-1", companyId: COMPANY_ID, record: { analysisResult: NEEDS_REVIEW_ANALYSIS } }]);

    const result = await getMeasurementDecisionBrief({ measurementBulletinImportId: "import-1", companyId: COMPANY_ID, generatedAt: "2026-07-13T12:00:00.000Z" }, deps(reader));
    assertTrue(result.success);
    if (!result.success) return;

    const serialized = JSON.stringify(result.decisionBrief);
    ["decisionId", "recommendationId", "actionPlanId", "actionId", "executionWorkflowId", "executionTaskId"].forEach((forbiddenKey) => {
      assertTrue(!serialized.includes(forbiddenKey), `resultado não deve conter a chave "${forbiddenKey}"`);
    });
  });
}

// 10, 11, 12: confirmados por leitura estática de
// measurement-decision-brief-service.ts (ver relatório) -- o arquivo
// não importa SupabaseClient, @supabase/supabase-js nem
// getMeasurementBulletinImportById.

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
