import {
  BudgetLineKind,
  BudgetReviewRowState,
  BudgetReviewSessionStatus,
} from "@bba/bdos-core/services/budget-official-review";
import type {
  BudgetReviewAuditAction,
  BudgetReviewFieldChange,
  BudgetReviewRow,
  BudgetReviewRowFields,
  BudgetReviewSession,
} from "@bba/bdos-core/services/budget-official-review";

// Mapeadores explícitos banco <-> domínio (Epic 21.5A), mesma disciplina
// de procurement-engineering-mappers.ts: organizationId <-> company_id
// convertido só aqui; nenhum `as` força um registro inválido a virar
// domínio sem checagem.

export class BudgetReviewReconstructionError extends Error {
  constructor(message: string) {
    super(`Invalid budget review database row: ${message}`);
    this.name = "BudgetReviewReconstructionError";
  }
}

export interface BudgetReviewSessionRow {
  readonly id: string;
  readonly company_id: string;
  readonly procurement_case_id: string;
  readonly budget_version_id: string;
  readonly document_version_id: string;
  readonly source_sha256: string;
  readonly acquisition_mechanism: string;
  readonly acquisition_mechanism_version: string | null;
  readonly status: string;
  readonly metadata: Record<string, unknown> | null;
  readonly created_by: string | null;
  readonly created_at: string;
}

export interface BudgetReviewRowRow {
  readonly id: string;
  readonly company_id: string;
  readonly session_id: string;
  readonly kind: string;
  readonly lot_reference: string;
  readonly parent_row_id: string | null;
  readonly position: number;
  readonly state: string;
  readonly extracted: Record<string, unknown> | null;
  readonly revised: Record<string, unknown>;
  readonly page: number | null;
  readonly evidence_text: string | null;
  readonly justification: string | null;
  readonly inserted_manually: boolean;
  readonly metadata: Record<string, unknown> | null;
  readonly created_by: string | null;
  readonly created_at: string;
}

export function mapBudgetReviewSessionRow(row: BudgetReviewSessionRow, rows: ReadonlyArray<BudgetReviewRowRow>): BudgetReviewSession {
  return {
    id: assertNonBlankString(row.id, "budget_review_sessions.id"),
    organizationId: assertNonBlankString(row.company_id, "budget_review_sessions.company_id"),
    procurementCaseId: assertNonBlankString(row.procurement_case_id, "budget_review_sessions.procurement_case_id"),
    budgetVersionId: assertNonBlankString(row.budget_version_id, "budget_review_sessions.budget_version_id"),
    documentVersionId: assertNonBlankString(row.document_version_id, "budget_review_sessions.document_version_id"),
    sourceSha256: assertNonBlankString(row.source_sha256, "budget_review_sessions.source_sha256"),
    acquisitionMechanism: assertNonBlankString(row.acquisition_mechanism, "budget_review_sessions.acquisition_mechanism"),
    acquisitionMechanismVersion: row.acquisition_mechanism_version,
    status: mapSessionStatus(row.status),
    rows: rows
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(mapBudgetReviewRowRow),
    createdBy: row.created_by ?? "",
    createdAt: row.created_at,
    metadata: row.metadata ?? {},
  };
}

function mapBudgetReviewRowRow(row: BudgetReviewRowRow): BudgetReviewRow {
  const kind = mapKind(row.kind);
  const extracted = row.extracted === null ? null : mapFields(row.extracted, `budget_review_rows "${row.id}".extracted`);

  if (row.inserted_manually && extracted !== null) {
    throw new BudgetReviewReconstructionError(`budget_review_rows "${row.id}": inserted_manually rows must never have an extracted value.`);
  }

  return {
    id: assertNonBlankString(row.id, "budget_review_rows.id"),
    sessionId: assertNonBlankString(row.session_id, "budget_review_rows.session_id"),
    kind,
    lotReference: assertNonBlankString(row.lot_reference, "budget_review_rows.lot_reference"),
    parentRowId: row.parent_row_id,
    position: assertNonNegativeInteger(row.position, "budget_review_rows.position"),
    state: mapRowState(row.state),
    extracted,
    revised: mapFields(row.revised, `budget_review_rows "${row.id}".revised`),
    page: row.page,
    evidenceText: row.evidence_text,
    justification: row.justification,
    insertedManually: row.inserted_manually,
    createdBy: row.created_by ?? "",
    createdAt: row.created_at,
    metadata: row.metadata ?? {},
  };
}

function mapFields(value: Record<string, unknown>, field: string): BudgetReviewRowFields {
  const read = (key: string): string | null => {
    const raw = value[key];
    if (raw === undefined || raw === null) return null;
    if (typeof raw !== "string") throw new BudgetReviewReconstructionError(`${field}.${key} must be a string or null.`);
    return raw;
  };

  return {
    itemCode: read("itemCode"),
    description: read("description"),
    sourceCode: read("sourceCode"),
    sourceFonte: read("sourceFonte"),
    sourceTipo: read("sourceTipo"),
    unit: read("unit"),
    quantityText: read("quantityText"),
    unitCostWithoutBdiText: read("unitCostWithoutBdiText"),
    bdiPercentText: read("bdiPercentText"),
    unitPriceWithBdiText: read("unitPriceWithBdiText"),
    totalPriceText: read("totalPriceText"),
    colFgvDnit: read("colFgvDnit"),
    documentalGroupTotalText: read("documentalGroupTotalText"),
  };
}

function mapKind(value: string): BudgetLineKind {
  if (value === "Group") return BudgetLineKind.Group;
  if (value === "Subgroup") return BudgetLineKind.Subgroup;
  if (value === "ServiceItem") return BudgetLineKind.ServiceItem;
  throw new BudgetReviewReconstructionError(`budget_review_rows: unknown kind "${value}".`);
}

function mapRowState(value: string): BudgetReviewRowState {
  const found = Object.values(BudgetReviewRowState).find((candidate) => candidate === value);
  if (found === undefined) {
    throw new BudgetReviewReconstructionError(`budget_review_rows: unknown state "${value}".`);
  }
  return found;
}

function mapSessionStatus(value: string): BudgetReviewSessionStatus {
  if (value === "InProgress") return BudgetReviewSessionStatus.InProgress;
  if (value === "Consolidated") return BudgetReviewSessionStatus.Consolidated;
  throw new BudgetReviewReconstructionError(`budget_review_sessions: unknown status "${value}".`);
}

function assertNonBlankString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BudgetReviewReconstructionError(`${field} must be a non-blank string, got ${JSON.stringify(value)}.`);
  }
  return value;
}

function assertNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new BudgetReviewReconstructionError(`${field} must be a non-negative safe integer, got ${JSON.stringify(value)}.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Domínio -> banco (parâmetros RPC — funções exclusivas de servidor)
// ---------------------------------------------------------------------------

export function createBudgetReviewSessionRpcParams(
  organizationId: string,
  actor: string,
  session: BudgetReviewSession,
): Record<string, unknown> {
  return {
    p_actor_id: actor,
    p_company_id: organizationId,
    p_id: session.id,
    p_procurement_case_id: session.procurementCaseId,
    p_budget_version_id: session.budgetVersionId,
    p_document_version_id: session.documentVersionId,
    p_source_sha256: session.sourceSha256,
    p_acquisition_mechanism: session.acquisitionMechanism,
    p_acquisition_mechanism_version: session.acquisitionMechanismVersion,
    p_metadata: session.metadata,
  };
}

function fieldsToJson(fields: BudgetReviewRowFields): Record<string, unknown> {
  return { ...fields };
}

export interface RowMutationRpcInput {
  readonly isNewRow: boolean;
  readonly session: BudgetReviewSession;
  readonly row: BudgetReviewRow;
  readonly auditEventId: string | null;
  readonly auditAction: BudgetReviewAuditAction | null;
  readonly auditActor: string | null;
  readonly auditOccurredAt: string | null;
  readonly auditFieldChanges: ReadonlyArray<BudgetReviewFieldChange>;
  readonly auditJustification: string | null;
  readonly auditMetadata: Record<string, unknown>;
}

export function recordBudgetReviewRowMutationRpcParams(
  organizationId: string,
  actor: string,
  input: RowMutationRpcInput,
): Record<string, unknown> {
  const { row } = input;
  return {
    p_actor_id: actor,
    p_company_id: organizationId,
    p_row_id: row.id,
    p_is_new_row: input.isNewRow,
    p_session_id: input.session.id,
    p_kind: row.kind,
    p_lot_reference: row.lotReference,
    p_parent_row_id: row.parentRowId,
    p_position: row.position,
    p_state: row.state,
    p_extracted: row.extracted === null ? null : fieldsToJson(row.extracted),
    p_revised: fieldsToJson(row.revised),
    p_page: row.page,
    p_evidence_text: row.evidenceText,
    p_justification: row.justification,
    p_inserted_manually: row.insertedManually,
    p_row_metadata: row.metadata,
    p_audit_event_id: input.auditEventId,
    p_audit_action: input.auditAction,
    p_audit_actor: input.auditActor,
    p_audit_occurred_at: input.auditOccurredAt,
    p_audit_field_changes: input.auditFieldChanges,
    p_audit_justification: input.auditJustification,
    p_audit_metadata: input.auditMetadata,
  };
}

export function consolidateBudgetReviewSessionRpcParams(
  organizationId: string,
  actor: string,
  sessionId: string,
  auditEventId: string,
  auditMetadata: Record<string, unknown>,
): Record<string, unknown> {
  return {
    p_actor_id: actor,
    p_company_id: organizationId,
    p_session_id: sessionId,
    p_audit_event_id: auditEventId,
    p_audit_metadata: auditMetadata,
  };
}
