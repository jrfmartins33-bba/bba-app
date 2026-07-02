import type { Recommendation } from "../recommendation";
import { buildPlaybooks } from "./playbook-builder";

const supportedRecommendation: Recommendation = {
  id: "recommendation:decision-1:cash-protection",
  decisionId: "decision-1",
  title: "Cash protection recommendation",
  summary: "Recommended action options to respond to a projected cash deficit.",
  options: [
    {
      id: "recommendation:decision-1:cash-protection:option:reduce_discretionary_spending",
      type: "reduce_discretionary_spending",
      title: "Reduce discretionary spending",
      description: "Review and reduce discretionary spending.",
    },
  ],
  traceability: {
    decisionId: "decision-1",
    diagnosisId: "diagnosis-1",
    capabilities: ["cash-intelligence"],
    evidenceReferences: ["cash-projection"],
    businessFactIds: ["fact-1"],
  },
  metadata: {
    recommendationType: "cash_protection",
  },
  createdAt: "2026-07-02T09:01:00.000Z",
};

runTest("supported recommendation creates playbook", () => {
  const playbooks = buildPlaybooks([supportedRecommendation]);

  assertEqual(playbooks.length, 1, "expected one playbook");
  assertEqual(playbooks[0]?.name, "Cash Protection Playbook", "name mismatch");
});

runTest("unsupported recommendation creates no playbook", () => {
  const playbooks = buildPlaybooks([
    {
      ...supportedRecommendation,
      metadata: {
        recommendationType: "unsupported",
      },
    },
  ]);

  assertEqual(playbooks.length, 0, "expected no playbooks");
});

runTest("deterministic output", () => {
  const first = JSON.stringify(buildPlaybooks([supportedRecommendation]));
  const second = JSON.stringify(buildPlaybooks([supportedRecommendation]));

  assertEqual(first, second, "expected deterministic output");
});

runTest("traceability preservation", () => {
  const playbook = buildPlaybooks([supportedRecommendation])[0];

  assertExists(playbook, "expected playbook to exist");
  assertEqual(
    playbook.recommendationId,
    supportedRecommendation.id,
    "recommendationId mismatch",
  );
  assertEqual(playbook.metadata["decisionId"], "decision-1", "decisionId mismatch");
  assertEqual(
    playbook.metadata["diagnosisId"],
    "diagnosis-1",
    "diagnosisId mismatch",
  );
  assertEqual(
    playbook.metadata["capability"],
    "cash-intelligence",
    "capability mismatch",
  );
});

runTest("playbook completeness", () => {
  const playbook = buildPlaybooks([supportedRecommendation])[0];

  assertExists(playbook, "expected playbook to exist");
  assertEqual(playbook.steps.length, 5, "steps count mismatch");
  assertEqual(playbook.kpis.length, 6, "kpis count mismatch");
  assertEqual(playbook.risks.length, 4, "risks count mismatch");
  assertEqual(
    playbook.successCriteria.length,
    5,
    "success criteria count mismatch",
  );
  assertIncludes(
    playbook.steps.map((step) => step.title),
    "Monitor daily cash position",
    "expected daily cash monitoring step",
  );
  assertIncludes(
    playbook.kpis,
    "Projected Cash",
    "expected projected cash KPI",
  );
  assertIncludes(
    playbook.successCriteria,
    "Minimum cash reserve maintained",
    "expected minimum cash reserve criterion",
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

function assertIncludes<T>(
  values: ReadonlyArray<T>,
  expected: T,
  message: string,
): void {
  if (!values.includes(expected)) {
    throw new Error(message);
  }
}
