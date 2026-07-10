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
export type ProcessMeasurementBulletinImportOutcomeKind =
  | "completed"
  | "already_completed"
  | "already_processing"
  | "resumed"
  | "workspace_closed"
  | "workspace_cancelled"
  | "failed";

export interface ProcessMeasurementBulletinImportOutcome {
  readonly kind: ProcessMeasurementBulletinImportOutcomeKind;
  readonly measurementWorkspaceId: string | null;
  readonly issues: ReadonlyArray<MeasurementImportIssue>;
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

export type { ParsedMeasurementBulletin };
