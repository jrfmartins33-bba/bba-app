import type { ReconstructedBudgetDocumentGroup, ReconstructedBudgetDocumentPage, ReconstructedHorizontalSegment, ReconstructedPhysicalLine } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { TabularRegionCandidate, TabularRegionDetectionGroup, TabularRegionDetectionPage } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import type { PhysicalCellHypothesisFormationGroup, PhysicalCellHypothesisFormationPage, PhysicalCellHypothesisFormationRegion } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalCellTextEvidenceFormationGroup, PhysicalCellTextEvidenceFormationPage, PhysicalCellTextEvidenceFormationRegion } from "../physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";
import type { BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput, PageLocalNeutralStructuredEvidenceFormationTechnicalProblem } from "./budget-document-page-local-neutral-structured-evidence-formation.types";
import { isSupportedPhysicalCellHypothesisFormationContractReexport, isSupportedPhysicalCellTextEvidenceFormationContract, isSupportedStructureReconstructionContract, isSupportedTabularRegionDetectionContract } from "./page-local-neutral-structured-evidence-formation-source-contracts";
import { isPhysicalCellHypothesisFormationFingerprintValid, isPhysicalCellTextEvidenceFormationFingerprintValid, isStructureReconstructionFingerprintValid, isTabularRegionDetectionFingerprintValid } from "./page-local-neutral-structured-evidence-formation-upstream-fingerprint-validation";
import { problem } from "./page-local-neutral-structured-evidence-formation-technical-problem";

export interface ValidatedRegionSources {
  readonly regionCandidate: TabularRegionCandidate;
  readonly cellFormationRegion: PhysicalCellHypothesisFormationRegion | null;
  readonly textEvidenceRegion: PhysicalCellTextEvidenceFormationRegion | null;
}
export interface ValidatedPageSources {
  readonly pageNumber: number;
  readonly candidatePage: TabularRegionDetectionPage;
  readonly structurePage: ReconstructedBudgetDocumentPage;
  readonly cellFormationPage: PhysicalCellHypothesisFormationPage | null;
  readonly textEvidencePage: PhysicalCellTextEvidenceFormationPage | null;
  readonly structureLineByKey: ReadonlyMap<string, ReconstructedPhysicalLine>;
  readonly structureSegmentByKey: ReadonlyMap<string, ReconstructedHorizontalSegment>;
  readonly regions: ReadonlyArray<ValidatedRegionSources>;
}
export interface ValidatedGroupSources {
  readonly sourceCandidateGroupKey: string;
  readonly startPageNumber: number;
  readonly endPageNumber: number;
  readonly candidateGroup: TabularRegionDetectionGroup;
  readonly structureGroup: ReconstructedBudgetDocumentGroup;
  readonly cellFormationGroup: PhysicalCellHypothesisFormationGroup;
  readonly textEvidenceGroup: PhysicalCellTextEvidenceFormationGroup;
  readonly pages: ReadonlyArray<ValidatedPageSources>;
}

export type PageLocalNeutralStructuredEvidenceFormationInputValidationResult =
  | { readonly kind: "valid"; readonly groups: ReadonlyArray<ValidatedGroupSources> }
  | { readonly kind: "invalid"; readonly problems: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem> };

function invalid(code: Parameters<typeof problem>[0], fields: Parameters<typeof problem>[2] = {}): PageLocalNeutralStructuredEvidenceFormationInputValidationResult {
  return { kind: "invalid", problems: [problem(code, "source_validation", fields)] };
}

function tabularDerivesFromStructure(input: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput): boolean {
  const { structureReconstruction: s, tabularRegionDetection: t } = input;
  return t.sourceReconstructionSchemaVersion === s.schemaVersion
    && t.sourceReconstructorName === s.reconstructorName
    && t.sourceReconstructorVersion === s.reconstructorVersion
    && t.sourceReconstructionProfileId === s.reconstructionProfileId
    && t.sourceReconstructionProfileVersion === s.reconstructionProfileVersion
    && t.sourceReconstructionContextFingerprintVersion === s.reconstructionContextFingerprintVersion
    && t.sourceReconstructionContextFingerprint === s.reconstructionContextFingerprint;
}

function cellFormationDerivesFromSources(input: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput): boolean {
  const { structureReconstruction: s, tabularRegionDetection: t, physicalCellHypothesisFormation: c } = input;
  return c.sourceStructureReconstructionSchemaVersion === s.schemaVersion
    && c.sourceStructureReconstructorName === s.reconstructorName
    && c.sourceStructureReconstructorVersion === s.reconstructorVersion
    && c.sourceStructureReconstructionProfileId === s.reconstructionProfileId
    && c.sourceStructureReconstructionProfileVersion === s.reconstructionProfileVersion
    && c.sourceStructureReconstructionContextFingerprintVersion === s.reconstructionContextFingerprintVersion
    && c.sourceStructureReconstructionContextFingerprint === s.reconstructionContextFingerprint
    && c.sourceTabularRegionDetectionSchemaVersion === t.schemaVersion
    && c.sourceTabularRegionDetectorName === t.detectorName
    && c.sourceTabularRegionDetectorVersion === t.detectorVersion
    && c.sourceTabularRegionDetectionProfileId === t.detectionProfileId
    && c.sourceTabularRegionDetectionProfileVersion === t.detectionProfileVersion
    && c.sourceTabularRegionDetectionContextFingerprintVersion === t.detectionContextFingerprintVersion
    && c.sourceTabularRegionDetectionContextFingerprint === t.detectionContextFingerprint;
}

function textEvidenceDerivesFromSources(input: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput): boolean {
  const { structureReconstruction: s, physicalCellHypothesisFormation: c, physicalCellTextEvidenceFormation: g } = input;
  return g.sourceStructureReconstructionSchemaVersion === s.schemaVersion
    && g.sourceStructureReconstructorName === s.reconstructorName
    && g.sourceStructureReconstructorVersion === s.reconstructorVersion
    && g.sourceStructureReconstructionProfileId === s.reconstructionProfileId
    && g.sourceStructureReconstructionProfileVersion === s.reconstructionProfileVersion
    && g.sourceStructureReconstructionContextFingerprintVersion === s.reconstructionContextFingerprintVersion
    && g.sourceStructureReconstructionContextFingerprint === s.reconstructionContextFingerprint
    && g.sourcePhysicalCellHypothesisFormationSchemaVersion === c.schemaVersion
    && g.sourcePhysicalCellHypothesisFormationEngineName === c.formationEngineName
    && g.sourcePhysicalCellHypothesisFormationEngineVersion === c.formationEngineVersion
    && g.sourcePhysicalCellHypothesisFormationProfileId === c.formationProfileId
    && g.sourcePhysicalCellHypothesisFormationProfileVersion === c.formationProfileVersion
    && g.sourcePhysicalCellHypothesisFormationContextFingerprintVersion === c.formationContextFingerprintVersion
    && g.sourcePhysicalCellHypothesisFormationContextFingerprint === c.formationContextFingerprint;
}

function uniqueKeySet<T>(items: ReadonlyArray<T>, selector: (item: T) => string): Set<string> | null {
  const set = new Set(items.map(selector));
  return set.size === items.length ? set : null;
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

/** Toda hipótese física de célula da região resolve dentro de gridIntersections como "cell_hypothesis_formed" com a mesma cellHypothesisKey — mesma disciplina da g.1. */
function everyCellHypothesisHasIntersection(region: PhysicalCellHypothesisFormationRegion): boolean {
  const byKey = new Map(region.gridIntersections.map((entry) => [entry.gridIntersectionKey, entry]));
  return region.cellHypotheses.every((cell) => {
    const intersection = byKey.get(cell.gridIntersectionKey);
    return intersection !== undefined && intersection.status === "cell_hypothesis_formed" && intersection.cellHypothesisKey === cell.cellHypothesisKey;
  });
}

export function validatePageLocalNeutralStructuredEvidenceFormationInput(
  input: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput,
): PageLocalNeutralStructuredEvidenceFormationInputValidationResult {
  const { structureReconstruction: s, tabularRegionDetection: t, physicalCellHypothesisFormation: c, physicalCellTextEvidenceFormation: g } = input;

  if (!isSupportedStructureReconstructionContract(s)) return invalid("source_contract_version_unsupported");
  if (!isSupportedTabularRegionDetectionContract(t)) return invalid("source_contract_version_unsupported");
  if (!isSupportedPhysicalCellHypothesisFormationContractReexport(c)) return invalid("source_contract_version_unsupported");
  if (!isSupportedPhysicalCellTextEvidenceFormationContract(g)) return invalid("source_contract_version_unsupported");

  if (s.status === "failed") return invalid("source_structure_reconstruction_contract_invalid");
  if (t.status === "failed") return invalid("source_tabular_region_detection_contract_invalid");
  if (c.status === "failed") return invalid("source_physical_cell_hypothesis_formation_contract_invalid");
  if (g.status === "failed") return invalid("source_physical_cell_text_evidence_contract_invalid");

  if (s.sourceByteHash !== t.sourceByteHash || s.sourceByteHash !== c.sourceByteHash || s.sourceByteHash !== g.sourceByteHash) return invalid("source_lineage_mismatch");
  if (!tabularDerivesFromStructure(input) || !cellFormationDerivesFromSources(input) || !textEvidenceDerivesFromSources(input)) return invalid("source_lineage_mismatch");

  if (!isStructureReconstructionFingerprintValid(s)) return invalid("source_fingerprint_invalid");
  if (!isTabularRegionDetectionFingerprintValid(t)) return invalid("source_fingerprint_invalid");
  if (!isPhysicalCellHypothesisFormationFingerprintValid(c)) return invalid("source_fingerprint_invalid");
  if (!isPhysicalCellTextEvidenceFormationFingerprintValid(g)) return invalid("source_fingerprint_invalid");

  const structureGroupKeys = uniqueKeySet(s.groups, (group) => group.sourceCandidateGroupKey);
  const candidateGroupKeys = uniqueKeySet(t.groups, (group) => group.sourceCandidateGroupKey);
  const cellFormationGroupKeys = uniqueKeySet(c.groups, (group) => group.sourceCandidateGroupKey);
  const textEvidenceGroupKeys = uniqueKeySet(g.groups, (group) => group.sourceCandidateGroupKey);
  if (!structureGroupKeys || !candidateGroupKeys || !cellFormationGroupKeys || !textEvidenceGroupKeys) return invalid("source_group_reference_invalid");
  if (!setsEqual(structureGroupKeys, candidateGroupKeys) || !setsEqual(structureGroupKeys, cellFormationGroupKeys) || !setsEqual(structureGroupKeys, textEvidenceGroupKeys)) return invalid("source_group_reference_invalid");

  const structureGroupByKey = new Map(s.groups.map((group) => [group.sourceCandidateGroupKey, group]));
  const cellFormationGroupByKey = new Map(c.groups.map((group) => [group.sourceCandidateGroupKey, group]));
  const textEvidenceGroupByKey = new Map(g.groups.map((group) => [group.sourceCandidateGroupKey, group]));

  const validatedGroups: ValidatedGroupSources[] = [];
  for (const candidateGroup of t.groups) {
    const structureGroup = structureGroupByKey.get(candidateGroup.sourceCandidateGroupKey)!;
    const cellFormationGroup = cellFormationGroupByKey.get(candidateGroup.sourceCandidateGroupKey)!;
    const textEvidenceGroup = textEvidenceGroupByKey.get(candidateGroup.sourceCandidateGroupKey)!;

    const structurePageByNumber = new Map(structureGroup.pages.map((page) => [page.pageNumber, page]));
    const cellFormationPageByNumber = new Map(cellFormationGroup.pages.map((page) => [page.pageNumber, page]));
    // `textEvidenceGroup` is always defined here (never `undefined`): the group-population
    // equality check above (`setsEqual(structureGroupKeys, textEvidenceGroupKeys)`, transitively
    // through `structureGroupKeys`) already proved that every `sourceCandidateGroupKey` iterated
    // by this loop (drawn from `t.groups`) has a matching entry in `g.groups`, before the loop
    // ever starts. Investigated as M4: the prior `g.groups.length ? … : []` guard was dead code —
    // `g.groups.length` can only be 0 when `t.groups` is also empty, in which case this loop body
    // never runs at all. Removed rather than kept unexplained (see the input-validation test suite
    // for the adversarial proof of the population-equality gate this relies on).
    const textEvidencePageByNumber = new Map(textEvidenceGroup.pages.map((page) => [page.pageNumber, page]));

    const candidatePageNumbers = uniqueKeySet(candidateGroup.pages, (page) => String(page.pageNumber));
    if (!candidatePageNumbers) return invalid("source_page_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey });
    // Toda página candidata (f.2a) precisa existir na reconstrução estrutural (fonte das linhas/segmentos).
    for (const candidatePage of candidateGroup.pages) {
      if (!structurePageByNumber.has(candidatePage.pageNumber)) return invalid("source_page_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: candidatePage.pageNumber });
    }
    // Nenhuma página c/g órfã (fora da população candidata).
    for (const page of cellFormationGroup.pages) if (!candidatePageNumbers.has(String(page.pageNumber))) return invalid("source_page_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: page.pageNumber });
    for (const page of textEvidenceGroup.pages) if (!candidatePageNumbers.has(String(page.pageNumber))) return invalid("source_page_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: page.pageNumber });

    const validatedPages: ValidatedPageSources[] = [];
    for (const candidatePage of candidateGroup.pages) {
      const structurePage = structurePageByNumber.get(candidatePage.pageNumber)!;
      const cellFormationPage = cellFormationPageByNumber.get(candidatePage.pageNumber) ?? null;
      const textEvidencePage = textEvidencePageByNumber.get(candidatePage.pageNumber) ?? null;

      const candidateRegionKeys = uniqueKeySet(candidatePage.regions, (region) => region.regionKey);
      if (!candidateRegionKeys) return invalid("source_region_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: candidatePage.pageNumber });

      const cellFormationRegionByKey = new Map<string, PhysicalCellHypothesisFormationRegion>((cellFormationPage?.regions ?? []).map((region) => [region.sourceRegionKey, region]));
      const textEvidenceRegionByKey = new Map<string, PhysicalCellTextEvidenceFormationRegion>((textEvidencePage?.regions ?? []).map((region) => [region.sourceRegionKey, region]));

      // Quando a página física de células foi processada, sua população de regiões deve coincidir exatamente com a população candidata.
      const cellFormationPageProcessable = cellFormationPage !== null && cellFormationPage.status !== "page_not_processable";
      if (cellFormationPageProcessable) {
        const cellRegionKeys = uniqueKeySet(cellFormationPage!.regions, (region) => region.sourceRegionKey);
        if (!cellRegionKeys || !setsEqual(cellRegionKeys, candidateRegionKeys)) return invalid("source_region_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: candidatePage.pageNumber });
      } else if (cellFormationPage !== null && cellFormationPage.regions.length !== 0) {
        return invalid("source_upstream_state_incoherent", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: candidatePage.pageNumber });
      }
      // A g.1 espelha a f.2c: se há região de células, deve haver a região textual correspondente.
      const textEvidencePageProcessable = textEvidencePage !== null && textEvidencePage.status !== "page_not_processable";
      if (cellFormationPageProcessable && !textEvidencePageProcessable) return invalid("source_region_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: candidatePage.pageNumber });

      const structureLineByKey = new Map(structurePage.lines.map((line) => [line.lineKey, line]));
      const structureSegmentByKey = new Map(structurePage.segments.map((segment) => [segment.segmentKey, segment]));

      const validatedRegions: ValidatedRegionSources[] = [];
      for (const regionCandidate of candidatePage.regions) {
        if (regionCandidate.pageNumber !== structurePage.pageNumber) return invalid("source_region_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: candidatePage.pageNumber, regionKey: regionCandidate.regionKey });
        const cellFormationRegion = cellFormationRegionByKey.get(regionCandidate.regionKey) ?? null;
        const textEvidenceRegion = textEvidenceRegionByKey.get(regionCandidate.regionKey) ?? null;

        // Toda linha e segmento da região precisam existir na reconstrução estrutural.
        for (const lineKey of regionCandidate.lineKeys) {
          const line = structureLineByKey.get(lineKey);
          if (!line) return invalid("source_line_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: candidatePage.pageNumber, regionKey: regionCandidate.regionKey, lineKey });
          for (const segmentKey of line.segmentKeys) {
            if (!structureSegmentByKey.has(segmentKey)) return invalid("source_segment_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: candidatePage.pageNumber, regionKey: regionCandidate.regionKey, lineKey, segmentKey });
          }
        }

        if (cellFormationRegion) {
          const regionLineKeys = new Set(regionCandidate.lineKeys);
          // Toda interseção pertence a uma linha da própria região candidata.
          for (const intersection of cellFormationRegion.gridIntersections) {
            if (!regionLineKeys.has(intersection.sourceLineKey)) return invalid("source_grid_intersection_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: candidatePage.pageNumber, regionKey: regionCandidate.regionKey, gridIntersectionKey: intersection.gridIntersectionKey });
          }
          if (uniqueKeySet(cellFormationRegion.cellHypotheses, (cell) => cell.cellHypothesisKey) === null) return invalid("source_cell_hypothesis_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: candidatePage.pageNumber, regionKey: regionCandidate.regionKey });
          if (!everyCellHypothesisHasIntersection(cellFormationRegion)) return invalid("source_cell_hypothesis_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: candidatePage.pageNumber, regionKey: regionCandidate.regionKey });

          if (cellFormationRegion.cellHypotheses.length > 0) {
            if (!textEvidenceRegion) return invalid("source_cell_text_evidence_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: candidatePage.pageNumber, regionKey: regionCandidate.regionKey });
            const textEvidenceKeys = new Set(textEvidenceRegion.cellTextEvidences.map((evidence) => evidence.cellHypothesisKey));
            const cellKeys = new Set(cellFormationRegion.cellHypotheses.map((cell) => cell.cellHypothesisKey));
            if (!setsEqual(textEvidenceKeys, cellKeys)) return invalid("source_cell_text_evidence_reference_invalid", { groupKey: candidateGroup.sourceCandidateGroupKey, pageNumber: candidatePage.pageNumber, regionKey: regionCandidate.regionKey });
          }
        }
        validatedRegions.push({ regionCandidate, cellFormationRegion, textEvidenceRegion });
      }

      validatedPages.push({ pageNumber: candidatePage.pageNumber, candidatePage, structurePage, cellFormationPage, textEvidencePage, structureLineByKey, structureSegmentByKey, regions: validatedRegions });
    }

    validatedGroups.push({ sourceCandidateGroupKey: candidateGroup.sourceCandidateGroupKey, startPageNumber: structureGroup.startPageNumber, endPageNumber: structureGroup.endPageNumber, candidateGroup, structureGroup, cellFormationGroup, textEvidenceGroup, pages: validatedPages });
  }

  return { kind: "valid", groups: validatedGroups };
}
