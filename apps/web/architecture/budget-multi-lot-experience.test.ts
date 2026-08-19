import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const serverCatalog = source("apps/web/lib/bdos/consolidated-budget-catalog-server.ts");
const detailRoute = source("apps/web/app/api/orcamentos/consolidado/route.ts");
const summaryRoute = source("apps/web/app/api/orcamentos/consolidado/resumo/route.ts");
const budgetsPage = source("apps/web/app/(dashboard)/orcamentos/page.tsx");
const individualBudgetPage = source("apps/web/app/(dashboard)/orcamentos/[budgetId]/page.tsx");
const newScenarioPage = source("apps/web/app/(dashboard)/orcamentos/cenarios/novo/page.tsx");
const comparePage = source("apps/web/app/(dashboard)/orcamentos/cenarios/comparar/page.tsx");
const sidebar = source("apps/web/components/sidebar.tsx");
const workspace = source("apps/web/app/(dashboard)/workspaces/engenharia/page.tsx");
const reviewPage = source("apps/web/app/(dashboard)/admin/orcamentos/[sessionId]/revisao/page.tsx");

const catalogCss = source("apps/web/components/budget/official-budget-catalog.module.css");

assert("catálogo lista todas as versões consolidadas sem limit(1)", serverCatalog.includes('.eq("status", "Consolidated")') && !serverCatalog.includes(".limit(1)"));
assert("identidade multi-lote usa colunas canônicas", serverCatalog.includes("procurement_case_id") && serverCatalog.includes("procurement_lot_id") && !serverCatalog.includes("lotReference"));
assert("todas as leituras são escopadas pela organização autenticada", (serverCatalog.match(/\.eq\("company_id", organizationId\)/g) ?? []).length >= 4);
assert("read model não cria ou altera BudgetVersion", !/\.insert\(|\.update\(|createDraftBudgetVersion|persist_budget/.test(serverCatalog));
assert("detalhe usa exatamente o orçamento solicitado", detailRoute.includes('searchParams.get("orcamento")') && detailRoute.includes("resolveBudgetVersionContext"));
assert("detalhe exige contexto server-side de BudgetVersion consolidada", detailRoute.includes("resolveBudgetVersionContext") && detailRoute.includes("organizationId"));
assert("resumo compatível retorna catálogo e seleção exata", summaryRoute.includes("loadConsolidatedBudgetCatalog") && summaryRoute.includes("requestedBudgetId"));
assert("página oferece importação sempre visível", budgetsPage.includes('href="/orcamentos/importar"') && budgetsPage.includes("Importar outro orçamento"));
assert("catálogo oferece navegação individual para cada lote", budgetsPage.includes("/orcamentos/${budget.id}") && budgetsPage.includes("Ver orçamento"));
assert("árvore completa é carregada sob demanda na página individual", individualBudgetPage.includes("/api/orcamentos/consolidado?orcamento=") && individualBudgetPage.includes("OfficialBudgetDetail"));
assert("cenários são agrupados pelo BudgetVersion do lote", budgetsPage.includes("scenariosByBudget.get(budget.id)"));
assert("Criar cenário envia a origem do card", budgetsPage.includes("/orcamentos/cenarios/novo?orcamento=") && budgetsPage.includes("budget.id"));
assert("ordenação visual dos lotes é determinística em ordem crescente", budgetsPage.includes("sortBudgetsByLotAscending(process.budgets)"));
assert("grid de lotes usa layout padrão em grid LTR para posicionar Lote 01 na esquerda e Lote 02 na direita", catalogCss.includes(".lotGrid") && !catalogCss.includes("direction: rtl;"));
assert("duplicação preserva sourceBudgetId", newScenarioPage.includes("duplicateScenario?.sourceBudgetId") && newScenarioPage.includes("duplicateBudget"));
assert("acesso direto não substitui o id solicitado pela versão mais recente", newScenarioPage.includes("requestedBudgetId") && !newScenarioPage.includes("mais recente"));
assert("comparação cross-lot tem mensagem humana", comparePage.includes("Compare cenários criados para o mesmo lote."));
assert("Workspace aponta para a experiência real", workspace.includes('href: "/orcamentos"') && workspace.includes('status: "Pronto"'));
assert("Admin possui acesso direto a Orçamento", sidebar.includes("Orçamentos oficiais e cenários de proposta"));
assert("revisão confirmada não mostra falsa ação", reviewPage.includes("Revisado e confirmado") && !reviewPage.includes("Já consolidado"));
assert("paginação inclui Última", reviewPage.includes("Última ⏭"));

function source(path: string): string { return readFileSync(resolve(root, path), "utf8"); }
function assert(name: string, condition: boolean) {
  if (!condition) throw new Error(name);
  console.log(`ok - ${name}`);
}
