# Resilient Planning Import — Epic 18 (desenho aprovado, pré-implementação)

> Mesma disciplina dos Epics anteriores: desenho e revisão do CPO
> primeiro, código depois. Este documento registra o desenho final —
> incluindo os 4 ajustes da revisão — a partir do qual o Epic 18 foi
> implementado.

## Por que este Epic existe

Evidência confirmada em produção: `POST /api/bba-project/import` retorna
HTTP 413 para um arquivo Excel real de ~5,2 MB. A UI mostra "Falha de
comunicação ao importar o arquivo." — mensagem enganosa, porque o
problema real é tamanho de payload, não falha de rede.

**Causa raiz confirmada por inspeção de código** (não hipótese):
`/api/bba-project/import` envia o arquivo como `multipart/form-data`
direto no corpo da requisição para uma Vercel Serverless Function
(runtime Node.js, sem `export const runtime = "edge"`). A Vercel impõe
um teto de **4,5 MB** de corpo de requisição para Serverless
Functions — limite de infraestrutura, não configurável por
`next.config`, `vercel.json` ou qualquer código deste repositório
(confirmado pela ausência total de configuração de tamanho de body em
todo o repositório — não há o que configurar, é um teto incondicional
da plataforma). O sintoma "Falha de comunicação" tem explicação exata:
`runImport` chama `response.json()` incondicionalmente antes de checar
`response.ok`; o corpo de um 413 da Vercel não é o JSON que `route.ts`
produziria, `response.json()` lança, cai no `catch` genérico.

## Achado que mudou o desenho original

A investigação inicial cogitava emitir uma signed upload URL própria.
**Descartado**: o bucket `bdos-imports` já tem RLS que autoriza
`INSERT` (upload) direto de uma sessão autenticada, desde que o
primeiro segmento do path seja o `company_id` do usuário
(`storage.foldername(name)[1] = get_my_company_id()::text`,
`supabase/migrations/20260707190000_bdos_storage.sql`). O RLS já é a
fronteira de autorização real, no nível do banco — criar um mecanismo
de signed URL seria uma segunda fronteira paralela, não necessária.

`file_size_limit`/`allowed_mime_types` do bucket `bdos-imports` estão
`null` (confirmado por query direta ao projeto live) — sem teto
configurado no nível do bucket; usa o padrão do projeto, folgado o
suficiente para arquivos na casa de poucos MB. Os "~6 MB" citados na
decisão são a recomendação de confiabilidade da própria Supabase para
upload padrão (não-resumível) vs. TUS — não um limite tecnicamente
imposto.

## Decisão de schema — `planning_imports` ganha um campo mutável

`planning_imports` era, por desenho original (Sprint 13.4), imutável:
RLS bloqueava `UPDATE`/`DELETE`, `GRANT` só tinha `SELECT, INSERT`. O
Epic 18 muda isso deliberadamente — **decisão explícita, não efeito
colateral**:

> **`planning_imports` continua sendo o registro canônico da
> proveniência do arquivo importado. O campo `status` representa
> exclusivamente o ciclo operacional da importação (upload →
> processamento → conclusão/falha/nova tentativa) — nunca o ciclo de
> vida do arquivo em si, nunca uma segunda responsabilidade além
> dessa.** Esta frase está registrada tanto aqui quanto como
> `COMMENT ON COLUMN` na migration, para que nenhum Epic futuro comece
> a sobrecarregar este campo com um significado que não é o dele.

**Rejeitado**: tabela `planning_import_status_history` (Opção B, mesmo
padrão de `execution_task_status_history`). Sem necessidade
demonstrada — 5 estados lineares, sem ramificação, sem exigência de
auditoria granular por transição (diferente de `execution_tasks`, que
tinha bloqueio/desbloqueio/evidência genuinamente exigindo histórico
próprio). Adicionar a tabela seria a abstração paralela que este Epic
foi explicitamente instruído a evitar.

## Máquina de estados final (com os 4 ajustes)

```
prepare-upload
    │  valida empresa/projeto, extensão/MIME (leve, sem bytes),
    │  tamanho declarado; INSERT com status='pending_upload'
    ▼
pending_upload
    │  browser faz upload direto ao Storage via RLS
    │  (nenhum byte passa pela Vercel Function)
    ▼
upload-complete
    │  endpoint pequeno e dedicado — só confirma que o objeto
    │  existe no Storage (storage.list(), nunca download completo)
    │  e, se disponível, compara tamanho declarado vs. real
    ▼
uploaded
    │  cliente chama process (síncrono nesta implementação —
    │  ver "Prontidão para assíncrono" abaixo)
    ▼
processing
    │  download real do Storage; detectSourceType(buffer) RE-EXECUTADO
    │  com bytes reais (recupera o sniffing perdido no prepare-upload);
    │  importPlanningSource (parser existente, sem duplicação);
    │  persistência do pipeline atual (dataset/snapshot/recommendations)
    ▼
completed | failed
    (failed permite nova chamada a process — volta para processing)
```

### Ajuste 1 — `status` é ciclo operacional, não proveniência

Já registrado acima e na migration via `COMMENT ON COLUMN`.

### Ajuste 2 — `detectSourceType(buffer)` recuperado no `process`

`prepare-upload` só pode validar por extensão/MIME (ainda não há
bytes). `process`, depois do download, roda a mesma função
`detectSourceType` que `route.ts` já usa hoje — agora com os 3 argumentos
completos (`fileName`, `mimeType`, `bytes`), recuperando o fallback de
sniffing (assinatura ZIP para `.xlsx`, `<` para XML) que o
`prepare-upload` sozinho não sustentaria. Se o resultado do
sniffing divergir do que foi declarado, ou for `null`
(não-reconhecido), `process` falha explicitamente
(`status='failed'`) — nunca confia cegamente no valor provisório.
`planning_imports.source_type` **não é reescrito** por `process`: é
proveniência (declarada no prepare-upload), o campo mutável é só
`status` — reforça o Ajuste 1.

### Ajuste 3 — `upload-complete` como etapa própria

Endpoint dedicado, deliberadamente pequeno: recebe `planningImportId`,
confirma existência do objeto via `storage.list()` (nunca um download
completo — evita baixar o arquivo duas vezes), transiciona
`pending_upload → uploaded`. Separa "confirmar que o upload aconteceu"
de "começar a processar" — cada etapa auditável e re-tentável
independentemente.

### Ajuste 4 — prontidão para processamento assíncrono futuro

A primeira implementação é síncrona: o browser chama `upload-complete`
e, em seguida, chama `process` diretamente, esperando a resposta HTTP
com o `BbaProjectSnapshot` completo (mesmo contrato que `runImport` já
espera hoje). Nada na forma dos endpoints impede uma evolução futura:

- `process` já recebe só `planningImportId` (referência opaca,
  resolvida inteiramente no servidor) — chamável de qualquer lugar
  (fila, webhook, worker), não depende de nenhum dado de requisição
  além do id.
- O campo `status` já é exatamente o mecanismo que um cliente futuro
  precisaria para fazer polling em vez de esperar uma resposta
  síncrona.
- `upload-complete`, no futuro, poderia disparar `process` de forma
  assíncrona (fila/webhook) em vez de depender do browser chamar
  `process` em seguida — troca de implementação, não de contrato de
  API.

Nenhuma mudança de código é necessária **agora** para essa prontidão —
é uma propriedade do desenho (referência opaca + estado explícito),
não uma feature a mais implementada neste Epic.

## Contratos dos 3 endpoints novos

### `POST /api/bba-project/imports/prepare-upload`

```
→ { engineeringProjectId?, fileName, contentType, sizeBytes }
← { planningImportId, storagePath }
```

`engineeringProjectId` é aceito mas, como em `/api/copilot/message`,
a resolução real usa `ensureDefaultEngineeringProject` (mesma
limitação de "um projeto por empresa" já documentada em outras
rotas) — quando enviado, é só validado contra o projeto real, nunca
usado para escolher entre vários.

### `POST /api/bba-project/imports/upload-complete`

```
→ { planningImportId }
← { status: "uploaded" }
```

### `POST /api/bba-project/imports/process`

```
→ { planningImportId }
← BbaProjectSnapshot   (mesma forma que /api/bba-project/import já devolve)
```

Idempotente: se `status` já é `completed`, reprocessar não é permitido
por este Epic (não há cache do snapshot anterior para devolver sem
reexecutar o pipeline — reexecutar teria os mesmos efeitos colaterais
de um reimport comum, então a resposta correta é `409` orientando o
cliente a tratar como já concluído, não uma silenciosa reexecução).

## Rota antiga — mantida, não removida

`/api/bba-project/import` continua existindo, inalterada em
comportamento, para arquivos pequenos — evita forçar todo tráfego pelo
caminho novo antes dele estabilizar em produção. Ciclo de vida
recomendado: manter → `Deprecated` (quando o caminho novo estiver
validado) → remoção, só bem mais tarde. Nenhuma dessas duas últimas
etapas faz parte deste Epic.

**Ajuste de consistência necessário, não escopo extra**: como
`planning_imports.status` agora existe com `DEFAULT 'pending_upload'`,
a rota antiga precisa passar `status: 'uploaded'` explicitamente no
momento do `insertPlanningImport` (nesse ponto do fluxo antigo, o
upload já aconteceu de fato) e atualizar para `completed`/`failed` ao
fim do processamento síncrono — sem isso, toda linha criada pela rota
antiga ficaria mentindo "pending_upload" para sempre, o que violaria a
própria semântica que este Epic está introduzindo.

## 18.0 — correção de UX do 413 (independente do resto)

Em `runImport`, checar `response.status === 413` **antes** de chamar
`response.json()` — hoje a chamada é incondicional, e é isso que
mascara o erro real como "falha de comunicação". Mensagem específica:
"Este arquivo excede o limite atual de importação direta. Estamos
preparando o envio de arquivos maiores diretamente para o
armazenamento seguro da plataforma." Uma vez que 18.1-18.3 estejam no
ar, essa mensagem vira proteção residual (arquivos grandes passam a
usar o caminho novo, que não tem esse teto) — mas continua correta
para quem ainda cair na rota antiga.

## O que fica fora deste Epic (dívida documentada, não escondida)

- **Limpeza automática de imports órfãos** (`pending_upload`/`uploaded`
  há muito tempo sem `process` chamado). Detectável por uma query
  simples (`status` + `uploaded_at`/`updated_at` antigos), mas a
  rotina de limpeza em si não é implementada agora.
  fica como debt reconhecido, não implícito.
- **Upload resumível (TUS)** para arquivos que excedam o que upload
  padrão suporta com confiabilidade — arquitetura já preparada (Etapa
  B é uma implementação de transporte, substituível sem mudar
  `prepare-upload`/`upload-complete`/`process`), não implementada.
- **Deprecação/remoção da rota antiga** — fica para quando o caminho
  novo estiver validado em produção.
