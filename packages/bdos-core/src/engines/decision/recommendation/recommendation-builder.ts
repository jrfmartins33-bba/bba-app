import type { Decision } from "../../../domain/decision";
import { DecisionCategory } from "../../../domain/decision";
import type {
  BuildRecommendationsInput,
  BuildRecommendationsResult,
  Recommendation,
  RecommendationActionType,
  RecommendationOption,
} from "./recommendation.types";

const projectedCashDeficitDiagnosisType = "projected_cash_deficit";
const lowSpatialConfidenceDiagnosisType = "low_spatial_confidence";

/**
 * Content specific to one recognized `Decision` shape — everything
 * else (id, decisionId, traceability, metadata scaffolding) is
 * assembled once, identically, in `buildRecommendation` below. Adding
 * a recommendation for a new Engine/Capability means adding one entry
 * to `resolveRecommendationContent`, never touching the assembly
 * logic itself — this replaces the single `isProjectedCashDeficitDecision`
 * special case (Release 2.7 / Sprint 15) with a pattern meant to be
 * repeated, not special-cased, mirroring how Rule C/E treat authorized
 * seams in `architecture/engineering-boundaries.test.ts`.
 */
interface RecommendationContent {
  /** Used verbatim in the recommendation id — kept separate from
   * `recommendationType` on purpose: the original cash-protection case
   * already used "cash-protection" (hyphenated) in its id while using
   * "cash_protection" (underscored) in `metadata.recommendationType`.
   * Preserved exactly as-is rather than "fixed", to guarantee zero
   * behavior change for the existing cash-intelligence case. */
  readonly idSuffix: string;
  readonly recommendationType: string;
  readonly title: string;
  readonly summary: string;
  readonly buildOptions: (recommendationId: string) => ReadonlyArray<RecommendationOption>;
}

export function buildRecommendations(
  decisions: BuildRecommendationsInput,
): BuildRecommendationsResult {
  return decisions.flatMap((decision) => {
    const recommendation = buildRecommendation(decision);

    return recommendation === null ? [] : [recommendation];
  });
}

function buildRecommendation(decision: Decision): Recommendation | null {
  const content = resolveRecommendationContent(decision);

  if (content === null) {
    return null;
  }

  const recommendationId = `recommendation:${decision.id}:${content.idSuffix}`;

  return {
    id: recommendationId,
    decisionId: decision.id,
    title: content.title,
    summary: content.summary,
    options: content.buildOptions(recommendationId),
    traceability: {
      decisionId: decision.id,
      diagnosisId: getStringMetadata(decision.metadata, "diagnosisId"),
      capabilities: getCapabilities(decision),
      evidenceReferences: getEvidenceReferences(decision),
      businessFactIds: getBusinessFactIds(decision),
    },
    metadata: {
      recommendationType: content.recommendationType,
      decisionCategory: decision.category,
      decisionPriority: decision.priority,
    },
    createdAt: decision.createdAt,
  };
}

function resolveRecommendationContent(decision: Decision): RecommendationContent | null {
  if (isProjectedCashDeficitDecision(decision)) {
    return {
      idSuffix: "cash-protection",
      recommendationType: "cash_protection",
      title: "Cash protection recommendation",
      summary: "Recommended action options to respond to a projected cash deficit.",
      buildOptions: buildCashProtectionOptions,
    };
  }

  if (isLowSpatialConfidenceDecision(decision)) {
    return {
      idSuffix: "spatial-confidence-regularization",
      recommendationType: "spatial_confidence_regularization",
      title: "Spatial confidence regularization recommendation",
      summary:
        "Regularizar a base espacial da frente/trecho antes de avançar decisões dependentes de localização.",
      buildOptions: buildSpatialConfidenceRegularizationOptions,
    };
  }

  return null;
}

function isProjectedCashDeficitDecision(decision: Decision): boolean {
  return (
    decision.category === DecisionCategory.Financial &&
    getStringMetadata(decision.metadata, "diagnosisType") ===
      projectedCashDeficitDiagnosisType
  );
}

function isLowSpatialConfidenceDecision(decision: Decision): boolean {
  return (
    decision.category === DecisionCategory.Risk &&
    getStringMetadata(decision.metadata, "diagnosisType") ===
      lowSpatialConfidenceDiagnosisType
  );
}

function buildCashProtectionOptions(
  recommendationId: string,
): ReadonlyArray<RecommendationOption> {
  return [
    createOption(
      recommendationId,
      "reduce_discretionary_spending",
      "Reduce discretionary spending",
      "Review and reduce discretionary spending until projected cash position is positive.",
    ),
    createOption(
      recommendationId,
      "accelerate_receivables",
      "Accelerate receivables",
      "Prioritize collection actions and incentives that accelerate expected receivables.",
    ),
    createOption(
      recommendationId,
      "renegotiate_payment_terms",
      "Renegotiate payment terms",
      "Negotiate extended payment terms for upcoming obligations where commercially viable.",
    ),
    createOption(
      recommendationId,
      "defer_non_critical_expenses",
      "Defer non-critical expenses",
      "Postpone non-critical expenses until cash position is stabilized.",
    ),
  ];
}

/**
 * Directly operationalizes the summary ("regularizar a base espacial
 * antes de avançar decisões dependentes de localização") into four
 * concrete options — mirroring the cash-protection shape (one
 * strategic summary, several tactical options) rather than inventing
 * a new recommendation shape for this Engine.
 */
function buildSpatialConfidenceRegularizationOptions(
  recommendationId: string,
): ReadonlyArray<RecommendationOption> {
  return [
    createOption(
      recommendationId,
      "regularize_spatial_geometry",
      "Regularize spatial geometry",
      "Request a topography or RTK/GNSS survey to replace the approximate geometry with field-grade precision.",
    ),
    createOption(
      recommendationId,
      "attach_spatial_evidence",
      "Attach spatial evidence",
      "Link a geolocated photo or field record proving execution at the declared location.",
    ),
    createOption(
      recommendationId,
      "corroborate_spatial_layers",
      "Corroborate with additional layers",
      "Request that Execution and Evidence register their layers for this place before relying on it further.",
    ),
    createOption(
      recommendationId,
      "defer_location_dependent_decisions",
      "Defer location-dependent decisions",
      "Postpone approvals, measurements, or financial decisions that depend on this place's exact location until spatial confidence improves.",
    ),
  ];
}

function createOption(
  recommendationId: string,
  type: RecommendationActionType,
  title: string,
  description: string,
): RecommendationOption {
  return {
    id: `${recommendationId}:option:${type}`,
    type,
    title,
    description,
  };
}

function getCapabilities(decision: Decision): ReadonlyArray<string> {
  return uniqueStrings(
    decision.evidence
      .map((evidence) => getStringMetadata(evidence.metadata, "capability"))
      .filter(isString),
  );
}

function getEvidenceReferences(decision: Decision): ReadonlyArray<string> {
  return uniqueStrings(
    decision.evidence
      .map((evidence) => evidence.sourceReference)
      .filter((sourceReference) => sourceReference.trim().length > 0),
  );
}

function getBusinessFactIds(decision: Decision): ReadonlyArray<string> {
  return uniqueStrings(
    decision.evidence
      .map((evidence) => getStringMetadata(evidence.metadata, "businessFactId"))
      .filter(isString),
  );
}

function getStringMetadata(
  metadata: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = metadata[key];

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function uniqueStrings(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...new Set(values)];
}

function isString(value: string | null): value is string {
  return value !== null;
}
