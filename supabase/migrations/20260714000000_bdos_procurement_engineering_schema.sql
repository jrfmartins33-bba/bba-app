-- Epic 21, Sprint 21.3C — Engenharia de Custos e Licitações: Serviços de
-- Aplicação, persistência e isolamento por organização usuária.
--
-- Persiste a primeira fatia de domínio puro validada na Sprint 21.3B
-- (packages/bdos-core/src/domain/procurement-case,
-- packages/bdos-core/src/domain/budget-version): Processo de Licitação e
-- Contratação, Lote da Licitação, Versão do Orçamento (rascunho ->
-- consolidada), Linha do Orçamento (Grupo/Subgrupo/Item de Serviço), e uma
-- única Relação de Rastreabilidade de origem por Versão.
--
-- Aditiva; nenhuma tabela existente é alterada. Nenhum dado real inserido.
-- Nenhuma regra de negócio (validação hierárquica, totalização, decisão de
-- Escopo, cálculo econômico) é reimplementada aqui — apenas integridade
-- estrutural, isolamento por organização usuária, e controle mínimo de
-- concorrência. ADR-001 a ADR-004 e
-- packages/bdos-core/docs/EPIC_21_DOMAIN_IMPLEMENTATION_MAP.md permanecem a
-- fonte de verdade conceitual.
--
-- Mapeamento organizationId (domínio) <-> company_id (banco): explícito,
-- feito pelo adaptador (apps/web/lib/bdos/procurement-engineering-*), nunca
-- pelo domínio nem pelo SQL. RLS reaproveita get_my_company_id()/
-- is_bba_admin() (202506280001_bba_app_core_schema.sql) — o mesmo mecanismo
-- já usado por todo o schema BDOS.

-- BLOCO 1: TABELA procurement_cases (Processo de Licitação e Contratação).
-- Núcleo coordenador enxuto (ADR-002 §D) — não guarda listas de lotes,
-- versões ou decisões. Apenas SELECT/INSERT são expostos nesta fatia (o
-- Serviço de Aplicação só cria e localiza).
CREATE TABLE IF NOT EXISTS procurement_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  external_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  correlation_id TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source_system TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS procurement_cases_company_id_idx ON procurement_cases (company_id);

-- BLOCO 2: TABELA procurement_lots (Lote da Licitação). Sempre opcional —
-- "processo inteiro" nunca recebe um lote artificial (ADR-002 §H); esta
-- tabela só existe para processos que de fato possuem lotes.
CREATE TABLE IF NOT EXISTS procurement_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  procurement_case_id UUID NOT NULL REFERENCES procurement_cases(id),
  title TEXT NOT NULL,
  external_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  correlation_id TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source_system TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS procurement_lots_company_id_idx ON procurement_lots (company_id);
CREATE INDEX IF NOT EXISTS procurement_lots_procurement_case_id_idx ON procurement_lots (procurement_case_id);

-- BLOCO 3: gatilho de consistência — company_id de um Lote precisa ser
-- exatamente o company_id do seu Processo (nunca uma referência cruzando
-- organizações usuárias).
CREATE OR REPLACE FUNCTION enforce_procurement_lot_case_consistency() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procurement_cases
    WHERE id = NEW.procurement_case_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'procurement_lots.company_id must match the company_id of its procurement_case_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_procurement_lots_case_consistency ON procurement_lots;
CREATE TRIGGER enforce_procurement_lots_case_consistency
BEFORE INSERT OR UPDATE ON procurement_lots
FOR EACH ROW
EXECUTE FUNCTION enforce_procurement_lot_case_consistency();

-- BLOCO 4: TABELA budget_versions (Versão do Orçamento). `revision` é
-- controle físico de concorrência otimista — nunca um campo do domínio
-- puro (ver PersistedEntity<T> em
-- packages/bdos-core/src/services/procurement-engineering/budget-version.repository.ts).
-- Inicia em 0 (INITIAL_BUDGET_VERSION_REVISION). `scope_kind`/
-- `procurement_lot_id`/`origin_kind`/`origin_reference` são imutáveis após
-- a criação — só `status` e `revision` mudam, sempre juntos, sempre pela
-- função persist_budget_version_snapshot (Bloco 10).
CREATE TABLE IF NOT EXISTS budget_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  procurement_case_id UUID NOT NULL REFERENCES procurement_cases(id),
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('WholeCase', 'Lot')),
  procurement_lot_id UUID REFERENCES procurement_lots(id),
  origin_kind TEXT NOT NULL CHECK (origin_kind IN ('Native', 'DocumentaryOpaqueReference')),
  origin_reference TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Consolidated')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  metadata JSONB NOT NULL DEFAULT '{}',
  correlation_id TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source_system TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (scope_kind = 'WholeCase' AND procurement_lot_id IS NULL)
    OR (scope_kind = 'Lot' AND procurement_lot_id IS NOT NULL)
  ),
  CHECK (
    (origin_kind = 'Native' AND origin_reference IS NULL)
    OR (origin_kind = 'DocumentaryOpaqueReference' AND origin_reference IS NOT NULL AND length(trim(origin_reference)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS budget_versions_company_id_idx ON budget_versions (company_id);
CREATE INDEX IF NOT EXISTS budget_versions_procurement_case_id_idx ON budget_versions (procurement_case_id);
CREATE INDEX IF NOT EXISTS budget_versions_procurement_lot_id_idx ON budget_versions (procurement_lot_id) WHERE procurement_lot_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_budget_versions_updated_at ON budget_versions;
CREATE TRIGGER set_budget_versions_updated_at
BEFORE UPDATE ON budget_versions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 5: gatilho de consistência — company_id/Processo/Lote da Versão
-- nunca cruzam organização usuária, e um Escopo de lote só é aceito quando
-- o Lote realmente pertence ao mesmo Processo e à mesma organização.
CREATE OR REPLACE FUNCTION enforce_budget_version_case_consistency() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procurement_cases WHERE id = NEW.procurement_case_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'budget_versions.company_id must match the company_id of its procurement_case_id';
  END IF;

  IF NEW.scope_kind = 'Lot' AND NOT EXISTS (
    SELECT 1 FROM procurement_lots
    WHERE id = NEW.procurement_lot_id AND company_id = NEW.company_id AND procurement_case_id = NEW.procurement_case_id
  ) THEN
    RAISE EXCEPTION 'budget_versions.procurement_lot_id must belong to the same company_id and procurement_case_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_budget_versions_case_consistency ON budget_versions;
CREATE TRIGGER enforce_budget_versions_case_consistency
BEFORE INSERT OR UPDATE ON budget_versions
FOR EACH ROW
EXECUTE FUNCTION enforce_budget_version_case_consistency();

-- BLOCO 6: TABELA budget_lines (Linha do Orçamento). `id` nunca recebe
-- DEFAULT — é sempre a identidade já atribuída pelo domínio
-- (crypto.randomUUID() no Serviço de Aplicação), preservada exatamente
-- pelo mapeador (Sprint 21.3C §17). Nenhuma FK usa ON DELETE CASCADE a
-- partir de budget_versions/parent_line_id — nenhuma exclusão em cascata
-- apaga histórico econômico silenciosamente (seção 12 da instrução); a
-- única forma suportada de remover uma Linha é a operação de domínio
-- (removeBudgetLine), que já bloqueia remoção com descendentes.
CREATE TABLE IF NOT EXISTS budget_lines (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  budget_version_id UUID NOT NULL REFERENCES budget_versions(id),
  kind TEXT NOT NULL CHECK (kind IN ('Group', 'Subgroup', 'ServiceItem')),
  description_status TEXT NOT NULL CHECK (description_status IN ('Confirmed', 'AbsentFromSource')),
  description_text TEXT,
  external_code TEXT,
  parent_line_id UUID REFERENCES budget_lines(id),
  position INTEGER NOT NULL CHECK (position >= 0),
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('WholeCase', 'Lot')),
  scope_procurement_lot_id UUID REFERENCES procurement_lots(id),
  total_cents BIGINT CHECK (total_cents IS NULL OR total_cents >= 0),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (description_status = 'Confirmed' AND description_text IS NOT NULL AND length(trim(description_text)) > 0)
    OR (description_status = 'AbsentFromSource' AND description_text IS NULL)
  ),
  CHECK (
    (kind = 'ServiceItem' AND total_cents IS NOT NULL)
    OR (kind IN ('Group', 'Subgroup') AND total_cents IS NULL)
  ),
  CHECK (
    (scope_kind = 'WholeCase' AND scope_procurement_lot_id IS NULL)
    OR (scope_kind = 'Lot' AND scope_procurement_lot_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS budget_lines_company_id_idx ON budget_lines (company_id);
CREATE INDEX IF NOT EXISTS budget_lines_budget_version_id_idx ON budget_lines (budget_version_id);
CREATE INDEX IF NOT EXISTS budget_lines_parent_line_id_idx ON budget_lines (parent_line_id) WHERE parent_line_id IS NOT NULL;

-- BLOCO 7: gatilho de consistência — company_id da Linha precisa ser
-- exatamente o company_id da sua Versão; um Escopo de lote só é aceito
-- quando o Lote pertence ao mesmo Processo da Versão.
CREATE OR REPLACE FUNCTION enforce_budget_line_version_consistency() RETURNS TRIGGER AS $$
DECLARE
  v_version_company_id UUID;
  v_version_case_id UUID;
BEGIN
  SELECT company_id, procurement_case_id INTO v_version_company_id, v_version_case_id
  FROM budget_versions
  WHERE id = NEW.budget_version_id;

  IF v_version_company_id IS NULL THEN
    RAISE EXCEPTION 'budget_lines.budget_version_id does not reference an existing budget_versions row';
  END IF;

  IF v_version_company_id <> NEW.company_id THEN
    RAISE EXCEPTION 'budget_lines.company_id must match the company_id of its budget_version_id';
  END IF;

  IF NEW.scope_kind = 'Lot' AND NOT EXISTS (
    SELECT 1 FROM procurement_lots
    WHERE id = NEW.scope_procurement_lot_id AND company_id = NEW.company_id AND procurement_case_id = v_version_case_id
  ) THEN
    RAISE EXCEPTION 'budget_lines.scope_procurement_lot_id must belong to the same company_id and procurement_case_id as its Versão';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_budget_lines_version_consistency ON budget_lines;
CREATE TRIGGER enforce_budget_lines_version_consistency
BEFORE INSERT OR UPDATE ON budget_lines
FOR EACH ROW
EXECUTE FUNCTION enforce_budget_line_version_consistency();

-- BLOCO 8: TABELA budget_version_lineage_relations (Relação de
-- Rastreabilidade de origem — ADR-001 §G.6, natureza `Origin` única nesta
-- fatia). UNIQUE (budget_version_id) impõe, no banco, o invariante "no
-- máximo uma Relação de Rastreabilidade de origem por Versão" (seção 11.5
-- da instrução) — não é uma tabela universal de rastreabilidade do BDOS.
CREATE TABLE IF NOT EXISTS budget_version_lineage_relations (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  budget_version_id UUID NOT NULL REFERENCES budget_versions(id),
  nature TEXT NOT NULL DEFAULT 'Origin' CHECK (nature = 'Origin'),
  origin_kind TEXT NOT NULL CHECK (origin_kind IN ('Native', 'DocumentaryOpaqueReference')),
  origin_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (budget_version_id),
  CHECK (
    (origin_kind = 'Native' AND origin_reference IS NULL)
    OR (origin_kind = 'DocumentaryOpaqueReference' AND origin_reference IS NOT NULL AND length(trim(origin_reference)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS budget_version_lineage_relations_company_id_idx ON budget_version_lineage_relations (company_id);

CREATE OR REPLACE FUNCTION enforce_lineage_relation_version_consistency() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM budget_versions WHERE id = NEW.budget_version_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'budget_version_lineage_relations.company_id must match the company_id of its budget_version_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_lineage_relations_version_consistency ON budget_version_lineage_relations;
CREATE TRIGGER enforce_lineage_relations_version_consistency
BEFORE INSERT OR UPDATE ON budget_version_lineage_relations
FOR EACH ROW
EXECUTE FUNCTION enforce_lineage_relation_version_consistency();

-- BLOCO 9: HABILITAR RLS
ALTER TABLE procurement_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_version_lineage_relations ENABLE ROW LEVEL SECURITY;

-- procurement_cases: só SELECT/INSERT nesta fatia (o Serviço de Aplicação
-- só cria e localiza — seção 8.1 da instrução).
DROP POLICY IF EXISTS procurement_cases_select_company_or_admin ON procurement_cases;
CREATE POLICY procurement_cases_select_company_or_admin
ON procurement_cases FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS procurement_cases_insert_company_or_admin ON procurement_cases;
CREATE POLICY procurement_cases_insert_company_or_admin
ON procurement_cases FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS procurement_cases_update_blocked ON procurement_cases;
CREATE POLICY procurement_cases_update_blocked
ON procurement_cases FOR UPDATE TO authenticated
USING (false);

DROP POLICY IF EXISTS procurement_cases_delete_blocked ON procurement_cases;
CREATE POLICY procurement_cases_delete_blocked
ON procurement_cases FOR DELETE TO authenticated
USING (false);

-- procurement_lots: mesmo raciocínio de procurement_cases.
DROP POLICY IF EXISTS procurement_lots_select_company_or_admin ON procurement_lots;
CREATE POLICY procurement_lots_select_company_or_admin
ON procurement_lots FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS procurement_lots_insert_company_or_admin ON procurement_lots;
CREATE POLICY procurement_lots_insert_company_or_admin
ON procurement_lots FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS procurement_lots_update_blocked ON procurement_lots;
CREATE POLICY procurement_lots_update_blocked
ON procurement_lots FOR UPDATE TO authenticated
USING (false);

DROP POLICY IF EXISTS procurement_lots_delete_blocked ON procurement_lots;
CREATE POLICY procurement_lots_delete_blocked
ON procurement_lots FOR DELETE TO authenticated
USING (false);

-- budget_versions: SELECT/INSERT/UPDATE (revisão/consolidação, sempre via
-- persist_budget_version_snapshot, Bloco 10 — SECURITY INVOKER, esta
-- política continua se aplicando dentro da função). Nunca DELETE.
DROP POLICY IF EXISTS budget_versions_select_company_or_admin ON budget_versions;
CREATE POLICY budget_versions_select_company_or_admin
ON budget_versions FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS budget_versions_insert_company_or_admin ON budget_versions;
CREATE POLICY budget_versions_insert_company_or_admin
ON budget_versions FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS budget_versions_update_company_or_admin ON budget_versions;
CREATE POLICY budget_versions_update_company_or_admin
ON budget_versions FOR UPDATE TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS budget_versions_delete_blocked ON budget_versions;
CREATE POLICY budget_versions_delete_blocked
ON budget_versions FOR DELETE TO authenticated
USING (false);

-- budget_lines: SELECT/INSERT/DELETE (o retrato completo é sempre
-- substituído inteiro por persist_budget_version_snapshot — Bloco 10 —
-- nunca UPDATE de uma linha isolada).
DROP POLICY IF EXISTS budget_lines_select_company_or_admin ON budget_lines;
CREATE POLICY budget_lines_select_company_or_admin
ON budget_lines FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS budget_lines_insert_company_or_admin ON budget_lines;
CREATE POLICY budget_lines_insert_company_or_admin
ON budget_lines FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS budget_lines_delete_company_or_admin ON budget_lines;
CREATE POLICY budget_lines_delete_company_or_admin
ON budget_lines FOR DELETE TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS budget_lines_update_blocked ON budget_lines;
CREATE POLICY budget_lines_update_blocked
ON budget_lines FOR UPDATE TO authenticated
USING (false);

-- budget_version_lineage_relations: SELECT/INSERT apenas — nunca
-- substituída (seção 8.2/9.8 da instrução: registrar uma segunda vez é
-- erro, nunca sobrescrita).
DROP POLICY IF EXISTS budget_version_lineage_relations_select_company_or_admin ON budget_version_lineage_relations;
CREATE POLICY budget_version_lineage_relations_select_company_or_admin
ON budget_version_lineage_relations FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS budget_version_lineage_relations_insert_company_or_admin ON budget_version_lineage_relations;
CREATE POLICY budget_version_lineage_relations_insert_company_or_admin
ON budget_version_lineage_relations FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS budget_version_lineage_relations_update_blocked ON budget_version_lineage_relations;
CREATE POLICY budget_version_lineage_relations_update_blocked
ON budget_version_lineage_relations FOR UPDATE TO authenticated
USING (false);

DROP POLICY IF EXISTS budget_version_lineage_relations_delete_blocked ON budget_version_lineage_relations;
CREATE POLICY budget_version_lineage_relations_delete_blocked
ON budget_version_lineage_relations FOR DELETE TO authenticated
USING (false);

-- BLOCO 10: create_budget_version_draft — persiste, numa única transação
-- implícita, o registro principal da Versão em rascunho e (quando
-- fornecida) a Relação de Rastreabilidade de origem declarada já na
-- criação (ADR-003 §B: origem e a Relação que a documenta podem nascer
-- juntas). Nenhuma regra de negócio aqui — o retrato já foi validado por
-- createBudgetVersion (domínio, Sprint 21.3B) antes desta chamada.
-- SECURITY INVOKER (padrão, omitido de propósito) — RLS de authenticated
-- se aplica normalmente a cada INSERT dentro da função, mesmo raciocínio
-- de approve_copilot_recommendation.
CREATE OR REPLACE FUNCTION create_budget_version_draft(
  p_company_id UUID,
  p_id UUID,
  p_procurement_case_id UUID,
  p_scope_kind TEXT,
  p_procurement_lot_id UUID,
  p_origin_kind TEXT,
  p_origin_reference TEXT,
  p_metadata JSONB,
  p_correlation_id TEXT,
  p_created_by UUID,
  p_source_system TEXT,
  p_lineage_id UUID,
  p_lineage_origin_kind TEXT,
  p_lineage_origin_reference TEXT
) RETURNS JSONB AS $$
DECLARE
  v_revision INTEGER;
BEGIN
  INSERT INTO budget_versions (
    id, company_id, procurement_case_id, scope_kind, procurement_lot_id,
    origin_kind, origin_reference, status, metadata, correlation_id, created_by, source_system
  ) VALUES (
    p_id, p_company_id, p_procurement_case_id, p_scope_kind, p_procurement_lot_id,
    p_origin_kind, p_origin_reference, 'Draft', COALESCE(p_metadata, '{}'::JSONB), p_correlation_id, p_created_by, p_source_system
  )
  RETURNING revision INTO v_revision;

  IF p_lineage_id IS NOT NULL THEN
    INSERT INTO budget_version_lineage_relations (
      id, company_id, budget_version_id, nature, origin_kind, origin_reference
    ) VALUES (
      p_lineage_id, p_company_id, p_id, 'Origin', p_lineage_origin_kind, p_lineage_origin_reference
    );
  END IF;

  RETURN jsonb_build_object('revision', v_revision);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION create_budget_version_draft(
  UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT, UUID, TEXT, TEXT
) TO authenticated;

COMMENT ON FUNCTION create_budget_version_draft IS
  'Epic 21.3C — persiste o registro principal da Versão do Orçamento em rascunho e, quando fornecida, a Relação de Rastreabilidade de origem declarada na criação, numa única transação. Nenhuma regra de negócio aqui — o retrato já foi validado por createBudgetVersion (domínio puro, Sprint 21.3B). SECURITY INVOKER (padrão) — RLS de authenticated se aplica normalmente a cada INSERT.';

-- BLOCO 11: persist_budget_version_snapshot — a única forma de alterar uma
-- Versão do Orçamento já criada (adicionar/atualizar/remover/reordenar
-- Linha, registrar Relação de Rastreabilidade posteriormente, consolidar).
-- Recebe o retrato inteiro já validado pelo domínio e a revisão esperada;
-- substitui o conjunto de Linhas atomicamente (DELETE + INSERT na mesma
-- transação implícita da função) e atualiza status/revisão condicionado a
-- WHERE id = ... AND company_id = ... AND revision = p_expected_revision.
-- Se nenhuma linha principal for afetada, retorna conflito de
-- concorrência explícito sem tocar em budget_lines — nunca persistência
-- parcial. `p_lineage_id`, quando fornecido, é inserido com
-- ON CONFLICT (id) DO NOTHING — reenviar a mesma Relação (mesmo id) em
-- chamadas subsequentes do mesmo agregado é um no-op idempotente; uma
-- segunda Relação com id diferente para a mesma Versão continua bloqueada
-- pelo UNIQUE (budget_version_id) da tabela (Bloco 8), como defesa em
-- profundidade — o domínio (registerLineageRelation) já impede esse caso
-- antes de chegar aqui.
CREATE OR REPLACE FUNCTION persist_budget_version_snapshot(
  p_company_id UUID,
  p_budget_version_id UUID,
  p_expected_revision INTEGER,
  p_status TEXT,
  p_lines JSONB,
  p_lineage_id UUID,
  p_lineage_origin_kind TEXT,
  p_lineage_origin_reference TEXT
) RETURNS JSONB AS $$
DECLARE
  v_new_revision INTEGER;
BEGIN
  UPDATE budget_versions
  SET status = p_status, revision = revision + 1
  WHERE id = p_budget_version_id
    AND company_id = p_company_id
    AND revision = p_expected_revision
  RETURNING revision INTO v_new_revision;

  IF v_new_revision IS NULL THEN
    RETURN jsonb_build_object('conflict', true);
  END IF;

  DELETE FROM budget_lines
  WHERE budget_version_id = p_budget_version_id AND company_id = p_company_id;

  INSERT INTO budget_lines (
    id, company_id, budget_version_id, kind, description_status, description_text,
    external_code, parent_line_id, position, scope_kind, scope_procurement_lot_id, total_cents, metadata
  )
  SELECT
    (line->>'id')::UUID,
    p_company_id,
    p_budget_version_id,
    line->>'kind',
    line->>'descriptionStatus',
    line->>'descriptionText',
    line->>'externalCode',
    NULLIF(line->>'parentLineId', '')::UUID,
    (line->>'position')::INTEGER,
    line->>'scopeKind',
    NULLIF(line->>'scopeProcurementLotId', '')::UUID,
    NULLIF(line->>'totalCents', '')::BIGINT,
    COALESCE(line->'metadata', '{}'::JSONB)
  FROM jsonb_array_elements(p_lines) AS line;

  IF p_lineage_id IS NOT NULL THEN
    INSERT INTO budget_version_lineage_relations (
      id, company_id, budget_version_id, nature, origin_kind, origin_reference
    ) VALUES (
      p_lineage_id, p_company_id, p_budget_version_id, 'Origin', p_lineage_origin_kind, p_lineage_origin_reference
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('conflict', false, 'revision', v_new_revision);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION persist_budget_version_snapshot(
  UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT
) TO authenticated;

COMMENT ON FUNCTION persist_budget_version_snapshot IS
  'Epic 21.3C — única forma de alterar uma Versão do Orçamento já criada. Recebe o retrato inteiro já validado pelo domínio (Sprint 21.3B) e a revisão esperada; substitui o conjunto de Linhas atomicamente e aplica concorrência otimista (UPDATE condicionado a revision = esperada). Retorna {conflict: true} sem tocar em budget_lines quando a revisão não bate — nunca persistência parcial. SECURITY INVOKER (padrão) — RLS de authenticated se aplica normalmente a cada statement dentro da função.';

-- BLOCO 12: COMENTARIOS
COMMENT ON TABLE procurement_cases IS
  'Processo de Licitação e Contratação (ADR-002) — núcleo coordenador enxuto. Não guarda listas de lotes, versões ou decisões (Seção D do ADR). Só SELECT/INSERT nesta fatia (Epic 21, Sprint 21.3C).';
COMMENT ON TABLE procurement_lots IS
  'Lote da Licitação (ADR-002 §H) — sempre opcional; nunca criado artificialmente para um processo sem lotes reais.';
COMMENT ON TABLE budget_versions IS
  'Versão do Orçamento (ADR-001/ADR-003). `revision` é concorrência otimista física, nunca campo de domínio. Alterada exclusivamente por create_budget_version_draft (criação) e persist_budget_version_snapshot (toda alteração subsequente).';
COMMENT ON TABLE budget_lines IS
  'Linha do Orçamento (ADR-001 §G.2) — Grupo/Subgrupo/Item de Serviço. Sempre substituída inteira por persist_budget_version_snapshot; nenhuma UPDATE de linha isolada.';
COMMENT ON TABLE budget_version_lineage_relations IS
  'Relação de Rastreabilidade de origem (ADR-001 §G.6) — no máximo uma por Versão do Orçamento nesta fatia (UNIQUE budget_version_id), natureza sempre Origin. Não é a tabela universal de rastreabilidade do BDOS.';
