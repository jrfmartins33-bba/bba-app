# Camada B — Histórico Documental Item a Item (MED-01…MED-N)

> Status: **ESPECIFICAÇÃO + PARSER/RECONCILIAÇÃO PRONTOS. NÃO
> MATERIALIZADA.** Parser de produção (com detecção de formato numérico
> e Nº de medição por aba), taxonomia semântica, modelo de observação
> item × período, motor de reconciliação ITENS→GRUPO→OBRA→Curva S,
> prévia exata e testes — todos no repositório. Migration `20260828000000`
> **reescrita para o grão de observação v2 e NÃO aplicada**; nenhum
> histórico de negócio escrito no Supabase.

## 0. Achados da rodada de Parte B (arquivo real `BM_08`)

- **177 abas** de memória em **7 cortes de medição heterogêneos**:
  MED-01 (3), MED-02 (13), MED-04 (29), MED-05 (84), MED-06 (17),
  MED-07 (13), **MED-08 (18)**. **Não existe** um "acumulado item a
  item no mês X" para X < junho/2026 — cada aba congela o estado na
  data do seu próprio cabeçalho.
- **Só 2 das 177** abas têm a grade `PERÍODO | QUANTIDADE` parseável →
  reconstrução mês a mês por item é **documentalmente impossível** em
  geral.
- **Nenhum valor monetário** nas memórias — o valor é sempre **derivado**
  (`quantidade × preço unitário do contrato`).
- A grade `MED-NN FINANCEIRO` da aba `BOLETIM DE MEDIÇÃO 08` **não
  reconcilia** com o realizado mensal da Curva S (ex.: coluna MED-08
  soma R$ 964.483,89 ≠ R$ 252.654,78) → confirmada como
  `historical_grid_not_authoritative`.
- **Único período que fecha item a item:** junho/2026, pelas **15 linhas
  formais** do BM nº 08 → grupo 1 (R$ 42.015,69) + grupo 2
  (R$ 210.639,09) = obra (R$ 252.654,78) = Curva S. `reconciled_exact`.
- Meses anteriores: `insufficient_documentary_basis` — **reportado, nunca
  preenchido**. 108/177 abas inequívocas; 29 itens acima do contrato;
  102 itens com "executada" ≠ "medida".

## 1. Por que uma camada nova

O "Controle Gerencial da Execução" (Camada A, já entregue) responde a
partir de dado **autoritativo e persistido**: base contratual (300
itens), posição certificada por item (`measurement_certified_item_balances`,
hoje toda zerada), BM do período atual (`measurement_workspace_lines`) e
contexto físico-financeiro do grupo. O que Camada A **não** tem é o
**acumulado histórico por item** (MED-01…MED-07). Ele existe apenas nas
abas "MEMÓRIA DE CÁLCULO" do XLSX do boletim e **não é importado** — o
parser de boletim inclusive marca a grade MED-NN da aba principal como
`historical_grid_not_authoritative` (preenchida à mão, não reconcilia
com o total oficial).

## 2. Fonte documental (arquivo real: `BM_08_LAGOA DO ARROZ _R_00.xlsx`)

- **177 abas** com nome no padrão `NN.NN.NN` (162 ocultas) — uma memória
  de cálculo por item. O contrato tem **300 itens** → **123 itens sem
  memória**.
- Cada aba tem cabeçalho `MEMÓRIA DE CÁLCULO - MEDIÇÃO NN` e, em geral,
  um bloco `RESUMO` com cinco campos rotulados:
  | rótulo na planilha | campo canônico |
  |---|---|
  | Quantidade Contratada..... | `contract_quantity` |
  | Quantidade executada acumulada atual... | `executed_accumulated_quantity` |
  | Quantidade medida acumulada em medições anteriores... | `measured_accumulated_quantity` |
  | Quantidade a medir no período..... | `quantity_to_measure_in_period` |
  | Saldo contratual.................. | `contract_balance_quantity` |
- Algumas abas trazem uma grade `PERÍODO | QUANTIDADE` (serial de data +
  quantidade do mês). **Só ~2 das 177** têm essa grade em forma
  parseável → **não há como reconstruir MED-01…MED-N mês a mês por item**
  de forma geral; só o **snapshot** do bloco RESUMO.

## 3. Taxonomia de layouts (protótipo `extractMemoriasDeCalculo`)

| layout | contagem (177) | interpretável? |
|---|---|---|
| `resumo_value_after_unit` (limpo — "9 MÊS") | ~105 | sim |
| `resumo_label_bleed` (rótulo "……" vaza para a coluna de valor) | ~67 | **não** sem inspeção |
| `resumo_value_before_unit` ("TON X KM 0") | ~3 | com ajuste |
| `no_resumo_block` | ~2 | não |
| `resumo_with_ref_errors` (`#REF!`) | 0 (nesta pasta; a aba `ACULMULADO` inteira é `#REF!` de template Tamboril/Jaguaribe) | não |

**Inequivocamente interpretáveis** pelo protótipo: **~108 / 177**
(contratada + medida acumulada + a medir todas legíveis). Número
**otimista**: os formatos numéricos são heterogéneos — algumas células
usam vírgula decimal (`430,92`), outras ponto de milhar (`43.092`) —
então "108" ainda precisa de **detecção de formato por aba** + revisão.

## 4. Campos canônicos vs. campos que ficam PENDENTES

**Extraíveis (com revisão de formato):** `contract_quantity`,
`measured_accumulated_quantity`, `quantity_to_measure_in_period`,
`contract_balance_quantity`, `unit`.

**Ambíguos / pendentes de decisão humana:**
- **`executed_accumulated_quantity` × `measured_accumulated_quantity`** —
  são **diferentes** (ex. item `01.02.01`: executada 8, medida 7). Só a
  *medida* é candidata a "acumulado documental" do Controle Gerencial; a
  *executada* é execução física declarada.
- **Itens acima do contrato** — ex. `01.02.04`: executada 23,1 m² vs.
  contratada 9 m², saldo −14,1, com P.S. de replanilhamento. Não é erro
  de leitura; é estado do documento. Não canonicalizar como se fosse.
- **123 itens sem memória** — aparecem no Controle Gerencial como "sem
  histórico documental", nunca como "acumulado 0".
- **Notas livres** (P.S., assinaturas de fiscal, replanilhamento) —
  143/177 abas têm texto colado no bloco. Guardadas como *evidência*
  (`freeform_notes` no protótipo), **nunca** como dado.

## 5. Modelo de domínio proposto

`packages/bdos-core/src/domain/measurement-item-documentary-history/`:
- `ParsedMemoriaResumo` — saída do parser por aba (layout + 5 campos +
  `unambiguous` + notas + `periodSeries`).
- `MemoriaExtractionResult` — agregado (contagens por layout,
  `unambiguousCount`, `codesWithoutMemoria`).
- `MeasurementItemDocumentaryHistoryRecordProposal` — grão de
  persistência (item × boletim de origem).

## 6. Persistência proposta (migration `20260828000000`, **NÃO aplicada**)

Tabela `measurement_item_documentary_history`:
- **Granularidade:** 1 linha por `(managed_service_item_id,
  measurement_bulletin_import_id)`.
- **Colunas de quantidade:** `NUMERIC(20,6)`, **nullable** (ausência
  documental = NULL). `contract_quantity`, `executed_accumulated_quantity`,
  `measured_accumulated_quantity`, `quantity_to_measure_in_period`,
  `contract_balance_quantity` — nunca derivadas umas das outras.
- **Confiabilidade:** `layout` (enum) + `unambiguous BOOLEAN` — linhas
  `unambiguous = false` nunca alimentam decisão automática.
- **Proveniência obrigatória:** `source_sheet_name`, `source_file_name`,
  `item_code`, `measurement_bulletin_import_id`.
- **Idempotência:** índice único `(managed_service_item_id,
  measurement_bulletin_import_id)`; reimportar o mesmo boletim faz
  `ON CONFLICT DO UPDATE` (writer futuro), nunca duplica.
- **RLS:** company-or-admin em SELECT/INSERT/UPDATE; DELETE bloqueado.
- **Linhas estimadas:** até **177** por importação de boletim (uma por
  aba de memória); ~1.900 se acumulado por todos os BMs históricos do
  contrato (MED-01…MED-08 × ~177+ itens), a confirmar quando os BMs
  anteriores forem importados.

## 7. Reconciliação possível

- **BM atual:** a soma das 15 linhas do BM_08 = **R$ 252.654,78** = total
  do boletim. ✅ (Camada A já reconcilia isto.)
- **Acumulado documental × físico-financeiro da obra:** o acumulado
  físico-financeiro é **R$ 4.772.540,69**, **grupo a grupo** (Curva S),
  com metodologia própria. A soma item a item **NÃO fecha
  automaticamente** nele: (a) 123 itens não têm memória; (b) "executada"
  ≠ "medida"; (c) a aba `RESUMO` do próprio arquivo reconcilia
  `ACUMULADO ANTERIOR + NO PERÍODO = ACUMULADO ATUAL` **só em nível de
  grupo/subgrupo** (ex. grupo `01.00.00`: 927.633,49 + 42.015,69 =
  969.649,18 = read model). **Qualquer divergência item a item deve ser
  REPORTADA, nunca ajustada.**

## 8. Gaps / bloqueios antes de materializar

1. Detecção de formato numérico por aba (vírgula decimal vs. ponto de
   milhar) — sem isso, ~40% das abas são lidas com valor errado.
2. Decisão de produto: `measured` vs `executed` como base do "acumulado
   documental".
3. Tratamento dos 123 itens sem memória (mostrar "não disponível", nunca 0).
4. Tratamento dos itens acima do contrato (flag, sem inventar explicação).
5. Se os BMs anteriores (MED-01…MED-07) forem importados, decidir se o
   histórico vem de cada `analysis_result` ou de um re-parse das abas.

## 9. Próximo passo (requer autorização)

Rodada dedicada: (a) parser de produção com detecção de formato +
verificação humana da amostra; (b) `supabase db push` da migration
`20260828000000` (com o mesmo protocolo de prévia — schema, nº de
linhas, fingerprint, idempotência, impacto); (c) writer idempotente;
(d) Camada A passa a exibir "acumulado documental" real por item, com a
distinção documental × certificado já preparada.
