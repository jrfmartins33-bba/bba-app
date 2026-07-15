export type DocumentProcessingOrganizationId = string;
export type DocumentProcessingActor = string;
export type DocumentProcessingCorrelationId = string;
export type DocumentProcessingSourceSystem = string;

export interface DocumentProcessingApplicationContext {
  readonly organizationId: DocumentProcessingOrganizationId;
  readonly actor: DocumentProcessingActor;
  readonly correlationId?: DocumentProcessingCorrelationId;
  readonly sourceSystem?: DocumentProcessingSourceSystem;
}

export type DocumentProcessingInfrastructureErrorCode =
  | "not_found"
  | "concurrency_conflict"
  | "persistence_failure"
  | "integrity_violation"
  | "unauthorized";

export interface DocumentProcessingInfrastructureError {
  readonly code: DocumentProcessingInfrastructureErrorCode;
  readonly message: string;
}

export function toInfrastructureErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
