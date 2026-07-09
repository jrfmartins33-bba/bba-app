import type { EngineeringAdvisorContext } from "../advisor-context.types";
import type { EngineeringAdvisorHistoricalFacts } from "../advisor-historical-facts.types";
import { buildEngineeringAdvisorPromptContext } from "../advisor-prompt-context-builder";
import { buildApprovalTurn } from "./copilot-deterministic-turn-builder";
import type { CopilotAssistantTurn } from "./copilot-turn.types";
import {
  materializeExecutionWorkflowFromRecommendation,
  type ExecutionServiceError,
  type ExecutionTask,
  type ExecutionWorkflow
} from "../../services/execution-management";

// Decision Copilot — Workflow Handoff Approval Point (Epic 16.7,
// packages/bdos-core/docs/COPILOT_WORKFLOW_HANDOFF.md). Caminho
// paralelo ao Intent Router (copilot-turn-orchestrator.ts): nunca
// chama classifyCopilotIntent, nunca interpreta linguagem natural.
//
// A rota (apps/web) já validou engineeringProjectId/
// sourceDecisionSnapshotId contra o briefing ANTES de chamar esta
// função — resolveCopilotApprovalTurn não repete essa validação
// (é responsabilidade da camada HTTP, mesmo padrão do
// project_id_mismatch já existente em resolveCopilotTurn/apps/web).
// Esta função só resolve approveRecommendationId dentro do
// EngineeringAdvisorContext já validado e materializa (16.6C) — "sem
// lógica nova, sem recalcular decisão, sem interpretar Copilot, sem
// UI, só compor as peças já aprovadas" (16.6C), mais uma vez aqui.
//
// Advisor consumindo services/execution-management (Execution Engine)
// é o layering explícito de docs/PLATFORM_ARCHITECTURE.md: "Advisor
// consome tudo". A materialização em si continua pura/em memória —
// quem persiste de fato (execution_workflows/execution_tasks/
// copilot_messages, numa única transação) é apps/web
// (copilot-approval-repository.ts), nunca esta função.

export type CopilotApprovalOutcome =
  | {
      readonly kind: "assistant_turn";
      readonly turn: CopilotAssistantTurn;
      readonly workflow: ExecutionWorkflow;
      readonly tasks: ReadonlyArray<ExecutionTask>;
    }
  | { readonly kind: "recommendation_not_found" }
  | { readonly kind: "duplicate_recommendation" }
  | { readonly kind: "materialization_failed"; readonly errors: ReadonlyArray<ExecutionServiceError> };

export function resolveCopilotApprovalTurn(
  context: EngineeringAdvisorContext,
  historicalFacts: EngineeringAdvisorHistoricalFacts,
  approveRecommendationId: string,
  decisionSnapshotId: string | null,
  createdAt: string,
  correlationId: string,
  createdBy: string
): CopilotApprovalOutcome {
  // Invariante explícita (COPILOT_WORKFLOW_HANDOFF.md, "Resolução
  // dentro do contexto congelado/auditável"): approveRecommendationId
  // precisa resolver exatamente 1 Recommendation — .find() sozinho
  // pressupõe unicidade sem verificá-la, então filtramos e checamos a
  // contagem explicitamente em vez de usar .find().
  const matches = context.recommendations.filter((recommendation) => recommendation.id === approveRecommendationId);

  if (matches.length === 0) {
    return { kind: "recommendation_not_found" };
  }
  if (matches.length > 1) {
    return { kind: "duplicate_recommendation" };
  }

  const result = materializeExecutionWorkflowFromRecommendation({
    recommendation: matches[0],
    createdAt,
    correlationId,
    createdBy,
    sourceSystem: "decision-copilot"
  });

  if (!result.success || !result.workflow) {
    return { kind: "materialization_failed", errors: result.errors };
  }

  const promptContext = buildEngineeringAdvisorPromptContext(context, historicalFacts);
  const turn = buildApprovalTurn(promptContext, decisionSnapshotId, result.workflow, result.tasks);

  return { kind: "assistant_turn", turn, workflow: result.workflow, tasks: result.tasks };
}
