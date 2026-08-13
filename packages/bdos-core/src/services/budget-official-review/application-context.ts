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
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.message === "string" && errObj.message.length > 0) return errObj.message;
    if (typeof errObj.error === "string" && errObj.error.length > 0) return errObj.error;
  }
  return String(error);
}
