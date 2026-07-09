import type { Recommendation, RecommendationOption } from "../recommendation";
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
const DEFAULT_PLAYBOOK_STEP_PRIORITY: PlaybookStepPriority = "medium";

// Epic 16.6A — generaliza buildPlaybooks: toda Recommendation agora
// produz um Playbook real, nunca null. Cash Protection continua com o
// template curado (steps/kpis/risks/successCriteria escritos por um
// humano); qualquer outro tipo cai no caminho genérico
// (buildGenericPlaybook), que nunca inventa dado que a Recommendation
// não tem — ver a regra de honestidade em
// packages/bdos-core/docs/ACTIONPLAN_MATERIALIZATION_BOUNDARY.md. A
// cadeia PRINCIPLE 006 (Decision -> Recommendation -> Playbook ->
// ActionPlan -> Action -> ExecutionTask -> EvidenceReference[])
// permanece intacta nos dois caminhos: todo Action ainda nasce de um
// PlaybookStep real, cash protection ou genérico.
export function buildPlaybooks(
  recommendations: BuildPlaybooksInput,
): BuildPlaybooksResult {
  return recommendations.map((recommendation) => buildPlaybook(recommendation));
}

function buildPlaybook(recommendation: Recommendation): Playbook {
  return isCashProtectionRecommendation(recommendation)
    ? buildCashProtectionPlaybook(recommendation)
    : buildGenericPlaybook(recommendation);
}

function buildCashProtectionPlaybook(recommendation: Recommendation): Playbook {
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

// Caminho genérico (Epic 16.6A) — 1 PlaybookStep por
// RecommendationOption, título/descrição vindos exatamente da option.
// kpis/risks/successCriteria ficam vazios de propósito: nada na
// Recommendation descreve isso hoje, e inventar seria quebrar a regra
// de honestidade. estimatedImpact/estimatedEffort de cada step ficam
// undefined pelo mesmo motivo (agora opcionais em PlaybookStep).
function buildGenericPlaybook(recommendation: Recommendation): Playbook {
  const priority = getPlaybookStepPriority(recommendation.metadata);

  return {
    id: `playbook:${recommendation.id}:generic`,
    name: recommendation.title,
    objective: recommendation.summary,
    description:
      "Plano de ação derivado diretamente das opções desta Recommendation — nenhum step, KPI, risco ou critério de sucesso foi inventado.",
    recommendationId: recommendation.id,
    steps: recommendation.options.map((option) => createGenericStep(recommendation.id, option, priority)),
    kpis: [],
    risks: [],
    successCriteria: [],
    metadata: {
      recommendationType: getStringMetadata(recommendation.metadata, "recommendationType"),
      decisionId: recommendation.traceability.decisionId,
      diagnosisId: recommendation.traceability.diagnosisId,
      capabilities: recommendation.traceability.capabilities,
      capability: recommendation.traceability.capabilities[0] ?? null,
      evidenceReferences: recommendation.traceability.evidenceReferences,
      businessFactIds: recommendation.traceability.businessFactIds,
    },
  };
}

function createGenericStep(
  recommendationId: string,
  option: RecommendationOption,
  priority: PlaybookStepPriority,
): PlaybookStep {
  return {
    id: `playbook:${recommendationId}:step:${option.id}`,
    title: option.title,
    description: option.description,
    priority,
  };
}

// Recommendation.metadata.decisionPriority já é gravado por
// recommendation-builder.ts (decisionPriority: decision.priority) em
// toda Recommendation real — propagado, nunca inventado. O fallback
// "medium" é só defensivo, para um dado malformado/ausente que não
// deveria acontecer com uma Recommendation construída pelo builder
// real, nunca um caminho de dado desenhado.
function getPlaybookStepPriority(metadata: Readonly<Record<string, unknown>>): PlaybookStepPriority {
  const value = metadata.decisionPriority;

  if (value === "critical" || value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return DEFAULT_PLAYBOOK_STEP_PRIORITY;
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
