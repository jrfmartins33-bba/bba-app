import type { BudgetLineKind, BudgetVersion } from "../budget-version";
import type { MoneyCents } from "../budget-version";
import type { DocumentVersion } from "../document-processing";
import type { ProcurementCase } from "../procurement-case";

export type BudgetReviewMetadata = Readonly<Record<string, unknown>>;

export type BudgetReviewSessionId = string;
export type BudgetReviewRowId = string;
export type BudgetReviewAuditEventId = string;
export type BudgetReviewOrganizationId = string;
export type BudgetReviewActor = string;
export type BudgetReviewTimestamp = string;
export type BudgetReviewLotReference = string;

/**
 * Estado técnico de uma Sessão de Revisão do Orçamento Oficial. `InProgress`
 * é o único estado em que linhas podem ser importadas, confirmadas,
 * corrigidas, excluídas ou inseridas manualmente. `Consolidated` é terminal
 * e imutável — a mesma disciplina de `BudgetVersionStatus.Consolidated`.
 */
export enum BudgetReviewSessionStatus {
  InProgress = "InProgress",
  Consolidated = "Consolidated",
}

/**
 * Mecanismo real de aquisição da evidência textual desta sessão — nunca
 * assume que o Motor r11 sempre produz a extração (Sprint 21.5A §9). Reusa
 * `DocumentProcessingAttempt.mechanism` (string livre) como precedente —
 * este union apenas documenta os valores conhecidos nesta Sprint; novos
 * mecanismos futuros permanecem representáveis sem migração de schema.
 */
export type BudgetReviewAcquisitionMechanism = "r11" | "vision_assisted_transcription" | (string & {});

/**
 * Classificação de uma Linha de Revisão — reaproveita `BudgetLineKind` do
 * domínio `budget-version` (Grupo/Subgrupo/Item de Serviço são o mesmo
 * conceito nos dois domínios; a Linha de Revisão é o estágio anterior à
 * projeção para `BudgetLine`).
 */
export type BudgetReviewRowKind = BudgetLineKind;

/**
 * Estado de revisão de uma linha, em português no domínio porque é a
 * própria semântica de negócio desta Sprint (enunciado §17) — não um rótulo
 * de apresentação.
 *
 * - `Pendente`: importada, ainda não avaliada por um humano.
 * - `Confirmado`: revisor confirmou os valores extraídos sem alteração.
 * - `Corrigido`: revisor alterou um ou mais campos; o valor original
 *   permanece preservado em `extracted`, nunca sobrescrito.
 * - `NaoPertenceAoOrcamento`: revisor marcou a linha como não pertencente
 *   ao orçamento (ex.: metadado/título promovido incorretamente a Item de
 *   Serviço pelo Motor) — a linha permanece no array, nunca é apagada.
 * - `InseridoManualmente`: linha que não veio da extração original,
 *   adicionada por um revisor com página/evidência e justificativa.
 */
export enum BudgetReviewRowState {
  Pending = "Pendente",
  Confirmed = "Confirmado",
  Corrected = "Corrigido",
  NotBudgetItem = "NaoPertenceAoOrcamento",
  ManuallyInserted = "InseridoManualmente",
}

/**
 * Conjunto de campos econômicos/descritivos de uma Linha de Revisão —
 * mesmo shape usado tanto em `extracted` (imutável, como lido da fonte)
 * quanto em `revised` (mutável enquanto `InProgress`). Todo campo é
 * opcional/nulo explicitamente — ausência na fonte é um fato, nunca
 * inventado como zero ou string vazia (enunciado §28: "Ausente: —").
 *
 * `quantity`, `unitCostWithoutBdiText` e `bdiPercentText` preservam o texto
 * decimal exato (formato brasileiro na fonte, ex.: "46.656,22"), nunca um
 * `number` de ponto flutuante — a conversão para representação exata ocorre
 * apenas no momento de uma operação aritmética específica (reconciliação),
 * nunca na captura.
 */
export interface BudgetReviewRowFields {
  readonly itemCode: string | null;
  readonly description: string | null;
  readonly sourceCode: string | null;
  readonly sourceFonte: string | null;
  readonly sourceTipo: string | null;
  readonly unit: string | null;
  readonly quantityText: string | null;
  readonly unitCostWithoutBdiText: string | null;
  readonly bdiPercentText: string | null;
  readonly unitPriceWithBdiText: string | null;
  readonly totalPriceText: string | null;
  readonly colFgvDnit: string | null;
  /**
   * Total documental do Grupo/Subgrupo, quando a fonte o apresenta
   * explicitamente (enunciado §13/§38) — evidência de reconciliação, nunca
   * uma parcela econômica própria. Só aplicável a `kind` Grupo/Subgrupo.
   */
  readonly documentalGroupTotalText: string | null;
}

export const EMPTY_BUDGET_REVIEW_ROW_FIELDS: BudgetReviewRowFields = {
  itemCode: null,
  description: null,
  sourceCode: null,
  sourceFonte: null,
  sourceTipo: null,
  unit: null,
  quantityText: null,
  unitCostWithoutBdiText: null,
  bdiPercentText: null,
  unitPriceWithBdiText: null,
  totalPriceText: null,
  colFgvDnit: null,
  documentalGroupTotalText: null,
};

/**
 * Linha de Revisão (`BudgetReviewRow`) — estágio de EXTRAÇÃO BRUTA /
 * LINHAS CANDIDATAS do fluxo (enunciado §16), nunca o orçamento canônico.
 * `extracted` é imutável desde a importação (nunca sobrescrito por uma
 * correção). `revised` começa idêntico a `extracted` e só se afasta dele
 * via `correctBudgetReviewRow` ou, para linhas manuais, é o único conjunto
 * de campos (não existe `extracted` correspondente).
 */
export interface BudgetReviewRow {
  readonly id: BudgetReviewRowId;
  readonly sessionId: BudgetReviewSessionId;
  readonly kind: BudgetReviewRowKind;
  readonly lotReference: BudgetReviewLotReference;
  readonly parentRowId: BudgetReviewRowId | null;
  readonly position: number;
  readonly state: BudgetReviewRowState;
  readonly extracted: BudgetReviewRowFields | null;
  readonly revised: BudgetReviewRowFields;
  readonly page: number | null;
  readonly evidenceText: string | null;
  readonly justification: string | null;
  readonly insertedManually: boolean;
  readonly reconciliationDecision: ReconciliationDecision | null;
  readonly createdBy: BudgetReviewActor;
  readonly createdAt: BudgetReviewTimestamp;
  readonly metadata: BudgetReviewMetadata;
}

/**
 * Decisão humana de reconciliação — conceito deliberadamente separado de
 * `BudgetReviewRowState` (Confirmado/Corrigido continuam significando
 * apenas "revisor avaliou os valores", nunca "divergência resolvida").
 * `AcceptedAsDocumented` documenta que o Admin BBA conferiu os três valores
 * (quantidade, preço unitário, total) contra a fonte e decidiu preservá-los
 * exatamente como publicados, mesmo com uma diferença aritmética residual
 * (tipicamente arredondamento em cadeia da planilha de origem) — nunca uma
 * correção automática de tolerância.
 */
export enum ReconciliationDecisionStatus {
  AcceptedAsDocumented = "AcceptedAsDocumented",
}

export interface ReconciliationDecision {
  readonly status: ReconciliationDecisionStatus.AcceptedAsDocumented;
  readonly actor: BudgetReviewActor;
  readonly justification: string;
  readonly decidedAt: BudgetReviewTimestamp;
}

/**
 * Sessão de Revisão do Orçamento Oficial (`BudgetReviewSession`) — processo
 * que transforma uma extração bruta em linhas aprovadas, projetáveis para
 * uma `BudgetVersion` (Draft) já existente. Nunca é o orçamento em si — é o
 * processo de revisão que antecede a projeção/consolidação (enunciado §16).
 */
export interface BudgetReviewSession {
  readonly id: BudgetReviewSessionId;
  readonly organizationId: BudgetReviewOrganizationId;
  readonly procurementCaseId: string;
  readonly procurementLotId?: string | null;
  readonly budgetVersionId: string;
  readonly documentVersionId: string;
  readonly sourceSha256: string;
  readonly acquisitionMechanism: BudgetReviewAcquisitionMechanism;
  readonly acquisitionMechanismVersion: string | null;
  readonly status: BudgetReviewSessionStatus;
  readonly rows: ReadonlyArray<BudgetReviewRow>;
  readonly createdBy: BudgetReviewActor;
  readonly createdAt: BudgetReviewTimestamp;
  readonly metadata: BudgetReviewMetadata;
}

export enum BudgetReviewAuditAction {
  RowImported = "RowImported",
  RowConfirmed = "RowConfirmed",
  RowCorrected = "RowCorrected",
  RowExcluded = "RowExcluded",
  RowRestored = "RowRestored",
  RowInsertedManually = "RowInsertedManually",
  BulkConfirmed = "BulkConfirmed",
  SessionConsolidated = "SessionConsolidated",
  ReconciliationAcceptedAsDocumented = "ReconciliationAcceptedAsDocumented",
  BulkReconciliationAcceptedAsDocumented = "BulkReconciliationAcceptedAsDocumented",
}

export interface BudgetReviewFieldChange {
  readonly field: keyof BudgetReviewRowFields;
  readonly previousValue: string | null;
  readonly newValue: string | null;
}

/**
 * Evento de auditoria (enunciado §19) — toda alteração manual gera um
 * evento; nunca existe "último valor editado" sem histórico. `rowId` é
 * `null` apenas para eventos de sessão (ex.: consolidação).
 */
export interface BudgetReviewAuditEvent {
  readonly id: BudgetReviewAuditEventId;
  readonly sessionId: BudgetReviewSessionId;
  readonly rowId: BudgetReviewRowId | null;
  readonly action: BudgetReviewAuditAction;
  readonly actor: BudgetReviewActor;
  readonly occurredAt: BudgetReviewTimestamp;
  readonly fieldChanges: ReadonlyArray<BudgetReviewFieldChange>;
  readonly justification: string | null;
  readonly metadata: BudgetReviewMetadata;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface CreateBudgetReviewSessionInput {
  readonly id: BudgetReviewSessionId;
  readonly procurementCase: ProcurementCase;
  readonly procurementLotId?: string | null;
  readonly budgetVersion: BudgetVersion;
  readonly documentVersion: DocumentVersion;
  readonly sourceSha256: string;
  readonly acquisitionMechanism: BudgetReviewAcquisitionMechanism;
  readonly acquisitionMechanismVersion?: string | null;
  readonly createdBy: BudgetReviewActor;
  readonly createdAt: BudgetReviewTimestamp;
  readonly metadata?: BudgetReviewMetadata;
}

export interface ImportBudgetReviewRowInput {
  readonly id: BudgetReviewRowId;
  readonly kind: BudgetReviewRowKind;
  readonly lotReference: BudgetReviewLotReference;
  readonly parentRowId?: BudgetReviewRowId | null;
  readonly position: number;
  readonly fields: BudgetReviewRowFields;
  readonly page: number | null;
  readonly evidenceText?: string | null;
}

export interface ImportBudgetReviewRowsInput {
  readonly session: BudgetReviewSession;
  readonly rows: ReadonlyArray<ImportBudgetReviewRowInput>;
  readonly actor: BudgetReviewActor;
  readonly occurredAt: BudgetReviewTimestamp;
}

export interface ConfirmBudgetReviewRowInput {
  readonly session: BudgetReviewSession;
  readonly rowId: BudgetReviewRowId;
  readonly actor: BudgetReviewActor;
  readonly occurredAt: BudgetReviewTimestamp;
}

export interface CorrectBudgetReviewRowInput {
  readonly session: BudgetReviewSession;
  readonly rowId: BudgetReviewRowId;
  readonly fields: Partial<BudgetReviewRowFields>;
  readonly justification: string;
  readonly actor: BudgetReviewActor;
  readonly occurredAt: BudgetReviewTimestamp;
}

export interface ExcludeBudgetReviewRowInput {
  readonly session: BudgetReviewSession;
  readonly rowId: BudgetReviewRowId;
  readonly justification: string;
  readonly actor: BudgetReviewActor;
  readonly occurredAt: BudgetReviewTimestamp;
}

export interface RestoreBudgetReviewRowInput {
  readonly session: BudgetReviewSession;
  readonly rowId: BudgetReviewRowId;
  readonly actor: BudgetReviewActor;
  readonly occurredAt: BudgetReviewTimestamp;
}

export interface InsertManualBudgetReviewRowInput {
  readonly session: BudgetReviewSession;
  readonly id: BudgetReviewRowId;
  readonly kind: BudgetReviewRowKind;
  readonly lotReference: BudgetReviewLotReference;
  readonly parentRowId: BudgetReviewRowId | null;
  readonly position: number;
  readonly fields: BudgetReviewRowFields;
  readonly page: number;
  readonly justification: string;
  readonly actor: BudgetReviewActor;
  readonly occurredAt: BudgetReviewTimestamp;
}

export interface BulkConfirmBudgetReviewRowsInput {
  readonly session: BudgetReviewSession;
  readonly rowIds: ReadonlyArray<BudgetReviewRowId>;
  readonly actor: BudgetReviewActor;
  readonly occurredAt: BudgetReviewTimestamp;
}

/**
 * Aceitar uma divergência documental (enunciado da correção §7): a linha
 * precisa ter uma divergência de reconciliação ativa; `revised` nunca é
 * alterado por esta operação — apenas anexa a decisão humana.
 */
export interface AcceptBudgetReviewRowDivergenceInput {
  readonly session: BudgetReviewSession;
  readonly rowId: BudgetReviewRowId;
  readonly justification: string;
  readonly actor: BudgetReviewActor;
  readonly occurredAt: BudgetReviewTimestamp;
}

/** Aceitação em lote — mesma justificativa para todas as linhas selecionadas (enunciado §16). */
export interface BulkAcceptBudgetReviewRowDivergencesInput {
  readonly session: BudgetReviewSession;
  readonly rowIds: ReadonlyArray<BudgetReviewRowId>;
  readonly justification: string;
  readonly actor: BudgetReviewActor;
  readonly occurredAt: BudgetReviewTimestamp;
}

export interface ConsolidateBudgetReviewSessionInput {
  readonly session: BudgetReviewSession;
  readonly actor: BudgetReviewActor;
  readonly occurredAt: BudgetReviewTimestamp;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type BudgetReviewErrorCode =
  | "missing_id"
  | "missing_organization_id"
  | "missing_procurement_case_id"
  | "budget_version_not_draft"
  | "budget_version_case_mismatch"
  | "document_version_case_mismatch"
  | "source_sha256_mismatch"
  | "missing_acquisition_mechanism"
  | "session_consolidated_immutable"
  | "duplicate_row_id"
  | "unknown_row"
  | "missing_parent_row"
  | "parent_from_another_session"
  | "self_parent"
  | "incompatible_parent_kind"
  | "invalid_position"
  | "duplicate_position"
  | "row_not_pending"
  | "row_is_manual_insertion"
  | "missing_justification"
  | "missing_page_evidence"
  | "no_op_fields"
  | "row_not_excluded"
  | "empty_row_selection"
  | "row_has_active_inconsistency"
  | "row_not_confirmable"
  | "no_active_divergence"
  | "consolidation_blocked";

export interface BudgetReviewError {
  readonly code: BudgetReviewErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: BudgetReviewMetadata;
}

export interface BudgetReviewSuccess {
  readonly success: true;
  readonly session: BudgetReviewSession;
  readonly auditEvents: ReadonlyArray<BudgetReviewAuditEvent>;
  readonly errors: ReadonlyArray<BudgetReviewError>;
  readonly metadata: BudgetReviewMetadata;
}

export interface BudgetReviewFailure {
  readonly success: false;
  readonly session: null;
  readonly auditEvents: ReadonlyArray<BudgetReviewAuditEvent>;
  readonly errors: ReadonlyArray<BudgetReviewError>;
  readonly metadata: BudgetReviewMetadata;
}

export type BudgetReviewResult = BudgetReviewSuccess | BudgetReviewFailure;

// ---------------------------------------------------------------------------
// Reconciliação (determinística, sem LLM — enunciado §36)
// ---------------------------------------------------------------------------

export type BudgetReviewReconciliationStatus = "matches" | "diverges" | "insufficient_data" | "not_applicable";

export interface BudgetReviewServiceItemReconciliation {
  readonly rowId: BudgetReviewRowId;
  readonly status: BudgetReviewReconciliationStatus;
  readonly derivedTotalCents: MoneyCents | null;
  readonly documentedTotalCents: MoneyCents | null;
  readonly differenceCents: number | null;
}

export interface BudgetReviewGroupReconciliation {
  readonly rowId: BudgetReviewRowId;
  readonly status: BudgetReviewReconciliationStatus;
  readonly derivedTotalCents: MoneyCents | null;
  readonly documentedTotalCents: MoneyCents | null;
  readonly differenceCents: number | null;
}

export interface BudgetReviewConsolidationReadiness {
  readonly ready: boolean;
  readonly blockers: ReadonlyArray<string>;
  readonly pendingRowCount: number;
  readonly divergentReconciliationCount: number;
}
