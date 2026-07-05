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
  de recriar chrome de card. Aceita `highlight` como uma prop puramente
  visual (não é um toggle interativo) para o mesmo destaque em gradiente
  dourado já usado por cards como "BBA Advisor".
- **`DecisionSection`** — uma pergunta rotulada da estrutura de Full
  Traceability (ex.: "ONDE", "POR QUÊ", "IMPACTO", "EVIDÊNCIAS", "AÇÃO
  RECOMENDADA", "NÍVEL DE CONFIANÇA"). Renderiza qualquer `children` —
  hoje, tipicamente um `DecisionPlaceholder`.
- **`DecisionPlaceholder`** — texto de espera específico por seção (ex.:
  "Aguardando identificação automática."), usado enquanto nenhum Engine
  real alimenta a seção. Cada seção tem seu próprio texto — nunca a
  mesma frase repetida.

## Decision Experience Pattern (UI Sprint M2.1)

Este é o padrão oficial de experiência para qualquer indicador da BBA
Platform:

- **Todo indicador gera automaticamente uma análise.** Não existe botão
  "Entender" nem qualquer outro segundo passo — a `DecisionInsightCard`
  correspondente já está montada e visível assim que o indicador
  aparece na tela.
- **O usuário nunca precisa solicitar a explicação.** A plataforma se
  explica sozinha; o que muda, conforme cada Engine é integrado, é o
  conteúdo (de `DecisionPlaceholder` para dado real), nunca a
  necessidade de uma ação do usuário para revelá-lo.
- **O padrão é único e será reutilizado por todos os Engines** —
  Planning, Execution, Finance, Measurement, Evidence, Geospatial,
  Approval, o Dashboard Executivo e o BBA Advisor. Nenhum Engine deve
  criar sua própria variação visual desta experiência.

## Como serão reutilizados

Cada Engine, ao ganhar sua própria tela de indicadores, deve montar sua
"Análise Inteligente" equivalente com estes mesmos três componentes —
substituindo os `DecisionPlaceholder`s por conteúdo real (texto,
números, links de drill-down) sem precisar reconstruir a experiência
visual, e sem reintroduzir um passo de clique intermediário. O
Dashboard Executivo e o BBA Advisor devem seguir o mesmo padrão para
qualquer indicador que exponham.

Primeira aplicação (mock, sem dados reais): card "Análise Inteligente"
em `/workspaces/engenharia/planejamento`.

## O que estes componentes NÃO fazem

- Não buscam dados (sem `fetch`, sem hooks, sem import de `@bba/lib`).
- Não implementam o drill-down do PRINCIPLE 002 — isso é navegação real
  entre telas, fora do escopo puramente visual deste módulo.
- Não animam nada ainda — `FadeIn`/`SlideUp`/Progressive Reveal
  (`packages/ui/src/motion/`) estão documentados em comentário nos
  componentes como direção futura, não implementados.

## Nota de deployment

O push original destes componentes (commit `5726682`) não gerou nenhum
deployment na Vercel — o webhook Git→Vercel não chegou a criar o
registro de build (confirmado via API da Vercel: nenhuma entrada, nem
sequer `CANCELED`, existe para esse commit). Esta linha faz parte do
commit que corrige isso, garantindo um diff real dentro do grafo do
Turborepo para que o recurso "Skip unaffected projects" da Vercel não
pule o build novamente.
