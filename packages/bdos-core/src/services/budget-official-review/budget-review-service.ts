import {
  acceptBudgetReviewRowDivergenceAsDocumented,
  BudgetReviewSessionStatus,
  bulkAcceptBudgetReviewRowDivergencesAsDocumented,
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
import type { BudgetReviewAuditAction, BudgetReviewAuditEvent, BudgetReviewRow, BudgetReviewSession } from "../../domain/budget-official-review";
import { BudgetVersionStatus, consolidateBudgetVersion } from "../../domain/budget-version";
import type { BudgetVersion } from "../../domain/budget-version";
import type { BudgetVersionRepository, PersistedEntity } from "../procurement-engineering/budget-version.repository";
import { projectBudgetReviewSessionToBudgetVersion } from "./budget-review-projection";
import type { ApplicationContext } from "./application-context";
import { toInfrastructureErrorMessage } from "./application-context";
import type { AuditEventToPersist, BudgetReviewRepository } from "./budget-review.repository";
import type {
  AcceptBudgetReviewRowDivergenceCommand,
  BudgetReviewServiceResult,
  BulkAcceptBudgetReviewRowDivergencesCommand,
  BulkConfirmBudgetReviewRowsCommand,
  ConfirmBudgetReviewRowCommand,
  ConsolidateBudgetReviewSessionCommand,
  ConsolidateBudgetReviewSessionServiceResult,
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
    if (typeof repository.bulkMutateRows === "function") {
      const mutations = Array.from(confirmedRowIds).map((rowId) => {
        const row = findRow(domainResult.session, rowId)!;
        const rowAuditEvent: AuditEventToPersist = {
          id: `${bulkEvent.id}:${rowId}`,
          action: "BulkConfirmed" as BudgetReviewAuditAction,
          actor: bulkEvent.actor,
          occurredAt: bulkEvent.occurredAt,
          fieldChanges: [],
          justification: null,
          metadata: { bulkEventId: bulkEvent.id },
        };
        return {
          rowId: row.id,
          newState: row.state,
          revised: row.revised,
          justification: row.justification,
          evidenceText: row.evidenceText,
          auditEvent: rowAuditEvent,
        };
      });
      const mutatedCount = await repository.bulkMutateRows(context.organizationId, context.actor, command.sessionId, mutations);
      if (mutatedCount !== confirmedRowIds.size) {
        return { outcome: "persistence_failure", message: `Count mismatch: expected ${confirmedRowIds.size}, got ${mutatedCount}` };
      }
    } else {
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
    }
    return { outcome: "success", session: domainResult.session };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

/** Aceita uma divergência documental — nunca altera `revised`, apenas anexa a decisão e sua auditoria. */
export async function acceptBudgetReviewRowDivergenceService(
  context: ApplicationContext,
  command: AcceptBudgetReviewRowDivergenceCommand,
  repository: BudgetReviewRepository,
): Promise<BudgetReviewServiceResult> {
  const loaded = await repository.loadSession(context.organizationId, command.sessionId);
  if (loaded === null) return { outcome: "not_found" };

  const occurredAt = nowIso();
  const domainResult = acceptBudgetReviewRowDivergenceAsDocumented({
    session: loaded,
    rowId: command.rowId,
    justification: command.justification,
    actor: context.actor,
    occurredAt,
  });
  if (!domainResult.success) return { outcome: "domain_error", errors: domainResult.errors };

  const updatedRow = findRow(domainResult.session, command.rowId)!;
  return persistReconciliationDecision(context, repository, domainResult.session, updatedRow, toAuditPersist(domainResult.auditEvents[0]!));
}

/** Aceitação em lote — mesma justificativa para todo o lote, persistida linha a linha (mesma disciplina de bulkConfirmBudgetReviewRowsService). */
export async function bulkAcceptBudgetReviewRowDivergencesService(
  context: ApplicationContext,
  command: BulkAcceptBudgetReviewRowDivergencesCommand,
  repository: BudgetReviewRepository,
): Promise<BudgetReviewServiceResult> {
  const loaded = await repository.loadSession(context.organizationId, command.sessionId);
  if (loaded === null) return { outcome: "not_found" };

  const occurredAt = nowIso();
  const domainResult = bulkAcceptBudgetReviewRowDivergencesAsDocumented({
    session: loaded,
    rowIds: command.rowIds,
    justification: command.justification,
    actor: context.actor,
    occurredAt,
  });
  if (!domainResult.success) return { outcome: "domain_error", errors: domainResult.errors };

  const bulkEvent = domainResult.auditEvents[0];
  if (bulkEvent === undefined) {
    return { outcome: "success", session: domainResult.session };
  }

  const acceptedRowIds = new Set((bulkEvent.metadata.acceptedRowIds as ReadonlyArray<string> | undefined) ?? []);

  try {
    if (typeof repository.bulkRecordReconciliationDecisions === "function") {
      const decisions = Array.from(acceptedRowIds).map((rowId) => {
        const row = findRow(domainResult.session, rowId)!;
        const rowAuditEvent: AuditEventToPersist = {
          id: `${bulkEvent.id}:${rowId}`,
          action: "BulkReconciliationAcceptedAsDocumented" as BudgetReviewAuditAction,
          actor: bulkEvent.actor,
          occurredAt: bulkEvent.occurredAt,
          fieldChanges: [],
          justification: command.justification,
          metadata: { bulkEventId: bulkEvent.id },
        };
        return {
          rowId,
          status: "AcceptedAsDocumented" as const,
          justification: command.justification,
          decidedAt: occurredAt,
          auditEvent: rowAuditEvent,
        };
      });
      const decidedCount = await repository.bulkRecordReconciliationDecisions(
        context.organizationId,
        context.actor,
        command.sessionId,
        decisions,
      );
      if (decidedCount !== acceptedRowIds.size) {
        return { outcome: "persistence_failure", message: `Count mismatch: expected ${acceptedRowIds.size}, got ${decidedCount}` };
      }
    } else {
      for (const rowId of acceptedRowIds) {
        const row = findRow(domainResult.session, rowId)!;
        const rowAuditEvent: AuditEventToPersist = {
          id: `${bulkEvent.id}:${rowId}`,
          action: bulkEvent.action,
          actor: bulkEvent.actor,
          occurredAt: bulkEvent.occurredAt,
          fieldChanges: [],
          justification: bulkEvent.justification,
          metadata: { bulkEventId: bulkEvent.id },
        };
        await repository.recordReconciliationDecision(
          context.organizationId,
          context.actor,
          command.sessionId,
          rowId,
          row.reconciliationDecision!,
          rowAuditEvent,
        );
      }
    }
    return { outcome: "success", session: domainResult.session };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

async function persistReconciliationDecision(
  context: ApplicationContext,
  repository: BudgetReviewRepository,
  session: BudgetReviewSession,
  row: BudgetReviewRow,
  auditEvent: AuditEventToPersist,
): Promise<BudgetReviewServiceResult> {
  try {
    await repository.recordReconciliationDecision(context.organizationId, context.actor, session.id, row.id, row.reconciliationDecision!, auditEvent);
    return { outcome: "success", session };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

/**
 * Consolida a Sessão de Revisão E projeta suas linhas aprovadas para dentro
 * da BudgetVersion (Draft) já existente, consolidando-a também — fecha o
 * ciclo completo (correção §2/§5): Sessão revisada -> aprovação humana ->
 * BudgetVersion real -> Consolidated -> /orcamentos.
 *
 * Os dois agregados (BudgetReviewSession, BudgetVersion) nunca compartilham
 * uma única transação física — são dois RPCs distintos contra tabelas
 * diferentes. A ordem de escrita é sempre: 1) projetar+persistir a
 * BudgetVersion primeiro, 2) só then marcar a Sessão Consolidated — nunca o
 * inverso, para que uma falha no passo 1 nunca deixe a Sessão marcada como
 * concluída sem o orçamento real por trás dela. Mesmo assim, uma falha
 * exatamente entre os dois passos é possível (processo interrompido depois
 * do passo 1, antes do passo 2) — os três estados de reentrada abaixo
 * tratam essa janela explicitamente, nunca reprocessando silenciosamente
 * algo que já está correto, nunca deixando os dois agregados divergentes.
 */
export async function consolidateBudgetReviewSessionService(
  context: ApplicationContext,
  command: ConsolidateBudgetReviewSessionCommand,
  repository: BudgetReviewRepository,
  budgetVersionRepository: BudgetVersionRepository,
): Promise<ConsolidateBudgetReviewSessionServiceResult> {
  const loaded = await repository.loadSession(context.organizationId, command.sessionId);
  if (loaded === null) return { outcome: "not_found" };

  const loadedVersion = await budgetVersionRepository.loadBudgetVersion(context.organizationId, loaded.budgetVersionId);
  if (loadedVersion === null) {
    return { outcome: "persistence_failure", message: `Versão do Orçamento "${loaded.budgetVersionId}" referenced by this session was not found.` };
  }

  // Caso feliz já concluído em uma tentativa anterior — no-op puro, nunca
  // reprojeta, nunca regrava nada.
  if (loaded.status === BudgetReviewSessionStatus.Consolidated && loadedVersion.entity.status === BudgetVersionStatus.Consolidated) {
    return { outcome: "success", session: loaded };
  }

  // Recovery: a BudgetVersion já foi projetada e persistida Consolidated
  // numa tentativa anterior, mas o flip da Sessão falhou depois (a última
  // etapa do fluxo). Não reprojeta — a Versão já É o retrato final; só
  // fecha a Sessão. Ainda passa pelo domínio puro (nunca grava direto) —
  // se a readiness genuinamente não for mais válida (ex.: rows alteradas
  // entre tentativas), o erro de domínio é propagado, nunca engolido como
  // se fosse um no-op.
  if (loaded.status !== BudgetReviewSessionStatus.Consolidated && loadedVersion.entity.status === BudgetVersionStatus.Consolidated) {
    const recoveryOccurredAt = nowIso();
    const recoveryDomainResult = consolidateBudgetReviewSession({ session: loaded, actor: context.actor, occurredAt: recoveryOccurredAt });
    if (!recoveryDomainResult.success) return { outcome: "domain_error", errors: recoveryDomainResult.errors };
    return finalizeSessionConsolidation(context, repository, recoveryDomainResult.session, command.sessionId, recoveryDomainResult.auditEvents[0]!);
  }

  // Recovery: a Sessão já virou Consolidated numa tentativa anterior, mas a
  // persistência da BudgetVersion falhou antes de completar (a etapa
  // anterior ao flip). As linhas da Sessão já consolidada são imutáveis —
  // reprojeta e persiste agora, sem repetir o flip (já feito).
  if (loaded.status === BudgetReviewSessionStatus.Consolidated && loadedVersion.entity.status !== BudgetVersionStatus.Consolidated) {
    return projectAndPersistBudgetVersion(context, budgetVersionRepository, loaded, loadedVersion);
  }

  // Caminho normal: os dois agregados ainda em estado inicial.
  const occurredAt = nowIso();
  const domainResult = consolidateBudgetReviewSession({ session: loaded, actor: context.actor, occurredAt });
  if (!domainResult.success) return { outcome: "domain_error", errors: domainResult.errors };

  const projectAndPersistResult = await projectAndPersistBudgetVersion(context, budgetVersionRepository, domainResult.session, loadedVersion);
  if (projectAndPersistResult.outcome !== "success") {
    return projectAndPersistResult;
  }

  return finalizeSessionConsolidation(context, repository, domainResult.session, command.sessionId, domainResult.auditEvents[0]!);
}

/** Passo 1: projeta as linhas aprovadas para BudgetLine e persiste a BudgetVersion consolidada (validação + gravação já existentes, nunca reimplementadas). */
async function projectAndPersistBudgetVersion(
  context: ApplicationContext,
  budgetVersionRepository: BudgetVersionRepository,
  session: BudgetReviewSession,
  loadedVersion: PersistedEntity<BudgetVersion>,
): Promise<ConsolidateBudgetReviewSessionServiceResult> {
  const projectionResult = projectBudgetReviewSessionToBudgetVersion(session, loadedVersion.entity);
  if (!projectionResult.success) {
    return { outcome: "persistence_failure", message: `Falha ao projetar a Sessão de Revisão para a Versão do Orçamento: ${JSON.stringify(projectionResult.errors)}` };
  }

  const consolidationResult = consolidateBudgetVersion({ budgetVersion: projectionResult.budgetVersion });
  if (!consolidationResult.success) {
    return { outcome: "persistence_failure", message: `Falha ao consolidar a Versão do Orçamento projetada: ${JSON.stringify(consolidationResult.errors)}` };
  }

  try {
    const saveResult = await budgetVersionRepository.saveBudgetVersion(
      context.organizationId,
      context.actor,
      consolidationResult.budgetVersion,
      loadedVersion.revision,
    );

    if (saveResult.outcome === "concurrency_conflict") {
      return { outcome: "concurrency_conflict" };
    }

    return { outcome: "success", session };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

/** Passo 2 (sempre por último): marca a Sessão de Revisão Consolidated, gravando o evento SessionConsolidated já produzido pelo domínio puro no chamador. */
async function finalizeSessionConsolidation(
  context: ApplicationContext,
  repository: BudgetReviewRepository,
  session: BudgetReviewSession,
  sessionId: string,
  auditEvent: BudgetReviewAuditEvent,
): Promise<ConsolidateBudgetReviewSessionServiceResult> {
  try {
    await repository.consolidateSession(context.organizationId, context.actor, sessionId, auditEvent.id);
    return { outcome: "success", session: { ...session, status: BudgetReviewSessionStatus.Consolidated } };
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
