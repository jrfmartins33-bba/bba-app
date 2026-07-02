import type { MeasurementDate, MeasurementMetadata } from "../measurement";
import type { CashFlowSignal, CashFlowSignalId } from "../cash-flow-signal";

export type CashForecastId = string;

export type CashForecastPeriodId = string;

export type CashForecastMetadata = MeasurementMetadata;

export enum CashForecastAlertType {
  NegativeCashBalance = "NEGATIVE_CASH_BALANCE",
  LowCashReserve = "LOW_CASH_RESERVE",
  HighAtRiskInflow = "HIGH_AT_RISK_INFLOW",
  NoCashSignals = "NO_CASH_SIGNALS",
}

export interface CashForecastAlert {
  readonly type: CashForecastAlertType;
  readonly message: string;
  readonly periodIds: ReadonlyArray<CashForecastPeriodId>;
  readonly signalIds: ReadonlyArray<CashFlowSignalId>;
  readonly metadata: CashForecastMetadata;
}

export interface CashForecastPeriod {
  readonly id: CashForecastPeriodId;
  readonly periodStart: MeasurementDate;
  readonly periodEnd: MeasurementDate;
  readonly openingCashBalance: number;
  readonly inflows: number;
  readonly outflows: number;
  readonly netCashFlow: number;
  readonly closingCashBalance: number;
  readonly signalIds: ReadonlyArray<CashFlowSignalId>;
  readonly metadata: CashForecastMetadata;
}

export interface CashForecast {
  readonly id: CashForecastId;
  readonly startDate: MeasurementDate;
  readonly endDate: MeasurementDate;
  readonly openingCashBalance: number;
  readonly closingCashBalance: number;
  readonly totalInflows: number;
  readonly totalOutflows: number;
  readonly netCashFlow: number;
  readonly periods: ReadonlyArray<CashForecastPeriod>;
  readonly alerts: ReadonlyArray<CashForecastAlert>;
  readonly metadata: CashForecastMetadata;
}

export interface CashForecastPeriodInput {
  readonly id: CashForecastPeriodId;
  readonly periodStart: MeasurementDate;
  readonly periodEnd: MeasurementDate;
  readonly metadata?: CashForecastMetadata;
}

export interface CreateCashForecastInput {
  readonly id: CashForecastId;
  readonly startDate: MeasurementDate;
  readonly endDate: MeasurementDate;
  readonly openingCashBalance: number;
  readonly periods: ReadonlyArray<CashForecastPeriodInput>;
  readonly signals: ReadonlyArray<CashFlowSignal>;
  readonly minimumCashReserve: number;
  readonly atRiskInflowThreshold?: number;
  readonly metadata?: CashForecastMetadata;
}

export type CashForecastErrorCode =
  | "cash_forecast_periods_missing"
  | "invalid_cash_forecast_range";

export interface CashForecastError {
  readonly code: CashForecastErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: CashForecastMetadata;
}

export type CashForecastWarningCode = "signal_outside_forecast_range";

export interface CashForecastWarning {
  readonly code: CashForecastWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: CashForecastMetadata;
}

export interface CashForecastSuccess {
  readonly success: true;
  readonly forecast: CashForecast;
  readonly errors: ReadonlyArray<CashForecastError>;
  readonly warnings: ReadonlyArray<CashForecastWarning>;
  readonly metadata: CashForecastMetadata;
}

export interface CashForecastFailure {
  readonly success: false;
  readonly forecast: null;
  readonly errors: ReadonlyArray<CashForecastError>;
  readonly warnings: ReadonlyArray<CashForecastWarning>;
  readonly metadata: CashForecastMetadata;
}

export type CashForecastResult = CashForecastSuccess | CashForecastFailure;
