import type { BusinessFactsGenerationInput } from "../../business-facts-generator.types";
import type { SpatialObject } from "../../../spatial-object";

/**
 * `domain/spatial-object` is not one of the Engineering Operational
 * Layer domains guarded by `architecture/engineering-boundaries.test.ts`
 * (Rule C's authorized seam), so this adapter reads `SpatialObject`
 * directly — no snapshot/Anti-Corruption Layer indirection is required,
 * unlike `adapters/engineering-application`.
 */
export interface SpatialObjectFactsGenerationInput extends BusinessFactsGenerationInput {
  readonly spatialObjects?: ReadonlyArray<SpatialObject> | null;
  readonly tenantId?: string;
  readonly organizationId?: string;
  readonly capability?: string;
}
