import {
  CashForecastAlertType,
  type CashForecast,
  type CashForecastAlert,
  type CashForecastPeriod,
} from "../cash-forecast";
import {
  CashPosition,
  Urgency,
  createExecutiveCashInsight,
  type ExecutiveCashInsight,
} from "./index";

const insightId = "executive-cash-insight-8";
const forecastId = "cash-forecast-8";
const generatedAt = "2026-08-31";
const correlationId = "measurement-correlation-8";

runTest("creates executive cash insight", () => {
  const insight = createExecutiveCashInsight({
    cashForecast: createStableForecastFixture(),
    id: insightId,
    generatedAt,
    metadata: {
      source: "cash-leadership-review",
    },
  });

  assertEqual(insight.id, insightId, "insight id mismatch");
  assertEqual(insight.forecastId, forecastId, "forecast id mismatch");
  assertEqual(insight.generatedAt, generatedAt, "generatedAt mismatch");
  assertEqual(insight.cashPosition, CashPosition.Stable, "cash position mismatch");
  assertEqual(insight.urgency, Urgency.Low, "urgency mismatch");
});

runTest("detects critical position from negative cash balance", () => {
  const insight = createExecutiveCashInsight({
    cashForecast: createCriticalForecastFixture(),
    id: insightId,
    generatedAt,
  });

  assertEqual(insight.cashPosition, CashPosition.Critical, "cash position mismatch");
  assertEqual(insight.urgency, Urgency.Immediate, "urgency mismatch");
  assertEqual(
    hasRisk(insight, CashForecastAlertType.NegativeCashBalance),
    true,
    "expected negative cash risk",
  );
});

runTest("detects pressured position from low reserve", () => {
  const insight = createExecutiveCashInsight({
    cashForecast: createLowReserveForecastFixture(),
    id: insightId,
    generatedAt,
  });

  assertEqual(insight.cashPosition, CashPosition.Pressured, "cash position mismatch");
  assertEqual(insight.urgency, Urgency.High, "urgency mismatch");
});

runTest("detects pressured position from high at-risk inflow", () => {
  const insight = createExecutiveCashInsight({
    cashForecast: createHighAtRiskForecastFixture(),
    id: insightId,
    generatedAt,
  });

  assertEqual(insight.cashPosition, CashPosition.Pressured, "cash position mismatch");
  assertEqual(insight.urgency, Urgency.Moderate, "urgency mismatch");
});

runTest("detects stable position", () => {
  const insight = createExecutiveCashInsight({
    cashForecast: createStableForecastFixture(),
    id: insightId,
    generatedAt,
  });

  assertEqual(insight.cashPosition, CashPosition.Stable, "cash position mismatch");
  assertEqual(insight.urgency, Urgency.Low, "urgency mismatch");
});

runTest("generates deterministic headline", () => {
  const first = createExecutiveCashInsight({
    cashForecast: createCriticalForecastFixture(),
    id: insightId,
    generatedAt,
  });
  const second = createExecutiveCashInsight({
    cashForecast: createCriticalForecastFixture(),
    id: insightId,
    generatedAt,
  });

  assertEqual(first.headline, second.headline, "headline should be deterministic");
  assertEqual(
    first.headline,
    "Critical cash position requires immediate executive attention.",
    "headline mismatch",
  );
});

runTest("keeps summary under 150 words", () => {
  const insight = createExecutiveCashInsight({
    cashForecast: createHighAtRiskForecastFixture(),
    id: insightId,
    generatedAt,
  });

  assertEqual(wordCount(insight.summary) <= 150, true, "summary should be concise");
});

runTest("creates key findings", () => {
  const insight = createExecutiveCashInsight({
    cashForecast: createHighAtRiskForecastFixture(),
    id: insightId,
    generatedAt,
  });

  assertEqual(hasFinding(insight, "closing_cash_balance"), true, "missing closing");
  assertEqual(hasFinding(insight, "total_inflows"), true, "missing inflows");
  assertEqual(hasFinding(insight, "total_outflows"), true, "missing outflows");
  assertEqual(hasFinding(insight, "net_cash_flow"), true, "missing net cash");
  assertEqual(hasFinding(insight, "at_risk_inflows"), true, "missing at-risk");
});

runTest("creates risks from forecast alerts", () => {
  const insight = createExecutiveCashInsight({
    cashForecast: createCriticalForecastFixture(),
    id: insightId,
    generatedAt,
  });

  assertEqual(
    hasRisk(insight, CashForecastAlertType.NegativeCashBalance),
    true,
    "missing negative risk",
  );
  assertEqual(
    hasRisk(insight, CashForecastAlertType.LowCashReserve),
    true,
    "missing low reserve risk",
  );
});

runTest("creates recommended attention", () => {
  const critical = createExecutiveCashInsight({
    cashForecast: createCriticalForecastFixture(),
    id: insightId,
    generatedAt,
  });
  const pressured = createExecutiveCashInsight({
    cashForecast: createLowReserveForecastFixture(),
    id: insightId,
    generatedAt,
  });
  const stable = createExecutiveCashInsight({
    cashForecast: createStableForecastFixture(),
    id: insightId,
    generatedAt,
  });

  assertEqual(critical.recommendedAttention.length, 3, "critical attention mismatch");
  assertEqual(
    critical.recommendedAttention[0]?.title,
    "Preserve cash immediately",
    "critical attention title mismatch",
  );
  assertEqual(pressured.recommendedAttention.length, 3, "pressured attention mismatch");
  assertEqual(stable.recommendedAttention.length, 1, "stable attention mismatch");
});

runTest("calculates confidence deterministically", () => {
  const stable = createExecutiveCashInsight({
    cashForecast: createStableForecastFixture(),
    id: insightId,
    generatedAt,
  });
  const highAtRisk = createExecutiveCashInsight({
    cashForecast: createHighAtRiskForecastFixture(),
    id: insightId,
    generatedAt,
  });

  assertEqual(stable.confidence, 100, "stable confidence mismatch");
  assertEqual(highAtRisk.confidence < stable.confidence, true, "at-risk penalty missing");
  assertEqual(highAtRisk.confidence, 89, "high at-risk confidence mismatch");
});

runTest("preserves evidence and traceability", () => {
  const insight = createExecutiveCashInsight({
    cashForecast: createCriticalForecastFixture(),
    id: insightId,
    generatedAt,
    metadata: {
      reviewedBy: "cfo",
    },
  });

  assertEqual(insight.evidence.length > 0, true, "evidence missing");
  assertEqual(
    insight.evidence.every((evidence) => evidence.supportingForecastId === forecastId),
    true,
    "forecast evidence mismatch",
  );
  assertEqual(
    JSON.stringify(insight.metadata["periodIds"]),
    JSON.stringify(["period-1", "period-2"]),
    "period traceability mismatch",
  );
  assertEqual(
    JSON.stringify(insight.metadata["signalIds"]),
    JSON.stringify(["signal-inflow-1", "signal-outflow-1", "signal-outflow-2"]),
    "signal traceability mismatch",
  );
  assertEqual(insight.metadata["correlationId"], correlationId, "correlation mismatch");
  assertEqual(insight.metadata["reviewedBy"], "cfo", "metadata preservation mismatch");
});

runTest("deterministic output", () => {
  const input = {
    cashForecast: createHighAtRiskForecastFixture(),
    id: insightId,
    generatedAt,
    metadata: {
      reviewedBy: "cfo",
    },
  };

  const first = JSON.stringify(createExecutiveCashInsight(input));
  const second = JSON.stringify(createExecutiveCashInsight(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("immutable output", () => {
  const insight = createExecutiveCashInsight({
    cashForecast: createStableForecastFixture(),
    id: insightId,
    generatedAt,
  });

  assertEqual(Object.isFrozen(insight), true, "insight should be frozen");
  assertEqual(Object.isFrozen(insight.keyFindings), true, "findings should be frozen");
  assertEqual(Object.isFrozen(insight.keyFindings[0]), true, "finding should be frozen");
  assertEqual(Object.isFrozen(insight.risks), true, "risks should be frozen");
  assertEqual(
    Object.isFrozen(insight.recommendedAttention),
    true,
    "attention should be frozen",
  );
  assertEqual(Object.isFrozen(insight.evidence), true, "evidence should be frozen");
  assertEqual(Object.isFrozen(insight.metadata), true, "metadata should be frozen");
});

runTest("no business facts, decision, or brief concepts", () => {
  const insight = createExecutiveCashInsight({
    cashForecast: createStableForecastFixture(),
    id: insightId,
    generatedAt,
  });
  const serializedInsight = JSON.stringify(insight).toLowerCase();

  assertEqual(
    serializedInsight.includes("businessfact"),
    false,
    "unexpected business fact concept",
  );
  assertEqual(
    serializedInsight.includes("business_fact"),
    false,
    "unexpected business fact concept",
  );
  assertEqual(
    serializedInsight.includes("decision"),
    false,
    "unexpected decision concept",
  );
  assertEqual(serializedInsight.includes("brief"), false, "unexpected brief concept");
});

function createStableForecastFixture(): CashForecast {
  return createForecastFixture({
    closingCashBalance: 1700,
    totalInflows: 900,
    totalOutflows: 200,
    netCashFlow: 700,
    periods: [
      createPeriodFixture({
        id: "period-1",
        openingCashBalance: 1000,
        inflows: 500,
        outflows: 200,
        closingCashBalance: 1300,
        signalIds: ["signal-inflow-1", "signal-outflow-1"],
      }),
      createPeriodFixture({
        id: "period-2",
        openingCashBalance: 1300,
        inflows: 400,
        outflows: 0,
        closingCashBalance: 1700,
        signalIds: ["signal-inflow-2"],
      }),
    ],
    alerts: [],
    metadata: createForecastMetadata({
      includedSignalIds: ["signal-inflow-1", "signal-inflow-2", "signal-outflow-1"],
      atRiskInflows: 0,
    }),
  });
}

function createCriticalForecastFixture(): CashForecast {
  const negativeAlert = createAlertFixture({
    type: CashForecastAlertType.NegativeCashBalance,
    periodIds: ["period-2"],
    signalIds: ["signal-outflow-2"],
  });
  const reserveAlert = createAlertFixture({
    type: CashForecastAlertType.LowCashReserve,
    periodIds: ["period-2"],
    signalIds: ["signal-outflow-2"],
  });

  return createForecastFixture({
    closingCashBalance: -300,
    totalInflows: 500,
    totalOutflows: 1800,
    netCashFlow: -1300,
    periods: [
      createPeriodFixture({
        id: "period-1",
        openingCashBalance: 1000,
        inflows: 500,
        outflows: 200,
        closingCashBalance: 1300,
        signalIds: ["signal-inflow-1", "signal-outflow-1"],
      }),
      createPeriodFixture({
        id: "period-2",
        openingCashBalance: 1300,
        inflows: 0,
        outflows: 1600,
        closingCashBalance: -300,
        signalIds: ["signal-outflow-2"],
      }),
    ],
    alerts: [negativeAlert, reserveAlert],
    metadata: createForecastMetadata({
      includedSignalIds: ["signal-inflow-1", "signal-outflow-1", "signal-outflow-2"],
      atRiskInflows: 0,
    }),
  });
}

function createLowReserveForecastFixture(): CashForecast {
  return createForecastFixture({
    closingCashBalance: 450,
    totalInflows: 500,
    totalOutflows: 1050,
    netCashFlow: -550,
    periods: [
      createPeriodFixture({
        id: "period-1",
        openingCashBalance: 1000,
        inflows: 500,
        outflows: 1050,
        closingCashBalance: 450,
        signalIds: ["signal-inflow-1", "signal-outflow-1"],
      }),
    ],
    alerts: [
      createAlertFixture({
        type: CashForecastAlertType.LowCashReserve,
        periodIds: ["period-1"],
        signalIds: ["signal-inflow-1", "signal-outflow-1"],
      }),
    ],
    metadata: createForecastMetadata({
      includedSignalIds: ["signal-inflow-1", "signal-outflow-1"],
      atRiskInflows: 0,
    }),
  });
}

function createHighAtRiskForecastFixture(): CashForecast {
  return createForecastFixture({
    closingCashBalance: 1700,
    totalInflows: 900,
    totalOutflows: 200,
    netCashFlow: 700,
    periods: [
      createPeriodFixture({
        id: "period-1",
        openingCashBalance: 1000,
        inflows: 500,
        outflows: 200,
        closingCashBalance: 1300,
        signalIds: ["signal-inflow-1", "signal-outflow-1"],
      }),
      createPeriodFixture({
        id: "period-2",
        openingCashBalance: 1300,
        inflows: 400,
        outflows: 0,
        closingCashBalance: 1700,
        signalIds: ["signal-inflow-2"],
        metadata: {
          atRiskInflows: 400,
        },
      }),
    ],
    alerts: [
      createAlertFixture({
        type: CashForecastAlertType.HighAtRiskInflow,
        periodIds: ["period-2"],
        signalIds: ["signal-inflow-2"],
      }),
    ],
    metadata: createForecastMetadata({
      includedSignalIds: ["signal-inflow-1", "signal-inflow-2", "signal-outflow-1"],
      atRiskInflows: 400,
    }),
  });
}

function createForecastFixture(
  overrides: Partial<CashForecast> = {},
): CashForecast {
  return {
    id: overrides.id ?? forecastId,
    startDate: overrides.startDate ?? "2026-08-01",
    endDate: overrides.endDate ?? "2026-08-31",
    openingCashBalance: overrides.openingCashBalance ?? 1000,
    closingCashBalance: overrides.closingCashBalance ?? 1700,
    totalInflows: overrides.totalInflows ?? 900,
    totalOutflows: overrides.totalOutflows ?? 200,
    netCashFlow: overrides.netCashFlow ?? 700,
    periods: overrides.periods ?? [],
    alerts: overrides.alerts ?? [],
    metadata: overrides.metadata ?? createForecastMetadata(),
  };
}

function createPeriodFixture(
  overrides: Partial<CashForecastPeriod> = {},
): CashForecastPeriod {
  const id = overrides.id ?? "period-1";

  return {
    id,
    periodStart: overrides.periodStart ?? "2026-08-01",
    periodEnd: overrides.periodEnd ?? "2026-08-15",
    openingCashBalance: overrides.openingCashBalance ?? 1000,
    inflows: overrides.inflows ?? 500,
    outflows: overrides.outflows ?? 200,
    netCashFlow: overrides.netCashFlow ?? 300,
    closingCashBalance: overrides.closingCashBalance ?? 1300,
    signalIds: overrides.signalIds ?? ["signal-inflow-1", "signal-outflow-1"],
    metadata: overrides.metadata ?? {
      signalIds: overrides.signalIds ?? ["signal-inflow-1", "signal-outflow-1"],
      atRiskInflows: 0,
      sourceTypes: ["accounts_receivable"],
      sourceIds: ["accounts-receivable-8"],
      contractIds: ["contract-baseline-lagoa-do-arroz"],
      projectIds: ["project-lagoa-do-arroz"],
      customerIds: ["customer-dnocs"],
    },
  };
}

function createAlertFixture(
  overrides: Partial<CashForecastAlert>,
): CashForecastAlert {
  const type = overrides.type ?? CashForecastAlertType.LowCashReserve;

  return {
    type,
    message: overrides.message ?? `Alert ${type}`,
    periodIds: overrides.periodIds ?? ["period-1"],
    signalIds: overrides.signalIds ?? ["signal-inflow-1"],
    metadata: overrides.metadata ?? {},
  };
}

function createForecastMetadata(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    correlationId,
    cashForecastId: forecastId,
    minimumCashReserve: 500,
    sourceTypes: ["accounts_receivable"],
    sourceIds: ["accounts-receivable-8"],
    contractIds: ["contract-baseline-lagoa-do-arroz"],
    projectIds: ["project-lagoa-do-arroz"],
    customerIds: ["customer-dnocs"],
    includedSignalIds: ["signal-inflow-1"],
    atRiskInflows: 0,
    ...overrides,
  };
}

function hasFinding(insight: ExecutiveCashInsight, type: string): boolean {
  return insight.keyFindings.some((finding) => finding.type === type);
}

function hasRisk(insight: ExecutiveCashInsight, type: CashForecastAlertType): boolean {
  return insight.risks.some((risk) => risk.type === type);
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
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
