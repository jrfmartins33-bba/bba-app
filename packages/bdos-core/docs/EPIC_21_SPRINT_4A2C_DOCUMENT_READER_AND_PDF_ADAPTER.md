# Epic 21 — Sprint 21.4A.2.c — Contrato de Leitura Documental e Adaptador de Extração de PDF

**Status: concluída.** Cria a fronteira entre os bytes de um PDF e as observações físicas de suas páginas: contrato puro no domínio `budget-document-location` e adaptador concreto baseado em `pdfjs-dist`, fisicamente isolado sob `infrastructure/`. Não localiza páginas orçamentárias, não aplica o catálogo de sinais da Sprint 21.4A.2.b, não decide nada. Próximo incremento: mecanismo de associação entre observações físicas e catálogo (fora do escopo desta Sprint).

## 1. Objetivo

Responder apenas "o que foi fisicamente observado em cada página do documento?" — nunca "quais páginas contêm o orçamento?". Entregar: contrato de leitura física; porta `PhysicalDocumentReader`; adaptador `pdfjs-dist`; resultado determinístico, versionado e auditável; testes sintéticos; guard arquitetural; documentação.

## 2. Fronteiras

Entrada obrigatória: `Uint8Array`. Sem download de storage, sem resolvedor `storageReference → bytes`, sem URL assinada, sem banco de dados, sem persistência, sem Serviço de Aplicação, sem rota, sem interface, sem fila, sem processamento assíncrono, sem OCR, sem IA, sem localização de páginas, sem score, sem limiar arbitrário, sem leitura econômica, sem catálogo de sinais aplicado automaticamente.

## 3. Contrato

`packages/bdos-core/src/domain/budget-document-location/physical-document-read.types.ts`. `PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION = 1`, `PHYSICAL_DOCUMENT_READER_NAME = "physical-document-reader"`, `PHYSICAL_DOCUMENT_READER_VERSION = "physical-document-reader-v1"`. Independente de qualquer biblioteca concreta de extração — guard arquitetural garante que o domínio nunca importa `pdfjs-dist` (ver seção 12 do brief e seção 8 deste documento).

`PhysicalDocumentReadResult`: `schemaVersion`, `readerName`, `readerVersion`, `adapterVersion`, `underlyingLibraryVersion` (metadado auxiliar, nome de campo deliberadamente genérico, não parte da chave de repetibilidade funcional), `sourceByteHash` (SHA-256 hex dos bytes originais, sem alteração), `totalPageCount`, `pages`, `status`, `technicalProblems` (nível `document`).

`PhysicalDocumentReadStatus`: `completed` | `completed_with_page_failures` | `failed` — deriva exclusivamente de fatos técnicos observados (documento abriu ou não; alguma página teve problema técnico ou não), nunca de score ou limiar.

## 4. Fluxo de dados

```
Uint8Array (bytes imutáveis)
    ↓
PhysicalDocumentReader.read(bytes)
    ↓
PhysicalDocumentReadResult (observações físicas por página)
    ↓
[fora do escopo] mecanismo futuro de localização
```

## 5. Localização arquitetural

Contrato puro em `domain/budget-document-location/` (já existente, ver Sprint 21.4A.2.b). Adaptador concreto em `packages/bdos-core/src/infrastructure/budget-document-location/pdfjs/` — primeira pasta `infrastructure/` do pacote.

Reconhecimento prévio encontrou dois padrões já consolidados no repositório, nenhum diretamente aplicável sem ressalva:

- `domain/schedule-management/adapters/{excel-import,ms-project-xml-import}/`: adaptadores hand-rolled, **zero dependência de runtime**, vivendo dentro do próprio domínio. Não se aplica aqui: extração de texto de PDF (fontes, CMaps, streams comprimidos, estrutura de xref) não é comparável em complexidade a XML/XLSX hand-rolled, e o guard já existente de `budget-document-location-boundaries.test.ts` (anterior a esta Sprint) já proíbe a palavra `pdfjs` em qualquer arquivo sob `domain/budget-document-location`, inclusive uma eventual subpasta `adapters/`.
- `domain/decision-case/adapters/engineering-business-facts/`: um "adapter" no sentido de tradução domínio-a-domínio (BusinessFact → DecisionCase), sem dependência externa concreta. Categoria diferente do que esta Sprint precisa (um adaptador de infraestrutura em torno de uma biblioteca de terceiros).

Nenhuma implementação de repositório concreto (Supabase) existe em `packages/bdos-core` — todo acesso a Supabase fica em `apps/web`, por regra de Engine/Studio. `pdfjs-dist` não tem esse problema: é uma biblioteca computacional pura, sem armazenamento nem sessão, então permanece no Engine (`bdos-core`), apenas fisicamente fora do domínio.

## 6. Porta

```ts
export interface PhysicalDocumentReader {
  read(bytes: Uint8Array): Promise<PhysicalDocumentReadResult>;
}
```

Não conhece origem, armazenamento, persistência, `pdfjs-dist`, orçamento econômico ou localização de páginas.

## 7. Adaptador

`packages/bdos-core/src/infrastructure/budget-document-location/pdfjs/pdfjs-physical-document-reader.ts`, exportado como `pdfjsPhysicalDocumentReader` via `index.ts` do mesmo diretório. `PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION = "pdfjs-physical-document-reader-adapter-v1"`.

Fluxo: hash SHA-256 dos bytes originais primeiro (sempre, mesmo em falha documental) → bytes vazios tratados sem carregar a biblioteca → `pdfjs.getDocument({ data: bytes.slice(), standardFontDataUrl, verbosity: 0 })` → falha de abertura classificada e retornada → por página: `getPage` (falha isolada não aborta o documento) → `getViewport({ scale: 1 })` (independente) → `getTextContent()` (independente) → normalização + métricas (funções puras do domínio) → `page.cleanup()` em `finally` → `doc.cleanup()` + `loadingTask.destroy()` em `finally` do documento inteiro.

### Achado empírico crítico: posse do `Uint8Array`

O JSDoc de `DocumentInitParameters.data` da própria biblioteca documenta que um `TypedArray` passado pode ser "transferido" e ter sua posse tomada. Confirmado empiricamente: sem cópia, uma segunda leitura reaproveitando a mesma referência de bytes observava um buffer já esvaziado (hash da leitura vazia, `e3b0c442...`, em vez do hash real). O adaptador sempre entrega `bytes.slice()` à biblioteca — nunca a referência do chamador — preservando a garantia de bytes imutáveis da porta.

## 8. Biblioteca e versão utilizada

`pdfjs-dist@6.1.200`, adicionada como dependência direta de `@bba/bdos-core` (`pnpm add pdfjs-dist`, resolvido automaticamente pelo `pnpm-lock.yaml` do monorepo). Não havia nenhuma referência prévia a `pdfjs-dist` em todo o monorepo (lockfile e árvore de `node_modules` confirmados antes da instalação).

Investigação empírica (nesta ordem, conforme exigido):

1. Entrada principal (`import "pdfjs-dist"`) requer `DOMMatrix` e falha em Node puro (`ReferenceError: DOMMatrix is not defined`) — a própria biblioteca avisa em runtime: *"Please use the legacy build in Node.js environments."*
2. `pdfjs-dist/legacy/build/pdf.mjs` funciona em Node sem nenhum shim de DOM.
3. Nenhum worker precisou ser configurado — a biblioteca usa fallback síncrono automático quando `GlobalWorkerOptions.workerSrc` não é definido, verificado empiricamente (nenhum erro, nenhum warning relacionado a worker).
4. `standardFontDataUrl` resolvido via caminho relativo a partir do próprio arquivo do adaptador (`new URL("../../../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url)`), não via `import.meta.resolve` — sua tipagem TypeScript ambiente não está garantidamente disponível sob o `lib`/`module` deste pacote, e sua disponibilidade em runtime entre versões do Node não fazia parte do escopo investigado. `pdfjs-dist` é dependência direta de `@bba/bdos-core`, então o pnpm sempre o symlinka no `node_modules` do próprio pacote, tornando o caminho relativo estável independentemente de hoisting do monorepo.
5. A opção `isEvalSupported`, presente em versões antigas da biblioteca, **não existe** em `DocumentInitParameters` da v6.1.200 (`tsc` rejeitou a tentativa inicial de usá-la) — removida, não usada.
6. `getDocument(...)` não expõe `.destroy()` nem `.cleanup()`; esses métodos pertencem a `PDFDocumentLoadingTask.destroy()`, `PDFDocumentProxy.cleanup()` e `PDFPageProxy.cleanup()` respectivamente — confirmado lendo `types/src/display/api.d.ts` da versão instalada, não por suposição.

## 9. Versionamento do contrato

Quatro versões distintas, nunca confundidas: `schemaVersion` (formato do resultado), `readerVersion` (contrato conceitual do domínio), `adapterVersion` (esta implementação concreta), `underlyingLibraryVersion` (metadado técnico de proveniência, ex.: `"pdfjs-dist@6.1.200"`, `null` quando a biblioteca nunca chegou a ser carregada — caso de bytes vazios). O adaptador não depende da versão do catálogo de sinais da Sprint 21.4A.2.b.

## 10. Normalização

`packages/bdos-core/src/domain/budget-document-location/physical-document-text-normalization.ts`, pura, independente de `pdfjs-dist`. Regra, por item, nesta ordem: `\r\n`/`\r` → `\n`; sequências de espaço/tabulação consolidadas em um único espaço; espaços finais removidos. Itens processados unidos com `\n`, um item por linha — regra estrutural fixa (limite de item = limite de linha), não reconstrução de linha visual a partir de coordenada, alinhamento ou fonte, que a função nunca recebe. Não corrige palavras, não reconstrói colunas, não altera números ou separadores decimais. Texto original (`PhysicalDocumentTextItem.text`) e texto normalizado (`PhysicalDocumentPage.normalizedText`) permanecem sempre campos distintos.

Regra deliberadamente **não** aplicada: espaço inicial de um item não é removido, apenas consolidado se houver múltiplos — só a remoção de espaços *finais* está autorizada pelo brief da Sprint.

## 11. Tratamento de falhas

Três categorias distintas, nunca confundidas:

- **Falha documental** (`document_bytes_empty`, `document_invalid_structure`, `document_protected`, `document_open_failed`): impede a obtenção da estrutura de páginas. `status: "failed"`, `pages: []`, `totalPageCount: 0`.
- **Falha de página** (`page_load_failed`, `page_geometry_unavailable`, `page_text_extraction_failed`): o documento abriu, mas uma página específica não pôde ser totalmente processada. `status: "completed_with_page_failures"` no documento; a página tem `extractionAvailability: "extraction_failed"` e ao menos um problema técnico.
- **Ausência de texto** (`extractionAvailability: "no_extractable_text"`, zero problemas técnicos): página processada com sucesso, zero itens textuais. Não é falha.

Geometria e texto são tentados de forma independente por página: uma falha de geometria não impede a tentativa de extração textual, e vice-versa — uma página pode carregar até dois problemas técnicos simultaneamente.

Classificação de falha documental usa `instanceof pdfjs.InvalidPDFException` e `instanceof pdfjs.PasswordException` (ambas exportadas publicamente pela biblioteca, confirmado antes do uso) — nunca o texto da mensagem. `UnknownErrorException`, observada durante a investigação de falha de página, **não** é exportada publicamente pela versão instalada; erros desse tipo (e qualquer erro não classificado) recebem o código genérico correspondente (`document_open_failed` ou o código de fase de página aplicável), nunca uma classificação inventada.

## 12. Problemas técnicos normalizados

`physical-document-technical-problem.ts`: `createTechnicalProblem(code, level, pageNumber)` é o único ponto de criação, com mensagem controlada em português por código (`TECHNICAL_PROBLEM_MESSAGE_BY_CODE`) — nunca a mensagem bruta da biblioteca, nunca stack trace. Oito códigos estáveis: `document_bytes_empty`, `document_invalid_structure`, `document_protected`, `document_open_failed`, `page_load_failed`, `page_geometry_unavailable`, `page_text_extraction_failed`, `page_processing_failed` (reservado, não emitido pelo caminho atual do adaptador — todas as falhas de página observadas caem em uma das três fases nomeadas). Estrutura pronta para tradução futura por uma camada de apresentação (código → mensagem apresentável ao usuário), sem acoplar o domínio a essa redação final.

## 13. Métricas objetivas

`physical-document-page-metrics.ts`, calculadas sobre o texto originalmente extraído (antes da normalização), por codepoint (não por unidade UTF-16, evitando contar pares substitutos incorretamente):

- **Caracteres não vazios**: codepoints que não correspondem a `/\s/u` (espaço, tabulação, quebras de linha, separadores Unicode de espaço, incluindo NBSP). Testado com NBSP real (U+00A0).
- **Caracteres de substituição**: contagem exata de U+FFFD.
- **Caracteres de controle inesperados**: C0 (`U+0000`–`U+001F`) exceto TAB/LF/CR (legitimamente usados pela normalização), mais DEL (`U+007F`), mais C1 (`U+0080`–`U+009F`). Testado com SOH, DEL e um controle C1 real, e separadamente com TAB/LF/CR confirmando contagem zero.

As três contagens são independentes, não mutuamente exclusivas (um caractere de substituição também conta como não vazio) — deliberado, cada métrica documenta seu próprio critério.

## 14. Testes

- `domain/budget-document-location/physical-document-read.test.ts` (24 testes): versões do contrato; `derivePageOrientation` (retrato, paisagem, indeterminado por dado ausente/inválido/quadrado); `normalizePageText` (todas as regras, determinismo); `computePageTextMetrics` (todas as três contagens, sobreposição, determinismo); `createTechnicalProblem` (wiring, mensagem estável).
- `infrastructure/.../pdfjs/pdfjs-physical-document-reader.test.ts` (25 testes): os 23 casos mínimos da Sprint (PDF válido de 1 e N páginas; ordem física; numeração física; retrato; paisagem com troca de dimensão já aplicada pela biblioteca; página sem texto; bytes inválidos; bytes vazios; hash estável; ordem estável de itens; normalização repetível; repetibilidade completa de duas leituras; disponibilidade distinta de qualidade; erro distinto de ausência de texto; ausência de decisão; códigos controlados; ausência de stack trace/caminho absoluto; versões presentes; geometria preservada; métricas corretas; leituras sequenciais sem degradação) mais 2 casos extras (cabeçalho truncado; `totalPageCount` consistente).
- `architecture/budget-document-location-pdf-adapter-boundaries.test.ts` (7 testes): guard novo da infraestrutura (seção 8 abaixo).
- `architecture/physical-document-read-no-decision-boundaries.test.ts` (2 testes): proteção explícita contra vocabulário decisório, tanto nos nomes de campo declarados no contrato quanto nas chaves de um resultado real produzido pelo adaptador contra um PDF sintético.

Fixtures: **nenhum arquivo PDF binário no repositório**. `infrastructure/.../pdfjs/testing/synthetic-pdf-bytes.ts` monta bytes de PDF mínimos válidos byte a byte (objetos indiretos, tabela xref, trailer) em código puro, incluindo uma técnica determinística de corrupção controlada (apontar a entrada de xref de uma página específica para dentro do cabeçalho `%PDF-1.4`) para reproduzir uma falha de página isolada sem depender de nenhum documento real. Não exportado pela API pública do adaptador. Nenhum arquivo de `_local-documents` foi acessado.

## 15. Repetibilidade

Testada por leitura dupla dos mesmos bytes comparando: hash, contagem de páginas, ordem, numeração física, geometria (largura/altura/rotação), orientação, itens textuais e seus índices, texto normalizado, métricas, todas as versões, status e códigos/mensagens de problemas técnicos — via `JSON.stringify` do resultado completo (não há, neste contrato, nenhum campo documentado como não determinístico a excluir da comparação). Válida para os mesmos bytes, mesma versão de schema/leitor/adaptador/biblioteca concreta.

## 16. Limitações

- `page_processing_failed` está definido e coberto pelo guard/teste de vocabulário controlado, mas não foi observado nem exercitado por uma fixture sintética dedicada — nenhuma falha de página construída durante a investigação caiu fora das três fases nomeadas (carregamento, geometria, texto).
- `PasswordException` (`document_protected`) está mapeada e implementada, mas não exercitada por uma fixture de PDF criptografado sintético — construir um PDF `/Encrypt` válido à mão estava fora do custo-benefício desta Sprint, e a Sprint não exige esse caso entre os 23 mínimos.
- A normalização "um item = uma linha" é uma regra estrutural, não uma reconstrução de linha visual: para itens de extração que não correspondem a uma linha visual real (comum em tabelas), o texto normalizado pode não ser diretamente legível como texto corrido — deliberado, documentado, não é defeito.
- `standardFontDataUrl` é resolvido por caminho relativo a partir do arquivo do adaptador; se a estrutura de `node_modules` do pacote mudar (ex.: gerenciador de pacotes diferente, hoisting não isolado), o caminho relativo precisará ser revisado.

## 17. Decisões abertas

Nenhuma decisão de produto ficou pendente para além do que a Sprint já define — a única decisão técnica genuinamente aberta é se `page_processing_failed` deve permanecer como código de reserva ou ser removido caso uma sprint futura confirme que as três fases nomeadas são de fato exaustivas.

## 18. Próximo incremento

Mecanismo de associação entre as observações físicas deste leitor e o catálogo de 23 sinais da Sprint 21.4A.2.b, para localizar páginas orçamentárias candidatas — explicitamente fora do escopo desta Sprint. `storageReference → bytes` também permanece fora de escopo.
