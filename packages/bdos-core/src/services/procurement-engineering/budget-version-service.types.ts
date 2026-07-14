import type {
  BudgetLineDescription,
  BudgetLineKind,
  BudgetVersion,
  BudgetVersionError,
  BudgetVersionMetadata,
  BudgetVersionOrigin,
} from "../../domain/budget-version";
import type { ProcurementCaseRepository } from "./procurement-case.repository";
import type { BudgetVersionRepository } from "./budget-version.repository";

/** Reunião das duas fronteiras de persistência que os Serviços de Aplicação da Versão do Orçamento coordenam — Licitação (Processo/Lote) e Orçamento. */
export interface BudgetVersionServiceRepositories {
  readonly procurementCaseRepository: ProcurementCaseRepository;
  readonly budgetVersionRepository: BudgetVersionRepository;
}

/**
 * Forma de comando do Escopo da Licitação: nunca repete `procurementCaseId`
 * (já é o `procurementCaseId`/`budgetVersionId` do próprio comando) —
 * o Serviço de Aplicação monta o `ProcurementScope` completo antes de
 * invocar o domínio.
 */
export type BudgetScopeCommand = { readonly kind: "WholeCase" } | { readonly kind: "Lot"; readonly procurementLotId: string };

export interface CreateBudgetVersionDraftCommand {
  readonly procurementCaseId: string;
  readonly scope: BudgetScopeCommand;
  readonly origin: BudgetVersionOrigin;
  readonly originLineageId?: string;
  readonly metadata?: BudgetVersionMetadata;
}

export interface AddBudgetLineCommand {
  readonly budgetVersionId: string;
  readonly kind: BudgetLineKind;
  readonly description: BudgetLineDescription;
  readonly externalCode?: string | null;
  readonly parentLineId?: string | null;
  readonly position: number;
  readonly scope: BudgetScopeCommand;
  readonly totalCents?: number | null;
  readonly metadata?: BudgetVersionMetadata;
}

export interface UpdateBudgetLineCommand {
  readonly budgetVersionId: string;
  readonly lineId: string;
  readonly description?: BudgetLineDescription;
  readonly externalCode?: string | null;
  readonly scope?: BudgetScopeCommand;
  readonly totalCents?: number | null;
}

export interface RemoveBudgetLineCommand {
  readonly budgetVersionId: string;
  readonly lineId: string;
}

export interface ReorderBudgetLineCommand {
  readonly budgetVersionId: string;
  readonly lineId: string;
  readonly position: number;
}

export interface RegisterLineageRelationCommand {
  readonly budgetVersionId: string;
}

export interface ConsolidateBudgetVersionCommand {
  readonly budgetVersionId: string;
}

export interface GetBudgetVersionQuery {
  readonly budgetVersionId: string;
}

/**
 * Resultado compartilhado por toda operação de mutação da Versão do
 * Orçamento. `revision` só acompanha `success` — é controle físico de
 * persistência (ver `budget-version.repository.ts`), nunca um campo do
 * domínio puro.
 */
export type BudgetVersionServiceResult =
  | { readonly outcome: "success"; readonly budgetVersion: BudgetVersion; readonly revision: number }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "procurement_case_not_found" }
  | { readonly outcome: "procurement_lot_not_found" }
  | { readonly outcome: "domain_error"; readonly errors: ReadonlyArray<BudgetVersionError> }
  | { readonly outcome: "concurrency_conflict" }
  | { readonly outcome: "persistence_failure"; readonly message: string };

export type GetBudgetVersionResult =
  | { readonly outcome: "found"; readonly budgetVersion: BudgetVersion; readonly revision: number }
  | { readonly outcome: "not_found" };
