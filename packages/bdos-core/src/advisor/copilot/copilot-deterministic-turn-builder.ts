import type { EngineeringAdvisorConfidence, EngineeringAdvisorConfidenceReason } from "../advisor-confidence.types";
import type { EngineeringAdvisorExplanation } from "../advisor-explanation.types";
import type { EngineeringAdvisorPromptContext } from "../advisor-prompt-context.types";
import { CLARIFY_LIST_LIMIT, candidateTitle, topCopilotCandidates } from "./copilot-candidates";
import { computeContextHash } from "./context-hash";
import { buildCopilotReasoningChain } from "./copilot-reasoning-chain";
import type { CopilotAssistantTurn } from "./copilot-turn.types";
import type { ExecutionTask, ExecutionWorkflow } from "../../services/execution-management";

// Decision Copilot (Epic 15, Fase 2) — turnos assistant que nunca
// chamam o Claude (DECISION_COPILOT_PHASE2.md §2/§5/§6, regra
// "determinístico primeiro"). Cada um ainda respeita a mesma trilha de
// auditoria obrigatória que um turno respondido pelo Claude (Limites
// arquiteturais §6, item 5) — só o `model` denuncia que não passou
// pela API.

// Sentinela de auditoria — nunca o nome de um modelo real. Permite,
// por uma query simples (`WHERE model = 'copilot-rule-based-v1'`),
// medir quantos turnos o Copilot resolveu sem gastar chamada à
// Anthropic.
export const COPILOT_RULE_BASED_MODEL = "copilot-rule-based-v1";

// Prefixo fixo e estável: é o que permite ao Intent Router (§1)
// reconhecer, sem coluna nova no schema, que o último turno assistant
// desta conversa foi uma lista de clarify — condição para resolver "a
// 2ª opção" na mensagem seguinte. Ver copilot-intent-router.ts.
export const CLARIFY_LIST_INTRO = "Encontrei mais de uma opção relacionada. Você quer analisar:";

const UNSUPPORTED_ACTION_MESSAGE =
  "Ainda não consigo executar ações — só interpreto o que o BDOS já calculou (Decisions, Recommendations, planos de ação). Nenhuma decisão foi alterada por esta mensagem.";

// Workflow Handoff Approval Point (Epic 16.7, COPILOT_WORKFLOW_HANDOFF.md)
// — mesmo tratamento para uma aprovação repetida (idempotente, ver
// documento) e para a primeira aprovação: o texto não distingue os dois
// casos, porque do ponto de vista do usuário o resultado é o mesmo
// ("este workflow existe"), nunca um erro.
//
// Epic 17.0 (vocabulário de produto) — "plano de execução" é o
// vocabulário de produto para `ExecutionWorkflow` (nunca "workflow",
// termo interno). Auditoria de modelo mental, não só terminológica: o
// CTA que gera este texto é o botão "Aprovar" ao lado de uma
// Recommendation — a confirmação precisa soar como continuação natural
// desse clique ("aprovei, e agora existe um plano com tarefas"), nunca
// introduzir um conceito que o usuário não pediu. "ExecutionTask"
// também nunca aparece aqui — só "tarefa".
function buildApprovalContent(workflow: ExecutionWorkflow, taskCount: number): string {
  const taskWord = taskCount === 1 ? "tarefa" : "tarefas";
  return `Aprovado. Criei um plano de execução ("${workflow.name}") com ${taskCount} ${taskWord} a partir desta recomendação.`;
}

function degenerateConfidence(reason: EngineeringAdvisorConfidenceReason): EngineeringAdvisorConfidence {
  return {
    overall: "low",
    reasons: [reason],
    metrics: {
      insightCount: 0,
      explainedInsightCount: 0,
      traceabilityCoverage: 0,
      evidenceCoverage: 0,
      recommendationCoverage: 0,
      missingReferenceCount: 0
    }
  };
}

function buildDeterministicTurn(
  content: string,
  contextSnapshot: EngineeringAdvisorPromptContext,
  explanation: EngineeringAdvisorExplanation,
  confidenceReason: EngineeringAdvisorConfidenceReason,
  decisionSnapshotId: string | null
): CopilotAssistantTurn {
  // structuredClone: mesma garantia de "congelar, não referenciar" que
  // assembleCopilotAssistantTurn já dá ao caminho respondido pelo
  // Claude (Fase 1).
  const frozenContextSnapshot = structuredClone(contextSnapshot);

  return {
    content,
    contextSnapshot: frozenContextSnapshot,
    contextHash: computeContextHash(frozenContextSnapshot),
    reasoningChain: buildCopilotReasoningChain(explanation),
    confidence: degenerateConfidence(confidenceReason),
    explainability: explanation,
    decisionSnapshotId,
    model: COPILOT_RULE_BASED_MODEL
  };
}

// Clarifying Questions (§2) — lista numerada top-N por prioridade,
// candidatos vindos de copilot-candidates.ts (mesma lista que o Router
// usa para resolver "a 2ª opção" na resposta seguinte).
export function buildClarifyTurn(
  context: EngineeringAdvisorPromptContext,
  decisionSnapshotId: string | null
): CopilotAssistantTurn {
  const candidates = topCopilotCandidates(context, CLARIFY_LIST_LIMIT);

  const content = [CLARIFY_LIST_INTRO, ...candidates.map((candidate, index) => `${index + 1}. ${candidateTitle(candidate)}`)].join(
    "\n"
  );

  const explanation: EngineeringAdvisorExplanation = {
    insightTitle: "Pergunta de esclarecimento",
    decisions: candidates
      .filter((candidate) => candidate.kind === "decision")
      .map((candidate) => ({ id: candidate.decision.id, title: candidate.decision.title, priority: candidate.decision.priority })),
    recommendations: candidates
      .filter((candidate) => candidate.kind === "recommendation")
      .map((candidate) => ({
        id: candidate.recommendation.id,
        title: candidate.recommendation.title,
        isNew: candidate.recommendation.isNew,
        recurring: candidate.recommendation.recurring
      })),
    evidence: [],
    missingReferences: { decisionIds: [], recommendationIds: [], evidenceDecisionIds: [] }
  };

  return buildDeterministicTurn(content, context, explanation, "clarifying_question", decisionSnapshotId);
}

// unsupported_action (§5) — nunca chama o Claude, nunca sugere que uma
// ação foi executada.
export function buildUnsupportedActionTurn(
  context: EngineeringAdvisorPromptContext,
  decisionSnapshotId: string | null
): CopilotAssistantTurn {
  const explanation: EngineeringAdvisorExplanation = {
    insightTitle: "Pedido de execução não suportado",
    decisions: [],
    recommendations: [],
    evidence: [],
    missingReferences: { decisionIds: [], recommendationIds: [], evidenceDecisionIds: [] }
  };

  return buildDeterministicTurn(UNSUPPORTED_ACTION_MESSAGE, context, explanation, "unsupported_action_request", decisionSnapshotId);
}

// Workflow Handoff Approval Point (Epic 16.7) — turno gerado depois que
// a aprovação estrutural (approveRecommendationId, nunca texto livre —
// ver COPILOT_WORKFLOW_HANDOFF.md) já materializou o ExecutionWorkflow
// (16.6C). Mesma disciplina de buildClarifyTurn/buildUnsupportedActionTurn:
// nunca chama o Claude, `decisions`/`recommendations` da explanation
// ficam vazios de propósito — EngineeringAdvisorExplanationRecommendation
// exige isNew/recurring, que a Recommendation real (engines/decision) não
// carrega; inventar esses campos aqui violaria a mesma regra de
// honestidade já aplicada em buildGenericPlaybook (16.6A).
export function buildApprovalTurn(
  context: EngineeringAdvisorPromptContext,
  decisionSnapshotId: string | null,
  workflow: ExecutionWorkflow,
  tasks: ReadonlyArray<ExecutionTask>
): CopilotAssistantTurn {
  const explanation: EngineeringAdvisorExplanation = {
    insightTitle: "Recommendation aprovada",
    decisions: [],
    recommendations: [],
    evidence: [],
    missingReferences: { decisionIds: [], recommendationIds: [], evidenceDecisionIds: [] }
  };

  return buildDeterministicTurn(
    buildApprovalContent(workflow, tasks.length),
    context,
    explanation,
    "recommendation_approved",
    decisionSnapshotId
  );
}
