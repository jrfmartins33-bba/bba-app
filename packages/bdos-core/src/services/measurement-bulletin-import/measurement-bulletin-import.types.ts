/**
 * Epic 19, Sprint 4.0 (Contract Freeze) — contratos dos Application
 * Services do Studio de Medições. Só tipos — nenhuma implementação
 * nesta sprint (Sprint 4A/D implementam).
 *
 * Padrão obrigatório para este domínio: Route Handler → Application
 * Service → Parser ou Repository, nunca Route Handler → Repository
 * diretamente, nunca Parser → INSERT. Decisão ratificada explicitamente
 * como padrão local do Measurement Studio — seus casos de uso
 * coordenam múltiplos aggregates, reconciliação, idempotência,
 * numeração e transições de estado, o que justifica a camada aqui.
 * Não é uma regra retroativa para o Epic 18 (cujo `process/route.ts`
 * chama repository diretamente) nem uma regra automática para o
 * restante do bdos-core — uma adoção mais ampla, se vier, exige
 * evidência própria de necessidade, decidida separadamente.
 */

import type {
  MeasurementImportIssue,
  ParsedMeasurementBulletin,
  ParsedSkippedSheet,
} from "../../domain/measurement-workspace/adapters/excel-import/bulletin-import.types";

// ---------------------------------------------------------------
// prepareMeasurementBulletinUpload
// ---------------------------------------------------------------

export interface PrepareMeasurementBulletinUploadInput {
  readonly companyId: string;
  readonly engineeringProjectId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedBy: string;
}

export type PrepareMeasurementBulletinUploadErrorCode =
  | "unsupported_file_type"
  | "file_too_large";

export interface PrepareMeasurementBulletinUploadSuccess {
  readonly success: true;
  readonly measurementBulletinImportId: string;
  readonly storagePath: string;
}

export interface PrepareMeasurementBulletinUploadFailure {
  readonly success: false;
  readonly error: PrepareMeasurementBulletinUploadErrorCode;
}

export type PrepareMeasurementBulletinUploadResult =
  | PrepareMeasurementBulletinUploadSuccess
  | PrepareMeasurementBulletinUploadFailure;

// ---------------------------------------------------------------
// confirmMeasurementBulletinUpload
// ---------------------------------------------------------------

export interface ConfirmMeasurementBulletinUploadInput {
  readonly companyId: string;
  readonly measurementBulletinImportId: string;
}

export type ConfirmMeasurementBulletinUploadErrorCode =
  | "import_not_found"
  | "invalid_status_for_confirmation"
  | "upload_not_found";

export interface ConfirmMeasurementBulletinUploadSuccess {
  readonly success: true;
}

export interface ConfirmMeasurementBulletinUploadFailure {
  readonly success: false;
  readonly error: ConfirmMeasurementBulletinUploadErrorCode;
}

export type ConfirmMeasurementBulletinUploadResult =
  | ConfirmMeasurementBulletinUploadSuccess
  | ConfirmMeasurementBulletinUploadFailure;

// ---------------------------------------------------------------
// processMeasurementBulletinImport
// ---------------------------------------------------------------

export interface ProcessMeasurementBulletinImportInput {
  readonly companyId: string;
  readonly measurementBulletinImportId: string;
}

/**
 * Mapa de retomada por estado — congelado nesta sprint, mesmo que a
 * implementação completa de cada ramo venha depois (Sprint 4D):
 *
 * | Estado observado | Resultado |
 * |---|---|
 * | `measurement_bulletin_imports.status = 'completed'` | `already_completed` — devolve o workspace já existente, nunca reprocessa. |
 * | `measurement_bulletin_imports.status = 'processing'` | `already_processing` — recusa, evita processamento concorrente. |
 * | `status = 'failed'` e existe workspace parcial (`uq_measurement_workspaces_bulletin_import` já apontava para um workspace) | `resumed` — retoma de forma controlada a partir do workspace existente, nunca cria um segundo. |
 * | Workspace vinculado está `Closed` | `workspace_closed` — nunca reprocessa nem altera; o boletim, se já gerado, é o resultado. |
 * | Workspace vinculado está `Cancelled` | `workspace_cancelled` — nunca ressuscita automaticamente; exige decisão humana fora deste caso de uso. |
 * | Nenhum dos casos acima | `completed` (parse + materialização bem-sucedidos) ou `failed` (erro genuíno) |
 *
 * A concorrência de `find-or-create` de `WorkPackage`/`ManagedServiceItem`
 * dentro deste caso de uso segue sempre: tentar localizar → tentar
 * inserir → em `unique_violation`, reler o existente → nunca criar
 * identidade alternativa nem gerar código novo silenciosamente.
 */
// "workspace_ready_for_review" -- correção 1 da revisão de arquitetura
// registrada em EPIC_19_SPRINT_4D_APPLICATION_SERVICE_DESIGN.md: um
// workspace em ReadyForReview nunca é retomado automaticamente, mesmo
// que a intenção seja só completar linhas ausentes -- exige ação
// humana explícita, fora deste caso de uso.
export type ProcessMeasurementBulletinImportOutcomeKind =
  | "completed"
  | "already_completed"
  | "already_processing"
  | "resumed"
  | "workspace_ready_for_review"
  | "workspace_closed"
  | "workspace_cancelled"
  | "failed";

export interface ProcessMeasurementBulletinImportOutcome {
  readonly kind: ProcessMeasurementBulletinImportOutcomeKind;
  readonly measurementWorkspaceId: string | null;
  readonly issues: ReadonlyArray<MeasurementImportIssue>;
  // Sprint 4D.2 -- aditivo ao contrato congelado da 4.0. `null` só nos
  // early exits que genuinamente não têm análise para mostrar
  // (already_processing, workspace_ready_for_review, workspace_closed,
  // workspace_cancelled). already_completed/resumed/completed/failed
  // (por gate) sempre carregam o snapshot persistido.
  readonly analysisResult: MeasurementAnalysisResult | null;
}

export interface ProcessMeasurementBulletinImportSuccess {
  readonly success: true;
  readonly outcome: ProcessMeasurementBulletinImportOutcome;
}

export type ProcessMeasurementBulletinImportErrorCode =
  | "import_not_found"
  | "download_failed"
  | "parse_failed";

export interface ProcessMeasurementBulletinImportFailure {
  readonly success: false;
  readonly error: ProcessMeasurementBulletinImportErrorCode;
  // Sprint 4D.2 -- aditivo. Presente para download_failed/parse_failed
  // (um FailedMeasurementAnalysisResult foi persistido antes de
  // devolver o erro); ausente para import_not_found (nada foi
  // persistido, porque o import nem foi encontrado).
  readonly analysisResult?: MeasurementAnalysisResult;
}

export type ProcessMeasurementBulletinImportResult =
  | ProcessMeasurementBulletinImportSuccess
  | ProcessMeasurementBulletinImportFailure;

// ---------------------------------------------------------------
// closeMeasurementWorkspace
// ---------------------------------------------------------------

export interface CloseMeasurementWorkspaceInput {
  readonly companyId: string;
  readonly measurementWorkspaceId: string;
  readonly actor: string;
}

export type CloseMeasurementWorkspaceErrorCode =
  | "workspace_not_found"
  | "invalid_status_for_close";

export interface CloseMeasurementWorkspaceSuccess {
  readonly success: true;
}

export interface CloseMeasurementWorkspaceFailure {
  readonly success: false;
  readonly error: CloseMeasurementWorkspaceErrorCode;
}

export type CloseMeasurementWorkspaceResult =
  | CloseMeasurementWorkspaceSuccess
  | CloseMeasurementWorkspaceFailure;

// ---------------------------------------------------------------
// generateMeasurementBulletin
// ---------------------------------------------------------------

export interface GenerateMeasurementBulletinInput {
  readonly companyId: string;
  readonly measurementWorkspaceId: string;
  readonly actor: string;
}

/**
 * Regra de numeração (ratificada na revisão do desenho): o parser só
 * entrega `declaredBulletinNumber` (o que o arquivo afirmava — ver
 * `ParsedMeasurementBulletin`). Este caso de uso decide o número
 * oficial: se `declaredBulletinNumber` não colide com nenhum boletim
 * já existente no projeto (mesmo número, documento/período
 * incompatível), ele pode ser adotado como oficial; caso colida ou
 * esteja ausente, o Application Service atribui
 * `MAX(bulletin_number) + 1` por projeto e sinaliza a divergência via
 * `bulletin_number_conflict`, nunca sobrescreve silenciosamente.
 */
export type GenerateMeasurementBulletinErrorCode =
  | "workspace_not_found"
  | "workspace_not_closed"
  | "no_lines_to_generate"
  | "bulletin_number_conflict";

export interface GenerateMeasurementBulletinSuccess {
  readonly success: true;
  readonly measurementBulletinId: string;
  readonly bulletinNumber: number;
}

export interface GenerateMeasurementBulletinFailure {
  readonly success: false;
  readonly error: GenerateMeasurementBulletinErrorCode;
}

export type GenerateMeasurementBulletinResult =
  | GenerateMeasurementBulletinSuccess
  | GenerateMeasurementBulletinFailure;

// ---------------------------------------------------------------
// finalizeMeasurementBulletin
// ---------------------------------------------------------------

export interface FinalizeMeasurementBulletinInput {
  readonly companyId: string;
  readonly measurementBulletinId: string;
  readonly actor: string;
}

export type FinalizeMeasurementBulletinErrorCode =
  | "bulletin_not_found"
  | "invalid_status_for_finalize";

export interface FinalizeMeasurementBulletinSuccess {
  readonly success: true;
}

export interface FinalizeMeasurementBulletinFailure {
  readonly success: false;
  readonly error: FinalizeMeasurementBulletinErrorCode;
}

export type FinalizeMeasurementBulletinResult =
  | FinalizeMeasurementBulletinSuccess
  | FinalizeMeasurementBulletinFailure;

// ---------------------------------------------------------------
// MeasurementAnalysisResult (Sprint 4D.0 — tipos versionados,
// congelados pela revisão de arquitetura registrada em
// EPIC_19_SPRINT_4D_APPLICATION_SERVICE_DESIGN.md, Parte X e
// correção 3. Groundwork apenas: o wiring completo — este tipo
// entrando em ProcessMeasurementBulletinImportResult e sendo de fato
// produzido/persistido — é escopo da Sprint 4D.2, não desta.
//
// União discriminada por `status`, não uma interface única com
// `measurementWorkspaceId: string` obrigatório: o gate de
// reconciliação pode recusar um boletim antes da criação do
// workspace em MODO FRESCO, então um resultado de falha pode
// legitimamente não ter workspace. `schemaVersion`/`parserKey`/
// `generatedAt` são obrigatórios em ambos os ramos para que um
// resultado antigo, uma vez persistido em
// measurement_bulletin_imports.analysis_result, nunca seja
// interpretado como se tivesse sido produzido pelo parser/schema
// atual.
// ---------------------------------------------------------------

export const MEASUREMENT_ANALYSIS_RESULT_SCHEMA_VERSION = 1 as const;
export const MEASUREMENT_ANALYSIS_PARSER_KEY = "dnocs-measurement-bulletin-v1" as const;

/**
 * ISO 8601 com timezone UTC (formato de `Date.prototype.toISOString()`)
 * -- alias de domínio só para deixar o contrato explícito; sem isso,
 * daqui a meses ninguém saberia, só olhando `generatedAt: string`, se
 * é UTC, local, epoch ou RFC3339. Mesmo padrão já usado alhures neste
 * pacote (ex.: `MeasurementDate`, `ExecutionDateTime`) -- alias local
 * por módulo, não um tipo global compartilhado.
 */
export type MeasurementAnalysisDateTime = string;

interface MeasurementAnalysisResultBase {
  readonly schemaVersion: typeof MEASUREMENT_ANALYSIS_RESULT_SCHEMA_VERSION;
  readonly parserKey: typeof MEASUREMENT_ANALYSIS_PARSER_KEY;
  readonly generatedAt: MeasurementAnalysisDateTime;

  readonly measurementBulletinImportId: string;
  readonly engineeringProjectId: string;

  readonly declaredBulletinNumber: number | null;
  readonly declaredPeriod: {
    readonly startDate: string | null;
    readonly endDate: string | null;
    readonly labels: ReadonlyArray<string>;
  } | null;

  /** Passthrough direto do parser -- não reprocessado, não reinterpretado. */
  readonly structuralIssues: ReadonlyArray<MeasurementImportIssue>;
  readonly skippedSheets: ReadonlyArray<ParsedSkippedSheet>;
}

export interface ReconciledOrNeedsReviewMeasurementAnalysisResult extends MeasurementAnalysisResultBase {
  readonly status: "reconciled" | "needs_review";
  readonly measurementWorkspaceId: string;

  /**
   * Calculado a partir das linhas relidas do banco após a
   * materialização, nunca do DTO do parser em memória.
   * `totalDifference = recalculatedTotal - officialPeriodTotal`;
   * `status = "reconciled"` exige, além de nenhuma issue blocking,
   * `abs(totalDifference) <= 0.01` -- tolerância explícita de 1
   * centavo, nunca igualdade binária de ponto flutuante.
   */
  readonly officialPeriodTotal: number;
  readonly recalculatedTotal: number;
  readonly totalDifference: number;

  readonly workPackages: { readonly created: number; readonly matched: number };
  readonly serviceItems: { readonly created: number; readonly matched: number };
  readonly lines: {
    readonly imported: number;
    /** Colisão 23505 com valores idênticos aos já persistidos. */
    readonly alreadyPresent: number;
    /** Colisão 23505 com valores divergentes, atualizados explicitamente. */
    readonly updated: number;
    readonly skippedZeroValue: number;
  };
}

export interface FailedMeasurementAnalysisResult extends MeasurementAnalysisResultBase {
  readonly status: "failed";
  /**
   * Nulo quando o gate de reconciliação recusa antes da criação do
   * workspace em MODO FRESCO. Não-nulo quando a falha ocorre em MODO
   * RETOMADA ou após o workspace já existir.
   */
  readonly measurementWorkspaceId: string | null;
}

export type MeasurementAnalysisResult =
  | ReconciledOrNeedsReviewMeasurementAnalysisResult
  | FailedMeasurementAnalysisResult;

export type { ParsedMeasurementBulletin };
