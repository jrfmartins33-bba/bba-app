# Epic 21 — Sprint 21.4B.3A.2 — Relatório de Avaliação (H3d — Grade Física por Pares Recorrentes de Bordas)

**Veredito final: D — inconclusivo.** `f.2a` permanece inalterada. A Sprint 21.4B.3B permanece bloqueada — não recomendada, não iniciada. Nenhuma produção foi alterada. Nenhuma nova candidata foi criada. A fonte independente permanece reservada, nunca executada.

## 1. Estado inicial

Base obrigatória: `main`, commit `54d88513b22e8ebcd54c8d0b359de320f8f23f33` (PR #79, incorporando a Sprint 21.4B.3A.1 — veredito D, mantido, não reavaliado nesta Sprint). Branch: `claude/epic-21-sprint-4b3a2-independent-physical-anchors`. Arquivos protegidos (`supabase/.temp/cli-latest`, `supabase/tests/data-integrity-validation.sql`) preservados intocados em todos os commits desta Sprint. Nenhuma auditoria histórica geral do repositório foi realizada — apenas os contratos explicitamente necessários (`tabular-region-detection-profile.ts`, `vertical-alignment-observation.ts`, `budget-document-tabular-region-detection.types.ts`) e a identificação de uma fonte real independente ainda não utilizada.

## 2. Objetivo

Responder objetivamente à pergunta arquitetural da Sprint: é possível reconstruir âncoras e envelopes físicos de colunas diretamente dos alinhamentos e segmentos recorrentes da página, sem depender de `formTabularRegionCandidateWindows` (a regra de produção `f.2a`, já `reprovada` em caso real), preservando continuações legítimas e rejeitando títulos, rodapés, assinaturas e demais elementos externos? A candidata H3d ataca diretamente a causa raiz encontrada na Sprint 21.4B.3A.1: H3c-r1 herdou a fragmentação de `f.2a` por depender das janelas confirmadas pela própria regra que pretendia superar.

## 3. Fonte exploratória

Documento Lagoa do Arroz (`01_Origem_Edital/05_Anexo_Tecnico_Termo_Referencia.pdf`, fingerprint `5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5`, páginas 46-54, manifesto de 670 linhas, congelado e aprovado na Sprint 21.4B.3A.1). Reaproveitado exclusivamente como **conjunto exploratório conhecido** — nunca como validação independente de H3d, porque seus dados e a falha real de H3c-r1 sobre ele já influenciaram diretamente a definição declarativa desta Sprint (§4/§7 do enunciado).

## 4. Fonte independente

`02_Impugnacoes_Fase_Inicial/20_Proposta_Precos_Concretisa_R01.pdf` (Proposta de Preços da licitante Concretisa, Pregão Eletrônico 90006/2025-DNOCS), fingerprint SHA-256 `a6202275e34689a4b157d99e4dbd717ee45b2d18a9ebfa52b94db5667e4e00f3`, páginas físicas 2-21 (seção "PLANILHA ORÇAMENTÁRIA", 20 páginas, 1369 linhas físicas). Selecionada por regra determinística: inventário existente (`_local-documents/epic-21/lagoa-do-arroz/MANIFESTO_SHA256.csv`) → excluído o próprio documento Lagoa do Arroz (fingerprint `5031da75...`) e os atalhos `.url` → ordenado por caminho relativo → primeiro documento elegível com estrutura orçamentária tabular relevante e nunca usado no desenvolvimento/avaliação de H1-H3c/H3c-r1. Manifesto: 1109 `must_include`, 260 `must_exclude`, 0 `uncertain`, 6 regras de anotação (`page_header_metadata_block`, `column_caption_header`, `page_footer_pagination`, `group_or_item_row`, `item_description_continuation`, `grid_total_line`), verificado por 19 testes de integridade automáticos.

## 5. Pré-registro efetivamente versionado

O commit de pré-registro `e703a9449141f87a860cbdcfe6eb86fe04db1456` (`test(architecture): preregister independent physical anchor experiment`), enviado e confirmado idêntico ao remoto antes de qualquer função executável de H3d existir, congelou corretamente:

- o inventário e a regra determinística de seleção da fonte independente;
- o manifesto de 1369 linhas, com identidade `(realPageNumber, lineKey)`;
- os rótulos (`must_include`/`must_exclude`/`uncertain`) e as 6 regras de anotação;
- os testes de integridade do próprio manifesto (19 testes, nenhum resultado de candidata).

Essa condição — manifesto genuinamente pré-registrado, aprovado humanamente e congelado antes de qualquer execução de H3d — permanece válida e não é afetada pela lacuna registrada em §6.

## 6. Lacuna da especificação declarativa

O commit de pré-registro **não incluiu** um documento ou módulo declarativo, versionado dentro do próprio commit, contendo a definição exata da candidata H3d: formação dos envelopes, identidade dos pares, formação dos componentes, interseção mínima de suporte, elegibilidade multicoluna, compatibilidade horizontal, corroboração vertical (casos interno e de fronteira), critérios de `must_include`/`must_exclude`/`insufficient_evidence`, invariâncias e critérios de decisão.

A definição existiu integralmente — congelada, completa e nunca alterada — no enunciado externo da Sprint (§7 do texto fornecido por Ricardo), anterior a qualquer implementação. Nenhuma mudança semântica posterior à observação de resultados foi identificada nesta correção: a implementação em `discovery-candidate-h3d-hypothesis.ts` é tradução literal de §7 do enunciado externo, verificada linha a linha nesta correção contra o texto original, sem nenhum ajuste feito para fazer qualquer caso passar. Nenhuma variante H3d-r1 foi criada.

Consequência formal: **não afirmar que H3d foi integralmente pré-registrada e auditável apenas pelo histórico do Git** — apenas o manifesto (§5) tem essa propriedade. Os resultados de H3d (§8-§9) são classificados como **descoberta exploratória sob especificação externa previamente definida**, nunca como confirmação de uma candidata integralmente pré-registrada no repositório. Esta distinção espelha, para H3d, a mesma correção já registrada para H3c/H3c-r1 em `EPIC_21_SPRINT_4B3A1_H3C_EVALUATION_REPORT.md` §4-§5 — aqui a lacuna é de **onde** a definição foi congelada (fora do commit de pré-registro, não dentro dele), nunca de **quando** ela foi congelada em relação à implementação (sempre antes) nem de alteração semântica posterior (nenhuma ocorreu).

Nenhum código, teste, manifesto, rótulo, perfil ou arquivo produtivo foi alterado por esta correção — exclusivamente documental.

## 7. Implementação H3d

Módulo isolado `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/h3d/discovery-candidate-h3d-hypothesis.ts`, exclusivamente diagnóstico. Evidência: exclusivamente `AlignmentCandidateSegment`/`VerticalAlignmentDraft` (tipos `left_edge`/`right_edge` apenas), produzidos por `buildAlignmentCandidateSegments`/`observeVerticalAlignments` (`vertical-alignment-observation.ts`, evidência de página inteira, f.0/f.1-adjacente) — nunca `formTabularRegionCandidateWindows`.

- **Envelopes:** para cada par canônico (alinhamento `left_edge`, alinhamento `right_edge`) — obtido após ordenação canônica de todos os alinhamentos da página (tipo → posição canônica → menor `segmentKey` → quantidade de membros) — calcula a interseção de `segmentKey` presentes em ambos, exclui segmentos da linha-alvo, e só forma envelope quando o suporte restante atinge `minimumLinesSustainingAlignment` linhas distintas, com mediana de bordas/altura válida.
- **Componentes de grade:** union-find sobre os envelopes, unindo pares cuja interseção de `supportLineKeys` atinge `minimumRegionLineCount`; componentes elegíveis exigem `minimumRecurrentAlignmentCount` envelopes distintos.
- **Compatibilidade horizontal:** fórmula idêntica à já aprovada e testada por H3c (ancoragem/contenção normalizada pela menor altura, fronteira sempre inclusiva).
- **Corroboração vertical:** caso interno (ordem da linha-alvo entre a menor e a maior ordem de suporte do componente) exige todos os segmentos contidos e ao menos um ancorado; caso de fronteira (uma posição antes/depois do suporte) exige adicionalmente que a linha-alvo corresponda a ≥ `minimumRecurrentAlignmentCount` envelopes distintos do componente.

**Ausência de dependência de janelas de `f.2a`:** confirmada por guard arquitetural dedicado, `packages/bdos-core/src/architecture/discovery-h3d-no-region-formation-dependency-boundaries.test.ts` (4 testes) — nenhum arquivo sob `testing/discovery/h3d/` importa `tabular-region-formation.ts`, referencia `formTabularRegionCandidateWindows`/`TabularRegionFormationWindow`/`RegionFormationLine`/`RegionFormationAlignment`/`anchorPoolFor`/`helperAlignments`, ou importa `discovery-candidate-hypotheses.ts`/o módulo H3c diretamente; `H3dPageEvidence` nunca expõe `helperAlignments` ou `blocks`.

## 8. Resultados sintéticos

**Matriz obrigatória de 20 casos** (`discovery-candidate-h3d-evaluation.test.ts`, mesma matriz pré-registrada de H1-H4/H3b/H3c, reaproveitada sem alteração): **18/20**. Falhas exatas e reais: **P9 e P10** (linha esparsa de uma única coluna, sustentada apenas pelo bloco âncora vizinho, sempre um caso de fronteira por construção da própria fixture — a salvaguarda de correspondência a ≥2 envelopes distintos da fronteira, desenhada para rejeitar ruído de coluna única como ADD3, também rejeita uma continuação legítima de coluna única nessa mesma posição). Esta é uma consequência estrutural da definição declarativa de §7 do enunciado — verificada nesta correção como não corrigida, não contornada e não reinterpretada após a observação do resultado.

- Adversariais obrigatórios **N2, N8 e N9**: aprovados.
- Casos adicionais direcionados à regra de fronteira exclusiva de H3d: **ADD1** (cabeçalho interno multicoluna na fronteira superior) → `must_include`, aprovado; **ADD2** (total multicoluna na fronteira inferior) → `must_include`, aprovado; **ADD3** (rodapé de uma coluna só na fronteira, adversarial) → `must_exclude`, aprovado.
- **Invariâncias:** determinismo, permutação de itens, translação horizontal positiva e negativa, escala 0.5× e 3×, e robustez de ADD1/ADD2 sob permutação/translação — todas preservadas (15/15 testes de caracterização, incluindo os 2 que travam exatamente o conjunto de falhas `{P9, P10}`).

## 9. Resultados exploratórios

Avaliação contra o manifesto real congelado do documento Lagoa do Arroz (§3, 670 linhas), via `scripts/evaluate-h3d-real-manifest-lagoa-do-arroz.ts`:

| Outcome | Total |
|---|---|
| acerto | 420 |
| falso_positivo | 4 |
| falso_negativo | 245 |
| evidência_insuficiente | 0 |
| incerto | 1 |

Os 4 falsos positivos, todos na página 46, regra `citation_note_external` (linhas de citação de jurisprudência do TCU sobre critério de medição de Administração Local, texto externo largo cuja posição coincide, por coincidência geométrica, com bordas reais de coluna):

- `p46-v052`
- `p46-v054`
- `p46-v055`
- `p46-v057`

Comparação com H3c-r1 (referência, Sprint 21.4B.3A.1): falso_positivo 0→**4** (pior), falso_negativo 174→**245** (pior), evidência_insuficiente 470→**0** (melhor, mas isolado — o enunciado exige que falso_negativo e evidência_insuficiente melhorem **simultaneamente**, o que não ocorreu). **Portão exploratório (§12.4 do enunciado): REPROVADO.**

## 10. Decisão de não executar a fonte independente

O portão para executar a fonte independente exige, cumulativamente: 20/20 sintéticos, todos os adversariais, todas as invariâncias, 0 falsos positivos no Lagoa do Arroz, falsos negativos e evidência insuficiente melhorando simultaneamente em relação a H3c-r1. Dois critérios independentes já reprovam o portão (§8: falha em P9/P10; §9: 4 falsos positivos e falsos negativos piores) — a fonte independente (§4) **não foi executada contra H3d**, permanece preservada, intocada e disponível para outro experimento futuro, conforme exigido pelo enunciado quando o portão não é atendido.

## 11. Veredito D — fundamentos formais

1. H3d falhou em P9 e P10 na matriz sintética obrigatória (§8).
2. H3d produziu quatro falsos positivos reais no documento Lagoa do Arroz (§9).
3. H3d aumentou os falsos negativos (174→245) em relação a H3c-r1 (§9).
4. O portão exploratório foi reprovado (§9-§10).
5. A fonte independente não foi executada (§10).
6. A especificação integral da candidata não foi congelada dentro do commit de pré-registro do repositório, apenas no enunciado externo (§6).
7. Não existe prova suficiente para A (invariante segura) ou C (ausência comprovada de solução) — a reprovação de H3d não constitui prova formal completa de impossibilidade.

**D — inconclusivo.**

## 12. Efeito sobre a Sprint 21.4B.3B

- **Permanece bloqueada.**
- **Não recomendada.**
- **Não iniciada.**
- `f.2a` permanece inalterada — confirmado por `git diff` vazio contra `main` nos cinco arquivos proibidos (§14).
- Nenhuma produção foi alterada nesta Sprint.
- Nenhuma nova candidata (H3d-r1 ou equivalente) foi criada.

## 13. Arquivos alterados

**Commit de pré-registro** (`e703a94`): `packages/bdos-core/scripts/inventory-h3d-independent-lines.ts`; `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/h3d/discovery-h3d-independent-manifest.ts`; `discovery-h3d-independent-manifest.types.ts`; `discovery-h3d-independent-manifest.test.ts`.

**Commit de avaliação** (`3d9a50e`): `packages/bdos-core/scripts/evaluate-h3d-real-manifest-lagoa-do-arroz.ts`; `packages/bdos-core/src/architecture/discovery-h3d-no-region-formation-dependency-boundaries.test.ts`; `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/h3d/discovery-candidate-h3d-hypothesis.ts`; `discovery-candidate-h3d-evaluation.test.ts`; `discovery-h3d-additional-case-fixtures.ts`.

**Este commit documental** (terceiro): `packages/bdos-core/docs/EPIC_21_SPRINT_4B3A2_H3D_EVALUATION_REPORT.md` (novo).

Nenhum arquivo de código, teste, manifesto, rótulo, perfil ou governança foi tocado nesta correção. Os dois commits técnicos anteriores permanecem inalterados — nenhum amend, nenhum force-push.

## 14. Verificações (correção exclusivamente documental — proporcionais ao risco)

1. `git diff --check`: sem saída, sem erros de espaço em branco.
2. Nenhum guard de arquitetura depende do conteúdo de `docs/*.md`; os guards relevantes a código (incluindo `discovery-h3d-no-region-formation-dependency-boundaries.test.ts`) não foram afetados por esta correção — já verificados verdes no commit anterior, não reexecutados aqui por não haver alteração de código.
3. Suíte completa, typecheck, lint e build **não foram reexecutados** — nenhum arquivo não documental foi alterado, conforme instrução explícita desta correção.
4. `git diff main...HEAD -- packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/tabular-region-formation.ts packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/detect-budget-document-tabular-regions.ts packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/vertical-alignment-observation.ts packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/tabular-region-detection-profile.ts packages/bdos-core/src/architecture/real-validation-governance/capability-maturity-registry.ts`: sem saída — permanece vazio.
5. Os dois arquivos protegidos (`supabase/.temp/cli-latest`, `supabase/tests/data-integrity-validation.sql`) confirmados fora do stage antes do commit.

## 15. Hashes dos três commits desta Sprint

1. Pré-registro: `e703a9449141f87a860cbdcfe6eb86fe04db1456` — `test(architecture): preregister independent physical anchor experiment`.
2. Avaliação: `3d9a50e080370f330182f527b3489bed9cdb4d1e` — `test(architecture): evaluate independent physical anchor invariant`.
3. Correção documental: hash confirmado por `git rev-parse HEAD` imediatamente após o commit e reportado no status final desta sessão — nunca fabricado neste arquivo antes de existir.

Nenhum PR foi aberto antes desta correção ser confirmada (hash local igual ao remoto, branch com exatamente três commits à frente da base, terceiro commit exclusivamente documental).
