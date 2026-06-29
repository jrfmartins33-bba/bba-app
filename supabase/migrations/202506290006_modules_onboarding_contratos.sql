-- ============================================================
-- BBA APP — MIGRATION 202506290006
-- Módulos: Onboarding de Clientes + Contratos de Serviço BBA
-- Tabelas operacionais — acesso row-level por company_id
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. client_companies
-- Cadastro completo das empresas clientes da BBA
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_companies (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  razao_social            VARCHAR(200)  NOT NULL,
  nome_fantasia           VARCHAR(200),
  cnpj                    VARCHAR(18)   UNIQUE,
  cpf                     VARCHAR(14),
  inscricao_estadual      VARCHAR(30),
  inscricao_municipal     VARCHAR(30),
  inscricao_suframa       VARCHAR(20),
  nire                    VARCHAR(20),

  regime_tributario       VARCHAR(10)   REFERENCES ref_regimes_tributarios(codigo),
  natureza_juridica       CHAR(4)       REFERENCES ref_naturezas_juridicas(codigo),
  cnae_principal          VARCHAR(9)    REFERENCES ref_cnae(codigo),
  porte                   VARCHAR(10)   CHECK (porte IN ('MEI','ME','EPP','Médio','Grande')),
  optante_simples         BOOLEAN       NOT NULL DEFAULT FALSE,
  optante_mei             BOOLEAN       NOT NULL DEFAULT FALSE,
  data_abertura           DATE,
  data_opcao_simples      DATE,
  receita_bruta_anual     NUMERIC(14,2),

  cep                     VARCHAR(9),
  logradouro              VARCHAR(200),
  numero                  VARCHAR(20),
  complemento             VARCHAR(100),
  bairro                  VARCHAR(100),
  municipio_codigo_ibge   CHAR(7)       REFERENCES ref_municipios(codigo_ibge),
  uf_sigla                CHAR(2)       REFERENCES ref_ufs(sigla),
  pais_codigo_bacen       CHAR(4)       REFERENCES ref_paises(codigo_bacen) DEFAULT '1058',

  email_principal         VARCHAR(200),
  email_contador          VARCHAR(200),
  telefone_principal      VARCHAR(20),
  whatsapp                VARCHAR(20),
  site                    VARCHAR(200),

  banco_codigo            CHAR(3)       REFERENCES ref_bancos(codigo_compe),
  banco_agencia           VARCHAR(10),
  banco_conta             VARCHAR(20),
  banco_tipo_conta        VARCHAR(20)   CHECK (banco_tipo_conta IN ('Corrente','Poupança','Pagamento')),
  banco_pix               VARCHAR(150),

  status                  VARCHAR(20)   NOT NULL DEFAULT 'Ativo'
                          CHECK (status IN ('Ativo','Inativo','Suspenso','Encerrado','Prospecto')),
  data_inicio_relacao     DATE,
  data_fim_relacao        DATE,

  tem_funcionarios        BOOLEAN       NOT NULL DEFAULT FALSE,
  quantidade_funcionarios SMALLINT      DEFAULT 0,
  tem_estoque             BOOLEAN       NOT NULL DEFAULT FALSE,
  tem_filiais             BOOLEAN       NOT NULL DEFAULT FALSE,
  emite_nfe               BOOLEAN       NOT NULL DEFAULT FALSE,
  emite_nfse              BOOLEAN       NOT NULL DEFAULT FALSE,
  emite_nfce              BOOLEAN       NOT NULL DEFAULT FALSE,

  observacoes             TEXT,
  tags                    TEXT[],
  metadata                JSONB         DEFAULT '{}',

  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE client_companies IS 'Cadastro completo de empresas clientes BBA — dados fiscais, endereço, bancários e operacionais.';

CREATE INDEX IF NOT EXISTS idx_client_companies_company ON client_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_client_companies_cnpj    ON client_companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_client_companies_regime  ON client_companies(regime_tributario);
CREATE INDEX IF NOT EXISTS idx_client_companies_status  ON client_companies(status);
CREATE INDEX IF NOT EXISTS idx_client_companies_uf      ON client_companies(uf_sigla);

-- ────────────────────────────────────────────────────────────
-- 2. client_socios
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_socios (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_company_id   UUID          NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,

  nome                VARCHAR(200)  NOT NULL,
  cpf                 VARCHAR(14)   NOT NULL,
  rg                  VARCHAR(20),
  data_nascimento     DATE,
  nacionalidade       VARCHAR(50)   DEFAULT 'Brasileira',

  tipo_socio          VARCHAR(30)   NOT NULL DEFAULT 'Sócio'
                      CHECK (tipo_socio IN (
                        'Sócio','Administrador','Sócio-Administrador',
                        'Sócio Investidor','Titular MEI','Acionista')),
  participacao_pct    NUMERIC(6,3),
  valor_quota         NUMERIC(14,2),
  data_entrada        DATE,
  data_saida          DATE,

  email               VARCHAR(200),
  telefone            VARCHAR(20),
  whatsapp            VARCHAR(20),

  cep                 VARCHAR(9),
  logradouro          VARCHAR(200),
  numero              VARCHAR(20),
  complemento         VARCHAR(100),
  bairro              VARCHAR(100),
  municipio_ibge      CHAR(7),
  uf_sigla            CHAR(2),

  recebe_pro_labore   BOOLEAN       NOT NULL DEFAULT FALSE,
  valor_pro_labore    NUMERIC(10,2),
  contribui_inss      BOOLEAN       NOT NULL DEFAULT TRUE,

  ativo               BOOLEAN       NOT NULL DEFAULT TRUE,
  observacoes         TEXT,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE client_socios IS 'Quadro societário dos clientes BBA.';
CREATE INDEX IF NOT EXISTS idx_client_socios_company ON client_socios(company_id);
CREATE INDEX IF NOT EXISTS idx_client_socios_cpf     ON client_socios(cpf);

-- ────────────────────────────────────────────────────────────
-- 3. client_cnaes_secundarios
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_cnaes_secundarios (
  id                  UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID      NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_company_id   UUID      NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,
  cnae_codigo         VARCHAR(9) NOT NULL REFERENCES ref_cnae(codigo),
  ordem               SMALLINT  NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_cnaes_company ON client_cnaes_secundarios(company_id);

-- ────────────────────────────────────────────────────────────
-- 4. client_documents
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_documents (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_company_id   UUID          REFERENCES client_companies(id) ON DELETE CASCADE,

  tipo_documento      VARCHAR(60)   NOT NULL CHECK (tipo_documento IN (
                        'Contrato Social','Alteração Contratual','Certificado MEI',
                        'Certidão Negativa Federal','Certidão Negativa Estadual',
                        'Certidão Negativa Municipal','Certidão Negativa FGTS',
                        'Certidão Negativa Trabalhista','Certificado Digital A1',
                        'Certificado Digital A3','Alvará de Funcionamento',
                        'Licença Sanitária','Licença Ambiental',
                        'Contrato de Prestação de Serviço','Procuração',
                        'Comprovante de Endereço','Comprovante Bancário',
                        'Declaração','Relatório','Outros')),
  nome                VARCHAR(300)  NOT NULL,
  descricao           TEXT,

  arquivo_url         TEXT,
  arquivo_nome        VARCHAR(200),
  arquivo_tamanho     INTEGER,
  arquivo_mime        VARCHAR(100),

  data_emissao        DATE,
  data_validade       DATE,
  data_vencimento     DATE,
  esta_vencido        BOOLEAN GENERATED ALWAYS AS (
                        data_validade IS NOT NULL AND data_validade < CURRENT_DATE
                      ) STORED,

  status              VARCHAR(20)   NOT NULL DEFAULT 'Ativo'
                      CHECK (status IN ('Ativo','Vencido','Cancelado','Em renovação','Pendente')),

  numero_documento    VARCHAR(100),
  orgao_emissor       VARCHAR(100),
  observacoes         TEXT,
  tags                TEXT[],

  created_by          UUID          REFERENCES profiles(id),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE client_documents IS 'Documentos, certidões e certificados dos clientes BBA.';
CREATE INDEX IF NOT EXISTS idx_client_documents_company  ON client_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_tipo     ON client_documents(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_client_documents_validade ON client_documents(data_validade);
CREATE INDEX IF NOT EXISTS idx_client_documents_status   ON client_documents(status);

-- ────────────────────────────────────────────────────────────
-- 5. service_contracts
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_contracts (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                  UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  numero_contrato             VARCHAR(30)   NOT NULL UNIQUE,
  titulo                      VARCHAR(200)  NOT NULL,

  tipo_contrato               VARCHAR(30)   NOT NULL DEFAULT 'Recorrente'
                              CHECK (tipo_contrato IN (
                                'Recorrente','Projeto','Avulso','Consultoria Pontual')),
  area_bba                    VARCHAR(20)   CHECK (area_bba IN (
                                'Financas','TI','Governanca','RH','Multi')),

  valor_mensal                NUMERIC(12,2),
  valor_total                 NUMERIC(12,2),
  moeda                       CHAR(3)       NOT NULL DEFAULT 'BRL',
  dia_vencimento              SMALLINT      CHECK (dia_vencimento BETWEEN 1 AND 31),
  forma_pagamento             VARCHAR(30)   CHECK (forma_pagamento IN (
                                'PIX','Boleto','Transferência','Cartão','Débito Automático')),

  data_inicio                 DATE          NOT NULL,
  data_fim                    DATE,
  duracao_meses               SMALLINT,
  renovacao_automatica        BOOLEAN       NOT NULL DEFAULT TRUE,
  prazo_aviso_rescisao_dias   SMALLINT      DEFAULT 30,

  indice_reajuste             VARCHAR(10)   CHECK (indice_reajuste IN (
                                'IPCA','IGPM','INPC','SELIC','Fixo','Negociado')),
  percentual_reajuste         NUMERIC(5,2),
  mes_reajuste                SMALLINT      CHECK (mes_reajuste BETWEEN 1 AND 12),

  status                      VARCHAR(20)   NOT NULL DEFAULT 'Ativo'
                              CHECK (status IN (
                                'Proposta','Ativo','Suspenso','Encerrado','Cancelado')),
  data_assinatura             DATE,
  responsavel_bba_id          UUID          REFERENCES profiles(id),

  contrato_url                TEXT,
  proposta_url                TEXT,
  observacoes                 TEXT,
  clausulas_especiais         TEXT,
  metadata                    JSONB         DEFAULT '{}',

  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE service_contracts IS 'Contratos de prestação de serviço BBA × cliente.';
CREATE INDEX IF NOT EXISTS idx_service_contracts_company ON service_contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_status  ON service_contracts(status);
CREATE INDEX IF NOT EXISTS idx_service_contracts_area    ON service_contracts(area_bba);
CREATE INDEX IF NOT EXISTS idx_service_contracts_numero  ON service_contracts(numero_contrato);

-- ────────────────────────────────────────────────────────────
-- 6. service_scope_items
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_scope_items (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_id         UUID          NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,

  area_bba            VARCHAR(20)   CHECK (area_bba IN ('Financas','TI','Governanca','RH','Multi')),
  categoria           VARCHAR(60)   NOT NULL,
  descricao           VARCHAR(400)  NOT NULL,
  periodicidade       VARCHAR(20)   CHECK (periodicidade IN (
                        'Mensal','Trimestral','Semestral','Anual','Pontual','Sob demanda')),
  tipo_entregavel     VARCHAR(50),
  sla_dias            SMALLINT,
  incluso_no_valor    BOOLEAN       NOT NULL DEFAULT TRUE,
  valor_adicional     NUMERIC(10,2) DEFAULT 0,
  ativo               BOOLEAN       NOT NULL DEFAULT TRUE,
  ordem               SMALLINT      NOT NULL DEFAULT 1,
  observacoes         TEXT,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE service_scope_items IS 'Itens de escopo detalhado por contrato BBA.';
CREATE INDEX IF NOT EXISTS idx_scope_items_contract ON service_scope_items(contract_id);
CREATE INDEX IF NOT EXISTS idx_scope_items_company  ON service_scope_items(company_id);

-- ────────────────────────────────────────────────────────────
-- 7. onboarding_checklist
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_checklist (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  etapa               VARCHAR(30)   NOT NULL CHECK (etapa IN (
                        'Cadastro','Documentação','Acesso','Fiscal',
                        'Financeiro','Trabalhista','TI','Contrato',
                        'Treinamento','Conclusão')),
  titulo              VARCHAR(200)  NOT NULL,
  descricao           TEXT,
  obrigatorio         BOOLEAN       NOT NULL DEFAULT TRUE,
  ordem               SMALLINT      NOT NULL DEFAULT 1,

  status              VARCHAR(20)   NOT NULL DEFAULT 'Pendente'
                      CHECK (status IN (
                        'Pendente','Em andamento','Concluído','Bloqueado','N/A')),
  data_conclusao      TIMESTAMPTZ,
  concluido_por       UUID          REFERENCES profiles(id),
  prazo_dias          SMALLINT,
  data_limite         DATE,
  observacoes         TEXT,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE onboarding_checklist IS 'Checklist de onboarding por cliente BBA.';
CREATE INDEX IF NOT EXISTS idx_onboarding_company ON onboarding_checklist(company_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_status  ON onboarding_checklist(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_etapa   ON onboarding_checklist(etapa);

-- ────────────────────────────────────────────────────────────
-- TRIGGER updated_at
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION bba_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_client_companies_upd  BEFORE UPDATE ON client_companies    FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();
CREATE TRIGGER trg_client_socios_upd     BEFORE UPDATE ON client_socios        FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();
CREATE TRIGGER trg_client_documents_upd  BEFORE UPDATE ON client_documents     FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();
CREATE TRIGGER trg_service_contracts_upd BEFORE UPDATE ON service_contracts    FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();
CREATE TRIGGER trg_service_scope_upd     BEFORE UPDATE ON service_scope_items  FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();
CREATE TRIGGER trg_onboarding_upd        BEFORE UPDATE ON onboarding_checklist FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE client_companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_socios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_cnaes_secundarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_contracts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_scope_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_checklist     ENABLE ROW LEVEL SECURITY;

-- Política helper: usuário enxerga a company_id da sua profile
CREATE POLICY "client_companies_sel" ON client_companies    FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "client_companies_ins" ON client_companies    FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "client_companies_upd" ON client_companies    FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "client_socios_sel"    ON client_socios       FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "client_socios_ins"    ON client_socios       FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "client_socios_upd"    ON client_socios       FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "client_cnaes_sel"     ON client_cnaes_secundarios FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "client_cnaes_ins"     ON client_cnaes_secundarios FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "client_docs_sel"      ON client_documents    FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "client_docs_ins"      ON client_documents    FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "client_docs_upd"      ON client_documents    FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "svc_contracts_sel"    ON service_contracts   FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "svc_contracts_ins"    ON service_contracts   FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "svc_contracts_upd"    ON service_contracts   FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "svc_scope_sel"        ON service_scope_items FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "svc_scope_ins"        ON service_scope_items FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "svc_scope_upd"        ON service_scope_items FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "onboarding_sel"       ON onboarding_checklist FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "onboarding_ins"       ON onboarding_checklist FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "onboarding_upd"       ON onboarding_checklist FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
