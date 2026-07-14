/**
 * Contexto mínimo dos Serviços de Aplicação de Engenharia de Custos e
 * Licitações (Epic 21, Sprint 21.3C). `organizationId` é sempre a
 * organização usuária autorizada para a operação, resolvida pelo chamador
 * confiável (Route Handler / adaptador de autenticação) — nunca aceita como
 * fato independente vindo de um comando de negócio (ver cada
 * `*Command` em `procurement-case-service.types.ts` /
 * `budget-version-service.types.ts`: nenhum deles possui campo
 * `organizationId`). `company_id` pertence exclusivamente ao adaptador de
 * persistência e ao banco — este módulo nunca o conhece.
 */
export type ProcurementEngineeringOrganizationId = string;
export type ProcurementEngineeringActor = string;
export type ProcurementEngineeringCorrelationId = string;
export type ProcurementEngineeringSourceSystem = string;

export interface ApplicationContext {
  readonly organizationId: ProcurementEngineeringOrganizationId;
  readonly actor: ProcurementEngineeringActor;
  readonly correlationId?: ProcurementEngineeringCorrelationId;
  readonly sourceSystem?: ProcurementEngineeringSourceSystem;
}

/**
 * Erros de infraestrutura/coordenação da camada de aplicação — distintos dos
 * erros de domínio (`ProcurementCaseError`/`BudgetVersionError`, que são
 * sempre preservados sem reescrita de semântica, nunca traduzidos para um
 * destes códigos).
 */
export type ApplicationInfrastructureErrorCode =
  | "not_found"
  | "concurrency_conflict"
  | "persistence_failure"
  | "integrity_violation"
  | "unauthorized";

export interface ApplicationInfrastructureError {
  readonly code: ApplicationInfrastructureErrorCode;
  readonly message: string;
}

export function toInfrastructureErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
