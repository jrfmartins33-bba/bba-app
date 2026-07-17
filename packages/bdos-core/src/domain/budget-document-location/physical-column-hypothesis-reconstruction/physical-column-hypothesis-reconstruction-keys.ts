import { createHash } from "node:crypto";

/**
 * Chaves determinísticas da reconstrução de hipóteses de coluna física
 * (Sprint 21.4A.2.f.2b). Cada chave é o SHA-256, em hexadecimal, de uma
 * representação canônica (array JSON com ordem fixa) — nunca UUID, nunca
 * contador global. Dependem apenas de identidades de origem (via
 * `identityFingerprint`, que já incorpora schema/reconstrutor/perfil/
 * regras/versões das duas etapas consumidas) e das estruturas
 * participantes em ordem canônica.
 *
 * Nomeação deliberadamente inequívoca (auditoria da Sprint 21.4A.2.f.2b,
 * §3): `groupProcessedKey`/`pageProcessedKey`/`regionProcessedKey` nunca
 * pretendem ser uma referência literal às chaves de origem — são sempre
 * chaves próprias desta etapa. A referência literal à origem vive em
 * campos separados (`sourceCandidateGroupKey`, `sourceRegionKey`,
 * `pageNumber`).
 */

function canonicalKey(parts: ReadonlyArray<string | number>): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

/** `identityFingerprint + sourceCandidateGroupKey`. */
export function computeGroupProcessedKey(identityFingerprint: string, sourceCandidateGroupKey: string): string {
  return canonicalKey(["group", identityFingerprint, sourceCandidateGroupKey]);
}

/** `groupProcessedKey + pageNumber`. */
export function computePageProcessedKey(groupProcessedKey: string, pageNumber: number): string {
  return canonicalKey(["page", groupProcessedKey, pageNumber]);
}

/** `pageProcessedKey + sourceRegionKey` (a chave da região candidata de origem, Sprint 21.4A.2.f.2a). */
export function computeRegionProcessedKey(pageProcessedKey: string, sourceRegionKey: string): string {
  return canonicalKey(["region", pageProcessedKey, sourceRegionKey]);
}

/** `regionProcessedKey + orderedSegmentKeys` (a assinatura física exata da hipótese). */
export function computeHypothesisKey(regionProcessedKey: string, orderedSegmentKeys: ReadonlyArray<string>): string {
  return canonicalKey(["hypothesis", regionProcessedKey, ...orderedSegmentKeys]);
}
