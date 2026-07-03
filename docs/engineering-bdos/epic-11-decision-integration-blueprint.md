# EPIC 11 — Engineering Decision Integration: Blueprint Arquitetural

**Sprint:** 11.1 — Decision Integration Blueprint
**Status:** Documento de arquitetura. Nenhuma integração operacional foi implementada neste sprint.
**Escopo:** `packages/bdos-core/src/domain`, `packages/bdos-core/src/engines`, `packages/bdos-core/src/capabilities`.

---

## 1. Objetivo deste documento

Auditar o estado real (via inspeção de imports, não suposição) de todos os domínios existentes em `bdos-core`, mapear as fronteiras arquiteturais atuais, e propor — sem implementar — como a camada operacional do Engineering BDOS (EPIC 10) deve eventualmente se conectar aos domínios de decisão (Decision Engine, Business Facts, Executive Intelligence), preservando Pure Domain e determinismo absoluto em todas as camadas.

---

## 2. Mapa dos domínios existentes

A auditoria (busca de `import` cruzado entre pastas de `domain/` e `engines/`) revelou **três cadeias hoje totalmente isoladas entre si**, mais uma camada de decisão que não está ligada a nenhuma delas em runtime. Isso não é um problema a corrigir às pressas — é o ponto de partida correto para desenhar a integração com disciplina.

### 2.1 Camada Operacional de Engenharia (EPIC 10 — Pure Domain, 100% isolada)

| Domínio | Função | Importa de outro domínio? |
|---|---|---|
| `contract-management` | Ciclo de vida do contrato | Não |
| `project-management` | Ciclo de vida do projeto | Não |
| `work-package-management` | Pacotes de trabalho | Não |
| `service-item-management` | Itens de serviço medíveis | Não |
| `engineer-workspace` | Visão agregada do engenheiro de campo | Não |
| `evidence-center` | Evidências de campo (fotos, PDFs, laudos) | Não |
| `measurement-workspace` | Espaço de trabalho da medição (linhas, quantidades) | Não |
| `approval-workflow` | Fluxo de aprovação/revisão da medição | Não |
| `bulletin-generator` | Representação do boletim de medição | Não |
| `export-engine` | Solicitação/pacote de exportação (conceitual) | Não |

**Confirmado por auditoria:** nenhum desses 10 domínios importa de `business-fact`, `business-facts-generator`, `decision`, `decision-case`, `decision-portfolio`, `engines/decision/*`, ou de qualquer domínio da seção 2.2. Também não importam uns aos outros diretamente (cada um é resolvido via seu próprio `index.ts`; composição, quando necessária, acontece fora de `bdos-core`). Esta é a garantia estrutural de Pure Domain que o EPIC 11 **deve preservar**.

### 2.2 Camada Financeira / Sinal de Medição ("Financial Signal Layer" — pré-EPIC-10)

Cadeia paralela e mais antiga, que modela **um conceito diferente de "medição"** — não deve ser confundida com `measurement-workspace` (EPIC 10):

```
measurement
   └─ measurement-workflow
        ├─ measurement-entry ─ measurement-entry-processor
        ├─ revenue-recognition
        │     ├─ invoice ─ accounts-receivable
        │     └─ revenue-intelligence
        └─ cash-flow-signal ─ cash-forecast ─ executive-cash-intelligence
```

Esta camada é autocontida (só importa dentro de si mesma) e não é importada pela Camada Operacional nem pela Camada de Decisão.

⚠️ **Ponto de atenção já materializado:** `measurement-workflow` já define `MeasurementBulletin`/`MeasurementBulletinId`, nomes que o Sprint 10.9 (`bulletin-generator`) precisou reutilizar para o conceito operacional real de boletim. A colisão foi resolvida com alias no barrel (`MeasurementBulletin as BulletinGeneratorMeasurementBulletin`) sem tocar nesta camada. Isso é sintoma de que as duas cadeias evoluíram em paralelo sem um vocabulário compartilhado — ver Risco R1.

### 2.3 Digital Twin / Simulação

| Domínio | Função |
|---|---|
| `digital-twin/alpha-engenharia` (+ `financial-flow`) | Gera uma realidade operacional e financeira **sintética** (estudo de caso "Alpha Engenharia") com tipos próprios (`AlphaEngenhariaMeasurement`, `AlphaInvoice`, `AlphaCashFlowSignal` etc.), **não** derivados de `measurement-workspace` nem da Financial Signal Layer. |
| `business-reality-simulator` | Harness de simulação, sem imports externos. |

Serve hoje como **única fonte real de dados** para o Decision Engine, via o adapter descrito abaixo.

### 2.4 Business Facts

| Domínio | Função | Importa de |
|---|---|---|
| `business-fact` | Tipo canônico `BusinessFact` — a "moeda única" aceita pelo Decision Engine | Nada |
| `business-facts-generator` | Contrato `BusinessFactsAdapter<T>` + `adapters/alpha-engenharia/alpha-engenharia-facts-adapter.ts` | `business-fact`, `digital-twin/alpha-engenharia` |

O único adapter existente hoje transforma `AlphaMeasurementFinancialFlow` (sintético) em `BusinessFact[]`. **Nenhum adapter lê dados da Camada Operacional (2.1) ou da Financial Signal Layer (2.2) hoje.**

### 2.5 Decision Engine (`engines/decision/*`)

```
pipeline/observe → pipeline/diagnose → rule-engine → builder (produz domain/decision::Decision)
      → recommendation → playbook → action-plan
```

Mais `capabilities/cash-intelligence` (contexto + rule pack plugável no observe/rule-engine). **Consome exclusivamente `BusinessFact[]`** (via `domain/business-fact`) e tipos internos de `domain/decision`. Não importa nenhum domínio operacional, financeiro ou de digital twin diretamente.

### 2.6 Decision Case & Portfolio

| Domínio | Função | Importa de |
|---|---|---|
| `decision` | Tipo `Decision` | Nada |
| `decision-case` | Máquina de estados `DecisionCaseState` (Created → Observed → Diagnosed → DecisionBuilt → Recommended → PlaybookBuilt → ActionPlanReady → Monitoring → Completed/Archived) + `DecisionCaseArtifactRef { id, type }` | Nada (referencia artefatos do Decision Engine **por id + type**, nunca por import direto) |
| `decision-portfolio` | Agrega/prioriza `DecisionCase[]` | `decision-case` |

**Achado relevante:** `decision-case` já foi desenhado para **não** importar `engines/decision/*` diretamente — ele referencia decisões, recomendações, playbooks e planos de ação apenas por `{ id, type }`. Esse é exatamente o padrão de baixo acoplamento que o EPIC 11 deve generalizar para a integração com a Camada Operacional.

### 2.7 Executive Intelligence

| Domínio | Função | Importa de |
|---|---|---|
| `executive-insight` | Insight executivo a partir de casos de decisão | `decision-case`, `decision-portfolio` |
| `executive-brief` | Briefing executivo consolidado | `executive-insight`, `decision-portfolio`, `decision-case` |
| `executive-cash-intelligence` | Insight executivo de caixa | `cash-flow-signal`, `measurement` (Financial Signal Layer — cadeia **paralela**, não passa por Decision Case) |

### 2.8 Fundação / reservados

- `event` — vocabulário genérico de evento (`EventId`, `EventSource`, `EventCategory`, `Evidence`), hoje não importado por ninguém.
- `common` — pasta vazia, reservada.

### 2.9 O que NÃO existe ainda (confirmado)

- Nenhuma ligação de código entre `engines/decision` (saída: Decision/Recommendation/Playbook/ActionPlan) e `decision-case` — a composição, se existir, acontece fora de `bdos-core`.
- Nenhum consumidor de `@bba/bdos-core` em `apps/web` ou `apps/mobile` — o pacote inteiro ainda não está "plugado" em nenhuma aplicação.
- Nenhum adapter de Business Facts lendo a Camada Operacional (EPIC 10) ou a Financial Signal Layer.

---

## 3. Fronteiras arquiteturais propostas

### 3.1 Ordem de camadas (dependência só pode apontar para baixo nesta lista)

```
1. Fundação                (event, common)
2. Camada Operacional       (EPIC 10 — contract-management … export-engine)
3. Financial Signal Layer   (measurement*, revenue*, invoice, accounts-receivable, cash-*)
4. Digital Twin / Simulador (digital-twin, business-reality-simulator)
5. Business Facts           (business-fact, business-facts-generator + adapters)
6. Decision Engine          (engines/decision/*, capabilities/*)
7. Decision Case / Portfolio (decision, decision-case, decision-portfolio)
8. Executive Intelligence   (executive-insight, executive-brief, executive-cash-intelligence)
9. (EPIC 11.5) Template Engine — consome Export Engine (camada 2) + Executive Intelligence (camada 8)
```

As camadas 2, 3 e 4 são **irmãs**, não uma cadeia — nenhuma delas importa as outras duas. Isso é intencional e deve continuar assim.

### 3.2 O que pode importar o quê

| De → Para | Pode importar? | Como |
|---|---|---|
| Business Facts (5) → Camada Operacional (2) | **Sim, no futuro** | Somente via **adapter dedicado** (`BusinessFactsAdapter<T>`), recebendo um **snapshot imutável já finalizado** (ex.: `MeasurementWorkspace` com `status: Prepared`/`ApprovalWorkflow` com `status: Approved`), nunca uma referência viva ao domínio |
| Business Facts (5) → Financial Signal Layer (3) | Sim, mesmo padrão de adapter | Idem |
| Decision Case (7) → Decision Engine (6) | Sim, **somente por `{ id, type }`** | Nunca `import type { Decision } from "engines/decision/..."` dentro de `decision-case` |
| Executive Intelligence (8) → Decision Case/Portfolio (7) | Sim | Já implementado |
| Template Engine (9, EPIC 11.5) → Export Engine (2) | Sim | Consome `ExportPackage`/`ExportDocumentDescriptor` já preparados |
| Template Engine (9) → Executive Intelligence (8) | Sim | Para compor conteúdo textual do documento final |

### 3.3 O que NÃO pode importar o quê (linhas vermelhas)

- **Camada Operacional (2) → Business Facts / Decision Engine / Decision Case / Executive Intelligence:** proibido, sempre. Os domínios de engenharia (`measurement-workspace`, `approval-workflow`, `bulletin-generator`, `export-engine` etc.) nunca devem saber que decisões existem.
- **Camada Operacional (2) → Financial Signal Layer (3):** proibido. São dois vocabulários de "medição" distintos; não devem ser fundidos.
- **Decision Engine (6) → Camada Operacional (2) ou Financial Signal Layer (3), diretamente:** proibido. Só enxerga `BusinessFact`.
- **Business Facts (5) → Decision Engine (6):** proibido. Fatos são entrada, nunca consomem decisão (fluxo é estritamente unidirecional).
- **Qualquer domínio → Decision Case (7) importando tipos concretos de `engines/decision/*`:** proibido — usar `{ id, type }`.
- **Template Engine (9) → Camada Operacional (2) além de `export-engine`:** proibido. Ele não deve "alcançar" `measurement-workspace`/`approval-workflow`/`bulletin-generator` diretamente; tudo que ele precisa já deve estar consolidado em `ExportPackage`.
- **Qualquer domínio → `fs`, `path`, geradores reais de Excel/PDF, `UUID`, `Date.now()`, `Math.random()`:** proibido em `bdos-core` inteiro, exceto (a partir do EPIC 11.5) dentro do futuro Template Engine, que será a única fronteira autorizada a tocar filesystem/binário — e ainda assim isolado dos domínios de decisão.

---

## 4. Fluxo conceitual da decisão (estado-alvo, não implementado)

```
┌─────────────────────────── Camada Operacional (EPIC 10) ───────────────────────────┐
│  MeasurementWorkspace (Prepared)  ApprovalWorkflow (Approved)  Bulletin (Finalized) │
└──────────────────────────────────────┬───────────────────────────────────────────-─┘
                                        │  snapshot imutável (sem import direto)
                                        ▼
                        ┌───────────────────────────────┐
                        │  Business Facts Generator      │
                        │  novo adapter "engineering-     │
                        │  application" (EPIC 11.3)       │
                        └───────────────┬─────────────────┘
                                        │  BusinessFact[]
                                        ▼
                        ┌───────────────────────────────┐
                        │  Decision Engine                │
                        │  observe → diagnose → rules →   │
                        │  decision → recommendation →    │
                        │  playbook → action-plan          │
                        └───────────────┬─────────────────┘
                                        │  { id, type } refs
                                        ▼
                        ┌───────────────────────────────┐
                        │  Decision Case → Decision       │
                        │  Portfolio                       │
                        └───────────────┬─────────────────┘
                                        ▼
                        ┌───────────────────────────────┐
                        │  Executive Insight → Executive  │
                        │  Brief  (+ Executive Cash        │
                        │  Intelligence, cadeia paralela)  │
                        └───────────────┬─────────────────┘
                                        │  (EPIC 11.5)
                                        ▼
                        ┌───────────────────────────────┐   ┌──────────────────────┐
                        │  Official Template Engine       │◄──┤ Export Engine         │
                        │  (único ponto autorizado a       │   │ ExportPackage +       │
                        │  gerar Excel/PDF/CSV/JSON reais) │   │ ExportDocumentDescriptor│
                        └───────────────────────────────┘   └──────────────────────┘
```

**Ponto-chave:** as setas entre a Camada Operacional e o Business Facts Generator não são `import`s TypeScript — são chamadas de função feitas por uma camada de orquestração (fora de `bdos-core`, ou em um futuro pacote de "application services") que lê um snapshot já congelado (`Object.freeze`) de um domínio operacional e o passa como argumento simples para o adapter. Isso mantém a Camada Operacional 100% inconsciente da existência de decisões, exatamente como hoje.

---

## 5. Riscos de acoplamento identificados

| # | Risco | Evidência | Mitigação proposta |
|---|---|---|---|
| R1 | Vocabulário duplicado entre Financial Signal Layer e Camada Operacional (`MeasurementBulletin`, `MeasurementPeriod` etc. existem em ambas com formas diferentes) | Colisão já resolvida via alias no Sprint 10.9 | Convenção formal: todo tipo exposto por um novo adapter de fatos deve ser prefixado pelo domínio de origem no barrel raiz (já é o padrão usado desde o Sprint 10.6) |
| R2 | Dois "medidores de realidade" (Digital Twin sintético vs Financial Signal Layer real) não convergem — o Decision Engine hoje só "vê" dados sintéticos | Adapter único existente (`alpha-engenharia-facts-adapter`) consome só `digital-twin` | Documentar explicitamente (este blueprint) que dados sintéticos e reais são fontes concorrentes; qualquer novo adapter real deve ser adicional, não substituto, até decisão explícita de descontinuar o twin |
| R3 | Erosão do Pure Domain por atalho: um engenheiro apressado importa `business-fact` direto dentro de `measurement-workspace` "só para facilitar" | Ainda não ocorreu — mas não há guarda automatizada | Sprint 11.2: script leve de verificação de fronteiras (grep de imports proibidos) rodável em CI, formalizando a matriz da seção 3 |
| R4 | `decision-case` referenciar artefatos do Decision Engine por import direto no futuro, quebrando o desacoplamento já existente | Hoje `decision-case` já é limpo (só `{id,type}`) — risco é regressão futura | Manter o padrão `ArtifactRef` como regra obrigatória em qualquer sprint 11.x que toque `decision-case` |
| R5 | Template Engine (11.5) "alcançar" domínios operacionais diretamente em vez de usar `ExportPackage`/`ExportDocumentDescriptor` | Ainda não implementado — risco preventivo | `export-engine` já foi desenhado (Sprint 10.10) para ser a única superfície de contrato; blueprint fixa isso como regra de fronteira (seção 3.3) |
| R6 | Fluxo reverso indevido: Camada Operacional "reagir" a uma Decisão (ex.: auto-avançar `ApprovalWorkflow` porque o Decision Engine recomendou algo) | Não existe hoje | Declarado fora de escopo explicitamente; se necessário no futuro, deve ser um comando explícito de uma camada de aplicação externa a ambos os domínios, nunca um import cruzado |
| R7 | Determinismo quebrado ao converter snapshots operacionais em `BusinessFact` (tentação de usar `Date.now()`/id aleatório no adapter) | Preventivo | Todo adapter futuro deve reusar `occurredAt`/`actor`/`correlationId` já presentes no `trace`/`metadata` do domínio de origem, nunca gerar novos |
| R8 | `executive-cash-intelligence` e `executive-insight`/`executive-brief` são duas cadeias de "inteligência executiva" que não convergem hoje | Confirmado por auditoria (imports distintos) | Endereçar explicitamente em um sprint 11.x futuro (fora do escopo do 11.1) se e quando a convergência for necessária — não decidir agora |

Nenhum desses riscos exige ação de código neste sprint — são registrados para orientar os sprints 11.2 em diante.

---

## 6. Proposta de sequência de sprints do EPIC 11

| Sprint | Nome | Entregável | Toca filesystem/binário? |
|---|---|---|---|
| **11.1** | Decision Integration Blueprint | Este documento (concluído) | Não |
| 11.2 | Integration Boundary Enforcement | Script/checagem leve (sem dependência externa nova) que valida a matriz da seção 3 contra os imports reais de `bdos-core`, para rodar em CI/local; nenhuma integração real ainda | Não |
| 11.3 | Engineering Facts Adapter | Primeiro adapter real (`business-facts-generator/adapters/engineering-application/`) transformando snapshots finalizados de `measurement-workspace` + `approval-workflow` + `bulletin-generator` em `BusinessFact[]`, com testes determinísticos; sem orquestração/API | Não |
| 11.4 | Decision Case Bridging | Função pura que, a partir de artefatos já produzidos por `engines/decision`, cria/avança um `DecisionCase` referenciando-os por `{id,type}`; ainda sem API/orquestração viva | Não |
| **11.5** | Official Template Engine | Primeiro ponto de todo o BDOS Engineering autorizado a gerar Excel/PDF/CSV/JSON reais, consumindo `ExportPackage`/`ExportDocumentDescriptor` (Sprint 10.10) + conteúdo de Executive Brief; recomenda-se isolar em seu próprio domínio (ou até pacote) para manter `bdos-core` livre de I/O | **Sim — é o objetivo do sprint** |

Sprints 11.2–11.4 são uma proposta de sequenciamento (a numeração exata pode ser ajustada); o único marco fixo, confirmado pelo enunciado, é o 11.5.

---

## 7. Preparação para o EPIC 11.5 — Official Template Engine

O Sprint 10.10 (`export-engine`) já foi desenhado antecipando este ponto:

- `ExportDocumentDescriptor` contém apenas `fileNameSuggestion` (string sem `/`, `\` ou `:`) e `contentSummary` (texto) — nenhum campo de `path`, `buffer`, `binary` ou `base64` existe no tipo, então o Template Engine não herda nenhuma tentação estrutural de "curto-circuitar" a geração real através do Export Engine.
- A tabela de compatibilidade formato×tipo (`allowedFormatsByType`) já está centralizada em `export-engine.ts`, então o Template Engine só precisa iterar sobre `descriptors` já validados — não precisa reimplementar regra de negócio.
- Recomendação para 11.5: o Template Engine deve ser o **único** domínio/pacote em todo o BDOS Engineering autorizado a importar bibliotecas de geração de arquivo (ex.: geração de planilha/PDF) e a tocar `fs`. Se `bdos-core` deve permanecer livre de I/O por princípio (Pure Domain), considerar extrair o Template Engine para um pacote irmão (ex.: `packages/bdos-template-engine`) que declare `@bba/bdos-core` como dependência somente de tipos — não o contrário.

---

## 8. Não-escopo explícito deste sprint

Confirmando as regras obrigatórias do enunciado — nada disto foi feito:

- Nenhum código de integração operacional→decisão foi implementado.
- Nenhum domínio novo foi criado.
- Nenhum comportamento de domínio existente foi alterado.
- Nenhuma UI, API, banco, persistência, UUID, `Date.now()` ou `Random` foi introduzida.
- Nenhum Excel/PDF real foi gerado; nenhum arquivo foi escrito além deste próprio documento markdown.
