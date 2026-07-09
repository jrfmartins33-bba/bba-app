import { buildActionPlans } from "../../engines/decision/action-plan";
import { buildPlaybooks } from "../../engines/decision/playbook";
import { createExecutionTask, createExecutionWorkflow } from "../../domain/execution-management";
import type { ExecutionTask } from "../../domain/execution-management";
import type {
  CreateExecutionWorkflowFromActionPlanInput,
  CreateExecutionWorkflowFromActionPlanResult,
  ExecutionServiceError,
  ExecutionServiceErrorStage,
  MaterializeExecutionWorkflowFromRecommendationInput,
} from "./execution-management-service.types";

/**
 * A Application Service (Epic 16, Fase 16.4 — ver
 * packages/bdos-core/docs/EXECUTION_ENGINE.md, Fronteira com o
 * Decision Copilot) que um consumidor (API route, script, e mais
 * adiante o Workflow Handoff do Copilot) deve chamar — nunca
 * domain/execution-management diretamente para este fluxo. É a
 * existência DESTA função, não da tabela execution_tasks, que
 * destrava o Workflow Handoff (DECISION_COPILOT_PHASE2.md §5).
 *
 * Composição, não invenção: nenhum cálculo de negócio novo aqui — só
 * a sequência já provada em execution-management.test.ts, aplicada N
 * vezes (uma por Action do ActionPlan). Se qualquer Action falhar a
 * validação (não deveria, dado que ActionPlan já passou pelo Decision
 * Engine), a falha é reportada, nunca silenciada.
 *
 * `package.json`'s `exports` expõe este módulo sob subpath próprio
 * (`@bba/bdos-core/services/execution-management`), mesma disciplina
 * de "uma porta estreita" de bba-project-import/
 * geospatial-product-integration — um consumidor que importa só este
 * subpath não alcança domain/execution-management nem
 * engines/decision/action-plan diretamente.
 *
 * ids determinísticos (execution-workflow:<actionPlanId>,
 * execution-task:<actionId>), nunca gerados por
 * crypto.randomUUID() aqui — mesma disciplina de pureza que
 * action-plan-builder.ts já usa para ActionPlan.id. Idempotente: os
 * mesmos inputs produzem sempre os mesmos ids.
 */
export function createExecutionWorkflowFromActionPlan(
  input: CreateExecutionWorkflowFromActionPlanInput,
): CreateExecutionWorkflowFromActionPlanResult {
  const workflowId = `execution-workflow:${input.actionPlan.id}`;

  const workflowResult = createExecutionWorkflow({
    id: workflowId,
    actionPlanId: input.actionPlan.id,
    name: input.actionPlan.name,
    objective: input.actionPlan.objective,
    ownerRole: input.actionPlan.ownerRole,
    createdAt: input.createdAt,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  });

  if (!workflowResult.success) {
    return {
      success: false,
      workflow: null,
      tasks: [],
      errors: workflowResult.errors.map((error) => toServiceError("workflow_creation", error)),
    };
  }

  const errors: ExecutionServiceError[] = [];
  const tasks: ExecutionTask[] = [];

  input.actionPlan.actions.forEach((action) => {
    const taskResult = createExecutionTask({
      id: `execution-task:${action.id}`,
      workflowId,
      sourceActionId: action.id,
      scheduleActivityId: input.scheduleActivityIdByActionId?.[action.id] ?? null,
      title: action.title,
      description: action.description,
      createdAt: input.createdAt,
      correlationId: input.correlationId,
      createdBy: input.createdBy,
      sourceSystem: input.sourceSystem,
    });

    if (!taskResult.success) {
      errors.push(...taskResult.errors.map((error) => toServiceError("task_creation", error)));
      return;
    }

    tasks.push(taskResult.task);
  });

  return {
    success: errors.length === 0,
    workflow: workflowResult.workflow,
    tasks,
    errors,
  };
}

/**
 * Epic 16.6C — ActionPlan Materialization Orchestrator. Único
 * objetivo: compor `buildPlaybooks` (Decision Engine, Epic 16.6A) →
 * `buildActionPlans` (Decision Engine, Epic 16.6B) →
 * `createExecutionWorkflowFromActionPlan` (Execution Engine, Fase
 * 16.4) numa chamada só. Resolve o Risco 3 de
 * `ACTIONPLAN_MATERIALIZATION_BOUNDARY.md` (onde mora a orquestração)
 * a favor de estender este serviço, não criar um novo — a jornada
 * completa "de uma Recommendation aprovada a um ExecutionWorkflow"
 * fica atrás de uma porta só (`@bba/bdos-core/services/execution-management`).
 *
 * Nenhuma lógica nova: nenhuma das três funções compostas muda de
 * comportamento aqui, nenhuma decisão é recalculada, nenhuma
 * interpretação de linguagem natural acontece (isso é papel do
 * Copilot, que chama esta função depois de já ter resolvido qual
 * Recommendation e obtido aprovação — nunca dentro dela), nenhuma UI.
 * A Recommendation já precisa estar aprovada antes desta chamada —
 * esta função nunca decide isso, só materializa o que já foi.
 */
export function materializeExecutionWorkflowFromRecommendation(
  input: MaterializeExecutionWorkflowFromRecommendationInput,
): CreateExecutionWorkflowFromActionPlanResult {
  const [playbook] = buildPlaybooks([input.recommendation]);
  const [actionPlan] = buildActionPlans([playbook]);

  return createExecutionWorkflowFromActionPlan({
    actionPlan,
    createdAt: input.createdAt,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
    scheduleActivityIdByActionId: input.scheduleActivityIdByActionId,
  });
}

function toServiceError(
  stage: ExecutionServiceErrorStage,
  error: { readonly code: string; readonly message: string; readonly field: string },
): ExecutionServiceError {
  return { stage, code: error.code, message: error.message, field: error.field };
}
