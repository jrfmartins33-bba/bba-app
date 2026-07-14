import type { ProcurementCase, ProcurementCaseId, ProcurementLot, ProcurementScope } from "../procurement-case";
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
 * ADR-004). Documenta formalmente a origem já declarada na Versão do
 * Orçamento (`BudgetVersion.origin`) — origem e Relação de Rastreabilidade
 * são conceitos distintos: a origem é sempre declarada na criação; a
 * Relação que a documenta pode ser registrada na criação ou depois,
 * enquanto em rascunho, e nunca é substituída (registrar uma segunda vez é
 * erro, não sobrescrita). Esta Sprint usa uma única natureza (`Origin`) — a
 * representação completa e as demais naturezas permanecem abertas para
 * Sprints futuras.
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
 * Descrição de uma Linha do Orçamento — união discriminada que diferencia
 * explicitamente descrição confirmada na fonte de descrição ausente na
 * fonte. O domínio nunca produz um rótulo de apresentação para o estado
 * ausente; um eventual rótulo visual pertence a uma futura camada de
 * apresentação, fora desta Sprint.
 */
export type BudgetLineDescription =
  | { readonly status: "Confirmed"; readonly text: string }
  | { readonly status: "AbsentFromSource" };

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
  readonly description: BudgetLineDescription;
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
 *
 * `origin` é sempre declarada na criação. `originLineage` — a Relação de
 * Rastreabilidade que documenta formalmente essa origem — pode estar
 * ausente (`null`) inicialmente e ser registrada depois, enquanto em
 * rascunho, via `registerLineageRelation`; uma vez registrada, nunca é
 * substituída nesta Sprint.
 */
export interface BudgetVersion {
  readonly id: BudgetVersionId;
  readonly organizationId: BudgetOrganizationId;
  readonly procurementCaseId: ProcurementCaseId;
  readonly scope: ProcurementScope;
  readonly origin: BudgetVersionOrigin;
  readonly status: BudgetVersionStatus;
  readonly originLineage: LineageRelation | null;
  readonly lines: ReadonlyArray<BudgetLine>;
  readonly metadata: BudgetVersionMetadata;
}

/**
 * `procurementCase` é o contexto validado do domínio de Licitação e
 * Contratação — `organizationId` e `procurementCaseId` da Versão são
 * sempre derivados dele, nunca aceitos como fatos independentes que
 * poderiam divergir. Quando `scope` for de lote, `procurementLot` é
 * obrigatório, e seus fatos (organização, Processo, identidade) são
 * confrontados contra `procurementCase` e `scope` — a existência de um
 * `ProcurementLot` real é a prova contra Escopo de lote fabricado.
 *
 * `originLineageId`, quando fornecido, registra imediatamente a Relação de
 * Rastreabilidade de origem na criação; quando omitido, a Versão nasce sem
 * Relação de Rastreabilidade registrada (`originLineage: null`), a ser
 * registrada depois via `registerLineageRelation`.
 *
 * `correlationId`, `createdBy` e `sourceSystem` são precedentes técnicos a
 * avaliar (mapa §L), não um contrato obrigatório já aprovado — por isso são
 * opcionais aqui; quando ausentes, simplesmente não entram em `metadata`.
 */
export interface CreateBudgetVersionInput {
  readonly id: BudgetVersionId;
  readonly procurementCase: ProcurementCase;
  readonly procurementLot?: ProcurementLot;
  readonly scope: ProcurementScope;
  readonly origin: BudgetVersionOrigin;
  readonly originLineageId?: string;
  readonly correlationId?: BudgetCorrelationId;
  readonly createdBy?: BudgetCreatedBy;
  readonly sourceSystem?: BudgetSourceSystem;
  readonly metadata?: BudgetVersionMetadata;
}

/**
 * `procurementLot` é obrigatório quando `scope` for de lote — mesma prova
 * contra Escopo de lote fabricado exigida na criação da Versão.
 */
export interface AddBudgetLineInput {
  readonly budgetVersion: BudgetVersion;
  readonly id: BudgetLineId;
  readonly kind: BudgetLineKind;
  readonly description: BudgetLineDescription;
  readonly externalCode?: string | null;
  readonly parentLineId?: BudgetLineId | null;
  readonly position: BudgetLinePosition;
  readonly scope: ProcurementScope;
  readonly procurementLot?: ProcurementLot;
  readonly totalCents?: MoneyCents | null;
  readonly metadata?: BudgetVersionMetadata;
}

/**
 * Alteração controlada de campos de uma Linha já existente — somente em
 * rascunho. `procurementLot` é exigido quando `scope` for alterado para um
 * Escopo de lote, com a mesma prova exigida em `addBudgetLine`.
 */
export interface UpdateBudgetLineInput {
  readonly budgetVersion: BudgetVersion;
  readonly lineId: BudgetLineId;
  readonly description?: BudgetLineDescription;
  readonly externalCode?: string | null;
  readonly scope?: ProcurementScope;
  readonly procurementLot?: ProcurementLot;
  readonly totalCents?: MoneyCents | null;
}

/** Remoção controlada de uma Linha sem filhos — somente em rascunho. */
export interface RemoveBudgetLineInput {
  readonly budgetVersion: BudgetVersion;
  readonly lineId: BudgetLineId;
}

export interface UpdateBudgetLinePositionInput {
  readonly budgetVersion: BudgetVersion;
  readonly lineId: BudgetLineId;
  readonly position: BudgetLinePosition;
}

export interface ConsolidateBudgetVersionInput {
  readonly budgetVersion: BudgetVersion;
}

/**
 * Registro posterior (uma única vez) da Relação de Rastreabilidade de
 * origem da Versão do Orçamento — mapa §13: "pode ser declarada na criação
 * ou registrada posteriormente enquanto a versão estiver em rascunho, se
 * houver evidência suficiente". Usa sempre a origem já declarada em
 * `budgetVersion.origin` — não aceita uma origem independente. `id` é a
 * identidade própria, opaca e não vazia da Relação. Registrar uma segunda
 * vez, quando já existir uma, é erro — nunca sobrescrita.
 */
export interface RegisterLineageRelationInput {
  readonly budgetVersion: BudgetVersion;
  readonly id: string;
}

export type BudgetVersionErrorCode =
  | "missing_id"
  | "missing_organization_id"
  | "missing_procurement_case_id"
  | "scope_case_mismatch"
  | "malformed_scope"
  | "missing_procurement_lot"
  | "lot_organization_mismatch"
  | "lot_case_mismatch"
  | "scope_lot_mismatch"
  | "invalid_origin_reference"
  | "consolidated_version_immutable"
  | "missing_description"
  | "duplicate_line_id"
  | "invalid_position"
  | "duplicate_position"
  | "missing_parent_line"
  | "parent_from_another_version"
  | "self_parent"
  | "incompatible_parent_kind"
  | "line_scope_incompatible"
  | "child_scope_incompatible_with_parent"
  | "invalid_total_cents"
  | "unknown_line"
  | "line_has_children"
  | "missing_lineage_relation_id"
  | "origin_lineage_already_registered";

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
