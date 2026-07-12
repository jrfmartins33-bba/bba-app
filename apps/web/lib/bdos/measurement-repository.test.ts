import {
  claimMeasurementBulletinImportForProcessing,
  finalizeMeasurementBulletinImportWithResult,
  insertMeasurementBulletinImport
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
      measurement_bulletin_imports: { defaults: { status: "pending_upload" } }
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
