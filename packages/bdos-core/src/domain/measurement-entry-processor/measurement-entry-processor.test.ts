import {
  createMeasurementPeriod,
  createServiceItem,
  type MeasurementEvidenceReference,
  type MeasurementPeriod,
  type ServiceItem,
} from "../measurement";
import {
  MeasurementEntryStatus,
  type MeasurementEntry,
} from "../measurement-entry";
import {
  createMeasurementExecutions,
  type MeasurementEntryProcessorResult,
} from "./index";

const contractId = "contract-baseline-lagoa-do-arroz";
const projectId = "project-lagoa-do-arroz";
const workPackageId = "work-package-terraplenagem";
const serviceItemId = "service-item-escavacao";
const secondServiceItemId = "service-item-compactacao";
const measurementPeriodId = "measurement-period-8";
const correlationId = "measurement-entry-correlation-8";

runTest("creation from multiple entries", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [
      createMeasurementEntryFixture({
        id: "entry-1",
        quantity: 12,
        entryDate: "2026-06-10",
        engineerId: "engineer-a",
        engineerName: "Engineer A",
        evidenceReferences: [createEvidenceReference("photo-1")],
        notes: "First front.",
      }),
      createMeasurementEntryFixture({
        id: "entry-2",
        quantity: 18,
        entryDate: "2026-06-20",
        engineerId: "engineer-b",
        engineerName: "Engineer B",
        evidenceReferences: [createEvidenceReference("photo-2")],
        notes: "Second front.",
      }),
    ],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorSuccess(result, "expected processor success");
  assertEqual(result.measurementExecutions.length, 1, "execution count mismatch");
  assertEqual(
    result.measurementExecutions[0]?.executedQuantity,
    30,
    "quantity mismatch",
  );
  assertEqual(
    result.measurementExecutions[0]?.metadata["entryCount"],
    2,
    "entry count mismatch",
  );
});

runTest("single execution", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [createMeasurementEntryFixture({ id: "entry-1" })],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorSuccess(result, "expected processor success");
  assertEqual(result.measurementExecutions.length, 1, "execution count mismatch");
  assertEqual(
    result.measurementExecutions[0]?.serviceItemId,
    serviceItemId,
    "service item mismatch",
  );
});

runTest("multiple executions", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [
      createMeasurementEntryFixture({ id: "entry-1", serviceItemId, quantity: 10 }),
      createMeasurementEntryFixture({
        id: "entry-2",
        serviceItemId: secondServiceItemId,
        quantity: 20,
      }),
    ],
    serviceItems: [
      createServiceItemFixture({ id: serviceItemId }),
      createServiceItemFixture({
        id: secondServiceItemId,
        code: "02.04.01",
        description: "Compactacao mecanica",
      }),
    ],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorSuccess(result, "expected processor success");
  assertEqual(result.measurementExecutions.length, 2, "execution count mismatch");
  assertEqual(
    JSON.stringify(result.measurementExecutions.map((execution) => execution.serviceItemId)),
    JSON.stringify([secondServiceItemId, serviceItemId].sort()),
    "service item aggregation mismatch",
  );
});

runTest("quantity aggregation", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [
      createMeasurementEntryFixture({ id: "entry-1", quantity: 5 }),
      createMeasurementEntryFixture({ id: "entry-2", quantity: 7.5 }),
      createMeasurementEntryFixture({ id: "entry-3", quantity: 2.5 }),
    ],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorSuccess(result, "expected processor success");
  assertEqual(
    result.measurementExecutions[0]?.executedQuantity,
    15,
    "quantity aggregation mismatch",
  );
});

runTest("entry count", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [
      createMeasurementEntryFixture({ id: "entry-1" }),
      createMeasurementEntryFixture({ id: "entry-2" }),
      createMeasurementEntryFixture({ id: "entry-3" }),
    ],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorSuccess(result, "expected processor success");
  assertEqual(
    result.measurementExecutions[0]?.metadata["entryCount"],
    3,
    "entry count mismatch",
  );
});

runTest("duplicate detection", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [
      createMeasurementEntryFixture({ id: "entry-duplicate" }),
      createMeasurementEntryFixture({ id: "entry-duplicate" }),
    ],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorFailure(result, "expected duplicate failure");
  assertEqual(
    result.errors[0]?.code,
    "duplicate_measurement_entry",
    "duplicate error mismatch",
  );
});

runTest("draft ignored", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [
      createMeasurementEntryFixture({ id: "entry-accepted", quantity: 10 }),
      createMeasurementEntryFixture({
        id: "entry-draft",
        quantity: 1000,
        status: MeasurementEntryStatus.Draft,
      }),
    ],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorSuccess(result, "expected processor success");
  assertEqual(
    result.measurementExecutions[0]?.executedQuantity,
    10,
    "draft entry should be ignored",
  );
});

runTest("rejected ignored", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [
      createMeasurementEntryFixture({ id: "entry-accepted", quantity: 10 }),
      createMeasurementEntryFixture({
        id: "entry-rejected",
        quantity: 1000,
        status: MeasurementEntryStatus.Rejected,
      }),
    ],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorSuccess(result, "expected processor success");
  assertEqual(
    result.measurementExecutions[0]?.executedQuantity,
    10,
    "rejected entry should be ignored",
  );
});

runTest("cancelled ignored", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [
      createMeasurementEntryFixture({ id: "entry-accepted", quantity: 10 }),
      createMeasurementEntryFixture({
        id: "entry-cancelled",
        quantity: 1000,
        status: MeasurementEntryStatus.Cancelled,
      }),
    ],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorSuccess(result, "expected processor success");
  assertEqual(
    result.measurementExecutions[0]?.executedQuantity,
    10,
    "cancelled entry should be ignored",
  );
});

runTest("empty input", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorFailure(result, "expected empty input failure");
  assertEqual(
    result.errors[0]?.code,
    "empty_measurement_entries",
    "empty input error mismatch",
  );
});

runTest("missing service item", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [createMeasurementEntryFixture({ id: "entry-1" })],
    serviceItems: [],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorFailure(result, "expected missing service item failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_service_item",
    "missing service item error mismatch",
  );
});

runTest("missing period", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [createMeasurementEntryFixture({ id: "entry-1" })],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: null,
  });

  assertProcessorFailure(result, "expected missing period failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_measurement_period",
    "missing period error mismatch",
  );
});

runTest("different contract rejection", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [
      createMeasurementEntryFixture({
        id: "entry-1",
        contractId: "different-contract",
      }),
    ],
    serviceItems: [
      createServiceItemFixture({
        contractId: "different-contract",
      }),
    ],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorFailure(result, "expected different contract failure");
  assertEqual(
    result.errors[0]?.code,
    "different_contract",
    "different contract error mismatch",
  );
});

runTest("different period rejection", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [
      createMeasurementEntryFixture({
        id: "entry-1",
        measurementPeriodId: "different-period",
      }),
    ],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorFailure(result, "expected different period failure");
  assertEqual(
    result.errors[0]?.code,
    "different_measurement_period",
    "different period error mismatch",
  );
});

runTest("traceability preservation", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [
      createMeasurementEntryFixture({
        id: "entry-1",
        engineerId: "engineer-a",
        engineerName: "Engineer A",
        metadata: {
          correlationId: "correlation-a",
          source: "field-tablet",
        },
      }),
      createMeasurementEntryFixture({
        id: "entry-2",
        engineerId: "engineer-b",
        engineerName: "Engineer B",
        metadata: {
          correlationId: "correlation-b",
        },
      }),
    ],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: createMeasurementPeriodFixture(),
    metadata: {
      source: "processor",
    },
  });

  assertProcessorSuccess(result, "expected processor success");
  const execution = result.measurementExecutions[0];
  assertEqual(execution?.contractId, contractId, "contract id mismatch");
  assertEqual(execution?.workPackageId, workPackageId, "work package id mismatch");
  assertEqual(execution?.serviceItemId, serviceItemId, "service item id mismatch");
  assertEqual(
    execution?.measurementPeriodId,
    measurementPeriodId,
    "period id mismatch",
  );
  assertEqual(
    JSON.stringify(execution?.metadata["entryIds"]),
    JSON.stringify(["entry-1", "entry-2"]),
    "entry ids mismatch",
  );
  assertEqual(
    JSON.stringify(execution?.metadata["engineerIds"]),
    JSON.stringify(["engineer-a", "engineer-b"]),
    "engineer ids mismatch",
  );
  assertEqual(
    JSON.stringify(execution?.metadata["correlationIds"]),
    JSON.stringify(["correlation-a", "correlation-b"]),
    "correlation ids mismatch",
  );
});

runTest("deterministic output", () => {
  const input = {
    measurementEntries: [
      createMeasurementEntryFixture({ id: "entry-2", quantity: 7 }),
      createMeasurementEntryFixture({ id: "entry-1", quantity: 5 }),
    ],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: createMeasurementPeriodFixture(),
    metadata: {
      source: "processor",
    },
  };

  const first = JSON.stringify(createMeasurementExecutions(input));
  const second = JSON.stringify(createMeasurementExecutions(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("immutable output", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [createMeasurementEntryFixture({ id: "entry-1" })],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorSuccess(result, "expected processor success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(
    Object.isFrozen(result.measurementExecutions),
    true,
    "executions should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.measurementExecutions[0]),
    true,
    "execution should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.measurementExecutions[0]?.metadata),
    true,
    "execution metadata should be frozen",
  );
});

runTest("no excel, revenue, invoice, cash flow, forecast, business facts, or decision concepts", () => {
  const result = createMeasurementExecutions({
    measurementEntries: [createMeasurementEntryFixture({ id: "entry-1" })],
    serviceItems: [createServiceItemFixture()],
    measurementPeriod: createMeasurementPeriodFixture(),
  });

  assertProcessorSuccess(result, "expected processor success");
  const serializedExecution = JSON.stringify(result.measurementExecutions).toLowerCase();

  assertEqual(serializedExecution.includes("excel"), false, "unexpected excel concept");
  assertEqual(serializedExecution.includes("revenue"), false, "unexpected revenue");
  assertEqual(serializedExecution.includes("invoice"), false, "unexpected invoice");
  assertEqual(serializedExecution.includes("cashflow"), false, "unexpected cash flow");
  assertEqual(serializedExecution.includes("cash_flow"), false, "unexpected cash flow");
  assertEqual(serializedExecution.includes("forecast"), false, "unexpected forecast");
  assertEqual(
    serializedExecution.includes("businessfact"),
    false,
    "unexpected business fact",
  );
  assertEqual(
    serializedExecution.includes("business_fact"),
    false,
    "unexpected business fact",
  );
  assertEqual(serializedExecution.includes("decision"), false, "unexpected decision");
});

function createMeasurementEntryFixture(
  overrides: Partial<MeasurementEntry> = {},
): MeasurementEntry {
  return {
    id: overrides.id ?? "entry-1",
    contractId: overrides.contractId ?? contractId,
    projectId: overrides.projectId ?? projectId,
    workPackageId: overrides.workPackageId ?? workPackageId,
    serviceItemId: overrides.serviceItemId ?? serviceItemId,
    measurementPeriodId: overrides.measurementPeriodId ?? measurementPeriodId,
    quantity: overrides.quantity ?? 10,
    unit: overrides.unit ?? "M3",
    entryDate: overrides.entryDate ?? "2026-06-15",
    engineerId: overrides.engineerId ?? "engineer-a",
    engineerName: overrides.engineerName ?? "Engineer A",
    evidenceReferences: overrides.evidenceReferences ?? [
      createEvidenceReference("photo-entry-1"),
    ],
    notes: overrides.notes ?? "Executed field quantity.",
    status: overrides.status ?? MeasurementEntryStatus.Accepted,
    metadata: overrides.metadata ?? {
      correlationId,
      source: "measurement-entry",
    },
  };
}

function createServiceItemFixture(
  overrides: Partial<{
    readonly id: string;
    readonly contractId: string;
    readonly workPackageId: string;
    readonly code: string;
    readonly description: string;
  }> = {},
): ServiceItem {
  return createServiceItem({
    id: overrides.id ?? serviceItemId,
    contractId: overrides.contractId ?? contractId,
    workPackageId: overrides.workPackageId ?? workPackageId,
    code: overrides.code ?? "02.03.01",
    description: overrides.description ?? "Escavacao manual",
    unit: "M3",
    contractQuantity: 100,
    accumulatedQuantity: 0,
    unitPrice: 100,
    correlationId,
    metadata: {},
  });
}

function createMeasurementPeriodFixture(): MeasurementPeriod {
  return createMeasurementPeriod({
    id: measurementPeriodId,
    contractId,
    periodNumber: 8,
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    correlationId,
    metadata: {},
  });
}

function createEvidenceReference(id: string): MeasurementEvidenceReference {
  return {
    id,
    type: "photo",
    description: "Field evidence",
    metadata: {},
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

function assertProcessorSuccess(
  result: MeasurementEntryProcessorResult,
  message: string,
): asserts result is Extract<MeasurementEntryProcessorResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertProcessorFailure(
  result: MeasurementEntryProcessorResult,
  message: string,
): asserts result is Extract<MeasurementEntryProcessorResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
