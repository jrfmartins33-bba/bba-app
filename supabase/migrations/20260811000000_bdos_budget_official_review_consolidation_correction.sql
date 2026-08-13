-- Epic 21, Sprint 21.5A — Correção cirúrgica: fecha o workflow comercial
-- (Bloqueador A) e introduz a Decisão de Reconciliação (Bloqueador B).
--
-- NUNCA edita 20260810000000_bdos_budget_official_review.sql (já aplicada
-- em produção) — toda mudança de schema/RLS entra aqui, aditiva.
--
-- BLOQUEADOR A: consolidateBudgetReviewSessionService (packages/bdos-core)
-- agora projeta as Linhas de Revisão aprovadas para budget_lines e persiste
-- a budget_versions consolidada via persist_budget_version_snapshot
-- (20260714000004) ANTES de marcar a Sessão Consolidated — esta migration
-- não precisa de nenhuma função nova para isso (reaproveita a
-- infraestrutura já existente do domínio budget-version), só habilita a
-- leitura correta do lado da Sessão (Bloco 3 abaixo).
--
-- BLOQUEADOR B: uma divergência de reconciliação pode agora ser aceita
-- como documentada por um Admin BBA (`reconciliationDecision:
-- AcceptedAsDocumented`) sem alterar `revised` — Blocos 1-2 abaixo
-- adicionam as colunas e a função de servidor correspondentes.

-- BLOCO 1: colunas da Decisão de Reconciliação em budget_review_rows.
-- Campos explícitos (não JSON opaco — enunciado da correção §11): actor,
-- justificativa e timestamp da decisão humana, sempre juntos (CHECK de
-- consistência) ou todos NULL (nenhuma decisão tomada ainda).
ALTER TABLE budget_review_rows
  ADD COLUMN IF NOT EXISTS reconciliation_decision_status TEXT,
  ADD COLUMN IF NOT EXISTS reconciliation_decision_actor UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reconciliation_decision_justification TEXT,
  ADD COLUMN IF NOT EXISTS reconciliation_decision_at TIMESTAMPTZ;

ALTER TABLE budget_review_rows
  DROP CONSTRAINT IF EXISTS budget_review_rows_reconciliation_decision_status_check;
ALTER TABLE budget_review_rows
  ADD CONSTRAINT budget_review_rows_reconciliation_decision_status_check
  CHECK (reconciliation_decision_status IS NULL OR reconciliation_decision_status IN ('AcceptedAsDocumented'));

ALTER TABLE budget_review_rows
  DROP CONSTRAINT IF EXISTS budget_review_rows_reconciliation_decision_consistency;
ALTER TABLE budget_review_rows
  ADD CONSTRAINT budget_review_rows_reconciliation_decision_consistency
  CHECK (
    (reconciliation_decision_status IS NULL AND reconciliation_decision_actor IS NULL AND reconciliation_decision_justification IS NULL AND reconciliation_decision_at IS NULL)
    OR
    (reconciliation_decision_status IS NOT NULL AND reconciliation_decision_actor IS NOT NULL AND reconciliation_decision_justification IS NOT NULL AND reconciliation_decision_at IS NOT NULL)
  );

COMMENT ON COLUMN budget_review_rows.reconciliation_decision_status IS
  'Decisão humana de reconciliação (correção Sprint 21.5A §7) — separada de state (Confirmado/Corrigido continuam significando apenas "revisor avaliou os valores"). AcceptedAsDocumented nunca altera revised.';

-- BLOCO 2: amplia o vocabulário de budget_review_audit_events.action para
-- incluir as duas novas ações (aceitação individual e em lote).
ALTER TABLE budget_review_audit_events
  DROP CONSTRAINT IF EXISTS budget_review_audit_events_action_check;
ALTER TABLE budget_review_audit_events
  ADD CONSTRAINT budget_review_audit_events_action_check
  CHECK (action IN (
    'RowImported', 'RowConfirmed', 'RowCorrected', 'RowExcluded', 'RowRestored',
    'RowInsertedManually', 'BulkConfirmed', 'SessionConsolidated',
    'ReconciliationAcceptedAsDocumented', 'BulkReconciliationAcceptedAsDocumented'
  ));

-- BLOCO 3: record_budget_review_reconciliation_decision — operação
-- exclusiva de servidor, mesma disciplina das funções de
-- 20260810000000 (SECURITY INVOKER, EXECUTE só para service_role,
-- p_actor_id validado como Admin BBA). Nunca toca state/revised — apenas
-- as quatro colunas de decisão e o evento de auditoria correspondente, na
-- mesma transação implícita da função.
CREATE OR REPLACE FUNCTION record_budget_review_reconciliation_decision(
  p_actor_id UUID,
  p_company_id UUID,
  p_row_id UUID,
  p_session_id UUID,
  p_status TEXT,
  p_justification TEXT,
  p_decided_at TIMESTAMPTZ,
  p_audit_event_id TEXT,
  p_audit_action TEXT,
  p_audit_actor TEXT,
  p_audit_occurred_at TIMESTAMPTZ,
  p_audit_justification TEXT,
  p_audit_metadata JSONB
) RETURNS JSONB
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Actor is required.' USING ERRCODE = '28000';
  END IF;

  IF NOT is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not authorized to record a Decisão de Reconciliação (Admin BBA only).', p_actor_id USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM budget_review_sessions WHERE id = p_session_id AND company_id = p_company_id AND status = 'InProgress') THEN
    RAISE EXCEPTION 'budget_review_sessions % not found, not in this company, or not InProgress.', p_session_id USING ERRCODE = 'P0002';
  END IF;

  UPDATE budget_review_rows
  SET reconciliation_decision_status = p_status,
      reconciliation_decision_actor = p_actor_id,
      reconciliation_decision_justification = p_justification,
      reconciliation_decision_at = p_decided_at
  WHERE id = p_row_id AND company_id = p_company_id AND session_id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_budget_review_reconciliation_decision: row % not found for company_id %', p_row_id, p_company_id;
  END IF;

  IF p_audit_event_id IS NOT NULL THEN
    INSERT INTO budget_review_audit_events (
      id, company_id, session_id, row_id, action, actor, occurred_at, field_changes, justification, metadata
    ) VALUES (
      p_audit_event_id, p_company_id, p_session_id, p_row_id, p_audit_action, p_audit_actor, p_audit_occurred_at,
      '[]'::JSONB, p_audit_justification, COALESCE(p_audit_metadata, '{}'::JSONB)
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION record_budget_review_reconciliation_decision(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB
) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_budget_review_reconciliation_decision(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB
) FROM anon;
REVOKE ALL ON FUNCTION record_budget_review_reconciliation_decision(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB
) FROM authenticated;
GRANT EXECUTE ON FUNCTION record_budget_review_reconciliation_decision(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB
) TO service_role;

COMMENT ON FUNCTION record_budget_review_reconciliation_decision IS
  'Correção Sprint 21.5A §7/§11 — operação exclusiva de servidor (EXECUTE só para service_role). p_actor_id validado como Admin BBA. Grava a Decisão de Reconciliação (AcceptedAsDocumented) e seu evento de auditoria; nunca altera state/revised de budget_review_rows.';

-- BLOCO 4: correção de RLS (enunciado da correção §14) —
-- budget_review_sessions.SELECT era `company_id = get_my_company_id() OR
-- is_bba_admin()`, permitindo um Cliente autenticado da própria empresa
-- consultar metadata da Sessão de Revisão (nunca necessário para
-- /orcamentos, que lê apenas budget_versions Consolidated). Revisão é
-- trabalho Admin BBA exclusivo (enunciado original §47) — a mesma
-- disciplina já aplicada a budget_review_rows/budget_review_audit_events
-- desde 20260810000000 passa a valer também para budget_review_sessions.
DROP POLICY IF EXISTS budget_review_sessions_select_company_or_admin ON budget_review_sessions;
DROP POLICY IF EXISTS budget_review_sessions_select_admin_only ON budget_review_sessions;
CREATE POLICY budget_review_sessions_select_admin_only
ON budget_review_sessions FOR SELECT TO authenticated
USING (is_bba_admin());
