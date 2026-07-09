import {
  DecisionCategory,
  DecisionImpact,
  DecisionPriority,
  DecisionStatus,
  type Decision,
} from "../domain/decision";
import type { Recommendation } from "../engines/decision/recommendation";
import type { EngineeringAdvisorContext } from "./advisor-context.types";
import type { EngineeringAdvisorHistoricalFacts } from "./advisor-historical-facts.types";
import type { EngineeringAdvisorSummary } from "./advisor-summary.types";
import { buildEngineeringAdvisorExplanations } from "./advisor-explanation-builder";

const decisionA: Decision = {
  id: "decision-1",
  tenantId: "tenant-1",
  organizationId: "organization-1",
  evidence: [
    {
      source: "kpi",
      sourceReference: "schedule-variance",
      description: "Atividade de fundação com atraso de 18 dias frente ao planejado.",
      metadata: {},
    },
  ],
  title: "Atraso crítico na fundação",
  summary: "A atividade de fundação está 18 dias atrasada frente ao planejado.",
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
};

const recommendationA: Recommendation = {
  id: "recommendation-1",
  decisionId: "decision-1",
  title: "Replanejar a atividade de fundação",
  summary: "Recomenda-se replanejar a atividade de fundação com a equipe de campo.",
  options: [],
  traceability: {
    decisionId: "decision-1",
    diagnosisId: null,
    capabilities: [],
    evidenceReferences: ["ref-1"],
    businessFactIds: ["fact-1"],
  },
  metadata: { decisionPriority: "critical" },
  createdAt: "2026-07-01T09:05:00.000Z",
};

const context: EngineeringAdvisorContext = {
  snapshot: {
    engineeringProjectId: "project-1",
    engineeringProjectName: "Projeto Alpha",
    computedAt: "2026-07-08T10:00:00.000Z",
    healthScore: 62,
    previousHealthScore: 78,
  },
  decisions: [decisionA],
  recommendations: [recommendationA],
  evidenceIndex: { "decision-1": decisionA.evidence },
  historySummary: "Health Score 78 → 62.",
};

function buildSummary(overrides: {
  decisionIds?: string[];
  recommendationIds?: string[];
  evidenceDecisionIds?: string[];
}): EngineeringAdvisorSummary {
  return {
    insights: [
      {
        title: "Atraso crítico na fundação",
        summary: "A atividade de fundação está atrasada; recomenda-se replanejamento.",
        priority: "critical",
        decisionIds: overrides.decisionIds ?? ["decision-1"],
        recommendationIds: overrides.recommendationIds ?? ["recommendation-1"],
        evidenceDecisionIds: overrides.evidenceDecisionIds ?? ["decision-1"],
      },
    ],
  };
}

const historicalFactsNewRecommendation: EngineeringAdvisorHistoricalFacts = {
  previousDecisions: [],
  recommendationOpenSinceImportCountByRefId: {},
};

const historicalFactsRecurringRecommendation: EngineeringAdvisorHistoricalFacts = {
  previousDecisions: [],
  recommendationOpenSinceImportCountByRefId: { "recommendation-1": 4 },
};

runTest("insight com todos os ids resolvíveis produz explanation completa, sem missingReferences", () => {
  const explanations = buildEngineeringAdvisorExplanations(
    buildSummary({}),
    context,
    historicalFactsNewRecommendation,
  );

  assertEqual(explanations.length, 1, "esperado 1 explanation");
  const [explanation] = explanations;
  assertEqual(explanation.insightTitle, "Atraso crítico na fundação", "título do insight preservado");
  assertEqual(explanation.decisions.length, 1, "esperado 1 decision resolvida");
  assertEqual(explanation.decisions[0]?.priority, DecisionPriority.Critical, "priority da decision preservada");
  assertEqual(explanation.recommendations.length, 1, "esperado 1 recommendation resolvida");
  assertEqual(explanation.evidence.length, 1, "esperado 1 evidência resolvida");
  assertEqual(explanation.evidence[0]?.decisionId, "decision-1", "evidência associada à decision correta");
  assertEqual(explanation.missingReferences.decisionIds.length, 0, "nenhuma decision ausente");
  assertEqual(explanation.missingReferences.recommendationIds.length, 0, "nenhuma recommendation ausente");
  assertEqual(explanation.missingReferences.evidenceDecisionIds.length, 0, "nenhuma evidência ausente");
});

runTest("recommendation nova (sem histórico) é isNew=true e recurring=false", () => {
  const [explanation] = buildEngineeringAdvisorExplanations(
    buildSummary({}),
    context,
    historicalFactsNewRecommendation,
  );

  assertEqual(explanation.recommendations[0]?.isNew, true, "esperado isNew=true");
  assertEqual(explanation.recommendations[0]?.recurring, false, "esperado recurring=false");
});

runTest("recommendation recorrente (4 importações) é isNew=false e recurring=true, mesma regra do Prompt Context", () => {
  const [explanation] = buildEngineeringAdvisorExplanations(
    buildSummary({}),
    context,
    historicalFactsRecurringRecommendation,
  );

  assertEqual(explanation.recommendations[0]?.isNew, false, "esperado isNew=false");
  assertEqual(explanation.recommendations[0]?.recurring, true, "esperado recurring=true (limiar >=3)");
});

runTest("decisionId inexistente vai para missingReferences.decisionIds, sem lançar exceção", () => {
  const [explanation] = buildEngineeringAdvisorExplanations(
    buildSummary({ decisionIds: ["decision-inexistente"] }),
    context,
    historicalFactsNewRecommendation,
  );

  assertEqual(explanation.decisions.length, 0, "nenhuma decision resolvida");
  assertEqual(explanation.missingReferences.decisionIds.length, 1, "esperado 1 decisionId ausente");
  assertEqual(explanation.missingReferences.decisionIds[0], "decision-inexistente", "id ausente registrado");
});

runTest("recommendationId inexistente vai para missingReferences.recommendationIds, sem lançar exceção", () => {
  const [explanation] = buildEngineeringAdvisorExplanations(
    buildSummary({ recommendationIds: ["recommendation-inexistente"] }),
    context,
    historicalFactsNewRecommendation,
  );

  assertEqual(explanation.recommendations.length, 0, "nenhuma recommendation resolvida");
  assertEqual(explanation.missingReferences.recommendationIds.length, 1, "esperado 1 recommendationId ausente");
});

runTest("evidenceDecisionId sem evidência no contexto vai para missingReferences.evidenceDecisionIds", () => {
  const [explanation] = buildEngineeringAdvisorExplanations(
    buildSummary({ evidenceDecisionIds: ["decision-sem-evidencia"] }),
    context,
    historicalFactsNewRecommendation,
  );

  assertEqual(explanation.evidence.length, 0, "nenhuma evidência resolvida");
  assertEqual(explanation.missingReferences.evidenceDecisionIds.length, 1, "esperado 1 evidenceDecisionId ausente");
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
