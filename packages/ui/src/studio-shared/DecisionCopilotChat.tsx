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
 */

export interface DecisionCopilotReasoningStep {
  readonly label: string;
  readonly count: number;
  readonly description: string;
}

export interface DecisionCopilotConfidence {
  readonly overall: "high" | "medium" | "low";
}

interface DecisionCopilotMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly reasoningChain?: ReadonlyArray<DecisionCopilotReasoningStep>;
  readonly confidence?: DecisionCopilotConfidence;
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

export function DecisionCopilotChat({ studioId, className }: DecisionCopilotChatProps) {
  const [messages, setMessages] = useState<ReadonlyArray<DecisionCopilotMessage>>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

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

      if (!response.ok) {
        throw new Error(`copilot_message_failed:${response.status}`);
      }

      const data = (await response.json()) as {
        conversationId: string;
        message: {
          id: string;
          content: string;
          reasoningChain: ReadonlyArray<DecisionCopilotReasoningStep>;
          confidence: DecisionCopilotConfidence;
        };
      };

      setConversationId(data.conversationId);
      setMessages((current) => [
        ...current,
        {
          id: data.message.id,
          role: "assistant",
          content: data.message.content,
          reasoningChain: data.message.reasoningChain,
          confidence: data.message.confidence
        }
      ]);
    } catch {
      setMessages((current) =>
        current.map((message) => (message.id === userMessage.id ? { ...message, failed: true } : message))
      );
    } finally {
      setSending(false);
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
          messages.map((message) => <DecisionCopilotMessageBubble key={message.id} message={message} />)
        )}
        {sending && <p className="decision-copilot-chat__typing">BBA Advisor está analisando...</p>}
      </div>

      {unavailableReason && <p className="decision-copilot-chat__unavailable">{unavailableReason}</p>}

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

function DecisionCopilotMessageBubble({ message }: { message: DecisionCopilotMessage }) {
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

      {message.failed && <span className="decision-copilot-chat__failed-hint">Não foi possível enviar. Tente novamente.</span>}
    </div>
  );
}
