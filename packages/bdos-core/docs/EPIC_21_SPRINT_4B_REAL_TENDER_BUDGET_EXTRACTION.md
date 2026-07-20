# Epic 21 — Sprint 21.4B — Primeiro Edital Real e Extração do Orçamento

**Status: primeira fatia vertical real executada de ponta a ponta contra um documento oficial real (DNOCS — Lagoa do Arroz). A cadeia documental completa (f.0→g.3) processa o PDF real sem falhar tecnicamente, mas a detecção de regiões/colunas (f.1/f.2a), calibrada e testada até aqui só contra tabelas sintéticas de 2 colunas, fragmenta a tabela real densa de 9-10 colunas — impedindo reconciliação efetiva contra os fatos oficiais (11 grupos, 25 subgrupos, 300 itens, R$ 9.809.087,18) nesta rodada. Veredito: E — falha técnica da cadeia, isolada a f.1/f.2a, não à capacidade nova desta Sprint.**

## Objetivo e o que esta Sprint prova

Diferente das sprints anteriores (f.2c→g.1→g.2→g.3, todas preparatórias, todas validadas só contra fixtures sintéticas), esta é a primeira fatia vertical real: PDF oficial → cadeia documental → localização da planilha → extração das linhas → revisão humana → Proposta de Importação. O critério de aceitação nunca foi "o pipeline rodou" — é a reconciliação efetiva contra os fatos externos do caso real.

## Documento real selecionado

`01_Origem_Edital/05_Anexo_Tecnico_Termo_Referencia.pdf` (1033 páginas, SHA-256 `5031da75...b92c5`), dentro do conjunto de 43 PDFs oficiais baixados diretamente do portal do DNOCS (Pregão Eletrônico 90006/2025). A planilha orçamentária oficial em si (referenciada no edital apenas por link `.url` não baixável) não existe como PDF autônomo no dossiê local — mas o Anexo Técnico a incorpora, em duas variantes de regime (Desonerado nas páginas ~24-33, Não Desonerado nas páginas ~45-54). A variante Não Desonerado foi confirmada como a correspondente ao valor de referência oficial por comparação direta: o total do Grupo 01.00.00 na página-resumo (R$ 2.006.878,46) bate exatamente com o mesmo grupo na fixture oficial já existente no repositório (`lagoa-do-arroz.official-fixture.ts`, extraída independentemente da planilha XLSX original). Páginas 46-54 (9 páginas, a tabela completa item a item, excluindo deliberadamente a página-resumo 45 para evitar dupla contagem de grupos) foram selecionadas para processamento.

## Achado central: fragmentação estrutural em tabela real densa

A cadeia real completa (leitura física → localização de páginas → reconstrução estrutural → detecção de regiões → reconstrução de colunas → hipóteses de célula → evidência textual → g.2 → g.3) processa as 9 páginas sem nenhum status `failed` em nenhuma etapa. Mas a região tabular real (9-10 colunas visíveis: ITEM, FONTE DE PESQUISA, TIPO, DESCRIÇÃO, UNID, QUANT., CUSTO UNIT. S/BDI, BDI(%), UNIT. C/BDI, TOTAL C/BDI) é fragmentada pela detecção de regiões (f.2a) em 7 regiões separadas numa única página, cada uma resolvendo no máximo 2 colunas de malha — muito aquém das 9-10 visíveis. A causa mais provável, confirmada por inspeção direta das linhas físicas reconstruídas: linhas de descrição que quebram em duas linhas físicas (texto longo demais para a largura da célula) interrompem a continuidade de alinhamento vertical exigida pela formação de região — um padrão nunca exercitado pelos testes sintéticos de f.1/f.2a até aqui, que sempre usaram descrições de uma linha só.

Sem colunas suficientes, o cabeçalho da tabela não produz posições de malha reconhecíveis, e a nova capacidade de caracterização econômica (corretamente, dado o que recebe) classifica as 179 linhas físicas processadas como `ambiguous`/`requires_review` — nunca inventando grupo, subgrupo, código, unidade, quantidade ou preço a partir de texto que não conseguiu associar a um papel de coluna confiável.

**Isolamento do achado**: comprovado, por suíte sintética completa (ver abaixo), que a capacidade de caracterização econômica em si funciona corretamente — reconhece cabeçalho, Grupo, Subgrupo, Item de Serviço, o caso `COT-015` (item sem código, herança posicional), parsing monetário/quantidade brasileiro, reconciliação quantidade×preço=total, diff linha a linha contra referência independente, fingerprint determinístico — quando recebe uma região g.2 bem formada. O problema está inteiramente a montante, em f.1 (calibração de segmento físico) e f.2a (continuidade de alinhamento através de linhas quebradas), nunca na capacidade desta Sprint.

## Capacidade nova: Caracterização Econômica

`packages/bdos-core/src/domain/budget-document-economic-characterization/` — domínio novo, **irmão** de `budget-document-location` e `budget-version` (nunca aninhado dentro de `budget-document-location`, que precisa permanecer economicamente neutro por regra arquitetural já existente e verificada por guard de pacote inteiro). Consome exclusivamente os resultados publicados pela g.2 e pela g.3; nunca relê o PDF; nunca importa f.0/f.1/f.2a/f.2c/g.1/página diretamente (guard dedicado). Produz `ProposedBudgetLine[]` — nunca uma `BudgetLine` definitiva.

Reconhecimento de papel de coluna: catálogo de rótulos versionado (§15 do mandato), comparação por texto normalizado contra cabeçalhos candidatos (linhas com ≥3 papéis reconhecidos em posições distintas) — nunca coordenada fixa, nunca regra do caso real. Classificação de linha: padrão hierárquico XX.YY.ZZ (YY=00 e ZZ=00 → Grupo; ZZ=00 → Subgrupo; senão → Item) mais herança posicional de seção para itens sem código (caso `COT-015`) — nunca inferido do próprio item. Parsing brasileiro determinístico (`1.234,56`, sem interpretar formato americano, sem aceitar negativo, quantidade com escala decimal preservada exatamente). Reconciliação quantidade×preço=total com aritmética inteira exata (`BigInt`, arredondamento meio-para-cima explícito, nunca ponto flutuante). Diff linha a linha só quando existe referência independente — nunca compara a extração contra ela mesma.

## Reconciliação linha a linha: referência independente já existente

A fixture `LAGOA_DO_ARROZ_OFFICIAL_LINES` (`domain/budget-version/lagoa-do-arroz.official-fixture.ts`), extraída na Sprint 21.3B diretamente da planilha XLSX oficial (SHA-256 distinto do PDF desta Sprint), já serve como referência independente confiável para o diff linha a linha — nenhuma nova extração de referência foi necessária. Usada apenas para relatório de aceitação; nunca influencia a extração.

## Checkpoint C — criação de rascunho: bloqueada, precisamente

Os serviços de aplicação (`createBudgetVersionDraftService`, `addBudgetLineService`, `consolidateBudgetVersionService`) e o domínio puro (`createBudgetVersion`, `addBudgetLine`) já existem e são suficientes — **Categoria A** conceitualmente. Mas nenhuma implementação real de `BudgetVersionRepository`/`ProcurementCaseRepository` existe no repositório (confirmado: nenhuma migration `budget_versions`/`budget_lines`, apenas repositórios falsos em memória nos próprios testes de serviço) — **Categoria C** na prática: criar essa persistência é uma expansão de escopo relevante (nova migration, RLS, isolamento por organização), fora desta Sprint por instrução explícita ("não criar migration... não improvisar persistência").

## Testes

Suíte sintética nova: reconhecimento de coluna/cabeçalho, classificação de linha (10 tipos), padrão hierárquico e resolução de pai (órfão, item direto sob Grupo sem Subgrupo — caso real confirmado pela fixture, herança posicional estilo `COT-015`), parsing monetário/quantidade brasileiro (separadores, negativo, formato americano rejeitados, escala decimal variável), reconciliação, diff contra referência independente (matched/missing/extra), diagnóstico de autoconsistência sem referência, fingerprint determinístico, não-fusão em continuidade não sustentada. Guard arquitetural dedicado (8 verificações, incluindo ausência de hardcode do caso real e ausência de consolidação automática). 248/248 arquivos de teste do repositório inteiro passam, incluindo toda a regressão de f.1-g.3.

## Diagnóstico do documento real

`pnpm --filter @bba/bdos-core diagnose:real-budget-document -- "<caminho>" [páginaInicial-páginaFinal]` — nunca roda em CI, nunca inclui o PDF, saída sanitizada em `/private/budget-import-diagnostics/` (ignorado pelo Git). Vive em `packages/bdos-core/scripts/`, fora de `src/`, porque é o único ponto do pacote que legitimamente cruza o adaptador PDF real, toda a cadeia documental, a caracterização econômica e a fixture real de `budget-version` — nenhum guard de `src/` deveria (nem deveria) permitir essa combinação em código de domínio ou produção.

## Limitações

Reconhecimento de coluna/linha limitado ao catálogo observado nesta Sprint; nenhuma generalização para outros layouts de edital; thresholds de f.1/f.2a não recalibrados (fora de escopo — ver achado central); nenhuma consolidação automática; nenhum código externo usado como identidade; nenhuma IA/LLM/OCR; laboratório administrativo (Checkpoint B) não construído nesta rodada, por prioridade explícita do mandato (rigor da extração > UI).

## Próximo passo recomendado

Recalibrar, em sprint dedicada, com regressão completa contra os golden traces já aprovados: (1) o limiar de gap de segmento em f.1 para texto denso; (2) a continuidade de formação de região em f.2a para tolerar linhas fisicamente quebradas sem fragmentar a tabela. Só depois repetir esta Sprint contra o mesmo documento real para fechar a reconciliação 11/25/300/R$ 9.809.087,18.
