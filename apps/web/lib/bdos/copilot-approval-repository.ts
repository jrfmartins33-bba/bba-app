import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionTask, ExecutionWorkflow } from "@bba/bdos-core/services/execution-management";
import type { CopilotAssistantTurn } from "@bba/bdos-core/advisor/copilot/copilot-turn.types";

// Decision Copilot — Workflow Handoff Approval Point (Epic 16.7,
// packages/bdos-core/docs/COPILOT_WORKFLOW_HANDOFF.md). Única camada
// que fala com o Supabase para o caminho de aprovação estrutural —
// diferente de execution-repository.ts/copilot-repository.ts (que só
// tocam suas próprias tabelas), esta função persiste
// execution_workflows + execution_tasks + copilot_messages numa única
// chamada, via a função de banco approve_copilot_recommendation
// (migration 20260709130000), porque o documento de desenho exige que
// as três gravações aconteçam como uma transação só — não alcançável
// com múltiplas chamadas sequenciais de supabase-js, cada uma sua
// própria transação implícita (mesma limitação que
// execution-repository.ts/createExecutionWorkflowAndTasks já tem para
// workflow/tasks/history, sem transação cruzando as três).
//
// workflow/tasks chegam aqui já materializados por bdos-core
// (resolveCopilotApprovalTurn → materializeExecutionWorkflowFromRecommendation,
// 16.6C) — nenhuma lógica de negócio nova aqui, só serialização para a
// função de banco.

export interface ApproveCopilotRecommendationParams {
  readonly companyId: string;
  readonly engineeringProjectId: string;
  readonly decisionSnapshotId: string;
  readonly planningDatasetId?: string | null;
  readonly conversationId: string;
  readonly createdBy: string;
  readonly workflow: ExecutionWorkflow;
  readonly tasks: ReadonlyArray<ExecutionTask>;
  readonly turn: CopilotAssistantTurn;
}

export interface ApproveCopilotRecommendationResult {
  /** true quando esta Recommendation já tinha sido aprovada antes neste projeto — sucesso idempotente, nada novo foi inserido (Risco 4, COPILOT_WORKFLOW_HANDOFF.md). */
  readonly alreadyApproved: boolean;
  readonly workflowId: string;
  readonly taskIds: ReadonlyArray<string>;
  /** null quando alreadyApproved=true — a segunda aprovação não grava um segundo turno. */
  readonly copilotMessageId: string | null;
}

export async function approveCopilotRecommendation(
  supabase: SupabaseClient,
  params: ApproveCopilotRecommendationParams
): Promise<ApproveCopilotRecommendationResult> {
  const { data, error } = await supabase.rpc("approve_copilot_recommendation", {
    p_company_id: params.companyId,
    p_engineering_project_id: params.engineeringProjectId,
    p_decision_snapshot_id: params.decisionSnapshotId,
    p_planning_dataset_id: params.planningDatasetId ?? null,
    p_conversation_id: params.conversationId,
    p_created_by: params.createdBy,
    p_workflow_action_plan_ref_id: params.workflow.actionPlanId,
    p_workflow_name: params.workflow.name,
    p_workflow_objective: params.workflow.objective,
    p_workflow_owner_role: params.workflow.ownerRole,
    p_tasks: params.tasks.map((task) => ({
      sourceActionId: task.sourceActionId,
      scheduleActivityId: task.scheduleActivityId,
      title: task.title,
      description: task.description
    })),
    p_turn_content: params.turn.content,
    p_turn_context_snapshot: params.turn.contextSnapshot,
    p_turn_context_hash: params.turn.contextHash,
    p_turn_reasoning_chain: params.turn.reasoningChain,
    p_turn_confidence: params.turn.confidence,
    p_turn_explainability: params.turn.explainability,
    p_turn_model: params.turn.model
  });

  if (error || !data) {
    throw error ?? new Error("Não foi possível registrar a aprovação da Recommendation.");
  }

  return {
    alreadyApproved: data.already_approved as boolean,
    workflowId: data.workflow_id as string,
    taskIds: ((data.task_ids as string[] | null) ?? []) as ReadonlyArray<string>,
    copilotMessageId: (data.copilot_message_id as string | null) ?? null
  };
}
