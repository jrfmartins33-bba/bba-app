import type {
  BudgetTableReconstructionInput,
  ReconstructionIssue,
} from "./budget-table-reconstruction.types";

function failure(code: string): ReconstructionIssue {
  return {
    code,
    severity: "failure",
    pageNumber: null,
    evidenceIds: [],
  };
}

export function validateBudgetTableReconstructionInput(
  input: BudgetTableReconstructionInput,
): ReadonlyArray<ReconstructionIssue> {
  const issues: ReconstructionIssue[] = [];
  const sourceByteHash = input.physicalRead.sourceByteHash;

  if (
    input.pageLocation.sourceByteHash !== sourceByteHash ||
    input.structureReconstruction.sourceByteHash !== sourceByteHash
  ) {
    issues.push(failure("source_lineage_mismatch"));
  }
  if (
    input.structureReconstruction.physicalReaderName !== input.physicalRead.readerName ||
    input.structureReconstruction.physicalReaderVersion !== input.physicalRead.readerVersion ||
    input.structureReconstruction.physicalGeometryContextFingerprint !==
      input.physicalRead.geometryContextFingerprint
  ) {
    issues.push(failure("physical_lineage_mismatch"));
  }
  if (input.pageSelection !== "all") {
    const uniquePages = new Set(input.pageSelection);
    if (
      input.pageSelection.length === 0 ||
      uniquePages.size !== input.pageSelection.length ||
      input.pageSelection.some(
        (pageNumber) => !Number.isSafeInteger(pageNumber) || pageNumber <= 0,
      )
    ) {
      issues.push(failure("page_selection_invalid"));
    }
  }
  if (input.columnEvidence.availability === "available") {
    const columns = input.columnEvidence.result;
    if (
      columns.sourceByteHash !== sourceByteHash ||
      columns.sourceStructureReconstructionContextFingerprint !==
        input.structureReconstruction.reconstructionContextFingerprint
    ) {
      issues.push(failure("column_lineage_mismatch"));
    }
  }
  if (input.physicalCellEvidence.availability === "available") {
    const physicalCells = input.physicalCellEvidence.cellHypothesisFormation;
    const cellText = input.physicalCellEvidence.cellTextEvidenceFormation;
    if (
      physicalCells.sourceByteHash !== sourceByteHash ||
      physicalCells.sourceStructureReconstructionContextFingerprint !==
        input.structureReconstruction.reconstructionContextFingerprint
    ) {
      issues.push(failure("physical_cell_lineage_mismatch"));
    }
    if (
      cellText.sourceByteHash !== sourceByteHash ||
      cellText.sourceStructureReconstructionContextFingerprint !==
        input.structureReconstruction.reconstructionContextFingerprint ||
      cellText.sourcePhysicalCellHypothesisFormationContextFingerprint !==
        physicalCells.formationContextFingerprint
    ) {
      issues.push(failure("physical_cell_text_lineage_mismatch"));
    }
  }
  return issues;
}
