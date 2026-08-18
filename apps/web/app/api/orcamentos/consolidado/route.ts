import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { createBudgetVersionRepository } from "@/lib/bdos/procurement-engineering-server-repository";

// /orcamentos (Cliente) — enunciado §44/§45: só BudgetVersion já
// Consolidated, nunca diagnóstico técnico (fingerprint/grammarId/
// evidence IDs/engineVersion — tudo isso fica em budget_review_rows,
// nunca lido por esta rota). Autenticação comum (não Admin) — RLS de
// budget_versions já restringe a `company_id = get_my_company_id()`.

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  if (!auth) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: latest, error } = await supabase
    .from("budget_versions")
    .select("id")
    .eq("company_id", auth.companyId)
    .eq("status", "Consolidated")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[orcamentos/consolidado] falha ao localizar Versão consolidada.", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  if (latest === null) {
    return NextResponse.json({ budget: null });
  }

  const repository = createBudgetVersionRepository(supabase);
  const persisted = await repository.loadBudgetVersion(auth.companyId, latest.id);

  if (persisted === null) {
    return NextResponse.json({ budget: null });
  }

  return NextResponse.json({ budget: persisted.entity });
}
