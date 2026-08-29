import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const context = source("apps/web/lib/bdos/budget-organization-context-server.ts");
const policy = source("apps/web/lib/budget/budget-organization-policy.ts");
const summary = source("apps/web/app/api/orcamentos/consolidado/resumo/route.ts");
const detail = source("apps/web/app/api/orcamentos/consolidado/route.ts");
const scenarios = source("apps/web/app/api/orcamentos/cenarios/route.ts");
const scenarioDetail = source("apps/web/app/api/orcamentos/cenarios/[scenarioId]/route.ts");
const page = source("apps/web/app/(dashboard)/orcamentos/page.tsx");

assert("ator é autenticado por getUser antes da leitura do profile", context.indexOf("auth.getUser()") < context.indexOf('.from("profiles")'));
assert("service role só aparece depois da classificação server-side", context.indexOf("authenticateBudgetOrganizationActor") < context.indexOf("getSupabaseServiceRoleClient()"));
assert("parâmetro empresa é documentado somente como resource selector", policy.includes("only a resource selector") && policy.includes("never grants access"));
assert("company user rejeita seletor de outra empresa", policy.includes("requestedOrganizationId !== actor.organizationId"));
assert("Admin elegível é resolvido por BudgetVersion Consolidated sem hardcode", context.includes('.eq("status", "Consolidated")') && !/Hidromec|pbzszmpz|[0-9a-f]{8}-[0-9a-f]{4}/i.test(context));
assert("resumo diferencia 401, 403 e seleção explícita", summary.includes('status: 401') && summary.includes('status: 403') && summary.includes("organizationSelectionRequired"));
assert("detalhe deriva organização da BudgetVersion", detail.includes("resolveBudgetVersionContext") && detail.includes("requestedOrganizationId"));
assert("listagem de cenários usa contexto resolvido", scenarios.includes("resolveBudgetCatalogContext") && scenarios.includes("context.organization.id"));
assert("criação deriva empresa do budgetId e não do POST", scenarios.includes("resolveBudgetVersionContext") && !scenarios.includes("body.companyId"));
assert("detalhe/duplicação deriva empresa do cenário", scenarioDetail.includes("resolveScenarioContext"));
assert("UI mostra nome humano da empresa e seleção múltipla", page.includes("Empresa selecionada") && page.includes("Selecione a empresa") && page.includes("organization.name"));
assert("catálogo e detalhe continuam explicitamente escopados", detail.includes("organizationId") && summary.includes("context.organization.id"));

function source(path: string): string { return readFileSync(resolve(root, path), "utf8"); }
function assert(name: string, condition: boolean) {
  if (!condition) throw new Error(name);
  console.log(`ok - ${name}`);
}
