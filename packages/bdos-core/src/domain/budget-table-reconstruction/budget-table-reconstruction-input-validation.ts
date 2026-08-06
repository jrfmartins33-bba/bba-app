import type { BudgetTableReconstructionInput, ReconstructionIssue } from "./budget-table-reconstruction.types";
export function validateBudgetTableReconstructionInput(input:BudgetTableReconstructionInput):ReadonlyArray<ReconstructionIssue>{
 const issues:ReconstructionIssue[]=[]; const hash=input.physicalRead.sourceByteHash;
 if(input.pageLocation.sourceByteHash!==hash||input.structureReconstruction.sourceByteHash!==hash)issues.push({code:"source_lineage_mismatch",severity:"failure",pageNumber:null,evidenceIds:[]});
 if(input.structureReconstruction.physicalReaderName!==input.physicalRead.readerName||input.structureReconstruction.physicalReaderVersion!==input.physicalRead.readerVersion||input.structureReconstruction.physicalGeometryContextFingerprint!==input.physicalRead.geometryContextFingerprint)issues.push({code:"physical_lineage_mismatch",severity:"failure",pageNumber:null,evidenceIds:[]});
 if(input.columnEvidence.availability==="available"){const c=input.columnEvidence.result;if(c.sourceByteHash!==hash||c.sourceStructureReconstructionContextFingerprint!==input.structureReconstruction.reconstructionContextFingerprint)issues.push({code:"column_lineage_mismatch",severity:"failure",pageNumber:null,evidenceIds:[]})}
 return issues;
}
