# Epic 21 — Sprint 21.4A.2.f.2c — Formação Auditável da Malha Física e Hipóteses de Célula

**Status: implementada.** Forma deterministicamente todas as posições elegíveis linha física × hipótese válida de coluna dentro de cada região e materializa uma hipótese física de célula somente quando há um ou mais segmentos integralmente contidos e não ambíguos.

## Contratos consumidos

Consome conjuntamente `BudgetDocumentStructureReconstructionResult`, `BudgetDocumentTabularRegionDetectionResult` e `BudgetDocumentPhysicalColumnHypothesisReconstructionResult`. `ReconstructedPhysicalLine` é o eixo horizontal; `PhysicalColumnHypothesis` é o eixo vertical. Blocos não formam a malha.

## Geometria e evidência

`gridBounds` é o produto ortogonal entre os limites horizontais da coluna e os limites verticais da linha. `observedContentBounds` é a união dos segmentos observados. Os dois conceitos nunca são fundidos. Comparações usam exatamente os números recebidos dos contratos upstream; a saída é canonicalizada em seis casas decimais e validada novamente.

## Interseções e células

Toda região processável publica o produto cartesiano completo, inclusive posições vazias. `PhysicalGridIntersection` é uma união discriminada e a única fonte da verdade estrutural. `PhysicalCellHypothesis` guarda apenas sua chave, referência à interseção, envelope observado, segmentos e regra própria. Não existe célula vazia.

## Ambiguidade, falha e conservação

Interseção parcial, disputa entre interseções e envelope observado externo permanecem explícitos. Ambiguidade herdada da f.2b é conservada somente na disposição do segmento; nenhuma coluna ou interseção artificial é criada. Falha técnica não é ausência e problemas existem somente no nível hierárquico onde surgiram.

Para regiões processáveis, `totalGridIntersectionCount = sourceLineCount × sourcePhysicalColumnHypothesisCount`. Separadamente, todo segmento da região recebe exatamente uma disposição final. Métricas são estruturais; não são score ou confiança.

## Identidade e determinismo

Chaves e fingerprints são SHA-256 de representações JSON canônicas, sem UUID, tempo ou aleatoriedade. O fingerprint final inclui linhagem, interseções, células, disposições, problemas, métricas e limitações. Permutar entradas não altera a saída física.

## Testes

A capacidade possui testes focados de produto cartesiano, posições vazias, contrato mínimo, chaves, canonicalização, determinismo, guard arquitetural e cadeia completa iniciada em bytes de PDF sintético pelo leitor `pdfjs` real.

## Limitações

Interseção não é célula confirmada; hipótese física de célula não é campo econômico; linha não é linha orçamentária; coluna não possui significado econômico; região não é tabela confirmada. Não há interpretação textual, código, descrição, unidade, quantidade, preço, total, BDI econômico, cabeçalho, rodapé, continuidade entre páginas, IA, OCR, persistência, API, UI, documento real ou prontidão comercial.
