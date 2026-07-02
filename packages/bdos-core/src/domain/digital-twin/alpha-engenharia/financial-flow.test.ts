import type {
  AlphaAccountsReceivable,
  AlphaCashFlowSignal,
  AlphaEngenhariaMeasurement,
  AlphaInvoice,
} from "./index";
import {
  alphaEngenhariaDigitalTwin,
  createMeasurementFinancialFlow,
} from "./index";

const measurement = findById(
  alphaEngenhariaDigitalTwin.measurements,
  "alpha-measure-serra-azul-2026-02",
);
const invoice = findById(
  alphaEngenhariaDigitalTwin.invoices,
  "alpha-invoice-serra-azul-002",
);
const accountsReceivable = findById(
  alphaEngenhariaDigitalTwin.accountsReceivables,
  "alpha-ar-serra-azul-002",
);
const cashFlowSignal = findById(
  alphaEngenhariaDigitalTwin.cashFlowSignals,
  "alpha-cash-signal-serra-azul-002",
);

runTest("creates financial flow from measurement", () => {
  const result = createMeasurementFinancialFlow({
    measurement,
    invoice,
    accountsReceivable,
    cashFlowSignal,
  });

  assertSuccess(result, "expected valid financial flow");
  assertEqual(
    result.financialFlow.measurement.id,
    measurement.id,
    "measurement mismatch",
  );
  assertEqual(result.financialFlow.invoice.id, invoice.id, "invoice mismatch");
});

runTest("preserves measurement to invoice traceability", () => {
  const result = createMeasurementFinancialFlow({
    measurement,
    invoice,
    accountsReceivable,
    cashFlowSignal,
  });

  assertSuccess(result, "expected valid financial flow");
  assertEqual(
    result.financialFlow.invoice.measurementId,
    result.financialFlow.measurement.id,
    "invoice measurement trace mismatch",
  );
  assertEqual(
    result.financialFlow.invoice.contractId,
    result.financialFlow.measurement.contractId,
    "invoice contract trace mismatch",
  );
  assertEqual(
    result.financialFlow.invoice.projectId,
    result.financialFlow.measurement.projectId,
    "invoice project trace mismatch",
  );
});

runTest("preserves invoice to accounts receivable traceability", () => {
  const result = createMeasurementFinancialFlow({
    measurement,
    invoice,
    accountsReceivable,
    cashFlowSignal,
  });

  assertSuccess(result, "expected valid financial flow");
  assertEqual(
    result.financialFlow.accountsReceivable.invoiceId,
    result.financialFlow.invoice.id,
    "accounts receivable invoice trace mismatch",
  );
});

runTest("preserves accounts receivable to cash flow signal traceability", () => {
  const result = createMeasurementFinancialFlow({
    measurement,
    invoice,
    accountsReceivable,
    cashFlowSignal,
  });

  assertSuccess(result, "expected valid financial flow");
  assertEqual(
    result.financialFlow.cashFlowSignal.sourceType,
    "accounts_receivable",
    "cash flow source type mismatch",
  );
  assertEqual(
    result.financialFlow.cashFlowSignal.sourceId,
    result.financialFlow.accountsReceivable.id,
    "cash flow source trace mismatch",
  );
});

runTest("validates amount consistency", () => {
  const result = createMeasurementFinancialFlow({
    measurement,
    invoice,
    accountsReceivable,
    cashFlowSignal,
  });

  assertSuccess(result, "expected valid financial flow");
  assertEqual(
    result.financialFlow.invoice.netAmount,
    result.financialFlow.accountsReceivable.amount,
    "invoice and accounts receivable amount mismatch",
  );
  assertEqual(
    result.financialFlow.accountsReceivable.amount,
    result.financialFlow.cashFlowSignal.amount,
    "accounts receivable and cash flow amount mismatch",
  );
});

runTest("supports at-risk cash flow signal for delayed government payment", () => {
  const result = createMeasurementFinancialFlow({
    measurement,
    invoice,
    accountsReceivable,
    cashFlowSignal,
  });

  assertSuccess(result, "expected valid financial flow");
  assertEqual(
    result.financialFlow.accountsReceivable.status,
    "overdue",
    "accounts receivable status mismatch",
  );
  assertEqual(
    result.financialFlow.cashFlowSignal.certainty,
    "at_risk",
    "cash flow certainty mismatch",
  );
  assertEqual(
    result.financialFlow.cashFlowSignal.metadata["riskReason"],
    "delayed_government_payment",
    "risk reason mismatch",
  );
});

runTest("deterministic output", () => {
  const first = JSON.stringify(
    createMeasurementFinancialFlow({
      measurement,
      invoice,
      accountsReceivable,
      cashFlowSignal,
    }),
  );
  const second = JSON.stringify(
    createMeasurementFinancialFlow({
      measurement,
      invoice,
      accountsReceivable,
      cashFlowSignal,
    }),
  );

  assertEqual(first, second, "expected deterministic output");
});

runTest("rejects invalid traceability", () => {
  const result = createMeasurementFinancialFlow({
    measurement,
    invoice: {
      ...invoice,
      measurementId: "invalid-measurement",
    },
    accountsReceivable,
    cashFlowSignal,
  });

  assertEqual(result.success, false, "expected invalid financial flow");

  if (!result.success) {
    assertEqual(result.errors.length, 1, "error count mismatch");
    assertEqual(
      result.errors[0]?.field,
      "invoice.measurementId",
      "error field mismatch",
    );
  }
});

function findById<T extends { readonly id: string }>(
  values: ReadonlyArray<T>,
  id: string,
): T {
  const value = values.find((candidate) => candidate.id === id);

  assertExists(value, `expected ${id} to exist`);

  return value;
}

function assertSuccess(
  result: ReturnType<typeof createMeasurementFinancialFlow>,
  message: string,
): asserts result is {
  readonly success: true;
  readonly financialFlow: {
    readonly measurement: AlphaEngenhariaMeasurement;
    readonly invoice: AlphaInvoice;
    readonly accountsReceivable: AlphaAccountsReceivable;
    readonly cashFlowSignal: AlphaCashFlowSignal;
  };
} {
  if (!result.success) {
    throw new Error(message);
  }
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

function assertExists<T>(
  value: T | null | undefined,
  message: string,
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
}
