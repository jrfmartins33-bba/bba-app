import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data, error } = await supabase.rpc("get_consolidated_budget_summary", { p_company_id: auth.companyId });
  if (error) {
    console.error("[orcamentos/consolidado/resumo] Falha ao carregar resumo.", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  return NextResponse.json({ budget: data });
}
