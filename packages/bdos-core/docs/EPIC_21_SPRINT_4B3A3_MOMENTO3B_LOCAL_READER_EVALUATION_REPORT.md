# Epic 21 — Sprint 21.4B.3A.3 — Momento 3B — Relatório de Avaliação Objetiva

**Status: avaliação real concluída.** Docling 2.114.0 e PaddleOCR 3.7.0, na configuração exata congelada no Momento 1, foram executados duas vezes cada contra as três renderizações congeladas (páginas 46, 50, 54) e avaliados contra a verdade de referência estruturada (Momento 2) segundo o protocolo pré-registrado (Momento 3A). Nenhuma reexecução para substituir resultado. Nenhum ajuste de configuração após observar as saídas.

## 1. Estado inicial

- Base (verdade de referência): commit `ccd8f8f1627e4f628f8787c36a2b27517a42e29b`.
- Commit do protocolo (Momento 3A): `959f1b14112c379b74ba73f17aea01b45fa302b8`.
- Commit dos adaptadores brutos (Momento 3B.2): `f724eb664f0b6686494a470da24aef405e51741c`.
- Branch: `claude/epic-21-sprint-4b3a3-structured-reference-truth`.
- Arquivos protegidos (`supabase/.temp/cli-latest`, `supabase/tests/data-integrity-validation.sql`): não tocados em nenhum momento desta Sprint.

## 2. Aquisição bruta (Momento 3B.1)

12 execuções (2 ferramentas × 3 páginas × 2 execuções), todas offline, todas concluídas sem erro.

| Ferramenta | Página | Execução | Tempo de importação | Tempo de processamento | Memória máx. (RSS) | Estado | SHA-256 da saída bruta |
|---|---|---|---|---|---|---|---|
| docling | 46 | 1/2 | 18,9s / 14,8s | 46,8s / 45,6s | 567 / 646 MB | completed | `7d8b4134…af990c` (idêntico nas 2 execuções) |
| docling | 50 | 1/2 | 15,1s / 32,3s | 64,8s / 95,1s | 715 / 460 MB | completed | `b94e1e55…269a1d` (idêntico) |
| docling | 54 | 1/2 | 18,4s / 15,1s | 27,8s / 27,1s | 409 / 494 MB | completed | `407297c4…82251` (idêntico) |
| paddleocr | 46 | 1/2 | 4,7s / 4,3s | 356,0s / 353,4s | 319 / 317 MB | completed | `03ac7c3e…64f` (idêntico) |
| paddleocr | 50 | 1/2 | 4,8s / 9,9s | 456,6s / 447,7s | 327 / 258 MB | completed | `714cea4a…4df25` (idêntico) |
| paddleocr | 54 | 1/2 | 4,5s / 6,0s | 226,8s / 353,6s | 298 / 301 MB | completed | `25acbdb9…91e3f6` (idêntico) |

Comando (por execução): `python run_{tool}_acquisition.py <imagem> <página> <execução> <saída>`, ambiente isolado congelado, `HF_HUB_OFFLINE=1`/`PADDLE_PDX_CACHE_HOME` apontando exclusivamente para o cache local já inventariado. Nenhuma tentativa de rede detectada nos logs (varredura textual por `download`/`unauthenticated`/`connection`/URLs — apenas mensagens informativas de "usar cache existente"). Nenhum erro, nenhum aviso, nenhuma falha parcial em nenhuma das 12 execuções. SHA-256 da imagem de entrada reconferido e idêntico ao congelado em todas as 6 páginas antes de cada execução.

Hashes brutos e metadados completos: `private/local-reader-acquisition/` (fora do Git, conforme exigido).

## 3. Adaptadores (Momento 3B.2)

- Arquivos: `raw-adapters/discovery-local-reader-docling-adapter.ts`, `raw-adapters/discovery-local-reader-paddleocr-adapter.ts`.
- Commit: `f724eb664f0b6686494a470da24aef405e51741c`.
- Schema mapeado: inspecionado diretamente nas classes Python instaladas (`docling_core.types.doc.document.{TableCell,TextItem,ProvenanceItem}`) e nas 6 saídas brutas reais do Docling; `res.rec_texts/rec_scores/rec_boxes` confirmados nas 6 saídas brutas reais do PaddleOCR.
- Campos ignorados: Docling — `form_items`, `key_value_items`, `furniture`, `groups` sem `prov` (sem evidência posicional utilizável, documentado no cabeçalho do adaptador). PaddleOCR — `doc_preprocessor_res`, `dt_polys`, `textline_orientation_angles`, `model_settings` (metadados de pipeline, não regiões de conteúdo).
- Coordenadas: Docling — origem lida explicitamente por região (`TOPLEFT`/`BOTTOMLEFT`), unidade sempre pixels (confirmado: `pages["1"].size` == dimensões em pixels da imagem de entrada). PaddleOCR — origem `top_left`, unidade pixels (convenção documentada da biblioteca, confirmada empiricamente).
- Testes: 11 testes com fixtures anonimizadas (`raw-adapters/discovery-local-reader-raw-adapters.test.ts`) — tabela, célula, região, caixa, página, texto, confiança, mesclagem nativa, ausência de coordenada, convenção desconhecida, saída vazia/parcial.
- Prova de ausência de dependência da verdade de referência: guard arquitetural dedicado (`architecture/local-reader-raw-adapter-boundaries.test.ts`), 3 testes, varre todo arquivo de implementação sob `raw-adapters/` por import ou referência nominal a `discovery-reference-truth*` — 0 violações.

## 4. Docling — resultados

**Achado central: com a configuração congelada (sem motor de OCR adicional), o Docling extraiu ZERO texto das 3 páginas reais.** As 6 saídas brutas contêm `"texts": []` em todas. Isto não é uma falha de execução (`finalState: completed` nas 6, sem erros/avisos) — é a consequência direta e já prevista da limitação registrada no Momento 1 ("sem OCR configurado por padrão"): sobre uma imagem raster pura (sem camada de texto de PDF), o modelo de layout do Docling detecta apenas estrutura visual (1 região de tabela + 1 imagem + grupos vazios por página), nunca conteúdo textual.

- **Determinismo:** hash bruto idêntico e hash canônico idêntico entre as 2 execuções, nas 3 páginas (6/6).
- **Regiões (§9.2, ver ressalva de granularidade em §6):** 1 componente "recuperado" por página (a única região de tabela detectada, sem texto, espacialmente sobrepõe 63/70/23 regiões esperadas nas páginas 46/50/54 — ver §6). 10 regiões esperadas (título, cabeçalho, rodapé, nota externa) omitidas em cada página, por completo.
- **Estrutura tabular:** 1 tabela detectada por página, mas com `num_rows=0`/`num_cols=0` — nenhuma célula. Os 358/526/135 células esperadas nas páginas 46/50/54 (1.019 no total) são 100% `expected_cell_omitted`.
- **Campos dos 80 itens:** 0 correspondências literais em qualquer um dos 12 papéis de coluna — consequência direta da ausência total de texto.
- **Descrições multilinha:** os 38 casos reais (ver §6) — 100% `omitted`.
- **Conteúdo externo (TCU, página 46):** `omitted` — nenhum risco crítico (não incorporado a nada, porque nada foi extraído).
- **Evidência matemática:** as 84 relações — 100% `evidencia_ausente`.

## 5. PaddleOCR — resultados

**Achado central: o PaddleOCR recupera texto real e abundante (402/559/163 regiões de texto nas páginas 46/50/54, confiança tipicamente > 0,95) — mas esta configuração (pipeline de OCR geral, os 5 modelos já inventariados) nunca produz nenhuma estrutura de tabela/linha/coluna/célula.** `tables: []` e `cells: []` em todas as 6 execuções, por definição do pipeline (nenhum submódulo de reconhecimento de estrutura foi incluído nesta configuração aprovada).

- **Determinismo:** hash bruto idêntico e hash canônico idêntico entre as 2 execuções, nas 3 páginas (6/6).
- **Regiões (§9.2):** 10/8/8 regiões "recuperadas" por componente (68/75/26 regiões esperadas cobertas, ver §6), 4/3/7 omitidas, 63/77/35 adicionais (a maioria das ~400-560 regiões de texto reais não corresponde a nenhuma região física da verdade de referência — granularidade diferente: OCR produz uma região por linha de texto detectada, a verdade de referência agrupa por bloco físico), 1/2/0 com texto divergente.
- **Estrutura tabular / campos dos 80 itens / descrições multilinha / evidência matemática:** idênticos a zero pelos mesmos motivos estruturais do Docling — mas por uma causa RAIZ diferente e importante: aqui não é ausência de texto (há texto real e correto), é ausência de qualquer noção de linha, coluna ou célula no pipeline usado. Os 38 casos multilinha (§9.5) e as 84 relações matemáticas (§9.7) são 100% `omitted`/`evidencia_ausente` pela mesma razão estrutural.
- **Conteúdo externo (TCU, página 46):** `detected_as_external_or_out_of_table`, `isCriticalRisk: false` — um resultado tecnicamente correto, mas vazio de mérito estrutural: como o PaddleOCR nunca incorpora nada a uma tabela (não tem tabela), esta classificação é automática para qualquer conteúdo nesta configuração, não uma evidência positiva de tratamento correto de conteúdo externo.

## 6. Comparação e ressalvas de granularidade descobertas nesta avaliação (§ "Limites após observar resultados")

Duas características do protocolo congelado (Momento 3A) só se tornaram visíveis com dados reais em escala — registradas aqui exatamente como o processo exige (registrar, não corrigir agora, apresentar prova, aguardar autorização):

1. **`computeLocalReaderRegionTextMetrics` conta por COMPONENTE de comparação, não por região esperada individual.** Prova objetiva: a única região de tabela do Docling (sem texto) forma, por sobreposição espacial, um único componente com 63 regiões esperadas da página 46 (70 na página 50, 23 na página 54) — a métrica congelada reporta "1 região recuperada", quando na verdade 63/70/23 regiões esperadas foram espacialmente tocadas (sem qualquer correspondência textual real). Os números desagregados por componente estão em `results/*-evaluation-result.json` (`regionComparisonDetailByPage`) e no resumo (`expectedRegionsCoveredByAnyRecoveredComponentByPage`) para transparência total, sem alterar a métrica congelada.
2. **A classificação de componentes N:1 (múltiplas regiões esperadas ↔ um observado) nunca verifica se o texto observado realmente corresponde ao texto esperado** — cai diretamente em `"recovered"` sempre que não é o caso estrito 1:1 com texto divergente. Prova objetiva: o componente de 63 regiões do Docling foi classificado `recovered` apesar do texto observado ser uma string vazia (`literalText: ""`). Isto significa que a métrica de "texto exato" nesta situação específica não reflete correspondência textual real, apenas sobreposição espacial de um blob estrutural.

Nenhuma correção foi aplicada ao código do protocolo ou dos adaptadores em resposta a estes achados. Ambos ficam registrados como characterização do comportamento medido do protocolo congelado, aguardando decisão humana sobre se e como corrigir em uma sprint futura.

**Onde cada ferramenta é superior:**
- PaddleOCR é claramente superior em recuperação de texto bruto (402-559 regiões de texto reais por página, alta confiança, origem física rastreável por região) — o Docling não produz nenhum texto nesta configuração.
- Docling é (marginalmente) superior em detecção de estrutura de MAIS ALTO NÍVEL (identifica ao menos a existência e os limites aproximados de uma região tabular) — mas sem nenhuma célula, essa detecção não é utilizável para reconstrução.

**Evidências complementares:** o texto do PaddleOCR (com coordenadas) e a delimitação grosseira de tabela do Docling são evidências de NATUREZA DIFERENTE e não se substituem — nenhuma das duas, isoladamente ou combinada por simples sobreposição espacial, produz uma célula de grade orçamentária utilizável.

**Riscos:** nenhuma invenção de valor monetário por nenhuma ferramenta (nenhuma delas produziu texto algum em posição de célula). Risco de conteúdo externo incorporado: nulo nas duas ferramentas nesta execução real (mas por motivos estruturais triviais, não por tratamento inteligente).

**Custo local, memória, tempo:** Docling — 3 páginas em ~140s de processamento total, pico de 715 MB. PaddleOCR — 3 páginas em ~1.040s (~17 min) de processamento total, pico de 327 MB (mais lento, porém mais leve em memória).

## 7. Decisão arquitetural

Aplicando literalmente o classificador de viabilidade congelado (§10 do protocolo), sem qualquer ajuste:

- **Docling: não viável nesta configuração.** Motivos (do classificador): não forneceu origem física utilizável para os campos críticos; não produziu estrutura utilizável de tabela/célula.
- **PaddleOCR: não viável nesta configuração**, pelo mesmo par de critérios — mas com uma ressalva importante registrada em §6: o classificador congelado dá precedência absoluta aos critérios "não viável" sobre "candidato complementar" sempre que a estrutura de tabela está ausente, tornando a categoria "candidato complementar" estruturalmente inatingível para qualquer ferramenta sem submódulo de tabela — mesmo quando essa ferramenta (como o PaddleOCR aqui) fornece evidência de texto real, abundante e rastreável. Isto é uma característica do desenho do classificador congelado, não um erro de implementação corrigido agora.

**Combinação necessária:** nem o Docling nem o PaddleOCR, nesta configuração 100% local e gratuita, produzem uma reconstrução tabular utilizável isoladamente. A evidência real (texto do PaddleOCR + delimitação grosseira de tabela do Docling) é qualitativamente complementar, mas nenhuma combinação por sobreposição espacial simples destas duas saídas específicas produziria uma grade de 12 colunas × 80 itens sem inferência estrutural adicional — que o protocolo desta etapa proíbe explicitamente. **Não se afirma que o orçamento foi ou pode ser reconstruído automaticamente com as ferramentas nesta configuração exata.**

## 8. Próxima etapa mínima

O menor componente determinístico necessário, indicado apenas para registro (não implementado nesta Sprint): um motor de formação de linha/coluna que receba EXCLUSIVAMENTE regiões de texto com coordenada (como as do PaddleOCR) e as posicione contra os limites de coluna já geometricamente conhecidos e aprovados (`discovery-reference-truth-columns.ts`, Momento 2) — sem depender de nenhuma estrutura de tabela nativa de nenhum leitor, já que nenhum dos dois leitores locais avaliados a fornece de forma utilizável. Isto reconstituiria linhas lógicas e células a partir de evidência de texto puro + geometria de coluna já congelada, deixando a extração de valores/hierarquia/reconciliação para etapas determinísticas subsequentes, cada uma com seu próprio pré-registro. Esta implementação não foi iniciada.

---

### Confirmações finais

- Determinismo: 12/12 execuções byte-idênticas entre as 2 repetições (hash bruto e hash canônico).
- `tsc --noEmit -p .`: limpo.
- Nenhuma alteração em produção, no registro de maturidade, ou nos 5 arquivos sensíveis.
- Os 2 arquivos protegidos permanecem fora do stage.
- Concretisa: não executado.
- Nenhum PR aberto.
