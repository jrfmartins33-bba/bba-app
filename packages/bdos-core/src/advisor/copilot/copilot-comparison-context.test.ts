import {
  DecisionCategory,
  DecisionImpact,
  DecisionPriority,
  DecisionStatus,
  type Decision
} from "../../domain/decision";
import type { Recommendation } from "../../engines/decision/recommendation";
import type { EngineeringAdvisorContext } from "../advisor-context.types";
import type { EngineeringAdvisorPromptContext } from "../advisor-prompt-context.types";
import { findSingleRecommendationForDecision, withComparisonOptions } from "./copilot-comparison-context";

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "decision-1",
    tenantId: "tenant-1",
    organizationId: "organization-1",
    evidence: [],
    title: "Atraso crítico na fundação",
    summary: "",
    status: DecisionStatus.Proposed,
    priority: DecisionPriority.Critical,
    category: DecisionCategory.Operational,
    impact: DecisionImpact.High,
    confidence: 92,
    owner: "",
    dueDate: null,
    expectedBenefit: { description: "", metadata: {} },
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-07-01T09:00:00.000Z",
    resolvedAt: null,
    metadata: {},
    ...overrides
  };
}

function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: "recommendation-1",
    decisionId: "decision-1",
    title: "Replanejar a fundação",
    summary: "",
    options: [],
    traceability: { decisionId: "decision-1", diagnosisId: null, capabilities: [], evidenceReferences: [], businessFactIds: [] },
    metadata: {},
    createdAt: "2026-07-01T09:05:00.000Z",
    ...overrides
  };
}

function context(overrides: Partial<EngineeringAdvisorContext> = {}): EngineeringAdvisorContext {
  return {
    snapshot: {
      engineeringProjectId: "project-1",
      engineeringProjectName: "Projeto Alpha",
      computedAt: "2026-07-08T10:00:00.000Z",
      healthScore: 62,
      previousHealthScore: 78
    },
    decisions: [],
    recommendations: [],
    evidenceIndex: {},
    historySummary: "",
    ...overrides
  };
}

const promptContext: EngineeringAdvisorPromptContext = {
  snapshot: {
    engineeringProjectId: "project-1",
    engineeringProjectName: "Projeto Alpha",
    computedAt: "2026-07-08T10:00:00.000Z",
    healthScore: 62,
    previousHealthScore: 78
  },
  history: { previousHealthScore: 78, healthScoreDirection: "down", historySummary: "" },
  decisions: [],
  recommendations: [],
  evidence: {}
};

runTest("withComparisonOptions popula comparisonOptions com as options reais da Recommendation-alvo", () => {
  const recommendationWithOptions = recommendation({
    options: [
      { id: "option-1", type: "reduce_discretionary_spending", title: "Reduzir gasto discricionário", description: "Corta despesas não essenciais." },
      { id: "option-2", type: "renegotiate_payment_terms", title: "Renegociar prazos", description: "Estende o prazo de pagamento com fornecedores." }
    ]
  });
  const ctx = context({ recommendations: [recommendationWithOptions] });

  const result = withComparisonOptions(promptContext, ctx, "recommendation-1");

  assertEqual(result.comparisonOptions?.length, 2, "deve conter as 2 options reais da Recommendation");
  assertEqual(result.comparisonOptions?.[0]?.title, "Reduzir gasto discricionário", "títulos devem vir exatamente da Recommendation.options, sem invenção");
});

runTest("withComparisonOptions não muta o promptContext original", () => {
  const recommendationWithOptions = recommendation({
    options: [{ id: "option-1", type: "reduce_discretionary_spending", title: "Reduzir gasto", description: "" }]
  });
  const ctx = context({ recommendations: [recommendationWithOptions] });

  withComparisonOptions(promptContext, ctx, "recommendation-1");

  assertEqual(promptContext.comparisonOptions, undefined, "o objeto original passado não deve ganhar o campo — withComparisonOptions devolve um novo objeto");
});

runTest("withComparisonOptions devolve o promptContext inalterado quando a Recommendation não existe mais no contexto", () => {
  const ctx = context({ recommendations: [] });
  const result = withComparisonOptions(promptContext, ctx, "recommendation-inexistente");

  assertEqual(result.comparisonOptions, undefined, "sem Recommendation real para citar, nunca inventa comparisonOptions");
});

runTest("withComparisonOptions devolve o promptContext inalterado quando a Recommendation não tem nenhuma option cadastrada", () => {
  const ctx = context({ recommendations: [recommendation({ options: [] })] });
  const result = withComparisonOptions(promptContext, ctx, "recommendation-1");

  assertEqual(result.comparisonOptions, undefined, "Recommendation sem options não deve produzir uma comparação vazia");
});

runTest("findSingleRecommendationForDecision resolve quando a Decision tem exatamente 1 Recommendation", () => {
  const ctx = context({ decisions: [decision()], recommendations: [recommendation({ id: "recommendation-1", decisionId: "decision-1" })] });
  assertEqual(findSingleRecommendationForDecision(ctx, "decision-1"), "recommendation-1", "deve resolver a única Recommendation associada");
});

runTest("findSingleRecommendationForDecision retorna null quando a Decision tem 0 Recommendations", () => {
  const ctx = context({ decisions: [decision()], recommendations: [] });
  assertEqual(findSingleRecommendationForDecision(ctx, "decision-1"), null, "sem Recommendation associada, não há alvo de comparação");
});

runTest("findSingleRecommendationForDecision retorna null quando a Decision tem 2+ Recommendations (ambíguo)", () => {
  const ctx = context({
    decisions: [decision()],
    recommendations: [
      recommendation({ id: "recommendation-1", decisionId: "decision-1" }),
      recommendation({ id: "recommendation-2", decisionId: "decision-1" })
    ]
  });
  assertEqual(findSingleRecommendationForDecision(ctx, "decision-1"), null, "2+ Recommendations para a mesma Decision é ambíguo — nunca escolhe uma arbitrariamente");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
