# Epic 21, Sprint 21.4B.4 — Correção Estrutural do Alinhamento da Planilha Orçamentária

## Problema real, confirmado por captura de tela

Depois da Sprint 21.4B.3 (grade fixa via `<colgroup>` + `table-layout: fixed`, idêntico em cada
tabela de grupo), a revisão visual real mostrou que as colunas Unidade, Quantidade, Preço unitário
e Total continuavam desalinhadas entre os três grupos da Planilha orçamentária. A correção anterior
estava tecnicamente correta na teoria, mas incompleta na prática: **cada grupo ainda renderizava
sua própria `<table>`**, e mesmo com colgroup e `table-layout: fixed` idênticos, cada `<table>`
continua sendo um contexto de layout independente no navegador — sujeito a arredondamento de
porcentagem calculado separadamente por tabela. Ter as MESMAS regras CSS em três tabelas diferentes
não é o mesmo que ter uma garantia estrutural de alinhamento.

## Correção estrutural (não mais uma correção de CSS)

`apps/web/components/budget/budget-worksheet-section.tsx` foi reestruturado para usar **uma única
`<table>` para a planilha inteira**, com um único `<colgroup>` calculado uma única vez pelo
navegador. Cada grupo agora contribui com:

- um `<tbody>` contendo apenas a linha de cabeçalho do grupo (código, nome, contagem de itens,
  chevron, dentro de um `<th colSpan={6} scope="rowgroup">`);
- quando aberto, um segundo `<tbody>` com as linhas de item e a linha de subtotal.

Como existe fisicamente uma única tabela, o desalinhamento entre grupos deixou de ser "improvável"
para se tornar **estruturalmente impossível** — não há mais um "entre tabelas" onde a divergência
possa acontecer. Confirmado no HTML renderizado: exatamente uma `<table>` e um `<colgroup>` para
toda a planilha (antes eram três de cada).

## Trade-off: `<details>`/`<summary>` nativo → `<button>` acessível

A Sprint 21.4B.3 preservou `<details>`/`<summary>` nativo por grupo (que exigia uma `<table>`
própria dentro de cada `<details>`, já que `<tr>` não pode ser filho direto de `<details>`). Como
`<details>` é justamente a causa estrutural do problema, ele foi substituído por
`<button aria-expanded aria-controls>` dentro do `<th>` da linha de cabeçalho do grupo — um padrão
de disclosure amplamente reconhecido e igualmente acessível: focável e operável por teclado por
padrão (Tab/Enter/Espaço), com `:focus-visible` e `:hover` próprios, `aria-expanded` refletindo o
estado real, e `aria-controls` apontando para o `id` (via `useId()`) do `<tbody>` de conteúdo. As
linhas de item só existem no DOM quando o grupo está aberto (nunca apenas escondidas via CSS),
preservando o comportamento "primeiro grupo aberto, demais recolhidos" e o texto dos itens nunca
sendo lido por leitor de tela quando o grupo está fechado.

## Subtotal

Deixou de viver em `<tfoot>` (impossível de repetir em múltiplos `<tbody>` — HTML permite apenas um
`<tfoot>` por tabela) e passou a ser a última linha do `<tbody>` de conteúdo de cada grupo, com o
mesmo formato de antes: `<td colSpan={5}>Subtotal do exemplo</td>` seguido de
`<td className="budget-worksheet-table__numeric">{group.subtotalDisplay}</td>` — mesma classe,
mesma coluna física da mesma tabela única, alinhamento garantido pela mesma estrutura que alinha
todas as outras colunas.

## CSS

- `.budget-worksheet-table__group-header-row th` substitui o antigo card com borda por grupo
  (`.budget-worksheet-group`/`[open]`) — agora uma linha de destaque dentro da própria tabela
  (fundo dourado sutil, borda superior separando grupos).
- `.budget-worksheet-group__summary` (agora um `<button>`, não mais um `<summary>`) preserva hover,
  foco visível e toda a área clicável.
- `.budget-worksheet-group__chevron--open` substitui o seletor `[open] .chevron` (não há mais
  atributo `open` nativo; o estado vem de uma classe condicional derivada do `useState` do React).
- Mobile: `<tfoot>` removido das regras (não existe mais); a linha de cabeçalho de grupo (`th`) e a
  linha de subtotal ganharam tratamento próprio para não herdar o estilo de "cartão de item"
  genérico (`tbody tr:not(.budget-worksheet-table__group-header-row)`).

## Testes

`budget-client-experience.test.ts` ganhou uma verificação estrutural direta: exatamente uma
`<table>` e um `<colgroup>` no componente (antes disso não ser testado explicitamente — só as
propriedades CSS eram testadas, que continuavam "corretas" mesmo com o bug real presente). Testes
de chevron/acessibilidade atualizados para `aria-expanded`/`aria-controls`/`<button>` em vez de
`<details>`/`onToggle`. 198/198 arquivos de teste passando.

## Validações

Typecheck, lint, build, `git diff --check` — limpos.

## Verificação local

Servidor reiniciado limpo. Confirmado via HTML server-renderizado: **exatamente 1 `<table>` e 1
`<colgroup>`** para toda a planilha (antes: 3 de cada, um por grupo) — a prova estrutural de que o
desalinhamento não pode mais ocorrer entre grupos, porque não existem mais grupos como tabelas
separadas. "Subtotal do exemplo" renderiza corretamente (só do grupo aberto), os três nomes de
grupo aparecem, sem erros no console/servidor. Verificação pixel a pixel real depende da captura de
tela do usuário — sem ferramenta de captura neste ambiente.

## Limitações conhecidas

Idênticas às Sprints anteriores: nenhuma leitura real de orçamento disponível, nenhum serviço de
simulação, saudação "Fernando" no Workspace Engenharia permanece um hardcode legado não corrigido
nesta Sprint (fora de escopo, já reportado na 21.4B.3).

## Próximo passo recomendado

Revisão visual real do usuário (captura de tela) confirmando que Unidade/Quantidade/Preço
unitário/Total agora alinham perfeitamente entre os três grupos.
