# Epic 21 — Sprint 21.4B.3A — Relatório de Descoberta Arquitetural da Invariante Segura de Pertencimento à Grade Tabular

**Veredito final: D — `inconclusive`.**

Nem uma invariante segura foi comprovada, nem a impossibilidade foi demonstrada, sob a evidência atualmente mapeada. Uma direção promissora e concreta (H3/H3b — compatibilidade de largura de segmento contra um envelope de coluna, usando evidência já disponível na capacidade `f.2a`) resolve integralmente a matriz sintética pré-registrada (20/20 casos, incluindo os 3 adversariais obrigatórios, mais invariância a permutação/translação/escala e comportamento correto na fronteira exata do limiar), mas **não generaliza integralmente ao documento real** (Pregão Eletrônico 90006/2025, Lagoa do Arroz, páginas 46-54): produz falsos negativos reais em continuações de descrição legítimas mais largas do que o modelo sintético original previu. Um refinamento (H3b) reduz, mas não elimina, esse efeito. Nenhuma correção de produção foi implementada; `f.2a` permanece `exercitada_em_caso_real`/`reprovada`/`confirmed`.

## 1. Estado inicial e commit-base

Base obrigatória: `main`, commit de merge `4cb22dcfc5ae6d6cb3648e38299739e169c66bbf` (PR #77, Sprint 21.4G). Confirmado por `git fetch --all --prune`, `git pull --ff-only origin main`, `git rev-parse HEAD` — HEAD exatamente igual ao commit exigido. `git status --short` mostrava apenas a alteração local protegida pré-existente (`supabase/.temp/cli-latest`), preservada intacta durante toda a Sprint, nunca adicionada ao stage.

## 2. Branch criada

`claude/epic-21-sprint-4b3a-tabular-membership-invariant-discovery`, criada diretamente a partir de `4cb22dcfc5ae6d6cb3648e38299739e169c66bbf`.

## 3. Hash do commit de pré-registro

`764a62cbf3ebaa51cda98da62c6c832cabfd97ff` — `test(architecture): preregister tabular membership discovery`.

## 4. Confirmação de push antes dos experimentos

O commit de pré-registro foi enviado (`git push -u origin claude/epic-21-sprint-4b3a-tabular-membership-invariant-discovery`) **antes** de qualquer algoritmo candidato ser criado ou executado — confirmado pela ordem cronológica desta sessão: o pré-registro (`EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_PLAN.md`, a matriz de casos, a representação canônica de evidência e a prova de indistinguibilidade) foi commitado e enviado antes de `discovery-candidate-hypotheses.ts` existir.

## 5. Mapa de evidências observáveis

Ver `EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_PLAN.md` §2, construído por inspeção direta do código-fonte (`detect-budget-document-tabular-regions.ts`, `vertical-alignment-observation.ts`, `tabular-region-formation.ts`, `physical-text-block-reconstruction.ts`):

- **Nível helper (contrato atual de `formTabularRegionCandidateWindows`)**: apenas `lineKey`, `verticalOrder`, e pertencimento a `alignmentKey` (sem tipo, sem posição, sem geometria).
- **Nível capacidade completa (já calculado por `detectPage`, nunca encaminhado ao helper)**: geometria de segmento (`AlignmentCandidateSegment`: `leftPoints`/`rightPoints`/`centerXPoints`/`lineHeightPoints`), posições canônicas e observadas de alinhamento (`VerticalAlignmentDraft`).
- **Nível somente upstream (`f.1`, propriedade de `structure-reconstruction`)**: blocos físicos bidimensionais (`ReconstructedPhysicalTextBlock`) — já presentes inteiros no input de `f.2a` (`structureReconstruction.groups[].pages[].blocks`), mas nunca lidos por nenhuma linha de código de `f.2a`.
- **Evidência inexistente**: qualquer noção de coluna econômica, célula, cabeçalho, total, ou envelope de coluna como objeto de primeira classe (teria que ser derivado, nunca lido diretamente).

## 6. Prova de indistinguibilidade

Executada (não apenas citada) em `discovery-indistinguishability-proof.test.ts`: para os pares F-vs-J (Sprint 21.4B.1) e L1-vs-L7 (Sprint 21.4B.2), a representação canônica da linha-alvo no nível do helper atual é **idêntica** entre positivo e negativo — prova formal de insuficiência do contrato atual do helper. No nível da capacidade completa (largura de segmento), a igualdade se desfaz — a insuficiência NÃO se estende a esse nível mais amplo, habilitando candidatas de Categoria A.

## 7. Matriz de casos

20 casos obrigatórios (`discovery-case-matrix.ts`): P1-P10 (positivos) e N1-N10 (negativos, incluindo os 3 adversariais obrigatórios N2=L7, N8=J, N9=L3-como-negativo). Validador de integridade (`discovery-case-matrix-integrity.test.ts`, 10 verificações) confirma unicidade de ids, cobertura obrigatória, rótulos e atribuições corretos, e presença do item-alvo em cada fixture construída.

## 8. Famílias candidatas

- **H1** — âncora + sobreposição horizontal (sem largura).
- **H2** — componente de grafo de incidência linha×alinhamento (global, sem largura).
- **H3** — envelope de coluna (piscina de âncoras local) + compatibilidade de largura por segmento.
- **H3b** — refinamento de H3: referência de largura = todos os membros do alinhamento na página inteira (não apenas a piscina local) — motivado por achado real desta própria Sprint, não presumido a priori.
- **H4** — pertencimento a bloco físico bidimensional de `f.1` (Categoria B).

## 9. Resultados por candidata (sintético)

| Candidata | Positivos | Negativos | Adversariais | Veredito sintético |
|---|---|---|---|---|
| H1 | 10/10 | 6/10 | 1/3 | reprovada |
| H2 | 10/10 | 6/10 | 1/3 | reprovada |
| H3 | 10/10 | 10/10 | 3/3 | **aprovada** |
| H3b | 10/10 | 10/10 | 3/3 | **aprovada** |
| H4 | 10/10 | 0/10 | 0/3 | reprovada |

Casos que reprovaram cada candidata: H1/H2 falham em N1, N2, N7, N8 (parágrafos externos largos cuja borda coincide com uma coluna real — sobreposição/componente puro absorve incorretamente, exatamente como a Sprint 21.4B.2 já havia caracterizado para uma classe menor de evidência). H4 falha em N1-N10 (blocos físicos conectam geometricamente qualquer elemento próximo, tabular ou não, com a mesma facilidade). H3/H3b não falham em nenhum caso sintético. Testes adicionais aprovados por H3: invariância a permutação de array, translação de coordenadas, escala uniforme (0.5x/3x); comportamento correto exatamente na fronteira do limiar de largura (1.6x).

## 10. Resultados no documento real

Estrutura observada (regra de produção atual, inalterada): 7, 7, 6, 4, 3, 1, 2, 6, 2 regiões nas páginas 46-54 respectivamente — confirma numericamente a reprovação já registrada de `f.2a` (fragmentação severa; páginas 51/52 com apenas 5 e 6 de 83/84 linhas incluídas).

Manifesto de 14 amostras rotuladas manualmente (texto de origem, nunca conteúdo econômico usado pelos algoritmos): de 11 casos com rótulo definitivo, **H3 acerta 3 e erra 6** (falso negativo); **H3b acerta 6 e erra 5** (falso negativo). Nenhum falso positivo real foi observado em nenhuma das duas variantes na amostra inspecionada. Ver `EPIC_21_SPRINT_4B3A_EVIDENCE_PACKAGE.md` §10 para o manifesto completo com justificativa por amostra.

## 11. Decisão final A/B/C/D

**D — inconclusive.**

## 12. Justificativa formal

- Não é **A**: H3/H3b não passam "os casos reais pré-rotulados aplicáveis" (critério de aceitação §14.4 do enunciado) — falsos negativos reais confirmados por execução e inspeção manual, não presumidos.
- Não é **B**: a falha real não foi atribuída a uma evidência ausente que uma extensão mínima de contrato resolveria de forma comprovada — H4 (a candidata de Categoria B testada, blocos físicos de `f.1`) foi a que MAIS falhou de todas, tanto no sintético quanto seria esperado no real.
- Não é **C**: não foi construída uma prova de indistinguibilidade análoga à de §6, mas para o par (continuação real larga vs. adversarial real) no nível de evidência mais amplo já mapeado — pelo contrário, H3b demonstrou MELHORA parcial ao mudar apenas a AGREGAÇÃO da mesma evidência (não uma nova fonte), o que é evidência CONTRA a impossibilidade, não a favor.
- É **D**: existe uma direção candidata concreta, com evidência de Categoria A (geometria de segmento já calculada dentro de `detectPage`), que resolve completamente a caracterização sintética do problema, mas cuja generalização ao documento real permanece incompleta e não comprovada dentro do escopo e do tempo desta Sprint — sem violar a proibição de recalibrar limiares a partir do documento real (§13 do enunciado).

## 13. Contrato atual: suficiente ou insuficiente

Insuficiente no **nível do helper** (prova formal, §6). Potencialmente suficiente no **nível da capacidade completa** para o caso sintético (H3/H3b), mas essa suficiência não foi comprovada para o caso real dentro desta Sprint.

## 14. Extensão mínima eventualmente necessária

Nenhuma extensão de contrato foi comprovada necessária ou suficiente nesta Sprint — H4 (a única candidata testada que dependeria de uma extensão real, os blocos físicos de `f.1`) foi a mais reprovada. Se uma extensão vier a ser necessária, o candidato mais provável (não testado nesta Sprint) seria uma agregação de largura de coluna em nível de TABELA/PÁGINA inteira usando ambos os alinhamentos de borda (esquerda E direita) do mesmo agrupamento de colunas — não testado por restrição de tempo/escopo desta Sprint.

## 15. Efeito sobre a futura 21.4B.3B

**Bloqueada.** Nenhuma implementação de correção de produção pode ser recomendada com a evidência atual — nem no contrato atual da capacidade (H3/H3b não comprovadamente seguras no caso real), nem com uma extensão mínima formalizada (H4 reprovada).

### Próximo experimento mínimo recomendado

1. Rotular uma amostra real maior e mais sistemática (não apenas 14 linhas) através das 9 páginas, incluindo TODAS as continuações de descrição identificáveis, para caracterizar a taxa real de falso negativo de H3b com precisão estatística mínima.
2. Investigar uma referência de envelope de coluna agregada em nível de TABELA (todas as regiões confirmadas da mesma página que compartilham o mesmo tipo+posição de alinhamento, não apenas uma piscina local ou os membros de um único alinhamento) — hipótese H3c, não testada nesta Sprint.
3. Investigar combinar width-ratio (H3/H3b) com uma segunda evidência independente de corroboração (por exemplo, contagem de linhas-âncora de cada lado, ou não-conflito com uma fronteira de página/bloco explícita) antes de qualquer recalibração de limiar.
4. Nunca ajustar `H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO` (ou equivalente) usando o documento Lagoa do Arroz como alvo de calibração — qualquer novo valor deve ser justificado independentemente e testado nas mesmas fronteiras/invariâncias desta Sprint antes de ser avaliado contra qualquer documento real.

## 16. Confirmação: nenhum arquivo de produção foi alterado

Confirmado por `git diff main...HEAD -- packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/tabular-region-formation.ts packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/detect-budget-document-tabular-regions.ts` (vazio — ver §20 do relatório de verificação abaixo). `f.0`, `f.1`, `f.2b`, `f.2c`, `g.1`, `g.2`, `g.3`, caracterização econômica, Versão do Orçamento, persistência, API e UI não foram tocados.

## 17. Arquivos alterados

Novos (nenhum arquivo de produção existente foi modificado):

- `packages/bdos-core/docs/EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_PLAN.md`
- `packages/bdos-core/docs/EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_REPORT.md` (este arquivo)
- `packages/bdos-core/docs/EPIC_21_SPRINT_4B3A_EVIDENCE_PACKAGE.md`
- `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-case-fixtures.ts`
- `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-case-matrix.ts`
- `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-case-matrix-integrity.test.ts`
- `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-evidence-representation.ts`
- `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-indistinguishability-proof.test.ts`
- `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-candidate-hypotheses.ts`
- `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-candidate-evaluation.test.ts`
- `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-geometry-transforms.ts`
- `packages/bdos-core/scripts/discover-tabular-membership-real-document.ts` (diagnóstico manual, fora de `src/`, nunca executado por `pnpm test`)

Não alterados: `capability-maturity-registry.ts` e o registro de validação real da Sprint 21.4G — esta Sprint optou por não tocar o registro de maturidade porque nenhuma mudança de nível/resultado é reivindicada (o veredito D não altera `f2a-tabular-region-detection`, que já é `reprovada`/`confirmed`) e qualquer edição desse arquivo, altamente estruturado e guardado por seus próprios testes de governança, teria risco desproporcional ao ganho para uma Sprint puramente de descoberta.

## 18. Resultados completos das verificações

Ver §20 (seção de verificação obrigatória) abaixo.

## 19. Hash do segundo commit

Registrado após a criação deste commit — ver confirmação de push (§20).

## 20. Confirmação do push, `git status`, ausência de PR, ausência de início da 21.4B.3B

Ver mensagem final da sessão (após o segundo commit) para os valores exatos.
