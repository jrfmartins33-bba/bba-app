import {
  CashForecastAlertType,
  type CashForecast,
  type CashForecastAlert,
  type CashForecastPeriod,
  type CashForecastPeriodId,
} from "../cash-forecast";
import type { CashFlowSignalId } from "../cash-flow-signal";
import type {
  CashPosition,
  CashRisk,
  CreateExecutiveCashInsightInput,
  ExecutiveCashEvidence,
  ExecutiveCashInsight,
  ExecutiveCashInsightConfidence,
  ExecutiveCashInsightMetadata,
  ExecutiveCashSeverity,
  KeyFinding,
  RecommendedAttention,
  Urgency,
} from "./executive-cash-intelligence.types";
import {
  CashPosition as CashPositionValue,
  Urgency as UrgencyValue,
} from "./executive-cash-intelligence.types";

export function createExecutiveCashInsight(
  input: CreateExecutiveCashInsightInput,
): ExecutiveCashInsight {
  const cashPosition = determineCashPosition(input.cashForecast);
  const urgency = determineUrgency(input.cashForecast, cashPosition);
  const keyFindings = createKeyFindings(input.cashForecast);
  const risks = createRisks(input.cashForecast);
  const recommendedAttention = createRecommendedAttention(cashPosition);
  const headline = createHeadline(cashPosition, urgency);
  const summary = createSummary(input.cashForecast);
  const evidence = createEvidence(
    input.cashForecast,
    headline,
    risks,
    recommendedAttention,
  );
  const confidence = calculateConfidence(input.cashForecast, evidence);
  const metadata = createInsightMetadata(input, cashPosition, urgency, confidence);

  return freezeDomainObject({
    id: input.id,
    forecastId: input.cashForecast.id,
    generatedAt: input.generatedAt,
    cashPosition,
    urgency,
    headline,
    summary,
    keyFindings,
    risks,
    recommendedAttention,
    confidence,
    evidence,
    metadata,
  });
}

function determineCashPosition(cashForecast: CashForecast): CashPosition {
  if (hasNegativeClosingBalance(cashForecast)) {
    return CashPositionValue.Critical;
  }

  if (hasAlert(cashForecast, CashForecastAlertType.LowCashReserve)) {
    return CashPositionValue.Pressured;
  }

  if (hasAlert(cashForecast, CashForecastAlertType.HighAtRiskInflow)) {
    return CashPositionValue.Pressured;
  }

  return CashPositionValue.Stable;
}

function determineUrgency(
  cashForecast: CashForecast,
  cashPosition: CashPosition,
): Urgency {
  if (cashPosition === CashPositionValue.Critical) {
    return UrgencyValue.Immediate;
  }

  if (hasAlert(cashForecast, CashForecastAlertType.LowCashReserve)) {
    return UrgencyValue.High;
  }

  if (hasAlert(cashForecast, CashForecastAlertType.HighAtRiskInflow)) {
    return UrgencyValue.Moderate;
  }

  return UrgencyValue.Low;
}

function createHeadline(cashPosition: CashPosition, urgency: Urgency): string {
  if (
    cashPosition === CashPositionValue.Critical &&
    urgency === UrgencyValue.Immediate
  ) {
    return "Critical cash position requires immediate executive attention.";
  }

  if (cashPosition === CashPositionValue.Pressured && urgency === UrgencyValue.High) {
    return "Cash position is pressured and requires high executive attention.";
  }

  if (
    cashPosition === CashPositionValue.Pressured &&
    urgency === UrgencyValue.Moderate
  ) {
    return "Cash position is pressured by at-risk inflows.";
  }

  return "Cash position is stable and should remain under routine monitoring.";
}

function createSummary(cashForecast: CashForecast): string {
  const alertTypes = cashForecast.alerts.map((alert) => alert.type).join(", ");
  const alertStatement =
    cashForecast.alerts.length === 0
      ? "No forecast alerts were detected."
      : `Detected alerts: ${alertTypes}.`;
  const atRiskInflows = getNumericMetadata(cashForecast.metadata, "atRiskInflows");

  return [
    `Forecast ${cashForecast.id} covers ${cashForecast.startDate} to ${cashForecast.endDate}.`,
    `Opening cash is ${cashForecast.openingCashBalance}, total inflows are ${cashForecast.totalInflows}, total outflows are ${cashForecast.totalOutflows}, net cash flow is ${cashForecast.netCashFlow}, and closing cash is ${cashForecast.closingCashBalance}.`,
    `At-risk inflows total ${atRiskInflows}.`,
    alertStatement,
  ].join(" ");
}

function createKeyFindings(cashForecast: CashForecast): ReadonlyArray<KeyFinding> {
  const allPeriodIds = getPeriodIds(cashForecast.periods);
  const allSignalIds = getSignalIds(cashForecast.periods);
  const lastPeriod = cashForecast.periods[cashForecast.periods.length - 1];
  const atRiskInflows = getNumericMetadata(cashForecast.metadata, "atRiskInflows");
  const findings: KeyFinding[] = [
    {
      type: "closing_cash_balance",
      title: "Closing cash balance",
      description: `Forecast closing cash balance is ${cashForecast.closingCashBalance}.`,
      severity: getClosingBalanceSeverity(cashForecast),
      supportingPeriods: lastPeriod ? [lastPeriod.id] : [],
      supportingSignals: lastPeriod ? [...lastPeriod.signalIds] : [],
    },
    {
      type: "total_inflows",
      title: "Total inflows",
      description: `Forecast total inflows are ${cashForecast.totalInflows}.`,
      severity: "low",
      supportingPeriods: allPeriodIds,
      supportingSignals: allSignalIds,
    },
    {
      type: "total_outflows",
      title: "Total outflows",
      description: `Forecast total outflows are ${cashForecast.totalOutflows}.`,
      severity: "low",
      supportingPeriods: allPeriodIds,
      supportingSignals: allSignalIds,
    },
    {
      type: "net_cash_flow",
      title: "Net cash flow",
      description: `Forecast net cash flow is ${cashForecast.netCashFlow}.`,
      severity: cashForecast.netCashFlow < 0 ? "medium" : "low",
      supportingPeriods: allPeriodIds,
      supportingSignals: allSignalIds,
    },
  ];

  if (atRiskInflows > 0) {
    findings.push({
      type: "at_risk_inflows",
      title: "At-risk inflows",
      description: `At-risk inflows total ${atRiskInflows}.`,
      severity: hasAlert(cashForecast, CashForecastAlertType.HighAtRiskInflow)
        ? "high"
        : "medium",
      supportingPeriods: cashForecast.periods
        .filter((period) => getNumericMetadata(period.metadata, "atRiskInflows") > 0)
        .map((period) => period.id),
      supportingSignals:
        getAlert(cashForecast, CashForecastAlertType.HighAtRiskInflow)?.signalIds ??
        [],
    });
  }

  return findings;
}

function createRisks(cashForecast: CashForecast): ReadonlyArray<CashRisk> {
  return cashForecast.alerts.map((alert) => ({
    type: alert.type,
    title: getRiskTitle(alert.type),
    description: alert.message,
    severity: getRiskSeverity(alert.type),
    supportingPeriods: [...alert.periodIds],
    supportingSignals: [...alert.signalIds],
  }));
}

function createRecommendedAttention(
  cashPosition: CashPosition,
): ReadonlyArray<RecommendedAttention> {
  if (cashPosition === CashPositionValue.Critical) {
    return [
      {
        sequence: 1,
        title: "Preserve cash immediately",
        description: "Protect available cash and pause non-essential disbursements.",
        priority: "immediate",
      },
      {
        sequence: 2,
        title: "Review receivables",
        description: "Focus leadership attention on expected inflows and receipt timing.",
        priority: "immediate",
      },
      {
        sequence: 3,
        title: "Negotiate suppliers",
        description: "Review supplier disbursement timing to reduce short-term cash pressure.",
        priority: "high",
      },
    ];
  }

  if (cashPosition === CashPositionValue.Pressured) {
    return [
      {
        sequence: 1,
        title: "Monitor receivables",
        description: "Track expected inflows and at-risk receipts with executive cadence.",
        priority: "high",
      },
      {
        sequence: 2,
        title: "Review discretionary spending",
        description: "Limit non-critical spending while the forecast remains pressured.",
        priority: "moderate",
      },
      {
        sequence: 3,
        title: "Update forecast",
        description: "Refresh signal assumptions as receipt certainty changes.",
        priority: "moderate",
      },
    ];
  }

  return [
    {
      sequence: 1,
      title: "Maintain monitoring cadence",
      description: "Keep the cash forecast current and review material signal changes.",
      priority: "low",
    },
  ];
}

function createEvidence(
  cashForecast: CashForecast,
  headline: string,
  risks: ReadonlyArray<CashRisk>,
  recommendedAttention: ReadonlyArray<RecommendedAttention>,
): ReadonlyArray<ExecutiveCashEvidence> {
  const allPeriodIds = getPeriodIds(cashForecast.periods);
  const allSignalIds = getSignalIds(cashForecast.periods);
  const headlineEvidence: ExecutiveCashEvidence = {
    statement: headline,
    supportingForecastId: cashForecast.id,
    supportingPeriods: allPeriodIds,
    supportingSignals: allSignalIds,
  };
  const riskEvidence = risks.map((risk) => ({
    statement: risk.title,
    supportingForecastId: cashForecast.id,
    supportingPeriods: risk.supportingPeriods,
    supportingSignals: risk.supportingSignals,
  }));
  const recommendationEvidence = recommendedAttention.map((attention) => ({
    statement: attention.title,
    supportingForecastId: cashForecast.id,
    supportingPeriods: allPeriodIds,
    supportingSignals: allSignalIds,
  }));

  return [headlineEvidence, ...riskEvidence, ...recommendationEvidence];
}

function calculateConfidence(
  cashForecast: CashForecast,
  evidence: ReadonlyArray<ExecutiveCashEvidence>,
): ExecutiveCashInsightConfidence {
  const periodScore = cashForecast.periods.length > 0 ? 30 : 0;
  const signalIds = getSignalIds(cashForecast.periods);
  const signalScore = signalIds.length > 0 ? 30 : 0;
  const traceabilityScore = hasTraceability(cashForecast) ? 25 : 0;
  const evidenceScore = evidence.length > 0 ? 15 : 0;
  const totalInflows = cashForecast.totalInflows;
  const atRiskInflows = getNumericMetadata(cashForecast.metadata, "atRiskInflows");
  const atRiskPercentage = totalInflows > 0 ? atRiskInflows / totalInflows : 0;
  const atRiskPenalty = Math.min(25, atRiskPercentage * 25);

  return clampConfidence(
    Math.round(periodScore + signalScore + traceabilityScore + evidenceScore - atRiskPenalty),
  );
}

function createInsightMetadata(
  input: CreateExecutiveCashInsightInput,
  cashPosition: CashPosition,
  urgency: Urgency,
  confidence: ExecutiveCashInsightConfidence,
): ExecutiveCashInsightMetadata {
  return {
    ...input.cashForecast.metadata,
    ...(input.metadata ?? {}),
    executiveCashInsightId: input.id,
    forecastId: input.cashForecast.id,
    generatedAt: input.generatedAt,
    cashPosition,
    urgency,
    confidence,
    periodIds: getPeriodIds(input.cashForecast.periods),
    signalIds: getSignalIds(input.cashForecast.periods),
    alertTypes: input.cashForecast.alerts.map((alert) => alert.type).sort(),
    atRiskPercentage: calculateAtRiskPercentage(input.cashForecast),
  };
}

function getRiskTitle(type: CashForecastAlertType): string {
  switch (type) {
    case CashForecastAlertType.NegativeCashBalance:
      return "Negative cash balance";
    case CashForecastAlertType.LowCashReserve:
      return "Low cash reserve";
    case CashForecastAlertType.HighAtRiskInflow:
      return "High at-risk inflow";
    case CashForecastAlertType.NoCashSignals:
      return "No cash signals";
  }
}

function getRiskSeverity(type: CashForecastAlertType): ExecutiveCashSeverity {
  switch (type) {
    case CashForecastAlertType.NegativeCashBalance:
      return "critical";
    case CashForecastAlertType.LowCashReserve:
      return "high";
    case CashForecastAlertType.HighAtRiskInflow:
      return "medium";
    case CashForecastAlertType.NoCashSignals:
      return "medium";
  }
}

function getClosingBalanceSeverity(cashForecast: CashForecast): ExecutiveCashSeverity {
  if (cashForecast.closingCashBalance < 0) {
    return "critical";
  }

  if (hasAlert(cashForecast, CashForecastAlertType.LowCashReserve)) {
    return "high";
  }

  return "low";
}

function hasNegativeClosingBalance(cashForecast: CashForecast): boolean {
  return cashForecast.periods.some((period) => period.closingCashBalance < 0);
}

function hasAlert(cashForecast: CashForecast, type: CashForecastAlertType): boolean {
  return cashForecast.alerts.some((alert) => alert.type === type);
}

function getAlert(
  cashForecast: CashForecast,
  type: CashForecastAlertType,
): CashForecastAlert | undefined {
  return cashForecast.alerts.find((alert) => alert.type === type);
}

function getPeriodIds(
  periods: ReadonlyArray<CashForecastPeriod>,
): ReadonlyArray<CashForecastPeriodId> {
  return periods.map((period) => period.id).sort();
}

function getSignalIds(
  periods: ReadonlyArray<CashForecastPeriod>,
): ReadonlyArray<CashFlowSignalId> {
  return Array.from(new Set(periods.flatMap((period) => period.signalIds))).sort();
}

function hasTraceability(cashForecast: CashForecast): boolean {
  const sourceIds = getStringArrayMetadata(cashForecast.metadata, "sourceIds");
  const contractIds = getStringArrayMetadata(cashForecast.metadata, "contractIds");
  const projectIds = getStringArrayMetadata(cashForecast.metadata, "projectIds");
  const customerIds = getStringArrayMetadata(cashForecast.metadata, "customerIds");

  return (
    sourceIds.length > 0 &&
    contractIds.length > 0 &&
    projectIds.length > 0 &&
    customerIds.length > 0
  );
}

function calculateAtRiskPercentage(cashForecast: CashForecast): number {
  if (cashForecast.totalInflows <= 0) {
    return 0;
  }

  return getNumericMetadata(cashForecast.metadata, "atRiskInflows") /
    cashForecast.totalInflows;
}

function getNumericMetadata(
  metadata: ExecutiveCashInsightMetadata,
  field: string,
): number {
  const value = metadata[field];

  return typeof value === "number" ? value : 0;
}

function getStringArrayMetadata(
  metadata: ExecutiveCashInsightMetadata,
  field: string,
): ReadonlyArray<string> {
  const value = metadata[field];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function clampConfidence(value: number): ExecutiveCashInsightConfidence {
  return Math.max(0, Math.min(100, value));
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
