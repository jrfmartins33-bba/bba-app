# Epic 21 — Sprint 21.4A.2.b — Catálogo de Sinais e Conjunto de Referência Sintético

**Status: Sprint 21.4A.2.b concluída.** Cria o catálogo versionado de famílias de sinais documentais e o conjunto de referência sintético e independente da Fatia 21.4A.2 — Localização Auditável das Páginas Orçamentárias. Não implementa o mecanismo definitivo de decisão por página. Próximo incremento: **21.4A.2.c — Contrato Documental e Adaptador de Extração**.

## 1. Objetivo

Entregar, sem tocar em PDF real, persistência ou decisão de produção:

1. um catálogo versionado de famílias de sinais documentais relevantes à localização de páginas orçamentárias;
2. um conjunto de referência sintético, independente do documento real, cobrindo estruturas positivas, falsos positivos, adversarial e condições documentais;
3. testes de integridade, cobertura, governança e repetibilidade desse conjunto.

## 2. Fronteiras

Sem leitura física de PDF, sem `pdfjs-dist` (nem como dependência de produção, nem de desenvolvimento), sem OCR, sem resolvedor de conteúdo documental, sem download do Supabase Storage, sem contrato definitivo do adaptador de extração, sem persistência, sem migração, sem tabela, sem RLS, sem Serviço de Aplicação, sem rota, sem interface, sem IA, sem decisão final por página, sem algoritmo completo de continuidade, sem pontuação, sem limiar arbitrário, sem leitura econômica.

## 3. Estado inicial

- Repositório: `jrfmartins33-bba/bba-app`.
- `main` local e remota confirmadas no commit exato esperado `667685b70cfae1afc84476cd184f2a4ee100295a` (incorpora o merge do PR #63 — remoção do Claude Code Review — e do PR #61 — Sprint 21.4A.2.a).
- Alteração preexistente e não relacionada: `supabase/.temp/cli-latest` (preservada, nunca preparada).
- `.claude/settings.local.json` e `_local-documents/` confirmados ignorados pelo Git.
- Worktree `bba-app-worktree-principle-008` (branch `claude/principle-008-human-first-visual-ux`, commit `96501c0`) confirmado intacto.
- Branch criada: `claude/epic-21-sprint-4a2b-signal-catalog`, a partir de `main`.

## 4. Reconhecimento arquitetural focado

- `EPIC_21_SPRINT_4A2A_DOCUMENT_LOCATION_SPIKE.md` lido na íntegra: as famílias preliminares (referencial, estrutural, continuidade, fechamento), o achado geométrico e a proibição de regra específica do caso Lagoa do Arroz vinculam diretamente o catálogo desta Sprint.
- `document-processing-boundaries.test.ts` confirmado: proíbe `pdfjs`/`ocr`/`anthropic`/etc. apenas dentro de `domain/document-processing`, `services/document-processing` e dois arquivos-marcador de `apps/web/lib/bdos` — a nova capacidade, fora dessas pastas, não conflita com esse guard e não precisou alterá-lo.
- `domain/document-reconstruction` reconfirmado como domínio de estrutura lógica pós-extração, sem conceito de página física — sem sobreposição.
- `domain/budget-version` confirmado como domínio econômico proibido (já é um `FORBIDDEN_DOCUMENT_PROCESSING_IMPORT_SEGMENTS` existente) — usado como referência direta para o novo guard.
- Padrões reais de catálogo versionado confirmados: `MEASUREMENT_ANALYSIS_RESULT_SCHEMA_VERSION` (`measurement-bulletin-import.types.ts`), `PLANNING_DATASET_SCHEMA_VERSION` (`planning-dataset.types.ts`), `official-template-catalog.ts`.
- Fixtures sintéticas reais confirmadas: `budget-version.synthetic-fixture.ts` (`buildSyntheticMultiLotScenario`, aviso explícito contra reuso de valores como reais) — modelo direto para `synthetic-reference-suite.ts`.
- Guard arquitetural mais próximo em escopo: `document-processing-boundaries.test.ts` — estrutura (resolução de `REPO_ROOT`, varredura recursiva, regex de import, keywords proibidas) copiada literalmente para o novo guard.
- Descoberta de testes confirmada automática e recursiva (`scripts/run-tests.mjs`, via `*.test.ts`) — nenhum registro manual necessário.

## 5. Localização escolhida

`packages/bdos-core/src/domain/budget-document-location/` — capacidade irmã, pura, sem infraestrutura, seguindo o estilo `export *` do barrel de `document-reconstruction` (domínio de idade/escopo comparável). Justificativa: fora de `document-processing` (evita o guard existente que proíbe `pdfjs`), fora de `document-reconstruction` (evita sobreposição de conceito), fora de `budget-version` (evita domínio econômico).

## 6. Catálogo de sinais

`BUDGET_DOCUMENT_SIGNAL_CATALOG_SCHEMA_VERSION = 1`, `BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION = "budget-document-signal-catalog-v1"`. 17 definições:

| Família | Quantidade | Uso permitido | Uso proibido |
|---|---:|---|---|
| Referencial | 2 | Registrar remissão documental | Concluir presença estrutural; iniciar continuidade |
| Estrutural | 5 | Compor observação de estrutura tabular junto com os demais sinais da família | Decidir presença isoladamente; interpretar valores economicamente |
| Continuidade | 3 | Sustentar/reforçar grupo já formado por sinais estruturais | Formar continuidade sozinha; provar conteúdo orçamentário |
| Fechamento | 3 | Sinalizar possível fim de bloco com sequência estrutural anterior | Confirmar sozinho que houve orçamento antes |
| Condição da extração | 4 | Registrar condição técnica da página | Ser usada como sinal de presença/ausência de orçamento; corrigir/inventar conteúdo |

Nenhuma definição é marcada `sufficientAlone: true` — invariante verificado por teste dedicado. Nenhum peso, score, confiança percentual ou limiar arbitrário existe no catálogo.

## 7. Famílias de sinais (resumo)

Referencial (`referential-budget-spreadsheet-mention`, `referential-annex-listing`), Estrutural (`structural-service-item-identification`, `structural-unit-quantity-price-block`, `structural-total-value-column`, `structural-bdi-documentary-mention`, `structural-tabular-row-repetition`), Continuidade (`continuity-repeated-header`, `continuity-stable-geometry`, `continuity-repeated-row-pattern`), Fechamento (`closure-general-total-mention`, `closure-density-drop`, `closure-structural-break`), Condição da extração (`extraction-text-available`, `extraction-no-extractable-text`, `extraction-degraded-quality`, `extraction-indeterminate-quality`).

## 8. Regras de insuficiência

Cada definição carrega `insufficiencyRationale` obrigatório. Regras arquiteturais formalizadas como texto, não como código de decisão: sinal referencial nunca é suficiente; sinais estruturais precisam coexistir entre si; geometria é sinal auxiliar, nunca suficiente isoladamente; fechamento isolado nunca comprova orçamento antecedente; sinais de condição de extração nunca decidem papel documental.

## 9. Casos positivos

- **Estrutura A** (`fixture-positive-structure-a`, 7 páginas): obra fictícia "Vale Verde", paisagem larga, cabeçalho `Código | Descrição | Unidade | Quantidade | Valor Unitário | BDI | Valor Total`, BDI ausente deliberadamente em uma página, última página de detalhe também fecha o bloco (múltiplos papéis).
- **Estrutura B** (`fixture-positive-structure-b`, 6 páginas): obra fictícia "Serra Alta", retrato (geometria materialmente diferente de A), cabeçalho `Item | Unidade | Quant. | Preço Unit. Sem Encargos | Descrição do Serviço | Total do Item` (ordem e vocabulário diferentes), BDI documentado como nota de rodapé isolada em vez de coluna, nunca usa a expressão exata "Planilha Orçamentária", página 1 combina capa e menção referencial (segundo exemplo de múltiplos papéis).

Diferença material verificada por teste automático: orientação de página e conjunto de sinais estruturais usados diferem entre A e B (não apenas troca de palavras).

## 10. Falsos positivos

- **Índice/sumário** (2 páginas): menciona "Planilha Orçamentária", "Orçamento", "BDI" — sem estrutura, `Contextual`, sem continuidade.
- **Demonstrativo financeiro** (2 páginas): valores/totais/percentuais fictícios, sem item de serviço — `Discarded`.
- **Cronograma físico-financeiro** (2 páginas): atividades/percentuais/totais, sem colunas de unidade/quantidade/valor unitário — `Discarded`.
- **Geometria sem orçamento** (3 páginas): desenho técnico fictício em paisagem larga, mesma geometria de um bloco candidato típico, zero sinais estruturais — sempre `Discarded`, prova dedicada de que geometria nunca é suficiente isoladamente.

## 11. Adversarial

`fixture-false-positive-adversarial` (3 páginas): contém a expressão exata "Planilha Orçamentária", código, unidade, quantidade, BDI, valor unitário e total geral — mas sem repetição coerente de linha, sem cabeçalho repetido e sem continuidade entre páginas. Todas as três páginas permanecem `Ambiguous`, nunca `Candidate` — prova de que contagem de palavras-chave não basta.

## 12. Casos de condição documental

`fixture-documentary-condition-cases` (8 páginas): vazia, sem texto extraível (distinta da vazia), erro de extração, qualidade degradada, qualidade indeterminada, estrutura parcial com lacuna (grupo de continuidade real de 2 páginas interrompido logo após, com `expectedGaps` explícito, sem invenção de conteúdo) e fechamento isolado sem sequência antecedente (`Ambiguous`, nunca `Candidate`).

## 13. Verdade de referência

Cada página sintética (`SyntheticPageReference`) carrega: papéis documentais (múltiplos permitidos), sinais esperados com forma observada descrita textualmente, sinais explicitamente ausentes, decisão de referência (`Candidate`/`Contextual`/`Ambiguous`/`Discarded`), grupo de continuidade opcional, lacunas esperadas, justificativa humana, geometria, condição de extração e versão da fixture. É escrita à mão — nenhum código desta Sprint a calcula; será o alvo que a 21.4A.2.d precisará satisfazer.

## 14. Governança

Todas as 8 fixtures carregam `governance.classification === "synthetic-independent"` com todas as flags (`createdManually`, `independentFromClientDocuments`, `noTranscription`, `noAutomaticDerivation`, `noRealValues`, `noRealCodes`, `noRealNames`, `noIdentifiableClientStructure`, `authorizedForInternalRegression`) `true` — verificado por teste. Um teste dedicado varre o JSON serializado de toda a suíte em busca de 11 strings exclusivas do caso real (`Lagoa do Arroz`, `DNOCS`, `COT-015`, `9.809.087`, `Concretisa`, `CONJASF`, `HIDROMEC`, `90006`, `Pregão`, `George Pontes`) e falha se qualquer uma aparecer. Outro teste confirma que nenhuma fixture usa a faixa física 44–54 como regra de página candidata. Nenhuma fixture foi derivada do documento real; nenhuma autorização adicional foi necessária porque nenhum conteúdo real foi usado.

## 15. Repetibilidade

Duas cargas independentes de `buildSyntheticReferenceSuite()` comparadas por: serialização JSON completa, hash SHA-256 normalizado, contagem e ordem de documentos/páginas, ordem dos sinais esperados por página. Resultado idêntico nas duas cargas. **Este teste valida a repetibilidade do conjunto sintético e da normalização pura — não valida a repetibilidade física do `pdfjs-dist`, que permanece em aberto para a Sprint 21.4A.2.c.**

## 16. Portão de generalização (registrado para Sprints futuras)

> O mecanismo definitivo somente poderá ser aceito quando decidir corretamente 100% do conjunto de referência vigente, contendo pelo menos duas estruturas positivas materialmente distintas e pelo menos três falsos positivos, incluindo um adversarial, sem condição de produção vinculada ao documento Lagoa do Arroz.

Nesta Sprint, apenas o conjunto de referência foi criado e validado. Nenhuma precisão, recall ou acurácia é declarada.

## 17. Testes

- `budget-document-signal-catalog.test.ts` (10 testes): integridade estrutural, versão, ausência de sinal suficiente isoladamente, mínimo por família, presença das 5 famílias, busca por id, imutabilidade em tempo de execução (`Object.freeze` recursivo — testado tentando mutar e capturando o erro), detecção de id duplicado, de sinal marcado suficiente indevidamente, de referência pendente.
- `synthetic-reference-suite.test.ts` (15 testes): versões declaradas, integridade/cobertura/governança completa, mínimos de documentos, adversarial nunca candidato, menção referencial sem estrutura (dedicado), estrutura sem frase exata ainda candidata (dedicado), adversarial não vira candidato por contagem lexical (dedicado), geometria nunca suficiente isoladamente (dedicado), fechamento isolado nunca candidato (dedicado), múltiplos papéis, condições documentais obrigatórias, governança sintética, ausência de strings do caso real, ausência de regra fixa 44–54, repetibilidade de duas cargas independentes.
- `budget-document-location-boundaries.test.ts` (6 testes): existência de fonte, ausência de import de `document-processing`/`document-reconstruction`/`budget-version`/`procurement-engineering`, ausência de import de `apps/web`/Supabase, ausência de `pdfjs`/OCR/IA/Supabase como palavra-chave, direção inversa (domínios existentes não importam a nova capacidade), fixtures não exportadas no barrel público.

Total: 31 testes novos, todos executados individualmente via `npx tsx` e confirmados passando.

## 18. Limitações

- Limiares de qualidade de extração (degradado/indeterminado) permanecem conceituais — nenhum número foi fixado, conforme exigido.
- A verdade de referência é uma expectativa humana, não uma medição contra o `pdfjs-dist` real.
- O catálogo cobre as 5 famílias mínimas exigidas; novas famílias/sinais poderão ser adicionados por versão futura (`definitionVersion`/`catalogVersion` já preparados para isso).

## 19. Decisões abertas para 21.4A.2.c

Caminho definitivo do adaptador de `pdfjs-dist`; formato definitivo da fonte binária; resolvedor de conteúdo documental; contrato definitivo de extração física; persistência; `metadata` livre versus tipo próprio; uso definitivo de geometria como sinal formal; limiares de texto degradado; algoritmo final de continuidade; motor de decisão por página; nome definitivo do mecanismo persistido.

## 20. Itens expressamente não implementados

Leitura física de PDF, `pdfjs-dist`, OCR, resolvedor de conteúdo documental, download do Supabase Storage, contrato de adaptador, persistência, migração, tabela, RLS, Serviço de Aplicação, rota, interface, IA, decisão final por página, algoritmo de continuidade, pontuação, limiar arbitrário, leitura econômica, `locateBudgetPages`/`classifyPage`/`decideCandidatePages`/`computePageScore`/`detectBudgetSequence` ou equivalentes.
