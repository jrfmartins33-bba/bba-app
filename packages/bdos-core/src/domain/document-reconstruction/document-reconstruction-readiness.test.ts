declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DocumentReconstructionDocumentType,
  DocumentReconstructionStatus,
  ReconstructionFieldStatus,
  ReconstructionFieldValueType,
  ReconstructionReadinessBlockerCode,
  ReconstructionReadinessLevel,
  ReconstructionSectionStatus,
  ReconstructionSourceType,
  addReconstructionField,
  addReconstructionSection,
  addReconstructionSource,
  advanceDocumentReconstructionStatus,
  advanceReconstructionFieldStatus,
  advanceReconstructionSectionStatus,
  buildDocumentReconstructionWorkspace,
  createDocumentReconstruction,
  detectDocumentReconstructionIssues,
  evaluateDocumentReconstructionCompleteness,
  evaluateDocumentReconstructionReadiness,
  isDocumentReconstructionReadyForExport,
  isDocumentReconstructionReadyForReview,
  summarizeDocumentReconstructionReadiness,
  type AddReconstructionFieldInput,
  type AddReconstructionSectionInput,
  type AddReconstructionSourceInput,
  type DocumentReconstruction,
  type DocumentReconstructionResult,
  type DocumentReconstructionWorkspace,
} from "./index";

const actor = "engineer-bruno";
const occurredAt = "2026-07-04T14:00:00Z";

// --- NotReady ------------------------------------------------------------------

runTest("NotReady when document is Archived, even if otherwise complete", () => {
  const complete = buildFullyCompleteFixture();
  const archived = unwrap(
    advanceDocumentReconstructionStatus({
      documentReconstruction: complete,
      toStatus: DocumentReconstructionStatus.Archived,
      actor,
      occurredAt,
    }),
  );
  const workspace = buildWorkspace(archived);

  const result = evaluateDocumentReconstructionReadiness(workspace);

  assertEqual(result.level, ReconstructionReadinessLevel.NotReady, "level mismatch");
  assertEqual(result.readyForReview, false, "readyForReview mismatch");
  assertEqual(result.readyForExport, false, "readyForExport mismatch");
  assertEqual(hasBlocker(result, ReconstructionReadinessBlockerCode.DocumentArchived), true, "expected DocumentArchived blocker");
});

runTest("NotReady when document is Rejected", () => {
  const complete = buildFullyCompleteFixture();
  const readyForReviewStatus = advanceDocumentTo(complete, [
    DocumentReconstructionStatus.Reconstructing,
    DocumentReconstructionStatus.Reconstructed,
    DocumentReconstructionStatus.ReadyForReview,
  ]);
  const rejected = unwrap(
    advanceDocumentReconstructionStatus({
      documentReconstruction: readyForReviewStatus,
      toStatus: DocumentReconstructionStatus.Rejected,
      actor,
      occurredAt,
    }),
  );
  const workspace = buildWorkspace(rejected);

  const result = evaluateDocumentReconstructionReadiness(workspace);

  assertEqual(result.level, ReconstructionReadinessLevel.NotReady, "level mismatch");
  assertEqual(result.readyForReview, false, "readyForReview mismatch");
  assertEqual(hasBlocker(result, ReconstructionReadinessBlockerCode.DocumentRejected), true, "expected DocumentRejected blocker");
});

runTest("NotReady when document is not complete", () => {
  const doc = freshDocument();
  const workspace = buildWorkspace(doc);

  const result = evaluateDocumentReconstructionReadiness(workspace);

  assertEqual(workspace.isComplete, false, "expected an empty document not to be complete");
  assertEqual(result.level, ReconstructionReadinessLevel.NotReady, "level mismatch");
  assertEqual(result.readyForReview, false, "readyForReview mismatch");
  assertEqual(hasBlocker(result, ReconstructionReadinessBlockerCode.DocumentNotComplete), true, "expected DocumentNotComplete blocker");
});

runTest("NotReady when Critical issues are present, even on an otherwise complete document", () => {
  const doc = withDuplicateSectionOrders();
  const workspace = buildWorkspace(doc);

  const result = evaluateDocumentReconstructionReadiness(workspace);

  assertEqual(workspace.statusSummary.criticalIssues > 0, true, "expected at least one Critical issue");
  assertEqual(result.level, ReconstructionReadinessLevel.NotReady, "level mismatch");
  assertEqual(hasBlocker(result, ReconstructionReadinessBlockerCode.CriticalIssues), true, "expected CriticalIssues blocker");
});

runTest("NotReady when Error issues are present", () => {
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
  const workspace = buildWorkspace(doc);

  const result = evaluateDocumentReconstructionReadiness(workspace);

  assertEqual(workspace.statusSummary.errorIssues > 0, true, "expected at least one Error issue");
  assertEqual(result.level, ReconstructionReadinessLevel.NotReady, "level mismatch");
  assertEqual(hasBlocker(result, ReconstructionReadinessBlockerCode.ErrorIssues), true, "expected ErrorIssues blocker");
});

// --- NeedsAttention --------------------------------------------------------------

runTest("NeedsAttention on a naturally complete document: field_without_source always fires as a Warning", () => {
  const doc = buildFullyCompleteFixture();
  const workspace = buildWorkspace(doc);

  const result = evaluateDocumentReconstructionReadiness(workspace);

  // field_without_source (14.6) always fires while any field exists: no
  // mutator to populate field.sourceIds exists yet (14.4). It is a
  // Warning, so readyForReview/readyForExport (the booleans) can still be
  // true, but the richer `level` reports NeedsAttention.
  assertEqual(workspace.statusSummary.warningIssues > 0, true, "expected at least one Warning");
  assertEqual(workspace.statusSummary.criticalIssues, 0, "expected zero Critical issues");
  assertEqual(workspace.statusSummary.errorIssues, 0, "expected zero Error issues");
  assertEqual(result.level, ReconstructionReadinessLevel.NeedsAttention, "level mismatch");
  assertEqual(result.readyForReview, true, "expected readyForReview true despite the NeedsAttention level");
});

runTest("NeedsAttention when completenessScore is below the 86 threshold (structural simulation)", () => {
  const doc = buildFullyCompleteFixture();
  const workspace = withOverriddenStatusSummary(buildWorkspace(doc), { warningIssues: 0, completenessScore: 80 });

  const result = evaluateDocumentReconstructionReadiness(workspace);

  assertEqual(result.level, ReconstructionReadinessLevel.NeedsAttention, "level mismatch");
  assertEqual(hasBlocker(result, ReconstructionReadinessBlockerCode.CompletenessBelowThreshold), true, "expected CompletenessBelowThreshold blocker");
});

// --- ReadyForReview / ReadyForExport (levels, structural simulation) -------------

runTest("ReadyForReview level is reached once Warnings are structurally absent (simulated)", () => {
  const doc = buildFullyCompleteFixture();
  const workspace = withOverriddenStatusSummary(buildWorkspace(doc), { warningIssues: 0 });

  const result = evaluateDocumentReconstructionReadiness(workspace);

  assertEqual(result.level, ReconstructionReadinessLevel.ReadyForReview, "level mismatch");
  assertEqual(result.readyForReview, true, "readyForReview mismatch");
  assertEqual(result.readyForExport, false, "expected readyForExport false: document.status is not ReadyForReview");
});

runTest("ReadyForExport level is reached once Warnings are structurally absent and status is ReadyForReview (simulated)", () => {
  const complete = buildFullyCompleteFixture();
  const readyForReviewStatus = advanceDocumentTo(complete, [
    DocumentReconstructionStatus.Reconstructing,
    DocumentReconstructionStatus.Reconstructed,
    DocumentReconstructionStatus.ReadyForReview,
  ]);
  const workspace = withOverriddenStatusSummary(buildWorkspace(readyForReviewStatus), { warningIssues: 0 });

  const result = evaluateDocumentReconstructionReadiness(workspace);

  assertEqual(result.level, ReconstructionReadinessLevel.ReadyForExport, "level mismatch");
  assertEqual(result.readyForReview, true, "readyForReview mismatch");
  assertEqual(result.readyForExport, true, "readyForExport mismatch");
});

runTest("readyForExport flag is true on natural data once status is ReadyForReview, regardless of Warnings", () => {
  const complete = buildFullyCompleteFixture();
  const readyForReviewStatus = advanceDocumentTo(complete, [
    DocumentReconstructionStatus.Reconstructing,
    DocumentReconstructionStatus.Reconstructed,
    DocumentReconstructionStatus.ReadyForReview,
  ]);
  const workspace = buildWorkspace(readyForReviewStatus);

  const result = evaluateDocumentReconstructionReadiness(workspace);

  assertEqual(workspace.statusSummary.warningIssues > 0, true, "expected the natural field_without_source Warning to still be present");
  assertEqual(result.readyForExport, true, "expected readyForExport true (the boolean gate ignores Warnings)");
  assertEqual(result.level, ReconstructionReadinessLevel.NeedsAttention, "expected level to still report NeedsAttention because of the Warning");
});

runTest("readyForReview true on the natural fully-complete fixture (status stays Draft)", () => {
  const doc = buildFullyCompleteFixture();
  const workspace = buildWorkspace(doc);

  const result = evaluateDocumentReconstructionReadiness(workspace);

  assertEqual(result.readyForReview, true, "readyForReview mismatch");
  assertEqual(result.readyForExport, false, "expected readyForExport false: document.status is Draft, not ReadyForReview");
  assertEqual(isDocumentReconstructionReadyForReview(workspace), true, "isDocumentReconstructionReadyForReview mismatch");
  assertEqual(isDocumentReconstructionReadyForExport(workspace), false, "isDocumentReconstructionReadyForExport mismatch");
});

// --- Summary -----------------------------------------------------------------

runTest("summary mirrors workspace.statusSummary exactly, field by field", () => {
  const doc = buildFullyCompleteFixture();
  const workspace = buildWorkspace(doc);

  const result = evaluateDocumentReconstructionReadiness(workspace);

  assertEqual(result.summary.documentStatus, workspace.statusSummary.documentStatus, "documentStatus mismatch");
  assertEqual(result.summary.completenessLevel, workspace.statusSummary.completenessLevel, "completenessLevel mismatch");
  assertEqual(result.summary.completenessScore, workspace.statusSummary.completenessScore, "completenessScore mismatch");
  assertEqual(result.summary.totalIssues, workspace.statusSummary.totalIssues, "totalIssues mismatch");
  assertEqual(result.summary.criticalIssues, workspace.statusSummary.criticalIssues, "criticalIssues mismatch");
  assertEqual(result.summary.errorIssues, workspace.statusSummary.errorIssues, "errorIssues mismatch");
  assertEqual(result.summary.warningIssues, workspace.statusSummary.warningIssues, "warningIssues mismatch");
  assertEqual(result.summary.infoIssues, workspace.statusSummary.infoIssues, "infoIssues mismatch");
});

runTest("summarizeDocumentReconstructionReadiness matches evaluate's summary", () => {
  const doc = buildFullyCompleteFixture();
  const workspace = buildWorkspace(doc);

  const summary = summarizeDocumentReconstructionReadiness(workspace);
  const evaluated = evaluateDocumentReconstructionReadiness(workspace);

  assertEqual(JSON.stringify(summary), JSON.stringify(evaluated.summary), "expected identical summary content");
});

// --- Blockers & ordering ---------------------------------------------------------

runTest("blockers are ordered by severity (Critical > Error > Warning > Info), then by code", () => {
  const doc = freshDocument();
  const archived = unwrap(
    advanceDocumentReconstructionStatus({
      documentReconstruction: doc,
      toStatus: DocumentReconstructionStatus.Archived,
      actor,
      occurredAt,
    }),
  );
  const workspace = buildWorkspace(archived);

  const result = evaluateDocumentReconstructionReadiness(workspace);

  const codes = result.blockers.map((blocker) => blocker.code);
  assertEqual(
    codes.join(","),
    [
      ReconstructionReadinessBlockerCode.CriticalIssues,
      ReconstructionReadinessBlockerCode.DocumentArchived,
      ReconstructionReadinessBlockerCode.DocumentNotComplete,
      ReconstructionReadinessBlockerCode.ErrorIssues,
      ReconstructionReadinessBlockerCode.NotReadyForReview,
      ReconstructionReadinessBlockerCode.CompletenessBelowThreshold,
    ].join(","),
    // Critical (CriticalIssues, DocumentArchived) > Error (DocumentNotComplete,
    // ErrorIssues from the empty document's own document_without_sources,
    // NotReadyForReview) > Warning (CompletenessBelowThreshold).
    "expected blockers ordered by severity then by code",
  );
});

runTest("blockers list is empty on the natural fully-complete fixture except NotReadyForReview never appears when isReadyForReview is true", () => {
  const doc = buildFullyCompleteFixture();
  const workspace = buildWorkspace(doc);

  const result = evaluateDocumentReconstructionReadiness(workspace);

  assertEqual(workspace.isReadyForReview, true, "expected workspace.isReadyForReview true");
  assertEqual(hasBlocker(result, ReconstructionReadinessBlockerCode.NotReadyForReview), false, "expected no NotReadyForReview blocker");
  assertEqual(hasBlocker(result, ReconstructionReadinessBlockerCode.DocumentArchived), false, "expected no DocumentArchived blocker");
  assertEqual(hasBlocker(result, ReconstructionReadinessBlockerCode.DocumentRejected), false, "expected no DocumentRejected blocker");
  assertEqual(hasBlocker(result, ReconstructionReadinessBlockerCode.DocumentNotComplete), false, "expected no DocumentNotComplete blocker");
  assertEqual(hasBlocker(result, ReconstructionReadinessBlockerCode.CriticalIssues), false, "expected no CriticalIssues blocker");
  assertEqual(hasBlocker(result, ReconstructionReadinessBlockerCode.ErrorIssues), false, "expected no ErrorIssues blocker");
  assertEqual(hasBlocker(result, ReconstructionReadinessBlockerCode.CompletenessBelowThreshold), false, "expected no CompletenessBelowThreshold blocker");
});

// --- Non-mutation & immutability --------------------------------------------------

runTest("never mutates the workspace", () => {
  const doc = buildFullyCompleteFixture();
  const workspace = buildWorkspace(doc);
  const before = JSON.stringify(workspace);

  evaluateDocumentReconstructionReadiness(workspace);
  summarizeDocumentReconstructionReadiness(workspace);
  isDocumentReconstructionReadyForReview(workspace);
  isDocumentReconstructionReadyForExport(workspace);

  assertEqual(JSON.stringify(workspace), before, "workspace must remain byte-for-byte unchanged");
});

runTest("output is deeply immutable", () => {
  const doc = freshDocument();
  const archived = unwrap(
    advanceDocumentReconstructionStatus({
      documentReconstruction: doc,
      toStatus: DocumentReconstructionStatus.Archived,
      actor,
      occurredAt,
    }),
  );
  const workspace = buildWorkspace(archived);

  const result = evaluateDocumentReconstructionReadiness(workspace);

  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.blockers), true, "blockers should be frozen");
  assertEqual(Object.isFrozen(result.summary), true, "summary should be frozen");
  if (result.blockers.length > 0 && result.blockers[0] !== undefined) {
    assertEqual(Object.isFrozen(result.blockers[0]), true, "individual blocker should be frozen");
  }
});

// --- Determinism ---------------------------------------------------------------

runTest("evaluation is deterministic: same workspace always yields the same result", () => {
  const doc = buildFullyCompleteFixture();
  const workspace = buildWorkspace(doc);

  const first = JSON.stringify(evaluateDocumentReconstructionReadiness(workspace));
  const second = JSON.stringify(evaluateDocumentReconstructionReadiness(workspace));

  assertEqual(first, second, "expected deterministic evaluation output");
});

// --- Forbidden imports / non-deterministic constructs ------------------------

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourceCode = readFileSync(
    resolve(process.cwd(), "src", "domain", "document-reconstruction", "document-reconstruction-readiness.ts"),
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
      `unexpected forbidden construct in document-reconstruction-readiness.ts: ${forbidden}`,
    );
  });
});

// --- Fixtures ----------------------------------------------------------------

function freshDocument(): DocumentReconstruction {
  const result = createDocumentReconstruction({
    id: "doc-recon-readiness-001",
    title: "Boletim de Medicao - Bloco E",
    documentType: DocumentReconstructionDocumentType.MeasurementBulletin,
    actor,
    occurredAt,
    correlationId: "document-reconstruction-readiness-correlation-001",
    createdBy: "engineering-app",
    sourceSystem: "engineering-workspace",
  });
  return unwrap(result);
}

function advanceDocumentTo(
  doc: DocumentReconstruction,
  path: ReadonlyArray<DocumentReconstructionStatus>,
): DocumentReconstruction {
  return path.reduce(
    (current, toStatus) =>
      unwrap(advanceDocumentReconstructionStatus({ documentReconstruction: current, toStatus, actor, occurredAt })),
    doc,
  );
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
 * Score 100 fixture (mirrors the completeness, issue-detector and
 * workspace test suites): one Completed section with one Completed
 * required field and one source, pooled average confidence >= 0.80.
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

/**
 * A section's own `order` is unique-enforced by `addReconstructionSection`
 * (14.3). This structurally assembles a duplicate outside that mutator —
 * the same defense-in-depth scenario `document-reconstruction-issue-detector`
 * (14.6) already covers — purely to exercise the `CriticalIssues` blocker
 * on top of an otherwise complete document.
 */
function withDuplicateSectionOrders(): DocumentReconstruction {
  const doc = buildFullyCompleteFixture();
  return {
    ...doc,
    sections: [...doc.sections, { ...doc.sections[0]!, id: "sec-01-dup" }],
  };
}

function buildWorkspace(doc: DocumentReconstruction): DocumentReconstructionWorkspace {
  const completeness = evaluateDocumentReconstructionCompleteness(doc);
  const issueDetection = detectDocumentReconstructionIssues(doc, completeness);
  return buildDocumentReconstructionWorkspace({ document: doc, completeness, issueDetection });
}

/**
 * Overrides fields on a cloned workspace's `statusSummary` only. This
 * engine reads exclusively from `workspace.statusSummary`/`isComplete`/
 * `isReadyForReview`/`document.status` — never recomputing anything — so
 * this is a legitimate way to exercise level/blocker branches (e.g. a
 * below-threshold score, or the complete absence of Warnings) that the
 * current mutators cannot yet produce naturally, without touching the
 * readiness engine's own logic.
 */
function withOverriddenStatusSummary(
  workspace: DocumentReconstructionWorkspace,
  overrides: Partial<DocumentReconstructionWorkspace["statusSummary"]>,
): DocumentReconstructionWorkspace {
  return {
    ...workspace,
    statusSummary: { ...workspace.statusSummary, ...overrides },
  };
}

function hasBlocker(
  result: ReturnType<typeof evaluateDocumentReconstructionReadiness>,
  code: ReconstructionReadinessBlockerCode,
): boolean {
  return result.blockers.some((blocker) => blocker.code === code);
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
