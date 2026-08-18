import { BudgetLineKind, BudgetVersionOriginKind, BudgetVersionStatus, type BudgetVersion } from "../../domain/budget-version";
import { ProcurementScopeKind } from "../../domain/procurement-case";
import type { BudgetVersionRepository } from "../procurement-engineering";
import type { ProposalScenario } from "../../domain/proposal-scenario";
import { createProposalScenarioService, listProposalScenariosService } from "./proposal-scenario-service";
import type { ProposalScenarioRepository } from "./proposal-scenario.repository";

function sourceBudget(organizationId = "org-a"): BudgetVersion {
  return {
    id: "budget-1",
    organizationId,
    procurementCaseId: "case-1",
    scope: { kind: ProcurementScopeKind.WholeCase, procurementCaseId: "case-1" },
    origin: { kind: BudgetVersionOriginKind.Native },
    status: BudgetVersionStatus.Consolidated,
    originLineage: null,
    lines: [{
      id: "item-1", budgetVersionId: "budget-1", kind: BudgetLineKind.ServiceItem,
      description: { status: "Confirmed", text: "Item" }, externalCode: null, parentLineId: "group-1",
      position: 0, scope: { kind: ProcurementScopeKind.WholeCase, procurementCaseId: "case-1" }, totalCents: 100_000, metadata: {},
    }, {
      id: "group-1", budgetVersionId: "budget-1", kind: BudgetLineKind.Group,
      description: { status: "Confirmed", text: "Grupo" }, externalCode: null, parentLineId: null,
      position: 0, scope: { kind: ProcurementScopeKind.WholeCase, procurementCaseId: "case-1" }, totalCents: null, metadata: {},
    }],
    metadata: {},
  };
}

function repositories(source: BudgetVersion | null = sourceBudget()) {
  const saved: ProposalScenario[] = [];
  let observedOrganization = "";
  let observedActor = "";
  const budgetVersions: BudgetVersionRepository = {
    async createDraftBudgetVersion() { throw new Error("not used"); },
    async loadBudgetVersion(organizationId) {
      observedOrganization = organizationId;
      return source === null || source.organizationId !== organizationId ? null : { entity: source, revision: 3 };
    },
    async saveBudgetVersion() { throw new Error("not used"); },
  };
  const scenarios: ProposalScenarioRepository = {
    async createScenario(organizationId, actor, scenario) {
      observedOrganization = organizationId;
      observedActor = actor;
      saved.push(scenario);
      return scenario;
    },
    async findScenarioById(organizationId, id) {
      return saved.find((scenario) => scenario.organizationId === organizationId && scenario.id === id) ?? null;
    },
    async listScenarios(organizationId) {
      observedOrganization = organizationId;
      return saved.filter((scenario) => scenario.organizationId === organizationId);
    },
  };
  return { budgetVersions, scenarios, saved, observed: () => ({ organization: observedOrganization, actor: observedActor }) };
}

await run("application service derives organization and actor from context", async () => {
  const repos = repositories();
  const result = await createProposalScenarioService(
    { organizationId: "org-a", actor: "actor-authenticated" },
    { id: "scenario-1", sourceBudgetVersionId: "budget-1", name: "Cenário A", targetValueCents: 90_000, createdAt: "2026-08-18T12:00:00.000Z" },
    repos,
  );
  equal(result.outcome, "created");
  equal(repos.observed().organization, "org-a");
  equal(repos.observed().actor, "actor-authenticated");
});

await run("cross-organization source is not disclosed", async () => {
  const result = await createProposalScenarioService(
    { organizationId: "org-b", actor: "actor-b" },
    { id: "scenario-1", sourceBudgetVersionId: "budget-1", name: "Cenário", targetValueCents: 90_000, createdAt: "2026-08-18T12:00:00.000Z" },
    repositories(sourceBudget("org-a")),
  );
  equal(result.outcome, "not_found");
});

await run("listing remains organization scoped", async () => {
  const repos = repositories();
  const result = await listProposalScenariosService({ organizationId: "org-b", actor: "actor-b" }, undefined, repos.scenarios);
  equal(result.outcome, "listed");
  equal(repos.observed().organization, "org-b");
});

async function run(name: string, test: () => Promise<void>): Promise<void> {
  await test();
  console.log(`ok - ${name}`);
}

function equal<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
}
