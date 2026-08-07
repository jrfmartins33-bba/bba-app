import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import type { EvidenceGraph } from "./budget-table-reconstruction-evidence-graph";
import type {
  BudgetColumnRole,
  EvidenceSegment,
  ReconstructedCell,
  ResolvedColumn,
  SourceFragment,
} from "./budget-table-reconstruction.types";

export interface CellFormationResult {
  readonly cells: ReadonlyArray<ReconstructedCell>;
  readonly fragments: ReadonlyArray<SourceFragment>;
}

interface TokenCandidate {
  readonly textItemEvidenceId: string;
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
}

interface TokenPartition {
  readonly startIndex: number;
  readonly endIndex: number;
}

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function segmentBounds(
  graph: EvidenceGraph,
  segment: EvidenceSegment,
): readonly [number, number] | null {
  const locator = graph.locatorCatalog
    .entries()
    .find((entry) => entry.locatorId === segment.locatorId)?.locator;
  return locator?.bounds == null ? null : [locator.bounds[0], locator.bounds[2]];
}

function intersects(
  graph: EvidenceGraph,
  segment: EvidenceSegment,
  column: ResolvedColumn,
): boolean {
  const bounds = segmentBounds(graph, segment);
  return bounds !== null && bounds[0] < column.rightPoints && bounds[1] > column.leftPoints;
}

function tokenCandidates(
  graph: EvidenceGraph,
  segment: EvidenceSegment,
): ReadonlyArray<TokenCandidate> {
  const tokens: TokenCandidate[] = [];
  for (const evidenceId of segment.textItemEvidenceIds) {
    const item = graph.textItems.find((candidate) => candidate.evidenceId === evidenceId);
    if (item === undefined) continue;
    for (const match of item.rawText.matchAll(/\S+/g)) {
      const startOffset = match.index;
      tokens.push({
        textItemEvidenceId: evidenceId,
        text: match[0],
        startOffset,
        endOffset: startOffset + match[0].length,
      });
    }
  }
  return tokens;
}

function tokenGroupSupportsRole(
  tokens: ReadonlyArray<TokenCandidate>,
  role: BudgetColumnRole,
): boolean {
  const normalized = tokens
    .map((token) => token.text)
    .join(" ")
    .normalize("NFKC")
    .trim()
    .replace(/^R\$\s+(?=[+-]?\d)/, "R$")
    .replace(/(?<=\d)\s+%$/, "%");
  switch (role) {
    case "quantity":
    case "unit_cost":
    case "bdi_rate":
    case "unit_price":
    case "total_price":
      return /^(?:R\$)?[+-]?\d[\d.,]*(?:%)?$/.test(normalized);
    case "unit":
      return /^(?:[\p{L}³²]+(?:[\s/.-][\p{L}\d³²]+)*)$/u.test(normalized);
    case "item_code":
      return /^[\p{L}\d][\p{L}\d._/-]*$/u.test(normalized);
    case "description":
      return (
        /\p{L}/u.test(normalized) &&
        tokens.every((token) => !/^(?:R\$|[+-]?\d[\d.,]*%?|%)$/.test(token.text))
      );
    case "unknown":
      return true;
  }
}

function enumerateUniquePartitions(
  tokens: ReadonlyArray<TokenCandidate>,
  columns: ReadonlyArray<ResolvedColumn>,
): ReadonlyArray<ReadonlyArray<TokenPartition>> {
  if (tokens.length < columns.length || columns.length === 0) return [];
  const solutions: TokenPartition[][] = [];

  function visit(columnIndex: number, tokenIndex: number, parts: TokenPartition[]): void {
    if (solutions.length >= 2) return;
    if (columnIndex === columns.length) {
      if (tokenIndex === tokens.length) solutions.push([...parts]);
      return;
    }
    const remainingColumns = columns.length - columnIndex - 1;
    const latestEnd = tokens.length - remainingColumns;
    for (let endIndex = tokenIndex + 1; endIndex <= latestEnd; endIndex += 1) {
      if (!tokenGroupSupportsRole(tokens.slice(tokenIndex, endIndex), columns[columnIndex]!.role)) {
        continue;
      }
      parts.push({ startIndex: tokenIndex, endIndex });
      visit(columnIndex + 1, endIndex, parts);
      parts.pop();
      if (solutions.length >= 2) return;
    }
  }

  visit(0, 0, []);
  return solutions;
}

function createTokenFragment(token: TokenCandidate): SourceFragment {
  const fragmentId = `fragment:${fingerprintCanonical({
    textItemEvidenceId: token.textItemEvidenceId,
    startOffset: token.startOffset,
    endOffset: token.endOffset,
  })}`;
  return {
    fragmentId,
    textItemEvidenceId: token.textItemEvidenceId,
    startOffset: token.startOffset,
    endOffset: token.endOffset,
    sourceReferenceOrder: null,
    provenance: "semantic_partition",
  };
}

function cellIdentity(
  segment: EvidenceSegment | null,
  column: ResolvedColumn,
  lineId: string,
): string {
  return `cell:${fingerprintCanonical({
    lineId,
    segmentId: segment?.segmentId ?? null,
    columnId: column.columnId,
  })}`;
}

function preferredColumnsForSegment(
  graph: EvidenceGraph,
  segment: EvidenceSegment,
  pageColumns: ReadonlyArray<ResolvedColumn>,
): ReadonlyArray<ResolvedColumn> {
  const upstreamColumns = pageColumns.filter((column) =>
    column.sourcePhysicalColumnHypothesisIds.some((hypothesisId) =>
      segment.upstreamPhysicalColumnHypothesisIds.includes(hypothesisId),
    ),
  );
  return segment.upstreamTextEvidenceStatus !== null && upstreamColumns.length > 0
    ? upstreamColumns
    : pageColumns.filter((column) => intersects(graph, segment, column));
}

export function formCells(
  graph: EvidenceGraph,
  columns: ReadonlyArray<ResolvedColumn>,
): CellFormationResult {
  const cells: ReconstructedCell[] = [];
  const derivedFragments = new Map<string, SourceFragment>();

  for (const line of graph.lines) {
    const pageColumns = columns
      .filter((column) => column.pageNumber === line.pageNumber)
      .sort((left, right) => left.horizontalOrder - right.horizontalOrder);
    const lineSegments = graph.segments.filter((segment) => segment.lineId === line.lineId);
    const occupiedColumns = new Set<string>();

    for (const segment of lineSegments) {
      const matchingColumns = preferredColumnsForSegment(graph, segment, pageColumns);
      if (matchingColumns.length === 0) {
        cells.push({
          cellId: `cell:${fingerprintCanonical({ lineId: line.lineId, segmentId: segment.segmentId, columnId: null })}`,
          pageNumber: line.pageNumber,
          rowLocatorId: line.locatorId,
          lineId: line.lineId,
          columnId: null,
          role: "unknown",
          geometryUse: "exclusive",
          state: "ambiguous",
          sourceSegmentIds: [segment.segmentId],
          fragmentIds: segment.fragmentIds,
          upstreamCellHypothesisIds: segment.upstreamCellHypothesisIds,
          reasonCode: "segment_outside_resolved_semantic_bands",
        });
        continue;
      }

      for (const column of matchingColumns) occupiedColumns.add(column.columnId);

      if (matchingColumns.length === 1) {
        const column = matchingColumns[0]!;
        cells.push({
          cellId: cellIdentity(segment, column, line.lineId),
          pageNumber: line.pageNumber,
          rowLocatorId: line.locatorId,
          lineId: line.lineId,
          columnId: column.columnId,
          role: column.role,
          geometryUse: "exclusive",
          state: column.status === "resolved" ? "present" : "ambiguous",
          sourceSegmentIds: [segment.segmentId],
          fragmentIds: segment.fragmentIds,
          upstreamCellHypothesisIds: segment.upstreamCellHypothesisIds,
          reasonCode:
            segment.upstreamTextEvidenceStatus !== null
              ? "preferred_g1_physical_cell_text_association"
              : segment.upstreamCellHypothesisIds.length > 0
                ? "preferred_upstream_physical_cell_evidence"
                : "unique_semantic_band_intersection",
        });
        continue;
      }

      const tokens = tokenCandidates(graph, segment);
      const partitions = enumerateUniquePartitions(tokens, matchingColumns);
      const uniquePartition = partitions.length === 1 ? partitions[0]! : null;

      for (let columnIndex = 0; columnIndex < matchingColumns.length; columnIndex += 1) {
        const column = matchingColumns[columnIndex]!;
        let fragmentIds = segment.fragmentIds;
        let state: ReconstructedCell["state"] = "ambiguous";
        let reasonCode =
          partitions.length > 1
            ? "multiple_valid_token_role_decompositions"
            : "shared_evidence_not_uniquely_decomposable";

        if (uniquePartition !== null) {
          const part = uniquePartition[columnIndex]!;
          const created = tokens.slice(part.startIndex, part.endIndex).map(createTokenFragment);
          for (const fragment of created) derivedFragments.set(fragment.fragmentId, fragment);
          fragmentIds = created.map((fragment) => fragment.fragmentId);
          state = column.status === "resolved" ? "present" : "ambiguous";
          reasonCode = "unique_contiguous_token_role_partition";
        }

        cells.push({
          cellId: cellIdentity(segment, column, line.lineId),
          pageNumber: line.pageNumber,
          rowLocatorId: line.locatorId,
          lineId: line.lineId,
          columnId: column.columnId,
          role: column.role,
          geometryUse: "shared",
          state,
          sourceSegmentIds: [segment.segmentId],
          fragmentIds,
          upstreamCellHypothesisIds: segment.upstreamCellHypothesisIds,
          reasonCode,
        });
      }
    }

    for (const column of pageColumns) {
      if (occupiedColumns.has(column.columnId)) continue;
      cells.push({
        cellId: cellIdentity(null, column, line.lineId),
        pageNumber: line.pageNumber,
        rowLocatorId: line.locatorId,
        lineId: line.lineId,
        columnId: column.columnId,
        role: column.role,
        geometryUse: "absent",
        state: "missing",
        sourceSegmentIds: [],
        fragmentIds: [],
        upstreamCellHypothesisIds: [],
        reasonCode: "no_source_segment_intersects_resolved_column",
      });
    }
  }

  return {
    cells: cells.sort((left, right) => ordinalCompare(left.cellId, right.cellId)),
    fragments: [...graph.fragments, ...derivedFragments.values()].sort((left, right) =>
      ordinalCompare(left.fragmentId, right.fragmentId),
    ),
  };
}
