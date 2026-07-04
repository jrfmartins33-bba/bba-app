declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DocumentReconstructionDocumentType,
  DocumentReconstructionStatus,
  ReconstructionCompletenessLevel,
  ReconstructionFieldStatus,
  ReconstructionFieldValueType,
  ReconstructionSectionStatus,
  ReconstructionSourceType,
  addReconstructionField,
  addReconstructionSection,
  addReconstructionSource,
  advanceReconstructionFieldStatus,
  advanceReconstructionSectionStatus,
  buildDocumentReconstructionWorkspace,
  createDocumentReconstruction,
  detectDocumentReconstructionIssues,
  evaluateDocumentReconstructionCompleteness,
  isDocumentReconstructionWorkspaceReady,
  summarizeDocumentReconstructionWorkspace,
  type AddReconstructionFieldInput,
  type AddReconstructionSectionInput,
  type AddReconstructionSourceInput,
  type DocumentReconstruction,
  type DocumentReconstructionResult,
} from "./index";

const actor = "engineer-bruno";
const occurredAt = "2026-07-04T14:00:00Z";

// --- Valid workspace ---------------------------------------------------------

runTest("valid workspace: composes document, completeness and issues verbatim", () => {
  const doc = buildFullyCompleteFixture();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);
  const issueDetection = detectDocumentReconstructionIssues(doc, completeness);

  const workspace = buildDocumentReconstructionWorkspace({ document: doc, completeness, issueDetection });

  assertEqual(JSON.stringify(workspace.document), JSON.stringify(doc), "document mismatch");
  assertEqual(JSON.stringify(workspace.completeness), JSON.stringify(completeness), "completeness mismatch");
  assertEqual(JSON.stringify(workspace.issues), JSON.stringify(issueDetection), "issues mismatch");
});

runTest("valid workspace: isComplete and isReadyForReview reflect the given completeness/issueDetection", () => {
  const doc = buildFullyCompleteFixture();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);
  const issueDetection = detectDocumentReconstructionIssues(doc, completeness);

  const workspace = buildDocumentReconstructionWorkspace({ document: doc, completeness, issueDetection });

  assertEqual(workspace.isComplete, completeness.complete, "isComplete mismatch");
  assertEqual(workspace.isReadyForReview, issueDetection.readyForReview, "isReadyForReview mismatch");
  assertEqual(workspace.isComplete, true, "expected complete on the fully complete fixture");
  assertEqual(workspace.isReadyForReview, true, "expected ready for review on the fully complete fixture");
});

runTest("valid workspace: an empty document composes with isComplete false and isReadyForReview false", () => {
  const doc = freshDocument();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);
  const issueDetection = detectDocumentReconstructionIssues(doc, completeness);

  const workspace = buildDocumentReconstructionWorkspace({ document: doc, completeness, issueDetection });

  assertEqual(workspace.isComplete, false, "expected not complete on an empty document");
  assertEqual(workspace.isReadyForReview, false, "expected not ready for review on an empty document");
});

// --- Summary -----------------------------------------------------------------

runTest("statusSummary reflects document.status, completeness.level/score and issueDetection.summary counts", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Building });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);
  const issueDetection = detectDocumentReconstructionIssues(doc, completeness);

  const workspace = buildDocumentReconstructionWorkspace({ document: doc, completeness, issueDetection });

  assertEqual(workspace.statusSummary.documentStatus, doc.status, "documentStatus mismatch");
  assertEqual(workspace.statusSummary.documentStatus, DocumentReconstructionStatus.Draft, "documentStatus value mismatch");
  assertEqual(workspace.statusSummary.completenessLevel, completeness.level, "completenessLevel mismatch");
  assertEqual(workspace.statusSummary.completenessScore, completeness.score, "completenessScore mismatch");
  assertEqual(workspace.statusSummary.totalIssues, issueDetection.summary.totalIssues, "totalIssues mismatch");
  assertEqual(workspace.statusSummary.criticalIssues, issueDetection.summary.criticalIssues, "criticalIssues mismatch");
  assertEqual(workspace.statusSummary.errorIssues, issueDetection.summary.errorIssues, "errorIssues mismatch");
  assertEqual(workspace.statusSummary.warningIssues, issueDetection.summary.warningIssues, "warningIssues mismatch");
  assertEqual(workspace.statusSummary.infoIssues, issueDetection.summary.infoIssues, "infoIssues mismatch");
});

runTest("summarizeDocumentReconstructionWorkspace returns the exact statusSummary object content", () => {
  const doc = buildFullyCompleteFixture();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);
  const issueDetection = detectDocumentReconstructionIssues(doc, completeness);

  const workspace = buildDocumentReconstructionWorkspace({ document: doc, completeness, issueDetection });
  const summary = summarizeDocumentReconstructionWorkspace(workspace);

  assertEqual(JSON.stringify(summary), JSON.stringify(workspace.statusSummary), "summary content mismatch");
});

// --- isComplete / isReadyForReview convenience function ----------------------

runTest("isDocumentReconstructionWorkspaceReady matches workspace.isReadyForReview", () => {
  const doc = buildFullyCompleteFixture();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);
  const issueDetection = detectDocumentReconstructionIssues(doc, completeness);

  const workspace = buildDocumentReconstructionWorkspace({ document: doc, completeness, issueDetection });

  assertEqual(isDocumentReconstructionWorkspaceReady(workspace), workspace.isReadyForReview, "mismatch");
  assertEqual(isDocumentReconstructionWorkspaceReady(workspace), true, "expected true on the fully complete fixture");
});

runTest("isDocumentReconstructionWorkspaceReady is false whenever the underlying issueDetection is not ready", () => {
  const doc = freshDocument();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);
  const issueDetection = detectDocumentReconstructionIssues(doc, completeness);

  const workspace = buildDocumentReconstructionWorkspace({ document: doc, completeness, issueDetection });

  assertEqual(isDocumentReconstructionWorkspaceReady(workspace), false, "expected false on an empty document");
});

// --- Full preservation of the three artifacts --------------------------------

runTest("preserves the document, completeness and issueDetection artifacts in full, without dropping fields", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Completed });
  doc = withField(doc, {
    id: "field-01",
    sectionId: "sec-01",
    key: "largura",
    required: true,
    confidence: 0.5,
    status: ReconstructionFieldStatus.Completed,
  });
  doc = withSource(doc, { id: "src-01", confidence: 0.5 });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);
  const issueDetection = detectDocumentReconstructionIssues(doc, completeness);

  const workspace = buildDocumentReconstructionWorkspace({ document: doc, completeness, issueDetection });

  assertEqual(Object.keys(workspace.document).sort().join(","), Object.keys(doc).sort().join(","), "document keys mismatch");
  assertEqual(
    Object.keys(workspace.completeness).sort().join(","),
    Object.keys(completeness).sort().join(","),
    "completeness keys mismatch",
  );
  assertEqual(
    Object.keys(workspace.issues).sort().join(","),
    Object.keys(issueDetection).sort().join(","),
    "issues keys mismatch",
  );
  assertEqual(workspace.issues.issues.length, issueDetection.issues.length, "issues array length mismatch");
  assertEqual(workspace.completeness.issues.length, completeness.issues.length, "completeness issues array length mismatch");
});

// --- Non-mutation -------------------------------------------------------------

runTest("never mutates the document, completeness or issueDetection inputs", () => {
  const doc = buildFullyCompleteFixture();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);
  const issueDetection = detectDocumentReconstructionIssues(doc, completeness);

  const docBefore = JSON.stringify(doc);
  const completenessBefore = JSON.stringify(completeness);
  const issueDetectionBefore = JSON.stringify(issueDetection);

  buildDocumentReconstructionWorkspace({ document: doc, completeness, issueDetection });

  assertEqual(JSON.stringify(doc), docBefore, "document must remain byte-for-byte unchanged");
  assertEqual(JSON.stringify(completeness), completenessBefore, "completeness must remain byte-for-byte unchanged");
  assertEqual(JSON.stringify(issueDetection), issueDetectionBefore, "issueDetection must remain byte-for-byte unchanged");
});

// --- Immutability of the output -----------------------------------------------

runTest("output is deeply immutable", () => {
  const doc = buildFullyCompleteFixture();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);
  const issueDetection = detectDocumentReconstructionIssues(doc, completeness);

  const workspace = buildDocumentReconstructionWorkspace({ document: doc, completeness, issueDetection });

  assertEqual(Object.isFrozen(workspace), true, "workspace should be frozen");
  assertEqual(Object.isFrozen(workspace.document), true, "workspace.document should be frozen");
  assertEqual(Object.isFrozen(workspace.completeness), true, "workspace.completeness should be frozen");
  assertEqual(Object.isFrozen(workspace.issues), true, "workspace.issues should be frozen");
  assertEqual(Object.isFrozen(workspace.statusSummary), true, "workspace.statusSummary should be frozen");
  assertEqual(Object.isFrozen(workspace.document.sections), true, "nested document.sections should be frozen");
});

// --- Determinism ---------------------------------------------------------------

runTest("same inputs always produce the same workspace", () => {
  const doc = buildFullyCompleteFixture();
  const completeness = evaluateDocumentReconstructionCompleteness(doc);
  const issueDetection = detectDocumentReconstructionIssues(doc, completeness);

  const first = JSON.stringify(buildDocumentReconstructionWorkspace({ document: doc, completeness, issueDetection }));
  const second = JSON.stringify(buildDocumentReconstructionWorkspace({ document: doc, completeness, issueDetection }));

  assertEqual(first, second, "expected deterministic workspace output");
});

runTest("completenessLevel reflects the exact enum value from the given completeness result", () => {
  const doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  const completeness = evaluateDocumentReconstructionCompleteness(doc);
  const issueDetection = detectDocumentReconstructionIssues(doc, completeness);

  const workspace = buildDocumentReconstructionWorkspace({ document: doc, completeness, issueDetection });

  assertEqual(workspace.statusSummary.completenessLevel, ReconstructionCompletenessLevel.Low, "completenessLevel mismatch");
});

// --- Forbidden imports / non-deterministic constructs ------------------------

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourceCode = readFileSync(
    resolve(process.cwd(), "src", "domain", "document-reconstruction", "document-reconstruction-workspace.ts"),
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
      `unexpected forbidden construct in document-reconstruction-workspace.ts: ${forbidden}`,
    );
  });
});

// --- Fixtures ----------------------------------------------------------------

function freshDocument(): DocumentReconstruction {
  const result = createDocumentReconstruction({
    id: "doc-recon-workspace-001",
    title: "Boletim de Medicao - Bloco D",
    documentType: DocumentReconstructionDocumentType.MeasurementBulletin,
    actor,
    occurredAt,
    correlationId: "document-reconstruction-workspace-correlation-001",
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
 * Score 100 fixture (mirrors the completeness and issue-detector test
 * suites): one Completed section with one Completed required field and
 * one source, pooled average confidence >= 0.80.
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
