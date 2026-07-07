# BDOS — Arquitetura de Persistência (Sprint 13.1)

> **Sprint 13.1 — BDOS Persistence Architecture.** Documento apenas — nenhuma
> migration, nenhum código, nenhuma tabela criada. Objetivo: fixar o modelo
> lógico antes do Schema + RLS (Sprint 13.4), para que a implementação seja
> mecânica, não exploratória.
>
> Decisões já aprovadas pelo CPO/Chief Architect (não reabertas aqui):
> Company → 1 Workspace por tipo → N Workspace Objects; pipeline em 3 camadas
> (Import → Dataset Normalizado → Decision Snapshot) com versionamento;
> Recommendation Lifecycle + Risk History como camada operacional separada;
> Workspace Object é conceito, não tabela física genérica; reaproveitar o
> Supabase já existente.

---

## 1. Convenções herdadas (não inventar um padrão paralelo)

Levantei o schema Supabase real antes de desenhar qualquer coisa nova. Toda
tabela BDOS segue exatamente o que já existe:

- **Nomes de tabela:** `snake_case`, plural (`companies`, `projects`, `tasks`).
- **Chave primária:** sempre `UUID PRIMARY KEY DEFAULT gen_random_uuid()` —
  nunca serial.
- **`updated_at`:** trigger `set_updated_at()` em toda tabela com esse campo.
- **RLS — usar o padrão já endurecido, não o padrão antigo.** O schema tem
  dois estilos convivendo: um mais antigo (`financial_lancamentos`, subquery
  inline, 3 políticas, sem DELETE) e um mais novo e mais seguro, baseado em
  funções helper `SECURITY DEFINER`:
  ```sql
  -- já existe, reaproveitar:
  get_my_company_id()   -- retorna profiles.company_id do auth.uid() atual
  is_bba_admin()        -- retorna true se profiles.role = 'bba_admin'
  ```
  com 4 políticas por tabela, no padrão `<tabela>_<verbo>_company_or_admin`:
  ```sql
  CREATE POLICY engineering_projects_select_company_or_admin
    ON engineering_projects FOR SELECT TO authenticated
    USING (company_id = get_my_company_id() OR is_bba_admin());
  ```
  Toda tabela nova do BDOS usa este padrão (SELECT/INSERT/UPDATE/DELETE),
  nunca o estilo antigo — que já foi identificado como o que precisou ser
  reforçado depois (`202607030001_rls_tenant_hardening.sql`).
- **Migration:** arquivo único em `supabase/migrations/`, nome
  `YYYYMMDDHHMMSS_bdos_core_schema.sql` (formato de 14 dígitos, a convenção
  mais recente — ordena corretamente depois de qualquer migration existente).

---

## 2. Onde o BDOS se encaixa no que já existe — e onde ele NÃO se encaixa

Duas colisões conceituais reais que encontrei e que precisam ficar
explícitas, para ninguém tropeçar nelas mais tarde:

**2.1 — `bba_area` já existe e não é "Workspace".** O enum `bba_area`
(`fiscal`, `financeiro`, `rh`, `ti`, `governanca`) já existe desde o schema
original e alimenta a tabela genérica `projects`/`tasks` do back-office
contábil (provavelmente a tela "Tarefas"). Ele **não inclui** `engenharia`,
`comercial` nem `juridico`, e seu propósito é diferente: são módulos
operacionais do back-office, não Studios de decisão. Só que dois nomes
colidem (`financeiro`, `rh`) com os Workspaces que vamos construir. Decisão
desta sprint: **o BDOS usa um enum novo e próprio**, não reaproveita
`bba_area`. Se um dia fizer sentido consolidar "Workspace Financeiro" com o
módulo contábil `financeiro` existente, isso é uma decisão de produto
separada — meu diagnóstico de estratégia já registrou isso como pendente, e
não deve ser resolvido por acidente numa migration.

**2.2 — A tabela `projects` já existe e não é "Projeto de Engenharia".**
Ela tem `company_id`, `name`, `area bba_area`, `status`, `responsible_id`,
`due_date` — é um rastreador de iniciativa/tarefa genérico, sem qualquer
noção de EAP, cronograma, CPM ou Curva S. Fundir os dois conceitos seria
forçar uma tabela de tracking leve a virar o Workspace Object completo da
Engenharia. Decisão: **`engineering_projects` é uma tabela nova**, com um
campo opcional `linked_project_id UUID REFERENCES projects(id)` (nullable,
sem uso obrigatório) só para o dia em que fizer sentido um projeto de
engenharia também aparecer na lista genérica de "Tarefas" da empresa.

---

## 3. Workspace — a entidade central

```sql
-- conceitual, não migration ainda
CREATE TYPE bdos_workspace_type AS ENUM (
  'engenharia', 'financeiro', 'rh', 'comercial', 'juridico', 'operacoes'
);

workspaces (
  id UUID PK,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workspace_type bdos_workspace_type NOT NULL,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settings JSONB NOT NULL DEFAULT '{}',
  created_at, updated_at,
  UNIQUE (company_id, workspace_type)   -- no máximo 1 por tipo, por decisão do CPO
)
```

O `UNIQUE (company_id, workspace_type)` é a decisão de "1 Workspace por tipo"
codificada como restrição de banco, não apenas como regra de UI — errar isso
na aplicação nunca vai conseguir criar um duplicado.

---

## 4. Workspace Object — conceito, não tabela física

Cada tipo de Workspace tem sua **própria** entidade-filha, com forma
específica. Nenhuma tabela `workspace_objects` polimórfica.

| Workspace | Tabela própria (Workspace Object) | Nesta sprint |
|---|---|---|
| Engenharia | `engineering_projects` | Desenhada agora (única com consumidor real hoje) |
| Financeiro | `finance_cashflow_models` | Só o nome fica reservado — desenho quando o Studio existir |
| RH | `hr_people_plans` | Idem |
| Comercial | `commercial_opportunities` | Idem |
| Jurídico | `legal_cases` | Idem |

```sql
engineering_projects (
  id UUID PK,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linked_project_id UUID NULL REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,               -- ex.: "Barragem Lagoa do Arroz"
  client_reference TEXT,            -- ex.: "DNOCS / CONJASF-HIDROMEC"
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at, updated_at
)
```

---

## 5. Pipeline em 3 camadas

### 5.1 Camada 1 — Import (proveniência, nunca vista pelo Engine)

```sql
planning_imports (
  id UUID PK,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('ms-project-xml','excel')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,        -- ver seção 7, Supabase Storage
  uploaded_by UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

`source_type` existe **só aqui**, para auditoria/proveniência ("de onde veio
esse dado, quando, quem enviou"). A partir da Camada 2, a origem deixa de
existir para qualquer consumidor — exatamente como já funciona hoje em
memória: `PlanningDataset` (ver `planning-dataset.types.ts`) já não carrega
nada Excel/XML-específico, só `PlanningDatasetOrigin.sourceType` como
metadado, nunca como ramificação de lógica. Isso não é uma mudança — é a
confirmação de que o Engine já obedece essa regra desde o Sprint 1; a
persistência só formaliza onde a fronteira mora.

Adicionar uma fonte nova no futuro (Primavera, Oracle, SAP, entrada manual,
API) é: (1) um novo `source_type` no CHECK, (2) um novo adapter em
`domain/schedule-management/adapters/`, ambos já seguindo o padrão existente
de `ms-project-xml-import`/`excel-import` — nenhuma mudança na Camada 2 ou 3.

### 5.2 Camada 2 — Dataset Normalizado

```sql
planning_datasets (
  id UUID PK,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  planning_import_id UUID NOT NULL REFERENCES planning_imports(id) ON DELETE CASCADE,
  dataset_schema_version INT NOT NULL,   -- bump se a forma de PlanningDataset mudar
  detected_type TEXT NOT NULL,           -- cronograma | curva-s | fisico-financeiro | mixed | unknown
  dataset JSONB NOT NULL,                -- PlanningDataset completo, verbatim
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

Guardo `PlanningDataset` inteiro como JSONB, não normalizado
atividade-por-atividade em colunas relacionais. Motivo: o tipo já existe e é
estável em memória (`PlanningActivityRecord`, `PlanningPeriodSeries`,
`PlanningFinancialSummary`, `PlanningImportWarning`) — replicar isso em
tabelas relacionais separadas seria manter dois schemas em paralelo (TS e
SQL) que podem divergir. `dataset_schema_version` é o mecanismo de
segurança: se o formato do `PlanningDataset` mudar, incremento a versão e
sei exatamente quais linhas antigas precisam de migração/reinterpretação.

### 5.3 Camada 3 — Decision Snapshot

```sql
decision_snapshots (
  id UUID PK,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  planning_dataset_id UUID NOT NULL REFERENCES planning_datasets(id) ON DELETE CASCADE,
  engine_version TEXT NOT NULL,        -- ver "Engine Version", abaixo
  trigger_reason TEXT NOT NULL CHECK (trigger_reason IN ('import','manual_recalculation','scheduled')),
  computed_by UUID REFERENCES profiles(id),  -- NULL se automático
  decisions JSONB NOT NULL,            -- Decision[]
  recommendations JSONB NOT NULL,      -- Recommendation[]
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

**Engine Version — peça que ainda não existe e precisa ser criada.** Hoje
`packages/bdos-core` não tem nenhum mecanismo de versionamento do que o
Decision Engine produz. Proponho um export simples,
`ENGINE_VERSION` (ex.: `"2026.07.1"`), incrementado manualmente sempre que
uma regra/rule pack/cálculo que afete `Decision`/`Recommendation` mudar de
verdade — não um semver automático, só um carimbo estável. Isso é código
mínimo (uma constante + gravar no snapshot), mas pertence ao Sprint 13.8
(Decision Snapshot), não a esta sprint de documento.

Um novo Decision Snapshot nasce em dois momentos: (1) automaticamente,
sempre que um novo `planning_dataset` é criado (`trigger_reason='import'`);
(2) sob demanda, via um botão "Recalcular" que roda o Engine atual sobre um
dataset já existente sem exigir novo upload (`trigger_reason='manual_recalculation'`)
— útil no dia em que o BBA evoluir uma regra e quiser mostrar ao cliente
"eis o que diríamos hoje" sem pedir o arquivo de novo.

---

## 6. Recommendation Lifecycle — a camada operacional (Advisor persistente)

```sql
recommendations (
  id UUID PK,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  decision_snapshot_id UUID NOT NULL REFERENCES decision_snapshots(id) ON DELETE CASCADE,
  recommendation_ref_id TEXT NOT NULL,  -- o RecommendationId dentro do snapshot.recommendations
  title TEXT NOT NULL,
  severity TEXT NOT NULL,               -- copiado no momento da criação, para listagem rápida
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','acknowledged','in_progress','resolved','dismissed')),
  owner_user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
)
```

**Distinção que precisa ficar clara** (achei uma sobreposição de nomes ao
levantar o domínio existente): `Decision` já tem um campo `status`
(`DecisionStatus`: created/proposed/in_review/approved/rejected/resolved/
cancelled — ver `domain/decision/decision.types.ts`). Isso é o status
*computado pelo Engine*, congelado dentro do snapshot no momento do cálculo
— nunca muda depois de gravado. `recommendations.status` (open →
acknowledged → in_progress → resolved/dismissed) é uma camada
completamente diferente: como um humano da equipe do cliente está *tratando*
aquela recomendação ao longo do tempo. As duas não devem ser confundidas nem
sincronizadas automaticamente — a primeira é memória técnica imutável, a
segunda é memória operacional viva.

**Risk History** não é uma tabela própria — vem de consultar
`decision_snapshots` ao longo do tempo (`ORDER BY computed_at`) para o mesmo
`engineering_project_id`, exatamente como decidido: "Decision Snapshot =
memória técnica; Recommendation = memória operacional; Advisor = camada de
leitura/orquestração" sobre as duas.

---

## 7. Storage (Supabase Storage) — terreno novo

Não há nenhum precedente de uso do Supabase Storage no repositório hoje
(campos como `financial_lancamentos.comprovante_url` guardam URL simples,
sem bucket próprio). Para o BDOS, proponho:

- Bucket dedicado: `bdos-imports`.
- Caminho: `{company_id}/{engineering_project_id}/{planning_import_id}/{file_name}`.
- RLS de Storage objects espelhando a mesma regra de `company_id` das
  tabelas (via `storage.objects` policy checando o primeiro segmento do
  path contra `get_my_company_id()`).

Desenho completo (buckets, políticas exatas) fica para o Sprint 13.5.

---

## 8. O gap de autenticação server-side — precisa ser resolvido no Sprint 13.6

Achado importante ao investigar: **hoje não existe nenhum cliente Supabase
server-side em `apps/web`.** Toda autenticação é client-side, via
`getSupabaseClient()` + Zustand (`useBbaStore`, `packages/lib/src/store.ts`).
Rotas de API como `/api/bba-project/import` (Route Handler, servidor) não
têm noção nenhuma de sessão ou `company_id` hoje — por isso o import é uma
demo global, sem dono.

`@supabase/auth-helpers-nextjs` já é uma dependência declarada em
`apps/web/package.json`, mas **não é usada em lugar nenhum do código ainda**.
Ela existe, presumivelmente, exatamente para este momento. Recomendo (a
confirmar formalmente no início do Sprint 13.6): usar
`createRouteHandlerClient` desse pacote para ler a sessão via cookie dentro
do Route Handler, resolver `company_id` do `profiles` do usuário autenticado,
e só então gravar `planning_imports`/`engineering_projects` com o dono
correto. Isso é o item de maior risco técnico de toda a sequência 13.x — é
novo para este código, então vale um spike pequeno isolado no início do
13.6 antes de integrar ao fluxo real de import.

---

## 9. O que fica explicitamente em aberto (não resolvido aqui, de propósito)

1. **"Workspace Financeiro" vs. módulo contábil `financeiro` (`bba_area`)** —
   convivem por enquanto como conceitos distintos (seção 2.1). Decisão de
   produto para quando o Studio de Finanças for de fato desenhado, não
   agora.
2. **Autenticação server-side** (seção 8) — direção proposta, confirmação
   formal no início do Sprint 13.6.
3. **Forma exata das tabelas de Financeiro/RH/Comercial/Jurídico** — só os
   nomes ficam reservados (seção 4); desenho quando cada Studio nascer,
   seguindo o mesmo padrão de Camadas 1-3 sempre que fizer sentido (nem todo
   Workspace precisa necessariamente de "Import" — Comercial pode nascer
   direto em Dataset Normalizado, por exemplo).

---

## 10. Checklist antes de avançar para o Sprint 13.2

- [ ] CPO/Chief Architect revisou e aprovou este documento.
- [ ] Nenhuma tabela, migration ou linha de código foi criada nesta sprint —
      confirmado (`git status` limpo em `supabase/` e `packages/bdos-core/`).
- [ ] Convenções da seção 1 reconhecidas como vinculantes para o Sprint 13.4.
