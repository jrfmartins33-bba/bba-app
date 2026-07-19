# Epic 21 — Sprint 21.4A.2.g.1 — Evidência Textual Auditável das Hipóteses Físicas de Célula

**Status: implementada com validação executável, isolamento regional e conservação.**

## Objetivo e posição na cadeia

Esta capacidade enriquece cada `PhysicalCellHypothesis` produzida pela Sprint 21.4A.2.f.2c com os itens textuais físicos que efetivamente deram origem aos segmentos da célula. Responde apenas "quais itens textuais físicos sustentam cada hipótese física de célula, e qual foi o resultado auditável da resolução de cada segmento e de cada ocorrência textual?" — nunca "qual é o significado econômico desse texto?".

Ela **amplia, nunca substitui**, o resultado da f.2c: `physical_cell_text_evidence_augments_but_does_not_replace_physical_cell_hypothesis_formation` é uma limitação pública declarada. Interseções, interseções vazias, `gridBounds`, `observedContentBounds`, ambiguidades da malha, falhas físicas, disposições de segmento e segmentos fora de célula continuam existindo exclusivamente no resultado da f.2c — a g.1 não os copia. Não produz ainda a Evidência Estruturada Neutra completa prevista pelo ADR-005, nem linha documental neutra, papel estrutural, papel econômico, parsing numérico, continuidade entre páginas, Caracterização Econômica ou Proposta de Importação do Orçamento.

## Contrato e linhagem

A entrada é composta por exatamente três contratos já produzidos: `PhysicalDocumentReadResult`, `BudgetDocumentStructureReconstructionResult` e `BudgetDocumentPhysicalCellHypothesisFormationResult`. Nenhuma releitura do PDF, nenhum consumo de bytes, nenhuma dependência de `tabular-region-detection` ou `physical-column-hypothesis-reconstruction` crus — os campos que a f.2c já expõe achatados (`sourceLineKey`, `rowOrder`, `columnOrder`, `gridBounds`) tornam esses dois contratos intermediários desnecessários.

A cadeia de resolução confirmada é:

```
PhysicalCellHypothesis.segmentKeys
  → ReconstructedHorizontalSegment.sourceTextItemIndices
    → PhysicalDocumentPage.textItems[index]
```

A validação de entrada confirma, antes de processar qualquer grupo, a igualdade direta (nunca por fingerprint) entre os campos de identidade achatados de `PhysicalDocumentReadResult` presentes em `BudgetDocumentStructureReconstructionResult`, e entre os campos de identidade achatados de `BudgetDocumentStructureReconstructionResult` presentes em `BudgetDocumentPhysicalCellHypothesisFormationResult`. Também confirma correspondência estrutural de grupo, página e região entre os dois contratos superiores, e que toda `gridIntersectionKey` de toda célula resolve dentro de `region.gridIntersections` — sem isso não existem linha, página, região, `rowOrder` ou `columnOrder` confiáveis, e a execução inteira falha (nunca uma região isolada).

## Falha global versus defeito localizado

Falham a execução inteira, antes de qualquer grupo ser produzido: contrato/versão/perfil incompatível, `sourceByteHash` divergente, linhagem divergente, grupo/página sem correspondência estrutural, e célula sem interseção correspondente.

Permanecem localizados, isolados por segmento ou por item, sem derrubar outras células ou regiões: segmento inexistente; linha referenciada pelo segmento inexistente na reconstrução estrutural; linha diferente da linha da própria interseção da célula; página do segmento divergente da página da região; segmento estruturalmente reivindicado por mais de uma célula (defensivo — impossível dado um resultado válido da f.2c, mas nunca resolvido silenciosamente); item textual inexistente; item pertencente a outro segmento; ocorrência textual duplicada (inclusive entre células diferentes da mesma região); falha técnica inesperada de resolução ou montagem.

A ordem declarada em `PhysicalCellHypothesis.segmentKeys` é validada, nunca recalculada, contra `horizontalOrder`: uma divergência invalida a célula inteira como `unresolved_technical_failure`, com todos os `segmentKeys` preservados sob `unresolved_segment_formation_failed`/`segment_resolution` — nenhuma ordem é inventada silenciosamente.

## Fragmentos, ocorrências e normalização

Cada fragmento preserva `sourceReferenceOrder` (posição 1-based em `sourceTextItemIndices`, nunca recalculada), `textItemIndex`, `originalText` (verbatim) e `normalizedText`. A unidade de conservação é a **ocorrência** — `(segmentKey, sourceReferenceOrder, textItemIndex)` — nunca o índice distinto: uma referência duplicada nunca desaparece por deduplicação, mesmo entre segmentos de células diferentes da mesma região.

A normalização reutiliza literalmente `normalizePageText([originalText])`, já pública e testada desde `signal-observation`, sob identidade explícita `PHYSICAL_CELL_TEXT_EVIDENCE_NORMALIZATION_VERSION` — nunca uma regra nova, nunca uma terceira representação textual. `normalizedText` é sempre `string`, nunca `null`, porque `normalizePageText` nunca retorna `null`. Nenhuma string de apresentação concatenada é criada; nenhum fragmento pode ser chamado de verbatim além do próprio array de fragmentos.

## Estados

Uma `PhysicalCellTextEvidence` é `formed` apenas quando todo segmento resolveu e toda ocorrência foi incluída com segurança; `partially_formed` quando existe ao menos um fragmento seguro e ao menos uma falha; `unresolved_technical_failure` quando nenhum fragmento seguro pôde ser produzido. Uma célula nunca é chamada `formed` sem fragmento. Estados físicos herdados da f.2c (`sourcePhysicalCellHypothesisFormationRegionStatus`/`PageStatus`/`GroupStatus`/`Status`) são preservados separadamente em todos os níveis — uma execução textual bem-sucedida nunca apaga um problema, ambiguidade ou estado não processável físico.

## Conservação

Cinco portões executáveis, cada um recalculando a partir dos dados reais e comparando campo a campo, nunca confiando apenas em contagens totais:

1. **Hipóteses de célula** — toda `PhysicalCellHypothesis` produz exatamente uma `PhysicalCellTextEvidence`.
2. **Segmentos referenciados** — todo `segmentKey` de `segmentKeys` produz exatamente um `PhysicalCellTextSegmentOutcome`, na mesma ordem.
3. **Ocorrências de itens textuais** — baseada em ocorrências (não em índices distintos); a contagem esperada é recalculada de forma independente a partir de `structurePage`, nunca confiando na aritmética do próprio módulo de formação.
4. **Fragmento ↔ disposição incluída** — bidirecional: todo fragmento tem exatamente uma disposição `included_in_text_fragment` correspondente e vice-versa, e o texto do fragmento é revalidado contra o item físico real e a regra de normalização vigente.
5. **Categorias métricas** — um classificador único (não exportado pelo barrel) alimenta tanto o cálculo de métricas quanto o portão, exatamente como a f.2c já provou.

## Determinismo e testes

Chaves de grupo/página/região usam SHA-256 sobre JSON canônico. `PhysicalCellTextEvidence` usa `cellHypothesisKey` como identidade 1:1 herdada — nenhuma chave própria contraditória. O fingerprint de identidade inclui as três identidades completas de origem (incluindo os três status globais upstream), a versão da normalização e a versão da regra de montagem — nunca duplicadas por célula. Nenhum grupo/página/região é ordenado por confiança na ordem de entrada: todo nível é reordenado explicitamente por chave de conteúdo estável (grupo por página inicial e chave; página por `pageNumber`; célula por `rowOrder`/`columnOrder`/`cellHypothesisKey`), o que torna a invariância de permutação verdadeira por construção, não por promessa.

A suíte cobre contratos e versões incompatíveis, cada campo de linhagem achatado individualmente, correspondência estrutural grupo/página/célula↔interseção, todas as variantes de resultado de segmento com sua comparação objetiva, resolução de item por `index` (nunca por posição de array), duplicidade regional inclusive entre células, vetores normativos de normalização, os cinco portões de conservação com casos adversariais, agregação hierárquica de métricas sem perda ou duplicação, chaves determinísticas, isolamento real entre duas regiões independentes, falha global genuína, golden trace completo (célula simples, célula multissegmento, múltiplos itens no mesmo segmento, símbolo monetário, percentual, `|`, Unicode, espaços múltiplos, tabulação, `originalText` divergente de `normalizedText`) com permutação de toda coleção de ordem incidental, e a cadeia real iniciada em PDF sintético pelo leitor físico real através de todos os estágios reais até esta capacidade.

## Guard arquitetural

Um guard dedicado prova, além do isolamento já herdado do domínio (`document-processing`, `document-reconstruction`, `budget-version`, `procurement-engineering`, `infrastructure`, Supabase, web): ausência de qualquer palavra-chave de domínio econômico (código de serviço, papel de descrição, preço unitário/total, `BudgetLine`, `BudgetVersion`, `MoneyCents`, BDI, subtotal, papel de cabeçalho/rodapé/nota, continuidade entre páginas); que a f.2c continua sem importar o contrato de leitura física (só a g.1 resolve texto); que `signal-observation` permanece intocado; e que nenhum classificador, resolvedor, seam de dependências ou perfil concreto é exportado pelo barrel público.

## Declarações negativas

Evidência textual de célula não é célula documental confirmada nem campo econômico; texto original é preservado separadamente do normalizado; texto normalizado não é verbatim da fonte; nenhuma string de apresentação derivada é criada. Não há leitura de código de serviço, descrição, unidade, quantidade, preço, total, BDI; nenhuma linha ou versão de orçamento criada; nenhuma proposta de importação; nenhuma continuidade entre páginas avaliada; ambiguidades permanecem explícitas; nenhuma IA ou OCR; nenhuma persistência, API, rota, UI ou visualizador de auditoria; nenhum documento real; nenhuma alegação de prontidão comercial.
