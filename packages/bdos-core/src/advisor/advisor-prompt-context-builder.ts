import type { EngineeringAdvisorContext } from "./advisor-context.types";
import type {
  EngineeringAdvisorPromptContext,
  EngineeringAdvisorPromptDecision,
  EngineeringAdvisorPromptEvidence,
  EngineeringAdvisorPromptEvidenceIndex,
  EngineeringAdvisorPromptRecommendation
} from "./advisor-prompt-context.types";

// Epic 14 (BBA Advisor Evolution), Sprint 14.2B — Advisor Prompt Context
// Optimizer. Função pura, sem I/O: só reduz o EngineeringAdvisorContext
// (que continua completo, é o que o Validator sempre recebe) à visão
// mínima que o system prompt atual de fato instrui o Claude a usar.
//
// Medido com um payload real (Decision/Recommendation "cash_protection"
// de recommendation-builder.ts) escalado para o Candidate Set máximo
// (20): "options" sozinho responde por ~62% do peso de cada
// recommendation e nunca é citado pelo prompt — é a maior alavanca de
// redução de input tokens, sem perda de capacidade de narração.
//
// Correção pós-14.2B: pedir "no máximo 3 insights" só por instrução de
// prompt não impediu o Claude de bater max_tokens (sem tool_choice, a
// adesão nunca é garantida — mesma limitação já registrada na Sprint
// 14.2). O corte agora é estrutural, não uma sugestão: só as top 3
// recommendations do Candidate Set (já vem ordenado por prioridade em
// advisor-context-builder.ts, então "top 3" = as 3 primeiras) chegam ao
// Claude, junto das decisions que elas referenciam e só a evidência
// dessas decisions — fisicamente não há como o Claude gerar um insight
// sobre uma recommendation que ele nunca recebeu.
const PROMPT_RECOMMENDATION_LIMIT = 3;

export function buildEngineeringAdvisorPromptContext(
  context: EngineeringAdvisorContext
): EngineeringAdvisorPromptContext {
  const topRecommendations = context.recommendations.slice(0, PROMPT_RECOMMENDATION_LIMIT);

  const recommendations: EngineeringAdvisorPromptRecommendation[] = topRecommendations.map(
    (recommendation) => ({
      id: recommendation.id,
      decisionId: recommendation.decisionId,
      title: recommendation.title,
      summary: recommendation.summary
    })
  );

  const referencedDecisionIds = new Set(topRecommendations.map((recommendation) => recommendation.decisionId));
  const relatedDecisions = context.decisions.filter((decision) => referencedDecisionIds.has(decision.id));

  const decisions: EngineeringAdvisorPromptDecision[] = relatedDecisions.map((decision) => ({
    id: decision.id,
    title: decision.title,
    summary: decision.summary,
    priority: decision.priority
  }));

  const evidenceIndex: Record<string, ReadonlyArray<EngineeringAdvisorPromptEvidence>> = {};
  for (const decision of relatedDecisions) {
    const evidenceList = context.evidenceIndex[decision.id] ?? [];
    evidenceIndex[decision.id] = evidenceList.map((evidence) => ({
      source: evidence.source,
      sourceReference: evidence.sourceReference,
      description: evidence.description
    }));
  }

  return {
    snapshot: context.snapshot,
    decisions,
    recommendations,
    evidenceIndex: evidenceIndex as EngineeringAdvisorPromptEvidenceIndex,
    historySummary: context.historySummary
  };
}
