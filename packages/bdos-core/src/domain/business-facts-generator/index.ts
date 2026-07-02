export type {
  BusinessFactGenerationError,
  BusinessFactsAdapter,
  BusinessFactsGenerationCorrelationId,
  BusinessFactsGenerationDateTime,
  BusinessFactsGenerationInput,
  BusinessFactsGenerationMetadata,
  BusinessFactsGenerationResult,
  BusinessFactsGenerationSource,
  CreateBusinessFactsGenerationResultInput,
} from "./business-facts-generator.types";

export {
  createBusinessFactsGenerationResult,
  generateBusinessFacts,
} from "./business-facts-generator";

export * from "./adapters/alpha-engenharia";
