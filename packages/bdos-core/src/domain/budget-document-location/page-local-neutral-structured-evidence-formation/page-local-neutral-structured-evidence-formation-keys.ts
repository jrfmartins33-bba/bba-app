import { createHash } from "node:crypto";

/**
 * Todas as identidades da g.2 são reutilizadas dos contratos upstream
 * (sourceCandidateGroupKey, pageNumber, regionKey, lineKey,
 * gridIntersectionKey, cellHypothesisKey) — nenhuma chave pública nova é
 * criada (§25). Esta função existe apenas para semear o fingerprint de
 * identidade e nunca produz uma chave exposta no contrato público.
 */
function canonicalSha256(parts: ReadonlyArray<string | number>): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

/** Identidade composta interna de página (sourceCandidateGroupKey + pageNumber) — nunca exposta como chave pública (§25, §7). */
export const composePageProvenanceKey = (sourceCandidateGroupKey: string, pageNumber: number): string =>
  canonicalSha256(["page-local-neutral-structured-evidence-page", sourceCandidateGroupKey, pageNumber]);
