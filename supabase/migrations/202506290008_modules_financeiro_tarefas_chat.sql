-- ============================================================
-- BBA APP — MIGRATION 202506290008
-- Módulos: Financeiro, Tarefas (extensão), Chat (extensão),
-- Notificações, Relatórios e Audit Log
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. financial_contas
-- Plano de contas e contas bancárias por empresa
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_contas (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Classificação
  tipo                VARCHAR(20)   NOT NULL CHECK (tipo IN (
                        'Conta Bancária','Caixa','Cartão Crédito',
                        'Cartão Débito','Conta Digital','Investimento',
                        'Conta Poupança','Outros')),
  nome                VARCHAR(100)  NOT NULL,
  descricao           TEXT,

  -- Dados bancários
  banco_codigo        CHAR(3)       REFERENCES ref_bancos(codigo_compe),
  banco_nome          VARCHAR(80),
  agencia             VARCHAR(10),
  numero_conta        VARCHAR(30),
  tipo_conta          VARCHAR(20)   CHECK (tipo_conta IN ('Corrente','Poupança','Pagamento')),
  pix_chave           VARCHAR(150),
  pix_tipo_chave      VARCHAR(20)   CHECK (pix_tipo_chave IN ('CPF','CNPJ','Email','Telefone','Aleatória')),

  -- Saldos
  saldo_inicial       NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_atual         NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_saldo_inicial  DATE,

  -- Cartão de crédito (quando aplicável)
  limite_cartao       NUMERIC(12,2),
  dia_fechamento      SMALLINT      CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento      SMALLINT      CHECK (dia_vencimento BETWEEN 1 AND 31),

  -- Status
  ativa               BOOLEAN       NOT NULL DEFAULT TRUE,
  incluir_no_total    BOOLEAN       NOT NULL DEFAULT TRUE,
  cor                 VARCHAR(7),               -- hex color para UI
  icone               VARCHAR(50),              -- nome do ícone Lucide

  observacoes         TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE financial_contas IS 'Contas bancárias, caixas e cartões por empresa cliente BBA.';
CREATE INDEX IF NOT EXISTS idx_fin_contas_company ON financial_contas(company_id);
CREATE INDEX IF NOT EXISTS idx_fin_contas_tipo    ON financial_contas(tipo);

-- ────────────────────────────────────────────────────────────
-- 2. financial_categorias
-- Categorias de receitas e despesas (plano de contas simplificado)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_categorias (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          REFERENCES companies(id) ON DELETE CASCADE,

  tipo                VARCHAR(10)   NOT NULL CHECK (tipo IN ('Receita','Despesa','Transferência')),
  nome                VARCHAR(100)  NOT NULL,
  descricao           TEXT,
  categoria_pai_id    UUID          REFERENCES financial_categorias(id),
  nivel               SMALLINT      NOT NULL DEFAULT 1,
  cor                 VARCHAR(7),
  icone               VARCHAR(50),
  ativa               BOOLEAN       NOT NULL DEFAULT TRUE,
  ordem               SMALLINT      NOT NULL DEFAULT 1,
  is_sistema          BOOLEAN       NOT NULL DEFAULT FALSE,  -- categorias padrão BBA

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE financial_categorias IS 'Plano de contas simplificado — categorias de receitas e despesas.';
CREATE INDEX IF NOT EXISTS idx_fin_cat_company ON financial_categorias(company_id);
CREATE INDEX IF NOT EXISTS idx_fin_cat_tipo    ON financial_categorias(tipo);

-- Categorias padrão do sistema BBA (company_id NULL = global)
INSERT INTO financial_categorias (tipo, nome, is_sistema, ordem) VALUES
-- Receitas
('Receita','Receita de Serviços',     TRUE, 1),
('Receita','Receita de Vendas',       TRUE, 2),
('Receita','Receita Financeira',      TRUE, 3),
('Receita','Outras Receitas',         TRUE, 4),
-- Despesas operacionais
('Despesa','Folha de Pagamento',      TRUE, 10),
('Despesa','Encargos Trabalhistas',   TRUE, 11),
('Despesa','Fornecedores',            TRUE, 12),
('Despesa','Aluguel',                 TRUE, 13),
('Despesa','Serviços de Terceiros',   TRUE, 14),
('Despesa','Marketing e Publicidade', TRUE, 15),
('Despesa','Tecnologia e Software',   TRUE, 16),
('Despesa','Telefone e Internet',     TRUE, 17),
('Despesa','Água e Energia',          TRUE, 18),
('Despesa','Material de Escritório',  TRUE, 19),
('Despesa','Manutenção e Reparos',    TRUE, 20),
('Despesa','Fretes e Transporte',     TRUE, 21),
('Despesa','Viagens e Hospedagem',    TRUE, 22),
-- Despesas tributárias
('Despesa','Impostos Federais',       TRUE, 30),
('Despesa','Impostos Estaduais',      TRUE, 31),
('Despesa','Impostos Municipais',     TRUE, 32),
('Despesa','DAS / Simples Nacional',  TRUE, 33),
('Despesa','FGTS',                    TRUE, 34),
-- Despesas financeiras
('Despesa','Tarifas Bancárias',       TRUE, 40),
('Despesa','Juros e Multas',          TRUE, 41),
('Despesa','Antecipação de Recebíveis',TRUE,42),
-- Investimentos
('Despesa','Equipamentos e Hardware', TRUE, 50),
('Despesa','Software e Licenças',     TRUE, 51),
('Despesa','Obras e Benfeitorias',    TRUE, 52),
-- Outros
('Despesa','Pró-labore',              TRUE, 60),
('Despesa','Distribuição de Lucros',  TRUE, 61),
('Despesa','Outras Despesas',         TRUE, 99),
('Transferência','Transferência entre Contas', TRUE, 1);

-- ────────────────────────────────────────────────────────────
-- 3. financial_lancamentos
-- Lançamentos financeiros (receitas, despesas, transferências)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_lancamentos (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Tipo e categoria
  tipo                VARCHAR(15)   NOT NULL CHECK (tipo IN ('Receita','Despesa','Transferência')),
  categoria_id        UUID          REFERENCES financial_categorias(id),
  conta_id            UUID          REFERENCES financial_contas(id),
  conta_destino_id    UUID          REFERENCES financial_contas(id),  -- para transferências

  -- Dados do lançamento
  descricao           VARCHAR(300)  NOT NULL,
  valor               NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  data_competencia    DATE          NOT NULL,
  data_pagamento      DATE,

  -- Status
  status              VARCHAR(20)   NOT NULL DEFAULT 'Previsto'
                      CHECK (status IN ('Previsto','Realizado','Cancelado','Estornado')),
  efetivado           BOOLEAN GENERATED ALWAYS AS (data_pagamento IS NOT NULL) STORED,

  -- Recorrência
  recorrente          BOOLEAN       NOT NULL DEFAULT FALSE,
  frequencia          VARCHAR(20)   CHECK (frequencia IN (
                        'Diária','Semanal','Quinzenal','Mensal',
                        'Bimestral','Trimestral','Semestral','Anual')),
  recorrencia_pai_id  UUID          REFERENCES financial_lancamentos(id),
  parcela_numero      SMALLINT,
  parcela_total       SMALLINT,

  -- Centro de custo / projeto
  centro_custo        VARCHAR(60),
  projeto             VARCHAR(60),
  area_bba            VARCHAR(20)   CHECK (area_bba IN ('Financas','TI','Governanca','RH','Multi')),

  -- Referências externas
  nota_fiscal_id      UUID          REFERENCES fiscal_notas_fiscais(id),
  guia_id             UUID          REFERENCES fiscal_guias(id),
  numero_documento    VARCHAR(50),
  fornecedor_cnpj     VARCHAR(18),
  fornecedor_nome     VARCHAR(200),
  cliente_cnpj        VARCHAR(18),
  cliente_nome        VARCHAR(200),

  -- Comprovante
  comprovante_url     TEXT,
  observacoes         TEXT,
  tags                TEXT[],

  created_by          UUID          REFERENCES profiles(id),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE financial_lancamentos IS 'Lançamentos financeiros: receitas, despesas e transferências. Base do fluxo de caixa.';

CREATE INDEX IF NOT EXISTS idx_fin_lanc_company      ON financial_lancamentos(company_id);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_tipo         ON financial_lancamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_competencia  ON financial_lancamentos(data_competencia);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_pagamento    ON financial_lancamentos(data_pagamento);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_status       ON financial_lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_conta        ON financial_lancamentos(conta_id);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_categoria    ON financial_lancamentos(categoria_id);

-- ────────────────────────────────────────────────────────────
-- 4. financial_cobrancas
-- Faturas BBA emitidas aos clientes
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_cobrancas (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_id         UUID          REFERENCES service_contracts(id),

  numero_fatura       VARCHAR(30)   NOT NULL UNIQUE,
  descricao           VARCHAR(200)  NOT NULL,
  competencia         DATE          NOT NULL,
  data_emissao        DATE          NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento     DATE          NOT NULL,
  data_pagamento      DATE,

  valor               NUMERIC(12,2) NOT NULL,
  valor_desconto      NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_acrescimo     NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_total         NUMERIC(12,2) GENERATED ALWAYS AS (
                        valor - valor_desconto + valor_acrescimo
                      ) STORED,

  forma_pagamento     VARCHAR(30)   CHECK (forma_pagamento IN (
                        'PIX','Boleto','Transferência','Cartão','Débito Automático')),
  pix_chave           VARCHAR(150),
  linha_digitavel     VARCHAR(60),
  link_pagamento      TEXT,
  comprovante_url     TEXT,

  status              VARCHAR(20)   NOT NULL DEFAULT 'Pendente'
                      CHECK (status IN (
                        'Pendente','Enviada','Paga','Atrasada',
                        'Cancelada','Estornada','Parcialmente paga')),
  esta_atrasada       BOOLEAN GENERATED ALWAYS AS (
                        status IN ('Pendente','Enviada') AND data_vencimento < CURRENT_DATE
                      ) STORED,

  nfse_id             UUID          REFERENCES fiscal_notas_fiscais(id),
  lancamento_id       UUID          REFERENCES financial_lancamentos(id),
  observacoes         TEXT,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE financial_cobrancas IS 'Faturas e cobranças emitidas pela BBA aos clientes. Base para controle de inadimplência e faturamento.';

CREATE INDEX IF NOT EXISTS idx_fin_cob_company    ON financial_cobrancas(company_id);
CREATE INDEX IF NOT EXISTS idx_fin_cob_status     ON financial_cobrancas(status);
CREATE INDEX IF NOT EXISTS idx_fin_cob_vencimento ON financial_cobrancas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_cob_competencia ON financial_cobrancas(competencia);

-- ────────────────────────────────────────────────────────────
-- 5. task_templates
-- Templates de tarefas recorrentes por tipo de empresa/regime
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_templates (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          REFERENCES companies(id) ON DELETE CASCADE,

  titulo              VARCHAR(200)  NOT NULL,
  descricao           TEXT,
  area_bba            bba_area      NOT NULL,

  -- Aplicabilidade
  regime_tributario   VARCHAR(10)   REFERENCES ref_regimes_tributarios(codigo),
  tem_funcionarios    BOOLEAN,                  -- NULL = independente
  is_global           BOOLEAN       NOT NULL DEFAULT FALSE,   -- template BBA (company_id NULL)

  -- Configuração de recorrência
  recorrente          BOOLEAN       NOT NULL DEFAULT FALSE,
  frequencia          VARCHAR(20)   CHECK (frequencia IN (
                        'Diária','Semanal','Quinzenal','Mensal',
                        'Bimestral','Trimestral','Semestral','Anual')),
  dia_do_mes          SMALLINT      CHECK (dia_do_mes BETWEEN 1 AND 31),
  dias_antes_vencimento SMALLINT    DEFAULT 5,

  -- Prioridade e SLA
  prioridade          VARCHAR(10)   NOT NULL DEFAULT 'medium'
                      CHECK (prioridade IN ('low','medium','high','critical')),
  sla_dias_uteis      SMALLINT      DEFAULT 3,

  -- Calendário fiscal de referência
  fiscal_calendario_id UUID         REFERENCES fiscal_calendario(id),

  ativo               BOOLEAN       NOT NULL DEFAULT TRUE,
  observacoes         TEXT,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE task_templates IS 'Templates de tarefas recorrentes por regime tributário e tipo de empresa. Base para geração automática de tarefas.';
CREATE INDEX IF NOT EXISTS idx_task_tpl_company ON task_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_task_tpl_regime  ON task_templates(regime_tributario);
CREATE INDEX IF NOT EXISTS idx_task_tpl_area    ON task_templates(area_bba);

-- Templates globais BBA
INSERT INTO task_templates (titulo, descricao, area_bba, regime_tributario, is_global, recorrente, frequencia, dia_do_mes, prioridade, dias_antes_vencimento) VALUES
('DAS-MEI — Pagamento mensal', 'Emitir e pagar o DAS do MEI. Vencimento: dia 20.', 'financas','MEI',TRUE,TRUE,'Mensal',15,'high',5),
('DASN-SIMEI — Declaração anual', 'Declaração anual do MEI. Prazo: 31 de maio.', 'financas','MEI',TRUE,TRUE,'Anual',NULL,'critical',30),
('PGDAS-D — Apuração Simples', 'Apurar receitas e gerar DAS do Simples Nacional. Vencimento: dia 20.', 'financas','SN',TRUE,TRUE,'Mensal',15,'high',5),
('DEFIS — Declaração Simples', 'Declaração de Informações Socioeconômicas e Fiscais. Prazo: 31/03.', 'financas','SN',TRUE,TRUE,'Anual',NULL,'critical',30),
('DCTF — Entrega mensal', 'Declaração de Débitos e Créditos Tributários Federais.', 'financas','LP',TRUE,TRUE,'Mensal',10,'high',5),
('DCTF — Entrega mensal (LR)', 'Declaração de Débitos e Créditos Tributários Federais — Lucro Real.', 'financas','LR',TRUE,TRUE,'Mensal',10,'high',5),
('IRPJ/CSLL — Apuração trimestral (LP)', 'Apurar e recolher IRPJ e CSLL do trimestre — Lucro Presumido.', 'financas','LP',TRUE,TRUE,'Trimestral',NULL,'critical',15),
('PIS/COFINS — Recolhimento mensal', 'Apurar e pagar PIS e COFINS. Vencimento: dia 25.', 'financas','LP',TRUE,TRUE,'Mensal',20,'high',5),
('Folha de Pagamento — Processamento', 'Processar folha, calcular INSS, IRRF e FGTS dos colaboradores.', 'rh',NULL,TRUE,TRUE,'Mensal',25,'critical',5),
('FGTS — Recolhimento', 'Recolher FGTS dos empregados até o dia 7 do mês seguinte.', 'rh',NULL,TRUE,TRUE,'Mensal',1,'critical',6),
('eSocial — Fechamento mensal', 'Fechar folha no eSocial e transmitir eventos periódicos.', 'rh',NULL,TRUE,TRUE,'Mensal',5,'high',2),
('DIRF — Declaração anual', 'Declaração do Imposto sobre a Renda Retido na Fonte. Prazo: 28/02.', 'financas',NULL,TRUE,TRUE,'Anual',NULL,'critical',30),
('RAIS — Declaração anual', 'Relação Anual de Informações Sociais. Prazo: março/abril.', 'rh',NULL,TRUE,TRUE,'Anual',NULL,'high',30),
('Certidão Negativa Federal — Renovação', 'Verificar validade e renovar Certidão Negativa da Receita Federal.', 'governanca',NULL,TRUE,FALSE,NULL,NULL,'medium',7),
('Alvará de Funcionamento — Renovação', 'Verificar validade e renovar alvará municipal.', 'governanca',NULL,TRUE,FALSE,NULL,NULL,'medium',30),
('Balancete mensal — Revisão', 'Revisar balancete do mês com cliente e validar lançamentos.', 'financas',NULL,TRUE,TRUE,'Mensal',20,'medium',5),
('Backup de dados — Verificação', 'Verificar integridade e funcionamento dos backups de dados do cliente.', 'ti',NULL,TRUE,TRUE,'Mensal',25,'medium',3),
('Certificado Digital — Validade', 'Verificar validade do certificado digital A1/A3 e alertar para renovação.', 'ti',NULL,TRUE,FALSE,NULL,NULL,'high',30);

-- ────────────────────────────────────────────────────────────
-- 6. task_attachments
-- Anexos de tarefas
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_attachments (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id             UUID          NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  nome_arquivo        VARCHAR(200)  NOT NULL,
  arquivo_url         TEXT          NOT NULL,
  arquivo_tamanho     INTEGER,
  arquivo_mime        VARCHAR(100),
  descricao           TEXT,

  uploaded_by         UUID          REFERENCES profiles(id),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE task_attachments IS 'Arquivos e documentos anexados a tarefas do BBA App.';
CREATE INDEX IF NOT EXISTS idx_task_att_task    ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_att_company ON task_attachments(company_id);

-- ────────────────────────────────────────────────────────────
-- 7. chat_attachments
-- Arquivos enviados no chat
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_attachments (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  message_id          UUID          NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,

  nome_arquivo        VARCHAR(200)  NOT NULL,
  arquivo_url         TEXT          NOT NULL,
  arquivo_tamanho     INTEGER,
  arquivo_mime        VARCHAR(100),
  largura             INTEGER,                  -- dimensões (imagens)
  altura              INTEGER,
  duracao_segundos    INTEGER,                  -- áudios/vídeos

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE chat_attachments IS 'Arquivos enviados nas mensagens de chat do BBA App.';
CREATE INDEX IF NOT EXISTS idx_chat_att_message ON chat_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_att_company ON chat_attachments(company_id);

-- ────────────────────────────────────────────────────────────
-- 8. notifications
-- Notificações por usuário
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id          UUID          REFERENCES companies(id) ON DELETE CASCADE,

  tipo                VARCHAR(30)   NOT NULL CHECK (tipo IN (
                        'Tarefa','Fiscal','Financeiro','Documento',
                        'Contrato','Chat','Sistema','Alerta','Lembrete')),
  titulo              VARCHAR(200)  NOT NULL,
  corpo               TEXT,
  icone               VARCHAR(50),
  cor                 VARCHAR(7),

  -- Ação ao clicar
  link_interno        VARCHAR(300),             -- rota interna /app/...
  entidade_tipo       VARCHAR(30),              -- 'task','guia','documento'
  entidade_id         UUID,

  -- Status
  lida                BOOLEAN       NOT NULL DEFAULT FALSE,
  data_leitura        TIMESTAMPTZ,
  arquivada           BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Agendamento
  data_envio          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expira_em           TIMESTAMPTZ,

  -- Push notification
  enviada_push        BOOLEAN       NOT NULL DEFAULT FALSE,
  enviada_email       BOOLEAN       NOT NULL DEFAULT FALSE,
  enviada_whatsapp    BOOLEAN       NOT NULL DEFAULT FALSE,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notifications IS 'Notificações por usuário — in-app, email e WhatsApp.';
CREATE INDEX IF NOT EXISTS idx_notif_user      ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_company   ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notif_lida      ON notifications(lida);
CREATE INDEX IF NOT EXISTS idx_notif_tipo      ON notifications(tipo);
CREATE INDEX IF NOT EXISTS idx_notif_envio     ON notifications(data_envio);

-- ────────────────────────────────────────────────────────────
-- 9. reports_snapshots
-- KPIs e snapshots mensais por empresa
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports_snapshots (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  competencia         DATE          NOT NULL,   -- primeiro dia do mês
  area_bba            bba_area,

  -- KPIs financeiros
  receita_bruta       NUMERIC(14,2) DEFAULT 0,
  deducoes_receita    NUMERIC(12,2) DEFAULT 0,
  receita_liquida     NUMERIC(14,2) DEFAULT 0,
  total_despesas      NUMERIC(14,2) DEFAULT 0,
  resultado_liquido   NUMERIC(14,2) DEFAULT 0,
  margem_liquida_pct  NUMERIC(6,2)  DEFAULT 0,

  -- Caixa
  saldo_inicial_caixa NUMERIC(14,2) DEFAULT 0,
  entradas_caixa      NUMERIC(14,2) DEFAULT 0,
  saidas_caixa        NUMERIC(14,2) DEFAULT 0,
  saldo_final_caixa   NUMERIC(14,2) DEFAULT 0,

  -- Fiscal
  total_impostos      NUMERIC(12,2) DEFAULT 0,
  carga_tributaria_pct NUMERIC(6,2) DEFAULT 0,
  obrigacoes_pendentes SMALLINT     DEFAULT 0,
  guias_atrasadas     SMALLINT      DEFAULT 0,

  -- Tarefas
  tarefas_total       SMALLINT      DEFAULT 0,
  tarefas_concluidas  SMALLINT      DEFAULT 0,
  tarefas_atrasadas   SMALLINT      DEFAULT 0,
  taxa_conclusao_pct  NUMERIC(6,2)  DEFAULT 0,

  -- Documentos
  documentos_vencendo SMALLINT      DEFAULT 0,
  documentos_vencidos SMALLINT      DEFAULT 0,

  -- Trabalhista
  total_funcionarios  SMALLINT      DEFAULT 0,
  total_folha         NUMERIC(12,2) DEFAULT 0,
  total_encargos      NUMERIC(12,2) DEFAULT 0,

  -- Dados brutos (JSON para flexibilidade)
  dados_extras        JSONB         DEFAULT '{}',

  gerado_em           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  gerado_por          UUID          REFERENCES profiles(id),

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (company_id, competencia, area_bba)
);

COMMENT ON TABLE reports_snapshots IS 'Snapshots mensais de KPIs por empresa e área BBA. Base para dashboards e relatórios executivos.';
CREATE INDEX IF NOT EXISTS idx_snap_company    ON reports_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_snap_competencia ON reports_snapshots(competencia);
CREATE INDEX IF NOT EXISTS idx_snap_area       ON reports_snapshots(area_bba);

-- ────────────────────────────────────────────────────────────
-- 10. audit_log
-- Log imutável de todas as ações relevantes
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          REFERENCES companies(id),
  user_id             UUID          REFERENCES profiles(id),

  -- Ação
  acao                VARCHAR(20)   NOT NULL CHECK (acao IN (
                        'INSERT','UPDATE','DELETE','LOGIN','LOGOUT',
                        'EXPORT','IMPORT','TRANSMIT','APPROVE','REJECT',
                        'PAYMENT','CANCEL','VIEW_SENSITIVE')),
  entidade            VARCHAR(50)   NOT NULL,  -- nome da tabela/módulo
  entidade_id         UUID,                    -- ID do registro afetado
  descricao           TEXT,

  -- Dados antes/depois (para UPDATE)
  dados_antes         JSONB,
  dados_depois        JSONB,
  campos_alterados    TEXT[],

  -- Contexto técnico
  ip_address          INET,
  user_agent          TEXT,
  sessao_id           VARCHAR(100),
  origem              VARCHAR(20)   CHECK (origem IN ('Web','Mobile','API','Sistema','Automação')),

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_log IS 'Log de auditoria imutável — todas as ações relevantes de usuários e sistema.';

CREATE INDEX IF NOT EXISTS idx_audit_company  ON audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_user     ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_acao     ON audit_log(acao);
CREATE INDEX IF NOT EXISTS idx_audit_entidade ON audit_log(entidade);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_log(created_at);

-- Audit log é append-only: sem UPDATE ou DELETE
CREATE RULE audit_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- ────────────────────────────────────────────────────────────
-- TRIGGERS updated_at
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER trg_fin_contas_upd      BEFORE UPDATE ON financial_contas      FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();
CREATE TRIGGER trg_fin_cat_upd         BEFORE UPDATE ON financial_categorias  FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();
CREATE TRIGGER trg_fin_lanc_upd        BEFORE UPDATE ON financial_lancamentos FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();
CREATE TRIGGER trg_fin_cob_upd         BEFORE UPDATE ON financial_cobrancas   FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();
CREATE TRIGGER trg_task_tpl_upd        BEFORE UPDATE ON task_templates        FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();
CREATE TRIGGER trg_reports_snap_upd    BEFORE UPDATE ON reports_snapshots     FOR EACH ROW EXECUTE FUNCTION bba_set_updated_at();

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE financial_contas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_categorias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_lancamentos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_cobrancas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_snapshots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log               ENABLE ROW LEVEL SECURITY;

-- financial_contas
CREATE POLICY "fin_contas_sel" ON financial_contas FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fin_contas_ins" ON financial_contas FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fin_contas_upd" ON financial_contas FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- financial_categorias (globais visíveis a todos, próprias só para a company)
CREATE POLICY "fin_cat_sel" ON financial_categorias FOR SELECT TO authenticated USING (company_id IS NULL OR company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fin_cat_ins" ON financial_categorias FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fin_cat_upd" ON financial_categorias FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- financial_lancamentos
CREATE POLICY "fin_lanc_sel" ON financial_lancamentos FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fin_lanc_ins" ON financial_lancamentos FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fin_lanc_upd" ON financial_lancamentos FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- financial_cobrancas
CREATE POLICY "fin_cob_sel" ON financial_cobrancas FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fin_cob_ins" ON financial_cobrancas FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fin_cob_upd" ON financial_cobrancas FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- task_templates (globais visíveis a todos)
CREATE POLICY "task_tpl_sel" ON task_templates FOR SELECT TO authenticated USING (is_global = TRUE OR company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "task_tpl_ins" ON task_templates FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "task_tpl_upd" ON task_templates FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- task_attachments
CREATE POLICY "task_att_sel" ON task_attachments FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "task_att_ins" ON task_attachments FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- chat_attachments
CREATE POLICY "chat_att_sel" ON chat_attachments FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "chat_att_ins" ON chat_attachments FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- notifications (apenas o próprio usuário vê suas notificações)
CREATE POLICY "notif_sel" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_ins" ON notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_upd" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- reports_snapshots
CREATE POLICY "snap_sel" ON reports_snapshots FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "snap_ins" ON reports_snapshots FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "snap_upd" ON reports_snapshots FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- audit_log (usuário vê apenas logs da sua company)
CREATE POLICY "audit_sel" ON audit_log FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR user_id = auth.uid());
CREATE POLICY "audit_ins" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);
