import type {
  DecisionCaseArtifactType,
  DecisionCaseId,
} from "../decision-case";
import type {
  DecisionPortfolioId,
  PortfolioPriority,
  PrioritizedPortfolio,
  PrioritizedPortfolioDateTime,
} from "../decision-portfolio";

export type ExecutiveInsightId = string;

export type ExecutiveInsightDateTime = PrioritizedPortfolioDateTime;

export type ExecutiveInsightConfidence = number;

export type ExecutiveInsightMetadata = Readonly<Record<string, unknown>>;

export interface InsightItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priority: PortfolioPriority;
  readonly score: number;
  readonly supportingDecisionCases: ReadonlyArray<DecisionCaseId>;
  readonly supportingArtifacts: ReadonlyArray<DecisionCaseArtifactType>;
  readonly metadata: ExecutiveInsightMetadata;
}

export interface ExecutiveInsightEvidence {
  readonly statement: string;
  readonly supportingDecisionCases: ReadonlyArray<DecisionCaseId>;
  readonly supportingArtifacts: ReadonlyArray<DecisionCaseArtifactType>;
}

export interface CreateExecutiveInsightInput {
  readonly prioritizedPortfolio: PrioritizedPortfolio;
  readonly id: ExecutiveInsightId;
  readonly generatedAt: ExecutiveInsightDateTime;
}

export interface ExecutiveInsightShape {
  readonly id: ExecutiveInsightId;
  readonly portfolioId: DecisionPortfolioId;
  readonly generatedAt: ExecutiveInsightDateTime;
  readonly topRisks: ReadonlyArray<InsightItem>;
  readonly topOpportunities: ReadonlyArray<InsightItem>;
  readonly attentionPoints: ReadonlyArray<InsightItem>;
  readonly positiveSignals: ReadonlyArray<InsightItem>;
  readonly negativeSignals: ReadonlyArray<InsightItem>;
  readonly confidence: ExecutiveInsightConfidence;
  readonly evidence: ReadonlyArray<ExecutiveInsightEvidence>;
  readonly metadata: ExecutiveInsightMetadata;
}
