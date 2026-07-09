import type { EngineeringAdvisorPromptContext } from "../advisor-prompt-context.types";
import { buildCopilotCandidates, candidateId, candidateTitle, topCopilotCandidates } from "./copilot-candidates";

function context(overrides: Partial<EngineeringAdvisorPromptContext> = {}): EngineeringAdvisorPromptContext {
  return {
    snapshot: {
      engineeringProjectId: "project-1",
      engineeringProjectName: "Projeto Alpha",
      computedAt: "2026-07-08T10:00:00.000Z",
      healthScore: 62,
      previousHealthScore: 78
    },
    history: { previousHealthScore: 78, healthScoreDirection: "down", historySummary: "Health Score 78 → 62." },
    decisions: [],
    recommendations: [],
    evidence: {},
    ...overrides
  };
}

const decisionLow = {
  id: "decision-low",
  title: "Bloco 3",
  summary: "",
  priority: "low",
  isNew: false,
  previousPriority: null,
  priorityChanged: false
};

const decisionCriticalOld = {
  id: "decision-critical-old",
  title: "Escavação",
  summary: "",
  priority: "critical",
  isNew: false,
  previousPriority: null,
  priorityChanged: false
};

const decisionCriticalNew = {
  id: "decision-critical-new",
  title: "Bloco 2",
  summary: "",
  priority: "critical",
  isNew: true,
  previousPriority: "high",
  priorityChanged: true
};

const decisionMedium = {
  id: "decision-medium",
  title: "Fundação",
  summary: "",
  priority: "medium",
  isNew: false,
  previousPriority: null,
  priorityChanged: false
};

const recommendationForCriticalOld = {
  id: "recommendation-1",
  decisionId: "decision-critical-old",
  title: "Reforçar equipe de escavação",
  summary: "",
  isNew: false,
  openSinceImportCount: 1,
  recurring: false
};

runTest("buildCopilotCandidates ordena por prioridade: critical antes de medium antes de low", () => {
  const ctx = context({ decisions: [decisionLow, decisionMedium, decisionCriticalOld] });
  const candidates = buildCopilotCandidates(ctx);

  assertEqual(candidates.map(candidateId).join(","), "decision-critical-old,decision-medium,decision-low", "ordem deve seguir prioridade decrescente de criticidade");
});

runTest("buildCopilotCandidates desempata por isNew (mais recente primeiro) dentro da mesma prioridade", () => {
  const ctx = context({ decisions: [decisionCriticalOld, decisionCriticalNew] });
  const candidates = buildCopilotCandidates(ctx);

  assertEqual(candidateId(candidates[0]), "decision-critical-new", "candidate isNew=true deve vir antes do isNew=false na mesma prioridade");
});

runTest("buildCopilotCandidates inclui Recommendations herdando a prioridade da Decision-pai", () => {
  const ctx = context({ decisions: [decisionCriticalOld, decisionLow], recommendations: [recommendationForCriticalOld] });
  const candidates = buildCopilotCandidates(ctx);

  const recommendationIndex = candidates.findIndex((candidate) => candidate.kind === "recommendation");
  const lowDecisionIndex = candidates.findIndex((candidate) => candidateId(candidate) === "decision-low");
  assertTrue(recommendationIndex !== -1, "Recommendation deve aparecer na lista de candidatos");
  // A Recommendation herda a prioridade "critical" da Decision-pai, então
  // deve vir antes da Decision de prioridade "low" — mesmo a Decision
  // "critical" original (que também empata em prioridade/isNew, mas
  // mantém a ordem original por estabilidade do sort) continua antes.
  assertTrue(recommendationIndex < lowDecisionIndex, "Recommendation com prioridade herdada critical deve vir antes de uma Decision low");
});

runTest("topCopilotCandidates corta na posição N (top-5 por padrão)", () => {
  const manyDecisions = Array.from({ length: 8 }, (_, index) => ({
    ...decisionMedium,
    id: `decision-${index}`,
    title: `Decision ${index}`
  }));
  const ctx = context({ decisions: manyDecisions });

  assertEqual(topCopilotCandidates(ctx).length, 5, "top-N deve cortar em 5 por padrão");
  assertEqual(topCopilotCandidates(ctx, 2).length, 2, "top-N deve respeitar um limite explícito diferente");
});

runTest("buildCopilotCandidates é determinístico: mesmo contexto produz a mesma ordem em chamadas repetidas", () => {
  const ctx = context({ decisions: [decisionLow, decisionCriticalOld, decisionMedium], recommendations: [recommendationForCriticalOld] });

  const first = buildCopilotCandidates(ctx).map(candidateId);
  const second = buildCopilotCandidates(ctx).map(candidateId);

  assertEqual(first.join(","), second.join(","), "duas chamadas sobre o mesmo contexto devem produzir a mesma ordem — é o que permite resolver 'a 2ª opção' sem persistir a lista");
});

runTest("candidateTitle expõe o título real do candidato, decision ou recommendation", () => {
  const ctx = context({ decisions: [decisionCriticalOld], recommendations: [recommendationForCriticalOld] });
  const candidates = buildCopilotCandidates(ctx);

  assertEqual(candidates.map(candidateTitle).sort().join(","), [decisionCriticalOld.title, recommendationForCriticalOld.title].sort().join(","), "candidateTitle deve refletir o título real de cada candidato");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}
