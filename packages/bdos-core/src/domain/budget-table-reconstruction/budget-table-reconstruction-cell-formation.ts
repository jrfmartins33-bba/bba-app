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
  return locator?.bounds === null || locator?.bounds === undefined
    ? null
    : [locator.bounds[0], locator.bounds[2]];
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
    if (item === undefined) {
      continue;
    }
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

function tokenSupportsRole(token: string, role: BudgetColumnRole): boolean {
  const normalized = token.normalize("NFKC").trim();
  switch (role) {
    case "quantity":
    case "unit_cost":
    case "bdi_rate":
    case "unit_price":
    case "total_price":
      return /^(?:R\$)?[+-]?\d[\d.,]*(?:%)?$/.test(normalized);
    case "unit":
      return /^[\p{L}³²/.-]{1,12}$/u.test(normalized);
    case "item_code":
      return /^[\p{L}\d][\p{L}\d._/-]*$/u.test(normalized);
    case "description":
      return /\p{L}/u.test(normalized);
    case "unknown":
      return true;
  }
}

function enumerateUniqueAssignments(
  tokens: ReadonlyArray<TokenCandidate>,
  columns: ReadonlyArray<ResolvedColumn>,
): ReadonlyArray<ReadonlyArray<number>> {
  if (tokens.length !== columns.length || tokens.length > 8) {
    return [];
  }
  const assignments: number[][] = [];
  const used = new Set<number>();

  function visit(columnIndex: number, assignment: number[]): void {
    if (assignments.length > 1) {
      return;
    }
    if (columnIndex === columns.length) {
      assignments.push([...assignment]);
      return;
    }
    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
      if (
        used.has(tokenIndex) ||
        !tokenSupportsRole(tokens[tokenIndex]!.text, columns[columnIndex]!.role)
      ) {
        continue;
      }
      used.add(tokenIndex);
      assignment.push(tokenIndex);
      visit(columnIndex + 1, assignment);
      assignment.pop();
      used.delete(tokenIndex);
    }
  }

  visit(0, []);
  return assignments;
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
      const matchingColumns = pageColumns.filter((column) => intersects(graph, segment, column));
      if (matchingColumns.length === 0) {
        cells.push({
          cellId: `cell:${fingerprintCanonical({
            lineId: line.lineId,
            segmentId: segment.segmentId,
            columnId: null,
          })}`,
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

      for (const column of matchingColumns) {
        occupiedColumns.add(column.columnId);
      }

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
            segment.upstreamCellHypothesisIds.length > 0
              ? "preferred_upstream_physical_cell_evidence"
              : "unique_semantic_band_intersection",
        });
        continue;
      }

      const tokens = tokenCandidates(graph, segment);
      const assignments = enumerateUniqueAssignments(tokens, matchingColumns);
      const uniqueAssignment = assignments.length === 1 ? assignments[0]! : null;

      for (let columnIndex = 0; columnIndex < matchingColumns.length; columnIndex += 1) {
        const column = matchingColumns[columnIndex]!;
        let fragmentIds = segment.fragmentIds;
        let state: ReconstructedCell["state"] = "ambiguous";
        let reasonCode =
          assignments.length > 1
            ? "multiple_valid_token_role_decompositions"
            : "shared_evidence_not_uniquely_decomposable";

        if (uniqueAssignment !== null) {
          const token = tokens[uniqueAssignment[columnIndex]!]!;
          const fragment = createTokenFragment(token);
          derivedFragments.set(fragment.fragmentId, fragment);
          fragmentIds = [fragment.fragmentId];
          state = column.status === "resolved" ? "present" : "ambiguous";
          reasonCode = "unique_token_role_decomposition";
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
      if (occupiedColumns.has(column.columnId)) {
        continue;
      }
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
