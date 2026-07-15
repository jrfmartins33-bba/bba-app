import type { DocumentProcessingAttempt } from "../../domain/document-processing";

export interface PersistedDocumentProcessingAttempt {
  readonly entity: DocumentProcessingAttempt;
  readonly revision: number;
}

export const INITIAL_DOCUMENT_PROCESSING_ATTEMPT_REVISION = 0;

export type SaveDocumentProcessingAttemptResult =
  | { readonly outcome: "saved"; readonly revision: number }
  | { readonly outcome: "concurrency_conflict" };

export interface DocumentProcessingAttemptRepository {
  createDocumentProcessingAttempt(
    organizationId: string,
    actor: string,
    attempt: DocumentProcessingAttempt,
  ): Promise<PersistedDocumentProcessingAttempt>;

  findDocumentProcessingAttemptById(
    organizationId: string,
    id: string,
  ): Promise<PersistedDocumentProcessingAttempt | null>;

  findDocumentProcessingAttemptByRequestKey(
    organizationId: string,
    documentVersionId: string,
    requestIdempotencyKey: string,
  ): Promise<PersistedDocumentProcessingAttempt | null>;

  listDocumentProcessingAttemptsByVersion(
    organizationId: string,
    documentVersionId: string,
  ): Promise<ReadonlyArray<PersistedDocumentProcessingAttempt>>;

  saveDocumentProcessingAttempt(
    organizationId: string,
    actor: string,
    attempt: DocumentProcessingAttempt,
    expectedRevision: number,
  ): Promise<SaveDocumentProcessingAttemptResult>;
}
