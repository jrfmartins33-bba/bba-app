declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DocumentReconstructionDocumentType,
  ReconstructionFieldStatus,
  ReconstructionFieldValueType,
  ReconstructionIssueCategory,
  ReconstructionIssueSeverity,
  ReconstructionSectionStatus,
  ReconstructionSourceType,
  addReconstructionField,
  addReconstructionSection,
  addReconstructionSource,
  advanceReconstructionFieldStatus,
  advanceReconstructionSectionStatus,
  createDocumentReconstruction,
  detectDocumentReconstructionIssues,
  evaluateDocumentReconstructionCompleteness,
  isIssueDetectionReadyForReview,
  summarizeDetectedIssues,
  type AddReconstructionFieldInput,
  type AddReconstructionSectionInput,
  type AddReconstructionSourceInput,
  type DocumentReconstruction,
  type DocumentReconstructionResult,
  type ReconstructionDetectedIssue,
  type ReconstructionIssueCode,
} from "./index";

const actor = "engineer-bruno";
const occurredAt = "2026-07-04T14:00:00Z";

// --- Perfect document -----------------------------------------------------

runTest("perfect document: only the structurally-unavoidable field_without_source issue, readyForReview true", () => {
  const doc = buildFullyCompleteFixture();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  // field_without_source is the one issue that always fires while any
  // field exists: no mutator to populate `field.sourceIds` exists yet
  // (14.4). It is a Warning, so readyForReview stays true.
  assertEqual(result.issues.length, 1, "expected only the structurally-unavoidable field_without_source issue");
  assertEqual(hasIssue(result, "field_without_source"), true, "expected field_without_source to fire");
  assertEqual(result.summary.totalIssues, 1, "totalIssues mismatch");
  assertEqual(result.summary.criticalIssues, 0, "criticalIssues mismatch");
  assertEqual(result.summary.errorIssues, 0, "errorIssues mismatch");
  assertEqual(result.summary.warningIssues, 1, "warningIssues mismatch");
  assertEqual(result.summary.infoIssues, 0, "infoIssues mismatch");
  assertEqual(result.summary.issuesByCategory.length, 1, "issuesByCategory mismatch");
  assertEqual(result.readyForReview, true, "expected readyForReview true on a perfect document");
});

// --- Each problem in isolation ---------------------------------------------

runTest("document_without_sections fires when there are no sections, category Document, severity Critical", () => {
  const doc = freshDocument();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  assertEqual(hasIssue(result, "document_without_sections"), true, "expected document_without_sections to fire");
  const issue = findIssue(result, "document_without_sections");
  assertEqual(issue.category, ReconstructionIssueCategory.Document, "category mismatch");
  assertEqual(issue.severity, ReconstructionIssueSeverity.Critical, "severity mismatch");
  assertEqual(issue.referenceId, null, "referenceId mismatch");
});

runTest("document_without_sections never fires once at least one section exists", () => {
  const doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  assertEqual(hasIssue(result, "document_without_sections"), false, "expected document_without_sections not to fire");
});

runTest("document_without_fields fires when there are no fields, category Document, severity Critical", () => {
  const doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  assertEqual(hasIssue(result, "document_without_fields"), true, "expected document_without_fields to fire");
  const issue = findIssue(result, "document_without_fields");
  assertEqual(issue.category, ReconstructionIssueCategory.Document, "category mismatch");
  assertEqual(issue.severity, ReconstructionIssueSeverity.Critical, "severity mismatch");
  assertEqual(issue.referenceId, null, "referenceId mismatch");
});

runTest("document_without_sources fires when there are no sources, category Document, severity Error", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  doc = withField(doc, { id: "field-01", sectionId: "sec-01", key: "largura", required: false, confidence: 0.9 });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  assertEqual(hasIssue(result, "document_without_sources"), true, "expected document_without_sources to fire");
  const issue = findIssue(result, "document_without_sources");
  assertEqual(issue.category, ReconstructionIssueCategory.Document, "category mismatch");
  assertEqual(issue.severity, ReconstructionIssueSeverity.Error, "severity mismatch");
  assertEqual(issue.referenceId, null, "referenceId mismatch");
});

runTest("section_without_fields fires only for the offending section, category Section, severity Warning", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Completed });
  doc = withSection(doc, { id: "sec-02", order: 2 });
  doc = withField(doc, {
    id: "field-01",
    sectionId: "sec-01",
    key: "largura",
    required: false,
    confidence: 0.9,
    status: ReconstructionFieldStatus.Completed,
  });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  const matches = result.issues.filter((issue) => issue.code === "section_without_fields");
  assertEqual(matches.length, 1, "expected exactly one section_without_fields issue");
  assertEqual(matches[0]?.referenceId, "sec-02", "referenceId mismatch");
  assertEqual(matches[0]?.category, ReconstructionIssueCategory.Section, "category mismatch");
  assertEqual(matches[0]?.severity, ReconstructionIssueSeverity.Warning, "severity mismatch");
});

runTest("section_not_completed fires for any non-Completed status, category Section, severity Warning", () => {
  const doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Building });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  const issue = findIssue(result, "section_not_completed");
  assertEqual(issue.referenceId, "sec-01", "referenceId mismatch");
  assertEqual(issue.category, ReconstructionIssueCategory.Section, "category mismatch");
  assertEqual(issue.severity, ReconstructionIssueSeverity.Warning, "severity mismatch");
});

runTest("section_not_completed never fires once the section is Completed", () => {
  const doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Completed });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  assertEqual(hasIssue(result, "section_not_completed"), false, "expected section_not_completed not to fire");
});

runTest("field_required_not_completed fires only for incomplete required fields, category Field, severity Error", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  doc = withField(doc, {
    id: "field-01",
    sectionId: "sec-01",
    key: "largura",
    required: true,
    confidence: 0.9,
    status: ReconstructionFieldStatus.Building,
  });
  doc = withField(doc, {
    id: "field-02",
    sectionId: "sec-01",
    key: "altura",
    required: false,
    confidence: 0.9,
  });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  const matches = result.issues.filter((issue) => issue.code === "field_required_not_completed");
  assertEqual(matches.length, 1, "expected exactly one field_required_not_completed issue");
  assertEqual(matches[0]?.referenceId, "field-01", "referenceId mismatch");
  assertEqual(matches[0]?.category, ReconstructionIssueCategory.Field, "category mismatch");
  assertEqual(matches[0]?.severity, ReconstructionIssueSeverity.Error, "severity mismatch");
});

runTest("field_required_not_completed never fires once the required field is Completed", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  doc = withField(doc, {
    id: "field-01",
    sectionId: "sec-01",
    key: "largura",
    required: true,
    confidence: 0.9,
    status: ReconstructionFieldStatus.Completed,
  });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  assertEqual(hasIssue(result, "field_required_not_completed"), false, "expected field_required_not_completed not to fire");
});

runTest("field_without_source fires for every field while no mutator links sources yet, category Field, severity Warning", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  doc = withField(doc, { id: "field-01", sectionId: "sec-01", key: "largura", required: false, confidence: 0.9 });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  const issue = findIssue(result, "field_without_source");
  assertEqual(issue.referenceId, "field-01", "referenceId mismatch");
  assertEqual(issue.category, ReconstructionIssueCategory.Field, "category mismatch");
  assertEqual(issue.severity, ReconstructionIssueSeverity.Warning, "severity mismatch");
});

runTest("field_confidence_below_threshold fires below 0.80 and not at exactly 0.80, category Confidence, severity Info", () => {
  let low = withSection(freshDocument(), { id: "sec-01", order: 1 });
  low = withField(low, { id: "field-01", sectionId: "sec-01", key: "largura", required: false, confidence: 0.79 });
  const lowCompleteness = evaluateDocumentReconstructionCompleteness(low);
  const lowResult = detectDocumentReconstructionIssues(low, lowCompleteness);
  const issue = findIssue(lowResult, "field_confidence_below_threshold");
  assertEqual(issue.referenceId, "field-01", "referenceId mismatch");
  assertEqual(issue.category, ReconstructionIssueCategory.Confidence, "category mismatch");
  assertEqual(issue.severity, ReconstructionIssueSeverity.Info, "severity mismatch");

  let atThreshold = withSection(freshDocument(), { id: "sec-01", order: 1 });
  atThreshold = withField(atThreshold, {
    id: "field-01",
    sectionId: "sec-01",
    key: "largura",
    required: false,
    confidence: 0.8,
  });
  const atThresholdCompleteness = evaluateDocumentReconstructionCompleteness(atThreshold);
  const atThresholdResult = detectDocumentReconstructionIssues(atThreshold, atThresholdCompleteness);
  assertEqual(
    hasIssue(atThresholdResult, "field_confidence_below_threshold"),
    false,
    "expected no issue exactly at the threshold",
  );
});

runTest("source_confidence_below_threshold fires below 0.80, category Confidence, severity Info", () => {
  const doc = withSource(freshDocument(), { id: "src-01", confidence: 0.5 });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  const issue = findIssue(result, "source_confidence_below_threshold");
  assertEqual(issue.referenceId, "src-01", "referenceId mismatch");
  assertEqual(issue.category, ReconstructionIssueCategory.Confidence, "category mismatch");
  assertEqual(issue.severity, ReconstructionIssueSeverity.Info, "severity mismatch");
});

runTest("duplicate_section_order fires for every section beyond the first sharing an order, category Consistency, severity Critical", () => {
  const doc = withDuplicateSectionOrders();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  const matches = result.issues.filter((issue) => issue.code === "duplicate_section_order");
  assertEqual(matches.length, 1, "expected exactly one duplicate_section_order issue");
  assertEqual(matches[0]?.referenceId, "sec-02", "expected the later section to be flagged, not the first");
  assertEqual(matches[0]?.category, ReconstructionIssueCategory.Consistency, "category mismatch");
  assertEqual(matches[0]?.severity, ReconstructionIssueSeverity.Critical, "severity mismatch");
});

runTest("duplicate_field_key fires for every field beyond the first sharing a key in the same section, category Consistency, severity Critical", () => {
  const doc = withDuplicateFieldKeys();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  const matches = result.issues.filter((issue) => issue.code === "duplicate_field_key");
  assertEqual(matches.length, 1, "expected exactly one duplicate_field_key issue");
  assertEqual(matches[0]?.referenceId, "field-02", "expected the later field to be flagged, not the first");
  assertEqual(matches[0]?.category, ReconstructionIssueCategory.Consistency, "category mismatch");
  assertEqual(matches[0]?.severity, ReconstructionIssueSeverity.Critical, "severity mismatch");
});

runTest("duplicate_field_key does not fire across different sections sharing the same key", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  doc = withSection(doc, { id: "sec-02", order: 2 });
  doc = withField(doc, { id: "field-01", sectionId: "sec-01", key: "largura", required: false, confidence: 0.9 });
  doc = withField(doc, { id: "field-02", sectionId: "sec-02", key: "largura", required: false, confidence: 0.9 });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  assertEqual(hasIssue(result, "duplicate_field_key"), false, "expected no duplicate across different sections");
});

// --- Multiple problems together --------------------------------------------

runTest("multiple problems can fire together on a poorly-formed document", () => {
  const doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Building });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  const codes = result.issues.map((issue) => issue.code).sort();
  const expected: ReconstructionIssueCode[] = [
    "document_without_fields",
    "document_without_sources",
    "section_without_fields",
    "section_not_completed",
  ];
  assertEqual(codes.join(","), expected.slice().sort().join(","), "expected all four issues to fire together");
});

// --- Ordering ---------------------------------------------------------------

runTest("issues are ordered by severity (Critical > Error > Warning > Info), then category, then title", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  doc = withField(doc, {
    id: "field-01",
    sectionId: "sec-01",
    key: "largura",
    required: true,
    confidence: 0.5,
    status: ReconstructionFieldStatus.Building,
  });
  doc = withSource(doc, { id: "src-01", confidence: 0.5 });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  const severityRank: Record<string, number> = {
    [ReconstructionIssueSeverity.Critical]: 0,
    [ReconstructionIssueSeverity.Error]: 1,
    [ReconstructionIssueSeverity.Warning]: 2,
    [ReconstructionIssueSeverity.Info]: 3,
  };
  const categoryRank: Record<string, number> = {
    [ReconstructionIssueCategory.Document]: 0,
    [ReconstructionIssueCategory.Section]: 1,
    [ReconstructionIssueCategory.Field]: 2,
    [ReconstructionIssueCategory.Source]: 3,
    [ReconstructionIssueCategory.Confidence]: 4,
    [ReconstructionIssueCategory.Consistency]: 5,
  };

  for (let i = 1; i < result.issues.length; i += 1) {
    const previous = result.issues[i - 1];
    const current = result.issues[i];
    if (previous === undefined || current === undefined) {
      throw new Error("unexpected undefined issue while checking ordering");
    }
    const previousSeverityRank = severityRank[previous.severity] ?? 0;
    const currentSeverityRank = severityRank[current.severity] ?? 0;
    assertEqual(previousSeverityRank <= currentSeverityRank, true, `expected severity to be non-decreasing at index ${i}`);
    if (previousSeverityRank === currentSeverityRank) {
      const previousCategoryRank = categoryRank[previous.category] ?? 0;
      const currentCategoryRank = categoryRank[current.category] ?? 0;
      assertEqual(previousCategoryRank <= currentCategoryRank, true, `expected category to be non-decreasing at index ${i}`);
      if (previousCategoryRank === currentCategoryRank) {
        assertEqual(previous.title <= current.title, true, `expected title to be non-decreasing at index ${i}`);
      }
    }
  }
});

runTest("ordering is stable and reproducible across repeated calls", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  doc = withField(doc, { id: "field-01", sectionId: "sec-01", key: "largura", required: true, confidence: 0.5 });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const first = detectDocumentReconstructionIssues(doc, completeness).issues.map((issue) => issue.id);
  const second = detectDocumentReconstructionIssues(doc, completeness).issues.map((issue) => issue.id);

  assertEqual(first.join(","), second.join(","), "expected identical ordering across repeated calls");
});

// --- Summary -----------------------------------------------------------------

runTest("summary counts match the issues array and issuesByCategory only lists present categories", () => {
  const doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Building });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  assertEqual(result.summary.totalIssues, result.issues.length, "totalIssues mismatch");
  assertEqual(
    result.summary.criticalIssues,
    result.issues.filter((issue) => issue.severity === ReconstructionIssueSeverity.Critical).length,
    "criticalIssues mismatch",
  );
  assertEqual(
    result.summary.errorIssues,
    result.issues.filter((issue) => issue.severity === ReconstructionIssueSeverity.Error).length,
    "errorIssues mismatch",
  );
  assertEqual(
    result.summary.warningIssues,
    result.issues.filter((issue) => issue.severity === ReconstructionIssueSeverity.Warning).length,
    "warningIssues mismatch",
  );
  assertEqual(
    result.summary.infoIssues,
    result.issues.filter((issue) => issue.severity === ReconstructionIssueSeverity.Info).length,
    "infoIssues mismatch",
  );

  const presentCategories = new Set(result.issues.map((issue) => issue.category));
  assertEqual(result.summary.issuesByCategory.length, presentCategories.size, "issuesByCategory size mismatch");
  result.summary.issuesByCategory.forEach((entry) => {
    const expectedTotal = result.issues.filter((issue) => issue.category === entry.category).length;
    assertEqual(entry.total, expectedTotal, `issuesByCategory total mismatch for ${entry.category}`);
    assertEqual(entry.total > 0, true, "issuesByCategory must never list a zero-count category");
  });
});

runTest("summarizeDetectedIssues matches detect's summary", () => {
  const doc = buildFullyCompleteFixture();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const summary = summarizeDetectedIssues(doc, completeness);
  const detected = detectDocumentReconstructionIssues(doc, completeness);

  assertEqual(JSON.stringify(summary), JSON.stringify(detected.summary), "expected identical summary content");
});

// --- Ready for review ---------------------------------------------------------

runTest("readyForReview is true only when there are no Critical/Error issues and completeness is complete", () => {
  const doc = buildFullyCompleteFixture();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  assertEqual(result.summary.criticalIssues, 0, "expected no Critical issues");
  assertEqual(result.summary.errorIssues, 0, "expected no Error issues");
  assertEqual(completeness.complete, true, "expected completeness to be complete");
  assertEqual(result.readyForReview, true, "expected readyForReview true");
  assertEqual(isIssueDetectionReadyForReview(doc, completeness), true, "isIssueDetectionReadyForReview mismatch");
});

runTest("readyForReview is false when a Critical issue is present, even if completeness is complete", () => {
  const doc = buildFullyCompleteFixture();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  // Force a Critical issue (duplicate order) without touching completeness math.
  const withDuplicate = withDuplicateSectionOrders();
  const withDuplicateCompleteness = evaluateDocumentReconstructionCompleteness(withDuplicate);
  const result = detectDocumentReconstructionIssues(withDuplicate, withDuplicateCompleteness);

  assertEqual(result.summary.criticalIssues > 0, true, "expected at least one Critical issue");
  assertEqual(result.readyForReview, false, "expected readyForReview false when Critical issues exist");

  // Sanity: fixture used for the "true" branch stays independently green.
  const completenessResult = detectDocumentReconstructionIssues(doc, completeness);
  assertEqual(completenessResult.readyForReview, true, "expected the perfect fixture to remain ready");
});

runTest("readyForReview is false when an Error issue is present", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Completed });
  doc = withField(doc, {
    id: "field-01",
    sectionId: "sec-01",
    key: "largura",
    required: true,
    confidence: 0.9,
    status: ReconstructionFieldStatus.Building,
  });
  doc = withSource(doc, { id: "src-01", confidence: 0.9 });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  assertEqual(hasIssue(result, "field_required_not_completed"), true, "expected field_required_not_completed to fire");
  assertEqual(result.summary.errorIssues > 0, true, "expected at least one Error issue");
  assertEqual(result.readyForReview, false, "expected readyForReview false when Error issues exist");
});

runTest("readyForReview is false when completeness is not complete, even with zero Critical/Error issues", () => {
  const doc = freshDocument();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  assertEqual(completeness.complete, false, "expected completeness not complete on an empty document");
  assertEqual(result.readyForReview, false, "expected readyForReview false when completeness is not complete");
});

runTest("isIssueDetectionReadyForReview matches detect's readyForReview flag", () => {
  const doc = buildFullyCompleteFixture();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  assertEqual(
    isIssueDetectionReadyForReview(doc, completeness),
    detectDocumentReconstructionIssues(doc, completeness).readyForReview,
    "isIssueDetectionReadyForReview mismatch",
  );
});

// --- Immutability & determinism ---------------------------------------------

runTest("never mutates the aggregate: status, timeline, trace, summary and metadata are untouched", () => {
  const doc = buildFullyCompleteFixture();
  const before = JSON.stringify(doc);
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  detectDocumentReconstructionIssues(doc, completeness);
  summarizeDetectedIssues(doc, completeness);
  isIssueDetectionReadyForReview(doc, completeness);

  assertEqual(JSON.stringify(doc), before, "aggregate must remain byte-for-byte unchanged after detection");
});

runTest("never mutates the supplied completeness result", () => {
  const doc = buildFullyCompleteFixture();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);
  const before = JSON.stringify(completeness);

  detectDocumentReconstructionIssues(doc, completeness);

  assertEqual(JSON.stringify(completeness), before, "completeness result must remain byte-for-byte unchanged");
});

runTest("output is deeply immutable", () => {
  const doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Building });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const result = detectDocumentReconstructionIssues(doc, completeness);

  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.issues), true, "issues should be frozen");
  assertEqual(Object.isFrozen(result.summary), true, "summary should be frozen");
  if (result.issues.length > 0 && result.issues[0] !== undefined) {
    assertEqual(Object.isFrozen(result.issues[0]), true, "individual issue should be frozen");
  }
});

runTest("detection is deterministic: same inputs always yield the same result", () => {
  const doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Building });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);

  const first = JSON.stringify(detectDocumentReconstructionIssues(doc, completeness));
  const second = JSON.stringify(detectDocumentReconstructionIssues(doc, completeness));

  assertEqual(first, second, "expected deterministic detection output");
});

// --- Forbidden imports / non-deterministic constructs ------------------------

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourceCode = readFileSync(
    resolve(process.cwd(), "src", "domain", "document-reconstruction", "document-reconstruction-issue-detector.ts"),
    "utf8",
  );
  const lowerSourceCode = sourceCode.toLowerCase();

  [
    "date.now(",
    "math.random(",
    "crypto.randomuuid",
    "uuid()",
    "field-evidence",
    "engineering-contract",
    "engineering-project-context",
    "measurement-workspace",
    "measurement-calculation",
    "measurement-memory-builder",
    "approval-workflow",
    "official-template-engine",
    "template-engine",
    "export-engine",
    "bulletin-generator",
    "decision-engine",
    "engines/decision",
    "business-fact",
    "business-facts",
    "react",
    "next",
    "supabase",
    "\"fs\"",
    "'fs'",
    "node:fs",
    "\"path\"",
    "'path'",
    "node:path",
    "xlsx",
    "pdf-lib",
    "pdfkit",
    "docx",
    "ocr",
    "gps.get",
    "whatsapp",
    "tensorflow",
    "openai",
    "fetch(",
  ].forEach((forbidden) => {
    assertEqual(
      lowerSourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in document-reconstruction-issue-detector.ts: ${forbidden}`,
    );
  });
});

// --- Fixtures ----------------------------------------------------------------

function freshDocument(): DocumentReconstruction {
  const result = createDocumentReconstruction({
    id: "doc-recon-issue-detector-001",
    title: "Boletim de Medicao - Bloco C",
    documentType: DocumentReconstructionDocumentType.MeasurementBulletin,
    actor,
    occurredAt,
    correlationId: "document-reconstruction-issue-detector-correlation-001",
    createdBy: "engineering-app",
    sourceSystem: "engineering-workspace",
  });
  return unwrap(result);
}

function withSection(
  doc: DocumentReconstruction,
  options: { id: string; order: number; status?: ReconstructionSectionStatus },
): DocumentReconstruction {
  const input: AddReconstructionSectionInput = {
    documentReconstruction: doc,
    section: { id: options.id, title: `Secao ${options.id}`, order: options.order },
    actor,
    occurredAt,
  };
  let updated = unwrap(addReconstructionSection(input));

  if (options.status !== undefined && options.status !== ReconstructionSectionStatus.Draft) {
    updated = advanceSectionTo(updated, options.id, options.status);
  }

  return updated;
}

function advanceSectionTo(
  doc: DocumentReconstruction,
  id: string,
  toStatus: ReconstructionSectionStatus,
): DocumentReconstruction {
  const path: ReconstructionSectionStatus[] = [];

  if (toStatus === ReconstructionSectionStatus.Building) {
    path.push(ReconstructionSectionStatus.Building);
  } else if (toStatus === ReconstructionSectionStatus.Completed) {
    path.push(ReconstructionSectionStatus.Building, ReconstructionSectionStatus.Completed);
  } else if (toStatus === ReconstructionSectionStatus.Incomplete) {
    path.push(ReconstructionSectionStatus.Building, ReconstructionSectionStatus.Incomplete);
  } else if (toStatus === ReconstructionSectionStatus.Archived) {
    path.push(ReconstructionSectionStatus.Archived);
  }

  return path.reduce(
    (current, status) =>
      unwrap(
        advanceReconstructionSectionStatus({ documentReconstruction: current, id, toStatus: status, actor, occurredAt }),
      ),
    doc,
  );
}

function withSource(doc: DocumentReconstruction, options: { id: string; confidence: number }): DocumentReconstruction {
  const input: AddReconstructionSourceInput = {
    documentReconstruction: doc,
    source: {
      id: options.id,
      sourceType: ReconstructionSourceType.ManualInput,
      sourceId: `EXT-${options.id}`,
      confidence: options.confidence,
    },
    actor,
    occurredAt,
  };
  return unwrap(addReconstructionSource(input));
}

function withField(
  doc: DocumentReconstruction,
  options: {
    id: string;
    sectionId: string;
    key: string;
    required: boolean;
    confidence: number;
    status?: ReconstructionFieldStatus;
  },
): DocumentReconstruction {
  const input: AddReconstructionFieldInput = {
    documentReconstruction: doc,
    field: {
      id: options.id,
      sectionId: options.sectionId,
      key: options.key,
      label: `Campo ${options.key}`,
      valueType: ReconstructionFieldValueType.Text,
      required: options.required,
      confidence: options.confidence,
    },
    actor,
    occurredAt,
  };
  let updated = unwrap(addReconstructionField(input));

  if (options.status !== undefined && options.status !== ReconstructionFieldStatus.Draft) {
    updated = advanceFieldTo(updated, options.id, options.status);
  }

  return updated;
}

function advanceFieldTo(
  doc: DocumentReconstruction,
  id: string,
  toStatus: ReconstructionFieldStatus,
): DocumentReconstruction {
  const path: ReconstructionFieldStatus[] = [];

  if (toStatus === ReconstructionFieldStatus.Building) {
    path.push(ReconstructionFieldStatus.Building);
  } else if (toStatus === ReconstructionFieldStatus.Completed) {
    path.push(ReconstructionFieldStatus.Building, ReconstructionFieldStatus.Completed);
  } else if (toStatus === ReconstructionFieldStatus.Incomplete) {
    path.push(ReconstructionFieldStatus.Building, ReconstructionFieldStatus.Incomplete);
  } else if (toStatus === ReconstructionFieldStatus.Archived) {
    path.push(ReconstructionFieldStatus.Building, ReconstructionFieldStatus.Completed, ReconstructionFieldStatus.Archived);
  }

  return path.reduce(
    (current, status) =>
      unwrap(
        advanceReconstructionFieldStatus({ documentReconstruction: current, id, toStatus: status, actor, occurredAt }),
      ),
    doc,
  );
}

/**
 * A section's own `order` is unique-enforced by `addReconstructionSection`
 * (14.3), so a genuine duplicate can only be produced by structurally
 * assembling the aggregate outside its own mutators — exactly the
 * defense-in-depth scenario this detector must still catch.
 */
function withDuplicateSectionOrders(): DocumentReconstruction {
  const doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  const duplicated: DocumentReconstruction = {
    ...doc,
    sections: [...doc.sections, { ...doc.sections[0]!, id: "sec-02" }],
  };
  return duplicated;
}

/**
 * A field's own (sectionId, key) pair is unique-enforced by
 * `addReconstructionField` (14.4). Same defense-in-depth rationale as
 * `withDuplicateSectionOrders`.
 */
function withDuplicateFieldKeys(): DocumentReconstruction {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  doc = withField(doc, { id: "field-01", sectionId: "sec-01", key: "largura", required: false, confidence: 0.9 });
  const duplicated: DocumentReconstruction = {
    ...doc,
    fields: [...doc.fields, { ...doc.fields[0]!, id: "field-02" }],
  };
  return duplicated;
}

/**
 * Score 100 fixture (mirrors `document-reconstruction-completeness.test.ts`):
 * one Completed section with one Completed required field and one
 * source, pooled average confidence >= 0.80. `field_without_source`
 * still fires (no mutator populates `field.sourceIds` yet), but it is a
 * `Warning`, so `readyForReview` stays `true`.
 */
function buildFullyCompleteFixture(): DocumentReconstruction {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Completed });
  doc = withField(doc, {
    id: "field-01",
    sectionId: "sec-01",
    key: "largura",
    required: true,
    confidence: 0.9,
    status: ReconstructionFieldStatus.Completed,
  });
  doc = withSource(doc, { id: "src-01", confidence: 0.9 });
  return doc;
}

function hasIssue(result: ReturnType<typeof detectDocumentReconstructionIssues>, code: ReconstructionIssueCode): boolean {
  return result.issues.some((issue) => issue.code === code);
}

function findIssue(
  result: ReturnType<typeof detectDocumentReconstructionIssues>,
  code: ReconstructionIssueCode,
): ReconstructionDetectedIssue {
  const issue = result.issues.find((entry) => entry.code === code);
  if (issue === undefined) {
    throw new Error(`expected an issue with code ${code}`);
  }
  return issue;
}

function unwrap(result: DocumentReconstructionResult): DocumentReconstruction {
  if (!result.success) {
    throw new Error(`expected success: ${JSON.stringify(result.errors)}`);
  }
  return result.documentReconstruction;
}

// --- Test harness --------------------------------------------------------------

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
