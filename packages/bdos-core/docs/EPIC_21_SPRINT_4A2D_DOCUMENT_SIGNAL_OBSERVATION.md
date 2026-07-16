# Epic 21 — Sprint 21.4A.2.d — Associação Determinística de Sinais às Páginas Documentais

**Status: concluída.** Conecta o catálogo versionado de 23 sinais (Sprint 21.4A.2.b) às observações físicas do leitor de PDF (Sprint 21.4A.2.c), produzindo, por página, um veredito determinístico de `observed`/`not_observed`/`not_evaluable` para cada um dos 23 sinais, com evidência auditável. Não localiza páginas orçamentárias, não combina sinais, não classifica nada. Próximo incremento: mecanismo de localização e classificação de páginas, fora do escopo desta Sprint.

## 1. Objetivo

Responder "quais sinais do catálogo foram objetivamente avaliados nesta página, qual foi o resultado e quais evidências sustentam a observação?" — nunca "esta página pertence ao orçamento?".

## 2. Estado de partida

`main`/`origin/main` confirmadas em `7939c01279c2cd11a5d38b282346a76b7318ba26` (merge do PR #65, encerramento da Sprint 21.4A.2.c). Branch `claude/epic-21-sprint-4a2d-document-signal-observer` criada a partir desse commit. `supabase/.temp/cli-latest` confirmada como única alteração local preexistente, intocada.

## 3. Fronteiras

Entrada obrigatória: `PhysicalDocumentReadResult` já produzido — nunca bytes, `Uint8Array`, caminho, URL, referência de armazenamento ou objeto de `pdfjs-dist`. Sem localização de páginas, sem `Candidate`/`Contextual`/`Ambiguous`/`Discarded`, sem score, sem limiar, sem confiança percentual, sem combinação de sinais, sem reconstrução de tabela, sem interpretação econômica, sem persistência, sem regra específica de órgão ou licitação real.

## 4. Arquitetura

```text
PhysicalDocumentReadResult
    ↓
Observador de Sinais Documentais (domínio puro)
    │
    ├── primeira passagem (evaluateLocalPhase, TODAS as páginas)
    │   → sinais locais a cada página + sinais sem regra aprovada
    │
    └── segunda passagem (evaluateAdjacentPhase, TODAS as páginas,
        só começa depois da primeira terminar por completo)
        → sinais dependentes de página física vizinha
    ↓
DocumentSignalObservationResult (avaliações e evidências por página)
    ↓
[fora do escopo] mecanismo futuro de localização e classificação
```

A separação é estrutural no código, não apenas descritiva: `evaluateLocalPhase` percorre cada página resolvendo unicamente sinais `single_page` (mais os sem regra aprovada, que não dependem de nenhuma página); `evaluateAdjacentPhase` parte do mapa já produzido pela primeira fase e resolve, por cima dele, exclusivamente os sinais `adjacent_pages`. Uma regra `adjacent_pages` nunca é chamada durante `evaluateLocalPhase` — testado diretamente (`required test 1a/1b/1c`).

Localização: `packages/bdos-core/src/domain/budget-document-location/signal-observation/` — domínio puro, nunca `infrastructure/`. O reconhecimento encontrou dois padrões parcialmente aplicáveis (`domain/schedule-management/adapters/` para leitores hand-rolled sem dependência externa; `domain/decision-case/adapters/` para tradução domínio-a-domínio) e um padrão diretamente reutilizável: `measurement-service-formula-mapping.ts`, que já documenta exatamente a separação "mapeamento de suporte, referenciando capacidade do motor por valor, nem toda entrada tem cobertura ainda" — o mesmo desenho usado aqui para o registro de suporte.

## 5. Contrato de entrada

`PhysicalDocumentReadResult` (Sprint 21.4A.2.c), reaproveitado sem cópia nem redefinição: `sourceByteHash`, `totalPageCount`, `pages` (com `pageNumber`, `widthPoints`/`heightPoints`/`orientation`, `textItems`, `extractionAvailability`), `readerName`/`readerVersion`/`adapterVersion`/`underlyingLibraryVersion`, `status`. O observador nunca recalcula o hash — reutiliza `sourceByteHash` como identidade técnica da leitura de origem.

## 6. Contrato de saída

`packages/bdos-core/src/domain/budget-document-location/signal-observation/signal-observation.types.ts`. `DocumentSignalObservationResult`: `schemaVersion`, `observerName`, `observerVersion`, `ruleSetVersion`, `catalogVersion`, `sourceByteHash`, `sourceReadMetadata` (referencia a leitura de origem por metadado, nunca duplica seus problemas técnicos), `totalPageCount`, `pages` (uma `DocumentSignalPageObservation` por página física, com exatamente 23 `SignalEvaluation`, na ordem estável do catálogo), `status`, `technicalProblems`.

`DocumentSignalObservationStatus`: `completed` | `completed_with_observer_problems` | `failed`. `not_evaluable` de rotina (por falta de suporte ou de dados) **não** altera o status — só uma falha técnica inesperada durante a execução de uma regra o faz, ou uma leitura de origem já `failed`.

## 7. Versões

Quatro dimensões distintas, cada uma revisada apenas quando sua própria natureza muda: `SIGNAL_OBSERVATION_SCHEMA_VERSION = 1` (formato do resultado); `DOCUMENT_SIGNAL_OBSERVER_VERSION = "document-signal-observer-v1"` (orquestração); `SIGNAL_OBSERVATION_RULE_SET_VERSION = "document-signal-observation-rules-v1"` (conjunto de regras executáveis); `BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION` (vocabulário de sinais, reaproveitada da Sprint 21.4A.2.b, nunca redeclarada). Alterar uma regra individual, adicionar/remover uma regra, mudar a forma de evidência ou o motivo de não avaliação exige revisão consciente da versão correspondente — nenhuma é incrementada automaticamente.

## 8. Estados de avaliação

- **`observed`**: identificado por uma regra aprovada. Sempre carrega `evidence`.
- **`not_observed`**: a regra existe, foi executada com os dados necessários disponíveis, e a condição não ocorreu. Nunca significa página descartada ou de baixa prioridade.
- **`not_evaluable`**: distinção obrigatória entre duas causas, nunca confundidas:
  - *suporte da versão*: nenhuma regra aprovada existe para o sinal, em qualquer página (`ruleId: null`);
  - *insuficiência de página*: o sinal tem regra aprovada, mas esta página específica (ou seu contexto) não fornece os dados necessários (`ruleId` presente).

## 9. Regras de observação

`signal-observation-rules.ts`. Oito regras, cada uma com `ruleId`/`ruleVersion`/`signalId`/`evaluationScope`/`requiredInputs`/`humanDescription` — nunca uma função anônima sem identidade. Sete locais (`single_page`), uma dependente de página vizinha (`adjacent_pages`, `continuity-stable-geometry`). Casamento textual sempre literal, item a item (nunca sobre o texto concatenado da página, evitando ambiguidade de alinhamento entre item e correspondência), case-insensitive, com espaços consolidados — sem correspondência aproximada, sem distância de edição, sem sinônimos, sem IA.

Duas revisões pós-implementação: (1) removeu a regra original de `referential-annex-listing` (correspondência textual simples, insuficiente frente à definição do catálogo — ver seção 11); (2) endureceu duas regras que produziam falso positivo lexical — `closure-general-total-mention` (`v3`) passou a exigir um token numérico imediatamente adjacente à expressão de total, não apenas um dígito em qualquer posição do item (ver seção 15); `structural-bdi-documentary-mention` (`v2`) passou a exigir "BDI" como token delimitado por limite de palavra, não como substring de outra palavra (ex.: "Subdiretoria").

## 10. Evidências

`SignalObservationEvidence`: `sourceByteHash`, `signalId`, `catalogVersion`, `ruleId`, `ruleVersion`, `observerVersion`, `references` (uma ou mais `SignalObservationEvidenceReference`, cada uma com `pageNumber`, `textItems` — uma lista de `SignalObservationTextEvidenceItem`, cada um com `textItemIndex`, `originalText` verbatim e `normalizedText` (normalizado apenas daquele item via `normalizePageText([item.text])`, nunca via texto concatenado da página) —, `geometry` (auxiliar, só quando a regra é geométrica), `roleInRule`). Nenhum item é concatenado com outro por separador artificial: cada item textual permanece como uma entrada própria do array, preservando alinhamento exato com seu índice mesmo quando o texto original contém um caractere como `|` (testado explicitamente). Observações de página única têm uma referência; a regra de página vizinha tem duas ou mais, com papéis explícitos e controlados (`SignalObservationEvidenceRole`: `primary`, `reference_page`, `earlier_page`, `later_page`, `extraction_availability_field`).

## 11. Cobertura dos 23 sinais

| # | Sinal | Família | Fonte de dados | Regra | Suporte | Motivo de não avaliação |
|---|---|---|---|---|---|---|
| 1 | `referential-budget-spreadsheet-mention` | Referencial | `textItems` | `referential-budget-spreadsheet-mention-literal-phrase-v1` | Suportado | — |
| 2 | `referential-annex-listing` | Referencial | estrutura de listagem de anexos | — | Não suportado | `unsupported_missing_list_structure_capability` |
| 3 | `structural-service-item-identification` | Estrutural | `textItems` | `structural-service-item-identification-line-start-pattern-v1` | Suportado | — |
| 4 | `structural-unit-quantity-price-block` | Estrutural | agrupamento de linha/bloco | — | Não suportado | `unsupported_missing_row_reconstruction_capability` |
| 5 | `structural-total-value-column` | Estrutural | agrupamento de linha/bloco | — | Não suportado | `unsupported_missing_row_reconstruction_capability` |
| 6 | `structural-bdi-documentary-mention` | Estrutural | `textItems` | `structural-bdi-documentary-mention-token-boundary-v2` | Suportado | — |
| 7 | `structural-tabular-row-repetition` | Estrutural | detecção de repetição de linha | — | Não suportado | `unsupported_missing_row_reconstruction_capability` |
| 8 | `continuity-repeated-header` | Continuidade | detecção de cabeçalho de coluna | — | Não suportado | `unsupported_missing_row_reconstruction_capability` |
| 9 | `continuity-stable-geometry` | Continuidade | geometria de páginas vizinhas | `continuity-stable-geometry-adjacent-match-v1` | Suportado | — |
| 10 | `continuity-repeated-row-pattern` | Continuidade | extensão de #7 entre páginas | — | Não suportado | `unsupported_missing_row_reconstruction_capability` |
| 11 | `closure-general-total-mention` | Fechamento | `textItems` | `closure-general-total-mention-adjacent-numeric-token-v3` | Suportado | — |
| 12 | `closure-density-drop` | Fechamento | contagem de linhas por página | — | Não suportado | `unsupported_missing_row_reconstruction_capability` |
| 13 | `closure-structural-break` | Fechamento | extensão de #7 entre páginas | — | Não suportado | `unsupported_missing_row_reconstruction_capability` |
| 14 | `extraction-text-available` | Cond. extração — disponibilidade | `extractionAvailability` | `extraction-text-available-field-v1` | Suportado | — |
| 15 | `extraction-no-extractable-text` | Cond. extração — disponibilidade | `extractionAvailability` | `extraction-no-extractable-text-field-v1` | Suportado | — |
| 16 | `extraction-error` | Cond. extração — disponibilidade | `extractionAvailability` | `extraction-error-field-v1` | Suportado | — |
| 17 | `extraction-acceptable-quality` | Cond. extração — qualidade | perfil de qualidade | — | Não suportado | `unsupported_missing_evaluation_profile` (`quality`) |
| 18 | `extraction-degraded-quality` | Cond. extração — qualidade | perfil de qualidade | — | Não suportado | `unsupported_missing_evaluation_profile` (`quality`) |
| 19 | `extraction-indeterminate-quality` | Cond. extração — qualidade | perfil de qualidade | — | Não suportado | `unsupported_missing_evaluation_profile` (`quality`) |
| 20 | `extraction-composition-predominantly-textual` | Cond. extração — composição | perfil de composição | — | Não suportado | `unsupported_missing_evaluation_profile` (`composition`) |
| 21 | `extraction-composition-mixed` | Cond. extração — composição | perfil de composição | — | Não suportado | `unsupported_missing_evaluation_profile` (`composition`) |
| 22 | `extraction-composition-graphic-or-image` | Cond. extração — composição | perfil de composição | — | Não suportado | `unsupported_missing_evaluation_profile` (`composition`) |
| 23 | `extraction-composition-not-determinable` | Cond. extração — composição | perfil de composição | — | Não suportado | `unsupported_missing_evaluation_profile` (`composition`) |

**8 suportados / 15 não suportados**, verificado por teste de integridade executável — não apenas descrito aqui em prosa (`signal-observation-support-registry.test.ts`, caso "the registry's supported/unsupported counts match the documented matrix").

`referential-annex-listing` foi revisado após a implementação inicial: o catálogo exige uma *listagem* de anexos que nomeia um anexo econômico, não apenas a menção literal da expressão — a regra original também dispararia falsamente na própria página do anexo de preços (que é o anexo, não uma listagem dele). Sem capacidade de reconhecer estrutura de lista, permanece `unsupported`.

## 12. Tratamento por família

- **Referencial**: um sinal suportado por correspondência literal simples (sem confirmação de estrutura — a observação nunca implica candidatura); o outro (`referential-annex-listing`) permanece não suportado por exigir estrutura de listagem que uma correspondência literal simples não comprova.
- **Estrutural**: um sinal (identificação de item) suportado via padrão de início de linha; quatro dependem de agrupamento de linha/bloco que esta Sprint proíbe reconstruir (seção 20 do brief).
- **Continuidade**: apenas o sinal geométrico é suportado, exclusivamente pela segunda passagem; os três textuais/estruturais dependem da mesma capacidade ausente da família Estrutural.
- **Fechamento**: apenas a menção literal de total, exigindo um token numérico no mesmo item, é suportada; densidade e quebra estrutural dependem de contagem de linha.
- **Condição da extração**: disponibilidade totalmente suportada (mapeamento direto de campo); qualidade e composição totalmente não suportadas, por ausência de perfil aprovado.

## 13. Condição da extração

Disponibilidade deriva diretamente do campo `extractionAvailability` já calculado pelo leitor físico — nunca recalculada por contagem de caracteres. Qualidade e composição permanecem `not_evaluable` em **toda** página, **sempre**, por decisão arquitetural explícita: a ausência de perfil aprovado é uma condição de capacidade do observador, não uma observação física. Mesmo os dois sinais cuja própria definição descreve "reconhece honestamente o limite do que pode ser afirmado" (`extraction-indeterminate-quality`, `extraction-composition-not-determinable`) permanecem não suportados nesta versão — marcá-los como `observed` simplesmente por não existir perfil transformaria uma lacuna de implementação em fato documental positivo, o que este observador nunca faz.

## 14. Continuidade

Segunda passagem explícita, separada da primeira. `continuity-stable-geometry` recebe a página atual mais a anterior e a posterior (cada uma podendo ser `null` na borda do documento) — não um array com índice.

**Semântica exata das bordas, para não deixar ambíguo**: a regra é avaliável sempre que existe ao menos uma página física vizinha com geometria utilizável. A primeira página do documento é avaliada comparando-se com a próxima; a última, com a anterior — em ambos os casos o resultado pode ser `observed` ou `not_observed`, dependendo se a geometria realmente coincide. **Não é verdade que toda borda de documento seja automaticamente `not_evaluable`.** `not_evaluable` ocorre somente em dois casos: documento de página única (nenhum vizinho existe) ou vizinho(s) existente(s) sem geometria própria disponível (ex.: página cuja carga falhou). A evidência preserva as duas ou mais páginas envolvidas, cada uma com seu papel.

## 15. Fechamento

`closure-general-total-mention` (regra `v3`) observa "total geral"/"valor global"/"total da proposta" imediatamente seguida, no mesmo item textual, por um token numérico — o separador permitido entre a expressão e o número é deliberadamente estreito (espaço, dois-pontos, hífen/travessão, marcador de moeda opcional "R$"), nunca uma palavra. Um dígito em qualquer outra posição do item **não** satisfaz a regra: "Total geral — ver página 12" permanece `not_observed`, enquanto "Total geral: R$ 100,00" é `observed`. A regra nunca interpreta, converte ou compara o valor encontrado — apenas comprova a associação lexical que o catálogo exige. Se a expressão e o número estiverem em itens de extração diferentes, o sinal permanece `not_observed` nesta versão (nenhuma união de itens por heurística). A observação nunca implica que um bloco orçamentário precedeu o total.

## 16. Determinismo

Duas execuções de `observeDocumentSignals` sobre o mesmo `PhysicalDocumentReadResult` produzem resultado idêntico por serialização completa (testado). Nenhum `Date.now()`, UUID aleatório ou campo dependente de ambiente existe no contrato. A ordem das 23 avaliações por página segue exatamente a ordem de declaração do catálogo (`BUDGET_DOCUMENT_SIGNAL_CATALOG`), independente do conteúdo da página.

## 17. Testes

- `signal-observation-support-registry.test.ts` (11 casos): os 10 pontos de integridade exigidos — unicidade de `ruleId`, referência real ao catálogo, ausência de regra órfã, todo suportado resolve regra real, todo não suportado tem motivo, os 23 sinais aparecem exatamente uma vez, nenhum sinal desconhecido, nenhuma regra menciona órgão/licitação real, suporte sempre respaldado por objeto real (nunca só prosa), contagens documentadas (8/15) batendo com o registro executável.
- `signal-observation.test.ts` (37 casos): os 40 casos mínimos da seção 29 do brief original, os 10 casos da primeira revisão pós-implementação (separação real das duas fases; página "Anexo de Preços" isolada não satisfaz `referential-annex-listing`; item contendo `|` permanece alinhado ao índice sem delimitador artificial; vizinho existente sem geometria utilizável produz `not_evaluable`, não um falso `not_observed`; repetibilidade completa com evidência real populada) e os 8 casos da segunda revisão (falsos positivos lexicais) — "Total geral — ver página 12"/"Valor global conforme item 3.2"/"Total da proposta referente ao exercício 2026" permanecem `not_observed` (dígito presente, mas não adjacente); "Total geral: R$ 100,00"/"Valor global 7.611.851,65" são `observed` (dígito adjacente via separador controlado); "Subdiretoria de Engenharia" não observa BDI (substring dentro de outra palavra); "Percentual de BDI: 22,40%" observa BDI (token delimitado); repetibilidade das duas regras corrigidas juntas.
- `testing/synthetic-physical-document-bridge.test.ts` (18 casos): ponte mínima e exclusivamente de teste contra a suíte sintética protegida da Sprint 21.4A.2.b — 11 páginas curadas de 3 documentos reais da suíte (não as 33 completas), texto literal autorado à parte, coerente com cada `observedForm` já documentado, validando os 8 sinais suportados contra a expectativa existente, incluindo o caso do falso positivo geométrico (geometria observada mesmo sem qualquer texto, em documento que a suíte nunca trata como orçamento) e a confirmação de que a página de capa (que menciona literalmente "Anexo de Preços Estimados") não satisfaz `referential-annex-listing`.
- `document-signal-observation-boundaries.test.ts` (8 casos, guard novo): domínio puro, sem `pdfjs-dist`/OCR/IA/Supabase/`apps/web`/`apps/mobile`/domínios econômicos/`document-reconstruction`, sem campo de vocabulário decisório declarado no código, sem vazamento de fixtures pela API pública, catálogo nunca redeclarado, código de produção nunca importa a ponte de teste.

**Total de testes focados desta Sprint (incluindo as duas revisões pós-implementação): 74** (11 + 37 + 18 + 8).

## 18. Guards

Guard dedicado novo (`document-signal-observation-boundaries.test.ts`) mais o guard já existente de `budget-document-location-boundaries.test.ts`, que cobre `signal-observation/` incidentalmente por estar fisicamente dentro do domínio (nenhum dos dois foi enfraquecido). Confirmado: domínio nunca importa `pdfjs-dist`; apenas o adaptador da Sprint 21.4A.2.c o importa em todo o pacote; nenhuma dependência de Supabase, `apps/web`, `apps/mobile`, IA, OCR ou domínio econômico.

## 19. Limitações

- Casamento textual literal não detecta expressão quebrada entre dois itens de extração, hifenização, fragmentação da ordem técnica de extração, variação ortográfica ou caracteres degradados — deliberado, documentado, não corrigido nesta Sprint (heurística, IA e distância de edição continuam fora de escopo).
- `closure-general-total-mention` só reconhece associação entre expressão de total e valor quando ambos estão no mesmo item textual, com um separador estreito e controlado entre eles — se estiverem em itens diferentes, ou separados por texto livre (ex.: "Total geral — ver página 12"), o sinal permanece `not_observed`, não `observed`.
- `structural-bdi-documentary-mention` exige "BDI" como token delimitado por limite de palavra ASCII (`\b`); um caso extremo teórico não coberto é um documento que usa diacríticos imediatamente colados a "BDI" sem espaço (ex.: "BDIçãográfico"), onde o limite de palavra Unicode poderia se comportar de forma diferente do ASCII — não observado em nenhuma fixture real ou sintética desta Sprint.
- `structural-service-item-identification` usa dois padrões de regex conservadores (numeração hierárquica, código alfanumérico curto); não cobre todo formato possível de identificador de item.
- `referential-annex-listing` não tem regra nesta versão: uma correspondência textual simples validaria falsamente a própria página do anexo econômico como se fosse uma listagem dele — capacidade de reconhecer estrutura de lista fica para versão futura.
- A ponte de teste sintética cobre 11 de 33 páginas da suíte protegida — representativa, não exaustiva; documentada como tal no próprio arquivo de teste.
- Nenhum dos 7 sinais dependentes de agrupamento de linha/bloco (estruturais/continuidade/fechamento restantes) tem regra nesta versão — bloqueio arquitetural real (reconstrução de linha/coluna permanece fora de escopo), não lacuna de implementação esquecida.

## 20. Sinais não avaliáveis e motivos

Ver matriz da seção 11. Três motivos estruturais de suporte (`unsupported_missing_row_reconstruction_capability`; `unsupported_missing_evaluation_profile` com dimensão `quality`/`composition`; `unsupported_missing_list_structure_capability`) e três motivos de insuficiência por página (`page_text_unavailable`, `page_geometry_unavailable`, `adjacent_page_unavailable`), mais um motivo de falha técnica interna do observador (`observer_rule_execution_failed`, exercitado em teste apenas por uma falha forçada deliberadamente, para provar o caminho defensivo).

## 21. Decisões abertas

Perfil de qualidade e de composição continuam indefinidos — condição herdada da Sprint 21.4A.2.b, não resolvida aqui. Capacidade de agrupamento de linha/bloco (necessária para 7 dos 15 sinais não suportados) não tem desenho aprovado. Capacidade de reconhecimento de estrutura de listagem (necessária para `referential-annex-listing`) também não tem desenho aprovado. Algoritmo de continuidade e de fechamento definitivos, combinação de sinais, tratamento de sinais contraditórios, política de localização de intervalo, persistência futura, revisão humana futura e suporte a OCR permanecem em aberto, sem antecipação nesta Sprint.

## 22. Próximo incremento

Mecanismo de localização e classificação de páginas, consumindo as avaliações e evidências produzidas aqui — explicitamente fora do escopo desta Sprint.
