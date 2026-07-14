import type { ProcurementCase, ProcurementCaseError, ProcurementCaseMetadata, ProcurementLot } from "../../domain/procurement-case";

/**
 * Comandos de negócio — nunca aceitam `organizationId` nem `company_id`
 * (seção 7 da instrução): a organização usuária vem sempre do
 * `ApplicationContext`.
 */
export interface CreateProcurementCaseCommand {
  readonly title: string;
  readonly externalReference?: string | null;
  readonly metadata?: ProcurementCaseMetadata;
}

export interface RegisterProcurementLotCommand {
  readonly procurementCaseId: string;
  readonly title: string;
  readonly externalReference?: string | null;
  readonly metadata?: ProcurementCaseMetadata;
}

export type CreateProcurementCaseServiceResult =
  | { readonly outcome: "created"; readonly procurementCase: ProcurementCase }
  | { readonly outcome: "domain_error"; readonly errors: ReadonlyArray<ProcurementCaseError> }
  | { readonly outcome: "persistence_failure"; readonly message: string };

export type RegisterProcurementLotServiceResult =
  | { readonly outcome: "created"; readonly procurementLot: ProcurementLot }
  | { readonly outcome: "procurement_case_not_found" }
  | { readonly outcome: "domain_error"; readonly errors: ReadonlyArray<ProcurementCaseError> }
  | { readonly outcome: "persistence_failure"; readonly message: string };
