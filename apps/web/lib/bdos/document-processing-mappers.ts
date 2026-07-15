import {
  DocumentProcessingAttemptStatus,
  INITIAL_DOCUMENT_PROCESSING_ATTEMPT_REVISION,
  type DocumentArtifact,
  type DocumentProcessingAttempt,
  type DocumentProcessingAttemptErrorDetail,
  type DocumentVersion,
  type PersistedDocumentProcessingAttempt,
} from "@bba/bdos-core/services/document-processing";

export class DocumentProcessingReconstructionError extends Error {
  constructor(message: string) {
    super(`Invalid document processing database row: ${message}`);
    this.name = "DocumentProcessingReconstructionError";
  }
}

export interface DocumentArtifactRow {
  readonly id: string;
  readonly company_id: string;
  readonly document_context: string;
  readonly title: string | null;
  readonly registered_by: string;
  readonly registered_at: string;
  readonly metadata: Record<string, unknown> | null;
}

export interface DocumentVersionRow {
  readonly id: string;
  readonly company_id: string;
  readonly document_id: string;
  readonly sha256: string;
  readonly original_file_name: string;
  readonly mime_type: string;
  readonly size_bytes: string | number;
  readonly storage_reference: string;
  readonly uploaded_by: string;
  readonly uploaded_at: string;
  readonly technical_metadata: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown> | null;
}

export interface DocumentProcessingAttemptRow {
  readonly id: string;
  readonly company_id: string;
  readonly document_version_id: string;
  readonly status: string;
  readonly mechanism: string;
  readonly mechanism_version: string | null;
  readonly requested_at: string;
  readonly started_at: string | null;
  readonly finished_at: string | null;
  readonly error: Record<string, unknown> | null;
  readonly partial_processing: boolean;
  readonly request_idempotency_key: string;
  readonly requested_by: string;
  readonly revision: number;
  readonly metadata: Record<string, unknown> | null;
}

export function mapDocumentArtifactRow(row: DocumentArtifactRow): DocumentArtifact {
  return {
    id: assertNonBlankString(row.id, "document_artifacts.id"),
    organizationId: assertNonBlankString(row.company_id, "document_artifacts.company_id"),
    context: assertNonBlankString(row.document_context, "document_artifacts.document_context"),
    title: row.title,
    registeredBy: assertNonBlankString(row.registered_by, "document_artifacts.registered_by"),
    registeredAt: assertNonBlankString(row.registered_at, "document_artifacts.registered_at"),
    metadata: row.metadata ?? {},
  };
}

export function mapDocumentVersionRow(row: DocumentVersionRow): DocumentVersion {
  return {
    id: assertNonBlankString(row.id, "document_versions.id"),
    organizationId: assertNonBlankString(row.company_id, "document_versions.company_id"),
    documentId: assertNonBlankString(row.document_id, "document_versions.document_id"),
    sha256: assertNonBlankString(row.sha256, "document_versions.sha256"),
    originalFileName: assertNonBlankString(row.original_file_name, "document_versions.original_file_name"),
    mimeType: assertNonBlankString(row.mime_type, "document_versions.mime_type"),
    sizeBytes: parsePositiveInteger(row.size_bytes, "document_versions.size_bytes"),
    storageReference: assertNonBlankString(row.storage_reference, "document_versions.storage_reference"),
    uploadedBy: assertNonBlankString(row.uploaded_by, "document_versions.uploaded_by"),
    uploadedAt: assertNonBlankString(row.uploaded_at, "document_versions.uploaded_at"),
    technicalMetadata: row.technical_metadata ?? {},
    metadata: row.metadata ?? {},
  };
}

export function mapDocumentProcessingAttemptRow(row: DocumentProcessingAttemptRow): PersistedDocumentProcessingAttempt {
  const attempt: DocumentProcessingAttempt = {
    id: assertNonBlankString(row.id, "document_processing_attempts.id"),
    organizationId: assertNonBlankString(row.company_id, "document_processing_attempts.company_id"),
    documentVersionId: assertNonBlankString(row.document_version_id, "document_processing_attempts.document_version_id"),
    status: mapAttemptStatus(row.status),
    mechanism: assertNonBlankString(row.mechanism, "document_processing_attempts.mechanism"),
    mechanismVersion: row.mechanism_version,
    requestedAt: assertNonBlankString(row.requested_at, "document_processing_attempts.requested_at"),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    error: row.error === null ? null : mapAttemptError(row.error),
    partialProcessing: row.partial_processing,
    requestIdempotencyKey: assertNonBlankString(
      row.request_idempotency_key,
      "document_processing_attempts.request_idempotency_key",
    ),
    requestedBy: assertNonBlankString(row.requested_by, "document_processing_attempts.requested_by"),
    metadata: row.metadata ?? {},
  };

  return { entity: attempt, revision: assertRevision(row.revision) };
}

export function documentArtifactCreateRpcParams(
  organizationId: string,
  actor: string,
  document: DocumentArtifact,
): Record<string, unknown> {
  return {
    p_actor_id: actor,
    p_company_id: organizationId,
    p_id: document.id,
    p_document_context: document.context,
    p_title: document.title,
    p_metadata: document.metadata,
    p_correlation_id: readOptionalMetadataString(document.metadata, "correlationId"),
    p_source_system: readOptionalMetadataString(document.metadata, "sourceSystem"),
    p_registered_at: document.registeredAt,
  };
}

export function documentVersionCreateRpcParams(
  organizationId: string,
  actor: string,
  documentVersion: DocumentVersion,
): Record<string, unknown> {
  return {
    p_actor_id: actor,
    p_company_id: organizationId,
    p_id: documentVersion.id,
    p_document_id: documentVersion.documentId,
    p_sha256: documentVersion.sha256,
    p_original_file_name: documentVersion.originalFileName,
    p_mime_type: documentVersion.mimeType,
    p_size_bytes: documentVersion.sizeBytes,
    p_storage_reference: documentVersion.storageReference,
    p_technical_metadata: documentVersion.technicalMetadata,
    p_metadata: documentVersion.metadata,
    p_correlation_id: readOptionalMetadataString(documentVersion.metadata, "correlationId"),
    p_source_system: readOptionalMetadataString(documentVersion.metadata, "sourceSystem"),
    p_uploaded_at: documentVersion.uploadedAt,
  };
}

export function documentProcessingAttemptCreateRpcParams(
  organizationId: string,
  actor: string,
  attempt: DocumentProcessingAttempt,
): Record<string, unknown> {
  return {
    p_actor_id: actor,
    p_company_id: organizationId,
    p_id: attempt.id,
    p_document_version_id: attempt.documentVersionId,
    p_status: attempt.status,
    p_mechanism: attempt.mechanism,
    p_mechanism_version: attempt.mechanismVersion,
    p_requested_at: attempt.requestedAt,
    p_request_idempotency_key: attempt.requestIdempotencyKey,
    p_metadata: attempt.metadata,
    p_correlation_id: readOptionalMetadataString(attempt.metadata, "correlationId"),
    p_source_system: readOptionalMetadataString(attempt.metadata, "sourceSystem"),
  };
}

export function documentProcessingAttemptTransitionRpcParams(
  organizationId: string,
  actor: string,
  attempt: DocumentProcessingAttempt,
  expectedRevision: number,
): Record<string, unknown> {
  return {
    p_actor_id: actor,
    p_company_id: organizationId,
    p_attempt_id: attempt.id,
    p_expected_revision: expectedRevision,
    p_status: attempt.status,
    p_started_at: attempt.startedAt,
    p_finished_at: attempt.finishedAt,
    p_error: attempt.error,
    p_partial_processing: attempt.partialProcessing,
    p_metadata: attempt.metadata,
  };
}

function mapAttemptStatus(value: string): DocumentProcessingAttemptStatus {
  if (value === DocumentProcessingAttemptStatus.Requested) return DocumentProcessingAttemptStatus.Requested;
  if (value === DocumentProcessingAttemptStatus.Processing) return DocumentProcessingAttemptStatus.Processing;
  if (value === DocumentProcessingAttemptStatus.Completed) return DocumentProcessingAttemptStatus.Completed;
  if (value === DocumentProcessingAttemptStatus.PartiallyCompleted) return DocumentProcessingAttemptStatus.PartiallyCompleted;
  if (value === DocumentProcessingAttemptStatus.Failed) return DocumentProcessingAttemptStatus.Failed;
  if (value === DocumentProcessingAttemptStatus.Abandoned) return DocumentProcessingAttemptStatus.Abandoned;
  throw new DocumentProcessingReconstructionError(`document_processing_attempts.status "${value}" is unknown.`);
}

function mapAttemptError(value: Record<string, unknown>): DocumentProcessingAttemptErrorDetail {
  return {
    code: assertNonBlankString(value.code, "document_processing_attempts.error.code"),
    message: assertNonBlankString(value.message, "document_processing_attempts.error.message"),
    metadata: isRecord(value.metadata) ? value.metadata : undefined,
  };
}

function readOptionalMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function assertNonBlankString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DocumentProcessingReconstructionError(`${field} must be a non-blank string, got ${JSON.stringify(value)}.`);
  }
  return value;
}

function parsePositiveInteger(value: string | number, field: string): number {
  const numeric = typeof value === "string" ? Number(value) : value;

  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new DocumentProcessingReconstructionError(`${field} must be a positive safe integer, got ${JSON.stringify(value)}.`);
  }

  return numeric;
}

function assertRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < INITIAL_DOCUMENT_PROCESSING_ATTEMPT_REVISION) {
    throw new DocumentProcessingReconstructionError(`document_processing_attempts.revision must be a non-negative integer, got ${JSON.stringify(value)}.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
