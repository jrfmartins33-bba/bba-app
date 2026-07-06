# BBA Project — O primeiro planejador de projetos orientado por decisões

## Contexto estratégico

O mercado de planejamento de obras já está resolvido do ponto de vista
de *registro*: Microsoft Project e Primavera P6 fazem cronograma; Oracle
Aconex faz documentos; Autodesk Construction Cloud faz colaboração;
Bentley SYNCHRO faz 4D. Nenhum deles foi concebido para **tomar
decisões** — todos produzem dados, nenhum produz uma recomendação
rastreável e confiável sobre o que fazer a seguir.

O BDS já resolveu essa parte: o Decision Engine (`engines/decision`),
a Full Traceability (PRINCIPLE 001) e o Geospatial Engine
(`domain/spatial-object`, PRINCIPLE 004) já produzem, hoje, uma cadeia
real `Fact → Diagnosis → Decision → Recommendation`. O que faltava era
uma superfície de planejamento que nascesse dentro desse ecossistema,
em vez de depender de uma ferramenta externa (MS Project) que nunca vai
ganhar essa inteligência.

**BBA Project** não é um módulo do BDS — é a porta de entrada dele. Um
engenheiro continua fazendo EAP, cronograma, dependências e caminho
crítico exatamente como sempre fez; a diferença é que, no BBA Project,
cada atividade já nasce conectada à mesma cadeia de decisão real que o
Geospatial Engine já prova funcionar.

Ver PRINCIPLE 005 — No Isolated Activity (`BDS_ARCHITECTURE_PRINCIPLES.md`)
para a regra formal por trás disso.

## Roadmap estratégico

```
Geospatial Engine ✅ (concluído)
        ↓
BBA Project (Planning 2.0) ⭐ ← estamos aqui (Sprint Zero)
        ↓
Execution Engine
        ↓
Evidence Engine
        ↓
Measurement Engine
        ↓
Finance Engine
```

A decisão deliberada é inverter a ordem "óbvia" (Execution antes de
Planning): se o Execution Engine fosse construído primeiro, a obra
continuaria sendo planejada no Microsoft Project — o BDS ficaria
alimentando um cronograma externo, nunca sendo a origem dele. Construir
o BBA Project primeiro significa que o planejamento nasce dentro do
ecossistema, e todo Engine futuro passa a enriquecer esse mesmo plano.

### Fases do BBA Project

- **Fase 1 (paridade)** — EAP/WBS, cronograma, dependências, caminho
  crítico, linha de base, percentual concluído, curva S, marcos. Onde
  o BBA Project compete de igual para igual com o MS Project.
- **Fase 2 (diferencial)** — cada atividade conectada a SpatialObject,
  evidências, medições, documentos, aprovações, decisões e
  recomendações reais (PRINCIPLE 005). Onde o MS Project não chega.
- **Fase 3 (cronograma vivo)** — o BBA Advisor passa a explicar por que
  uma atividade está em risco e a recomendar uma ação concreta, a
  partir da mesma cadeia real de Decision/Recommendation. Nenhum motor
  de sugestão paralelo.

## Sprint Zero — o que foi entregue

**Objetivo do Sprint Zero**: provar, de ponta a ponta, que um
cronograma real importado de fora do BDS pode nascer imediatamente
conectado à cadeia de decisão — sem inventar uma capability nova para
isso.

### Escopo explícito (decisões de arquitetura, não limitações escondidas)

1. **Formato de entrada: XML do Microsoft Project, não `.mpp`.** O
   `.mpp` é um formato binário proprietário, não documentado
   publicamente. O XML de exportação (Arquivo → Salvar Como → XML) é
   aberto, estável desde o Project 2007, e é o que qualquer instalação
   real do MS Project já sabe gerar. Trocar de formato de entrada no
   futuro (ex.: ler `.mpp` via alguma biblioteca, ou ler Primavera P6)
   significa escrever um novo adaptador ao lado deste — nenhum
   consumidor muda.
2. **Sem biblioteca de XML.** `bdos-core` nunca teve uma dependência de
   runtime — a mesma disciplina que já vetou bibliotecas de mapa
   (EPIC 06) e de documento (Rule D do Export Engine). O leitor em
   `domain/schedule-management/adapters/ms-project-xml-import` é
   deliberadamente estreito: lê só os elementos do schema conhecido
   (`Task/UID/Name/OutlineLevel/Start/Finish/ActualStart/ActualFinish/
   Duration/PercentComplete/Milestone/Summary/PredecessorLink`), não é
   um parser de propósito geral.
3. **`Duration` assume jornada de 8h/dia** (a convenção padrão do
   próprio MS Project) — não há suporte a calendários/exceções nesta
   fase.
4. **`LinkLag` é lido como dias inteiros.** Arquivos reais podem
   codificar o lag em outras unidades (décimos de minuto); suporte
   completo a todas as unidades fica para uma sprint futura.
5. **Recursos e calendários ficam fora do Sprint Zero** — Fase 1 do
   roadmap do produto os lista, mas simulá-los sem dado real seria
   inventar informação.
6. **Nenhuma capability nova de "atraso de cronograma".** Uma atividade
   recém-importada, sem nenhuma evidência de campo, já produz um
   `Diagnosis`/`Decision` real através da `capabilities/geospatial-intelligence`
   existente (baixa confiança espacial) — reaproveitada tal como está,
   não estendida. "Atrasada?" é hoje uma pergunta respondida por uma
   comparação simples de datas na camada de apresentação (Curva S e
   Advisor), não por uma nova regra do Decision Engine. Uma capability
   dedicada de "atraso" (combinando confiança espacial + desvio de
   prazo) é um aprimoramento real, explicitamente adiado.

### Arquitetura

```
XML do MS Project
      ↓
domain/schedule-management/adapters/ms-project-xml-import
  (leitor hand-rolled do schema; produz, na mesma passada:
   ScheduleActivity[] via createScheduleActivity
   WorkPackage[]      via createWorkPackage — reaproveitado, não duplicado)
      ↓
domain/spatial-object/adapters/work-package-management
  (generateSpatialObjectsFromWorkPackages — já existia, Sprint 12)
      ↓
domain/business-facts-generator/adapters/spatial-object
  (spatialObjectFactsAdapter — já existia, Sprint 10)
      ↓
capabilities/geospatial-intelligence (lowSpatialConfidenceRule — já existia)
      ↓
engines/decision (buildDecisions → buildRecommendations — já existia)
      ↓
domain/schedule-management (calculateCriticalPath, buildScheduleSCurve — novo)
      ↓
services/bba-project-import (buildBbaProjectImportSnapshot — a única
  Application Service que o produto chama)
      ↓
apps/web: POST /api/bba-project/import → BbaProjectWorkspaceExperience
```

Cada seta reaproveita uma função já provada em sprints anteriores; as
únicas peças genuinamente novas desta sprint são o domínio
`schedule-management` (EAP, dependências, linha de base, CPM, curva S)
e o adaptador de importação XML.

### `domain/schedule-management`

Novo domínio operacional (adicionado a `OPERATIONAL_DOMAINS` em
`architecture/engineering-boundaries.test.ts`, Rule A/B já se aplicam
automaticamente). `ScheduleActivity`: EAP/hierarquia
(`parentActivityId`), dependências tipadas (Finish-to-Start,
Start-to-Start, Finish-to-Finish, Start-to-Finish, com lag),
percentual concluído, datas planejadas/reais, marco (`isMilestone`),
linha de agrupamento da EAP (`isSummary` — nunca entra no caminho
crítico), linha de base (`baseline`, congelada por um ato explícito via
`baselineScheduleActivity`).

`calculateCriticalPath` é um CPM real: passada de ida (early
start/finish) e volta (late start/finish), com os quatro tipos de
dependência genuinamente suportados (não apenas Finish-to-Start com os
demais fingidos), folga total e sinalização de criticidade. Verificado
de forma independente, fora do pacote, contra uma rede de dependências
com resultado calculado à mão antes de qualquer código de teste ser
escrito (ver comentário em `schedule-management.test.ts`).

`buildScheduleSCurve` produz uma curva de **progresso físico**
(percentual ponderado por duração) — não uma curva de custo, já que
nenhum dado financeiro existe nesta camada ainda (Finance Engine é uma
fase futura). `actualPercent` é `null` para datas futuras a
`asOfDate`: o progresso real projetado adiante seria dado inventado.

## Estado de implementação

- ✅ PRINCIPLE 005 documentado (`BDS_ARCHITECTURE_PRINCIPLES.md`).
- ✅ `domain/schedule-management` — EAP, dependências, linha de base,
  CPM real, curva S. Testado (compile-checked + execução real via
  `tsx`, ver seção de evidências do relatório de sprint).
- ✅ `domain/schedule-management/adapters/ms-project-xml-import` — leitor
  do schema XML real do MS Project, produzindo `ScheduleActivity[]` e
  `WorkPackage[]` já conectados (PRINCIPLE 005).
- ✅ `services/bba-project-import` — Application Service, único ponto
  de entrada exposto via `package.json` exports.
- ✅ `apps/web`: rota `/bba-project` (entrada de primeiro nível na
  Sidebar, ao lado de "Hoje" e "Workspaces" — nunca aninhada em
  Engenharia), rota de API `/api/bba-project/import`, fluxo de
  importação (exemplo + upload real de `.xml`), tabela de EAP/Cronograma,
  lista de atividades em risco, BBA Advisor, mapa (reaproveitando o
  `PlaceholderSpatialMapView` do Geospatial Workspace), Painel
  Executivo.
- ⏳ Recursos, calendários, `.mpp` binário, outras unidades de
  `LinkLag`, uma capability dedicada de "atraso de cronograma" — todos
  adiados explicitamente, não fingidos.
- ⏳ Fase 3 (cronograma vivo com replanejamento sugerido pelo Advisor)
  ainda não implementada — depende de Execution/Evidence/Measurement
  alimentando o mesmo plano.
