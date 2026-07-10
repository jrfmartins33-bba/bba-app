import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { getPlanningImportById, updatePlanningImportStatus } from "@/lib/bdos/repository";

const BUCKET_NAME = "bdos-imports";

/**
 * Resilient Planning Import (Epic 18), Etapa "upload-complete"
 * (Ajuste 3 da revisão do CPO) — ver
 * packages/bdos-core/docs/RESILIENT_PLANNING_IMPORT.md. Separa
 * "confirmar que o upload aconteceu" de "começar a processar":
 * confirma a existência do objeto via `storage.list()` (nunca um
 * download completo — o download de verdade só acontece em
 * `process`, uma vez, não duas) e transiciona
 * `pending_upload -> uploaded`.
 *
 * Nunca confia num storagePath vindo do cliente — `getPlanningImportById`
 * sempre lê o que o próprio `prepare-upload` persistiu.
 */
interface UploadCompleteRequestBody {
  readonly planningImportId: string;
}

function isValidRequestBody(body: unknown): body is UploadCompleteRequestBody {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const candidate = body as Record<string, unknown>;
  return typeof candidate.planningImportId === "string" && candidate.planningImportId.trim().length > 0;
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

  const { companyId } = auth;

  let planningImport;
  try {
    planningImport = await getPlanningImportById(supabase, { id: body.planningImportId, companyId });
  } catch (error) {
    console.error("[bba-project-imports] Falha ao carregar planning_import.", error);
    return NextResponse.json({ error: "upload_complete_failed" }, { status: 500 });
  }

  if (!planningImport) {
    return NextResponse.json({ error: "planning_import_not_found" }, { status: 404 });
  }

  if (planningImport.status === "uploaded" || planningImport.status === "processing" || planningImport.status === "completed") {
    // Idempotente: já confirmado antes (ou já foi além) — nunca um erro.
    return NextResponse.json({ status: planningImport.status });
  }

  if (planningImport.status !== "pending_upload") {
    return NextResponse.json({ error: "invalid_status_for_upload_complete", status: planningImport.status }, { status: 409 });
  }

  const lastSlash = planningImport.storagePath.lastIndexOf("/");
  const folderPath = planningImport.storagePath.slice(0, lastSlash);
  const objectName = planningImport.storagePath.slice(lastSlash + 1);

  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list(folderPath, { search: objectName });

    if (error) {
      throw error;
    }

    const found = (data ?? []).some((entry) => entry.name === objectName);

    if (!found) {
      return NextResponse.json({ error: "upload_not_found" }, { status: 409 });
    }

    await updatePlanningImportStatus(supabase, { id: planningImport.id, companyId, status: "uploaded" });

    return NextResponse.json({ status: "uploaded" });
  } catch (error) {
    console.error("[bba-project-imports] Falha ao confirmar upload.", error);
    return NextResponse.json({ error: "upload_complete_failed" }, { status: 500 });
  }
}
