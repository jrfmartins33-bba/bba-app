import type {
  BudgetReviewAcquisitionMechanism,
  BudgetReviewError,
  BudgetReviewLotReference,
  BudgetReviewRowFields,
  BudgetReviewRowKind,
  BudgetReviewSession,
} from "../../domain/budget-official-review";
import type { BudgetVersion } from "../../domain/budget-version";
import type { DocumentVersion } from "../../domain/document-processing";
import type { ProcurementCase } from "../../domain/procurement-case";

export interface CreateBudgetReviewSessionCommand {
  readonly id: string;
  readonly procurementCase: ProcurementCase;
  readonly budgetVersion: BudgetVersion;
  readonly documentVersion: DocumentVersion;
  readonly sourceSha256: string;
  readonly acquisitionMechanism: BudgetReviewAcquisitionMechanism;
  readonly acquisitionMechanismVersion?: string | null;
}

export interface ImportBudgetReviewRowCommandInput {
  readonly id: string;
  readonly kind: BudgetReviewRowKind;
  readonly lotReference: BudgetReviewLotReference;
  readonly parentRowId?: string | null;
  readonly position: number;
  readonly fields: BudgetReviewRowFields;
  readonly page: number | null;
  readonly evidenceText?: string | null;
}

export interface ImportBudgetReviewRowsCommand {
  readonly sessionId: string;
  readonly rows: ReadonlyArray<ImportBudgetReviewRowCommandInput>;
}

export interface ConfirmBudgetReviewRowCommand {
  readonly sessionId: string;
  readonly rowId: string;
}

export interface CorrectBudgetReviewRowCommand {
  readonly sessionId: string;
  readonly rowId: string;
  readonly fields: Partial<BudgetReviewRowFields>;
  readonly justification: string;
}

export interface ExcludeBudgetReviewRowCommand {
  readonly sessionId: string;
  readonly rowId: string;
  readonly justification: string;
}

export interface RestoreBudgetReviewRowCommand {
  readonly sessionId: string;
  readonly rowId: string;
}

export interface InsertManualBudgetReviewRowCommand {
  readonly sessionId: string;
  readonly id: string;
  readonly kind: BudgetReviewRowKind;
  readonly lotReference: BudgetReviewLotReference;
  readonly parentRowId: string | null;
  readonly position: number;
  readonly fields: BudgetReviewRowFields;
  readonly page: number;
  readonly justification: string;
}

export interface BulkConfirmBudgetReviewRowsCommand {
  readonly sessionId: string;
  readonly rowIds: ReadonlyArray<string>;
}

export interface AcceptBudgetReviewRowDivergenceCommand {
  readonly sessionId: string;
  readonly rowId: string;
  readonly justification: string;
}

export interface BulkAcceptBudgetReviewRowDivergencesCommand {
  readonly sessionId: string;
  readonly rowIds: ReadonlyArray<string>;
  readonly justification: string;
}

export interface ConsolidateBudgetReviewSessionCommand {
  readonly sessionId: string;
}

export interface GetBudgetReviewSessionQuery {
  readonly sessionId: string;
}

export type BudgetReviewServiceResult =
  | { readonly outcome: "success"; readonly session: BudgetReviewSession }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "domain_error"; readonly errors: ReadonlyArray<BudgetReviewError> }
  | { readonly outcome: "persistence_failure"; readonly message: string };

/**
 * Resultado específico da consolidação — inclui `concurrency_conflict`
 * porque, diferente das demais operações desta Sessão, consolidar também
 * grava um novo retrato inteiro de `BudgetVersion` (via
 * `saveBudgetVersion`/`persist_budget_version_snapshot`, concorrência
 * otimista por revisão) — nunca sobrescrita silenciosa se outra escrita
 * concorrente já mudou a Versão entretanto.
 */
export type ConsolidateBudgetReviewSessionServiceResult = BudgetReviewServiceResult | { readonly outcome: "concurrency_conflict" };

export type GetBudgetReviewSessionResult =
  | { readonly outcome: "found"; readonly session: BudgetReviewSession }
  | { readonly outcome: "not_found" };
