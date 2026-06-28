# BBA App MVP

Implementacao inicial do MVP Onda 1 descrito em `bba-app-mvp-especificacao.md`.

## O que ja esta pronto

- Monorepo com `apps/web`, `apps/mobile`, `packages/lib`, `packages/ui` e `packages/config`.
- Web em Next.js 14 com login, cadastro, painel, onboarding, board de tarefas e chat.
- Mobile Expo com painel, tarefas, chat e login inicial.
- Store Zustand compartilhado com dados demo para rodar antes do Supabase.
- Cliente Supabase, auth helpers, queries, chat realtime e migrations SQL.
- Edge Functions para notificacoes Expo de cliente e equipe BBA.

## Como rodar

Se `pnpm` ainda nao estiver disponivel no terminal:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

```bash
pnpm install
pnpm dev:web
```

O web app abre em `http://localhost:3000`. Sem variaveis Supabase, ele usa dados locais de demonstracao.

No Windows, para manter o servidor aberto fora do terminal temporario, use:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-web-server.ps1
```

Para parar o servidor na porta 3000:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/stop-web-server.ps1
```

Para mobile:

```bash
pnpm mobile
```

## Supabase

1. Crie o projeto no Supabase.
2. Copie `.env.example` para `.env.local` no web ou configure as variaveis no ambiente.
3. Rode `supabase/migrations/202507010001_initial_schema.sql` no SQL Editor.
4. Publique as functions em `supabase/functions/notify-client` e `supabase/functions/notify-bba-team`.

Variaveis esperadas:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

Use a Publishable Key (`sb_publishable_...`) nos clientes web/mobile e a Secret Key (`sb_secret_...`) apenas em ambiente servidor/Edge Functions.
