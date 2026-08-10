import type {
  EvidenceTextItem,
  ReconstructedCell,
  SourceFragment,
} from "./budget-table-reconstruction.types";

/**
 * A caption labels; it does not narrate. A column title ("PREÇO TOTAL R$",
 * "UNIT. C/ BDI", "FONTE DE PESQUISA") and an aggregate caption ("TOTAL
 * GERAL", "VALOR BDI TOTAL:") are a handful of words, while the prose that
 * merely happens to contain the same word -- a service description ending in
 * a rate annotation, a legal note observing that something tracks "5% do
 * total da obra" -- is a sentence. The bound is the structural label/prose
 * distinction itself, shared by every rule in this domain that needs it, not
 * a parameter tuned to any document.
 */
const MAX_CAPTION_TOKENS = 4;

export function isCompactCaption(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return trimmed.split(/\s+/).length <= MAX_CAPTION_TOKENS;
}

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
