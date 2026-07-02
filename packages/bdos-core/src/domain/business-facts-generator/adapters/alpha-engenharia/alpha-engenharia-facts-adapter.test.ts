import type { BusinessFact } from "../../../business-fact";
import type {
  AlphaMeasurementFinancialFlow,
} from "../../../digital-twin/alpha-engenharia";
import {
  alphaEngenhariaDigitalTwin,
  createMeasurementFinancialFlow,
} from "../../../digital-twin/alpha-engenharia";
import {
  alphaEngenhariaFactsAdapter,
  generateAlphaEngenhariaFacts,
} from "./index";

const baseFlow = createValidFinancialFlow();

const baseInput = {
  source: "alpha-engenharia.digital-twin",
  generatedAt: "2026-04-10T10:00:00.000Z",
  correlationId: "correlation-alpha-financial-flow",
  metadata: {
    simulationId: "alpha-engenharia-sprint-7-3",
  },
  measurementFinancialFlow: baseFlow,
  companyId: "alpha-company",
  tenantId: "tenant-alpha",
  organizationId: "organization-alpha",
  capability: "cash-intelligence",
};

runTest("generates measurement approved fact", () => {
  const result = generateAlphaEngenhariaFacts({
    ...baseInput,
    measurementFinancialFlow: {
      ...baseFlow,
      measurement: {
        ...baseFlow.measurement,
        status: "approved",
      },
    },
  });

  assertEqual(result.success, true, "success mismatch");
  const fact = findFact(result.facts, "measurement_approved");

  assertEqual(fact.category, "revenue", "category mismatch");
  assertEqual(fact.label, "Measurement approved", "label mismatch");
  assertEqual(fact.value, baseFlow.invoice.grossAmount, "value mismatch");
  assertEqual(fact.source, "alpha-engenharia.measurement", "source mismatch");
  assertEqual(
    fact.sourceReference,
    baseFlow.measurement.id,
    "sourceReference mismatch",
  );
});

runTest("generates invoice issued fact", () => {
  const result = generateAlphaEngenhariaFacts(baseInput);

  assertEqual(result.success, true, "success mismatch");
  const fact = findFact(result.facts, "invoice_issued");

  assertEqual(fact.category, "revenue", "category mismatch");
  assertEqual(fact.label, "Invoice issued", "label mismatch");
  assertEqual(fact.value, baseFlow.invoice.netAmount, "value mismatch");
  assertEqual(fact.source, "alpha-engenharia.invoice", "source mismatch");
  assertEqual(fact.sourceReference, baseFlow.invoice.id, "sourceReference mismatch");
});

runTest("generates receivable open fact", () => {
  const result = generateAlphaEngenhariaFacts({
    ...baseInput,
    measurementFinancialFlow: {
      ...baseFlow,
      accountsReceivable: {
        ...baseFlow.accountsReceivable,
        status: "open",
      },
    },
  });

  assertEqual(result.success, true, "success mismatch");
  const fact = findFact(result.facts, "receivable_open");

  assertEqual(fact.category, "cash", "category mismatch");
  assertEqual(fact.label, "Accounts receivable open", "label mismatch");
  assertEqual(fact.value, baseFlow.accountsReceivable.amount, "value mismatch");
  assertEqual(
    fact.source,
    "alpha-engenharia.accounts-receivable",
    "source mismatch",
  );
  assertEqual(
    fact.sourceReference,
    baseFlow.accountsReceivable.id,
    "sourceReference mismatch",
  );
});

runTest("generates receivable overdue fact", () => {
  const result = generateAlphaEngenhariaFacts(baseInput);

  assertEqual(result.success, true, "success mismatch");
  const fact = findFact(result.facts, "receivable_overdue");

  assertEqual(fact.category, "cash", "category mismatch");
  assertEqual(fact.label, "Accounts receivable overdue", "label mismatch");
  assertEqual(fact.value, baseFlow.accountsReceivable.amount, "value mismatch");
  assertEqual(
    fact.source,
    "alpha-engenharia.accounts-receivable",
    "source mismatch",
  );
  assertEqual(
    fact.sourceReference,
    baseFlow.accountsReceivable.id,
    "sourceReference mismatch",
  );
});

runTest("generates cash inflow at risk fact", () => {
  const result = generateAlphaEngenhariaFacts(baseInput);

  assertEqual(result.success, true, "success mismatch");
  const fact = findFact(result.facts, "cash_inflow_at_risk");

  assertEqual(fact.category, "cash", "category mismatch");
  assertEqual(fact.label, "Cash inflow at risk", "label mismatch");
  assertEqual(fact.value, baseFlow.cashFlowSignal.amount, "value mismatch");
  assertEqual(
    fact.source,
    "alpha-engenharia.cash-flow-signal",
    "source mismatch",
  );
  assertEqual(
    fact.sourceReference,
    baseFlow.cashFlowSignal.id,
    "sourceReference mismatch",
  );
});

runTest("preserves tenantId and organizationId", () => {
  const result = generateAlphaEngenhariaFacts(baseInput);
  const fact = findFact(result.facts, "invoice_issued");

  assertEqual(fact.tenantId, "tenant-alpha", "tenantId mismatch");
  assertEqual(
    fact.organizationId,
    "organization-alpha",
    "organizationId mismatch",
  );
});

runTest("preserves source and sourceReference", () => {
  const result = generateAlphaEngenhariaFacts(baseInput);
  const invoiceFact = findFact(result.facts, "invoice_issued");
  const receivableFact = findFact(result.facts, "receivable_overdue");

  assertEqual(invoiceFact.source, "alpha-engenharia.invoice", "invoice source mismatch");
  assertEqual(
    invoiceFact.sourceReference,
    baseFlow.invoice.id,
    "invoice sourceReference mismatch",
  );
  assertEqual(
    receivableFact.source,
    "alpha-engenharia.accounts-receivable",
    "receivable source mismatch",
  );
  assertEqual(
    receivableFact.sourceReference,
    baseFlow.accountsReceivable.id,
    "receivable sourceReference mismatch",
  );
});

runTest("preserves metadata traceability", () => {
  const result = generateAlphaEngenhariaFacts(baseInput);
  const fact = findFact(result.facts, "cash_inflow_at_risk");

  assertEqual(fact.metadata["companyId"], "alpha-company", "companyId mismatch");
  assertEqual(
    fact.metadata["measurementId"],
    baseFlow.measurement.id,
    "measurementId mismatch",
  );
  assertEqual(fact.metadata["invoiceId"], baseFlow.invoice.id, "invoiceId mismatch");
  assertEqual(
    fact.metadata["accountsReceivableId"],
    baseFlow.accountsReceivable.id,
    "accountsReceivableId mismatch",
  );
  assertEqual(
    fact.metadata["cashFlowSignalId"],
    baseFlow.cashFlowSignal.id,
    "cashFlowSignalId mismatch",
  );
  assertEqual(
    fact.metadata["correlationId"],
    baseInput.correlationId,
    "correlationId mismatch",
  );
});

runTest("returns structured errors for missing required data", () => {
  const result = generateAlphaEngenhariaFacts({
    source: "alpha-engenharia.digital-twin",
    generatedAt: "2026-04-10T10:00:00.000Z",
    correlationId: "correlation-missing",
    metadata: {},
  });

  assertEqual(result.success, false, "success mismatch");
  assertEqual(result.facts.length, 0, "facts length mismatch");
  assertEqual(result.errors.length, 5, "errors length mismatch");
  assertEqual(result.errors[0]?.code, "missing_required_data", "code mismatch");
});

runTest("deterministic output", () => {
  const first = JSON.stringify(generateAlphaEngenhariaFacts(baseInput));
  const second = JSON.stringify(generateAlphaEngenhariaFacts(baseInput));

  assertEqual(first, second, "expected deterministic output");
});

runTest("adapter exposes supported source", () => {
  assertEqual(
    alphaEngenhariaFactsAdapter.supportedSource,
    "alpha-engenharia.digital-twin",
    "supported source mismatch",
  );
});

function createValidFinancialFlow(): AlphaMeasurementFinancialFlow {
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

  const result = createMeasurementFinancialFlow({
    measurement,
    invoice,
    accountsReceivable,
    cashFlowSignal,
  });

  if (!result.success) {
    throw new Error("Expected valid financial flow fixture.");
  }

  return result.financialFlow;
}

function findFact(
  facts: ReadonlyArray<BusinessFact>,
  type: string,
): BusinessFact {
  const fact = facts.find((candidate) => candidate.type === type);

  assertExists(fact, `expected ${type} fact`);

  return fact;
}

function findById<T extends { readonly id: string }>(
  values: ReadonlyArray<T>,
  id: string,
): T {
  const value = values.find((candidate) => candidate.id === id);

  assertExists(value, `expected ${id} to exist`);

  return value;
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
