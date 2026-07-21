# Epic 21 — Sprint 21.4B.3A.1 — Relatório de Avaliação (H3c × H3c-r1)

**Veredito final: D — inconclusivo.** `f.2a` permanece `exercitada_em_caso_real` / `reprovada` / `failureAssessment: confirmed`. A Sprint 21.4B.3B permanece bloqueada — não recomendada, não iniciada. Nenhuma produção foi alterada. Nenhuma nova candidata foi criada.

## 1. Estado inicial

Base obrigatória: `main`, commit `aa63e1264c93a56e8c77b6d3aba8ade17979584c` (PR #78, incorporando a Sprint 21.4B.3A — veredito D, mantido, não reavaliado nesta Sprint). Branch: `claude/epic-21-sprint-4b3a1-preregistered-h3c-real-experiment`. Arquivos protegidos (`supabase/.temp/cli-latest`, `supabase/tests/data-integrity-validation.sql`) preservados intocados em todos os commits desta Sprint. Nenhuma auditoria histórica geral do repositório foi realizada — apenas os arquivos explicitamente listados no enunciado de cada momento.

## 2. Hash do pré-registro

`a8777b5e999258be23025eeb987125359c8ff91a` — `test(architecture): preregister H3c real tabular membership experiment`. Enviado e confirmado idêntico ao remoto antes de qualquer função executável de H3c existir (`preregistrationCommitSha`).

## 3. Integridade do manifesto real

O manifesto real (670 entradas, páginas 46-54, fingerprint `5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5`) foi congelado e aprovado por Ricardo **antes** de qualquer execução de candidata contra ele — condição que permanece válida e não é afetada pelo desvio metodológico registrado nesta correção (§4). Totais congelados: **563 `must_include`, 106 `must_exclude`, 1 `uncertain`**, verificados automaticamente por `discovery-h3c-real-manifest.test.ts` (20 testes de integridade, nunca por transcrição manual). O que perdeu a condição integralmente pré-registrada foi a definição da **candidata** (H3c → H3c-r1, §4-§5), nunca os rótulos do manifesto.

## 4. Desvio metodológico

Ao implementar H3c pela primeira vez, exatamente conforme a identidade de agrupamento congelada em §6.4 do pré-registro (`alignmentType + lineKeys-dos-membros-ordenados`), os testes sintéticos direcionados reprovaram nos casos P1 e P5-P8: em qualquer tabela densa convencional, todas as colunas de uma mesma linha compartilham exatamente o mesmo conjunto de `lineKey` membros, o que colapsa colunas fisicamente distintas na mesma identidade e impede a formação de envelopes pareados por coluna.

Diante dessa reprovação observada, a identidade de agrupamento foi alterada para usar `segmentKey` em vez de `lineKey`. Esta alteração **modifica a formação dos grupos, os envelopes gerados e, potencialmente, a decisão final da candidata** — não é uma correção neutra de representação interna. Constitui uma **mudança semântica feita depois da observação de resultados de testes sintéticos direcionados**, o que o enunciado da Sprint 21.4B.3A.1 §3 não autoriza sem invalidar a candidata original e exigir novo identificador.

A classificação original desta mudança (commit `ea56cf9`, e §17 original do pré-registro) como "correção de implementação divergente da especificação congelada" estava **incorreta** e é substituída pela distinção formal do §5 abaixo, registrada em `EPIC_21_SPRINT_4B3A1_H3C_PREREGISTRATION.md` §17 (revisado nesta correção, texto original preservado por auditabilidade, nunca apagado).

## 5. Distinção formal H3c × H3c-r1

### H3c (original, literalmente pré-registrada)

- Identidade de agrupamento: `alignmentType + lineKeys-dos-membros-ordenados-e-concatenados` (texto de §6.4 do pré-registro, nunca alterado retroativamente).
- Sob esta definição literal: **reprovada** nos testes sintéticos direcionados (P1, P5-P8) — colunas distintas colapsam na mesma identidade.
- **H3c, sob sua definição pré-registrada literal, nunca produziu o resultado sintético 20/20 nem os resultados reais reportados.** Classificação correta: **reprovada / mal especificada** sob a definição congelada — nunca "aprovada".

### H3c-r1 (revisão pós-pré-registro)

- Identidade de agrupamento: `alignmentType + segmentKeys-dos-membros-ordenados-e-concatenados` — alteração feita **depois** de observar a reprovação de H3c (original) em P1/P5-P8.
- Passou 20/20 casos sintéticos obrigatórios (10 positivos + 10 negativos, incluindo os 3 adversariais N2/N8/N9).
- Avaliada contra o manifesto real congelado (§3): 25 acerto, 0 falso_positivo, 174 falso_negativo, 470 evidência_insuficiente, 1 incerto.
- **Estes resultados são exploratórios pós-emenda de H3c-r1 — nunca a confirmação de uma candidata integralmente pré-registrada.**

Nenhum código, teste, manifesto, rótulo, perfil ou arquivo produtivo foi alterado por esta correção — exclusivamente documental (`git diff` restrito a `EPIC_21_SPRINT_4B3A1_H3C_PREREGISTRATION.md` e este arquivo).

## 6. Resultados sintéticos e reais (produzidos por H3c-r1, nunca por H3c original)

**Sintético** (`discovery-candidate-h3c-evaluation.test.ts`): 20/20 casos obrigatórios (10 positivos, 10 negativos incluindo N2/N8/N9). Determinismo, invariância a permutação/translação/escala (0.5×/3×), e fronteira exata do limiar reutilizado (`maximumAlignmentPositionDeviationToMinimumLineHeightRatio = 0.5`, 6pt para linhas de 12pt) — todos verificados por execução.

**Real** (`scripts/evaluate-h3c-real-manifest.ts`, 670 entradas do manifesto congelado):

| Outcome | Total |
|---|---|
| acerto | 25 |
| falso_positivo | 0 |
| falso_negativo | 174 |
| evidência_insuficiente | 470 |
| incerto | 1 |

Por etiqueta de cobertura (destaques): `conventional_tabular_line` (346): 10 acerto / 122 falso_negativo / 214 evidência_insuficiente. `legitimate_wide_continuation` (217): 12 acerto / 52 falso_negativo / 153 evidência_insuficiente. `external_adversarial_element` (98): 1 acerto / 97 evidência_insuficiente / 0 falso_positivo. `external_header_footer_or_note` (61): 3 acerto / 58 evidência_insuficiente / 0 falso_positivo.

## 7. Interpretação dos 470 casos de evidência insuficiente

H3c-r1 localiza âncoras exclusivamente através de `formTabularRegionCandidateWindows` — a própria regra de produção atual, já `reprovada` em caso real (Sprint 21.4B.3A) por fragmentação severa. Quando essa regra produz poucas janelas confirmadas por página (documentado na Sprint 21.4B.3A: de 1 a 7 regiões por página, muitas páginas com a maior parte das linhas excluídas), a maioria das linhas reais simplesmente não tem **nenhuma janela confirmada imediatamente adjacente** — condição que H3c-r1 exige para sair de `insufficient_evidence` (§5/§8 do pré-registro). Isso NÃO é uma falha de implementação nem uma característica ambígua dos dados: é uma consequência estrutural direta de H3c-r1 herdar o mecanismo de detecção de âncoras da mesma regra já comprovadamente fragmentada — o mesmo padrão de dependência problemática já identificado para H3/H3b na Sprint 21.4B.3A (`EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_REPORT.md` §10-§11).

Nenhuma tentativa de corrigir esse mecanismo de ancoragem foi feita nesta correção documental (proibido pelo escopo desta correção) nem seria apropriada nesta Sprint (reabriria a investigação geométrica, expressamente vedado).

## 8. Veredito D — fundamentos formais

1. Houve desvio do protocolo de pré-registro pela alteração semântica pós-observação de resultados sintéticos direcionados (§4-§5) — H3c-r1 nunca foi integralmente pré-registrada.
2. H3c-r1 falhou de forma substantiva no documento real (174 falso_negativo + 470 evidência_insuficiente sobre 669 casos definitivos).
3. Essa falha não constitui prova completa de impossibilidade (§15 do enunciado original da Sprint 21.4B.3A — nenhuma demonstração de indistinguibilidade em todos os níveis de evidência foi construída; 0 falso_positivo é, inclusive, evidência favorável a uma futura tentativa, não contra ela).
4. Não existe, portanto, candidata segura demonstrada — nem H3c (reprovada/mal especificada sob sua definição literal) nem H3c-r1 (exploratória, falha substantiva no real, nunca integralmente pré-registrada).

**D — inconclusive**, conforme já registrado antes desta correção — mantido, com a justificativa formal corrigida acima.

## 9. Efeito sobre a Sprint 21.4B.3B

- **Permanece bloqueada.**
- **Não recomendada.**
- **Não iniciada.**
- `f.2a` permanece `exercitada_em_caso_real` / `reprovada` / `failureAssessment: confirmed` — inalterada.
- Nenhuma produção foi alterada nesta Sprint (nenhum dos três commits toca `tabular-region-formation.ts`, `detect-budget-document-tabular-regions.ts`, `tabular-region-detection-profile.ts` ou `capability-maturity-registry.ts` — confirmado por `git diff` vazio contra `main`, ver §11).
- Nenhuma nova candidata (H3d ou equivalente) foi criada nesta correção.

## 10. Arquivos alterados nesta correção (terceiro commit — exclusivamente documentais)

- `packages/bdos-core/docs/EPIC_21_SPRINT_4B3A1_H3C_PREREGISTRATION.md` (§17 revisada — correção aditiva e explícita; texto original preservado, nunca apagado).
- `packages/bdos-core/docs/EPIC_21_SPRINT_4B3A1_H3C_EVALUATION_REPORT.md` (este arquivo, novo).

Nenhum arquivo de código, teste, manifesto, rótulo ou perfil foi tocado nesta correção. Os dois commits técnicos anteriores (`a8777b5`, `ea56cf9`) permanecem inalterados — nenhum amend, nenhum force-push.

## 11. Verificações (correção exclusivamente documental — proporcionais ao risco)

1. `git diff --check`: sem saída, sem erros de espaço em branco.
2. Guards direcionados que leem documentação (nenhum guard de arquitetura depende do conteúdo de `docs/*.md`; os dois guards relevantes a código — `budget-document-location-boundaries.test.ts` e `budget-document-location-pdf-adapter-boundaries.test.ts` — não foram afetados por esta correção, já verificados verdes no commit anterior e não reexecutados aqui por não haver alteração de código).
3. Suíte completa, typecheck, lint e build **não foram reexecutados** — nenhum arquivo não documental foi alterado, conforme instrução explícita da correção.
4. `git diff main...HEAD -- packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/tabular-region-formation.ts packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/detect-budget-document-tabular-regions.ts packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/tabular-region-detection-profile.ts packages/bdos-core/src/architecture/real-validation-governance/capability-maturity-registry.ts`: sem saída — permanece vazio.
5. Os dois arquivos protegidos (`supabase/.temp/cli-latest`, `supabase/tests/data-integrity-validation.sql`) confirmados fora do stage antes do commit.

## 12. Hashes dos três commits desta Sprint (após esta correção)

1. Pré-registro: `a8777b5e999258be23025eeb987125359c8ff91a` — `test(architecture): preregister H3c real tabular membership experiment`.
2. Avaliação: `ea56cf92a9f515bc9321e34623357352ce11f040` — `test(architecture): evaluate preregistered H3c tabular membership invariant`.
3. Correção documental: hash confirmado por `git rev-parse HEAD` imediatamente após o commit e reportado na resposta desta sessão — nunca fabricado neste arquivo antes de existir.

Nenhum PR foi aberto antes desta correção ser confirmada (hash local igual ao remoto, branch com exatamente três commits à frente da base, terceiro commit exclusivamente documental).
