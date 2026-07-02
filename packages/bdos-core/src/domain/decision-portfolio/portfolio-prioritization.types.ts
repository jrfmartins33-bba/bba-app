import type {
  DecisionCaseArtifactType,
  DecisionCaseCapability,
  DecisionCaseDateTime,
  DecisionCaseId,
  DecisionCaseMetadata,
  DecisionCaseState,
} from "../decision-case";
import type { DecisionPortfolio } from "./decision-portfolio";
import type {
  DecisionPortfolioId,
  DecisionPortfolioMetadata,
} from "./decision-portfolio.types";

export type PortfolioPriority = "critical" | "high" | "medium" | "low";

export type PrioritizedPortfolioDateTime = DecisionCaseDateTime;

export type PrioritizedPortfolioMetadata = DecisionPortfolioMetadata;

export interface PrioritizedPortfolio {
  readonly portfolioId: DecisionPortfolioId;
  readonly generatedAt: PrioritizedPortfolioDateTime;
  readonly items: ReadonlyArray<PrioritizedPortfolioItem>;
  readonly summary: PrioritizedPortfolioSummary;
  readonly metadata: PrioritizedPortfolioMetadata;
}

export interface PrioritizedPortfolioItem {
  readonly decisionCaseId: DecisionCaseId;
  readonly rank: number;
  readonly score: number;
  readonly priority: PortfolioPriority;
  readonly reasons: ReadonlyArray<string>;
  readonly state: DecisionCaseState;
  readonly capability: DecisionCaseCapability;
  readonly artifactTypes: ReadonlyArray<DecisionCaseArtifactType>;
  readonly metadata: DecisionCaseMetadata;
}

export interface PrioritizedPortfolioSummary {
  readonly totalItems: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly topDecisionCaseId: DecisionCaseId | null;
}

export interface PrioritizeDecisionPortfolioInput {
  readonly portfolio: DecisionPortfolio;
  readonly generatedAt: PrioritizedPortfolioDateTime;
}
