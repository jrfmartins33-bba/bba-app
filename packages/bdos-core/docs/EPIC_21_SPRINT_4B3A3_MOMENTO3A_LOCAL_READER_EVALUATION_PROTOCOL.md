# Epic 21 — Sprint 21.4B.3A.3 — Momento 3A — Protocolo de Avaliação de Leitores Locais

**Status: pré-registro do protocolo de avaliação, ANTES de qualquer execução real do Docling ou do PaddleOCR sobre as páginas 46, 50 ou 54.** Este documento e o código que ele referencia congelam o formato canônico diagnóstico, as regras de normalização, o mapeamento de coordenadas, o algoritmo de comparação e as métricas — testados exclusivamente contra casos sintéticos construídos à mão. Nenhum leitor real foi executado contra o recorte real até este commit. Depois da primeira execução real (Momento 3B), nenhuma mudança semântica é permitida neste protocolo (§12 do enunciado desta etapa) — apenas uma correção de implementação, e somente com prova objetiva de divergência entre código e protocolo.

## 0. Estado de partida

- Base: `ccd8f8f1627e4f628f8787c36a2b27517a42e29b` (commit `test(architecture): preregister structured budget reconstruction reference`, Momento 2 desta Sprint — verdade de referência estruturada das páginas 46/50/54, congelada e aprovada).
- Branch: `claude/epic-21-sprint-4b3a3-structured-reference-truth` (mesma branch do Momento 2; nenhum PR aberto ainda para a Sprint 21.4B.3A.3).
- Arquivos protegidos (`supabase/.temp/cli-latest`, `supabase/tests/data-integrity-validation.sql`): fora do stage, não tocados por este Momento.

## 1. Escopo desta etapa (Momento 3A) e decisão de fatiamento adotada

O enunciado do Momento 3 pede, no Momento 3A: "definir e versionar o protocolo; definir o formato canônico diagnóstico; definir as regras de normalização; definir o mapeamento de coordenadas; definir o algoritmo de comparação; definir as métricas; testar o avaliador apenas com casos sintéticos". Uma decisão de fatiamento foi necessária e é registrada aqui explicitamente, para aprovação:

- O **formato canônico diagnóstico** (§5), a **normalização de texto** (§6), o **mapeamento de coordenadas** (§7), o **algoritmo de comparação** (§8), as **métricas** (§9), a **classificação de viabilidade** (§10) e o **classificador de diferenças de repetição** (§11) são **agnósticos de ferramenta** — operam inteiramente sobre o formato canônico e sobre fatos geométricos de página já congelados antes de qualquer execução (dimensões em pontos, DPI, largura/altura em pixels — os mesmos já pré-registrados em `discovery-reference-truth-document.ts`). Esses componentes são implementados, testados com casos sintéticos e congelados **nesta etapa (Momento 3A)**.
- O **mapeamento do formato bruto específico de cada ferramenta** (os nomes de campo exatos do JSON/objeto que o Docling e o PaddleOCR realmente produzem) **não é definido nesta etapa** — defini-lo agora exigiria presumir ou lembrar de memória um formato de biblioteca externa sem a fonte real diante de nós, o que viola a disciplina de nunca presumir. Esse mapeamento (`parseDoclingRawExport`, `parsePaddleOcrRawExport`) será escrito no Momento 3B, quando a saída bruta real de cada ferramenta estiver disponível para inspeção direta — mas deverá produzir exclusivamente o formato canônico já congelado aqui, usar exclusivamente a função de conversão de coordenadas já congelada aqui (nunca uma fórmula nova ad hoc) e exclusivamente a normalização de texto já congelada aqui. Isso é consistente com §12 do enunciado ("nenhuma alteração semântica no avaliador" após a primeira execução real) — a parte semântica (o que conta como correspondência, como comparar, como medir) é travada agora; a parte mecânica de leitura de um formato de arquivo específico é necessariamente posterior a ter esse arquivo em mãos.

Este documento registra essa decisão como parte do protocolo, não como um desvio dele.

## 2. Formato canônico diagnóstico (§5 do enunciado)

Arquivo: `discovery-local-reader-evaluation.types.ts`.

- `LocalReaderPageEvaluation` — ferramenta, versão, configuração, hash da imagem, página real, tempo de carregamento, tempo de processamento, memória máxima, estado final, erros e avisos.
- `LocalReaderObservedRegion` — identidade determinística, página, texto literal, caixa delimitadora bruta (`LocalReaderRawBoundingBox`, com convenção de origem e unidade **explícitas e nunca assumidas**, incluindo os valores `"unknown"` para ambas), caixa convertida (`LocalReaderConvertedBoundingBox`, sempre na convenção da verdade de referência: origem superior esquerda, pontos) ou `null` quando a conversão foi interrompida, confiança do leitor (apenas metadado), tipo nativo informado, referência ao elemento bruto de origem.
- `LocalReaderObservedTable` — identidade, página, caixa, contagem de linhas/colunas, células integrantes.
- `LocalReaderObservedCell` — identidade, página, tabela, linha/coluna propostas, texto literal, caixa, regiões relacionadas, indicação nativa de mesclagem.

Nenhum tipo aqui presume grupo, subgrupo ou item de serviço por interpretação manual (proibido pelo enunciado nesta etapa).

## 3. Normalização de texto (§6 do enunciado)

Arquivo: `discovery-local-reader-normalization.ts`, função `normalizeLocalReaderText`.

Permitido, exatamente: `String.prototype.normalize("NFC")`; remoção de espaços nas extremidades; colapso de sequências de espaço/tab horizontal para um único espaço; normalização de quebras de linha (`\r\n`, `\r`) para `\n`.

Proibido, e portanto **ausente da implementação**: correção ortográfica, troca de vírgula por ponto, remoção de sinais/símbolos monetários, completude de zeros, correção de código, tradução, inferência de valores, substituição de caracteres visualmente semelhantes, fuzzy matching para declarar acerto.

`computeLocalReaderTextualDistance` (distância de Levenshtein) existe apenas como métrica informativa (§6, último parágrafo) — nunca usada pelo algoritmo de comparação (§8) para declarar correspondência.

## 4. Mapeamento de coordenadas (§7 do enunciado)

Arquivo: `discovery-local-reader-coordinates.ts`, função `convertLocalReaderBoundingBox`.

Preserva sempre, na `LocalReaderRawBoundingBox`: coordenada bruta (`xMin`/`yMin`/`xMax`/`yMax`), convenção de origem declarada (`"top_left" | "bottom_left" | "unknown"`) e unidade declarada (`"pixels" | "points" | "unknown"`) — nunca inferidas por adivinhação. A conversão para pontos, origem superior esquerda (convenção da verdade de referência) usa exclusivamente os fatos de página já congelados (`pageHeightPoints`, `renderingResolutionDpi`) — nunca um fator descoberto empiricamente a partir da saída de um leitor.

Quando `originConvention === "unknown"` ou `unit === "unknown"`, a função retorna `box: null` com `interruptedPt` preenchido — a métrica espacial é interrompida para aquela região/célula, preservando a métrica textual separadamente (comparação de texto não depende de coordenada), exatamente conforme o último parágrafo do §7.

Testado exclusivamente com fixtures sintéticas (§7, penúltimo parágrafo), usando as dimensões de página já congeladas (1190.52 × 841.92 pt, 3308 × 2339 px, 200 DPI): quatro cantos, centro, caixa integral da página, conversão pixel→ponto, inversão vertical (`bottom_left` → `top_left`), e interrupção por convenção/unidade desconhecida.

## 5. Algoritmo de comparação (§8 do enunciado)

Arquivo: `discovery-local-reader-comparison.ts`, função `associateObservedCellsToReference`.

Associação determinística, nesta ordem fixa: (1) mesma página; (2) compatibilidade espacial (sobreposição de caixas convertidas, quando ambas disponíveis); (3) texto literal normalizado; (4) ordem física (proximidade de leitura topo→base, esquerda→direita); (5) desempate por identidade canônica (ordenação lexicográfica de id). Esta ordem não muda depois de observar resultados reais (§8, último parágrafo).

Distingue exatamente as oito categorias exigidas (`LocalReaderCellComparisonOutcome`): `direct_match`, `expected_cell_split_into_multiple_observed`, `multiple_expected_cells_merged`, `expected_cell_omitted`, `invented_cell`, `correct_text_wrong_column`, `correct_text_no_usable_coordinate`, `correct_coordinate_wrong_text`.

## 6. Métricas (§9 do enunciado)

Arquivo: `discovery-local-reader-metrics.ts`. Uma função por subseção do enunciado:

- §9.1 `computeLocalReaderExecutionMetrics`;
- §9.2 `computeLocalReaderRegionTextMetrics`;
- §9.3 `computeLocalReaderTableStructureMetrics` (tabelas, 12 colunas esperadas, linhas, as 1.019 células nas 8 categorias de comparação);
- §9.4 `computeLocalReaderCriticalFieldMetrics` (por papel de coluna, sobre os 80 itens — comparação literal e, quando aplicável, valor decimal exato, sem tolerância, sem correção automática);
- §9.5 `classifyLocalReaderMultilineDescription` (para os 38 casos multilinha);
- §9.6 `classifyLocalReaderExternalContent` (bloco do TCU — incorporação a item ou a valor é sinalizada como risco crítico, `isCriticalRisk`);
- §9.7 `classifyLocalReaderMathEvidenceAvailability` (evidência disponível para as 84 relações matemáticas — completa/parcial/ausente/divergente; nunca penaliza por não reconciliar, apenas por omitir ou alterar a evidência).

## 7. Classificação de viabilidade (§10 do enunciado)

Arquivo: `discovery-local-reader-viability.ts`, função `classifyLocalReaderViability` — tabela de decisão pura sobre `LocalReaderViabilityGateInputs`, produzindo exatamente `"candidato_principal" | "candidato_complementar" | "nao_viavel_nesta_configuracao"`, com `reasonsPt` explicando a decisão. Classifica apenas a ferramenta como fonte de evidência diagnóstica — nunca uma decisão produtiva (§10, último parágrafo).

## 8. Diferenças de repetição (§11 do enunciado)

Arquivo: `discovery-local-reader-repetition.ts`, função `classifyLocalReaderRepetitionDifference` — classifica cada diferença observada entre duas execuções em ruído conhecido (timestamp, diretório temporário, identificador aleatório, ordem não semântica de propriedade) ou diferença semântica. A normalização canônica (§3-§6 aqui) é a única removedora legítima de ruído — nunca um ajuste ad hoc no momento da comparação.

## 9. Testes sintéticos (§ "testar o avaliador apenas com casos sintéticos")

Arquivo: `discovery-local-reader-evaluation.test.ts`. Todos os casos são construídos à mão (páginas, regiões, células, caixas delimitadoras sintéticas) — nenhuma saída de Docling ou PaddleOCR aparece neste arquivo. Um teste de integridade varre a serialização de todos os módulos por `"docling"`, `"paddleocr"`, `"paddlex"`, `"paddlepaddle"`, `"enable_mkldnn"`, `"PP-OCR"`, `"TableFormer"` como valores de dados de teste (os identificadores aparecem apenas em tipos de string literal e na própria documentação, nunca como saída real capturada).

## 10. Limites mantidos nesta etapa

- Nenhum leitor real (Docling, PaddleOCR) executado contra as páginas 46, 50 ou 54.
- Nenhuma alteração em `discovery-reference-truth*` (Momento 2, congelado).
- Nenhuma alteração em código de produção, no registro de maturidade, ou nos 5 arquivos sensíveis.
- Nenhuma alteração nos 2 arquivos protegidos.
- Nenhum PR aberto.
- Nenhum tipo produtivo criado — todos os tipos aqui são exclusivamente diagnósticos, no mesmo diretório de teste/descoberta usado pelo Momento 2, seguindo o mesmo padrão já em uso (`testing/discovery/reference-truth/`), sem necessidade de nova consulta ao `bdos-architect` (mesma categoria de artefato já aprovada nessa consulta anterior).
