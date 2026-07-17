import type { BudgetDocumentPageDecision, BudgetDocumentPageLocationResult } from "../page-location/budget-page-location.types";
import { CANDIDATE_GROUP_FORMATION_RULE_ID, CANDIDATE_GROUP_FORMATION_RULE_VERSION } from "../page-location/budget-page-location.types";
import type { PhysicalDocumentReadResult } from "../physical-document-read.types";
import { computeGeometryContextFingerprint } from "../physical-document-geometry-context-fingerprint";
import type { BudgetDocumentStructureReconstructionInput, StructureReconstructionTechnicalProblem } from "./budget-document-structure-reconstruction.types";
import { findCompatiblePageLocationContract, findCompatiblePhysicalReadContract } from "./structure-reconstruction-source-contracts";
import { createStructureReconstructionTechnicalProblem } from "./structure-reconstruction-technical-problem";

/**
 * Validação de compatibilidade e linhagem entre `PhysicalDocumentReadResult`
 * e `BudgetDocumentPageLocationResult` (Sprint 21.4A.2.f.1, §16-17;
 * endurecido na auditoria do PR #69, §4-§5). Nunca corrige, renumera ou
 * refaz a entrada — apenas confirma que os dois contratos, produzidos
 * independentemente, descrevem de fato o mesmo documento, a mesma versão
 * técnica, e que os grupos candidatos recebidos são integralmente
 * coerentes com as decisões de página que os originaram.
 */
export type StructureReconstructionInputValidationResult =
  | { readonly kind: "valid" }
  | { readonly kind: "invalid"; readonly problems: ReadonlyArray<StructureReconstructionTechnicalProblem> };

function invalid(problems: ReadonlyArray<StructureReconstructionTechnicalProblem>): StructureReconstructionInputValidationResult {
  return { kind: "invalid", problems };
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/**
 * Densidade dos índices de item textual de uma página (auditoria pós-PR
 * #69, §4): confirma que os índices são inteiros não negativos, únicos e
 * formam o conjunto denso `0..N-1` — nunca exige que a posição no array
 * seja igual ao índice. A reconstrução em si já opera inteiramente por
 * `item.index` (nunca por posição no array), então a mesma página com os
 * mesmos itens apresentados em ordem diferente deve permanecer válida.
 */
function hasDenseTextItemIndices(indices: ReadonlyArray<number>): boolean {
  if (!indices.every((index) => Number.isInteger(index) && index >= 0)) {
    return false;
  }
  const unique = new Set(indices);
  if (unique.size !== indices.length) {
    return false;
  }
  return [...unique].sort((a, b) => a - b).every((index, position) => index === position);
}

function validatePhysicalReadDensity(physicalRead: PhysicalDocumentReadResult): ReadonlyArray<StructureReconstructionTechnicalProblem> {
  const problems: StructureReconstructionTechnicalProblem[] = [];

  if (physicalRead.pages.length !== physicalRead.totalPageCount || physicalRead.totalPageCount <= 0) {
    problems.push(createStructureReconstructionTechnicalProblem("physical_read_contract_invalid", "source_validation"));
    return problems;
  }

  physicalRead.pages.forEach((page, index) => {
    if (page.pageNumber !== index + 1) {
      problems.push(createStructureReconstructionTechnicalProblem("physical_read_contract_invalid", "source_validation", null, page.pageNumber));
    }
    if (!hasDenseTextItemIndices(page.textItems.map((item) => item.index))) {
      problems.push(createStructureReconstructionTechnicalProblem("physical_read_contract_invalid", "source_validation", null, page.pageNumber));
    }
  });

  return problems;
}

/**
 * Valida as decisões de página da localização em si (auditoria pós-PR #69,
 * §5): exatamente `totalPageCount` decisões, páginas únicas e densas de 1
 * a N, identidades de origem coerentes com o `BudgetDocumentPageLocationResult`
 * pai, e coerência interna `classification === "candidate" ⟺ candidateType !== null`.
 * Devolve o mapa por página para reutilização pela validação de grupos —
 * nunca reconstrói ou corrige uma decisão.
 */
function validatePageDecisions(
  pageLocation: BudgetDocumentPageLocationResult,
): { readonly problems: ReadonlyArray<StructureReconstructionTechnicalProblem>; readonly decisionsByPage: ReadonlyMap<number, BudgetDocumentPageDecision> } {
  const problems: StructureReconstructionTechnicalProblem[] = [];
  const decisionsByPage = new Map<number, BudgetDocumentPageDecision>();
  const seenPageNumbers = new Set<number>();

  if (pageLocation.pageDecisions.length !== pageLocation.totalPageCount) {
    problems.push(createStructureReconstructionTechnicalProblem("page_location_contract_invalid", "source_validation"));
  }

  pageLocation.pageDecisions.forEach((decision) => {
    if (!isPositiveInteger(decision.pageNumber) || decision.pageNumber > pageLocation.totalPageCount || seenPageNumbers.has(decision.pageNumber)) {
      problems.push(createStructureReconstructionTechnicalProblem("page_location_contract_invalid", "source_validation", null, decision.pageNumber));
      return;
    }
    seenPageNumbers.add(decision.pageNumber);
    decisionsByPage.set(decision.pageNumber, decision);

    const identityCoherent =
      decision.sourceByteHash === pageLocation.sourceByteHash &&
      decision.locatorVersion === pageLocation.locatorVersion &&
      decision.decisionRuleSetVersion === pageLocation.decisionRuleSetVersion &&
      (pageLocation.sourceObserverVersion === null || decision.sourceObserverVersion === pageLocation.sourceObserverVersion) &&
      (pageLocation.sourceObservationRuleSetVersion === null || decision.sourceObservationRuleSetVersion === pageLocation.sourceObservationRuleSetVersion) &&
      (pageLocation.sourceCatalogVersion === null || decision.sourceCatalogVersion === pageLocation.sourceCatalogVersion);
    if (!identityCoherent) {
      problems.push(createStructureReconstructionTechnicalProblem("page_location_contract_invalid", "source_validation", null, decision.pageNumber));
    }

    const candidacyCoherent = (decision.classification === "candidate") === (decision.candidateType !== null);
    if (!candidacyCoherent) {
      problems.push(createStructureReconstructionTechnicalProblem("page_location_contract_invalid", "source_validation", null, decision.pageNumber));
    }
  });

  const isDenseFromOne =
    seenPageNumbers.size === pageLocation.totalPageCount && [...seenPageNumbers].sort((a, b) => a - b).every((pageNumber, position) => pageNumber === position + 1);
  if (!isDenseFromOne) {
    problems.push(createStructureReconstructionTechnicalProblem("page_location_contract_invalid", "source_validation"));
  }

  return { problems, decisionsByPage };
}

/** `[sourceByteHash, startPageNumber, endPageNumber, locatorVersion, decisionRuleSetVersion].join(":")` — a mesma fórmula determinística de `page-location-candidate-groups.ts`, recalculada aqui apenas para validação, nunca para gerar uma nova chave. */
function recomputeCandidateGroupKey(sourceByteHash: string, startPageNumber: number, endPageNumber: number, locatorVersion: string, decisionRuleSetVersion: string): string {
  return [sourceByteHash, startPageNumber, endPageNumber, locatorVersion, decisionRuleSetVersion].join(":");
}

function validateCandidateGroups(
  pageLocation: BudgetDocumentPageLocationResult,
  decisionsByPage: ReadonlyMap<number, BudgetDocumentPageDecision>,
): ReadonlyArray<StructureReconstructionTechnicalProblem> {
  const problems: StructureReconstructionTechnicalProblem[] = [];
  const pagesSeenInAnyGroup = new Set<number>();

  pageLocation.candidateGroups.forEach((group) => {
    const groupIdentityCoherent =
      group.sourceByteHash === pageLocation.sourceByteHash &&
      group.formationRuleId === CANDIDATE_GROUP_FORMATION_RULE_ID &&
      group.formationRuleVersion === CANDIDATE_GROUP_FORMATION_RULE_VERSION &&
      group.locatorVersion === pageLocation.locatorVersion &&
      group.decisionRuleSetVersion === pageLocation.decisionRuleSetVersion;
    if (!groupIdentityCoherent) {
      problems.push(createStructureReconstructionTechnicalProblem("candidate_group_contract_invalid", "source_validation", group.groupKey));
    }

    if (group.groupKey.trim().length === 0 || group.pageNumbers.length === 0 || group.members.length !== group.pageNumbers.length) {
      problems.push(createStructureReconstructionTechnicalProblem("candidate_group_contract_invalid", "source_validation", group.groupKey));
      return;
    }

    if (group.startPageNumber !== group.pageNumbers[0] || group.endPageNumber !== group.pageNumbers[group.pageNumbers.length - 1]) {
      problems.push(createStructureReconstructionTechnicalProblem("candidate_group_contract_invalid", "source_validation", group.groupKey));
    }

    const recomputedKey = recomputeCandidateGroupKey(group.sourceByteHash, group.startPageNumber, group.endPageNumber, group.locatorVersion, group.decisionRuleSetVersion);
    if (recomputedKey !== group.groupKey) {
      problems.push(createStructureReconstructionTechnicalProblem("candidate_group_contract_invalid", "source_validation", group.groupKey));
    }

    group.pageNumbers.forEach((pageNumber, position) => {
      if (pageNumber < 1 || pageNumber > pageLocation.totalPageCount) {
        problems.push(createStructureReconstructionTechnicalProblem("candidate_page_not_found", "source_validation", group.groupKey, pageNumber));
        return;
      }
      if (position > 0 && pageNumber !== group.pageNumbers[position - 1] + 1) {
        problems.push(createStructureReconstructionTechnicalProblem("candidate_group_contract_invalid", "source_validation", group.groupKey, pageNumber));
      }

      const member = group.members[position];
      if (member?.pageNumber !== pageNumber) {
        problems.push(createStructureReconstructionTechnicalProblem("candidate_group_contract_invalid", "source_validation", group.groupKey, pageNumber));
      }
      if (pagesSeenInAnyGroup.has(pageNumber)) {
        problems.push(createStructureReconstructionTechnicalProblem("candidate_group_contract_invalid", "source_validation", group.groupKey, pageNumber));
      }
      pagesSeenInAnyGroup.add(pageNumber);

      const decision = decisionsByPage.get(pageNumber);
      if (decision === undefined || decision.classification !== "candidate") {
        problems.push(createStructureReconstructionTechnicalProblem("candidate_group_contract_invalid", "source_validation", group.groupKey, pageNumber));
        return;
      }
      const memberMatchesDecision =
        member !== undefined &&
        member.candidateType === decision.candidateType &&
        member.primaryRuleId === decision.primaryRuleId &&
        member.primaryRuleVersion === decision.primaryRuleVersion;
      if (!memberMatchesDecision) {
        problems.push(createStructureReconstructionTechnicalProblem("candidate_group_contract_invalid", "source_validation", group.groupKey, pageNumber));
      }
    });

    group.members.forEach((member, position) => {
      const isLast = position === group.members.length - 1;
      if (member.candidateType === "closing" && !isLast) {
        problems.push(createStructureReconstructionTechnicalProblem("candidate_group_contract_invalid", "source_validation", group.groupKey, member.pageNumber));
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
    return invalid([createStructureReconstructionTechnicalProblem("source_contract_version_unsupported", "source_validation")]);
  }
  if (findCompatiblePageLocationContract(pageLocation) === null) {
    return invalid([createStructureReconstructionTechnicalProblem("source_contract_version_unsupported", "source_validation")]);
  }
  if (pageLocation.status === "failed") {
    return invalid([createStructureReconstructionTechnicalProblem("page_location_contract_invalid", "source_validation")]);
  }
  if (physicalRead.status === "failed") {
    return invalid([createStructureReconstructionTechnicalProblem("source_lineage_mismatch", "source_validation")]);
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
    return invalid([createStructureReconstructionTechnicalProblem("geometry_context_fingerprint_invalid", "source_validation")]);
  }

  const problems: StructureReconstructionTechnicalProblem[] = [];

  if (physicalRead.sourceByteHash !== pageLocation.sourceByteHash) {
    problems.push(createStructureReconstructionTechnicalProblem("source_lineage_mismatch", "source_validation"));
  }
  if (physicalRead.totalPageCount !== pageLocation.totalPageCount) {
    problems.push(createStructureReconstructionTechnicalProblem("source_lineage_mismatch", "source_validation"));
  }

  const sourceReadMetadata = pageLocation.sourceReadMetadata;
  if (sourceReadMetadata === null) {
    problems.push(createStructureReconstructionTechnicalProblem("page_location_contract_invalid", "source_validation"));
  } else if (
    sourceReadMetadata.readerName !== physicalRead.readerName ||
    sourceReadMetadata.readerVersion !== physicalRead.readerVersion ||
    sourceReadMetadata.adapterVersion !== physicalRead.adapterVersion ||
    sourceReadMetadata.underlyingLibraryVersion !== physicalRead.underlyingLibraryVersion ||
    sourceReadMetadata.sourceReadStatus !== physicalRead.status
  ) {
    problems.push(createStructureReconstructionTechnicalProblem("source_lineage_mismatch", "source_validation"));
  }

  problems.push(...validatePhysicalReadDensity(physicalRead));

  const { problems: pageDecisionProblems, decisionsByPage } = validatePageDecisions(pageLocation);
  problems.push(...pageDecisionProblems);
  problems.push(...validateCandidateGroups(pageLocation, decisionsByPage));

  return problems.length === 0 ? { kind: "valid" } : invalid(problems);
}
