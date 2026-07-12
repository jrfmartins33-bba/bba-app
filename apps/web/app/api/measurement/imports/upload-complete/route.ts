import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { confirmMeasurementBulletinUpload } from "@/lib/bdos/measurement-bulletin-upload-service";

/**
 * Resilient Measurement Bulletin Upload (Epic 19, Sprint 4B), Etapa
 * "upload-complete" -- ver
 * packages/bdos-core/docs/EPIC_19_SPRINT_4B_RESILIENT_UPLOAD_DESIGN.md.
 * Rota fina: só desembrulha o corpo e chama
 * `confirmMeasurementBulletinUpload` (Application Service) -- toda
 * decisão (idempotência, existência do objeto no Storage, transição
 * de status) já mora lá.
 */
interface UploadCompleteRequestBody {
  readonly measurementBulletinImportId: string;
}

function isValidRequestBody(body: unknown): body is UploadCompleteRequestBody {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const candidate = body as Record<string, unknown>;
  return typeof candidate.measurementBulletinImportId === "string" && candidate.measurementBulletinImportId.trim().length > 0;
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
    return NextResponse.json({ error: "invalid_upload_complete_body" }, { status: 400 });
  }

  try {
    const result = await confirmMeasurementBulletinUpload(supabase, {
      companyId: auth.companyId,
      measurementBulletinImportId: body.measurementBulletinImportId
    });

    if (!result.success) {
      const status = result.error === "import_not_found" ? 404 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ status: "uploaded" });
  } catch (error) {
    console.error("[measurement-imports] Falha ao confirmar upload.", error);
    return NextResponse.json({ error: "upload_complete_failed" }, { status: 500 });
  }
}
