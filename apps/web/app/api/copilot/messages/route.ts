import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { listCopilotMessages } from "@/lib/bdos/copilot-repository";

/**
 * Decision Copilot (Epic 15, Fase 1) — histórico de uma conversa, para a
 * UI reconstruir o que já foi dito ao (re)abrir. RLS
 * (copilot_messages_select_company_or_admin) já garante que só mensagens
 * da própria empresa (ou admin BBA) retornam — esta rota não faz nenhum
 * filtro adicional de propriedade além de exigir autenticação.
 *
 * `force-dynamic`: mesmo motivo documentado em
 * apps/web/app/api/bba-project/advisor/route.ts (Sprint 13.10) — rota
 * GET dependente de cookie de sessão por requisição; sem isso o Next
 * tenta prerenderizar em build-time e quebra o CI (sem
 * NEXT_PUBLIC_SUPABASE_URL/KEY no ambiente de build).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  if (!auth) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const conversationId = new URL(request.url).searchParams.get("conversationId");

  if (!conversationId) {
    return NextResponse.json({ error: "missing_conversation_id" }, { status: 400 });
  }

  try {
    const messages = await listCopilotMessages(supabase, conversationId);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[copilot-messages] Falha ao buscar histórico.", error);
    return NextResponse.json({ error: "copilot_messages_failed" }, { status: 500 });
  }
}
