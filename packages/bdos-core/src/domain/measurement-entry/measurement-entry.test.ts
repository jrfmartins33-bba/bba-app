import type { MeasurementEvidenceReference } from "../measurement";
import {
  MeasurementEntryStatus,
  advanceMeasurementEntryStatus,
  createMeasurementEntry,
  type CreateMeasurementEntryInput,
  type MeasurementEntry,
  type MeasurementEntryResult,
  type MeasurementEntryTransitionResult,
} from "./index";

const measurementEntryId = "measurement-entry-8";
const contractId = "contract-baseline-lagoa-do-arroz";
const projectId = "project-lagoa-do-arroz";
const workPackageId = "work-package-terraplenagem";
const serviceItemId = "service-item-escavacao";
const measurementPeriodId = "measurement-period-8";
const engineerId = "engineer-antonio";
const engineerName = "Antonio Fernando";
const correlationId = "measurement-entry-correlation-8";

runTest("creates measurement entry", () => {
  const result = createMeasurementEntry(createMeasurementEntryInputFixture());

  assertMeasurementEntrySuccess(result, "expected entry creation success");
  assertEqual(result.entry.id, measurementEntryId, "entry id mismatch");
  assertEqual(result.entry.quantity, 12.7, "quantity mismatch");
  assertEqual(result.entry.unit, "M3", "unit mismatch");
  assertEqual(result.entry.entryDate, "2026-06-15", "entry date mismatch");
  assertEqual(result.entry.status, MeasurementEntryStatus.Draft, "status mismatch");
});

runTest("rejects zero quantity", () => {
  const result = createMeasurementEntry(
    createMeasurementEntryInputFixture({ quantity: 0 }),
  );

  assertMeasurementEntryFailure(result, "expected zero quantity failure");
  assertEqual(result.errors[0]?.code, "invalid_quantity", "error code mismatch");
});

runTest("rejects negative quantity", () => {
  const result = createMeasurementEntry(
    createMeasurementEntryInputFixture({ quantity: -1 }),
  );

  assertMeasurementEntryFailure(result, "expected negative quantity failure");
  assertEqual(result.errors[0]?.code, "invalid_quantity", "error code mismatch");
});

runTest("rejects missing references", () => {
  const result = createMeasurementEntry(
    createMeasurementEntryInputFixture({
      contractId: "",
      projectId: "",
      workPackageId: "",
      serviceItemId: "",
      measurementPeriodId: "",
    }),
  );

  assertMeasurementEntryFailure(result, "expected missing references failure");
  assertEqual(result.errors.length, 5, "missing reference error count mismatch");
  assertEqual(
    result.errors.every((error) => error.code === "missing_required_reference"),
    true,
    "missing reference code mismatch",
  );
});

runTest("rejects missing engineer data", () => {
  const result = createMeasurementEntry(
    createMeasurementEntryInputFixture({
      engineerId: "",
      engineerName: "",
    }),
  );

  assertMeasurementEntryFailure(result, "expected missing engineer failure");
  assertEqual(result.errors.length, 2, "missing engineer error count mismatch");
  assertEqual(
    result.errors.every((error) => error.code === "missing_engineer_data"),
    true,
    "missing engineer code mismatch",
  );
});

runTest("preserves engineer data", () => {
  const result = createMeasurementEntry(createMeasurementEntryInputFixture());

  assertMeasurementEntrySuccess(result, "expected entry creation success");
  assertEqual(result.entry.engineerId, engineerId, "engineer id mismatch");
  assertEqual(result.entry.engineerName, engineerName, "engineer name mismatch");
  assertEqual(
    result.entry.metadata["engineerId"],
    engineerId,
    "engineer metadata mismatch",
  );
});

runTest("preserves evidence references", () => {
  const result = createMeasurementEntry(createMeasurementEntryInputFixture());

  assertMeasurementEntrySuccess(result, "expected entry creation success");
  assertEqual(result.entry.evidenceReferences.length, 2, "evidence count mismatch");
  assertEqual(
    result.entry.evidenceReferences[0]?.id,
    "field-photo-1",
    "evidence id mismatch",
  );
  assertEqual(
    Object.isFrozen(result.entry.evidenceReferences[0]),
    true,
    "evidence reference should be frozen",
  );
});

runTest("valid status transitions", () => {
  assertTransition(MeasurementEntryStatus.Draft, MeasurementEntryStatus.Submitted);
  assertTransition(MeasurementEntryStatus.Draft, MeasurementEntryStatus.Cancelled);
  assertTransition(MeasurementEntryStatus.Submitted, MeasurementEntryStatus.Accepted);
  assertTransition(MeasurementEntryStatus.Submitted, MeasurementEntryStatus.Rejected);
  assertTransition(MeasurementEntryStatus.Submitted, MeasurementEntryStatus.Cancelled);
  assertTransition(MeasurementEntryStatus.Rejected, MeasurementEntryStatus.Draft);
  assertTransition(MeasurementEntryStatus.Accepted, MeasurementEntryStatus.Cancelled);
});

runTest("invalid status transitions", () => {
  const draftToAccepted = advanceMeasurementEntryStatus({
    entry: createMeasurementEntryFixture(MeasurementEntryStatus.Draft),
    toStatus: MeasurementEntryStatus.Accepted,
  });
  assertMeasurementEntryTransitionFailure(
    draftToAccepted,
    "expected draft to accepted failure",
  );
  assertEqual(
    draftToAccepted.error.code,
    "invalid_measurement_entry_transition",
    "transition error code mismatch",
  );

  const cancelledToDraft = advanceMeasurementEntryStatus({
    entry: createMeasurementEntryFixture(MeasurementEntryStatus.Cancelled),
    toStatus: MeasurementEntryStatus.Draft,
  });
  assertMeasurementEntryTransitionFailure(
    cancelledToDraft,
    "expected cancelled to draft failure",
  );
});

runTest("preserves traceability", () => {
  const result = createMeasurementEntry(
    createMeasurementEntryInputFixture({
      metadata: {
        source: "field-tablet",
      },
    }),
  );

  assertMeasurementEntrySuccess(result, "expected entry creation success");
  assertEqual(result.entry.contractId, contractId, "contract id mismatch");
  assertEqual(result.entry.projectId, projectId, "project id mismatch");
  assertEqual(result.entry.workPackageId, workPackageId, "work package id mismatch");
  assertEqual(result.entry.serviceItemId, serviceItemId, "service item id mismatch");
  assertEqual(
    result.entry.measurementPeriodId,
    measurementPeriodId,
    "measurement period id mismatch",
  );
  assertEqual(
    result.entry.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
  assertEqual(result.entry.metadata["source"], "field-tablet", "metadata mismatch");
});

runTest("deterministic output", () => {
  const input = createMeasurementEntryInputFixture();
  const first = JSON.stringify(createMeasurementEntry(input));
  const second = JSON.stringify(createMeasurementEntry(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("immutable output", () => {
  const result = createMeasurementEntry(createMeasurementEntryInputFixture());

  assertMeasurementEntrySuccess(result, "expected entry creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.entry), true, "entry should be frozen");
  assertEqual(
    Object.isFrozen(result.entry.evidenceReferences),
    true,
    "evidence references should be frozen",
  );
  assertEqual(Object.isFrozen(result.entry.metadata), true, "metadata should be frozen");
  assertEqual(Object.isFrozen(result.errors), true, "errors should be frozen");
  assertEqual(Object.isFrozen(result.warnings), true, "warnings should be frozen");
});

runTest("no calculation, revenue, invoice, cash, or business facts concepts", () => {
  const result = createMeasurementEntry(createMeasurementEntryInputFixture());

  assertMeasurementEntrySuccess(result, "expected entry creation success");
  const serializedEntry = JSON.stringify(result.entry).toLowerCase();

  assertEqual(serializedEntry.includes("calculatedvalue"), false, "unexpected calculation");
  assertEqual(serializedEntry.includes("accumulatedquantity"), false, "unexpected accumulated");
  assertEqual(serializedEntry.includes("revenue"), false, "unexpected revenue");
  assertEqual(serializedEntry.includes("invoice"), false, "unexpected invoice");
  assertEqual(serializedEntry.includes("cash"), false, "unexpected cash concept");
  assertEqual(
    serializedEntry.includes("businessfact"),
    false,
    "unexpected business fact concept",
  );
  assertEqual(
    serializedEntry.includes("business_fact"),
    false,
    "unexpected business fact concept",
  );
});

function assertTransition(
  fromStatus: MeasurementEntryStatus,
  toStatus: MeasurementEntryStatus,
): void {
  const result = advanceMeasurementEntryStatus({
    entry: createMeasurementEntryFixture(fromStatus),
    toStatus,
    metadata: {
      actor: "measurement-office",
    },
  });

  assertMeasurementEntryTransitionSuccess(
    result,
    `expected ${fromStatus} to ${toStatus} success`,
  );
  assertEqual(result.entry.status, toStatus, "transition status mismatch");
  assertEqual(
    result.entry.metadata["fromStatus"],
    fromStatus,
    "from status metadata mismatch",
  );
  assertEqual(result.entry.metadata["toStatus"], toStatus, "to status metadata mismatch");
}

function createMeasurementEntryFixture(
  status: MeasurementEntryStatus = MeasurementEntryStatus.Draft,
): MeasurementEntry {
  const result = createMeasurementEntry(
    createMeasurementEntryInputFixture({ status }),
  );

  assertMeasurementEntrySuccess(result, "expected entry fixture creation");

  return result.entry;
}

function createMeasurementEntryInputFixture(
  overrides: Partial<CreateMeasurementEntryInput> = {},
): CreateMeasurementEntryInput {
  return {
    id: overrides.id ?? measurementEntryId,
    contractId: overrides.contractId ?? contractId,
    projectId: overrides.projectId ?? projectId,
    workPackageId: overrides.workPackageId ?? workPackageId,
    serviceItemId: overrides.serviceItemId ?? serviceItemId,
    measurementPeriodId: overrides.measurementPeriodId ?? measurementPeriodId,
    quantity: overrides.quantity ?? 12.7,
    unit: overrides.unit ?? "M3",
    entryDate: overrides.entryDate ?? "2026-06-15",
    engineerId: overrides.engineerId ?? engineerId,
    engineerName: overrides.engineerName ?? engineerName,
    evidenceReferences: overrides.evidenceReferences ?? [
      createEvidenceReference("field-photo-1"),
      createEvidenceReference("field-sketch-1"),
    ],
    notes: overrides.notes ?? "Escavacao executada conforme frente liberada.",
    status: overrides.status,
    correlationId: overrides.correlationId ?? correlationId,
    metadata: overrides.metadata ?? {
      source: "field-entry",
    },
  };
}

function createEvidenceReference(id: string): MeasurementEvidenceReference {
  return {
    id,
    type: "photo",
    description: "Field evidence",
    metadata: {
      source: "field",
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

function assertMeasurementEntrySuccess(
  result: MeasurementEntryResult,
  message: string,
): asserts result is Extract<MeasurementEntryResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertMeasurementEntryFailure(
  result: MeasurementEntryResult,
  message: string,
): asserts result is Extract<MeasurementEntryResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}

function assertMeasurementEntryTransitionSuccess(
  result: MeasurementEntryTransitionResult,
  message: string,
): asserts result is Extract<
  MeasurementEntryTransitionResult,
  { readonly success: true }
> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertMeasurementEntryTransitionFailure(
  result: MeasurementEntryTransitionResult,
  message: string,
): asserts result is Extract<
  MeasurementEntryTransitionResult,
  { readonly success: false }
> {
  if (result.success) {
    throw new Error(message);
  }
}
