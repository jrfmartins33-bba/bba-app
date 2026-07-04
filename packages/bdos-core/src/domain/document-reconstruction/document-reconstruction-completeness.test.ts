declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DocumentReconstructionDocumentType,
  ReconstructionCompletenessIssueCode,
  ReconstructionCompletenessLevel,
  ReconstructionCompletenessSeverity,
  ReconstructionFieldStatus,
  ReconstructionFieldValueType,
  ReconstructionSectionStatus,
  ReconstructionSourceType,
  addReconstructionField,
  addReconstructionSection,
  addReconstructionSource,
  advanceReconstructionFieldStatus,
  advanceReconstructionSectionStatus,
  createDocumentReconstruction,
  evaluateDocumentReconstructionCompleteness,
  isDocumentReconstructionComplete,
  summarizeDocumentReconstructionCompleteness,
  type AddReconstructionFieldInput,
  type AddReconstructionSectionInput,
  type AddReconstructionSourceInput,
  type DocumentReconstruction,
  type DocumentReconstructionResult,
} from "./index";

const actor = "engineer-bruno";
const occurredAt = "2026-07-04T14:00:00Z";

runTest("empty document reconstruction: score 0, level Low, not complete", () => {
  const doc = freshDocument();

  const result = evaluateDocumentReconstructionCompleteness(doc);

  assertEqual(result.score, 0, "score mismatch");
  assertEqual(result.level, ReconstructionCompletenessLevel.Low, "level mismatch");
  assertEqual(result.complete, false, "complete mismatch");
  assertEqual(result.summary.totalSections, 0, "totalSections mismatch");
  assertEqual(result.summary.totalFields, 0, "totalFields mismatch");
  assertEqual(result.summary.totalSources, 0, "totalSources mismatch");
  assertEqual(result.summary.averageConfidence, 0, "averageConfidence mismatch");
});

runTest("fully complete document reconstruction: score 100, level Complete, complete true", () => {
  const doc = buildFullyCompleteFixture();

  const result = evaluateDocumentReconstructionCompleteness(doc);

  assertEqual(result.score, 100, "score mismatch");
  assertEqual(result.level, ReconstructionCompletenessLevel.Complete, "level mismatch");
  assertEqual(result.complete, true, "complete mismatch");
  // FieldWithoutSource is the one issue that always fires while any field
  // exists: no mutator to populate `field.sourceIds` exists yet (14.4).
  assertEqual(result.issues.length, 1, "expected only the structurally-unavoidable FieldWithoutSource issue");
  assertEqual(hasIssue(result, ReconstructionCompletenessIssueCode.FieldWithoutSource), true, "expected FieldWithoutSource to fire");
});

runTest("score boundary: 20 points (sections exist only) maps to Low", () => {
  const doc = withSection(freshDocument(), { id: "sec-01", order: 1 });

  const result = evaluateDocumentReconstructionCompleteness(doc);

  assertEqual(result.score, 20, "score mismatch");
  assertEqual(result.level, ReconstructionCompletenessLevel.Low, "level mismatch");
});

runTest("score boundary: 30 points (sections exist + sources exist) maps to Medium", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  doc = withSource(doc, { id: "src-01", confidence: 0.5 });

  const result = evaluateDocumentReconstructionCompleteness(doc);

  assertEqual(result.score, 30, "score mismatch");
  assertEqual(result.level, ReconstructionCompletenessLevel.Medium, "level mismatch");
});

runTest("score boundary: 60 points (sections exist + all completed + fields exist) maps to Medium", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Completed });
  doc = withField(doc, { id: "field-01", sectionId: "sec-01", key: "largura", required: false, confidence: 0.5 });

  const result = evaluateDocumentReconstructionCompleteness(doc);

  assertEqual(result.score, 60, "score mismatch");
  assertEqual(result.level, ReconstructionCompletenessLevel.Medium, "level mismatch");
});

runTest("score boundary: 70 points (+ sources exist) maps to High", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Completed });
  doc = withField(doc, { id: "field-01", sectionId: "sec-01", key: "largura", required: false, confidence: 0.5 });
  doc = withSource(doc, { id: "src-01", confidence: 0.5 });

  const result = evaluateDocumentReconstructionCompleteness(doc);

  assertEqual(result.score, 70, "score mismatch");
  assertEqual(result.level, ReconstructionCompletenessLevel.High, "level mismatch");
});

runTest("score boundary: 80 points (+ average confidence >= 0.80, still missing required-complete bucket) maps to High", () => {
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

  const result = evaluateDocumentReconstructionCompleteness(doc);

  assertEqual(result.score, 80, "score mismatch");
  assertEqual(result.level, ReconstructionCompletenessLevel.High, "level mismatch");
});

runTest("score boundary: 90 points (all buckets except sources) maps to Complete", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Completed });
  doc = withField(doc, {
    id: "field-01",
    sectionId: "sec-01",
    key: "largura",
    required: true,
    confidence: 0.9,
    status: ReconstructionFieldStatus.Completed,
  });

  const result = evaluateDocumentReconstructionCompleteness(doc);

  assertEqual(result.score, 90, "score mismatch");
  assertEqual(result.level, ReconstructionCompletenessLevel.Complete, "level mismatch");
  assertEqual(result.complete, true, "complete mismatch");
});

runTest("NoSections issue fires when there are no sections, and never when at least one exists", () => {
  const empty = freshDocument();
  const emptyResult = evaluateDocumentReconstructionCompleteness(empty);
  assertEqual(hasIssue(emptyResult, ReconstructionCompletenessIssueCode.NoSections), true, "expected NoSections to fire");

  const withOneSection = withSection(freshDocument(), { id: "sec-01", order: 1 });
  const result = evaluateDocumentReconstructionCompleteness(withOneSection);
  assertEqual(hasIssue(result, ReconstructionCompletenessIssueCode.NoSections), false, "expected NoSections not to fire");
});

runTest("NoFields issue fires when there are no fields, and never when at least one exists", () => {
  const withOneSection = withSection(freshDocument(), { id: "sec-01", order: 1 });
  const noFieldsResult = evaluateDocumentReconstructionCompleteness(withOneSection);
  assertEqual(hasIssue(noFieldsResult, ReconstructionCompletenessIssueCode.NoFields), true, "expected NoFields to fire");

  const withOneField = withField(withOneSection, { id: "field-01", sectionId: "sec-01", key: "largura", required: false, confidence: 0.5 });
  const result = evaluateDocumentReconstructionCompleteness(withOneField);
  assertEqual(hasIssue(result, ReconstructionCompletenessIssueCode.NoFields), false, "expected NoFields not to fire");
});

runTest("NoSources issue fires when there are no sources, and never when at least one exists", () => {
  const withoutSources = freshDocument();
  const noSourcesResult = evaluateDocumentReconstructionCompleteness(withoutSources);
  assertEqual(hasIssue(noSourcesResult, ReconstructionCompletenessIssueCode.NoSources), true, "expected NoSources to fire");

  const withOneSource = withSource(withoutSources, { id: "src-01", confidence: 0.9 });
  const result = evaluateDocumentReconstructionCompleteness(withOneSource);
  assertEqual(hasIssue(result, ReconstructionCompletenessIssueCode.NoSources), false, "expected NoSources not to fire");
});

runTest("RequiredFieldMissing fires when no required field is defined, RequiredFieldIncomplete when some exist unfinished, neither when all done", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  doc = withField(doc, { id: "field-01", sectionId: "sec-01", key: "largura", required: false, confidence: 0.5 });
  const noRequiredResult = evaluateDocumentReconstructionCompleteness(doc);
  assertEqual(hasIssue(noRequiredResult, ReconstructionCompletenessIssueCode.RequiredFieldMissing), true, "expected RequiredFieldMissing to fire");
  assertEqual(hasIssue(noRequiredResult, ReconstructionCompletenessIssueCode.RequiredFieldIncomplete), false, "expected RequiredFieldIncomplete not to fire alongside RequiredFieldMissing");

  let withRequired = withSection(freshDocument(), { id: "sec-01", order: 1 });
  withRequired = withField(withRequired, {
    id: "field-01",
    sectionId: "sec-01",
    key: "largura",
    required: true,
    confidence: 0.5,
    status: ReconstructionFieldStatus.Building,
  });
  const incompleteResult = evaluateDocumentReconstructionCompleteness(withRequired);
  assertEqual(hasIssue(incompleteResult, ReconstructionCompletenessIssueCode.RequiredFieldMissing), false, "expected RequiredFieldMissing not to fire when a required field exists");
  assertEqual(hasIssue(incompleteResult, ReconstructionCompletenessIssueCode.RequiredFieldIncomplete), true, "expected RequiredFieldIncomplete to fire");
  const incompleteIssue = incompleteResult.issues.find((issue) => issue.code === ReconstructionCompletenessIssueCode.RequiredFieldIncomplete);
  assertEqual(incompleteIssue?.message, "1 of 1 required field(s) are not yet Completed.", "RequiredFieldIncomplete message mismatch");

  let allDone = withSection(freshDocument(), { id: "sec-01", order: 1 });
  allDone = withField(allDone, {
    id: "field-01",
    sectionId: "sec-01",
    key: "largura",
    required: true,
    confidence: 0.5,
    status: ReconstructionFieldStatus.Completed,
  });
  const doneResult = evaluateDocumentReconstructionCompleteness(allDone);
  assertEqual(hasIssue(doneResult, ReconstructionCompletenessIssueCode.RequiredFieldMissing), false, "expected RequiredFieldMissing not to fire when complete");
  assertEqual(hasIssue(doneResult, ReconstructionCompletenessIssueCode.RequiredFieldIncomplete), false, "expected RequiredFieldIncomplete not to fire when complete");
});

runTest("FieldWithoutSource fires whenever fields exist and never when there are none", () => {
  const withoutFields = withSection(freshDocument(), { id: "sec-01", order: 1 });
  const noFieldsResult = evaluateDocumentReconstructionCompleteness(withoutFields);
  assertEqual(hasIssue(noFieldsResult, ReconstructionCompletenessIssueCode.FieldWithoutSource), false, "expected FieldWithoutSource not to fire when there are no fields");

  const withField_ = withField(withoutFields, { id: "field-01", sectionId: "sec-01", key: "largura", required: false, confidence: 0.5 });
  const result = evaluateDocumentReconstructionCompleteness(withField_);
  assertEqual(hasIssue(result, ReconstructionCompletenessIssueCode.FieldWithoutSource), true, "expected FieldWithoutSource to fire (no mutator exists yet to link a source to a field)");
  const issue = result.issues.find((entry) => entry.code === ReconstructionCompletenessIssueCode.FieldWithoutSource);
  assertEqual(issue?.message, "1 field(s) have no linked source.", "FieldWithoutSource message mismatch");
});

runTest("SectionWithoutFields fires only for the section(s) lacking fields, isolated from NoFields when another section has fields", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  doc = withSection(doc, { id: "sec-02", order: 2 });
  doc = withField(doc, { id: "field-01", sectionId: "sec-01", key: "largura", required: false, confidence: 0.5 });

  const result = evaluateDocumentReconstructionCompleteness(doc);

  assertEqual(hasIssue(result, ReconstructionCompletenessIssueCode.NoFields), false, "expected NoFields not to fire since one section has a field");
  assertEqual(hasIssue(result, ReconstructionCompletenessIssueCode.SectionWithoutFields), true, "expected SectionWithoutFields to fire for sec-02");
  const issue = result.issues.find((entry) => entry.code === ReconstructionCompletenessIssueCode.SectionWithoutFields);
  assertEqual(issue?.message, "1 section(s) have no fields.", "SectionWithoutFields message mismatch");
});

runTest("SectionIncomplete fires when a section is not Completed, and never when all sections are Completed", () => {
  const notCompleted = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Building });
  const notCompletedResult = evaluateDocumentReconstructionCompleteness(notCompleted);
  assertEqual(hasIssue(notCompletedResult, ReconstructionCompletenessIssueCode.SectionIncomplete), true, "expected SectionIncomplete to fire");

  const completed = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Completed });
  const completedResult = evaluateDocumentReconstructionCompleteness(completed);
  assertEqual(hasIssue(completedResult, ReconstructionCompletenessIssueCode.SectionIncomplete), false, "expected SectionIncomplete not to fire");
});

runTest("LowConfidence fires when average confidence is below 0.80, and never when at or above it", () => {
  const low = withSource(freshDocument(), { id: "src-01", confidence: 0.5 });
  const lowResult = evaluateDocumentReconstructionCompleteness(low);
  assertEqual(hasIssue(lowResult, ReconstructionCompletenessIssueCode.LowConfidence), true, "expected LowConfidence to fire");
  const lowIssue = lowResult.issues.find((entry) => entry.code === ReconstructionCompletenessIssueCode.LowConfidence);
  assertEqual(lowIssue?.severity, ReconstructionCompletenessSeverity.Info, "LowConfidence severity mismatch");

  const high = withSource(freshDocument(), { id: "src-01", confidence: 0.8 });
  const highResult = evaluateDocumentReconstructionCompleteness(high);
  assertEqual(hasIssue(highResult, ReconstructionCompletenessIssueCode.LowConfidence), false, "expected LowConfidence not to fire at exactly the threshold");
});

runTest("averageConfidence pools both source and field confidence values", () => {
  let doc = withSection(freshDocument(), { id: "sec-01", order: 1 });
  doc = withSource(doc, { id: "src-01", confidence: 1.0 });
  doc = withField(doc, { id: "field-01", sectionId: "sec-01", key: "largura", required: false, confidence: 0.6 });

  const result = evaluateDocumentReconstructionCompleteness(doc);

  assertEqual(result.summary.averageConfidence, 0.8, "expected pooled average of source (1.0) and field (0.6) confidence");
});

runTest("multiple issues can fire together on a poorly-formed document reconstruction", () => {
  const doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Building });

  const result = evaluateDocumentReconstructionCompleteness(doc);

  const codes = result.issues.map((issue) => issue.code).sort();
  assertEqual(
    codes.join(","),
    [
      ReconstructionCompletenessIssueCode.NoFields,
      ReconstructionCompletenessIssueCode.NoSources,
      ReconstructionCompletenessIssueCode.RequiredFieldMissing,
      ReconstructionCompletenessIssueCode.SectionWithoutFields,
      ReconstructionCompletenessIssueCode.SectionIncomplete,
      ReconstructionCompletenessIssueCode.LowConfidence,
    ]
      .slice()
      .sort()
      .join(","),
    "expected NoFields, NoSources, RequiredFieldMissing, SectionWithoutFields, SectionIncomplete and LowConfidence to fire together",
  );
});

runTest("summarizeDocumentReconstructionCompleteness matches evaluate's summary", () => {
  const doc = buildFullyCompleteFixture();

  const summary = summarizeDocumentReconstructionCompleteness(doc);
  const evaluated = evaluateDocumentReconstructionCompleteness(doc);

  assertEqual(JSON.stringify(summary), JSON.stringify(evaluated.summary), "expected identical summary content");
});

runTest("isDocumentReconstructionComplete matches evaluate's complete flag", () => {
  const emptyDoc = freshDocument();
  assertEqual(isDocumentReconstructionComplete(emptyDoc), false, "expected empty document not complete");

  const fullDoc = buildFullyCompleteFixture();
  assertEqual(isDocumentReconstructionComplete(fullDoc), true, "expected fully complete document to be complete");
});

runTest("never mutates the aggregate: status, timeline, trace, summary and metadata are untouched", () => {
  const doc = buildFullyCompleteFixture();
  const before = JSON.stringify(doc);

  evaluateDocumentReconstructionCompleteness(doc);
  summarizeDocumentReconstructionCompleteness(doc);
  isDocumentReconstructionComplete(doc);

  assertEqual(JSON.stringify(doc), before, "aggregate must remain byte-for-byte unchanged after evaluation");
});

runTest("output is deeply immutable", () => {
  const doc = buildFullyCompleteFixture();

  const result = evaluateDocumentReconstructionCompleteness(doc);

  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.issues), true, "issues should be frozen");
  assertEqual(Object.isFrozen(result.summary), true, "summary should be frozen");
});

runTest("evaluation is deterministic: same aggregate always yields the same result", () => {
  const doc = withSection(freshDocument(), { id: "sec-01", order: 1, status: ReconstructionSectionStatus.Building });

  const first = JSON.stringify(evaluateDocumentReconstructionCompleteness(doc));
  const second = JSON.stringify(evaluateDocumentReconstructionCompleteness(doc));

  assertEqual(first, second, "expected deterministic evaluation output");
});

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourceCode = readFileSync(
    resolve(process.cwd(), "src", "domain", "document-reconstruction", "document-reconstruction-completeness.ts"),
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
      `unexpected forbidden construct in document-reconstruction-completeness.ts: ${forbidden}`,
    );
  });
});

// --- Fixtures ----------------------------------------------------------------

function freshDocument(): DocumentReconstruction {
  const result = createDocumentReconstruction({
    id: "doc-recon-completeness-001",
    title: "Boletim de Medicao - Bloco B",
    documentType: DocumentReconstructionDocumentType.MeasurementBulletin,
    actor,
    occurredAt,
    correlationId: "document-reconstruction-completeness-correlation-001",
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
 * Score 100: at least one Completed section with at least one Completed
 * required field linked to it (structurally, `field.sourceIds` remains
 * empty — no mutator to populate it exists yet), plus a source, with
 * pooled average confidence >= 0.80.
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

function hasIssue(
  result: ReturnType<typeof evaluateDocumentReconstructionCompleteness>,
  code: ReconstructionCompletenessIssueCode,
): boolean {
  return result.issues.some((issue) => issue.code === code);
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
