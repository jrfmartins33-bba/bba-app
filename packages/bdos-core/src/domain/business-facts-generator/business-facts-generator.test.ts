import type { BusinessFact } from "../business-fact";
import {
  createBusinessFactsGenerationResult,
  generateBusinessFacts,
} from "./index";

const fact: BusinessFact = {
  id: "fact-1",
  tenantId: "tenant-1",
  organizationId: "organization-1",
  capability: "cash-intelligence",
  source: "alpha-engenharia.invoice",
  sourceReference: "invoice-1",
  category: "revenue",
  type: "invoice_issued",
  label: "Invoice issued",
  description: "Invoice issued.",
  value: 1000,
  unit: "currency",
  confidence: 100,
  observedAt: "2026-04-01",
  metadata: {
    correlationId: "correlation-1",
  },
  createdAt: "2026-04-02T10:00:00.000Z",
};

runTest("creates generation result", () => {
  const result = createBusinessFactsGenerationResult({
    facts: [fact],
    metadata: {
      correlationId: "correlation-1",
    },
  });

  assertEqual(result.success, true, "success mismatch");
  assertEqual(result.facts.length, 1, "facts length mismatch");
  assertEqual(result.errors.length, 0, "errors length mismatch");
});

runTest("preserves metadata", () => {
  const result = createBusinessFactsGenerationResult({
    facts: [fact],
    metadata: {
      correlationId: "correlation-1",
      source: "test",
    },
  });

  assertEqual(
    result.metadata["correlationId"],
    "correlation-1",
    "correlationId mismatch",
  );
  assertEqual(result.metadata["source"], "test", "source metadata mismatch");
});

runTest("deterministic output", () => {
  const first = JSON.stringify(
    createBusinessFactsGenerationResult({
      facts: [fact],
      metadata: {
        correlationId: "correlation-1",
      },
    }),
  );
  const second = JSON.stringify(
    createBusinessFactsGenerationResult({
      facts: [fact],
      metadata: {
        correlationId: "correlation-1",
      },
    }),
  );

  assertEqual(first, second, "expected deterministic output");
});

runTest("supports empty facts", () => {
  const result = createBusinessFactsGenerationResult({
    facts: [],
    metadata: {
      correlationId: "correlation-empty",
    },
  });

  assertEqual(result.success, true, "success mismatch");
  assertEqual(result.facts.length, 0, "facts length mismatch");
});

runTest("supports structured errors", () => {
  const result = createBusinessFactsGenerationResult({
    errors: [
      {
        code: "missing_required_data",
        message: "Required data is missing.",
        sourceId: "source-1",
        metadata: {
          field: "tenantId",
        },
      },
    ],
    metadata: {
      correlationId: "correlation-error",
    },
  });

  assertEqual(result.success, false, "success mismatch");
  assertEqual(result.errors.length, 1, "errors length mismatch");
  assertEqual(result.errors[0]?.code, "missing_required_data", "code mismatch");
});

runTest("returns structured error for unsupported adapter source", () => {
  const result = generateBusinessFacts(
    {
      adapterId: "test-adapter",
      supportedSource: "supported-source",
      generateFacts: () =>
        createBusinessFactsGenerationResult({
          facts: [fact],
        }),
    },
    {
      source: "unsupported-source",
      generatedAt: "2026-04-02T10:00:00.000Z",
      correlationId: "correlation-source",
      metadata: {},
    },
  );

  assertEqual(result.success, false, "success mismatch");
  assertEqual(result.errors[0]?.code, "unsupported_source", "code mismatch");
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
