import type { BudgetComparedItem, BudgetVersionComparison } from "@bba/bdos-core/services/procurement-engineering";
import { buildMeasurementItemEconomicComparisons } from "./measurement-item-economic-comparison-service";

// "Revisar medição" -- teste direcionado: variação econômica usa
// dados reais e decimal exato; item abaixo do preço oficial aparece
// como economia; item acima aparece como acima do orçamento; nenhum
// desconto uniforme é aplicado; sem correspondência confiável, nenhum
// resumo artificial é produzido.

function moneyDelta(officialCents: number | null, winnerCents: number | null) {
  if (officialCents === null || winnerCents === null) {
    return { officialCents, winnerCents, differenceCents: null, percentageBasisPoints: null };
  }
  const differenceCents = officialCents - winnerCents;
  const percentageBasisPoints = officialCents === 0 ? null : Math.round((differenceCents * 10_000) / officialCents);
  return { officialCents, winnerCents, differenceCents, percentageBasisPoints };
}

function comparedItem(overrides: Partial<BudgetComparedItem> & { proposalCode: string | null; officialCode: string | null }): BudgetComparedItem {
  return {
    proposalLineId: overrides.proposalCode ?? "line",
    officialLineId: "official-line",
    matchMethod: "UniqueExternalCode",
    unmatchedReason: null,
    classification: "Equal",
    proposalPosition: 1,
    proposalParentLineId: null,
    proposalDescription: null,
    officialDescription: null,
    proposalQuantity: null,
    officialQuantity: null,
    proposalUnit: null,
    officialUnit: null,
    codeDiffers: false,
    descriptionDiffers: false,
    quantityDiffers: false,
    quantityNormalizedForComparison: false,
    unitDiffers: false,
    documentDivergences: [],
    unitPrice: moneyDelta(0, 0),
    total: moneyDelta(0, 0),
    ...overrides
  };
}

function buildComparison(items: ReadonlyArray<BudgetComparedItem>): BudgetVersionComparison {
  return {
    proposalBudgetVersionId: "proposal-1",
    officialBudgetVersionId: "official-1",
    summary: {
      officialTotalCents: 0,
      proposalTotalCents: 0,
      differenceCents: 0,
      percentageBasisPoints: null,
      proposalServiceItemCount: items.length,
      officialServiceItemCount: items.length,
      matchedItemCount: items.length,
      unmatchedProposalItemCount: 0,
      unmatchedOfficialItemCount: 0,
      reductionCount: 0,
      increaseCount: 0,
      equalCount: 0,
      divergenceCount: 0,
      normalizedQuantityMatchCount: 0,
      largestReductionProposalLineId: null,
      largestIncreaseProposalLineId: null
    },
    items,
    unmatchedOfficialLineIds: []
  };
}

async function main(): Promise<void> {
  await runTest("item com preço contratado abaixo do oficial: interpretation='economy', diferença e percentual exatos", () => {
    const comparison = buildComparison([
      comparedItem({ proposalCode: "01.02.03", officialCode: "01.02.03", unitPrice: moneyDelta(10000, 9000) })
    ]);

    const result = buildMeasurementItemEconomicComparisons([{ code: "01.02.03", quantityDecimal: "10" }], comparison);

    const item = result.byItemCode.get("01.02.03");
    assertTrue(item !== undefined, "item deveria ter correspondência");
    assertEqual(item?.officialUnitPriceDecimal, "100.00");
    assertEqual(item?.contractedUnitPriceDecimal, "90.00");
    assertEqual(item?.unitPriceDifferenceDecimal, "10.00");
    assertEqual(item?.interpretation, "economy");
  });

  await runTest("item com preço contratado acima do oficial: interpretation='above_official', diferença negativa", () => {
    const comparison = buildComparison([
      comparedItem({ proposalCode: "02.01.01", officialCode: "02.01.01", unitPrice: moneyDelta(5000, 6000) })
    ]);

    const result = buildMeasurementItemEconomicComparisons([{ code: "02.01.01", quantityDecimal: "5" }], comparison);

    const item = result.byItemCode.get("02.01.01");
    assertEqual(item?.interpretation, "above_official");
    assertEqual(item?.unitPriceDifferenceDecimal, "-10.00");
  });

  await runTest("item com preço idêntico: interpretation='no_relevant_variation' -- nenhum limiar arbitrário, só zero exato", () => {
    const comparison = buildComparison([
      comparedItem({ proposalCode: "03.01.01", officialCode: "03.01.01", unitPrice: moneyDelta(5000, 5000) })
    ]);

    const result = buildMeasurementItemEconomicComparisons([{ code: "03.01.01", quantityDecimal: "1" }], comparison);

    assertEqual(result.byItemCode.get("03.01.01")?.interpretation, "no_relevant_variation");
  });

  await runTest("resumo (economia total) usa aritmética decimal exata: quantidade × preço, soma dos itens correspondidos", () => {
    const comparison = buildComparison([
      comparedItem({ proposalCode: "A", officialCode: "A", unitPrice: moneyDelta(10000, 9000) }),
      comparedItem({ proposalCode: "B", officialCode: "B", unitPrice: moneyDelta(5000, 5500) })
    ]);

    const result = buildMeasurementItemEconomicComparisons(
      [
        { code: "A", quantityDecimal: "10" },
        { code: "B", quantityDecimal: "4" }
      ],
      comparison
    );

    assertTrue(result.summary !== null);
    if (!result.summary) return;
    // A: oficial 100.00*10=1000.00, contratado 90.00*10=900.00
    // B: oficial 50.00*4=200.00, contratado 55.00*4=220.00
    assertEqual(result.summary.measuredValueAtOfficialPricesDecimal, "1200.00");
    assertEqual(result.summary.measuredValueAtContractedPricesDecimal, "1120.00");
    assertEqual(result.summary.economyDecimal, "80.00");
    assertEqual(result.summary.matchedItemCount, 2);
    assertEqual(result.summary.totalItemCount, 2);
  });

  await runTest("item sem correspondência confiável (código não encontrado): nenhum item no mapa, sem resumo artificial se nenhum for encontrado", () => {
    const comparison = buildComparison([comparedItem({ proposalCode: "X", officialCode: "X", unitPrice: moneyDelta(1000, 900) })]);

    const result = buildMeasurementItemEconomicComparisons([{ code: "CODIGO-INEXISTENTE", quantityDecimal: "1" }], comparison);

    assertEqual(result.byItemCode.size, 0);
    assertEqual(result.summary, null, "sem nenhum item correspondido, o resumo deve ser null -- nunca zeros artificiais");
  });

  await runTest("comparação parcial: resumo reporta matchedItemCount menor que totalItemCount, nunca inventa correspondência para o item ausente", () => {
    const comparison = buildComparison([comparedItem({ proposalCode: "A", officialCode: "A", unitPrice: moneyDelta(10000, 9000) })]);

    const result = buildMeasurementItemEconomicComparisons(
      [
        { code: "A", quantityDecimal: "1" },
        { code: "SEM-CORRESPONDENCIA", quantityDecimal: "1" }
      ],
      comparison
    );

    assertTrue(result.summary !== null);
    if (!result.summary) return;
    assertEqual(result.summary.matchedItemCount, 1);
    assertEqual(result.summary.totalItemCount, 2, "Comparação econômica disponível para 1 de 2 itens");
  });

  await runTest("código ambíguo (aparece em mais de um item comparado): descartado, nunca escolhido arbitrariamente", () => {
    const comparison = buildComparison([
      comparedItem({ proposalCode: "DUP", officialCode: "DUP", proposalLineId: "line-1", unitPrice: moneyDelta(1000, 900) }),
      comparedItem({ proposalCode: "DUP", officialCode: "DUP", proposalLineId: "line-2", unitPrice: moneyDelta(2000, 1900) })
    ]);

    const result = buildMeasurementItemEconomicComparisons([{ code: "DUP", quantityDecimal: "1" }], comparison);

    assertEqual(result.byItemCode.size, 0, "código ambíguo nunca deve resolver para um dos dois itens ao acaso");
  });

  await runTest("comparison === null (sem contrato/versão de orçamento rastreável): nenhum item, nenhum resumo", () => {
    const result = buildMeasurementItemEconomicComparisons([{ code: "QUALQUER", quantityDecimal: "1" }], null);
    assertEqual(result.byItemCode.size, 0);
    assertEqual(result.summary, null);
  });
}

async function runTest(name: string, testCase: () => void): Promise<void> {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "valores diferentes"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(message ?? "esperava true, recebeu false");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
