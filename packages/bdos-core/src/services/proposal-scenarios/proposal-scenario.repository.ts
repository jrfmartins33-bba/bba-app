import type { ProposalScenario } from "../../domain/proposal-scenario";

export interface ProposalScenarioRepository {
  createScenario(organizationId: string, actor: string, scenario: ProposalScenario): Promise<ProposalScenario>;
  findScenarioById(organizationId: string, id: string): Promise<ProposalScenario | null>;
  listScenarios(organizationId: string, sourceBudgetVersionId?: string): Promise<ReadonlyArray<ProposalScenario>>;
}
