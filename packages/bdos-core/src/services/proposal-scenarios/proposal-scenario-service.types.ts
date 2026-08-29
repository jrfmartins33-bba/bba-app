import type { ProposalScenario, ProposalScenarioError } from "../../domain/proposal-scenario";
import type { BudgetVersionRepository } from "../procurement-engineering";
import type { ProposalScenarioRepository } from "./proposal-scenario.repository";

export interface ProposalScenarioApplicationContext {
  readonly organizationId: string;
  readonly actor: string;
}

export interface CreateProposalScenarioCommand {
  readonly id: string;
  readonly sourceBudgetVersionId: string;
  readonly name: string;
  readonly targetValueCents: number;
  readonly createdAt: string;
}

export interface ProposalScenarioRepositories {
  readonly budgetVersions: BudgetVersionRepository;
  readonly scenarios: ProposalScenarioRepository;
}

export type CreateProposalScenarioServiceResult =
  | { readonly outcome: "created"; readonly scenario: ProposalScenario }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "domain_error"; readonly errors: ReadonlyArray<ProposalScenarioError> }
  | { readonly outcome: "persistence_failure"; readonly message: string };

export type ReadProposalScenarioServiceResult =
  | { readonly outcome: "found"; readonly scenario: ProposalScenario }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "persistence_failure"; readonly message: string };

export type ListProposalScenariosServiceResult =
  | { readonly outcome: "listed"; readonly scenarios: ReadonlyArray<ProposalScenario> }
  | { readonly outcome: "persistence_failure"; readonly message: string };
