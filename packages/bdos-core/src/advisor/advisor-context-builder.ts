import type { Decision, DecisionEvidence } from "../domain/decision";
import type { Recommendation, RecommendationId } from "../engines/decision/recommendation";
import type { EngineeringAdvisorContext } from "./advisor-context.types";

// Epic 14 (BBA Advisor Evolution), Sprint 14.1 — monta o
// EngineeringAdvisorContext que o Claude passa a receber (ver
// claude-narrator.ts). Função pura: quem chama
// (apps/web/lib/bdos/advisor.ts) já buscou tudo no Supabase e já decidiu
// elegibilidade (a mesma query `.eq("status", "open")` que hoje monta os
// itens template do fallback) — este módulo não sabe o que é Supabase, só
// recebe dados prontos e nunca duplica a regra de elegibilidade.
//
// businessFactIds/evidenceReferences de Recommendation.traceability são
// mantidos como passthrough dentro de `recommendations[]` — não há store
// de BusinessFact neste pipeline hoje (bba-project-import só produz
// Decision[]/Recommendation[]), então esta Sprint não inventa nenhum
// lookup para eles. Só a perna Decision → Evidence é resolvida em
// `evidenceIndex`, porque Decision.evidence já vem embutido no domínio.

const CANDIDATE_SET_MAX_SIZE = 20;

const RECOMMENDATION_PRIORITY_RANK: Readonly<Record<string, number>> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};
const DEFAULT_RECOMMENDATION_PRIORITY = "medium";

export interface EngineeringAdvisorContextInput {
  readonly engineeringProjectId: string;
  readonly engineeringProjectName: string;
  readonly computedAt: string;
  readonly healthScore: number;
  readonly previousHealthScore: number | null;
  readonly decisions: ReadonlyArray<Decision>;
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly eligibleRecommendationIds: ReadonlySet<RecommendationId>;
}

export function buildEngineeringAdvisorContext(
  input: EngineeringAdvisorContextInput
): EngineeringAdvisorContext {
  const eligibleRecommendations = input.recommendations.filter((recommendation) =>
    input.eligibleRecommendationIds.has(recommendation.id)
  );

  // Candidate Set: top 15-20, nunca as centenas de recomendações
  // possíveis. Ordenação determinística — o mesmo snapshot sempre produz
  // o mesmo Candidate Set, o que é essencial porque isso vira prompt de
  // LLM (precisa ser auditável e reproduzível).
  const candidateRecommendations = [...eligibleRecommendations]
    .sort(compareRecommendationsForCandidateSet)
    .slice(0, CANDIDATE_SET_MAX_SIZE);

  const decisionsById = new Map(input.decisions.map((decision) => [decision.id, decision]));
  const decisions: Decision[] = [];
  const seenDecisionIds = new Set<string>();

  for (const recommendation of candidateRecommendations) {
    if (seenDecisionIds.has(recommendation.decisionId)) {
      continue;
    }
    const decision = decisionsById.get(recommendation.decisionId);
    if (decision) {
      seenDecisionIds.add(decision.id);
      decisions.push(decision);
    }
  }

  const evidenceIndex: Record<string, ReadonlyArray<DecisionEvidence>> = {};
  for (const decision of decisions) {
    evidenceIndex[decision.id] = decision.evidence;
  }

  return {
    snapshot: {
      engineeringProjectId: input.engineeringProjectId,
      engineeringProjectName: input.engineeringProjectName,
      computedAt: input.computedAt,
      healthScore: input.healthScore,
      previousHealthScore: input.previousHealthScore
    },
    decisions,
    recommendations: candidateRecommendations,
    evidenceIndex,
    historySummary: buildHistorySummary(input.healthScore, input.previousHealthScore)
  };
}

function compareRecommendationsForCandidateSet(a: Recommendation, b: Recommendation): number {
  const rankDiff = getRecommendationPriorityRank(b) - getRecommendationPriorityRank(a);
  if (rankDiff !== 0) {
    return rankDiff;
  }
  const createdAtDiff = b.createdAt.localeCompare(a.createdAt);
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }
  return a.id.localeCompare(b.id);
}

function getRecommendationPriorityRank(recommendation: Recommendation): number {
  const value = recommendation.metadata.decisionPriority;
  const priority = typeof value === "string" && value.trim().length > 0 ? value : DEFAULT_RECOMMENDATION_PRIORITY;
  return RECOMMENDATION_PRIORITY_RANK[priority] ?? RECOMMENDATION_PRIORITY_RANK[DEFAULT_RECOMMENDATION_PRIORITY];
}

// Determinístico por design — nesta fase o histórico é só o fato simples
// (ex.: "Health Score 72 → 81"), sem tendência inferida. Ver Sprint 14.3
// para histórico mais rico.
function buildHistorySummary(healthScore: number, previousHealthScore: number | null): string {
  if (previousHealthScore === null) {
    return `Health Score ${healthScore} (primeiro snapshot registrado).`;
  }
  if (previousHealthScore === healthScore) {
    return `Health Score ${healthScore} (sem variação desde o snapshot anterior).`;
  }
  return `Health Score ${previousHealthScore} → ${healthScore}.`;
}
