import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, getSupabaseServiceRoleClient, requireAuthenticatedActor } from "@/lib/supabase/server";
import { buildMeasurementCertifyReader, buildMeasurementCertifyWriter, handlePostMeasurementCertify } from "./measurement-certify-route-handler";

/**
 * Certificar medição — a ÚNICA rota de escrita de negócio entre as
 * telas desta rodada ("Revisar medição"). Ver a nota de segurança em
 * measurement-certify-route-handler.ts: pronta e testada, mas não deve
 * ser exercida contra o BM_08 real nem produção nesta rodada.
 */
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: { measurementBulletinImportId: string } }): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedActor(supabase);

  try {
    const outcome = await handlePostMeasurementCertify(
      { auth, measurementBulletinImportId: context.params.measurementBulletinImportId, occurredAt: new Date().toISOString() },
      {
        reader: buildMeasurementCertifyReader(supabase),
        writer: buildMeasurementCertifyWriter(getSupabaseServiceRoleClient())
      }
    );

    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    console.error("[measurement-certify] Falha ao certificar a medição.", error);
    return NextResponse.json({ error: "measurement_certify_failed" }, { status: 500 });
  }
}
