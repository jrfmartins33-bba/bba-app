import { createWorkPackage, type WorkPackage } from "../../domain/work-package-management";
import { generateSpatialObjectsFromWorkPackages } from "../../domain/spatial-object";
import { spatialObjectFactsAdapter } from "../../domain/business-facts-generator/adapters/spatial-object";
import { buildDecisions } from "../../engines/decision/builder";
import { buildRecommendations } from "../../engines/decision/recommendation";
import { executeRulePack, type RulePack } from "../../engines/decision/rule-engine";
import { lowSpatialConfidenceRule } from "../../capabilities/geospatial-intelligence/rules/low-spatial-confidence-rule";
import type {
  GeospatialProductIntegrationError,
  GeospatialProductIntegrationErrorStage,
  GeospatialProductIntegrationInput,
  GeospatialProductIntegrationResult,
} from "./geospatial-product-integration.types";

/**
 * The Application Service (EPIC 04 / Release 3.0 — see Roadmap
 * Estratégico in `packages/bdos-core/docs/GEOSPATIAL_ENGINE.md`) that
 * a product surface (a UI, an API route, a script) is meant to call —
 * never `domain/work-package-management`, `domain/spatial-object`,
 * `engines/decision/*`, or `capabilities/geospatial-intelligence`
 * directly. This function has no business knowledge of its own: it
 * only calls, in the same order already proven correct by
 * `capabilities/geospatial-intelligence/geospatial-intelligence.work-package-integration.test.ts`
 * (Sprint 13), the real functions that do — `createWorkPackage` (from
 * the plain `GeospatialWorkPackageInput` a caller supplies) →
 * `generateSpatialObjectsFromWorkPackages` →
 * `spatialObjectFactsAdapter.generateFacts` → `executeRulePack` →
 * `buildDecisions` → `buildRecommendations`.
 *
 * `package.json`'s `exports` map exposes this module under its own
 * subpath (`@bba/bdos-core/services/geospatial-product-integration`),
 * separate from the package's main entry point, so a future consumer
 * that imports only this subpath structurally cannot reach the raw
 * domain, engines, or capabilities layers — the same "one narrow door"
 * discipline already applied to operational domains via Rule C/E in
 * `architecture/engineering-boundaries.test.ts`, now applied to
 * whoever calls into `bdos-core` from outside the package.
 */
const geospatialRulePack: RulePack = {
  id: "geospatial-intelligence-rule-pack",
  name: "Geospatial Intelligence",
  version: "1.0.0",
  capability: "geospatial-intelligence",
  rules: [lowSpatialConfidenceRule],
  metadata: {},
};

export function buildGeospatialProductSnapshot(
  input: GeospatialProductIntegrationInput,
): GeospatialProductIntegrationResult {
  const errors: GeospatialProductIntegrationError[] = [];

  const workPackages = buildWorkPackages(input, errors);

  if (workPackages.length === 0) {
    return emptyResult(errors);
  }

  const spatialObjectResult = generateSpatialObjectsFromWorkPackages({
    workPackages,
    actor: input.actor,
    occurredAt: input.occurredAt,
  });

  errors.push(
    ...spatialObjectResult.errors.map((error) => toServiceError("spatial_object_generation", error)),
  );

  if (spatialObjectResult.spatialObjects.length === 0) {
    return emptyResult(errors);
  }

  const factsResult = spatialObjectFactsAdapter.generateFacts({
    source: spatialObjectFactsAdapter.supportedSource,
    generatedAt: input.generatedAt,
    correlationId: input.correlationId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    capability: input.capability,
    spatialObjects: spatialObjectResult.spatialObjects,
    metadata: input.metadata ?? {},
  });

  errors.push(...factsResult.errors.map((error) => toServiceError("business_fact_generation", error)));

  const diagnoses = executeRulePack(geospatialRulePack, factsResult.facts);
  const decisions = buildDecisions(diagnoses);
  const recommendations = buildRecommendations(decisions);

  return {
    success: errors.length === 0,
    spatialObjects: spatialObjectResult.spatialObjects,
    facts: factsResult.facts,
    diagnoses,
    decisions,
    recommendations,
    errors,
  };
}

function buildWorkPackages(
  input: GeospatialProductIntegrationInput,
  errors: GeospatialProductIntegrationError[],
): ReadonlyArray<WorkPackage> {
  const workPackages: WorkPackage[] = [];

  input.workPackages.forEach((workPackageInput) => {
    const result = createWorkPackage({
      id: workPackageInput.id,
      organizationId: input.organizationId,
      contractId: input.contractId,
      projectId: input.projectId,
      code: workPackageInput.code,
      name: workPackageInput.name,
      description: workPackageInput.name,
      type: workPackageInput.type,
      parentWorkPackageId: workPackageInput.parentWorkPackageId ?? null,
      sequence: workPackageInput.sequence,
      correlationId: input.correlationId,
      createdBy: input.actor,
      sourceSystem: "geospatial-product-integration",
    });

    if (!result.success) {
      errors.push(...result.errors.map((error) => toServiceError("work_package_creation", error)));
      return;
    }

    workPackages.push(result.workPackage);
  });

  return workPackages;
}

function toServiceError(
  stage: GeospatialProductIntegrationErrorStage,
  error: { readonly code: string; readonly message: string },
): GeospatialProductIntegrationError {
  return { stage, code: error.code, message: error.message };
}

function emptyResult(
  errors: ReadonlyArray<GeospatialProductIntegrationError>,
): GeospatialProductIntegrationResult {
  return {
    success: errors.length === 0,
    spatialObjects: [],
    facts: [],
    diagnoses: [],
    decisions: [],
    recommendations: [],
    errors,
  };
}
