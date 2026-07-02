import type {
  DecisionCaseArtifactType,
  DecisionCaseCapability,
  DecisionCaseDateTime,
  DecisionCaseId,
  DecisionCaseMetadata,
  DecisionCaseState,
} from "../decision-case";

export type DecisionPortfolioId = string;

export type DecisionPortfolioName = string;

export type DecisionPortfolioDateTime = string;

export type DecisionPortfolioCapability = DecisionCaseCapability | null;

export type DecisionPortfolioMetadata = Readonly<Record<string, unknown>>;

export type DecisionPortfolioCountMap = Readonly<Record<string, number>>;

export interface DecisionPortfolioCase {
  readonly decisionCaseId: DecisionCaseId;
  readonly capability: DecisionCaseCapability;
  readonly state: DecisionCaseState;
  readonly artifactTypes: ReadonlyArray<DecisionCaseArtifactType>;
  readonly createdAt: DecisionCaseDateTime;
  readonly metadata: DecisionCaseMetadata;
}

export interface DecisionPortfolioSummary {
  readonly totalCases: number;
  readonly casesByState: DecisionPortfolioCountMap;
  readonly casesByCapability: DecisionPortfolioCountMap;
  readonly casesWithActionPlan: number;
  readonly casesInMonitoring: number;
  readonly casesCompleted: number;
}
