import type { BusinessFact } from "../../../domain/business-fact";
import type { Rule } from "../../../engines/decision/rule-engine";
import type { Diagnosis } from "../../../engines/decision/pipeline/diagnose";

const spatialConfidenceEvaluatedType = "spatial_confidence_evaluated";
const lowConfidenceLevel = "Low";

type SpatialConfidenceBusinessFact = BusinessFact & {
  readonly value: number;
};

/**
 * The first real spatial correlation rule (Release 2.2 — see Roadmap
 * Estratégico in `GEOSPATIAL_ENGINE.md`): for every `BusinessFact`
 * produced by `business-facts-generator/adapters/spatial-object` whose
 * Spatial Confidence (`domain/spatial-object/spatial-confidence.ts`)
 * evaluated to `Low`, raises one `Diagnosis` — unlike
 * `projectedCashDeficitRule`, which aggregates many facts into a single
 * portfolio-level total, this rule is deliberately per-object: spatial
 * risk is local to a place in the work, not a single number for the
 * whole project.
 */
export const lowSpatialConfidenceRule: Rule = (facts) => {
  const spatialConfidenceFacts = getSpatialConfidenceFacts(facts);

  return spatialConfidenceFacts
    .filter((fact) => fact.metadata.spatialConfidenceLevel === lowConfidenceLevel)
    .map((fact) => buildDiagnosis(fact));
};

function getSpatialConfidenceFacts(
  facts: ReadonlyArray<BusinessFact>,
): ReadonlyArray<SpatialConfidenceBusinessFact> {
  return facts.filter(
    (fact): fact is SpatialConfidenceBusinessFact =>
      fact.type === spatialConfidenceEvaluatedType && typeof fact.value === "number",
  );
}

function buildDiagnosis(fact: SpatialConfidenceBusinessFact): Diagnosis {
  return {
    id: createDiagnosisId(fact),
    category: "risk",
    type: "low_spatial_confidence",
    title: "Low spatial confidence",
    description:
      `Spatial object "${fact.sourceReference}" has low spatial confidence (score ${fact.value}). ` +
      "Its location and evidence trail may not be reliable enough to support a decision.",
    severity: "medium",
    confidence: fact.value,
    facts: [fact],
    metadata: {
      spatialObjectId: fact.metadata.spatialObjectId,
      spatialObjectKind: fact.metadata.spatialObjectKind,
      spatialConfidenceScore: fact.value,
      spatialConfidenceWarningCodes: fact.metadata.spatialConfidenceWarningCodes,
    },
    createdAt: fact.observedAt,
  };
}

function createDiagnosisId(fact: SpatialConfidenceBusinessFact): string {
  return `geospatial-intelligence:low-spatial-confidence:${fact.id}`;
}
