import type { Playbook } from "../playbook";
import { buildActionPlans } from "./action-plan-builder";

const supportedPlaybook: Playbook = {
  id: "playbook:recommendation-1:cash-protection",
  name: "Cash Protection Playbook",
  objective: "Preserve cash while maintaining business continuity.",
  description: "Structured business playbook.",
  recommendationId: "recommendation-1",
  steps: [
    createStep(1, "Suspend discretionary spending", "critical"),
    createStep(2, "Accelerate receivables", "high"),
    createStep(3, "Renegotiate supplier payment terms", "high"),
    createStep(4, "Review operating expenses", "medium"),
    createStep(5, "Monitor daily cash position", "high"),
  ],
  kpis: ["Projected Cash"],
  risks: ["Supplier dissatisfaction"],
  successCriteria: [
    "Positive projected cash",
    "Positive operating cash flow",
    "Payroll paid on time",
    "Taxes paid on time",
    "Minimum cash reserve maintained",
  ],
  metadata: {
    recommendationType: "cash_protection",
    decisionId: "decision-1",
    diagnosisId: "diagnosis-1",
    capability: "cash-intelligence",
    capabilities: ["cash-intelligence"],
    businessFactIds: ["fact-1"],
  },
};

// Playbook genérico (Epic 16.6B) — mesma forma que buildGenericPlaybook
// (playbook-builder.ts) produz para uma Recommendation fora de cash
// protection: steps sem estimatedImpact/estimatedEffort, kpis/risks/
// successCriteria vazios.
const genericPlaybook: Playbook = {
  id: "playbook:recommendation-2:generic",
  name: "Regularizar geometria espacial do Bloco 3",
  objective: "A geometria do Bloco 3 precisa ser regularizada antes da próxima medição.",
  description: "Plano de ação derivado diretamente das opções desta Recommendation.",
  recommendationId: "recommendation-2",
  steps: [
    {
      id: "playbook:recommendation-2:step:option-1",
      title: "Regularizar geometria espacial",
      description: "Corrigir a geometria do SpatialObject associado ao Bloco 3.",
      priority: "high",
    },
    {
      id: "playbook:recommendation-2:step:option-2",
      title: "Anexar evidência espacial",
      description: "Anexar levantamento RTK atualizado como evidência.",
      priority: "high",
    },
  ],
  kpis: [],
  risks: [],
  successCriteria: [],
  metadata: {
    recommendationType: "spatial_confidence",
    decisionId: "decision-2",
    diagnosisId: "diagnosis-2",
    capability: "geospatial-intelligence",
    capabilities: ["geospatial-intelligence"],
    businessFactIds: ["fact-2"],
  },
};

runTest("supported playbook creates the curated cash protection action plan", () => {
  const actionPlans = buildActionPlans([supportedPlaybook]);

  assertEqual(actionPlans.length, 1, "expected one action plan");
  assertEqual(
    actionPlans[0]?.name,
    "Cash Protection Action Plan",
    "name mismatch",
  );
});

runTest("Epic 16.6B: unsupported playbook now creates a generic action plan, never null/empty", () => {
  const actionPlans = buildActionPlans([genericPlaybook]);

  assertEqual(actionPlans.length, 1, "todo Playbook agora produz um ActionPlan, generalização do 16.6B");
  assertTrue(actionPlans[0]?.id.includes(":generic"), "action plan genérico deve ter um id que o identifica como tal");
});

runTest("generic action plan cria exatamente 1 Action por PlaybookStep, cada uma com sourceStepId real — PRINCIPLE 006", () => {
  const actionPlan = buildActionPlans([genericPlaybook])[0];

  assertExists(actionPlan, "expected action plan to exist");
  assertEqual(actionPlan.actions.length, genericPlaybook.steps.length, "1 Action por PlaybookStep, nem mais nem menos");
  actionPlan.actions.forEach((action, index) => {
    assertEqual(action.sourceStepId, genericPlaybook.steps[index]?.id, "sourceStepId deve apontar para o PlaybookStep real que a originou");
    assertEqual(action.title, genericPlaybook.steps[index]?.title, "título da Action deve vir exatamente do PlaybookStep");
  });
});

runTest("generic action plan não inventa checkpoints nem ownerRole — regra de honestidade", () => {
  const actionPlan = buildActionPlans([genericPlaybook])[0];

  assertExists(actionPlan, "expected action plan to exist");
  assertEqual(actionPlan.checkpoints.length, 0, "checkpoints deve ficar vazio — nenhum template curado existe para descrever isso genericamente");
  assertEqual(actionPlan.ownerRole, "", "ownerRole deve ficar vazio — nenhuma fonte real de dado no caminho genérico");
});

runTest("generic action plan name/objective vêm exatamente do Playbook, sem invenção", () => {
  const actionPlan = buildActionPlans([genericPlaybook])[0];

  assertExists(actionPlan, "expected action plan to exist");
  assertEqual(actionPlan.name, genericPlaybook.name, "name deve vir exatamente do Playbook");
  assertEqual(actionPlan.objective, genericPlaybook.objective, "objective deve vir exatamente do Playbook");
});

runTest("curated cash protection action plan continua com checkpoints/ownerRole normalmente", () => {
  const actionPlan = buildActionPlans([supportedPlaybook])[0];

  assertExists(actionPlan, "expected action plan to exist");
  assertEqual(actionPlan.checkpoints.length, 5, "template curado deve continuar com os 5 checkpoints — só o caminho genérico os omite");
  assertEqual(actionPlan.ownerRole, "Finance owner", "template curado deve continuar preenchendo ownerRole");
});

runTest("deterministic output", () => {
  const first = JSON.stringify(buildActionPlans([supportedPlaybook]));
  const second = JSON.stringify(buildActionPlans([supportedPlaybook]));

  assertEqual(first, second, "expected deterministic output");
});

runTest("traceability preservation", () => {
  const actionPlan = buildActionPlans([supportedPlaybook])[0];

  assertExists(actionPlan, "expected action plan to exist");
  assertEqual(actionPlan.playbookId, supportedPlaybook.id, "playbookId mismatch");
  assertEqual(
    actionPlan.metadata["recommendationId"],
    supportedPlaybook.recommendationId,
    "recommendationId mismatch",
  );
  assertEqual(actionPlan.metadata["decisionId"], "decision-1", "decisionId mismatch");
  assertEqual(
    actionPlan.metadata["diagnosisId"],
    "diagnosis-1",
    "diagnosisId mismatch",
  );
  assertEqual(
    actionPlan.metadata["capability"],
    "cash-intelligence",
    "capability mismatch",
  );
});

runTest("action sequence preservation", () => {
  const actionPlan = buildActionPlans([supportedPlaybook])[0];

  assertExists(actionPlan, "expected action plan to exist");
  assertEqual(actionPlan.actions.length, 5, "actions count mismatch");
  actionPlan.actions.forEach((action, index) => {
    assertEqual(action.sequence, index + 1, "sequence mismatch");
    assertEqual(
      action.title,
      supportedPlaybook.steps[index]?.title,
      "title mismatch",
    );
    assertEqual(
      action.sourceStepId,
      supportedPlaybook.steps[index]?.id,
      "sourceStepId mismatch",
    );
  });
});

runTest("checkpoints created", () => {
  const actionPlan = buildActionPlans([supportedPlaybook])[0];

  assertExists(actionPlan, "expected action plan to exist");
  assertEqual(actionPlan.checkpoints.length, 5, "checkpoints count mismatch");
  assertEqual(
    actionPlan.checkpoints[0]?.title,
    "Cash position reviewed",
    "checkpoint title mismatch",
  );
  assertEqual(
    actionPlan.checkpoints[4]?.title,
    "Cash projection updated",
    "checkpoint title mismatch",
  );
});

runTest("status initialized but not executed", () => {
  const actionPlan = buildActionPlans([supportedPlaybook])[0];

  assertExists(actionPlan, "expected action plan to exist");
  assertEqual(actionPlan.status, "created", "status mismatch");
});

function createStep(
  sequence: number,
  title: string,
  priority: "critical" | "high" | "medium" | "low",
) {
  return {
    id: `playbook:recommendation-1:cash-protection:step:${sequence}`,
    title,
    description: `${title} description`,
    priority,
    estimatedImpact: "high" as const,
    estimatedEffort: "medium" as const,
  };
}

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertExists<T>(
  value: T | null | undefined,
  message: string,
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}
