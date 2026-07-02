import { DecisionCaseState } from "../decision-case";
import type {
  PrioritizedPortfolio,
  PrioritizedPortfolioItem,
} from "../decision-portfolio";
import type {
  CreateExecutiveInsightInput,
  ExecutiveInsightConfidence,
  ExecutiveInsightEvidence,
  ExecutiveInsightMetadata,
  ExecutiveInsightShape,
  InsightItem,
} from "./executive-insight.types";

export interface ExecutiveInsight extends ExecutiveInsightShape {}

export function createExecutiveInsight(
  input: CreateExecutiveInsightInput,
): ExecutiveInsight {
  const topRisks = input.prioritizedPortfolio.items
    .filter(isCriticalOrHigh)
    .map((item) => toInsightItem(input.id, "risk", item));
  const attentionPoints = input.prioritizedPortfolio.items
    .filter((item) => item.priority === "medium")
    .map((item) => toInsightItem(input.id, "attention", item));
  const positiveSignals = input.prioritizedPortfolio.items
    .filter(isPositiveSignal)
    .map((item) => toInsightItem(input.id, "positive", item));
  const topOpportunities = input.prioritizedPortfolio.items
    .filter(hasOpportunity)
    .map((item) => toInsightItem(input.id, "opportunity", item));
  const negativeSignals = input.prioritizedPortfolio.items
    .filter(isCriticalOrHigh)
    .map((item) => toInsightItem(input.id, "negative", item));
  const allInsightItems = [
    ...topRisks,
    ...topOpportunities,
    ...attentionPoints,
    ...positiveSignals,
    ...negativeSignals,
  ];

  return {
    id: input.id,
    portfolioId: input.prioritizedPortfolio.portfolioId,
    generatedAt: input.generatedAt,
    topRisks,
    topOpportunities,
    attentionPoints,
    positiveSignals,
    negativeSignals,
    confidence: calculateConfidence(input.prioritizedPortfolio),
    evidence: allInsightItems.map(toEvidence),
    metadata: input.prioritizedPortfolio.metadata,
  };
}

function isCriticalOrHigh(item: PrioritizedPortfolioItem): boolean {
  return item.priority === "critical" || item.priority === "high";
}

function isPositiveSignal(item: PrioritizedPortfolioItem): boolean {
  return (
    item.priority === "low" &&
    (item.state === DecisionCaseState.Completed ||
      item.state === DecisionCaseState.Archived)
  );
}

function hasOpportunity(item: PrioritizedPortfolioItem): boolean {
  return item.metadata["opportunity"] !== undefined;
}

function toInsightItem(
  insightId: string,
  category: "risk" | "opportunity" | "attention" | "positive" | "negative",
  item: PrioritizedPortfolioItem,
): InsightItem {
  return {
    id: `${insightId}:${category}:${item.decisionCaseId}`,
    title: createInsightTitle(category, item),
    description: createInsightDescription(category, item),
    priority: item.priority,
    score: item.score,
    supportingDecisionCases: [item.decisionCaseId],
    supportingArtifacts: item.artifactTypes,
    metadata: item.metadata,
  };
}

function createInsightTitle(
  category: "risk" | "opportunity" | "attention" | "positive" | "negative",
  item: PrioritizedPortfolioItem,
): string {
  const metadataTitle = readMetadataString(item.metadata, "title");
  const opportunity = readMetadataString(item.metadata, "opportunity");

  if (category === "opportunity" && opportunity !== null) {
    return opportunity;
  }

  if (metadataTitle !== null) {
    return metadataTitle;
  }

  if (category === "positive") {
    return `Positive signal from decision case ${item.decisionCaseId}`;
  }

  if (category === "attention") {
    return `Attention point from decision case ${item.decisionCaseId}`;
  }

  return `Executive risk from decision case ${item.decisionCaseId}`;
}

function createInsightDescription(
  category: "risk" | "opportunity" | "attention" | "positive" | "negative",
  item: PrioritizedPortfolioItem,
): string {
  const reason = item.reasons.join("; ");

  if (category === "opportunity") {
    return `Opportunity identified from prioritized case ${item.decisionCaseId} with score ${item.score}.`;
  }

  if (category === "positive") {
    return `Completed or archived low-score case ${item.decisionCaseId} indicates a positive portfolio signal.`;
  }

  if (category === "attention") {
    return `Medium-priority case ${item.decisionCaseId} requires executive attention. Evidence: ${reason}.`;
  }

  if (category === "negative") {
    return `Critical or high-priority case ${item.decisionCaseId} contributes a negative portfolio signal. Evidence: ${reason}.`;
  }

  return `Critical or high-priority case ${item.decisionCaseId} requires executive review. Evidence: ${reason}.`;
}

function readMetadataString(
  metadata: ExecutiveInsightMetadata,
  key: string,
): string | null {
  const value = metadata[key];

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function toEvidence(item: InsightItem): ExecutiveInsightEvidence {
  return {
    statement: item.description,
    supportingDecisionCases: item.supportingDecisionCases,
    supportingArtifacts: item.supportingArtifacts,
  };
}

function calculateConfidence(
  portfolio: PrioritizedPortfolio,
): ExecutiveInsightConfidence {
  if (portfolio.items.length === 0) {
    return 0;
  }

  const totalCompleteness = portfolio.items.reduce(
    (total, item) => total + calculateItemCompleteness(item),
    0,
  );

  return Math.round(totalCompleteness / portfolio.items.length);
}

function calculateItemCompleteness(item: PrioritizedPortfolioItem): number {
  let completeness = 0;

  if (item.decisionCaseId.trim().length > 0) {
    completeness += 20;
  }

  if (item.state.length > 0) {
    completeness += 20;
  }

  if (item.capability.trim().length > 0) {
    completeness += 20;
  }

  if (item.priority.length > 0) {
    completeness += 15;
  }

  if (item.reasons.length > 0) {
    completeness += 15;
  }

  if (item.artifactTypes.length > 0) {
    completeness += 10;
  }

  return completeness;
}
