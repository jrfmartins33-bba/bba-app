import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { ensureDefaultEngineeringProject, ensureEngenhariaWorkspace } from "@/lib/bdos/repository";
import { prepareMeasurementBulletinUpload } from "@/lib/bdos/measurement-bulletin-upload-service";

/**
 * Resilient Measurement Bulletin Upload (Epic 19, Sprint 4B), Etapa A
 * -- ver packages/bdos-core/docs/EPIC_19_SPRINT_4B_RESILIENT_UPLOAD_DESIGN.md.
 * Mesmo desenho do Epic 18 (RESILIENT_PLANNING_IMPORT.md): não emite
 * signed URL própria -- o RLS de `storage.objects` já autoriza upload
 * direto no bucket `bdos-imports`, contanto que o path comece com o
 * `company_id` da sessão.
 *
 * Princípio de Resolução de Contexto (registrado no desenho): esta
 * rota resolve `companyId`/`engineeringProjectId` -- infraestrutura de
 * sessão, nunca regra de negócio -- e só então chama
 * `prepareMeasurementBulletinUpload` (Application Service) já com o
 * contexto pronto. A Application Service nunca sabe como a sessão
 * funciona nem como localizar/criar o projeto padrão.
 */
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

  const { companyId, userId } = auth;

  try {
    const workspace = await ensureEngenhariaWorkspace(supabase, companyId);
    const engineeringProject = await ensureDefaultEngineeringProject(supabase, companyId, workspace.id);

    if (body.engineeringProjectId !== undefined && body.engineeringProjectId !== engineeringProject.id) {
      return NextResponse.json({ error: "project_id_mismatch" }, { status: 409 });
    }

    const result = await prepareMeasurementBulletinUpload(supabase, {
      companyId,
      engineeringProjectId: engineeringProject.id,
      fileName: body.fileName,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      uploadedBy: userId
    });

    if (!result.success) {
      const status = result.error === "file_too_large" ? 413 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ measurementBulletinImportId: result.measurementBulletinImportId, storagePath: result.storagePath });
  } catch (error) {
    console.error("[measurement-imports] Falha ao preparar upload.", error);
    return NextResponse.json({ error: "prepare_upload_failed" }, { status: 500 });
  }
}
