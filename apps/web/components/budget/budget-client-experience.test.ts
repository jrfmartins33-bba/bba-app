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

const ERROR_BOUNDARY_FILE = join(repoRoot, "apps/web/app/(dashboard)/orcamentos/error.tsx");
const NAV_CONFIG_FILE = join(repoRoot, "apps/web/components/workspace-nav-config.ts");
const ENGENHARIA_PAGE_FILE = join(repoRoot, "apps/web/app/(dashboard)/workspaces/engenharia/page.tsx");
const DEMO_DATA_FILE = join(repoRoot, "apps/web/lib/budget/budget-demonstration-data.ts");
const BBA_GLOBALS_CSS_FILE = join(repoRoot, "apps/web/app/bba-globals.css");

const componentSources = BUDGET_COMPONENT_FILES.map((file) => readFileSync(join(currentDir, file), "utf8"));
const pageSources = PAGE_FILES.map((file) => readFileSync(file, "utf8"));
const errorBoundarySource = readFileSync(ERROR_BOUNDARY_FILE, "utf8");
const navConfigSource = readFileSync(NAV_CONFIG_FILE, "utf8");
const engenhariaPageSource = readFileSync(ENGENHARIA_PAGE_FILE, "utf8");
const demoDataSource = readFileSync(DEMO_DATA_FILE, "utf8");
const bbaGlobalsCssSource = readFileSync(BBA_GLOBALS_CSS_FILE, "utf8");

const ALL_UI_SOURCE = [...componentSources, ...pageSources, errorBoundarySource].join("\n");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

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
        "Estes dados demonstram como esta área apresentará e apoiará a análise do orçamento."
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

  await runTest("estado vazio ('Nenhum orçamento real disponível') não promete envio/seleção indisponíveis", () => {
    const emptyState = componentSources[BUDGET_COMPONENT_FILES.indexOf("budget-empty-state.tsx")];
    assertTrue(emptyState.includes("Nenhum orçamento real disponível"), "título do estado vazio corrigido");
    assertTrue(
      emptyState.includes(
        "Ainda não há um orçamento real vinculado a esta conta. Abra a demonstração para conhecer"
      ),
      "texto do estado vazio corrigido"
    );
    assertTrue(
      !/envie ou selecione|selecionar um orçamento|enviar um orçamento/i.test(emptyState),
      "estado vazio não deve prometer envio ou seleção -- ações que ainda não existem nesta Sprint"
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

  await runTest("error.tsx é uma fronteira real de rota, usa reset e nunca exibe a mensagem bruta do erro", () => {
    assertTrue(errorBoundarySource.includes('"use client"'), "error.tsx deve ser Client Component");
    assertTrue(/error:\s*Error/.test(errorBoundarySource), "error.tsx deve receber o prop error do Next.js");
    assertTrue(/reset:\s*\(\)\s*=>\s*void/.test(errorBoundarySource), "error.tsx deve receber reset");
    assertTrue(errorBoundarySource.includes("onRetry={reset}"), "reset deve ser passado como ação de nova tentativa");
    assertTrue(errorBoundarySource.includes("BudgetPageHeader"), "error.tsx deve renderizar o cabeçalho");
    assertTrue(errorBoundarySource.includes("BudgetErrorState"), "error.tsx deve renderizar o estado de erro sanitizado");
    assertTrue(
      !/\{error\.(message|digest|stack)\}|error\.toString\(\)/.test(errorBoundarySource),
      "error.tsx nunca deve renderizar a mensagem bruta do erro"
    );
    assertTrue(
      !/console\.(log|error|warn|info)\(/.test(errorBoundarySource),
      "error.tsx não deve registrar dado do erro no console do navegador"
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

  await runTest("menu contextual do Workspace continua apontando para /orcamentos", () => {
    assertTrue(
      /label:\s*"Orçamento",\s*icon:\s*Wallet,\s*href:\s*"\/orcamentos"/.test(navConfigSource),
      "menu contextual do Workspace deve ter o item Orçamento apontando para /orcamentos (entrada real, não a demonstração)"
    );
  });

  await runTest("card de destaque do Workspace leva direto à demonstração em um clique", () => {
    assertTrue(engenhariaPageSource.includes('id: "orcamento"'), "card de capacidade Orçamento deve existir");
    assertTrue(
      engenhariaPageSource.includes(
        "Veja como o orçamento oficial é apresentado, a proposta é comparada e os itens são organizados para decisão."
      ),
      "descrição do card de Orçamento (adaptada da recomendação para nunca nomear a plataforma em texto voltado ao cliente, PRINCIPLE 007)"
    );
    assertTrue(engenhariaPageSource.includes('actionLabel: "Ver demonstração"'), "ação do card deve ser 'Ver demonstração'");
    assertTrue(
      engenhariaPageSource.includes('href: "/orcamentos/demonstracao"'),
      "card deve linkar diretamente para a demonstração, não para o estado vazio de /orcamentos"
    );
    assertTrue(
      engenhariaPageSource.includes('status: "Demonstração disponível"'),
      "status do card deve ser 'Demonstração disponível'"
    );
    assertTrue(
      /"Demonstração disponível":\s*"status-badge/.test(engenhariaPageSource),
      "'Demonstração disponível' deve ter uma entrada própria no mapa de classes do badge"
    );
    assertTrue(
      /type CapabilityStatus = .*"Demonstração disponível"/.test(engenhariaPageSource),
      "'Demonstração disponível' deve fazer parte do tipo de status"
    );
  });

  await runTest("jornada estrutural Workspace → Demonstração → Comparação", () => {
    assertTrue(
      engenhariaPageSource.includes('href: "/orcamentos/demonstracao"'),
      "Workspace Engenharia leva direto à demonstração"
    );
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

  await runTest("a correção do card/estado vazio/error.tsx não introduz nenhuma regra econômica ou monetária na interface", () => {
    const correctedSources = [engenhariaPageSource, navConfigSource, errorBoundarySource].join("\n");
    assertTrue(
      !/\.cents\s*[*/]|cents\s*[*/]\s*\d|toFixed|parseFloat\(|\d\s*\/\s*100|\*\s*100/.test(correctedSources),
      "nenhum dos arquivos corrigidos nesta Sprint deve calcular ou formatar valores monetários"
    );
  });

  await runTest("existe regra responsiva específica para a comparação em telas estreitas", () => {
    assertTrue(bbaGlobalsCssSource.includes("@media (max-width: 600px)"), "deve existir um breakpoint dedicado à comparação");
    const mobileBlockMatch = bbaGlobalsCssSource.match(/@media \(max-width: 600px\) \{[\s\S]*?\n\}/);
    assertTrue(mobileBlockMatch !== null, "bloco @media (max-width: 600px) deve existir");
    const mobileBlock = mobileBlockMatch?.[0] ?? "";
    assertTrue(mobileBlock.includes(".budget-comparison__row"), "linha da comparação deve ter regra própria no breakpoint");
    assertTrue(mobileBlock.includes(".budget-comparison__bar-track"), "barra deve ocupar linha própria no breakpoint");
    assertTrue(mobileBlock.includes(".budget-structure-diagram"), "diagrama de hierarquia deve quebrar de forma compreensível");
    assertTrue(mobileBlock.includes(".budget-next-decision__actions"), "botões da próxima decisão devem se ajustar à largura disponível");
  });

  await runTest("existe tratamento de prefers-reduced-motion para a barra de comparação", () => {
    const reducedMotionBlocks = bbaGlobalsCssSource.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g) ?? [];
    assertTrue(reducedMotionBlocks.length > 0, "deve existir ao menos um bloco prefers-reduced-motion");
    const budgetReducedMotionBlock = reducedMotionBlocks.find((block) => block.includes(".budget-comparison__bar"));
    assertTrue(budgetReducedMotionBlock !== undefined, "deve existir um bloco prefers-reduced-motion específico da barra de comparação");
    assertTrue(
      (budgetReducedMotionBlock ?? "").includes("animation: none"),
      "prefers-reduced-motion deve desligar a animação da barra"
    );
  });

  await runTest("demonstração continua explicitamente identificada após a correção", () => {
    const orcamentoCardMatch = engenhariaPageSource.match(/\{\s*id:\s*"orcamento",[\s\S]*?\n {2}\},/);
    assertTrue(orcamentoCardMatch !== null, "card de capacidade Orçamento deve existir");
    const orcamentoCard = orcamentoCardMatch?.[0] ?? "";
    assertTrue(
      orcamentoCard.includes('status: "Demonstração disponível"'),
      "card sinaliza que é uma demonstração, não uma funcionalidade definitiva"
    );
    assertTrue(!orcamentoCard.includes('status: "Pronto"'), "card de Orçamento não deve ser marcado como 'Pronto' -- ainda é demonstração");
    const header = componentSources[BUDGET_COMPONENT_FILES.indexOf("budget-page-header.tsx")];
    assertTrue(header.includes("Demonstração"), "página de demonstração continua com o badge visível");
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
