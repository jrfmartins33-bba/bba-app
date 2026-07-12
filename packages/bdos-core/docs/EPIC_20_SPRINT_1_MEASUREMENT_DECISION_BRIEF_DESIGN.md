# Epic 20, Sprint 20.1 — Análise do Boletim de Medição (Decision Brief) — Desenho Técnico

> Segue `EPIC_20_DECISION_EXPERIENCE_VISION.md` (visão de produto,
> aprovada e commitada). Este documento resolve as perguntas técnicas
> de posicionamento arquitetural, contratos e sequenciamento antes de
> qualquer componente ou rota — mesma disciplina do Epic 19. Nenhuma
> implementação acontece neste documento.

## I. Escopo desta Sprint

Entrega, de uma vez (não fatiada — correção já registrada em
`EPIC_20_DECISION_EXPERIENCE_VISION.md` §N), a primeira versão
completa da Análise do Boletim de Medição: Decision Brief
determinístico, narração via BBA Advisor, Índice de Confiabilidade
v1, hierarquia de informação completa, drill-down até a célula de
origem. Nenhuma persistência nova é necessária — todo o dado já existe
em `measurement_bulletin_imports.analysis_result`
(`MeasurementAnalysisResult`, Epic 19).

## II. Consulta de arquitetura — decisão de posicionamento

Consultei o `bdos-architect` antes de desenhar qualquer contrato,
porque este Epic se propõe explicitamente a criar um padrão
reutilizável entre Studios — exatamente o tipo de decisão que a regra
"Engine nunca conhece Studio" e a seção 7 de `PLATFORM_ARCHITECTURE.md`
já preveem, mas ainda não tinham um segundo caso real para aplicar.

**Achado central**: `apps/web/components/bba-project/bba-project-insights.ts`
(Health Score, Hero Narrative, Advisor Narrative, Reasoning Chain) é a
implementação certa em espírito, mas na camada errada — calcula regra
de negócio determinística (pontuação, prioridade, cadeia causal) fora
do Engine, com o comentário do próprio arquivo ("nenhum destes
cálculos chama o BDOS; são puramente de apresentação") mascarando que
não é apresentação, é lógica de domínio disfarçada de função de UI.
`PLATFORM_ARCHITECTURE.md` §7 já previa a correção: "no dia em que
[outro Studio] precisar do Health Score ou do Executive Hero,
extrai-se então... não antes." Medição é esse segundo Studio, agora.

**Correção de rota nº 2 (revisão de arquitetura)**: a primeira versão
deste documento nomeava o módulo genérico `decision-experience/` e não
questionava se ele deveria depender do Decision Engine já existente.
Duas correções, ambas confirmadas contra o código real antes de serem
adotadas:

- **Nome do módulo**: "Experience" é vocabulário de UX, não de
  domínio — o módulo produz conhecimento, a UI apenas consome. Corrigido
  para `decision-brief/`, alinhado ao nome técnico do próprio tipo
  (`DecisionBrief`) — "Decision Experience" permanece válido só como
  nome do **Epic/roadmap** (um programa de trabalho, correto ser
  UX-flavored nesse nível), nunca como nome de pasta dentro do Engine.
- **Não depender do Decision Engine existente.** Verificação direta em
  `packages/bdos-core/src/architecture/engineering-boundaries.test.ts`
  confirma que `measurement-workspace` (domínio operacional) está na
  lista `OPERATIONAL_DOMAINS`, e que `domain/decision`,
  `domain/decision-case`, `domain/decision-portfolio`,
  `domain/executive-insight`, `domain/executive-brief` e
  `engines/decision` estão todos em `FORBIDDEN_SEGMENTS_FOR_OPERATIONAL`
  — um guardrail automatizado que já roda no CI, não uma preferência de
  estilo. Além disso, `domain/decision-case`/`domain/executive-brief`
  já são tipos reais, em produção, para um conceito diferente
  (`DecisionCase`: máquina de estados de risco da Golden Journey;
  `ExecutiveBrief`/`ExecutiveInsight`/`DecisionPortfolio`: agregação de
  risco/oportunidade **entre projetos**, para o Dashboard Executivo).
  `DecisionBrief` (o veredito sobre **um único documento processado**)
  é um conceito genuinamente diferente — roteá-lo pelo Decision Engine
  exigiria fabricar `BusinessFact`s artificiais a partir de uma
  reconciliação financeira, o que `BDOS_VISION.md` já proíbe
  ("lacunas não são preenchidas silenciosamente" vale também ao
  contrário: não inventar estrutura que o dado real não sustenta).

**Decisões de posicionamento (adotadas, não abertas a debate técnico —
já fundamentadas por precedente real do código):**

1. **`packages/bdos-core/src/decision-brief/`** — contrato genérico,
   **irmão** do Decision Engine, não dependente dele; reutilizável por
   qualquer Studio: `DecisionBrief`, `ReliabilityIndexResult`. Puro
   TypeScript, zero I/O, mesmo padrão de `advisor-confidence-builder.ts`.
   Múltiplos Engines produzem instâncias deste mesmo contrato — Medição
   é o primeiro produtor real, Planejamento/Financeiro/Contratos os
   próximos, cada um com seu próprio builder, nenhum importando o
   Decision Engine para isso.
2. **`packages/bdos-core/src/services/measurement-bulletin-import/`**
   ganha `measurement-decision-brief-builder.ts` —
   `buildMeasurementDecisionBrief(analysisResult): DecisionBrief`,
   função pura, testável via `pnpm test` como todo o resto do pacote.
   Fica adjacente ao domínio dono do dado (mesmo módulo que já expõe
   `MeasurementAnalysisResult`), não num pacote genérico separado sem
   dono.
3. **`packages/bdos-core/src/advisor/measurement/`** — Candidate Set
   Pattern estendido para Medição (context builder → validator →
   confidence builder), replicando a disciplina de
   `advisor-response-validator.ts`/`advisor-confidence-builder.ts`,
   nunca um segundo mecanismo de validação inventado do zero.
   `advisor-response-validator.ts` atual é tipado especificamente a
   `Decision`/`Recommendation` do Decision Engine — não é
   genericamente reutilizável por import direto; a extensão é um novo
   Candidate Set irmão, não uma generalização forçada do existente.
4. **`packages/ui/src/studio-shared/`** — Hero, Índice de
   Confiabilidade (equivalente ao Health Score Card) e Reasoning Chain
   saem de `apps/web/components/bba-project/*` e viram componentes
   compartilhados (props in, JSX out, zero fetch/hook — mesma
   disciplina já documentada em `packages/ui/src/decision/README.md`).
   `DecisionInsightCard` (`packages/ui/src/decision/`) continua sendo
   reutilizado como está para o accordion de Full Traceability — ele
   já cobre exatamente essa peça e já está declarado para Medição.
5. **`apps/web/components/measurement/*`** — só consumo (props,
   chamadas a `services/*`), nunca lógica de cálculo própria. Mesma
   regra que já vale para `bba-project` desde sempre — só que agora
   aplicada corretamente desde o primeiro commit, em vez de corrigida
   depois.

**Guardrail — o que `decision-brief/` nunca deve importar** (validação
final do CPO, registrada explicitamente): `MeasurementAnalysisResult`,
qualquer tipo de boletim, `MeasurementWorkspace`, estruturas de Excel,
ou qualquer componente de UI. O módulo genérico não conhece nenhum
domínio específico — cada builder (`measurement-decision-brief-builder.ts`
hoje; `planning-decision-brief-builder.ts`,
`financial-decision-brief-builder.ts`, `contract-decision-brief-builder.ts`
no futuro) importa o contrato genérico e o resultado técnico do seu
próprio domínio, nunca o inverso.

**Guardrail — não existirá um `DecisionBriefEngine` central.** Não há,
e não deve nascer, um módulo que interprete resultados de múltiplos
Studios para produzir Briefs. Cada domínio produz sua própria instância
do mesmo contrato estrutural, preservando integralmente a propriedade
sobre sua interpretação:

```text
MeasurementAnalysisResult → MeasurementDecisionBriefBuilder
PlanningAnalysisResult    → PlanningDecisionBriefBuilder
FinancialAnalysisResult   → FinancialDecisionBriefBuilder
```

**Nomenclatura de produto (UI)**: "Relatório Executivo" é o título
exposto ao usuário (Camada 3) a partir desta revisão — decisão
deliberada de não otimizar nomes cedo demais, registrada com a
justificativa completa em `EPIC_20_DECISION_EXPERIENCE_VISION.md`,
seção E. `DecisionBrief` continua sendo o nome técnico interno,
nunca exposto.

## III. Contratos de tipos

### III.1 — `DecisionBrief` (genérico, `decision-brief/decision-brief.types.ts`)

**Revisão pós-auditoria dirigida (ver Parte X)** — três correções em
relação à versão anterior, cada uma decorrente de um achado confirmado
no código, não de preferência:

1. **Nomes de campo em inglês.** A versão anterior usava
   `situacao`/`conclusao`/`preocupacoes` como nomes de propriedade
   TypeScript — o que viola a própria regra permanente registrada na
   seção VI deste documento ("código em inglês, produto em
   português"). Corrigido para o shape em inglês, com a tradução para
   UI acontecendo só na seção VI (que já mapeia cada campo).
2. **`DecisionBriefTone` sem a palavra "approve".** Achado 4 da
   auditoria: o valor de enum `"approve"` corre o mesmo risco semântico
   que o domínio já evita explicitamente (`measurement_bulletins.finalized_at`,
   `Não implica certificação externa, aprovação contratual...`).
   Renomeado para valores que descrevem prontidão, nunca aprovação
   consumada.
3. **`metadata` com versionamento explícito.** Achado 3 da auditoria:
   ausente na versão anterior; adicionado seguindo o mesmo precedente
   já usado por `COPILOT_RULE_BASED_MODEL = "copilot-rule-based-v1"`
   (`copilot-deterministic-turn-builder.ts`) — um sentinela de versão
   da regra, não só do schema de dados de entrada.
4. **`evidenceReferences` usa um tipo novo, `DecisionBriefSourceReference`.**
   Achado 2 da auditoria: `EvidenceReference` (`domain/execution-management`)
   é estruturalmente amarrado a `fieldEvidenceId` (foto/documento do
   Studio de Evidências) — incompatível com uma célula de planilha.
   Discriminado por `sourceType`, para admitir célula de planilha hoje
   e outras fontes (evidência de campo, documento, objeto geoespacial,
   transação financeira) no futuro, sem o Decision Brief nunca copiar
   ou passar a possuir o documento de origem.
5. **Correção de nomenclatura genérica**: o contrato de exemplo da
   sua mensagem incluía `measurementSummary` — mas um campo com
   "measurement" no nome violaria a própria regra 3.1 que você definiu
   ("o contrato genérico não deve conhecer boletim/EAP/Medição").
   Renomeado para `keyMetrics` (lista genérica `label`/`value`,
   domínio-agnóstica) — a tradução para "Medições" fica na camada de
   apresentação (seção VI), como qualquer outro campo.

`preocupacoes[]`/`criticalItems[]` já carregava consequência de agir/
não agir por item (mantido, renomeado para
`consequenceIfAddressed`/`consequenceIfIgnored`, nome exato da sua
mensagem). `nextActions[]` mantido dentro do snapshot — legítimo
porque responde ao que fazer agora, não é um agregado temporal.
Deliberadamente **não adicionado**: `trend`/`decisionHistory`/
`decisionTimeline`/`DecisionAccountability`/`DecisionOutcome` — nascem
como agregados irmãos (Sprint própria), nunca como campo
estruturalmente vazio no snapshot.

**Segunda rodada de refinamento (validações finais do CPO)** — cinco
ajustes adicionais ao contrato abaixo:

- **`schemaVersion` separado de `builderVersion`, ambos string.**
  `schemaVersion` identifica a estrutura do contrato (muda em alteração
  incompatível do shape do `DecisionBrief`); `builderVersion` identifica
  a versão das regras determinísticas que produziram este Brief
  específico (muda quando uma regra de classificação/readiness/
  criticidade/consequência/ação recomendada muda, mesmo com o schema
  intacto). `COPILOT_RULE_BASED_MODEL` é reaproveitado como
  **padrão arquitetural** (o mesmo tipo de sentinela de versão), não
  como constante compartilhada — o builder de Medições tem sua própria
  identidade: `MEASUREMENT_DECISION_BRIEF_BUILDER_VERSION =
  "measurement-decision-brief-v1"`.
- **`metadata.sourceImportId`** referencia o snapshot técnico de
  origem — reaproveitando `measurementBulletinImportId`, já o
  identificador existente de `MeasurementAnalysisResultBase`, em vez de
  inventar um novo id. **Limitação honesta herdada do Epic 19, não
  resolvida por esta Sprint**: `measurement_bulletin_imports.analysis_result`
  é substituído (não acumulado) a cada retomada de processamento — dívida
  já registrada na própria migration `20260711050000` ("não acumula
  histórico de execuções nesta sprint"). `sourceImportId` é a melhor
  referência disponível hoje, mas não garante reprodutibilidade
  histórica completa se o import for retomado depois — mesma dívida do
  Epic 19, não uma lacuna nova introduzida aqui.
- **`DecisionBriefSourceReference` com `sourceId` + `locator`**, um
  único variant nesta Sprint (`spreadsheet_cell`) — as demais fontes
  especulativas (evidência de campo, documento) foram removidas: não
  modelar Studios futuros sem necessidade real comprovada.
- **`DecisionBriefReadiness` com valores mais curtos** (`ready`/
  `ready_with_reservations`/`not_ready`/`inconclusive`), sem nenhum
  mapeamento automático a partir de nomes de status existentes
  (`Finalized`, `completed`, etc.) — a readiness deriva sempre das
  regras sobre `MeasurementAnalysisResult.status` + severidade de
  `structuralIssues`, nunca do nome de um enum de outro domínio.
- **`nextActions[]` explicitamente não persiste nem cria nenhum
  aggregate** — `ActionPlan`/`Action`/`ExecutionTask`/`Recommendation`
  nunca nascem como efeito colateral de um Brief ser gerado ou exibido.
  Uma eventual materialização em execução exige ação explícita do
  usuário → Application Service próprio → aggregate proprietário →
  auditoria, nunca implícita dentro do builder ou da UI.

```ts
export type DecisionBriefReadiness =
  | "ready"
  | "ready_with_reservations"
  | "not_ready"
  | "inconclusive";

export interface DecisionBriefSection {
  readonly title: string;
  readonly body: string;
}

/** Seção que pode legitimamente não ter dado ainda -- nunca omitida, sempre declarada. */
export type DecisionBriefAvailableSection =
  | ({ readonly available: true } & DecisionBriefSection)
  | { readonly available: false; readonly reason: string };

/**
 * Referência de origem genérica -- um localizador, nunca uma nova
 * entidade de evidência. `sourceId` identifica o artefato/importação
 * imutável (ex.: measurementBulletinImportId); `locator` localiza
 * dentro dele. O Brief nunca copia nem passa a possuir o documento de
 * origem, nunca guarda o valor original como fonte da verdade -- a UI
 * resolve a navegação usando a referência. Só spreadsheet_cell existe
 * nesta Sprint -- não modelar variantes especulativas (evidência de
 * campo, documento, geoespacial, transação financeira) sem
 * necessidade real comprovada; o discriminante por `sourceType` deixa
 * o tipo extensível quando essa necessidade existir de fato.
 */
export type DecisionBriefSourceReference = {
  readonly sourceType: "spreadsheet_cell";
  readonly sourceId: string;
  readonly locator: { readonly sheetName: string; readonly row: number; readonly column?: string };
};

export interface DecisionBriefCriticalItem {
  readonly id: string;
  readonly severity: "blocking" | "warning";
  readonly title: string;
  readonly body: string;
  readonly consequenceIfAddressed: string | null;
  readonly consequenceIfIgnored: string | null;
  readonly evidenceReferences: ReadonlyArray<DecisionBriefSourceReference>;
}

export interface DecisionBriefKeyMetric {
  readonly label: string;
  readonly value: string;
}

export interface DecisionBriefKeyDecision {
  readonly label: string;
  readonly recommended: boolean;
  readonly rationale: string;
}

/**
 * Recomendação descritiva -- nunca representa ActionPlan/Action/
 * ExecutionTask/Recommendation, nem cria qualquer aggregate
 * persistido como efeito colateral de existir neste array.
 */
export interface DecisionBriefNextAction {
  readonly title: string;
  readonly rationale: string;
  readonly evidenceReferences: ReadonlyArray<DecisionBriefSourceReference>;
}

export interface DecisionBriefMetadata {
  readonly schemaVersion: string;
  /** Versão da regra/builder que produziu este Brief -- COPILOT_RULE_BASED_MODEL como padrão a seguir, não como constante compartilhada. */
  readonly builderVersion: string;
  /** measurementBulletinImportId (ou equivalente do domínio produtor) -- o snapshot técnico de origem. */
  readonly sourceImportId: string;
  readonly generatedAt: string;
}

export interface DecisionBrief {
  readonly metadata: DecisionBriefMetadata;
  readonly situation: DecisionBriefSection;
  readonly executiveConclusion: { readonly readiness: DecisionBriefReadiness; readonly headline: string; readonly body: string };
  readonly trend: DecisionBriefAvailableSection;
  readonly keyDecisions: ReadonlyArray<DecisionBriefKeyDecision>;
  readonly criticalItems: ReadonlyArray<DecisionBriefCriticalItem>;
  readonly keyMetrics: ReadonlyArray<DecisionBriefKeyMetric>;
  readonly details: DecisionBriefSection;
  readonly nextActions: ReadonlyArray<DecisionBriefNextAction>;
  readonly evidenceReferences: ReadonlyArray<DecisionBriefSourceReference>;
  readonly confidence: ReliabilityIndexResult;
}
```

### III.1.1 — Guardrail de readiness (obrigatório, sem mapeamento automático de status)

`DecisionBriefReadiness` deriva sempre das regras sobre
`MeasurementAnalysisResult.status` + severidade de `structuralIssues`
— nunca de um nome de status de outro domínio (`MeasurementBulletinStatus.Finalized`,
`MeasurementBulletinImportStatus.completed` etc., que são conceitos
distintos e mais tardios no ciclo de vida — `Finalized` só existe
depois que `generateMeasurementBulletin` for chamado, fora do escopo
do que alimenta o Brief). Mapeamento consistente com F. "Tipos de
conclusão possíveis" (`EPIC_20_DECISION_EXPERIENCE_VISION.md`):

| `MeasurementAnalysisResult.status` | Issues `blocking`? | `readiness` |
|---|---|---|
| `reconciled` | nenhuma | `ready` |
| `reconciled` ou `needs_review` | só `warning` | `ready_with_reservations` (caso real do BM_08) |
| `needs_review` | ao menos uma | `not_ready` |
| `failed` | — | `inconclusive` |

### III.2 — `ReliabilityIndexResult` (genérico, mesmo módulo)

Mesmo molde de `HealthScoreResult` (`bba-project-insights.ts`), com
uma diferença deliberada: cada fator declara se está `available` —
nunca preenche um fator indisponível com um valor neutro disfarçado
(correção já registrada em `EPIC_20_DECISION_EXPERIENCE_VISION.md`
§M).

```ts
export type ReliabilityLevel = "healthy" | "attention" | "risk" | "critical";

export interface ReliabilityFactor {
  readonly label: string;
  readonly penalty: number;
  readonly available: boolean;
  readonly unavailableReason: string | null;
}

export interface ReliabilityIndexResult {
  readonly score: number;
  readonly level: ReliabilityLevel;
  readonly label: string;
  readonly factors: ReadonlyArray<ReliabilityFactor>;
}
```

### III.3 — Fatores do Índice de Confiabilidade da Medição v1

Só os quatro fatores já listados como demonstráveis em
`EPIC_20_DECISION_EXPERIENCE_VISION.md` §M, com uma correção de
nuance encontrada ao especificar o cálculo:

| Fator | Cálculo | Disponível na v1? |
|---|---|---|
| Issues bloqueantes | `structuralIssues.filter(blocking).length` — penalidade maior por item | Sim |
| Issues de atenção | `structuralIssues.filter(warning).length` — penalidade menor por item | Sim |
| Diferença de reconciliação | `abs(totalDifference)` acima de `RECONCILIATION_EPSILON` (0.01) | Sim |
| Linhas com valor zero ignoradas | `lines.skippedZeroValue / lines.imported` | Sim |
| ~~Taxa de correspondência WorkPackage/ServiceItem (criado vs. localizado)~~ | — | **Removido da v1** — ver nota abaixo |

**Correção em relação à visão de produto**: a taxa
criado-vs-localizado de `WorkPackage`/`ManagedServiceItem` só é um
sinal de risco em **reimportações** de um projeto já catalogado — no
primeiro boletim de qualquer projeto, 100% "criado" é o resultado
correto e esperado (validado no próprio E2E real: 336
WorkPackages/300 ManagedServiceItems, todos `created`, boletim
perfeitamente reconciliado). Incluir esse fator na v1 penalizaria o
caso comum e correto. Fica registrado como fator a ativar quando
houver um segundo boletim real do mesmo projeto para calibrar o que é
"normal" — mesma disciplina de honestidade da seção M, aplicada aqui a
um fator que a própria visão listou sem essa ressalva.

## IV. Candidate Set Pattern estendido — `advisor/measurement/`

Espelha exatamente `advisor-context-builder.ts` →
`advisor-response-validator.ts` → `advisor-confidence-builder.ts`:

- `measurement-advisor-context-builder.ts` — monta o Candidate Set a
  partir do `MeasurementAnalysisResult` já persistido:
  `structuralIssues[]` (por `code`, já com id implícito de posição),
  `lines`, `workPackages`, `serviceItems`. Nenhuma consulta nova ao
  banco — o `analysis_result` já é a fonte completa.
- `measurement-advisor-response-validator.ts` — o Claude só pode citar
  `issueRef`s que já existem no Candidate Set; qualquer citação fora
  disso derruba a resposta, mesma regra de
  `advisor-response-validator.ts`.
- `measurement-advisor-confidence-builder.ts` — reaproveita
  diretamente `ReliabilityIndexResult` (III.2) como o cálculo de
  confiança — não um segundo cálculo de confiança paralelo.

**Uso do LLM nesta Sprint**: opcional, não bloqueante. O Decision
Brief funciona 100% sem nenhuma chamada ao Claude (III.1/III.3 já são
determinísticos) — a narração via BBA Advisor só fraseia o que já foi
decidido. Isso significa que a Sprint pode entregar valor completo
mesmo antes do módulo `advisor/measurement/` existir, e o módulo pode
chegar depois sem re-trabalho de contrato (`executiveConclusion.headline`/`body`
e `criticalItems[].body` já são strings prontas desde o dia 1;
narrar via LLM é substituir o gerador de string por outro, nunca mudar
o formato consumido pela UI).

## V. Rota e navegação — decisão fechada

`PLATFORM_ARCHITECTURE.md` §9.1 já documentava, explicitamente, uma
ambiguidade pendente entre "Medições" (placeholder, sem `href`) e
"Studio de Medições" (`/memorias`, real, hoje só Memórias de Cálculo),
pedindo esclarecimento "antes do próximo Epic que tocar nesta área".
Resolvido nesta revisão, com decisão de produto do CPO — não é mais
uma pergunta em aberto.

### V.1 — Decisão

- **Não existem dois Studios.** O Studio de Medições passa a
  concentrar todo o ciclo de medição: Boletins, Relatório Executivo,
  Memórias de Cálculo, Evidências, Detalhamento, Histórico e,
  futuramente, aprovação/envio/rastreabilidade da decisão. Memórias de
  Cálculo deixa de ser "o Studio" e passa a ser uma capacidade interna
  dele.
- **Rota oficial: `/medicoes`.** Substitui `/memorias` (nome herdado
  de quando a única capacidade era Memórias de Cálculo). Nenhuma rota
  paralela (`/measurement`, `/measurement-analysis`, `/boletim`,
  `/analysis`, `/decision-brief`) é criada.
- **`/medicoes`** — tela de entrada: lista dos boletins reais já
  importados e persistidos. Sem dado mockado: se só existir um
  boletim real (BM_08), a tela funciona honestamente com um único
  card.
- **`/medicoes/[measurementWorkspaceId]`** — abre diretamente no
  Relatório Executivo daquele boletim (a hierarquia já aprovada:
  conclusão executiva → decisão recomendada → riscos e pontos de
  atenção → consequências → indicadores → visualizações → evidências →
  detalhamento → dados brutos). As demais capacidades (Memórias de
  Cálculo, Evidências, Detalhamento, Histórico) vivem dentro do mesmo
  contexto do boletim, não em rotas irmãs desconectadas.
- **Navegação: uma única entrada, "Medições"**, apontando para
  `/medicoes`. Nenhuma coexistência visível de "Studio de Medições" /
  "Medições" / "Memórias" como se fossem produtos diferentes.

### V.2 — Inspeção controlada de `/memorias` (realizada, sem alterar nenhum arquivo)

Busca dirigida por `memorias` em `apps/web` (excluído `.next`, gerado).
Cinco arquivos reais, nenhum teste, nenhuma migration, nenhuma outra
rota:

| Arquivo | Uso | Ação necessária na implementação |
|---|---|---|
| `apps/web/components/workspace-nav-config.ts` (linhas 74-75) | Fonte única do sub-menu do Workspace "Engenharia" — contém **as duas entradas duplicadas**: "Studio de Medições" (`href: /memorias`) e "Medições" (sem `href`) | Substituir as duas por uma única entrada "Medições" → `/medicoes` |
| `apps/web/components/sidebar.tsx` (linhas 64-88, array `NAV_STUDIOS`) | Lista separada, hardcoded, usada só na visão "Studios (Admin BBA)" — mesma duplicação estrutural (array próprio, não deriva de `workspace-nav-config.ts`) | Atualizar `href` para `/medicoes`, revisar `description` ("Memórias de cálculo e quantitativos" → refletir o escopo ampliado) |
| `apps/web/app/(dashboard)/workspaces/engenharia/page.tsx` (linhas 88-103) | Grade de cards do Dashboard — **também duplicado**: card `measure-studio` (`href: /memorias`, status "Pronto") e card `medicoes` (sem `href`, status "Em desenvolvimento") | Mesclar os dois cards em um (`id: medicoes`, `href: /medicoes`, status "Pronto", descrição cobrindo Boletins + Relatório Executivo + Memórias) |
| `apps/web/lib/bdos/copilot-repository.ts` (linha 19, `STUDIO_IDS`) | `"memorias"` é um valor válido de `CopilotStudioId`, potencialmente persistido em `copilot_conversations.studio_id` (coluna **append-only** por desenho) | Rastreado: o único componente que efetivamente envia `studioId` ao Copilot é `DecisionCopilotChat`, usado hoje só em `bba-project-workspace-experience.tsx` — nenhum componente de Medição jamais chamou isso. **Nenhuma linha real com `studio_id = 'memorias'` deveria existir hoje.** Renomear para `"medicoes"` é seguro; recomendo uma consulta de confirmação rápida no Supabase antes do commit, como checagem barata, não porque haja evidência de risco. |
| `apps/web/app/(dashboard)/memorias/page.tsx` (256 linhas) | A própria página — client component com array `MEMORIES` hardcoded (achado já registrado em `MEASUREMENT_STUDIO_AUDIT.md`) | Conteúdo migra para viver **dentro** do contexto do boletim em `/medicoes/[id]`, como a capacidade "Memórias de Cálculo" — não é descartado, per decisão do CPO ("Memórias de Cálculo... apenas uma das capacidades internas") |

**Não encontrado**: nenhum teste (`*.test.ts`/`*.test.tsx`) referencia
`/memorias`; `STUDIO_COMPONENT_FOLDERS`
(`apps/web/architecture/studio-boundaries.test.ts`) ainda não inclui
`"measurement"`, então o guardrail não precisa de migração, só de
adição. `MEASUREMENT_STUDIO_AUDIT.md` referencia `/memorias`, mas é
um relatório datado (Sprint 19.0) — não deve ser reescrito, permanece
correto como retrato do seu próprio momento.

### V.3 — Estratégia de migração proposta

1. `apps/web/next.config.mjs` ganha `redirects()` (`/memorias` →
   `/medicoes`, `/memorias/:path*` → `/medicoes/:path*`) — mecanismo
   nativo do Next.js App Router; **sem precedente no repo ainda**
   (`next.config.mjs` hoje só tem `transpilePackages`), mas sem
   nenhum obstáculo técnico real encontrado.
2. Criar `/medicoes` e `/medicoes/[measurementWorkspaceId]`, com o
   conteúdo de Memórias de Cálculo movido para dentro do contexto do
   boletim (V.2).
3. Atualizar os três pontos de navegação (V.2) no mesmo commit —
   nenhum deles deriva de uma fonte única hoje (débito estrutural
   pré-existente, não causado por esta Sprint: três arrays
   independentes descrevendo os mesmos Studios).
4. Remover `apps/web/app/(dashboard)/memorias/page.tsx` **só depois**
   de confirmar o redirect funcionando — nunca as duas rotas ativas ao
   mesmo tempo na navegação.
5. Nenhuma restrição técnica real impede este caminho — não há
   necessidade de reportar bloqueio ao usuário.

### V.4 — Riscos concretos encontrados

- `copilot_conversations.studio_id` é append-only — risco teórico,
  não real (V.2), mas vale a checagem de uma query antes do commit.
- Três listas de navegação independentes (V.2) significam três edições
  manuais nesta migração — e o mesmo custo se repetirá para qualquer
  Studio futuro até que alguém unifique a fonte, o que está fora do
  escopo desta Sprint.
- `redirects()` nunca foi usado neste app — primeiro uso merece um
  smoke test manual pós-deploy, não só o `pnpm build` passando.

Isto atualiza `PLATFORM_ARCHITECTURE.md` §7/§9/§14 no mesmo commit que
a rota real for criada — não antes, por §15 regra 3/4 (documentar como
entregue só o que já existe e passou nos testes).

## VI. Nomenclatura de UI — obrigatória, português

Regra permanente: **código em inglês, produto em português.** Nomes
técnicos internos nunca mudam por causa da UI — a tradução acontece
só na camada de apresentação (mesmo modelo de três camadas de
`PRODUCT_VOCABULARY.md`, PRINCIPLE 007).

| Conceito técnico (Camada 1, nunca muda) | Termo de produto na UI (Camada 2/3) |
|---|---|
| `MeasurementWorkspace` | "Medições" ou o contexto do boletim aberto, conforme a tela |
| `MeasurementBulletin` | "Boletim de Medição" |
| `MeasurementAnalysisResult` | "Resultado da Análise" |
| `DecisionBrief` | **"Relatório Executivo"** |
| `executiveConclusion` | "Conclusão Executiva" |
| `keyDecisions[]` | "Principais Decisões" |
| `criticalItems[]` | "Itens Críticos" |
| `keyMetrics[]` (instância de Medição) | "Medições" |
| `details` | "Detalhamento" |
| `ReliabilityIndexResult`/`confidence` | "Confiança da Análise" |
| Futuro agregado de timeline/histórico (`DecisionTimeline`, ainda não implementado) | "Histórico da Decisão" |
| `evidenceReferences[]` (`DecisionBriefSourceReference`) | "Evidências" |
| `MeasurementWorkspaceLine[]` | "Itens da Medição" ou "Linhas da Medição", conforme o contexto |
| `criticalItems[]` com `severity` | "Pontos de Atenção" (`warning`) ou "Impedimentos" (`blocking`) |

**Nunca expor na UI**: "Measurement", "Decision Brief", "Reliability
Index", "Workspace", "Analysis Result", "Candidate Set", "Reasoning
Chain" — nem em português literal, nem em inglês. Esses termos podem
continuar existindo no código e na documentação técnica.

**Nota de Produto (registrar tal como redigida, para reaproveitar
depois)**:

> "Relatório Executivo" é a nomenclatura adotada nesta fase. Quando o
> produto estiver mais maduro e as experiências de Planejamento,
> Financeiro, Contratos, Riscos e Advisor Executivo estiverem
> consolidadas, será realizada uma revisão completa da taxonomia e da
> nomenclatura do BDOS. Essa revisão futura não deve bloquear a
> implementação atual.

## VII. Sequenciamento técnico dentro da Sprint 20.1

Ordem de implementação (uma Sprint só, não fatiada em Epics
separados — só a ordem interna de commits, para permitir revisão
incremental):

1. `decision-brief/` (contratos genéricos, III.1/III.2) + testes
   de tipo/shape.
2. `measurement-decision-brief-builder.ts` (III.3) + `.test.ts` contra
   os três estados reais (`reconciled`, `needs_review` — caso do
   BM_08 — e `failed`), reaproveitando fixtures já existentes de
   `measurement-bulletin-import-service.test.ts`. Antes desta etapa,
   documentar explicitamente a fórmula do Índice de Confiabilidade
   (fórmula, pesos, limites mínimo/máximo, níveis, justificativa de
   cada penalidade, comportamento quando um fator não está disponível)
   — se não houver base suficiente para um score percentual
   defensável, usar classificação qualitativa em vez de precisão
   artificial.
3. `packages/ui/src/studio-shared/` — extração de Hero/Índice de
   Confiabilidade/Reasoning Chain a partir de
   `apps/web/components/bba-project/*`, com `bba-project` migrado para
   consumi-los (não duplicado) — validação de que a generalização não
   quebra o Golden Journey existente.
4. Migração de rota (V.3): `redirects()` em `next.config.mjs`, criação
   de `/medicoes` e `/medicoes/[measurementWorkspaceId]`, atualização
   dos três pontos de navegação (V.2), migração do conteúdo de
   Memórias de Cálculo para dentro do contexto do boletim, remoção de
   `apps/web/app/(dashboard)/memorias/page.tsx` só após confirmar o
   redirect. `apps/web/components/measurement/*` consome
   `services/measurement-bulletin-import` (já exportado) e os
   componentes de `studio-shared` — nenhuma lógica de pontuação,
   conclusão, prioridade, risco ou recomendação nesta pasta.
   `STUDIO_COMPONENT_FOLDERS` ganha `"measurement"` neste commit.
5. `advisor/measurement/` (IV) — narração via BBA Advisor, aditiva,
   sem alterar o contrato de `DecisionBrief` já em produção desde o
   passo 4. **Requisito obrigatório**: falha, indisponibilidade ou
   ausência de crédito do provedor de LLM nunca impede o Relatório
   Executivo de funcionar — o caminho determinístico (passos 1-4) é
   sempre suficiente sozinho; a narração é estritamente aditiva.
6. Atualização de `PLATFORM_ARCHITECTURE.md` §7/§9/§14 no commit do
   passo 4 (rota real) — não antes, por §15 regra 3/4 (atualizar
   antes de codificar a mudança específica que cada seção descreve;
   nunca documentar como entregue o que ainda não passou nos testes).

Cada passo é revisável e testável isoladamente, mesma disciplina de
review por diff completo já usada nos Epics 18/19.

## VIII. Riscos e limitações — reafirmando a seção M da visão

Nenhuma limitação nova além das já registradas em
`EPIC_20_DECISION_EXPERIENCE_VISION.md` §M. As adições desta revisão:
a remoção do fator de correspondência WorkPackage/ServiceItem do
Índice de Confiabilidade v1 (III.3); os riscos concretos da migração
de rota (V.4); e a reafirmação de que `DecisionAccountability`/
`DecisionOutcome`/`DecisionTimeline`/`DecisionHistory`/`DecisionMemory`
permanecem 100% fora do escopo desta Sprint — visão futura registrada,
nunca implementada sem modelo e dados reais.

**Risco — acoplar a Sprint ao refactor completo do Golden Journey.**
A extração de Hero/Índice de Confiabilidade/Reasoning Chain (II, item
4; VII, passo 3) extrai **só o que tiver contrato verdadeiramente
compartilhado** entre `bba-project` e Medição. Corrigir o restante do
legado de `bba-project-insights.ts` (o que não for extraído) não é
pré-requisito desta Sprint — fica registrado como dívida conhecida,
não bloqueante.

**Risco — Decision Brief criar entidades de decisão por conta
própria.** O Brief é uma projeção de leitura, nunca deve criar
`Decision`, `Recommendation`, `ActionPlan`, `ExecutionTask` ou
qualquer forma de certificação da medição como efeito colateral de ser
gerado ou exibido. Um futuro handoff formal (ex.: transformar uma
ação aprovada em execução) deve acontecer por um Application Service
explícito e auditável, nunca implicitamente dentro do builder do
Brief ou da UI que o exibe.

## IX. O que este documento não decide

- Texto exato de UI (copy final de cada seção, além dos termos já
  fixados na seção VI) — trabalho de implementação, revisável por
  diff, não de arquitetura.
- Se/quando `advisor/measurement/` (IV) entra nesta mesma Sprint ou
  numa Sprint 20.1 seguinte curta — tecnicamente independente por
  desenho (seção IV, último parágrafo), decisão de sequenciamento de
  produto, não de arquitetura.
- Fórmula final e pesos exatos do Índice de Confiabilidade — a
  exigência de documentá-los antes de codificar está fixada (VII,
  passo 2); os valores em si são trabalho de especificação, não desta
  revisão.

## X. Auditoria dirigida do `HEAD` — os cinco pontos exigidos

Verificação direta no código (não inferência a partir de documentos),
`HEAD` no momento desta revisão. Nenhum arquivo de produção foi
alterado para produzir esta auditoria.

### 1. Cadeia completa de drill-down até a célula de origem

**Confirmado no código.** `source_sheet_name`/`source_row_number`/
`source_physical_column`/`source_financial_column` existem em
`measurement_workspace_lines` (migration `20260711050000`).
`listMeasurementWorkspaceLines` (`measurement-repository.ts:789`) já
expõe essas colunas mapeadas. `measurement-bulletin-import-service.ts`
(linhas 435-492) já grava `sourceLocation.sheetName`/`rowNumber`/
`physicalColumn`/`financialColumn` linha a linha a partir do parser.
Validado com dado real durante o E2E do Epic 19 (aba "BOLETIM DE
MEDIÇÃO 08", linha 347, colunas H/I). A cadeia de **dado** está
completa; o Builder que a transforma em `DecisionBrief` ainda não
existe — esperado, é exatamente o que esta Sprint constrói.

### 2. Contrato de referência de evidência já existente ou necessidade real de um novo

**Ausente — confirmado por inspeção direta, a suspeita estava
correta.** `EvidenceReference` existe
(`domain/execution-management/execution-management.types.ts:71`), mas
é estruturalmente amarrado a `fieldEvidenceId: ExecutionFieldEvidenceId`
— só representa uma `FieldEvidence` do Studio de Evidências (foto/
documento). `ParsedMeasurementLineSourceLocation`
(`sheetName`/`rowNumber`/`physicalColumn`/`financialColumn`) é um
formato próprio, incompatível. Nenhum contrato genérico discriminado
por tipo de fonte existe hoje. Resolvido nesta revisão com
`DecisionBriefSourceReference` (III.1) — discriminado por `sourceType`,
`spreadsheet_cell` como único variant usado nesta Sprint.

### 3. Versionamento do `DecisionBrief` ou do builder

**Ausente na versão anterior deste documento — corrigido nesta
revisão.** Não havia campo de versão no contrato. Existe precedente
real e reutilizável no código: `COPILOT_RULE_BASED_MODEL =
"copilot-rule-based-v1"` (`copilot-deterministic-turn-builder.ts:23`),
já com guarda própria em `product-vocabulary-boundaries.test.ts`.
Adicionado `DecisionBriefMetadata.builderVersion` (III.1) seguindo a
mesma disciplina — sem isso, uma retomada futura do builder poderia
fazer um boletim histórico apresentar uma conclusão diferente da que
foi gerada originalmente, sem nenhum registro de que a regra mudou.

### 4. Separação inequívoca entre recomendação de aprovação e certificação formal

**Confirmado no código para o domínio, mas conflitante no desenho
anterior deste documento — corrigido.** O comentário em
`measurement_bulletins.finalized_at` (migration `20260711000000`,
linhas 9/18/186-190) permanece intacto: "Não implica certificação
externa, aprovação contratual ou reconhecimento para faturamento."
Porém `DecisionBriefTone = "approve" | ...` (versão anterior deste
documento) usava a palavra "approve" como valor de enum — exatamente o
risco semântico que o domínio já evita em outro lugar. Corrigido para
`DecisionBriefReadiness` — descreve prontidão, nunca aprovação
consumada. Valores finais, após a segunda rodada de validação (III.1):
`ready` / `ready_with_reservations` / `not_ready` / `inconclusive`,
com o guardrail explícito de nunca mapear automaticamente a partir de
um nome de status de outro domínio (III.1.1).

### 5. Ausência de lógica determinística nova em `apps/web` ou `packages/ui`

**Confirmado no código.** `apps/web/components/measurement/` não
existe (verificado nesta auditoria). Nada foi criado além de
documentação nesta sessão — `git status` confirma só arquivos `.md`
alterados. `bba-project-insights.ts` permanece no lugar errado
(achado já registrado na Parte II), não replicado nem corrigido
incidentalmente — fora do escopo desta Sprint, ver Risco em VIII.

### Veredito

Os cinco pontos foram auditados; três exigiam correção no desenho
(2, 3, 4) e foram corrigidos nesta revisão (III.1, X). Dois já
estavam corretos (1, 5). Nenhuma das correções altera o posicionamento
arquitetural aprovado nas Partes II-IX — são ajustes de contrato, não
de arquitetura. Pronto para a próxima revisão do CPO.
