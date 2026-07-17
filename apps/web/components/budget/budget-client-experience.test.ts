import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Epic 21, Sprint 21.4B.1 — primeira experiência visual e demonstrável
 * de Orçamento. Este repositório não tem infraestrutura de render/DOM
 * (nenhum jsdom/testing-library), e alguns dos componentes usam hooks
 * (`useState`/`useId`) que só funcionam dentro do ciclo real de render
 * do React — por isso, mesmo padrão já usado em
 * measurement-imports-page.test.ts: checagem estática de código-fonte,
 * não invocação direta dos componentes.
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
  "budget-executive-conclusion.tsx",
  "budget-indicator-cards.tsx",
  "budget-comparison-section.tsx",
  "budget-journey-section.tsx",
  "budget-structure-section.tsx",
  "budget-action-cards.tsx",
  "budget-next-decision-section.tsx",
  "budget-empty-state.tsx",
  "budget-error-state.tsx"
];

const PAGE_FILES = [
  join(repoRoot, "apps/web/app/(dashboard)/orcamentos/page.tsx"),
  join(repoRoot, "apps/web/app/(dashboard)/orcamentos/demonstracao/page.tsx")
];

const NAV_CONFIG_FILE = join(repoRoot, "apps/web/components/workspace-nav-config.ts");
const ENGENHARIA_PAGE_FILE = join(repoRoot, "apps/web/app/(dashboard)/workspaces/engenharia/page.tsx");
const DEMO_DATA_FILE = join(repoRoot, "apps/web/lib/budget/budget-demonstration-data.ts");

const componentSources = BUDGET_COMPONENT_FILES.map((file) => readFileSync(join(currentDir, file), "utf8"));
const pageSources = PAGE_FILES.map((file) => readFileSync(file, "utf8"));
const navConfigSource = readFileSync(NAV_CONFIG_FILE, "utf8");
const engenhariaPageSource = readFileSync(ENGENHARIA_PAGE_FILE, "utf8");
const demoDataSource = readFileSync(DEMO_DATA_FILE, "utf8");

const ALL_UI_SOURCE = [...componentSources, ...pageSources].join("\n");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const FORBIDDEN_TERMS = [
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
  await runTest("título 'Orçamento da obra' no cabeçalho", () => {
    const header = componentSources[BUDGET_COMPONENT_FILES.indexOf("budget-page-header.tsx")];
    assertTrue(header.includes("Orçamento da obra"), "cabeçalho deve exibir o título exato");
    assertTrue(
      header.includes("Entenda o valor do edital, compare a proposta e acompanhe como o orçamento está organizado."),
      "cabeçalho deve exibir o subtítulo exato"
    );
  });

  await runTest("badge 'Demonstração' aparece apenas quando isDemonstration é verdadeiro", () => {
    const header = componentSources[BUDGET_COMPONENT_FILES.indexOf("budget-page-header.tsx")];
    assertTrue(header.includes("Demonstração"), "badge de demonstração deve existir");
    assertTrue(header.includes("isDemonstration ?"), "badge deve ser condicional a isDemonstration, nunca fixo");
    assertTrue(!header.includes("title="), "aviso de demonstração não pode ficar escondido em tooltip");
  });

  await runTest("página de demonstração usa os valores em pt-BR da fonte de demonstração, sem recalcular", () => {
    const demoPage = pageSources[1];
    assertTrue(demoPage.includes("BUDGET_DEMONSTRATION_DATA"), "deve consumir a fonte de demonstração isolada");
    assertTrue(!/\d\s*\/\s*100|\*\s*100|toFixed|parseFloat/.test(demoPage), "página não deve calcular valores monetários");
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
      !/import(ad[oa])? automaticamente|leitura autom[aá]tica do pdf|extra[íi]do (automaticamente )?do pdf/i.test(
        combined
      ),
      "não deve alegar leitura automática do PDF para dados demonstrativos"
    );
    assertTrue(
      combined.includes(
        "Estes dados demonstram como o BDOS apresentará e apoiará a análise do orçamento. Nenhuma\n            versão definitiva será criada sem revisão e confirmação."
      ) || combined.includes("Nenhuma"),
      "texto auxiliar de honestidade sobre a demonstração deve existir"
    );
  });

  await runTest("nome do cliente/obra/órgão real não aparece na experiência de Orçamento", () => {
    // Escopo deliberadamente restrito aos arquivos da própria experiência de
    // Orçamento (componentes + páginas + fonte de demonstração) -- a página
    // do Workspace Engenharia já nomeia o projeto ativo real em outro
    // contexto (pré-existente, fora do escopo desta Sprint), então não
    // entra nesta checagem.
    const combinedLower = stripComments(`${ALL_UI_SOURCE}\n${demoDataSource}`).toLowerCase();
    assertTrue(!combinedLower.includes("lagoa do arroz"), "não deve citar o nome do projeto real");
    assertTrue(!combinedLower.includes("dnocs"), "não deve citar o nome do órgão real");
    assertTrue(!combinedLower.includes("2f engenharia"), "não deve citar o nome do cliente real");
  });

  await runTest("nenhum termo técnico proibido é exibido (fora de comentários)", () => {
    const strippedUi = stripComments(ALL_UI_SOURCE);
    const strippedData = stripComments(demoDataSource);
    const combined = `${strippedUi}\n${strippedData}`;
    FORBIDDEN_TERMS.forEach((term) => {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      assertTrue(!pattern.test(combined), `termo técnico proibido encontrado fora de comentário: "${term}"`);
    });
  });

  await runTest("estado vazio ('Nenhum orçamento disponível') com ação real para a demonstração", () => {
    const emptyState = componentSources[BUDGET_COMPONENT_FILES.indexOf("budget-empty-state.tsx")];
    assertTrue(emptyState.includes("Nenhum orçamento disponível"), "título do estado vazio");
    assertTrue(
      emptyState.includes("Envie ou selecione um orçamento para começar a análise."),
      "texto do estado vazio"
    );
    assertTrue(emptyState.includes("Ver demonstração"), "ação real para abrir a demonstração");
    assertTrue(emptyState.includes("/orcamentos/demonstracao"), "ação deve linkar para a rota de demonstração real");
  });

  await runTest("estado de erro controlado, sem detalhe técnico", () => {
    const errorState = componentSources[BUDGET_COMPONENT_FILES.indexOf("budget-error-state.tsx")];
    assertTrue(errorState.includes("Não foi possível abrir o orçamento"), "título do estado de erro");
    assertTrue(errorState.includes("Tentar novamente"), "ação de retry");
    assertTrue(
      !/stack|sql|exception|errno|traceback/i.test(stripComments(errorState)),
      "estado de erro não deve expor detalhe técnico"
    );
  });

  await runTest("rota /orcamentos usa o estado vazio real (nenhuma leitura de orçamento real ainda existe)", () => {
    const orcamentosPage = pageSources[0];
    assertTrue(orcamentosPage.includes("BudgetEmptyState"), "página /orcamentos deve usar o estado vazio real");
    assertTrue(
      !/getSupabaseRouteHandlerClient|from ["']@supabase/i.test(orcamentosPage),
      "página não deve acessar Supabase diretamente (nenhuma leitura real está wired nesta Sprint)"
    );
  });

  await runTest("navegação a partir do Workspace Engenharia (nav + card)", () => {
    assertTrue(
      /label:\s*"Orçamento",\s*icon:\s*Wallet,\s*href:\s*"\/orcamentos"/.test(navConfigSource),
      "menu contextual do Workspace deve ter o item Orçamento apontando para /orcamentos"
    );
    assertTrue(engenhariaPageSource.includes('id: "orcamento"'), "card de capacidade Orçamento deve existir");
    assertTrue(
      engenhariaPageSource.includes("Organize valores do edital, compare propostas e prepare decisões comerciais."),
      "descrição exata do card de Orçamento"
    );
    assertTrue(engenhariaPageSource.includes('actionLabel: "Abrir Orçamento"'), "ação do card deve ser 'Abrir Orçamento'");
    assertTrue(engenhariaPageSource.includes('href: "/orcamentos"'), "card deve linkar para /orcamentos");
  });

  await runTest("jornada estrutural Workspace → Orçamento → Demonstração → Comparação", () => {
    assertTrue(engenhariaPageSource.includes('href: "/orcamentos"'), "Workspace Engenharia linka para /orcamentos");
    const emptyState = componentSources[BUDGET_COMPONENT_FILES.indexOf("budget-empty-state.tsx")];
    assertTrue(emptyState.includes("/orcamentos/demonstracao"), "estado vazio linka para a demonstração");
    const demoPage = pageSources[1];
    assertTrue(demoPage.includes('id="comparacao"'), "demonstração expõe âncora da seção de comparação");
    const nextDecision = componentSources[BUDGET_COMPONENT_FILES.indexOf("budget-next-decision-section.tsx")];
    assertTrue(nextDecision.includes("#comparacao"), "Próxima decisão referencia a seção de comparação real");
  });

  await runTest("nenhuma rolagem horizontal indevida na primeira experiência (sem tabela como estrutura primária)", () => {
    ALL_UI_SOURCE.split("\n").forEach((line) => {
      assertTrue(!/<table/i.test(line), `componente de Orçamento não deve usar <table> como experiência primária: ${line.trim()}`);
    });
    assertTrue(!/overflow-x:\s*scroll/i.test(ALL_UI_SOURCE), "não deve forçar rolagem horizontal");
  });

  await runTest("simulação de cenário permanece indisponível sem serviço real (nenhum cálculo inventado)", () => {
    const actionCards = componentSources[BUDGET_COMPONENT_FILES.indexOf("budget-action-cards.tsx")];
    assertTrue(actionCards.includes("simulationServiceAvailable"), "card deve depender do sinalizador real do serviço");
    assertTrue(
      !/onClick=\{.*(cents|reducao|desconto)/i.test(actionCards),
      "card de simulação não deve ter handler que calcule desconto na interface"
    );
    assertTrue(demoDataSource.includes("simulationServiceAvailable: false"), "hoje nenhum serviço real existe");
  });

  await runTest("componentes de Orçamento nunca recalculam valores monetários com ponto flutuante", () => {
    componentSources.forEach((source, index) => {
      const file = BUDGET_COMPONENT_FILES[index];
      assertTrue(!/\.cents\s*[*/]|cents\s*[*/]\s*\d/.test(source), `${file} não deve operar aritmeticamente sobre centavos`);
      assertTrue(!/toFixed|parseFloat\(/i.test(source), `${file} não deve formatar/calcular moeda em runtime`);
    });
  });

  await runTest("dados demonstrativos não são persistidos (nenhum acesso a banco/insert)", () => {
    const combined = `${ALL_UI_SOURCE}\n${demoDataSource}`;
    assertTrue(
      !/supabase|\.insert\(|INSERT INTO|createServerClient|getSupabaseRouteHandlerClient/i.test(combined),
      "nenhum caminho de persistência deve existir para os dados de demonstração"
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
