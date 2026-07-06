declare const process: { cwd(): string };

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SpatialGeometrySource,
  SpatialLayerType,
  SpatialObjectKind,
  createSpatialObject,
  type SpatialObject,
  type SpatialObjectResult,
} from "../../../spatial-object";
import {
  generateBusinessFactsFromSpatialObjects,
  spatialObjectFactsAdapter,
  spatialObjectFactsSource,
  type SpatialObjectFactsGenerationInput,
} from "./index";

const generatedAt = "2026-07-06T09:00:00Z";
const correlationId = "spatial-facts-correlation-001";
const tenantId = "tenant-2f-engenharia";
const organizationId = "org-2f-engenharia";
const capability = "geospatial-intelligence";
const actor = "planning-engineer-marcos";
const occurredAt = "2026-07-05T09:00:00Z";

runTest("adapter reports its own identity and supported source", () => {
  assertEqual(spatialObjectFactsAdapter.adapterId, "spatial-object-facts-adapter", "adapterId mismatch");
  assertEqual(spatialObjectFactsAdapter.supportedSource, spatialObjectFactsSource, "supportedSource mismatch");
});

runTest("generates one fact per spatial object", () => {
  const objects = [buildLowConfidenceObject("spatial-a"), buildHighConfidenceObject("spatial-b")];
  const result = generateBusinessFactsFromSpatialObjects(inputFixture({ spatialObjects: objects }));

  assertResultSuccess(result, "expected fact generation success");
  assertEqual(result.facts.length, 2, "expected exactly two facts");
  assertEqual(
    result.facts.every((fact) => fact.type === "spatial_confidence_evaluated"),
    true,
    "expected every fact to be a spatial_confidence_evaluated fact",
  );
  assertEqual(
    result.facts.every((fact) => fact.source === "spatial-object.confidence"),
    true,
    "expected every fact source to be spatial-object.confidence",
  );
});

runTest("fact value and metadata mirror evaluateSpatialConfidence", () => {
  const lowConfidenceObject = buildLowConfidenceObject("spatial-low");
  const result = generateBusinessFactsFromSpatialObjects(
    inputFixture({ spatialObjects: [lowConfidenceObject] }),
  );

  assertResultSuccess(result, "expected fact generation success");
  const fact = result.facts[0];

  assertEqual(fact?.value, 0, "expected fact value to equal the confidence score");
  assertEqual(fact?.metadata.spatialConfidenceLevel, "Low", "expected Low confidence in metadata");
  assertEqual(fact?.metadata.spatialObjectId, "spatial-low", "expected spatialObjectId in metadata");
  assertEqual(fact?.sourceReference, "spatial-low", "expected sourceReference to be the spatial object id");
});

runTest("fails when required fields are missing", () => {
  const result = generateBusinessFactsFromSpatialObjects(
    inputFixture({ tenantId: "", organizationId: "", capability: "" }),
  );

  assertResultFailure(result, "expected failure for missing required fields");
  assertEqual(
    result.errors.filter((error) => error.code === "missing_required_data").length,
    3,
    "expected three missing_required_data errors",
  );
});

runTest("fails when spatialObjects is empty", () => {
  const result = generateBusinessFactsFromSpatialObjects(inputFixture({ spatialObjects: [] }));

  assertResultFailure(result, "expected failure for empty spatialObjects");
  assertEqual(
    result.errors.some((error) => error.code === "missing_spatial_objects"),
    true,
    "expected missing_spatial_objects error",
  );
});

runTest("does not import any of the ten restricted operational domains, the Decision Engine, or any capability", () => {
  const sourceCode = readAdapterSourceFiles();
  const lowerSourceCode = sourceCode.toLowerCase();

  [
    "contract-management",
    "project-management",
    "work-package-management",
    "service-item-management",
    "engineer-workspace",
    "evidence-center",
    "measurement-workspace",
    "approval-workflow",
    "bulletin-generator",
    "export-engine",
    "engines/decision",
    "capabilities/",
    "react",
    "next",
    "supabase",
    "\"fs\"",
    "'fs'",
    "node:fs",
  ].forEach((forbidden) => {
    assertEqual(
      lowerSourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in adapter source: ${forbidden}`,
    );
  });
});

function buildLowConfidenceObject(id: string): SpatialObject {
  const created = createSpatialObject({
    id,
    label: `Objeto de baixa confiança ${id}`,
    kind: SpatialObjectKind.Point,
    actor,
    occurredAt,
  });
  assertSuccess(created, "expected object creation success");
  return created.spatialObject;
}

function buildHighConfidenceObject(id: string): SpatialObject {
  const created = createSpatialObject({
    id,
    label: `Objeto de alta confiança ${id}`,
    kind: SpatialObjectKind.Point,
    geometry: {
      id: `${id}-geom`,
      coordinates: [{ latitude: -7.1, longitude: -37.8 }],
      source: SpatialGeometrySource.RtkGnss,
    },
    actor,
    occurredAt,
  });
  assertSuccess(created, "expected object creation success");

  return created.spatialObject;
}

function inputFixture(
  overrides: Partial<SpatialObjectFactsGenerationInput> = {},
): SpatialObjectFactsGenerationInput {
  return {
    source: spatialObjectFactsSource,
    generatedAt,
    correlationId,
    tenantId,
    organizationId,
    capability,
    spatialObjects: [buildLowConfidenceObject("spatial-default")],
    metadata: {},
    ...overrides,
  };
}

function readAdapterSourceFiles(): string {
  const adapterDir = resolve(
    process.cwd(),
    "src",
    "domain",
    "business-facts-generator",
    "adapters",
    "spatial-object",
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

function assertSuccess(
  result: SpatialObjectResult,
  message: string,
): asserts result is Extract<SpatialObjectResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertResultSuccess(result: { readonly success: boolean }, message: string): void {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertResultFailure(result: { readonly success: boolean }, message: string): void {
  if (result.success) {
    throw new Error(message);
  }
}
