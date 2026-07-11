# Epic 19 — Sprint 4D: `processMeasurementBulletinImport` (desenho)

> Mesma disciplina do Epic 18 e do restante do Epic 19: desenho completo,
> aprovado por escrito, antes de qualquer código. **Nada aqui foi
> implementado ainda.** Este documento responde às 16 perguntas de
> entrada ratificadas na conversa anterior, mais a pergunta 17
> ("conhecimento reutilizável") e o princípio de separação
> parser/Application Service/domínio/Repository/BDOS. Termina com uma
> seção de opinião estratégica (CPO/Chief Solution Architect) sobre
> diferenciação de mercado — não é neutra de propósito.
>
> Pré-requisitos já congelados e verificados contra o código atual
> nesta sessão: `measurement-bulletin-import.types.ts` (Sprint 4.0),
> `measurement-repository.ts` (Sprint 4A), `bulletin-import.ts`/
> `bulletin-sheet-detector.ts` (Sprint 4C), migrations
> `20260711000000`–`20260711040000`. Nenhum destes é reaberto aqui —
> só referenciado.

## Como este documento está organizado

As 16 perguntas originais não mapeiam 1:1 em seções — várias se
respondem melhor juntas (ex.: idempotência e sua chave). Cada seção
abaixo declara explicitamente quais perguntas cobre. No final há uma
checklist de tudo que precisa de aprovação explícita antes do código.

---

## Parte I — Propriedade de aggregate (perguntas 9 e 10)

**`MeasurementWorkspace` é o aggregate proprietário desta operação.**

Motivos, verificados contra o schema atual:

- É o único aggregate cujo **status** esta operação transiciona
  (Draft → InProgress).
- É o único aggregate cuja **identidade é a chave de idempotência**:
  `uq_measurement_workspaces_bulletin_import` (índice único parcial em
  `measurement_workspaces.measurement_bulletin_import_id`) é
  literalmente o mecanismo que impede duas execuções do mesmo import
  de produzirem dois resultados.
- É o único aggregate que esta operação **cria**.

`MeasurementBulletin` **não** é proprietário aqui — pertence a
`generateMeasurementBulletin` (Sprint 4.0, já congelado), que consome
um Workspace **já Closed**. `processMeasurementBulletinImport` nunca
avança um Workspace além de `InProgress`.

**Aggregates que apenas participam:**

| Aggregate | Papel nesta operação | Observação |
|---|---|---|
| `MeasurementBulletinImport` | Rastreia proveniência e progresso (`pending_upload → uploaded → processing → completed/failed`) | Não tem regra de negócio própria sobre o conteúdo do boletim — só sobre o ciclo de vida do arquivo |
| `WorkPackage` | Encontrado ou criado (find-or-create real, com `UNIQUE` no banco) | Escopo de **projeto**, não de workspace — sobrevive e é reaproveitado por todo boletim futuro do mesmo projeto |
| `ManagedServiceItem` | Encontrado ou criado (correlação heurística, **sem** `UNIQUE` desde a revisão da Sprint 3) | Mesmo raciocínio de escopo de `WorkPackage` |

---

## Parte II — Invariantes (pergunta 11, mais o acréscimo desta sessão: invariantes independentes de parser)

**Antes da operação, sempre verdadeiro:**
- `measurement_bulletin_imports.status ∈ {uploaded, failed}` para prosseguir (`pending_upload` e `processing` recusam; `completed` é idempotente/no-op).

**Depois da operação, sempre verdadeiro — independente de qual parser gerou o `ParsedMeasurementBulletin`:**

1. **Existe no máximo um `MeasurementWorkspace` por import.** Já garantido pelo banco (`uq_measurement_workspaces_bulletin_import`), não apenas pela aplicação — a aplicação nunca pode contornar isso, nem deveria tentar.
2. **Um `MeasurementBulletin` nunca nasce sem um `MeasurementWorkspace`.** Já garantido por FK (`measurement_bulletins.measurement_workspace_id NOT NULL`).
3. **O parser nunca aprova um boletim.** `ParsedMeasurementBulletin.success` (campo já existente) significa apenas "consegui interpretar sem issue bloqueante" — nunca "pode confiar". A decisão de aceitar como `completed`, recusar como `failed`, ou (fora de escopo desta sprint) marcar para revisão obrigatória é exclusivamente desta Application Service, nunca do parser.
4. **Divergências nunca são corrigidas automaticamente.** Herdado do parser (`historical_grid_not_authoritative` nunca ajusta valores) — esta operação nunca "arredonda" `declaredTotalValue` para bater com `totalValue`, nem o contrário.
5. **Toda linha importada mantém rastreabilidade até a célula de origem.** ⚠️ **Gap real, não resolvido hoje** — `ParsedMeasurementLine.sourceLocation` existe no contrato do parser (`sheetName`, `rowNumber`, `physicalColumn`, `financialColumn`), mas `measurement_workspace_lines` **não tem nenhuma coluna para persistir isso**. Ver recomendação R1 na Parte XII.
6. **O total oficial sempre reconcilia com as linhas oficiais ou gera issue bloqueante.** Já implementado no parser (`official_period_total_mismatch`) — esta operação herda a regra: se essa issue (ou `official_measurement_block_not_found`) estiver presente com `severity: "blocking"`, o outcome é sempre `failed`, nunca `completed`, mesmo que 300 das 301 linhas estejam perfeitas.

---

## Parte III — Entrada e contrato de I/O (perguntas 1 e 14)

Já congelado na Sprint 4.0, verificado — reafirmado aqui:

```ts
ProcessMeasurementBulletinImportInput {
  companyId: string;
  measurementBulletinImportId: string;
}
```

Nunca `File`, nunca `storagePath` vindo do cliente. Internamente:

```
measurementBulletinImportId
  → getMeasurementBulletinImportById (repository, já filtra por companyId via RLS + filtro explícito)
  → download por referência do Storage (nunca path informado pelo chamador)
  → bulletin-import.ts (parser)
  → ParsedMeasurementBulletin
```

**Nenhuma entidade de banco atravessa a fronteira do Application
Service.** Nem `Input`, nem `Output`. O `Output` (`ProcessMeasurementBulletinImportResult`) já é 100% DTO — reafirmo aqui que o campo `outcome.measurementWorkspaceId` é uma `string` (o id), nunca o `MeasurementWorkspaceRecord` inteiro.

**Storage:** reaproveita literalmente o bucket `bdos-imports` do Epic 18 (RLS já genérica: `bucket_id = 'bdos-imports' AND (storage.foldername(name))[1] = company_id`). Nenhuma migration nova de Storage é necessária. Path proposto, seguindo o padrão de `planning_imports`:

```
${companyId}/measurement/${engineeringProjectId}/${measurementBulletinImportId}/${fileName}
```

---

## Parte IV — Idempotência: mecânica e chave (perguntas 2 e 12)

**Chave de idempotência: `measurement_bulletin_import_id`.**

Duas camadas, não uma:

1. **Camada de aplicação (barata, primeiro passo sempre):**
   `getMeasurementWorkspaceByImportId` — já existe no repository,
   já documentado como "primitiva de idempotência". Chamada **antes** de
   qualquer download/parse.
2. **Camada de banco (garantia real, não apenas convenção):**
   `uq_measurement_workspaces_bulletin_import`. Mesmo que a camada 1
   falhe por uma condição de corrida (duas chamadas quase simultâneas
   passam pelo `SELECT` antes de qualquer `INSERT`), a segunda
   `insertMeasurementWorkspace` estoura `23505` — nunca duas linhas.

**O que acontece na segunda execução — tabela completa (mapa já
congelado na Sprint 4.0, reproduzido aqui com a mecânica exata):**

| Situação encontrada | `outcome.kind` | O que a operação faz |
|---|---|---|
| `import.status = 'completed'` | `already_completed` | Devolve o workspace já existente. **Nenhum download, nenhum parse.** |
| `import.status = 'processing'` | `already_processing` | Recusa. Não tenta adivinhar se é uma corrida real ou um processo travado (ver Parte VI — claim atômico + dívida registrada de `retryMeasurementBulletinImport`). |
| `import.status = 'failed'` **e** workspace vinculado está `Draft`/`InProgress` | `resumed` | Reprocessa a partir do workspace existente — nunca cria um segundo. Ver Parte V para o que exatamente é reexecutado, incluindo a comparação linha a linha (não mais skip cego). |
| `import.status = 'failed'` **e** workspace vinculado está `ReadyForReview` | `workspace_ready_for_review` **(revisado — ver correção 1 abaixo)** | **Recusa.** O contrato da Sprint 4.0 já congelou que, depois de `ReadyForReview`, processamento automático não pode sobrescrever conteúdo revisado sem ação explícita — isso vale mesmo que a intenção seja "só completar linhas ausentes", porque a operação ainda tocaria um workspace que já entrou em revisão humana. Reprocessar aqui exige um caso de uso próprio e explícito, fora de `processMeasurementBulletinImport`. |
| Workspace vinculado está `Closed` | `workspace_closed` | Nunca reprocessa, nunca muda nada (o trigger do banco recusaria de qualquer forma). |
| Workspace vinculado está `Cancelled` | `workspace_cancelled` | Nunca ressuscita automaticamente — exige decisão humana fora deste caso de uso. |
| Nenhum dos casos acima | `completed` ou `failed` | Fluxo normal (Parte V). |

**Correção 1 (revisão desta sessão): `ReadyForReview` não é mais um modo de retomada automática.** A versão anterior deste documento listava `ReadyForReview` ao lado de `Draft`/`InProgress` como elegível para `resumed`. Isso contradizia o próprio contrato já congelado na 19.4.0. A tabela acima e os passos 3/11 da Parte V refletem a correção: retomada automática (com reconciliação linha a linha) só é permitida em `Draft` ou `InProgress`.

**Sub-idempotência dentro de uma única execução** (já garantida por
código existente, não nova nesta sprint):
`findOrCreateWorkPackage` (insere, captura `23505`, relê) e
`findMatchingManagedServiceItemOrCreate` (busca por código antes de
inserir) já são seguras para chamar repetidamente com a mesma entrada.
`insertMeasurementWorkspaceLine` **precisa** de tratamento explícito de
`23505` nesta sprint (não tem hoje) — ver Parte V, com a correção
abaixo.

**Correção 2 (revisão desta sessão): `23505` não é mais sinônimo de "está tudo certo".**
A versão anterior deste documento tratava a colisão de linha como
skip silencioso — suficiente apenas se a linha existente for
exatamente equivalente ao que seria persistido. Não é: se o parser ou
o catálogo mudou entre a primeira tentativa e o retry, um skip cego
deixaria `MeasurementAnalysisResult` calculado sobre dados novos
enquanto o banco conserva os antigos — resultado de análise
incompatível com o workspace persistido. A partir desta revisão, `23505`
dispara **comparação de valores**, não skip automático — ver passo 11
revisado na Parte V. Isso exige uma primitiva de repository nova:
`getMeasurementWorkspaceLineByWorkspaceAndServiceItem`, mais uma função
explícita de atualização de linha (ambas listadas no sequenciamento
19.4D.1, Parte XII).

---

## Parte V — Ordem da materialização, tratamento de falhas e transação lógica (perguntas 3, 4, 7 e 13)

### Ordem (concreta, não conceitual)

```
1.  getMeasurementBulletinImportById(companyId, id) → 404 se ausente.
2.  Verificar import.status → aplicar a tabela da Parte IV.
    (early-exit para already_completed / already_processing)
3.  getMeasurementWorkspaceByImportId → decide MODO FRESCO ou MODO
    RETOMADA. **Revisado (correção 1):** MODO RETOMADA só se o
    workspace existe e está `Draft` ou `InProgress`. Se estiver
    `ReadyForReview`, early-exit para `workspace_ready_for_review` —
    nunca tratado como retomada, mesmo que a intenção seja apenas
    completar linhas ausentes.
    (early-exit também para workspace_closed / workspace_cancelled)
4.  **Revisado (correção 4): claim atômico do import**, não um
    `UPDATE` incondicional. A função de repository deve executar
    conceitualmente:
    ```sql
    UPDATE measurement_bulletin_imports
    SET status = 'processing'
    WHERE id = ? AND company_id = ? AND status IN ('uploaded', 'failed')
    RETURNING *
    ```
    Se a linha retornada vier vazia, outra execução já reivindicou o
    import entre os passos 2 e 4 — tratar como `already_processing`,
    nunca prosseguir. Duas chamadas simultâneas: uma reivindica, a
    outra recebe `already_processing` — nunca dois parsers
    materializando o mesmo import ao mesmo tempo. Ver Parte VI para a
    dívida registrada de recuperação de `processing` travado por
    crash "sujo".
5.  Download do Storage por referência (nunca path do cliente).
    Falha de download → status='failed', erro download_failed.
6.  bulletin-import.ts → ParsedMeasurementBulletin.
    (o parser nunca lança exceção por design — mas o wrapper trata
    qualquer throw inesperado como parse_failed, defensivamente)
7.  GATE DE RECONCILIAÇÃO (Invariante #6, Parte II) — verificar se
    `official_period_total_mismatch` ou `official_measurement_block_not_found`
    está presente com severity 'blocking'.
    SE SIM → montar `MeasurementAnalysisResult` de falha (Parte X —
    variante `FailedMeasurementAnalysisResult`, sem `measurementWorkspaceId`
    quando o gate recusa antes da criação do workspace em MODO FRESCO) e
    gravar `analysis_result` + `status='failed'` na mesma atualização
    (correção 5, passo 14), outcome 'failed', issues devolvidas,
    NENHUMA linha é materializada. Isto vale tanto em modo fresco
    quanto em retomada — uma retomada nunca "empurra" linhas de uma
    fonte que o próprio parser já reprovou.
8.  Para cada ParsedWorkPackage → findOrCreateWorkPackage.
9.  Para cada ParsedManagedServiceItem → findMatchingManagedServiceItemOrCreate.
    (registrar outcome matched/created de cada um — alimenta o
    MeasurementAnalysisResult, Parte X)
10. MODO FRESCO: insertMeasurementWorkspace (declared_bulletin_number/
    declared_period_start/declared_period_end = verbatim do parser;
    period_number/start_date/end_date = decididos pelo BDOS, Parte IX).
    Colisão 23505 aqui = outra execução venceu a corrida entre os
    passos 3 e 10 → relê via getMeasurementWorkspaceByImportId e cai
    em MODO RETOMADA a partir daqui.
11. Para cada ParsedMeasurementLine → resolver o ManagedServiceItem
    (pelo código, do passo 9) → calcular quantity/unitValue/totalValue
    (SEMPRE quantity * unitValue, reaproveitando a mesma função de
    domínio/arredondamento monetário já usada pelo bulletin-generator —
    nunca multiplicação number × number dispersa no Application
    Service — e NUNCA copiado de declaredTotalValue) →
    insertMeasurementWorkspaceLine (declared_* = verbatim do parser,
    source_* = Parte XII R1).

    **Revisado (correção 2): colisão `23505` em
    `UNIQUE(workspace_id, service_item_id)` não é mais skip
    automático.** Só é possível em MODO RETOMADA (já restrito a
    `Draft`/`InProgress` pela correção 1). Ao colidir:
    - `getMeasurementWorkspaceLineByWorkspaceAndServiceItem` busca a
      linha persistida;
    - comparar `declared_*`/`quantity`/`unit_value`/`total_value`
      pretendidos contra os persistidos;
    - se idênticos → `already_present`, nenhuma escrita nova;
    - se diferentes → atualizar explicitamente a linha (função nova de
      repository, não um segundo `INSERT`) — permitido porque o
      workspace ainda está em `Draft`/`InProgress`, nunca em
      `ReadyForReview` ou posterior (barrado desde o passo 3).
    - Depois da materialização de todas as linhas, **reler as linhas
      persistidas** (não o DTO do parser em memória) para calcular
      `recalculatedTotal` no passo 14 — o resultado da análise deve
      refletir o estado efetivamente salvo no banco.
12. advanceMeasurementWorkspaceStatus(InProgress) — domínio puro,
    já existente.
13. Montar MeasurementAnalysisResult (Parte X), a partir das linhas
    relidas do passo 11.
14. **Revisado (correção 5): persistência atômica do resultado final.**
    Os passos anteriores (13 e a antiga "13. updateStatus('completed')")
    eram duas escritas separadas — risco real de um import terminar
    `completed` sem `analysis_result`, ou `analysis_result` persistido
    com `status` ainda `processing`. Substituído por uma única
    atualização de linha no repository:
    ```sql
    UPDATE measurement_bulletin_imports
    SET analysis_result = ?, status = 'completed', updated_at = now()
    WHERE id = ?
    ```
    O mesmo vale para o caminho de falha (passo 7, gate de
    reconciliação, e qualquer falha classificada como domínio na
    taxonomia abaixo): `analysis_result` da falha e `status = 'failed'`
    são gravados **na mesma atualização**, nunca em duas chamadas.
    Retorna outcome `completed` (modo fresco) ou `resumed` (modo
    retomada).
```

### Tratamento de falhas — o cenário exato que foi pedido

> WorkPackages criados → Workspace falha → retry. O que acontece?

**Nada de ruim acontece — e isso não é sorte, é a razão de a ordem ser
esta.** `WorkPackage`/`ManagedServiceItem` são escopados ao **projeto**,
não ao workspace — não são "trabalho perdido" se o passo seguinte
falhar, são dado de catálogo legitimamente reaproveitável por qualquer
boletim futuro do mesmo projeto. Na nova tentativa:

- `getMeasurementBulletinImportById` encontra o mesmo import, agora
  com `status='failed'`.
- `getMeasurementWorkspaceByImportId` não encontra nada (o workspace
  nunca chegou a existir) → MODO FRESCO de novo.
- O arquivo é baixado e re-parseado (determinístico — mesmos bytes,
  mesmo resultado).
- `findOrCreateWorkPackage`/`findMatchingManagedServiceItemOrCreate`
  **encontram** as linhas já criadas na tentativa anterior (outcome
  `matched`, não `created` de novo) — nenhuma duplicata.
- O fluxo prossegue normalmente a partir daí.

A única falha que exige tratamento **novo** nesta sprint (não coberta
por código já existente) é a colisão de `insertMeasurementWorkspaceLine`
no passo 11 durante uma retomada — capturar `23505` e, **diferente de**
`findOrCreateWorkPackage` (que trata como sucesso silencioso), comparar
valores persistidos vs. pretendidos antes de decidir entre
`already_present` e atualização explícita (correção 2, detalhada no
passo 11 revisado da Parte V).

### Taxonomia de erros — domínio vs. infraestrutura

| Erro | Categoria | Por quê |
|---|---|---|
| `import_not_found` | Domínio | Estado de negócio inválido (id não pertence à company) |
| `already_processing` / `already_completed` / `workspace_closed` / `workspace_cancelled` | Domínio | Não são falhas — são estados legítimos do processo de negócio |
| `workspace_ready_for_review` (**novo, correção 1**) | Domínio | Workspace já entrou em revisão humana — processamento automático recusado, não é uma falha técnica |
| `download_failed` | Infraestrutura | Storage indisponível, arquivo corrompido no upload, rede |
| `parse_failed` | Fronteira — tratado como infraestrutura porque o parser, por contrato, não deveria lançar. Se lançar, é um bug do adapter, não uma decisão de negócio |
| `official_period_total_mismatch` / `official_measurement_block_not_found` | Domínio | O arquivo é estruturalmente pouco confiável — decisão de negócio de recusar, não uma falha técnica |
| `period_number_conflict` (**novo, proposto nesta sprint** — ver Parte IX) | Domínio | Duas medições reivindicando o mesmo período no mesmo projeto |
| `service_item_description_mismatch` (**novo, warning** — ver R3, Parte XII) | Domínio | Mesmo código, descrição divergente — sinalizado, não bloqueante |
| `service_item_unit_mismatch` (**novo, blocking** — ver R3 ampliado, Parte XII) | Domínio | Mesmo código, unidade divergente (ex.: m³ vs. m²) — usar o preço unitário existente geraria cálculo financeiramente inválido; a linha não é materializada automaticamente contra aquele item, exige resolução humana |
| Violação de `23505` em `work_packages`/`managed_service_items` | Nunca deveria vazar como erro — é justamente o mecanismo de idempotência funcionando; sempre capturada e tratada como sucesso silencioso |
| Violação de `23505` em linhas (`measurement_workspace_lines`) | **Revisado (correção 2):** nunca vaza como erro, mas também não é mais skip automático — dispara comparação de valores persistidos vs. pretendidos (Parte V, passo 11) |

### Transação lógica — resposta honesta

**Nada neste fluxo é uma transação SQL única.** Cada chamada ao
repository é seu próprio commit — o cliente Supabase usado aqui (via
PostgREST) não oferece uma transação multi-tabela do lado do cliente
sem introduzir uma função Postgres (RPC), o que seria uma decisão
arquitetural própria, não uma consequência natural desta sprint.

- **Atômico**: só dentro de uma única chamada (`INSERT ... RETURNING`
  é atômico por si só; a sequência de 10+ chamadas não é).
- **Compensável**: não existe rollback automático nesta primeira
  versão. A "compensação" de um workspace parcialmente materializado
  é **retomada** (passo 11 completa o que falta), nunca "desfazer".
  Se um workspace precisar ser abandonado de verdade, o caminho é
  `Cancelled` (já suportado pelo domínio) mais um novo import — nunca
  edição/reversão in-place.
- **Reexecutável**: **tudo.** Esta é a estratégia escolhida
  deliberadamente — resiliência por idempotência de cada passo, não
  por transação envolvente. É a mesma filosofia do upload resiliente
  do Epic 18, aplicada um nível mais fundo (à materialização inteira,
  não só ao upload).

Registro explícito, não escondido: se a produção algum dia mostrar que
isso é insuficiente (ex.: um workspace parcial gerando confusão real
para o usuário antes de uma retomada acontecer), o próximo degrau é
uma função Postgres envolvendo os passos 8–12 numa transação real. Não
construo isso agora sem evidência de necessidade — mesma disciplina do
resto do Epic.

**Aprovado com invariantes adicionais (revisão desta sessão):** a
ausência de `BEGIN`/`COMMIT` envolvente só é uma decisão consciente e
defensável se todas as invariantes abaixo se mantiverem — todas já
refletidas nas correções desta revisão:

1. O claim de `processing` é atômico (correção 4, passo 4).
2. Cada criação (`WorkPackage`, `ManagedServiceItem`, linha) é
   idempotente.
3. Linhas existentes são **comparadas**, nunca puladas cegamente
   (correção 2, passo 11).
4. O resultado (`recalculatedTotal` etc.) é calculado a partir do
   **estado persistido**, relido após a materialização — nunca apenas
   do DTO do parser em memória (passo 11).
5. `analysis_result` e o status final (`completed`/`failed`) são
   salvos na **mesma atualização** (correção 5, passo 14).
6. Um workspace em `ReadyForReview` ou posterior nunca é alterado
   automaticamente (correção 1, passo 3).

---

## Parte VI — Estados (pergunta 6)

**`measurement_bulletin_imports.status`:**

```
pending_upload --(confirmUpload)--> uploaded
uploaded        --(process inicia)--> processing
processing      --(materialização ok)--> completed
processing      --(qualquer falha: download/parse/gate/persistência)--> failed
failed          --(process chamado de novo)--> processing  [MODO RETOMADA se workspace parcial existe]
completed       --(process chamado de novo)--> completed   [terminal na prática — already_completed, nenhuma transição real]
```

**Correção 4 (revisão desta sessão): o claim de `processing` agora é
atômico** (passo 4 da Parte V — `UPDATE ... WHERE status IN ('uploaded',
'failed') RETURNING *`). Isso elimina a corrida entre duas execuções
simultâneas reivindicando o mesmo import — mas não elimina o risco de
o processo morrer de forma "suja" (crash do servidor, não uma exceção
capturada) depois do claim ter sucedido e antes de qualquer `catch`
rodar. Nesse caso o import fica preso em `processing`, e a tabela da
Parte IV trata `processing` como `already_processing`, recusando
qualquer nova tentativa automática.

**Não estou propondo um sistema completo de leases/staleness nesta
sprint** — seria complexidade sem evidência de necessidade ainda. Mas,
diferente da versão anterior deste documento, **não aceito mais
edição direta de banco como a única via de escape**. Registro como
dívida obrigatória, a ser resolvida imediatamente após 19.4D, antes de
disponibilizar a funcionalidade a clientes reais:

- `retryMeasurementBulletinImport` — caso de uso próprio, com
  autorização administrativa e verificação explícita de staleness
  (ex.: `updated_at` + threshold), que reivindica um import travado em
  `processing` de volta para reprocessamento. Não faz parte do escopo
  de código da 19.4D, mas o desenho não deve enterrar nada que
  dificulte essa extração depois (mesmo espírito de R6, Parte XII).

A 19.4D pode seguir sem recuperação automática por tempo, mas não sem
claim atômico — o claim atômico já está no escopo desta sprint
(passo 4).

**`measurement_workspaces.status` — separado, acoplado apenas em uma
direção:**

```
Draft -> InProgress -> ReadyForReview -> Closed   (terminal)
                                       -> Cancelled (terminal)
```

`processMeasurementBulletinImport` **só** leva o workspace de `Draft`
a `InProgress` (passo 12). Nunca chega a `ReadyForReview`, `Closed` ou
`Cancelled` — essas transições pertencem a `closeMeasurementWorkspace`
(já congelado) e a decisões humanas fora deste caso de uso.

**Correção 1, reafirmada aqui — matriz de reprocessamento automático
por estado do workspace:**

| Estado do workspace | Reprocessamento automático (`processMeasurementBulletinImport`) |
|---|---|
| `Draft` | Permitido — MODO RETOMADA completo |
| `InProgress` | Permitido, com reconciliação linha a linha (correção 2) |
| `ReadyForReview` | **Recusado** — outcome `workspace_ready_for_review`, exige ação humana explícita fora deste caso de uso |
| `Closed` | Recusado (`workspace_closed`) |
| `Cancelled` | Recusado (`workspace_cancelled`) |

---

## Parte VII — Fronteiras (pergunta 8)

Reafirmando o que já está congelado, agora explícito para quem for
implementar:

- **Pode chamar `processMeasurementBulletinImport`**: apenas o Route
  Handler (`apps/web/app/api/measurement/imports/process/route.ts`,
  ainda não criado).
- **`processMeasurementBulletinImport` pode chamar**: `bulletin-import.ts`
  (parser) e `measurement-repository.ts` (repository) — nunca o
  contrário.
- **Nunca**: Parser → Repository (o parser não importa nada de
  `apps/web/lib/bdos/`). UI → Repository diretamente. Route Handler →
  Repository diretamente (diferente do Epic 18, deliberadamente — ver
  o comentário já existente em `measurement-bulletin-import.types.ts`).
- **Novo, explícito nesta sprint**: `processMeasurementBulletinImport`
  nunca chama `supabase.from(...)` diretamente — só através de funções
  já nomeadas de `measurement-repository.ts`. Se uma consulta nova for
  necessária, ela nasce como uma nova função no repository, nunca
  inline no Application Service.

---

## Parte VIII — Auditabilidade (pergunta 15)

**O que já fica registrado hoje, sem mudança nenhuma:** `file_name`,
`storage_path`, `uploaded_by`, `uploaded_at`, e o `status` atual do
import. Cada linha materializada carrega `declared_quantity`/
`declared_unit_value`/`declared_total_value` ao lado dos valores
oficiais — a divergência, quando existe, já é persistida, nunca
descartada.

**Gap real, não resolvido hoje — dois pontos:**

1. **Não existe histórico de status.** Só o status *atual* de
   `measurement_bulletin_imports` é guardado — uma transição
   `uploaded → processing → failed → processing → completed` não
   deixa rastro de quantas tentativas houve nem quando. Diferente de
   outras partes do bdos-core que já têm uma tabela de histórico (ex.:
   `execution_task_status_history`). Não proponho resolver isso
   agora sem evidência — registro como dívida conhecida.
2. **O resultado da análise (`MeasurementAnalysisResult`, Parte X)
   não é persistido em lugar nenhum hoje.** Ele nasceria, seria
   devolvido pela API, e se ninguém capturasse a resposta HTTP,
   desapareceria. Isso é inaceitável dado que o próprio objetivo do
   produto é "o BDOS descobriu isto" — a descoberta precisa
   sobreviver além da resposta HTTP. **Ver recomendação R2, Parte
   XII — proposta concreta de resolver isso nesta mesma sprint, não
   depois.**

**O que é decisão vs. cálculo, para efeito de auditoria:**

| Fato | Tipo |
|---|---|
| `quantity * unitValue = totalValue` por linha | Cálculo (determinístico, sempre igual para a mesma entrada) |
| Aceitar `declaredBulletinNumber` como oficial, ou atribuir `MAX+1` | Decisão (regra de numeração já congelada) |
| Correlacionar um código a um `ManagedServiceItem` existente vs. criar novo | Decisão (heurística, pode estar errada — ver os comentários já existentes em `findMatchingManagedServiceItemOrCreate`) |
| `outcome.kind = 'completed'` vs `'failed'` | Decisão (baseada no gate de reconciliação, Parte II) |
| Severidade de uma issue (`warning` vs `blocking`) | Decisão herdada do parser, mas a decisão de *aceitar o resultado mesmo com warnings* é desta Application Service |

---

## Parte IX — O que é decidido pelo BDOS vs. apenas declarado pelo documento (pergunta 11 revisitada)

| Conceito | Quem decide | Onde vive hoje |
|---|---|---|
| `declaredBulletinNumber` | Arquivo | `ParsedMeasurementBulletin.declaredBulletinNumber` |
| Número oficial do boletim | BDOS — regra já congelada na Sprint 4.0 (`generateMeasurementBulletin`, não esta sprint): adota o declarado se não colidir, senão `MAX+1` | Só se materializa quando o boletim é *gerado*, não durante o *import* |
| `declaredPeriod` (labels/datas) | Arquivo | `ParsedMeasurementBulletin.declaredPeriod` |
| `period_number`/`start_date`/`end_date` do Workspace | BDOS, **nesta sprint** — e aqui há uma pergunta genuinamente em aberto que respondo abaixo | `measurement_workspaces.period_number/start_date/end_date` |
| `declaredQuantity`/`declaredUnitValue`/`declaredTotalValue` por linha | Arquivo | `measurement_workspace_lines.declared_*` |
| `quantity`/`unitValue`/`totalValue` oficiais por linha | BDOS — sempre recalculado, nunca copiado do declarado | `measurement_workspace_lines.quantity/unit_value/total_value` |
| Se um `ManagedServiceItem` já existe ou é novo | Correlação heurística por código (repository) — mas a decisão de *aceitar* essa correlação quando a descrição ou a unidade divergem é uma decisão de negócio ainda sem dono claro | Ver R3 (ampliado nesta revisão), Parte XII |
| Se uma divergência é aceitável para seguir adiante | **Revisão humana, fora desta Application Service.** Esta operação só classifica, nunca decide "pode passar" |

**Pergunta em aberto, respondida aqui com uma proposta:** o que
acontece se o `period_number` declarado colidir com um `Workspace` já
existente no mesmo projeto (não o mesmo import — um import **novo**,
reivindicando um período que outro workspace já ocupa)? Isso pode ser
legítimo (remedição de um período já medido, por exemplo) ou pode ser
um erro de numeração do arquivo de origem. **Proposta**: não bloquear
— o schema não impõe unicidade de `(engineering_project_id,
period_number)` hoje e não vejo motivo para adicionar essa restrição
sem mais evidência (remedição é um caso real). Mas a operação deve
**detectar e sinalizar** essa colisão como uma issue nova,
`period_number_conflict` (mesmo espírito de `bulletin_number_conflict`,
já congelado para `generateMeasurementBulletin`), como **warning**, não
blocking — vira parte do `MeasurementAnalysisResult`, nunca some em
silêncio.

---

## Parte X — Resultado (pergunta 5) — `MeasurementAnalysisResult`

Este é o objeto mais importante desta sprint, e também o que mais
precisa de aprovação explícita, porque ele vai alimentar diretamente a
futura Análise do Boletim de Medição — sua forma importa tanto quanto
sua lógica.

### Recomendação de fronteira (nova nesta sprint, precisa de aprovação)

`MeasurementAnalysisResult` deve conter **apenas fatos**, nunca
narrativa. Campos como "confidence", "recommendations" ou
"advisorSummary" — cogitados na conversa de produto — **não pertencem
a este objeto**, pelo mesmo motivo que o Repository não decide
numeração e o parser não aprova boletim: `CLAUDE.md` já define que o
BBA Advisor "owns no data, writes nothing, only narrates what Engines
already computed". Se `processMeasurementBulletinImport` calculasse
`confidence`/`recommendations` diretamente, seria exatamente o mesmo
erro corrigido no Repository (Sprint 3): uma peça de infraestrutura
fazendo um julgamento que não é dela. Um segundo passo — Advisor
consumindo `MeasurementAnalysisResult` — produziria essas três coisas,
provavelmente numa sprint própria, não aqui.

### Forma proposta

**Correção 3 (revisão desta sessão): união discriminada, não uma
interface única com `measurementWorkspaceId: string` obrigatório.**
O gate de reconciliação (Invariante #6, Parte II) pode recusar um
boletim **antes** da criação do workspace em MODO FRESCO (passo 7 vem
depois do 10 apenas em MODO RETOMADA — em MODO FRESCO, se o gate
recusasse depois de criar o workspace, o workspace ficaria órfão de um
resultado coerente). Um resultado de falha, portanto, pode
legitimamente não ter workspace. A versão anterior deste documento
exigia `measurementWorkspaceId: string` sempre — impossível de
satisfazer nesse caminho. A união abaixo evita o objeto
semanticamente impossível em vez de relaxar o campo para
`string | null` em todos os casos (o que permitiria, por engano, um
resultado `reconciled` sem workspace):

```ts
interface MeasurementAnalysisResultBase {
  // Toda leitura futura de um analysis_result persistido precisa saber
  // qual versão de schema e qual parser o produziu — sem isso, um
  // resultado antigo poderia ser mal interpretado como se tivesse sido
  // produzido pelo parser/schema atual, daqui a dois anos.
  readonly schemaVersion: 1;
  readonly parserKey: "dnocs-measurement-bulletin-v1";
  readonly generatedAt: string; // ISO 8601, momento em que o resultado foi montado

  readonly measurementBulletinImportId: string;
  readonly engineeringProjectId: string;

  readonly declaredBulletinNumber: number | null;
  readonly declaredPeriod: {
    readonly startDate: string | null;
    readonly endDate: string | null;
    readonly labels: ReadonlyArray<string>;
  } | null;

  // Passthrough direto do parser -- não reprocessado, não reinterpretado.
  readonly structuralIssues: ReadonlyArray<MeasurementImportIssue>;
  readonly skippedSheets: ReadonlyArray<ParsedSkippedSheet>;
}

interface ReconciledOrNeedsReviewMeasurementAnalysisResult extends MeasurementAnalysisResultBase {
  readonly status: "reconciled" | "needs_review";
  readonly measurementWorkspaceId: string;

  // Fato central — exatamente o que a investigação do BM_08 provou
  // que precisa existir permanentemente, não só uma vez. Calculado a
  // partir das linhas RELIDAS do banco após a materialização (Parte V,
  // passo 11), nunca do DTO do parser em memória. quantity * unitValue
  // reaproveita a mesma função de domínio/arredondamento monetário já
  // usada pelo bulletin-generator; a comparação usa tolerância
  // explícita de 1 centavo (abs(totalDifference) <= 0.01), nunca
  // igualdade binária de ponto flutuante.
  readonly officialPeriodTotal: number;
  readonly recalculatedTotal: number;      // soma de totalValue das linhas persistidas
  readonly totalDifference: number;        // recalculatedTotal - officialPeriodTotal

  readonly workPackages: { readonly created: number; readonly matched: number };
  readonly serviceItems: { readonly created: number; readonly matched: number };
  readonly lines: {
    readonly imported: number;
    readonly alreadyPresent: number;  // correção 2: linhas idênticas a uma tentativa anterior
    readonly updated: number;         // correção 2: linhas divergentes, atualizadas explicitamente
    readonly skippedZeroValue: number;
  };

  // Fato derivado mecanicamente (nunca opinião): 'reconciled' apenas se
  // nenhuma issue blocking estiver presente E totalDifference dentro
  // da tolerância de 1 centavo; 'needs_review' se há warnings mas
  // nenhum blocking.
}

interface FailedMeasurementAnalysisResult extends MeasurementAnalysisResultBase {
  readonly status: "failed";
  // Correção 3: nulo quando o gate de reconciliação recusa antes da
  // criação do workspace em MODO FRESCO (passo 7 antes do 10). Não-nulo
  // quando a falha ocorre em MODO RETOMADA ou após o workspace existir.
  readonly measurementWorkspaceId: string | null;
}

type MeasurementAnalysisResult =
  | ReconciledOrNeedsReviewMeasurementAnalysisResult
  | FailedMeasurementAnalysisResult;
```

**Gap honesto, não inventado:** o tipo `ParsedMeasurementLine` já tem
um campo `declaredUnitValue`, mas o parser **hoje sempre grava `null`
nele** (confirmado em `bulletin-import.ts`) — o BM_08 real não expôs
preço unitário por período de forma que o parser pudesse extrair
separadamente do valor total. Isso significa que **hoje não é possível
reportar `unitPriceDifferences`** como uma lista própria, só
`totalDifference` agregado. Não vou inventar essa capacidade nesta
sprint — registro como lacuna conhecida, igual ao gap de
`measurementType` já registrado no Sprint 4C.

### Onde ele vive

Ver recomendação R2, Parte XII: proponho persistir este objeto (JSONB)
em `measurement_bulletin_imports`, não só devolvê-lo na resposta HTTP.

---

## Parte XI — Conhecimento reutilizável (pergunta 17, nascida do `BDOS_VISION.md`)

**Sim — e de três formas concretas, não abstratas:**

1. **Catálogo de projeto que se acumula.** `WorkPackage`/
   `ManagedServiceItem` são escopados ao projeto, não ao boletim — o
   boletim de julho se beneficia do catálogo que o de junho já
   populou. Isso é literalmente visível no `outcome.kind` de cada
   item: a proporção de `matched` sobre `created` deveria **subir**
   mês a mês, para o mesmo projeto. Essa métrica, sozinha, é uma
   prova de que o sistema está aprendendo a estrutura do contrato ao
   longo do tempo — vale considerar expô-la no dashboard futuro.
2. **Prova de reconciliação por período, permanente.** Cada
   `MeasurementAnalysisResult` é evidência arquivada de que aquele
   boletim específico foi auditado e passou (ou não) — não uma
   afirmação vaga, um objeto com números e issues específicos, pronto
   para ser mostrado numa auditoria do TCU se for preciso.
3. **Substrato para os demais Engines de decisão.** Uma vez que
   `MeasurementWorkspaceLine` existe persistida, ela se torna insumo
   potencial para Engines que já existem no bdos-core (ex.:
   `cash-forecast`, `revenue-recognition`) — esta sprint não os
   conecta, mas não deveria arquitetar nada que dificulte essa conexão
   depois.

---

## Parte XII — Opinião estratégica (CPO / Chief Solution Architect)

Assumindo o mesmo papel de antes: aqui vão as recomendações que
considero necessárias para que esta sprint entre forte no mercado, não
apenas correta tecnicamente.

### R1 — Persistir `sourceLocation` por linha (recomendo tratar como obrigatório, não opcional)

A Invariante #5 ("toda linha mantém rastreabilidade até a célula de
origem") é hoje uma promessa não cumprida no schema. Dado que
rastreabilidade até a célula é **exatamente** o argumento de venda que
usamos no documento para o cliente ("abra a célula I20 e veja"), seria
uma contradição interna sério lançar 19.4D sem persistir isso.
Proposta mínima, aditiva, mesmo padrão de `declared_*`:

```sql
ALTER TABLE measurement_workspace_lines
  ADD COLUMN IF NOT EXISTS source_sheet_name TEXT,
  ADD COLUMN IF NOT EXISTS source_row_number INT,
  ADD COLUMN IF NOT EXISTS source_physical_column TEXT,
  ADD COLUMN IF NOT EXISTS source_financial_column TEXT;
```

Nulo quando a linha nasce de lançamento nativo (Caminho A, sem fonte
externa). Isso transforma "rastreabilidade" de discurso em algo que a
UI futura pode literalmente mostrar: "esta linha veio da célula I244
do arquivo original."

### R2 — Persistir `MeasurementAnalysisResult` (não deixar como resposta HTTP efêmera) — **aprovado com versionamento e atualização atômica**

Já justificado na Parte VIII. Proposta mínima:

```sql
ALTER TABLE measurement_bulletin_imports
  ADD COLUMN IF NOT EXISTS analysis_result JSONB;
```

**Revisão desta sessão — dois ajustes obrigatórios, não apenas a
coluna:**

1. **Versionamento dentro do próprio JSON**, não apenas a coluna crua
   — `schemaVersion`, `parserKey`, `generatedAt` são campos
   obrigatórios de `MeasurementAnalysisResult` (Parte X). Isso não
   introduz abstração multi-parser (R6 continua valendo) — apenas
   impede que um resultado antigo seja interpretado como se tivesse
   sido produzido pelo parser/schema atual, daqui a alguns anos.
2. **Atualização atômica, nunca em duas escritas.** `analysis_result`
   e `status` (`completed`/`failed`) são gravados na **mesma**
   atualização de linha (correção 5, passo 14, Parte V) —
   `analysis_result = ?, status = ?, updated_at = now() WHERE id = ?`.
   Nunca `status = completed` seguido de uma segunda chamada
   salvando o resultado, e nunca o inverso. Isso evita duas
   inconsistências reais: um import `completed` sem resultado, ou um
   resultado persistido enquanto o status ainda mostra `processing`.

Preenchido sempre — inclusive quando `outcome.kind = 'failed'` (o
resultado da análise de por que falhou é tão valioso quanto o de um
sucesso, e agora tipado como `FailedMeasurementAnalysisResult`, Parte
X). Isso é o que torna possível, no futuro, uma tela "histórico de
análises deste projeto" sem reprocessar nada.

### R3 — Decidir explicitamente o que fazer quando `ManagedServiceItem` "matched" diverge em descrição/unidade — **aprovado e ampliado nesta sessão**

Hoje `findMatchingManagedServiceItemOrCreate` já documenta esse risco
mas não o resolve — devolve `matched` mesmo que a descrição ou a
unidade do item encontrado sejam diferentes das que o arquivo atual
declara. Não estou pedindo resolver isso com uma heurística nova nesta
sprint (seria inventar regra sem evidência de múltiplos formatos reais
ainda). Mas a divergência de **descrição** e a divergência de
**unidade** têm severidades diferentes e devem ser tratadas de forma
diferente:

- **Descrição diferente após normalização trivial** →
  `service_item_description_mismatch`, **warning**. O Diretor vê
  "encontramos um item com o mesmo código mas descrição diferente" em
  vez de o sistema simplesmente assumir que é o mesmo item — mas a
  linha ainda é materializada normalmente.
- **Unidade diferente após normalização** (ex.: mesmo código, item
  existente em `m³`, arquivo atual em `m²`) → `service_item_unit_mismatch`,
  **blocking**. Usar automaticamente o preço unitário existente contra
  uma unidade diferente pode gerar um cálculo financeiramente
  inválido. Quando a unidade divergir, **a linha não deve ser
  materializada automaticamente contra aquele item** — a aplicação
  exige resolução humana futura (fora do escopo de código desta
  sprint), em vez de escolher silenciosamente entre correlacionar ou
  criar outro item.

### R4 — O gate de reconciliação (Parte II, Invariante #6) é o ativo mais valioso desta sprint — trate-o como tal

Tecnicamente é "só" um `if`. Comercialmente, é a diferença entre "mais
um importador de Excel" e "um sistema que nunca deixa passar um
boletim que não reconcilia — isso é travado no sistema, não uma
política que alguém pode pular". Recomendo que, quando chegarmos à
UI/dashboard, este gate específico seja citado explicitamente como uma
garantia do produto (ex.: "Garantia de Reconciliação BDOS") — é um
argumento de venda defensável tecnicamente, não marketing vazio,
porque literalmente existe um teste automatizado (`official_period_total_mismatch`)
provando que o sistema nunca aceita silenciosamente uma divergência
acima de 1 centavo.

### R5 — O catálogo de projeto é um moat, não um efeito colateral

A proporção `matched`/`created` subindo mês a mês (Parte XI, item 1) não é
só uma métrica de qualidade — é custo de troca. Depois de 6-12 meses
de boletins de um cliente passando pelo BDOS, o catálogo de
`WorkPackage`/`ManagedServiceItem` daquele projeto está rico e cada vez
mais preciso; um concorrente entrando depois começaria do zero, e o
cliente teria que aceitar meses de recadastro para trocar de
ferramenta. Vale nomear isso explicitamente como parte da tese de
retenção, não deixar implícito.

### R6 — Não construir "multi-parser" ainda, mas não fechar a porta

A visão de família de parsers (DNOCS, DNIT, CODEVASF, DER, SIURB,
privados) é correta, mas **esta sprint não deveria introduzir nenhuma
abstração de "seleção de parser"** — hoje existe exatamente um parser
(`bulletin-import.ts`). Regra prática já discutida: esperar o segundo
parser real (o próximo cliente, com um layout diferente) para
justificar a interface compartilhada. O único cuidado agora é não
enterrar nada que tornaria essa extração mais difícil depois — e o
desenho acima já evita isso, porque `processMeasurementBulletinImport`
só conhece `ParsedMeasurementBulletin` (o contrato), nunca
`bulletin-import.ts` por nome de forma acoplada à lógica de negócio.

### R7 — Claim atômico de `processing` é obrigatório nesta sprint (novo, correção 4)

Diferente da versão anterior deste documento (que tratava o claim como
um `UPDATE` incondicional e a corrida entre execuções simultâneas como
risco aceito sem mitigação), o claim atômico (`UPDATE ... WHERE status
IN ('uploaded', 'failed') RETURNING *`, passo 4 da Parte V) entra no
escopo de código da 19.4D — é a diferença entre duas execuções
simultâneas competindo silenciosamente para materializar o mesmo
import e uma delas recebendo `already_processing` de forma
determinística. A recuperação de um `processing` travado por crash
"sujo" (via `retryMeasurementBulletinImport`, Parte VI) continua fora
do escopo de código desta sprint, mas registrada como dívida
obrigatória antes de clientes reais.

### Definição de pronto que eu usaria para esta sprint

Não é "a rota HTTP responde 200". É: **rodar
`processMeasurementBulletinImport` contra o BM_08 real do cliente e
obter de volta um `MeasurementAnalysisResult` mostrando
`officialPeriodTotal = recalculatedTotal = R$ 252.654,78`,
`status: "reconciled"`, e a issue de `historical_grid_not_authoritative`
presente e não-bloqueante.** Isso, mesmo em JSON puro, sem UI nenhuma,
já é uma demonstração de produto legítima para a conversa comercial em
andamento — não precisa esperar a 19.5.

---

## Parte XIII — Parecer do revisor e status de aprovação (registrado nesta sessão)

O desenho foi revisado linha a linha e considerado **aprovado
conceitualmente, com cinco correções de consistência obrigatórias
antes do código**. As cinco já estão incorporadas ao corpo deste
documento (marcadas "correção 1"–"correção 5" nas partes IV, V, VI e
X); resumo aqui para referência rápida:

1. **`ReadyForReview` não aceita retomada automática** — matriz de
   reprocessamento por estado (Parte VI) e outcome
   `workspace_ready_for_review` (Parte IV).
2. **Colisão de linha (`23505`) exige comparação, não skip simples** —
   `already_present` vs. atualização explícita (Parte V, passo 11).
3. **Resultado de falha suporta ausência de workspace** — união
   discriminada `ReconciledOrNeedsReviewMeasurementAnalysisResult |
   FailedMeasurementAnalysisResult` (Parte X).
4. **Claim de `processing` é atômico** —
   `UPDATE ... WHERE status IN (...) RETURNING *` (Parte V, passo 4;
   R7, Parte XII).
5. **`analysis_result` e status final são persistidos juntos** — uma
   única atualização de linha, nunca duas escritas separadas (Parte V,
   passo 14; R2, Parte XII).

**Demais decisões da checklist original, todas ratificadas nesta
sessão** (ver seções correspondentes para o texto completo):

- R1 (persistir `sourceLocation`) — aprovado, sem ajustes.
- R2 (persistir `MeasurementAnalysisResult`) — aprovado **com**
  versionamento (`schemaVersion`/`parserKey`/`generatedAt`) e
  atualização atômica (correção 5).
- R3 (correlação de `ManagedServiceItem`) — aprovado e **ampliado**:
  descrição divergente continua warning; unidade divergente passa a
  **blocking** (`service_item_unit_mismatch`).
- `period_number_conflict` como warning — aprovado, sem ajustes.
- Resultado contém fatos, nunca narrativa — aprovado integralmente.
- Ausência de transação SQL envolvente — aprovado, **com** as seis
  invariantes adicionais listadas ao final da Parte V.
- Reaproveitar `bdos-imports` e o path de Storage propostos — aprovado.
- Processing travado sem nenhuma via de recuperação — **não aprovado
  como estava**; substituído por claim atômico (escopo desta sprint,
  correção 4) + dívida obrigatória registrada de
  `retryMeasurementBulletinImport` (Parte VI, R7).

### Sequenciamento aprovado

```
19.4D.0 — Schema alignment
  - colunas de sourceLocation (R1)
  - analysis_result JSONB (R2)
  - checks e comentários de coluna
  - tipos versionados do resultado (schemaVersion/parserKey/generatedAt)

19.4D.1 — Repository additions
  - claim atômico de processing (correção 4)
  - conclusão/falha com analysis_result na mesma atualização (correção 5)
  - getMeasurementWorkspaceLineByWorkspaceAndServiceItem (correção 2)
  - função explícita de atualização de linha (correção 2)
  - leitura das linhas persistidas para cálculo final (correção 2)

19.4D.2 — Application Service
  - fluxo completo (Parte V) com as cinco correções incorporadas

19.4B — Upload resiliente
  - pode ser implementado junto, reaproveitando o Epic 18 sem acesso
    direto às tabelas pela rota (Parte VII)
```

Depois das correções incorporadas acima, a Sprint 19.4D está pronta
para implementação. O núcleo estratégico do documento — fatos
separados de narrativa, reconciliação como gate, auditabilidade e
conhecimento reutilizável — permanece correto e alinhado com o
`BDOS_VISION.md`.

---

## Checklist de aprovação explícita

Nada disto está implementado. Estado de cada item após a revisão desta
sessão (Parte XIII):

- [x] R1 — adicionar colunas de `source_location` a `measurement_workspace_lines` — **aprovado**
- [x] R2 — adicionar `analysis_result JSONB` a `measurement_bulletin_imports`, com versionamento e atualização atômica — **aprovado com ajustes**
- [x] R3 — nova issue `service_item_description_mismatch` (warning) **e** `service_item_unit_mismatch` (blocking) — **aprovado e ampliado**
- [x] Nova issue `period_number_conflict` (warning) — Parte IX — **aprovado**
- [x] Separação fato/narrativa em `MeasurementAnalysisResult` (nenhum campo de `confidence`/`recommendations`/`advisorSummary` nesta sprint) — **aprovado**
- [x] `ReadyForReview` não aceita retomada automática (outcome `workspace_ready_for_review`) — **correção 1, incorporada**
- [x] Colisão de linha (`23505`) exige comparação de valores, não skip cego — **correção 2, incorporada**
- [x] `MeasurementAnalysisResult` de falha suporta `measurementWorkspaceId` nulo, via união discriminada — **correção 3, incorporada**
- [x] Claim de `processing` é atômico (`UPDATE ... WHERE status IN (...) RETURNING *`) — **correção 4, incorporada; entra no escopo de código da 19.4D**
- [x] `analysis_result` e status final (`completed`/`failed`) persistidos na mesma atualização — **correção 5, incorporada**
- [ ] Dívida registrada: `retryMeasurementBulletinImport` para recuperação de `processing` travado por crash "sujo" — fora do escopo de código da 19.4D, mas obrigatória antes de clientes reais
- [x] Nenhuma transação SQL envolvente — resiliência por idempotência de cada passo, condicionada às seis invariantes adicionais (final da Parte V)
- [x] Storage: reaproveitar literalmente o bucket `bdos-imports`, path `${companyId}/measurement/${engineeringProjectId}/${importId}/${fileName}` — **aprovado**
