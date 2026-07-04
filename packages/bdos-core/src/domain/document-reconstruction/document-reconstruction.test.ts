declare const process: { cwd(): string };

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  DocumentReconstructionDocumentType,
  DocumentReconstructionStatus,
  ReconstructionFieldStatus,
  ReconstructionFieldValueType,
  ReconstructionSectionStatus,
  ReconstructionSourceType,
  addReconstructionField,
  addReconstructionSection,
  addReconstructionSource,
  advanceDocumentReconstructionStatus,
  advanceReconstructionFieldStatus,
  advanceReconstructionSectionStatus,
  createDocumentReconstruction,
  findReconstructionField,
  findReconstructionSection,
  findReconstructionSource,
  listFieldsBySection,
  listReconstructionFields,
  listReconstructionSections,
  listReconstructionSources,
  removeReconstructionField,
  removeReconstructionSection,
  removeReconstructionSource,
  summarizeDocumentReconstruction,
  summarizeReconstructionFields,
  summarizeReconstructionSections,
  summarizeReconstructionSources,
  updateReconstructionFieldValue,
  type CreateDocumentReconstructionInput,
  type DocumentReconstruction,
  type DocumentReconstructionResult,
  type ReconstructionFieldInput,
  type ReconstructionSectionInput,
  type ReconstructionSourceInput,
} from "./index";

const documentId = "doc-recon-001";
const actor = "engineer-bruno";
const occurredAt = "2026-07-04T14:00:00Z";
const correlationId = "document-reconstruction-correlation-001";
const createdBy = "engineering-app";
const sourceSystem = "engineering-workspace";

runTest("valid creation", () => {
  const result = createDocumentReconstruction(createInputFixture());

  assertSuccess(result, "expected creation success");
  assertEqual(result.documentReconstruction.id, documentId, "id mismatch");
  assertEqual(result.documentReconstruction.title, "Boletim de Medicao - Bloco B", "title mismatch");
  assertEqual(
    result.documentReconstruction.documentType,
    DocumentReconstructionDocumentType.MeasurementBulletin,
    "documentType mismatch",
  );
  assertEqual(result.documentReconstruction.status, DocumentReconstructionStatus.Draft, "initial status mismatch");
  assertEqual(result.documentReconstruction.sections.length, 0, "expected empty sections by default");
  assertEqual(result.documentReconstruction.sources.length, 0, "expected empty sources by default");
  assertEqual(result.documentReconstruction.issues.length, 0, "expected empty issues by default");
  assertEqual(result.documentReconstruction.timeline.length, 1, "timeline count mismatch");
  assertEqual(result.documentReconstruction.timeline[0]?.type, "document_reconstruction_created", "timeline type mismatch");
  assertEqual(result.documentReconstruction.trace.length, 1, "trace count mismatch");
  assertEqual(result.documentReconstruction.trace[0]?.action, "document_reconstruction_created", "trace action mismatch");
});

runTest("accepts an optional description and defaults it to null when absent", () => {
  const withDescription = createDocumentReconstruction(
    createInputFixture({ description: "Reconstrucao do boletim de medicao do bloco B." }),
  );
  assertSuccess(withDescription, "expected creation success");
  assertEqual(
    withDescription.documentReconstruction.description,
    "Reconstrucao do boletim de medicao do bloco B.",
    "description mismatch",
  );

  const withoutDescription = createDocumentReconstruction(createInputFixture({ description: undefined }));
  assertSuccess(withoutDescription, "expected creation success");
  assertEqual(withoutDescription.documentReconstruction.description, null, "expected null description by default");
});

runTest("rejects missing id", () => {
  const result = createDocumentReconstruction(createInputFixture({ id: "" }));
  assertFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejects missing title", () => {
  const result = createDocumentReconstruction(createInputFixture({ title: "" }));
  assertFailure(result, "expected missing title failure");
  assertEqual(result.errors[0]?.code, "missing_title", "error code mismatch");
});

runTest("rejects missing documentType", () => {
  const result = createDocumentReconstruction(
    createInputFixture({ documentType: "" as DocumentReconstructionDocumentType }),
  );
  assertFailure(result, "expected missing documentType failure");
  assertEqual(result.errors[0]?.code, "missing_document_type", "error code mismatch");
});

runTest("summarizeDocumentReconstruction matches document reconstruction state", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const draftSummary = summarizeDocumentReconstruction(created.documentReconstruction);
  assertEqual(draftSummary.status, DocumentReconstructionStatus.Draft, "draft summary status mismatch");
  assertEqual(
    draftSummary.documentType,
    DocumentReconstructionDocumentType.MeasurementBulletin,
    "draft summary documentType mismatch",
  );
  assertEqual(draftSummary.totalSections, 0, "draft summary totalSections mismatch");
  assertEqual(draftSummary.totalSources, 0, "draft summary totalSources mismatch");
  assertEqual(draftSummary.totalFields, 0, "draft summary totalFields mismatch");
  assertEqual(draftSummary.totalIssues, 0, "draft summary totalIssues mismatch");
  assertEqual(draftSummary.isComplete, false, "draft summary isComplete mismatch");

  const reconstructed = buildReconstructedFixture();
  assertEqual(summarizeDocumentReconstruction(reconstructed).isComplete, true, "reconstructed summary isComplete mismatch");

  const incomplete = buildIncompleteFixture();
  assertEqual(summarizeDocumentReconstruction(incomplete).isComplete, false, "incomplete summary isComplete mismatch");
});

runTest("valid transition path: Draft -> Reconstructing -> Reconstructed -> ReadyForReview -> Approved -> Archived", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const reconstructing = advanceDocumentReconstructionStatus({
    documentReconstruction: created.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Reconstructing,
    actor,
    occurredAt,
  });
  assertSuccess(reconstructing, "expected reconstructing success");
  assertEqual(reconstructing.documentReconstruction.status, DocumentReconstructionStatus.Reconstructing, "status after reconstructing mismatch");

  const reconstructed = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructing.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Reconstructed,
    actor,
    occurredAt,
  });
  assertSuccess(reconstructed, "expected reconstructed success");
  assertEqual(reconstructed.documentReconstruction.status, DocumentReconstructionStatus.Reconstructed, "status after reconstructed mismatch");

  const readyForReview = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructed.documentReconstruction,
    toStatus: DocumentReconstructionStatus.ReadyForReview,
    actor,
    occurredAt,
  });
  assertSuccess(readyForReview, "expected readyForReview success");
  assertEqual(readyForReview.documentReconstruction.status, DocumentReconstructionStatus.ReadyForReview, "status after readyForReview mismatch");

  const approved = advanceDocumentReconstructionStatus({
    documentReconstruction: readyForReview.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Approved,
    actor,
    occurredAt,
  });
  assertSuccess(approved, "expected approved success");
  assertEqual(approved.documentReconstruction.status, DocumentReconstructionStatus.Approved, "status after approved mismatch");

  const archived = advanceDocumentReconstructionStatus({
    documentReconstruction: approved.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archived, "expected archived success");
  assertEqual(archived.documentReconstruction.status, DocumentReconstructionStatus.Archived, "status after archived mismatch");
});

runTest("valid alternative path: Reconstructing -> Incomplete -> Reconstructing", () => {
  const incomplete = buildIncompleteFixture();
  assertEqual(incomplete.status, DocumentReconstructionStatus.Incomplete, "expected Incomplete status");

  const backToReconstructing = advanceDocumentReconstructionStatus({
    documentReconstruction: incomplete,
    toStatus: DocumentReconstructionStatus.Reconstructing,
    actor,
    occurredAt,
  });
  assertSuccess(backToReconstructing, "expected Incomplete -> Reconstructing success");
  assertEqual(
    backToReconstructing.documentReconstruction.status,
    DocumentReconstructionStatus.Reconstructing,
    "status after returning to reconstructing mismatch",
  );
});

runTest("valid rejection path: ReadyForReview -> Rejected -> Archived", () => {
  const readyForReview = buildReadyForReviewFixture();

  const rejected = advanceDocumentReconstructionStatus({
    documentReconstruction: readyForReview,
    toStatus: DocumentReconstructionStatus.Rejected,
    actor,
    occurredAt,
  });
  assertSuccess(rejected, "expected rejected success");
  assertEqual(rejected.documentReconstruction.status, DocumentReconstructionStatus.Rejected, "status after rejected mismatch");

  const archived = advanceDocumentReconstructionStatus({
    documentReconstruction: rejected.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archived, "expected archived success");
  assertEqual(archived.documentReconstruction.status, DocumentReconstructionStatus.Archived, "status after archived mismatch");
});

runTest("Draft, Incomplete, Reconstructed, ReadyForReview, Approved and Rejected can all archive directly", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");
  const archivedFromDraft = advanceDocumentReconstructionStatus({
    documentReconstruction: created.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archivedFromDraft, "expected Draft -> Archived to succeed");

  const incomplete = buildIncompleteFixture();
  const archivedFromIncomplete = advanceDocumentReconstructionStatus({
    documentReconstruction: incomplete,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archivedFromIncomplete, "expected Incomplete -> Archived to succeed");

  const reconstructed = buildReconstructedFixture();
  const archivedFromReconstructed = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructed,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archivedFromReconstructed, "expected Reconstructed -> Archived to succeed");

  const readyForReview = buildReadyForReviewFixture();
  const archivedFromReadyForReview = advanceDocumentReconstructionStatus({
    documentReconstruction: readyForReview,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archivedFromReadyForReview, "expected ReadyForReview -> Archived to succeed");

  const approved = buildApprovedFixture();
  const archivedFromApproved = advanceDocumentReconstructionStatus({
    documentReconstruction: approved,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archivedFromApproved, "expected Approved -> Archived to succeed");

  const rejected = buildRejectedFixture();
  const archivedFromRejected = advanceDocumentReconstructionStatus({
    documentReconstruction: rejected,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archivedFromRejected, "expected Rejected -> Archived to succeed");
});

runTest("Reconstructing cannot archive directly", () => {
  const reconstructing = buildReconstructingFixture();

  const result = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructing,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });

  assertFailure(result, "expected Reconstructing -> Archived to be rejected");
  assertEqual(result.errors[0]?.code, "invalid_document_reconstruction_status_transition", "error code mismatch");
});

runTest("rejects invalid status transitions", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const skipToReconstructed = advanceDocumentReconstructionStatus({
    documentReconstruction: created.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Reconstructed,
    actor,
    occurredAt,
  });
  assertFailure(skipToReconstructed, "expected Draft -> Reconstructed to be rejected");
  assertEqual(
    skipToReconstructed.errors[0]?.code,
    "invalid_document_reconstruction_status_transition",
    "error code mismatch",
  );

  const skipToApproved = advanceDocumentReconstructionStatus({
    documentReconstruction: created.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Approved,
    actor,
    occurredAt,
  });
  assertFailure(skipToApproved, "expected Draft -> Approved to be rejected");
  assertEqual(skipToApproved.errors[0]?.code, "invalid_document_reconstruction_status_transition", "error code mismatch");

  const reconstructing = buildReconstructingFixture();
  const backToDraft = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructing,
    toStatus: DocumentReconstructionStatus.Draft,
    actor,
    occurredAt,
  });
  assertFailure(backToDraft, "expected Reconstructing -> Draft to be rejected");
  assertEqual(backToDraft.errors[0]?.code, "invalid_document_reconstruction_status_transition", "error code mismatch");
});

runTest("Approved is operationally terminal: blocks further status changes except archive", () => {
  const approved = buildApprovedFixture();

  const backToReadyForReview = advanceDocumentReconstructionStatus({
    documentReconstruction: approved,
    toStatus: DocumentReconstructionStatus.ReadyForReview,
    actor,
    occurredAt,
  });
  assertFailure(backToReadyForReview, "expected Approved -> ReadyForReview to be rejected");
  assertEqual(
    backToReadyForReview.errors[0]?.code,
    "invalid_document_reconstruction_status_transition",
    "error code mismatch",
  );

  const toRejected = advanceDocumentReconstructionStatus({
    documentReconstruction: approved,
    toStatus: DocumentReconstructionStatus.Rejected,
    actor,
    occurredAt,
  });
  assertFailure(toRejected, "expected Approved -> Rejected to be rejected");
  assertEqual(toRejected.errors[0]?.code, "invalid_document_reconstruction_status_transition", "error code mismatch");

  const archived = advanceDocumentReconstructionStatus({
    documentReconstruction: approved,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archived, "expected Approved -> Archived to succeed");
});

runTest("Rejected is operationally terminal: blocks further status changes except archive", () => {
  const rejected = buildRejectedFixture();

  const toApproved = advanceDocumentReconstructionStatus({
    documentReconstruction: rejected,
    toStatus: DocumentReconstructionStatus.Approved,
    actor,
    occurredAt,
  });
  assertFailure(toApproved, "expected Rejected -> Approved to be rejected");
  assertEqual(toApproved.errors[0]?.code, "invalid_document_reconstruction_status_transition", "error code mismatch");

  const archived = advanceDocumentReconstructionStatus({
    documentReconstruction: rejected,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archived, "expected Rejected -> Archived to succeed");
});

runTest("Archived is an absolute terminal: blocks any further mutation", () => {
  const approved = buildApprovedFixture();
  const archivedResult = advanceDocumentReconstructionStatus({
    documentReconstruction: approved,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archivedResult, "expected archive success as setup step");
  const archived = archivedResult.documentReconstruction;

  [
    DocumentReconstructionStatus.Draft,
    DocumentReconstructionStatus.Reconstructing,
    DocumentReconstructionStatus.Reconstructed,
    DocumentReconstructionStatus.Incomplete,
    DocumentReconstructionStatus.ReadyForReview,
    DocumentReconstructionStatus.Approved,
    DocumentReconstructionStatus.Rejected,
    DocumentReconstructionStatus.Archived,
  ].forEach((toStatus, index) => {
    const result = advanceDocumentReconstructionStatus({ documentReconstruction: archived, toStatus, actor, occurredAt });
    assertFailure(result, `expected terminal block on attempt #${index}`);
    assertEqual(result.errors[0]?.code, "document_reconstruction_terminal", `error code mismatch on attempt #${index}`);
  });
});

runTest("only status transitions grow the timeline; every valid mutation grows trace", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");
  assertEqual(created.documentReconstruction.timeline.length, 1, "timeline length after creation mismatch");
  assertEqual(created.documentReconstruction.trace.length, 1, "trace length after creation mismatch");

  const reconstructing = advanceDocumentReconstructionStatus({
    documentReconstruction: created.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Reconstructing,
    actor,
    occurredAt,
  });
  assertSuccess(reconstructing, "expected reconstructing success");
  assertEqual(reconstructing.documentReconstruction.timeline.length, 2, "timeline length after reconstructing mismatch");
  assertEqual(reconstructing.documentReconstruction.trace.length, 2, "trace length after reconstructing mismatch");
  assertEqual(
    reconstructing.documentReconstruction.timeline[1]?.type,
    "document_reconstruction_status_advanced",
    "timeline type mismatch",
  );
});

runTest("output is deeply immutable", () => {
  const result = createDocumentReconstruction(createInputFixture());

  assertSuccess(result, "expected creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction), true, "documentReconstruction should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.sections), true, "sections should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.sources), true, "sources should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.issues), true, "issues should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.trace), true, "trace should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.timeline), true, "timeline should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.summary), true, "summary should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.metadata), true, "metadata should be frozen");

  const advanced = advanceDocumentReconstructionStatus({
    documentReconstruction: result.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Reconstructing,
    actor,
    occurredAt,
  });
  assertSuccess(advanced, "expected advance success");
  assertEqual(Object.isFrozen(advanced.documentReconstruction), true, "documentReconstruction after advance should be frozen");
  assertEqual(Object.isFrozen(advanced.documentReconstruction.timeline), true, "timeline after advance should be frozen");
});

runTest("creation is deterministic for identical input", () => {
  const input = createInputFixture();
  const first = JSON.stringify(createDocumentReconstruction(input));
  const second = JSON.stringify(createDocumentReconstruction(input));

  assertEqual(first, second, "expected deterministic creation output");
});

runTest("status transition is deterministic across identical operations", () => {
  const buildAdvanced = () => {
    const created = createDocumentReconstruction(createInputFixture());
    assertSuccess(created, "expected creation success");
    const advanced = advanceDocumentReconstructionStatus({
      documentReconstruction: created.documentReconstruction,
      toStatus: DocumentReconstructionStatus.Reconstructing,
      actor,
      occurredAt,
    });
    assertSuccess(advanced, "expected advance success");
    return advanced;
  };

  const first = JSON.stringify(buildAdvanced());
  const second = JSON.stringify(buildAdvanced());
  assertEqual(first, second, "expected deterministic transition output");
});

runTest("addReconstructionSource adds a valid source", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addReconstructionSource({
    documentReconstruction: created.documentReconstruction,
    source: sourceInputFixture(),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add source success");
  assertEqual(result.documentReconstruction.sources.length, 1, "sources count mismatch");
  assertEqual(result.documentReconstruction.sources[0]?.id, "src-01", "source id mismatch");
  assertEqual(result.documentReconstruction.sources[0]?.sourceType, ReconstructionSourceType.FieldEvidence, "sourceType mismatch");
  assertEqual(result.documentReconstruction.sources[0]?.sourceId, "EV-001", "sourceId mismatch");
  assertEqual(result.documentReconstruction.sources[0]?.confidence, 0.9, "confidence mismatch");
  assertEqual(result.documentReconstruction.sources[0]?.description, "Campo largura medido em campo.", "description mismatch");
});

runTest("addReconstructionSource defaults description to null and metadata to {} when absent", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addReconstructionSource({
    documentReconstruction: created.documentReconstruction,
    source: {
      id: "src-01",
      sourceType: ReconstructionSourceType.FieldEvidence,
      sourceId: "EV-001",
      confidence: 0.9,
    },
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add source success");
  assertEqual(result.documentReconstruction.sources[0]?.description, null, "expected null description by default");
  assertEqual(Object.keys(result.documentReconstruction.sources[0]?.metadata ?? { x: 1 }).length, 0, "expected empty metadata object by default");
});

runTest("rejects a source with missing id", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addReconstructionSource({
    documentReconstruction: created.documentReconstruction,
    source: sourceInputFixture({ id: "" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected missing source id failure");
  assertEqual(result.errors[0]?.code, "missing_reconstruction_source_id", "error code mismatch");
});

runTest("rejects a source with missing sourceType", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addReconstructionSource({
    documentReconstruction: created.documentReconstruction,
    source: sourceInputFixture({ sourceType: "" as ReconstructionSourceType }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected missing sourceType failure");
  assertEqual(result.errors[0]?.code, "missing_reconstruction_source_type", "error code mismatch");
});

runTest("rejects a source with missing sourceId", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addReconstructionSource({
    documentReconstruction: created.documentReconstruction,
    source: sourceInputFixture({ sourceId: "" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected missing sourceId failure");
  assertEqual(result.errors[0]?.code, "missing_reconstruction_source_reference_id", "error code mismatch");
});

runTest("rejects a source with an out-of-range or non-finite confidence", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const tooHigh = addReconstructionSource({
    documentReconstruction: created.documentReconstruction,
    source: sourceInputFixture({ confidence: 1.5 }),
    actor,
    occurredAt,
  });
  assertFailure(tooHigh, "expected out-of-range confidence failure");
  assertEqual(tooHigh.errors[0]?.code, "invalid_reconstruction_source_confidence", "error code mismatch");

  const negative = addReconstructionSource({
    documentReconstruction: created.documentReconstruction,
    source: sourceInputFixture({ confidence: -0.1 }),
    actor,
    occurredAt,
  });
  assertFailure(negative, "expected negative confidence failure");
  assertEqual(negative.errors[0]?.code, "invalid_reconstruction_source_confidence", "error code mismatch");

  const notANumber = addReconstructionSource({
    documentReconstruction: created.documentReconstruction,
    source: sourceInputFixture({ confidence: Number.NaN }),
    actor,
    occurredAt,
  });
  assertFailure(notANumber, "expected non-finite confidence failure");
  assertEqual(notANumber.errors[0]?.code, "invalid_reconstruction_source_confidence", "error code mismatch");
});

runTest("rejects adding a source with a duplicated id", () => {
  const withSource = buildWithSourceFixture();

  const result = addReconstructionSource({
    documentReconstruction: withSource,
    source: sourceInputFixture(),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate source id failure");
  assertEqual(result.errors[0]?.code, "duplicate_reconstruction_source_id", "error code mismatch");
});

runTest("allows two sources of different sourceType to share the same sourceId", () => {
  const withSource = buildWithSourceFixture();

  const result = addReconstructionSource({
    documentReconstruction: withSource,
    source: sourceInputFixture({
      id: "src-02",
      sourceType: ReconstructionSourceType.CalculationMemory,
      sourceId: "EV-001",
    }),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected second source with shared sourceId to succeed");
  assertEqual(result.documentReconstruction.sources.length, 2, "expected two distinct sources");
  assertEqual(result.documentReconstruction.sources[0]?.sourceId, "EV-001", "first sourceId mismatch");
  assertEqual(result.documentReconstruction.sources[1]?.sourceId, "EV-001", "second sourceId mismatch");
});

runTest("removeReconstructionSource removes an existing source", () => {
  const withSource = buildWithSourceFixture();

  const result = removeReconstructionSource({ documentReconstruction: withSource, id: "src-01", actor, occurredAt });

  assertSuccess(result, "expected remove success");
  assertEqual(result.documentReconstruction.sources.length, 0, "expected sources to be empty after removal");
});

runTest("rejects removing a source that does not exist", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = removeReconstructionSource({
    documentReconstruction: created.documentReconstruction,
    id: "unknown-src",
    actor,
    occurredAt,
  });

  assertFailure(result, "expected reconstruction_source_not_found failure");
  assertEqual(result.errors[0]?.code, "reconstruction_source_not_found", "error code mismatch");
});

runTest("findReconstructionSource finds an existing source and returns null otherwise", () => {
  const withSource = buildWithSourceFixture();

  const found = findReconstructionSource(withSource, "src-01");
  assertEqual(found?.id, "src-01", "expected to find source src-01");

  const notFound = findReconstructionSource(withSource, "unknown-src");
  assertEqual(notFound, null, "expected null for unknown source id");
});

runTest("listReconstructionSources lists all sources", () => {
  const withSource = buildWithSourceFixture();
  const listed = listReconstructionSources(withSource);

  assertEqual(listed.length, 1, "expected one listed source");
  assertEqual(listed[0]?.id, "src-01", "listed source id mismatch");
});

runTest("summarizeReconstructionSources reports totals, per-type counts and average confidence", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const emptySummary = summarizeReconstructionSources(created.documentReconstruction);
  assertEqual(emptySummary.totalSources, 0, "expected zero totalSources");
  assertEqual(emptySummary.totalByType.length, 0, "expected empty totalByType");
  assertEqual(emptySummary.distinctSourceTypes, 0, "expected zero distinctSourceTypes");
  assertEqual(emptySummary.averageConfidence, 0, "expected zero averageConfidence when no sources");

  const withFirst = addReconstructionSource({
    documentReconstruction: created.documentReconstruction,
    source: sourceInputFixture({ confidence: 0.8 }),
    actor,
    occurredAt,
  });
  assertSuccess(withFirst, "expected add success");

  const withSecond = addReconstructionSource({
    documentReconstruction: withFirst.documentReconstruction,
    source: sourceInputFixture({ id: "src-02", sourceType: ReconstructionSourceType.CalculationMemory, sourceId: "CM-001", confidence: 0.6 }),
    actor,
    occurredAt,
  });
  assertSuccess(withSecond, "expected second add success");

  const summary = summarizeReconstructionSources(withSecond.documentReconstruction);
  assertEqual(summary.totalSources, 2, "totalSources mismatch");
  assertEqual(summary.distinctSourceTypes, 2, "distinctSourceTypes mismatch");
  assertEqual(summary.totalByType.length, 2, "totalByType length mismatch");
  assertEqual(
    summary.totalByType.find((entry) => entry.sourceType === ReconstructionSourceType.FieldEvidence)?.total,
    1,
    "FieldEvidence count mismatch",
  );
  assertEqual(
    summary.totalByType.find((entry) => entry.sourceType === ReconstructionSourceType.CalculationMemory)?.total,
    1,
    "CalculationMemory count mismatch",
  );
  assertEqual(summary.averageConfidence, 0.7, "averageConfidence mismatch");
});

runTest("DocumentReconstructionSummary.totalSources reflects addReconstructionSource/removeReconstructionSource automatically", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");
  assertEqual(summarizeDocumentReconstruction(created.documentReconstruction).totalSources, 0, "initial totalSources mismatch");

  const withSource = addReconstructionSource({
    documentReconstruction: created.documentReconstruction,
    source: sourceInputFixture(),
    actor,
    occurredAt,
  });
  assertSuccess(withSource, "expected add success");
  assertEqual(summarizeDocumentReconstruction(withSource.documentReconstruction).totalSources, 1, "totalSources after add mismatch");

  const withoutSource = removeReconstructionSource({
    documentReconstruction: withSource.documentReconstruction,
    id: "src-01",
    actor,
    occurredAt,
  });
  assertSuccess(withoutSource, "expected remove success");
  assertEqual(summarizeDocumentReconstruction(withoutSource.documentReconstruction).totalSources, 0, "totalSources after remove mismatch");
});

runTest("blocks add/remove source once document reconstruction reaches Approved, Rejected or Archived", () => {
  const approvedWithSource = buildApprovedWithSourceFixture();
  const addOnApproved = addReconstructionSource({
    documentReconstruction: approvedWithSource,
    source: sourceInputFixture({ id: "src-02" }),
    actor,
    occurredAt,
  });
  assertFailure(addOnApproved, "expected add to be blocked on Approved");
  assertEqual(addOnApproved.errors[0]?.code, "document_reconstruction_locked_for_source_changes", "add error code mismatch");

  const removeOnApproved = removeReconstructionSource({
    documentReconstruction: approvedWithSource,
    id: "src-01",
    actor,
    occurredAt,
  });
  assertFailure(removeOnApproved, "expected remove to be blocked on Approved");
  assertEqual(removeOnApproved.errors[0]?.code, "document_reconstruction_locked_for_source_changes", "remove error code mismatch");

  const rejectedWithSource = buildRejectedWithSourceFixture();
  const addOnRejected = addReconstructionSource({
    documentReconstruction: rejectedWithSource,
    source: sourceInputFixture({ id: "src-02" }),
    actor,
    occurredAt,
  });
  assertFailure(addOnRejected, "expected add to be blocked on Rejected");
  assertEqual(addOnRejected.errors[0]?.code, "document_reconstruction_locked_for_source_changes", "add error code mismatch");

  const archivedResult = advanceDocumentReconstructionStatus({
    documentReconstruction: approvedWithSource,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archivedResult, "expected archive success as setup step");
  const removeOnArchived = removeReconstructionSource({
    documentReconstruction: archivedResult.documentReconstruction,
    id: "src-01",
    actor,
    occurredAt,
  });
  assertFailure(removeOnArchived, "expected remove to be blocked on Archived");
  assertEqual(removeOnArchived.errors[0]?.code, "document_reconstruction_locked_for_source_changes", "remove error code mismatch");
});

runTest("add/remove source grows trace but never grows timeline", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");
  assertEqual(created.documentReconstruction.trace.length, 1, "trace length after creation mismatch");
  assertEqual(created.documentReconstruction.timeline.length, 1, "timeline length after creation mismatch");

  const withSource = addReconstructionSource({
    documentReconstruction: created.documentReconstruction,
    source: sourceInputFixture(),
    actor,
    occurredAt,
  });
  assertSuccess(withSource, "expected add success");
  assertEqual(withSource.documentReconstruction.trace.length, 2, "trace must grow on add source");
  assertEqual(withSource.documentReconstruction.timeline.length, 1, "timeline must not grow on add source");
  assertEqual(withSource.documentReconstruction.trace[1]?.action, "reconstruction_source_added", "trace action mismatch");

  const withoutSource = removeReconstructionSource({
    documentReconstruction: withSource.documentReconstruction,
    id: "src-01",
    actor,
    occurredAt,
  });
  assertSuccess(withoutSource, "expected remove success");
  assertEqual(withoutSource.documentReconstruction.trace.length, 3, "trace must grow on remove source");
  assertEqual(withoutSource.documentReconstruction.timeline.length, 1, "timeline must not grow on remove source");
  assertEqual(withoutSource.documentReconstruction.trace[2]?.action, "reconstruction_source_removed", "trace action mismatch");
});

runTest("add/remove source output is deeply immutable", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addReconstructionSource({
    documentReconstruction: created.documentReconstruction,
    source: sourceInputFixture(),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add source success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction), true, "documentReconstruction should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.sources), true, "sources should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.sources[0]), true, "individual source should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.sources[0]?.metadata), true, "source metadata should be frozen");
});

runTest("add source is deterministic across identical operations", () => {
  const buildAdded = () => {
    const created = createDocumentReconstruction(createInputFixture());
    assertSuccess(created, "expected creation success");
    const result = addReconstructionSource({
      documentReconstruction: created.documentReconstruction,
      source: sourceInputFixture(),
      actor,
      occurredAt,
    });
    assertSuccess(result, "expected add source success");
    return result;
  };

  const first = JSON.stringify(buildAdded());
  const second = JSON.stringify(buildAdded());
  assertEqual(first, second, "expected deterministic add source output");
});

runTest("addReconstructionSection adds a valid section with initial Draft status", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addReconstructionSection({
    documentReconstruction: created.documentReconstruction,
    section: sectionInputFixture(),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add section success");
  assertEqual(result.documentReconstruction.sections.length, 1, "sections count mismatch");
  const [section] = result.documentReconstruction.sections;
  assertEqual(section?.id, "sec-01", "section id mismatch");
  assertEqual(section?.title, "Identificacao", "section title mismatch");
  assertEqual(section?.order, 1, "section order mismatch");
  assertEqual(section?.status, ReconstructionSectionStatus.Draft, "expected initial Draft status");
  assertEqual(section?.fields.length, 0, "expected empty fields by default");
  assertEqual(section?.sourceIds.length, 0, "expected empty sourceIds by default");
  assertEqual(section?.issues.length, 0, "expected empty issues by default");
});

runTest("addReconstructionSection defaults description to null and metadata to {} when absent", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addReconstructionSection({
    documentReconstruction: created.documentReconstruction,
    section: { id: "sec-01", title: "Identificacao", order: 1 },
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add section success");
  assertEqual(result.documentReconstruction.sections[0]?.description, null, "expected null description by default");
  assertEqual(Object.keys(result.documentReconstruction.sections[0]?.metadata ?? { x: 1 }).length, 0, "expected empty metadata object by default");
});

runTest("rejects a section with missing id", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addReconstructionSection({
    documentReconstruction: created.documentReconstruction,
    section: sectionInputFixture({ id: "" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected missing section id failure");
  assertEqual(result.errors[0]?.code, "missing_reconstruction_section_id", "error code mismatch");
});

runTest("rejects a section with missing title", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addReconstructionSection({
    documentReconstruction: created.documentReconstruction,
    section: sectionInputFixture({ title: "" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected missing section title failure");
  assertEqual(result.errors[0]?.code, "missing_reconstruction_section_title", "error code mismatch");
});

runTest("rejects a section with an invalid order", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const zero = addReconstructionSection({
    documentReconstruction: created.documentReconstruction,
    section: sectionInputFixture({ order: 0 }),
    actor,
    occurredAt,
  });
  assertFailure(zero, "expected order <= 0 failure");
  assertEqual(zero.errors[0]?.code, "invalid_reconstruction_section_order", "error code mismatch");

  const nonInteger = addReconstructionSection({
    documentReconstruction: created.documentReconstruction,
    section: sectionInputFixture({ order: 1.5 }),
    actor,
    occurredAt,
  });
  assertFailure(nonInteger, "expected non-integer order failure");
  assertEqual(nonInteger.errors[0]?.code, "invalid_reconstruction_section_order", "error code mismatch");
});

runTest("rejects adding a section with a duplicated id", () => {
  const withSection = buildWithSectionFixture();

  const result = addReconstructionSection({
    documentReconstruction: withSection,
    section: sectionInputFixture({ order: 2 }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate section id failure");
  assertEqual(result.errors[0]?.code, "duplicate_reconstruction_section_id", "error code mismatch");
});

runTest("rejects adding a section with a duplicated order", () => {
  const withSection = buildWithSectionFixture();

  const result = addReconstructionSection({
    documentReconstruction: withSection,
    section: sectionInputFixture({ id: "sec-02" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate section order failure");
  assertEqual(result.errors[0]?.code, "duplicate_reconstruction_section_order", "error code mismatch");
});

runTest("removeReconstructionSection removes an existing section", () => {
  const withSection = buildWithSectionFixture();

  const result = removeReconstructionSection({ documentReconstruction: withSection, id: "sec-01", actor, occurredAt });

  assertSuccess(result, "expected remove success");
  assertEqual(result.documentReconstruction.sections.length, 0, "expected sections to be empty after removal");
});

runTest("rejects removing a section that does not exist", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = removeReconstructionSection({
    documentReconstruction: created.documentReconstruction,
    id: "unknown-sec",
    actor,
    occurredAt,
  });

  assertFailure(result, "expected reconstruction_section_not_found failure");
  assertEqual(result.errors[0]?.code, "reconstruction_section_not_found", "error code mismatch");
});

runTest("findReconstructionSection finds an existing section and returns null otherwise", () => {
  const withSection = buildWithSectionFixture();

  const found = findReconstructionSection(withSection, "sec-01");
  assertEqual(found?.id, "sec-01", "expected to find section sec-01");

  const notFound = findReconstructionSection(withSection, "unknown-sec");
  assertEqual(notFound, null, "expected null for unknown section id");
});

runTest("listReconstructionSections always returns sections ordered by order, never by insertion order", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const withThird = addReconstructionSection({
    documentReconstruction: created.documentReconstruction,
    section: sectionInputFixture({ id: "sec-03", order: 3 }),
    actor,
    occurredAt,
  });
  assertSuccess(withThird, "expected add success");

  const withFirst = addReconstructionSection({
    documentReconstruction: withThird.documentReconstruction,
    section: sectionInputFixture({ id: "sec-01", order: 1 }),
    actor,
    occurredAt,
  });
  assertSuccess(withFirst, "expected add success");

  const withSecond = addReconstructionSection({
    documentReconstruction: withFirst.documentReconstruction,
    section: sectionInputFixture({ id: "sec-02", order: 2 }),
    actor,
    occurredAt,
  });
  assertSuccess(withSecond, "expected add success");

  const listed = listReconstructionSections(withSecond.documentReconstruction);
  assertEqual(listed.length, 3, "expected three listed sections");
  assertEqual(listed[0]?.id, "sec-01", "expected sec-01 first");
  assertEqual(listed[1]?.id, "sec-02", "expected sec-02 second");
  assertEqual(listed[2]?.id, "sec-03", "expected sec-03 third");
});

runTest("advanceReconstructionSectionStatus follows valid transition path: Draft -> Building -> Completed -> Archived", () => {
  const withSection = buildWithSectionFixture();

  const building = advanceReconstructionSectionStatus({
    documentReconstruction: withSection,
    id: "sec-01",
    toStatus: ReconstructionSectionStatus.Building,
    actor,
    occurredAt,
  });
  assertSuccess(building, "expected Draft -> Building success");
  assertEqual(findReconstructionSection(building.documentReconstruction, "sec-01")?.status, ReconstructionSectionStatus.Building, "status after Building mismatch");

  const completed = advanceReconstructionSectionStatus({
    documentReconstruction: building.documentReconstruction,
    id: "sec-01",
    toStatus: ReconstructionSectionStatus.Completed,
    actor,
    occurredAt,
  });
  assertSuccess(completed, "expected Building -> Completed success");
  assertEqual(findReconstructionSection(completed.documentReconstruction, "sec-01")?.status, ReconstructionSectionStatus.Completed, "status after Completed mismatch");

  const archived = advanceReconstructionSectionStatus({
    documentReconstruction: completed.documentReconstruction,
    id: "sec-01",
    toStatus: ReconstructionSectionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archived, "expected Completed -> Archived success");
  assertEqual(findReconstructionSection(archived.documentReconstruction, "sec-01")?.status, ReconstructionSectionStatus.Archived, "status after Archived mismatch");
});

runTest("advanceReconstructionSectionStatus follows valid alternative path: Building -> Incomplete -> Building", () => {
  const building = buildSectionInStatusFixture(ReconstructionSectionStatus.Building);

  const incomplete = advanceReconstructionSectionStatus({
    documentReconstruction: building,
    id: "sec-01",
    toStatus: ReconstructionSectionStatus.Incomplete,
    actor,
    occurredAt,
  });
  assertSuccess(incomplete, "expected Building -> Incomplete success");

  const backToBuilding = advanceReconstructionSectionStatus({
    documentReconstruction: incomplete.documentReconstruction,
    id: "sec-01",
    toStatus: ReconstructionSectionStatus.Building,
    actor,
    occurredAt,
  });
  assertSuccess(backToBuilding, "expected Incomplete -> Building success");
  assertEqual(
    findReconstructionSection(backToBuilding.documentReconstruction, "sec-01")?.status,
    ReconstructionSectionStatus.Building,
    "status after returning to Building mismatch",
  );
});

runTest("Building cannot archive directly", () => {
  const building = buildSectionInStatusFixture(ReconstructionSectionStatus.Building);

  const result = advanceReconstructionSectionStatus({
    documentReconstruction: building,
    id: "sec-01",
    toStatus: ReconstructionSectionStatus.Archived,
    actor,
    occurredAt,
  });

  assertFailure(result, "expected Building -> Archived to be rejected");
  assertEqual(result.errors[0]?.code, "invalid_reconstruction_section_status_transition", "error code mismatch");
});

runTest("rejects invalid section status transitions", () => {
  const withSection = buildWithSectionFixture();

  const skipToCompleted = advanceReconstructionSectionStatus({
    documentReconstruction: withSection,
    id: "sec-01",
    toStatus: ReconstructionSectionStatus.Completed,
    actor,
    occurredAt,
  });
  assertFailure(skipToCompleted, "expected Draft -> Completed to be rejected");
  assertEqual(skipToCompleted.errors[0]?.code, "invalid_reconstruction_section_status_transition", "error code mismatch");

  const building = buildSectionInStatusFixture(ReconstructionSectionStatus.Building);
  const backToDraft = advanceReconstructionSectionStatus({
    documentReconstruction: building,
    id: "sec-01",
    toStatus: ReconstructionSectionStatus.Draft,
    actor,
    occurredAt,
  });
  assertFailure(backToDraft, "expected Building -> Draft to be rejected");
  assertEqual(backToDraft.errors[0]?.code, "invalid_reconstruction_section_status_transition", "error code mismatch");
});

runTest("Archived section is a terminal: blocks any further status change", () => {
  const archived = buildSectionInStatusFixture(ReconstructionSectionStatus.Archived);

  [
    ReconstructionSectionStatus.Draft,
    ReconstructionSectionStatus.Building,
    ReconstructionSectionStatus.Completed,
    ReconstructionSectionStatus.Incomplete,
    ReconstructionSectionStatus.Archived,
  ].forEach((toStatus, index) => {
    const result = advanceReconstructionSectionStatus({ documentReconstruction: archived, id: "sec-01", toStatus, actor, occurredAt });
    assertFailure(result, `expected terminal block on attempt #${index}`);
    assertEqual(result.errors[0]?.code, "reconstruction_section_terminal", `error code mismatch on attempt #${index}`);
  });
});

runTest("advanceReconstructionSectionStatus rejects an unknown section id", () => {
  const withSection = buildWithSectionFixture();

  const result = advanceReconstructionSectionStatus({
    documentReconstruction: withSection,
    id: "unknown-sec",
    toStatus: ReconstructionSectionStatus.Building,
    actor,
    occurredAt,
  });

  assertFailure(result, "expected reconstruction_section_not_found failure");
  assertEqual(result.errors[0]?.code, "reconstruction_section_not_found", "error code mismatch");
});

runTest("summarizeReconstructionSections reports counts per status", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const emptySummary = summarizeReconstructionSections(created.documentReconstruction);
  assertEqual(emptySummary.totalSections, 0, "expected zero totalSections");
  assertEqual(emptySummary.draftSections, 0, "expected zero draftSections");

  const withDraft = addReconstructionSection({
    documentReconstruction: created.documentReconstruction,
    section: sectionInputFixture({ id: "sec-01", order: 1 }),
    actor,
    occurredAt,
  });
  assertSuccess(withDraft, "expected add success");

  const withBuilding = addReconstructionSection({
    documentReconstruction: withDraft.documentReconstruction,
    section: sectionInputFixture({ id: "sec-02", order: 2 }),
    actor,
    occurredAt,
  });
  assertSuccess(withBuilding, "expected add success");
  const building = advanceReconstructionSectionStatus({
    documentReconstruction: withBuilding.documentReconstruction,
    id: "sec-02",
    toStatus: ReconstructionSectionStatus.Building,
    actor,
    occurredAt,
  });
  assertSuccess(building, "expected advance success");

  const summary = summarizeReconstructionSections(building.documentReconstruction);
  assertEqual(summary.totalSections, 2, "totalSections mismatch");
  assertEqual(summary.draftSections, 1, "draftSections mismatch");
  assertEqual(summary.buildingSections, 1, "buildingSections mismatch");
  assertEqual(summary.completedSections, 0, "completedSections mismatch");
  assertEqual(summary.incompleteSections, 0, "incompleteSections mismatch");
  assertEqual(summary.archivedSections, 0, "archivedSections mismatch");
});

runTest("DocumentReconstructionSummary.totalSections reflects addReconstructionSection/removeReconstructionSection automatically", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");
  assertEqual(summarizeDocumentReconstruction(created.documentReconstruction).totalSections, 0, "initial totalSections mismatch");

  const withSection = addReconstructionSection({
    documentReconstruction: created.documentReconstruction,
    section: sectionInputFixture(),
    actor,
    occurredAt,
  });
  assertSuccess(withSection, "expected add success");
  assertEqual(summarizeDocumentReconstruction(withSection.documentReconstruction).totalSections, 1, "totalSections after add mismatch");

  const withoutSection = removeReconstructionSection({
    documentReconstruction: withSection.documentReconstruction,
    id: "sec-01",
    actor,
    occurredAt,
  });
  assertSuccess(withoutSection, "expected remove success");
  assertEqual(summarizeDocumentReconstruction(withoutSection.documentReconstruction).totalSections, 0, "totalSections after remove mismatch");
});

runTest("blocks add/remove/advance section once document reconstruction reaches Approved, Rejected or Archived", () => {
  const approvedWithSection = buildApprovedWithSectionFixture();

  const addOnApproved = addReconstructionSection({
    documentReconstruction: approvedWithSection,
    section: sectionInputFixture({ id: "sec-02", order: 2 }),
    actor,
    occurredAt,
  });
  assertFailure(addOnApproved, "expected add to be blocked on Approved");
  assertEqual(addOnApproved.errors[0]?.code, "document_reconstruction_locked_for_section_changes", "add error code mismatch");

  const advanceOnApproved = advanceReconstructionSectionStatus({
    documentReconstruction: approvedWithSection,
    id: "sec-01",
    toStatus: ReconstructionSectionStatus.Building,
    actor,
    occurredAt,
  });
  assertFailure(advanceOnApproved, "expected advance to be blocked on Approved");
  assertEqual(advanceOnApproved.errors[0]?.code, "document_reconstruction_locked_for_section_changes", "advance error code mismatch");

  const removeOnApproved = removeReconstructionSection({
    documentReconstruction: approvedWithSection,
    id: "sec-01",
    actor,
    occurredAt,
  });
  assertFailure(removeOnApproved, "expected remove to be blocked on Approved");
  assertEqual(removeOnApproved.errors[0]?.code, "document_reconstruction_locked_for_section_changes", "remove error code mismatch");

  const archivedResult = advanceDocumentReconstructionStatus({
    documentReconstruction: approvedWithSection,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archivedResult, "expected archive success as setup step");
  const removeOnArchived = removeReconstructionSection({
    documentReconstruction: archivedResult.documentReconstruction,
    id: "sec-01",
    actor,
    occurredAt,
  });
  assertFailure(removeOnArchived, "expected remove to be blocked on Archived");
  assertEqual(removeOnArchived.errors[0]?.code, "document_reconstruction_locked_for_section_changes", "remove error code mismatch");
});

runTest("add/remove/advance section grows trace but never grows the document timeline", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");
  assertEqual(created.documentReconstruction.trace.length, 1, "trace length after creation mismatch");
  assertEqual(created.documentReconstruction.timeline.length, 1, "timeline length after creation mismatch");

  const withSection = addReconstructionSection({
    documentReconstruction: created.documentReconstruction,
    section: sectionInputFixture(),
    actor,
    occurredAt,
  });
  assertSuccess(withSection, "expected add success");
  assertEqual(withSection.documentReconstruction.trace.length, 2, "trace must grow on add section");
  assertEqual(withSection.documentReconstruction.timeline.length, 1, "timeline must not grow on add section");
  assertEqual(withSection.documentReconstruction.trace[1]?.action, "reconstruction_section_added", "trace action mismatch");

  const building = advanceReconstructionSectionStatus({
    documentReconstruction: withSection.documentReconstruction,
    id: "sec-01",
    toStatus: ReconstructionSectionStatus.Building,
    actor,
    occurredAt,
  });
  assertSuccess(building, "expected advance success");
  assertEqual(building.documentReconstruction.trace.length, 3, "trace must grow on section status advance");
  assertEqual(building.documentReconstruction.timeline.length, 1, "timeline must not grow on section status advance");
  assertEqual(building.documentReconstruction.trace[2]?.action, "reconstruction_section_status_advanced", "trace action mismatch");

  const withoutSection = removeReconstructionSection({
    documentReconstruction: building.documentReconstruction,
    id: "sec-01",
    actor,
    occurredAt,
  });
  assertSuccess(withoutSection, "expected remove success");
  assertEqual(withoutSection.documentReconstruction.trace.length, 4, "trace must grow on remove section");
  assertEqual(withoutSection.documentReconstruction.timeline.length, 1, "timeline must not grow on remove section");
  assertEqual(withoutSection.documentReconstruction.trace[3]?.action, "reconstruction_section_removed", "trace action mismatch");
});

runTest("add/advance section output is deeply immutable", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addReconstructionSection({
    documentReconstruction: created.documentReconstruction,
    section: sectionInputFixture(),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add section success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction), true, "documentReconstruction should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.sections), true, "sections should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.sections[0]), true, "individual section should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.sections[0]?.fields), true, "section fields should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.sections[0]?.sourceIds), true, "section sourceIds should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.sections[0]?.issues), true, "section issues should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.sections[0]?.metadata), true, "section metadata should be frozen");

  const listed = listReconstructionSections(result.documentReconstruction);
  assertEqual(Object.isFrozen(listed), true, "listReconstructionSections output should be frozen");
});

runTest("add section is deterministic across identical operations", () => {
  const buildAdded = () => {
    const created = createDocumentReconstruction(createInputFixture());
    assertSuccess(created, "expected creation success");
    const result = addReconstructionSection({
      documentReconstruction: created.documentReconstruction,
      section: sectionInputFixture(),
      actor,
      occurredAt,
    });
    assertSuccess(result, "expected add section success");
    return result;
  };

  const first = JSON.stringify(buildAdded());
  const second = JSON.stringify(buildAdded());
  assertEqual(first, second, "expected deterministic add section output");
});

runTest("addReconstructionField adds a valid field with initial Draft status, null value and empty sourceIds", () => {
  const withSection = buildWithSectionFixture();

  const result = addReconstructionField({
    documentReconstruction: withSection,
    field: fieldInputFixture(),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add field success");
  assertEqual(result.documentReconstruction.fields.length, 1, "fields count mismatch");
  const [field] = result.documentReconstruction.fields;
  assertEqual(field?.id, "field-01", "field id mismatch");
  assertEqual(field?.sectionId, "sec-01", "field sectionId mismatch");
  assertEqual(field?.key, "largura", "field key mismatch");
  assertEqual(field?.label, "Largura", "field label mismatch");
  assertEqual(field?.value, null, "expected null initial value");
  assertEqual(field?.valueType, ReconstructionFieldValueType.Measurement, "field valueType mismatch");
  assertEqual(field?.status, ReconstructionFieldStatus.Draft, "expected initial Draft status");
  assertEqual(field?.required, true, "field required mismatch");
  assertEqual(field?.confidence, 0.8, "field confidence mismatch");
  assertEqual(field?.sourceIds.length, 0, "expected empty sourceIds by default");
});

runTest("addReconstructionField keeps the owning section's fields array in sync", () => {
  const withSection = buildWithSectionFixture();

  const result = addReconstructionField({
    documentReconstruction: withSection,
    field: fieldInputFixture(),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add field success");
  const section = findReconstructionSection(result.documentReconstruction, "sec-01");
  assertEqual(section?.fields.length, 1, "section fields count mismatch");
  assertEqual(section?.fields[0], "field-01", "section fields content mismatch");

  const withoutField = removeReconstructionField({
    documentReconstruction: result.documentReconstruction,
    id: "field-01",
    actor,
    occurredAt,
  });
  assertSuccess(withoutField, "expected remove field success");
  const sectionAfterRemove = findReconstructionSection(withoutField.documentReconstruction, "sec-01");
  assertEqual(sectionAfterRemove?.fields.length, 0, "expected section fields to be empty after field removal");
});

runTest("rejects a field with missing id", () => {
  const withSection = buildWithSectionFixture();

  const result = addReconstructionField({
    documentReconstruction: withSection,
    field: fieldInputFixture({ id: "" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected missing field id failure");
  assertEqual(result.errors[0]?.code, "missing_reconstruction_field_id", "error code mismatch");
});

runTest("rejects a field with missing sectionId", () => {
  const withSection = buildWithSectionFixture();

  const result = addReconstructionField({
    documentReconstruction: withSection,
    field: fieldInputFixture({ sectionId: "" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected missing field sectionId failure");
  assertEqual(result.errors[0]?.code, "missing_reconstruction_field_section_id", "error code mismatch");
});

runTest("rejects a field with missing key", () => {
  const withSection = buildWithSectionFixture();

  const result = addReconstructionField({
    documentReconstruction: withSection,
    field: fieldInputFixture({ key: "" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected missing field key failure");
  assertEqual(result.errors[0]?.code, "missing_reconstruction_field_key", "error code mismatch");
});

runTest("rejects a field with missing label", () => {
  const withSection = buildWithSectionFixture();

  const result = addReconstructionField({
    documentReconstruction: withSection,
    field: fieldInputFixture({ label: "" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected missing field label failure");
  assertEqual(result.errors[0]?.code, "missing_reconstruction_field_label", "error code mismatch");
});

runTest("rejects a field with missing valueType", () => {
  const withSection = buildWithSectionFixture();

  const result = addReconstructionField({
    documentReconstruction: withSection,
    field: fieldInputFixture({ valueType: "" as ReconstructionFieldValueType }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected missing field valueType failure");
  assertEqual(result.errors[0]?.code, "missing_reconstruction_field_value_type", "error code mismatch");
});

runTest("rejects a field with an out-of-range or non-finite confidence", () => {
  const withSection = buildWithSectionFixture();

  const tooHigh = addReconstructionField({
    documentReconstruction: withSection,
    field: fieldInputFixture({ confidence: 1.1 }),
    actor,
    occurredAt,
  });
  assertFailure(tooHigh, "expected out-of-range confidence failure");
  assertEqual(tooHigh.errors[0]?.code, "invalid_reconstruction_field_confidence", "error code mismatch");

  const notANumber = addReconstructionField({
    documentReconstruction: withSection,
    field: fieldInputFixture({ confidence: Number.NaN }),
    actor,
    occurredAt,
  });
  assertFailure(notANumber, "expected non-finite confidence failure");
  assertEqual(notANumber.errors[0]?.code, "invalid_reconstruction_field_confidence", "error code mismatch");
});

runTest("rejects adding a field to a section that does not exist", () => {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addReconstructionField({
    documentReconstruction: created.documentReconstruction,
    field: fieldInputFixture({ sectionId: "unknown-sec" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected reconstruction_field_section_not_found failure");
  assertEqual(result.errors[0]?.code, "reconstruction_field_section_not_found", "error code mismatch");
});

runTest("rejects adding a field with a duplicated id", () => {
  const withField = buildWithFieldFixture();

  const result = addReconstructionField({
    documentReconstruction: withField,
    field: fieldInputFixture({ key: "altura" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate field id failure");
  assertEqual(result.errors[0]?.code, "duplicate_reconstruction_field_id", "error code mismatch");
});

runTest("rejects adding a field with a duplicated key in the same section", () => {
  const withField = buildWithFieldFixture();

  const result = addReconstructionField({
    documentReconstruction: withField,
    field: fieldInputFixture({ id: "field-02" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate field key failure");
  assertEqual(result.errors[0]?.code, "duplicate_reconstruction_field_key", "error code mismatch");
});

runTest("allows the same key to exist in a different section", () => {
  const withField = buildWithFieldFixture();

  const withSecondSection = addReconstructionSection({
    documentReconstruction: withField,
    section: sectionInputFixture({ id: "sec-02", order: 2 }),
    actor,
    occurredAt,
  });
  assertSuccess(withSecondSection, "expected add second section success");

  const result = addReconstructionField({
    documentReconstruction: withSecondSection.documentReconstruction,
    field: fieldInputFixture({ id: "field-02", sectionId: "sec-02" }),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected same key in a different section to succeed");
  assertEqual(result.documentReconstruction.fields.length, 2, "expected two distinct fields");
});

runTest("removeReconstructionField removes an existing field", () => {
  const withField = buildWithFieldFixture();

  const result = removeReconstructionField({ documentReconstruction: withField, id: "field-01", actor, occurredAt });

  assertSuccess(result, "expected remove success");
  assertEqual(result.documentReconstruction.fields.length, 0, "expected fields to be empty after removal");
});

runTest("rejects removing a field that does not exist", () => {
  const withSection = buildWithSectionFixture();

  const result = removeReconstructionField({
    documentReconstruction: withSection,
    id: "unknown-field",
    actor,
    occurredAt,
  });

  assertFailure(result, "expected reconstruction_field_not_found failure");
  assertEqual(result.errors[0]?.code, "reconstruction_field_not_found", "error code mismatch");
});

runTest("updateReconstructionFieldValue sets the value and rejects an unknown field id", () => {
  const withField = buildWithFieldFixture();

  const result = updateReconstructionFieldValue({
    documentReconstruction: withField,
    id: "field-01",
    value: 3.2,
    actor,
    occurredAt,
  });
  assertSuccess(result, "expected update value success");
  assertEqual(findReconstructionField(result.documentReconstruction, "field-01")?.value, 3.2, "field value mismatch");

  const unknown = updateReconstructionFieldValue({
    documentReconstruction: withField,
    id: "unknown-field",
    value: "x",
    actor,
    occurredAt,
  });
  assertFailure(unknown, "expected reconstruction_field_not_found failure");
  assertEqual(unknown.errors[0]?.code, "reconstruction_field_not_found", "error code mismatch");
});

runTest("findReconstructionField finds an existing field and returns null otherwise", () => {
  const withField = buildWithFieldFixture();

  const found = findReconstructionField(withField, "field-01");
  assertEqual(found?.id, "field-01", "expected to find field-01");

  const notFound = findReconstructionField(withField, "unknown-field");
  assertEqual(notFound, null, "expected null for unknown field id");
});

runTest("listReconstructionFields orders by section.order then by field.key, never by insertion order", () => {
  const withSection = buildWithSectionFixture();

  const withSecondSection = addReconstructionSection({
    documentReconstruction: withSection,
    section: sectionInputFixture({ id: "sec-02", order: 2 }),
    actor,
    occurredAt,
  });
  assertSuccess(withSecondSection, "expected add second section success");

  const withLateSectionField = addReconstructionField({
    documentReconstruction: withSecondSection.documentReconstruction,
    field: fieldInputFixture({ id: "field-late", sectionId: "sec-02", key: "alfa" }),
    actor,
    occurredAt,
  });
  assertSuccess(withLateSectionField, "expected add success");

  const withZ = addReconstructionField({
    documentReconstruction: withLateSectionField.documentReconstruction,
    field: fieldInputFixture({ id: "field-z", sectionId: "sec-01", key: "zeta" }),
    actor,
    occurredAt,
  });
  assertSuccess(withZ, "expected add success");

  const withA = addReconstructionField({
    documentReconstruction: withZ.documentReconstruction,
    field: fieldInputFixture({ id: "field-a", sectionId: "sec-01", key: "alfa" }),
    actor,
    occurredAt,
  });
  assertSuccess(withA, "expected add success");

  const listed = listReconstructionFields(withA.documentReconstruction);
  assertEqual(listed.length, 3, "expected three listed fields");
  assertEqual(listed[0]?.id, "field-a", "expected alfa before zeta within sec-01");
  assertEqual(listed[1]?.id, "field-z", "expected zeta after alfa within sec-01");
  assertEqual(listed[2]?.id, "field-late", "expected field from higher-order section last, despite sharing key alfa");
});

runTest("listFieldsBySection returns only that section's fields, ordered alphabetically by key", () => {
  const withField = buildWithFieldFixture();

  const withSecondField = addReconstructionField({
    documentReconstruction: withField,
    field: fieldInputFixture({ id: "field-00", key: "altura" }),
    actor,
    occurredAt,
  });
  assertSuccess(withSecondField, "expected add success");

  const withSecondSection = addReconstructionSection({
    documentReconstruction: withSecondField.documentReconstruction,
    section: sectionInputFixture({ id: "sec-02", order: 2 }),
    actor,
    occurredAt,
  });
  assertSuccess(withSecondSection, "expected add second section success");

  const withOtherSectionField = addReconstructionField({
    documentReconstruction: withSecondSection.documentReconstruction,
    field: fieldInputFixture({ id: "field-other", sectionId: "sec-02", key: "comprimento" }),
    actor,
    occurredAt,
  });
  assertSuccess(withOtherSectionField, "expected add success");

  const listed = listFieldsBySection(withOtherSectionField.documentReconstruction, "sec-01");
  assertEqual(listed.length, 2, "expected two fields in sec-01");
  assertEqual(listed[0]?.key, "altura", "expected altura before largura");
  assertEqual(listed[1]?.key, "largura", "expected largura after altura");
});

runTest("advanceReconstructionFieldStatus follows valid transition path: Draft -> Building -> Completed -> Archived", () => {
  const withField = buildWithFieldFixture();

  const building = advanceReconstructionFieldStatus({
    documentReconstruction: withField,
    id: "field-01",
    toStatus: ReconstructionFieldStatus.Building,
    actor,
    occurredAt,
  });
  assertSuccess(building, "expected Draft -> Building success");
  assertEqual(findReconstructionField(building.documentReconstruction, "field-01")?.status, ReconstructionFieldStatus.Building, "status after Building mismatch");

  const completed = advanceReconstructionFieldStatus({
    documentReconstruction: building.documentReconstruction,
    id: "field-01",
    toStatus: ReconstructionFieldStatus.Completed,
    actor,
    occurredAt,
  });
  assertSuccess(completed, "expected Building -> Completed success");

  const archived = advanceReconstructionFieldStatus({
    documentReconstruction: completed.documentReconstruction,
    id: "field-01",
    toStatus: ReconstructionFieldStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archived, "expected Completed -> Archived success");
  assertEqual(findReconstructionField(archived.documentReconstruction, "field-01")?.status, ReconstructionFieldStatus.Archived, "status after Archived mismatch");
});

runTest("advanceReconstructionFieldStatus follows valid alternative path: Building -> Incomplete -> Building", () => {
  const building = buildFieldInStatusFixture(ReconstructionFieldStatus.Building);

  const incomplete = advanceReconstructionFieldStatus({
    documentReconstruction: building,
    id: "field-01",
    toStatus: ReconstructionFieldStatus.Incomplete,
    actor,
    occurredAt,
  });
  assertSuccess(incomplete, "expected Building -> Incomplete success");

  const backToBuilding = advanceReconstructionFieldStatus({
    documentReconstruction: incomplete.documentReconstruction,
    id: "field-01",
    toStatus: ReconstructionFieldStatus.Building,
    actor,
    occurredAt,
  });
  assertSuccess(backToBuilding, "expected Incomplete -> Building success");
});

runTest("Building cannot archive directly", () => {
  const building = buildFieldInStatusFixture(ReconstructionFieldStatus.Building);

  const result = advanceReconstructionFieldStatus({
    documentReconstruction: building,
    id: "field-01",
    toStatus: ReconstructionFieldStatus.Archived,
    actor,
    occurredAt,
  });

  assertFailure(result, "expected Building -> Archived to be rejected");
  assertEqual(result.errors[0]?.code, "invalid_reconstruction_field_status_transition", "error code mismatch");
});

runTest("rejects invalid field status transitions", () => {
  const withField = buildWithFieldFixture();

  const skipToCompleted = advanceReconstructionFieldStatus({
    documentReconstruction: withField,
    id: "field-01",
    toStatus: ReconstructionFieldStatus.Completed,
    actor,
    occurredAt,
  });
  assertFailure(skipToCompleted, "expected Draft -> Completed to be rejected");
  assertEqual(skipToCompleted.errors[0]?.code, "invalid_reconstruction_field_status_transition", "error code mismatch");
});

runTest("Archived field is a terminal: blocks any further status change", () => {
  const archived = buildFieldInStatusFixture(ReconstructionFieldStatus.Archived);

  [
    ReconstructionFieldStatus.Draft,
    ReconstructionFieldStatus.Building,
    ReconstructionFieldStatus.Completed,
    ReconstructionFieldStatus.Incomplete,
    ReconstructionFieldStatus.Archived,
  ].forEach((toStatus, index) => {
    const result = advanceReconstructionFieldStatus({ documentReconstruction: archived, id: "field-01", toStatus, actor, occurredAt });
    assertFailure(result, `expected terminal block on attempt #${index}`);
    assertEqual(result.errors[0]?.code, "reconstruction_field_terminal", `error code mismatch on attempt #${index}`);
  });
});

runTest("advanceReconstructionFieldStatus rejects an unknown field id", () => {
  const withField = buildWithFieldFixture();

  const result = advanceReconstructionFieldStatus({
    documentReconstruction: withField,
    id: "unknown-field",
    toStatus: ReconstructionFieldStatus.Building,
    actor,
    occurredAt,
  });

  assertFailure(result, "expected reconstruction_field_not_found failure");
  assertEqual(result.errors[0]?.code, "reconstruction_field_not_found", "error code mismatch");
});

runTest("summarizeReconstructionFields reports counts per status, required and average confidence", () => {
  const withSection = buildWithSectionFixture();

  const emptySummary = summarizeReconstructionFields(withSection);
  assertEqual(emptySummary.totalFields, 0, "expected zero totalFields");
  assertEqual(emptySummary.averageConfidence, 0, "expected zero averageConfidence when no fields");

  const withRequired = addReconstructionField({
    documentReconstruction: withSection,
    field: fieldInputFixture({ id: "field-01", key: "largura", required: true, confidence: 0.9 }),
    actor,
    occurredAt,
  });
  assertSuccess(withRequired, "expected add success");

  const withOptional = addReconstructionField({
    documentReconstruction: withRequired.documentReconstruction,
    field: fieldInputFixture({ id: "field-02", key: "altura", required: false, confidence: 0.5 }),
    actor,
    occurredAt,
  });
  assertSuccess(withOptional, "expected add success");

  const completedRequired = advanceReconstructionFieldStatus({
    documentReconstruction: withOptional.documentReconstruction,
    id: "field-01",
    toStatus: ReconstructionFieldStatus.Building,
    actor,
    occurredAt,
  });
  assertSuccess(completedRequired, "expected advance success");
  const completed = advanceReconstructionFieldStatus({
    documentReconstruction: completedRequired.documentReconstruction,
    id: "field-01",
    toStatus: ReconstructionFieldStatus.Completed,
    actor,
    occurredAt,
  });
  assertSuccess(completed, "expected advance success");

  const summary = summarizeReconstructionFields(completed.documentReconstruction);
  assertEqual(summary.totalFields, 2, "totalFields mismatch");
  assertEqual(summary.requiredFields, 1, "requiredFields mismatch");
  assertEqual(summary.completedFields, 1, "completedFields mismatch");
  assertEqual(summary.completedRequiredFields, 1, "completedRequiredFields mismatch");
  assertEqual(summary.draftFields, 1, "draftFields mismatch");
  assertEqual(summary.averageConfidence, 0.7, "averageConfidence mismatch");
});

runTest("DocumentReconstructionSummary.totalFields reflects addReconstructionField/removeReconstructionField automatically", () => {
  const withSection = buildWithSectionFixture();
  assertEqual(summarizeDocumentReconstruction(withSection).totalFields, 0, "initial totalFields mismatch");

  const withField = addReconstructionField({
    documentReconstruction: withSection,
    field: fieldInputFixture(),
    actor,
    occurredAt,
  });
  assertSuccess(withField, "expected add success");
  assertEqual(summarizeDocumentReconstruction(withField.documentReconstruction).totalFields, 1, "totalFields after add mismatch");

  const withoutField = removeReconstructionField({
    documentReconstruction: withField.documentReconstruction,
    id: "field-01",
    actor,
    occurredAt,
  });
  assertSuccess(withoutField, "expected remove success");
  assertEqual(summarizeDocumentReconstruction(withoutField.documentReconstruction).totalFields, 0, "totalFields after remove mismatch");
});

runTest("blocks add/remove/update value/advance status of fields once document reconstruction reaches Approved, Rejected or Archived", () => {
  const approvedWithField = buildApprovedWithFieldFixture();

  const addOnApproved = addReconstructionField({
    documentReconstruction: approvedWithField,
    field: fieldInputFixture({ id: "field-02", key: "altura" }),
    actor,
    occurredAt,
  });
  assertFailure(addOnApproved, "expected add to be blocked on Approved");
  assertEqual(addOnApproved.errors[0]?.code, "document_reconstruction_locked_for_field_changes", "add error code mismatch");

  const updateValueOnApproved = updateReconstructionFieldValue({
    documentReconstruction: approvedWithField,
    id: "field-01",
    value: 1,
    actor,
    occurredAt,
  });
  assertFailure(updateValueOnApproved, "expected update value to be blocked on Approved");
  assertEqual(updateValueOnApproved.errors[0]?.code, "document_reconstruction_locked_for_field_changes", "update value error code mismatch");

  const advanceOnApproved = advanceReconstructionFieldStatus({
    documentReconstruction: approvedWithField,
    id: "field-01",
    toStatus: ReconstructionFieldStatus.Building,
    actor,
    occurredAt,
  });
  assertFailure(advanceOnApproved, "expected advance to be blocked on Approved");
  assertEqual(advanceOnApproved.errors[0]?.code, "document_reconstruction_locked_for_field_changes", "advance error code mismatch");

  const removeOnApproved = removeReconstructionField({
    documentReconstruction: approvedWithField,
    id: "field-01",
    actor,
    occurredAt,
  });
  assertFailure(removeOnApproved, "expected remove to be blocked on Approved");
  assertEqual(removeOnApproved.errors[0]?.code, "document_reconstruction_locked_for_field_changes", "remove error code mismatch");

  const archivedResult = advanceDocumentReconstructionStatus({
    documentReconstruction: approvedWithField,
    toStatus: DocumentReconstructionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archivedResult, "expected archive success as setup step");
  const removeOnArchived = removeReconstructionField({
    documentReconstruction: archivedResult.documentReconstruction,
    id: "field-01",
    actor,
    occurredAt,
  });
  assertFailure(removeOnArchived, "expected remove to be blocked on Archived");
  assertEqual(removeOnArchived.errors[0]?.code, "document_reconstruction_locked_for_field_changes", "remove error code mismatch");
});

runTest("add/update value/advance status/remove field grows trace but never grows the document timeline", () => {
  const withSection = buildWithSectionFixture();
  assertEqual(withSection.trace.length, 2, "trace length before field operations mismatch");
  assertEqual(withSection.timeline.length, 1, "timeline length before field operations mismatch");

  const withField = addReconstructionField({
    documentReconstruction: withSection,
    field: fieldInputFixture(),
    actor,
    occurredAt,
  });
  assertSuccess(withField, "expected add success");
  assertEqual(withField.documentReconstruction.trace.length, 3, "trace must grow on add field");
  assertEqual(withField.documentReconstruction.timeline.length, 1, "timeline must not grow on add field");
  assertEqual(withField.documentReconstruction.trace[2]?.action, "reconstruction_field_added", "trace action mismatch");

  const withValue = updateReconstructionFieldValue({
    documentReconstruction: withField.documentReconstruction,
    id: "field-01",
    value: "3.2m",
    actor,
    occurredAt,
  });
  assertSuccess(withValue, "expected update value success");
  assertEqual(withValue.documentReconstruction.trace.length, 4, "trace must grow on update value");
  assertEqual(withValue.documentReconstruction.timeline.length, 1, "timeline must not grow on update value");
  assertEqual(withValue.documentReconstruction.trace[3]?.action, "reconstruction_field_value_updated", "trace action mismatch");

  const building = advanceReconstructionFieldStatus({
    documentReconstruction: withValue.documentReconstruction,
    id: "field-01",
    toStatus: ReconstructionFieldStatus.Building,
    actor,
    occurredAt,
  });
  assertSuccess(building, "expected advance success");
  assertEqual(building.documentReconstruction.trace.length, 5, "trace must grow on field status advance");
  assertEqual(building.documentReconstruction.timeline.length, 1, "timeline must not grow on field status advance");
  assertEqual(building.documentReconstruction.trace[4]?.action, "reconstruction_field_status_advanced", "trace action mismatch");

  const withoutField = removeReconstructionField({
    documentReconstruction: building.documentReconstruction,
    id: "field-01",
    actor,
    occurredAt,
  });
  assertSuccess(withoutField, "expected remove success");
  assertEqual(withoutField.documentReconstruction.trace.length, 6, "trace must grow on remove field");
  assertEqual(withoutField.documentReconstruction.timeline.length, 1, "timeline must not grow on remove field");
  assertEqual(withoutField.documentReconstruction.trace[5]?.action, "reconstruction_field_removed", "trace action mismatch");
});

runTest("add field output is deeply immutable", () => {
  const withSection = buildWithSectionFixture();

  const result = addReconstructionField({
    documentReconstruction: withSection,
    field: fieldInputFixture(),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add field success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction), true, "documentReconstruction should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.fields), true, "fields should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.fields[0]), true, "individual field should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.fields[0]?.sourceIds), true, "field sourceIds should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.fields[0]?.metadata), true, "field metadata should be frozen");
  assertEqual(Object.isFrozen(result.documentReconstruction.sections[0]?.fields), true, "owning section fields array should be frozen");

  const listedAll = listReconstructionFields(result.documentReconstruction);
  assertEqual(Object.isFrozen(listedAll), true, "listReconstructionFields output should be frozen");

  const listedBySection = listFieldsBySection(result.documentReconstruction, "sec-01");
  assertEqual(Object.isFrozen(listedBySection), true, "listFieldsBySection output should be frozen");
});

runTest("add field is deterministic across identical operations", () => {
  const buildAdded = () => {
    const withSection = buildWithSectionFixture();
    const result = addReconstructionField({
      documentReconstruction: withSection,
      field: fieldInputFixture(),
      actor,
      occurredAt,
    });
    assertSuccess(result, "expected add field success");
    return result;
  };

  const first = JSON.stringify(buildAdded());
  const second = JSON.stringify(buildAdded());
  assertEqual(first, second, "expected deterministic add field output");
});

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourceCode = readDomainSourceFiles();
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
      `unexpected forbidden construct in domain source: ${forbidden}`,
    );
  });
});

// --- Fixtures ----------------------------------------------------------------

function buildReconstructingFixture(): DocumentReconstruction {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");
  const reconstructing = advanceDocumentReconstructionStatus({
    documentReconstruction: created.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Reconstructing,
    actor,
    occurredAt,
  });
  assertSuccess(reconstructing, "expected reconstructing success");
  return reconstructing.documentReconstruction;
}

function buildReconstructedFixture(): DocumentReconstruction {
  const reconstructing = buildReconstructingFixture();
  const reconstructed = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructing,
    toStatus: DocumentReconstructionStatus.Reconstructed,
    actor,
    occurredAt,
  });
  assertSuccess(reconstructed, "expected reconstructed success");
  return reconstructed.documentReconstruction;
}

function buildIncompleteFixture(): DocumentReconstruction {
  const reconstructing = buildReconstructingFixture();
  const incomplete = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructing,
    toStatus: DocumentReconstructionStatus.Incomplete,
    actor,
    occurredAt,
  });
  assertSuccess(incomplete, "expected incomplete success");
  return incomplete.documentReconstruction;
}

function buildReadyForReviewFixture(): DocumentReconstruction {
  const reconstructed = buildReconstructedFixture();
  const readyForReview = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructed,
    toStatus: DocumentReconstructionStatus.ReadyForReview,
    actor,
    occurredAt,
  });
  assertSuccess(readyForReview, "expected readyForReview success");
  return readyForReview.documentReconstruction;
}

function buildApprovedFixture(): DocumentReconstruction {
  const readyForReview = buildReadyForReviewFixture();
  const approved = advanceDocumentReconstructionStatus({
    documentReconstruction: readyForReview,
    toStatus: DocumentReconstructionStatus.Approved,
    actor,
    occurredAt,
  });
  assertSuccess(approved, "expected approved success");
  return approved.documentReconstruction;
}

function buildRejectedFixture(): DocumentReconstruction {
  const readyForReview = buildReadyForReviewFixture();
  const rejected = advanceDocumentReconstructionStatus({
    documentReconstruction: readyForReview,
    toStatus: DocumentReconstructionStatus.Rejected,
    actor,
    occurredAt,
  });
  assertSuccess(rejected, "expected rejected success");
  return rejected.documentReconstruction;
}

function buildWithSourceFixture(): DocumentReconstruction {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");
  const withSource = addReconstructionSource({
    documentReconstruction: created.documentReconstruction,
    source: sourceInputFixture(),
    actor,
    occurredAt,
  });
  assertSuccess(withSource, "expected add source success");
  return withSource.documentReconstruction;
}

function buildApprovedWithSourceFixture(): DocumentReconstruction {
  const withSource = buildWithSourceFixture();
  const reconstructing = advanceDocumentReconstructionStatus({
    documentReconstruction: withSource,
    toStatus: DocumentReconstructionStatus.Reconstructing,
    actor,
    occurredAt,
  });
  assertSuccess(reconstructing, "expected reconstructing success");
  const reconstructed = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructing.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Reconstructed,
    actor,
    occurredAt,
  });
  assertSuccess(reconstructed, "expected reconstructed success");
  const readyForReview = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructed.documentReconstruction,
    toStatus: DocumentReconstructionStatus.ReadyForReview,
    actor,
    occurredAt,
  });
  assertSuccess(readyForReview, "expected readyForReview success");
  const approved = advanceDocumentReconstructionStatus({
    documentReconstruction: readyForReview.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Approved,
    actor,
    occurredAt,
  });
  assertSuccess(approved, "expected approved success");
  return approved.documentReconstruction;
}

function buildRejectedWithSourceFixture(): DocumentReconstruction {
  const withSource = buildWithSourceFixture();
  const reconstructing = advanceDocumentReconstructionStatus({
    documentReconstruction: withSource,
    toStatus: DocumentReconstructionStatus.Reconstructing,
    actor,
    occurredAt,
  });
  assertSuccess(reconstructing, "expected reconstructing success");
  const reconstructed = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructing.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Reconstructed,
    actor,
    occurredAt,
  });
  assertSuccess(reconstructed, "expected reconstructed success");
  const readyForReview = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructed.documentReconstruction,
    toStatus: DocumentReconstructionStatus.ReadyForReview,
    actor,
    occurredAt,
  });
  assertSuccess(readyForReview, "expected readyForReview success");
  const rejected = advanceDocumentReconstructionStatus({
    documentReconstruction: readyForReview.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Rejected,
    actor,
    occurredAt,
  });
  assertSuccess(rejected, "expected rejected success");
  return rejected.documentReconstruction;
}

function buildWithSectionFixture(): DocumentReconstruction {
  const created = createDocumentReconstruction(createInputFixture());
  assertSuccess(created, "expected creation success");
  const withSection = addReconstructionSection({
    documentReconstruction: created.documentReconstruction,
    section: sectionInputFixture(),
    actor,
    occurredAt,
  });
  assertSuccess(withSection, "expected add section success");
  return withSection.documentReconstruction;
}

function buildSectionInStatusFixture(status: ReconstructionSectionStatus): DocumentReconstruction {
  const withSection = buildWithSectionFixture();

  if (status === ReconstructionSectionStatus.Draft) {
    return withSection;
  }

  const building = advanceReconstructionSectionStatus({
    documentReconstruction: withSection,
    id: "sec-01",
    toStatus: ReconstructionSectionStatus.Building,
    actor,
    occurredAt,
  });
  assertSuccess(building, "expected Draft -> Building success");
  if (status === ReconstructionSectionStatus.Building) {
    return building.documentReconstruction;
  }

  if (status === ReconstructionSectionStatus.Incomplete) {
    const incomplete = advanceReconstructionSectionStatus({
      documentReconstruction: building.documentReconstruction,
      id: "sec-01",
      toStatus: ReconstructionSectionStatus.Incomplete,
      actor,
      occurredAt,
    });
    assertSuccess(incomplete, "expected Building -> Incomplete success");
    return incomplete.documentReconstruction;
  }

  const completed = advanceReconstructionSectionStatus({
    documentReconstruction: building.documentReconstruction,
    id: "sec-01",
    toStatus: ReconstructionSectionStatus.Completed,
    actor,
    occurredAt,
  });
  assertSuccess(completed, "expected Building -> Completed success");
  if (status === ReconstructionSectionStatus.Completed) {
    return completed.documentReconstruction;
  }

  const archived = advanceReconstructionSectionStatus({
    documentReconstruction: completed.documentReconstruction,
    id: "sec-01",
    toStatus: ReconstructionSectionStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archived, "expected Completed -> Archived success");
  return archived.documentReconstruction;
}

function buildApprovedWithSectionFixture(): DocumentReconstruction {
  const withSection = buildWithSectionFixture();
  const reconstructing = advanceDocumentReconstructionStatus({
    documentReconstruction: withSection,
    toStatus: DocumentReconstructionStatus.Reconstructing,
    actor,
    occurredAt,
  });
  assertSuccess(reconstructing, "expected reconstructing success");
  const reconstructed = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructing.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Reconstructed,
    actor,
    occurredAt,
  });
  assertSuccess(reconstructed, "expected reconstructed success");
  const readyForReview = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructed.documentReconstruction,
    toStatus: DocumentReconstructionStatus.ReadyForReview,
    actor,
    occurredAt,
  });
  assertSuccess(readyForReview, "expected readyForReview success");
  const approved = advanceDocumentReconstructionStatus({
    documentReconstruction: readyForReview.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Approved,
    actor,
    occurredAt,
  });
  assertSuccess(approved, "expected approved success");
  return approved.documentReconstruction;
}

function buildWithFieldFixture(): DocumentReconstruction {
  const withSection = buildWithSectionFixture();
  const withField = addReconstructionField({
    documentReconstruction: withSection,
    field: fieldInputFixture(),
    actor,
    occurredAt,
  });
  assertSuccess(withField, "expected add field success");
  return withField.documentReconstruction;
}

function buildFieldInStatusFixture(status: ReconstructionFieldStatus): DocumentReconstruction {
  const withField = buildWithFieldFixture();

  if (status === ReconstructionFieldStatus.Draft) {
    return withField;
  }

  const building = advanceReconstructionFieldStatus({
    documentReconstruction: withField,
    id: "field-01",
    toStatus: ReconstructionFieldStatus.Building,
    actor,
    occurredAt,
  });
  assertSuccess(building, "expected Draft -> Building success");
  if (status === ReconstructionFieldStatus.Building) {
    return building.documentReconstruction;
  }

  if (status === ReconstructionFieldStatus.Incomplete) {
    const incomplete = advanceReconstructionFieldStatus({
      documentReconstruction: building.documentReconstruction,
      id: "field-01",
      toStatus: ReconstructionFieldStatus.Incomplete,
      actor,
      occurredAt,
    });
    assertSuccess(incomplete, "expected Building -> Incomplete success");
    return incomplete.documentReconstruction;
  }

  const completed = advanceReconstructionFieldStatus({
    documentReconstruction: building.documentReconstruction,
    id: "field-01",
    toStatus: ReconstructionFieldStatus.Completed,
    actor,
    occurredAt,
  });
  assertSuccess(completed, "expected Building -> Completed success");
  if (status === ReconstructionFieldStatus.Completed) {
    return completed.documentReconstruction;
  }

  const archived = advanceReconstructionFieldStatus({
    documentReconstruction: completed.documentReconstruction,
    id: "field-01",
    toStatus: ReconstructionFieldStatus.Archived,
    actor,
    occurredAt,
  });
  assertSuccess(archived, "expected Completed -> Archived success");
  return archived.documentReconstruction;
}

function buildApprovedWithFieldFixture(): DocumentReconstruction {
  const withField = buildWithFieldFixture();
  const reconstructing = advanceDocumentReconstructionStatus({
    documentReconstruction: withField,
    toStatus: DocumentReconstructionStatus.Reconstructing,
    actor,
    occurredAt,
  });
  assertSuccess(reconstructing, "expected reconstructing success");
  const reconstructed = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructing.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Reconstructed,
    actor,
    occurredAt,
  });
  assertSuccess(reconstructed, "expected reconstructed success");
  const readyForReview = advanceDocumentReconstructionStatus({
    documentReconstruction: reconstructed.documentReconstruction,
    toStatus: DocumentReconstructionStatus.ReadyForReview,
    actor,
    occurredAt,
  });
  assertSuccess(readyForReview, "expected readyForReview success");
  const approved = advanceDocumentReconstructionStatus({
    documentReconstruction: readyForReview.documentReconstruction,
    toStatus: DocumentReconstructionStatus.Approved,
    actor,
    occurredAt,
  });
  assertSuccess(approved, "expected approved success");
  return approved.documentReconstruction;
}

function fieldInputFixture(overrides: Partial<ReconstructionFieldInput> = {}): ReconstructionFieldInput {
  return {
    id: overrides.id ?? "field-01",
    sectionId: overrides.sectionId ?? "sec-01",
    key: overrides.key ?? "largura",
    label: overrides.label ?? "Largura",
    valueType: overrides.valueType ?? ReconstructionFieldValueType.Measurement,
    required: overrides.required ?? true,
    confidence: overrides.confidence ?? 0.8,
    metadata: overrides.metadata,
  };
}

function sectionInputFixture(overrides: Partial<ReconstructionSectionInput> = {}): ReconstructionSectionInput {
  return {
    id: overrides.id ?? "sec-01",
    title: overrides.title ?? "Identificacao",
    order: overrides.order ?? 1,
    description: overrides.description ?? "Secao de identificacao do boletim.",
    metadata: overrides.metadata,
  };
}

function sourceInputFixture(overrides: Partial<ReconstructionSourceInput> = {}): ReconstructionSourceInput {
  return {
    id: overrides.id ?? "src-01",
    sourceType: overrides.sourceType ?? ReconstructionSourceType.FieldEvidence,
    sourceId: overrides.sourceId ?? "EV-001",
    description: overrides.description ?? "Campo largura medido em campo.",
    confidence: overrides.confidence ?? 0.9,
    metadata: overrides.metadata,
  };
}

function createInputFixture(
  overrides: Partial<CreateDocumentReconstructionInput> = {},
): CreateDocumentReconstructionInput {
  return {
    id: overrides.id ?? documentId,
    title: overrides.title ?? "Boletim de Medicao - Bloco B",
    documentType: overrides.documentType ?? DocumentReconstructionDocumentType.MeasurementBulletin,
    description: overrides.description,
    actor: overrides.actor ?? actor,
    occurredAt: overrides.occurredAt ?? occurredAt,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? { source: "document-reconstruction" },
  };
}

function readDomainSourceFiles(): string {
  const domainDir = resolve(process.cwd(), "src", "domain", "document-reconstruction");
  return listTsFiles(domainDir)
    .filter((file) => !file.endsWith(".test.ts"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

function listTsFiles(dir: string): ReadonlyArray<string> {
  let entries: ReadonlyArray<string>;

  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const files: string[] = [];

  entries.forEach((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listTsFiles(fullPath));
      return;
    }

    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  });

  return files;
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

function assertSuccess(
  result: DocumentReconstructionResult,
  message: string,
): asserts result is Extract<DocumentReconstructionResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertFailure(
  result: DocumentReconstructionResult,
  message: string,
): asserts result is Extract<DocumentReconstructionResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
