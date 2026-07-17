import { BUDGET_DEMONSTRATION_DATA } from "./budget-demonstration-data";

/**
 * Epic 21, Sprint 21.4B.1 — confere os valores confirmados do caso de
 * caracterização do Epic 21 usados na demonstração de Orçamento, e que
 * nenhuma soma/diferença é feita com ponto flutuante (comparação sempre
 * por centavos inteiros, mesma regra de budget-version-money.ts).
 */

async function main(): Promise<void> {
  const data = BUDGET_DEMONSTRATION_DATA;

  await runTest("sourceKind é 'demonstration'", () => {
    assertEqual(data.sourceKind, "demonstration");
  });

  await runTest("orçamento oficial confirmado", () => {
    assertEqual(data.officialBudget.cents, 980_908_718);
    assertEqual(data.officialBudget.displayValue, "R$ 9.809.087,18");
  });

  await runTest("proposta confirmada", () => {
    assertEqual(data.proposalValue.cents, 761_185_165);
    assertEqual(data.proposalValue.displayValue, "R$ 7.611.851,65");
  });

  await runTest("redução confirmada", () => {
    assertEqual(data.reductionPercentDisplay, "22,40%");
  });

  await runTest("diferença confirmada e consistente com centavos inteiros (sem ponto flutuante)", () => {
    assertEqual(data.differenceValue.cents, 219_723_553);
    assertEqual(data.differenceValue.displayValue, "R$ 2.197.235,53");
    assertTrue(
      Number.isSafeInteger(data.officialBudget.cents) &&
        Number.isSafeInteger(data.proposalValue.cents) &&
        Number.isSafeInteger(data.differenceValue.cents),
      "todos os valores monetários devem ser inteiros seguros (centavos)"
    );
    assertEqual(data.officialBudget.cents - data.proposalValue.cents, data.differenceValue.cents);
  });

  await runTest("hierarquia confirmada (11 grupos, 25 subgrupos, 300 itens de serviço)", () => {
    assertEqual(data.groupCount, 11);
    assertEqual(data.subgroupCount, 25);
    assertEqual(data.serviceItemCount, 300);
  });

  await runTest("nenhum serviço de simulação real está disponível nesta Sprint", () => {
    assertEqual(data.simulationServiceAvailable, false);
  });

  await runTest("etapas usam somente o vocabulário corrigido (available/awaiting_review/next_step)", () => {
    const allowedStates = new Set(["available", "awaiting_review", "next_step"]);
    data.journey.forEach((step) => {
      assertTrue(allowedStates.has(step.state), `estado de etapa inesperado: "${step.state}"`);
    });
    assertEqual(data.journey.filter((step) => step.state === "awaiting_review").length, 1);
    assertEqual(data.journey.filter((step) => step.state === "next_step").length, 1);
  });

  await runTest("nome do cliente/obra real não aparece na demonstração", () => {
    const serialized = JSON.stringify(data).toLowerCase();
    assertTrue(!serialized.includes("lagoa do arroz"), "não deve expor o nome do projeto real na demonstração");
    assertTrue(!serialized.includes("dnocs"), "não deve expor o nome do órgão real na demonstração");
    assertTrue(!serialized.includes("2f engenharia"), "não deve expor o nome do cliente real na demonstração");
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
