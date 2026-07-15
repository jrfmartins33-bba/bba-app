import {
  DocumentProcessingAttemptStatus,
  INITIAL_DOCUMENT_PROCESSING_ATTEMPT_REVISION,
} from "@bba/bdos-core/services/document-processing";
import {
  DocumentProcessingReconstructionError,
  documentArtifactCreateRpcParams,
  documentProcessingAttemptCreateRpcParams,
  documentProcessingAttemptTransitionRpcParams,
  documentVersionCreateRpcParams,
  mapDocumentArtifactRow,
  mapDocumentProcessingAttemptRow,
  mapDocumentVersionRow,
  type DocumentArtifactRow,
  type DocumentProcessingAttemptRow,
  type DocumentVersionRow,
} from "./document-processing-mappers";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const ACTOR_ID = "22222222-2222-2222-2222-222222222222";
const DOCUMENT_ID = "33333333-3333-3333-3333-333333333333";
const VERSION_ID = "44444444-4444-4444-4444-444444444444";
const ATTEMPT_ID = "55555555-5555-5555-5555-555555555555";
const SHA = "5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5";
const NOW = "2026-07-15T10:00:00.000Z";

runTest("maps Document row and RPC params without exposing company_id to the domain object", () => {
  const row: DocumentArtifactRow = {
    id: DOCUMENT_ID,
    company_id: COMPANY_ID,
    document_context: "official-budget-source",
    title: "Anexo Tecnico",
    registered_by: ACTOR_ID,
    registered_at: NOW,
    metadata: { correlationId: "corr-1", sourceSystem: "test" },
  };

  const document = mapDocumentArtifactRow(row);
  assertEqual(document.organizationId, COMPANY_ID);
  assertEqual(document.context, "official-budget-source");
  assertEqual("company_id" in document, false);

  const params = documentArtifactCreateRpcParams(COMPANY_ID, ACTOR_ID, document);
  assertEqual(params.p_company_id, COMPANY_ID);
  assertEqual(params.p_actor_id, ACTOR_ID);
  assertEqual(params.p_registered_at, NOW);
  assertEqual(params.p_correlation_id, "corr-1");
});

runTest("maps Document Version row with bigint size and serializes storage reference", () => {
  const row = versionRow();
  const version = mapDocumentVersionRow(row);

  assertEqual(version.id, VERSION_ID);
  assertEqual(version.documentId, DOCUMENT_ID);
  assertEqual(version.sizeBytes, 154_280_000);
  assertEqual(version.storageReference, `${COMPANY_ID}/epic-21/${VERSION_ID}/05_Anexo_Tecnico_Termo_Referencia.pdf`);

  const params = documentVersionCreateRpcParams(COMPANY_ID, ACTOR_ID, version);
  assertEqual(params.p_sha256, SHA);
  assertEqual(params.p_storage_reference, version.storageReference);
  assertEqual(params.p_size_bytes, 154_280_000);
});

runTest("maps requested attempt and transition params with optimistic revision", () => {
  const row = attemptRow({ status: "Requested", revision: 0 });
  const persisted = mapDocumentProcessingAttemptRow(row);

  assertEqual(persisted.revision, INITIAL_DOCUMENT_PROCESSING_ATTEMPT_REVISION);
  assertEqual(persisted.entity.status, DocumentProcessingAttemptStatus.Requested);
  assertEqual(persisted.entity.requestIdempotencyKey, "request-key-1");

  const createParams = documentProcessingAttemptCreateRpcParams(COMPANY_ID, ACTOR_ID, persisted.entity);
  assertEqual(createParams.p_request_idempotency_key, "request-key-1");
  assertEqual(createParams.p_status, "Requested");

  const transitionParams = documentProcessingAttemptTransitionRpcParams(COMPANY_ID, ACTOR_ID, persisted.entity, 3);
  assertEqual(transitionParams.p_expected_revision, 3);
  assertEqual(transitionParams.p_attempt_id, ATTEMPT_ID);
});

runTest("maps failed attempt with structured error", () => {
  const persisted = mapDocumentProcessingAttemptRow(
    attemptRow({
      status: "Failed",
      error: { code: "read_failed", message: "Read failed.", metadata: { safe: true } },
      finished_at: "2026-07-15T10:10:00.000Z",
      revision: 2,
    }),
  );

  assertEqual(persisted.entity.status, DocumentProcessingAttemptStatus.Failed);
  assertEqual(persisted.entity.error?.code, "read_failed");
  assertEqual(persisted.revision, 2);
});

runTest("rejects malformed rows explicitly", () => {
  assertThrows(() => mapDocumentVersionRow(versionRow({ size_bytes: "-1" })), DocumentProcessingReconstructionError);
  assertThrows(() => mapDocumentProcessingAttemptRow(attemptRow({ status: "DecorativeStatus" })), DocumentProcessingReconstructionError);
  assertThrows(() => mapDocumentProcessingAttemptRow(attemptRow({ error: { code: "", message: "x" } })), DocumentProcessingReconstructionError);
});

function versionRow(overrides: Partial<DocumentVersionRow> = {}): DocumentVersionRow {
  return {
    id: VERSION_ID,
    company_id: COMPANY_ID,
    document_id: DOCUMENT_ID,
    sha256: SHA,
    original_file_name: "05_Anexo_Tecnico_Termo_Referencia.pdf",
    mime_type: "application/pdf",
    size_bytes: "154280000",
    storage_reference: `${COMPANY_ID}/epic-21/${VERSION_ID}/05_Anexo_Tecnico_Termo_Referencia.pdf`,
    uploaded_by: ACTOR_ID,
    uploaded_at: NOW,
    technical_metadata: { declaredPages: 1033 },
    metadata: { correlationId: "corr-version" },
    ...overrides,
  };
}

function attemptRow(overrides: Partial<DocumentProcessingAttemptRow> = {}): DocumentProcessingAttemptRow {
  return {
    id: ATTEMPT_ID,
    company_id: COMPANY_ID,
    document_version_id: VERSION_ID,
    status: "Requested",
    mechanism: "minimal-v1",
    mechanism_version: "1.0.0",
    requested_at: NOW,
    started_at: null,
    finished_at: null,
    error: null,
    partial_processing: false,
    request_idempotency_key: "request-key-1",
    requested_by: ACTOR_ID,
    revision: 0,
    metadata: { correlationId: "corr-attempt" },
    ...overrides,
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

function assertThrows(fn: () => void, expectedType: new (...args: never[]) => Error): void {
  try {
    fn();
  } catch (error) {
    if (error instanceof expectedType) {
      return;
    }
    throw new Error(`wrong error type: ${(error as Error).constructor.name}`);
  }
  throw new Error("expected function to throw");
}
