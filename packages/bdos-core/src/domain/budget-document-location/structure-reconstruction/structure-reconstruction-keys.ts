import { createHash } from "node:crypto";

/**
 * Chaves determinísticas da reconstrução estrutural (Sprint 21.4A.2.f.1,
 * §46). Cada chave é o SHA-256, em hexadecimal, de uma representação
 * canônica (array JSON com ordem fixa) — nunca UUID, nunca contador
 * global, nunca concatenação ambígua sem delimitação.
 */

function canonicalKey(parts: ReadonlyArray<string | number>): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

/** `reconstructionContextFingerprint + sourceCandidateGroupKey`. */
export function computeGroupReconstructionKey(
  reconstructionContextFingerprint: string,
  sourceCandidateGroupKey: string,
): string {
  return canonicalKey(["group", reconstructionContextFingerprint, sourceCandidateGroupKey]);
}

/** `groupReconstructionKey + pageNumber`. */
export function computePageReconstructionKey(groupReconstructionKey: string, pageNumber: number): string {
  return canonicalKey(["page", groupReconstructionKey, pageNumber]);
}

/** `pageReconstructionKey + orderedSourceTextItemIndices`. */
export function computeLineKey(pageReconstructionKey: string, orderedSourceTextItemIndices: ReadonlyArray<number>): string {
  return canonicalKey(["line", pageReconstructionKey, ...orderedSourceTextItemIndices]);
}

/** `lineKey + orderedSourceTextItemIndices`. */
export function computeSegmentKey(lineKey: string, orderedSourceTextItemIndices: ReadonlyArray<number>): string {
  return canonicalKey(["segment", lineKey, ...orderedSourceTextItemIndices]);
}

/** `pageReconstructionKey + orderedSegmentKeys`. */
export function computeBlockKey(pageReconstructionKey: string, orderedSegmentKeys: ReadonlyArray<string>): string {
  return canonicalKey(["block", pageReconstructionKey, ...orderedSegmentKeys]);
}
