import type { DocumentSignalObservationResult, SignalEvaluation } from "../signal-observation/signal-observation.types";
import { createPageDecision, isSignalObserved } from "./page-location-classification";
import type { PageLocationWorkingPage } from "./page-location-classification";
import {
  PAGE_LOCATION_SOURCE_SIGNAL_IDS,
  getPageLocationDecisionRule,
} from "./page-location-decision-rule-registry";
import type { PageLocationDecisionRule } from "./page-location-decision-rule-registry";

function geometryEvaluation(page: PageLocationWorkingPage): SignalEvaluation | null {
  return page.evaluations.get(PAGE_LOCATION_SOURCE_SIGNAL_IDS.stableGeometry) ?? null;
}

function referencedNeighborPageNumbers(
  page: PageLocationWorkingPage,
  neighborRequirement: PageLocationDecisionRule["neighborRequirement"],
): ReadonlyArray<number> {
  const evaluation = geometryEvaluation(page);
  if (evaluation?.outcome !== "observed" || evaluation.evidence === null || neighborRequirement === "none") {
    return [];
  }
  return evaluation.evidence.references
    .filter((reference) =>
      neighborRequirement === "earlier_anchor_only"
        ? reference.roleInRule === "earlier_page"
        : reference.roleInRule === "earlier_page" || reference.roleInRule === "later_page",
    )
    .map((reference) => reference.pageNumber)
    .sort((left, right) => left - right);
}

function qualifyingAnchorPageNumbers(
  page: PageLocationWorkingPage,
  pagesByNumber: ReadonlyMap<number, PageLocationWorkingPage>,
  neighborRequirement: PageLocationDecisionRule["neighborRequirement"],
): ReadonlyArray<number> {
  return referencedNeighborPageNumbers(page, neighborRequirement).filter((pageNumber) => {
    const neighbor = pagesByNumber.get(pageNumber);
    return neighbor?.decision?.classification === "candidate" && neighbor.decision.canAnchor;
  });
}

/** Fixed-point propagation. Every iteration reads one immutable frontier. */
export function propagateStructuralCandidates(
  source: DocumentSignalObservationResult,
  initialPages: ReadonlyArray<PageLocationWorkingPage>,
): ReadonlyArray<PageLocationWorkingPage> {
  const rule = getPageLocationDecisionRule("candidate-service-item-by-continuity-v1");
  let pages = initialPages;

  while (true) {
    const pagesByNumber = new Map(pages.map((page) => [page.pageNumber, page]));
    const decisions = new Map<number, ReturnType<typeof createPageDecision>>();

    pages.forEach((page) => {
      if (
        page.decision !== null ||
        !isSignalObserved(page, PAGE_LOCATION_SOURCE_SIGNAL_IDS.serviceItem) ||
        !isSignalObserved(page, PAGE_LOCATION_SOURCE_SIGNAL_IDS.stableGeometry)
      ) {
        return;
      }
      const anchors = qualifyingAnchorPageNumbers(page, pagesByNumber, rule.neighborRequirement);
      if (anchors.length === 0) {
        return;
      }
      decisions.set(
        page.pageNumber,
        createPageDecision(
          source,
          page,
          rule,
          [rule],
          [PAGE_LOCATION_SOURCE_SIGNAL_IDS.serviceItem, PAGE_LOCATION_SOURCE_SIGNAL_IDS.stableGeometry],
          "continuity_support",
          anchors,
        ),
      );
    });

    if (decisions.size === 0) {
      return pages;
    }
    pages = pages.map((page) => {
      const decision = decisions.get(page.pageNumber);
      return decision === undefined ? page : { ...page, decision };
    });
  }
}

/** Closing candidates are resolved only after structural propagation converges. */
export function classifyClosingCandidates(
  source: DocumentSignalObservationResult,
  pages: ReadonlyArray<PageLocationWorkingPage>,
): ReadonlyArray<PageLocationWorkingPage> {
  const rule = getPageLocationDecisionRule("candidate-closing-page-by-continuity-v1");
  const pagesByNumber = new Map(pages.map((page) => [page.pageNumber, page]));
  const decisions = new Map<number, ReturnType<typeof createPageDecision>>();

  pages.forEach((page) => {
    if (
      page.decision !== null ||
      !isSignalObserved(page, PAGE_LOCATION_SOURCE_SIGNAL_IDS.total) ||
      !isSignalObserved(page, PAGE_LOCATION_SOURCE_SIGNAL_IDS.stableGeometry)
    ) {
      return;
    }
    const anchors = qualifyingAnchorPageNumbers(page, pagesByNumber, rule.neighborRequirement);
    if (anchors.length === 0) {
      return;
    }
    decisions.set(
      page.pageNumber,
      createPageDecision(
        source,
        page,
        rule,
        [rule],
        [PAGE_LOCATION_SOURCE_SIGNAL_IDS.total, PAGE_LOCATION_SOURCE_SIGNAL_IDS.stableGeometry],
        "closing_support",
        anchors,
      ),
    );
  });

  return pages.map((page) => {
    const decision = decisions.get(page.pageNumber);
    return decision === undefined ? page : { ...page, decision };
  });
}
