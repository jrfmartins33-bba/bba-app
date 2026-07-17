import type { BudgetDocumentStructureReconstructionResult, ReconstructedBudgetDocumentPage } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { StructureReconstructionContextFingerprintInput } from "../structure-reconstruction/structure-reconstruction-context-fingerprint";
import { computeStructureReconstructionContextFingerprint } from "../structure-reconstruction/structure-reconstruction-context-fingerprint";
import type { BudgetDocumentTabularRegionDetectionInput, TabularRegionDetectionTechnicalProblem } from "./budget-document-tabular-region-detection.types";
import { findCompatibleStructureReconstructionContract, SUPPORTED_TABULAR_REGION_DETECTION_SOURCE_CONTRACTS } from "./tabular-region-detection-source-contracts";
import { createTabularRegionDetectionTechnicalProblem } from "./tabular-region-detection-technical-problem";

/**
 * Validação de compatibilidade e linhagem da reconstrução estrutural
 * recebida (Sprint 21.4A.2.f.2a). Nunca corrige, renumera ou refaz a
 * entrada — apenas confirma que o contrato é o suportado, que o fingerprint
 * de contexto da reconstrução recebida confere com o valor recalculado, e
 * que os grupos/páginas/linhas/segmentos recebidos são estruturalmente
 * coerentes o bastante para serem processados com segurança. Condições
 * legítimas de página individual (`not_reconstructable`,
 * `reconstructed_with_problems`) nunca são tratadas como entrada inválida
 * aqui — são estados normais que o orquestrador trata por página.
 */
export type TabularRegionDetectionInputValidationResult =
  | { readonly kind: "valid" }
  | { readonly kind: "invalid"; readonly problems: ReadonlyArray<TabularRegionDetectionTechnicalProblem> };

function invalid(problems: ReadonlyArray<TabularRegionDetectionTechnicalProblem>): TabularRegionDetectionInputValidationResult {
  return { kind: "invalid", problems };
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/** Conjunto de inteiros denso e único de 1..N, independente da ordem do array de entrada (mesmo padrão de `hasDenseTextItemIndices` na Sprint anterior). */
function isDenseFromOne(values: ReadonlyArray<number>): boolean {
  const unique = new Set(values);
  if (unique.size !== values.length) {
    return false;
  }
  return [...unique].sort((a, b) => a - b).every((value, position) => value === position + 1);
}

/**
 * Recompõe a entrada exata do fingerprint de contexto da reconstrução a
 * partir das identidades já achatadas em `BudgetDocumentStructureReconstructionResult`
 * (§18 do contrato da Sprint anterior) — nunca duplica a lógica de hash em
 * si, reaproveitando `computeStructureReconstructionContextFingerprint`
 * (importado por caminho relativo direto, nunca pelo barrel, mesmo padrão
 * já usado pela Sprint anterior para `computeGeometryContextFingerprint`).
 * `geometryCanonicalizationVersion` não é exposto individualmente no
 * resultado recebido — usa-se o valor pinado no único contrato suportado
 * (verificado por igualdade exata antes desta recomputação).
 */
function recomputeReconstructionContextFingerprint(source: BudgetDocumentStructureReconstructionResult): string {
  const pinned = SUPPORTED_TABULAR_REGION_DETECTION_SOURCE_CONTRACTS.structureReconstruction[0];
  const fingerprintInput: StructureReconstructionContextFingerprintInput = {
    sourceByteHash: source.sourceByteHash,
    physicalReadSchemaVersion: source.physicalReadSchemaVersion,
    physicalReaderName: source.physicalReaderName,
    physicalReaderVersion: source.physicalReaderVersion,
    physicalAdapterVersion: source.physicalAdapterVersion,
    physicalUnderlyingLibraryVersion: source.physicalUnderlyingLibraryVersion,
    textItemCoordinateSpaceVersion: source.physicalTextItemCoordinateSpaceVersion,
    textItemGeometryProfileVersion: source.physicalTextItemGeometryProfileVersion,
    geometryContextFingerprintVersion: source.physicalGeometryContextFingerprintVersion,
    geometryContextFingerprint: source.physicalGeometryContextFingerprint,
    pageLocationSchemaVersion: source.pageLocationSchemaVersion,
    pageLocatorName: source.pageLocatorName,
    pageLocatorVersion: source.pageLocatorVersion,
    pageLocationDecisionRuleSetVersion: source.pageLocationDecisionRuleSetVersion,
    sourceObservationSchemaVersion: source.sourceObservationSchemaVersion,
    sourceObserverName: source.sourceObserverName,
    pageLocationCatalogVersion: source.sourceCatalogVersion,
    pageLocationObserverVersion: source.sourceObserverVersion,
    pageLocationObservationRuleSetVersion: source.sourceObservationRuleSetVersion,
    reconstructorName: source.reconstructorName,
    reconstructorVersion: source.reconstructorVersion,
    profileId: source.reconstructionProfileId,
    profileVersion: source.reconstructionProfileVersion,
    geometryCanonicalizationVersion: pinned.geometryCanonicalizationVersion,
  };
  return computeStructureReconstructionContextFingerprint(fingerprintInput);
}

function validatePage(groupKey: string, page: ReconstructedBudgetDocumentPage): ReadonlyArray<TabularRegionDetectionTechnicalProblem> {
  const problems: TabularRegionDetectionTechnicalProblem[] = [];

  if (page.pageReconstructionKey.trim().length === 0 || !isPositiveInteger(page.pageNumber)) {
    problems.push(createTabularRegionDetectionTechnicalProblem("source_page_contract_invalid", "source_validation", groupKey, page.pageNumber));
    return problems;
  }

  if (!isDenseFromOne(page.lines.map((line) => line.verticalOrder))) {
    problems.push(createTabularRegionDetectionTechnicalProblem("source_page_contract_invalid", "source_validation", groupKey, page.pageNumber));
  }

  const segmentByKey = new Map(page.segments.map((segment) => [segment.segmentKey, segment]));
  const lineByKey = new Map(page.lines.map((line) => [line.lineKey, line]));

  page.lines.forEach((line) => {
    const segmentsOfLine = page.segments.filter((segment) => segment.lineKey === line.lineKey);
    if (!isDenseFromOne(segmentsOfLine.map((segment) => segment.horizontalOrder))) {
      problems.push(createTabularRegionDetectionTechnicalProblem("source_page_contract_invalid", "source_validation", groupKey, page.pageNumber, line.lineKey));
    }
    const declaredSet = new Set(line.segmentKeys);
    const actualSet = new Set(segmentsOfLine.map((segment) => segment.segmentKey));
    const declaredMatchesActual = declaredSet.size === line.segmentKeys.length && declaredSet.size === actualSet.size && [...declaredSet].every((key) => actualSet.has(key));
    if (!declaredMatchesActual) {
      problems.push(createTabularRegionDetectionTechnicalProblem("source_structure_reference_invalid", "source_validation", groupKey, page.pageNumber, line.lineKey));
    }
  });

  page.segments.forEach((segment) => {
    if (!lineByKey.has(segment.lineKey)) {
      problems.push(createTabularRegionDetectionTechnicalProblem("source_structure_reference_invalid", "source_validation", groupKey, page.pageNumber, null, segment.segmentKey));
    }
  });

  if (segmentByKey.size !== page.segments.length) {
    problems.push(createTabularRegionDetectionTechnicalProblem("source_page_contract_invalid", "source_validation", groupKey, page.pageNumber));
  }
  if (lineByKey.size !== page.lines.length) {
    problems.push(createTabularRegionDetectionTechnicalProblem("source_page_contract_invalid", "source_validation", groupKey, page.pageNumber));
  }

  return problems;
}

function validateGroups(source: BudgetDocumentStructureReconstructionResult): ReadonlyArray<TabularRegionDetectionTechnicalProblem> {
  const problems: TabularRegionDetectionTechnicalProblem[] = [];
  const seenGroupKeys = new Set<string>();
  const seenPageNumbers = new Set<number>();

  source.groups.forEach((group) => {
    if (group.groupReconstructionKey.trim().length === 0 || group.pageKeys.length !== group.pages.length) {
      problems.push(createTabularRegionDetectionTechnicalProblem("source_group_contract_invalid", "source_validation", group.groupReconstructionKey || null));
      return;
    }
    if (seenGroupKeys.has(group.groupReconstructionKey)) {
      problems.push(createTabularRegionDetectionTechnicalProblem("source_group_contract_invalid", "source_validation", group.groupReconstructionKey));
    }
    seenGroupKeys.add(group.groupReconstructionKey);

    if (!isPositiveInteger(group.startPageNumber) || !isPositiveInteger(group.endPageNumber) || group.startPageNumber > group.endPageNumber) {
      problems.push(createTabularRegionDetectionTechnicalProblem("source_group_contract_invalid", "source_validation", group.groupReconstructionKey));
      return;
    }

    const pageNumbers = group.pages.map((page) => page.pageNumber);
    const uniquePageNumbers = new Set(pageNumbers);
    if (uniquePageNumbers.size !== pageNumbers.length) {
      problems.push(createTabularRegionDetectionTechnicalProblem("source_group_contract_invalid", "source_validation", group.groupReconstructionKey));
      return;
    }
    const orderedPageNumbers = [...uniquePageNumbers].sort((a, b) => a - b);
    const contiguousAndBounded =
      orderedPageNumbers.length > 0 &&
      orderedPageNumbers[0] === group.startPageNumber &&
      orderedPageNumbers[orderedPageNumbers.length - 1] === group.endPageNumber &&
      orderedPageNumbers.every((pageNumber, position) => position === 0 || pageNumber === orderedPageNumbers[position - 1] + 1);
    if (!contiguousAndBounded) {
      problems.push(createTabularRegionDetectionTechnicalProblem("source_group_contract_invalid", "source_validation", group.groupReconstructionKey));
    }

    const declaredPageKeySet = new Set(group.pageKeys);
    const actualPageKeySet = new Set(group.pages.map((page) => page.pageReconstructionKey));
    const pageKeysCoherent =
      declaredPageKeySet.size === group.pageKeys.length &&
      declaredPageKeySet.size === actualPageKeySet.size &&
      [...declaredPageKeySet].every((key) => actualPageKeySet.has(key));
    if (!pageKeysCoherent) {
      problems.push(createTabularRegionDetectionTechnicalProblem("source_group_contract_invalid", "source_validation", group.groupReconstructionKey));
    }

    group.pages.forEach((page) => {
      if (seenPageNumbers.has(page.pageNumber)) {
        problems.push(createTabularRegionDetectionTechnicalProblem("source_page_contract_invalid", "source_validation", group.groupReconstructionKey, page.pageNumber));
      }
      seenPageNumbers.add(page.pageNumber);
      problems.push(...validatePage(group.groupReconstructionKey, page));
    });
  });

  return problems;
}

export function validateTabularRegionDetectionInput(
  input: BudgetDocumentTabularRegionDetectionInput,
): TabularRegionDetectionInputValidationResult {
  const { structureReconstruction } = input;

  if (findCompatibleStructureReconstructionContract(structureReconstruction) === null) {
    return invalid([createTabularRegionDetectionTechnicalProblem("source_contract_version_unsupported", "source_validation")]);
  }
  if (structureReconstruction.status === "failed") {
    return invalid([createTabularRegionDetectionTechnicalProblem("source_reconstruction_contract_invalid", "source_validation")]);
  }

  const recomputedFingerprint = recomputeReconstructionContextFingerprint(structureReconstruction);
  if (recomputedFingerprint !== structureReconstruction.reconstructionContextFingerprint) {
    return invalid([createTabularRegionDetectionTechnicalProblem("source_reconstruction_fingerprint_invalid", "source_validation")]);
  }

  const problems = validateGroups(structureReconstruction);
  return problems.length === 0 ? { kind: "valid" } : invalid(problems);
}
