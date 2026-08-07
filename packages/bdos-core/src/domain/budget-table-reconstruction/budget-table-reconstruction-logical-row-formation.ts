import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import { headerVocabularyRoles } from "./budget-table-reconstruction-profile";
import { cellText } from "./budget-table-reconstruction-text";
import type {
  EvidenceLine,
  EvidenceTextItem,
  ReconstructedCell,
  ReconstructedLogicalRow,
  ReconstructedRowKind,
  SourceFragment,
} from "./budget-table-reconstruction.types";

const ECONOMIC_ROLES = new Set([
  "quantity",
  "unit_cost",
  "bdi_rate",
  "unit_price",
  "total_price",
]);

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function lineKind(
  cells: ReadonlyArray<ReconstructedCell>,
  fragments: ReadonlyArray<SourceFragment>,
  textItems: ReadonlyArray<EvidenceTextItem>,
): ReconstructedRowKind {
  const presentCells = cells.filter((cell) => cell.state !== "missing");
  const texts = presentCells
    .map((cell) => normalize(cellText(cell, fragments, textItems) ?? ""))
    .filter((text) => text.length > 0);
  const headerRoles = new Set(texts.flatMap((text) => headerVocabularyRoles(text)));
  if (headerRoles.size >= 2) {
    return "header";
  }
  if (texts.some((text) => /\bsubtotal\b/.test(text))) {
    return "subtotal";
  }
  if (texts.some((text) => /\btotal\b/.test(text))) {
    return "total";
  }

  const hasDescription = presentCells.some((cell) => cell.role === "description");
  const hasCode = presentCells.some((cell) => cell.role === "item_code");
  const hasEconomicValue = presentCells.some(
    (cell) =>
      ECONOMIC_ROLES.has(cell.role) &&
      /\d/.test(cellText(cell, fragments, textItems) ?? ""),
  );
  if (hasDescription && hasEconomicValue) {
    return "service_item";
  }
  if (hasDescription && hasCode && !hasEconomicValue) {
    return "group";
  }
  if (
    presentCells.length === 1 &&
    presentCells[0]!.role === "description" &&
    !hasEconomicValue
  ) {
    return "description_continuation";
  }
  return "unclassified";
}

function descriptionFor(
  cells: ReadonlyArray<ReconstructedCell>,
  fragments: ReadonlyArray<SourceFragment>,
  textItems: ReadonlyArray<EvidenceTextItem>,
): string | null {
  const description = cells
    .filter((cell) => cell.role === "description" && cell.state !== "missing")
    .map((cell) => cellText(cell, fragments, textItems))
    .filter((value): value is string => value !== null)
    .join(" ")
    .trim();
  return description.length === 0 ? null : description;
}

function eligibleContinuationReceivers(
  rows: ReadonlyArray<ReconstructedLogicalRow>,
  continuationIndex: number,
  cells: ReadonlyArray<ReconstructedCell>,
): ReadonlyArray<ReconstructedLogicalRow> {
  const continuation = rows[continuationIndex]!;
  const immediate = rows[continuationIndex - 1];
  if (
    immediate === undefined ||
    immediate.pageNumber !== continuation.pageNumber ||
    (immediate.kind !== "service_item" && immediate.kind !== "group")
  ) return [];

  const rowCells = (row: ReconstructedLogicalRow) => {
    const ids = new Set(row.cellIds);
    return cells.filter((cell) => ids.has(cell.cellId) && cell.role === "description");
  };
  const continuationCells = rowCells(continuation);
  const physicallyEquivalent = rows
    .slice(0, continuationIndex - 1)
    .reverse()
    .find((candidate) => {
      if (
        candidate.pageNumber !== continuation.pageNumber ||
        (candidate.kind !== "service_item" && candidate.kind !== "group")
      ) return false;
      return rowCells(candidate).some((candidateCell) =>
        continuationCells.some(
          (continuationCell) =>
            candidateCell.sourceSegmentIds.some((id) =>
              continuationCell.sourceSegmentIds.includes(id),
            ) ||
            candidateCell.upstreamCellHypothesisIds.some((id) =>
              continuationCell.upstreamCellHypothesisIds.includes(id),
            ),
        ),
      );
    });
  return physicallyEquivalent === undefined ? [immediate] : [immediate, physicallyEquivalent];
}

export function formLogicalRows(
  lines: ReadonlyArray<EvidenceLine>,
  cells: ReadonlyArray<ReconstructedCell>,
  fragments: ReadonlyArray<SourceFragment>,
  textItems: ReadonlyArray<EvidenceTextItem>,
): ReadonlyArray<ReconstructedLogicalRow> {
  const rows = [...lines].map((line): ReconstructedLogicalRow => {
      const lineCells = cells.filter((cell) => cell.lineId === line.lineId);
      const kind = lineKind(lineCells, fragments, textItems);
      return {
        rowId: `row:${fingerprintCanonical({ locatorId: line.locatorId })}`,
        pageNumber: line.pageNumber,
        locatorId: line.locatorId,
        kind,
        status:
          kind === "unclassified"
            ? "insufficient_evidence"
            : lineCells.some((cell) => cell.state === "ambiguous")
              ? "ambiguous"
              : "resolved",
        cellIds: lineCells.map((cell) => cell.cellId).sort(),
        description: descriptionFor(lineCells, fragments, textItems),
        descriptionSourceRowIds: [],
        continuationCandidateRowIds: [],
      };
  });

  return rows.map((row, index) => {
    if (row.kind !== "description_continuation") {
      return row;
    }
    const receivers = eligibleContinuationReceivers(rows, index, cells);
    return {
      ...row,
      status:
        receivers.length === 1
          ? "resolved"
          : receivers.length > 1
            ? "ambiguous"
            : "insufficient_evidence",
      descriptionSourceRowIds: receivers.length === 1 ? [receivers[0]!.rowId] : [],
      continuationCandidateRowIds: receivers.map((receiver) => receiver.rowId),
    };
  });
}
