import {
  AccountsReceivableStatus,
  ReceivableRiskLevel,
  type AccountsReceivable,
} from "../accounts-receivable";
import {
  CashFlowSignalCategory,
  CashFlowSignalCertainty,
  CashFlowSignalDirection,
  createCashFlowSignalFromReceivable,
  type CashFlowSignalResult,
} from "./index";

const cashFlowSignalId = "cash-flow-signal-8";
const accountsReceivableId = "accounts-receivable-8";
const invoiceId = "invoice-8";
const invoiceNumber = "NF-0008";
const contractId = "contract-baseline-lagoa-do-arroz";
const projectId = "project-lagoa-do-arroz";
const customerId = "customer-dnocs";
const correlationId = "measurement-correlation-8";

runTest("creates expected inflow from open receivable", () => {
  const result = createCashFlowSignalFromReceivable({
    accountsReceivable: createAccountsReceivableFixture(),
    id: cashFlowSignalId,
    signalDate: "2026-08-10",
    certainty: CashFlowSignalCertainty.Expected,
    metadata: {
      source: "treasury-office",
    },
  });

  assertCashFlowSignalSuccess(result, "expected signal creation success");
  assertEqual(result.signal.id, cashFlowSignalId, "signal id mismatch");
  assertEqual(result.signal.sourceType, "accounts_receivable", "source type mismatch");
  assertEqual(result.signal.sourceId, accountsReceivableId, "source id mismatch");
  assertEqual(result.signal.direction, CashFlowSignalDirection.Inflow, "direction mismatch");
  assertEqual(result.signal.amount, 1143, "amount mismatch");
  assertEqual(result.signal.currency, "BRL", "currency mismatch");
  assertEqual(
    result.signal.category,
    CashFlowSignalCategory.Receivable,
    "category mismatch",
  );
  assertEqual(
    result.signal.certainty,
    CashFlowSignalCertainty.Expected,
    "certainty mismatch",
  );
});

runTest("creates at-risk inflow from overdue receivable", () => {
  const result = createCashFlowSignalFromReceivable({
    accountsReceivable: createAccountsReceivableFixture({
      status: AccountsReceivableStatus.Overdue,
      daysPastDue: 21,
      riskLevel: ReceivableRiskLevel.High,
    }),
    id: cashFlowSignalId,
    signalDate: "2026-08-24",
    certainty: CashFlowSignalCertainty.AtRisk,
  });

  assertCashFlowSignalSuccess(result, "expected at-risk signal success");
  assertEqual(result.signal.certainty, CashFlowSignalCertainty.AtRisk, "certainty mismatch");
  assertEqual(result.signal.riskLevel, ReceivableRiskLevel.High, "risk mismatch");
  assertEqual(result.warnings.length, 0, "unexpected warning");
});

runTest("creates signal from partially received receivable", () => {
  const result = createCashFlowSignalFromReceivable({
    accountsReceivable: createAccountsReceivableFixture({
      status: AccountsReceivableStatus.PartiallyReceived,
      riskLevel: ReceivableRiskLevel.Medium,
    }),
    id: cashFlowSignalId,
    signalDate: "2026-08-15",
    certainty: CashFlowSignalCertainty.Expected,
  });

  assertCashFlowSignalSuccess(result, "expected partially received signal success");
  assertEqual(
    result.signal.riskLevel,
    ReceivableRiskLevel.Medium,
    "risk level mismatch",
  );
});

runTest("creates signal from received receivable", () => {
  const result = createCashFlowSignalFromReceivable({
    accountsReceivable: createAccountsReceivableFixture({
      status: AccountsReceivableStatus.Received,
    }),
    id: cashFlowSignalId,
    signalDate: "2026-08-03",
    certainty: CashFlowSignalCertainty.Confirmed,
  });

  assertCashFlowSignalSuccess(result, "expected received signal success");
  assertEqual(
    result.signal.certainty,
    CashFlowSignalCertainty.Confirmed,
    "certainty mismatch",
  );
});

runTest("rejects cancelled receivable", () => {
  const result = createCashFlowSignalFromReceivable({
    accountsReceivable: createAccountsReceivableFixture({
      status: AccountsReceivableStatus.Cancelled,
    }),
    id: cashFlowSignalId,
    signalDate: "2026-08-10",
    certainty: CashFlowSignalCertainty.Expected,
  });

  assertCashFlowSignalFailure(result, "expected cancelled receivable rejection");
  assertEqual(result.errors[0]?.code, "cancelled_receivable", "error code mismatch");
});

runTest("rejects non-positive amount", () => {
  [0, -10].forEach((amount) => {
    const result = createCashFlowSignalFromReceivable({
      accountsReceivable: createAccountsReceivableFixture({ amount }),
      id: cashFlowSignalId,
      signalDate: "2026-08-10",
      certainty: CashFlowSignalCertainty.Expected,
    });

    assertCashFlowSignalFailure(result, `expected ${amount} amount rejection`);
    assertEqual(
      result.errors[0]?.code,
      "non_positive_signal_amount",
      "error code mismatch",
    );
  });
});

runTest("preserves traceability", () => {
  const result = createCashFlowSignalFromReceivable({
    accountsReceivable: createAccountsReceivableFixture(),
    id: cashFlowSignalId,
    signalDate: "2026-08-10",
    certainty: CashFlowSignalCertainty.Expected,
    metadata: {
      source: "treasury-office",
    },
  });

  assertCashFlowSignalSuccess(result, "expected signal creation success");
  assertEqual(result.signal.contractId, contractId, "contract id mismatch");
  assertEqual(result.signal.projectId, projectId, "project id mismatch");
  assertEqual(result.signal.customerId, customerId, "customer id mismatch");
  assertEqual(
    result.signal.metadata["accountsReceivableId"],
    accountsReceivableId,
    "accounts receivable id mismatch",
  );
  assertEqual(result.signal.metadata["invoiceId"], invoiceId, "invoice id mismatch");
  assertEqual(
    result.signal.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
});

runTest("preserves riskLevel", () => {
  const result = createCashFlowSignalFromReceivable({
    accountsReceivable: createAccountsReceivableFixture({
      riskLevel: ReceivableRiskLevel.Critical,
    }),
    id: cashFlowSignalId,
    signalDate: "2026-08-10",
    certainty: CashFlowSignalCertainty.AtRisk,
  });

  assertCashFlowSignalSuccess(result, "expected signal creation success");
  assertEqual(
    result.signal.riskLevel,
    ReceivableRiskLevel.Critical,
    "risk level mismatch",
  );
});

runTest("warns when overdue receivable is marked confirmed", () => {
  const result = createCashFlowSignalFromReceivable({
    accountsReceivable: createAccountsReceivableFixture({
      status: AccountsReceivableStatus.Overdue,
      daysPastDue: 10,
    }),
    id: cashFlowSignalId,
    signalDate: "2026-08-20",
    certainty: CashFlowSignalCertainty.Confirmed,
  });

  assertCashFlowSignalSuccess(result, "expected signal creation success");
  assertEqual(result.warnings.length, 1, "warning count mismatch");
  assertEqual(
    result.warnings[0]?.code,
    "overdue_confirmed_inflow",
    "warning code mismatch",
  );
});

runTest("deterministic output", () => {
  const input = {
    accountsReceivable: createAccountsReceivableFixture(),
    id: cashFlowSignalId,
    signalDate: "2026-08-10",
    certainty: CashFlowSignalCertainty.Expected,
    metadata: {
      source: "treasury-office",
    },
  };

  const first = JSON.stringify(createCashFlowSignalFromReceivable(input));
  const second = JSON.stringify(createCashFlowSignalFromReceivable(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("immutable output", () => {
  const result = createCashFlowSignalFromReceivable({
    accountsReceivable: createAccountsReceivableFixture(),
    id: cashFlowSignalId,
    signalDate: "2026-08-10",
    certainty: CashFlowSignalCertainty.Expected,
  });

  assertCashFlowSignalSuccess(result, "expected signal creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.signal), true, "signal should be frozen");
  assertEqual(Object.isFrozen(result.signal.metadata), true, "metadata should be frozen");
  assertEqual(Object.isFrozen(result.errors), true, "errors should be frozen");
  assertEqual(Object.isFrozen(result.warnings), true, "warnings should be frozen");
});

runTest("no forecast, business facts, or decision concepts", () => {
  const result = createCashFlowSignalFromReceivable({
    accountsReceivable: createAccountsReceivableFixture(),
    id: cashFlowSignalId,
    signalDate: "2026-08-10",
    certainty: CashFlowSignalCertainty.Expected,
  });

  assertCashFlowSignalSuccess(result, "expected signal creation success");
  const serializedSignal = JSON.stringify(result.signal).toLowerCase();

  assertEqual(serializedSignal.includes("forecast"), false, "unexpected forecast concept");
  assertEqual(
    serializedSignal.includes("businessfact"),
    false,
    "unexpected business fact concept",
  );
  assertEqual(
    serializedSignal.includes("business_fact"),
    false,
    "unexpected business fact concept",
  );
  assertEqual(serializedSignal.includes("decision"), false, "unexpected decision concept");
});

function createAccountsReceivableFixture(
  overrides: Partial<AccountsReceivable> = {},
): AccountsReceivable {
  return {
    id: overrides.id ?? accountsReceivableId,
    invoiceId: overrides.invoiceId ?? invoiceId,
    invoiceNumber: overrides.invoiceNumber ?? invoiceNumber,
    contractId: overrides.contractId ?? contractId,
    projectId: overrides.projectId ?? projectId,
    customerId: overrides.customerId ?? customerId,
    issueDate: overrides.issueDate ?? "2026-07-04",
    dueDate: overrides.dueDate ?? "2026-08-03",
    expectedReceiptDate: overrides.expectedReceiptDate ?? "2026-08-10",
    amount: overrides.amount ?? 1143,
    currency: overrides.currency ?? "BRL",
    status: overrides.status ?? AccountsReceivableStatus.Open,
    daysPastDue: overrides.daysPastDue ?? 0,
    riskLevel: overrides.riskLevel ?? ReceivableRiskLevel.Low,
    metadata: overrides.metadata ?? {
      correlationId,
      source: "accounts-receivable-engine",
    },
  };
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

function assertCashFlowSignalSuccess(
  result: CashFlowSignalResult,
  message: string,
): asserts result is Extract<CashFlowSignalResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertCashFlowSignalFailure(
  result: CashFlowSignalResult,
  message: string,
): asserts result is Extract<CashFlowSignalResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
