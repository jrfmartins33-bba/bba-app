import {
  DecisionCategory,
  DecisionImpact,
  DecisionPriority,
  DecisionStatus,
  type Decision,
} from "../../../domain/decision";
import { buildRecommendations } from "./recommendation-builder";

const supportedDecision: Decision = {
  id: "decision-1",
  tenantId: "tenant-1",
  organizationId: "organization-1",
  evidence: [
    {
      source: "capability",
      sourceReference: "cash-projection",
      description: "Projected cash evidence",
      metadata: {
        businessFactId: "fact-1",
        capability: "cash-intelligence",
      },
    },
  ],
  title: "Projected cash deficit",
  summary: "Projected cash position is negative.",
  status: DecisionStatus.Created,
  priority: DecisionPriority.High,
  category: DecisionCategory.Financial,
  impact: DecisionImpact.High,
  confidence: 95,
  owner: "",
  dueDate: null,
  expectedBenefit: {
    description: "",
    metadata: {},
  },
  createdAt: "2026-07-02T09:01:00.000Z",
  updatedAt: "2026-07-02T09:01:00.000Z",
  resolvedAt: null,
  metadata: {
    diagnosisId: "diagnosis-1",
    diagnosisType: "projected_cash_deficit",
  },
};

runTest("supported cash decision creates recommendation", () => {
  const recommendations = buildRecommendations([supportedDecision]);

  assertEqual(recommendations.length, 1, "expected one recommendation");
});

runTest("unsupported decision creates no recommendation", () => {
  const recommendations = buildRecommendations([
    {
      ...supportedDecision,
      metadata: {
        diagnosisId: "diagnosis-1",
        diagnosisType: "unsupported",
      },
    },
  ]);

  assertEqual(recommendations.length, 0, "expected no recommendations");
});

runTest("recommendation preserves decisionId", () => {
  const recommendation = buildRecommendations([supportedDecision])[0];

  assertExists(recommendation, "expected recommendation to exist");
  assertEqual(
    recommendation.decisionId,
    supportedDecision.id,
    "decisionId mismatch",
  );
  assertEqual(
    recommendation.traceability.decisionId,
    supportedDecision.id,
    "traceability decisionId mismatch",
  );
});

runTest("recommendation preserves diagnosisId when available", () => {
  const recommendation = buildRecommendations([supportedDecision])[0];

  assertExists(recommendation, "expected recommendation to exist");
  assertEqual(
    recommendation.traceability.diagnosisId,
    "diagnosis-1",
    "diagnosisId mismatch",
  );
});

runTest("recommendation includes multiple action options", () => {
  const recommendation = buildRecommendations([supportedDecision])[0];

  assertExists(recommendation, "expected recommendation to exist");
  assertEqual(recommendation.options.length, 4, "option count mismatch");
});

runTest("deterministic output", () => {
  const first = JSON.stringify(buildRecommendations([supportedDecision]));
  const second = JSON.stringify(buildRecommendations([supportedDecision]));

  assertEqual(first, second, "expected deterministic output");
});

runTest("recommendation preserves capability and businessFact ids", () => {
  const recommendation = buildRecommendations([supportedDecision])[0];

  assertExists(recommendation, "expected recommendation to exist");
  assertEqual(
    recommendation.traceability.capabilities[0],
    "cash-intelligence",
    "capability mismatch",
  );
  assertEqual(
    recommendation.traceability.businessFactIds[0],
    "fact-1",
    "businessFactId mismatch",
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
