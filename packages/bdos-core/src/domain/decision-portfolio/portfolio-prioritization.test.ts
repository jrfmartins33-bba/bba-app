import type { DecisionPortfolioCase } from "./decision-portfolio.types";
import { DecisionCaseState } from "../decision-case";
import { prioritizeDecisionPortfolio } from "./portfolio-prioritization";

const generatedAt = "2026-07-02T12:00:00.000Z";

runTest("prioritizes portfolio cases", () => {
  const portfolio = createPortfolio([
    createPortfolioCase({
      decisionCaseId: "case-low",
      state: DecisionCaseState.Created,
      capability: "operations",
    }),
    createPortfolioCase({
      decisionCaseId: "case-top",
      state: DecisionCaseState.Monitoring,
      capability: "cash-intelligence",
      artifactTypes: ["action-plan"],
    }),
  ]);

  const prioritizedPortfolio = prioritizeDecisionPortfolio({
    portfolio,
    generatedAt,
  });

  assertEqual(prioritizedPortfolio.portfolioId, portfolio.id, "portfolioId mismatch");
  assertEqual(prioritizedPortfolio.generatedAt, generatedAt, "generatedAt mismatch");
  assertEqual(prioritizedPortfolio.items.length, 2, "item count mismatch");
  assertEqual(
    prioritizedPortfolio.items[0]?.decisionCaseId,
    "case-top",
    "top item mismatch",
  );
  assertEqual(prioritizedPortfolio.items[0]?.rank, 1, "rank mismatch");
});

runTest("scoring by state", () => {
  const item = prioritizeSingleCase(
    createPortfolioCase({
      decisionCaseId: "case-monitoring",
      state: DecisionCaseState.Monitoring,
      capability: "operations",
    }),
  );

  assertEqual(item.score, 80, "state score mismatch");
  assertEqual(item.reasons[0], "state:monitoring:80", "state reason mismatch");
});

runTest("scoring by action-plan artifact", () => {
  const item = prioritizeSingleCase(
    createPortfolioCase({
      decisionCaseId: "case-action-plan",
      state: DecisionCaseState.Created,
      capability: "operations",
      artifactTypes: ["action-plan"],
    }),
  );

  assertEqual(item.score, 25, "action-plan score mismatch");
  assertIncludes(item.reasons, "artifact:action-plan:+15", "missing action-plan reason");
});

runTest("scoring by cash capability", () => {
  const item = prioritizeSingleCase(
    createPortfolioCase({
      decisionCaseId: "case-cash",
      state: DecisionCaseState.Created,
      capability: "cash-intelligence",
    }),
  );

  assertEqual(item.score, 20, "cash score mismatch");
  assertIncludes(item.reasons, "capability:cash:+10", "missing cash reason");
});

runTest("scoring by severity metadata", () => {
  const portfolio = createPortfolio([
    createPortfolioCase({
      decisionCaseId: "case-critical",
      state: DecisionCaseState.Created,
      capability: "operations",
      metadata: {
        severity: "critical",
      },
    }),
    createPortfolioCase({
      decisionCaseId: "case-high",
      state: DecisionCaseState.Created,
      capability: "operations",
      metadata: {
        severity: "high",
      },
    }),
  ]);

  const prioritizedPortfolio = prioritizeDecisionPortfolio({
    portfolio,
    generatedAt,
  });

  assertEqual(prioritizedPortfolio.items[0]?.score, 20, "critical score mismatch");
  assertIncludes(
    prioritizedPortfolio.items[0]?.reasons ?? [],
    "severity:critical:+10",
    "missing critical severity reason",
  );
  assertEqual(prioritizedPortfolio.items[1]?.score, 15, "high score mismatch");
  assertIncludes(
    prioritizedPortfolio.items[1]?.reasons ?? [],
    "severity:high:+5",
    "missing high severity reason",
  );
});

runTest("ranking tie-breaker by createdAt", () => {
  const portfolio = createPortfolio([
    createPortfolioCase({
      decisionCaseId: "case-newer",
      state: DecisionCaseState.Created,
      createdAt: "2026-07-02T11:00:00.000Z",
    }),
    createPortfolioCase({
      decisionCaseId: "case-older",
      state: DecisionCaseState.Created,
      createdAt: "2026-07-01T11:00:00.000Z",
    }),
  ]);

  const prioritizedPortfolio = prioritizeDecisionPortfolio({
    portfolio,
    generatedAt,
  });

  assertEqual(
    prioritizedPortfolio.items[0]?.decisionCaseId,
    "case-older",
    "createdAt tie-breaker mismatch",
  );
});

runTest("ranking tie-breaker by decisionCaseId", () => {
  const portfolio = createPortfolio([
    createPortfolioCase({
      decisionCaseId: "case-b",
      state: DecisionCaseState.Created,
    }),
    createPortfolioCase({
      decisionCaseId: "case-a",
      state: DecisionCaseState.Created,
    }),
  ]);

  const prioritizedPortfolio = prioritizeDecisionPortfolio({
    portfolio,
    generatedAt,
  });

  assertEqual(
    prioritizedPortfolio.items[0]?.decisionCaseId,
    "case-a",
    "decisionCaseId tie-breaker mismatch",
  );
});

runTest("priority threshold mapping", () => {
  const portfolio = createPortfolio([
    createPortfolioCase({
      decisionCaseId: "case-critical",
      state: DecisionCaseState.Monitoring,
      capability: "cash-intelligence",
      metadata: {
        severity: "critical",
      },
    }),
    createPortfolioCase({
      decisionCaseId: "case-high",
      state: DecisionCaseState.ActionPlanReady,
    }),
    createPortfolioCase({
      decisionCaseId: "case-medium",
      state: DecisionCaseState.DecisionBuilt,
    }),
    createPortfolioCase({
      decisionCaseId: "case-low",
      state: DecisionCaseState.Diagnosed,
    }),
  ]);

  const prioritizedPortfolio = prioritizeDecisionPortfolio({
    portfolio,
    generatedAt,
  });

  assertPriority(prioritizedPortfolio.items, "case-critical", "critical");
  assertPriority(prioritizedPortfolio.items, "case-high", "high");
  assertPriority(prioritizedPortfolio.items, "case-medium", "medium");
  assertPriority(prioritizedPortfolio.items, "case-low", "low");
});

runTest("summary counts", () => {
  const portfolio = createPortfolio([
    createPortfolioCase({
      decisionCaseId: "case-critical",
      state: DecisionCaseState.Monitoring,
      capability: "cash-intelligence",
      metadata: {
        severity: "critical",
      },
    }),
    createPortfolioCase({
      decisionCaseId: "case-high",
      state: DecisionCaseState.ActionPlanReady,
    }),
    createPortfolioCase({
      decisionCaseId: "case-medium",
      state: DecisionCaseState.DecisionBuilt,
    }),
    createPortfolioCase({
      decisionCaseId: "case-low",
      state: DecisionCaseState.Observed,
    }),
  ]);

  const prioritizedPortfolio = prioritizeDecisionPortfolio({
    portfolio,
    generatedAt,
  });

  assertEqual(prioritizedPortfolio.summary.totalItems, 4, "total items mismatch");
  assertEqual(prioritizedPortfolio.summary.criticalCount, 1, "critical count mismatch");
  assertEqual(prioritizedPortfolio.summary.highCount, 1, "high count mismatch");
  assertEqual(prioritizedPortfolio.summary.mediumCount, 1, "medium count mismatch");
  assertEqual(prioritizedPortfolio.summary.lowCount, 1, "low count mismatch");
  assertEqual(
    prioritizedPortfolio.summary.topDecisionCaseId,
    "case-critical",
    "top decision case id mismatch",
  );
});

runTest("deterministic output", () => {
  const portfolio = createPortfolio([
    createPortfolioCase({
      decisionCaseId: "case-1",
      state: DecisionCaseState.Monitoring,
      capability: "cash-intelligence",
    }),
  ]);

  const first = JSON.stringify(prioritizeDecisionPortfolio({ portfolio, generatedAt }));
  const second = JSON.stringify(prioritizeDecisionPortfolio({ portfolio, generatedAt }));

  assertEqual(first, second, "expected deterministic output");
});

runTest("does not mutate original portfolio", () => {
  const portfolio = createPortfolio([
    createPortfolioCase({
      decisionCaseId: "case-b",
      state: DecisionCaseState.Created,
    }),
    createPortfolioCase({
      decisionCaseId: "case-a",
      state: DecisionCaseState.Created,
    }),
  ]);
  const before = JSON.stringify(portfolio);

  prioritizeDecisionPortfolio({ portfolio, generatedAt });

  assertEqual(JSON.stringify(portfolio), before, "portfolio mutation mismatch");
});

runTest("empty portfolio returns empty prioritized portfolio", () => {
  const portfolio = createPortfolio([]);
  const prioritizedPortfolio = prioritizeDecisionPortfolio({
    portfolio,
    generatedAt,
  });

  assertEqual(prioritizedPortfolio.items.length, 0, "item count mismatch");
  assertEqual(prioritizedPortfolio.summary.totalItems, 0, "total items mismatch");
  assertEqual(prioritizedPortfolio.summary.criticalCount, 0, "critical count mismatch");
  assertEqual(prioritizedPortfolio.summary.highCount, 0, "high count mismatch");
  assertEqual(prioritizedPortfolio.summary.mediumCount, 0, "medium count mismatch");
  assertEqual(prioritizedPortfolio.summary.lowCount, 0, "low count mismatch");
  assertEqual(
    prioritizedPortfolio.summary.topDecisionCaseId,
    null,
    "top decision case id mismatch",
  );
});

function prioritizeSingleCase(portfolioCase: DecisionPortfolioCase) {
  const prioritizedPortfolio = prioritizeDecisionPortfolio({
    portfolio: createPortfolio([portfolioCase]),
    generatedAt,
  });
  const item = prioritizedPortfolio.items[0];

  assertExists(item, "expected prioritized item to exist");

  return item;
}

function createPortfolio(cases: ReadonlyArray<DecisionPortfolioCase>) {
  return {
    id: "decision-portfolio-1",
    name: "Executive Decision Portfolio",
    createdAt: "2026-07-02T10:00:00.000Z",
    capability: null,
    cases,
    summary: {
      totalCases: cases.length,
      casesByState: {},
      casesByCapability: {},
      casesWithActionPlan: 0,
      casesInMonitoring: 0,
      casesCompleted: 0,
    },
    metadata: {
      owner: "executive",
    },
  };
}

function createPortfolioCase(input: {
  readonly decisionCaseId: string;
  readonly state: DecisionCaseState;
  readonly capability?: string;
  readonly artifactTypes?: DecisionPortfolioCase["artifactTypes"];
  readonly createdAt?: string;
  readonly metadata?: DecisionPortfolioCase["metadata"];
}): DecisionPortfolioCase {
  return {
    decisionCaseId: input.decisionCaseId,
    capability: input.capability ?? "operations",
    state: input.state,
    artifactTypes: input.artifactTypes ?? [],
    createdAt: input.createdAt ?? "2026-07-02T10:00:00.000Z",
    metadata: input.metadata ?? {},
  };
}

function assertPriority(
  items: ReadonlyArray<{ readonly decisionCaseId: string; readonly priority: string }>,
  decisionCaseId: string,
  priority: string,
): void {
  const item = items.find((candidate) => candidate.decisionCaseId === decisionCaseId);

  assertExists(item, `expected ${decisionCaseId} to exist`);
  assertEqual(item.priority, priority, "priority mismatch");
}

function assertIncludes<T>(
  values: ReadonlyArray<T>,
  expected: T,
  message: string,
): void {
  if (!values.includes(expected)) {
    throw new Error(message);
  }
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
