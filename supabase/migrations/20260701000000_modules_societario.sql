-- ============================================================
-- BBA APP — Módulo Societário
-- Tabelas: sócios, capital social, alterações, assembleias
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. societario_socios — Quadro societário
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS societario_socios (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome                    VARCHAR(150)  NOT NULL,
  cpf_cnpj                VARCHAR(18),
  tipo                    VARCHAR(2)    NOT NULL DEFAULT 'PF'
                          CHECK (tipo IN ('PF','PJ')),
  nacionalidade           VARCHAR(60)   DEFAULT 'Brasileira',
  profissao               VARCHAR(100),
  estado_civil            VARCHAR(20)
                          CHECK (estado_civil IN ('Solteiro','Casado','Divorciado','Viúvo','União estável','Separado')),
  percentual_participacao NUMERIC(7,4)  NOT NULL DEFAULT 0,
  valor_cotas             NUMERIC(14,2) NOT NULL DEFAULT 0,
  numero_cotas            INTEGER,
  data_entrada            DATE          NOT NULL,
  data_saida              DATE,
  status                  VARCHAR(20)   NOT NULL DEFAULT 'Ativo'
                          CHECK (status IN ('Ativo','Cedente','Falecido','Excluído')),
  observacoes             TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_socios_company  ON societario_socios(company_id);
CREATE INDEX IF NOT EXISTS idx_soc_socios_status   ON societario_socios(company_id, status);

-- ────────────────────────────────────────────────────────────
-- 2. societario_capital_social — Histórico de capital
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS societario_capital_social (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  valor_total          NUMERIC(14,2) NOT NULL,
  valor_integralizado  NUMERIC(14,2) NOT NULL DEFAULT 0,
  moeda                VARCHAR(10)   NOT NULL DEFAULT 'BRL',
  data_referencia      DATE          NOT NULL,
  observacoes          TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_capital_company ON societario_capital_social(company_id);

-- ────────────────────────────────────────────────────────────
-- 3. societario_alteracoes — Alterações contratuais
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS societario_alteracoes (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tipo              VARCHAR(40)   NOT NULL
                    CHECK (tipo IN (
                      'Constituição','Alteração','Consolidação','Distrato',
                      'Transferência de Cotas','Aumento de Capital','Redução de Capital',
                      'Mudança de Objeto Social','Mudança de Endereço','Mudança de Nome'
                    )),
  numero_alteracao  INTEGER,
  data_assinatura   DATE,
  data_registro     DATE,
  nire              VARCHAR(20),
  junta_comercial   VARCHAR(80),
  descricao         TEXT,
  status            VARCHAR(20)   NOT NULL DEFAULT 'Em elaboração'
                    CHECK (status IN ('Em elaboração','Assinado','Registrado','Arquivado')),
  observacoes       TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_alt_company ON societario_alteracoes(company_id);
CREATE INDEX IF NOT EXISTS idx_soc_alt_data    ON societario_alteracoes(company_id, data_assinatura DESC);

-- ────────────────────────────────────────────────────────────
-- 4. societario_assembleias — Assembleias e reuniões
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS societario_assembleias (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tipo                VARCHAR(30)   NOT NULL
                      CHECK (tipo IN ('AGO','AGE','Reunião de Diretoria','Reunião de Sócios','Outros')),
  data_convocacao     DATE,
  data_realizacao     DATE          NOT NULL,
  pauta               TEXT,
  deliberacoes        TEXT,
  quorum_percentual   NUMERIC(5,2),
  status              VARCHAR(20)   NOT NULL DEFAULT 'Convocada'
                      CHECK (status IN ('Convocada','Realizada','Cancelada')),
  observacoes         TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_asm_company ON societario_assembleias(company_id);
CREATE INDEX IF NOT EXISTS idx_soc_asm_data    ON societario_assembleias(company_id, data_realizacao DESC);

-- ────────────────────────────────────────────────────────────
-- 5. Triggers updated_at
-- ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_soc_socios_upd ON societario_socios;
CREATE TRIGGER trg_soc_socios_upd
  BEFORE UPDATE ON societario_socios
  FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();

DROP TRIGGER IF EXISTS trg_soc_capital_upd ON societario_capital_social;
CREATE TRIGGER trg_soc_capital_upd
  BEFORE UPDATE ON societario_capital_social
  FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();

DROP TRIGGER IF EXISTS trg_soc_alt_upd ON societario_alteracoes;
CREATE TRIGGER trg_soc_alt_upd
  BEFORE UPDATE ON societario_alteracoes
  FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();

DROP TRIGGER IF EXISTS trg_soc_asm_upd ON societario_assembleias;
CREATE TRIGGER trg_soc_asm_upd
  BEFORE UPDATE ON societario_assembleias
  FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 6. RLS — Company-scoped + is_bba_admin() bypass
-- ────────────────────────────────────────────────────────────
ALTER TABLE societario_socios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE societario_capital_social  ENABLE ROW LEVEL SECURITY;
ALTER TABLE societario_alteracoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE societario_assembleias     ENABLE ROW LEVEL SECURITY;

-- societario_socios
DROP POLICY IF EXISTS "soc_socios_sel" ON societario_socios;
CREATE POLICY "soc_socios_sel" ON societario_socios
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "soc_socios_ins" ON societario_socios;
CREATE POLICY "soc_socios_ins" ON societario_socios
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "soc_socios_upd" ON societario_socios;
CREATE POLICY "soc_socios_upd" ON societario_socios
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

-- societario_capital_social
DROP POLICY IF EXISTS "soc_capital_sel" ON societario_capital_social;
CREATE POLICY "soc_capital_sel" ON societario_capital_social
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "soc_capital_ins" ON societario_capital_social;
CREATE POLICY "soc_capital_ins" ON societario_capital_social
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "soc_capital_upd" ON societario_capital_social;
CREATE POLICY "soc_capital_upd" ON societario_capital_social
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

-- societario_alteracoes
DROP POLICY IF EXISTS "soc_alt_sel" ON societario_alteracoes;
CREATE POLICY "soc_alt_sel" ON societario_alteracoes
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "soc_alt_ins" ON societario_alteracoes;
CREATE POLICY "soc_alt_ins" ON societario_alteracoes
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "soc_alt_upd" ON societario_alteracoes;
CREATE POLICY "soc_alt_upd" ON societario_alteracoes
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

-- societario_assembleias
DROP POLICY IF EXISTS "soc_asm_sel" ON societario_assembleias;
CREATE POLICY "soc_asm_sel" ON societario_assembleias
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "soc_asm_ins" ON societario_assembleias;
CREATE POLICY "soc_asm_ins" ON societario_assembleias
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "soc_asm_upd" ON societario_assembleias;
CREATE POLICY "soc_asm_upd" ON societario_assembleias
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());
