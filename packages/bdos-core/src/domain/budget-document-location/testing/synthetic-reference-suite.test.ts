import { createHash } from "node:crypto";
import {
  SYNTHETIC_REFERENCE_SUITE_SCHEMA_VERSION,
  SYNTHETIC_REFERENCE_SUITE_VERSION,
  SyntheticPageDocumentaryRole,
  SyntheticPageExtractionAvailability,
  SyntheticPageExtractionQuality,
  SyntheticPageReferenceDecision,
  SyntheticReferenceDocumentCategory,
} from "./synthetic-reference-suite.types";
import { buildSyntheticReferenceSuite, validateSyntheticReferenceSuite } from "./synthetic-reference-suite";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertNoViolations(issues: ReadonlyArray<unknown>, message?: string): void {
  if (issues.length > 0) {
    throw new Error(`${message ?? "expected no issues"}: ${JSON.stringify(issues, null, 2)}`);
  }
}

function normalizedHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

runTest("suite carries its declared schema and suite versions", () => {
  const suite = buildSyntheticReferenceSuite();
  assertEqual(suite.schemaVersion, SYNTHETIC_REFERENCE_SUITE_SCHEMA_VERSION);
  assertEqual(suite.suiteVersion, SYNTHETIC_REFERENCE_SUITE_VERSION);
});

runTest("suite passes its own structural integrity and coverage validation", () => {
  const suite = buildSyntheticReferenceSuite();
  const issues = validateSyntheticReferenceSuite(suite);
  assertNoViolations(issues, "synthetic reference suite issues");
});

runTest("validateSyntheticReferenceSuite flags a schemaVersion/suiteVersion mismatch", () => {
  const suite = buildSyntheticReferenceSuite();
  const tamperedSchema = { ...suite, schemaVersion: 999 as typeof suite.schemaVersion };
  const tamperedSuiteVersion = { ...suite, suiteVersion: "wrong-version" as typeof suite.suiteVersion };
  assertEqual(validateSyntheticReferenceSuite(tamperedSchema).some((i) => i.code === "schema_version_mismatch"), true, "expected schema_version_mismatch issue");
  assertEqual(validateSyntheticReferenceSuite(tamperedSuiteVersion).some((i) => i.code === "suite_version_mismatch"), true, "expected suite_version_mismatch issue");
});

runTest("validateSyntheticReferenceSuite flags a signal that is both expected and explicitly absent on the same page", () => {
  const suite = buildSyntheticReferenceSuite();
  const [firstDocument, ...restDocuments] = suite.documents;
  const [firstPage, ...restPages] = firstDocument.pages;
  const contradictorySignalId = firstPage.expectedSignals[0]?.signalId ?? "referential-budget-spreadsheet-mention";
  const tamperedPage = { ...firstPage, explicitlyAbsentSignalIds: [...firstPage.explicitlyAbsentSignalIds, contradictorySignalId] };
  const tamperedSuite = { ...suite, documents: [{ ...firstDocument, pages: [tamperedPage, ...restPages] }, ...restDocuments] };
  const issues = validateSyntheticReferenceSuite(tamperedSuite);
  assertEqual(issues.some((i) => i.code === "contradictory_signal_expectation"), true, "expected contradictory_signal_expectation issue");
});

runTest("suite has at least two positive documents and at least three false positives", () => {
  const suite = buildSyntheticReferenceSuite();
  const positives = suite.documents.filter(
    (d) => d.category === SyntheticReferenceDocumentCategory.PositiveStructureA || d.category === SyntheticReferenceDocumentCategory.PositiveStructureB,
  );
  const falsePositives = suite.documents.filter((d) => d.category.startsWith("FalsePositive"));
  if (positives.length < 2) throw new Error(`expected >=2 positive documents, got ${positives.length}`);
  if (falsePositives.length < 3) throw new Error(`expected >=3 false positive documents, got ${falsePositives.length}`);
});

runTest("adversarial false positive document exists and is never a Candidate", () => {
  const suite = buildSyntheticReferenceSuite();
  const adversarial = suite.documents.find((d) => d.category === SyntheticReferenceDocumentCategory.FalsePositiveAdversarial);
  if (!adversarial) throw new Error("adversarial document not found");
  const candidatePages = adversarial.pages.filter((p) => p.referenceDecision === SyntheticPageReferenceDecision.Candidate);
  assertEqual(candidatePages.length, 0, "adversarial document must never be classified as Candidate");
});

runTest("dedicated: referential mention without structure is never Candidate and never starts continuity", () => {
  const suite = buildSyntheticReferenceSuite();
  const indexDoc = suite.documents.find((d) => d.category === SyntheticReferenceDocumentCategory.FalsePositiveIndexListing);
  if (!indexDoc) throw new Error("index listing document not found");
  const indexPage = indexDoc.pages.find((p) => p.documentaryRoles.includes(SyntheticPageDocumentaryRole.ReferenceIndex));
  if (!indexPage) throw new Error("reference index page not found");
  assertEqual(indexPage.expectedSignals.some((s) => s.signalId === "referential-budget-spreadsheet-mention"), true, "index page must carry the referential signal");
  assertEqual(indexPage.expectedSignals.some((s) => s.signalId.startsWith("structural-")), false, "index page must carry no structural signal");
  assertEqual(indexPage.referenceDecision === SyntheticPageReferenceDecision.Candidate, false, "referential-only page must never be Candidate");
  assertEqual(indexPage.continuityGroupId, null, "referential-only page must never start a continuity group");
});

runTest("dedicated: structural page without the exact phrase 'Planilha Orçamentária' is still expected Candidate", () => {
  const suite = buildSyntheticReferenceSuite();
  const structureB = suite.documents.find((d) => d.documentId === "fixture-positive-structure-b");
  if (!structureB) throw new Error("structure B document not found");

  const exactPhraseUsed = structureB.pages.some((p) => p.expectedSignals.some((s) => s.observedForm.includes("Planilha Orçamentária")));
  assertEqual(exactPhraseUsed, false, "structure B must never use the exact phrase 'Planilha Orçamentária'");

  const candidateDetailPages = structureB.pages.filter(
    (p) => p.referenceDecision === SyntheticPageReferenceDecision.Candidate && p.documentaryRoles.includes(SyntheticPageDocumentaryRole.DetailedStructure),
  );
  if (candidateDetailPages.length === 0) throw new Error("structure B must have at least one Candidate detailed-structure page despite lacking the exact phrase");
});

runTest("dedicated: adversarial page with many lexical signals is not Candidate merely by keyword count", () => {
  const suite = buildSyntheticReferenceSuite();
  const adversarial = suite.documents.find((d) => d.category === SyntheticReferenceDocumentCategory.FalsePositiveAdversarial);
  if (!adversarial) throw new Error("adversarial document not found");
  const firstPage = adversarial.pages[0];
  if (firstPage.expectedSignals.length < 4) throw new Error("adversarial page 1 fixture drifted: expected several lexical/structural signals to make the point");
  assertEqual(firstPage.referenceDecision, SyntheticPageReferenceDecision.Ambiguous, "many keyword-level signals without row repetition/continuity must remain Ambiguous, never Candidate");
});

runTest("dedicated: page geometry is never sufficient alone — a stable-geometry-only document is always Discarded", () => {
  const suite = buildSyntheticReferenceSuite();
  const geometryDoc = suite.documents.find((d) => d.category === SyntheticReferenceDocumentCategory.FalsePositiveGeometryWithoutBudget);
  if (!geometryDoc) throw new Error("geometry-without-budget document not found");

  const orientations = new Set(geometryDoc.pages.map((p) => p.geometry.orientation));
  assertEqual(orientations.size, 1, "fixture drifted: expected a stable single orientation across the geometry-only group");

  const hasStructuralSignal = geometryDoc.pages.some((p) => p.expectedSignals.some((s) => s.signalId.startsWith("structural-")));
  assertEqual(hasStructuralSignal, false, "geometry-only document must carry no structural signal");

  const nonDiscarded = geometryDoc.pages.filter((p) => p.referenceDecision !== SyntheticPageReferenceDecision.Discarded);
  assertEqual(nonDiscarded.length, 0, "stable geometry alone, even repeated across pages in landscape, must never be promoted past Discarded");
});

runTest("dedicated: an isolated closure signal without a preceding structural sequence stays Ambiguous", () => {
  const suite = buildSyntheticReferenceSuite();
  const conditionsDoc = suite.documents.find((d) => d.category === SyntheticReferenceDocumentCategory.DocumentaryConditionCases);
  if (!conditionsDoc) throw new Error("documentary condition cases document not found");
  const isolatedClosure = conditionsDoc.pages.find((p) => p.pageId === "condition-p8-closure-without-antecedent");
  if (!isolatedClosure) throw new Error("isolated closure page not found");
  assertEqual(isolatedClosure.documentaryRoles.includes(SyntheticPageDocumentaryRole.Closure), true);
  assertEqual(isolatedClosure.continuityGroupId, null, "isolated closure page must not belong to a continuity group");
  assertEqual(isolatedClosure.referenceDecision, SyntheticPageReferenceDecision.Ambiguous, "closure alone, without an antecedent structural sequence, must never be Candidate");
});

runTest("suite includes at least one page with multiple documentary roles", () => {
  const suite = buildSyntheticReferenceSuite();
  const multiRolePages = suite.documents.flatMap((d) => d.pages).filter((p) => p.documentaryRoles.length >= 2);
  if (multiRolePages.length === 0) throw new Error("expected at least one page with multiple documentary roles");
});

runTest("suite includes documentary condition cases covering the required availability/quality/composition states", () => {
  const suite = buildSyntheticReferenceSuite();
  const conditionsDoc = suite.documents.find((d) => d.category === SyntheticReferenceDocumentCategory.DocumentaryConditionCases);
  if (!conditionsDoc) throw new Error("documentary condition cases document not found");
  const availabilities = new Set(conditionsDoc.pages.map((p) => p.extractionAvailability));
  const qualities = new Set(conditionsDoc.pages.map((p) => p.extractionQuality));
  assertEqual(availabilities.has(SyntheticPageExtractionAvailability.NoExtractableText), true, "missing NoExtractableText case");
  assertEqual(availabilities.has(SyntheticPageExtractionAvailability.ExtractionError), true, "missing ExtractionError case");
  assertEqual(qualities.has(SyntheticPageExtractionQuality.Degraded), true, "missing Degraded quality case");
  assertEqual(qualities.has(SyntheticPageExtractionQuality.Indeterminate), true, "missing Indeterminate quality case");

  const gapPage = conditionsDoc.pages.find((p) => p.expectedGaps.length > 0);
  if (!gapPage) throw new Error("expected at least one page documenting an expected gap (interrupted sequence)");
});

runTest("repeatability: two independent builds of the suite are byte-identical after normalization", () => {
  const first = buildSyntheticReferenceSuite();
  const second = buildSyntheticReferenceSuite();

  assertEqual(JSON.stringify(first), JSON.stringify(second), "serialized suite differs between independent builds");
  assertEqual(normalizedHash(first), normalizedHash(second), "normalized hash differs between independent builds");
  assertEqual(first.documents.length, second.documents.length, "document count differs between independent builds");

  first.documents.forEach((document, docIndex) => {
    const other = second.documents[docIndex];
    assertEqual(document.documentId, other.documentId, "document order/id differs between independent builds");
    assertEqual(document.pages.length, other.pages.length, `page count differs for ${document.documentId}`);
    document.pages.forEach((p, pageIndex) => {
      const otherPage = other.pages[pageIndex];
      assertEqual(p.pageId, otherPage.pageId, "page order/id differs between independent builds");
      assertEqual(
        p.expectedSignals.map((s) => s.signalId).join(","),
        otherPage.expectedSignals.map((s) => s.signalId).join(","),
        `signal order differs for ${p.pageId}`,
      );
    });
  });

  // Validates repeatability of the synthetic layer and its pure
  // normalization/serialization only — not pdfjs-dist repeatability
  // against a real PDF, which remains open for Sprint 21.4A.2.c.
});
