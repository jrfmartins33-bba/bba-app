# Epic 21 — Sprint 21.4B.3A.3 — Momento 3C.2A — Achado estrutural: guarda `budget-document-location-boundaries` quebrado

**Status: achado registrado, NÃO corrigido, aguardando autorização separada.** Descoberto ao executar `pnpm test` (cadeia de validação padrão do repositório) pela primeira vez nesta Sprint, conforme exigido pela seção 3.10 do enunciado de autorização do Momento 3C.2. Nenhum código relacionado a este achado foi alterado. O commit do Momento 3C.2A **não foi feito** — está retido até decisão explícita sobre este achado.

## 0. O que é o guarda

`packages/bdos-core/src/architecture/budget-document-location-boundaries.test.ts` — guarda arquitetural **pré-existente**, introduzido no commit `09b0a87` ("feat(bdos-core): form auditable physical cell hypotheses"), de uma sprint anterior a esta (Epic 21, mas anterior à 21.4B.3A.3). Sua terceira asserção ("budget-document-location introduces no PDF parser, OCR, AI or Supabase keyword") varre **todo arquivo** sob `packages/bdos-core/src/domain/budget-document-location/` por um conjunto de palavras-chave proibidas (`openai`, `anthropic`, `pdf-lib`, `pdfkit`, `pdf-parse`, `pdfjs`, `pypdf`, `pdfplumber`, `tesseract`, `ocr`, `supabase`, `@supabase`) — **incluindo texto de comentário**, por desenho deliberado ("varredura textual grosseira de string", conforme o próprio comentário do arquivo, linhas 38-56). Existe exatamente uma exceção nomeada e estreita (palavra `pdfjs`, um arquivo específico, de uma auditoria anterior, PR #69) — nenhuma outra é concedida.

## 1. O que foi descoberto

Todo o subdiretório `testing/discovery/local-reader-evaluation/` desta Sprint (Momentos 3A, 3B, 3C — avaliação real de Docling e PaddleOCR contra o documento Lagoa do Arroz) foi construído **dentro** de `domain/budget-document-location/`. Isso viola o guarda.

**Isto é anterior à minha sessão atual e anterior à revisão técnica formal que a precedeu.** Nenhuma etapa desta Sprint (revisão técnica, Momentos 3C.1, 3C.1A, 3C.1B) executou `pnpm test` completo antes de agora — todas usaram testes direcionados, por instrução explícita de cada autorização (ex.: a revisão técnica foi instruída a não executar suíte integral sem justificar e aguardar autorização).

## 2. Cronologia comprovada (correção de uma afirmação anterior deste documento)

**Correção:** a versão original deste documento afirmava que a primeira violação ocorria no commit `f724eb6` e reportava 9 violações em `cb68205`. Ambas as afirmações estavam **incorretas** — não verificadas por leitura direta do conteúdo de cada commit, apenas por execução do guarda real contra um `git stash` parcial (que não isola arquivos não rastreados) e por presunção sobre a origem. Corrigido abaixo com leitura direta do conteúdo de cada commit via `git ls-tree`/`git cat-file` (sem alterar a branch atual), replicando exatamente a lógica do guarda real — incluindo a exclusão de arquivos `.test.ts`, que `listBudgetDocumentLocationSourceFiles()` (linha 200 do guarda) já aplica e que a primeira versão deste documento não havia replicado corretamente ao investigar.

| Commit | Momento | Arquivos `.ts` escaneados | Violações | Arquivos violadores novos neste commit |
|---|---|---|---|---|
| `c46c7702b94ccfc7bdd084b3c5ea577516e6a8fc` | base (`main`, antes da Sprint) | 154 | **0** | — |
| `ccd8f8f1627e4f628f8787c36a2b27517a42e29b` | Momento 2 | 161 | **3** | `discovery-reference-truth-document.ts` (`pypdf`, `ocr`), `discovery-reference-truth.types.ts` (`ocr`) |
| `959f1b14112c379b74ba73f17aea01b45fa302b8` | Momento 3A | 169 | **4** | `discovery-local-reader-evaluation.types.ts` (`ocr`) |
| `f724eb664f0b6686494a470da24aef405e51741c` | Momento 3B.2 | 171 | **7** | `discovery-local-reader-evaluation.ts`, `raw-adapters/discovery-local-reader-docling-adapter.ts`, `raw-adapters/discovery-local-reader-paddleocr-adapter.ts` (todos `ocr`) |
| `b05e8171e9e96b64406f186b76ef6657f1dc754e` | Momento 3B.3 | 172 | **8** | `evaluation-run/run-local-reader-evaluation.ts` (`ocr`) |
| `cb6820504eb9dc4b211d301e21b13288bb23ea84` | fechamento 3C.1B | 178 | **8** | nenhum (os Momentos 3C.1/3C.1A/3C.1B não introduziram nenhuma violação de arquivo nova) |

**Confirmado, não presumido: a primeira violação ocorre em `ccd8f8f1627e4f628f8787c36a2b27517a42e29b` (Momento 2), por `pypdf`/`ocr` em `discovery-reference-truth-document.ts` e `discovery-reference-truth.types.ts`** — exatamente a hipótese registrada na autorização desta etapa, agora comprovada por leitura direta de conteúdo, não por suposição. O commit base (`main` antes da Sprint) está limpo: **0 violações**.

**Estado em `cb68205` (imediatamente antes desta sessão tocar qualquer código): 8 violações, 7 arquivos, todos v1 — protegidos, não tocáveis por esta correção aditiva:**

| Arquivo | Palavra-chave |
|---|---|
| `local-reader-evaluation/discovery-local-reader-evaluation.ts` | `ocr` |
| `local-reader-evaluation/discovery-local-reader-evaluation.types.ts` | `ocr` |
| `local-reader-evaluation/evaluation-run/run-local-reader-evaluation.ts` | `ocr` |
| `local-reader-evaluation/raw-adapters/discovery-local-reader-docling-adapter.ts` | `ocr` |
| `local-reader-evaluation/raw-adapters/discovery-local-reader-paddleocr-adapter.ts` | `ocr` |
| `reference-truth/discovery-reference-truth-document.ts` | `pypdf`, `ocr` (2 violações) |
| `reference-truth/discovery-reference-truth.types.ts` | `ocr` |

## 3. Contribuição desta sessão (Momento 3C.2A), distinguindo rastreado/não rastreado/alteração desta sessão

- **Arquivo novo, não rastreado, desta sessão:** `local-reader-evaluation/evaluation-run/run-local-reader-evaluation-v2.ts` — **+1 violação** (`ocr`).
- **Arquivos já rastreados (stubs do Momento 3C.1), alterados nesta sessão ao implementar de verdade** `deriveObservedDescriptionLinesV2` e `deriveViabilityInputsV2` — os comentários de cabeçalho, agora documentando o algoritmo real (que necessariamente discute PaddleOCR como uma das duas ferramentas avaliadas), passaram a conter a substring "ocr" — **+2 violações**:
  - `local-reader-evaluation/v2/discovery-local-reader-multiline-v2.ts`
  - `local-reader-evaluation/v2/discovery-local-reader-viability-inputs-v2.ts`

**Total verificado na árvore de trabalho desta sessão (antes de qualquer correção ao guarda): 8 (pré-existentes, `cb68205`) + 3 (desta sessão) = 11 violações — número confirmado por execução direta do guarda real via `pnpm test`, consistente com a contagem replicada acima.**

## 4. Por que não foi corrigido

Três caminhos de correção foram identificados, nenhum executado:

1. **Adicionar exceções nomeadas ao guarda** (mesmo padrão já usado para `pdfjs`) — exigiria editar `budget-document-location-boundaries.test.ts`, um arquivo de teste v1 pré-existente, fora do escopo desta autorização (que cobre implementação das funções v2 já congeladas, não o guarda arquitetural em si).
2. **Mover todo o subdiretório `local-reader-evaluation/` para fora de `budget-document-location/`** — uma decisão estrutural de posicionamento de diretório que afeta 7 arquivos v1 protegidos e reescreveria a história de múltiplos commits já aprovados; claramente fora do escopo de uma correção aditiva de métricas.
3. **Reformular os comentários dos meus 2 novos arquivos para evitar a substring "ocr"** — tecnicamente possível sem tocar em nenhum arquivo protegido, mas seria contornar o guarda por reformulação de texto em vez de resolver a causa raiz, e obscureceria documentação precisa sobre o que o código faz.

Nenhum dos três foi aplicado. O achado fica registrado para decisão humana.

## 5. Consequência prática

`pnpm test` — e portanto, presumivelmente, o pipeline de CI (`typecheck → lint → build → test`, conforme `CLAUDE.md`) — está vermelho para esta branch **desde o Momento 2** (commit `ccd8f8f1627e4f628f8787c36a2b27517a42e29b`), muito antes desta sessão e antes até do Momento 3B.2 originalmente apontado. Isso nunca foi detectado porque `pnpm test` completo nunca foi executado como parte de nenhuma validação anterior desta Sprint — nem na revisão técnica, nem nos Momentos 3C.1/3C.1A/3C.1B.

## 6. Estado do trabalho do Momento 3C.2A (implementação v2 real)

Independente deste achado, a implementação real das 8 funções v2 congeladas está **completa e correta**:

- `associateObservedRegionsToReferenceV2` — cópia auditada da formação de grafo/componentes de v1 + classificação final de 6 vias; teste de equivalência estrutural v1×v2 confirmando mesma partição de ids.
- `computeLocalReaderRegionTextMetricsV2` — contagem por região individual, invariantes verificadas.
- `deriveObservedDescriptionLinesV2` — corrigido durante a implementação (ver commit pretendido): fusão com linha vizinha precisa contribuir uma linha, senão `classifyLocalReaderMultilineDescription` (v1) retorna `"omitted"` antes de verificar `mergedWithNeighborItemText`.
- `deriveMathEvidenceFieldStatesV2` / `classifyLocalReaderMathEvidenceV2` — corrigido durante a implementação: `total`/`subtotalOrTotal` compartilham `col-total-cbdi`; a checagem de integridade agora reconhece uma célula já legitimamente reivindicada por um campo aplicável antes de sinalizar o outro campo, que compartilha a coluna, como violação.
- `deriveViabilityInputsV2` — todos os 12 campos rastreáveis à origem congelada; nenhuma constante mascarando entrada.
- `run-local-reader-evaluation-v2.ts` — executor completo, espelhando a estrutura de v1; código escrito, **nenhuma saída bruta processada nesta etapa**.
- 39 testes reais (região, multilinha, evidência matemática, viabilidade) + 6 testes do novo guarda arquitetural v2 (`local-reader-v2-metric-boundaries.test.ts`) — todos passando.
- `npx tsc --noEmit -p .` limpo; `git diff --check` limpo; toda a suíte v1 relevante + os dois guardas anteriores continuam passando.
- Nenhum arquivo v1 tocado; nenhum resultado v1 alterado; nenhum leitor executado.

**Este trabalho não foi commitado.** Está pronto para commit assim que houver decisão sobre este achado.

## 7. Confirmações desta etapa

- Nenhuma alteração ao guarda `budget-document-location-boundaries.test.ts`.
- Nenhuma alteração a nenhum arquivo v1.
- Nenhuma saída bruta processada.
- Nenhum leitor executado.
- Nenhum commit criado para o Momento 3C.2A.
- Os 2 arquivos protegidos (`supabase/.temp/cli-latest`, `supabase/tests/data-integrity-validation.sql`) permanecem fora do stage.
