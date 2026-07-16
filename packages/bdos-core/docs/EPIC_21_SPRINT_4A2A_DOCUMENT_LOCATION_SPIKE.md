# Epic 21 — Sprint 21.4A.2.a — Reconhecimento Arquitetural e Spike Documental

**Status: Sprint 21.4A.2.a concluída. Reconhecimento e spike descartável, sem persistência definitiva, sem heurística de produção, sem alteração de máquina de estados.** Esta entrega não localiza páginas orçamentárias automaticamente. Próximo incremento proposto: **21.4A.2.b — Catálogo de Sinais e Conjunto de Referência Sintético**.

## 1. Objetivo da Sprint

Produzir, antes de qualquer contrato ou persistência definitiva:

1. Um mapa comprovado (arquivos e símbolos reais) das capacidades já existentes que a futura "Localização Auditável das Páginas Orçamentárias" deve reutilizar, e das lacunas reais que precisará preencher.
2. Um spike local, descartável, com `pdfjs-dist`, contra as páginas físicas 40–60 do documento oficial confirmado por hash, para caracterizar tecnicamente o comportamento do extrator antes de desenhar o catálogo de sinais e o contrato persistente.

## 2. Fronteiras

Sem persistência definitiva, sem migração, sem nova tabela, sem RLS nova, sem Resultado de Localização persistido, sem Decisão de Página definitiva, sem catálogo definitivo de sinais, sem regras definitivas de localização, sem leitura econômica, sem Grupo/Subgrupo/Item de Serviço, sem tratamento de `COT-015`, sem OCR, sem interface, sem rota pública, sem inteligência artificial na decisão, sem alteração do domínio econômico, sem alteração da máquina de estados da Tentativa de Processamento, sem alteração de manifesto de produção (`package.json`/lockfile) para instalar `pdfjs-dist`.

## 3. Estado inicial confirmado

- Repositório: `jrfmartins33-bba/bba-app` (`git remote -v` confirmado).
- `main` local no commit exato esperado: `57fdbe4f3bc5f8d9bcb35218241af3f8e7f2714b` (merge do PR #60, `codex/epic-21-sprint-4a1-document-capability`), `up to date with origin/main`.
- Alteração preexistente e não relacionada: `supabase/.temp/cli-latest` (modified, não preparada, não incluída nesta Sprint).
- `.claude/settings.local.json` e `_local-documents/` confirmados como ignorados pelo Git (`git status --ignored`, `git check-ignore -v`).
- Worktree `bba-app-worktree-principle-008` (branch `claude/principle-008-human-first-visual-ux`, commit `96501c0`) confirmado intacto e não tocado.
- Documento real localizado em `_local-documents/epic-21/lagoa-do-arroz/01_Origem_Edital/05_Anexo_Tecnico_Termo_Referencia.pdf`. SHA-256 calculado localmente: `5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5` — **idêntico** ao hash esperado.
- Branch criada: `claude/epic-21-sprint-4a2a-document-location-spike`, a partir de `main` no commit acima.

## 4. Mapa arquitetural (reconhecimento)

| Capacidade existente | Arquivos/símbolos comprovados | Reutilizável? | Limite da reutilização | Lacuna para a 21.4A.2 |
|---|---|---|---|---|
| Tentativa de Processamento Documental | `packages/bdos-core/src/domain/document-processing/document-processing.ts` (`createDocumentProcessingAttempt`, `completeDocumentProcessingAttempt`, `partiallyCompleteDocumentProcessingAttempt`, `failDocumentProcessingAttempt`, `abandonDocumentProcessingAttempt`), `document-processing.types.ts` | Sim | A fotografia de localização deve se pendurar em `metadata` de uma tentativa `Completed`/`PartiallyCompleted`, ou em um tipo próprio versionado persistido à parte (ver item 6) — nunca criar uma 2ª máquina de estados | Nenhum campo dedicado a "resultado de localização" existe hoje; é aditivo |
| Metadados da Tentativa | `DocumentProcessingMetadata = Readonly<Record<string, unknown>>` (`document-processing.types.ts:1`); coluna `metadata JSONB NOT NULL DEFAULT '{}'` (`supabase/migrations/20260715000000_bdos_document_processing_capability.sql:104`) | Parcial | É JSON livre, sem validação de shape; domínio só faz merge raso em transições | Se o resultado precisar de garantia de shape ao longo do tempo, o padrão correto (item 6) é um tipo próprio com `schemaVersion`, não o `metadata` cru |
| Resolução de arquivo por referência | `DocumentVersion.storageReference` (string opaca) + `isSafeStorageReference()` (`document-processing.ts:284-299`) | Não existe abstração genérica | `storageReference` só é validado como *safe*, nunca resolvido/baixado. Não há `StorageAdapter` compartilhado | Duas responsabilidades distintas e ainda não criadas: um **Resolvedor de Conteúdo Documental** (obtém bytes/fluxo a partir de `storageReference`, seguindo o padrão de acesso já usado em `measurement-bulletin-import-service.ts`) e um **leitor físico de PDF** (recebe uma fonte binária neutra e extrai observações por página). O resolvedor nunca deve conhecer `pdfjs-dist`; o leitor de PDF nunca deve conhecer Supabase. O Serviço de Aplicação coordena os dois. Nenhuma das duas peças foi criada nesta Sprint |
| Leitor de arquivo por formato | `domain/schedule-management/adapters/ms-project-xml-import/*`, `domain/schedule-management/adapters/excel-import/xlsx-reader.ts` (hand-rolled, zero dependência de runtime) | Sim, como precedente de estilo | Não há leitor genérico — cada formato tem leitor próprio e isolado | O leitor de PDF deve seguir a mesma disciplina: mínimo, isolado, sem dependência desnecessária |
| Versionamento de "mecanismo" | `DocumentProcessingAttempt.mechanism: string` (obrigatório) / `mechanismVersion: string \| null` (`document-processing.types.ts:58-59`) | Sim | Campo livre, sem catálogo fechado | Um mecanismo como `"budget-page-location-v1"` se encaixa diretamente, sem alteração de schema |
| Versionamento de schema/parser | `MEASUREMENT_ANALYSIS_RESULT_SCHEMA_VERSION`, `MEASUREMENT_ANALYSIS_PARSER_KEY` (`measurement-bulletin-import.types.ts:277-278`), `PLANNING_DATASET_SCHEMA_VERSION` | Sim, como padrão de referência | É convenção, não infraestrutura compartilhada | A futura Localização deve ter constantes equivalentes (`PAGE_LOCATION_RULES_VERSION`, `PAGE_LOCATION_SCHEMA_VERSION`, versão do perfil de extração) |
| Isolamento por organização | `organizationId`/`company_id` em todo tipo e RLS nas 3 tabelas de `...capability.sql` (mutação restrita a `service_role`, SELECT restrito por `company_id = get_my_company_id()`) | Sim | Nenhum ajuste necessário | — |
| Idempotência e reprocessamento | `requestIdempotencyKey`, `UNIQUE (company_id, document_version_id, request_idempotency_key)`, `outcome: "created" \| "reused"`, `revision` (optimistic locking) | Sim | Já resolvido pela 21.4A.1 | Nenhuma — reutilizar tal como está |
| Reconstrução Documental | `domain/document-reconstruction/*` — modela estrutura lógica pós-extração (seções, campos, fontes de evidência opacas); comentário explícito: *"does not represent a PDF... never renders, calculates, or integrates with any other bounded context"* | Não deve virar dono da ingestão | `sourceId` é sempre opaco, nunca resolvido; guard de arquitetura já proíbe `document-processing` → `document-reconstruction` e vice-versa | Nenhuma sobreposição — domínios permanecem distintos por decisão já ratificada |
| Precedente de arbitragem determinística multi-fonte | `bulletin-sheet-detector.ts` (`findOfficialPeriodColumn` vs. colunas órfãs) | Sim, como padrão conceitual | Não é código reutilizável, é padrão de raciocínio | Localização de página deve seguir a mesma disciplina: decidir determinística e auditavelmente qual candidato é o correto, preservando os demais como sinal auxiliar |
| Guard de arquitetura do document-processing | `packages/bdos-core/src/architecture/document-processing-boundaries.test.ts` | Sim (protege corretamente hoje) | Proíbe textualmente `pdfjs`, `pdf-lib`, `pdf-parse`, `pdfkit`, `pypdf`, `pdfplumber`, `tesseract`, `ocr` dentro de `domain/document-processing`, `services/document-processing` e nos dois arquivos-marcador de `apps/web/lib/bdos` | **Decisão aberta para 21.4A.2.c**: o adaptador de PDF não pode residir nessas pastas vigiadas sem que o guard seja atualizado conscientemente, ou deve residir em capacidade/arquivo fora do escopo hoje escaneado |
| Dependências instaladas | Nenhum `package.json` do monorepo (raiz, `apps/web`, `apps/mobile`, `packages/*`) contém `pdfjs-dist`/`pdf-lib`/`pdf-parse`/`pdfkit`; `pnpm-lock.yaml` sem esses pacotes | — | `pnpm@9.15.0` fixado no `package.json` raiz; sem `.nvmrc`/`engines` (versão de Node não pinada no repositório) | Adicionar `pdfjs-dist` como dependência de produção é decisão ainda não autorizada nesta Sprint |

## 5. Capacidades reutilizáveis (resumo)

Tentativa de Processamento Documental (estados, idempotência, concorrência otimista, isolamento por organização) — 100% reutilizável sem alteração. Convenção de `mechanism`/`mechanismVersion` — reutilizável diretamente. Convenção de `schemaVersion`/`parserKey` observada no Measurement Bulletin Import — reutilizável como padrão, não como código. Disciplina de "leitor mínimo, hand-rolled, isolado por formato" (XML do MS Project, XLSX) — reutilizável como estilo de implementação do futuro adaptador de PDF.

## 6. Lacunas reais

- Não existe resolvedor de conteúdo documental compartilhado (obtenção de bytes/fluxo a partir de `storageReference`) — precisará ser criado como peça própria, separada do leitor físico de PDF, e não nesta Sprint.
- Não existe leitor físico de PDF — precisará ser criado como peça própria, que recebe uma fonte binária neutra (já resolvida) e nunca conhece Supabase.
- Não existe campo tipado para o resultado de localização — hoje só há `metadata` JSON livre.
- Não existe guard de arquitetura ainda para uma futura capacidade de localização de páginas (será necessário criar um, seguindo o padrão de `document-processing-boundaries.test.ts`).
- Não há decisão tomada sobre onde o código que importa `pdfjs-dist` deve fisicamente residir, dado que as pastas hoje mais óbvias para um adaptador de document-processing estão sob proibição textual explícita dessa mesma biblioteca. A decisão recomendada preliminarmente (não definitiva) é: manter domínio e Serviços de Aplicação de `document-processing` livres de `pdfjs-dist`, e colocar a dependência concreta em um adaptador de infraestrutura de uma capacidade irmã, sem enfraquecer o guard atual — caminho físico exato a confirmar na 21.4A.2.c após inspeção das convenções reais do repositório.

## 7. Ambiente do spike

Ambiente temporário, fora da área rastreada, em diretório de scratchpad de sessão (fora do repositório): `pdf-spike-21-4a2a/`, com `package.json` próprio (`"type": "commonjs"`) e uma única dependência instalada via `npm install pdfjs-dist@4.9.155`. Nenhum arquivo desse ambiente foi copiado para o repositório, para `_local-documents` ou para `docs`. Nenhum lockfile ou dependência experimental foi adicionado ao repositório.

## 8. Versão do `pdfjs-dist`

`4.9.155`, build `legacy/build/pdf.mjs` (build Node-alvo da própria biblioteca, ESM). Import via `await import("pdfjs-dist/legacy/build/pdf.mjs")` a partir de um script `.mjs`.

## 9. Perfil experimental de extração

Identificação local: `pdfjs-text-items-spike-v1`.

- `getDocument({ data, useSystemFonts: true, disableFontFace: true, isEvalSupported: false })` — sem worker dedicado (build *legacy* funciona em Node sem configuração adicional de worker; nenhum erro relativo a worker foi observado).
- Ordenação: preservada exatamente como entregue por `page.getTextContent()` — nenhuma reordenação foi aplicada.
- Normalização: NFC + colapso de espaços/tabs + colapso de quebras de linha ao redor de `\n`, aplicada apenas para o cálculo do hash de auditoria (o texto usado para métricas de qualidade não foi normalizado).
- Critério de item útil: item cujo `str.trim().length > 0`.
- Transformação pós-extração: nenhuma além da normalização acima; nenhuma correção, nenhum preenchimento.

## 10. Método de processamento

Para cada página física 40–60 (índices técnicos 39–59): abertura via `doc.getPage(n)`, leitura de `getViewport({scale:1})` (dimensões), leitura de `getTextContent()` (itens), cálculo de métricas, `page.cleanup()` ao final de cada página, `doc.destroy()` ao final do documento. Nenhuma outra página das 1.033 foi processada. Nenhuma chamada de rede, IA ou OCR.

## 11. Métricas agregadas (janela 40–60, 21 páginas)

| Métrica | Valor |
|---|---|
| Total de páginas no documento | 1.033 (confirmado, `doc.numPages`) |
| Páginas processadas no spike | 21 (físicas 40–60) |
| Itens textuais totais na janela | 12.965 |
| Itens não-vazios | 6.941 |
| Caracteres de substituição (U+FFFD) em toda a janela | 0 |
| Caracteres de controle inesperados em toda a janela | 0 |
| Tempo de extração por página | mín. 1,99 ms — máx. 59,92 ms |
| Heap JavaScript (`heapUsed`) antes/depois da janela — **não medido**: `rss`, `heapTotal`, `external`, `arrayBuffers` | 46,90 MB → 58,91 MB (delta 12,01 MB para 21 páginas, incluindo páginas com >1.400 itens). Ver item 18 para o escopo e as limitações desta medição |
| Recursos liberados | Sim — `page.cleanup()` por página e `doc.destroy()` ao final, sem erro |

## 12. Observações por página/grupos (achado geométrico)

Sem reproduzir conteúdo sensível — apenas dimensões físicas (largura × altura, em pontos) e contagem de itens, que são metadados técnicos, não conteúdo econômico:

| Grupo de páginas físicas | Dimensão (pt) | Itens (mín–máx) | Observação técnica |
|---|---|---|---|
| 40–42 | 595×842 (retrato A4) | 21–67 | Baixa densidade de itens, texto corrido |
| 43 | 842×595 (paisagem A4) | 319 | Página isolada de orientação diferente das vizinhas |
| 44 | 595×842 (retrato A4) | 19 | Baixíssima densidade — compatível com página de capa/contexto |
| 45 | 595×842 (retrato A4) | 128 | Densidade intermediária — compatível com página de resumo |
| **46–54** | **1190,52×841,92 (paisagem larga)** | **326–1.454** | **Mudança de geometria sustentada por 9 páginas consecutivas; item de cabeçalho repetido (mesma posição x/y, mesma fonte `g_d0_f17`, mesmo comprimento) em todas elas; página 54 destoa das demais do grupo por ter contagem de itens (326) muito menor que as anteriores (600–1.454), compatível com página de fechamento** |
| 55–57 | 595×842 (retrato A4) | 635–850 | Retorno à geometria retrato; família de item repetido própria (posição/fonte `g_d0_f14`), distinta da família 46–54 |
| 58–60 | 841,92×1190,52 (outra proporção larga) | 1.409–1.476 | Terceira geometria distinta, com item repetido próprio (posição/fonte também `g_d0_f14`, mas coordenadas diferentes de 55–57) |

Nenhuma dessas observações foi usada para implementar uma regra de produção — são caracterização técnica da janela, sustentando a proposta de sinais do item 20.

## 13. Qualidade da extração

Nenhum caractere de substituição, nenhum caractere de controle inesperado em nenhuma das 21 páginas processadas. A extração textual, dentro desta janela, é tecnicamente limpa. **Isto não permite concluir que as 1.033 páginas do documento sejam igualmente limpas** — outras janelas (por exemplo anexos digitalizados) não foram testadas nesta Sprint.

## 14. Texto degradado

Não observado na janela 40–60. Nenhuma página apresentou razão de caracteres de substituição ou de controle acima de zero. A infraestrutura de medição (proporção de substituição, proporção de controle) está implementada no script do spike e pronta para ser reaproveitada como métrica formal na 21.4A.2.b — mas os limiares de "degradado" ainda não têm evidência empírica de um caso positivo real dentro do documento, e não devem ser fixados sem ela.

## 15. Comportamento de fragmentação

Itens de um único caractere e itens fragmentados (≤2 caracteres úteis) aumentam de forma visível nas páginas 46–54 e 58–60 (dezenas por página) em comparação com 40–42/44 (0 a poucas unidades) — consistente com estrutura tabular (números, unidades, separadores decimais tendem a virar itens curtos isolados). Este é um sinal técnico observável, não uma regra.

## 16. Comportamento de ordem

A ordem bruta entregue por `getTextContent()` foi preservada sem alteração. Dentro de cada grupo de geometria estável (ex. 46–54), o item de cabeçalho aparece sempre como um dos primeiros itens da página, na mesma posição — sugerindo que a ordem de entrega, para este documento, aproxima a ordem de leitura visual em blocos superiores da página, mas isso não foi testado exaustivamente linha a linha.

## 17. Disponibilidade de coordenadas

Disponíveis via `item.transform[4]` (x) e `item.transform[5]` (y), junto com `item.width`/`item.height`. Estáveis dentro da mesma execução. **Conforme decidido previamente, coordenadas não são requisito do contrato desta fatia** — foram usadas apenas para caracterização técnica (item 12) e para observar repetição de cabeçalho como candidato a sinal de continuidade. O índice do item textual, combinado com um trecho mínimo, é suficiente para a evidência mínima proposta no item 19.

## 18. Consumo diagnóstico de memória

**Correção de escopo desta métrica**: o spike mediu somente `process.memoryUsage().heapUsed` — o heap do JavaScript. Não foram medidos `rss`, `heapTotal`, `external` nem `arrayBuffers`. O PDF foi fornecido ao `pdfjs-dist` como `data` (buffer já carregado em memória), portanto esta medição **não prova** que o arquivo binário completo deixou de permanecer em memória durante o processamento, nem caracteriza o custo total do processo (que inclui memória fora do heap V8, onde bibliotecas nativas/WASM e buffers grandes tipicamente residem).

O único resultado confirmado é: **não houve crescimento anômalo perceptível do heap JavaScript durante a janela 40–60** (delta de 12,01 MB para 21 páginas, incluindo várias com mais de 1.000 itens textuais cada), e `page.cleanup()`/`doc.destroy()` executaram sem erro.

**Não é possível concluir ainda** que a estratégia de leitura (página a página vs. documento inteiro em memória) seja adequada para o processamento completo das 1.033 páginas — essa conclusão exigiria medir o processo completo, não apenas uma janela de 21 páginas com um subconjunto de métricas.

Para uma fase futura, registra-se a necessidade de medir, com o documento completo ou uma amostra maior: `rss`, `heapUsed`, `heapTotal`, `external`, `arrayBuffers`, tamanho da fonte binária fornecida ao `pdfjs-dist`, e o comportamento de cada uma dessas métricas antes e depois de `doc.destroy()`. Esta Sprint não processou o documento completo e não deve ser lida como validação de custo de memória em escala.

## 19. Evidência mínima recomendada — tecnicamente viável, provisoriamente suficiente

A proposta avaliada (hash do documento + página física + índice técnico + versão do `pdfjs-dist` + versão do adaptador + versão do perfil de extração + índice do item textual + trecho original mínimo + trecho normalizado + identificador do sinal + código da regra) é **tecnicamente viável e provisoriamente suficiente, condicionada à confirmação de repetibilidade entre execuções independentes com o mesmo documento, versão da biblioteca, versão do adaptador e perfil de extração**. Esta Sprint executou uma única extração da janela 40–60 — não há, ainda, evidência de que uma segunda execução independente produza o mesmo hash normalizado, a mesma contagem/ordem de itens e os mesmos índices associados aos mesmos trechos. Nenhum campo da proposta se mostrou dispensável nesta única execução — em particular, a versão do *perfil de extração* separada da versão da *biblioteca* é justificada: as opções passadas a `getDocument` (`useSystemFonts`, `disableFontFace`, `isEvalSupported`) afetam o que é observável sem mudar a versão do pacote instalado. Coordenadas geométricas permanecem fora do contrato desta fatia (não se tornam campo obrigatório).

**Critério obrigatório para a 21.4A.2.b**, antes de qualquer persistência definitiva do contrato: executar pelo menos duas extrações independentes da mesma fixture; comparar o hash do texto normalizado entre as execuções; comparar quantidade e ordem dos itens; verificar a estabilidade dos índices usados nas evidências; e verificar que cada índice permanece associado ao mesmo trecho nas duas execuções.

## 20. Sinais preliminares (caracterização, não catálogo definitivo)

Observáveis nesta janela, como famílias, não como grafias fixas — nenhum foi transformado em regra:

- **Mudança de geometria de página** (largura/altura) como candidato a sinal estrutural de fronteira de seção — achado novo deste spike, não previsto no plano original.
- **Item de cabeçalho repetido** (mesma posição relativa + mesma fonte + mesmo comprimento) como candidato a sinal de continuidade entre páginas de um mesmo bloco.
- **Aumento de itens fragmentados/de caractere único** como candidato a sinal (fraco, auxiliar) de presença tabular.
- Sinais lexicais previstos no planejamento original (menção a "Planilha Orçamentária", cabeçalhos de coluna, BDI, fechamento) **não foram extraídos ou lidos nesta Sprint** — ficam para a 21.4A.2.b, quando o catálogo for desenhado com testes positivos e negativos, incluindo estruturas sintéticas materialmente diferentes da real.

## 21. Riscos

1. **Guard de arquitetura vs. biblioteca de PDF** (novo, encontrado nesta Sprint): `document-processing-boundaries.test.ts` proíbe textualmente `pdfjs` dentro de `domain/document-processing` e `services/document-processing`. Precisa de decisão consciente na 21.4A.2.c (ver item 24).
2. **Ausência de Resolvedor de Conteúdo Documental compartilhado**: se essa responsabilidade não for extraída como peça própria e separada do leitor de PDF, há risco de o leitor físico de PDF acabar conhecendo Supabase (ou o resolvedor acabar conhecendo `pdfjs-dist`), violando a separação de responsabilidades recomendada, além de risco de duplicação do padrão de acesso já existente em `measurement-bulletin-import-service.ts`.
3. **Janela 40–60 não representa o documento inteiro**: qualidade de extração só foi validada numa fatia pequena; páginas digitalizadas/degradadas em outras partes do documento não foram observadas.
4. **Geometria como sinal é nova e não testada contra falso positivo**: um documento diferente pode ter mudança de geometria sem relação com orçamento (ex. um mapa ou desenho técnico anexado). Não deve ser usada como sinal único.
5. **`metadata` JSON livre não é o padrão recomendado pelo próprio repositório** para resultados que precisam de garantia de shape ao longo do tempo — reforça a necessidade de um tipo próprio versionado (item 24.3 abaixo).

## 22. Governança da fonte documental

Classificação conservadora mantida, na ausência de autorização adicional explícita:

**Autorizado nesta Sprint:**
- Processamento local do caso, exclusivamente para validação técnica interna do spike.
- Cálculo de hash, contagem de páginas, métricas agregadas e geometria, sem conteúdo textual identificável.

**Não autorizado, sem confirmação explícita adicional:**
- Conversão de qualquer trecho do documento real em fixture commitada.
- Benchmark entre organizações.
- Exposição comercial de conteúdo do documento.
- Reutilização de trechos identificáveis (nomes, valores, códigos, formatação exclusiva) em qualquer catálogo de sinais.
- Compartilhamento externo ou uso como material de treinamento.

Nenhum conteúdo textual do documento foi incluído neste relatório — apenas hash, contagem de páginas, dimensões físicas e contagens de itens, que são metadados técnicos e não têm valor comercial ou sensível isoladamente.

**Nota adicional (herdada da discussão de arquitetura que precedeu esta Sprint):** a fonte documental pertence a uma empresa com a qual há relação comercial ativa em curso, não apenas uma fonte anônima. Antes de qualquer fixture "inspirada" na estrutura real ser criada na 21.4A.2.b, é exigida **autorização explícita, documentada e rastreável** dessa empresa — não uma confirmação informal — para o uso do *padrão estrutural* (não do conteúdo) na construção e nos testes do produto que está sendo vendido a essa mesma empresa.

Sem essa autorização explícita, documentada e rastreável:
- nenhuma fixture poderá ser derivada diretamente do documento real;
- nenhuma transformação automática ou manual do conteúdo real poderá ser commitada;
- fixtures deverão ser sintéticas e independentes, sem derivação do documento real;
- observações conceituais desta Sprint (famílias de sinais, geometria, fragmentação) poderão orientar a construção de famílias genéricas de sinais, desde que não reproduzam conteúdo, valores, códigos, nomes ou formatação identificável do documento real.

## 23. Recomendações para a Sprint 21.4A.2.b

- **Catálogo preliminar de famílias de sinais**: referencial (menção/índice), estrutural (cabeçalhos de coluna combinados), continuidade (repetição de cabeçalho + geometria estável), fechamento (total geral + quebra de padrão tabular + retorno de geometria).
- **Métricas de qualidade a formalizar**: proporção de caracteres de substituição, proporção de caracteres de controle inesperados, proporção de itens fragmentados — infraestrutura de cálculo já escrita no spike, pronta para virar detector versionado.
- **Limiares**: nenhum ainda aprovado; nenhum caso positivo real de degradação foi observado na janela testada — qualquer limiar de "degradado" precisa de uma fixture sintética deliberadamente degradada, não de um número arbitrário.
- **Fixtures sintéticas necessárias**: ao menos duas estruturas orçamentárias materialmente distintas (uma podendo ecoar o padrão real via fixture sintética, uma estruturalmente diferente — ordem de colunas, rótulo de BDI, forma de fechamento) e ao menos três falsos positivos (índice/sumário, tabela financeira não orçamentária, cronograma físico-financeiro), incluindo um adversarial.
- **Riscos prioritários a endereçar primeiro**: o guard de arquitetura (item 21.1) e a separação entre Resolvedor de Conteúdo Documental e leitor físico de PDF (item 21.2), pois ambos afetam onde e como o código da 21.4A.2.c poderá ser escrito. Nenhuma dessas duas capacidades deve ser criada antes da 21.4A.2.c.
- **Plano mínimo**: fechar o catálogo e as fixtures antes de tocar em contrato persistente (21.4A.2.c), mantendo a ordem já acordada spike → catálogo → contrato → persistência.

## 24. Decisões ainda abertas

1. **Onde o leitor físico de PDF deve residir fisicamente**, dado que `domain/document-processing` e `services/document-processing` estão sob proibição textual explícita de `pdfjs` — decidir entre (a) atualizar conscientemente o guard existente para permitir um arquivo específico e nomeado, ou (b) criar uma capacidade/domínio irmão (ex. `document-location`) com guard próprio, nunca importado por `document-processing` no sentido inverso. Nenhuma das duas foi escolhida nesta Sprint. Decisão recomendada, ainda não ratificada: manter domínio e Serviços de Aplicação de `document-processing` livres de `pdfjs-dist`, sem enfraquecer o guard atual, e colocar a dependência concreta em um adaptador de infraestrutura de uma capacidade irmã.
2. **Separação física entre Resolvedor de Conteúdo Documental e leitor de PDF**: os dois papéis foram distinguidos conceitualmente nesta Sprint (item 6), mas nenhum dos dois foi criado, e o caminho exato de cada um (arquivo/pasta) não foi decidido — fica para a 21.4A.2.c, após inspeção das convenções reais do repositório.
3. **Forma final de persistência do resultado**: `metadata` JSON livre da Tentativa vs. um tipo próprio versionado (seguindo o precedente de `MeasurementAnalysisResult`) — inclinação para a segunda opção, não decidida.
4. **Formato final de referência à evidência posicional** (índice do item + trecho, sem coordenada obrigatória) — considerado tecnicamente viável e provisoriamente suficiente pelo spike (ver item 19), mas o *shape* exato do tipo ainda não foi desenhado e depende de confirmação de repetibilidade.
5. **Se geometria de página vira sinal formal de primeira classe ou apenas um sinal auxiliar de continuidade** — precisa de mais de um documento real/sintético para não virar regra específica deste caso.
6. **Nome final da capacidade/mecanismo** (`budget-page-location-v1` foi usado apenas como exemplo, não como decisão).

## 25. Ações expressamente proibidas até nova aprovação

- Implementar qualquer heurística de decisão de página em código de produção.
- Adicionar `pdfjs-dist` (ou qualquer parser de PDF/OCR) a qualquer `package.json` do monorepo.
- Criar tabela, migração, política RLS ou repositório para resultado de localização.
- Alterar `document-processing-boundaries.test.ts` sem decisão explícita registrada.
- Alterar a máquina de estados de `DocumentProcessingAttempt`.
- Criar fixture derivada do documento real sem a confirmação de governança do item 22.
- Processar as 1.033 páginas completas (reservado para 21.4A.2.f, após catálogo, contrato e regras estarem definidos).
