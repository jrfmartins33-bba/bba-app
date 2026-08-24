import { buildLagoaDoArrozOfficialScenario } from "./lagoa-do-arroz.official-fixture-loader";
import { buildLagoaDoArrozProposalScenario } from "./lagoa-do-arroz.proposal-fixture-loader";
import { compareBudgetVersions } from "./budget-version-comparison";

function realComparison() {
  const official = buildLagoaDoArrozOfficialScenario();
  const proposal = buildLagoaDoArrozProposalScenario({
    procurementCase: official.procurementCase,
    officialBudgetVersion: official.consolidatedBudgetVersion,
  });
  return {
    official: official.consolidatedBudgetVersion,
    proposal: proposal.consolidatedBudgetVersion,
    comparison: compareBudgetVersions({
      officialBudgetVersion: official.consolidatedBudgetVersion,
      proposalBudgetVersion: proposal.consolidatedBudgetVersion,
    }),
  };
}

runTest("compara os 300 itens da Lagoa em pares determinísticos um-para-um", () => {
  const { comparison } = realComparison();
  assertEqual(comparison.summary.proposalServiceItemCount, 300);
  assertEqual(comparison.summary.officialServiceItemCount, 300);
  assertEqual(comparison.summary.matchedItemCount, 300);
  assertEqual(comparison.summary.unmatchedProposalItemCount, 0);
  assertEqual(comparison.summary.unmatchedOfficialItemCount, 0);
  assertEqual(comparison.unmatchedOfficialLineIds.length, 0);
  assertEqual(new Set(comparison.items.map((item) => item.officialLineId)).size, 300);
});

runTest("fecha os totais exatos e calcula 22,40% sem ponto flutuante decisório", () => {
  const { comparison } = realComparison();
  assertEqual(comparison.summary.officialTotalCents, 980_908_718);
  assertEqual(comparison.summary.proposalTotalCents, 761_185_165);
  assertEqual(comparison.summary.differenceCents, 219_723_553);
  assertEqual(comparison.summary.percentageBasisPoints, 2_240);
});

runTest("deriva as classificações reais dos itens e não replica desconto global", () => {
  const { comparison } = realComparison();
  assertEqual(comparison.summary.reductionCount, 290);
  assertEqual(comparison.summary.increaseCount, 0);
  assertEqual(comparison.summary.equalCount, 0);
  assertEqual(comparison.summary.divergenceCount, 10);
  const itemPercentages = new Set(
    comparison.items
      .map((item) => item.total.percentageBasisPoints)
      .filter((value): value is number => value !== null),
  );
  assertTrue(itemPercentages.size > 20, "os descontos item a item devem permanecer heterogêneos");
});

runTest("elimina 18 falsos positivos de quantidade com decimal canônico exato", () => {
  const { comparison } = realComparison();
  assertEqual(comparison.summary.normalizedQuantityMatchCount, 18);
  assertEqual(comparison.items.filter((item) => item.quantityDiffers).length, 0);
  assertEqual(comparison.items.filter((item) => item.documentDivergences.includes("Quantity")).length, 0);
  assertEqual(comparison.items.some((item) => item.officialQuantity?.includes("000000000") === true), false);

  const transport = comparison.items.find((item) => item.proposalCode === "5915320");
  assertEqual(transport?.officialQuantity, "808.84");
  assertEqual(transport?.proposalQuantity, "808.84");
  assertEqual(transport?.quantityNormalizedForComparison, true);
  assertEqual(transport?.classification, "Reduction");
});

runTest("mantém apenas divergências documentais reais e informa sua natureza", () => {
  const { comparison } = realComparison();
  assertEqual(comparison.items.filter((item) => item.unitDiffers).length, 2);
  assertEqual(comparison.items.filter((item) => item.descriptionDiffers).length, 8);
  assertEqual(comparison.items.filter((item) => item.codeDiffers).length, 0);
  assertEqual(comparison.items.filter((item) => item.documentDivergences.includes("Correspondence")).length, 0);
  assertEqual(comparison.items.filter((item) => item.documentDivergences.includes("Unit")).length, 2);
  assertEqual(comparison.items.filter((item) => item.documentDivergences.includes("Description")).length, 8);
  assertEqual(comparison.items.filter((item) => item.classification === "Divergence").length, 10);
});

runTest("confirma Administração Local como maior economia absoluta", () => {
  const { proposal, comparison } = realComparison();
  const item = comparison.items.find((candidate) => candidate.proposalLineId === comparison.summary.largestReductionProposalLineId);
  const line = proposal.lines.find((candidate) => candidate.id === item?.proposalLineId);
  assertEqual(line?.description.status === "Confirmed" ? line.description.text : null, "ADMINISTRAÇÃO LOCAL");
  assertEqual(item?.total.officialCents, 105_284_100);
  assertEqual(item?.total.winnerCents, 81_700_500);
  assertEqual(item?.total.differenceCents, 23_583_600);
});

runTest("COT-015 é comparado economicamente sem receber pai artificial", () => {
  const { proposal, comparison } = realComparison();
  const proposalCot = proposal.lines.find((line) => line.externalCode === "COT-015");
  assertTrue(proposalCot !== undefined, "COT-015 deve existir na proposta");
  assertEqual(proposalCot?.parentLineId, null);
  const comparedCot = comparison.items.find((item) => item.proposalLineId === proposalCot?.id);
  assertEqual(comparedCot?.matchMethod, "UniqueExternalCode");
  assertEqual(comparedCot?.proposalQuantity, "60");
  assertEqual(comparedCot?.proposalUnit, "DIA");
  assertEqual(comparedCot?.unitPrice.winnerCents, 294_767);
  assertEqual(comparedCot?.total.winnerCents, 17_686_020);
  assertEqual(comparedCot?.classification, "Reduction");
});

runTest("valor oficial zero produz percentual não aplicável, nunca divisão por zero", () => {
  const { official, proposal } = realComparison();
  const target = official.lines.find((line) => line.kind === "ServiceItem");
  assertTrue(target !== undefined, "fixture precisa de item oficial");
  const officialWithZero = {
    ...official,
    lines: official.lines.map((line) => line.id === target?.id
      ? { ...line, totalCents: 0, unitPriceCents: 0, officialUnitPriceCents: 0 }
      : line),
  };
  const comparison = compareBudgetVersions({ officialBudgetVersion: officialWithZero, proposalBudgetVersion: proposal });
  const item = comparison.items.find((candidate) => candidate.officialLineId === target?.id);
  assertEqual(item?.unitPrice.percentageBasisPoints, null);
  assertEqual(item?.total.percentageBasisPoints, null);
  assertEqual(item?.classification, "Increase");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
