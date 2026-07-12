import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConfirmMeasurementBulletinUploadInput,
  ConfirmMeasurementBulletinUploadResult,
  PrepareMeasurementBulletinUploadInput,
  PrepareMeasurementBulletinUploadResult
} from "@bba/bdos-core/services/measurement-bulletin-import";
import { getMeasurementBulletinImportById, insertMeasurementBulletinImport, updateMeasurementBulletinImportStatus } from "./measurement-repository";

// Application Service do ciclo de vida do upload (Epic 19, Sprint
// 4B) -- separado de measurement-bulletin-import-service.ts
// (processamento) porque é uma responsabilidade distinta: aqui só
// cuida de "o arquivo chegou até o Storage com segurança", nunca
// interpreta o Excel. Mesmo raciocínio de separação já usado entre
// measurement-repository.ts e o Application Service de processamento.
//
// Reaproveita quase integralmente o desenho do Epic 18 (Resilient
// Planning Import) -- ver packages/bdos-core/docs/RESILIENT_PLANNING_IMPORT.md
// e packages/bdos-core/docs/EPIC_19_SPRINT_4B_RESILIENT_UPLOAD_DESIGN.md
// para o raciocínio completo. Única diferença estrutural real: estas
// funções SÃO a Application Service que o Measurement Studio exige
// (contrato congelado na Sprint 4.0) -- o Epic 18 nunca teve essa
// camada, suas rotas chamam repository.ts direto.
//
// Princípio de Resolução de Contexto (registrado no desenho da 19.4B):
// `companyId`/`engineeringProjectId` chegam aqui JÁ resolvidos pela
// rota -- esta Application Service nunca descobre sessão, nunca
// localiza ou cria um projeto/workspace padrão. Isso pertence à
// camada HTTP/Application Boundary, não a uma regra de negócio do
// Studio de Medições.

const STORAGE_BUCKET = "bdos-imports";

// Mesmo valor e mesmo raciocínio do Epic 18 (prepare-upload/route.ts):
// recomendação de confiabilidade da própria Supabase para upload
// padrão (não-resumível), não um teto tecnicamente imposto pelo
// bucket (file_size_limit de bdos-imports é null). Redeclarado aqui
// -- nunca importado de dentro de uma rota, mesmo padrão já usado
// para RECONCILIATION_EPSILON/TOTAL_DIFFERENCE_TOLERANCE.
const MAX_STANDARD_UPLOAD_BYTES = 6 * 1024 * 1024;

// Só um formato aceito -- diferente do Epic 18 (dois formatos,
// MS Project XML ou Excel, com sniffing para desambiguar). Não há
// segundo parser real ainda (R6, Parte XII do desenho da 19.4D): sem
// evidência de um segundo layout de boletim, não construir seleção de
// formato agora.
const SUPPORTED_EXTENSION = ".xlsx";
const SUPPORTED_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isSupportedFileType(fileName: string, contentType: string): boolean {
  return fileName.toLowerCase().endsWith(SUPPORTED_EXTENSION) || contentType === SUPPORTED_MIME_TYPE;
}

// Validação "leve" (extensão/MIME, sem bytes -- o arquivo ainda não
// existe no servidor neste ponto do fluxo, mesmo raciocínio do Epic
// 18). O parser (importBulletinExcel) já falha explicitamente
// (parse_failed, 19.4D.2) se os bytes reais não forem um .xlsx válido
// -- esta validação aqui é só uma primeira barreira barata, nunca a
// única linha de defesa.
export async function prepareMeasurementBulletinUpload(
  supabase: SupabaseClient,
  input: PrepareMeasurementBulletinUploadInput
): Promise<PrepareMeasurementBulletinUploadResult> {
  if (!isSupportedFileType(input.fileName, input.contentType)) {
    return { success: false, error: "unsupported_file_type" };
  }

  if (input.sizeBytes > MAX_STANDARD_UPLOAD_BYTES) {
    return { success: false, error: "file_too_large" };
  }

  const measurementBulletinImportId = randomUUID();
  // Convenção já congelada na Sprint 4.0 (Parte III do desenho da
  // 19.4D): segmento "measurement/" entre companyId e
  // engineeringProjectId, distinguindo do path de planning_imports.
  const storagePath = `${input.companyId}/measurement/${input.engineeringProjectId}/${measurementBulletinImportId}/${input.fileName}`;

  await insertMeasurementBulletinImport(supabase, {
    id: measurementBulletinImportId,
    companyId: input.companyId,
    engineeringProjectId: input.engineeringProjectId,
    fileName: input.fileName,
    storagePath,
    uploadedBy: input.uploadedBy
    // status omitido de propósito -- DEFAULT 'pending_upload' do schema
    // decide, mesmo padrão de insertPlanningImport/insertMeasurementBulletinImport.
  });

  return { success: true, measurementBulletinImportId, storagePath };
}

// Confirma que o objeto existe no Storage (storage.list(), nunca
// .download() -- o download real só acontece uma vez, dentro de
// processMeasurementBulletinImport) e transiciona
// pending_upload -> uploaded. Nunca confia num storagePath vindo do
// cliente -- getMeasurementBulletinImportById sempre lê o que o
// próprio prepare-upload persistiu.
export async function confirmMeasurementBulletinUpload(
  supabase: SupabaseClient,
  input: ConfirmMeasurementBulletinUploadInput
): Promise<ConfirmMeasurementBulletinUploadResult> {
  const importRecord = await getMeasurementBulletinImportById(supabase, {
    id: input.measurementBulletinImportId,
    companyId: input.companyId
  });

  if (!importRecord) {
    return { success: false, error: "import_not_found" };
  }

  // Idempotente: já confirmado antes (ou já foi além) -- nunca um erro.
  if (importRecord.status === "uploaded" || importRecord.status === "processing" || importRecord.status === "completed") {
    return { success: true };
  }

  if (importRecord.status !== "pending_upload") {
    return { success: false, error: "invalid_status_for_confirmation" };
  }

  const lastSlash = importRecord.storagePath.lastIndexOf("/");
  const folderPath = importRecord.storagePath.slice(0, lastSlash);
  const objectName = importRecord.storagePath.slice(lastSlash + 1);

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(folderPath, { search: objectName });
  if (error) {
    throw error;
  }

  const found = (data ?? []).some((entry) => entry.name === objectName);
  if (!found) {
    return { success: false, error: "upload_not_found" };
  }

  await updateMeasurementBulletinImportStatus(supabase, {
    id: importRecord.id,
    companyId: input.companyId,
    status: "uploaded"
  });

  return { success: true };
}
