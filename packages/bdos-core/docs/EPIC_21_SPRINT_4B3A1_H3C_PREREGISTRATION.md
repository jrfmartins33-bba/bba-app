# Epic 21 — Sprint 21.4B.3A.1 — Pré-registro Declarativo de H3c

**Status: pré-registro, ANTES de qualquer função executável de H3c.** Este documento congela a definição exata da candidata H3c, suas evidências permitidas/proibidas, fórmulas, normalizações, fronteiras, comportamento degenerado e transformações de invariância — **nenhuma função que avalie H3c existe neste arquivo ou em qualquer arquivo até este commit**. Qualquer mudança de fórmula, evidência, normalização, constante, limiar, comportamento de fronteira ou classificação de saída após a execução invalida H3c por completo e exigiria novo identificador e novo pré-registro (§3 do enunciado desta Sprint) — não é permitido nesta Sprint.

## 0. Estado de partida

- Base: `aa63e1264c93a56e8c77b6d3aba8ade17979584c` (PR #78, incorporando a Sprint 21.4B.3A — veredito D, mantido, não reavaliado).
- Branch: `claude/epic-21-sprint-4b3a1-preregistered-h3c-real-experiment`.
- `f.2a`: `exercitada_em_caso_real` / `reprovada` / `failureAssessment: confirmed` — inalterado, não reavaliado nesta Sprint.

## 1. Nome e categoria inicial

**H3c — Envelope pareado de bordas em nível de página, corroborado por adjacência vertical de âncoras confiáveis.**

Categoria inicial: **A — evidência já disponível dentro da capacidade `f.2a`** (nenhuma extensão de contrato é usada na definição abaixo).

## 2. Evidências permitidas (§8.1 do enunciado)

Exclusivamente:

- `lineKey`, `verticalOrder` (contrato do helper);
- segmentos físicos já reconstruídos (`AlignmentCandidateSegment`: `leftPoints`, `rightPoints`, `lineHeightPoints`, `segmentKey`, `lineKey`);
- alinhamentos `left_edge` e `right_edge` (`VerticalAlignmentDraft`: `alignmentType`, `canonicalPositionPoints`, `members[].{lineKey,segmentKey,positionPoints}`) — **nunca `horizontal_center`**;
- janelas não conflitantes produzidas pela regra de produção atual (`formTabularRegionCandidateWindows`, inalterada, usada apenas para localizar âncoras);
- `profile.minimumRegionLineCount` e `profile.maximumAlignmentPositionDeviationToMinimumLineHeightRatio` — parâmetros já existentes em `tabular-region-detection-profile.ts` (`BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1`), reutilizados tal como estão, nunca redefinidos ou recalibrados por esta Sprint.

## 3. Evidências proibidas (§8.2 do enunciado)

Nunca usar: texto, tokens, palavras, códigos, descrições, valores, unidades, significado econômico, quantidade fixa de colunas, nome de coluna, posição absoluta específica das páginas 46-54, aprendizado estatístico, LLM, blocos físicos de `f.1` (`ReconstructedPhysicalTextBlock`), `H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO` (constante de H3/H3b), ou qualquer novo limiar numérico ajustável além do único parâmetro já existente reutilizado (§2).

## 4. Proprietário arquitetural

Toda a evidência usada por H3c é propriedade da própria capacidade `f.2a` (Sprint 21.4A.2.f.2a) — nenhuma evidência de `f.1` (blocos físicos) ou de qualquer capacidade externa é usada. H3c permanece, por definição, Categoria A.

## 5. Âncoras (§8.3 do enunciado)

Para cada `targetLineKey`, na página avaliada:

1. Excluir a linha-alvo de toda evidência que possa sustentá-la — nunca a linha-alvo sustenta sua própria decisão.
2. Executar `formTabularRegionCandidateWindows` (regra de produção atual, inalterada) somente para localizar janelas.
3. Considerar somente janelas não conflitantes (`conflicted === false`).
4. Para cada janela não conflitante: remover a linha-alvo de seu conjunto de linhas; a janela só "qualifica" quando o conjunto remanescente tem `>= profile.minimumRegionLineCount` linhas.
5. Formar:
   - `pageAnchorSet`: união, em toda a página, das linhas remanescentes (após excluir a linha-alvo) de TODAS as janelas qualificadas.
   - `adjacentAnchorSet`: subconjunto de `pageAnchorSet` cujas linhas têm `verticalOrder` exatamente igual a `targetVerticalOrder - 1` ou `targetVerticalOrder + 1` (imediatamente adjacentes à linha-alvo, acima ou abaixo).
6. Se `adjacentAnchorSet` estiver vazio, retornar `insufficient_evidence`.

## 6. Envelopes pareados (§8.4 do enunciado)

Para cada segmento pertencente a uma linha de `pageAnchorSet` (nunca da linha-alvo):

1. Localizar o `VerticalAlignmentDraft` de tipo `left_edge` cujo `members` inclui esse segmento (mesmo `lineKey` e `segmentKey`).
2. Localizar o `VerticalAlignmentDraft` de tipo `right_edge` cujo `members` inclui o MESMO segmento.
3. Se qualquer um dos dois não existir, o segmento não contribui para nenhum par.
4. Identidade canônica de um `VerticalAlignmentDraft`, para fins de agrupamento (nunca dependente de ordem de array ou de string de chave incidental): `alignmentType + ":" + lineKeys-dos-membros-ordenadas-lexicograficamente-e-concatenadas`.
5. Par determinístico: `(leftAlignmentIdentity, rightAlignmentIdentity)`.
6. Agrupar segmentos por par idêntico, em toda a página.
7. Excluir qualquer segmento cuja `lineKey` seja a linha-alvo.
8. Um grupo só forma um envelope quando tem `>= profile.minimumRegionLineCount` linhas distintas de suporte.
9. Calcular, sobre os segmentos do grupo:
   - `representativeLeftPoints` = mediana de `leftPoints`;
   - `representativeRightPoints` = mediana de `rightPoints`;
   - `representativeLineHeightPoints` = mediana de `lineHeightPoints`.
   - Mediana: número ímpar de valores → valor central da lista ordenada; número par → média dos dois valores centrais.
10. Descartar o envelope quando `representativeRightPoints - representativeLeftPoints <= 0` ou `representativeLineHeightPoints <= 0` (degenerado).
11. Um envelope só é ELEGÍVEL para a linha-alvo quando seu conjunto de linhas de suporte intersecta `adjacentAnchorSet`.

Canonicalização de desempate (nunca por ordem incidental de array), quando necessário para relatório/depuração: 1) posição esquerda; 2) posição direita; 3) identidade do alinhamento esquerdo; 4) identidade do alinhamento direito. A DECISÃO de H3c nunca depende dessa ordem (é definida por quantificadores existenciais/universais sobre o conjunto de envelopes elegíveis, nunca por um único envelope "escolhido").

## 7. Compatibilidade (§8.5 do enunciado)

Para cada segmento da linha-alvo, contra cada envelope elegível:

```text
normalizingHeight = min(targetLineHeightPoints, representativeLineHeightPoints)
tolerancePoints = profile.maximumAlignmentPositionDeviationToMinimumLineHeightRatio × normalizingHeight

leftAnchored        = abs(targetLeftPoints - representativeLeftPoints) <= tolerancePoints
rightAnchored       = abs(targetRightPoints - representativeRightPoints) <= tolerancePoints
containedFromLeft   = targetLeftPoints  >= representativeLeftPoints  - tolerancePoints
containedFromRight  = targetRightPoints <= representativeRightPoints + tolerancePoints

anchored  = (leftAnchored && containedFromRight) || (rightAnchored && containedFromLeft)
contained = containedFromLeft && containedFromRight
```

A fronteira `<=`/`>=` é sempre **inclusiva**.

## 8. Decisão final

```text
must_include  quando: (1) TODOS os segmentos da linha-alvo estão `contained` em PELO MENOS UM envelope elegível (podendo ser envelopes diferentes por segmento); E (2) PELO MENOS UM segmento está `anchored` em PELO MENOS UM envelope elegível.

must_exclude  quando há evidência suficiente (linha, segmentos, adjacentAnchorSet não vazio, ao menos um envelope elegível existe) mas a condição acima não é satisfeita.

insufficient_evidence quando: faltar a linha, faltarem segmentos da linha-alvo, `adjacentAnchorSet` estiver vazio, ou nenhum envelope elegível existir.
```

## 9. Matriz de resultados esperados

Reutiliza os rótulos já congelados da matriz sintética existente (`discovery-case-matrix.ts`, Sprint 21.4B.3A — 20 entradas, 19 geometrias distintas) e o manifesto real desta Sprint (`discovery-h3c-real-manifest.ts`, 670 entradas, **aprovado por Ricardo com as duas correções registradas em §13/§14** — 563 `must_include`, 106 `must_exclude`, 1 `uncertain`):

```text
rótulo pré-registrado (P/N sintético, ou humano real) must_include  → H3c deve retornar must_include
rótulo must_exclude  → H3c deve retornar must_exclude
rótulo uncertain (somente real)  → não pontuado (nem aprova nem reprova a candidata)
```

`insufficient_evidence` em qualquer caso com rótulo definitivo (`must_include`/`must_exclude`) conta como reprovação — nunca como neutro.

## 10. Transformações de invariância congeladas (§9.5 do enunciado)

Pré-registradas, a aplicar sobre casos sintéticos representativos (mínimo: um par positivo/adversarial):

1. Permutação reversa dos arrays de linhas/segmentos/alinhamentos.
2. Permutação canônica alternativa determinística (ex.: ordenar por `segmentKey` decrescente antes de avaliar).
3. Translação horizontal positiva (+1000pt) e negativa (-1000pt, com ajuste de página para manter coordenadas não-negativas onde a implementação exigir).
4. Escala uniforme `0.5×` e `3×`.
5. Fronteira do limiar de tolerância reutilizado (`maximumAlignmentPositionDeviationToMinimumLineHeightRatio = 0.5`, já existente, nunca recalibrado): sonda em `tolerancePoints - 1e-6`, exatamente em `tolerancePoints`, e `tolerancePoints + 1e-6`. O valor `1e-6` serve apenas para testar a fronteira do teste — nunca integra a fórmula produtiva ou a candidata.

A saída de H3c deve permanecer idêntica sob as transformações 1-4 (invariância genuína); o comportamento na fronteira (5) deve ser: abaixo do limiar apto a ancorar/conter, exatamente no limiar apto (inclusivo, `<=`/`>=`), acima do limiar inapto.

## 11. Comportamento degenerado obrigatoriamente testado

- Linha-alvo excluída de sua própria sustentação (nunca deve aparecer em `pageAnchorSet` ou em qualquer grupo de envelope).
- Altura de linha degenerada (`<= 0`) — `normalizingHeight` resultante `<= 0` deve levar a `tolerancePoints <= 0`, nunca a uma divisão por zero ou exceção.
- Segmento sem alinhamento `left_edge` correspondente.
- Segmento sem alinhamento `right_edge` correspondente.
- Segmento sem par esquerda-direita completo (nenhum envelope formado a partir dele).
- `adjacentAnchorSet` vazio (linha-alvo sem vizinho imediato qualificado, acima ou abaixo).

## 12. Categorias finais (reafirmação, sem redefinição — ver enunciado §11)

- **A**: todos os critérios do enunciado §11-A satisfeitos (sintético completo, adversariais, reais definitivos, sem falso positivo/negativo/evidência insuficiente em caso definitivo, invariâncias, apenas evidência de Categoria A, nenhuma mudança semântica pós-execução).
- **B**: não esperado para H3c (evidência já é Categoria A por definição, §4).
- **C**: exige prova completa de indistinguibilidade/insuficiência — a simples reprovação de H3c não basta.
- **D**: qualquer falha, falso positivo/negativo, evidência insuficiente em caso definitivo, cobertura obrigatória apenas por `uncertain`, falha de invariância, violação do pré-registro, ou necessidade de mudança semântica.

## 13. Correções da aprovação humana (Ricardo)

Antes desta seção, o manifesto tinha 562 `must_include` / 106 `must_exclude` / 2 `uncertain`. Ricardo aprovou o pré-registro com uma correção obrigatória e uma confirmação:

1. **`p54-v027` — "TOTAL GERAL (R$) 9.809.087,18"** reclassificado de `uncertain` para `must_include`. Justificativa de Ricardo, preservada literalmente: "A decisão é sobre pertencimento físico à grade tabular, não sobre a linha ser ou não um item de serviço. O total geral está na área da tabela e encerra sua estrutura; portanto, é uma linha tabular legítima." `coverageTags` alterado de `["other"]` para `["conventional_tabular_line"]`.
2. **`p52-v079`** ("08.00.00 INSTALAÇÕES ELÉTRICAS 337.938,47 _____...") mantido `uncertain`, com `rationalePt` explicitando que a linha física reconstruída funde um cabeçalho de grupo legítimo com um separador externo de assinatura, e que **no nível da linha física não existe rótulo binário verdadeiro**. `coverageTags` mantido `["insufficient_physical_evidence"]`.

**Totais congelados após a aprovação**: 563 `must_include`, 106 `must_exclude`, 1 `uncertain`, 670 no total — verificados automaticamente por `discovery-h3c-real-manifest.test.ts` (nunca transcritos à mão).

## 14. Tabela auditável das nove regras de anotação

Cada uma das 670 entradas preserva explicitamente `annotationRuleId`, identificando qual das nove regras abaixo originou a proposta do rótulo — proveniência auditável, nunca uma função reexecutável (o manifesto commitado é estático; ver §15).

| `annotationRuleId` | Descrição | Rótulo | Linhas | Páginas | Exemplo | Exceções manuais |
|---|---|---|---|---|---|---|
| `title_block` | Bloco de título institucional do documento (nome do órgão, encargos sociais, nome da obra, planilha/data-base) — repetido verbatim em todas as páginas. Verificado geometricamente: compartilha 1-4 alinhamentos reais de coluna por coincidência de margem (ex.: `right_edge@1148.0`, `left_edge@118.7`), mas nunca pertence à grade tabular. | `must_exclude` | 45 | 46-54 (5/página) | `"GOVERNO FEDERAL \| MINISTÉRIO DA INTEGRAÇÃO..."` | Nenhuma |
| `column_caption_header` | Cabeçalho interno de colunas da própria tabela (duas linhas nomeando cada coluna — "COL. FGV DESCRIÇÃO...", "CÓDIGO BDI..."). Contíguo com as linhas de item que seguem; compartilha 9-11 alinhamentos reais de coluna (verificado geometricamente) — pertence fisicamente à mesma grade tabular, mesmo sem conteúdo econômico próprio. | `must_include` | 18 | 46-54 (2/página) | `"COL. FGV DESCRIÇÃO ITEM FONTE DE PESQUISA..."` | Nenhuma |
| `group_header` | Linha de grupo/subgrupo (código hierárquico `NN.NN.NN` no início do texto) — parte legítima da hierarquia tabular. | `must_include` | 27 | 46,47,48,49,50,53,54 | `"01.01.00 Serviços Preliminares"` | Nenhuma |
| `item_row` | Linha de item completa — contém percentual de BDI (`\d{1,3},\d{2}%`) e padrão de colunas código/unidade/quantidade/preço/descrição/fonte. | `must_include` | 300 | 46-54 | `"85189 UNID 1,00 1.852,65 24,18% PORTAO EM TUBO..."` | Nenhuma |
| `continuation` | Fragmento de continuação de descrição de item — a linha estrutural imediatamente anterior (item ou grupo) termina gramaticalmente truncada (vírgula, palavra ou frase incompleta), retomada por este fragmento. Verificado manualmente nos casos de execução mais longa (4-8 linhas consecutivas, páginas 48-49) contra a linha anterior, confirmando truncamento genuíno. | `must_include` | 217 | 46-54 | `"CADEADO"`, bloco de 6 linhas da automação (p49) | Nenhuma |
| `citation_note_external` | Nota explicativa/citação normativa (Acórdão TCU) inserida entre linhas de item — parágrafo de prosa multi-sentença, gramaticalmente completo em si mesmo (a linha de item anterior, "ADM-LOC...ADMINISTRAÇÃO LOCAL", termina sem truncamento), nunca continuação de uma descrição de item. **Regra verificada quanto à existência de notas internas vs. externas**: apenas uma ocorrência existe no documento (páginas 46-54), inteiramente externa (nunca fisicamente parte da grade de colunas — parágrafo de largura plena, sem alinhamento com nenhuma coluna individual); nenhuma ocorrência de nota interna foi encontrada, portanto a regra não precisou ser desdobrada em duas. | `must_exclude` | 8 | 46 (apenas) | `"* Acórdão Nº 2622/2013 – TCU – Plenário:"` | Nenhuma |
| `footer` | Bloco de assinatura/rodapé (separador, "Orçamento elaborado por", nome, cargo, SIAPE, contador de página) — repetido verbatim em quase todas as páginas. Verificado geometricamente: a maioria das linhas compartilha `right_edge@1148.0` com uma coluna real (mesma margem direita da página), mas nunca pertence à grade tabular. | `must_exclude` | 53 | 46-54 (6/página, exceto p52: 5, pois o separador de p52 foi absorvido por `hybrid_merge_artifact`) | `"Eng. George Luiz Saraiva Pontes"` | 1 linha (separador de p52) tratada por `hybrid_merge_artifact`, não por esta regra |
| `hybrid_merge_artifact` | Artefato de reconstrução física: um cabeçalho de grupo/subtotal legítimo (`08.00.00 INSTALAÇÕES ELÉTRICAS 337.938,47`) funde-se, na mesma linha física, com o separador de assinatura da página seguinte. Evidência física da própria linha é ambígua — mantido `uncertain` por decisão humana explícita (Ricardo, §13). | `uncertain` | 1 | 52 (apenas) | `"08.00.00 INSTALAÇÕES ELÉTRICAS 337.938,47 _____..."` | Reclassificação manual confirmada — nunca `must_include`/`must_exclude` |
| `total_geral` | Linha de total geral do orçamento — decisão sobre pertencimento FÍSICO à grade tabular (está na área da tabela e encerra sua estrutura), nunca sobre a linha ser um item de serviço. Reclassificada de `uncertain` para `must_include` por decisão humana explícita (Ricardo, §13). | `must_include` | 1 | 54 (apenas) | `"TOTAL GERAL (R$) 9.809.087,18"` | Reclassificação manual confirmada (§13) |

**Reconciliação automática** (`discovery-h3c-real-manifest.test.ts`, teste "totais por annotationRuleId reconciliam..."): soma das 9 regras = 670; `must_include` = 18+27+300+217+1 = **563**; `must_exclude` = 45+8+53 = **106**; `uncertain` = 1 = **1**. Idêntico aos totais congelados em §13.

## 15. Registro da inspeção geométrica de rotulagem

Conforme exigido pela aprovação humana (Ricardo, condição 5):

- A inspeção geométrica (verificação de que `title_block`/`footer` coincidem com alinhamentos reais de coluna, e que `column_caption_header` compartilha 9-11 alinhamentos) foi usada **exclusivamente para auditoria humana dos rótulos propostos** — nunca para decidir automaticamente um rótulo.
- **Não executou H0, H1, H2, H3, H3b ou H3c** — usou apenas `buildAlignmentCandidateSegments`/`observeVerticalAlignments`, as mesmas primitivas geométricas que a própria capacidade `f.2a` de produção já usa internamente (nunca uma candidata de pertencimento).
- **Não produziu resultado de candidata** — nenhuma decisão `must_include`/`must_exclude`/`insufficient_evidence` de nenhuma candidata foi calculada.
- **Não alterou fórmula, normalizações, fronteiras ou evidências permitidas de H3c** — a definição em §2-§8 deste documento é transcrição literal do enunciado da Sprint 21.4B.3A.1 (seção 8), nunca modificada em decorrência da inspeção.
- Utilizou um script temporário (`scripts/zzz-scratch-adversarial-check.ts`), **descartado e nunca commitado** — confirmado por `git status --short` não listar esse caminho em nenhum momento desta Sprint.

**Cronologia de mudanças na definição declarativa de H3c**: nenhuma. A definição de H3c (§2-§8) foi transcrita do enunciado da Sprint 21.4B.3A.1 antes de qualquer inspeção geométrica ou classificação de linha real, e permanece idêntica desde então. A única mudança registrada nesta Sprint foi no MANIFESTO (rótulos propostos e, após aprovação, as duas correções de §13) — nunca na candidata H3c em si.

## 16. Manifesto estático — confirmação de design

O arquivo `discovery-h3c-real-manifest.ts` contém exclusivamente um array de objetos literais (`H3C_REAL_MANIFEST: ReadonlyArray<H3cRealManifestEntry>`) — nenhuma expressão regular, função de classificação ou lógica de recomputação existe nesse arquivo ou é executada durante a avaliação de H3c. As nove regras da tabela em §14 foram usadas apenas para GERAR este array antes do congelamento (script de geração descartado, não commitado — apenas o array resultante é versionado). O avaliador de H3c (Momento 2) consulta a expectativa congelada exclusivamente por `(realPageNumber, lineKey)`, nunca recalculando rótulos a partir de texto ou padrões.

Nenhuma função executável de H3c existe até este commit. A implementação ocorre somente no Momento 2, após aprovação humana explícita do manifesto (§9.6 do enunciado) — concedida por Ricardo com as correções de §13 aplicadas.

## 17. Correção de implementação divergente (Momento 2, durante o desenvolvimento — §3 do enunciado)

Ao implementar H3c pela primeira vez, o teste direcionado contra a matriz sintética (P1, P5-P8) reprovou incorretamente. Causa raiz identificada por depuração: o §6.4 acima especifica a identidade canônica de um `VerticalAlignmentDraft` para agrupamento como `alignmentType + ":" + lineKeys-dos-membros-ordenadas-e-concatenadas` — mas em qualquer tabela densa convencional, TODAS as colunas de uma mesma linha compartilham exatamente o mesmo conjunto de `lineKey` membros (cada linha tem um segmento em cada coluna), o que colapsa colunas fisicamente distintas na mesma identidade e impede a formação de envelopes pareados por coluna. Esta era uma divergência entre a implementação e a INTENÇÃO clara do próprio §6.4 ("para fins de agrupamento" — distinguir colunas, nunca colapsá-las), nunca uma mudança de fórmula, evidência, normalização, limiar ou classificação de saída.

**Correção aplicada** (antes de qualquer execução formal contra a matriz completa ou o manifesto real — apenas testes direcionados de desenvolvimento haviam rodado): a identidade passa a usar `segmentKey` dos membros (nunca `lineKey`), que é único por segmento físico e nunca coincide entre colunas diferentes, preservando a mesma propriedade de canonicalização (ordenado, nunca dependente de posição incidental de array). Após a correção, H3c passa 20/20 casos sintéticos.

Esta correção está em conformidade com o enunciado da Sprint 21.4B.3A.1 §3: "Uma correção depois da execução somente poderá reparar implementação divergente da especificação congelada" — nenhuma fórmula, evidência, normalização, constante, limiar, comportamento de fronteira ou classificação de saída foi alterada; apenas a representação interna de "identidade de coluna" foi corrigida para efetivamente distinguir colunas, conforme já era a intenção declarada do texto original.
