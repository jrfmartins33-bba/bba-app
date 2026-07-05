# Decision Traceability — Componentes de UI

Componentes visuais que preparam a plataforma para os princípios do
BDS — ver `packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md`:
**PRINCIPLE 001 — Full Traceability**, **PRINCIPLE 002 — Mandatory
Drill-down** e **PRINCIPLE 003 — Progressive Disclosure**.

Nenhum destes componentes busca dados ou integra com um Engine — são
blocos de apresentação, prontos para receber conteúdo real quando um
Engine (Planning, Execution, Finance, Measurement, Evidence,
Geospatial, Approval), o Dashboard Executivo ou o BBA Advisor estiver
pronto para alimentá-los.

## Componentes

- **`DecisionInsightCard`** — o painel oficial, descrito abaixo. É o
  único componente do módulo com estado (`useState`, apenas para
  `expanded`).
- **`DecisionSection`** — uma pergunta rotulada da estrutura de Full
  Traceability (ex.: "ONDE ESTÁ O DESVIO?", "O QUE ESTÁ CAUSANDO?",
  "QUAL O IMPACTO?", "QUAIS EVIDÊNCIAS SUPORTAM?", "QUAL A AÇÃO
  RECOMENDADA?", "NÍVEL DE CONFIANÇA"). Desde a UI Sprint M2.2, é
  renderizada internamente pela `DecisionInsightCard` a partir de sua
  prop `sections`; permanece exportada para qualquer caso que precise
  do bloco isolado. Sem lógica, sem estado.
- **`DecisionPlaceholder`** — texto de espera específico por seção
  (ex.: "Aguardando identificação automática."), usado enquanto nenhum
  Engine real alimenta a seção. Cada seção tem seu próprio texto —
  nunca a mesma frase repetida. Sem lógica, sem estado.

## BBA Advisor Decision Panel (padrão oficial, UI Sprint M2.2)

Este é o padrão oficial de painel de decisão para qualquer indicador
da BBA Platform, implementando Progressive Disclosure (PRINCIPLE 003):

- **Nasce recolhido (estado resumido).** Mostra apenas `title`
  ("BBA Advisor"), `subtitle` (o que este painel analisa, ex.:
  "Análise do Planejamento"), `status` (badge, ex.: "Dentro do
  prazo") e `insight` (uma linha de resumo executivo, ex.: "Existe 1
  ponto que merece atenção."), além do botão "Expandir análise".
- **Expande no mesmo card (estado detalhado).** Ao clicar em
  "Expandir análise", o próprio card revela as seções de Full
  Traceability (PRINCIPLE 001) passadas via prop `sections` — nunca um
  modal, drawer ou nova página. O botão passa a "Recolher análise" e
  alterna de volta ao estado resumido.
- **Uma identidade visual única.** Sempre o mesmo estilo "BBA Advisor"
  (gradiente navy/dourado, ícone `Sparkles`) — nenhum Engine deve criar
  sua própria variação visual.
- **API por props, não por composição.** A página consumidora passa
  `title`, `subtitle`, `status`, `insight` e `sections` (array de
  `{ title, placeholder }`); não compõe `DecisionSection`/
  `DecisionPlaceholder` diretamente como filhos. Isso mantém a página
  como Server Component simples, sem lógica de UI própria.

### Props

```tsx
<DecisionInsightCard
  title="BBA Advisor"
  subtitle="Análise do Planejamento"
  status="Dentro do prazo"
  insight="Existe 1 ponto que merece atenção."
  sections={[
    { title: "ONDE ESTÁ O DESVIO?", placeholder: "Aguardando identificação automática." },
    { title: "O QUE ESTÁ CAUSANDO?", placeholder: "Aguardando análise das causas." },
    { title: "QUAL O IMPACTO?", placeholder: "Aguardando cálculo de impacto." },
    { title: "QUAIS EVIDÊNCIAS SUPORTAM?", placeholder: "Aguardando integração com os módulos operacionais." },
    { title: "QUAL A AÇÃO RECOMENDADA?", placeholder: "Será gerada automaticamente pelo BBA Advisor." },
    { title: "NÍVEL DE CONFIANÇA", placeholder: "Será calculado automaticamente conforme a quantidade e qualidade das evidências disponíveis." }
  ]}
/>
```

`defaultExpanded` (default `false`) e `className` também são aceitos;
Progressive Disclosure exige que todo painel novo mantenha
`defaultExpanded` no seu padrão (`false`).

## Como será reutilizado

Este mesmo componente, com as mesmas props e os mesmos dois estados,
deve ser reaproveitado — sem nenhuma variação visual própria — por:
Planning, Execution, Geospatial, Evidence, Measurement, Finance, o
Dashboard Executivo e o próprio BBA Advisor. Cada consumidor troca
apenas `subtitle`, `status`, `insight` e o conteúdo de `sections`
(placeholders hoje, dados reais do Engine correspondente no futuro) —
nunca a estrutura, o comportamento de expandir/recolher ou a
identidade visual do painel.

Primeira aplicação (mock, sem dados reais): painel "BBA Advisor" em
`/workspaces/engenharia/planejamento`.

## O que estes componentes NÃO fazem

- Não buscam dados (sem `fetch`, sem hooks de dado, sem import de
  `@bba/lib`). O único hook presente é o `useState` de UI da
  `DecisionInsightCard`, controlando apenas `expanded`.
- Não implementam o drill-down do PRINCIPLE 002 — isso é navegação
  real entre telas, fora do escopo puramente visual deste módulo.
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
