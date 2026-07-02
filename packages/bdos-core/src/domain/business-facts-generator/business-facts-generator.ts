import type {
  BusinessFactsAdapter,
  BusinessFactsGenerationInput,
  BusinessFactsGenerationResult,
  CreateBusinessFactsGenerationResultInput,
} from "./business-facts-generator.types";

export function createBusinessFactsGenerationResult(
  input: CreateBusinessFactsGenerationResultInput,
): BusinessFactsGenerationResult {
  const facts = input.facts ?? [];
  const errors = input.errors ?? [];

  return {
    success: errors.length === 0,
    facts,
    errors,
    metadata: input.metadata ?? {},
  };
}

export function generateBusinessFacts<
  TInput extends BusinessFactsGenerationInput,
>(
  adapter: BusinessFactsAdapter<TInput>,
  input: TInput,
): BusinessFactsGenerationResult {
  if (input.source !== adapter.supportedSource) {
    return createBusinessFactsGenerationResult({
      errors: [
        {
          code: "unsupported_source",
          message: `Adapter ${adapter.adapterId} does not support source ${input.source}.`,
          sourceId: input.source,
          metadata: {
            ...input.metadata,
            adapterId: adapter.adapterId,
            supportedSource: adapter.supportedSource,
            correlationId: input.correlationId,
          },
        },
      ],
      metadata: {
        ...input.metadata,
        correlationId: input.correlationId,
      },
    });
  }

  return adapter.generateFacts(input);
}
