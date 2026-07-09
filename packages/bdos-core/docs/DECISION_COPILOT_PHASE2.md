# Decision Copilot — Epic 15, Fase 2 (design, pré-sprint)

> Mesma disciplina de `DECISION_COPILOT.md` (Fase 1) e de
> `docs/PLATFORM_ARCHITECTURE.md` §15: schema e contrato primeiro, código
> depois. Nada deste documento está implementado — é a especificação a
> partir da qual a Fase 2 será construída, sub-sprint por sub-sprint.

## Por que este documento existe

A Fase 1 entregou a fundação: turno persistido, auditável, com
reasoning chain/confidence/explainability congelados
(`copilot_conversations`/`copilot_messages`, PR #3/#4). A Fase 2 é onde
o Copilot passa a se comportar como copiloto de verdade — conduzir, não
só responder. São 5 capacidades novas (Intent Router, Clarifying
Questions, Alternative Comparison, Business Reality Simulator,
Workflow Handoff) que, se implementadas ad-hoc uma de cada vez sem um
desenho comum, tendem a colidir: cada uma tenta resolver "que tipo de
turno é esse" à sua própria maneira, o schema genérico da Fase 1 vira
5 formatos improvisados, e o limite entre "o Copilot interpreta" e "o
Copilot decide" começa a vazar.

Este documento fixa, antes do código: (1) o que cada capacidade
realmente precisa, a partir do que já existe hoje no código — não do
que pareceria bonito; (2) uma sequência de sub-sprints, para que cada
capacidade seja um incremento testável sobre a anterior, não um
mega-sprint; (3) os limites arquiteturais que valem para as 5 ao mesmo
tempo, para não precisar redecidir isso a cada uma.

## Achado que muda o desenho: nem toda "alternativa" já existe pronta

O quadro da Fase 1 (`DECISION_COPILOT.md`, "Por que Copilot, não chat")
listava `domain/business-reality-simulator` e
`/api/bba-project/simulate-delay` juntos como a peça pronta para
"Comparar alternativas". Não são a mesma coisa, e a diferença decide o
desenho de duas das cinco capacidades abaixo:

| Mecanismo | O que realmente é | Serve para |
|---|---|---|
| `domain/business-reality-simulator` | Gerador de **dados sintéticos de demonstração** (empresa fictícia "Alpha Engenharia", eventos financeiros fabricados) — usado para alimentar cenários de teste/demo do Business Facts Generator, não uma ferramenta de simulação sobre dados reais de cliente | Nada diretamente aproveitável pelo Copilot em produção — não confundir com um motor de simulação |
| `simulateScheduleDelay` (`services/bba-project-import/living-schedule.ts`) | Função pura: recebe atividades + um atraso hipotético numa atividade, recalcula caminho crítico e Curva S. Sem persistência, sem Decision/Recommendation nova | Comparação de **cenários de cronograma** (schedule what-if) |
| `Recommendation.options: RecommendationOption[]` (`engines/decision/recommendation/recommendation.types.ts`) | Cada `Recommendation` já computada pelo Decision Engine já carrega **múltiplas opções de ação** para a mesma `Decision` (ex.: `reduce_discretionary_spending` vs. `renegotiate_payment_terms` para um mesmo déficit de caixa) | Comparação de **alternativas de ação** para uma Decision |

E a segunda metade do achado: **`options` é hoje deliberadamente
removido do contexto que chega ao Claude.**
`advisor-prompt-context.types.ts` documenta isso explicitamente:

```
// Só os campos que o system prompt realmente instrui o Claude a citar
// sobrevivem aqui: nenhum "options", nenhum traceability.businessFactIds/
// evidenceReferences, nenhum metadata de bookkeeping interno do BDOS.
```

Essa foi uma decisão deliberada do Prompt Context Optimizer (Sprint
14.2B) — não um esquecimento. "Alternative Comparison" da Fase 2
significa, na prática, **reabrir essa decisão de propósito** para um
subconjunto de turnos, não assumir que o dado já chega pronto. Ver
§3.

## Sequenciamento sugerido (sub-sprints)

Mesmo padrão do Epic 14 (14.2A/14.2B/14.3): cada entrega é testável e
não depende de nada posterior na sequência. A única exceção admitida é
15.2A+15.2B entre si (ver motivo na tabela) — por isso as duas viram
uma unidade de entrega só, não dois sub-sprints independentes. Se a
Fase 2 precisar parar depois dessa unidade, o que já foi entregue
continua íntegro e útil sozinho (Intent Router + clarify determinístico
já melhora a Fase 1 mesmo sem Alternative Comparison).

| Sub-sprint | Capacidade | Depende de |
|---|---|---|
| 15.2A + 15.2B | Intent Router + Clarifying Questions determinísticas | Só da Fase 1 (schema/service layer já existem). **Entregues como uma unidade só** (um PR): o Router não é entregável sozinho — classificar `compare` sem alvo resolvido exige o caminho de `clarify` para existir no mesmo commit (ver §1/§2) |
| 15.2C | Alternative Comparison com elegibilidade rígida | 15.2A+15.2B (a resolução de alvo do Router decide se `compare` roda ou vira `clarify`) — **não** depende de Business Reality Simulator |

**Bloqueados — fora da sequência ativa, sem número de sub-sprint:**

| Capacidade | Por que está bloqueada | O que destrava |
|---|---|---|
| Business Reality Simulator | Falta de gatilho de produto — é demo/sandbox, não decisão real (ver §4) | Um pedido de produto real e explícito por um modo demo do Copilot; até lá, `parked` |
| Workflow Handoff | Falta de infraestrutura — Execution Engine tem zero código hoje (ver §5) | `docs/PLATFORM_ARCHITECTURE.md` §3 registrar o Execution Engine como "em produção" ou "em desenvolvimento" |

Ordem de leitura das seções abaixo segue essa sequência.

---

## 1. Intent Router (Sub-sprint 15.2A + 15.2B)

### Problema

Hoje `runCopilotTurn` sempre faz a mesma coisa para qualquer pergunta:
monta o mesmo `EngineeringAdvisorPromptContext`, usa o mesmo
`SYSTEM_PROMPT`, espera de volta exatamente 1 insight
(`copilot-response-validator.ts`). Isso é correto para "por que esse
projeto está em risco?", mas quebra silenciosamente para três outras
formas de pergunta que a Fase 2 precisa suportar:

- Pergunta ambígua demais para responder sem mais contexto do usuário
  (→ Clarifying Questions, §2).
- Pedido de comparação entre alternativas (→ Alternative Comparison,
  §3) — o formato "exatamente 1 insight, resposta corrida" não
  representa bem "compare a opção A com a B".
- Pedido de ação ("adia essa atividade", "aprova essa recomendação")
  que a Fase 1 não tem como cumprir e hoje seria respondido como se
  fosse uma pergunta de leitura — risco real de o Claude *parecer*
  estar executando algo que não executou.

### Desenho

Intent Router é uma etapa nova **antes** de `callClaudeForCopilotTurn`,
não uma segunda chamada ao Claude:

```
POST /api/copilot/message
  → classifyCopilotIntent(message, conversationHistory)   [novo]
  → runCopilotTurn(..., intent)                            [Fase 1, adaptado]
```

`classifyCopilotIntent` retorna um de 4 valores fechados —
`"answer" | "clarify" | "compare" | "unsupported_action"` — e vive em
`packages/bdos-core/src/advisor/copilot/copilot-intent-router.ts`
(mesmo nível de `copilot-turn-builder.ts`).

**Decisão fechada (não mais em aberto)**: classificação **100%
rule-based** — heurística por regra (palavras-chave "compare",
"diferença entre", "qual das duas" para `compare`; verbos no
imperativo "aprove", "adie", "execute", "aplique" para
`unsupported_action`), nunca uma chamada ao Claude para decidir o
intent. `unsupported_action` nunca chega a `runCopilotTurn` — a rota
responde direto com uma mensagem fixa explicando que o Copilot ainda
só interpreta e não executa (mesmo texto/tom do aviso de
indisponibilidade já usado para o erro de billing — ver PR #5), sem
gastar uma chamada ao Claude para dizer isso.

### Resolução de alvo (entra no escopo do Router, não do 15.2C)

`compare` só é um intent válido se o Router conseguir resolver, na
própria mensagem ou no histórico imediato da conversa, **um alvo
específico** — uma `Recommendation` ou uma atividade de cronograma.
Sem alvo resolvido, `compare` vira `clarify` (ver §2) — nunca chega a
`runCopilotTurn` com um pedido de comparação genérico demais. A
resolução também é 100% determinística, nesta ordem:

1. **Id explícito** — a mensagem cita um id de Decision/Recommendation/
   atividade que já existe no `EngineeringAdvisorPromptContext` atual.
2. **Título aproximado** — match de substring/normalização simples
   (case-insensitive, sem acento) entre a mensagem e os `title` das
   Decisions/Recommendations/atividades no contexto atual — ex.
   "Bloco 3" casa com uma Decision cujo título contém "Bloco 3".
3. **Número escolhido da última lista determinística** — se o turno
   anterior do Copilot nesta conversa foi um `clarify` com uma lista
   numerada (§2), e a mensagem atual é só um número ou uma referência
   curta ("a 2", "a segunda"), o Router re-deriva a mesma lista
   determinística a partir do contexto atual e resolve o índice —
   sem precisar persistir a lista em lugar nenhum, porque ela é uma
   função pura do contexto (ver §2 para a garantia de estabilidade
   disso).

Se nenhuma das três resolver um alvo único, `compare` vira `clarify`.
Ambiguidade (mais de um candidato batendo com o título, por exemplo)
também vira `clarify`, pelo mesmo motivo.

### Escopo

**Dentro:** `classifyCopilotIntent` puro (bdos-core, sem I/O), 4 valores
fechados, heurística por regra, resolução de alvo (id/título/número, as
3 estratégias acima), testes unitários por categoria de pergunta e por
estratégia de resolução.
**Fora:** classificação ou resolução de alvo por modelo — não entra
nesta fase sob nenhuma condição (ver regra geral "determinístico
primeiro" em §6); qualquer intent novo além dos 4 listados — um 5º
intent só entra quando uma capacidade real precisar dele, mesmo
princípio anti-abstração-prematura da Fase 1.

---

## 2. Clarifying Questions (Sub-sprint 15.2A + 15.2B)

### Problema

Hoje, se a pergunta do usuário não tem contexto suficiente para uma
resposta com evidência real, `SYSTEM_PROMPT` já instrui o Claude a
"explicar isso em summary citando a Decision mais relevante ainda
assim" — ou seja, a Fase 1 força uma resposta mesmo quando a pergunta
certa seria "qual das 3 Decisions você quer dizer?". Isso é uma
limitação deliberada da Fase 1 (documentada como fora de escopo), não
um bug.

### Desenho — determinístico, sem Claude

Quando `classifyCopilotIntent` retorna `"clarify"` (pergunta ambígua
ou `compare` sem alvo resolvido, ver §1), o turno **não chama o
Claude**. `buildDeterministicClarifyTurn(context)` (bdos-core, puro)
monta a pergunta a partir do próprio `EngineeringAdvisorPromptContext`
— lista numerada dos candidatos (Decisions e/ou Recommendations
elegíveis), mesmo formato do exemplo aprovado:

```
Encontrei mais de uma decisão relacionada. Você quer analisar:
1. Bloco 2
2. Bloco 3
3. Escavação
```

**Corte da lista**: top-N por prioridade (`critical` > `high` >
`medium` > `low`, desempate por mais recente). N = 5 como valor
inicial — revisitar só se o uso real mostrar que 5 corta candidatos
relevantes com frequência.

**Estabilidade da lista** (o que permite a resolução por número no
§1, item 3): a lista é uma função pura de
`EngineeringAdvisorPromptContext` — mesmo contexto, mesma lista, mesma
ordem. Não precisa ser persistida à parte para o próximo turno
resolver "a 2"; o Router simplesmente reexecuta a mesma função sobre o
contexto do turno seguinte.

**`CLARIFYING_SYSTEM_PROMPT` via Claude (reformular a pergunta de
forma mais natural) fica fora desta fase.** Não há decisão pendente
aqui — é trabalho explicitamente adiado, sem sub-sprint atribuído, só
reconsiderado se o texto determinístico se mostrar realmente
inadequado em uso (ver regra geral "determinístico primeiro", §6).

### Resolvendo a tensão com o CHECK do schema da Fase 1

`CHECK copilot_messages_assistant_has_full_trail` exige
`context_snapshot`, `confidence`, `explainability` e `model` em
**todo** turno `assistant`. Um turno de clarify determinístico
preenche os 4 mesmo assim, sem relaxar a constraint:

- `context_snapshot` — o mesmo `EngineeringAdvisorPromptContext` que
  gerou a lista (auditoria: "por que o Copilot perguntou isso").
- `confidence`/`explainability` — forma degenerada mas válida,
  construída em código (não pelos builders que operam sobre um
  insight): ex. `confidence.overall = "low"` com uma nota fixa
  "pergunta de esclarecimento, sem afirmação a avaliar".
- **`model` — sentinela fixo `"copilot-rule-based-v1"`**, não
  `"claude-sonnet-5"` nem vazio. Não é só preencher a coluna: é o que
  torna auditável, por uma query simples
  (`WHERE model = 'copilot-rule-based-v1'`), quantos turnos o Copilot
  resolveu sem gastar chamada à Anthropic — métrica de custo direta
  desta decisão.

Não exige migration nova. Coluna `turn_type` (modelagem explícita de
tipo de turno) continua fora de escopo — só entra se algum dia o
schema genérico (`role` + `content` + campos de auditoria) provar que
não basta, mesma disciplina de generalização tardia da Fase 1.

### Escopo

**Dentro:** `buildDeterministicClarifyTurn` puro (bdos-core, sem
Claude), corte top-5 por prioridade, sentinela `model` dedicado, teste
garantindo que a lista só cita ids reais do contexto e que dois turnos
sobre o mesmo contexto produzem a mesma lista na mesma ordem.
**Fora:** `CLARIFYING_SYSTEM_PROMPT`/qualquer chamada ao Claude para
formular a pergunta (adiado, ver acima); coluna `turn_type`; resposta
automática do usuário à pergunta de esclarecimento sem novo turno —
Fase 2 trata isso como qualquer outra mensagem `user` subsequente na
mesma conversa, resolvida pelo Router (§1, item 3).

---

## 3. Alternative Comparison (Sub-sprint 15.2C)

### Problema

Ver o achado no topo do documento: `options` de cada `Recommendation`
é deliberadamente removido do contexto hoje. "Compare as alternativas
para resolver X" não tem hoje matéria-prima no `EngineeringAdvisorPromptContext`
para ser respondida com uma citação real — o Claude só veria
`title`/`summary` da Recommendation, nunca suas opções.

### Elegibilidade — gate obrigatório antes de qualquer comparação

`compare` só chega até aqui se o Router (§1) já resolveu um alvo
único — uma `Recommendation` específica ou uma atividade de cronograma
específica. "Compare as opções" sem alvo nunca gera contexto de
comparação nenhum: vira `clarify` antes de chegar em §3.1/§3.2. Isso
não é validação redundante — é a única razão pela qual é seguro reabrir
`options` no Prompt Context Optimizer (abaixo): o campo só é populado
para exatamente 1 Recommendation/atividade por turno, nunca "todas as
opções de todas as Recommendations", que é o cenário que estouraria
orçamento de tokens e reabriria a decisão do Sprint 14.2B sem
necessidade.

### Desenho

Dois mecanismos distintos, cada um cobrindo um tipo diferente de
"alternativa" (não confundir os dois, mesmo erro que o quadro da Fase
1 cometeu):

**3.1 — Alternativas de ação (Recommendation.options)**

Novo campo opcional no Prompt Context, só populado depois que o gate
de elegibilidade acima já resolveu a Recommendation-alvo — nunca todas
as opções de todas as Recommendations de uma vez:

```ts
// Novo, só quando intent === "compare"
export interface EngineeringAdvisorPromptRecommendationOption {
  readonly id: RecommendationOptionId;
  readonly type: RecommendationActionType;
  readonly title: string;
  readonly description: string;
}
```

Isso é uma extensão explícita e testada do Prompt Context Optimizer,
não um bypass dele — o comentário em
`advisor-prompt-context.types.ts` ("nenhum 'options'... sobrevivem
aqui") precisa ser atualizado nesse commit para não mentir sobre o
contrato atual.

**3.2 — Alternativas de cronograma (`simulateScheduleDelay`)**

Para perguntas do tipo "e se eu atrasar X em 5 dias em vez de 10?", o
Copilot chama `simulateScheduleDelay` (já existe, puro, sem
persistência) para as duas hipóteses e passa os dois resultados
(caminho crítico, Curva S) como parte do contexto do turno — não como
uma nova Decision, é um cálculo hipotético descartável, igual ao uso
que a Living Schedule já faz dele hoje na UI.

**Formato da resposta**: mantém a mesma forma de `CopilotAssistantTurn`
(1 `content` textual) — a comparação vira prosa estruturada dentro do
`summary` do único insight, não uma segunda mudança de cardinalidade
sobre o já decidido "exatamente 1 insight por turno" da Fase 1. Se, na
prática, a UI precisar renderizar a comparação como algo mais
estruturado que texto corrido (ex.: uma tabela lado a lado), isso é um
formato de **apresentação** derivado do mesmo `content`/`reasoningChain`
existentes — não uma razão para reabrir a cardinalidade do schema.

### Escopo

**Dentro:** `EngineeringAdvisorPromptRecommendationOption` (3.1),
chamada a `simulateScheduleDelay` a partir do turno do Copilot (3.2),
system prompt de comparação, testes garantindo que options só aparecem
no contexto quando `intent === "compare"`.
**Fora:** qualquer simulação nova além de `simulateScheduleDelay`
(orçamento, recursos, etc. — não existem hoje, não é este documento
que os cria); comparação envolvendo mais de uma Decision ao mesmo
tempo (fica para se houver pedido real de uso).

---

## 4. Business Reality Simulator — `parked`, fora da sequência ativa

### Esclarecimento necessário antes de desenhar

`domain/business-reality-simulator` como existe hoje (`company.ts`,
`company.types.ts`) **não é** uma ferramenta de simulação para uso em
produção — é um gerador de dados sintéticos (empresa fictícia "Alpha
Engenharia", eventos financeiros fabricados) para alimentar cenários
de demonstração/teste do Business Facts Generator.
`docs/PLATFORM_ARCHITECTURE.md` §3 já registra esse domínio como "ainda
não classificado dentro de um Studio específico" — ele não tem hoje
nem consumidor de produção, nem contrato de simulação sobre dados
reais de cliente.

Duas leituras possíveis do que o título desta seção pede, e a escolha
entre elas muda o tamanho do trabalho em uma ordem de grandeza:

1. **O Copilot usa dados sintéticos do simulador para demonstração/
   sandbox** (ex.: um modo demo do Decision Copilot para prospecção
   comercial, sem dado real de cliente) — reaproveita
   `business-reality-simulator` como está, sem mudança de
   arquitetura, só um novo consumidor.
2. **O Copilot ganha uma capacidade real de simulação sobre dados de
   cliente** ("e se a receita cair 10%?", "e se eu perder esse
   cliente?") — isso não existe hoje em lugar nenhum do BDOS; seria um
   Engine novo (mais próximo do papel do Decision Engine que do
   `business-reality-simulator` atual), fora do escopo de "compor o
   que já existe" que guiou a Fase 1 e o resto da Fase 2.

**Decisão fechada**: nenhuma das duas leituras entra na sequência ativa
da Fase 2. (2) é um Epic próprio do tamanho do Decision Engine
original — fora de cogitação aqui sem documento de desenho e decisão
de roadmap separados. (1) — modo demo/sandbox — é tecnicamente barato,
mas foi explicitamente retirado da sequência: misturar dado fictício
("Alpha Engenharia") no mesmo produto que já lida com Decisions/
Recommendations reais de cliente é risco de confusão maior do que o
valor de ter um modo demo agora, sem que exista hoje um pedido de
produto concreto puxando isso.

### Estado

`parked` / `demo-only` / **not production path**. Não tem sub-sprint,
não tem posição na sequência do §"Sequenciamento sugerido". Esta seção
existe só para registrar o esclarecimento sobre o que
`business-reality-simulator` realmente é (ver achado no topo do
documento) e a decisão de não usá-lo agora — não como especificação
pronta para implementar. Só volta à mesa mediante um pedido de produto
real e explícito por um modo demo do Copilot; quando isso acontecer, a
leitura (1) acima é o ponto de partida, não um novo desenho do zero.

### Escopo

**Fora, sem exceção, até novo gatilho de produto:** qualquer código
novo sob esta seção — nem o modo demo (leitura 1), nem simulação
financeira real (leitura 2).

---

## 5. Workflow Handoff (Execution Engine) — bloqueado, não é sub-sprint da Fase 2

### Por que isto não tem um número de sub-sprint

`docs/PLATFORM_ARCHITECTURE.md` §3 é explícito: Execution Engine
(Field Studio) "ainda não existe pasta própria — nenhum domínio de
execução física foi iniciado" — zero código. `ActionPlan`
(`engines/decision/action-plan/action-plan.types.ts`), a peça mais
próxima de um "workflow" que o BDOS produz hoje, tem
`ActionPlanStatus = "created"` como único valor possível — não existe
sequer o conceito de "em andamento"/"concluído" no dado, quanto mais um
serviço que receba um ActionPlan e o execute.

`DECISION_COPILOT.md` (Fase 1) já registrou isso como "Fase 3, fora
deste documento" e fixou a regra que continua valendo: quando o
Execution Engine existir, "o Copilot só pode chamar `services/*`
(Application Services) que já existem — nunca escrever lógica de
negócio nova por conta própria". Este documento não muda essa decisão,
só a reafirma para que a Fase 2 não a redecida por conta própria no
meio de uma implementação.

### O que a Fase 2 pode fazer sobre isto

Nada que acione algo de verdade. O único trabalho legítimo aqui é
**garantir que o Copilot nunca finja que pode**:

- O Intent Router (§1) já cobre isso — `unsupported_action` intercepta
  qualquer pedido de execução antes de chegar a uma resposta do Claude
  que poderia soar como confirmação de uma ação.
- Se a UI quiser mostrar um `ActionPlan` já computado pelo Decision
  Engine dentro de uma resposta do Copilot (ex.: "aqui está o plano de
  ação sugerido"), isso é **apresentação de um dado que já existe**
  (o Decision Engine já produz `ActionPlan`), não Workflow Handoff —
  não precisa esperar o Execution Engine, mas também não é o item
  desta seção.

### Escopo

**Dentro:** nada de código de execução. Só a garantia (via Intent
Router) de que pedidos de execução recebem uma resposta honesta de
"ainda não consigo fazer isso" em vez de uma resposta ambígua.
**Fora:** qualquer chamada a um serviço de execução — não existe
serviço para chamar. Revisitar esta seção **somente** quando
`docs/PLATFORM_ARCHITECTURE.md` §3 registrar o Execution Engine como
"em produção" ou "em desenvolvimento" — até lá, esta seção permanece
bloqueada por definição, não por prioridade.

---

## 6. Limites arquiteturais do Copilot (valem para as 5 capacidades acima)

Consolidação das regras que já apareciam espalhadas nas seções
anteriores — reunidas aqui para serem citadas de um lugar só em
revisão de código, em vez de precisarem ser re-encontradas em cada
seção.

1. **O Copilot nunca é uma segunda fonte de fatos.** Vale para Intent
   Router, Clarifying Questions e Alternative Comparison igualmente: o
   Claude só pode citar o que está explicitamente no
   `EngineeringAdvisorPromptContext` daquele turno — inclusive as
   extensões novas da Fase 2 (`options`, resultado de
   `simulateScheduleDelay`). Nenhuma capacidade nova ganha licença para
   inferir além do que o contexto contém.
2. **O Copilot nunca cria Decision, Recommendation ou ActionPlan
   novos.** Alternative Comparison compara opções que o Decision
   Engine já computou; não gera opções novas. Workflow Handoff, quando
   existir, só pode acionar workflows a partir de um `ActionPlan` que
   o Decision Engine já produziu — nunca compor um novo por conta
   própria.
3. **Intent Router classifica, não decide.** A classificação de intent
   é sobre *forma da resposta* (responder / perguntar / comparar /
   recusar), nunca sobre *conteúdo de negócio* (nunca decide, por
   exemplo, qual Recommendation é "a certa" — isso é papel do Decision
   Engine, que já rodou antes do Copilot existir).
4. **Nenhuma capacidade nova conhece Studio.** Igual à Fase 1: o
   código de `advisor/copilot/*` em `bdos-core` é Studio-agnóstico —
   Intent Router, Clarifying Questions, Alternative Comparison não
   podem embutir uma regra específica de Project Studio ou Geo Studio.
   Se uma capacidade parecer precisar disso, o sinal correto é que ela
   deveria vir do `context` que o Studio já monta, não de uma
   ramificação por `studioId` dentro do Copilot.
5. **Todo turno assistant continua com trilha completa de auditoria.**
   A tensão levantada em §2 (Clarifying Questions vs. o `CHECK`
   existente) se resolve preenchendo os campos com uma forma
   degenerada válida, nunca relaxando a constraint para permitir um
   turno "sem rastro" — esse é o mesmo motivo pelo qual o `CHECK`
   existe na Fase 1.
6. **Simulação é sempre hipotética e descartável, nunca persistida como
   fato.** `simulateScheduleDelay` (§3.2) e o modo demo do Business
   Reality Simulator (§4) nunca escrevem em `decision_snapshots` nem em
   nenhuma tabela de negócio real — o resultado vive só dentro do
   `context_snapshot` congelado daquele turno específico.
7. **Nenhuma capacidade da Fase 2 aciona nada de verdade.** Reforço
   explícito do §5: até o Execution Engine existir, toda "ação" que o
   Copilot menciona é descrição de um dado que o Decision Engine já
   produziu (uma Recommendation, um ActionPlan) — nunca uma chamada
   que efetivamente muda algo no sistema.
8. **Determinístico primeiro — Claude só entra quando a tarefa exige
   linguagem natural livre.** Regra geral, não específica de
   Clarifying Questions: classificação de intent (§1), resolução de
   alvo (§1), listagem de candidatos (§2) e o gate de elegibilidade de
   comparação (§3) são todos resolvidos por código determinístico, sem
   chamada à API. O Claude só é acionado depois que essas decisões
   estruturais já foram tomadas — para redigir a resposta final, não
   para decidir a forma dela. Cada capacidade nova da Fase 2 (e de
   fases futuras) deve provar que uma tarefa *não* dá para resolver
   deterministicamente antes de justificar gastar uma chamada ao
   modelo nela — o ônus da prova é para usar Claude, não o contrário.

## O que isto prepara para depois

Com Intent Router, Clarifying Questions e Alternative Comparison
entregues (15.2A+15.2B, depois 15.2C), o Copilot deixa de ser um Q&A
de turno único e passa a conduzir uma conversa de verdade dentro dos
limites que a Fase 1 já auditava — sem gastar uma chamada ao Claude
para nenhuma das decisões estruturais no caminho. Business Reality
Simulator fica `parked`, fora do caminho de produção, até um pedido de
produto real. Workflow Handoff permanece formalmente bloqueado até o
Execution Engine — quando esse dia chegar, o Epic 15 ganha uma Fase 3
com seu próprio documento de desenho, seguindo a mesma disciplina
desde o início: schema e contrato primeiro, código depois.
