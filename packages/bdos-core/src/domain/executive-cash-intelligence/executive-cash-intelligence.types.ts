import type {
  CashForecast,
  CashForecastId,
  CashForecastMetadata,
  CashForecastPeriodId,
} from "../cash-forecast";
import type { CashFlowSignalId } from "../cash-flow-signal";
import type { MeasurementDate } from "../measurement";

export type ExecutiveCashInsightId = string;

export type ExecutiveCashInsightMetadata = CashForecastMetadata;

export type ExecutiveCashInsightConfidence = number;

export enum CashPosition {
  Strong = "strong",
  Stable = "stable",
  Pressured = "pressured",
  Critical = "critical",
}

export enum Urgency {
  Immediate = "immediate",
  High = "high",
  Moderate = "moderate",
  Low = "low",
}

export type ExecutiveCashSeverity = "critical" | "high" | "medium" | "low";

export type ExecutiveCashAttentionPriority =
  | "immediate"
  | "high"
  | "moderate"
  | "low";

export interface KeyFinding {
  readonly type: string;
  readonly title: string;
  readonly description: string;
  readonly severity: ExecutiveCashSeverity;
  readonly supportingPeriods: ReadonlyArray<CashForecastPeriodId>;
  readonly supportingSignals: ReadonlyArray<CashFlowSignalId>;
}

export interface CashRisk {
  readonly type: string;
  readonly title: string;
  readonly description: string;
  readonly severity: ExecutiveCashSeverity;
  readonly supportingPeriods: ReadonlyArray<CashForecastPeriodId>;
  readonly supportingSignals: ReadonlyArray<CashFlowSignalId>;
}

export interface RecommendedAttention {
  readonly sequence: number;
  readonly title: string;
  readonly description: string;
  readonly priority: ExecutiveCashAttentionPriority;
}

export interface ExecutiveCashEvidence {
  readonly statement: string;
  readonly supportingForecastId: CashForecastId;
  readonly supportingPeriods: ReadonlyArray<CashForecastPeriodId>;
  readonly supportingSignals: ReadonlyArray<CashFlowSignalId>;
}

export interface ExecutiveCashInsight {
  readonly id: ExecutiveCashInsightId;
  readonly forecastId: CashForecastId;
  readonly generatedAt: MeasurementDate;
  readonly cashPosition: CashPosition;
  readonly urgency: Urgency;
  readonly headline: string;
  readonly summary: string;
  readonly keyFindings: ReadonlyArray<KeyFinding>;
  readonly risks: ReadonlyArray<CashRisk>;
  readonly recommendedAttention: ReadonlyArray<RecommendedAttention>;
  readonly confidence: ExecutiveCashInsightConfidence;
  readonly evidence: ReadonlyArray<ExecutiveCashEvidence>;
  readonly metadata: ExecutiveCashInsightMetadata;
}

export interface CreateExecutiveCashInsightInput {
  readonly cashForecast: CashForecast;
  readonly id: ExecutiveCashInsightId;
  readonly generatedAt: MeasurementDate;
  readonly metadata?: ExecutiveCashInsightMetadata;
}
