import {
  addBudgetLine,
  consolidateBudgetVersion,
  createBudgetVersion,
  registerLineageRelation,
  removeBudgetLine,
  updateBudgetLine,
  updateBudgetLinePosition,
} from "../../domain/budget-version";
import { BudgetVersionStatus } from "../../domain/budget-version";
import type { BudgetVersion } from "../../domain/budget-version";
import { ProcurementScopeKind } from "../../domain/procurement-case";
import type { ProcurementLot, ProcurementScope } from "../../domain/procurement-case";
import type { ApplicationContext } from "./application-context";
import { toInfrastructureErrorMessage } from "./application-context";
import type { BudgetVersionRepository } from "./budget-version.repository";
import type { ProcurementCaseRepository } from "./procurement-case.repository";
import type {
  AddBudgetLineCommand,
  BudgetScopeCommand,
  BudgetVersionServiceRepositories,
  BudgetVersionServiceResult,
  ConsolidateBudgetVersionCommand,
  CreateBudgetVersionDraftCommand,
  GetBudgetVersionQuery,
  GetBudgetVersionResult,
  RegisterLineageRelationCommand,
  RemoveBudgetLineCommand,
  ReorderBudgetLineCommand,
  UpdateBudgetLineCommand,
} from "./budget-version-service.types";

/**
 * Cria a Versão do Orçamento em rascunho (seção 9.3): carrega o Processo na
 * organização do contexto, e o Lote quando o Escopo for de lote —
 * `resolveScope` é a única prova de existência real do lote aceita; um
 * Escopo de lote fabricado (id que não existe, ou de outro Processo) nunca
 * alcança o domínio como `ProcurementLot` válido.
 */
export async function createBudgetVersionDraftService(
  context: ApplicationContext,
  command: CreateBudgetVersionDraftCommand,
  repositories: BudgetVersionServiceRepositories,
): Promise<BudgetVersionServiceResult> {
  const procurementCase = await repositories.procurementCaseRepository.findProcurementCaseById(
    context.organizationId,
    command.procurementCaseId,
  );

  if (procurementCase === null) {
    return { outcome: "procurement_case_not_found" };
  }

  const resolvedScope = await resolveScope(
    context,
    command.procurementCaseId,
    command.scope,
    repositories.procurementCaseRepository,
  );

  if ("error" in resolvedScope) {
    return { outcome: "procurement_lot_not_found" };
  }

  const domainResult = createBudgetVersion({
    id: crypto.randomUUID(),
    procurementCase,
    procurementLot: resolvedScope.procurementLot,
    scope: resolvedScope.scope,
    origin: command.origin,
    originLineageId: command.originLineageId,
    correlationId: context.correlationId,
    createdBy: context.actor,
    sourceSystem: context.sourceSystem,
    metadata: command.metadata,
  });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  try {
    const persisted = await repositories.budgetVersionRepository.createDraftBudgetVersion(
      context.organizationId,
      context.actor,
      domainResult.budgetVersion,
    );
    return { outcome: "success", budgetVersion: persisted.entity, revision: persisted.revision };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

/** Adiciona uma Linha do Orçamento (seção 9.4): carrega a Versão e, quando o Escopo da Linha exigir, o Lote. */
export async function addBudgetLineService(
  context: ApplicationContext,
  command: AddBudgetLineCommand,
  repositories: BudgetVersionServiceRepositories,
): Promise<BudgetVersionServiceResult> {
  const loaded = await repositories.budgetVersionRepository.loadBudgetVersion(context.organizationId, command.budgetVersionId);

  if (loaded === null) {
    return { outcome: "not_found" };
  }

  const resolvedScope = await resolveScope(
    context,
    loaded.entity.procurementCaseId,
    command.scope,
    repositories.procurementCaseRepository,
  );

  if ("error" in resolvedScope) {
    return { outcome: "procurement_lot_not_found" };
  }

  const domainResult = addBudgetLine({
    budgetVersion: loaded.entity,
    id: crypto.randomUUID(),
    kind: command.kind,
    description: command.description,
    externalCode: command.externalCode,
    parentLineId: command.parentLineId,
    position: command.position,
    scope: resolvedScope.scope,
    procurementLot: resolvedScope.procurementLot,
    totalCents: command.totalCents,
    metadata: command.metadata,
  });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  return persistBudgetVersionMutation(context, repositories.budgetVersionRepository, loaded.revision, domainResult.budgetVersion);
}

/** Atualiza campos já aprovados de uma Linha existente (seção 9.5). */
export async function updateBudgetLineService(
  context: ApplicationContext,
  command: UpdateBudgetLineCommand,
  repositories: BudgetVersionServiceRepositories,
): Promise<BudgetVersionServiceResult> {
  const loaded = await repositories.budgetVersionRepository.loadBudgetVersion(context.organizationId, command.budgetVersionId);

  if (loaded === null) {
    return { outcome: "not_found" };
  }

  let resolvedScope: ResolvedScope | undefined;

  if (command.scope !== undefined) {
    const resolved = await resolveScope(context, loaded.entity.procurementCaseId, command.scope, repositories.procurementCaseRepository);

    if ("error" in resolved) {
      return { outcome: "procurement_lot_not_found" };
    }

    resolvedScope = resolved;
  }

  const domainResult = updateBudgetLine({
    budgetVersion: loaded.entity,
    lineId: command.lineId,
    description: command.description,
    externalCode: command.externalCode,
    scope: resolvedScope?.scope,
    procurementLot: resolvedScope?.procurementLot,
    totalCents: command.totalCents,
  });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  return persistBudgetVersionMutation(context, repositories.budgetVersionRepository, loaded.revision, domainResult.budgetVersion);
}

/** Remove uma Linha sem filhos (seção 9.6) — o bloqueio de descendentes é responsabilidade do domínio, preservado sem reescrita. */
export async function removeBudgetLineService(
  context: ApplicationContext,
  command: RemoveBudgetLineCommand,
  repositories: BudgetVersionServiceRepositories,
): Promise<BudgetVersionServiceResult> {
  const loaded = await repositories.budgetVersionRepository.loadBudgetVersion(context.organizationId, command.budgetVersionId);

  if (loaded === null) {
    return { outcome: "not_found" };
  }

  const domainResult = removeBudgetLine({ budgetVersion: loaded.entity, lineId: command.lineId });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  return persistBudgetVersionMutation(context, repositories.budgetVersionRepository, loaded.revision, domainResult.budgetVersion);
}

/** Reordena uma Linha (seção 9.7) — a posição de produto vem sempre de `position`, nunca da ordem física de inserção do banco. */
export async function reorderBudgetLineService(
  context: ApplicationContext,
  command: ReorderBudgetLineCommand,
  repositories: BudgetVersionServiceRepositories,
): Promise<BudgetVersionServiceResult> {
  const loaded = await repositories.budgetVersionRepository.loadBudgetVersion(context.organizationId, command.budgetVersionId);

  if (loaded === null) {
    return { outcome: "not_found" };
  }

  const domainResult = updateBudgetLinePosition({
    budgetVersion: loaded.entity,
    lineId: command.lineId,
    position: command.position,
  });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  return persistBudgetVersionMutation(context, repositories.budgetVersionRepository, loaded.revision, domainResult.budgetVersion);
}

/** Registra a Relação de Rastreabilidade de origem (seção 9.8) — o domínio já impede uma segunda relação; este serviço nunca a contorna. */
export async function registerLineageRelationService(
  context: ApplicationContext,
  command: RegisterLineageRelationCommand,
  repositories: BudgetVersionServiceRepositories,
): Promise<BudgetVersionServiceResult> {
  const loaded = await repositories.budgetVersionRepository.loadBudgetVersion(context.organizationId, command.budgetVersionId);

  if (loaded === null) {
    return { outcome: "not_found" };
  }

  const domainResult = registerLineageRelation({ budgetVersion: loaded.entity, id: crypto.randomUUID() });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  return persistBudgetVersionMutation(context, repositories.budgetVersionRepository, loaded.revision, domainResult.budgetVersion);
}

/** Consolida a Versão do Orçamento (seção 9.9) — repetir sobre uma versão já consolidada é um no-op de domínio, não um erro. */
export async function consolidateBudgetVersionService(
  context: ApplicationContext,
  command: ConsolidateBudgetVersionCommand,
  repositories: BudgetVersionServiceRepositories,
): Promise<BudgetVersionServiceResult> {
  const loaded = await repositories.budgetVersionRepository.loadBudgetVersion(context.organizationId, command.budgetVersionId);

  if (loaded === null) {
    return { outcome: "not_found" };
  }

  // Operação sem efeito de domínio (repetir a consolidação de uma Versão
  // já consolidada): reconhecida antes de invocar o domínio, nunca chama
  // saveBudgetVersion, nunca incrementa a revisão física — a mesma
  // Versão e a mesma revisão já carregadas são devolvidas.
  if (loaded.entity.status === BudgetVersionStatus.Consolidated) {
    return { outcome: "success", budgetVersion: loaded.entity, revision: loaded.revision };
  }

  const domainResult = consolidateBudgetVersion({ budgetVersion: loaded.entity });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  return persistBudgetVersionMutation(context, repositories.budgetVersionRepository, loaded.revision, domainResult.budgetVersion);
}

/** Consulta mínima do retrato persistido completo (seção 9.10) — nunca uma Visão Consolidada, apenas uso interno e testes. */
export async function getBudgetVersionService(
  context: ApplicationContext,
  query: GetBudgetVersionQuery,
  budgetVersionRepository: BudgetVersionRepository,
): Promise<GetBudgetVersionResult> {
  const loaded = await budgetVersionRepository.loadBudgetVersion(context.organizationId, query.budgetVersionId);

  if (loaded === null) {
    return { outcome: "not_found" };
  }

  return { outcome: "found", budgetVersion: loaded.entity, revision: loaded.revision };
}

interface ResolvedScope {
  readonly scope: ProcurementScope;
  readonly procurementLot?: ProcurementLot;
}

/**
 * Prova de existência real do lote referenciado por um comando de Escopo —
 * carrega o `ProcurementLot` do repositório (Escopado por organização e
 * Processo) em vez de confiar em qualquer identidade de lote informada pelo
 * chamador. Um Escopo de processo inteiro nunca exige essa prova.
 */
async function resolveScope(
  context: ApplicationContext,
  procurementCaseId: string,
  scopeCommand: BudgetScopeCommand,
  procurementCaseRepository: ProcurementCaseRepository,
): Promise<ResolvedScope | { readonly error: "procurement_lot_not_found" }> {
  if (scopeCommand.kind === "WholeCase") {
    return { scope: { kind: ProcurementScopeKind.WholeCase, procurementCaseId } };
  }

  const procurementLot = await procurementCaseRepository.findProcurementLotById(
    context.organizationId,
    procurementCaseId,
    scopeCommand.procurementLotId,
  );

  if (procurementLot === null) {
    return { error: "procurement_lot_not_found" };
  }

  return {
    scope: { kind: ProcurementScopeKind.Lot, procurementCaseId, procurementLotId: procurementLot.id },
    procurementLot,
  };
}

/** Persiste o novo retrato condicionado à revisão carregada — nunca sobrescrita silenciosa, nunca persistência parcial (seção 15/16). */
async function persistBudgetVersionMutation(
  context: ApplicationContext,
  budgetVersionRepository: BudgetVersionRepository,
  expectedRevision: number,
  budgetVersion: BudgetVersion,
): Promise<BudgetVersionServiceResult> {
  try {
    const saveResult = await budgetVersionRepository.saveBudgetVersion(context.organizationId, context.actor, budgetVersion, expectedRevision);

    if (saveResult.outcome === "concurrency_conflict") {
      return { outcome: "concurrency_conflict" };
    }

    return { outcome: "success", budgetVersion, revision: saveResult.revision };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}
