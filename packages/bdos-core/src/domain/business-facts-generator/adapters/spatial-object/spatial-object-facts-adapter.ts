import type { BusinessFact } from "../../../business-fact";
import { createBusinessFactsGenerationResult } from "../../business-facts-generator";
import type {
  BusinessFactGenerationError,
  BusinessFactsAdapter,
  BusinessFactsGenerationResult,
} from "../../business-facts-generator.types";
import type { SpatialObjectFactsGenerationInput } from "./spatial-object-facts-adapter.types";
import type { SpatialObject } from "../../../spatial-object";
import { evaluateSpatialConfidence, findCurrentSpatialGeometry } from "../../../spatial-object";

export const spatialObjectFactsSource = "spatial-object.confidence-evaluation";

type ValidSpatialObjectFactsGenerationInput = SpatialObjectFactsGenerationInput & {
  readonly spatialObjects: ReadonlyArray<SpatialObject>;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly capability: string;
};

export const spatialObjectFactsAdapter: BusinessFactsAdapter<SpatialObjectFactsGenerationInput> = {
  adapterId: "spatial-object-facts-adapter",
  supportedSource: spatialObjectFactsSource,
  generateFacts: generateBusinessFactsFromSpatialObjects,
};

/**
 * Turns each given `SpatialObject` into exactly one `BusinessFact`
 * carrying its Spatial Confidence evaluation (Capítulo 18 — see
 * `domain/spatial-object/spatial-confidence.ts`). This is the seam that
 * lets PRINCIPLE 004 (Spatial Intelligence) actually reach the Decision
 * Engine: everything a Rule derives from this fact — e.g. the
 * geospatial-intelligence Capability's `lowSpatialConfidenceRule` — is
 * out of scope here and belongs downstream of `BusinessFact`.
 */
export function generateBusinessFactsFromSpatialObjects(
  input: SpatialObjectFactsGenerationInput,
): BusinessFactsGenerationResult {
  const structuralErrors = validateRequiredInput(input);

  if (structuralErrors.length > 0) {
    return createBusinessFactsGenerationResult({
      errors: structuralErrors,
      metadata: createResultMetadata(input),
    });
  }

  const validInput = input as ValidSpatialObjectFactsGenerationInput;
  const stateErrors = validateSpatialObjectsPresent(validInput);

  if (stateErrors.length > 0) {
    return createBusinessFactsGenerationResult({
      errors: stateErrors,
      metadata: createResultMetadata(validInput),
    });
  }

  return createBusinessFactsGenerationResult({
    facts: createFacts(validInput),
    metadata: createResultMetadata(validInput),
  });
}

function validateRequiredInput(
  input: SpatialObjectFactsGenerationInput,
): ReadonlyArray<BusinessFactGenerationError> {
  const errors: BusinessFactGenerationError[] = [];

  if (isMissing(input.tenantId)) {
    errors.push(createMissingFieldError(input, "tenantId"));
  }

  if (isMissing(input.organizationId)) {
    errors.push(createMissingFieldError(input, "organizationId"));
  }

  if (isMissing(input.capability)) {
    errors.push(createMissingFieldError(input, "capability"));
  }

  if (input.spatialObjects === undefined || input.spatialObjects === null) {
    errors.push(createMissingFieldError(input, "spatialObjects"));
  }

  return errors;
}

function validateSpatialObjectsPresent(
  input: ValidSpatialObjectFactsGenerationInput,
): ReadonlyArray<BusinessFactGenerationError> {
  if (input.spatialObjects.length === 0) {
    return [
      {
        code: "missing_spatial_objects",
        message: "At least one spatial object is required to generate facts.",
        sourceId: "spatialObjects",
        metadata: {
          ...input.metadata,
          adapterId: spatialObjectFactsAdapter.adapterId,
          correlationId: input.correlationId,
        },
      },
    ];
  }

  return [];
}

function createFacts(input: ValidSpatialObjectFactsGenerationInput): ReadonlyArray<BusinessFact> {
  return input.spatialObjects.map((spatialObject) => createSpatialConfidenceFact(input, spatialObject));
}

function createSpatialConfidenceFact(
  input: ValidSpatialObjectFactsGenerationInput,
  spatialObject: SpatialObject,
): BusinessFact {
  const confidence = evaluateSpatialConfidence({ spatialObject });
  const currentGeometry = findCurrentSpatialGeometry(spatialObject);

  return {
    id: createFactId(input, spatialObject.id),
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    capability: input.capability,
    source: "spatial-object.confidence",
    sourceReference: spatialObject.id,
    category: "operational",
    type: "spatial_confidence_evaluated",
    label: "Spatial confidence evaluated",
    description: `Spatial confidence for "${spatialObject.label}" evaluated as ${confidence.confidence}.`,
    value: confidence.score,
    unit: "percentage",
    confidence: 100,
    observedAt: currentGeometry?.capturedAt ?? input.generatedAt,
    metadata: {
      ...input.metadata,
      adapterId: spatialObjectFactsAdapter.adapterId,
      correlationId: input.correlationId,
      spatialObjectId: spatialObject.id,
      spatialObjectKind: spatialObject.kind,
      spatialObjectStatus: spatialObject.status,
      spatialConfidenceLevel: confidence.confidence,
      spatialConfidenceScore: confidence.score,
      spatialConfidenceWarningCodes: confidence.warnings.map((warning) => warning.code),
    },
    createdAt: input.generatedAt,
  };
}

function createResultMetadata(input: SpatialObjectFactsGenerationInput) {
  return {
    ...input.metadata,
    adapterId: spatialObjectFactsAdapter.adapterId,
    correlationId: input.correlationId,
  };
}

function createFactId(input: ValidSpatialObjectFactsGenerationInput, spatialObjectId: string): string {
  return `${input.correlationId}:spatial-confidence-evaluated:${spatialObjectId}`;
}

function createMissingFieldError(
  input: SpatialObjectFactsGenerationInput,
  field: string,
): BusinessFactGenerationError {
  return {
    code: "missing_required_data",
    message: `${field} is required.`,
    sourceId: input.correlationId,
    metadata: {
      ...input.metadata,
      adapterId: spatialObjectFactsAdapter.adapterId,
      field,
      correlationId: input.correlationId,
    },
  };
}

function isMissing(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0;
}
