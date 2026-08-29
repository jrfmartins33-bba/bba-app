import { NextResponse } from "next/server";
import { getProposalScenarioService } from "@bba/bdos-core/services/proposal-scenarios";
import { createProposalScenarioRepository } from "@/lib/bdos/proposal-scenario-server-repository";
import { getSupabaseRouteHandlerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { authenticateBudgetOrganizationActor, resolveScenarioContext } from "@/lib/bdos/budget-organization-context-server";

interface RouteParams {
  readonly params: { readonly scenarioId: string };
}

export async function GET(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const readClient = getSupabaseRouteHandlerClient();
  const authentication = await authenticateBudgetOrganizationActor(readClient);
  if (authentication.status === "unauthenticated") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (authentication.status === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const context = await resolveScenarioContext(
    readClient,
    authentication.actor,
    params.scenarioId,
    new URL(request.url).searchParams.get("empresa"),
  );
  if (context.status === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (context.status === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (context.status !== "resolved") return NextResponse.json({ error: context.status }, { status: 401 });

  const repository = createProposalScenarioRepository(context.queryClient, getSupabaseServiceRoleClient());
  const result = await getProposalScenarioService(
    { organizationId: context.organization.id, actor: context.actor.userId },
    params.scenarioId,
    repository,
  );
  if (result.outcome === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (result.outcome === "persistence_failure") {
    console.error("[orcamentos/cenarios/:id] Falha ao abrir cenário.", result.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  return NextResponse.json({
    organization: context.organization,
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
