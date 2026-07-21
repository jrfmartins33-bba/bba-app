# Epic 21 — Sprint 21.4B.3A — Pré-registro da Descoberta Arquitetural da Invariante Segura de Pertencimento à Grade Tabular

**Status: pré-registro, ANTES de qualquer experimento candidato.** Este documento congela a pergunta, a evidência permitida/proibida, as hipóteses candidatas e os critérios de aceitação/rejeição antes de qualquer algoritmo candidato ser executado. Qualquer alteração posterior a este pré-registro deve ocorrer em novo commit, explicar a necessidade e invalidar resultados já obtidos sob o critério anterior.

Esta é uma Sprint exclusivamente de **descoberta arquitetural**. Nenhum código de produção é alterado. Nenhum portão produtivo é aberto. `f.2a` permanece `exercitada_em_caso_real` / `reprovada` / `failureAssessment: confirmed` ao final desta Sprint, independentemente do resultado da descoberta.

## 0. Estado de partida (verificado por inspeção direta, nunca presumido)

- Base: `4cb22dcfc5ae6d6cb3648e38299739e169c66bbf` (merge do PR #77, Sprint 21.4G).
- Branch: `claude/epic-21-sprint-4b3a-tabular-membership-invariant-discovery`.
- `f.2a` (`packages/bdos-core/src/architecture/real-validation-governance/capability-maturity-registry.ts`, registro `f2a-tabular-region-detection`): `currentLevel: "exercitada_em_caso_real"`, `currentResult: "reprovada"`, `failureAssessment: "confirmed"` — confirmado por leitura direta do arquivo nesta Sprint, não presumido do enunciado.
- Arquivo central: `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/tabular-region-formation.ts`, regra `tabular-region-maximal-shared-alignment-window-v1`.
- Documento real: Pregão Eletrônico 90006/2025 — DNOCS — Lagoa do Arroz, arquivo `05_Anexo_Tecnico_Termo_Referencia.pdf` em `_local-documents/epic-21/lagoa-do-arroz/01_Origem_Edital/`. SHA-256 computado nesta Sprint via `sha256sum`:
  ```
  5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5
  ```
  Idêntico ao fingerprint exigido no enunciado da Sprint e ao valor registrado em `MANIFESTO_SHA256.csv` (linha `01_Origem_Edital/05_Anexo_Tecnico_Termo_Referencia.pdf`). **Documento real confirmado disponível e íntegro — a parte real desta Sprint NÃO está bloqueada.** O arquivo não será commitado (já fora do controle de versão, fora de `src/`).

## 1. Pergunta arquitetural

> Existe uma invariante física, determinística, auditável e generalizável capaz de distinguir linhas esparsas que pertencem legitimamente à mesma grade tabular de elementos externos coincidentemente próximos ou alinhados?

## 2. Mapa exato das evidências observáveis

Construído por inspeção direta do código-fonte (nunca por inferência), rastreando a cadeia real de chamadas em `detect-budget-document-tabular-regions.ts`.

### 2.1 Contrato do helper atual (`formTabularRegionCandidateWindows`, `tabular-region-formation.ts`)

O orquestrador (`detectPage`, linhas 239-246 de `detect-budget-document-tabular-regions.ts`) chama o helper com exatamente:

```ts
formRegions(
  physicalPage.lines.map((line) => ({ lineKey: line.lineKey, verticalOrder: line.verticalOrder })),
  alignmentDrafts.map((draft) => ({
    alignmentKey: computeAlignmentKey(...),
    lineKeys: draft.members.map((member) => member.segmentKey /* via member.lineKey */),
  })),
  PROFILE,
)
```

Evidência que **efetivamente chega ao helper**, por linha:
- `lineKey` (identidade opaca);
- `verticalOrder` (posição vertical densa, 1-based);
- pertencimento a cada `alignmentKey` (associação linha↔alinhamento, sem posição, sem largura, sem tipo geométrico explícito por linha — o tipo (`left_edge`/`right_edge`/`horizontal_center`) existe apenas implicitamente, jamais repassado).

**Nunca chega ao helper**: geometria de qualquer linha ou segmento (`leftPoints`, `topPoints`, `rightPoints`, `bottomPoints`, `heightPoints`, `centerXPoints`, `centerYPoints`), posição canônica do alinhamento (`canonicalPositionPoints`), posições observadas por membro (`observedPositionsPoints`), quantidade ou identidade de segmentos por linha, blocos físicos bidimensionais.

### 2.2 Evidência disponível na capacidade `f.2a`, mas não encaminhada ao helper (confirmado diretamente no código)

Dentro de `detectPage` (mesmo arquivo), antes da chamada ao helper, já existem em escopo:

- `candidateSegments: ReadonlyArray<AlignmentCandidateSegment>` (`vertical-alignment-observation.ts`) — por segmento: `leftPoints`, `rightPoints`, `centerXPoints`, `lineHeightPoints`, `horizontalOrder`, `lineVerticalOrder`. Construído por `buildAlignmentCandidateSegments(physicalPage.lines, physicalPage.segments)`.
- `alignmentDrafts: ReadonlyArray<VerticalAlignmentDraft>` — por alinhamento: `alignmentType`, `canonicalPositionPoints`, e por membro `{ lineKey, segmentKey, positionPoints }`. Toda essa riqueza é descartada na linha 241-244, reduzida a `{ alignmentKey, lineKeys }` antes de chegar ao helper.
- `physicalPage.lines[].{leftPoints,topPoints,rightPoints,bottomPoints,widthPoints,heightPoints,centerXPoints,centerYPoints}` — usadas em `buildRegion` (linha 134-168, **depois** da formação de janelas, apenas para calcular os limites da região já confirmada) — nunca antes, nunca como insumo de decisão de pertencimento.
- `physicalPage.segments` (via `structureReconstruction`) — geometria por segmento, mesma fonte de `candidateSegments`.

**Conclusão da §8/prova de indistinguishability abaixo**: toda essa evidência já está fisicamente presente dentro do escopo de execução da própria função `detectPage` da capacidade `f.2a` — nenhuma dela exige uma nova capacidade upstream. Se uma invariante segura usar exclusivamente esta evidência (sem estender o tipo de entrada do helper, ou estendendo apenas a assinatura interna do helper com dados que a capacidade já calcula), ela se qualifica como Categoria A (§6 do enunciado da Sprint).

### 2.3 Evidência disponível somente upstream, em `f.1` (`structure-reconstruction`), e que só chega à capacidade `f.2a` por inteiro, nunca extraída pelo helper

Confirmado diretamente em `budget-document-structure-reconstruction.types.ts` e `physical-text-block-reconstruction.ts`:

- `ReconstructedBudgetDocumentPage.blocks: ReadonlyArray<ReconstructedPhysicalTextBlock>` — **blocos físicos bidimensionais**, já reconstruídos por `reconstructPhysicalTextBlocks` (regra `physical-block-mutual-adjacency-v1`) via adjacência mútua entre segmentos de linhas fisicamente consecutivas (sobreposição/lacuna horizontal normalizada pela altura mediana do segmento; lacuna vertical normalizada pela altura mediana da linha — perfil: `maximumBlockVerticalGapToMedianLineHeightRatio=1.5`, `minimumBlockHorizontalOverlapRatio=0.3`, `maximumBlockHorizontalGapToMedianSegmentHeightRatio=3.0`). Puramente geométrico, sem significado econômico, e **já está presente inteiro dentro de `BudgetDocumentTabularRegionDetectionInput.structureReconstruction`** — ou seja, tecnicamente já está "no contrato da capacidade f.2a" (é o próprio input da função pública `detectBudgetDocumentTabularRegions`), mas **nenhuma linha do código de `f.2a` lê `physicalPage.blocks`** — nem o orquestrador, nem o helper, nem a saída (`TabularRegionDetectionPage` não expõe blocos). Confirmado por `grep` no arquivo: nenhuma ocorrência de `.blocks` em `detect-budget-document-tabular-regions.ts` fora dos tipos importados.

Classificação desta evidência: está no limite entre "disponível na capacidade" (já está no objeto de entrada) e "disponível somente upstream" (é produzida e teria seu significado geométrico definido inteiramente pela Sprint 21.4A.2.f.1, `physical-text-block-reconstruction.ts` — proprietário arquitetural: **f.1**, não f.2a). Tratamento adotado nesta Sprint: qualquer hipótese que utilize `blocks` é classificada como Categoria B (extensão mínima e formal do contrato de entrada do **helper**, consumindo evidência cujo proprietário — f.1 — já a preserva e entrega por inteiro; f.2a apenas passaria a lê-la e reencaminhá-la, sem calculá-la de novo e sem introduzir significado econômico).

### 2.4 Evidência inexistente (não computada por nenhuma capacidade hoje)

- Qualquer noção de "coluna econômica", "célula", "cabeçalho", "rodapé", "item lógico", "descrição", "unidade", "quantidade", "preço", "total", "código de serviço" — nunca calculada por f.0-f.2a, nunca usada nesta Sprint.
- Envelope/intervalo físico explícito de uma "grade de colunas" como objeto de primeira classe — não existe hoje; `canonicalPositionPoints` de um alinhamento é um ponto, nunca um intervalo. Um intervalo de coluna teria que ser **derivado** nesta Sprint a partir de dados já existentes (posições de segmentos que sustentam um alinhamento) — permitido como hipótese candidata (H3), desde que dentro da evidência já mapeada em §2.2/§2.3, nunca inventando uma nova fonte de dados.

## 3. Evidências permitidas e proibidas

### Permitidas (qualquer candidata só pode usar isto)

- `lineKey`, `verticalOrder` (§2.1);
- pertencimento linha↔alinhamento (`alignmentKey`, §2.1);
- tipo de alinhamento (`left_edge`/`right_edge`/`horizontal_center`), posição canônica, posições observadas por membro, geometria de segmento e de linha (§2.2 — Categoria A se usada dentro do escopo já calculado por `detectPage`, mesmo que hoje descartada antes do helper);
- blocos físicos bidimensionais (`ReconstructedPhysicalTextBlock`, §2.3 — Categoria B, propriedade de f.1);
- transformações puramente geométricas/topológicas destes dados (razões normalizadas por altura de linha, contagem de vizinhos, componentes de grafo, envelopes derivados).

### Proibidas (rejeição automática de qualquer candidata que dependa disso)

- conteúdo textual de qualquer segmento ou linha;
- significado econômico (código, descrição, unidade, quantidade, preço, total, BDI);
- coordenada absoluta fixa de uma página específica;
- quantidade fixa de colunas ou nome de coluna;
- qualquer limiar não normalizado por uma medida estrutural (altura de linha, largura de página/segmento) e não testado nas fronteiras (abaixo/no limite/acima), sob escala e sob translação (§13 do enunciado).

## 4. Hipóteses candidatas pré-registradas

- **H0 — insuficiência da evidência atual.** Hipótese nula: sob a evidência do helper atual (§2.1), casos com rótulo esperado oposto produzem a mesma representação canônica. Já parcialmente demonstrada por evidência pré-existente (Casos F vs. J da Sprint 21.4B.1, Casos L1/L4 vs. L7 da Sprint 21.4B.2 — ver §5) — esta Sprint reproduz essas provas de forma executável e as estende à representação canônica formal definida em §5.
- **H1 — sustentação por linhas-âncora e compatibilidade horizontal.** Uma linha esparsa pertence à região quando está topologicamente entre linhas-âncora tabulares confirmadas e sua extensão horizontal (do único segmento presente, ou da envoltória de segmentos) é compatível — por **largura comparável**, não apenas sobreposição — com uma ou mais colunas físicas já sustentadas pelas âncoras, sem violar nenhuma fronteira explícita.
- **H2 — grafo de incidência linha × alinhamento.** Representa linhas e alinhamentos como grafo bipartido; investiga se um componente conexo (ou uma noção de "ponte esparsa" dentro do componente âncora) preserva linhas esparsas legítimas sem absorver conteúdo externo, usando apenas pertencimento a alinhamentos (sem largura).
- **H3 — envelope de coluna derivado de âncoras estáveis.** Deriva, para cada alinhamento sustentado por ≥ `minimumLinesSustainingAlignment` linhas-âncora não conflitantes, um intervalo físico de largura (não um ponto) a partir das posições e larguras observadas dos segmentos-membro; uma linha esparsa pertence quando seu(s) segmento(s) é(são) compatível(is) em posição **e em largura relativa** com esse envelope — nunca apenas por conter/tocar o envelope.
- **H4 — extensão mínima de contrato via blocos físicos (f.1).** Uma linha esparsa pertence quando compartilha componente de bloco físico bidimensional (`ReconstructedPhysicalTextBlock`, §2.3) com ao menos uma linha-âncora da janela — investigada explicitamente como candidata de Categoria B, nunca implementada em produção nesta Sprint.

Nenhuma hipótese é presumida vencedora antes da execução. Em particular, H1 e H3 são deliberadamente próximas (compatibilidade horizontal vs. envelope de largura) porque a Sprint 21.4B.2 já demonstrou que compatibilidade por **sobreposição/subset de alinhamento** (sem largura) absorve incorretamente o Caso L7 — a diferença central a testar é se adicionar **largura relativa** (H3) resolve o que sobreposição pura (H1 fraco) não resolveu.

## 5. Prova de indistinguibilidade — primeira verificação obrigatória (executada nesta Sprint, ver `discovery-indistinguishability-proof.test.ts`)

Representação canônica da evidência do helper para uma janela de linhas: sequência ordenada por `verticalOrder` relativo (0-based dentro da janela) de conjuntos de `(alignmentType-índice-canônico)`, onde cada alinhamento é identificado não pela sua `alignmentKey` literal (que muda por fixture) mas pelo **conjunto ordenado de posições relativas de linha que ele cobre** — isso torna a representação independente de nomes de chave e comparável entre fixtures diferentes.

Pares de casos com rótulo esperado oposto e testados quanto à igualdade dessa representação:

1. **Caso F (positivo: linha esparsa legítima, apenas descrição, espaçamento vertical normal) vs. Caso J (negativo: parágrafo externo cuja borda esquerda coincide por acidente com a coluna ITEM, mesmo espaçamento normal)** — atribuição: reconstruído nesta Sprint a partir da descrição de `dense-table-region-diagnosis-fixtures.ts`, commit `0e7fc0883f73b4f9fb868173d773e434b5362606` (Sprint 21.4B.1). Ambos os casos, na posição da linha em questão, sustentam exatamente 1 alinhamento (borda esquerda da coluna ITEM/DESCRICAO) e nenhum outro — mesma assinatura.
2. **Caso L1/L4 (positivo: continuação apertada de descrição) vs. Caso L7 (negativo, ADVERSARIAL: parágrafo externo apertado, largura ampla, borda esquerda coincidente com ITEM)** — atribuição: reconstruído nesta Sprint a partir de `multiline-cell-continuity-fixtures.ts`, commit `13257242e38273c3a816db2619f847112c466794` (Sprint 21.4B.2). Mesma assinatura de alinhamento sob evidência mínima de intervalo normalizado + subconjunto de alinhamentos (conforme já documentado no comentário de módulo daquela Sprint).

Se a igualdade se confirmar por execução real (não apenas por leitura do comentário histórico), isso prova formalmente que **nenhuma função determinística limitada ao contrato atual do helper** (§2.1) pode distinguir os dois grupos — H0 confirmada no nível do helper. A pergunta seguinte (não pressuposta) é se a mesma igualdade se mantém quando a representação canônica é enriquecida com a evidência de §2.2 (largura/posição de segmento) — se a igualdade se desfizer nesse nível, H0 é refutada no nível da capacidade completa, e H1/H3 tornam-se candidatas viáveis (Categoria A). Se a igualdade persistir mesmo em nível de capacidade completa, apenas H4 (Categoria B, blocos de f.1) permanece como candidata, e a ausência de solução em qualquer nível leva a C.

## 6. Casos positivos obrigatórios (matriz `discovery-case-matrix.ts`)

| id | descrição | atribuição |
|---|---|---|
| P1 | região densa convencional (controle) | reconstrução do Caso A, commit `0e7fc088` |
| P2 | uma continuação esparsa legítima | reconstrução do Caso L1, commit `1325724` |
| P3 | duas continuações esparsas consecutivas | reconstrução do Caso L2, commit `1325724` |
| P4 | três continuações esparsas consecutivas | reconstrução do Caso L3, commit `1325724` |
| P5 | linha legítima de grupo/subgrupo, poucas colunas | reconstrução do Caso K (cabeçalho interno esparso), commit `0e7fc088`, reaproveitada como proxy de linha de grupo |
| P6 | cabeçalho interno pertencente à tabela | Caso K, commit `0e7fc088` |
| P7 | subtotal/total com subconjunto de colunas | novo — construído nesta Sprint |
| P8 | duas linhas tabulares completas muito próximas | reconstrução do Caso L10, commit `1325724` |
| P9 | linha esparsa no início da região, sustentada | reconstrução do Caso L11 com evidência suficiente redesenhada — novo (L11 original é negativo; P9 é sua contraparte positiva construída nesta Sprint) |
| P10 | linha esparsa no fim da região, sustentada | reconstrução do Caso L12 com evidência suficiente redesenhada — novo (mesma observação de P9) |

## 7. Casos negativos obrigatórios

| id | descrição | atribuição |
|---|---|---|
| N1 | parágrafo externo, espaçamento normal | reconstrução do Caso L6, commit `1325724` |
| N2 | parágrafo externo, espaçamento apertado | reconstrução do Caso L7 (ADVERSARIAL), commit `1325724` |
| N3 | título externo apertado | reconstrução do Caso L8, commit `1325724` |
| N4 | nota lateral apertada | reconstrução do Caso L9, commit `1325724` |
| N5 | rodapé/observação externa | reconstrução do Caso L12 original (linha apertada após fim da tabela), commit `1325724` |
| N6 | linha separadora entre duas tabelas | reconstrução do Caso H, commit `0e7fc088` |
| N7 | conteúdo externo dentro do envelope horizontal geral | novo — construído nesta Sprint (largura plena, mas sem alinhamento com nenhuma coluna individual) |
| N8 | conteúdo externo coincidindo com borda de coluna | reconstrução do Caso J, commit `0e7fc088` |
| N9 | múltiplas linhas externas repetidas formando alinhamento privado | reconstrução do Caso L3 original interpretado como negativo (três parágrafos externos idênticos, não continuações) — novo, construído nesta Sprint com atribuição explícita à observação de L3 |
| N10 | elemento largo entre duas regiões independentes | reconstrução do Caso H, commit `0e7fc088` (mesmo caso de N6, papel duplo documentado) |

## 8. Adversariais preservados

Caso J, Caso L3, Caso L7, controles L1-L12 relevantes — todos reconstruídos nesta Sprint em `discovery-case-matrix.ts` com atribuição de commit explícita por caso (nunca copiados literalmente; geometria reconstruída a partir da descrição textual e dos parâmetros documentados nos commits citados).

## 9. Pares de indistinguibilidade

1. Nível helper: F vs. J; L1/L4 vs. L7 (§5).
2. Nível capacidade completa (com largura/posição de segmento): mesmos pares, reavaliados com H1/H3.
3. Nível com extensão mínima (blocos de f.1): mesmos pares, reavaliados com H4.

## 10. Casos reais rotulados

Ver `EPIC_21_SPRINT_4B3A_EVIDENCE_PACKAGE.md` §Manifesto — amostras extraídas das páginas 46-54 do documento real, com classificação humana (`must_include`/`must_exclude`/`uncertain`) determinada por inspeção do texto de origem de cada linha física (permitido para rotulagem humana, nunca para os algoritmos candidatos).

## 11. Critérios de rejeição e aceitação

Conforme §14/§15 do enunciado da Sprint (reproduzidos aqui por referência, não duplicados): falha em qualquer caso obrigatório rejeita a candidata; nenhuma média/score; determinismo, invariância a ordem/translação/escala; proprietário arquitetural de cada evidência identificado; comportamento explícito sob evidência insuficiente.

## 12. Categorias finais e condições de portão para 21.4B.3B

- **A** (`safe_invariant_found_in_current_stage_evidence`): alguma candidata usando apenas §2.1+§2.2 passa todos os critérios de §11. → 21.4B.3B pode ser recomendada usando o contrato atual da capacidade (implementação ainda não iniciada nesta Sprint).
- **B** (`safe_invariant_found_with_minimal_contract_extension`): nenhuma candidata em A passa, mas H4 (ou equivalente) usando §2.3 passa todos os critérios. → 21.4B.3B só pode ser recomendada com a extensão de contrato formalizada (f.1 como proprietário, blocos passados a f.2a sem novo cálculo).
- **C** (`no_safe_invariant_in_current_evidence`): prova de indistinguibilidade (§5) se mantém em todos os níveis de evidência mapeados (§2.1-§2.3), com demonstração completa (contrato insuficiente, evidência ausente, proprietário, extensão mínima hipotética, ausência de significado semântico indevido). → 21.4B.3B bloqueada no desenho atual.
- **D** (`inconclusive`): nenhuma das provas acima é completa. → 21.4B.3B bloqueada; próximo experimento mínimo registrado.

Este documento é o pré-registro. Nenhum algoritmo candidato foi executado antes deste commit.

## 13. Correção (commit `docs(architecture): correct tabular discovery evidence claims`)

Revisão externa do commit `764a62c` identificou duas imprecisões neste pré-registro, corrigidas — nunca silenciosamente — nesta seção, preservando o texto original acima sem alteração:

1. **Escopo da prova de indistinguibilidade (§5/§8)**: o texto acima descreve comparar "a representação canônica da evidência do helper para uma janela de linhas" e conclui que a igualdade "prova formalmente que nenhuma função determinística limitada ao contrato atual do helper... pode distinguir os dois grupos". O que foi de fato implementado e executado (`discovery-indistinguishability-proof.test.ts`) compara apenas o **fingerprint canônico da linha-alvo especificamente** (sua posição relativa e os extents de alinhamento que ela sustenta) — nunca a representação canônica de TODAS as linhas da janela simultaneamente, módulo renomeação de `lineKey`/`alignmentKey`. A conclusão correta, mais restrita, é: a evidência especificamente atribuível à linha-alvo, no nível do helper atual, é insuficiente para decidir sobre ela mesma — "indistinguibilidade local da linha-alvo", nunca "indistinguibilidade do contrato completo". Ver correção detalhada no cabeçalho de `discovery-indistinguishability-proof.test.ts` e `discovery-evidence-representation.ts`.
2. **H3 e o limiar 1.6x**: H3 foi pré-registrada acima (§12, família H3) apenas como direção conceitual ("envelope de coluna derivado de âncoras estáveis... intervalo físico de largura... nunca calibrada por um documento específico") — o valor numérico exato do limiar (`H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO = 1.6`) e a implementação exata (piscina de âncoras, largura por segmento) foram decididos durante a Sprint de avaliação (segundo commit), não congelados aqui. O resultado "H3 passa 20/20 casos sintéticos" é, portanto, um resultado **exploratório da implementação diagnosticada**, não a confirmação de uma predição numérica pré-registrada. **H3b não foi pré-registrada em nenhuma forma** — foi criada depois da observação de falsos negativos no documento real, explicitamente como refinamento pós-hoc (ver `discovery-candidate-hypotheses.ts`), e nunca deve ser apresentada como candidata do pré-registro original.

Nenhuma conclusão factual sobre A/B/C/D muda em função desta correção — o veredito permanece **D (inconclusive)**, agora com a justificativa corrigida no relatório.
