import { createHash } from "node:crypto";
import { PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_RESULT_FINGERPRINT_VERSION } from "./budget-document-page-local-neutral-structured-evidence-formation.types";

/**
 * Fingerprint final (§26): fingerprint de identidade + toda a hierarquia
 * documental produzida (grupos, páginas, regiões, linhas, segmentos, posições
 * vazias/com célula/ambíguas/com falha, hipóteses físicas, evidências
 * textuais, fragmentos, estados, problemas, métricas, limitações). NUNCA
 * inclui timestamp, ordem de descoberta, caminho de arquivo, stack trace ou
 * identificador aleatório de execução. As coleções incidentais já foram
 * ordenadas canonicamente antes de chegar aqui, então o valor é invariante a
 * permutação por construção. SHA-256 sobre representação canônica por valor.
 */
export function computeResultFingerprint(identityFingerprint: string, content: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify([PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_RESULT_FINGERPRINT_VERSION, identityFingerprint, content]))
    .digest("hex");
}
