# Epic 21 — Sprint 21.4B.3A.3 — Momento 3C.2A — Notas de implementação

**Status: registro aditivo, após a implementação real das funções v2.** Este documento explica duas descobertas feitas ao implementar de verdade os contratos já congelados nos Momentos 3C.1/3C.1A/3C.1B — nenhuma delas alterou qualquer fixture ou resultado esperado já congelado; ambas são refinamentos necessários para que a implementação executasse o que o contrato já dizia. `EPIC_21_SPRINT_4B3A3_MOMENTO3C1B_FINAL_V2_CONTRACT_ADDENDUM.md` permanece byte a byte intacto — restaurado ao conteúdo exato do commit `cb6820504eb9dc4b211d301e21b13288bb23ea84` nesta mesma etapa, precisamente para que este documento aditivo seja o único lugar registrando o que a implementação real revelou.

## 1. Fusão multilinha — `deriveObservedDescriptionLinesV2`

### Comportamento da classificadora v1

`classifyLocalReaderMultilineDescription` (`discovery-local-reader-metrics.ts`, v1, nunca alterada) verifica seus quatro primeiros casos nesta ordem fixa:

```ts
if (observedLinesInOrder.length === 0) return "omitted";
if (mergedWithNeighborItemText !== null) return "merged_with_neighbor_item";
if (splitAcrossIncompatibleCells) return "split_into_incompatible_cells";
// ... fully_preserved / lines_out_of_order / partially_preserved
```

### Por que `observedLinesInOrder: []` faria `omitted` prevalecer antes de `merged_with_neighbor_item`

A checagem de `observedLinesInOrder.length === 0` é a **primeira** do corpo da função — precede a checagem de `mergedWithNeighborItemText`. Isso significa que qualquer chamada que passe `observedLinesInOrder: []` (array vazio) recebe sempre `"omitted"`, **mesmo que `mergedWithNeighborItemText` esteja corretamente preenchido** com o texto fundido. O desfecho `"merged_with_neighbor_item"` fica estruturalmente inalcançável para qualquer implementação de `deriveObservedDescriptionLinesV2` que trate "célula fundida com vizinha" como um caso que nunca contribui uma linha própria.

### Qual entrada mínima é derivada da comparação real para representar que houve conteúdo observado

Quando `deriveObservedDescriptionLinesV2` encontra um resultado de comparação `outcome === "multiple_expected_cells_merged"` cujo grupo de células de referência inclui ao menos uma célula de descrição de uma linha `item_de_servico` **vizinha** (imediatamente anterior ou posterior, na ordenação por id, dentro da mesma página) — a mesma checagem já descrita no Momento 3C.1 §5 — a função agora também empurra `result.normalizedObservedText` (o texto já fundido, produzido pela comparação de células real, v1) para `observedLinesInOrder`, além de preencher `mergedWithNeighborItemText`. O texto **não é inventado**: é o mesmo `normalizedObservedText` que `associateObservedCellsToReference` (v1, não alterada) já calculou para aquele componente fundido — a mesma string que qualquer outro consumidor do resultado de comparação veria.

Fusões puramente internas à própria linha (nenhuma célula do grupo pertence a uma linha vizinha) continuam **sem** contribuir uma linha — apenas fusões que efetivamente cruzam para uma linha vizinha precisam desse tratamento, porque só esse caso tem um desfecho dedicado (`merged_with_neighbor_item`) que dependeria de `observedLinesInOrder` não estar vazio para ser alcançado.

### Qual fixture pré-registrada comprova o comportamento

`discovery-local-reader-metric-correction-v2.test.ts`, teste `"§B — merged_with_neighbor_item (célula de descrição fundida com a de uma linha item_de_servico vizinha)"`: constrói duas linhas `item_de_servico` sintéticas (`row-ml-merge-target`, `row-ml-merge-neighbor`), cada uma com uma célula de descrição própria, sobrepostas pela mesma caixa e fundidas em uma única célula observada via `associateObservedCellsToReference` (v1, real — não simulado). O teste primeiro confirma, como pré-condição, que o comparador v1 realmente produz `outcome === "multiple_expected_cells_merged"` para esse cenário; depois confirma que `deriveObservedDescriptionLinesV2` preenche `mergedWithNeighborItemText` com o texto fundido real e que `observedLinesInOrder.length > 0`; por fim confirma que `classifyLocalReaderMultilineDescription` (v1) retorna `"merged_with_neighbor_item"` — não `"omitted"`.

### Que nenhum resultado esperado foi modificado

Nenhuma das fixtures do Momento 3C.1 (`RegionMergeFixtureV2` ×3, itens 1–9) foi alterada. O ajuste descrito aqui afeta apenas a implementação de `deriveObservedDescriptionLinesV2`, um stub que lançava erro no Momento 3C.1 e nunca tinha, portanto, nenhum resultado esperado previamente observado ou congelado para este caso específico — o comportamento correto (empurrar a linha fundida quando há vizinho) é uma consequência necessária, não presumida, de tornar `"merged_with_neighbor_item"` alcançável, e é a única forma de a implementação satisfazer literalmente o próprio nome do desfecho que o contrato já definia.

## 2. Coluna compartilhada entre `total` e `subtotalOrTotal`

### Ambos podem usar `col-total-cbdi`

Confirmado desde o pré-registro original (Momento 3C.1 §6, tabela de mapeamento campo→coluna): `total` (papel `preco_total_com_bdi`) e `subtotalOrTotal` mapeiam para a mesma coluna, `col-total-cbdi`. Isso nunca foi alterado nesta implementação.

### Aplicabilidade continua sendo determinada pela `ReferenceTruthMathRelation`

Inalterado desde o Momento 3C.1B §1: `quantityApplicable`/`unitPriceApplicable`/`totalApplicable`/`subtotalOrTotalApplicable` são determinados exclusivamente por `relation.quantityScaled`/`displayedUnitPriceCents`/`displayedTotalCents`/`officialSubtotalOrTotalCents` `!== null` — nunca pela existência de célula. Este documento não altera essa regra.

### A mesma célula esperada pode servir ao único campo aplicável correspondente naquela relação

Como cada `ReferenceTruthMathRelation` real representa exatamente um tipo de linha (uma linha `item_de_servico` tem `displayedTotalCents` preenchido e `officialSubtotalOrTotalCents` nulo; uma linha `grupo`/`subgrupo`/`subtotal`/`total` tem o inverso — nunca ambos preenchidos na mesma relação, consequência estrutural de nenhuma relação representar mais de um tipo de linha, já observada no Momento 3C.1B), no máximo um dos dois campos é aplicável por relação. A célula física em `col-total-cbdi` para aquela linha serve, portanto, sempre exatamente ao único campo aplicável — nunca aos dois simultaneamente.

### A presença física da célula compartilhada não torna automaticamente o outro campo aplicável

Esta é a descoberta real feita durante a implementação (já registrada em `EPIC_21_SPRINT_4B3A3_MOMENTO3C1B_FINAL_V2_CONTRACT_ADDENDUM.md` §2, nota "Correção descoberta durante a implementação real"): antes da correção, `deriveMathEvidenceFieldStatesV2` verificava "existe célula para (coluna, linha)" **independentemente** de qual campo estava sendo avaliado — então, ao avaliar `subtotalOrTotal` (não aplicável, pois `officialSubtotalOrTotalCents` é `null` numa linha `item_de_servico`), a mesma célula que `total` (aplicável) legitimamente reivindica em `col-total-cbdi` também "aparecia" para `subtotalOrTotal`, dando um falso `integrity_error_not_applicable_field_has_expected_cell`.

A implementação corrigida computa, antes de avaliar qualquer campo, o conjunto de ids de célula já legitimamente reivindicados por um campo **aplicável** (`cellIdsClaimedByApplicableFields`). Ao avaliar um campo não aplicável cuja consulta de coluna encontra uma célula, a implementação verifica primeiro se essa célula já pertence a esse conjunto — se sim, o campo é corretamente `not_applicable` (sem erro); apenas quando a célula encontrada **não** pertence a nenhum campo aplicável é que o erro de integridade é lançado.

### Nenhuma célula é duplicada; nenhuma comparação é escolhida arbitrariamente

O conjunto `cellIdsClaimedByApplicableFields` é usado exclusivamente para **suprimir um falso positivo** na checagem de integridade do campo não aplicável — nunca para atribuir a célula, seu resultado de comparação, ou seu estado (`present`/`missing`/`divergent`) ao campo não aplicável. O campo não aplicável recebe sempre `"not_applicable"`, nunca o estado derivado da célula compartilhada. A célula em si é consultada e sua comparação resolvida **apenas uma vez**, pelo campo que a reivindica legitimamente (o campo aplicável) — o campo não aplicável nunca lê `cellComparisons` para essa célula.

### As invariantes de cardinalidade continuam válidas

"Exatamente um resultado de comparação por célula aplicável" (Momento 3C.1B §2) permanece verificado exatamente como antes, para o único campo que de fato consulta a célula (o aplicável). O campo não aplicável, ao reconhecer a célula como já reivindicada, nunca executa a checagem de cardinalidade sobre ela — não há necessidade, já que ele não deriva nenhum estado a partir dela.

### Confirmação

Nenhuma fixture ou resultado esperado congelado nos Momentos 3C.1/3C.1A/3C.1B foi alterado por esta correção. As 7 fixtures de evidência matemática do Momento 3C.1A §4 (agora testadas de verdade em `discovery-local-reader-metric-correction-v2.test.ts`, §C.3) continuam produzindo exatamente os resultados ali congelados — incluindo o item 2 ("item de serviço completo"), cuja relação tem `total` aplicável e `subtotalOrTotal` inaplicável simultaneamente com uma célula real em `col-total-cbdi`, exatamente o cenário que expôs esta descoberta.
