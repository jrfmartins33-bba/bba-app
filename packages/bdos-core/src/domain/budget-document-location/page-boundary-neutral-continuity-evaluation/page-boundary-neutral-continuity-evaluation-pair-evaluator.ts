import type { NeutralDocumentPage } from "../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import type { PageBoundaryNeutralContinuityEvaluation, PageBoundaryNeutralContinuitySignal } from "./budget-document-page-boundary-neutral-continuity-evaluation.types";
import { selectClosingLine, selectClosingRegion, selectOpeningLine, selectOpeningRegion } from "./page-boundary-neutral-continuity-evaluation-boundary-selection";
import { classifyMeritSignals } from "./page-boundary-neutral-continuity-evaluation-classifiers";
import {
  evaluateBoundaryLineExistence,
  evaluateBoundaryRegionExistence,
  evaluateColumnSignatureCompatibility,
  evaluateHorizontalGeometryCompatibility,
  evaluatePageProcessability,
} from "./page-boundary-neutral-continuity-evaluation-signals";
import { problem } from "./page-boundary-neutral-continuity-evaluation-technical-problem";

/**
 * Avalia UMA fronteira normativa (§3/§4/§6/§7). Função pura, nunca lança —
 * qualquer exceção inesperada é capturada e reportada como
 * `page_boundary_continuity_unexpected_failure`, isolada a este par. É a
 * ÚNICA implementação da avaliação de par: reutilizada tanto pela formação
 * (orquestrador) quanto pela conservação (recomputação independente) — nunca
 * duas implementações paralelas.
 */
export function evaluateBoundaryPair(sourceCandidateGroupKey: string, originPage: NeutralDocumentPage, targetPage: NeutralDocumentPage): PageBoundaryNeutralContinuityEvaluation {
  const base = { sourceCandidateGroupKey, originPageNumber: originPage.pageNumber, targetPageNumber: targetPage.pageNumber };
  try {
    const signalA = evaluatePageProcessability(originPage, targetPage);
    if (signalA.outcome !== "both_pages_processable") {
      return notProcessable(base, [signalA]);
    }

    const originRegionSelection = selectClosingRegion(originPage);
    const targetRegionSelection = selectOpeningRegion(targetPage);
    if (originRegionSelection.outcome === "ambiguous" || targetRegionSelection.outcome === "ambiguous") {
      return failed(base, [signalA], null, null, [problem("boundary_region_selection_ambiguous", "boundary_selection", { ...base })]);
    }
    const signalB = evaluateBoundaryRegionExistence(originRegionSelection.outcome === "missing", targetRegionSelection.outcome === "missing");
    if (originRegionSelection.outcome === "missing" || targetRegionSelection.outcome === "missing") {
      return notProcessable(base, [signalA, signalB]);
    }
    const originRegion = originRegionSelection.region;
    const targetRegion = targetRegionSelection.region;

    const originLineSelection = selectClosingLine(originRegion);
    const targetLineSelection = selectOpeningLine(targetRegion);
    if (originLineSelection.outcome === "ambiguous" || targetLineSelection.outcome === "ambiguous") {
      return failed(base, [signalA, signalB], originRegion.sourceRegionKey, targetRegion.sourceRegionKey, [
        problem("boundary_line_selection_ambiguous", "boundary_selection", { ...base, originRegionKey: originRegion.sourceRegionKey, targetRegionKey: targetRegion.sourceRegionKey }),
      ]);
    }
    const signalC = evaluateBoundaryLineExistence(originLineSelection.outcome === "missing", targetLineSelection.outcome === "missing");
    if (originLineSelection.outcome === "missing" || targetLineSelection.outcome === "missing") {
      return notProcessable(base, [signalA, signalB, signalC], originRegion.sourceRegionKey, targetRegion.sourceRegionKey);
    }
    const originLine = originLineSelection.line;
    const targetLine = targetLineSelection.line;

    const signalD = evaluateColumnSignatureCompatibility(originLine, targetLine);
    const signalE = evaluateHorizontalGeometryCompatibility(originRegion.sourceRegionCandidate, targetRegion.sourceRegionCandidate);
    const merit = classifyMeritSignals(signalD.outcome, signalE.outcome);

    return {
      ...base,
      originRegionKey: originRegion.sourceRegionKey, targetRegionKey: targetRegion.sourceRegionKey,
      originBoundaryLineKey: originLine.sourceLineKey, targetBoundaryLineKey: targetLine.sourceLineKey,
      status: merit.status,
      observedSignals: [signalA, signalB, signalC, signalD, signalE],
      favorableEvidence: merit.favorableEvidence, contraryEvidence: merit.contraryEvidence,
      technicalProblems: [],
    };
  } catch {
    return failed(base, [], null, null, [problem("page_boundary_continuity_unexpected_failure", "signal_evaluation", { ...base })]);
  }
}

function notProcessable(
  base: { readonly sourceCandidateGroupKey: string; readonly originPageNumber: number; readonly targetPageNumber: number },
  observedSignals: ReadonlyArray<PageBoundaryNeutralContinuitySignal>,
  originRegionKey: string | null = null,
  targetRegionKey: string | null = null,
): PageBoundaryNeutralContinuityEvaluation {
  return { ...base, originRegionKey, targetRegionKey, originBoundaryLineKey: null, targetBoundaryLineKey: null, status: "continuity_not_processable", observedSignals, favorableEvidence: [], contraryEvidence: [], technicalProblems: [] };
}

function failed(
  base: { readonly sourceCandidateGroupKey: string; readonly originPageNumber: number; readonly targetPageNumber: number },
  observedSignals: ReadonlyArray<PageBoundaryNeutralContinuitySignal>,
  originRegionKey: string | null,
  targetRegionKey: string | null,
  technicalProblems: ReadonlyArray<import("./budget-document-page-boundary-neutral-continuity-evaluation.types").PageBoundaryNeutralContinuityTechnicalProblem>,
): PageBoundaryNeutralContinuityEvaluation {
  return { ...base, originRegionKey, targetRegionKey, originBoundaryLineKey: null, targetBoundaryLineKey: null, status: "continuity_evaluation_failed", observedSignals, favorableEvidence: [], contraryEvidence: [], technicalProblems };
}
