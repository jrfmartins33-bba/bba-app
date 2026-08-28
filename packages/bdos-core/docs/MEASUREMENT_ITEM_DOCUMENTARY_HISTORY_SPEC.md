# Camada B — Histórico Documental Item a Item (MED-01…MED-N)

> Status: **ESPECIFICAÇÃO + PARSER/RECONCILIAÇÃO PRONTOS. NÃO
> MATERIALIZADA.** Parser de produção (com detecção de formato numérico
> e Nº de medição por aba), taxonomia semântica, modelo de observação
> item × período, motor de reconciliação ITENS→GRUPO→OBRA→Curva S,
> prévia exata e testes — todos no repositório. Migration `20260828000000`
> **reescrita para o grão de observação v2 e NÃO aplicada**; nenhum
> histórico de negócio escrito no Supabase.

## 0. Achados da rodada de Parte B (arquivo real `BM_08`, universo = 300 itens autoritativos)

- **Base Contratual: exatamente 300 `managed_service_items`.** As 336
  linhas `NN.NN.NN` do boletim incluem 36 cabeçalhos de grupo/subgrupo
  (`01.00.00`, `01.02.00`…) — **nunca contadas como itens**.
- **177 abas** de memória; **175 resolvem contra os 300 itens oficiais**.
  As **2 restantes** (`01.07.09`, `02.07.49`) são **códigos transpostos**
  dos itens reais `07.01.09` / `07.02.49` — ficam FORA do universo item a
  item até haver confirmação humana da transposição (nunca vínculo
  automático por similaridade).
- **7 cortes de medição heterogêneos**: MED-01 (3), MED-02 (13),
  MED-04 (29), MED-05 (84), MED-06 (17), MED-07 (13), **MED-08 (18)**.
  **Não existe** um "acumulado item a item no mês X" para X < junho/2026.
- **Só 2 das 177** abas têm a grade `PERÍODO | QUANTIDADE` parseável.
- **QUANTIDADE DOCUMENTAL × VALOR DERIVADO:** as memórias trazem SÓ
  quantidade. `quantidade × preço unitário` é **VALOR DERIVADO DE
  REFERÊNCIA** (política monetária explícita, `source-document-truncation-to-cents`)
  — nunca "valor documental", nunca evidência de reconciliação financeira.
- A grade `MED-NN FINANCEIRO` da aba `BOLETIM DE MEDIÇÃO 08` **não
  reconcilia** (coluna MED-08 soma R$ 964.483,89 ≠ R$ 252.654,78) →
  `historical_grid_not_authoritative`.
- **Único período que fecha item a item:** junho/2026, pelas **15 linhas
  formais AUTORITATIVAS** do BM nº 08 → grupo 1 (R$ 42.015,69) + grupo 2
  (R$ 210.639,09) = obra (R$ 252.654,78) = Curva S. `reconciled_exact`.
- Meses anteriores e julho/2026: `insufficient_documentary_basis` —
  **reportado, nunca preenchido**.
- **107/300** itens com ≥1 período histórico inequívoco →
  **193/300 sem histórico documental recuperável**. 29 itens acima do
  contrato; 101 com "executada" ≠ "medida". 0 divergências, 0 cobertura
  parcial, 0 valores derivados de acumulado.

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

## 6. Persistência proposta (migration `20260828000000`, **NÃO aplicada**) — grão de observação v2

Tabela `measurement_item_documentary_history`:
- **Granularidade:** 1 linha por `(managed_service_item_id,
  measurement_bulletin_import_id, semantic_field, measurement_ref)` —
  observação item × campo semântico × Nº de medição de referência.
- **Identidade:** SÓ `managed_service_item_id` (FK NOT NULL). Sem coluna
  `identity_basis`; vínculo por descrição/similaridade nunca é aceito.
- **QUANTIDADE DOCUMENTAL:** `quantity_decimal NUMERIC(20,6) NOT NULL`
  (ausência documental fica FORA da tabela).
- **VALOR DERIVADO DE REFERÊNCIA:** `derived_reference_value_decimal
  NUMERIC(20,2)` + `derived_reference_monetary_policy_key TEXT`, com
  `CHECK (value IS NULL OR policy_key IS NOT NULL)`. Não é "valor
  documental"; não reconcilia com a Curva S. Sem política comprovada →
  NULL. `source-document-truncation-to-cents` NÃO é default da tabela.
- **Só INEQUÍVOCA persiste:** `CHECK (is_unambiguous = true AND
  semantic_field <> 'ambiguous' AND numeric_format_hint <> 'ambiguous')`.
  As **205 observações ambíguas** ficam no parser/preview/relatório de
  exceções — **nunca** nesta tabela.
- **Proveniência obrigatória:** `source_sheet_name`, `source_file_name`,
  `source_cells TEXT[]`, `item_code`.
- **Idempotência:** dois índices únicos parciais (`measurement_ref`
  pode ser NULL para a grade PERÍODO|QUANTIDADE); `ON CONFLICT DO
  UPDATE` no processo de ingestão futuro.
- **Segurança (GRANT/REVOKE explícitos, não só RLS):** `anon`/PUBLIC →
  nada; `authenticated` → SELECT apenas (filtrado por RLS company-or-admin);
  `service_role` → SELECT + INSERT + UPDATE; **DELETE não concedido a
  papel de aplicação nenhum**. RLS também bloqueia INSERT/UPDATE/DELETE
  do cliente (defesa em profundidade).
- **Linhas EXATAS do BM nº 08 (universo = 300 itens, se autorizado):**
  **337 persistíveis** — `quantity_to_measure_in_period` 107 +
  `measured_accumulated_quantity_prior` 107 +
  `executed_accumulated_quantity` 107 + `monthly_series_quantity` 16.
  **205 excluídas por ambiguidade documental.** 107 `managed_service_items`
  distintos; **193/300 sem nenhuma linha persistível**. 337/337 com
  valor derivado (política `source-document-truncation-to-cents`), 0
  `derived_from_cumulative`.

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
