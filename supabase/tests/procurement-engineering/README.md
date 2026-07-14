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

## Ambiente: compartilhado controlado, não dedicado

**Estado real, declarado explicitamente (correção de fechamento da fronteira
de confiança, seção 12) — não presuma o contrário lendo só o nome da
variável `SUPABASE_TEST_URL`:** hoje estes quatro arquivos rodam contra o
mesmo projeto Supabase (`pbzszmpzvwlchbugrsao`) que hospeda a demonstração
pública do produto (`apps/web/.env.local`), não contra um projeto Supabase
fisicamente separado. Isto é um **ambiente compartilhado controlado**, não
um **ambiente dedicado** — a diferença importa e não deve ser apagada por
conveniência de linguagem em nenhum relatório ou PR futuro.

Controles que tornam esse compartilhamento aceitável hoje, e que continuam
obrigatórios enquanto não houver um projeto Supabase genuinamente separado:

- Toda escrita destes testes usa `company_id`/`RLS_TEST_COMPANY_A_ID`/
  `RLS_TEST_COMPANY_B_ID` — as duas organizações de demonstração já
  existentes (`carlos@carlosmendes.com.br`, `vitoria@vitoriamodas.com.br`),
  nunca uma organização real de cliente pagante.
- Cada arquivo rastreia (`tracked.procurementCaseIds`/`budgetVersionIds`)
  todo registro que cria e o apaga no bloco `finally`, mesmo quando algum
  cenário falha no meio — confirmado manualmente após cada execução desta
  Sprint (contagem de linhas residuais = 0 nas quatro tabelas envolvidas).
- **Nunca rode dois destes arquivos, ou duas execuções do mesmo arquivo, em
  paralelo.** Não há bloqueio/mutex entre execuções concorrentes contra o
  mesmo projeto — rodar em paralelo pode fazer a limpeza de uma execução
  apagar dados que a outra ainda está verificando, ou produzir falsos
  positivos/negativos nos testes de isolamento. Rode-os sempre em série, um
  de cada vez, como no bloco de Execução abaixo.
- Risco residual documentado: um teste com um defeito real de escopo
  (`company_id` errado num ponto novo, por exemplo) escreveria contra dados
  de demonstração reais em vez de só dados de teste descartáveis — não há
  isolamento físico de projeto que absorva esse erro. Mitigado hoje por
  revisão manual de cada novo cenário antes de rodá-lo pela primeira vez
  contra este projeto, nunca por confiança automática.
- **Opção preferível, ainda não adotada:** apontar `SUPABASE_TEST_URL` para
  um projeto Supabase genuinamente separado (ou uma instância local via
  `supabase start`), com as mesmas migrações aplicadas e usuários de teste
  próprios — eliminaria este risco por completo. Até essa migração
  acontecer, trate este bloco como "compartilhado controlado", nunca como
  "dedicado", em qualquer descrição futura.

**Nunca aponte estes testes para uso por um cliente real.** As variáveis
abaixo devem sempre referenciar as organizações de demonstração do produto
(ou, quando adotada a opção preferível acima, um projeto totalmente
separado) — nunca reaproveite `NEXT_PUBLIC_SUPABASE_URL`/
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de `apps/web/.env.local` como atalho
sem entender contra qual projeto elas apontam.

Toda variável abaixo é **obrigatória** (exceto o bloco de administrador,
marcado como opcional) — nenhum teste tem valor-padrão, email, senha ou
identificador embutido no código. Faltando qualquer uma das obrigatórias, o
teste falha imediatamente, antes de tentar autenticar ou tocar no banco.

```bash
export BDOS_ALLOW_DESTRUCTIVE_INTEGRATION_TESTS=true   # confirmação explícita — este bloco grava e apaga dados reais

export SUPABASE_TEST_URL=...
export SUPABASE_TEST_ANON_KEY=...
export SUPABASE_TEST_SERVICE_ROLE_KEY=...              # credencial privilegiada — caminho confiável de escrita (as 4 funções de
                                                         # mutação só aceitam EXECUTE de service_role) E limpeza; nunca sujeito
                                                         # dos testes de isolamento, nunca impressa em log

export RLS_TEST_CLIENT_A_EMAIL=...
export RLS_TEST_CLIENT_A_PASSWORD=...
export RLS_TEST_CLIENT_A_ID=...                        # auth.users.id do usuário de teste A
export RLS_TEST_COMPANY_A_ID=...                       # companies.id da organização de teste A

# Necessário apenas para procurement-engineering-isolation.test.mjs:
export RLS_TEST_CLIENT_B_EMAIL=...
export RLS_TEST_CLIENT_B_PASSWORD=...
export RLS_TEST_CLIENT_B_ID=...
export RLS_TEST_COMPANY_B_ID=...

# Opcional — só usado por procurement-engineering-write-boundary.test.mjs
# para exercitar o comportamento real de administrador BBA (profiles.role =
# 'bba_admin'). Sem esta variável, os cenários de administrador são
# explicitamente pulados (log "skipped"), nunca simulados.
export RLS_TEST_ADMIN_ID=...
```

## Execução

Rode um arquivo de cada vez, nunca em paralelo (ver "Ambiente: compartilhado
controlado, não dedicado" acima):

```bash
npx tsx supabase/tests/procurement-engineering/procurement-engineering-write-boundary.test.mjs
npx tsx supabase/tests/procurement-engineering/procurement-engineering-integration.test.mjs
npx tsx supabase/tests/procurement-engineering/procurement-engineering-isolation.test.mjs
npx tsx supabase/tests/procurement-engineering/lagoa-do-arroz-persistence.test.mjs
```

Cada arquivo autentica como o(s) usuário(s) de teste `authenticated`
(`RLS_TEST_CLIENT_A_*`/`RLS_TEST_CLIENT_B_*`) para ler e para as tentativas
negativas de escrita, usa o cliente de `service_role` para o caminho
confiável de escrita (as 4 funções de mutação — `create_procurement_case`,
`register_procurement_lot`, `create_budget_version_draft`,
`persist_budget_version_snapshot` — só aceitam `EXECUTE` de `service_role`
desde a correção de fechamento da fronteira de confiança) e para a limpeza
final, e **sempre** limpa (bloco `finally`, mesmo se algum cenário falhar)
todos os registros que criou. O cliente de `service_role` nunca é o sujeito
cuja permissão está sendo testada nos cenários de isolamento — só quem
prepara e desfaz os dados.

## Não pertencem à suíte comum

`pnpm test` (126+ arquivos `*.test.ts`, incluindo os testes unitários dos
Serviços de Aplicação e dos mapeadores desta mesma Sprint, com repositórios
falsos) não executa nada nesta pasta — os quatro arquivos aqui são reais,
mais lentos, e exigem um ambiente explicitamente autorizado (ver "Ambiente:
compartilhado controlado, não dedicado" acima — o estado atual não é um
ambiente dedicado, é o mesmo projeto compartilhado da demonstração
pública, sob os controles documentados). Rode-os manualmente, ou em um job
de CI separado com as variáveis acima configuradas como secrets, nunca como
parte do pipeline padrão sem essas variáveis.
