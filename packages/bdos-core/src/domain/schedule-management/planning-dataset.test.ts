import { createScheduleActivity } from "./schedule-management";
import {
  buildPlanningDatasetFromScheduleActivities,
  toScheduleActivityInputsFromPlanningDataset,
  toWorkPackageInputsFromPlanningDataset,
} from "./planning-dataset";
import { WorkPackageType } from "../work-package-management";
import type { CreateScheduleActivityInput, ScheduleActivity } from "./schedule-management.types";
import type { PlanningActivityRecord, PlanningDataset } from "./planning-dataset.types";

runTest("buildPlanningDatasetFromScheduleActivities wraps a real ScheduleActivity without altering it", () => {
  const activity = createActivityFixture({ id: "activity-1", percentComplete: 42 });

  const dataset = buildPlanningDatasetFromScheduleActivities([activity], {
    sourceType: "ms-project-xml",
    fileName: "cronograma.xml",
    sheetName: null,
    importedAt: "2026-07-06T00:00:00.000Z",
  });

  assertEqual(dataset.detectedType, "cronograma", "expected cronograma detected type");
  assertEqual(dataset.activities.length, 1, "expected 1 activity");
  assertEqual(dataset.activities[0]?.plannedStart, activity.plannedStart, "planned start should be preserved");
  assertEqual(dataset.activities[0]?.percentActual, 42, "percentActual should mirror percentComplete");
});

runTest("toWorkPackageInputsFromPlanningDataset maps isSummary to ScopeGroup and leaves to ExecutionFront", () => {
  const dataset = datasetFixture([
    planningActivityFixture({ id: "a1", isSummary: true }),
    planningActivityFixture({ id: "a2", isSummary: false, parentId: "a1" }),
  ]);

  const inputs = toWorkPackageInputsFromPlanningDataset(dataset);

  assertEqual(inputs.find((input) => input.id === "a1")?.type, WorkPackageType.ScopeGroup, "summary row should become ScopeGroup");
  assertEqual(inputs.find((input) => input.id === "a2")?.type, WorkPackageType.ExecutionFront, "leaf row should become ExecutionFront");
  assertEqual(inputs.find((input) => input.id === "a2")?.parentWorkPackageId, "a1", "parent id should be preserved");
});

runTest("toScheduleActivityInputsFromPlanningDataset only converts records with real dates and duration", () => {
  const dataset = datasetFixture([
    planningActivityFixture({ id: "with-dates", plannedStart: "2026-01-01", plannedEnd: "2026-01-08", durationDays: 7 }),
    planningActivityFixture({ id: "without-dates", plannedStart: null, plannedEnd: null, durationDays: null }),
  ]);

  const conversion = toScheduleActivityInputsFromPlanningDataset(dataset, {
    projectId: "project-1",
    correlationId: "correlation-1",
    createdBy: "tester",
    sourceSystem: "test",
  });

  assertEqual(conversion.inputs.length, 1, "expected only the dated record to convert");
  assertEqual(conversion.inputs[0]?.id, "with-dates", "expected the dated record to be the one converted");
  assertEqual(conversion.skippedIds, ["without-dates"], "expected the undated record to be reported as skipped");
});

function createActivityFixture(overrides: Partial<CreateScheduleActivityInput> = {}): ScheduleActivity {
  const result = createScheduleActivity({
    id: overrides.id ?? "activity-1",
    projectId: "project-1",
    code: "1",
    name: "Atividade de teste",
    sequence: 0,
    plannedStart: "2026-01-01",
    plannedEnd: "2026-01-08",
    durationDays: 7,
    percentComplete: overrides.percentComplete ?? 0,
    correlationId: "correlation-1",
    createdBy: "tester",
    sourceSystem: "test",
    ...overrides,
  });

  if (!result.success) {
    throw new Error("expected fixture activity creation to succeed");
  }

  return result.activity;
}

function planningActivityFixture(overrides: Partial<PlanningActivityRecord> = {}): PlanningActivityRecord {
  return {
    id: "activity-1",
    code: "1",
    name: "Atividade de teste",
    parentId: null,
    sequence: 0,
    isSummary: false,
    isMilestone: false,
    plannedStart: null,
    plannedEnd: null,
    durationDays: null,
    percentPlanned: null,
    percentActual: null,
    plannedValue: null,
    actualValue: null,
    weight: null,
    dependencies: [],
    ...overrides,
  };
}

function datasetFixture(activities: ReadonlyArray<PlanningActivityRecord>): PlanningDataset {
  return {
    origin: { sourceType: "excel", fileName: "teste.xlsx", sheetName: "Planilha", importedAt: "2026-07-06T00:00:00.000Z" },
    detectedType: "fisico-financeiro",
    activities,
    periodSeries: [],
    financial: null,
    warnings: [],
  };
}

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
