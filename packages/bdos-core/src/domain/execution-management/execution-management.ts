import type {
  AttachEvidenceReferenceInput,
  BlockExecutionTaskInput,
  CancelExecutionTaskInput,
  CompleteExecutionTaskInput,
  CreateExecutionTaskInput,
  CreateExecutionWorkflowInput,
  EvidenceReference,
  ExecutionManagementError,
  ExecutionManagementMetadata,
  ExecutionTask,
  ExecutionTaskResult,
  ExecutionTaskResultFailure,
  ExecutionTaskResultSuccess,
  ExecutionWorkflow,
  ExecutionWorkflowResult,
  ExecutionWorkflowResultFailure,
  ExecutionWorkflowResultSuccess,
  StartExecutionTaskInput,
  UnblockExecutionTaskInput,
} from "./execution-management.types";
import { ExecutionTaskStatus } from "./execution-management.types";

// Execution Engine (Epic 16, Fase 16.2) — domain model puro, sem I/O.
// Ver packages/bdos-core/docs/EXECUTION_ENGINE.md para a fronteira
// completa (o que este módulo controla e o que não controla).

export function createExecutionWorkflow(
  input: CreateExecutionWorkflowInput,
): ExecutionWorkflowResult {
  const metadata = createWorkflowMetadata(input);
  const errors: ExecutionManagementError[] = [];

  if (isBlank(input.actionPlanId)) {
    errors.push(createError("missing_action_plan_id", "actionPlanId", "Action plan id is required.", metadata));
  }

  if (isBlank(input.name)) {
    errors.push(createError("missing_workflow_name", "name", "Workflow name is required.", metadata));
  }

  if (errors.length > 0) {
    return freezeDomainObject<ExecutionWorkflowResultFailure>({
      success: false,
      workflow: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<ExecutionWorkflowResultSuccess>({
    success: true,
    workflow: createWorkflowEntity(input, metadata),
    errors: [],
    warnings: [],
    metadata,
  });
}

export function createExecutionTask(input: CreateExecutionTaskInput): ExecutionTaskResult {
  const metadata = createTaskCreationMetadata(input);
  const errors: ExecutionManagementError[] = [];

  // PRINCIPLE 006 — No Isolated Task: sourceActionId nunca é opcional.
  if (isBlank(input.sourceActionId)) {
    errors.push(createError("missing_source_action_id", "sourceActionId", "Source action id is required — an ExecutionTask can never exist without an approved Action.", metadata));
  }

  if (isBlank(input.workflowId)) {
    errors.push(createError("missing_workflow_id", "workflowId", "Workflow id is required.", metadata));
  }

  if (isBlank(input.title)) {
    errors.push(createError("missing_title", "title", "Task title is required.", metadata));
  }

  if (errors.length > 0) {
    return freezeDomainObject<ExecutionTaskResultFailure>({
      success: false,
      task: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<ExecutionTaskResultSuccess>({
    success: true,
    task: createTaskEntity(input, metadata),
    errors: [],
    warnings: [],
    metadata,
  });
}

export function startExecutionTask(input: StartExecutionTaskInput): ExecutionTaskResult {
  return transitionTask(input.task, ExecutionTaskStatus.InProgress, createTransitionMetadata(input.task, input.metadata), {
    ...input.task,
    status: ExecutionTaskStatus.InProgress,
    block: null,
    updatedAt: input.occurredAt,
  });
}

export function blockExecutionTask(input: BlockExecutionTaskInput): ExecutionTaskResult {
  const metadata = createTransitionMetadata(input.task, input.metadata);

  if (isBlank(input.description)) {
    return freezeDomainObject<ExecutionTaskResultFailure>({
      success: false,
      task: null,
      errors: [createError("missing_block_description", "description", "Block description is required.", metadata)],
      warnings: [],
      metadata,
    });
  }

  return transitionTask(input.task, ExecutionTaskStatus.Blocked, metadata, {
    ...input.task,
    status: ExecutionTaskStatus.Blocked,
    block: {
      reason: input.reason,
      description: input.description,
      blockedAt: input.occurredAt,
    },
    updatedAt: input.occurredAt,
  });
}

export function unblockExecutionTask(input: UnblockExecutionTaskInput): ExecutionTaskResult {
  return transitionTask(input.task, ExecutionTaskStatus.InProgress, createTransitionMetadata(input.task, input.metadata), {
    ...input.task,
    status: ExecutionTaskStatus.InProgress,
    block: null,
    updatedAt: input.occurredAt,
  });
}

/**
 * Vínculo de evidência — nunca a evidência em si. Não valida o status
 * da FieldEvidence referenciada (ex.: se já foi aprovada pelo Studio
 * de Evidências) — essa checagem cross-domínio é responsabilidade da
 * Application Service (Fase 16.4), não deste domain model puro.
 */
export function attachEvidenceReference(input: AttachEvidenceReferenceInput): ExecutionTaskResult {
  const metadata = createTransitionMetadata(input.task, input.metadata);

  if (isBlank(input.fieldEvidenceId)) {
    return freezeDomainObject<ExecutionTaskResultFailure>({
      success: false,
      task: null,
      errors: [createError("missing_source_action_id", "fieldEvidenceId", "Field evidence id is required.", metadata)],
      warnings: [],
      metadata,
    });
  }

  const reference: EvidenceReference = {
    fieldEvidenceId: input.fieldEvidenceId,
    description: input.description,
    attachedAt: input.occurredAt,
  };

  return freezeDomainObject<ExecutionTaskResultSuccess>({
    success: true,
    task: {
      ...input.task,
      evidenceReferences: [...input.task.evidenceReferences, reference],
      updatedAt: input.occurredAt,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * "Concluído operacional" — decisão fechada em EXECUTION_ENGINE.md:
 * o Decision Engine nunca encerra uma ExecutionTask, só o Execution
 * Engine. Gatilho decidido nesta fase: conclusão exige pelo menos uma
 * EvidenceReference já anexada (nunca fecha uma tarefa sem nenhuma
 * prova referenciada) — não exige que a evidência já tenha sido
 * aprovada pelo Studio de Evidências (isso seria uma checagem
 * cross-domínio, fora do escopo de um domain model puro).
 */
export function completeExecutionTask(input: CompleteExecutionTaskInput): ExecutionTaskResult {
  const metadata = createTransitionMetadata(input.task, input.metadata);

  if (input.task.evidenceReferences.length === 0) {
    return freezeDomainObject<ExecutionTaskResultFailure>({
      success: false,
      task: null,
      errors: [
        createError(
          "completion_requires_evidence",
          "evidenceReferences",
          "An ExecutionTask cannot be completed without at least one evidence reference attached.",
          metadata,
        ),
      ],
      warnings: [],
      metadata,
    });
  }

  return transitionTask(input.task, ExecutionTaskStatus.Completed, metadata, {
    ...input.task,
    status: ExecutionTaskStatus.Completed,
    block: null,
    completedAt: input.occurredAt,
    updatedAt: input.occurredAt,
  });
}

export function cancelExecutionTask(input: CancelExecutionTaskInput): ExecutionTaskResult {
  return transitionTask(input.task, ExecutionTaskStatus.Cancelled, createTransitionMetadata(input.task, input.metadata), {
    ...input.task,
    status: ExecutionTaskStatus.Cancelled,
    updatedAt: input.occurredAt,
  });
}

function transitionTask(
  task: ExecutionTask,
  toStatus: ExecutionTaskStatus,
  metadata: ExecutionManagementMetadata,
  nextTask: ExecutionTask,
): ExecutionTaskResult {
  if (!canTransitionExecutionTask(task.status, toStatus)) {
    return freezeDomainObject<ExecutionTaskResultFailure>({
      success: false,
      task: null,
      errors: [
        createError(
          "invalid_execution_task_transition",
          "status",
          `Cannot transition execution task from ${task.status} to ${toStatus}.`,
          metadata,
        ),
      ],
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<ExecutionTaskResultSuccess>({
    success: true,
    task: nextTask,
    errors: [],
    warnings: [],
    metadata,
  });
}

function canTransitionExecutionTask(fromStatus: ExecutionTaskStatus, toStatus: ExecutionTaskStatus): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

const allowedTransitions: Readonly<Record<ExecutionTaskStatus, ReadonlyArray<ExecutionTaskStatus>>> = {
  [ExecutionTaskStatus.NotStarted]: [ExecutionTaskStatus.InProgress, ExecutionTaskStatus.Cancelled],
  [ExecutionTaskStatus.InProgress]: [ExecutionTaskStatus.Blocked, ExecutionTaskStatus.Completed, ExecutionTaskStatus.Cancelled],
  [ExecutionTaskStatus.Blocked]: [ExecutionTaskStatus.InProgress, ExecutionTaskStatus.Cancelled],
  [ExecutionTaskStatus.Completed]: [],
  [ExecutionTaskStatus.Cancelled]: [],
};

function createWorkflowEntity(input: CreateExecutionWorkflowInput, metadata: ExecutionManagementMetadata): ExecutionWorkflow {
  return {
    id: input.id,
    actionPlanId: input.actionPlanId,
    name: input.name,
    objective: input.objective,
    ownerRole: input.ownerRole,
    createdAt: input.createdAt,
    metadata,
  };
}

function createTaskEntity(input: CreateExecutionTaskInput, metadata: ExecutionManagementMetadata): ExecutionTask {
  return {
    id: input.id,
    workflowId: input.workflowId,
    sourceActionId: input.sourceActionId,
    scheduleActivityId: input.scheduleActivityId ?? null,
    title: input.title,
    description: input.description,
    assignee: input.assignee ?? null,
    dueDate: input.dueDate ?? null,
    status: ExecutionTaskStatus.NotStarted,
    block: null,
    evidenceReferences: [],
    completedAt: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    metadata,
  };
}

function createError(
  code: ExecutionManagementError["code"],
  field: string,
  message: string,
  metadata: ExecutionManagementMetadata,
): ExecutionManagementError {
  return { code, field, message, metadata };
}

function createWorkflowMetadata(input: CreateExecutionWorkflowInput): ExecutionManagementMetadata {
  return {
    ...(input.metadata ?? {}),
    executionWorkflowId: input.id,
    actionPlanId: input.actionPlanId,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
    createdAt: input.createdAt,
  };
}

function createTaskCreationMetadata(input: CreateExecutionTaskInput): ExecutionManagementMetadata {
  return {
    ...(input.metadata ?? {}),
    executionTaskId: input.id,
    workflowId: input.workflowId,
    sourceActionId: input.sourceActionId,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
    createdAt: input.createdAt,
  };
}

function createTransitionMetadata(task: ExecutionTask, overrides?: ExecutionManagementMetadata): ExecutionManagementMetadata {
  return {
    ...task.metadata,
    ...(overrides ?? {}),
    executionTaskId: task.id,
    fromStatus: task.status,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [key, cloneDomainValue(property)]),
  ) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.values(value as Record<PropertyKey, unknown>).forEach((property) => {
    freezeClonedDomainObject(property);
  });

  return Object.freeze(value);
}
