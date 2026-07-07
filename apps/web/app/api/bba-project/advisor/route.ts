import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { getEngineeringAdvisorBriefing } from "@/lib/bdos/advisor";

/**
 * Home "Hoje" — Advisor de Engenharia (Sprint 13.10). Único ponto de
 * contato entre a Home e `@/lib/bdos/advisor`: resolve a empresa do
 * usuário autenticado e devolve a narrativa já pronta. Nenhum cálculo
 * vive aqui nem em `advisor.ts` — só leitura do que os Sprints
 * 13.4-13.9 já gravam.
 *
 * `force-dynamic`: é o primeiro Route Handler GET-only desta API (os
 * outros são POST-only, nunca elegíveis para prerender estático). Sem
 * isso, o Next tenta executar esta rota em build-time para ver se dá
 * para gerar estático, o que quebra o build no CI (sem
 * NEXT_PUBLIC_SUPABASE_URL/KEY no ambiente) — confirmado ao reproduzir
 * o build do CI localmente. Esta rota depende de cookie de sessão por
 * requisição; nunca pode ser estática de verdade.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  if (!auth) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const briefing = await getEngineeringAdvisorBriefing(supabase, auth.companyId);
    return NextResponse.json(briefing);
  } catch (error) {
    console.error("[bba-project-advisor] Falha ao montar o briefing.", error);
    return NextResponse.json({ error: "advisor_failed" }, { status: 500 });
  }
}
