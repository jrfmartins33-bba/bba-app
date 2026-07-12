# Epic 19 — Sprint 4B: Upload Resiliente (desenho, pré-implementação)

> Mesma disciplina do Epic 18 e do resto do Epic 19: desenho primeiro,
> aprovação por escrito, código depois. Responde às 8 perguntas
> levantadas na conversa anterior. **Nada aqui foi implementado ainda.**

## Por que este documento é curto

A 19.4D já existe e já foi validada ponta a ponta contra o BM_08 real.
A 19.4B não é mais "o Epic" — é a camada de entrada de um pipeline que
já funciona. O trabalho real desta sprint é **reaproveitar o padrão do
Epic 18 quase inteiro**, trocando `planning_imports` por
`measurement_bulletin_imports` e — a única diferença estrutural
real — inserindo a camada de Application Service que o Measurement
Studio exige e que o Epic 18 nunca teve.

---

## 1. Reuso do Epic 18

### Reaproveitado verbatim (nenhuma cópia, import direto)

| Arquivo | O que fornece |
|---|---|
| `apps/web/lib/bdos/repository.ts` — `ensureEngenhariaWorkspace` | Garante/lê a workspace tipo "engenharia" da empresa. Genérico — não pertence ao Project Studio, opera em `workspaces`, tabela compartilhada. |
| `apps/web/lib/bdos/repository.ts` — `ensureDefaultEngineeringProject` | Garante/lê o projeto de engenharia default da empresa (mesma limitação já documentada: "um projeto por empresa"). Opera em `engineering_projects`, também compartilhada. |
| `@/lib/supabase/server` — `getSupabaseRouteHandlerClient`, `requireAuthenticatedCompany` | Autenticação/sessão — infraestrutura transversal, não é regra de negócio de nenhum Studio. |
| `@/lib/supabase/browser` (o helper que o componente de import do bba-project já usa) | Cliente Supabase do browser, para o upload direto ao Storage. |
| Bucket `bdos-imports` + RLS já existente | `supabase/migrations/20260707190000_bdos_storage.sql` já autoriza upload direto por `company_id` no primeiro segmento do path — já genérico, já usado pelo desenho da 19.4D.0 (Parte III do desenho anterior). Nenhuma migration nova. |
| Constante `MAX_STANDARD_UPLOAD_BYTES` (~6 MB) | Mesmo valor, mesmo raciocínio (recomendação da Supabase para upload não-resumível, não um teto tecnicamente imposto). Redeclarada no novo arquivo, não importada de dentro de uma rota (rota nunca deveria ser importada por outra coisa) — mesmo padrão já usado para `TOTAL_DIFFERENCE_TOLERANCE`/`RECONCILIATION_EPSILON` na 19.4D.2. |

### Reaproveitado como padrão, não como arquivo (motivo: tabela e camada diferentes)

| Arquivo Epic 18 | Equivalente novo | Por que não é o mesmo arquivo |
|---|---|---|
| `app/api/bba-project/imports/prepare-upload/route.ts` | `app/api/measurement/imports/prepare-upload/route.ts` | Tabela diferente (`measurement_bulletin_imports`), e — diferença estrutural real — chama uma Application Service, não o repository direto (ver seção 6). |
| `app/api/bba-project/imports/upload-complete/route.ts` | `app/api/measurement/imports/upload-complete/route.ts` | Mesmo motivo. |
| `app/api/bba-project/imports/process/route.ts` | Já existe o Application Service (`processMeasurementBulletinImport`, 19.4D.2); falta só a rota fina que o expõe. | A 19.4D.2 já fez o trabalho pesado — esta rota é a mais simples das três. |
| `apps/web/lib/bdos/repository.ts` — `insertPlanningImport`/`getPlanningImportById`/`updatePlanningImportStatus` | Já existem os equivalentes (`insertMeasurementBulletinImport`/`getMeasurementBulletinImportById`/`updateMeasurementBulletinImportStatus`/`claimMeasurementBulletinImportForProcessing`), construídos na 19.4D.0/D.1. **Nenhuma função nova de repository é necessária para a 19.4B.** |
| `bba-project-workspace-experience.tsx` (a função `runImport`) | Equivalente próprio no futuro componente do Measurement Studio (fora do escopo desta sprint — ver seção 8) | Mesmo padrão de 4 chamadas (`prepare-upload` → upload direto → `upload-complete` → `process`), UI diferente. |

**Nenhuma duplicação sem justificativa**: as três rotas são arquivos
novos porque rotas Next.js são por definição por caminho, não
compartilháveis entre domínios — mas o *corpo* de cada uma é fino o
suficiente (parsing de request + chamada a uma função) que a
duplicação real de lógica é próxima de zero.

---

## 2. O que muda

| Epic 18 | Measurement Studio (19.4B) |
|---|---|
| `planning_imports` | `measurement_bulletin_imports` (já existe, Sprint 4.0/4A) |
| `PlanningImportRecord` | `MeasurementBulletinImportRecord` (já existe, 19.4D.1 — já inclui `analysisResult`) |
| `sourceType: "ms-project-xml" \| "excel"` (dois formatos possíveis) | Nenhum campo equivalente — só existe um parser (`dnocs-measurement-bulletin-v1`, R6 do desenho anterior: não construir seleção de parser sem um segundo parser real). Validação de tipo fica só extensão/MIME `.xlsx`, sem a etapa de "detectar entre dois formatos". |
| `detectPlanningImportSourceType`/`sniffPlanningImportSourceTypeFromBytes` | Sem equivalente nesta sprint — não há dois formatos para desambiguar. Se um dia houver um segundo layout de boletim (R6), essa necessidade reaparece e ganha peça própria. |
| Rota chama `repository.ts` direto | Rota chama uma **Application Service** (`prepareMeasurementBulletinUpload`/`confirmMeasurementBulletinUpload`), que só então chama o repository — ver seção 6. |
| `storagePath = ${companyId}/${projectId}/${importId}/${fileName}` | `storagePath = ${companyId}/measurement/${projectId}/${importId}/${fileName}` — segmento `measurement/` a mais, já congelado na Parte III do desenho da 19.4D. |
| Mensagens de erro em português, específicas do Project Studio | Mensagens próprias do Measurement Studio (nunca "planejamento", nunca reaproveitar string literal do bba-project). |

---

## 3. O que NÃO muda

- Upload direto do browser para o Storage (nenhum byte passa pela
  Vercel Function) — mesmo RLS, mesmo bucket `bdos-imports`.
- Processamento por referência (`measurementBulletinImportId` opaco;
  nunca `storagePath` vindo do cliente).
- Máquina de estados linear de 5 valores
  (`pending_upload → uploaded → processing → completed/failed`), sem
  tabela de histórico — mesma decisão já tomada e já registrada por
  `COMMENT ON COLUMN` na migration (Sprint 4.0/4A).
- Idempotência: `status` já `uploaded`/`processing`/`completed` em
  `upload-complete` → resposta idempotente, nunca erro. `status` já
  `completed` em `process` → `already_completed`, devolve o
  `analysisResult` persistido (19.4D.2 já implementa isso).
- Tratamento explícito de 413 antes de `response.json()` no cliente
  (mesmo bug de UX do Epic 18 evitado desde o início aqui).
- UX em duas etapas visuais (upload → processamento), mesmo padrão de
  `phase` já usado em `bba-project-workspace-experience.tsx`.
- Rota antiga não existe para medição (nunca houve um
  `/api/measurement/import` de upload direto) — não há nada para
  manter em paralelo aqui.
- Sem tabela de histórico de status, sem signed URL própria, sem
  upload resumível (TUS) — mesmas dívidas já aceitas e documentadas
  para o Epic 18, valem aqui pelo mesmo raciocínio.

---

## 4. Endpoints

### `POST /api/measurement/imports/prepare-upload`

```
→ { engineeringProjectId?, fileName, contentType, sizeBytes }
← 200 { measurementBulletinImportId, storagePath }
← 400 { error: "invalid_prepare_upload_body" }
← 400 { error: "unsupported_file_type" }        (não é .xlsx)
← 413 { error: "file_too_large" }                (> ~6 MB)
← 409 { error: "project_id_mismatch" }           (se enviado e diferente do resolvido)
← 401 { error: "unauthenticated" }
← 500 { error: "prepare_upload_failed" }
```

`unsupported_file_type`/`file_too_large` são exatamente os dois
códigos já congelados em `PrepareMeasurementBulletinUploadErrorCode`
(Sprint 4.0) — a rota não inventa nenhum código novo.

### `POST /api/measurement/imports/upload-complete`

```
→ { measurementBulletinImportId }
← 200 { status: "uploaded" }
← 200 { status: "processing" | "completed" }     (idempotente, já foi além)
← 404 { error: "import_not_found" }
← 409 { error: "invalid_status_for_confirmation" }
← 409 { error: "upload_not_found" }              (storage.list() não achou o objeto)
← 401 { error: "unauthenticated" }
```

Os três códigos de erro já são exatamente
`ConfirmMeasurementBulletinUploadErrorCode` (Sprint 4.0).

### `POST /api/measurement/imports/process`

```
→ { measurementBulletinImportId }
← 200 ProcessMeasurementBulletinImportResult    (já congelado, 19.4D.2 já implementa)
← 401 { error: "unauthenticated" }
```

Sem contrato novo — a rota só desembrulha `request.json()`,
valida o shape, e devolve exatamente o que
`processMeasurementBulletinImport` já devolve. Nenhum campo
reformatado, nenhuma reinterpretação.

---

## 5. Estados

```
pending_upload
    │  prepare-upload: valida extensão/MIME/tamanho, resolve o
    │  projeto, INSERT com status='pending_upload' (default do schema)
    ▼
    │  browser faz upload direto ao Storage via RLS
    ▼
uploaded
    │  upload-complete: storage.list() confirma o objeto, UPDATE
    │  pending_upload -> uploaded
    ▼
    │  cliente chama process
    ▼
processing
    │  claim atômico (já implementado, 19.4D.2/correção 4) — SE outra
    │  chamada já reivindicou, o cliente recebe already_processing,
    │  nunca um estado pulado
    ▼
completed | failed
    (failed permite nova chamada a process -- volta para processing
    via claim atômico; nunca uma segunda linha, nunca um estado
    inventado)
```

Nenhuma rota pula estado: `upload-complete` recusa
(`invalid_status_for_confirmation`) se o import não estiver em
`pending_upload`; `process` já trata todos os outros casos
(`already_completed`/`already_processing`/`resumed`/
`workspace_ready_for_review`/etc., 19.4D.2) sem exigir mudança
nenhuma aqui.

---

## 6. Onde o Application Service entra — o ponto que difere de verdade do Epic 18

```
prepare-upload/route.ts
        │
        ▼
prepareMeasurementBulletinUpload()   ← Application Service, novo
        │
        ▼
insertMeasurementBulletinImport()    ← repository, já existe

upload-complete/route.ts
        │
        ▼
confirmMeasurementBulletinUpload()   ← Application Service, novo
        │
        ├──▶ getMeasurementBulletinImportById()      ← repository, já existe
        ├──▶ supabase.storage.list()                 ← única exceção (Storage, não tabela — mesmo padrão já aceito em process, 19.4D.2)
        └──▶ updateMeasurementBulletinImportStatus()  ← repository, já existe

process/route.ts
        │
        ▼
processMeasurementBulletinImport()   ← Application Service, já existe (19.4D.2)
        │
        ▼
repository + storage.download() + parser   (já implementado)
```

**Nunca** `route.ts → repository` direto, em nenhuma das três rotas —
diferente do Epic 18, onde `prepare-upload`/`upload-complete` chamam
`repository.ts` sem intermediário. Isso não é regredir o Epic 18 (o
próprio contrato de Sprint 4.0 já registra essa diferença como
deliberada: "Não é uma regra retroativa para o Epic 18"). É a mesma
disciplina que a 19.4D.2 já aplica a `processMeasurementBulletinImport`,
estendida às duas peças que faltavam.

`prepareMeasurementBulletinUpload`/`confirmMeasurementBulletinUpload`
vivem em `apps/web/lib/bdos/measurement-bulletin-upload-service.ts`
(arquivo novo, separado de `measurement-bulletin-import-service.ts` —
que já tem ~740 linhas cuidando só do processamento; ciclo de vida do
upload é uma responsabilidade distinta, mesmo raciocínio de separação
já usado entre `measurement-repository.ts` e o Application Service).

### Decisão confirmada: Opção A

`PrepareMeasurementBulletinUploadInput.engineeringProjectId` já está
congelado como `string` **obrigatório** (Sprint 4.0). A rota resolve o
projeto (`ensureEngenhariaWorkspace` + `ensureDefaultEngineeringProject`,
chamadas em `prepare-upload/route.ts`, exatamente como no Epic 18) e só
então chama `prepareMeasurementBulletinUpload(supabase, { ..., engineeringProjectId })`
já com o contexto de negócio resolvido.

### Princípio — Resolução de Contexto

> A resolução de identidade da empresa, Workspace, projeto padrão e
> demais recursos dependentes da sessão pertence à camada HTTP/
> Application Boundary (a rota). As Application Services recebem esse
> contexto já resolvido (`companyId`, `engineeringProjectId`,
> `measurementBulletinImportId`) e operam exclusivamente sobre regras
> de negócio — nunca descobrem sessão, nunca localizam ou criam
> projeto/workspace padrão, nunca sabem como a autenticação funciona.

Não é regra nova inventada para esta sprint — é o mesmo raciocínio que
já justifica `requireAuthenticatedCompany` sendo chamada na rota, nunca
dentro de um Application Service. Ficou explícito aqui porque, ao
contrário de autenticação, "resolver o projeto padrão" *parece*
regra de negócio à primeira vista (por isso a pergunta ficou em
aberto) — e por isso vale nomear o princípio, não só aplicá-lo
silenciosamente. Aplica-se a qualquer Studio futuro que replicar este
padrão de ingestão (Contratos, Orçamento, Evidências, Financeiro):
`Route → Resolve contexto → Application Service → Repository`, nunca
`Application Service → descobre sessão/projeto/workspace`.

---

## 7. O que a UI recebe

Nunca `"Importado com sucesso"`. O contrato de `process` já devolve
tudo que a UI precisa, sem reinterpretar Excel:

```ts
ProcessMeasurementBulletinImportResult =
  | {
      success: true;
      outcome: {
        kind: "completed" | "resumed" | "already_completed" | ...;
        measurementWorkspaceId: string | null;
        issues: MeasurementImportIssue[];
        analysisResult: MeasurementAnalysisResult | null;  // já é a "Análise do Boletim de Medição"
      };
    }
  | { success: false; error: "download_failed" | "parse_failed" | "import_not_found"; analysisResult?: MeasurementAnalysisResult };
```

`measurementBulletinImportId` (que a UI já tem, devolvido pelo
`prepare-upload`) é a referência estável para buscar de novo o mesmo
resultado depois (`already_completed`) — não preciso inventar um
`analysisId` novo. `outcome.measurementWorkspaceId` e
`analysisResult` juntos já são exatamente `workspaceId` + `status` +
`summary` que você pediu, sem exigir nenhum campo novo no contrato
congelado.

---

## 8. E2E

Com o BM_08 real, sem pular etapa, ponta a ponta:

```
1. prepare-upload  → 200, measurementBulletinImportId + storagePath
2. upload direto ao Storage (bucket bdos-imports, mesmo path)
3. upload-complete → 200, status: "uploaded"
4. process         → 200, outcome.kind: "completed",
                      analysisResult.status: "needs_review",
                      officialPeriodTotal = recalculatedTotal = R$ 252.654,78,
                      336 work_packages / 300 managed_service_items / 15 linhas
5. inspeção direta no Supabase: measurement_bulletin_imports.status = 'completed',
   analysis_result preenchido; measurement_workspaces.status = 'InProgress';
   measurement_workspace_lines com source_sheet_name/source_row_number/
   source_physical_column/source_financial_column = H/I preenchidos.
```

Passos 1-4 via chamada HTTP real (não fake client desta vez — é
precisamente o que a 19.4B testa: a integração real via rota, algo
que o fake client da 19.4D.2 nunca exercitou). Sem tela nova nesta
sprint — a "primeira tela uau" (Análise do Boletim de Medição, já
esboçada na conversa anterior) fica para depois deste E2E, como você
já definiu no roadmap.

---

## Critério de aprovação (sua régua, reafirmada)

Nenhuma lógica de negócio nova nas rotas HTTP. As três rotas desta
sprint são, cada uma, put/parse-do-corpo → chamada a uma função →
`NextResponse.json`. Toda decisão (o que é um arquivo válido, quando
idempotência se aplica, quando reivindicar, como reconciliar) já mora
ou na 19.4D.2 (`processMeasurementBulletinImport`) ou nas duas funções
novas e pequenas desta sprint
(`prepareMeasurementBulletinUpload`/`confirmMeasurementBulletinUpload`),
nunca na camada HTTP.

**Nenhuma função nova de repository é necessária.** Nenhuma migration
nova é necessária. O único artefato genuinamente novo é a dupla
`prepareMeasurementBulletinUpload`/`confirmMeasurementBulletinUpload`
— e mesmo essas são, em essência, o mesmo desenho do Epic 18 com uma
camada de indireção a mais.
