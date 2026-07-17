# Epic 21 — Sprint 21.4A.2.f.1 — Reconstrução Estrutural Auditável dos Grupos Candidatos

**Status: concluída, endurecida na auditoria do PR #69 (ver §31).** Reconstrói, de forma pura e determinística, como os itens textuais geometricamente posicionados das páginas candidatas (Sprint 21.4A.2.e) se organizam fisicamente em linhas, segmentos e blocos — usando a geometria normalizada por item (Sprint 21.4A.2.f.0). Não interpreta significado econômico, não identifica coluna, célula, código, unidade, quantidade, preço, total ou BDI. Não altera o leitor físico, o observador de sinais nem o localizador. Próximo incremento: continuidade estrutural entre páginas e reconhecimento de tabela (fora do escopo desta Sprint).

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

**Endurecida na auditoria do PR #69 (§31.1)**: `adapterVersion`/`underlyingLibraryVersion` (leitura física) e `sourceObservationSchemaVersion`/`sourceObserverName` (localização) agora participam do portão por igualdade exata — não apenas do fingerprint geométrico recalculável, que nunca foi suficiente por si só (um adaptador ou biblioteca diferentes podem, em tese, recalcular seu próprio fingerprint corretamente).

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
| `geometryCanonicalizationVersion` | `"structure-reconstruction-output-geometry-canonicalization-v1"` | identidade versionada | canonicalização da fronteira de saída (§31.7) | — | `structure-reconstruction-output-geometry-canonicalization.test.ts` |

Nenhuma constante oculta, nenhum score, nenhuma confiança, nenhuma probabilidade, nenhuma aprendizagem estatística.

## 9. Elegibilidade dos itens

`source-item-reconstruction-outcomes.ts` classifica cada item textual admitido, nesta ordem: (1) estados `unresolved_*` de origem mapeados 1:1 (`unresolved_missing_geometry → unresolved_source_geometry_missing`, e assim por diante para `invalid_geometry`, `unsupported_orientation`, `normalization_failed`); (2) `item.text.trim().length === 0` → `ignored_whitespace_only` (**único uso permitido de conteúdo textual em toda a reconstrução**); (3) `pageBoundsRelation === "outside"` → `excluded_outside_page`, sem `clamp`; (4) caso contrário → `eligible` (inclui `partially_outside`, que participa normalmente da reconstrução e marca a página com problema, nunca é descartado). Uma sétima disposição, `unresolved_structure_reconstruction_failed`, existe apenas quando a reconstrução de linha ou segmento falha (§31.3) — nunca por observação geométrica; `excluded_outside_page` nunca é usada como esse fallback.

## 10. Conservação

Para cada página candidata, `metrics.totalSourceTextItemCount === placedTextItemCount + ignoredWhitespaceOnlyCount + excludedOutsidePageCount + unresolvedMissingGeometryCount + unresolvedInvalidGeometryCount + unresolvedUnsupportedOrientationCount + unresolvedNormalizationFailedCount + unresolvedStructureReconstructionFailedCount` — verificado estruturalmente (cada item de origem produz exatamente uma variante da união `SourceTextItemReconstructionOutcome`) e testado explicitamente na cadeia sintética (`reconstruct-budget-document-structure.test.ts`) e na cadeia real (`reconstruct-budget-document-structure.real-pdf-chain.test.ts`).

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

`STRUCTURE_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION = "budget-document-structure-reconstruction-context-fingerprint-v1"`. `computeStructureReconstructionContextFingerprint` (não exportado pelo barrel) combina, em array JSON de ordem fixa: `sourceByteHash`, todas as identidades e o próprio `geometryContextFingerprint` da leitura física, todas as identidades da localização (schema, locator, regras, catálogo, `sourceObservationSchemaVersion`/`sourceObserverName` — incluídos na auditoria pós-PR #69, §31.6), e as identidades do reconstrutor (`reconstructorName`/`Version`, `profileId`/`profileVersion`, `geometryCanonicalizationVersion` — §31.7) — nunca timestamp, nunca UUID.

## 18. Contratos de saída

`BudgetDocumentStructureReconstructionResult` → `groups: ReconstructedBudgetDocumentGroup[]` → `pages: ReconstructedBudgetDocumentPage[]` → `{ sourceItemOutcomes, lines, segments, blocks }`. Identidades públicas: `BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_SCHEMA_VERSION = 1`, `BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTOR_NAME = "budget-document-structure-reconstructor"`, `BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTOR_VERSION = "budget-document-structure-reconstructor-v1"`. O resultado também expõe, individualmente e não só via fingerprint (§31.6), toda identidade física e de localização: `physicalAdapterVersion`, `physicalUnderlyingLibraryVersion`, `physicalTextItemCoordinateSpaceVersion`, `physicalTextItemGeometryProfileVersion`, `physicalGeometryContextFingerprintVersion`, `physicalGeometryContextFingerprint`, `pageLocationDecisionRuleSetVersion`, `sourceObservationSchemaVersion`, `sourceObserverName`, `sourceObserverVersion`, `sourceObservationRuleSetVersion`, `sourceCatalogVersion` — presentes inclusive em `status: "failed"`.

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

`source_contract_version_unsupported`, `source_lineage_mismatch`, `physical_read_contract_invalid`, `geometry_context_fingerprint_invalid`, `page_location_contract_invalid`, `candidate_group_contract_invalid`, `candidate_page_not_found`, `candidate_page_text_unavailable`, `candidate_page_has_no_eligible_items`, `candidate_page_contains_unresolved_items`, `candidate_page_contains_outside_items`, `candidate_page_contains_partially_outside_items`, `physical_line_reconstruction_failed` (fatal para a página, `line_reconstruction`), `horizontal_segment_reconstruction_failed` (fatal para a página, `segment_reconstruction` — agora efetivamente distinto de `physical_line_reconstruction_failed`, §31.3), `physical_block_reconstruction_failed` (nunca fatal), `structure_reconstruction_failed`. Cada um vinculado a fase, grupo (quando aplicável), página e/ou item; mensagem controlada pelo domínio, centralizada em português por `structure-reconstruction-technical-problem.ts` (§31.8), nunca stack trace, caminho absoluto ou erro bruto de runtime.

## 22. Determinismo e imutabilidade

Para a mesma entrada e versões, o resultado é JSON-equivalente (testado diretamente). Nenhum campo não determinístico (sem timestamp, duração, UUID, hora de execução) existe no contrato de saída. A entrada (`physicalRead`/`pageLocation`) nunca é mutada — todos os módulos produzem estruturas novas a partir de leitura pura dos dados recebidos.

## 23. Fronteira de página e de grupo

Uma linha, um segmento e um bloco nunca atravessam página — a reconstrução de linhas/segmentos/blocos opera sempre sobre os itens de uma única página física, garantido estruturalmente pelo orquestrador (`reconstructPage` processa uma `PhysicalDocumentPage` por vez). Nenhuma estrutura atravessa grupo candidato — grupos são processados independentemente; a candidata de fechamento permanece no grupo de origem e o encerra; um grupo posterior é sempre reconstruído de forma independente.

## 24. Testes e cenários cobertos

`structure-reconstruction-keys.test.ts`, `structure-reconstruction-source-contracts.test.ts` (inclui as rejeições de adaptador/biblioteca/schema/observador diferentes, §31.1), `structure-reconstruction-profile.test.ts`, `structure-reconstruction-context-fingerprint.test.ts`, `structure-reconstruction-input-validation.test.ts` (inclui independência de ordem do array e integridade completa de grupos/decisões, §31.4-§31.5), `structure-reconstruction-technical-problem.test.ts` (novo, §31.8), `structure-reconstruction-output-geometry-canonicalization.test.ts` (novo, §31.7), `source-item-reconstruction-outcomes.test.ts`, `physical-line-reconstruction.test.ts` (inclui o cenário adversarial de antiencadeamento nas três ordens de entrada), `horizontal-segment-reconstruction.test.ts` (lacuna no limite exato, acima/abaixo, sobreposição, largura zero, mediana par/ímpar), `physical-text-block-reconstruction.test.ts` (duas colunas, cabeçalho largo, parágrafo contínuo, bloco unitário, largura zero), `reconstruct-budget-document-structure.test.ts` (pipeline geométrico sintético via ponte de teste — nunca chamado de "cadeia completa", matriz de falhas, conservação, determinismo, invariantes cruzadas, canonicalização de artefato binário, disposição correta em falha estrutural, identidades expostas), e `infrastructure/budget-document-location/pdfjs/reconstruct-budget-document-structure.real-pdf-chain.test.ts` (novo — a única prova real da cadeia completa, §31.2).

## 25. Guards

`architecture/budget-document-structure-reconstruction-boundaries.test.ts` (novo, específico desta Sprint): barrel seletivo (nunca exporta comparadores, mediana, construtores de chave, fingerprint interno, helpers de agrupamento, perfil concreto, mensagens técnicas, canonicalização de saída ou a ponte de teste); nenhum vocabulário econômico, de score/confiança/ranking probabilístico ou de topônimo (DNOCS/DNIT/Lagoa do Arroz) em arquivo de produção; a única leitura de `item.text` fora de `testing/` é o guard de whitespace. Complementa, sem enfraquecer, `architecture/budget-document-location-boundaries.test.ts` e `architecture/budget-document-location-pdf-adapter-boundaries.test.ts` (que já escaneiam toda a subpasta `structure-reconstruction/`, proibindo `supabase`, `apps/web` e imports para outros domínios).

Auditoria pós-PR #69: os dois literais de identidade do adaptador (§31.1) exigiram uma exceção nomeada e restrita a exatamente `structure-reconstruction-source-contracts.ts`, adicionada a ambos os guards que escaneiam a substring "pdfjs" no texto do arquivo — nunca à checagem de `import`, que continua proibindo qualquer `import ... from "pdfjs-dist"` em todo o domínio sem exceção. Cada exceção é verificada por um teste dedicado que confirma sua estreiteza (nenhum outro arquivo, nenhuma outra palavra-chave). O teste real de cadeia completa (§31.2) não precisou de nenhuma exceção: vive em `infrastructure/budget-document-location/pdfjs/`, onde importar tanto o adaptador real quanto o barrel do domínio já é a direção de dependência esperada.

## 26. Ponte de teste local

`structure-reconstruction/testing/structure-reconstruction-test-bridge.ts` constrói um `PhysicalDocumentReadResult` (schema v2) válido, com itens **geometricamente posicionados** (`placed`), a partir de especificações simples de retângulo, incluindo um campo `index?: number` opcional por item (§31.4, permite testar independência de ordem do array). Declara `adapterVersion`/`underlyingLibraryVersion` importando `SUPPORTED_PHYSICAL_ADAPTER_VERSION`/`SUPPORTED_PHYSICAL_UNDERLYING_LIBRARY_VERSION` de `structure-reconstruction-source-contracts.ts` (nunca redeclarando o literal — fonte única, §31.1), já que o portão de compatibilidade agora exige igualdade exata desses dois campos. Distinta e independente de `signal-observation/testing/synthetic-physical-document-bridge.ts` (que constrói deliberadamente `unresolved_missing_geometry`, coerente com sua própria limitação documentada, e por isso inútil para testar linhas/segmentos/blocos). Não exportada por nenhum barrel público; nunca vira fixture de produção; usa apenas bytes/texto sintéticos, nunca documento real. A prova de que o adaptador real produz um contrato compatível é exclusivamente de `reconstruct-budget-document-structure.real-pdf-chain.test.ts` (§31.2) — esta ponte nunca é chamada de "cadeia completa".

## 27. Limitações

Faixa física de linha não é linha orçamentária; segmento não é coluna; bloco não é tabela; nenhuma semântica textual foi aplicada além do guard de whitespace; nenhum cabeçalho ou rodapé foi identificado; nenhuma célula foi criada; nenhum código, unidade, quantidade, preço, total ou BDI econômico foi lido ou interpretado; nenhum grupo econômico ou Versão do Orçamento foi criada; continuidade estrutural entre páginas permanece futura; itens não resolvidos permanecem explícitos na disposição auditável; itens fora da página são excluídos da estrutura, mas preservados na auditoria; `rtl`, `ttb`, inclinação e cisalhamento permanecem limitações da origem (Sprint 21.4A.2.f.0); nenhuma alegação de prontidão comercial foi feita; documento real permanece fora do escopo desta Sprint.

## 28. Decisões abertas

Continuidade estrutural entre páginas; reconhecimento de tabela; cabeçalho/rodapé tabular; repetição de cabeçalho; identificação de coluna/célula econômica; associação semântica; linha econômica, código, descrição, unidade, quantidade, preço, total, BDI, composição; revisão humana; overlay visual; persistência; Proposta de Importação; Versão do Orçamento; corpus adversarial real.

## 29. Fora do escopo

Leitura de PDF, alteração de geometria/schema físico, alteração do observador ou do localizador, reclassificação de página, novos grupos candidatos, interpretação de tabela/coluna/célula/linha econômica, cálculo, persistência, Supabase, storage, API, UI, IA, OCR, score, confiança, documento real.

## 30. Próximo incremento

Continuidade estrutural entre páginas dentro do mesmo grupo candidato, seguida por reconhecimento de padrão tabular (cabeçalho, repetição de linha) — ainda sem interpretação econômica. Documento real permanece condicionado ao recebimento de tender documents reais pelo usuário (ver `epic21_cost_engineering_audit_closed` em memória).

## 31. Correções da auditoria do PR #69

Oito correções obrigatórias, todas na mesma branch, sem alterar a matemática central de linhas/segmentos/blocos (antiencadeamento, ordenação canônica, mediana determinística, lacuna normalizada, adjacência mútua, componentes conexos permanecem intocados).

### 31.1 Portão de compatibilidade não era exato

`adapterVersion`/`underlyingLibraryVersion` (leitura física) e `sourceObservationSchemaVersion`/`sourceObserverName` (localização) passam a participar do portão por igualdade exata — nunca apenas do fingerprint recalculável. Os dois literais de identidade do adaptador (`SUPPORTED_PHYSICAL_ADAPTER_VERSION = "pdfjs-physical-document-reader-adapter-v2"`, `SUPPORTED_PHYSICAL_UNDERLYING_LIBRARY_VERSION = "pdfjs-dist@6.1.200"`) ficam isolados em `structure-reconstruction-source-contracts.ts`, a única fonte de verdade — a ponte de teste geométrica os importa em vez de redeclará-los. Isso exigiu uma exceção nomeada, restrita a este único arquivo, em dois guards pré-existentes que escaneiam a substring "pdfjs" (`budget-document-location-boundaries.test.ts` e `budget-document-location-pdf-adapter-boundaries.test.ts`) — cada exceção documentada no próprio guard, verificada por um teste dedicado que confirma que ela não vaza para nenhum outro arquivo ou palavra-chave, e que o arquivo isento nunca importa `pdfjs-dist` nem `infrastructure/` (apenas declara o literal como dado de comparação).

### 31.2 O teste de "cadeia completa" não usava PDF real

`reconstruct-budget-document-structure.real-pdf-chain.test.ts` (novo) usa `buildSyntheticPdfBytes` + `pdfjsPhysicalDocumentReader.read` reais, encadeados com `observeDocumentSignals`/`locateBudgetDocumentPages`/`reconstructBudgetDocumentStructure` — todos reais. Vive em `infrastructure/budget-document-location/pdfjs/`, não em `domain/`: é o único diretório do pacote em que a direção de dependência já permitida (adaptador → domínio) comporta importar tanto o leitor físico real quanto o reconstrutor, sem exigir nenhuma exceção adicional em nenhum guard. Os testes anteriores que usavam `structure-reconstruction-test-bridge.ts` foram renomeados de "full chain" para "synthetic geometry pipeline (bridge, not real PDF)", com um comentário explícito no topo do arquivo apontando para o teste real.

### 31.3 Falha estrutural falsificava itens como "fora da página"

Nova disposição `unresolved_structure_reconstruction_failed` (com `failedPhase: "line_reconstruction" | "segment_reconstruction"`) — nunca mais `excluded_outside_page` como fallback técnico. As três fases têm tratamento estritamente separado no orquestrador: falha de linha ou de segmento é fatal para a página inteira (`not_reconstructable`, nenhuma estrutura parcial, todo item elegível recebe a nova disposição com o código `physical_line_reconstruction_failed`/`horizontal_segment_reconstruction_failed` correto); falha de bloco nunca é fatal (linhas/segmentos já reconstruídos permanecem, itens continuam `placed`, blocos ficam vazios, página `reconstructed_with_problems`). `PageStructureReconstructionMetrics` ganhou `unresolvedStructureReconstructionFailedCount` para a invariante de conservação continuar batendo. Testado: um teste de regressão cruza todo `excluded_outside_page` do resultado com a geometria de origem, confirmando que só existe quando `pageBoundsRelation` realmente era `"outside"`.

### 31.4 Independência da ordem do array era rejeitada pelo validador

`hasDenseTextItemIndices` substitui a checagem `item.index === itemPosition`: confirma índices inteiros, não negativos, únicos e densos de `0` a `N-1` — nunca que a posição no array seja igual ao índice. A ponte de teste ganhou um campo `index?: number` opcional por item para permitir construir a mesma página com os mesmos índices em ordens de array diferentes; testado que ambas as ordens produzem entrada válida.

### 31.5 Integridade dos grupos candidatos estava incompleta

`validatePageDecisions` (nova) confirma exatamente `totalPageCount` decisões, únicas e densas de 1 a N, identidade de origem coerente com o `BudgetDocumentPageLocationResult` pai em cada decisão, e a coerência `classification === "candidate" ⟺ candidateType !== null`. `validateCandidateGroups` (reescrita) confirma adicionalmente `sourceByteHash`, `formationRuleId`/`formationRuleVersion` (contra as constantes importadas de `page-location`), `locatorVersion`/`decisionRuleSetVersion` (contra os do `BudgetDocumentPageLocationResult` pai), a chave recalculada pela mesma fórmula determinística (`[sourceByteHash, startPageNumber, endPageNumber, locatorVersion, decisionRuleSetVersion].join(":")`) igual à recebida, e que cada membro corresponde exatamente à decisão de página original (`candidateType`/`primaryRuleId`/`primaryRuleVersion`). Nunca corrige — sempre rejeita.

### 31.6 Resultado não expunha todas as identidades individualmente

`BudgetDocumentStructureReconstructionResult` ganhou `physicalAdapterVersion`, `physicalUnderlyingLibraryVersion`, `physicalTextItemCoordinateSpaceVersion`, `physicalTextItemGeometryProfileVersion`, `physicalGeometryContextFingerprintVersion`, `physicalGeometryContextFingerprint`, `pageLocationDecisionRuleSetVersion`, `sourceObservationSchemaVersion`, `sourceObserverName`, `sourceObserverVersion`, `sourceObservationRuleSetVersion`, `sourceCatalogVersion` — presentes inclusive quando `status` é `failed`. Tipados via acesso indexado ao próprio contrato de origem (`PhysicalDocumentReadResult["adapterVersion"]`, `BudgetDocumentPageLocationResult["sourceObserverName"]`, etc.) para nunca divergir silenciosamente se o contrato de origem mudar. O fingerprint canônico da reconstrução também passou a incluir `sourceObservationSchemaVersion`/`sourceObserverName` (antes ausentes) e `geometryCanonicalizationVersion` (§31.7).

### 31.7 Números derivados não eram canonicalizados na saída

`structure-reconstruction-output-geometry-canonicalization.ts` (novo, não exportado pelo barrel): reutiliza a mesma política de quantização da leitura física (`canonicalizeGeometryPoints` — seis casas decimais, arredondamento simétrico, `-0 → 0`), com identidade de versão própria (`geometryCanonicalizationVersion`, presente no perfil e no fingerprint da reconstrução). Aplicada uma única vez, na fronteira de saída — nunca durante as comparações internas de compatibilidade/desempate/candidatura, que permanecem em precisão completa. Testado com o artefato binário clássico (`0.1 + 0.2`) tanto isoladamente quanto de ponta a ponta (um item com `left=0.1`/`right=0.2` produzindo `centerXPoints` limpo).

### 31.8 Mensagens técnicas estavam em inglês

`structure-reconstruction-technical-problem.ts` (novo, não exportado pelo barrel): mapa único `código → mensagem em português`, mesmo padrão de `physical-document-technical-problem.ts`. Todos os `problem()` ad hoc em `structure-reconstruction-input-validation.ts` e `reconstruct-budget-document-structure.ts` foram substituídos por `createStructureReconstructionTechnicalProblem(code, phase, groupKey?, pageNumber?, sourceTextItemIndex?)`. A especificidade de cada ocorrência vive nos campos estruturados, nunca em texto interpolado.

## 32. Segunda rodada de correções (auditoria final complementar do PR #69)

Cinco correções adicionais sobre a mesma branch, sem tocar a matemática central de linhas/segmentos/blocos.

### 32.1 Páginas candidatas podiam desaparecer dos grupos sem rejeição

`validateCandidateGroups` agora deriva, após validar todos os grupos, o conjunto de páginas cuja decisão é `classification === "candidate"` (`candidateDecisionPageNumbers`) e o compara por igualdade exata de conjunto contra `pagesSeenInAnyGroup`. Grupo inteiro removido, página candidata retirada de um grupo multi-página, ou grupos cobrindo apenas parte das decisões candidatas — todos rejeitados com `candidate_group_contract_invalid`. Nunca recria o grupo ausente nem inclui a página automaticamente. Testado com omissão total (todos os `candidateGroups` esvaziados) e omissão parcial (uma página retirada de um grupo de duas páginas, com a decisão candidata correspondente intacta).

### 32.2 O resultado completo ainda dependia da ordem do array de itens

`sortOutcomesByIndex` (novo, por `sourceTextItemIndex`, nunca pela posição no array) é aplicado nos três pontos onde `sourceItemOutcomes` é produzido: página reconstruída normalmente, página sem item elegível, e página com falha estrutural. Novo teste no orquestrador constrói dois `PhysicalDocumentReadResult` com os mesmos itens/índices/geometrias em ordens de array diferentes (usando o campo `index?` da ponte de teste) e exige `JSON.stringify` idêntico do **resultado completo** — fingerprint, grupos, páginas, disposições, linhas, segmentos, blocos, métricas, problemas e status — não apenas que ambos passem na validação de entrada.

### 32.3 Canonicalização podia produzir geometria internamente incoerente

`canonicalizeOutputGeometryBounds` agora canonicaliza primeiro apenas os quatro limites (`leftPoints`/`topPoints`/`rightPoints`/`bottomPoints`) e deriva `widthPoints`/`heightPoints`/`centerXPoints`/`centerYPoints` **dos limites já canonicalizados** — nunca re-canonicaliza independentemente a largura/altura/centro brutos do rascunho, o que poderia produzir, por exemplo, `leftPoints=0, rightPoints=0.000001, widthPoints=0` quando os limites e a dimensão bruta caem em lados diferentes da fronteira de arredondamento. Uma função interna (`assertCoherentCanonicalBounds`, nunca exposta) confirma `left<=right`, `top<=bottom`, `width>=0`, `height>=0` e que largura/altura/centros batem exatamente com a fórmula de derivação — lançando se violado (guarda de integridade, nunca esperado de disparar dado que as próprias funções de linha/segmento/bloco sempre produzem `right>=left` via `max`/`min`). Testado com bounds adversariais na fronteira exata de seis casas (`left=0.0000004`, `right=0.0000006`) e de ponta a ponta para linha, segmento e bloco simultaneamente (o item artefato-prone de `0.1`/`0.2` forma sua própria linha, segmento e bloco — os três verificados).

### 32.4 Faltava exaustividade nas métricas por disposição

`computePageMetrics` ganhou `default: return assertUnreachableOutcome(outcome)` (guarda de exaustividade, `outcome: never`) — uma variante futura de `SourceTextItemReconstructionOutcome` sem o `case` correspondente vira erro de compilação, nunca desaparece silenciosamente da contagem. Reforçado por um teste de cobertura tipológica: um `Record<SourceTextItemReconstructionOutcome["status"], true>` que também falha ao compilar se uma variante for adicionada ou removida sem atualizar o teste.

### 32.5 Ramos de falha estrutural não eram exercitados diretamente

Nenhuma das três funções puras de reconstrução (linha/segmento/bloco) tem um caminho natural de exceção a partir de entrada geometricamente válida — os `try`/`catch` no orquestrador são defesa em profundidade, não algo naturalmente disparável em teste black-box. `StructureReconstructionDependencies` (interface interna, `reconstructLines`/`reconstructSegments`/`reconstructBlocks`) e `reconstructBudgetDocumentStructureWithDependencies` (função interna que aceita essas dependências) permitem que o teste injete uma falha controlada em exatamente uma fase por vez. `reconstructBudgetDocumentStructure` — a única função pública — continua aceitando exatamente um parâmetro (`input`), sem nenhum jeito de um consumidor de produção escolher um algoritmo alternativo; nenhum dos dois novos identificadores é exportado por nenhum barrel (verificado por guard dedicado, incluindo uma checagem textual de que a assinatura pública tem exatamente um parâmetro). `reconstruct-budget-document-structure.failure-injection.test.ts` (novo) prova as três fases: falha de linha e de segmento (`not_reconstructable`, estruturas vazias, `unresolved_structure_reconstruction_failed` com `failedPhase` correto, nunca `excluded_outside_page`, conservação íntegra) e falha de bloco (`reconstructed_with_problems`, linhas/segmentos preservados, itens `placed`, blocos vazios, conservação íntegra).
