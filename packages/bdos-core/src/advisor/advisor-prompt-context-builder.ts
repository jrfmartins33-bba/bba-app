import type { EngineeringAdvisorContext } from "./advisor-context.types";
import type { EngineeringAdvisorHistoricalFacts } from "./advisor-historical-facts.types";
import type {
  EngineeringAdvisorPromptContext,
  EngineeringAdvisorPromptDecision,
  EngineeringAdvisorPromptEvidence,
  EngineeringAdvisorPromptEvidenceIndex,
  EngineeringAdvisorPromptHistory,
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
//
// Sprint 14.3 (Engineering Advisor Memory): o contrato ganhou "history" e
// campos temporais por item (isNew/previousPriority/priorityChanged em
// decisions; isNew/openSinceImportCount/recurring em recommendations),
// calculados aqui a partir de EngineeringAdvisorHistoricalFacts — dado
// cru já buscado pelo app layer (snapshot anterior + contagem de imports
// em aberto por recommendation_ref_id). Nenhuma composição de dois
// contratos no Narrator: este é o único ponto que decide o que entra no
// prompt, incluindo o histórico. Escopo continua limitado às top-3
// recommendations já selecionadas — histórico nunca expande o universo
// de itens nem escala com o tamanho da série (ver auditoria da 14.3).
const PROMPT_RECOMMENDATION_LIMIT = 3;
const RECOMMENDATION_RECURRING_THRESHOLD = 3;

export function buildEngineeringAdvisorPromptContext(
  context: EngineeringAdvisorContext,
  historicalFacts: EngineeringAdvisorHistoricalFacts
): EngineeringAdvisorPromptContext {
  const topRecommendations = context.recommendations.slice(0, PROMPT_RECOMMENDATION_LIMIT);

  const recommendations: EngineeringAdvisorPromptRecommendation[] = topRecommendations.map((recommendation) => {
    const openSinceImportCount =
      historicalFacts.recommendationOpenSinceImportCountByRefId[recommendation.id] ?? 1;

    return {
      id: recommendation.id,
      decisionId: recommendation.decisionId,
      title: recommendation.title,
      summary: recommendation.summary,
      isNew: openSinceImportCount <= 1,
      openSinceImportCount,
      recurring: openSinceImportCount >= RECOMMENDATION_RECURRING_THRESHOLD
    };
  });

  const referencedDecisionIds = new Set(topRecommendations.map((recommendation) => recommendation.decisionId));
  const relatedDecisions = context.decisions.filter((decision) => referencedDecisionIds.has(decision.id));

  const previousDecisionPriorityById = new Map(
    historicalFacts.previousDecisions.map((decision) => [decision.id, decision.priority])
  );

  const decisions: EngineeringAdvisorPromptDecision[] = relatedDecisions.map((decision) => {
    const previousPriority = previousDecisionPriorityById.get(decision.id) ?? null;

    return {
      id: decision.id,
      title: decision.title,
      summary: decision.summary,
      priority: decision.priority,
      isNew: previousPriority === null,
      previousPriority,
      priorityChanged: previousPriority !== null && previousPriority !== decision.priority
    };
  });

  const evidence: Record<string, ReadonlyArray<EngineeringAdvisorPromptEvidence>> = {};
  for (const decision of relatedDecisions) {
    const evidenceList = context.evidenceIndex[decision.id] ?? [];
    evidence[decision.id] = evidenceList.map((evidenceItem) => ({
      source: evidenceItem.source,
      sourceReference: evidenceItem.sourceReference,
      description: evidenceItem.description
    }));
  }

  const history: EngineeringAdvisorPromptHistory = {
    previousHealthScore: context.snapshot.previousHealthScore,
    healthScoreDirection: deriveHealthScoreDirection(
      context.snapshot.healthScore,
      context.snapshot.previousHealthScore
    ),
    historySummary: context.historySummary
  };

  return {
    snapshot: context.snapshot,
    history,
    decisions,
    recommendations,
    evidence: evidence as EngineeringAdvisorPromptEvidenceIndex
  };
}

function deriveHealthScoreDirection(
  current: number,
  previous: number | null
): "up" | "down" | "stable" | "unknown" {
  if (previous === null) {
    return "unknown";
  }
  if (current > previous) {
    return "up";
  }
  if (current < previous) {
    return "down";
  }
  return "stable";
}
