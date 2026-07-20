import { createHash } from "node:crypto";

/**
 * Identidade interna determinística de uma linha proposta — hash canônico
 * da proveniência (grupo + página + região + linha), nunca do código
 * externo (§13: "código externo nunca é identidade"). Estável entre
 * execuções sobre o mesmo documento; nunca reutiliza uma chave pública já
 * existente como identidade de outro nível — é uma composição nova,
 * própria desta capacidade, exatamente onde a especificação exige uma
 * identidade nova (proposta ainda não é uma `BudgetLine`).
 */
export function computeProposedLineId(sourceCandidateGroupKey: string, pageNumber: number, sourceRegionKey: string, sourceLineKey: string): string {
  return createHash("sha256")
    .update(JSON.stringify(["proposed-budget-line-id-v1", sourceCandidateGroupKey, pageNumber, sourceRegionKey, sourceLineKey]))
    .digest("hex");
}
