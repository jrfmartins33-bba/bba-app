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
  único componente do módulo com estado (`useState`, para `expanded` e
  para o item aberto do accordion).
- **`DecisionSection`** — um item do accordion de Full Traceability
  (ex.: "Onde está o desvio?", "O que está causando?", "Qual o
  impacto?", "Quais evidências suportam?", "Qual a ação recomendada?",
  "Nível de confiança"). Recebe `isOpen`/`onToggle` de
  `DecisionInsightCard` — não guarda estado próprio.
- **`DecisionPlaceholder`** — texto de espera específico por seção
  (ex.: "Aguardando identificação automática."), usado enquanto nenhum
  Engine real alimenta a seção. Cada seção tem seu próprio texto —
  nunca a mesma frase repetida. Sem lógica, sem estado.

## BBA Advisor UX Pattern (padrão oficial, Release 1.1)

Este é o padrão oficial de painel de decisão para qualquer indicador
da BBA Platform:

```
Engine (ex.: Planning Engine)
    ↓
BBA Advisor
    ↓
Resumo executivo (conversacional)
    ↓
"Ver análise"
    ↓
Accordion (Full Traceability)
    ↓
Drill-down (PRINCIPLE 002, futuro)
```

- **O Engine se apresenta, o Advisor fala.** `engineLabel` (ex.:
  "Planning Engine") é um rótulo discreto acima da identidade do
  Advisor — nunca compete com ela. "BBA Advisor" é fixo dentro do
  componente (não é uma prop): a mesma identidade em todo Engine, sem
  risco de divergência entre consumidores.
- **O Advisor fala como um especialista, nunca como um formulário.**
  `message` é um resumo executivo conversacional (uma frase curta por
  linha, ex.: "Analisei o cronograma desta obra." / "Encontrei um
  ponto que merece sua atenção."), não um rótulo técnico.
- **Nasce recolhido (estado resumido).** Mostra `engineLabel`, a
  identidade do Advisor, `status` (badge, incluindo o mesmo emoji de
  status já usado na plataforma, ex.: "🟢 Dentro do prazo") e
  `message`, além do botão "Ver análise".
- **Expande como accordion no mesmo card (estado detalhado).** Ao
  clicar em "Ver análise", o card revela as seções de Full
  Traceability (PRINCIPLE 001) como um accordion — apenas uma seção
  aberta por vez, mantendo o painel compacto — nunca um modal, drawer
  ou nova página. O botão passa a "Ocultar análise".
- **Uma identidade visual única.** Sempre o mesmo estilo "BBA Advisor"
  (gradiente navy/dourado, ícone `Sparkles`) — nenhum Engine deve criar
  sua própria variação visual.
- **API por props, não por composição.** A página consumidora passa
  `engineLabel`, `status`, `message` e `sections` (array de
  `{ title, placeholder }`); não compõe `DecisionSection`/
  `DecisionPlaceholder` diretamente como filhos. Isso mantém a página
  como Server Component simples, sem lógica de UI própria.

### Props

```tsx
<DecisionInsightCard
  engineLabel="Planning Engine"
  status="🟢 Dentro do prazo"
  message={[
    "Analisei o cronograma desta obra.",
    "Encontrei um ponto que merece sua atenção."
  ]}
  sections={[
    { title: "Onde está o desvio?", placeholder: "Aguardando identificação automática." },
    { title: "O que está causando?", placeholder: "Aguardando análise das causas." },
    { title: "Qual o impacto?", placeholder: "Aguardando cálculo de impacto." },
    { title: "Quais evidências suportam?", placeholder: "Aguardando integração com os módulos operacionais." },
    { title: "Qual a ação recomendada?", placeholder: "Será gerada automaticamente pelo BBA Advisor." },
    { title: "Nível de confiança", placeholder: "Será calculado automaticamente conforme a quantidade e qualidade das evidências disponíveis." }
  ]}
/>
```

`defaultExpanded` (default `false`) e `className` também são aceitos;
Progressive Disclosure exige que todo painel novo mantenha
`defaultExpanded` no seu padrão (`false`).

## Como será reutilizado

Este mesmo componente, com as mesmas props e os mesmos estados, deve
ser reaproveitado — sem nenhuma variação visual própria — por:
Planning, Execution, Geospatial, Evidence, Measurement, Finance e o
Dashboard Executivo. Cada consumidor troca apenas `engineLabel`,
`status`, `message` e o conteúdo de `sections` (placeholders hoje,
dados reais do Engine correspondente no futuro) — nunca a estrutura,
o comportamento de accordion/expandir-recolher ou a identidade visual
do painel.

Primeira aplicação (mock, sem dados reais): painel "BBA Advisor" em
`/workspaces/engenharia/planejamento` — release final do Planning
Engine (Release 1.1), a partir da qual o Planning Engine é considerado
Feature Complete (congelado, exceto correções de bugs).

## O que estes componentes NÃO fazem

- Não buscam dados (sem `fetch`, sem hooks de dado, sem import de
  `@bba/lib`). Os únicos hooks presentes são os `useState` de UI da
  `DecisionInsightCard`, controlando apenas `expanded` e qual seção do
  accordion está aberta.
- Não implementam o drill-down do PRINCIPLE 002 — isso é navegação
  real entre telas, fora do escopo puramente visual deste módulo.
- Não têm IA, causas, impactos, recomendações ou nível de confiança
  reais — permanecem placeholders explícitos até um Engine real
  alimentá-los.
- Não introduzem animações novas — o fade-in do accordion reaproveita
  os tokens/keyframes já existentes em `packages/ui/src/motion/`
  (mirrorados em `apps/web/app/bba-globals.css`), nada foi criado.

## Nota de deployment

O push original destes componentes (commit `5726682`) não gerou nenhum
deployment na Vercel — o webhook Git→Vercel não chegou a criar o
registro de build (confirmado via API da Vercel: nenhuma entrada, nem
sequer `CANCELED`, existe para esse commit). Esta linha faz parte do
commit que corrige isso, garantindo um diff real dentro do grafo do
Turborepo para que o recurso "Skip unaffected projects" da Vercel não
pule o build novamente.
