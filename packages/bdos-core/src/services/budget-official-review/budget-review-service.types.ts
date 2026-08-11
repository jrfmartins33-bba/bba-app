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

export type GetBudgetReviewSessionResult =
  | { readonly outcome: "found"; readonly session: BudgetReviewSession }
  | { readonly outcome: "not_found" };
