# SEC-05 — LGPD, Privacy & Data Governance

## Escopo
Infraestrutura de governança de dados: classificação oficial, catálogo, política de retenção (definição, sem execução), governança de envio a IA, consentimento e rastreamento de direitos do titular. Sprint de banco + testes + documentação — nenhuma UI, API pública, funcionalidade de negócio nova ou alteração de comportamento funcional foi implementada.

## Arquivos auditados
Todas as 20 migrations pré-existentes em `supabase/migrations/` (schema completo, 71 tabelas), com atenção especial a:
- `202506280001_bba_app_core_schema.sql` (profiles, companies, `bba_admin`, `set_updated_at`)
- `202506290006_modules_onboarding_contratos.sql` (`bba_set_updated_at`, client_*, service_*)
- `202506290008_modules_financeiro_tarefas_chat.sql` (audit_log original)
- `202607030001_rls_tenant_hardening.sql` (SEC-01)
- `202607030002_data_integrity_hardening.sql` (SEC-03)
- `202607030003_sec04_audit_compliance.sql` (SEC-04 — `bba_audit_row_change`, `is_bba_admin`, `log_audit_event`)
- `supabase/tests/rls/tenant-isolation.test.mjs`, `supabase/tests/audit/audit-log.test.mjs`, `SEC-01-rls-report.md` (padrão de teste/relatório a seguir)

## Arquivos criados
- `supabase/migrations/202607030004_sec05_data_governance.sql`
- `supabase/tests/governance/data-governance.test.mjs`
- `supabase/tests/SEC-05-privacy-impact-assessment.md`
- `supabase/tests/SEC-05-data-governance-report.md` (este arquivo)

## Arquivos alterados
**Nenhum.** Nenhuma migration pré-existente foi modificada — confirmado por `git status`/`git diff` (todas as migrations anteriores permanecem como estavam) e pela ausência de qualquer chamada de `Edit`/`Write` desta sprint sobre arquivos que não sejam os 4 listados acima.

## Justificativa arquitetural

### Reaproveitamento em vez de duplicação
- `bba_set_updated_at()` (já existente desde `202506290006`) foi reusada em todas as 6 tabelas novas com coluna `updated_at` — nenhuma função de timestamp nova foi criada.
- `is_bba_admin()` (core schema) foi reusada em toda policy de escrita administrativa — nenhuma função de autorização nova foi criada.
- `bba_audit_row_change()` (SEC-04) foi **anexada** (não redefinida) às 6 tabelas novas de governança, para que mudanças na própria classificação/catálogo/retenção sejam auditáveis — feito com checagem defensiva (`to_regprocedure`) para nunca quebrar caso a migration do SEC-04 não tenha sido aplicada.
- Os números de retenção de Financeiro/Fiscal (5 anos) foram alinhados aos já definidos em `audit_log_retention_status()` (SEC-04), evitando dois números divergentes para o mesmo conceito entre sprints.
- `data_catalog` referencia `data_classification`/`data_retention_policy` por FK em vez de repetir `classificacao`/`criticidade`/números de retenção — atendendo literalmente à instrução "não duplicar informações existentes".
- `ai_data_governance` tem uma linha por **valor de classificação** (10 linhas), não por tabela (71 linhas) — a política de IA de qualquer tabela é obtida por JOIN via `data_classification.classificacao`, evitando repetição massiva.

### Descoberta dinâmica para as tabelas `ref_*`
As 37 tabelas de referência foram classificadas via `INSERT ... SELECT ... FROM information_schema.tables WHERE table_name LIKE 'ref\_%'` em vez de 37 linhas manuais — autodescritivo, e continua correto se novas `ref_*` forem adicionadas no futuro sem precisar editar esta migration.

### Padrão de imutabilidade reaproveitado
`user_consents` usa exatamente o mesmo mecanismo de `audit_log` (SEC-04): `CREATE RULE ... DO INSTEAD NOTHING` para UPDATE e DELETE — não um mecanismo novo, apenas o padrão já validado, com guarda `IF NOT EXISTS` verificando `pg_rewrite` (incluindo o filtro por `ev_class`, refinamento sobre o padrão original) para tornar a migration seguramente reexecutável.

### RLS das tabelas novas
Nenhuma policy pré-existente foi alterada (confirmado por `DROP POLICY`/`CREATE POLICY` apenas sobre as 6 tabelas novas). Padrão seguido:
- `data_classification`/`data_catalog`/`data_retention_policy`/`ai_data_governance`: leitura `USING (true)` para `authenticated` (mesmo padrão já usado pelas tabelas `ref_*`), escrita restrita a `is_bba_admin()`.
- `user_consents`: leitura própria ou admin, inserção só do próprio `user_id` (não spoofável — RLS compara com `auth.uid()`), sem UPDATE/DELETE possível (bloqueado por RULE + ausência de policy).
- `data_subject_requests`: leitura própria ou admin, inserção só do próprio `requester_user_id`, UPDATE (mudança de status) restrito a admin, DELETE bloqueado (`USING (false)`) — preserva histórico completo de solicitações de direitos do titular.

## Riscos encontrados
Documentados em detalhe no Privacy Impact Assessment (`SEC-05-privacy-impact-assessment.md`, seção 3): conteúdo arbitrário de upload/chat sem garantia de schema, `audit_log` como amplificador de sensibilidade, prazo de retenção trabalhista potencialmente maior que o fiscal padrão, retenção de backup fora do alcance observável do schema, integração de push (Expo) já existente e não revisada nesta sprint, e ausência de categoria "Societário" na lista fixa de retenção da Etapa 5 (mapeada para "Fiscal" por proximidade, decisão documentada).

## Decisões tomadas
1. **Duas tabelas em vez de uma para classificação+catálogo** (etapas 2 e 3 como artefatos fisicamente distintos, ligados por FK), honrando a separação pedida pelo enunciado sem duplicar colunas.
2. **Base legal e retenção como CHECK constraints com valor `REVIEW_REQUIRED` explícito**, em vez de tabelas de referência à parte — consistente com o padrão de enum-via-CHECK já usado em todo o schema (`companies.tax_regime`, `tasks.status` etc.), e usado de fato (não apenas decorativamente) em `chat_messages` e `reports_snapshots`.
3. **`client_socios`/`societario_*` mapeados para a categoria de retenção "Fiscal"**, já que a lista fixa da Etapa 5 não inclui "Societário" — decisão explícita e documentada, não uma tabela inventada fora do que foi pedido.
4. **Nenhuma anonimização/exportação/eliminação foi implementada** — `data_subject_requests` é só rastreamento; `data_retention_policy` é só definição. Execução real é trabalho futuro, deliberadamente fora desta sprint.
5. **Consentimento não foi conectado ao fluxo de login/cadastro** — a tabela e as policies existem e estão prontas para uso, mas nenhuma chamada foi adicionada a `packages/lib/src/auth.ts`/`store.ts` (isso alteraria comportamento funcional, proibido pelo enunciado).

## Resultado do typecheck
```
pnpm typecheck   →   4/4 pacotes com sucesso (@bba/bdos-core, @bba/lib, @bba/mobile, @bba/web)
```
Executado duas vezes (antes e depois da criação do teste `.mjs`); segunda execução veio 100% do cache do Turbo, confirmando que nenhum arquivo TypeScript foi tocado por esta sprint.

## Resultado das validações
- **Sintaxe do teste**: `node --check supabase/tests/governance/data-governance.test.mjs` → OK.
- **Revisão estática manual da migration inteira** (621 linhas), incluindo:
  - Verificação de que toda `table_name` usada em `data_catalog` existe em `data_classification` (FK) — conferido manualmente, os dois blocos de INSERT usam exatamente os mesmos 36 nomes de tabela, na mesma ordem.
  - Verificação de que toda `retencao_categoria` usada em `data_catalog` existe entre as 10 categorias de `data_retention_policy` (FK) — conferido manualmente, todos os valores batem.
  - Correção de um `CREATE RULE` que verificava `pg_rewrite.rulename` sem filtrar por tabela (nomes de rule são únicos por tabela, não globalmente) — corrigido para incluir `ev_class`.
- **Compatibilidade com SEC-01/SEC-02/SEC-03/SEC-04**: confirmada por leitura direta — nenhuma function/trigger/policy dessas sprints foi redefinida; `is_bba_admin()`, `bba_set_updated_at()` e `bba_audit_row_change()` foram apenas referenciadas/reanexadas.
- **Nenhuma migration anterior foi modificada**: confirmado por `git status`/`git diff` e pelo histórico desta sessão (nenhum `Edit`/`Write` sobre arquivo pré-existente).
- **Execução real contra Supabase**: **não foi possível neste ambiente** — sem Docker/psql/Supabase CLI locais (mesma limitação já documentada nos relatórios do SEC-01 e SEC-04). Instruções de validação manual abaixo.

## Instruções de validação no SQL Editor (ambiente Supabase real)

1. Aplicar as migrations pendentes em ordem: `...0001` (SEC-01) → `...0002` (SEC-03) → `...0003` (SEC-04) → `...0004` (SEC-05, este trabalho). Todas idempotentes — seguro reaplicar.
2. Conferir cobertura completa:
   ```sql
   select count(*) from public.data_classification; -- esperado: 71+ (37 ref_* + 34 negócio + auth.users)
   select count(*) from public.data_catalog;         -- mesmo total
   select * from public.data_governance_overview where table_name = 'rh_folha_pagamentos';
   ```
3. Conferir política de IA:
   ```sql
   select classificacao, politica_ia from public.ai_data_governance order by classificacao;
   ```
4. Testar imutabilidade de consentimento:
   ```sql
   insert into public.user_consents (user_id, tipo_consentimento, versao_aceita)
     values ('<uuid de um profile existente>', 'termos_uso', 'v1');
   update public.user_consents set versao_aceita = 'tampered' where versao_aceita = 'v1';
   select versao_aceita from public.user_consents where versao_aceita in ('v1','tampered');
   -- esperado: só 'v1' aparece, a RULE bloqueou o UPDATE
   ```
5. Rodar a suíte automatizada (mesmas variáveis de `supabase/tests/rls/.env.example`):
   ```bash
   node --test supabase/tests/governance/data-governance.test.mjs
   ```

## Pendências
1. Execução real contra Supabase não realizada neste ambiente (sem Docker/CLI local).
2. Base legal `REVIEW_REQUIRED` em `chat_messages` e `reports_snapshots` — requer decisão jurídica formal.
3. Prazo de retenção trabalhista definitivo — hoje registrado com ressalva explícita, requer confirmação jurídica.
4. Retenção de Backups não é observável pelo schema — requer confirmação direta na configuração do Supabase.
5. Consentimento (`user_consents`) e direitos do titular (`data_subject_requests`) são infraestrutura pronta, mas **não conectados a nenhum fluxo de aplicação** — wiring em `packages/lib`/UI é trabalho de uma sprint de aplicação futura, deliberadamente fora deste sprint de banco.
6. Nenhuma anonimização/exportação/eliminação real foi implementada — apenas a estrutura de definição e rastreamento.
7. Achado herdado (não desta sprint): a integração de push notification via Expo (`supabase/functions/notify-*`) envia dado a um provedor fora do Brasil e não foi revisada.

## Próximos passos sugeridos
1. Sprint de aplicação (fora do escopo de banco): capturar consentimento real no fluxo de `/cadastro`, gravando em `user_consents`.
2. Sprint de aplicação: tela administrativa simples para `bba_admin` processar `data_subject_requests` pendentes.
3. Decisão jurídica formal sobre as duas pendências de base legal e o prazo trabalhista.
4. Sprint de execução de retenção (fora do escopo desta sprint, que é só definição): implementar o expurgo/anonimização real, sempre com aprovação humana explícita, nunca automática.

## Confirmação formal de conclusão do SEC-05
SEC-05 está **concluído** dentro do escopo autorizado (infraestrutura de banco + testes + documentação de governança de dados), com:
- Etapa 1 (auditoria) — completa, baseada exclusivamente em leitura do schema real.
- Etapa 2 (classificação) — completa, 71+1 tabelas classificadas.
- Etapa 3 (catálogo) — completo, sem duplicar dado já existente em classificação/retenção.
- Etapa 4 (LGPD/base legal) — completa, com `REVIEW_REQUIRED` explícito onde não determinável com segurança.
- Etapa 5 (retenção) — completa como definição; nenhum apagamento automático implementado.
- Etapa 6 (governança de IA) — completa como infraestrutura de decisão; nenhuma anonimização implementada.
- Etapa 7 (consentimento) — infraestrutura pronta; login/cadastro não alterados.
- Etapa 8 (direitos do titular) — infraestrutura de rastreamento pronta; nenhuma funcionalidade executada.
- Etapa 9 (PIA) — gerado em `SEC-05-privacy-impact-assessment.md`.
- Etapa 10 (testes) — criados, sintaxe validada, `pnpm typecheck` limpo; execução real pendente de ambiente Supabase.

Nenhuma restrição obrigatória foi violada: BDOS, Decision Engine, Business Facts, Engineering Application Layer, UI, login, fluxo de cadastro, RLS do SEC-01, bootstrap do SEC-02, integridade do SEC-03 e infraestrutura de auditoria do SEC-04 permanecem exatamente como estavam antes desta sprint.
