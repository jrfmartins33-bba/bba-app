import {
  createMeasurementPeriod,
  createServiceItem,
  type MeasurementEvidenceReference,
  type MeasurementPeriod,
  type ServiceItem,
} from "../measurement";
import { createMeasurement, type MeasurementResult } from "../measurement-engine";
import type { MeasurementExecution } from "../measurement-engine";
import {
  advanceMeasurementCycle,
  createMeasurementCycle,
  MeasurementCycleStatus,
} from "./index";
import type {
  AdvanceMeasurementCycleResult,
  AdvanceMeasurementCycleSuccess,
  Certification,
  MeasurementBulletin,
  MeasurementCycle,
  TimelineEvent,
} from "./index";

const cycleId = "measurement-cycle-8";
const contractId = "contract-baseline-lagoa-do-arroz";
const projectId = "project-lagoa-do-arroz";
const workPackageId = "work-package-terraplenagem";
const serviceItemId = "service-item-escavacao";
const measurementPeriodId = "measurement-period-8";
const correlationId = "measurement-correlation-8";

runTest("creates measurement cycle", () => {
  const cycle = createMeasurementCycleFixture();

  assertEqual(cycle.id, cycleId, "cycle id mismatch");
  assertEqual(cycle.contractId, contractId, "contract id mismatch");
  assertEqual(cycle.projectId, projectId, "project id mismatch");
  assertEqual(cycle.status, MeasurementCycleStatus.Draft, "status mismatch");
  assertEqual(cycle.measurementExecutions.length, 1, "execution count mismatch");
  assertEqual(cycle.measurementResults.length, 1, "result count mismatch");
});

runTest("generates bulletin through workflow transition input", () => {
  const measured = advanceToMeasured(createMeasurementCycleFixture());
  assertTransitionSuccess(measured, "measured transition failed");
  const bulletin = createMeasurementBulletinFixture();
  const result = advanceMeasurementCycle({
    measurementCycle: measured.measurementCycle,
    toStatus: MeasurementCycleStatus.BulletinGenerated,
    timelineEvent: createTimelineEvent("timeline-bulletin", "measurement_bulletin_generated"),
    measurementBulletins: [bulletin],
  });

  assertTransitionSuccess(result, "bulletin transition failed");
  assertEqual(
    result.measurementCycle.status,
    MeasurementCycleStatus.BulletinGenerated,
    "status mismatch",
  );
  assertEqual(result.measurementCycle.measurementBulletins.length, 1, "bulletin count mismatch");
  assertEqual(
    result.measurementCycle.measurementBulletins[0]?.totalMeasuredValue,
    1270,
    "bulletin measured value mismatch",
  );
});

runTest("certifies measurement cycle through workflow transition input", () => {
  const bulletinGenerated = advanceToBulletinGenerated(createMeasurementCycleFixture());
  const certification = createCertificationFixture();
  const result = advanceMeasurementCycle({
    measurementCycle: bulletinGenerated,
    toStatus: MeasurementCycleStatus.Certified,
    timelineEvent: createTimelineEvent("timeline-certified", "measurement_certified"),
    certifications: [certification],
  });

  assertTransitionSuccess(result, "certification transition failed");
  assertEqual(
    result.measurementCycle.status,
    MeasurementCycleStatus.Certified,
    "status mismatch",
  );
  assertEqual(result.measurementCycle.certifications.length, 1, "certification count mismatch");
  assertEqual(
    result.measurementCycle.certifications[0]?.certified,
    true,
    "certified mismatch",
  );
});

runTest("creates deterministic timeline events", () => {
  const measured = advanceToMeasured(createMeasurementCycleFixture());

  assertTransitionSuccess(measured, "measured transition failed");
  assertEqual(measured.measurementCycle.timeline.length, 1, "timeline count mismatch");
  assertEqual(
    measured.measurementCycle.timeline[0]?.metadata["correlationId"],
    correlationId,
    "timeline correlation mismatch",
  );
  assertEqual(
    measured.measurementCycle.timeline[0]?.metadata["contractId"],
    contractId,
    "timeline contract mismatch",
  );
  assertEqual(
    measured.measurementCycle.timeline[0]?.metadata["projectId"],
    projectId,
    "timeline project mismatch",
  );
  assertEqual(
    measured.measurementCycle.timeline[0]?.metadata["measurementId"],
    cycleId,
    "timeline measurement id mismatch",
  );
});

runTest("allows valid transitions", () => {
  const measured = advanceToMeasured(createMeasurementCycleFixture());
  assertTransitionSuccess(measured, "draft to measured failed");
  const bulletinGenerated = advanceToBulletinGenerated(measured.measurementCycle);
  const certified = advanceMeasurementCycle({
    measurementCycle: bulletinGenerated,
    toStatus: MeasurementCycleStatus.Certified,
    timelineEvent: createTimelineEvent("timeline-certified", "measurement_certified"),
    certifications: [createCertificationFixture()],
  });
  assertTransitionSuccess(certified, "bulletin to certified failed");
  const closed = advanceMeasurementCycle({
    measurementCycle: certified.measurementCycle,
    toStatus: MeasurementCycleStatus.Closed,
    timelineEvent: createTimelineEvent("timeline-closed", "measurement_cycle_closed"),
  });

  assertTransitionSuccess(closed, "certified to closed failed");
  assertEqual(closed.measurementCycle.status, MeasurementCycleStatus.Closed, "closed mismatch");
});

runTest("rejects invalid transitions", () => {
  const result = advanceMeasurementCycle({
    measurementCycle: createMeasurementCycleFixture(),
    toStatus: MeasurementCycleStatus.Certified,
    timelineEvent: createTimelineEvent("timeline-invalid", "measurement_certified"),
  });

  assertTransitionFailure(result, "expected invalid transition");
  assertEqual(
    result.error.code,
    "invalid_measurement_cycle_transition",
    "error code mismatch",
  );
  assertEqual(result.error.from, MeasurementCycleStatus.Draft, "from status mismatch");
  assertEqual(result.error.to, MeasurementCycleStatus.Certified, "to status mismatch");
});

runTest("deterministic output", () => {
  const first = JSON.stringify(createMeasurementCycleFixture());
  const second = JSON.stringify(createMeasurementCycleFixture());

  assertEqual(first, second, "expected deterministic output");
});

runTest("returns immutable aggregate", () => {
  const cycle = createMeasurementCycleFixture();
  const measured = advanceToMeasured(cycle);
  assertTransitionSuccess(measured, "measured transition failed");

  assertEqual(Object.isFrozen(cycle), true, "cycle should be frozen");
  assertEqual(Object.isFrozen(cycle.measurementExecutions), true, "executions should be frozen");
  assertEqual(Object.isFrozen(cycle.measurementResults), true, "results should be frozen");
  assertEqual(
    Object.isFrozen(measured.measurementCycle.timeline),
    true,
    "timeline should be frozen",
  );
  assertEqual(
    Object.isFrozen(measured.measurementCycle.timeline[0]),
    true,
    "timeline event should be frozen",
  );
});

runTest("preserves traceability", () => {
  const cycle = createMeasurementCycleFixture();
  const result = advanceToMeasured(cycle);

  assertTransitionSuccess(result, "measured transition failed");
  assertEqual(cycle.contractId, contractId, "cycle contract mismatch");
  assertEqual(cycle.projectId, projectId, "cycle project mismatch");
  assertEqual(cycle.metadata["correlationId"], correlationId, "cycle correlation mismatch");
  const measurementExecutionIds =
    result.measurementCycle.timeline[0]?.metadata["measurementExecutionIds"];

  assertEqual(Array.isArray(measurementExecutionIds), true, "execution trace type mismatch");
  assertEqual(
    (measurementExecutionIds as ReadonlyArray<string>).join(","),
    "measurement-execution-1",
    "execution trace mismatch",
  );
});

runTest("preserves metadata", () => {
  const cycle = createMeasurementCycleFixture();
  const result = advanceMeasurementCycle({
    measurementCycle: cycle,
    toStatus: MeasurementCycleStatus.Measured,
    timelineEvent: createTimelineEvent("timeline-measured", "measurement_measured", {
      source: "field-engineer",
    }),
    metadata: {
      reviewedBy: "measurement-office",
    },
  });

  assertTransitionSuccess(result, "measured transition failed");
  assertEqual(result.measurementCycle.metadata["source"], "workflow-test", "source mismatch");
  assertEqual(
    result.measurementCycle.metadata["reviewedBy"],
    "measurement-office",
    "transition metadata mismatch",
  );
  assertEqual(
    result.measurementCycle.timeline[0]?.metadata["source"],
    "field-engineer",
    "timeline metadata mismatch",
  );
});

function createMeasurementCycleFixture(): MeasurementCycle {
  const execution = createMeasurementExecutionFixture();
  const period = createMeasurementPeriodFixture();
  const result = createMeasurementResultFixture(execution, period);

  return createMeasurementCycle({
    id: cycleId,
    contractId,
    projectId,
    period,
    measurementExecutions: [execution],
    measurementResults: [result],
    correlationId,
    metadata: {
      source: "workflow-test",
    },
  });
}

function createMeasurementResultFixture(
  execution: MeasurementExecution,
  period: MeasurementPeriod,
): MeasurementResult {
  return createMeasurement(execution, createServiceItemFixture(), period);
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
    id: "measurement-bulletin-8",
    measurementId: cycleId,
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

function createCertificationFixture(): Certification {
  return {
    id: "certification-8",
    bulletinId: "measurement-bulletin-8",
    certified: true,
    certifiedBy: "Fiscalizacao DNOCS",
    certificationDate: "2026-07-02",
    observations: "Servicos efetivamente executados.",
    metadata: {
      source: "fiscalization",
    },
  };
}

function createTimelineEvent(
  id: string,
  type: string,
  metadata: Record<string, unknown> = {},
): TimelineEvent {
  return {
    id,
    type,
    occurredAt: "2026-07-02T10:00:00.000Z",
    actor: "measurement-office",
    description: type,
    metadata,
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

function advanceToMeasured(cycle: MeasurementCycle) {
  return advanceMeasurementCycle({
    measurementCycle: cycle,
    toStatus: MeasurementCycleStatus.Measured,
    timelineEvent: createTimelineEvent("timeline-measured", "measurement_measured"),
  });
}

function advanceToBulletinGenerated(cycle: MeasurementCycle): MeasurementCycle {
  const measured =
    cycle.status === MeasurementCycleStatus.Measured ? { success: true as const, measurementCycle: cycle } : advanceToMeasured(cycle);
  assertTransitionSuccess(measured, "measured transition failed");
  const bulletinGenerated = advanceMeasurementCycle({
    measurementCycle: measured.measurementCycle,
    toStatus: MeasurementCycleStatus.BulletinGenerated,
    timelineEvent: createTimelineEvent("timeline-bulletin", "measurement_bulletin_generated"),
    measurementBulletins: [createMeasurementBulletinFixture()],
  });

  assertTransitionSuccess(bulletinGenerated, "bulletin transition failed");
  return bulletinGenerated.measurementCycle;
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

function assertTransitionSuccess(
  result: AdvanceMeasurementCycleResult,
  message: string,
): asserts result is AdvanceMeasurementCycleSuccess {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertTransitionFailure(
  result: AdvanceMeasurementCycleResult,
  message: string,
): asserts result is Extract<AdvanceMeasurementCycleResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
