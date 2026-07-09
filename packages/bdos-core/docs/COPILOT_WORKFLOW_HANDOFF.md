# Copilot Workflow Handoff Approval Point — Epic 16.7 (arquitetura, pré-código)

> Mesma disciplina de `EXECUTION_ENGINE.md`/`ACTIONPLAN_MATERIALIZATION_BOUNDARY.md`:
> contrato primeiro, código depois. Nenhuma migration, nenhuma rota,
> nenhum componente deste documento está implementado — é a
> especificação a partir da qual o 16.7 será construído.

## Por que este documento existe

`DECISION_COPILOT_PHASE2.md` §5 bloqueou formalmente o Workflow
Handoff até o Execution Engine existir: "revisitar esta seção somente
quando `docs/PLATFORM_ARCHITECTURE.md` §3 registrar o Execution Engine
como 'em produção' ou 'em desenvolvimento'". Com 16.1–16.6C em `main`
(`materializeExecutionWorkflowFromRecommendation`,
`services/execution-management`), esse gatilho já existe — falta a
última peça: **onde, na conversa do Copilot, o gesto de aprovação
acontece**. Sem isso, a função existe mas não tem chamador real —
mesma forma de lacuna que `ACTIONPLAN_MATERIALIZATION_BOUNDARY.md`
descreveu para `buildPlaybooks`/`buildActionPlans` antes do 16.6.

## Decisão de produto (CPO, 2026-07-09)

**Aprovação é gesto estrutural, não linguagem natural.** Não entra um
5º valor no Intent Router — `DECISION_COPILOT_PHASE2.md` §1/§6
("nenhum novo intent além dos 4") permanece intacto. Free-text
continua exatamente como está hoje: `unsupported_action` intercepta
"aprove"/"aprova"/"aprovar" (`UNSUPPORTED_ACTION_VERBS`,
`copilot-intent-router.ts`) e responde com a recusa determinística
fixa, sem exceção. Motivo — não é só preservar a regra do documento,
é proteção real: linguagem livre não identifica de forma inequívoca
*qual* Recommendation, e aprovar algo que materializa
`ExecutionTask`s reais não pode depender de o Router ter interpretado
corretamente uma frase ambígua.

A aprovação é um segundo caminho, paralelo ao Intent Router, que
**nunca invoca `classifyCopilotIntent`**. É um campo estrutural no
mesmo endpoint que já existe (`POST /api/copilot/message`), preenchido
por uma ação explícita da UI (ex.: botão "Aprovar" anexado à mensagem
que já mostrou a Recommendation) — nunca por texto digitado.

## Contrato estendido

```
POST /api/copilot/message
{
  conversationId: string,
  studioId: string,

  // Caminho conversacional existente (Fase 1/15.2A-C) — inalterado.
  message?: string,

  // Caminho de aprovação (16.7) — mutuamente exclusivo com `message`.
  approveRecommendationId?: string,
  sourceDecisionSnapshotId?: string,
  engineeringProjectId?: string,
}
```

A rota decide qual caminho seguir **antes** de tocar em
`resolveCopilotTurn`:

```
approveRecommendationId presente
  → caminho de aprovação (não chama classifyCopilotIntent)
message presente
  → caminho conversacional existente (Fase 1 + Intent Router, inalterado)
nenhum dos dois / os dois ao mesmo tempo
  → 400 invalid_copilot_message_body
```

Isso preserva `resolveCopilotTurn`/`classifyCopilotIntent`
literalmente sem alteração de assinatura — o Intent Router nunca vê a
aprovação, nem para recusar, nem para classificar.

## Resolução dentro do contexto congelado/auditável — não do "snapshot mais recente"

**Decisão explícita (2026-07-09): a resolução nunca busca o snapshot
mais recente implicitamente.** O cliente precisa carregar, e o
servidor precisa validar, os três identificadores abaixo — se
qualquer um não bater com o estado atual resolvido pelo servidor, a
aprovação é rejeitada, nunca silenciosamente redirecionada para outro
dado:

| Campo enviado pelo cliente | Validado contra | Mismatch → |
|---|---|---|
| `engineeringProjectId` | `briefing.engineeringProjectId` (`getEngineeringAdvisorBriefing`, já resolvido pela rota hoje) | 409 `project_id_mismatch` — mesmo código já usado hoje para `projectId` no caminho conversacional |
| `sourceDecisionSnapshotId` | `briefing.decisionSnapshotId` | 409 `decision_snapshot_mismatch` (novo) — um novo `decision_snapshot` pode ter sido gerado entre o turno que mostrou a Recommendation e o clique em "Aprovar"; aprovar contra o snapshot novo silenciosamente aprovaria uma Recommendation que o usuário nunca viu |
| `approveRecommendationId` | `briefing.context.recommendations` (`EngineeringAdvisorContext.recommendations: ReadonlyArray<Recommendation>` — o tipo **real** do Decision Engine, com `options`, não a versão empobrecida de `EngineeringAdvisorPromptContext` que o Claude vê) | 404 `recommendation_not_found_in_context` |

`briefing.context.recommendations` já é exatamente a fonte que
`materializeExecutionWorkflowFromRecommendation` (16.6C) espera
receber como `input.recommendation` — nenhuma tradução de tipo
adicional é necessária, só um `.find(r => r.id === approveRecommendationId)`.

**Invariante explícita (2026-07-09): `approveRecommendationId` precisa
resolver exatamente 1 Recommendation em `briefing.context.recommendations`.**
`.find()` pressupõe unicidade sem verificá-la — a rota precisa checar
isso explicitamente, não assumir:

- **0 resultados** → 404 `recommendation_not_found_in_context` (já
  coberto acima).
- **2+ resultados** → 409 `duplicate_recommendation_in_context`
  (novo). Não deveria acontecer hoje (`Recommendation.id` já é único
  por construção no Decision Engine), mas a validação precisa existir
  no código, não só na garantia implícita do tipo — mesma disciplina
  de "nunca confiar em invariante não verificada" que já vale para
  `sourceDecisionSnapshotId`/`engineeringProjectId` acima.

### Gap real que o 16.7 precisa fechar (não é um risco em aberto — é escopo)

Confirmado por leitura de `apps/web/app/api/copilot/message/route.ts`:
a resposta hoje devolve `{ id, role, content, reasoningChain,
confidence, explainability }` — **sem `decisionSnapshotId`**, embora
`decision_snapshot_id` já seja persistido por mensagem
(`copilot-repository.ts`, `appendCopilotAssistantMessage`). A UI não
tem, hoje, como montar `sourceDecisionSnapshotId` para ecoar de volta
na aprovação. Isso precisa ser corrigido como parte do 16.7, não é uma
lacuna nova: o response shape do `POST` ganha `decisionSnapshotId`.
`engineeringProjectId` não tem o mesmo problema — é uma propriedade da
conversa inteira (`copilot_conversations.engineering_project_id`, já
gravado na criação), não por mensagem; a UI já o conhece a partir do
briefing/página que abriu o chat.

## Aprovação é sempre total, nunca parcial

**Decisão (2026-07-09): aprovar uma Recommendation aprova todas as
suas `RecommendationOption`s.** `buildGenericPlaybook`/
`buildGenericActionPlan` (16.6A/16.6B) já produzem 1 `PlaybookStep`/
`Action` por `RecommendationOption` — aprovação total materializa
todas de uma vez, sem seleção.

Aprovação parcial (aprovar só um subconjunto das options) fica
explicitamente fora do 16.7 — motivo registrado, não só adiado por
tempo:

- Exigiria um novo estado intermediário (quais options desta
  Recommendation já foram decididas vs. quais ainda não).
- Exigiria um novo modelo de auditoria (aprovação parcial de uma
  Recommendation não é mais "aprovado"/"não aprovado" binário).
- Pode distorcer a recomendação original — algumas `Recommendation`s
  são desenhadas como um conjunto coerente de ações, não um menu
  independente.

Se um pedido de produto real e explícito por aprovação parcial
aparecer, isso é revisão própria deste documento — mesma disciplina
já usada para Business Reality Simulator (`DECISION_COPILOT_PHASE2.md`
§4, `parked` até gatilho real).

## O que a aprovação faz

Depois da validação (seção acima), o caminho de aprovação chama
diretamente `materializeExecutionWorkflowFromRecommendation` (16.6C,
`services/execution-management`) — a mesma função, sem variação:

```
approveRecommendationId validado
    │
    ▼
recommendation = briefing.context.recommendations.find(...)
    │
    ▼
materializeExecutionWorkflowFromRecommendation({
  recommendation,
  createdAt: <horário do servidor>,
  correlationId: <conversationId, reaproveitado como correlação>,
  createdBy: auth.userId,
  sourceSystem: "decision-copilot",
})
    │
    ▼
{ workflow, tasks } (16.4, já existe) — ou erros de validação
(ExecutionServiceError[], já tipados, nunca lançados como exceção)
```

Nenhuma lógica nova aqui — mesma regra que já governou o 16.6C: "sem
lógica nova, sem recalcular decisão, sem interpretar Copilot, sem UI,
só compor as peças já aprovadas". O 16.7 só decide **quem chama** essa
composição e **quando** é seguro chamá-la.

## Atomicidade — invariante obrigatória, não um detalhe de implementação

**O fluxo de aprovação estrutural precisa ser executado como uma
única transação.** Validação de identidade, materialização
(`materializeExecutionWorkflowFromRecommendation`), persistência de
`execution_workflows`/`execution_tasks` e persistência do turno de
aprovação em `copilot_messages` são, do ponto de vista de auditoria,
**um único evento** — não quatro passos independentes que podem
divergir entre si.

Dois estados inconsistentes são inaceitáveis e precisam ser
impossíveis por construção, não só improváveis:

- `ExecutionWorkflow`/`ExecutionTask`s criados, mas o Copilot nunca
  registrou que a aprovação aconteceu (a conversa não teria trilha do
  porquê aquele workflow existe — quebra `PRINCIPLE 006` na prática,
  mesmo que não no schema).
- Turno de aprovação persistido no Copilot, mas o `ExecutionWorkflow`
  não existe (a conversa afirmaria algo que não é verdade — o mesmo
  risco de "parecer que executou sem executar de verdade" que
  `ACTIONPLAN_MATERIALIZATION_BOUNDARY.md` já identificou como razão
  para o Intent Router recusar pedidos de ação).

Se qualquer etapa falhar, a transação inteira faz rollback — nenhum
resultado parcial fica visível. Isto é uma decisão de arquitetura
registrada aqui, mesmo sendo implementada na camada de rota/API (não
em `bdos-core`, que não tem acesso a transação de banco) — o 16.7 não
está livre para implementar isso como "melhor esforço" sem transação
explícita.

## Turno determinístico de aprovação

Mesmo padrão de `buildClarifyTurn`/`buildUnsupportedActionTurn`
(`copilot-deterministic-turn-builder.ts`) — rule-based, nunca chama o
Claude, mesma trilha de auditoria obrigatória
(`context_snapshot`/`confidence`/`explainability`/`model` sempre
preenchidos, `CHECK copilot_messages_assistant_has_full_trail`
continua satisfeito sem relaxamento):

```ts
export function buildApprovalTurn(
  context: EngineeringAdvisorPromptContext,
  decisionSnapshotId: string | null,
  result: CreateExecutionWorkflowFromActionPlanResult
): CopilotAssistantTurn
```

- `model` — sentinela `COPILOT_RULE_BASED_MODEL`
  (`"copilot-rule-based-v1"`), mesma disciplina de custo auditável já
  usada para clarify/unsupported_action.
- `confidence.reasons` — precisa de um novo valor em
  `EngineeringAdvisorConfidenceReason`
  (`advisor-confidence.types.ts`), ex. `"recommendation_approved"`,
  mesmo padrão de extensão que `"clarifying_question"`/
  `"unsupported_action_request"` já estabeleceram — não reabre o tipo,
  só estende, mesma disciplina.
- `content` — texto determinístico descrevendo o que foi criado (ex.:
  `"Aprovado. Criei um workflow de execução com N tarefa(s) a partir
  de '<título da Recommendation>'."`), nunca gerado por Claude.
- Se `result.success === false` (uma `Action`/`ExecutionTask` falhou
  validação — não deveria acontecer, dado que `ActionPlan` já passou
  pelo Decision Engine, mas o tipo já prevê isso): o turno reporta a
  falha de forma honesta, nunca finge sucesso — mesma garantia que
  `ExecutionServiceError[]` já tipa em `createExecutionWorkflowFromActionPlan`.

## Reforço explícito do que isto NÃO muda

- **Texto livre "aprovar" continua `unsupported_action`.** Nenhuma
  alteração em `UNSUPPORTED_ACTION_VERBS` ou em
  `classifyCopilotIntent`. As duas superfícies (aprovação estrutural
  via botão, recusa determinística via texto) coexistem sem
  interferência — o Router não sabe que o caminho de aprovação existe.
- **Nenhum 5º intent.** `CopilotIntent` permanece `"answer" |
  "clarify" | "compare" | "unsupported_action"`, sem alteração de
  tipo.
- **Zero interpretação por LLM no caminho de aprovação.** Da validação
  de identidade (seção "Resolução...") até o turno de resposta, nada
  chama a API da Anthropic.
- **Aprovação total, nunca seleção parcial de options** (seção
  dedicada acima).

## Riscos e decisões em aberto (não resolvidos aqui)

1. **UI do gesto de aprovação** (botão, confirmação, onde ele aparece
   anexado a uma mensagem do Copilot) — fora de escopo deste
   documento, que fixa o contrato de API e a orquestração do lado do
   servidor. Fica para a implementação do 16.7 em `apps/web`/`packages/ui`.
2. **Persistir o `ActionPlan` materializado como entidade própria** —
   `ACTIONPLAN_MATERIALIZATION_BOUNDARY.md`, risco 1, continua em
   aberto; não decidido aqui. O caminho de aprovação funciona com
   `ActionPlan` efêmero, como já está desenhado em 16.6C.
3. **`scheduleActivityIdByActionId`** — `materializeExecutionWorkflowFromRecommendation`
   já aceita esse mapeamento opcional (16.4/16.6C); o caminho de
   aprovação do Copilot, na primeira versão, não o preenche (o
   Copilot não tem acesso a `ScheduleActivity`s no contexto atual —
   `DECISION_COPILOT_PHASE2.md` §3.2 confirma isso). Todas as
   `ExecutionTask`s nascem com `scheduleActivityId: null`, vínculo
   futuro fica para quando o Copilot ganhar contexto de cronograma.
4. **Dupla aprovação (dois cliques, duas abas).**
   `materializeExecutionWorkflowFromRecommendation` já é determinística
   (16.6C) — o mesmo `approveRecommendationId` produz sempre o mesmo
   `execution-workflow:<actionPlanId>`, então a segunda tentativa colide
   com a constraint de unicidade de `execution_workflows.id` em vez de
   criar um segundo workflow duplicado. **Comportamento esperado, não
   decidido em detalhe aqui**: a rota deve tratar essa colisão como
   `already_approved` (retornar o `workflow`/`tasks` já existentes,
   sucesso idempotente), não como um erro genérico de banco vazado ao
   usuário — a materialização já é idempotente por desenho; a resposta
   da API só precisa refletir isso em vez de escondê-lo atrás de uma
   falha de constraint. A forma exata (query prévia vs. capturar a
   violação e recuperar) fica para a implementação da rota, não para
   este documento.

## O que isto NÃO é

Não é uma mudança no Intent Router — `classifyCopilotIntent` permanece
com 4 valores fechados, sem tocar em nenhuma linha deste arquivo. Não
é aprovação por linguagem natural — nenhuma frase digitada aciona
`materializeExecutionWorkflowFromRecommendation`, só o campo
estrutural `approveRecommendationId`. Não é aprovação parcial de
options. Não é uma migration — `execution_workflows`/`execution_tasks`
(16.3) já suportam este fluxo sem alteração de schema.
