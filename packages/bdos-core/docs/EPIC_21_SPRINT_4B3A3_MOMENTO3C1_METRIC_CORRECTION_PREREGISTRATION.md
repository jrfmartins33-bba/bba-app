# Epic 21 — Sprint 21.4B.3A.3 — Momento 3C.1 — Pré-registro da correção aditiva de métricas

**Status: pré-registro da correção, ANTES de qualquer recálculo ou nova implementação.** Este documento congela o contrato (tipos, algoritmos, convenções de nomenclatura) que a implementação v2 do Momento 3C.2 deverá satisfazer, e os testes sintéticos/fixtures que essa implementação deverá passar. Nenhuma saída bruta de Docling ou PaddleOCR foi reexecutada ou reprocessada para produzir este documento. Nenhum arquivo do Momento 2 (verdade de referência), Momento 3A (protocolo v1) ou Momento 3B (adaptadores, execução real, resultados v1, relatório v1) foi alterado.

## 0. Origem e escopo

Este documento responde à revisão técnica formal da Sprint 21.4B.3A.3 (aprovada com veredito `APROVADA_COM_CORRECAO_ADITIVA_OBRIGATORIA`), que identificou:

- **Problema 1 / A** — `computeLocalReaderRegionTextMetrics` conta por componente de associação, não por região esperada individual.
- **Problema 2 / B** — a classificação de componentes N:1/1:N em `associateObservedRegionsToReference` cai em `"recovered"` sem nunca verificar correspondência textual real.
- **Achado adicional / C, D, E** — em `run-local-reader-evaluation.ts`, três blocos (`multiline`, `mathEvidenceCounts`, parte de `viabilityInputs`) usam constantes literais (`[]`, `false`) em vez de dados derivados das comparações reais — confirmado por evidência direta: as saídas `mathEvidenceCounts` e `multiline` são byte-idênticas entre Docling e PaddleOCR nos JSONs versionados, apesar de perfis de saída bruta radicalmente diferentes.

Nenhum destes cinco problemas altera o veredito de viabilidade já obtido (`nao_viavel_nesta_configuracao` para as duas ferramentas), porque esse veredito é forçado, de forma correta e independente, por `producedUsableTableCellStructure: false` — item que já era genuinamente derivado de `allCellComparisons` em v1. A correção existe para que (a) as métricas expostas nos artefatos versionados não sejam mal-interpretadas isoladamente, e (b) o script de avaliação real esteja pronto para medir corretamente uma ferramenta futura que produza alguma estrutura de tabela genuína — o que as constantes hardcoded de hoje mascarariam.

## 1. Regra de convivência v1/v2

- Nenhuma função, tipo ou arquivo do Momento 3A (`discovery-local-reader-{evaluation.types,normalization,coordinates,comparison,metrics,repetition,viability}.ts`) é alterado.
- Nenhum arquivo em `raw-adapters/` é alterado.
- `evaluation-run/run-local-reader-evaluation.ts` (script que produziu os resultados v1) **não é alterado nesta Sprint** — apenas lido como referência. A reescrita desse script é escopo do Momento 3C.2, autorização futura.
- `results/*.json` (os quatro arquivos: `aggregate-summary.json`, `docling-evaluation-result.json`, `paddleocr-evaluation-result.json`, `raw-acquisition-manifest.json`) permanecem intactos e são o registro histórico da primeira avaliação (v1). Resultados corrigidos serão escritos exclusivamente em `results/corrected-v2/` no Momento 3C.2, nunca sobrescrevendo os arquivos v1.
- Todo artefato novo desta correção vive em um diretório irmão dedicado, `local-reader-evaluation/v2/`, para que a natureza aditiva seja estruturalmente óbvia (nenhum arquivo v2 compartilha nome de arquivo com um v1).
- A verdade de referência (`reference-truth/discovery-reference-truth*.ts`) não é modificada em conteúdo. A cobertura adicional de teste (itens 10 e 11 abaixo) é um **novo arquivo de teste**, nunca uma edição do `discovery-reference-truth.test.ts` já congelado.

## 2. Decisão de execução dos testes de pré-registro

O enunciado desta etapa permite duas estratégias: "testes que falhem antes da implementação v2" ou "contratos declarativos sem executar a nova implementação". Esta Sprint adota a segunda, pelos seguintes motivos, registrados aqui para aprovação:

1. A convenção do repositório (`CLAUDE.md`) é que todo `*.test.ts` executado por `pnpm test`/`npx tsx` **passa** — não há framework que marque um teste como "esperado falhar" (`xfail`/`skip`) nesta base de código. Commitar um teste que falha propositalmente quebraria essa convenção e o CI (`typecheck → lint → build → test`).
2. Em vez disso, cada função v2 (Problemas A–E) recebe uma **assinatura de tipo real e uma implementação stub** que lança `Error("not implemented — Momento 3C.2 pendente de autorização")`. Isto é uma afirmação verdadeira e verificável hoje ("esta função ainda não existe, e chamá-la falha de forma explícita e documentada") — o teste de pré-registro afirma exatamente isso, e passa.
3. Os **casos sintéticos e os resultados esperados** (os 11 itens exigidos) são congelados como dados declarativos — fixtures de entrada e o resultado que a implementação v2 deverá produzir — exportados como constantes nomeadas, nunca calculados chamando a implementação v2 (que não existe ainda). O Momento 3C.2 deverá reutilizar essas mesmas constantes ao testar a implementação real, sem redefini-las depois de ver o comportamento do código — isso é o que preserva a disciplina de pré-registro.
4. Itens 10 e 11 (contagem de 1.019 células e resolução de `physicalRegionIds`) não dependem de nenhuma implementação v2 — operam sobre `REFERENCE_TRUTH_BUNDLES`, já congelado e existente. Esses dois são testes **reais, executados e aprovados nesta própria Sprint**, não fixtures declarativas para o futuro.

## 3. Problema A — granularidade das regiões

Arquivo de tipos: `v2/discovery-local-reader-evaluation-v2.types.ts`, interface `LocalReaderRegionTextMetricsV2`.

```ts
interface LocalReaderRegionTextMetricsV2 {
  readonly associationComponents: number;
  readonly expectedRegionsCoveredByAnyComponent: number;
  readonly expectedRegionsWithExactTextualMatch: number;
  readonly expectedRegionsCoveredSpatiallyOnly: number;
  readonly expectedRegionsOmitted: number;
  readonly observedRegionsAdditional: number;
}
```

Invariante congelada: `expectedRegionsCoveredByAnyComponent === expectedRegionsWithExactTextualMatch + expectedRegionsCoveredSpatiallyOnly`, e `expectedRegionsCoveredByAnyComponent + expectedRegionsOmitted === total de regiões esperadas na página`.

Algoritmo (função `computeLocalReaderRegionTextMetricsV2`, consome a saída — inalterada — de `associateObservedRegionsToReferenceV2`, ver Problema B):

1. Para cada componente, se `observedRegionIds.length === 0`: cada id em `referenceRegionIds` conta para `expectedRegionsOmitted`.
2. Se `referenceRegionIds.length === 0`: `observedRegionIds.length` conta para `observedRegionsAdditional`.
3. Caso contrário (componente com ambos os lados não vazios, qualquer forma 1:1/1:N/N:1/N:M): para **cada** região esperada do componente individualmente, verificar se existe **ao menos uma** região observada do mesmo componente cujo `normalizeLocalReaderText(observado) === normalizeLocalReaderText(esperado)`. Se sim → `expectedRegionsWithExactTextualMatch += 1`; caso contrário → `expectedRegionsCoveredSpatiallyOnly += 1`.
4. `associationComponents` = contagem total de componentes retornados por `associateObservedRegionsToReferenceV2` (inclui os de omissão/adicional).

Esta função é puramente aditiva a `computeLocalReaderRegionTextMetrics` (v1) — não o substitui, não o chama, não depende dele além de operar sobre o mesmo tipo `LocalReaderRegionComparisonResult`-like vindo de v2.

## 4. Problema B — associação N:1/1:N sem confirmação textual

Arquivo: `v2/discovery-local-reader-comparison-v2.ts`, função `associateObservedRegionsToReferenceV2`.

```ts
type LocalReaderRegionComponentOutcomeV2 =
  | "spatial_and_textual_match"
  | "spatial_overlap_without_text_match"
  | "expected_regions_split_across_observed"
  | "multiple_expected_regions_merged"
  | "expected_region_omitted"
  | "observed_region_additional";
```

Reaproveita **integralmente** a mesma construção de grafo de compatibilidade (aresta quando sobreposição espacial estrita OU texto normalizado idêntico) e a mesma extração de componentes conexos já congeladas em `associateObservedRegionsToReference` (v1) — a mudança é exclusivamente na **classificação final do componente**, nunca na formação de arestas/componentes (isso preservaria, se reaproveitado literalmente por composição, o mesmo particionamento de componentes que v1 produz, o que é desejável para que Problema A possa reconciliar `associationComponents` com o v1 `expectedRegionsRecovered` como checagem cruzada).

Classificação (nesta ordem, primeira regra aplicável):

1. `referenceRegionIds.length === 0` → `observed_region_additional`.
2. `observedRegionIds.length === 0` → `expected_region_omitted`.
3. `referenceRegionIds.length === 1 && observedRegionIds.length === 1`: se `normalizeLocalReaderText` dos dois lados forem iguais → `spatial_and_textual_match`; caso contrário → `spatial_overlap_without_text_match` (o componente só existe porque houve sobreposição espacial, já que texto divergente não teria formado aresta textual).
4. `referenceRegionIds.length === 1 && observedRegionIds.length > 1` → `expected_regions_split_across_observed`.
5. `referenceRegionIds.length > 1 && observedRegionIds.length === 1` → `multiple_expected_regions_merged`.
6. N:M raro (ambos os lados > 1): mesma regra de desempate já congelada para células em v1 (`discovery-local-reader-comparison.ts` §8, comentário de cabeçalho) — reaproveitada aqui por consistência, não inventada agora: mais observados que esperados → `expected_regions_split_across_observed`; caso contrário → `multiple_expected_regions_merged`.

**Nunca** classificar 4/5/6 como `spatial_and_textual_match` — essa categoria é exclusiva do caso 1:1. A existência de correspondência textual parcial dentro de um componente dividido/fundido é informação do **Problema A** (por região individual), não da classificação de forma do componente.

A comparação de células (`associateObservedCellsToReference`, v1) permanece **absolutamente inalterada** — o enunciado da autorização proíbe tocá-la, e ela já distingue split/merged sem o defeito do Problema 2 (confirmado na revisão).

## 5. Problema C — descrições multilinha

Arquivo: `v2/discovery-local-reader-multiline-v2.ts`, função `deriveObservedDescriptionLinesV2`.

```ts
function deriveObservedDescriptionLinesV2(
  bundle: ReferenceTruthPageBundle,
  logicalRowId: string,
  cellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>,
): {
  readonly observedLinesInOrder: ReadonlyArray<string>;
  readonly splitAcrossIncompatibleCells: boolean;
  readonly mergedWithNeighborItemText: string | null;
}
```

Algoritmo congelado:

1. Localizar todas as células esperadas de `col-descricao` para `logicalRowId` (mesma consulta já usada em v1, `descriptionLinesFor`), ordenadas por `id` (ordem física já garantida pela convenção de nomenclatura sequencial da verdade de referência).
2. Para cada célula esperada de descrição, localizar seu resultado em `cellComparisons` (por `referenceCellIds.includes(cellId)`).
3. Um resultado com `outcome === "direct_match"` contribui `normalizedObservedText` como a linha observada correspondente, na posição da célula esperada.
4. Um resultado com `outcome === "expected_cell_split_into_multiple_observed"` contribui `normalizedObservedText` (já uma junção `" | "`-separada em v1) e marca `splitAcrossIncompatibleCells = true` para esta linha lógica.
5. Um resultado com `outcome === "multiple_expected_cells_merged"` cujo grupo de referência **inclui células de descrição de OUTRA `logicalRowId` adjacente** (mesma página, `logicalRowId` de tipo `item_de_servico` imediatamente anterior ou posterior na ordenação de `id` de linha lógica) marca `mergedWithNeighborItemText` com o texto normalizado da célula vizinha envolvida — nunca por correspondência aproximada, apenas quando a própria comparação de células (já congelada, nunca fuzzy) identificou a fusão.
6. `outcome === "expected_cell_omitted"` não contribui nenhuma linha (aquela posição fica ausente do array — o array final pode ser mais curto que o esperado, o que já é semanticamente correto para os desfechos `partially_preserved`/`omitted` de `classifyLocalReaderMultilineDescription`, função v1 reaproveitada sem alteração).
7. `observedLinesInOrder` final = as linhas coletadas nos passos 3–4, na ordem das células esperadas (jamais reordenadas por heurística de coordenada — a ordem já é a ordem física congelada da verdade de referência).

A classificação final (`fully_preserved`/`partially_preserved`/`lines_out_of_order`/`split_into_incompatible_cells`/`merged_with_neighbor_item`/`omitted`) continua sendo produzida por `classifyLocalReaderMultilineDescription` (v1, **não alterada**) — o Problema C é exclusivamente sobre como os três argumentos de entrada (`observedLinesInOrder`, `splitAcrossIncompatibleCells`, `mergedWithNeighborItemText`) deixam de ser `[]`/`false`/`null` fixos e passam a ser derivados de `cellComparisons` reais.

Nenhum fuzzy matching é introduzido — toda a derivação usa exclusivamente os `outcome` já produzidos pela comparação de células congelada (v1).

## 6. Problema D — evidência matemática

Arquivo: `v2/discovery-local-reader-math-evidence-v2.ts`, função `deriveMathEvidenceFieldsV2`.

Convenção de mapeamento campo → coluna (congelada aqui, nunca definida antes porque `ReferenceTruthMathRelation` não referencia `columnId` diretamente):

| Campo da relação | `columnId` esperado | Linha (`logicalRowId`) |
|---|---|---|
| `quantity` | `col-quantidade` | `relation.logicalRowId` |
| `unitPrice` | `col-unit-cbdi` (papel `preco_unitario_com_bdi`, o "preço unitário exibido" referenciado por `displayedUnitPriceCents`) | `relation.logicalRowId` |
| `total` | `col-total-cbdi` (papel `preco_total_com_bdi`, referenciado por `displayedTotalCents`) | `relation.logicalRowId` |
| `subtotalOrTotal` | `col-total-cbdi` | `relation.logicalRowId` (aplicável apenas quando a própria linha é `grupo`/`subgrupo`/`subtotal`/`total`, refletindo `officialSubtotalOrTotalCents`) |

```ts
function deriveMathEvidenceFieldsV2(
  relation: ReferenceTruthMathRelation,
  cellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>,
  bundle: ReferenceTruthPageBundle,
): {
  readonly fieldsPresent: Record<LocalReaderMathEvidenceFieldKey, boolean>;
  readonly fieldsDivergentFromSource: ReadonlyArray<LocalReaderMathEvidenceFieldKey>;
}
```

**Ambiguidade identificada nesta etapa, registrada em vez de resolvida por presunção:** `classifyLocalReaderMathEvidence` (v1, congelada) recebe `fieldsPresent: Record<LocalReaderMathEvidenceFieldKey, boolean>` — um `Record` **completo** das 4 chaves, não um tipo parcial. A função conta "ausente" apenas quando as 4 chaves são `false`, e "completa" quando nenhuma é `false`. Isso significa que o tipo v1 nunca distinguiu "campo inexistente para esta relação" (ex. `subtotalOrTotal` numa linha `item_de_servico`, que nunca teve essa coluna) de "campo aplicável, mas não recuperado pelo leitor". Duas resoluções foram consideradas para a derivação v2:

- (a) marcar um campo não aplicável como `true` (vacuamente satisfeito) — evita que ele penalize uma relação totalmente recuperada como "parcial" em vez de "completa", mas tem o efeito colateral de transformar uma relação totalmente NÃO recuperada (ex. `quantity`/`unitPrice`/`total` todos ausentes, `subtotalOrTotal` inaplicável) de `evidencia_ausente` para `evidencia_parcial` — incorreto para o caso comum (item de serviço sem nenhuma evidência).
- (b) marcar como `false` (tratado como ausente) — resolve o caso acima corretamente, mas torna `evidencia_completa` inatingível para qualquer relação de linha `item_de_servico` (a maioria das 84), já que `subtotalOrTotal` nunca teria célula correspondente para esse tipo de linha.

**Nenhuma das duas é adotada aqui.** Esta é uma tensão real do tipo v1 congelado (`Record` completo em vez de `Partial`/lista explícita de campos aplicáveis) que a correção aditiva não pode resolver sem tocar `discovery-local-reader-evaluation.types.ts` — fora do escopo desta autorização. Fica registrada como **pendência explícita para decisão humana no Momento 3C.2**, junto de uma terceira opção a avaliar então: computar `subtotalOrTotalApplicable = relation.officialSubtotalOrTotalCents !== null` e, quando inaplicável, usar essa informação para escolher entre (a) e (b) dinamicamente por relação, em vez de uma regra fixa — mas isso também não foi implementado nem testado nesta etapa, apenas proposto.

Algoritmo para os 3 campos sempre aplicáveis a uma linha `item_de_servico` (`quantity`, `unitPrice`, `total` — nunca ambíguos, sempre presentes na verdade de referência para esse tipo de linha):

1. Localizar a célula esperada da verdade de referência com `logicalRowId === relation.logicalRowId` e `columnId` conforme a tabela acima.
2. Localizar o resultado de comparação dessa célula em `cellComparisons`.
3. `fieldsPresent[campo] = true` se e somente se `outcome === "direct_match"`.
4. `fieldsDivergentFromSource` recebe o campo se `outcome === "correct_coordinate_wrong_text"` (o leitor produziu algo na posição certa, mas com texto que diverge do valor oficial) — nunca por `expected_cell_omitted` (que é ausência, não divergência) nem por diferença de arredondamento (não há correção automática nem tolerância; a comparação já é literal).
5. `subtotalOrTotal` — tratamento pendente conforme a ambiguidade acima; o Momento 3C.2 não pode prosseguir com a implementação real deste campo específico sem que a opção (a), (b) ou a terceira alternativa seja escolhida explicitamente por quem aprova.

A classificação final (`evidencia_completa`/`evidencia_parcial`/`evidencia_ausente`/`evidencia_divergente_da_fonte`) continua sendo produzida por `classifyLocalReaderMathEvidence` (v1, **não alterada**) — apenas os argumentos de entrada deixam de ser constantes.

Quando nenhuma ferramenta produziu nenhuma célula estruturada (como de fato ocorreu em ambas nesta avaliação real), o resultado desta derivação real deve coincidir numericamente com o valor hoje hardcoded (`evidencia_ausente` para as 84 relações, ambas ferramentas) — a correção existe para que esse resultado passe a ser **demonstrado**, não presumido, e para que uma ferramenta futura com células reais produza um resultado diferente e correto.

## 7. Problema E — insumos da classificação de viabilidade

`classifyLocalReaderViability` (v1, tabela de decisão) **não é alterada nesta Sprint**, conforme exigido. Apenas a **origem** dos 12 campos de `LocalReaderViabilityGateInputs` passa a ser auditada — 5 já eram genuinamente derivados em v1, 1 é redefinido para usar dado mais rigoroso (Problema A), e os demais passam de constante para derivação real:

| Campo | Estado em v1 (`run-local-reader-evaluation.ts`) | Origem v2 congelada |
|---|---|---|
| `processedAllThreePages` | já derivado (`execution.pagesCompleted === 3`) | inalterado |
| `inventedMonetaryValue` | constante `false` | `allCellComparisons.some(c => c.outcome === "invented_cell" && /^\d{1,3}(\.\d{3})*,\d{2}$/.test(normalizedObservedText) ou padrão percentual `/^\d+,\d+%$/`)` — regex congelada, nunca correção "inteligente" de formato |
| `providedPhysicalOriginForCriticalFields` | constante `false` | `criticalFields.some(f => f.literalMatches > 0) && allCellComparisons.some(c => c.outcome === "direct_match" && c.referenceCellIds.some(id => é célula de papel crítico) && observedCell correspondente tem `boundingBox !== null`)` |
| `recoveredRequiredFieldsOf80Items` | já derivado (`criticalFields.every(...) && criticalFields.some(...)`) | inalterado |
| `incorporatedTcuNoteAsItemOrValue` | já derivado (`externalContent?.isCriticalRisk`) | inalterado |
| `producedUsableTableCellStructure` | já derivado (`allCellComparisons.some(c => c.outcome === "direct_match")`) | inalterado |
| `ranOffline` | constante `true` | manifesto de aquisição: `meta.hfHubOffline === "1" && meta.transformersOffline === "1"` (Docling) ou ausência de qualquer termo de rede em `meta.warnings`/`meta.errors` (PaddleOCR, que não expõe flag de offline própria) — nas 12 execuções |
| `reproducibleConfiguration` | já derivado (`rawOutputHashMatchByPage` universal) | inalterado |
| `failedOnAnyPage` | já derivado (`execution.pagesFailed > 0`) | inalterado |
| `requiredNetworkOrExternalService` | constante `false` | negação de `ranOffline` recém-derivado, cruzada com ausência de qualquer erro/aviso mencionando rede nas 12 execuções (dupla checagem, nunca apenas presumida) |
| `impedingInstability` | constante `false` | `execution.warnings.length > 0 \|\| execution.partialFailures.length > 0` — já calculado por `computeLocalReaderExecutionMetrics` (v1), apenas não estava sendo lido |
| `providedRelevantTraceableComplementaryEvidence` | `tool === "paddleocr" && algumas regiões recuperadas (grosseiro)` | `Object.values(regionTextByPageV2).some(m => m.expectedRegionsWithExactTextualMatch > 0)` — usa a métrica corrigida do Problema A (correspondência textual exata, não sobreposição espacial grosseira), e deixa de fazer referência ao nome da ferramenta por string — qualquer ferramenta que produza evidência real qualifica |

Nenhuma mudança na tabela de decisão `classifyLocalReaderViability` em si. O Momento 3C.2 deverá confirmar, como checagem de regressão obrigatória, que recalcular `viabilityInputs` com a derivação real acima, para os dados já congelados desta Sprint, produz **exatamente o mesmo veredito** (`nao_viavel_nesta_configuracao` para as duas ferramentas) — uma mudança de veredito nos dados já avaliados seria motivo para parar e investigar antes de prosseguir, não para aceitar silenciosamente.

## 8. Verdade de referência — cobertura adicional (sem alterar conteúdo)

Novo arquivo de teste (não uma edição do arquivo congelado): `reference-truth/discovery-reference-truth-cell-integrity.test.ts`.

- Teste real: `ALL_CELLS.length === 1019`.
- Teste real: para toda célula com `physicalRegionIds.length > 0`, cada id referenciado existe em `ALL_REGIONS` da mesma página.
- Diagnóstico executado nesta etapa (não apenas planejado): das 1.019 células, **0** preenchem `physicalRegionIds` — todas as 1.019 usam exclusivamente o campo textual `physicalOriginPt` como proveniência. **Correção de um número relatado incorretamente na revisão técnica anterior desta Sprint** ("98 células" — originado de um `grep` que na verdade capturava `physicalRegionIds` de `ReferenceTruthLogicalRow`, campo de linha lógica, não de célula; confirmado agora por execução real contra `REFERENCE_TRUTH_BUNDLES`). O teste do item 11 (§8) é, portanto, hoje vacuamente verdadeiro (nenhuma célula tem `physicalRegionIds` para validar) — mantido mesmo assim, porque passa a falhar de verdade no dia em que alguma célula futura vier a preencher esse campo com um id inválido. A Sprint declara explicitamente que as 1.019 células não serão retroativamente alteradas para preencher esse campo nesta etapa.

## 9. Casos sintéticos pré-registrados (itens exigidos 1–9)

Todos como constantes exportadas de `v2/discovery-local-reader-metric-correction-v2.test.ts`, nunca calculadas chamando as funções v2 (que são stubs nesta etapa). Cada fixture inclui o input construído à mão e o output esperado que a implementação real do Momento 3C.2 deverá reproduzir byte a byte.

1. **Componente N:1 com sobreposição e texto vazio** — 3 regiões esperadas sobrepostas espacialmente por 1 região observada com `literalText: ""`. Esperado: `multiple_expected_regions_merged`; Problema A: as 3 esperadas → `expectedRegionsCoveredSpatiallyOnly`, nenhuma → `expectedRegionsWithExactTextualMatch`.
2. **Componente N:1 com texto divergente** — mesma forma, mas região observada com texto não vazio e diferente de todas as 3 esperadas. Mesmo resultado do caso 1 (nenhuma correspondência textual real).
3. **Componente N:1 com pelo menos uma correspondência textual verdadeira** — 3 regiões esperadas, 1 observada cujo texto normalizado é idêntico a exatamente uma das 3 esperadas. Esperado: `multiple_expected_regions_merged`; Problema A: 1 → `expectedRegionsWithExactTextualMatch`, 2 → `expectedRegionsCoveredSpatiallyOnly`.
4. **Multilinha que muda de omitida para completa** — 2 células esperadas de descrição, ambas com comparação `direct_match` e texto idêntico na ordem certa. Esperado: `deriveObservedDescriptionLinesV2` retorna as 2 linhas na ordem certa; `classifyLocalReaderMultilineDescription` (v1, reaproveitada) classifica `fully_preserved` — contraste explícito com o hardcoded `[]` → `omitted` de hoje.
5. **Descrição parcial** — 2 células esperadas, apenas 1 com `direct_match`, a outra `expected_cell_omitted`. Esperado: `partially_preserved`.
6. **Evidência matemática completa** — relação com `quantity`/`unitPrice`/`total` todos com célula em `direct_match`. Esperado: `evidencia_completa`.
7. **Evidência matemática parcial** — `quantity` em `direct_match`, `unitPrice` em `expected_cell_omitted`. Esperado: `evidencia_parcial`.
8. **Evidência matemática divergente** — `total` em `correct_coordinate_wrong_text`. Esperado: `evidencia_divergente_da_fonte`.
9. **Viabilidade mudando quando insumos reais mudam** — dois conjuntos de `LocalReaderViabilityGateInputs` idênticos exceto por `impedingInstability` (`false` vs. `true`, este último simulando `execution.warnings.length > 0`); usando `classifyLocalReaderViability` (v1, inalterada) diretamente — demonstra que a única coisa que muda é a **entrada**, nunca a tabela de decisão. Este teste **executa** código real (v1, já congelado e aprovado), não uma implementação v2 — permitido porque não é "nova implementação".

Itens 10 e 11 — ver seção 8 (arquivo próprio, testes reais sobre `REFERENCE_TRUTH_BUNDLES`).

## 10. Diretório de resultados corrigidos (declaração, não criação)

`results/corrected-v2/` será criado apenas no Momento 3C.2, quando resultados corrigidos genuínos existirem para escrever nele. Nenhum diretório vazio é criado nesta etapa (Git não versiona diretórios vazios; criar um placeholder agora seria um artefato sem função).

## 11. Confirmações desta etapa

- As 12 saídas brutas originais (`private/local-reader-acquisition/{docling,paddleocr}/*.raw.json`) foram verificadas presentes e com SHA-256 idêntico ao `raw-acquisition-manifest.json` já versionado — nenhuma foi lida por nenhum código novo desta etapa, apenas por um script de verificação ad hoc de auditoria, fora do repositório de testes.
- Nenhum leitor (Docling/PaddleOCR) foi executado.
- Nenhum arquivo de produção, registro de maturidade ou um dos cinco arquivos sensíveis foi tocado.
- Concretisa: não referenciada, não tocada.
- Os 2 arquivos protegidos (`supabase/.temp/cli-latest`, `supabase/tests/data-integrity-validation.sql`) permanecem fora do stage.
