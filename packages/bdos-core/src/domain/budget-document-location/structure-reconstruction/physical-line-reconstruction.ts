import type { BudgetDocumentStructureReconstructionProfile } from "./budget-document-structure-reconstruction.types";
import type { EligibleSourceTextItem } from "./source-item-reconstruction-outcomes";
import { sortEligibleItemsCanonically } from "./source-item-reconstruction-outcomes";

export const PHYSICAL_LINE_FORMATION_RULE_ID = "physical-line-pairwise-geometric-compatibility-v1" as const;
export const PHYSICAL_LINE_FORMATION_RULE_VERSION = 1 as const;

export interface ReconstructedLineDraft {
  readonly verticalOrder: number;
  readonly seedSourceTextItemIndex: number;
  readonly sourceTextItemIndices: ReadonlyArray<number>;
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly centerXPoints: number;
  readonly centerYPoints: number;
}

interface MutableLine {
  seedSourceTextItemIndex: number;
  members: EligibleSourceTextItem[];
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Sobreposição vertical normalizada entre dois itens (§25). Itens com
 * altura degenerada (`<= 0`) nunca são geometricamente compatíveis — a
 * razão seria infinita ou indefinida; formam sua própria linha unitária.
 */
function verticalOverlapRatio(a: EligibleSourceTextItem, b: EligibleSourceTextItem): number {
  const minHeight = Math.min(a.geometry.heightPoints, b.geometry.heightPoints);
  if (minHeight <= 0) {
    return -1;
  }
  const overlapHeight = Math.max(0, Math.min(a.geometry.bottomPoints, b.geometry.bottomPoints) - Math.max(a.geometry.topPoints, b.geometry.topPoints));
  return overlapHeight / minHeight;
}

function normalizedCenterDistance(a: EligibleSourceTextItem, b: EligibleSourceTextItem): number {
  const minHeight = Math.min(a.geometry.heightPoints, b.geometry.heightPoints);
  if (minHeight <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(a.geometry.centerYPoints - b.geometry.centerYPoints) / minHeight;
}

function arePairCompatible(
  a: EligibleSourceTextItem,
  b: EligibleSourceTextItem,
  profile: BudgetDocumentStructureReconstructionProfile,
): boolean {
  return (
    verticalOverlapRatio(a, b) >= profile.minimumPairVerticalOverlapRatio &&
    normalizedCenterDistance(a, b) <= profile.maximumPairCenterDistanceToMinimumHeightRatio
  );
}

/** Distância normalizada ao centro canônico da linha (§27, passo 6) — puramente geométrica, apenas para desempate. */
function lineCenterDistance(line: MutableLine, item: EligibleSourceTextItem): number {
  const lineCenterY = (line.top + line.bottom) / 2;
  const lineHeight = line.bottom - line.top;
  const minHeight = Math.min(item.geometry.heightPoints, lineHeight);
  if (minHeight <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(item.geometry.centerYPoints - lineCenterY) / minHeight;
}

/** Desempate determinístico entre linhas igualmente compatíveis (§27, passo 6). */
function chooseBestLine(candidates: ReadonlyArray<MutableLine>, item: EligibleSourceTextItem): MutableLine {
  return candidates.reduce((best, candidate) => {
    const bestDistance = lineCenterDistance(best, item);
    const candidateDistance = lineCenterDistance(candidate, item);
    if (candidateDistance !== bestDistance) {
      return candidateDistance < bestDistance ? candidate : best;
    }
    if (candidate.top !== best.top) {
      return candidate.top < best.top ? candidate : best;
    }
    return candidate.seedSourceTextItemIndex < best.seedSourceTextItemIndex ? candidate : best;
  });
}

function toDraft(line: MutableLine, verticalOrder: number): ReconstructedLineDraft {
  const sourceTextItemIndices = sortEligibleItemsCanonically(line.members).map((item) => item.sourceTextItemIndex);
  return {
    verticalOrder,
    seedSourceTextItemIndex: line.seedSourceTextItemIndex,
    sourceTextItemIndices,
    leftPoints: line.left,
    topPoints: line.top,
    rightPoints: line.right,
    bottomPoints: line.bottom,
    widthPoints: line.right - line.left,
    heightPoints: line.bottom - line.top,
    centerXPoints: (line.left + line.right) / 2,
    centerYPoints: (line.top + line.bottom) / 2,
  };
}

/**
 * Reconstrói faixas físicas de linha por compatibilidade geométrica par a
 * par completa (§25-29). Um item só entra numa linha quando compatível com
 * **todos** os membros já presentes — nunca apenas com o item semente ou
 * com o vizinho mais próximo (antiencadeamento, §26). Determinístico e
 * independente da ordem de entrada do array (§55): a ordem de
 * processamento é sempre a ordem canônica (§23), nunca a ordem original.
 */
export function reconstructPhysicalLines(
  eligibleItems: ReadonlyArray<EligibleSourceTextItem>,
  profile: BudgetDocumentStructureReconstructionProfile,
): ReadonlyArray<ReconstructedLineDraft> {
  const canonicalItems = sortEligibleItemsCanonically(eligibleItems);
  const lines: MutableLine[] = [];

  canonicalItems.forEach((item) => {
    const compatibleLines = lines.filter((line) => line.members.every((member) => arePairCompatible(member, item, profile)));

    if (compatibleLines.length === 0) {
      lines.push({
        seedSourceTextItemIndex: item.sourceTextItemIndex,
        members: [item],
        left: item.geometry.leftPoints,
        top: item.geometry.topPoints,
        right: item.geometry.rightPoints,
        bottom: item.geometry.bottomPoints,
      });
      return;
    }

    const chosen = chooseBestLine(compatibleLines, item);
    chosen.members.push(item);
    chosen.left = Math.min(chosen.left, item.geometry.leftPoints);
    chosen.top = Math.min(chosen.top, item.geometry.topPoints);
    chosen.right = Math.max(chosen.right, item.geometry.rightPoints);
    chosen.bottom = Math.max(chosen.bottom, item.geometry.bottomPoints);
  });

  const orderedLines = [...lines].sort((a, b) => {
    if (a.top !== b.top) {
      return a.top - b.top;
    }
    const aCenterY = (a.top + a.bottom) / 2;
    const bCenterY = (b.top + b.bottom) / 2;
    if (aCenterY !== bCenterY) {
      return aCenterY - bCenterY;
    }
    if (a.left !== b.left) {
      return a.left - b.left;
    }
    return a.seedSourceTextItemIndex - b.seedSourceTextItemIndex;
  });

  return orderedLines.map((line, index) => toDraft(line, index + 1));
}
