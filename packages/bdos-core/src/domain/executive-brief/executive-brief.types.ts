import type {
  DecisionCaseArtifactType,
  DecisionCaseId,
} from "../decision-case";
import type {
  ExecutiveInsight,
  ExecutiveInsightConfidence,
  ExecutiveInsightDateTime,
} from "../executive-insight";
import type {
  PortfolioPriority,
} from "../decision-portfolio";

export type ExecutiveBriefId = string;

export type ExecutiveBriefDateTime = ExecutiveInsightDateTime;

export type ExecutiveBriefText = string;

export type ExecutiveBriefConfidence = ExecutiveInsightConfidence;

export type ExecutiveBriefMetadata = Readonly<Record<string, unknown>>;

export interface TopDecision {
  readonly decisionCaseId: DecisionCaseId;
  readonly title: ExecutiveBriefText;
  readonly priority: PortfolioPriority;
  readonly score: number;
  readonly reason: ExecutiveBriefText;
  readonly recommendedAction: ExecutiveBriefText;
}

export interface AgendaItem {
  readonly sequence: number;
  readonly title: ExecutiveBriefText;
  readonly description: ExecutiveBriefText;
}

export interface Explanation {
  readonly statement: ExecutiveBriefText;
  readonly supportingDecisionCases: ReadonlyArray<DecisionCaseId>;
  readonly supportingArtifacts: ReadonlyArray<DecisionCaseArtifactType>;
}

export interface CreateExecutiveBriefInput {
  readonly executiveInsight: ExecutiveInsight;
  readonly id: ExecutiveBriefId;
  readonly generatedAt: ExecutiveBriefDateTime;
}
