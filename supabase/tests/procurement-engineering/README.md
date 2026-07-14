# Testes reais de Engenharia de Custos e Licitações (Sprint 21.3C)

Estes quatro arquivos exercitam persistência real contra um projeto Supabase
de verdade — nunca contra um fake em memória. Por isso ficam fora do glob
`*.test.ts` que `pnpm test`/CI descobrem automaticamente (mesma convenção de
`supabase/tests/rls`): exigem rede, um projeto Supabase real, e credenciais
próprias, nunca as do ambiente normal da aplicação.

- `procurement-engineering-integration.test.mjs` — ciclo completo (Processo,
  Lote, Versão, hierarquia, concorrência real via RPC, rollback, recarregar →
  alterar → salvar novamente).
- `procurement-engineering-isolation.test.mjs` — isolamento entre duas
  organizações usuárias, na camada de aplicação e em RLS pura.
- `procurement-engineering-write-boundary.test.mjs` — confirma que toda
  mutação direta nas tabelas (sem passar pelas funções protegidas) falha, e
  que a mesma operação, feita pela função autorizada, passa.
- `lagoa-do-arroz-persistence.test.mjs` — persiste a fixture oficial (336
  linhas) e confirma o total exato de R$ 9.809.087,18 após recarregar.

## Ambiente obrigatório

**Nunca aponte estes testes para o ambiente normal da aplicação.** Use um
projeto Supabase dedicado a testes, ou pelo menos usuários de teste dedicados
num projeto que você controla — nunca reaproveite `NEXT_PUBLIC_SUPABASE_URL`/
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de `apps/web/.env.local` como
alternativa.

Toda variável abaixo é **obrigatória** — nenhum teste tem valor-padrão, email,
senha ou identificador embutido no código. Faltando qualquer uma, o teste
falha imediatamente, antes de tentar autenticar ou tocar no banco.

```bash
export BDOS_ALLOW_DESTRUCTIVE_INTEGRATION_TESTS=true   # confirmação explícita — este bloco grava e apaga dados reais

export SUPABASE_TEST_URL=...
export SUPABASE_TEST_ANON_KEY=...
export SUPABASE_TEST_SERVICE_ROLE_KEY=...              # somente para limpeza automática — nunca sujeito dos testes

export RLS_TEST_CLIENT_A_EMAIL=...
export RLS_TEST_CLIENT_A_PASSWORD=...
export RLS_TEST_CLIENT_A_ID=...                        # auth.users.id do usuário de teste A
export RLS_TEST_COMPANY_A_ID=...                       # companies.id da organização de teste A

# Necessário apenas para procurement-engineering-isolation.test.mjs:
export RLS_TEST_CLIENT_B_EMAIL=...
export RLS_TEST_CLIENT_B_PASSWORD=...
export RLS_TEST_CLIENT_B_ID=...
export RLS_TEST_COMPANY_B_ID=...
```

## Execução

```bash
npx tsx supabase/tests/procurement-engineering/procurement-engineering-integration.test.mjs
npx tsx supabase/tests/procurement-engineering/procurement-engineering-isolation.test.mjs
npx tsx supabase/tests/procurement-engineering/procurement-engineering-write-boundary.test.mjs
npx tsx supabase/tests/procurement-engineering/lagoa-do-arroz-persistence.test.mjs
```

Cada arquivo autentica como o(s) usuário(s) de teste, executa seus cenários, e
**sempre** limpa (bloco `finally`, mesmo se algum cenário falhar) os
registros que criou — usando o cliente de service role somente para essa
limpeza, nunca como sujeito de um teste de isolamento.

## Não pertencem à suíte comum

`pnpm test` (125+ arquivos `*.test.ts`, incluindo os testes unitários dos
Serviços de Aplicação e dos mapeadores desta mesma Sprint, com repositórios
falsos) não executa nada nesta pasta — os quatro arquivos aqui são reais,
mais lentos, e exigem um ambiente dedicado. Rode-os manualmente, ou em um
job de CI separado com as variáveis acima configuradas como secrets, nunca
como parte do pipeline padrão sem essas variáveis.
