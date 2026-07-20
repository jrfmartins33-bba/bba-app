import type { EconomicCharacterizationMetrics, EconomicCharacterizationTechnicalProblem, ProposedBudgetLine } from "./budget-document-economic-characterization.types";
import { sumCents } from "../budget-version";

export function computeMetrics(
  proposedLines: ReadonlyArray<ProposedBudgetLine>,
  declaredTotalCents: number | null,
  recalculatedTotalCents: number | null,
  technicalProblems: ReadonlyArray<EconomicCharacterizationTechnicalProblem>,
): EconomicCharacterizationMetrics {
  const count = (predicate: (line: ProposedBudgetLine) => boolean) => proposedLines.filter(predicate).length;
  return {
    totalLinesProcessed: proposedLines.length,
    groupCount: count((l) => l.type === "group"),
    subgroupCount: count((l) => l.type === "subgroup"),
    serviceItemCount: count((l) => l.type === "service_item"),
    headerCount: count((l) => l.type === "header"),
    repeatedHeaderCount: count((l) => l.type === "repeated_header"),
    subtotalOrTotalCount: count((l) => l.type === "subtotal_or_total"),
    noteCount: count((l) => l.type === "note"),
    emptyCount: count((l) => l.type === "empty"),
    ambiguousCount: count((l) => l.type === "ambiguous"),
    notProcessableCount: count((l) => l.type === "not_processable"),
    extractedCount: count((l) => l.extractionStatus === "extracted"),
    extractedWithWarningsCount: count((l) => l.extractionStatus === "extracted_with_warnings"),
    requiresReviewCount: count((l) => l.extractionStatus === "requires_review"),
    incompleteCount: count((l) => l.extractionStatus === "incomplete"),
    notImportableCount: count((l) => l.extractionStatus === "not_importable"),
    technicalFailureCount: count((l) => l.extractionStatus === "technical_failure"),
    declaredTotalCents,
    recalculatedTotalCents,
    technicalProblemCount: technicalProblems.length + proposedLines.reduce((total, line) => total + line.technicalProblems.length, 0),
  };
}

/** Soma os totais de todos os Itens de Serviço com total analisado — nunca soma Grupo/Subgrupo/subtotal (evita dupla contagem, §18). */
export function sumServiceItemTotals(proposedLines: ReadonlyArray<ProposedBudgetLine>): number | null {
  const values = proposedLines
    .filter((line) => line.type === "service_item" && line.total.status === "parsed" && line.total.cents !== null)
    .map((line) => line.total.cents!);
  if (values.length === 0) return null;
  return sumCents(values);
}
