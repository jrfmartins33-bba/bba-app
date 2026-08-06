import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import type { EvidenceGraph } from "./budget-table-reconstruction-evidence-graph";
import { BUDGET_TABLE_RECONSTRUCTION_PROFILE } from "./budget-table-reconstruction-profile";
import type {
  BudgetColumnRole,
  BudgetTableReconstructionInput,
  EvidenceSegment,
  ResolvedColumn,
} from "./budget-table-reconstruction.types";

interface ColumnBand {
  readonly pageNumber: number;
  readonly horizontalOrder: number;
  readonly leftPoints: number;
  readonly rightPoints: number;
  readonly evidenceLocatorIds: ReadonlyArray<string>;
}

interface HeaderCandidate {
  readonly lineId: string;
  readonly roles: ReadonlyArray<BudgetColumnRole>;
}

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeVocabularyText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function vocabularyRoles(text: string): ReadonlyArray<BudgetColumnRole> {
  const normalized = normalizeVocabularyText(text);
  const entries = Object.entries(BUDGET_TABLE_RECONSTRUCTION_PROFILE.headerVocabulary) as Array<
    [Exclude<BudgetColumnRole, "unknown">, ReadonlyArray<string>]
  >;
  return entries
    .filter(([, terms]) =>
      terms.some((term) => normalized === term || normalized.includes(term)),
    )
    .map(([role]) => role)
    .sort(ordinalCompare);
}

function hasEconomicLiteral(text: string): boolean {
  return /\d/.test(text) && /(?:[.,]\d|%|R\$)/i.test(text);
}

function headerCandidates(graph: EvidenceGraph, pageNumber: number): ReadonlyArray<HeaderCandidate> {
  const candidates: HeaderCandidate[] = [];
  for (const line of graph.lines.filter((candidate) => candidate.pageNumber === pageNumber)) {
    const segments = graph.segments.filter((segment) => segment.lineId === line.lineId);
    const roles = [...new Set(segments.flatMap((segment) => vocabularyRoles(segment.rawText)))].sort(
      ordinalCompare,
    );
    const containsEconomicLiteral = segments.some((segment) =>
      hasEconomicLiteral(segment.rawText),
    );
    if (roles.length >= 2 && !containsEconomicLiteral) {
      candidates.push({ lineId: line.lineId, roles });
    }
  }
  return candidates;
}

function boundsForSegment(
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

function bandsFromColumnEvidence(
  input: BudgetTableReconstructionInput,
  graph: EvidenceGraph,
  pageNumber: number,
): ReadonlyArray<ColumnBand> {
  if (input.columnEvidence.availability === "unavailable") {
    return [];
  }
  const sourcePage = input.columnEvidence.result.groups
    .flatMap((group) => group.pages)
    .find((page) => page.pageNumber === pageNumber);
  if (sourcePage === undefined) {
    return [];
  }
  const hypotheses = sourcePage.regions.flatMap((region) => region.hypotheses);
  const distinct = hypotheses
    .filter(
      (hypothesis, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.leftPoints === hypothesis.leftPoints &&
            candidate.rightPoints === hypothesis.rightPoints,
        ) === index,
    )
    .sort(
      (left, right) =>
        left.leftPoints - right.leftPoints || left.rightPoints - right.rightPoints,
    );
  return distinct.map((hypothesis, index) => ({
    pageNumber,
    horizontalOrder: index + 1,
    leftPoints: hypothesis.leftPoints,
    rightPoints: hypothesis.rightPoints,
    evidenceLocatorIds: graph.segments
      .filter(
        (segment) =>
          segment.runtimeReference.segmentKey !== null &&
          hypothesis.segmentKeys.includes(segment.runtimeReference.segmentKey),
      )
      .map((segment) => segment.locatorId)
      .sort(ordinalCompare),
  }));
}

function bandsFromHeaderGeometry(
  graph: EvidenceGraph,
  pageNumber: number,
  headers: ReadonlyArray<HeaderCandidate>,
): ReadonlyArray<ColumnBand> {
  if (headers.length !== 1) {
    return [];
  }
  const segments = graph.segments
    .filter((segment) => segment.lineId === headers[0]!.lineId)
    .map((segment) => ({ segment, bounds: boundsForSegment(graph, segment) }))
    .filter(
      (entry): entry is { segment: EvidenceSegment; bounds: readonly [number, number] } =>
        entry.bounds !== null,
    )
    .sort((left, right) => left.bounds[0] - right.bounds[0]);

  return segments.map((entry, index) => ({
    pageNumber,
    horizontalOrder: index + 1,
    leftPoints: entry.bounds[0],
    rightPoints: entry.bounds[1],
    evidenceLocatorIds: [entry.segment.locatorId],
  }));
}

function segmentIntersectsBand(
  graph: EvidenceGraph,
  segment: EvidenceSegment,
  band: ColumnBand,
): boolean {
  const bounds = boundsForSegment(graph, segment);
  return bounds !== null && bounds[0] < band.rightPoints && bounds[1] > band.leftPoints;
}

function rolesForBand(
  graph: EvidenceGraph,
  band: ColumnBand,
  headers: ReadonlyArray<HeaderCandidate>,
): ReadonlyArray<BudgetColumnRole> {
  const headerIds = new Set(headers.map((header) => header.lineId));
  return [
    ...new Set(
      graph.segments
        .filter(
          (segment) =>
            segment.pageNumber === band.pageNumber &&
            headerIds.has(segment.lineId) &&
            segmentIntersectsBand(graph, segment, band),
        )
        .flatMap((segment) => vocabularyRoles(segment.rawText)),
    ),
  ].sort(ordinalCompare);
}

function resolvePageColumns(
  input: BudgetTableReconstructionInput,
  graph: EvidenceGraph,
  pageNumber: number,
): ReadonlyArray<ResolvedColumn> {
  const headers = headerCandidates(graph, pageNumber);
  const upstreamBands = bandsFromColumnEvidence(input, graph, pageNumber);
  const bands =
    upstreamBands.length > 0
      ? upstreamBands
      : bandsFromHeaderGeometry(graph, pageNumber, headers);

  const preliminary = bands.map((band): ResolvedColumn => {
    const candidateRoles = rolesForBand(graph, band, headers);
    const role = candidateRoles.length === 1 ? candidateRoles[0]! : "unknown";
    return {
      columnId: `column:${fingerprintCanonical({
        pageNumber,
        horizontalOrder: band.horizontalOrder,
        leftPoints: band.leftPoints,
        rightPoints: band.rightPoints,
      })}`,
      pageNumber,
      horizontalOrder: band.horizontalOrder,
      leftPoints: band.leftPoints,
      rightPoints: band.rightPoints,
      candidateRoles: candidateRoles.length === 0 ? ["unknown"] : candidateRoles,
      role,
      status:
        candidateRoles.length === 1
          ? "resolved"
          : candidateRoles.length > 1
            ? "ambiguous"
            : "insufficient_evidence",
      headerLineIds: headers.map((header) => header.lineId).sort(ordinalCompare),
      evidenceLocatorIds: band.evidenceLocatorIds,
    };
  });

  const duplicateRoles = new Set(
    preliminary
      .filter(
        (column, index, all) =>
          column.role !== "unknown" &&
          all.findIndex((candidate) => candidate.role === column.role) !== index,
      )
      .map((column) => column.role),
  );

  return preliminary.map((column) =>
    duplicateRoles.has(column.role)
      ? { ...column, role: "unknown", status: "ambiguous" }
      : column,
  );
}

function schemasAreExactlyCompatible(
  previous: ReadonlyArray<ResolvedColumn>,
  current: ReadonlyArray<ResolvedColumn>,
): boolean {
  return (
    previous.length === current.length &&
    previous.every(
      (column, index) =>
        column.leftPoints === current[index]!.leftPoints &&
        column.rightPoints === current[index]!.rightPoints,
    )
  );
}

export function resolveColumns(
  input: BudgetTableReconstructionInput,
  graph: EvidenceGraph,
): ReadonlyArray<ResolvedColumn> {
  const pageNumbers = [...new Set(graph.lines.map((line) => line.pageNumber))].sort(
    (left, right) => left - right,
  );
  const resolvedByPage = new Map<number, ReadonlyArray<ResolvedColumn>>();

  for (const pageNumber of pageNumbers) {
    const current = resolvePageColumns(input, graph, pageNumber);
    const previous = resolvedByPage.get(pageNumbers[pageNumbers.indexOf(pageNumber) - 1]!);
    if (
      previous !== undefined &&
      current.length > 0 &&
      current.every((column) => column.status === "insufficient_evidence") &&
      schemasAreExactlyCompatible(previous, current) &&
      previous.every((column) => column.status === "resolved")
    ) {
      resolvedByPage.set(
        pageNumber,
        current.map((column, index) => ({
          ...column,
          role: previous[index]!.role,
          candidateRoles: previous[index]!.candidateRoles,
          status: "resolved",
        })),
      );
    } else {
      resolvedByPage.set(pageNumber, current);
    }
  }

  return pageNumbers.flatMap((pageNumber) => resolvedByPage.get(pageNumber) ?? []);
}
