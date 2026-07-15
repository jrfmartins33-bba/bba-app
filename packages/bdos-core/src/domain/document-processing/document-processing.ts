import type {
  CreateDocumentArtifactFailure,
  CreateDocumentArtifactInput,
  CreateDocumentArtifactResult,
  CreateDocumentArtifactSuccess,
  CreateDocumentVersionFailure,
  CreateDocumentVersionInput,
  CreateDocumentVersionResult,
  CreateDocumentVersionSuccess,
  CreateDocumentProcessingAttemptInput,
  DocumentArtifact,
  DocumentProcessingAttempt,
  DocumentProcessingAttemptErrorDetail,
  DocumentProcessingAttemptFailure,
  DocumentProcessingAttemptResult,
  DocumentProcessingAttemptSuccess,
  DocumentProcessingError,
  DocumentProcessingErrorCode,
  DocumentProcessingMetadata,
  TransitionDocumentProcessingAttemptInput,
} from "./document-processing.types";
import { DocumentProcessingAttemptStatus } from "./document-processing.types";

const SHA_256_PATTERN = /^[0-9a-f]{64}$/;
const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:[\\/]/;

export function createDocumentArtifact(input: CreateDocumentArtifactInput): CreateDocumentArtifactResult {
  const metadata = createDocumentMetadata(input);
  const errors: DocumentProcessingError[] = [];

  if (isBlank(input.id)) {
    errors.push(createError("missing_id", "id", "Document identity is required.", metadata));
  }

  if (isBlank(input.organizationId)) {
    errors.push(createError("missing_organization_id", "organizationId", "Organization id is required.", metadata));
  }

  if (isBlank(input.context)) {
    errors.push(createError("missing_context", "context", "Document context is required.", metadata));
  }

  if (isBlank(input.registeredBy)) {
    errors.push(createError("missing_actor", "registeredBy", "Registering actor is required.", metadata));
  }

  if (isBlank(input.registeredAt)) {
    errors.push(createError("missing_timestamp", "registeredAt", "Registration timestamp is required.", metadata));
  }

  if (errors.length > 0) {
    return freezeDomainObject<CreateDocumentArtifactFailure>({ success: false, document: null, errors, warnings: [], metadata });
  }

  return freezeDomainObject<CreateDocumentArtifactSuccess>({
    success: true,
    document: {
      id: input.id,
      organizationId: input.organizationId,
      context: input.context,
      title: normalizeNullableString(input.title),
      registeredBy: input.registeredBy,
      registeredAt: input.registeredAt,
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function createDocumentVersion(input: CreateDocumentVersionInput): CreateDocumentVersionResult {
  const metadata = createVersionMetadata(input);
  const errors: DocumentProcessingError[] = [];

  if (isBlank(input.id)) {
    errors.push(createError("missing_id", "id", "Document version identity is required.", metadata));
  }

  if (input.document === undefined || input.document === null) {
    errors.push(createError("missing_document", "document", "Document is required.", metadata));
  }

  if (isBlank(input.sha256)) {
    errors.push(createError("missing_sha256", "sha256", "SHA-256 is required.", metadata));
  } else if (!isCanonicalSha256(input.sha256)) {
    errors.push(createError("invalid_sha256", "sha256", "SHA-256 must be 64 lowercase hexadecimal characters.", metadata));
  }

  if (isBlank(input.originalFileName)) {
    errors.push(createError("missing_original_file_name", "originalFileName", "Original file name is required.", metadata));
  }

  if (isBlank(input.mimeType)) {
    errors.push(createError("missing_mime_type", "mimeType", "MIME type is required.", metadata));
  }

  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    errors.push(createError("invalid_size_bytes", "sizeBytes", "File size must be a positive safe integer.", metadata));
  }

  if (isBlank(input.storageReference)) {
    errors.push(createError("missing_storage_reference", "storageReference", "Storage reference is required.", metadata));
  } else if (!isSafeStorageReference(input.storageReference)) {
    errors.push(
      createError(
        "unsafe_storage_reference",
        "storageReference",
        "Storage reference must be an opaque platform reference, not a local path.",
        metadata,
      ),
    );
  }

  if (isBlank(input.uploadedBy)) {
    errors.push(createError("missing_actor", "uploadedBy", "Uploading actor is required.", metadata));
  }

  if (isBlank(input.uploadedAt)) {
    errors.push(createError("missing_timestamp", "uploadedAt", "Upload timestamp is required.", metadata));
  }

  if (errors.length > 0) {
    return freezeDomainObject<CreateDocumentVersionFailure>({
      success: false,
      documentVersion: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<CreateDocumentVersionSuccess>({
    success: true,
    documentVersion: {
      id: input.id,
      organizationId: input.document.organizationId,
      documentId: input.document.id,
      sha256: input.sha256,
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageReference: input.storageReference,
      uploadedBy: input.uploadedBy,
      uploadedAt: input.uploadedAt,
      technicalMetadata: input.technicalMetadata ?? {},
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function createDocumentProcessingAttempt(input: CreateDocumentProcessingAttemptInput): DocumentProcessingAttemptResult {
  const metadata = createAttemptMetadata(input);
  const errors: DocumentProcessingError[] = [];

  if (isBlank(input.id)) {
    errors.push(createError("missing_id", "id", "Processing attempt identity is required.", metadata));
  }

  if (input.documentVersion === undefined || input.documentVersion === null) {
    errors.push(createError("missing_document_version", "documentVersion", "Document version is required.", metadata));
  }

  if (isBlank(input.mechanism)) {
    errors.push(createError("missing_mechanism", "mechanism", "Processing mechanism is required.", metadata));
  }

  if (isBlank(input.requestedAt)) {
    errors.push(createError("missing_timestamp", "requestedAt", "Request timestamp is required.", metadata));
  }

  if (isBlank(input.requestedBy)) {
    errors.push(createError("missing_actor", "requestedBy", "Requesting actor is required.", metadata));
  }

  if (isBlank(input.requestIdempotencyKey)) {
    errors.push(
      createError("missing_request_idempotency_key", "requestIdempotencyKey", "Request idempotency key is required.", metadata),
    );
  }

  if (errors.length > 0) {
    return failureAttempt(errors, metadata);
  }

  return freezeDomainObject<DocumentProcessingAttemptSuccess>({
    success: true,
    attempt: {
      id: input.id,
      organizationId: input.documentVersion.organizationId,
      documentVersionId: input.documentVersion.id,
      status: DocumentProcessingAttemptStatus.Requested,
      mechanism: input.mechanism,
      mechanismVersion: normalizeNullableString(input.mechanismVersion),
      requestedAt: input.requestedAt,
      startedAt: null,
      finishedAt: null,
      error: null,
      partialProcessing: false,
      requestIdempotencyKey: input.requestIdempotencyKey,
      requestedBy: input.requestedBy,
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function startDocumentProcessingAttempt(input: TransitionDocumentProcessingAttemptInput): DocumentProcessingAttemptResult {
  const metadata = createTransitionMetadata(input);
  const transitionError = validateTransition(
    input.attempt,
    DocumentProcessingAttemptStatus.Processing,
    metadata,
    [DocumentProcessingAttemptStatus.Requested],
  );

  if (transitionError !== null) {
    return failureAttempt([transitionError], metadata);
  }

  if (isBlank(input.occurredAt)) {
    return failureAttempt([createError("missing_timestamp", "occurredAt", "Transition timestamp is required.", metadata)], metadata);
  }

  return successAttempt({
    ...input.attempt,
    status: DocumentProcessingAttemptStatus.Processing,
    startedAt: input.occurredAt,
    metadata: { ...input.attempt.metadata, ...(input.metadata ?? {}) },
  }, metadata);
}

export function completeDocumentProcessingAttempt(input: TransitionDocumentProcessingAttemptInput): DocumentProcessingAttemptResult {
  return finishAttempt(input, DocumentProcessingAttemptStatus.Completed, false, null, [DocumentProcessingAttemptStatus.Processing]);
}

export function partiallyCompleteDocumentProcessingAttempt(input: TransitionDocumentProcessingAttemptInput): DocumentProcessingAttemptResult {
  return finishAttempt(input, DocumentProcessingAttemptStatus.PartiallyCompleted, true, input.error ?? null, [
    DocumentProcessingAttemptStatus.Processing,
  ]);
}

export function failDocumentProcessingAttempt(input: TransitionDocumentProcessingAttemptInput): DocumentProcessingAttemptResult {
  const metadata = createTransitionMetadata(input);
  const errorValidation = validateErrorDetail(input.error ?? null, metadata, true);

  if (errorValidation.length > 0) {
    return failureAttempt(errorValidation, metadata);
  }

  return finishAttempt(input, DocumentProcessingAttemptStatus.Failed, false, input.error ?? null, [
    DocumentProcessingAttemptStatus.Processing,
  ]);
}

export function abandonDocumentProcessingAttempt(input: TransitionDocumentProcessingAttemptInput): DocumentProcessingAttemptResult {
  return finishAttempt(
    input,
    DocumentProcessingAttemptStatus.Abandoned,
    false,
    input.error ?? null,
    [DocumentProcessingAttemptStatus.Requested, DocumentProcessingAttemptStatus.Processing],
  );
}

export function isTerminalDocumentProcessingAttemptStatus(status: DocumentProcessingAttemptStatus): boolean {
  return (
    status === DocumentProcessingAttemptStatus.Completed ||
    status === DocumentProcessingAttemptStatus.PartiallyCompleted ||
    status === DocumentProcessingAttemptStatus.Failed ||
    status === DocumentProcessingAttemptStatus.Abandoned
  );
}

export function isCanonicalSha256(value: string): boolean {
  return SHA_256_PATTERN.test(value);
}

export function isSafeStorageReference(value: string): boolean {
  if (isBlank(value)) {
    return false;
  }

  const normalized = value.trim();

  return (
    !WINDOWS_DRIVE_PATTERN.test(normalized) &&
    !normalized.startsWith("/") &&
    !normalized.startsWith("\\") &&
    !normalized.toLowerCase().startsWith("file:") &&
    !normalized.includes("\\") &&
    !normalized.split("/").includes("..")
  );
}

function finishAttempt(
  input: TransitionDocumentProcessingAttemptInput,
  targetStatus: DocumentProcessingAttemptStatus,
  partialProcessing: boolean,
  error: DocumentProcessingAttemptErrorDetail | null,
  allowedFrom: ReadonlyArray<DocumentProcessingAttemptStatus>,
): DocumentProcessingAttemptResult {
  const metadata = createTransitionMetadata(input);
  const transitionError = validateTransition(input.attempt, targetStatus, metadata, allowedFrom);

  if (transitionError !== null) {
    return failureAttempt([transitionError], metadata);
  }

  if (isBlank(input.occurredAt)) {
    return failureAttempt([createError("missing_timestamp", "occurredAt", "Transition timestamp is required.", metadata)], metadata);
  }

  const errorValidation = validateErrorDetail(error, metadata, false);
  if (errorValidation.length > 0) {
    return failureAttempt(errorValidation, metadata);
  }

  return successAttempt({
    ...input.attempt,
    status: targetStatus,
    finishedAt: input.occurredAt,
    error,
    partialProcessing,
    metadata: { ...input.attempt.metadata, ...(input.metadata ?? {}) },
  }, metadata);
}

function validateTransition(
  attempt: DocumentProcessingAttempt,
  targetStatus: DocumentProcessingAttemptStatus,
  metadata: DocumentProcessingMetadata,
  allowedFrom: ReadonlyArray<DocumentProcessingAttemptStatus>,
): DocumentProcessingError | null {
  if (isTerminalDocumentProcessingAttemptStatus(attempt.status)) {
    return createError(
      "terminal_attempt",
      "status",
      `Cannot transition a terminal processing attempt from ${attempt.status} to ${targetStatus}.`,
      metadata,
    );
  }

  if (!allowedFrom.includes(attempt.status)) {
    return createError(
      "invalid_attempt_transition",
      "status",
      `Cannot transition processing attempt from ${attempt.status} to ${targetStatus}.`,
      metadata,
    );
  }

  return null;
}

function validateErrorDetail(
  error: DocumentProcessingAttemptErrorDetail | null,
  metadata: DocumentProcessingMetadata,
  required: boolean,
): ReadonlyArray<DocumentProcessingError> {
  if (error === null) {
    return required ? [createError("missing_error", "error", "Structured error is required.", metadata)] : [];
  }

  const errors: DocumentProcessingError[] = [];

  if (isBlank(error.code)) {
    errors.push(createError("invalid_error", "error.code", "Structured error code is required.", metadata));
  }

  if (isBlank(error.message)) {
    errors.push(createError("invalid_error", "error.message", "Structured error message is required.", metadata));
  }

  return errors;
}

function createDocumentMetadata(input: CreateDocumentArtifactInput): DocumentProcessingMetadata {
  return {
    ...(input.metadata ?? {}),
    documentId: input.id,
    organizationId: input.organizationId,
    context: input.context,
    registeredBy: input.registeredBy,
    registeredAt: input.registeredAt,
    ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
    ...(input.sourceSystem !== undefined ? { sourceSystem: input.sourceSystem } : {}),
  };
}

function createVersionMetadata(input: CreateDocumentVersionInput): DocumentProcessingMetadata {
  return {
    ...(input.metadata ?? {}),
    documentVersionId: input.id,
    documentId: input.document?.id ?? null,
    organizationId: input.document?.organizationId ?? null,
    sha256: input.sha256,
    uploadedBy: input.uploadedBy,
    uploadedAt: input.uploadedAt,
    ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
    ...(input.sourceSystem !== undefined ? { sourceSystem: input.sourceSystem } : {}),
  };
}

function createAttemptMetadata(input: CreateDocumentProcessingAttemptInput): DocumentProcessingMetadata {
  return {
    ...(input.metadata ?? {}),
    processingAttemptId: input.id,
    documentVersionId: input.documentVersion?.id ?? null,
    organizationId: input.documentVersion?.organizationId ?? null,
    mechanism: input.mechanism,
    requestedBy: input.requestedBy,
    requestedAt: input.requestedAt,
    requestIdempotencyKey: input.requestIdempotencyKey,
    ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
    ...(input.sourceSystem !== undefined ? { sourceSystem: input.sourceSystem } : {}),
  };
}

function createTransitionMetadata(input: TransitionDocumentProcessingAttemptInput): DocumentProcessingMetadata {
  return {
    ...input.attempt.metadata,
    ...(input.metadata ?? {}),
    processingAttemptId: input.attempt.id,
    documentVersionId: input.attempt.documentVersionId,
    fromStatus: input.attempt.status,
    occurredAt: input.occurredAt,
  };
}

function failureAttempt(
  errors: ReadonlyArray<DocumentProcessingError>,
  metadata: DocumentProcessingMetadata,
): DocumentProcessingAttemptFailure {
  return freezeDomainObject<DocumentProcessingAttemptFailure>({ success: false, attempt: null, errors, warnings: [], metadata });
}

function successAttempt(
  attempt: DocumentProcessingAttempt,
  metadata: DocumentProcessingMetadata,
): DocumentProcessingAttemptSuccess {
  return freezeDomainObject<DocumentProcessingAttemptSuccess>({ success: true, attempt, errors: [], warnings: [], metadata });
}

function createError(
  code: DocumentProcessingErrorCode,
  field: string,
  message: string,
  metadata: DocumentProcessingMetadata,
): DocumentProcessingError {
  return { code, field, message, metadata };
}

function normalizeNullableString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return isBlank(value) ? null : value;
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [key, cloneDomainValue(property)]),
  ) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.values(value as Record<string, unknown>).forEach((property) => {
    freezeClonedDomainObject(property);
  });

  return Object.freeze(value);
}
