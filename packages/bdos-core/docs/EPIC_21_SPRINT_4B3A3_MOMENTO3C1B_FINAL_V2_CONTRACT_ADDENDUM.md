# Epic 21 — Sprint 21.4B.3A.3 — Momento 3C.1B — Fechamento final do contrato v2

**Status: adendo curto de fechamento, ANTES de qualquer implementação v2.** Elimina três decisões deixadas em aberto pelo Momento 3C.1A e corrige uma formulação excessivamente prescritiva sobre a geometria futura de célula. Nenhuma função v2 foi implementada, nenhum resultado foi recalculado, nenhuma saída bruta foi processada, nenhum leitor foi executado.

## 0. Relação com os Momentos 3C.1 e 3C.1A

O Momento 3C.1A (commit `31a43a60aaf36cbaf0bfdcc25e1c2e3ea2a53eb9`) foi aprovado quanto ao modelo de 4 estados, à separação v1/v2, às 7 fixtures, ao registro do bloqueio futuro de avaliação espacial e à correção documental de 921→1.019 células. Este adendo (Momento 3C.1B) corrige uma imprecisão remanescente no próprio §2 do adendo 3C.1A (a aplicabilidade de um campo estava definida pela existência de uma célula esperada correspondente, não pelos campos da própria relação — ver §1 abaixo) e fecha três lacunas de contrato antes de qualquer autorização do Momento 3C.2.

## 1. Aplicabilidade dos campos matemáticos — correção vinculante

**Correção ao §2 do Momento 3C.1A:** aquele texto definia aplicabilidade como "existe uma célula esperada correspondente na verdade de referência". Isso está **incorreto** — teria permitido que uma inconsistência silenciosa entre a relação e a verdade de referência (uma relação que declara um campo aplicável, mas cuja célula correspondente nunca foi registrada, ou vice-versa) passasse despercebida, tratada como `not_applicable` em vez de sinalizada como erro.

**Definição correta, vinculante a partir deste adendo:** aplicabilidade é determinada **exclusivamente** pelos próprios campos de `ReferenceTruthMathRelation` (verdade de referência, Momento 2, já congelada — apenas consultada, nunca alterada):

```ts
const quantityApplicable = relation.quantityScaled !== null;
const unitPriceApplicable = relation.displayedUnitPriceCents !== null;
const totalApplicable = relation.displayedTotalCents !== null;
const subtotalOrTotalApplicable = relation.officialSubtotalOrTotalCents !== null;
```

A existência de uma célula esperada correspondente **nunca** define aplicabilidade — ela é consultada **depois**, apenas para os três desfechos abaixo:

| Aplicável pela relação | Célula esperada existe | Desfecho |
|---|---|---|
| não | não | `not_applicable` (normal, sem erro) |
| sim | sim | prosseguir — derivar o estado a partir do resultado de comparação real (§2) |
| sim | não | **erro de integridade da verdade de referência** — `integrity_error_applicable_field_without_expected_cell` |
| não | sim | **erro de integridade da verdade de referência** — `integrity_error_not_applicable_field_has_expected_cell` |

Nenhuma das duas condições de erro é acomodada silenciosamente — `deriveMathEvidenceFieldStatesV2` (stub) deve lançar, não retornar um estado aproximado.

## 2. Mapeamento completo dos resultados de célula — congelado definitivamente

Tabela completa, para os 8 valores de `LocalReaderCellComparisonOutcome` (v1, `discovery-local-reader-evaluation.types.ts`, inalterado):

| `outcome` | Estado v2 |
|---|---|
| `direct_match` | `present` |
| `correct_coordinate_wrong_text` | `divergent` |
| `expected_cell_omitted` | `missing` |
| `correct_text_wrong_column` | `missing` |
| `correct_text_no_usable_coordinate` | `missing` |
| `expected_cell_split_into_multiple_observed` | `missing` |
| `multiple_expected_cells_merged` | `missing` |
| `invented_cell` | não aplicável a este mapeamento (ver abaixo) |

Divisão (`expected_cell_split_into_multiple_observed`) ou fusão (`multiple_expected_cells_merged`) só poderá deixar de mapear para `missing` mediante um contrato aditivo separado e futuro que prove preservação integral do valor individual dentro da divisão/fusão — esse contrato **não existe nesta Sprint**, e nenhum código desta Sprint presume sua existência.

**`invented_cell`:**
- não representa o estado de nenhum campo esperado — nunca é `present`, `missing` ou `divergent`;
- é avaliado separadamente, apenas para o insumo de viabilidade `inventedMonetaryValue` (Problema E, já congelado no §7 do pré-registro original);
- **estruturalmente, nunca poderia aparecer como componente associado a uma célula esperada de campo matemático de qualquer forma:** confirmado por leitura de `classifyComponent` (`discovery-local-reader-comparison.ts`, v1, linhas 143-153) — um resultado com `outcome === "invented_cell"` sempre tem `referenceCellIds: []` (é definido exatamente quando `expectedNodes.length === 0`), portanto nunca contém o id de nenhuma célula esperada. A exclusão de `invented_cell` desta tabela é, portanto, tanto uma regra de contrato quanto um fato já garantido pelo desenho do comparador v1 — não apenas uma convenção a mais.

**Cardinalidade obrigatória:** para todo campo aplicável (com célula esperada confirmada existente, §1), deve existir **exatamente um** resultado de comparação cujo `referenceCellIds` contenha o id dessa célula. Zero resultados, ou mais de um resultado, para a mesma célula esperada é um **erro de integridade da avaliação** — `integrity_error_ambiguous_comparison_result_for_expected_cell` — nunca acomodado silenciosamente (ex. escolhendo o primeiro resultado encontrado). Esta cardinalidade já é uma consequência estrutural do algoritmo de particionamento por componente conexo do v1 (`associateObservedCellsToReference`, cada célula esperada é visitada exatamente uma vez); o erro de integridade existe como uma checagem defensiva contra uma violação futura desse invariante, não porque se espera que ocorra hoje.

## 3. Resultado matemático auditável — contrato ampliado

`LocalReaderMathEvidenceResultV2` (tipo v2, `discovery-local-reader-evaluation-v2.types.ts`) ampliado de 3 para 5 campos:

```ts
interface LocalReaderMathEvidenceResultV2 {
  readonly mathRelationId: string;
  readonly availability: LocalReaderMathEvidenceAvailability;
  readonly fieldStates: LocalReaderMathEvidenceFieldStatesV2;
  readonly missingFieldsPt: ReadonlyArray<string>;
  readonly divergentFieldsPt: ReadonlyArray<string>;
}
```

Regras:
- `missingFieldsPt` contém exclusivamente rótulos de campos **aplicáveis** cujo estado é `missing`.
- `divergentFieldsPt` contém exclusivamente rótulos de campos **aplicáveis** cujo estado é `divergent`.
- Um campo `not_applicable` **nunca** aparece em nenhuma das duas listas, em nenhuma circunstância.
- Rótulos em português reaproveitam exatamente `MATH_EVIDENCE_FIELD_LABELS_PT` (v1, `discovery-local-reader-metrics.ts`, inalterado): `quantity` → "quantidade", `unitPrice` → "preço unitário", `total` → "total", `subtotalOrTotal` → "subtotal ou total oficial aplicável".

Cinco fixtures declarativas (item ausente, item parcial, item divergente, grupo completo, grupo ausente — reaproveitando as fixtures já congeladas no Momento 3C.1A §4) foram estendidas com os valores esperados de `missingFieldsPt`/`divergentFieldsPt`, verificados por auto-consistência contra o próprio `fieldStates` da fixture — nunca calculados chamando `classifyLocalReaderMathEvidenceV2` (stub).

## 4. Geometria futura das células — formulação corrigida

**Correção ao §5 do Momento 3C.1A:** aquele texto dizia "um novo `physicalRegionIds` genuinamente populado para as 1.019 células" — uma escolha de representação específica, decidida prematuramente. **Corrigido para:**

> Construir e pré-registrar uma representação estruturada da geometria esperada das células, derivada de evidência física independente do futuro motor.

A classificação `BLOQUEIO_FUTURO_DO_PORTAO_DE_AVALIACAO_DO_MOTOR` (Momento 3C.1A §5) é **mantida**. A Sprint preparatória que a resolve deverá avaliar explicitamente, sem que nenhuma seja escolhida aqui:

- vínculo direto com regiões físicas (`physicalRegionIds`, a extensão natural do campo já existente, mas não a única opção);
- caixa esperada explícita por célula (um novo campo de bounding box, independente de regiões físicas nomeadas);
- faixa vertical da linha lógica combinada com o intervalo horizontal já congelado da coluna (`discovery-reference-truth-columns.ts`) — uma derivação geométrica composta, sem exigir anotação célula a célula;
- uma representação composta (mais de uma das anteriores, com regra de precedência explícita);
- tratamento específico, não presumido por default, para células intencionalmente vazias (`vazio_intencional`) e para células que participam de descrição multilinha (§5 do pré-registro original, Problema C).

Nenhuma dessas alternativas é escolhida nesta Sprint. Nenhuma alteração é feita à verdade de referência.

## 5. Confirmações desta etapa

- Nenhuma função v2 foi implementada — todos os stubs continuam lançando "not implemented".
- Nenhum resultado foi recalculado.
- Nenhuma saída bruta foi processada; nenhum leitor foi executado.
- Nenhum arquivo v1 (protocolo, comparadores/métricas, adaptadores, `run-local-reader-evaluation.ts`, `results/*.json`, verdade de referência em conteúdo) foi tocado.
- Nenhum código produtivo foi tocado.
- Ajustes documentais limitados aos próprios documentos e arquivos v2 dos Momentos 3C.1/3C.1A, conforme autorizado.
- Concretisa: não referenciada, não tocada.
- Os 2 arquivos protegidos (`supabase/.temp/cli-latest`, `supabase/tests/data-integrity-validation.sql`) permanecem fora do stage.
