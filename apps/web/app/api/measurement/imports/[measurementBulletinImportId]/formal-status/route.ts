import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import {
  buildMeasurementBulletinFormalStatusReader,
  handleGetMeasurementBulletinFormalStatus
} from "./measurement-bulletin-formal-status-route-handler";

/**
 * Etapa 3C.2 (BM_08) — leitura somente-leitura do estado formal já
 * persistido do boletim (envelope da Etapa 3C.1C + fontes relacionais
 * + ciclo). Nunca formaliza, nunca certifica, nunca escreve.
 *
 * `dynamic = "force-dynamic"`: mesmo requisito já confirmado pelas
 * demais rotas de measurement/imports.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: { measurementBulletinImportId: string } }): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  try {
    const outcome = await handleGetMeasurementBulletinFormalStatus(
      { auth, measurementBulletinImportId: context.params.measurementBulletinImportId },
      { reader: buildMeasurementBulletinFormalStatusReader(supabase) }
    );

    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    console.error("[measurement-bulletin-formal-status] Falha ao ler o estado formal do boletim.", error);
    return NextResponse.json({ error: "measurement_bulletin_formal_status_failed" }, { status: 500 });
  }
}
