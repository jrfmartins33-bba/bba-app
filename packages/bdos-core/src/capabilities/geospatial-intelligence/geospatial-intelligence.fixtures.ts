import {
  SpatialGeometrySource,
  SpatialLayerType,
  SpatialObjectKind,
  addSpatialGeometryVersion,
  attachSpatialLayer,
  createSpatialObject,
  type SpatialObject,
  type SpatialObjectResult,
} from "../../domain/spatial-object";

/**
 * Realistic fixture for the Release 2.2 end-to-end integration proof
 * (Sprint 11 — see Roadmap Estratégico in
 * `packages/bdos-core/docs/GEOSPATIAL_ENGINE.md`), modeled on the same
 * demo project used across the platform's UI sprints: Recuperação e
 * Modernização da Barragem Lagoa do Arroz — PB. Mirrors the spirit of
 * `domain/digital-twin/alpha-engenharia`'s seed dataset (a small,
 * realistic, fully deterministic set of objects that exercises the
 * whole pipeline) without reusing that module — see the PRINCIPLE 004
 * reconciliation note on why "Digital Twin" is never repurposed here.
 */
export const fixtureActor = "planning-engineer-marcos";
export const fixtureOccurredAt = "2026-07-05T09:00:00Z";
export const fixtureRefinedAt = "2026-07-05T15:00:00Z";
export const fixtureGeneratedAt = "2026-07-06T09:00:00Z";
export const fixtureCorrelationId = "geospatial-integration-lagoa-do-arroz-001";
export const fixtureTenantId = "tenant-2f-engenharia";
export const fixtureOrganizationId = "org-lagoa-do-arroz";
export const fixtureCapability = "geospatial-intelligence";

/**
 * A foundation block declared from planning only: a single, manually
 * declared geometry and a single as-planned layer. Deliberately built
 * to score Low on Spatial Confidence — no refinement, no corroborating
 * layer, no evidence.
 */
export function lowConfidenceFoundationSpatialObjectFixture(): SpatialObject {
  const created = createSpatialObject({
    id: "spatial-fundacao-bloco-a",
    label: "Fundação Bloco A",
    kind: SpatialObjectKind.Polygon,
    geometry: {
      id: "geom-fundacao-bloco-a-001",
      coordinates: [
        { latitude: -7.1145, longitude: -37.8812 },
        { latitude: -7.1146, longitude: -37.8809 },
        { latitude: -7.1148, longitude: -37.8811 },
      ],
      source: SpatialGeometrySource.ManualDeclaration,
    },
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertSuccess(created, "expected low-confidence foundation object creation success");

  const withPlan = attachSpatialLayer({
    spatialObject: created.spatialObject,
    layer: {
      id: "layer-fundacao-bloco-a-planned",
      type: SpatialLayerType.AsPlanned,
      source: "planning-engine",
      description: "Fundação planejada para o Bloco A.",
    },
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertSuccess(withPlan, "expected as-planned layer attach success");

  return withPlan.spatialObject;
}

/**
 * The main gate structure: geometry refined from an approximate field
 * declaration to an RTK/GNSS survey, with planned, performed and
 * evidential layers all attached. Built to score Verified on Spatial
 * Confidence — corroborated from every angle PRINCIPLE 004 cares
 * about.
 */
export function highConfidenceGateSpatialObjectFixture(): SpatialObject {
  const created = createSpatialObject({
    id: "spatial-comporta-principal",
    label: "Comporta Principal",
    kind: SpatialObjectKind.Volume,
    geometry: {
      id: "geom-comporta-principal-approx",
      coordinates: [{ latitude: -7.1162, longitude: -37.8797 }],
      source: SpatialGeometrySource.GpsApproximate,
    },
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertSuccess(created, "expected high-confidence gate object creation success");

  const refined = addSpatialGeometryVersion({
    spatialObject: created.spatialObject,
    geometry: {
      id: "geom-comporta-principal-rtk",
      coordinates: [{ latitude: -7.11623, longitude: -37.87968, elevation: 318 }],
      source: SpatialGeometrySource.RtkGnss,
    },
    actor: fixtureActor,
    occurredAt: fixtureRefinedAt,
  });
  assertSuccess(refined, "expected geometry refinement success");

  const withPlan = attachSpatialLayer({
    spatialObject: refined.spatialObject,
    layer: {
      id: "layer-comporta-principal-planned",
      type: SpatialLayerType.AsPlanned,
      source: "planning-engine",
      description: "Comporta principal planejada.",
    },
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertSuccess(withPlan, "expected as-planned layer attach success");

  const withPerformed = attachSpatialLayer({
    spatialObject: withPlan.spatialObject,
    layer: {
      id: "layer-comporta-principal-performed",
      type: SpatialLayerType.AsPerformed,
      source: "execution-engine",
      description: "Instalação da comporta registrada em campo.",
    },
    actor: fixtureActor,
    occurredAt: fixtureRefinedAt,
  });
  assertSuccess(withPerformed, "expected as-performed layer attach success");

  const withEvidence = attachSpatialLayer({
    spatialObject: withPerformed.spatialObject,
    layer: {
      id: "layer-comporta-principal-evidential",
      type: SpatialLayerType.Evidential,
      source: "evidence-engine",
      description: "Fotografia geolocalizada da comporta instalada.",
    },
    actor: fixtureActor,
    occurredAt: fixtureRefinedAt,
  });
  assertSuccess(withEvidence, "expected evidential layer attach success");

  return withEvidence.spatialObject;
}

function assertSuccess(
  result: SpatialObjectResult,
  message: string,
): asserts result is Extract<SpatialObjectResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}
