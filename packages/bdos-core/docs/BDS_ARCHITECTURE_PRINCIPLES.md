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
