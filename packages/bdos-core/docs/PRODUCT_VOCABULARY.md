# Vocabulário de Produto — Epic 17

> Glossário canônico + matriz de exposição + governança, num documento
> só (não três) — a "matriz de exposição" é uma coluna a mais do mesmo
> glossário, não um artefato separado; separar os dois faria divergir
> com o tempo. Mesma disciplina de `PLATFORM_ARCHITECTURE.md`
> (mapa + governança juntos, §3 e §15 do mesmo arquivo).
>
> Ver `GOLDEN_JOURNEY_VOCABULARY_AUDIT.md` para a auditoria tela por
> tela que produziu este glossário, e `BDS_ARCHITECTURE_PRINCIPLES.md`,
> PRINCIPLE 007 ("Domain Language Containment"), para a regra
> arquitetural que este documento implementa.

## O modelo de três camadas

```
Domain Vocabulary  (código, banco, API, testes, logs, auditoria, docs técnicas)
        ↓  nunca traduzido automaticamente — é uma decisão de produto, termo a termo
Product Vocabulary  (o conceito, já em linguagem de negócio, estável entre telas)
        ↓  varia por contexto — o mesmo conceito de produto vira texto diferente
           dependendo do momento da jornada
User-Facing Copy  (a frase exata que aparece numa tela/mensagem específica)
```

**O Epic 17 nunca renomeia a Camada 1** (aggregates, tabelas, contratos
de API, nomes de função) — isso seria resolver o problema errado (ver
PRINCIPLE 007). O trabalho real é garantir que a Camada 1 nunca
vaze diretamente para a Camada 3, pulando a tradução da Camada 2.

## Camadas de exposição (legenda)

| Camada | Significado | Quem vê |
|---|---|---|
| **Internal only** | Nunca deve aparecer em nenhuma superfície visível — nem para admin, nem em erro, nem em log de auditoria exposto ao cliente | Só código/banco/logs de servidor |
| **Developer-visible** | Aparece em payload de API, DevTools, resposta HTTP crua — aceitável porque o consumidor é um desenvolvedor, não o usuário final | Engenheiros integrando com a API |
| **Admin-visible** | Aparece em telas administrativas internas (ex.: Advisor Lab, `/admin/advisor-lab`) — vocabulário técnico é aceitável e às vezes necessário ali, porque quem usa entende arquitetura | Time interno BBA |
| **Product language** | O termo já foi traduzido para linguagem de negócio, mas ainda pode variar de frase para frase — é o vocabulário-ponte, não a cópia final | — |
| **User-visible** | Aparece na jornada de ouro (`/bba-project` + Decision Copilot) ou em qualquer tela que um cliente real usa — precisa estar 100% em vocabulário de produto, nunca em termo interno | Empresário/gestor cliente da BBA |

## Glossário canônico

| Termo interno (Camada 1) | Definição técnica | Termo de produto (Camada 2) | Texto permitido (exemplo real) | Texto proibido (exemplo real encontrado) | Exposição correta |
|---|---|---|---|---|---|
| `Decision` (`domain/decision`) | Problema/oportunidade identificado pelo Decision Engine, com evidência anexada | Decisão / Ponto de atenção | "Encontrei um ponto que merece sua atenção" (`bba-project-insights.ts`) | "Decision aberta" | User-visible, já traduzido corretamente na jornada de ouro |
| `Recommendation` (`engines/decision/recommendation`) | Sugestão de ação para uma `Decision` | Recomendação | "Minha recomendação é..." | "Recommendation gerada" | User-visible, já correto — única exceção era a Linha de Raciocínio, corrigida no 17.0 |
| `RecommendationOption` | Uma alternativa dentro de uma `Recommendation` | Alternativa / Opção | "Alternativa: Regularizar geometria espacial" | "RecommendationOption" | User-visible (Alternative Comparison, 15.2C) — já correto |
| `Playbook` (`engines/decision/playbook`) | Modelo de passos (`PlaybookStep[]`) para executar uma `Recommendation` | *(sem equivalente na UI hoje — nunca exposto, nem indiretamente; é uma etapa intermediária invisível da cadeia)* | — | "Playbook" | **Internal only** |
| `ActionPlan` (`engines/decision/action-plan`) | Plano com `Action[]` sequenciadas, derivado de um `Playbook` | Plano de ação | *(não usado hoje na UI — só existe como etapa intermediária da materialização; se algum dia for exposto diretamente, este é o termo)* | "ActionPlan materializado" | Hoje **Internal only** na prática (nunca chega à UI sozinho, só via `ExecutionWorkflow`) |
| `Action` | Unidade dentro do `ActionPlan` | Ação | *(idem — intermediário, vira `ExecutionTask` antes de qualquer tela)* | "Action.sourceStepId" | Internal only na prática |
| `ExecutionWorkflow` (`domain/execution-management`) | Agrupamento de `ExecutionTask`s, materializado a partir de um `ActionPlan` | Plano de execução | "Criei um plano de execução ('X') com 2 tarefas" (`buildApprovalContent`, corrigido 17.0) | "workflow de execução" (era o texto até o 17.0) | User-visible |
| `ExecutionTask` | Unidade de apontamento de execução | Tarefa | "2 tarefas" | "ExecutionTask" | User-visible |
| `EvidenceReference` | Vínculo com uma `FieldEvidence`, nunca a evidência em si | Evidência | "Anexar evidência" | "EvidenceReference" | User-visible (ainda sem tela própria — Field Studio planejado) |
| `DecisionSnapshot` (`decision_snapshots`) | Cálculo do BDOS congelado num momento — decisions/recommendations de um import | Análise (do projeto) | "Analisei o planejamento importado" (`buildHeroNarrative`) | "Decision Snapshot criado" | User-visible, já correto na jornada de ouro |
| `EngineeringAdvisorPromptContext` / "Context Snapshot" | Contexto reduzido enviado ao Claude, congelado por turno para auditoria | *(nunca exposto — é campo de auditoria: `copilot_messages.context_snapshot`)* | — | "Context Snapshot" | **Internal only** / Developer-visible (via API crua, se algum dia expor) |
| `EngineeringAdvisorConfidence` | Cálculo de confiança do turno | Confiança | "🟢 Confiança alta" (`CONFIDENCE_LABEL`) | "Confidence Assessment" | User-visible, já correto |
| `EngineeringAdvisorHistoricalFacts` / "Engineering Advisor Memory" (Sprint 14.3) | Fatos históricos para narrar evolução (Health Score anterior, recorrência) | Histórico | "Health Score 78 → 62" | "Historical Memory" | User-visible só indiretamente (via narrativa), nome técnico nunca visto — já correto |
| "Decision Copilot" (nome do módulo `advisor/copilot`) | Nome interno do subsistema | **BBA Advisor** | "BBA Advisor" (todo lugar na UI) | "BBA Decision Copilot" | **Achado novo (17.1)**: o `SYSTEM_PROMPT` do Copilot (`copilot-turn-builder.ts:29`) instrui o Claude a se apresentar como "Você é o BBA Decision Copilot" — o único lugar onde esse nome ainda vaza, e é o mais perigoso, porque pode aparecer numa resposta gerada dinamicamente |
| "Engineering Advisor" (nome do módulo `advisor/*`) | Nome interno do subsistema | **BBA Advisor** | "BBA Advisor" | "Engineering Advisor" | Já correto na UI |
| `materializeExecutionWorkflowFromRecommendation` / "Materialization" | Ato de compor `Playbook → ActionPlan → ExecutionWorkflow` | *(verbo de produto: "criar um plano de execução")* | "Criei um plano de execução..." | "Materializado com sucesso" | **Internal only** — nome de função nunca deveria virar frase |
| "Workflow Handoff" (nome do Epic 16.7) | Mecanismo de aprovação estrutural | *(não é um substantivo de produto — é o botão "Aprovar" em si)* | "Aprovar" | "Workflow Handoff concluído" | **Internal only** |
| `classifyCopilotIntent` / "Intent Router" | Classificação determinística de intenção da mensagem | *(invisível por desenho — o usuário nunca deveria saber que existe)* | — | qualquer menção a "Intent Router" ou "intent" | **Internal only absoluto** |
| `unsupported_action` (1 dos 4 intents) | Pedido de ação que o Copilot ainda não executa | *(a recusa em si, nunca o nome do mecanismo)* | "Ainda não consigo executar essa ação por aqui" | "unsupported_action" | **Achado novo (17.1)**: `UNSUPPORTED_ACTION_MESSAGE` (`copilot-deterministic-turn-builder.ts:30`) contém `"(Decisions, Recommendations, planos de ação)"` — termos em inglês, capitalizados, dentro do parêntese — e `"o BDOS já calculou"` |
| `clarifying_question` (1 dos 4 intents) | Pergunta ambígua — Copilot pede esclarecimento | *(a lista numerada em si)* | "Encontrei mais de uma opção relacionada. Você quer analisar:" | "Clarifying Question" | Já correto |
| `approveRecommendationId` / `sourceDecisionSnapshotId` / `engineeringProjectId` | Campos do contrato de API (Epic 16.7) | *(nunca viram texto — são parâmetros de requisição, não conteúdo)* | — | qualquer um desses nomes em mensagem de erro | **Internal only** / Developer-visible (só em payload JSON cru) |
| "BDOS" (nome interno da arquitetura/plataforma) | Sigla interna de arquitetura | **BBA Advisor** (ou reformular a frase para não precisar nomear o sistema) | "O BBA Advisor analisou o planejamento..." | "o BDOS já calculou" | **Achado novo (17.1)**: vaza em 2 lugares reais — `UNSUPPORTED_ACTION_MESSAGE` (acima) e a legenda do mapa em `geospatial-map-view.tsx:59` ("computado pelo BDOS", tela de Geoespacial, fora da jornada de ouro primária mas ainda uma tela real de cliente) |
| `model = "copilot-rule-based-v1"` | Sentinela de auditoria (nunca um nome de modelo real) | *(nunca exposto — é valor de coluna de banco, para query de auditoria)* | — | qualquer menção | **Internal only** — já corretamente contido (confirmado por grep, 17.0) |
| `insightTitle` (`EngineeringAdvisorExplanation`) | Rótulo interno do insight, usado só na trilha de auditoria | *(nunca exposto)* | — | "Recommendation aprovada" (valor real do campo, nunca renderizado) | **Internal only** — já corretamente contido (confirmado por grep, 17.0) |
| "Health Score" | Termo de produto já parcialmente traduzido/estável | Health Score *(mantido — ver nota abaixo)* | "Health Score 78" (badge) | — | **Product language, decisão consciente, não um achado** |

### Nota sobre "Health Score"

Diferente dos demais itens acima, este não é um vazamento — é uma
decisão de nomenclatura de produto já tomada (mesmo termo usado por
Salesforce/HubSpot como nome de métrica, não como jargão de
arquitetura). Mantido como está; registrado aqui para não ser
reaberto por engano numa futura auditoria.

## Termos internos absolutos — nunca em nenhuma superfície visível ao cliente

Diferente do glossário acima (que mapeia termo → tradução), estes não
têm tradução — eles simplesmente não deveriam existir do ponto de
vista do usuário, sob nenhuma circunstância, em nenhuma exceção:

- `Materialization` / "materializar"
- `Workflow Handoff`
- `Intent Router` / "intent" / "classifyCopilotIntent"
- `Aggregate`
- `Repository`
- IDs técnicos crus (`approveRecommendationId`, `sourceDecisionSnapshotId`,
  `executionWorkflowId`, qualquer UUID sem rótulo humano ao lado)
- `Rule-based intent` / `model: "copilot-rule-based-v1"`
- `Frozen context` / `Context Snapshot`
- `Causal chain` / "PRINCIPLE 006" / "PRINCIPLE 007" (o nome do
  princípio é vocabulário de arquitetura — nunca aparece numa tela,
  mesmo que a ideia por trás dele seja exatamente o que protege o
  usuário)

## Governança — como um novo termo entra neste glossário

1. Antes de expor qualquer campo novo de `domain/*`/`engines/*`/`services/*`
   numa tela ou numa mensagem do Copilot, adicionar uma linha na tabela
   acima primeiro — termo interno, termo de produto, exposição correta.
2. Nenhum termo entra na coluna "User-visible" sem uma frase de exemplo
   real (não hipotética) — mesma disciplina que motivou a correção da
   tabela preliminar deste Epic (ver `GOLDEN_JOURNEY_VOCABULARY_AUDIT.md`,
   "Achados vs. hipóteses").
3. Se o mesmo conceito já tem um termo de produto estabelecido noutra
   tela, reaproveitar — nunca inventar um segundo nome para a mesma
   coisa (Risco 1 do desenho original do Epic 17: inconsistência entre
   telas).
4. Mudança em texto gerado pelo Claude (system prompts) exige revisão
   dupla: o texto do prompt em si **e** amostragem de respostas reais
   depois da mudança — um guard estático não cobre texto gerado por
   modelo (ver PRINCIPLE 007, exceção documentada).
5. Termos "Internal only absolutos" nunca ganham uma tradução — a
   decisão correta é reescrever a frase para não precisar nomear o
   mecanismo, não encontrar um sinônimo amigável para ele.
