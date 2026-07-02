import {
  CashFlowSignalCertainty,
  CashFlowSignalDirection,
  type CashFlowSignal,
  type CashFlowSignalId,
} from "../cash-flow-signal";
import type {
  CashForecast,
  CashForecastAlert,
  CashForecastError,
  CashForecastMetadata,
  CashForecastPeriod,
  CashForecastPeriodId,
  CashForecastPeriodInput,
  CashForecastResult,
  CashForecastSuccess,
  CashForecastWarning,
  CreateCashForecastInput,
} from "./cash-forecast.types";
import { CashForecastAlertType } from "./cash-forecast.types";

const DEFAULT_AT_RISK_INFLOW_THRESHOLD = 0;

export function createCashForecast(
  input: CreateCashForecastInput,
): CashForecastResult {
  const metadata = createCashForecastMetadata(input);
  const errors = validateCashForecastInput(input, metadata);
  const warnings = createCashForecastWarnings(input, metadata);

  if (errors.length > 0) {
    return freezeDomainObject({
      success: false,
      forecast: null,
      errors,
      warnings,
      metadata,
    });
  }

  return freezeDomainObject<CashForecastSuccess>({
    success: true,
    forecast: buildCashForecast(input, metadata),
    errors: [],
    warnings,
    metadata,
  });
}

function buildCashForecast(
  input: CreateCashForecastInput,
  metadata: CashForecastMetadata,
): CashForecast {
  const includedSignals = getSignalsInsideForecastRange(input);
  const periods = createCashForecastPeriods(input, includedSignals);
  const totalInflows = periods.reduce((total, period) => total + period.inflows, 0);
  const totalOutflows = periods.reduce((total, period) => total + period.outflows, 0);
  const netCashFlow = totalInflows - totalOutflows;
  const closingCashBalance = input.openingCashBalance + netCashFlow;
  const alerts = createCashForecastAlerts(input, periods, includedSignals);

  return {
    id: input.id,
    startDate: input.startDate,
    endDate: input.endDate,
    openingCashBalance: input.openingCashBalance,
    closingCashBalance,
    totalInflows,
    totalOutflows,
    netCashFlow,
    periods,
    alerts,
    metadata: {
      ...metadata,
      includedSignalIds: includedSignals.map((signal) => signal.id).sort(),
      atRiskInflows: calculateAtRiskInflows(includedSignals),
      sourceTypes: uniqueSorted(includedSignals.map((signal) => signal.sourceType)),
      sourceIds: uniqueSorted(includedSignals.map((signal) => signal.sourceId)),
      contractIds: uniqueSorted(includedSignals.map((signal) => signal.contractId)),
      projectIds: uniqueSorted(includedSignals.map((signal) => signal.projectId)),
      customerIds: uniqueSorted(includedSignals.map((signal) => signal.customerId)),
    },
  };
}

function createCashForecastPeriods(
  input: CreateCashForecastInput,
  includedSignals: ReadonlyArray<CashFlowSignal>,
): ReadonlyArray<CashForecastPeriod> {
  let openingCashBalance = input.openingCashBalance;

  return input.periods.map((period) => {
    const periodSignals = includedSignals.filter((signal) =>
      isDateInsideRange(signal.date, period.periodStart, period.periodEnd),
    );
    const inflows = sumSignalsByDirection(
      periodSignals,
      CashFlowSignalDirection.Inflow,
    );
    const outflows = sumSignalsByDirection(
      periodSignals,
      CashFlowSignalDirection.Outflow,
    );
    const netCashFlow = inflows - outflows;
    const closingCashBalance = openingCashBalance + netCashFlow;
    const signalIds = periodSignals.map((signal) => signal.id).sort();
    const forecastPeriod: CashForecastPeriod = {
      id: period.id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      openingCashBalance,
      inflows,
      outflows,
      netCashFlow,
      closingCashBalance,
      signalIds,
      metadata: {
        ...(period.metadata ?? {}),
        signalIds,
        atRiskInflows: calculateAtRiskInflows(periodSignals),
        sourceTypes: uniqueSorted(periodSignals.map((signal) => signal.sourceType)),
        sourceIds: uniqueSorted(periodSignals.map((signal) => signal.sourceId)),
        contractIds: uniqueSorted(periodSignals.map((signal) => signal.contractId)),
        projectIds: uniqueSorted(periodSignals.map((signal) => signal.projectId)),
        customerIds: uniqueSorted(periodSignals.map((signal) => signal.customerId)),
      },
    };

    openingCashBalance = closingCashBalance;

    return forecastPeriod;
  });
}

function createCashForecastAlerts(
  input: CreateCashForecastInput,
  periods: ReadonlyArray<CashForecastPeriod>,
  includedSignals: ReadonlyArray<CashFlowSignal>,
): ReadonlyArray<CashForecastAlert> {
  const alerts: CashForecastAlert[] = [];
  const negativePeriods = periods.filter((period) => period.closingCashBalance < 0);
  const lowReservePeriods = periods.filter(
    (period) => period.closingCashBalance < input.minimumCashReserve,
  );
  const atRiskInflows = calculateAtRiskInflows(includedSignals);
  const atRiskThreshold =
    input.atRiskInflowThreshold ?? DEFAULT_AT_RISK_INFLOW_THRESHOLD;
  const atRiskSignalIds = includedSignals
    .filter(
      (signal) =>
        signal.direction === CashFlowSignalDirection.Inflow &&
        signal.certainty === CashFlowSignalCertainty.AtRisk,
    )
    .map((signal) => signal.id)
    .sort();

  if (includedSignals.length === 0) {
    alerts.push(
      createCashForecastAlert(
        CashForecastAlertType.NoCashSignals,
        "No cash flow signals were included in the forecast range.",
        [],
        [],
        {
          startDate: input.startDate,
          endDate: input.endDate,
        },
      ),
    );
  }

  if (negativePeriods.length > 0) {
    alerts.push(
      createCashForecastAlert(
        CashForecastAlertType.NegativeCashBalance,
        "At least one forecast period closes with negative cash balance.",
        negativePeriods.map((period) => period.id),
        uniqueSorted(negativePeriods.flatMap((period) => period.signalIds)),
        {
          minimumClosingCashBalance: Math.min(
            ...negativePeriods.map((period) => period.closingCashBalance),
          ),
        },
      ),
    );
  }

  if (lowReservePeriods.length > 0) {
    alerts.push(
      createCashForecastAlert(
        CashForecastAlertType.LowCashReserve,
        "At least one forecast period closes below the minimum cash reserve.",
        lowReservePeriods.map((period) => period.id),
        uniqueSorted(lowReservePeriods.flatMap((period) => period.signalIds)),
        {
          minimumCashReserve: input.minimumCashReserve,
          minimumClosingCashBalance: Math.min(
            ...lowReservePeriods.map((period) => period.closingCashBalance),
          ),
        },
      ),
    );
  }

  if (atRiskInflows > atRiskThreshold) {
    alerts.push(
      createCashForecastAlert(
        CashForecastAlertType.HighAtRiskInflow,
        "At-risk inflows exceed the configured threshold.",
        periods
          .filter((period) => Number(period.metadata["atRiskInflows"] ?? 0) > 0)
          .map((period) => period.id),
        atRiskSignalIds,
        {
          atRiskInflows,
          atRiskInflowThreshold: atRiskThreshold,
        },
      ),
    );
  }

  return alerts;
}

function validateCashForecastInput(
  input: CreateCashForecastInput,
  metadata: CashForecastMetadata,
): ReadonlyArray<CashForecastError> {
  const errors: CashForecastError[] = [];

  if (input.periods.length === 0) {
    errors.push(
      createCashForecastError(
        "cash_forecast_periods_missing",
        "periods",
        "Cash forecast periods must be provided by input.",
        metadata,
      ),
    );
  }

  if (input.startDate > input.endDate) {
    errors.push(
      createCashForecastError(
        "invalid_cash_forecast_range",
        "startDate",
        "Cash forecast startDate cannot be after endDate.",
        metadata,
      ),
    );
  }

  return errors;
}

function createCashForecastWarnings(
  input: CreateCashForecastInput,
  metadata: CashForecastMetadata,
): ReadonlyArray<CashForecastWarning> {
  return input.signals
    .filter(
      (signal) => !isDateInsideRange(signal.date, input.startDate, input.endDate),
    )
    .map((signal) => ({
      code: "signal_outside_forecast_range",
      field: "signals",
      message: "Cash flow signal is outside the forecast range and was excluded.",
      metadata: {
        ...metadata,
        signalId: signal.id,
        signalDate: signal.date,
      },
    }));
}

function createCashForecastAlert(
  type: CashForecastAlertType,
  message: string,
  periodIds: ReadonlyArray<CashForecastPeriodId>,
  signalIds: ReadonlyArray<CashFlowSignalId>,
  metadata: CashForecastMetadata,
): CashForecastAlert {
  return {
    type,
    message,
    periodIds: [...periodIds].sort(),
    signalIds: [...signalIds].sort(),
    metadata,
  };
}

function createCashForecastError(
  code: CashForecastError["code"],
  field: string,
  message: string,
  metadata: CashForecastMetadata,
): CashForecastError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function getSignalsInsideForecastRange(
  input: CreateCashForecastInput,
): ReadonlyArray<CashFlowSignal> {
  return input.signals
    .filter((signal) =>
      isDateInsideRange(signal.date, input.startDate, input.endDate),
    )
    .sort((first, second) => {
      if (first.date !== second.date) {
        return first.date.localeCompare(second.date);
      }

      return first.id.localeCompare(second.id);
    });
}

function isDateInsideRange(
  date: string,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  return date >= rangeStart && date <= rangeEnd;
}

function sumSignalsByDirection(
  signals: ReadonlyArray<CashFlowSignal>,
  direction: CashFlowSignalDirection,
): number {
  return signals
    .filter((signal) => signal.direction === direction)
    .reduce((total, signal) => total + signal.amount, 0);
}

function calculateAtRiskInflows(signals: ReadonlyArray<CashFlowSignal>): number {
  return signals
    .filter(
      (signal) =>
        signal.direction === CashFlowSignalDirection.Inflow &&
        signal.certainty === CashFlowSignalCertainty.AtRisk,
    )
    .reduce((total, signal) => total + signal.amount, 0);
}

function createCashForecastMetadata(
  input: CreateCashForecastInput,
): CashForecastMetadata {
  return {
    ...(input.metadata ?? {}),
    cashForecastId: input.id,
    startDate: input.startDate,
    endDate: input.endDate,
    signalIds: input.signals.map((signal) => signal.id).sort(),
    minimumCashReserve: input.minimumCashReserve,
    atRiskInflowThreshold:
      input.atRiskInflowThreshold ?? DEFAULT_AT_RISK_INFLOW_THRESHOLD,
  };
}

function uniqueSorted(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return Array.from(new Set(values)).sort();
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
