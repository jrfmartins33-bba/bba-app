import type { ReconstructedBudgetDocumentGroup, ReconstructedBudgetDocumentPage } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { BudgetDocumentPhysicalColumnHypothesisReconstructionInput, PhysicalColumnHypothesisReconstructionTechnicalProblem } from "./budget-document-physical-column-hypothesis-reconstruction.types";
import { findCompatibleStructureReconstructionContract, findCompatibleTabularRegionDetectionContract } from "./physical-column-hypothesis-reconstruction-source-contracts";
import { createPhysicalColumnHypothesisReconstructionTechnicalProblem } from "./physical-column-hypothesis-reconstruction-technical-problem";

/**
 * Validação de compatibilidade e linhagem entre `BudgetDocumentStructureReconstructionResult`
 * (f.2a.1) e `BudgetDocumentTabularRegionDetectionResult` (f.2a.2) (Sprint
 * 21.4A.2.f.2b). Nunca corrige, renumera ou refaz a entrada. Como a f.2b
 * recebe os dois objetos de origem diretamente (nunca apenas um resumo),
 * a linhagem é validada por **igualdade direta de campo** — nunca
 * recomputação de hash — comparando os valores reais de
 * `structureReconstruction` contra os campos achatados que
 * `tabularRegionDetection` alega ter recebido. Estados legítimos de
 * página/grupo/região individual nunca são tratados como entrada
 * inválida aqui — são estados normais que o orquestrador trata.
 */
export type PhysicalColumnHypothesisReconstructionInputValidationResult =
  | { readonly kind: "valid" }
  | { readonly kind: "invalid"; readonly problems: ReadonlyArray<PhysicalColumnHypothesisReconstructionTechnicalProblem> };

function invalid(problems: ReadonlyArray<PhysicalColumnHypothesisReconstructionTechnicalProblem>): PhysicalColumnHypothesisReconstructionInputValidationResult {
  return { kind: "invalid", problems };
}

function validateLineage(input: BudgetDocumentPhysicalColumnHypothesisReconstructionInput): ReadonlyArray<PhysicalColumnHypothesisReconstructionTechnicalProblem> {
  const { structureReconstruction: s, tabularRegionDetection: t } = input;
  const problems: PhysicalColumnHypothesisReconstructionTechnicalProblem[] = [];

  const lineageFieldsCoherent =
    s.sourceByteHash === t.sourceByteHash &&
    s.schemaVersion === t.sourceReconstructionSchemaVersion &&
    s.reconstructorName === t.sourceReconstructorName &&
    s.reconstructorVersion === t.sourceReconstructorVersion &&
    s.reconstructionProfileId === t.sourceReconstructionProfileId &&
    s.reconstructionProfileVersion === t.sourceReconstructionProfileVersion &&
    s.reconstructionContextFingerprintVersion === t.sourceReconstructionContextFingerprintVersion;
  if (!lineageFieldsCoherent) {
    problems.push(createPhysicalColumnHypothesisReconstructionTechnicalProblem("source_lineage_mismatch", "source_validation"));
  }

  if (s.reconstructionContextFingerprint !== t.sourceReconstructionContextFingerprint) {
    problems.push(createPhysicalColumnHypothesisReconstructionTechnicalProblem("source_fingerprint_invalid", "source_validation"));
  }

  return problems;
}

function buildStructureLookup(structureReconstruction: BudgetDocumentPhysicalColumnHypothesisReconstructionInput["structureReconstruction"]) {
  const groupBySourceCandidateGroupKey = new Map<string, ReconstructedBudgetDocumentGroup>();
  structureReconstruction.groups.forEach((group) => groupBySourceCandidateGroupKey.set(group.sourceCandidateGroupKey, group));
  return groupBySourceCandidateGroupKey;
}

function pageByNumber(group: ReconstructedBudgetDocumentGroup): ReadonlyMap<number, ReconstructedBudgetDocumentPage> {
  return new Map(group.pages.map((page) => [page.pageNumber, page]));
}

function validateCrossReferences(input: BudgetDocumentPhysicalColumnHypothesisReconstructionInput): ReadonlyArray<PhysicalColumnHypothesisReconstructionTechnicalProblem> {
  const problems: PhysicalColumnHypothesisReconstructionTechnicalProblem[] = [];
  const structureGroupByKey = buildStructureLookup(input.structureReconstruction);

  input.tabularRegionDetection.groups.forEach((detectionGroup) => {
    const structureGroup = structureGroupByKey.get(detectionGroup.sourceCandidateGroupKey);
    if (structureGroup === undefined) {
      problems.push(
        createPhysicalColumnHypothesisReconstructionTechnicalProblem("source_reference_invalid", "source_validation", detectionGroup.sourceCandidateGroupKey),
      );
      return;
    }

    const structurePages = pageByNumber(structureGroup);

    detectionGroup.pages.forEach((detectionPage) => {
      const structurePage = structurePages.get(detectionPage.pageNumber);
      if (structurePage === undefined) {
        problems.push(
          createPhysicalColumnHypothesisReconstructionTechnicalProblem(
            "source_reference_invalid",
            "source_validation",
            detectionGroup.sourceCandidateGroupKey,
            detectionPage.pageNumber,
          ),
        );
        return;
      }

      const lineByKey = new Map(structurePage.lines.map((line) => [line.lineKey, line]));
      const segmentByKey = new Map(structurePage.segments.map((segment) => [segment.segmentKey, segment]));

      detectionPage.alignments.forEach((alignment) => {
        if (alignment.lineKeys.length !== alignment.segmentKeys.length) {
          problems.push(
            createPhysicalColumnHypothesisReconstructionTechnicalProblem(
              "source_tabular_region_detection_contract_invalid",
              "source_validation",
              detectionGroup.sourceCandidateGroupKey,
              detectionPage.pageNumber,
            ),
          );
          return;
        }
        alignment.lineKeys.forEach((lineKey, position) => {
          const segmentKey = alignment.segmentKeys[position];
          const line = lineByKey.get(lineKey);
          const segment = segmentByKey.get(segmentKey);
          if (line === undefined || segment === undefined || segment.lineKey !== lineKey) {
            problems.push(
              createPhysicalColumnHypothesisReconstructionTechnicalProblem(
                "source_reference_invalid",
                "source_validation",
                detectionGroup.sourceCandidateGroupKey,
                detectionPage.pageNumber,
                null,
                lineKey,
                segmentKey,
              ),
            );
          }
        });
      });

      const alignmentByKey = new Map(detectionPage.alignments.map((alignment) => [alignment.alignmentKey, alignment]));
      const dispositionByLineKey = new Map(detectionPage.lineDispositions.map((disposition) => [disposition.lineKey, disposition]));

      detectionPage.regions.forEach((region) => {
        const linesResolve = region.lineKeys.every((lineKey) => lineByKey.has(lineKey));
        if (!linesResolve || region.lineKeys.length === 0) {
          problems.push(
            createPhysicalColumnHypothesisReconstructionTechnicalProblem(
              "source_reference_invalid",
              "source_validation",
              detectionGroup.sourceCandidateGroupKey,
              detectionPage.pageNumber,
              region.regionKey,
            ),
          );
          return;
        }

        // Cada `supportingAlignmentKey` deve existir, ser única, e o alinhamento sustentador deve conter
        // *todas* as linhas da região — mas pode legitimamente conter linhas adicionais fora dela
        // (`RecurrentVerticalAlignment` é observado no nível da página inteira, nunca por região). A
        // relação correta é `region.lineKeys ⊆ supportingAlignment.lineKeys`, nunca igualdade exata
        // (auditoria pós-revisão, §5).
        const uniqueSupportingKeys = new Set(region.supportingAlignmentKeys);
        if (uniqueSupportingKeys.size !== region.supportingAlignmentKeys.length) {
          problems.push(
            createPhysicalColumnHypothesisReconstructionTechnicalProblem(
              "source_tabular_region_detection_contract_invalid",
              "source_validation",
              detectionGroup.sourceCandidateGroupKey,
              detectionPage.pageNumber,
              region.regionKey,
            ),
          );
        }

        region.supportingAlignmentKeys.forEach((alignmentKey) => {
          const alignment = alignmentByKey.get(alignmentKey);
          if (alignment === undefined) {
            problems.push(
              createPhysicalColumnHypothesisReconstructionTechnicalProblem(
                "source_reference_invalid",
                "source_validation",
                detectionGroup.sourceCandidateGroupKey,
                detectionPage.pageNumber,
                region.regionKey,
              ),
            );
            return;
          }
          const alignmentLineKeySet = new Set(alignment.lineKeys);
          const regionIsSubsetOfAlignment = region.lineKeys.every((lineKey) => alignmentLineKeySet.has(lineKey));
          if (!regionIsSubsetOfAlignment) {
            problems.push(
              createPhysicalColumnHypothesisReconstructionTechnicalProblem(
                "source_reference_invalid",
                "source_validation",
                detectionGroup.sourceCandidateGroupKey,
                detectionPage.pageNumber,
                region.regionKey,
              ),
            );
          }
        });

        // Cada linha da região deve ter disposição `included_in_candidate_region` apontando exatamente
        // para a própria região — nenhuma interpretação econômica envolvida, apenas coerência estrutural
        // do contrato recebido (auditoria pós-revisão, §5).
        region.lineKeys.forEach((lineKey) => {
          const disposition = dispositionByLineKey.get(lineKey);
          const coherent = disposition !== undefined && disposition.status === "included_in_candidate_region" && disposition.regionKey === region.regionKey;
          if (!coherent) {
            problems.push(
              createPhysicalColumnHypothesisReconstructionTechnicalProblem(
                "source_reference_invalid",
                "source_validation",
                detectionGroup.sourceCandidateGroupKey,
                detectionPage.pageNumber,
                region.regionKey,
                lineKey,
              ),
            );
          }
        });
      });
    });
  });

  return problems;
}

export function validatePhysicalColumnHypothesisReconstructionInput(
  input: BudgetDocumentPhysicalColumnHypothesisReconstructionInput,
): PhysicalColumnHypothesisReconstructionInputValidationResult {
  const { structureReconstruction, tabularRegionDetection } = input;

  if (findCompatibleStructureReconstructionContract(structureReconstruction) === null) {
    return invalid([createPhysicalColumnHypothesisReconstructionTechnicalProblem("source_contract_version_unsupported", "source_validation")]);
  }
  if (findCompatibleTabularRegionDetectionContract(tabularRegionDetection) === null) {
    return invalid([createPhysicalColumnHypothesisReconstructionTechnicalProblem("source_contract_version_unsupported", "source_validation")]);
  }
  if (structureReconstruction.status === "failed") {
    return invalid([createPhysicalColumnHypothesisReconstructionTechnicalProblem("source_structure_reconstruction_contract_invalid", "source_validation")]);
  }
  if (tabularRegionDetection.status === "failed") {
    return invalid([createPhysicalColumnHypothesisReconstructionTechnicalProblem("source_tabular_region_detection_contract_invalid", "source_validation")]);
  }

  const lineageProblems = validateLineage(input);
  if (lineageProblems.length > 0) {
    return invalid(lineageProblems);
  }

  const crossReferenceProblems = validateCrossReferences(input);
  return crossReferenceProblems.length === 0 ? { kind: "valid" } : invalid(crossReferenceProblems);
}
