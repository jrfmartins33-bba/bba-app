import type { Recommendation } from "../recommendation";
import type {
  BuildPlaybooksInput,
  BuildPlaybooksResult,
  Playbook,
  PlaybookEstimatedEffort,
  PlaybookEstimatedImpact,
  PlaybookStep,
  PlaybookStepPriority,
} from "./playbook.types";

const cashProtectionRecommendationType = "cash_protection";

export function buildPlaybooks(
  recommendations: BuildPlaybooksInput,
): BuildPlaybooksResult {
  return recommendations.flatMap((recommendation) => {
    const playbook = buildPlaybook(recommendation);

    return playbook === null ? [] : [playbook];
  });
}

function buildPlaybook(recommendation: Recommendation): Playbook | null {
  if (!isCashProtectionRecommendation(recommendation)) {
    return null;
  }

  return {
    id: `playbook:${recommendation.id}:cash-protection`,
    name: "Cash Protection Playbook",
    objective: "Preserve cash while maintaining business continuity.",
    description:
      "Structured business playbook for responding to a cash protection recommendation.",
    recommendationId: recommendation.id,
    steps: buildCashProtectionSteps(recommendation.id),
    kpis: [
      "Projected Cash",
      "Cash Balance",
      "Burn Rate",
      "DSO",
      "Accounts Receivable",
      "Accounts Payable",
    ],
    risks: [
      "Supplier dissatisfaction",
      "Operational slowdown",
      "Customer churn",
      "Reduced growth",
    ],
    successCriteria: [
      "Positive projected cash",
      "Positive operating cash flow",
      "Payroll paid on time",
      "Taxes paid on time",
      "Minimum cash reserve maintained",
    ],
    metadata: {
      recommendationType: cashProtectionRecommendationType,
      decisionId: recommendation.traceability.decisionId,
      diagnosisId: recommendation.traceability.diagnosisId,
      capabilities: recommendation.traceability.capabilities,
      capability: recommendation.traceability.capabilities[0] ?? null,
      evidenceReferences: recommendation.traceability.evidenceReferences,
      businessFactIds: recommendation.traceability.businessFactIds,
    },
  };
}

function isCashProtectionRecommendation(
  recommendation: Recommendation,
): boolean {
  return (
    getStringMetadata(recommendation.metadata, "recommendationType") ===
    cashProtectionRecommendationType
  );
}

function buildCashProtectionSteps(
  recommendationId: string,
): ReadonlyArray<PlaybookStep> {
  return [
    createStep(
      recommendationId,
      "suspend_discretionary_spending",
      "Suspend discretionary spending",
      "Pause discretionary spending that does not directly protect business continuity.",
      "critical",
      "high",
      "medium",
    ),
    createStep(
      recommendationId,
      "accelerate_receivables",
      "Accelerate receivables",
      "Prioritize collection actions and payment acceleration with customers.",
      "high",
      "high",
      "medium",
    ),
    createStep(
      recommendationId,
      "renegotiate_supplier_payment_terms",
      "Renegotiate supplier payment terms",
      "Negotiate payment extensions or revised terms with strategic suppliers.",
      "high",
      "medium",
      "medium",
    ),
    createStep(
      recommendationId,
      "review_operating_expenses",
      "Review operating expenses",
      "Review operating expenses and identify reductions that preserve core operations.",
      "medium",
      "medium",
      "medium",
    ),
    createStep(
      recommendationId,
      "monitor_daily_cash_position",
      "Monitor daily cash position",
      "Track daily cash position until cash risk is stabilized.",
      "high",
      "medium",
      "low",
    ),
  ];
}

function createStep(
  recommendationId: string,
  type: string,
  title: string,
  description: string,
  priority: PlaybookStepPriority,
  estimatedImpact: PlaybookEstimatedImpact,
  estimatedEffort: PlaybookEstimatedEffort,
): PlaybookStep {
  return {
    id: `playbook:${recommendationId}:step:${type}`,
    title,
    description,
    priority,
    estimatedImpact,
    estimatedEffort,
  };
}

function getStringMetadata(
  metadata: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = metadata[key];

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
