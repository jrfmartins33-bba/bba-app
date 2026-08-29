import type { BudgetComparedItem } from "@bba/bdos-core/services/procurement-engineering";
import { buildLineIndex, buildVisibleLineIds, formatCanonicalQuantityPtBr, formatDocumentUnitPtBr, type OfficialBudgetDto, type OfficialLine } from "./official-budget-comparison-view-model";

const group: OfficialLine = { id: "g", kind: "Group", description: { status: "Confirmed", text: "Grupo" }, externalCode: "01", parentLineId: null, position: 0, totalCents: null };
const items: OfficialLine[] = [
  { id: "r", kind: "ServiceItem", description: { status: "Confirmed", text: "Concreto armado" }, externalCode: "SIN-01", parentLineId: "g", position: 0, totalCents: 800 },
  { id: "i", kind: "ServiceItem", description: { status: "Confirmed", text: "Aço estrutural" }, externalCode: "SIN-02", parentLineId: "g", position: 1, totalCents: 1_200 },
  { id: "d", kind: "ServiceItem", description: { status: "Confirmed", text: "Instalação elétrica" }, externalCode: "COT-03", parentLineId: "g", position: 2, totalCents: 900 },
];
const budget: OfficialBudgetDto = { id: "proposal", status: "Consolidated", lines: [group, ...items] };
const comparisons = new Map<string, BudgetComparedItem>([
  ["r", compared("r", "Reduction")],
  ["i", compared("i", "Increase")],
  ["d", compared("d", "Divergence")],
]);
const { linesById } = buildLineIndex(budget.lines);

runTest("filtro de redução mantém apenas o item e seus ancestrais", () => {
  const visible = buildVisibleLineIds({ budget, comparisonByLineId: comparisons, linesById, comparisonMode: true, filter: "Reduction", search: "" });
  assertEqual(Array.from(visible).sort().join(","), "g,r");
});

runTest("busca ignora acentos e encontra por descrição", () => {
  const visible = buildVisibleLineIds({ budget, comparisonByLineId: comparisons, linesById, comparisonMode: true, filter: "All", search: "aco estrutural" });
  assertEqual(Array.from(visible).sort().join(","), "g,i");
});

runTest("busca por código combina corretamente com filtro", () => {
  const visible = buildVisibleLineIds({ budget, comparisonByLineId: comparisons, linesById, comparisonMode: true, filter: "Divergence", search: "COT-03" });
  assertEqual(Array.from(visible).sort().join(","), "d,g");
});

runTest("modo proposta preserva integralmente a árvore", () => {
  const visible = buildVisibleLineIds({ budget, comparisonByLineId: comparisons, linesById, comparisonMode: false, filter: "Increase", search: "inexistente" });
  assertEqual(visible.size, 4);
});

runTest("formata quantidades canônicas em pt-BR sem expor resíduos decimais", () => {
  assertEqual(formatCanonicalQuantityPtBr("808.84"), "808,84");
  assertEqual(formatCanonicalQuantityPtBr("10874.88"), "10.874,88");
  assertEqual(formatCanonicalQuantityPtBr("5.857875"), "5,857875");
  assertEqual(formatCanonicalQuantityPtBr(null), "Não informada");
});

runTest("apresenta unidades documentais em notação técnica legível", () => {
  assertEqual(formatDocumentUnitPtBr("M2"), "M²");
  assertEqual(formatDocumentUnitPtBr("M3"), "M³");
  assertEqual(formatDocumentUnitPtBr("TKM"), "TKM");
  assertEqual(formatDocumentUnitPtBr(null), "Não informada");
});

function compared(proposalLineId: string, classification: BudgetComparedItem["classification"]): BudgetComparedItem {
  return {
    proposalLineId, officialLineId: `official-${proposalLineId}`, matchMethod: "UniqueExternalCode", unmatchedReason: null,
    classification, proposalPosition: 0, proposalParentLineId: "g", proposalCode: proposalLineId, officialCode: proposalLineId,
    proposalDescription: proposalLineId, officialDescription: proposalLineId, proposalQuantity: "1", officialQuantity: "1", proposalUnit: "UN", officialUnit: "UN",
    codeDiffers: false, descriptionDiffers: false, quantityDiffers: false, unitDiffers: false,
    quantityNormalizedForComparison: false, documentDivergences: [],
    unitPrice: { officialCents: 100, winnerCents: 90, differenceCents: 10, percentageBasisPoints: 1_000 },
    total: { officialCents: 100, winnerCents: 90, differenceCents: 10, percentageBasisPoints: 1_000 },
  };
}

function runTest(name: string, testCase: () => void): void { testCase(); console.log(`ok - ${name}`); }
function assertEqual<T>(actual: T, expected: T): void { if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`); }
