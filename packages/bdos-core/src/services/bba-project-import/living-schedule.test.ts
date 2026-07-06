import { createScheduleActivity, ScheduleDependencyType } from "../../domain/schedule-management";
import { simulateScheduleDelay } from "./living-schedule";
import type { ScheduleActivity } from "../../domain/schedule-management";

/**
 * Reaproveita a mesma rede A(3)→B(2)→D(2) / A(3)→C(4)→D(2) já
 * verificada de forma independente em `schedule-management.test.ts`
 * (duração total 9 dias, caminho crítico A/C/D, B com folga de 2
 * dias) — simular um atraso na última atividade crítica (D, sem
 * sucessores) soma diretamente à duração do projeto: um resultado
 * fácil de conferir à mão.
 */
runTest("simulateScheduleDelay recalculates the critical path when dependencies exist", () => {
  const activities: ScheduleActivity[] = [
    activityFixture("A", 3, []),
    activityFixture("B", 2, ["A"]),
    activityFixture("C", 4, ["A"]),
    activityFixture("D", 2, ["B", "C"]),
  ];

  const result = simulateScheduleDelay({ activities, activityId: "D", delayDays: 3, asOfDate: "2026-01-15" });

  assertEqual(result.hasDependencies, true, "expected the network to report having dependencies");
  assertEqual(result.criticalPath.projectDurationDays, 12, "delaying the last critical activity by 3 days should add exactly 3 days");
  assertEqual(result.criticalPath.criticalActivityIds.includes("D"), true, "D should remain critical after the delay");
});

runTest("simulateScheduleDelay reports hasDependencies=false for an isolated activity", () => {
  const activities: ScheduleActivity[] = [activityFixture("SOLO", 5, [])];

  const result = simulateScheduleDelay({ activities, activityId: "SOLO", delayDays: 3, asOfDate: "2026-01-15" });

  assertEqual(result.hasDependencies, false, "expected no dependencies to be reported for a lone activity");
});

runTest("simulateScheduleDelay never mutates the input array (pure, no persistence)", () => {
  const activities: ScheduleActivity[] = [activityFixture("A", 3, [])];
  const originalDuration = activities[0]?.durationDays;

  simulateScheduleDelay({ activities, activityId: "A", delayDays: 5, asOfDate: "2026-01-15" });

  assertEqual(activities[0]?.durationDays, originalDuration, "the original activities array should remain unchanged");
});

function activityFixture(id: string, durationDays: number, dependsOn: ReadonlyArray<string>): ScheduleActivity {
  const created = createScheduleActivity({
    id: `activity-${id}`,
    projectId: "project-1",
    code: id,
    name: id,
    sequence: 0,
    plannedStart: "2026-01-01",
    plannedEnd: "2026-01-10",
    durationDays,
    correlationId: "correlation-1",
    createdBy: "tester",
    sourceSystem: "test",
  });

  if (!created.success) {
    throw new Error(`expected fixture activity ${id} creation to succeed`);
  }

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

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
