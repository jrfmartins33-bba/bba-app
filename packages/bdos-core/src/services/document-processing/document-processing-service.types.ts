import type {
  DocumentArtifact,
  DocumentProcessingAttempt,
  DocumentProcessingError,
  DocumentProcessingMetadata,
  DocumentVersion,
} from "../../domain/document-processing";
import type { DocumentProcessingAttemptRepository, PersistedDocumentProcessingAttempt } from "./document-processing-attempt.repository";
import type { DocumentRepository } from "./document.repository";
import type { DocumentVersionRepository } from "./document-version.repository";

export interface DocumentProcessingRepositories {
  readonly documentRepository: DocumentRepository;
  readonly documentVersionRepository: DocumentVersionRepository;
  readonly attemptRepository: DocumentProcessingAttemptRepository;
}

export interface RegisterDocumentCommand {
  readonly context: string;
  readonly title?: string | null;
  readonly metadata?: DocumentProcessingMetadata;
}

export interface RegisterDocumentVersionCommand {
  readonly documentId: string;
  readonly sha256: string;
  readonly originalFileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly storageReference: string;
  readonly technicalMetadata?: DocumentProcessingMetadata;
  readonly metadata?: DocumentProcessingMetadata;
}

export interface RequestDocumentProcessingAttemptCommand {
  readonly documentVersionId: string;
  readonly mechanism: string;
  readonly mechanismVersion?: string | null;
  readonly requestIdempotencyKey: string;
  readonly metadata?: DocumentProcessingMetadata;
}

export interface TransitionDocumentProcessingAttemptCommand {
  readonly attemptId: string;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly metadata?: DocumentProcessingMetadata;
  } | null;
  readonly metadata?: DocumentProcessingMetadata;
}

export interface GetDocumentQuery {
  readonly documentId: string;
}

export interface GetDocumentVersionQuery {
  readonly documentVersionId: string;
}

export interface ListDocumentVersionsQuery {
  readonly documentId: string;
}

export interface ListDocumentProcessingAttemptsQuery {
  readonly documentVersionId: string;
}

export type RegisterDocumentResult =
  | { readonly outcome: "created"; readonly document: DocumentArtifact }
  | { readonly outcome: "domain_error"; readonly errors: ReadonlyArray<DocumentProcessingError> }
  | { readonly outcome: "persistence_failure"; readonly message: string };

export type RegisterDocumentVersionResult =
  | { readonly outcome: "created"; readonly documentVersion: DocumentVersion }
  | { readonly outcome: "reused"; readonly documentVersion: DocumentVersion }
  | { readonly outcome: "document_not_found" }
  | { readonly outcome: "domain_error"; readonly errors: ReadonlyArray<DocumentProcessingError> }
  | { readonly outcome: "persistence_failure"; readonly message: string };

export type RequestDocumentProcessingAttemptResult =
  | { readonly outcome: "created"; readonly attempt: DocumentProcessingAttempt; readonly revision: number }
  | { readonly outcome: "reused"; readonly attempt: DocumentProcessingAttempt; readonly revision: number }
  | { readonly outcome: "document_version_not_found" }
  | { readonly outcome: "domain_error"; readonly errors: ReadonlyArray<DocumentProcessingError> }
  | { readonly outcome: "persistence_failure"; readonly message: string };

export type TransitionDocumentProcessingAttemptResult =
  | { readonly outcome: "success"; readonly attempt: DocumentProcessingAttempt; readonly revision: number }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "domain_error"; readonly errors: ReadonlyArray<DocumentProcessingError> }
  | { readonly outcome: "concurrency_conflict" }
  | { readonly outcome: "persistence_failure"; readonly message: string };

export type GetDocumentResult =
  | { readonly outcome: "found"; readonly document: DocumentArtifact }
  | { readonly outcome: "not_found" };

export type GetDocumentVersionResult =
  | { readonly outcome: "found"; readonly documentVersion: DocumentVersion }
  | { readonly outcome: "not_found" };

export type ListDocumentVersionsResult =
  | { readonly outcome: "success"; readonly documentVersions: ReadonlyArray<DocumentVersion> }
  | { readonly outcome: "document_not_found" }
  | { readonly outcome: "persistence_failure"; readonly message: string };

export type ListDocumentProcessingAttemptsResult =
  | { readonly outcome: "success"; readonly attempts: ReadonlyArray<PersistedDocumentProcessingAttempt> }
  | { readonly outcome: "document_version_not_found" }
  | { readonly outcome: "persistence_failure"; readonly message: string };
