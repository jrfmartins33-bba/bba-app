-- Decision Copilot — Workflow Handoff Approval Point (Epic 16.7).
--
-- Ver packages/bdos-core/docs/COPILOT_WORKFLOW_HANDOFF.md para o
-- desenho completo, revisado e aprovado com ressalvas pelo CPO em
-- 2026-07-09. Esta migration implementa as duas peças que o documento
-- fixou como invariantes obrigatórias, não detalhe de implementação:
--
-- 1. "approveRecommendationId deve resolver exatamente 1
--    Recommendation" — resolvido em TypeScript
--    (copilot-approval-orchestrator.ts, .filter() + checagem de
--    contagem), não em SQL; esta migration não repete essa checagem.
-- 2. "o fluxo de aprovação estrutural precisa ser executado como uma
--    única transação" — resolvido aqui: approve_copilot_recommendation
--    é uma única função plpgsql, que é implicitamente uma transação
--    (qualquer exceção levantada dentro dela desfaz todos os INSERTs já
--    feitos). SECURITY INVOKER (padrão do Postgres, omitido de
--    propósito): cada INSERT dentro da função continua sujeito às
--    políticas RLS de authenticated normalmente, exatamente como se o
--    cliente tivesse emitido os mesmos INSERTs diretamente — não há
--    elevação de privilégio aqui, só atomicidade.
--
-- Idempotência de dupla aprovação (Risco 4 do documento): antes de
-- inserir, a função verifica se já existe um execution_workflows com o
-- mesmo (engineering_project_id, action_plan_ref_id) — action_plan_ref_id
-- já é determinístico por Recommendation.id
-- (materializeExecutionWorkflowFromRecommendation, 16.6C). Se existir,
-- retorna esse workflow como already_approved=true, sem inserir nada
-- novo (nem workflow, nem tasks, nem um segundo turno do Copilot) — a
-- segunda aprovação é um sucesso idempotente, nunca um erro de
-- constraint vazado ao usuário. O índice único abaixo é a segunda linha
-- de defesa (fecha a corrida entre o SELECT de checagem e o INSERT,
-- mesmo padrão de "CHECK no banco como defesa em profundidade" já usado
-- em copilot_messages_assistant_has_full_trail/
-- execution_task_completion_requires_evidence).

-- BLOCO 1: índice único que fecha a corrida de dupla aprovação
-- concorrente (dois cliques quase simultâneos, duas abas) — sem isso,
-- a checagem em approve_copilot_recommendation (SELECT antes do
-- INSERT) teria uma janela de corrida real.
CREATE UNIQUE INDEX IF NOT EXISTS execution_workflows_project_action_plan_unique
  ON execution_workflows (engineering_project_id, action_plan_ref_id);

COMMENT ON INDEX execution_workflows_project_action_plan_unique IS
  'Epic 16.7 — garante que a mesma Recommendation (identificada por action_plan_ref_id, determinístico) nunca materializa 2 ExecutionWorkflows no mesmo projeto, mesmo sob aprovação concorrente. approve_copilot_recommendation() checa isto antes do INSERT; este índice é a segunda linha de defesa contra a corrida entre o SELECT de checagem e o INSERT.';

-- BLOCO 2: approve_copilot_recommendation — a transação atômica do
-- Workflow Handoff. Recebe o ExecutionWorkflow/ExecutionTasks já
-- materializados em memória por
-- materializeExecutionWorkflowFromRecommendation (16.6C, bdos-core —
-- nenhuma lógica de negócio nova aqui, esta função só persiste o que
-- já foi decidido) e o CopilotAssistantTurn já construído por
-- buildApprovalTurn (também bdos-core), e grava as três coisas juntas:
-- execution_workflows, execution_tasks (+ status history), e o turno
-- assistant em copilot_messages.
CREATE OR REPLACE FUNCTION approve_copilot_recommendation(
  p_company_id UUID,
  p_engineering_project_id UUID,
  p_decision_snapshot_id UUID,
  p_planning_dataset_id UUID,
  p_conversation_id UUID,
  p_created_by UUID,
  p_workflow_action_plan_ref_id TEXT,
  p_workflow_name TEXT,
  p_workflow_objective TEXT,
  p_workflow_owner_role TEXT,
  p_tasks JSONB,
  p_turn_content TEXT,
  p_turn_context_snapshot JSONB,
  p_turn_context_hash TEXT,
  p_turn_reasoning_chain JSONB,
  p_turn_confidence JSONB,
  p_turn_explainability JSONB,
  p_turn_model TEXT
) RETURNS JSONB AS $$
DECLARE
  v_existing_workflow_id UUID;
  v_workflow_id UUID;
  v_task JSONB;
  v_task_id UUID;
  v_task_ids UUID[] := ARRAY[]::UUID[];
  v_message_id UUID;
BEGIN
  -- Idempotência (Risco 4, COPILOT_WORKFLOW_HANDOFF.md): já aprovado
  -- para esta Recommendation neste projeto? Devolve o existente, não
  -- insere nada novo.
  SELECT id INTO v_existing_workflow_id
  FROM execution_workflows
  WHERE company_id = p_company_id
    AND engineering_project_id = p_engineering_project_id
    AND action_plan_ref_id = p_workflow_action_plan_ref_id
  LIMIT 1;

  IF v_existing_workflow_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'already_approved', true,
      'workflow_id', v_existing_workflow_id,
      'task_ids', (
        SELECT COALESCE(jsonb_agg(id), '[]'::jsonb)
        FROM execution_tasks
        WHERE workflow_id = v_existing_workflow_id
      ),
      'copilot_message_id', NULL
    );
  END IF;

  INSERT INTO execution_workflows (
    company_id, engineering_project_id, decision_snapshot_id, planning_dataset_id,
    action_plan_ref_id, name, objective, owner_role, created_by
  ) VALUES (
    p_company_id, p_engineering_project_id, p_decision_snapshot_id, p_planning_dataset_id,
    p_workflow_action_plan_ref_id, p_workflow_name, p_workflow_objective, p_workflow_owner_role, p_created_by
  )
  RETURNING id INTO v_workflow_id;

  FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
  LOOP
    INSERT INTO execution_tasks (
      company_id, workflow_id, source_action_ref_id, schedule_activity_ref_id, title, description, created_by
    ) VALUES (
      p_company_id, v_workflow_id,
      v_task->>'sourceActionId',
      v_task->>'scheduleActivityId',
      v_task->>'title',
      v_task->>'description',
      p_created_by
    )
    RETURNING id INTO v_task_id;

    v_task_ids := array_append(v_task_ids, v_task_id);

    INSERT INTO execution_task_status_history (
      company_id, execution_task_id, from_status, to_status, reason, changed_by
    ) VALUES (
      p_company_id, v_task_id, NULL, 'NotStarted',
      'Tarefa criada a partir da aprovação da Recommendation no Decision Copilot.', p_created_by
    );
  END LOOP;

  INSERT INTO copilot_messages (
    company_id, conversation_id, role, content, context_snapshot, context_hash,
    reasoning_chain, confidence, explainability, decision_snapshot_id, model
  ) VALUES (
    p_company_id, p_conversation_id, 'assistant', p_turn_content, p_turn_context_snapshot, p_turn_context_hash,
    p_turn_reasoning_chain, p_turn_confidence, p_turn_explainability, p_decision_snapshot_id, p_turn_model
  )
  RETURNING id INTO v_message_id;

  RETURN jsonb_build_object(
    'already_approved', false,
    'workflow_id', v_workflow_id,
    'task_ids', to_jsonb(v_task_ids),
    'copilot_message_id', v_message_id
  );
END;
$$ LANGUAGE plpgsql;

-- SECURITY INVOKER é o padrão (nenhuma cláusula SECURITY DEFINER
-- acima) — cada INSERT dentro da função roda com o papel/RLS de quem
-- chamou (authenticated), incluindo os triggers de consistência de
-- company_id (enforce_execution_workflow_company_consistency etc., já
-- existentes desde 16.3/Fase 1) — nenhuma checagem é duplicada aqui.
GRANT EXECUTE ON FUNCTION approve_copilot_recommendation(
  UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, JSONB, TEXT, JSONB, JSONB, JSONB, TEXT
) TO authenticated;

COMMENT ON FUNCTION approve_copilot_recommendation IS
  'Epic 16.7 — Workflow Handoff Approval Point. Persiste, numa única transação (implícita ao corpo da função), o ExecutionWorkflow + ExecutionTasks já materializados por materializeExecutionWorkflowFromRecommendation (16.6C, bdos-core) e o turno de aprovação já construído por buildApprovalTurn (bdos-core) — nunca calcula nada de negócio aqui, só persiste. Idempotente: uma segunda chamada para a mesma Recommendation no mesmo projeto devolve already_approved=true com o workflow já existente, sem inserir nada novo. SECURITY INVOKER (padrão) — RLS de authenticated se aplica normalmente a cada INSERT dentro da função.';
