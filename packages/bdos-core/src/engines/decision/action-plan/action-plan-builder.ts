import type { Playbook, PlaybookStep } from "../playbook";
import type {
  Action,
  ActionPlan,
  ActionPlanMetadata,
  BuildActionPlansInput,
  BuildActionPlansResult,
  Checkpoint,
} from "./action-plan.types";

const cashProtectionRecommendationType = "cash_protection";

// Epic 16.6B — generaliza buildActionPlans: todo Playbook (curado ou
// genérico, ver 16.6A) agora produz um ActionPlan real, nunca mais
// null. createAction já era genérica (funciona para qualquer
// PlaybookStep) e permanece inalterada — cada PlaybookStep ainda vira
// exatamente 1 Action, com sourceStepId sempre obrigatório apontando
// para um PlaybookStep real. A cadeia PRINCIPLE 006 (Decision ->
// Recommendation -> Playbook -> ActionPlan -> Action -> ExecutionTask
// -> EvidenceReference[]) permanece intacta nos dois caminhos. Ver
// packages/bdos-core/docs/ACTIONPLAN_MATERIALIZATION_BOUNDARY.md.
export function buildActionPlans(
  playbooks: BuildActionPlansInput,
): BuildActionPlansResult {
  return playbooks.map((playbook) => buildActionPlan(playbook));
}

function buildActionPlan(playbook: Playbook): ActionPlan {
  return isCashProtectionPlaybook(playbook)
    ? buildCashProtectionActionPlan(playbook)
    : buildGenericActionPlan(playbook);
}

function buildCashProtectionActionPlan(playbook: Playbook): ActionPlan {
  const actionPlanId = `action-plan:${playbook.id}:cash-protection`;

  return {
    id: actionPlanId,
    playbookId: playbook.id,
    name: "Cash Protection Action Plan",
    objective: playbook.objective,
    actions: playbook.steps.map((step, index) =>
      createAction(actionPlanId, step, index + 1),
    ),
    checkpoints: buildCashProtectionCheckpoints(actionPlanId, playbook),
    ownerRole: "Finance owner",
    status: "created",
    metadata: buildActionPlanMetadata(playbook),
  };
}

// Caminho genérico (Epic 16.6B) — checkpoints/ownerRole ficam vazios
// de propósito: nenhum template curado existe fora de cash protection
// para descrever "o que marca esse plano como concluído" ou "quem é o
// dono" honestamente. Mesma regra de honestidade do 16.6A — nada aqui
// é inventado.
function buildGenericActionPlan(playbook: Playbook): ActionPlan {
  const actionPlanId = `action-plan:${playbook.id}:generic`;

  return {
    id: actionPlanId,
    playbookId: playbook.id,
    name: playbook.name,
    objective: playbook.objective,
    actions: playbook.steps.map((step, index) =>
      createAction(actionPlanId, step, index + 1),
    ),
    checkpoints: [],
    ownerRole: "",
    status: "created",
    metadata: buildActionPlanMetadata(playbook),
  };
}

function buildActionPlanMetadata(playbook: Playbook): ActionPlanMetadata {
  return {
    playbookId: playbook.id,
    recommendationId: playbook.recommendationId,
    decisionId: getStringMetadata(playbook.metadata, "decisionId"),
    diagnosisId: getStringMetadata(playbook.metadata, "diagnosisId"),
    capability: getStringMetadata(playbook.metadata, "capability"),
    capabilities: getStringArrayMetadata(playbook.metadata, "capabilities"),
    businessFactIds: getStringArrayMetadata(
      playbook.metadata,
      "businessFactIds",
    ),
  };
}

function isCashProtectionPlaybook(playbook: Playbook): boolean {
  return (
    playbook.name === "Cash Protection Playbook" &&
    getStringMetadata(playbook.metadata, "recommendationType") ===
      cashProtectionRecommendationType
  );
}

function createAction(
  actionPlanId: string,
  step: PlaybookStep,
  sequence: number,
): Action {
  return {
    id: `${actionPlanId}:action:${sequence}`,
    title: step.title,
    description: step.description,
    sequence,
    priority: step.priority,
    expectedOutcome: `Completed: ${step.title}`,
    sourceStepId: step.id,
  };
}

function buildCashProtectionCheckpoints(
  actionPlanId: string,
  playbook: Playbook,
): ReadonlyArray<Checkpoint> {
  return [
    createCheckpoint(
      actionPlanId,
      1,
      "Cash position reviewed",
      "Current and projected cash position has been reviewed.",
      [playbook.successCriteria[0] ?? "Positive projected cash"],
    ),
    createCheckpoint(
      actionPlanId,
      2,
      "Receivables action started",
      "Receivables acceleration actions have started.",
      ["Accounts receivable actions initiated"],
    ),
    createCheckpoint(
      actionPlanId,
      3,
      "Supplier negotiation started",
      "Supplier payment term negotiations have started.",
      ["Supplier payment terms reviewed"],
    ),
    createCheckpoint(
      actionPlanId,
      4,
      "Expense review completed",
      "Operating expense review has been completed.",
      ["Non-critical expenses reviewed"],
    ),
    createCheckpoint(
      actionPlanId,
      5,
      "Cash projection updated",
      "Cash projection has been updated after actions were planned.",
      playbook.successCriteria,
    ),
  ];
}

function createCheckpoint(
  actionPlanId: string,
  sequence: number,
  title: string,
  description: string,
  successCriteria: ReadonlyArray<string>,
): Checkpoint {
  return {
    id: `${actionPlanId}:checkpoint:${sequence}`,
    title,
    description,
    sequence,
    successCriteria,
  };
}

function getStringMetadata(
  metadata: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = metadata[key];

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getStringArrayMetadata(
  metadata: Readonly<Record<string, unknown>>,
  key: string,
): ReadonlyArray<string> {
  const value = metadata[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}
