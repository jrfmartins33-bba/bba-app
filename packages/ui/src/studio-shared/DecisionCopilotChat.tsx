"use client";

import { useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "../Card";

/**
 * Decision Copilot (Epic 15, Fase 1) — chat conversacional do BBA
 * Advisor. Vive em `studio-shared/`, não em `decision/`, de propósito:
 * `packages/ui/src/decision/` (`DecisionInsightCard` e companhia) é um
 * conjunto de componentes deliberadamente sem estado de dado — "não
 * buscam dados, sem fetch" (ver README daquele módulo) — o padrão
 * oficial para o card resumo/accordion de Full Traceability. Este
 * componente é outra coisa: uma conversa multi-turn com histórico
 * persistido, que precisa buscar e enviar dado de verdade. Reaproveita
 * a identidade visual "BBA Advisor" (ícone Sparkles, tom, tokens de
 * cor) do padrão existente, mas não é uma variação do
 * `DecisionInsightCard` — é um padrão de interação novo, documentado
 * aqui por ser o primeiro do tipo.
 *
 * Já nasce com dois consumidores previstos (Project Studio e Geo
 * Studio) — extração para `studio-shared` não é prematura, ver
 * DECISION_COPILOT.md.
 *
 * Fase 1 não tem "retomar conversa entre sessões": cada montagem começa
 * uma conversa nova (`conversationId` só existe em memória, perdido ao
 * recarregar a página). O endpoint de histórico
 * (`GET /api/copilot/messages`) já existe para quando isso for
 * priorizado — não implementado aqui por não ter sido pedido ainda.
 *
 * Epic 16.8 — botão "Aprovar" por Recommendation citada num turno
 * assistant (`explainability.recommendations`, já retornado desde a
 * Fase 1, só não lido pela UI até aqui). Clicar nunca envia texto —
 * manda `approveRecommendationId`/`sourceDecisionSnapshotId`/
 * `engineeringProjectId` estruturados (COPILOT_WORKFLOW_HANDOFF.md,
 * Epic 16.7): o gesto de aprovação é sempre estrutural, nunca
 * linguagem natural interpretada, então este componente nunca escreve
 * "aprovo isso" na caixa de texto por baixo dos panos — é uma segunda
 * ação de UI, paralela ao formulário de mensagem, que nunca toca
 * `input`/`handleSubmit`. `sourceDecisionSnapshotId` vem do
 * `decisionSnapshotId` do próprio turno que citou a Recommendation;
 * `engineeringProjectId` vem do campo de mesmo nome que toda resposta
 * de `/api/copilot/message` já ecoa no nível raiz (Fase 1 e 16.7,
 * também ajustado no 16.8) — nenhum dos dois é adivinhado ou mantido
 * como estado "mais recente" independente, exatamente o contrato que
 * o servidor exige.
 */

export interface DecisionCopilotReasoningStep {
  readonly label: string;
  readonly count: number;
  readonly description: string;
}

export interface DecisionCopilotConfidence {
  readonly overall: "high" | "medium" | "low";
}

export interface DecisionCopilotRecommendationRef {
  readonly id: string;
  readonly title: string;
}

interface DecisionCopilotMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly reasoningChain?: ReadonlyArray<DecisionCopilotReasoningStep>;
  readonly confidence?: DecisionCopilotConfidence;
  /** Só em turnos assistant — id do decision_snapshot que fundamentou este turno (16.7: exigido para aprovar uma Recommendation citada aqui). */
  readonly decisionSnapshotId?: string | null;
  /** Recommendations citadas neste turno (explainability.recommendations) — cada uma ganha um botão "Aprovar". */
  readonly recommendations?: ReadonlyArray<DecisionCopilotRecommendationRef>;
  readonly pending?: boolean;
  readonly failed?: boolean;
}

export interface DecisionCopilotChatProps {
  /** Qual Studio está hospedando o Copilot — vira `studio_id` em copilot_conversations. */
  studioId: "bba-project" | "geoespacial" | "evidencias" | "memorias";
  className?: string;
}

const CONFIDENCE_LABEL: Record<DecisionCopilotConfidence["overall"], string> = {
  high: "🟢 Confiança alta",
  medium: "🟡 Confiança média",
  low: "🔴 Confiança baixa"
};

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

let localMessageIdCounter = 0;
function nextLocalMessageId(): string {
  localMessageIdCounter += 1;
  return `local-${localMessageIdCounter}`;
}

interface CopilotMessageResponsePayload {
  readonly id: string | null;
  readonly content: string;
  readonly reasoningChain: ReadonlyArray<DecisionCopilotReasoningStep>;
  readonly confidence: DecisionCopilotConfidence;
  readonly explainability?: { readonly recommendations?: ReadonlyArray<DecisionCopilotRecommendationRef> };
  readonly decisionSnapshotId?: string | null;
}

function toAssistantMessage(payload: CopilotMessageResponsePayload): DecisionCopilotMessage {
  return {
    id: payload.id ?? nextLocalMessageId(),
    role: "assistant",
    content: payload.content,
    reasoningChain: payload.reasoningChain,
    confidence: payload.confidence,
    decisionSnapshotId: payload.decisionSnapshotId ?? null,
    recommendations: payload.explainability?.recommendations ?? []
  };
}

export function DecisionCopilotChat({ studioId, className }: DecisionCopilotChatProps) {
  const [messages, setMessages] = useState<ReadonlyArray<DecisionCopilotMessage>>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [engineeringProjectId, setEngineeringProjectId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [approvingRecommendationId, setApprovingRecommendationId] = useState<string | null>(null);
  const [approvedRecommendationIds, setApprovedRecommendationIds] = useState<ReadonlySet<string>>(new Set());
  const [approvalError, setApprovalError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmed = input.trim();
    if (trimmed.length === 0 || sending) {
      return;
    }

    const userMessage: DecisionCopilotMessage = { id: nextLocalMessageId(), role: "user", content: trimmed };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setSending(true);
    setUnavailableReason(null);

    try {
      const response = await fetch("/api/copilot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationId ?? undefined, studioId, message: trimmed })
      });

      if (response.status === 409) {
        const payload = await response.json().catch(() => null);
        setUnavailableReason(
          payload?.error === "no_advisor_context_available"
            ? "O Decision Copilot precisa de pelo menos um cronograma importado neste projeto para responder — importe um planejamento primeiro."
            : "Não foi possível confirmar o projeto ativo para esta conversa."
        );
        setMessages((current) =>
          current.map((message) => (message.id === userMessage.id ? { ...message, failed: true } : message))
        );
        return;
      }

      if (response.status === 503) {
        setUnavailableReason(
          "O BBA Advisor está temporariamente indisponível por limitação do provedor de IA. Nenhuma decisão foi alterada."
        );
        setMessages((current) =>
          current.map((message) => (message.id === userMessage.id ? { ...message, failed: true } : message))
        );
        return;
      }

      if (!response.ok) {
        throw new Error(`copilot_message_failed:${response.status}`);
      }

      const data = (await response.json()) as {
        conversationId: string;
        engineeringProjectId: string | null;
        message: CopilotMessageResponsePayload;
      };

      setConversationId(data.conversationId);
      setEngineeringProjectId(data.engineeringProjectId);
      setMessages((current) => [...current, toAssistantMessage(data.message)]);
    } catch {
      setMessages((current) =>
        current.map((message) => (message.id === userMessage.id ? { ...message, failed: true } : message))
      );
    } finally {
      setSending(false);
    }
  }

  async function handleApprove(recommendationId: string, sourceDecisionSnapshotId: string | null) {
    if (!conversationId || !engineeringProjectId || !sourceDecisionSnapshotId || approvingRecommendationId) {
      return;
    }

    setApprovingRecommendationId(recommendationId);
    setApprovalError(null);

    try {
      const response = await fetch("/api/copilot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          studioId,
          approveRecommendationId: recommendationId,
          sourceDecisionSnapshotId,
          engineeringProjectId
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setApprovalError(
          payload?.error === "recommendation_not_found_in_context" ||
            payload?.error === "duplicate_recommendation_in_context"
            ? "Esta recomendação não está mais disponível no contexto atual — atualize a conversa e tente de novo."
            : payload?.error === "decision_snapshot_mismatch" || payload?.error === "project_id_mismatch"
              ? "O projeto foi atualizado desde esta resposta — atualize a conversa antes de aprovar."
              : "Não foi possível registrar a aprovação. Tente novamente."
        );
        return;
      }

      const data = (await response.json()) as {
        conversationId: string;
        engineeringProjectId: string | null;
        message: CopilotMessageResponsePayload;
      };

      setEngineeringProjectId(data.engineeringProjectId);
      setApprovedRecommendationIds((current) => new Set(current).add(recommendationId));
      setMessages((current) => [...current, toAssistantMessage(data.message)]);
    } catch {
      setApprovalError("Não foi possível registrar a aprovação. Tente novamente.");
    } finally {
      setApprovingRecommendationId(null);
    }
  }

  return (
    <Card className={cx("decision-copilot-chat", className)} title="Decision Copilot">
      <div className="decision-copilot-chat__advisor">
        <Sparkles aria-hidden="true" className="decision-copilot-chat__advisor-icon" size={18} />
        <span className="decision-copilot-chat__advisor-name">BBA Advisor</span>
      </div>

      <div className="decision-copilot-chat__thread">
        {messages.length === 0 ? (
          <p className="decision-copilot-chat__empty">
            Pergunte algo sobre este projeto — por exemplo, &quot;por que esse projeto está em risco?&quot;
          </p>
        ) : (
          messages.map((message) => (
            <DecisionCopilotMessageBubble
              key={message.id}
              message={message}
              engineeringProjectId={engineeringProjectId}
              approvedRecommendationIds={approvedRecommendationIds}
              approvingRecommendationId={approvingRecommendationId}
              onApprove={handleApprove}
            />
          ))
        )}
        {sending && <p className="decision-copilot-chat__typing">BBA Advisor está analisando...</p>}
      </div>

      {unavailableReason && <p className="decision-copilot-chat__unavailable">{unavailableReason}</p>}
      {approvalError && <p className="decision-copilot-chat__unavailable">{approvalError}</p>}

      <form className="decision-copilot-chat__form" onSubmit={handleSubmit}>
        <input
          aria-label="Pergunta para o Decision Copilot"
          disabled={sending}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Pergunte ao BBA Advisor..."
          type="text"
          value={input}
        />
        <button className="bba-button bba-button--primary bba-button--sm" disabled={sending || input.trim().length === 0} type="submit">
          Enviar
        </button>
      </form>
    </Card>
  );
}

interface DecisionCopilotMessageBubbleProps {
  readonly message: DecisionCopilotMessage;
  readonly engineeringProjectId: string | null;
  readonly approvedRecommendationIds: ReadonlySet<string>;
  readonly approvingRecommendationId: string | null;
  readonly onApprove: (recommendationId: string, sourceDecisionSnapshotId: string | null) => void;
}

function DecisionCopilotMessageBubble({
  message,
  engineeringProjectId,
  approvedRecommendationIds,
  approvingRecommendationId,
  onApprove
}: DecisionCopilotMessageBubbleProps) {
  const [showReasoning, setShowReasoning] = useState(false);

  return (
    <div
      className={cx(
        "decision-copilot-chat__message",
        `decision-copilot-chat__message--${message.role}`,
        message.failed && "decision-copilot-chat__message--failed"
      )}
    >
      <p>{message.content}</p>

      {message.role === "assistant" && message.confidence && (
        <div className="decision-copilot-chat__meta">
          <span className="status-badge status-badge--active">{CONFIDENCE_LABEL[message.confidence.overall]}</span>
          {message.reasoningChain && message.reasoningChain.length > 0 && (
            <button
              className="bba-button bba-button--ghost bba-button--sm"
              onClick={() => setShowReasoning((current) => !current)}
              type="button"
            >
              {showReasoning ? "Ocultar raciocínio" : "Como cheguei nisso?"}
            </button>
          )}
        </div>
      )}

      {showReasoning && message.reasoningChain && (
        <ul className="decision-copilot-chat__reasoning">
          {message.reasoningChain.map((step) => (
            <li key={step.label}>
              <strong>
                {step.label} ({step.count})
              </strong>
              <span>{step.description}</span>
            </li>
          ))}
        </ul>
      )}

      {
        // Epic 16.8, ponto 1 da revisão do CPO: o bloco (e o botão
        // dentro dele) só aparece quando as 3 condições exigidas pelo
        // contrato de aprovação (COPILOT_WORKFLOW_HANDOFF.md) estão
        // disponíveis ao mesmo tempo — nunca uma linha "órfã" com
        // título mas sem forma de agir sobre ele.
      }
      {message.role === "assistant" &&
        message.recommendations &&
        message.recommendations.length > 0 &&
        message.decisionSnapshotId &&
        engineeringProjectId && (
          <ul className="decision-copilot-chat__recommendations">
            {message.recommendations.map((recommendation) => {
              const isApproved = approvedRecommendationIds.has(recommendation.id);
              const isApproving = approvingRecommendationId === recommendation.id;

              return (
                <li className="decision-copilot-chat__recommendation" key={recommendation.id}>
                  <span className="decision-copilot-chat__recommendation-title">{recommendation.title}</span>
                  {isApproved ? (
                    <span className="status-badge status-badge--done">Aprovado</span>
                  ) : (
                    <button
                      className="bba-button bba-button--primary bba-button--sm"
                      disabled={isApproving || (approvingRecommendationId !== null && !isApproving)}
                      onClick={() => onApprove(recommendation.id, message.decisionSnapshotId ?? null)}
                      type="button"
                    >
                      {isApproving ? "Aprovando..." : "Aprovar"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

      {message.failed && <span className="decision-copilot-chat__failed-hint">Não foi possível enviar. Tente novamente.</span>}
    </div>
  );
}
