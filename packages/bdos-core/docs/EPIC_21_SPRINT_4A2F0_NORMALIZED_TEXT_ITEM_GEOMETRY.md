# Epic 21 — Sprint 21.4A.2.f.0 — Geometria Normalizada dos Itens Textuais

**Status: concluída.** Evolui o contrato físico de leitura de PDF (Sprint 21.4A.2.c) de schema v1 para v2: cada item textual passa a carregar sua própria geometria de layout, no espaço de coordenadas apresentado da página, canonicalizada e auditável — sem reconstruir linha, segmento, bloco, tabela, coluna ou célula. Não decide nada, não altera o observador (Sprint 21.4A.2.d) nem o localizador (Sprint 21.4A.2.e). Próximo incremento: reconstrução estrutural (Sprint 21.4A.2.f.1, fora do escopo desta Sprint).

## 1. Bloqueador que originou a Sprint

O contrato v1 preservava apenas `{ index, text }` por item textual — suficiente para as regras lexicais do observador (que leem `item.text`/`item.index`), mas insuficiente para qualquer reconstrução estrutural futura (agrupar itens em linhas/blocos exige saber *onde* cada item está, não apenas *o que* ele diz). Esta Sprint remove esse bloqueio evoluindo o contrato — sem tocar a reconstrução em si.

## 2. Contrato v1 (recapitulação)

`PhysicalDocumentTextItem { index: number; text: string }`, `PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION = 1`, `PHYSICAL_DOCUMENT_READER_VERSION = "physical-document-reader-v1"`, `PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION = "pdfjs-physical-document-reader-adapter-v1"`. Ver `EPIC_21_SPRINT_4A2C_DOCUMENT_READER_AND_PDF_ADAPTER.md`.

## 3. Evolução para v2

`PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION = 2`, `PHYSICAL_DOCUMENT_READER_VERSION = "physical-document-reader-v2"`, `PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION = "pdfjs-physical-document-reader-adapter-v2"`. `PhysicalDocumentTextItem` ganha `placement: PhysicalDocumentTextItemPlacement`; `PhysicalDocumentPage` ganha `textItemPlacementMetrics`; `PhysicalDocumentReadResult` ganha `textItemCoordinateSpaceVersion`, `textItemGeometryProfileVersion`, `geometryContextFingerprintVersion`, `geometryContextFingerprint`. Nenhum campo v1 foi removido ou teve seu significado alterado silenciosamente.

## 4. Fronteiras (inalteradas e reafirmadas)

Sem reconstrução estrutural (linha, segmento, bloco, tabela, coluna, célula, ordem humana de leitura), sem semântica econômica, sem Versão do Orçamento, sem persistência, sem Supabase, sem rota, sem interface, sem IA, sem OCR, sem score, sem confiança, sem documento real. Guard: `architecture/physical-document-read-no-decision-boundaries.test.ts` (vocabulário estendido nesta Sprint) e `architecture/physical-document-text-item-geometry-boundaries.test.ts` (novo).

## 5. Espaço de coordenadas

`PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION = "physical-document-text-item-coordinate-space-v1"`. Origem: canto superior esquerdo da página apresentada. Eixos: x crescente para a direita, y crescente para baixo. Unidade: pontos no viewport com `scale = 1`. Dimensões: largura/altura já refletindo a rotação efetiva (idêntico ao v1 `widthPoints`/`heightPoints`). O domínio nunca importa `PageViewport`, `TextItem`, `TextStyle` ou qualquer matriz concreta — recebe apenas números já normalizados (`packages/bdos-core/src/infrastructure/budget-document-location/pdfjs/text-item-geometry.ts` faz essa tradução, com tipos locais próprios, nunca os da biblioteca).

## 6. Viewport e composição

Fundamentação empírica (lendo o código-fonte real de `pdfjs-dist@6.1.200`, `legacy/build/pdf.mjs`, classe `PageViewport`): para as quatro rotações suportadas, `viewport.transform` usa exclusivamente coeficientes exatos `{-1, 0, 1}` multiplicados pela escala — nenhuma chamada a `Math.cos`/`Math.sin` — eliminando erro de ponto flutuante da própria rotação. A composição usada é `viewport.transform × item.transform` (multiplicação de matrizes afins, `Util.transform` da própria biblioteca), aplicada aos quatro cantos de um retângulo local do item (ver seção 9), não a uma fórmula manual por rotação.

Achado empírico crítico durante a caracterização: `TextItem.width` já é o avanço horizontal em unidades de espaço PDF absoluto (não uma fração a ser multiplicada pela escala da matriz de transformação) — confirmado numericamente: `"AB"` em Helvetica 24pt produz `width = 32.016`, exatamente `(667+667)/1000 × 24`, as larguras de glifo padrão AFM da Helvetica. Multiplicar `width` pela escala do `item.transform` (como uma primeira hipótese ingênua fazia) produzia um valor 24× maior — erro detectado e corrigido durante o portão de caracterização (seção 8 do brief), antes de qualquer código de produção.

## 7. Rotação

`viewport.rotation` já reflete `/Rotate` da página (idêntico ao comportamento v1 de `widthPoints`/`heightPoints`/`rotationDegrees`). As quatro rotações (0°/90°/180°/270°) foram comprovadas empiricamente contra a biblioteca real (ver seção 12).

## 8. Unidade

Pontos, com `scale = 1` e `userUnit` da página incorporado pelo próprio `viewport.transform` (comprovado empiricamente: `userUnit = 2` dobra a geometria resultante, seção 12).

## 9. Limites de layout

`PhysicalDocumentTextItemLayoutGeometry`: `leftPoints`, `topPoints`, `rightPoints`, `bottomPoints`, `widthPoints`, `heightPoints`, `centerXPoints`, `centerYPoints`, `pageBoundsRelation`, `coordinateSpaceVersion`, `geometryProfileVersion`. Derivação (para orientações suportadas): sejam `(a,b,c,d,e,f) = item.transform`; `ux,uy` = eixo x local normalizado; `vx,vy` = eixo y local normalizado; `fontSize = hypot(c,d)` (magnitude do eixo y local); ponto inicial `(e,f)`, ponto final `(e + width·ux, f + width·uy)`; deslocamento de ascent/descent = `fontSize × TextStyle.ascent|descent` ao longo de `(vx,vy)`. Os quatro cantos do quadrilátero local (início/fim × ascent/descent) são transformados por `viewport.transform`; os limites finais são o mínimo/máximo dos quatro pontos transformados — não uma aproximação, uma bounding box exata para as orientações comprovadas (seção 10).

## 10. Diferença entre layout e glifos

Os limites descrevem o **layout tipográfico** (avanço horizontal declarado + ascent/descent do estilo de fonte) — nunca o contorno visual exato de cada caractere (curvas de glifo, hinting, kerning visual). Nomenclatura deliberadamente evita "glyph bounds"/"pixel bounds".

## 11. Orientações suportadas

Texto horizontal comum (`TextItem.dir === "ltr"`, `TextStyle.vertical === false`) cujo `item.transform` tem eixo local alinhado a um dos eixos globais (`b=0∧c=0` ou `a=0∧d=0` — comprovado matematicamente: como `viewport.transform` é, para as quatro rotações suportadas, uma permutação/reflexão exata de eixos, compor um item já axis-aligned com esse viewport permanece axis-aligned, para qualquer uma das quatro rotações). Comprovado empiricamente contra a biblioteca real para as quatro rotações de página (0°/90°/180°/270°), `viewBox` deslocado, `userUnit ≠ 1` e coordenadas fracionárias (ver `text-item-geometry.test.ts`, `pdfjs-physical-document-reader.test.ts`).

## 12. Orientações não suportadas

`ttb` (`TextStyle.vertical === true` ou `dir === "ttb"`): sempre `unresolved_unsupported_orientation` — o modelo de largura/ascent/descent desta Sprint assume avanço horizontal, incompatível com escrita vertical (a própria implementação de referência da biblioteca, `TextLayer`, trata `vertical` como um eixo de medida diferente — `canvasWidth = height`, não `width`). `rtl`: **explicitamente não suportado nesta versão** — decisão aberta documentada na seção 27; não havia prova sintética suficiente sem incorporar uma fonte real com CMap Unicode (fora do escopo de um PDF hand-rolled mínimo). Matrizes inclinadas ou cisalhadas (`item.transform` sem o padrão axis-aligned da seção 11): `unresolved_unsupported_orientation`, comprovado sintética e numericamente (`text-item-geometry.test.ts`, cenários 12-13) — nunca "encaixadas" numa bounding box solta.

## 13. Disposição do item

União discriminada `PhysicalDocumentTextItemPlacement` com **cinco variantes totalmente separadas** — `placed` e as quatro `unresolved_*` — cada uma amarrando seu próprio `status` a um único `reasonCode` literal (revisado na auditoria pós-PR #68: a versão original agrupava as quatro variantes não resolvidas sob um `status` combinado com `reasonCode: PhysicalDocumentTextItemGeometryProblemCode` genérico, permitindo pares contraditórios como `status: "unresolved_missing_geometry"` com `reasonCode: "text_item_geometry_invalid"` que passavam pelo `tsc` sem erro). Com a união totalmente separada, essa combinação é um erro de tipo, não apenas uma invariante documentada. Sem campos opcionais soltos, sem estado ambíguo entre ausência e não resolvido.

Os construtores internos (`text-item-geometry.ts`) refletem essa separação: três funções dedicadas (`missingGeometryPlacement`, `invalidGeometryPlacement`, `unsupportedOrientationPlacement`), cada uma retornando um literal fixo, não um construtor genérico parametrizado por `status`+`reasonCode`. O cálculo de métricas (`computeTextItemPlacementMetrics`) usa um `switch` com guarda de exaustividade (`assertUnreachablePlacement(value: never)`): um novo `status` futuro sem o `case` correspondente vira erro de compilação, não desaparece silenciosamente da soma.

## 14. Códigos por item

`text_item_geometry_missing`, `text_item_geometry_invalid`, `text_item_orientation_unsupported`, `text_item_geometry_normalization_failed`. Correspondência 1:1 com `status`, testada em `text-item-geometry.test.ts`.

## 15. Conservação

Fronteira de admissão inalterada: todo elemento de `TextContent.items` com `str` é admitido. Depois de admitido, nenhum item desaparece — mesmo `unresolved_*`. Invariante testada: `totalAdmittedTextItemCount === placed + missing + invalid + unsupportedOrientation + normalizationFailed`.

**Achado empírico durante os testes de conservação**: a própria `pdfjs-dist@6.1.200` omite de `TextContent.items` qualquer item cuja string extraída seja vazia ou somente espaço em branco — esses itens nunca chegam à fronteira de admissão do adaptador (`hasStr`), então não há como prová-los preservados fim a fim através da biblioteca real. A preservação de string vazia/somente espaço permanece garantida no nível da função pura de geometria (`text-item-geometry.test.ts`, "largura zero é permitida"), que não depende da biblioteca concreta — documentado como limitação de prova, não como lacuna de comportamento.

## 16. Métricas

`PhysicalDocumentTextItemPlacementMetrics` em cada `PhysicalDocumentPage.textItemPlacementMetrics`: `totalAdmittedTextItemCount`, `placedTextItemCount`, `unresolvedMissingGeometryCount`, `unresolvedInvalidGeometryCount`, `unresolvedUnsupportedOrientationCount`, `unresolvedNormalizationFailedCount`. `totalAdmittedTextItemCount === metrics.textItemCount` sempre (mesma população, duas visões). O *tipo* é público (parte do contrato, exportado via `physical-document-read.types.ts`); a *função* `computeTextItemPlacementMetrics` (domínio, `physical-document-text-item-placement-metrics.ts`) **não** é exportada pelo barrel — revisado na auditoria pós-PR #68 para uma API pública seletiva — o adaptador a importa por caminho direto de módulo.

## 17. Canonicalização

`physical-document-text-item-geometry-canonicalization.ts` (domínio, **não** exportado pelo barrel público — seção 41 do brief: "Não exporte: ... quantizador"). Seis casas decimais, arredondamento simétrico em torno de zero (round-half-away-from-zero — `Math.round` sozinho não é simétrico para negativos), `-0` normalizado para `0`, subnormal que quantize para zero também normalizado. Limites canonicalizados primeiro; `widthPoints`/`heightPoints`/`centerXPoints`/`centerYPoints` derivados dos limites já canônicos e re-canonicalizados. Validação de coerência antes (bounding box de cantos finitos) e depois (limites não-invertidos, altura estritamente positiva) da quantização.

## 18. Relação com a página

`PhysicalDocumentTextItemPageBoundsRelation`: `inside` | `partially_outside` | `outside`, derivada por `deriveTextItemPageBoundsRelation` (domínio, `physical-document-text-item-page-bounds-relation.ts`, também não exportado pelo barrel — primitivo de baixo nível). Nenhum `clamp`: um item fora da página permanece `placed`.

## 19. Fingerprint

`PHYSICAL_DOCUMENT_GEOMETRY_CONTEXT_FINGERPRINT_VERSION = "physical-document-geometry-context-fingerprint-v1"`. `computeGeometryContextFingerprint` (domínio, `physical-document-geometry-context-fingerprint.ts` — **não** exportada pelo barrel, revisado na auditoria pós-PR #68; o adaptador a importa por caminho direto de módulo, junto de `GeometryContextFingerprintInput`, sua entrada interna). SHA-256 hex de um array JSON de ordem fixa: `[fingerprintVersion, sourceByteHash, physicalReadSchemaVersion, readerName, readerVersion, adapterVersion, underlyingLibraryVersion, coordinateSpaceVersion, geometryProfileVersion, quantizationDecimalPlaces]`. Presente inclusive em resultado `failed` (identifica o contrato técnico independentemente do sucesso da leitura).

`underlyingLibraryVersion` usado no fingerprint nunca é `null` na prática a partir desta versão: o adaptador declara `EXPECTED_UNDERLYING_LIBRARY_VERSION = "pdfjs-dist@6.1.200"` estaticamente (a dependência está fixada em versão exata) e usa esse valor inclusive para bytes vazios, sem precisar carregar a biblioteca primeiro. Ver seção 29.

## 20. Repetibilidade

Duas leituras independentes dos mesmos bytes (instâncias separadas de `Uint8Array`) produzem `JSON.stringify` idêntico, incluindo geometria, disposição, métricas e fingerprint — testado em `pdfjs-physical-document-reader.test.ts` ("two independent reads..."). A versão concreta da biblioteca passa a participar obrigatoriamente da chave de repetibilidade geométrica a partir do v2 (histórico documentado no comentário de `PhysicalDocumentReadResult.underlyingLibraryVersion`) — por isso `pdfjs-dist` foi fixado em versão exata (`6.1.200`, sem `^`) no `package.json` do pacote.

## 21. Impacto no observador

Nenhum. `signal-observation-rules.ts`/`signal-observation.ts` leem apenas `item.index`/`item.text` — nunca `item.placement`. Toda a suíte `signal-observation.test.ts` passa sem alteração de expectativa. Guard mecânico novo: `architecture/physical-document-text-item-geometry-boundaries.test.ts` ("no signal-observation rule file references the new per-item geometry fields").

## 22. Impacto no localizador

Nenhum. Toda a suíte `page-location/*.test.ts` (input-validation, classification, propagation, decision-rule-registry, locate-budget-document-pages) passa sem alteração de expectativa. Guard mecânico equivalente para `page-location/*.ts`.

## 23. Não regressão

Fixtures de teste que constroem `PhysicalDocumentTextItem`/`PhysicalDocumentReadResult` manualmente (`signal-observation/testing/synthetic-physical-document-bridge.ts`, `page-location/testing/page-location-test-fixtures.ts`, `signal-observation.test.ts`) foram adaptadas para fornecer `placement: unresolved_missing_geometry` (nunca tiveram geometria real, mesmo antes desta Sprint) e os quatro novos campos de `PhysicalDocumentReadResult` — nenhuma regra ou fixture teve seu comportamento observável alterado.

## 24. Testes

Novos arquivos de teste: `physical-document-text-item-geometry-canonicalization.test.ts`, `physical-document-text-item-page-bounds-relation.test.ts`, `physical-document-text-item-placement-metrics.test.ts`, `physical-document-geometry-context-fingerprint.test.ts` (domínio); `text-item-geometry.test.ts` (infraestrutura, portão de caracterização com valores lidos empiricamente da biblioteca real). Estendidos: `physical-document-read.test.ts`, `pdfjs-physical-document-reader.test.ts` (17 cenários v2 novos, incluindo isolamento de falha inesperada via injeção controlada em `Math.round`, restaurado em `finally`).

## 25. Guards

`physical-document-read-no-decision-boundaries.test.ts`: vocabulário estendido com linha/segmento/bloco/tabela/coluna/célula/ordem-de-leitura. `physical-document-text-item-geometry-boundaries.test.ts` (novo): módulo geométrico puro não importa `pdfjs-dist`; quantizador, primitivo de relação com a página, cálculo de métricas de disposição e cálculo do fingerprint (todos os quatro) não exportados pelo barrel; o adaptador os importa por caminho direto de módulo (verificado mecanicamente); nenhuma regra do observador ou do localizador referencia os novos campos geométricos.

## 26. Limitações

Limites são de layout, não contorno exato dos glifos. Não existe ordem humana de leitura, linha, segmento, bloco, coluna ou célula. Texto vertical (`ttb`) não suportado nesta versão. Texto inclinado/cisalhado não suportado. Estilo tipográfico ausente/inválido impede limites defensáveis (item não resolvido). Itens fora da página são preservados, nunca ajustados por `clamp`. Nenhuma semântica textual é aplicada. Nenhum documento real foi usado. Nenhum perfil foi calibrado por documento de cliente. OCR permanece fora do escopo. A conservação de itens com string vazia/somente-espaço é comprovada apenas no nível da função pura de geometria (seção 15) — a própria biblioteca concreta nunca entrega esses itens ao adaptador.

## 27. Decisões abertas

`rtl` permanece não suportado nesta versão: não foi possível construir uma prova sintética objetiva sem incorporar uma fonte real com CMap Unicode mapeando bytes para a faixa hebraica/arábica (`TextItem.dir` é calculado pela biblioteca a partir dos *code points Unicode decodificados*, não da forma da matriz), o que extrapolaria o espírito de "fixture sintética mínima" desta Sprint. Se um caso de uso concreto exigir `rtl`, a Sprint seguinte pode revisitar essa prova com uma fonte sintética dedicada. A distinção "estilo ausente" (`unresolved_missing_geometry`) vs. "estilo inválido" (`unresolved_invalid_geometry`) foi resolvida como: estilo *object* ausente/`undefined` → `missing`; estilo presente com `ascent`/`descent` não finitos → `invalid` — consistente com a seção 29 do brief, que lista "estilo ausente" como exemplo de geometria ausente.

## 28. Desbloqueio da Sprint 21.4A.2.f.1

Com geometria de layout normalizada, canonicalizada e auditável por item textual, a Sprint 21.4A.2.f.1 (reconstrução estrutural — faixas de linha, segmentos, blocos) pode começar a partir de um contrato estável, sem precisar redefinir espaço de coordenadas, canonicalização ou fingerprint. Esta Sprint não inicia essa reconstrução.

## 29. Correções pós-auditoria (PR #68)

Uma revisão do PR #68 (antes do merge, ainda em rascunho) encontrou cinco problemas, todos corrigidos nesta mesma Sprint, na mesma branch:

1. **Fingerprint incompleto para documento vazio.** `underlyingLibraryVersion` era `null` para bytes vazios (a biblioteca nunca chegava a ser carregada), contradizendo a seção 19 ("presente inclusive em resultado `failed`"). Corrigido: o adaptador declara `EXPECTED_UNDERLYING_LIBRARY_VERSION = "pdfjs-dist@6.1.200"` estaticamente (a dependência está fixada em versão exata) e a usa mesmo antes de qualquer carregamento. Depois de carregar a biblioteca, o adaptador **compara** a versão real retornada em runtime com essa identidade esperada; em caso de divergência, a leitura para com o novo código técnico `document_underlying_library_version_mismatch` (nível `document`), sem produzir nenhuma página — nunca continuando com um contexto de repetibilidade geométrica falso.
2. **União discriminada permitia combinações inválidas.** `PhysicalDocumentTextItemPlacement` agrupava as quatro variantes não resolvidas sob um `status` combinado com `reasonCode: PhysicalDocumentTextItemGeometryProblemCode` genérico — um par contraditório passava pelo `tsc`. Corrigido: cinco variantes totalmente separadas (seção 13), cada uma com `reasonCode` de tipo literal único. `computeTextItemPlacementMetrics` ganhou uma guarda de exaustividade (`assertUnreachablePlacement`).
3. **API pública expondo helpers internos.** O barrel (`domain/budget-document-location/index.ts`) reexportava `computeTextItemPlacementMetrics` e `computeGeometryContextFingerprint` (mais sua entrada interna `GeometryContextFingerprintInput`). Corrigido: removidos do barrel; o adaptador os importa por caminho direto de módulo; guard estendido confirma ambos ausentes do barrel e presentes como import direto no adaptador.
4. **Teste de repetibilidade usava a mesma instância de `Uint8Array`.** Corrigido: o teste de repetibilidade agora usa `source.slice()` duas vezes (duas instâncias genuinamente independentes); um teste novo e separado prova que reutilizar a mesma instância não a modifica (duas propriedades diferentes, dois testes diferentes).
5. **Lista de códigos técnicos controlados incompleta e duplicada.** O teste mantinha sua própria lista de códigos conhecidos, divergente da união de tipos real (faltavam `page_text_item_geometry_normalization_failed` e o novo `document_underlying_library_version_mismatch`). Corrigido: nova função exportada `getKnownTechnicalProblemCodes()` (domínio, `physical-document-technical-problem.ts`) deriva a lista do próprio `Record<PhysicalDocumentTechnicalProblemCode, string>` que o `tsc` já obriga a cobrir a união inteira — fonte única, sem lista duplicada. O teste também passou a produzir de fato o código `page_text_item_geometry_normalization_failed` (injeção controlada em `Math.round`, restaurada em `finally`), não apenas listá-lo.

Nenhuma correção alterou: a matemática geométrica já caracterizada, a política de canonicalização de seis casas, a relação `inside`/`partially_outside`/`outside`, o suporte às quatro rotações de página, o suporte a `ltr` horizontal, a rejeição conservadora de `rtl`/`ttb`/matrizes inclinadas ou cisalhadas, a conservação dos itens, as regras do observador ou do localizador, a fixação exata de `pdfjs-dist@6.1.200`.
