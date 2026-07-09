# Execution Engine — Epic 16 (arquitetura, pré-rascunho)

> Mesma disciplina de `DECISION_COPILOT.md`/`DECISION_COPILOT_PHASE2.md` e
> de `docs/PLATFORM_ARCHITECTURE.md` §15: fronteira e contrato primeiro,
> schema depois, código depois disso. Este documento não propõe nenhuma
> tabela, nenhuma migration, nenhum código — só o levantamento do estado
> atual e a fronteira do Epic 16. O risco aqui é maior que nos dois
> documentos anteriores: um Engine novo com fronteira errada pode invadir
> Project Studio, Decision Engine ou o Copilot — os três já em produção.

## Levantamento do estado atual (antes de qualquer decisão de desenho)

### O que já existe e o Execution Engine vai consumir, nunca reescrever

| Peça | Onde vive hoje | Estado real |
|---|---|---|
| `Decision` | `domain/decision` | Em produção — `evidence: DecisionEvidence[]` já é **referência**, não posse do dado bruto (`source`, `sourceReference`, `description`) |
| `Recommendation` | `engines/decision/recommendation` | Em produção — carrega `decisionId`, `options: RecommendationOption[]`, `traceability.evidenceReferences: string[]` (já referência, mesmo padrão) |
| `Playbook` | `engines/decision/playbook` | Em produção — carrega `recommendationId`, `steps: PlaybookStep[]` |
| `ActionPlan` | `engines/decision/action-plan` | Em produção, mas **incompleto de propósito**: `playbookId`, `actions: Action[]` (cada `Action` traz `sourceStepId: PlaybookStepId`), porém `ActionPlanStatus` só tem o valor `"created"` — não existe noção de "em andamento"/"concluído" no dado. É exatamente a lacuna que o Execution Engine fecha. |

Cadeia de rastreabilidade que já existe, ponta a ponta, até `ActionPlan`:

```
Decision → Recommendation → Playbook → ActionPlan → Action
```

O Execution Engine estende essa cadeia por mais dois elos —
`ExecutionTask` e `EvidenceReference` — nunca reconstrói os primeiros
cinco.

### Evidência — quem já possui o quê

`docs/PLATFORM_ARCHITECTURE.md` §5 já registra: **Evidência (foto/
vídeo/documento) pertence ao Studio de Evidências**; Studio de
Medições e Studio de Documentos a consomem somente leitura.
`domain/field-evidence` confirma isso em código: `FieldEvidence` tem
ciclo de vida completo (`Submit`/`Classify`/`Approve`/`Reject`/
`Archive`, `EvidenceStatus`, `EvidenceClaim`) — é um agregado rico,
não um registro solto.

O padrão de "referenciar, nunca possuir" já é usado duas vezes no
código hoje: `Decision.evidence` e
`Recommendation.traceability.evidenceReferences` são ambos arrays de
referência (id/description), nunca uma cópia do arquivo ou do
resultado de OCR. O Execution Engine repete exatamente esse padrão —
não inventa um terceiro jeito de referenciar evidência.

### `ScheduleActivity`/`PlanningDataset` — propriedade já declarada, mas com uma tensão real encontrada agora

`docs/PLATFORM_ARCHITECTURE.md` §5 já lista `PlanningDataset`/
`ScheduleActivity` como propriedade do **Project Studio**, com o
**Field Studio como um dos consumidores somente leitura, explicitamente
para "apontamento de execução"** — a tabela do documento mestre já
antecipava este Epic antes de ele existir.

Achado que muda o desenho, encontrado nesta etapa de levantamento
(ninguém tinha listado isso ainda): `ScheduleActivity`
(`domain/schedule-management`) **já tem campos de execução hoje** —
`percentComplete`, `status` (`NotStarted`/`InProgress`/`Completed`/
`Cancelled`), `actualStart`, `actualEnd` — e uma função de domínio
`updateActivityProgress(input: UpdateActivityProgressInput)` que os
atualiza. Essa função **não tem nenhum consumidor em `apps/web` hoje**
(nenhuma rota, nenhum componente a chama) — é uma capacidade dormente,
não uma feature em produção. Isso levanta uma pergunta real — qual é a
relação entre esse `percentComplete`/`status` agregado e o apontamento
granular por tarefa que o Execution Engine vai introduzir? — **já
decidida** na revisão desta rodada (ver Risco 3 abaixo): sem
sincronização automática no Epic 16 inicial.

### `WorkPackage` — domínio real, mas órfão de Studio

`domain/work-package-management` existe, é usado em produção
(`WorkPackage` com `contractId`/`projectId`, tipos `ScopeGroup`/
`ExecutionFront`/`CostGroup`/`Administration`/`Mobilization`/
`Demobilization`), mas:

- **Não é referenciado por `ScheduleActivity`** — nenhum campo
  `workPackageId` existe em `domain/schedule-management` hoje.
- **Não aparece em nenhuma tabela de `PLATFORM_ARCHITECTURE.md`** — nem
  no mapeamento Engine→Studio (§3), nem na tabela de propriedade de
  dados (§5). É um domínio sem dono de Studio declarado.
- Só tem uma ponte de mão única: `domain/spatial-object/adapters/
  work-package-management/work-package-spatial-object-adapter.ts` GERA
  `SpatialObject`s a partir de `WorkPackage`s do tipo `ExecutionFront`
  (outros tipos são pulados, `skipReason: "not_execution_front"`) —
  isso é o Geo Studio consumindo `WorkPackage` para gerar geometria
  conceitual, não o Geo Studio possuindo `WorkPackage`.

Conclusão do levantamento: não há hoje evidência suficiente em código
para decidir se `ExecutionTask` referencia `WorkPackage` — por isso a
decisão desta rodada (Risco 1 abaixo) é deixar `workPackageId` fora do
schema inicial, não especular uma propriedade que o código atual não
sustenta.

### Precedente arquitetural direto para a regra central deste Epic

`packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md`, PRINCIPLE
005 ("No Isolated Activity") já exige que toda `ScheduleActivity`
nasça conectada a um `SpatialObject`, um Decision Context, uma fonte
de evidência (mesmo vazia) e rastreabilidade. A regra central proposta
para o Execution Engine (seção própria abaixo) é a mesma disciplina
aplicada a `ExecutionTask` — não uma invenção nova, uma extensão de um
princípio que já rege o resto do BDOS.

### Mecânica de fronteira que o Epic 16 vai herdar quando virar código

`packages/bdos-core/src/architecture/engineering-boundaries.test.ts`
já registra `work-package-management` e `schedule-management` na
lista `OPERATIONAL_DOMAINS` (domínios que nunca podem importar o
Decision Engine/Business Facts/Executive Intelligence diretamente).
Quando o Execution Engine virar um domínio real (16.3+), ele entra
nessa mesma lista — registrado aqui como próximo passo técnico
conhecido, não implementado neste documento.

---

## Papel do Execution Engine

**Execution Engine = motor de acompanhamento da execução de ações já
aprovadas.** Ele não decide o quê fazer (isso é o Decision Engine,
via Recommendation/Playbook/ActionPlan) — ele rastreia o que está
sendo feito, por quem, até quando, com que bloqueio, com que prova.

Diferenciação de produto — por que isto não é "mais um gerenciador de
tarefas" (Asana/Monday/MS Project): em qualquer concorrente, uma
tarefa pode ser criada do nada, por qualquer pessoa, sem justificativa
auditável. No BDOS, isso é uma regra explícita, não um efeito
colateral do desenho — ver "No Isolated Task" abaixo. É a mesma tese
já registrada no pivô estratégico do produto (BBA = Decision Operating
System, não ERP com IA): o diferencial real é a cadeia de
rastreabilidade completa, e o Execution Engine é o elo que finalmente
fecha essa cadeia até a execução em campo — hoje ela para em
`ActionPlan.status = "created"`.

### O que ele controla

- `ExecutionWorkflow` / `ExecutionTask`
- responsável (assignee)
- prazo
- status, incluindo `completed` ("concluído operacional" — nunca
  confundir com `ImpactConfirmed`, que é medido pelo Decision Engine
  depois; ver Fronteira com Decision Engine)
- bloqueio (motivo/tipo — forma exata em aberto, ver Riscos)
- **vínculo** de evidência (`EvidenceReference[]`, nunca a evidência em si)
- histórico de status (append-only, mesmo padrão de
  `advisor_narratives`/`copilot_messages` — nunca um mecanismo de
  auditoria novo e paralelo)

### O que ele não controla

- cronograma-base, caminho crítico, Curva S oficial (Project Studio)
- medição, boletim (Studio de Medições)
- Decision, Recommendation, Playbook, ActionPlan (Decision Engine —
  Execution Engine consome, nunca produz ou reescreve)
- regras de negócio de nenhum outro domínio operacional
- o arquivo/OCR/classificação de uma evidência (Studio de Evidências
  — Execution Engine só guarda `EvidenceReference[]`)
- criação de tarefa fora do fluxo de uma `Action` aprovada (ver "No
  Isolated Task" — sem exceção nesta fase)

---

## Fronteira com Project Studio

**Regra central: Project Studio possui o planejamento. Execution
Engine possui o apontamento da execução.**

- `ScheduleActivity`/`PlanningDataset` = entrada somente leitura para
  o Execution Engine — mesma disciplina que já rege todo consumo
  cross-Studio no BDOS (§5): nenhum Studio recalcula CPM ou altera
  datas de linha de base fora do dono.
- `ExecutionTask`/`ExecutionWorkflow` = dado próprio do Execution
  Engine, novo, não substitui nada que o Project Studio já tem.
- Um `ExecutionTask` **pode referenciar, opcionalmente**, uma
  `ScheduleActivity` (id) — **nunca a altera**. Não é obrigatório: uma
  `ExecutionTask` sempre tem uma `Action` de origem (ver "No Isolated
  Task"), mas nem toda `Action` precisa apontar para uma atividade de
  cronograma específica.
- **Decidido nesta rodada**: sem sincronização automática nesta fase.
  `ScheduleActivity.percentComplete`/`status` continuam sendo o que já
  são hoje — um dado do Project Studio, mantido por ele, lido
  opcionalmente pelo Execution Engine, nunca escrito por ele. O
  apontamento granular do Execution Engine (`ExecutionTask.status` por
  tarefa) é uma visão própria, paralela, sem rollup automático para
  `ScheduleActivity` no Epic 16. Um rollup automático (Execution Engine
  virar a fonte real do `percentComplete` agregado) fica para uma fase
  futura explícita, condicionada a uma regra formal própria — não
  implícito, não decidido por omissão.

## Fronteira com Decision Engine

- Execution Engine nunca cria `Decision`, `Recommendation`, `Playbook`
  ou `ActionPlan` — só consome o que o Decision Engine já produziu.
- Toda `ExecutionTask` nasce de uma `Action` (de um `ActionPlan` já
  aprovado) — nunca uma tarefa "solta". Ver "No Isolated Task".
- **Decidido nesta rodada — separação entre "concluído operacional" e
  "impacto confirmado"**: o Decision Engine **nunca encerra** uma
  `ExecutionTask`. Encerramento é prerrogativa exclusiva do Execution
  Engine (`ExecutionTask.completed` — execução declarada/conferida). O
  efeito real da execução (ex.: o Health Score de fato melhorou depois
  que a tarefa foi concluída) é um conceito **separado e posterior**,
  medido só pelo Decision Engine — nome de trabalho `ImpactConfirmed`,
  não uma propriedade do Execution Engine, não decidida em detalhe
  aqui (schema/local de armazenamento ficam para quando o Decision
  Engine tratar disso, fora do escopo deste Epic). Isso evita misturar
  "a execução aconteceu" com "a decisão deu certo" — são perguntas
  diferentes, respondidas por motores diferentes.
- Ainda em aberto, escopo menor que antes: **qual o gatilho exato,
  dentro do próprio Execution Engine, que marca `ExecutionTask.
  completed`** — declaração manual do responsável, exigência de
  evidência conferida antes de aceitar a conclusão, ou os dois. Fica
  para 16.2; o que já está decidido é que nenhuma dessas opções
  envolve o Decision Engine.

## Fronteira com o Decision Copilot

- Nesta fase, o Copilot **explica, sugere e prepara handoff** — nunca
  executa.
- **Workflow Handoff só destrava quando existir um Execution
  Application Service real** (`services/*`, mesmo padrão de
  `bba-project-import`/`geospatial-product-integration`) — a mera
  existência de uma tabela `execution_tasks` não é suficiente. Isso
  já está registrado como regra em `DECISION_COPILOT.md`
  ("Fase 3... o Copilot só pode chamar `services/*` que já existem")
  e `DECISION_COPILOT_PHASE2.md` §5 (Workflow Handoff bloqueado até o
  Execution Engine existir) — este documento não muda essa decisão,
  só a reafirma no lado do Execution Engine.

---

## Aggregates candidatos (nomes de trabalho, não schema)

Listados para orientar o levantamento de domínio da Fase 16.2 — não
são uma proposta de tabela.

- **`ExecutionWorkflow`** — o agrupamento de tarefas derivado de um
  `ActionPlan`. Provavelmente 1:1 com `ActionPlan` na primeira versão
  (a decidir em 16.2).
- **`ExecutionTask`** — unidade de trabalho. `sourceActionId`
  obrigatório (ver "No Isolated Task"); `scheduleActivityId` **opcional**
  (ver Fronteira com Project Studio); `workPackageId` **fora do schema
  inicial** — indefinido até `WorkPackage` ter um Studio dono declarado
  (ver Risco 1). Um responsável, prazo, status, bloqueio, `completed`.
- **`EvidenceReference`** — vínculo (`fieldEvidenceId`, não o dado),
  igual ao padrão de `DecisionEvidence`/`RecommendationTraceability`.
- **`ExecutionTaskStatusHistory`** (nome provisório) — append-only,
  mesmo padrão de imutabilidade já usado em `advisor_narratives`/
  `copilot_messages`/`audit_log`.
- **Bloqueio** — forma exata (enum fechado vs. texto livre com
  categoria) em aberto; nasce junto com o levantamento de domínio de
  16.2, não decidido aqui.

---

## Princípio arquitetural — PRINCIPLE 006, "No Isolated Task"

Elevado de "boa prática do Epic 16" para princípio do BDOS, por
analogia direta com PRINCIPLE 005 ("No Isolated Activity"). **Aplicado
em `packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md`** — não é
mais só uma proposta deste documento.

> **PRINCIPLE 006 — No Isolated Task**
>
> Nenhuma `ExecutionTask` pode existir sem uma cadeia causal auditável
> completa:
>
> ```
> Decision → Recommendation → Playbook → ActionPlan → Action → ExecutionTask → EvidenceReference[]
> ```
>
> Uma `ExecutionTask` sem uma `Action` de origem não é uma versão mais
> simples do modelo — é um modelo diferente (tarefa operacional livre),
> que não pertence a este agregado. Se um dia esse segundo modelo for
> necessário, ele nasce como um domínio novo, num Epic novo — nunca
> como uma ramificação condicional dentro do Execution Engine.

Consequência direta e deliberada: **tarefa ad-hoc (sem `ActionPlan`
por trás) fica inteiramente fora do Epic 16, sem exceção.** Motivo
técnico, não só de princípio: misturar as duas naturezas de tarefa
("derivada de decisão" vs. "livre") desde o primeiro commit tende a
espalhar `if (decisionBased) ... else ...` pelo sistema inteiro. Um
único modelo mental agora; um "Operational Task"/"Field Task" (nome
provisório) fica reservado para um domínio e um Epic futuros, só se
houver demanda real.

---

## Fases do Epic 16

> Atualizado em 16.9 (Release Closure) — a coluna "Entregue" registra o
> que de fato foi construído, não uma correção retroativa do plano
> original. As duas divergem em 16.5/16.6 porque o levantamento de
> produto mudou de direção no meio do Epic (ver
> `ACTIONPLAN_MATERIALIZATION_BOUNDARY.md`) — registrado aqui como
> histórico, não escondido.

| Fase | Planejado originalmente (16.1) | Entregue |
|---|---|---|
| 16.1 | Este documento — arquitetura e fronteiras | Igual ao planejado — arquitetura, fronteiras, PRINCIPLE 006 (`BDS_ARCHITECTURE_PRINCIPLES.md`) |
| 16.2 | Domain model puro (`packages/bdos-core`, sem I/O) | Igual ao planejado — `domain/execution-management` (`ExecutionWorkflow`/`ExecutionTask`, state machine, PRINCIPLE 006 aplicado em TS) |
| 16.3 | Persistência + RLS (schema real, migration) | Igual ao planejado — **e também entregou o que estava planejado para 16.6** (evidência/histórico de status: `execution_task_evidence_references`, `execution_task_status_history`), porque as duas tabelas nasceram junto do schema principal, não numa fase separada |
| 16.4 | Application Services (`services/execution-*`) — destrava o Workflow Handoff do Copilot | Igual ao planejado — `createExecutionWorkflowFromActionPlan`. Só não bastou sozinho para destravar o Copilot: faltava a peça do 16.6 (abaixo) |
| 16.5 | Field Studio UI mínima | **Reescopado pelo CPO durante a sprint** — virou repository/API mínima em `apps/web` (`execution-repository.ts`, `/api/execution/workflows`, `/api/execution/tasks`), sem UI própria. Field Studio (a tela) continua Planejado (`PLATFORM_ARCHITECTURE.md` §3/§14) |
| 16.6 | Evidência/histórico de status | **Substituído** — essa entrega já tinha saído junto do 16.3 (acima). Em vez disso, o levantamento desta fase descobriu que `buildPlaybooks`/`buildActionPlans` nunca tinham consumidor real em produção (`ACTIONPLAN_MATERIALIZATION_BOUNDARY.md`) — 16.6A/B/C generalizaram os dois e construíram `materializeExecutionWorkflowFromRecommendation`, o verdadeiro destravador do Workflow Handoff |
| 16.7 | Copilot handoff (consumindo o Application Service de 16.4) | Entregue, mas maior que o planejado — precisou do 16.6 primeiro, e ganhou desenho formal próprio (`COPILOT_WORKFLOW_HANDOFF.md`): aprovação estrutural (`approveRecommendationId`), nunca pelo Intent Router; resolução dentro do contexto congelado; atomicidade real via `approve_copilot_recommendation` (Postgres, `SECURITY INVOKER`); idempotência |
| 16.8 | *(não previsto no plano original)* | Botão "Aprovar" em `DecisionCopilotChat.tsx` — único consumidor real do contrato do 16.7 |
| 16.9 | *(não previsto no plano original)* | Release Closure — este documento, `PLATFORM_ARCHITECTURE.md`, `DECISION_COPILOT_PHASE2.md`, `EXECUTION_ENGINE_E2E_CHECKLIST.md` |

Mesma disciplina dos Epics 14/15: cada fase foi um incremento testável
sobre a anterior — sem schema antes de 16.2 responder os riscos
abaixo, e sem 16.7 antes do 16.6 resolver o pipeline real.

---

## Arquitetura final (fim do Epic 16)

"Fotografia" do fluxo definitivo — a cadeia causal completa que
PRINCIPLE 006 exige, ponta a ponta, mais o handoff real a partir do
Decision Copilot que a completa:

```
Decision
    │            (Decision Engine, engines/decision)
    ▼
Recommendation
    │            buildPlaybooks (16.6A — curado ou genérico,
    ▼             nunca inventa conteúdo sem dado real)
Playbook
    │            buildActionPlans (16.6B — mesma regra)
    ▼
ActionPlan
    │            createExecutionWorkflowFromActionPlan (16.4)
    ▼
ExecutionWorkflow
    │            1 ExecutionTask por Action (PRINCIPLE 006:
    ▼             sourceActionId sempre obrigatório)
ExecutionTask
    │            attachEvidenceReference (16.2) — obrigatório
    ▼             antes de completeExecutionTask aceitar "Completed"
EvidenceReference[]
```

Handoff real a partir do Decision Copilot (Epic 16.7/16.8), que
materializa a cadeia acima de ponta a ponta numa única chamada:

```
Decision Copilot (conversa)
    │
    │  botão "Aprovar" (16.8) — gesto estrutural, nunca texto livre;
    │  nunca passa por classifyCopilotIntent (Intent Router intocado)
    ▼
POST /api/copilot/message { approveRecommendationId, ... }
    │
    │  resolveCopilotApprovalTurn (bdos-core) — exige exatamente 1
    │  Recommendation no contexto congelado/auditável
    ▼
materializeExecutionWorkflowFromRecommendation (16.6C)
    │            = buildPlaybooks → buildActionPlans →
    │              createExecutionWorkflowFromActionPlan, compostos
    ▼
approve_copilot_recommendation (Postgres, SECURITY INVOKER)
    │            grava ExecutionWorkflow + ExecutionTasks +
    │              status history + o turno do Copilot numa única
    │              transação implícita — idempotente
    ▼
Execution Engine (execution_workflows/execution_tasks, RLS ativo)
```

Duas cadeias, um princípio só (PRINCIPLE 006): nenhuma `ExecutionTask`
existe sem essa proveniência completa, seja materializada manualmente
(16.4, `POST /api/execution/workflows`) ou pelo handoff real do
Copilot (16.7/16.8) — o mesmo `createExecutionWorkflowFromActionPlan`
está por trás dos dois caminhos, nunca duas implementações da mesma
regra.

---

## Riscos e decisões em aberto

Três dos quatro riscos originais desta seção foram decididos nesta
rodada de revisão (ver abaixo) — permanecem como registro de por que
a decisão foi tomada, não como pergunta em aberto. O que ainda falta
decidir está isolado nos itens marcados como **em aberto**.

1. **Dono semântico de `WorkPackage` — decidido para o Epic 16 inicial,
   não decidido em definitivo.** `ExecutionTask.workPackageId` fica
   **fora do schema inicial** (indefinido) — não porque a pergunta não
   importe, mas porque `WorkPackage` hoje não tem Studio dono declarado
   em `PLATFORM_ARCHITECTURE.md`, e amarrar `ExecutionTask` a ele agora
   seria inventar uma propriedade que o código atual não sustenta.
   `ExecutionTask.scheduleActivityId` fica **opcional** (não
   obrigatório). **Em aberto**: revisitar quando `WorkPackage` ganhar
   um dono de Studio declarado — não decidido aqui, nem estimado.

2. **Quem encerra uma `ExecutionTask` — parcialmente decidido.**
   Decidido: o Decision Engine **nunca** encerra uma `ExecutionTask` —
   encerramento ("concluído operacional") é prerrogativa exclusiva do
   Execution Engine; o efeito medido posteriormente pelo Decision
   Engine é um conceito separado, `ImpactConfirmed` (nome de trabalho),
   nunca uma condição de fechamento. **Em aberto**: o gatilho exato
   dentro do Execution Engine — declaração manual do responsável,
   exigência de evidência conferida, ou os dois. Fica para 16.2.

3. **Relação entre `ScheduleActivity.percentComplete`/`status` (já
   existente, dormente) e o apontamento granular do Execution Engine —
   decidido para o Epic 16 inicial.** Sem sincronização automática
   nesta fase: `ScheduleActivity` continua somente leitura, mantida
   pelo Project Studio como hoje; `ExecutionTask` é um apontamento
   próprio, paralelo, sem rollup. Um rollup automático fica para uma
   fase futura explícita, condicionada a uma regra formal própria —
   registrado aqui para não ser decidido por omissão mais adiante.

4. **Forma do "bloqueio" — em aberto.** Enum fechado (categorias
   conhecidas: aguardando material, aguardando aprovação, condição de
   campo...) ou texto livre com uma categoria solta? Consequência de
   16.2, não deste documento.

5. **Regras já fechadas, não riscos**: evidência nunca é armazenada
   pelo Execution Engine, só referenciada (`EvidenceReference[]` →
   `FieldEvidence.id` do Studio de Evidências); tarefa ad-hoc sem
   `ActionPlan` fica fora do Epic 16 sem exceção (PRINCIPLE 006
   proposto acima); Decision Engine nunca encerra `ExecutionTask`;
   `ScheduleActivity` permanece somente leitura, sem rollup automático
   nesta fase. Registradas aqui para não serem reabertas por engano em
   16.2.
