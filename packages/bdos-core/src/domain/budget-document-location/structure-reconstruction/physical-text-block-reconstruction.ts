import type { BudgetDocumentStructureReconstructionProfile } from "./budget-document-structure-reconstruction.types";

export const PHYSICAL_BLOCK_FORMATION_RULE_ID = "physical-block-mutual-adjacency-v1" as const;
export const PHYSICAL_BLOCK_FORMATION_RULE_VERSION = 1 as const;

export interface BlockReconstructionSegmentInput {
  readonly segmentKey: string;
  readonly lineKey: string;
  readonly lineVerticalOrder: number;
  readonly lineHeightPoints: number;
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly centerXPoints: number;
  readonly centerYPoints: number;
}

export interface ReconstructedBlockDraft {
  readonly order: number;
  readonly lineKeys: ReadonlyArray<string>;
  readonly segmentKeys: ReadonlyArray<string>;
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly centerXPoints: number;
  readonly centerYPoints: number;
}

function medianOfTwo(a: number, b: number): number {
  return (a + b) / 2;
}

/**
 * Candidatura bidimensional entre um segmento da linha superior e um da
 * linha imediatamente inferior (§36-37). Lacuna vertical normalizada pela
 * mediana das alturas das duas **linhas**; sobreposição/lacuna horizontal
 * relativas aos dois **segmentos** — a assimetria é intencional, conforme
 * especificado.
 */
function areBlockCandidates(
  upper: BlockReconstructionSegmentInput,
  lower: BlockReconstructionSegmentInput,
  profile: BudgetDocumentStructureReconstructionProfile,
): boolean {
  const verticalGap = Math.max(0, lower.topPoints - upper.bottomPoints);
  const medianLineHeight = medianOfTwo(upper.lineHeightPoints, lower.lineHeightPoints);
  if (medianLineHeight <= 0) {
    return false;
  }
  const normalizedVerticalGap = verticalGap / medianLineHeight;
  if (normalizedVerticalGap > profile.maximumBlockVerticalGapToMedianLineHeightRatio) {
    return false;
  }

  const horizontalOverlap = Math.max(0, Math.min(upper.rightPoints, lower.rightPoints) - Math.max(upper.leftPoints, lower.leftPoints));
  const minSegmentWidth = Math.min(upper.widthPoints, lower.widthPoints);
  const horizontalOverlapRatio = minSegmentWidth > 0 ? horizontalOverlap / minSegmentWidth : 0;
  if (horizontalOverlapRatio >= profile.minimumBlockHorizontalOverlapRatio) {
    return true;
  }

  const horizontalGap = Math.max(upper.leftPoints - lower.rightPoints, lower.leftPoints - upper.rightPoints, 0);
  const medianSegmentHeight = medianOfTwo(upper.heightPoints, lower.heightPoints);
  if (medianSegmentHeight <= 0) {
    return false;
  }
  const normalizedHorizontalGap = horizontalGap / medianSegmentHeight;
  return normalizedHorizontalGap <= profile.maximumBlockHorizontalGapToMedianSegmentHeightRatio;
}

interface CandidateComparison {
  readonly segment: BlockReconstructionSegmentInput;
  readonly overlapRatio: number;
  readonly gap: number;
  readonly centerDistance: number;
}

function compareCandidate(reference: BlockReconstructionSegmentInput, candidate: BlockReconstructionSegmentInput): CandidateComparison {
  const overlap = Math.max(0, Math.min(reference.rightPoints, candidate.rightPoints) - Math.max(reference.leftPoints, candidate.leftPoints));
  const minWidth = Math.min(reference.widthPoints, candidate.widthPoints);
  const overlapRatio = minWidth > 0 ? overlap / minWidth : 0;
  const gap = overlap > 0 ? 0 : Math.max(reference.leftPoints - candidate.rightPoints, candidate.leftPoints - reference.rightPoints, 0);
  const centerDistance = Math.abs(reference.centerXPoints - candidate.centerXPoints);
  return { segment: candidate, overlapRatio, gap, centerDistance };
}

/** Melhor candidato mútuo (§38): maior sobreposição horizontal, depois menor lacuna, depois menor distância de centros, depois menor chave. */
function chooseBestCandidate(reference: BlockReconstructionSegmentInput, candidates: ReadonlyArray<BlockReconstructionSegmentInput>): string | null {
  if (candidates.length === 0) {
    return null;
  }
  const comparisons = candidates.map((candidate) => compareCandidate(reference, candidate));
  const best = comparisons.reduce((current, next) => {
    if (next.overlapRatio !== current.overlapRatio) {
      return next.overlapRatio > current.overlapRatio ? next : current;
    }
    if (next.gap !== current.gap) {
      return next.gap < current.gap ? next : current;
    }
    if (next.centerDistance !== current.centerDistance) {
      return next.centerDistance < current.centerDistance ? next : current;
    }
    return next.segment.segmentKey.localeCompare(current.segment.segmentKey) < 0 ? next : current;
  });
  return best.segment.segmentKey;
}

/**
 * Reconstrói blocos físicos bidimensionais por adjacência mútua entre
 * segmentos de linhas fisicamente consecutivas (§35-40). Nunca conecta
 * segmentos da mesma linha, com mais de uma linha de distância, ou de
 * páginas/grupos diferentes (a fronteira de página/grupo é garantida por
 * construção: esta função sempre recebe segmentos de uma única página).
 */
export function reconstructPhysicalTextBlocks(
  segments: ReadonlyArray<BlockReconstructionSegmentInput>,
  profile: BudgetDocumentStructureReconstructionProfile,
): ReadonlyArray<ReconstructedBlockDraft> {
  const segmentsByLine = new Map<number, BlockReconstructionSegmentInput[]>();
  segments.forEach((segment) => {
    const bucket = segmentsByLine.get(segment.lineVerticalOrder) ?? [];
    bucket.push(segment);
    segmentsByLine.set(segment.lineVerticalOrder, bucket);
  });

  const bestDownward = new Map<string, string>();
  const bestUpward = new Map<string, string>();

  segments.forEach((segment) => {
    const lowerLineSegments = segmentsByLine.get(segment.lineVerticalOrder + 1) ?? [];
    const downwardCandidates = lowerLineSegments.filter((candidate) => areBlockCandidates(segment, candidate, profile));
    const bestDown = chooseBestCandidate(segment, downwardCandidates);
    if (bestDown !== null) {
      bestDownward.set(segment.segmentKey, bestDown);
    }

    const upperLineSegments = segmentsByLine.get(segment.lineVerticalOrder - 1) ?? [];
    const upwardCandidates = upperLineSegments.filter((candidate) => areBlockCandidates(candidate, segment, profile));
    const bestUp = chooseBestCandidate(segment, upwardCandidates);
    if (bestUp !== null) {
      bestUpward.set(segment.segmentKey, bestUp);
    }
  });

  const adjacency = new Map<string, Set<string>>();
  const addEdge = (a: string, b: string): void => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };

  segments.forEach((segment) => {
    adjacency.set(segment.segmentKey, adjacency.get(segment.segmentKey) ?? new Set());
    const downwardBest = bestDownward.get(segment.segmentKey);
    if (downwardBest !== undefined && bestUpward.get(downwardBest) === segment.segmentKey) {
      addEdge(segment.segmentKey, downwardBest);
    }
  });

  const segmentByKey = new Map(segments.map((segment) => [segment.segmentKey, segment]));
  const visited = new Set<string>();
  const components: string[][] = [];

  segments.forEach((segment) => {
    if (visited.has(segment.segmentKey)) {
      return;
    }
    const component: string[] = [];
    const queue = [segment.segmentKey];
    visited.add(segment.segmentKey);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      (adjacency.get(current) ?? new Set()).forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
    components.push(component);
  });

  const drafts = components.map((componentKeys) => {
    const componentSegments = componentKeys.map((key) => segmentByKey.get(key)!);
    const lineKeys = [
      ...new Set([...componentSegments].sort((a, b) => a.lineVerticalOrder - b.lineVerticalOrder).map((s) => s.lineKey)),
    ];
    const left = Math.min(...componentSegments.map((s) => s.leftPoints));
    const top = Math.min(...componentSegments.map((s) => s.topPoints));
    const right = Math.max(...componentSegments.map((s) => s.rightPoints));
    const bottom = Math.max(...componentSegments.map((s) => s.bottomPoints));
    return {
      lineKeys,
      segmentKeys: [...componentSegments]
        .sort((a, b) => a.lineVerticalOrder - b.lineVerticalOrder || a.leftPoints - b.leftPoints || a.segmentKey.localeCompare(b.segmentKey))
        .map((s) => s.segmentKey),
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

  const ordered = [...drafts].sort((a, b) => {
    if (a.topPoints !== b.topPoints) return a.topPoints - b.topPoints;
    if (a.leftPoints !== b.leftPoints) return a.leftPoints - b.leftPoints;
    if (a.bottomPoints !== b.bottomPoints) return a.bottomPoints - b.bottomPoints;
    return a.segmentKeys[0].localeCompare(b.segmentKeys[0]);
  });

  return ordered.map((draft, index) => ({ ...draft, order: index + 1 }));
}
