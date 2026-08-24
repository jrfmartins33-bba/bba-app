import { compareBudgetVersions, type BudgetVersion, type BudgetVersionComparison } from "../../domain/budget-version";
import type { BudgetVersionRepository } from "./budget-version.repository";

export type GetBudgetComparisonResult =
  | { readonly outcome: "compared"; readonly comparison: BudgetVersionComparison }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "not_applicable"; readonly reason: string };

/** Serviço de aplicação somente leitura para a cadeia Oficial → Vencedora. */
export async function getBudgetComparisonService(
  organizationId: string,
  proposalBudgetVersionId: string,
  repository: BudgetVersionRepository,
  loadedProposalBudgetVersion?: BudgetVersion,
): Promise<GetBudgetComparisonResult> {
  const loadedProposal = loadedProposalBudgetVersion
    ? { entity: loadedProposalBudgetVersion }
    : await repository.loadBudgetVersion(organizationId, proposalBudgetVersionId);
  if (!loadedProposal) return { outcome: "not_found" };
  if (loadedProposal.entity.id !== proposalBudgetVersionId) {
    return { outcome: "not_applicable", reason: "A versão previamente carregada não corresponde ao identificador solicitado." };
  }

  const officialBudgetVersionId = loadedProposal.entity.originLineage?.sourceBudgetVersionId ?? null;
  if (!officialBudgetVersionId) {
    return { outcome: "not_applicable", reason: "A versão não possui um Orçamento Oficial de origem rastreável." };
  }

  const official = await repository.loadBudgetVersion(organizationId, officialBudgetVersionId);
  if (!official) return { outcome: "not_found" };

  return {
    outcome: "compared",
    comparison: compareBudgetVersions({
      officialBudgetVersion: official.entity,
      proposalBudgetVersion: loadedProposal.entity,
    }),
  };
}
