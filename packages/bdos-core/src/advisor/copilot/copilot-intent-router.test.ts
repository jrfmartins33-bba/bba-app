import type { EngineeringAdvisorPromptContext } from "../advisor-prompt-context.types";
import { CLARIFY_LIST_INTRO } from "./copilot-deterministic-turn-builder";
import { classifyCopilotIntent } from "./copilot-intent-router";
import type { CopilotConversationHistoryEntry } from "./copilot-turn.types";

const context: EngineeringAdvisorPromptContext = {
  snapshot: {
    engineeringProjectId: "project-1",
    engineeringProjectName: "Projeto Alpha",
    computedAt: "2026-07-08T10:00:00.000Z",
    healthScore: 62,
    previousHealthScore: 78
  },
  history: { previousHealthScore: 78, healthScoreDirection: "down", historySummary: "Health Score 78 → 62." },
  decisions: [
    { id: "decision-1", title: "Bloco 2", summary: "", priority: "critical", isNew: true, previousPriority: "high", priorityChanged: true },
    { id: "decision-2", title: "Bloco 3", summary: "", priority: "high", isNew: false, previousPriority: null, priorityChanged: false },
    { id: "decision-3", title: "Escavação", summary: "", priority: "medium", isNew: false, previousPriority: null, priorityChanged: false }
  ],
  recommendations: [
    { id: "recommendation-1", decisionId: "decision-1", title: "Reforçar equipe do Bloco 2", summary: "", isNew: true, openSinceImportCount: 1, recurring: false }
  ],
  evidence: {}
};

const emptyHistory: ReadonlyArray<CopilotConversationHistoryEntry> = [];

// Sem Recommendations: mantém a ordem de candidatos previsível
// (1. Bloco 2, 2. Bloco 3, 3. Escavação) para os testes de resolução
// por número abaixo, sem depender da regra de herança de prioridade de
// Recommendation testada separadamente em copilot-candidates.test.ts.
const decisionsOnlyContext: EngineeringAdvisorPromptContext = { ...context, recommendations: [] };

runTest("classifyCopilotIntent reconhece pedido de execução como unsupported_action, sem depender de comparação", () => {
  const result = classifyCopilotIntent("Aprove essa recomendação agora", context, emptyHistory);
  assertEqual(result.intent, "unsupported_action", "verbo no imperativo deve ser classificado como unsupported_action");
  assertEqual(result.target, null, "unsupported_action nunca resolve alvo");
});

runTest("classifyCopilotIntent trata uma pergunta comum como answer (caminho da Fase 1, sem regressão)", () => {
  const result = classifyCopilotIntent("Qual é a situação atual deste projeto?", context, emptyHistory);
  assertEqual(result.intent, "answer", "pergunta comum sem palavra-chave de comparação/ação deve seguir para answer");
});

runTest("classifyCopilotIntent resolve compare quando a mensagem cita um título existente no contexto", () => {
  const result = classifyCopilotIntent("Compare as opções para o Bloco 2", context, emptyHistory);
  assertEqual(result.intent, "compare", "pedido de comparação com título resolvido deve virar compare");
  assertEqual(result.target?.id, "decision-1", "alvo resolvido deve ser a Decision cujo título bate com a mensagem");
});

runTest("classifyCopilotIntent resolve compare quando a mensagem cita um id existente no contexto", () => {
  const result = classifyCopilotIntent("Compare as alternativas para recommendation-1", context, emptyHistory);
  assertEqual(result.intent, "compare", "id explícito deve resolver o alvo");
  assertEqual(result.target?.id, "recommendation-1", "alvo resolvido deve ser a Recommendation citada pelo id");
  assertEqual(result.target?.kind, "recommendation", "kind do alvo deve refletir que é uma Recommendation");
});

runTest("classifyCopilotIntent vira clarify quando o pedido de comparação não resolve nenhum alvo", () => {
  const result = classifyCopilotIntent("Compare as opções disponíveis", context, emptyHistory);
  assertEqual(result.intent, "clarify", "compare sem alvo resolvido deve virar clarify, nunca chegar a runCopilotTurn sem alvo");
  assertEqual(result.target, null, "clarify não carrega alvo resolvido");
});

runTest("classifyCopilotIntent vira clarify quando o título citado é ambíguo (bate com mais de um candidato)", () => {
  const ambiguousContext: EngineeringAdvisorPromptContext = {
    ...context,
    decisions: [
      { id: "decision-a", title: "Bloco 2 - Fundação", summary: "", priority: "high", isNew: false, previousPriority: null, priorityChanged: false },
      { id: "decision-b", title: "Bloco 2 - Estrutura", summary: "", priority: "high", isNew: false, previousPriority: null, priorityChanged: false }
    ]
  };
  const result = classifyCopilotIntent("Compare as opções do Bloco 2", ambiguousContext, emptyHistory);
  assertEqual(result.intent, "clarify", "título ambíguo (mais de um candidato bate) deve virar clarify, não escolher um dos dois arbitrariamente");
});

runTest("classifyCopilotIntent resolve compare a partir de uma seleção numérica, retomando a última lista de clarify", () => {
  const historyAfterClarify: ReadonlyArray<CopilotConversationHistoryEntry> = [
    { role: "user", content: "Compare as opções disponíveis" },
    {
      role: "assistant",
      content: `${CLARIFY_LIST_INTRO}\n1. Bloco 2\n2. Bloco 3\n3. Escavação`
    }
  ];

  const result = classifyCopilotIntent("2", decisionsOnlyContext, historyAfterClarify);
  assertEqual(result.intent, "compare", "uma seleção numérica após uma lista de clarify deve resolver como compare");
  assertEqual(result.target?.id, "decision-2", "índice 2 deve resolver para o 2º candidato da mesma lista determinística (Bloco 3)");
});

runTest("classifyCopilotIntent NÃO trata um número isolado como seleção se o último turno assistant não foi uma lista de clarify", () => {
  const historyWithoutClarify: ReadonlyArray<CopilotConversationHistoryEntry> = [
    { role: "user", content: "Qual é a situação atual?" },
    { role: "assistant", content: "O Health Score caiu de 78 para 62 por causa do atraso no Bloco 2." }
  ];

  const result = classifyCopilotIntent("2", context, historyWithoutClarify);
  assertEqual(result.intent, "answer", "número isolado sem uma lista de clarify anterior não deve ser tratado como seleção — segue como answer comum");
});

runTest("classifyCopilotIntent não persiste estado: a mesma lista de clarify é redenerivada do contexto atual, não de um cache", () => {
  const historyAfterClarify: ReadonlyArray<CopilotConversationHistoryEntry> = [
    {
      role: "assistant",
      content: `${CLARIFY_LIST_INTRO}\n1. Bloco 2\n2. Bloco 3\n3. Escavação`
    }
  ];

  const first = classifyCopilotIntent("1", decisionsOnlyContext, historyAfterClarify);
  const second = classifyCopilotIntent("1", decisionsOnlyContext, historyAfterClarify);
  assertEqual(first.target?.id, second.target?.id, "resolver a mesma seleção duas vezes sobre o mesmo contexto deve produzir o mesmo alvo");
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
