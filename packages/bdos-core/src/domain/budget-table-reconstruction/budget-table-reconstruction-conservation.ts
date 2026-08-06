import type {
  ArithmeticEvaluation,
  EvidenceDisposition,
  EvidenceLine,
  EvidenceSegment,
  EvidenceTextItem,
  ParsedNumericEvidence,
  ReconstructedBudgetRecord,
  ReconstructedCell,
  ReconstructedLogicalRow,
  ReconstructionIssue,
  SourceFragment,
} from "./budget-table-reconstruction.types";

export interface ConservationInput {
  readonly textItems: ReadonlyArray<EvidenceTextItem>;
  readonly fragments: ReadonlyArray<SourceFragment>;
  readonly segments: ReadonlyArray<EvidenceSegment>;
  readonly lines: ReadonlyArray<EvidenceLine>;
  readonly cells: ReadonlyArray<ReconstructedCell>;
  readonly logicalRows: ReadonlyArray<ReconstructedLogicalRow>;
  readonly records: ReadonlyArray<ReconstructedBudgetRecord>;
  readonly arithmeticEvaluations: ReadonlyArray<ArithmeticEvaluation>;
}

export interface ConservationResult {
  readonly dispositions: ReadonlyArray<EvidenceDisposition>;
  readonly issues: ReadonlyArray<ReconstructionIssue>;
}

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function numericValues(
  record: ReconstructedBudgetRecord,
): ReadonlyArray<readonly [string, ParsedNumericEvidence | null]> {
  return [
    ["quantity", record.quantity],
    ["unit_cost", record.unitCost],
    ["bdi_rate", record.bdiRate],
    ["unit_price", record.unitPrice],
    ["total_price", record.totalPrice],
  ];
}

function intervalOverlaps(
  left: SourceFragment,
  right: SourceFragment,
): boolean {
  return left.startOffset < right.endOffset && right.startOffset < left.endOffset;
}

function isFullTextFragment(
  fragment: SourceFragment,
  textItems: ReadonlyArray<EvidenceTextItem>,
): boolean {
  const item = textItems.find(
    (candidate) => candidate.evidenceId === fragment.textItemEvidenceId,
  );
  return item !== undefined && fragment.startOffset === 0 && fragment.endOffset === item.rawText.length;
}

function fragmentOverlapIssues(input: ConservationInput): ReadonlyArray<ReconstructionIssue> {
  const issues: ReconstructionIssue[] = [];
  for (const item of input.textItems) {
    const fragments = input.fragments.filter(
      (fragment) => fragment.textItemEvidenceId === item.evidenceId,
    );
    for (let leftIndex = 0; leftIndex < fragments.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < fragments.length; rightIndex += 1) {
        const left = fragments[leftIndex]!;
        const right = fragments[rightIndex]!;
        if (
          intervalOverlaps(left, right) &&
          !isFullTextFragment(left, input.textItems) &&
          !isFullTextFragment(right, input.textItems)
        ) {
          issues.push({
            code: "undeclared_fragment_interval_overlap",
            severity: "failure",
            pageNumber: item.pageNumber,
            evidenceIds: [left.fragmentId, right.fragmentId].sort(ordinalCompare),
          });
        }
      }
    }
  }
  return issues;
}

function inventedValueIssues(input: ConservationInput): ReadonlyArray<ReconstructionIssue> {
  const issues: ReconstructionIssue[] = [];
  for (const record of input.records) {
    for (const [field, value] of numericValues(record)) {
      if (
        value !== null &&
        (value.sourceCellIds.length === 0 || value.sourceFragmentIds.length === 0)
      ) {
        issues.push({
          code: "invented_evidence",
          severity: "failure",
          pageNumber: record.pageNumber,
          evidenceIds: [`value:${record.recordId}:${field}`],
        });
      }
    }
  }
  return issues;
}

function textItemDispositions(input: ConservationInput): EvidenceDisposition[] {
  return input.textItems.map((item) => {
    const consumers = input.fragments
      .filter((fragment) => fragment.textItemEvidenceId === item.evidenceId)
      .map((fragment) => fragment.fragmentId)
      .sort(ordinalCompare);
    const missingGeometry = /missing|invalid|unsupported|failed/.test(
      item.upstreamDisposition,
    );
    return {
      evidenceId: item.evidenceId,
      evidenceKind: "text_item" as const,
      locatorId: item.locatorId,
      disposition: missingGeometry
        ? ("unresolved_missing_geometry" as const)
        : consumers.length > 1
          ? ("used_shared" as const)
          : ("used_exclusively" as const),
      reasonCode: missingGeometry
        ? item.upstreamDisposition
        : "preserved_in_fragment_catalog",
      consumerIds: consumers,
    };
  });
}

function fragmentDispositions(input: ConservationInput): EvidenceDisposition[] {
  return input.fragments.map((fragment) => {
    const segmentConsumers = input.segments
      .filter((segment) => segment.fragmentIds.includes(fragment.fragmentId))
      .map((segment) => segment.segmentId);
    const cellConsumers = input.cells
      .filter((cell) => cell.fragmentIds.includes(fragment.fragmentId))
      .map((cell) => cell.cellId);
    const consumers = [...new Set([...segmentConsumers, ...cellConsumers])].sort(
      ordinalCompare,
    );
    return {
      evidenceId: fragment.fragmentId,
      evidenceKind: "fragment" as const,
      locatorId: null,
      disposition:
        consumers.length > 1
          ? ("used_shared" as const)
          : consumers.length === 1
            ? ("used_exclusively" as const)
            : ("not_applicable" as const),
      reasonCode:
        consumers.length > 1
          ? "fragment_referenced_with_explicit_sharing"
          : consumers.length === 1
            ? "fragment_has_single_consumer"
            : "fragment_preserved_but_not_semantically_consumed",
      consumerIds: consumers,
    };
  });
}

function segmentDispositions(input: ConservationInput): EvidenceDisposition[] {
  return input.segments.map((segment) => {
    const consumers = input.cells
      .filter((cell) =>
        cell.fragmentIds.some((fragmentId) => segment.fragmentIds.includes(fragmentId)),
      )
      .map((cell) => cell.cellId);
    const uniqueConsumers = [...new Set(consumers)].sort(ordinalCompare);
    return {
      evidenceId: segment.segmentId,
      evidenceKind: "segment" as const,
      locatorId: segment.locatorId,
      disposition:
        uniqueConsumers.length > 1
          ? ("used_shared" as const)
          : uniqueConsumers.length === 1
            ? ("used_exclusively" as const)
            : ("unresolved_ambiguous" as const),
      reasonCode:
        uniqueConsumers.length > 0
          ? "segment_supports_candidate_cells"
          : "segment_not_associated_with_semantic_band",
      consumerIds: uniqueConsumers,
    };
  });
}

function lineDispositions(input: ConservationInput): EvidenceDisposition[] {
  return input.lines.map((line) => {
    const consumers = input.logicalRows
      .filter((row) => row.locatorId === line.locatorId)
      .map((row) => row.rowId);
    return {
      evidenceId: line.lineId,
      evidenceKind: "line" as const,
      locatorId: line.locatorId,
      disposition:
        consumers.length === 1 ? ("used_exclusively" as const) : ("failed" as const),
      reasonCode:
        consumers.length === 1 ? "logical_row_formed" : "logical_row_conservation_failure",
      consumerIds: consumers,
    };
  });
}

function cellDispositions(input: ConservationInput): EvidenceDisposition[] {
  return input.cells.map((cell) => {
    const rowConsumers = input.logicalRows
      .filter((row) => row.cellIds.includes(cell.cellId))
      .map((row) => row.rowId);
    const valueConsumers = input.records.flatMap((record) =>
      numericValues(record)
        .filter(([, value]) => value?.sourceCellIds.includes(cell.cellId))
        .map(([field]) => `value:${record.recordId}:${field}`),
    );
    const consumers = [...new Set([...rowConsumers, ...valueConsumers])].sort(
      ordinalCompare,
    );
    return {
      evidenceId: cell.cellId,
      evidenceKind: "cell" as const,
      locatorId: cell.rowLocatorId,
      disposition:
        cell.state === "missing"
          ? ("not_applicable" as const)
          : cell.state === "ambiguous" || cell.state === "divergent"
            ? ("unresolved_ambiguous" as const)
            : cell.geometryUse === "shared"
              ? ("used_shared" as const)
              : ("used_exclusively" as const),
      reasonCode:
        cell.state === "missing"
          ? "candidate_cell_absent_from_source"
          : cell.reasonCode,
      consumerIds: consumers,
    };
  });
}

function valueDispositions(input: ConservationInput): EvidenceDisposition[] {
  return input.records.flatMap((record) =>
    numericValues(record)
      .filter(([, value]) => value !== null)
      .map(([field, value]) => {
        const evidenceId = `value:${record.recordId}:${field}`;
        const consumers = input.arithmeticEvaluations
          .filter((evaluation) => evaluation.operandCellIds.some((cellId) => value!.sourceCellIds.includes(cellId)))
          .map((evaluation) => evaluation.evaluationId)
          .sort(ordinalCompare);
        const invented =
          value!.sourceCellIds.length === 0 || value!.sourceFragmentIds.length === 0;
        return {
          evidenceId,
          evidenceKind: "value" as const,
          locatorId: null,
          disposition: invented
            ? ("failed" as const)
            : consumers.length > 1
              ? ("used_shared" as const)
              : consumers.length === 1
                ? ("used_exclusively" as const)
                : ("not_applicable" as const),
          reasonCode: invented
            ? "numeric_value_without_source"
            : "numeric_value_preserves_cells_and_fragments",
          consumerIds: consumers,
        };
      }),
  );
}

export function conserveEvidence(input: ConservationInput): ConservationResult {
  const issues = [
    ...fragmentOverlapIssues(input),
    ...inventedValueIssues(input),
  ];
  for (const line of input.lines) {
    if (!input.logicalRows.some((row) => row.locatorId === line.locatorId)) {
      issues.push({
        code: "evidence_conservation_failure",
        severity: "failure",
        pageNumber: line.pageNumber,
        evidenceIds: [line.lineId],
      });
    }
  }

  const dispositions = [
    ...textItemDispositions(input),
    ...fragmentDispositions(input),
    ...segmentDispositions(input),
    ...lineDispositions(input),
    ...cellDispositions(input),
    ...valueDispositions(input),
  ].sort((left, right) => ordinalCompare(left.evidenceId, right.evidenceId));

  return { dispositions, issues };
}
