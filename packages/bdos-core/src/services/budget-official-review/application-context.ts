export interface ApplicationContext {
  readonly organizationId: string;
  readonly actor: string;
}

export type ApplicationInfrastructureErrorCode = "not_found" | "persistence_failure" | "unauthorized";

export interface ApplicationInfrastructureError {
  readonly code: ApplicationInfrastructureErrorCode;
  readonly message: string;
}

export function toInfrastructureErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
