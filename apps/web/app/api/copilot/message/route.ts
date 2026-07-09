import { NextResponse } from "next/server";
import { isAnthropicProviderError } from "@bba/bdos-core/advisor/copilot/copilot-turn-builder";
import { resolveCopilotTurn } from "@bba/bdos-core/advisor/copilot/copilot-turn-orchestrator";
import { resolveCopilotApprovalTurn } from "@bba/bdos-core/advisor/copilot/copilot-approval-orchestrator";
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
import { approveCopilotRecommendation } from "@/lib/bdos/copilot-approval-repository";

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
 *
 * Epic 16.7 (packages/bdos-core/docs/COPILOT_WORKFLOW_HANDOFF.md) —
 * esta mesma rota também aceita um segundo caminho, mutuamente
 * exclusivo com `message`: aprovação estrutural de uma Recommendation
 * (`approveRecommendationId`). Esse caminho NUNCA chama
 * classifyCopilotIntent/resolveCopilotTurn — é um gesto estrutural da
 * UI (ex.: botão "Aprovar"), nunca linguagem natural interpretada.
 * `sourceDecisionSnapshotId`/`engineeringProjectId` são obrigatórios
 * junto de `approveRecommendationId` e validados contra o estado atual
 * resolvido pelo servidor (nunca contra "o snapshot mais recente"
 * implicitamente) — um mismatch aqui significa que o cliente está
 * aprovando algo baseado num contexto que já não é o atual, e a
 * aprovação é recusada em vez de silenciosamente redirecionada.
 *
 * Epic 16.8 (botão "Aprovar" na UI): a resposta de toda chamada (Fase
 * 1 e 16.7) ecoa `engineeringProjectId` no nível raiz — o cliente não
 * tinha, até aqui, nenhuma forma de conhecer esse id para reenviá-lo
 * numa aprovação. `sourceDecisionSnapshotId` já era coberto desde o
 * 16.7 (`message.decisionSnapshotId`).
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
  // Caminho conversacional (Fase 1 + Intent Router, Fase 2) — mutuamente
  // exclusivo com o caminho de aprovação abaixo.
  readonly message?: string;

  // Caminho de aprovação estrutural (Epic 16.7) — mutuamente exclusivo
  // com `message`. Os três campos abaixo são exigidos juntos.
  readonly approveRecommendationId?: string;
  readonly sourceDecisionSnapshotId?: string;
  readonly engineeringProjectId?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidRequestBody(body: unknown): body is CopilotMessageRequestBody {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const candidate = body as Record<string, unknown>;

  if (typeof candidate.studioId !== "string") {
    return false;
  }
  if (candidate.conversationId !== undefined && typeof candidate.conversationId !== "string") {
    return false;
  }
  if (candidate.projectId !== undefined && typeof candidate.projectId !== "string") {
    return false;
  }

  const hasMessage = isNonEmptyString(candidate.message);
  const hasApproval = isNonEmptyString(candidate.approveRecommendationId);

  // Mutuamente exclusivo: nem os dois presentes, nem nenhum dos dois.
  if (hasMessage === hasApproval) {
    return false;
  }

  if (hasApproval) {
    return isNonEmptyString(candidate.sourceDecisionSnapshotId) && isNonEmptyString(candidate.engineeringProjectId);
  }

  return true;
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

  if (!briefing.hasData || !briefing.context || !briefing.engineeringProjectId) {
    return NextResponse.json({ error: "no_advisor_context_available" }, { status: 409 });
  }

  if (body.projectId !== undefined && briefing.engineeringProjectId !== body.projectId) {
    return NextResponse.json({ error: "project_id_mismatch" }, { status: 409 });
  }

  const isApproval = body.approveRecommendationId !== undefined;

  // Aprovação sempre acontece dentro de uma conversa que já existe —
  // nunca cria uma conversa nova para um gesto de aprovação
  // (COPILOT_WORKFLOW_HANDOFF.md: "resolução dentro do contexto
  // congelado/auditável do turno anterior").
  if (isApproval && !body.conversationId) {
    return NextResponse.json({ error: "conversation_id_required_for_approval" }, { status: 400 });
  }

  if (isApproval && body.engineeringProjectId !== briefing.engineeringProjectId) {
    return NextResponse.json({ error: "project_id_mismatch" }, { status: 409 });
  }

  if (isApproval && body.sourceDecisionSnapshotId !== briefing.decisionSnapshotId) {
    return NextResponse.json({ error: "decision_snapshot_mismatch" }, { status: 409 });
  }

  try {
    const conversationId =
      body.conversationId ??
      (
        await createCopilotConversation(supabase, {
          companyId: auth.companyId,
          engineeringProjectId: briefing.engineeringProjectId,
          studioId: body.studioId,
          createdBy: auth.userId
        })
      ).id;

    const historicalFacts = await getEngineeringAdvisorHistoricalFacts(supabase, briefing.context);

    if (isApproval) {
      const outcome = resolveCopilotApprovalTurn(
        briefing.context,
        historicalFacts,
        body.approveRecommendationId as string,
        briefing.decisionSnapshotId,
        new Date().toISOString(),
        conversationId,
        auth.userId
      );

      if (outcome.kind === "recommendation_not_found") {
        return NextResponse.json({ error: "recommendation_not_found_in_context", conversationId }, { status: 404 });
      }

      if (outcome.kind === "duplicate_recommendation") {
        return NextResponse.json({ error: "duplicate_recommendation_in_context", conversationId }, { status: 409 });
      }

      if (outcome.kind === "materialization_failed") {
        console.error(
          "[copilot-message] Falha ao materializar ExecutionWorkflow a partir da Recommendation aprovada.",
          outcome.errors
        );
        return NextResponse.json({ error: "execution_workflow_materialization_failed", conversationId }, { status: 502 });
      }

      const persisted = await approveCopilotRecommendation(supabase, {
        companyId: auth.companyId,
        engineeringProjectId: briefing.engineeringProjectId,
        decisionSnapshotId: briefing.decisionSnapshotId as string,
        conversationId,
        createdBy: auth.userId,
        workflow: outcome.workflow,
        tasks: outcome.tasks,
        turn: outcome.turn
      });

      return NextResponse.json({
        conversationId,
        engineeringProjectId: briefing.engineeringProjectId,
        alreadyApproved: persisted.alreadyApproved,
        executionWorkflowId: persisted.workflowId,
        message: {
          id: persisted.copilotMessageId,
          role: "assistant" as const,
          content: outcome.turn.content,
          reasoningChain: outcome.turn.reasoningChain,
          confidence: outcome.turn.confidence,
          explainability: outcome.turn.explainability,
          decisionSnapshotId: outcome.turn.decisionSnapshotId
        }
      });
    }

    const priorMessages = body.conversationId ? await listCopilotMessages(supabase, conversationId) : [];
    const conversationHistory = toCopilotConversationHistory(priorMessages);

    await appendCopilotUserMessage(supabase, {
      companyId: auth.companyId,
      conversationId,
      content: body.message as string
    });

    const outcome = await resolveCopilotTurn(
      briefing.context,
      historicalFacts,
      conversationHistory,
      body.message as string,
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
      engineeringProjectId: briefing.engineeringProjectId,
      message: {
        id: assistantMessage.id,
        role: "assistant" as const,
        content: turn.content,
        reasoningChain: turn.reasoningChain,
        confidence: turn.confidence,
        explainability: turn.explainability,
        decisionSnapshotId: turn.decisionSnapshotId
      }
    });
  } catch (error) {
    if (isAnthropicProviderError(error)) {
      console.error("[copilot-message] Provedor de IA (Anthropic) indisponível.", error);
      return NextResponse.json({ error: "advisor_provider_unavailable" }, { status: 503 });
    }

    console.error("[copilot-message] Falha ao processar o turno.", error);
    return NextResponse.json({ error: "copilot_turn_failed" }, { status: 500 });
  }
}
