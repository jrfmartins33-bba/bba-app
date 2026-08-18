import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { createBudgetVersionRepository } from "@/lib/bdos/procurement-engineering-server-repository";

// /orcamentos (Cliente) — enunciado §44/§45: só BudgetVersion já
// Consolidated, nunca diagnóstico técnico (fingerprint/grammarId/
// evidence IDs/engineVersion — tudo isso fica em budget_review_rows,
// nunca lido por esta rota). Autenticação comum (não Admin) — RLS de
// budget_versions já restringe a `company_id = get_my_company_id()`.

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  if (!auth) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const requestedBudgetId = new URL(request.url).searchParams.get("orcamento");
  let budgetVersionId = requestedBudgetId;

  if (!budgetVersionId) {
    const { data: available, error } = await supabase
      .from("budget_versions")
      .select("id")
      .eq("company_id", auth.companyId)
      .eq("status", "Consolidated")
      .order("updated_at", { ascending: false })
      .limit(2);

    if (error) {
      console.error("[orcamentos/consolidado] falha ao localizar Versões consolidadas.", error);
      return NextResponse.json({ error: "query_failed" }, { status: 500 });
    }
    if ((available ?? []).length === 0) return NextResponse.json({ budget: null });
    if ((available ?? []).length > 1) {
      return NextResponse.json({ budget: null, error: "selection_required" }, { status: 409 });
    }
    budgetVersionId = available![0].id;
  }

  const { data: selected, error } = await supabase
    .from("budget_versions")
    .select("id")
    .eq("company_id", auth.companyId)
    .eq("status", "Consolidated")
    .eq("id", budgetVersionId)
    .maybeSingle();

  if (error) {
    console.error("[orcamentos/consolidado] falha ao localizar a Versão consolidada solicitada.", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  if (selected === null) {
    return NextResponse.json({ budget: null });
  }

  const repository = createBudgetVersionRepository(supabase);
  const persisted = await repository.loadBudgetVersion(auth.companyId, selected.id);

  if (persisted === null) {
    return NextResponse.json({ budget: null });
  }

  return NextResponse.json({ budget: persisted.entity });
}
