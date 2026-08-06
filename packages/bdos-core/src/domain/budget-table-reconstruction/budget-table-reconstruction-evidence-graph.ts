import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import {
  LocatorCatalog,
  structuralLocator,
} from "./budget-table-reconstruction-structural-locator";
import type {
  BudgetTableReconstructionInput,
  EvidenceLine,
  EvidenceSegment,
  EvidenceTextItem,
  SourceFragment,
} from "./budget-table-reconstruction.types";

export interface EvidenceGraph {
  readonly locatorCatalog: LocatorCatalog;
  readonly textItems: ReadonlyArray<EvidenceTextItem>;
  readonly fragments: ReadonlyArray<SourceFragment>;
  readonly lines: ReadonlyArray<EvidenceLine>;
  readonly segments: ReadonlyArray<EvidenceSegment>;
  readonly pageStatuses: ReadonlyMap<number, string>;
}

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function selectedPageNumbers(input: BudgetTableReconstructionInput): ReadonlySet<number> | null {
  return input.pageSelection === "all" ? null : new Set(input.pageSelection);
}

function upstreamCellHypothesesBySegment(
  input: BudgetTableReconstructionInput,
): ReadonlyMap<string, ReadonlyArray<string>> {
  const result = new Map<string, string[]>();
  if (input.physicalCellEvidence.availability === "unavailable") {
    return result;
  }

  for (const group of input.physicalCellEvidence.cellHypothesisFormation.groups) {
    for (const page of group.pages) {
      for (const region of page.regions) {
        for (const hypothesis of region.cellHypotheses) {
          const canonicalHypothesisId = `upstream-cell:${fingerprintCanonical({
            pageNumber: page.pageNumber,
            observedContentBounds: hypothesis.observedContentBounds,
            segmentCount: hypothesis.segmentKeys.length,
          })}`;
          for (const segmentKey of hypothesis.segmentKeys) {
            const existing = result.get(segmentKey) ?? [];
            existing.push(canonicalHypothesisId);
            result.set(segmentKey, existing);
          }
        }
      }
    }
  }

  for (const [segmentKey, hypothesisIds] of result) {
    result.set(segmentKey, [...new Set(hypothesisIds)].sort(ordinalCompare));
  }
  return result;
}

export function buildEvidenceGraph(input: BudgetTableReconstructionInput): EvidenceGraph {
  const selected = selectedPageNumbers(input);
  const locatorCatalog = new LocatorCatalog();
  const textItems: EvidenceTextItem[] = [];
  const fragments: SourceFragment[] = [];
  const lines: EvidenceLine[] = [];
  const segments: EvidenceSegment[] = [];
  const pageStatuses = new Map<number, string>();
  const upstreamCellIds = upstreamCellHypothesesBySegment(input);

  const structuralPages = input.structureReconstruction.groups
    .flatMap((group) => group.pages)
    .filter((page) => selected === null || selected.has(page.pageNumber))
    .sort((left, right) => left.pageNumber - right.pageNumber);

  for (const sourcePage of structuralPages) {
    pageStatuses.set(sourcePage.pageNumber, sourcePage.status);
    const physicalPage = input.physicalRead.pages.find(
      (candidate) => candidate.pageNumber === sourcePage.pageNumber,
    );
    const outcomes = new Map(
      sourcePage.sourceItemOutcomes.map((outcome) => [outcome.sourceTextItemIndex, outcome]),
    );
    const lineOrderByKey = new Map(
      sourcePage.lines.map((line) => [line.lineKey, line.verticalOrder]),
    );
    const lineIdByKey = new Map<string, string>();
    const textItemIdByIndex = new Map<number, string>();
    const fragmentIdByIndex = new Map<number, string>();

    for (const item of [...(physicalPage?.textItems ?? [])].sort(
      (left, right) => left.index - right.index,
    )) {
      const outcome = outcomes.get(item.index);
      const placedOutcome = outcome?.status === "placed" ? outcome : null;
      const line = placedOutcome
        ? sourcePage.lines.find((candidate) => candidate.lineKey === placedOutcome.lineKey)
        : undefined;
      const segment = placedOutcome
        ? sourcePage.segments.find(
            (candidate) => candidate.segmentKey === placedOutcome.segmentKey,
          )
        : undefined;
      const locator = structuralLocator(
        input,
        sourcePage.pageNumber,
        line?.verticalOrder ?? null,
        segment?.horizontalOrder ?? null,
        item.placement.geometry,
        [item.index],
      );
      const locatorId = locatorCatalog.register(locator);
      const evidenceId = `text-item:${fingerprintCanonical({
        locatorId,
        sourceTextItemIndex: item.index,
      })}`;
      const fragmentId = `fragment:${fingerprintCanonical({
        evidenceId,
        startOffset: 0,
        endOffset: item.text.length,
      })}`;

      textItemIdByIndex.set(item.index, evidenceId);
      fragmentIdByIndex.set(item.index, fragmentId);
      textItems.push({
        evidenceId,
        locatorId,
        pageNumber: sourcePage.pageNumber,
        sourceTextItemIndex: item.index,
        rawText: item.text,
        upstreamDisposition: outcome?.status ?? item.placement.status,
        runtimeReference: {
          lineKey: line?.lineKey ?? null,
          segmentKey: segment?.segmentKey ?? null,
        },
      });
      fragments.push({
        fragmentId,
        textItemEvidenceId: evidenceId,
        startOffset: 0,
        endOffset: item.text.length,
      });
    }

    for (const sourceLine of [...sourcePage.lines].sort(
      (left, right) => left.verticalOrder - right.verticalOrder,
    )) {
      const locatorId = locatorCatalog.register(
        structuralLocator(
          input,
          sourcePage.pageNumber,
          sourceLine.verticalOrder,
          null,
          sourceLine,
          sourceLine.sourceTextItemIndices,
        ),
      );
      const lineId = `line:${fingerprintCanonical({ locatorId })}`;
      lineIdByKey.set(sourceLine.lineKey, lineId);
      lines.push({
        lineId,
        locatorId,
        pageNumber: sourcePage.pageNumber,
        segmentIds: [],
        textItemEvidenceIds: sourceLine.sourceTextItemIndices
          .map((index) => textItemIdByIndex.get(index))
          .filter((value): value is string => value !== undefined),
        runtimeReference: { lineKey: sourceLine.lineKey, segmentKey: null },
      });
    }

    for (const sourceSegment of [...sourcePage.segments].sort((left, right) => {
      const lineDifference =
        (lineOrderByKey.get(left.lineKey) ?? 0) -
        (lineOrderByKey.get(right.lineKey) ?? 0);
      return lineDifference !== 0
        ? lineDifference
        : left.horizontalOrder - right.horizontalOrder;
    })) {
      const locatorId = locatorCatalog.register(
        structuralLocator(
          input,
          sourcePage.pageNumber,
          lineOrderByKey.get(sourceSegment.lineKey) ?? null,
          sourceSegment.horizontalOrder,
          sourceSegment,
          sourceSegment.sourceTextItemIndices,
        ),
      );
      const segmentId = `segment:${fingerprintCanonical({ locatorId })}`;
      const textItemEvidenceIds = sourceSegment.sourceTextItemIndices
        .map((index) => textItemIdByIndex.get(index))
        .filter((value): value is string => value !== undefined);
      const fragmentIds = sourceSegment.sourceTextItemIndices
        .map((index) => fragmentIdByIndex.get(index))
        .filter((value): value is string => value !== undefined);
      const rawText = sourceSegment.sourceTextItemIndices
        .map(
          (index) =>
            physicalPage?.textItems.find((candidate) => candidate.index === index)?.text ?? "",
        )
        .join("");

      segments.push({
        segmentId,
        locatorId,
        pageNumber: sourcePage.pageNumber,
        lineId: lineIdByKey.get(sourceSegment.lineKey)!,
        textItemEvidenceIds,
        fragmentIds,
        rawText,
        upstreamCellHypothesisIds: upstreamCellIds.get(sourceSegment.segmentKey) ?? [],
        runtimeReference: {
          lineKey: sourceSegment.lineKey,
          segmentKey: sourceSegment.segmentKey,
        },
      });
    }
  }

  const segmentIdsByLine = new Map<string, string[]>();
  for (const segment of segments) {
    const existing = segmentIdsByLine.get(segment.lineId) ?? [];
    existing.push(segment.segmentId);
    segmentIdsByLine.set(segment.lineId, existing);
  }

  return {
    locatorCatalog,
    textItems: textItems.sort((left, right) => ordinalCompare(left.evidenceId, right.evidenceId)),
    fragments: fragments.sort((left, right) => ordinalCompare(left.fragmentId, right.fragmentId)),
    lines: lines.map((line) => ({
      ...line,
      segmentIds: segmentIdsByLine.get(line.lineId) ?? [],
    })),
    segments,
    pageStatuses,
  };
}
