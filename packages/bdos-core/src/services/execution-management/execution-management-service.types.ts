import type { ActionPlan } from "../../engines/decision/action-plan";
import type { ExecutionTask, ExecutionWorkflow } from "../../domain/execution-management";

// Reexportado por nome — apps/web nunca importa engines/decision/*
// diretamente (mesma regra de domain/*, PLATFORM_ARCHITECTURE.md §4);
// este subpath (services/execution-management) é a única porta.
export type { Action, ActionPlan } from "../../engines/decision/action-plan";

export type ExecutionServiceErrorStage = "workflow_creation" | "task_creation";

export interface ExecutionServiceError {
  readonly stage: ExecutionServiceErrorStage;
  readonly code: string;
  readonly message: string;
  readonly field: string;
}

export interface CreateExecutionWorkflowFromActionPlanInput {
  /**
   * O ActionPlan já aprovado (Decision Engine). Esta Application
   * Service é o único ponto do Execution Engine autorizado a importar
   * engines/decision/* diretamente — domain/execution-management
   * (Fase 16.2) nunca o faz (é um OPERATIONAL_DOMAIN, ver
   * engineering-boundaries.test.ts). Ver EXECUTION_ENGINE.md, Fronteira
   * com Decision Engine.
   */
  readonly actionPlan: ActionPlan;
  readonly createdAt: string;
  readonly correlationId: string;
  readonly createdBy: string;
  readonly sourceSystem: string;
  /**
   * Mapeamento opcional Action.id -> ScheduleActivity.id, quando a
   * Action já estiver vinculada a uma atividade de cronograma
   * específica — sempre opcional (EXECUTION_ENGINE.md, Fronteira com
   * Project Studio). Chaves ausentes viram scheduleActivityId: null.
   */
  readonly scheduleActivityIdByActionId?: Readonly<Record<string, string>>;
}

export interface CreateExecutionWorkflowFromActionPlanResult {
  readonly success: boolean;
  readonly workflow: ExecutionWorkflow | null;
  readonly tasks: ReadonlyArray<ExecutionTask>;
  readonly errors: ReadonlyArray<ExecutionServiceError>;
}
