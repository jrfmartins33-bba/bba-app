# Epic 21 — Contrato da Geometria Esperada Estruturada das Células

Status: schemaVersion 2 (proveniência corrigida pela verificação probatória final da PR #82 — ver `EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md`). Dados reais (páginas 46/50/54) publicados — ver `EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md` para o resultado concreto e a proveniência.

## 1. Objetivo

A verdade de referência (`discovery-reference-truth.ts` e suas 1.019 células, congelada na Sprint 21.4B.3A.3) declara, para cada célula, um campo de proveniência em texto livre `physicalOriginPt` (ex.: `"Segmento(s): <hash>"`), mas nenhuma caixa delimitadora. `ReferenceTruthCell.physicalRegionIds` é `[]` nas 1.019 células e **nunca** é preenchido retroativamente por esta Sprint.

Este contrato adiciona uma **camada exclusivamente diagnóstica e aditiva**, indexada por `cellId`, que projeta uma *geometria* esperada determinística e auditável (caixas delimitadoras) para cada célula, derivada exclusivamente de:

- a verdade de referência já congelada (células, linhas lógicas, regiões físicas, colunas); e
- um registro de **segmentos** de texto físicos reconstruído de forma independente, produzido pelo reconstrutor estrutural já aprovado do próprio domínio (`observeDocumentSignals` → `locateBudgetDocumentPages` → `reconstructBudgetDocumentStructure`), executado contra o PDF-fonte exato.

Existe para dar a um futuro avaliador de motor determinístico uma verdade espacial real. **Não constrói esse motor.**

## 2. Localização e isolamento

```
packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/reference-truth/cell-geometry/
```

Inteiramente sob `testing/` (diagnóstico, seguindo a partição produção/diagnóstico já existente no domínio — ver `budget-document-location-boundaries.test.ts`). Nunca exportada por nenhum barril público. Nunca importada por código de produção. Isolamento reforçado por `packages/bdos-core/src/architecture/expected-cell-geometry-boundaries.test.ts`, que também proíbe:

- importar saída de PaddleOCR/Docling/avaliação de leitor local, `results/corrected-v2`, ou qualquer resultado v1/v2;
- importar um futuro motor determinístico;
- literal de página real (46/50/54), hash real de documento, ou vocabulário de documento real em qualquer lugar **fora** dos arquivos de dados reais (`*-page-46.ts`, `*-page-50.ts`, `*-page-54.ts`, `*-physical-segments-page-*.ts`, `*-manifest.ts`);
- o campo `sourceSegmentKey` (nome antigo, retirado — implicava identidade física reproduzível; ver §4);
- que `sharedGeometryGroupId` seja derivada da chave histórica declarada em vez do localizador estrutural reproduzível.

## 3. Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `discovery-reference-truth-cell-geometry.types.ts` | Contrato: `ReferenceTruthCellGeometry`, `ReferenceTruthCellGeometryFragment`, `ReproduciblePhysicalSegmentLocator`, `LegacyDeclaredKeyStatus`, `SegmentGeometryAssociationBasis`, primitivas de caixa/faixa, entrada da projeção, códigos de erro de integridade. |
| `discovery-reference-truth-cell-geometry-origin-parser.ts` | Parser estrito de `physicalOriginPt` — aceita apenas `"Segmento(s): <64-hex>[, <64-hex>]*"`, preserva a ordem declarada, nunca repara nem infere. |
| `discovery-reference-truth-cell-geometry-geometry-helpers.ts` | Utilitários puros de caixa, reaproveitando as convenções já estabelecidas no domínio (união via min/max, interseção horizontal via `max(0, min(rights)-max(lefts))`). |
| `discovery-reference-truth-cell-geometry-reproducible-locator.ts` | Construtor puro e determinístico do localizador estrutural reproduzível — a identidade canônica de um segmento a partir do schemaVersion 2 (ver §4). |
| `discovery-reference-truth-cell-geometry-canonical-spatial-projection.ts` | Projeção canônica exclusivamente espacial (nunca de proveniência) — usada para provar que uma correção de identidade nunca altera nenhuma coordenada já publicada (ver §6 do enunciado da verificação probatória final da PR #82). |
| `discovery-reference-truth-cell-geometry-projection.ts` | O algoritmo genérico — resolve faixa da linha, faixa da coluna, segmento(s), fragmentos, agrupamento de geometria compartilhada, projeção de espaço vazio. |
| `discovery-reference-truth-cell-geometry-validation.ts` | Verificador de invariantes pós-hoc e independente (validade de caixa, contenção na página, interseção coluna/linha, corretude do envelope, simetria de grupo compartilhado, presença/validade do localizador reproduzível). |
| `discovery-reference-truth-cell-geometry-evaluator-projection.ts` | `projectReferenceTruthCellsWithGeometry` — a porta diagnóstica que um futuro avaliador de motor consumirá. |
| `discovery-reference-truth-cell-geometry-svg.ts` | Renderizador SVG determinístico (apenas validação visual em tempo de desenvolvimento, nunca entrada do sistema). |
| `discovery-reference-truth-cell-geometry.ts` | Barril + `buildReferenceTruthCellGeometry` (projeção + validação numa só chamada). |
| `discovery-reference-truth-cell-geometry.test.ts` | Testes sintéticos para cada cenário exigido. |
| `discovery-reference-truth-cell-geometry-physical-segments-page-{46,50,54}.ts` | Registro congelado de caixas de segmento físico resolvidas (`legacyDeclaredSegmentKey` → caixa + `reproducibleLocator`), restrito aos segmentos efetivamente referenciados pelo `physicalOriginPt` das 1.019 células. |
| `discovery-reference-truth-cell-geometry-page-{46,50,54}.ts` | Saída congelada `ReferenceTruthCellGeometry[]` daquela página. |
| `discovery-reference-truth-cell-geometry-manifest.ts` | Manifesto determinístico (esquema/hashes/contagens/`historicalReplayVerification`). |
| `discovery-reference-truth-cell-geometry-real-data.test.ts` | Testes de integridade sobre a saída real das 1.019 células. |

## 4. Modelo de identidade: chave histórica vs. localizador reproduzível

Uma verificação probatória (replay direto da cadeia física exatamente no commit `ccd8f8f1627e4f628f8787c36a2b27517a42e29b`, em que a verdade de referência foi congelada, com lockfile congelado, contra o documento exato) mostrou que a `lineKey`/`segmentKey` já declarada em `physicalOriginPt`/`ReferenceTruthPhysicalRegion.segmentKeys` **não é reproduzível** por nenhuma execução conhecida da cadeia física (0/186 regiões resolvidas diretamente por `lineKey`) — ver `EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md` para o registro completo.

Consequência (schemaVersion 2):

- **`legacyDeclaredSegmentKey`** (antes chamado `sourceSegmentKey`): o ponteiro histórico interno declarado em `physicalOriginPt` — preservado exatamente como está, nunca reescrito, mas tratado exclusivamente como identificador histórico interno congelado. Sempre emparelhado com **`legacyDeclaredSegmentKeyStatus`**, cujo único valor possível é `"legacy_unreproducible"`.
- **`ReproduciblePhysicalSegmentLocator`**: a identidade canônica de cada segmento a partir deste esquema. Construída deterministicamente a partir de fatos estruturais já congelados (`frozenPhysicalRegionId`, `regionVerticalOrder`, `segmentHorizontalOrder`, `regionBoundingBox`, `segmentBoundingBox`) mais identidade verificada do reconstrutor físico (`physicalAdapterVersionSha256`, `physicalUnderlyingLibraryVersionSha256`, `reconstructionContextFingerprint`, `physicalGeometryContextFingerprint`, `sourceDocumentSha256`). `reproducibleLineKey`/`reproducibleSegmentKey` são hashes calculados exclusivamente a partir desses campos — nunca da chave histórica.
- **`SegmentGeometryAssociationBasis`**: registra formalmente a base da associação entre uma célula e a geometria de um segmento — sempre `"exact_structural_position_with_region_geometry_validation"`: mesma página + mesma posição vertical da região física congelada + caixa da região exatamente igual (pareamento estrutural contra uma reconstrução física fresca) + mesma quantidade de segmentos + mesma ordem horizontal do segmento + duas execuções físicas independentes e idênticas + zero ambiguidade estrutural. Nunca resolução direta por chave, nunca fuzzy matching, nunca aproximação.

A caixa delimitadora de cada fragmento nunca mudou por causa desta correção — apenas a forma como sua proveniência é declarada. Ver §6 (garantia de independência) e o hash canônico espacial no relatório.

## 5. Modelo de dados

`ReferenceTruthCellGeometry` (uma por célula, indexada por `cellId`):

- `resolutionKind`: `single_source_fragment` \| `multiple_source_fragments` \| `shared_source_geometry` \| `empty_slot_projection`.
- `spatialSemantics`: `exclusive` \| `shared` \| `multi_fragment` \| `empty_slot`.
- `fragments`: um `ReferenceTruthCellGeometryFragment` por segmento físico resolvido (ordem preservada a partir de `physicalOriginPt`), cada um com `legacyDeclaredSegmentKey`/`legacyDeclaredSegmentKeyStatus`/`reproducibleLocator`/`associationBasis` (proveniência) e `sourceBoundingBox`/`projectedBoundingBox` (geometria).
- `expectedEnvelope`: união exata de todos os fragmentos próprios da célula.
- `rowBand`: caixa união das `physicalRegionIds` da linha lógica — evidência/validação independente, nunca a origem da coordenada vertical de uma célula com segmento próprio.
- `columnBand`: o intervalo horizontal congelado da coluna, verbatim.
- `sharedGeometryGroupId` / `sharedWithCellIds`: preenchidos, simetricamente, sempre que duas ou mais células resolvem para o mesmo `(page, reproducibleSegmentKey)`.
- `provenance`: trilha de auditoria completa até `physicalOriginPt`, as regiões físicas da linha, e uma nota legível.

## 6. Regra de projeção do fragmento

```
fragment.projectedBoundingBox =
  segment.verticalRange × (segment ∩ column).horizontalRange     — quando a interseção tem largura positiva
  segment.boundingBox (intocada)                                 — quando o segmento é legitimamente compartilhado
                                                                    E a coluna não permite uma subdivisão física
                                                                    real (interseção de largura zero/negativa)
  rowBand.verticalRange × columnBand                              — apenas para uma célula genuinamente vazia
                                                                    (row_column_empty_slot)
```

Uma célula não compartilhada cujo segmento não tem interseção de largura positiva com sua própria coluna **nunca** é silenciosamente aproximada — é uma falha de resolução (`fragment_no_column_intersection`), relatada e excluída da saída.

## 7. Geometria compartilhada

Quando N ≥ 2 células resolvem para o mesmo `(realPageNumber, reproducibleSegmentKey)`, todas as N recebem `spatialSemantics: "shared"`, o mesmo `sharedGeometryGroupId` (`shared-geometry:<page>:<reproducibleSegmentKey>`), e os ids umas das outras em `sharedWithCellIds` (sempre simétrico — reforçado pelo validador). Isto nunca é tratado como erro: a fonte física genuinamente oferece uma única área para mais de uma célula lógica, e o futuro avaliador nunca deve exigir exclusividade espacial dentro de tal grupo.

## 8. Células vazias

Uma célula é vazia **apenas** quando `literalText.trim().length === 0`. Somente então `resolutionKind` pode ser `empty_slot_projection`. Uma célula não vazia com origem irresolúvel é sempre um erro de integridade, nunca reinterpretada silenciosamente como vazia. Uma célula vazia cujo `physicalOriginPt` ainda assim analisa como uma declaração de segmento válida é, ela própria, um erro de integridade (`empty_cell_declares_origin`) — dado contraditório é exposto, nunca adivinhado.

## 9. Validação

Duas camadas independentes:

1. **Em tempo de projeção** (`discovery-reference-truth-cell-geometry-projection.ts`): uma célula que não pode ser resolvida (coluna/linha/região ausente, origem malformada ou irresolúvel, chave de segmento ambígua, segmento de página errada, ausência de interseção de coluna sem justificativa de compartilhamento) nunca produz um registro de geometria — produz, em vez disso, um `ReferenceTruthCellGeometryIntegrityIssue` estruturado.
2. **Pós-hoc** (`discovery-reference-truth-cell-geometry-validation.ts`): reverifica, de forma independente, toda geometria já produzida quanto a ordenação/finitude de caixa, contenção na página, interseção coluna/linha, envelope-igual-à-união-dos-fragmentos, simetria de grupo compartilhado, e presença/validade do `reproducibleLocator` (página, ordens, caixas e fingerprints) em todo fragmento não vazio.

Nenhuma tolerância decimal arbitrária em lugar nenhum — toda comparação é igualdade exata ou um teste de interseção de largura/altura estritamente positiva.

## 10. Garantia de independência

O registro de segmentos físicos nunca é derivado de Docling, PaddleOCR, qualquer resultado de avaliação de leitor local, qualquer comparação v1/v2, um LLM, fuzzy matching, ou o futuro motor determinístico. É produzido reexecutando o reconstrutor estrutural determinístico já aprovado do próprio domínio contra o PDF-fonte exato (verificado por SHA-256), executado duas vezes, com saída byte-idêntica exigida antes da publicação. A correção de proveniência descrita em §4 não usa nenhuma dessas fontes proibidas — usa exclusivamente posição estrutural já congelada e identidade do reconstrutor já verificada. Ver `EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md` e `EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md` para a execução concreta.
