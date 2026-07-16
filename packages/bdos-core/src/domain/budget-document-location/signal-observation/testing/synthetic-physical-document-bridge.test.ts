import { buildSyntheticReferenceSuite } from "../../testing/synthetic-reference-suite";
import type { SyntheticPageReference, SyntheticReferenceDocument } from "../../testing/synthetic-reference-suite.types";
import { buildPhysicalDocumentReadResultFromSyntheticPages } from "./synthetic-physical-document-bridge";
import { observeDocumentSignals } from "../signal-observation";
import type { DocumentSignalObservationResult, SignalEvaluationOutcome } from "../signal-observation.types";

/**
 * Ponte mínima de teste (Sprint 21.4A.2.d, seção 27 do brief): não cobre
 * exaustivamente as 33 páginas da suíte protegida da Sprint 21.4A.2.b —
 * seleciona um subconjunto representativo, autora texto literal novo e
 * determinístico coerente com cada `observedForm` existente, e verifica
 * apenas os 9 sinais suportados nesta versão do observador contra a
 * expectativa já documentada. Não altera a suíte protegida.
 */

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const SUITE = buildSyntheticReferenceSuite();

function findDocument(documentId: string): SyntheticReferenceDocument {
  const document = SUITE.documents.find((doc) => doc.documentId === documentId);
  if (document === undefined) {
    throw new Error(`synthetic document not found: ${documentId}`);
  }
  return document;
}

function findPage(document: SyntheticReferenceDocument, pageId: string): SyntheticPageReference {
  const page = document.pages.find((p) => p.pageId === pageId);
  if (page === undefined) {
    throw new Error(`synthetic page not found: ${pageId} in ${document.documentId}`);
  }
  return page;
}

function evaluationOf(result: DocumentSignalObservationResult, pageNumber: number, signalId: string) {
  const page = result.pages.find((p) => p.pageNumber === pageNumber);
  if (page === undefined) {
    throw new Error(`page ${pageNumber} not found in observation result`);
  }
  const evaluation = page.signalEvaluations.find((e) => e.signalId === signalId);
  if (evaluation === undefined) {
    throw new Error(`signal ${signalId} not found on page ${pageNumber}`);
  }
  return evaluation;
}

function assertOutcome(result: DocumentSignalObservationResult, pageNumber: number, signalId: string, expected: SignalEvaluationOutcome): void {
  const evaluation = evaluationOf(result, pageNumber, signalId);
  assertEqual(evaluation.outcome, expected, `page ${pageNumber}, signal "${signalId}"`);
}

// ---------------------------------------------------------------------------
// "Vale Verde" structure (fixture-positive-structure-a) — curated 5-page
// subset, densely renumbered 1-5: cover, two detail pages, closure, and
// the unrelated trailing page. Literal text authored to realize each
// page's documented `expectedSignals`/`explicitlyAbsentSignalIds`.
// ---------------------------------------------------------------------------
const structureA = findDocument("fixture-positive-structure-a");

const structureAResult = buildPhysicalDocumentReadResultFromSyntheticPages("structure-a-subset", [
  {
    reference: findPage(structureA, "structure-a-p1-cover"),
    itemTexts: ["Obra de Drenagem Vale Verde", "Anexo IV - Anexo de Preços Estimados"],
  },
  {
    reference: findPage(structureA, "structure-a-p3-detail"),
    itemTexts: [
      "Codigo | Descricao | Unidade | Quantidade | Valor Unitario | BDI | Valor Total",
      "VV-001 Escavacao mecanizada m3 120 50,00 10% 6000,00",
      "VV-002 Compactacao de solo m3 120 30,00 10% 3600,00",
    ],
  },
  {
    reference: findPage(structureA, "structure-a-p4-detail"),
    itemTexts: [
      "Codigo | Descricao | Unidade | Quantidade | Valor Unitario | BDI | Valor Total",
      "VV-009 Escavacao mecanizada m3 80 50,00 10% 4000,00",
    ],
  },
  {
    reference: findPage(structureA, "structure-a-p6-detail-and-closure"),
    itemTexts: [
      "Codigo | Descricao | Unidade | Quantidade | Valor Unitario | BDI | Valor Total",
      "VV-025 Escavacao mecanizada m3 40 50,00 10% 2000,00",
      "Total Geral Ficticio: 15600,00",
    ],
  },
  {
    reference: findPage(structureA, "structure-a-p7-unrelated"),
    itemTexts: ["Texto corrido ficticio sem qualquer relacao com blocos orcamentarios ou tabelas de preco."],
  },
]);

const observedStructureA = observeDocumentSignals(structureAResult);

runTest("bridge/structure-a: page 1 (cover) does not observe referential-annex-listing (unsupported this version: mere phrase presence would falsely satisfy a page that IS the annex itself, not a listing of it)", () => {
  assertOutcome(observedStructureA, 1, "referential-annex-listing", "not_evaluable");
  const evaluation = evaluationOf(observedStructureA, 1, "referential-annex-listing");
  assertEqual(evaluation.notEvaluableReasonCode, "unsupported_missing_list_structure_capability");
});

runTest("bridge/structure-a: page 1 (cover) does not observe structural-service-item-identification (explicitly absent in the fixture)", () => {
  assertOutcome(observedStructureA, 1, "structural-service-item-identification", "not_observed");
});

runTest("bridge/structure-a: page 2 (detail) observes structural-service-item-identification via item codes", () => {
  assertOutcome(observedStructureA, 2, "structural-service-item-identification", "observed");
});

runTest("bridge/structure-a: page 2 (detail) observes structural-bdi-documentary-mention", () => {
  assertOutcome(observedStructureA, 2, "structural-bdi-documentary-mention", "observed");
});

runTest("bridge/structure-a: page 2 (detail, landscape) observes continuity-stable-geometry against page 3", () => {
  assertOutcome(observedStructureA, 2, "continuity-stable-geometry", "observed");
});

runTest("bridge/structure-a: page 1 (cover, portrait) does not observe continuity-stable-geometry against page 2 (landscape)", () => {
  assertOutcome(observedStructureA, 1, "continuity-stable-geometry", "not_observed");
});

runTest("bridge/structure-a: page 4 (closure) observes closure-general-total-mention", () => {
  assertOutcome(observedStructureA, 4, "closure-general-total-mention", "observed");
});

runTest("bridge/structure-a: page 5 (unrelated) does not observe closure-general-total-mention (explicitly absent in the fixture)", () => {
  assertOutcome(observedStructureA, 5, "closure-general-total-mention", "not_observed");
});

runTest("bridge/structure-a: page 5 (unrelated, portrait) does not observe continuity-stable-geometry against page 4 (landscape)", () => {
  assertOutcome(observedStructureA, 5, "continuity-stable-geometry", "not_observed");
});

runTest("bridge/structure-a: every page carries all 23 catalog signal evaluations", () => {
  observedStructureA.pages.forEach((page) => assertEqual(page.signalEvaluations.length, 23));
});

// ---------------------------------------------------------------------------
// Geometry-only false positive (fixture-false-positive-geometry-without-budget)
// — three pages, zero text, identical landscape geometry. Proves
// continuity-stable-geometry is observed purely from geometry, on a
// document the suite itself marks as never a budget — demonstrating the
// signal is an observation, not a decision.
// ---------------------------------------------------------------------------
const geometryOnly = findDocument("fixture-false-positive-geometry-without-budget");

const geometryOnlyResult = buildPhysicalDocumentReadResultFromSyntheticPages("geometry-only", [
  { reference: findPage(geometryOnly, "geometry-drawing-p1"), itemTexts: [] },
  { reference: findPage(geometryOnly, "geometry-drawing-p2"), itemTexts: [] },
  { reference: findPage(geometryOnly, "geometry-drawing-p3"), itemTexts: [] },
]);

const observedGeometryOnly = observeDocumentSignals(geometryOnlyResult);

runTest("bridge/geometry-only: first page observes continuity-stable-geometry (via next page only)", () => {
  assertOutcome(observedGeometryOnly, 1, "continuity-stable-geometry", "observed");
});

runTest("bridge/geometry-only: middle page observes continuity-stable-geometry (via both neighbors)", () => {
  assertOutcome(observedGeometryOnly, 2, "continuity-stable-geometry", "observed");
});

runTest("bridge/geometry-only: last page observes continuity-stable-geometry (via previous page only)", () => {
  assertOutcome(observedGeometryOnly, 3, "continuity-stable-geometry", "observed");
});

runTest("bridge/geometry-only: every page has extraction-no-extractable-text observed (zero text, no error)", () => {
  assertOutcome(observedGeometryOnly, 1, "extraction-no-extractable-text", "observed");
  assertOutcome(observedGeometryOnly, 2, "extraction-no-extractable-text", "observed");
  assertOutcome(observedGeometryOnly, 3, "extraction-no-extractable-text", "observed");
});

// ---------------------------------------------------------------------------
// Documentary condition cases (fixture-documentary-condition-cases) — the
// three extraction-availability conditions, each isolated on its own page.
// ---------------------------------------------------------------------------
const conditionCases = findDocument("fixture-documentary-condition-cases");

const conditionCasesResult = buildPhysicalDocumentReadResultFromSyntheticPages("condition-cases", [
  { reference: findPage(conditionCases, "condition-p1-empty"), itemTexts: [] },
  { reference: findPage(conditionCases, "condition-p2-no-extractable-text"), itemTexts: [] },
  { reference: findPage(conditionCases, "condition-p3-extraction-error"), itemTexts: [] },
]);

const observedConditionCases = observeDocumentSignals(conditionCasesResult);

runTest("bridge/condition-cases: empty page observes extraction-no-extractable-text", () => {
  assertOutcome(observedConditionCases, 1, "extraction-no-extractable-text", "observed");
});

runTest("bridge/condition-cases: no-extractable-text page observes extraction-no-extractable-text", () => {
  assertOutcome(observedConditionCases, 2, "extraction-no-extractable-text", "observed");
});

runTest("bridge/condition-cases: extraction-error page observes extraction-error", () => {
  assertOutcome(observedConditionCases, 3, "extraction-error", "observed");
});

runTest("bridge/condition-cases: extraction-error page does not observe extraction-text-available", () => {
  assertOutcome(observedConditionCases, 3, "extraction-text-available", "not_observed");
});
