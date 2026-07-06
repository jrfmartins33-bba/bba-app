import type {
  Decision,
  DecisionDateTime,
  DecisionId,
} from "../../../domain/decision";

export type RecommendationId = string;

export type RecommendationOptionId = string;

export type RecommendationActionType =
  | "reduce_discretionary_spending"
  | "accelerate_receivables"
  | "renegotiate_payment_terms"
  | "defer_non_critical_expenses"
  | "regularize_spatial_geometry"
  | "attach_spatial_evidence"
  | "corroborate_spatial_layers"
  | "defer_location_dependent_decisions";

export type RecommendationMetadata = Readonly<Record<string, unknown>>;

export interface RecommendationOption {
  readonly id: RecommendationOptionId;
  readonly type: RecommendationActionType;
  readonly title: string;
  readonly description: string;
}

export interface RecommendationTraceability {
  readonly decisionId: DecisionId;
  readonly diagnosisId: string | null;
  readonly capabilities: ReadonlyArray<string>;
  readonly evidenceReferences: ReadonlyArray<string>;
  readonly businessFactIds: ReadonlyArray<string>;
}

export interface Recommendation {
  readonly id: RecommendationId;
  readonly decisionId: DecisionId;
  readonly title: string;
  readonly summary: string;
  readonly options: ReadonlyArray<RecommendationOption>;
  readonly traceability: RecommendationTraceability;
  readonly metadata: RecommendationMetadata;
  readonly createdAt: DecisionDateTime;
}

export type BuildRecommendationsInput = ReadonlyArray<Decision>;

export type BuildRecommendationsResult = ReadonlyArray<Recommendation>;
