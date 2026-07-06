import { DecisionCategory, DecisionPriority } from "../../domain/decision";
import { spatialObjectFactsAdapter } from "../../domain/business-facts-generator/adapters/spatial-object";
import { buildDecisions } from "../../engines/decision/builder";
import { executeRulePack, type RulePack } from "../../engines/decision/rule-engine";
import { lowSpatialConfidenceRule } from "./rules/low-spatial-confidence-rule";
import {
  fixtureCapability,
  fixtureCorrelationId,
  fixtureGeneratedAt,
  fixtureOrganizationId,
  fixtureTenantId,
  highConfidenceGateSpatialObjectFixture,
  lowConfidenceFoundationSpatialObjectFixture,
} from "./geospatial-intelligence.fixtures";

/**
 * End-to-end integration proof (Release 2.2 / Sprint 11 — see Roadmap
 * Estratégico in `packages/bdos-core/docs/GEOSPATIAL_ENGINE.md`).
 *
 * This is, as far as this codebase goes, the first test anywhere that
 * proves a Capability's Rule actually survives contact with the real
 * Decision Engine machinery (`executeRulePack`, `buildDecisions`) fed
 * by a real `business-facts-generator` adapter — `cash-intelligence`'s
 * own `projectedCashDeficitRule` has never been exercised this way
 * either. Nothing here is mocked: two real `SpatialObject`s
 * (`geospatial-intelligence.fixtures.ts`) flow through the exact same
 * functions production code would call.
 */
const geospatialRulePack: RulePack = {
  id: "geospatial-intelligence-rule-pack",
  name: "Geospatial Intelligence",
  version: "1.0.0",
  capability: fixtureCapability,
  rules: [lowSpatialConfidenceRule],
  metadata: {},
};

runTest("SpatialObject -> BusinessFact: one fact per object, values mirror Spatial Confidence", () => {
  const spatialObjects = [lowConfidenceFoundationSpatialObjectFixture(), highConfidenceGateSpatialObjectFixture()];

  const factsResult = spatialObjectFactsAdapter.generateFacts({
    source: spatialObjectFactsAdapter.supportedSource,
    generatedAt: fixtureGeneratedAt,
    correlationId: fixtureCorrelationId,
    tenantId: fixtureTenantId,
    organizationId: fixtureOrganizationId,
    capability: fixtureCapability,
    spatialObjects,
    metadata: {},
  });

  assertEqual(factsResult.success, true, "expected fact generation success");
  assertEqual(factsResult.facts.length, 2, "expected exactly two facts, one per spatial object");

  const foundationFact = factsResult.facts.find(
    (fact) => fact.sourceReference === "spatial-fundacao-bloco-a",
  );
  const gateFact = factsResult.facts.find((fact) => fact.sourceReference === "spatial-comporta-principal");

  assertEqual(foundationFact?.metadata.spatialConfidenceLevel, "Low", "expected foundation to score Low");
  assertEqual(gateFact?.metadata.spatialConfidenceLevel, "Verified", "expected gate to score Verified");
  assertEqual(gateFact?.value, 100, "expected gate fact value to be the maximum score");
});

runTest("BusinessFact -> Diagnosis: only the Low confidence object triggers the rule, via the real Rule Engine", () => {
  const spatialObjects = [lowConfidenceFoundationSpatialObjectFixture(), highConfidenceGateSpatialObjectFixture()];

  const factsResult = spatialObjectFactsAdapter.generateFacts({
    source: spatialObjectFactsAdapter.supportedSource,
    generatedAt: fixtureGeneratedAt,
    correlationId: fixtureCorrelationId,
    tenantId: fixtureTenantId,
    organizationId: fixtureOrganizationId,
    capability: fixtureCapability,
    spatialObjects,
    metadata: {},
  });
  assertEqual(factsResult.success, true, "expected fact generation success");

  const diagnoses = executeRulePack(geospatialRulePack, factsResult.facts);

  assertEqual(diagnoses.length, 1, "expected exactly one diagnosis (the low-confidence object)");
  assertEqual(diagnoses[0]?.type, "low_spatial_confidence", "diagnosis type mismatch");
  assertEqual(diagnoses[0]?.category, "risk", "diagnosis category mismatch");
  assertEqual(
    diagnoses[0]?.facts[0]?.sourceReference,
    "spatial-fundacao-bloco-a",
    "expected the diagnosis to trace back to the foundation spatial object",
  );
});

runTest("Diagnosis -> Decision: the full chain reaches a real Decision with unbroken traceability", () => {
  const spatialObjects = [lowConfidenceFoundationSpatialObjectFixture(), highConfidenceGateSpatialObjectFixture()];

  const factsResult = spatialObjectFactsAdapter.generateFacts({
    source: spatialObjectFactsAdapter.supportedSource,
    generatedAt: fixtureGeneratedAt,
    correlationId: fixtureCorrelationId,
    tenantId: fixtureTenantId,
    organizationId: fixtureOrganizationId,
    capability: fixtureCapability,
    spatialObjects,
    metadata: {},
  });
  assertEqual(factsResult.success, true, "expected fact generation success");

  const diagnoses = executeRulePack(geospatialRulePack, factsResult.facts);
  const decisions = buildDecisions(diagnoses);

  assertEqual(decisions.length, 1, "expected exactly one Decision to reach the end of the chain");

  const decision = decisions[0];
  assertEqual(decision?.category, DecisionCategory.Risk, "expected Decision category Risk");
  assertEqual(decision?.priority, DecisionPriority.Medium, "expected Decision priority Medium");
  assertEqual(decision?.tenantId, fixtureTenantId, "expected tenantId to survive the whole chain");
  assertEqual(decision?.organizationId, fixtureOrganizationId, "expected organizationId to survive the whole chain");

  // PRINCIPLE 001 (Full Traceability) proven concretely: the Decision
  // traces all the way back to the originating SpatialObject id,
  // through Diagnosis metadata and DecisionEvidence, not just by
  // convention but by an actual assertion.
  assertEqual(
    decision?.metadata.diagnosisType,
    "low_spatial_confidence",
    "expected Decision metadata to carry the diagnosis type",
  );
  assertEqual(decision?.evidence.length, 1, "expected exactly one piece of evidence on the Decision");
  assertEqual(
    decision?.evidence[0]?.source,
    "spatial-object.confidence",
    "expected Decision evidence source to trace back to the spatial-object adapter",
  );
  assertEqual(
    (decision?.evidence[0]?.metadata.metadata as Record<string, unknown> | undefined)?.spatialObjectId,
    "spatial-fundacao-bloco-a",
    "expected Decision evidence metadata to trace back to the originating spatial object id",
  );
});

runTest("a fully high-confidence set of spatial objects produces zero diagnoses and zero decisions", () => {
  const spatialObjects = [highConfidenceGateSpatialObjectFixture()];

  const factsResult = spatialObjectFactsAdapter.generateFacts({
    source: spatialObjectFactsAdapter.supportedSource,
    generatedAt: fixtureGeneratedAt,
    correlationId: fixtureCorrelationId,
    tenantId: fixtureTenantId,
    organizationId: fixtureOrganizationId,
    capability: fixtureCapability,
    spatialObjects,
    metadata: {},
  });
  assertEqual(factsResult.success, true, "expected fact generation success");

  const diagnoses = executeRulePack(geospatialRulePack, factsResult.facts);
  const decisions = buildDecisions(diagnoses);

  assertEqual(diagnoses.length, 0, "expected zero diagnoses when every spatial object is high confidence");
  assertEqual(decisions.length, 0, "expected zero decisions when every spatial object is high confidence");
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
