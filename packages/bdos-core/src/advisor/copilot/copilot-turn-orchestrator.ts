import type { EngineeringAdvisorContext } from "../advisor-context.types";
import type { EngineeringAdvisorHistoricalFacts } from "../advisor-historical-facts.types";
import { buildEngineeringAdvisorPromptContext } from "../advisor-prompt-context-builder";
import { findSingleRecommendationForDecision } from "./copilot-comparison-context";
import { buildClarifyTurn, buildUnsupportedActionTurn } from "./copilot-deterministic-turn-builder";
import { classifyCopilotIntent, type CopilotResolvedTarget } from "./copilot-intent-router";
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
// "compare" com alvo resolvido (Recommendation direta, ou uma Decision
// com exatamente 1 Recommendation associada) reabre comparisonOptions
// no contexto enviado ao Claude (15.2C — DECISION_COPILOT_PHASE2.md
// §3.1). Uma Decision com 0 ou 2+ Recommendations não tem um alvo de
// opções não-ambíguo: segue como resposta comum, sem
// comparisonOptions, nunca escolhendo uma Recommendation arbitrária.
// Comparação de cronograma (simulateScheduleDelay, §3.2) fica fora
// desta entrega — schedule activities ainda não fazem parte do
// contexto do Advisor/Copilot.

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

  const comparisonRecommendationId =
    classification.intent === "compare" && classification.target
      ? resolveComparisonRecommendationId(context, classification.target)
      : null;

  // "answer" e "compare" (com alvo já resolvido pelo Router) chamam o
  // Claude normalmente — mesmo caminho testado da Fase 1, só passando
  // comparisonRecommendationId quando houver uma Recommendation
  // não-ambígua para comparar.
  const { raw, model, promptContext: builtPromptContext } = await runCopilotTurn(
    context,
    historicalFacts,
    conversationHistory,
    userMessage,
    comparisonRecommendationId
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

function resolveComparisonRecommendationId(context: EngineeringAdvisorContext, target: CopilotResolvedTarget): string | null {
  if (target.kind === "recommendation") {
    return target.id;
  }

  // target.kind === "decision" — só vira comparação se a Decision tiver
  // exatamente 1 Recommendation associada (ver nota no topo do arquivo).
  return findSingleRecommendationForDecision(context, target.id);
}
