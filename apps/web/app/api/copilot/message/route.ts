import { NextResponse } from "next/server";
import { resolveCopilotTurn } from "@bba/bdos-core/advisor/copilot/copilot-turn-orchestrator";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { getEngineeringAdvisorBriefing } from "@/lib/bdos/advisor";
import { getEngineeringAdvisorHistoricalFacts } from "@/lib/bdos/advisor-historical-facts-repository";
import {
  appendCopilotAssistantMessage,
  appendCopilotUserMessage,
  createCopilotConversation,
  isCopilotStudioId,
  listCopilotMessages,
  toCopilotConversationHistory
} from "@/lib/bdos/copilot-repository";

/**
 * Decision Copilot (Epic 15) — único turno de conversa: recebe a
 * pergunta, delega a `resolveCopilotTurn` (bdos-core) a decisão de
 * como respondê-la — determinística (Intent Router, Fase 2) ou via
 * Claude (Fase 1) — e persiste o resultado. Nenhum cálculo de negócio
 * novo aqui — igual ao resto do Advisor, esta rota só orquestra o que
 * bdos-core e o repository já decidem.
 *
 * Fase 1 assume uma única engineering_project ativa por empresa (mesma
 * limitação que o resto da plataforma hoje — ver
 * docs/PLATFORM_ARCHITECTURE.md secao 9.3, "Workspace ainda não é um
 * seletor real de múltiplos projetos"). Por isso `projectId` no corpo
 * da requisição é validado contra o projeto que
 * getEngineeringAdvisorBriefing já resolve para a empresa autenticada,
 * em vez de escolher entre vários — um mismatch aqui é sinal de bug no
 * cliente, não uma segunda engineering_project válida sendo ignorada.
 */
interface CopilotMessageRequestBody {
  readonly conversationId?: string;
  readonly studioId: string;
  // Opcional: Fase 1 tem uma única engineering_project ativa por
  // empresa, então o servidor já sabe qual é (via
  // getEngineeringAdvisorBriefing) sem o cliente precisar buscá-la e
  // repassá-la. Quando enviado, ainda é validado contra o projeto real
  // — protege contra um cliente futuro (multi-projeto) que assuma o
  // projeto errado silenciosamente.
  readonly projectId?: string;
  readonly message: string;
}

function isValidRequestBody(body: unknown): body is CopilotMessageRequestBody {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const candidate = body as Record<string, unknown>;

  return (
    typeof candidate.studioId === "string" &&
    typeof candidate.message === "string" &&
    candidate.message.trim().length > 0 &&
    (candidate.projectId === undefined || typeof candidate.projectId === "string") &&
    (candidate.conversationId === undefined || typeof candidate.conversationId === "string")
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  if (!auth) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  if (!isValidRequestBody(body)) {
    return NextResponse.json({ error: "invalid_copilot_message_body" }, { status: 400 });
  }

  if (!isCopilotStudioId(body.studioId)) {
    return NextResponse.json({ error: "invalid_studio_id" }, { status: 400 });
  }

  const briefing = await getEngineeringAdvisorBriefing(supabase, auth.companyId);

  if (!briefing.hasData || !briefing.context) {
    return NextResponse.json({ error: "no_advisor_context_available" }, { status: 409 });
  }

  if (body.projectId !== undefined && briefing.engineeringProjectId !== body.projectId) {
    return NextResponse.json({ error: "project_id_mismatch" }, { status: 409 });
  }

  try {
    const conversationId =
      body.conversationId ??
      (
        await createCopilotConversation(supabase, {
          companyId: auth.companyId,
          engineeringProjectId: briefing.engineeringProjectId as string,
          studioId: body.studioId,
          createdBy: auth.userId
        })
      ).id;

    const priorMessages = body.conversationId ? await listCopilotMessages(supabase, conversationId) : [];
    const conversationHistory = toCopilotConversationHistory(priorMessages);

    await appendCopilotUserMessage(supabase, {
      companyId: auth.companyId,
      conversationId,
      content: body.message
    });

    const historicalFacts = await getEngineeringAdvisorHistoricalFacts(supabase, briefing.context);

    const outcome = await resolveCopilotTurn(
      briefing.context,
      historicalFacts,
      conversationHistory,
      body.message,
      briefing.decisionSnapshotId
    );

    if (outcome.kind === "validation_failed") {
      console.error("[copilot-message] Resposta do Claude reprovada pelo validator.", outcome.reason);
      return NextResponse.json({ error: "copilot_answer_validation_failed", conversationId }, { status: 502 });
    }

    const turn = outcome.turn;

    const assistantMessage = await appendCopilotAssistantMessage(supabase, {
      companyId: auth.companyId,
      conversationId,
      turn
    });

    return NextResponse.json({
      conversationId,
      message: {
        id: assistantMessage.id,
        role: "assistant" as const,
        content: turn.content,
        reasoningChain: turn.reasoningChain,
        confidence: turn.confidence,
        explainability: turn.explainability
      }
    });
  } catch (error) {
    console.error("[copilot-message] Falha ao processar o turno.", error);
    return NextResponse.json({ error: "copilot_turn_failed" }, { status: 500 });
  }
}
