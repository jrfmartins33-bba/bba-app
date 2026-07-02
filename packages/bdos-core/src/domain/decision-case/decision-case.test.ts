import {
  canTransition,
  createDecisionCase,
  DecisionCaseState,
} from "./index";

const input = {
  id: "decision-case-1",
  capability: "cash-intelligence",
  createdAt: "2026-07-02T10:00:00.000Z",
  actor: "bdos",
  artifacts: [
    {
      id: "decision-1",
      type: "decision" as const,
    },
    {
      id: "recommendation-1",
      type: "recommendation" as const,
    },
    {
      id: "playbook-1",
      type: "playbook" as const,
    },
    {
      id: "action-plan-1",
      type: "action-plan" as const,
    },
  ],
  metadata: {
    source: "test",
  },
};

runTest("createDecisionCase()", () => {
  const decisionCase = createDecisionCase(input);

  assertEqual(decisionCase.id, input.id, "id mismatch");
  assertEqual(decisionCase.capability, input.capability, "capability mismatch");
  assertEqual(decisionCase.createdAt, input.createdAt, "createdAt mismatch");
});

runTest("initial status", () => {
  const decisionCase = createDecisionCase(input);

  assertEqual(
    decisionCase.status,
    DecisionCaseState.Created,
    "status mismatch",
  );
});

runTest("initial timeline event", () => {
  const decisionCase = createDecisionCase(input);
  const event = decisionCase.timeline[0];

  assertEqual(decisionCase.timeline.length, 1, "timeline length mismatch");
  assertExists(event, "expected timeline event to exist");
  assertEqual(
    event.id,
    "decision-case-1:timeline:created",
    "timeline event id mismatch",
  );
  assertEqual(
    event.type,
    "decision_case_created",
    "timeline event type mismatch",
  );
  assertEqual(event.occurredAt, input.createdAt, "occurredAt mismatch");
  assertEqual(event.actor, input.actor, "actor mismatch");
});

runTest("deterministic output", () => {
  const first = JSON.stringify(createDecisionCase(input));
  const second = JSON.stringify(createDecisionCase(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("traceability preservation", () => {
  const decisionCase = createDecisionCase(input);

  assertEqual(decisionCase.artifacts.length, 4, "artifact count mismatch");
  assertEqual(decisionCase.artifacts[0]?.id, "decision-1", "decision id mismatch");
  assertEqual(decisionCase.artifacts[0]?.type, "decision", "decision type mismatch");
  assertEqual(
    decisionCase.artifacts[3]?.id,
    "action-plan-1",
    "action plan id mismatch",
  );
  assertEqual(
    decisionCase.artifacts[3]?.type,
    "action-plan",
    "action plan type mismatch",
  );
});

runTest("allowed transitions", () => {
  assertEqual(
    canTransition(DecisionCaseState.Created, DecisionCaseState.Observed),
    true,
    "created transition mismatch",
  );
  assertEqual(
    canTransition(DecisionCaseState.Observed, DecisionCaseState.Diagnosed),
    true,
    "observed transition mismatch",
  );
  assertEqual(
    canTransition(DecisionCaseState.Diagnosed, DecisionCaseState.DecisionBuilt),
    true,
    "diagnosed transition mismatch",
  );
  assertEqual(
    canTransition(DecisionCaseState.DecisionBuilt, DecisionCaseState.Recommended),
    true,
    "decision built transition mismatch",
  );
  assertEqual(
    canTransition(DecisionCaseState.Recommended, DecisionCaseState.PlaybookBuilt),
    true,
    "recommended transition mismatch",
  );
  assertEqual(
    canTransition(
      DecisionCaseState.PlaybookBuilt,
      DecisionCaseState.ActionPlanReady,
    ),
    true,
    "playbook built transition mismatch",
  );
  assertEqual(
    canTransition(DecisionCaseState.ActionPlanReady, DecisionCaseState.Monitoring),
    true,
    "action plan ready transition mismatch",
  );
  assertEqual(
    canTransition(DecisionCaseState.Monitoring, DecisionCaseState.Completed),
    true,
    "monitoring transition mismatch",
  );
  assertEqual(
    canTransition(DecisionCaseState.Completed, DecisionCaseState.Archived),
    true,
    "completed transition mismatch",
  );
});

runTest("unsupported transitions return false", () => {
  assertEqual(
    canTransition(DecisionCaseState.Created, DecisionCaseState.Diagnosed),
    false,
    "skip transition mismatch",
  );
  assertEqual(
    canTransition(DecisionCaseState.Archived, DecisionCaseState.Created),
    false,
    "archived transition mismatch",
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

function assertExists<T>(
  value: T | null | undefined,
  message: string,
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
}
