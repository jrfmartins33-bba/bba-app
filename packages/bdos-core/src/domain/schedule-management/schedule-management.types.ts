export type ScheduleManagementMetadata = Readonly<Record<string, unknown>>;

export type ScheduleActivityId = string;

export type ScheduleProjectId = string;

export type ScheduleActivityCode = string;

export type ScheduleActivityName = string;

export type ScheduleDate = string;

export type ScheduleCorrelationId = string;

export type ScheduleCreatedBy = string;

export type ScheduleSourceSystem = string;

export enum ScheduleActivityStatus {
  NotStarted = "NotStarted",
  InProgress = "InProgress",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export enum ScheduleDependencyType {
  FinishToStart = "FinishToStart",
  StartToStart = "StartToStart",
  FinishToFinish = "FinishToFinish",
  StartToFinish = "StartToFinish",
}

export interface ScheduleActivityDependency {
  readonly predecessorId: ScheduleActivityId;
  readonly type: ScheduleDependencyType;
  readonly lagDays: number;
}

/**
 * A frozen copy of the planned dates at the moment the schedule was
 * baselined — "Linha de base" (Fase 1). Re-baselining is a deliberate,
 * explicit act (`baselineScheduleActivity`), never an implicit
 * side-effect of updating progress.
 */
export interface ScheduleActivityBaseline {
  readonly plannedStart: ScheduleDate;
  readonly plannedEnd: ScheduleDate;
  readonly durationDays: number;
  readonly baselinedAt: ScheduleDate;
}

export interface ScheduleActivity {
  readonly id: ScheduleActivityId;
  readonly projectId: ScheduleProjectId;
  readonly code: ScheduleActivityCode;
  readonly name: ScheduleActivityName;
  readonly parentActivityId: ScheduleActivityId | null;
  readonly sequence: number;
  /** Linha estrutural da EAP (agrupamento) — nunca entra no caminho crítico. */
  readonly isSummary: boolean;
  readonly isMilestone: boolean;
  readonly plannedStart: ScheduleDate;
  readonly plannedEnd: ScheduleDate;
  readonly durationDays: number;
  readonly actualStart: ScheduleDate | null;
  readonly actualEnd: ScheduleDate | null;
  readonly percentComplete: number;
  readonly status: ScheduleActivityStatus;
  readonly dependencies: ReadonlyArray<ScheduleActivityDependency>;
  readonly baseline: ScheduleActivityBaseline | null;
  readonly metadata: ScheduleManagementMetadata;
}

export interface CreateScheduleActivityInput {
  readonly id: ScheduleActivityId;
  readonly projectId: ScheduleProjectId;
  readonly code: ScheduleActivityCode;
  readonly name: ScheduleActivityName;
  readonly parentActivityId?: ScheduleActivityId | null;
  readonly sequence: number;
  readonly isSummary?: boolean;
  readonly isMilestone?: boolean;
  readonly plannedStart: ScheduleDate;
  readonly plannedEnd: ScheduleDate;
  readonly durationDays: number;
  readonly percentComplete?: number;
  readonly dependencies?: ReadonlyArray<ScheduleActivityDependency>;
  readonly correlationId: ScheduleCorrelationId;
  readonly createdBy: ScheduleCreatedBy;
  readonly sourceSystem: ScheduleSourceSystem;
  readonly metadata?: ScheduleManagementMetadata;
}

export interface UpdateActivityProgressInput {
  readonly activity: ScheduleActivity;
  readonly percentComplete: number;
  readonly actualStart?: ScheduleDate | null;
  readonly actualEnd?: ScheduleDate | null;
  readonly metadata?: ScheduleManagementMetadata;
}

export interface BaselineScheduleActivityInput {
  readonly activity: ScheduleActivity;
  readonly occurredAt: ScheduleDate;
  readonly metadata?: ScheduleManagementMetadata;
}

export type ScheduleManagementErrorCode =
  | "missing_project_id"
  | "missing_code"
  | "missing_name"
  | "invalid_sequence"
  | "invalid_planned_period"
  | "invalid_duration"
  | "invalid_percent_complete"
  | "unknown_predecessor";

export interface ScheduleManagementError {
  readonly code: ScheduleManagementErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ScheduleManagementMetadata;
}

export type ScheduleManagementWarningCode = "none";

export interface ScheduleManagementWarning {
  readonly code: ScheduleManagementWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ScheduleManagementMetadata;
}

export interface ScheduleManagementSuccess {
  readonly success: true;
  readonly activity: ScheduleActivity;
  readonly errors: ReadonlyArray<ScheduleManagementError>;
  readonly warnings: ReadonlyArray<ScheduleManagementWarning>;
  readonly metadata: ScheduleManagementMetadata;
}

export interface ScheduleManagementFailure {
  readonly success: false;
  readonly activity: null;
  readonly errors: ReadonlyArray<ScheduleManagementError>;
  readonly warnings: ReadonlyArray<ScheduleManagementWarning>;
  readonly metadata: ScheduleManagementMetadata;
}

export type ScheduleManagementResult = ScheduleManagementSuccess | ScheduleManagementFailure;

/** Fase 1 — Caminho crítico (CPM: passada de ida/volta). */
export interface CriticalPathActivityResult {
  readonly activityId: ScheduleActivityId;
  readonly earlyStart: number;
  readonly earlyFinish: number;
  readonly lateStart: number;
  readonly lateFinish: number;
  readonly totalFloatDays: number;
  readonly isCritical: boolean;
}

export interface CalculateCriticalPathResult {
  readonly activities: ReadonlyArray<CriticalPathActivityResult>;
  readonly criticalActivityIds: ReadonlyArray<ScheduleActivityId>;
  readonly projectDurationDays: number;
}

/** Fase 1 — Curva S (progresso físico, ponderado por duração — não é curva de custo, não há dado financeiro nesta camada). */
export interface ScheduleSCurvePoint {
  readonly date: ScheduleDate;
  readonly plannedPercent: number;
  /** `null` para datas futuras em relação a `asOfDate` — progresso real ainda não existe, nunca é projetado. */
  readonly actualPercent: number | null;
}
