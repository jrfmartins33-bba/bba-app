# Epic 21 — Structured Expected Cell Geometry: Final Report

Sprint: "Representação Estruturada da Geometria Esperada das Células" (preparatória para o futuro motor determinístico). Branch `claude/epic-21-expected-cell-geometry`, aberta a partir do merge commit `7dc0cc393d52452e5e5bb58d818fb215936775f0` de `main`.

## 1. Fonte

| Campo | Valor |
|---|---|
| Documento | `05_Anexo_Tecnico_Termo_Referencia.pdf` |
| SHA-256 (verificado nesta Sprint) | `5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5` |
| Caminho local (fora de versionamento) | `_local-documents/epic-21/lagoa-do-arroz/01_Origem_Edital/05_Anexo_Tecnico_Termo_Referencia.pdf` |
| Páginas | 46, 50, 54 |
| Reconstrutor físico | `pdfjsPhysicalDocumentReader.read` → `observeDocumentSignals` → `locateBudgetDocumentPages` → `reconstructBudgetDocumentStructure` (todos já aprovados, `domain/budget-document-location`) |
| Identidade do adaptador | `pdfjs-physical-document-reader-adapter-v2` |
| Biblioteca subjacente | `pdfjs-dist@6.1.200` (versão exata fixada em `package.json`, auditada em runtime) |
| `reconstructionContextFingerprint` (desta execução) | `c64aa8ef3ea9a6037de7a209452dadd1dc7ece6636bab5b9c06b205eea795aca` |
| `physicalGeometryContextFingerprint` (desta execução) | `4381c43586c66052d814c58021f769aec7bb63ff3568f27de8bb14478277494f` |

Nenhum Docling, PaddleOCR, OCR, LLM, API ou motor determinístico foi executado. A única dependência de execução foi o reconstrutor físico do próprio domínio, já aprovado em Sprints anteriores.

## 2. Achado material: divergência de `segmentKey` e o remapeamento posicional verificado

Antes de gerar qualquer dado real, a tentativa direta de resolver os `segmentKey` já congelados em `physicalOriginPt`/`ReferenceTruthPhysicalRegion.segmentKeys` contra uma reconstrução física fresca **falhou em 100% dos casos (0/186 regiões)**.

**Causa comprovada**: `computeSegmentKey` nunca foi um hash de conteúdo — é `sha256(["segment", lineKey, ...sourceTextItemIndices])`, e `lineKey` encadeia através de um `reconstructionContextFingerprint` que incorpora a identidade do conjunto de regras de localização/reconstrução de páginas. Esse conjunto de regras foi versionado adiante desde que a verdade de referência foi congelada (Sprint 21.4B.3A.3) — algo natural e esperado numa base de código em evolução — mudando toda a cadeia de chaves sem mudar nenhuma geometria real.

**Evidência**: pareando cada `ReferenceTruthPhysicalRegion` congelada com a linha física fresca correspondente exclusivamente por `verticalOrder` (campo determinístico, sequencial, 1-based, já parte do próprio contrato congelado — nunca texto, nunca proximidade), e cada `segmentKeys[i]` congelado com o `segmentKeys[i]` fresco da mesma linha exclusivamente por posição no array:

- **186/186** pares região↔linha bateram exatamente (bounding box idêntica, zero tolerância) nas 3 páginas;
- **936/936** pares de segmento bateram exatamente (bounding box idêntica);
- **0** conflitos de ambiguidade (nenhuma chave antiga mapeou para mais de uma geometria nova distinta);
- **1.019/1.019** células resolvíveis através do remapeamento.

**Isto nunca é**: correção de hash, inferência por conteúdo textual, ou casamento aproximado/"mais próximo" — todos explicitamente proibidos pelo enunciado da Sprint. **É**: recuperação de uma identidade geométrica exata através de um atributo estrutural, determinístico e não-textual que já fazia parte do contrato congelado (ordem vertical da região/linha na página, ordem horizontal do segmento na linha).

**Efeito no resultado publicado**: nenhum. Toda `segmentKey` que aparece nos arquivos publicados desta Sprint (`physical-segments-page-*.ts`, e dentro de cada `ReferenceTruthCellGeometry.sourceSegmentKeys`/`provenance.parsedSegmentKeys`) é a chave **original**, já declarada em `physicalOriginPt` — nunca a chave recém-computada. O remapeamento foi usado exclusivamente como mecanismo interno, de uso único, para recuperar a caixa delimitadora de cada chave já declarada.

O script que produziu e verificou este remapeamento está em `infrastructure/budget-document-location/pdfjs/testing/generate-reference-truth-cell-geometry.ts` — falha (`process.exit(1)`) caso qualquer uma das validações acima não passe integralmente.

## 3. Inventário inicial (dados reais, 1.019 células)

| Métrica | Valor |
|---|---|
| Total de células | 1.019 (página 46: 358, página 50: 526, página 54: 135) |
| Total de regiões físicas | 186 (46: 73, 50: 80, 54: 33) |
| Total de linhas lógicas | 98 |
| Células com exatamente 1 segmento de origem | 1.019 (100%) |
| Células com vários segmentos de origem | 0 (algoritmo suporta; nenhuma instância real) |
| Chaves de segmento distintas referenciadas | 850 |
| Segmentos usados por mais de uma célula (grupos compartilhados) | 167 — 166 pares + 1 grupo de 4 (`cell-49`/`cell-50`/`cell-51`/`cell-52`, linha `row-46-015`, colunas quantidade/custo-s/BDI/BDI/unit-c/BDI) |
| Células participando de um grupo compartilhado | 336 |
| Células com origem exclusiva | 683 |
| Células fisicamente vazias | 0 (confirmado por dado real — `literalText` vazio e `observedType: "vazio_intencional"` não ocorrem nas 1.019 células) |
| Linhas lógicas com descrição multilinha (`col-descricao` > 1 célula) | 38, totalizando 83 células de descrição |
| Linhas lógicas com mais de uma região física | 42 (cabeçalhos, um bloco de conteúdo externo, e linhas de item com continuação) |
| Segmentos sem correspondência no registro estrutural | 0 |
| Segmentos vinculados a mais de uma região física | 0 |
| Colunas com intervalo parcialmente sobreposto | `col-descricao` × `col-unidade` (2,26 pt) |
| Colunas com intervalo idêntico | `col-custo-sbdi` × `col-bdi` (70,64 pt, já documentado em `discovery-reference-truth-columns.ts`) |
| Relações 1:1 / 1:N / N:1 célula↔segmento | 683 relações 1:1; 0 relações 1:N (célula→vários segmentos); 167 relações N:1 (vários células→um segmento) |

## 4. Modelo escolhido

Ver `EPIC_21_EXPECTED_CELL_GEOMETRY_CONTRACT.md` para o contrato completo. Resumo: `ReferenceTruthCellGeometry` por célula, com `fragments[]` (um por segmento de origem, ordem preservada), `expectedEnvelope` (união exata dos fragmentos), `rowBand` (caixa da linha lógica, evidência independente), `columnBand` (intervalo congelado da coluna), `sharedGeometryGroupId`/`sharedWithCellIds` (simétricos), e `provenance` completa. Três tipos de projeção de fragmento: `source_segment_column_intersection` (regra principal), `source_segment_exact_box` (fallback exclusivo para geometria legitimamente compartilhada sem subdivisão física real) e `row_column_empty_slot` (exclusivo para célula fisicamente vazia — 0 instâncias reais, suportado apenas sinteticamente).

## 5. Geração

- Algoritmo genérico congelado no Commit 1 (`ab848769799e9d3099680670acd6426362cba657`), antes de qualquer dado real.
- Duas execuções independentes da cadeia física completa (bytes copiados independentemente) → resultado JSON-equivalente: `sha256 = 73dc3acc2f4c8b9d9ad75127938e25e8553c2ad1ae823eea42dbbe0dc4ba84ac`.
- Remapeamento posicional verificado (§2): 186/186, 936/936, 0 ambiguidades.
- Duas execuções independentes da geração de geometria (mesmo algoritmo do Commit 1, mesmo registro de segmentos) → resultado JSON-equivalente: `sha256 = b0724ca46e4018b182bcb9d95b5016e7704440a5c5bbaba71e4d9272f02c1da7` (== `canonicalGenerationSha256` do manifesto).
- Publicação só ocorreu após igualdade integral confirmada em ambas as etapas.

## 6. Resultado

| Métrica | Valor |
|---|---|
| Células processadas | 1.019 |
| Geometrias produzidas | 1.019 |
| Erros de integridade | **0** |
| Células não resolvidas | **0** |
| `single_source_fragment` / `exclusive` | 683 |
| `shared_source_geometry` / `shared` | 336 |
| `multiple_source_fragments` / `multi_fragment` | 0 (nenhuma instância real; suportado e testado sinteticamente) |
| `empty_slot_projection` / `empty_slot` | 0 (nenhuma instância real; suportado e testado sinteticamente) |
| Grupos de geometria compartilhada distintos | 167 |
| Linhas lógicas com descrição multilinha (não colapsadas) | 38 |
| Erros de validação pós-hoc | **0** |

```
1.019 células esperadas
=
1.019 disposições geométricas válidas e auditáveis
```

## 7. Validação visual

Sem instalar nenhuma dependência nova (nenhuma ferramenta de rasterização de SVG estava disponível no repositório), a inspeção visual foi conduzida estruturalmente sobre o markup determinístico dos três SVGs publicados (`cell-geometry/diagnostics/page-{46,50,54}.svg`):

- **Limites das 12 colunas**: as linhas verticais de cada SVG batem exatamente com `REFERENCE_TRUTH_COLUMNS` (incluindo a sobreposição parcial `col-descricao`/`col-unidade` e a coincidência total `col-custo-sbdi`/`col-bdi`).
- **Faixas de linha**: cobrem a largura completa da grade tabular, com alturas de 7–25 pt, consistentes com linhas de texto único a blocos de cabeçalho.
- **Grupo compartilhado de 4 células** (`cell-49`/`50`/`51`/`52`, página 46): confirmado visualmente — `cell-49` (quantidade) e `cell-52` (unit. c/BDI) recebem fragmentos próprios, recortados pela interseção com sua própria coluna a partir do segmento largo compartilhado (`leftPoints: 789.241 → rightPoints: 804.3` para `cell-49`); `cell-50`/`cell-51` (custo s/BDI, BDI — colunas idênticas) compartilham a mesma caixa exata. Todas as quatro compartilham a mesma cor de grupo no SVG.
- **Descrição multilinha** (`cell-30`, continuação de `row-46-011`): confirmado — `rowBand` cobre a união das duas regiões físicas da linha (137,29–153,75), enquanto o fragmento da própria célula fica corretamente restrito à sua posição física real (145,98–153,75), nunca colapsado à posição da linha principal do item.
- **Rótulos de célula**: presentes e completos por página (358/526/135), em camada própria e legível.

Nenhuma correção de geometria foi feita por tentativa e erro — toda inspeção confirmou os dados já produzidos pelo algoritmo, sem exigir nenhum ajuste.

## 8. Independência

Confirmado:

- nenhuma saída de leitor local (Docling/PaddleOCR) foi usada;
- nenhum resultado do futuro motor determinístico foi usado (ele não existe ainda);
- nenhum LLM foi usado para produzir geometria, texto ou correspondência;
- nenhuma tolerância decimal arbitrária foi usada em nenhuma comparação;
- nenhuma alteração produtiva foi feita (guardas arquiteturais confirmam isolamento total sob `testing/`);
- nenhuma alteração foi feita na verdade histórica: `ReferenceTruthCell.physicalRegionIds` permanece `[]` em todas as 1.019 células; nenhuma célula, região, coluna, linha, relatório ou resultado v1/v2 pré-existente foi tocado.

## 9. Próxima etapa

1. Merge desta Sprint (geometria esperada estruturada) em `main`.
2. Nova branch limpa para o Codex construir o motor determinístico.
3. O motor deve consumir exclusivamente texto, coordenadas e estrutura física de entrada — nunca esta camada de geometria esperada.
4. A verdade geométrica desta Sprint permanece exclusiva do futuro avaliador (nunca importada pelo motor; guarda arquitetural dedicado já impede isso).
5. Claude revisa independentemente a implementação do Codex quando ela chegar.

Não iniciado: nenhum código do motor determinístico foi escrito nesta Sprint.
