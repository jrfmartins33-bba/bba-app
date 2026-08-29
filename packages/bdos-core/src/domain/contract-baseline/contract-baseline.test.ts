import {
  createContractBaseline,
  reconcileContractBaselineMath,
  formatContractedValuePtBr,
  formatRoundingAdjustmentPtBr,
  formatDerivedItemsTotalPtBr,
  formatHistoricalOfficialBudgetPtBr,
} from "./contract-baseline";
import { ContractBaselineStatus } from "./contract-baseline.types";

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`ok - ${name}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertThrows(fn: () => void, expectedSnippet: string): void {
  try {
    fn();
    throw new Error(`Expected function to throw with snippet "${expectedSnippet}", but it did not throw.`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes(expectedSnippet)) {
      return;
    }
    throw error;
  }
}

// Test: Caso Lagoa do Arroz — Contratado R$ 7.611.851,65 (761185165 cents) vs Soma 7.611.852,11454550 e Ajuste -0,46454550
runTest("base contratual da Lagoa do Arroz: autoridade em centavos, soma derivada e ajuste reconciliam com precisão exata", () => {
  const baseline = createContractBaseline({
    id: "baseline-lagoa-001",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7", // Hidromec
    engineeringProjectId: "proj-lagoa-do-arroz",
    procurementCaseId: "proc-lagoa-do-arroz",
    contractNumber: "Contrato nº 22/2025",
    contractorNameSnapshot: "CONSÓRCIO CONJASF-HIDROMEC LAGOA DO ARROZ/PB",
    consortiumId: "consortium-conjasf-hidromec",
    sourceBudgetVersionId: null,
    status: ContractBaselineStatus.InExecution,
    contractedValueCents: 761185165,
    derivedItemsTotalDecimal: "7611852.11454550",
    contractualRoundingAdjustmentDecimal: "-0.46454550",
    historicalOfficialBudgetCents: 980908718,
  });

  // Valor contratado autoritativo em centavos
  assert(baseline.contractedValueCents === 761185165, "contractedValueCents deve ser 761185165");

  // Soma derivada é R$ 7.611.852,11454550
  assert(baseline.derivedItemsTotalDecimal === "7611852.11454550", "derivedItemsTotalDecimal deve ser 7611852.11454550");

  // Ajuste -0.46454550 reconcilia exatamente
  assert(baseline.contractualRoundingAdjustmentDecimal === "-0.46454550", "ajuste contratual deve ser -0.46454550");
  const math = reconcileContractBaselineMath(761185165, "7611852.11454550", "-0.46454550");
  assert(math.matches === true, "reconciliação matemática exata deve bater");

  // Orçamento oficial do certame histórico permanece como referência
  assert(baseline.historicalOfficialBudgetCents === 980908718, "orçamento oficial histórico deve ser 980908718 centavos");
  assert(baseline.contractorNameSnapshot === "CONSÓRCIO CONJASF-HIDROMEC LAGOA DO ARROZ/PB", "snapshot do contratado correto");
  assert(baseline.sourceBudgetVersionId === null, "sourceBudgetVersionId pode ser null");
});

// Test: Apresentação monetária resulta em: R$ 7.611.851,65 e - R$ 0,46
runTest("apresentação monetária para usuário exibe R$ 7.611.851,65 e - R$ 0,46", () => {
  const baseline = createContractBaseline({
    id: "baseline-lagoa-001",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    engineeringProjectId: "proj-lagoa-do-arroz",
    contractNumber: "Contrato nº 22/2025",
    contractorNameSnapshot: "CONSÓRCIO CONJASF-HIDROMEC LAGOA DO ARROZ/PB",
    contractedValueCents: 761185165,
    derivedItemsTotalDecimal: "7611852.11454550",
    contractualRoundingAdjustmentDecimal: "-0.46454550",
    historicalOfficialBudgetCents: 980908718,
  });

  const formattedContracted = formatContractedValuePtBr(baseline);
  assert(
    formattedContracted.includes("7.611.851,65"),
    `valor contratado formatado deve conter 7.611.851,65 (obtido: ${formattedContracted})`,
  );

  const formattedAdjustment = formatRoundingAdjustmentPtBr(baseline);
  assert(
    formattedAdjustment.includes("0,46") && formattedAdjustment.startsWith("-"),
    `ajuste formatado deve ser - R$ 0,46 (obtido: ${formattedAdjustment})`,
  );

  const formattedDerived = formatDerivedItemsTotalPtBr(baseline);
  assert(
    formattedDerived.includes("7.611.852,11"),
    `soma dos itens formatada deve ser R$ 7.611.852,11 (obtido: ${formattedDerived})`,
  );

  const formattedHistorical = formatHistoricalOfficialBudgetPtBr(baseline);
  assert(
    formattedHistorical !== null && formattedHistorical.includes("9.809.087,18"),
    `orçamento histórico deve ser R$ 9.809.087,18 (obtido: ${formattedHistorical})`,
  );
});

// Test: Contratos acima de R$ 100 milhões com precisão NUMERIC(20,8)
runTest("base contratual suporta contratos acima de R$ 100 milhões com precisão exata", () => {
  // Exemplo: Contrato de R$ 250.000.000,00 (25000000000 cents)
  // Soma derivada: R$ 250.000.000,75321890, Ajuste: -R$ 0,75321890
  const largeBaseline = createContractBaseline({
    id: "baseline-large-001",
    organizationId: "org-large",
    engineeringProjectId: "proj-large",
    contractNumber: "Contrato Megaprojeto nº 99/2026",
    contractorNameSnapshot: "CONSÓRCIO INFRAESTRUTURA BRASIL",
    contractedValueCents: 25000000000, // R$ 250 milhões
    derivedItemsTotalDecimal: "250000000.75321890",
    contractualRoundingAdjustmentDecimal: "-0.75321890",
  });

  assert(largeBaseline.contractedValueCents === 25000000000, "deve manter 250 milhões em centavos");
  const formatted = formatContractedValuePtBr(largeBaseline);
  assert(formatted.includes("250.000.000,00"), `deve formatar R$ 250 milhões corretamente (obtido: ${formatted})`);

  const math = reconcileContractBaselineMath(25000000000, "250000000.75321890", "-0.75321890");
  assert(math.matches === true, "reconciliação de 250 milhões deve bater perfeitamente");
});

// Test: Rejeição se os valores não baterem matematicamente
runTest("base contratual rejeita valores que não reconciliam matematicamente", () => {
  assertThrows(
    () =>
      createContractBaseline({
        id: "baseline-err",
        organizationId: "org-1",
        engineeringProjectId: "proj-1",
        contractNumber: "Contrato nº 01/2025",
        contractorNameSnapshot: "Empresa X",
        contractedValueCents: 761185165,
        derivedItemsTotalDecimal: "7611852.11454550",
        contractualRoundingAdjustmentDecimal: "-1.00000000", // Errado, soma resulta em 7611851.11454550 != 7611851.65
      }),
    "Contract baseline values do not reconcile",
  );
});
