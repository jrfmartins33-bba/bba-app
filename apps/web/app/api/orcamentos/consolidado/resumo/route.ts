import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { loadConsolidatedBudgetCatalog } from "@/lib/bdos/consolidated-budget-catalog-server";

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const catalog = await loadConsolidatedBudgetCatalog(supabase, auth.companyId);
    const requestedBudgetId = new URL(request.url).searchParams.get("orcamento");
    const budget = requestedBudgetId
      ? catalog.budgets.find((candidate) => candidate.id === requestedBudgetId) ?? null
      : catalog.budgets.length === 1 ? catalog.budgets[0] : null;
    return NextResponse.json({ ...catalog, budget });
  } catch (error) {
    console.error("[orcamentos/consolidado/resumo] Falha ao carregar resumo.", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
