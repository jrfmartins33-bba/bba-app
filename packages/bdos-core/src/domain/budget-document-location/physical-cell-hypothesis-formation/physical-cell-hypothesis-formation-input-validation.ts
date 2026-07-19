import type { ReconstructedBudgetDocumentGroup, ReconstructedBudgetDocumentPage } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { TabularRegionCandidate, TabularRegionDetectionGroup, TabularRegionDetectionPage } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import type { PhysicalColumnHypothesisReconstructionGroup, PhysicalColumnHypothesisReconstructionPage, PhysicalColumnHypothesisReconstructionRegion } from "../physical-column-hypothesis-reconstruction/budget-document-physical-column-hypothesis-reconstruction.types";
import type { BudgetDocumentPhysicalCellHypothesisFormationInput, PhysicalCellHypothesisFormationTechnicalProblem } from "./budget-document-physical-cell-hypothesis-formation.types";
import { isSupportedColumnContract, isSupportedRegionContract, isSupportedStructureContract } from "./physical-cell-hypothesis-formation-source-contracts";
import { problem } from "./physical-cell-hypothesis-formation-technical-problem";

export interface ValidatedRegionSources {
  readonly structurePage: ReconstructedBudgetDocumentPage;
  readonly detectionRegion: TabularRegionCandidate;
  readonly columnRegion: PhysicalColumnHypothesisReconstructionRegion;
}

export interface ValidatedPageSources {
  readonly structurePage: ReconstructedBudgetDocumentPage;
  readonly detectionPage: TabularRegionDetectionPage;
  readonly columnPage: PhysicalColumnHypothesisReconstructionPage;
  readonly regions: ReadonlyArray<ValidatedRegionSources>;
}

export interface ValidatedGroupSources {
  readonly structureGroup: ReconstructedBudgetDocumentGroup;
  readonly detectionGroup: TabularRegionDetectionGroup;
  readonly columnGroup: PhysicalColumnHypothesisReconstructionGroup;
  readonly pages: ReadonlyArray<ValidatedPageSources>;
}

export type PhysicalCellFormationInputValidationResult =
  | { readonly kind: "valid"; readonly groups: ReadonlyArray<ValidatedGroupSources> }
  | { readonly kind: "invalid"; readonly problems: ReadonlyArray<PhysicalCellHypothesisFormationTechnicalProblem> };

function invalid(code: Parameters<typeof problem>[0]): PhysicalCellFormationInputValidationResult {
  return { kind: "invalid", problems: [problem(code, "source_validation")] };
}

function sameStructureLineage(input: BudgetDocumentPhysicalCellHypothesisFormationInput): boolean {
  const { structureReconstruction: s, physicalColumnHypothesisReconstruction: c } = input;
  return c.sourceStructureReconstructionSchemaVersion === s.schemaVersion
    && c.sourceStructureReconstructorName === s.reconstructorName
    && c.sourceStructureReconstructorVersion === s.reconstructorVersion
    && c.sourceStructureReconstructionProfileId === s.reconstructionProfileId
    && c.sourceStructureReconstructionProfileVersion === s.reconstructionProfileVersion
    && c.sourceStructureReconstructionContextFingerprintVersion === s.reconstructionContextFingerprintVersion
    && c.sourceStructureReconstructionContextFingerprint === s.reconstructionContextFingerprint;
}

function sameDetectionLineage(input: BudgetDocumentPhysicalCellHypothesisFormationInput): boolean {
  const { tabularRegionDetection: t, physicalColumnHypothesisReconstruction: c } = input;
  return c.sourceTabularRegionDetectionSchemaVersion === t.schemaVersion
    && c.sourceTabularRegionDetectorName === t.detectorName
    && c.sourceTabularRegionDetectorVersion === t.detectorVersion
    && c.sourceTabularRegionDetectionProfileId === t.detectionProfileId
    && c.sourceTabularRegionDetectionProfileVersion === t.detectionProfileVersion
    && c.sourceTabularRegionDetectionContextFingerprintVersion === t.detectionContextFingerprintVersion
    && c.sourceTabularRegionDetectionContextFingerprint === t.detectionContextFingerprint;
}

function validateRegionReferences(
  structurePage: ReconstructedBudgetDocumentPage,
  detectionRegion: TabularRegionCandidate,
  columnRegion: PhysicalColumnHypothesisReconstructionRegion,
): boolean {
  if (columnRegion.sourceRegionKey !== detectionRegion.regionKey || columnRegion.pageNumber !== detectionRegion.pageNumber) return false;
  const structureLineByKey = new Map(structurePage.lines.map((line) => [line.lineKey, line]));
  const structureSegmentByKey = new Map(structurePage.segments.map((segment) => [segment.segmentKey, segment]));
  if (new Set(detectionRegion.lineKeys).size !== detectionRegion.lineKeys.length || detectionRegion.lineKeys.some((key) => !structureLineByKey.has(key))) return false;
  const detectionLineSet = new Set(detectionRegion.lineKeys);
  const regionSegmentKeys = detectionRegion.lineKeys.flatMap((key) => structureLineByKey.get(key)!.segmentKeys);
  if (columnRegion.segmentDispositions.length !== regionSegmentKeys.length) return false;
  if (new Set(columnRegion.segmentDispositions.map((entry) => entry.segmentKey)).size !== columnRegion.segmentDispositions.length) return false;
  if (regionSegmentKeys.some((key) => !columnRegion.segmentDispositions.some((entry) => entry.segmentKey === key))) return false;
  for (const disposition of columnRegion.segmentDispositions) {
    const segment = structureSegmentByKey.get(disposition.segmentKey);
    if (!segment || segment.lineKey !== disposition.lineKey || !detectionLineSet.has(disposition.lineKey)) return false;
  }
  for (const hypothesis of columnRegion.hypotheses) {
    if (hypothesis.pageNumber !== structurePage.pageNumber || hypothesis.lineKeys.length !== hypothesis.segmentKeys.length) return false;
    for (let index = 0; index < hypothesis.lineKeys.length; index += 1) {
      const lineKey = hypothesis.lineKeys[index];
      const segment = structureSegmentByKey.get(hypothesis.segmentKeys[index]);
      if (!detectionLineSet.has(lineKey) || !segment || segment.lineKey !== lineKey) return false;
    }
  }
  return true;
}

export function validatePhysicalCellHypothesisFormationInput(input: BudgetDocumentPhysicalCellHypothesisFormationInput): PhysicalCellFormationInputValidationResult {
  const { structureReconstruction: s, tabularRegionDetection: t, physicalColumnHypothesisReconstruction: c } = input;
  if (!isSupportedStructureContract(s) || !isSupportedRegionContract(t) || !isSupportedColumnContract(c)) return invalid("source_contract_version_unsupported");
  if (s.status === "failed") return invalid("source_structure_reconstruction_contract_invalid");
  if (t.status === "failed") return invalid("source_tabular_region_detection_contract_invalid");
  if (c.status === "failed") return invalid("source_physical_column_hypothesis_contract_invalid");
  if (s.sourceByteHash !== t.sourceByteHash || s.sourceByteHash !== c.sourceByteHash || !sameStructureLineage(input) || !sameDetectionLineage(input)) return invalid("source_lineage_mismatch");

  const structureGroups = new Map(s.groups.map((group) => [group.sourceCandidateGroupKey, group]));
  const detectionGroups = new Map(t.groups.map((group) => [group.sourceCandidateGroupKey, group]));
  if (structureGroups.size !== s.groups.length || detectionGroups.size !== t.groups.length
    || new Set(c.groups.map((group) => group.sourceCandidateGroupKey)).size !== c.groups.length
    || c.groups.length !== s.groups.length || c.groups.length !== t.groups.length) return invalid("source_group_reference_invalid");
  const validatedGroups: ValidatedGroupSources[] = [];
  for (const columnGroup of c.groups) {
    const structureGroup = structureGroups.get(columnGroup.sourceCandidateGroupKey);
    const detectionGroup = detectionGroups.get(columnGroup.sourceCandidateGroupKey);
    if (!structureGroup || !detectionGroup) return invalid("source_group_reference_invalid");
    const structurePages = new Map(structureGroup.pages.map((page) => [page.pageNumber, page]));
    const detectionPages = new Map(detectionGroup.pages.map((page) => [page.pageNumber, page]));
    if (structurePages.size !== structureGroup.pages.length || detectionPages.size !== detectionGroup.pages.length
      || new Set(columnGroup.pages.map((page) => page.pageNumber)).size !== columnGroup.pages.length
      || (columnGroup.status !== "group_not_processable" && (columnGroup.pages.length !== structureGroup.pages.length || columnGroup.pages.length !== detectionGroup.pages.length))) return invalid("source_page_reference_invalid");
    const pages: ValidatedPageSources[] = [];
    for (const columnPage of columnGroup.pages) {
      const structurePage = structurePages.get(columnPage.pageNumber);
      const detectionPage = detectionPages.get(columnPage.pageNumber);
      if (!structurePage || !detectionPage) return invalid("source_page_reference_invalid");
      const detectionRegions = new Map(detectionPage.regions.map((region) => [region.regionKey, region]));
      if (detectionRegions.size !== detectionPage.regions.length
        || new Set(columnPage.regions.map((region) => region.sourceRegionKey)).size !== columnPage.regions.length
        || (columnPage.status !== "page_not_processable" && columnPage.regions.length !== detectionPage.regions.length)) return invalid("source_region_reference_invalid");
      const regions: ValidatedRegionSources[] = [];
      for (const columnRegion of columnPage.regions) {
        const detectionRegion = detectionRegions.get(columnRegion.sourceRegionKey);
        if (!detectionRegion) return invalid("source_region_reference_invalid");
        if (!validateRegionReferences(structurePage, detectionRegion, columnRegion)) return invalid("source_column_hypothesis_reference_invalid");
        regions.push({ structurePage, detectionRegion, columnRegion });
      }
      pages.push({ structurePage, detectionPage, columnPage, regions });
    }
    validatedGroups.push({ structureGroup, detectionGroup, columnGroup, pages });
  }
  return { kind: "valid", groups: validatedGroups };
}
