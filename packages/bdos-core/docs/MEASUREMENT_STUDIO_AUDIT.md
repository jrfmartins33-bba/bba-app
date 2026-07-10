# Measurement Studio — Auditoria de Estado Atual (Sprint 19.0)

> Insumo do Epic 19 (Measurement Bulletin Import). Só leitura — nenhum
> arquivo de produção foi alterado para produzir este relatório. Ordem
> seguida: SQL → Guardrails → Domínio → Repositories → Application →
> API → UI → comparação com o precedente do Epic 18.

## Resumo executivo

**O Studio de Medições está em ~35–40%: domínio conceitual maduro
(quase completo), zero persistência, zero application layer, zero
API, UI puramente estática/mock.** A hipótese do relatório anterior
("domínio maduro, persistência incompleta, UI é a parte mais fraca,
maior trabalho é o adapter") está **parcialmente confirmada, mas o
achado mais importante não estava na hipótese**: existem **dois tipos
`MeasurementBulletin` diferentes e não reconciliados** em domínios
distintos, e `WorkPackage` já é usado pelo Project Studio sem que sua
propriedade esteja declarada em `PLATFORM_ARCHITECTURE.md` — dois
riscos estruturais que precisam de decisão antes de qualquer código do
Epic 19, não só depois.

## A. Persistência — fonte de verdade: SQL

Busquei `CREATE TABLE` em todo `supabase/migrations/*.sql` por
`measurement`, `medicao`, `boletim`, `service_item`, `work_package`.

**Resultado: zero tabelas.** Nenhuma delas existe no banco. Como
comparação, o padrão de nomenclatura já usado por outros domínios do
bdos-core (sem prefixo `bdos_`, nomes de domínio direto) é confirmado
por `planning_imports`, `planning_datasets`, `decision_snapshots`,
`advisor_narratives`, `execution_workflows`, `execution_tasks`,
`execution_task_evidence_references`, `execution_task_status_history`
— todas presentes; nada equivalente para medição existe.

**Conclusão**: todo o domínio de medições hoje é TypeScript puro, sem
nenhuma linha jamais persistida. Isso não é uma lacuna pequena — é o
maior item do Epic 19, maior até que o próprio adapter de importação.

## B. Repository Layer

Busquei em `apps/web/lib/bdos/repository.ts` (o único repository real
do app hoje, usado por Project Studio/Execution/Advisor) por
`measurement`, `bulletin`, `service item`, `work package`.

**Resultado: zero funções.** Não existe repository de medição, nem
esqueleto. Consequência direta de A — sem tabela, não há o que
consultar.

## C. Application Services

`packages/bdos-core/src/services/` contém hoje: `bba-project-import`,
`execution-management`, `geospatial-product-integration`.

**Resultado: nenhum serviço de medição.** Nenhum
`MeasurementApplicationService` ou equivalente. O domínio existe só
como funções puras chamáveis diretamente — nunca orquestrado por uma
camada de aplicação.

## D. API

Busquei rotas sob `apps/web/app/api/` por `measur`, `medic`, `boletim`.

**Resultado: zero rotas.** Nenhum `/api/measurement/*` existe.

## E. UI

Existe uma única rota, `/memorias`
(`apps/web/app/(dashboard)/memorias/page.tsx`), consistente com
`PLATFORM_ARCHITECTURE.md` (linha 106: "Studio de Medições... `/memorias`,
nível de topo... dados de demonstração").

Inspecionei o arquivo: é um **client component único, sem nenhuma
chamada a `bdos-core`**, com um array `MEMORIES` hardcoded (4 linhas
de exemplo: "MEM-0001 Escavação"... "MEM-0004 Armadura"). Nenhum
upload, nenhum fetch, nenhuma integração com o domínio real. Ao
contrário do Project Studio (`apps/web/components/bba-project/`, com
uma dúzia de arquivos e um componente de orquestração de estado
inteiro), o Studio de Medições **não tem pasta de componentes
própria** — é uma página solta.

**Confirmação do guardrail (`studio-boundaries.test.ts`)**:
`STUDIO_COMPONENT_FOLDERS = ["bba-project", "geospatial"]`. Studio de
Medições **não está protegido pelo guardrail estrutural** — pergunta
objetiva da sua sugestão, resposta é "não". Isso não é bug (não há o
que violar ainda, a pasta nem existe), mas precisa entrar no roadmap
do Epic 19 quando a UI for construída: adicionar `"measurement"` (ou
nome equivalente) a `STUDIO_COMPONENT_FOLDERS` no mesmo commit que
criar a pasta de componentes.

## F. Demo × Produção

| Camada | Estado |
|---|---|
| Domínio (`measurement-*`, `bulletin-generator`, `service-item-management`, `work-package-management`, `measurement-calculation`) | **Produção-grade**: funções puras, testadas (`pnpm test` já cobre todas), congelamento de objetos (`freezeDomainObject`), máquinas de estado com transições validadas, códigos de erro estruturados — mesmo padrão de rigor do resto do bdos-core. |
| Persistência | **Inexistente** |
| Application/API | **Inexistente** |
| UI | **Mock estático**, dados fixos, sem link com o domínio |

## G. Guardrails e Ownership — dois achados que não estavam na hipótese

### G.1 — Dois tipos `MeasurementBulletin` diferentes, não reconciliados

- `domain/measurement-workflow/measurement-workflow.types.ts`:
  `MeasurementBulletin` **fino** — `id`, `measurementId`,
  `bulletinNumber`, `period`, `issueDate`, `totalMeasuredValue`,
  `totalMeasuredQuantity`. Parte do ciclo `MeasurementCycleStatus`
  (`Draft → Measured → BulletinGenerated → Certified → Closed`).
- `domain/bulletin-generator/bulletin-generator.types.ts`:
  `MeasurementBulletin` **rico** — `reference`, `header` (contrato,
  projeto, período, responsável técnico), `lines[]`
  (`serviceItemId`/`code`/`description`/`unit`/`quantity`/`unitValue`/
  `totalValue`), `totals`, `status` própria
  (`Draft/Validated/Finalized/Cancelled`, diferente da
  `MeasurementCycleStatus` acima), `validationIssues`
  (`severity: Blocking/Warning`), `trace` (auditoria de ações).

**Estes são dois modelos concorrentes do mesmo conceito de negócio**,
com nomes de status parecidos mas não idênticos, provavelmente
construídos em sprints diferentes sem referência cruzada. `
bulletin-generator.ts` é o mais completo e é o que já resolve
exatamente o padrão de reconciliação físico×financeiro que
discutimos (`computeTotalValue(quantity, unitValue)` — o financeiro
**já nasce calculado**, nunca aceito bruto de uma fonte externa,
confirmando a Hipótese 1 como o comportamento nativo do domínio, não
uma ideia nova a implementar).

**Isto precisa de uma decisão explícita antes de qualquer código do
Epic 19**: qual dos dois é o `MeasurementBulletin` canônico? Minha
leitura preliminar (sujeita à sua revisão): `bulletin-generator` é o
candidato natural — tem o shape completo, a reconciliação embutida, e
`validationIssues` já modela exatamente o que a importação de um BM_08
precisaria emitir. `measurement-workflow.MeasurementBulletin` parece
uma versão anterior/mais simples que ficou por trás do ciclo de
certificação (`MeasurementCycleStatus`) — talvez o ciclo de
certificação devesse referenciar o bulletin **rico** por id, em vez de
manter seu próprio tipo fino duplicado. Não decido isso aqui — é
exatamente o tipo de escolha que pertence ao desenho do Epic 19, não a
uma auditoria.

### G.2 — `WorkPackage` já é cross-domain, mas sua propriedade não está documentada

Busquei quem usa `work-package-management` hoje:
`schedule-management` (Project Studio) já importa `createWorkPackage`/
`WorkPackage` diretamente — tanto no importador MS Project XML quanto
no importador Excel (`planning-source-import.ts`), para alimentar
`generateSpatialObjectsFromWorkPackages` (Geo Studio). Ou seja: **o
Project Studio já cria `WorkPackage` em produção, hoje**, mesmo sem
persistência própria (são objetos transitórios, usados só para
derivar `SpatialObject`, nunca persistidos como linha própria — `grep`
confirma zero coluna `work_package` em qualquer tabela).

A tabela de ownership cross-Studio de `PLATFORM_ARCHITECTURE.md` §5
lista `SpatialObject` (Geo Studio), `PlanningDataset`/`ScheduleActivity`
(Project Studio), `Decision`/`Recommendation` (Decision Engine),
Evidência (Studio de Evidências), `Medição/Boletim` (Studio de
Medições), Aprovação, Fluxo de caixa — **mas nunca menciona
`WorkPackage`**. Isso não é uma violação (nenhuma regra foi escrita
para ser quebrada), mas é uma lacuna real: se o Epic 19 fizer
`ManagedServiceItem`/`MeasurementEntry` apontarem para um
`WorkPackage.id` gerado de forma independente pelo adaptador de
importação de medição, e o Project Studio continuar gerando seus
próprios `WorkPackage` in-memory a cada import de cronograma, **as
duas Studios nunca vão enxergar o mesmo `WorkPackage` para o mesmo item
real de EAP** — nenhuma correlação por id será possível, só por código
normalizado (mais frágil).

Não decido isto aqui, mas registro como pergunta que o desenho do
Epic 19 precisa responder: `WorkPackage` é uma entidade compartilhada
que precisa ganhar uma tabela e um dono explícito (candidato mais
provável: nenhum Studio sozinho — é uma primitiva de EAP compartilhada,
mais próxima de um "Engine" do que de um Studio), antes que dois
Studios diferentes comecem a persistir suas próprias cópias
divergentes.

### G.3 — `service-item-management` está sem nenhum consumidor de produção

Confirmei: `service-item-management` só é referenciado por arquivos de
teste e pelo guardrail — nenhum código de produção (API, service,
outro domínio) o usa hoje. Domínio completo e testado, mas
genuinamente adormecido. Bom sinal para o Epic 19 (nada para migrar,
nenhuma dependência a desfazer), más notícia se havia a expectativa de
que ele já estivesse integrado a algo.

## Comparação explícita com o precedente do Epic 18

| | Project Studio (Epic 18) | Studio de Medições (hoje) |
|---|---|---|
| Staging bruto (`planning_imports`) | ✅ existe, com `status` operacional | ❌ não existe nada equivalente |
| Dado estruturado (`planning_datasets`) | ✅ existe | ❌ não existe (nem o `MeasurementBulletin`/`MeasurementEntry` têm tabela) |
| Repository | ✅ `apps/web/lib/bdos/repository.ts` | ❌ nenhuma função |
| API | ✅ 4 rotas (`import`, `prepare-upload`, `upload-complete`, `process`) | ❌ nenhuma rota |
| UI | ✅ fluxo completo com upload real | ❌ página estática mock |

**Resposta à pergunta que você formulou** ("o domínio de medições já
possui um equivalente arquitetural ao padrão `planning_imports` →
`planning_datasets`?"): **não, nada existe**. O padrão do Epic 18
deixa de ser uma ideia e passa a ser, como você previu, o precedente
arquitetural mais próximo a seguir — mas agora aplicado a um domínio
que começa do zero em persistência, não a um domínio que só precisava
de uma correção pontual.

## Respostas aos critérios de saída

1. **O domínio conceitual está completo?** Quase — sim para
   `MeasurementEntry`/`ManagedServiceItem`/`WorkPackage`/
   `bulletin-generator`/`measurement-calculation`. **Não** no sentido
   de que os dois `MeasurementBulletin` concorrentes (G.1) precisam
   ser reconciliados antes de "completo" ser uma resposta honesta.
2. **A persistência já existe ou precisa ser criada?** Precisa ser
   criada inteiramente — nenhuma tabela existe.
3. **O Studio de Medições é um produto parcialmente implementado ou
   apenas um domínio?** **Apenas um domínio.** Não há produto ainda —
   a UI é decorativa, sem nenhuma ligação real.
4. **Menor conjunto de componentes que falta para importar um BM_08
   real?**
   - Decisão de reconciliação G.1 (qual `MeasurementBulletin` é o
     canônico).
   - Decisão de ownership G.2 (`WorkPackage` compartilhado).
   - Migração SQL (tabelas para bulletin/entry/service item/work
     package, ou o subconjunto mínimo necessário).
   - Repository layer (novo, em `apps/web/lib/bdos/repository.ts` ou
     arquivo próprio).
   - Adapter de importação Excel→domínio (o único item que já estava
     na hipótese original — e ainda é o único que exige lógica nova
     de parsing, tudo o resto é "encanamento").
   - API (endpoints, provavelmente reaproveitando o padrão
     prepare-upload/process do Epic 18 já validado).
   - UI mínima (mesmo que só leitura no início).
5. **O Epic 19 será predominantemente integração, persistência, UI, ou
   adapter de importação?** **Persistência primeiro** (é o maior
   buraco, e as decisões G.1/G.2 são pré-requisito dela), **adapter em
   segundo** (o trabalho novo de parsing), UI e API são
   "encanamento" relativamente mecânico depois que os dois primeiros
   existirem — na prática, uma sequência muito parecida com a do
   próprio Epic 18 (schema → repository → API → UI), só que partindo
   de uma base de persistência zero em vez de uma tabela já existente
   precisando só de um campo novo.

## Riscos identificados

- **G.1 e G.2 não são bugs — são decisões de desenho não tomadas.**
  Implementar persistência antes de resolver qualquer um dos dois
  arriscaria fixar em schema SQL uma ambiguidade que hoje só existe em
  TypeScript (mais barata de corrigir).
- Nenhuma violação de import cross-Studio foi encontrada em código de
  produção (Project Studio não importa nada de `measurement-*`,
  `bulletin-generator` ou `service-item-management`) — a única
  sobreposição real é `WorkPackage`, que é estrutural (G.2), não uma
  violação de acesso indevido.
- A ausência do Studio de Medições em `STUDIO_COMPONENT_FOLDERS`
  (studio-boundaries.test.ts) é inofensiva hoje só porque não há
  código para violar a regra — vira relevante no primeiro commit que
  criar `apps/web/components/measurement/` (ou nome equivalente).

## Não decidido aqui (pertence ao desenho do Epic 19, não a esta auditoria)

- Qual `MeasurementBulletin` é o canônico (G.1).
- Quem é dono de `WorkPackage` (G.2) e se ele precisa de tabela
  própria antes do resto.
- Staging (`Raw Measurement Bulletin`, análogo a `planning_imports`)
  vs. materialização direta — agora com a informação de que **não
  existe nada a reaproveitar**, a decisão é sobre replicar o padrão do
  Epic 18 do zero, não sobre encontrar algo já parcialmente construído.
- Nome/slug da nova rota de import (`/api/measurement/*` ou dentro de
  um namespace mais específico).
