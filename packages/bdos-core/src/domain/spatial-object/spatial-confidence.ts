import type { SpatialObject } from "./spatial-object.types";
import { SpatialGeometrySource, SpatialLayerType } from "./spatial-object.types";
import { findCurrentSpatialGeometry } from "./spatial-object";
import { EvidenceConfidence, resolveEvidenceConfidenceLevel } from "../field-evidence";

/**
 * Capítulo 18 — Spatial Confidence. Per the PRINCIPLE 004 reconciliation
 * note, this reuses the `EvidenceConfidence` vocabulary
 * (Low/Medium/High/Verified) and the exact same score-to-level mapping
 * already established in `domain/field-evidence/evidence-confidence.ts`
 * — it does not invent a parallel confidence scale. Only the scoring
 * factors below (which spatial signals earn which points) are new.
 */
export type SpatialConfidenceLevel = EvidenceConfidence;

export type SpatialConfidenceReasonCode =
  | "current_geometry_high_precision"
  | "geometry_has_multiple_versions"
  | "multiple_layers_attached"
  | "has_evidential_layer"
  | "no_warnings_detected";

export type SpatialConfidenceWarningCode =
  | "no_current_geometry"
  | "current_geometry_low_precision"
  | "single_geometry_version"
  | "single_layer_attached"
  | "no_evidential_layer";

export interface SpatialConfidenceReason {
  readonly code: SpatialConfidenceReasonCode;
  readonly description: string;
}

export interface SpatialConfidenceWarning {
  readonly code: SpatialConfidenceWarningCode;
  readonly description: string;
}

export interface SpatialConfidenceResult {
  readonly confidence: SpatialConfidenceLevel;
  readonly score: number;
  readonly reasons: ReadonlyArray<SpatialConfidenceReason>;
  readonly warnings: ReadonlyArray<SpatialConfidenceWarning>;
}

export interface SpatialConfidenceSummary {
  readonly confidence: SpatialConfidenceLevel;
  readonly score: number;
  readonly totalReasons: number;
  readonly totalWarnings: number;
  readonly hasWarnings: boolean;
}

export interface EvaluateSpatialConfidenceInput {
  readonly spatialObject: SpatialObject;
}

/**
 * Fixed point value contributed by each deterministic factor — same
 * philosophy as `EVIDENCE_CONFIDENCE_POINTS`: all-or-nothing, no
 * partial credit, five values summing to exactly 100.
 */
export const SPATIAL_CONFIDENCE_POINTS = Object.freeze({
  currentGeometryHighPrecision: 40,
  geometryHasMultipleVersions: 15,
  multipleLayersAttached: 25,
  hasEvidentialLayer: 10,
  noWarningsDetected: 10,
} as const);

const HIGH_PRECISION_SOURCES: ReadonlySet<SpatialGeometrySource> = new Set([
  SpatialGeometrySource.RtkGnss,
  SpatialGeometrySource.TopographySurvey,
  SpatialGeometrySource.DroneOrthomosaic,
  SpatialGeometrySource.Satellite,
]);

const MULTIPLE_LAYERS_THRESHOLD = 2;

/**
 * Evaluates the Spatial Confidence of a `SpatialObject` from its own
 * geometry history and attached layers only — deterministic, no wall
 * clock, no external lookups, no mutation of the input.
 */
export function evaluateSpatialConfidence(input: EvaluateSpatialConfidenceInput): SpatialConfidenceResult {
  const { spatialObject } = input;
  const reasons: SpatialConfidenceReason[] = [];
  const warnings: SpatialConfidenceWarning[] = [];
  let score = 0;

  const currentGeometry = findCurrentSpatialGeometry(spatialObject);

  if (currentGeometry === null) {
    warnings.push(createWarning("no_current_geometry", "Spatial object has no current geometry version."));
  } else if (HIGH_PRECISION_SOURCES.has(currentGeometry.source)) {
    score += SPATIAL_CONFIDENCE_POINTS.currentGeometryHighPrecision;
    reasons.push(
      createReason(
        "current_geometry_high_precision",
        `Current geometry source is ${currentGeometry.source}.`,
      ),
    );
  } else {
    warnings.push(
      createWarning("current_geometry_low_precision", `Current geometry source is ${currentGeometry.source}.`),
    );
  }

  if (currentGeometry !== null) {
    if (spatialObject.geometries.length > 1) {
      score += SPATIAL_CONFIDENCE_POINTS.geometryHasMultipleVersions;
      reasons.push(
        createReason(
          "geometry_has_multiple_versions",
          "Spatial object has more than one recorded geometry version.",
        ),
      );
    } else {
      warnings.push(
        createWarning("single_geometry_version", "Spatial object has a single geometry version, never refined."),
      );
    }
  }

  const distinctLayerTypes = new Set(spatialObject.layers.map((layer) => layer.type));

  if (distinctLayerTypes.size >= MULTIPLE_LAYERS_THRESHOLD) {
    score += SPATIAL_CONFIDENCE_POINTS.multipleLayersAttached;
    reasons.push(
      createReason(
        "multiple_layers_attached",
        `Spatial object has ${distinctLayerTypes.size} distinct layer types attached.`,
      ),
    );
  } else {
    warnings.push(
      createWarning(
        "single_layer_attached",
        "Spatial object has fewer than two distinct layer types attached.",
      ),
    );
  }

  if (distinctLayerTypes.has(SpatialLayerType.Evidential)) {
    score += SPATIAL_CONFIDENCE_POINTS.hasEvidentialLayer;
    reasons.push(createReason("has_evidential_layer", "Spatial object has an evidential layer attached."));
  } else {
    warnings.push(createWarning("no_evidential_layer", "Spatial object has no evidential layer attached."));
  }

  if (warnings.length === 0) {
    score += SPATIAL_CONFIDENCE_POINTS.noWarningsDetected;
    reasons.push(createReason("no_warnings_detected", "No deterministic warning conditions were detected."));
  }

  return buildResult(score, reasons, warnings);
}

export function summarizeSpatialConfidence(result: SpatialConfidenceResult): SpatialConfidenceSummary {
  return {
    confidence: result.confidence,
    score: result.score,
    totalReasons: result.reasons.length,
    totalWarnings: result.warnings.length,
    hasWarnings: result.warnings.length > 0,
  };
}

function buildResult(
  score: number,
  reasons: ReadonlyArray<SpatialConfidenceReason>,
  warnings: ReadonlyArray<SpatialConfidenceWarning>,
): SpatialConfidenceResult {
  return freezeDomainObject<SpatialConfidenceResult>({
    confidence: resolveEvidenceConfidenceLevel(score),
    score,
    reasons,
    warnings,
  });
}

function createReason(code: SpatialConfidenceReasonCode, description: string): SpatialConfidenceReason {
  return { code, description };
}

function createWarning(code: SpatialConfidenceWarningCode, description: string): SpatialConfidenceWarning {
  return { code, description };
}

type FreezableRecord = Record<PropertyKey, unknown>;

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [
      key,
      cloneDomainValue(property),
    ]),
  ) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.values(value as FreezableRecord).forEach((property) => {
    freezeClonedDomainObject(property);
  });

  return Object.freeze(value);
}
