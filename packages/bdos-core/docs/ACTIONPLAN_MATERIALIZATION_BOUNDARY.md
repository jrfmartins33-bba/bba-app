# ActionPlan Materialization Boundary — Epic 16.6 (arquitetura, pré-rascunho)

> Mesma disciplina de `EXECUTION_ENGINE.md`/`DECISION_COPILOT_PHASE2.md`:
> fronteira e contrato primeiro, schema depois. Nenhuma migration, nenhum
> código deste documento — só o levantamento do estado atual e a
> fronteira do que falta para o Execution Engine (16.1-16.5, já em
> `main`) ter matéria-prima real para trabalhar.

## Por que este documento existe

`EXECUTION_ENGINE.md` (16.1) e `createExecutionWorkflowFromActionPlan`
(16.4) foram desenhados assumindo que um `ActionPlan` "já aprovado"
seria algo que o consumidor simplesmente teria em mãos. O levantamento
desta rodada mostrou que essa suposição não se sustenta — não por um
detalhe de implementação, mas porque a cadeia inteira que produziria
esse `ActionPlan` nunca foi ligada a nada real.

## Levantamento — três lacunas, não uma

### Lacuna 1: Playbook/ActionPlan são código morto fora do próprio teste

Confirmado por grep, não por leitura de comentário: `buildPlaybooks`
(`engines/decision/playbook/playbook-builder.ts`) e `buildActionPlans`
(`engines/decision/action-plan/action-plan-builder.ts`) **não têm
nenhum consumidor fora dos seus próprios módulos e testes unitários**.
Os dois pipelines que rodam de verdade em produção —
`services/bba-project-import/bba-project-import.ts` (BBA Project) e
`services/geospatial-product-integration/geospatial-product-integration.ts`
(Geo Studio) — param em `buildRecommendations`:

```
buildDecisions → buildRecommendations   ← pipeline real termina aqui
                                    ↓
                            buildPlaybooks → buildActionPlans   ← nunca chamado
```

`capabilities/cash-intelligence` nem chega a chamar
`buildDecisions`/`buildRecommendations`. Não existe hoje, em nenhum
pipeline real, uma linha de código que produza um `ActionPlan` a
partir de dado de cliente de verdade.

### Lacuna 2: Playbook só cobre um tipo de Recommendation, não os que o produto usa

`buildPlaybooks` só gera algo quando `Recommendation.metadata.
recommendationType === "cash_protection"` — o único template que
existe é "Cash Protection Playbook". As Recommendations que Project
Studio/Geo Studio de fato produzem hoje usam
`RecommendationActionType` de outra família inteiramente
(`regularize_spatial_geometry`, `attach_spatial_evidence`,
`corroborate_spatial_layers`, `defer_location_dependent_decisions`) —
nenhuma delas tem Playbook. Mesmo que a Lacuna 1 fosse resolvida (algo
chamasse `buildPlaybooks` de verdade), o resultado seria vazio para
toda Recommendation que o Copilot realmente mostra ao usuário hoje.

### Lacuna 3: não existe gesto de aprovação em lugar nenhum do produto

A tabela `recommendations` (memória operacional, Sprint 13.9) já tem
`status` desenhado exatamente para isto — `open → acknowledged →
in_progress → resolved → dismissed` — com um comentário explícito no
código (`apps/web/lib/bdos/repository.ts`) reconhecendo que a linha
"pode já estar sendo tratada por um humano". Mas **nenhuma rota,
nenhum repository, em lugar nenhum de `apps/web`, escreve nesse
campo**. Confirmado por grep: `persistRecommendation` só faz `INSERT`
(uma vez, no momento do import); não existe `UPDATE`. Ou seja: hoje
não existe, no produto real, nenhum jeito de dizer "estou aprovando
isto" — nem por essa tabela, nem por Playbook/ActionPlan.

**Decisão do CPO (2026-07-09) que resolve a Lacuna 3**: o gesto de
aprovação nasce no **Decision Copilot**, não numa UI de Recommendations
dedicada — conecta diretamente com o Workflow Handoff (Fase 3 do
Epic 15) já planejado, sem inventar uma segunda superfície de
aprovação.

## O que isso implica: o Copilot já tem o lugar certo para isto, e já bate numa fronteira que ele mesmo construiu

`copilot-intent-router.ts` (Epic 15, 15.2A) já classifica qualquer
pedido de ação — "aprove essa recomendação", no vocabulário exato que
um usuário usaria aqui — como `unsupported_action`, respondido sem
chamar o Claude, com a mensagem fixa "Ainda não consigo executar
ações". Este é exatamente o texto que a Lacuna 3 precisa deixar de
ser verdade, mas só quando as Lacunas 1 e 2 também estiverem
resolvidas — aprovar um pedido de execução sem ActionPlan real por
trás seria o Copilot "parecer" que executa sem executar de verdade.

## Desenho proposto (para revisão, não uma decisão fechada)

> Revisão desta seção (2026-07-09): a versão anterior propunha pular a
> camada Playbook inteiramente. Isso foi rejeitado — `PRINCIPLE 006`
> (`BDS_ARCHITECTURE_PRINCIPLES.md`) já documenta, como texto
> canônico e ratificado, a cadeia `Decision → Recommendation →
> Playbook → ActionPlan → Action → ExecutionTask → EvidenceReference[]`.
> Pular Playbook não seria um detalhe de implementação — seria reabrir
> um princípio já aprovado. A direção corrigida abaixo preserva a
> cadeia completa.

### Generalizar buildPlaybooks, não pular Playbook

A Lacuna 2 não é "Playbook é a peça errada" — é "o único template que
existe é estreito demais" (`isCashProtectionRecommendation`, só
`recommendationType === "cash_protection"`). A correção é generalizar
`buildPlaybooks`: quando a Recommendation não for do tipo Cash
Protection, cair num caminho genérico que constrói um `Playbook` real,
com `PlaybookStep`s reais, a partir do que a própria Recommendation já
tem — nunca pulando a etapa, nunca inventando conteúdo que não existe.

```
Recommendation (já real, já em decision_snapshots.recommendations)
    │
    │  Copilot classifica o pedido de aprovação (Intent Router
    │  já resolve qual Recommendation — 15.2A/15.2C)
    ▼
buildPlaybooks (engines/decision/playbook) — generalizado:
  cash_protection            → template curado já existente (inalterado)
  qualquer outro tipo        → buildGenericPlaybook(recommendation, decisionPriority)
    │
    │  1 PlaybookStep por RecommendationOption — título/descrição
    │  vêm exatamente da option, nada inventado
    ▼
Playbook (real, com PlaybookSteps reais)
    │
    ▼
buildActionPlans (engines/decision/action-plan) — inalterado:
  1 Action por PlaybookStep, sourceStepId continua obrigatório e
  aponta para um PlaybookStepId real
    ▼
ActionPlan (real, com Actions reais, cadeia completa e íntegra)
    │
    ▼
createExecutionWorkflowFromActionPlan (16.4, já existe, sem alteração)
```

**Regra de honestidade, aplicada literalmente ao `buildGenericPlaybook`
proposto:**

| Campo do `Playbook`/`PlaybookStep` | De onde vem | Se não houver dado real |
|---|---|---|
| `PlaybookStep.title`/`.description` | `RecommendationOption.title`/`.description` (já existe) | — (option sempre tem os dois) |
| `Playbook.objective` | `Recommendation.summary` (já existe) | — (Recommendation sempre tem summary) |
| `Playbook.recommendationId` | `Recommendation.id` (já existe) | — |
| `PlaybookStep.priority` | `Decision.priority` (real, propagado — a Decision já está disponível no mesmo contexto que produziu a Recommendation) | Nunca ausente: toda Recommendation nasce de uma Decision |
| `Playbook.kpis`/`.risks`/`.successCriteria` | Nada na Recommendation descreve isso hoje | **Array vazio — nunca inventado** |
| `PlaybookStep.estimatedImpact`/`.estimatedEffort` | Nada na Recommendation/`RecommendationOption` descreve isso hoje | **`undefined` — ver "Decidido" abaixo: os dois campos passam a ser opcionais em `PlaybookStep`** |

`Action.sourceStepId` **permanece obrigatório, sem nenhuma alteração
de tipo** — todo `Action` continua apontando para um `PlaybookStep`
real, cash protection ou genérico. A cadeia do `PRINCIPLE 006` fica
intacta, literalmente, não só "no espírito".

**Decidido (2026-07-09): `PlaybookStep.estimatedImpact`/`.estimatedEffort`
tornam-se opcionais em `playbook.types.ts`.** São atributos de
enriquecimento, não de causalidade — a cadeia que `PRINCIPLE 006`
protege é `RecommendationOption → PlaybookStep → Action`, e nenhum dos
dois elos depende de estimativa de impacto/esforço para existir.
Tornar os campos opcionais não reabre o princípio: a cadeia causal
continua obrigatória ponta a ponta, só um atributo descritivo deixa de
ser obrigatório quando não há dado real para preenchê-lo. Regra para
`buildPlaybooks` daqui em diante:

- **Templates curados** (ex.: Cash Protection) podem continuar
  preenchendo `estimatedImpact`/`estimatedEffort` — é conteúdo que um
  humano já validou ao escrever aquele template específico.
- **`buildGenericPlaybook`** nunca preenche os dois campos — ficam
  `undefined`, nunca um valor "medium" ou qualquer outro placeholder
  inventado.

É uma mudança de tipo em `engines/decision/playbook`, ainda fora da
fronteira do Execution Engine — precisa da mesma revisão que qualquer
mudança no Decision Engine antes de virar código, mas a decisão de
direção já está fechada aqui.

### Onde o ActionPlan materializado é persistido

Hoje `execution_workflows.action_plan_ref_id` é `TEXT` sem FK,
desenhado assumindo que o `ActionPlan` continuaria vivendo como JSONB
em algum lugar (mesmo raciocínio de `Recommendation`). Se o 16.6
decidir persistir o `ActionPlan` materializado como sua própria
entidade (para o usuário poder ver "o que foi aprovado" depois, não
só o resultado da execução), isso é uma tabela nova — não altera o
que já foi commitado no 16.3, só adiciona. Se decidir manter
`ActionPlan` como um valor efêmero (materializado, usado
imediatamente para criar o `ExecutionWorkflow`, nunca persistido por
si só), `action_plan_ref_id` continua exatamente como está. As duas
opções são compatíveis com o schema atual — a decisão fica para
quando este documento for revisado, não tomada aqui.

## Sequenciamento proposto para o Epic 16.6

| Sub-sprint | Entrega |
|---|---|
| 16.6A | Generalizar `buildPlaybooks` — `buildGenericPlaybook`, `estimatedImpact`/`estimatedEffort` opcionais em `PlaybookStep`, testes garantindo a regra de honestidade (nunca preenche KPI/risco/critério/impacto/esforço sem dado real) |
| 16.6B | Materializar `ActionPlan`s a partir de Playbooks genéricos — a orquestração `buildPlaybooks → buildActionPlans → createExecutionWorkflowFromActionPlan` como uma sequência só (Risco 3 decide onde ela mora) |

Mesma disciplina dos Epics 14/15/16 anteriores: 16.6A é testável e útil
sozinho (generaliza o Decision Engine mesmo que 16.6B atrase); 16.6B
depende de 16.6A existir.

## Riscos e decisões em aberto

1. **Persistir `ActionPlan` como entidade própria, ou mantê-lo
   efêmero?** Ver seção acima — as duas opções cabem no schema atual
   do 16.3 sem alteração; a diferença é o que fica visível/auditável
   depois do handoff.
2. **Aprovação parcial de options.** Uma Recommendation pode ter mais
   de uma `RecommendationOption` (ex.: "reduzir gasto" vs. "renegociar
   prazo" para o mesmo déficit de caixa). Com Playbook generalizado
   (1 `PlaybookStep` por `RecommendationOption`), aprovar uma opção só
   provavelmente significa aprovar um subconjunto dos `PlaybookStep`s
   do Playbook gerado, não o Playbook inteiro — o Intent Router
   (15.2C, Alternative Comparison) já resolve esse tipo de seleção;
   reaproveitar aquele mecanismo em vez de inventar um novo é a
   direção provável, não decidida aqui.
3. **Nome e localização do novo caminho de materialização (16.6B).**
   `buildGenericPlaybook` vive em `engines/decision/playbook` (mesmo
   módulo do template curado) — isso parece claro. Menos claro: quem
   orquestra `buildPlaybooks` → `buildActionPlans` →
   `createExecutionWorkflowFromActionPlan` como uma sequência só —
   um Application Service novo, ou uma extensão de
   `services/execution-management`? Não decidido — depende de qual
   lado da fronteira (Decision Engine vs. Execution Engine) essa
   orquestração conceitualmente pertence.
4. **Onde exatamente, na conversa do Copilot, a aprovação acontece.**
   O Intent Router precisaria de um 5º valor (`approve`?) ou o
   `unsupported_action` atual muda de significado quando o ActionPlan
   materializado existir? Isso toca `DECISION_COPILOT_PHASE2.md` §6,
   regra "nenhum novo intent além dos 4" — uma mudança nessa regra
   precisa passar pela mesma revisão que a criou, não ser decidida de
   passagem aqui.
5. **Regra fechada, não um risco**: `PlaybookStep.estimatedImpact`/
   `.estimatedEffort` tornam-se opcionais; `buildGenericPlaybook`
   nunca os preenche; templates curados podem continuar preenchendo-os.
   Registrado aqui para não ser reaberto por engano em 16.6A.

## O que isto NÃO é

Não pula a camada Playbook — a versão anterior deste documento propôs
isso e foi corrigida por reabrir `PRINCIPLE 006` sem revisão própria.
Não é uma decisão de expandir o Intent Router — isso fica marcado como
risco em aberto (item 4), não resolvido. Não é uma migration — nenhuma
tabela é criada aqui.
