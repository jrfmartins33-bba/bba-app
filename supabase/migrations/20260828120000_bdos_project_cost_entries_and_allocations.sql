-- ============================================================================
-- BDOS — Centros de Custo · CAMADA OPERACIONAL (Custo do Projeto + Alocação)
-- Migration: 20260828120000_bdos_project_cost_entries_and_allocations.sql
--
-- PREPARADA PARA REVISÃO HUMANA. Esta migration é estritamente ADITIVA:
--   1. NÃO altera nenhuma tabela existente (nem financial_lancamentos,
--      financial_categorias, contract_baselines, measurement_*, budget_*).
--   2. NÃO executa INSERT/UPDATE/DELETE em dados de produção — nenhuma
--      business row, nenhuma categoria financeira, nenhuma despesa.
--   3. Cria duas tabelas novas: project_cost_entries e
--      project_cost_allocations, isoladas por company_id com RLS
--      company-or-admin para leitura.
--   4. Nenhum writer da aplicação nesta rodada. Escrita futura só por
--      caminho server-side controlado (service_role). DELETE não é
--      concedido a authenticated.
--
-- >>> NÃO APLICAR NO SUPABASE SEM AUTORIZAÇÃO SEPARADA. <<<
--
-- Fundamentação:
--   - Camada operacional descrita em "CENTROS DE CUSTO — CAMADA OPERACIONAL".
--   - Reutiliza project_cost_centers, consortium_members e
--     financial_categorias já existentes (migration
--     20260820000000_bdos_contract_baseline_and_consortium.sql e
--     202506290008_modules_financeiro_tarefas_chat.sql).
--   - Dinheiro em NUMERIC(20,8) exato (mesma escala da Base Contratual),
--     já canonicalizado a centavos pela camada de decimal do domínio
--     (measurement-certification) antes de qualquer gravação. Nunca float.
--   - Percentuais em basis points inteiros (1..10000).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCO 1: project_cost_entries — Custo do Projeto ANTES da distribuição
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_cost_entries (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id   UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,

  -- Vínculo OPCIONAL futuro com o Financeiro real. NUNCA duplica o
  -- Financeiro; permanece NULL para dados demonstrativos.
  financial_lancamento_id  UUID REFERENCES financial_lancamentos(id) ON DELETE SET NULL,
  -- Reutiliza o catálogo de categorias já existente quando aplicável.
  financial_categoria_id   UUID REFERENCES financial_categorias(id) ON DELETE SET NULL,

  -- Classificação gerencial de alto nível (consolida Folha + Encargos em 'RH').
  cost_family              TEXT NOT NULL
                           CHECK (cost_family IN ('RH', 'Combustivel', 'LocacaoEquipamentos', 'Outros')),

  description              TEXT NOT NULL CHECK (btrim(description) <> ''),
  supplier_name            TEXT,

  -- Valor total do custo, exato. > 0.
  amount_decimal           NUMERIC(20, 8) NOT NULL CHECK (amount_decimal > 0),

  -- Competência gerencial: 'YYYY-MM' (período) — data derivada apenas para índice.
  competence_period        TEXT NOT NULL CHECK (competence_period ~ '^[0-9]{4}-[0-9]{2}$'),
  competence_date          DATE NOT NULL,

  -- Semântica Demonstrative vs Actual — precisa existir no modelo, não
  -- apenas como observação textual.
  data_nature              TEXT NOT NULL DEFAULT 'Demonstrative'
                           CHECK (data_nature IN ('Demonstrative', 'Actual')),

  source_kind              TEXT NOT NULL DEFAULT 'ManualDemonstration'
                           CHECK (source_kind IN (
                             'ManualDemonstration', 'FinancialEntry', 'Payroll',
                             'Document', 'Import', 'Integration', 'ManualControlled')),

  status                   TEXT NOT NULL DEFAULT 'Draft'
                           CHECK (status IN ('Draft', 'Allocated')),

  notes                    TEXT,
  metadata                 JSONB NOT NULL DEFAULT '{}',

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- PROVENIÊNCIA — a origem do custo é declarada em source_kind.
  -- financial_categoria_id CLASSIFICA o custo; NUNCA prova sua origem.
  --
  -- Regra A: source_kind = 'ManualDemonstration' ⇒ data_nature = 'Demonstrative'.
  CONSTRAINT project_cost_entries_manual_demo_is_demonstrative CHECK (
    source_kind <> 'ManualDemonstration' OR data_nature = 'Demonstrative'
  ),
  -- Regra B: data_nature = 'Actual' ⇒ source_kind <> 'ManualDemonstration'.
  -- (contrapositiva de A; mantida explícita por clareza de revisão.)
  CONSTRAINT project_cost_entries_actual_not_manual_demo CHECK (
    data_nature <> 'Actual' OR source_kind <> 'ManualDemonstration'
  ),
  -- Regra C: source_kind = 'FinancialEntry' ⇒ financial_lancamento_id NOT NULL.
  -- As demais origens de custo real (Payroll, Document, Import, Integration,
  -- ManualControlled) permanecem válidas sem exigir financial_lancamento_id.
  CONSTRAINT project_cost_entries_financial_entry_requires_lancamento CHECK (
    source_kind <> 'FinancialEntry' OR financial_lancamento_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS project_cost_entries_company_id_idx
  ON project_cost_entries (company_id);
CREATE INDEX IF NOT EXISTS project_cost_entries_project_id_idx
  ON project_cost_entries (engineering_project_id);
CREATE INDEX IF NOT EXISTS project_cost_entries_period_idx
  ON project_cost_entries (engineering_project_id, competence_period);
CREATE INDEX IF NOT EXISTS project_cost_entries_nature_idx
  ON project_cost_entries (engineering_project_id, data_nature);
CREATE INDEX IF NOT EXISTS project_cost_entries_financial_lancamento_idx
  ON project_cost_entries (financial_lancamento_id) WHERE financial_lancamento_id IS NOT NULL;

-- Idempotência da futura escrita: uma chave natural estável por
-- (empresa, obra, período, natureza, família, descrição normalizada).
-- NÃO usa a descrição livre como única chave — normaliza e combina com a
-- dimensão gerencial completa. Uma segunda execução do carregador
-- demonstrativo colide aqui em vez de duplicar.
CREATE UNIQUE INDEX IF NOT EXISTS project_cost_entries_natural_key_idx
  ON project_cost_entries (
    company_id,
    engineering_project_id,
    competence_period,
    data_nature,
    cost_family,
    lower(btrim(description))
  );

-- ESTRATÉGIA DE IDEMPOTÊNCIA DA FUTURA ESCRITA (não executada nesta rodada).
--
-- project_cost_entries_natural_key_idx é um UNIQUE INDEX (parcialmente por
-- EXPRESSÃO: lower(btrim(description))), NÃO uma UNIQUE CONSTRAINT nomeada.
-- Portanto o writer NUNCA deve usar `ON CONFLICT ON CONSTRAINT
-- project_cost_entries_natural_key_idx` (o Postgres exige uma constraint
-- real; um índice não é uma constraint). A forma correta é INFERÊNCIA DO
-- ÍNDICE pela lista de colunas + a MESMA expressão do índice:
--
--   INSERT INTO project_cost_entries
--     (company_id, engineering_project_id, financial_lancamento_id,
--      financial_categoria_id, cost_family, description, supplier_name,
--      amount_decimal, competence_period, competence_date, data_nature,
--      source_kind, status, notes, metadata)
--   VALUES (...)
--   ON CONFLICT (company_id, engineering_project_id, competence_period,
--                data_nature, cost_family, lower(btrim(description)))
--   DO NOTHING
--   RETURNING id;
--
-- Se `RETURNING id` vier vazio (linha já existia), o writer relê o id:
--   SELECT id FROM project_cost_entries
--    WHERE company_id = $1 AND engineering_project_id = $2
--      AND competence_period = $3 AND data_nature = $4
--      AND cost_family = $5 AND lower(btrim(description)) = lower(btrim($6));
--
-- Nenhuma coluna gerada nem constraint redundante é necessária: a
-- inferência do índice por expressão é suficiente e é a sintaxe suportada
-- por PostgreSQL 15 / Supabase.

COMMENT ON TABLE project_cost_entries IS
  'Custo do projeto antes da distribuição entre Centros de Custo. data_nature separa dado demonstrativo de custo real. Não substitui nem duplica financial_lancamentos.';

-- Consistência multiempresa: o custo e seus vínculos são da mesma empresa.
CREATE OR REPLACE FUNCTION enforce_project_cost_entry_company_consistency() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM engineering_projects
    WHERE id = NEW.engineering_project_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'project_cost_entries.company_id must match the company_id of its engineering_project_id';
  END IF;

  IF NEW.financial_lancamento_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM financial_lancamentos
    WHERE id = NEW.financial_lancamento_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'project_cost_entries.company_id must match the company_id of its financial_lancamento_id';
  END IF;

  -- financial_categorias pode ser global (company_id IS NULL) ou da empresa.
  IF NEW.financial_categoria_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM financial_categorias
    WHERE id = NEW.financial_categoria_id
      AND (company_id IS NULL OR company_id = NEW.company_id)
  ) THEN
    RAISE EXCEPTION 'project_cost_entries.financial_categoria_id must be a global category or belong to the same company_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_project_cost_entries_company_consistency ON project_cost_entries;
CREATE TRIGGER enforce_project_cost_entries_company_consistency
BEFORE INSERT OR UPDATE ON project_cost_entries
FOR EACH ROW
EXECUTE FUNCTION enforce_project_cost_entry_company_consistency();

-- ---------------------------------------------------------------------------
-- BLOCO 2: project_cost_allocations — quanto de um custo pertence a cada CC
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_cost_allocations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id   UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,

  project_cost_entry_id    UUID NOT NULL REFERENCES project_cost_entries(id) ON DELETE CASCADE,
  project_cost_center_id   UUID NOT NULL REFERENCES project_cost_centers(id) ON DELETE RESTRICT,

  -- DIRECT = atribuição direta; EQUAL_SPLIT = rateio igual (só quando
  -- solicitado explicitamente); CUSTOM_SPLIT = rateio específico.
  allocation_method        TEXT NOT NULL
                           CHECK (allocation_method IN ('DIRECT', 'EQUAL_SPLIT', 'CUSTOM_SPLIT')),

  -- Percentual REALMENTE utilizado, inteiro, 1..10000.
  allocation_basis_points  INTEGER NOT NULL
                           CHECK (allocation_basis_points BETWEEN 1 AND 10000),

  -- Valor alocado, exato. > 0.
  allocated_amount_decimal NUMERIC(20, 8) NOT NULL CHECK (allocated_amount_decimal > 0),

  rationale                TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Um Centro de Custo não pode aparecer duas vezes na mesma despesa.
  UNIQUE (project_cost_entry_id, project_cost_center_id)
);

CREATE INDEX IF NOT EXISTS project_cost_allocations_company_id_idx
  ON project_cost_allocations (company_id);
CREATE INDEX IF NOT EXISTS project_cost_allocations_project_id_idx
  ON project_cost_allocations (engineering_project_id);
CREATE INDEX IF NOT EXISTS project_cost_allocations_entry_id_idx
  ON project_cost_allocations (project_cost_entry_id);
CREATE INDEX IF NOT EXISTS project_cost_allocations_cost_center_id_idx
  ON project_cost_allocations (project_cost_center_id);

COMMENT ON TABLE project_cost_allocations IS
  'Distribuição de um custo do projeto entre Centros de Custo. A participação societária no consórcio NUNCA gera alocação automaticamente. Para status Allocated do custo, a soma das alocações deve igualar o valor total exatamente (garantido pelo domínio na escrita server-side).';

-- Consistência multiempresa/multiobra: a alocação, o custo e o Centro de
-- Custo pertencem todos à mesma empresa e à mesma obra. Vínculo sempre
-- por identidade, nunca por nome.
CREATE OR REPLACE FUNCTION enforce_project_cost_allocation_consistency() RETURNS TRIGGER AS $$
DECLARE
  v_entry_company UUID;
  v_entry_project UUID;
  v_cc_company UUID;
  v_cc_project UUID;
BEGIN
  SELECT company_id, engineering_project_id INTO v_entry_company, v_entry_project
  FROM project_cost_entries WHERE id = NEW.project_cost_entry_id;

  IF v_entry_company IS NULL THEN
    RAISE EXCEPTION 'project_cost_allocations.project_cost_entry_id % not found', NEW.project_cost_entry_id;
  END IF;

  IF v_entry_company <> NEW.company_id OR v_entry_project <> NEW.engineering_project_id THEN
    RAISE EXCEPTION 'project_cost_allocations must share company_id/engineering_project_id with its cost entry';
  END IF;

  SELECT company_id, engineering_project_id INTO v_cc_company, v_cc_project
  FROM project_cost_centers WHERE id = NEW.project_cost_center_id;

  IF v_cc_company IS NULL THEN
    RAISE EXCEPTION 'project_cost_allocations.project_cost_center_id % not found', NEW.project_cost_center_id;
  END IF;

  IF v_cc_company <> NEW.company_id THEN
    RAISE EXCEPTION 'allocation cost center belongs to another company_id';
  END IF;

  IF v_cc_project <> NEW.engineering_project_id THEN
    RAISE EXCEPTION 'allocation cost center belongs to another engineering_project_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_project_cost_allocations_consistency ON project_cost_allocations;
CREATE TRIGGER enforce_project_cost_allocations_consistency
BEFORE INSERT OR UPDATE ON project_cost_allocations
FOR EACH ROW
EXECUTE FUNCTION enforce_project_cost_allocation_consistency();

-- ---------------------------------------------------------------------------
-- BLOCO 3: RLS company-or-admin (leitura). Escrita só service_role.
-- ---------------------------------------------------------------------------
ALTER TABLE project_cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_cost_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_cost_entries_read ON project_cost_entries;
CREATE POLICY project_cost_entries_read ON project_cost_entries
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS project_cost_allocations_read ON project_cost_allocations;
CREATE POLICY project_cost_allocations_read ON project_cost_allocations
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_bba_admin());

-- REVOKE explícito ANTES de qualquer GRANT — não depender de default
-- privileges do PostgreSQL/Supabase. Estado conhecido: ninguém tem nada.
REVOKE ALL ON project_cost_entries FROM PUBLIC;
REVOKE ALL ON project_cost_entries FROM anon;
REVOKE ALL ON project_cost_entries FROM authenticated;
REVOKE ALL ON project_cost_entries FROM service_role;

REVOKE ALL ON project_cost_allocations FROM PUBLIC;
REVOKE ALL ON project_cost_allocations FROM anon;
REVOKE ALL ON project_cost_allocations FROM authenticated;
REVOKE ALL ON project_cost_allocations FROM service_role;

-- PUBLIC / anon: nenhum GRANT (permanecem sem acesso).
-- authenticated: apenas SELECT, sujeito à RLS company-or-admin acima.
--   Nenhuma policy de INSERT/UPDATE/DELETE para authenticated.
GRANT SELECT ON project_cost_entries TO authenticated;
GRANT SELECT ON project_cost_allocations TO authenticated;

-- service_role: SELECT/INSERT/UPDATE (escrita server-side controlada).
-- DELETE NÃO é concedido a ninguém pela aplicação nesta rodada.
GRANT SELECT, INSERT, UPDATE ON project_cost_entries TO service_role;
GRANT SELECT, INSERT, UPDATE ON project_cost_allocations TO service_role;

-- ============================================================================
-- FIM. Nenhuma linha inserida. Nenhuma tabela existente alterada.
-- ============================================================================
