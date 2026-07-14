import {
  BudgetLineKind,
  BudgetVersionOriginKind,
  BudgetVersionStatus,
  LineageRelationNature,
  ProcurementScopeKind,
  isValidMoneyCents,
} from "@bba/bdos-core/services/procurement-engineering";
import type {
  BudgetLine,
  BudgetLineDescription,
  BudgetVersion,
  BudgetVersionOrigin,
  LineageRelation,
  MoneyCents,
  ProcurementCase,
  ProcurementLot,
  ProcurementScope,
} from "@bba/bdos-core/services/procurement-engineering";
import type { PersistedEntity } from "@bba/bdos-core/services/procurement-engineering";

// Mapeadores explícitos banco <-> domínio (Sprint 21.3C, seção 17).
// `organizationId` (domínio) <-> `company_id` (banco) é sempre convertido
// aqui, nunca no domínio nem no SQL. Nenhum `as` é usado para forçar um
// tipo físico do banco a virar domínio sem validação — um registro
// inválido produz `ProcurementEngineeringReconstructionError`, nunca um
// objeto parcial.

export class ProcurementEngineeringReconstructionError extends Error {
  constructor(message: string) {
    super(`Invalid procurement engineering database row: ${message}`);
    this.name = "ProcurementEngineeringReconstructionError";
  }
}

export interface ProcurementCaseRow {
  readonly id: string;
  readonly company_id: string;
  readonly title: string;
  readonly external_reference: string | null;
  readonly metadata: Record<string, unknown> | null;
}

export interface ProcurementLotRow {
  readonly id: string;
  readonly company_id: string;
  readonly procurement_case_id: string;
  readonly title: string;
  readonly external_reference: string | null;
  readonly metadata: Record<string, unknown> | null;
}

export interface BudgetVersionRow {
  readonly id: string;
  readonly company_id: string;
  readonly procurement_case_id: string;
  readonly scope_kind: string;
  readonly procurement_lot_id: string | null;
  readonly origin_kind: string;
  readonly origin_reference: string | null;
  readonly status: string;
  readonly revision: number;
  readonly metadata: Record<string, unknown> | null;
}

export interface BudgetLineRow {
  readonly id: string;
  readonly budget_version_id: string;
  readonly kind: string;
  readonly description_status: string;
  readonly description_text: string | null;
  readonly external_code: string | null;
  readonly parent_line_id: string | null;
  readonly position: number;
  readonly scope_kind: string;
  readonly scope_procurement_lot_id: string | null;
  readonly total_cents: string | number | null;
  readonly metadata: Record<string, unknown> | null;
}

export interface LineageRelationRow {
  readonly id: string;
  readonly budget_version_id: string;
  readonly nature: string;
  readonly origin_kind: string;
  readonly origin_reference: string | null;
}

// ---------------------------------------------------------------------------
// Banco -> domínio
// ---------------------------------------------------------------------------

export function mapProcurementCaseRow(row: ProcurementCaseRow): ProcurementCase {
  return {
    id: assertNonBlankString(row.id, "procurement_cases.id"),
    organizationId: assertNonBlankString(row.company_id, "procurement_cases.company_id"),
    title: assertNonBlankString(row.title, "procurement_cases.title"),
    externalReference: row.external_reference,
    metadata: row.metadata ?? {},
  };
}

export function mapProcurementLotRow(row: ProcurementLotRow): ProcurementLot {
  return {
    id: assertNonBlankString(row.id, "procurement_lots.id"),
    procurementCaseId: assertNonBlankString(row.procurement_case_id, "procurement_lots.procurement_case_id"),
    organizationId: assertNonBlankString(row.company_id, "procurement_lots.company_id"),
    title: assertNonBlankString(row.title, "procurement_lots.title"),
    externalReference: row.external_reference,
    metadata: row.metadata ?? {},
  };
}

/**
 * Reconstrói o agregado completo da Versão do Orçamento a partir das três
 * fontes físicas (linha principal, Linhas, Relação de Rastreabilidade
 * opcional). `originLineage.metadata` nunca é lido de uma coluna própria —
 * a tabela `budget_version_lineage_relations` deliberadamente não tem uma
 * (Bloco 8 da migração): o domínio (`registerLineageRelation`/
 * `createBudgetVersion`) sempre constrói `originLineage.metadata` como uma
 * cópia exata de `budgetVersion.metadata` no momento em que a Relação
 * nasce, e nenhuma operação desta Sprint altera `budgetVersion.metadata`
 * depois da criação — logo os dois permanecem estruturalmente idênticos, e
 * a reconstrução usa o `metadata` já reconstruído da própria Versão.
 */
export function mapBudgetVersionAggregate(
  versionRow: BudgetVersionRow,
  lineRows: ReadonlyArray<BudgetLineRow>,
  lineageRow: LineageRelationRow | null,
): PersistedEntity<BudgetVersion> {
  const organizationId = assertNonBlankString(versionRow.company_id, "budget_versions.company_id");
  const procurementCaseId = assertNonBlankString(versionRow.procurement_case_id, "budget_versions.procurement_case_id");
  const scope = mapScope(procurementCaseId, versionRow.scope_kind, versionRow.procurement_lot_id, "budget_versions");
  const metadata = versionRow.metadata ?? {};

  const entity: BudgetVersion = {
    id: assertNonBlankString(versionRow.id, "budget_versions.id"),
    organizationId,
    procurementCaseId,
    scope,
    origin: mapOrigin(versionRow.origin_kind, versionRow.origin_reference, "budget_versions"),
    status: mapBudgetVersionStatus(versionRow.status),
    originLineage: lineageRow === null ? null : mapLineageRelationRow(lineageRow, organizationId, metadata),
    lines: lineRows
      .slice()
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((row) => mapBudgetLineRow(row, procurementCaseId)),
    metadata,
  };

  return { entity, revision: assertRevision(versionRow.revision) };
}

function mapBudgetLineRow(row: BudgetLineRow, procurementCaseId: string): BudgetLine {
  const kind = mapBudgetLineKind(row.kind);
  const totalCents = parseMoneyCents(row.total_cents, "budget_lines.total_cents");

  if (kind === BudgetLineKind.ServiceItem && totalCents === null) {
    throw new ProcurementEngineeringReconstructionError(`budget_lines "${row.id}": kind "ServiceItem" requires a non-null total_cents.`);
  }

  if (kind !== BudgetLineKind.ServiceItem && totalCents !== null) {
    throw new ProcurementEngineeringReconstructionError(`budget_lines "${row.id}": Grupo/Subgrupo must never carry their own total_cents.`);
  }

  return {
    id: assertNonBlankString(row.id, "budget_lines.id"),
    budgetVersionId: assertNonBlankString(row.budget_version_id, "budget_lines.budget_version_id"),
    kind,
    description: mapLineDescription(row.description_status, row.description_text),
    externalCode: row.external_code,
    parentLineId: row.parent_line_id,
    position: assertNonNegativeInteger(row.position, "budget_lines.position"),
    scope: mapScope(procurementCaseId, row.scope_kind, row.scope_procurement_lot_id, "budget_lines"),
    totalCents,
    metadata: row.metadata ?? {},
  };
}

function mapLineageRelationRow(row: LineageRelationRow, organizationId: string, versionMetadata: Record<string, unknown>): LineageRelation {
  if (row.nature !== "Origin") {
    throw new ProcurementEngineeringReconstructionError(`budget_version_lineage_relations.nature "${row.nature}" is not "Origin".`);
  }

  return {
    id: assertNonBlankString(row.id, "budget_version_lineage_relations.id"),
    organizationId,
    nature: LineageRelationNature.Origin,
    origin: mapOrigin(row.origin_kind, row.origin_reference, "budget_version_lineage_relations"),
    destinationBudgetVersionId: assertNonBlankString(row.budget_version_id, "budget_version_lineage_relations.budget_version_id"),
    metadata: versionMetadata,
  };
}

function mapScope(procurementCaseId: string, scopeKind: string, procurementLotId: string | null, table: string): ProcurementScope {
  if (scopeKind === "WholeCase") {
    if (procurementLotId !== null) {
      throw new ProcurementEngineeringReconstructionError(`${table}: scope_kind "WholeCase" must have a null lot id.`);
    }
    return { kind: ProcurementScopeKind.WholeCase, procurementCaseId };
  }

  if (scopeKind === "Lot") {
    if (procurementLotId === null) {
      throw new ProcurementEngineeringReconstructionError(`${table}: scope_kind "Lot" requires a non-null lot id.`);
    }
    return { kind: ProcurementScopeKind.Lot, procurementCaseId, procurementLotId };
  }

  throw new ProcurementEngineeringReconstructionError(`${table}: unknown scope_kind "${scopeKind}".`);
}

function mapOrigin(originKind: string, originReference: string | null, table: string): BudgetVersionOrigin {
  if (originKind === "Native") {
    if (originReference !== null) {
      throw new ProcurementEngineeringReconstructionError(`${table}: origin_kind "Native" must have a null origin_reference.`);
    }
    return { kind: BudgetVersionOriginKind.Native };
  }

  if (originKind === "DocumentaryOpaqueReference") {
    if (originReference === null || originReference.trim().length === 0) {
      throw new ProcurementEngineeringReconstructionError(
        `${table}: origin_kind "DocumentaryOpaqueReference" requires a non-blank origin_reference.`,
      );
    }
    return { kind: BudgetVersionOriginKind.DocumentaryOpaqueReference, reference: originReference };
  }

  throw new ProcurementEngineeringReconstructionError(`${table}: unknown origin_kind "${originKind}".`);
}

function mapBudgetLineKind(value: string): BudgetLineKind {
  if (value === "Group") return BudgetLineKind.Group;
  if (value === "Subgroup") return BudgetLineKind.Subgroup;
  if (value === "ServiceItem") return BudgetLineKind.ServiceItem;
  throw new ProcurementEngineeringReconstructionError(`budget_lines: unknown kind "${value}".`);
}

function mapBudgetVersionStatus(value: string): BudgetVersionStatus {
  if (value === "Draft") return BudgetVersionStatus.Draft;
  if (value === "Consolidated") return BudgetVersionStatus.Consolidated;
  throw new ProcurementEngineeringReconstructionError(`budget_versions: unknown status "${value}".`);
}

function mapLineDescription(status: string, text: string | null): BudgetLineDescription {
  if (status === "Confirmed") {
    if (text === null || text.trim().length === 0) {
      throw new ProcurementEngineeringReconstructionError('budget_lines: description_status "Confirmed" requires non-blank description_text.');
    }
    return { status: "Confirmed", text };
  }

  if (status === "AbsentFromSource") {
    if (text !== null) {
      throw new ProcurementEngineeringReconstructionError('budget_lines: description_status "AbsentFromSource" must have a null description_text.');
    }
    return { status: "AbsentFromSource" };
  }

  throw new ProcurementEngineeringReconstructionError(`budget_lines: unknown description_status "${status}".`);
}

/**
 * `bigint`/`int8` do Postgres pode voltar do cliente como texto — nunca
 * convertido por ponto flutuante (seção 12 da instrução). Rejeita qualquer
 * valor fora do intervalo seguro aceito pelo domínio.
 */
function parseMoneyCents(value: string | number | null, field: string): MoneyCents | null {
  if (value === null) {
    return null;
  }

  const numeric = typeof value === "string" ? Number(value) : value;

  if (!isValidMoneyCents(numeric)) {
    throw new ProcurementEngineeringReconstructionError(`${field} "${String(value)}" is not a valid non-negative safe integer.`);
  }

  return numeric;
}

function assertNonBlankString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProcurementEngineeringReconstructionError(`${field} must be a non-blank string, got ${JSON.stringify(value)}.`);
  }
  return value;
}

function assertNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new ProcurementEngineeringReconstructionError(`${field} must be a non-negative safe integer, got ${JSON.stringify(value)}.`);
  }
  return value;
}

function assertRevision(value: unknown): number {
  return assertNonNegativeInteger(value, "budget_versions.revision");
}

// ---------------------------------------------------------------------------
// Domínio -> banco
// ---------------------------------------------------------------------------

function readOptionalMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

export function procurementCaseInsertRow(organizationId: string, procurementCase: ProcurementCase): Record<string, unknown> {
  return {
    id: procurementCase.id,
    company_id: organizationId,
    title: procurementCase.title,
    external_reference: procurementCase.externalReference,
    metadata: procurementCase.metadata,
    correlation_id: readOptionalMetadataString(procurementCase.metadata, "correlationId"),
    created_by: readOptionalMetadataString(procurementCase.metadata, "createdBy"),
    source_system: readOptionalMetadataString(procurementCase.metadata, "sourceSystem"),
  };
}

export function procurementLotInsertRow(organizationId: string, procurementLot: ProcurementLot): Record<string, unknown> {
  return {
    id: procurementLot.id,
    company_id: organizationId,
    procurement_case_id: procurementLot.procurementCaseId,
    title: procurementLot.title,
    external_reference: procurementLot.externalReference,
    metadata: procurementLot.metadata,
    correlation_id: readOptionalMetadataString(procurementLot.metadata, "correlationId"),
    created_by: readOptionalMetadataString(procurementLot.metadata, "createdBy"),
    source_system: readOptionalMetadataString(procurementLot.metadata, "sourceSystem"),
  };
}

function originReferenceOf(origin: BudgetVersionOrigin): string | null {
  return origin.kind === BudgetVersionOriginKind.DocumentaryOpaqueReference ? origin.reference : null;
}

function lotIdOfScope(scope: ProcurementScope): string | null {
  return scope.kind === ProcurementScopeKind.Lot ? scope.procurementLotId : null;
}

/** Parâmetros RPC de `create_budget_version_draft` (Bloco 10 da migração). */
export function budgetVersionDraftRpcParams(organizationId: string, budgetVersion: BudgetVersion): Record<string, unknown> {
  return {
    p_company_id: organizationId,
    p_id: budgetVersion.id,
    p_procurement_case_id: budgetVersion.procurementCaseId,
    p_scope_kind: budgetVersion.scope.kind,
    p_procurement_lot_id: lotIdOfScope(budgetVersion.scope),
    p_origin_kind: budgetVersion.origin.kind,
    p_origin_reference: originReferenceOf(budgetVersion.origin),
    p_metadata: budgetVersion.metadata,
    p_correlation_id: readOptionalMetadataString(budgetVersion.metadata, "correlationId"),
    p_created_by: readOptionalMetadataString(budgetVersion.metadata, "createdBy"),
    p_source_system: readOptionalMetadataString(budgetVersion.metadata, "sourceSystem"),
    p_lineage_id: budgetVersion.originLineage?.id ?? null,
    p_lineage_origin_kind: budgetVersion.originLineage?.origin.kind ?? null,
    p_lineage_origin_reference: budgetVersion.originLineage ? originReferenceOf(budgetVersion.originLineage.origin) : null,
  };
}

function lineToJsonPayload(line: BudgetLine): Record<string, unknown> {
  return {
    id: line.id,
    kind: line.kind,
    descriptionStatus: line.description.status,
    descriptionText: line.description.status === "Confirmed" ? line.description.text : null,
    externalCode: line.externalCode,
    parentLineId: line.parentLineId,
    position: line.position,
    scopeKind: line.scope.kind,
    scopeProcurementLotId: lotIdOfScope(line.scope),
    totalCents: line.totalCents,
    metadata: line.metadata,
  };
}

/** Parâmetros RPC de `persist_budget_version_snapshot` (Bloco 11 da migração). */
export function budgetVersionSnapshotRpcParams(
  organizationId: string,
  budgetVersion: BudgetVersion,
  expectedRevision: number,
): Record<string, unknown> {
  return {
    p_company_id: organizationId,
    p_budget_version_id: budgetVersion.id,
    p_expected_revision: expectedRevision,
    p_status: budgetVersion.status,
    p_lines: budgetVersion.lines.map(lineToJsonPayload),
    p_lineage_id: budgetVersion.originLineage?.id ?? null,
    p_lineage_origin_kind: budgetVersion.originLineage?.origin.kind ?? null,
    p_lineage_origin_reference: budgetVersion.originLineage ? originReferenceOf(budgetVersion.originLineage.origin) : null,
  };
}
