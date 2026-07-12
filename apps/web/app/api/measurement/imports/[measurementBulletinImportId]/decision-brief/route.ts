import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { buildMeasurementDecisionBriefImportReader, handleGetMeasurementDecisionBrief } from "./measurement-decision-brief-route-handler";

/**
 * Epic 20 (Decision Experience), Sprint 20.1D — Measurement Decision
 * Brief Delivery Boundary. Único ponto de contato HTTP para o
 * Application Service do 20.1C -- autentica, resolve o tenant, compõe
 * o reader contra o repository real do Epic 19 e devolve o
 * `DecisionBrief` exatamente como o Application Service o produziu.
 * Nunca recalcula readiness/confidence, nunca chama o builder
 * diretamente, nunca examina `structuralIssues`.
 *
 * Arquivo especial do App Router: só pode exportar métodos HTTP e as
 * configurações oficiais de segmento (`dynamic` aqui) -- toda a lógica
 * testável vive em `measurement-decision-brief-route-handler.ts`,
 * arquivo irmão.
 *
 * `dynamic = "force-dynamic"`: mesmo requisito já confirmado por
 * `bba-project/advisor/route.ts` e `execution/tasks/route.ts` -- sem
 * isso, o Next tenta prerenderizar esta rota em build-time (sem as
 * env vars do Supabase disponíveis no CI) e quebra o build.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: { measurementBulletinImportId: string } }): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  try {
    const outcome = await handleGetMeasurementDecisionBrief(
      {
        auth,
        measurementBulletinImportId: context.params.measurementBulletinImportId,
        generatedAt: new Date().toISOString()
      },
      { importReader: buildMeasurementDecisionBriefImportReader(supabase) }
    );

    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    console.error("[measurement-decision-brief] Falha ao montar o Decision Brief.", error);
    return NextResponse.json({ error: "measurement_decision_brief_failed" }, { status: 500 });
  }
}
