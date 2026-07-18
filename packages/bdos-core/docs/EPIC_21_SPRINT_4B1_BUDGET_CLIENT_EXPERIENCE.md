# Epic 21, Sprint 21.4B.1 — Primeira Experiência Visual e Demonstrável do Orçamento

## Problema comercial observado

O cliente acessou o BDOS e não conseguiu entender o produto nem o valor entregue. O backend do
Epic 21 (localização de documento de orçamento, detecção de região tabular, reconstrução de
hipóteses de coluna física) avançou significativamente, mas nenhuma dessas capacidades tinha uma
superfície visual voltada ao cliente — risco comercial real e imediato, não uma lacuna de design
abstrata.

## Objetivo da experiência

Entregar uma área de **Orçamento**, dentro do Workspace Engenharia, que permita a um cliente não
técnico responder em poucos segundos: o que o módulo faz, qual é o orçamento oficial, qual é a
proposta, qual redução foi aplicada, como o orçamento está organizado, qual é o estado atual e o
que fazer em seguida — seguindo PRINCIPLE 008 (Human-First Visual Decision UX).

## Origem dos dados: real ou demonstrativa

**Demonstrativa, explícita e isolada.** Reconhecimento confirmou:

- O domínio `BudgetVersion`/`BudgetLine` (`packages/bdos-core/src/domain/budget-version`) e o
  serviço de aplicação (`budget-version-service.ts`) já existem, mas **nenhuma rota/Server Action
  em `apps/web` os expõe** — o adaptador Supabase
  (`apps/web/lib/bdos/procurement-engineering-server-repository.ts`) documenta a própria leitura
  como "fluxo de servidor pretendido... a construir em Sprint futura". Não existe hoje nenhum
  fluxo que crie uma Versão do Orçamento real para uma empresa autenticada, então a "Alternativa
  A" (reutilizar leitura real já existente) genuinamente não se aplica.
- O caso de caracterização do Epic 21 (orçamento oficial R$ 9.809.087,18, 11 grupos, 25
  subgrupos, 300 itens) está embutido em fixtures reais
  (`lagoa-do-arroz.official-fixture.ts`/`lagoa-do-arroz.characterization.test.ts`), mas amarrado
  ao nome do projeto/cliente real ativo — não reutilizado aqui para não expor a estrutura de um
  cliente ativo como "demo" de outro prospect.
- O valor de proposta (R$ 7.611.851,65) e o percentual de redução (22,40%) **não existem em
  nenhum lugar do código** — não há serviço de simulação/transformação de desconto implementado
  (`ADR-003_VERSAO_DO_ORCAMENTO_E_TRANSFORMACOES_ORCAMENTARIAS.md` marca isso como decisão em
  aberto). Esses dois valores só existem no próprio brief desta Sprint, que autoriza
  explicitamente seu uso como caso de demonstração controlado.

Optou-se pela **Alternativa B**: uma fonte de demonstração tipada, isolada e nunca exportada como
contrato de domínio — `apps/web/lib/budget/budget-demonstration-data.ts`, discriminada por
`sourceKind: "demonstration"`. Todos os valores são literais fixos (nunca resultado de
cálculo/ponto flutuante em runtime): centavos inteiros para auditoria de origem, texto já
formatado em pt-BR para exibição. Nenhuma soma/divisão acontece nos componentes React — só leitura
de campo.

O bloco "Exemplo de organização" (3 grupos sintéticos, poucos itens sintéticos, marcados
visivelmente como "Exemplo visual") substitui a leitura da fixture real, já que ela pertence a um
cliente ativo e nomear seu projeto na demonstração violaria a própria instrução da Sprint
("não usar 'Lagoa do Arroz'").

## Limites de honestidade aplicados

- Badge "Demonstração" sempre visível na primeira dobra, nunca em tooltip.
- Texto auxiliar explícito: "Estes dados demonstram como o BDOS apresentará e apoiará a análise
  do orçamento. Nenhuma versão definitiva será criada sem revisão e confirmação."
- Nenhuma alegação de leitura/importação automática do PDF em nenhum ponto da experiência (testado).
- Caminho do orçamento diferencia, por etapa, `demonstrated` / `requires_confirmation` / `future`
  — nunca afirma que o orçamento real do cliente foi processado.
- Card "Simular outro cenário" fica com um "Próximo passo" honesto (sem botão funcional, sem
  cálculo inventado), porque nenhum serviço determinístico de simulação de desconto existe hoje
  no código (`simulationServiceAvailable: false`).

## Decisões visuais

Reuso total do design system existente (nenhuma biblioteca nova): `Card`/`StatusBadge`/`Button` de
`@bba/ui`, classes `bba-card`/`workspace-card`/`status-badge`/`bba-button`/`section-grid`/`span-*`
já usadas no Workspace Engenharia e no Relatório Executivo de Medições. A "Conclusão Executiva"
segue o mesmo padrão do Decision Hero de Medições (situação → conclusão → próxima ação). A
comparação oficial × proposta usa duas barras de largura literal e pré-calculada (nunca recalculada
em runtime), com legenda textual (nunca depende só de cor) e um resumo com diferença e redução em
texto. A jornada de 5 etapas e o bloco "Como o orçamento está organizado" (com "Exemplo de
organização" expansível sob demanda, recolhido por padrão) seguem os mesmos princípios anti-ERP já
aplicados alhures no produto (sem tabela como estrutura primária, detalhes sob demanda).

## Integração com o Workspace Engenharia

- `apps/web/components/workspace-nav-config.ts`: novo item de menu contextual `Orçamento` →
  `/orcamentos`.
- `apps/web/app/(dashboard)/workspaces/engenharia/page.tsx`: novo `CapabilityCard` (`id:
  "orcamento"`, status `Em desenvolvimento`, ação `Abrir Orçamento` → `/orcamentos`).
- Jornada: Workspace Engenharia → Abrir Orçamento (`/orcamentos`) → Ver demonstração
  (`/orcamentos/demonstracao`) → comparação oficial × proposta — em no máximo dois passos, como
  exigido.

## Rota

`/orcamentos` (entrada real, autenticada via `(dashboard)` — herda `BbaDashboardShell`) e
`/orcamentos/demonstracao` (primeira experiência completa). Como nenhuma leitura real de
`BudgetVersion` está disponível ainda, `/orcamentos` sempre renderiza o estado vazio real
("Nenhum orçamento disponível") com a única ação hoje disponível: "Ver demonstração". O título
visível permanece no singular ("Orçamento da obra") em ambas as rotas.

## Estados implementados

- **Vazio** (`BudgetEmptyState`) — usado hoje em `/orcamentos`, já que não existe leitura real.
- **Erro controlado** (`BudgetErrorState`) — componente pronto e testado (mesmo padrão sanitizado
  de `measurement-decision-brief-error-state.tsx`), preparado para quando uma leitura real
  (Alternativa A) for wired em Sprint futura; não há hoje nenhum caminho de código que produza
  erro de fato (nenhum fetch acontece na demonstração), então não foi forçado nenhum gatilho
  artificial no fluxo atual.
- **Acesso não autorizado** — já coberto globalmente por `BbaDashboardShell`/`(dashboard)/layout.tsx`
  (redireciona para `/login`); nenhuma lógica própria foi duplicada aqui.
- **Demonstração disponível** — `/orcamentos/demonstracao`, experiência completa.
- **Orçamento real disponível** — não alcançável nesta Sprint (nenhuma leitura real existe); a
  página já está estruturada para decidir entre real/vazio sem exigir nova rota quando essa leitura
  for construída.

## Termos técnicos removidos/evitados

Nenhum termo da lista proibida (`BudgetVersion`, `BudgetLine`, `MoneyCents`, aggregate, read
model, pipeline, reconstruction, tabular region, alignment, segment, hypothesis, fingerprint,
schema, fixture, adapter, endpoint, `sourceCandidateGroupKey`, nomes de Sprint, nomes de arquivo)
aparece fora de comentário/documentação interna em nenhum componente ou página — verificado por
teste automatizado (`budget-client-experience.test.ts`) que remove comentários antes de buscar.

## Testes adicionados

- `apps/web/lib/budget/budget-demonstration-data.test.ts` — valores confirmados (oficial,
  proposta, redução, diferença, hierarquia), consistência de centavos inteiros sem ponto
  flutuante, ausência do nome do cliente/obra/órgão real, indisponibilidade do serviço de
  simulação, limite do exemplo sintético.
- `apps/web/components/budget/budget-client-experience.test.ts` — título e subtítulo do
  cabeçalho, badge de demonstração condicional (nunca em tooltip), honestidade sobre a origem dos
  dados, ausência de termo técnico proibido, estado vazio e estado de erro, navegação a partir do
  Workspace Engenharia (menu + card), jornada estrutural completa, ausência de `<table>`/rolagem
  horizontal forçada, indisponibilidade honesta da simulação, ausência de cálculo de ponto
  flutuante nos componentes, ausência de qualquer caminho de persistência para os dados
  demonstrativos.
- Ambos seguem o padrão já estabelecido no repositório (checagem estática de código-fonte +
  asserções diretas sobre dados, sem jsdom/testing-library, mesmo motivo documentado em
  `measurement-imports-page.test.ts`).

## Limitações conhecidas

- Nenhuma leitura real de orçamento está disponível ainda em `apps/web` — `/orcamentos` sempre
  mostra o estado vazio real hoje; isso é intencional e honesto, não um bug.
- Nenhum serviço de simulação/transformação de desconto existe — o card correspondente é um
  próximo passo anunciado, não uma função.
- Verificação visual foi feita via build estático + inspeção do HTML server-rendered (conteúdo,
  ausência de erro no servidor/console) — não há ferramenta de captura de tela disponível neste
  ambiente de execução, então a conferência pixel-a-pixel (sobreposição, corte de texto) depende
  da revisão visual do usuário no navegador antes do PR.
- Nenhuma leitura semântica de PDF, OCR, interpretação econômica automática, edição dos 300 itens,
  exportação, consolidação de Versão do Orçamento ou IA/LLM foram implementadas — fora de escopo
  desta Sprint, por definição.

## Próximo passo recomendado

Quando uma Sprint futura wired a leitura real de `BudgetVersion` (Alternativa A), `/orcamentos`
passa a decidir entre orçamento real e estado vazio sem exigir nova rota — e o serviço real de
simulação/transformação de desconto (quando existir, ver ADR-003 §T.8) habilita o terceiro card de
ação sem qualquer mudança de contrato visual.
