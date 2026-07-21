# Epic 21 — Sprint 21.4B.3A — Relatório de Descoberta Arquitetural da Invariante Segura de Pertencimento à Grade Tabular

**CORREÇÃO (commit `docs(architecture): correct tabular discovery evidence claims`, terceiro commit desta Sprint)**: esta versão corrige cinco imprecisões da versão original (commit `50bf42a`), identificadas em revisão externa dos commits `764a62c`/`50bf42a`: (1) a prova de indistinguibilidade comparava apenas o fingerprint da linha-alvo, não o contrato inteiro do helper — reclassificada como "local"; (2) o manifesto real de 14 amostras foi construído DEPOIS da avaliação das candidatas, nunca pré-registrado ou cego — reclassificado como exploração pós-execução; (3) os totais do manifesto real continham um item (R12/item 12) com afirmação internamente contraditória, agora corrigido e travado por teste determinístico; (4) H3 foi pré-registrada apenas como família conceitual (o limiar 1.6x não estava congelado) e H3b nunca foi pré-registrada (criada pós-hoc); (5) o relatório original referenciava "mensagem final da sessão" em vez de conter os dados reais — corrigido abaixo. **O veredito final permanece D — inconclusive**; `f.2a` permanece `exercitada_em_caso_real`/`reprovada`/`confirmed`; `21.4B.3B` permanece bloqueada. Nenhuma nova candidata foi criada, nenhuma produção foi alterada, nenhuma investigação geométrica foi reaberta nesta correção.

**Veredito final: D — `inconclusive`.**

Nem uma invariante segura foi comprovada, nem a impossibilidade foi demonstrada, sob a evidência atualmente mapeada. Uma direção candidata concreta (H3/H3b — compatibilidade de largura de segmento contra um envelope de coluna, usando evidência já disponível na capacidade `f.2a`) resolve integralmente a matriz sintética classificada (20 entradas, 19 geometrias distintas — ver §7, incluindo os 3 adversariais obrigatórios, mais invariância a permutação/translação/escala e comportamento correto na fronteira exata do limiar), mas **não generaliza integralmente ao documento real** (Pregão Eletrônico 90006/2025, Lagoa do Arroz, páginas 46-54): produz falsos negativos reais em continuações de descrição legítimas mais largas do que o modelo sintético original previu — achado obtido por exploração PÓS-EXECUÇÃO (§10), nunca por validação real pré-registrada. Um refinamento pós-hoc (H3b, nunca pré-registrado) reduz, mas não elimina, esse efeito. Nenhuma correção de produção foi implementada; `f.2a` permanece `exercitada_em_caso_real`/`reprovada`/`confirmed`.

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

## 6. Indistinguibilidade local da linha-alvo (correção de escopo)

Executada (não apenas citada) em `discovery-indistinguishability-proof.test.ts`: para os pares F-vs-J (Sprint 21.4B.1) e L1-vs-L7 (Sprint 21.4B.2), o **fingerprint canônico da linha-alvo especificamente** — sua posição relativa dentro da janela e os extents de alinhamento que ela sustenta, relativos a si mesma; nunca a representação canônica de todas as linhas da janela ao mesmo tempo — no nível do helper atual é **idêntico** entre positivo e negativo.

**Correção**: a versão original desta seção afirmava que isso provava "que nenhuma função determinística limitada ao contrato atual do helper pode distinguir os dois grupos" — uma afirmação sobre o CONTRATO INTEIRO recebido pelo helper (todas as linhas da janela, todos os alinhamentos, módulo renomeação de `lineKey`/`alignmentKey`), que nunca foi comparado. O que foi de fato demonstrado, e é a afirmação correta: **a evidência especificamente atribuível à linha-alvo, no nível do helper atual, é insuficiente para decidir sobre ela mesma** — indistinguibilidade LOCAL da linha-alvo. É possível, e não foi testado, que uma função que examine a evidência de outras linhas da janela distinga os dois casos mesmo com o fingerprint da linha-alvo idêntico. No nível da capacidade completa (largura de segmento), essa igualdade local se desfaz — habilitando candidatas de Categoria A que usam largura.

## 7. Matriz de casos

20 entradas classificadas (`discovery-case-matrix.ts`): P1-P10 (positivas) e N1-N10 (negativas, incluindo os 3 adversariais obrigatórios N2=L7, N8=J, N9=L3-como-negativo) — **19 geometrias físicas distintas**, porque N6 e N10 reaproveitam deliberadamente a mesma fixture e a mesma linha-alvo (papel duplo documentado desde o pré-registro, §7/§8 da matriz). Validador de integridade (`discovery-case-matrix-integrity.test.ts`, 10 verificações) confirma unicidade de ids, cobertura obrigatória, rótulos e atribuições corretos, e presença do item-alvo em cada fixture construída.

## 8. Famílias candidatas

- **H1** — âncora + sobreposição horizontal (sem largura). Família pré-registrada.
- **H2** — componente de grafo de incidência linha×alinhamento (global, sem largura). Família pré-registrada.
- **H3** — envelope de coluna (piscina de âncoras local) + compatibilidade de largura por segmento. **Família pré-registrada apenas como direção conceitual** (`EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_PLAN.md` §12) — o limiar exato (1.6x) e a implementação exata (piscina local) foram decididos durante a avaliação (segundo commit), não congelados no pré-registro.
- **H3b** — refinamento de H3: referência de largura = todos os membros do alinhamento na página inteira (não apenas a piscina local). **NUNCA pré-registrada** — criada depois da observação de falsos negativos reais em H3 (§10), explicitamente pós-hoc.
- **H4** — pertencimento a bloco físico bidimensional de `f.1` (Categoria B). Família pré-registrada.

## 9. Resultados por candidata (matriz sintética — resultado exploratório da implementação, não confirmação de predição numérica pré-registrada)

| Candidata | Positivas (10) | Negativas (10) | Adversariais (3) | Resultado |
|---|---|---|---|---|
| H1 | 10/10 | 6/10 | 1/3 | reprovada |
| H2 | 10/10 | 6/10 | 1/3 | reprovada |
| H3 | 10/10 | 10/10 | 3/3 | passa a matriz sintética (exploratório — ver §8) |
| H3b | 10/10 | 10/10 | 3/3 | passa a matriz sintética (exploratório e pós-hoc — ver §8) |
| H4 | 10/10 | 0/10 | 0/3 | reprovada |

Casos que reprovaram cada candidata: H1/H2 falham em N1, N2, N7, N8 (parágrafos externos largos cuja borda coincide com uma coluna real — sobreposição/componente puro absorve incorretamente, exatamente como a Sprint 21.4B.2 já havia caracterizado para uma classe menor de evidência). H4 falha em N1-N10 (blocos físicos conectam geometricamente qualquer elemento próximo, tabular ou não, com a mesma facilidade). H3/H3b não falham em nenhuma entrada sintética. Testes adicionais aprovados por H3: invariância a permutação de array, translação de coordenadas, escala uniforme (0.5x/3x); comportamento correto exatamente na fronteira do limiar de largura (1.6x) — essas propriedades são genuinamente verificadas por execução, independentemente do status pré-registrado de H3/H3b.

## 10. Resultados no documento real

Estrutura observada (regra de produção atual, inalterada): 7, 7, 6, 4, 3, 1, 2, 6, 2 regiões nas páginas 46-54 respectivamente — confirma numericamente a reprovação já registrada de `f.2a` (fragmentação severa; páginas 51/52 com apenas 5 e 6 de 83/84 linhas incluídas).

**Classificação da evidência (correção obrigatória)**: o script de diagnóstico avaliou primeiro H1-H4/H3b sobre todas as linhas excluídas, e só depois a inspeção humana selecionou e rotulou as 14 amostras do manifesto — **esta é uma exploração PÓS-EXECUÇÃO, nunca uma validação real pré-registrada ou cega**. Ela é suficiente para REFUTAR H3/H3b (um falso negativo real já basta para reprovar), mas não constitui validação real formal no sentido de `EPIC_21_SPRINT_4G_REAL_VALIDATION_GOVERNANCE.md`.

Manifesto versionado e verificável em `discovery-real-sample-manifest.ts`, com totais calculados deterministicamente (nunca transcritos à mão) por `computeRealSampleOutcomeTotals` e travados em `discovery-real-sample-manifest.test.ts`. Sobre as 14 amostras (13 com rótulo humano definitivo, 1 `uncertain`):

| Candidata | acerto | falso_negativo | falso_positivo | evidencia_insuficiente | incerto | total |
|---|---|---|---|---|---|---|
| H3 | 4 | 8 | 0 | 1 | 1 | 14 |
| H3b | 6 | 6 | 0 | 1 | 1 | 14 |

Nenhum falso positivo real foi observado em nenhuma das duas variantes. A amostra R12 (item 12 do relatório original) continha uma inconsistência interna ("H3 não avaliou" e "must_exclude" simultaneamente) — corrigida: o valor real é H3=must_include (acerto) e H3b=must_exclude (falso negativo introduzido por H3b). Ver `EPIC_21_SPRINT_4B3A_EVIDENCE_PACKAGE.md` §10 para o manifesto completo com identidade `(página, lineKey)`, justificativa por amostra e a declaração explícita de status pós-execução.

## 11. Decisão final A/B/C/D

**D — inconclusive.**

## 12. Justificativa formal

- Não é **A**: H3/H3b não passam "os casos reais pré-rotulados aplicáveis" (critério de aceitação §14.4 do enunciado) — falsos negativos reais confirmados por execução (§10). **Nota de rigor**: essa evidência real é exploração pós-execução, não validação cega — mas isso torna a refutação de A ainda mais conservadora (um falso negativo observado, mesmo por exploração pós-execução, já é suficiente para reprovar a alegação de segurança; não teria sido necessário um manifesto cego para isso).
- Não é **B**: a falha real não foi atribuída a uma evidência ausente que uma extensão mínima de contrato resolveria de forma comprovada — H4 (a candidata de Categoria B testada, blocos físicos de `f.1`) foi a que MAIS falhou de todas, tanto no sintético quanto seria esperado no real.
- Não é **C**: não foi construída uma prova de indistinguibilidade (nem mesmo local, §6) para o par (continuação real larga vs. adversarial real) no nível de evidência mais amplo já mapeado — pelo contrário, H3b demonstrou MELHORA parcial ao mudar apenas a AGREGAÇÃO da mesma evidência (não uma nova fonte), o que é evidência CONTRA a impossibilidade, não a favor.
- É **D**: existe uma direção candidata concreta (H3, pré-registrada apenas como família conceitual; H3b, pós-hoc), com evidência de Categoria A (geometria de segmento já calculada dentro de `detectPage`), que resolve completamente a caracterização sintética do problema, mas cuja generalização ao documento real permanece incompleta e não comprovada — por evidência apenas exploratória, não por validação formal — dentro do escopo e do tempo desta Sprint, sem violar a proibição de recalibrar limiares a partir do documento real (§13 do enunciado).

## 13. Contrato atual: suficiente ou insuficiente

Insuficiência comprovada apenas para a **evidência local da linha-alvo**. A suficiência ou insuficiência do contrato completo do helper permanece inconclusiva. No **nível da capacidade completa**, H3/H3b resolvem a matriz sintética exploratória, mas essa suficiência não foi comprovada para o documento real dentro desta Sprint.

## 14. Extensão mínima eventualmente necessária

Nenhuma extensão de contrato foi comprovada necessária ou suficiente nesta Sprint — H4 (a única candidata testada que dependeria de uma extensão real, os blocos físicos de `f.1`) foi a mais reprovada. Se uma extensão vier a ser necessária, o candidato mais provável (não testado nesta Sprint) seria uma agregação de largura de coluna em nível de TABELA/PÁGINA inteira usando ambos os alinhamentos de borda (esquerda E direita) do mesmo agrupamento de colunas — não testado por restrição de tempo/escopo desta Sprint.

## 15. Efeito sobre a futura 21.4B.3B

**Bloqueada.** Nenhuma implementação de correção de produção pode ser recomendada com a evidência atual — nem no contrato atual da capacidade (H3/H3b não comprovadamente seguras no caso real), nem com uma extensão mínima formalizada (H4 reprovada).

### Próximo experimento mínimo recomendado

1. **Requisito de processo (correção desta Sprint)**: construir e CONGELAR (commit, hash, push) um manifesto real rotulado — maior e mais sistemático que as 14 amostras atuais, cobrindo TODAS as continuações de descrição identificáveis nas 9 páginas — **ANTES** de rodar qualquer candidata contra ele. Só depois disso um resultado pode ser chamado de "validação real", nunca antes.
2. Rotular essa amostra maior para caracterizar a taxa real de falso negativo de H3b com precisão estatística mínima.
3. Investigar uma referência de envelope de coluna agregada em nível de TABELA (todas as regiões confirmadas da mesma página que compartilham o mesmo tipo+posição de alinhamento, não apenas uma piscina local ou os membros de um único alinhamento) — hipótese H3c, não testada nesta Sprint.
4. Investigar combinar width-ratio (H3/H3b) com uma segunda evidência independente de corroboração (por exemplo, contagem de linhas-âncora de cada lado, ou não-conflito com uma fronteira de página/bloco explícita) antes de qualquer recalibração de limiar.
5. Nunca ajustar `H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO` (ou equivalente) usando o documento Lagoa do Arroz como alvo de calibração — qualquer novo valor deve ser justificado independentemente e testado nas mesmas fronteiras/invariâncias desta Sprint antes de ser avaliado contra qualquer documento real.

## 16. Confirmação: nenhum arquivo de produção foi alterado

Confirmado por `git diff main...HEAD -- packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/tabular-region-formation.ts packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/detect-budget-document-tabular-regions.ts` (vazio — ver §20 do relatório de verificação abaixo). `f.0`, `f.1`, `f.2b`, `f.2c`, `g.1`, `g.2`, `g.3`, caracterização econômica, Versão do Orçamento, persistência, API e UI não foram tocados.

## 17. Arquivos alterados

Commits 1-2 (Sprint original, nenhum arquivo de produção existente foi modificado):

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

Commit 3 (esta correção, `docs(architecture): correct tabular discovery evidence claims`) — apenas documentação e um novo módulo de manifesto/teste diagnóstico, nenhuma produção, nenhum candidato novo:

- `packages/bdos-core/docs/EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_PLAN.md` (§13 adicionada — correção aditiva, texto original preservado)
- `packages/bdos-core/docs/EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_REPORT.md` (este arquivo, revisado)
- `packages/bdos-core/docs/EPIC_21_SPRINT_4B3A_EVIDENCE_PACKAGE.md` (revisado)
- `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-indistinguishability-proof.test.ts` (docstring corrigida, lógica de comparação inalterada)
- `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-evidence-representation.ts` (comentário de escopo corrigido, funções inalteradas)
- `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-case-matrix.ts` (comentário explicando 20 entradas/19 geometrias, dados inalterados)
- `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-real-sample-manifest.ts` (NOVO — manifesto versionado + classificador determinístico)
- `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-real-sample-manifest.test.ts` (NOVO — valida manifesto e trava totais)

Não alterados em nenhum dos três commits: `capability-maturity-registry.ts` e o registro de validação real da Sprint 21.4G, `tabular-region-formation.ts`, `detect-budget-document-tabular-regions.ts`, `f.0`-`g.3`, persistência, API, UI.

## 18. Resultados completos das verificações (executadas após esta correção, commit 3)

1. **Typecheck `bdos-core`**: `npx tsc --noEmit` em `packages/bdos-core` — sem saída, exit 0.
2. **Typecheck do monorepo**: `pnpm typecheck` (turbo, 6 pacotes em escopo, 4 tarefas de typecheck) — `4 successful, 4 total`.
3. **Lint**: `pnpm lint` — `@bba/web:lint: ✔ No ESLint warnings or errors`, `1 successful, 1 total`.
4. **Build**: `pnpm build` — `@bba/web:build: ✓ Compiled successfully`, 39/39 páginas estáticas geradas, `1 successful, 1 total`.
5. **Suíte agregada (`pnpm test` / `node scripts/run-tests.mjs`)**: **249/249 arquivos de teste passaram** (era 248 após o commit `50bf42a`; +1 pelo novo `discovery-real-sample-manifest.test.ts`). Os 4 arquivos de teste desta pasta de descoberta (`discovery-case-matrix-integrity.test.ts`, `discovery-indistinguishability-proof.test.ts`, `discovery-candidate-evaluation.test.ts`, `discovery-real-sample-manifest.test.ts`) e o guard de governança `packages/bdos-core/src/architecture/real-validation-governance/capability-maturity-registry.test.ts` foram confirmados individualmente na saída, todos `PASS`.
6. **`git diff --check`**: sem saída, exit 0 — nenhum erro de espaço em branco.
7. **`git diff main -- tabular-region-formation.ts detect-budget-document-tabular-regions.ts capability-maturity-registry.ts`**: sem saída, exit 0 — os três arquivos permanecem byte-idênticos a `main` após os três commits desta Sprint.

## 19. Hashes dos commits desta Sprint

- Primeiro commit (pré-registro): `764a62cbf3ebaa51cda98da62c6c832cabfd97ff` — `test(architecture): preregister tabular membership discovery`.
- Segundo commit (avaliação): `50bf42aba7804e537b25a85f672ebbe17c96ab9b` — `test(architecture): evaluate tabular membership invariants`.
- Terceiro commit (correção das afirmações de evidência): `ec0f8f609db9cf5e7aac815f968900c083e80011` — `docs(architecture): correct tabular discovery evidence claims`.

## 20. Confirmação do push, `git status`, ausência de PR, ausência de início da 21.4B.3B

- **Push**: os três commits foram enviados para `origin/claude/epic-21-sprint-4b3a-tabular-membership-invariant-discovery`. O terceiro push confirmou o intervalo `50bf42a..ec0f8f6`, sem amend e sem force-push.
- **`git status --short` após o terceiro commit**: apenas as duas alterações locais pré-existentes e protegidas (`supabase/.temp/cli-latest`, `supabase/tests/data-integrity-validation.sql`), presentes desde antes do início desta Sprint, nunca adicionadas ao stage por nenhum dos três commits.
- **Ausência de PR**: nenhum `gh pr create` ou equivalente foi executado nesta Sprint (nenhuma das três etapas). O GitHub oferece o link para abrir um PR ao receber o push (comportamento padrão do `git push` para uma branch nova/atualizada), mas nenhum PR foi de fato criado.
- **21.4B.3B**: não iniciada — nenhum código de `tabular-region-formation.ts`, `detect-budget-document-tabular-regions.ts`, ou qualquer arquivo de produção de `f.0` a `g.3` foi alterado em nenhum dos três commits desta Sprint.
- **`f.2a`**: permanece `exercitada_em_caso_real` / `reprovada` / `failureAssessment: confirmed`, inalterado.
