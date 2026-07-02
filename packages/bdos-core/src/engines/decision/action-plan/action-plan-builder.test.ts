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

runTest("supported playbook creates action plan", () => {
  const actionPlans = buildActionPlans([supportedPlaybook]);

  assertEqual(actionPlans.length, 1, "expected one action plan");
  assertEqual(
    actionPlans[0]?.name,
    "Cash Protection Action Plan",
    "name mismatch",
  );
});

runTest("unsupported playbook creates no action plan", () => {
  const actionPlans = buildActionPlans([
    {
      ...supportedPlaybook,
      metadata: {
        ...supportedPlaybook.metadata,
        recommendationType: "unsupported",
      },
    },
  ]);

  assertEqual(actionPlans.length, 0, "expected no action plans");
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
