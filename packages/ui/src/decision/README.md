# Decision Traceability — Componentes de UI

Componentes visuais que preparam a plataforma para os dois primeiros
princípios do BDS — ver
`packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md`:
**PRINCIPLE 001 — Full Traceability** e **PRINCIPLE 002 — Mandatory
Drill-down**.

Nenhum destes componentes tem lógica, estado ou hooks — são blocos de
apresentação puros, prontos para receber conteúdo real quando um Engine
(Planning, Execution, Finance, Measurement, Evidence, Geospatial,
Approval), o Dashboard Executivo ou o BBA Advisor estiver pronto para
alimentá-los.

## Componentes

- **`DecisionInsightCard`** — wrapper de mais alto nível para a análise
  de um indicador. Reaproveita o `Card` já existente (`@bba/ui`) em vez
  de recriar chrome de card. Aceita `collapsed` como uma prop puramente
  visual (não é um toggle interativo) para o estado "aguardando dados"
  inicial.
- **`DecisionSection`** — uma pergunta rotulada da estrutura de Full
  Traceability (ex.: "ONDE", "POR QUÊ", "IMPACTO", "EVIDÊNCIAS", "AÇÃO
  RECOMENDADA"). Renderiza qualquer `children` — hoje, tipicamente um
  `DecisionPlaceholder`.
- **`DecisionPlaceholder`** — texto de espera ("Aguardando dados do
  Planning Engine."), usado enquanto nenhum Engine real alimenta a
  seção.

## Como serão reutilizados

Cada Engine, ao ganhar sua própria tela de indicadores, deve montar seu
"Análise da Situação" equivalente com estes mesmos três componentes —
substituindo os `DecisionPlaceholder`s por conteúdo real (texto,
números, links de drill-down) sem precisar reconstruir a experiência
visual. O Dashboard Executivo e o BBA Advisor devem seguir o mesmo
padrão para qualquer indicador que exponham.

Primeira aplicação (mock, sem dados reais): card "Análise da Situação"
em `/workspaces/engenharia/planejamento`.

## O que estes componentes NÃO fazem

- Não buscam dados (sem `fetch`, sem hooks, sem import de `@bba/lib`).
- Não implementam o drill-down do PRINCIPLE 002 — isso é navegação real
  entre telas, fora do escopo puramente visual deste módulo.
- Não decidem quando um card deve estar "recolhido" — quem consome o
  componente decide, via prop.

## Nota de deployment

O push original destes componentes (commit `5726682`) não gerou nenhum
deployment na Vercel — o webhook Git→Vercel não chegou a criar o
registro de build (confirmado via API da Vercel: nenhuma entrada, nem
sequer `CANCELED`, existe para esse commit). Esta linha faz parte do
commit que corrige isso, garantindo um diff real dentro do grafo do
Turborepo para que o recurso "Skip unaffected projects" da Vercel não
pule o build novamente.
