import { WorkPackageType } from "../../domain/work-package-management";
import type { SpatialObject } from "../../domain/spatial-object";
import type { BusinessFact } from "../../domain/business-fact";
import type { Diagnosis } from "../../engines/decision/pipeline/diagnose";
import type { Decision } from "../../domain/decision";
import type { Recommendation } from "../../engines/decision/recommendation";

/**
 * Re-exported so a caller (a UI, an API route) never needs to import
 * `domain/work-package-management` directly — this enum is the only
 * piece of that domain's vocabulary a caller needs, and it is stable,
 * shared vocabulary, not an aggregate or a constructor function.
 */
export { WorkPackageType };

/**
 * A plain, UI-friendly description of one execution front/segment —
 * deliberately NOT the real `WorkPackage` aggregate. A caller outside
 * `bdos-core` should never need to know how to construct a
 * `WorkPackage` via `createWorkPackage` — building the real domain
 * aggregate from this input is this service's own job, done once,
 * internally (see `geospatial-product-integration.ts`).
 */
export interface GeospatialWorkPackageInput {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: WorkPackageType;
  readonly parentWorkPackageId?: string | null;
  readonly sequence: number;
}

export interface GeospatialProductIntegrationInput {
  readonly workPackages: ReadonlyArray<GeospatialWorkPackageInput>;
  readonly organizationId: string;
  readonly contractId: string;
  readonly projectId: string;
  readonly tenantId: string;
  readonly capability: string;
  readonly generatedAt: string;
  readonly correlationId: string;
  readonly actor: string;
  readonly occurredAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Which stage of the chain an error originated in — `services/*` never
 * invents its own errors, only relabels the ones already produced by
 * `domain/work-package-management`, `domain/spatial-object` and
 * `domain/business-facts-generator` so a caller has one uniform error
 * shape instead of needing to know each stage's own error type.
 */
export type GeospatialProductIntegrationErrorStage =
  | "work_package_creation"
  | "spatial_object_generation"
  | "business_fact_generation";

export interface GeospatialProductIntegrationError {
  readonly stage: GeospatialProductIntegrationErrorStage;
  readonly code: string;
  readonly message: string;
}

/**
 * A snapshot of everything the Geospatial Engine's decision chain
 * produced for a given batch of execution fronts, at every stage — not
 * just the final `Decision`/`Recommendation`, since a consumer may
 * want to show the intermediate spatial objects or facts too (e.g. a
 * map, or a confidence breakdown) without re-running the chain itself.
 */
export interface GeospatialProductIntegrationResult {
  readonly success: boolean;
  readonly spatialObjects: ReadonlyArray<SpatialObject>;
  readonly facts: ReadonlyArray<BusinessFact>;
  readonly diagnoses: ReadonlyArray<Diagnosis>;
  readonly decisions: ReadonlyArray<Decision>;
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly errors: ReadonlyArray<GeospatialProductIntegrationError>;
}
