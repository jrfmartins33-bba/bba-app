# Epic 21, Sprint 21.4B.2 — Planilha Orçamentária Demonstrativa e Composição Visual Profissional

## Problema visual observado

A revisão visual da Sprint 21.4B.1 (commit `bbf3614`) confirmou que a experiência de Orçamento,
apesar de corrigida na entrada comercial, no estado vazio e na fronteira de erro, ainda não estava
apta para apresentação ao cliente: o usuário via um painel de números e uma comparação, mas
**nenhuma planilha orçamentária de verdade**. O card "Caminho do orçamento" ocupava quase uma tela
inteira usando só uma faixa estreita à esquerda, deixando um grande espaço vazio à direita — sintoma
de uma lista vertical de linhas largas fazendo o trabalho de uma grade, não de um problema de
padding/gap. A composição lia como protótipo incompleto, sem diferencial em relação a qualquer
outra ferramenta do mercado.

## A planilha como elemento principal

A correção não foi cosmética — mudou a hierarquia e a composição da página. Nova ordem obrigatória
em `/orcamentos/demonstracao`
(`apps/web/app/(dashboard)/orcamentos/demonstracao/page.tsx`):

cabeçalho → resumo compacto → 3 indicadores comerciais → faixa `11 → 25 → 300` → **Planilha
orçamentária** → comparação oficial × proposta → etapas do orçamento → ações disponíveis → próxima
decisão.

O card grande "Conclusão Executiva" foi removido por completo (não renomeado, não encolhido) —
conceitualmente incorreto apresentar uma conclusão grande antes do orçamento que a sustenta, e ele
ocupava o espaço que agora traz a planilha para a primeira dobra. Em seu lugar,
`BudgetSummaryStrip` é uma tira de no máximo duas linhas, sem título institucional, sem painel
interno, sem min-height.

## Separação entre totais demonstrativos e itens sintéticos

Duas fontes de dados deliberadamente isoladas, nunca somadas:

- `apps/web/lib/budget/budget-demonstration-data.ts` — `sourceKind: "demonstration"`, os totais
  confirmados do caso de caracterização do Epic 21 (inalterados desta Sprint).
- `apps/web/lib/budget/budget-worksheet-sample-data.ts` (novo) — `sourceKind:
  "synthetic_visual_example"`, exatamente 3 grupos genéricos de construção civil (Serviços
  preliminares, Movimento de terra, Estruturas de concreto), 9 itens ao todo (dentro da faixa 8–10
  exigida), cada um com código, descrição, unidade, quantidade, preço unitário e total em centavos
  inteiros. Quantidade é sempre um inteiro exato, de modo que `quantidade × preço unitário ===
  total` e a soma dos totais de cada grupo bate exatamente com seu `subtotalCents` — conferido em
  `budget-worksheet-sample-data.test.ts` com aritmética inteira, nunca recalculado na interface.
  Nenhum nome de cliente, órgão ou obra real aparece nessa amostra (nem "Lagoa do Arroz", nem os
  300 itens reais do caso de caracterização — usar a fixture real teria exposto a estrutura de um
  cliente ativo como "demo" genérica, o que a própria Sprint proibiu).

`BudgetWorksheetSection` não importa `budget-demonstration-data` — a separação é estrutural, não
apenas por convenção de nomenclatura.

## Planilha desktop e celular

`apps/web/components/budget/budget-worksheet-section.tsx`: cada grupo é um `<details>`/`<summary>`
nativo (acessível por teclado, foco visível, estado de expansão semanticamente correto sem ARIA
manual), controlado por `useState` por grupo — só o primeiro começa aberto, os demais recolhidos,
e o estado do usuário nunca é resetado por um re-render (evita a armadilha comum de React
recomputar `open` a cada render). Dentro de cada grupo, uma única `<table>` com seis colunas
(Código, Item de serviço, Unidade, Quantidade, Preço unitário, Total) — a mesma tabela, sem
duplicar dado em outro markup, muda para layout de cartão em telas ≤600px via CSS puro (`thead`
escondido, `<td>` vira linha com `data-label` lendo o próprio atributo do DOM). Aviso "Os itens e
valores desta amostra são sintéticos..." é texto permanente, nunca tooltip/hover.

## Correção da jornada

`#comparacao` foi substituída por `#planilha-orcamentaria` em toda a experiência: "Explorar
orçamento" (bloco "Próxima decisão") agora leva à planilha, não à comparação — é onde os grupos e
itens de fato estão. `scroll-margin-top` evita que o título fique colado à borda da viewport ao
rolar até a âncora.

## Etapas do orçamento (antes "Caminho do orçamento")

Vocabulário "Demonstrado" / "Exige confirmação humana" / "Etapa futura" removido por completo
(nenhuma ocorrência da palavra "humana" na experiência, verificado em teste). Substituído por
"Disponível" / "Aguardando revisão" / "Próxima etapa". Layout reescrito de lista vertical (a causa
raiz do espaço vazio) para grade `repeat(5, minmax(0, 1fr))` no desktop, com conector horizontal
fino entre as etapas; no celular, empilha em coluna única sem conector, cada etapa numa linha
compacta.

## Honestidade da demonstração

Cabeçalho preserva o badge "Demonstração" (nunca em tooltip) e o aviso de que nenhuma versão
definitiva será criada sem revisão. "BDOS" continua fora de todo texto voltado ao cliente (guard de
vocabulário, PRINCIPLE 007, herdado da correção anterior). O card "Simular outro cenário" segue
honestamente indisponível — "A simulação de novos cenários será disponibilizada em uma próxima
etapa", sem mencionar "serviço de cálculo dedicado" (linguagem de implementação removida). A
fronteira de erro (`apps/web/app/(dashboard)/orcamentos/error.tsx`) agora usa `usePathname` para
decidir o badge de demonstração pela rota real, em vez de um valor fixo — corrige o caso em que um
erro em `/orcamentos/demonstracao` mostrava o cabeçalho sem badge.

## Decisões responsivas

Breakpoint único de 600px (mesmo já usado desde a Sprint 21.4B.1) cobre: comparação (rótulo+valor
na mesma linha, barra em linha própria), faixa de hierarquia (empilha verticalmente), planilha
(tabela → cartões via CSS, sem duplicar dado), etapas (grade de 5 colunas → coluna única sem
conector), botões de "Próxima decisão" (largura total). `prefers-reduced-motion` desliga a
animação da barra de comparação, preservado da Sprint anterior.

## Limitações

- Nenhuma leitura real de orçamento está disponível ainda em `apps/web` — `/orcamentos` continua
  mostrando o estado vazio real ("Nenhum orçamento real disponível"), intencional.
- Nenhum serviço de simulação/transformação de desconto existe — o card correspondente continua
  honestamente indisponível.
- A planilha demonstrada usa dados sintéticos de amostra visual, nunca a leitura semântica do PDF
  real — não implementada nesta Sprint, e o texto da experiência não alega o contrário em nenhum
  ponto (verificado em teste).
- Verificação visual foi feita via build estático + inspeção do HTML server-renderizado (conteúdo,
  ordem dos componentes, ausência de erro no servidor/console); não há ferramenta de captura de
  tela disponível neste ambiente de execução, então a conferência pixel-a-pixel depende da revisão
  visual do usuário no navegador antes do PR.

## Próximo passo recomendado

Revisão visual do usuário em desktop e celular a partir de
`http://localhost:3000/orcamentos/demonstracao`. Nenhuma nova Sprint deve começar antes dessa
aprovação.
