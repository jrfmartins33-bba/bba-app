# BBA Platform — Arquitetura de Produto (Single Source of Truth)

> **EPIC — Platform Architecture 1.0** · Documento estrutural, não implementa
> funcionalidades. Nenhum Engine, Capability, regra de negócio ou cálculo foi
> alterado para produzir este documento. Onde o estado atual do produto diverge
> do estado alvo aqui descrito, isso é dito explicitamente — este documento
> não finge que a plataforma já está onde queremos que ela esteja.
>
> Versão 1.0 · 2026-07 · Mantido por: Chief Product Officer / Chief Software
> Architect da BBA Platform.

---

## 1. Filosofia

A plataforma é composta por três camadas com responsabilidades que nunca se
misturam:

| Camada | O que é | Regra |
|---|---|---|
| **Engine** | Tecnologia. Domínio puro, regras de negócio, cálculo. | Nunca conhece um Studio. Nunca importa UI. Nunca sabe que existe uma tela. |
| **Studio** | Produto. Uma superfície especializada que consome um ou mais Engines e apresenta decisões ao usuário. | Consome Engine via Application Service. Nunca importa o domínio interno de outro Studio. |
| **BBA Advisor** | Camada transversal. Não é um Studio. | Nunca possui dados próprios, nunca grava informação, nunca cria regra de negócio. Somente interpreta o que os Engines já calcularam e narra, dentro de cada Studio. |

Regra-mãe: **Engine é tecnologia. Studio é produto. Engine nunca conhece
Studio. Studio consome Engine. Advisor consome todos.**

```
BBA Platform
├── Project Studio
├── Finance Studio
├── Field Studio
├── Geo Studio
├── Evidence Studio
├── Measure Studio
├── Document Studio
├── Approval Studio
├── Export Studio
└── BBA Advisor (transversal — vive dentro de cada Studio, não é um destino)
```

---

## 2. Nomenclatura oficial

**"BBA" é a marca da Plataforma e do Advisor. Nenhum Studio individual carrega
o prefixo "BBA".**

- ✅ `BBA Platform`, `BBA Advisor`
- ✅ `Project Studio`, `Finance Studio`, `Geo Studio`, ...
- ❌ ~~`BBA Project Studio`~~, ~~`BBA Finance Studio`~~

Motivo: evitar precisar renomear menus, telas e strings toda vez que um novo
Studio nascer ou que a marca evoluir — o prefixo fica em exatamente dois
lugares (o nome da plataforma e o nome do Advisor), não replicado em nove
Studios.

Esta sprint já aplica a convenção: label da sidebar, `<h1>` da página e texto
de apresentação, em todos os Studios com tela real (Project, Geo, Evidence,
Measure Studio). O slug de rota do Project Studio continua `bba-project` (não
`project-studio`) por estabilidade de URL — já estava em produção antes deste
EPIC. Geo/Evidence/Measure Studio, por não terem esse mesmo histórico de URL
pública, tiveram sua rota promovida para o nível superior preservando o
mesmo nome de slug que já usavam (`/geoespacial`, `/evidencias`, `/memorias`)
— ver seção 9.2.

---

## 3. Mapeamento Engine → Studio (estado real, não aspiracional)

"Engine" aqui é um **contrato lógico** (funções puras, sem UI, sem
conhecimento de Studio) — não exige uma pasta literal `engines/*`. Hoje só o
Decision Engine foi extraído para `packages/bdos-core/src/engines/decision`;
os demais Engines existem como `domain/*` ou `capabilities/*` e podem ou não
ser fisicamente reorganizados no futuro. Isso é um detalhe de implementação,
não uma condição para o contrato valer.

| Studio | Engine (conceito) | Onde vive hoje no código | Status |
|---|---|---|---|
| **Project Studio** | Planning Engine | `domain/schedule-management`, `domain/project-management` | Em produção (`/bba-project`) |
| **Geo Studio** | Geospatial Engine | `capabilities/geospatial-intelligence`, `domain/spatial-object` | Em produção (`/geoespacial`, nível de topo desde a reconciliação de navegação) |
| **Evidence Studio** | Evidence Engine | `domain/field-evidence`, `domain/evidence-center` | Em produção parcial (`/evidencias`, nível de topo) — dados de demonstração, ainda não integrado a um Engine real |
| **Measure Studio** | Measurement Engine | `domain/measurement*` (6 variantes) | Em produção parcial (`/memorias`, nível de topo) — dados de demonstração; "Medições"/boletins ainda em desenvolvimento |
| **Document Studio** | Document Engine | `domain/document-reconstruction`, `domain/official-template-engine` | Planejado (card "em breve") |
| **Approval Studio** | Approval Engine | `domain/approval-workflow` | Planejado (card "em breve") |
| **Export Studio** | Export Engine | `domain/export-engine` | Planejado (card "em breve") |
| **Finance Studio** | Finance Engine | `capabilities/cash-intelligence`, `domain/revenue-intelligence`, `domain/cash-forecast` | Planejado (card "em breve") |
| **Field Studio** | Execution Engine | *(ainda não existe pasta própria — nenhum domínio de execução física foi iniciado)* | Planejado — nenhum código ainda |
| *(não é um Studio)* | Decision Engine | `engines/decision` | Em produção — motor central que alimenta o Advisor em todos os Studios |

Domínios adicionais existentes (`digital-twin`, `business-reality-simulator`,
`executive-*`) ainda não foram classificados dentro de um Studio específico —
podem terminar como capacidades transversais do Advisor ou como parte de um
Studio futuro. Classificar isso fica para quando esse domínio ganhar uma
interface de usuário real, não antes.

---

## 4. Contratos Engine ↔ Studio

- Um Studio nunca importa arquivos internos de um `domain/*` diretamente — o
  acesso é sempre via `services/*` (Application Service) ou o `index.ts`
  público do pacote `bdos-core`.
- `apps/web` nunca importa `domain/` diretamente sem passar por `services/`.
  (Regra já em vigor e verificada por `packages/bdos-core/src/architecture/engineering-boundaries.test.ts`.)
- Um Engine nunca importa nada de `apps/web` nem de outro Studio.
- O Decision Engine nunca importa um domínio operacional diretamente (Rule B,
  já garantida pelo guard existente).

Estas regras já existem e são verificadas automaticamente; este documento só
as nomeia explicitamente no vocabulário de Studio/Engine para consistência.

---

## 5. Contratos entre Studios — quem é dono de qual dado

Esta é a peça que faltava no desenho original: Engine↔Studio já era claro,
mas **Studio↔Studio** (quando dois Studios precisam do mesmo dado) não estava
explícito. Regra: toda entidade compartilhada tem exatamente um Studio dono
(system of record); qualquer outro Studio que a exiba trata-a como somente
leitura.

| Entidade | Studio dono | Studios consumidores (somente leitura) | Observação |
|---|---|---|---|
| `SpatialObject` / geometria | **Geo Studio** | Project Studio, Evidence Studio, Measure Studio | Escrita de geometria/localização é exclusiva do Geo Studio. |
| `PlanningDataset` / `ScheduleActivity` | **Project Studio** | Finance Studio (curva S financeira), Field Studio (apontamento de execução) | Nenhum outro Studio recalcula CPM ou altera datas de linha de base. |
| `Decision` / `Recommendation` | **Decision Engine** (não é um Studio) | Todos os Studios, via Advisor | Nenhum Studio grava uma Decision diretamente — só o Decision Engine produz. |
| Evidência (foto/vídeo/documento) | **Evidence Studio** | Measure Studio (substanciar medição), Document Studio | |
| Medição / Boletim | **Measure Studio** | Finance Studio (faturamento) | |
| Aprovação | **Approval Studio** | Todos os Studios podem solicitar; o registro da decisão de aprovação pertence ao Approval Studio | |
| Fluxo de caixa / DRE | **Finance Studio** | Advisor (para narrativa cross-Studio na Home) | |

Quando um novo Studio precisar de um dado que já tem dono, a regra é sempre
"consumir somente leitura via contrato do Studio dono" — nunca duplicar o
dado, nunca escrever por fora.

---

## 6. Identidade de cada Studio

| Studio | Ícone (lucide) | Cor predominante | Headline | Responsabilidade |
|---|---|---|---|---|
| **Project Studio** | `GanttChartSquare` | `--bba-gold` | "O primeiro planejador de projetos orientado por decisões" | Planejamento, cronograma, EAP, linha de base, CPM, Curva S, forecast, Living Schedule, replanejamento, importação |
| **Finance Studio** | `Wallet` / `TrendingUp` | verde (`--status-green`) | "Sua obra, sua margem, em tempo real" | Fluxo de caixa, custos, receitas, orçamento, forecast financeiro, DRE, margens, rentabilidade |
| **Field Studio** | `HardHat` | âmbar (`--status-amber`) | "O que aconteceu na obra, hoje" | Diário, produção, equipes, equipamentos, clima, ocorrências, checklists |
| **Geo Studio** | `Map` | azul/dourado (reaproveitar tokens atuais) | "Onde sua obra realmente está" | Mapa, GIS, camadas, drone, RTK, inteligência espacial |
| **Evidence Studio** | `Camera` / `FileImage` | neutro | "Prova, não achismo" | Fotos, vídeos, OCR, uploads, classificação, evidências |
| **Measure Studio** | `Ruler` | `--bba-gold` | "Quanto foi de fato executado" | Medições, quantitativos, boletins, apropriações, memórias de cálculo |
| **Document Studio** | `FileText` | neutro | "Todo documento, um só lugar" | Contratos, projetos, memoriais, licitações, OCR, reconstrução documental |
| **Approval Studio** | `CheckSquare` | verde (`--status-green`) | "Nada trava sem rastro" | Fluxos de aprovação, pendências, histórico |
| **Export Studio** | `Download` | neutro | "Seu dado, no formato que você precisa" | PDF, Excel, APIs, relatórios, integrações |
| **BBA Advisor** *(transversal, não é destino)* | `Sparkles` | dourado (`--bba-gold-soft`) | "Analisei seu [contexto]." | Interpreta os Engines dentro de cada Studio — nunca uma tela própria |

Cores: manter a paleta de 3 status já estabelecida (`--status-green`,
`--status-amber`, `--status-red`) — **não reintroduzir uma 4ª cor de status**
(o `--status-orange` já foi tentado e revertido por deixar a tela poluída).
"Cor predominante" de identidade visual de Studio é uma camada diferente
(tema/acento), não deve ser confundida com as cores de status semânticas.

---

## 7. Componentes compartilhados

Catálogo real (o que já existe, construído durante o Project Studio Sprint 2)
mais o que é esperado generalizar quando um **segundo** Studio precisar do
mesmo padrão — seguindo a regra de generalização tardia (rule of three): não
extrair para `packages/ui` antes de haver uma segunda necessidade real.

| Componente | Existe hoje | Onde | Estado |
|---|---|---|---|
| Executive Hero (narrativa derivada + CTA) | Sim | `apps/web/components/bba-project/bba-project-hero.tsx` | Acoplado ao Project Studio |
| Health Score (0–100, fórmula documentada) | Sim | `apps/web/components/bba-project/bba-project-insights.ts` | Acoplado ao Project Studio |
| Executive Cards | Sim | `apps/web/components/bba-project/bba-project-executive-cards.tsx` | Acoplado ao Project Studio |
| Advisor Narrative (Situação/Motivo/Impacto/Recomendação) | Sim | `apps/web/components/bba-project/bba-project-advisor-narrative.tsx` | Acoplado ao Project Studio |
| Explainability Drawer ("Por que estou vendo este alerta?") | Sim | mesmo arquivo acima | Acoplado ao Project Studio |
| Reasoning Chain | Sim | `apps/web/components/bba-project/bba-project-reasoning-chain.tsx` | Acoplado ao Project Studio |
| Risk List (lista inteligente de atividades em risco) | Sim | `apps/web/components/bba-project/bba-project-risk-list.tsx` | Acoplado ao Project Studio |
| Confidence Indicator | Parcial (embutido no Modelo Espacial) | `bba-project-spatial-model.tsx` | Acoplado ao Project Studio |
| Decision Timeline | Não existe ainda | — | Planejado |
| Recommendation Card | Existe como parte do Explainability Drawer | — | Não generalizado |

**Quando extrair para `packages/ui`:** no dia em que Finance Studio, Geo
Studio (na sua encarnação definitiva) ou qualquer outro Studio precisar do
Health Score ou do Executive Hero, extrai-se então para
`packages/ui/src/studio-shared/` (nome de pasta a definir naquele momento) —
não antes. Extrair hoje, com um único consumidor, seria abstração prematura.

---

## 8. Componentes exclusivos por Studio

| Studio | Componentes exclusivos |
|---|---|
| Project Studio | Gantt/WBS Table, Curva S, CPM, Living Schedule |
| Finance Studio | Cash Flow, Forecast Financeiro, DRE, Burn Rate |
| Geo Studio | GIS, Layers, Spatial Timeline |
| Field Studio | Diário de Obra, Checklist de Campo |
| Evidence Studio | Galeria/Timeline de Evidências, OCR Viewer |
| Measure Studio | Boletim de Medição, Memória de Cálculo |
| Document Studio | Reconstrução Documental, Template Engine |
| Approval Studio | Fluxo de Aprovação, Histórico de Pendências |
| Export Studio | Central de Exportação/Integrações |

---

## 9. Navegação — reconciliação aplicada

> Atualização: a divergência identificada na primeira versão deste documento
> (Project Studio de nível superior × Geoespacial/Evidências/Memórias
> aninhados dentro do workspace "Engenharia") foi corrigida logo em seguida,
> ainda dentro do EPIC Platform Architecture 1.0, por decisão explícita do
> CPO/Chief Architect. Esta seção descreve o estado **atual e já
> implementado** — não é mais um plano futuro.

### 9.1 Estado anterior (histórico — como era antes desta correção)

```
Sidebar
├── Hoje
├── Project Studio               (/bba-project)      — nível superior
├── Workspaces
│    └── Engenharia             (/workspaces/engenharia)
│         ├── Planejamento
│         ├── Execução           (em breve)
│         ├── Geoespacial        (/workspaces/engenharia/geoespacial)  ← aninhado
│         ├── Evidências         (/workspaces/engenharia/evidencias)   ← aninhado
│         ├── Memórias de Cálculo (/workspaces/engenharia/memorias)    ← aninhado
│         ├── ...
│         └── BBA Advisor        (card "em breve", tratado como destino)
```

Duas formas de organizar a mesma ideia de "Studio" coexistiam sem
reconciliação: uma como app de nível superior, outra como aba de um
workspace fixo. Isso não era um bug de código — era ausência de arquitetura
de plataforma declarada, exatamente o que este EPIC resolve.

### 9.2 Estado atual (aplicado nesta sprint)

```
Sidebar
├── Hoje                         (/hoje)
├── Studios
│    ├── Project Studio          (/bba-project)
│    ├── Geo Studio              (/geoespacial)
│    ├── Evidence Studio         (/evidencias)
│    ├── Measure Studio          (/memorias)
│    ├── Finance Studio          (em breve, sem página ainda)
│    ├── Field Studio            (em breve, sem página ainda)
│    ├── Document Studio         (em breve, sem página ainda)
│    ├── Approval Studio         (em breve, sem página ainda)
│    └── Export Studio           (em breve, sem página ainda)
├── Workspaces                   (/workspaces)
│    └── Engenharia              (/workspaces/engenharia) — contexto do projeto ativo
│         ├── Planejamento       (conteúdo de demonstração — ver nota abaixo)
│         ├── Execução           (em breve)
│         ├── Medições           (em breve)
│         ├── Documentos         (em breve)
│         ├── Aprovações         (em breve)
│         ├── Exportações        (em breve)
│         ├── Financeiro         (em breve)
│         └── Dashboard Executivo (em breve)
├── Empresa / Caixa / Impostos / Equipe
└── Operacional (Motor): Cadastro, Fiscal, Financeiro, Contratos, Trabalhista
```

Os quatro Studios com página real (Project, Geo, Evidence, Measure) agora
vivem todos no mesmo nível hierárquico, com rota própria fora de
`/workspaces/*` — exatamente o padrão que faltava reconciliar. Os cinco
Studios ainda não construídos aparecem como linhas inertes "em breve" (mesmo
padrão visual já usado para itens de Workspace sem `href`), para que a
Sidebar já anuncie a forma final da Plataforma sem prometer uma tela que não
existe.

"BBA Advisor" deixou de ser um card de destino: foi removido da grade de
capacidades da Engenharia e de `workspace-nav-config.ts`. O Advisor continua
existindo, mas somente como bloco narrativo contextual **dentro** de cada
tela (Evidências e Memórias de Cálculo já tinham esse padrão embutido; Project
Studio o tem desde o Sprint 2) — nunca como uma rota própria.

O workspace "Engenharia" deixa de ser o dono exclusivo de Geo/Evidence/Measure
Studio e passa a ser o que a seção 9 original já previa: **o contexto do
projeto ativo** (Barragem Lagoa do Arroz, 2F Engenharia). Seus cards de
"Geo Studio"/"Evidence Studio"/"Measure Studio" permanecem na grade — agora
apontando para as rotas de nível superior — para que abrir um Studio a
partir do contexto de um projeto continue sendo possível e descobrível.

**Nota sobre "Planejamento":** esta tela (`/workspaces/engenharia/planejamento`)
não foi movida nem renomeada para Project Studio. Ao investigar o código para
executar a correção, confirmou-se que são coisas genuinamente diferentes —
"Planejamento" é uma tela de demonstração com dados estáticos ilustrativos,
personalizada para a apresentação comercial à 2F Engenharia (nenhum Engine a
alimenta — o próprio código já documentava isso: *"Nenhum Engine alimenta esta
análise ainda"*), enquanto o Project Studio real (`/bba-project`) é o produto
de fato, orientado a Engine, com importação real de XML/Excel. Fundir os dois
teria sido um erro de arquitetura, não uma correção — por isso "Planejamento"
permanece exatamente onde estava, sem alteração.

**Nota sobre maturidade real dos Studios promovidos:** ao mover os arquivos,
confirmou-se que Geo Studio de fato chama um serviço real do `bdos-core`
(`buildGeospatialProductSnapshot`, com parâmetros fixos de demonstração) — é
Engine-backed de verdade. Evidence Studio e Measure Studio, por outro lado,
usam apenas arrays estáticos de exemplo, sem nenhuma chamada a `bdos-core`
ainda. A tabela da seção 3 já reflete essa diferença real de maturidade —
promover a rota não promoveu a integração com o Engine, e isso é dito aqui
explicitamente para não sugerir uma maturidade que ainda não existe.

### 9.3 O que ainda não foi feito (candidato a EPIC futuro)

"Workspace" ainda não é um seletor real de múltiplos projetos — hoje só existe
o único projeto de demonstração (Barragem Lagoa do Arroz). Construir a troca
de contexto entre projetos de fato (múltiplos projetos, dados por projeto) é
uma funcionalidade nova, não uma correção estrutural, e continua fora do
escopo deste EPIC. Fica registrado como candidato a um próximo EPIC de
produto (não apenas de navegação).

---

## 10. Home ("Hoje") como resumo transversal do Advisor

A Home da Plataforma não deveria ser um seletor de Studios (grade de cards).
O maior diferencial estratégico da plataforma — "isso pensa, não é só um MS
Project" — vale exatamente o mesmo na Home: em vez de "escolha um Studio", a
Home deveria abrir com um resumo do Advisor cruzando **todos** os Studios
ativos ("o que precisa da sua atenção hoje, em qualquer Studio"), aplicando a
mesma filosofia "Decision First" já validada no Project Studio Sprint 2.

Isso é conceito documentado para orientar o próximo EPIC de navegação — **não
implementado nesta sprint** (não é tela nova, não é Engine novo).

---

## 11. Menu definitivo (estado alvo)

```
Hoje
Advisor            (atalho para o resumo cross-Studio, não uma tela de dados)
Studios
  Project Studio
  Finance Studio
  Field Studio
  Geo Studio
  Evidence Studio
  Measure Studio
  Document Studio
  Approval Studio
  Export Studio
Empresa
Administração
```

Estado atual (pós-reconciliação da seção 9.2): "Studios" já existe como grupo
de nível superior na Sidebar, com Project/Geo/Evidence/Measure Studio
navegáveis e os cinco restantes inertes ("em breve"). "Advisor" como atalho
de resumo cross-Studio ainda não existe (depende da Home descrita na seção
10, que é conceito, não implementação). "Workspaces" continua na Sidebar,
por enquanto — só será removido quando o conceito de "contexto de projeto
ativo" (seção 9.3) for realmente construído; até lá, é a única forma de
abrir o contexto do projeto de demonstração (Engenharia).

---

## 12. Design System — padrões oficiais da plataforma

Os seguintes tokens/padrões já existem em `apps/web/app/bba-globals.css` e
passam a ser formalmente os padrões da Plataforma (nenhum token novo criado
nesta sprint):

- **Status (3 cores, não 4):** `--status-green`, `--status-amber`,
  `--status-red`. Decisão deliberada de manter 3 cores — não reintroduzir
  `--status-orange`.
- **Identidade/marca:** `--bba-gold`, `--bba-gold-soft`, `--bba-gold-dim`.
- **Texto:** `--text-*` (primário/secundário/terciário conforme já em uso).
- **Bordas/divisores:** `--app-border`, `--app-divider`.
- **Motion:** `--motion-duration-*`, `--motion-ease-*`, keyframes
  `motion-fade-in` e `motion-slide-left` já reutilizados entre telas.
- **Padrões de componente:** Cards (`workspace-card`), badges de status,
  drawers laterais (`role="dialog"` + overlay), empty states, loading
  (skeleton/placeholder), tooltips, timeline horizontal (Reasoning Chain).

Qualquer novo Studio deve reutilizar estes tokens antes de propor um novo.

---

## 13. Enforcement estrutural

Documentação sozinha não se sustenta — por isso esta sprint adiciona um guard
estrutural (sem lógica de negócio) em `apps/web/architecture/studio-boundaries.test.ts`,
no mesmo estilo do guard já existente em
`packages/bdos-core/src/architecture/engineering-boundaries.test.ts`
(varredura textual de imports, sem framework de teste, sem TypeScript
Compiler API): garante que o diretório de componentes de um Studio nunca
importa diretamente o diretório de componentes de outro Studio.

Hoje só existem dois diretórios de Studio em `apps/web/components/`
(`bba-project/` e `geospatial/`), então o guard começa quase vazio — seu valor
é crescer junto com a plataforma, pegando a primeira violação no dia em que
um terceiro Studio nascer.

---

## 14. Maturidade dos Studios (snapshot desta versão)

| Studio | Status |
|---|---|
| Project Studio | Em produção |
| Geo Studio (hoje "Geoespacial") | Em produção |
| Evidence Studio | Em produção |
| Measure Studio | Em produção parcial (Memórias de Cálculo) |
| Finance Studio | Planejado |
| Field Studio | Planejado |
| Document Studio | Planejado |
| Approval Studio | Planejado |
| Export Studio | Planejado |

Esta tabela é um retrato de 2026-07 — vai ficar desatualizada por design.
Sempre que um Studio mudar de status, atualizar esta seção antes de codificar
a mudança (ver Governança, seção 15).

---

## 15. Governança do documento

Este documento é a fonte única da arquitetura de produto da BBA Platform.
Regras de manutenção:

1. Antes de propor um novo Studio, adicionar sua identidade (seção 6) e seu
   mapeamento de Engine (seção 3) aqui primeiro.
2. Antes de mover uma entidade de dado entre Studios, atualizar a tabela de
   contratos (seção 5).
3. Ao promover um Studio de "Planejado" para "Em produção", atualizar a
   seção 14.
4. Mudança de rota/navegação real (fora desta sprint) deve primeiro atualizar
   a seção 9 e só depois ser implementada.
