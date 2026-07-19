import type { ReconstructedBudgetDocumentGroup, ReconstructedBudgetDocumentPage } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalCellHypothesisFormationGroup, PhysicalCellHypothesisFormationPage, PhysicalCellHypothesisFormationRegion } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { BudgetDocumentPhysicalCellTextEvidenceFormationInput, PhysicalCellTextEvidenceFormationTechnicalProblem } from "./budget-document-physical-cell-text-evidence-formation.types";
import { isSupportedPhysicalCellHypothesisFormationContract, isSupportedPhysicalReadContract, isSupportedStructureReconstructionContract } from "./physical-cell-text-evidence-formation-source-contracts";
import { problem } from "./physical-cell-text-evidence-formation-technical-problem";

export interface ValidatedRegionSources {
  readonly structurePage: ReconstructedBudgetDocumentPage;
  readonly cellFormationRegion: PhysicalCellHypothesisFormationRegion;
}
export interface ValidatedPageSources {
  readonly structurePage: ReconstructedBudgetDocumentPage;
  readonly cellFormationPage: PhysicalCellHypothesisFormationPage;
  readonly regions: ReadonlyArray<ValidatedRegionSources>;
}
export interface ValidatedGroupSources {
  readonly structureGroup: ReconstructedBudgetDocumentGroup;
  readonly cellFormationGroup: PhysicalCellHypothesisFormationGroup;
  readonly pages: ReadonlyArray<ValidatedPageSources>;
}

export type PhysicalCellTextEvidenceFormationInputValidationResult =
  | { readonly kind: "valid"; readonly groups: ReadonlyArray<ValidatedGroupSources> }
  | { readonly kind: "invalid"; readonly problems: ReadonlyArray<PhysicalCellTextEvidenceFormationTechnicalProblem> };

function invalid(code: Parameters<typeof problem>[0], fields: Parameters<typeof problem>[2] = {}): PhysicalCellTextEvidenceFormationInputValidationResult {
  return { kind: "invalid", problems: [problem(code, "source_validation", fields)] };
}

function sameStructureReconstructionLineage(input: BudgetDocumentPhysicalCellTextEvidenceFormationInput): boolean {
  const { structureReconstruction: s, physicalCellHypothesisFormation: c } = input;
  return c.sourceStructureReconstructionSchemaVersion === s.schemaVersion
    && c.sourceStructureReconstructorName === s.reconstructorName
    && c.sourceStructureReconstructorVersion === s.reconstructorVersion
    && c.sourceStructureReconstructionProfileId === s.reconstructionProfileId
    && c.sourceStructureReconstructionProfileVersion === s.reconstructionProfileVersion
    && c.sourceStructureReconstructionContextFingerprintVersion === s.reconstructionContextFingerprintVersion
    && c.sourceStructureReconstructionContextFingerprint === s.reconstructionContextFingerprint;
}

function samePhysicalReadLineage(input: BudgetDocumentPhysicalCellTextEvidenceFormationInput): boolean {
  const { physicalRead: p, structureReconstruction: s } = input;
  return s.physicalReaderName === p.readerName
    && s.physicalReaderVersion === p.readerVersion
    && s.physicalAdapterVersion === p.adapterVersion
    && s.physicalUnderlyingLibraryVersion === p.underlyingLibraryVersion
    && s.physicalTextItemCoordinateSpaceVersion === p.textItemCoordinateSpaceVersion
    && s.physicalTextItemGeometryProfileVersion === p.textItemGeometryProfileVersion
    && s.physicalGeometryContextFingerprintVersion === p.geometryContextFingerprintVersion
    && s.physicalGeometryContextFingerprint === p.geometryContextFingerprint;
}

/** Todo gridIntersectionKey de toda PhysicalCellHypothesis desta região deve resolver dentro de region.gridIntersections como "cell_hypothesis_formed" — sem isso não existem linha, página, região, rowOrder ou columnOrder confiáveis para esta região inteira. */
function everyCellHypothesisHasIntersection(region: PhysicalCellHypothesisFormationRegion): boolean {
  const intersectionByKey = new Map(region.gridIntersections.map((entry) => [entry.gridIntersectionKey, entry]));
  return region.cellHypotheses.every((cell) => {
    const intersection = intersectionByKey.get(cell.gridIntersectionKey);
    return intersection !== undefined && intersection.status === "cell_hypothesis_formed" && intersection.cellHypothesisKey === cell.cellHypothesisKey;
  });
}

export function validatePhysicalCellTextEvidenceFormationInput(
  input: BudgetDocumentPhysicalCellTextEvidenceFormationInput,
): PhysicalCellTextEvidenceFormationInputValidationResult {
  const { physicalRead: p, structureReconstruction: s, physicalCellHypothesisFormation: c } = input;

  if (!isSupportedPhysicalReadContract(p) || !isSupportedStructureReconstructionContract(s) || !isSupportedPhysicalCellHypothesisFormationContract(c)) {
    return invalid("source_contract_version_unsupported");
  }
  if (p.status === "failed") return invalid("source_physical_read_contract_invalid");
  if (s.status === "failed") return invalid("source_structure_reconstruction_contract_invalid");
  if (c.status === "failed") return invalid("source_physical_cell_hypothesis_formation_contract_invalid");

  if (p.sourceByteHash !== s.sourceByteHash || p.sourceByteHash !== c.sourceByteHash) return invalid("source_lineage_mismatch");
  if (!samePhysicalReadLineage(input) || !sameStructureReconstructionLineage(input)) return invalid("source_lineage_mismatch");

  const structureGroups = new Map(s.groups.map((group) => [group.sourceCandidateGroupKey, group]));
  if (structureGroups.size !== s.groups.length || new Set(c.groups.map((group) => group.sourceCandidateGroupKey)).size !== c.groups.length) {
    return invalid("source_group_reference_invalid");
  }

  const validatedGroups: ValidatedGroupSources[] = [];
  for (const cellFormationGroup of c.groups) {
    const structureGroup = structureGroups.get(cellFormationGroup.sourceCandidateGroupKey);
    if (!structureGroup) return invalid("source_group_reference_invalid", { groupKey: cellFormationGroup.groupProcessedKey });

    const structurePages = new Map(structureGroup.pages.map((page) => [page.pageNumber, page]));
    if (structurePages.size !== structureGroup.pages.length || new Set(cellFormationGroup.pages.map((page) => page.pageNumber)).size !== cellFormationGroup.pages.length) {
      return invalid("source_page_reference_invalid", { groupKey: cellFormationGroup.groupProcessedKey });
    }

    const validatedPages: ValidatedPageSources[] = [];
    for (const cellFormationPage of cellFormationGroup.pages) {
      const structurePage = structurePages.get(cellFormationPage.pageNumber);
      if (!structurePage) return invalid("source_page_reference_invalid", { groupKey: cellFormationGroup.groupProcessedKey, pageNumber: cellFormationPage.pageNumber });

      if (new Set(cellFormationPage.regions.map((region) => region.sourceRegionKey)).size !== cellFormationPage.regions.length) {
        return invalid("source_region_reference_invalid", { groupKey: cellFormationGroup.groupProcessedKey, pageNumber: cellFormationPage.pageNumber });
      }

      const validatedRegions: ValidatedRegionSources[] = [];
      for (const cellFormationRegion of cellFormationPage.regions) {
        if (cellFormationRegion.pageNumber !== structurePage.pageNumber) {
          return invalid("source_region_reference_invalid", { groupKey: cellFormationGroup.groupProcessedKey, pageNumber: cellFormationPage.pageNumber, regionKey: cellFormationRegion.sourceRegionKey });
        }
        if (new Set(cellFormationRegion.cellHypotheses.map((cell) => cell.cellHypothesisKey)).size !== cellFormationRegion.cellHypotheses.length) {
          return invalid("source_grid_intersection_reference_invalid", { groupKey: cellFormationGroup.groupProcessedKey, pageNumber: cellFormationPage.pageNumber, regionKey: cellFormationRegion.sourceRegionKey });
        }
        if (!everyCellHypothesisHasIntersection(cellFormationRegion)) {
          return invalid("source_grid_intersection_reference_invalid", { groupKey: cellFormationGroup.groupProcessedKey, pageNumber: cellFormationPage.pageNumber, regionKey: cellFormationRegion.sourceRegionKey });
        }
        validatedRegions.push({ structurePage, cellFormationRegion });
      }
      validatedPages.push({ structurePage, cellFormationPage, regions: validatedRegions });
    }
    validatedGroups.push({ structureGroup, cellFormationGroup, pages: validatedPages });
  }

  return { kind: "valid", groups: validatedGroups };
}
