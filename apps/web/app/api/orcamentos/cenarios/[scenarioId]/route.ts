import { NextResponse } from "next/server";
import { getProposalScenarioService } from "@bba/bdos-core/services/proposal-scenarios";
import { createProposalScenarioRepository } from "@/lib/bdos/proposal-scenario-server-repository";
import { getSupabaseRouteHandlerClient, getSupabaseServiceRoleClient, requireAuthenticatedCompany } from "@/lib/supabase/server";

interface RouteParams {
  readonly params: { readonly scenarioId: string };
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const readClient = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(readClient);
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const repository = createProposalScenarioRepository(readClient, getSupabaseServiceRoleClient());
  const result = await getProposalScenarioService(
    { organizationId: auth.companyId, actor: auth.userId },
    params.scenarioId,
    repository,
  );
  if (result.outcome === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (result.outcome === "persistence_failure") {
    console.error("[orcamentos/cenarios/:id] Falha ao abrir cenário.", result.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  return NextResponse.json({
    scenario: {
      id: result.scenario.id,
      sourceBudgetId: result.scenario.sourceBudgetVersionId,
      name: result.scenario.name,
      officialValueCents: result.scenario.officialValueCents,
      targetValueCents: result.scenario.targetValueCents,
      differenceCents: result.scenario.differenceCents,
      differenceBasisPoints: result.scenario.differenceBasisPoints,
      comparisonKind: result.scenario.comparisonKind,
      createdAt: result.scenario.createdAt,
    },
  });
}
