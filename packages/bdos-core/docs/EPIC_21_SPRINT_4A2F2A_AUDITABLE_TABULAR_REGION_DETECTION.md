# Epic 21 — Sprint 21.4A.2.f.2a — Detecção Auditável de Regiões Candidatas a Estrutura Tabular

**Status: implementada.** Detecta, de forma pura e determinística, quais partes de uma página física reconstruída (Sprint 21.4A.2.f.1) apresentam evidências físicas suficientes de organização repetitiva compatível com uma futura estrutura tabular. Não identifica tabela confirmada, coluna física, célula, cabeçalho, rodapé ou qualquer significado econômico. Não usa LLM, IA, OCR, heurística probabilística, score, confiança estatística ou ranking. Não persiste, não expõe API, não tem interface.

## 1. Objetivo

Responder apenas: "quais partes de uma página reconstruída apresentam evidências físicas suficientes de organização tabular para serem registradas como regiões candidatas?" — nunca "qual é a tabela orçamentária, a coluna econômica, a célula, o cabeçalho, o código de serviço, a unidade, a quantidade, o preço, o total ou o BDI?".

## 2. Posição na cadeia

Base: `75b9300b5e11f7b7833a288ab90c5fefcc34b973` (merge do PR #69, encerramento da Sprint 21.4A.2.f.1). Cadeia consolidada: leitura física (21.4A.2.c) → geometria normalizada por item (21.4A.2.f.0) → observação de sinais (21.4A.2.d) → localização e grupos candidatos (21.4A.2.e) → reconstrução estrutural física (21.4A.2.f.1) → **detecção de regiões candidatas a estrutura tabular (esta Sprint)**.

Fronteira preservada: leitura física ≠ observação de sinais ≠ localização de páginas ≠ estrutura física reconstruída ≠ **região candidata a estrutura tabular** ≠ coluna física ≠ célula física ≠ interpretação econômica ≠ Versão do Orçamento.

## 3. Contratos consumidos

Exclusivamente `BudgetDocumentStructureReconstructionResult` (schema v1, produzido pela Sprint 21.4A.2.f.1):

```ts
interface BudgetDocumentTabularRegionDetectionInput {
  readonly structureReconstruction: BudgetDocumentStructureReconstructionResult;
}
```

Nunca bytes, PDF, adaptador, Supabase, storage, banco de dados, `PhysicalDocumentReadResult`, `BudgetDocumentPageLocationResult`, texto para interpretação semântica ou outros domínios econômicos — verificado pelo guard arquitetural (`architecture/budget-document-tabular-region-detection-boundaries.test.ts`), que proíbe qualquer import de `physical-document-read.types` ou `page-location` fora de `testing/`.

## 4. Compatibilidade exata

`SUPPORTED_TABULAR_REGION_DETECTION_SOURCE_CONTRACTS` (`tabular-region-detection-source-contracts.ts`, não exportado pelo barrel) declara, por igualdade exata (nunca comparação lexical, nunca aceitação de versão desconhecida): `schemaVersion=1`, `reconstructorName="budget-document-structure-reconstructor"`, `reconstructorVersion="budget-document-structure-reconstructor-v1"`, `reconstructionProfileId="budget-document-structure-reconstruction-profile-v1"`, `reconstructionProfileVersion=1`, `reconstructionContextFingerprintVersion="budget-document-structure-reconstruction-context-fingerprint-v1"`. Também pina `geometryCanonicalizationVersion="structure-reconstruction-output-geometry-canonicalization-v1"` — lido diretamente do código-fonte da Sprint anterior, nunca adivinhado — porque esse valor não é exposto individualmente em `BudgetDocumentStructureReconstructionResult` (apenas via `reconstructionProfileId`/`Version`) e é necessário para recompor a entrada exata do fingerprint de origem (§6).

`structureReconstruction.status === "failed"` é tratado como entrada inválida (`source_reconstruction_contract_invalid`), nunca traduzido silenciosamente em "zero grupos, concluído".

## 5. Linhagem e validação estrutural

`tabular-region-detection-input-validation.ts` valida, sem nunca corrigir: contrato suportado; `status !== "failed"`; fingerprint de contexto da reconstrução recomputado e comparado byte a byte (§6); grupos com `pageKeys` coerentes com suas próprias páginas, páginas contíguas e densas por grupo; páginas com `verticalOrder` de linha denso e único; segmentos referenciados pelas linhas existindo de fato em `page.segments` e vice-versa. Estados legítimos de página individual (`not_reconstructable`, `reconstructed_with_problems`) nunca são tratados como entrada inválida — são estados normais que o orquestrador trata por página.

## 6. Fingerprint

Dois conceitos distintos, nunca confundidos:

- **Identidade de detecção** (`computeTabularRegionDetectionIdentityFingerprint`, interna): SHA-256 de um array JSON de ordem fixa combinando `sourceByteHash`, todas as identidades da reconstrução consumida (incluindo o próprio `reconstructionContextFingerprint`), e as identidades do detector (`detectorName`/`Version`, `profileId`/`Version`, regra e versão de alinhamento, regra e versão de formação de região, `geometryCanonicalizationVersion`). Usada exclusivamente para semear as chaves determinísticas (§8) — nunca incorpora conteúdo de evidências ou regiões.
- **Fingerprint final exposto** (`detectionContextFingerprint`, público): SHA-256 combinando a identidade de detecção com o conteúdo canônico completo dos grupos processados (evidências de alinhamento, regiões, disposições, problemas, métricas). Satisfaz a exigência de que a mesma entrada, perfil e versões produzam resultado JSON-equivalente, e que o fingerprint reflita não só a origem mas o que foi de fato encontrado.

`tabular-region-detection-input-validation.ts` recompõe a entrada exata do fingerprint da Sprint anterior (`StructureReconstructionContextFingerprintInput`) a partir dos campos já achatados em `BudgetDocumentStructureReconstructionResult`, reaproveitando `computeStructureReconstructionContextFingerprint` (importado por caminho relativo direto, nunca pelo barrel — mesmo padrão já usado pela Sprint anterior para `computeGeometryContextFingerprint`) — nunca duplica a lógica de hash.

## 7. Perfil de detecção versionado

`BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1` (`profileId="budget-document-tabular-region-detection-profile-v1"`, `profileVersion=1`), não exportado pelo barrel:

| Propriedade | Valor | Justificativa |
| --- | ---: | --- |
| `minimumRegionLineCount` | 3 | Aprovado explicitamente no enunciado da Sprint (§9) — não derivado. |
| `minimumRecurrentAlignmentCount` | 2 | Idem. |
| `minimumLinesSustainingAlignment` | 3 | Idem. |
| `maximumAlignmentPositionDeviationToMinimumLineHeightRatio` | 0.5 | Reaproveita a mesma classe de razão, com a mesma normalização pela **menor altura do par**, já aprovada e testada no limiar exato pela Sprint anterior (`maximumPairCenterDistanceToMinimumHeightRatio`). "Distância de posição normalizada pela menor altura do par" é a mesma medida física; apenas o eixo comparado muda (posição horizontal, não centro vertical). |
| `alignmentTypePriorityOrder` | `["left_edge","right_edge","horizontal_center"]` | Ordem fixa, leitura esquerda-para-direita, apenas para desempate determinístico — mesma convenção de `chooseBestCandidate`/`sortEligibleItemsCanonically` da Sprint anterior. |
| `geometryCanonicalizationVersion` | `"tabular-region-detection-output-geometry-canonicalization-v1"` | Canonicalização da fronteira de saída (§11). |

Nenhuma "lacuna vertical máxima" foi introduzida: a contiguidade de uma região é definida inteiramente por `verticalOrder` consecutivo entre as linhas de uma página — uma propriedade estrutural já produzida e testada pela Sprint anterior — nunca por uma tolerância física adicional não aprovada. Nenhum valor foi calibrado por documento real; todos são decisões conservadoras de engenharia geométrica, testadas nos seus limiares exatos.

## 8. Alinhamentos verticais recorrentes

`vertical-alignment-observation.ts`. Para cada um dos três tipos (`left_edge`, `right_edge`, `horizontal_center`), independentemente: candidatos (um por segmento) são ordenados canonicamente (posição, depois `lineVerticalOrder`, depois `horizontalOrder`, depois `segmentKey`) e agrupados por compatibilidade par a par **completa** — um segmento só ingressa num cluster quando compatível com **todos** os membros já presentes (antiencadeamento, mesmo padrão exato de `reconstructPhysicalLines` da Sprint anterior), nunca apenas com o vizinho mais próximo. No máximo um segmento por linha participa de cada cluster. Um cluster só se torna alinhamento recorrente quando sustenta `>= minimumLinesSustainingAlignment` linhas distintas. A posição canônica é a média das posições observadas.

Chave: `computeAlignmentKey(pageProcessedKey, alignmentType, orderedSegmentKeys)`.

## 9. Formação de regiões

`tabular-region-formation.ts`, separado de forma limpa da observação de alinhamentos (§8). Cada linha recebe uma "assinatura" = conjunto de alinhamentos recorrentes em que participa. Para cada posição inicial `i` (0-based, por `verticalOrder`), estende-se gulosamente para a direita enquanto a interseção corrente de assinaturas permanecer com `>= minimumRecurrentAlignmentCount` elementos — a interseção é monotonicamente não-crescente à medida que a janela cresce, o que torna a extensão maximal única e determinística para cada `i` (nunca depende de ordem de descoberta). Uma janela só é mantida quando estender um passo à esquerda deixaria de ser válida — o mesmo argumento de monotonicidade garante que checar apenas o vizinho imediato à esquerda já é suficiente (prova: se estender um passo já invalida, por monotonicidade estender mais passos também invalida).

**Antiencadeamento territorial**: janelas maximais que compartilham ao menos uma posição de linha são marcadas `conflicted: true` — nenhuma das duas se torna região confirmada; nenhuma escolha silenciosa; nenhuma fusão. Isso resolve por construção o cenário adversarial "A–B e B–C compatíveis, A–C incompatíveis, não podem formar automaticamente uma única região", e o cenário "duas regiões próximas nunca se fundem" (título largo, nota, quadro lateral — nenhum deles jamais entra numa janela porque nunca compartilha `>= 2` alinhamentos recorrentes com as linhas da região).

Chave: `computeRegionKey(pageProcessedKey, orderedLineKeys)`.

## 10. Antiencadeamento e proteções

- Parágrafo comum / lista numerada / bloco com margem esquerda estável: nunca forma região — apenas **um** alinhamento (a margem esquerda) nunca satisfaz `minimumRecurrentAlignmentCount = 2`.
- Duas linhas: nunca formam região (`minimumRegionLineCount = 3`).
- Um único alinhamento recorrente: nunca forma região.
- Elemento largo (título, nota, quadro lateral) adjacente a uma região: nunca é incorporado, nunca é usado para unir duas regiões, nunca é classificado como cabeçalho/rodapé, nunca é descartado como ruído — permanece `not_in_tabular_region`.
- Duas regiões lado a lado ou empilhadas: nunca se fundem, pois exigem `>= 2` alinhamentos recorrentes **compartilhados por todas as linhas da janela** — colunas com posições diferentes nunca produzem o mesmo cluster de alinhamento.
- Pertencimento ao mesmo bloco físico (`ReconstructedPhysicalTextBlock` da Sprint anterior) nunca é lido nem usado como evidência — o guard arquitetural confirma que nenhum arquivo de produção referencia `blocks`.

## 11. Canonicalização geométrica

`tabular-region-detection-output-geometry-canonicalization.ts` reaproveita, sem duplicar, `canonicalizeOutputGeometryBounds`/`canonicalizeStructureReconstructionOutputGeometry` da Sprint anterior (seis casas decimais, arredondamento simétrico, `-0 → 0`, limites canonicalizados primeiro, dimensões/centros derivados deles) — com identidade de versão própria (`tabular-region-detection-output-geometry-canonicalization-v1`), pois a decisão de *onde* aplicá-la (fronteira de saída da detecção) é desta Sprint. Aplicada uma única vez, na fronteira; todas as comparações internas (tolerância de alinhamento, formação de janelas) permanecem em precisão completa.

## 12. Conservação

Toda linha física de uma página processada termina em exatamente uma disposição (`TabularRegionLineDisposition`): `included_in_candidate_region`, `not_in_tabular_region`, `unresolved_tabular_region_ambiguity` ou `unresolved_tabular_region_detection_failed`. `computePageMetrics` usa `switch` exaustivo com `assertUnreachableDisposition(value: never)` — uma variante futura sem `case` correspondente vira erro de compilação. O orquestrador verifica explicitamente, após montar as disposições, que a soma das quatro contagens fecha exatamente com `totalLineCount`; se não fechar (nunca esperado dado o algoritmo, mas verificado), a página é declarada `not_detectable` com `tabular_region_formation_failed`, nunca uma inconsistência silenciosa.

## 13. Ambiguidade

Quando janelas maximais concorrentes reivindicam a mesma linha, nenhuma é declarada região válida (§9). Cada linha afetada recebe `unresolved_tabular_region_ambiguity` com `conflictingCandidateRegionKeys` — as chaves determinísticas de todas as janelas conflitantes que cobrem aquela linha, computadas mesmo para janelas rejeitadas (nunca aparecem em `regions[]`, mas permanecem auditáveis). A invalidação é da **janela inteira**, nunca apenas do trecho literalmente disputado — evita fabricar uma sub-janela nunca validada contra o perfil.

## 14. Estados

Página e grupo: `detected | detected_with_problems | no_candidate_region | not_detectable`. `no_candidate_region` = processamento concluído, nenhuma região e nenhuma ambiguidade encontrada (distinto de falha). `not_detectable` = a página de origem não era reconstruível, ou uma falha técnica ocorreu na observação de alinhamentos ou formação de regiões. Global: `completed | completed_with_problems | failed` — `failed` apenas para incompatibilidade de contrato/linhagem/fingerprint pré-processamento ou exceção inesperada; um grupo `not_detectable` ainda produz `completed_with_problems`, nunca `failed` (mesma disciplina da Sprint anterior).

## 15. Problemas técnicos

Catálogo central em português (`tabular-region-detection-technical-problem.ts`, não exportado pelo barrel), 14 códigos: `source_contract_version_unsupported`, `source_lineage_mismatch`, `source_reconstruction_contract_invalid`, `source_reconstruction_fingerprint_invalid`, `source_group_contract_invalid`, `source_page_contract_invalid`, `source_structure_reference_invalid`, `candidate_page_not_reconstructable`, `candidate_page_has_unresolved_structure`, `vertical_alignment_detection_failed`, `tabular_region_formation_failed`, `tabular_region_overlap_detected`, `tabular_region_conservation_failed`, `tabular_region_detection_failed`. Campos estruturados (`phase`, `groupKey`, `pageNumber`, `lineKey`, `segmentKey`) carregam a especificidade — nunca texto interpolado.

## 16. Determinismo e imutabilidade

Mesma entrada, perfil e versões produzem resultado JSON-equivalente — testado diretamente (`detect-budget-document-tabular-regions.test.ts`). Independência de permutação de array testada em três níveis: observação de alinhamento (`vertical-alignment-observation.test.ts`), formação de região (`tabular-region-formation.test.ts`) e pipeline completo (itens de entrada embaralhados com índices explícitos preservados). Entrada nunca mutada (testado com `Object.freeze`).

## 17. Testes

Matriz cobrindo positivos (bloco tabular limpo de 2 colunas, alinhamento por bordas esquerda/direita/centro, duas regiões independentes na mesma página), limites (exatamente 2/3 linhas, exatamente 1/2 alinhamentos, desvio de tolerância exatamente no limite/acima/abaixo), adversariais (parágrafo comum, lista numerada, título largo adjacente, nota adjacente, sobreposição/concorrência de janelas, antiencadeamento A-B/B-C/A-C, altura degenerada), determinismo, conservação, falha controlada (observação de alinhamento, formação de região, ambiguidade manufaturada via injeção de dependência) e cadeia real com PDF sintético (`infrastructure/budget-document-location/pdfjs/detect-budget-document-tabular-regions.real-pdf-chain.test.ts`).

**Prova positiva da cadeia real (auditoria pós-revisão)**: a cadeia real original provava apenas o encadeamento técnico (identidades, ausência de `source_contract_version_unsupported`, JSON-equivalência), nunca que uma região foi de fato detectada — a fixture original (`FOUR_ROW_TABULAR_PDF_BYTES`) nunca continha o segundo sinal textual positivo (`structural-bdi-documentary-mention` ou de total) exigido por `candidate-service-item-and-bdi-v1`/`candidate-service-item-and-total-v1` do localizador real; sozinho, `structural-service-item-identification` produz `classification: "ambiguous"`, nenhum grupo candidato é formado, e a cadeia nunca chegava a exercitar a formação de região. Uma nova fixture (`FOUR_ROW_TABULAR_PDF_WITH_BDI_BYTES`) adiciona um item "BDI" posicionado na mesma linha física da primeira fileira (mesmo `y`, `x` à direita da segunda coluna) — verificado empiricamente que isso produz um terceiro segmento da primeira linha, nunca uma quinta linha, nunca um alinhamento recorrente próprio. Com essa fixture, a cadeia real produz exatamente um grupo, uma página `detected`, uma região com as quatro linhas físicas, seis alinhamentos recorrentes — três tipos de alinhamento (`left_edge`, `right_edge` e `horizontal_center`) × duas colunas físicas aparentes —, toda linha `included_in_candidate_region`, métricas fechando em 4/4/0/0/0, zero problemas técnicos — provado em teste dedicado.

## 18. Guards

`architecture/budget-document-tabular-region-detection-boundaries.test.ts` (novo): barrel seletivo; nenhum vocabulário econômico/infraestrutura/score/confiança/ranking/topônimo em arquivo de produção; nenhuma leitura de `item.text`; nenhum import direto de `physical-document-read.types` ou `page-location`; seam de injeção de dependências nunca exportado; função pública com exatamente um parâmetro; entrada nunca mutada. Complementa, sem enfraquecer, `architecture/budget-document-location-boundaries.test.ts` (que já escaneia toda a subpasta `tabular-region-detection/`, proibindo `pdfjs`, `supabase`, `apps/web`).

## 19. Limitações

`candidate_region_is_not_a_confirmed_table`, `recurrent_alignment_is_not_a_column`, `no_physical_column_created`, `no_cell_created`, `no_header_identified`, `no_footer_identified`, `no_cross_page_continuity_evaluated`, `no_textual_semantics_applied`, `no_service_code_read`, `no_description_interpreted`, `no_unit_read`, `no_quantity_read`, `no_price_read`, `no_total_read`, `no_economic_bdi_interpreted`, `no_budget_line_created`, `no_budget_version_created`, `unresolved_structures_remain_explicit`, `real_document_out_of_scope`, `no_commercial_readiness_claim`.

### 19.1 Limitação conhecida: subdetecção conservadora com segmentos concorrentes na mesma linha (auditoria pós-revisão)

`vertical-alignment-observation.ts` permite no máximo um segmento por linha em cada cluster de alinhamento (§8) — quando uma linha tem múltiplos segmentos que seriam individualmente compatíveis com o mesmo cluster, a atribuição é canônica e determinística (ordem de posição, depois `lineVerticalOrder`, depois `horizontalOrder`, depois `segmentKey`), nunca ambígua ou dependente de ordem de descoberta. Isso é correto e necessário para determinismo, mas é conservador: quando múltiplos segmentos da mesma linha são compatíveis com agrupamentos concorrentes, a atribuição canônica local pode escolher uma combinação que impeça outro agrupamento de atingir o mínimo de linhas sustentando exigido pelo perfil (§9) — mesmo que uma atribuição alternativa, não escolhida, permitisse a esse outro agrupamento se formar. **Este é um comportamento conservador esperado, não uma falha desta Sprint.** Uma solução alternativa exigiria uma regra adicional de atribuição global (por exemplo, otimizar a atribuição de segmentos a clusters no nível da página, não localmente por candidato), busca combinatória controlada, ou outro mecanismo formal ainda não aprovado pelo enunciado — nenhuma dessas alternativas foi adotada nesta Sprint. O algoritmo não foi alterado nesta revisão; fica registrado como candidato a revisão em Sprint futura com corpus real, quando houver evidência concreta de que o cenário ocorre e de qual seria o mecanismo de atribuição global correto.

## 20. Fora do escopo

Reconhecimento de tabela confirmada; coluna física; célula; cabeçalho; rodapé; repetição de cabeçalho; continuidade entre páginas; código de serviço; descrição; unidade; quantidade; preço unitário; total; BDI; grupo econômico; linha da Versão do Orçamento; persistência; Supabase; storage; API; UI; IA; OCR; score; confiança; documento real.

## 21. Parâmetros não calibrados em documento real

Todos os valores do perfil (§7) são decisões de engenharia geométrica, nunca calibradas por documento real — nenhum documento real foi acessado por esta Sprint. `_local-documents/` nunca foi lido, listado ou referenciado.

## 22. Próxima etapa recomendada

Reconstrução auditável de faixas verticais e hipóteses de colunas físicas — nunca colunas econômicas (implementada na Sprint 21.4A.2.f.2b). Documento real: o Epic 21 já possui e utiliza documentos reais — a próxima etapa não depende de novo recebimento pelo usuário. Esta Sprint (f.2a), especificamente, não acessou nenhum documento real; toda calibração de parâmetros permanece pendente até o momento em que documentos reais forem efetivamente utilizados por uma Sprint autorizada a fazê-lo (correção documental registrada na auditoria arquitetural da Sprint 21.4A.2.f.2b).
