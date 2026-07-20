import { createHash } from "node:crypto";
import { PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_RESULT_FINGERPRINT_VERSION } from "./budget-document-page-boundary-neutral-continuity-evaluation.types";

/**
 * Fingerprint final: fingerprint de identidade + toda a hierarquia de
 * avaliações produzida (status, sinais, evidências, problemas técnicos,
 * métricas, limitações). NUNCA inclui timestamp, ordem de descoberta,
 * caminho de arquivo, stack trace ou identificador aleatório de execução.
 * `evaluations` já chega ordenada canonicamente antes de chegar aqui, então
 * o valor é invariante a permutação por construção. SHA-256 sobre
 * representação canônica por valor.
 */
export function computeResultFingerprint(identityFingerprint: string, content: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify([PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_RESULT_FINGERPRINT_VERSION, identityFingerprint, content]))
    .digest("hex");
}
