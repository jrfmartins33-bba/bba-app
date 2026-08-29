import { BudgetLineKind, BudgetVersionOriginKind, BudgetVersionStatus, type BudgetVersion } from "../budget-version";
import { ProcurementScopeKind } from "../procurement-case";
import { createProposalScenario, ProposalScenarioComparisonKind } from "./index";

const ORG_A = "org-a";

function budget(overrides: Partial<BudgetVersion> = {}): BudgetVersion {
  return {
    id: "budget-1",
    organizationId: ORG_A,
    procurementCaseId: "case-1",
    scope: { kind: ProcurementScopeKind.WholeCase, procurementCaseId: "case-1" },
    origin: { kind: BudgetVersionOriginKind.Native },
    status: BudgetVersionStatus.Consolidated,
    originLineage: null,
    lines: [
      {
        id: "group-1",
        budgetVersionId: "budget-1",
        kind: BudgetLineKind.Group,
        description: { status: "Confirmed", text: "Grupo" },
        externalCode: null,
        parentLineId: null,
        position: 0,
        scope: { kind: ProcurementScopeKind.WholeCase, procurementCaseId: "case-1" },
        totalCents: null,
        metadata: {},
      },
      {
        id: "item-1",
        budgetVersionId: "budget-1",
        kind: BudgetLineKind.ServiceItem,
        description: { status: "Confirmed", text: "Item" },
        externalCode: "1.1",
        parentLineId: "group-1",
        position: 0,
        scope: { kind: ProcurementScopeKind.WholeCase, procurementCaseId: "case-1" },
        totalCents: 1_365_119_673,
        quantity: "10.25",
        unit: "m²",
        officialUnitPriceCents: 12345,
        metadata: {},
      },
    ],
    metadata: {},
    ...overrides,
  };
}

function create(overrides: Partial<Parameters<typeof createProposalScenario>[0]> = {}) {
  return createProposalScenario({
    id: "scenario-1",
    organizationId: ORG_A,
    sourceBudgetVersion: budget(),
    sourceBudgetVersionRevision: 7,
    name: "Cenário A — Competitivo",
    targetValueCents: 1_220_000_000,
    createdBy: "actor-1",
    createdAt: "2026-08-18T12:00:00.000Z",
    ...overrides,
  });
}

run("scenario only starts from a consolidated budget", () => {
  assertFailure(create({ sourceBudgetVersion: budget({ status: BudgetVersionStatus.Draft }) }), "source_not_consolidated");
});

run("organization mismatch is rejected", () => {
  assertFailure(create({ organizationId: "org-b" }), "organization_mismatch");
});

run("invalid monetary target is rejected without float authority", () => {
  assertFailure(create({ targetValueCents: 12.5 }), "invalid_target_value");
});

run("source budget identity and revision are preserved", () => {
  const result = create();
  if (!result.success) throw new Error("expected success");
  equal(result.scenario.sourceBudgetVersionId, "budget-1");
  equal(result.scenario.sourceBudgetVersionRevision, 7);
});

run("source budget is not altered", () => {
  const source = budget();
  const before = JSON.stringify(source);
  create({ sourceBudgetVersion: source });
  equal(JSON.stringify(source), before);
});

run("saved result is deeply immutable", () => {
  const result = create();
  if (!result.success) throw new Error("expected success");
  equal(Object.isFrozen(result.scenario), true);
  equal(Object.isFrozen(result.scenario.parameters), true);
});

run("absolute difference is exact in integer cents", () => {
  const result = create();
  if (!result.success) throw new Error("expected success");
  equal(result.scenario.differenceCents, 145_119_673);
});

run("reduction percentage is derived by integer ratio", () => {
  const result = create();
  if (!result.success) throw new Error("expected success");
  equal(result.scenario.differenceBasisPoints, "1063");
  equal(result.scenario.comparisonKind, ProposalScenarioComparisonKind.Reduction);
});

run("increase is representable without pretending to be reduction", () => {
  const result = create({ targetValueCents: 1_400_000_000 });
  if (!result.success) throw new Error("expected success");
  equal(result.scenario.comparisonKind, ProposalScenarioComparisonKind.Increase);
  equal(result.scenario.differenceCents, 34_880_327);
});

run("same economic input produces the same economic result", () => {
  const first = create({ id: "a", createdBy: "actor-a", createdAt: "2026-08-18T12:00:00.000Z" });
  const second = create({ id: "b", createdBy: "actor-b", createdAt: "2026-08-19T12:00:00.000Z" });
  if (!first.success || !second.success) throw new Error("expected success");
  equal(first.scenario.officialValueCents, second.scenario.officialValueCents);
  equal(first.scenario.targetValueCents, second.scenario.targetValueCents);
  equal(first.scenario.differenceCents, second.scenario.differenceCents);
  equal(first.scenario.differenceBasisPoints, second.scenario.differenceBasisPoints);
  equal(first.scenario.comparisonKind, second.scenario.comparisonKind);
});

run("scenario is a separate result and never creates a BudgetVersion", () => {
  const result = create();
  if (!result.success) throw new Error("expected success");
  equal("lines" in result.scenario, false);
  equal("status" in result.scenario, false);
});

function assertFailure(result: ReturnType<typeof createProposalScenario>, code: string): void {
  if (result.success) throw new Error(`expected ${code} failure`);
  equal(result.errors.some((candidate) => candidate.code === code), true);
}

function run(name: string, test: () => void): void {
  test();
  console.log(`ok - ${name}`);
}

function equal<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
}
