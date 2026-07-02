import { DecisionCaseState } from "../decision-case";
import type { PrioritizedPortfolio } from "../decision-portfolio";
import { createExecutiveInsight } from "./index";

const prioritizedPortfolio: PrioritizedPortfolio = {
  portfolioId: "decision-portfolio-1",
  generatedAt: "2026-07-02T12:00:00.000Z",
  items: [
    {
      decisionCaseId: "decision-case-critical",
      rank: 1,
      score: 95,
      priority: "critical",
      reasons: ["state:monitoring:80", "severity:critical:+10"],
      state: DecisionCaseState.Monitoring,
      capability: "cash-intelligence",
      artifactTypes: ["decision", "action-plan"],
      metadata: {
        title: "Protect short-term cash",
        severity: "critical",
      },
    },
    {
      decisionCaseId: "decision-case-high",
      rank: 2,
      score: 75,
      priority: "high",
      reasons: ["state:action_plan_ready:70"],
      state: DecisionCaseState.ActionPlanReady,
      capability: "operations",
      artifactTypes: ["decision", "recommendation"],
      metadata: {
        title: "Resolve operating bottleneck",
        opportunity: "Improve operating throughput",
      },
    },
    {
      decisionCaseId: "decision-case-medium",
      rank: 3,
      score: 45,
      priority: "medium",
      reasons: ["state:decision_built:40"],
      state: DecisionCaseState.DecisionBuilt,
      capability: "people-intelligence",
      artifactTypes: ["decision"],
      metadata: {},
    },
    {
      decisionCaseId: "decision-case-completed",
      rank: 4,
      score: 0,
      priority: "low",
      reasons: ["state:completed:0"],
      state: DecisionCaseState.Completed,
      capability: "tax-intelligence",
      artifactTypes: ["decision"],
      metadata: {},
    },
  ],
  summary: {
    totalItems: 4,
    criticalCount: 1,
    highCount: 1,
    mediumCount: 1,
    lowCount: 1,
    topDecisionCaseId: "decision-case-critical",
  },
  metadata: {
    owner: "executive",
  },
};

runTest("creates insight", () => {
  const insight = createExecutiveInsight({
    prioritizedPortfolio,
    id: "executive-insight-1",
    generatedAt: "2026-07-02T13:00:00.000Z",
  });

  assertEqual(insight.id, "executive-insight-1", "id mismatch");
  assertEqual(
    insight.portfolioId,
    prioritizedPortfolio.portfolioId,
    "portfolioId mismatch",
  );
  assertEqual(
    insight.generatedAt,
    "2026-07-02T13:00:00.000Z",
    "generatedAt mismatch",
  );
  assertEqual(insight.metadata["owner"], "executive", "metadata mismatch");
});

runTest("deterministic output", () => {
  const first = JSON.stringify(
    createExecutiveInsight({
      prioritizedPortfolio,
      id: "executive-insight-1",
      generatedAt: "2026-07-02T13:00:00.000Z",
    }),
  );
  const second = JSON.stringify(
    createExecutiveInsight({
      prioritizedPortfolio,
      id: "executive-insight-1",
      generatedAt: "2026-07-02T13:00:00.000Z",
    }),
  );

  assertEqual(first, second, "expected deterministic output");
});

runTest("top risks from critical/high items", () => {
  const insight = createExecutiveInsight({
    prioritizedPortfolio,
    id: "executive-insight-1",
    generatedAt: "2026-07-02T13:00:00.000Z",
  });

  assertEqual(insight.topRisks.length, 2, "top risk count mismatch");
  assertEqual(
    insight.topRisks[0]?.supportingDecisionCases[0],
    "decision-case-critical",
    "critical risk mismatch",
  );
  assertEqual(
    insight.topRisks[1]?.supportingDecisionCases[0],
    "decision-case-high",
    "high risk mismatch",
  );
});

runTest("attention points from medium items", () => {
  const insight = createExecutiveInsight({
    prioritizedPortfolio,
    id: "executive-insight-1",
    generatedAt: "2026-07-02T13:00:00.000Z",
  });

  assertEqual(insight.attentionPoints.length, 1, "attention point count mismatch");
  assertEqual(
    insight.attentionPoints[0]?.supportingDecisionCases[0],
    "decision-case-medium",
    "attention decision case mismatch",
  );
});

runTest("positive signals from completed/archived low-score items", () => {
  const insight = createExecutiveInsight({
    prioritizedPortfolio,
    id: "executive-insight-1",
    generatedAt: "2026-07-02T13:00:00.000Z",
  });

  assertEqual(insight.positiveSignals.length, 1, "positive signal count mismatch");
  assertEqual(
    insight.positiveSignals[0]?.supportingDecisionCases[0],
    "decision-case-completed",
    "positive signal decision case mismatch",
  );
});

runTest("top opportunities from opportunity metadata", () => {
  const insight = createExecutiveInsight({
    prioritizedPortfolio,
    id: "executive-insight-1",
    generatedAt: "2026-07-02T13:00:00.000Z",
  });

  assertEqual(insight.topOpportunities.length, 1, "opportunity count mismatch");
  assertEqual(
    insight.topOpportunities[0]?.title,
    "Improve operating throughput",
    "opportunity title mismatch",
  );
});

runTest("empty portfolio", () => {
  const insight = createExecutiveInsight({
    prioritizedPortfolio: {
      portfolioId: "decision-portfolio-empty",
      generatedAt: "2026-07-02T12:00:00.000Z",
      items: [],
      summary: {
        totalItems: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        topDecisionCaseId: null,
      },
      metadata: {},
    },
    id: "executive-insight-empty",
    generatedAt: "2026-07-02T13:00:00.000Z",
  });

  assertEqual(insight.topRisks.length, 0, "top risks mismatch");
  assertEqual(insight.topOpportunities.length, 0, "opportunities mismatch");
  assertEqual(insight.attentionPoints.length, 0, "attention points mismatch");
  assertEqual(insight.positiveSignals.length, 0, "positive signals mismatch");
  assertEqual(insight.negativeSignals.length, 0, "negative signals mismatch");
  assertEqual(insight.evidence.length, 0, "evidence mismatch");
  assertEqual(insight.confidence, 0, "confidence mismatch");
});

runTest("confidence calculation", () => {
  const insight = createExecutiveInsight({
    prioritizedPortfolio,
    id: "executive-insight-1",
    generatedAt: "2026-07-02T13:00:00.000Z",
  });

  assertEqual(insight.confidence, 100, "confidence mismatch");
});

runTest("evidence preservation", () => {
  const insight = createExecutiveInsight({
    prioritizedPortfolio,
    id: "executive-insight-1",
    generatedAt: "2026-07-02T13:00:00.000Z",
  });

  assertEqual(insight.evidence.length, 7, "evidence count mismatch");
  assertArrayIncludes(
    insight.evidence[0]?.supportingDecisionCases ?? [],
    "decision-case-critical",
    "evidence decision case mismatch",
  );
  assertArrayIncludes(
    insight.evidence[0]?.supportingArtifacts ?? [],
    "action-plan",
    "evidence artifact mismatch",
  );
});

function assertArrayIncludes<T>(
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
