import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { ensureDefaultEngineeringProject, ensureEngenhariaWorkspace, insertPlanningImport } from "@/lib/bdos/repository";
import { detectPlanningImportSourceType } from "@/lib/bdos/planning-import-source-type";

/**
 * Resilient Planning Import (Epic 18), Etapa A — ver
 * packages/bdos-core/docs/RESILIENT_PLANNING_IMPORT.md. Único ponto
 * que decide o `storagePath` canônico e reserva o `planning_imports`
 * ANTES do upload existir (`status = 'pending_upload'`, default do
 * schema) — é isto que torna um upload abandonado rastreável, não uma
 * lacuna silenciosa.
 *
 * Não emite signed URL própria: o RLS de `storage.objects`
 * (`supabase/migrations/20260707190000_bdos_storage.sql`) já autoriza
 * a sessão do próprio usuário a fazer upload direto no bucket
 * `bdos-imports`, contanto que o path comece com o `company_id`
 * dele — é exatamente o que este endpoint constrói e devolve.
 *
 * Validação de tipo aqui é "leve" (extensão/MIME, sem bytes — o
 * arquivo ainda não existe no servidor). O sniffing completo (que
 * hoje protege contra extensão/MIME incorretos) só volta a rodar em
 * `process`, depois do download real — ver `detectPlanningImportSourceType`.
 */
const MAX_STANDARD_UPLOAD_BYTES = 6 * 1024 * 1024; // ~6 MB — recomendação da própria Supabase para upload padrão (não-resumível), não um teto tecnicamente imposto pelo bucket (file_size_limit confirmado null). Revisitar se/quando TUS/resumable for implementado.

interface PrepareUploadRequestBody {
  readonly engineeringProjectId?: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

function isValidRequestBody(body: unknown): body is PrepareUploadRequestBody {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const candidate = body as Record<string, unknown>;

  return (
    typeof candidate.fileName === "string" &&
    candidate.fileName.trim().length > 0 &&
    typeof candidate.contentType === "string" &&
    typeof candidate.sizeBytes === "number" &&
    Number.isFinite(candidate.sizeBytes) &&
    candidate.sizeBytes > 0 &&
    (candidate.engineeringProjectId === undefined || typeof candidate.engineeringProjectId === "string")
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  if (!auth) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  if (!isValidRequestBody(body)) {
    return NextResponse.json({ error: "invalid_prepare_upload_body" }, { status: 400 });
  }

  if (body.sizeBytes > MAX_STANDARD_UPLOAD_BYTES) {
    return NextResponse.json({ error: "file_too_large_for_standard_upload" }, { status: 413 });
  }

  const sourceType = detectPlanningImportSourceType(body.fileName, body.contentType);
  if (sourceType === null) {
    return NextResponse.json({ error: "unsupported_file_type" }, { status: 400 });
  }

  const { companyId, userId } = auth;

  try {
    const workspace = await ensureEngenhariaWorkspace(supabase, companyId);
    const engineeringProject = await ensureDefaultEngineeringProject(supabase, companyId, workspace.id);

    if (body.engineeringProjectId !== undefined && body.engineeringProjectId !== engineeringProject.id) {
      return NextResponse.json({ error: "project_id_mismatch" }, { status: 409 });
    }

    const planningImportId = randomUUID();
    const storagePath = `${companyId}/${engineeringProject.id}/${planningImportId}/${body.fileName}`;

    await insertPlanningImport(supabase, {
      id: planningImportId,
      companyId,
      engineeringProjectId: engineeringProject.id,
      sourceType,
      fileName: body.fileName,
      storagePath,
      uploadedBy: userId
      // status omitido de propósito — DEFAULT 'pending_upload' do schema.
    });

    return NextResponse.json({ planningImportId, storagePath });
  } catch (error) {
    console.error("[bba-project-imports] Falha ao preparar upload.", error);
    return NextResponse.json({ error: "prepare_upload_failed" }, { status: 500 });
  }
}
