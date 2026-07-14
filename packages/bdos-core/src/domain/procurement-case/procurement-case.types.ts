export type ProcurementCaseMetadata = Readonly<Record<string, unknown>>;

export type ProcurementCaseId = string;

export type ProcurementLotId = string;

export type ProcurementOrganizationId = string;

export type ProcurementCaseTitle = string;

/** Referência externa opcional (ex.: número do edital) — nunca é identidade interna. */
export type ProcurementExternalReference = string;

export type ProcurementCorrelationId = string;

export type ProcurementCreatedBy = string;

export type ProcurementSourceSystem = string;

/**
 * Processo de Licitação e Contratação (`ProcurementCase`, ADR-001 §G.1 /
 * ADR-002). Núcleo coordenador enxuto: não guarda coleções não limitadas de
 * lotes, propostas ou decisões — apenas os fatos processuais próprios desta
 * primeira fatia (identidade, organização usuária, título, referência
 * externa opcional). `externalReference` (ex.: número do edital) nunca é
 * usada como identidade — `id` é sempre gerado internamente.
 */
export interface ProcurementCase {
  readonly id: ProcurementCaseId;
  readonly organizationId: ProcurementOrganizationId;
  readonly title: ProcurementCaseTitle;
  readonly externalReference: ProcurementExternalReference | null;
  readonly metadata: ProcurementCaseMetadata;
}

export interface CreateProcurementCaseInput {
  readonly id: ProcurementCaseId;
  readonly organizationId: ProcurementOrganizationId;
  readonly title: ProcurementCaseTitle;
  readonly externalReference?: ProcurementExternalReference | null;
  readonly correlationId: ProcurementCorrelationId;
  readonly createdBy: ProcurementCreatedBy;
  readonly sourceSystem: ProcurementSourceSystem;
  readonly metadata?: ProcurementCaseMetadata;
}

/**
 * Lote da Licitação (`ProcurementLot`, ADR-002 §I). Sempre opcional —
 * "processo inteiro" nunca recebe um lote artificial; é representado pelo
 * Escopo da Licitação (ver `ProcurementScope`). Um lote pertence sempre ao
 * mesmo Processo e à mesma organização usuária que o criou.
 */
export interface ProcurementLot {
  readonly id: ProcurementLotId;
  readonly procurementCaseId: ProcurementCaseId;
  readonly organizationId: ProcurementOrganizationId;
  readonly title: ProcurementCaseTitle;
  readonly externalReference: ProcurementExternalReference | null;
  readonly metadata: ProcurementCaseMetadata;
}

export interface CreateProcurementLotInput {
  readonly id: ProcurementLotId;
  readonly procurementCase: ProcurementCase;
  readonly title: ProcurementCaseTitle;
  readonly externalReference?: ProcurementExternalReference | null;
  readonly correlationId: ProcurementCorrelationId;
  readonly createdBy: ProcurementCreatedBy;
  readonly sourceSystem: ProcurementSourceSystem;
  readonly metadata?: ProcurementCaseMetadata;
}

export enum ProcurementScopeKind {
  WholeCase = "WholeCase",
  Lot = "Lot",
}

/**
 * Escopo da Licitação (`ProcurementScope`, ADR-002 §J / ADR-004). Menor
 * forma suficiente para esta fatia: representa o processo inteiro
 * (`WholeCase`, sem exigir lote) ou um lote específico (`Lot`, referenciando
 * um `ProcurementLot` já existente do mesmo Processo). Não generaliza para
 * filtros ou expressões arbitrárias.
 */
export type ProcurementScope =
  | { readonly kind: ProcurementScopeKind.WholeCase; readonly procurementCaseId: ProcurementCaseId }
  | {
      readonly kind: ProcurementScopeKind.Lot;
      readonly procurementCaseId: ProcurementCaseId;
      readonly procurementLotId: ProcurementLotId;
    };

export type ProcurementCaseErrorCode =
  | "missing_organization_id"
  | "missing_title"
  | "missing_procurement_case"
  | "organization_mismatch"
  | "invalid_scope_lot";

export interface ProcurementCaseError {
  readonly code: ProcurementCaseErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ProcurementCaseMetadata;
}

export type ProcurementCaseWarningCode = "none";

export interface ProcurementCaseWarning {
  readonly code: ProcurementCaseWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ProcurementCaseMetadata;
}

export interface CreateProcurementCaseSuccess {
  readonly success: true;
  readonly procurementCase: ProcurementCase;
  readonly errors: ReadonlyArray<ProcurementCaseError>;
  readonly warnings: ReadonlyArray<ProcurementCaseWarning>;
  readonly metadata: ProcurementCaseMetadata;
}

export interface CreateProcurementCaseFailure {
  readonly success: false;
  readonly procurementCase: null;
  readonly errors: ReadonlyArray<ProcurementCaseError>;
  readonly warnings: ReadonlyArray<ProcurementCaseWarning>;
  readonly metadata: ProcurementCaseMetadata;
}

export type CreateProcurementCaseResult = CreateProcurementCaseSuccess | CreateProcurementCaseFailure;

export interface CreateProcurementLotSuccess {
  readonly success: true;
  readonly procurementLot: ProcurementLot;
  readonly errors: ReadonlyArray<ProcurementCaseError>;
  readonly warnings: ReadonlyArray<ProcurementCaseWarning>;
  readonly metadata: ProcurementCaseMetadata;
}

export interface CreateProcurementLotFailure {
  readonly success: false;
  readonly procurementLot: null;
  readonly errors: ReadonlyArray<ProcurementCaseError>;
  readonly warnings: ReadonlyArray<ProcurementCaseWarning>;
  readonly metadata: ProcurementCaseMetadata;
}

export type CreateProcurementLotResult = CreateProcurementLotSuccess | CreateProcurementLotFailure;

export interface CreateWholeCaseScopeInput {
  readonly procurementCase: ProcurementCase;
}

export interface CreateLotScopeInput {
  readonly procurementCase: ProcurementCase;
  readonly procurementLot: ProcurementLot;
}

export interface CreateProcurementScopeSuccess {
  readonly success: true;
  readonly scope: ProcurementScope;
  readonly errors: ReadonlyArray<ProcurementCaseError>;
  readonly warnings: ReadonlyArray<ProcurementCaseWarning>;
  readonly metadata: ProcurementCaseMetadata;
}

export interface CreateProcurementScopeFailure {
  readonly success: false;
  readonly scope: null;
  readonly errors: ReadonlyArray<ProcurementCaseError>;
  readonly warnings: ReadonlyArray<ProcurementCaseWarning>;
  readonly metadata: ProcurementCaseMetadata;
}

export type CreateProcurementScopeResult = CreateProcurementScopeSuccess | CreateProcurementScopeFailure;
