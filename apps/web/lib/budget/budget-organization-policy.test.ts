import {
  authorizeBudgetResourceOrganization,
  classifyBudgetOrganizationActor,
  selectBudgetCatalogOrganization,
  type BudgetOrganizationActor,
  type BudgetOrganizationOption,
} from "./budget-organization-policy";

const companyA: BudgetOrganizationOption = { id: "company-a", name: "Empresa A" };
const companyB: BudgetOrganizationOption = { id: "company-b", name: "Empresa B" };
const companyUser: BudgetOrganizationActor = { userId: "user-company", accessKind: "company_user", organizationId: companyA.id };
const bbaAdmin: BudgetOrganizationActor = { userId: "user-admin", accessKind: "bba_admin", organizationId: null };

run("usuário não autenticado permanece 401-classificável", () => {
  equal(classifyBudgetOrganizationActor(null, null).status, "unauthenticated");
});

run("company user usa exclusivamente company_id do profile", () => {
  const result = classifyBudgetOrganizationActor("user-company", { companyId: companyA.id, role: "client" });
  equal(result.status, "authenticated");
  if (result.status === "authenticated") {
    equal(result.actor.accessKind, "company_user");
    equal(result.actor.organizationId, companyA.id);
  }
});

run("bba_admin com company_id null é ator autenticado legítimo", () => {
  const result = classifyBudgetOrganizationActor("user-admin", { companyId: null, role: "bba_admin" });
  equal(result.status, "authenticated");
  if (result.status === "authenticated") equal(result.actor.accessKind, "bba_admin");
});

run("perfil sem empresa e sem papel Admin é proibido", () => {
  equal(classifyBudgetOrganizationActor("user-orphan", { companyId: null, role: "client" }).status, "forbidden");
});

run("company user não amplia escopo pelo seletor empresa", () => {
  equal(selectBudgetCatalogOrganization(companyUser, [companyA], companyB.id).status, "forbidden");
  equal(selectBudgetCatalogOrganization(companyUser, [companyA], companyA.id).status, "resolved");
});

run("Admin com uma empresa elegível recebe contexto automático", () => {
  const result = selectBudgetCatalogOrganization(bbaAdmin, [companyA], null);
  equal(result.status, "resolved");
  if (result.status === "resolved") equal(result.organization.id, companyA.id);
});

run("Admin com múltiplas empresas nunca recebe seleção silenciosa", () => {
  const result = selectBudgetCatalogOrganization(bbaAdmin, [companyA, companyB], null);
  equal(result.status, "selection_required");
});

run("Admin seleciona empresa A sem receber contexto da empresa B", () => {
  const result = selectBudgetCatalogOrganization(bbaAdmin, [companyA, companyB], companyA.id);
  equal(result.status, "resolved");
  if (result.status === "resolved") equal(result.organization.id, companyA.id);
});

run("resource selector não autoriza cross-company", () => {
  equal(authorizeBudgetResourceOrganization(companyUser, companyB, null), "forbidden");
  equal(authorizeBudgetResourceOrganization(bbaAdmin, companyA, companyB.id), "forbidden");
  equal(authorizeBudgetResourceOrganization(bbaAdmin, companyA, companyA.id), "resolved");
});

function run(name: string, fn: () => void) { fn(); console.log(`ok - ${name}`); }
function equal<T>(actual: T, expected: T) {
  if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
}
