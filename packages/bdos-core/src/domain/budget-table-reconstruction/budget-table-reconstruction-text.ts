import type {
  EvidenceTextItem,
  ReconstructedCell,
  SourceFragment,
} from "./budget-table-reconstruction.types";

export function fragmentText(
  fragmentId: string,
  fragments: ReadonlyArray<SourceFragment>,
  textItems: ReadonlyArray<EvidenceTextItem>,
): string {
  const fragment = fragments.find((candidate) => candidate.fragmentId === fragmentId);
  if (fragment === undefined) {
    return "";
  }
  const textItem = textItems.find(
    (candidate) => candidate.evidenceId === fragment.textItemEvidenceId,
  );
  return textItem?.rawText.slice(fragment.startOffset, fragment.endOffset) ?? "";
}

export function cellText(
  cell: ReconstructedCell,
  fragments: ReadonlyArray<SourceFragment>,
  textItems: ReadonlyArray<EvidenceTextItem>,
): string | null {
  if (cell.fragmentIds.length === 0) {
    return null;
  }
  const text = cell.fragmentIds
    .map((fragmentId) => fragmentText(fragmentId, fragments, textItems))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0 ? null : text;
}
