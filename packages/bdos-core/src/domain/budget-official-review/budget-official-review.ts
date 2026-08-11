import { BudgetLineKind, BudgetVersionStatus } from "../budget-version";
import {
  exactQuantityFromBrazilianText,
  moneyCentsFromBrazilianText,
  multiplyQuantityByUnitPriceCents,
  sumMoneyCents,
} from "./budget-official-review-economic-value";
import {
  BudgetReviewAuditAction,
  BudgetReviewRowState,
  BudgetReviewSessionStatus,
  EMPTY_BUDGET_REVIEW_ROW_FIELDS,
} from "./budget-official-review.types";
import type {
  BudgetReviewAuditEvent,
  BudgetReviewConsolidationReadiness,
  BudgetReviewError,
  BudgetReviewErrorCode,
  BudgetReviewFailure,
  BudgetReviewFieldChange,
  BudgetReviewGroupReconciliation,
  BudgetReviewMetadata,
  BudgetReviewResult,
  BudgetReviewRow,
  BudgetReviewRowFields,
  BudgetReviewServiceItemReconciliation,
  BudgetReviewSuccess,
  BulkConfirmBudgetReviewRowsInput,
  ConfirmBudgetReviewRowInput,
  ConsolidateBudgetReviewSessionInput,
  CorrectBudgetReviewRowInput,
  CreateBudgetReviewSessionInput,
  ExcludeBudgetReviewRowInput,
  ImportBudgetReviewRowsInput,
  InsertManualBudgetReviewRowInput,
  RestoreBudgetReviewRowInput,
  BudgetReviewSession,
} from "./budget-official-review.types";

/**
 * Cria uma nova Sessão de Revisão do Orçamento Oficial, sempre em
 * `InProgress`, sem linhas. `budgetVersion` precisa estar em `Draft` — a
 * revisão nunca aponta para uma Versão já consolidada (o próprio domínio
 * `budget-version` protegeria contra escrita, mas aqui recusamos a criação
 * da sessão desde o início, com uma mensagem específica do domínio de
 * revisão). Idempotência por `(procurementCaseId, sourceSha256,
 * acquisitionMechanism)` é responsabilidade do repositório/serviço
 * (enunciado §25) — este construtor sempre cria uma sessão nova.
 */
export function createBudgetReviewSession(input: CreateBudgetReviewSessionInput): BudgetReviewResult {
  const metadata: BudgetReviewMetadata = { ...(input.metadata ?? {}), reviewSessionId: input.id };
  const errors: BudgetReviewError[] = [];

  if (isBlank(input.id)) {
    errors.push(createError("missing_id", "id", "Identity is required.", metadata));
  }

  if (input.procurementCase === undefined || input.procurementCase === null || isBlank(input.procurementCase.organizationId)) {
    errors.push(createError("missing_organization_id", "procurementCase.organizationId", "Organization id is required.", metadata));
  }

  if (input.procurementCase !== undefined && input.procurementCase !== null && isBlank(input.procurementCase.id)) {
    errors.push(createError("missing_procurement_case_id", "procurementCase.id", "Processo de Licitação id is required.", metadata));
  }

  if (input.budgetVersion !== undefined && input.budgetVersion !== null) {
    if (input.budgetVersion.status !== BudgetVersionStatus.Draft) {
      errors.push(
        createError(
          "budget_version_not_draft",
          "budgetVersion",
          `Versão do Orçamento "${input.budgetVersion.id}" must be Draft to accept a review session.`,
          metadata,
        ),
      );
    }

    if (input.procurementCase !== undefined && input.budgetVersion.procurementCaseId !== input.procurementCase.id) {
      errors.push(
        createError(
          "budget_version_case_mismatch",
          "budgetVersion",
          "The Versão do Orçamento does not belong to the same Processo de Licitação.",
          metadata,
        ),
      );
    }
  }

  if (input.documentVersion !== undefined && input.documentVersion !== null) {
    if (input.procurementCase !== undefined && input.documentVersion.organizationId !== input.procurementCase.organizationId) {
      errors.push(
        createError(
          "document_version_case_mismatch",
          "documentVersion",
          "The DocumentVersion does not belong to the same organization as the Processo de Licitação.",
          metadata,
        ),
      );
    }

    if (input.documentVersion.sha256 !== input.sourceSha256) {
      errors.push(
        createError(
          "source_sha256_mismatch",
          "sourceSha256",
          "sourceSha256 must match the DocumentVersion's own sha256 — the review session always documents the exact source bytes it was built from.",
          metadata,
        ),
      );
    }
  }

  if (isBlank(input.acquisitionMechanism)) {
    errors.push(createError("missing_acquisition_mechanism", "acquisitionMechanism", "Acquisition mechanism is required.", metadata));
  }

  if (errors.length > 0) {
    return failure(errors, metadata);
  }

  const session: BudgetReviewSession = {
    id: input.id,
    organizationId: input.procurementCase.organizationId,
    procurementCaseId: input.procurementCase.id,
    budgetVersionId: input.budgetVersion.id,
    documentVersionId: input.documentVersion.id,
    sourceSha256: input.sourceSha256,
    acquisitionMechanism: input.acquisitionMechanism,
    acquisitionMechanismVersion: input.acquisitionMechanismVersion ?? null,
    status: BudgetReviewSessionStatus.InProgress,
    rows: [],
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    metadata,
  };

  return success(session, [], metadata);
}

/**
 * Importa um lote de Linhas de Revisão em `Pendente`, com `extracted` ==
 * `revised` (a extração bruta é imutável desde a origem — enunciado §18).
 * Gera um evento de auditoria por linha (`RowImported`), nunca um evento
 * agregado silencioso.
 */
export function importBudgetReviewRows(input: ImportBudgetReviewRowsInput): BudgetReviewResult {
  const { session } = input;
  const metadata: BudgetReviewMetadata = { ...session.metadata, reviewSessionId: session.id };

  if (session.status === BudgetReviewSessionStatus.Consolidated) {
    return immutableSessionFailure(session, "session", metadata);
  }

  const errors: BudgetReviewError[] = [];
  const newRows: BudgetReviewRow[] = [];
  const seenIds = new Set(session.rows.map((row) => row.id));
  const seenPositionsByParent = new Map<string, Set<number>>();

  session.rows.forEach((row) => {
    const key = row.parentRowId ?? "__root__";
    const set = seenPositionsByParent.get(key) ?? new Set<number>();
    set.add(row.position);
    seenPositionsByParent.set(key, set);
  });

  input.rows.forEach((rowInput) => {
    if (isBlank(rowInput.id)) {
      errors.push(createError("missing_id", "id", "Identity is required for every imported row.", metadata));
      return;
    }

    if (seenIds.has(rowInput.id)) {
      errors.push(createError("duplicate_row_id", "id", `A row with id "${rowInput.id}" already exists in this session.`, metadata));
      return;
    }
    seenIds.add(rowInput.id);

    const parentRowId = rowInput.parentRowId ?? null;
    errors.push(...validateParentRow(session, newRows, rowInput.kind, parentRowId, metadata));

    const key = parentRowId ?? "__root__";
    const positions = seenPositionsByParent.get(key) ?? new Set<number>();
    if (positions.has(rowInput.position)) {
      errors.push(createError("duplicate_position", "position", `Position ${rowInput.position} is already used by a sibling row.`, metadata));
    }
    positions.add(rowInput.position);
    seenPositionsByParent.set(key, positions);

    newRows.push({
      id: rowInput.id,
      sessionId: session.id,
      kind: rowInput.kind,
      lotReference: rowInput.lotReference,
      parentRowId,
      position: rowInput.position,
      state: BudgetReviewRowState.Pending,
      extracted: rowInput.fields,
      revised: rowInput.fields,
      page: rowInput.page,
      evidenceText: rowInput.evidenceText ?? null,
      justification: null,
      insertedManually: false,
      createdBy: input.actor,
      createdAt: input.occurredAt,
      metadata,
    });
  });

  if (errors.length > 0) {
    return failure(errors, metadata);
  }

  const auditEvents = newRows.map((row) =>
    createAuditEvent(session.id, row.id, BudgetReviewAuditAction.RowImported, input.actor, input.occurredAt, [], null, metadata),
  );

  return success({ ...session, rows: [...session.rows, ...newRows] }, auditEvents, metadata);
}

/** Confirma uma linha Pendente sem alteração — idempotente se já Confirmada. */
export function confirmBudgetReviewRow(input: ConfirmBudgetReviewRowInput): BudgetReviewResult {
  const { session, rowId } = input;
  const metadata: BudgetReviewMetadata = { ...session.metadata, reviewSessionId: session.id, rowId };

  if (session.status === BudgetReviewSessionStatus.Consolidated) {
    return immutableSessionFailure(session, "session", metadata);
  }

  const target = findRow(session, rowId, metadata);
  if (target === undefined) {
    return failure([createError("unknown_row", "rowId", `No row with id "${rowId}" exists in this session.`, metadata)], metadata);
  }

  if (target.state === BudgetReviewRowState.Confirmed) {
    return success(session, [], metadata);
  }

  if (target.state !== BudgetReviewRowState.Pending) {
    return failure(
      [createError("row_not_pending", "rowId", `Row "${rowId}" is "${target.state}", not "Pendente" — cannot confirm.`, metadata)],
      metadata,
    );
  }

  const updatedRow: BudgetReviewRow = { ...target, state: BudgetReviewRowState.Confirmed };
  const auditEvent = createAuditEvent(session.id, rowId, BudgetReviewAuditAction.RowConfirmed, input.actor, input.occurredAt, [], null, metadata);

  return success(replaceRow(session, updatedRow), [auditEvent], metadata);
}

/**
 * Corrige uma ou mais campos de uma linha — `extracted` nunca é alterado
 * (enunciado §18: "uma correção nunca apaga o valor original"). Exige
 * justificativa não vazia. Gera um evento de auditoria com o
 * antes/depois de cada campo alterado.
 */
export function correctBudgetReviewRow(input: CorrectBudgetReviewRowInput): BudgetReviewResult {
  const { session, rowId } = input;
  const metadata: BudgetReviewMetadata = { ...session.metadata, reviewSessionId: session.id, rowId };

  if (session.status === BudgetReviewSessionStatus.Consolidated) {
    return immutableSessionFailure(session, "session", metadata);
  }

  const target = findRow(session, rowId, metadata);
  if (target === undefined) {
    return failure([createError("unknown_row", "rowId", `No row with id "${rowId}" exists in this session.`, metadata)], metadata);
  }

  if (target.state === BudgetReviewRowState.NotBudgetItem) {
    return failure(
      [createError("row_not_confirmable", "rowId", `Row "${rowId}" is marked "NaoPertenceAoOrcamento" — restore it before correcting.`, metadata)],
      metadata,
    );
  }

  if (isBlank(input.justification)) {
    return failure([createError("missing_justification", "justification", "A correction requires a non-blank justification.", metadata)], metadata);
  }

  const fieldChanges = computeFieldChanges(target.revised, input.fields);
  if (fieldChanges.length === 0) {
    return failure([createError("no_op_fields", "fields", "No field values actually changed.", metadata)], metadata);
  }

  const updatedRow: BudgetReviewRow = {
    ...target,
    revised: { ...target.revised, ...input.fields },
    state: BudgetReviewRowState.Corrected,
    justification: input.justification,
  };

  const auditEvent = createAuditEvent(
    session.id,
    rowId,
    BudgetReviewAuditAction.RowCorrected,
    input.actor,
    input.occurredAt,
    fieldChanges,
    input.justification,
    metadata,
  );

  return success(replaceRow(session, updatedRow), [auditEvent], metadata);
}

/** Marca uma linha como não pertencente ao orçamento — a linha permanece no array, nunca é apagada. */
export function excludeBudgetReviewRow(input: ExcludeBudgetReviewRowInput): BudgetReviewResult {
  const { session, rowId } = input;
  const metadata: BudgetReviewMetadata = { ...session.metadata, reviewSessionId: session.id, rowId };

  if (session.status === BudgetReviewSessionStatus.Consolidated) {
    return immutableSessionFailure(session, "session", metadata);
  }

  const target = findRow(session, rowId, metadata);
  if (target === undefined) {
    return failure([createError("unknown_row", "rowId", `No row with id "${rowId}" exists in this session.`, metadata)], metadata);
  }

  if (isBlank(input.justification)) {
    return failure([createError("missing_justification", "justification", "Excluding a row requires a non-blank justification.", metadata)], metadata);
  }

  const updatedRow: BudgetReviewRow = { ...target, state: BudgetReviewRowState.NotBudgetItem, justification: input.justification };
  const auditEvent = createAuditEvent(
    session.id,
    rowId,
    BudgetReviewAuditAction.RowExcluded,
    input.actor,
    input.occurredAt,
    [],
    input.justification,
    metadata,
  );

  return success(replaceRow(session, updatedRow), [auditEvent], metadata);
}

/** Restaura uma linha excluída de volta para Pendente — somente enquanto a sessão estiver em progresso (enunciado §31). */
export function restoreBudgetReviewRow(input: RestoreBudgetReviewRowInput): BudgetReviewResult {
  const { session, rowId } = input;
  const metadata: BudgetReviewMetadata = { ...session.metadata, reviewSessionId: session.id, rowId };

  if (session.status === BudgetReviewSessionStatus.Consolidated) {
    return immutableSessionFailure(session, "session", metadata);
  }

  const target = findRow(session, rowId, metadata);
  if (target === undefined) {
    return failure([createError("unknown_row", "rowId", `No row with id "${rowId}" exists in this session.`, metadata)], metadata);
  }

  if (target.state !== BudgetReviewRowState.NotBudgetItem) {
    return failure(
      [createError("row_not_excluded", "rowId", `Row "${rowId}" is "${target.state}", not "NaoPertenceAoOrcamento" — nothing to restore.`, metadata)],
      metadata,
    );
  }

  const updatedRow: BudgetReviewRow = { ...target, state: BudgetReviewRowState.Pending, justification: null };
  const auditEvent = createAuditEvent(session.id, rowId, BudgetReviewAuditAction.RowRestored, input.actor, input.occurredAt, [], null, metadata);

  return success(replaceRow(session, updatedRow), [auditEvent], metadata);
}

/**
 * Insere uma linha manualmente — nunca existe `extracted` correspondente
 * (não veio de nenhuma extração). Exige página de evidência e justificativa
 * (enunciado §31).
 */
export function insertManualBudgetReviewRow(input: InsertManualBudgetReviewRowInput): BudgetReviewResult {
  const { session } = input;
  const metadata: BudgetReviewMetadata = { ...session.metadata, reviewSessionId: session.id, rowId: input.id };

  if (session.status === BudgetReviewSessionStatus.Consolidated) {
    return immutableSessionFailure(session, "session", metadata);
  }

  const errors: BudgetReviewError[] = [];

  if (isBlank(input.id)) {
    errors.push(createError("missing_id", "id", "Identity is required.", metadata));
  }

  if (session.rows.some((row) => row.id === input.id)) {
    errors.push(createError("duplicate_row_id", "id", `A row with id "${input.id}" already exists in this session.`, metadata));
  }

  if (isBlank(input.justification)) {
    errors.push(createError("missing_justification", "justification", "A manually inserted row requires a non-blank justification.", metadata));
  }

  if (!Number.isSafeInteger(input.page) || input.page <= 0) {
    errors.push(createError("missing_page_evidence", "page", "A manually inserted row requires a valid source page number.", metadata));
  }

  errors.push(...validateParentRow(session, [], input.kind, input.parentRowId, metadata));

  if (session.rows.some((row) => row.parentRowId === input.parentRowId && row.position === input.position)) {
    errors.push(createError("duplicate_position", "position", `Position ${input.position} is already used by a sibling row.`, metadata));
  }

  if (errors.length > 0) {
    return failure(errors, metadata);
  }

  const newRow: BudgetReviewRow = {
    id: input.id,
    sessionId: session.id,
    kind: input.kind,
    lotReference: input.lotReference,
    parentRowId: input.parentRowId,
    position: input.position,
    state: BudgetReviewRowState.ManuallyInserted,
    extracted: null,
    revised: input.fields,
    page: input.page,
    evidenceText: null,
    justification: input.justification,
    insertedManually: true,
    createdBy: input.actor,
    createdAt: input.occurredAt,
    metadata,
  };

  const auditEvent = createAuditEvent(
    session.id,
    newRow.id,
    BudgetReviewAuditAction.RowInsertedManually,
    input.actor,
    input.occurredAt,
    [],
    input.justification,
    metadata,
  );

  return success({ ...session, rows: [...session.rows, newRow] }, [auditEvent], metadata);
}

/**
 * Confirma em lote — nunca inclui linha `NaoPertenceAoOrcamento`, nunca
 * inclui linha com inconsistência de reconciliação ativa (enunciado §33).
 * Tudo ou nada: se qualquer linha selecionada não for elegível, a operação
 * inteira falha sem confirmar nenhuma (evita confirmação parcial confusa).
 */
export function bulkConfirmBudgetReviewRows(input: BulkConfirmBudgetReviewRowsInput): BudgetReviewResult {
  const { session, rowIds } = input;
  const metadata: BudgetReviewMetadata = { ...session.metadata, reviewSessionId: session.id };

  if (session.status === BudgetReviewSessionStatus.Consolidated) {
    return immutableSessionFailure(session, "session", metadata);
  }

  if (rowIds.length === 0) {
    return failure([createError("empty_row_selection", "rowIds", "At least one row must be selected.", metadata)], metadata);
  }

  const errors: BudgetReviewError[] = [];
  const targets: BudgetReviewRow[] = [];

  rowIds.forEach((rowId) => {
    const target = findRow(session, rowId, metadata);
    if (target === undefined) {
      errors.push(createError("unknown_row", "rowId", `No row with id "${rowId}" exists in this session.`, metadata));
      return;
    }

    if (target.state === BudgetReviewRowState.Confirmed) {
      return;
    }

    if (target.state !== BudgetReviewRowState.Pending) {
      errors.push(createError("row_not_pending", "rowId", `Row "${rowId}" is "${target.state}", not "Pendente" — excluded from bulk confirm.`, metadata));
      return;
    }

    if (target.kind === BudgetLineKind.ServiceItem) {
      const reconciliation = reconcileServiceItemRow(target);
      if (reconciliation.status === "diverges") {
        errors.push(createError("row_has_active_inconsistency", "rowId", `Row "${rowId}" has an active reconciliation divergence — excluded from bulk confirm.`, metadata));
        return;
      }
    }

    targets.push(target);
  });

  if (errors.length > 0) {
    return failure(errors, metadata);
  }

  if (targets.length === 0) {
    return success(session, [], metadata);
  }

  const updatedRows = session.rows.map((row) => {
    const isTarget = targets.some((target) => target.id === row.id);
    return isTarget ? { ...row, state: BudgetReviewRowState.Confirmed } : row;
  });

  const auditEvent = createAuditEvent(
    session.id,
    null,
    BudgetReviewAuditAction.BulkConfirmed,
    input.actor,
    input.occurredAt,
    [],
    null,
    { ...metadata, confirmedRowIds: targets.map((row) => row.id) },
  );

  return success({ ...session, rows: updatedRows }, [auditEvent], metadata);
}

/**
 * Reconciliação determinística de um Item de Serviço: quantidade × preço
 * unitário com BDI, comparado ao total documental — aritmética exata via
 * `bigint`, nunca ponto flutuante (enunciado §36). Sem dado suficiente,
 * `insufficient_data` — nunca tratado como `matches`.
 */
export function reconcileServiceItemRow(row: BudgetReviewRow): BudgetReviewServiceItemReconciliation {
  if (row.kind !== BudgetLineKind.ServiceItem) {
    return { rowId: row.id, status: "not_applicable", derivedTotalCents: null, documentedTotalCents: null, differenceCents: null };
  }

  const quantity = exactQuantityFromBrazilianText(row.revised.quantityText);
  const unitPriceCents = moneyCentsFromBrazilianText(row.revised.unitPriceWithBdiText);
  const documentedTotalCents = moneyCentsFromBrazilianText(row.revised.totalPriceText);

  if (quantity === null || unitPriceCents === null || documentedTotalCents === null) {
    return { rowId: row.id, status: "insufficient_data", derivedTotalCents: null, documentedTotalCents, differenceCents: null };
  }

  const derivedTotalCents = multiplyQuantityByUnitPriceCents(quantity, unitPriceCents);
  const differenceCents = derivedTotalCents - documentedTotalCents;

  return {
    rowId: row.id,
    status: differenceCents === 0 ? "matches" : "diverges",
    derivedTotalCents,
    documentedTotalCents,
    differenceCents,
  };
}

/**
 * Reconciliação de Grupo/Subgrupo: total documental (quando a fonte o
 * apresenta) contra a soma dos Itens de Serviço filhos já Confirmados ou
 * Corrigidos (nunca inclui `Pendente`, nunca `NaoPertenceAoOrcamento` —
 * evita dupla contagem e contagem de linha excluída). Filhos Grupo/Subgrupo
 * nunca somam como parcela própria — a mesma disciplina de
 * `calculateLineTotal` em `budget-version` (enunciado §37).
 */
export function reconcileGroupRow(session: BudgetReviewSession, rowId: string): BudgetReviewGroupReconciliation {
  const row = session.rows.find((candidate) => candidate.id === rowId);

  if (row === undefined || row.kind === BudgetLineKind.ServiceItem) {
    return { rowId, status: "not_applicable", derivedTotalCents: null, documentedTotalCents: null, differenceCents: null };
  }

  const documentedTotalCents = moneyCentsFromBrazilianText(row.revised.documentalGroupTotalText);
  const derivedTotalCents = sumMoneyCents(descendantServiceItemTotals(session, rowId));

  if (documentedTotalCents === null) {
    return { rowId, status: "insufficient_data", derivedTotalCents, documentedTotalCents: null, differenceCents: null };
  }

  const differenceCents = derivedTotalCents - documentedTotalCents;

  return {
    rowId,
    status: differenceCents === 0 ? "matches" : "diverges",
    derivedTotalCents,
    documentedTotalCents,
    differenceCents,
  };
}

/**
 * Gates de consolidação (enunciado §39) — bloqueia se existir: linha
 * Pendente; divergência de reconciliação de Item de Serviço não resolvida;
 * divergência de reconciliação de Grupo/Subgrupo não resolvida. Correção
 * de uma linha (`Corrigido`) é elegível para consolidação — a correção em
 * si é a resolução da pendência.
 */
export function budgetReviewConsolidationReadiness(session: BudgetReviewSession): BudgetReviewConsolidationReadiness {
  const blockers: string[] = [];

  const pendingRows = session.rows.filter((row) => row.state === BudgetReviewRowState.Pending);
  if (pendingRows.length > 0) {
    blockers.push(`${pendingRows.length} linha(s) pendente(s) de revisão.`);
  }

  const serviceItemRows = session.rows.filter(
    (row) => row.kind === BudgetLineKind.ServiceItem && row.state !== BudgetReviewRowState.NotBudgetItem,
  );
  const divergentServiceItems = serviceItemRows.filter((row) => reconcileServiceItemRow(row).status === "diverges");
  if (divergentServiceItems.length > 0) {
    blockers.push(`${divergentServiceItems.length} Item(ns) de Serviço com divergência de reconciliação não resolvida.`);
  }

  const groupRows = session.rows.filter(
    (row) => row.kind !== BudgetLineKind.ServiceItem && row.state !== BudgetReviewRowState.NotBudgetItem,
  );
  const divergentGroups = groupRows.filter((row) => reconcileGroupRow(session, row.id).status === "diverges");
  if (divergentGroups.length > 0) {
    blockers.push(`${divergentGroups.length} Grupo(s)/Subgrupo(s) com divergência entre total documental e total derivado.`);
  }

  return {
    ready: blockers.length === 0,
    blockers,
    pendingRowCount: pendingRows.length,
    divergentReconciliationCount: divergentServiceItems.length + divergentGroups.length,
  };
}

/** Consolidação explícita — bloqueada por qualquer pendência real (enunciado §63: aprovação é sempre ação humana). */
export function consolidateBudgetReviewSession(input: ConsolidateBudgetReviewSessionInput): BudgetReviewResult {
  const { session } = input;
  const metadata: BudgetReviewMetadata = { ...session.metadata, reviewSessionId: session.id };

  if (session.status === BudgetReviewSessionStatus.Consolidated) {
    return success(session, [], metadata);
  }

  const readiness = budgetReviewConsolidationReadiness(session);
  if (!readiness.ready) {
    return failure(
      [createError("consolidation_blocked", "session", `Consolidation blocked: ${readiness.blockers.join(" ")}`, { ...metadata, blockers: readiness.blockers })],
      metadata,
    );
  }

  const auditEvent = createAuditEvent(session.id, null, BudgetReviewAuditAction.SessionConsolidated, input.actor, input.occurredAt, [], null, metadata);

  return success({ ...session, status: BudgetReviewSessionStatus.Consolidated }, [auditEvent], metadata);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function descendantServiceItemTotals(session: BudgetReviewSession, rowId: string): ReadonlyArray<number | null> {
  const children = session.rows.filter((row) => row.parentRowId === rowId && row.state !== BudgetReviewRowState.NotBudgetItem);

  return children.flatMap((child) => {
    if (child.kind === BudgetLineKind.ServiceItem) {
      return [moneyCentsFromBrazilianText(child.revised.totalPriceText)];
    }
    return descendantServiceItemTotals(session, child.id);
  });
}

function validateParentRow(
  session: BudgetReviewSession,
  pendingSiblings: ReadonlyArray<BudgetReviewRow>,
  kind: BudgetReviewRow["kind"],
  parentRowId: string | null,
  metadata: BudgetReviewMetadata,
): ReadonlyArray<BudgetReviewError> {
  if (kind === BudgetLineKind.Group) {
    if (parentRowId !== null) {
      return [createError("incompatible_parent_kind", "parentRowId", "Grupo must not have a parent row.", metadata)];
    }
    return [];
  }

  if (parentRowId === null) {
    return [createError("missing_parent_row", "parentRowId", `${kind} requires a parent row.`, metadata)];
  }

  const parent = session.rows.find((row) => row.id === parentRowId) ?? pendingSiblings.find((row) => row.id === parentRowId);

  if (parent === undefined) {
    return [createError("missing_parent_row", "parentRowId", `No row with id "${parentRowId}" exists in this session.`, metadata)];
  }

  if (kind === BudgetLineKind.Subgroup && parent.kind !== BudgetLineKind.Group) {
    return [createError("incompatible_parent_kind", "parentRowId", "Subgrupo must have a Grupo as parent.", metadata)];
  }

  if (kind === BudgetLineKind.ServiceItem && parent.kind !== BudgetLineKind.Group && parent.kind !== BudgetLineKind.Subgroup) {
    return [createError("incompatible_parent_kind", "parentRowId", "Item de Serviço must have a Grupo or Subgrupo as parent.", metadata)];
  }

  return [];
}

function computeFieldChanges(current: BudgetReviewRowFields, patch: Partial<BudgetReviewRowFields>): ReadonlyArray<BudgetReviewFieldChange> {
  const changes: BudgetReviewFieldChange[] = [];

  (Object.keys(patch) as Array<keyof BudgetReviewRowFields>).forEach((field) => {
    const newValue = patch[field] ?? null;
    const previousValue = current[field] ?? null;
    if (newValue !== previousValue) {
      changes.push({ field, previousValue, newValue });
    }
  });

  return changes;
}

function findRow(session: BudgetReviewSession, rowId: string, _metadata: BudgetReviewMetadata): BudgetReviewRow | undefined {
  return session.rows.find((row) => row.id === rowId);
}

function replaceRow(session: BudgetReviewSession, updatedRow: BudgetReviewRow): BudgetReviewSession {
  return { ...session, rows: session.rows.map((row) => (row.id === updatedRow.id ? updatedRow : row)) };
}

function createAuditEvent(
  sessionId: string,
  rowId: string | null,
  action: BudgetReviewAuditAction,
  actor: string,
  occurredAt: string,
  fieldChanges: ReadonlyArray<BudgetReviewFieldChange>,
  justification: string | null,
  metadata: BudgetReviewMetadata,
): BudgetReviewAuditEvent {
  return {
    id: `${sessionId}:${action}:${rowId ?? "session"}:${occurredAt}`,
    sessionId,
    rowId,
    action,
    actor,
    occurredAt,
    fieldChanges,
    justification,
    metadata,
  };
}

function createError(code: BudgetReviewErrorCode, field: string, message: string, metadata: BudgetReviewMetadata): BudgetReviewError {
  return { code, field, message, metadata };
}

function immutableSessionFailure(session: BudgetReviewSession, field: string, metadata: BudgetReviewMetadata): BudgetReviewFailure {
  return failure(
    [createError("session_consolidated_immutable", field, `Sessão de Revisão "${session.id}" is consolidated and cannot be altered.`, metadata)],
    metadata,
  );
}

function success(session: BudgetReviewSession, auditEvents: ReadonlyArray<BudgetReviewAuditEvent>, metadata: BudgetReviewMetadata): BudgetReviewSuccess {
  return freezeDomainObject<BudgetReviewSuccess>({ success: true, session, auditEvents, errors: [], metadata });
}

function failure(errors: ReadonlyArray<BudgetReviewError>, metadata: BudgetReviewMetadata): BudgetReviewFailure {
  return freezeDomainObject<BudgetReviewFailure>({ success: false, session: null, auditEvents: [], errors, metadata });
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, property]) => [key, cloneDomainValue(property)])) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  Object.values(value as Record<string, unknown>).forEach((property) => {
    freezeClonedDomainObject(property);
  });
  return Object.freeze(value);
}

export { EMPTY_BUDGET_REVIEW_ROW_FIELDS };
