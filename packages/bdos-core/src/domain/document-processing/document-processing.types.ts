export type DocumentProcessingMetadata = Readonly<Record<string, unknown>>;

export type DocumentArtifactId = string;
export type DocumentVersionId = string;
export type DocumentProcessingAttemptId = string;
export type DocumentProcessingOrganizationId = string;
export type DocumentProcessingActor = string;
export type DocumentProcessingTimestamp = string;
export type DocumentSha256 = string;
export type DocumentStorageReference = string;
export type DocumentRequestIdempotencyKey = string;

export interface DocumentArtifact {
  readonly id: DocumentArtifactId;
  readonly organizationId: DocumentProcessingOrganizationId;
  readonly context: string;
  readonly title: string | null;
  readonly registeredBy: DocumentProcessingActor;
  readonly registeredAt: DocumentProcessingTimestamp;
  readonly metadata: DocumentProcessingMetadata;
}

export interface DocumentVersion {
  readonly id: DocumentVersionId;
  readonly organizationId: DocumentProcessingOrganizationId;
  readonly documentId: DocumentArtifactId;
  readonly sha256: DocumentSha256;
  readonly originalFileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly storageReference: DocumentStorageReference;
  readonly uploadedBy: DocumentProcessingActor;
  readonly uploadedAt: DocumentProcessingTimestamp;
  readonly technicalMetadata: DocumentProcessingMetadata;
  readonly metadata: DocumentProcessingMetadata;
}

export enum DocumentProcessingAttemptStatus {
  Requested = "Requested",
  Processing = "Processing",
  Completed = "Completed",
  PartiallyCompleted = "PartiallyCompleted",
  Failed = "Failed",
  Abandoned = "Abandoned",
}

export interface DocumentProcessingAttemptErrorDetail {
  readonly code: string;
  readonly message: string;
  readonly metadata?: DocumentProcessingMetadata;
}

export interface DocumentProcessingAttempt {
  readonly id: DocumentProcessingAttemptId;
  readonly organizationId: DocumentProcessingOrganizationId;
  readonly documentVersionId: DocumentVersionId;
  readonly status: DocumentProcessingAttemptStatus;
  readonly mechanism: string;
  readonly mechanismVersion: string | null;
  readonly requestedAt: DocumentProcessingTimestamp;
  readonly startedAt: DocumentProcessingTimestamp | null;
  readonly finishedAt: DocumentProcessingTimestamp | null;
  readonly error: DocumentProcessingAttemptErrorDetail | null;
  readonly partialProcessing: boolean;
  readonly requestIdempotencyKey: DocumentRequestIdempotencyKey;
  readonly requestedBy: DocumentProcessingActor;
  readonly metadata: DocumentProcessingMetadata;
}

export interface CreateDocumentArtifactInput {
  readonly id: DocumentArtifactId;
  readonly organizationId: DocumentProcessingOrganizationId;
  readonly context: string;
  readonly title?: string | null;
  readonly registeredBy: DocumentProcessingActor;
  readonly registeredAt: DocumentProcessingTimestamp;
  readonly correlationId?: string;
  readonly sourceSystem?: string;
  readonly metadata?: DocumentProcessingMetadata;
}

export interface CreateDocumentVersionInput {
  readonly id: DocumentVersionId;
  readonly document: DocumentArtifact;
  readonly sha256: DocumentSha256;
  readonly originalFileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly storageReference: DocumentStorageReference;
  readonly uploadedBy: DocumentProcessingActor;
  readonly uploadedAt: DocumentProcessingTimestamp;
  readonly technicalMetadata?: DocumentProcessingMetadata;
  readonly correlationId?: string;
  readonly sourceSystem?: string;
  readonly metadata?: DocumentProcessingMetadata;
}

export interface CreateDocumentProcessingAttemptInput {
  readonly id: DocumentProcessingAttemptId;
  readonly documentVersion: DocumentVersion;
  readonly mechanism: string;
  readonly mechanismVersion?: string | null;
  readonly requestedAt: DocumentProcessingTimestamp;
  readonly requestedBy: DocumentProcessingActor;
  readonly requestIdempotencyKey: DocumentRequestIdempotencyKey;
  readonly correlationId?: string;
  readonly sourceSystem?: string;
  readonly metadata?: DocumentProcessingMetadata;
}

export interface TransitionDocumentProcessingAttemptInput {
  readonly attempt: DocumentProcessingAttempt;
  readonly occurredAt: DocumentProcessingTimestamp;
  readonly error?: DocumentProcessingAttemptErrorDetail | null;
  readonly metadata?: DocumentProcessingMetadata;
}

export type DocumentProcessingErrorCode =
  | "missing_id"
  | "missing_organization_id"
  | "missing_context"
  | "missing_actor"
  | "missing_timestamp"
  | "missing_document"
  | "missing_document_version"
  | "missing_sha256"
  | "invalid_sha256"
  | "missing_original_file_name"
  | "missing_mime_type"
  | "invalid_size_bytes"
  | "missing_storage_reference"
  | "unsafe_storage_reference"
  | "missing_mechanism"
  | "missing_request_idempotency_key"
  | "missing_error"
  | "invalid_error"
  | "invalid_attempt_transition"
  | "terminal_attempt"
  | "version_document_mismatch"
  | "attempt_version_mismatch";

export interface DocumentProcessingError {
  readonly code: DocumentProcessingErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: DocumentProcessingMetadata;
}

export type DocumentProcessingWarningCode = "none";

export interface DocumentProcessingWarning {
  readonly code: DocumentProcessingWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: DocumentProcessingMetadata;
}

export interface CreateDocumentArtifactSuccess {
  readonly success: true;
  readonly document: DocumentArtifact;
  readonly errors: ReadonlyArray<DocumentProcessingError>;
  readonly warnings: ReadonlyArray<DocumentProcessingWarning>;
  readonly metadata: DocumentProcessingMetadata;
}

export interface CreateDocumentArtifactFailure {
  readonly success: false;
  readonly document: null;
  readonly errors: ReadonlyArray<DocumentProcessingError>;
  readonly warnings: ReadonlyArray<DocumentProcessingWarning>;
  readonly metadata: DocumentProcessingMetadata;
}

export type CreateDocumentArtifactResult = CreateDocumentArtifactSuccess | CreateDocumentArtifactFailure;

export interface CreateDocumentVersionSuccess {
  readonly success: true;
  readonly documentVersion: DocumentVersion;
  readonly errors: ReadonlyArray<DocumentProcessingError>;
  readonly warnings: ReadonlyArray<DocumentProcessingWarning>;
  readonly metadata: DocumentProcessingMetadata;
}

export interface CreateDocumentVersionFailure {
  readonly success: false;
  readonly documentVersion: null;
  readonly errors: ReadonlyArray<DocumentProcessingError>;
  readonly warnings: ReadonlyArray<DocumentProcessingWarning>;
  readonly metadata: DocumentProcessingMetadata;
}

export type CreateDocumentVersionResult = CreateDocumentVersionSuccess | CreateDocumentVersionFailure;

export interface DocumentProcessingAttemptSuccess {
  readonly success: true;
  readonly attempt: DocumentProcessingAttempt;
  readonly errors: ReadonlyArray<DocumentProcessingError>;
  readonly warnings: ReadonlyArray<DocumentProcessingWarning>;
  readonly metadata: DocumentProcessingMetadata;
}

export interface DocumentProcessingAttemptFailure {
  readonly success: false;
  readonly attempt: null;
  readonly errors: ReadonlyArray<DocumentProcessingError>;
  readonly warnings: ReadonlyArray<DocumentProcessingWarning>;
  readonly metadata: DocumentProcessingMetadata;
}

export type DocumentProcessingAttemptResult = DocumentProcessingAttemptSuccess | DocumentProcessingAttemptFailure;
