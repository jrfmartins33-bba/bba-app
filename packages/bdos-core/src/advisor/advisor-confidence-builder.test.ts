import type { EngineeringAdvisorExplanation } from "./advisor-explanation.types";
import type { EngineeringAdvisorHistoricalFacts } from "./advisor-historical-facts.types";
import type { EngineeringAdvisorValidationResult } from "./advisor-response-validator";
import { buildEngineeringAdvisorConfidence } from "./advisor-confidence-builder";

const validSummary: EngineeringAdvisorValidationResult = {
  valid: true,
  summary: { insights: [] },
};

const invalidSummary: EngineeringAdvisorValidationResult = {
  valid: false,
  reason: 'insights[0] cita Recommendation fora do Candidate Set: "recommendation-2".',
};

const historyWithPrevious: EngineeringAdvisorHistoricalFacts = {
  previousDecisions: [{ id: "decision-1", priority: "high" }],
  recommendationOpenSinceImportCountByRefId: {},
};

const historyWithoutPrevious: EngineeringAdvisorHistoricalFacts = {
  previousDecisions: [],
  recommendationOpenSinceImportCountByRefId: {},
};

const fullyExplainedInsight: EngineeringAdvisorExplanation = {
  insightTitle: "Atraso crítico na fundação",
  decisions: [{ id: "decision-1", title: "Atraso crítico na fundação", priority: "critical" }],
  recommendations: [{ id: "recommendation-1", title: "Replanejar a fundação", isNew: true, recurring: false }],
  evidence: [{ decisionId: "decision-1", source: "kpi", description: "Atraso de 18 dias." }],
  missingReferences: { decisionIds: [], recommendationIds: [], evidenceDecisionIds: [] },
};

const partiallyExplainedInsight: EngineeringAdvisorExplanation = {
  insightTitle: "Recomendação recorrente",
  decisions: [{ id: "decision-2", title: "Risco de retrabalho", priority: "high" }],
  recommendations: [],
  evidence: [{ decisionId: "decision-2", source: "kpi", description: "3 importações em aberto." }],
  missingReferences: { decisionIds: [], recommendationIds: ["recommendation-inexistente"], evidenceDecisionIds: [] },
};

runTest("todos os insights totalmente explicáveis produz overall=high", () => {
  const confidence = buildEngineeringAdvisorConfidence(
    validSummary,
    [fullyExplainedInsight],
    historyWithPrevious,
  );

  assertEqual(confidence.overall, "high", "esperado high");
  assertEqual(confidence.metrics.insightCount, 1, "1 insight");
  assertEqual(confidence.metrics.explainedInsightCount, 1, "1 insight totalmente explicado");
  assertEqual(confidence.metrics.missingReferenceCount, 0, "nenhuma referência ausente");
  assertEqual(confidence.metrics.traceabilityCoverage, 1, "cobertura total = 1");
  assertEqual(confidence.metrics.evidenceCoverage, 1, "cobertura de evidência = 1");
  assertEqual(confidence.metrics.recommendationCoverage, 1, "cobertura de recommendation = 1");
  assertTrue(confidence.reasons.includes("validator_passed"), "reasons inclui validator_passed");
  assertTrue(confidence.reasons.includes("history_available"), "reasons inclui history_available");
  assertTrue(confidence.reasons.includes("all_decisions_traceable"), "reasons inclui all_decisions_traceable");
  assertTrue(
    confidence.reasons.includes("all_recommendations_traceable"),
    "reasons inclui all_recommendations_traceable",
  );
  assertTrue(confidence.reasons.includes("evidence_complete"), "reasons inclui evidence_complete");
});

runTest("insight com referência ausente produz overall=medium e conta explainedInsightCount corretamente", () => {
  const confidence = buildEngineeringAdvisorConfidence(
    validSummary,
    [fullyExplainedInsight, partiallyExplainedInsight],
    historyWithoutPrevious,
  );

  assertEqual(confidence.overall, "medium", "esperado medium");
  assertEqual(confidence.metrics.insightCount, 2, "2 insights");
  assertEqual(confidence.metrics.explainedInsightCount, 1, "só 1 dos 2 é totalmente explicado");
  assertEqual(confidence.metrics.missingReferenceCount, 1, "1 referência ausente no total");
  assertTrue(confidence.reasons.includes("history_unavailable"), "reasons inclui history_unavailable");
  assertTrue(
    confidence.reasons.includes("some_recommendations_untraceable"),
    "reasons inclui some_recommendations_untraceable",
  );
});

runTest("validação reprovada produz overall=low e insightCount=0, sem lançar exceção", () => {
  const confidence = buildEngineeringAdvisorConfidence(invalidSummary, null, historyWithPrevious);

  assertEqual(confidence.overall, "low", "esperado low");
  assertEqual(confidence.metrics.insightCount, 0, "insightCount deve ser 0");
  assertEqual(confidence.metrics.explainedInsightCount, 0, "explainedInsightCount deve ser 0");
  assertTrue(confidence.reasons.includes("validator_failed"), "reasons inclui validator_failed");
});

runTest("insights: [] produz overall=high (vacuamente completo) com insightCount=0", () => {
  const confidence = buildEngineeringAdvisorConfidence(validSummary, [], historyWithPrevious);

  assertEqual(confidence.overall, "high", "esperado high mesmo sem insights (nenhuma afirmação quebrada)");
  assertEqual(confidence.metrics.insightCount, 0, "insightCount deve ser 0 — UI deve mostrar isso ao lado de overall");
  assertEqual(confidence.metrics.traceabilityCoverage, 1, "cobertura vacuamente 1 sem citações");
  assertEqual(confidence.metrics.missingReferenceCount, 0, "nenhuma referência ausente possível sem insights");
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

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}
