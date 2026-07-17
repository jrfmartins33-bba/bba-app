import { createHash } from "node:crypto";

/**
 * Chaves determinísticas da detecção de regiões tabulares (Sprint
 * 21.4A.2.f.2a, §17). Cada chave é o SHA-256, em hexadecimal, de uma
 * representação canônica (array JSON com ordem fixa) — nunca UUID, nunca
 * contador global. Dependem apenas de identidades de origem (via
 * `detectionIdentityFingerprint`, que já incorpora schema/detector/perfil/
 * regras/versões — mesmo padrão de `reconstructionContextFingerprint` na
 * Sprint anterior) e das estruturas participantes em ordem canônica —
 * nunca do conteúdo canônico de evidências/regiões, que só entra no
 * fingerprint final exposto no resultado (`tabular-region-detection-context-fingerprint.ts`).
 */

function canonicalKey(parts: ReadonlyArray<string | number>): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

/** `detectionIdentityFingerprint + sourceCandidateGroupKey`. */
export function computeGroupProcessedKey(detectionIdentityFingerprint: string, sourceCandidateGroupKey: string): string {
  return canonicalKey(["group", detectionIdentityFingerprint, sourceCandidateGroupKey]);
}

/** `groupProcessedKey + pageNumber`. */
export function computePageProcessedKey(groupProcessedKey: string, pageNumber: number): string {
  return canonicalKey(["page", groupProcessedKey, pageNumber]);
}

/** `pageProcessedKey + alignmentType + orderedSegmentKeys` (uma chave por segmento membro, em ordem vertical de linha). */
export function computeAlignmentKey(pageProcessedKey: string, alignmentType: string, orderedSegmentKeys: ReadonlyArray<string>): string {
  return canonicalKey(["alignment", pageProcessedKey, alignmentType, ...orderedSegmentKeys]);
}

/** `pageProcessedKey + orderedLineKeys` (chaves das linhas membro, em ordem vertical). */
export function computeRegionKey(pageProcessedKey: string, orderedLineKeys: ReadonlyArray<string>): string {
  return canonicalKey(["region", pageProcessedKey, ...orderedLineKeys]);
}
