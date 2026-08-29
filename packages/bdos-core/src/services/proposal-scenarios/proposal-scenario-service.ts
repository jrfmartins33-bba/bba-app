import { createProposalScenario } from "../../domain/proposal-scenario";
import type {
  CreateProposalScenarioCommand,
  CreateProposalScenarioServiceResult,
  ListProposalScenariosServiceResult,
  ProposalScenarioApplicationContext,
  ProposalScenarioRepositories,
  ReadProposalScenarioServiceResult,
} from "./proposal-scenario-service.types";

export async function createProposalScenarioService(
  context: ProposalScenarioApplicationContext,
  command: CreateProposalScenarioCommand,
  repositories: ProposalScenarioRepositories,
): Promise<CreateProposalScenarioServiceResult> {
  try {
    const source = await repositories.budgetVersions.loadBudgetVersion(context.organizationId, command.sourceBudgetVersionId);
    if (source === null) return { outcome: "not_found" };

    const result = createProposalScenario({
      id: command.id,
      organizationId: context.organizationId,
      sourceBudgetVersion: source.entity,
      sourceBudgetVersionRevision: source.revision,
      name: command.name,
      targetValueCents: command.targetValueCents,
      createdBy: context.actor,
      createdAt: command.createdAt,
    });

    if (!result.success) return { outcome: "domain_error", errors: result.errors };
    const persisted = await repositories.scenarios.createScenario(context.organizationId, context.actor, result.scenario);
    return { outcome: "created", scenario: persisted };
  } catch (error) {
    return { outcome: "persistence_failure", message: error instanceof Error ? error.message : String(error) };
  }
}
export async function getProposalScenarioService(
  context: ProposalScenarioApplicationContext,
  id: string,
  repository: ProposalScenarioRepositories["scenarios"],
): Promise<ReadProposalScenarioServiceResult> {
  try {
    const scenario = await repository.findScenarioById(context.organizationId, id);
    return scenario === null ? { outcome: "not_found" } : { outcome: "found", scenario };
  } catch (error) {
    return { outcome: "persistence_failure", message: error instanceof Error ? error.message : String(error) };
  }
}

export async function listProposalScenariosService(
  context: ProposalScenarioApplicationContext,
  sourceBudgetVersionId: string | undefined,
  repository: ProposalScenarioRepositories["scenarios"],
): Promise<ListProposalScenariosServiceResult> {
  try {
    return { outcome: "listed", scenarios: await repository.listScenarios(context.organizationId, sourceBudgetVersionId) };
  } catch (error) {
    return { outcome: "persistence_failure", message: error instanceof Error ? error.message : String(error) };
  }
}
