import type {
  DecisionPortfolioId,
  PortfolioPriority,
} from "../decision-portfolio";
import type { ExecutiveInsight, InsightItem } from "../executive-insight";
import type {
  AgendaItem,
  CreateExecutiveBriefInput,
  ExecutiveBriefConfidence,
  ExecutiveBriefDateTime,
  ExecutiveBriefId,
  ExecutiveBriefMetadata,
  Explanation,
  TopDecision,
} from "./executive-brief.types";

export interface ExecutiveBrief {
  readonly id: ExecutiveBriefId;
  readonly portfolioId: DecisionPortfolioId;
  readonly generatedAt: ExecutiveBriefDateTime;
  readonly headline: string;
  readonly executiveSummary: string;
  readonly topDecisions: ReadonlyArray<TopDecision>;
  readonly executiveAgenda: ReadonlyArray<AgendaItem>;
  readonly confidence: ExecutiveBriefConfidence;
  readonly explanations: ReadonlyArray<Explanation>;
  readonly metadata: ExecutiveBriefMetadata;
}

export function createExecutiveBrief(
  input: CreateExecutiveBriefInput,
): ExecutiveBrief {
  const topDecisions = selectDecisionInsightItems(input.executiveInsight)
    .map(toTopDecision)
    .filter(isTopDecision)
    .slice(0, 3);
  const headline = createHeadline(input.executiveInsight);

  return {
    id: input.id,
    portfolioId: input.executiveInsight.portfolioId,
    generatedAt: input.generatedAt,
    headline,
    executiveSummary: createExecutiveSummary(input.executiveInsight, topDecisions),
    topDecisions,
    executiveAgenda: createExecutiveAgenda(topDecisions),
    confidence: input.executiveInsight.confidence,
    explanations: createExplanations(headline, input.executiveInsight, topDecisions),
    metadata: input.executiveInsight.metadata,
  };
}

function createHeadline(insight: ExecutiveInsight): string {
  const totalRisks = insight.topRisks.length;
  const totalAttentionPoints = insight.attentionPoints.length;
  const totalSupportingCases = uniqueDecisionCaseIds(insight.evidence).length;

  if (totalSupportingCases === 0) {
    return "No executive insights available.";
  }

  if (totalRisks > 0) {
    return `Executive attention required: ${totalRisks} ${pluralize(
      "risk",
      totalRisks,
    )} across ${totalSupportingCases} ${pluralize(
      "supporting decision case",
      totalSupportingCases,
    )}.`;
  }

  if (totalAttentionPoints > 0) {
    return `Executive focus required: ${totalAttentionPoints} ${pluralize(
      "attention point",
      totalAttentionPoints,
    )} across ${totalSupportingCases} ${pluralize(
      "supporting decision case",
      totalSupportingCases,
    )}.`;
  }

  return `Executive portfolio shows ${totalSupportingCases} ${pluralize(
    "supporting decision case",
    totalSupportingCases,
  )}.`;
}

function createExecutiveSummary(
  insight: ExecutiveInsight,
  topDecisions: ReadonlyArray<TopDecision>,
): string {
  const supportingCases = uniqueDecisionCaseIds(insight.evidence);

  if (supportingCases.length === 0) {
    return "No executive insights were extracted. The brief has no agenda items, no top decisions, and confidence is 0 because no supporting decision cases are available.";
  }

  const topDecision = topDecisions[0];
  const topDecisionSummary =
    topDecision === undefined
      ? "No top decision is available."
      : `The leading case is ${topDecision.decisionCaseId} with ${topDecision.priority} priority and score ${topDecision.score}.`;

  return `The executive insight identifies ${insight.topRisks.length} risks, ${insight.topOpportunities.length} opportunities, ${insight.attentionPoints.length} attention points, ${insight.positiveSignals.length} positive signals, and ${insight.negativeSignals.length} negative signals across ${supportingCases.length} supporting decision cases. ${topDecisionSummary} Confidence is ${insight.confidence}, with traceability preserved through insight evidence.`;
}

function selectDecisionInsightItems(
  insight: ExecutiveInsight,
): ReadonlyArray<InsightItem> {
  return uniqueInsightItems([
    ...insight.topRisks,
    ...insight.attentionPoints,
    ...insight.topOpportunities,
    ...insight.positiveSignals,
  ]);
}

function uniqueInsightItems(
  items: ReadonlyArray<InsightItem>,
): ReadonlyArray<InsightItem> {
  const selectedItems: InsightItem[] = [];
  const selectedDecisionCases: string[] = [];

  items.forEach((item) => {
    const decisionCaseId = item.supportingDecisionCases[0];

    if (
      decisionCaseId !== undefined &&
      !selectedDecisionCases.includes(decisionCaseId)
    ) {
      selectedDecisionCases.push(decisionCaseId);
      selectedItems.push(item);
    }
  });

  return selectedItems;
}

function toTopDecision(item: InsightItem): TopDecision | null {
  const decisionCaseId = item.supportingDecisionCases[0];

  if (decisionCaseId === undefined) {
    return null;
  }

  return {
    decisionCaseId,
    title: item.title,
    priority: item.priority,
    score: item.score,
    reason: item.description,
    recommendedAction: recommendedActionForPriority(item.priority),
  };
}

function isTopDecision(value: TopDecision | null): value is TopDecision {
  return value !== null;
}

function recommendedActionForPriority(priority: PortfolioPriority): string {
  if (priority === "critical") {
    return "Address immediately with executive ownership.";
  }

  if (priority === "high") {
    return "Prioritize in the next executive review.";
  }

  if (priority === "medium") {
    return "Assign ownership and monitor progress.";
  }

  return "Track through routine portfolio monitoring.";
}

function createExecutiveAgenda(
  topDecisions: ReadonlyArray<TopDecision>,
): ReadonlyArray<AgendaItem> {
  return topDecisions.map((decision, index) => ({
    sequence: index + 1,
    title: `Review ${decision.title}`,
    description: `${decision.recommendedAction} Priority: ${decision.priority}; score: ${decision.score}.`,
  }));
}

function createExplanations(
  headline: string,
  insight: ExecutiveInsight,
  topDecisions: ReadonlyArray<TopDecision>,
): ReadonlyArray<Explanation> {
  const headlineExplanation: Explanation = {
    statement: headline,
    supportingDecisionCases: uniqueDecisionCaseIds(insight.evidence),
    supportingArtifacts: uniqueArtifactTypes(insight.evidence),
  };

  const recommendationExplanations = topDecisions.map((decision) => {
    const evidence = insight.evidence.find((candidate) =>
      candidate.supportingDecisionCases.includes(decision.decisionCaseId),
    );

    return {
      statement: decision.recommendedAction,
      supportingDecisionCases: evidence?.supportingDecisionCases ?? [
        decision.decisionCaseId,
      ],
      supportingArtifacts: evidence?.supportingArtifacts ?? [],
    };
  });

  return [headlineExplanation, ...recommendationExplanations];
}

function uniqueArtifactTypes(
  evidence: ExecutiveInsight["evidence"],
): Explanation["supportingArtifacts"] {
  const artifactTypes: Explanation["supportingArtifacts"][number][] = [];

  evidence.forEach((item) => {
    item.supportingArtifacts.forEach((artifactType) => {
      if (!artifactTypes.includes(artifactType)) {
        artifactTypes.push(artifactType);
      }
    });
  });

  return artifactTypes;
}

function uniqueDecisionCaseIds(
  evidence: ExecutiveInsight["evidence"],
): Explanation["supportingDecisionCases"] {
  const decisionCaseIds: Explanation["supportingDecisionCases"][number][] = [];

  evidence.forEach((item) => {
    item.supportingDecisionCases.forEach((decisionCaseId) => {
      if (!decisionCaseIds.includes(decisionCaseId)) {
        decisionCaseIds.push(decisionCaseId);
      }
    });
  });

  return decisionCaseIds;
}

function pluralize(label: string, count: number): string {
  return count === 1 ? label : `${label}s`;
}
