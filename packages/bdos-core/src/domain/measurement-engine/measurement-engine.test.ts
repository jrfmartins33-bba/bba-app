import { createMeasurementPeriod, createServiceItem } from "../measurement";
import type {
  MeasurementEvidenceReference,
  MeasurementPeriod,
  ServiceItem,
} from "../measurement";
import { createMeasurement } from "./index";
import type { MeasurementExecution, MeasurementResult } from "./index";

const contractId = "contract-baseline-lagoa-do-arroz";
const workPackageId = "work-package-terraplenagem";
const serviceItemId = "service-item-escavacao";
const measurementPeriodId = "measurement-period-8";
const correlationId = "measurement-correlation-8";

runTest("createMeasurement()", () => {
  const result = createMeasurement(
    createMeasurementExecutionFixture(),
    createServiceItemFixture(),
    createMeasurementPeriodFixture(),
  );

  assertEqual(
    result.measurementMemory.id,
    "measurement-execution-1",
    "measurement memory id mismatch",
  );
  assertEqual(result.warnings.length, 0, "warnings mismatch");
  assertEqual(result.validation.valid, true, "validation mismatch");
});

runTest("calculates accumulated quantity", () => {
  const result = createMeasurement(
    createMeasurementExecutionFixture({ executedQuantity: 12.7 }),
    createServiceItemFixture({ accumulatedQuantity: 50 }),
    createMeasurementPeriodFixture(),
  );

  assertEqual(result.accumulatedQuantity, 62.7, "accumulated quantity mismatch");
});

runTest("calculates remaining quantity", () => {
  const result = createMeasurement(
    createMeasurementExecutionFixture({ executedQuantity: 12.7 }),
    createServiceItemFixture({ accumulatedQuantity: 50, contractQuantity: 100 }),
    createMeasurementPeriodFixture(),
  );

  assertEqual(result.remainingQuantity, 37.3, "remaining quantity mismatch");
});

runTest("calculates measured value", () => {
  const result = createMeasurement(
    createMeasurementExecutionFixture({ executedQuantity: 12.5 }),
    createServiceItemFixture({ unitPrice: 80 }),
    createMeasurementPeriodFixture(),
  );

  assertEqual(result.calculatedValue, 1000, "calculated value mismatch");
});

runTest("detects replanilhamento", () => {
  const result = createMeasurement(
    createMeasurementExecutionFixture({ executedQuantity: 30 }),
    createServiceItemFixture({ accumulatedQuantity: 90, contractQuantity: 100 }),
    createMeasurementPeriodFixture(),
  );

  assertEqual(
    result.requiresReplanilhamento,
    true,
    "expected replanilhamento requirement",
  );
  assertIncludes(
    getWarningCodes(result),
    "measurement_exceeds_contract",
    "expected measurement exceeds warning",
  );
  assertIncludes(
    getWarningCodes(result),
    "remaining_quantity_below_zero",
    "expected remaining below zero warning",
  );
});

runTest("warns for zero quantity", () => {
  const result = createMeasurement(
    createMeasurementExecutionFixture({ executedQuantity: 0 }),
    createServiceItemFixture(),
    createMeasurementPeriodFixture(),
  );

  assertIncludes(getWarningCodes(result), "zero_quantity", "zero warning mismatch");
  assertEqual(result.validation.valid, false, "validation mismatch");
});

runTest("warns for negative quantity", () => {
  const result = createMeasurement(
    createMeasurementExecutionFixture({ executedQuantity: -5 }),
    createServiceItemFixture(),
    createMeasurementPeriodFixture(),
  );

  assertIncludes(
    getWarningCodes(result),
    "negative_quantity",
    "negative warning mismatch",
  );
});

runTest("warns for duplicated evidence", () => {
  const result = createMeasurement(
    createMeasurementExecutionFixture({
      evidenceReferences: [
        createEvidenceReference("evidence-1"),
        createEvidenceReference("evidence-1"),
      ],
    }),
    createServiceItemFixture(),
    createMeasurementPeriodFixture(),
  );

  assertIncludes(
    getWarningCodes(result),
    "duplicate_evidence_reference",
    "duplicate evidence warning mismatch",
  );
});

runTest("warns for outside measurement period", () => {
  const result = createMeasurement(
    createMeasurementExecutionFixture({ measurementDate: "2026-07-01" }),
    createServiceItemFixture(),
    createMeasurementPeriodFixture(),
  );

  assertIncludes(
    getWarningCodes(result),
    "measurement_outside_period",
    "outside period warning mismatch",
  );
});

runTest("deterministic output", () => {
  const first = JSON.stringify(
    createMeasurement(
      createMeasurementExecutionFixture(),
      createServiceItemFixture(),
      createMeasurementPeriodFixture(),
    ),
  );
  const second = JSON.stringify(
    createMeasurement(
      createMeasurementExecutionFixture(),
      createServiceItemFixture(),
      createMeasurementPeriodFixture(),
    ),
  );

  assertEqual(first, second, "expected deterministic output");
});

runTest("returns immutable output", () => {
  const result = createMeasurement(
    createMeasurementExecutionFixture(),
    createServiceItemFixture(),
    createMeasurementPeriodFixture(),
  );

  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(
    Object.isFrozen(result.measurementMemory),
    true,
    "measurement memory should be frozen",
  );
  assertEqual(Object.isFrozen(result.warnings), true, "warnings should be frozen");
  assertEqual(Object.isFrozen(result.validation), true, "validation should be frozen");
});

runTest("preserves traceability", () => {
  const result = createMeasurement(
    createMeasurementExecutionFixture(),
    createServiceItemFixture(),
    createMeasurementPeriodFixture(),
  );

  assertEqual(result.contractId, contractId, "contract id mismatch");
  assertEqual(result.workPackageId, workPackageId, "work package id mismatch");
  assertEqual(result.serviceItemId, serviceItemId, "service item id mismatch");
  assertEqual(
    result.measurementPeriodId,
    measurementPeriodId,
    "measurement period id mismatch",
  );
  assertEqual(result.correlationId, correlationId, "correlation id mismatch");
  assertEqual(
    result.measurementMemory.metadata["measurementPeriodId"],
    measurementPeriodId,
    "measurement memory metadata period mismatch",
  );
});

runTest("preserves metadata", () => {
  const result = createMeasurement(
    createMeasurementExecutionFixture(),
    createServiceItemFixture(),
    createMeasurementPeriodFixture(),
  );

  assertEqual(result.metadata["source"], "field-execution", "metadata mismatch");
  assertEqual(result.metadata["engineer"], "Antonio Fernando", "engineer mismatch");
  assertEqual(
    result.metadata["executedQuantity"],
    12.7,
    "executed quantity metadata mismatch",
  );
});

runTest("warns for traceability mismatch", () => {
  const result = createMeasurement(
    createMeasurementExecutionFixture({
      contractId: "another-contract",
      workPackageId: "another-work-package",
      serviceItemId: "another-service-item",
    }),
    createServiceItemFixture(),
    createMeasurementPeriodFixture(),
  );

  assertIncludes(getWarningCodes(result), "contract_id_mismatch", "contract warning mismatch");
  assertIncludes(
    getWarningCodes(result),
    "work_package_id_mismatch",
    "work package warning mismatch",
  );
  assertIncludes(
    getWarningCodes(result),
    "service_item_id_mismatch",
    "service item warning mismatch",
  );
  assertIncludes(
    getWarningCodes(result),
    "measurement_period_contract_mismatch",
    "period contract warning mismatch",
  );
});

function createMeasurementExecutionFixture(
  overrides: Partial<{
    readonly contractId: string;
    readonly workPackageId: string;
    readonly serviceItemId: string;
    readonly executedQuantity: number;
    readonly measurementDate: string;
    readonly evidenceReferences: ReadonlyArray<MeasurementEvidenceReference>;
  }> = {},
): MeasurementExecution {
  return {
    id: "measurement-execution-1",
    contractId: overrides.contractId ?? contractId,
    workPackageId: overrides.workPackageId ?? workPackageId,
    serviceItemId: overrides.serviceItemId ?? serviceItemId,
    measurementPeriodId,
    executedQuantity: overrides.executedQuantity ?? 12.7,
    measurementDate: overrides.measurementDate ?? "2026-06-15",
    engineer: "Antonio Fernando",
    evidenceReferences: overrides.evidenceReferences ?? [
      createEvidenceReference("evidence-1"),
    ],
    correlationId,
    metadata: {
      source: "field-execution",
    },
  };
}

function createServiceItemFixture(
  overrides: Partial<{
    readonly accumulatedQuantity: number;
    readonly contractQuantity: number;
    readonly unitPrice: number;
  }> = {},
): ServiceItem {
  return createServiceItem({
    id: serviceItemId,
    contractId,
    workPackageId,
    code: "02.03.01",
    description: "Escavacao manual em material de primeira categoria",
    unit: "M3",
    contractQuantity: overrides.contractQuantity ?? 100,
    accumulatedQuantity: overrides.accumulatedQuantity ?? 50,
    unitPrice: overrides.unitPrice ?? 100,
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

function getWarningCodes(result: MeasurementResult): ReadonlyArray<string> {
  return result.warnings.map((warning) => warning.code);
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

function assertIncludes<T>(
  values: ReadonlyArray<T>,
  expected: T,
  message: string,
): void {
  if (!values.includes(expected)) {
    throw new Error(`${message}: expected ${String(expected)}`);
  }
}
