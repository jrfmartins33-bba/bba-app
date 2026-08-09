import type {
  ArithmeticEvaluationOutcome,
  BudgetColumnRole,
  BudgetTableReconstructionResult,
  ParsedNumericEvidence,
  ReconstructedRecordKind,
  ReconstructionCompleteness,
  ReconstructionIssue,
  SemanticResolutionStatus,
} from "@bba/bdos-core/domain/budget-table-reconstruction.types";

// Epic 21 — Laboratório de Reconstrução Orçamentária. Este módulo é a
// ÚNICA camada que olha para o formato bruto do Motor Determinístico
// (BudgetTableReconstructionResult, já produzido e congelado em
// packages/bdos-core/src/domain/budget-table-reconstruction/ — PR #83).
// Ele SOMENTE conta, agrupa, traduz status/kind para rótulos em
// português e prepara os campos de exibição já existentes
// (ParsedNumericEvidence.rawText) para a tela. Nunca recalcula preço,
// BDI, total ou status -- toda decisão semântica já foi tomada pelo
// motor e é honrada aqui tal como veio. Retorna uma projeção compacta
// (BudgetReconstructionLabViewModel) para que a página React nunca
// precise reter em estado o resultado bruto inteiro (que pode ter
// dezenas de milhares de textItems/fragments/segments).

export type LabRecordStatusTone = "green" | "amber" | "red" | "neutral";

export interface LabNumericField {
  readonly rawText: string;
  readonly status: ParsedNumericEvidence["status"];
  readonly grammarId: string;
  readonly hasConflict: boolean;
  readonly sourceCellIds: ReadonlyArray<string>;
  readonly sourceFragmentIds: ReadonlyArray<string>;
}

export interface BudgetReconstructionLabRecord {
  readonly recordId: string;
  readonly kind: ReconstructedRecordKind;
  readonly kindLabel: string;
  readonly status: SemanticResolutionStatus;
  readonly statusLabel: string;
  readonly statusTone: LabRecordStatusTone;
  readonly pageNumber: number;
  readonly documentOrder: number;
  readonly parentRecordId: string | null;
  readonly rowIds: ReadonlyArray<string>;
  readonly itemCode: string | null;
  readonly description: string | null;
  readonly unit: string | null;
  readonly quantity: LabNumericField | null;
  readonly unitCost: LabNumericField | null;
  readonly bdiRate: LabNumericField | null;
  readonly unitPrice: LabNumericField | null;
  readonly totalPrice: LabNumericField | null;
  readonly hasNumericConflict: boolean;
}

export interface BudgetReconstructionLabColumnEntry {
  readonly role: BudgetColumnRole;
  readonly status: SemanticResolutionStatus;
}

export interface BudgetReconstructionLabPageColumns {
  readonly pageNumber: number;
  readonly columns: ReadonlyArray<BudgetReconstructionLabColumnEntry>;
}

export interface BudgetReconstructionLabSummary {
  readonly resultStatus: BudgetTableReconstructionResult["status"];
  readonly engineName: string;
  readonly engineVersion: string;
  readonly profileId: string;
  readonly profileVersion: number;
  readonly canonicalFingerprint: string;
  readonly sourceByteHash: string;
  readonly pageSelectionDisplay: string;
  readonly pageCount: number;
  readonly totalRecordCount: number;
  readonly serviceItemCount: number;
  readonly resolvedServiceItemCount: number;
  readonly needsReviewServiceItemCount: number;
  readonly insufficientEvidenceServiceItemCount: number;
  readonly unclassifiedCount: number;
  readonly investedEvidenceCount: number;
  readonly structuralIssueCount: number;
  readonly textItemCount: number;
  readonly fragmentCount: number;
  readonly segmentCount: number;
  readonly cellCount: number;
}

export interface BudgetReconstructionLabViewModel {
  readonly summary: BudgetReconstructionLabSummary;
  readonly records: ReadonlyArray<BudgetReconstructionLabRecord>;
  readonly columnsByPage: ReadonlyArray<BudgetReconstructionLabPageColumns>;
  readonly arithmeticOutcomeCounts: ReadonlyArray<{
    readonly outcome: ArithmeticEvaluationOutcome;
    readonly outcomeLabel: string;
    readonly count: number;
  }>;
  readonly completeness: ReconstructionCompleteness;
  readonly structuralIssues: ReadonlyArray<ReconstructionIssue>;
}

export const RECORD_KIND_LABELS: Readonly<Record<ReconstructedRecordKind, string>> = {
  service_item: "Item de Serviço",
  group: "Grupo",
  subgroup: "Subgrupo",
  subtotal: "Subtotal",
  total: "Total",
  unclassified: "Não classificado",
};

export const RECORD_STATUS_LABELS: Readonly<Record<SemanticResolutionStatus, string>> = {
  resolved: "Resolvido",
  ambiguous: "Precisa de revisão",
  insufficient_evidence: "Evidência insuficiente",
  not_applicable: "Não aplicável",
  failed: "Falha",
};

/** ParsedNumericEvidence.status is a distinct union from
 * SemanticResolutionStatus (it has "invalid", not "insufficient_evidence")
 * -- kept as its own label map rather than forcing both onto one type. */
export const NUMERIC_FIELD_STATUS_LABELS: Readonly<Record<ParsedNumericEvidence["status"], string>> = {
  resolved: "Resolvido",
  ambiguous: "Precisa de revisão",
  invalid: "Não interpretável",
  not_applicable: "Não aplicável",
  failed: "Falha",
};

const RECORD_STATUS_TONE: Readonly<Record<SemanticResolutionStatus, LabRecordStatusTone>> = {
  resolved: "green",
  ambiguous: "amber",
  insufficient_evidence: "red",
  failed: "red",
  not_applicable: "neutral",
};

const ARITHMETIC_OUTCOME_LABELS: Readonly<Record<ArithmeticEvaluationOutcome, string>> = {
  direct_correspondence: "Correspondência direta",
  undisplayed_precision: "Precisão não exibida",
  source_arithmetic_inconsistency: "Inconsistência na fonte",
  insufficient_evidence: "Evidência insuficiente",
  missing_cell: "Célula ausente",
  divergent_cell: "Célula divergente",
  invented_evidence: "Evidência inventada",
  not_applicable: "Não aplicável",
};

const ARITHMETIC_OUTCOME_ORDER: ReadonlyArray<ArithmeticEvaluationOutcome> = [
  "direct_correspondence",
  "undisplayed_precision",
  "source_arithmetic_inconsistency",
  "insufficient_evidence",
  "missing_cell",
  "divergent_cell",
  "invented_evidence",
  "not_applicable",
];

function projectNumericField(value: ParsedNumericEvidence | null): LabNumericField | null {
  if (value === null) {
    return null;
  }
  return {
    rawText: value.rawText,
    status: value.status,
    grammarId: value.grammarId,
    hasConflict: value.grammarId === "divergent-source-cells-v1",
    sourceCellIds: value.sourceCellIds,
    sourceFragmentIds: value.sourceFragmentIds,
  };
}

function projectRecord(
  record: BudgetTableReconstructionResult["records"][number],
): BudgetReconstructionLabRecord {
  const quantity = projectNumericField(record.quantity);
  const unitCost = projectNumericField(record.unitCost);
  const bdiRate = projectNumericField(record.bdiRate);
  const unitPrice = projectNumericField(record.unitPrice);
  const totalPrice = projectNumericField(record.totalPrice);
  return {
    recordId: record.recordId,
    kind: record.kind,
    kindLabel: RECORD_KIND_LABELS[record.kind],
    status: record.status,
    statusLabel: RECORD_STATUS_LABELS[record.status],
    statusTone: RECORD_STATUS_TONE[record.status],
    pageNumber: record.pageNumber,
    documentOrder: record.documentOrder,
    parentRecordId: record.parentRecordId,
    rowIds: record.rowIds,
    itemCode: record.itemCode,
    description: record.description,
    unit: record.unit,
    quantity,
    unitCost,
    bdiRate,
    unitPrice,
    totalPrice,
    hasNumericConflict: [quantity, unitCost, bdiRate, unitPrice, totalPrice].some(
      (field) => field?.hasConflict === true,
    ),
  };
}

function pageSelectionDisplay(pageSelection: BudgetTableReconstructionResult["pageSelection"]): string {
  if (pageSelection === "all") {
    return "Todas";
  }
  return pageSelection.join(", ");
}

/**
 * Pure, deterministic projection: BudgetTableReconstructionResult produced
 * by the frozen Motor Determinístico -> compact view model for the Lab UI.
 * No arithmetic is performed here beyond counting/grouping records the
 * motor already classified -- every displayed economic value is the
 * motor's own `rawText`, never re-derived from `ExactRational`.
 */
export function buildBudgetReconstructionLabViewModel(
  result: BudgetTableReconstructionResult,
): BudgetReconstructionLabViewModel {
  const records = result.records.map(projectRecord);
  const serviceItems = records.filter((record) => record.kind === "service_item");
  const unclassifiedCount = records.filter((record) => record.kind === "unclassified").length;

  const pageNumbers = [...new Set(result.columns.map((column) => column.pageNumber))].sort(
    (left, right) => left - right,
  );
  const columnsByPage: ReadonlyArray<BudgetReconstructionLabPageColumns> = pageNumbers.map((pageNumber) => ({
    pageNumber,
    columns: result.columns
      .filter((column) => column.pageNumber === pageNumber)
      .map((column) => ({ role: column.role, status: column.status })),
  }));

  const outcomeCounts = new Map<ArithmeticEvaluationOutcome, number>();
  for (const evaluation of result.arithmeticEvaluations) {
    outcomeCounts.set(evaluation.outcome, (outcomeCounts.get(evaluation.outcome) ?? 0) + 1);
  }
  const arithmeticOutcomeCounts = ARITHMETIC_OUTCOME_ORDER.filter((outcome) => outcomeCounts.has(outcome)).map(
    (outcome) => ({
      outcome,
      outcomeLabel: ARITHMETIC_OUTCOME_LABELS[outcome],
      count: outcomeCounts.get(outcome)!,
    }),
  );

  const summary: BudgetReconstructionLabSummary = {
    resultStatus: result.status,
    engineName: result.engineName,
    engineVersion: result.engineVersion,
    profileId: result.profileId,
    profileVersion: result.profileVersion,
    // Real files from the executor script are written with
    // `omitCanonicalFingerprint: true` and genuinely lack this field, even
    // though the domain type declares it non-optional -- fall back rather
    // than display "undefined".
    canonicalFingerprint: result.canonicalFingerprint ?? "Não incluído neste arquivo",
    sourceByteHash: result.sourceIdentity.sourceByteHash,
    pageSelectionDisplay: pageSelectionDisplay(result.pageSelection),
    pageCount: result.pages.length,
    totalRecordCount: records.length,
    serviceItemCount: serviceItems.length,
    resolvedServiceItemCount: serviceItems.filter((record) => record.status === "resolved").length,
    needsReviewServiceItemCount: serviceItems.filter((record) => record.status === "ambiguous").length,
    insufficientEvidenceServiceItemCount: serviceItems.filter(
      (record) => record.status === "insufficient_evidence",
    ).length,
    unclassifiedCount,
    investedEvidenceCount: outcomeCounts.get("invented_evidence") ?? 0,
    structuralIssueCount: result.structuralIssues.length,
    textItemCount: result.textItems.length,
    fragmentCount: result.fragments.length,
    segmentCount: result.segments.length,
    cellCount: result.cells.length,
  };

  return {
    summary,
    records,
    columnsByPage,
    arithmeticOutcomeCounts,
    completeness: result.completeness,
    structuralIssues: result.structuralIssues,
  };
}

export interface BudgetReconstructionLabValidationFailure {
  readonly valid: false;
  readonly message: string;
}

export interface BudgetReconstructionLabValidationSuccess {
  readonly valid: true;
  readonly result: BudgetTableReconstructionResult;
}

export type BudgetReconstructionLabValidationOutcome =
  | BudgetReconstructionLabValidationFailure
  | BudgetReconstructionLabValidationSuccess;

const INVALID_FILE_MESSAGE = "Este arquivo não parece ser um resultado válido do Motor Determinístico.";

/**
 * `canonicalFingerprint` is deliberately NOT checked here. The executor
 * script (run-budget-table-reconstruction-v1.ts) writes its canonical
 * output with `omitCanonicalFingerprint: true` -- the field is genuinely
 * absent from every real result file a Lab user will actually have on
 * disk, even though the domain's own BudgetTableReconstructionResult type
 * always carries it. Requiring it here would reject every real file.
 */
function looksLikeReconstructionResult(candidate: unknown): candidate is BudgetTableReconstructionResult {
  if (candidate === null || typeof candidate !== "object") {
    return false;
  }
  const value = candidate as Record<string, unknown>;
  return (
    value.schemaVersion === 2 &&
    value.engineName === "budget-table-reconstruction-engine" &&
    typeof value.engineVersion === "string" &&
    typeof value.profileId === "string" &&
    typeof value.profileVersion === "number" &&
    (value.pageSelection === "all" || Array.isArray(value.pageSelection)) &&
    Array.isArray(value.pages) &&
    Array.isArray(value.columns) &&
    Array.isArray(value.records) &&
    Array.isArray(value.arithmeticEvaluations) &&
    Array.isArray(value.structuralIssues)
  );
}

/**
 * Light structural validation only -- confirms the shape a Lab consumer
 * needs is present, never reimplements the domain's own schema/fingerprint/
 * canonicalization checks (those live in packages/bdos-core and were
 * already applied when this file was produced by the executor). Accepts
 * both the raw BudgetTableReconstructionResult and the diagnostic wrapper
 * ({ schemaVersion, executionManifest, reconstruction }) the executor
 * script (run-budget-table-reconstruction-v1.ts) actually writes to disk,
 * since that wrapper is what a real Lab user will have on hand.
 */
export function validateBudgetReconstructionLabInput(
  parsed: unknown,
): BudgetReconstructionLabValidationOutcome {
  if (parsed === null || typeof parsed !== "object") {
    return { valid: false, message: INVALID_FILE_MESSAGE };
  }
  const wrapper = parsed as Record<string, unknown>;
  if (looksLikeReconstructionResult(wrapper.reconstruction)) {
    return { valid: true, result: wrapper.reconstruction };
  }
  if (looksLikeReconstructionResult(parsed)) {
    return { valid: true, result: parsed };
  }
  return { valid: false, message: INVALID_FILE_MESSAGE };
}
