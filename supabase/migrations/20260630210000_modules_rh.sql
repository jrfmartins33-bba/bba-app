-- ============================================================
-- BBA APP — Módulo Trabalhista/RH
-- Tabelas transacionais: colaboradores e folha de pagamentos
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. rh_funcionarios — Registro de colaboradores
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rh_funcionarios (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome              VARCHAR(120)  NOT NULL,
  cpf               VARCHAR(14),
  data_nascimento   DATE,
  cargo             VARCHAR(100),
  cbo_codigo        VARCHAR(7),
  departamento      VARCHAR(60),
  tipo_contrato     VARCHAR(20)   NOT NULL DEFAULT 'CLT'
                    CHECK (tipo_contrato IN ('CLT','PJ','Estágio','Aprendiz','Terceirizado','Temporário')),
  situacao          VARCHAR(20)   NOT NULL DEFAULT 'Em experiência'
                    CHECK (situacao IN ('Ativo','Afastado','Demitido','Férias','Em experiência')),
  data_admissao     DATE          NOT NULL,
  data_demissao     DATE,
  salario_base      NUMERIC(12,2),
  observacoes       TEXT,
  metadata          JSONB         DEFAULT '{}',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rh_func_company ON rh_funcionarios(company_id);
CREATE INDEX IF NOT EXISTS idx_rh_func_situacao ON rh_funcionarios(company_id, situacao);

-- ────────────────────────────────────────────────────────────
-- 2. rh_folha_pagamentos — Folha mensal por colaborador
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rh_folha_pagamentos (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  funcionario_id            UUID          NOT NULL REFERENCES rh_funcionarios(id) ON DELETE CASCADE,
  competencia               DATE          NOT NULL,
  salario_bruto             NUMERIC(12,2) NOT NULL,
  desconto_inss             NUMERIC(10,2) NOT NULL DEFAULT 0,
  desconto_irpf             NUMERIC(10,2) NOT NULL DEFAULT 0,
  desconto_outros           NUMERIC(10,2) NOT NULL DEFAULT 0,
  outros_descricao          TEXT,
  adicional_hrs_extras      NUMERIC(10,2) NOT NULL DEFAULT 0,
  adicional_outros          NUMERIC(10,2) NOT NULL DEFAULT 0,
  outros_adicional_descricao TEXT,
  salario_liquido           NUMERIC(12,2) NOT NULL,
  fgts_competencia          NUMERIC(10,2) NOT NULL DEFAULT 0,
  status                    VARCHAR(20)   NOT NULL DEFAULT 'Calculado'
                            CHECK (status IN ('Calculado','Aprovado','Pago','Cancelado')),
  data_pagamento            DATE,
  observacoes               TEXT,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rh_folha_company     ON rh_folha_pagamentos(company_id);
CREATE INDEX IF NOT EXISTS idx_rh_folha_competencia ON rh_folha_pagamentos(company_id, competencia DESC);
CREATE INDEX IF NOT EXISTS idx_rh_folha_func        ON rh_folha_pagamentos(funcionario_id);

-- ────────────────────────────────────────────────────────────
-- 3. Triggers updated_at
-- ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_rh_func_upd ON rh_funcionarios;
CREATE TRIGGER trg_rh_func_upd
  BEFORE UPDATE ON rh_funcionarios
  FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();

DROP TRIGGER IF EXISTS trg_rh_folha_upd ON rh_folha_pagamentos;
CREATE TRIGGER trg_rh_folha_upd
  BEFORE UPDATE ON rh_folha_pagamentos
  FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 4. RLS — Company-scoped + admin bypass
-- ────────────────────────────────────────────────────────────
ALTER TABLE rh_funcionarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_folha_pagamentos   ENABLE ROW LEVEL SECURITY;

-- rh_funcionarios
DROP POLICY IF EXISTS "rh_func_sel" ON rh_funcionarios;
CREATE POLICY "rh_func_sel" ON rh_funcionarios
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "rh_func_ins" ON rh_funcionarios;
CREATE POLICY "rh_func_ins" ON rh_funcionarios
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "rh_func_upd" ON rh_funcionarios;
CREATE POLICY "rh_func_upd" ON rh_funcionarios
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

-- rh_folha_pagamentos
DROP POLICY IF EXISTS "rh_folha_sel" ON rh_folha_pagamentos;
CREATE POLICY "rh_folha_sel" ON rh_folha_pagamentos
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "rh_folha_ins" ON rh_folha_pagamentos;
CREATE POLICY "rh_folha_ins" ON rh_folha_pagamentos
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "rh_folha_upd" ON rh_folha_pagamentos;
CREATE POLICY "rh_folha_upd" ON rh_folha_pagamentos
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());
