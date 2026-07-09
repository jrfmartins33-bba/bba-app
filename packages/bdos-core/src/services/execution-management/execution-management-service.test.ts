import type { ActionPlan } from "../../engines/decision/action-plan";
import type { Recommendation } from "../../engines/decision/recommendation";
import { createExecutionWorkflowFromActionPlan, materializeExecutionWorkflowFromRecommendation } from "./execution-management-service";

function actionPlan(overrides: Partial<ActionPlan> = {}): ActionPlan {
  return {
    id: "action-plan-1",
    playbookId: "playbook-1",
    name: "Reduzir atraso do Bloco 2",
    objective: "Executar as ações do plano aprovado para o Bloco 2.",
    actions: [
      {
        id: "action-1",
        title: "Mobilizar equipe adicional",
        description: "Reforçar a equipe de campo do Bloco 2.",
        sequence: 1,
        priority: "critical",
        expectedOutcome: "Equipe reforçada em até 2 dias.",
        sourceStepId: "step-1",
      },
      {
        id: "action-2",
        title: "Renegociar prazo com fornecedor",
        description: "Contatar o fornecedor de material para antecipar entrega.",
        sequence: 2,
        priority: "high",
        expectedOutcome: "Novo prazo confirmado.",
        sourceStepId: "step-2",
      },
    ],
    checkpoints: [],
    ownerRole: "site-engineer",
    status: "created",
    metadata: {},
    ...overrides,
  };
}

const baseInput = {
  createdAt: "2026-07-01T09:00:00.000Z",
  correlationId: "corr-1",
  createdBy: "user-1",
  sourceSystem: "execution-handoff",
};

runTest("createExecutionWorkflowFromActionPlan cria 1 workflow e 1 task por Action", () => {
  const plan = actionPlan();
  const result = createExecutionWorkflowFromActionPlan({ actionPlan: plan, ...baseInput });

  assertTrue(result.success, "criação a partir de um ActionPlan válido deve ter sucesso");
  assertTrue(result.workflow !== null, "workflow deve ser criado");
  assertEqual(result.tasks.length, 2, "deve criar exatamente 1 task por Action do ActionPlan");
});

runTest("cada ExecutionTask carrega sourceActionId apontando para a Action real que a originou — PRINCIPLE 006", () => {
  const plan = actionPlan();
  const result = createExecutionWorkflowFromActionPlan({ actionPlan: plan, ...baseInput });

  const sourceIds = result.tasks.map((task) => task.sourceActionId).sort();
  assertEqual(sourceIds.join(","), "action-1,action-2", "sourceActionId de cada task deve corresponder a uma Action real do ActionPlan");
});

runTest("ExecutionWorkflow.actionPlanId aponta para o ActionPlan real que o originou", () => {
  const plan = actionPlan();
  const result = createExecutionWorkflowFromActionPlan({ actionPlan: plan, ...baseInput });

  assertEqual(result.workflow?.actionPlanId, "action-plan-1", "actionPlanId deve ser o id real do ActionPlan de origem");
});

runTest("título e descrição da ExecutionTask vêm exatamente da Action, sem invenção", () => {
  const plan = actionPlan();
  const result = createExecutionWorkflowFromActionPlan({ actionPlan: plan, ...baseInput });

  const taskForAction1 = result.tasks.find((task) => task.sourceActionId === "action-1");
  assertEqual(taskForAction1?.title, "Mobilizar equipe adicional", "título da task deve vir exatamente do título da Action");
  assertEqual(taskForAction1?.description, "Reforçar a equipe de campo do Bloco 2.", "descrição da task deve vir exatamente da descrição da Action");
});

runTest("scheduleActivityIdByActionId aplica o vínculo só para as Actions mapeadas, deixando as demais null", () => {
  const plan = actionPlan();
  const result = createExecutionWorkflowFromActionPlan({
    actionPlan: plan,
    ...baseInput,
    scheduleActivityIdByActionId: { "action-1": "schedule-activity-1" },
  });

  const taskForAction1 = result.tasks.find((task) => task.sourceActionId === "action-1");
  const taskForAction2 = result.tasks.find((task) => task.sourceActionId === "action-2");
  assertEqual(taskForAction1?.scheduleActivityId, "schedule-activity-1", "Action mapeada deve carregar o scheduleActivityId correspondente");
  assertEqual(taskForAction2?.scheduleActivityId, null, "Action não mapeada deve permanecer com scheduleActivityId null — nunca inferido");
});

runTest("é determinístico: o mesmo ActionPlan produz sempre os mesmos ids de workflow/tasks (idempotência)", () => {
  const plan = actionPlan();
  const first = createExecutionWorkflowFromActionPlan({ actionPlan: plan, ...baseInput });
  const second = createExecutionWorkflowFromActionPlan({ actionPlan: plan, ...baseInput });

  assertEqual(first.workflow?.id, second.workflow?.id, "o id do workflow deve ser o mesmo em duas chamadas com o mesmo ActionPlan");
  assertEqual(
    first.tasks.map((task) => task.id).sort().join(","),
    second.tasks.map((task) => task.id).sort().join(","),
    "os ids das tasks devem ser os mesmos em duas chamadas com o mesmo ActionPlan"
  );
});

runTest("ActionPlan sem nenhuma Action ainda cria um workflow válido, só sem tasks", () => {
  const plan = actionPlan({ actions: [] });
  const result = createExecutionWorkflowFromActionPlan({ actionPlan: plan, ...baseInput });

  assertTrue(result.success, "workflow sem tasks ainda é um resultado válido");
  assertTrue(result.workflow !== null, "workflow deve ser criado mesmo sem Actions");
  assertEqual(result.tasks.length, 0, "nenhuma task deve ser criada quando o ActionPlan não tem Actions");
});

// Epic 16.6C — ActionPlan Materialization Orchestrator. Fixture
// genérica (fora de cash_protection) — antes do 16.6A/16.6B isso
// produzia 0 Playbooks/ActionPlans; agora materializa de ponta a
// ponta pelo caminho genérico.
const genericRecommendation: Recommendation = {
  id: "recommendation-1",
  decisionId: "decision-1",
  title: "Regularizar geometria espacial do Bloco 3",
  summary: "A geometria do Bloco 3 precisa ser regularizada antes da próxima medição.",
  options: [
    {
      id: "recommendation-1:option:regularize_spatial_geometry",
      type: "regularize_spatial_geometry",
      title: "Regularizar geometria espacial",
      description: "Corrigir a geometria do SpatialObject associado ao Bloco 3.",
    },
    {
      id: "recommendation-1:option:attach_spatial_evidence",
      type: "attach_spatial_evidence",
      title: "Anexar evidência espacial",
      description: "Anexar levantamento RTK atualizado como evidência.",
    },
  ],
  traceability: {
    decisionId: "decision-1",
    diagnosisId: "diagnosis-1",
    capabilities: ["geospatial-intelligence"],
    evidenceReferences: ["spatial-confidence"],
    businessFactIds: ["fact-1"],
  },
  metadata: {
    recommendationType: "spatial_confidence",
    decisionPriority: "high",
  },
  createdAt: "2026-07-09T09:00:00.000Z",
};

const cashProtectionRecommendation: Recommendation = {
  id: "recommendation-2",
  decisionId: "decision-2",
  title: "Proteger caixa projetado",
  summary: "Déficit de caixa projetado exige ação imediata.",
  options: [],
  traceability: {
    decisionId: "decision-2",
    diagnosisId: "diagnosis-2",
    capabilities: ["cash-intelligence"],
    evidenceReferences: ["cash-projection"],
    businessFactIds: ["fact-2"],
  },
  metadata: {
    recommendationType: "cash_protection",
    decisionPriority: "critical",
  },
  createdAt: "2026-07-09T09:00:00.000Z",
};

runTest("materializeExecutionWorkflowFromRecommendation materializa ponta a ponta pelo caminho genérico (16.6A/16.6B) — antes disso produzia 0 resultado", () => {
  const result = materializeExecutionWorkflowFromRecommendation({ recommendation: genericRecommendation, ...baseInput });

  assertTrue(result.success, "materialização de uma Recommendation genérica deve ter sucesso");
  assertTrue(result.workflow !== null, "workflow deve ser criado");
  assertEqual(result.tasks.length, genericRecommendation.options.length, "1 task por RecommendationOption, via 1 PlaybookStep, via 1 Action");
});

runTest("cadeia PRINCIPLE 006 completa: sourceActionId de cada task aponta para uma Action real, nascida de um PlaybookStep real", () => {
  const result = materializeExecutionWorkflowFromRecommendation({ recommendation: genericRecommendation, ...baseInput });

  assertTrue(result.success, "fixture inválida se isto falhar");
  const titles = result.tasks.map((task) => task.title).sort();
  const optionTitles = genericRecommendation.options.map((option) => option.title).sort();
  assertEqual(titles.join(","), optionTitles.join(","), "título de cada task deve rastrear até o título real da RecommendationOption que a originou, sem invenção em nenhum elo da cadeia");
});

runTest("materializeExecutionWorkflowFromRecommendation também funciona para o caminho curado (cash protection), sem regressão", () => {
  const result = materializeExecutionWorkflowFromRecommendation({ recommendation: cashProtectionRecommendation, ...baseInput });

  assertTrue(result.success, "materialização de uma Recommendation de cash protection deve continuar funcionando");
  assertTrue(result.workflow !== null, "workflow deve ser criado");
  assertEqual(result.tasks.length, 5, "template curado de cash protection sempre gera 5 steps/actions");
});

runTest("materializeExecutionWorkflowFromRecommendation é determinístico — nenhuma lógica nova, só composição", () => {
  const first = materializeExecutionWorkflowFromRecommendation({ recommendation: genericRecommendation, ...baseInput });
  const second = materializeExecutionWorkflowFromRecommendation({ recommendation: genericRecommendation, ...baseInput });

  assertEqual(first.workflow?.id, second.workflow?.id, "mesmo id de workflow em duas chamadas com a mesma Recommendation");
  assertEqual(
    first.tasks.map((task) => task.id).sort().join(","),
    second.tasks.map((task) => task.id).sort().join(","),
    "mesmos ids de task em duas chamadas com a mesma Recommendation"
  );
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
