# Motion Design Guidelines — BBA Platform

Infraestrutura oficial de motion da BBA Platform (UI Sprint M1). Esta é
a base para **futuras** telas — nenhuma tela existente foi alterada por
esta sprint, exceto a demonstração isolada descrita no final.

## Princípios

A motion da BBA Platform deve transmitir **precisão, inteligência,
confiança e fluidez** — nunca parecer um site de marketing. Inspirações:
Microsoft 365, Linear, Stripe Dashboard, Notion, Arc Browser. Evitar
qualquer animação chamativa, decorativa ou "bounce" exagerado.

## Tokens

Definidos em `packages/ui/src/motion/tokens.ts` (`MOTION_DURATION`,
`MOTION_EASING`) e espelhados em `apps/web/app/bba-globals.css` como
`--motion-duration-*` / `--motion-ease-*`. Mantenha os dois em sincronia
manualmente ao alterar qualquer valor — este pacote não tem pipeline de
build/CSS-in-JS que os una automaticamente.

| Token | Valor | Uso |
|---|---|---|
| `fast` | 150ms | micro-interações (hover, ícones) |
| `normal` | 250ms | padrão para FadeIn/SlideUp/SlideLeft/ScaleIn |
| `slow` | 450ms | transições de superfícies maiores (painéis, modais) |
| `reveal` | 800ms | revelação de dados (ProgressBar, AnimatedCounter) |

Easings: `standard` (estado muda no lugar), `enter` (chegando — começa
devagar, termina rápido), `exit` (saindo — começa rápido, termina
devagar).

Estes tokens **coexistem** com os já existentes `--fast`/`--medium`/
`--ease` e com as keyframes `fadeInUp`/`goldShimmer`/`statusPulse`
(seção `ANIMAÇÕES` de `bba-globals.css`, ainda usadas em `/hoje`).
Nenhum dos dois foi alterado. `motion-slide-up` e o shimmer do
`Skeleton` reaproveitam propositalmente `fadeInUp`/`goldShimmer` em vez
de duplicá-las. Consolidar o legado nesta base oficial é uma
oportunidade futura, fora do escopo desta sprint.

## Quando usar cada componente

**Fade** (`FadeIn`) — conteúdo que não deve se deslocar: texto de
status, badges, legendas. É a opção mais neutra; use quando um
movimento de posição (slide/scale) chamaria atenção demais para um
elemento secundário.

**Slide** (`SlideUp`, `SlideLeft`) — conteúdo entrando de uma direção
com intenção: `SlideUp` é o padrão para cards/seções aparecendo (rola
verticalmente pela página); `SlideLeft` para fluxos sequenciais/passo a
passo (linha do tempo, etapas de um processo).

`ScaleIn` — elementos que "aparecem por cima" do fluxo normal: modais,
popovers, callouts em destaque. Não usar para conteúdo de página comum.

**Counter** (`AnimatedCounter`) — exclusivamente para valores numéricos
de KPI que merecem ser percebidos se formando (total de atividades,
score, valores financeiros). Não usar para números que mudam com
frequência ou em listas longas — o custo de atenção não compensa.

**Progress** (`ProgressBar`) — qualquer indicador de avanço/percentual
(Planejamento, Financeiro, Score BBA, Aprovações). Use `animated` (o
padrão) na primeira renderização de uma tela; considere `animated=false`
se o mesmo valor for re-renderizado sem o usuário ter navegado (evita
"piscar" a barra sem necessidade).

**Skeleton** (`SkeletonCard`, `SkeletonTable`, `SkeletonMetric`) —
apenas enquanto dados reais estão carregando (fetch em andamento). Nunca
usar como decoração ou em conteúdo que já está disponível.

## Quando NÃO usar animação

- Em texto crítico de erro, alerta ou confirmação — precisão de leitura
  vem antes de qualquer efeito.
- Em elementos que o usuário vê repetidamente na mesma sessão (evita
  fadiga/lentidão percebida) — prefira animar só a primeira aparição.
- Encadeando mais de 2-3 animações simultâneas na mesma tela.
- Como substituto de uma boa hierarquia visual — motion informa
  transições de estado, não decora uma tela mal organizada.
- Sempre que `prefers-reduced-motion: reduce` estiver ativo — já
  tratado globalmente (`bba-globals.css`), nenhuma ação adicional
  necessária nos componentes.

## Demonstração desta sprint

A única aplicação em uma tela real: `/workspaces/engenharia/planejamento`,
card "Linha do Tempo" — a barra estática de caracteres foi substituída
pelo componente `ProgressBar` (`animated`, 0% → 82% em ~800ms). Nenhuma
outra tela ou animação foi alterada.
