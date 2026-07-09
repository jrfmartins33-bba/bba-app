-- Execution Engine (Epic 16, Fase 16.3) — schema + RLS.
--
-- Implementa a persistência do domain model puro de
-- packages/bdos-core/src/domain/execution-management (Fase 16.2),
-- seguindo a fronteira fechada em
-- packages/bdos-core/docs/EXECUTION_ENGINE.md e o princípio 006
-- ("No Isolated Task") de
-- packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md.
--
-- Achado que molda este schema: Decision/Recommendation (o tipo do
-- Decision Engine)/ActionPlan/Action/ScheduleActivity não têm tabela
-- própria — vivem como JSONB dentro de
-- decision_snapshots.decisions/.recommendations e
-- planning_datasets.dataset (ver 20260707180000_bdos_core_schema.sql,
-- comentário do Bloco 5: "guardado verbatim como JSONB... por que não
-- normalizar atividade-por-atividade"). Por isso action_plan_ref_id/
-- source_action_ref_id/schedule_activity_ref_id/field_evidence_ref_id
-- são TEXT, nunca FOREIGN KEY — não existe linha para referenciar.
-- A âncora real de proveniência é sempre a tabela-contêiner do JSONB
-- (decision_snapshot_id, planning_dataset_id), com FK de verdade —
-- mesmo padrão já usado por `recommendations.recommendation_ref_id`
-- (TEXT) + `recommendations.decision_snapshot_id` (FK).

-- BLOCO 1: TABELA execution_workflows (imutável — nenhuma função do
-- domain model de 16.2 altera um workflow depois de criado; só
-- SELECT/INSERT, mesmo raciocínio de planning_imports/
-- planning_datasets/decision_snapshots).
CREATE TABLE IF NOT EXISTS execution_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  decision_snapshot_id UUID NOT NULL REFERENCES decision_snapshots(id) ON DELETE CASCADE,
  -- Nullable: nem todo ActionPlan tem um planning_dataset associado
  -- (Ajuste 1 da revisão do CPO) — quando uma ExecutionTask desta
  -- workflow carregar schedule_activity_ref_id, é este dataset que dá
  -- contexto ao id; a Application Service (16.4) é quem valida essa
  -- consistência no momento de gravar a task, não uma CHECK aqui.
  planning_dataset_id UUID REFERENCES planning_datasets(id) ON DELETE SET NULL,
  action_plan_ref_id TEXT NOT NULL CHECK (length(trim(action_plan_ref_id)) > 0),
  name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  owner_role TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BLOCO 2: TABELA execution_tasks (mutável — status/bloqueio/
-- conclusão mudam ao longo do tempo; ver domain model em
-- execution-management.ts).
CREATE TABLE IF NOT EXISTS execution_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES execution_workflows(id) ON DELETE CASCADE,

  -- PRINCIPLE 006 ("No Isolated Task") reforçado em SQL, não só em
  -- TypeScript (defesa em profundidade, mesmo padrão de
  -- copilot_messages_assistant_has_full_trail): nunca vazio.
  source_action_ref_id TEXT NOT NULL CHECK (length(trim(source_action_ref_id)) > 0),
  -- Opcional (EXECUTION_ENGINE.md, Fronteira com Project Studio): nem
  -- toda Action aponta para uma atividade de cronograma específica.
  schedule_activity_ref_id TEXT,

  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT NOT NULL DEFAULT '',
  assignee_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'NotStarted'
    CHECK (status IN ('NotStarted', 'InProgress', 'Blocked', 'Completed', 'Cancelled')),

  block_reason TEXT
    CHECK (block_reason IS NULL OR block_reason IN ('awaiting_material', 'awaiting_approval', 'field_condition', 'awaiting_evidence', 'other')),
  block_description TEXT,
  blocked_at TIMESTAMPTZ,

  completed_at TIMESTAMPTZ,

  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Espelha exatamente o que blockExecutionTask/unblockExecutionTask
  -- já garantem em TypeScript: bloqueio só existe junto com o status
  -- Blocked, nunca parcialmente preenchido.
  CONSTRAINT execution_tasks_block_fields_consistent CHECK (
    (status = 'Blocked' AND block_reason IS NOT NULL AND block_description IS NOT NULL AND length(trim(block_description)) > 0 AND blocked_at IS NOT NULL)
    OR
    (status <> 'Blocked' AND block_reason IS NULL AND block_description IS NULL AND blocked_at IS NULL)
  ),

  -- Espelha completeExecutionTask: completed_at só existe junto com o
  -- status Completed.
  CONSTRAINT execution_tasks_completed_at_consistent CHECK (
    (status = 'Completed' AND completed_at IS NOT NULL)
    OR
    (status <> 'Completed' AND completed_at IS NULL)
  )
);

DROP TRIGGER IF EXISTS set_execution_tasks_updated_at ON execution_tasks;
CREATE TRIGGER set_execution_tasks_updated_at
BEFORE UPDATE ON execution_tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 3: TABELA execution_task_evidence_references (append-only —
-- vínculo, nunca a evidência em si; mesmo padrão de
-- Decision.evidence[]/Recommendation.traceability.evidenceReferences[]
-- no domain model, ver EXECUTION_ENGINE.md).
CREATE TABLE IF NOT EXISTS execution_task_evidence_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  execution_task_id UUID NOT NULL REFERENCES execution_tasks(id) ON DELETE CASCADE,
  field_evidence_ref_id TEXT NOT NULL CHECK (length(trim(field_evidence_ref_id)) > 0),
  description TEXT NOT NULL DEFAULT '',
  attached_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  attached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS execution_task_evidence_references_task_id_idx
  ON execution_task_evidence_references (execution_task_id, attached_at);

-- BLOCO 4: TABELA execution_task_status_history (append-only —
-- trilha de auditoria de toda transição de status).
CREATE TABLE IF NOT EXISTS execution_task_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  execution_task_id UUID NOT NULL REFERENCES execution_tasks(id) ON DELETE CASCADE,
  from_status TEXT
    CHECK (from_status IS NULL OR from_status IN ('NotStarted', 'InProgress', 'Blocked', 'Completed', 'Cancelled')),
  to_status TEXT NOT NULL
    CHECK (to_status IN ('NotStarted', 'InProgress', 'Blocked', 'Completed', 'Cancelled')),
  reason TEXT NOT NULL DEFAULT '',
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS execution_task_status_history_task_id_idx
  ON execution_task_status_history (execution_task_id, occurred_at);

-- BLOCO 5: HABILITAR RLS
ALTER TABLE execution_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_task_evidence_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_task_status_history ENABLE ROW LEVEL SECURITY;

-- BLOCO 6: POLITICAS RLS — execution_workflows (imutável: só
-- SELECT/INSERT).
DROP POLICY IF EXISTS execution_workflows_select_company_or_admin ON execution_workflows;
CREATE POLICY execution_workflows_select_company_or_admin
ON execution_workflows FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS execution_workflows_insert_company_or_admin ON execution_workflows;
CREATE POLICY execution_workflows_insert_company_or_admin
ON execution_workflows FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS execution_workflows_update_blocked ON execution_workflows;
CREATE POLICY execution_workflows_update_blocked
ON execution_workflows FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS execution_workflows_delete_blocked ON execution_workflows;
CREATE POLICY execution_workflows_delete_blocked
ON execution_workflows FOR DELETE TO authenticated USING (false);

-- BLOCO 7: POLITICAS RLS — execution_tasks (mutável: status/bloqueio/
-- conclusão; "excluir" nunca é um DELETE real — status Cancelled é o
-- equivalente, mesmo raciocínio de recommendations.status=dismissed).
DROP POLICY IF EXISTS execution_tasks_select_company_or_admin ON execution_tasks;
CREATE POLICY execution_tasks_select_company_or_admin
ON execution_tasks FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS execution_tasks_insert_company_or_admin ON execution_tasks;
CREATE POLICY execution_tasks_insert_company_or_admin
ON execution_tasks FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS execution_tasks_update_company_or_admin ON execution_tasks;
CREATE POLICY execution_tasks_update_company_or_admin
ON execution_tasks FOR UPDATE TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS execution_tasks_delete_blocked ON execution_tasks;
CREATE POLICY execution_tasks_delete_blocked
ON execution_tasks FOR DELETE TO authenticated USING (false);

-- BLOCO 8: POLITICAS RLS — execution_task_evidence_references
-- (append-only real — Ajuste 2 da revisão do CPO: sem UPDATE, sem
-- DELETE, mesmo que hoje não exista função de domínio que remova uma
-- referência).
DROP POLICY IF EXISTS execution_task_evidence_references_select_company_or_admin ON execution_task_evidence_references;
CREATE POLICY execution_task_evidence_references_select_company_or_admin
ON execution_task_evidence_references FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS execution_task_evidence_references_insert_company_or_admin ON execution_task_evidence_references;
CREATE POLICY execution_task_evidence_references_insert_company_or_admin
ON execution_task_evidence_references FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS execution_task_evidence_references_update_blocked ON execution_task_evidence_references;
CREATE POLICY execution_task_evidence_references_update_blocked
ON execution_task_evidence_references FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS execution_task_evidence_references_delete_blocked ON execution_task_evidence_references;
CREATE POLICY execution_task_evidence_references_delete_blocked
ON execution_task_evidence_references FOR DELETE TO authenticated USING (false);

-- BLOCO 9: POLITICAS RLS — execution_task_status_history
-- (append-only, mesmo raciocínio).
DROP POLICY IF EXISTS execution_task_status_history_select_company_or_admin ON execution_task_status_history;
CREATE POLICY execution_task_status_history_select_company_or_admin
ON execution_task_status_history FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS execution_task_status_history_insert_company_or_admin ON execution_task_status_history;
CREATE POLICY execution_task_status_history_insert_company_or_admin
ON execution_task_status_history FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS execution_task_status_history_update_blocked ON execution_task_status_history;
CREATE POLICY execution_task_status_history_update_blocked
ON execution_task_status_history FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS execution_task_status_history_delete_blocked ON execution_task_status_history;
CREATE POLICY execution_task_status_history_delete_blocked
ON execution_task_status_history FOR DELETE TO authenticated USING (false);

-- BLOCO 10: GRANTS explícitos desde a primeira migration (evita
-- repetir a lacuna retroativa do Sprint 13.6 —
-- 20260707200000_bdos_core_schema_grants.sql — e do hardening de
-- 13.11). Espelham exatamente os verbos com policy não-bloqueada
-- acima.
GRANT SELECT, INSERT ON public.execution_workflows TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.execution_tasks TO authenticated;
GRANT SELECT, INSERT ON public.execution_task_evidence_references TO authenticated;
GRANT SELECT, INSERT ON public.execution_task_status_history TO authenticated;

-- BLOCO 11: Trigger 1 — company_id de execution_workflows precisa
-- bater com engineering_projects.company_id E
-- decision_snapshots.company_id — fecha, para este Epic, a mesma
-- lacuna que advisor_narratives deixou em aberto (FKs independentes
-- sem checagem cruzada entre si), mesmo padrão de
-- 20260709000000_bdos_decision_copilot.sql.
CREATE OR REPLACE FUNCTION enforce_execution_workflow_company_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id <> (
    SELECT company_id FROM engineering_projects WHERE id = NEW.engineering_project_id
  ) THEN
    RAISE EXCEPTION 'execution_workflows.company_id must match engineering_projects.company_id';
  END IF;

  IF NEW.company_id <> (
    SELECT company_id FROM decision_snapshots WHERE id = NEW.decision_snapshot_id
  ) THEN
    RAISE EXCEPTION 'execution_workflows.company_id must match decision_snapshots.company_id';
  END IF;

  IF NEW.planning_dataset_id IS NOT NULL AND NEW.company_id <> (
    SELECT company_id FROM planning_datasets WHERE id = NEW.planning_dataset_id
  ) THEN
    RAISE EXCEPTION 'execution_workflows.company_id must match planning_datasets.company_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS execution_workflows_company_consistency ON execution_workflows;
CREATE TRIGGER execution_workflows_company_consistency
BEFORE INSERT ON execution_workflows
FOR EACH ROW EXECUTE FUNCTION enforce_execution_workflow_company_consistency();

-- BLOCO 12: Trigger 2 — company_id de execution_tasks precisa bater
-- com execution_workflows.company_id da workflow referenciada.
CREATE OR REPLACE FUNCTION enforce_execution_task_company_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id <> (
    SELECT company_id FROM execution_workflows WHERE id = NEW.workflow_id
  ) THEN
    RAISE EXCEPTION 'execution_tasks.company_id must match execution_workflows.company_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS execution_tasks_company_consistency ON execution_tasks;
CREATE TRIGGER execution_tasks_company_consistency
BEFORE INSERT ON execution_tasks
FOR EACH ROW EXECUTE FUNCTION enforce_execution_task_company_consistency();

-- BLOCO 13: Trigger 3 — company_id de execution_task_evidence_references
-- precisa bater com execution_tasks.company_id da task referenciada.
CREATE OR REPLACE FUNCTION enforce_execution_evidence_reference_company_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id <> (
    SELECT company_id FROM execution_tasks WHERE id = NEW.execution_task_id
  ) THEN
    RAISE EXCEPTION 'execution_task_evidence_references.company_id must match execution_tasks.company_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS execution_task_evidence_references_company_consistency ON execution_task_evidence_references;
CREATE TRIGGER execution_task_evidence_references_company_consistency
BEFORE INSERT ON execution_task_evidence_references
FOR EACH ROW EXECUTE FUNCTION enforce_execution_evidence_reference_company_consistency();

-- BLOCO 14: Trigger 4 — company_id de execution_task_status_history
-- precisa bater com execution_tasks.company_id da task referenciada.
CREATE OR REPLACE FUNCTION enforce_execution_status_history_company_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id <> (
    SELECT company_id FROM execution_tasks WHERE id = NEW.execution_task_id
  ) THEN
    RAISE EXCEPTION 'execution_task_status_history.company_id must match execution_tasks.company_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS execution_task_status_history_company_consistency ON execution_task_status_history;
CREATE TRIGGER execution_task_status_history_company_consistency
BEFORE INSERT ON execution_task_status_history
FOR EACH ROW EXECUTE FUNCTION enforce_execution_status_history_company_consistency();

-- BLOCO 15: Trigger 5 — "No Isolated Task" reforçado em SQL: uma
-- ExecutionTask só pode transicionar para Completed se já existir
-- pelo menos 1 linha em execution_task_evidence_references para ela
-- (Ajuste 2 da revisão do CPO). BEFORE UPDATE OF status, disparada só
-- quando o novo valor é Completed — lê o estado transacional atual de
-- execution_task_evidence_references, então cobre o caso em que a
-- evidência foi inserida na mesma transação que a atualização de
-- status (INSERT + UPDATE dentro da mesma transação já enxergam a
-- linha inserida antes do COMMIT, mesmo em READ COMMITTED, que é o
-- default do Postgres/Supabase).
CREATE OR REPLACE FUNCTION enforce_execution_task_completion_requires_evidence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Completed' AND NOT EXISTS (
    SELECT 1 FROM execution_task_evidence_references WHERE execution_task_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'execution_tasks cannot transition to Completed without at least one evidence reference';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS execution_task_completion_requires_evidence ON execution_tasks;
CREATE TRIGGER execution_task_completion_requires_evidence
BEFORE UPDATE OF status ON execution_tasks
FOR EACH ROW
WHEN (NEW.status = 'Completed')
EXECUTE FUNCTION enforce_execution_task_completion_requires_evidence();

-- BLOCO 16: COMENTARIOS
COMMENT ON TABLE execution_workflows IS
  'Execution Engine (Epic 16) — agrupamento de ExecutionTasks derivado de um ActionPlan (1:1 nesta fase). Imutável (só SELECT/INSERT). action_plan_ref_id é TEXT, não FK: ActionPlan vive como JSONB dentro de decision_snapshots.recommendations, nunca normalizado em tabela própria.';
COMMENT ON TABLE execution_tasks IS
  'Execution Engine (Epic 16) — unidade de apontamento de execução. source_action_ref_id nunca é opcional (PRINCIPLE 006, "No Isolated Task", packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md). schedule_activity_ref_id é opcional e, como ScheduleActivity também não é normalizada, é TEXT sem FK.';
COMMENT ON TABLE execution_task_evidence_references IS
  'Vínculo com uma FieldEvidence (Studio de Evidências), nunca a evidência em si — append-only. field_evidence_ref_id é TEXT, não FK: FieldEvidence ainda não tem tabela própria em produção.';
COMMENT ON TABLE execution_task_status_history IS
  'Trilha de auditoria append-only de toda transição de status de uma ExecutionTask.';
COMMENT ON COLUMN execution_workflows.planning_dataset_id IS
  'Nullable: nem todo ActionPlan tem um planning_dataset associado. Quando uma ExecutionTask desta workflow carregar schedule_activity_ref_id, é este dataset que dá contexto ao id — a Application Service (Fase 16.4) valida essa consistência, não uma CHECK aqui.';
