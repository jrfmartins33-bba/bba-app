-- ==============================================================================
-- BDOS — Base Contratual da Obra, Consórcios N-Membros e Centros de Custo
-- Migration: 20260820000000_bdos_contract_baseline_and_consortium.sql
--
-- Fundamentação:
--   - ADR-001 (Identidade e Lineage de Itens e Documentos)
--   - ADR-002 (Limite do Processo de Licitação e Contratação)
--   - ADR-003 (Versão do Orçamento e Transformações Orçamentárias)
--   - ADR-004 (Composição de Custos, Formação de Preços e BDI)
--   - EPIC_21_DOMAIN_IMPLEMENTATION_MAP.md
--
-- Esta migration é estritamente ADITIVA:
--   1. NÃO altera nenhuma tabela existente.
--   2. NÃO executa INSERT/UPDATE/DELETE em dados de produção.
--   3. Define isolamento por organização usuária (company_id) com RLS e triggers de consistência.
--   4. Garante reconciliação matemática precisa (sub-centavo, NUMERIC(20,8)) na Base Contratual.
--   5. Utiliza autoridade monetária única (contracted_value_cents) sem redundância decimal.
-- ==============================================================================

-- BLOCO 1: TABELA consortia (Consórcios)
CREATE TABLE IF NOT EXISTS consortia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  cnpj TEXT,
  composition_status TEXT NOT NULL DEFAULT 'Draft' CHECK (composition_status IN ('Draft', 'Consolidated')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS consortia_company_id_idx ON consortia (company_id);

-- BLOCO 2: TABELA consortium_members (Membros do Consórcio — Cardinalidade N)
CREATE TABLE IF NOT EXISTS consortium_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  consortium_id UUID NOT NULL REFERENCES consortia(id) ON DELETE CASCADE,
  party_name_snapshot TEXT NOT NULL,
  party_trade_name_snapshot TEXT,
  party_identifier TEXT,
  share_basis_points INTEGER NOT NULL CHECK (share_basis_points >= 0 AND share_basis_points <= 10000),
  is_leader BOOLEAN NOT NULL DEFAULT FALSE,
  member_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS consortium_members_company_id_idx ON consortium_members (company_id);
CREATE INDEX IF NOT EXISTS consortium_members_consortium_id_idx ON consortium_members (consortium_id);

-- Índice único parcial: no máximo 1 líder por consórcio
CREATE UNIQUE INDEX IF NOT EXISTS consortium_members_single_leader_idx
  ON consortium_members (consortium_id)
  WHERE is_leader = TRUE;

-- Índice único parcial: evita duplicação do mesmo identificador no mesmo consórcio
CREATE UNIQUE INDEX IF NOT EXISTS consortium_members_party_identifier_idx
  ON consortium_members (consortium_id, party_identifier)
  WHERE party_identifier IS NOT NULL;

-- Gatilho de consistência multiempresa para consortium_members
CREATE OR REPLACE FUNCTION enforce_consortium_member_company_consistency() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM consortia
    WHERE id = NEW.consortium_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'consortium_members.company_id must match the company_id of its consortium_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_consortium_members_company_consistency ON consortium_members;
CREATE TRIGGER enforce_consortium_members_company_consistency
BEFORE INSERT OR UPDATE ON consortium_members
FOR EACH ROW
EXECUTE FUNCTION enforce_consortium_member_company_consistency();

-- Proteção persistente de composição 100% (10000 bps) para consórcios consolidados
CREATE OR REPLACE FUNCTION enforce_consortium_composition_total() RETURNS TRIGGER AS $$
DECLARE
  v_consortium_id UUID;
  v_status TEXT;
  v_total_bps BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'consortia' THEN
    v_consortium_id := NEW.id;
    v_status := NEW.composition_status;
  ELSE
    v_consortium_id := COALESCE(NEW.consortium_id, OLD.consortium_id);
    SELECT composition_status INTO v_status FROM consortia WHERE id = v_consortium_id;
  END IF;

  IF v_status = 'Consolidated' THEN
    SELECT COALESCE(SUM(share_basis_points), 0) INTO v_total_bps
    FROM consortium_members
    WHERE consortium_id = v_consortium_id;

    IF v_total_bps <> 10000 THEN
      RAISE EXCEPTION 'Consolidated consortium % must have member shares totaling exactly 10000 basis points (100%%). Current sum: %', v_consortium_id, v_total_bps;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_consortium_composition_on_consortia ON consortia;
CREATE CONSTRAINT TRIGGER enforce_consortium_composition_on_consortia
AFTER INSERT OR UPDATE OF composition_status ON consortia
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_consortium_composition_total();

DROP TRIGGER IF EXISTS enforce_consortium_composition_on_members ON consortium_members;
CREATE CONSTRAINT TRIGGER enforce_consortium_composition_on_members
AFTER INSERT OR UPDATE OR DELETE ON consortium_members
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_consortium_composition_total();

-- BLOCO 3: TABELA project_cost_centers (Centros de Custo contextuais à Obra)
CREATE TABLE IF NOT EXISTS project_cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  consortium_member_id UUID REFERENCES consortium_members(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (engineering_project_id, code)
);

CREATE INDEX IF NOT EXISTS project_cost_centers_company_id_idx ON project_cost_centers (company_id);
CREATE INDEX IF NOT EXISTS project_cost_centers_project_id_idx ON project_cost_centers (engineering_project_id);
CREATE INDEX IF NOT EXISTS project_cost_centers_member_id_idx ON project_cost_centers (consortium_member_id);

-- Gatilho de consistência multiempresa para project_cost_centers
CREATE OR REPLACE FUNCTION enforce_project_cost_center_company_consistency() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM engineering_projects
    WHERE id = NEW.engineering_project_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'project_cost_centers.company_id must match the company_id of its engineering_project_id';
  END IF;

  IF NEW.consortium_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM consortium_members
    WHERE id = NEW.consortium_member_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'project_cost_centers.company_id must match the company_id of its consortium_member_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_project_cost_centers_company_consistency ON project_cost_centers;
CREATE TRIGGER enforce_project_cost_centers_company_consistency
BEFORE INSERT OR UPDATE ON project_cost_centers
FOR EACH ROW
EXECUTE FUNCTION enforce_project_cost_center_company_consistency();

-- BLOCO 4: TABELA contract_baselines (Base Contratual da Obra em Execução)
CREATE TABLE IF NOT EXISTS contract_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  procurement_case_id UUID REFERENCES procurement_cases(id) ON DELETE SET NULL,
  consortium_id UUID REFERENCES consortia(id) ON DELETE SET NULL,
  source_budget_version_id UUID REFERENCES budget_versions(id) ON DELETE SET NULL,
  contract_number TEXT NOT NULL,
  contractor_name_snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'InExecution' CHECK (status IN ('Draft', 'InExecution', 'Suspended', 'Completed', 'Cancelled')),
  
  -- Autoridade monetária única em centavos inteiros
  contracted_value_cents BIGINT NOT NULL CHECK (contracted_value_cents >= 0),
  historical_official_budget_cents BIGINT CHECK (historical_official_budget_cents IS NULL OR historical_official_budget_cents >= 0),

  -- Valores sub-centavo de alta precisão (NUMERIC(20, 8) para suportar obras acima de R$ 100 milhões)
  derived_items_total_decimal NUMERIC(20, 8) NOT NULL CHECK (derived_items_total_decimal >= 0),
  contractual_rounding_adjustment_decimal NUMERIC(20, 8) NOT NULL,
  
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Invariante de reconciliação matemática: Valor Contratado = Soma dos Itens + Ajuste de Arredondamento
  CONSTRAINT contract_baselines_reconciliation_check CHECK (
    (contracted_value_cents::NUMERIC / 100) = (derived_items_total_decimal + contractual_rounding_adjustment_decimal)
  )
);

CREATE INDEX IF NOT EXISTS contract_baselines_company_id_idx ON contract_baselines (company_id);
CREATE INDEX IF NOT EXISTS contract_baselines_project_id_idx ON contract_baselines (engineering_project_id);
CREATE INDEX IF NOT EXISTS contract_baselines_consortium_id_idx ON contract_baselines (consortium_id);
CREATE INDEX IF NOT EXISTS contract_baselines_source_budget_version_id_idx ON contract_baselines (source_budget_version_id) WHERE source_budget_version_id IS NOT NULL;

-- Gatilho de consistência multiempresa para contract_baselines
CREATE OR REPLACE FUNCTION enforce_contract_baseline_company_consistency() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM engineering_projects
    WHERE id = NEW.engineering_project_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'contract_baselines.company_id must match the company_id of its engineering_project_id';
  END IF;

  IF NEW.procurement_case_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM procurement_cases
    WHERE id = NEW.procurement_case_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'contract_baselines.company_id must match the company_id of its procurement_case_id';
  END IF;

  IF NEW.consortium_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM consortia
    WHERE id = NEW.consortium_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'contract_baselines.company_id must match the company_id of its consortium_id';
  END IF;

  IF NEW.source_budget_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM budget_versions
    WHERE id = NEW.source_budget_version_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'contract_baselines.company_id must match the company_id of its source_budget_version_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_contract_baselines_company_consistency ON contract_baselines;
CREATE TRIGGER enforce_contract_baselines_company_consistency
BEFORE INSERT OR UPDATE ON contract_baselines
FOR EACH ROW
EXECUTE FUNCTION enforce_contract_baseline_company_consistency();

-- BLOCO 5: RLS (Row Level Security) e Permissões
ALTER TABLE consortia ENABLE ROW LEVEL SECURITY;
ALTER TABLE consortium_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consortia_tenant_isolation ON consortia;
CREATE POLICY consortia_tenant_isolation ON consortia
  FOR ALL TO authenticated
  USING (company_id = get_my_company_id() OR is_bba_admin())
  WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS consortium_members_tenant_isolation ON consortium_members;
CREATE POLICY consortium_members_tenant_isolation ON consortium_members
  FOR ALL TO authenticated
  USING (company_id = get_my_company_id() OR is_bba_admin())
  WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS project_cost_centers_tenant_isolation ON project_cost_centers;
CREATE POLICY project_cost_centers_tenant_isolation ON project_cost_centers
  FOR ALL TO authenticated
  USING (company_id = get_my_company_id() OR is_bba_admin())
  WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS contract_baselines_tenant_isolation ON contract_baselines;
CREATE POLICY contract_baselines_tenant_isolation ON contract_baselines
  FOR ALL TO authenticated
  USING (company_id = get_my_company_id() OR is_bba_admin())
  WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON consortia TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON consortium_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_cost_centers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON contract_baselines TO authenticated;

GRANT ALL ON consortia TO service_role;
GRANT ALL ON consortium_members TO service_role;
GRANT ALL ON project_cost_centers TO service_role;
GRANT ALL ON contract_baselines TO service_role;
