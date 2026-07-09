import type { EngineeringAdvisorPromptContext } from "../advisor-prompt-context.types";
import { ExecutionTaskStatus, type ExecutionTask, type ExecutionWorkflow } from "../../services/execution-management";
import {
  CLARIFY_LIST_INTRO,
  COPILOT_RULE_BASED_MODEL,
  buildApprovalTurn,
  buildClarifyTurn,
  buildUnsupportedActionTurn
} from "./copilot-deterministic-turn-builder";

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
  recommendations: [],
  evidence: {}
};

runTest("buildClarifyTurn nunca usa 'claude-sonnet-5' — sentinela de turno determinístico", () => {
  const turn = buildClarifyTurn(context, null);
  assertEqual(turn.model, COPILOT_RULE_BASED_MODEL, "model deve ser o sentinela rule-based, nunca um nome de modelo real");
});

runTest("buildClarifyTurn produz uma lista numerada citando só títulos reais do contexto", () => {
  const turn = buildClarifyTurn(context, null);

  assertTrue(turn.content.startsWith(CLARIFY_LIST_INTRO), "conteúdo deve começar com o prefixo fixo reconhecido pelo Intent Router");
  assertTrue(turn.content.includes("1. Bloco 2"), "primeira opção deve ser a Decision de maior prioridade (critical)");
  assertTrue(turn.content.includes("2. Bloco 3"), "segunda opção deve ser a próxima por prioridade (high)");
  assertTrue(turn.content.includes("3. Escavação"), "terceira opção deve ser a Decision de prioridade medium");
});

runTest("buildClarifyTurn preenche os 4 campos exigidos pelo CHECK de trilha completa, mesmo sem chamar o Claude", () => {
  const turn = buildClarifyTurn(context, "snapshot-1");

  assertTrue(turn.contextSnapshot !== null, "context_snapshot precisa estar presente");
  assertTrue(turn.confidence !== null, "confidence precisa estar presente");
  assertTrue(turn.explainability !== null, "explainability precisa estar presente");
  assertTrue(turn.model !== null && turn.model.length > 0, "model precisa estar presente");
  assertEqual(turn.confidence.overall, "low", "confidence de uma pergunta de esclarecimento deve ser degenerada (low), nunca inferida");
  assertEqual(turn.decisionSnapshotId, "snapshot-1", "decisionSnapshotId deve ser repassado como recebido");
});

runTest("buildClarifyTurn é determinístico: duas chamadas sobre o mesmo contexto produzem a mesma lista", () => {
  assertEqual(buildClarifyTurn(context, null).content, buildClarifyTurn(context, null).content, "duas chamadas devem produzir exatamente o mesmo texto — é a garantia que permite resolver 'a 2ª opção' na mensagem seguinte");
});

runTest("buildUnsupportedActionTurn nunca sugere que uma ação foi executada e usa o sentinela rule-based", () => {
  const turn = buildUnsupportedActionTurn(context, null);

  assertEqual(turn.model, COPILOT_RULE_BASED_MODEL, "model deve ser o sentinela rule-based");
  assertTrue(turn.content.toLowerCase().includes("não consigo executar"), "conteúdo deve deixar claro que a ação não foi executada");
  assertTrue(turn.contextSnapshot !== null && turn.confidence !== null && turn.explainability !== null, "trilha de auditoria completa mesmo para uma recusa");
});

const workflow: ExecutionWorkflow = {
  id: "execution-workflow:action-plan:playbook:recommendation-1:generic:generic",
  actionPlanId: "action-plan:playbook:recommendation-1:generic:generic",
  name: "Regularizar geometria espacial do Bloco 3",
  objective: "A geometria do Bloco 3 precisa ser regularizada antes da próxima medição.",
  ownerRole: "",
  createdAt: "2026-07-09T09:00:00.000Z",
  metadata: {}
};

function executionTask(overrides: Partial<ExecutionTask> = {}): ExecutionTask {
  return {
    id: "execution-task:action-1",
    workflowId: workflow.id,
    sourceActionId: "action-1",
    scheduleActivityId: null,
    title: "Regularizar geometria espacial",
    description: "Corrigir a geometria do SpatialObject associado ao Bloco 3.",
    assignee: null,
    dueDate: null,
    status: ExecutionTaskStatus.NotStarted,
    block: null,
    evidenceReferences: [],
    completedAt: null,
    createdAt: "2026-07-09T09:00:00.000Z",
    updatedAt: "2026-07-09T09:00:00.000Z",
    metadata: {},
    ...overrides
  };
}

runTest("buildApprovalTurn nunca chama o Claude — usa o sentinela rule-based", () => {
  const turn = buildApprovalTurn(context, null, workflow, [executionTask()]);
  assertEqual(turn.model, COPILOT_RULE_BASED_MODEL, "model deve ser o sentinela rule-based");
});

runTest("buildApprovalTurn cita o nome real do workflow e a contagem real de tasks, sem invenção", () => {
  const tasks = [executionTask({ id: "execution-task:action-1" }), executionTask({ id: "execution-task:action-2", sourceActionId: "action-2" })];
  const turn = buildApprovalTurn(context, null, workflow, tasks);

  assertTrue(turn.content.includes(workflow.name), "conteúdo deve citar o nome real do workflow");
  assertTrue(turn.content.includes("2 tarefas"), "conteúdo deve citar a contagem real de tasks, no plural");
});

runTest("buildApprovalTurn usa singular quando há exatamente 1 task", () => {
  const turn = buildApprovalTurn(context, null, workflow, [executionTask()]);
  assertTrue(turn.content.includes("1 tarefa"), "conteúdo deve usar singular para exatamente 1 task, nunca '1 tarefas'");
});

runTest("buildApprovalTurn preenche os 4 campos exigidos pelo CHECK de trilha completa", () => {
  const turn = buildApprovalTurn(context, "snapshot-1", workflow, [executionTask()]);

  assertTrue(turn.contextSnapshot !== null, "context_snapshot precisa estar presente");
  assertTrue(turn.confidence !== null, "confidence precisa estar presente");
  assertTrue(turn.explainability !== null, "explainability precisa estar presente");
  assertTrue(turn.model !== null && turn.model.length > 0, "model precisa estar presente");
  assertEqual(turn.confidence.reasons[0], "recommendation_approved", "confidence.reasons deve citar o motivo dedicado à aprovação");
  assertEqual(turn.decisionSnapshotId, "snapshot-1", "decisionSnapshotId deve ser repassado como recebido");
});

runTest("buildApprovalTurn não inventa decisions/recommendations na explainability — Recommendation real não carrega isNew/recurring", () => {
  const turn = buildApprovalTurn(context, null, workflow, [executionTask()]);

  assertEqual(turn.explainability.decisions.length, 0, "explainability.decisions deve ficar vazio — aprovação não é sobre citar Decisions");
  assertEqual(turn.explainability.recommendations.length, 0, "explainability.recommendations deve ficar vazio — inventar isNew/recurring violaria a regra de honestidade");
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
