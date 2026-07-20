# Epic 21 — Sprint 21.4A.2.g.3 — Avaliação Neutra de Continuidade na Fronteira entre Páginas

**Status: implementada com validação executável, isolamento em dois níveis (grupo e par), nove portões de conservação, matriz de classificação determinística e guard arquitetural dedicado. Última Sprint preparatória da cadeia estrutural antes da 21.4B (persistência).**

## Objetivo e posição na cadeia

Esta capacidade responde exclusivamente "quais fronteiras entre páginas consecutivas do mesmo grupo apresentam evidência estrutural — nunca econômica — suficiente para serem tratadas como candidatas de continuidade?". Ela **avalia relações entre fatos já publicados pela g.2**, nunca forma estrutura documental nova: nenhuma página, região, linha, posição ou célula é criada, alterada, fundida ou concatenada. "Candidato" nunca significa confirmação — a Caracterização Econômica, fora de escopo aqui, é quem eventualmente decidirá o que essas fronteiras significam.

O nome da função pública (`evaluateBudgetDocumentPageBoundaryNeutralContinuity`, não `form...`) é deliberado: a capacidade classifica estrutura existente, não constrói estrutura nova.

## Entrada única

A entrada é **exclusivamente** `BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult` — o resultado já publicado pela g.2. A g.3 nunca importa em produção f.0 (localização de páginas), f.1 (reconstrução estrutural), f.2a (detecção de regiões), f.2c (hipóteses físicas de célula) ou g.1 (evidência textual) diretamente; nunca relê o PDF. Essa é a descoberta central que fechou a especificação: como cada `NeutralDocumentRegion` da g.2 já materializa por referência a `TabularRegionCandidate` inteira (geometria e ordem física incluídas) e cada `NeutralDocumentLine` já materializa a linha física reconstruída, a g.2 sozinha é suficiente — reduzindo o guard arquitetural e os portões de compatibilidade de linhagem a um único contrato de origem, em vez de quatro.

A validação de entrada confirma, antes de formar qualquer população: contrato/versão/perfil da g.2 suportado (comparação exata, nunca lexical); `status !== "failed"`; e o fingerprint de identidade **e** o fingerprint final da g.2 recomputados a partir dos campos que ela mesma publica (reaproveitando a função real `computeResultFingerprint` da g.2 por deep import — nunca uma fórmula paralela). Qualquer falha aqui invalida o resultado inteiro (`status: "failed"`, zero avaliações) — nunca localizada.

## Unidade normativa versus unidade relacional

A **unidade normativa** é a fronteira entre duas páginas consecutivas do mesmo grupo — toda fronteira esperada produz exatamente uma avaliação, mesmo quando não processável ou falha. A **unidade relacional**, quando disponível, é região→região: a região de maior `order` ("fecha" a página de origem) para a região de menor `order` ("abre" a página de destino). As linhas de fronteira (maior/menor `verticalOrder` dentro dessas regiões) entram como identidade auxiliar da avaliação — nunca como uma segunda relação paralela.

## População normativa e Gate 0

Para cada grupo: as páginas são ordenadas por `pageNumber` e validadas quanto a duas propriedades independentes, ambas isolando no nível do **grupo** (nunca do par, nunca globalmente) quando violadas:

1. **Contiguidade/duplicidade** — o conjunto de `pageNumber` deve ser um intervalo de inteiros denso, sem lacuna nem repetição. Grupos são formados rio acima como intervalo de página contíguo por construção (`contiguous-candidate-pages-v1`, em `page-location`); encontrar uma lacuna aqui só pode significar incoerência de linhagem entre contratos — nunca uma lacuna legítima do domínio, e por isso nunca é contornada ou silenciosamente ignorada.
2. **Coerência de chave de região/linha** (emenda 2) — dentro de cada página: `sourceRegionKey` único; `region.pageNumber` e `sourceRegionCandidate.{regionKey,pageNumber}` consistentes; `sourceLineKey` único e nunca compartilhado entre duas regiões da mesma página; `line.pageNumber` e `sourceLine.{lineKey,pageNumber}` consistentes. Uma duplicidade ou incoerência de chave é falha de contrato upstream — nunca um empate de seleção.

Para um grupo coerente: `evaluationCount(group) = max(0, group.pages.length - 1)`, uma avaliação por par consecutivo. Identidade composta: `(sourceCandidateGroupKey, originPageNumber, targetPageNumber)` — nenhuma chave pública nova.

## Seleção de fronteira

```
selectClosingRegion(page)  = região de maior order entre as elegíveis
selectOpeningRegion(page)  = região de menor order entre as elegíveis
selectClosingLine(region)  = linha de maior verticalOrder entre as elegíveis
selectOpeningLine(region)  = linha de menor verticalOrder entre as elegíveis

ELIGIBLE_BOUNDARY_REGION_STATES = todos os estados de região, EXCETO upstream_not_processable e failed
ELIGIBLE_BOUNDARY_LINE_STATUSES = structured | structured_with_problems | without_positions
                                   (emenda 1: upstream_not_processable NUNCA é elegível, ao lado de failed)
```

Zero candidatos elegíveis → `missing` (sinal de existência, não falha). Empate no valor extremo entre duas regiões/linhas distintas → `ambiguous`, tratado como **falha localizada do par** (`boundary_region_selection_ambiguous`/`boundary_line_selection_ambiguous`), nunca resolvido por escolha arbitrária e nunca confundido com ausência.

## Sinais e matriz de classificação

Cinco sinais — três gates de existência (A, B, C) e dois de mérito (D, E), nesta ordem:

- **A — processabilidade das páginas**: `PROCESSABLE_PAGE_STATES = structured | structured_with_problems | partially_structured`.
- **B — existência da região de fronteira**: resultado da seleção extremal.
- **C — existência da linha de fronteira**: idem.
- **D — compatibilidade de assinatura de colunas**: igualdade exata (nunca threshold) da sequência ordenada de `columnOrder` entre a linha de fronteira de origem e a de destino. Contagem zero em qualquer lado → inconclusivo; tamanhos diferentes → mismatch, nunca inconclusivo. `positionCategory` nunca participa — só existência e ordem de coluna, estruturais, nunca econômicas.
- **E — compatibilidade geométrica horizontal**: `horizontalOverlapRatio`, `widthSimilarityRatio`, `leftBoundaryDeviationRatio`, `rightBoundaryDeviationRatio`, calculados a partir de `leftPoints/rightPoints/widthPoints` das duas `TabularRegionCandidate`. Largura mínima ≤ 0 → inconclusivo (guarda de divisão por zero), nunca `NaN`/`Infinity` publicado.

Qualquer sinal A/B/C fora do caso totalmente favorável → `continuity_not_processable` (estrutura necessária ausente ou não processável — nunca avaliado, nunca ambíguo). Só então os sinais de mérito D/E decidem, por uma única função total, sem score/peso/média:

```
1. exceção técnica ou empate estrutural na seleção  → continuity_evaluation_failed
2. sinal A, B ou C fora do caso favorável            → continuity_not_processable
3. qualquer evidência contrária (D mismatch ou
   E incompatible)                                    → continuity_not_sustained
4. D match E E compatible, nenhuma contrária           → continuity_sustained
5. demais combinações sem contrária                    → continuity_ambiguous
```

## Perfil v1 — thresholds geométricos

```
minimumHorizontalOverlapRatio:                    0.85
minimumWidthSimilarityRatio:                      0.90
maximumLeftBoundaryDeviationToMinimumWidthRatio:  0.05
maximumRightBoundaryDeviationToMinimumWidthRatio: 0.05
```

Política determinística v1, não medição validada contra documento real — o único parâmetro desta Sprint que é julgamento, não dedução estrutural; revisável por incremento de `profileVersion`, sem qualquer impacto de forma no contrato. Limitação registrada explicitamente: `structural_thresholds_not_validated_against_real_budget_documents`. Comparação textual está **excluída** da v1 (`textual_repetition_not_evaluated_in_v1`); salto sobre página vazia/não processável também (`page_skip_continuity_not_evaluated_in_v1`) — v1 avalia estritamente páginas consecutivas.

## Evidência — união fechada

```typescript
type PageBoundaryNeutralContinuityEvidence =
  | { evidence: "matching_column_signature"; sourceSignal: "column_signature_compatibility"; sourceOutcome: "column_signature_match" }
  | { evidence: "compatible_horizontal_geometry"; sourceSignal: "horizontal_geometry_compatibility"; sourceOutcome: "geometry_compatible" }
  | { evidence: "mismatching_column_signature"; sourceSignal: "column_signature_compatibility"; sourceOutcome: "column_signature_mismatch" }
  | { evidence: "incompatible_horizontal_geometry"; sourceSignal: "horizontal_geometry_compatibility"; sourceOutcome: "geometry_incompatible" };
```

Nunca texto livre. Resultados inconclusivos nunca produzem evidência favorável nem contrária.

## Conservação — nove portões

Cada um recalcula a partir dos grupos **reais** da g.2 consumida, nunca a partir do próprio resultado da g.3, reutilizando a mesma `evaluateBoundaryPair` da formação (único classificador de par, nunca duas implementações paralelas):

1. **população** — conjunto de fronteiras produzidas == recalculado do zero, sem duplicatas.
2. **referência** — toda chave não-nula publicada existe de fato na g.2 consumida.
3. **direção/grupo** — `targetPageNumber === originPageNumber + 1`, mesmo `sourceCandidateGroupKey`. Sob a codificação atual, qualquer violação de direção já muda a identidade da fronteira e por isso é normalmente capturada primeiro pelo Gate 1 — o Gate 3 permanece como defesa em profundidade explícita, não código morto.
4. **seleção** — região/linha de fronteira recalculadas == publicadas.
5. **sinais** — `observedSignals` recalculados == publicados.
6. **evidência** — toda evidência publicada é derivável dos sinais recalculados.
7. **estado** — estado publicado == matriz de classificação aplicada aos sinais recalculados.
8. **partição categórica** — total produzido == soma exata das cinco categorias.
9. **métricas** — métricas publicadas == recalculadas a partir das avaliações e problemas técnicos globais publicados.

## Isolamento de falha — dois níveis

**Nível grupo**: Gate 0 (contiguidade/duplicidade de página, coerência de chave de região/linha) — uma violação zera as avaliações **daquele grupo**, sem afetar grupos irmãos. **Nível par**: exceção durante seleção de fronteira ou avaliação de sinal, ou empate estrutural registrado — produz uma avaliação `continuity_evaluation_failed` isolada **àquele par**, sem afetar os demais pares do mesmo grupo. Uma página com seleção ambígua apenas em um papel (ex.: linha de fronteira ambígua só como origem de fechamento) nunca contamina a fronteira vizinha que usa a mesma página em papel diferente (ex.: como abertura) — provado tanto por fixture direta quanto pela cadeia real.

## Determinismo e fingerprints

`evaluations` é sempre ordenada canonicamente por `(sourceCandidateGroupKey, originPageNumber, targetPageNumber)` — nunca por chave de região/linha, que pode ser `null`. Fingerprint de identidade: resume `sourceByteHash`, a identidade completa da g.2 consumida (incluindo os dois fingerprints que ela mesma publica, que já comprometem transitivamente toda a linhagem f.0→g.1) e a identidade/perfil/regras da própria g.3 — nunca o conteúdo produzido. Fingerprint final: identidade + toda a hierarquia de avaliações publicada. Ambos SHA-256 sobre representação canônica por valor; nunca timestamp, ordem de descoberta, caminho de arquivo ou identificador aleatório.

## Testes

Suíte cobre, com fixtures que constroem diretamente o formato de saída da g.2 (sem executar o pipeline f.1→g.2 nos testes unitários): validação global e Gate 0 (lacuna, duplicidade, coerência de chave, ties legítimos não confundidos com incoerência); seleção de fronteira (ausência, empate, correção de extremo entre múltiplas regiões/linhas, emenda 1); os cinco sinais, incluindo os quatro limites geométricos exatamente na borda e imediatamente além dela; a matriz de classificação completa (3×3 = nove combinações de sinais de mérito); os nove portões de conservação, cada um violado adversarialmente; o orquestrador de ponta a ponta (sustained/not_sustained/ambiguous/not_processable/failed, isolamento de par com uma página compartilhando papéis distintos, isolamento de grupo, invariância de permutação, entrada inválida, determinismo de fingerprint); golden trace com as quatro categorias reacháveis num único trace determinístico; o guard arquitetural; e a cadeia real — quatro páginas de um PDF sintético via pdf.js, provando contra geometria fisicamente medida (não sintetizada) que uma página que carrega um marcador adicional (BDI, usado apenas para localização de página rio acima) deixa de sustentar continuidade com a seguinte por diferença geométrica real, enquanto duas páginas de layout idêntico sustentam, e uma página com geometria deliberadamente deslocada não sustenta.

## Guard arquitetural

Prova: nenhum import de produção resolve em f.0/f.1/f.2a/f.2c/g.1/leitura física; nenhuma dependência de `apps/web`, Serviço de Aplicação, persistência, Supabase, IA ou OCR; ausência de vocabulário econômico; ausência de vocabulário de fusão/concatenação entre páginas/regiões/linhas (`merge`, `concatenate`, `chooseCorrectPage`, varredura por palavra inteira); que a g.2 nunca importa a g.3 (nunca bidirecional); e que o barrel público não vaza seleção de fronteira, avaliador de sinal, classificador, conservação, métricas, fingerprint, validação de entrada, seam de dependências ou perfil concreto.

## Declarações negativas

Uma avaliação de fronteira não é continuidade confirmada; região candidata não é tabela confirmada; linha documental não é linha orçamentária. Nenhuma fusão de página, região ou linha é realizada; nenhuma linha multipágina é criada. Nenhum parsing numérico/decimal/percentual, Caracterização Econômica, `BudgetLine`/`BudgetVersion`, Proposta de Importação, persistência, API, rota, UI, visualizador de auditoria, IA ou OCR. Nenhum documento real (BM_08 fora desta Sprint); nenhuma alegação de prontidão comercial; os limites geométricos do perfil v1 não foram validados contra documento real.

## Próximo passo

Esta é a última Sprint preparatória da cadeia estrutural (f.0→g.3) antes da 21.4B. A partir daqui, a Caracterização Econômica pode consumir tanto a hierarquia neutra local à página (g.2) quanto as fronteiras de continuidade candidata (g.3) já formalizadas — sem necessidade de reabrir nenhum dos dois contratos para adicionar continuidade depois.
