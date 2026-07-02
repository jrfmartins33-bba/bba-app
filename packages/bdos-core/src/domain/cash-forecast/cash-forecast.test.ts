import { ReceivableRiskLevel } from "../accounts-receivable";
import {
  CashFlowSignalCategory,
  CashFlowSignalCertainty,
  CashFlowSignalDirection,
  type CashFlowSignal,
} from "../cash-flow-signal";
import {
  CashForecastAlertType,
  createCashForecast,
  type CashForecastResult,
} from "./index";

const cashForecastId = "cash-forecast-8";
const contractId = "contract-baseline-lagoa-do-arroz";
const projectId = "project-lagoa-do-arroz";
const customerId = "customer-dnocs";
const correlationId = "measurement-correlation-8";

runTest("creates forecast from cash flow signals", () => {
  const result = createCashForecast(createBaseForecastInput());

  assertCashForecastSuccess(result, "expected forecast success");
  assertEqual(result.forecast.id, cashForecastId, "forecast id mismatch");
  assertEqual(result.forecast.startDate, "2026-08-01", "start date mismatch");
  assertEqual(result.forecast.endDate, "2026-08-31", "end date mismatch");
  assertEqual(result.forecast.openingCashBalance, 1000, "opening cash mismatch");
  assertEqual(result.forecast.periods.length, 2, "period count mismatch");
});

runTest("includes only signals inside range", () => {
  const result = createCashForecast({
    ...createBaseForecastInput(),
    signals: [
      createCashFlowSignalFixture({
        id: "signal-inside",
        date: "2026-08-10",
        amount: 500,
      }),
      createCashFlowSignalFixture({
        id: "signal-before",
        date: "2026-07-31",
        amount: 900,
      }),
      createCashFlowSignalFixture({
        id: "signal-after",
        date: "2026-09-01",
        amount: 900,
      }),
    ],
  });

  assertCashForecastSuccess(result, "expected forecast success");
  assertEqual(result.forecast.totalInflows, 500, "inflows mismatch");
  assertEqual(
    JSON.stringify(result.forecast.metadata["includedSignalIds"]),
    JSON.stringify(["signal-inside"]),
    "included signals mismatch",
  );
  assertEqual(result.warnings.length, 2, "outside range warning count mismatch");
});

runTest("calculates inflows and outflows", () => {
  const result = createCashForecast(createBaseForecastInput());

  assertCashForecastSuccess(result, "expected forecast success");
  assertEqual(result.forecast.totalInflows, 900, "total inflows mismatch");
  assertEqual(result.forecast.totalOutflows, 1200, "total outflows mismatch");
  assertEqual(result.forecast.netCashFlow, -300, "net cash flow mismatch");
  assertEqual(result.forecast.closingCashBalance, 700, "closing cash mismatch");
});

runTest("calculates rolling balances", () => {
  const result = createCashForecast(createBaseForecastInput());

  assertCashForecastSuccess(result, "expected forecast success");
  assertEqual(
    result.forecast.periods[0]?.openingCashBalance,
    1000,
    "period 1 opening mismatch",
  );
  assertEqual(
    result.forecast.periods[0]?.closingCashBalance,
    1300,
    "period 1 closing mismatch",
  );
  assertEqual(
    result.forecast.periods[1]?.openingCashBalance,
    1300,
    "period 2 opening mismatch",
  );
  assertEqual(
    result.forecast.periods[1]?.closingCashBalance,
    700,
    "period 2 closing mismatch",
  );
});

runTest("tracks at-risk inflows", () => {
  const result = createCashForecast(createBaseForecastInput());

  assertCashForecastSuccess(result, "expected forecast success");
  assertEqual(result.forecast.metadata["atRiskInflows"], 400, "at-risk total mismatch");
  assertEqual(
    result.forecast.periods[1]?.metadata["atRiskInflows"],
    400,
    "period at-risk mismatch",
  );
});

runTest("detects negative cash balance", () => {
  const result = createCashForecast({
    ...createBaseForecastInput(),
    openingCashBalance: 100,
  });

  assertCashForecastSuccess(result, "expected forecast success");
  assertEqual(
    hasAlert(result, CashForecastAlertType.NegativeCashBalance),
    true,
    "expected negative cash alert",
  );
});

runTest("detects low cash reserve", () => {
  const result = createCashForecast({
    ...createBaseForecastInput(),
    minimumCashReserve: 900,
  });

  assertCashForecastSuccess(result, "expected forecast success");
  assertEqual(
    hasAlert(result, CashForecastAlertType.LowCashReserve),
    true,
    "expected low reserve alert",
  );
});

runTest("detects high at-risk inflow", () => {
  const result = createCashForecast({
    ...createBaseForecastInput(),
    atRiskInflowThreshold: 300,
  });

  assertCashForecastSuccess(result, "expected forecast success");
  assertEqual(
    hasAlert(result, CashForecastAlertType.HighAtRiskInflow),
    true,
    "expected high at-risk inflow alert",
  );
});

runTest("detects no cash signals", () => {
  const result = createCashForecast({
    ...createBaseForecastInput(),
    signals: [],
  });

  assertCashForecastSuccess(result, "expected forecast success");
  assertEqual(result.forecast.totalInflows, 0, "inflows mismatch");
  assertEqual(result.forecast.totalOutflows, 0, "outflows mismatch");
  assertEqual(
    hasAlert(result, CashForecastAlertType.NoCashSignals),
    true,
    "expected no cash signals alert",
  );
});

runTest("deterministic output", () => {
  const input = createBaseForecastInput();
  const first = JSON.stringify(createCashForecast(input));
  const second = JSON.stringify(createCashForecast(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("immutable output", () => {
  const result = createCashForecast(createBaseForecastInput());

  assertCashForecastSuccess(result, "expected forecast success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.forecast), true, "forecast should be frozen");
  assertEqual(Object.isFrozen(result.forecast.periods), true, "periods should be frozen");
  assertEqual(
    Object.isFrozen(result.forecast.periods[0]),
    true,
    "period should be frozen",
  );
  assertEqual(Object.isFrozen(result.forecast.alerts), true, "alerts should be frozen");
  assertEqual(Object.isFrozen(result.forecast.metadata), true, "metadata should be frozen");
});

runTest("no business facts, decision, or executive concepts", () => {
  const result = createCashForecast(createBaseForecastInput());

  assertCashForecastSuccess(result, "expected forecast success");
  const serializedForecast = JSON.stringify(result.forecast).toLowerCase();

  assertEqual(
    serializedForecast.includes("businessfact"),
    false,
    "unexpected business fact concept",
  );
  assertEqual(
    serializedForecast.includes("business_fact"),
    false,
    "unexpected business fact concept",
  );
  assertEqual(
    serializedForecast.includes("decision"),
    false,
    "unexpected decision concept",
  );
  assertEqual(
    serializedForecast.includes("executive"),
    false,
    "unexpected executive concept",
  );
});

runTest("rejects missing forecast periods", () => {
  const result = createCashForecast({
    ...createBaseForecastInput(),
    periods: [],
  });

  assertCashForecastFailure(result, "expected missing periods failure");
  assertEqual(
    result.errors[0]?.code,
    "cash_forecast_periods_missing",
    "error code mismatch",
  );
});

function createBaseForecastInput(): Parameters<typeof createCashForecast>[0] {
  return {
    id: cashForecastId,
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    openingCashBalance: 1000,
    periods: [
      {
        id: "period-1",
        periodStart: "2026-08-01",
        periodEnd: "2026-08-15",
        metadata: {
          label: "first half",
        },
      },
      {
        id: "period-2",
        periodStart: "2026-08-16",
        periodEnd: "2026-08-31",
        metadata: {
          label: "second half",
        },
      },
    ],
    signals: [
      createCashFlowSignalFixture({
        id: "signal-inflow-1",
        date: "2026-08-10",
        amount: 500,
        direction: CashFlowSignalDirection.Inflow,
        certainty: CashFlowSignalCertainty.Expected,
      }),
      createCashFlowSignalFixture({
        id: "signal-outflow-1",
        sourceId: "payable-1",
        date: "2026-08-12",
        amount: 200,
        direction: CashFlowSignalDirection.Outflow,
        category: CashFlowSignalCategory.Payable,
      }),
      createCashFlowSignalFixture({
        id: "signal-inflow-2",
        date: "2026-08-20",
        amount: 400,
        direction: CashFlowSignalDirection.Inflow,
        certainty: CashFlowSignalCertainty.AtRisk,
      }),
      createCashFlowSignalFixture({
        id: "signal-outflow-2",
        sourceId: "payroll-1",
        date: "2026-08-25",
        amount: 1000,
        direction: CashFlowSignalDirection.Outflow,
        category: CashFlowSignalCategory.Payroll,
      }),
    ],
    minimumCashReserve: 500,
    atRiskInflowThreshold: 500,
    metadata: {
      correlationId,
      source: "cash-forecast-engine",
    },
  };
}

function createCashFlowSignalFixture(
  overrides: Partial<CashFlowSignal> = {},
): CashFlowSignal {
  const id = overrides.id ?? "signal-1";

  return {
    id,
    sourceType: overrides.sourceType ?? "accounts_receivable",
    sourceId: overrides.sourceId ?? `source-${id}`,
    contractId: overrides.contractId ?? contractId,
    projectId: overrides.projectId ?? projectId,
    customerId: overrides.customerId ?? customerId,
    date: overrides.date ?? "2026-08-10",
    direction: overrides.direction ?? CashFlowSignalDirection.Inflow,
    amount: overrides.amount ?? 500,
    currency: overrides.currency ?? "BRL",
    category: overrides.category ?? CashFlowSignalCategory.Receivable,
    certainty: overrides.certainty ?? CashFlowSignalCertainty.Expected,
    riskLevel: overrides.riskLevel ?? ReceivableRiskLevel.Low,
    metadata: overrides.metadata ?? {
      correlationId,
      invoiceId: "invoice-8",
      accountsReceivableId: "accounts-receivable-8",
    },
  };
}

function hasAlert(
  result: Extract<CashForecastResult, { readonly success: true }>,
  type: CashForecastAlertType,
): boolean {
  return result.forecast.alerts.some((alert) => alert.type === type);
}

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertCashForecastSuccess(
  result: CashForecastResult,
  message: string,
): asserts result is Extract<CashForecastResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertCashForecastFailure(
  result: CashForecastResult,
  message: string,
): asserts result is Extract<CashForecastResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
