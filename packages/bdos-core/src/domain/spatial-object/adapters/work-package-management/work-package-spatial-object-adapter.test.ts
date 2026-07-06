declare const process: { cwd(): string };

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createWorkPackage, WorkPackageType, type WorkPackage } from "../../../work-package-management";
import { SpatialObjectKind, SpatialObjectStatus, SpatialRelationshipType } from "../../spatial-object.types";
import { generateSpatialObjectsFromWorkPackages } from "./index";

const actor = "planning-engineer-marcos";
const occurredAt = "2026-07-06T09:00:00Z";
const organizationId = "org-lagoa-do-arroz";
const contractId = "contract-lagoa-do-arroz";
const projectId = "project-lagoa-do-arroz";
const correlationId = "wp-spatial-adapter-correlation-001";
const createdBy = "planning-app";
const sourceSystem = "planning-app";

runTest("converts execution-front work packages into spatial objects, skipping everything else", () => {
  const frente = buildWorkPackageFixture({
    id: "wp-frente-a",
    code: "FR-A",
    name: "Frente A",
    type: WorkPackageType.ExecutionFront,
    sequence: 1,
  });
  const trecho1 = buildWorkPackageFixture({
    id: "wp-trecho-1",
    code: "FR-A.1",
    name: "Trecho 1",
    type: WorkPackageType.ExecutionFront,
    parentWorkPackageId: "wp-frente-a",
    sequence: 1,
  });
  const trecho2 = buildWorkPackageFixture({
    id: "wp-trecho-2",
    code: "FR-A.2",
    name: "Trecho 2",
    type: WorkPackageType.ExecutionFront,
    parentWorkPackageId: "wp-frente-a",
    sequence: 2,
  });
  const mobilizacao = buildWorkPackageFixture({
    id: "wp-mobilizacao",
    code: "MOB",
    name: "Mobilização",
    type: WorkPackageType.Mobilization,
    sequence: 1,
  });

  const result = generateSpatialObjectsFromWorkPackages({
    workPackages: [frente, trecho1, trecho2, mobilizacao],
    actor,
    occurredAt,
  });

  assertEqual(result.success, true, "expected adapter success");
  assertEqual(result.errors.length, 0, "expected zero errors");
  assertEqual(result.spatialObjects.length, 3, "expected exactly three spatial objects");
  assertEqual(result.skipped.length, 1, "expected exactly one skipped work package");
  assertEqual(result.skipped[0]?.workPackageId, "wp-mobilizacao", "expected Mobilização to be skipped");
  assertEqual(result.skipped[0]?.reason, "not_execution_front", "expected the correct skip reason");

  const frenteSpatial = findSpatialObject(result.spatialObjects, "wp-frente-a");
  const trecho1Spatial = findSpatialObject(result.spatialObjects, "wp-trecho-1");
  const trecho2Spatial = findSpatialObject(result.spatialObjects, "wp-trecho-2");

  assertEqual(frenteSpatial?.kind, SpatialObjectKind.Group, "expected Frente A to be a Group (has children)");
  assertEqual(frenteSpatial?.parentId, null, "expected Frente A to have no parent");
  assertEqual(trecho1Spatial?.kind, SpatialObjectKind.Polygon, "expected Trecho 1 to be a Polygon (leaf)");
  assertEqual(trecho1Spatial?.parentId, frenteSpatial?.id, "expected Trecho 1 parentId to point at Frente A");
  assertEqual(trecho2Spatial?.parentId, frenteSpatial?.id, "expected Trecho 2 parentId to point at Frente A");

  [frenteSpatial, trecho1Spatial, trecho2Spatial].forEach((spatialObject) => {
    assertEqual(spatialObject?.status, SpatialObjectStatus.Conceived, "expected every object to be Conceived");
    assertEqual(spatialObject?.geometries.length, 0, "expected no geometry — WorkPackage carries none");
    assertEqual(spatialObject?.layers.length, 1, "expected exactly one AsPlanned layer");
  });

  assertEqual(
    frenteSpatial?.relationships.length,
    2,
    "expected Frente A to carry two explicit Contains relationships",
  );
  assertEqual(
    frenteSpatial?.relationships.every((relationship) => relationship.type === SpatialRelationshipType.Contains),
    true,
    "expected both relationships to be Contains",
  );
  assertEqual(
    frenteSpatial?.relationships.some((relationship) => relationship.targetId === trecho1Spatial?.id),
    true,
    "expected Frente A to contain Trecho 1",
  );
  assertEqual(
    frenteSpatial?.relationships.some((relationship) => relationship.targetId === trecho2Spatial?.id),
    true,
    "expected Frente A to contain Trecho 2",
  );
});

runTest("is order-independent: children listed before their parent still resolve correctly", () => {
  const frente = buildWorkPackageFixture({
    id: "wp-frente-b",
    code: "FR-B",
    name: "Frente B",
    type: WorkPackageType.ExecutionFront,
    sequence: 1,
  });
  const trecho = buildWorkPackageFixture({
    id: "wp-trecho-b1",
    code: "FR-B.1",
    name: "Trecho B1",
    type: WorkPackageType.ExecutionFront,
    parentWorkPackageId: "wp-frente-b",
    sequence: 1,
  });

  // Child first, parent second — the adapter must not depend on input order.
  const result = generateSpatialObjectsFromWorkPackages({
    workPackages: [trecho, frente],
    actor,
    occurredAt,
  });

  assertEqual(result.success, true, "expected adapter success regardless of input order");
  assertEqual(result.spatialObjects.length, 2, "expected exactly two spatial objects");

  const frenteSpatial = findSpatialObject(result.spatialObjects, "wp-frente-b");
  const trechoSpatial = findSpatialObject(result.spatialObjects, "wp-trecho-b1");

  assertEqual(trechoSpatial?.parentId, frenteSpatial?.id, "expected parentId to resolve regardless of order");
  assertEqual(
    frenteSpatial?.relationships.some((relationship) => relationship.targetId === trechoSpatial?.id),
    true,
    "expected the Contains relationship to resolve regardless of order",
  );
});

runTest("a work package with no eligible execution-front items produces nothing but skips", () => {
  const administration = buildWorkPackageFixture({
    id: "wp-admin",
    code: "ADM",
    name: "Administração",
    type: WorkPackageType.Administration,
    sequence: 1,
  });

  const result = generateSpatialObjectsFromWorkPackages({
    workPackages: [administration],
    actor,
    occurredAt,
  });

  assertEqual(result.success, true, "expected success even with zero eligible work packages");
  assertEqual(result.spatialObjects.length, 0, "expected zero spatial objects");
  assertEqual(result.skipped.length, 1, "expected one skip");
});

runTest(
  "does not import any operational domain other than work-package-management, or the Decision Engine/capabilities",
  () => {
    const sourceCode = readAdapterSourceFiles();
    const lowerSourceCode = sourceCode.toLowerCase();

    [
      "contract-management",
      "project-management",
      "service-item-management",
      "engineer-workspace",
      "evidence-center",
      "measurement-workspace",
      "approval-workflow",
      "bulletin-generator",
      "export-engine",
      "engines/decision",
      "capabilities/",
      "business-fact",
      "decision-case",
      "react",
      "next",
      "supabase",
      "cesium",
      "mapbox",
    ].forEach((forbidden) => {
      assertEqual(
        lowerSourceCode.includes(forbidden),
        false,
        `unexpected forbidden construct in adapter source: ${forbidden}`,
      );
    });
  },
);

function buildWorkPackageFixture(overrides: {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: WorkPackageType;
  readonly sequence: number;
  readonly parentWorkPackageId?: string;
}): WorkPackage {
  const result = createWorkPackage({
    id: overrides.id,
    organizationId,
    contractId,
    projectId,
    code: overrides.code,
    name: overrides.name,
    description: `${overrides.name} — fixture.`,
    type: overrides.type,
    parentWorkPackageId: overrides.parentWorkPackageId ?? null,
    sequence: overrides.sequence,
    correlationId,
    createdBy,
    sourceSystem,
  });

  if (!result.success) {
    throw new Error(`expected work package fixture creation success: ${JSON.stringify(result.errors)}`);
  }

  return result.workPackage;
}

function findSpatialObject(
  spatialObjects: ReturnType<typeof generateSpatialObjectsFromWorkPackages>["spatialObjects"],
  workPackageId: string,
) {
  return spatialObjects.find((spatialObject) => spatialObject.id === `spatial-object:work-package:${workPackageId}`);
}

function readAdapterSourceFiles(): string {
  const adapterDir = resolve(
    process.cwd(),
    "src",
    "domain",
    "spatial-object",
    "adapters",
    "work-package-management",
  );
  return listTsFiles(adapterDir)
    .filter((file) => !file.endsWith(".test.ts"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

function listTsFiles(dir: string): ReadonlyArray<string> {
  let entries: ReadonlyArray<string>;

  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const files: string[] = [];

  entries.forEach((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listTsFiles(fullPath));
      return;
    }

    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  });

  return files;
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
