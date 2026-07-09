import type { EngineeringAdvisorContext } from "../advisor-context.types";
import { validateEngineeringAdvisorSummary } from "../advisor-response-validator";
import type { EngineeringAdvisorInsight } from "../advisor-summary.types";

// Decision Copilot (Epic 15, Fase 1) — validação da resposta do Claude.
// Reusa validateEngineeringAdvisorSummary (advisor-response-validator.ts)
// sem nenhuma alteração — mesmo schema, mesmas regras de citação
// (decisionIds/evidenceDecisionIds obrigatórios e elegíveis,
// recommendationIds elegível quando presente). A única diferença do
// Copilot para a narração da Home é a cardinalidade: a Home aceita até 3
// insights por resposta (ou 0), o Copilot exige exatamente 1 — um turno
// de conversa é uma resposta a uma pergunta, não um resumo de múltiplos
// pontos. Essa checagem extra fica aqui, não no validador compartilhado,
// para não alterar o contrato que a narração da Home já depende.

export type CopilotAnswerValidationResult =
  | { readonly valid: true; readonly insight: EngineeringAdvisorInsight }
  | { readonly valid: false; readonly reason: string };

export function validateCopilotAnswer(
  raw: unknown,
  context: EngineeringAdvisorContext
): CopilotAnswerValidationResult {
  const result = validateEngineeringAdvisorSummary(raw, context);

  if (!result.valid) {
    return result;
  }

  if (result.summary.insights.length !== 1) {
    return {
      valid: false,
      reason: `Resposta do Copilot precisa ter exatamente 1 insight, recebeu ${result.summary.insights.length}.`
    };
  }

  return { valid: true, insight: result.summary.insights[0] };
}
