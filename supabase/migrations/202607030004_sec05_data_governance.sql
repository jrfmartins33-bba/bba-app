-- ============================================================
-- SEC-05 — LGPD, Privacy & Data Governance
-- ============================================================
-- Escopo: infraestrutura de governança de dados (classificação,
-- catálogo, retenção, governança de IA, consentimento e direitos
-- do titular). Não altera BDOS, Decision Engine, Business Facts,
-- Engineering Application Layer, UI, login, cadastro, RLS do
-- SEC-01, bootstrap do SEC-02, integridade do SEC-03 ou a
-- infraestrutura de auditoria do SEC-04. Não implementa nenhuma
-- funcionalidade de negócio (exportação/anonimização/eliminação
-- automática permanecem apenas como estrutura, sem enforcement).
-- Toda instrução é idempotente (IF NOT EXISTS / ON CONFLICT DO
-- UPDATE / DROP POLICY IF EXISTS / CREATE OR REPLACE).
-- ============================================================

-- ------------------------------------------------------------
-- ETAPA 2 — Data Classification
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_classification (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name             TEXT NOT NULL DEFAULT 'public',
  table_name              TEXT NOT NULL UNIQUE,
  classificacao           VARCHAR(20) NOT NULL CHECK (classificacao IN (
                            'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED',
                            'FINANCIAL', 'FISCAL', 'LABOR', 'PERSONAL_DATA', 'SYSTEM', 'AUDIT'
                          )),
  criticidade             VARCHAR(10) NOT NULL CHECK (criticidade IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  contem_dados_pessoais   BOOLEAN NOT NULL DEFAULT FALSE,
  contem_dados_sensiveis  BOOLEAN NOT NULL DEFAULT FALSE,
  justificativa           TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.data_classification IS
  'SEC-05: classificação oficial de sensibilidade/domínio de cada tabela do schema public. Referência de leitura para toda a plataforma; escrita restrita a bba_admin.';
COMMENT ON COLUMN public.data_classification.contem_dados_sensiveis IS
  'LGPD art. 5º/11: aqui usado em sentido amplo para CPF, salário, dado financeiro individualizável ou conteúdo de upload/arquivo não estruturado cujo conteúdo não pode ser garantido pelo schema.';

DROP TRIGGER IF EXISTS trg_data_classification_upd ON public.data_classification;
CREATE TRIGGER trg_data_classification_upd
BEFORE UPDATE ON public.data_classification
FOR EACH ROW EXECUTE FUNCTION public.bba_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_data_classification_classificacao ON public.data_classification(classificacao);

ALTER TABLE public.data_classification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_classification_read ON public.data_classification;
CREATE POLICY data_classification_read
ON public.data_classification
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS data_classification_write_admin ON public.data_classification;
CREATE POLICY data_classification_write_admin
ON public.data_classification
FOR INSERT TO authenticated
WITH CHECK (public.is_bba_admin());

DROP POLICY IF EXISTS data_classification_update_admin ON public.data_classification;
CREATE POLICY data_classification_update_admin
ON public.data_classification
FOR UPDATE TO authenticated
USING (public.is_bba_admin())
WITH CHECK (public.is_bba_admin());

DROP POLICY IF EXISTS data_classification_delete_admin ON public.data_classification;
CREATE POLICY data_classification_delete_admin
ON public.data_classification
FOR DELETE TO authenticated
USING (public.is_bba_admin());

-- Classificação em massa das tabelas de referência (ref_*): dado
-- público/paramétrico, sem tenant, sem pessoa física envolvida.
-- Descoberta dinâmica via information_schema — completa mesmo se
-- novas ref_* forem adicionadas no futuro, sem precisar editar
-- esta migration.
INSERT INTO public.data_classification (
  table_name, classificacao, criticidade, contem_dados_pessoais, contem_dados_sensiveis, justificativa
)
SELECT
  t.table_name,
  'PUBLIC',
  'LOW',
  FALSE,
  FALSE,
  'Tabela de referência pública/paramétrica (tributária, geográfica, trabalhista ou fiscal) — sem dado de tenant ou de pessoa física. RLS já concede SELECT a todo authenticated (padrão pré-existente).'
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_name LIKE 'ref\_%' ESCAPE '\'
ON CONFLICT (table_name) DO UPDATE SET
  classificacao = EXCLUDED.classificacao,
  criticidade = EXCLUDED.criticidade,
  contem_dados_pessoais = EXCLUDED.contem_dados_pessoais,
  contem_dados_sensiveis = EXCLUDED.contem_dados_sensiveis,
  justificativa = EXCLUDED.justificativa,
  updated_at = NOW();

-- Classificação individual das demais 35 tabelas de negócio (mais
-- auth.users, tratada como pseudo-tabela para completude do
-- inventário, já que é onde vivem e-mail/senha/telefone).
INSERT INTO public.data_classification (
  table_name, classificacao, criticidade, contem_dados_pessoais, contem_dados_sensiveis, justificativa
) VALUES
  ('auth.users', 'PERSONAL_DATA', 'CRITICAL', TRUE, TRUE,
   'Identidade de autenticação (e-mail, hash de senha). Gerenciada pelo Supabase Auth; incluída aqui apenas para completude do inventário — nenhuma policy/trigger de RLS deste projeto se aplica a ela além do já existente (handle_new_user, trg_audit_auth_users do SEC-04).'),
  ('profiles', 'PERSONAL_DATA', 'HIGH', TRUE, FALSE,
   'Identidade, papel de acesso (client/bba_admin) e vínculo com a empresa do usuário.'),
  ('companies', 'CONFIDENTIAL', 'HIGH', FALSE, FALSE,
   'Cadastro da empresa cliente (tenant): CNPJ, regime tributário, dono da conta.'),
  ('projects', 'INTERNAL', 'MEDIUM', FALSE, FALSE,
   'Projetos/frentes de trabalho abertas para o cliente.'),
  ('onboarding_steps', 'INTERNAL', 'LOW', FALSE, FALSE,
   'Etapas de onboarding do módulo original (schema core).'),
  ('onboarding_checklist', 'INTERNAL', 'LOW', FALSE, FALSE,
   'Checklist de onboarding do módulo de contratos/cadastro.'),
  ('tasks', 'INTERNAL', 'MEDIUM', FALSE, FALSE,
   'Tarefas operacionais atribuídas a cliente/equipe BBA.'),
  ('task_templates', 'INTERNAL', 'LOW', FALSE, FALSE,
   'Modelos reutilizáveis de tarefa, sem dado de tenant específico.'),
  ('task_attachments', 'RESTRICTED', 'HIGH', TRUE, TRUE,
   'Arquivos anexados a tarefas — conteúdo arbitrário definido pelo usuário; tratado como potencialmente pessoal/sensível por padrão conservador, já que o schema não garante o que foi enviado.'),
  ('chat_channels', 'INTERNAL', 'LOW', FALSE, FALSE,
   'Canais de conversa por área (fiscal/financeiro/rh/ti/governança) por tenant.'),
  ('chat_messages', 'CONFIDENTIAL', 'MEDIUM', TRUE, FALSE,
   'Conteúdo de conversa em texto livre entre cliente e equipe BBA — pode conter dado pessoal incidental não previsível pelo schema.'),
  ('chat_read_state', 'INTERNAL', 'LOW', FALSE, FALSE,
   'Estado de leitura por usuário/canal, sem conteúdo de mensagem.'),
  ('chat_attachments', 'RESTRICTED', 'HIGH', TRUE, TRUE,
   'Arquivos anexados no chat — mesmo tratamento conservador de task_attachments.'),
  ('client_companies', 'CONFIDENTIAL', 'MEDIUM', FALSE, FALSE,
   'Dados cadastrais estendidos da empresa cliente (além de companies).'),
  ('client_socios', 'PERSONAL_DATA', 'HIGH', TRUE, TRUE,
   'Sócios/quotistas da empresa cliente: CPF/CNPJ e percentual de participação.'),
  ('client_cnaes_secundarios', 'PUBLIC', 'LOW', FALSE, FALSE,
   'Lista de códigos CNAE secundários vinculados ao cliente — referencia ref_cnae, sem dado pessoal.'),
  ('client_documents', 'RESTRICTED', 'HIGH', TRUE, TRUE,
   'Documentos cadastrais/fiscais/societários enviados pelo cliente — conteúdo de arquivo arbitrário.'),
  ('service_contracts', 'CONFIDENTIAL', 'HIGH', FALSE, FALSE,
   'Contratos de prestação de serviço BBA-cliente: valor, vigência, cláusulas.'),
  ('service_scope_items', 'INTERNAL', 'MEDIUM', FALSE, FALSE,
   'Itens de escopo detalhado dos contratos de serviço.'),
  ('financial_contas', 'FINANCIAL', 'HIGH', FALSE, FALSE,
   'Contas bancárias/cartão cadastradas pelo cliente.'),
  ('financial_categorias', 'FINANCIAL', 'LOW', FALSE, FALSE,
   'Categorias de lançamento financeiro, sem valor monetário.'),
  ('financial_lancamentos', 'FINANCIAL', 'CRITICAL', FALSE, FALSE,
   'Lançamentos financeiros individuais (receitas/despesas) do cliente.'),
  ('financial_cobrancas', 'FINANCIAL', 'CRITICAL', FALSE, TRUE,
   'Cobranças e chaves de recebimento — chave Pix pode ser o próprio CPF/e-mail/telefone do titular.'),
  ('fiscal_calendario', 'PUBLIC', 'LOW', FALSE, FALSE,
   'Calendário genérico de obrigações por regime tributário, sem tenant.'),
  ('fiscal_obrigacoes', 'FISCAL', 'HIGH', FALSE, FALSE,
   'Obrigações fiscais acompanhadas para o cliente.'),
  ('fiscal_guias', 'FISCAL', 'CRITICAL', FALSE, FALSE,
   'Guias de recolhimento (DAS/DARF/GPS etc.) com valores devidos/pagos.'),
  ('fiscal_notas_fiscais', 'FISCAL', 'CRITICAL', TRUE, TRUE,
   'Notas fiscais emitidas/recebidas — inclui CPF de emitente/destinatário pessoa física.'),
  ('fiscal_parcelamentos', 'FISCAL', 'HIGH', FALSE, FALSE,
   'Parcelamentos de débito fiscal em curso.'),
  ('rh_funcionarios', 'LABOR', 'HIGH', TRUE, TRUE,
   'Cadastro de funcionários do cliente: CPF, data de nascimento, cargo, situação.'),
  ('rh_folha_pagamentos', 'LABOR', 'CRITICAL', TRUE, TRUE,
   'Folha de pagamento mensal — remuneração individualizada por funcionário.'),
  ('societario_socios', 'PERSONAL_DATA', 'HIGH', TRUE, TRUE,
   'Sócios/quotistas formais da empresa cliente perante o registro societário.'),
  ('societario_capital_social', 'CONFIDENTIAL', 'MEDIUM', FALSE, FALSE,
   'Estrutura e histórico de capital social da empresa cliente.'),
  ('societario_alteracoes', 'CONFIDENTIAL', 'MEDIUM', FALSE, FALSE,
   'Histórico de alterações contratuais/societárias registradas.'),
  ('societario_assembleias', 'CONFIDENTIAL', 'MEDIUM', FALSE, FALSE,
   'Atas de assembleias e reuniões societárias.'),
  ('notifications', 'INTERNAL', 'LOW', FALSE, FALSE,
   'Notificações in-app endereçadas a um usuário específico.'),
  ('reports_snapshots', 'CONFIDENTIAL', 'MEDIUM', FALSE, FALSE,
   'Snapshots de relatórios gerados — conteúdo variável conforme o relatório, não integralmente previsível pelo schema.'),
  ('audit_log', 'AUDIT', 'HIGH', TRUE, TRUE,
   'Trilha de auditoria (SEC-04) — dados_antes/dados_depois podem conter cópia de qualquer campo de qualquer tabela auditada, inclusive pessoal/sensível.')
ON CONFLICT (table_name) DO UPDATE SET
  classificacao = EXCLUDED.classificacao,
  criticidade = EXCLUDED.criticidade,
  contem_dados_pessoais = EXCLUDED.contem_dados_pessoais,
  contem_dados_sensiveis = EXCLUDED.contem_dados_sensiveis,
  justificativa = EXCLUDED.justificativa,
  updated_at = NOW();

-- ------------------------------------------------------------
-- ETAPA 5 — Política de Retenção (infraestrutura/definição, sem
-- enforcement automático — nenhuma linha é apagada por esta
-- migration ou por qualquer function criada aqui).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_retention_policy (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria                   VARCHAR(30) NOT NULL UNIQUE CHECK (categoria IN (
                                'Financeiro', 'Fiscal', 'Trabalhista', 'Operacional',
                                'Auditoria', 'Logs', 'Chat', 'Uploads', 'Documentos', 'Backups'
                              )),
  retencao_minima_anos        NUMERIC(4,1) NOT NULL,
  retencao_recomendada_anos   NUMERIC(4,1) NOT NULL,
  descarte                    TEXT NOT NULL,
  anonimizacao                TEXT NOT NULL,
  observacoes                 TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.data_retention_policy IS
  'SEC-05: define (não executa) a política de retenção por categoria. Nenhum expurgo/anonimização automático é realizado por esta tabela ou por qualquer trigger/function deste projeto.';

DROP TRIGGER IF EXISTS trg_data_retention_policy_upd ON public.data_retention_policy;
CREATE TRIGGER trg_data_retention_policy_upd
BEFORE UPDATE ON public.data_retention_policy
FOR EACH ROW EXECUTE FUNCTION public.bba_set_updated_at();

ALTER TABLE public.data_retention_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_retention_policy_read ON public.data_retention_policy;
CREATE POLICY data_retention_policy_read
ON public.data_retention_policy FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS data_retention_policy_insert_admin ON public.data_retention_policy;
CREATE POLICY data_retention_policy_insert_admin
ON public.data_retention_policy FOR INSERT TO authenticated WITH CHECK (public.is_bba_admin());

DROP POLICY IF EXISTS data_retention_policy_update_admin ON public.data_retention_policy;
CREATE POLICY data_retention_policy_update_admin
ON public.data_retention_policy FOR UPDATE TO authenticated
USING (public.is_bba_admin()) WITH CHECK (public.is_bba_admin());

DROP POLICY IF EXISTS data_retention_policy_delete_admin ON public.data_retention_policy;
CREATE POLICY data_retention_policy_delete_admin
ON public.data_retention_policy FOR DELETE TO authenticated USING (public.is_bba_admin());

-- Retenção mínima de Financeiro/Fiscal/Trabalhista alinhada aos 5
-- anos já usados por audit_log_retention_status() (SEC-04) para as
-- mesmas categorias, evitando números divergentes entre sprints.
INSERT INTO public.data_retention_policy (
  categoria, retencao_minima_anos, retencao_recomendada_anos, descarte, anonimizacao, observacoes
) VALUES
  ('Financeiro', 5, 7, 'Expurgo físico após prazo, mediante aprovação formal do DPO — não automatizado nesta sprint.', 'Anonimizar identificadores de pessoa física (CPF em chave Pix) antes do expurgo, quando aplicável.', 'Alinhado ao prazo fiscal de 5 anos (mínimo legal) já usado em audit_log_retention_status() (SEC-04) para financial_*.'),
  ('Fiscal', 5, 5, 'Expurgo físico após prazo decadencial/prescricional aplicável, mediante aprovação formal do DPO.', 'Não recomendado anonimizar antes do prazo — documento fiscal exige integridade para fins de fiscalização.', 'Baseado no prazo decadencial padrão do CTN (5 anos); pode ser maior conforme orientação jurídica específica do cliente.'),
  ('Trabalhista', 5, 20, 'Não descartar automaticamente — vínculos trabalhistas têm prazos previdenciários/FGTS mais longos que o fiscal.', 'Não recomendado anonimizar registros de folha antes de decisão jurídica específica.', 'Retenção recomendada mais longa que a mínima por conta de ações trabalhistas/previdenciárias com prazo de até 30 anos em casos específicos — REVIEW REQUIRED com jurídico antes de fixar prazo definitivo maior.'),
  ('Operacional', 2, 5, 'Expurgo físico ou arquivamento frio após prazo, sem aprovação formal obrigatória.', 'Anonimizar vínculo com profiles/companies ao encerrar relacionamento com o cliente.', 'Cobre profiles/companies/projects/tasks/onboarding/client_* estruturais e societário (sem categoria própria na lista desta etapa).'),
  ('Auditoria', 5, 7, 'Não descartar sem aprovação formal — é a evidência de conformidade da própria plataforma.', 'Não recomendado anonimizar; a rastreabilidade é o propósito da tabela.', 'audit_log já é imutável por RULE (SEC-04); esta política define o prazo, não o mecanismo de imutabilidade.'),
  ('Logs', 1, 2, 'Expurgo físico ou rotação automática após prazo.', 'Anonimizar IP/user_agent quando não mais necessário para investigação de incidente.', 'Cobre notifications e logs técnicos operacionais fora de audit_log.'),
  ('Chat', 2, 5, 'Arquivamento frio após prazo; não descartar enquanto o contrato de serviço estiver ativo.', 'Anonimizar remetente ao encerrar relacionamento com o cliente, preservando o conteúdo para histórico operacional se necessário.', 'chat_messages pode conter dado pessoal incidental — ver data_classification.'),
  ('Uploads', 5, 5, 'Expurgo físico após prazo ou a pedido do titular via data_subject_requests.', 'Não aplicável de forma genérica — depende do conteúdo do arquivo, avaliar caso a caso.', 'Cobre task_attachments/chat_attachments — conteúdo arbitrário, tratado como potencialmente pessoal/sensível.'),
  ('Documentos', 5, 5, 'Expurgo físico após prazo ou a pedido do titular via data_subject_requests.', 'Não aplicável de forma genérica — depende do tipo de documento (ex.: certidão vs. contrato social).', 'Cobre client_documents — mesmo prazo de Fiscal por natureza predominante dos tipos de documento cadastrados.'),
  ('Backups', 5, 5, 'Fora do escopo desta migration — backups são geridos pela infraestrutura Supabase, não por tabela de aplicação.', 'Fora do escopo desta migration.', 'REVIEW REQUIRED: política de retenção de backup da infraestrutura deve ser confirmada diretamente no painel/plano do Supabase, não é observável pelo schema deste projeto.')
ON CONFLICT (categoria) DO UPDATE SET
  retencao_minima_anos = EXCLUDED.retencao_minima_anos,
  retencao_recomendada_anos = EXCLUDED.retencao_recomendada_anos,
  descarte = EXCLUDED.descarte,
  anonimizacao = EXCLUDED.anonimizacao,
  observacoes = EXCLUDED.observacoes,
  updated_at = NOW();

-- ------------------------------------------------------------
-- ETAPA 3 — Data Catalog (referencia data_classification e
-- data_retention_policy por chave, sem duplicar classificação nem
-- criticidade).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_catalog (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name            TEXT NOT NULL UNIQUE
                          REFERENCES public.data_classification(table_name) ON DELETE CASCADE,
  finalidade            TEXT NOT NULL,
  proprietario           VARCHAR(20) NOT NULL CHECK (proprietario IN ('BBA', 'Cliente', 'Compartilhado', 'Sistema')),
  tenant_scope          VARCHAR(20) NOT NULL CHECK (tenant_scope IN ('tenant_isolado', 'global', 'sem_tenant')),
  retencao_categoria    VARCHAR(30) NOT NULL REFERENCES public.data_retention_policy(categoria),
  base_legal            VARCHAR(30) NOT NULL CHECK (base_legal IN (
                          'execucao_contrato', 'obrigacao_legal', 'legitimo_interesse',
                          'consentimento', 'protecao_credito', 'nao_aplicavel', 'REVIEW_REQUIRED'
                        )),
  responsavel           TEXT NOT NULL DEFAULT 'BBA — Data Protection Officer',
  observacoes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.data_catalog IS
  'SEC-05: catálogo oficial de finalidade/propriedade/base legal por tabela. Não repete classificação/criticidade (já em data_classification) nem números de retenção (já em data_retention_policy) — apenas referencia.';

DROP TRIGGER IF EXISTS trg_data_catalog_upd ON public.data_catalog;
CREATE TRIGGER trg_data_catalog_upd
BEFORE UPDATE ON public.data_catalog
FOR EACH ROW EXECUTE FUNCTION public.bba_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_data_catalog_retencao ON public.data_catalog(retencao_categoria);
CREATE INDEX IF NOT EXISTS idx_data_catalog_base_legal ON public.data_catalog(base_legal);

ALTER TABLE public.data_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_catalog_read ON public.data_catalog;
CREATE POLICY data_catalog_read
ON public.data_catalog FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS data_catalog_insert_admin ON public.data_catalog;
CREATE POLICY data_catalog_insert_admin
ON public.data_catalog FOR INSERT TO authenticated WITH CHECK (public.is_bba_admin());

DROP POLICY IF EXISTS data_catalog_update_admin ON public.data_catalog;
CREATE POLICY data_catalog_update_admin
ON public.data_catalog FOR UPDATE TO authenticated
USING (public.is_bba_admin()) WITH CHECK (public.is_bba_admin());

DROP POLICY IF EXISTS data_catalog_delete_admin ON public.data_catalog;
CREATE POLICY data_catalog_delete_admin
ON public.data_catalog FOR DELETE TO authenticated USING (public.is_bba_admin());

-- Catálogo em massa para as ref_* (finalidade uniforme).
INSERT INTO public.data_catalog (table_name, finalidade, proprietario, tenant_scope, retencao_categoria, base_legal, observacoes)
SELECT
  t.table_name,
  'Tabela paramétrica de apoio a cálculos fiscais/trabalhistas/geográficos, mantida pela BBA.',
  'Sistema',
  'global',
  'Operacional',
  'nao_aplicavel',
  'Não contém dado de titular; base legal não se aplica.'
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_name LIKE 'ref\_%' ESCAPE '\'
ON CONFLICT (table_name) DO UPDATE SET
  finalidade = EXCLUDED.finalidade,
  proprietario = EXCLUDED.proprietario,
  tenant_scope = EXCLUDED.tenant_scope,
  retencao_categoria = EXCLUDED.retencao_categoria,
  base_legal = EXCLUDED.base_legal,
  observacoes = EXCLUDED.observacoes,
  updated_at = NOW();

INSERT INTO public.data_catalog (table_name, finalidade, proprietario, tenant_scope, retencao_categoria, base_legal, observacoes) VALUES
  ('auth.users', 'Autenticação do usuário (e-mail/senha).', 'Sistema', 'sem_tenant', 'Operacional', 'execucao_contrato', 'Gerenciada pelo Supabase Auth; incluída para completude do inventário.'),
  ('profiles', 'Identidade e papel de acesso do usuário na plataforma.', 'Compartilhado', 'tenant_isolado', 'Operacional', 'execucao_contrato', NULL),
  ('companies', 'Cadastro do tenant/empresa cliente.', 'Cliente', 'tenant_isolado', 'Operacional', 'execucao_contrato', NULL),
  ('projects', 'Organização de frentes de trabalho por área.', 'Cliente', 'tenant_isolado', 'Operacional', 'execucao_contrato', NULL),
  ('onboarding_steps', 'Acompanhamento de etapas de implantação do cliente.', 'BBA', 'tenant_isolado', 'Operacional', 'execucao_contrato', NULL),
  ('onboarding_checklist', 'Checklist de onboarding do módulo de contratos.', 'BBA', 'tenant_isolado', 'Operacional', 'execucao_contrato', NULL),
  ('tasks', 'Gestão de tarefas operacionais do relacionamento.', 'Compartilhado', 'tenant_isolado', 'Operacional', 'execucao_contrato', NULL),
  ('task_templates', 'Padronização de tarefas recorrentes.', 'BBA', 'global', 'Operacional', 'nao_aplicavel', NULL),
  ('task_attachments', 'Anexos de arquivo vinculados a tarefas.', 'Compartilhado', 'tenant_isolado', 'Uploads', 'execucao_contrato', NULL),
  ('chat_channels', 'Canal de comunicação por área entre cliente e BBA.', 'Compartilhado', 'tenant_isolado', 'Chat', 'execucao_contrato', NULL),
  ('chat_messages', 'Histórico de comunicação operacional cliente-BBA.', 'Compartilhado', 'tenant_isolado', 'Chat', 'REVIEW_REQUIRED', 'Conteúdo livre definido pelo usuário; base legal predominante é execução de contrato, mas conteúdo incidental pode exigir análise caso a caso.'),
  ('chat_read_state', 'Controle de leitura de mensagens por usuário.', 'Compartilhado', 'tenant_isolado', 'Operacional', 'execucao_contrato', NULL),
  ('chat_attachments', 'Anexos de arquivo vinculados a mensagens de chat.', 'Compartilhado', 'tenant_isolado', 'Uploads', 'execucao_contrato', NULL),
  ('client_companies', 'Detalhamento cadastral estendido do cliente.', 'Cliente', 'tenant_isolado', 'Operacional', 'execucao_contrato', NULL),
  ('client_socios', 'Registro de sócios/quotistas para fins cadastrais e societários.', 'Cliente', 'tenant_isolado', 'Fiscal', 'obrigacao_legal', 'Categoria "Fiscal" usada por proximidade — não há categoria "Societário" na lista fixa da Etapa 5.'),
  ('client_cnaes_secundarios', 'Lista de atividades econômicas secundárias do cliente.', 'Cliente', 'tenant_isolado', 'Operacional', 'execucao_contrato', NULL),
  ('client_documents', 'Repositório de documentos cadastrais/fiscais do cliente.', 'Cliente', 'tenant_isolado', 'Documentos', 'obrigacao_legal', NULL),
  ('service_contracts', 'Registro do contrato de prestação de serviço BBA-cliente.', 'Compartilhado', 'tenant_isolado', 'Operacional', 'execucao_contrato', NULL),
  ('service_scope_items', 'Detalhamento do escopo contratado.', 'BBA', 'tenant_isolado', 'Operacional', 'execucao_contrato', NULL),
  ('financial_contas', 'Cadastro de contas financeiras do cliente para controle de caixa.', 'Cliente', 'tenant_isolado', 'Financeiro', 'execucao_contrato', NULL),
  ('financial_categorias', 'Taxonomia de categorias de lançamento financeiro.', 'Cliente', 'tenant_isolado', 'Financeiro', 'execucao_contrato', NULL),
  ('financial_lancamentos', 'Registro individual de receitas/despesas do cliente.', 'Cliente', 'tenant_isolado', 'Financeiro', 'execucao_contrato', NULL),
  ('financial_cobrancas', 'Controle de cobranças emitidas e chaves de recebimento.', 'Cliente', 'tenant_isolado', 'Financeiro', 'execucao_contrato', NULL),
  ('fiscal_calendario', 'Referência de prazos fiscais por regime tributário.', 'Sistema', 'global', 'Operacional', 'nao_aplicavel', NULL),
  ('fiscal_obrigacoes', 'Acompanhamento de obrigações fiscais do cliente.', 'Cliente', 'tenant_isolado', 'Fiscal', 'obrigacao_legal', NULL),
  ('fiscal_guias', 'Controle de guias de recolhimento tributário.', 'Cliente', 'tenant_isolado', 'Fiscal', 'obrigacao_legal', NULL),
  ('fiscal_notas_fiscais', 'Registro de notas fiscais emitidas/recebidas.', 'Cliente', 'tenant_isolado', 'Fiscal', 'obrigacao_legal', NULL),
  ('fiscal_parcelamentos', 'Controle de parcelamentos de débito fiscal.', 'Cliente', 'tenant_isolado', 'Fiscal', 'obrigacao_legal', NULL),
  ('rh_funcionarios', 'Cadastro de funcionários do cliente para gestão de RH/folha.', 'Cliente', 'tenant_isolado', 'Trabalhista', 'obrigacao_legal', NULL),
  ('rh_folha_pagamentos', 'Processamento e histórico de folha de pagamento.', 'Cliente', 'tenant_isolado', 'Trabalhista', 'obrigacao_legal', NULL),
  ('societario_socios', 'Registro formal de sócios perante o quadro societário.', 'Cliente', 'tenant_isolado', 'Fiscal', 'obrigacao_legal', 'Categoria "Fiscal" usada por proximidade — não há categoria "Societário" na lista fixa da Etapa 5.'),
  ('societario_capital_social', 'Histórico de capital social da empresa cliente.', 'Cliente', 'tenant_isolado', 'Fiscal', 'obrigacao_legal', 'Idem client_socios.'),
  ('societario_alteracoes', 'Histórico de alterações contratuais/societárias.', 'Cliente', 'tenant_isolado', 'Fiscal', 'obrigacao_legal', 'Idem client_socios.'),
  ('societario_assembleias', 'Registro de atas de assembleias/reuniões.', 'Cliente', 'tenant_isolado', 'Fiscal', 'obrigacao_legal', 'Idem client_socios.'),
  ('notifications', 'Comunicação in-app de eventos relevantes ao usuário.', 'Compartilhado', 'tenant_isolado', 'Logs', 'execucao_contrato', NULL),
  ('reports_snapshots', 'Armazenamento de relatórios gerados para consulta posterior.', 'BBA', 'tenant_isolado', 'Operacional', 'execucao_contrato', 'REVIEW_REQUIRED quanto ao conteúdo específico de cada snapshot — avaliar caso a caso.'),
  ('audit_log', 'Trilha de auditoria e conformidade da plataforma (SEC-04).', 'Sistema', 'tenant_isolado', 'Auditoria', 'obrigacao_legal', NULL)
ON CONFLICT (table_name) DO UPDATE SET
  finalidade = EXCLUDED.finalidade,
  proprietario = EXCLUDED.proprietario,
  tenant_scope = EXCLUDED.tenant_scope,
  retencao_categoria = EXCLUDED.retencao_categoria,
  base_legal = EXCLUDED.base_legal,
  observacoes = EXCLUDED.observacoes,
  updated_at = NOW();

-- ------------------------------------------------------------
-- ETAPA 6 — AI Governance (uma linha por valor de classificação,
-- não por tabela — evita duplicar as 71 linhas de
-- data_classification; a regra de uma tabela é obtida via JOIN
-- por data_classification.classificacao).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_data_governance (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classificacao           VARCHAR(20) NOT NULL UNIQUE CHECK (classificacao IN (
                            'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED',
                            'FINANCIAL', 'FISCAL', 'LABOR', 'PERSONAL_DATA', 'SYSTEM', 'AUDIT'
                          )),
  politica_ia             VARCHAR(30) NOT NULL CHECK (politica_ia IN ('ALLOWED', 'ANONYMIZE_BEFORE_SEND', 'NEVER_SEND')),
  provedores_permitidos   TEXT,
  justificativa           TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.ai_data_governance IS
  'SEC-05: política de envio a provedores de IA (OpenAI/Anthropic/outros) por classificação de dado. Apenas infraestrutura de decisão — nenhuma anonimização é implementada por esta migration.';

DROP TRIGGER IF EXISTS trg_ai_data_governance_upd ON public.ai_data_governance;
CREATE TRIGGER trg_ai_data_governance_upd
BEFORE UPDATE ON public.ai_data_governance
FOR EACH ROW EXECUTE FUNCTION public.bba_set_updated_at();

ALTER TABLE public.ai_data_governance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_data_governance_read ON public.ai_data_governance;
CREATE POLICY ai_data_governance_read
ON public.ai_data_governance FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS ai_data_governance_insert_admin ON public.ai_data_governance;
CREATE POLICY ai_data_governance_insert_admin
ON public.ai_data_governance FOR INSERT TO authenticated WITH CHECK (public.is_bba_admin());

DROP POLICY IF EXISTS ai_data_governance_update_admin ON public.ai_data_governance;
CREATE POLICY ai_data_governance_update_admin
ON public.ai_data_governance FOR UPDATE TO authenticated
USING (public.is_bba_admin()) WITH CHECK (public.is_bba_admin());

DROP POLICY IF EXISTS ai_data_governance_delete_admin ON public.ai_data_governance;
CREATE POLICY ai_data_governance_delete_admin
ON public.ai_data_governance FOR DELETE TO authenticated USING (public.is_bba_admin());

INSERT INTO public.ai_data_governance (classificacao, politica_ia, provedores_permitidos, justificativa) VALUES
  ('PUBLIC', 'ALLOWED', 'OpenAI, Anthropic, outros', 'Dado paramétrico público, sem titular identificável — sem risco LGPD ao enviar integralmente.'),
  ('SYSTEM', 'ALLOWED', 'OpenAI, Anthropic, outros', 'Metadado operacional interno, sem dado pessoal ou de negócio sensível do cliente.'),
  ('INTERNAL', 'ANONYMIZE_BEFORE_SEND', 'OpenAI, Anthropic (após anonimização)', 'Dado operacional de baixa sensibilidade, mas pode referenciar indiretamente cliente/usuário — remover identificadores antes do envio.'),
  ('CONFIDENTIAL', 'ANONYMIZE_BEFORE_SEND', 'OpenAI, Anthropic (após anonimização)', 'Dado de negócio sensível do cliente (contratos, estrutura societária) — útil para IA somente após remoção de identificadores.'),
  ('FINANCIAL', 'ANONYMIZE_BEFORE_SEND', 'OpenAI, Anthropic (após anonimização)', 'Valores/lançamentos podem ser analisados por IA para insights, mas identificadores de conta/cliente devem ser removidos antes.'),
  ('FISCAL', 'ANONYMIZE_BEFORE_SEND', 'OpenAI, Anthropic (após anonimização)', 'Idem financeiro — dado fiscal agregado tem valor analítico, mas CPF/CNPJ/identificadores devem ser removidos antes.'),
  ('LABOR', 'NEVER_SEND', 'Nenhum', 'Dado trabalhista combina CPF, remuneração e dados de saúde/afastamento potenciais — risco LGPD elevado demais para qualquer provedor externo sem uma política de anonimização formalmente aprovada (fora do escopo desta sprint).'),
  ('PERSONAL_DATA', 'NEVER_SEND', 'Nenhum', 'Dado diretamente identificável (CPF, nome, e-mail) — nunca enviar em texto puro a provedor externo.'),
  ('RESTRICTED', 'NEVER_SEND', 'Nenhum', 'Conteúdo de upload/arquivo arbitrário, sem garantia do que contém — tratado com a mesma restrição de dado pessoal por padrão conservador.'),
  ('AUDIT', 'NEVER_SEND', 'Nenhum', 'audit_log.dados_antes/dados_depois pode conter cópia integral de qualquer campo de qualquer tabela auditada, inclusive de classificação mais restritiva — herda a mais alta restrição por transitividade.')
ON CONFLICT (classificacao) DO UPDATE SET
  politica_ia = EXCLUDED.politica_ia,
  provedores_permitidos = EXCLUDED.provedores_permitidos,
  justificativa = EXCLUDED.justificativa,
  updated_at = NOW();

-- ------------------------------------------------------------
-- ETAPA 7 — Consentimento (infraestrutura de registro; não altera
-- o fluxo de login/cadastro — nenhuma chamada é adicionada em
-- packages/lib nesta sprint).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_consents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id            UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  tipo_consentimento    VARCHAR(40) NOT NULL CHECK (tipo_consentimento IN (
                          'termos_uso', 'politica_privacidade', 'comunicacao_marketing', 'compartilhamento_dados_terceiros'
                        )),
  versao_aceita         VARCHAR(20) NOT NULL,
  aceito_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address            INET,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_consents IS
  'SEC-05: registro imutável de aceite de termos/política de privacidade por usuário/versão. Infraestrutura pronta para uso futuro pela aplicação — nenhuma chamada foi adicionada ao fluxo de login/cadastro nesta sprint.';

CREATE INDEX IF NOT EXISTS idx_user_consents_user ON public.user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_company ON public.user_consents(company_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_tipo ON public.user_consents(tipo_consentimento);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_rewrite
    WHERE rulename = 'user_consents_no_update'
      AND ev_class = 'public.user_consents'::regclass
  ) THEN
    CREATE RULE user_consents_no_update AS ON UPDATE TO public.user_consents DO INSTEAD NOTHING;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_rewrite
    WHERE rulename = 'user_consents_no_delete'
      AND ev_class = 'public.user_consents'::regclass
  ) THEN
    CREATE RULE user_consents_no_delete AS ON DELETE TO public.user_consents DO INSTEAD NOTHING;
  END IF;
END $$;

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_consents_select_own_or_admin ON public.user_consents;
CREATE POLICY user_consents_select_own_or_admin
ON public.user_consents FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_bba_admin());

DROP POLICY IF EXISTS user_consents_insert_own_or_admin ON public.user_consents;
CREATE POLICY user_consents_insert_own_or_admin
ON public.user_consents FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_bba_admin());

-- ------------------------------------------------------------
-- ETAPA 8 — Direitos do Titular (infraestrutura de rastreamento de
-- solicitação; nenhuma exportação/retificação/anonimização/
-- eliminação/portabilidade é executada por esta migration).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  requester_user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo_solicitacao      VARCHAR(30) NOT NULL CHECK (tipo_solicitacao IN (
                          'exportacao', 'retificacao', 'anonimizacao', 'eliminacao', 'portabilidade', 'restricao_tratamento'
                        )),
  status                VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN (
                          'pendente', 'em_analise', 'concluido', 'negado', 'cancelado'
                        )),
  descricao             TEXT,
  solicitado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluido_em          TIMESTAMPTZ,
  responsavel_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  observacoes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.data_subject_requests IS
  'SEC-05: rastreamento de solicitações de direitos do titular (LGPD art. 18). Somente infraestrutura de acompanhamento — a execução de cada tipo de solicitação (exportar/retificar/anonimizar/eliminar/portar/restringir) não é implementada nesta sprint.';

DROP TRIGGER IF EXISTS trg_data_subject_requests_upd ON public.data_subject_requests;
CREATE TRIGGER trg_data_subject_requests_upd
BEFORE UPDATE ON public.data_subject_requests
FOR EACH ROW EXECUTE FUNCTION public.bba_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_dsr_company ON public.data_subject_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_dsr_requester ON public.data_subject_requests(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_dsr_status ON public.data_subject_requests(status);

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dsr_select_own_or_admin ON public.data_subject_requests;
CREATE POLICY dsr_select_own_or_admin
ON public.data_subject_requests FOR SELECT TO authenticated
USING (requester_user_id = auth.uid() OR public.is_bba_admin());

DROP POLICY IF EXISTS dsr_insert_own_or_admin ON public.data_subject_requests;
CREATE POLICY dsr_insert_own_or_admin
ON public.data_subject_requests FOR INSERT TO authenticated
WITH CHECK (requester_user_id = auth.uid() OR public.is_bba_admin());

DROP POLICY IF EXISTS dsr_update_admin_only ON public.data_subject_requests;
CREATE POLICY dsr_update_admin_only
ON public.data_subject_requests FOR UPDATE TO authenticated
USING (public.is_bba_admin())
WITH CHECK (public.is_bba_admin());

DROP POLICY IF EXISTS dsr_delete_blocked ON public.data_subject_requests;
CREATE POLICY dsr_delete_blocked
ON public.data_subject_requests FOR DELETE TO authenticated
USING (false);

-- ------------------------------------------------------------
-- Integração aditiva com o SEC-04: reaproveita bba_audit_row_change()
-- (já existente, não redefinida aqui) para auditar mudanças nas
-- próprias tabelas de governança. Não modifica a migration do
-- SEC-04 nem as 21 tabelas/trigger já anexados por ela — apenas
-- anexa a mesma function, já compartilhável por design, a estas
-- tabelas novas.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'data_classification', 'data_catalog', 'data_retention_policy',
    'ai_data_governance', 'user_consents', 'data_subject_requests'
  ];
BEGIN
  IF to_regprocedure('public.bba_audit_row_change()') IS NULL THEN
    RAISE NOTICE 'bba_audit_row_change() not found (SEC-04 migration not applied yet) — skipping audit trigger wiring for SEC-05 governance tables.';
  ELSE
    FOREACH v_table IN ARRAY v_tables LOOP
      IF to_regclass('public.' || v_table) IS NOT NULL THEN
        EXECUTE format(
          'DROP TRIGGER IF EXISTS %1$I ON public.%2$I;
           CREATE TRIGGER %1$I
           AFTER INSERT OR UPDATE OR DELETE ON public.%2$I
           FOR EACH ROW EXECUTE FUNCTION public.bba_audit_row_change();',
          'trg_audit_' || v_table,
          v_table
        );
      END IF;
    END LOOP;
  END IF;
END $$;

-- ------------------------------------------------------------
-- Consultas de leitura convenientes (não substituem SEC-04; apenas
-- juntam classificação + catálogo + retenção para consumo externo,
-- ex.: pelo relatório de PIA ou por uma futura tela administrativa).
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.data_governance_overview AS
SELECT
  dc.table_name,
  dc.classificacao,
  dc.criticidade,
  dc.contem_dados_pessoais,
  dc.contem_dados_sensiveis,
  cat.finalidade,
  cat.proprietario,
  cat.tenant_scope,
  cat.retencao_categoria,
  rp.retencao_minima_anos,
  rp.retencao_recomendada_anos,
  cat.base_legal,
  ai.politica_ia AS politica_ia_recomendada
FROM public.data_classification dc
LEFT JOIN public.data_catalog cat ON cat.table_name = dc.table_name
LEFT JOIN public.data_retention_policy rp ON rp.categoria = cat.retencao_categoria
LEFT JOIN public.ai_data_governance ai ON ai.classificacao = dc.classificacao;

COMMENT ON VIEW public.data_governance_overview IS
  'SEC-05: leitura consolidada de classificação + catálogo + retenção + política de IA por tabela. View pura, sem RLS própria — herda RLS das tabelas de origem (todas com SELECT USING (true) para authenticated).';
