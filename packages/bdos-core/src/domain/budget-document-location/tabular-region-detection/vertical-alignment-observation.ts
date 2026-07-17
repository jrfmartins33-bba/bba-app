import type { ReconstructedHorizontalSegment, ReconstructedPhysicalLine } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { BudgetDocumentTabularRegionDetectionProfile, RecurrentVerticalAlignmentType } from "./budget-document-tabular-region-detection.types";

export const VERTICAL_ALIGNMENT_OBSERVATION_RULE_ID = "vertical-alignment-full-pairwise-compatibility-v1" as const;
export const VERTICAL_ALIGNMENT_OBSERVATION_RULE_VERSION = 1 as const;

const ALIGNMENT_TYPES: ReadonlyArray<RecurrentVerticalAlignmentType> = ["left_edge", "right_edge", "horizontal_center"];

export interface AlignmentCandidateSegment {
  readonly segmentKey: string;
  readonly horizontalOrder: number;
  readonly lineKey: string;
  readonly lineVerticalOrder: number;
  readonly lineHeightPoints: number;
  readonly leftPoints: number;
  readonly rightPoints: number;
  readonly centerXPoints: number;
}

export interface VerticalAlignmentDraft {
  readonly alignmentType: RecurrentVerticalAlignmentType;
  readonly canonicalPositionPoints: number;
  /** Membros em ordem canônica (`lineVerticalOrder` ascendente) — nunca a ordem de descoberta do cluster. */
  readonly members: ReadonlyArray<{ readonly lineKey: string; readonly segmentKey: string; readonly positionPoints: number }>;
}

function positionOf(segment: AlignmentCandidateSegment, alignmentType: RecurrentVerticalAlignmentType): number {
  switch (alignmentType) {
    case "left_edge":
      return segment.leftPoints;
    case "right_edge":
      return segment.rightPoints;
    case "horizontal_center":
      return segment.centerXPoints;
  }
}

/**
 * Compatibilidade posicional entre dois segmentos candidatos ao mesmo
 * alinhamento (§8.1, §10): desvio de posição normalizado pela **menor**
 * altura das duas linhas envolvidas — a mesma normalização (nunca a
 * mediana) usada por `maximumPairCenterDistanceToMinimumHeightRatio` na
 * Sprint anterior, cujo valor esta Sprint reaproveita deliberadamente
 * (§ perfil). Linhas de altura degenerada (`<= 0`) nunca são compatíveis —
 * mesma guarda defensiva de `physical-line-reconstruction.ts`.
 */
function arePositionsCompatible(
  a: { readonly positionPoints: number; readonly lineHeightPoints: number },
  b: { readonly positionPoints: number; readonly lineHeightPoints: number },
  profile: BudgetDocumentTabularRegionDetectionProfile,
): boolean {
  const minHeight = Math.min(a.lineHeightPoints, b.lineHeightPoints);
  if (minHeight <= 0) {
    return false;
  }
  const normalizedDeviation = Math.abs(a.positionPoints - b.positionPoints) / minHeight;
  return normalizedDeviation <= profile.maximumAlignmentPositionDeviationToMinimumLineHeightRatio;
}

interface MutableCluster {
  readonly members: Array<{ readonly lineKey: string; readonly lineVerticalOrder: number; readonly segmentKey: string; readonly positionPoints: number; readonly lineHeightPoints: number }>;
}

function clusterMeanPosition(cluster: MutableCluster): number {
  const sum = cluster.members.reduce((total, member) => total + member.positionPoints, 0);
  return sum / cluster.members.length;
}

/** Desempate determinístico entre clusters igualmente compatíveis: menor distância à posição média do cluster, depois menor `lineVerticalOrder` do primeiro membro, depois menor `segmentKey`. */
function chooseBestCluster(
  candidates: ReadonlyArray<MutableCluster>,
  candidatePosition: number,
): MutableCluster {
  return candidates.reduce((best, candidate) => {
    const bestDistance = Math.abs(candidatePosition - clusterMeanPosition(best));
    const candidateDistance = Math.abs(candidatePosition - clusterMeanPosition(candidate));
    if (candidateDistance !== bestDistance) {
      return candidateDistance < bestDistance ? candidate : best;
    }
    const bestFirst = best.members[0];
    const candidateFirst = candidate.members[0];
    if (candidateFirst.lineVerticalOrder !== bestFirst.lineVerticalOrder) {
      return candidateFirst.lineVerticalOrder < bestFirst.lineVerticalOrder ? candidate : best;
    }
    return candidateFirst.segmentKey.localeCompare(bestFirst.segmentKey) < 0 ? candidate : best;
  });
}

/**
 * Observa alinhamentos verticais recorrentes de um único tipo (§8.1) numa
 * única página. Um segmento só ingressa num cluster quando compatível com
 * **todos** os membros já presentes — nunca apenas com o membro mais
 * próximo ou com a posição média (antiencadeamento — mesmo padrão de
 * `reconstructPhysicalLines`, Sprint anterior, §12). No máximo um segmento
 * por linha ingressa em cada cluster (uma linha "sustenta" o alinhamento
 * no máximo uma vez). Determinístico e independente da ordem de entrada:
 * processa sempre em ordem canônica (posição, depois `lineVerticalOrder`,
 * depois `horizontalOrder`, depois `segmentKey`).
 */
function observeAlignmentsOfType(
  segments: ReadonlyArray<AlignmentCandidateSegment>,
  alignmentType: RecurrentVerticalAlignmentType,
  profile: BudgetDocumentTabularRegionDetectionProfile,
): ReadonlyArray<VerticalAlignmentDraft> {
  const canonicalCandidates = [...segments].sort((a, b) => {
    const positionDiff = positionOf(a, alignmentType) - positionOf(b, alignmentType);
    if (positionDiff !== 0) return positionDiff;
    if (a.lineVerticalOrder !== b.lineVerticalOrder) return a.lineVerticalOrder - b.lineVerticalOrder;
    if (a.horizontalOrder !== b.horizontalOrder) return a.horizontalOrder - b.horizontalOrder;
    return a.segmentKey.localeCompare(b.segmentKey);
  });

  const clusters: MutableCluster[] = [];

  canonicalCandidates.forEach((segment) => {
    const position = positionOf(segment, alignmentType);
    const candidateMember = { lineKey: segment.lineKey, lineVerticalOrder: segment.lineVerticalOrder, segmentKey: segment.segmentKey, positionPoints: position, lineHeightPoints: segment.lineHeightPoints };

    const compatibleClusters = clusters.filter((cluster) => {
      const hasLineAlready = cluster.members.some((member) => member.lineKey === segment.lineKey);
      if (hasLineAlready) {
        return false;
      }
      return cluster.members.every((member) => arePositionsCompatible(member, candidateMember, profile));
    });

    if (compatibleClusters.length === 0) {
      clusters.push({ members: [candidateMember] });
      return;
    }

    const chosen = chooseBestCluster(compatibleClusters, position);
    chosen.members.push(candidateMember);
  });

  return clusters
    .filter((cluster) => cluster.members.length >= profile.minimumLinesSustainingAlignment)
    .map((cluster) => {
      const orderedMembers = [...cluster.members].sort((a, b) => a.lineVerticalOrder - b.lineVerticalOrder);
      return {
        alignmentType,
        canonicalPositionPoints: clusterMeanPosition(cluster),
        members: orderedMembers.map((member) => ({ lineKey: member.lineKey, segmentKey: member.segmentKey, positionPoints: member.positionPoints })),
      };
    });
}

/** Constrói os candidatos de alinhamento (um por segmento) a partir das linhas e segmentos reconstruídos de uma única página. */
export function buildAlignmentCandidateSegments(
  lines: ReadonlyArray<ReconstructedPhysicalLine>,
  segments: ReadonlyArray<ReconstructedHorizontalSegment>,
): ReadonlyArray<AlignmentCandidateSegment> {
  const lineByKey = new Map(lines.map((line) => [line.lineKey, line]));
  return segments.map((segment) => {
    const line = lineByKey.get(segment.lineKey)!;
    return {
      segmentKey: segment.segmentKey,
      horizontalOrder: segment.horizontalOrder,
      lineKey: line.lineKey,
      lineVerticalOrder: line.verticalOrder,
      lineHeightPoints: line.heightPoints,
      leftPoints: segment.leftPoints,
      rightPoints: segment.rightPoints,
      centerXPoints: segment.centerXPoints,
    };
  });
}

/**
 * Observa alinhamentos verticais recorrentes de uma única página, para os
 * três tipos admitidos (§8.1), de forma independente entre si. Nunca
 * funde tipos diferentes num único cluster.
 */
export function observeVerticalAlignments(
  candidateSegments: ReadonlyArray<AlignmentCandidateSegment>,
  profile: BudgetDocumentTabularRegionDetectionProfile,
): ReadonlyArray<VerticalAlignmentDraft> {
  return ALIGNMENT_TYPES.flatMap((alignmentType) => observeAlignmentsOfType(candidateSegments, alignmentType, profile));
}
