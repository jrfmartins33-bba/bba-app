import {
  claimMeasurementBulletinImportForProcessing,
  finalizeMeasurementBulletinImportWithResult,
  getMeasurementBulletinById,
  insertMeasurementBulletin,
  insertMeasurementBulletinImport,
  listMeasurementBulletinImportsByCompany,
  updateMeasurementBulletinStatus
} from "./measurement-repository";
import { createFakeSupabaseClient } from "./test-helpers/fake-supabase-client";

// Correção 4/5 (Sprint 4D) -- estas duas funções são o mecanismo real
// de atomicidade que o resto do serviço depende. Testadas aqui em
// isolamento contra o fake client (mesmo padrão de measurement-bulletin-import-service.test.ts,
// sem rede/credenciais reais) porque a 19.4D.1 nunca ganhou um arquivo
// de teste próprio -- só foi validada por typecheck/pnpm test na
// época. Cobre diretamente o cenário 3 (claim concorrente -- aqui,
// "linha já em processing nunca é reivindicada de novo") e o mecanismo
// por trás do cenário 13 (finalize recusa uma linha que não está em
// 'processing').

function newClient() {
  return createFakeSupabaseClient({
    tables: {
      measurement_bulletin_imports: { defaults: { status: "pending_upload" } },
      measurement_bulletins: { defaults: { status: "Draft" } }
    }
  });
}

async function main(): Promise<void> {
  await runTest("claimMeasurementBulletinImportForProcessing reivindica um import 'uploaded'", async () => {
    const supabase = newClient() as any;
    await insertMeasurementBulletinImport(supabase, {
      id: "import-1",
      companyId: "company-1",
      engineeringProjectId: "project-1",
      fileName: "boletim.xlsx",
      storagePath: "company-1/measurement/project-1/import-1/boletim.xlsx",
      uploadedBy: "user-1",
      status: "uploaded"
    });

    const claimed = await claimMeasurementBulletinImportForProcessing(supabase, { id: "import-1", companyId: "company-1" });

    assertTrue(claimed !== null, "deveria reivindicar um import em 'uploaded'");
    assertEqual(claimed?.status, "processing", "status deveria virar 'processing'");
  });

  await runTest("claimMeasurementBulletinImportForProcessing reivindica um import 'failed' (retomada)", async () => {
    const supabase = newClient() as any;
    await insertMeasurementBulletinImport(supabase, {
      id: "import-1",
      companyId: "company-1",
      engineeringProjectId: "project-1",
      fileName: "boletim.xlsx",
      storagePath: "path",
      uploadedBy: "user-1",
      status: "failed"
    });

    const claimed = await claimMeasurementBulletinImportForProcessing(supabase, { id: "import-1", companyId: "company-1" });
    assertTrue(claimed !== null, "deveria reivindicar um import em 'failed'");
  });

  await runTest("claimMeasurementBulletinImportForProcessing devolve null quando o import já está 'processing' -- nunca reivindica duas vezes", async () => {
    const supabase = newClient() as any;
    await insertMeasurementBulletinImport(supabase, {
      id: "import-1",
      companyId: "company-1",
      engineeringProjectId: "project-1",
      fileName: "boletim.xlsx",
      storagePath: "path",
      uploadedBy: "user-1",
      status: "processing"
    });

    const claimed = await claimMeasurementBulletinImportForProcessing(supabase, { id: "import-1", companyId: "company-1" });

    assertEqual(claimed, null, "não pode reivindicar um import que já está 'processing' -- é exatamente o que impede duas execuções simultâneas materializando o mesmo import");
  });

  await runTest("claimMeasurementBulletinImportForProcessing devolve null quando o import já está 'completed'", async () => {
    const supabase = newClient() as any;
    await insertMeasurementBulletinImport(supabase, {
      id: "import-1",
      companyId: "company-1",
      engineeringProjectId: "project-1",
      fileName: "boletim.xlsx",
      storagePath: "path",
      uploadedBy: "user-1",
      status: "completed"
    });

    const claimed = await claimMeasurementBulletinImportForProcessing(supabase, { id: "import-1", companyId: "company-1" });
    assertEqual(claimed, null, "não pode reivindicar um import já 'completed'");
  });

  await runTest("finalizeMeasurementBulletinImportWithResult grava status+analysis_result juntos quando o import está 'processing'", async () => {
    const supabase = newClient() as any;
    await insertMeasurementBulletinImport(supabase, {
      id: "import-1",
      companyId: "company-1",
      engineeringProjectId: "project-1",
      fileName: "boletim.xlsx",
      storagePath: "path",
      uploadedBy: "user-1",
      status: "processing"
    });

    const finalized = await finalizeMeasurementBulletinImportWithResult(supabase, {
      id: "import-1",
      companyId: "company-1",
      status: "completed",
      analysisResult: { fake: "result" }
    });

    assertTrue(finalized !== null, "deveria finalizar um import em 'processing'");
    assertEqual(finalized?.status, "completed", "status deveria virar 'completed'");
    assertEqual(JSON.stringify(finalized?.analysisResult), JSON.stringify({ fake: "result" }), "analysisResult deveria ser gravado verbatim");
  });

  await runTest("finalizeMeasurementBulletinImportWithResult devolve null (nunca sucesso falso) quando o import NÃO está 'processing' -- guarda simétrica ao claim (correção 5 + revisão)", async () => {
    const supabase = newClient() as any;
    await insertMeasurementBulletinImport(supabase, {
      id: "import-1",
      companyId: "company-1",
      engineeringProjectId: "project-1",
      fileName: "boletim.xlsx",
      storagePath: "path",
      uploadedBy: "user-1",
      status: "completed"
    });

    const finalized = await finalizeMeasurementBulletinImportWithResult(supabase, {
      id: "import-1",
      companyId: "company-1",
      status: "completed",
      analysisResult: { fake: "resultado obsoleto, não deveria sobrescrever" }
    });

    assertEqual(finalized, null, "não pode finalizar (de novo) um import que já não está mais em 'processing' -- impede uma segunda finalização indevida sobrescrever um completed já gravado");

    const rows = (supabase as any).__tables.measurement_bulletin_imports as Array<Record<string, unknown>>;
    assertEqual(rows[0]?.analysis_result, undefined, "o registro original não deveria ter sido tocado pela tentativa recusada");
  });

  // Epic 20 (Decision Experience), Sprint 20.1E.1A -- correção pós-revisão:
  // listMeasurementBulletinImportsByCompany usa duas consultas leves
  // (metadata + só ids com analysis_result não nulo) em vez de
  // selecionar o JSON completo de analysis_result só para calcular um
  // boolean.

  await runTest("listMeasurementBulletinImportsByCompany: hasAnalysisResult reflete analysis_result real, nunca status === 'completed'", async () => {
    const supabase = newClient() as any;
    await insertMeasurementBulletinImport(supabase, {
      id: "import-completed-sem-analysis",
      companyId: "company-1",
      engineeringProjectId: "project-1",
      fileName: "a.xlsx",
      storagePath: "path-a",
      uploadedBy: "user-1",
      status: "completed"
    });
    // completed mas sem analysis_result setado -- caso hipotético de
    // teste (não deveria ocorrer em produção), usado só para provar
    // que a regra não é `status === "completed"`.
    await insertMeasurementBulletinImport(supabase, {
      id: "import-failed-com-analysis",
      companyId: "company-1",
      engineeringProjectId: "project-1",
      fileName: "b.xlsx",
      storagePath: "path-b",
      uploadedBy: "user-1",
      status: "failed"
    });
    const rows = (supabase as any).__tables.measurement_bulletin_imports as Array<Record<string, unknown>>;
    rows.find((row) => row.id === "import-failed-com-analysis")!.analysis_result = { status: "failed" };

    const items = await listMeasurementBulletinImportsByCompany(supabase, { companyId: "company-1" });

    const completedItem = items.find((item) => item.id === "import-completed-sem-analysis")!;
    const failedItem = items.find((item) => item.id === "import-failed-com-analysis")!;
    assertEqual(completedItem.hasAnalysisResult, false, "completed sem analysis_result real -- nunca true só por causa do status");
    assertEqual(failedItem.hasAnalysisResult, true, "failed com analysis_result real presente -- true mesmo sem status completed");
  });

  await runTest("listMeasurementBulletinImportsByCompany: nenhum conteúdo de analysis_result vaza no read model", async () => {
    const supabase = newClient() as any;
    await insertMeasurementBulletinImport(supabase, {
      id: "import-1",
      companyId: "company-1",
      engineeringProjectId: "project-1",
      fileName: "a.xlsx",
      storagePath: "path-a",
      uploadedBy: "user-1",
      status: "completed"
    });
    (supabase as any).__tables.measurement_bulletin_imports[0]!.analysis_result = { hugeFakePayload: "x".repeat(1000) };

    const items = await listMeasurementBulletinImportsByCompany(supabase, { companyId: "company-1" });

    const keys = Object.keys(items[0]!).sort();
    assertEqual(JSON.stringify(keys), JSON.stringify(["fileName", "hasAnalysisResult", "id", "status", "updatedAt", "uploadedAt"]), "read model só tem os campos de metadata + hasAnalysisResult, nunca analysis_result");
  });

  await runTest("listMeasurementBulletinImportsByCompany: nunca devolve registro de outra company", async () => {
    const supabase = newClient() as any;
    await insertMeasurementBulletinImport(supabase, {
      id: "import-empresa-1",
      companyId: "company-1",
      engineeringProjectId: "project-1",
      fileName: "a.xlsx",
      storagePath: "path-a",
      uploadedBy: "user-1",
      status: "completed"
    });
    await insertMeasurementBulletinImport(supabase, {
      id: "import-empresa-2",
      companyId: "company-2",
      engineeringProjectId: "project-2",
      fileName: "b.xlsx",
      storagePath: "path-b",
      uploadedBy: "user-2",
      status: "completed"
    });
    (supabase as any).__tables.measurement_bulletin_imports.forEach((row: Record<string, unknown>) => {
      row.analysis_result = { status: "reconciled" };
    });

    const items = await listMeasurementBulletinImportsByCompany(supabase, { companyId: "company-1" });

    assertEqual(items.length, 1, "só o import da company-1");
    assertEqual(items[0]!.id, "import-empresa-1", "id correto");
  });

  await runTest("listMeasurementBulletinImportsByCompany: ordena por uploaded_at descendente", async () => {
    const supabase = newClient() as any;
    await insertMeasurementBulletinImport(supabase, {
      id: "import-antigo",
      companyId: "company-1",
      engineeringProjectId: "project-1",
      fileName: "antigo.xlsx",
      storagePath: "path-antigo",
      uploadedBy: "user-1",
      status: "completed"
    });
    await insertMeasurementBulletinImport(supabase, {
      id: "import-recente",
      companyId: "company-1",
      engineeringProjectId: "project-1",
      fileName: "recente.xlsx",
      storagePath: "path-recente",
      uploadedBy: "user-1",
      status: "completed"
    });
    const rows = (supabase as any).__tables.measurement_bulletin_imports as Array<Record<string, unknown>>;
    rows.find((row) => row.id === "import-antigo")!.uploaded_at = "2026-01-01T00:00:00.000Z";
    rows.find((row) => row.id === "import-recente")!.uploaded_at = "2026-06-01T00:00:00.000Z";

    const items = await listMeasurementBulletinImportsByCompany(supabase, { companyId: "company-1" });

    assertEqual(items[0]!.id, "import-recente", "mais recente primeiro");
    assertEqual(items[1]!.id, "import-antigo", "mais antigo por último");
  });

  await runTest("listMeasurementBulletinImportsByCompany: lista vazia quando a company não tem nenhuma importação", async () => {
    const supabase = newClient() as any;
    const items = await listMeasurementBulletinImportsByCompany(supabase, { companyId: "company-sem-imports" });
    assertEqual(items.length, 0, "lista vazia, não erro");
  });

  await runTest("listMeasurementBulletinImportsByCompany: erro na consulta principal propaga como exceção", async () => {
    const stub = buildListingStubSupabase({ firstQueryError: { message: "erro simulado na consulta principal" } });
    let threw = false;
    try {
      await listMeasurementBulletinImportsByCompany(stub as any, { companyId: "company-1" });
    } catch {
      threw = true;
    }
    assertTrue(threw, "erro da consulta principal deveria propagar");
  });

  await runTest("listMeasurementBulletinImportsByCompany: erro na consulta de disponibilidade propaga como exceção, nunca vira lista parcial", async () => {
    const stub = buildListingStubSupabase({ secondQueryError: { message: "erro simulado na consulta de disponibilidade" } });
    let threw = false;
    try {
      await listMeasurementBulletinImportsByCompany(stub as any, { companyId: "company-1" });
    } catch {
      threw = true;
    }
    assertTrue(threw, "erro da segunda consulta deveria propagar, nunca devolver lista parcial silenciosamente");
  });

  // Etapa 3C.1C -- Persistência completa do envelope formal do boletim
  await runTest("insertMeasurementBulletin e getMeasurementBulletinById preservam envelope formal completo", async () => {
    const supabase = newClient() as any;
    const header = {
      contractId: "contract-123",
      contractNumber: "CT-2026-001",
      projectId: "project-123",
      projectName: "Lagoa do Arroz",
      measurementPeriodId: "period-8",
      periodNumber: 8,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      issueDate: "2026-07-01",
      technicalResponsibleId: "eng-marcos",
      technicalResponsibleName: "Marcos Ferreira",
      metadata: { source: "engineer-workspace" }
    };
    const reference = {
      type: "measurement_workspace",
      id: "workspace-123",
      code: "MW-08",
      name: "Medicao 8",
      metadata: {}
    };
    const decimalContext = {
      quantityScale: 2,
      unitValueScale: 2,
      monetaryPolicy: {
        key: "source-document-truncation-to-cents",
        scale: 2,
        quantizationMode: "truncate_toward_zero"
      }
    };
    const lines = [
      {
        id: "line-1",
        serviceItemId: "si-1",
        serviceItemCode: "SI-01",
        description: "Servico A",
        unit: "m3",
        quantity: 10,
        unitValue: 100,
        canonicalTotalValue: 1000,
        metadata: {}
      }
    ];
    const totals = {
      canonicalTotalValue: 1000,
      totalQuantity: 10,
      lineCount: 1,
      currency: "BRL"
    };
    const trace = [
      {
        action: "bulletin_created",
        actor: "system",
        occurredAt: "2026-07-01T10:00:00Z",
        description: "Boletim criado",
        metadata: {}
      }
    ];

    const inserted = await insertMeasurementBulletin(supabase, {
      id: "bulletin-123",
      companyId: "company-1",
      engineeringProjectId: "project-123",
      measurementWorkspaceId: "workspace-123",
      bulletinNumber: 8,
      periodNumber: 8,
      issueDate: "2026-07-01",
      reference,
      header,
      decimalContext,
      lines,
      totals,
      validationIssues: [],
      trace,
      metadata: { test: true }
    });

    assertEqual(inserted.id, "bulletin-123", "id inserido incorreto");
    assertEqual(inserted.issueDate, "2026-07-01", "issueDate inserida incorreta");
    assertEqual(inserted.header.technicalResponsibleId, "eng-marcos", "responsavel tecnico id preservado");
    assertEqual(inserted.header.technicalResponsibleName, "Marcos Ferreira", "responsavel tecnico nome preservado");
    assertEqual(inserted.decimalContext.monetaryPolicy.key, "source-document-truncation-to-cents", "monetary policy key preservada");

    const fetched = await getMeasurementBulletinById(supabase, { id: "bulletin-123", companyId: "company-1" });
    assertTrue(fetched !== null, "boletim deveria existir");
    assertEqual(fetched?.id, "bulletin-123", "id recuperado incorreto");
    assertEqual(fetched?.issueDate, "2026-07-01", "issueDate recuperada incorreta");
    assertEqual(fetched?.header.technicalResponsibleName, "Marcos Ferreira", "responsavel tecnico recuperado incorreto");
    assertEqual(fetched?.status, "Draft", "status padrao deveria ser Draft");
    assertEqual((fetched?.trace as Array<unknown>)?.length, 1, "trace recuperado incorreto");

    // Teste de transição de status com atualização de trace
    const updatedTrace = [
      ...trace,
      {
        action: "bulletin_finalized",
        actor: "eng-marcos",
        occurredAt: "2026-07-02T10:00:00Z",
        description: "Boletim finalizado",
        metadata: {}
      }
    ];
    await updateMeasurementBulletinStatus(supabase, {
      id: "bulletin-123",
      companyId: "company-1",
      status: "Finalized",
      finalizedAt: "2026-07-02T10:00:00Z",
      trace: updatedTrace
    });

    const finalized = await getMeasurementBulletinById(supabase, { id: "bulletin-123", companyId: "company-1" });
    assertEqual(finalized?.status, "Finalized", "status deveria ser Finalized");
    assertEqual(finalized?.finalizedAt, "2026-07-02T10:00:00Z", "finalizedAt incorreto");
    assertEqual((finalized?.trace as Array<unknown>)?.length, 2, "trace finalizado deveria ter 2 entradas");
  });
}

/**
 * Stub mínimo, dedicado só a simular erro em uma das duas consultas de
 * listMeasurementBulletinImportsByCompany -- a primeira sempre termina
 * em `.order()`, a segunda sempre em `.not()`; nenhuma outra forma de
 * consulta usa este stub.
 */
function buildListingStubSupabase(options: { firstQueryError?: { message: string }; secondQueryError?: { message: string } }) {
  return {
    from() {
      return {
        select() {
          const chain = {
            eq() {
              return chain;
            },
            order() {
              return Promise.resolve({ data: [], error: options.firstQueryError ?? null });
            },
            not() {
              return Promise.resolve({ data: [], error: options.secondQueryError ?? null });
            }
          };
          return chain;
        }
      };
    }
  };
}

async function runTest(name: string, testCase: () => Promise<void>): Promise<void> {
  await testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
