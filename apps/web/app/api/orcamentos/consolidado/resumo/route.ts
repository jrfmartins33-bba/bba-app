import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { loadConsolidatedBudgetCatalog } from "@/lib/bdos/consolidated-budget-catalog-server";
import { createProposalScenarioRepository } from "@/lib/bdos/proposal-scenario-server-repository";
import { listProposalScenariosService } from "@bba/bdos-core/services/proposal-scenarios";
import {
  authenticateBudgetOrganizationActor,
  resolveBudgetCatalogContext,
  resolveBudgetVersionContext,
} from "@/lib/bdos/budget-organization-context-server";

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const url = new URL(request.url);
  const requestedBudgetId = url.searchParams.get("orcamento");
  const requestedOrganizationId = url.searchParams.get("empresa");

  try {
    const context = requestedBudgetId
      ? await resolveExactBudgetContext(supabase, requestedBudgetId, requestedOrganizationId)
      : await resolveBudgetCatalogContext(supabase, requestedOrganizationId);

    if (context.status === "unauthenticated") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (context.status === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (context.status === "not_found") {
      return NextResponse.json({ error: "budget_not_found" }, { status: 404 });
    }
    if (context.status === "selection_required") {
      return NextResponse.json({
        budgets: [],
        processes: [],
        budget: null,
        accessKind: context.actor.accessKind,
        organization: null,
        organizations: context.organizations,
        organizationSelectionRequired: true,
      });
    }

    const scenarioRepository = createProposalScenarioRepository(context.queryClient, getSupabaseServiceRoleClient());
    const [catalog, scenarioResult] = await Promise.all([
      loadConsolidatedBudgetCatalog(context.queryClient, context.organization.id),
      listProposalScenariosService(
        { organizationId: context.organization.id, actor: context.actor.userId },
        requestedBudgetId ?? undefined,
        scenarioRepository,
      ),
    ]);
    const scenarios = scenarioResult.outcome === "success" ? scenarioResult.scenarios.map(toDto) : [];
    const budget = requestedBudgetId
      ? catalog.budgets.find((candidate) => candidate.id === requestedBudgetId) ?? null
      : catalog.budgets.length === 1 ? catalog.budgets[0] : null;
    return NextResponse.json({
      ...catalog,
      scenarios,
      budget,
      accessKind: context.actor.accessKind,
      organization: context.organization,
      organizations: context.organizations,
      organizationSelectionRequired: false,
    });
  } catch (error) {
    console.error("[orcamentos/consolidado/resumo] Falha ao carregar resumo.", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}

function toDto(scenario: {
  readonly id: string; readonly sourceBudgetVersionId: string; readonly name: string;
  readonly officialValueCents: number; readonly targetValueCents: number; readonly differenceCents: number;
  readonly differenceBasisPoints: string; readonly comparisonKind: string; readonly createdAt: string;
}) {
  return {
    id: scenario.id,
    sourceBudgetId: scenario.sourceBudgetVersionId,
    name: scenario.name,
    officialValueCents: scenario.officialValueCents,
    targetValueCents: scenario.targetValueCents,
    differenceCents: scenario.differenceCents,
    differenceBasisPoints: scenario.differenceBasisPoints,
    comparisonKind: scenario.comparisonKind,
    createdAt: scenario.createdAt,
  };
}

async function resolveExactBudgetContext(
  supabase: ReturnType<typeof getSupabaseRouteHandlerClient>,
  budgetVersionId: string,
  requestedOrganizationId: string | null,
) {
  const authentication = await authenticateBudgetOrganizationActor(supabase);
  if (authentication.status !== "authenticated") return authentication;
  return resolveBudgetVersionContext(
    supabase,
    authentication.actor,
    budgetVersionId,
    requestedOrganizationId,
  );
}
