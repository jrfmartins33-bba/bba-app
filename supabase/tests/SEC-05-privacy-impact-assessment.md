# Privacy Impact Assessment (PIA) — BBA App

Gerado automaticamente como parte do SEC-05 — LGPD, Privacy & Data Governance. Baseado exclusivamente na leitura do schema real (`supabase/migrations/*.sql`) e nos dados registrados em `public.data_classification`/`public.data_catalog`/`public.data_retention_policy`/`public.ai_data_governance` (migration `202607030004_sec05_data_governance.sql`).

## 1. Mapa dos dados

71 tabelas no schema `public` + `auth.users` (Supabase Auth). 37 são tabelas de referência pública/paramétrica (`ref_*`, ex.: municípios, CNAE, faixas de INSS/IRPF) sem dado de tenant nem de pessoa física. As 35 restantes (mais `auth.users`) contêm dado operacional do relacionamento BBA-cliente, distribuído em 7 módulos: núcleo (profiles/companies/projects/onboarding), cadastro do cliente (client_*), contratos de serviço (service_*), financeiro, fiscal, RH e societário, além de chat/tarefas/notificações/relatórios e a própria trilha de auditoria (SEC-04).

Categorias de dado confirmadas por auditoria de coluna (não presumidas):
- **Dados pessoais diretos**: CPF em `client_socios.cpf_cnpj`, `societario_socios`, `rh_funcionarios.cpf`, `fiscal_notas_fiscais.emitente_cpf`/`destinatario_cpf`, `financial_cobrancas.pix_tipo_chave` (quando CPF); e-mail/nome em `profiles`/`auth.users`.
- **Dados financeiros**: `financial_contas`, `financial_lancamentos`, `financial_cobrancas`.
- **Dados fiscais**: `fiscal_obrigacoes`, `fiscal_guias`, `fiscal_notas_fiscais`, `fiscal_parcelamentos`.
- **Dados trabalhistas**: `rh_funcionarios` (cargo, situação, data de nascimento), `rh_folha_pagamentos` (remuneração individualizada, INSS/IRPF/FGTS descontados).
- **Uploads/documentos**: `client_documents`, `task_attachments`, `chat_attachments` — conteúdo de arquivo arbitrário, cujo teor exato não é garantido pelo schema (política conservadora: tratados como potencialmente pessoais/sensíveis).
- **Logs/auditoria**: `audit_log` (SEC-04) — pode conter cópia de qualquer campo de qualquer tabela auditada via `dados_antes`/`dados_depois`, herdando a sensibilidade mais alta possível.
- **Metadados**: campos `metadata JSONB` presentes em praticamente todas as tabelas de negócio, sem schema fixo — mesmo risco de conteúdo imprevisível dos uploads.
- **Integrações externas identificadas**: `supabase/functions/notify-client` e `notify-bba-team` enviam `title`/`body` (texto livre) e token de push a `https://exp.host` (Expo, infraestrutura fora do Brasil) — achado já registrado na auditoria P0/P1 anterior deste projeto, não alterado nesta sprint.
- **Envio futuro a IA**: nenhuma integração com OpenAI/Anthropic/outro provedor de IA foi encontrada no código atual — a governança criada nesta sprint (`ai_data_governance`) é preparatória, para quando essa integração existir.

## 2. Classificação

Ver `public.data_classification` (71+1 linhas) e a view `public.data_governance_overview`. Distribuição por classificação:

| Classificação | Contagem aproximada | Exemplos |
|---|---|---|
| PUBLIC | 39 (37 ref_* + fiscal_calendario + client_cnaes_secundarios) | ref_ufs, ref_cnae, fiscal_calendario |
| INTERNAL | 8 | projects, tasks, chat_channels, notifications |
| CONFIDENTIAL | 8 | companies, client_companies, service_contracts, societario_capital_social/alteracoes/assembleias, reports_snapshots, chat_messages |
| RESTRICTED | 3 | client_documents, task_attachments, chat_attachments |
| FINANCIAL | 4 | financial_contas/categorias/lancamentos/cobrancas |
| FISCAL | 5 | fiscal_obrigacoes/guias/notas_fiscais/parcelamentos + societario_* (4, por proximidade — ver seção 6) |
| LABOR | 2 | rh_funcionarios, rh_folha_pagamentos |
| PERSONAL_DATA | 3 | profiles, client_socios, societario_socios, auth.users |
| AUDIT | 1 | audit_log |

## 3. Riscos identificados

1. **Uploads/anexos de conteúdo arbitrário** (`client_documents`, `task_attachments`, `chat_attachments`) — o schema não garante o que foi enviado; um usuário pode anexar um documento com dado de terceiro (ex.: CPF de dependente) sem que a plataforma tenha como prever. Mitigador: classificação conservadora RESTRICTED + política de IA `NEVER_SEND`.
2. **`chat_messages` como canal de texto livre** — conversas operacionais podem conter dado pessoal incidental além do necessário para a prestação do serviço. Mitigador: classificação CONFIDENTIAL, base legal marcada `REVIEW_REQUIRED` no catálogo (não presumida como puramente contratual).
3. **`audit_log` como amplificador de sensibilidade** — por desenho (SEC-04), `dados_antes`/`dados_depois` replica qualquer campo de qualquer tabela auditada, inclusive folha de pagamento e CPF. Mitigador: classificação AUDIT com política de IA `NEVER_SEND` e RULEs de imutabilidade já existentes (SEC-04).
4. **Retenção trabalhista com prazo potencialmente maior que o padrão fiscal** — ações trabalhistas/previdenciárias podem ter prazo de guarda superior a 5 anos. Registrado explicitamente como `REVIEW REQUIRED` (não decidido unilateralmente) em `data_retention_policy.observacoes` da categoria Trabalhista.
5. **Backup de infraestrutura fora do alcance do schema** — a retenção real de backups é definida no plano/configuração do Supabase, não observável por este projeto. Registrado como `REVIEW REQUIRED` na categoria Backups.
6. **Integração de notificação push já existente envia dado a serviço fora do Brasil** (Expo) — achado herdado da auditoria P0/P1 anterior; não foi alterado nem mitigado nesta sprint (fora de escopo — nenhuma função/edge function foi tocada em SEC-05).
7. **Ausência de categoria "Societário" na lista fixa de retenção da Etapa 5** — `client_socios`/`societario_*` foram mapeados para "Fiscal" por proximidade de prazo legal, decisão explícita e documentada (não inventada), não uma categoria própria.

## 4. Mitigadores já implementados nesta sprint

- Classificação e catálogo completos e consultáveis (`data_governance_overview`).
- Política de IA por classificação, com bloqueio explícito (`NEVER_SEND`) para dado trabalhista, pessoal, de upload arbitrário e de auditoria.
- Infraestrutura de consentimento imutável (`user_consents`), pronta para uso quando a aplicação decidir capturar aceite de termos.
- Infraestrutura de rastreamento de direitos do titular (`data_subject_requests`), com fluxo de aprovação restrito a `bba_admin`.
- Reaproveitamento da trilha de auditoria do SEC-04 nas próprias tabelas de governança (mudança de classificação/retenção/catálogo agora é auditável).

## 5. Bases legais

Ver `public.data_catalog.base_legal`. Predominância: `execucao_contrato` (dado necessário para prestar o serviço contratado) e `obrigacao_legal` (dado fiscal/trabalhista/societário que a BBA processa para cumprir obrigação regulatória em nome do cliente). Dois registros marcados explicitamente `REVIEW_REQUIRED` (`chat_messages`, `reports_snapshots`) por não ser possível determinar com segurança uma base única a partir do schema.

## 6. Decisões documentadas (não inventadas silenciosamente)

- `client_socios`/`societario_*` classificados na categoria de retenção "Fiscal" por não existir categoria "Societário" na lista fixa fornecida pela Etapa 5 — decisão explícita, registrada em `observacoes`.
- `contem_dados_pessoais`/`contem_dados_sensiveis` marcados `TRUE` por padrão conservador em tabelas de conteúdo arbitrário (uploads, chat, audit_log), já que o schema não pode provar ausência de dado pessoal.
- Retenção de Backups marcada como fora do escopo observável pelo schema, com `REVIEW REQUIRED` explícito em vez de um número inventado.

## 7. Pendências

- Confirmar com jurídico o prazo de retenção trabalhista definitivo (hoje: mínimo 5 anos, recomendado 20, com ressalva).
- Confirmar política de retenção de backup diretamente no Supabase.
- Avaliar formalmente a base legal de `chat_messages` e `reports_snapshots` (hoje `REVIEW_REQUIRED`).
- Decidir se a integração de notificação push (Expo) deve ser revisada à luz de transferência internacional de dados — fora do escopo desta sprint, apenas registrado.
- Nenhuma anonimização, exportação, retificação, eliminação, portabilidade ou restrição de tratamento foi implementada — apenas a estrutura de rastreamento (`data_subject_requests`) e as tabelas de política (`data_retention_policy`). A execução dessas funcionalidades é trabalho futuro.

## 8. Recomendações

1. Formalizar com jurídico as duas pendências de `REVIEW_REQUIRED` de base legal e a retenção trabalhista antes de operar com volume real de clientes.
2. Priorizar a instrumentação de `user_consents` no fluxo real de cadastro/login **em uma sprint de aplicação separada** (fora do escopo de banco desta sprint).
3. Priorizar a construção de um endpoint/processo administrativo que leia `data_subject_requests` pendentes e permita à equipe BBA processá-las manualmente, antes de qualquer automação de exportação/eliminação.
4. Revisar a integração com Expo (push notification) quanto a base legal de transferência internacional, já que dado de push token e conteúdo de notificação podem incluir dado pessoal.
