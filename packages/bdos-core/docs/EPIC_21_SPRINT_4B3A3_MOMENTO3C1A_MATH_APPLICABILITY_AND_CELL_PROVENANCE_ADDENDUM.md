# Epic 21 — Sprint 21.4B.3A.3 — Momento 3C.1A — Adendo: aplicabilidade de evidência matemática e limitação de proveniência de célula

**Status: adendo de pré-registro, ANTES de qualquer implementação v2.** Este documento resolve, por decisão explícita, a ambiguidade registrada como pendência no §6 de `EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`, e formaliza uma limitação estrutural de proveniência de célula identificada durante o Momento 3C.1. Nenhuma função v2 foi implementada, nenhum resultado foi recalculado, nenhuma saída bruta foi processada, nenhum leitor foi executado.

## 0. Relação com o Momento 3C.1

O Momento 3C.1 (commit `ce4c465653f02e38b05a632263bf34d6763779f7`) foi aprovado quanto a estrutura, isolamento v1/v2, preservação histórica e contratos dos Problemas A, B, C e E. Este adendo (Momento 3C.1A) resolve apenas o Problema D (evidência matemática), que havia sido registrado com uma ambiguidade explícita em vez de uma decisão — e adiciona um achado novo (proveniência de célula) descoberto ao verificar essa ambiguidade contra os dados reais. O Momento 3C.2 (implementação) continua não autorizado.

## 1. Decisão vinculante — aplicabilidade da evidência matemática

**Rejeitadas explicitamente, e não adotadas:**
- campo não aplicável sempre `true`;
- campo não aplicável sempre `false`;
- alternância artificial de booleanos apenas para induzir uma classificação de conveniência.

**Causa raiz confirmada:** `classifyLocalReaderMathEvidence` (v1, `discovery-local-reader-metrics.ts`, **permanece absolutamente inalterada**) recebe `fieldsPresent: Record<LocalReaderMathEvidenceFieldKey, boolean>` — um `Record` booleano completo de 4 chaves. Um tipo binário não consegue representar "não aplicável a esta linha" sem sobrecarregar `true` ou `false` com um segundo significado. Esta é uma limitação do **tipo v1**, não corrigível sem alterá-lo — fora do escopo desta Sprint.

**Resolução:** um novo tipo v2, de 4 estados, nunca confundindo "não aplicável" com "ausente":

```ts
type LocalReaderMathEvidenceFieldStateV2 =
  | "not_applicable"
  | "present"
  | "missing"
  | "divergent";
```

Aplicabilidade nunca é inferida pelo nome, código ou posição da linha — apenas pela presença de uma célula esperada correspondente na verdade de referência (mesma consulta `logicalRowId`/`columnId` já congelada em §6 do pré-registro original): se a verdade de referência não tem uma célula daquele papel para aquela linha, o campo é `not_applicable`; se tem, o campo nunca é `not_applicable`.

O tipo `LocalReaderMathEvidenceDerivedInputV2` (`Record<4,boolean>`, Momento 3C.1) e o stub `deriveMathEvidenceFieldsV2` que o consumia são marcados `@deprecated` — mantidos apenas como registro histórico do que foi pré-registrado e depois superado nesta mesma Sprint, nunca reutilizados pela implementação real do Momento 3C.2.

## 2. Estados dos campos — mapeamento de `LocalReaderCellComparisonOutcome`

Para cada campo **aplicável** (célula esperada correspondente existe na verdade de referência):

| `outcome` da comparação de célula | Estado v2 |
|---|---|
| `direct_match` | `present` |
| `correct_coordinate_wrong_text` | `divergent` |
| `expected_cell_omitted` | `missing` |
| `expected_cell_split_into_multiple_observed` / `multiple_expected_cells_merged` / qualquer associação que não preserve fielmente o campo individual | `missing`, salvo quando um contrato futuro específico provar preservação integral do valor individual dentro da divisão/fusão (não avaliado nem decidido nesta Sprint) |
| `correct_text_wrong_column` / `correct_text_no_usable_coordinate` / `invented_cell` | não mapeados por este adendo — ausentes da tabela do enunciado; tratamento explícito fica pendente para o Momento 3C.2, nunca presumido como `present`, `missing` ou `divergent` por default |

Para cada campo **não aplicável** (nenhuma célula esperada correspondente): `not_applicable`, sempre — nenhuma exceção, nenhum fuzzy matching, nenhuma inferência por nome/código/posição.

## 3. Classificador matemático v2 (contrato, ainda como stub)

```ts
function classifyLocalReaderMathEvidenceV2(
  mathRelationId: string,
  fieldStates: LocalReaderMathEvidenceFieldStatesV2,
): LocalReaderMathEvidenceResultV2
```

`classifyLocalReaderMathEvidence` (v1) permanece absolutamente inalterada — este é um classificador v2 paralelo, nunca uma modificação do v1.

Regras de decisão (nesta ordem):

1. Excluir todo campo `not_applicable` do denominador — nunca contado como aplicável, presente, ausente ou divergente.
2. Se **nenhum** campo for aplicável (os 4 estados são `not_applicable`): **lançar erro de integridade explícito** — uma relação matemática sem nenhum campo aplicável é um estado impossível dado o desenho da verdade de referência (toda `ReferenceTruthMathRelation` tem ao menos `quantityScaled`/`displayedUnitPriceCents`/`displayedTotalCents` não nulos, exceto relações `nao_verificavel_fora_do_recorte`, que already são tratadas fora deste classificador). Nunca retornar uma classificação nesse caso.
3. Se **qualquer** campo aplicável for `divergent`: `evidencia_divergente_da_fonte`.
4. Senão, se **todos** os campos aplicáveis forem `present`: `evidencia_completa`.
5. Senão, se **todos** os campos aplicáveis forem `missing`: `evidencia_ausente`.
6. Nos demais casos (mistura de `present`/`missing` entre os aplicáveis, sem nenhum `divergent`): `evidencia_parcial`.

`missingFieldsPt` lista exclusivamente os campos aplicáveis e `missing` — um campo `not_applicable` nunca aparece nessa lista, em nenhuma circunstância.

Stub proposital nesta etapa — lança erro "not implemented" até o Momento 3C.2 ser autorizado, exatamente como os demais stubs v2 do Momento 3C.1.

## 4. Fixtures adicionais congeladas

Sete fixtures, cada uma como estado de campo literal (não derivada de comparação de célula bruta — a derivação em si já está congelada em §2 acima e no §6 do pré-registro original, e é escopo de implementação do Momento 3C.2, não deste adendo):

1. **Item de serviço sem evidência** — `{quantity: "missing", unitPrice: "missing", total: "missing", subtotalOrTotal: "not_applicable"}` → `evidencia_ausente`.
2. **Item de serviço completo** — `{quantity: "present", unitPrice: "present", total: "present", subtotalOrTotal: "not_applicable"}` → `evidencia_completa`.
3. **Item de serviço parcial** — `{quantity: "present", unitPrice: "present", total: "missing", subtotalOrTotal: "not_applicable"}` → `evidencia_parcial`.
4. **Item de serviço divergente** — `{quantity: "present", unitPrice: "divergent", total: "present", subtotalOrTotal: "not_applicable"}` → `evidencia_divergente_da_fonte`.
5. **Grupo completo** — `{quantity: "not_applicable", unitPrice: "not_applicable", total: "not_applicable", subtotalOrTotal: "present"}` → `evidencia_completa`.
6. **Grupo ausente** — `{quantity: "not_applicable", unitPrice: "not_applicable", total: "not_applicable", subtotalOrTotal: "missing"}` → `evidencia_ausente`.
7. **Relação sem campo aplicável** — `{quantity: "not_applicable", unitPrice: "not_applicable", total: "not_applicable", subtotalOrTotal: "not_applicable"}` → erro de integridade explícito (nunca uma classificação de disponibilidade).

Estas fixtures resolvem exatamente a distorção identificada no §6 do pré-registro original: o item 1 (sem evidência) permanece `evidencia_ausente` mesmo com `subtotalOrTotal` marcado `not_applicable`, porque ele é excluído do denominador em vez de forçado a `true`/`false` — a opção (a) do pré-registro original (marcar sempre `true`) teria incorretamente produzido `evidencia_parcial` para este caso; a opção (b) (marcar sempre `false`) teria produzido o resultado correto aqui, mas tornado o item 2 (`evidencia_completa`) inatingível para qualquer linha `item_de_servico`. Nenhuma das duas reproduz corretamente os itens 1 **e** 2 simultaneamente — apenas o modelo de 4 estados o faz.

Consistente com a disciplina do Momento 3C.1: estas fixtures são congeladas como dados declarativos, nunca calculadas chamando `classifyLocalReaderMathEvidenceV2` (que é stub) — o teste de pré-registro confirma apenas que o stub lança "not implemented" hoje, e que os dados da fixture são internamente bem formados (nenhum estado inválido, `expectedResult` é um dos 5 valores possíveis).

## 5. Proveniência estruturada das células — limitação estrutural registrada

Fatos confirmados nesta etapa (execução real contra `REFERENCE_TRUTH_BUNDLES`, sem alterar nenhum dado):

- **0 das 1.019 células** da verdade de referência possuem `physicalRegionIds` não vazio — 100% delas dependem exclusivamente do campo textual `physicalOriginPt` como proveniência.
- Consequência direta em `run-local-reader-evaluation.ts`, função `cellBoundingBox(bundle, cellId)` (linhas 116-126, v1, não alterada nesta Sprint): como `cell.physicalRegionIds` é sempre `[]`, `regions` é sempre `[]`, e a função **retorna `null` para as 1.019 células esperadas, sem exceção**.
- Consequência direta em `associateObservedCellsToReference` (`discovery-local-reader-comparison.ts`, v1, não alterada): a condição de aresta espacial (`e.boundingBox !== null && o.boundingBox !== null && boxesOverlapStrictly(...)`) é **sempre falsa** para o lado esperado, porque `e.boundingBox` (proveniente de `cellBoundingBox`) é sempre `null`. Na prática, **o comparador de células desta avaliação associa exclusivamente por texto literal normalizado** — o canal espacial da comparação de células nunca esteve ativo em nenhuma das 1.019 células, em nenhuma das duas ferramentas, nesta avaliação real.
- Isto **não altera o veredito de viabilidade já obtido** (`nao_viavel_nesta_configuracao` para Docling e PaddleOCR) porque nenhuma das duas ferramentas produziu nenhuma célula com texto correspondente em posição alguma — o canal espacial, mesmo se estivesse ativo, não teria nada para comparar espacialmente contra ele.
- **Isto impede usar a avaliação atual como portão espacial definitivo de um futuro motor determinístico de reconstrução de célula.** Um motor que posicione texto contra os limites de coluna já geometricamente conhecidos (`discovery-reference-truth-columns.ts`, mencionado como próxima etapa mínima no relatório do Momento 3B) precisaria validar sua saída contra uma geometria de célula esperada real — que hoje não existe de forma estruturada na verdade de referência, apenas textualmente.

**Classificação:** `BLOQUEIO_FUTURO_DO_PORTAO_DE_AVALIACAO_DO_MOTOR`.

**Não corrigido nesta Sprint.** Os 1.019 vínculos não são retroativamente preenchidos aqui — preenchê-los exigiria trabalho de anotação geométrica real (não uma inferência automática a partir do texto), fora do escopo de uma correção de métrica.

**Registrado como próxima Sprint preparatória, antes de qualquer avaliação de motor determinístico:** construir e pré-registrar uma projeção estruturada de geometria de célula esperada, derivada de evidência física real (não do futuro motor, nunca circular) — isto é, um novo `physicalRegionIds` genuinamente populado para as 1.019 células, com o mesmo rigor de pré-registro/congelamento desta Sprint. **A implementação dessa projeção não é decidida agora** — apenas seu lugar no roteiro é registrado.

## 6. Correção documental

`discovery-reference-truth-cell-integrity.test.ts` (Momento 3C.1) tinha, em seu comentário de cabeçalho, "As 921 células com `physicalRegionIds: []`..." — número incorreto, herdado da revisão técnica que precedeu o Momento 3C.1 (que por sua vez citava "98 células" com vínculo estruturado, com base num `grep` que capturava `physicalRegionIds` de linha lógica, não de célula). Corrigido nesta etapa para "1.019 células" (100% delas), consistente com o fato já confirmado pelo próprio arquivo de teste (`diagnóstico (§8)`, que já assertava `withIds === 0` desde o Momento 3C.1 — apenas o comentário em prosa estava desatualizado). Nenhum dado da verdade de referência foi alterado.

## 7. Confirmações desta etapa

- Nenhuma função v2 foi implementada — todos os stubs (novos e existentes) continuam lançando "not implemented".
- Nenhum resultado foi recalculado.
- Nenhuma saída bruta foi lida, processada ou reexecutada nesta etapa (o fato de `physicalRegionIds` estar vazio foi confirmado contra `REFERENCE_TRUTH_BUNDLES`, dado já congelado desde o Momento 2 — nunca contra saída de Docling/PaddleOCR).
- Nenhum arquivo v1 (verdade de referência em conteúdo, protocolo, adaptadores, `run-local-reader-evaluation.ts`, `results/*.json`, relatórios) foi alterado.
- Nenhum código produtivo foi tocado.
- Concretisa: não referenciada, não tocada.
- Os 2 arquivos protegidos (`supabase/.temp/cli-latest`, `supabase/tests/data-integrity-validation.sql`) permanecem fora do stage.
