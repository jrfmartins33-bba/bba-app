declare const process: { cwd(): string };

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SPATIAL_CONFIDENCE_POINTS,
  SpatialGeometrySource,
  SpatialLayerType,
  SpatialObjectKind,
  SpatialObjectStatus,
  SpatialRelationshipType,
  addSpatialGeometryVersion,
  addSpatialRelationship,
  archiveSpatialObject,
  attachSpatialLayer,
  buildSpatialGraph,
  consolidateSpatialObject,
  createSpatialObject,
  evaluateSpatialConfidence,
  findCurrentSpatialGeometry,
  listSpatialLayersByType,
  summarizeSpatialObject,
  type CreateSpatialObjectInput,
  type SpatialObject,
  type SpatialObjectResult,
} from "./index";

const actor = "planning-engineer-marcos";
const occurredAt = "2026-07-05T09:00:00Z";
const laterOccurredAt = "2026-07-05T15:00:00Z";
const evenLaterOccurredAt = "2026-07-06T09:00:00Z";

runTest("valid creation without geometry", () => {
  const result = createSpatialObject(createInputFixture());

  assertSuccess(result, "expected creation success");
  assertEqual(result.spatialObject.id, "spatial-001", "id mismatch");
  assertEqual(result.spatialObject.status, SpatialObjectStatus.Conceived, "initial status mismatch");
  assertEqual(result.spatialObject.geometries.length, 0, "expected no geometries");
  assertEqual(result.spatialObject.parentId, null, "expected default parentId to be null");
  assertEqual(result.spatialObject.timeline.length, 1, "timeline count mismatch");
  assertEqual(result.spatialObject.timeline[0]?.type, "spatial_object_conceived", "timeline type mismatch");
  assertEqual(result.spatialObject.trace.length, 1, "trace count mismatch");
});

runTest("valid creation with an initial geometry", () => {
  const result = createSpatialObject({
    ...createInputFixture(),
    geometry: {
      id: "geom-001",
      coordinates: [{ latitude: -7.115, longitude: -37.881 }],
      source: SpatialGeometrySource.ManualDeclaration,
    },
  });

  assertSuccess(result, "expected creation success");
  assertEqual(result.spatialObject.geometries.length, 1, "expected one geometry version");
  assertEqual(result.spatialObject.geometries[0]?.supersededAt, null, "expected geometry to be current");

  const current = findCurrentSpatialGeometry(result.spatialObject);
  assertEqual(current?.id, "geom-001", "expected findCurrentSpatialGeometry to return the geometry");
});

runTest("creation fails with missing required fields", () => {
  const result = createSpatialObject({
    ...createInputFixture(),
    id: "",
    label: "",
  });

  assertFailure(result, "expected creation failure");
  assertEqual(
    result.errors.some((error) => error.code === "missing_id"),
    true,
    "expected missing_id error",
  );
  assertEqual(
    result.errors.some((error) => error.code === "missing_label"),
    true,
    "expected missing_label error",
  );
});

runTest("creation rejects out-of-range coordinates", () => {
  const result = createSpatialObject({
    ...createInputFixture(),
    geometry: {
      id: "geom-invalid",
      coordinates: [{ latitude: 200, longitude: -400 }],
      source: SpatialGeometrySource.GpsApproximate,
    },
  });

  assertFailure(result, "expected creation failure");
  assertEqual(
    result.errors.some((error) => error.code === "invalid_coordinate_latitude"),
    true,
    "expected invalid_coordinate_latitude error",
  );
  assertEqual(
    result.errors.some((error) => error.code === "invalid_coordinate_longitude"),
    true,
    "expected invalid_coordinate_longitude error",
  );
});

runTest("attaching an as-planned layer does not activate the object", () => {
  const created = createSpatialObject(createInputFixture());
  assertSuccess(created, "expected creation success");

  const attached = attachSpatialLayer({
    spatialObject: created.spatialObject,
    layer: {
      id: "layer-planned-001",
      type: SpatialLayerType.AsPlanned,
      source: "planning-engine",
      description: "Segmento planejado do cronograma.",
    },
    actor,
    occurredAt: laterOccurredAt,
  });

  assertSuccess(attached, "expected attach success");
  assertEqual(attached.spatialObject.status, SpatialObjectStatus.Conceived, "expected object to remain Conceived");
  assertEqual(attached.spatialObject.layers.length, 1, "expected one layer");
});

runTest("attaching a non-planning layer activates a Conceived object", () => {
  const created = createSpatialObject(createInputFixture());
  assertSuccess(created, "expected creation success");

  const attached = attachSpatialLayer({
    spatialObject: created.spatialObject,
    layer: {
      id: "layer-performed-001",
      type: SpatialLayerType.AsPerformed,
      source: "execution-engine",
      description: "Execução registrada em campo.",
    },
    actor,
    occurredAt: laterOccurredAt,
  });

  assertSuccess(attached, "expected attach success");
  assertEqual(attached.spatialObject.status, SpatialObjectStatus.Active, "expected object to activate");
  assertEqual(
    attached.spatialObject.timeline.some((event) => event.type === "spatial_object_activated"),
    true,
    "expected an activation timeline event",
  );
});

runTest("attaching a layer rejects a duplicate layer id", () => {
  const activated = buildActiveObjectFixture();

  const result = attachSpatialLayer({
    spatialObject: activated,
    layer: {
      id: "layer-performed-001",
      type: SpatialLayerType.AsMeasured,
      source: "measurement-engine",
      description: "Medição duplicada por engano.",
    },
    actor,
    occurredAt: evenLaterOccurredAt,
  });

  assertFailure(result, "expected duplicate layer failure");
  assertEqual(
    result.errors.some((error) => error.code === "duplicate_layer_id"),
    true,
    "expected duplicate_layer_id error",
  );
});

runTest("adding a new geometry version supersedes the previous one, preserving identity", () => {
  const created = createSpatialObject({
    ...createInputFixture(),
    geometry: {
      id: "geom-approx",
      coordinates: [{ latitude: -7.1, longitude: -37.8 }],
      source: SpatialGeometrySource.GpsApproximate,
    },
  });
  assertSuccess(created, "expected creation success");

  const refined = addSpatialGeometryVersion({
    spatialObject: created.spatialObject,
    geometry: {
      id: "geom-rtk",
      coordinates: [{ latitude: -7.1002, longitude: -37.8003, elevation: 320 }],
      source: SpatialGeometrySource.RtkGnss,
    },
    actor,
    occurredAt: laterOccurredAt,
  });

  assertSuccess(refined, "expected geometry refinement success");
  assertEqual(refined.spatialObject.id, "spatial-001", "expected identity to remain unchanged");
  assertEqual(refined.spatialObject.geometries.length, 2, "expected two geometry versions");

  const approxVersion = refined.spatialObject.geometries.find((geometry) => geometry.id === "geom-approx");
  assertEqual(approxVersion?.supersededAt, laterOccurredAt, "expected previous geometry to be superseded");

  const current = findCurrentSpatialGeometry(refined.spatialObject);
  assertEqual(current?.id, "geom-rtk", "expected the RTK geometry to be current");
});

runTest("adding a relationship rejects a self-reference", () => {
  const created = createSpatialObject(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addSpatialRelationship({
    spatialObject: created.spatialObject,
    relationship: {
      id: "rel-001",
      type: SpatialRelationshipType.Adjacent,
      targetId: created.spatialObject.id,
      description: "Não deveria ser permitido.",
    },
    actor,
    occurredAt: laterOccurredAt,
  });

  assertFailure(result, "expected self-reference failure");
  assertEqual(
    result.errors.some((error) => error.code === "self_referencing_relationship"),
    true,
    "expected self_referencing_relationship error",
  );
});

runTest("consolidation is only reachable from Active", () => {
  const created = createSpatialObject(createInputFixture());
  assertSuccess(created, "expected creation success");

  const prematureConsolidation = consolidateSpatialObject({
    spatialObject: created.spatialObject,
    actor,
    occurredAt: laterOccurredAt,
  });

  assertFailure(prematureConsolidation, "expected premature consolidation to fail");
  assertEqual(
    prematureConsolidation.errors.some(
      (error) => error.code === "invalid_spatial_object_status_transition",
    ),
    true,
    "expected invalid_spatial_object_status_transition error",
  );

  const activated = buildActiveObjectFixture();
  const consolidated = consolidateSpatialObject({ spatialObject: activated, actor, occurredAt: evenLaterOccurredAt });

  assertSuccess(consolidated, "expected consolidation success");
  assertEqual(consolidated.spatialObject.status, SpatialObjectStatus.Consolidated, "expected Consolidated status");
});

runTest("archiving is reachable from any non-terminal status and is final", () => {
  const created = createSpatialObject(createInputFixture());
  assertSuccess(created, "expected creation success");

  const archived = archiveSpatialObject({ spatialObject: created.spatialObject, actor, occurredAt: laterOccurredAt });
  assertSuccess(archived, "expected archive success from Conceived");
  assertEqual(archived.spatialObject.status, SpatialObjectStatus.Archived, "expected Archived status");

  const secondArchive = archiveSpatialObject({
    spatialObject: archived.spatialObject,
    actor,
    occurredAt: evenLaterOccurredAt,
  });
  assertFailure(secondArchive, "expected archiving an already-archived object to fail");
  assertEqual(
    secondArchive.errors.some((error) => error.code === "object_terminal"),
    true,
    "expected object_terminal error",
  );
});

runTest("summarizeSpatialObject reflects status and counts", () => {
  const activated = buildActiveObjectFixture();
  const summary = summarizeSpatialObject(activated);

  assertEqual(summary.status, SpatialObjectStatus.Active, "summary status mismatch");
  assertEqual(summary.totalLayers, 1, "summary totalLayers mismatch");
  assertEqual(summary.isTerminal, false, "summary isTerminal mismatch");
});

runTest("listSpatialLayersByType filters correctly", () => {
  const activated = buildActiveObjectFixture();
  const asPerformed = listSpatialLayersByType(activated, SpatialLayerType.AsPerformed);
  const asPlanned = listSpatialLayersByType(activated, SpatialLayerType.AsPlanned);

  assertEqual(asPerformed.length, 1, "expected one as-performed layer");
  assertEqual(asPlanned.length, 0, "expected no as-planned layers");
});

runTest("buildSpatialGraph produces nodes and edges from multiple objects", () => {
  const parent = createSpatialObject({
    ...createInputFixture(),
    id: "spatial-parent",
    kind: SpatialObjectKind.Polygon,
  });
  assertSuccess(parent, "expected parent creation success");

  const child = createSpatialObject({
    ...createInputFixture(),
    id: "spatial-child",
    kind: SpatialObjectKind.Point,
  });
  assertSuccess(child, "expected child creation success");

  const withRelationship = addSpatialRelationship({
    spatialObject: child.spatialObject,
    relationship: {
      id: "rel-contains-001",
      type: SpatialRelationshipType.Contains,
      targetId: "spatial-parent",
      description: "Ponto pertence ao polígono da frente.",
    },
    actor,
    occurredAt: laterOccurredAt,
  });
  assertSuccess(withRelationship, "expected relationship success");

  const graph = buildSpatialGraph([parent.spatialObject, withRelationship.spatialObject]);

  assertEqual(graph.nodes.length, 2, "expected two nodes");
  assertEqual(graph.edges.length, 1, "expected one edge");
  assertEqual(graph.edges[0]?.fromId, "spatial-child", "edge fromId mismatch");
  assertEqual(graph.edges[0]?.toId, "spatial-parent", "edge toId mismatch");
  assertEqual(graph.edges[0]?.type, SpatialRelationshipType.Contains, "edge type mismatch");
});

// --- Spatial Confidence ------------------------------------------------------

runTest("spatial confidence scores Low with no geometry and no layers", () => {
  const created = createSpatialObject(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = evaluateSpatialConfidence({ spatialObject: created.spatialObject });

  assertEqual(result.score, 0, "expected minimum score");
  assertEqual(result.confidence, "Low", "expected Low confidence");
  assertEqual(
    result.warnings.some((warning) => warning.code === "no_current_geometry"),
    true,
    "expected no_current_geometry warning",
  );
});

runTest("spatial confidence composes points that sum to at most 100", () => {
  const total =
    SPATIAL_CONFIDENCE_POINTS.currentGeometryHighPrecision +
    SPATIAL_CONFIDENCE_POINTS.geometryHasMultipleVersions +
    SPATIAL_CONFIDENCE_POINTS.multipleLayersAttached +
    SPATIAL_CONFIDENCE_POINTS.hasEvidentialLayer +
    SPATIAL_CONFIDENCE_POINTS.noWarningsDetected;

  assertEqual(total, 100, "expected spatial confidence points to sum to 100");
});

runTest("spatial confidence reaches Verified with high-precision geometry, multiple versions and layers", () => {
  const created = createSpatialObject({
    ...createInputFixture(),
    geometry: {
      id: "geom-approx",
      coordinates: [{ latitude: -7.1, longitude: -37.8 }],
      source: SpatialGeometrySource.GpsApproximate,
    },
  });
  assertSuccess(created, "expected creation success");

  const refined = addSpatialGeometryVersion({
    spatialObject: created.spatialObject,
    geometry: {
      id: "geom-rtk",
      coordinates: [{ latitude: -7.1002, longitude: -37.8003 }],
      source: SpatialGeometrySource.RtkGnss,
    },
    actor,
    occurredAt: laterOccurredAt,
  });
  assertSuccess(refined, "expected refinement success");

  const withPlanned = attachSpatialLayer({
    spatialObject: refined.spatialObject,
    layer: {
      id: "layer-planned-001",
      type: SpatialLayerType.AsPlanned,
      source: "planning-engine",
      description: "Segmento planejado.",
    },
    actor,
    occurredAt: laterOccurredAt,
  });
  assertSuccess(withPlanned, "expected as-planned attach success");

  const withEvidence = attachSpatialLayer({
    spatialObject: withPlanned.spatialObject,
    layer: {
      id: "layer-evidential-001",
      type: SpatialLayerType.Evidential,
      source: "evidence-engine",
      description: "Fotografia geolocalizada da fundação.",
    },
    actor,
    occurredAt: evenLaterOccurredAt,
  });
  assertSuccess(withEvidence, "expected evidential attach success");

  const result = evaluateSpatialConfidence({ spatialObject: withEvidence.spatialObject });

  assertEqual(result.score, 100, "expected maximum score");
  assertEqual(result.confidence, "Verified", "expected Verified confidence");
  assertEqual(result.warnings.length, 0, "expected no warnings at maximum score");
});

// --- Architecture / purity guard ---------------------------------------------

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourceCode = readDomainSourceFiles();
  const lowerSourceCode = sourceCode.toLowerCase();

  [
    "date.now(",
    "math.random(",
    "crypto.randomuuid",
    "uuid()",
    "business-fact",
    "decision-case",
    "decision-portfolio",
    "engines/decision",
    "capabilities/",
    "measurement-workspace",
    "approval-workflow",
    "bulletin-generator",
    "export-engine",
    "engineering-contract",
    "engineering-project-context",
    "project-management",
    "react",
    "next",
    "supabase",
    "\"fs\"",
    "'fs'",
    "node:fs",
    "\"path\"",
    "'path'",
    "node:path",
    "cesium",
    "mapbox",
    "google.maps",
  ].forEach((forbidden) => {
    assertEqual(
      lowerSourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in domain source: ${forbidden}`,
    );
  });
});

function createInputFixture(overrides: Partial<CreateSpatialObjectInput> = {}): CreateSpatialObjectInput {
  return {
    id: "spatial-001",
    label: "Trecho 3 — Fundação",
    kind: SpatialObjectKind.Polygon,
    actor,
    occurredAt,
    ...overrides,
  };
}

function buildActiveObjectFixture(): SpatialObject {
  const created = createSpatialObject(createInputFixture());
  assertSuccess(created, "expected creation success");

  const attached = attachSpatialLayer({
    spatialObject: created.spatialObject,
    layer: {
      id: "layer-performed-001",
      type: SpatialLayerType.AsPerformed,
      source: "execution-engine",
      description: "Execução registrada em campo.",
    },
    actor,
    occurredAt: laterOccurredAt,
  });
  assertSuccess(attached, "expected attach success");

  return attached.spatialObject;
}

function readDomainSourceFiles(): string {
  const domainDir = resolve(process.cwd(), "src", "domain", "spatial-object");
  return listTsFiles(domainDir)
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

function assertFailure(
  result: SpatialObjectResult,
  message: string,
): asserts result is Extract<SpatialObjectResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
