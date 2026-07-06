import { DecisionCategory } from "../../domain/decision";
import { buildGeospatialProductSnapshot } from "./geospatial-product-integration";
import { WorkPackageType, type GeospatialWorkPackageInput } from "./geospatial-product-integration.types";

/**
 * Sprint 16 — Geospatial Product Integration (EPIC 04, Release 3.0 —
 * see Roadmap Estratégico in `packages/bdos-core/docs/GEOSPATIAL_ENGINE.md`).
 *
 * Deliberately builds its fixtures using only `GeospatialWorkPackageInput`
 * (a plain DTO) and `WorkPackageType` — both re-exported from this
 * service's own types module — never `domain/work-package-management`
 * directly, proving the service really does hide that domain from its
 * callers, not just in principle.
 *
 * Re-exercises exactly the scenarios already proven, function by
 * function, in Sprint 13
 * (`capabilities/geospatial-intelligence/geospatial-intelligence.work-package-integration.test.ts`)
 * — but now through the single `buildGeospatialProductSnapshot` call a
 * real product surface would actually make.
 */
const organizationId = "org-lagoa-do-arroz";
const contractId = "contract-lagoa-do-arroz";
const projectId = "project-lagoa-do-arroz";
const correlationId = "geospatial-product-integration-001";
const generatedAt = "2026-07-06T09:00:00Z";
const actor = "planning-engineer-marcos";
const occurredAt = "2026-07-05T09:00:00Z";
const tenantId = "tenant-2f-engenharia";
const capability = "geospatial-intelligence";

runTest("fresh from Planning: a Low-confidence execution front produces a Decision and a Recommendation", () => {
  const frente: GeospatialWorkPackageInput = {
    id: "wp-frente-a",
    code: "FR-A",
    name: "Frente A — Fundação da Comporta",
    type: WorkPackageType.ExecutionFront,
    sequence: 1,
  };

  const snapshot = buildGeospatialProductSnapshot({
    workPackages: [frente],
    tenantId,
    organizationId,
    contractId,
    projectId,
    capability,
    generatedAt,
    correlationId,
    actor,
    occurredAt,
  });

  assertEqual(snapshot.success, true, "expected the snapshot to succeed");
  assertEqual(snapshot.errors.length, 0, "expected zero errors");
  assertEqual(snapshot.spatialObjects.length, 1, "expected one spatial object");
  assertEqual(snapshot.facts.length, 1, "expected one business fact");
  assertEqual(snapshot.diagnoses.length, 1, "expected one diagnosis");
  assertEqual(snapshot.decisions.length, 1, "expected one decision");
  assertEqual(snapshot.recommendations.length, 1, "expected one recommendation");

  assertEqual(snapshot.decisions[0]?.category, DecisionCategory.Risk, "expected category Risk");
  assertEqual(
    snapshot.recommendations[0]?.summary,
    "Regularizar a base espacial da frente/trecho antes de avançar decisões dependentes de localização.",
    "expected the specific regularization recommendation",
  );
  assertEqual(
    snapshot.recommendations[0]?.traceability.decisionId,
    snapshot.decisions[0]?.id,
    "expected the recommendation to trace back to the decision produced in the same snapshot",
  );
});

runTest("a WorkPackage that isn't an execution front produces an empty, successful snapshot", () => {
  const administration: GeospatialWorkPackageInput = {
    id: "wp-admin",
    code: "ADM",
    name: "Administração",
    type: WorkPackageType.Administration,
    sequence: 1,
  };

  const snapshot = buildGeospatialProductSnapshot({
    workPackages: [administration],
    tenantId,
    organizationId,
    contractId,
    projectId,
    capability,
    generatedAt,
    correlationId,
    actor,
    occurredAt,
  });

  assertEqual(snapshot.success, true, "expected success even with nothing eligible");
  assertEqual(snapshot.spatialObjects.length, 0, "expected zero spatial objects");
  assertEqual(snapshot.facts.length, 0, "expected zero facts");
  assertEqual(snapshot.decisions.length, 0, "expected zero decisions");
  assertEqual(snapshot.recommendations.length, 0, "expected zero recommendations");
});

runTest("an empty batch of work packages produces an empty, successful snapshot", () => {
  const snapshot = buildGeospatialProductSnapshot({
    workPackages: [],
    tenantId,
    organizationId,
    contractId,
    projectId,
    capability,
    generatedAt,
    correlationId,
    actor,
    occurredAt,
  });

  assertEqual(snapshot.success, true, "expected success on an empty batch");
  assertEqual(snapshot.spatialObjects.length, 0, "expected zero spatial objects");
});

runTest("a hierarchy (Frente containing a Trecho) resolves through the plain DTO input", () => {
  const frente: GeospatialWorkPackageInput = {
    id: "wp-frente-b",
    code: "FR-B",
    name: "Frente B",
    type: WorkPackageType.ExecutionFront,
    sequence: 1,
  };
  const trecho: GeospatialWorkPackageInput = {
    id: "wp-trecho-b1",
    code: "FR-B.1",
    name: "Trecho B1",
    type: WorkPackageType.ExecutionFront,
    parentWorkPackageId: "wp-frente-b",
    sequence: 1,
  };

  const snapshot = buildGeospatialProductSnapshot({
    workPackages: [frente, trecho],
    tenantId,
    organizationId,
    contractId,
    projectId,
    capability,
    generatedAt,
    correlationId,
    actor,
    occurredAt,
  });

  assertEqual(snapshot.success, true, "expected success");
  assertEqual(snapshot.spatialObjects.length, 2, "expected two spatial objects");

  const frenteSpatialObject = snapshot.spatialObjects.find(
    (spatialObject) => spatialObject.id === "spatial-object:work-package:wp-frente-b",
  );
  assertEqual(
    frenteSpatialObject?.relationships.length,
    1,
    "expected Frente B to contain exactly one relationship to Trecho B1",
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
