# Epic 21 - Sprint 21.4A.2.e - Localizacao e Classificacao Auditavel das Paginas Orcamentarias

## Objetivo

Esta Sprint introduz uma capacidade de dominio pura e deterministica para localizar paginas candidatas a conter estrutura orcamentaria. A entrada exclusiva e um `DocumentSignalObservationResult` produzido pelo observador aprovado na Sprint 21.4A.2.d.

A capacidade nao abre PDF, nao rele texto, nao executa expressoes de observacao, nao usa OCR, IA, score, probabilidade, ranking ou interpretacao economica. Ela decide somente a partir dos sinais, evidencias e versoes recebidos.

## Estado de partida

A implementacao nasceu da `main` e de `origin/main` sincronizadas no commit `092b3db85956b20d7c2c42988681b4fdd260e780`, merge padrao do PR #66. O arquivo local preexistente `supabase/.temp/cli-latest`, o arquivo nao rastreado `.claude/settings.local.json`, `_local-documents/` e o worktree do Principle 008 permaneceram fora da Sprint.

## Fronteiras e arquitetura

O fluxo preservado e:

```text
PhysicalDocumentReadResult
  -> DocumentSignalObservationResult
  -> localizador e classificador auditavel
  -> decisao por pagina
  -> grupos candidatos contiguos
```

O modulo vive no dominio puro `budget-document-location/page-location`. Nao possui dependencia de infraestrutura, Supabase, aplicacao web ou mobile, reconstrucao documental, dominio economico ou biblioteca de PDF.

A API publica exporta apenas a funcao principal, contratos de resultado, classificacoes, tipos de candidatura, grupos, codigos estaveis e versoes. Registro, validacao, fases, mapas e fixtures permanecem internos.

## Contratos versionados

- schema do resultado: `1`;
- localizador: `budget-document-page-locator-v1`;
- conjunto de regras decisorias: `budget-document-page-location-rules-v1`;
- formacao de grupos: `contiguous-candidate-pages-v1`;
- contrato de origem aceito: valores exatos registrados em `SUPPORTED_SOURCE_OBSERVATION_CONTRACTS`.

Uma versao de schema, catalogo, observador ou conjunto de regras de observacao nao reconhecida falha de forma controlada com `source_observation_version_unsupported`. Nao existe melhor esforco para contratos futuros desconhecidos.

## Classificacoes

Cada pagina fisica recebe exatamente uma classificacao:

- `candidate`: pagina candidata provisoria;
- `documentary_context`: remissao documental sem estrutura positiva;
- `ambiguous`: existe sinal positivo de conteudo insuficiente para candidatura;
- `no_positive_evidence`: os quatro sinais de conteudo foram avaliados e nenhum foi observado;
- `not_evaluable`: uma limitacao tecnica impede a decisao local.

`no_positive_evidence` nao significa descarte. Paginas fragmentadas, imagem sem texto extraivel e capacidades ainda nao suportadas podem produzir falso negativo.

## Entrada e saida

`locateBudgetDocumentPages` recebe exclusivamente `DocumentSignalObservationResult`. Nao recebe bytes, caminho, URL, `Buffer`, resultado do leitor fisico, objeto de biblioteca ou registro persistido.

`BudgetDocumentPageLocationResult` preserva schema e versoes, hash de origem, metadados da leitura, status e problemas do observador, decisoes por pagina, grupos, problemas do localizador e limitacoes declaradas.

O status tecnico do localizador e `completed`, `completed_with_problems` ou `failed`. Ele nunca representa orcamento encontrado, confianca, relevancia ou prontidao para importacao. Um documento processado com zero candidatas e um resultado valido.

## Regras de candidatura e ancoragem

| Regra | Versao | Fase | Sinais exigidos | Vizinhanca | Classificacao | Tipo | Pode ancorar | Evidencia | Limitacao principal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `not-evaluable-no-extractable-text-v1` | 1 | tecnica | sem texto extraivel | `none` | `not_evaluable` | - | nao | campo de disponibilidade | nao descreve conteudo |
| `not-evaluable-extraction-error-v1` | 1 | tecnica | erro de extracao | `none` | `not_evaluable` | - | nao | campo de disponibilidade | falha tecnica local |
| `candidate-service-item-and-bdi-v1` | 1 | direta | item + BDI | `none` | `candidate` | direta | sim | avaliacoes textuais originais | coexistencia nao prova mesma linha |
| `candidate-service-item-and-total-v1` | 1 | direta | item + total | `none` | `candidate` | direta | nao | avaliacoes textuais originais | pode ser lista ou quadro-resumo |
| `not-evaluable-content-rule-failure-v1` | 1 | tecnica | falha capaz de mudar decisao | `none` | `not_evaluable` | - | nao | avaliacao com falha | depende do impacto decisorio |
| `candidate-service-item-by-continuity-v1` | 1 | continuidade | item + geometria + ancora vizinha | `any_adjacent_anchor` | `candidate` | continuidade | sim | item, geometria e vizinhos | geometria isolada nao basta |
| `candidate-closing-page-by-continuity-v1` | 1 | fechamento | total + geometria + ancora anterior | `earlier_anchor_only` | `candidate` | fechamento | nao | total, geometria e pagina anterior | nunca usa pagina posterior |
| `documentary-context-budget-reference-v1` | 1 | restante | referencia; item, BDI e total ausentes | `none` | `documentary_context` | - | nao | referencia textual | remissao nao e estrutura |
| `ambiguous-positive-content-evidence-v1` | 1 | restante | ao menos um sinal positivo insuficiente | `none` | `ambiguous` | - | nao | sinais positivos originais | nao promove por contagem |
| `no-positive-content-evidence-v1` | 1 | restante | quatro sinais de conteudo ausentes | `none` | `no_positive_evidence` | - | nao | avaliacoes negativas completas | nao equivale a descarte |

Item de servico mais total geral permanece candidatura direta, mas nao amplifica paginas vizinhas. Esta restricao reduz falsos positivos em listas numeradas, quadros-resumo e demonstrativos financeiros.

Geometria estavel e somente um sinal auxiliar. Geometria observada sem sinal positivo de conteudo nao cria candidatura, contexto ou ambiguidade e nao impede `no_positive_evidence`.

## Precedencia

A ordem decisoria e: limitacao tecnica de disponibilidade; candidatura direta por item + BDI; candidatura direta por item + total; falha de conteudo capaz de mudar a resolucao; continuidade estrutural; fechamento; contexto; ambiguidade; ausencia de evidencia positiva.

Quando item + BDI e item + total estao simultaneamente satisfeitos, a primeira e a regra principal e ambas permanecem registradas em `satisfiedRules`.

## Prompt interpretativo documental

O registro interpretativo desta versao e deterministico e nao e um prompt de IA:

```text
Use somente avaliacoes recebidas do observador.
Geometria e auxiliar e nunca constitui evidencia positiva de conteudo.
Geometria observada + quatro sinais de conteudo not_observed = no_positive_evidence.
Item + BDI = candidata direta que pode ancorar.
Item + total = candidata direta que nao pode ancorar.
Somente candidata item + BDI e candidata por continuidade podem ancorar.
Continuidade estrutural pode usar ancora anterior, posterior ou ambas.
Candidata de fechamento exige ancora fisica imediatamente anterior e nunca usa pagina posterior.
Falha de conteudo bloqueia somente se uma completacao possivel mudar a decisao.
Nao releia texto, nao recalcule sinal e nao use score.
```

## Fases da decisao

1. Validacao integral do contrato de origem e das evidencias positivas.
2. Classificacao tecnica e candidaturas diretas.
3. Propagacao estrutural em iteracoes completas ate ponto fixo.
4. Classificacao de paginas de fechamento apos a convergencia estrutural.
5. Classificacao das paginas restantes.
6. Formacao de grupos contiguos de candidatas.

A propagacao estrutural registra todos os vizinhos qualificadores, anteriores e/ou posteriores, ordenados pelo numero fisico. A decisao nao depende da direcao do loop. O fechamento consulta somente a evidencia `earlier_page` da pagina fisica imediatamente anterior.

## Falhas parciais

Uma falha de regra de conteudo bloqueia a pagina somente quando o resultado ausente puder alterar a decisao final desta versao.

- Uma candidatura direta ja comprovada permanece candidata quando falha outro sinal nao necessario a regra satisfeita.
- Quando uma falha pode completar uma candidatura ou trocar contexto por ambiguidade, a pagina fica `not_evaluable`.
- Quando uma evidencia positiva ja torna todas as completacoes possiveis igualmente ambiguas, a falha e registrada como limitacao e nao bloqueia.
- `no_positive_evidence` exige os quatro sinais de conteudo como `not_observed`; qualquer falha entre eles impede essa classificacao.
- Falha de geometria impede apenas continuidade e fechamento na pagina afetada. Nao bloqueia decisao local direta, contexto, ambiguidade ou ausencia de evidencia positiva.

A funcao pura `determineWhetherContentFailuresBlockClassification` enumera as completacoes binarias possiveis dos sinais com falha e compara as resolucoes deterministicas. Nao ha score nem excecoes decisorias dispersas.

## Validacao da origem

O portao valida:

- paginas unicas, crescentes e densas de `1..N`;
- coerencia entre `totalPageCount`, paginas, status e problemas tecnicos;
- os 23 sinais exatamente uma vez por pagina, na ordem do catalogo;
- regra e versao aprovadas para cada sinal suportado;
- contrato estavel para cada sinal nao suportado;
- coerencia entre disponibilidade textual e sinais de conteudo;
- correspondencia entre falhas de regra e problemas tecnicos do observador;
- hash, catalogo, observador, regra, versao, papeis e referencias de toda evidencia positiva;
- paginas referenciadas existentes e dentro de `1..N`;
- item textual associado a pagina de origem em regra textual;
- geometria presente somente em regra geometrica e ausente em regra textual.

A validacao confirma a coerencia do contrato recebido. Ela nao reexecuta a regra de observacao e nao reinterpreta a evidencia.

## Grupos candidatos

Grupos sao formados somente por paginas `candidate` fisicamente contiguas, respeitada a fronteira semantica de fechamento. Paginas de contexto imediatamente anterior ou posterior sao registradas como informacao, sem entrar no grupo.

Candidata de fechamento:

- exige ancora fisica imediatamente anterior;
- nunca usa pagina posterior como ancora;
- pode ser o ultimo membro de um grupo;
- encerra o grupo e nunca pode ser membro intermediario;
- faz qualquer candidata posterior iniciar novo grupo, mesmo quando fisicamente consecutiva.

A chave deterministica e composta por:

```text
sourceByteHash
+ startPageNumber
+ endPageNumber
+ locatorVersion
+ decisionRuleSetVersion
```

Nao sao usados UUID, relogio ou timestamp.

## Rastreabilidade

O resultado preserva metadados do leitor, adaptador e biblioteca, status e problemas do observador, versoes do observador, regras e catalogo, hash de origem, avaliacoes e evidencias usadas, regras decisorias e vizinhos qualificadores.

`supportingSignals` referencia os objetos de avaliacao originais. Contexto e ausencia de evidencia positiva preservam tambem as avaliacoes `not_observed` que satisfizeram a regra; elas nao sao convertidas em evidencia positiva.

A decisão é vinculada ao documento original por seu hash e rastreável às páginas, sinais, regras, evidências e versões utilizadas.

Problemas de leitura, observacao e localizacao permanecem categorias distintas. Nao se alega rastreabilidade a deslocamento binario ou byte especifico.

## Cobertura real dos sinais

O observador de origem suporta 8 dos 23 sinais do catalogo. Os outros 15 continuam `not_evaluable` por falta de capacidade aprovada e nao participam como ausencia negativa, penalidade, criterio de candidatura ou motivo para invalidar a pagina inteira.

Os quatro sinais de conteudo usados na resolucao local sao referencia orcamentaria, identificacao de item de servico, mencao documental a BDI e mencao de total geral associado a valor. Geometria e disponibilidade de extracao possuem funcao estritamente tecnica ou auxiliar.

## Verificacao

A suite inclui mais de 50 cenarios focados, integracao em memoria entre leitura fisica sintetica, observador e localizador, guard arquitetural dedicado, repetibilidade, integridade do resultado e entrada profundamente congelada.

O caso adversarial de varias paginas com geometria identica e texto comum exige `no_positive_evidence` em todas as paginas, zero candidatas e zero grupos.

O guard dedicado confirma dominio puro, entrada exclusiva pelo observador, ausencia de parser, infraestrutura, persistencia, IA, OCR, dominios economicos, reconstrucao, casos reais, score, confianca, ranking, relogio, UUID e export de fixtures.

## Limitacoes e decisoes abertas

Identificacao de item pode ocorrer em listas; BDI pode ser explicativo; total pode pertencer a demonstrativo nao orcamentario; geometria identica nao prova continuidade; candidatura e provisoria. Nenhuma linha ou coluna foi reconstruida, nenhum valor foi interpretado e nenhuma pagina foi confirmada por revisao humana.

Permanecem abertas: reconstrucao de linhas e blocos, uso dos 15 sinais nao suportados, perfis de qualidade e composicao, revisao humana, persistencia, OCR, tratamento de imagem, Proposta de Importacao, confirmacao definitiva, medicao de falsos positivos e negativos, corpus adversarial e paginas intercaladas sem texto.

## Proximo incremento

O proximo incremento podera consumir grupos candidatos para iniciar reconstrucao documental controlada. Ele nao foi antecipado nesta Sprint e devera manter separadas localizacao candidata, reconstrucao, interpretacao economica e aprovacao humana.
