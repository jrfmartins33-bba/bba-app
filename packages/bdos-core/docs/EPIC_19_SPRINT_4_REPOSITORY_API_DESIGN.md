# Epic 19 — Sprint 4: Repository & API Design (desenho)

> Mesma disciplina do Epic 18: relatório do estado atual, desenho dos
> endpoints e estados, lista exata de arquivos, riscos — antes de
> qualquer código. **Sprint 4.0 (Contract Freeze) concluída** — ver
> seção própria abaixo: migration aplicada, tipos puros criados,
> testes de schema rodando. 4A (Repository) e 4C (Parser) liberadas
> para desenvolvimento paralelo. 4B/4D/4E ainda não iniciadas.

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

## O que não é decidido aqui, aguardando aprovação

- Ordem exata de implementação dentro de 19.4A/4C (ambas liberadas
  para começar em paralelo agora que o contrato está congelado).
- Se `generate-bulletin`/`finalize-bulletin` (19.4E1) entram na mesma
  rodada de 4B/4D ou ficam para depois de validar o parser contra o
  BM_08 real — a divisão 19.4E1 (ciclo mínimo) vs. 19.4E2 (experiência
  completa) já está decidida; só o sequenciamento exato de 4E1 frente
  a 4B/4D permanece em aberto.
