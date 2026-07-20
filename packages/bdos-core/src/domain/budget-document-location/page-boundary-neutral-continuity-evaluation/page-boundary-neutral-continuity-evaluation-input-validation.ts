import type { NeutralDocumentGroup, NeutralDocumentPage } from "../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import type { BudgetDocumentPageBoundaryNeutralContinuityEvaluationInput, PageBoundaryNeutralContinuityTechnicalProblem } from "./budget-document-page-boundary-neutral-continuity-evaluation.types";
import { isSupportedPageLocalNeutralStructuredEvidenceFormationContract } from "./page-boundary-neutral-continuity-evaluation-source-contracts";
import { isPageLocalNeutralStructuredEvidenceFormationFingerprintValid } from "./page-boundary-neutral-continuity-evaluation-upstream-fingerprint-validation";
import { problem } from "./page-boundary-neutral-continuity-evaluation-technical-problem";

export type PageBoundaryNeutralContinuityInputValidationResult =
  | { readonly kind: "valid"; readonly groups: ReadonlyArray<NeutralDocumentGroup> }
  | { readonly kind: "invalid"; readonly problems: ReadonlyArray<PageBoundaryNeutralContinuityTechnicalProblem> };

/**
 * Primeira chave de grupo duplicada encontrada, ou `null` se todas as
 * `sourceCandidateGroupKey` da g.2 consumida forem únicas. Comparação
 * determinística por valor (igualdade de string) — nunca por identidade de
 * objeto, nunca dependente de qualquer população derivada posteriormente.
 */
function findDuplicateGroupKey(groups: ReadonlyArray<NeutralDocumentGroup>): string | null {
  const seen = new Set<string>();
  for (const group of groups) {
    if (seen.has(group.sourceCandidateGroupKey)) return group.sourceCandidateGroupKey;
    seen.add(group.sourceCandidateGroupKey);
  }
  return null;
}

/** Validação global da entrada única (§2 da especificação aprovada). Falha aqui invalida o resultado inteiro — nunca localizada, nunca execução parcial. */
export function validatePageBoundaryNeutralContinuityEvaluationInput(
  input: BudgetDocumentPageBoundaryNeutralContinuityEvaluationInput,
): PageBoundaryNeutralContinuityInputValidationResult {
  const source = input.pageLocalNeutralStructuredEvidence;
  if (!isSupportedPageLocalNeutralStructuredEvidenceFormationContract(source)) return { kind: "invalid", problems: [problem("source_contract_version_unsupported", "source_validation")] };
  if (source.status === "failed") return { kind: "invalid", problems: [problem("source_status_invalid", "source_validation")] };
  if (!isPageLocalNeutralStructuredEvidenceFormationFingerprintValid(source)) return { kind: "invalid", problems: [problem("source_fingerprint_invalid", "source_validation")] };
  const duplicateGroupKey = findDuplicateGroupKey(source.groups);
  if (duplicateGroupKey !== null) return { kind: "invalid", problems: [problem("source_group_reference_invalid", "source_validation", { sourceCandidateGroupKey: duplicateGroupKey })] };
  return { kind: "valid", groups: source.groups };
}

export type GroupPopulationIncoherenceCode = "source_group_page_population_incoherent" | "source_region_reference_invalid" | "source_line_reference_invalid";

export type GroupPopulationValidation =
  | { readonly kind: "coherent"; readonly pages: ReadonlyArray<NeutralDocumentPage> }
  | { readonly kind: "incoherent"; readonly code: GroupPopulationIncoherenceCode };

function uniqueAndContiguous(pageNumbers: ReadonlyArray<number>): boolean {
  if (pageNumbers.length === 0) return true;
  if (new Set(pageNumbers).size !== pageNumbers.length) return false;
  const sorted = [...pageNumbers].sort((a, b) => a - b);
  return sorted.every((value, index) => value === sorted[0] + index);
}

/**
 * Gate 0 (§5/§12, emenda 2): unicidade e contiguidade de página, e coerência
 * interna de chaves de região/linha dentro de cada página do grupo. Grupos
 * são formados rio acima como intervalo de página contíguo por construção
 * (`contiguous-candidate-pages-v1`); encontrar uma lacuna ou duplicidade aqui
 * só pode significar uma incoerência de linhagem entre contratos — nunca uma
 * lacuna legítima do domínio. Falha aqui isola no nível do GRUPO: o grupo
 * inteiro produz zero avaliações, mas os demais grupos continuam normalmente.
 */
export function validateGroupPopulation(group: NeutralDocumentGroup): GroupPopulationValidation {
  const sortedPages = [...group.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  if (!uniqueAndContiguous(sortedPages.map((page) => page.pageNumber))) {
    return { kind: "incoherent", code: "source_group_page_population_incoherent" };
  }
  for (const page of sortedPages) {
    const regionKeys = page.regions.map((region) => region.sourceRegionKey);
    if (new Set(regionKeys).size !== regionKeys.length) return { kind: "incoherent", code: "source_region_reference_invalid" };
    for (const region of page.regions) {
      if (region.pageNumber !== page.pageNumber) return { kind: "incoherent", code: "source_region_reference_invalid" };
      if (region.sourceRegionCandidate.regionKey !== region.sourceRegionKey) return { kind: "incoherent", code: "source_region_reference_invalid" };
      if (region.sourceRegionCandidate.pageNumber !== page.pageNumber) return { kind: "incoherent", code: "source_region_reference_invalid" };
    }
    const allLineKeys = page.regions.flatMap((region) => region.documentLines.map((line) => line.sourceLineKey));
    if (new Set(allLineKeys).size !== allLineKeys.length) return { kind: "incoherent", code: "source_line_reference_invalid" };
    for (const region of page.regions) {
      for (const line of region.documentLines) {
        if (line.pageNumber !== page.pageNumber) return { kind: "incoherent", code: "source_line_reference_invalid" };
        if (line.sourceLine.lineKey !== line.sourceLineKey) return { kind: "incoherent", code: "source_line_reference_invalid" };
        if (line.sourceLine.pageNumber !== page.pageNumber) return { kind: "incoherent", code: "source_line_reference_invalid" };
      }
    }
  }
  return { kind: "coherent", pages: sortedPages };
}

export interface ExpectedBoundaryPair {
  readonly sourceCandidateGroupKey: string;
  readonly originPage: NeutralDocumentPage;
  readonly targetPage: NeutralDocumentPage;
}

export interface IncoherentGroup {
  readonly sourceCandidateGroupKey: string;
  readonly code: GroupPopulationIncoherenceCode;
}

export interface ExpectedBoundaryPopulation {
  readonly pairs: ReadonlyArray<ExpectedBoundaryPair>;
  readonly incoherentGroups: ReadonlyArray<IncoherentGroup>;
}

/**
 * População normativa (§5/§12): recalculada do zero a partir dos grupos
 * publicados pela g.2 — nunca confiada a partir de qualquer avaliação já
 * produzida. Reutilizada tanto pela formação quanto pela conservação
 * (Gate 1), garantindo que ambas partem exatamente da mesma fonte.
 */
export function computeExpectedBoundaryPopulation(groups: ReadonlyArray<NeutralDocumentGroup>): ExpectedBoundaryPopulation {
  const pairs: ExpectedBoundaryPair[] = [];
  const incoherentGroups: IncoherentGroup[] = [];
  for (const group of groups) {
    const validation = validateGroupPopulation(group);
    if (validation.kind === "incoherent") {
      incoherentGroups.push({ sourceCandidateGroupKey: group.sourceCandidateGroupKey, code: validation.code });
      continue;
    }
    for (let index = 0; index < validation.pages.length - 1; index += 1) {
      pairs.push({ sourceCandidateGroupKey: group.sourceCandidateGroupKey, originPage: validation.pages[index], targetPage: validation.pages[index + 1] });
    }
  }
  return { pairs, incoherentGroups };
}
