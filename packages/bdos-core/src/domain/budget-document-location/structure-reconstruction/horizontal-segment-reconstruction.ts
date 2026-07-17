import type { PhysicalDocumentTextItemLayoutGeometry } from "../physical-document-read.types";
import type { BudgetDocumentStructureReconstructionProfile } from "./budget-document-structure-reconstruction.types";

export const HORIZONTAL_SEGMENT_FORMATION_RULE_ID = "horizontal-segment-median-gap-v1" as const;
export const HORIZONTAL_SEGMENT_FORMATION_RULE_VERSION = 1 as const;

export interface ReconstructedSegmentDraft {
  readonly horizontalOrder: number;
  readonly sourceTextItemIndices: ReadonlyArray<number>;
  readonly observedInternalGaps: ReadonlyArray<number>;
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly centerXPoints: number;
  readonly centerYPoints: number;
}

/**
 * Mediana determinística, sem biblioteca estatística: ordenação numérica,
 * elemento central para quantidade ímpar, média dos dois centrais para
 * quantidade par (§32).
 */
function computeMedian(values: ReadonlyArray<number>): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Reconstrói segmentos horizontais dentro de uma única linha, por lacuna
 * normalizada pela altura mediana dos itens da linha (§30-33). Uma linha
 * com um único item nunca precisa de mediana (não há par a comparar) —
 * item de altura degenerada (`<= 0`) só pode existir como membro único de
 * sua própria linha (garantido pela compatibilidade par a par de
 * `physical-line-reconstruction.ts`), então a mediana usada aqui é sempre
 * positiva quando há mais de um item.
 */
export function reconstructHorizontalSegments(
  lineSourceTextItemIndices: ReadonlyArray<number>,
  geometryByIndex: ReadonlyMap<number, PhysicalDocumentTextItemLayoutGeometry>,
  profile: BudgetDocumentStructureReconstructionProfile,
): ReadonlyArray<ReconstructedSegmentDraft> {
  const orderedIndices = [...lineSourceTextItemIndices].sort((leftIndex, rightIndex) => {
    const left = geometryByIndex.get(leftIndex);
    const right = geometryByIndex.get(rightIndex);
    if (left === undefined || right === undefined) {
      return leftIndex - rightIndex;
    }
    if (left.leftPoints !== right.leftPoints) {
      return left.leftPoints - right.leftPoints;
    }
    if (left.rightPoints !== right.rightPoints) {
      return left.rightPoints - right.rightPoints;
    }
    if (left.topPoints !== right.topPoints) {
      return left.topPoints - right.topPoints;
    }
    return leftIndex - rightIndex;
  });

  const medianItemHeight = computeMedian(orderedIndices.map((index) => geometryByIndex.get(index)!.heightPoints));

  const segments: { indices: number[]; gaps: number[] }[] = [];
  let current: { indices: number[]; gaps: number[] } | null = null;

  orderedIndices.forEach((index) => {
    const geometry = geometryByIndex.get(index)!;
    if (current === null) {
      current = { indices: [index], gaps: [] };
      segments.push(current);
      return;
    }

    const previousGeometry = geometryByIndex.get(current.indices[current.indices.length - 1])!;
    const gap = geometry.leftPoints - previousGeometry.rightPoints;
    const normalizedGap = Math.max(0, gap) / medianItemHeight;

    if (normalizedGap <= profile.maximumSegmentGapToMedianItemHeightRatio) {
      current.indices.push(index);
      current.gaps.push(normalizedGap);
    } else {
      current = { indices: [index], gaps: [] };
      segments.push(current);
    }
  });

  return segments.map((segment, position) => {
    const geometries = segment.indices.map((index) => geometryByIndex.get(index)!);
    const left = Math.min(...geometries.map((g) => g.leftPoints));
    const top = Math.min(...geometries.map((g) => g.topPoints));
    const right = Math.max(...geometries.map((g) => g.rightPoints));
    const bottom = Math.max(...geometries.map((g) => g.bottomPoints));
    return {
      horizontalOrder: position + 1,
      sourceTextItemIndices: segment.indices,
      observedInternalGaps: segment.gaps,
      leftPoints: left,
      topPoints: top,
      rightPoints: right,
      bottomPoints: bottom,
      widthPoints: right - left,
      heightPoints: bottom - top,
      centerXPoints: (left + right) / 2,
      centerYPoints: (top + bottom) / 2,
    };
  });
}
