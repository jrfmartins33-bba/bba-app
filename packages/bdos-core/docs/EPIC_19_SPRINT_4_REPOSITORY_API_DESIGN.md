# Epic 19 — Sprint 4: Repository & API Design (desenho)

> Mesma disciplina do Epic 18: relatório do estado atual, desenho dos
> endpoints e estados, lista exata de arquivos, riscos — antes de
> qualquer código. **Sprint 4.0 (Contract Freeze) concluída.** 4A
> (Repository) e 4C (Parser) **implementadas e aprovadas para commit —
> a pendência bloqueante de reconciliação financeira (ver "Revisão
> 19.4A/4C" e "3.1 — Resolução" abaixo) foi corrigida: o parser agora
> lê o bloco "CONTROLE FINANCEIRO – MEDIÇÃO" (autoritativo, detectado
> semanticamente) em vez da grade histórica MED-NN, e uma invariante
> permanente (`official_period_total_mismatch`, blocking) impede que
> qualquer futuro boletim seja tratado como importado com confiança
> sem reconciliar com o total que o próprio arquivo declara.** 4B/4D/4E
> não iniciadas.

## Revisão 19.4A/4C — achados

Três pontos levantados na revisão do código (não só do relato).

### 1. `findOrCreateManagedServiceItem` prometia mais do que o banco garante

Corrigido. Renomeada para `findMatchingManagedServiceItemOrCreate`,
retornando `{ item, outcome: "matched" | "created" }` em vez de só o
registro — força quem chama a enxergar explicitamente que um "matched"
é uma correlação heurística por `(engineering_project_id, code)`, não
uma identidade garantida (ao contrário de `findOrCreateWorkPackage`,
que continua com esse nome porque a `UNIQUE` real existe).

Respostas às perguntas da revisão, documentadas agora no próprio
código (comentário extenso na função):

- **Campos do SELECT**: `engineering_project_id` + `code`, nada mais.
- **Identidade considerada equivalente**: só o texto do código —
  `description`/`unit` do que já existe nunca são comparados contra o
  que acabou de ser declarado.
- **Códigos repetidos legítimos podem ser confundidos?** Sim — esse é
  o risco real. Se o mesmo código aparecer para dois itens
  genuinamente diferentes (o motivo real de a constraint ter sido
  removida), a função retorna o primeiro match, e o outcome `"matched"`
  é o sinal para o Application Service (Sprint 4D) decidir se aceita
  a correlação (comparando `item.description`/`item.unit` contra o
  declarado) ou trata como um item novo — decisão de negócio, fora do
  repository.
- **Retentativas do mesmo import evitam duplicação?** No caso
  sequencial comum, sim (a segunda chamada encontra a linha já criada
  pela primeira). Concorrência real (duas chamadas simultâneas) não é
  protegida — sem constraint no banco, não há nada a capturar.
- **Idempotência apoiada em identificador estável da origem?** Não.
  Nada liga a linha a `measurement_bulletin_import_id` nem a
  `sourceLocation` — só ao código textual.

Não recriamos no repository a unicidade removida conscientemente do
banco na Sprint 3 — a correção foi de honestidade de contrato (nome +
tipo de retorno), não de tentar simular atomicidade que não existe.

### 2. Dependência de `xlsx-reader.ts` (measurement-workspace → schedule-management)

Avaliação, não refatoração (conforme pedido):

- **Contém só leitura mecânica de XLSX?** Confirmado — busca por
  termos de cronograma/planejamento no arquivo retorna zero
  ocorrências de código real, só um comentário documentando que
  `planning-dataset.ts` nunca importa este arquivo (o inverso do que
  se poderia temer).
- **Expõe tipos ou conceitos de cronograma?** Não — os únicos exports
  são `readXlsxWorkbook` e os tipos `ExcelCellValue`/`ExcelSheetRow`/
  `ExcelSheetDto`/`ExcelWorkbookDto`, genéricos (linha/célula/aba/
  workbook), sem nenhum conceito de atividade, cronograma ou Curva S.
- **A dependência é só técnica?** Sim, pelas duas respostas acima.
- **Extrair agora ou registrar como dívida?** Registrar como dívida,
  como pedido. O destino de longo prazo mais coerente é uma área
  compartilhada de infraestrutura (ex.: `packages/bdos-core/src/domain/shared/spreadsheet/`
  ou nome equivalente já usado no monorepo) — hoje o arquivo só está
  em `schedule-management/adapters/excel-import/` por ter sido escrito
  primeiro ali, não porque pertence semanticamente ao Project Studio.
  "O guard passou" confirma só que nenhuma regra atual bloqueia — não
  que a fronteira é a ideal a longo prazo.

### 3. Validação financeira do parser — achado bloqueante, não resolvido

A auditabilidade estrutural está confirmada com números exatos (ver
"Resultado estruturado do teste contra o BM_08" abaixo) — 190 abas
reconciliam exatamente, contagem de linhas reconcilia exatamente,
nenhuma linha essencial virou warning por engano (as 6 são rodapé real:
total geral, arredondamento contratual, texto de certificação/assinatura).

**Mas a reconciliação financeira falhou, e não sei ainda por quê.** A
soma de `declaredTotalValue` das 39 linhas extraídas para MED-08 é
R$ 905.974,94; o próprio arquivo declara, no rodapé da mesma aba,
"Importa o presente Boletim de Medição na quantia de R$ 252.654,78" —
uma diferença de R$ 653.320,16, não uma diferença de arredondamento.

Investiguei duas hipóteses e nenhuma resolveu:

- **Hipótese "coluna cumulativa, não por período"**: descartada —
  inspecionei os valores de FISICO de itens reais (ex.: `01.02.02`,
  aluguel de contêiner por mês) ao longo de MED-01..MED-11 e eles não
  são monotonicamente crescentes (1,1,1,3,3,12,6,1,2,0,2) — não é uma
  coluna de acumulado, os valores por período são genuinamente
  independentes.
- **Cruzamento com a aba irmã "BOLETIM FÍSICO FINANCEIRO"**: essa aba
  tem sua própria coluna "NO PERIODO (R$)", mas somar essa coluna
  também não reconcilia (R$ 1.312.562,99) — e pior, essa aba mistura
  linhas agregadoras (que já trazem o total somado dos filhos, ex.:
  `01.00.00` tem `NO PERIODO (R$) = 42.015,69`) com linhas de itens
  folha na mesma coluna. Uma soma ingênua ali dupla-contaria por
  natureza — o que sugere que o modelo contábil real deste arquivo
  envolve hierarquia de rollup, e possivelmente BDI, administração
  local ou outra alocação que ainda não identifiquei.

**Não ajustei a extração para forçar um número mais próximo do
declarado** — isso seria exatamente o tipo de "preencher lacuna
silenciosamente" que este Epic rejeita desde a Sprint 0. O parser
extrai fielmente o que cada célula contém (isso está comprovado); o
que não está comprovado é que meu entendimento de qual célula
representa "o valor financeiro oficial deste item neste período" está
certo.

**Isto bloqueava a aprovação do parser como estava.** Não era um
problema de implementação (o código fazia o que eu quis que fizesse) —
era um problema de eu não ter ainda o modelo contábil correto do
documento.

### 3.1 — Resolução

Investigação com leitura de fórmulas do arquivo real (fora do parser
de produção, só para diagnóstico) encontrou a causa raiz: a aba tem
**duas estruturas financeiras paralelas**, não uma.

- **Bloco "CONTROLE FINANCEIRO – MEDIÇÃO"** (colunas `QUANTITATIVO`/
  `VALOR (R$)`, `H:I` no BM_08) — ligado por fórmula a
  `'BOLETIM FÍSICO FINANCEIRO'!I/M`, reconcilia exatamente com
  `I348 = SUM(I12:I347) = R$ 252.654,78`, com o texto de certificação
  do boletim (`B349`, que lê da mesma célula `I348`) e com
  `RESUMO!I5` (via uma cadeia de soma totalmente independente por
  grupo de EAP). **Esta é a fonte autoritativa.**
- **Grade histórica MED-NN** (`FISICO`/`FINANCEIRO` por período,
  colunas `W:AR`, incluindo `AK:AL` para MED-08) — preenchida à mão,
  sem fórmula, soma bruta `R$ 964.483,89` para MED-08. Diverge da
  fonte oficial em 55 linhas (às vezes tem valor onde a oficial tem
  zero, às vezes o inverso). **Não é autoritativa.**

O parser (`bulletin-sheet-detector.ts`/`bulletin-import.ts`) foi
corrigido para: (1) detectar o bloco oficial **semanticamente** (texto
do cabeçalho "CONTROLE FINANCEIRO – MEDIÇÃO" → `QUANTITATIVO`/`VALOR`,
nunca por posição fixa de coluna) e usá-lo como única fonte de
`ParsedMeasurementLine`; (2) manter a grade MED-NN só como evidência de
auditoria, nunca como fonte — uma divergência vira issue
`historical_grid_not_authoritative` (warning), sem nunca ajustar
nenhum dos dois valores; (3) tratar colunas de texto residual sem
cabeçalho reconhecido (achado real: coluna `N`, texto órfão sem
fórmula, e coluna `A`, marcações manuais "X") como issue
`orphan_legacy_column_detected` (warning, uma por aba, nunca
participam de identidade/descrição); (4) adicionar uma invariante
permanente `official_period_total_mismatch` (**blocking**): a soma das
linhas extraídas do bloco oficial é comparada com o total que o
PRÓPRIO arquivo declara (a linha "TOTAL...", nunca a nossa soma
comparada com ela mesma) — qualquer divergência acima de 1 centavo, ou
a ausência da linha de total, bloqueia a importação em vez de deixar
passar silenciosamente. Contra o BM_08 real: soma das linhas
extraídas = total declarado = R$ 252.654,78, diferença R$ 0,00.

O número intermediário R$ 905.974,94 (mencionado acima) era a soma das
39 linhas que o parser *anterior* considerava medíveis, lendo a coluna
errada — não é um terceiro valor financeiro do documento, é evidência
do comportamento defeituoso já corrigido; não deve aparecer em UI
futura, só a comparação entre valor oficial e grade histórica.

## A. Estado atual

### O que já existe e pode ser reaproveitado sem mudança

- **Schema** (Sprint 3, aplicado): `work_packages`, `managed_service_items`,
  `measurement_bulletin_imports`, `measurement_workspaces`,
  `measurement_workspace_lines`, `measurement_bulletins`. RLS,
  triggers de imutabilidade, GRANTs — tudo já validado com sessão real.
- **Domínio** (`packages/bdos-core/src/domain/`): `work-package-management`
  (`createWorkPackage`), `service-item-management` (dormant, mas
  completo), `measurement-workspace` (`createMeasurementWorkspace`,
  `addMeasurementWorkspaceLine`, `removeMeasurementWorkspaceLine`,
  `updateMeasurementWorkspaceLineQuantity`,
  `advanceMeasurementWorkspaceStatus`, `summarizeMeasurementWorkspace`),
  `bulletin-generator` (`createMeasurementBulletin`,
  `validateMeasurementBulletin`, `finalizeMeasurementBulletin`,
  `summarizeMeasurementBulletin`) — todas essas funções já existem,
  testadas, prontas para orquestração; nenhuma precisa ser escrita.
- **Padrão de upload resiliente** (Epic 18): `prepare-upload` →
  upload direto ao Storage → `upload-complete` → `process`. Reaproveitar
  literalmente — o BM_08 real (~5,2MB) tem o mesmo problema de tamanho
  que motivou aquele desenho.
- **Convenções de `apps/web/lib/bdos/repository.ts`**: funções `const
  ... = async (supabase, params) => {...}`, tipos `XRecord`/`XStatus`
  exportados, `getSupabaseRouteHandlerClient()` nas rotas.

### O que NÃO existe e é o trabalho genuinamente novo desta sprint

- **Nenhuma função de repository** para as 6 tabelas novas.
- **Nenhum endpoint** de medição.
- **Nenhum adapter que leia a estrutura real do BM_08.** Isto é
  diferente de tudo que o Epic 18/Fase 2-3 já cobriu: o
  `excel-import.ts` do Project Studio nunca soube ler o layout
  "Boletim de Medição" (cabeçalho em 2 linhas, colunas `MED-NN`
  pareadas FÍSICO/FINANCEIRO) — e, por decisão do Epic 19 (achado da
  Sprint 0), **não deveria** aprender: essa lógica pertence ao domínio
  de medições, não a `schedule-management`. Este adapter é código novo,
  não uma extensão de nada existente.

## B. Fluxo completo e desenho de endpoints

```
prepare-upload
  → measurement_bulletin_imports (pending_upload)
  → upload direto ao Storage (mesmo padrão Epic 18)
upload-complete
  → measurement_bulletin_imports (uploaded)
process
  → parser do Boletim de Medição (código novo)
  → find-or-create work_packages (por normalized_code)
  → find-or-create managed_service_items
  → cria measurement_workspaces (Draft/InProgress)
  → cria measurement_workspace_lines (quantity/unit_value calculados,
    declared_* preenchidos quando o Excel divergir)
  → measurement_bulletin_imports (completed | failed)
[revisão humana, fora do escopo de API — UI da Sprint 5+]
close-workspace
  → measurement_workspaces (Closed) — trigger bloqueia edição depois
generate-bulletin
  → workspace Closed → createMeasurementBulletin (domínio) →
    measurement_bulletins (Draft)
finalize-bulletin
  → measurement_bulletins (Finalized) — trigger bloqueia qualquer
    UPDATE depois
```

### Proposta de fases (mesmo espírito do 18.0-18.3)

| Sub-sprint | Entrega | Depende de |
|---|---|---|
| **19.4A** | Repository layer completo (as 6 tabelas) | Sprint 3 (feito) |
| **19.4B** | `prepare-upload`/`upload-complete` (reuso literal do padrão Epic 18) | 19.4A |
| **19.4C** | Parser do Boletim de Medição — só a função pura, testada isoladamente, sem endpoint ainda | nenhuma (paralelo a 19.4A/B) |
| **19.4D** | `process` — orquestra parser (19.4C) + repository (19.4A), cria Workspace/Lines | 19.4A, 19.4B, 19.4C |
| **19.4E** | `close-workspace`, `generate-bulletin`, `finalize-bulletin` | 19.4A, 19.4D |

Recomendo esta ordem porque **19.4C é o único item de risco real**
(a lógica de leitura do layout real do BM_08, nunca testada em código
antes) — isolá-lo como sua própria sub-sprint, testável sem depender
de upload/Storage/API, segue a mesma disciplina que separou
`sheet-type-detector.ts` de `excel-import.ts` no Epic 18/Fase 1.

**Proponho começar por 19.4A + 19.4C em paralelo** (repository é
mecânico e de baixo risco; o parser é o item que precisa de mais
iteração) e só then 19.4B/D/E. Mas isso é uma recomendação de
sequenciamento, não uma decisão sua ainda — posso ajustar a ordem se
preferir.

## C. Lista exata de arquivos a criar

**19.4A — Repository:**
- `apps/web/lib/bdos/measurement-repository.ts` (arquivo próprio, não
  dentro de `repository.ts` — este já tem 380+ linhas cobrindo
  Project/Execution/Advisor; misturar Medições ali contrariaria a
  separação por domínio que o resto do bdos-core já pratica)
  - `insertMeasurementBulletinImport`, `getMeasurementBulletinImportById`, `updateMeasurementBulletinImportStatus`
  - `findOrCreateWorkPackage` (by `normalized_code`, ver regra de identidade 19.2B)
  - `findOrCreateManagedServiceItem`
  - `insertMeasurementWorkspace`, `insertMeasurementWorkspaceLine`
  - `getMeasurementWorkspaceById`, `updateMeasurementWorkspaceStatus`
  - `insertMeasurementBulletin`, `updateMeasurementBulletinStatus`

**19.4B — Upload endpoints:**
- `apps/web/app/api/measurement/imports/prepare-upload/route.ts`
- `apps/web/app/api/measurement/imports/upload-complete/route.ts`

**19.4C — Parser (domínio, não app):**
- `packages/bdos-core/src/domain/measurement-workspace/adapters/excel-import/` (pasta nova, mesmo padrão de `schedule-management/adapters/excel-import/`)
  - `xlsx-reader.ts` — **reaproveitado**, é neutro (Epic 18 já documentou isso: "não é um parser de propósito geral", sem significado de negócio), só copiado/importado, não reescrito
  - `bulletin-sheet-detector.ts` — novo, específico do layout "Boletim de Medição" (cabeçalho 2 linhas, `MED-NN`)
  - `bulletin-import.ts` — novo, extrai `WorkPackage`/`ManagedServiceItem`/linhas
  - `bulletin-sheet-detector.test.ts`, `bulletin-import.test.ts`

**19.4D — Process endpoint:**
- `apps/web/app/api/measurement/imports/process/route.ts`

**19.4E — Workspace/bulletin lifecycle endpoints:**
- `apps/web/app/api/measurement/workspaces/[id]/close/route.ts`
- `apps/web/app/api/measurement/workspaces/[id]/generate-bulletin/route.ts`
- `apps/web/app/api/measurement/bulletins/[id]/finalize/route.ts`

Nenhuma UI nesta sprint — fica para depois, mesma ordem do Epic 18.

## D. Riscos e compatibilidade

1. **O parser (19.4C) é o único item genuinamente novo e de risco.**
   O restante é reaproveitamento de padrões já validados
   (upload resiliente, RLS, domínio já escrito). Recomendo validar o
   parser contra o BM_08 real antes de escrever qualquer endpoint —
   mesma disciplina de `sheet-type-detector.test.ts` reproduzindo o
   caso real antes do código de produção.
2. **`find-or-create` de `WorkPackage`/`ManagedServiceItem` precisa de
   concorrência considerada**: dois requests `process` simultâneos
   para o mesmo projeto poderiam tentar criar o mesmo `normalized_code`
   ao mesmo tempo. A `UNIQUE (engineering_project_id, normalized_code)`
   já existente em `work_packages` protege contra duplicata, mas o
   código do repository precisa tratar a violação de unicidade como
   "já existe, buscar e usar" (`ON CONFLICT DO NOTHING` + `SELECT`,
   não deixar o erro subir).
3. **`generate-bulletin` precisa decidir `bulletin_number`.** A
   `UNIQUE (engineering_project_id, bulletin_number)` existe, mas
   nenhuma função ainda decide qual número usar — provavelmente
   `MAX(bulletin_number) + 1` por projeto, calculado no momento da
   geração. Não decidido aqui, fica para o desenho de 19.4E.
4. **Nenhuma mudança no Project Studio.** Mesma regra da Sprint 2:
   `schedule-management`/`bba-project-import` continuam sem saber que
   Boletim de Medição existe.

## Sprint 4.0 — Contract Freeze (concluída)

Congela, antes de qualquer implementação de 4A/4C, tudo que os dois
lados (parser e Application Service) precisam concordar para não
cristalizar contratos incompatíveis em paralelo.

### Decisão local: Application Service é obrigatório neste domínio

> A camada de Application Service é obrigatória no Measurement Studio
> porque seus casos de uso coordenam múltiplos aggregates,
> reconciliação, idempotência, numeração e transições de estado. Nesta
> Sprint, ela é um padrão ratificado para o domínio de Medições, não
> uma refatoração obrigatória e retroativa do Epic 18 (cujo
> `process/route.ts` chama repository diretamente, sem esta camada)
> nem uma regra global automática para todo o repositório.
>
> O Epic 19 estabelece um precedente a ser considerado em futuros
> fluxos que também possuam orquestração complexa. A adoção global
> deverá ser decidida separadamente, com evidência de necessidade.

Fluxo obrigatório: `Route Handler → Application Service → Parser ou
Repository`. Nunca `Route Handler → Repository` direto; nunca `Parser
→ INSERT`.

### Contrato do parser

`packages/bdos-core/src/domain/measurement-workspace/adapters/excel-import/bulletin-import.types.ts`
(criado, só tipos). `ParsedMeasurementBulletin` é o objeto que o
parser entrega — nunca IDs de banco, `companyId`,
`engineeringProjectId`, número oficial, datas oficiais, status de
aggregate, decisão de fechamento ou aceitação de divergência. Pontos
que a revisão exigiu explicitamente:

- **`skippedSheets: ReadonlyArray<ParsedSkippedSheet>`**, com
  `ParsedSkippedSheetReason` fechado (7 valores: `hidden_sheet_not_selected`,
  `calculation_memory_deferred`, `unsupported_layout`, `empty_sheet`,
  `duplicate_candidate`, `summary_sheet_not_measurement_lines`,
  `non_measurement_sheet`) — nenhuma categoria especulativa, só as que
  o BM_08 real já demonstra existir.
- **`source.inspectedSheetCount`/`source.selectedSheets`** — permite
  verificar "190 abas inspecionadas, 2 usadas, X descartadas com
  motivo" em vez de o resultado parecer completo tendo examinado só
  uma fração do workbook.
- **Períodos nunca colapsados**: `declaredBulletinNumber` (número do
  boletim declarado), `declaredPeriod.labels` (rótulos brutos como
  "MED-08", preservados como estão) e `declaredPeriod.startDate`/`endDate`
  (só preenchidos se o arquivo efetivamente declarar datas) são três
  campos independentes — nunca deduzidos um do outro, mesmo quando
  coincidem neste arquivo específico. `declaredPeriodNumber` **não**
  entra no contrato agora — não há evidência de que o arquivo declare
  um período numérico distinto dos rótulos/número de boletim que já
  justifique preservá-lo à parte.
- **`declaredQuantity`/`declaredUnitValue`/`declaredTotalValue`** por
  linha, mais `sourceLocation` (`sheetName`/`rowNumber`/`physicalColumn`/`financialColumn`)
  — toda divergência é rastreável até a célula real.

### Contrato dos Application Services

`packages/bdos-core/src/services/measurement-bulletin-import/measurement-bulletin-import.types.ts`
(criado, só tipos). Seis casos de uso, cada um com input/output/erros
tipados: `prepareMeasurementBulletinUpload`,
`confirmMeasurementBulletinUpload`, `processMeasurementBulletinImport`,
`closeMeasurementWorkspace`, `generateMeasurementBulletin`,
`finalizeMeasurementBulletin`.

**Mapa de erros** (por caso de uso, ver o arquivo de tipos para o
detalhe): `prepare` — `unsupported_file_type`/`file_too_large`;
`confirm` — `import_not_found`/`invalid_status_for_confirmation`/`upload_not_found`;
`process` — `import_not_found`/`download_failed`/`parse_failed` (mais
o mapa de retomada abaixo, que não são erros); `close` —
`workspace_not_found`/`invalid_status_for_close`; `generate` —
`workspace_not_found`/`workspace_not_closed`/`no_lines_to_generate`/`bulletin_number_conflict`;
`finalize` — `bulletin_not_found`/`invalid_status_for_finalize`.

**Mapa de idempotência de `processMeasurementBulletinImport`**
(congelado como tipo `ProcessMeasurementBulletinImportOutcomeKind`,
implementação completa fica para 19.4D):

| Estado observado | `outcome.kind` |
|---|---|
| Import já `completed` | `already_completed` — devolve o workspace existente, nunca reprocessa |
| Import `processing` | `already_processing` — recusa, evita concorrência |
| Import `failed` com workspace parcial já vinculado (via `uq_measurement_workspaces_bulletin_import`) | `resumed` — retoma do workspace existente, nunca cria um segundo |
| Workspace vinculado `Closed` | `workspace_closed` — nunca reprocessa nem altera |
| Workspace vinculado `Cancelled` | `workspace_cancelled` — nunca ressuscita automaticamente |
| Nenhum dos casos acima | `completed` (sucesso) ou `failed` (erro genuíno) |

Concorrência de `find-or-create` (`WorkPackage`/`ManagedServiceItem`):
tentar localizar → tentar inserir → em `unique_violation` (`23505`),
reler o existente → nunca criar identidade alternativa nem gerar
código novo silenciosamente. Mesmo protocolo para o próprio workspace,
agora que `uq_measurement_workspaces_bulletin_import` existe.

**Regra de numeração** (`generateMeasurementBulletin`): o parser só
entrega `declaredBulletinNumber` (o que o arquivo afirmava). O
Application Service decide o número oficial — se não colidir com
nenhum boletim já existente no projeto, pode ser adotado; se colidir
ou estiver ausente, atribui `MAX(bulletin_number) + 1` por projeto e
sinaliza via `bulletin_number_conflict`, nunca sobrescreve
silenciosamente.

### Migration e testes de schema

`supabase/migrations/20260711040000_bdos_measurement_workspace_declared_fields.sql`,
aplicada em produção (dry-run confirmado antes):

- `measurement_workspaces` ganha `declared_bulletin_number INT`
  (`CHECK > 0` quando não nulo), `declared_period_start DATE`,
  `declared_period_end DATE` (`CHECK` de consistência entre os dois).
  `COMMENT ON COLUMN` em cada uma, repetindo a distinção
  declarado/oficial mesmo fora deste documento.
- Índice único parcial `uq_measurement_workspaces_bulletin_import` —
  um `measurement_bulletin_imports` origina no máximo um
  `measurement_workspaces`; `NULL` (Caminho A, nativo) continua
  permitindo múltiplos workspaces sem colisão entre si.

`supabase/tests/measurement/workspace-declared-fields.test.mjs` — 7
testes, sessão autenticada real, mesma estratégia das suítes
anteriores: workspace nativo com `NULL` aceito, múltiplos nativos
aceitos, segundo workspace para o mesmo import rejeitado (`23505`),
campos declarados nulos aceitos, `declared_bulletin_number <= 0`
rejeitado (`23514`), período declarado invertido rejeitado (`23514`),
período declarado e oficial armazenados de forma independente
(diferentes um do outro, ambos persistidos). Rodado 3 vezes seguidas,
7/7 nas três. A suíte anterior (`bulletin-finalization-guard.test.mjs`,
15 testes) foi re-executada depois desta migration para confirmar
ausência de regressão — 15/15.

## Resultado estruturado do teste contra o BM_08 real

Não gerei um documento separado — é o output de um script de
diagnóstico (descartado depois, mesma disciplina de todo o Epic 18/19)
rodado com `npx tsx` a partir de `packages/bdos-core`, usando o
arquivo real (`BM_08_LAGOA DO ARROZ _R_00.xlsx`, não commitado).
**Atualizado após a correção da 3.1** — números abaixo já refletem o
parser corrigido (bloco oficial, não a grade histórica).

```
bulletinNumber: 8
declaredPeriod: { startDate: "2026-06-01", endDate: "2026-06-30", labels: [MED-01..MED-11] }
selectedSheet: "BOLETIM DE MEDIÇÃO 08"
inspectedSheetCount: 190
officialPeriodColumn: bloco "CONTROLE FINANCEIRO – MEDIÇÃO" -> QUANTITATIVO (H) / VALOR (R$) (I)

workPackages: 336 (300 folha + 36 agregadores)
serviceItems: 300
measurementLines: 15  (itens com quantidade E/OU valor oficial ≠ 0/nulo --
                        critério combinado, não "quantidade=0 descarta")

soma financeira das linhas importadas: R$ 252.654,78
total declarado pelo próprio arquivo (linha "TOTAL GERAL (R$)"): R$ 252.654,78
diferença: R$ 0,00  -- official_period_total_mismatch não disparou.

grade histórica MED-08 (W:AR, auditoria, não usada como fonte):
  soma bruta: R$ 964.483,89 -- diverge da oficial em R$ 711.829,11,
  reportado como historical_grid_not_authoritative (warning).

issues (8, todas warning neste arquivo real -- nenhuma blocking):
  missing_work_package_code: 1        (linha "ARREDONDAMENTO CONTRATUAL", sem código)
  unrecognized_line: 5                 (TOTAL GERAL + 4 linhas de texto de
                                         certificação/assinatura, sem nome)
  historical_grid_not_authoritative: 1
  orphan_legacy_column_detected: 1     (colunas A -- 61 marcações "X", 0
                                         coincidências -- e N -- 256 valores,
                                         93 coincidências -- reportadas
                                         separadamente na mesma issue)

skippedSheets por motivo (189 total, 190 inspecionadas - 1 selecionada):
  hidden_sheet_not_selected: 172
  calculation_memory_deferred: 15
  summary_sheet_not_measurement_lines: 1  (aba "RESUMO")
  duplicate_candidate: 1                   (aba "BOLETIM FÍSICO FINANCEIRO")
  -- as 7 razões congeladas na Sprint 4.0 são um union type TypeScript;
     nenhum valor fora desse conjunto é sequer compilável, não só
     "não observado neste arquivo" -- é uma garantia do compilador,
     não uma observação empírica.
```

**Reconciliação de linhas (nada some em silêncio)**: 926 linhas de
dado varridas na aba = 336 classificadas (viraram `workPackages`) + 6
parciais (viraram `issues`) + 584 em branco (ausência real, sem código
nem nome — não é perda). Os três números somam exatamente 926.

**Como agregador é diferenciado de medível**: ausência de valor na
coluna `UND.` (unidade) — confirmado contra o arquivo real: linhas
como `01.00.00`/`01.01.00` (grupos) não têm unidade; `01.01.01`
("CAPINA MANUAL", M2) tem. 36 agregadores, 300 medíveis, soma 336,
bate com `workPackages.length`.

**Células de erro/fórmula**: o arquivo real tem células `#REF!` (vistas
em outro bloco da mesma aba, colunas 14/15 de "CONTROLE FINANCEIRO —
MEDIÇÃO", não usado por este parser). Nas colunas do período alvo
(MED-08, colunas 36/37), zero células `#REF!` foram encontradas —
`readNumber` trata qualquer célula não-numérica como `null` (nunca
inventa um número), então mesmo se houvesse, o resultado seria `null`,
nunca um valor incorreto.

**Percentual/measurement_type**: nenhum item do catálogo tem unidade
que sugira medição por percentual (`%`) — todos os 300 `serviceItems`
têm unidade física real (M2, M, M3, UNID, etc.). O parser não infere
`measurementType` do arquivo (todo item nasce implícito como
`quantity`, o `DEFAULT` do schema) — não é um bug, é um gap real: se
algum boletim futuro tiver itens medidos por percentual, esta versão
do parser não os distingue. Registrado como lacuna conhecida, não
resolvida nesta sprint (o BM_08 real não expôs a necessidade ainda).

## O que não é decidido aqui, aguardando aprovação

- Ordem exata de implementação dentro de 19.4A/4C (ambas liberadas
  para começar em paralelo agora que o contrato está congelado).
- Se `generate-bulletin`/`finalize-bulletin` (19.4E1) entram na mesma
  rodada de 4B/4D ou ficam para depois de validar o parser contra o
  BM_08 real — a divisão 19.4E1 (ciclo mínimo) vs. 19.4E2 (experiência
  completa) já está decidida; só o sequenciamento exato de 4E1 frente
  a 4B/4D permanece em aberto.
