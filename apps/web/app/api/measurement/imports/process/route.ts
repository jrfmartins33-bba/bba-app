import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { processMeasurementBulletinImport } from "@/lib/bdos/measurement-bulletin-import-service";

/**
 * Resilient Measurement Bulletin Upload (Epic 19, Sprint 4B), Etapa
 * "process" -- ver
 * packages/bdos-core/docs/EPIC_19_SPRINT_4B_RESILIENT_UPLOAD_DESIGN.md.
 * A rota mais simples das três: `processMeasurementBulletinImport`
 * (Application Service, 19.4D.2) já existe e já foi validado ponta a
 * ponta contra o BM_08 real. Nenhum campo é reformatado -- devolve
 * exatamente `ProcessMeasurementBulletinImportResult`, sempre com
 * HTTP 200 (o discriminante `success`/`outcome.kind` já carrega toda
 * a semântica; nenhuma reinterpretação de status HTTP é necessária
 * para o cliente decidir o que fazer).
 */
interface ProcessRequestBody {
  readonly measurementBulletinImportId: string;
}

function isValidRequestBody(body: unknown): body is ProcessRequestBody {
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
    return NextResponse.json({ error: "invalid_process_body" }, { status: 400 });
  }

  try {
    const result = await processMeasurementBulletinImport(supabase, {
      companyId: auth.companyId,
      measurementBulletinImportId: body.measurementBulletinImportId
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[measurement-imports] Falha ao processar boletim.", error);
    return NextResponse.json({ error: "process_failed" }, { status: 500 });
  }
}
