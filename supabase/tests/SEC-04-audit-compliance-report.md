# SEC-04 — Audit & Compliance

## Escopo
- Foco exclusivo em auditoria estrutural, rastreabilidade e compliance.
- Não foram alteradas: RLS existente (nenhuma `DROP POLICY`/`CREATE POLICY` sobre policy já existente), BDOS core (`packages/bdos-core` não foi tocado), Decision Engine, LGPD/retenção com enforcement (reservado ao SEC-05), UI, APIs públicas.
- `audit_log` (existente desde `202506290008_modules_financeiro_tarefas_chat.sql`) foi **evoluída**, não substituída por estrutura paralela.

## Fase 1 — Auditoria do estado atual

### O que já existia (confirmado por leitura direta das migrations)
- **`audit_log`**: schema já rico (`acao`, `entidade`, `entidade_id`, `dados_antes`, `dados_depois`, `campos_alterados`, `ip_address`, `user_agent`, `sessao_id`, `origem`, `created_at`). **Imutabilidade já garantida** via `CREATE RULE audit_no_update ... DO INSTEAD NOTHING` / `audit_no_delete` (mesma migration). RLS: `audit_sel` (leitura restrita a `company_id`/`user_id` próprios — **sem bypass para `is_bba_admin()`**) e `audit_ins` (`WITH CHECK (true)` — qualquer autenticado insere qualquer linha).
- **Nenhum trigger em nenhuma tabela do projeto jamais escreveu em `audit_log`** — confirmado por grep em todas as migrations: os únicos triggers existentes são de `updated_at` (`set_updated_at`/`bba_set_updated_at`, duplicados mas equivalentes), `handle_new_user` (cria `profiles` a partir de `auth.users`), `profiles_enforce_tenant_boundaries` e `companies_validate_owner_and_account_owner` (SEC-01/SEC-03, validação de integridade — não gravam auditoria). Nenhum caminho de aplicação (grep em `apps/web`, `packages/lib`) grava em `audit_log` também. **Era infraestrutura 100% inerte.**
- **`notifications`**: schema pronto (tipo, título, corpo, lida, push/email/whatsapp), sem relação com auditoria — é notificação de produto, não trilha de auditoria.
- **Cobertura de `updated_at`**: todas as tabelas com coluna `updated_at` têm trigger correspondente (`bba_set_updated_at()`/`set_updated_at()`). As únicas duas exceções encontradas (`client_cnaes_secundarios`, `fiscal_calendario`) foram verificadas linha a linha e **não têm coluna `updated_at`** — não são gaps reais, são tabelas de referência/lista sem necessidade de atualização.
- **`created_at`**: presente em 100% das tabelas do projeto.
- **Convite de usuário / aceite de convite**: não existe nenhum fluxo de convite implementado em nenhuma camada (grep vazio em migrations e app) — documentado na arquitetura (Fase 3), sem nada a instrumentar hoje.
- **Exclusão lógica**: não existe nenhuma coluna `deleted_at`/`is_deleted` em nenhuma tabela do schema — toda exclusão hoje é física (hard delete), quando permitida por RLS (várias tabelas bloqueiam DELETE por padrão, ex. `rh_funcionarios`/`rh_folha_pagamentos` não têm policy de DELETE, logo RLS nega por padrão). O novo trigger captura DELETE físico (única forma de exclusão que existe hoje).
- **`quem altera dados`**: rastreável hoje apenas por `updated_at`/`created_by` pontuais (ex. `client_documents.created_by`, `service_contracts.responsavel_bba_id`) — sem histórico de mudanças (`dados_antes`/`dados_depois`) em lugar nenhum antes desta migration.
- Já existiam duas migrations de hardening recentes que este trabalho **reaproveita sem alterar**: `202607030001_rls_tenant_hardening.sql` (SEC-01, bloqueia cliente trocar `company_id`/`role`) e `202607030002_data_integrity_hardening.sql` (SEC-03, valida `owner_id`/`account_owner_id` e adiciona `CHECK`s de valor/data não-negativos em financeiro/fiscal/RH/societário).

### Operações críticas que hoje não deixavam evidência (antes desta migration)
Login, logout, alteração de e-mail, redefinição de senha, qualquer INSERT/UPDATE/DELETE em profiles/companies/financeiro/fiscal/RH/societário/onboarding/contratos, troca de owner/account_owner, mudança de role.

## Fase 2 — Arquitetura proposta

Uma única arquitetura, evoluindo `audit_log` em vez de criar tabela paralela. Mapeamento conceitual → físico:

| Conceito (Fase 2) | Coluna física | Status |
|---|---|---|
| `AuditEvent` | a linha de `audit_log` | existente |
| `AuditActor` | `user_id` (existente) + `ator_tipo` (novo) | evoluído |
| `AuditEntity` | `entidade` + `entidade_id` | existente |
| `AuditAction` | `acao` | existente (enum já cobre tudo) |
| `AuditSource` / origin | `origem` | existente — os dois conceitos colapsam numa coluna só (evita duplicar semântica) |
| `AuditSeverity` | `severidade` (novo) | classificado por `bba_audit_severity_for()` |
| `AuditContext`/`AuditMetadata` | `metadata` (novo, JSONB) | consolidado numa coluna só, mesmo padrão já usado em `profiles.metadata`/`companies.metadata` |
| `AuditCorrelationId` | `correlacao_id` (novo) | preservado ponta-a-ponta |
| `AuditRetention` | `audit_log_retention_status()` | definição, sem enforcement (SEC-05) |

Classificação de criticidade (`bba_audit_severity_for`): CRITICAL para UPDATE/DELETE em tabelas financeiras/fiscais/societárias de maior impacto; HIGH para UPDATE/DELETE em RH/sócios/companies/profiles/contratos e para qualquer DELETE; MEDIUM para LOGIN e demais UPDATE; LOW para INSERT.

## Fase 3 — Eventos obrigatórios: cobertura real

| Evento pedido | Mecanismo | Status |
|---|---|---|
| Login | trigger em `auth.users` (`last_sign_in_at`) | ✅ automático, independe de código de app |
| Logout | — | ⚠️ não observável em `auth.users`; requer chamada explícita de app ao RPC `log_audit_event` (pendência, ver abaixo) |
| Cadastro / Criação de empresa | trigger genérico em `profiles`/`companies` (INSERT) | ✅ automático |
| Alteração de profile / Mudança de role | trigger genérico em `profiles` (UPDATE) | ✅ automático |
| Troca de owner / account_owner | trigger genérico em `companies` (UPDATE, `campos_alterados` inclui `owner_id`/`account_owner_id`) | ✅ automático |
| Criação/alteração de contrato | trigger genérico em `service_contracts` | ✅ automático |
| Upload de documento | trigger genérico em `client_documents` (INSERT) | ✅ automático |
| Exclusão lógica | — | ⚠️ mecanismo de soft-delete não existe no schema (nenhuma tabela tem `deleted_at`); DELETE físico é capturado pelo trigger genérico |
| Alteração financeira/fiscal/societária | trigger genérico nas 4 tabelas financeiras, 4 fiscais, 4 societárias | ✅ automático |
| Alteração de permissões | trigger genérico em `profiles` (UPDATE de `role`) | ✅ automático (e já bloqueado para clientes por SEC-01, então só admin consegue gerar esse evento) |
| Reset de senha | trigger em `auth.users` (`encrypted_password`) | ✅ automático, cobre inclusive fluxo de recovery por e-mail do próprio Supabase |
| Alteração de e-mail | trigger em `auth.users` (`email`) | ✅ automático |
| Convite de usuário / Aceite de convite | — | não existe fluxo de convite implementado no projeto hoje; documentado, nada a instrumentar |

## Fase 4 — Integridade

- **Logs nunca alterados/apagados pelo cliente**: já garantido pelas RULEs `audit_no_update`/`audit_no_delete` existentes (não recriadas, apenas confirmadas e testadas nesta sprint).
- **Campos obrigatórios por evento** — mapeados na tabela da Fase 2; todos presentes fisicamente.
- **Falha de auditoria nunca bloqueia a operação real**: todo `PERFORM log_audit_event(...)` dentro dos triggers roda dentro de um bloco `BEGIN ... EXCEPTION WHEN OTHERS ... END` isolado (savepoint implícito do PL/pgSQL) — uma exceção na gravação da auditoria vira `RAISE WARNING`, nunca aborta o `INSERT`/`UPDATE`/`DELETE` de negócio nem o login. Isto foi tratado com atenção redobrada no trigger de `auth.users`, dado que uma falha ali poderia derrubar o login de todos os usuários — exatamente a classe de risco já investigada anteriormente neste projeto.
- **Nenhum `Date.now()` na camada BDOS**: `packages/bdos-core` não foi tocado nesta sprint (confirmado — `pnpm typecheck` rodou sem tocar nesse pacote). Toda geração de timestamp usa `NOW()` do Postgres, mesmo padrão já usado em 100% das tabelas existentes do projeto.

## Fase 5 — Banco

### Arquivo criado
`supabase/migrations/202607030003_sec04_audit_compliance.sql`

### Colunas adicionadas (aditivas, `IF NOT EXISTS`)
`audit_log.correlacao_id` (UUID), `audit_log.severidade` (VARCHAR + CHECK), `audit_log.ator_tipo` (VARCHAR + CHECK), `audit_log.metadata` (JSONB NOT NULL DEFAULT '{}')

### Functions criadas
- `bba_audit_severity_for(entidade, acao)` — classificação determinística de criticidade.
- `log_audit_event(...)` — único caminho sancionado de escrita em `audit_log`. `SECURITY DEFINER`, deriva `user_id` de `auth.uid()` (não confia em valor informado pelo chamador — não permite impersonação), deriva `company_id` do profile do chamador quando não informado explicitamente. `GRANT EXECUTE` para `authenticated`.
- `bba_audit_row_change()` — trigger genérico reusável de captura de INSERT/UPDATE/DELETE, calcula `campos_alterados` via diff de `to_jsonb(NEW)`/`to_jsonb(OLD)`, ignora updates sem mudança real.
- `bba_audit_auth_user_change()` — trigger de `auth.users`, captura LOGIN/troca de e-mail/reset de senha.
- `get_audit_log_for_admin(company_id, limit)` — leitura cross-tenant restrita a `is_bba_admin()`, **sem alterar a policy `audit_sel` existente**.
- `audit_log_retention_status()` — define (não executa) a política de retenção por categoria de entidade, restrita a `is_bba_admin()`.

### Triggers criadas
- `trg_audit_<tabela>` em 21 tabelas: `profiles`, `companies`, `financial_contas`, `financial_categorias`, `financial_lancamentos`, `financial_cobrancas`, `fiscal_obrigacoes`, `fiscal_guias`, `fiscal_notas_fiscais`, `fiscal_parcelamentos`, `rh_funcionarios`, `rh_folha_pagamentos`, `societario_socios`, `societario_capital_social`, `societario_alteracoes`, `societario_assembleias`, `client_companies`, `client_socios`, `client_documents`, `service_contracts`, `onboarding_checklist` — criadas dinamicamente via `DO $$ ... FOREACH ... $$` com checagem `to_regclass()` (não falha se alguma tabela não existir no ambiente).
- `trg_audit_auth_users` — `AFTER UPDATE ON auth.users`, mesmo padrão de trigger em `auth.*` já usado por `handle_new_user()`.

**Deliberadamente não instrumentado**: `chat_messages`/`chat_channels` (já imutáveis por RLS `USING (false)`, baixa prioridade), `tasks`/`projects` (não citados no escopo da Fase 1, alto volume), `notifications`/`reports_snapshots`/`task_templates` (baixa criticidade), `fiscal_calendario`/`client_cnaes_secundarios` (dados de referência/lista, não têm `updated_at`), tabelas `ref_*` (dados de referência somente leitura).

### Constraints criadas
`audit_log_severidade_check`, `audit_log_ator_tipo_check` (ambas com guarda `IF NOT EXISTS` contra `pg_constraint`).

### Indexes criados
`idx_audit_correlacao`, `idx_audit_severidade`, `idx_audit_company_created` (composto, `company_id, created_at DESC` — otimiza a consulta mais comum: timeline de um tenant).

### Reaproveitado sem alteração
`is_bba_admin()`, `audit_no_update`/`audit_no_delete` RULEs, policies `audit_sel`/`audit_ins`, `handle_new_user()`, `profiles_enforce_tenant_boundaries()`, `companies_validate_owner_and_account_owner()`, `set_updated_at()`/`bba_set_updated_at()`.

## Fase 6 — Testes

### Arquivo criado
`supabase/tests/audit/audit-log.test.mjs` — mesmo padrão de `supabase/tests/rls/tenant-isolation.test.mjs` (sessões reais via `@supabase/supabase-js`, `node --test`, mesmas variáveis de ambiente e usuários demo).

### Casos cobertos
1. Imutabilidade — UPDATE em `audit_log` não persiste (RULE).
2. Imutabilidade — DELETE em `audit_log` não persiste (RULE).
3. Tenant isolation — cliente A não lê `audit_log` de company B (policy `audit_sel` existente).
4. `log_audit_event()` — deriva `user_id`/`company_id` do chamador (não spoofável), preserva `correlacao_id`, classifica `severidade`, registra `ator_tipo`.
5. Integridade ponta-a-ponta — INSERT real em `client_documents` gera exatamente uma linha em `audit_log` com `acao='INSERT'` e `dados_depois` correto.
6. Admin access (negativo) — cliente comum não consegue chamar `get_audit_log_for_admin()`.
7. Admin access (positivo) — `bba_admin` lê `audit_log` cross-tenant via `get_audit_log_for_admin()`.
8. Retenção (negativo) — cliente comum não consegue chamar `audit_log_retention_status()`.
9. Retenção (positivo) — `bba_admin` lê a política de retenção definida (5 anos fiscal/trabalhista/societário, 2 anos operacional).

## Validações executadas

- **Sintaxe JS do teste**: `node --check supabase/tests/audit/audit-log.test.mjs` → **OK**.
- **`pnpm typecheck`**: executado no monorepo inteiro → **4/4 pacotes com sucesso** (`@bba/bdos-core`, `@bba/lib`, `@bba/mobile`, `@bba/web`), confirmando que nada em TypeScript foi afetado/quebrado.
- **Revisão estática manual da SQL, linha a linha**: encontrou e corrigiu dois defeitos reais antes de finalizar:
  1. Uma função (`audit_log_retention_status`) tinha um `IF`/`RAISE EXCEPTION` procedural dentro de um corpo `LANGUAGE sql` — sintaticamente inválido; corrigida para `LANGUAGE plpgsql`.
  2. Interpolação de nomes de tabela/trigger na `DO $$` de anexação usava `%s` (substituição de string simples) em vez de `%I` (identificador seguro) — corrigido, mesmo os valores sendo hoje uma lista fixa e não input externo.
- **Execução real contra um Supabase ao vivo**: **não foi possível neste ambiente** — não há instância local do Supabase/Docker nem `psql` disponíveis (mesma limitação já documentada no relatório do SEC-01). Nenhuma alegação de "testado e passou" é feita para a execução real; apenas a validação estática acima foi de fato executada.

## Instruções exatas de validação no SQL Editor / ambiente Supabase alvo

1. Aplicar a migration, na ordem, junto com as demais pendentes: `202607030001_rls_tenant_hardening.sql` → `202607030002_data_integrity_hardening.sql` → `202607030003_sec04_audit_compliance.sql` (esta é aditiva e idempotente — usa `IF NOT EXISTS`/`CREATE OR REPLACE`/`DROP TRIGGER IF EXISTS` em todos os pontos, segura para reaplicar).
2. No SQL Editor, gerar um evento de teste manualmente:
   ```sql
   update public.companies set name = name where id = 'eeeeeeee-0000-0000-0000-000000000001';
   select * from public.audit_log where entidade = 'companies' order by created_at desc limit 5;
   ```
   Confirmar que **nenhuma** linha nova aparece (é um update sem mudança real — o trigger deve ignorar).
3. Repetir com uma mudança real:
   ```sql
   update public.companies set segment = 'Teste SEC-04' where id = 'eeeeeeee-0000-0000-0000-000000000001';
   select acao, entidade, campos_alterados, severidade, dados_antes, dados_depois from public.audit_log where entidade = 'companies' order by created_at desc limit 1;
   ```
   Confirmar `acao='UPDATE'`, `campos_alterados` contém `segment`, `dados_antes`/`dados_depois` corretos.
4. Confirmar imutabilidade:
   ```sql
   update public.audit_log set descricao = 'tampered' where entidade = 'companies';
   select descricao from public.audit_log where entidade = 'companies' order by created_at desc limit 1;
   ```
   `descricao` não deve ter mudado.
5. Rodar a suíte automatizada (requer as mesmas variáveis de ambiente já documentadas em `supabase/tests/rls/.env.example`):
   ```bash
   export SUPABASE_URL=...
   export SUPABASE_ANON_KEY=...
   export RLS_TEST_CLIENT_A_EMAIL=carlos@carlosmendes.com.br
   export RLS_TEST_CLIENT_A_PASSWORD=Teste123!
   export RLS_TEST_CLIENT_B_EMAIL=vitoria@vitoriamodas.com.br
   export RLS_TEST_CLIENT_B_PASSWORD=Teste123!
   export RLS_TEST_ADMIN_EMAIL=admin@bbabrazil.com.br
   export RLS_TEST_ADMIN_PASSWORD=BBAadmin2025!
   node --test supabase/tests/audit/audit-log.test.mjs
   ```
6. Testar login real de qualquer usuário demo e conferir:
   ```sql
   select acao, entidade, descricao, created_at from public.audit_log where acao = 'LOGIN' order by created_at desc limit 5;
   ```

## Pendências

1. **LOGOUT não é capturado automaticamente** — só é observável se a aplicação chamar explicitamente `supabase.rpc('log_audit_event', { p_acao: 'LOGOUT', ... })` a partir de `signOut()` em `packages/lib/src/store.ts`. Essa mudança em código de aplicação está **fora do escopo desta sprint** (SEC-04 foi definida como DB-only: "não criar telas", "não criar APIs públicas") e fica como próximo passo natural, não implementado aqui.
2. **`EXPORT`/`VIEW_SENSITIVE`** (visualização de dado sensível como folha de pagamento ou nota fiscal) também dependem de chamada explícita ao RPC a partir do código de aplicação que exibe esses dados — mesma razão do item 1, mesmo escopo de "próxima sprint de aplicação".
3. **Gap de RLS não corrigido, apenas contornado**: a policy `audit_sel` não dá visão cross-tenant a `is_bba_admin()` (só enxerga linhas do próprio `user_id`/`company_id`). Não foi alterada porque a sprint proíbe explicitamente mexer em RLS — o contorno via `get_audit_log_for_admin()` (SECURITY DEFINER) resolve o caso de uso, mas a policy em si continua estruturalmente inconsistente com o resto do sistema (que usa `OR is_bba_admin()` em toda outra tabela). Recomenda-se corrigir isso numa sprint futura de RLS (SEC-01-like).
4. **`audit_ins` permite `WITH CHECK (true)`** — qualquer usuário autenticado pode inserir uma linha em `audit_log` diretamente (não só via `log_audit_event()`), inclusive com `company_id`/`user_id` arbitrários. Não corrigido pela mesma razão do item 3 (não alterar RLS). O caminho sancionado (`log_audit_event()`) é seguro por si só (deriva os campos sensíveis do `auth.uid()` real), mas o caminho antigo/direto continua aberto. Recomenda-se, numa sprint futura de RLS, restringir `audit_ins` a negar inserts diretos de `authenticated` (forçando todo mundo a passar por `log_audit_event()`).
5. **Retenção definida, não executada**: `audit_log_retention_status()` só reporta o que está além do prazo — não expurga nem anonimiza nada. Enforcement é explicitamente escopo do SEC-05/LGPD.
6. **Execução real contra o Supabase não foi possível neste ambiente** — falta instância local/Docker. As instruções da seção anterior devem ser seguidas manualmente no ambiente alvo antes de considerar isto validado em produção.
7. **Duplicação pré-existente não tocada**: `set_updated_at()` vs `bba_set_updated_at()` (mesma função, dois nomes) — identificada na Fase 1, não é escopo desta sprint corrigir, apenas registrada.

## Status final

SEC-04 foi implementado no código com uma arquitetura única de auditoria evoluindo a `audit_log` já existente, cobrindo 21 tabelas de negócio mais `auth.users` via triggers automáticos, uma função canônica de escrita, uma via de leitura administrativa cross-tenant e uma definição de política de retenção — tudo sem alterar RLS, BDOS, Decision Engine ou LGPD/SEC-05, e sem criar estrutura paralela à `audit_log` existente. `pnpm typecheck` passou sem erros. A validação funcional completa depende da aplicação da migration num ambiente Supabase real (local ou de homologação), o que não foi possível neste ambiente — mesma limitação documentada no SEC-01.
