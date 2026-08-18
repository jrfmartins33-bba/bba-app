import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { loadConsolidatedBudgetCatalog } from "@/lib/bdos/consolidated-budget-catalog-server";
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

    const catalog = await loadConsolidatedBudgetCatalog(context.queryClient, context.organization.id);
    const budget = requestedBudgetId
      ? catalog.budgets.find((candidate) => candidate.id === requestedBudgetId) ?? null
      : catalog.budgets.length === 1 ? catalog.budgets[0] : null;
    return NextResponse.json({
      ...catalog,
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
