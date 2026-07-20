# Epic 21 — Sprint 21.4G — Governança de Validação Real e Portões de Evidência

**Status: terceira rodada corretiva, publicada em um terceiro commit auditável na branch `claude/epic-21-sprint-4g-real-validation-governance` (sem PR, incorporação à `main` pendente). Esta rodada é POSTERIOR à revisão independente do segundo commit (`853c710b012536b3d3e040bbd0240e36ef4a530d`), que identificou lacunas estruturais remanescentes — corrigidas aqui. Nenhuma alteração de algoritmo documental de f.0 a g.3. Sprint 21.4B.3A não iniciada.**

## Objetivo

Impedir, de forma auditável e parcialmente automatizada, que: validação sintética seja apresentada como validação real; execução técnica sem falha (`completed`/`structured`/`evaluated`) seja confundida com resultado utilizável; testes de caracterização sejam usados como testes de aceitação; capacidades sejam declaradas concluídas sem evidência; limitações conhecidas sejam omitidas; uma etapa downstream avance silenciosamente sobre uma saída upstream insuficiente; o veredito de um cenário ponta a ponta seja atribuído erroneamente a uma capacidade que apenas recebeu entrada inválida; um portão produtivo/real herde aprovação por omissão de exigência; uma expectativa "congelada antes da execução" seja, na verdade, reconstruída de memória depois do fato. Nenhum algoritmo documental nem código de execução de f.0 a g.3 foi alterado. Foram adicionados apenas controles transversais de arquitetura, testes e documentação.

## Padrões existentes reutilizados

- **Formato de registro versionado**: idioma do catálogo de sinais (`budget-document-signal-catalog.types.ts` + `.ts`) — array literal `as const`-tipado, `deepFreeze()` recursivo no carregamento, teste de integridade ao lado.
- **Localização transversal**: `src/architecture/` — única área transversal pré-existente do repositório para governança/arquitetura/qualidade.

## Terceira correção (pós-segunda revisão independente) — o que mudou

1. **Portões vinculados ao nível de evidência, não apenas ao resultado.** Cada `DownstreamGate` agora declara `minimumEvidenceLevel` e `allowedResults` — o guard verifica o próprio alvo e toda dependência transitiva necessária contra essa exigência antes de aceitar um portão `aberto`. Isso fecha a lacuna em que uma aprovação meramente sintética (`evidenciada_sinteticamente` + `aprovada`) poderia sustentar um portão `real_validation`/`productive_use` aberto por omissão. `real_validation`/`productive_use` nunca podem declarar `minimumEvidenceLevel` abaixo de `comparada_formalmente_em_caso_real` (`MINIMUM_EVIDENCE_LEVEL_FLOOR_FOR_GATED_PURPOSES`).
2. **Proveniência auditável da expectativa.** `RealValidationEvidenceReal` ganhou `expectationDefinedAt`/`expectationReference`/`executionReference`. Obrigatórios a partir de `comparada_formalmente_em_caso_real`. Para f.2a, isso expôs uma distinção que a rodada anterior não fazia: apenas o invariante QUALITATIVO de `tabular-region-formation.ts` (uma janela não deve fragmentar conteúdo que pertence legitimamente à mesma tabela) tinha proveniência genuinamente anterior à execução real (commit `323de6bb6d83cfe0779c2d57e0ca8ba380fd6011`, 2026-07-17, três dias antes da execução da Sprint 21.4B). A caracterização NUMÉRICA específica do documento (~10 colunas, 1 região por página) foi obtida por inspeção DURANTE o diagnóstico (Sprints 21.4B.1/21.4B.2) — depois de a falha já ter sido observada — e o registro agora declara essa distinção explicitamente, em vez de apresentar a caracterização numérica como se estivesse congelada de antemão.
3. **f.2a reclassificado para `submetida_a_teste_adversarial`/`reprovada`.** A proveniência qualitativa comprovada (item 2) sustenta `comparada_formalmente_em_caso_real`; a matriz adversarial genuína (Casos J/L3/L7) sustenta o nível mais profundo. A descrição do defeito deixou de se limitar a "descrições multilinha": agora cobre explicitamente linhas internas esparsas, continuações, cabeçalhos e alinhamentos privados, e não exige mais "uma região por página" como forma geométrica obrigatória — a exigência real é cobertura estrutural e preservação das colunas/linhas legítimas. `promotionConditionPt` agora aponta primeiro para a Sprint 21.4B.3A (descoberta arquitetural, ainda não autorizada) e só depois para a 21.4B.3B (implementação, condicionada ao resultado da 3A) — sem presumir que pareamento de bordas/envelope resolverá o problema.
4. **`failureAssessment` estruturado.** Substitui `NO_KNOWN_FAILURE_MARKER` e toda busca textual pela palavra "nenhuma". Três estados: `none_known` (só compatível com `aprovada`), `confirmed` (exigido por `reprovada`, compatível com `inconclusiva`), `not_assessable` (exigido por `nao_avaliada`, compatível com `inconclusiva`). `knownFailuresPt` deixou de conter frases-marcador como "nenhuma falha conhecida registrada" — passou a ficar vazio quando não há falha confirmada, com o estado declarado apenas em `failureAssessment`.
5. **Portões com `purposeKind` estruturado (mantido) + finalidade operacional agora com piso explícito.** Nenhum portão herda exigência universal inventada — cada um declara a própria.
6. **Dependências: consumidor estruturado (`consumerKind`).** `registered_target` exige que o `consumerId` exista no registro e que o alvo produtor apareça no fecho transitivo de dependências desse consumidor (`gate_producer_not_in_consumer_dependencies`); `external_action`/`consumer_class` nunca são tratados como alvo interno. Portões duplicados/contraditórios (mesmo par consumidor+finalidade) são rejeitados.
7. **Fingerprint** — inalterado desde a segunda correção, SHA-256 completo de 64 caracteres.
8. **Histórico fortalecido ainda mais**: primeira entrada nunca preenche `previousLevel`/`previousResult`; valores históricos anteriores (quando presentes) são sempre reconhecidos; `evaluatedRevision` (registro e cada entrada de histórico) deve ser uma revisão Git completa de 40 caracteres hexadecimais; `evidenceConsideredPt` nunca vazio; `technicalReportOwner` nunca vazio; a última entrada replica `inconclusiveCausePt` do registro exatamente, e nunca fica sem limitações/falhas quando o registro as declara.
9. **Validação de data com round-trip.** `isValidIsoDate` agora exige `parsed.toISOString().slice(0, 10) === value` — rejeita datas que o JavaScript normaliza silenciosamente (`2026-02-30` → `2026-03-02`). Testes negativos permanentes cobrem `2026-02-29/30/31`, `2026-13-01`, `2026-00-10`, `2026-01-00`.
10. **Fixtures de teste corrigidas.** `baseRecord()`/`baseGate()` são agora comprovadamente neutros (`validateRegistry([baseRecord()])` retorna zero issues, testado explicitamente) — cada teste negativo introduz exatamente a violação sob teste a partir dessa base, em vez de uma base que já carregava uma inconsistência não relacionada.
11. **Renomeação de contrato**: `CapabilityMaturityRecord`/`CapabilityMaturityRegistry`/`CAPABILITY_MATURITY_REGISTRY` → `RealValidationTargetRecord`/`RealValidationTargetRegistry`/`REAL_VALIDATION_TARGET_REGISTRY` (e as funções/tipos correlatos) — o registro sempre conteve tanto capacidades quanto cenários ponta a ponta; o nome antigo sugeria só capacidades. Sem alias legado (o código nunca entrou em `main`).

## Padrão de maturidade — dois eixos verdadeiramente independentes (mantido da segunda correção)

> **Nível informa até onde a capacidade foi submetida a evidência. Resultado informa o que essa evidência concluiu.**

### Eixo 1 — Nível de evidência (`RealValidationMaturityLevel`)

1. **Experimental** 2. **Evidenciada sinteticamente** 3. **Exercitada em caso real** 4. **Comparada formalmente em caso real** (exige proveniência auditável da expectativa) 5. **Submetida a teste adversarial**.

### Eixo 2 — Resultado (`ValidationResult`)

**Não avaliada**, **Aprovada**, **Reprovada**, **Inconclusiva**.

### Combinações permitidas

| Nível | Resultados permitidos |
|---|---|
| Experimental | Não avaliada (apenas) |
| Evidenciada sinteticamente | Não avaliada, Aprovada, Reprovada, Inconclusiva |
| Exercitada em caso real | Não avaliada, Aprovada, Reprovada, Inconclusiva |
| Comparada formalmente em caso real | Aprovada, Reprovada, Inconclusiva |
| Submetida a teste adversarial | Aprovada, Reprovada, Inconclusiva |

## Classificação final de todos os alvos

| Alvo | targetKind | Nível | Resultado | failureAssessment |
|---|---|---|---|---|
| f.0 — Geometria normalizada de item textual | capability | Exercitada em caso real | Não avaliada | not_assessable |
| f.1 — Reconstrução estrutural auditável | capability | Exercitada em caso real | Não avaliada | not_assessable |
| **f.2a — Detecção auditável de região tabular** | capability | **Submetida a teste adversarial** | **Reprovada** | confirmed |
| f.2b — Reconstrução de hipóteses físicas de coluna | capability | Exercitada em caso real | Inconclusiva | not_assessable |
| f.2c — Formação de hipóteses físicas de célula | capability | Exercitada em caso real | Inconclusiva | not_assessable |
| g.1 — Formação de evidência textual de célula | capability | Exercitada em caso real | Inconclusiva | not_assessable |
| g.2 — Formação de evidência estruturada neutra página-local | capability | Exercitada em caso real | Inconclusiva | not_assessable |
| g.3 — Avaliação neutra de continuidade na fronteira | capability | Exercitada em caso real | Inconclusiva | not_assessable |
| Caracterização econômica (21.4B) | capability | Exercitada em caso real | Inconclusiva | not_assessable |
| **Extração e Reconciliação do Orçamento Real** | **end_to_end_scenario** | **Comparada formalmente em caso real** | **Reprovada** | confirmed |

Mudança decisiva desta rodada: f.2a avançou de `comparada_formalmente_em_caso_real` (segunda rodada) para `submetida_a_teste_adversarial` (terceira rodada), com a proveniência da expectativa honestamente separada entre o invariante qualitativo pré-existente e a caracterização numérica diagnóstica — nunca apresentando esta última como se estivesse congelada antes da execução.

## Proveniência das expectativas (nova nesta rodada)

- **f.2a**: `expectationDefinedAt = 2026-07-17`, `expectationReference` = commit `323de6bb6d83cfe0779c2d57e0ca8ba380fd6011` (`tabular-region-formation.test.ts`, suíte sintética pré-existente — cobre apenas o invariante qualitativo, não os números específicos do documento). `executionReference` = commits `c7dc09ee675cb810ca338f83a33e1f22b8e65864` (Sprint 21.4B), `0e7fc0883f73b4f9fb868173d773e434b5362606` (21.4B.1), `13257242e38273c3a816db2619f847112c466794` (21.4B.2).
- **Cenário ponta a ponta**: `expectationDefinedAt = 2026-07-14`, `expectationReference` = commit `5c86f451bc5b3768ec40930560430ab260f1372e` (fixture de referência independente `LAGOA_DO_ARROZ_OFFICIAL_LINES`, Sprint 21.3B — seis dias antes da execução real). `executionReference` = commit `c7dc09ee675cb810ca338f83a33e1f22b8e65864` (Sprint 21.4B).
- Nenhum outro alvo (f.0, f.1, f.2b-g.3, caracterização econômica) exige proveniência de expectativa, pois nenhum reivindica nível `comparada_formalmente_em_caso_real`/`submetida_a_teste_adversarial`.

## Grafo de dependências

```
f.0 (sem dependências)
 └─ f.1 → f.2a → f.2b → f.2c → g.1 → g.2 → g.3
                                          └─ caracterização econômica (depende de g.2 e g.3)
cenário ponta a ponta → depende de TODAS as 9 capacidades acima
```

O guard verifica: nenhuma dependência aponta para um id inexistente; nenhum alvo depende de si mesmo; nenhum ciclo (DFS com pilha de visita); um cenário ponta a ponta sempre declara ao menos uma dependência; para portões `consumerKind: "registered_target"`, o consumidor existe no registro E o alvo produtor aparece no fecho transitivo de dependências desse consumidor (`gate_producer_not_in_consumer_dependencies`) — nunca um consumidor interno "solto".

**Propagação de reprovação/inconclusão** (dupla verificação, nesta rodada): (a) severidade agregada do fecho transitivo (`reprovada` > `inconclusiva`/`não avaliada` > `aprovada`) continua decidindo bloqueio universal de portões `real_validation`/`productive_use`; (b) adicionalmente, cada portão agora verifica seu próprio `minimumEvidenceLevel`/`allowedResults` contra o nível/resultado do alvo e de toda dependência necessária — um portão pode ficar `aberto` apenas quando AMBAS as verificações permitem.

## Portões — modelo final

Cada `DownstreamGate` declara: `consumerId`, `consumerKind` (`registered_target`/`external_action`/`consumer_class`), `purposePt`, `purposeKind` estruturado, `status`, `minimumEvidenceLevel`, `allowedResults`, `rationalePt`, `missingEvidencePt` (obrigatoriamente `null` quando `aberto`, obrigatoriamente preenchido quando não `aberto`), `behaviorWhenBlockedPt`. Exemplo (f.1): consumidor `f2a-tabular-region-detection` (`registered_target`), `purposeKind: "development"`, `minimumEvidenceLevel: "experimental"`, `allowedResults`: todos os 4, status **aberto** — encadeamento técnico nunca exige mais do que uma implementação existente. Consumidor `econ-...` (`registered_target`), `purposeKind: "real_validation"`, `minimumEvidenceLevel: "comparada_formalmente_em_caso_real"`, `allowedResults: ["aprovada"]`, status **bloqueado**.

## Estado estruturado de falhas (`failureAssessment`)

`none_known` | `confirmed` | `not_assessable` — nenhuma decisão do guard depende de substring em texto livre. Regras: `reprovada` exige `confirmed` e ao menos uma falha detalhada; `aprovada` exige `none_known`; `inconclusiva` e `nao_avaliada` nunca podem ser `none_known` (exigem `confirmed` ou `not_assessable`).

## Imutabilidade profunda real (mantida da segunda correção)

`deepFreeze` recursivo aplicado ao registro inteiro — sete testes permanentes de mutação, todos confirmando que a estrutura não muda.

## Histórico de avaliações — integridade reforçada (terceira correção)

Além das verificações da segunda rodada (evaluationId único, última entrada corresponde ao estado atual, encadeamento nunca quebrado, combinações históricas válidas, datas ISO válidas e ordenadas): primeira entrada nunca preenche `previousLevel`/`previousResult`; valores históricos anteriores, quando presentes, são sempre reconhecidos; `evaluatedRevision` (registro e cada entrada) é sempre uma revisão Git completa de 40 hex; `evidenceConsideredPt` nunca vazio; `technicalReportOwner` nunca vazio; a última entrada replica exatamente `inconclusiveCausePt` do registro e nunca fica sem limitações/falhas quando o registro as declara.

## Pacote padrão de evidências

`packages/bdos-core/docs/TEMPLATE_SPRINT_EVIDENCE_PACKAGE.md` — atualizado nesta rodada com: proveniência de expectativa (`expectationDefinedAt`/`expectationReference`/`executionReference`); `minimumEvidenceLevel`/`allowedResults` por portão; `consumerKind`; `failureAssessment`; linguagem não ambígua para arquivos alterados.

## Protocolo de interrupção

1. Interromper. 2. Reverter produção. 3. Preservar diagnóstico em branch separada. 4. Não abrir PR. 5. Não promover nível nem melhorar resultado. 6. Registrar o contraexemplo. 7. Solicitar autorização explícita para expansão de escopo. 8. Impedir continuidade downstream dependente — verificado mecanicamente pelo grafo de dependências e agora também pelo piso de nível/resultado de cada portão.

## Papéis

Implementador principal: Claude Code. Revisão técnica em checkpoints: ChatGPT (externa, não formalizada como Revisor adversarial independente — `ROLE_NOT_FORMALIZED`). Aprovação final: responsável humano pelo produto, pendente em toda entrada do histórico.

## Regra sobre testes

"Todos os testes passaram" nunca é evidência suficiente isoladamente. O guard reforça isso estruturalmente via `failureAssessment` — um registro com resultado `aprovada` nunca pode declarar `failureAssessment: "confirmed"`.

## Guard arquitetural

`packages/bdos-core/src/architecture/real-validation-governance/capability-maturity-registry.test.ts` — 95 verificações no total (61 estruturais/classificação sobre o registro real, 7 de imutabilidade profunda, 27 testes negativos permanentes — nunca criados e apagados — mais o teste de neutralidade de `baseRecord()`). Decide bloqueios exclusivamente por `purposeKind`/`minimumEvidenceLevel`/`allowedResults` estruturados e pelo grafo de `dependsOnTargetIds` — nunca por varredura de palavras em texto livre.

## Declarações negativas — limitações da própria governança

- Não corrige nenhum algoritmo documental.
- Nenhum limite numérico de portão foi inventado — cada portão declara o seu, verificado pelo guard.
- O guard valida estrutura, nunca a veracidade do conteúdo textual.
- A classificação de f.0/f.1/f.2b-g.3 é interpretação da evidência existente.
- Cobre apenas f.0-g.3, a caracterização econômica e o cenário ponta a ponta descrito.
- O histórico desta rodada tem exatamente uma entrada por alvo — a mecânica de anexar novas entradas nunca foi exercitada em uma segunda rodada real de avaliação ainda.
- A proveniência adversarial de f.2a (Casos J/L3/L7) repousa no mandato explícito do usuário nesta mesma conversa, anterior à tentativa de correção — não existe um commit Git isolado que separe cronologicamente a redação das fixtures da execução do spike dentro da mesma sessão de trabalho. Esta limitação está declarada explicitamente no próprio registro de f.2a.

## Fora do escopo (confirmado, nada tocado)

Alteração de f.0 a g.3; correção de f.2a; geometria tabular; caracterização econômica; PDF; upload; API; UI; persistência; migrations; laboratório; Sprint 21.4B.3A; PR; merge; reescrita de histórico Git.

## Próximo passo

Autorização para a Sprint 21.4B.3A (descoberta arquitetural) permanece pendente — os portões de `real_validation`/`productive_use` de f.2a, da caracterização econômica e do cenário ponta a ponta só mudam de `bloqueado` após essa investigação concluir se uma invariante geométrica segura existe, uma correção (21.4B.3B) ser implementada e validada sintética e adversarialmente, e o cenário ser revalidado contra o documento real.
