# Epic 21 — Sprint 21.4B.3A.3 — Momento 3C.2 — Relatório de Métricas Corrigidas (Fechamento)

**Status: fechamento consolidado concluído.** A execução real corrigida (v2) do avaliador de leitores locais foi executada duas vezes de forma independente contra as 12 saídas brutas já congeladas no Momento 3B (nenhuma releitura, nenhuma reexecução de Docling/PaddleOCR), comparada semanticamente, e publicada apenas após comprovação de determinismo. Este documento fecha a Sprint 21.4B.3A.3.

## 1. Estado inicial

- Base (verdade de referência): commit `ccd8f8f`.
- Protocolo v1 (Momento 3A): commit `959f1b1`.
- Adaptadores brutos (Momento 3B.2): commit `f724eb6`.
- Avaliação v1 real (Momento 3B): commit `b05e817`.
- Correção matemática/proveniência (Momento 3C.1A): commit `31a43a6`.
- Contrato v2 final (Momento 3C.1B): commit `cb68205`.
- Correção estrutural da guarda `budget-document-location-boundaries.test.ts` (achado durante 3C.2A): commit `a4e201e`.
- Implementação v2 contra fixtures sintéticas (Momento 3C.2A): commit `18f5211`.
- Fluxo imutável corrigido congelado (fechamento, seção 10 desta autorização): commit `edf63c1`.
- Branch: `claude/epic-21-sprint-4b3a3-structured-reference-truth`.
- Arquivos protegidos (`supabase/.temp/cli-latest`, `supabase/tests/data-integrity-validation.sql`): não tocados em nenhum momento desta Sprint.

## 2. Implementação consolidada (lacunas §4.1–§4.4 fechadas nesta execução)

Quatro lacunas conhecidas do v2, registradas na autorização desta Sprint, foram fechadas em `evaluation-run/run-local-reader-evaluation-v2.ts` e módulos auxiliares novos, sem alterar nenhum arquivo v1:

1. **Conteúdo externo (§4.1):** a constante `incorporatedTcuNoteAsItemOrValue: false` foi removida. `derive-external-content-v2.ts` deriva o resultado real reutilizando `classifyLocalReaderExternalContent` (v1, inalterado) a partir das comparações reais de região/célula; `viability` recebe `externalContent?.isCriticalRisk ?? false`.
2. **Estrutura de tabela (§4.2):** `tableStructureByPage` foi restaurado no resultado v2 e no resumo agregado, reaproveitando `computeLocalReaderTableStructureMetrics` (v1, inalterado) — nenhuma métrica v1 válida foi removida.
3. **Contagem de células (§4.3):** `directMatchCellsTotal` agora é `allCellComparisons.filter(c => c.outcome === "direct_match").length` (todas as células), mantido separado de `criticalFieldLiteralMatchesTotal` (apenas papéis críticos). Teste dedicado (1 célula crítica + 1 não crítica, ambas correspondentes) confirma `directMatchCellsTotal=2` vs `criticalFieldLiteralMatchesTotal=1`.
4. **Execução imutável e segura (§4.4):** o executor (`run-local-reader-evaluation-v2.ts`) exige `--output-dir` e falha antes de ler qualquer arquivo bruto se ausente (`parse-output-dir-arg-v2.ts`). O orquestrador (`orchestrate-corrected-evaluation-v2.ts`) valida as 12 entradas, executa duas vezes em processos separados/diretórios temporários independentes, compara semanticamente (`compare-canonical-runs-v2.ts`), só publica em caso de igualdade (`decide-publication-v2.ts`), e gera a comparação v1×v2 mecânica (`generate-comparison-v1-v2.ts`). Nenhum destino é hardcoded — `--final-output-dir` é sempre explícito.

**Correção não-semântica registrada (pendência não bloqueante, seção 16):** durante a primeira tentativa de execução real do orquestrador neste ambiente Windows, `execFileSync("npx.cmd", ...)` falhou com `EINVAL` (spawn sem shell de um `.cmd`), e a alternativa `shell: true` corrompeu o caminho do executor porque o repositório contém um espaço (`BBA APP`), truncando o comando. A correção (commitada junto com a publicação dos resultados, não junto ao commit congelado `edf63c1`) resolve o CLI do `tsx` via `createRequire(...).resolve("tsx/cli")` e invoca `process.execPath` diretamente sem shell — nenhuma dependência nova, nenhuma alteração de versão, zero mudança de semântica de validação, comparação, publicação ou métrica. Nenhuma tentativa de execução chegou a produzir resultado antes desta correção; a primeira saída real só existe depois dela.

## 3. Entradas (validação das 12 amostras brutas)

`raw-input-validation.v2.json`: **12/12 válidas**, `overallValid: true`, zero arquivos inesperados. Todas as 6 combinações página×ferramenta com hash SHA-256, `toolVersion` e `finalState` idênticos entre as 2 execuções cada, todas com metadados essenciais presentes. Nenhum arquivo foi recriado; nenhum leitor foi reexecutado — apenas leitura e comparação de bytes/metadados já existentes em `private/local-reader-acquisition/` (fora do Git).

## 4. Determinismo (A×B)

`run-repetition-validation.v2.json`: **`identical: true`** — os 3 arquivos gerados (`docling-evaluation-result.v2.json`, `paddleocr-evaluation-result.v2.json`, `aggregate-summary.v2.json`) são semanticamente idênticos entre as duas execuções independentes (processos separados, diretórios temporários distintos), sem nenhuma diferença de valor, estrutura, classificação ou ordenação semântica — apenas potenciais diferenças de ordem de chaves, que não contam como divergência. O conjunto canônico só foi publicado em `results/corrected-v2/` após esta comprovação.

## 5. Resultados Docling (v2, dados reais)

- **Determinismo:** hash bruto e canônico idênticos nas 3 páginas (herdado do v1, reconfirmado).
- **Regiões (granularidade corrigida — §1 do achado do Momento 3B, agora corrigido):** `expectedRegionsCoveredByAnyComponent` = 63/70/23 (páginas 46/50/54) — o número real de regiões esperadas tocadas espacialmente, não mais "1" por página como a métrica v1 reportava por contar componentes. **`expectedRegionsWithExactTextualMatch` = 0/0/0 nas 3 páginas** — nenhuma correspondência textual real, consistente com o `literalText: ""` do Docling nesta configuração (achado v1, agora com prova textual explícita, não apenas inferida).
- **Estrutura de tabela:** `tableStructureByPage` presente para as 3 páginas — 358/526/135 células, 100% `expected_cell_omitted` (1.019 células no total, todas omitidas).
- **Contagem de células:** `directMatchCellsTotal = 0`, `criticalFieldLiteralMatchesTotal = 0` — idênticos entre si aqui porque o Docling não produz nenhuma célula com texto, então a distinção introduzida em §4.3 não altera o resultado numérico para este leitor especificamente (mas está estruturalmente disponível e testada separadamente).
- **Descrições multilinha:** 38 casos, 100% `omitted` — agora derivado do mesmo mecanismo real de comparação de células, não hardcoded.
- **Conteúdo externo (TCU, página 46):** `detected_as_external_or_out_of_table`, `isCriticalRisk: false` — corrigido de `omitted` (v1, resultado de constante fixa nunca avaliada) para um resultado genuinamente derivado das comparações de região reais.
- **Evidência matemática:** 84 relações, 100% `evidencia_ausente`.
- **Viabilidade:** `nao_viavel_nesta_configuracao` — inalterada.

## 6. Resultados PaddleOCR (v2, dados reais)

- **Determinismo:** hash bruto e canônico idênticos nas 3 páginas.
- **Regiões (granularidade corrigida):** `expectedRegionsCoveredByAnyComponent` = 69/77/26 (vs. 10/8/8 na métrica v1, que contava componentes de associação, não regiões esperadas individuais). **`expectedRegionsWithExactTextualMatch` = 24/20/6** — ao contrário do Docling, o PaddleOCR produz correspondência textual real e mensurável, agora visível de forma granular (antes obscurecida pela contagem por componente).
- **Estrutura de tabela:** `tableStructureByPage` presente — mesmas 358/526/135 células por página (1.019 no total), 100% `expected_cell_omitted` — o PaddleOCR nunca produz célula de tabela nesta configuração (pipeline sem submódulo de estrutura), independentemente de produzir texto correto.
- **Contagem de células:** `directMatchCellsTotal = 0`, `criticalFieldLiteralMatchesTotal = 0` — mesma consequência estrutural do Docling (ausência de células), por causa raiz diferente (aqui por ausência de reconhecimento de estrutura, não de texto).
- **Descrições multilinha:** 38 casos, 100% `omitted`.
- **Conteúdo externo (TCU, página 46):** `detected_as_external_or_out_of_table`, `isCriticalRisk: false` — inalterado do v1 (já era genuinamente derivado no v1 para este leitor).
- **Evidência matemática:** 84 relações, 100% `evidencia_ausente`.
- **Viabilidade:** `nao_viavel_nesta_configuracao` — inalterada.

## 7. Comparação v1×v2

`comparison-v1-v2.json`: 64 linhas geradas mecanicamente (32 por ferramenta), nunca com valores hardcoded — todos extraídos por acessor genérico a partir dos resultados v1 e v2 reais publicados.

| `interpretationCategory` | Linhas | Significado |
|---|---|---|
| `unchanged` | 30 | Métricas de execução/determinismo/hash, inalteradas por natureza (fora do escopo desta correção). |
| `same_conclusion_now_derived` | 7 | `mathEvidenceCounts`, `viability.classification`, `multilineOutcomeCounts` — mesmo valor final do v1, mas agora genuinamente calculado a partir dos dados reais, não herdado de constante/suposição. |
| `corrected_misleading_v1_metric` | 7 | `externalContent` (Docling, de `omitted` fixo para `detected_as_external_or_out_of_table` derivado) e `expectedRegionsCoveredByAnyComponent` nas 6 combinações página×ferramenta (contagem por componente → contagem por região esperada real). |
| `new_v2_audit_detail` | 20 | Métricas que não existiam no v1: `expectedRegionsWithExactTextualMatch`, `expectedRegionsCoveredSpatiallyOnly`, `associationComponents` por página. |

Nenhuma linha caiu em `outside_v2_correction_scope` neste conjunto de dados — todas as métricas comparáveis entre v1 e v2 pertencem ao escopo desta correção.

## 8. Conclusões válidas

**Confirmado (v1 e v2 concordam, agora com prova mais forte):**
- Nenhuma das duas ferramentas, nesta configuração congelada, produz estrutura de célula utilizável — 0/1.019 células `direct_match` para ambas.
- Viabilidade `nao_viavel_nesta_configuracao` para ambas as ferramentas.
- 84/84 relações matemáticas sem evidência (`evidencia_ausente`) para ambas.
- 38/38 descrições multilinha omitidas para ambas.

**Corrigido (v1 estava enganoso, v2 corrige):**
- A cobertura espacial de regiões esperadas era 6-70× maior do que a métrica v1 reportava (por contar componentes de comparação, não regiões esperadas individuais tocadas).
- A classificação de conteúdo externo do Docling não era genuinamente avaliada no v1 (constante fixa `false`/`omitted`); agora é derivada e concorda com o resultado do PaddleOCR.

**Não mensurado antes, agora auditável:**
- Distinção entre cobertura espacial pura e correspondência textual exata por região — revela que o Docling nunca tem correspondência textual real (0/0/0) enquanto o PaddleOCR tem uma taxa real e nada trivial (24/69, 20/77, 6/26 por página).

**Fora do escopo desta correção:**
- Métricas de execução/tempo/memória/hash (herdadas do Momento 3B, nunca alteradas).

**Limitação permanente (ver §9):**
- A ausência de proveniência geométrica por célula na verdade de referência não foi e não podia ser corrigida nesta Sprint.

## 9. Limitação espacial futura (registrada, não resolvida nesta Sprint)

0 das 1.019 células da verdade de referência têm `physicalRegionIds` preenchido — todas dependem exclusivamente de `physicalOriginPt` textual. Consequência: `cellBoundingBox()` retorna sempre `null`, e o comparador de células (v1, reutilizado sem alteração pelo v2) só pode comparar por texto, nunca por geometria. Isto é uma limitação estrutural da verdade de referência em si, não do avaliador v1 ou v2, e está classificada como `BLOQUEIO_FUTURO_DO_PORTAO_DE_AVALIACAO_DO_MOTOR` (Momento 3C.1A) — bloqueia especificamente o futuro portão de avaliação geométrica de qualquer motor determinístico que dependa de correspondência espacial célula-a-célula. Nenhuma escolha de representação geométrica foi feita nesta Sprint; a limitação é apenas registrada e propagada como pré-condição para a próxima etapa.

## 10. Próxima etapa

1. **Mesclar esta Sprint** (PR desta branch para `main`).
2. **Preparar geometria esperada** para as 1.019 células (fora desta Sprint) — pré-condição para que um futuro motor determinístico possa ser avaliado espacialmente, não apenas textualmente.
3. **Abrir uma nova branch limpa** para a construção do motor determinístico.
4. **Codex constrói o motor determinístico** nessa nova branch — não nesta.
5. **Claude realiza revisão final independente** do motor construído pelo Codex, em sessão separada.

O motor determinístico não foi iniciado nesta branch. O Codex não foi envolvido nesta branch.
