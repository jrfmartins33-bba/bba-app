import type { DecisionCase } from "../decision-case";
import { DecisionCaseState } from "../decision-case";
import type {
  DecisionPortfolioCapability,
  DecisionPortfolioCase,
  DecisionPortfolioDateTime,
  DecisionPortfolioId,
  DecisionPortfolioMetadata,
  DecisionPortfolioName,
  DecisionPortfolioSummary,
} from "./decision-portfolio.types";

export interface DecisionPortfolio {
  readonly id: DecisionPortfolioId;
  readonly name: DecisionPortfolioName;
  readonly createdAt: DecisionPortfolioDateTime;
  readonly capability: DecisionPortfolioCapability;
  readonly cases: ReadonlyArray<DecisionPortfolioCase>;
  readonly summary: DecisionPortfolioSummary;
  readonly metadata: DecisionPortfolioMetadata;
}

export interface CreateDecisionPortfolioInput {
  readonly id: DecisionPortfolioId;
  readonly name: DecisionPortfolioName;
  readonly createdAt: DecisionPortfolioDateTime;
  readonly decisionCases: ReadonlyArray<DecisionCase>;
  readonly metadata?: DecisionPortfolioMetadata;
}

export function createDecisionPortfolio(
  input: CreateDecisionPortfolioInput,
): DecisionPortfolio {
  const cases = input.decisionCases.map(toPortfolioCase);

  return {
    id: input.id,
    name: input.name,
    createdAt: input.createdAt,
    capability: derivePortfolioCapability(cases),
    cases,
    summary: summarizeCases(cases),
    metadata: input.metadata ?? {},
  };
}

function toPortfolioCase(decisionCase: DecisionCase): DecisionPortfolioCase {
  return {
    decisionCaseId: decisionCase.id,
    capability: decisionCase.capability,
    state: decisionCase.status,
    artifactTypes: decisionCase.artifacts.map((artifact) => artifact.type),
    createdAt: decisionCase.createdAt,
    metadata: decisionCase.metadata,
  };
}

function derivePortfolioCapability(
  cases: ReadonlyArray<DecisionPortfolioCase>,
): DecisionPortfolioCapability {
  const firstCase = cases[0];

  if (firstCase === undefined) {
    return null;
  }

  return cases.every((portfolioCase) => portfolioCase.capability === firstCase.capability)
    ? firstCase.capability
    : null;
}

function summarizeCases(
  cases: ReadonlyArray<DecisionPortfolioCase>,
): DecisionPortfolioSummary {
  const casesByState: Record<string, number> = {};
  const casesByCapability: Record<string, number> = {};
  let casesWithActionPlan = 0;
  let casesInMonitoring = 0;
  let casesCompleted = 0;

  cases.forEach((portfolioCase) => {
    incrementCount(casesByState, portfolioCase.state);
    incrementCount(casesByCapability, portfolioCase.capability);

    if (portfolioCase.artifactTypes.includes("action-plan")) {
      casesWithActionPlan += 1;
    }

    if (portfolioCase.state === DecisionCaseState.Monitoring) {
      casesInMonitoring += 1;
    }

    if (portfolioCase.state === DecisionCaseState.Completed) {
      casesCompleted += 1;
    }
  });

  return {
    totalCases: cases.length,
    casesByState,
    casesByCapability,
    casesWithActionPlan,
    casesInMonitoring,
    casesCompleted,
  };
}

function incrementCount(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}
