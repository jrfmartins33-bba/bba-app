-- Migration: 20260814000000_bdos_budget_review_batch_mutations.sql
-- Adiciona suporte a operações em lote (bulk_mutate_budget_review_rows e
-- bulk_record_budget_review_reconciliation_decisions) para a revisão do
-- orçamento oficial. Executa a persistência de N linhas em uma única chamada
-- RPC / transação de banco.

CREATE OR REPLACE FUNCTION bulk_mutate_budget_review_rows(
  p_session_id UUID,
  p_company_id UUID,
  p_mutations JSONB,
  p_actor TEXT,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  mutated_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mutation JSONB;
  v_row_id UUID;
  v_state TEXT;
  v_revised JSONB;
  v_justification TEXT;
  v_evidence_text TEXT;
  v_count INT := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM budget_review_sessions
    WHERE id = p_session_id AND company_id = p_company_id AND status = 'InProgress'
  ) THEN
    RAISE EXCEPTION 'Sessão de revisão % inválida, consolidada ou não pertence à empresa %.', p_session_id, p_company_id
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_mutation IN SELECT * FROM jsonb_array_elements(p_mutations)
  LOOP
    v_row_id := (v_mutation->>'id')::UUID;
    v_state := v_mutation->>'state';
    v_revised := v_mutation->'revised';
    v_justification := v_mutation->>'justification';
    v_evidence_text := v_mutation->>'evidenceText';

    UPDATE budget_review_rows
    SET
      state = v_state,
      revised = v_revised,
      justification = v_justification,
      evidence_text = v_evidence_text,
      updated_at = NOW()
    WHERE id = v_row_id AND session_id = p_session_id AND company_id = p_company_id;

    INSERT INTO budget_review_audit_events (
      session_id,
      company_id,
      row_id,
      event_type,
      actor,
      payload,
      occurred_at
    ) VALUES (
      p_session_id,
      p_company_id,
      v_row_id,
      'RowMutated',
      p_actor,
      jsonb_build_object(
        'newState', v_state,
        'revised', v_revised,
        'justification', v_justification
      ),
      p_occurred_at
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$$;

REVOKE ALL ON FUNCTION bulk_mutate_budget_review_rows(UUID, UUID, JSONB, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION bulk_mutate_budget_review_rows(UUID, UUID, JSONB, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION bulk_mutate_budget_review_rows(UUID, UUID, JSONB, TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION bulk_mutate_budget_review_rows(UUID, UUID, JSONB, TEXT, TIMESTAMPTZ) TO service_role;


CREATE OR REPLACE FUNCTION bulk_record_budget_review_reconciliation_decisions(
  p_session_id UUID,
  p_company_id UUID,
  p_decisions JSONB,
  p_actor TEXT,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  decided_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item JSONB;
  v_row_id UUID;
  v_justification TEXT;
  v_decision JSONB;
  v_count INT := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM budget_review_sessions
    WHERE id = p_session_id AND company_id = p_company_id AND status = 'InProgress'
  ) THEN
    RAISE EXCEPTION 'Sessão de revisão % inválida, consolidada ou não pertence à empresa %.', p_session_id, p_company_id
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_decisions)
  LOOP
    v_row_id := (v_item->>'rowId')::UUID;
    v_justification := v_item->>'justification';

    v_decision := jsonb_build_object(
      'status', 'AcceptedAsDocumented',
      'actor', p_actor,
      'justification', v_justification,
      'decidedAt', to_char(p_occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );

    UPDATE budget_review_rows
    SET
      reconciliation_decision = v_decision,
      updated_at = NOW()
    WHERE id = v_row_id AND session_id = p_session_id AND company_id = p_company_id;

    INSERT INTO budget_review_audit_events (
      session_id,
      company_id,
      row_id,
      event_type,
      actor,
      payload,
      occurred_at
    ) VALUES (
      p_session_id,
      p_company_id,
      v_row_id,
      'ReconciliationDecisionRecorded',
      p_actor,
      v_decision,
      p_occurred_at
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$$;

REVOKE ALL ON FUNCTION bulk_record_budget_review_reconciliation_decisions(UUID, UUID, JSONB, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION bulk_record_budget_review_reconciliation_decisions(UUID, UUID, JSONB, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION bulk_record_budget_review_reconciliation_decisions(UUID, UUID, JSONB, TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION bulk_record_budget_review_reconciliation_decisions(UUID, UUID, JSONB, TEXT, TIMESTAMPTZ) TO service_role;
