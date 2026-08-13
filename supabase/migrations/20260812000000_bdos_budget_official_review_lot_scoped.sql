-- ============================================================================
-- SPRINT 21.5C.1A — MIGRATION ADITIVA: ESCOPO DE LOTE EM BUDGET_REVIEW_SESSIONS
-- ============================================================================
-- Adiciona suporte a `procurement_lot_id` opcional/nulo em `budget_review_sessions`.
-- Preserva 100% a compatibilidade com sessões históricas WholeCase/Visão
-- (onde procurement_lot_id permanece NULL).
-- ============================================================================

-- 1. Coluna aditiva procurement_lot_id
ALTER TABLE budget_review_sessions
ADD COLUMN IF NOT EXISTS procurement_lot_id UUID REFERENCES procurement_lots(id) ON DELETE CASCADE;

-- 2. Remover a antiga constraint de unicidade ampla se existir
ALTER TABLE budget_review_sessions
DROP CONSTRAINT IF EXISTS budget_review_sessions_company_id_procurement_case_id_s_key;

-- 3. Unicidade Parcial: WholeCase (procurement_lot_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS budget_review_sessions_unique_whole_case
ON budget_review_sessions (company_id, procurement_case_id, source_sha256, acquisition_mechanism)
WHERE procurement_lot_id IS NULL;

-- 4. Unicidade Parcial: Lot (procurement_lot_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS budget_review_sessions_unique_lot
ON budget_review_sessions (company_id, procurement_case_id, procurement_lot_id, source_sha256, acquisition_mechanism)
WHERE procurement_lot_id IS NOT NULL;

-- 5. Atualização da RPC create_budget_review_session
CREATE OR REPLACE FUNCTION create_budget_review_session(
  p_actor_id UUID,
  p_company_id UUID,
  p_id UUID,
  p_procurement_case_id UUID,
  p_budget_version_id UUID,
  p_document_version_id UUID,
  p_source_sha256 TEXT,
  p_acquisition_mechanism TEXT,
  p_acquisition_mechanism_version TEXT,
  p_metadata JSONB,
  p_procurement_lot_id UUID DEFAULT NULL
) RETURNS JSONB
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Actor is required.' USING ERRCODE = '28000';
  END IF;

  IF NOT is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not authorized to create a Sessão de Revisão do Orçamento Oficial (Admin BBA only).', p_actor_id USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_existing_id
  FROM budget_review_sessions
  WHERE company_id = p_company_id
    AND procurement_case_id = p_procurement_case_id
    AND ((p_procurement_lot_id IS NULL AND procurement_lot_id IS NULL) OR (p_procurement_lot_id IS NOT NULL AND procurement_lot_id = p_procurement_lot_id))
    AND source_sha256 = p_source_sha256
    AND acquisition_mechanism = p_acquisition_mechanism;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'reused', 'sessionId', v_existing_id);
  END IF;

  INSERT INTO budget_review_sessions (
    id, company_id, procurement_case_id, procurement_lot_id, budget_version_id, document_version_id,
    source_sha256, acquisition_mechanism, acquisition_mechanism_version, status, metadata, created_by
  ) VALUES (
    p_id, p_company_id, p_procurement_case_id, p_procurement_lot_id, p_budget_version_id, p_document_version_id,
    p_source_sha256, p_acquisition_mechanism, p_acquisition_mechanism_version, 'InProgress', COALESCE(p_metadata, '{}'::JSONB), p_actor_id
  );

  RETURN jsonb_build_object('outcome', 'created', 'sessionId', p_id);
END;
$$;

REVOKE ALL ON FUNCTION create_budget_review_session(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_budget_review_session(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB, UUID) FROM anon;
REVOKE ALL ON FUNCTION create_budget_review_session(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_budget_review_session(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;

COMMENT ON FUNCTION create_budget_review_session IS
  'Sprint 21.5C.1A — Operação de servidor para criação idempotente de Sessão de Revisão com suporte a escopo WholeCase ou Lot-scoped.';
