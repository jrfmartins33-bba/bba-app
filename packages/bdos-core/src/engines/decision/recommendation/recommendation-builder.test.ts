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

// --- Release 2.7 / Sprint 15: geospatial-intelligence case -----------------
// `resolveRecommendationContent` (recommendation-builder.ts) recognizes a
// second Decision shape now, alongside cash-intelligence's — added as a new
// entry, never by touching the cash-intelligence branch above.

const supportedSpatialDecision: Decision = {
  id: "decision-2",
  tenantId: "tenant-1",
  organizationId: "organization-1",
  evidence: [
    {
      source: "spatial-object.confidence",
      sourceReference: "spatial-object:work-package:wp-frente-a",
      description: "Spatial confidence evaluated as Low.",
      metadata: {
        businessFactId: "fact-2",
        capability: "geospatial-intelligence",
      },
    },
  ],
  title: "Low spatial confidence",
  summary: "Spatial confidence for Frente A evaluated as Low.",
  status: DecisionStatus.Created,
  priority: DecisionPriority.Medium,
  category: DecisionCategory.Risk,
  impact: DecisionImpact.Medium,
  confidence: 0,
  owner: "",
  dueDate: null,
  expectedBenefit: {
    description: "",
    metadata: {},
  },
  createdAt: "2026-07-06T09:00:00.000Z",
  updatedAt: "2026-07-06T09:00:00.000Z",
  resolvedAt: null,
  metadata: {
    diagnosisId: "diagnosis-2",
    diagnosisType: "low_spatial_confidence",
  },
};

runTest("supported spatial decision creates recommendation", () => {
  const recommendations = buildRecommendations([supportedSpatialDecision]);

  assertEqual(recommendations.length, 1, "expected one recommendation");
});

runTest("spatial recommendation summary matches the requested regularization message", () => {
  const recommendation = buildRecommendations([supportedSpatialDecision])[0];

  assertExists(recommendation, "expected recommendation to exist");
  assertEqual(
    recommendation.summary,
    "Regularizar a base espacial da frente/trecho antes de avançar decisões dependentes de localização.",
    "summary mismatch",
  );
});

runTest("spatial recommendation includes multiple action options", () => {
  const recommendation = buildRecommendations([supportedSpatialDecision])[0];

  assertExists(recommendation, "expected recommendation to exist");
  assertEqual(recommendation.options.length, 4, "option count mismatch");
});

runTest("spatial recommendation preserves capability and businessFact ids", () => {
  const recommendation = buildRecommendations([supportedSpatialDecision])[0];

  assertExists(recommendation, "expected recommendation to exist");
  assertEqual(
    recommendation.traceability.capabilities[0],
    "geospatial-intelligence",
    "capability mismatch",
  );
  assertEqual(
    recommendation.traceability.businessFactIds[0],
    "fact-2",
    "businessFactId mismatch",
  );
});

runTest("cash-intelligence's recommendation id format is unchanged by the generalization", () => {
  const recommendation = buildRecommendations([supportedDecision])[0];

  assertExists(recommendation, "expected recommendation to exist");
  assertEqual(
    recommendation.id,
    `recommendation:${supportedDecision.id}:cash-protection`,
    "expected the exact original id format to survive the refactor",
  );
});

runTest("a mixed batch produces one correctly-attributed recommendation per Decision", () => {
  const recommendations = buildRecommendations([supportedDecision, supportedSpatialDecision]);

  assertEqual(recommendations.length, 2, "expected one recommendation per supported decision");

  const cashRecommendation = recommendations.find((r) => r.decisionId === supportedDecision.id);
  const spatialRecommendation = recommendations.find((r) => r.decisionId === supportedSpatialDecision.id);

  assertExists(cashRecommendation, "expected a cash recommendation");
  assertExists(spatialRecommendation, "expected a spatial recommendation");
  assertEqual(
    cashRecommendation.metadata.recommendationType,
    "cash_protection",
    "expected the cash recommendation to keep its own type",
  );
  assertEqual(
    spatialRecommendation.metadata.recommendationType,
    "spatial_confidence_regularization",
    "expected the spatial recommendation to have its own, distinct type",
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
