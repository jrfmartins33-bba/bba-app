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

interface UpstreamSegmentEvidence {
  readonly cellHypothesisIds: ReadonlyArray<string>;
  readonly physicalColumnHypothesisIds: ReadonlyArray<string>;
  readonly textEvidenceStatus: string | null;
  readonly itemDispositionStatuses: ReadonlyArray<string>;
  readonly fragments: ReadonlyArray<{
    readonly textItemIndex: number;
    readonly sourceReferenceOrder: number;
    readonly originalText: string;
  }>;
}

function upstreamEvidenceBySegment(
  input: BudgetTableReconstructionInput,
): ReadonlyMap<string, UpstreamSegmentEvidence> {
  const result = new Map<string, UpstreamSegmentEvidence>();
  if (input.physicalCellEvidence.availability === "unavailable") {
    return result;
  }

  const cellIdentityByKey = new Map<string, string>();
  const columnIdentityByCellKey = new Map<string, string>();
  const stableColumnIdentityByKey = new Map<string, string>();
  if (input.columnEvidence.availability === "available") {
    for (const group of input.columnEvidence.result.groups) {
      for (const page of group.pages) {
        for (const region of page.regions) {
          for (const hypothesis of region.hypotheses) {
            stableColumnIdentityByKey.set(
              hypothesis.hypothesisKey,
              `physical-column:${fingerprintCanonical({
                pageNumber: page.pageNumber,
                order: hypothesis.order,
                leftPoints: hypothesis.leftPoints,
                rightPoints: hypothesis.rightPoints,
                lineCount: hypothesis.lineKeys.length,
                segmentCount: hypothesis.segmentKeys.length,
              })}`,
            );
          }
        }
      }
    }
  }
  for (const group of input.physicalCellEvidence.cellHypothesisFormation.groups) {
    for (const page of group.pages) {
      for (const region of page.regions) {
        const columnByIntersection = new Map(
          region.gridIntersections.map((intersection) => [
            intersection.gridIntersectionKey,
            intersection.sourcePhysicalColumnHypothesisKey,
          ]),
        );
        for (const hypothesis of region.cellHypotheses) {
          const canonicalHypothesisId = `upstream-cell:${fingerprintCanonical({
            pageNumber: page.pageNumber,
            observedContentBounds: hypothesis.observedContentBounds,
            segmentCount: hypothesis.segmentKeys.length,
          })}`;
          cellIdentityByKey.set(hypothesis.cellHypothesisKey, canonicalHypothesisId);
          const physicalColumnHypothesisId = stableColumnIdentityByKey.get(
            columnByIntersection.get(hypothesis.gridIntersectionKey) ?? "",
          );
          if (physicalColumnHypothesisId !== undefined) {
            columnIdentityByCellKey.set(
              hypothesis.cellHypothesisKey,
              physicalColumnHypothesisId,
            );
          }
          for (const segmentKey of hypothesis.segmentKeys) {
            const existing = result.get(segmentKey);
            result.set(segmentKey, {
              cellHypothesisIds: uniqueSorted([
                ...(existing?.cellHypothesisIds ?? []),
                canonicalHypothesisId,
              ]),
              physicalColumnHypothesisIds: uniqueSorted([
                ...(existing?.physicalColumnHypothesisIds ?? []),
                ...(physicalColumnHypothesisId === undefined
                  ? []
                  : [physicalColumnHypothesisId]),
              ]),
              textEvidenceStatus: existing?.textEvidenceStatus ?? null,
              itemDispositionStatuses: existing?.itemDispositionStatuses ?? [],
              fragments: existing?.fragments ?? [],
            });
          }
        }
      }
    }
  }

  for (const group of input.physicalCellEvidence.cellTextEvidenceFormation.groups) {
    for (const page of group.pages) {
      for (const region of page.regions) {
        for (const cellEvidence of region.cellTextEvidences) {
          const canonicalCellId = cellIdentityByKey.get(cellEvidence.cellHypothesisKey);
          const physicalColumnId = columnIdentityByCellKey.get(
            cellEvidence.cellHypothesisKey,
          );
          for (const outcome of cellEvidence.segmentOutcomes) {
            const existing = result.get(outcome.segmentKey);
            const resolvedFragments =
              outcome.status === "resolved"
                ? [...outcome.fragments]
                    .sort(
                      (left, right) =>
                        left.sourceReferenceOrder - right.sourceReferenceOrder ||
                        left.textItemIndex - right.textItemIndex,
                    )
                    .map((fragment) => ({
                      textItemIndex: fragment.textItemIndex,
                      sourceReferenceOrder: fragment.sourceReferenceOrder,
                      originalText: fragment.originalText,
                    }))
                : [];
            const dispositionStatuses =
              outcome.status === "resolved"
                ? outcome.itemDispositions.map((disposition) => disposition.status)
                : [outcome.status];
            result.set(outcome.segmentKey, {
              cellHypothesisIds: uniqueSorted([
                ...(existing?.cellHypothesisIds ?? []),
                ...(canonicalCellId === undefined ? [] : [canonicalCellId]),
              ]),
              physicalColumnHypothesisIds: uniqueSorted([
                ...(existing?.physicalColumnHypothesisIds ?? []),
                ...(physicalColumnId === undefined ? [] : [physicalColumnId]),
              ]),
              textEvidenceStatus: cellEvidence.status,
              itemDispositionStatuses: uniqueSorted([
                ...(existing?.itemDispositionStatuses ?? []),
                ...dispositionStatuses,
              ]),
              fragments:
                resolvedFragments.length > 0
                  ? resolvedFragments
                  : (existing?.fragments ?? []),
            });
          }
        }
      }
    }
  }
  return result;
}

function uniqueSorted(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...new Set(values)].sort(ordinalCompare);
}

export function buildEvidenceGraph(input: BudgetTableReconstructionInput): EvidenceGraph {
  const selected = selectedPageNumbers(input);
  const locatorCatalog = new LocatorCatalog();
  const textItems: EvidenceTextItem[] = [];
  const fragments: SourceFragment[] = [];
  const lines: EvidenceLine[] = [];
  const segments: EvidenceSegment[] = [];
  const pageStatuses = new Map<number, string>();
  const upstreamEvidence = upstreamEvidenceBySegment(input);

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
        sourceReferenceOrder: null,
        provenance: "structure",
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
      const upstream = upstreamEvidence.get(sourceSegment.segmentKey);
      const orderedSourceIndices =
        upstream?.fragments.length
          ? upstream.fragments.map((fragment) => fragment.textItemIndex)
          : sourceSegment.sourceTextItemIndices;
      const textItemEvidenceIds = orderedSourceIndices
        .map((index) => textItemIdByIndex.get(index))
        .filter((value): value is string => value !== undefined);
      const fragmentIds = orderedSourceIndices
        .map((index) => fragmentIdByIndex.get(index))
        .filter((value): value is string => value !== undefined);
      if (upstream?.fragments.length) {
        for (const fragment of upstream.fragments) {
          const fragmentId = fragmentIdByIndex.get(fragment.textItemIndex);
          const evidenceId = textItemIdByIndex.get(fragment.textItemIndex);
          if (fragmentId === undefined || evidenceId === undefined) continue;
          const existingIndex = fragments.findIndex(
            (candidate) => candidate.fragmentId === fragmentId,
          );
          const g1Fragment: SourceFragment = {
            fragmentId,
            textItemEvidenceId: evidenceId,
            startOffset: 0,
            endOffset: fragment.originalText.length,
            sourceReferenceOrder: fragment.sourceReferenceOrder,
            provenance: "g1",
          };
          if (existingIndex >= 0) fragments[existingIndex] = g1Fragment;
          else fragments.push(g1Fragment);
        }
      }
      const rawText = orderedSourceIndices
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
        upstreamCellHypothesisIds: upstream?.cellHypothesisIds ?? [],
        upstreamPhysicalColumnHypothesisIds:
          upstream?.physicalColumnHypothesisIds ?? [],
        upstreamTextEvidenceStatus: upstream?.textEvidenceStatus ?? null,
        upstreamItemDispositionStatuses:
          upstream?.itemDispositionStatuses ?? [],
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
