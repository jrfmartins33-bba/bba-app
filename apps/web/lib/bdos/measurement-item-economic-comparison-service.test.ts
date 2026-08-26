import type { BudgetComparedItem, BudgetVersionComparison } from "@bba/bdos-core/services/procurement-engineering";
import { buildMeasurementItemEconomicComparisons, type MeasurementEconomicComparisonItemInput } from "./measurement-item-economic-comparison-service";

// "Revisar medição" -- teste direcionado: variação econômica usa
// dados reais e decimal exato; item abaixo do preço oficial aparece
// como economia; item acima aparece como acima do orçamento; nenhum
// desconto uniforme é aplicado; sem correspondência confiável, nenhum
// resumo artificial é produzido.
//
// CORREÇÃO CIRÚRGICA: a causa raiz real (confirmada contra o BM_08),
// managed_service_items.code ("01.02.01") e budget_lines.external_code
// ("73847/002") são espaços de código independentes -- por isso os
// testes abaixo cobrem explicitamente o caso que expôs o bug (item
// cujo código nunca aparece em nenhum BudgetComparedItem, mas que tem
// um vínculo persistido em contract_execution_item_links) e confirmam
// que a identidade persistida é sempre preferida ao código de texto.

function moneyDelta(officialCents: number | null, winnerCents: number | null) {
  if (officialCents === null || winnerCents === null) {
    return { officialCents, winnerCents, differenceCents: null, percentageBasisPoints: null };
  }
  const differenceCents = officialCents - winnerCents;
  const percentageBasisPoints = officialCents === 0 ? null : Math.round((differenceCents * 10_000) / officialCents);
  return { officialCents, winnerCents, differenceCents, percentageBasisPoints };
}

function comparedItem(
  overrides: Partial<BudgetComparedItem> & { proposalLineId: string; proposalCode: string | null; officialCode: string | null }
): BudgetComparedItem {
  return {
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

function measuredItem(overrides: Partial<MeasurementEconomicComparisonItemInput> & { id: string }): MeasurementEconomicComparisonItemInput {
  return { code: "", quantityDecimal: "1", managedServiceItemId: null, ...overrides };
}

const NO_LINKS: ReadonlyMap<string, string> = new Map();

async function main(): Promise<void> {
  await runTest("BUG REAL: item medido com código hierárquico interno ('01.02.01') nunca bate com o external_code do catálogo ('73847/002') por texto -- só a identidade persistida resolve", () => {
    const comparison = buildComparison([
      comparedItem({ proposalLineId: "proposal-line-1", proposalCode: "73847/002", officialCode: "73847/002", unitPrice: moneyDelta(100000, 88647) })
    ]);
    const links = new Map([["managed-service-item-1", "proposal-line-1"]]);

    const withoutLink = buildMeasurementItemEconomicComparisons(
      [measuredItem({ id: "line-1", code: "01.02.01", managedServiceItemId: "managed-service-item-1", quantityDecimal: "1" })],
      comparison,
      NO_LINKS
    );
    assertEqual(withoutLink.byItemId.size, 0, "sem o vínculo persistido, o código de texto sozinho não deve encontrar nada (prova da causa raiz)");

    const withLink = buildMeasurementItemEconomicComparisons(
      [measuredItem({ id: "line-1", code: "01.02.01", managedServiceItemId: "managed-service-item-1", quantityDecimal: "1" })],
      comparison,
      links
    );
    const item = withLink.byItemId.get("line-1");
    assertTrue(item !== undefined, "com o vínculo persistido (contract_execution_item_links), a correspondência deve ser encontrada mesmo com códigos textualmente distintos");
    assertEqual(item?.officialUnitPriceDecimal, "1000.00");
    assertEqual(item?.contractedUnitPriceDecimal, "886.47");
  });

  await runTest("identidade persistida é sempre preferida ao código de texto, mesmo quando os dois existem e apontam para itens diferentes", () => {
    const comparison = buildComparison([
      comparedItem({ proposalLineId: "linked-line", proposalCode: "SAME-CODE", officialCode: "SAME-CODE", unitPrice: moneyDelta(10000, 9000) }),
      comparedItem({ proposalLineId: "other-line", proposalCode: "OTHER-CODE", officialCode: "OTHER-CODE", unitPrice: moneyDelta(50000, 50000) })
    ]);
    const links = new Map([["managed-service-item-1", "linked-line"]]);

    const result = buildMeasurementItemEconomicComparisons(
      [measuredItem({ id: "line-1", code: "SAME-CODE", managedServiceItemId: "managed-service-item-1" })],
      comparison,
      links
    );

    const item = result.byItemId.get("line-1");
    assertEqual(item?.officialUnitPriceDecimal, "100.00", "deve usar o item ligado pela identidade (linked-line), não o item que bateria por código");
  });

  await runTest("item sem managedServiceItemId (boletim não carrega essa identidade) cai no casamento por código como reserva", () => {
    const comparison = buildComparison([comparedItem({ proposalLineId: "line-x", proposalCode: "01.02.03", officialCode: "01.02.03", unitPrice: moneyDelta(10000, 9000) })]);

    const result = buildMeasurementItemEconomicComparisons(
      [measuredItem({ id: "line-1", code: "01.02.03", managedServiceItemId: null })],
      comparison,
      NO_LINKS
    );

    assertTrue(result.byItemId.get("line-1") !== undefined, "reserva por código deve funcionar quando não há identidade persistida disponível");
  });

  await runTest("item com preço contratado abaixo do oficial: interpretation='economy', diferença e percentual exatos", () => {
    const comparison = buildComparison([
      comparedItem({ proposalLineId: "p1", proposalCode: "01.02.03", officialCode: "01.02.03", unitPrice: moneyDelta(10000, 9000) })
    ]);

    const result = buildMeasurementItemEconomicComparisons([measuredItem({ id: "line-1", code: "01.02.03", quantityDecimal: "10" })], comparison, NO_LINKS);

    const item = result.byItemId.get("line-1");
    assertTrue(item !== undefined, "item deveria ter correspondência");
    assertEqual(item?.officialUnitPriceDecimal, "100.00");
    assertEqual(item?.contractedUnitPriceDecimal, "90.00");
    assertEqual(item?.unitPriceDifferenceDecimal, "10.00");
    assertEqual(item?.interpretation, "economy");
  });

  await runTest("item com preço contratado acima do oficial: interpretation='above_official', diferença negativa", () => {
    const comparison = buildComparison([
      comparedItem({ proposalLineId: "p2", proposalCode: "02.01.01", officialCode: "02.01.01", unitPrice: moneyDelta(5000, 6000) })
    ]);

    const result = buildMeasurementItemEconomicComparisons([measuredItem({ id: "line-1", code: "02.01.01", quantityDecimal: "5" })], comparison, NO_LINKS);

    const item = result.byItemId.get("line-1");
    assertEqual(item?.interpretation, "above_official");
    assertEqual(item?.unitPriceDifferenceDecimal, "-10.00");
  });

  await runTest("item com preço idêntico: interpretation='no_relevant_variation' -- nenhum limiar arbitrário, só zero exato", () => {
    const comparison = buildComparison([
      comparedItem({ proposalLineId: "p3", proposalCode: "03.01.01", officialCode: "03.01.01", unitPrice: moneyDelta(5000, 5000) })
    ]);

    const result = buildMeasurementItemEconomicComparisons([measuredItem({ id: "line-1", code: "03.01.01", quantityDecimal: "1" })], comparison, NO_LINKS);

    assertEqual(result.byItemId.get("line-1")?.interpretation, "no_relevant_variation");
  });

  await runTest("resumo (economia total) usa aritmética decimal exata: quantidade × preço, soma dos itens correspondidos", () => {
    const comparison = buildComparison([
      comparedItem({ proposalLineId: "pA", proposalCode: "A", officialCode: "A", unitPrice: moneyDelta(10000, 9000) }),
      comparedItem({ proposalLineId: "pB", proposalCode: "B", officialCode: "B", unitPrice: moneyDelta(5000, 5500) })
    ]);

    const result = buildMeasurementItemEconomicComparisons(
      [measuredItem({ id: "line-a", code: "A", quantityDecimal: "10" }), measuredItem({ id: "line-b", code: "B", quantityDecimal: "4" })],
      comparison,
      NO_LINKS
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

  await runTest("item sem correspondência confiável (nem identidade nem código): nenhum item no mapa, sem resumo artificial se nenhum for encontrado", () => {
    const comparison = buildComparison([comparedItem({ proposalLineId: "px", proposalCode: "X", officialCode: "X", unitPrice: moneyDelta(1000, 900) })]);

    const result = buildMeasurementItemEconomicComparisons([measuredItem({ id: "line-1", code: "CODIGO-INEXISTENTE" })], comparison, NO_LINKS);

    assertEqual(result.byItemId.size, 0);
    assertEqual(result.summary, null, "sem nenhum item correspondido, o resumo deve ser null -- nunca zeros artificiais");
  });

  await runTest("comparação parcial: resumo reporta matchedItemCount menor que totalItemCount, nunca inventa correspondência para o item ausente", () => {
    const comparison = buildComparison([comparedItem({ proposalLineId: "pA", proposalCode: "A", officialCode: "A", unitPrice: moneyDelta(10000, 9000) })]);

    const result = buildMeasurementItemEconomicComparisons(
      [measuredItem({ id: "line-a", code: "A" }), measuredItem({ id: "line-b", code: "SEM-CORRESPONDENCIA" })],
      comparison,
      NO_LINKS
    );

    assertTrue(result.summary !== null);
    if (!result.summary) return;
    assertEqual(result.summary.matchedItemCount, 1);
    assertEqual(result.summary.totalItemCount, 2, "Comparação econômica disponível para 1 de 2 itens");
  });

  await runTest("código ambíguo (aparece em mais de um item comparado) sem vínculo persistido: descartado, nunca escolhido arbitrariamente", () => {
    const comparison = buildComparison([
      comparedItem({ proposalLineId: "line-1", proposalCode: "DUP", officialCode: "DUP", unitPrice: moneyDelta(1000, 900) }),
      comparedItem({ proposalLineId: "line-2", proposalCode: "DUP", officialCode: "DUP", unitPrice: moneyDelta(2000, 1900) })
    ]);

    const result = buildMeasurementItemEconomicComparisons([measuredItem({ id: "line-1", code: "DUP" })], comparison, NO_LINKS);

    assertEqual(result.byItemId.size, 0, "código ambíguo nunca deve resolver para um dos dois itens ao acaso");
  });

  await runTest("comparison === null (sem contrato/versão de orçamento rastreável): nenhum item, nenhum resumo", () => {
    const result = buildMeasurementItemEconomicComparisons([measuredItem({ id: "line-1", code: "QUALQUER" })], null, NO_LINKS);
    assertEqual(result.byItemId.size, 0);
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
