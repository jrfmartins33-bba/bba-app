import type { EngineeringAdvisorExplanation } from "../advisor-explanation.types";
import type { CopilotReasoningStep } from "./copilot-turn.types";

// Extraído de copilot-turn-assembler.ts (Fase 1) no momento em que um
// segundo consumidor (turnos determinísticos da Fase 2 — Clarifying
// Questions, unsupported_action) precisou da mesma conversão
// EngineeringAdvisorExplanation → CopilotReasoningStep[] — mesma regra
// de generalização tardia já em uso no resto do módulo (ver
// anthropic-client.ts/claude-json-response.ts).
export function buildCopilotReasoningChain(explanation: EngineeringAdvisorExplanation): ReadonlyArray<CopilotReasoningStep> {
  return [
    {
      label: "Decisions consideradas",
      count: explanation.decisions.length,
      description: explanation.decisions.map((decision) => decision.title).join("; ") || "Nenhuma decision citada."
    },
    {
      label: "Recomendações relacionadas",
      count: explanation.recommendations.length,
      description:
        explanation.recommendations.map((recommendation) => recommendation.title).join("; ") ||
        "Nenhuma recommendation citada."
    },
    {
      label: "Evidências usadas",
      count: explanation.evidence.length,
      description: explanation.evidence.map((evidenceItem) => evidenceItem.description).join("; ") || "Nenhuma evidência citada."
    }
  ];
}
