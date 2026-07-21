/**
 * Representação canônica de evidência observável (Sprint 21.4B.3A, §8 do
 * enunciado). Nenhum algoritmo candidato de decisão aqui — apenas
 * estruturas e funções puras de canonicalização, usadas pela prova de
 * indistinguibilidade e, na fase de avaliação, pelos candidatos.
 *
 * Nível 1 (contrato do helper `formTabularRegionCandidateWindows` hoje):
 * por linha, apenas `verticalOrder` e o conjunto de `alignmentKey` que ela
 * sustenta. A identidade literal de uma `alignmentKey` não é estrutural
 * (muda por fixture) — a canonicalização abaixo identifica um alinhamento
 * pelo CONJUNTO ORDENADO de posições relativas de linha que ele cobre
 * dentro da janela sob análise, tornando duas janelas estruturalmente
 * idênticas comparáveis mesmo vindas de fixtures diferentes.
 */

export interface HelperLevelInputLine {
  readonly lineKey: string;
  readonly verticalOrder: number;
}

export interface HelperLevelInputAlignment {
  readonly alignmentKey: string;
  readonly lineKeys: ReadonlyArray<string>;
}

/** Para cada linha da janela (ordenada por `verticalOrder`), a lista canônica de extents de alinhamento que ela sustenta — cada extent é o conjunto ordenado de índices relativos (0-based, dentro da janela) cobertos por aquele alinhamento. */
export interface HelperLevelWindowEvidence {
  readonly lineCount: number;
  readonly perLineAlignmentExtents: ReadonlyArray<ReadonlyArray<ReadonlyArray<number>>>;
}

export function buildHelperLevelWindowEvidence(
  orderedLineKeys: ReadonlyArray<string>,
  alignments: ReadonlyArray<HelperLevelInputAlignment>,
): HelperLevelWindowEvidence {
  const indexOf = new Map(orderedLineKeys.map((key, index) => [key, index]));
  const perLine: number[][][] = orderedLineKeys.map(() => []);

  alignments.forEach((alignment) => {
    const coveredIndices = alignment.lineKeys
      .map((key) => indexOf.get(key))
      .filter((index): index is number => index !== undefined)
      .sort((a, b) => a - b);
    if (coveredIndices.length < 2) {
      return;
    }
    coveredIndices.forEach((index) => {
      perLine[index].push(coveredIndices);
    });
  });

  const canonicalPerLine = perLine.map((extents) => {
    const serialized = extents.map((extent) => extent.join(","));
    const uniqueSorted = [...new Set(serialized)].sort();
    return uniqueSorted.map((serializedExtent) => serializedExtent.split(",").map(Number));
  });

  return { lineCount: orderedLineKeys.length, perLineAlignmentExtents: canonicalPerLine };
}

/** Fingerprint canônico de UMA linha-alvo, expresso relativo à própria posição da linha (nunca em índices absolutos da janela) — comparável entre janelas de mesmo comprimento com o alvo na mesma posição relativa. */
export interface TargetLineCanonicalFingerprint {
  readonly windowLength: number;
  readonly targetRelativePosition: number;
  readonly alignmentExtentsRelativeToTarget: ReadonlyArray<ReadonlyArray<number>>;
}

export function extractTargetLineFingerprint(
  evidence: HelperLevelWindowEvidence,
  targetIndex: number,
): TargetLineCanonicalFingerprint {
  const extents = evidence.perLineAlignmentExtents[targetIndex] ?? [];
  const relative = extents
    .map((extent) => extent.map((i) => i - targetIndex).sort((a, b) => a - b))
    .map((extent) => extent.join(","))
    .sort()
    .map((serialized) => serialized.split(",").map(Number));
  return {
    windowLength: evidence.lineCount,
    targetRelativePosition: targetIndex,
    alignmentExtentsRelativeToTarget: relative,
  };
}

export function fingerprintsEqual(a: TargetLineCanonicalFingerprint, b: TargetLineCanonicalFingerprint): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// --- Nível 2 (evidência ampliada da capacidade — geometria de segmento) ---

/** Fatos físicos brutos de UMA linha-alvo, tal como já calculados dentro do escopo de `detectPage` (candidateSegments) antes de qualquer redução para o helper — nunca inventados, sempre lidos de `AlignmentCandidateSegment`. Representação factual, não um discriminador. */
export interface TargetLineSegmentFacts {
  readonly segmentCount: number;
  readonly totalWidthPoints: number;
  readonly lineHeightPoints: number;
  /** Largura normalizada pela altura da própria linha — invariante a escala uniforme. */
  readonly widthToLineHeightRatio: number;
}

export function buildTargetLineSegmentFacts(
  segments: ReadonlyArray<{ readonly leftPoints: number; readonly rightPoints: number; readonly lineHeightPoints: number }>,
): TargetLineSegmentFacts {
  const totalWidthPoints = segments.reduce((sum, s) => sum + (s.rightPoints - s.leftPoints), 0);
  const lineHeightPoints = segments.length > 0 ? segments[0].lineHeightPoints : 0;
  return {
    segmentCount: segments.length,
    totalWidthPoints,
    lineHeightPoints,
    widthToLineHeightRatio: lineHeightPoints > 0 ? totalWidthPoints / lineHeightPoints : 0,
  };
}
