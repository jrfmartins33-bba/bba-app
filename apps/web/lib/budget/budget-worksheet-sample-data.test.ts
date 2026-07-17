import { BUDGET_WORKSHEET_SAMPLE } from "./budget-worksheet-sample-data";
import { BUDGET_DEMONSTRATION_DATA } from "./budget-demonstration-data";

/**
 * Epic 21, Sprint 21.4B.2 — confere a amostra sintética da Planilha
 * orçamentária: exatamente 3 grupos, entre 8 e 10 itens, `sourceKind`
 * correto em cada item, e consistência aritmética inteira linha a linha
 * (quantidade × preço unitário == total, soma dos totais == subtotal do
 * grupo) -- nunca recalculada na interface. Também confere que a
 * amostra nunca é somada aos totais principais da demonstração.
 */

function parseQuantity(display: string): number {
  return Number(display.replace(/\./g, ""));
}

async function main(): Promise<void> {
  const { groups } = BUDGET_WORKSHEET_SAMPLE;

  await runTest("sourceKind da amostra é 'synthetic_visual_example', diferente da demonstração", () => {
    assertEqual(BUDGET_WORKSHEET_SAMPLE.sourceKind, "synthetic_visual_example");
    assertTrue(
      (BUDGET_WORKSHEET_SAMPLE.sourceKind as string) !== BUDGET_DEMONSTRATION_DATA.sourceKind,
      "a amostra sintética nunca pode compartilhar sourceKind com a demonstração principal"
    );
  });

  await runTest("exatamente 3 grupos sintéticos", () => {
    assertEqual(groups.length, 3);
  });

  const allItems = groups.flatMap((group) => group.items);

  await runTest("entre 8 e 10 itens sintéticos no total", () => {
    assertTrue(allItems.length >= 8 && allItems.length <= 10, `esperava 8 a 10 itens, encontrou ${allItems.length}`);
  });

  await runTest("todos os itens têm sourceKind 'synthetic_visual_example'", () => {
    allItems.forEach((it) => {
      assertEqual(it.sourceKind, "synthetic_visual_example");
    });
  });

  await runTest("todos os valores monetários são centavos inteiros seguros", () => {
    allItems.forEach((it) => {
      assertTrue(Number.isSafeInteger(it.unitPriceCents) && it.unitPriceCents >= 0, `${it.code}: unitPriceCents inválido`);
      assertTrue(Number.isSafeInteger(it.totalCents) && it.totalCents >= 0, `${it.code}: totalCents inválido`);
    });
    groups.forEach((group) => {
      assertTrue(Number.isSafeInteger(group.subtotalCents) && group.subtotalCents >= 0, `${group.label}: subtotalCents inválido`);
    });
  });

  await runTest("cada linha é consistente: quantidade inteira × preço unitário == total (aritmética inteira)", () => {
    allItems.forEach((it) => {
      const quantity = parseQuantity(it.quantityDisplay);
      assertTrue(Number.isSafeInteger(quantity) && quantity > 0, `${it.code}: quantidade inválida "${it.quantityDisplay}"`);
      assertEqual(quantity * it.unitPriceCents, it.totalCents);
    });
  });

  await runTest("subtotal de cada grupo é a soma inteira dos totais dos seus itens", () => {
    groups.forEach((group) => {
      const sum = group.items.reduce((total, it) => total + it.totalCents, 0);
      assertEqual(sum, group.subtotalCents);
    });
  });

  await runTest("nenhum valor sintético se aproxima ou coincide com os totais principais da demonstração", () => {
    const grandSyntheticTotal = groups.reduce((total, group) => total + group.subtotalCents, 0);
    assertTrue(
      grandSyntheticTotal !== BUDGET_DEMONSTRATION_DATA.officialBudget.cents,
      "soma sintética não pode coincidir com o orçamento oficial"
    );
    assertTrue(
      grandSyntheticTotal !== BUDGET_DEMONSTRATION_DATA.proposalValue.cents,
      "soma sintética não pode coincidir com a proposta"
    );
    assertTrue(grandSyntheticTotal < BUDGET_DEMONSTRATION_DATA.officialBudget.cents, "amostra sintética deve ser ordens de grandeza menor que o orçamento oficial");
  });

  await runTest("nomes reais de cliente/obra/órgão não aparecem na amostra sintética", () => {
    const serialized = JSON.stringify(BUDGET_WORKSHEET_SAMPLE).toLowerCase();
    assertTrue(!serialized.includes("lagoa do arroz"), "não deve citar o nome do projeto real");
    assertTrue(!serialized.includes("dnocs"), "não deve citar o nome do órgão real");
    assertTrue(!serialized.includes("2f engenharia"), "não deve citar o nome do cliente real");
  });
}

async function runTest(name: string, testCase: () => void): Promise<void> {
  testCase();
  console.log(`ok - ${name}`);
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
