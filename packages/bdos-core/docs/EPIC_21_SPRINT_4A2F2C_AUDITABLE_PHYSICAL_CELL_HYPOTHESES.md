# Epic 21 — Sprint 21.4A.2.f.2c — Formação Auditável da Malha Física e Hipóteses de Célula

**Status: implementada com validação executável, isolamento regional e conservação.**

## Contrato e linhagem

A operação pública recebe um único `BudgetDocumentPhysicalCellHypothesisFormationInput`, composto pelos resultados reais da reconstrução estrutural, detecção de regiões tabulares e reconstrução de hipóteses físicas de coluna. Versões, identidades achatadas, `sourceByteHash`, fingerprints e referências grupo–página–região–linha–segmento–hipótese são validados diretamente. Fingerprint não substitui igualdade de identidade nem integridade referencial. `TabularRegionCandidate.lineKeys` é a fonte de verdade das linhas participantes.

`ReconstructedPhysicalLine` é o eixo horizontal e `PhysicalColumnHypothesis` o eixo vertical. Blocos físicos não determinam a malha e não existe faixa horizontal física pública.

## Fases e falhas

Validação de entrada, formação do produto cartesiano, associação de segmentos, formação de células, validação de contenção, conservação, métricas e canonicalização são fases separadas. Dependências internas permitem injetar falhas em testes sem ampliar a API pública.

Estados `group_not_processable`, `page_not_processable` e `region_not_processable` da f.2b são preservados. Segmentos de uma região não processada recebem `unresolved_upstream_region_not_processable`, nunca uma observação física negativa. A disposição `unresolved_physical_column_hypothesis_detection_failed` é propagada como `unresolved_inherited_physical_column_hypothesis_failure`, preservando fase e status upstream; invalida somente sua região e jamais é convertida em vazio, segmento externo ou falha de associação da f.2c. Falha inesperada na formação da malha torna a região não processável e não publica produto parcial. Falhas posteriores materializam `FailedPhysicalGridIntersection` com a fase exata. Regiões independentes continuam sendo processadas; somente uma falha realmente global produz resultado global `failed`.

## Geometria, interseções e células

Cada região processável publica todo par elegível linha × hipótese de coluna, inclusive posições vazias. `gridBounds` é o produto ortogonal dos limites horizontais da coluna com os limites verticais da linha. A associação exige contenção integral exata, sem tolerância nova, corte, ajuste ou absorção. Contato apenas na borda não conta como interseção; sobreposição parcial permanece ambígua; um segmento contido por mais de uma interseção gera disputa explícita.

`PhysicalGridIntersection` é a única fonte da identidade estrutural. Quando há célula, a interseção guarda somente `cellHypothesisKey`. `PhysicalCellHypothesis` guarda sua chave, `gridIntersectionKey`, `observedContentBounds`, `segmentKeys` e a identidade da regra de célula. Linha, coluna, região, página, ordens e `gridBounds` são obtidos pela interseção. Não existe célula vazia.

`observedContentBounds` é a união dos segmentos associados e deve ficar contido em `gridBounds`. Exceções permanecem ambíguas. Números são canonicalizados para seis casas decimais e a contenção é revalidada após a canonicalização.

## Conservação e métricas

Há dois universos independentes e validados por portões executáveis:

- para cada região processável, `intersections = lines × columns`, com chaves únicas e uma variante final por posição;
- cada segmento da região recebe exatamente uma disposição final, sem duplicação, omissão ou propriedade por mais de uma célula.

Referências segmento–disposição–célula–interseção são verificadas bidirecionalmente, inclusive pertencimento ao universo regional. Disposições ausentes não são filtradas: tornam-se falha controlada e quebram o portão de conservação. Quebras emitem os problemas técnicos de conservação correspondentes. Métricas são contagens estruturais objetivas; não representam score, confiança ou prontidão comercial.

## Determinismo e testes

Chaves e fingerprints usam SHA-256 sobre JSON canônico, sem UUID, relógio ou aleatoriedade. O fingerprint final cobre linhagem, hierarquia, interseções, células, disposições, problemas, métricas e limitações. Mudanças apenas textuais não alteram o resultado físico.

A suíte cobre contratos e versões incompatíveis, igualdade direta de toda a linhagem, referências hipótese–disposição, estados e falhas herdados, produto cartesiano e vazios, associação parcial/múltipla, falhas por fase, conservação bidirecional, isolamento real entre duas regiões, canonicalização, determinismo, guard arquitetural recursivo e cadeia iniciada em PDF sintético pelo leitor real.

O golden trace real usa quatro linhas. A f.2b exige que uma hipótese válida de coluna participe de pelo menos três linhas; com exatamente três linhas, toda coluna válida necessariamente ocupa as três, tornando impossível obter simultaneamente uma posição vazia legítima. Quatro linhas preservam o objetivo do trace sem fabricar um estado proibido pelo contrato upstream.

## Declarações negativas

Interseção não é célula confirmada; hipótese física de célula não é campo econômico; linha física não é linha orçamentária; hipótese de coluna não é coluna confirmada; região candidata não é tabela confirmada; vazio físico não significa dado econômico ausente. Não há leitura ou interpretação textual, código de serviço, descrição, unidade, quantidade, preço, total, BDI, cabeçalho, rodapé, continuidade entre páginas, IA, OCR, persistência, API, rota, UI, visualizador, documento real ou alegação de prontidão comercial.
