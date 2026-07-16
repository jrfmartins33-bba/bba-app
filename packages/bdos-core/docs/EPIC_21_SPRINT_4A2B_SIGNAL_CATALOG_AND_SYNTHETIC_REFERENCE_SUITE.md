# Epic 21 — Sprint 21.4A.2.b — Catálogo de Sinais e Conjunto de Referência Sintético

**Status: concluída.** Cria o catálogo versionado de sinais documentais e o conjunto de referência sintético da Fatia 21.4A.2 — Localização Auditável das Páginas Orçamentárias. Não implementa decisão de página, PDF real ou persistência. Próximo incremento: **21.4A.2.c — Contrato Documental e Adaptador de Extração**.

## 1. Objetivo

1. Catálogo versionado de famílias de sinais documentais relevantes à localização de páginas orçamentárias.
2. Conjunto de referência sintético, independente do documento real, cobrindo estruturas positivas, falsos positivos, adversarial e condições documentais.
3. Testes de integridade, cobertura e repetibilidade desse conjunto.

## 2. Fronteiras

Sem leitura física de PDF, sem `pdfjs-dist`, sem OCR, sem resolvedor de conteúdo documental, sem contrato de adaptador, sem persistência, sem Serviço de Aplicação, sem rota, sem interface, sem IA, sem decisão final por página, sem algoritmo de continuidade, sem pontuação, sem limiar arbitrário, sem leitura econômica.

## 3. Catálogo

`packages/bdos-core/src/domain/budget-document-location/budget-document-signal-catalog.ts`. `BUDGET_DOCUMENT_SIGNAL_CATALOG_SCHEMA_VERSION = 1`, `BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION = "budget-document-signal-catalog-v1"`. **23 definições em 5 famílias**: Referencial (2), Estrutural (5), Continuidade (3), Fechamento (3), Condição da extração (10). Nenhuma marcada `sufficientAlone: true` — invariante verificado por teste. Congelado (`Object.freeze` recursivo) em tempo de execução.

A família Condição da Extração separa três dimensões independentes, cada uma com seus próprios sinais, nunca misturadas:

- **Disponibilidade** (3): `extraction-text-available`, `extraction-no-extractable-text`, `extraction-error`.
- **Qualidade** (3): `extraction-acceptable-quality`, `extraction-degraded-quality`, `extraction-indeterminate-quality`.
- **Composição** (4): `extraction-composition-predominantly-textual`, `extraction-composition-mixed`, `extraction-composition-graphic-or-image`, `extraction-composition-not-determinable`.

`extraction-text-available` informa somente que o extrator retornou ao menos um item textual útil — não implica qualidade aceitável nem confiabilidade. `extraction-error` representa falha técnica explícita da extração, distinta de ausência de texto ou de página digitalizada. `extraction-acceptable-quality` não fixa limiar numérico nesta Sprint. Os quatro sinais de composição apenas descrevem o tipo predominante de conteúdo observável, sem indicar presença ou ausência de orçamento.

Formulações conservadoras: menção referencial indica remissão documental a uma *possível* estrutura em outro lugar — não que o conteúdo provavelmente existe ali. Unidade/quantidade/valor representam combinação *compatível* com linha de orçamento — não prova de que a linha seja orçamentária.

## 4. Conjunto sintético

`packages/bdos-core/src/domain/budget-document-location/testing/synthetic-reference-suite.ts`. `SYNTHETIC_REFERENCE_SUITE_SCHEMA_VERSION = 1`, `SYNTHETIC_REFERENCE_SUITE_VERSION = "budget-document-location-synthetic-suite-v1"`. 8 documentos, 33 páginas, todos fictícios (organizações, obras, códigos e valores inventados para regressão técnica).

## 5. Disponibilidade, qualidade e composição

Três dimensões independentes por página, cada uma respaldada por sinais próprios do catálogo (item 3), sem score nem limiar numérico:

- **Disponibilidade**: texto disponível / ausência de texto extraível / erro de extração.
- **Qualidade**: aceitável / degradada / indeterminada.
- **Composição**: predominantemente textual / mista / gráfica ou imagem / não determinável.

## 6. Casos positivos

Duas estruturas materialmente distintas: "Vale Verde" (paisagem, cabeçalho `Código|Descrição|Unidade|Quantidade|Valor Unitário|BDI|Valor Total`, 7 páginas) e "Serra Alta" (retrato, cabeçalho e ordem de campos diferentes, BDI como nota de rodapé isolada, nunca usa a expressão exata "Planilha Orçamentária", 6 páginas). Diferença material verificada por teste automático (orientação de página + conjunto de sinais estruturais usados).

## 7. Falsos positivos

Índice/sumário referencial (menciona "Planilha Orçamentária" sem estrutura), demonstrativo financeiro não orçamentário, cronograma físico-financeiro, e um falso positivo de geometria (desenho técnico com a mesma geometria de um bloco candidato típico, zero sinais estruturais, sempre `Discarded`).

## 8. Adversarial

Documento com a expressão exata "Planilha Orçamentária", código, unidade, quantidade, BDI, valor unitário e total geral — mas sem repetição coerente de linha nem continuidade entre páginas. Permanece `Ambiguous` em todas as páginas, nunca `Candidate`.

## 9. Integridade da suíte

`validateSyntheticReferenceSuite` verifica: `schemaVersion`/`suiteVersion` declarados; mínimo de documentos positivos/falsos positivos; presença do adversarial e do falso positivo de geometria; presença de caso referencial-sem-estrutura, caso estrutural-sem-frase-exata, caso de fechamento, caso de múltiplos papéis; identificadores de documento/página únicos; numeração de página consistente; referências de sinal existentes no catálogo (`expectedSignals`/`explicitlyAbsentSignalIds`); **contradição** entre um sinal simultaneamente esperado e explicitamente ausente na mesma página; grupos de continuidade com pelo menos 2 páginas; justificativa humana presente em toda página; versão de fixture presente em todo documento/página.

## 10. Repetibilidade

Duas cargas independentes de `buildSyntheticReferenceSuite()` comparadas por serialização, hash SHA-256 normalizado e ordem de documentos/páginas/sinais — idênticas. Valida a camada sintética/normalização; não valida a repetibilidade do `pdfjs-dist` real, que permanece aberta para 21.4A.2.c.

## 11. Testes

- `budget-document-signal-catalog.test.ts` (17 testes): integridade, versão, ausência de sinal suficiente isoladamente, mínimo por família, imutabilidade em tempo de execução, detecção de id duplicado/sinal suficiente indevido/referência pendente, existência dos dez identificadores de `ExtractionCondition`, exatamente dez sinais na família, `extraction-text-available` distinto de `extraction-acceptable-quality`, `extraction-error` distinto de `extraction-no-extractable-text`, presença dos quatro sinais de composição, ausência de campo de score/limiar não documentado, total de 23 sinais no catálogo.
- `synthetic-reference-suite.test.ts` (14 testes): versões declaradas, integridade/cobertura completa, detecção de divergência de versão, detecção de contradição de sinais, mínimos de documentos, adversarial nunca candidato, menção referencial sem estrutura (dedicado), estrutura sem frase exata (dedicado), adversarial não vira candidato por contagem lexical (dedicado), geometria nunca suficiente isoladamente (dedicado), fechamento isolado nunca candidato (dedicado), múltiplos papéis, disponibilidade/qualidade/composição obrigatórias, repetibilidade de duas cargas independentes.
- `budget-document-location-boundaries.test.ts` (6 testes): existência de fonte; ausência de import de `document-processing`/`document-reconstruction`/`budget-version`/`procurement-engineering`/`apps/web`/Supabase; ausência de `pdfjs`/OCR/IA como palavra-chave; direção inversa; fixtures não exportadas no barrel público.

Total: 37 testes na capacidade. `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` (133/133 arquivos) confirmados após a separação da família `ExtractionCondition`.

## 12. Limitações técnicas

Limiares de qualidade de extração permanecem conceituais — nenhum número fixado. A verdade de referência é uma expectativa escrita à mão, não uma medição contra o `pdfjs-dist` real.

## 13. Decisões abertas para 21.4A.2.c

Caminho do adaptador de `pdfjs-dist`; resolvedor de conteúdo documental; contrato de extração física; forma de persistência (`metadata` livre vs. tipo próprio); uso definitivo de geometria como sinal formal; limiares de texto degradado; algoritmo final de continuidade; nome definitivo do mecanismo persistido.
