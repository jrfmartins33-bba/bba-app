import { calculateBudgetVersionTotal } from "./budget-version";
import { centsFromExactReais } from "./budget-version-money";
import { BudgetVersionStatus } from "./budget-version.types";
import { buildSyntheticCaseWithoutLots, buildSyntheticMultiLotScenario } from "./budget-version.synthetic-fixture";

// Cenário sintético multi-lote — todos os valores/códigos são fictícios
// (mapa §17); não reproduz o caso real Lagoa do Arroz.

runTest("cenário sintético: consolida com dois lotes, hierarquia completa e Item sem código", () => {
  const scenario = buildSyntheticMultiLotScenario();

  assertEqual(scenario.consolidatedBudgetVersion.status, BudgetVersionStatus.Consolidated, "expected consolidated status");
  assertEqual(scenario.consolidatedBudgetVersion.lines.length, 7, "expected all seven synthetic lines to be present");

  const itemWithoutCode = scenario.consolidatedBudgetVersion.lines.find((line) => line.id === "item-lot-b-2-no-code");
  assertEqual(itemWithoutCode?.externalCode, null, "expected the code-less item to be representable, mirroring COT-015's structural role");
});

runTest("cenário sintético: total do processo inteiro soma os dois lotes sem dupla contagem", () => {
  const scenario = buildSyntheticMultiLotScenario();

  const expectedTotal = centsFromExactReais(15000) + centsFromExactReais(8000) + centsFromExactReais(1234.56);
  assertEqual(calculateBudgetVersionTotal(scenario.consolidatedBudgetVersion), expectedTotal, "whole-case total mismatch");
});

runTest("cenário sintético: totalização por lote respeita o Escopo consultado", () => {
  const scenario = buildSyntheticMultiLotScenario();

  assertEqual(
    calculateBudgetVersionTotal(scenario.consolidatedBudgetVersion, scenario.lotAScope),
    centsFromExactReais(15000),
    "lot A total mismatch",
  );
  assertEqual(
    calculateBudgetVersionTotal(scenario.consolidatedBudgetVersion, scenario.lotBScope),
    centsFromExactReais(8000) + centsFromExactReais(1234.56),
    "lot B total mismatch",
  );
});

runTest("cenário sintético: Processo sem lote não recebe lote artificial", () => {
  const scenario = buildSyntheticCaseWithoutLots();

  assertEqual(scenario.budgetVersion.status, BudgetVersionStatus.Draft, "expected a fresh draft version");
  assertEqual(scenario.budgetVersion.scope.procurementCaseId, scenario.procurementCase.id, "scope must reference the whole case");
  assertEqual(Object.prototype.hasOwnProperty.call(scenario.procurementCase, "lots"), false, "case without lots must not embed any lot collection");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
