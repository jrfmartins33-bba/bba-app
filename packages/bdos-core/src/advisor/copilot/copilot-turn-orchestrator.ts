import type { EngineeringAdvisorContext } from "../advisor-context.types";
import type { EngineeringAdvisorHistoricalFacts } from "../advisor-historical-facts.types";
import { buildEngineeringAdvisorPromptContext } from "../advisor-prompt-context-builder";
import { buildClarifyTurn, buildUnsupportedActionTurn } from "./copilot-deterministic-turn-builder";
import { classifyCopilotIntent } from "./copilot-intent-router";
import { validateCopilotAnswer } from "./copilot-response-validator";
import { assembleCopilotAssistantTurn } from "./copilot-turn-assembler";
import { runCopilotTurn } from "./copilot-turn-builder";
import type { CopilotAssistantTurn, CopilotConversationHistoryEntry } from "./copilot-turn.types";

// Decision Copilot (Epic 15, Fase 2) — ponto de entrada único do turno,
// substituindo a chamada direta a runCopilotTurn que a rota usava na
// Fase 1. Decide a FORMA do turno (Intent Router, 100% determinístico)
// antes de decidir se vale a pena chamar o Claude — nenhuma capacidade
// nova aqui pula essa ordem (DECISION_COPILOT_PHASE2.md §6, regra
// "determinístico primeiro").
//
// "compare" com alvo resolvido ainda segue o mesmo caminho de "answer"
// nesta entrega: o contexto de comparação de verdade (Recommendation
// options / simulateScheduleDelay) é escopo do 15.2C, não desta. Até
// lá, ter o alvo resolvido não muda a resposta — o que esta entrega
// garante é que um pedido de comparação SEM alvo nunca vaze para uma
// resposta genérica sem sentido: vira clarify antes de chegar aqui.

export type CopilotTurnOutcome =
  | { readonly kind: "assistant_turn"; readonly turn: CopilotAssistantTurn }
  | { readonly kind: "validation_failed"; readonly reason: string };

export async function resolveCopilotTurn(
  context: EngineeringAdvisorContext,
  historicalFacts: EngineeringAdvisorHistoricalFacts,
  conversationHistory: ReadonlyArray<CopilotConversationHistoryEntry>,
  userMessage: string,
  decisionSnapshotId: string | null
): Promise<CopilotTurnOutcome> {
  const promptContext = buildEngineeringAdvisorPromptContext(context, historicalFacts);
  const classification = classifyCopilotIntent(userMessage, promptContext, conversationHistory);

  if (classification.intent === "unsupported_action") {
    return { kind: "assistant_turn", turn: buildUnsupportedActionTurn(promptContext, decisionSnapshotId) };
  }

  if (classification.intent === "clarify") {
    return { kind: "assistant_turn", turn: buildClarifyTurn(promptContext, decisionSnapshotId) };
  }

  // "answer" e "compare" (com alvo já resolvido pelo Router) chamam o
  // Claude normalmente — mesmo caminho testado da Fase 1, sem alteração.
  const { raw, model, promptContext: builtPromptContext } = await runCopilotTurn(
    context,
    historicalFacts,
    conversationHistory,
    userMessage
  );

  const validation = validateCopilotAnswer(raw, context);
  if (!validation.valid) {
    return { kind: "validation_failed", reason: validation.reason };
  }

  const turn = assembleCopilotAssistantTurn(
    validation.insight,
    context,
    historicalFacts,
    builtPromptContext,
    decisionSnapshotId,
    model
  );

  return { kind: "assistant_turn", turn };
}
