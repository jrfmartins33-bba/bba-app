import {
  DocumentProcessingAttemptStatus,
  INITIAL_DOCUMENT_PROCESSING_ATTEMPT_REVISION,
  abandonDocumentProcessingAttemptService,
  completeDocumentProcessingAttemptService,
  failDocumentProcessingAttemptService,
  listDocumentProcessingAttemptsService,
  listDocumentVersionsService,
  registerDocumentService,
  registerOrReuseDocumentVersionService,
  requestDocumentProcessingAttemptService,
  startDocumentProcessingAttemptService,
  type DocumentArtifact,
  type DocumentProcessingApplicationContext,
  type DocumentProcessingAttempt,
  type DocumentProcessingAttemptRepository,
  type DocumentRepository,
  type DocumentVersion,
  type DocumentVersionRepository,
  type PersistedDocumentProcessingAttempt,
  type SaveDocumentProcessingAttemptResult,
} from "./index";

const ORG_A = "organization-alpha";
const ORG_B = "organization-beta";
const ACTOR_A = "engineer-alpha";
const SHA_A = "5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5";
const SHA_B = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

interface FakeDocumentRepository extends DocumentRepository {}
interface FakeDocumentVersionRepository extends DocumentVersionRepository {}
interface FakeAttemptRepository extends DocumentProcessingAttemptRepository {
  forceConflict(): void;
  revisionOf(organizationId: string, id: string): number | null;
}

function contextFor(organizationId: string): DocumentProcessingApplicationContext {
  return { organizationId, actor: ACTOR_A, correlationId: "corr-doc-1", sourceSystem: "document-processing-service-test" };
}

function createFakeDocumentRepository(): FakeDocumentRepository {
  const documents = new Map<string, DocumentArtifact>();

  return {
    async createDocument(organizationId, _actor, document) {
      documents.set(`${organizationId}:${document.id}`, document);
      return document;
    },
    async findDocumentById(organizationId, id) {
      return documents.get(`${organizationId}:${id}`) ?? null;
    },
  };
}

function createFakeDocumentVersionRepository(): FakeDocumentVersionRepository {
  const versions = new Map<string, DocumentVersion>();
  const versionsByHash = new Map<string, DocumentVersion>();

  return {
    async createDocumentVersion(organizationId, _actor, documentVersion) {
      versions.set(`${organizationId}:${documentVersion.id}`, documentVersion);
      versionsByHash.set(`${organizationId}:${documentVersion.documentId}:${documentVersion.sha256}`, documentVersion);
      return documentVersion;
    },
    async findDocumentVersionById(organizationId, id) {
      return versions.get(`${organizationId}:${id}`) ?? null;
    },
    async findDocumentVersionByDocumentAndSha256(organizationId, documentId, sha256) {
      return versionsByHash.get(`${organizationId}:${documentId}:${sha256}`) ?? null;
    },
    async listDocumentVersionsByDocument(organizationId, documentId) {
      return [...versions.values()].filter((version) => version.organizationId === organizationId && version.documentId === documentId);
    },
  };
}

function createFakeAttemptRepository(): FakeAttemptRepository {
  const attempts = new Map<string, PersistedDocumentProcessingAttempt>();
  const attemptsByKey = new Map<string, PersistedDocumentProcessingAttempt>();
  let conflict = false;

  return {
    forceConflict() {
      conflict = true;
    },
    revisionOf(organizationId, id) {
      return attempts.get(`${organizationId}:${id}`)?.revision ?? null;
    },
    async createDocumentProcessingAttempt(organizationId, _actor, attempt) {
      const persisted = { entity: attempt, revision: INITIAL_DOCUMENT_PROCESSING_ATTEMPT_REVISION };
      attempts.set(`${organizationId}:${attempt.id}`, persisted);
      attemptsByKey.set(`${organizationId}:${attempt.documentVersionId}:${attempt.requestIdempotencyKey}`, persisted);
      return persisted;
    },
    async findDocumentProcessingAttemptById(organizationId, id) {
      return attempts.get(`${organizationId}:${id}`) ?? null;
    },
    async findDocumentProcessingAttemptByRequestKey(organizationId, documentVersionId, requestIdempotencyKey) {
      return attemptsByKey.get(`${organizationId}:${documentVersionId}:${requestIdempotencyKey}`) ?? null;
    },
    async listDocumentProcessingAttemptsByVersion(organizationId, documentVersionId) {
      return [...attempts.values()].filter(
        (attempt) => attempt.entity.organizationId === organizationId && attempt.entity.documentVersionId === documentVersionId,
      );
    },
    async saveDocumentProcessingAttempt(organizationId, _actor, attempt, expectedRevision): Promise<SaveDocumentProcessingAttemptResult> {
      if (conflict) {
        conflict = false;
        return { outcome: "concurrency_conflict" };
      }

      const key = `${organizationId}:${attempt.id}`;
      const current = attempts.get(key);

      if (current === undefined || current.revision !== expectedRevision) {
        return { outcome: "concurrency_conflict" };
      }

      const persisted = { entity: attempt, revision: current.revision + 1 };
      attempts.set(key, persisted);
      attemptsByKey.set(`${organizationId}:${attempt.documentVersionId}:${attempt.requestIdempotencyKey}`, persisted);
      return { outcome: "saved", revision: persisted.revision };
    },
  };
}

async function seedDocumentAndVersion(
  organizationId = ORG_A,
): Promise<{
  documentRepository: FakeDocumentRepository;
  documentVersionRepository: FakeDocumentVersionRepository;
  document: DocumentArtifact;
  documentVersion: DocumentVersion;
}> {
  const documentRepository = createFakeDocumentRepository();
  const documentVersionRepository = createFakeDocumentVersionRepository();

  const createdDocument = await registerDocumentService(
    contextFor(organizationId),
    { context: "official-budget-source", title: "Anexo Tecnico" },
    documentRepository,
  );
  assertEqual(createdDocument.outcome, "created");
  if (createdDocument.outcome !== "created") throw new Error("seed failed");

  const createdVersion = await registerOrReuseDocumentVersionService(
    contextFor(organizationId),
    versionCommand(createdDocument.document.id, SHA_A),
    documentRepository,
    documentVersionRepository,
  );
  assertEqual(createdVersion.outcome, "created");
  if (createdVersion.outcome !== "created") throw new Error("seed failed");

  return {
    documentRepository,
    documentVersionRepository,
    document: createdDocument.document,
    documentVersion: createdVersion.documentVersion,
  };
}

async function main(): Promise<void> {
  await runTest("registers Document using organization from trusted context", async () => {
    const repository = createFakeDocumentRepository();
    const result = await registerDocumentService(contextFor(ORG_A), { context: "official-budget-source", title: "TR" }, repository);

    assertEqual(result.outcome, "created");
    if (result.outcome !== "created") return;
    assertEqual(result.document.organizationId, ORG_A);
    assertEqual("company_id" in result.document, false, "domain object must never expose company_id");
  });

  await runTest("registers first Document Version and reuses the same hash for the same Document", async () => {
    const documentRepository = createFakeDocumentRepository();
    const documentVersionRepository = createFakeDocumentVersionRepository();

    const createdDocument = await registerDocumentService(contextFor(ORG_A), { context: "official-budget-source" }, documentRepository);
    assertEqual(createdDocument.outcome, "created");
    if (createdDocument.outcome !== "created") return;

    const first = await registerOrReuseDocumentVersionService(
      contextFor(ORG_A),
      versionCommand(createdDocument.document.id, SHA_A),
      documentRepository,
      documentVersionRepository,
    );
    assertEqual(first.outcome, "created");
    if (first.outcome !== "created") return;

    const repeated = await registerOrReuseDocumentVersionService(
      contextFor(ORG_A),
      versionCommand(createdDocument.document.id, SHA_A),
      documentRepository,
      documentVersionRepository,
    );
    assertEqual(repeated.outcome, "reused");
    if (repeated.outcome !== "reused") return;
    assertEqual(repeated.documentVersion.id, first.documentVersion.id);
  });

  await runTest("new hash creates a new Document Version, while a different Document may reuse identical bytes independently", async () => {
    const documentRepository = createFakeDocumentRepository();
    const documentVersionRepository = createFakeDocumentVersionRepository();

    const docA = await registerDocumentService(contextFor(ORG_A), { context: "source-a" }, documentRepository);
    const docB = await registerDocumentService(contextFor(ORG_A), { context: "source-b" }, documentRepository);
    assertEqual(docA.outcome, "created");
    assertEqual(docB.outcome, "created");
    if (docA.outcome !== "created" || docB.outcome !== "created") return;

    const versionA1 = await registerOrReuseDocumentVersionService(contextFor(ORG_A), versionCommand(docA.document.id, SHA_A), documentRepository, documentVersionRepository);
    const versionA2 = await registerOrReuseDocumentVersionService(contextFor(ORG_A), versionCommand(docA.document.id, SHA_B), documentRepository, documentVersionRepository);
    const versionB1 = await registerOrReuseDocumentVersionService(contextFor(ORG_A), versionCommand(docB.document.id, SHA_A), documentRepository, documentVersionRepository);

    assertEqual(versionA1.outcome, "created");
    assertEqual(versionA2.outcome, "created");
    assertEqual(versionB1.outcome, "created");
    if (versionA1.outcome !== "created" || versionA2.outcome !== "created" || versionB1.outcome !== "created") return;
    assertEqual(versionA1.documentVersion.id === versionA2.documentVersion.id, false);
    assertEqual(versionA1.documentVersion.id === versionB1.documentVersion.id, false);
  });

  await runTest("queries remain isolated by organization", async () => {
    const { documentRepository, documentVersionRepository, document, documentVersion } = await seedDocumentAndVersion(ORG_A);

    const versionsFromB = await listDocumentVersionsService(contextFor(ORG_B), { documentId: document.id }, documentRepository, documentVersionRepository);
    assertEqual(versionsFromB.outcome, "document_not_found");

    const versionFromB = await registerOrReuseDocumentVersionService(
      contextFor(ORG_B),
      versionCommand(document.id, SHA_A),
      documentRepository,
      documentVersionRepository,
    );
    assertEqual(versionFromB.outcome, "document_not_found");

    const attemptRepository = createFakeAttemptRepository();
    const attemptedFromB = await requestDocumentProcessingAttemptService(
      contextFor(ORG_B),
      { documentVersionId: documentVersion.id, mechanism: "minimal-v1", requestIdempotencyKey: "key-b" },
      documentVersionRepository,
      attemptRepository,
    );
    assertEqual(attemptedFromB.outcome, "document_version_not_found");
  });

  await runTest("same request key reuses an attempt; a new key creates explicit reprocessing without a new Document Version", async () => {
    const { documentVersionRepository, documentVersion } = await seedDocumentAndVersion();
    const attemptRepository = createFakeAttemptRepository();

    const first = await requestDocumentProcessingAttemptService(
      contextFor(ORG_A),
      { documentVersionId: documentVersion.id, mechanism: "minimal-v1", requestIdempotencyKey: "request-1" },
      documentVersionRepository,
      attemptRepository,
    );
    assertEqual(first.outcome, "created");
    if (first.outcome !== "created") return;

    const repeated = await requestDocumentProcessingAttemptService(
      contextFor(ORG_A),
      { documentVersionId: documentVersion.id, mechanism: "minimal-v1", requestIdempotencyKey: "request-1" },
      documentVersionRepository,
      attemptRepository,
    );
    assertEqual(repeated.outcome, "reused");
    if (repeated.outcome !== "reused") return;
    assertEqual(repeated.attempt.id, first.attempt.id);

    const reprocess = await requestDocumentProcessingAttemptService(
      contextFor(ORG_A),
      { documentVersionId: documentVersion.id, mechanism: "minimal-v1", requestIdempotencyKey: "request-2" },
      documentVersionRepository,
      attemptRepository,
    );
    assertEqual(reprocess.outcome, "created");
    if (reprocess.outcome !== "created") return;
    assertEqual(reprocess.attempt.id === first.attempt.id, false);
    assertEqual(reprocess.attempt.documentVersionId, first.attempt.documentVersionId);
  });

  await runTest("transitions validate state and preserve previous attempts", async () => {
    const { documentVersionRepository, documentVersion } = await seedDocumentAndVersion();
    const attemptRepository = createFakeAttemptRepository();

    const requested = await requestDocumentProcessingAttemptService(
      contextFor(ORG_A),
      { documentVersionId: documentVersion.id, mechanism: "minimal-v1", requestIdempotencyKey: "request-1" },
      documentVersionRepository,
      attemptRepository,
    );
    assertEqual(requested.outcome, "created");
    if (requested.outcome !== "created") return;

    const started = await startDocumentProcessingAttemptService(contextFor(ORG_A), { attemptId: requested.attempt.id }, attemptRepository);
    assertEqual(started.outcome, "success");
    if (started.outcome !== "success") return;
    assertEqual(started.attempt.status, DocumentProcessingAttemptStatus.Processing);

    const completed = await completeDocumentProcessingAttemptService(contextFor(ORG_A), { attemptId: requested.attempt.id }, attemptRepository);
    assertEqual(completed.outcome, "success");
    if (completed.outcome !== "success") return;
    assertEqual(completed.attempt.status, DocumentProcessingAttemptStatus.Completed);

    const invalidRestart = await startDocumentProcessingAttemptService(contextFor(ORG_A), { attemptId: requested.attempt.id }, attemptRepository);
    assertEqual(invalidRestart.outcome, "domain_error");

    const second = await requestDocumentProcessingAttemptService(
      contextFor(ORG_A),
      { documentVersionId: documentVersion.id, mechanism: "minimal-v1", requestIdempotencyKey: "request-2" },
      documentVersionRepository,
      attemptRepository,
    );
    assertEqual(second.outcome, "created");

    const listed = await listDocumentProcessingAttemptsService(
      contextFor(ORG_A),
      { documentVersionId: documentVersion.id },
      documentVersionRepository,
      attemptRepository,
    );
    assertEqual(listed.outcome, "success");
    if (listed.outcome !== "success") return;
    assertEqual(listed.attempts.length, 2);
  });

  await runTest("records failure and abandonment explicitly", async () => {
    const { documentVersionRepository, documentVersion } = await seedDocumentAndVersion();
    const attemptRepository = createFakeAttemptRepository();

    const failedAttempt = await requestDocumentProcessingAttemptService(
      contextFor(ORG_A),
      { documentVersionId: documentVersion.id, mechanism: "minimal-v1", requestIdempotencyKey: "fail-1" },
      documentVersionRepository,
      attemptRepository,
    );
    assertEqual(failedAttempt.outcome, "created");
    if (failedAttempt.outcome !== "created") return;

    const started = await startDocumentProcessingAttemptService(contextFor(ORG_A), { attemptId: failedAttempt.attempt.id }, attemptRepository);
    assertEqual(started.outcome, "success");

    const failed = await failDocumentProcessingAttemptService(
      contextFor(ORG_A),
      { attemptId: failedAttempt.attempt.id, error: { code: "read_failed", message: "Read failed." } },
      attemptRepository,
    );
    assertEqual(failed.outcome, "success");
    if (failed.outcome !== "success") return;
    assertEqual(failed.attempt.status, DocumentProcessingAttemptStatus.Failed);

    const abandonedAttempt = await requestDocumentProcessingAttemptService(
      contextFor(ORG_A),
      { documentVersionId: documentVersion.id, mechanism: "minimal-v1", requestIdempotencyKey: "abandon-1" },
      documentVersionRepository,
      attemptRepository,
    );
    assertEqual(abandonedAttempt.outcome, "created");
    if (abandonedAttempt.outcome !== "created") return;

    const abandoned = await abandonDocumentProcessingAttemptService(contextFor(ORG_A), { attemptId: abandonedAttempt.attempt.id }, attemptRepository);
    assertEqual(abandoned.outcome, "success");
    if (abandoned.outcome !== "success") return;
    assertEqual(abandoned.attempt.status, DocumentProcessingAttemptStatus.Abandoned);
  });

  await runTest("optimistic concurrency conflict is explicit and never overwrites the latest attempt", async () => {
    const { documentVersionRepository, documentVersion } = await seedDocumentAndVersion();
    const attemptRepository = createFakeAttemptRepository();

    const requested = await requestDocumentProcessingAttemptService(
      contextFor(ORG_A),
      { documentVersionId: documentVersion.id, mechanism: "minimal-v1", requestIdempotencyKey: "request-1" },
      documentVersionRepository,
      attemptRepository,
    );
    assertEqual(requested.outcome, "created");
    if (requested.outcome !== "created") return;

    attemptRepository.forceConflict();
    const started = await startDocumentProcessingAttemptService(contextFor(ORG_A), { attemptId: requested.attempt.id }, attemptRepository);
    assertEqual(started.outcome, "concurrency_conflict");
    assertEqual(attemptRepository.revisionOf(ORG_A, requested.attempt.id), INITIAL_DOCUMENT_PROCESSING_ATTEMPT_REVISION);
  });
}

function versionCommand(documentId: string, sha256: string): Parameters<typeof registerOrReuseDocumentVersionService>[1] {
  return {
    documentId,
    sha256,
    originalFileName: "05_Anexo_Tecnico_Termo_Referencia.pdf",
    mimeType: "application/pdf",
    sizeBytes: 154_280_000,
    storageReference: `${ORG_A}/epic-21/document-version/${sha256}/05_Anexo_Tecnico_Termo_Referencia.pdf`,
    technicalMetadata: { declaredPages: 1033, declaredHybridPdf: true },
  };
}

async function runTest(name: string, testCase: () => Promise<void>): Promise<void> {
  await testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
