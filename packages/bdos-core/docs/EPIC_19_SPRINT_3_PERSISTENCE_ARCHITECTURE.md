# Epic 19 — Sprint 3: Measurement Persistence Architecture

> A migration inicial foi criada e aplicada em produção
> (`20260711000000_bdos_measurement_bulletin_import.sql`), seguida de
> duas correções também já aplicadas: o trigger de imutabilidade
> pós-finalização (`20260711010000_..._finalization_guard.sql`) e os
> GRANTs que faltavam para o papel `authenticated`
> (`20260711020000_..._grants.sql`, achado real via teste com sessão
> autenticada — ver seção de validação abaixo). Repository, endpoint,
> adapter e UI continuam não iniciados — fica para depois de nova
> aprovação explícita, mesma disciplina do Epic 18. Escopo confirmado
> após a checagem à parte: só a cadeia ratificada
> `MeasurementWorkspace → MeasurementBulletin → MeasurementCycle`,
> mais `WorkPackage`/`ManagedServiceItem`.
> `MeasurementEntry`/`measurement-entry-processor`/`measurement-engine`
> ficam fora — pipeline paralela, não reconciliada, dívida documentada
> (mesmo tratamento dado à limpeza de órfãos no Epic 18).

## Dois precedentes reais no próprio schema, não um só

Reli os dois padrões de persistência que já existem no bdos-core antes
de desenhar qualquer tabela nova — a escolha entre eles não é estética,
é ditada pelo próprio padrão de mutação de cada dado:

| Precedente | Onde | Por quê |
|---|---|---|
| **JSONB verbatim, escrito uma vez** | `planning_datasets.dataset` (comentário na migration: "guardado verbatim como JSONB... por que não normalizar atividade-por-atividade") | O dado inteiro nasce de um import, nunca é editado linha a linha depois. |
| **Linhas normalizadas, uma tabela própria** | `execution_tasks` (comentário: "mutável — status/bloqueio/conclusão mudam ao longo do tempo") | Cada linha tem ciclo de vida próprio, mutável independentemente das demais. |

Aplicando o mesmo critério (não por analogia solta, pelo comportamento
real do domínio já ratificado):

- **`MeasurementWorkspaceLine` é normalizada.** O próprio domínio já
  expõe `addMeasurementWorkspaceLine`/`removeMeasurementWorkspaceLine`/
  `updateMeasurementWorkspaceLineQuantity` — operações por linha,
  individualmente mutáveis, exatamente o padrão de `execution_tasks`.
- **`MeasurementBulletinLine` é JSONB verbatim.** `bulletin-generator`
  não tem nenhuma função de edição por linha — só
  `validateMeasurementBulletin`/`finalizeMeasurementBulletin`, que
  operam no documento inteiro. Uma vez fechado o workspace, o boletim
  nasce como uma foto congelada, exatamente o padrão de
  `planning_datasets`.

## Tabelas propostas

### 1. `measurement_bulletin_imports` — proveniência bruta (mirrors `planning_imports`)

Mesmo padrão do Epic 18, inclusive a mesma necessidade prática: o
BM_08 real tem ~5,2MB — **precisa do mesmo fluxo resiliente**
(`prepare-upload` → upload direto ao Storage → `upload-complete` →
`process`), não um novo desenho de upload. Reaproveito o padrão
literal, não só a inspiração.

```sql
CREATE TABLE measurement_bulletin_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_upload'
    CHECK (status IN ('pending_upload', 'uploaded', 'processing', 'completed', 'failed')),
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Nota: `planning_imports` original não tinha `status` (Epic 18
adicionou depois); aqui já nasce com o campo — não repito a
imutabilidade original que depois precisou ser revista.

### 2. `work_packages` — identidade canônica de EAP (ratificado 19.2B, NOVA)

Primeira vez que `WorkPackage` ganha uma tabela — hoje é 100%
transiente mesmo no uso do Project Studio (achado da 19.1).

```sql
CREATE TABLE work_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  normalized_code TEXT NOT NULL, -- chave de correlação (19.2B), nunca a de exibição
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL
    CHECK (type IN ('scope_group', 'execution_front', 'cost_group', 'administration', 'mobilization', 'demobilization', 'other')),
  parent_work_package_id UUID REFERENCES work_packages(id) ON DELETE SET NULL,
  sequence INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active'
    CHECK (status IN ('Draft', 'Active', 'Suspended', 'Completed', 'Cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (engineering_project_id, normalized_code)
);
```

O `UNIQUE (engineering_project_id, normalized_code)` **é** a regra de
identidade ratificada — find-or-create por essa chave, nunca dois
`WorkPackage` para o mesmo nó de EAP no mesmo projeto.

**Risco explícito a decidir, não decidido aqui**: o Project Studio
hoje cria `WorkPackage` em memória a cada import de cronograma
(`ms-project-xml-import.ts`, `planning-source-import.ts`), sem gravar
nada. Esta tabela nova não migra esse comportamento automaticamente —
o Project Studio continuaria gerando `WorkPackage` transitório até
alguém alterar esses dois arquivos para persistir via find-or-create
nesta tabela. **Fora do escopo do Epic 19** (Project Studio não deveria
ganhar mudanças por causa de um import de Medições — mesma regra que
você mesmo escreveu na 19.0/19.2: "Project Studio não deve receber
novas regras..."). Registro como dívida explícita: até essa migração
acontecer, `work_packages` só é preenchida pelo lado de Medições, e a
correlação com cronogramas existentes fica só por código normalizado
(mais frágil, mas é o que já temos hoje).

### 3. `managed_service_items` (NOVA)

> **Nota**: o `UNIQUE (engineering_project_id, code)` do snippet abaixo
> foi removido pela migration `20260711030000` — ver "Ajustes da
> revisão final", item 1. O snippet abaixo é o desenho original;
> mantido para registro histórico.

```sql
CREATE TABLE managed_service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  work_package_id UUID NOT NULL REFERENCES work_packages(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  contract_quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  measurement_type TEXT NOT NULL DEFAULT 'quantity'
    CHECK (measurement_type IN ('quantity', 'percentage', 'lump_sum')),
  status TEXT NOT NULL DEFAULT 'Active'
    CHECK (status IN ('Draft', 'Active', 'Suspended', 'Completed', 'Cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (engineering_project_id, code)
);
```

`contract_value`/`accumulated_quantity`/`remaining_quantity` do
domínio (`ManagedServiceItem`) são **derivados** (`contract_value =
contract_quantity × unit_price`; acumulado/saldo vêm da soma dos
boletins finalizados) — não persisto como coluna própria, calculo na
leitura. Mesmo princípio da reconciliação físico×financeiro: o banco
não guarda um número que o domínio já sabe recalcular.

**Neutralidade de origem (travessa antes da migration)**: confirmado
que esta tabela não tem FK para `measurement_bulletin_imports` nem
nenhuma coluna obrigatória específica de Excel (sem `storage_path`,
sem `file_name`) — nada aqui exige que o item de serviço tenha nascido
de uma importação. O Epic 19 materializa `managed_service_items`
inicialmente pelo Caminho B (o adaptador do BM_08), mas o schema não
atribui ownership nem dependência estrutural ao importador,
permitindo que um futuro fluxo contratual/orçamentário (Caminho A)
crie os mesmos itens canônicos sem alterar esta tabela. Não adiciono
um campo de origem (`source_type` ou equivalente) agora: não há ainda
um segundo consumidor real que precise diferenciar a proveniência, e
um enum especulativo sem uso e governança claros seria exatamente o
tipo de "preparar o futuro" que este projeto já rejeitou antes (ex.:
`planning_import_status_history` no Epic 18). Fica registrado como
extensão possível, não como decisão tomada.

### 4. `measurement_workspaces` (NOVA)

> **Nota**: a migration `20260711030000` adicionou um trigger que
> torna `Closed`/`Cancelled` terminais (mesma disciplina do trigger de
> `measurement_bulletins`) — ver "Ajustes da revisão final", item 4.
> Não aparece no snippet original abaixo.

```sql
CREATE TABLE measurement_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  measurement_bulletin_import_id UUID REFERENCES measurement_bulletin_imports(id) ON DELETE SET NULL, -- nulo se workspace criado manualmente, não por import
  period_number INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft', 'InProgress', 'ReadyForReview', 'Closed', 'Cancelled')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5. `measurement_workspace_lines` (NOVA, normalizada — ver critério acima)

> **Nota**: `declared_quantity`/`declared_unit_value` foram
> adicionadas pela migration `20260711030000` — ver "Ajustes da
> revisão final", item 2 (não aparecem no snippet original abaixo).

```sql
CREATE TABLE measurement_workspace_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_workspace_id UUID NOT NULL REFERENCES measurement_workspaces(id) ON DELETE CASCADE,
  managed_service_item_id UUID NOT NULL REFERENCES managed_service_items(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  unit_value NUMERIC NOT NULL,
  total_value NUMERIC NOT NULL, -- gravado, mas SEMPRE = quantity * unit_value; ver "Regra de recálculo" abaixo
  declared_total_value NUMERIC, -- o que o Excel de origem imprimia, para a linha específica; null se não houver divergência a registrar
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Regra de recálculo (achado da 19.0, reforçado em 19.2A)**:
`total_value` é sempre o valor recalculado pelo domínio
(`quantity × unit_value`), nunca o número bruto do Excel.
`declared_total_value` guarda o que a planilha de origem trazia
*só para fins de comparação/auditoria* — a divergência entre os dois
vira um `validationIssue` (severidade `Blocking`/`Warning`, já
modelada em `bulletin-generator.types.ts`), nunca uma correção
silenciosa de um pelo outro.

### 6. `measurement_bulletins` (NOVA, JSONB verbatim — ver critério acima)

```sql
CREATE TABLE measurement_bulletins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  measurement_workspace_id UUID NOT NULL REFERENCES measurement_workspaces(id) ON DELETE RESTRICT,
  bulletin_number INT NOT NULL,
  period_number INT NOT NULL,
  issue_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft', 'Validated', 'Finalized', 'Cancelled')),
  lines JSONB NOT NULL, -- snapshot congelado de MeasurementBulletinLine[]
  totals JSONB NOT NULL, -- MeasurementBulletinTotals
  validation_issues JSONB NOT NULL DEFAULT '[]', -- MeasurementBulletinValidationIssue[]
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (engineering_project_id, bulletin_number)
);
```

**Regra de imutabilidade (ratificada 19.2A, mecanismo corrigido após
revisão)**: uma vez `Finalized` (`finalized_at IS NOT NULL`), nenhuma
coluna da linha muda — nunca `lines`/`totals`/`validation_issues`, nem
`status`, nem `finalized_at`, nem qualquer outra. **Não é implementado
por RLS `WITH CHECK`** — uma policy comum não compara de forma
confiável o estado anterior (`OLD`) contra o novo (`NEW`) para este
caso. RLS continua responsável só por autorização de linha e
isolamento por `company_id` ("quem pode acessar esta linha"); a
imutabilidade pós-finalização é uma invariante de domínio, aplicada
por um `BEFORE UPDATE TRIGGER` dedicado
(`prevent_measurement_bulletin_update_after_finalization`, ver
`20260711010000_bdos_measurement_bulletin_finalization_guard.sql`):
enquanto `OLD.finalized_at IS NULL`, qualquer UPDATE segue liberado ao
workflow (incluindo a própria transição para `Finalized`); a partir do
momento em que `OLD.finalized_at IS NOT NULL`, qualquer novo UPDATE na
mesma linha é recusado — **sem exceção para `is_bba_admin()`**. Um
boletim finalizado é um documento contratual formal; se a integridade
dependesse só da camada de repository, qualquer caminho autenticado
com permissão de UPDATE poderia reescrever um documento já congelado
— o que anularia "proveniência imutável" e "explicabilidade como
infraestrutura de auditoria" (`BDOS_VISION.md`) como propriedades
reais, reduzindo-as a convenções de aplicação.

**Precisão de semântica (travessa antes da migration)**:
`MeasurementBulletin.status = Finalized` atesta a integridade e o
congelamento do documento produzido pelo BDOS — **não** sua
certificação por agente externo, sua aprovação contratual ou seu
reconhecimento para faturamento. Essas três coisas pertencem
exclusivamente ao futuro `MeasurementCycle`/`Certification` (adiado,
ver tabela 7). Nenhum consumidor futuro (em particular o Studio de
Finanças) deve tratar `Finalized` como sinônimo de "certificado" —
o campo de status deste documento e o campo de status de uma eventual
certificação são conceitos distintos, mesmo quando, na prática, um
boletim finalizado costuma ser certificado logo em seguida.

### 7. `measurement_cycles` — proposta de **adiar**, não incluir agora

O ciclo de certificação (`Draft → Measured → BulletinGenerated →
Certified → Closed`) é real e está ratificado na 19.2A, mas construir
a tabela agora antes de existir qualquer UI/fluxo de certificação
seria repetir o erro que a 19.0 já apontou (over-building sem
consumidor). Recomendo: v1 do Epic 19 entrega até
`measurement_bulletins` com `status` próprio (`Draft → Validated →
Finalized`), suficiente para "importar e ver o boletim". A
certificação formal (`MeasurementCycle`, `Certification`,
`MeasurementBulletinReference`) vira uma extensão natural quando o
fluxo de aprovação de fiscalização for desenhado — mesmo raciocínio
que já usamos para adiar o guardrail estrutural na 19.2B.

**Isto é uma recomendação, não uma decisão tomada** — se você preferir
incluir `measurement_cycles` já na v1 (por exemplo, porque o BM_08 real
já reflete um boletim que passou por certificação da fiscalização, e
seria estranho importar sem nenhum campo para isso), me diga e eu
redesenho incluindo a tabela.

## Comparação explícita com o precedente do Epic 18

| | Project Studio (Epic 18) | Studio de Medições (proposto) |
|---|---|---|
| Proveniência bruta | `planning_imports` | `measurement_bulletin_imports` |
| Dado estruturado, mutável | — (não existia; Epic 18 não tinha estágio de rascunho editável) | `measurement_workspaces` + `measurement_workspace_lines` (**novo**, sem equivalente direto no Project Studio) |
| Dado estruturado, imutável | `planning_datasets` (JSONB) | `measurement_bulletins` (JSONB) |
| Entidade compartilhada entre Studios | `SpatialObject` (Geo Studio dono) | `work_packages` (owner transversal, 19.2B) |
| Certificação/aprovação | `execution_workflows`/`execution_tasks` (mas é outro domínio, Execution) | `measurement_cycles` — **proposto adiar** |

A diferença mais importante: o Project Studio nunca teve um estágio de
"rascunho editável" — o cronograma importado vai direto para
`planning_datasets`. O Studio de Medições **precisa** desse estágio
porque você ratificou explicitamente que a reconciliação
físico×financeiro acontece com o usuário revisando antes do
fechamento — não é uma cópia mecânica do padrão do Epic 18, é uma
adaptação real à diferença de fluxo.

## Arquivos criados (estado real)

- `supabase/migrations/20260711000000_bdos_measurement_bulletin_import.sql` — as 6 tabelas, RLS habilitada, policies `company_id`-escopadas, índices.
- `supabase/migrations/20260711010000_bdos_measurement_bulletin_finalization_guard.sql` — trigger de imutabilidade pós-finalização (correção, ver seção acima).
- `supabase/migrations/20260711020000_bdos_measurement_bulletin_grants.sql` — `GRANT` explícito para `authenticated` nas 6 tabelas (correção; achado real via teste com sessão autenticada, ver seção de validação).
- `supabase/migrations/20260711030000_bdos_measurement_bulletin_review_adjustments.sql` — os 4 ajustes da revisão final (ver seção própria abaixo).
- `supabase/tests/measurement/bulletin-finalization-guard.test.mjs` — 15 testes com sessões autenticadas reais (`@supabase/supabase-js`, mesmo padrão de `supabase/tests/rls/tenant-isolation.test.mjs`), ver seção de validação.

Nenhum repository, endpoint, adapter ou UI foi criado — fica para
depois de nova aprovação explícita, mesma ordem do Epic 18.

## Ajustes da revisão final

Cinco pontos levantados na revisão. Quatro corrigidos via
`20260711030000`; o quinto, deliberadamente documentado sem mudança de
schema.

**1. `managed_service_items.code` deixou de ser único por projeto.**
A constraint original (`UNIQUE (engineering_project_id, code)`) era
prematura — códigos reais de boletim de medição variam por órgão
contratante (DNIT, DER, DNOCS, Codevasf, Seinfra, ...) de formas que
uma constraint rígida não antecipa ("01.01A", "01.01-B", "01.01 REV"),
e o mesmo código pode se repetir entre contratos diferentes com
descrições diferentes. Removida (`DROP CONSTRAINT`), mantendo o índice
não-único para performance de consulta. Sem evidência suficiente
(nenhum teste contra boletins reais de múltiplos órgãos) para
recongelar essa regra agora — fica registrado como algo a revisitar
depois que o adapter processar arquivos reais de mais de um órgão.

**2. `measurement_workspace_lines` ganhou `declared_quantity` e
`declared_unit_value`.** Só existia `declared_total_value` — mas o
Excel de origem pode divergir na quantidade ou no preço unitário, não
só no total combinado. Sem as duas colunas novas, uma divergência de
quantidade "desaparecia" dentro de um total que ainda batia por
coincidência aritmética. Mesmo padrão de nulidade de
`declared_total_value`: nulas quando não há divergência a registrar ou
quando a linha nasce de lançamento nativo (Caminho A).

**3. Documentação explícita (sem mudança de comportamento) de que
`Validated` não exige `finalized_at`.** A constraint já aplicada
(`measurement_bulletins_finalized_at_consistent`) já cobria isso
implicitamente — só `Finalized` exige `finalized_at NOT NULL`;
`Draft`/`Validated`/`Cancelled` exigem `NULL`. Registrado via
`COMMENT ON CONSTRAINT`.

**4. `measurement_workspaces` ganhou proteção equivalente à de
`measurement_bulletins`.** Gap real identificado na revisão: nada
impedia, antes deste ajuste, reabrir um workspace `Closed` e editar
linhas depois de um boletim já ter sido gerado a partir dele — o
boletim continuaria congelado (protegido por seu próprio trigger), mas
deixaria de refletir fielmente o workspace que o originou. Decisão:
`Closed` e `Cancelled` são terminais para `measurement_workspaces`,
mesma disciplina do boletim (trigger `BEFORE UPDATE`, sem exceção para
`is_bba_admin()`). Uma remedição real abre um novo workspace, nunca
reabre um já fechado.

**5. `measurement_workspace_lines` continua sem `company_id` próprio —
decisão mantida, não uma omissão.** O ponto levantado é real: à medida
que esta tabela cresce (provavelmente a maior do Studio de Medições),
a autorização via subquery contra `measurement_workspaces` (`EXISTS
... WHERE w.id = ... AND w.company_id = get_my_company_id()`) tem um
custo que uma coluna `company_id` direta evitaria. **Não mudo o schema
agora** pelo mesmo motivo do item 1: não há evidência que justifique a
mudança — não há volume de dados real nem forma de rodar um
benchmark de carga neste ambiente, e duplicar `company_id`
especulativamente sem medição seria o mesmo tipo de "preparar o
futuro sem uso comprovado" já rejeitado antes neste Epic (ex.: o
campo `source_type` de `managed_service_items`). A subquery já se
apoia num índice (`idx_measurement_workspace_lines_workspace` sobre
`measurement_workspace_id`, mais a PK de `measurement_workspaces`),
então o custo por linha é um semi-join indexado, não uma varredura —
plausivelmente aceitável até volumes bem maiores do que este Epic vai
gerar. Fica registrado como o primeiro lugar a medir quando houver
carga real: se o benchmark mostrar que o custo importa, a correção é
aditiva (uma coluna `company_id` denormalizada e indexada, preenchida
por trigger a partir do workspace pai) — não exige redesenho.

## Validação executada

**Estática** (leitura da migration): confirmada nesta revisão em
conjunto com você — FKs, constraints, unicidades, `ON DELETE`,
policies e o CHECK de consistência `finalized_at`/`status`.

**Dinâmica, com sessões autenticadas reais** (não simulação de
`request.jwt.claim.*` — mesma estratégia de
`supabase/tests/rls/tenant-isolation.test.mjs`, já documentada como a
abordagem correta pelo próprio repositório):
`node --test supabase/tests/measurement/bulletin-finalization-guard.test.mjs`,
**15/15 testes passando** (13 da rodada anterior + 2 dos ajustes da
revisão final: constraint de código removida, trigger de workspace
fechado):

1. Setup de fixture (work_package → service_item → workspace →
   bulletin), como cliente A autenticado.
2. Boletim `Draft` aceita alteração.
3. Transição `Draft → Validated → Finalized` é aceita.
4. Boletim `Finalized` recusa alteração de `lines`.
5. Boletim `Finalized` recusa alteração de `totals`.
6. Boletim `Finalized` recusa reverter `status` para `Draft`.
7. Boletim `Finalized` recusa limpar `finalized_at`.
8. Cliente B (empresa diferente) não enxerga o boletim da empresa A.
9. Cliente B não consegue atualizar o boletim da empresa A (0 linhas
   afetadas, sem erro — RLS filtra silenciosamente, mesmo
   comportamento já usado no resto do schema).
10. `anon` (sem sessão) é negado explicitamente (`42501`), nunca só
    "zero linhas".
11. `authenticated` sem empresa (`company_id NULL`, conta fixa criada
    via `signUp`) não lê nenhuma linha de `measurement_bulletins`.
12. `authenticated` sem empresa não consegue inserir, mesmo nomeando
    um `company_id` real de outra empresa.
13. `authenticated` sem empresa não lê nada na tabela-filha
    `measurement_workspace_lines` — confirma que a subquery contra
    `measurement_workspaces` também trata `get_my_company_id() IS
    NULL` corretamente (nenhuma linha passa `w.company_id =
    get_my_company_id()` quando o lado direito é `NULL`).

**Idempotência confirmada por execução repetida**: a suíte (já com os
15 testes, após os ajustes da revisão final) rodou 3 vezes seguidas
contra o mesmo ambiente, 15/15 nas três — sem
recriação de linhas (os `upsert`s com id fixo resolvem para update
quando a linha já existe) e sem falha por causa do trigger de
imutabilidade (os testes A/B detectam se o boletim já está
`Finalized` de uma execução anterior e pulam a reafirmação da
transição em vez de tentar refazê-la, o que o trigger corretamente
recusaria).

**Ressalva de ambiente, registrada sem meia-verdade**: este ambiente
não tem Docker disponível, então não há como subir uma instância local
via `supabase start` — a suíte roda contra o mesmo projeto Supabase
vinculado ao restante do app (não um projeto de teste isolado). O
impacto é mitigado porque (a) opera só sobre a empresa de demonstração
já fake (`eeeeeeee-...-000000000001`, mesma usada por
`tenant-isolation.test.mjs`), nunca dado de cliente real; (b) é
idempotente, não multiplica linhas a cada execução. Ainda assim, não
deveria virar rotina de execução repetida — recomendo mover para um
projeto Supabase de teste dedicado antes de incorporar esta suíte a
qualquer pipeline de CI.

**Achado real durante essa validação, corrigido antes de reportar
como pronto**: as 6 tabelas novas nunca receberam `GRANT` explícito
para `authenticated` — RLS estava habilitada, mas toda operação falhava
com "permission denied for table X" mesmo para o dono legítimo da
linha, porque GRANT (privilégio de tocar a tabela) é avaliado antes de
qualquer policy. Confirmei que isso é específico das tabelas novas
desta migration (não um problema pré-existente) testando `planning_imports`/
`execution_tasks`/outras tabelas já existentes com a mesma sessão —
todas funcionaram normalmente. Corrigido pela migration
`20260711020000`; suíte re-executada, 13/13 depois da correção
(incluindo os 3 testes de `authenticated` sem empresa, adicionados na
mesma rodada de revisão).

## Revisão à luz do BDOS_VISION.md

O desenho acima já nasceu compatível com os dois caminhos da visão —
`measurement_workspaces.measurement_bulletin_import_id` é nulo por
padrão precisamente para não amarrar o Studio à importação. Dois
pontos, porém, mereceram reexame direto contra o documento de visão:

**1. Adiar `measurement_cycles` — mantenho a recomendação, com uma
correção de enquadramento.** A visão (seção 5) nomeia "posso confiar e
certificar este boletim?" como a decisão central da etapa de Medição —
isso poderia sugerir que certificação não é opcional nem para a v1.
Releio e ainda recomendo adiar a tabela dedicada de ciclo/certificação,
mas por um motivo mais preciso do que "não construir sem consumidor":
o próprio `status` de `measurement_bulletins` (`Draft → Validated →
Finalized`) já responde a metade da pergunta ("o boletim é confiável")
antes de qualquer certificação formal existir. O que fica de fora na
v1 não é a confiança no boletim — é o registro formal de quem
certificou, quando, e o histórico de timeline dessa certificação
(`MeasurementCycle`/`Certification` completos). Isso é adiável sem
comprometer a resposta à pergunta central da visão; a resposta fica
parcial (o sistema calcula e valida, mas ainda não há um passo de
aprovação externa registrado), não ausente.

**2. Lacuna nova, aplicando o princípio "lacunas não são preenchidas
silenciosamente" ao próprio desenho**: este schema não define como
`managed_service_items` é povoada no Caminho A (obra nativa, sem
Excel). Hoje a única via desenhada é a extração do boletim importado
(Caminho B). A visão (seção 7) prevê que os itens de serviço, no
Caminho A, viriam do módulo de Orçamento — que ainda não existe — ou
de lançamento manual, também não desenhado aqui. **Isto fica
explicitamente fora do escopo do Epic 19** (que continua sendo,
concretamente, importar o BM_08), mas registro para não deixar a
impressão de que este schema já sustenta a "experiência madura" da
seção 9 da visão — ele sustenta hoje só o Caminho B. Suportar o
Caminho A de ponta a ponta exige, no mínimo, uma tela/endpoint de
cadastro manual de `managed_service_items` sem depender de nenhum
import — trabalho de um Epic futuro, não deste.

**Distinção que fica registrada explicitamente**: schema compatível
com o Caminho A não é o mesmo que Caminho A implementado. Este
desenho não exige mudança para acomodar o Caminho A quando ele for
construído — mas ele não está operacional hoje, nem parcialmente. O
Epic 19 entrega o Caminho B de ponta a ponta; o Caminho A permanece
visão, sustentada pelo schema, não pela funcionalidade.

## Riscos e itens em aberto

1. **`measurement_cycles` incluída ou não na v1** — decisão sua, ver acima.
2. **`work_packages` não migra o Project Studio automaticamente** — ele continua gerando `WorkPackage` transiente até uma migração própria (fora de escopo aqui, registrada como dívida).
3. ~~`managed_service_items.code` único por projeto~~ — **resolvido**: constraint removida pela migration `20260711030000` (ver "Ajustes da revisão final", item 1), exatamente pelo motivo antecipado aqui (variação real de código entre órgãos contratantes).
4. **Reaproveitamento do padrão de upload do Epic 18**: os endpoints futuros (`prepare-upload`/`upload-complete`/`process` para medição) devem ser literalmente o mesmo padrão, não uma reinvenção — economiza desenho, já está validado em produção.
5. **`measurement_workspace_lines` sem `company_id` próprio** — mantido deliberadamente sem benchmark (ver "Ajustes da revisão final", item 5); primeiro lugar a medir quando houver carga real.
