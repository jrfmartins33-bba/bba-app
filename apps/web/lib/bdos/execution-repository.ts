import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attachEvidenceReference,
  blockExecutionTask,
  cancelExecutionTask,
  completeExecutionTask,
  createExecutionWorkflowFromActionPlan,
  startExecutionTask,
  unblockExecutionTask,
  ExecutionTaskBlockReason,
  ExecutionTaskStatus,
  type ActionPlan,
  type EvidenceReference,
  type ExecutionTask
} from "@bba/bdos-core/services/execution-management";

// Execution Engine (Epic 16, Fase 16.5) — única camada que fala com o
// Supabase para execution_workflows/execution_tasks/
// execution_task_evidence_references/execution_task_status_history.
// bdos-core decide toda regra de negócio (transições de status,
// PRINCIPLE 006, exigência de evidência para concluir); este módulo só
// persiste o que bdos-core já validou e traduz snake_case <-> camelCase
// — mesma separação de copilot-repository.ts.
//
// ids de linha (Postgres) são sempre gerados pelo banco (DEFAULT
// gen_random_uuid()) — os ids sintéticos que
// createExecutionWorkflowFromActionPlan produz
// (execution-workflow:<actionPlanId>, execution-task:<actionId>) só
// existem para correlação em memória durante aquela chamada pura;
// nunca chegam ao banco como PRIMARY KEY.

export interface ExecutionWorkflowRecord {
  readonly id: string;
  readonly engineeringProjectId: string;
  readonly decisionSnapshotId: string;
  readonly planningDatasetId: string | null;
  readonly actionPlanRefId: string;
  readonly name: string;
  readonly objective: string;
  readonly ownerRole: string;
  readonly createdAt: string;
}

export interface ExecutionTaskRecord {
  readonly id: string;
  readonly workflowId: string;
  readonly sourceActionRefId: string;
  readonly scheduleActivityRefId: string | null;
  readonly title: string;
  readonly description: string;
  readonly assigneeUserId: string | null;
  readonly dueDate: string | null;
  readonly status: ExecutionTaskStatus;
  readonly blockReason: ExecutionTaskBlockReason | null;
  readonly blockDescription: string | null;
  readonly blockedAt: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const WORKFLOW_COLUMNS =
  "id, engineering_project_id, decision_snapshot_id, planning_dataset_id, action_plan_ref_id, name, objective, owner_role, created_at";

const TASK_COLUMNS =
  "id, workflow_id, source_action_ref_id, schedule_activity_ref_id, title, description, assignee_user_id, due_date, status, block_reason, block_description, blocked_at, completed_at, created_at, updated_at";

function mapWorkflowRow(row: Record<string, unknown>): ExecutionWorkflowRecord {
  return {
    id: row.id as string,
    engineeringProjectId: row.engineering_project_id as string,
    decisionSnapshotId: row.decision_snapshot_id as string,
    planningDatasetId: (row.planning_dataset_id as string | null) ?? null,
    actionPlanRefId: row.action_plan_ref_id as string,
    name: row.name as string,
    objective: row.objective as string,
    ownerRole: row.owner_role as string,
    createdAt: row.created_at as string
  };
}

function mapTaskRow(row: Record<string, unknown>): ExecutionTaskRecord {
  return {
    id: row.id as string,
    workflowId: row.workflow_id as string,
    sourceActionRefId: row.source_action_ref_id as string,
    scheduleActivityRefId: (row.schedule_activity_ref_id as string | null) ?? null,
    title: row.title as string,
    description: row.description as string,
    assigneeUserId: (row.assignee_user_id as string | null) ?? null,
    dueDate: (row.due_date as string | null) ?? null,
    status: row.status as ExecutionTaskStatus,
    blockReason: (row.block_reason as ExecutionTaskBlockReason | null) ?? null,
    blockDescription: (row.block_description as string | null) ?? null,
    blockedAt: (row.blocked_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
}

// Reconstrói o ExecutionTask no formato que as funções puras do domain
// model esperam — nunca reimplementa a regra de transição aqui, só
// traduz a linha do banco (+ suas evidence references reais) de volta
// para o shape que bdos-core já valida.
function toDomainTask(record: ExecutionTaskRecord, evidenceReferences: ReadonlyArray<EvidenceReference>): ExecutionTask {
  return {
    id: record.id,
    workflowId: record.workflowId,
    sourceActionId: record.sourceActionRefId,
    scheduleActivityId: record.scheduleActivityRefId,
    title: record.title,
    description: record.description,
    assignee: record.assigneeUserId,
    dueDate: record.dueDate,
    status: record.status,
    block:
      record.blockReason && record.blockDescription && record.blockedAt
        ? { reason: record.blockReason, description: record.blockDescription, blockedAt: record.blockedAt }
        : null,
    evidenceReferences,
    completedAt: record.completedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    metadata: {}
  };
}

export async function listExecutionWorkflows(
  supabase: SupabaseClient,
  engineeringProjectId: string
): Promise<ReadonlyArray<ExecutionWorkflowRecord>> {
  const { data, error } = await supabase
    .from("execution_workflows")
    .select(WORKFLOW_COLUMNS)
    .eq("engineering_project_id", engineeringProjectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapWorkflowRow);
}

export async function listExecutionTasks(
  supabase: SupabaseClient,
  workflowId: string
): Promise<ReadonlyArray<ExecutionTaskRecord>> {
  const { data, error } = await supabase
    .from("execution_tasks")
    .select(TASK_COLUMNS)
    .eq("workflow_id", workflowId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapTaskRow);
}

export interface CreateExecutionWorkflowAndTasksParams {
  readonly companyId: string;
  readonly engineeringProjectId: string;
  readonly decisionSnapshotId: string;
  readonly planningDatasetId?: string | null;
  readonly actionPlan: ActionPlan;
  readonly scheduleActivityIdByActionId?: Readonly<Record<string, string>>;
  readonly createdBy: string;
}

// O handoff em si: monta o ExecutionWorkflow + ExecutionTasks (função
// pura, 16.4) a partir de um ActionPlan já aprovado, depois persiste
// exatamente o que bdos-core decidiu — sem gerar nenhum id sintético
// no banco (ids reais vêm de gen_random_uuid()) e sem recalcular nada.
export async function createExecutionWorkflowAndTasks(
  supabase: SupabaseClient,
  params: CreateExecutionWorkflowAndTasksParams
): Promise<{ readonly workflow: ExecutionWorkflowRecord; readonly tasks: ReadonlyArray<ExecutionTaskRecord> }> {
  const occurredAt = new Date().toISOString();

  const built = createExecutionWorkflowFromActionPlan({
    actionPlan: params.actionPlan,
    createdAt: occurredAt,
    correlationId: params.actionPlan.id,
    createdBy: params.createdBy,
    sourceSystem: "execution-repository",
    scheduleActivityIdByActionId: params.scheduleActivityIdByActionId
  });

  if (!built.success || !built.workflow) {
    throw new Error(`Não foi possível montar o Execution Workflow: ${built.errors.map((error) => error.message).join("; ")}`);
  }

  const { data: workflowRow, error: workflowError } = await supabase
    .from("execution_workflows")
    .insert({
      company_id: params.companyId,
      engineering_project_id: params.engineeringProjectId,
      decision_snapshot_id: params.decisionSnapshotId,
      planning_dataset_id: params.planningDatasetId ?? null,
      action_plan_ref_id: built.workflow.actionPlanId,
      name: built.workflow.name,
      objective: built.workflow.objective,
      owner_role: built.workflow.ownerRole,
      created_by: params.createdBy
    })
    .select(WORKFLOW_COLUMNS)
    .single();

  if (workflowError || !workflowRow) {
    throw workflowError ?? new Error("Não foi possível gravar o Execution Workflow.");
  }

  const workflow = mapWorkflowRow(workflowRow);

  if (built.tasks.length === 0) {
    return { workflow, tasks: [] };
  }

  const { data: taskRows, error: tasksError } = await supabase
    .from("execution_tasks")
    .insert(
      built.tasks.map((task) => ({
        company_id: params.companyId,
        workflow_id: workflow.id,
        source_action_ref_id: task.sourceActionId,
        schedule_activity_ref_id: task.scheduleActivityId,
        title: task.title,
        description: task.description,
        created_by: params.createdBy
      }))
    )
    .select(TASK_COLUMNS);

  if (tasksError || !taskRows) {
    throw tasksError ?? new Error("Não foi possível gravar as Execution Tasks.");
  }

  const tasks = taskRows.map(mapTaskRow);

  const { error: historyError } = await supabase.from("execution_task_status_history").insert(
    tasks.map((task) => ({
      company_id: params.companyId,
      execution_task_id: task.id,
      from_status: null,
      to_status: ExecutionTaskStatus.NotStarted,
      reason: "Tarefa criada a partir do ActionPlan aprovado.",
      changed_by: params.createdBy
    }))
  );

  if (historyError) {
    throw historyError;
  }

  return { workflow, tasks };
}

async function getExecutionTaskForTransition(
  supabase: SupabaseClient,
  taskId: string
): Promise<{ readonly record: ExecutionTaskRecord; readonly companyId: string; readonly domainTask: ExecutionTask }> {
  const { data: row, error } = await supabase
    .from("execution_tasks")
    .select(`company_id, ${TASK_COLUMNS}`)
    .eq("id", taskId)
    .single();

  if (error || !row) {
    throw error ?? new Error("Execution task não encontrada.");
  }

  const { data: evidenceRows, error: evidenceError } = await supabase
    .from("execution_task_evidence_references")
    .select("field_evidence_ref_id, description, attached_at")
    .eq("execution_task_id", taskId)
    .order("attached_at", { ascending: true });

  if (evidenceError) {
    throw evidenceError;
  }

  const evidenceReferences: EvidenceReference[] = (evidenceRows ?? []).map((evidenceRow) => ({
    fieldEvidenceId: evidenceRow.field_evidence_ref_id as string,
    description: evidenceRow.description as string,
    attachedAt: evidenceRow.attached_at as string
  }));

  const record = mapTaskRow(row);

  return { record, companyId: row.company_id as string, domainTask: toDomainTask(record, evidenceReferences) };
}

async function persistExecutionTaskTransition(
  supabase: SupabaseClient,
  params: {
    readonly companyId: string;
    readonly fromStatus: ExecutionTaskStatus;
    readonly task: ExecutionTask;
    readonly changedBy: string;
    readonly reason: string;
  }
): Promise<ExecutionTaskRecord> {
  const { task } = params;

  const { data: row, error } = await supabase
    .from("execution_tasks")
    .update({
      status: task.status,
      block_reason: task.block?.reason ?? null,
      block_description: task.block?.description ?? null,
      blocked_at: task.block?.blockedAt ?? null,
      completed_at: task.completedAt
    })
    .eq("id", task.id)
    .select(TASK_COLUMNS)
    .single();

  if (error || !row) {
    throw error ?? new Error("Não foi possível atualizar a Execution Task.");
  }

  const { error: historyError } = await supabase.from("execution_task_status_history").insert({
    company_id: params.companyId,
    execution_task_id: task.id,
    from_status: params.fromStatus,
    to_status: task.status,
    reason: params.reason,
    changed_by: params.changedBy
  });

  if (historyError) {
    throw historyError;
  }

  return mapTaskRow(row);
}

export async function startExecutionTaskById(supabase: SupabaseClient, taskId: string, changedBy: string): Promise<ExecutionTaskRecord> {
  const { domainTask, companyId } = await getExecutionTaskForTransition(supabase, taskId);
  const result = startExecutionTask({ task: domainTask, occurredAt: new Date().toISOString() });

  if (!result.success) {
    throw new Error(result.errors[0]?.message ?? "Transição inválida.");
  }

  return persistExecutionTaskTransition(supabase, { companyId, fromStatus: domainTask.status, task: result.task, changedBy, reason: "" });
}

export async function blockExecutionTaskById(
  supabase: SupabaseClient,
  taskId: string,
  params: { readonly reason: ExecutionTaskBlockReason; readonly description: string },
  changedBy: string
): Promise<ExecutionTaskRecord> {
  const { domainTask, companyId } = await getExecutionTaskForTransition(supabase, taskId);
  const result = blockExecutionTask({
    task: domainTask,
    reason: params.reason,
    description: params.description,
    occurredAt: new Date().toISOString()
  });

  if (!result.success) {
    throw new Error(result.errors[0]?.message ?? "Transição inválida.");
  }

  return persistExecutionTaskTransition(supabase, {
    companyId,
    fromStatus: domainTask.status,
    task: result.task,
    changedBy,
    reason: params.description
  });
}

export async function unblockExecutionTaskById(supabase: SupabaseClient, taskId: string, changedBy: string): Promise<ExecutionTaskRecord> {
  const { domainTask, companyId } = await getExecutionTaskForTransition(supabase, taskId);
  const result = unblockExecutionTask({ task: domainTask, occurredAt: new Date().toISOString() });

  if (!result.success) {
    throw new Error(result.errors[0]?.message ?? "Transição inválida.");
  }

  return persistExecutionTaskTransition(supabase, { companyId, fromStatus: domainTask.status, task: result.task, changedBy, reason: "" });
}

export async function completeExecutionTaskById(supabase: SupabaseClient, taskId: string, changedBy: string): Promise<ExecutionTaskRecord> {
  const { domainTask, companyId } = await getExecutionTaskForTransition(supabase, taskId);
  const result = completeExecutionTask({ task: domainTask, occurredAt: new Date().toISOString() });

  if (!result.success) {
    throw new Error(result.errors[0]?.message ?? "Não foi possível concluir a tarefa — confirme que há pelo menos uma evidência anexada.");
  }

  return persistExecutionTaskTransition(supabase, { companyId, fromStatus: domainTask.status, task: result.task, changedBy, reason: "" });
}

export async function cancelExecutionTaskById(supabase: SupabaseClient, taskId: string, changedBy: string): Promise<ExecutionTaskRecord> {
  const { domainTask, companyId } = await getExecutionTaskForTransition(supabase, taskId);
  const result = cancelExecutionTask({ task: domainTask, occurredAt: new Date().toISOString() });

  if (!result.success) {
    throw new Error(result.errors[0]?.message ?? "Transição inválida.");
  }

  return persistExecutionTaskTransition(supabase, { companyId, fromStatus: domainTask.status, task: result.task, changedBy, reason: "" });
}

export async function attachExecutionTaskEvidence(
  supabase: SupabaseClient,
  taskId: string,
  params: { readonly fieldEvidenceId: string; readonly description: string },
  attachedBy: string
): Promise<ExecutionTaskRecord> {
  const { domainTask, companyId } = await getExecutionTaskForTransition(supabase, taskId);
  const occurredAt = new Date().toISOString();

  // Reusa a validação do domain model (fieldEvidenceId não-vazio) —
  // o valor de retorno em memória é descartado de propósito: a
  // persistência real de EvidenceReference é a tabela
  // execution_task_evidence_references, nunca uma coluna embutida em
  // execution_tasks.
  const validation = attachEvidenceReference({
    task: domainTask,
    fieldEvidenceId: params.fieldEvidenceId,
    description: params.description,
    occurredAt
  });

  if (!validation.success) {
    throw new Error(validation.errors[0]?.message ?? "Não foi possível anexar a evidência.");
  }

  const { error } = await supabase.from("execution_task_evidence_references").insert({
    company_id: companyId,
    execution_task_id: taskId,
    field_evidence_ref_id: params.fieldEvidenceId,
    description: params.description,
    attached_by: attachedBy
  });

  if (error) {
    throw error;
  }

  const { record } = await getExecutionTaskForTransition(supabase, taskId);
  return record;
}
