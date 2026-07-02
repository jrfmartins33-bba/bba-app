import { DecisionCaseState } from "../decision-case";
import type { DecisionPortfolioCase } from "./decision-portfolio.types";
import type {
  PortfolioPriority,
  PrioritizeDecisionPortfolioInput,
  PrioritizedPortfolio,
  PrioritizedPortfolioItem,
  PrioritizedPortfolioSummary,
} from "./portfolio-prioritization.types";

interface ScoredPortfolioCase {
  readonly portfolioCase: DecisionPortfolioCase;
  readonly score: number;
  readonly reasons: ReadonlyArray<string>;
}

export function prioritizeDecisionPortfolio(
  input: PrioritizeDecisionPortfolioInput,
): PrioritizedPortfolio {
  const scoredCases = input.portfolio.cases
    .map(scorePortfolioCase)
    .sort(compareScoredCases);

  const items = scoredCases.map(toPrioritizedPortfolioItem);

  return {
    portfolioId: input.portfolio.id,
    generatedAt: input.generatedAt,
    items,
    summary: summarizeItems(items),
    metadata: input.portfolio.metadata,
  };
}

function scorePortfolioCase(
  portfolioCase: DecisionPortfolioCase,
): ScoredPortfolioCase {
  const baseScore = baseScoreByState[portfolioCase.state];
  let score = baseScore;
  const reasons = [`state:${portfolioCase.state}:${baseScore}`];

  if (portfolioCase.artifactTypes.includes("action-plan")) {
    score += 15;
    reasons.push("artifact:action-plan:+15");
  }

  if (isCashCapability(portfolioCase.capability)) {
    score += 10;
    reasons.push("capability:cash:+10");
  }

  const severity = portfolioCase.metadata["severity"];

  if (severity === "critical") {
    score += 10;
    reasons.push("severity:critical:+10");
  }

  if (severity === "high") {
    score += 5;
    reasons.push("severity:high:+5");
  }

  return {
    portfolioCase,
    score,
    reasons,
  };
}

function compareScoredCases(
  left: ScoredPortfolioCase,
  right: ScoredPortfolioCase,
): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.portfolioCase.createdAt !== right.portfolioCase.createdAt) {
    return left.portfolioCase.createdAt < right.portfolioCase.createdAt ? -1 : 1;
  }

  if (left.portfolioCase.decisionCaseId === right.portfolioCase.decisionCaseId) {
    return 0;
  }

  return left.portfolioCase.decisionCaseId < right.portfolioCase.decisionCaseId
    ? -1
    : 1;
}

function toPrioritizedPortfolioItem(
  scoredCase: ScoredPortfolioCase,
  index: number,
): PrioritizedPortfolioItem {
  return {
    decisionCaseId: scoredCase.portfolioCase.decisionCaseId,
    rank: index + 1,
    score: scoredCase.score,
    priority: toPriority(scoredCase.score),
    reasons: scoredCase.reasons,
    state: scoredCase.portfolioCase.state,
    capability: scoredCase.portfolioCase.capability,
    artifactTypes: scoredCase.portfolioCase.artifactTypes,
    metadata: scoredCase.portfolioCase.metadata,
  };
}

function summarizeItems(
  items: ReadonlyArray<PrioritizedPortfolioItem>,
): PrioritizedPortfolioSummary {
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  items.forEach((item) => {
    if (item.priority === "critical") {
      criticalCount += 1;
    }

    if (item.priority === "high") {
      highCount += 1;
    }

    if (item.priority === "medium") {
      mediumCount += 1;
    }

    if (item.priority === "low") {
      lowCount += 1;
    }
  });

  return {
    totalItems: items.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    topDecisionCaseId: items[0]?.decisionCaseId ?? null,
  };
}

function toPriority(score: number): PortfolioPriority {
  if (score >= 90) {
    return "critical";
  }

  if (score >= 70) {
    return "high";
  }

  if (score >= 40) {
    return "medium";
  }

  return "low";
}

function isCashCapability(capability: string): boolean {
  return capability.toLowerCase().includes("cash");
}

const baseScoreByState: Readonly<Record<DecisionCaseState, number>> = {
  [DecisionCaseState.Monitoring]: 80,
  [DecisionCaseState.ActionPlanReady]: 70,
  [DecisionCaseState.PlaybookBuilt]: 60,
  [DecisionCaseState.Recommended]: 50,
  [DecisionCaseState.DecisionBuilt]: 40,
  [DecisionCaseState.Diagnosed]: 30,
  [DecisionCaseState.Observed]: 20,
  [DecisionCaseState.Created]: 10,
  [DecisionCaseState.Completed]: 0,
  [DecisionCaseState.Archived]: 0,
};
