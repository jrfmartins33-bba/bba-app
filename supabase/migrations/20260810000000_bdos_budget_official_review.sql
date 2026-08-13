-- Epic 21, Sprint 21.5A — Piloto Comercial Alagoas: Revisão do Orçamento
-- Oficial.
--
-- Persiste o domínio puro validado em
-- packages/bdos-core/src/domain/budget-official-review: Sessão de Revisão
-- do Orçamento Oficial, Linha de Revisão (Grupo/Subgrupo/Item de Serviço,
-- extraído vs. revisado, nunca sobrescrito) e evento de auditoria.
--
-- Reaproveita, nunca duplica:
--   - procurement_cases / procurement_lots (20260714000000)
--   - budget_versions / budget_lines (20260714000000) — a Sessão de
--     Revisão projeta para uma budget_versions já existente em Draft; a
--     consolidação da revisão não substitui persist_budget_version_snapshot,
--     é uma etapa anterior a ela.
--   - document_versions (20260715000000) — a Sessão referencia a
--     DocumentVersion do PDF fonte; nenhum novo mecanismo de storage.
--   - get_my_company_id() / is_bba_admin() / set_updated_at()
--     (202506280001_bba_app_core_schema.sql).
--
-- Aditiva; nenhuma tabela existente é alterada. Nenhum dado real de
-- Alagoas inserido por esta migration.

-- BLOCO 1: TABELA budget_review_sessions. UNIQUE
-- (company_id, procurement_case_id, source_sha256, acquisition_mechanism)
-- impõe, no banco, o invariante de importação idempotente (enunciado §25):
-- a mesma combinação nunca cria uma segunda sessão silenciosamente.
CREATE TABLE IF NOT EXISTS budget_review_sessions (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  procurement_case_id UUID NOT NULL REFERENCES procurement_cases(id),
  budget_version_id UUID NOT NULL REFERENCES budget_versions(id),
  document_version_id UUID NOT NULL REFERENCES document_versions(id),
  source_sha256 TEXT NOT NULL,
  acquisition_mechanism TEXT NOT NULL,
  acquisition_mechanism_version TEXT,
  status TEXT NOT NULL DEFAULT 'InProgress' CHECK (status IN ('InProgress', 'Consolidated')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, procurement_case_id, source_sha256, acquisition_mechanism)
);

CREATE INDEX IF NOT EXISTS budget_review_sessions_company_id_idx ON budget_review_sessions (company_id);
CREATE INDEX IF NOT EXISTS budget_review_sessions_budget_version_id_idx ON budget_review_sessions (budget_version_id);

-- BLOCO 2: gatilho de consistência — company_id da Sessão precisa ser
-- exatamente o company_id do Processo, da Versão do Orçamento (que
-- também precisa estar em Draft) e da DocumentVersion.
CREATE OR REPLACE FUNCTION enforce_budget_review_session_consistency() RETURNS TRIGGER AS $$
DECLARE
  v_version_company_id UUID;
  v_version_case_id UUID;
  v_version_status TEXT;
  v_document_company_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procurement_cases WHERE id = NEW.procurement_case_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'budget_review_sessions.company_id must match the company_id of its procurement_case_id';
  END IF;

  SELECT company_id, procurement_case_id, status INTO v_version_company_id, v_version_case_id, v_version_status
  FROM budget_versions WHERE id = NEW.budget_version_id;

  IF v_version_company_id IS NULL THEN
    RAISE EXCEPTION 'budget_review_sessions.budget_version_id does not reference an existing budget_versions row';
  END IF;

  IF v_version_company_id <> NEW.company_id OR v_version_case_id <> NEW.procurement_case_id THEN
    RAISE EXCEPTION 'budget_review_sessions.budget_version_id must belong to the same company_id and procurement_case_id';
  END IF;

  IF v_version_status <> 'Draft' THEN
    RAISE EXCEPTION 'budget_review_sessions.budget_version_id must reference a Draft budget_versions row';
  END IF;

  SELECT company_id INTO v_document_company_id FROM document_versions WHERE id = NEW.document_version_id;

  IF v_document_company_id IS NULL THEN
    RAISE EXCEPTION 'budget_review_sessions.document_version_id does not reference an existing document_versions row';
  END IF;

  IF v_document_company_id <> NEW.company_id THEN
    RAISE EXCEPTION 'budget_review_sessions.document_version_id must belong to the same company_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_budget_review_sessions_consistency ON budget_review_sessions;
CREATE TRIGGER enforce_budget_review_sessions_consistency
BEFORE INSERT ON budget_review_sessions
FOR EACH ROW
EXECUTE FUNCTION enforce_budget_review_session_consistency();

-- BLOCO 3: TABELA budget_review_rows. `extracted` é sempre imutável desde a
-- importação (enunciado §18) — nenhuma política de UPDATE desta migration
-- permite alterá-lo; apenas `revised`, `state` e `justification` mudam,
-- sempre através de record_budget_review_row_mutation (Bloco 6), que
-- também grava o evento de auditoria correspondente na mesma transação.
-- `id` nunca recebe DEFAULT — é sempre a identidade já atribuída pelo
-- domínio, preservada exatamente pelo mapeador.
CREATE TABLE IF NOT EXISTS budget_review_rows (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES budget_review_sessions(id),
  kind TEXT NOT NULL CHECK (kind IN ('Group', 'Subgroup', 'ServiceItem')),
  lot_reference TEXT NOT NULL,
  parent_row_id UUID REFERENCES budget_review_rows(id),
  position INTEGER NOT NULL CHECK (position >= 0),
  state TEXT NOT NULL CHECK (state IN ('Pendente', 'Confirmado', 'Corrigido', 'NaoPertenceAoOrcamento', 'InseridoManualmente')),
  extracted JSONB,
  revised JSONB NOT NULL,
  page INTEGER CHECK (page IS NULL OR page > 0),
  evidence_text TEXT,
  justification TEXT,
  inserted_manually BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (inserted_manually = TRUE AND extracted IS NULL)
    OR (inserted_manually = FALSE)
  )
);

CREATE INDEX IF NOT EXISTS budget_review_rows_company_id_idx ON budget_review_rows (company_id);
CREATE INDEX IF NOT EXISTS budget_review_rows_session_id_idx ON budget_review_rows (session_id);
CREATE INDEX IF NOT EXISTS budget_review_rows_parent_row_id_idx ON budget_review_rows (parent_row_id) WHERE parent_row_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS budget_review_rows_state_idx ON budget_review_rows (session_id, state);

DROP TRIGGER IF EXISTS set_budget_review_rows_updated_at ON budget_review_rows;
CREATE TRIGGER set_budget_review_rows_updated_at
BEFORE UPDATE ON budget_review_rows
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 4: gatilho de consistência — company_id da Linha precisa ser
-- exatamente o company_id da sua Sessão; o pai (quando informado) precisa
-- pertencer à mesma Sessão.
CREATE OR REPLACE FUNCTION enforce_budget_review_row_session_consistency() RETURNS TRIGGER AS $$
DECLARE
  v_session_company_id UUID;
  v_parent_session_id UUID;
BEGIN
  SELECT company_id INTO v_session_company_id FROM budget_review_sessions WHERE id = NEW.session_id;

  IF v_session_company_id IS NULL THEN
    RAISE EXCEPTION 'budget_review_rows.session_id does not reference an existing budget_review_sessions row';
  END IF;

  IF v_session_company_id <> NEW.company_id THEN
    RAISE EXCEPTION 'budget_review_rows.company_id must match the company_id of its session_id';
  END IF;

  IF NEW.parent_row_id IS NOT NULL THEN
    SELECT session_id INTO v_parent_session_id FROM budget_review_rows WHERE id = NEW.parent_row_id;

    IF v_parent_session_id IS NULL OR v_parent_session_id <> NEW.session_id THEN
      RAISE EXCEPTION 'budget_review_rows.parent_row_id must belong to the same session_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_budget_review_rows_session_consistency ON budget_review_rows;
CREATE TRIGGER enforce_budget_review_rows_session_consistency
BEFORE INSERT OR UPDATE ON budget_review_rows
FOR EACH ROW
EXECUTE FUNCTION enforce_budget_review_row_session_consistency();

-- BLOCO 5: TABELA budget_review_audit_events (enunciado §19 — toda
-- alteração manual gera um evento; nunca "último valor editado" sem
-- histórico). Somente INSERT depois de criada — nunca UPDATE/DELETE.
CREATE TABLE IF NOT EXISTS budget_review_audit_events (
  id TEXT PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES budget_review_sessions(id),
  row_id UUID REFERENCES budget_review_rows(id),
  action TEXT NOT NULL CHECK (action IN (
    'RowImported', 'RowConfirmed', 'RowCorrected', 'RowExcluded', 'RowRestored',
    'RowInsertedManually', 'BulkConfirmed', 'SessionConsolidated'
  )),
  actor TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  field_changes JSONB NOT NULL DEFAULT '[]',
  justification TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS budget_review_audit_events_company_id_idx ON budget_review_audit_events (company_id);
CREATE INDEX IF NOT EXISTS budget_review_audit_events_session_id_idx ON budget_review_audit_events (session_id);
CREATE INDEX IF NOT EXISTS budget_review_audit_events_row_id_idx ON budget_review_audit_events (row_id) WHERE row_id IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_budget_review_audit_event_consistency() RETURNS TRIGGER AS $$
DECLARE
  v_session_company_id UUID;
BEGIN
  SELECT company_id INTO v_session_company_id FROM budget_review_sessions WHERE id = NEW.session_id;

  IF v_session_company_id IS NULL OR v_session_company_id <> NEW.company_id THEN
    RAISE EXCEPTION 'budget_review_audit_events.company_id must match the company_id of its session_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_budget_review_audit_events_consistency ON budget_review_audit_events;
CREATE TRIGGER enforce_budget_review_audit_events_consistency
BEFORE INSERT ON budget_review_audit_events
FOR EACH ROW
EXECUTE FUNCTION enforce_budget_review_audit_event_consistency();

-- BLOCO 6: HABILITAR RLS
ALTER TABLE budget_review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_review_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_review_audit_events ENABLE ROW LEVEL SECURITY;

-- budget_review_sessions: SELECT/INSERT/UPDATE (status InProgress ->
-- Consolidated). Nunca DELETE — a sessão, mesmo abandonada, permanece
-- como evidência.
DROP POLICY IF EXISTS budget_review_sessions_select_company_or_admin ON budget_review_sessions;
CREATE POLICY budget_review_sessions_select_company_or_admin
ON budget_review_sessions FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

-- INSERT/UPDATE bloqueados para `authenticated` (mesmo Admin BBA): toda
-- escrita real passa exclusivamente pelas funções de servidor
-- (create_budget_review_session / record_budget_review_row_mutation /
-- consolidate_budget_review_session, Blocos 7-9), que validam o ator
-- explicitamente e rodam apenas com a credencial service_role — a mesma
-- lição de segurança já corrigida em procurement-engineering
-- (20260714000004): não deixar a política de RLS abrir um segundo
-- caminho de escrita direta que contorna o Serviço de Aplicação e o
-- domínio puro.
DROP POLICY IF EXISTS budget_review_sessions_insert_admin_only ON budget_review_sessions;
CREATE POLICY budget_review_sessions_insert_admin_only
ON budget_review_sessions FOR INSERT TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS budget_review_sessions_update_admin_only ON budget_review_sessions;
CREATE POLICY budget_review_sessions_update_admin_only
ON budget_review_sessions FOR UPDATE TO authenticated
USING (false);

DROP POLICY IF EXISTS budget_review_sessions_delete_blocked ON budget_review_sessions;
CREATE POLICY budget_review_sessions_delete_blocked
ON budget_review_sessions FOR DELETE TO authenticated
USING (false);

-- budget_review_rows: revisão é trabalho Admin BBA exclusivo (enunciado
-- §47) — Cliente nunca acessa a extração bruta, a edição ou os
-- diagnósticos. SELECT também restrito a admin (não apenas à organização)
-- porque estas linhas contêm o rascunho de revisão, nunca exposto ao
-- Cliente, mesmo que da própria organização dele.
DROP POLICY IF EXISTS budget_review_rows_select_admin_only ON budget_review_rows;
CREATE POLICY budget_review_rows_select_admin_only
ON budget_review_rows FOR SELECT TO authenticated
USING (is_bba_admin());

-- INSERT/UPDATE bloqueados para `authenticated` — mesma razão do Bloco 6
-- acima; toda escrita real passa por record_budget_review_row_mutation.
DROP POLICY IF EXISTS budget_review_rows_insert_admin_only ON budget_review_rows;
CREATE POLICY budget_review_rows_insert_admin_only
ON budget_review_rows FOR INSERT TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS budget_review_rows_update_admin_only ON budget_review_rows;
CREATE POLICY budget_review_rows_update_admin_only
ON budget_review_rows FOR UPDATE TO authenticated
USING (false);

DROP POLICY IF EXISTS budget_review_rows_delete_blocked ON budget_review_rows;
CREATE POLICY budget_review_rows_delete_blocked
ON budget_review_rows FOR DELETE TO authenticated
USING (false);

-- budget_review_audit_events: SELECT/INSERT admin-only, nunca UPDATE/DELETE.
DROP POLICY IF EXISTS budget_review_audit_events_select_admin_only ON budget_review_audit_events;
CREATE POLICY budget_review_audit_events_select_admin_only
ON budget_review_audit_events FOR SELECT TO authenticated
USING (is_bba_admin());

-- INSERT bloqueado para `authenticated` — sempre gravado dentro da mesma
-- transação de record_budget_review_row_mutation/consolidate_budget_review_session.
DROP POLICY IF EXISTS budget_review_audit_events_insert_admin_only ON budget_review_audit_events;
CREATE POLICY budget_review_audit_events_insert_admin_only
ON budget_review_audit_events FOR INSERT TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS budget_review_audit_events_update_blocked ON budget_review_audit_events;
CREATE POLICY budget_review_audit_events_update_blocked
ON budget_review_audit_events FOR UPDATE TO authenticated
USING (false);

DROP POLICY IF EXISTS budget_review_audit_events_delete_blocked ON budget_review_audit_events;
CREATE POLICY budget_review_audit_events_delete_blocked
ON budget_review_audit_events FOR DELETE TO authenticated
USING (false);

-- BLOCO 7: create_budget_review_session — operação exclusiva de servidor
-- (mesma disciplina de segurança de procurement-engineering
-- 20260714000004): EXECUTE só para service_role, SECURITY INVOKER,
-- p_actor_id validado explicitamente (Admin BBA exclusivo — enunciado
-- §47, mais restrito que "mesma organização") antes de qualquer escrita.
-- Persiste o registro principal da Sessão, sempre InProgress, sem linhas.
-- Nenhuma regra de negócio aqui — o retrato já foi validado por
-- createBudgetReviewSession (domínio puro). Idempotência física: se a
-- combinação (company_id, procurement_case_id, source_sha256,
-- acquisition_mechanism) já existir, retorna a sessão existente em vez de
-- violar a UNIQUE constraint silenciosamente (enunciado §25).
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
  p_metadata JSONB
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
    AND source_sha256 = p_source_sha256
    AND acquisition_mechanism = p_acquisition_mechanism;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'reused', 'sessionId', v_existing_id);
  END IF;

  INSERT INTO budget_review_sessions (
    id, company_id, procurement_case_id, budget_version_id, document_version_id,
    source_sha256, acquisition_mechanism, acquisition_mechanism_version, status, metadata, created_by
  ) VALUES (
    p_id, p_company_id, p_procurement_case_id, p_budget_version_id, p_document_version_id,
    p_source_sha256, p_acquisition_mechanism, p_acquisition_mechanism_version, 'InProgress', COALESCE(p_metadata, '{}'::JSONB), p_actor_id
  );

  RETURN jsonb_build_object('outcome', 'created', 'sessionId', p_id);
END;
$$;

REVOKE ALL ON FUNCTION create_budget_review_session(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_budget_review_session(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION create_budget_review_session(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_budget_review_session(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION create_budget_review_session IS
  'Epic 21.5A — operação exclusiva de servidor (EXECUTE só para service_role). p_actor_id validado como Admin BBA antes de qualquer escrita; created_by é sempre p_actor_id. Idempotente por (company_id, procurement_case_id, source_sha256, acquisition_mechanism): reenvio retorna {outcome: "reused"} em vez de criar uma segunda sessão.';

-- BLOCO 8: record_budget_review_row_mutation — operação exclusiva de
-- servidor, mesma disciplina do Bloco 7. Única forma de alterar uma Linha
-- de Revisão já existente (confirmar/corrigir/excluir/restaurar) OU
-- inserir uma nova (manual). Recebe o próximo estado da linha já validado
-- pelo domínio puro (correctBudgetReviewRow etc.) e o evento de auditoria
-- correspondente, gravando ambos na mesma transação implícita da função —
-- nunca uma UPDATE de linha sem o evento de auditoria correspondente
-- (enunciado §19). `p_is_new_row` distingue INSERT (linha manual) de
-- UPDATE (toda outra transição).
CREATE OR REPLACE FUNCTION record_budget_review_row_mutation(
  p_actor_id UUID,
  p_company_id UUID,
  p_row_id UUID,
  p_is_new_row BOOLEAN,
  p_session_id UUID,
  p_kind TEXT,
  p_lot_reference TEXT,
  p_parent_row_id UUID,
  p_position INTEGER,
  p_state TEXT,
  p_extracted JSONB,
  p_revised JSONB,
  p_page INTEGER,
  p_evidence_text TEXT,
  p_justification TEXT,
  p_inserted_manually BOOLEAN,
  p_row_metadata JSONB,
  p_audit_event_id TEXT,
  p_audit_action TEXT,
  p_audit_actor TEXT,
  p_audit_occurred_at TIMESTAMPTZ,
  p_audit_field_changes JSONB,
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
    RAISE EXCEPTION 'Actor % is not authorized to alter a Linha de Revisão (Admin BBA only).', p_actor_id USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM budget_review_sessions WHERE id = p_session_id AND company_id = p_company_id AND status = 'InProgress') THEN
    RAISE EXCEPTION 'budget_review_sessions % not found, not in this company, or not InProgress.', p_session_id USING ERRCODE = 'P0002';
  END IF;

  IF p_is_new_row THEN
    INSERT INTO budget_review_rows (
      id, company_id, session_id, kind, lot_reference, parent_row_id, position,
      state, extracted, revised, page, evidence_text, justification, inserted_manually, metadata, created_by
    ) VALUES (
      p_row_id, p_company_id, p_session_id, p_kind, p_lot_reference, p_parent_row_id, p_position,
      p_state, p_extracted, p_revised, p_page, p_evidence_text, p_justification, p_inserted_manually, COALESCE(p_row_metadata, '{}'::JSONB), p_actor_id
    );
  ELSE
    UPDATE budget_review_rows
    SET state = p_state, revised = p_revised, justification = p_justification
    WHERE id = p_row_id AND company_id = p_company_id AND session_id = p_session_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'record_budget_review_row_mutation: row % not found for company_id %', p_row_id, p_company_id;
    END IF;
  END IF;

  IF p_audit_event_id IS NOT NULL THEN
    INSERT INTO budget_review_audit_events (
      id, company_id, session_id, row_id, action, actor, occurred_at, field_changes, justification, metadata
    ) VALUES (
      p_audit_event_id, p_company_id, p_session_id, p_row_id, p_audit_action, p_audit_actor, p_audit_occurred_at,
      COALESCE(p_audit_field_changes, '[]'::JSONB), p_audit_justification, COALESCE(p_audit_metadata, '{}'::JSONB)
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION record_budget_review_row_mutation(
  UUID, UUID, UUID, BOOLEAN, UUID, TEXT, TEXT, UUID, INTEGER, TEXT, JSONB, JSONB, INTEGER, TEXT, TEXT, BOOLEAN, JSONB,
  TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, TEXT, JSONB
) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_budget_review_row_mutation(
  UUID, UUID, UUID, BOOLEAN, UUID, TEXT, TEXT, UUID, INTEGER, TEXT, JSONB, JSONB, INTEGER, TEXT, TEXT, BOOLEAN, JSONB,
  TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, TEXT, JSONB
) FROM anon;
REVOKE ALL ON FUNCTION record_budget_review_row_mutation(
  UUID, UUID, UUID, BOOLEAN, UUID, TEXT, TEXT, UUID, INTEGER, TEXT, JSONB, JSONB, INTEGER, TEXT, TEXT, BOOLEAN, JSONB,
  TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, TEXT, JSONB
) FROM authenticated;
GRANT EXECUTE ON FUNCTION record_budget_review_row_mutation(
  UUID, UUID, UUID, BOOLEAN, UUID, TEXT, TEXT, UUID, INTEGER, TEXT, JSONB, JSONB, INTEGER, TEXT, TEXT, BOOLEAN, JSONB,
  TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, TEXT, JSONB
) TO service_role;

COMMENT ON FUNCTION record_budget_review_row_mutation IS
  'Epic 21.5A — operação exclusiva de servidor (EXECUTE só para service_role). p_actor_id validado como Admin BBA antes de qualquer escrita. Única forma de alterar (ou inserir manualmente) uma Linha de Revisão, sempre gravando o evento de auditoria correspondente na mesma transação. Nenhuma regra de negócio aqui — o novo estado já foi validado pelo domínio puro (packages/bdos-core/src/domain/budget-official-review) antes desta chamada.';

-- BLOCO 9: consolidate_budget_review_session — operação exclusiva de
-- servidor, mesma disciplina dos Blocos 7-8. Flip de status InProgress ->
-- Consolidated, sempre acompanhado do evento de auditoria
-- SessionConsolidated. Nenhum gate de negócio aqui — a prontidão já foi
-- calculada por budgetReviewConsolidationReadiness (domínio puro) antes
-- desta chamada; esta função apenas persiste a decisão humana já tomada.
CREATE OR REPLACE FUNCTION consolidate_budget_review_session(
  p_actor_id UUID,
  p_company_id UUID,
  p_session_id UUID,
  p_audit_event_id TEXT,
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
    RAISE EXCEPTION 'Actor % is not authorized to consolidate a Sessão de Revisão (Admin BBA only).', p_actor_id USING ERRCODE = '42501';
  END IF;

  UPDATE budget_review_sessions
  SET status = 'Consolidated'
  WHERE id = p_session_id AND company_id = p_company_id AND status = 'InProgress';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  INSERT INTO budget_review_audit_events (
    id, company_id, session_id, row_id, action, actor, occurred_at, field_changes, justification, metadata
  ) VALUES (
    p_audit_event_id, p_company_id, p_session_id, NULL, 'SessionConsolidated', p_actor_id::TEXT, NOW(),
    '[]'::JSONB, NULL, COALESCE(p_audit_metadata, '{}'::JSONB)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION consolidate_budget_review_session(UUID, UUID, UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION consolidate_budget_review_session(UUID, UUID, UUID, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION consolidate_budget_review_session(UUID, UUID, UUID, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION consolidate_budget_review_session(UUID, UUID, UUID, TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION consolidate_budget_review_session IS
  'Epic 21.5A — operação exclusiva de servidor (EXECUTE só para service_role). p_actor_id validado como Admin BBA. Persiste a consolidação (InProgress -> Consolidated) de uma Sessão de Revisão já pronta, com o evento de auditoria correspondente. A prontidão (ausência de pendências/divergências) já foi calculada pelo domínio puro antes desta chamada — esta função não reimplementa nenhum gate.';

-- BLOCO 9B: bulk_import_budget_review_rows — operação exclusiva de
-- servidor, mesma disciplina dos Blocos 7-9. Importação inicial de um
-- lote de Linhas de Revisão (centenas de linhas de uma vez — enunciado
-- §8/§56), sempre em estado Pendente, cada uma com seu próprio evento
-- RowImported, tudo em uma única transação implícita. Nunca usada para
-- mutação de linha já existente (essa é sempre record_budget_review_row_mutation,
-- uma de cada vez, cada uma com sua própria decisão humana e auditoria).
CREATE OR REPLACE FUNCTION bulk_import_budget_review_rows(
  p_actor_id UUID,
  p_company_id UUID,
  p_session_id UUID,
  p_rows JSONB,
  p_audit_occurred_at TIMESTAMPTZ
) RETURNS JSONB
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Actor is required.' USING ERRCODE = '28000';
  END IF;

  IF NOT is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not authorized to import Linhas de Revisão (Admin BBA only).', p_actor_id USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM budget_review_sessions WHERE id = p_session_id AND company_id = p_company_id AND status = 'InProgress') THEN
    RAISE EXCEPTION 'budget_review_sessions % not found, not in this company, or not InProgress.', p_session_id USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO budget_review_rows (
    id, company_id, session_id, kind, lot_reference, parent_row_id, position,
    state, extracted, revised, page, evidence_text, justification, inserted_manually, metadata, created_by
  )
  SELECT
    (row->>'id')::UUID,
    p_company_id,
    p_session_id,
    row->>'kind',
    row->>'lotReference',
    NULLIF(row->>'parentRowId', '')::UUID,
    (row->>'position')::INTEGER,
    'Pendente',
    row->'fields',
    row->'fields',
    NULLIF(row->>'page', '')::INTEGER,
    NULLIF(row->>'evidenceText', ''),
    NULL,
    FALSE,
    '{}'::JSONB,
    p_actor_id
  FROM jsonb_array_elements(p_rows) AS row;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO budget_review_audit_events (id, company_id, session_id, row_id, action, actor, occurred_at, field_changes, justification, metadata)
  SELECT
    (row->>'id') || ':RowImported:' || p_audit_occurred_at::TEXT,
    p_company_id,
    p_session_id,
    (row->>'id')::UUID,
    'RowImported',
    p_actor_id::TEXT,
    p_audit_occurred_at,
    '[]'::JSONB,
    NULL,
    '{}'::JSONB
  FROM jsonb_array_elements(p_rows) AS row;

  RETURN jsonb_build_object('imported', v_count);
END;
$$;

REVOKE ALL ON FUNCTION bulk_import_budget_review_rows(UUID, UUID, UUID, JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION bulk_import_budget_review_rows(UUID, UUID, UUID, JSONB, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION bulk_import_budget_review_rows(UUID, UUID, UUID, JSONB, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION bulk_import_budget_review_rows(UUID, UUID, UUID, JSONB, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION bulk_import_budget_review_rows IS
  'Epic 21.5A — operação exclusiva de servidor (EXECUTE só para service_role). p_actor_id validado como Admin BBA. Importação inicial em lote de Linhas de Revisão, todas Pendente, cada uma com seu evento RowImported, em uma única transação. Nunca usada para alterar uma linha já existente.';

-- BLOCO 10: COMENTARIOS
COMMENT ON TABLE budget_review_sessions IS
  'Sessão de Revisão do Orçamento Oficial (Epic 21.5A) — processo que transforma uma extração bruta (r11 ou leitura assistida por visão) em linhas aprovadas, projetáveis para uma budget_versions (Draft) já existente. UNIQUE (company_id, procurement_case_id, source_sha256, acquisition_mechanism) garante reimportação idempotente.';
COMMENT ON TABLE budget_review_rows IS
  'Linha de Revisão — estágio de extração bruta/linhas candidatas, nunca o orçamento canônico. extracted é imutável desde a importação; revised muda via record_budget_review_row_mutation. Acesso Admin BBA exclusivo (enunciado §47).';
COMMENT ON TABLE budget_review_audit_events IS
  'Evento de auditoria de uma Sessão de Revisão — toda alteração de linha ou da sessão gera um evento; nunca "último valor editado" sem histórico.';
