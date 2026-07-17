# Epic 21 — Sprint 21.4A.2.f.2b — Reconstrução Auditável de Hipóteses de Coluna Física

**Status: implementada.** Reconstrói, de forma pura e determinística, quais conjuntos recorrentes de segmentos físicos dentro de cada região candidata a estrutura tabular (Sprint 21.4A.2.f.2a) podem ser registrados como hipóteses auditáveis de coluna física. Não identifica código, descrição, unidade, quantidade, preço, total, BDI, cabeçalho, célula ou continuidade entre páginas. Não usa LLM, IA, OCR, heurística probabilística, score, confiança estatística, ranking ou tolerância numérica de fusão. Não persiste, não expõe API, não tem interface.

## 1. Objetivo

Responder apenas: "dentro de cada região candidata a estrutura tabular, quais conjuntos recorrentes de segmentos físicos podem ser registrados como hipóteses auditáveis de colunas físicas?" — nunca "qual coluna é código, descrição, unidade, quantidade, preço, total ou BDI?".

## 2. Posição na cadeia

Base: `34b2967746c0def7653756e9c309ea67a4178772` (merge do PR #70, encerramento da Sprint 21.4A.2.f.2a). Cadeia consolidada: leitura física → geometria normalizada por item → observação de sinais → localização e grupos candidatos → reconstrução estrutural física (f.2a.1) → detecção de regiões candidatas (f.2a.2) → **reconstrução de hipóteses de coluna física (esta Sprint)**.

Fronteira preservada: leitura física ≠ observação de sinais ≠ localização de páginas ≠ estrutura física reconstruída ≠ região candidata a estrutura tabular ≠ **faixa vertical física** ≠ **hipótese de coluna física** ≠ célula física ≠ interpretação econômica ≠ Versão do Orçamento.

## 3. Contratos consumidos — Alternativa B

```ts
interface BudgetDocumentPhysicalColumnHypothesisReconstructionInput {
  readonly structureReconstruction: BudgetDocumentStructureReconstructionResult;
  readonly tabularRegionDetection: BudgetDocumentTabularRegionDetectionResult;
}
```

`structureReconstruction` é a fonte de verdade de toda geometria de linha/segmento (bounds completos, lacunas internas). `tabularRegionDetection` é a fonte de verdade de quais linhas formam quais regiões e quais alinhamentos verticais já recorrem. Nenhuma geometria é duplicada — a reconstrução lê os segmentos diretamente de `structureReconstruction`, nunca reconstrói bounds a partir de posições parciais da f.2a. A Alternativa A (consumir apenas `tabularRegionDetection`) foi descartada por fato de código, não preferência: `RecurrentVerticalAlignment` expõe apenas a posição do próprio tipo de alinhamento por segmento (`observedPositionsPoints`), nunca o bound completo, e nunca referencia segmentos que pertencem à região mas não sustentam nenhum alinhamento.

## 4. Achado de auditoria: chaves de "referência" da f.2a não são referências literais

Confirmado diretamente no código (`detect-budget-document-tabular-regions.ts:411-419`): `TabularRegionDetectionGroup.groupReconstructionKey` e `TabularRegionDetectionPage.pageReconstructionKey` são chaves **próprias** da f.2a.2 (`computeGroupProcessedKey`/`computePageProcessedKey`, semeadas pela identidade de detecção), **nunca** cópias das chaves homônimas de `structureReconstruction` (f.2a.1) — apesar do nome do campo sugerir uma referência literal. Os campos comentários de `budget-document-tabular-region-detection.types.ts` foram corrigidos nesta Sprint para refletir isso (§17). O identificador estável entre as três camadas (localização → f.2a.1 → f.2a.2) é `sourceCandidateGroupKey` (grupo) e `pageNumber` (página) — são esses, não `groupReconstructionKey`/`pageReconstructionKey`, que esta Sprint usa para casar um `TabularRegionDetectionGroup`/`Page` com o `ReconstructedBudgetDocumentGroup`/`Page` correspondente.

Esta Sprint evita repetir a ambiguidade: suas próprias chaves são nomeadas `groupProcessedKey`/`pageProcessedKey`/`regionProcessedKey` — nunca sugerindo ser uma referência literal à origem. A referência literal vive em campos separados: `sourceCandidateGroupKey` e `sourceRegionKey`.

## 5. Validação de linhagem

`physical-column-hypothesis-reconstruction-input-validation.ts` valida, sem nunca corrigir: os dois contratos suportados (portão de `structureReconstruction` reaproveitado diretamente da f.2a, `findCompatibleStructureReconstructionContract`, importado por caminho relativo direto — nunca duplicado; portão de `tabularRegionDetection` novo desta Sprint); `status !== "failed"` em ambos; **igualdade direta de campo** (nunca recomputação de hash — a Sprint recebe os dois objetos de origem diretamente, então compara os valores reais) entre `structureReconstruction` e os campos `source*` que `tabularRegionDetection` alega ter recebido (`sourceByteHash`, identidades do reconstrutor/perfil/fingerprint); e referências cruzadas — todo grupo/página/região/alinhamento/segmento que `tabularRegionDetection` referencia deve resolver de fato em `structureReconstruction`.

## 6. Faixa Vertical Física (interna)

`physical-vertical-band-construction.ts`. Tipo exclusivamente interno, nunca exportado pelo barrel público. Nasce de exatamente um `RecurrentVerticalAlignment` da f.2a cujas `lineKeys` pertencem inteiramente à região sendo processada — alinhamentos parcialmente contidos são rejeitados (nunca vazam linhas de outra região). Os limites são a união real (`min`/`max`) dos bounds completos dos segmentos que já sustentam aquele alinhamento, reaproveitados de `structureReconstruction` — nunca posição sintética, nunca absorção de segmentos órfãos.

## 7. Hipótese de Coluna Física (pública)

`physical-column-hypothesis-formation.ts`. Consolida faixas por **assinatura física exatamente idêntica** — a sequência ordenada exata de pares `(lineKey, segmentKey)`, herdada da ordem vertical já produzida pela f.2a. Decisão vinculante desta Sprint: **nenhuma tolerância numérica de fusão** — nunca por `lineKeys` em comum, proximidade, posição canônica, envelope semelhante, sobreposição parcial, distância ou tipo de alinhamento preferencial. Duas faixas de tipos de alinhamento diferentes (`left_edge`/`right_edge`/`horizontal_center`) com a mesma assinatura exata são o mesmo conjunto físico e consolidam numa única hipótese, referenciando todos os alinhamentos-semente contribuintes. Um único alinhamento recorrente pode sustentar uma hipótese sozinho — nunca é exigido dois tipos.

## 8. Conflito e ambiguidade

Candidatas de assinatura diferente são marcadas conflitantes quando: (a) compartilham ao menos um segmento; ou (b) seus envelopes apresentam sobreposição horizontal estritamente positiva (limites apenas encostados nunca contam como sobreposição). Nenhuma candidata conflitante se torna hipótese válida — a invalidação é da candidata inteira, nunca apenas do trecho literalmente disputado. Segmentos afetados recebem `unresolved_physical_column_hypothesis_ambiguity` com `conflictingCandidateHypothesisKeys` — as chaves determinísticas de todas as candidatas conflitantes, computadas mesmo para candidatas rejeitadas (nunca aparecem em `hypotheses[]`, mas permanecem auditáveis).

## 9. Segmentos órfãos

Segmentos das linhas incluídas na região que não participam de nenhum alinhamento recorrente qualificado: nunca absorvidos, nunca descartados, nunca tratados como erro ou célula vazia — recebem `not_in_physical_column_hypothesis`. Absorção por contenção, interseção ou proximidade está fora desta versão (limitação `orphan_segments_never_absorbed_by_contention_or_proximity`), dependente de evidência real futura.

## 10. Conservação por segmento

Conservado: todo segmento de toda linha `included_in_candidate_region` da região de origem (nunca linhas fora de região confirmada). Cada segmento termina em exatamente uma disposição (`PhysicalColumnHypothesisSegmentDisposition`): `included_in_physical_column_hypothesis`, `not_in_physical_column_hypothesis`, `unresolved_physical_column_hypothesis_ambiguity` ou `unresolved_physical_column_hypothesis_detection_failed`. `computeRegionMetrics` usa `switch` exaustivo com `assertUnreachableDisposition(value: never)`. O orquestrador verifica explicitamente que a soma das quatro contagens fecha exatamente com `totalSegmentCount`; se não fechar, a região é declarada `region_not_processable` com `physical_column_hypothesis_conservation_failed`.

## 11. Fingerprint

Duas camadas, mesmo padrão da f.2a: **identidade de reconstrução** (interna, semeia as chaves, incorpora as identidades das duas etapas consumidas e as próprias identidades desta Sprint — nunca conteúdo) e **fingerprint final exposto** (`reconstructionContextFingerprint`, incorpora a identidade *e* o conteúdo canônico dos grupos processados).

## 12. Perfil

`BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_PROFILE_V1` (`profileId="budget-document-physical-column-hypothesis-reconstruction-profile-v1"`, `profileVersion=1`). Ao contrário das duas Sprints anteriores, **não declara nenhuma razão numérica de tolerância** — apenas identidades e invariantes fixas (`requireExactSignatureEquality: true`, `forbidPhysicalColumnHypothesisOverlap: true`, `alignmentTypePriorityOrder` — usada apenas para ordenação/serialização determinística, nunca para escolher hipótese vencedora, resolver sobreposição ou atribuir maior valor probatório a um tipo).

## 13. Estados

Região: `hypotheses_reconstructed | hypotheses_reconstructed_with_ambiguity | no_physical_column_hypothesis | region_not_processable`. `no_physical_column_hypothesis` = processamento concluído, nenhuma hipótese e nenhuma ambiguidade (distinto de falha). Página/grupo: agregação `every`/`no`/`mixed` sobre suas regiões/páginas, mesmo padrão das Sprints anteriores. Global: `completed | completed_with_problems | failed` — `failed` apenas para incompatibilidade de contrato/linhagem pré-processamento ou exceção inesperada.

## 14. Problemas técnicos

Catálogo central em português (`physical-column-hypothesis-reconstruction-technical-problem.ts`, não exportado pelo barrel), 11 códigos: `source_contract_version_unsupported`, `source_lineage_mismatch`, `source_fingerprint_invalid`, `source_structure_reconstruction_contract_invalid`, `source_tabular_region_detection_contract_invalid`, `source_reference_invalid`, `physical_vertical_band_construction_failed`, `physical_column_hypothesis_formation_failed`, `physical_column_hypothesis_overlap_detected`, `physical_column_hypothesis_conservation_failed`, `physical_column_hypothesis_reconstruction_failed`.

## 15. Determinismo e imutabilidade

Mesma entrada, perfil e versões produzem resultado JSON-equivalente. Independência de permutação testada em três níveis: construção de faixa, formação de hipótese e pipeline completo. Entrada nunca mutada (testado com `Object.freeze`).

## 16. Testes

Matriz cobrindo positivos (hipótese sustentada por `left_edge`/`right_edge`/`horizontal_center` isoladamente, consolidação de três tipos com assinatura idêntica, duas colunas com os mesmos `lineKeys` mas `segmentKeys` diferentes permanecendo separadas, coluna presente em apenas parte das linhas sem inventar célula, segmento órfão preservado, duas regiões independentes), determinismo/permutação, conservação, adversariais (assinaturas parcialmente sobrepostas, segmento compartilhado entre concorrentes, sobreposição de envelope, limites apenas encostados nunca contam), falha controlada (construção de faixa, formação de hipótese, ambiguidade manufaturada via injeção de dependência) e cadeia real com PDF sintético (`infrastructure/budget-document-location/pdfjs/reconstruct-budget-document-physical-column-hypotheses.real-pdf-chain.test.ts`) — prova positiva: um grupo, uma página `hypotheses_reconstructed`, uma região com duas hipóteses de quatro linhas cada, oito segmentos de tabela incluídos, um segmento órfão (o item "BDI" necessário para classificação real) preservado como não incluído, zero ambiguidade, zero problemas técnicos.

## 17. Correções documentais realizadas nesta Sprint

- `EPIC_21_SPRINT_4A2F2A_AUDITABLE_TABULAR_REGION_DETECTION.md`, §22: removida a afirmação desatualizada de que a continuidade depende de novo recebimento de documentos reais — o Epic 21 já possui e utiliza documentos reais; apenas a f.2a, especificamente, não os acessou.
- `budget-document-tabular-region-detection.types.ts`: comentários de `groupReconstructionKey`/`pageReconstructionKey` corrigidos para esclarecer que são chaves processadas da própria f.2a, nunca referências literais à reconstrução de origem (§4 acima). Nenhum campo renomeado, nenhum comportamento alterado.

## 18. Guards

`architecture/budget-document-physical-column-hypothesis-reconstruction-boundaries.test.ts` (novo): barrel seletivo; nenhum vocabulário econômico/infraestrutura/score/confiança/ranking/topônimo; nenhuma leitura de `item.text`; nenhum import direto de `physical-document-read.types` ou `page-location` (apenas os contratos das duas Sprints consumidas); seam de injeção de dependências nunca exportado; função pública com exatamente um parâmetro; entrada nunca mutada.

## 19. Limitações

`physical_column_hypothesis_is_not_a_confirmed_column`, `physical_column_hypothesis_is_not_a_cell`, `no_header_identified`, `no_footer_identified`, `no_cross_page_continuity_evaluated`, `no_textual_semantics_applied`, `no_service_code_read`, `no_description_interpreted`, `no_unit_read`, `no_quantity_read`, `no_price_read`, `no_total_read`, `no_economic_bdi_interpreted`, `no_budget_line_created`, `no_budget_version_created`, `no_numeric_fusion_tolerance_applied`, `orphan_segments_never_absorbed_by_contention_or_proximity`, `unresolved_structures_remain_explicit`, `real_document_out_of_scope`, `no_commercial_readiness_claim`.

## 20. Fora do escopo

Coluna econômica confirmada; célula; cabeçalho; rodapé; continuidade entre páginas; código de serviço; descrição; unidade; quantidade; preço; total; BDI econômico; grupo econômico; Versão do Orçamento; tolerância numérica de fusão (decisão vinculante desta versão); absorção de segmento órfão por contenção/proximidade; persistência; Supabase; storage; API; UI; IA; OCR; score; confiança; documento real.

## 21. Próxima etapa recomendada

Formação de malha (interseção de faixas horizontais com as linhas já existentes) e hipóteses de célula física — ainda sem significado econômico. O Epic 21 já possui e utiliza documentos reais; a execução controlada sobre documento real permanece condicionada a uma frente de validação visual posterior, nunca a esta Sprint.
