import {
  bulkConfirmBudgetReviewRows,
  confirmBudgetReviewRow,
  consolidateBudgetReviewSession,
  correctBudgetReviewRow,
  createBudgetReviewSession,
  excludeBudgetReviewRow,
  importBudgetReviewRows,
  insertManualBudgetReviewRow,
  restoreBudgetReviewRow,
} from "../../domain/budget-official-review";
import type { BudgetReviewAuditEvent, BudgetReviewRow, BudgetReviewSession } from "../../domain/budget-official-review";
import type { ApplicationContext } from "./application-context";
import { toInfrastructureErrorMessage } from "./application-context";
import type { AuditEventToPersist, BudgetReviewRepository } from "./budget-review.repository";
import type {
  BudgetReviewServiceResult,
  BulkConfirmBudgetReviewRowsCommand,
  ConfirmBudgetReviewRowCommand,
  ConsolidateBudgetReviewSessionCommand,
  CorrectBudgetReviewRowCommand,
  CreateBudgetReviewSessionCommand,
  ExcludeBudgetReviewRowCommand,
  GetBudgetReviewSessionQuery,
  GetBudgetReviewSessionResult,
  ImportBudgetReviewRowsCommand,
  InsertManualBudgetReviewRowCommand,
  RestoreBudgetReviewRowCommand,
} from "./budget-review-service.types";

function nowIso(): string {
  return new Date().toISOString();
}

/** Cria a Sessão de Revisão — a idempotência física (mesma sha256+mecanismo) é responsabilidade do repositório (findSessionByAcquisition), sempre consultada antes por quem chama este serviço. */
export async function createBudgetReviewSessionService(
  context: ApplicationContext,
  command: CreateBudgetReviewSessionCommand,
  repository: BudgetReviewRepository,
): Promise<BudgetReviewServiceResult> {
  const domainResult = createBudgetReviewSession({
    id: command.id,
    procurementCase: command.procurementCase,
    budgetVersion: command.budgetVersion,
    documentVersion: command.documentVersion,
    sourceSha256: command.sourceSha256,
    acquisitionMechanism: command.acquisitionMechanism,
    acquisitionMechanismVersion: command.acquisitionMechanismVersion,
    createdBy: context.actor,
    createdAt: nowIso(),
  });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  try {
    await repository.createSession(context.organizationId, context.actor, domainResult.session);
    const persisted = await repository.loadSession(context.organizationId, domainResult.session.id);
    if (persisted === null) {
      return { outcome: "persistence_failure", message: "Session created but could not be reloaded." };
    }
    return { outcome: "success", session: persisted };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

/** Importa um lote de Linhas — valida tudo de uma vez no domínio puro, depois persiste em uma única chamada em lote ao repositório. */
export async function importBudgetReviewRowsService(
  context: ApplicationContext,
  command: ImportBudgetReviewRowsCommand,
  repository: BudgetReviewRepository,
): Promise<BudgetReviewServiceResult> {
  const loaded = await repository.loadSession(context.organizationId, command.sessionId);
  if (loaded === null) {
    return { outcome: "not_found" };
  }

  const occurredAt = nowIso();
  const domainResult = importBudgetReviewRows({ session: loaded, rows: command.rows, actor: context.actor, occurredAt });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  const newRows = domainResult.session.rows.filter((row) => !loaded.rows.some((existing) => existing.id === row.id));

  try {
    await repository.importRows(context.organizationId, context.actor, command.sessionId, newRows, occurredAt);
    return { outcome: "success", session: domainResult.session };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

async function persistSingleRowMutation(
  context: ApplicationContext,
  repository: BudgetReviewRepository,
  session: BudgetReviewSession,
  row: BudgetReviewRow,
  isNewRow: boolean,
  auditEvent: AuditEventToPersist | null,
): Promise<BudgetReviewServiceResult> {
  try {
    await repository.mutateRow(context.organizationId, context.actor, session, row, isNewRow, auditEvent);
    return { outcome: "success", session };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

function findRow(session: BudgetReviewSession, rowId: string): BudgetReviewRow | undefined {
  return session.rows.find((row) => row.id === rowId);
}

export async function confirmBudgetReviewRowService(
  context: ApplicationContext,
  command: ConfirmBudgetReviewRowCommand,
  repository: BudgetReviewRepository,
): Promise<BudgetReviewServiceResult> {
  const loaded = await repository.loadSession(context.organizationId, command.sessionId);
  if (loaded === null) return { outcome: "not_found" };

  const occurredAt = nowIso();
  const domainResult = confirmBudgetReviewRow({ session: loaded, rowId: command.rowId, actor: context.actor, occurredAt });
  if (!domainResult.success) return { outcome: "domain_error", errors: domainResult.errors };

  const updatedRow = findRow(domainResult.session, command.rowId);
  if (updatedRow === undefined || domainResult.auditEvents.length === 0) {
    // no-op (linha já estava Confirmada) — nada para persistir.
    return { outcome: "success", session: domainResult.session };
  }

  return persistSingleRowMutation(context, repository, domainResult.session, updatedRow, false, toAuditPersist(domainResult.auditEvents[0]!));
}

export async function correctBudgetReviewRowService(
  context: ApplicationContext,
  command: CorrectBudgetReviewRowCommand,
  repository: BudgetReviewRepository,
): Promise<BudgetReviewServiceResult> {
  const loaded = await repository.loadSession(context.organizationId, command.sessionId);
  if (loaded === null) return { outcome: "not_found" };

  const occurredAt = nowIso();
  const domainResult = correctBudgetReviewRow({
    session: loaded,
    rowId: command.rowId,
    fields: command.fields,
    justification: command.justification,
    actor: context.actor,
    occurredAt,
  });
  if (!domainResult.success) return { outcome: "domain_error", errors: domainResult.errors };

  const updatedRow = findRow(domainResult.session, command.rowId)!;
  return persistSingleRowMutation(context, repository, domainResult.session, updatedRow, false, toAuditPersist(domainResult.auditEvents[0]!));
}

export async function excludeBudgetReviewRowService(
  context: ApplicationContext,
  command: ExcludeBudgetReviewRowCommand,
  repository: BudgetReviewRepository,
): Promise<BudgetReviewServiceResult> {
  const loaded = await repository.loadSession(context.organizationId, command.sessionId);
  if (loaded === null) return { outcome: "not_found" };

  const occurredAt = nowIso();
  const domainResult = excludeBudgetReviewRow({ session: loaded, rowId: command.rowId, justification: command.justification, actor: context.actor, occurredAt });
  if (!domainResult.success) return { outcome: "domain_error", errors: domainResult.errors };

  const updatedRow = findRow(domainResult.session, command.rowId)!;
  return persistSingleRowMutation(context, repository, domainResult.session, updatedRow, false, toAuditPersist(domainResult.auditEvents[0]!));
}

export async function restoreBudgetReviewRowService(
  context: ApplicationContext,
  command: RestoreBudgetReviewRowCommand,
  repository: BudgetReviewRepository,
): Promise<BudgetReviewServiceResult> {
  const loaded = await repository.loadSession(context.organizationId, command.sessionId);
  if (loaded === null) return { outcome: "not_found" };

  const occurredAt = nowIso();
  const domainResult = restoreBudgetReviewRow({ session: loaded, rowId: command.rowId, actor: context.actor, occurredAt });
  if (!domainResult.success) return { outcome: "domain_error", errors: domainResult.errors };

  const updatedRow = findRow(domainResult.session, command.rowId)!;
  return persistSingleRowMutation(context, repository, domainResult.session, updatedRow, false, toAuditPersist(domainResult.auditEvents[0]!));
}

export async function insertManualBudgetReviewRowService(
  context: ApplicationContext,
  command: InsertManualBudgetReviewRowCommand,
  repository: BudgetReviewRepository,
): Promise<BudgetReviewServiceResult> {
  const loaded = await repository.loadSession(context.organizationId, command.sessionId);
  if (loaded === null) return { outcome: "not_found" };

  const occurredAt = nowIso();
  const domainResult = insertManualBudgetReviewRow({
    session: loaded,
    id: command.id,
    kind: command.kind,
    lotReference: command.lotReference,
    parentRowId: command.parentRowId,
    position: command.position,
    fields: command.fields,
    page: command.page,
    justification: command.justification,
    actor: context.actor,
    occurredAt,
  });
  if (!domainResult.success) return { outcome: "domain_error", errors: domainResult.errors };

  const newRow = findRow(domainResult.session, command.id)!;
  return persistSingleRowMutation(context, repository, domainResult.session, newRow, true, toAuditPersist(domainResult.auditEvents[0]!));
}

/** Confirma em lote — persiste cada linha confirmada individualmente (mesma disciplina de auditoria por linha), reaproveitando o único evento BulkConfirmed do domínio replicado por linha para rastreabilidade uniforme. */
export async function bulkConfirmBudgetReviewRowsService(
  context: ApplicationContext,
  command: BulkConfirmBudgetReviewRowsCommand,
  repository: BudgetReviewRepository,
): Promise<BudgetReviewServiceResult> {
  const loaded = await repository.loadSession(context.organizationId, command.sessionId);
  if (loaded === null) return { outcome: "not_found" };

  const occurredAt = nowIso();
  const domainResult = bulkConfirmBudgetReviewRows({ session: loaded, rowIds: command.rowIds, actor: context.actor, occurredAt });
  if (!domainResult.success) return { outcome: "domain_error", errors: domainResult.errors };

  const bulkEvent = domainResult.auditEvents[0];
  if (bulkEvent === undefined) {
    return { outcome: "success", session: domainResult.session };
  }

  const confirmedRowIds = new Set((bulkEvent.metadata.confirmedRowIds as ReadonlyArray<string> | undefined) ?? []);

  try {
    for (const rowId of confirmedRowIds) {
      const row = findRow(domainResult.session, rowId)!;
      const rowAuditEvent: AuditEventToPersist = {
        id: `${bulkEvent.id}:${rowId}`,
        action: bulkEvent.action,
        actor: bulkEvent.actor,
        occurredAt: bulkEvent.occurredAt,
        fieldChanges: [],
        justification: null,
        metadata: { bulkEventId: bulkEvent.id },
      };
      await repository.mutateRow(context.organizationId, context.actor, domainResult.session, row, false, rowAuditEvent);
    }
    return { outcome: "success", session: domainResult.session };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

export async function consolidateBudgetReviewSessionService(
  context: ApplicationContext,
  command: ConsolidateBudgetReviewSessionCommand,
  repository: BudgetReviewRepository,
): Promise<BudgetReviewServiceResult> {
  const loaded = await repository.loadSession(context.organizationId, command.sessionId);
  if (loaded === null) return { outcome: "not_found" };

  const occurredAt = nowIso();
  const domainResult = consolidateBudgetReviewSession({ session: loaded, actor: context.actor, occurredAt });
  if (!domainResult.success) return { outcome: "domain_error", errors: domainResult.errors };

  if (domainResult.auditEvents.length === 0) {
    // no-op (já estava Consolidated).
    return { outcome: "success", session: domainResult.session };
  }

  try {
    await repository.consolidateSession(context.organizationId, context.actor, command.sessionId, domainResult.auditEvents[0]!.id);
    return { outcome: "success", session: domainResult.session };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

export async function getBudgetReviewSessionService(
  context: ApplicationContext,
  query: GetBudgetReviewSessionQuery,
  repository: BudgetReviewRepository,
): Promise<GetBudgetReviewSessionResult> {
  const loaded = await repository.loadSession(context.organizationId, query.sessionId);
  if (loaded === null) return { outcome: "not_found" };
  return { outcome: "found", session: loaded };
}

function toAuditPersist(event: BudgetReviewAuditEvent): AuditEventToPersist {
  return {
    id: event.id,
    action: event.action,
    actor: event.actor,
    occurredAt: event.occurredAt,
    fieldChanges: event.fieldChanges,
    justification: event.justification,
    metadata: event.metadata,
  };
}
