import type {
  DecisionCase,
  DecisionCaseArtifactRef,
  DecisionCaseCapability,
  DecisionCaseMetadata,
} from "../decision-case";
import { DecisionCaseState } from "../decision-case";
import { createDecisionPortfolio } from "./index";

const decisionCases: ReadonlyArray<DecisionCase> = [
  createDecisionCaseSnapshot({
    id: "decision-case-1",
    capability: "cash-intelligence",
    status: DecisionCaseState.ActionPlanReady,
    artifacts: [
      {
        id: "decision-1",
        type: "decision",
      },
      {
        id: "action-plan-1",
        type: "action-plan",
      },
    ],
    metadata: {
      source: "case-1",
    },
  }),
  createDecisionCaseSnapshot({
    id: "decision-case-2",
    capability: "tax-intelligence",
    status: DecisionCaseState.Monitoring,
    artifacts: [
      {
        id: "decision-2",
        type: "decision",
      },
    ],
  }),
  createDecisionCaseSnapshot({
    id: "decision-case-3",
    capability: "cash-intelligence",
    status: DecisionCaseState.Completed,
    artifacts: [
      {
        id: "decision-3",
        type: "decision",
      },
      {
        id: "recommendation-3",
        type: "recommendation",
      },
      {
        id: "playbook-3",
        type: "playbook",
      },
      {
        id: "action-plan-3",
        type: "action-plan",
      },
    ],
  }),
];

const input = {
  id: "decision-portfolio-1",
  name: "Executive Decision Portfolio",
  createdAt: "2026-07-02T10:00:00.000Z",
  decisionCases,
  metadata: {
    owner: "executive",
  },
};

runTest("creates portfolio", () => {
  const portfolio = createDecisionPortfolio(input);

  assertEqual(portfolio.id, input.id, "id mismatch");
  assertEqual(portfolio.name, input.name, "name mismatch");
  assertEqual(portfolio.createdAt, input.createdAt, "createdAt mismatch");
  assertEqual(portfolio.cases.length, 3, "case count mismatch");
});

runTest("preserves decision case references", () => {
  const portfolio = createDecisionPortfolio(input);
  const firstCase = portfolio.cases[0];

  assertExists(firstCase, "expected first portfolio case to exist");
  assertEqual(
    firstCase.decisionCaseId,
    "decision-case-1",
    "decisionCaseId mismatch",
  );
  assertEqual(
    firstCase.capability,
    "cash-intelligence",
    "capability mismatch",
  );
  assertEqual(firstCase.createdAt, "2026-07-02T10:00:00.000Z", "createdAt mismatch");
  assertEqual(firstCase.metadata["source"], "case-1", "metadata mismatch");
});

runTest("derives artifact types", () => {
  const portfolio = createDecisionPortfolio(input);
  const thirdCase = portfolio.cases[2];

  assertExists(thirdCase, "expected third portfolio case to exist");
  assertEqual(
    thirdCase.artifactTypes.join(","),
    "decision,recommendation,playbook,action-plan",
    "artifact types mismatch",
  );
});

runTest("calculates total cases", () => {
  const portfolio = createDecisionPortfolio(input);

  assertEqual(portfolio.summary.totalCases, 3, "total cases mismatch");
});

runTest("calculates cases by state", () => {
  const portfolio = createDecisionPortfolio(input);

  assertEqual(
    portfolio.summary.casesByState[DecisionCaseState.ActionPlanReady],
    1,
    "action plan ready count mismatch",
  );
  assertEqual(
    portfolio.summary.casesByState[DecisionCaseState.Monitoring],
    1,
    "monitoring count mismatch",
  );
  assertEqual(
    portfolio.summary.casesByState[DecisionCaseState.Completed],
    1,
    "completed count mismatch",
  );
});

runTest("calculates cases by capability", () => {
  const portfolio = createDecisionPortfolio(input);

  assertEqual(
    portfolio.summary.casesByCapability["cash-intelligence"],
    2,
    "cash capability count mismatch",
  );
  assertEqual(
    portfolio.summary.casesByCapability["tax-intelligence"],
    1,
    "tax capability count mismatch",
  );
});

runTest("calculates cases with action plan", () => {
  const portfolio = createDecisionPortfolio(input);

  assertEqual(
    portfolio.summary.casesWithActionPlan,
    2,
    "cases with action plan mismatch",
  );
});

runTest("calculates monitoring and completed counts", () => {
  const portfolio = createDecisionPortfolio(input);

  assertEqual(
    portfolio.summary.casesInMonitoring,
    1,
    "monitoring count mismatch",
  );
  assertEqual(portfolio.summary.casesCompleted, 1, "completed count mismatch");
});

runTest("supports empty portfolio", () => {
  const portfolio = createDecisionPortfolio({
    id: "decision-portfolio-empty",
    name: "Empty Portfolio",
    createdAt: "2026-07-02T10:00:00.000Z",
    decisionCases: [],
  });

  assertEqual(portfolio.capability, null, "capability mismatch");
  assertEqual(portfolio.cases.length, 0, "case count mismatch");
  assertEqual(portfolio.summary.totalCases, 0, "total cases mismatch");
  assertEqual(Object.keys(portfolio.summary.casesByState).length, 0, "state count mismatch");
  assertEqual(
    Object.keys(portfolio.summary.casesByCapability).length,
    0,
    "capability count mismatch",
  );
  assertEqual(
    portfolio.summary.casesWithActionPlan,
    0,
    "cases with action plan mismatch",
  );
  assertEqual(
    portfolio.summary.casesInMonitoring,
    0,
    "monitoring count mismatch",
  );
  assertEqual(portfolio.summary.casesCompleted, 0, "completed count mismatch");
});

runTest("deterministic output", () => {
  const first = JSON.stringify(createDecisionPortfolio(input));
  const second = JSON.stringify(createDecisionPortfolio(input));

  assertEqual(first, second, "expected deterministic output");
});

function createDecisionCaseSnapshot(input: {
  readonly id: string;
  readonly capability: DecisionCaseCapability;
  readonly status: DecisionCaseState;
  readonly artifacts: ReadonlyArray<DecisionCaseArtifactRef>;
  readonly metadata?: DecisionCaseMetadata;
}): DecisionCase {
  return {
    id: input.id,
    capability: input.capability,
    status: input.status,
    createdAt: "2026-07-02T10:00:00.000Z",
    timeline: [],
    artifacts: input.artifacts,
    metadata: input.metadata ?? {},
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
