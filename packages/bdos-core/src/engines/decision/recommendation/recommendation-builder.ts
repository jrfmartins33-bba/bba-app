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

export function buildRecommendations(
  decisions: BuildRecommendationsInput,
): BuildRecommendationsResult {
  return decisions.flatMap((decision) => {
    const recommendation = buildRecommendation(decision);

    return recommendation === null ? [] : [recommendation];
  });
}

function buildRecommendation(decision: Decision): Recommendation | null {
  if (!isProjectedCashDeficitDecision(decision)) {
    return null;
  }

  const recommendationId = `recommendation:${decision.id}:cash-protection`;

  return {
    id: recommendationId,
    decisionId: decision.id,
    title: "Cash protection recommendation",
    summary:
      "Recommended action options to respond to a projected cash deficit.",
    options: buildCashProtectionOptions(recommendationId),
    traceability: {
      decisionId: decision.id,
      diagnosisId: getStringMetadata(decision.metadata, "diagnosisId"),
      capabilities: getCapabilities(decision),
      evidenceReferences: getEvidenceReferences(decision),
      businessFactIds: getBusinessFactIds(decision),
    },
    metadata: {
      recommendationType: "cash_protection",
      decisionCategory: decision.category,
      decisionPriority: decision.priority,
    },
    createdAt: decision.createdAt,
  };
}

function isProjectedCashDeficitDecision(decision: Decision): boolean {
  return (
    decision.category === DecisionCategory.Financial &&
    getStringMetadata(decision.metadata, "diagnosisType") ===
      projectedCashDeficitDiagnosisType
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
