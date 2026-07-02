import type { BusinessFact } from "../../../domain/business-fact";
import {
  DecisionCategory,
  DecisionPriority,
  DecisionStatus,
} from "../../../domain/decision";
import type { Diagnosis } from "../pipeline/diagnose";
import { buildDecisions } from "./decision-builder";

const baseFact: BusinessFact = {
  id: "fact-1",
  tenantId: "tenant-1",
  organizationId: "organization-1",
  capability: "cash-intelligence",
  source: "capability",
  sourceReference: "cash-projection",
  category: "financial",
  type: "projected_cash",
  label: "Projected cash",
  description: "Projected cash position",
  value: -100,
  unit: "currency",
  confidence: 95,
  observedAt: "2026-07-02T09:00:00.000Z",
  metadata: {},
  createdAt: "2026-07-02T09:00:00.000Z",
};

const baseDiagnosis: Diagnosis = {
  id: "diagnosis-1",
  category: "financial",
  type: "projected_cash_deficit",
  title: "Projected cash deficit",
  description: "Projected cash position is negative.",
  severity: "high",
  confidence: 95,
  facts: [baseFact],
  metadata: {},
  createdAt: "2026-07-02T09:01:00.000Z",
};

runTest("diagnosis with facts creates a Decision", () => {
  const decisions = buildDecisions([baseDiagnosis]);
  const decision = decisions[0];

  assertEqual(decisions.length, 1, "expected one decision");
  assertExists(decision, "expected decision to exist");
  assertEqual(decision.status, DecisionStatus.Created, "status mismatch");
  assertEqual(decision.priority, DecisionPriority.High, "priority mismatch");
  assertEqual(decision.category, DecisionCategory.Financial, "category mismatch");
  assertEqual(decision.evidence.length, 1, "evidence mismatch");
});

runTest("diagnosis without facts creates no Decision", () => {
  const decisions = buildDecisions([
    {
      ...baseDiagnosis,
      facts: [],
    },
  ]);

  assertEqual(decisions.length, 0, "expected no decisions");
});

runTest("unsupported category creates no Decision", () => {
  const decisions = buildDecisions([
    {
      ...baseDiagnosis,
      category: "unsupported",
    },
  ]);

  assertEqual(decisions.length, 0, "expected no decisions");
});

runTest(
  "tenantId and organizationId are copied from the first fact and never defaulted",
  () => {
    const decisions = buildDecisions([baseDiagnosis]);
    const decision = decisions[0];

    assertExists(decision, "expected decision to exist");
    assertEqual(decision.tenantId, baseFact.tenantId, "tenantId mismatch");
    assertEqual(
      decision.organizationId,
      baseFact.organizationId,
      "organizationId mismatch",
    );
  },
);

runTest("empty tenantId or organizationId creates no Decision", () => {
  const decisions = buildDecisions([
    {
      ...baseDiagnosis,
      facts: [
        {
          ...baseFact,
          tenantId: "",
          organizationId: "",
        },
      ],
    },
  ]);

  assertEqual(decisions.length, 0, "expected no decisions");
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
