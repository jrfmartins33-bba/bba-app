import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BUDGET_WORKSHEET_SAMPLE } from "@/lib/budget/budget-worksheet-sample-data";

/**
 * Epic 21, Sprint 21.4B.2 — planilha orçamentária e composição visual
 * profissional. Este repositório não tem infraestrutura de render/DOM
 * (nenhum jsdom/testing-library), e alguns dos componentes usam hooks
 * (`useState`) que só funcionam dentro do ciclo real de render do React
 * — por isso, mesmo padrão já usado em measurement-imports-page.test.ts:
 * checagem estática de código-fonte, não invocação direta dos
 * componentes. Dados puros (sem hooks/JSX) são importados diretamente,
 * como `BUDGET_WORKSHEET_SAMPLE` aqui.
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
const ENGENHARIA_PAGE_FILE = join(repoRoot, "apps/web/app/(dashboard)/workspaces/engenharia/page.tsx");
const DEMO_DATA_FILE = join(repoRoot, "apps/web/lib/budget/budget-demonstration-data.ts");
const WORKSHEET_DATA_FILE = join(repoRoot, "apps/web/lib/budget/budget-worksheet-sample-data.ts");
const BBA_GLOBALS_CSS_FILE = join(repoRoot, "apps/web/app/bba-globals.css");

const componentSources = BUDGET_COMPONENT_FILES.map((file) => readFileSync(join(currentDir, file), "utf8"));
const pageSources = PAGE_FILES.map((file) => readFileSync(file, "utf8"));
const errorBoundarySource = readFileSync(ERROR_BOUNDARY_FILE, "utf8");
const navConfigSource = readFileSync(NAV_CONFIG_FILE, "utf8");
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

const budgetCss = extractBudgetCss(bbaGlobalsCssSource);

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

  await runTest("1. Planilha orçamentária existe, com título visível", () => {
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    assertTrue(worksheet.includes("Planilha orçamentária"), "título visível da planilha");
  });

  await runTest("2. id=\"planilha-orcamentaria\" existe", () => {
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    assertTrue(worksheet.includes('id="planilha-orcamentaria"'), "âncora real da planilha");
  });

  await runTest("3. 'Explorar orçamento' aponta para #planilha-orcamentaria, não para a comparação", () => {
    const nextDecision = sourceOf("budget-next-decision-section.tsx");
    assertTrue(nextDecision.includes('href="#planilha-orcamentaria"'), "âncora corrigida");
    assertTrue(nextDecision.includes("Explorar orçamento"), "texto do botão preservado");
    assertTrue(!nextDecision.includes("#comparacao"), "não deve mais apontar para a comparação");
  });

  await runTest("4 e 5. planilha aparece antes da comparação e antes das etapas na ordem da página", () => {
    const demoPage = pageSources[1];
    const worksheetIndex = demoPage.indexOf("BudgetWorksheetSection");
    const comparisonIndex = demoPage.indexOf("BudgetComparisonSection");
    const journeyIndex = demoPage.indexOf("BudgetJourneySection");
    assertTrue(worksheetIndex !== -1 && comparisonIndex !== -1 && journeyIndex !== -1, "todos os componentes devem existir na página");
    assertTrue(worksheetIndex < comparisonIndex, "planilha deve vir antes da comparação");
    assertTrue(worksheetIndex < journeyIndex, "planilha deve vir antes das etapas");
  });

  await runTest("nova ordem obrigatória completa da página de demonstração", () => {
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

  await runTest("6, 7 e 8. amostra sintética tem exatamente 3 grupos, 8 a 10 itens, todos com sourceKind correto", () => {
    assertTrue(BUDGET_WORKSHEET_SAMPLE.groups.length === 3, "exatamente 3 grupos sintéticos");
    const allItems = BUDGET_WORKSHEET_SAMPLE.groups.flatMap((group) => group.items);
    assertTrue(allItems.length >= 8 && allItems.length <= 10, "entre 8 e 10 itens sintéticos");
    allItems.forEach((item) => {
      assertTrue(item.sourceKind === "synthetic_visual_example", `item ${item.code} com sourceKind incorreto`);
    });
  });

  await runTest("9. planilha expõe as seis colunas exigidas", () => {
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    ["Código", "Item de serviço", "Unidade", "Quantidade", "Preço unitário", "Total"].forEach((column) => {
      assertTrue(worksheet.includes(column), `coluna ausente: ${column}`);
    });
  });

  await runTest("10. primeiro grupo começa aberto, os demais recolhidos", () => {
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    assertTrue(worksheet.includes("defaultOpen={index === 0}"), "só o primeiro grupo (index 0) começa aberto");
    assertTrue(worksheet.includes("useState(defaultOpen)"), "estado de abertura controlado por React, não recomputado a cada render");
    assertTrue(worksheet.includes("onToggle=") && worksheet.includes("open={open}"), "details deve ser controlado (nunca perde o estado do usuário em re-render)");
  });

  await runTest("11. aviso 'Exemplo visual' está sempre visível, nunca em tooltip/hover", () => {
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    assertTrue(worksheet.includes("Exemplo visual"), "badge 'Exemplo visual'");
    assertTrue(
      worksheet.includes("Os itens e valores desta amostra são sintéticos e não compõem os totais apresentados no resumo."),
      "aviso permanente sobre a natureza sintética da amostra"
    );
    assertTrue(
      !/<p className="budget-worksheet__warning"[^>]*\btitle=/.test(worksheet),
      "aviso não pode depender de tooltip (title= no próprio elemento do aviso)"
    );
    assertTrue(!/onMouseEnter|onMouseOver/.test(worksheet), "aviso não pode depender de hover");
  });

  await runTest("12. valores sintéticos nunca compõem os totais principais (fontes isoladas, nunca somadas)", () => {
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    assertTrue(
      !worksheet.includes("budget-demonstration-data"),
      "a Planilha orçamentária não deve importar a fonte de demonstração principal (fontes deliberadamente isoladas)"
    );
    assertTrue(worksheetDataSource.includes('sourceKind: "synthetic_visual_example"'), "amostra sintética discriminada corretamente");
    assertTrue(
      demoDataSource.includes('sourceKind: "demonstration"') && !demoDataSource.includes("synthetic_visual_example"),
      "a fonte principal não deve referenciar o discriminador sintético"
    );
  });

  await runTest("13. nenhum cálculo monetário nos componentes (nem nos novos: resumo, faixa, planilha, etapas)", () => {
    componentSources.forEach((source, index) => {
      const file = BUDGET_COMPONENT_FILES[index];
      assertTrue(!/\.cents\s*[*/]|cents\s*[*/]\s*\d/.test(source), `${file} não deve operar aritmeticamente sobre centavos`);
      assertTrue(!/toFixed|parseFloat\(/i.test(source), `${file} não deve formatar/calcular moeda em runtime`);
      assertTrue(!/quantity\s*\*|unitPriceCents\s*\*/.test(source), `${file} não deve recalcular total a partir de quantidade × preço`);
    });
  });

  await runTest("14. existem apenas três cards de indicadores principais", () => {
    const indicators = sourceOf("budget-indicator-cards.tsx");
    ["oficial", "proposta", "reducao"].forEach((id) => {
      assertTrue(indicators.includes(`id: "${id}"`), `indicador ausente: ${id}`);
    });
    ["grupos", "subgrupos", "itens"].forEach((id) => {
      assertTrue(!indicators.includes(`id: "${id}"`), `indicador de contagem não deve mais estar entre os cards grandes: ${id}`);
    });
  });

  await runTest("15. 11/25/300 aparecem em faixa compacta, não em cards adicionais", () => {
    const strip = sourceOf("budget-hierarchy-strip.tsx");
    assertTrue(strip.includes("groupCount") && strip.includes("subgroupCount") && strip.includes("serviceItemCount"), "faixa deve exibir as três contagens");
    assertTrue(!strip.includes('from "@bba/ui"'), "faixa não deve usar o componente Card (não pode parecer mais três cards)");
  });

  await runTest("16, 17 e 18. vocabulário antigo das etapas foi completamente removido", () => {
    const stripped = stripComments(ALL_UI_SOURCE);
    assertTrue(!stripped.includes("Exige confirmação humana"), "'Exige confirmação humana' não pode existir");
    assertTrue(!stripped.includes("Demonstrado"), "'Demonstrado' não pode existir como rótulo de etapa");
    assertTrue(!stripped.includes("Etapa futura"), "'Etapa futura' não pode existir");
    assertTrue(!/\bhumana\b/i.test(stripped), "a palavra isolada 'humana' não pode aparecer em nenhum ponto da experiência");
  });

  await runTest("19, 20 e 21. novo vocabulário das etapas está presente", () => {
    const journey = sourceOf("budget-journey-section.tsx");
    assertTrue(journey.includes("Aguardando revisão"), "'Aguardando revisão' deve existir");
    assertTrue(journey.includes("Disponível"), "'Disponível' deve existir");
    assertTrue(journey.includes("Próxima etapa"), "'Próxima etapa' deve existir");
    assertTrue(journey.includes('title="Etapas do orçamento"'), "bloco deve se chamar 'Etapas do orçamento'");
  });

  await runTest("22. etapas usam grade de 5 colunas no desktop", () => {
    assertTrue(
      /\.budget-journey\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/.test(budgetCss),
      "grade de 5 colunas ausente"
    );
  });

  await runTest("23. existe breakpoint vertical compacto para celular nas etapas", () => {
    const mobileBlockMatch = budgetCss.match(/@media \(max-width: 600px\) \{[\s\S]*/);
    assertTrue(mobileBlockMatch !== null, "bloco mobile deve existir");
    const mobileBlock = mobileBlockMatch?.[0] ?? "";
    assertTrue(/\.budget-journey\s*\{[^}]*grid-template-columns:\s*1fr/.test(mobileBlock), "etapas devem virar coluna única no celular");
    assertTrue(mobileBlock.includes(".budget-journey::before"), "conector horizontal deve ser removido/escondido no celular");
  });

  await runTest("24. nenhum min-height artificial no resumo compacto ou nas etapas", () => {
    const strippedCss = budgetCss.replace(/\/\*[\s\S]*?\*\//g, "");
    assertTrue(!strippedCss.includes("min-height"), "nenhuma regra de Orçamento deve usar min-height fixo (fora de comentário)");
  });

  await runTest("25. existe representação móvel da planilha (mesma fonte de dados, sem duplicar valores)", () => {
    const mobileBlockMatch = budgetCss.match(/@media \(max-width: 600px\) \{[\s\S]*/);
    const mobileBlock = mobileBlockMatch?.[0] ?? "";
    assertTrue(mobileBlock.includes(".budget-worksheet-table"), "regra mobile da planilha deve existir");
    assertTrue(mobileBlock.includes("thead"), "cabeçalho da tabela deve ser escondido no celular");
    assertTrue(mobileBlock.includes("attr(data-label)"), "rótulo de cada valor deve vir do próprio data-label, nunca duplicado manualmente");
    const worksheet = sourceOf("budget-worksheet-section.tsx");
    assertTrue((worksheet.match(/data-label=/g) ?? []).length >= 6, "cada célula da tabela deve ter data-label para o layout de celular");
  });

  await runTest("26. nenhum dado real de cliente/obra/órgão é exposto (componentes, páginas e ambas as fontes de dados)", () => {
    const combinedLower = stripComments(`${ALL_UI_SOURCE}\n${demoDataSource}\n${worksheetDataSource}`).toLowerCase();
    assertTrue(!combinedLower.includes("lagoa do arroz"), "não deve citar o nome do projeto real");
    assertTrue(!combinedLower.includes("dnocs"), "não deve citar o nome do órgão real");
    assertTrue(!combinedLower.includes("2f engenharia"), "não deve citar o nome do cliente real");
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

  await runTest("29. nenhum termo técnico proibido pelo vocabulário aparece (fora de comentários)", () => {
    const strippedUi = stripComments(ALL_UI_SOURCE);
    const strippedData = stripComments(`${demoDataSource}\n${worksheetDataSource}`);
    const combined = `${strippedUi}\n${strippedData}`;
    FORBIDDEN_TERMS.forEach((term) => {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      assertTrue(!pattern.test(combined), `termo técnico proibido encontrado fora de comentário: "${term}"`);
    });
  });

  await runTest("30. dados demonstrativos e sintéticos não são persistidos (nenhum acesso a banco/insert)", () => {
    const combined = `${ALL_UI_SOURCE}\n${demoDataSource}\n${worksheetDataSource}`;
    assertTrue(
      !/supabase|\.insert\(|INSERT INTO|createServerClient|getSupabaseRouteHandlerClient/i.test(combined),
      "nenhum caminho de persistência deve existir para os dados de demonstração ou da amostra sintética"
    );
  });

  await runTest("simulação de cenário permanece indisponível sem serviço real, com texto comercial (sem linguagem de implementação)", () => {
    const actionCards = sourceOf("budget-action-cards.tsx");
    assertTrue(actionCards.includes("simulationServiceAvailable"), "card deve depender do sinalizador real do serviço");
    assertTrue(
      actionCards.includes("A simulação de novos cenários será disponibilizada em uma próxima etapa."),
      "texto recomendado, sem mencionar serviço de cálculo dedicado"
    );
    assertTrue(!/serviço de cálculo dedicado/i.test(actionCards), "não deve usar linguagem de implementação");
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

  await runTest("nenhuma rolagem horizontal indevida (tabela some para cartões no celular)", () => {
    assertTrue(!/overflow-x:\s*scroll/i.test(ALL_UI_SOURCE + budgetCss), "não deve forçar rolagem horizontal");
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
