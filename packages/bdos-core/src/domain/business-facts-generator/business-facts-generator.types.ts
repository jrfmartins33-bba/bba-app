import type { BusinessFact } from "../business-fact";

export type BusinessFactsGenerationSource = string;

export type BusinessFactsGenerationDateTime = string;

export type BusinessFactsGenerationCorrelationId = string;

export type BusinessFactsGenerationMetadata = Readonly<Record<string, unknown>>;

export interface BusinessFactsGenerationInput {
  readonly source: BusinessFactsGenerationSource;
  readonly generatedAt: BusinessFactsGenerationDateTime;
  readonly correlationId: BusinessFactsGenerationCorrelationId;
  readonly metadata: BusinessFactsGenerationMetadata;
}

export interface BusinessFactGenerationError {
  readonly code: string;
  readonly message: string;
  readonly sourceId: string;
  readonly metadata: BusinessFactsGenerationMetadata;
}

export interface BusinessFactsGenerationResult {
  readonly success: boolean;
  readonly facts: ReadonlyArray<BusinessFact>;
  readonly errors: ReadonlyArray<BusinessFactGenerationError>;
  readonly metadata: BusinessFactsGenerationMetadata;
}

export interface BusinessFactsAdapter<
  TInput extends BusinessFactsGenerationInput = BusinessFactsGenerationInput,
> {
  readonly adapterId: string;
  readonly supportedSource: BusinessFactsGenerationSource;
  readonly generateFacts: (input: TInput) => BusinessFactsGenerationResult;
}

export interface CreateBusinessFactsGenerationResultInput {
  readonly facts?: ReadonlyArray<BusinessFact>;
  readonly errors?: ReadonlyArray<BusinessFactGenerationError>;
  readonly metadata?: BusinessFactsGenerationMetadata;
}
