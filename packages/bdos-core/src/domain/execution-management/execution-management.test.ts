import {
  attachEvidenceReference,
  blockExecutionTask,
  cancelExecutionTask,
  completeExecutionTask,
  createExecutionTask,
  createExecutionWorkflow,
  startExecutionTask,
  unblockExecutionTask,
} from "./execution-management";
import { ExecutionTaskBlockReason, ExecutionTaskStatus, type ExecutionTask } from "./execution-management.types";

const baseWorkflowInput = {
  id: "workflow-1",
  actionPlanId: "action-plan-1",
  name: "Reduzir atraso do Bloco 2",
  objective: "Executar as ações do plano aprovado para o Bloco 2.",
  ownerRole: "site-engineer",
  createdAt: "2026-07-01T09:00:00.000Z",
  correlationId: "corr-1",
  createdBy: "user-1",
  sourceSystem: "field-studio-ui",
};

const baseTaskInput = {
  id: "task-1",
  workflowId: "workflow-1",
  sourceActionId: "action-1",
  title: "Mobilizar equipe adicional",
  description: "Reforçar a equipe de campo do Bloco 2.",
  createdAt: "2026-07-01T09:05:00.000Z",
  correlationId: "corr-2",
  createdBy: "user-1",
  sourceSystem: "field-studio-ui",
};

function createValidTask(): ExecutionTask {
  const result = createExecutionTask(baseTaskInput);
  if (!result.success) {
    throw new Error("fixture inválida: createExecutionTask deveria ter sucesso");
  }
  return result.task;
}

runTest("createExecutionWorkflow cria um workflow válido a partir de um ActionPlan", () => {
  const result = createExecutionWorkflow(baseWorkflowInput);
  assertTrue(result.success, "criação de workflow válido deve ter sucesso");
  if (result.success) {
    assertEqual(result.workflow.actionPlanId, "action-plan-1", "actionPlanId deve ser preservado");
    assertEqual(result.workflow.createdAt, "2026-07-01T09:00:00.000Z", "createdAt deve ser exatamente o que foi passado, nunca gerado internamente");
  }
});

runTest("createExecutionWorkflow rejeita actionPlanId ausente", () => {
  const result = createExecutionWorkflow({ ...baseWorkflowInput, actionPlanId: "" });
  assertTrue(!result.success, "workflow sem actionPlanId nunca deve ter sucesso");
  if (!result.success) {
    assertEqual(result.errors[0]?.code, "missing_action_plan_id", "erro deve identificar o campo ausente");
  }
});

runTest("createExecutionTask — PRINCIPLE 006: rejeita sourceActionId ausente (No Isolated Task)", () => {
  const result = createExecutionTask({ ...baseTaskInput, sourceActionId: "" });
  assertTrue(!result.success, "uma ExecutionTask sem Action de origem nunca pode ser criada");
  if (!result.success) {
    assertEqual(result.errors[0]?.code, "missing_source_action_id", "erro deve identificar sourceActionId como o campo ausente");
  }
});

runTest("createExecutionTask cria uma tarefa válida com status inicial NotStarted, sem bloqueio, sem evidência", () => {
  const task = createValidTask();
  assertEqual(task.status, ExecutionTaskStatus.NotStarted, "toda tarefa nova começa NotStarted");
  assertEqual(task.block, null, "toda tarefa nova começa sem bloqueio");
  assertEqual(task.evidenceReferences.length, 0, "toda tarefa nova começa sem evidência anexada");
  assertEqual(task.completedAt, null, "toda tarefa nova começa sem data de conclusão");
  assertEqual(task.scheduleActivityId, null, "scheduleActivityId é opcional — null quando não informado");
});

runTest("startExecutionTask transiciona NotStarted → InProgress", () => {
  const task = createValidTask();
  const result = startExecutionTask({ task, occurredAt: "2026-07-01T10:00:00.000Z" });
  assertTrue(result.success, "NotStarted → InProgress é uma transição válida");
  if (result.success) {
    assertEqual(result.task.status, ExecutionTaskStatus.InProgress, "status deve virar InProgress");
  }
});

runTest("blockExecutionTask exige uma descrição e transiciona InProgress → Blocked", () => {
  const task = createValidTask();
  const started = startExecutionTask({ task, occurredAt: "2026-07-01T10:00:00.000Z" });
  if (!started.success) throw new Error("fixture inválida");

  const blocked = blockExecutionTask({
    task: started.task,
    reason: ExecutionTaskBlockReason.AwaitingMaterial,
    description: "Aguardando entrega de material.",
    occurredAt: "2026-07-01T11:00:00.000Z",
  });

  assertTrue(blocked.success, "InProgress → Blocked é uma transição válida");
  if (blocked.success) {
    assertEqual(blocked.task.status, ExecutionTaskStatus.Blocked, "status deve virar Blocked");
    assertEqual(blocked.task.block?.reason, ExecutionTaskBlockReason.AwaitingMaterial, "motivo do bloqueio deve ser preservado");
  }
});

runTest("blockExecutionTask rejeita descrição vazia", () => {
  const task = createValidTask();
  const started = startExecutionTask({ task, occurredAt: "2026-07-01T10:00:00.000Z" });
  if (!started.success) throw new Error("fixture inválida");

  const blocked = blockExecutionTask({
    task: started.task,
    reason: ExecutionTaskBlockReason.Other,
    description: "",
    occurredAt: "2026-07-01T11:00:00.000Z",
  });

  assertTrue(!blocked.success, "bloqueio sem descrição nunca deve ter sucesso");
});

runTest("unblockExecutionTask transiciona Blocked → InProgress e limpa o bloqueio", () => {
  const task = createValidTask();
  const started = startExecutionTask({ task, occurredAt: "2026-07-01T10:00:00.000Z" });
  if (!started.success) throw new Error("fixture inválida");
  const blocked = blockExecutionTask({
    task: started.task,
    reason: ExecutionTaskBlockReason.FieldCondition,
    description: "Chuva impediu o trabalho.",
    occurredAt: "2026-07-01T11:00:00.000Z",
  });
  if (!blocked.success) throw new Error("fixture inválida");

  const unblocked = unblockExecutionTask({ task: blocked.task, occurredAt: "2026-07-01T12:00:00.000Z" });
  assertTrue(unblocked.success, "Blocked → InProgress é uma transição válida");
  if (unblocked.success) {
    assertEqual(unblocked.task.status, ExecutionTaskStatus.InProgress, "status deve voltar a InProgress");
    assertEqual(unblocked.task.block, null, "bloqueio deve ser limpo ao desbloquear");
  }
});

runTest("transição inválida é rejeitada: NotStarted não pode ir direto para Completed", () => {
  const task = createValidTask();
  const result = completeExecutionTask({ task, occurredAt: "2026-07-01T10:00:00.000Z" });
  assertTrue(!result.success, "NotStarted → Completed nunca é uma transição válida, mesmo com evidência (não há evidência aqui de qualquer forma)");
});

runTest("completeExecutionTask rejeita conclusão sem nenhuma evidência anexada", () => {
  const task = createValidTask();
  const started = startExecutionTask({ task, occurredAt: "2026-07-01T10:00:00.000Z" });
  if (!started.success) throw new Error("fixture inválida");

  const result = completeExecutionTask({ task: started.task, occurredAt: "2026-07-01T13:00:00.000Z" });
  assertTrue(!result.success, "uma ExecutionTask não pode ser concluída sem pelo menos uma evidência referenciada");
  if (!result.success) {
    assertEqual(result.errors[0]?.code, "completion_requires_evidence", "erro deve identificar a ausência de evidência como a causa");
  }
});

runTest("attachEvidenceReference anexa um vínculo sem copiar a evidência em si", () => {
  const task = createValidTask();
  const result = attachEvidenceReference({
    task,
    fieldEvidenceId: "field-evidence-1",
    description: "Foto do material entregue.",
    occurredAt: "2026-07-01T10:30:00.000Z",
  });

  assertTrue(result.success, "anexar evidência a uma tarefa válida deve ter sucesso");
  if (result.success) {
    assertEqual(result.task.evidenceReferences.length, 1, "deve conter exatamente 1 referência");
    assertEqual(result.task.evidenceReferences[0]?.fieldEvidenceId, "field-evidence-1", "a referência deve apontar para o id da FieldEvidence, nunca conter o dado bruto");
  }
});

runTest("completeExecutionTask conclui com sucesso quando há pelo menos 1 evidência anexada — decisão desta fase: Decision Engine nunca é consultado aqui", () => {
  const task = createValidTask();
  const started = startExecutionTask({ task, occurredAt: "2026-07-01T10:00:00.000Z" });
  if (!started.success) throw new Error("fixture inválida");

  const withEvidence = attachEvidenceReference({
    task: started.task,
    fieldEvidenceId: "field-evidence-1",
    description: "Foto do serviço concluído.",
    occurredAt: "2026-07-01T12:00:00.000Z",
  });
  if (!withEvidence.success) throw new Error("fixture inválida");

  const completed = completeExecutionTask({ task: withEvidence.task, occurredAt: "2026-07-01T13:00:00.000Z" });
  assertTrue(completed.success, "conclusão com evidência anexada deve ter sucesso");
  if (completed.success) {
    assertEqual(completed.task.status, ExecutionTaskStatus.Completed, "status deve virar Completed");
    assertEqual(completed.task.completedAt, "2026-07-01T13:00:00.000Z", "completedAt deve refletir o momento da conclusão");
  }
});

runTest("Completed é um estado terminal — nenhuma transição posterior é permitida", () => {
  const task = createValidTask();
  const started = startExecutionTask({ task, occurredAt: "2026-07-01T10:00:00.000Z" });
  if (!started.success) throw new Error("fixture inválida");
  const withEvidence = attachEvidenceReference({
    task: started.task,
    fieldEvidenceId: "field-evidence-1",
    description: "Evidência.",
    occurredAt: "2026-07-01T12:00:00.000Z",
  });
  if (!withEvidence.success) throw new Error("fixture inválida");
  const completed = completeExecutionTask({ task: withEvidence.task, occurredAt: "2026-07-01T13:00:00.000Z" });
  if (!completed.success) throw new Error("fixture inválida");

  const reopenAttempt = startExecutionTask({ task: completed.task, occurredAt: "2026-07-01T14:00:00.000Z" });
  assertTrue(!reopenAttempt.success, "uma tarefa Completed nunca pode voltar a InProgress");

  const cancelAttempt = cancelExecutionTask({ task: completed.task, occurredAt: "2026-07-01T14:00:00.000Z" });
  assertTrue(!cancelAttempt.success, "uma tarefa Completed nunca pode ser cancelada");
});

runTest("cancelExecutionTask transiciona NotStarted → Cancelled", () => {
  const task = createValidTask();
  const result = cancelExecutionTask({ task, occurredAt: "2026-07-01T10:00:00.000Z" });
  assertTrue(result.success, "NotStarted → Cancelled é uma transição válida");
  if (result.success) {
    assertEqual(result.task.status, ExecutionTaskStatus.Cancelled, "status deve virar Cancelled");
  }
});

runTest("resultado de uma transição é congelado — mutar o objeto retornado lança em modo estrito", () => {
  const task = createValidTask();
  const result = startExecutionTask({ task, occurredAt: "2026-07-01T10:00:00.000Z" });
  if (!result.success) throw new Error("fixture inválida");

  let threw = false;
  try {
    (result.task as { status: string }).status = "tampered";
  } catch {
    threw = true;
  }
  assertTrue(threw, "o objeto ExecutionTask retornado deve estar congelado (Object.freeze), mesma disciplina do resto do BDOS");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}
