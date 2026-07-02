import { RecognitionStatus, type MeasuredRevenue } from "../revenue-recognition";
import {
  advanceInvoiceStatus,
  createInvoice,
  InvoiceStatus,
  type Invoice,
  type InvoiceCreationResult,
  type InvoiceRequest,
  type InvoiceTransitionResult,
} from "./index";

const invoiceId = "invoice-8";
const measuredRevenueId = "measured-revenue-8";
const contractId = "contract-baseline-lagoa-do-arroz";
const projectId = "project-lagoa-do-arroz";
const measurementCycleId = "measurement-cycle-8";
const periodId = "measurement-period-8";
const bulletinId = "measurement-bulletin-8";
const certificationId = "certification-8";
const correlationId = "measurement-correlation-8";

runTest("invoice creation", () => {
  const result = createInvoice({
    measuredRevenue: createMeasuredRevenueFixture(),
    invoiceRequest: createInvoiceRequestFixture(),
    metadata: {
      source: "billing-office",
    },
  });

  assertInvoiceCreationSuccess(result, "expected invoice creation success");
  assertEqual(result.invoice.invoiceId, invoiceId, "invoice id mismatch");
  assertEqual(result.invoice.invoiceNumber, "NF-0008", "invoice number mismatch");
  assertEqual(result.invoice.series, "A", "invoice series mismatch");
  assertEqual(result.invoice.grossAmount, 1270, "gross amount mismatch");
  assertEqual(result.invoice.taxAmount, 127, "tax amount mismatch");
  assertEqual(result.invoice.netAmount, 1143, "net amount mismatch");
  assertEqual(result.invoice.status, InvoiceStatus.Draft, "status mismatch");
  assertEqual(result.invoice.currency, "BRL", "currency mismatch");
});

runTest("invalid revenue", () => {
  [
    RecognitionStatus.PendingCertification,
    RecognitionStatus.Blocked,
    RecognitionStatus.Cancelled,
  ].forEach((recognitionStatus) => {
    const result = createInvoice({
      measuredRevenue: createMeasuredRevenueFixture({ recognitionStatus }),
      invoiceRequest: createInvoiceRequestFixture(),
    });

    assertInvoiceCreationFailure(result, `expected ${recognitionStatus} failure`);
    assertEqual(
      result.errors[0]?.code,
      "measured_revenue_not_recognized",
      "invalid revenue error mismatch",
    );
  });
});

runTest("invoice cannot exceed certified revenue", () => {
  const result = createInvoice({
    measuredRevenue: createMeasuredRevenueFixture(),
    invoiceRequest: createInvoiceRequestFixture({
      grossAmount: 1270.01,
    }),
  });

  assertInvoiceCreationFailure(result, "expected invoice amount failure");
  assertEqual(
    result.errors[0]?.code,
    "invoice_exceeds_certified_revenue",
    "invoice excess error mismatch",
  );
});

runTest("invoice value must equal certified revenue", () => {
  const result = createInvoice({
    measuredRevenue: createMeasuredRevenueFixture(),
    invoiceRequest: createInvoiceRequestFixture({
      grossAmount: 1200,
    }),
  });

  assertInvoiceCreationFailure(result, "expected invoice mismatch failure");
  assertEqual(
    result.errors[0]?.code,
    "invoice_value_mismatch",
    "invoice mismatch error mismatch",
  );
});

runTest("invalid transitions", () => {
  const invoice = createInvoiceFixture();

  const draftToApproved = advanceInvoiceStatus({
    invoice,
    toStatus: InvoiceStatus.Approved,
  });
  assertInvoiceTransitionFailure(
    draftToApproved,
    "expected draft to approved failure",
  );
  assertEqual(
    draftToApproved.error.code,
    "invalid_invoice_transition",
    "transition error mismatch",
  );

  const draftToGenerated = advanceInvoiceStatus({
    invoice,
    toStatus: InvoiceStatus.Generated,
  });
  assertInvoiceTransitionSuccess(draftToGenerated, "expected generated invoice");

  const generatedToCancelled = advanceInvoiceStatus({
    invoice: draftToGenerated.invoice,
    toStatus: InvoiceStatus.Cancelled,
  });
  assertInvoiceTransitionFailure(
    generatedToCancelled,
    "expected generated to cancelled failure",
  );
});

runTest("approved invoice", () => {
  const generated = advanceInvoiceStatus({
    invoice: createInvoiceFixture(),
    toStatus: InvoiceStatus.Generated,
  });
  assertInvoiceTransitionSuccess(generated, "expected generated invoice");

  const approved = advanceInvoiceStatus({
    invoice: generated.invoice,
    toStatus: InvoiceStatus.Approved,
    metadata: {
      approvedBy: "finance-director",
    },
  });

  assertInvoiceTransitionSuccess(approved, "expected approved invoice");
  assertEqual(approved.invoice.status, InvoiceStatus.Approved, "status mismatch");
  assertEqual(
    approved.invoice.metadata["approvedBy"],
    "finance-director",
    "approval metadata mismatch",
  );
});

runTest("cancelled invoice", () => {
  const invoice = approveInvoiceFixture();
  const cancelled = advanceInvoiceStatus({
    invoice,
    toStatus: InvoiceStatus.Cancelled,
    metadata: {
      cancellationReason: "commercial cancellation",
    },
  });

  assertInvoiceTransitionSuccess(cancelled, "expected cancelled invoice");
  assertEqual(cancelled.invoice.status, InvoiceStatus.Cancelled, "status mismatch");
  assertEqual(
    cancelled.invoice.metadata["cancellationReason"],
    "commercial cancellation",
    "cancellation metadata mismatch",
  );
});

runTest("traceability", () => {
  const result = createInvoice({
    measuredRevenue: createMeasuredRevenueFixture(),
    invoiceRequest: createInvoiceRequestFixture(),
    metadata: {
      source: "billing-office",
    },
  });

  assertInvoiceCreationSuccess(result, "expected invoice creation success");
  assertEqual(result.invoice.contractId, contractId, "contract id mismatch");
  assertEqual(result.invoice.projectId, projectId, "project id mismatch");
  assertEqual(
    result.invoice.measurementCycleId,
    measurementCycleId,
    "measurement cycle id mismatch",
  );
  assertEqual(
    result.invoice.metadata["measuredRevenueId"],
    measuredRevenueId,
    "measured revenue id mismatch",
  );
  assertEqual(result.invoice.metadata["bulletinId"], bulletinId, "bulletin id mismatch");
  assertEqual(
    result.invoice.metadata["certificationId"],
    certificationId,
    "certification id mismatch",
  );
  assertEqual(
    result.invoice.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
});

runTest("deterministic output", () => {
  const input = {
    measuredRevenue: createMeasuredRevenueFixture(),
    invoiceRequest: createInvoiceRequestFixture(),
    metadata: {
      source: "billing-office",
    },
  };

  const first = JSON.stringify(createInvoice(input));
  const second = JSON.stringify(createInvoice(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("immutability", () => {
  const result = createInvoice({
    measuredRevenue: createMeasuredRevenueFixture(),
    invoiceRequest: createInvoiceRequestFixture(),
  });

  assertInvoiceCreationSuccess(result, "expected invoice creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.invoice), true, "invoice should be frozen");
  assertEqual(Object.isFrozen(result.invoice.metadata), true, "metadata should be frozen");
  assertEqual(Object.isFrozen(result.errors), true, "errors should be frozen");
});

runTest("metadata preservation", () => {
  const result = createInvoice({
    measuredRevenue: createMeasuredRevenueFixture({
      metadata: {
        correlationId,
        measuredBy: "field-engineer",
      },
    }),
    invoiceRequest: createInvoiceRequestFixture({
      metadata: {
        requestedBy: "billing-analyst",
      },
    }),
    metadata: {
      reviewedBy: "controller",
    },
  });

  assertInvoiceCreationSuccess(result, "expected invoice creation success");
  assertEqual(
    result.invoice.metadata["measuredBy"],
    "field-engineer",
    "measured metadata mismatch",
  );
  assertEqual(
    result.invoice.metadata["requestedBy"],
    "billing-analyst",
    "request metadata mismatch",
  );
  assertEqual(
    result.invoice.metadata["reviewedBy"],
    "controller",
    "input metadata mismatch",
  );
});

runTest("does not expose accounts receivable, cash flow, sefaz, xml, or danfe concepts", () => {
  const result = createInvoice({
    measuredRevenue: createMeasuredRevenueFixture(),
    invoiceRequest: createInvoiceRequestFixture(),
  });

  assertInvoiceCreationSuccess(result, "expected invoice creation success");
  const serializedInvoice = JSON.stringify(result.invoice).toLowerCase();

  assertEqual(
    serializedInvoice.includes("accountsreceivable"),
    false,
    "unexpected ar concept",
  );
  assertEqual(
    serializedInvoice.includes("accounts_receivable"),
    false,
    "unexpected ar concept",
  );
  assertEqual(serializedInvoice.includes("cashflow"), false, "unexpected cash flow");
  assertEqual(serializedInvoice.includes("cash_flow"), false, "unexpected cash flow");
  assertEqual(serializedInvoice.includes("sefaz"), false, "unexpected sefaz concept");
  assertEqual(serializedInvoice.includes("xml"), false, "unexpected xml concept");
  assertEqual(serializedInvoice.includes("danfe"), false, "unexpected danfe concept");
});

function createInvoiceFixture(): Invoice {
  const result = createInvoice({
    measuredRevenue: createMeasuredRevenueFixture(),
    invoiceRequest: createInvoiceRequestFixture(),
  });

  assertInvoiceCreationSuccess(result, "expected invoice fixture creation");

  return result.invoice;
}

function approveInvoiceFixture(): Invoice {
  const generated = advanceInvoiceStatus({
    invoice: createInvoiceFixture(),
    toStatus: InvoiceStatus.Generated,
  });
  assertInvoiceTransitionSuccess(generated, "expected generated invoice");

  const approved = advanceInvoiceStatus({
    invoice: generated.invoice,
    toStatus: InvoiceStatus.Approved,
  });
  assertInvoiceTransitionSuccess(approved, "expected approved invoice");

  return approved.invoice;
}

function createMeasuredRevenueFixture(
  overrides: Partial<MeasuredRevenue> = {},
): MeasuredRevenue {
  return {
    id: overrides.id ?? measuredRevenueId,
    measurementCycleId: overrides.measurementCycleId ?? measurementCycleId,
    contractId: overrides.contractId ?? contractId,
    projectId: overrides.projectId ?? projectId,
    periodId: overrides.periodId ?? periodId,
    bulletinId: overrides.bulletinId ?? bulletinId,
    certificationId: overrides.certificationId ?? certificationId,
    revenueDate: overrides.revenueDate ?? "2026-07-03",
    grossAmount: overrides.grossAmount ?? 1270,
    certifiedAmount: overrides.certifiedAmount ?? 1270,
    recognitionStatus: overrides.recognitionStatus ?? RecognitionStatus.Recognized,
    source: overrides.source ?? "certified_measurement_cycle",
    metadata: overrides.metadata ?? {
      correlationId,
      source: "revenue-recognition",
    },
  };
}

function createInvoiceRequestFixture(
  overrides: Partial<InvoiceRequest> = {},
): InvoiceRequest {
  return {
    invoiceId: overrides.invoiceId ?? invoiceId,
    invoiceNumber: overrides.invoiceNumber ?? "NF-0008",
    series: overrides.series ?? "A",
    issueDate: overrides.issueDate ?? "2026-07-04",
    dueDate: overrides.dueDate ?? "2026-08-03",
    customerId: overrides.customerId ?? "customer-dnocs",
    grossAmount: overrides.grossAmount ?? 1270,
    taxAmount: overrides.taxAmount ?? 127,
    currency: overrides.currency ?? "BRL",
    status: overrides.status,
    metadata: overrides.metadata ?? {
      requestedBy: "billing-office",
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

function assertInvoiceCreationSuccess(
  result: InvoiceCreationResult,
  message: string,
): asserts result is Extract<InvoiceCreationResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertInvoiceCreationFailure(
  result: InvoiceCreationResult,
  message: string,
): asserts result is Extract<InvoiceCreationResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}

function assertInvoiceTransitionSuccess(
  result: InvoiceTransitionResult,
  message: string,
): asserts result is Extract<InvoiceTransitionResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertInvoiceTransitionFailure(
  result: InvoiceTransitionResult,
  message: string,
): asserts result is Extract<InvoiceTransitionResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
