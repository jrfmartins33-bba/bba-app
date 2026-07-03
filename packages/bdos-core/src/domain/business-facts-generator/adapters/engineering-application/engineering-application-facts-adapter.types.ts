import type { BusinessFactsGenerationInput } from "../../business-facts-generator.types";
import type { EngineeringApplicationSnapshot } from "./engineering-application-snapshot.types";

export interface EngineeringApplicationFactsGenerationInput
  extends BusinessFactsGenerationInput {
  readonly snapshot?: EngineeringApplicationSnapshot | null;
  readonly tenantId?: string;
  readonly organizationId?: string;
  readonly capability?: string;
}
