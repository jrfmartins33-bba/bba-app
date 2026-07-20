import { characterizeBudgetDocumentEconomicStructure } from "./characterize-budget-document-economic-structure";
import { budgetTableGroup, budgetTablePage, budgetTableRegion, economicCharacterizationInputFromGroups } from "./testing/budget-document-economic-characterization-fixture-builders";
import type { IndependentBudgetReferenceLine } from "./budget-document-economic-characterization.types";

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const HEADER: ReadonlyArray<string | null> = ["ITEM", "DESCRIÇÃO", "UNID", "QUANT.", "PREÇO UNIT", "TOTAL"];

// --- cenário principal: cabeçalho + Grupo + Subgrupo + Item + item sem código (estilo COT-015) ---

const rows: ReadonlyArray<ReadonlyArray<string | null>> = [
  HEADER,
  ["01.00.00", "GRUPO PRINCIPAL", null, null, null, "R$ 1.500,00"],
  ["01.01.00", "Subgrupo A", null, null, null, null],
  ["01.01.01", "Escavação manual", "M3", "10,00", "R$ 50,00", "R$ 500,00"],
  ["01.01.02", "Concreto usinado", "M3", "5,50", "R$ 100,00", "R$ 550,00"],
  [null, "Item de cotação avulsa sem código hierárquico", "UN", "1,00", "R$ 450,00", "R$ 450,00"],
];

const region = budgetTableRegion("R1", 1, 1, rows, { leftPoints: 0, rightPoints: 100, widthPoints: 100 });
const group = budgetTableGroup("G1", [budgetTablePage(1, [region])]);
const input = economicCharacterizationInputFromGroups([group]);
const result = characterizeBudgetDocumentEconomicStructure(input);

equal(result.status, "characterized", "a clean, well-formed synthetic table must characterize without global problems");
equal(result.metrics.headerCount, 1, "exactly one header line must be recognized");
equal(result.metrics.groupCount, 1, "exactly one group line must be recognized");
equal(result.metrics.subgroupCount, 1, "exactly one subgroup line must be recognized");
equal(result.metrics.serviceItemCount, 3, "exactly three service item lines must be recognized (two coded, one uncoded)");

const group1 = result.proposedLines.find((l) => l.type === "group")!;
equal(group1.externalCode, "01.00.00", "group external code must be preserved verbatim");
equal(group1.parentProposedLineId, null, "a group must never have a parent");
equal(group1.parentResolutionMethod, "TopLevelNoParent", "group parent resolution method must be TopLevelNoParent");

const subgroup1 = result.proposedLines.find((l) => l.type === "subgroup")!;
equal(subgroup1.parentProposedLineId, group1.proposedLineId, "the subgroup must resolve its parent to the open group");
equal(subgroup1.parentResolutionMethod, "HierarchicalCode", "subgroup parent resolution method must be HierarchicalCode");

const codedItem = result.proposedLines.find((l) => l.externalCode === "01.01.01")!;
equal(codedItem.parentProposedLineId, subgroup1.proposedLineId, "a coded item must resolve its parent to the open subgroup via hierarchical code");
equal(codedItem.quantity.status, "parsed", "quantity must parse");
equal(codedItem.quantity.exactDecimalText, "10.00", "quantity exact decimal text must be preserved with its original scale");
equal(codedItem.unitPrice.cents, 5000, "unit price must parse to exact cents (R$ 50,00 -> 5000)");
equal(codedItem.total.cents, 50000, "total must parse to exact cents (R$ 500,00 -> 50000)");
equal(codedItem.extractionStatus, "extracted", "a fully populated, reconciled item must be extracted");

const uncodedItem = result.proposedLines.find((l) => l.externalCode === null && l.type === "service_item")!;
equal(uncodedItem.parentProposedLineId, subgroup1.proposedLineId, "an item without a hierarchical code must inherit the currently open subgroup — DocumentPositionSection");
equal(uncodedItem.parentResolutionMethod, "DocumentPositionSection", "the uncoded item's parent resolution method must be DocumentPositionSection, never HierarchicalCode");

// --- reconciliação: quantidade x preço unitário == total, sem arredondamento ---

const codedReconciliation = result.lineReconciliations.find((r) => r.proposedLineId === codedItem.proposedLineId)!;
equal(codedReconciliation.status, "reconciled", "10,00 x R$50,00 = R$500,00 exactly — must reconcile with zero difference");
equal(codedReconciliation.recalculatedTotalCents, 50000, "recalculated total must match the declared total exactly");

const second = result.proposedLines.find((l) => l.externalCode === "01.01.02")!;
const secondReconciliation = result.lineReconciliations.find((r) => r.proposedLineId === second.proposedLineId)!;
equal(secondReconciliation.status, "reconciled", "5,50 x R$100,00 = R$550,00 exactly — must reconcile");

// --- fingerprint determinístico ---
const again = characterizeBudgetDocumentEconomicStructure(input);
equal(again.resultFingerprint, result.resultFingerprint, "identical input must produce an identical result fingerprint");
equal(again.identityFingerprint, result.identityFingerprint, "identical input must produce an identical identity fingerprint");

// --- referência independente: diff linha a linha ---

const referenceLines: ReadonlyArray<IndependentBudgetReferenceLine> = [
  { externalCode: null, hierarchicalCode: "01.00.00", classification: "group", description: "GRUPO PRINCIPAL", unit: null, quantityDecimalText: null, totalCents: 150000 },
  { externalCode: null, hierarchicalCode: "01.01.00", classification: "subgroup", description: "Subgrupo A", unit: null, quantityDecimalText: null, totalCents: null },
  { externalCode: "01.01.01", hierarchicalCode: "01.01.01", classification: "service_item", description: "Escavação manual", unit: "M3", quantityDecimalText: "10.00", totalCents: 50000 },
  { externalCode: "01.01.02", hierarchicalCode: "01.01.02", classification: "service_item", description: "Concreto usinado", unit: "M3", quantityDecimalText: "5.50", totalCents: 55000 },
  // referência inclui um item que a extração NÃO tem — deve aparecer como missing.
  { externalCode: "99.99.99", hierarchicalCode: "99.99.99", classification: "service_item", description: "Item inexistente na extração", unit: "UN", quantityDecimalText: "1.00", totalCents: 100 },
];

const withReference = characterizeBudgetDocumentEconomicStructure(input, { referenceLines, referenceSourceDescription: "referência sintética de teste" });
equal(withReference.independentReferenceDiff.availability, "available", "when reference lines are supplied, availability must be 'available'");
const matched = withReference.independentReferenceDiff.entries.filter((e) => e.outcome === "matched");
equal(matched.length, 4, "four reference lines must match extracted lines by code");
const missing = withReference.independentReferenceDiff.entries.filter((e) => e.outcome === "missing_from_extraction");
equal(missing.length, 1, "the reference-only item (99.99.99) must be reported missing_from_extraction");
equal(missing[0].referenceExternalCode, "99.99.99", "the missing entry must identify the exact reference code");
const extra = withReference.independentReferenceDiff.entries.filter((e) => e.outcome === "extra_in_extraction");
equal(extra.length, 1, "the uncoded item (present in extraction, absent from reference) must be reported extra_in_extraction");

// --- ausência de referência independente: nunca finge faltante/excedente contra si mesma ---

const withoutReference = characterizeBudgetDocumentEconomicStructure(input);
equal(withoutReference.independentReferenceDiff.availability, "unavailable", "without a supplied reference, availability must be 'unavailable'");
equal(withoutReference.independentReferenceDiff.entries.length, 0, "without a reference, no diff entries may ever be produced");
equal(withoutReference.selfConsistencyDiagnostic.ambiguousLineCount, 0, "a clean synthetic table must have zero ambiguous lines in the self-consistency diagnostic");

// --- sinal de continuidade não sustentada nunca funde estrutura entre páginas ---

const page2Rows: ReadonlyArray<ReadonlyArray<string | null>> = [
  ["01.01.03", "Item de página 2 sem cabeçalho local", "M3", "2,00", "R$ 10,00", "R$ 20,00"],
];
const region2 = budgetTableRegion("R2", 2, 1, page2Rows, { leftPoints: 900, rightPoints: 990, widthPoints: 90 }); // geometria deliberadamente incompatível
const multiPageGroup = budgetTableGroup("G2", [budgetTablePage(1, [region]), budgetTablePage(2, [region2])]);
const multiPageInput = economicCharacterizationInputFromGroups([multiPageGroup]);
equal(multiPageInput.pageBoundaryNeutralContinuity.evaluations[0].status !== "continuity_sustained", true, "sanity: the deliberately incompatible geometry must not sustain continuity");
const multiPageResult = characterizeBudgetDocumentEconomicStructure(multiPageInput);
const page2Line = multiPageResult.proposedLines.find((l) => l.provenance.pageNumber === 2)!;
equal(page2Line.type === "ambiguous" || page2Line.extractionStatus === "requires_review", true, "without a header on page 2 and without sustained continuity from page 1, the line must never be silently classified as a confident service_item");

console.log("ok - end-to-end economic characterization: header/group/subgroup/item recognition, COT-015-style uncoded item positional inheritance, Brazilian money/quantity parsing, quantity x price = total reconciliation, fingerprint determinism, independent reference diff (matched/missing/extra), self-consistency diagnostic when no reference is supplied, and non-sustained cross-page continuity never silently carrying column roles forward");
