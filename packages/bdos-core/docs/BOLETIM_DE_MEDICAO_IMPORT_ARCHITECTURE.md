# Boletim de Medição Import Architecture

> Pré-requisito de desenho para as Fases 2 e 3 do follow-up do Epic 18
> (ver `RESILIENT_PLANNING_IMPORT.md`). Responde as 9 perguntas
> levantadas antes de qualquer código de extração para o layout real do
> BM_08 (`BOLETIM DE MEDIÇÃO 08`, ~190 abas, par FÍSICO/FINANCEIRO por
> período `MED-NN`). Nenhuma implementação acontece neste documento.

## Achado que muda a pergunta

A pergunta não é "como ensinar o Project Studio a ler mais um formato
de Excel" — é "este arquivo já tem um dono na plataforma, e esse dono
já tem um modelo de domínio quase pronto para ele". Duas fontes
confirmam isso, nenhuma delas nova, nenhuma inventada para este
documento:

1. **`PLATFORM_ARCHITECTURE.md` §5** (tabela de ownership cross-Studio,
   linha 152): `Medição / Boletim` → dono **Studio de Medições**,
   consumido só-leitura por Studio de Finanças (faturamento). Isso já
   estava escrito antes do Epic 18 existir.
2. **`domain/measurement-workflow/measurement-workflow.types.ts`** já
   declara `MeasurementBulletin` (`bulletinNumber`, `period`,
   `issueDate`, `totalMeasuredValue`, `totalMeasuredQuantity`) e
   `MeasurementCycleStatus` com o estágio `BulletinGenerated` no meio
   do ciclo `Draft → Measured → BulletinGenerated → Certified →
   Closed`. O conceito "boletim" já é modelado — só não tem hoje um
   adaptador que materialize um boletim a partir de um Excel real
   produzido fora da plataforma (o que a contratada manda para a
   fiscalização todo mês).

Ou seja: isto não é uma lacuna de parser do Project Studio. É uma
funcionalidade do Studio de Medições que ainda não foi construída —
"boletins ainda em desenvolvimento", exatamente como
`PLATFORM_ARCHITECTURE.md` linha 106 já dizia antes de qualquer
investigação deste Epic.

## As 9 perguntas

### 1. Qual Studio é proprietário do boletim?

**Studio de Medições.** Já documentado (`PLATFORM_ARCHITECTURE.md`
§5), não é uma decisão nova — é a confirmação de uma regra existente
diante de um caso real.

### 2. O boletim cria dados autônomos ou complementa um planejamento?

**Autônomo, com correlação opcional.** Um `MeasurementEntry`
(`domain/measurement-entry`) referencia `workPackageId` +
`serviceItemId` + `measurementPeriodId` — nenhum desses depende de um
`PlanningDataset` (Project Studio) existir. O boletim se sustenta
sozinho porque `WorkPackage`/`ManagedServiceItem` já são as unidades
nativas de Studio de Medições, não uma cópia de `ScheduleActivity`.

A comparação planejado×medido (Alternativa B do relatório anterior)
continua possível **depois**, como uma correlação read-only por
código de EAP entre dois Studios já independentes — nunca um
pré-requisito de importação. Isso é consistente com a regra de
ownership: nenhum Studio duplica o dado de outro, cada um lê o que
precisa via contrato do dono.

### 3. O que representa uma "atividade" no arquivo?

Não representa uma `ScheduleActivity` (isso pertence ao Project
Studio e exige datas/duração/dependências, que o boletim não tem).
Representa um `MeasurementEntry`: um par (item medido × período), sem
data de início/fim, sem duração — que é exatamente a forma que
`MeasurementEntry` já tem hoje (`entryDate` é a data do lançamento da
medição, não um intervalo de execução).

### 4. Como interpretar cada par físico/financeiro?

**Físico é o dado primário; financeiro é derivado, não importado
cegamente.** `ManagedServiceItem` já modela `unitPrice` (preço
unitário contratado) e `contractValue` — o valor financeiro de uma
medição é `quantidade medida × unitPrice`, um cálculo que o domínio já
sabe fazer, não um número solto que o Excel imprime.

Isso muda a estratégia de extração: em vez de "importar a coluna
FINANCEIRO como está", o importador deveria **recalcular** o
financeiro a partir do físico + preço unitário do contrato e
**comparar** com o que o Excel imprime. Divergência vira um aviso
estruturado (possível erro de fórmula na planilha da contratada, ou
preço unitário desatualizado no catálogo) — nunca um valor aceito
silenciosamente só porque "veio da planilha".

### 5. Os valores são do período ou acumulados?

O BM_08 real traz os dois (ex.: aba `BOLETIM FÍSICO FINANCEIRO`:
colunas `ANTERIOR`/`NO PERÍODO`/`ACUMULADO`/`SALDO`, tanto físicas
quanto financeiras). `MeasurementEntry.quantity` deve receber o
**delta do período** (`NO PERÍODO`), nunca o acumulado — é o dado
atômico de onde o acumulado se deriva, e `ManagedServiceItem` já tem
`accumulatedQuantity`/`remainingQuantity` como campos próprios para
guardar o resultado agregado, recalculável a partir da soma das
entradas, não copiado da planilha.

### 6. Como tratar itens agregadores da EAP?

`WorkPackage.type` já distingue `ScopeGroup` de itens executáveis, e
`parentWorkPackageId` já modela a hierarquia da EAP. Uma linha como
`01.00.00 SERVIÇOS PRELIMINARES...` (sem unidade, sem quantidade
própria) vira um nó `WorkPackage` (`ScopeGroup`), nunca um
`ManagedServiceItem`/`MeasurementEntry` — mesma disciplina que
`excel-import.ts` já aplica hoje: uma linha sem os campos mínimos não
vira uma entidade fabricada, some da extração de entradas mas
permanece na árvore de WorkPackages.

### 7. Como relacionar o boletim a um cronograma existente?

Por código, read-only, nunca por escrita cruzada — `WorkPackage.code`/
`ManagedServiceItem.code` (Studio de Medições) correlacionados com
`PlanningActivityRecord.code` (Project Studio) por igualdade de string
normalizada. Nenhum dos dois Studios escreve no domínio do outro; a
correlação vive numa camada de leitura (ex.: um serviço de
apresentação que busca dos dois contratos e junta por código), igual
ao padrão já usado para `SpatialObject` (Geo Studio) sendo lido
read-only por Project Studio/Studio de Evidências/Studio de Medições.

### 8. O que o usuário verá quando não existirem datas, duração ou dependências?

Exatamente a superfície que `PLATFORM_ARCHITECTURE.md` já reserva para
Studio de Medições (linha 171/222): "Medições, quantitativos,
boletins, apropriações, memórias de cálculo" / "Boletim de Medição,
Memória de Cálculo". Nunca uma versão degradada da tela do Project
Studio (sem Curva S temporal, sem caminho crítico) — uma tela própria,
cujo vocabulário já é diferente por natureza (boletim, item medido,
período de medição, certificação), não um cronograma incompleto.

### 9. Quais análises são legítimas e quais devem permanecer indisponíveis?

**Legítimas, hoje**: acompanhamento de medição por período,
orçado×medido por item de serviço (via `unitPrice` já modelado),
status do ciclo de certificação (`MeasurementCycleStatus`).
**Indisponíveis sem um cronograma real associado**: caminho crítico,
atraso de atividade, Curva S temporal projetada — continuam
exclusivas do Project Studio. Se um cronograma do mesmo contrato já
foi importado (pergunta 7), a correlação por código pode habilitar uma
visão combinada no futuro — mas isso é aditivo, nunca um requisito
para o boletim funcionar sozinho.

## Achado lateral: as abas ocultas "memória de cálculo" já têm dono também

O BM_08 tem ~150 abas ocultas de memória de cálculo por item (ex.:
`02.02.01`: `EXTENSÃO × LARGURA = ÁREA`; `02.02.02`: `VOLUME ×
DENSIDADE = PESO`). Isso não é ruído do arquivo — é
`domain/measurement-calculation`, que já tem `CalculationFormulaType`
com `AreaRectangle`/`AreaTriangle`/`AreaCircle`/`PerimeterRectangle` e
um `measurement-memory-builder.ts` dedicado. Mesmo raciocínio: a
plataforma já modelou esse conceito antes de qualquer investigação
deste Epic; falta o adaptador que leia um arquivo real e materialize
contra esse modelo. Não é escopo desta análise decidir isso agora —
só registrar que também não é um problema novo de Project Studio.

## Alternativa recomendada

**Alternativa A** (Entrada do Studio de Medições), sem ressalva — não
é mais "preliminarmente a mais natural" como no relatório anterior, é
a que o modelo de domínio já foi construído para sustentar.
Alternativa B (correlação com cronograma) permanece válida como
capacidade aditiva futura, nunca como pré-requisito. Alternativa C
(importação híbrida) fica descartada: o "modelo formal de domínio"
que ela exigia como pré-condição já existe (measurement-entry,
measurement-workflow, service-item-management, work-package-management,
measurement-calculation) — não é um domínio a inventar, é um
adaptador de importação a construir sobre domínio já maduro.

## Consequência arquitetural

O Project Studio **não deve receber** novas regras de detecção,
parsing ou interpretação de Boletins de Medição. Quando precisar
consumir informações provenientes do Studio de Medições, deverá
fazê-lo exclusivamente por contratos de leitura, preservando o
ownership definido em `PLATFORM_ARCHITECTURE.md`. Nenhum código de
`MeasurementBulletin`/`MeasurementEntry`/`MeasurementCalculation`
pertence a `schedule-management` ou a `services/bba-project-import` —
nem mesmo como conveniência temporária. Esta frase existe para evitar
a tentação, no próximo Epic, de aproveitar o importador do Project
Studio só porque ele já existe e está próximo.

## O que isto implica para o Epic 18 follow-up

- **Fase 2** (`PERIOD_LABEL_PATTERN` aceitar `MED-NN`) deixa de fazer
  sentido como estava desenhada — não é o Project Studio que precisa
  reconhecer esse padrão. `sheet-type-detector.ts` continua servindo
  só ao Project Studio (cronograma/curva S/físico-financeiro *com
  datas*); nenhuma mudança nele é necessária para o Studio de
  Medições.
- **Fase 3** deixa de ser "nova estratégia de extração dentro de
  `excel-import.ts`" e passa a ser **um novo adaptador**, análogo em
  espírito ao existente (`xlsx-reader.ts` é reaproveitável — é neutro,
  sem significado de negócio — mas a detecção/extração é nova), vivendo
  em `domain/measurement-entry/adapters/excel-import` (ou pasta
  equivalente dentro do domínio correto), nunca dentro de
  `schedule-management`.
- Isso é trabalho novo de escopo considerável (detecção do layout
  boletim, mapeamento EAP→WorkPackage/ManagedServiceItem, reconciliação
  físico×financeiro, criação de `MeasurementEntry` em lote, geração do
  `MeasurementBulletin`) — não cabe como continuação informal da
  correção de header-row já implementada. Proponho tratá-lo como um
  Epic próprio (`Boletim de Medição Import`), com seu próprio
  relatório de estado atual (schema do banco para
  measurement-entry/measurement-workflow — ainda não verificado se
  existe persistência real ou só o domínio em memória) antes de
  qualquer código, seguindo o mesmo rigor do Epic 18.

## Não decidido aqui (fora de escopo desta análise)

- Se `measurement-entry`/`measurement-workflow` já têm tabelas
  Supabase reais ou só existem como domínio puro sem persistência
  (`PLATFORM_ARCHITECTURE.md` diz "dados de demonstração" — precisa
  verificação antes do próximo Epic).
- Se o Studio de Medições já tem uma rota de API/UI onde este import
  entraria, ou se isso também precisa ser construído.
- Limpeza automática de boletins parcialmente importados (mesmo
  padrão de dívida documentada do Epic 18, a repetir se aplicável).
