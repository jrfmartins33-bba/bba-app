import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedActor } from "@/lib/supabase/server";
import {
  buildMeasurementCertificationPreviewDecisionBriefReader,
  buildMeasurementCertificationPreviewReader,
  handleGetMeasurementCertificationPreview
} from "./measurement-certification-preview-route-handler";

/**
 * Prévia determinística de certificação — leitura pura (acumulado
 * antes/valor desta medição/acumulado depois/saldo contratual depois).
 * Nunca certifica, nunca escreve.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: { measurementBulletinImportId: string } }): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedActor(supabase);

  try {
    const outcome = await handleGetMeasurementCertificationPreview(
      { auth, measurementBulletinImportId: context.params.measurementBulletinImportId, generatedAt: new Date().toISOString() },
      {
        decisionBriefReader: buildMeasurementCertificationPreviewDecisionBriefReader(supabase),
        previewReader: buildMeasurementCertificationPreviewReader(supabase)
      }
    );

    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    console.error("[measurement-certification-preview] Falha ao calcular a prévia de certificação.", error);
    return NextResponse.json({ error: "measurement_certification_preview_failed" }, { status: 500 });
  }
}
