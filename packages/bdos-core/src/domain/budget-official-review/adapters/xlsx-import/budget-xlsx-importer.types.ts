import type { ImportBudgetReviewRowInput } from "../../budget-official-review.types";

// ---------------------------------------------------------------------------
// Importer version — bump when parse logic changes to enable regression gate
// ---------------------------------------------------------------------------

export const BUDGET_XLSX_IMPORTER_VERSION = "budget-xlsx-import-v1" as const;
export type BudgetXlsxImporterVersion = typeof BUDGET_XLSX_IMPORTER_VERSION;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Contexto fornecido pelo orquestrador ao importador — nunca inferido do
 * conteúdo do XLSX (ex.: `lotReference` não é deduzido do filename).
 */
export interface BudgetXlsxImportContext {
  /**
   * Referência do lote de licitação ao qual este XLSX pertence (ex.: "Lote 01").
   * Fornecida pelo orquestrador, nunca inferida do conteúdo ou nome do arquivo.
   */
  readonly lotReference: string;
  /**
   * Nome original do arquivo — metadado de evidência, nunca usado para
   * detectar estrutura ou tomar decisão lógica.
   */
  readonly sourceFileName: string;
  /**
   * SHA-256 do arquivo XLSX (calculado externamente) — incorporado na
   * evidência de cada linha importada.
   */
  readonly sourceSha256: string;
  /** Versão explícita do importador — garante rastreabilidade do mecanismo. */
  readonly importerVersion: BudgetXlsxImporterVersion;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export type BudgetXlsxDiagnosticSeverity = "info" | "warning" | "error";

export interface BudgetXlsxImportDiagnostic {
  readonly severity: BudgetXlsxDiagnosticSeverity;
  /**
   * Código estruturado do diagnóstico — determinístico, nunca contém texto
   * livre ou linguagem natural. Exemplos: "SHEET_NOT_FOUND",
   * "AMBIGUOUS_SHEET", "MISSING_REQUIRED_COLUMN", "ORPHAN_ROW".
   */
  readonly code: string;
  /** Mensagem humana, factual e determinística — sem "provavelmente" ou heurística. */
  readonly message: string;
  /** Contexto estruturado adicional — valores factuais da fonte. */
  readonly context?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface BudgetXlsxImportSummary {
  readonly groupCount: number;
  readonly subgroupCount: number;
  readonly serviceItemCount: number;
  readonly totalRowCount: number;
  readonly skippedRowCount: number;
  readonly orphanCount: number;
  readonly sheetName: string | null;
  readonly headerRowNumber: number | null;
}

export interface BudgetXlsxImportResult {
  /**
   * Linhas candidatas prontas para serem passadas a
   * `importBudgetReviewRows()`. Array vazio se houve erro estrutural que
   * impediu a importação.
   */
  readonly rows: ReadonlyArray<ImportBudgetReviewRowInput>;
  readonly diagnostics: ReadonlyArray<BudgetXlsxImportDiagnostic>;
  readonly summary: BudgetXlsxImportSummary;
}

// ---------------------------------------------------------------------------
// Column roles (detected semantically, never hardcoded to letter/index)
// ---------------------------------------------------------------------------

export type BudgetColumnRole =
  | "itemCode"
  | "sourceCode"
  | "sourceType"
  | "description"
  | "unit"
  | "quantity"
  | "unitCostNoBdi"
  | "bdiPct"
  | "unitPriceWithBdi"
  | "total";

export interface DetectedColumnRole {
  readonly role: BudgetColumnRole;
  /** 0-based column index (A = 0, B = 1, ...). */
  readonly columnIndex: number;
  /** Original column letter reference (e.g. "B"). */
  readonly columnRef: string;
}
