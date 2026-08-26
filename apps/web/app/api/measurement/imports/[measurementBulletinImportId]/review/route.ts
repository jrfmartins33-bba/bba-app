import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedActor } from "@/lib/supabase/server";
import {
  buildMeasurementBulletinReviewReader,
  buildMeasurementReviewDecisionBriefReader,
  handleGetMeasurementBulletinReview
} from "./measurement-bulletin-review-route-handler";

/**
 * "Revisar medição" — leitura somente-leitura combinando o
 * DecisionBrief já existente (classificação material/observação
 * técnica) com o boletim formal completo (itens, totais,
 * rastreabilidade). Nunca formaliza, nunca certifica, nunca escreve.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: { measurementBulletinImportId: string } }): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedActor(supabase);

  try {
    const outcome = await handleGetMeasurementBulletinReview(
      { auth, measurementBulletinImportId: context.params.measurementBulletinImportId, generatedAt: new Date().toISOString() },
      {
        decisionBriefReader: buildMeasurementReviewDecisionBriefReader(supabase),
        reviewReader: buildMeasurementBulletinReviewReader(supabase)
      }
    );

    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    console.error("[measurement-bulletin-review] Falha ao carregar a revisão do boletim.", error);
    return NextResponse.json({ error: "measurement_bulletin_review_failed" }, { status: 500 });
  }
}
