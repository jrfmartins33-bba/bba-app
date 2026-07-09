import type { EngineeringAdvisorContext } from "../advisor-context.types";
import type { EngineeringAdvisorPromptContext, EngineeringAdvisorPromptRecommendationOption } from "../advisor-prompt-context.types";

// Decision Copilot (Epic 15, Fase 2, 15.2C) — reabre "options" no
// Prompt Context, só para a Recommendation que o Intent Router já
// resolveu como alvo de comparação (DECISION_COPILOT_PHASE2.md §3.1).
// Função pura, sem I/O: recebe o EngineeringAdvisorContext completo
// (que sempre tem Recommendation.options — nunca foi removido de lá,
// só do Prompt Context otimizado) e devolve um novo
// EngineeringAdvisorPromptContext com "comparisonOptions" preenchido,
// sem mutar o original.
//
// Se a Recommendation não existir mais no contexto atual ou não tiver
// nenhuma option cadastrada, devolve o promptContext inalterado — uma
// comparação sem opções reais para citar deve virar uma resposta
// comum (sem o campo), nunca um erro nem uma option inventada.
export function withComparisonOptions(
  promptContext: EngineeringAdvisorPromptContext,
  context: EngineeringAdvisorContext,
  recommendationId: string
): EngineeringAdvisorPromptContext {
  const recommendation = context.recommendations.find((candidate) => candidate.id === recommendationId);

  if (!recommendation || recommendation.options.length === 0) {
    return promptContext;
  }

  const comparisonOptions: ReadonlyArray<EngineeringAdvisorPromptRecommendationOption> = recommendation.options.map((option) => ({
    id: option.id,
    type: option.type,
    title: option.title,
    description: option.description
  }));

  return { ...promptContext, comparisonOptions };
}

// Decision resolvida pelo Router (kind === "decision") ainda pode
// virar uma comparação de opções — mas só no caso trivial de a
// Decision ter exatamente 1 Recommendation associada (ambiguidade
// entre 2+ Recommendations da mesma Decision fica fora desta entrega:
// nenhuma option é inventada, a resposta segue sem comparisonOptions,
// nunca escolhe uma Recommendation arbitrariamente).
export function findSingleRecommendationForDecision(
  context: EngineeringAdvisorContext,
  decisionId: string
): string | null {
  const matches = context.recommendations.filter((recommendation) => recommendation.decisionId === decisionId);
  return matches.length === 1 ? matches[0].id : null;
}
