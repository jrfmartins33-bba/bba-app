-- Epic 21, Sprint 21.5C.2B — Correção cirúrgica das RPCs batch para o schema REAL.
--
-- Tabela budget_review_audit_events colunas reais:
--   id, company_id, session_id, row_id, action, actor, occurred_at,
--   field_changes, justification, metadata, created_at
-- (NÃO possui event_type ou payload).
--
-- Tabela budget_review_rows colunas reais de reconciliação:
--   reconciliation_decision_status, reconciliation_decision_actor,
--   reconciliation_decision_justification, reconciliation_decision_at
-- (NÃO possui coluna jsonb reconciliation_decision).

CREATE OR REPLACE FUNCTION bulk_mutate_budget_review_rows(
  p_actor_id UUID,
  p_company_id UUID,
  p_session_id UUID,
  p_mutations JSONB
) RETURNS INTEGER
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_mutation JSONB;
  v_row_id UUID;
  v_new_state TEXT;
  v_revised JSONB;
  v_justification TEXT;
  v_evidence_text TEXT;
  v_audit_id TEXT;
  v_audit_action TEXT;
  v_audit_actor TEXT;
  v_audit_occurred_at TIMESTAMPTZ;
  v_audit_field_changes JSONB;
  v_audit_justification TEXT;
  v_audit_metadata JSONB;
  v_affected_count INTEGER;
  v_mutated_count INTEGER := 0;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Actor is required.' USING ERRCODE = '28000';
  END IF;

  IF NOT is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not authorized to execute bulk row mutations (Admin BBA only).', p_actor_id USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM budget_review_sessions
    WHERE id = p_session_id AND company_id = p_company_id AND status = 'InProgress'
  ) THEN
    RAISE EXCEPTION 'budget_review_sessions % not found, not in this company, or not InProgress.', p_session_id USING ERRCODE = 'P0002';
  END IF;

  FOR v_mutation IN SELECT * FROM jsonb_array_elements(p_mutations)
  LOOP
    v_row_id := (v_mutation->>'row_id')::UUID;
    v_new_state := v_mutation->>'new_state';
    v_revised := v_mutation->'revised';
    v_justification := v_mutation->>'justification';
    v_evidence_text := v_mutation->>'evidence_text';

    v_audit_id := v_mutation->>'audit_event_id';
    v_audit_action := v_mutation->>'audit_action';
    v_audit_actor := v_mutation->>'audit_actor';
    v_audit_occurred_at := (v_mutation->>'audit_occurred_at')::TIMESTAMPTZ;
    v_audit_field_changes := COALESCE(v_mutation->'audit_field_changes', '[]'::jsonb);
    v_audit_justification := v_mutation->>'audit_justification';
    v_audit_metadata := COALESCE(v_mutation->'audit_metadata', '{}'::jsonb);

    UPDATE budget_review_rows
    SET state = v_new_state,
        revised = v_revised,
        justification = v_justification,
        evidence_text = COALESCE(v_evidence_text, evidence_text),
        updated_at = NOW()
    WHERE id = v_row_id AND session_id = p_session_id AND company_id = p_company_id;

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    IF v_affected_count = 0 THEN
      RAISE EXCEPTION 'budget_review_row % not found in session % for company %.', v_row_id, p_session_id, p_company_id USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO budget_review_audit_events (
      id, company_id, session_id, row_id, action, actor, occurred_at, field_changes, justification, metadata
    ) VALUES (
      v_audit_id, p_company_id, p_session_id, v_row_id, v_audit_action, v_audit_actor, v_audit_occurred_at,
      v_audit_field_changes, v_audit_justification, v_audit_metadata
    );

    v_mutated_count := v_mutated_count + 1;
  END LOOP;

  RETURN v_mutated_count;
END;
$$;

REVOKE ALL ON FUNCTION bulk_mutate_budget_review_rows(UUID, UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bulk_mutate_budget_review_rows(UUID, UUID, UUID, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION bulk_record_budget_review_reconciliation_decisions(
  p_actor_id UUID,
  p_company_id UUID,
  p_session_id UUID,
  p_decisions JSONB
) RETURNS INTEGER
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_decision JSONB;
  v_row_id UUID;
  v_status TEXT;
  v_justification TEXT;
  v_decided_at TIMESTAMPTZ;
  v_audit_id TEXT;
  v_audit_action TEXT;
  v_audit_actor TEXT;
  v_audit_occurred_at TIMESTAMPTZ;
  v_audit_justification TEXT;
  v_audit_metadata JSONB;
  v_affected_count INTEGER;
  v_recorded_count INTEGER := 0;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Actor is required.' USING ERRCODE = '28000';
  END IF;

  IF NOT is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not authorized to execute bulk reconciliation decisions (Admin BBA only).', p_actor_id USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM budget_review_sessions
    WHERE id = p_session_id AND company_id = p_company_id AND status = 'InProgress'
  ) THEN
    RAISE EXCEPTION 'budget_review_sessions % not found, not in this company, or not InProgress.', p_session_id USING ERRCODE = 'P0002';
  END IF;

  FOR v_decision IN SELECT * FROM jsonb_array_elements(p_decisions)
  LOOP
    v_row_id := (v_decision->>'row_id')::UUID;
    v_status := v_decision->>'status';
    v_justification := v_decision->>'justification';
    v_decided_at := (v_decision->>'decided_at')::TIMESTAMPTZ;

    v_audit_id := v_decision->>'audit_event_id';
    v_audit_action := v_decision->>'audit_action';
    v_audit_actor := v_decision->>'audit_actor';
    v_audit_occurred_at := (v_decision->>'audit_occurred_at')::TIMESTAMPTZ;
    v_audit_justification := v_decision->>'audit_justification';
    v_audit_metadata := COALESCE(v_decision->'audit_metadata', '{}'::jsonb);

    UPDATE budget_review_rows
    SET reconciliation_decision_status = v_status,
        reconciliation_decision_actor = p_actor_id,
        reconciliation_decision_justification = v_justification,
        reconciliation_decision_at = v_decided_at
    WHERE id = v_row_id AND session_id = p_session_id AND company_id = p_company_id;

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    IF v_affected_count = 0 THEN
      RAISE EXCEPTION 'budget_review_row % not found in session % for company %.', v_row_id, p_session_id, p_company_id USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO budget_review_audit_events (
      id, company_id, session_id, row_id, action, actor, occurred_at, field_changes, justification, metadata
    ) VALUES (
      v_audit_id, p_company_id, p_session_id, v_row_id, v_audit_action, v_audit_actor, v_audit_occurred_at,
      '[]'::jsonb, v_audit_justification, v_audit_metadata
    );

    v_recorded_count := v_recorded_count + 1;
  END LOOP;

  RETURN v_recorded_count;
END;
$$;

REVOKE ALL ON FUNCTION bulk_record_budget_review_reconciliation_decisions(UUID, UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bulk_record_budget_review_reconciliation_decisions(UUID, UUID, UUID, JSONB) TO service_role;
