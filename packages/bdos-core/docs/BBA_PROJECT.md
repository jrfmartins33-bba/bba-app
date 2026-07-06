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
BBA Project Studio (Planning 2.0) ⭐ ← estamos aqui (Sprint Zero + Sprint 1)
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

## Sprint 1 — Planning Dataset Import + Living Schedule

**Objetivo do Sprint 1**: provar que o produto (agora **BBA Project
Studio**) consegue consolidar cronograma, curva S e físico-financeiro
— de fontes diferentes, inclusive uma planilha Excel real do cliente
— num único **Planning Dataset**, sem depender de datas/dependências
explícitas para produzir Decision/Recommendation reais, e sem nunca
inventar dado onde a planilha de origem não trouxe informação.

### Planning Dataset

`domain/schedule-management/planning-dataset.types.ts`/`.ts` — o
modelo consolidado que XML e Excel produzem igualmente: atividades
(`PlanningActivityRecord`, com todos os campos opcionais — uma linha
de físico-financeiro real não tem data nem dependência, e isso é uma
limitação real da origem, não um erro de importação), séries de
período (`PlanningPeriodSeries`, incluindo uma série agregada
"Curva S" do projeto inteiro), resumo financeiro
(`PlanningFinancialSummary`) e avisos estruturados
(`PlanningImportWarning`). `buildPlanningDatasetFromScheduleActivities`
envolve o resultado do XML (Sprint Zero, inalterado) na mesma forma;
`toWorkPackageInputsFromPlanningDataset`/`toScheduleActivityInputsFromPlanningDataset`
convertem o dataset de volta para os tipos reais do domínio —
`WorkPackage` nunca exige data, por isso toda linha (com ou sem
cronograma detalhado) vira um `SpatialObject`/`Decision`/`Recommendation`
real; só as linhas com data completa entram no CPM/curva S calculados.

### Importador de Excel

`domain/schedule-management/adapters/excel-import/` — mesma disciplina
de zero dependência de runtime do importador de XML:
- `xlsx-reader.ts`: leitor hand-rolled de ZIP+Office Open XML (usando
  só `node:zlib` para inflar entradas comprimidas e `DataView`/`TextDecoder`
  para o resto) — não é um parser de propósito geral, só o necessário
  para `workbook.xml`/`sharedStrings.xml`/`sheetN.xml`.
- `sheet-type-detector.ts`: reconhece variações comuns de cabeçalho
  (EAP/WBS/Código/Item, Atividade/Descrição/Serviço, Início/Fim,
  Percentual/%/Avanço, Predecessoras/Dependências, Valor/Custo/Peso,
  Controle) e uma linha de períodos ("mês N"), classificando a aba como
  cronograma, curva-s, físico-financeiro, mista ou não identificada.
- `excel-import.ts`: duas estratégias de extração — uma linha por
  atividade (cronograma clássico) ou matriz de períodos
  (curva S/físico-financeiro, com PREVISTO/REALIZADO por período,
  reconhecendo magnitude por valor — percentual vs. R$ — em vez de
  contar linhas fixas). Nunca cria uma dependência artificial: sem
  coluna de predecessoras, gera o warning `missing_dependencies`.

**Validado contra a planilha real do cliente**
(`CURVA S_MED-08_R_00.xlsx` — Cronograma Físico-Financeiro da Barragem
Lagoa do Arroz, MEDIÇÃO Nº 8) durante o desenvolvimento: 3 abas (a
principal "CRONOGRAMA FÍSICO-FINANCEIRO", "5-RELATÓRIO FOTOGRÁFICO"
oculta e corretamente ignorada, "Curva S" — só um gráfico, sem dados
tabulares próprios, corretamente preterida por menor confiança de
detecção), 11 itens reais de EAP + 2 ajustes contratuais, valor de
contrato R$ 7.611.851,65, medição acumulada R$ 4.772.540,69 — todos
extraídos corretamente, incluindo a curva S agregada real do projeto
(previsto 94% × realizado 63% na medição 8, o mesmo atraso de -31%
que a própria planilha do cliente já registrava). **A planilha real
nunca foi commitada no repositório** (é público e contém dados
comerciais reais) — a suíte de testes permanente usa fixtures .xlsx
sintéticos, construídos por um escritor de ZIP hand-rolled
(`xlsx-test-fixtures.ts`, só para testes).

### Living Schedule

`services/bba-project-import/living-schedule.ts` —
`simulateScheduleDelay` aumenta a duração de uma atividade e
recalcula `calculateCriticalPath`/`buildScheduleSCurve` (inalteradas)
sobre o resultado — puro, em memória, nunca persistido. Reporta
`hasDependencies: false` quando a atividade está isolada (típico de um
Excel físico-financeiro sem predecessoras), para a UI mostrar "Impacto
em caminho crítico exige dependências explícitas" em vez de fingir um
recálculo sem sentido. Nenhuma Decision/Recommendation nova nasce
disso — a cadeia de decisão depende de confiança espacial, não de
tempo, deliberadamente.

### `importPlanningSource` — o novo despachante

`services/bba-project-import/planning-source-import.ts` — para
`sourceType: "ms-project-xml"`, delega inteiramente para
`buildBbaProjectImportSnapshot` (Sprint Zero, byte a byte inalterada)
e só empacota o resultado real no novo envelope
(`PlanningImportSnapshot`); para `sourceType: "excel"`, roda a mesma
cadeia com a origem dos dados trocada. `apps/web/app/api/bba-project/import/route.ts`
agora aceita `.xml` e `.xlsx` via `multipart/form-data`, detectando o
tipo por extensão, MIME e, em último caso, os bytes mágicos do arquivo
("PK" para ZIP/.xlsx, "<" para XML).

## Estado de implementação

- ✅ PRINCIPLE 005 documentado (`BDS_ARCHITECTURE_PRINCIPLES.md`).
- ✅ `domain/schedule-management` — EAP, dependências, linha de base,
  CPM real, curva S, `simulateActivityDelay` (Living Schedule).
- ✅ `domain/schedule-management/planning-dataset.ts` — o modelo
  consolidado de planejamento (Sprint 1).
- ✅ `domain/schedule-management/adapters/ms-project-xml-import` —
  leitor do schema XML real do MS Project (Sprint Zero, inalterado).
- ✅ `domain/schedule-management/adapters/excel-import` — leitor de
  .xlsx, detector de tipo de planilha, importador (Sprint 1), validado
  contra a planilha real do cliente.
- ✅ `services/bba-project-import` — `buildBbaProjectImportSnapshot`
  (Sprint Zero, inalterada), `importPlanningSource` (despachante,
  Sprint 1), `simulateScheduleDelay` (Living Schedule).
- ✅ `apps/web`: rota `/bba-project` (exibida como "BBA Project
  Studio"), tela "Como deseja começar?" (Ver demonstração / Importar
  meu planejamento), importação de `.xml`/`.xlsx`, painel de
  limitações quando há warnings, tabela de EAP/Cronograma, Advisor,
  mapa, Painel Executivo, Living Schedule.
- ⏳ Recursos, calendários, `.mpp` binário, outras unidades de
  `LinkLag`, uma capability dedicada de "atraso de cronograma", outras
  unidades de `LinkLag`, suporte a mais de uma aba simultânea de um
  mesmo arquivo — todos adiados explicitamente, não fingidos.
- ⏳ Fase 3 completa (cronograma vivo com replanejamento sugerido pelo
  Advisor a partir de uma capability própria) ainda não implementada —
  depende de Execution/Evidence/Measurement alimentando o mesmo plano.
