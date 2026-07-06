import { DecisionCategory, DecisionPriority } from "../../domain/decision";
import { createWorkPackage, WorkPackageType, type WorkPackage } from "../../domain/work-package-management";
import {
  addSpatialGeometryVersion,
  attachSpatialLayer,
  generateSpatialObjectsFromWorkPackages,
  SpatialGeometrySource,
  SpatialLayerType,
  type SpatialObject,
} from "../../domain/spatial-object";
import { spatialObjectFactsAdapter } from "../../domain/business-facts-generator/adapters/spatial-object";
import { buildDecisions } from "../../engines/decision/builder";
import { executeRulePack, type RulePack } from "../../engines/decision/rule-engine";
import { lowSpatialConfidenceRule } from "./rules/low-spatial-confidence-rule";

/**
 * The full-stack integration proof (Release 2.4 / Sprint 13 — see
 * Roadmap Estratégico in `packages/bdos-core/docs/GEOSPATIAL_ENGINE.md`).
 *
 * Sprint 11 proved `SpatialObject -> BusinessFact -> Diagnosis ->
 * Decision` with hand-built `SpatialObject` fixtures. Sprint 12 proved
 * `WorkPackage -> SpatialObject` in isolation. Neither proved the two
 * ends chained together with real `WorkPackage`s. This file does: real
 * `WorkPackage`s (`createWorkPackage`, the actual Planning aggregate),
 * through the actual `generateSpatialObjectsFromWorkPackages` adapter,
 * through the actual `spatialObjectFactsAdapter`, through the actual
 * `executeRulePack`, to an actual `Decision` — six real functions in
 * series, nothing hand-waved in the middle.
 */
const tenantId = "tenant-2f-engenharia";
const organizationId = "org-lagoa-do-arroz";
const capability = "geospatial-intelligence";
const correlationId = "geospatial-wp-integration-lagoa-do-arroz-001";
const generatedAt = "2026-07-06T09:00:00Z";
const actor = "planning-engineer-marcos";
const occurredAt = "2026-07-05T09:00:00Z";
const laterOccurredAt = "2026-07-05T15:00:00Z";

const geospatialRulePack: RulePack = {
  id: "geospatial-intelligence-rule-pack",
  name: "Geospatial Intelligence",
  version: "1.0.0",
  capability,
  rules: [lowSpatialConfidenceRule],
  metadata: {},
};

runTest(
  "fresh from Planning: work packages with no geometry yet all trigger Low spatial confidence, end to end",
  () => {
    const { frente, trecho1 } = buildFrenteETrechoWorkPackages();

    const wpResult = generateSpatialObjectsFromWorkPackages({
      workPackages: [frente, trecho1],
      actor,
      occurredAt,
    });
    assertEqual(wpResult.success, true, "expected WorkPackage -> SpatialObject success");
    assertEqual(wpResult.spatialObjects.length, 2, "expected two spatial objects");

    const factsResult = spatialObjectFactsAdapter.generateFacts({
      source: spatialObjectFactsAdapter.supportedSource,
      generatedAt,
      correlationId,
      tenantId,
      organizationId,
      capability,
      spatialObjects: wpResult.spatialObjects,
      metadata: {},
    });
    assertEqual(factsResult.success, true, "expected fact generation success");
    assertEqual(factsResult.facts.length, 2, "expected two facts, one per spatial object");
    assertEqual(
      factsResult.facts.every((fact) => fact.metadata.spatialConfidenceLevel === "Low"),
      true,
      "expected every fresh-from-planning fact to score Low",
    );

    const diagnoses = executeRulePack(geospatialRulePack, factsResult.facts);
    assertEqual(diagnoses.length, 2, "expected one diagnosis per spatial object");

    const decisions = buildDecisions(diagnoses);
    assertEqual(decisions.length, 2, "expected one Decision per spatial object");
    assertEqual(
      decisions.every((decision) => decision.category === DecisionCategory.Risk),
      true,
      "expected every Decision to carry category Risk",
    );

    const frenteSpatialObjectId = spatialObjectIdFor(frente);
    const trecho1SpatialObjectId = spatialObjectIdFor(trecho1);
    const tracedSourceReferences = decisions.map((decision) => decision.evidence[0]?.sourceReference).sort();
    assertEqual(
      tracedSourceReferences.join(","),
      [frenteSpatialObjectId, trecho1SpatialObjectId].sort().join(","),
      "expected both Decisions to trace back to their originating WorkPackage-derived spatial object ids",
    );
  },
);

runTest(
  "as real-world data arrives for one spatial object, its risk resolves — the other, untouched, still triggers",
  () => {
    const { frente, trecho1 } = buildFrenteETrechoWorkPackages();

    const wpResult = generateSpatialObjectsFromWorkPackages({
      workPackages: [frente, trecho1],
      actor,
      occurredAt,
    });
    assertEqual(wpResult.success, true, "expected WorkPackage -> SpatialObject success");

    const frenteSpatialObject = findSpatialObject(wpResult.spatialObjects, frente);
    const trecho1SpatialObject = findSpatialObject(wpResult.spatialObjects, trecho1);
    assertDefined(frenteSpatialObject, "expected to find Frente A's spatial object");
    assertDefined(trecho1SpatialObject, "expected to find Trecho 1's spatial object");

    // Simulate the natural evolution: a topography crew declares an
    // approximate position first, RTK later refines it, Execution
    // confirms the work was actually performed, and Evidence attaches
    // a geolocated photo — Trecho 1 accumulates real-world layers.
    // Frente A is left exactly as Planning conceived it.
    const enrichedTrecho1 = enrichWithRealWorldData(trecho1SpatialObject);

    const factsResult = spatialObjectFactsAdapter.generateFacts({
      source: spatialObjectFactsAdapter.supportedSource,
      generatedAt,
      correlationId,
      tenantId,
      organizationId,
      capability,
      spatialObjects: [frenteSpatialObject, enrichedTrecho1],
      metadata: {},
    });
    assertEqual(factsResult.success, true, "expected fact generation success");

    const frenteFact = factsResult.facts.find(
      (fact) => fact.sourceReference === spatialObjectIdFor(frente),
    );
    const trecho1Fact = factsResult.facts.find(
      (fact) => fact.sourceReference === spatialObjectIdFor(trecho1),
    );
    assertEqual(frenteFact?.metadata.spatialConfidenceLevel, "Low", "expected Frente A to remain Low");
    assertEqual(trecho1Fact?.metadata.spatialConfidenceLevel, "Verified", "expected Trecho 1 to reach Verified");
    assertEqual(trecho1Fact?.value, 100, "expected Trecho 1 to reach the maximum score");

    const diagnoses = executeRulePack(geospatialRulePack, factsResult.facts);
    assertEqual(diagnoses.length, 1, "expected exactly one diagnosis — Frente A only");

    const decisions = buildDecisions(diagnoses);
    assertEqual(decisions.length, 1, "expected exactly one Decision — the risk resolved for Trecho 1");
    assertEqual(
      decisions[0]?.evidence[0]?.sourceReference,
      spatialObjectIdFor(frente),
      "expected the sole remaining Decision to trace back to Frente A, not Trecho 1",
    );
  },
);

function buildFrenteETrechoWorkPackages(): { readonly frente: WorkPackage; readonly trecho1: WorkPackage } {
  const frenteResult = createWorkPackage({
    id: "wp-frente-a",
    organizationId,
    contractId: "contract-lagoa-do-arroz",
    projectId: "project-lagoa-do-arroz",
    code: "FR-A",
    name: "Frente A — Fundação da Comporta",
    description: "Frente de execução da fundação da comporta principal.",
    type: WorkPackageType.ExecutionFront,
    sequence: 1,
    correlationId,
    createdBy: "planning-app",
    sourceSystem: "planning-app",
  });
  if (!frenteResult.success) {
    throw new Error(`expected Frente A fixture success: ${JSON.stringify(frenteResult.errors)}`);
  }

  const trecho1Result = createWorkPackage({
    id: "wp-trecho-1",
    organizationId,
    contractId: "contract-lagoa-do-arroz",
    projectId: "project-lagoa-do-arroz",
    code: "FR-A.1",
    name: "Trecho 1 — Bloco de Fundação",
    description: "Primeiro trecho da fundação dentro da Frente A.",
    type: WorkPackageType.ExecutionFront,
    parentWorkPackageId: "wp-frente-a",
    sequence: 1,
    correlationId,
    createdBy: "planning-app",
    sourceSystem: "planning-app",
  });
  if (!trecho1Result.success) {
    throw new Error(`expected Trecho 1 fixture success: ${JSON.stringify(trecho1Result.errors)}`);
  }

  return { frente: frenteResult.workPackage, trecho1: trecho1Result.workPackage };
}

function enrichWithRealWorldData(spatialObject: SpatialObject): SpatialObject {
  const withApproxGeometry = addSpatialGeometryVersion({
    spatialObject,
    geometry: {
      id: `${spatialObject.id}:geom:approx`,
      coordinates: [{ latitude: -7.1146, longitude: -37.881 }],
      source: SpatialGeometrySource.GpsApproximate,
    },
    actor,
    occurredAt: laterOccurredAt,
  });
  if (!withApproxGeometry.success) {
    throw new Error(`expected approximate geometry success: ${JSON.stringify(withApproxGeometry.errors)}`);
  }

  const withRtkGeometry = addSpatialGeometryVersion({
    spatialObject: withApproxGeometry.spatialObject,
    geometry: {
      id: `${spatialObject.id}:geom:rtk`,
      coordinates: [{ latitude: -7.11462, longitude: -37.88098, elevation: 322 }],
      source: SpatialGeometrySource.RtkGnss,
    },
    actor,
    occurredAt: laterOccurredAt,
  });
  if (!withRtkGeometry.success) {
    throw new Error(`expected RTK geometry success: ${JSON.stringify(withRtkGeometry.errors)}`);
  }

  const withPerformed = attachSpatialLayer({
    spatialObject: withRtkGeometry.spatialObject,
    layer: {
      id: `${spatialObject.id}:layer:as-performed`,
      type: SpatialLayerType.AsPerformed,
      source: "execution-engine",
      description: "Execução da fundação confirmada em campo.",
    },
    actor,
    occurredAt: laterOccurredAt,
  });
  if (!withPerformed.success) {
    throw new Error(`expected as-performed layer success: ${JSON.stringify(withPerformed.errors)}`);
  }

  const withEvidence = attachSpatialLayer({
    spatialObject: withPerformed.spatialObject,
    layer: {
      id: `${spatialObject.id}:layer:evidential`,
      type: SpatialLayerType.Evidential,
      source: "evidence-engine",
      description: "Fotografia geolocalizada da fundação executada.",
    },
    actor,
    occurredAt: laterOccurredAt,
  });
  if (!withEvidence.success) {
    throw new Error(`expected evidential layer success: ${JSON.stringify(withEvidence.errors)}`);
  }

  return withEvidence.spatialObject;
}

function spatialObjectIdFor(workPackage: WorkPackage): string {
  return `spatial-object:work-package:${workPackage.id}`;
}

function findSpatialObject(
  spatialObjects: ReadonlyArray<SpatialObject>,
  workPackage: WorkPackage,
): SpatialObject | undefined {
  return spatialObjects.find((spatialObject) => spatialObject.id === spatialObjectIdFor(workPackage));
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

function assertDefined<T>(value: T | undefined, message: string): asserts value is T {
  if (value === undefined) {
    throw new Error(message);
  }
}
