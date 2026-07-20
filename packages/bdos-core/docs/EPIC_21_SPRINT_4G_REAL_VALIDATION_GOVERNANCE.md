# Epic 21 — Sprint 21.4G — Governança de Validação Real e Portões de Evidência

**Status: padrão de maturidade com dois eixos separados (nível de evidência / resultado da validação), registro de capacidades (f.0 a g.3 mais a caracterização econômica da 21.4B) com portões específicos por (consumidor, finalidade) e histórico de avaliações, guard estrutural automatizado, modelo de pacote de evidências, protocolo de interrupção e separação de papéis — corrigidos e movidos para `src/architecture/`. Nenhuma alteração de algoritmo documental. Nenhum commit/push/PR desta Sprint até nova revisão.**

## Objetivo

Impedir, de forma auditável e parcialmente automatizada, que: validação sintética seja apresentada como validação real; execução técnica sem falha (`completed`/`structured`/`evaluated`) seja confundida com resultado utilizável; testes de caracterização sejam usados como testes de aceitação; capacidades sejam declaradas concluídas sem evidência; limitações conhecidas sejam omitidas; uma etapa downstream avance silenciosamente sobre uma saída upstream insuficiente. Esta Sprint não corrige nenhum algoritmo documental — a falha real de f.2a permanece exatamente como estava, apenas agora formalmente registrada e com portão bloqueado.

## Padrões existentes reutilizados

- **Formato de registro versionado**: idioma do catálogo de sinais (`budget-document-signal-catalog.types.ts` + `.ts`) — array literal `as const`-tipado, `deepFreeze()` no carregamento, teste de integridade ao lado. Nunca JSON/YAML externo.
- **Guard automatizado**: segue o padrão do auto-teste de integridade do catálogo de sinais (valida a FORMA dos dados estruturados), não o padrão de scan textual de imports dos guards de fronteira (`*-boundaries.test.ts`).
- **Descoberta automática de teste**: `scripts/run-tests.mjs` descobre qualquer `*.test.ts` sob todo o repositório sem passo de registro.
- **Nomes de capacidade e identificador de Sprint**: extraídos literalmente do código-fonte.
- **Localização transversal**: `src/architecture/` é a única área transversal pré-existente no repositório para governança/arquitetura/qualidade (hospeda todos os guards de fronteira `*-boundaries.test.ts`) — não há pasta `governance`/`quality` separada em `packages/config` ou em qualquer outro lugar do monorepo. O módulo foi movido de `src/domain/real-validation-governance/` para `src/architecture/real-validation-governance/` (correção estrutural desta Sprint) precisamente porque governança de validação real não é domínio de negócio, e a alternativa correta já existia — nenhuma nova camada foi criada.

## Padrão de maturidade — dois eixos separados

**Correção estrutural**: a versão anterior misturava nível de evidência e resultado da validação num único eixo de 6 valores, incluindo indevidamente "Reprovada em caso real" como se fosse um nível de rigor. Corrigido: dois eixos independentes.

### Eixo 1 — Nível de evidência (`RealValidationMaturityLevel`)

Cinco níveis, em ordem crescente de RIGOR de evidência coletada — nunca de resultado:

1. **Experimental** — implementação com contrato definido, sem suíte sintética abrangente.
2. **Validada sinteticamente** — suíte sintética cobre nominal e fronteira; nunca exercitada contra documento real.
3. **Caracterizada em caso real** — exercitada tecnicamente contra documento real (fingerprint registrado). `completed`/`structured`/`evaluated` sozinho nunca basta. **Este é o nível correto mesmo quando uma comparação formal FOI feita e o resultado saiu reprovado ou inconclusivo** — "validada" descreve rigor com resultado positivo confirmado, nunca rigor isolado do resultado.
4. **Validada em caso real** — resultado esperado definido ANTES da execução, comparado contra o observado, e o resultado dessa comparação é **aprovada**. Se o resultado for reprovada/inconclusiva, o nível correto permanece "Caracterizada em caso real".
5. **Validada adversarialmente** — além do nível 4 com resultado aprovada, matriz de casos adversariais corretamente rejeitados, resultado aprovada. Único nível sem exigência de `promotionConditionPt`.

### Eixo 2 — Resultado da validação (`ValidationResult`)

Quatro resultados, independentes do nível: **Não avaliada**, **Aprovada**, **Reprovada**, **Inconclusiva**.

### Combinações permitidas (`PERMITTED_LEVEL_RESULT_COMBINATIONS`)

| Nível | Resultados permitidos |
|---|---|
| Experimental | Não avaliada |
| Validada sinteticamente | Não avaliada, Aprovada |
| Caracterizada em caso real | Não avaliada, Aprovada, Reprovada, Inconclusiva |
| Validada em caso real | Aprovada (apenas) |
| Validada adversarialmente | Aprovada (apenas) |

**Exemplos mandatados, aplicados literalmente no registro:**
- **f.2a**: nível Caracterizada em caso real, resultado Reprovada.
- **Caracterização econômica**: nível Caracterizada em caso real, resultado Reprovada.
- **f.2b a g.3**: nível Caracterizada em caso real, resultado Inconclusiva, causa "entrada real degradada pela reprovação upstream em f.2a".

## Registro de capacidades

`packages/bdos-core/src/architecture/real-validation-governance/capability-maturity-registry.ts` — 9 registros. Cada um contém: identificador estável, nome em português, `stageId`, nível (`currentLevel`) e resultado (`currentResult`) separados, causa de inconclusão (`inconclusiveCausePt`, obrigatória apenas quando `currentResult === "inconclusiva"`), evidência sintética/real/adversarial, limitações e falhas conhecidas, condição de promoção, commit/data/responsável da última avaliação, **múltiplos portões downstream específicos** (`downstreamGates: ReadonlyArray<DownstreamGate>`), e **histórico de avaliações** (`evaluationHistory`).

### Classificação final

| Capacidade | Nível | Resultado | Causa (se inconclusiva) |
|---|---|---|---|
| f.0 — Geometria normalizada de item textual | Caracterizada em caso real | Não avaliada | — |
| f.1 — Reconstrução estrutural auditável | Caracterizada em caso real | Não avaliada | — |
| **f.2a — Detecção auditável de região tabular** | Caracterizada em caso real | **Reprovada** | — |
| f.2b — Reconstrução de hipóteses físicas de coluna | Caracterizada em caso real | Inconclusiva | entrada degradada por f.2a |
| f.2c — Formação de hipóteses físicas de célula | Caracterizada em caso real | Inconclusiva | entrada degradada por f.2a |
| g.1 — Formação de evidência textual de célula | Caracterizada em caso real | Inconclusiva | entrada degradada por f.2a |
| g.2 — Formação de evidência estruturada neutra página-local | Caracterizada em caso real | Inconclusiva | entrada degradada por f.2a |
| g.3 — Avaliação neutra de continuidade na fronteira | Caracterizada em caso real | Inconclusiva | entrada degradada por f.2a |
| **Caracterização econômica (21.4B)** | Caracterizada em caso real | **Reprovada** | — |

Nenhuma capacidade recebeu nível acima de "Caracterizada em caso real": para f.2a e a caracterização econômica isso é por definição do próprio nível (resultado negativo mantém o nível em "caracterizada", nunca "validada"); para f.0/f.1/f.2b-g.3, porque nenhuma comparação formal esperado/observado, definida antes da execução, foi registrada especificamente para elas.

## Portões específicos (não mais um único status por capacidade)

**Correção estrutural**: um portão único por capacidade escondia que, por exemplo, f.1 está aberta para um consumidor e bloqueada para outro. Cada capacidade agora declara uma coleção de `DownstreamGate` — `{ consumerId, purposePt, status, rationalePt, missingEvidencePt, behaviorWhenBlockedPt }`. Exemplos do registro:

- **f.1** → consumidor `f2a-tabular-region-detection`, finalidade "diagnóstico/desenvolvimento", status **aberto** (justificativa limitada à investigação técnica); consumidor `econ-...`, finalidade "validação real", status **bloqueado**; consumidor `budget_version_draft_creation`, finalidade "uso produtivo", status **bloqueado** — nenhum portão econômico/produtivo fica `condicional` enquanto f.2a estiver reprovada.
- **f.2a** → consumidor `diagnostico_estrutural`, status **aberto**; consumidor `f2b-...`, status **bloqueado**; consumidor `econ-...`, status **bloqueado**.
- **Caracterização econômica** → consumidor `budget_version_draft_creation`, finalidade "criação de rascunho de Versão do Orçamento", status **bloqueado**.

Nenhum portão fica "aberto" para finalidade econômica/produtiva quando a própria capacidade (ou a que ela lista como reprovada) está reprovada — verificado pelo guard (`gate_open_for_blocked_upstream_purpose`).

## Histórico de avaliações

Cada capacidade carrega `evaluationHistory: ReadonlyArray<CapabilityEvaluationHistoryEntry>` — imutável, apenas anexado, nunca sobrescrito. Cada entrada: identificador da avaliação, data, **revisão do código avaliado** (`evaluatedRevision` — o código de f.0-g.3 realmente avaliado, nunca o commit que contém o próprio registro de governança; nesta rodada, `35e18a50fcd3b357db71d4662b83ba0b545ae1b3` para todas as capacidades, já que nenhum código de f.0-g.3 mudou entre as Sprints de diagnóstico), nível/resultado anterior e novo, evidências consideradas, limitações, falhas conhecidas, implementador, revisor adversarial, aprovador, decisão e justificativa. Nenhuma infraestrutura de eventos/banco — array estático no próprio registro, exatamente como o mandato autorizou.

## Papéis — corrigidos com precisão

**Correção obrigatória**: a versão anterior registrava, incorretamente, que os três papéis formais foram "sempre executados pela mesma IA". Corrigido para refletir a realidade declarada:

- **Implementador principal**: Claude Code.
- **Revisão técnica em checkpoints**: ChatGPT — externa a este ambiente de execução, **não formalizada** como papel independente de Revisor adversarial dentro desta governança (`ROLE_NOT_FORMALIZED` no registro).
- **Aprovação final**: responsável humano pelo produto — **pendente em toda entrada do histórico**, nunca marcada como já concluída.
- **Deficiência identificada e registrada**: ausência (ou insuficiência) de revisão adversarial formal e independente, e de portões reais previamente definidos antes desta Sprint.

Todo campo `adversarialReviewer`/`approver` do histórico usa `ROLE_NOT_FORMALIZED` ("não formalizado") quando o papel não foi formalmente executado — nunca inventa independência que não existiu, nunca apaga a participação real de cada agente.

## Pacote padrão de evidências

`packages/bdos-core/docs/TEMPLATE_SPRINT_EVIDENCE_PACKAGE.md` — 17 seções, agora explicitando nível/resultado anterior e solicitado separadamente, portões afetados e decisão humana necessária (ver arquivo).

## Protocolo de interrupção

1. Interromper. 2. Reverter produção (`git diff` vazio). 3. Preservar diagnóstico em branch separada. 4. Não abrir PR. 5. Não promover nível nem melhorar resultado — permanece sustentado pela evidência real. 6. Registrar o contraexemplo. 7. Solicitar autorização explícita para expansão de escopo. 8. Impedir continuidade downstream dependente — o(s) portão(ões) correspondente(s) ficam `bloqueado`/`condicional`, nunca `aberto` por omissão.

Já aplicado na prática (Sprints 21.4B.1, 21.4B.2) antes de existir formalmente.

## Portões entre etapas — contrato conceitual

Cada portão declara métricas utilizadas, limites fundamentados (nenhum percentual foi inventado — dados insuficientes para fundamentar um limite numérico; o portão permanece categórico: `aberto`/`bloqueado`/`condicional`), origem dos limites, comportamento quando reprova, se downstream pode continuar, e quais perdas são toleráveis versus bloqueantes. Aplicação ao caso atual: uma região tabular real com fragmentação severa (0/11/0/25/0/300/total nulo) e cobertura insuficiente não pode alimentar silenciosamente a caracterização econômica — confirmado pelos portões específicos de f.2a e pelo portão de rascunho da caracterização econômica, ambos bloqueados.

## Proteção dos documentos reais

Documentos reais fora do Git; fingerprints (mesmo truncados, copiados literalmente da fonte) podem ser versionados; páginas/traços estruturais podem ser referenciados, nunca o caminho do arquivo; fixtures sintéticas minimizadas/anonimizadas devem declarar linhagem quando derivadas de observação real; nenhuma fixture sintética pode ser apresentada como documento real — o guard verifica padrões de caminho local em todos os campos de evidência real.

## Regra sobre testes

"Todos os testes passaram" nunca é evidência suficiente isoladamente. Separar sempre: testes técnicos, testes de caracterização (nunca contam como aceitação aprovada), testes de aceitação, testes adversariais, validação real, critérios ainda reprovados. O guard reforça isso estruturalmente: um registro com resultado `aprovada` não pode conter, em `knownFailuresPt`, uma falha real não trivial (checagem `aprovada_with_known_failure`) — caracterização de defeito nunca pode coexistir com um resultado "aprovada".

## Guard arquitetural

`packages/bdos-core/src/architecture/real-validation-governance/capability-maturity-registry.test.ts` — 26 verificações, incluindo (lista completa no arquivo): identificadores únicos; níveis/resultados reconhecidos; "reprovada" nunca aparece como nível; combinação (nível, resultado) sempre permitida; toda reprovação com falhas conhecidas; toda inconclusão com causa; portões sempre com consumidor e finalidade; portão não aberto sempre com evidência faltante; capacidade reprovada nunca com portão aberto para finalidade econômica/produtiva; histórico existe e identifica os três papéis; nenhum caminho local; fingerprints não vazios; resultado esperado/observado sempre presentes em evidência real; f.2a e a caracterização econômica corretamente reprovadas; f.2b-g.3 corretamente inconclusivas; nenhum "aprovada" esconde falha real; nenhum aprovador humano marcado como já formalizado. Testado negativamente (6 cenários deliberadamente inválidos) fora do commit, confirmando que cada checagem realmente rejeita a violação correspondente — nenhuma alteração de teste negativo permanece no estado final.

## Declarações negativas — limitações da própria governança

- Não corrige nenhum algoritmo documental.
- Nenhum limite numérico de portão foi inventado.
- O guard valida estrutura, nunca a veracidade do conteúdo textual — a separação de papéis é o controle real contra preenchimento enganoso.
- A classificação de f.0/f.1/f.2b-g.3 é interpretação da evidência existente — um Aprovador humano pode legitimamente divergir.
- Cobre apenas f.0-g.3 e a caracterização econômica.
- O histórico desta primeira rodada tem exatamente uma entrada por capacidade (o registro inicial) — a mecânica de anexar novas entradas nunca foi exercitada em uma segunda rodada real ainda.

## Fora do escopo (confirmado, nada tocado)

Alteração de f.0 a g.3; correção de f.2a; geometria tabular; caracterização econômica; PDF; upload; API; UI; persistência; migrations; laboratório; Sprint 21.4B.3A; PR; merge; reescrita de histórico Git.

**Convenção de linguagem para relatórios desta governança**: nunca descrever esta e futuras Sprints de governança como "nenhum arquivo de produção alterado" — a frase é ambígua sobre o que conta como "produção". Usar sempre: "Nenhum algoritmo documental nem código de execução de f.0 a g.3 foi alterado. Foram adicionados apenas controles transversais de arquitetura, testes e documentação."

## Próximo passo

Autorização para a Sprint 21.4B.3 (proposta na Sprint 21.4B.2) permanece pendente — os portões de f.2a e da caracterização econômica só mudam de `bloqueado` após essa correção ser implementada, validada sintética e adversarialmente, e revalidada contra o documento real.
