# Epic 21 — Sprint 21.4A.2.f.1 — Reconstrução Estrutural Auditável dos Grupos Candidatos

**Status: concluída.** Reconstrói, de forma pura e determinística, como os itens textuais geometricamente posicionados das páginas candidatas (Sprint 21.4A.2.e) se organizam fisicamente em linhas, segmentos e blocos — usando a geometria normalizada por item (Sprint 21.4A.2.f.0). Não interpreta significado econômico, não identifica coluna, célula, código, unidade, quantidade, preço, total ou BDI. Não altera o leitor físico, o observador de sinais nem o localizador. Próximo incremento: continuidade estrutural entre páginas e reconhecimento de tabela (fora do escopo desta Sprint).

## 1. Objetivo

Responder apenas: "como os itens textuais das páginas candidatas se organizam fisicamente em linhas, segmentos e blocos?" — nunca "quais são as linhas orçamentárias, colunas econômicas, valores, quantidades, unidades ou itens de serviço?". Consome exclusivamente `PhysicalDocumentReadResult` (schema v2) e `BudgetDocumentPageLocationResult` (schema v1), ambos já produzidos por Sprints anteriores — nunca bytes, PDF, ou objetos de biblioteca.

## 2. Base e cadeia

Base: `ada5ffdcfac7927cd7646b35cd2d54730b78f218` (merge do PR #68, encerramento da Sprint 21.4A.2.f.0). Cadeia consolidada: leitura física (21.4A.2.c) → geometria normalizada por item (21.4A.2.f.0) → observação de sinais (21.4A.2.d) → localização e grupos candidatos (21.4A.2.e) → **reconstrução estrutural física (esta Sprint)**.

## 3. Fronteiras

`observação física ≠ estrutura física reconstruída ≠ estrutura tabular interpretada ≠ estrutura econômica`. Uma faixa física de linha não é uma linha orçamentária. Um segmento horizontal não é uma coluna econômica. Um bloco físico não é uma tabela confirmada. Nenhum número textual é quantidade, preço ou total; nenhum texto é código, descrição, unidade ou item de serviço.

## 4. Entrada

```ts
interface BudgetDocumentStructureReconstructionInput {
  readonly physicalRead: PhysicalDocumentReadResult;
  readonly pageLocation: BudgetDocumentPageLocationResult;
}
```

O reconstrutor nunca redefine ou copia `PhysicalDocumentReadResult`, `PhysicalDocumentPage`, `PhysicalDocumentTextItem` ou `BudgetDocumentPageLocationResult` — recebe os resultados já produzidos, por referência.

## 5. Compatibilidade exata

`SUPPORTED_STRUCTURE_RECONSTRUCTION_SOURCE_CONTRACTS` (`structure-reconstruction-source-contracts.ts`, não exportado pelo barrel) declara, por igualdade exata (nunca comparação lexical, nunca aceitação de versão desconhecida):

**Leitura física**: `schemaVersion=2`, `readerName="physical-document-reader"`, `readerVersion="physical-document-reader-v2"`, `coordinateSpaceVersion="physical-document-text-item-coordinate-space-v1"`, `geometryProfileVersion="physical-document-text-item-geometry-profile-v1"`, `geometryContextFingerprintVersion="physical-document-geometry-context-fingerprint-v1"`.

**Localização**: `schemaVersion=1`, `locatorName="budget-document-page-locator"`, `locatorVersion="budget-document-page-locator-v1"`, `decisionRuleSetVersion="budget-document-page-location-rules-v1"`, `observerVersion="document-signal-observer-v1"`, `observationRuleSetVersion="document-signal-observation-rules-v1"`, `catalogVersion="budget-document-signal-catalog-v1"`.

`adapterVersion`/`underlyingLibraryVersion` do leitor físico não entram no portão exato (são strings livres do adaptador concreto, já cobertas indiretamente pelo fingerprint geométrico).

## 6. Linhagem

`structure-reconstruction-input-validation.ts` valida, sem nunca corrigir, renumerar ou refazer a entrada: `physicalRead.sourceByteHash === pageLocation.sourceByteHash`; `physicalRead.totalPageCount === pageLocation.totalPageCount`; `pageLocation.sourceReadMetadata` não nulo e idêntico (`readerName`/`readerVersion`/`adapterVersion`/`underlyingLibraryVersion`/`status`) ao `physicalRead` recebido diretamente; páginas físicas densas e únicas de 1 a N; índices de item densos e únicos por página; cada grupo candidato contíguo, com `members` alinhado a `pageNumbers`, sem página repetida entre grupos, com candidata de fechamento apenas na última posição do grupo, e toda página de grupo classificada como `"candidate"` em `pageLocation.pageDecisions`. `pageLocation.status === "failed"` é tratado como entrada inválida (nada a reconstruir de forma confiável), nunca traduzido silenciosamente em "zero grupos, concluído".

## 7. Fingerprint geométrico físico

Antes de reconstruir, o `geometryContextFingerprint` do `PhysicalDocumentReadResult` recebido é recalculado via `computeGeometryContextFingerprint` (importado por caminho relativo direto, nunca pelo barrel) e comparado byte a byte com o valor recebido. Divergência produz `geometry_context_fingerprint_invalid` e resultado global `failed`, sem iniciar qualquer reconstrução.

## 8. Perfil de reconstrução versionado

`BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1` (`profileId="budget-document-structure-reconstruction-profile-v1"`, `profileVersion=1`), não exportado pelo barrel — apenas seus valores (`profileId`/`profileVersion`) viajam nos contratos de saída. Nenhum valor foi calibrado por documento real; todos são constantes de engenharia geométrica genéricas, testadas nos seus limiares exatos, e passíveis de revisão em Sprint futura com corpus real:

| Propriedade | Valor | Unidade | Finalidade | Limite | Teste |
| --- | ---: | --- | --- | --- | --- |
| `minimumPairVerticalOverlapRatio` | 0.5 | adimensional | compatibilidade de linha (sobreposição vertical mínima) | `>=` | `physical-line-reconstruction.test.ts` |
| `maximumPairCenterDistanceToMinimumHeightRatio` | 0.5 | adimensional | compatibilidade de linha (distância de centros normalizada) | `<=` | `physical-line-reconstruction.test.ts` |
| `maximumSegmentGapToMedianItemHeightRatio` | 2.0 | adimensional | separação de segmento (lacuna normalizada pela mediana) | `<=` mantém no mesmo segmento | `horizontal-segment-reconstruction.test.ts` |
| `maximumBlockVerticalGapToMedianLineHeightRatio` | 1.5 | adimensional | candidatura de bloco (lacuna vertical normalizada pelas linhas) | `<=` | `physical-text-block-reconstruction.test.ts` |
| `minimumBlockHorizontalOverlapRatio` | 0.3 | adimensional | candidatura de bloco (sobreposição horizontal mínima) | `>=` | `physical-text-block-reconstruction.test.ts` |
| `maximumBlockHorizontalGapToMedianSegmentHeightRatio` | 3.0 | adimensional | candidatura de bloco (lacuna horizontal normalizada pelos segmentos) | `<=` | `physical-text-block-reconstruction.test.ts` |
| `requireCompleteLineCompatibility` | `true` | booleano fixo | documenta o antiencadeamento como invariante do contrato | — | `structure-reconstruction-profile.test.ts` |
| `requireMutualBlockAdjacency` | `true` | booleano fixo | documenta a adjacência mútua como invariante do contrato | — | `structure-reconstruction-profile.test.ts` |

Nenhuma constante oculta, nenhum score, nenhuma confiança, nenhuma probabilidade, nenhuma aprendizagem estatística.

## 9. Elegibilidade dos itens

`source-item-reconstruction-outcomes.ts` classifica cada item textual admitido, nesta ordem: (1) estados `unresolved_*` de origem mapeados 1:1 (`unresolved_missing_geometry → unresolved_source_geometry_missing`, e assim por diante para `invalid_geometry`, `unsupported_orientation`, `normalization_failed`); (2) `item.text.trim().length === 0` → `ignored_whitespace_only` (**único uso permitido de conteúdo textual em toda a reconstrução**); (3) `pageBoundsRelation === "outside"` → `excluded_outside_page`, sem `clamp`; (4) caso contrário → `eligible` (inclui `partially_outside`, que participa normalmente da reconstrução e marca a página com problema, nunca é descartado).

## 10. Conservação

Para cada página candidata, `metrics.totalSourceTextItemCount === placedTextItemCount + ignoredWhitespaceOnlyCount + excludedOutsidePageCount + unresolvedMissingGeometryCount + unresolvedInvalidGeometryCount + unresolvedUnsupportedOrientationCount + unresolvedNormalizationFailedCount` — verificado estruturalmente (cada item de origem produz exatamente uma variante da união `SourceTextItemReconstructionOutcome`) e testado explicitamente na cadeia completa (`reconstruct-budget-document-structure.test.ts`).

## 11. Ordem canônica

`sortEligibleItemsCanonically` ordena por `topPoints`, depois `centerYPoints`, depois `leftPoints`, depois `rightPoints`, depois `sourceTextItemIndex` como desempate final — nunca a ordem original do array. O resultado é idêntico para qualquer permutação de entrada com os mesmos índices e geometrias (testado com `[A,B,C]`, `[C,B,A]`, `[B,A,C]` em `physical-line-reconstruction.test.ts` e `source-item-reconstruction-outcomes.test.ts`).

## 12. Linhas físicas e antiencadeamento

`physical-line-reconstruction.ts`. Dois itens são par-compatíveis apenas quando `verticalOverlapRatio = max(0, min(bottomA,bottomB) - max(topA,topB)) / min(heightA,heightB) >= minimumPairVerticalOverlapRatio` **e** `normalizedCenterDistance = |centerYA - centerYB| / min(heightA,heightB) <= maximumPairCenterDistanceToMinimumHeightRatio`. Item de altura degenerada (`<= 0`) nunca é compatível com outro — forma sua própria linha unitária, nunca causa divisão por zero.

Antiencadeamento: um item só ingressa numa linha quando compatível com **todos** os membros já presentes, nunca apenas com a semente ou com o vizinho mais próximo — evitando que A-B e B-C compatíveis, com A-C incompatível, terminem na mesma linha (cenário adversarial obrigatório, testado nas três permutações de entrada). Desempate entre linhas igualmente compatíveis: menor distância normalizada ao centro canônico da linha, depois menor `topPoints` da linha, depois menor índice da semente.

Limites da linha: união canônica (`min`/`max`) dos itens membros, sem segunda quantização além da já aplicada pelo contrato físico.

## 13. Segmentos horizontais e mediana

`horizontal-segment-reconstruction.ts`. Dentro de cada linha, itens ordenados por `leftPoints`, `rightPoints`, `topPoints`, índice. `gap = next.leftPoints - current.rightPoints` (pode ser negativo em sobreposição); `medianItemHeight` = mediana determinística (ordenação numérica; ímpar → elemento central; par → média dos dois centrais) das alturas de todos os itens da linha; `normalizedGap = max(0, gap) / medianItemHeight`; novo segmento quando `normalizedGap > maximumSegmentGapToMedianItemHeightRatio`. Uma linha com um único item nunca precisa da mediana; uma linha com mais de um item sempre tem mediana positiva, porque um item de altura degenerada nunca ingressa numa linha com outros membros (garantia estrutural herdada do antiencadeamento de linha, seção 12). Item de largura zero participa normalmente do cálculo de lacuna, sem tratamento especial.

## 14. Blocos físicos bidimensionais e adjacência mútua

`physical-text-block-reconstruction.ts`. Candidatura entre segmentos de linhas fisicamente consecutivas (nunca mesma linha, nunca mais de uma linha de distância): `verticalGap = max(0, lowerLine.topPoints - upperLine.bottomPoints)`, normalizado pela **mediana das alturas das duas linhas** (não dos segmentos); candidato quando essa razão está dentro do limite **e** (sobreposição horizontal suficiente **ou** lacuna horizontal normalizada pela **mediana das alturas dos dois segmentos** suficientemente pequena). Segmento de largura zero nunca causa divisão por zero — a razão de sobreposição cai para `0` explicitamente quando `min(widthA,widthB) <= 0`, e a candidatura recorre à lacuna horizontal.

Adjacência mútua: cada segmento calcula seu melhor candidato na linha adjacente (maior sobreposição horizontal, depois menor lacuna, depois menor distância entre centros, depois menor chave); uma aresta só existe quando a escolha é recíproca (`A` escolhe `B` **e** `B` escolhe `A`). Blocos são componentes conexos desse grafo de arestas mútuas — permitido aqui (diferente do proibido nas linhas) porque cada aresta já passou por um portão bidimensional e por uma escolha mútua, não por agrupamento permissivo. Testado: duas colunas independentes nunca se fundem; um cabeçalho largo nunca conecta automaticamente as duas colunas que cobre (pode conectar-se a no máximo uma, deterministicamente, via desempate por chave); um parágrafo contínuo forma um único bloco; um segmento isolado forma bloco unitário.

## 15. Estruturas canônicas sem duplicação

Cada página contém `sourceItemOutcomes[]`, `lines[]` (cada uma com `segmentKeys[]`), `segments[]` (cada um com `sourceTextItemIndices[]`) e `blocks[]` (cada um com `lineKeys[]`/`segmentKeys[]`) — nunca a linha inteira copiada dentro do bloco, nunca o mesmo item em múltiplos objetos. Verificado por testes de invariantes cruzadas (`reconstruct-budget-document-structure.test.ts`, seção "cross invariants"): todo item `placed` pertence a exatamente um segmento; todo segmento pertence a exatamente uma linha; todo bloco referencia apenas linhas/segmentos existentes na mesma página; nenhuma chave duplicada; nenhuma linha/segmento/bloco pertence a página diferente da sua própria.

## 16. Chaves determinísticas

Todas em `structure-reconstruction-keys.ts` (SHA-256 hex de array JSON com ordem fixa, nunca UUID, nunca contador global): grupo = `groupReconstructionKey(reconstructionContextFingerprint, sourceCandidateGroupKey)`; página = `pageReconstructionKey(groupReconstructionKey, pageNumber)`; linha = `lineKey(pageReconstructionKey, orderedSourceTextItemIndices)`; segmento = `segmentKey(lineKey, orderedSourceTextItemIndices)`; bloco = `blockKey(pageReconstructionKey, orderedSegmentKeys)`.

## 17. Fingerprint canônico de reconstrução

`STRUCTURE_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION = "budget-document-structure-reconstruction-context-fingerprint-v1"`. `computeStructureReconstructionContextFingerprint` (não exportado pelo barrel) combina, em array JSON de ordem fixa: `sourceByteHash`, todas as identidades e o próprio `geometryContextFingerprint` da leitura física, todas as identidades da localização (schema, locator, regras, catálogo, observador), e as identidades do reconstrutor (`reconstructorName`/`Version`, `profileId`/`profileVersion`) — nunca timestamp, nunca UUID.

## 18. Contratos de saída

`BudgetDocumentStructureReconstructionResult` → `groups: ReconstructedBudgetDocumentGroup[]` → `pages: ReconstructedBudgetDocumentPage[]` → `{ sourceItemOutcomes, lines, segments, blocks }`. Identidades públicas: `BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_SCHEMA_VERSION = 1`, `BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTOR_NAME = "budget-document-structure-reconstructor"`, `BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTOR_VERSION = "budget-document-structure-reconstructor-v1"`.

## 19. Status técnicos

Global: `completed | completed_with_problems | failed`. Grupo e página: `reconstructed | reconstructed_with_problems | not_reconstructable`. Grupo é `not_reconstructable` apenas quando todas as suas páginas são `not_reconstructable`; `reconstructed` apenas quando todas as suas páginas são `reconstructed`; caso contrário `reconstructed_with_problems`. Global é `completed` apenas quando não há grupos ou todos são `reconstructed`; `failed` apenas para falha de compatibilidade/linhagem/fingerprint pré-processamento ou exceção inesperada; caso contrário `completed_with_problems`.

## 20. Matriz de falhas

| Situação | Resultado |
| --- | --- |
| contrato incompatível (leitura física ou localização) | global `failed`, sem grupos |
| linhagem incompatível (hash, contagem de páginas, metadados de origem) | global `failed`, sem grupos |
| fingerprint físico inválido | global `failed`, sem grupos |
| localização com `status: "failed"` | global `failed`, sem grupos |
| nenhum grupo candidato | global `completed`, grupos vazios |
| alguns itens não resolvidos numa página | página `reconstructed_with_problems` |
| itens parcialmente fora numa página | página `reconstructed_with_problems` |
| itens totalmente fora | excluídos da estrutura e registrados na disposição auditável |
| nenhum item elegível numa página | página `not_reconstructable` |
| todos os membros de um grupo não reconstruíveis | grupo `not_reconstructable` |
| ao menos um grupo com problema ou não reconstruível | global `completed_with_problems` |
| falha inesperada durante o processamento de um grupo | global `failed`, `structure_reconstruction_failed` |

## 21. Problemas técnicos controlados

`source_contract_version_unsupported`, `source_lineage_mismatch`, `physical_read_contract_invalid`, `geometry_context_fingerprint_invalid`, `page_location_contract_invalid`, `candidate_group_contract_invalid`, `candidate_page_not_found`, `candidate_page_text_unavailable`, `candidate_page_has_no_eligible_items`, `candidate_page_contains_unresolved_items`, `candidate_page_contains_outside_items`, `candidate_page_contains_partially_outside_items`, `physical_line_reconstruction_failed`, `horizontal_segment_reconstruction_failed`, `physical_block_reconstruction_failed`, `structure_reconstruction_failed`. Cada um vinculado a fase, grupo (quando aplicável), página e/ou item; mensagem controlada pelo domínio, nunca stack trace, caminho absoluto ou erro bruto de runtime.

## 22. Determinismo e imutabilidade

Para a mesma entrada e versões, o resultado é JSON-equivalente (testado diretamente). Nenhum campo não determinístico (sem timestamp, duração, UUID, hora de execução) existe no contrato de saída. A entrada (`physicalRead`/`pageLocation`) nunca é mutada — todos os módulos produzem estruturas novas a partir de leitura pura dos dados recebidos.

## 23. Fronteira de página e de grupo

Uma linha, um segmento e um bloco nunca atravessam página — a reconstrução de linhas/segmentos/blocos opera sempre sobre os itens de uma única página física, garantido estruturalmente pelo orquestrador (`reconstructPage` processa uma `PhysicalDocumentPage` por vez). Nenhuma estrutura atravessa grupo candidato — grupos são processados independentemente; a candidata de fechamento permanece no grupo de origem e o encerra; um grupo posterior é sempre reconstruído de forma independente.

## 24. Testes e cenários cobertos

`structure-reconstruction-keys.test.ts`, `structure-reconstruction-source-contracts.test.ts`, `structure-reconstruction-profile.test.ts`, `structure-reconstruction-context-fingerprint.test.ts`, `structure-reconstruction-input-validation.test.ts`, `source-item-reconstruction-outcomes.test.ts`, `physical-line-reconstruction.test.ts` (inclui o cenário adversarial de antiencadeamento nas três ordens de entrada), `horizontal-segment-reconstruction.test.ts` (lacuna no limite exato, acima/abaixo, sobreposição, largura zero, mediana par/ímpar), `physical-text-block-reconstruction.test.ts` (duas colunas, cabeçalho largo, parágrafo contínuo, bloco unitário, largura zero), `reconstruct-budget-document-structure.test.ts` (cadeia completa PDF sintético → leitura física v2 → `observeDocumentSignals` → `locateBudgetDocumentPages` → `reconstructBudgetDocumentStructure`, matriz de falhas, conservação, determinismo, invariantes cruzadas).

## 25. Guards

`architecture/budget-document-structure-reconstruction-boundaries.test.ts` (novo, específico desta Sprint): barrel seletivo (nunca exporta comparadores, mediana, construtores de chave, fingerprint interno, helpers de agrupamento, perfil concreto ou a ponte de teste); nenhum vocabulário econômico, de score/confiança/ranking probabilístico ou de topônimo (DNOCS/DNIT/Lagoa do Arroz) em arquivo de produção; a única leitura de `item.text` fora de `testing/` é o guard de whitespace. Complementa, sem enfraquecer, `architecture/budget-document-location-boundaries.test.ts` (já escaneia toda a subpasta `structure-reconstruction/`, proibindo `pdfjs`, `supabase`, `apps/web` e imports para outros domínios).

## 26. Ponte de teste local

`structure-reconstruction/testing/structure-reconstruction-test-bridge.ts` constrói um `PhysicalDocumentReadResult` (schema v2) válido, com itens **geometricamente posicionados** (`placed`), a partir de especificações simples de retângulo. Distinta e independente de `signal-observation/testing/synthetic-physical-document-bridge.ts` (que constrói deliberadamente `unresolved_missing_geometry`, coerente com sua própria limitação documentada, e por isso inútil para testar linhas/segmentos/blocos). Não exportada por nenhum barrel público; nunca vira fixture de produção; usa apenas bytes/texto sintéticos, nunca documento real.

## 27. Limitações

Faixa física de linha não é linha orçamentária; segmento não é coluna; bloco não é tabela; nenhuma semântica textual foi aplicada além do guard de whitespace; nenhum cabeçalho ou rodapé foi identificado; nenhuma célula foi criada; nenhum código, unidade, quantidade, preço, total ou BDI econômico foi lido ou interpretado; nenhum grupo econômico ou Versão do Orçamento foi criada; continuidade estrutural entre páginas permanece futura; itens não resolvidos permanecem explícitos na disposição auditável; itens fora da página são excluídos da estrutura, mas preservados na auditoria; `rtl`, `ttb`, inclinação e cisalhamento permanecem limitações da origem (Sprint 21.4A.2.f.0); nenhuma alegação de prontidão comercial foi feita; documento real permanece fora do escopo desta Sprint.

## 28. Decisões abertas

Continuidade estrutural entre páginas; reconhecimento de tabela; cabeçalho/rodapé tabular; repetição de cabeçalho; identificação de coluna/célula econômica; associação semântica; linha econômica, código, descrição, unidade, quantidade, preço, total, BDI, composição; revisão humana; overlay visual; persistência; Proposta de Importação; Versão do Orçamento; corpus adversarial real.

## 29. Fora do escopo

Leitura de PDF, alteração de geometria/schema físico, alteração do observador ou do localizador, reclassificação de página, novos grupos candidatos, interpretação de tabela/coluna/célula/linha econômica, cálculo, persistência, Supabase, storage, API, UI, IA, OCR, score, confiança, documento real.

## 30. Próximo incremento

Continuidade estrutural entre páginas dentro do mesmo grupo candidato, seguida por reconhecimento de padrão tabular (cabeçalho, repetição de linha) — ainda sem interpretação econômica. Documento real permanece condicionado ao recebimento de tender documents reais pelo usuário (ver `epic21_cost_engineering_audit_closed` em memória).
