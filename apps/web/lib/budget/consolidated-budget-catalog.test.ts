import {
  buildConsolidatedBudgetCatalog,
  extractLotNumber,
  lotPresentation,
  resolveScenarioSourceBudget,
  sortBudgetsByLotAscending,
  type ConsolidatedBudgetVersionRow,
} from "./consolidated-budget-catalog";

const lotOne: ConsolidatedBudgetVersionRow = {
  id: "budget-lot-1",
  procurementCaseId: "case-al",
  procurementLotId: "lot-1",
  scopeKind: "Lot",
  status: "Consolidated",
  revision: 1,
  updatedAt: "2026-08-18T19:19:59.000Z",
};
const lotTwo: ConsolidatedBudgetVersionRow = {
  ...lotOne,
  id: "budget-lot-2",
  procurementLotId: "lot-2",
  updatedAt: "2026-08-18T19:30:19.000Z",
};

run("organização sem versões retorna catálogo vazio", () => {
  const catalog = buildConsolidatedBudgetCatalog({
    versions: [], procurementCases: [], procurementLots: [], serviceItems: [], lineCounts: {},
  });
  equal(catalog.budgets.length, 0);
  equal(catalog.processes.length, 0);
});

run("uma versão consolidada permanece uma única origem", () => {
  const catalog = fixture([lotOne], [{ budgetVersionId: "budget-lot-1", totalCents: 750_663_919 }]);
  equal(catalog.budgets.length, 1);
  equal(catalog.budgets[0].id, "budget-lot-1");
  equal(catalog.budgets[0].procurementLotId, "lot-1");
});

run("dois lotes aparecem como BudgetVersions distintas e o total é apenas de apresentação", () => {
  const catalog = fixture(
    [lotOne, lotTwo],
    [
      { budgetVersionId: "budget-lot-1", totalCents: 750_663_919 },
      { budgetVersionId: "budget-lot-2", totalCents: 614_455_754 },
    ],
  );
  equal(catalog.budgets.length, 2);
  equal(new Set(catalog.budgets.map((budget) => budget.id)).size, 2);
  equal(catalog.processes.length, 1);
  equal(catalog.processes[0].budgets.length, 2);
  equal(catalog.processes[0].totalOfficialValueCents, 1_365_119_673);
  equal(catalog.budgets.some((budget) => budget.id === "budget-lot-1" && budget.procurementLotId === "lot-1"), true);
  equal(catalog.budgets.some((budget) => budget.id === "budget-lot-2" && budget.procurementLotId === "lot-2"), true);
});

run("itens e linhas são contabilizados no lote correto", () => {
  const catalog = fixture(
    [lotOne, lotTwo],
    [
      { budgetVersionId: "budget-lot-1", totalCents: 400 },
      { budgetVersionId: "budget-lot-1", totalCents: 600 },
      { budgetVersionId: "budget-lot-2", totalCents: 250 },
    ],
  );
  equal(catalog.budgets.find((budget) => budget.id === "budget-lot-1")?.serviceItemCount, 2);
  equal(catalog.budgets.find((budget) => budget.id === "budget-lot-1")?.officialValueCents, 1_000);
  equal(catalog.budgets.find((budget) => budget.id === "budget-lot-2")?.serviceItemCount, 1);
  equal(catalog.budgets.find((budget) => budget.id === "budget-lot-2")?.lineCount, 283);
});

run("processos diferentes nunca são misturados", () => {
  const other = { ...lotTwo, id: "budget-other", procurementCaseId: "case-other", procurementLotId: "lot-other" };
  const catalog = buildConsolidatedBudgetCatalog({
    versions: [lotOne, other],
    procurementCases: [{ id: "case-al", title: "Processo A" }, { id: "case-other", title: "Processo B" }],
    procurementLots: [
      { id: "lot-1", procurementCaseId: "case-al", title: "Lote 01" },
      { id: "lot-other", procurementCaseId: "case-other", title: "Lote Único" },
    ],
    serviceItems: [
      { budgetVersionId: "budget-lot-1", totalCents: 100 },
      { budgetVersionId: "budget-other", totalCents: 200 },
    ],
    lineCounts: {},
  });
  equal(catalog.processes.length, 2);
  equal(catalog.processes.every((process) => process.budgets.every((budget) => budget.procurementCaseId === process.procurementCaseId)), true);
});

run("rótulo documental é apresentação, não identidade", () => {
  deepEqual(lotPresentation("Lote 01 (14 barragens)", "Lot"), { title: "Lote 01", detail: "14 barragens" });
  deepEqual(lotPresentation("Lote Especial", "Lot"), { title: "Lote Especial", detail: null });
});

run("criação direta escolhe exatamente a BudgetVersion do Lote 01 ou do Lote 02", () => {
  const budgets = fixture(
    [lotOne, lotTwo],
    [
      { budgetVersionId: "budget-lot-1", totalCents: 100 },
      { budgetVersionId: "budget-lot-2", totalCents: 200 },
    ],
  ).budgets;
  equal(resolveScenarioSourceBudget(budgets, { requestedBudgetId: "budget-lot-1", selectedBudgetId: null, duplicateSourceBudgetId: null })?.id, "budget-lot-1");
  equal(resolveScenarioSourceBudget(budgets, { requestedBudgetId: "budget-lot-2", selectedBudgetId: null, duplicateSourceBudgetId: null })?.id, "budget-lot-2");
});

run("duplicação preserva a origem mesmo diante de outro orçamento solicitado", () => {
  const budgets = fixture(
    [lotOne, lotTwo],
    [
      { budgetVersionId: "budget-lot-1", totalCents: 100 },
      { budgetVersionId: "budget-lot-2", totalCents: 200 },
    ],
  ).budgets;
  equal(resolveScenarioSourceBudget(budgets, {
    requestedBudgetId: "budget-lot-2",
    selectedBudgetId: "budget-lot-2",
    duplicateSourceBudgetId: "budget-lot-1",
  })?.id, "budget-lot-1");
});

run("extrai número de lote de forma determinística", () => {
  equal(extractLotNumber("Lote 01 (14 barragens)"), 1);
  equal(extractLotNumber("Lote 02 (7 barragens)"), 2);
  equal(extractLotNumber("Lote 10"), 10);
  equal(extractLotNumber("Lote Especial"), Number.MAX_SAFE_INTEGER);
  equal(extractLotNumber(null), Number.MAX_SAFE_INTEGER);
});

run("lotes são ordenados de forma crescente pelo número do lote", () => {
  const catalog = fixture(
    [lotTwo, lotOne], // Passados invertidos propositalmente
    [
      { budgetVersionId: "budget-lot-2", totalCents: 200 },
      { budgetVersionId: "budget-lot-1", totalCents: 100 },
    ],
  );
  equal(catalog.processes[0].budgets[0].id, "budget-lot-1");
  equal(catalog.processes[0].budgets[1].id, "budget-lot-2");
  const sorted = sortBudgetsByLotAscending([catalog.budgets[0], catalog.budgets[1]]);
  equal(sorted[0].procurementLotId, "lot-1");
  equal(sorted[1].procurementLotId, "lot-2");
});

function fixture(versions: ReadonlyArray<ConsolidatedBudgetVersionRow>, serviceItems: ReadonlyArray<{ budgetVersionId: string; totalCents: number }>) {
  return buildConsolidatedBudgetCatalog({
    versions,
    procurementCases: [{ id: "case-al", title: "Recuperação de Diversas Barragens" }],
    procurementLots: [
      { id: "lot-1", procurementCaseId: "case-al", title: "Lote 01 (14 barragens)" },
      { id: "lot-2", procurementCaseId: "case-al", title: "Lote 02 (7 barragens)" },
    ],
    serviceItems,
    lineCounts: { "budget-lot-1": 546, "budget-lot-2": 283 },
  });
}

function run(name: string, fn: () => void) { fn(); console.log(`ok - ${name}`); }
function equal<T>(actual: T, expected: T) {
  if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
}
function deepEqual(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
