import { confirmMeasurementBulletinUpload, prepareMeasurementBulletinUpload } from "./measurement-bulletin-upload-service";
import { createFakeSupabaseClient, type FakeSupabaseClient } from "./test-helpers/fake-supabase-client";

// Testa prepareMeasurementBulletinUpload/confirmMeasurementBulletinUpload
// (Sprint 4B) contra o fake in-memory de SupabaseClient -- mesmo
// padrão de measurement-bulletin-import-service.test.ts. Cobre os
// códigos de erro já congelados na Sprint 4.0
// (PrepareMeasurementBulletinUploadErrorCode/ConfirmMeasurementBulletinUploadErrorCode)
// e a idempotência de confirmMeasurementBulletinUpload.

const COMPANY_ID = "company-1";
const ENGINEERING_PROJECT_ID = "project-1";

function newClient(): FakeSupabaseClient {
  return createFakeSupabaseClient({
    tables: {
      measurement_bulletin_imports: { defaults: { status: "pending_upload" } }
    }
  });
}

async function main(): Promise<void> {
  await runTest("prepareMeasurementBulletinUpload cria o import com status pending_upload (default) e o storagePath convencionado", async () => {
    const supabase = newClient();

    const result = await prepareMeasurementBulletinUpload(supabase as any, {
      companyId: COMPANY_ID,
      engineeringProjectId: ENGINEERING_PROJECT_ID,
      fileName: "BM_08.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 5_200_000,
      uploadedBy: "user-1"
    });

    assertTrue(result.success, "deveria aceitar um .xlsx dentro do limite de tamanho");
    if (!result.success) return;
    assertEqual(
      result.storagePath,
      `${COMPANY_ID}/measurement/${ENGINEERING_PROJECT_ID}/${result.measurementBulletinImportId}/BM_08.xlsx`,
      "storagePath deveria seguir a convenção company/measurement/project/importId/fileName"
    );

    const row = supabase.__tables.measurement_bulletin_imports[0];
    assertEqual(row?.status, "pending_upload", "status deveria ficar no default do schema, nunca escrito explicitamente aqui");
    assertEqual(row?.id, result.measurementBulletinImportId);
  });

  await runTest("prepareMeasurementBulletinUpload recusa extensão/MIME não suportados", async () => {
    const supabase = newClient();

    const result = await prepareMeasurementBulletinUpload(supabase as any, {
      companyId: COMPANY_ID,
      engineeringProjectId: ENGINEERING_PROJECT_ID,
      fileName: "boletim.pdf",
      contentType: "application/pdf",
      sizeBytes: 1000,
      uploadedBy: "user-1"
    });

    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "unsupported_file_type");
    assertEqual(supabase.__tables.measurement_bulletin_imports.length, 0, "nada deveria ser persistido");
  });

  await runTest("prepareMeasurementBulletinUpload recusa arquivo acima do limite de upload padrão", async () => {
    const supabase = newClient();

    const result = await prepareMeasurementBulletinUpload(supabase as any, {
      companyId: COMPANY_ID,
      engineeringProjectId: ENGINEERING_PROJECT_ID,
      fileName: "BM_08.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 7 * 1024 * 1024,
      uploadedBy: "user-1"
    });

    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "file_too_large");
    assertEqual(supabase.__tables.measurement_bulletin_imports.length, 0);
  });

  await runTest("confirmMeasurementBulletinUpload transiciona pending_upload -> uploaded quando o objeto existe no Storage", async () => {
    const supabase = newClient();
    const prepared = await prepareMeasurementBulletinUpload(supabase as any, {
      companyId: COMPANY_ID,
      engineeringProjectId: ENGINEERING_PROJECT_ID,
      fileName: "BM_08.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 1000,
      uploadedBy: "user-1"
    });
    assertTrue(prepared.success);
    if (!prepared.success) return;

    // Simula o upload direto ao Storage (bypassa a rota -- é
    // exatamente o que o browser faz de verdade).
    supabase.__files = { [prepared.storagePath]: new Uint8Array([1, 2, 3]) };

    const result = await confirmMeasurementBulletinUpload(supabase as any, {
      companyId: COMPANY_ID,
      measurementBulletinImportId: prepared.measurementBulletinImportId
    });

    assertTrue(result.success);
    const row = supabase.__tables.measurement_bulletin_imports[0];
    assertEqual(row?.status, "uploaded");
  });

  await runTest("confirmMeasurementBulletinUpload devolve upload_not_found quando o objeto ainda não existe no Storage", async () => {
    const supabase = newClient();
    const prepared = await prepareMeasurementBulletinUpload(supabase as any, {
      companyId: COMPANY_ID,
      engineeringProjectId: ENGINEERING_PROJECT_ID,
      fileName: "BM_08.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 1000,
      uploadedBy: "user-1"
    });
    assertTrue(prepared.success);
    if (!prepared.success) return;
    // Nenhum arquivo registrado -- upload ainda não aconteceu de verdade.

    const result = await confirmMeasurementBulletinUpload(supabase as any, {
      companyId: COMPANY_ID,
      measurementBulletinImportId: prepared.measurementBulletinImportId
    });

    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "upload_not_found");
    const row = supabase.__tables.measurement_bulletin_imports[0];
    assertEqual(row?.status, "pending_upload", "status nunca deveria avançar sem o objeto confirmado");
  });

  await runTest("confirmMeasurementBulletinUpload é idempotente quando já está uploaded/processing/completed", async () => {
    const supabase = newClient();
    const prepared = await prepareMeasurementBulletinUpload(supabase as any, {
      companyId: COMPANY_ID,
      engineeringProjectId: ENGINEERING_PROJECT_ID,
      fileName: "BM_08.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 1000,
      uploadedBy: "user-1"
    });
    assertTrue(prepared.success);
    if (!prepared.success) return;

    supabase.__tables.measurement_bulletin_imports[0]!.status = "completed";

    const result = await confirmMeasurementBulletinUpload(supabase as any, {
      companyId: COMPANY_ID,
      measurementBulletinImportId: prepared.measurementBulletinImportId
    });

    assertTrue(result.success, "já foi além de uploaded -- idempotente, nunca erro");
    assertEqual(supabase.__tables.measurement_bulletin_imports[0]?.status, "completed", "confirm não deveria regredir nem tocar o status de um import já concluído");
  });

  await runTest("confirmMeasurementBulletinUpload devolve import_not_found quando o id não existe", async () => {
    const supabase = newClient();

    const result = await confirmMeasurementBulletinUpload(supabase as any, {
      companyId: COMPANY_ID,
      measurementBulletinImportId: "id-inexistente"
    });

    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "import_not_found");
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
