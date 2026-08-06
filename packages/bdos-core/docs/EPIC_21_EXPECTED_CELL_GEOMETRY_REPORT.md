# Epic 21 — Geometria Esperada Estruturada das Células: Relatório Final

Sprint: "Representação Estruturada da Geometria Esperada das Células" (preparatória para o futuro motor determinístico). Branch `claude/epic-21-expected-cell-geometry`, aberta a partir do merge commit `7dc0cc393d52452e5e5bb58d818fb215936775f0` de `main`.

**Atualizado pela verificação probatória final da PR #82** (proveniência corrigida para schemaVersion 2; geometria espacial inalterada — ver §2, e o registro completo em `EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md`).

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

## 2. Achado material: divergência de `segmentKey`, a ponte estrutural provisória, e a prova histórica independente final

Antes de gerar qualquer dado real, a tentativa direta de resolver os `segmentKey` já congelados em `physicalOriginPt`/`ReferenceTruthPhysicalRegion.segmentKeys` contra uma reconstrução física fresca **falhou em 100% dos casos (0/186 regiões)**.

### 2.1 Ponte provisória (primeira análise desta Sprint)

O remapeamento posicional demonstrou igualdade dos 186 envelopes de região, igualdade das quantidades e ordenação determinística dos segmentos, ausência de ambiguidades e preservação das uniões geométricas: pareando cada `ReferenceTruthPhysicalRegion` congelada com a linha física fresca correspondente exclusivamente por `verticalOrder`, e cada `segmentKeys[i]` congelado com o `segmentKeys[i]` fresco da mesma linha exclusivamente por posição no array:

- **186/186** pares região↔linha bateram exatamente (bounding box idêntica, zero tolerância) nas 3 páginas;
- **936/936** pares de segmento bateram exatamente (bounding box idêntica);
- **0** conflitos de ambiguidade;
- **1.019/1.019** células resolvíveis através da ponte.

Esta análise, por si só, **não constitui** uma comparação individual entre a caixa historicamente produzida para a chave antiga e a caixa hoje publicada — apenas demonstra correspondência estrutural via posição, nunca via identidade de chave.

### 2.2 Prova independente final (verificação probatória final da PR #82)

Um replay direto da cadeia física — executado exatamente no commit `ccd8f8f1627e4f628f8787c36a2b27517a42e29b`, em que a verdade de referência foi congelada, num worktree isolado com lockfile congelado (`pnpm install --frozen-lockfile`), contra o documento exato — tentou resolver diretamente as `lineKey`/`segmentKey` originais, exclusivamente por igualdade exata de chave (nunca posição, texto ou proximidade). Resultado:

```
regiões resolvidas diretamente por lineKey = 0 / 186
falhas de lineKey = 186 / 186
ambiguidades = 0
```

**Causa comprovada**: `computeSegmentKey` nunca foi um hash de conteúdo — é `sha256(["segment", lineKey, ...sourceTextItemIndices])`, e `lineKey` encadeia através de um `reconstructionContextFingerprint`. O código da cadeia física (`domain/budget-document-location/{signal-observation,page-location,structure-reconstruction}`) é comprovadamente **byte-idêntico** entre o commit histórico e esta branch (`git diff` sem nenhuma linha de diferença) — portanto a causa não é uma mudança de código detectável por diff; apenas que a chave declarada não é reproduzível por nenhuma execução conhecida da cadeia, em nenhum ponto do histórico do repositório. Registro completo, incluindo ambiente, comandos e hashes, em `EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md`.

**Decisão semântica vinculante**: `lineKey`/`segmentKey` já declaradas na verdade de referência passam a ser classificadas formalmente como `LegacyDeclaredKeyStatus = "legacy_unreproducible"` — identificadores históricos internos congelados, cuja origem de geração não pôde ser reproduzida nem pelo código, documento e ambiente do próprio commit em que foram registradas. Nunca mais tratadas como hash de conteúdo, identidade física reproduzível, prova de proveniência direta, ou chave canônica do segmento atual. Continuam válidas apenas para preservar a relação já congelada célula → chave histórica declarada → posição da chave dentro da região física congelada.

**Identidade canônica a partir do schemaVersion 2**: `ReproduciblePhysicalSegmentLocator`, construído deterministicamente a partir de posição estrutural já congelada (página, `frozenPhysicalRegionId`, `regionVerticalOrder`, `segmentHorizontalOrder`) mais identidade verificada do reconstrutor físico (hashes de adaptador/biblioteca, fingerprints) — nunca da chave histórica. A base formal da associação é `SegmentGeometryAssociationBasis = "exact_structural_position_with_region_geometry_validation"`: mesma página + mesma posição vertical da região + caixa da região exatamente igual + mesma quantidade de segmentos + mesma ordem horizontal do segmento + duas execuções físicas independentes e idênticas + zero ambiguidade estrutural — nunca resolução direta por chave, nunca fuzzy matching, nunca aproximação.

**Efeito no resultado publicado**: nenhuma coordenada, faixa, fragmento, envelope ou grupo compartilhado mudou. O hash canônico exclusivamente espacial (nunca de proveniência) é **idêntico** entre os dados publicados antes desta correção (schemaVersion 1) e depois (schemaVersion 2):

```
canonicalSpatialGeometrySha256 (schemaVersion 1, antes) = 9221d8bb0f7994cdde106cdf1ba718380881d2d4cbe1710add52705bec62680b
canonicalSpatialGeometrySha256 (schemaVersion 2, depois) = 9221d8bb0f7994cdde106cdf1ba718380881d2d4cbe1710add52705bec62680b
```

Toda `legacyDeclaredSegmentKey` que aparece nos arquivos publicados (`physical-segments-page-*.ts`, e dentro de cada `ReferenceTruthCellGeometry.legacyDeclaredSegmentKeys`/`provenance.legacyDeclaredSegmentKeys`) é a chave **original**, já declarada em `physicalOriginPt` — nunca a chave recém-computada. A ponte estrutural (§2.1) permanece o mecanismo interno usado para recuperar a caixa delimitadora de cada chave já declarada; a prova histórica (§2.2) é o que determina como essa proveniência pode — e não pode — ser descrita.

O gerador que produz e verifica tudo isto está em `infrastructure/budget-document-location/pdfjs/testing/generate-reference-truth-cell-geometry.ts` — falha (`process.exit(1)`) caso qualquer uma das validações acima não passe integralmente, incluindo a igualdade do hash espacial.

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
- Ponte estrutural verificada (§2.1): 186/186, 936/936, 0 ambiguidades.
- Prova histórica independente (§2.2): 0/186 `lineKey` resolvidas diretamente no commit de congelamento — ver `EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md`.
- Duas execuções independentes da geração de geometria schemaVersion 1 (algoritmo do Commit 1, registro de segmentos via ponte estrutural) → `sha256 = b0724ca46e4018b182bcb9d95b5016e7704440a5c5bbaba71e4d9272f02c1da7` (`previousFullArtifactSha256` no manifesto atual).
- Após a correção de proveniência (schemaVersion 2, localizador estrutural reproduzível): duas execuções independentes da geração de geometria → resultado JSON-equivalente: `sha256 = 23a267c23861429fca698b626d5f85095ab61ca1046e6cf85cca29a2515e4aca` (== `canonicalGenerationSha256` do manifesto atual).
- Hash canônico exclusivamente espacial recalculado sobre os dados schemaVersion 2 e comparado ao hash já capturado dos dados schemaVersion 1: **idênticos** — `canonicalSpatialGeometrySha256 = 9221d8bb0f7994cdde106cdf1ba718380881d2d4cbe1710add52705bec62680b` em ambos.
- Publicação só ocorreu após igualdade integral confirmada em todas as etapas acima.

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

Proveniência (schemaVersion 2): 1.019/1.019 geometrias com `reproducibleLocator` válido em todo fragmento não vazio; 0 geometrias usando `legacyDeclaredSegmentKey` como identidade canônica; toda `legacyDeclaredSegmentKey` publicada com status exatamente `"legacy_unreproducible"`.

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

## 9. Documentos relacionados

- `EPIC_21_EXPECTED_CELL_GEOMETRY_CONTRACT.md` — contrato completo do modelo de dados e de identidade (schemaVersion 2).
- `EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md` — registro objetivo e completo da prova histórica negativa (§2.2).

## 10. Próxima etapa

1. Merge desta Sprint (geometria esperada estruturada, proveniência reproduzível) em `main`.
2. Nova branch limpa para o Codex construir o motor determinístico.
3. O motor deve consumir exclusivamente texto, coordenadas e estrutura física de entrada — nunca esta camada de geometria esperada.
4. A verdade geométrica desta Sprint permanece exclusiva do futuro avaliador (nunca importada pelo motor; guarda arquitetural dedicado já impede isso, inclusive contra o uso de `legacyDeclaredSegmentKey` como chave canônica).
5. Claude revisa independentemente a implementação do Codex quando ela chegar.

Não iniciado: nenhum código do motor determinístico foi escrito nesta Sprint.
