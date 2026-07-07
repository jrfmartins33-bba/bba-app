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
├── Studio de Finanças
├── Field Studio
├── Geo Studio
├── Studio de Evidências
├── Studio de Medições
├── Studio de Documentos
├── Studio de Aprovações
├── Export Studio
└── BBA Advisor (transversal — vive dentro de cada Studio, não é um destino)
```

---

## 2. Nomenclatura oficial

**"BBA" é a marca da Plataforma e do Advisor. Nenhum Studio individual carrega
o prefixo "BBA".**

- ✅ `BBA Platform`, `BBA Advisor`
- ✅ `Project Studio`, `Studio de Finanças`, `Geo Studio`, ...
- ❌ ~~`BBA Project Studio`~~, ~~`BBA Studio de Finanças`~~

Motivo: evitar precisar renomear menus, telas e strings toda vez que um novo
Studio nascer ou que a marca evoluir — o prefixo fica em exatamente dois
lugares (o nome da plataforma e o nome do Advisor), não replicado em nove
Studios.

**Idioma do nome de cada Studio — decisão explícita do CPO, corrigida após
ver a tela real em produção:** a palavra "Studio" é mantida como termo
internacional (como "Design Studio"), mas o substantivo que a acompanha deve
ser português sempre que soar natural em português de negócios. Concretamente:

| Studio | Nome de exibição | Nome anterior (inglês, corrigido) |
|---|---|---|
| Project Studio | `Project Studio` | *(mantido)* |
| Geo Studio | `Geo Studio` | *(mantido)* |
| Field Studio | `Field Studio` | *(mantido)* |
| Export Studio | `Export Studio` | *(mantido)* |
| Studio de Finanças | `Studio de Finanças` | ~~Finance Studio~~ |
| Studio de Evidências | `Studio de Evidências` | ~~Evidence Studio~~ |
| Studio de Medições | `Studio de Medições` | ~~Measure Studio~~ |
| Studio de Documentos | `Studio de Documentos` | ~~Document Studio~~ |
| Studio de Aprovações | `Studio de Aprovações` | ~~Approval Studio~~ |

Padrão de nome quando traduzido: **"Studio de [substantivo em português]"**,
não "[substantivo] Studio" traduzido ao pé da letra — por isso "Studio de
Evidências", nunca "Evidências Studio". Project/Geo/Field/Export
permanecem em inglês por decisão explícita (termos já consolidados no
vocabulário de negócio, sem tradução natural equivalente); os demais nomes
de identificador interno (`domain/`, ids de card, etc.) continuam em inglês
no código — só o rótulo visível ao usuário muda.

O slug de rota do Project Studio continua `bba-project` (não
`project-studio`) por estabilidade de URL — já estava em produção antes deste
EPIC. Geo Studio/Studio de Evidências/Studio de Medições, por não terem esse
mesmo histórico de URL pública, tiveram sua rota promovida para o nível
superior preservando o mesmo nome de slug que já usavam (`/geoespacial`,
`/evidencias`, `/memorias`) — ver seção 9.

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
| **Geo Studio** | Geospatial Engine | `capabilities/geospatial-intelligence`, `domain/spatial-object` | Em produção (`/geoespacial`, nível de topo) |
| **Studio de Evidências** | Evidence Engine | `domain/field-evidence`, `domain/evidence-center` | Em produção parcial (`/evidencias`, nível de topo) — dados de demonstração, ainda não integrado a um Engine real |
| **Studio de Medições** | Measurement Engine | `domain/measurement*` (6 variantes) | Em produção parcial (`/memorias`, nível de topo) — dados de demonstração; boletins ainda em desenvolvimento |
| **Studio de Documentos** | Document Engine | `domain/document-reconstruction`, `domain/official-template-engine` | Planejado (card "em breve") |
| **Studio de Aprovações** | Approval Engine | `domain/approval-workflow` | Planejado (card "em breve") |
| **Export Studio** | Export Engine | `domain/export-engine` | Planejado (card "em breve") |
| **Studio de Finanças** | Finance Engine | `capabilities/cash-intelligence`, `domain/revenue-intelligence`, `domain/cash-forecast` | Planejado (card "em breve") |
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
| `SpatialObject` / geometria | **Geo Studio** | Project Studio, Studio de Evidências, Studio de Medições | Escrita de geometria/localização é exclusiva do Geo Studio. |
| `PlanningDataset` / `ScheduleActivity` | **Project Studio** | Studio de Finanças (curva S financeira), Field Studio (apontamento de execução) | Nenhum outro Studio recalcula CPM ou altera datas de linha de base. |
| `Decision` / `Recommendation` | **Decision Engine** (não é um Studio) | Todos os Studios, via Advisor | Nenhum Studio grava uma Decision diretamente — só o Decision Engine produz. |
| Evidência (foto/vídeo/documento) | **Studio de Evidências** | Studio de Medições (substanciar medição), Studio de Documentos | |
| Medição / Boletim | **Studio de Medições** | Studio de Finanças (faturamento) | |
| Aprovação | **Studio de Aprovações** | Todos os Studios podem solicitar; o registro da decisão de aprovação pertence ao Studio de Aprovações | |
| Fluxo de caixa / DRE | **Studio de Finanças** | Advisor (para narrativa cross-Studio na Home) | |

Quando um novo Studio precisar de um dado que já tem dono, a regra é sempre
"consumir somente leitura via contrato do Studio dono" — nunca duplicar o
dado, nunca escrever por fora.

---

## 6. Identidade de cada Studio

| Studio | Ícone (lucide) | Cor predominante | Headline | Responsabilidade |
|---|---|---|---|---|
| **Project Studio** | `GanttChartSquare` | `--bba-gold` | "O primeiro planejador de projetos orientado por decisões" | Planejamento, cronograma, EAP, linha de base, CPM, Curva S, forecast, Living Schedule, replanejamento, importação |
| **Studio de Finanças** | `Wallet` / `TrendingUp` | verde (`--status-green`) | "Sua obra, sua margem, em tempo real" | Fluxo de caixa, custos, receitas, orçamento, forecast financeiro, DRE, margens, rentabilidade |
| **Field Studio** | `HardHat` | âmbar (`--status-amber`) | "O que aconteceu na obra, hoje" | Diário, produção, equipes, equipamentos, clima, ocorrências, checklists |
| **Geo Studio** | `Map` | azul/dourado (reaproveitar tokens atuais) | "Onde sua obra realmente está" | Mapa, GIS, camadas, drone, RTK, inteligência espacial |
| **Studio de Evidências** | `Camera` / `FileImage` | neutro | "Prova, não achismo" | Fotos, vídeos, OCR, uploads, classificação, evidências |
| **Studio de Medições** | `Ruler` | `--bba-gold` | "Quanto foi de fato executado" | Medições, quantitativos, boletins, apropriações, memórias de cálculo |
| **Studio de Documentos** | `FileText` | neutro | "Todo documento, um só lugar" | Contratos, projetos, memoriais, licitações, OCR, reconstrução documental |
| **Studio de Aprovações** | `CheckSquare` | verde (`--status-green`) | "Nada trava sem rastro" | Fluxos de aprovação, pendências, histórico |
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

**Quando extrair para `packages/ui`:** no dia em que Studio de Finanças, Geo
Studio (na sua encarnação definitiva) ou qualquer outro Studio precisar do
Health Score ou do Executive Hero, extrai-se então para
`packages/ui/src/studio-shared/` (nome de pasta a definir naquele momento) —
não antes. Extrair hoje, com um único consumidor, seria abstração prematura.

---

## 8. Componentes exclusivos por Studio

| Studio | Componentes exclusivos |
|---|---|
| Project Studio | Gantt/WBS Table, Curva S, CPM, Living Schedule |
| Studio de Finanças | Cash Flow, Forecast Financeiro, DRE, Burn Rate |
| Geo Studio | GIS, Layers, Spatial Timeline |
| Field Studio | Diário de Obra, Checklist de Campo |
| Studio de Evidências | Galeria/Timeline de Evidências, OCR Viewer |
| Studio de Medições | Boletim de Medição, Memória de Cálculo |
| Studio de Documentos | Reconstrução Documental, Template Engine |
| Studio de Aprovações | Fluxo de Aprovação, Histórico de Pendências |
| Export Studio | Central de Exportação/Integrações |

---

## 9. Navegação — modelo contextual (corrigido após validação com o produto real)

> Histórico da seção: a v1 deste documento identificou uma divergência
> (Project Studio de nível superior × Geoespacial/Evidências/Memórias
> aninhados em "Engenharia") e a "corrigiu" promovendo todos os Studios
> reais para um grupo global "Studios" no topo da Sidebar, visível sempre.
> Ao ver essa tela publicada, o CPO/Chief Architect corrigiu o rumo: um
> grupo global com os 9 Studios (a maioria "em breve") na Sidebar principal
> é ruído para o cliente, que só usa os Studios relevantes ao projeto que
> tem em mãos. Esta seção descreve o modelo **corrigido e implementado**,
> substituindo integralmente a versão anterior — não são dois modelos
> coexistindo, é uma correção de rumo.

### 9.1 O modelo

1. **Studio é uma capacidade de plataforma com rota própria de nível
   superior** (`/bba-project`, `/geoespacial`, `/evidencias`, `/memorias`) —
   isso não muda. O que muda é *onde e para quem* ele aparece na Sidebar.
2. **Na Sidebar do cliente, um Studio só aparece dentro do Workspace ao qual
   está associado**, exatamente como os demais itens de
   `workspace-nav-config.ts` — nada de lista global permanente. O usuário
   entra em "Engenharia" e só ali vê Project Studio, Geo Studio, Studio de
   Evidências e Studio de Medições no menu contextual.
3. **A visão completa de todos os 9 Studios de uma vez (incluindo os cinco
   ainda "em breve") é exclusiva do Admin BBA** — um grupo adicional
   "Studios (visão Admin)" que só renderiza quando `isAdmin` é verdadeiro
   (o mesmo sinal que já controla o link "Admin BBA"). Serve como visão de
   roadmap/gestão da plataforma inteira, não como algo que o cliente precisa
   ver.
4. **Na tela principal do Workspace** (`/workspaces/engenharia`), os mesmos
   Studios aparecem como cards na grade de capacidades — o usuário vê a
   mesma coisa nos dois lugares (card na tela + item no menu), nunca só um
   dos dois.

```
Sidebar (cliente, fora de qualquer Workspace — ex.: em /hoje)
├── Hoje
└── Workspaces

Sidebar (cliente, dentro de /workspaces/engenharia ou de um Studio que
         pertence a ele — /bba-project, /geoespacial, /evidencias, /memorias)
├── Hoje
├── Workspaces
├── Engenharia                    (grupo contextual, expandido)
│    ├── Dashboard                (/workspaces/engenharia)
│    ├── Planejamento             (conteúdo de demonstração — ver nota)
│    ├── Project Studio           (/bba-project)
│    ├── Execução                 (em breve)
│    ├── Geo Studio               (/geoespacial)
│    ├── Studio de Evidências     (/evidencias)
│    ├── Studio de Medições       (/memorias)
│    ├── Medições                 (em breve — boletim, ainda distinto do Studio de Medições acima)
│    ├── Documentos, Aprovações, Exportações, Financeiro, Dashboard Executivo (em breve)
├── Empresa / Caixa / Impostos / Equipe
└── Operacional (Motor)

Sidebar (Admin BBA, em qualquer tela)
├── ... tudo acima, mais:
├── Studios (visão Admin)          ← grupo global, só para isAdmin
│    ├── Project Studio, Geo Studio, Studio de Evidências, Studio de
│    │   Medições (navegáveis)
│    └── Studio de Finanças, Field Studio, Studio de Documentos, Studio de
│        Aprovações, Export Studio (em breve)
└── Admin BBA
```

Um Studio com rota de nível superior (`/bba-project`, `/geoespacial`, etc.)
não vive fisicamente sob `/workspaces/engenharia/*`, então a Sidebar precisa
reconhecer que o usuário "está" no Workspace mesmo estando numa dessas
rotas: `isWorkspaceActive` (`sidebar.tsx`) considera o Workspace ativo tanto
quando a rota está sob seu `basePath` quanto quando é uma das rotas listadas
em seus próprios itens — assim o grupo "Engenharia" continua visível (e a
navegação contextual não desaparece) depois que o usuário abre um dos
Studios a partir dele.

**Nota sobre "Medições" (placeholder) vs. "Studio de Medições" (real):**
o item de sub-navegação "Medições" (ícone `Ruler`, sem `href`, herdado da
configuração original) e o novo "Studio de Medições" (`/memorias`) hoje
convivem na mesma lista com nomes muito próximos — o primeiro representa uma
capacidade futura de boletins de medição ainda não construída; o segundo é
a tela real de memórias de cálculo, promovida a Studio. Não foram
fundidos porque isso não foi pedido explicitamente e são, hoje, conceitos
diferentes — fica registrado aqui como um ponto a esclarecer com o
CPO/Chief Architect antes do próximo EPIC que tocar nesta área.

### 9.2 Por que a v1 desta seção estava errada

A v1 promoveu Project/Geo/Evidence/Measure Studio para um grupo "Studios"
sempre visível no topo da Sidebar, ao lado de "Hoje" e "Workspaces" —
resolvendo a inconsistência de nível hierárquico, mas criando um problema
novo: um cliente comum, na tela principal, passava a ver 9 linhas de Studio
(a maioria "em breve") permanentemente no menu, sem relação com o projeto
que estava de fato olhando. Isso é ruído de produto, não simplicidade — o
tipo de decisão que só fica visível depois de olhar a tela publicada de
verdade, e foi corrigida assim que identificada.

**Nota sobre "Planejamento":** esta tela (`/workspaces/engenharia/planejamento`)
continua sem alteração — não foi movida nem renomeada para Project Studio.
"Planejamento" é uma tela de demonstração com dados estáticos ilustrativos,
personalizada para a apresentação comercial à 2F Engenharia (nenhum Engine a
alimenta — o próprio código já documentava isso: *"Nenhum Engine alimenta esta
análise ainda"*), enquanto o Project Studio real (`/bba-project`) é o produto
de fato, orientado a Engine, com importação real de XML/Excel. Fundir os dois
teria sido um erro de arquitetura — por isso "Planejamento" permanece
exatamente onde estava.

**Nota sobre maturidade real dos Studios:** Geo Studio de fato chama um
serviço real do `bdos-core` (`buildGeospatialProductSnapshot`, com
parâmetros fixos de demonstração) — é Engine-backed de verdade. Studio de
Evidências e Studio de Medições, por outro lado, usam apenas arrays
estáticos de exemplo, sem nenhuma chamada a `bdos-core` ainda (ver seção 3).
Ter uma rota de nível superior não implica maturidade de Engine.

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
Cliente:
  Hoje
  Advisor            (atalho para o resumo cross-Studio, não uma tela de dados — conceito, seção 10)
  Workspaces
    Engenharia         → dentro dele: Project Studio, Geo Studio, Studio de
                         Evidências, Studio de Medições + demais itens "em breve"
  Empresa
  Administração        (só quando isAdmin)

Admin BBA (adicional):
  Studios (visão Admin) — todos os 9 Studios de uma vez, para gestão de roadmap
```

Estado atual (pós-correção da seção 9): não existe mais um grupo "Studios"
permanente na Sidebar do cliente — cada Studio só aparece dentro do
Workspace ao qual pertence. O grupo "Studios (visão Admin)", com os 9
Studios (4 navegáveis + 5 "em breve"), só renderiza quando `isAdmin` é
verdadeiro. "Advisor" como atalho de resumo cross-Studio ainda não existe
(depende da Home descrita na seção 10, que é conceito, não implementação).
"Workspaces" continua na Sidebar do cliente, por enquanto — só será removido
quando o conceito de "contexto de projeto ativo" (seção 9.3) for realmente
construído; até lá, é a única forma de abrir o contexto do projeto de
demonstração (Engenharia).

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
| Geo Studio | Em produção |
| Studio de Evidências | Em produção parcial (dados de demonstração) |
| Studio de Medições | Em produção parcial (Memórias de Cálculo, dados de demonstração) |
| Studio de Finanças | Planejado |
| Field Studio | Planejado |
| Studio de Documentos | Planejado |
| Studio de Aprovações | Planejado |
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
