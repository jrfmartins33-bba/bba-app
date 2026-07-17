import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BUDGET_WORKSHEET_SAMPLE } from "@/lib/budget/budget-worksheet-sample-data";

/**
 * Epic 21, Sprint 21.4B.2 (planilha, composição) + 21.4B.3 (acabamento
 * comercial: grade fixa entre grupos, navegação real dos cards de ação,
 * âncoras, remoção de ruído redundante). Este repositório não tem
 * infraestrutura de render/DOM (nenhum jsdom/testing-library), e alguns
 * dos componentes usam hooks (`useState`) que só funcionam dentro do
 * ciclo real de render do React — por isso, mesmo padrão já usado em
 * measurement-imports-page.test.ts: checagem estática de código-fonte,
 * não invocação direta dos componentes. Dados puros (sem hooks/JSX) são
 * importados diretamente, como `BUDGET_WORKSHEET_SAMPLE` aqui. A lógica
 * de item ativo do menu (extraída para uma função pura testável) tem
 * teste próprio em workspace-subnav-active.test.ts.
 *
 * Comentários (`/* *\/`, `//`) são removidos antes de qualquer busca de
 * termo proibido, mesmo princípio de
 * apps/web/architecture/product-vocabulary-boundaries.test.ts — evita
 * falso positivo a partir da própria documentação interna do arquivo
 * (que cita nomes técnicos como referência para quem lê o código).
 */

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "..", "..", "..", "..");

const BUDGET_COMPONENT_FILES = [
  "budget-page-header.tsx",
  "budget-summary-strip.tsx",
  "budget-indicator-cards.tsx",
  "budget-hierarchy-strip.tsx",
  "budget-worksheet-section.tsx",
  "budget-comparison-section.tsx",
  "budget-journey-section.tsx",
  "budget-action-cards.tsx",
  "budget-next-decision-section.tsx",
  "budget-empty-state.tsx",
  "budget-error-state.tsx"
];

const PAGE_FILES = [
  join(repoRoot, "apps/web/app/(dashboard)/orcamentos/page.tsx"),
  join(repoRoot, "apps/web/app/(dashboard)/orcamentos/demonstracao/page.tsx")
];

const ERROR_BOUNDARY_FILE = join(repoRoot, "apps/web/app/(dashboard)/orcamentos/error.tsx");
const NAV_CONFIG_FILE = join(repoRoot, "apps/web/components/workspace-nav-config.ts");
const SIDEBAR_FILE = join(repoRoot, "apps/web/components/sidebar.tsx");
const ENGENHARIA_PAGE_FILE = join(repoRoot, "apps/web/app/(dashboard)/workspaces/engenharia/page.tsx");
const DEMO_DATA_FILE = join(repoRoot, "apps/web/lib/budget/budget-demonstration-data.ts");
const WORKSHEET_DATA_FILE = join(repoRoot, "apps/web/lib/budget/budget-worksheet-sample-data.ts");
const BBA_GLOBALS_CSS_FILE = join(repoRoot, "apps/web/app/bba-globals.css");

const componentSources = BUDGET_COMPONENT_FILES.map((file) => readFileSync(join(currentDir, file), "utf8"));
const pageSources = PAGE_FILES.map((file) => readFileSync(file, "utf8"));
const errorBoundarySource = readFileSync(ERROR_BOUNDARY_FILE, "utf8");
const navConfigSource = readFileSync(NAV_CONFIG_FILE, "utf8");
const sidebarSource = readFileSync(SIDEBAR_FILE, "utf8");
const engenhariaPageSource = readFileSync(ENGENHARIA_PAGE_FILE, "utf8");
const demoDataSource = readFileSync(DEMO_DATA_FILE, "utf8");
const worksheetDataSource = readFileSync(WORKSHEET_DATA_FILE, "utf8");
const bbaGlobalsCssSource = readFileSync(BBA_GLOBALS_CSS_FILE, "utf8");

const ALL_UI_SOURCE = [...componentSources, ...pageSources, errorBoundarySource].join("\n");

function sourceOf(file: string): string {
  const index = BUDGET_COMPONENT_FILES.indexOf(file);
  if (index === -1) {
    throw new Error(`unknown component file: ${file}`);
  }
  return componentSources[index];
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function extractBudgetCss(source: string): string {
  const marker = "Epic 21, Sprint 21.4B.2 — Orçamento";
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error("budget CSS section marker not found");
  }
  return source.slice(start);
}

function extractMobileBlock(css: string): string {
  const match = css.match(/@media \(max-width: 600px\) \{[\s\S]*/);
  if (match === null) {
    throw new Error("mobile @media block not found");
  }
  return match[0];
}

const budgetCss = extractBudgetCss(bbaGlobalsCssSource);
const mobileCss = extractMobileBlock(budgetCss);
const strippedBudgetCss = budgetCss.replace(/\/\*[\s\S]*?\*\//g, "");

const FORBIDDEN_TERMS = [
  // "BDOS" nomeia a plataforma internamente (PRINCIPLE 007,
  // apps/web/architecture/product-vocabulary-boundaries.test.ts) -- nunca
  // em texto voltado ao cliente. Incluído aqui também porque aquele guard
  // usa um padrão de texto JSX que não cruza quebra de linha dentro do
  // JSX (`[^<>{}\n]+`), então texto de múltiplas linhas escapa dele; esta
  // checagem, sobre o arquivo inteiro sem comentários, cobre esse caso.
  "BDOS",
  "BudgetVersion",
  "BudgetLine",
  "MoneyCents",
  "aggregate",
  "read model",
  "pipeline",
  "reconstruction",
  "tabular region",
  "alignment",
  "segment",
  "hypothesis",
  "fingerprint",
  "schema",
  "fixture",
  "adapter",
  "endpoint",
  "sourceCandidateGroupKey"
];

async function main(): Promise<void> {
  await runTest("título 'Orçamento da obra' e subtítulo comercial no cabeçalho", () => {
    const header = sourceOf("budget-page-header.tsx");
    assertTrue(header.includes("Orçamento da obra"), "cabeçalho deve exibir o título exato");
    assertTrue(
      header.includes("Entenda o orçamento oficial, compare a proposta e consulte como os itens estão organizados."),
      "cabeçalho deve exibir o subtítulo comercial atualizado"
    );
  });

  await runTest("badge 'Demonstração' aparece apenas quando isDemonstration é verdadeiro, nunca em tooltip", () => {
    const header = sourceOf("budget-page-header.tsx");
    assertTrue(header.includes("Demonstração"), "badge de demonstração deve existir");
    assertTrue(header.includes("isDemonstration ?"), "badge deve ser condicional a isDemonstration, nunca fixo");
    assertTrue(!header.includes("title="), "aviso de demonstração não pode ficar escondido em tooltip");
  });

  await runTest("Planilha orçamentária existe, com título e âncora reais", () => {
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    assertTrue(worksheet.includes("Planilha orçamentária"), "título visível da planilha");
    assertTrue(worksheet.includes('id="planilha-orcamentaria"'), "âncora real da planilha");
  });

  await runTest("1, 2 e 3. mesmo <colgroup> em toda tabela, seis colunas, table-layout: fixed", () => {
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    assertTrue(worksheet.includes("function BudgetWorksheetColgroup"), "colgroup deve vir de uma única função, nunca copiado por arquivo");
    const colgroupMatches = worksheet.match(/<BudgetWorksheetColgroup \/>/g) ?? [];
    assertTrue(colgroupMatches.length === 1, "colgroup deve ser referenciado uma única vez na função de tabela, reaproveitada por grupo");
    const widths = [...worksheet.matchAll(/<col style=\{\{ width: "(\d+)%" \}\} \/>/g)].map((match) => Number(match[1]));
    assertEqual(widths, [9, 33, 10, 12, 18, 18]);
    assertEqual(
      widths.reduce((total, width) => total + width, 0),
      100
    );
    assertTrue(
      /\.budget-worksheet-table\s*\{[^}]*table-layout:\s*fixed/.test(strippedBudgetCss),
      "table-layout: fixed ausente na regra da tabela"
    );
  });

  await runTest("4, 5 e 6. alinhamento das seis colunas (cabeçalhos e células)", () => {
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    ["Código", "Item de serviço", "Unidade", "Quantidade", "Preço unitário", "Total"].forEach((column) => {
      assertTrue(worksheet.includes(column), `coluna ausente: ${column}`);
    });
    ["Quantidade", "Preço unitário", "Total"].forEach((column) => {
      const headerPattern = new RegExp(`className="budget-worksheet-table__numeric" scope="col"[\\s\\S]{0,20}${column}`);
      assertTrue(headerPattern.test(worksheet), `cabeçalho numérico "${column}" deve usar a classe alinhada à direita`);
    });
    assertTrue(/className="budget-worksheet-table__unit" data-label="Unidade"/.test(worksheet), "célula de unidade deve usar a classe centralizada");
    assertTrue(
      /\.budget-worksheet-table__numeric\s*\{[^}]*text-align:\s*right/.test(strippedBudgetCss),
      "colunas numéricas devem estar alinhadas à direita"
    );
    assertTrue(
      /\.budget-worksheet-table__unit\s*\{[^}]*text-align:\s*center/.test(strippedBudgetCss),
      "coluna de unidade deve estar centralizada"
    );
    assertTrue(
      /\.budget-worksheet-table\s*\{[^}]*font-variant-numeric:\s*tabular-nums/.test(strippedBudgetCss),
      "valores numéricos devem usar fonte tabular"
    );
    assertTrue(
      /\.budget-worksheet-table__description\s*\{[^}]*overflow-wrap:\s*anywhere/.test(strippedBudgetCss),
      "descrição deve poder quebrar sem cortar"
    );
  });

  await runTest("7, 8 e 9. subtotal em <tfoot>, alinhado à sexta coluna, com versão móvel", () => {
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    assertTrue(worksheet.includes("<tfoot>"), "subtotal deve estar em <tfoot>, não em parágrafo externo");
    assertTrue(worksheet.includes("Subtotal do exemplo"), "rótulo exato preservado, nunca apenas 'Subtotal'");
    assertTrue(!worksheet.includes(">Subtotal<"), "não deve usar apenas 'Subtotal' isolado");
    assertTrue(/colSpan=\{5\}[\s\S]{0,40}Subtotal do exemplo/.test(worksheet), "rótulo deve ocupar as cinco primeiras colunas");
    assertTrue(
      /<td className="budget-worksheet-table__numeric">\{group\.subtotalDisplay\}<\/td>/.test(worksheet),
      "valor do subtotal deve ocupar a sexta coluna, alinhado como Total"
    );
    assertTrue(mobileCss.includes("budget-worksheet-table__subtotal-row"), "versão móvel do <tfoot> deve existir");
  });

  await runTest("não existe mais subtotal externo desalinhado (parágrafo fora da tabela)", () => {
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    assertTrue(!worksheet.includes("budget-worksheet-group__subtotal"), "subtotal não deve mais viver fora da tabela");
  });

  await runTest("10. nenhuma rolagem horizontal obrigatória", () => {
    assertTrue(!/overflow-x:\s*scroll/i.test(ALL_UI_SOURCE + budgetCss), "não deve forçar rolagem horizontal");
  });

  await runTest("11 e 12. '9 itens de exemplo em 3 grupos' derivado da fonte sintética, nunca literal duplicado", () => {
    assertEqual(BUDGET_WORKSHEET_SAMPLE.groups.length, 3);
    const totalItems = BUDGET_WORKSHEET_SAMPLE.groups.reduce((total, group) => total + group.items.length, 0);
    assertEqual(totalItems, 9);
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    assertTrue(worksheet.includes("{totalItems} itens de exemplo em {sample.groups.length} grupos"), "contagem deve ser calculada a partir da amostra, nunca um literal");
    assertTrue(!worksheet.includes('"9 itens de exemplo em 3 grupos"'), "a frase inteira não deve ser um literal fixo no componente");
  });

  await runTest("13 e 14. unidade 'vb' não aparece na amostra visual; 'verba' aparece no lugar", () => {
    assertTrue(!/"vb"/.test(worksheetDataSource), "'vb' não deve mais existir como unidade na amostra");
    assertTrue(worksheetDataSource.includes('"verba"'), "'verba' deve substituir 'vb'");
    ["m³", "m²", "kg"].forEach((unit) => {
      assertTrue(worksheetDataSource.includes(`"${unit}"`), `unidade preservada ausente: ${unit}`);
    });
  });

  await runTest("6, 7 e 8 (contagem geral). amostra sintética tem exatamente 3 grupos, 8 a 10 itens, sourceKind correto", () => {
    const allItems = BUDGET_WORKSHEET_SAMPLE.groups.flatMap((group) => group.items);
    assertTrue(allItems.length >= 8 && allItems.length <= 10, "entre 8 e 10 itens sintéticos");
    allItems.forEach((item) => {
      assertTrue(item.sourceKind === "synthetic_visual_example", `item ${item.code} com sourceKind incorreto`);
    });
  });

  await runTest("15. primeiro grupo começa aberto, os demais recolhidos (controlado por React)", () => {
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    assertTrue(worksheet.includes("defaultOpen={index === 0}"), "só o primeiro grupo (index 0) começa aberto");
    assertTrue(worksheet.includes("useState(defaultOpen)"), "estado de abertura controlado por React, não recomputado a cada render");
    assertTrue(worksheet.includes("onToggle=") && worksheet.includes("open={open}"), "details deve ser controlado (nunca perde o estado do usuário em re-render)");
  });

  await runTest("16. chevron real (ChevronDown), decorativo, com foco visível e rotação ao abrir", () => {
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    assertTrue(worksheet.includes('import { ChevronDown } from "lucide-react"'), "deve usar o ícone real ChevronDown");
    assertTrue(/<ChevronDown\s[^>]*aria-hidden="true"[^>]*className="budget-worksheet-group__chevron"/.test(worksheet), "chevron deve ser decorativo (aria-hidden)");
    assertTrue(
      /\.budget-worksheet-group__summary:focus-visible\s*\{/.test(strippedBudgetCss),
      "foco de teclado do cabeçalho do grupo deve ficar visível"
    );
    assertTrue(
      /\.budget-worksheet-group__summary:hover\s*\{/.test(strippedBudgetCss),
      "estado de hover do cabeçalho do grupo deve existir"
    );
    assertTrue(
      /\.budget-worksheet-group\[open\] \.budget-worksheet-group__chevron\s*\{[^}]*rotate\(180deg\)/.test(strippedBudgetCss),
      "chevron deve rotacionar quando o grupo estiver aberto"
    );
  });

  await runTest("17. botão 'Abrir planilha' navega para #planilha-orcamentaria", () => {
    const actionCards = sourceOf("budget-action-cards.tsx");
    assertTrue(actionCards.includes("Abrir planilha"), "texto do botão");
    assertTrue(/href="#planilha-orcamentaria">\s*Abrir planilha/.test(actionCards), "botão deve apontar para a planilha");
  });

  await runTest("18 e 19. botão 'Ver comparação' navega para #comparacao, âncora real com scroll-margin-top", () => {
    const actionCards = sourceOf("budget-action-cards.tsx");
    assertTrue(actionCards.includes("Ver comparação"), "texto do botão");
    assertTrue(/href="#comparacao">\s*Ver comparação/.test(actionCards), "botão deve apontar para a comparação");
    const comparison = sourceOf("budget-comparison-section.tsx");
    assertTrue(comparison.includes('id="comparacao"'), "seção de comparação deve expor a âncora real");
    assertTrue(strippedBudgetCss.includes("#comparacao"), "scroll-margin-top deve cobrir a âncora #comparacao");
  });

  await runTest("badge 'Em breve' no card de simulação, sem linguagem de implementação", () => {
    const actionCards = sourceOf("budget-action-cards.tsx");
    assertTrue(actionCards.includes(">Em breve<"), "badge deve ser 'Em breve'");
    assertTrue(
      actionCards.includes("A simulação de novos cenários será disponibilizada em uma próxima etapa."),
      "texto recomendado, sem mencionar serviço de cálculo dedicado"
    );
    const strippedActionCards = stripComments(actionCards).toLowerCase();
    ["endpoint", "cálculo dedicado", "backend", "implementação"].forEach((forbidden) => {
      assertTrue(!strippedActionCards.includes(forbidden.toLowerCase()), `card de simulação não deve mencionar "${forbidden}" fora de comentário`);
    });
    assertTrue(!/\bserviço\b/.test(strippedActionCards), "card de simulação não deve mencionar 'serviço' no texto visível ao cliente");
  });

  await runTest("cards de ação usam rodapé fixo (margin-top: auto), não padding vazio, para altura equilibrada", () => {
    const actionCards = stripComments(sourceOf("budget-action-cards.tsx"));
    assertTrue((actionCards.match(/budget-action-card__footer/g) ?? []).length === 2, "os dois cards funcionais devem usar o rodapé dedicado");
    assertTrue(
      /\.budget-action-card__footer\s*\{[^}]*margin-top:\s*auto/.test(strippedBudgetCss),
      "rodapé do card deve usar margin-top: auto para ficar no fim do card"
    );
  });

  await runTest("20. legenda redundante da comparação foi removida", () => {
    const comparison = sourceOf("budget-comparison-section.tsx");
    assertTrue(!comparison.includes("budget-comparison__legend"), "lista de legenda não deve mais existir");
    assertTrue(comparison.includes("Orçamento oficial") && comparison.includes("Valor da proposta"), "rótulos ao lado das barras continuam obrigatórios");
    assertTrue(comparison.includes("Diferença:") && comparison.includes("Redução:"), "diferença e redução continuam presentes");
  });

  await runTest("21. 'Comparação demonstrativa.' foi removida do resumo, sem substituto", () => {
    assertTrue(!stripComments(ALL_UI_SOURCE).includes("Comparação demonstrativa."), "linha isolada não deve mais existir");
    const summary = sourceOf("budget-summary-strip.tsx");
    assertTrue(
      summary.includes("A proposta está") && summary.includes("abaixo do orçamento oficial"),
      "resumo deve manter só a frase de comparação"
    );
  });

  await runTest("22, 23 e 24. bloco final renomeado para 'Próximo passo', faixa horizontal no desktop e empilhada no celular", () => {
    const nextDecision = sourceOf("budget-next-decision-section.tsx");
    assertTrue(nextDecision.includes('title="Próximo passo"'), "título deve ser 'Próximo passo'");
    assertTrue(!nextDecision.includes("Próxima decisão"), "título antigo não deve mais existir");
    assertTrue(nextDecision.includes("Revisar planilha"), "ação principal deve ser 'Revisar planilha'");
    assertTrue(/href="#planilha-orcamentaria">\s*Revisar planilha/.test(nextDecision), "ação principal deve apontar para a planilha");
    assertTrue(nextDecision.includes("Voltar ao Workspace Engenharia"), "ação secundária preservada");
    assertTrue(
      /\.budget-next-decision__row\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between/.test(strippedBudgetCss),
      "faixa final deve ser horizontal no desktop, com título/texto à esquerda e botões à direita"
    );
    assertTrue(
      /\.budget-next-decision__row\s*\{[^}]*flex-direction:\s*column/.test(mobileCss.replace(/\/\*[\s\S]*?\*\//g, "")),
      "faixa final deve empilhar no celular"
    );
    const nextDecisionCssBlocks = strippedBudgetCss.match(/\.budget-next-decision[^{]*\{[^}]*\}/g) ?? [];
    assertTrue(nextDecisionCssBlocks.length > 0, "deve existir ao menos uma regra .budget-next-decision*");
    nextDecisionCssBlocks.forEach((block) => {
      assertTrue(!/(?<!min-)height:/.test(block), `bloco final não deve usar altura fixa: ${block}`);
    });
  });

  await runTest("25 e 26. item Orçamento ativo em rotas filhas de /orcamentos, sem regressão em outras capacidades", () => {
    assertTrue(sidebarSource.includes("isWorkspaceSubNavItemActive"), "sidebar deve usar a função pura corrigida, não igualdade exata crua");
    assertTrue(!/const itemActive = pathname === item\.href$/m.test(sidebarSource), "não deve mais existir a comparação ingênua por igualdade exata");
  });

  await runTest("27. card do Workspace leva diretamente à demonstração ('Ver orçamento')", () => {
    assertTrue(engenhariaPageSource.includes('id: "orcamento"'), "card de capacidade Orçamento deve existir");
    assertTrue(
      engenhariaPageSource.includes("Veja o orçamento oficial, a proposta e como os itens são organizados para análise."),
      "descrição atualizada do card de Orçamento"
    );
    assertTrue(engenhariaPageSource.includes('actionLabel: "Ver orçamento"'), "ação do card deve ser 'Ver orçamento'");
    assertTrue(engenhariaPageSource.includes('href: "/orcamentos/demonstracao"'), "card deve linkar diretamente para a demonstração");
    assertTrue(engenhariaPageSource.includes('status: "Demonstração disponível"'), "status do card deve permanecer 'Demonstração disponível'");
    assertTrue(
      /label:\s*"Orçamento",\s*icon:\s*Wallet,\s*href:\s*"\/orcamentos"/.test(navConfigSource),
      "menu contextual do Workspace deve continuar apontando para /orcamentos"
    );
  });

  await runTest("28. fronteira de erro decide o badge pela rota atual (usePathname), nunca fixo", () => {
    assertTrue(errorBoundarySource.includes("usePathname"), "error.tsx deve usar usePathname para decidir o cabeçalho");
    assertTrue(
      errorBoundarySource.includes('pathname === "/orcamentos/demonstracao"'),
      "badge de demonstração só aparece na rota de demonstração"
    );
    assertTrue(errorBoundarySource.includes('"use client"'), "error.tsx deve ser Client Component");
    assertTrue(errorBoundarySource.includes("onRetry={reset}"), "reset deve ser passado como ação de nova tentativa");
    assertTrue(
      !/\{error\.(message|digest|stack)\}|error\.toString\(\)/.test(errorBoundarySource),
      "error.tsx nunca deve renderizar a mensagem bruta do erro"
    );
    assertTrue(
      !/console\.(log|error|warn|info)\(/.test(errorBoundarySource),
      "error.tsx não deve registrar dado do erro no console do navegador"
    );
  });

  await runTest("nova ordem obrigatória completa da página de demonstração (planilha antes da comparação e das etapas)", () => {
    const demoPage = pageSources[1];
    const order = [
      "BudgetSummaryStrip",
      "BudgetIndicatorCards",
      "BudgetHierarchyStrip",
      "BudgetWorksheetSection",
      "BudgetComparisonSection",
      "BudgetJourneySection",
      "BudgetActionCards",
      "BudgetNextDecisionSection"
    ];
    const positions = order.map((name) => demoPage.indexOf(name));
    positions.forEach((position, index) => {
      assertTrue(position !== -1, `${order[index]} deve estar presente na página`);
    });
    for (let i = 1; i < positions.length; i += 1) {
      assertTrue(positions[i - 1] < positions[i], `${order[i - 1]} deve vir antes de ${order[i]}`);
    }
  });

  await runTest("orçamento oficial, proposta, redução, diferença e hierarquia aparecem na fonte de demonstração", () => {
    assertTrue(demoDataSource.includes("R$ 9.809.087,18"), "orçamento oficial confirmado");
    assertTrue(demoDataSource.includes("R$ 7.611.851,65"), "proposta confirmada");
    assertTrue(demoDataSource.includes("22,40%"), "redução confirmada");
    assertTrue(demoDataSource.includes("R$ 2.197.235,53"), "diferença confirmada");
    assertTrue(demoDataSource.includes("groupCount: 11"), "11 grupos confirmados");
    assertTrue(demoDataSource.includes("subgroupCount: 25"), "25 subgrupos confirmados");
    assertTrue(demoDataSource.includes("serviceItemCount: 300"), "300 itens de serviço confirmados");
  });

  await runTest("fonte demonstrativa nunca é apresentada como importação/leitura automática do PDF", () => {
    const combined = `${demoDataSource}\n${ALL_UI_SOURCE}`;
    assertTrue(
      !/import(ad[oa])? automaticamente|leitura autom[aá]tica do pdf|extra[íi]do (automaticamente )?do pdf/i.test(combined),
      "não deve alegar leitura automática do PDF para dados demonstrativos"
    );
  });

  await runTest("nome do cliente/obra/órgão real não aparece na experiência de Orçamento (nem na amostra sintética)", () => {
    const combinedLower = stripComments(`${ALL_UI_SOURCE}\n${demoDataSource}\n${worksheetDataSource}`).toLowerCase();
    assertTrue(!combinedLower.includes("lagoa do arroz"), "não deve citar o nome do projeto real");
    assertTrue(!combinedLower.includes("dnocs"), "não deve citar o nome do órgão real");
    assertTrue(!combinedLower.includes("2f engenharia"), "não deve citar o nome do cliente real");
  });

  await runTest("nenhum termo técnico proibido pelo vocabulário aparece (fora de comentários)", () => {
    const strippedUi = stripComments(ALL_UI_SOURCE);
    const strippedData = stripComments(`${demoDataSource}\n${worksheetDataSource}`);
    const combined = `${strippedUi}\n${strippedData}`;
    FORBIDDEN_TERMS.forEach((term) => {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      assertTrue(!pattern.test(combined), `termo técnico proibido encontrado fora de comentário: "${term}"`);
    });
  });

  await runTest("nenhum cálculo monetário nos componentes (nem nos novos: resumo, faixa, planilha, etapas, ações)", () => {
    componentSources.forEach((source, index) => {
      const file = BUDGET_COMPONENT_FILES[index];
      assertTrue(!/\.cents\s*[*/]|cents\s*[*/]\s*\d/.test(source), `${file} não deve operar aritmeticamente sobre centavos`);
      assertTrue(!/toFixed|parseFloat\(/i.test(source), `${file} não deve formatar/calcular moeda em runtime`);
      assertTrue(!/quantity\s*\*|unitPriceCents\s*\*/.test(source), `${file} não deve recalcular total a partir de quantidade × preço`);
    });
  });

  await runTest("existem apenas três cards de indicadores principais", () => {
    const indicators = sourceOf("budget-indicator-cards.tsx");
    ["oficial", "proposta", "reducao"].forEach((id) => {
      assertTrue(indicators.includes(`id: "${id}"`), `indicador ausente: ${id}`);
    });
    ["grupos", "subgrupos", "itens"].forEach((id) => {
      assertTrue(!indicators.includes(`id: "${id}"`), `indicador de contagem não deve mais estar entre os cards grandes: ${id}`);
    });
  });

  await runTest("11/25/300 aparecem em faixa compacta, não em cards adicionais", () => {
    const strip = sourceOf("budget-hierarchy-strip.tsx");
    assertTrue(strip.includes("groupCount") && strip.includes("subgroupCount") && strip.includes("serviceItemCount"), "faixa deve exibir as três contagens");
    assertTrue(!strip.includes('from "@bba/ui"'), "faixa não deve usar o componente Card (não pode parecer mais três cards)");
  });

  await runTest("vocabulário antigo das etapas continua removido, novo vocabulário presente", () => {
    const stripped = stripComments(ALL_UI_SOURCE);
    assertTrue(!stripped.includes("Exige confirmação humana"), "'Exige confirmação humana' não pode existir");
    assertTrue(!stripped.includes("Demonstrado"), "'Demonstrado' não pode existir como rótulo de etapa");
    assertTrue(!stripped.includes("Etapa futura"), "'Etapa futura' não pode existir");
    assertTrue(!/\bhumana\b/i.test(stripped), "a palavra isolada 'humana' não pode aparecer em nenhum ponto da experiência");
    const journey = sourceOf("budget-journey-section.tsx");
    assertTrue(journey.includes("Aguardando revisão") && journey.includes("Disponível") && journey.includes("Próxima etapa"), "novo vocabulário deve estar presente");
    assertTrue(journey.includes('title="Etapas do orçamento"'), "bloco deve se chamar 'Etapas do orçamento'");
  });

  await runTest("etapas usam grade de 5 colunas no desktop, coluna única no celular", () => {
    assertTrue(
      /\.budget-journey\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/.test(strippedBudgetCss),
      "grade de 5 colunas ausente"
    );
    assertTrue(/\.budget-journey\s*\{[^}]*grid-template-columns:\s*1fr/.test(mobileCss.replace(/\/\*[\s\S]*?\*\//g, "")), "etapas devem virar coluna única no celular");
    assertTrue(mobileCss.includes(".budget-journey::before"), "conector horizontal deve ser removido/escondido no celular");
  });

  await runTest("nenhum min-height artificial em nenhuma regra de Orçamento", () => {
    assertTrue(!strippedBudgetCss.includes("min-height"), "nenhuma regra de Orçamento deve usar min-height fixo (fora de comentário)");
  });

  await runTest("existe representação móvel da planilha (mesma fonte de dados, sem duplicar valores)", () => {
    assertTrue(mobileCss.includes(".budget-worksheet-table"), "regra mobile da planilha deve existir");
    assertTrue(mobileCss.includes("thead"), "cabeçalho da tabela deve ser escondido no celular");
    assertTrue(mobileCss.includes("attr(data-label)"), "rótulo de cada valor deve vir do próprio data-label, nunca duplicado manualmente");
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    assertTrue((worksheet.match(/data-label=/g) ?? []).length >= 6, "cada célula da tabela deve ter data-label para o layout de celular");
  });

  await runTest("estado vazio ('Nenhum orçamento real disponível') não promete envio/seleção indisponíveis", () => {
    const emptyState = sourceOf("budget-empty-state.tsx");
    assertTrue(emptyState.includes("Nenhum orçamento real disponível"), "título do estado vazio corrigido");
    assertTrue(
      !/envie ou selecione|selecionar um orçamento|enviar um orçamento/i.test(emptyState),
      "estado vazio não deve prometer envio ou seleção -- ações que ainda não existem nesta Sprint"
    );
    assertTrue(emptyState.includes("Ver demonstração"), "ação real para abrir a demonstração");
  });

  await runTest("estado de erro controlado, sem detalhe técnico", () => {
    const errorState = sourceOf("budget-error-state.tsx");
    assertTrue(errorState.includes("Não foi possível abrir o orçamento"), "título do estado de erro");
    assertTrue(errorState.includes("Tentar novamente"), "ação de retry");
    assertTrue(!/stack|sql|exception|errno|traceback/i.test(stripComments(errorState)), "estado de erro não deve expor detalhe técnico");
  });

  await runTest("rota /orcamentos usa o estado vazio real (nenhuma leitura de orçamento real ainda existe)", () => {
    const orcamentosPage = pageSources[0];
    assertTrue(orcamentosPage.includes("BudgetEmptyState"), "página /orcamentos deve usar o estado vazio real");
    assertTrue(
      !/getSupabaseRouteHandlerClient|from ["']@supabase/i.test(orcamentosPage),
      "página não deve acessar Supabase diretamente (nenhuma leitura real está wired nesta Sprint)"
    );
  });

  await runTest("dados demonstrativos e sintéticos não são persistidos (nenhum acesso a banco/insert)", () => {
    const combined = `${ALL_UI_SOURCE}\n${demoDataSource}\n${worksheetDataSource}\n${sidebarSource}`;
    assertTrue(
      !/supabase|\.insert\(|INSERT INTO|createServerClient|getSupabaseRouteHandlerClient/i.test(combined),
      "nenhum caminho de persistência deve existir para os dados de demonstração ou da amostra sintética"
    );
  });

  await runTest("cada página exporta um componente de rota válido (Server Component fino)", () => {
    pageSources.forEach((source, index) => {
      assertTrue(source.includes("export default function"), `${PAGE_FILES[index]} deve exportar um componente de página`);
    });
  });
}

async function runTest(name: string, testCase: () => void): Promise<void> {
  testCase();
  console.log(`ok - ${name}`);
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
