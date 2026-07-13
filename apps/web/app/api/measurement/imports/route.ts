import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { buildMeasurementImportsListReader, handleListMeasurementImports } from "./measurement-imports-list-route-handler";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.1A — Measurement
 * Imports Listing Boundary. Lista os boletins/importações da empresa
 * autenticada, tenant-scoped -- base de navegação para a futura
 * `/medicoes` (20.1E.1B). Nenhuma interpretação de `analysis_result`,
 * nenhum recálculo de status.
 *
 * `dynamic = "force-dynamic"`: mesmo requisito confirmado por build
 * real no 20.1D.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  try {
    const outcome = await handleListMeasurementImports({ auth }, { importsListReader: buildMeasurementImportsListReader(supabase) });
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    console.error("[measurement-imports] Falha ao listar importações.", error);
    return NextResponse.json({ error: "measurement_imports_list_failed" }, { status: 500 });
  }
}
