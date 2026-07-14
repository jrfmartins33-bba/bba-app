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

/**
 * Parâmetros RPC de `create_procurement_case` (correção de segurança —
 * substitui o INSERT direto de `procurement_cases`, que a migração
 * `20260714000002_..._write_boundary.sql` revogou de `authenticated`).
 */
export function procurementCaseCreateRpcParams(organizationId: string, procurementCase: ProcurementCase): Record<string, unknown> {
  return {
    p_company_id: organizationId,
    p_id: procurementCase.id,
    p_title: procurementCase.title,
    p_external_reference: procurementCase.externalReference,
    p_metadata: procurementCase.metadata,
    p_correlation_id: readOptionalMetadataString(procurementCase.metadata, "correlationId"),
    p_created_by: readOptionalMetadataString(procurementCase.metadata, "createdBy"),
    p_source_system: readOptionalMetadataString(procurementCase.metadata, "sourceSystem"),
  };
}

/** Parâmetros RPC de `register_procurement_lot` — mesma razão de `procurementCaseCreateRpcParams`. */
export function procurementLotRegisterRpcParams(organizationId: string, procurementLot: ProcurementLot): Record<string, unknown> {
  return {
    p_company_id: organizationId,
    p_id: procurementLot.id,
    p_procurement_case_id: procurementLot.procurementCaseId,
    p_title: procurementLot.title,
    p_external_reference: procurementLot.externalReference,
    p_metadata: procurementLot.metadata,
    p_correlation_id: readOptionalMetadataString(procurementLot.metadata, "correlationId"),
    p_created_by: readOptionalMetadataString(procurementLot.metadata, "createdBy"),
    p_source_system: readOptionalMetadataString(procurementLot.metadata, "sourceSystem"),
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

/**
 * Ordena as Linhas topologicamente (pai sempre antes do filho) antes de
 * serializar para `p_lines` — correção de segurança: o gatilho de
 * integridade de `parent_line_id` (`enforce_budget_line_version_
 * consistency`) exige que o pai já exista no momento em que a linha
 * filha é inserida, e um único `INSERT ... SELECT` processa as linhas na
 * ordem do array de entrada. O domínio (Sprint 21.3B) já impede pai
 * ausente e ciclo antes de qualquer linha chegar aqui — esta função
 * ainda assim rejeita explicitamente as duas situações, para nunca
 * produzir uma carga inválida para o RPC caso essa garantia seja violada
 * por algum caminho futuro.
 */
function sortLinesTopologically(lines: ReadonlyArray<BudgetLine>): ReadonlyArray<BudgetLine> {
  const byId = new Map(lines.map((line) => [line.id, line]));

  lines.forEach((line) => {
    if (line.parentLineId !== null && !byId.has(line.parentLineId)) {
      throw new Error(`Cannot serialize budget lines: line "${line.id}" references a missing parent "${line.parentLineId}".`);
    }
  });

  const sorted: BudgetLine[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(line: BudgetLine): void {
    if (visited.has(line.id)) {
      return;
    }

    if (visiting.has(line.id)) {
      throw new Error(`Cannot serialize budget lines: cycle detected involving line "${line.id}".`);
    }

    visiting.add(line.id);

    if (line.parentLineId !== null) {
      const parent = byId.get(line.parentLineId);
      if (parent !== undefined) {
        visit(parent);
      }
    }

    visiting.delete(line.id);
    visited.add(line.id);
    sorted.push(line);
  }

  lines.forEach((line) => visit(line));

  if (sorted.length !== lines.length) {
    throw new Error("Cannot serialize budget lines: topological sort produced a different count than the input — structure is not a valid tree.");
  }

  return sorted;
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
    p_lines: sortLinesTopologically(budgetVersion.lines).map(lineToJsonPayload),
    p_lineage_id: budgetVersion.originLineage?.id ?? null,
    p_lineage_origin_kind: budgetVersion.originLineage?.origin.kind ?? null,
    p_lineage_origin_reference: budgetVersion.originLineage ? originReferenceOf(budgetVersion.originLineage.origin) : null,
  };
}
