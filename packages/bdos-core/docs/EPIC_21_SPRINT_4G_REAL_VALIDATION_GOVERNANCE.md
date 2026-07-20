# Epic 21 — Sprint 21.4G — Governança de Validação Real e Portões de Evidência

**Status: checkpoint publicado no commit `f18941e7b165b35f63a5005ede99d3f7983d9627` (branch `claude/epic-21-sprint-4g-real-validation-governance`, sem PR, incorporação à `main` pendente). Esta é uma rodada corretiva POSTERIOR a uma revisão independente dos cinco arquivos publicados naquele commit, que identificou problemas estruturais na própria governança — corrigidos aqui em um segundo commit auditável na mesma branch. Nenhuma alteração de algoritmo documental de f.0 a g.3.**

## Objetivo

Impedir, de forma auditável e parcialmente automatizada, que: validação sintética seja apresentada como validação real; execução técnica sem falha (`completed`/`structured`/`evaluated`) seja confundida com resultado utilizável; testes de caracterização sejam usados como testes de aceitação; capacidades sejam declaradas concluídas sem evidência; limitações conhecidas sejam omitidas; uma etapa downstream avance silenciosamente sobre uma saída upstream insuficiente; o veredito de um cenário ponta a ponta seja atribuído erroneamente a uma capacidade que apenas recebeu entrada inválida. Nenhum algoritmo documental nem código de execução de f.0 a g.3 foi alterado. Foram adicionados apenas controles transversais de arquitetura, testes e documentação.

## Padrões existentes reutilizados

- **Formato de registro versionado**: idioma do catálogo de sinais (`budget-document-signal-catalog.types.ts` + `.ts`) — array literal `as const`-tipado, `deepFreeze()` recursivo no carregamento, teste de integridade ao lado.
- **Localização transversal**: `src/architecture/` — única área transversal pré-existente do repositório para governança/arquitetura/qualidade.

## Padrão de maturidade — dois eixos verdadeiramente independentes

**Segunda correção (pós-revisão independente)**: o eixo de evidência da primeira rodada ainda incorporava resultado ao usar o termo "validada" (ex.: "validada_em_caso_real" só fazia sentido combinado com aprovação). Corrigido: os cinco níveis abaixo expressam SOMENTE profundidade de evidência coletada.

> **Nível informa até onde a capacidade foi submetida a evidência. Resultado informa o que essa evidência concluiu.**

### Eixo 1 — Nível de evidência (`RealValidationMaturityLevel`)

1. **Experimental** — implementação com contrato definido, sem suíte sintética abrangente.
2. **Evidenciada sinteticamente** — suíte sintética cobre nominal e fronteira; nunca exercitada contra documento real.
3. **Exercitada em caso real** — executada tecnicamente contra documento real (fingerprint completo registrado). `completed`/`structured`/`evaluated` sozinho nunca basta.
4. **Comparada formalmente em caso real** — resultado esperado definido ANTES da execução, comparado contra o observado. **Não implica aprovação** — pode legitimamente concluir `reprovada` (f.2a) ou `inconclusiva`.
5. **Submetida a teste adversarial** — matriz de casos adversariais deliberados avaliada. O resultado da matriz pode ser `aprovada`, `reprovada` (f.2a) ou `inconclusiva` quando a matriz não sustenta conclusão final.

### Eixo 2 — Resultado da validação (`ValidationResult`)

**Não avaliada**, **Aprovada**, **Reprovada**, **Inconclusiva** — nenhum nível de evidência implica nenhum resultado.

### Combinações permitidas (`PERMITTED_LEVEL_RESULT_COMBINATIONS`)

| Nível | Resultados permitidos |
|---|---|
| Experimental | Não avaliada (apenas) |
| Evidenciada sinteticamente | Não avaliada, Aprovada, Reprovada, Inconclusiva |
| Exercitada em caso real | Não avaliada, Aprovada, Reprovada, Inconclusiva |
| Comparada formalmente em caso real | Aprovada, Reprovada, Inconclusiva |
| Submetida a teste adversarial | Aprovada, Reprovada, Inconclusiva |

**Exemplos que a combinação agora permite explicitamente** (confirmados no registro real): `comparada_formalmente_em_caso_real` + `reprovada` (f.2a); `submetida_a_teste_adversarial` + `reprovada` seria igualmente permitido; `submetida_a_teste_adversarial` + `inconclusiva` é permitido quando a matriz não sustenta conclusão final.

## Separação capacidade vs. cenário ponta a ponta

**Segunda correção**: a caracterização econômica NUNCA deve carregar, ela própria, o veredito "reprovada" de uma falha upstream que a impediu de processar entrada válida. Novo discriminador `targetKind: "capability" | "end_to_end_scenario"`.

- **Caracterização econômica** (`targetKind: "capability"`): nível `exercitada_em_caso_real`, resultado **`inconclusiva`** — causa: "nunca recebeu entrada real estruturalmente válida devido à reprovação upstream de f.2a." Sua suíte sintética própria permanece integralmente aprovada; nenhum defeito próprio foi identificado.
- **Novo registro `tender-budget-real-extraction-e2e`** (`targetKind: "end_to_end_scenario"`, nome em português "Extração e Reconciliação do Orçamento Real"): nível `comparada_formalmente_em_caso_real`, resultado **`reprovada`** — esperado 11 grupos/25 subgrupos/300 itens/R$ 9.809.087,18; observado zero em cada um, nenhum total reconciliado. Depende explicitamente de todas as 9 capacidades (f.0 a g.3 + caracterização econômica). Portão de criação de rascunho de Versão do Orçamento bloqueado.

## Classificação final de todos os alvos

| Alvo | targetKind | Nível | Resultado | Causa (se inconclusiva) |
|---|---|---|---|---|
| f.0 — Geometria normalizada de item textual | capability | Exercitada em caso real | Não avaliada | — |
| f.1 — Reconstrução estrutural auditável | capability | Exercitada em caso real | Não avaliada | — |
| **f.2a — Detecção auditável de região tabular** | capability | **Comparada formalmente em caso real** | **Reprovada** | — |
| f.2b — Reconstrução de hipóteses físicas de coluna | capability | Exercitada em caso real | Inconclusiva | entrada degradada por f.2a |
| f.2c — Formação de hipóteses físicas de célula | capability | Exercitada em caso real | Inconclusiva | entrada degradada por f.2a |
| g.1 — Formação de evidência textual de célula | capability | Exercitada em caso real | Inconclusiva | entrada degradada por f.2a |
| g.2 — Formação de evidência estruturada neutra página-local | capability | Exercitada em caso real | Inconclusiva | entrada degradada por f.2a |
| g.3 — Avaliação neutra de continuidade na fronteira | capability | Exercitada em caso real | Inconclusiva | entrada degradada por f.2a |
| Caracterização econômica (21.4B) | capability | Exercitada em caso real | **Inconclusiva** | nunca recebeu entrada real estruturalmente válida |
| **Extração e Reconciliação do Orçamento Real** | **end_to_end_scenario** | **Comparada formalmente em caso real** | **Reprovada** | — |

Note a mudança decisiva: a caracterização econômica deixou de estar "reprovada" (primeira rodada, incorreto) para "inconclusiva" (correto) — o defeito comprovado é de f.2a e do cenário ponta a ponta, nunca da lógica de caracterização econômica em si, que permanece integralmente aprovada sinteticamente.

## Grafo de dependências (`dependsOnTargetIds`)

```
f.0 (sem dependências)
 └─ f.1 → f.2a → f.2b → f.2c → g.1 → g.2 → g.3
                                          └─ caracterização econômica (depende de g.2 e g.3)
cenário ponta a ponta → depende de TODAS as 9 capacidades acima
```

O guard verifica: nenhuma dependência aponta para um id inexistente (`dangling_dependency`); nenhum alvo depende de si mesmo (`self_dependency`); nenhum ciclo (`dependency_cycle`, detecção por DFS com pilha de visita); um cenário ponta a ponta sempre declara ao menos uma dependência (`end_to_end_scenario_missing_dependencies`).

**Propagação de reprovação/inconclusão** (implementação real, não apenas um issue code declarado e nunca executado): para cada alvo, o guard calcula o fecho transitivo de dependências e a maior severidade entre elas (`reprovada` > `inconclusiva`/`não avaliada` > `aprovada`). Se qualquer dependência (ou o próprio alvo) estiver `reprovada`, todo portão `real_validation`/`productive_use` desse alvo deve estar `bloqueado` (`gate_open_despite_unresolved_dependency`). Se a pior severidade for `inconclusiva`/`não avaliada` (sem nenhuma reprovação), esses mesmos portões nunca podem estar `aberto` — apenas `condicional` ou `bloqueado` (`gate_aberto_requires_no_unresolved_dependency`) — "uma dependência não avaliada não pode sustentar aprovação produtiva silenciosa". Isso substitui integralmente o antigo issue code `upstream_failure_not_blocking_downstream`, que era declarado mas nunca de fato verificado.

## Portões e `purposeKind` estruturado

**Segunda correção**: a versão anterior decidia bloqueios procurando substrings ("econôm", "produtiv") em `purposePt` (texto livre) — frágil e não estruturado. Corrigido: `DownstreamGate.purposeKind` é um tipo literal fechado: `diagnostic | development | technical_chaining | real_validation | productive_use`. O guard decide bloqueios EXCLUSIVAMENTE por `purposeKind` e pelo grafo de dependências — `purposePt` permanece apenas como descrição em português, nunca inspecionada por lógica.

Exemplo (f.1): consumidor `f2a-tabular-region-detection`, `purposeKind: "development"`, status **aberto**, justificativa limitada à investigação técnica; consumidor `econ-...`, `purposeKind: "real_validation"`, status **bloqueado**; consumidor `budget_version_draft_creation`, `purposeKind: "productive_use"`, status **bloqueado** — nenhum portão de `real_validation`/`productive_use` fica `condicional` enquanto f.2a estiver reprovada.

## Fingerprint completo

**Segunda correção**: todo fingerprint truncado ("5031da75...b92c5") foi substituído pelo SHA-256 completo `5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5` (64 caracteres hexadecimais). O modelo de evidências não aceita mais fingerprint truncado quando a governança reivindicar evidência real — o guard exige `FULL_SHA256_PATTERN` (`/^[0-9a-f]{64}$/`) em todo `realEvidence.sourceFingerprintSha256`.

## Imutabilidade profunda real

**Segunda correção**: a implementação anterior usava `Object.freeze` apenas no primeiro nível (o array e, superficialmente, cada registro — mas não portões, histórico, evidências ou arrays aninhados, que permaneciam mutáveis). Corrigido: `deepFreeze` recursivo (idêntico em espírito ao já usado em `budget-document-signal-catalog.ts`), aplicado ao registro inteiro — registros, portões, histórico, evidências, limitações, falhas, dependências. Sete testes permanentes tentam mutar: propriedade de nível, status de portão, item de histórico, array de falhas (push), evidência real, array de dependências (push), e o array do registro inteiro (push) — todos confirmam que a estrutura não muda mesmo quando a atribuição não lança exceção.

## Histórico de avaliações — integridade reforçada

Além da existência e identificação de papéis já exigidas na primeira rodada, o guard agora verifica: `evaluationId` único em todo o registro (`duplicate_evaluation_id`); a última entrada do histórico corresponde exatamente ao nível/resultado/revisão/data atuais do registro (`history_last_entry_mismatch`); o encadeamento entre entradas consecutivas nunca está quebrado — `previousLevel`/`previousResult` da entrada N deve igualar `newLevel`/`newResult` da entrada N-1 (`history_chain_broken`); toda combinação histórica (nível, resultado) é permitida (`history_disallowed_combination`); datas são ISO válidas (`history_invalid_date`) e nunca decrescentes (`history_dates_not_ordered`); decisão e justificativa nunca vazias.

## Pacote padrão de evidências

`packages/bdos-core/docs/TEMPLATE_SPRINT_EVIDENCE_PACKAGE.md` — atualizado com `targetKind`, nível neutro e resultado independente explicitados separadamente, dependências, `purposeKind` dos portões, SHA-256 integral, e distinção explícita entre capacidade e cenário ponta a ponta.

## Protocolo de interrupção

1. Interromper. 2. Reverter produção. 3. Preservar diagnóstico em branch separada. 4. Não abrir PR. 5. Não promover nível nem melhorar resultado. 6. Registrar o contraexemplo. 7. Solicitar autorização explícita para expansão de escopo. 8. Impedir continuidade downstream dependente — agora verificado mecanicamente pelo grafo de dependências, não apenas declarado.

## Papéis

Implementador principal: Claude Code. Revisão técnica em checkpoints: ChatGPT (externa, não formalizada como Revisor adversarial independente — `ROLE_NOT_FORMALIZED`). Aprovação final: responsável humano pelo produto, pendente em toda entrada do histórico.

## Regra sobre testes

"Todos os testes passaram" nunca é evidência suficiente isoladamente. O guard reforça isso estruturalmente: um registro com resultado `aprovada` não pode conter, em `knownFailuresPt`, uma falha real não trivial.

## Guard arquitetural

`packages/bdos-core/src/architecture/real-validation-governance/capability-maturity-registry.test.ts` — 60 verificações no total: ~34 estruturais sobre o registro real, ~7 de imutabilidade profunda, ~10 testes negativos permanentes (nunca criados e apagados — `validateRegistry` é exportada precisamente para permitir construir registros fictícios inválidos e comprovar cada rejeição), mais verificações específicas de classificação de cada alvo mandatado. Decide bloqueios exclusivamente por `purposeKind` estruturado e pelo grafo de `dependsOnTargetIds` — nunca por varredura de palavras em texto livre.

## Declarações negativas — limitações da própria governança

- Não corrige nenhum algoritmo documental.
- Nenhum limite numérico de portão foi inventado.
- O guard valida estrutura, nunca a veracidade do conteúdo textual.
- A classificação de f.0/f.1/f.2b-g.3 é interpretação da evidência existente.
- Cobre apenas f.0-g.3, a caracterização econômica e o cenário ponta a ponta descrito.
- O histórico desta rodada tem exatamente uma entrada por alvo — a mecânica de anexar novas entradas nunca foi exercitada em uma segunda rodada real de avaliação ainda.

## Fora do escopo (confirmado, nada tocado)

Alteração de f.0 a g.3; correção de f.2a; geometria tabular; caracterização econômica; PDF; upload; API; UI; persistência; migrations; laboratório; Sprint 21.4B.3A; PR; merge; reescrita de histórico Git.

## Próximo passo

Autorização para a Sprint 21.4B.3 permanece pendente — os portões de `real_validation`/`productive_use` de f.2a, da caracterização econômica e do cenário ponta a ponta só mudam de `bloqueado` após essa correção ser implementada, validada sintética e adversarialmente, e revalidada contra o documento real.
