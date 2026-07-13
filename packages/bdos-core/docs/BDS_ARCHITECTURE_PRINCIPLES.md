# BDS Architecture Principles

Princípios arquiteturais permanentes do Business Decision System (BDS)
da BBA Platform. A partir da UI Sprint M2, todo indicador exposto pela
plataforma deve ser projetado em conformidade com os princípios abaixo
— eles não são uma sugestão de estilo, são um requisito estrutural
permanente do projeto.

Esta é uma sprint **exclusivamente arquitetural**: nenhuma regra de
negócio, cálculo, integração, backend ou lógica foi implementada aqui.
Os princípios descrevem a estrutura que todo indicador deverá
satisfazer; os componentes de UI correspondentes
(`packages/ui/src/decision/`) e a primeira aplicação visual (mock, sem
dados reais) em `/workspaces/engenharia/planejamento` preparam o
terreno para quando cada Engine do BDS começar a alimentá-los com dados
reais.

---

## PRINCIPLE 001 — Full Traceability

Nenhum indicador poderá existir sem rastreabilidade.

Todo indicador — de qualquer Engine, em qualquer tela da plataforma —
deve possuir estrutura preparada para responder:

- **O que aconteceu?**
- **Onde aconteceu?**
- **Quando aconteceu?**
- **Por que aconteceu?**
- **Qual o impacto?**
- **Quais evidências suportam a conclusão?**
- **Qual ação recomendada?**

Um indicador que não consiga, em princípio, responder a essas sete
perguntas não está pronto para ser exposto na BBA Platform — mesmo que,
hoje, a resposta disponível seja apenas um placeholder ("Aguardando
dados do Planning Engine.").

## PRINCIPLE 002 — Mandatory Drill-down

Todo indicador deverá permitir navegação do Dashboard Executivo até sua
origem, seguindo o fluxo padrão:

```
Dashboard Executivo
      ↓
Engine responsável
      ↓
Projeto
      ↓
Macroetapa
      ↓
Frente
      ↓
Serviço
      ↓
Atividade
      ↓
Documento
      ↓
Foto
      ↓
Latitude
      ↓
Drone
      ↓
Diário
      ↓
Memória
```

Este fluxo é a espinha dorsal de navegação da plataforma: um usuário
parte de um número agregado no Dashboard Executivo e, sem sair do
produto, consegue descer até a evidência de campo específica (uma
foto, uma coordenada, um diário de obra) que sustenta aquele número.

## PRINCIPLE 003 — Progressive Disclosure

A interface deve apresentar primeiro o resumo executivo e revelar
detalhes progressivamente apenas quando o usuário solicitar.

Fluxo padrão:

```
Indicador
    ↓
Insight
    ↓
Análise
    ↓
Causa
    ↓
Impacto
    ↓
Atividade
    ↓
Evidência
    ↓
Documento
```

Nenhum painel de decisão deve nascer expandido: o estado inicial é
sempre um resumo (status + um insight de uma linha); o detalhamento
completo (PRINCIPLE 001) só aparece quando o próprio usuário pede,
dentro do mesmo painel — nunca via modal, drawer ou nova página. Este
princípio substitui a expectativa da UI Sprint M2.1 de que a análise
ficaria sempre totalmente visível; a partir da M2.2, "sempre visível
por padrão" torna-se "sempre disponível sob demanda, em um clique,
sem sair do lugar".

## PRINCIPLE 004 — Spatial Intelligence

Todo dado do BDS poderá possuir uma dimensão espacial. Essa dimensão
nunca deve ser tratada como mera localização (um metadado decorativo
de exibição em mapa) — deve ser uma dimensão de primeira classe,
usada para tomada de decisão, rastreabilidade, auditoria, correlação
entre Engines, visualização e IA (BBA Advisor).

**Por que este princípio existe — evidência concreta, não hipotética.**
O código já contém duas referências espaciais criadas de forma
independente, sem nenhum modelo compartilhado: `ProjectLocation`
(`domain/project-management`, com `latitude`/`longitude` soltos no
próprio `Project`) e `MeasurementCoordinate`
(`domain/measurement`, com `latitude`/`longitude`/`elevation` por
medição, além de um `MeasurementGeometry` não-geográfico separado).
Nenhum dos dois se relaciona com o outro. Isso é exatamente o
sintoma que este princípio existe para prevenir: cada Engine
inventando seu próprio campo de localização, sem identidade
compartilhada nem possibilidade de correlação. PRINCIPLE 004 não
propõe substituir essas referências agora — propõe que nenhuma nova
referência espacial seja criada fora de um modelo compartilhado a
partir deste ponto, e que a consolidação das existentes seja uma
decisão explícita de sprint futura, nunca um efeito colateral.

**Reconciliação com conceitos já existentes (importante).** A
documentação de produto do Geospatial Engine usa a metáfora "Digital
Twin Operacional" para descrever uma representação espaço-temporal
viva da obra. Isso é uma metáfora de produto, não o mesmo conceito
que `domain/digital-twin` já implementa no código: hoje,
`digital-twin` é um dataset estático de demonstração de um único
tenant fictício ("Alpha Engenharia"), sem nenhuma dimensão espacial.
Os dois nomes coincidem por acidente de linguagem, não por
identidade de conceito — qualquer implementação futura do modelo
espacial deve usar um nome de módulo distinto (ex.:
`domain/spatial-object`), nunca estender ou renomear
`domain/digital-twin` sem uma decisão arquitetural própria. Da mesma
forma, "Spatial Confidence" (a confiabilidade de um dado espacial)
não deve criar uma escala paralela de confiança: deve compor com o
`EvidenceConfidence` já implementado e testado em
`domain/field-evidence/evidence-confidence.ts` (níveis
Low/Medium/High/Verified, pontuação determinística) — um novo fator
espacial se soma aos fatores já existentes, não substitui a escala.
Por fim, a rastreabilidade "onde/por quê/qual evidência" que a
documentação de produto chama de "Decision Graph" já existe, em
código, como a cadeia `Decision` → `DecisionCase` (máquina de estados
`Created → Observed → Diagnosed → ... → Archived`) →
`Recommendation.traceability` (`decisionId`, `diagnosisId`,
`evidenceReferences[]`, `businessFactIds[]`). Um objeto espacial deve
se tornar referenciável a partir dessa cadeia já existente — não
deve nascer como uma estrutura de grafo paralela.

Toda futura implementação deste princípio (o modelo de Spatial
Object completo, com identidade, hierarquia, relações, camadas,
ciclo de vida e confiança) está descrita em
`packages/bdos-core/docs/GEOSPATIAL_ENGINE.md`.

## PRINCIPLE 005 — No Isolated Activity

Nenhuma informação de cronograma pode existir isolada.

Toda atividade de um cronograma — de onde quer que venha (importação,
criação manual, integração futura) — deve nascer já conectada a:

- um **SpatialObject** (mesmo que ainda `Conceived`, sem geometria de
  campo);
- um **Decision Context** (capaz de gerar `BusinessFact` → `Diagnosis`
  → `Decision`, através da mesma cadeia do Decision Engine, nunca uma
  paralela);
- uma **fonte de evidência** (mesmo que inicialmente vazia — "nenhuma
  evidência anexada ainda" é uma resposta válida, uma atividade sem
  fonte de evidência associada não é);
- uma **rastreabilidade** (PRINCIPLE 001 — as sete perguntas);
- uma **capacidade de receber recomendações** (via
  `engines/decision/recommendation`, nunca um motor de sugestão
  próprio).

Isso impede que o cronograma se torne apenas uma lista de barras e
datas. Cada atividade é um objeto vivo do BDS desde o instante em que
é criada — não um registro passivo que só passa a "significar algo"
depois de uma integração futura.

**Por que este princípio existe.** A oportunidade estratégica do BBA
Project (ver `docs/BBA_PROJECT.md`) só existe se todo cronograma
importado herdar, automaticamente, o mesmo diferencial que o
Geospatial Engine já provou: confiança, rastreabilidade e recomendação
reais, não inventadas. Um cronograma que apenas "parece" com o
Microsoft Project — barras, datas, percentual — sem estar conectado a
essa cadeia seria um retrocesso, não um produto novo.

**Reconciliação com PRINCIPLE 004.** Uma atividade não cria seu próprio
`SpatialObject` do zero: ela nasce vinculada a um `WorkPackage`
(`domain/work-package-management`), e é o adaptador já existente
(`domain/spatial-object/adapters/work-package-management`, Sprint 12)
quem produz o `SpatialObject` correspondente — exatamente como já
acontece para o Geospatial Engine hoje. `domain/schedule-management`
(a implementação deste princípio) reaproveita essa cadeia inteira; não
duplica a criação de `SpatialObject`, `BusinessFact`, `Decision` ou
`Recommendation`.

Toda implementação deste princípio (o modelo de `ScheduleActivity`,
dependências, caminho crítico, linha de base, curva S e o Importador
de cronogramas) está descrita em `packages/bdos-core/docs/BBA_PROJECT.md`.

## PRINCIPLE 006 — No Isolated Task

Nenhuma `ExecutionTask` pode existir sem uma cadeia causal auditável
completa:

```
Decision → Recommendation → Playbook → ActionPlan → Action → ExecutionTask → EvidenceReference[]
```

Uma `ExecutionTask` sem uma `Action` de origem não é uma versão mais
simples do modelo — é um modelo diferente (tarefa operacional livre),
que não pertence a este agregado. Se um dia esse segundo modelo for
necessário, ele nasce como um domínio novo, num Epic novo — nunca como
uma ramificação condicional dentro do Execution Engine.

**Por que este princípio existe.** `engines/decision/action-plan` já
produz `ActionPlan`/`Action` em produção, mas `ActionPlanStatus` só
tem o valor `"created"` — a cadeia de rastreabilidade que o BDOS já
mantém ponta a ponta (`Decision` → `Recommendation` → `Playbook` →
`ActionPlan` → `Action`) simplesmente para antes de chegar à execução
real. Sem esta regra, o Execution Engine (Epic 16) poderia nascer como
um gerenciador de tarefas genérico — qualquer tarefa, criada por
qualquer pessoa, sem justificativa auditável — o que romperia
exatamente a cadeia que PRINCIPLE 001 (Full Traceability) já exige
para todo indicador da plataforma. Este princípio estende essa mesma
exigência até a execução em campo, mesma disciplina de PRINCIPLE 005
("No Isolated Activity") aplicada um nível adiante.

**Reconciliação com PRINCIPLE 005.** PRINCIPLE 005 garante que nenhuma
`ScheduleActivity` exista isolada do Decision Context. PRINCIPLE 006
garante o mesmo um passo à frente na cadeia: nenhuma `ExecutionTask`
existe isolada de uma `Action` já aprovada. Uma `ExecutionTask` pode
referenciar, opcionalmente, uma `ScheduleActivity` — nunca a altera; a
propriedade de `ScheduleActivity`/`PlanningDataset` continua
exclusivamente do Project Studio.

**Fronteiras adicionais que a implementação deste princípio deve
respeitar** (detalhadas em `packages/bdos-core/docs/EXECUTION_ENGINE.md`):
o Decision Engine nunca encerra uma `ExecutionTask` — encerramento
("concluído operacional") é prerrogativa exclusiva do Execution
Engine; o efeito medido depois pelo Decision Engine é um conceito
separado (`ImpactConfirmed`), nunca uma condição de fechamento;
evidência nunca é armazenada pelo Execution Engine, só referenciada
(`EvidenceReference[]` apontando para o Studio de Evidências, mesmo
padrão que `Decision.evidence`/`Recommendation.traceability.
evidenceReferences` já usam).

Toda implementação deste princípio (o modelo de `ExecutionWorkflow`/
`ExecutionTask`, fronteiras com Project Studio, Decision Engine e o
Decision Copilot, e o faseamento do Epic 16) está descrita em
`packages/bdos-core/docs/EXECUTION_ENGINE.md`.

---

## PRINCIPLE 007 — Domain Language Containment

O vocabulário arquitetural do BDOS deve permanecer contido nas
camadas de domínio, aplicação, persistência, integração, auditoria e
documentação técnica.

Toda superfície destinada ao usuário deve utilizar vocabulário de
produto canônico, contextualizado para a jornada e adequado ao nível
de conhecimento do usuário.

Nenhum termo interno deve alcançar a interface sem uma decisão
explícita de produto.

**Diferente dos PRINCIPLES 001-006, este não é uma regra sobre como o
domínio deve ser modelado — é uma regra sobre a fronteira entre o
domínio e a apresentação.** Mesmo assim, pertence à mesma família: os
seis princípios anteriores garantem que nada existe isolado de sua
proveniência causal; este garante que a proveniência causal nunca
vaza para quem não deveria precisar entendê-la para confiar no
resultado.

**Por que este princípio existe.** O levantamento do Epic 17
(`packages/bdos-core/docs/GOLDEN_JOURNEY_VOCABULARY_AUDIT.md`)
encontrou nomes internos de arquitetura (`Business Facts`,
`Diagnosis`, `Decision`, `Recommendation`, "BDOS", "workflow de
execução") aparecendo, sem tradução, em superfícies reais de produto —
mesmo com a arquitetura tecnicamente correta por trás. O risco não é
hipotético: é o motivo pelo qual o Epic 17 foi aberto.

**O modelo de três camadas** (Domain Vocabulary → Product Vocabulary →
User-Facing Copy) e o glossário canônico completo — termo a termo,
com exposição classificada em Internal only / Developer-visible /
Admin-visible / Product language / User-visible — vivem em
`packages/bdos-core/docs/PRODUCT_VOCABULARY.md`. Este princípio nunca
duplica esse conteúdo; só fixa a regra que o motiva.

**O que este princípio explicitamente não faz** — não renomeia
aggregates, tabelas, contratos de API ou nomes de função. Traduzir o
código para "parecer amigável" ataca o sintoma errado: o problema
nunca esteve no nome interno (`ExecutionWorkflow` é um nome correto e
preciso *dentro* do domínio), esteve no vazamento desse nome para
fora dele. Renomear a Camada 1 para consertar a Camada 3 destruiria
precisão técnica sem resolver o vazamento em nenhum outro lugar onde
o mesmo termo apareça.

**Limite conhecido do enforcement — texto gerado por LLM.** Um guard
estático (scanner textual, mesmo padrão de
`engineering-boundaries.test.ts`) consegue garantir, com certeza, que
nenhum termo da lista de proibidos apareça em código de apresentação
estático — componentes React, mensagens de erro, turnos
determinísticos do Copilot. Ele **não pode** garantir o mesmo para o
texto que o Claude gera livremente (intents `answer`/`compare` do
Decision Copilot) — ali, a proteção é o `SYSTEM_PROMPT` (revisão
explícita da instrução "sem jargão técnico") mais amostragem de
respostas reais, nunca um teste que trava o build. Este princípio não
promete uma garantia que o mecanismo de verificação não sustenta —
mesma disciplina de honestidade já aplicada em toda documentação do
BDOS (nunca afirmar mais do que o código garante).

---

## PRINCIPLE 008 — Human-First Visual Decision UX

O BDOS é desenvolvido para pessoas que administram negócios — MEIs,
PMEs, gestores, responsáveis financeiros, engenheiros e profissionais
administrativos — não para pessoas que conhecem sua arquitetura
interna. Toda interface que apresenta análise, recomendação ou
decisão deve transformar complexidade técnica em compreensão visual,
objetiva e acionável, respondendo rapidamente:

- **O que está acontecendo?**
- **Isso exige atenção?**
- **O que devo fazer?**
- **Onde está o problema, o contexto ou a origem relevante?**

Compreensão vem antes do detalhe: o resumo (status, prioridade, ação
principal) precisa ser legível sem leitura longa. Na experiência
executiva principal, o detalhamento técnico — explicação completa,
origem documental e rastreabilidade — fica subordinado e disponível
sob demanda (PRINCIPLE 003), sem competir em peso visual com a
conclusão.

**Guardrail central, não observação secundária:** todo apoio visual
deve representar um dado, estado, relação ou decisão real já
fornecida pelo sistema. A UI pode apresentar e organizar; nunca pode
calcular, completar, inferir ou fabricar significado para preencher
espaço. O visual reorganiza e apresenta o que o BDOS já decidiu;
nunca decide nem completa lacunas por conta própria. Regra resumida:
**o BDOS decide, explica com linguagem humana e mostra visualmente o
que importa** — nunca o inverso. A lista de exemplos proibidos vive
em `packages/bdos-core/docs/HUMAN_FIRST_VISUAL_UX.md`, não aqui.

Mobile não é uma versão reduzida posterior: é condição de aceitação.
A hierarquia decisória (o que está acontecendo, o que fazer) precisa
permanecer compreensível em tela pequena, mesmo quando a disposição
visual muda.

**Por que este princípio existe — evidência concreta, não
hipotética.** A correção do Sprint 20.1E.6 (Epic 20, Relatório
Executivo de Medições) é o caso real que o motiva: uma implementação
tecnicamente correta (projeção fiel de `criticalItems`/`nextActions`/
`evidenceReferences`, sem nenhum dado inventado) consolidava a origem
documental numa seção final separada, organizada pela estrutura do
contrato (`sourceType`/`sourceId`/`locator`) em vez de pela leitura
humana — repetindo Ações Recomendadas e Itens Críticos e aumentando a
carga cognitiva sem agregar entendimento. A correção não mudou
nenhuma regra de negócio: moveu a origem para dentro do contexto que
ela sustenta e trocou vocabulário de contrato por vocabulário humano
("O que foi encontrado", "Ao corrigir"). É o mesmo tipo de lacuna que
motivou PRINCIPLE 007 — ali, a palavra vazava; aqui, é a estrutura do
contrato que vazava para a experiência.

**Reconciliação com PRINCIPLE 003 (Progressive Disclosure).**
PRINCIPLE 003 já exige que o detalhe apareça só sob demanda. PRINCIPLE
008 vai um passo além: mesmo o resumo ainda recolhido precisa ter
peso visual (status, prioridade, ação), não só uma frase de texto
corrido esperando expansão. 003 rege *quando* o detalhe aparece; 008
rege *como* mesmo o que não foi expandido precisa ser legível em
poucos segundos.

**Reconciliação com PRINCIPLE 007 (Domain Language Containment).**
007 rege escolha de palavra; 008 rege estrutura de apresentação. Uma
tela pode usar vocabulário humano correto e ainda falhar em 008 se
for uma parede de texto — foi exatamente o caso do 20.1E.6 antes da
correção.

**Limite conhecido do enforcement.** Diferente de PRINCIPLE 007 (que
tem guard estático real), este princípio não é verificável por
scanner de texto — é hierarquia visual, não vocabulário proibido.
Guards automatizados podem confirmar aspectos estruturais (ausência
de termo proibido, componente recolhido por padrão, ausência de
cálculo no frontend, acessibilidade básica), mas não podem garantir
honestamente entendimento em cinco segundos, equilíbrio entre texto e
visual, ou adequação ao público MEI/PME — isso depende de revisão de
produto e validação visual com dados reais, a cada Sprint. O
detalhamento operacional (as quatro camadas, regras anti-ERP, padrões
comprovados e o checklist de revisão) vive em
`packages/bdos-core/docs/HUMAN_FIRST_VISUAL_UX.md`. Este princípio
nunca duplica esse conteúdo; só fixa a regra que o motiva.

---

## Estado de implementação (UI Sprint 7 — Geospatial Engine MVP)

- ✅ Princípios documentados (este arquivo), incluindo PRINCIPLE 004.
- ✅ Componente com estado — `DecisionInsightCard` — implementando
  Progressive Disclosure (collapsed/expanded, depois accordion) em
  `packages/ui/src/decision/`. É o único componente do módulo com
  `useState`; `DecisionSection` e `DecisionPlaceholder` seguem sem
  lógica, sem estado, sem integração.
- ✅ Aplicação mock em `/workspaces/engenharia/planejamento` e em
  `/workspaces/engenharia/geoespacial`: painel "BBA Advisor",
  nascendo recolhido, com as 6 seções do PRINCIPLE 001 como
  accordion — todos os campos como placeholder.
- ✅ Tela Geoespacial (UI Sprint 7): mapa placeholder, checklist de
  camadas, linha do tempo e KPIs — 100% mock, sem nenhum modelo de
  domínio por trás ainda.
- ⏳ PRINCIPLE 004 ainda não tem nenhuma implementação em
  `packages/bdos-core/src` — nenhum `SpatialObject`, nenhuma camada
  espacial, nenhuma correlação real. `ProjectLocation` e
  `MeasurementCoordinate` continuam sendo referências espaciais
  isoladas, não consolidadas (ver nota de reconciliação acima).
- ⏳ Nenhum Engine ainda alimenta os painéis com dados reais e nenhuma
  navegação de drill-down (Principle 002) foi implementada — isso é
  trabalho de sprints futuras, uma por Engine.

## Engines que deverão adotar estes princípios

Planning Engine, Execution Engine, Finance Engine, Measurement Engine,
Evidence Engine, Geospatial Engine, Approval Engine, Dashboard
Executivo e BBA Advisor.
