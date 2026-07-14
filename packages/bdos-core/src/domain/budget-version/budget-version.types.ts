import type { ProcurementCaseId, ProcurementScope } from "../procurement-case";
import type { MoneyCents } from "./budget-version-money";

export type BudgetVersionMetadata = Readonly<Record<string, unknown>>;

export type BudgetVersionId = string;

export type BudgetLineId = string;

export type BudgetOrganizationId = string;

export type BudgetLinePosition = number;

export type BudgetCorrelationId = string;

export type BudgetCreatedBy = string;

export type BudgetSourceSystem = string;

export enum BudgetVersionStatus {
  Draft = "Draft",
  Consolidated = "Consolidated",
}

/**
 * Origem da Versão do Orçamento (ADR-003 §F.1). Apenas dois caminhos nesta
 * Sprint: nativo (criado diretamente no BDOS) ou referência documental
 * opaca (aponta para uma evidência já existente, sem decidir
 * `DocumentArtifact`/`DocumentVersion`, sem processar o documento, sem
 * criar dependência com `document-reconstruction`). Origem por
 * Transformação Orçamentária pertence a uma Sprint futura.
 */
export enum BudgetVersionOriginKind {
  Native = "Native",
  DocumentaryOpaqueReference = "DocumentaryOpaqueReference",
}

export type BudgetVersionOrigin =
  | { readonly kind: BudgetVersionOriginKind.Native }
  | { readonly kind: BudgetVersionOriginKind.DocumentaryOpaqueReference; readonly reference: string };

/**
 * Relação de Rastreabilidade mínima (`LineageRelation`, ADR-001 §G.6 /
 * ADR-004). Preserva origem, destino, natureza da relação e organização
 * usuária. Esta Sprint usa uma única natureza (`Origin`: origem da Versão do
 * Orçamento) — a representação completa e as demais naturezas permanecem
 * abertas para Sprints futuras.
 */
export enum LineageRelationNature {
  Origin = "Origin",
}

export interface LineageRelation {
  readonly id: string;
  readonly organizationId: BudgetOrganizationId;
  readonly nature: LineageRelationNature;
  readonly origin: BudgetVersionOrigin;
  readonly destinationBudgetVersionId: BudgetVersionId;
  readonly metadata: BudgetVersionMetadata;
}

export enum BudgetLineKind {
  Group = "Group",
  Subgroup = "Subgroup",
  ServiceItem = "ServiceItem",
}

/**
 * Linha do Orçamento (`BudgetLine`, ADR-001 §G.2). As três classificações
 * (Grupo/Subgrupo/Item de Serviço) pertencem à mesma família — não possuem
 * identidades ou sistemas de código independentes. `externalCode` é sempre
 * opcional e nunca é identidade (o caso real `COT-015` é um Item de Serviço
 * sem código hierárquico que ainda assim participa dos totais).
 * `totalCents` só é significativo em `ServiceItem` — Grupo e Subgrupo têm
 * total sempre derivado dos descendentes (nunca somado como parcela própria).
 */
export interface BudgetLine {
  readonly id: BudgetLineId;
  readonly budgetVersionId: BudgetVersionId;
  readonly kind: BudgetLineKind;
  readonly description: string;
  readonly externalCode: string | null;
  readonly parentLineId: BudgetLineId | null;
  readonly position: BudgetLinePosition;
  readonly scope: ProcurementScope;
  readonly totalCents: MoneyCents | null;
  readonly metadata: BudgetVersionMetadata;
}

/**
 * Versão do Orçamento (`BudgetVersion`, ADR-001 §G.2 / ADR-003). Nasce em
 * rascunho, referencia o Processo de Licitação e Contratação nesta primeira
 * fatia (ADR-003 — obrigatoriedade universal fora desta fatia permanece
 * aberta), e se torna imutável após a consolidação explícita.
 */
export interface BudgetVersion {
  readonly id: BudgetVersionId;
  readonly organizationId: BudgetOrganizationId;
  readonly procurementCaseId: ProcurementCaseId;
  readonly scope: ProcurementScope;
  readonly status: BudgetVersionStatus;
  readonly originLineage: LineageRelation;
  readonly lines: ReadonlyArray<BudgetLine>;
  readonly metadata: BudgetVersionMetadata;
}

export interface CreateBudgetVersionInput {
  readonly id: BudgetVersionId;
  readonly organizationId: BudgetOrganizationId;
  readonly procurementCaseId: ProcurementCaseId;
  readonly scope: ProcurementScope;
  readonly origin: BudgetVersionOrigin;
  readonly correlationId: BudgetCorrelationId;
  readonly createdBy: BudgetCreatedBy;
  readonly sourceSystem: BudgetSourceSystem;
  readonly metadata?: BudgetVersionMetadata;
}

export interface AddBudgetLineInput {
  readonly budgetVersion: BudgetVersion;
  readonly id: BudgetLineId;
  readonly kind: BudgetLineKind;
  readonly description: string;
  readonly externalCode?: string | null;
  readonly parentLineId?: BudgetLineId | null;
  readonly position: BudgetLinePosition;
  readonly scope: ProcurementScope;
  readonly totalCents?: MoneyCents | null;
  readonly metadata?: BudgetVersionMetadata;
}

export interface UpdateBudgetLinePositionInput {
  readonly budgetVersion: BudgetVersion;
  readonly lineId: BudgetLineId;
  readonly position: BudgetLinePosition;
}

export interface ConsolidateBudgetVersionInput {
  readonly budgetVersion: BudgetVersion;
}

export type BudgetVersionErrorCode =
  | "missing_organization_id"
  | "missing_procurement_case_id"
  | "invalid_origin_reference"
  | "consolidated_version_immutable"
  | "missing_description"
  | "duplicate_line_id"
  | "duplicate_position"
  | "missing_parent_line"
  | "parent_from_another_version"
  | "self_parent"
  | "incompatible_parent_kind"
  | "line_scope_incompatible"
  | "line_scope_organization_mismatch"
  | "invalid_total_cents"
  | "unknown_line";

export interface BudgetVersionError {
  readonly code: BudgetVersionErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: BudgetVersionMetadata;
}

export type BudgetVersionWarningCode = "none";

export interface BudgetVersionWarning {
  readonly code: BudgetVersionWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: BudgetVersionMetadata;
}

export interface BudgetVersionSuccess {
  readonly success: true;
  readonly budgetVersion: BudgetVersion;
  readonly errors: ReadonlyArray<BudgetVersionError>;
  readonly warnings: ReadonlyArray<BudgetVersionWarning>;
  readonly metadata: BudgetVersionMetadata;
}

export interface BudgetVersionFailure {
  readonly success: false;
  readonly budgetVersion: null;
  readonly errors: ReadonlyArray<BudgetVersionError>;
  readonly warnings: ReadonlyArray<BudgetVersionWarning>;
  readonly metadata: BudgetVersionMetadata;
}

export type BudgetVersionResult = BudgetVersionSuccess | BudgetVersionFailure;
