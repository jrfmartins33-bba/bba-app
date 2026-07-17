# Epic 21, Sprint 21.4B.3 — Acabamento Comercial e Precisão Visual da Experiência de Orçamento

## Contexto

A Sprint 21.4B.2 corrigiu os problemas estruturais mais graves (planilha como elemento principal,
indicadores reduzidos, etapas horizontais). A revisão visual confirmou evolução significativa, mas
identificou um bloqueio de precisão visual: **as colunas Quantidade, Preço unitário e Total mudavam
de posição entre os grupos da planilha**, porque cada grupo renderiza uma `<table>` independente e o
navegador recalcula a largura das colunas a partir do próprio conteúdo de cada tabela — um problema
de grade, não de `text-align`.

## Estratégia de grade fixa

`apps/web/components/budget/budget-worksheet-section.tsx` ganhou uma função interna,
`BudgetWorksheetColgroup`, chamada uma única vez por grupo dentro da mesma função que renderiza a
tabela — nunca copiada manualmente entre arquivos. O `<colgroup>` define as seis colunas com
proporções fixas (Código 9% / Item de serviço 33% / Unidade 10% / Quantidade 12% / Preço unitário
18% / Total 18%, soma 100%), e `table-layout: fixed` em `.budget-worksheet-table` faz o navegador
respeitar essas proporções em vez de recalculá-las a partir do conteúdo — é isso, não o
`text-align` isolado, que mantém as três tabelas dos três grupos alinhadas verticalmente entre si.

## Alinhamento das seis colunas

Código e Item de serviço à esquerda (padrão), Unidade centralizada
(`.budget-worksheet-table__unit`), Quantidade/Preço unitário/Total à direita
(`.budget-worksheet-table__numeric`), com `font-variant-numeric: tabular-nums` para os números e
`white-space: nowrap` nas colunas de unidade/quantidade/preço/total para nunca quebrar um valor no
meio. A descrição do item usa `overflow-wrap: anywhere` para quebrar sem cortar.

## Subtotal em `<tfoot>`

O subtotal deixou de ser um parágrafo externo desalinhado e virou uma linha real de `<tfoot>`
dentro da própria tabela: `<td colSpan={5}>Subtotal do exemplo</td>` seguido de
`<td className="budget-worksheet-table__numeric">{group.subtotalDisplay}</td>` — o valor ocupa
exatamente a mesma coluna (mesma classe) que a coluna Total, garantindo alinhamento estrutural, não
visual por coincidência. O rótulo permanece "Subtotal do exemplo" (nunca apenas "Subtotal"), para
não confundir com um total real.

## Comportamento móvel

A adaptação de tabela para cartão (CSS puro, `data-label`) foi preservada e estendida ao `<tfoot>`:
`table-layout`/`<colgroup>` são automaticamente ignorados pelo navegador assim que a tabela deixa de
ser `display: table`, e a linha de subtotal ganhou uma regra própria
(`.budget-worksheet-table__subtotal-row`, com especificidade composta
`.budget-worksheet-table .budget-worksheet-table__subtotal-row` para vencer a regra genérica de
linha) que a apresenta como uma faixa compacta de resumo — visualmente distinta dos cartões de
item, sem o prefixo `data-label` (o rótulo já está no próprio texto da célula). Nenhum dado foi
duplicado em uma segunda estrutura React.

## Contagem da amostra

"9 itens de exemplo em 3 grupos" aparece logo abaixo da descrição da planilha, calculado em runtime
a partir de `sample.groups.length`/`sample.groups.flatMap(...).length` — nunca um literal
duplicado no componente. O aviso "Os itens e valores desta amostra são sintéticos..." permanece
preservado, sem qualquer associação numérica com os 300 itens do resumo.

## `vb` → `verba`

A unidade abreviada `vb` (dois itens de "Serviços preliminares") foi substituída por `verba` na
amostra sintética — alteração isolada em `budget-worksheet-sample-data.ts`, sem tocar contratos
reais de domínio nem criar tradução global. `m³`/`m²`/`kg` permanecem inalterados.

## Expansão dos grupos

`<details>`/`<summary>` nativo preservado (nenhuma reimplementação via componente controlado
complexo). Melhorias visuais: ícone real `ChevronDown` (decorativo, `aria-hidden="true"`, rotaciona
via `.budget-worksheet-group[open] .budget-worksheet-group__chevron`), toda a área do cabeçalho
clicável, estado de hover (`:hover`), foco de teclado visível (`:focus-visible`) e um leve destaque
de fundo/borda quando o grupo está aberto. Primeiro grupo aberto, demais recolhidos — inalterado.

## Cards de ação viram navegação real

"Revisar o orçamento" → botão **Abrir planilha** (`#planilha-orcamentaria`); "Comparar a proposta" →
botão **Ver comparação** (`#comparacao`, âncora restaurada com `scroll-margin-top`). O botão fica no
rodapé do card via `.budget-action-card__footer { margin-top: auto; }`, aproveitando que
`.workspace-card` já é uma coluna flex esticada à altura da linha da grade — sem padding vazio.
"Simular outro cenário" permanece honestamente indisponível: badge renomeado de "Próximo passo"
para **Em breve**, texto sem mencionar serviço/endpoint/cálculo dedicado/backend/implementação.

## Comparação: menos ruído

A legenda de quadrados coloridos (`Orçamento oficial`/`Valor da proposta` repetidos) foi removida —
os mesmos rótulos já vivem ao lado de cada barra, com o valor. A leitura continua não dependendo só
de cor. A linha isolada "Comparação demonstrativa." também saiu do resumo compacto — a honestidade
da demonstração já está coberta pelo badge do cabeçalho, pelo aviso do cabeçalho, pelo badge
"Exemplo visual" da planilha e pelo aviso dos itens sintéticos; um quinto aviso era repetição, não
reforço.

## Bloco final: "Próximo passo"

Renomeado de "Próxima decisão". No desktop, virou faixa horizontal (`.budget-next-decision__row`,
`display: flex; justify-content: space-between`) com texto à esquerda e botões à direita, alinhamento
vertical central, sem altura fixa. No celular, empilha em coluna. Ações: **Revisar planilha**
(`#planilha-orcamentaria`) e **Voltar ao Workspace Engenharia**.

## Item ativo no menu lateral

`apps/web/components/sidebar.tsx` usava igualdade exata (`pathname === item.href`) para decidir o
item ativo do menu contextual de um Workspace — por isso "Orçamento" nunca acendia em
`/orcamentos/demonstracao`. A lógica foi extraída para uma função pura e testável,
`isWorkspaceSubNavItemActive` (`apps/web/components/workspace-subnav-active.ts`): ativo na própria
rota **ou** em qualquer rota que comece por `href + "/"` — nunca um `startsWith` cru sobre o `href`
(que ativaria "/orcamentos" também em uma rota não relacionada como "/orcamento-extra"). A mesma
correção beneficia qualquer outro item de sub-navegação com rotas filhas (ex.: Medições), sem
alterar o comportamento de itens sem rota filha.

## Auditoria restrita de identidade

Buscando apenas dentro dos arquivos da experiência de Orçamento e do Workspace Engenharia:

- **Nenhum hardcode de nome pessoal ou de cliente** foi encontrado nos componentes/dados do
  Orçamento (`apps/web/components/budget/*`, `apps/web/lib/budget/*`).
- **Achado (hardcode legado, pré-existente, fora deste commit)**:
  `apps/web/app/(dashboard)/workspaces/engenharia/page.tsx` contém a saudação `"Bom dia,
  Fernando."` (linha ~183) e `"Fernando, preparei este Workspace..."` (linha ~245) — texto fixo,
  não vinculado à sessão autenticada. Confirmado que o nome exibido na Sidebar (`userName`,
  ex.: "Carlos Mendes" na captura da revisão) vem de `profile.full_name`/`profile.email` reais
  (`apps/web/components/bba-dashboard-shell.tsx:55`), então a saudação hardcoded genuinamente
  diverge do usuário autenticado. Classificação: **hardcode legado / pendência**. Não foi
  alterado nesta Sprint — corrigir a saudação exigiria conectar aquele componente ao perfil
  autenticado, uma mudança fora do escopo declarado (item 13 do brief) e que merece sua própria
  revisão, não uma correção incidental dentro do commit de Orçamento.
- O contexto do projeto ativo (Barragem Lagoa do Arroz, 2F Engenharia, DNOCS) é consistente ao
  longo de toda a jornada — não há um projeto diferente aparecendo misturado.

## Fora de escopo (preservado)

Nada do item 13 do brief foi iniciado: sem ocultação global de menu, sem tradução geral de
Workspaces/Dashboard/Studios, sem alteração de identidade visual, sem simulação de desconto, sem
integração com orçamento real, sem leitura de PDF, sem nova persistência/migration, sem IA, sem
exportação, sem novo cálculo econômico.

## Testes

- `apps/web/components/workspace-subnav-active.test.ts` (novo) — 8 casos cobrindo o item ativo
  corrigido, incluindo ausência de falso positivo e ausência de regressão em Medições.
- `apps/web/components/budget/budget-client-experience.test.ts` — reescrito, cobrindo os 28 itens
  do checklist da Sprint (colgroup idêntico, seis colunas, `table-layout: fixed`, alinhamento,
  `<tfoot>`, versão móvel do subtotal, contagem derivada da amostra, `vb`→`verba`, chevron/foco,
  botões reais dos cards de ação, âncora `#comparacao`, remoção da legenda e do aviso redundante,
  "Próximo passo" horizontal/empilhado, item ativo no menu, guardas de vocabulário/persistência).

## Validações

Typecheck, lint, build e `git diff --check` limpos. `pnpm test`: **198/198 arquivos passando**,
incluindo os guardas de arquitetura/vocabulário existentes.

## Verificação local

Servidor reiniciado limpo (`.next` removido antes de subir, para não colidir com o build de
produção rodado durante a validação). Confirmado via HTML server-renderizado: `<colgroup>` com as
mesmas larguras nas três tabelas dos três grupos, `<tfoot>` presente, "9 itens de exemplo em 3
grupos" renderizado (os marcadores `<!-- -->` ao redor dos números no HTML bruto são comentários de
hidratação do React, invisíveis ao usuário final), "verba" presente e "vb" ausente, botões "Abrir
planilha"/"Ver comparação"/"Revisar planilha" e badge "Em breve" presentes, "Ver orçamento" no card
do Workspace Engenharia. Sem erros no console/servidor. Verificação pixel a pixel não foi feita —
ferramenta de captura de tela indisponível neste ambiente; a revisão visual final é do usuário.

## Limitações conhecidas

- A saudação "Fernando" no Workspace Engenharia permanece divergente do usuário autenticado
  (achado registrado acima, não corrigido por estar fora do escopo declarado desta Sprint).
- Nenhuma leitura real de orçamento está disponível ainda — `/orcamentos` continua mostrando o
  estado vazio real.
- Nenhum serviço de simulação/transformação de desconto existe — o card correspondente permanece
  honestamente indisponível.

## Próximo passo recomendado

Revisão visual do usuário em desktop e celular a partir de
`http://localhost:3000/orcamentos/demonstracao`, com atenção especial ao alinhamento das colunas
entre os três grupos. Se aprovado, decidir separadamente se/quando corrigir a saudação hardcoded do
Workspace Engenharia (fora deste commit).
