import type { BudgetDocumentPageLocationResult } from "../page-location/budget-page-location.types";
import type { PhysicalDocumentReadResult } from "../physical-document-read.types";
import { computeGeometryContextFingerprint } from "../physical-document-geometry-context-fingerprint";
import type { BudgetDocumentStructureReconstructionInput, StructureReconstructionTechnicalProblem } from "./budget-document-structure-reconstruction.types";
import { findCompatiblePageLocationContract, findCompatiblePhysicalReadContract } from "./structure-reconstruction-source-contracts";

/**
 * Validação de compatibilidade e linhagem entre `PhysicalDocumentReadResult`
 * e `BudgetDocumentPageLocationResult` (Sprint 21.4A.2.f.1, §16-17). Nunca
 * corrige, renumera ou refaz a entrada — apenas confirma que os dois
 * contratos, produzidos independentemente, descrevem de fato o mesmo
 * documento e a mesma versão técnica.
 */
export type StructureReconstructionInputValidationResult =
  | { readonly kind: "valid" }
  | { readonly kind: "invalid"; readonly problems: ReadonlyArray<StructureReconstructionTechnicalProblem> };

function problem(
  code: StructureReconstructionTechnicalProblem["code"],
  message: string,
  pageNumber: number | null = null,
): StructureReconstructionTechnicalProblem {
  return { code, phase: "source_validation", groupKey: null, pageNumber, sourceTextItemIndex: null, message };
}

function invalid(problems: ReadonlyArray<StructureReconstructionTechnicalProblem>): StructureReconstructionInputValidationResult {
  return { kind: "invalid", problems };
}

function validatePhysicalReadDensity(physicalRead: PhysicalDocumentReadResult): ReadonlyArray<StructureReconstructionTechnicalProblem> {
  const problems: StructureReconstructionTechnicalProblem[] = [];

  if (physicalRead.pages.length !== physicalRead.totalPageCount || physicalRead.totalPageCount <= 0) {
    problems.push(problem("physical_read_contract_invalid", "Physical read pages are not a non-empty dense sequence matching totalPageCount."));
    return problems;
  }

  physicalRead.pages.forEach((page, index) => {
    if (page.pageNumber !== index + 1) {
      problems.push(problem("physical_read_contract_invalid", "Physical read pages are not densely numbered from 1.", page.pageNumber));
    }
    const seenIndices = new Set<number>();
    page.textItems.forEach((item, itemPosition) => {
      if (item.index !== itemPosition || seenIndices.has(item.index)) {
        problems.push(
          problem("physical_read_contract_invalid", "Physical read text item indices are not unique and dense from 0.", page.pageNumber),
        );
      }
      seenIndices.add(item.index);
    });
  });

  return problems;
}

function validateCandidateGroups(
  pageLocation: BudgetDocumentPageLocationResult,
): ReadonlyArray<StructureReconstructionTechnicalProblem> {
  const problems: StructureReconstructionTechnicalProblem[] = [];
  const decisionsByPage = new Map(pageLocation.pageDecisions.map((decision) => [decision.pageNumber, decision]));
  const pagesSeenInAnyGroup = new Set<number>();

  pageLocation.candidateGroups.forEach((group) => {
    if (group.groupKey.trim().length === 0 || group.pageNumbers.length === 0 || group.members.length !== group.pageNumbers.length) {
      problems.push(problem("candidate_group_contract_invalid", `Candidate group ${group.groupKey} is structurally malformed.`));
      return;
    }

    if (group.startPageNumber !== group.pageNumbers[0] || group.endPageNumber !== group.pageNumbers[group.pageNumbers.length - 1]) {
      problems.push(problem("candidate_group_contract_invalid", `Candidate group ${group.groupKey} bounds do not match its page numbers.`));
    }

    group.pageNumbers.forEach((pageNumber, position) => {
      if (pageNumber < 1 || pageNumber > pageLocation.totalPageCount) {
        problems.push(problem("candidate_page_not_found", `Candidate group ${group.groupKey} references a page outside the document.`, pageNumber));
        return;
      }
      if (position > 0 && pageNumber !== group.pageNumbers[position - 1] + 1) {
        problems.push(problem("candidate_group_contract_invalid", `Candidate group ${group.groupKey} page numbers are not contiguous.`, pageNumber));
      }
      if (group.members[position]?.pageNumber !== pageNumber) {
        problems.push(problem("candidate_group_contract_invalid", `Candidate group ${group.groupKey} members are misaligned with its page numbers.`, pageNumber));
      }
      if (pagesSeenInAnyGroup.has(pageNumber)) {
        problems.push(problem("candidate_group_contract_invalid", `Page ${pageNumber} belongs to more than one candidate group.`, pageNumber));
      }
      pagesSeenInAnyGroup.add(pageNumber);

      const decision = decisionsByPage.get(pageNumber);
      if (decision === undefined || decision.classification !== "candidate") {
        problems.push(problem("candidate_group_contract_invalid", `Page ${pageNumber} in a candidate group is not classified as a candidate.`, pageNumber));
      }
    });

    group.members.forEach((member, position) => {
      const isLast = position === group.members.length - 1;
      if (member.candidateType === "closing" && !isLast) {
        problems.push(
          problem("candidate_group_contract_invalid", `A closing candidate must be the last member of group ${group.groupKey}.`, member.pageNumber),
        );
      }
    });
  });

  return problems;
}

export function validateStructureReconstructionInput(
  input: BudgetDocumentStructureReconstructionInput,
): StructureReconstructionInputValidationResult {
  const { physicalRead, pageLocation } = input;

  if (findCompatiblePhysicalReadContract(physicalRead) === null) {
    return invalid([problem("source_contract_version_unsupported", "The physical read source contract is not explicitly supported by this reconstructor version.")]);
  }
  if (findCompatiblePageLocationContract(pageLocation) === null) {
    return invalid([problem("source_contract_version_unsupported", "The page location source contract is not explicitly supported by this reconstructor version.")]);
  }
  if (pageLocation.status === "failed") {
    return invalid([problem("page_location_contract_invalid", "The page location result itself failed upstream; structure reconstruction cannot proceed.")]);
  }
  if (physicalRead.status === "failed") {
    return invalid([problem("source_lineage_mismatch", "The physical read failed upstream but the page location result does not reflect a failed source.")]);
  }

  const recomputedFingerprint = computeGeometryContextFingerprint({
    sourceByteHash: physicalRead.sourceByteHash,
    physicalReadSchemaVersion: physicalRead.schemaVersion,
    readerName: physicalRead.readerName,
    readerVersion: physicalRead.readerVersion,
    adapterVersion: physicalRead.adapterVersion,
    underlyingLibraryVersion: physicalRead.underlyingLibraryVersion,
    coordinateSpaceVersion: physicalRead.textItemCoordinateSpaceVersion,
    geometryProfileVersion: physicalRead.textItemGeometryProfileVersion,
  });
  if (recomputedFingerprint !== physicalRead.geometryContextFingerprint) {
    return invalid([problem("geometry_context_fingerprint_invalid", "The physical read geometry context fingerprint does not match its own recalculated value.")]);
  }

  const problems: StructureReconstructionTechnicalProblem[] = [];

  if (physicalRead.sourceByteHash !== pageLocation.sourceByteHash) {
    problems.push(problem("source_lineage_mismatch", "Physical read and page location source byte hashes do not match."));
  }
  if (physicalRead.totalPageCount !== pageLocation.totalPageCount) {
    problems.push(problem("source_lineage_mismatch", "Physical read and page location total page counts do not match."));
  }

  const sourceReadMetadata = pageLocation.sourceReadMetadata;
  if (sourceReadMetadata === null) {
    problems.push(problem("page_location_contract_invalid", "Page location is missing its source read metadata."));
  } else if (
    sourceReadMetadata.readerName !== physicalRead.readerName ||
    sourceReadMetadata.readerVersion !== physicalRead.readerVersion ||
    sourceReadMetadata.adapterVersion !== physicalRead.adapterVersion ||
    sourceReadMetadata.underlyingLibraryVersion !== physicalRead.underlyingLibraryVersion ||
    sourceReadMetadata.sourceReadStatus !== physicalRead.status
  ) {
    problems.push(problem("source_lineage_mismatch", "Page location source read metadata does not match the physical read it was supposedly derived from."));
  }

  problems.push(...validatePhysicalReadDensity(physicalRead));
  problems.push(...validateCandidateGroups(pageLocation));

  return problems.length === 0 ? { kind: "valid" } : invalid(problems);
}
