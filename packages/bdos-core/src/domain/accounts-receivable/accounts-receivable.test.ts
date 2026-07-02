import {
  InvoiceStatus,
  type Invoice,
} from "../invoice";
import {
  AccountsReceivableStatus,
  ReceivableRiskLevel,
  advanceAccountsReceivableStatus,
  createAccountsReceivable,
  type AccountsReceivable,
  type AccountsReceivableResult,
  type AccountsReceivableTransitionResult,
} from "./index";

const accountsReceivableId = "accounts-receivable-8";
const invoiceId = "invoice-8";
const invoiceNumber = "NF-0008";
const contractId = "contract-baseline-lagoa-do-arroz";
const projectId = "project-lagoa-do-arroz";
const measurementCycleId = "measurement-cycle-8";
const customerId = "customer-dnocs";
const correlationId = "measurement-correlation-8";

runTest("creates receivable from approved invoice", () => {
  const result = createAccountsReceivable({
    invoice: createInvoiceFixture(),
    id: accountsReceivableId,
    expectedReceiptDate: "2026-08-10",
    daysPastDue: 0,
    riskLevel: ReceivableRiskLevel.Low,
    metadata: {
      source: "receivables-office",
    },
  });

  assertAccountsReceivableSuccess(result, "expected receivable creation success");
  assertEqual(result.receivable.id, accountsReceivableId, "receivable id mismatch");
  assertEqual(result.receivable.invoiceId, invoiceId, "invoice id mismatch");
  assertEqual(result.receivable.invoiceNumber, invoiceNumber, "invoice number mismatch");
  assertEqual(result.receivable.amount, 1143, "amount mismatch");
  assertEqual(result.receivable.currency, "BRL", "currency mismatch");
  assertEqual(result.receivable.status, AccountsReceivableStatus.Open, "status mismatch");
});

runTest("rejects non-approved invoice", () => {
  [
    InvoiceStatus.Draft,
    InvoiceStatus.Generated,
    InvoiceStatus.Cancelled,
  ].forEach((status) => {
    const result = createAccountsReceivable({
      invoice: createInvoiceFixture({ status }),
      id: accountsReceivableId,
      expectedReceiptDate: "2026-08-10",
      daysPastDue: 0,
      riskLevel: ReceivableRiskLevel.Low,
    });

    assertAccountsReceivableFailure(result, `expected ${status} failure`);
    assertEqual(
      result.errors[0]?.code,
      "invoice_not_approved",
      "invoice status error mismatch",
    );
  });
});

runTest("rejects non-positive amount", () => {
  [0, -10].forEach((netAmount) => {
    const result = createAccountsReceivable({
      invoice: createInvoiceFixture({ netAmount }),
      id: accountsReceivableId,
      expectedReceiptDate: "2026-08-10",
      daysPastDue: 0,
      riskLevel: ReceivableRiskLevel.Low,
    });

    assertAccountsReceivableFailure(result, `expected ${netAmount} failure`);
    assertEqual(
      result.errors[0]?.code,
      "non_positive_receivable_amount",
      "amount error mismatch",
    );
  });
});

runTest("preserves traceability", () => {
  const result = createAccountsReceivable({
    invoice: createInvoiceFixture(),
    id: accountsReceivableId,
    expectedReceiptDate: "2026-08-10",
    daysPastDue: 0,
    riskLevel: ReceivableRiskLevel.Low,
    metadata: {
      source: "receivables-office",
    },
  });

  assertAccountsReceivableSuccess(result, "expected receivable creation success");
  assertEqual(result.receivable.contractId, contractId, "contract id mismatch");
  assertEqual(result.receivable.projectId, projectId, "project id mismatch");
  assertEqual(result.receivable.customerId, customerId, "customer id mismatch");
  assertEqual(
    result.receivable.metadata["measurementCycleId"],
    measurementCycleId,
    "measurement cycle id mismatch",
  );
  assertEqual(
    result.receivable.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
});

runTest("preserves dueDate and expectedReceiptDate", () => {
  const result = createAccountsReceivable({
    invoice: createInvoiceFixture({
      dueDate: "2026-08-03",
    }),
    id: accountsReceivableId,
    expectedReceiptDate: "2026-08-10",
    daysPastDue: 0,
    riskLevel: ReceivableRiskLevel.Low,
  });

  assertAccountsReceivableSuccess(result, "expected receivable creation success");
  assertEqual(result.receivable.dueDate, "2026-08-03", "due date mismatch");
  assertEqual(
    result.receivable.expectedReceiptDate,
    "2026-08-10",
    "expected receipt date mismatch",
  );
});

runTest("status transitions valid", () => {
  assertTransition(
    AccountsReceivableStatus.Open,
    AccountsReceivableStatus.Overdue,
  );
  assertTransition(
    AccountsReceivableStatus.Open,
    AccountsReceivableStatus.PartiallyReceived,
  );
  assertTransition(
    AccountsReceivableStatus.Open,
    AccountsReceivableStatus.Received,
  );
  assertTransition(
    AccountsReceivableStatus.Open,
    AccountsReceivableStatus.Cancelled,
  );
  assertTransition(
    AccountsReceivableStatus.Overdue,
    AccountsReceivableStatus.PartiallyReceived,
  );
  assertTransition(
    AccountsReceivableStatus.Overdue,
    AccountsReceivableStatus.Received,
  );
  assertTransition(
    AccountsReceivableStatus.Overdue,
    AccountsReceivableStatus.Cancelled,
  );
  assertTransition(
    AccountsReceivableStatus.PartiallyReceived,
    AccountsReceivableStatus.Received,
  );
  assertTransition(
    AccountsReceivableStatus.PartiallyReceived,
    AccountsReceivableStatus.Cancelled,
  );
});

runTest("status transitions invalid", () => {
  const receivedToOpen = advanceAccountsReceivableStatus({
    receivable: createReceivableFixture(AccountsReceivableStatus.Received),
    toStatus: AccountsReceivableStatus.Open,
  });
  assertAccountsReceivableTransitionFailure(
    receivedToOpen,
    "expected received to open failure",
  );
  assertEqual(
    receivedToOpen.error.code,
    "invalid_accounts_receivable_transition",
    "transition error mismatch",
  );

  const cancelledToReceived = advanceAccountsReceivableStatus({
    receivable: createReceivableFixture(AccountsReceivableStatus.Cancelled),
    toStatus: AccountsReceivableStatus.Received,
  });
  assertAccountsReceivableTransitionFailure(
    cancelledToReceived,
    "expected cancelled to received failure",
  );

  const overdueToOpen = advanceAccountsReceivableStatus({
    receivable: createReceivableFixture(AccountsReceivableStatus.Overdue),
    toStatus: AccountsReceivableStatus.Open,
  });
  assertAccountsReceivableTransitionFailure(
    overdueToOpen,
    "expected overdue to open failure",
  );
});

runTest("preserves daysPastDue and riskLevel from input", () => {
  const result = createAccountsReceivable({
    invoice: createInvoiceFixture(),
    id: accountsReceivableId,
    expectedReceiptDate: "2026-08-10",
    daysPastDue: 14,
    riskLevel: ReceivableRiskLevel.High,
  });

  assertAccountsReceivableSuccess(result, "expected receivable creation success");
  assertEqual(result.receivable.daysPastDue, 14, "days past due mismatch");
  assertEqual(result.receivable.riskLevel, ReceivableRiskLevel.High, "risk mismatch");
});

runTest("deterministic output", () => {
  const input = {
    invoice: createInvoiceFixture(),
    id: accountsReceivableId,
    expectedReceiptDate: "2026-08-10",
    daysPastDue: 0,
    riskLevel: ReceivableRiskLevel.Low,
    metadata: {
      source: "receivables-office",
    },
  };

  const first = JSON.stringify(createAccountsReceivable(input));
  const second = JSON.stringify(createAccountsReceivable(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("immutable output", () => {
  const result = createAccountsReceivable({
    invoice: createInvoiceFixture(),
    id: accountsReceivableId,
    expectedReceiptDate: "2026-08-10",
    daysPastDue: 0,
    riskLevel: ReceivableRiskLevel.Low,
  });

  assertAccountsReceivableSuccess(result, "expected receivable creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.receivable), true, "receivable should be frozen");
  assertEqual(
    Object.isFrozen(result.receivable.metadata),
    true,
    "metadata should be frozen",
  );
  assertEqual(Object.isFrozen(result.errors), true, "errors should be frozen");
  assertEqual(Object.isFrozen(result.warnings), true, "warnings should be frozen");
});

runTest("no bank, cash flow, or business facts concepts", () => {
  const result = createAccountsReceivable({
    invoice: createInvoiceFixture(),
    id: accountsReceivableId,
    expectedReceiptDate: "2026-08-10",
    daysPastDue: 0,
    riskLevel: ReceivableRiskLevel.Low,
  });

  assertAccountsReceivableSuccess(result, "expected receivable creation success");
  const serializedReceivable = JSON.stringify(result.receivable).toLowerCase();

  assertEqual(serializedReceivable.includes("bank"), false, "unexpected bank concept");
  assertEqual(
    serializedReceivable.includes("cashflow"),
    false,
    "unexpected cash flow concept",
  );
  assertEqual(
    serializedReceivable.includes("cash_flow"),
    false,
    "unexpected cash flow concept",
  );
  assertEqual(
    serializedReceivable.includes("businessfact"),
    false,
    "unexpected business fact concept",
  );
  assertEqual(
    serializedReceivable.includes("business_fact"),
    false,
    "unexpected business fact concept",
  );
});

function assertTransition(
  fromStatus: AccountsReceivableStatus,
  toStatus: AccountsReceivableStatus,
): void {
  const result = advanceAccountsReceivableStatus({
    receivable: createReceivableFixture(fromStatus),
    toStatus,
    metadata: {
      actor: "receivables-office",
    },
  });

  assertAccountsReceivableTransitionSuccess(
    result,
    `expected ${fromStatus} to ${toStatus} success`,
  );
  assertEqual(result.receivable.status, toStatus, "transition status mismatch");
  assertEqual(
    result.receivable.metadata["fromStatus"],
    fromStatus,
    "from status metadata mismatch",
  );
  assertEqual(
    result.receivable.metadata["toStatus"],
    toStatus,
    "to status metadata mismatch",
  );
}

function createReceivableFixture(
  status: AccountsReceivableStatus = AccountsReceivableStatus.Open,
): AccountsReceivable {
  const result = createAccountsReceivable({
    invoice: createInvoiceFixture(),
    id: accountsReceivableId,
    expectedReceiptDate: "2026-08-10",
    daysPastDue: 0,
    riskLevel: ReceivableRiskLevel.Low,
  });

  assertAccountsReceivableSuccess(result, "expected receivable fixture creation");

  return {
    ...result.receivable,
    status,
  };
}

function createInvoiceFixture(overrides: Partial<Invoice> = {}): Invoice {
  return {
    invoiceId: overrides.invoiceId ?? invoiceId,
    invoiceNumber: overrides.invoiceNumber ?? invoiceNumber,
    series: overrides.series ?? "A",
    issueDate: overrides.issueDate ?? "2026-07-04",
    dueDate: overrides.dueDate ?? "2026-08-03",
    contractId: overrides.contractId ?? contractId,
    projectId: overrides.projectId ?? projectId,
    measurementCycleId: overrides.measurementCycleId ?? measurementCycleId,
    customerId: overrides.customerId ?? customerId,
    grossAmount: overrides.grossAmount ?? 1270,
    taxAmount: overrides.taxAmount ?? 127,
    netAmount: overrides.netAmount ?? 1143,
    currency: overrides.currency ?? "BRL",
    status: overrides.status ?? InvoiceStatus.Approved,
    metadata: overrides.metadata ?? {
      correlationId,
      measuredRevenueId: "measured-revenue-8",
      bulletinId: "measurement-bulletin-8",
      certificationId: "certification-8",
      source: "invoice-engine",
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

function assertAccountsReceivableSuccess(
  result: AccountsReceivableResult,
  message: string,
): asserts result is Extract<AccountsReceivableResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertAccountsReceivableFailure(
  result: AccountsReceivableResult,
  message: string,
): asserts result is Extract<AccountsReceivableResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}

function assertAccountsReceivableTransitionSuccess(
  result: AccountsReceivableTransitionResult,
  message: string,
): asserts result is Extract<
  AccountsReceivableTransitionResult,
  { readonly success: true }
> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertAccountsReceivableTransitionFailure(
  result: AccountsReceivableTransitionResult,
  message: string,
): asserts result is Extract<
  AccountsReceivableTransitionResult,
  { readonly success: false }
> {
  if (result.success) {
    throw new Error(message);
  }
}
