import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedActor } from "@/lib/supabase/server";
import { buildManagerialControlReader, handleGetManagerialControl } from "./managerial-control-route-handler";

/**
 * "Controle Gerencial da Execução" — posição item a item do contrato.
 * Somente leitura: nunca formaliza, nunca certifica, nunca escreve.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: { measurementBulletinImportId: string } }): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedActor(supabase);

  try {
    const outcome = await handleGetManagerialControl(
      { auth, measurementBulletinImportId: context.params.measurementBulletinImportId },
      { reader: buildManagerialControlReader(supabase) }
    );
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    console.error("[measurement-managerial-control] Falha ao carregar o controle gerencial.", error);
    return NextResponse.json({ error: "managerial_control_failed" }, { status: 500 });
  }
}
