# Auditoria de Vocabulário da Jornada de Ouro — Epic 17.1

> Produz o glossário em `PRODUCT_VOCABULARY.md` — este documento é o
> "como chegamos lá", auditoria tela por tela, não o glossário em si.
> Escopo: a jornada de ouro definida no Epic 17
> (`/bba-project` + Decision Copilot), mais qualquer superfície que a
> jornada toca indiretamente (mensagens de erro, system prompts do
> Claude). Fora de escopo: redesign de UX, novas telas, mudança de
> regra de negócio — nenhuma linha de código de domínio muda por causa
> deste documento.

## Método

Cada etapa da jornada é auditada em **6 dimensões** (as 5 originais do
desenho do Epic + a extensão de modelo mental, proposta na revisão do
CPO):

1. **O que o usuário vê** — o texto/elemento literal na tela.
2. **O que o usuário entende** — a leitura razoável desse texto, sem
   conhecimento de arquitetura.
3. **O que o usuário acredita que vai acontecer** — antes de agir.
4. **Qual ação ele deve tomar**.
5. **O que o sistema confirma depois** — o texto pós-ação.
6. **Consistência de modelo mental** (nova) — a confirmação (5) é a
   continuação natural do que a ação (4) prometia, ou introduz um
   conceito/palavra que o usuário não pediu? Isso é verificado mesmo
   quando nenhum termo técnico aparece — é possível vazar modelo
   mental com vocabulário 100% traduzido (ver Achado 6 abaixo).

Achados são classificados como **Resolvido** (já corrigido no 17.0),
**Achado novo (17.1)** (encontrado nesta auditoria, ainda não
corrigido) ou **Adjacente** (não é vocabulário, mas apareceu durante a
auditoria e compromete a mesma jornada — registrado para não se
perder, tratamento fica para quem decidir o escopo do 17.2).

---

## Etapa 1 — Usuário importa ou acessa um projeto

**Tela**: `BbaProjectWorkspaceExperience`, estado `entryChoice = "pending"` → `phase = "idle"`.

| Dimensão | Conteúdo |
|---|---|
| Vê | "Como deseja começar?" com duas opções: "Ver demonstração" / "Importar meu planejamento" |
| Entende | Duas portas de entrada claras, sem jargão |
| Acredita | Que escolher "Importar" leva a um lugar para enviar um arquivo |
| Ação | Clicar numa das duas opções |
| Confirma depois | Tela seguinte pede o arquivo (.xml/.xlsx), com legenda explicando o que é aceito |
| Modelo mental | Consistente — nenhuma promessa não cumprida |

**Achados**: nenhum. Este trecho já está limpo (confirmado na
auditoria original que gerou o 17.0).

---

## Etapa 2 — BDOS analisa o contexto

**Tela**: `phase = "processing"`, `PROCESSING_STEPS`.

| Dimensão | Conteúdo |
|---|---|
| Vê | "Lendo arquivo...", "Identificando estrutura de planejamento...", "Conectando ao mapa...", "Avaliando confiança espacial...", "Gerando recomendações..." |
| Entende | Uma sequência de passos claros, em português, sem termo técnico |
| Acredita | Que o sistema está processando de verdade (e está — `STEP_DURATION_MS` é só o piso visual mínimo, o cálculo real já terminou) |
| Ação | Nenhuma — esperar |
| Confirma depois | Tela de resultado (Hero + análise) |
| Modelo mental | Consistente |

**Achados**: nenhum.

---

## Etapa 3 — BDOS apresenta riscos, oportunidades e recomendações

**Telas**: `BbaProjectHero`, `BbaProjectExecutiveCards`, `BbaProjectRiskList`.

| Dimensão | Conteúdo |
|---|---|
| Vê | Saudação + narrativa do Hero ("Analisei o planejamento importado. Encontrei N atividades..."), 6 cards executivos (Prazo/Atividades/Em risco/Curva S/Executado/Confiança), lista de atividades em risco |
| Entende | Um resumo executivo em linguagem natural, seguido de números de apoio |
| Acredita | Que o sistema já analisou tudo e estas são as conclusões reais |
| Ação | Ler, opcionalmente clicar numa atividade em risco ou "Ver análise completa" |
| Confirma depois | Rola para o bloco do Advisor (Etapa 4) |
| Modelo mental | Consistente |

**Achados**: nenhum. Vocabulário já bem traduzido
(`computeHealthScore`, `buildHeroNarrative` — auditados linha a linha,
nenhum termo interno encontrado).

---

## Etapa 4 — Usuário entende a justificativa

**Telas**: `BbaProjectAdvisorNarrative` (+ `ExplainabilityDrawer`), `BbaProjectReasoningChain`.

| Dimensão | Conteúdo |
|---|---|
| Vê | Situação/Motivo/Impacto/Recomendação em texto corrido; botão "Por que estou vendo este alerta?" abre um painel com Dados utilizados/Regras aplicadas/Evidências/Decisão/Recomendação; mais abaixo, "Como cheguei nesta conclusão?" mostra a Linha de Raciocínio |
| Entende | Uma explicação em camadas — resumo primeiro, detalhe técnico só sob demanda (Progressive Disclosure, PRINCIPLE 003) |
| Acredita | Que pode auditar a conclusão do sistema a qualquer momento |
| Ação | Ler, opcionalmente abrir o painel de explicabilidade |
| Confirma depois | — (é uma tela de leitura, não uma ação transacional) |
| Modelo mental | Consistente |

**Achados**:
- **Resolvido (17.0)** — Linha de Raciocínio misturava `Planejamento →
  Objeto Espacial` (traduzido) com `Business Facts → Diagnosis →
  Decision → Recommendation` (inglês, termos internos). Corrigido para
  `Confiança Espacial → Diagnóstico → Decisão → Recomendação`,
  reaproveitando vocabulário já usado no resto da tela.

---

## Etapa 5 — Usuário conversa com o Copilot

**Tela**: `DecisionCopilotChat` (card "BBA Advisor" dentro de `/bba-project`).

| Dimensão | Conteúdo |
|---|---|
| Vê | Campo de texto + botão "Enviar"; respostas do Advisor com badge de confiança e "Como cheguei nisso?" |
| Entende | Uma conversa normal, sem indicação de que existe um Intent Router por trás classificando a pergunta |
| Acredita | Que está conversando com "o BBA Advisor", uma identidade única e consistente com o resto do produto |
| Ação | Digitar e enviar uma pergunta |
| Confirma depois | Resposta com citação de dado real, ou pedido de esclarecimento, ou recusa educada |
| Modelo mental | **Inconsistente num caso** — ver Achado abaixo |

**Achados**:
- **Achado novo (17.1) — o mais sensível encontrado nesta auditoria.**
  `SYSTEM_PROMPT` do Copilot (`copilot-turn-builder.ts:29`) começa com
  `"Você é o BBA Decision Copilot..."` — instrui o próprio Claude a se
  apresentar com um nome diferente do que a UI usa em todo lugar
  ("BBA Advisor"). Isso quebra a identidade única e consistente que
  `DecisionInsightCard.tsx` documenta como regra explícita ("BBA
  Advisor" é a identidade que fala, "nunca deve drift entre
  consumidores"). Risco real: se o Claude algum dia se referir a si
  mesmo na resposta (ex.: "como Decision Copilot, recomendo..."), o
  nome errado aparece direto na tela.
- **Achado novo (17.1)** — o mesmo `SYSTEM_PROMPT` **não tem** a
  instrução "sem jargão técnico" que `claude-narrator.ts` (o narrador
  do Advisor, mesma família) já tem explicitamente na linha 51. O
  prompt do Copilot só diz "tom direto e executivo" (linha 50),
  omitindo a cláusula que existe no prompt irmão. Isso é uma
  divergência de disciplina entre dois prompts que deveriam ser
  irmãos, não um vazamento confirmado — mas é o tipo de lacuna que um
  guard estático (Etapa 5a do desenho do Epic) nunca vai pegar,
  porque o texto de saída é gerado, não fixo.
- **Achado novo (17.1)** — `UNSUPPORTED_ACTION_MESSAGE`
  (`copilot-deterministic-turn-builder.ts:30`, dispara quando o
  usuário digita algo como "aprove isso" em texto livre) contém:
  `"só interpreto o que o BDOS já calculou (Decisions, Recommendations,
  planos de ação)"`. Dois problemas na mesma frase: "BDOS" (sigla
  interna de arquitetura, nunca usada como nome de marca em nenhum
  outro lugar da UI) e "(Decisions, Recommendations...)" em inglês,
  capitalizado, dentro do parêntese — o único lugar do Copilot
  determinístico (turnos que nunca chamam o Claude) onde um termo
  interno em inglês ainda aparece cru.

---

## Etapa 6 — Usuário aprova uma recomendação

**Tela**: botão "Aprovar" (`DecisionCopilotChat`, Epic 16.7/16.8).

| Dimensão | Conteúdo |
|---|---|
| Vê | Botão "Aprovar" ao lado do título de uma recomendação citada pelo Advisor |
| Entende | Que aprovar essa recomendação específica vai gerar alguma consequência real |
| Acredita | Que a recomendação vira ação concreta, rastreável |
| Ação | Clicar "Aprovar" |
| Confirma depois | "Aprovado. Criei um plano de execução ('X') com N tarefa(s) a partir desta recomendação." |
| Modelo mental | **Consistente após o 17.0** |

**Achados**:
- **Resolvido (17.0)** — a confirmação dizia "Criei um **workflow** de
  execução...". Corrigido para "plano de execução", batendo com o
  mapeamento `ExecutionWorkflow → Plano de execução` do glossário.
  Verificação de modelo mental aplicada explicitamente: "Aprovar"
  promete uma ação de negócio; "criei um plano com tarefas" é
  exatamente a continuação esperada, sem introduzir vocabulário novo.

---

## Etapa 7 — BDOS cria um plano de ação

Esta etapa é **inteiramente invisível por desenho** — `Playbook` e
`ActionPlan` nunca chegam a uma tela (ver `PRODUCT_VOCABULARY.md`,
onde os dois estão marcados "Internal only na prática"). O que o
usuário vê como resultado desta etapa é a confirmação da Etapa 6
("Criei um plano de execução..."). Não há achado aqui — é o
comportamento correto: a materialização (`buildPlaybooks →
buildActionPlans → createExecutionWorkflowFromActionPlan`, Epic
16.6A/B/C) é uma composição técnica que não precisa — e não deveria —
ter uma tela própria.

---

## Etapa 8 — Ações e tarefas são disponibilizadas para execução

**Estado real da plataforma**: não existe tela de Field Studio ainda
(`PLATFORM_ARCHITECTURE.md` §3, confirmado no fechamento do Epic 16 —
"Engine em produção, Studio planejado"). O único ponto onde
`ExecutionTask` aparece hoje é a contagem na confirmação da Etapa 6
("com 2 tarefas") e a API JSON crua (`GET /api/execution/tasks`,
Developer-visible, nunca renderizada para um cliente).

**Achado — não é vocabulário, é lacuna de jornada**: as etapas 8-10
do desenho original do Epic 17 (disponibilizar, acompanhar, vincular
evidência) **não têm superfície de usuário para auditar hoje**. Isso
não é um problema deste Epic — é uma confirmação de que o vocabulário
já está contido corretamente por ausência de UI (não há onde vazar).
Registrado aqui para o dia em que o Field Studio for construído: a
auditoria deste Epic deveria ser revisitada nesse momento, não
esquecida.

---

## Etapa 9 — Usuário acompanha o progresso

Mesma observação da Etapa 8 — sem UI, sem achado, revisitar quando
Field Studio existir.

## Etapa 10 — Evidências são vinculadas à execução

Mesma observação. `EvidenceReference` já está mapeado no glossário
para quando a tela existir.

---

## Achados adjacentes (não são vocabulário, mas comprometem a mesma jornada)

Encontrados ao ler o código das etapas acima com atenção — registrados
para não se perderem, tratamento fica para uma decisão de escopo do
17.2, não deste documento:

- **Achado 5 (adjacente) — mensagem de erro de import não reflete a
  causa real.** `runImport` (`bba-project-workspace-experience.tsx`)
  mostra a mesma mensagem fixa para **qualquer** falha de
  `/api/bba-project/import` — inclusive `unauthenticated` (sessão
  expirada) — como se fosse sempre "arquivo não reconhecido". Um
  usuário com sessão expirada veria "verifique se é uma exportação XML
  do Microsoft Project..." — uma explicação que não tem relação com o
  problema real. Não é vazamento de termo técnico (o oposto: é
  **omissão** de informação relevante) — é a mesma classe de risco que
  o Risco 4 do desenho original do Epic descreve ("mensagens de erro
  fazem parte da Jornada de Ouro"), só que pelo lado inverso.
- **Achado 6 (adjacente, exemplo direto de modelo mental sem nenhum
  termo técnico envolvido)** — `handleSimulateDelay`
  (`bba-project-workspace-experience.tsx`) não trata `!response.ok` —
  se `/api/bba-project/simulate-delay` falhar, o código tenta ler
  `result.criticalPath.projectDurationDays` de um corpo de erro, que
  não tem esse campo — exceção não tratada, nenhuma mensagem chega ao
  usuário. O botão "Simular atraso de 3 dias" simplesmente não faz
  nada visível. É a forma mais extrema de inconsistência de modelo
  mental: o usuário não recebe nenhuma confirmação, nem positiva nem
  negativa.
- **Achado 7 (adjacente, fora da jornada de ouro primária)** —
  `geospatial-map-view.tsx:59`: "...cada pino acima já representa um
  objeto espacial real, computado pelo BDOS." — mesmo vazamento de
  "BDOS" do Achado do Copilot, mas na tela de Geoespacial (produção,
  porém secundária à jornada `/bba-project`). Prioridade menor, mesmo
  tratamento recomendado.

## Achados vs. hipóteses — por que este documento diverge da tabela preliminar do desenho original

A tabela preliminar do Epic 17 (proposta antes desta auditoria)
classificava vários termos como risco "Médio" ou "Alto" por
proximidade conceitual com o domínio, não por confirmação em código.
Esta auditoria confirma que vários já estavam corretamente contidos
antes mesmo deste Epic existir — "Decision Copilot" nunca aparece
como texto renderizado (só na branding correta "BBA Advisor"),
`model: "copilot-rule-based-v1"` e `insightTitle` nunca são lidos por
nenhum componente (confirmado por grep). Isso não invalida o método
da tabela preliminar — confirma que o método certo é auditar o código
real antes de decidir prioridade, exatamente como a correção aplicada
na revisão deste Epic já recomendava.

## Resumo de status

| # | Achado | Status |
|---|---|---|
| 1 | Linha de Raciocínio (Business Facts/Diagnosis/Decision/Recommendation) | Resolvido (17.0) |
| 2 | "Living Schedule" | Resolvido (17.0) |
| 3 | "workflow de execução" na confirmação de aprovação | Resolvido (17.0) |
| 4a | `SYSTEM_PROMPT` do Copilot se apresenta como "BBA Decision Copilot" | Achado novo (17.1) |
| 4b | `SYSTEM_PROMPT` do Copilot sem a cláusula "sem jargão técnico" | Achado novo (17.1) |
| 4c | `UNSUPPORTED_ACTION_MESSAGE` — "BDOS" + "(Decisions, Recommendations...)" | Achado novo (17.1) |
| 5 | Mensagem de erro de import não reflete a causa real | Adjacente |
| 6 | `handleSimulateDelay` sem tratamento de erro | Adjacente |
| 7 | "computado pelo BDOS" no mapa de Geoespacial | Achado novo (17.1), prioridade menor |
