import {
  ScheduleActivityStatus,
  ScheduleDependencyType,
  baselineScheduleActivity,
  buildScheduleSCurve,
  calculateCriticalPath,
  createScheduleActivity,
  updateActivityProgress,
  type CreateScheduleActivityInput,
  type ScheduleActivity,
  type ScheduleManagementResult,
} from "./index";

const projectId = "project-lagoa-do-arroz";
const correlationId = "schedule-management-correlation-001";
const createdBy = "project-controls";
const sourceSystem = "bba-project-import";

runTest("valid creation", () => {
  const result = createScheduleActivity(createActivityInputFixture());

  assertActivitySuccess(result, "expected activity creation success");
  assertEqual(result.activity.id, "activity-concretagem-bloco-3", "activity id mismatch");
  assertEqual(result.activity.projectId, projectId, "project id mismatch");
  assertEqual(result.activity.durationDays, 5, "duration mismatch");
  assertEqual(result.activity.status, ScheduleActivityStatus.NotStarted, "initial status mismatch");
  assertEqual(result.activity.baseline, null, "baseline should start null");
});

runTest("rejects missing projectId", () => {
  const result = createScheduleActivity(createActivityInputFixture({ projectId: "" }));
  assertActivityFailure(result, "expected missing project id failure");
  assertEqual(result.errors[0]?.code, "missing_project_id", "error code mismatch");
});

runTest("rejects missing code", () => {
  const result = createScheduleActivity(createActivityInputFixture({ code: "" }));
  assertActivityFailure(result, "expected missing code failure");
  assertEqual(result.errors[0]?.code, "missing_code", "error code mismatch");
});

runTest("rejects missing name", () => {
  const result = createScheduleActivity(createActivityInputFixture({ name: "" }));
  assertActivityFailure(result, "expected missing name failure");
  assertEqual(result.errors[0]?.code, "missing_name", "error code mismatch");
});

runTest("rejects negative sequence", () => {
  const result = createScheduleActivity(createActivityInputFixture({ sequence: -1 }));
  assertActivityFailure(result, "expected invalid sequence failure");
  assertEqual(result.errors[0]?.code, "invalid_sequence", "error code mismatch");
});

runTest("rejects negative duration", () => {
  const result = createScheduleActivity(createActivityInputFixture({ durationDays: -1 }));
  assertActivityFailure(result, "expected invalid duration failure");
  assertEqual(result.errors[0]?.code, "invalid_duration", "error code mismatch");
});

runTest("rejects planned end before planned start", () => {
  const result = createScheduleActivity(
    createActivityInputFixture({ plannedStart: "2026-02-10", plannedEnd: "2026-02-01" }),
  );
  assertActivityFailure(result, "expected invalid planned period failure");
  assertEqual(result.errors[0]?.code, "invalid_planned_period", "error code mismatch");
});

runTest("rejects out-of-range percentComplete", () => {
  const result = createScheduleActivity(createActivityInputFixture({ percentComplete: 150 }));
  assertActivityFailure(result, "expected invalid percent complete failure");
  assertEqual(result.errors[0]?.code, "invalid_percent_complete", "error code mismatch");
});

runTest("updateActivityProgress derives status from percentComplete", () => {
  const created = createScheduleActivity(createActivityInputFixture());
  assertActivitySuccess(created, "expected activity creation success");

  const notStarted = updateActivityProgress({ activity: created.activity, percentComplete: 0 });
  assertActivitySuccess(notStarted, "expected progress update success");
  assertEqual(notStarted.activity.status, ScheduleActivityStatus.NotStarted, "0% status mismatch");

  const inProgress = updateActivityProgress({ activity: created.activity, percentComplete: 45 });
  assertActivitySuccess(inProgress, "expected progress update success");
  assertEqual(inProgress.activity.status, ScheduleActivityStatus.InProgress, "45% status mismatch");

  const completed = updateActivityProgress({ activity: created.activity, percentComplete: 100 });
  assertActivitySuccess(completed, "expected progress update success");
  assertEqual(completed.activity.status, ScheduleActivityStatus.Completed, "100% status mismatch");
});

runTest("updateActivityProgress rejects out-of-range percentComplete", () => {
  const created = createScheduleActivity(createActivityInputFixture());
  assertActivitySuccess(created, "expected activity creation success");

  const result = updateActivityProgress({ activity: created.activity, percentComplete: -5 });
  assertActivityFailure(result, "expected invalid percent complete failure");
  assertEqual(result.errors[0]?.code, "invalid_percent_complete", "error code mismatch");
});

runTest("baselineScheduleActivity freezes current planned dates", () => {
  const created = createScheduleActivity(createActivityInputFixture());
  assertActivitySuccess(created, "expected activity creation success");

  const baselined = baselineScheduleActivity({ activity: created.activity, occurredAt: "2026-01-10T00:00:00.000Z" });
  assertActivitySuccess(baselined, "expected baseline success");
  assertEqual(baselined.activity.baseline?.plannedStart, created.activity.plannedStart, "baseline start mismatch");
  assertEqual(baselined.activity.baseline?.plannedEnd, created.activity.plannedEnd, "baseline end mismatch");
  assertEqual(baselined.activity.baseline?.durationDays, created.activity.durationDays, "baseline duration mismatch");
});

runTest("immutable output", () => {
  const result = createScheduleActivity(createActivityInputFixture());
  assertActivitySuccess(result, "expected activity creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.activity), true, "activity should be frozen");
  assertEqual(Object.isFrozen(result.activity.metadata), true, "metadata should be frozen");
});

runTest("deterministic output", () => {
  const input = createActivityInputFixture();
  const first = JSON.stringify(createScheduleActivity(input));
  const second = JSON.stringify(createScheduleActivity(input));
  assertEqual(first, second, "expected deterministic output");
});

/**
 * Rede de dependências verificada de forma independente (fora deste
 * pacote, via `tsx`, antes de este teste ser escrito) contra o cálculo
 * manual do CPM:
 *
 *   A(3) → B(2) → D(2)
 *   A(3) → C(4) → D(2)
 *
 * ES/EF/LS/LF esperados: A[0,3,0,3] B[3,5,5,7] C[3,7,3,7] D[7,9,7,9].
 * Caminho crítico esperado: A, C, D (float 0); B tem float 2 (folga).
 * Duração total esperada do projeto: 9 dias.
 */
runTest("calculateCriticalPath computes a real forward/backward CPM pass", () => {
  const activities: ScheduleActivity[] = [
    activityFixture("A", 3, []),
    activityFixture("B", 2, ["A"]),
    activityFixture("C", 4, ["A"]),
    activityFixture("D", 2, ["B", "C"]),
  ];

  const result = calculateCriticalPath(activities);

  assertEqual(result.projectDurationDays, 9, "project duration mismatch");
  assertEqual(
    [...result.criticalActivityIds].sort().join(","),
    "A,C,D",
    "critical path mismatch",
  );

  const byId = new Map(result.activities.map((activity) => [activity.activityId, activity]));

  assertEqual(byId.get("A")?.earlyStart, 0, "A early start mismatch");
  assertEqual(byId.get("A")?.earlyFinish, 3, "A early finish mismatch");
  assertEqual(byId.get("A")?.totalFloatDays, 0, "A float mismatch");

  assertEqual(byId.get("B")?.earlyStart, 3, "B early start mismatch");
  assertEqual(byId.get("B")?.earlyFinish, 5, "B early finish mismatch");
  assertEqual(byId.get("B")?.totalFloatDays, 2, "B float mismatch");
  assertEqual(byId.get("B")?.isCritical, false, "B should not be critical");

  assertEqual(byId.get("C")?.earlyStart, 3, "C early start mismatch");
  assertEqual(byId.get("C")?.earlyFinish, 7, "C early finish mismatch");
  assertEqual(byId.get("C")?.totalFloatDays, 0, "C float mismatch");

  assertEqual(byId.get("D")?.earlyStart, 7, "D early start mismatch");
  assertEqual(byId.get("D")?.earlyFinish, 9, "D early finish mismatch");
  assertEqual(byId.get("D")?.totalFloatDays, 0, "D float mismatch");
});

runTest("calculateCriticalPath excludes summary (EAP grouping) rows", () => {
  const activities: ScheduleActivity[] = [
    { ...activityFixture("SUMMARY", 0, []), isSummary: true },
    activityFixture("LEAF", 3, []),
  ];

  const result = calculateCriticalPath(activities);

  assertEqual(result.activities.length, 1, "summary row should not enter the CPM network");
  assertEqual(result.activities[0]?.activityId, "LEAF", "expected only the leaf activity");
});

runTest("buildScheduleSCurve produces monotonic planned progress and nulls the future", () => {
  const activities: ScheduleActivity[] = [
    { ...activityFixture("A", 14, []), percentComplete: 100, actualStart: "2026-01-01" },
    { ...activityFixture("B", 21, [], "2026-01-15"), percentComplete: 40, actualStart: "2026-01-16" },
  ];

  const curve = buildScheduleSCurve(activities, "2026-01-20");

  assertEqual(curve.length > 1, true, "expected more than one S-curve point");

  let previousPlanned = -1;
  curve.forEach((point) => {
    assertEqual(point.plannedPercent >= previousPlanned, true, "planned percent should never decrease");
    previousPlanned = point.plannedPercent;
  });

  const asOfTime = new Date("2026-01-20").getTime();
  const hasFutureNull = curve.some((point) => new Date(point.date).getTime() > asOfTime && point.actualPercent === null);
  const hasPastValue = curve.some((point) => new Date(point.date).getTime() <= asOfTime && point.actualPercent !== null);

  assertEqual(hasFutureNull, true, "actualPercent should be null for dates after asOfDate");
  assertEqual(hasPastValue, true, "actualPercent should be a real number up to asOfDate");
});

function activityFixture(
  id: string,
  durationDays: number,
  dependsOn: ReadonlyArray<string>,
  plannedStart = "2026-01-01",
): ScheduleActivity {
  const created = createScheduleActivity(
    createActivityInputFixture({
      id: `activity-${id}`,
      code: id,
      name: id,
      durationDays,
      plannedStart,
      plannedEnd: addDays(plannedStart, durationDays),
    }),
  );

  assertActivitySuccess(created, `expected fixture activity ${id} creation success`);

  return {
    ...created.activity,
    id,
    dependencies: dependsOn.map((predecessorId) => ({
      predecessorId,
      type: ScheduleDependencyType.FinishToStart,
      lagDays: 0,
    })),
  };
}

function addDays(isoDate: string, days: number): string {
  return new Date(new Date(isoDate).getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function createActivityInputFixture(
  overrides: Partial<CreateScheduleActivityInput> = {},
): CreateScheduleActivityInput {
  return {
    id: overrides.id ?? "activity-concretagem-bloco-3",
    projectId: overrides.projectId ?? projectId,
    code: overrides.code ?? "01.03",
    name: overrides.name ?? "Concretagem do Bloco 3",
    parentActivityId: overrides.parentActivityId ?? null,
    sequence: overrides.sequence ?? 3,
    isSummary: overrides.isSummary ?? false,
    isMilestone: overrides.isMilestone ?? false,
    plannedStart: overrides.plannedStart ?? "2026-02-01",
    plannedEnd: overrides.plannedEnd ?? "2026-02-06",
    durationDays: overrides.durationDays ?? 5,
    percentComplete: overrides.percentComplete ?? 0,
    dependencies: overrides.dependencies ?? [],
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? {},
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

function assertActivitySuccess(
  result: ScheduleManagementResult,
  message: string,
): asserts result is Extract<ScheduleManagementResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertActivityFailure(
  result: ScheduleManagementResult,
  message: string,
): asserts result is Extract<ScheduleManagementResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
