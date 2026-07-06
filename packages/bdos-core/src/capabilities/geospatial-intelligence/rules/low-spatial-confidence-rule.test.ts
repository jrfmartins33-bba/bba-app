import type { BusinessFact } from "../../../domain/business-fact";
import { lowSpatialConfidenceRule } from "./low-spatial-confidence-rule";

const generatedAt = "2026-07-06T09:00:00Z";
const tenantId = "tenant-2f-engenharia";
const organizationId = "org-2f-engenharia";
const capability = "geospatial-intelligence";

runTest("produces no diagnosis when there are no spatial confidence facts", () => {
  const diagnoses = lowSpatialConfidenceRule([buildUnrelatedFact()]);
  assertEqual(diagnoses.length, 0, "expected zero diagnoses for unrelated facts");
});

runTest("produces no diagnosis for Medium, High, or Verified confidence", () => {
  const diagnoses = lowSpatialConfidenceRule([
    buildSpatialConfidenceFact({ spatialObjectId: "spatial-medium", level: "Medium", score: 40 }),
    buildSpatialConfidenceFact({ spatialObjectId: "spatial-high", level: "High", score: 70 }),
    buildSpatialConfidenceFact({ spatialObjectId: "spatial-verified", level: "Verified", score: 100 }),
  ]);

  assertEqual(diagnoses.length, 0, "expected zero diagnoses for non-Low confidence facts");
});

runTest("produces exactly one diagnosis per Low confidence spatial fact", () => {
  const diagnoses = lowSpatialConfidenceRule([
    buildSpatialConfidenceFact({ spatialObjectId: "spatial-low-a", level: "Low", score: 0 }),
    buildSpatialConfidenceFact({ spatialObjectId: "spatial-low-b", level: "Low", score: 15 }),
    buildSpatialConfidenceFact({ spatialObjectId: "spatial-high", level: "High", score: 70 }),
  ]);

  assertEqual(diagnoses.length, 2, "expected one diagnosis per Low confidence fact");
  assertEqual(diagnoses[0]?.category, "risk", "diagnosis category mismatch");
  assertEqual(diagnoses[0]?.type, "low_spatial_confidence", "diagnosis type mismatch");
  assertEqual(diagnoses[0]?.severity, "medium", "diagnosis severity mismatch");
  assertEqual(diagnoses[0]?.confidence, 0, "diagnosis confidence should mirror the fact's score");
  assertEqual(diagnoses[0]?.facts.length, 1, "expected the diagnosis to reference exactly its own fact");
  assertEqual(
    diagnoses[0]?.metadata.spatialObjectId,
    "spatial-low-a",
    "expected diagnosis metadata to carry the spatial object id",
  );
});

runTest("diagnosis id is deterministic and derived from the fact id", () => {
  const fact = buildSpatialConfidenceFact({ spatialObjectId: "spatial-low-c", level: "Low", score: 10 });
  const diagnoses = lowSpatialConfidenceRule([fact]);

  assertEqual(
    diagnoses[0]?.id,
    `geospatial-intelligence:low-spatial-confidence:${fact.id}`,
    "expected deterministic diagnosis id derived from the fact id",
  );
});

function buildSpatialConfidenceFact(input: {
  readonly spatialObjectId: string;
  readonly level: string;
  readonly score: number;
}): BusinessFact {
  return {
    id: `correlation-001:spatial-confidence-evaluated:${input.spatialObjectId}`,
    tenantId,
    organizationId,
    capability,
    source: "spatial-object.confidence",
    sourceReference: input.spatialObjectId,
    category: "operational",
    type: "spatial_confidence_evaluated",
    label: "Spatial confidence evaluated",
    description: `Spatial confidence for "${input.spatialObjectId}" evaluated as ${input.level}.`,
    value: input.score,
    unit: "percentage",
    confidence: 100,
    observedAt: generatedAt,
    metadata: {
      spatialObjectId: input.spatialObjectId,
      spatialObjectKind: "Point",
      spatialConfidenceLevel: input.level,
      spatialConfidenceScore: input.score,
      spatialConfidenceWarningCodes: [],
    },
    createdAt: generatedAt,
  };
}

function buildUnrelatedFact(): BusinessFact {
  return {
    id: "correlation-001:unrelated-fact",
    tenantId,
    organizationId,
    capability,
    source: "event",
    sourceReference: "unrelated",
    category: "operational",
    type: "some_other_fact_type",
    label: "Unrelated fact",
    description: "A fact unrelated to spatial confidence.",
    value: 1,
    unit: "count",
    confidence: 100,
    observedAt: generatedAt,
    metadata: {},
    createdAt: generatedAt,
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
