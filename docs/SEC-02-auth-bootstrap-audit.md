# SEC-02 — Auth → Profile → Company → Dashboard audit

## Escopo

Este documento descreve o fluxo atual de autenticação e bootstrap para o app BBA, com foco em segurança, determinismo e prevenção de contas zumbi.

## Fluxo atual

1. O usuário preenche o cadastro em [apps/web/app/(auth)/cadastro/page.tsx](apps/web/app/(auth)/cadastro/page.tsx).
2. O formulário chama o helper compartilhado [packages/lib/src/auth.ts](packages/lib/src/auth.ts) para criar o usuário no Supabase Auth.
3. O trigger de schema [supabase/migrations/202506280001_bba_app_core_schema.sql](supabase/migrations/202506280001_bba_app_core_schema.sql) cria um registro inicial em `profiles` para o usuário autenticado.
4. O helper de cadastro tenta criar a `company`, atualizar o `profile` com `company_id`, e então criar onboarding/channels/project.
5. O store em [packages/lib/src/store.ts](packages/lib/src/store.ts) hidrata a sessão e tenta carregar `profile` + `company` para o dashboard.
6. O shell do dashboard em [apps/web/components/bba-dashboard-shell.tsx](apps/web/components/bba-dashboard-shell.tsx) usa essa hidratação para decidir se o acesso é válido.

## Risco identificado

O fluxo de cadastro não é atômico. O usuário pode existir no Auth, mas o bootstrap do `company`/`profile`/onboarding pode falhar em qualquer ponto. Antes desta correção, o app podia continuar com um estado parcial e o store assumia que a sessão já estava pronta.

## Causa raiz provável do login quebrado

A falha mais provável está no estado de bootstrap inconsistente: o Auth cria a conta e o trigger cria o `profile`, mas o cadastro do app tenta montar o restante do contexto em passos separados. Se um destes passos falhar, o usuário fica com uma sessão que não tem o estado esperado pelo app, o que gera comportamento inconsistente ao entrar e ao hidratar o dashboard.

## Correções aplicadas

- O helper de signup em [packages/lib/src/auth.ts](packages/lib/src/auth.ts) agora tenta remover a conta do Auth se qualquer etapa do bootstrap falhar.
- O store em [packages/lib/src/store.ts](packages/lib/src/store.ts) agora rejeita sessões sem `profile` completo e `company` vinculada para clientes.
- O fluxo de login agora não considera uma sessão válida quando o bootstrap ainda está incompleto.

## Arquivos auditados

- [apps/web/app/(auth)/cadastro/page.tsx](apps/web/app/(auth)/cadastro/page.tsx)
- [apps/web/app/(auth)/login/page.tsx](apps/web/app/(auth)/login/page.tsx)
- [apps/web/components/bba-dashboard-shell.tsx](apps/web/components/bba-dashboard-shell.tsx)
- [packages/lib/src/auth.ts](packages/lib/src/auth.ts)
- [packages/lib/src/store.ts](packages/lib/src/store.ts)
- [supabase/migrations/202506280001_bba_app_core_schema.sql](supabase/migrations/202506280001_bba_app_core_schema.sql)

## Validação

- Typecheck executado com sucesso via `pnpm --filter @bba/lib typecheck`.

## Pendências

- Validar o fluxo end-to-end com credenciais reais do Supabase Auth para confirmar que a remoção de conta zumbi e o login pós-cadastro funcionam em ambiente real.
