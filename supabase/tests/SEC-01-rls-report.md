# SEC-01 — Multi-Tenant Security & RLS Tests

## Escopo
- Foco exclusivo em RLS, isolamento tenant e testes automatizados.
- Não foram alteradas camadas de business logic, UI ou BDOS core.

## Tabelas auditadas
- Core / tenant: profiles, companies, projects, onboarding_steps, tasks, chat_channels, chat_messages
- Cliente / onboarding / contratos: client_companies, client_socios, client_cnaes_secundarios, client_documents, service_contracts, service_scope_items, onboarding_checklist
- Fiscal: fiscal_obrigacoes, fiscal_guias, fiscal_notas_fiscais, fiscal_parcelamentos
- Financeiro: financial_contas, financial_categorias, financial_lancamentos, financial_cobrancas
- RH: rh_funcionarios, rh_folha_pagamentos
- Societário: societario_socios, societario_capital_social, societario_alteracoes, societario_assembleias
- Chat / notificações / relatórios: chat_read_state, notifications, reports_snapshots, audit_log

## Padrão atual de isolamento observado
- `auth.uid()` para linhas próprias do usuário.
- `profiles.company_id` como fonte principal para inferir o tenant atual.
- `companies.owner_id` para acesso da empresa dona.
- `is_bba_admin()` para bypass administrativo explícito.
- `get_my_company_id()` para tabelas core com `company_id`.
- Subqueries inline em políticas (`company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())`).

## Risco encontrado
- Risco real de cliente A mudar o próprio `profiles.company_id` e, assim, passar a operar sob outro tenant.
- Esse contorno afeta qualquer política que use `get_my_company_id()` ou `profiles.company_id` para restringir o acesso.
- O risco foi mitigado com uma trigger de atualização e uma política de UPDATE mais restritiva para `profiles`.

## Alterações feitas
- Adicionada a migration [supabase/migrations/202607030001_rls_tenant_hardening.sql](supabase/migrations/202607030001_rls_tenant_hardening.sql)
  - bloqueia atualização de `company_id` e `role` por clientes comuns
  - preserva o acesso de `bba_admin`
- Criado o script de testes [supabase/tests/rls_tenant_isolation.sql](supabase/tests/rls_tenant_isolation.sql)
  - cobre leitura, update, delete, autopromoção e acesso admin

## Testes criados
- Cliente A não lê dados do Cliente B.
- Cliente A não atualiza dados do Cliente B.
- Cliente A não deleta dados do Cliente B.
- Cliente A acessa somente sua própria company.
- Cliente A acessa somente seu próprio profile.
- BBA admin acessa todos os tenants quando permitido.
- Cliente não consegue se autopromover para `bba_admin`.

## Validação executada
- Validação estática dos arquivos SQL via análise do workspace: sem erros.
- Typecheck do monorepo executado com sucesso via `pnpm typecheck`.
- Execução real do script SQL no Supabase não foi possível neste ambiente porque não há instância local do Supabase/Docker disponível.

## Pendências
- Aplicar a migration no ambiente Supabase alvo.
- Executar [supabase/tests/rls_tenant_isolation.sql](supabase/tests/rls_tenant_isolation.sql) no SQL Editor do projeto.
- Confirmar os UUIDs do seed demo e o estado do banco antes da execução.

## Status final
- SEC-01 foi implementado no código com hardening de tenant e testes mínimos.
- A validação funcional completa depende da execução no ambiente Supabase com dados reais ou de demo.
