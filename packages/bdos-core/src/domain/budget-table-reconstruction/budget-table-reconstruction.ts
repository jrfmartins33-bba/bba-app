import { evaluateArithmetic } from "./budget-table-reconstruction-arithmetic";
import { formCells } from "./budget-table-reconstruction-cell-formation";
import {
  resolveColumns,
  selectBudgetHeaderProvenance,
} from "./budget-table-reconstruction-column-resolution";
import { conserveEvidence } from "./budget-table-reconstruction-conservation";
import { buildEvidenceGraph } from "./budget-table-reconstruction-evidence-graph";
import { exactFraction } from "./budget-table-reconstruction-exact-rational";
import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import { validateBudgetTableReconstructionInput } from "./budget-table-reconstruction-input-validation";
import { formLogicalRows } from "./budget-table-reconstruction-logical-row-formation";
import {
  BUDGET_TABLE_RECONSTRUCTION_ENGINE_NAME,
  BUDGET_TABLE_RECONSTRUCTION_ENGINE_VERSION,
  BUDGET_TABLE_RECONSTRUCTION_PROFILE,
} from "./budget-table-reconstruction-profile";
import { classifyRecords } from "./budget-table-reconstruction-record-classification";
import type {
  BudgetColumnRole,
  BudgetTableReconstructionInput,
  BudgetTableReconstructionResult,
  ParsedNumericEvidence,
  ReconstructedBudgetRecord,
  ReconstructionCompleteness,
  ReconstructionIssue,
  ReconstructionSourceIdentity,
} from "./budget-table-reconstruction.types";

const APPLICABLE_SERVICE_FIELDS: ReadonlyArray<BudgetColumnRole> = [
  "unit",
  "quantity",
  "unit_cost",
  "bdi_rate",
  "unit_price",
  "total_price",
];

function sourceIdentity(input: BudgetTableReconstructionInput): ReconstructionSourceIdentity {
  return {
    sourceByteHash: input.physicalRead.sourceByteHash,
    physicalReaderName: input.physicalRead.readerName,
    physicalReaderVersion: input.physicalRead.readerVersion,
    physicalAdapterVersion: input.physicalRead.adapterVersion,
    underlyingLibraryVersion: input.physicalRead.underlyingLibraryVersion,
    physicalGeometryContextFingerprint: input.physicalRead.geometryContextFingerprint,
    pageLocatorName: input.pageLocation.locatorName,
    pageLocatorVersion: input.pageLocation.locatorVersion,
    structureReconstructorName: input.structureReconstruction.reconstructorName,
    structureReconstructorVersion: input.structureReconstruction.reconstructorVersion,
    structureFingerprint: input.structureReconstruction.reconstructionContextFingerprint,
    columnFingerprint:
      input.columnEvidence.availability === "available"
        ? input.columnEvidence.result.reconstructionContextFingerprint
        : null,
    physicalCellFingerprint:
      input.physicalCellEvidence.availability === "available"
        ? input.physicalCellEvidence.cellHypothesisFormation.formationContextFingerprint
        : null,
    physicalCellTextFingerprint:
      input.physicalCellEvidence.availability === "available"
        ? input.physicalCellEvidence.cellTextEvidenceFormation.formationContextFingerprint
        : null,
  };
}

function normalizedPageSelection(
  selection: BudgetTableReconstructionInput["pageSelection"],
): BudgetTableReconstructionResult["pageSelection"] {
  return selection === "all"
    ? "all"
    : [...new Set(selection)].sort((left, right) => left - right);
}

function numericField(
  record: ReconstructedBudgetRecord,
  role: BudgetColumnRole,
): ParsedNumericEvidence | null {
  switch (role) {
    case "quantity":
      return record.quantity;
    case "unit_cost":
      return record.unitCost;
    case "bdi_rate":
      return record.bdiRate;
    case "unit_price":
      return record.unitPrice;
    case "total_price":
      return record.totalPrice;
    default:
      return null;
  }
}

function completeness(
  records: BudgetTableReconstructionResult["records"],
  columns: BudgetTableReconstructionResult["columns"],
  failed: boolean,
): ReconstructionCompleteness {
  let applicableFieldCount = 0;
  let presentFieldCount = 0;
  let missingFieldCount = 0;
  let divergentFieldCount = 0;
  let ambiguousFieldCount = 0;

  for (const record of records.filter((candidate) => candidate.kind === "service_item")) {
    const applicableRoles = APPLICABLE_SERVICE_FIELDS.filter((role) =>
      columns.some(
        (column) =>
          column.pageNumber === record.pageNumber &&
          column.status === "resolved" &&
          column.role === role,
      ),
    );
    for (const role of applicableRoles) {
      applicableFieldCount += 1;
      if (role === "unit") {
        if (record.unit === null) {
          missingFieldCount += 1;
        } else {
          presentFieldCount += 1;
        }
        continue;
      }
      const value = numericField(record, role);
      if (value === null) {
        missingFieldCount += 1;
      } else if (value.grammarId === "divergent-source-cells-v1") {
        divergentFieldCount += 1;
      } else if (value.status === "ambiguous" || value.status === "invalid") {
        ambiguousFieldCount += 1;
      } else if (value.status === "resolved") {
        presentFieldCount += 1;
      } else {
        ambiguousFieldCount += 1;
      }
    }
  }

  const unresolvedRecord = records.some(
    (record) => record.status === "insufficient_evidence" || record.status === "ambiguous",
  );
  return {
    applicableFieldCount,
    presentFieldCount,
    missingFieldCount,
    divergentFieldCount,
    ambiguousFieldCount,
    exactFraction: exactFraction(presentFieldCount, applicableFieldCount),
    status: failed
      ? "failed"
      : unresolvedRecord || divergentFieldCount > 0 || ambiguousFieldCount > 0
        ? "insufficient"
        : missingFieldCount > 0
          ? "partial"
          : "complete",
  };
}

function failedResult(
  input: BudgetTableReconstructionInput,
  issues: ReadonlyArray<ReconstructionIssue>,
): BudgetTableReconstructionResult {
  const base: BudgetTableReconstructionResult = {
    schemaVersion: 2,
    engineName: BUDGET_TABLE_RECONSTRUCTION_ENGINE_NAME,
    engineVersion: BUDGET_TABLE_RECONSTRUCTION_ENGINE_VERSION,
    profileId: BUDGET_TABLE_RECONSTRUCTION_PROFILE.profileId,
    profileVersion: BUDGET_TABLE_RECONSTRUCTION_PROFILE.profileVersion,
    pageSelection: normalizedPageSelection(input.pageSelection),
    sourceIdentity: sourceIdentity(input),
    status: "failed",
    locators: [],
    textItems: [],
    fragments: [],
    lines: [],
    segments: [],
    columns: [],
    cells: [],
    logicalRows: [],
    pages: [],
    records: [],
    arithmeticEvaluations: [],
    evidenceDispositions: [],
    structuralIssues: issues,
    completeness: completeness([], [], true),
    canonicalFingerprint: "",
  };
  return { ...base, canonicalFingerprint: fingerprintCanonical(base) };
}

export function reconstructBudgetTable(
  input: BudgetTableReconstructionInput,
): BudgetTableReconstructionResult {
  const normalizedInput: BudgetTableReconstructionInput = {
    ...input,
    pageSelection: normalizedPageSelection(input.pageSelection),
  };
  const validationIssues = validateBudgetTableReconstructionInput(normalizedInput);
  if (validationIssues.length > 0) {
    return failedResult(normalizedInput, validationIssues);
  }

  const graph = buildEvidenceGraph(normalizedInput);
  const columns = resolveColumns(normalizedInput, graph);
  const cellFormation = formCells(graph, columns);
  const logicalRows = formLogicalRows(
    graph.lines,
    cellFormation.cells,
    cellFormation.fragments,
    graph.textItems,
    selectBudgetHeaderProvenance(graph),
  );
  const records = classifyRecords(logicalRows, {
    cells: cellFormation.cells,
    fragments: cellFormation.fragments,
    textItems: graph.textItems,
    columns,
    rows: logicalRows,
  });
  const arithmeticEvaluations = evaluateArithmetic(records, columns, logicalRows);
  const conservation = conserveEvidence({
    textItems: graph.textItems,
    fragments: cellFormation.fragments,
    segments: graph.segments,
    lines: graph.lines,
    cells: cellFormation.cells,
    logicalRows,
    records,
    arithmeticEvaluations,
  });

  const selectionIssues: ReconstructionIssue[] = [];
  if (normalizedInput.pageSelection !== "all") {
    const reconstructedPages = new Set(graph.lines.map((line) => line.pageNumber));
    for (const requestedPage of normalizedInput.pageSelection) {
      if (!reconstructedPages.has(requestedPage)) {
        selectionIssues.push({
          code: "selected_page_not_in_structure_reconstruction",
          severity: "ambiguity",
          pageNumber: requestedPage,
          evidenceIds: [],
        });
      }
    }
  }
  const structuralIssues = [...conservation.issues, ...selectionIssues];
  const hasFailure =
    structuralIssues.some((issue) => issue.severity === "failure") ||
    arithmeticEvaluations.some(
      (evaluation) => evaluation.outcome === "invented_evidence",
    );
  const resultCompleteness = completeness(records, columns, hasFailure);
  const pageNumbers = [...new Set(graph.lines.map((line) => line.pageNumber))].sort(
    (left, right) => left - right,
  );
  const pages = pageNumbers.map((pageNumber) => ({
    pageNumber,
    sourceStatus: graph.pageStatuses.get(pageNumber) ?? "unknown",
    lineIds: graph.lines
      .filter((line) => line.pageNumber === pageNumber)
      .map((line) => line.lineId),
    segmentIds: graph.segments
      .filter((segment) => segment.pageNumber === pageNumber)
      .map((segment) => segment.segmentId),
    textItemEvidenceIds: graph.textItems
      .filter((item) => item.pageNumber === pageNumber)
      .map((item) => item.evidenceId),
    columnIds: columns
      .filter((column) => column.pageNumber === pageNumber)
      .map((column) => column.columnId),
    cellIds: cellFormation.cells
      .filter((cell) => cell.pageNumber === pageNumber)
      .map((cell) => cell.cellId),
    logicalRowIds: logicalRows
      .filter((row) => row.pageNumber === pageNumber)
      .map((row) => row.rowId),
  }));

  const base: BudgetTableReconstructionResult = {
    schemaVersion: 2,
    engineName: BUDGET_TABLE_RECONSTRUCTION_ENGINE_NAME,
    engineVersion: BUDGET_TABLE_RECONSTRUCTION_ENGINE_VERSION,
    profileId: BUDGET_TABLE_RECONSTRUCTION_PROFILE.profileId,
    profileVersion: BUDGET_TABLE_RECONSTRUCTION_PROFILE.profileVersion,
    pageSelection: normalizedInput.pageSelection,
    sourceIdentity: sourceIdentity(normalizedInput),
    status: hasFailure
      ? "failed"
      : records.length === 0 || selectionIssues.length > 0
        ? "insufficient_evidence"
        : records.some((record) => record.status !== "resolved") ||
            structuralIssues.some((issue) => issue.severity === "ambiguity")
          ? "completed_with_ambiguities"
          : "completed",
    locators: graph.locatorCatalog.entries(),
    textItems: graph.textItems,
    fragments: cellFormation.fragments,
    lines: graph.lines,
    segments: graph.segments,
    columns,
    cells: cellFormation.cells,
    logicalRows,
    pages,
    records,
    arithmeticEvaluations,
    evidenceDispositions: conservation.dispositions,
    structuralIssues,
    completeness: resultCompleteness,
    canonicalFingerprint: "",
  };
  return { ...base, canonicalFingerprint: fingerprintCanonical(base) };
}
