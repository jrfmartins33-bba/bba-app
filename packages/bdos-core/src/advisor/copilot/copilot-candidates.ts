import type {
  EngineeringAdvisorPromptContext,
  EngineeringAdvisorPromptDecision,
  EngineeringAdvisorPromptRecommendation
} from "../advisor-prompt-context.types";

// Decision Copilot (Epic 15, Fase 2) — candidatos elegíveis para
// Clarifying Questions e para resolução de alvo do Intent Router
// (DECISION_COPILOT_PHASE2.md §1/§2). Um único lugar constrói essa
// lista para os dois consumidores, para que "a 2ª opção da última
// lista" signifique exatamente a mesma coisa nos dois — a lista é uma
// função pura do contexto, redenerivável sem persistir nada.

export type CopilotCandidateKind = "decision" | "recommendation";

export type CopilotCandidate =
  | { readonly kind: "decision"; readonly priorityRank: number; readonly decision: EngineeringAdvisorPromptDecision }
  | {
      readonly kind: "recommendation";
      readonly priorityRank: number;
      readonly recommendation: EngineeringAdvisorPromptRecommendation;
    };

// Top-N por prioridade, valor inicial aprovado em
// DECISION_COPILOT_PHASE2.md §2 — revisitar só se o uso real mostrar
// que corta candidatos relevantes com frequência.
export const CLARIFY_LIST_LIMIT = 5;

const PRIORITY_RANK: Readonly<Record<string, number>> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

function rankForPriority(priority: string): number {
  return PRIORITY_RANK[priority] ?? PRIORITY_RANK.low;
}

export function candidateId(candidate: CopilotCandidate): string {
  return candidate.kind === "decision" ? candidate.decision.id : candidate.recommendation.id;
}

export function candidateTitle(candidate: CopilotCandidate): string {
  return candidate.kind === "decision" ? candidate.decision.title : candidate.recommendation.title;
}

function candidateIsNew(candidate: CopilotCandidate): boolean {
  return candidate.kind === "decision" ? candidate.decision.isNew : candidate.recommendation.isNew;
}

// Ordenado por prioridade (critical > high > medium > low);
// desempate por "isNew" — o Prompt Context Optimizer não carrega
// timestamp por item, então "mais recente" (critério do desenho) é
// aproximado pelo sinal de novidade que já existe. Array.prototype.sort
// é estável em Node/V8, então o desempate final é a ordem original.
export function buildCopilotCandidates(context: EngineeringAdvisorPromptContext): ReadonlyArray<CopilotCandidate> {
  const decisionPriorityById = new Map(context.decisions.map((decision) => [decision.id, decision.priority]));

  const decisionCandidates: CopilotCandidate[] = context.decisions.map((decision) => ({
    kind: "decision",
    priorityRank: rankForPriority(decision.priority),
    decision
  }));

  const recommendationCandidates: CopilotCandidate[] = context.recommendations.map((recommendation) => ({
    kind: "recommendation",
    priorityRank: rankForPriority(decisionPriorityById.get(recommendation.decisionId) ?? "low"),
    recommendation
  }));

  return [...decisionCandidates, ...recommendationCandidates].sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) {
      return a.priorityRank - b.priorityRank;
    }
    const aIsNew = candidateIsNew(a);
    const bIsNew = candidateIsNew(b);
    if (aIsNew !== bIsNew) {
      return aIsNew ? -1 : 1;
    }
    return 0;
  });
}

export function topCopilotCandidates(
  context: EngineeringAdvisorPromptContext,
  limit: number = CLARIFY_LIST_LIMIT
): ReadonlyArray<CopilotCandidate> {
  return buildCopilotCandidates(context).slice(0, limit);
}
