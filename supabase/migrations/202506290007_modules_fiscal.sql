-- ============================================================
-- BBA APP — MIGRATION 202506290007
-- Módulo Fiscal: Obrigações, Guias, Notas Fiscais
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. fiscal_obrigacoes
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_obrigacoes (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  tipo                VARCHAR(30)   NOT NULL CHECK (tipo IN (
                        'DCTF','DCTF-WEB','ECD','ECF','EFD-ICMS-IPI',
                        'EFD-Contribuicoes','SPED-Fiscal','SPED-Contabil',
                        'PGDAS-D','DASN-SIMEI','DEFIS','DIRF','DIMOB',
                        'RAIS','CAGED','eSocial','DCTFWeb-eSocial',
                        'GIA','GIA-ST','DIEF','DeSTDA','DES','DAMSP',
                        'NFSE-Mensal','Livro-ISS','Declaracao','Relatorio','Outras')),
  nome                VARCHAR(200)  NOT NULL,
  descricao           TEXT,

  competencia         DATE          NOT NULL,
  data_vencimento     DATE          NOT NULL,
  data_transmissao    TIMESTAMPTZ,
  data_retificacao    TIMESTAMPTZ,

  status              VARCHAR(20)   NOT NULL DEFAULT 'Pendente'
                      CHECK (status IN (
                        'Pendente','Em andamento','Transmitida','Retificada',
                        'Dispensada','Atrasada','Cancelada')),
  esta_atrasada       BOOLEAN NOT NULL DEFAULT FALSE,

  numero_recibo       VARCHAR(100),
  numero_protocolo    VARCHAR(100),
  hash_arquivo        VARCHAR(100),
  arquivo_url         TEXT,
  arquivo_nome        VARCHAR(200),
  responsavel_id      UUID          REFERENCES profiles(id),
  observacoes         TEXT,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fiscal_obrigacoes IS 'Controle de obrigações acessórias e principais por empresa e competência.';

CREATE INDEX IF NOT EXISTS idx_fobrig_company     ON fiscal_obrigacoes(company_id);
CREATE INDEX IF NOT EXISTS idx_fobrig_tipo        ON fiscal_obrigacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_fobrig_competencia ON fiscal_obrigacoes(competencia);
CREATE INDEX IF NOT EXISTS idx_fobrig_vencimento  ON fiscal_obrigacoes(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fobrig_status      ON fiscal_obrigacoes(status);

-- ────────────────────────────────────────────────────────────
-- 2. fiscal_guias
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_guias (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  tipo_guia           VARCHAR(20)   NOT NULL CHECK (tipo_guia IN (
                        'DARF','GPS','DAS','DAS-MEI','GNRE',
                        'DAE','DARE','DAM','TED','Outros')),
  tributo             VARCHAR(60)   NOT NULL,
  codigo_receita      VARCHAR(10),

  competencia         DATE          NOT NULL,
  data_vencimento     DATE          NOT NULL,
  data_pagamento      DATE,

  valor_principal     NUMERIC(14,2) NOT NULL,
  valor_multa         NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_juros         NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total         NUMERIC(14,2) GENERATED ALWAYS AS (
                        valor_principal + valor_multa + valor_juros
                      ) STORED,

  status              VARCHAR(20)   NOT NULL DEFAULT 'Pendente'
                      CHECK (status IN (
                        'Pendente','Pago','Atrasado','Cancelado','Parcelado','Compensado')),
  esta_atrasada       BOOLEAN NOT NULL DEFAULT FALSE,

  banco_pagamento     VARCHAR(60),
  agencia_pagamento   VARCHAR(10),
  numero_autenticacao VARCHAR(100),
  comprovante_url     TEXT,
  linha_digitavel     VARCHAR(60),
  codigo_barras       VARCHAR(60),

  obrigacao_id        UUID          REFERENCES fiscal_obrigacoes(id),
  observacoes         TEXT,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fiscal_guias IS 'Guias de recolhimento: DARF, GPS, DAS, DAS-MEI, GNRE. Controle de pagamento e status.';

CREATE INDEX IF NOT EXISTS idx_fguias_company     ON fiscal_guias(company_id);
CREATE INDEX IF NOT EXISTS idx_fguias_tipo        ON fiscal_guias(tipo_guia);
CREATE INDEX IF NOT EXISTS idx_fguias_tributo     ON fiscal_guias(tributo);
CREATE INDEX IF NOT EXISTS idx_fguias_competencia ON fiscal_guias(competencia);
CREATE INDEX IF NOT EXISTS idx_fguias_vencimento  ON fiscal_guias(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fguias_status      ON fiscal_guias(status);

-- ────────────────────────────────────────────────────────────
-- 3. fiscal_notas_fiscais
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_notas_fiscais (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  tipo                      VARCHAR(10)   NOT NULL CHECK (tipo IN (
                              'NFE','NFSE','NFCE','CTE','MDFE','NFP','Outros')),
  modelo                    VARCHAR(5),
  serie                     VARCHAR(5),
  numero                    VARCHAR(15),
  natureza_operacao         VARCHAR(100),
  cfop                      VARCHAR(5)    REFERENCES ref_cfop(codigo),

  direcao                   VARCHAR(10)   NOT NULL DEFAULT 'Emitida'
                            CHECK (direcao IN ('Emitida','Recebida')),
  data_emissao              DATE          NOT NULL,
  data_competencia          DATE,
  data_saida_entrada        DATE,

  -- Emitente
  emitente_cnpj             VARCHAR(18),
  emitente_cpf              VARCHAR(14),
  emitente_razao_social     VARCHAR(200),
  emitente_uf               CHAR(2),

  -- Destinatário
  destinatario_cnpj         VARCHAR(18),
  destinatario_cpf          VARCHAR(14),
  destinatario_razao_social VARCHAR(200),
  destinatario_uf           CHAR(2),

  -- Valores
  valor_produtos            NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_servicos            NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_frete               NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_seguro              NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_desconto            NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_outros              NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total               NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Tributos destacados
  base_calculo_icms         NUMERIC(14,2) DEFAULT 0,
  valor_icms                NUMERIC(12,2) DEFAULT 0,
  valor_icms_st             NUMERIC(12,2) DEFAULT 0,
  valor_ipi                 NUMERIC(12,2) DEFAULT 0,
  valor_pis                 NUMERIC(12,2) DEFAULT 0,
  valor_cofins              NUMERIC(12,2) DEFAULT 0,
  base_calculo_iss          NUMERIC(14,2) DEFAULT 0,
  valor_iss                 NUMERIC(12,2) DEFAULT 0,
  valor_irrf                NUMERIC(12,2) DEFAULT 0,
  valor_inss_retido         NUMERIC(12,2) DEFAULT 0,
  valor_pcc_retido          NUMERIC(12,2) DEFAULT 0,

  -- Chave e status SEFAZ/prefeitura
  chave_acesso              VARCHAR(50)   UNIQUE,   -- chave 44 dígitos NF-e
  numero_rps                VARCHAR(20),             -- RPS NFS-e
  numero_nfse               VARCHAR(20),             -- número NFS-e gerada
  codigo_verificacao        VARCHAR(20),             -- NFS-e
  link_consulta             TEXT,

  status_sefaz              VARCHAR(20)   NOT NULL DEFAULT 'Emitida'
                            CHECK (status_sefaz IN (
                              'Emitida','Autorizada','Cancelada','Denegada',
                              'Inutilizada','Em processamento','Pendente')),

  -- Regime tributário e CSTs
  regime_tributario_nf      VARCHAR(10),
  cst_icms                  VARCHAR(3),
  csosn                     VARCHAR(3),
  cst_pis                   VARCHAR(3),
  cst_cofins                VARCHAR(3),
  origem_mercadoria         CHAR(1),
  modalidade_frete          CHAR(1),

  -- Arquivos
  xml_url                   TEXT,
  danfe_url                 TEXT,
  pdf_url                   TEXT,

  -- Observações
  informacoes_adicionais    TEXT,
  observacoes_internas      TEXT,

  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fiscal_notas_fiscais IS 'NF-e, NFS-e, NFC-e emitidas e recebidas. Controle completo de chaves, status SEFAZ e valores tributários.';

CREATE INDEX IF NOT EXISTS idx_fnf_company     ON fiscal_notas_fiscais(company_id);
CREATE INDEX IF NOT EXISTS idx_fnf_tipo        ON fiscal_notas_fiscais(tipo);
CREATE INDEX IF NOT EXISTS idx_fnf_direcao     ON fiscal_notas_fiscais(direcao);
CREATE INDEX IF NOT EXISTS idx_fnf_emissao     ON fiscal_notas_fiscais(data_emissao);
CREATE INDEX IF NOT EXISTS idx_fnf_competencia ON fiscal_notas_fiscais(data_competencia);
CREATE INDEX IF NOT EXISTS idx_fnf_status      ON fiscal_notas_fiscais(status_sefaz);
CREATE INDEX IF NOT EXISTS idx_fnf_chave       ON fiscal_notas_fiscais(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_fnf_emit_cnpj   ON fiscal_notas_fiscais(emitente_cnpj);
CREATE INDEX IF NOT EXISTS idx_fnf_dest_cnpj   ON fiscal_notas_fiscais(destinatario_cnpj);

-- ────────────────────────────────────────────────────────────
-- 4. fiscal_parcelamentos
-- Controle de parcelamentos tributários (REFIS, PERT, etc.)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_parcelamentos (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  programa            VARCHAR(60)   NOT NULL,   -- ex: REFIS, PERT, Parcelamento Ordinário
  tributo             VARCHAR(60)   NOT NULL,
  numero_processo     VARCHAR(50),
  orgao               VARCHAR(30)   CHECK (orgao IN ('Receita Federal','PGFN','Estadual','Municipal')),

  data_adesao         DATE          NOT NULL,
  valor_total_debito  NUMERIC(14,2) NOT NULL,
  valor_entrada       NUMERIC(12,2) DEFAULT 0,
  quantidade_parcelas SMALLINT      NOT NULL,
  valor_parcela       NUMERIC(12,2) NOT NULL,
  dia_vencimento      SMALLINT      CHECK (dia_vencimento BETWEEN 1 AND 31),

  parcelas_pagas      SMALLINT      NOT NULL DEFAULT 0,
  parcelas_restantes  SMALLINT GENERATED ALWAYS AS (
                        quantidade_parcelas - parcelas_pagas
                      ) STORED,
  valor_pago          NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_saldo         NUMERIC(14,2) GENERATED ALWAYS AS (
                        valor_total_debito - valor_pago
                      ) STORED,

  status              VARCHAR(20)   NOT NULL DEFAULT 'Ativo'
                      CHECK (status IN (
                        'Ativo','Quitado','Excluído','Suspenso','Rescindido')),
  observacoes         TEXT,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fiscal_parcelamentos IS 'Controle de parcelamentos tributários: REFIS, PERT, parcelamentos estaduais e municipais.';

CREATE INDEX IF NOT EXISTS idx_fparc_company ON fiscal_parcelamentos(company_id);
CREATE INDEX IF NOT EXISTS idx_fparc_status  ON fiscal_parcelamentos(status);

-- ────────────────────────────────────────────────────────────
-- 5. fiscal_calendario
-- Calendário de obrigações recorrentes por regime tributário
-- Seed com obrigações padrão 2025
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_calendario (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  regime_tributario   VARCHAR(10)   REFERENCES ref_regimes_tributarios(codigo),
  obrigacao           VARCHAR(60)   NOT NULL,
  periodicidade       VARCHAR(20)   NOT NULL CHECK (periodicidade IN (
                        'Mensal','Trimestral','Semestral','Anual','Eventual')),
  mes_referencia      SMALLINT      CHECK (mes_referencia BETWEEN 1 AND 12),
  dia_vencimento      SMALLINT      CHECK (dia_vencimento BETWEEN 1 AND 31),
  descricao_vencimento VARCHAR(200),
  orgao_entrega       VARCHAR(30),
  base_legal          VARCHAR(100),
  ativo               BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fiscal_calendario IS 'Calendário de obrigações acessórias por regime tributário — referência para geração automática de tarefas.';

INSERT INTO fiscal_calendario (regime_tributario, obrigacao, periodicidade, dia_vencimento, descricao_vencimento, orgao_entrega, base_legal) VALUES
-- MEI
('MEI','DAS-MEI',           'Mensal',    20, 'Dia 20 do mês seguinte', 'Receita Federal', 'LC 123/2006'),
('MEI','DASN-SIMEI',        'Anual',     31, '31 de maio do ano seguinte (ano-base anterior)', 'Receita Federal', 'Res. CGSN 140/2018'),
-- Simples Nacional
('SN','PGDAS-D',            'Mensal',    20, 'Dia 20 do mês seguinte', 'Receita Federal', 'Res. CGSN 140/2018'),
('SN','DAS',                'Mensal',    20, 'Dia 20 do mês seguinte', 'Receita Federal', 'LC 123/2006'),
('SN','DEFIS',              'Anual',     31, '31 de março do ano seguinte', 'Receita Federal', 'Res. CGSN 140/2018'),
('SN','DeSTDA',             'Mensal',    20, 'Dia 20 do mês seguinte (ICMS-ST quando houver)', 'SEFAZ', 'ATO COTEPE ICMS 47/2015'),
-- Lucro Presumido
('LP','DARF-IRPJ',          'Trimestral',NULL,'Último dia útil do mês seguinte ao trimestre', 'Receita Federal', 'Art. 3 Lei 9.249/1995'),
('LP','DARF-CSLL',          'Trimestral',NULL,'Último dia útil do mês seguinte ao trimestre', 'Receita Federal', 'Lei 7.689/1988'),
('LP','DARF-PIS',           'Mensal',    25, 'Dia 25 do mês seguinte', 'Receita Federal', 'Lei 9.715/1998'),
('LP','DARF-COFINS',        'Mensal',    25, 'Dia 25 do mês seguinte', 'Receita Federal', 'Lei 9.718/1998'),
('LP','DCTF',               'Mensal',    15, 'Dia 15 do 2º mês subsequente', 'Receita Federal', 'IN RFB 2.005/2021'),
('LP','ECD',                'Anual',     31, '31 de julho do ano seguinte', 'Receita Federal/SPED', 'IN RFB 2.003/2021'),
('LP','ECF',                'Anual',     31, '31 de julho do ano seguinte', 'Receita Federal/SPED', 'IN RFB 2.004/2021'),
-- Lucro Real
('LR','DARF-IRPJ',          'Mensal',    NULL,'Último dia útil do mês seguinte (estimativa mensal)', 'Receita Federal', 'Art. 3 Lei 9.249/1995'),
('LR','DARF-CSLL',          'Mensal',    NULL,'Último dia útil do mês seguinte', 'Receita Federal', 'Lei 7.689/1988'),
('LR','DARF-PIS',           'Mensal',    25, 'Dia 25 do mês seguinte', 'Receita Federal', 'Lei 10.637/2002'),
('LR','DARF-COFINS',        'Mensal',    25, 'Dia 25 do mês seguinte', 'Receita Federal', 'Lei 10.833/2003'),
('LR','EFD-Contribuicoes',  'Mensal',    10, 'Dia 10 do 2º mês subsequente', 'Receita Federal/SPED', 'IN RFB 1.252/2012'),
('LR','EFD-ICMS-IPI',       'Mensal',    15, 'Dia 15 do mês seguinte (varia por UF)', 'SEFAZ/SPED', 'ATO COTEPE ICMS 09/2008'),
('LR','ECD',                'Anual',     31, '31 de julho do ano seguinte', 'Receita Federal/SPED', 'IN RFB 2.003/2021'),
('LR','ECF',                'Anual',     31, '31 de julho do ano seguinte', 'Receita Federal/SPED', 'IN RFB 2.004/2021'),
('LR','DCTF',               'Mensal',    15, 'Dia 15 do 2º mês subsequente', 'Receita Federal', 'IN RFB 2.005/2021'),
-- Obrigações trabalhistas (todos os regimes com empregados)
(NULL,'eSocial',            'Mensal',    7,  'Dia 7 do mês seguinte (folha de pagamento)', 'eSocial/Receita Federal', 'Decreto 8.373/2014'),
(NULL,'DCTFWeb-eSocial',    'Mensal',    15, 'Dia 15 do mês seguinte', 'Receita Federal', 'IN RFB 2.005/2021'),
(NULL,'FGTS-GPS',           'Mensal',    7,  'Dia 7 do mês seguinte', 'Caixa Econômica Federal', 'Lei 8.036/1990'),
(NULL,'RAIS',               'Anual',     NULL,'Março/abril do ano seguinte (data RAIS)', 'MTE', 'Decreto 76.900/1975'),
(NULL,'DIRF',               'Anual',     28, '28 de fevereiro do ano seguinte', 'Receita Federal', 'IN RFB 1.990/2020'),
(NULL,'CAGED',              'Mensal',    7,  'Dia 7 do mês seguinte (admissões/demissões do mês)', 'MTE/CAGED', 'Lei 4.923/1965')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- TRIGGERS updated_at
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER trg_fobrig_upd  BEFORE UPDATE ON fiscal_obrigacoes   FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();
CREATE TRIGGER trg_fguias_upd  BEFORE UPDATE ON fiscal_guias        FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();
CREATE TRIGGER trg_fnf_upd     BEFORE UPDATE ON fiscal_notas_fiscais FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();
CREATE TRIGGER trg_fparc_upd   BEFORE UPDATE ON fiscal_parcelamentos FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE fiscal_obrigacoes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_guias         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_parcelamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_calendario    ENABLE ROW LEVEL SECURITY;

-- Obrigações
CREATE POLICY "fobrig_sel" ON fiscal_obrigacoes FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fobrig_ins" ON fiscal_obrigacoes FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fobrig_upd" ON fiscal_obrigacoes FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Guias
CREATE POLICY "fguias_sel" ON fiscal_guias FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fguias_ins" ON fiscal_guias FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fguias_upd" ON fiscal_guias FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Notas Fiscais
CREATE POLICY "fnf_sel" ON fiscal_notas_fiscais FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fnf_ins" ON fiscal_notas_fiscais FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fnf_upd" ON fiscal_notas_fiscais FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Parcelamentos
CREATE POLICY "fparc_sel" ON fiscal_parcelamentos FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fparc_ins" ON fiscal_parcelamentos FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fparc_upd" ON fiscal_parcelamentos FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Calendário: leitura pública para autenticados
CREATE POLICY "fcal_sel"   ON fiscal_calendario FOR SELECT TO authenticated USING (true);
