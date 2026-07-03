export type EngineeringProjectContextMetadata = Readonly<Record<string, unknown>>;

export type EngineeringProjectContextId = string;

export type EngineeringProjectContextActor = string;

export type EngineeringProjectContextOccurredAt = string;

export type EngineeringProjectContextCorrelationId = string;

export type EngineeringProjectContextCreatedBy = string;

export type EngineeringProjectContextSourceSystem = string;

export type EngineeringMilestoneId = string;

export type EngineeringWorkFrontId = string;

export type EngineeringSegmentId = string;

export type EngineeringStructureId = string;

export enum EngineeringProjectContextStatus {
  Draft = "Draft",
  Planned = "Planned",
  InExecution = "InExecution",
  Suspended = "Suspended",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export enum EngineeringMilestoneStatus {
  Pending = "Pending",
  Completed = "Completed",
  Delayed = "Delayed",
}

export interface EngineeringMilestone {
  readonly id: EngineeringMilestoneId;
  readonly name: string;
  readonly description: string;
  readonly plannedDate: string;
  readonly actualDate: string | null;
  readonly status: EngineeringMilestoneStatus;
  readonly metadata: EngineeringProjectContextMetadata;
}

export interface EngineeringMilestoneInput {
  readonly id: EngineeringMilestoneId;
  readonly name: string;
  readonly description: string;
  readonly plannedDate: string;
  readonly actualDate?: string | null;
  readonly status?: EngineeringMilestoneStatus;
  readonly metadata?: EngineeringProjectContextMetadata;
}

export enum EngineeringWorkFrontStatus {
  NotStarted = "NotStarted",
  InProgress = "InProgress",
  Completed = "Completed",
  Suspended = "Suspended",
}

export interface EngineeringWorkFront {
  readonly id: EngineeringWorkFrontId;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly status: EngineeringWorkFrontStatus;
  readonly metadata: EngineeringProjectContextMetadata;
}

export interface EngineeringWorkFrontInput {
  readonly id: EngineeringWorkFrontId;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly status?: EngineeringWorkFrontStatus;
  readonly metadata?: EngineeringProjectContextMetadata;
}

export interface EngineeringSegment {
  readonly id: EngineeringSegmentId;
  readonly workFrontId: EngineeringWorkFrontId | null;
  readonly code: string;
  readonly name: string;
  readonly startReference: string;
  readonly endReference: string;
  readonly extensionMeters: number | null;
  readonly metadata: EngineeringProjectContextMetadata;
}

export interface EngineeringSegmentInput {
  readonly id: EngineeringSegmentId;
  readonly workFrontId?: EngineeringWorkFrontId | null;
  readonly code: string;
  readonly name: string;
  readonly startReference: string;
  readonly endReference: string;
  readonly extensionMeters?: number | null;
  readonly metadata?: EngineeringProjectContextMetadata;
}

export interface EngineeringStructure {
  readonly id: EngineeringStructureId;
  readonly segmentId: EngineeringSegmentId | null;
  readonly code: string;
  readonly name: string;
  readonly structureType: string;
  readonly metadata: EngineeringProjectContextMetadata;
}

export interface EngineeringStructureInput {
  readonly id: EngineeringStructureId;
  readonly segmentId?: EngineeringSegmentId | null;
  readonly code: string;
  readonly name: string;
  readonly structureType: string;
  readonly metadata?: EngineeringProjectContextMetadata;
}

export interface EngineeringBaselineSchedule {
  readonly startDate: string;
  readonly endDate: string;
  readonly durationMonths: number | null;
  readonly metadata: EngineeringProjectContextMetadata;
}

export interface EngineeringBaselineScheduleInput {
  readonly startDate: string;
  readonly endDate: string;
  readonly durationMonths?: number | null;
  readonly metadata?: EngineeringProjectContextMetadata;
}

export enum EngineeringKpiUnit {
  Percentage = "percentage",
  Currency = "currency",
  Count = "count",
  Days = "days",
  None = "none",
}

export interface EngineeringProjectKpi {
  readonly code: string;
  readonly label: string;
  readonly value: number;
  readonly unit: EngineeringKpiUnit;
  readonly metadata: EngineeringProjectContextMetadata;
}

export interface EngineeringProjectKpiInput {
  readonly code: string;
  readonly label: string;
  readonly value: number;
  readonly unit: EngineeringKpiUnit;
  readonly metadata?: EngineeringProjectContextMetadata;
}

/**
 * Curated, business-readable record of the project's own temporal
 * narrative (creation, status transitions, contractual milestones) —
 * distinct from `trace`, which is the full technical audit record of
 * every mutation on the aggregate, including structural additions
 * (work fronts/segments/structures) that are not "moments in time".
 */
export interface EngineeringProjectContextTimelineEvent {
  readonly type: string;
  readonly occurredAt: EngineeringProjectContextOccurredAt;
  readonly description: string;
  readonly metadata: EngineeringProjectContextMetadata;
}

export interface EngineeringProjectContextTrace {
  readonly action: string;
  readonly actor: EngineeringProjectContextActor;
  readonly occurredAt: EngineeringProjectContextOccurredAt;
  readonly description: string;
  readonly metadata: EngineeringProjectContextMetadata;
}

export interface EngineeringProjectContextSummary {
  readonly totalMilestones: number;
  readonly completedMilestones: number;
  readonly delayedMilestones: number;
  readonly totalWorkFronts: number;
  readonly totalSegments: number;
  readonly totalStructures: number;
  readonly totalKpis: number;
}

/**
 * Aggregate root for the executive/technical context of an engineering
 * project executed under a public contract. References the contract
 * (EngineeringContract) only by id — never by direct import — preserving
 * aggregate boundaries. Does not compute real measurement, does not
 * generate an S-curve, does not import spreadsheet data and does not
 * perform document reconstruction: it only represents the technical
 * context of the work itself.
 */
export interface EngineeringProjectContext {
  readonly id: EngineeringProjectContextId;
  readonly engineeringContractId: string;
  readonly projectCode: string;
  readonly projectName: string;
  readonly objectDescription: string;
  readonly location: string | null;
  readonly city: string;
  readonly state: string;
  readonly technicalDiscipline: string | null;
  readonly executionMethod: string | null;
  readonly status: EngineeringProjectContextStatus;
  readonly baselineSchedule: EngineeringBaselineSchedule | null;
  readonly scurveReference: string | null;
  readonly milestones: ReadonlyArray<EngineeringMilestone>;
  readonly workFronts: ReadonlyArray<EngineeringWorkFront>;
  readonly segments: ReadonlyArray<EngineeringSegment>;
  readonly structures: ReadonlyArray<EngineeringStructure>;
  readonly kpis: ReadonlyArray<EngineeringProjectKpi>;
  readonly timeline: ReadonlyArray<EngineeringProjectContextTimelineEvent>;
  readonly trace: ReadonlyArray<EngineeringProjectContextTrace>;
  readonly metadata: EngineeringProjectContextMetadata;
}

export interface CreateEngineeringProjectContextInput {
  readonly id: EngineeringProjectContextId;
  readonly engineeringContractId: string;
  readonly projectCode: string;
  readonly projectName: string;
  readonly objectDescription: string;
  readonly location?: string | null;
  readonly city: string;
  readonly state: string;
  readonly technicalDiscipline?: string | null;
  readonly executionMethod?: string | null;
  readonly baselineSchedule?: EngineeringBaselineScheduleInput | null;
  readonly scurveReference?: string | null;
  readonly milestones?: ReadonlyArray<EngineeringMilestoneInput> | null;
  readonly workFronts?: ReadonlyArray<EngineeringWorkFrontInput> | null;
  readonly segments?: ReadonlyArray<EngineeringSegmentInput> | null;
  readonly structures?: ReadonlyArray<EngineeringStructureInput> | null;
  readonly kpis?: ReadonlyArray<EngineeringProjectKpiInput> | null;
  readonly actor: EngineeringProjectContextActor;
  readonly occurredAt: EngineeringProjectContextOccurredAt;
  readonly correlationId: EngineeringProjectContextCorrelationId;
  readonly createdBy: EngineeringProjectContextCreatedBy;
  readonly sourceSystem: EngineeringProjectContextSourceSystem;
  readonly metadata?: EngineeringProjectContextMetadata;
}

export interface AdvanceEngineeringProjectContextStatusInput {
  readonly projectContext: EngineeringProjectContext;
  readonly toStatus: EngineeringProjectContextStatus;
  readonly actor: EngineeringProjectContextActor;
  readonly occurredAt: EngineeringProjectContextOccurredAt;
  readonly metadata?: EngineeringProjectContextMetadata;
}

export interface AddEngineeringProjectMilestoneInput {
  readonly projectContext: EngineeringProjectContext;
  readonly milestone: EngineeringMilestoneInput;
  readonly actor: EngineeringProjectContextActor;
  readonly occurredAt: EngineeringProjectContextOccurredAt;
  readonly metadata?: EngineeringProjectContextMetadata;
}

export interface AddEngineeringWorkFrontInput {
  readonly projectContext: EngineeringProjectContext;
  readonly workFront: EngineeringWorkFrontInput;
  readonly actor: EngineeringProjectContextActor;
  readonly occurredAt: EngineeringProjectContextOccurredAt;
  readonly metadata?: EngineeringProjectContextMetadata;
}

export interface AddEngineeringSegmentInput {
  readonly projectContext: EngineeringProjectContext;
  readonly segment: EngineeringSegmentInput;
  readonly actor: EngineeringProjectContextActor;
  readonly occurredAt: EngineeringProjectContextOccurredAt;
  readonly metadata?: EngineeringProjectContextMetadata;
}

export interface AddEngineeringStructureInput {
  readonly projectContext: EngineeringProjectContext;
  readonly structure: EngineeringStructureInput;
  readonly actor: EngineeringProjectContextActor;
  readonly occurredAt: EngineeringProjectContextOccurredAt;
  readonly metadata?: EngineeringProjectContextMetadata;
}

export type EngineeringProjectContextErrorCode =
  | "missing_id"
  | "missing_engineering_contract_id"
  | "missing_project_code"
  | "missing_project_name"
  | "missing_object_description"
  | "missing_city"
  | "missing_state"
  | "missing_milestone_id"
  | "duplicate_milestone_id"
  | "incoherent_milestone_date"
  | "missing_work_front_id"
  | "duplicate_work_front_id"
  | "missing_segment_id"
  | "duplicate_segment_id"
  | "unknown_work_front_reference"
  | "missing_structure_id"
  | "duplicate_structure_id"
  | "unknown_segment_reference"
  | "incoherent_baseline_schedule"
  | "negative_kpi_value"
  | "invalid_kpi_percentage"
  | "project_context_terminal"
  | "invalid_project_context_status_transition";

export interface EngineeringProjectContextError {
  readonly code: EngineeringProjectContextErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: EngineeringProjectContextMetadata;
}

export type EngineeringProjectContextWarningCode = "none";

export interface EngineeringProjectContextWarning {
  readonly code: EngineeringProjectContextWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: EngineeringProjectContextMetadata;
}

export interface EngineeringProjectContextSuccess {
  readonly success: true;
  readonly projectContext: EngineeringProjectContext;
  readonly errors: ReadonlyArray<EngineeringProjectContextError>;
  readonly warnings: ReadonlyArray<EngineeringProjectContextWarning>;
  readonly metadata: EngineeringProjectContextMetadata;
}

export interface EngineeringProjectContextFailure {
  readonly success: false;
  readonly projectContext: null;
  readonly errors: ReadonlyArray<EngineeringProjectContextError>;
  readonly warnings: ReadonlyArray<EngineeringProjectContextWarning>;
  readonly metadata: EngineeringProjectContextMetadata;
}

export type EngineeringProjectContextResult =
  | EngineeringProjectContextSuccess
  | EngineeringProjectContextFailure;
