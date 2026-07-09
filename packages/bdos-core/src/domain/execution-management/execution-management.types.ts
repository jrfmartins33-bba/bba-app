// Execution Engine (Epic 16, Fase 16.2) — domain model puro.
//
// Referências cross-agregado (sourceActionId, scheduleActivityId,
// fieldEvidenceId) são sempre strings locais, nunca um tipo importado
// de engines/decision/* ou domain/schedule-management/domain/
// field-evidence — mesmo padrão que Decision.evidence[].sourceReference
// e Recommendation.traceability.evidenceReferences[] já usam em
// produção. execution-management é um OPERATIONAL_DOMAIN (ver
// architecture/engineering-boundaries.test.ts) e nunca importa
// engines/decision diretamente, mesmo para IDs.
//
// Ver packages/bdos-core/docs/EXECUTION_ENGINE.md para a fronteira
// completa e packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md,
// PRINCIPLE 006 ("No Isolated Task"), para a regra que este módulo
// implementa.

export type ExecutionManagementMetadata = Readonly<Record<string, unknown>>;

export type ExecutionWorkflowId = string;
export type ExecutionTaskId = string;

/** Referência a Action.id (engines/decision/action-plan) — nunca importado como tipo. */
export type ExecutionActionId = string;
/** Referência a ActionPlan.id (engines/decision/action-plan) — nunca importado como tipo. */
export type ExecutionActionPlanId = string;
/** Referência opcional a ScheduleActivity.id (domain/schedule-management) — nunca importado como tipo. */
export type ExecutionScheduleActivityId = string;
/** Referência a FieldEvidence.id (domain/field-evidence) — nunca importado como tipo; o dado em si nunca é copiado aqui. */
export type ExecutionFieldEvidenceId = string;

export type ExecutionAssignee = string;
export type ExecutionDateTime = string;
export type ExecutionCorrelationId = string;
export type ExecutionCreatedBy = string;
export type ExecutionSourceSystem = string;

/**
 * Mesma forma de ScheduleActivityStatus (domain/schedule-management) —
 * NotStarted/InProgress/Completed/Cancelled — com um único estado a
 * mais, Blocked, alcançável só a partir de InProgress.
 */
export enum ExecutionTaskStatus {
  NotStarted = "NotStarted",
  InProgress = "InProgress",
  Blocked = "Blocked",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export enum ExecutionTaskBlockReason {
  AwaitingMaterial = "awaiting_material",
  AwaitingApproval = "awaiting_approval",
  FieldCondition = "field_condition",
  AwaitingEvidence = "awaiting_evidence",
  Other = "other",
}

export interface ExecutionTaskBlock {
  readonly reason: ExecutionTaskBlockReason;
  readonly description: string;
  readonly blockedAt: ExecutionDateTime;
}

/**
 * Vínculo, nunca posse — igual a DecisionEvidence
 * (domain/decision) e RecommendationTraceability.evidenceReferences
 * (engines/decision/recommendation). O arquivo/OCR/classificação
 * continuam exclusivamente em domain/field-evidence (Studio de
 * Evidências).
 */
export interface EvidenceReference {
  readonly fieldEvidenceId: ExecutionFieldEvidenceId;
  readonly description: string;
  readonly attachedAt: ExecutionDateTime;
}

export interface ExecutionWorkflow {
  readonly id: ExecutionWorkflowId;
  /** 1:1 com ActionPlan na primeira versão (ver EXECUTION_ENGINE.md, Aggregates candidatos). */
  readonly actionPlanId: ExecutionActionPlanId;
  readonly name: string;
  readonly objective: string;
  readonly ownerRole: string;
  readonly createdAt: ExecutionDateTime;
  readonly metadata: ExecutionManagementMetadata;
}

export interface ExecutionTask {
  readonly id: ExecutionTaskId;
  readonly workflowId: ExecutionWorkflowId;
  /** PRINCIPLE 006 (No Isolated Task) — nunca opcional, nunca nulo. */
  readonly sourceActionId: ExecutionActionId;
  /** Opcional — nem toda Action aponta para uma atividade de cronograma específica (EXECUTION_ENGINE.md, Fronteira com Project Studio). */
  readonly scheduleActivityId: ExecutionScheduleActivityId | null;
  readonly title: string;
  readonly description: string;
  readonly assignee: ExecutionAssignee | null;
  readonly dueDate: ExecutionDateTime | null;
  readonly status: ExecutionTaskStatus;
  readonly block: ExecutionTaskBlock | null;
  readonly evidenceReferences: ReadonlyArray<EvidenceReference>;
  /** "Concluído operacional" — nunca confundir com ImpactConfirmed, que é medido depois pelo Decision Engine (fora deste domínio). */
  readonly completedAt: ExecutionDateTime | null;
  readonly createdAt: ExecutionDateTime;
  readonly updatedAt: ExecutionDateTime;
  readonly metadata: ExecutionManagementMetadata;
}

export interface CreateExecutionWorkflowInput {
  readonly id: ExecutionWorkflowId;
  readonly actionPlanId: ExecutionActionPlanId;
  readonly name: string;
  readonly objective: string;
  readonly ownerRole: string;
  /** Explícito, nunca gerado internamente — mantém a função pura/determinística (mesmo padrão de createDecisionCase). */
  readonly createdAt: ExecutionDateTime;
  readonly correlationId: ExecutionCorrelationId;
  readonly createdBy: ExecutionCreatedBy;
  readonly sourceSystem: ExecutionSourceSystem;
  readonly metadata?: ExecutionManagementMetadata;
}

export interface CreateExecutionTaskInput {
  readonly id: ExecutionTaskId;
  readonly workflowId: ExecutionWorkflowId;
  readonly sourceActionId: ExecutionActionId;
  readonly scheduleActivityId?: ExecutionScheduleActivityId | null;
  readonly title: string;
  readonly description: string;
  readonly assignee?: ExecutionAssignee | null;
  readonly dueDate?: ExecutionDateTime | null;
  /** Explícito, nunca gerado internamente — mantém a função pura/determinística (mesmo padrão de createDecisionCase). */
  readonly createdAt: ExecutionDateTime;
  readonly correlationId: ExecutionCorrelationId;
  readonly createdBy: ExecutionCreatedBy;
  readonly sourceSystem: ExecutionSourceSystem;
  readonly metadata?: ExecutionManagementMetadata;
}

export interface StartExecutionTaskInput {
  readonly task: ExecutionTask;
  readonly occurredAt: ExecutionDateTime;
  readonly metadata?: ExecutionManagementMetadata;
}

export interface BlockExecutionTaskInput {
  readonly task: ExecutionTask;
  readonly reason: ExecutionTaskBlockReason;
  readonly description: string;
  readonly occurredAt: ExecutionDateTime;
  readonly metadata?: ExecutionManagementMetadata;
}

export interface UnblockExecutionTaskInput {
  readonly task: ExecutionTask;
  readonly occurredAt: ExecutionDateTime;
  readonly metadata?: ExecutionManagementMetadata;
}

export interface AttachEvidenceReferenceInput {
  readonly task: ExecutionTask;
  readonly fieldEvidenceId: ExecutionFieldEvidenceId;
  readonly description: string;
  readonly occurredAt: ExecutionDateTime;
  readonly metadata?: ExecutionManagementMetadata;
}

export interface CompleteExecutionTaskInput {
  readonly task: ExecutionTask;
  readonly occurredAt: ExecutionDateTime;
  readonly metadata?: ExecutionManagementMetadata;
}

export interface CancelExecutionTaskInput {
  readonly task: ExecutionTask;
  readonly occurredAt: ExecutionDateTime;
  readonly metadata?: ExecutionManagementMetadata;
}

export type ExecutionManagementErrorCode =
  | "missing_action_plan_id"
  | "missing_workflow_name"
  | "missing_source_action_id"
  | "missing_workflow_id"
  | "missing_title"
  | "missing_block_description"
  | "invalid_execution_task_transition"
  | "completion_requires_evidence";

export interface ExecutionManagementError {
  readonly code: ExecutionManagementErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ExecutionManagementMetadata;
}

export type ExecutionManagementWarningCode = "none";

export interface ExecutionManagementWarning {
  readonly code: ExecutionManagementWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ExecutionManagementMetadata;
}

export interface ExecutionWorkflowResultSuccess {
  readonly success: true;
  readonly workflow: ExecutionWorkflow;
  readonly errors: ReadonlyArray<ExecutionManagementError>;
  readonly warnings: ReadonlyArray<ExecutionManagementWarning>;
  readonly metadata: ExecutionManagementMetadata;
}

export interface ExecutionWorkflowResultFailure {
  readonly success: false;
  readonly workflow: null;
  readonly errors: ReadonlyArray<ExecutionManagementError>;
  readonly warnings: ReadonlyArray<ExecutionManagementWarning>;
  readonly metadata: ExecutionManagementMetadata;
}

export type ExecutionWorkflowResult = ExecutionWorkflowResultSuccess | ExecutionWorkflowResultFailure;

export interface ExecutionTaskResultSuccess {
  readonly success: true;
  readonly task: ExecutionTask;
  readonly errors: ReadonlyArray<ExecutionManagementError>;
  readonly warnings: ReadonlyArray<ExecutionManagementWarning>;
  readonly metadata: ExecutionManagementMetadata;
}

export interface ExecutionTaskResultFailure {
  readonly success: false;
  readonly task: null;
  readonly errors: ReadonlyArray<ExecutionManagementError>;
  readonly warnings: ReadonlyArray<ExecutionManagementWarning>;
  readonly metadata: ExecutionManagementMetadata;
}

export type ExecutionTaskResult = ExecutionTaskResultSuccess | ExecutionTaskResultFailure;
