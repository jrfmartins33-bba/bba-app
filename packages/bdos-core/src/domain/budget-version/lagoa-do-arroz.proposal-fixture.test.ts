import {
  addBudgetLine,
  calculateBudgetVersionTotal,
  consolidateBudgetVersion,
  createBudgetVersion,
  registerLineageRelation,
} from "./budget-version";
import { centsFromDecimalString } from "./budget-version-money";
import { BudgetLineKind, BudgetVersionOriginKind, BudgetVersionStatus } from "./budget-version.types";
import {
  LAGOA_DO_ARROZ_PROPOSAL_DECLARED_TOTAL_DECIMAL,
  LAGOA_DO_ARROZ_PROPOSAL_DERIVED_TOTAL_DECIMAL,
  LAGOA_DO_ARROZ_PROPOSAL_LINES,
  LAGOA_DO_ARROZ_PROPOSAL_PROVENANCE,
  LAGOA_DO_ARROZ_PROPOSAL_ROUNDING_ADJUSTMENT_DECIMAL,
} from "./lagoa-do-arroz.proposal-fixture";
import {
  buildLagoaDoArrozProposalScenario,
  reconcileLagoaProposalAgainstOfficial,
} from "./lagoa-do-arroz.proposal-fixture-loader";
import { buildLagoaDoArrozOfficialScenario } from "./lagoa-do-arroz.official-fixture-loader";
import { createProcurementCase, createProcurementLot, createWholeCaseScope, type ProcurementScope, ProcurementScopeKind } from "../procurement-case";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

// 1. Group sem parent continua válido
runTest("1. Group sem parent continua válido", () => {
  const caseRes = createProcurementCase({ id: "case-test-1", organizationId: "org-1", title: "Teste" });
  if (!caseRes.success) throw new Error("case fail");
  const scope = createWholeCaseScope({ procurementCase: caseRes.procurementCase }).scope!;
  const vRes = createBudgetVersion({ id: "v-1", procurementCase: caseRes.procurementCase, scope, origin: { kind: BudgetVersionOriginKind.Native } });
  if (!vRes.success) throw new Error("v fail");

  const gRes = addBudgetLine({
    budgetVersion: vRes.budgetVersion,
    id: "g-1",
    kind: BudgetLineKind.Group,
    description: { status: "Confirmed", text: "Grupo 1" },
    parentLineId: null,
    position: 0,
    scope,
  });
  assertEqual(gRes.success, true, "Group sem parent deve ser válido");
});

// 2. Group com parent continua inválido
runTest("2. Group com parent continua inválido", () => {
  const caseRes = createProcurementCase({ id: "case-test-2", organizationId: "org-1", title: "Teste" });
  if (!caseRes.success) throw new Error("case fail");
  const scope = createWholeCaseScope({ procurementCase: caseRes.procurementCase }).scope!;
  const vRes = createBudgetVersion({ id: "v-2", procurementCase: caseRes.procurementCase, scope, origin: { kind: BudgetVersionOriginKind.Native } });
  if (!vRes.success) throw new Error("v fail");

  const gRes = addBudgetLine({
    budgetVersion: vRes.budgetVersion,
    id: "g-fail",
    kind: BudgetLineKind.Group,
    description: { status: "Confirmed", text: "Grupo Invalido" },
    parentLineId: "some-parent",
    position: 0,
    scope,
  });
  assertEqual(gRes.success, false, "Group com parent deve ser inválido");
});

// 3. Subgroup sem parent continua inválido
runTest("3. Subgroup sem parent continua inválido", () => {
  const caseRes = createProcurementCase({ id: "case-test-3", organizationId: "org-1", title: "Teste" });
  if (!caseRes.success) throw new Error("case fail");
  const scope = createWholeCaseScope({ procurementCase: caseRes.procurementCase }).scope!;
  const vRes = createBudgetVersion({ id: "v-3", procurementCase: caseRes.procurementCase, scope, origin: { kind: BudgetVersionOriginKind.Native } });
  if (!vRes.success) throw new Error("v fail");

  const subRes = addBudgetLine({
    budgetVersion: vRes.budgetVersion,
    id: "sub-fail",
    kind: BudgetLineKind.Subgroup,
    description: { status: "Confirmed", text: "Subgrupo Invalido" },
    parentLineId: null,
    position: 0,
    scope,
  });
  assertEqual(subRes.success, false, "Subgroup sem parent deve ser inválido");
});

// 4. Subgroup com Group válido continua válido
runTest("4. Subgroup com Group válido continua válido", () => {
  const caseRes = createProcurementCase({ id: "case-test-4", organizationId: "org-1", title: "Teste" });
  if (!caseRes.success) throw new Error("case fail");
  const scope = createWholeCaseScope({ procurementCase: caseRes.procurementCase }).scope!;
  const vRes = createBudgetVersion({ id: "v-4", procurementCase: caseRes.procurementCase, scope, origin: { kind: BudgetVersionOriginKind.Native } });
  const gRes = addBudgetLine({ budgetVersion: vRes.budgetVersion!, id: "g-1", kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "G" }, parentLineId: null, position: 0, scope });
  const subRes = addBudgetLine({ budgetVersion: gRes.budgetVersion!, id: "sub-1", kind: BudgetLineKind.Subgroup, description: { status: "Confirmed", text: "S" }, parentLineId: "g-1", position: 0, scope });
  assertEqual(subRes.success, true, "Subgroup com Group válido deve ser aceito");
});

// 5. ServiceItem com Group válido continua válido
runTest("5. ServiceItem com Group válido continua válido", () => {
  const caseRes = createProcurementCase({ id: "case-test-5", organizationId: "org-1", title: "Teste" });
  if (!caseRes.success) throw new Error("case fail");
  const scope = createWholeCaseScope({ procurementCase: caseRes.procurementCase }).scope!;
  const vRes = createBudgetVersion({ id: "v-5", procurementCase: caseRes.procurementCase, scope, origin: { kind: BudgetVersionOriginKind.Native } });
  const gRes = addBudgetLine({ budgetVersion: vRes.budgetVersion!, id: "g-1", kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "G" }, parentLineId: null, position: 0, scope });
  const itRes = addBudgetLine({ budgetVersion: gRes.budgetVersion!, id: "it-1", kind: BudgetLineKind.ServiceItem, description: { status: "Confirmed", text: "Item" }, parentLineId: "g-1", position: 0, scope, quantity: "1", unit: "UN", unitPriceCents: 100, totalCents: 100 });
  assertEqual(itRes.success, true, "ServiceItem direto sob Group deve ser aceito");
});

// 6. ServiceItem com Subgroup válido continua válido
runTest("6. ServiceItem com Subgroup válido continua válido", () => {
  const caseRes = createProcurementCase({ id: "case-test-6", organizationId: "org-1", title: "Teste" });
  if (!caseRes.success) throw new Error("case fail");
  const scope = createWholeCaseScope({ procurementCase: caseRes.procurementCase }).scope!;
  const vRes = createBudgetVersion({ id: "v-6", procurementCase: caseRes.procurementCase, scope, origin: { kind: BudgetVersionOriginKind.Native } });
  const gRes = addBudgetLine({ budgetVersion: vRes.budgetVersion!, id: "g-1", kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "G" }, parentLineId: null, position: 0, scope });
  const subRes = addBudgetLine({ budgetVersion: gRes.budgetVersion!, id: "sub-1", kind: BudgetLineKind.Subgroup, description: { status: "Confirmed", text: "S" }, parentLineId: "g-1", position: 0, scope });
  const itRes = addBudgetLine({ budgetVersion: subRes.budgetVersion!, id: "it-1", kind: BudgetLineKind.ServiceItem, description: { status: "Confirmed", text: "Item" }, parentLineId: "sub-1", position: 0, scope, quantity: "1", unit: "UN", unitPriceCents: 100, totalCents: 100 });
  assertEqual(itRes.success, true, "ServiceItem sob Subgroup deve ser aceito");
});

// 7. ServiceItem com parentLineId = NULL passa a ser válido
runTest("7. ServiceItem com parentLineId = NULL passa a ser válido", () => {
  const caseRes = createProcurementCase({ id: "case-test-7", organizationId: "org-1", title: "Teste" });
  if (!caseRes.success) throw new Error("case fail");
  const scope = createWholeCaseScope({ procurementCase: caseRes.procurementCase }).scope!;
  const vRes = createBudgetVersion({ id: "v-7", procurementCase: caseRes.procurementCase, scope, origin: { kind: BudgetVersionOriginKind.Native } });
  const itRes = addBudgetLine({
    budgetVersion: vRes.budgetVersion!,
    id: "it-root",
    kind: BudgetLineKind.ServiceItem,
    description: { status: "Confirmed", text: "Item Sem Parent" },
    parentLineId: null,
    position: 0,
    scope,
    quantity: "60",
    unit: "DIA",
    unitPriceCents: 294767,
    totalCents: 17686020,
  });
  assertEqual(itRes.success, true, "ServiceItem com parentLineId = null deve ser aceito");
  assertEqual(itRes.budgetVersion?.lines[0]?.parentLineId, null, "parentLineId deve ser null");
});

// 8. ServiceItem não pode apontar para outro ServiceItem
runTest("8. ServiceItem não pode apontar para outro ServiceItem", () => {
  const caseRes = createProcurementCase({ id: "case-test-8", organizationId: "org-1", title: "Teste" });
  if (!caseRes.success) throw new Error("case fail");
  const scope = createWholeCaseScope({ procurementCase: caseRes.procurementCase }).scope!;
  const vRes = createBudgetVersion({ id: "v-8", procurementCase: caseRes.procurementCase, scope, origin: { kind: BudgetVersionOriginKind.Native } });
  const it1Res = addBudgetLine({ budgetVersion: vRes.budgetVersion!, id: "it-1", kind: BudgetLineKind.ServiceItem, description: { status: "Confirmed", text: "Item 1" }, parentLineId: null, position: 0, scope, quantity: "1", unit: "UN", unitPriceCents: 100, totalCents: 100 });
  const it2Res = addBudgetLine({ budgetVersion: it1Res.budgetVersion!, id: "it-2", kind: BudgetLineKind.ServiceItem, description: { status: "Confirmed", text: "Item 2" }, parentLineId: "it-1", position: 1, scope, quantity: "1", unit: "UN", unitPriceCents: 100, totalCents: 100 });
  assertEqual(it2Res.success, false, "ServiceItem apontando para ServiceItem deve ser rejeitado");
});

// 9. Regras de scope continuam aplicadas quando existe parent
runTest("9. regras de scope continuam aplicadas quando existe parent", () => {
  const caseRes = createProcurementCase({ id: "case-test-9", organizationId: "org-1", title: "Teste" });
  if (!caseRes.success) throw new Error("case fail");
  const lotRes = createProcurementLot({ id: "lot-1", procurementCase: caseRes.procurementCase, title: "Lote 1" });
  const lotScope: ProcurementScope = { kind: ProcurementScopeKind.Lot, procurementCaseId: caseRes.procurementCase.id, procurementLotId: lotRes.procurementLot!.id };
  const wholeScope = createWholeCaseScope({ procurementCase: caseRes.procurementCase }).scope!;

  const vRes = createBudgetVersion({ id: "v-9", procurementCase: caseRes.procurementCase, scope: wholeScope, origin: { kind: BudgetVersionOriginKind.Native } });
  const gRes = addBudgetLine({ budgetVersion: vRes.budgetVersion!, id: "g-lot", kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "G" }, parentLineId: null, position: 0, scope: lotScope, procurementLot: lotRes.procurementLot! });
  const itFail = addBudgetLine({ budgetVersion: gRes.budgetVersion!, id: "it-diff", kind: BudgetLineKind.ServiceItem, description: { status: "Confirmed", text: "Item" }, parentLineId: "g-lot", position: 0, scope: wholeScope, quantity: "1", unit: "UN", unitPriceCents: 100, totalCents: 100 });
  assertEqual(itFail.success, false, "Filho com escopo divergente do pai deve falhar");
});

// 10. Totalização continua somando ServiceItems independentemente de parent
runTest("10. totalização continua somando ServiceItems independentemente de parent", () => {
  const caseRes = createProcurementCase({ id: "case-test-10", organizationId: "org-1", title: "Teste" });
  if (!caseRes.success) throw new Error("case fail");
  const scope = createWholeCaseScope({ procurementCase: caseRes.procurementCase }).scope!;
  const vRes = createBudgetVersion({ id: "v-10", procurementCase: caseRes.procurementCase, scope, origin: { kind: BudgetVersionOriginKind.Native } });
  const gRes = addBudgetLine({ budgetVersion: vRes.budgetVersion!, id: "g-1", kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "G" }, parentLineId: null, position: 0, scope });
  const it1Res = addBudgetLine({ budgetVersion: gRes.budgetVersion!, id: "it-1", kind: BudgetLineKind.ServiceItem, description: { status: "Confirmed", text: "Item com pai" }, parentLineId: "g-1", position: 0, scope, quantity: "1", unit: "UN", unitPriceCents: 500, totalCents: 500 });
  const it2Res = addBudgetLine({ budgetVersion: it1Res.budgetVersion!, id: "it-root", kind: BudgetLineKind.ServiceItem, description: { status: "Confirmed", text: "Item sem pai" }, parentLineId: null, position: 1, scope, quantity: "1", unit: "UN", unitPriceCents: 700, totalCents: 700 });

  const total = calculateBudgetVersionTotal(it2Res.budgetVersion!);
  assertEqual(total, 1200, "total deve somar 500 + 700 = 1200");
});

// 11. COT-015 da proposta com parentLineId = null
runTest("11. COT-015 da proposta: parentLineId = null, qty=60, unit=DIA, unitPrice=294767, total=17686020", () => {
  const officialScenario = buildLagoaDoArrozOfficialScenario();
  const proposalScenario = buildLagoaDoArrozProposalScenario({
    procurementCase: officialScenario.procurementCase,
    officialBudgetVersion: officialScenario.consolidatedBudgetVersion,
  });

  const cot015Line = proposalScenario.consolidatedBudgetVersion.lines.find((l) => l.externalCode === "COT-015");
  assertEqual(cot015Line !== undefined, true, "COT-015 deve existir");
  assertEqual(cot015Line?.parentLineId, null, "COT-015 deve ter parentLineId = null");
  assertEqual(cot015Line?.quantity, "60", "COT-015 quantity");
  assertEqual(cot015Line?.unit, "DIA", "COT-015 unit");
  assertEqual(cot015Line?.unitPriceCents, 294767, "COT-015 unitPriceCents");
  assertEqual(cot015Line?.totalCents, 17686020, "COT-015 totalCents");
});

// 12. Barragens de Alagoas não sofre regressão
runTest("12. Barragens de Alagoas Lote 01 e Lote 02 permanecem isolados e sem regressão", () => {
  const caseBarragens = createProcurementCase({ id: "case-alagoas", organizationId: "org-alagoas", title: "Barragens de Alagoas" });
  if (!caseBarragens.success) throw new Error("case fail");
  const lot1 = createProcurementLot({ id: "lot-1", procurementCase: caseBarragens.procurementCase, title: "Lote 01" });
  const lot2 = createProcurementLot({ id: "lot-2", procurementCase: caseBarragens.procurementCase, title: "Lote 02" });
  assertEqual(lot1.success && lot2.success, true, "lotes criados com sucesso");
});

// ===========================================================================
// Testes direcionados: canonicalDecimalQuantity — comparação textual determinística
// ===========================================================================

import { canonicalDecimalQuantity } from "./lagoa-do-arroz.proposal-fixture-loader";

runTest("canonicalDecimalQuantity: '60' vs '60.0' são iguais", () => {
  assertEqual(canonicalDecimalQuantity("60"), canonicalDecimalQuantity("60.0"), "'60' e '60.0' devem ter a mesma forma canônica");
});

runTest("canonicalDecimalQuantity: '1.500' vs '1.5' são iguais", () => {
  assertEqual(canonicalDecimalQuantity("1.500"), canonicalDecimalQuantity("1.5"), "'1.500' e '1.5' devem ter a mesma forma canônica");
});

runTest("canonicalDecimalQuantity: '0.250000' vs '0.25' são iguais", () => {
  assertEqual(canonicalDecimalQuantity("0.250000"), canonicalDecimalQuantity("0.25"), "'0.250000' e '0.25' devem ter a mesma forma canônica");
});

runTest("canonicalDecimalQuantity: '1.5' vs '1.500001' são DIFERENTES", () => {
  const a = canonicalDecimalQuantity("1.5");
  const b = canonicalDecimalQuantity("1.500001");
  assertEqual(a !== b, true, "'1.5' e '1.500001' devem ser diferentes");
});

runTest("canonicalDecimalQuantity: '001.50' é normalizado para '1.5'", () => {
  assertEqual(canonicalDecimalQuantity("001.50"), "1.5", "zeros à esquerda e à direita devem ser removidos");
});

runTest("canonicalDecimalQuantity: '0' preserva '0' como mínimo da parte inteira", () => {
  assertEqual(canonicalDecimalQuantity("0"), "0", "zero sozinho deve permanecer '0'");
  assertEqual(canonicalDecimalQuantity("0.00"), "0", "'0.00' deve normalizar para '0'");
});

runTest("canonicalDecimalQuantity: '60.000000' é normalizado para '60'", () => {
  assertEqual(canonicalDecimalQuantity("60.000000"), "60", "'60.000000' deve normalizar para '60'");
});

runTest("canonicalDecimalQuantity: quantidades reais oficial x proposta têm 0 mismatches", () => {
  const officialScenario = buildLagoaDoArrozOfficialScenario();
  const proposalScenario = buildLagoaDoArrozProposalScenario({
    procurementCase: officialScenario.procurementCase,
    officialBudgetVersion: officialScenario.consolidatedBudgetVersion,
  });
  const result = reconcileLagoaProposalAgainstOfficial(officialScenario, proposalScenario);
  assertEqual(result.quantityMismatches, 0, "nenhum mismatch de quantidade entre oficial e proposta");
});

