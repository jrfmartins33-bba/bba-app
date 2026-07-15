import {
  DocumentProcessingAttemptStatus,
  abandonDocumentProcessingAttempt,
  completeDocumentProcessingAttempt,
  createDocumentArtifact,
  createDocumentProcessingAttempt,
  createDocumentVersion,
  failDocumentProcessingAttempt,
  isCanonicalSha256,
  partiallyCompleteDocumentProcessingAttempt,
  startDocumentProcessingAttempt,
  type DocumentArtifact,
  type DocumentProcessingAttempt,
  type DocumentProcessingAttemptResult,
  type DocumentVersion,
} from "./index";

const ORG_A = "organization-alpha";
const ACTOR = "cost-engineer";
const NOW = "2026-07-15T10:00:00.000Z";
const SHA_A = "5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5";
const SHA_B = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

runTest("creates a valid Document artifact without file or processing state", () => {
  const result = createDocumentArtifact(documentInput());
  assertSuccessDocument(result);

  assertEqual(result.document.id, "doc-1");
  assertEqual(result.document.organizationId, ORG_A);
  assertEqual(result.document.context, "official-budget-source");
  assertEqual(result.document.title, "Anexo Tecnico - Termo de Referencia");
  assertEqual("sha256" in result.document, false, "Document must not carry file hash");
  assertEqual("storageReference" in result.document, false, "Document must not carry storage reference");
  assertEqual("status" in result.document, false, "Document must not carry processing status");
});

runTest("rejects invalid Document creation", () => {
  const result = createDocumentArtifact(documentInput({ id: "", organizationId: "", context: "", registeredBy: "" }));
  assertEqual(result.success, false);
  if (result.success) return;
  assertEqual(result.errors.some((error) => error.code === "missing_id"), true);
  assertEqual(result.errors.some((error) => error.code === "missing_organization_id"), true);
  assertEqual(result.errors.some((error) => error.code === "missing_context"), true);
  assertEqual(result.errors.some((error) => error.code === "missing_actor"), true);
});

runTest("creates a valid immutable Document Version with canonical SHA-256", () => {
  const document = buildDocument();
  const result = createDocumentVersion(versionInput(document));
  assertSuccessVersion(result);

  assertEqual(result.documentVersion.documentId, document.id);
  assertEqual(result.documentVersion.organizationId, document.organizationId);
  assertEqual(result.documentVersion.sha256, SHA_A);
  assertEqual(Object.isFrozen(result.documentVersion), true, "Document Version must be immutable after creation");
  assertEqual(Object.isFrozen(result.documentVersion.technicalMetadata), true, "technical metadata must be frozen");
  assertEqual("status" in result.documentVersion, false, "Document Version must not carry operational status");
});

runTest("rejects invalid SHA-256 and unsafe local storage references", () => {
  assertEqual(isCanonicalSha256(SHA_A), true);
  assertEqual(isCanonicalSha256(SHA_A.toUpperCase()), false, "canonical SHA-256 must be lowercase");
  assertEqual(isCanonicalSha256("abc"), false);

  const document = buildDocument();
  const result = createDocumentVersion(
    versionInput(document, {
      sha256: SHA_A.toUpperCase(),
      storageReference: "C:\\Users\\jrfma\\documento.pdf",
    }),
  );

  assertEqual(result.success, false);
  if (result.success) return;
  assertEqual(result.errors.some((error) => error.code === "invalid_sha256"), true);
  assertEqual(result.errors.some((error) => error.code === "unsafe_storage_reference"), true);
});

runTest("creates a requested processing attempt", () => {
  const version = buildVersion();
  const result = createDocumentProcessingAttempt(attemptInput(version));
  assertSuccessAttempt(result);

  assertEqual(result.attempt.documentVersionId, version.id);
  assertEqual(result.attempt.organizationId, ORG_A);
  assertEqual(result.attempt.status, DocumentProcessingAttemptStatus.Requested);
  assertEqual(result.attempt.startedAt, null);
  assertEqual(result.attempt.finishedAt, null);
  assertEqual(result.attempt.error, null);
  assertEqual(result.attempt.partialProcessing, false);
});

runTest("supports valid transitions: Requested -> Processing -> Completed", () => {
  const requested = buildAttempt();
  const processing = startDocumentProcessingAttempt({ attempt: requested, occurredAt: "2026-07-15T10:01:00.000Z" });
  assertSuccessAttempt(processing);
  assertEqual(processing.attempt.status, DocumentProcessingAttemptStatus.Processing);
  assertEqual(processing.attempt.startedAt, "2026-07-15T10:01:00.000Z");

  const completed = completeDocumentProcessingAttempt({ attempt: processing.attempt, occurredAt: "2026-07-15T10:02:00.000Z" });
  assertSuccessAttempt(completed);
  assertEqual(completed.attempt.status, DocumentProcessingAttemptStatus.Completed);
  assertEqual(completed.attempt.finishedAt, "2026-07-15T10:02:00.000Z");
});

runTest("supports partial completion", () => {
  const processing = buildProcessingAttempt();
  const result = partiallyCompleteDocumentProcessingAttempt({
    attempt: processing,
    occurredAt: "2026-07-15T10:03:00.000Z",
    error: { code: "some_pages_unreadable", message: "Some pages could not be read." },
  });

  assertSuccessAttempt(result);
  assertEqual(result.attempt.status, DocumentProcessingAttemptStatus.PartiallyCompleted);
  assertEqual(result.attempt.partialProcessing, true);
  assertEqual(result.attempt.error?.code, "some_pages_unreadable");
});

runTest("supports failure with a structured error", () => {
  const processing = buildProcessingAttempt();
  const result = failDocumentProcessingAttempt({
    attempt: processing,
    occurredAt: "2026-07-15T10:04:00.000Z",
    error: { code: "storage_unavailable", message: "The storage object was not available." },
  });

  assertSuccessAttempt(result);
  assertEqual(result.attempt.status, DocumentProcessingAttemptStatus.Failed);
  assertEqual(result.attempt.error?.code, "storage_unavailable");
});

runTest("rejects failure without structured error", () => {
  const processing = buildProcessingAttempt();
  const result = failDocumentProcessingAttempt({ attempt: processing, occurredAt: "2026-07-15T10:04:00.000Z" });

  assertEqual(result.success, false);
  if (result.success) return;
  assertEqual(result.errors[0]?.code, "missing_error");
});

runTest("supports abandonment from requested and processing", () => {
  const requested = buildAttempt();
  const abandonedFromRequested = abandonDocumentProcessingAttempt({
    attempt: requested,
    occurredAt: "2026-07-15T10:05:00.000Z",
  });
  assertSuccessAttempt(abandonedFromRequested);
  assertEqual(abandonedFromRequested.attempt.status, DocumentProcessingAttemptStatus.Abandoned);

  const processing = buildProcessingAttempt("attempt-processing-abandon");
  const abandonedFromProcessing = abandonDocumentProcessingAttempt({
    attempt: processing,
    occurredAt: "2026-07-15T10:06:00.000Z",
  });
  assertSuccessAttempt(abandonedFromProcessing);
  assertEqual(abandonedFromProcessing.attempt.status, DocumentProcessingAttemptStatus.Abandoned);
});

runTest("rejects invalid transitions and any transition from terminal states", () => {
  const requested = buildAttempt();
  const invalidComplete = completeDocumentProcessingAttempt({
    attempt: requested,
    occurredAt: "2026-07-15T10:07:00.000Z",
  });
  assertEqual(invalidComplete.success, false);
  if (invalidComplete.success) return;
  assertEqual(invalidComplete.errors[0]?.code, "invalid_attempt_transition");

  const processing = buildProcessingAttempt("attempt-terminal");
  const completed = completeDocumentProcessingAttempt({
    attempt: processing,
    occurredAt: "2026-07-15T10:08:00.000Z",
  });
  assertSuccessAttempt(completed);

  const backToProcessing = startDocumentProcessingAttempt({
    attempt: completed.attempt,
    occurredAt: "2026-07-15T10:09:00.000Z",
  });
  assertEqual(backToProcessing.success, false);
  if (backToProcessing.success) return;
  assertEqual(backToProcessing.errors[0]?.code, "terminal_attempt");
});

function buildDocument(): DocumentArtifact {
  const result = createDocumentArtifact(documentInput());
  assertSuccessDocument(result);
  return result.document;
}

function buildVersion(): DocumentVersion {
  const result = createDocumentVersion(versionInput(buildDocument()));
  assertSuccessVersion(result);
  return result.documentVersion;
}

function buildAttempt(id = "attempt-1"): DocumentProcessingAttempt {
  const result = createDocumentProcessingAttempt(attemptInput(buildVersion(), { id }));
  assertSuccessAttempt(result);
  return result.attempt;
}

function buildProcessingAttempt(id = "attempt-processing"): DocumentProcessingAttempt {
  const started = startDocumentProcessingAttempt({
    attempt: buildAttempt(id),
    occurredAt: "2026-07-15T10:01:00.000Z",
  });
  assertSuccessAttempt(started);
  return started.attempt;
}

function documentInput(overrides: Partial<Parameters<typeof createDocumentArtifact>[0]> = {}): Parameters<typeof createDocumentArtifact>[0] {
  return {
    id: overrides.id ?? "doc-1",
    organizationId: overrides.organizationId ?? ORG_A,
    context: overrides.context ?? "official-budget-source",
    title: overrides.title ?? "Anexo Tecnico - Termo de Referencia",
    registeredBy: overrides.registeredBy ?? ACTOR,
    registeredAt: overrides.registeredAt ?? NOW,
    metadata: overrides.metadata ?? { fixture: "lagoa-do-arroz" },
  };
}

function versionInput(document: DocumentArtifact, overrides: Partial<Parameters<typeof createDocumentVersion>[0]> = {}): Parameters<typeof createDocumentVersion>[0] {
  return {
    id: overrides.id ?? "version-1",
    document: overrides.document ?? document,
    sha256: overrides.sha256 ?? SHA_A,
    originalFileName: overrides.originalFileName ?? "05_Anexo_Tecnico_Termo_Referencia.pdf",
    mimeType: overrides.mimeType ?? "application/pdf",
    sizeBytes: overrides.sizeBytes ?? 154_280_000,
    storageReference: overrides.storageReference ?? `${ORG_A}/epic-21/version-1/05_Anexo_Tecnico_Termo_Referencia.pdf`,
    uploadedBy: overrides.uploadedBy ?? ACTOR,
    uploadedAt: overrides.uploadedAt ?? NOW,
    technicalMetadata: overrides.technicalMetadata ?? { declaredPages: 1033, declaredHybridPdf: true },
    metadata: overrides.metadata ?? { source: "synthetic-test" },
  };
}

function attemptInput(
  documentVersion: DocumentVersion,
  overrides: Partial<Parameters<typeof createDocumentProcessingAttempt>[0]> = {},
): Parameters<typeof createDocumentProcessingAttempt>[0] {
  return {
    id: overrides.id ?? "attempt-1",
    documentVersion: overrides.documentVersion ?? documentVersion,
    mechanism: overrides.mechanism ?? "document-processing-minimal-v1",
    mechanismVersion: overrides.mechanismVersion ?? "1.0.0",
    requestedAt: overrides.requestedAt ?? NOW,
    requestedBy: overrides.requestedBy ?? ACTOR,
    requestIdempotencyKey: overrides.requestIdempotencyKey ?? "request-key-1",
    metadata: overrides.metadata ?? { source: "synthetic-test" },
  };
}

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertSuccessDocument(result: ReturnType<typeof createDocumentArtifact>): asserts result is Extract<ReturnType<typeof createDocumentArtifact>, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`expected document success: ${JSON.stringify(result.errors)}`);
  }
}

function assertSuccessVersion(result: ReturnType<typeof createDocumentVersion>): asserts result is Extract<ReturnType<typeof createDocumentVersion>, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`expected version success: ${JSON.stringify(result.errors)}`);
  }
}

function assertSuccessAttempt(result: DocumentProcessingAttemptResult): asserts result is Extract<DocumentProcessingAttemptResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`expected attempt success: ${JSON.stringify(result.errors)}`);
  }
}

void SHA_B;
