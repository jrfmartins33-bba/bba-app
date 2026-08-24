import { compareBudgetVersions } from "../../domain/budget-version";
import { buildLagoaDoArrozOfficialScenario } from "../../domain/budget-version/lagoa-do-arroz.official-fixture-loader";
import { buildLagoaDoArrozProposalScenario } from "../../domain/budget-version/lagoa-do-arroz.proposal-fixture-loader";

/**
 * Bancada documental somente leitura usada por testes e prévias locais.
 * Não é chamada pela rota real e nunca acessa persistência.
 */
export function buildBudgetComparisonValidationFixture() {
  const official = buildLagoaDoArrozOfficialScenario();
  const proposal = buildLagoaDoArrozProposalScenario({
    procurementCase: official.procurementCase,
    officialBudgetVersion: official.consolidatedBudgetVersion,
  });
  return {
    proposalBudgetVersion: proposal.consolidatedBudgetVersion,
    comparison: compareBudgetVersions({
      officialBudgetVersion: official.consolidatedBudgetVersion,
      proposalBudgetVersion: proposal.consolidatedBudgetVersion,
    }),
  };
}
