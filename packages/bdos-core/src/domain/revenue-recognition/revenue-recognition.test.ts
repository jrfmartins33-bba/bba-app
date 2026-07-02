import {
  createMeasurementPeriod,
  createServiceItem,
  type MeasurementEvidenceReference,
  type MeasurementPeriod,
  type ServiceItem,
} from "../measurement";
import { createMeasurement, type MeasurementExecution } from "../measurement-engine";
import {
  createMeasurementCycle,
  MeasurementCycleStatus,
  type Certification,
  type MeasurementBulletin,
  type MeasurementCycle,
} from "../measurement-workflow";
import {
  RecognitionStatus,
  recognizeMeasuredRevenue,
  type RevenueRecognitionResult,
} from "./index";

const revenueId = "measured-revenue-8";
const measurementCycleId = "measurement-cycle-8";
const contractId = "contract-baseline-lagoa-do-arroz";
const projectId = "project-lagoa-do-arroz";
const workPackageId = "work-package-terraplenagem";
const serviceItemId = "service-item-escavacao";
const measurementPeriodId = "measurement-period-8";
const bulletinId = "measurement-bulletin-8";
const certificationId = "certification-8";
const correlationId = "measurement-correlation-8";

runTest("recognizes revenue from certified cycle", () => {
  const result = recognizeMeasuredRevenue({
    measurementCycle: createMeasurementCycleFixture(MeasurementCycleStatus.Certified),
    id: revenueId,
    revenueDate: "2026-07-03",
    metadata: {
      source: "revenue-office",
    },
  });

  assertRecognitionSuccess(result, "expected revenue recognition success");
  assertEqual(result.measuredRevenue.id, revenueId, "revenue id mismatch");
  assertEqual(
    result.measuredRevenue.recognitionStatus,
    RecognitionStatus.Recognized,
    "recognition status mismatch",
  );
  assertEqual(result.measuredRevenue.grossAmount, 1270, "gross amount mismatch");
  assertEqual(result.measuredRevenue.certifiedAmount, 1270, "certified amount mismatch");
  assertEqual(result.measuredRevenue.source, "certified_measurement_cycle", "source mismatch");
});

runTest("recognizes revenue from closed cycle", () => {
  const result = recognizeMeasuredRevenue({
    measurementCycle: createMeasurementCycleFixture(MeasurementCycleStatus.Closed),
    id: revenueId,
    revenueDate: "2026-07-03",
  });

  assertRecognitionSuccess(result, "expected closed cycle recognition success");
  assertEqual(
    result.measuredRevenue.recognitionStatus,
    RecognitionStatus.Recognized,
    "recognition status mismatch",
  );
});

runTest("rejects draft, measured, and bulletin generated cycles", () => {
  [
    MeasurementCycleStatus.Draft,
    MeasurementCycleStatus.Measured,
    MeasurementCycleStatus.BulletinGenerated,
  ].forEach((status) => {
    const result = recognizeMeasuredRevenue({
      measurementCycle: createMeasurementCycleFixture(status),
      id: revenueId,
      revenueDate: "2026-07-03",
    });

    assertRecognitionFailure(result, `expected ${status} rejection`);
    assertEqual(
      result.errors[0]?.code,
      "measurement_cycle_not_certified",
      "status error mismatch",
    );
  });
});

runTest("rejects missing certification", () => {
  const result = recognizeMeasuredRevenue({
    measurementCycle: createMeasurementCycleFixture(MeasurementCycleStatus.Certified, {
      certifications: [],
    }),
    id: revenueId,
    revenueDate: "2026-07-03",
  });

  assertRecognitionFailure(result, "expected missing certification rejection");
  assertEqual(
    result.errors[0]?.code,
    "missing_certification",
    "missing certification error mismatch",
  );
});

runTest("rejects uncertified bulletin", () => {
  const result = recognizeMeasuredRevenue({
    measurementCycle: createMeasurementCycleFixture(MeasurementCycleStatus.Certified, {
      certifications: [createCertificationFixture({ certified: false })],
    }),
    id: revenueId,
    revenueDate: "2026-07-03",
  });

  assertRecognitionFailure(result, "expected uncertified rejection");
  assertEqual(
    result.errors[0]?.code,
    "certification_not_certified",
    "uncertified error mismatch",
  );
});

runTest("rejects missing certified bulletin", () => {
  const result = recognizeMeasuredRevenue({
    measurementCycle: createMeasurementCycleFixture(MeasurementCycleStatus.Certified, {
      measurementBulletins: [],
    }),
    id: revenueId,
    revenueDate: "2026-07-03",
  });

  assertRecognitionFailure(result, "expected missing bulletin rejection");
  assertEqual(
    result.errors[0]?.code,
    "missing_certified_bulletin",
    "missing bulletin error mismatch",
  );
});

runTest("preserves traceability", () => {
  const result = recognizeMeasuredRevenue({
    measurementCycle: createMeasurementCycleFixture(MeasurementCycleStatus.Certified),
    id: revenueId,
    revenueDate: "2026-07-03",
    metadata: {
      source: "revenue-office",
    },
  });

  assertRecognitionSuccess(result, "expected revenue recognition success");
  assertEqual(
    result.measuredRevenue.measurementCycleId,
    measurementCycleId,
    "measurement cycle id mismatch",
  );
  assertEqual(result.measuredRevenue.contractId, contractId, "contract id mismatch");
  assertEqual(result.measuredRevenue.projectId, projectId, "project id mismatch");
  assertEqual(result.measuredRevenue.periodId, measurementPeriodId, "period id mismatch");
  assertEqual(result.measuredRevenue.bulletinId, bulletinId, "bulletin id mismatch");
  assertEqual(
    result.measuredRevenue.certificationId,
    certificationId,
    "certification id mismatch",
  );
  assertEqual(
    result.measuredRevenue.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
  assertEqual(
    result.metadata["measurementCycleId"],
    measurementCycleId,
    "result metadata measurement cycle mismatch",
  );
});

runTest("deterministic output", () => {
  const input = {
    measurementCycle: createMeasurementCycleFixture(MeasurementCycleStatus.Certified),
    id: revenueId,
    revenueDate: "2026-07-03",
    metadata: {
      source: "revenue-office",
    },
  };
  const first = JSON.stringify(recognizeMeasuredRevenue(input));
  const second = JSON.stringify(recognizeMeasuredRevenue(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("returns immutable output", () => {
  const result = recognizeMeasuredRevenue({
    measurementCycle: createMeasurementCycleFixture(MeasurementCycleStatus.Certified),
    id: revenueId,
    revenueDate: "2026-07-03",
  });

  assertRecognitionSuccess(result, "expected revenue recognition success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(
    Object.isFrozen(result.measuredRevenue),
    true,
    "measured revenue should be frozen",
  );
  assertEqual(Object.isFrozen(result.errors), true, "errors should be frozen");
  assertEqual(Object.isFrozen(result.warnings), true, "warnings should be frozen");
  assertEqual(
    Object.isFrozen(result.measuredRevenue.metadata),
    true,
    "metadata should be frozen",
  );
});

runTest("does not expose invoice, accounts receivable, or cash flow concepts", () => {
  const result = recognizeMeasuredRevenue({
    measurementCycle: createMeasurementCycleFixture(MeasurementCycleStatus.Certified),
    id: revenueId,
    revenueDate: "2026-07-03",
  });

  assertRecognitionSuccess(result, "expected revenue recognition success");
  const serializedRevenue = JSON.stringify(result.measuredRevenue).toLowerCase();

  assertEqual(serializedRevenue.includes("invoice"), false, "unexpected invoice concept");
  assertEqual(serializedRevenue.includes("accountsreceivable"), false, "unexpected ar concept");
  assertEqual(serializedRevenue.includes("accounts_receivable"), false, "unexpected ar concept");
  assertEqual(serializedRevenue.includes("cashflow"), false, "unexpected cash flow concept");
  assertEqual(serializedRevenue.includes("cash_flow"), false, "unexpected cash flow concept");
});

function createMeasurementCycleFixture(
  status: MeasurementCycleStatus,
  overrides: Partial<{
    readonly measurementBulletins: ReadonlyArray<MeasurementBulletin>;
    readonly certifications: ReadonlyArray<Certification>;
  }> = {},
): MeasurementCycle {
  const execution = createMeasurementExecutionFixture();
  const period = createMeasurementPeriodFixture();

  return createMeasurementCycle({
    id: measurementCycleId,
    contractId,
    projectId,
    period,
    status,
    measurementExecutions: [execution],
    measurementResults: [createMeasurement(execution, createServiceItemFixture(), period)],
    measurementBulletins: overrides.measurementBulletins ?? [
      createMeasurementBulletinFixture(),
    ],
    certifications: overrides.certifications ?? [createCertificationFixture()],
    correlationId,
    metadata: {
      source: "measurement-workflow",
    },
  });
}

function createMeasurementExecutionFixture(): MeasurementExecution {
  return {
    id: "measurement-execution-1",
    contractId,
    workPackageId,
    serviceItemId,
    measurementPeriodId,
    executedQuantity: 12.7,
    measurementDate: "2026-06-15",
    engineer: "Antonio Fernando",
    evidenceReferences: [createEvidenceReference()],
    correlationId,
    metadata: {
      source: "field-execution",
    },
  };
}

function createServiceItemFixture(): ServiceItem {
  return createServiceItem({
    id: serviceItemId,
    contractId,
    workPackageId,
    code: "02.03.01",
    description: "Escavacao manual em material de primeira categoria",
    unit: "M3",
    contractQuantity: 100,
    accumulatedQuantity: 50,
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

function createMeasurementBulletinFixture(): MeasurementBulletin {
  return {
    id: bulletinId,
    measurementId: measurementCycleId,
    bulletinNumber: 8,
    period: createMeasurementPeriodFixture(),
    issueDate: "2026-07-01",
    totalMeasuredValue: 1270,
    totalMeasuredQuantity: 12.7,
    metadata: {
      source: "measurement-office",
    },
  };
}

function createCertificationFixture(
  overrides: Partial<{
    readonly certified: boolean;
  }> = {},
): Certification {
  return {
    id: certificationId,
    bulletinId,
    certified: overrides.certified ?? true,
    certifiedBy: "Fiscalizacao DNOCS",
    certificationDate: "2026-07-02",
    observations: "Servicos efetivamente executados.",
    metadata: {
      source: "fiscalization",
    },
  };
}

function createEvidenceReference(): MeasurementEvidenceReference {
  return {
    id: "evidence-photo-1",
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

function assertRecognitionSuccess(
  result: RevenueRecognitionResult,
  message: string,
): asserts result is Extract<RevenueRecognitionResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertRecognitionFailure(
  result: RevenueRecognitionResult,
  message: string,
): asserts result is Extract<RevenueRecognitionResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
