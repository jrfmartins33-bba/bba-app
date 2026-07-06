import type { CalculateCriticalPathResult, ScheduleActivity, ScheduleSCurvePoint } from "../../domain/schedule-management";

export interface SimulateScheduleDelayInput {
  readonly activities: ReadonlyArray<ScheduleActivity>;
  readonly activityId: string;
  readonly delayDays: number;
  readonly asOfDate: string;
}

export interface SimulateScheduleDelayResult {
  readonly activities: ReadonlyArray<ScheduleActivity>;
  readonly criticalPath: CalculateCriticalPathResult;
  readonly sCurve: ReadonlyArray<ScheduleSCurvePoint>;
  /** `false` quando nenhuma atividade tem dependências — o caminho crítico recalculado não tem nenhum efeito cascata real para mostrar. */
  readonly hasDependencies: boolean;
}
