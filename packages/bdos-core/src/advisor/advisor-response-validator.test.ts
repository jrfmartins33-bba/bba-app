import {
  DecisionCategory,
  DecisionImpact,
  DecisionPriority,
  DecisionStatus,
  type Decision,
} from "../domain/decision";
import type { Recommendation } from "../engines/decision/recommendation";
import type { EngineeringAdvisorContext } from "./advisor-context.types";
import { validateEngineeringAdvisorSummary } from "./advisor-response-validator";

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

function validInsight(): Record<string, unknown> {
  return {
    title: "Atraso crítico na fundação",
    summary: "A atividade de fundação está 18 dias atrasada; recomenda-se replanejamento imediato.",
    priority: "critical",
    decisionIds: ["decision-1"],
    recommendationIds: ["recommendation-1"],
    evidenceDecisionIds: ["decision-1"],
  };
}

runTest("resposta válida é aceita", () => {
  const result = validateEngineeringAdvisorSummary({ insights: [validInsight()] }, context);
  assertEqual(result.valid, true, "esperado válido");
});

runTest("recommendation inexistente é rejeitada", () => {
  const result = validateEngineeringAdvisorSummary(
    { insights: [{ ...validInsight(), recommendationIds: ["recommendation-inexistente"] }] },
    context,
  );
  assertEqual(result.valid, false, "esperado inválido");
});

runTest("recommendation fora do Candidate Set é rejeitada", () => {
  // "recommendation-2" nunca aparece em context.recommendations — o
  // Candidate Set já veio recortado pelo AdvisorContextBuilder (Sprint
  // 14.1). Mesmo que essa recommendation exista em outro lugar do
  // sistema, para o Validator ela é indistinguível de uma inexistente.
  const result = validateEngineeringAdvisorSummary(
    { insights: [{ ...validInsight(), recommendationIds: ["recommendation-2"] }] },
    context,
  );
  assertEqual(result.valid, false, "esperado inválido");
});

runTest("decision inexistente é rejeitada", () => {
  const result = validateEngineeringAdvisorSummary(
    {
      insights: [
        { ...validInsight(), decisionIds: ["decision-outside"], evidenceDecisionIds: ["decision-outside"] },
      ],
    },
    context,
  );
  assertEqual(result.valid, false, "esperado inválido");
});

runTest("schema inválido é rejeitado", () => {
  const result = validateEngineeringAdvisorSummary({ insights: [{ title: "Só título, sem o resto" }] }, context);
  assertEqual(result.valid, false, "esperado inválido");
});

runTest("insight sem decisionIds é rejeitado (nenhuma afirmação sem Decision relacionada)", () => {
  const result = validateEngineeringAdvisorSummary(
    { insights: [{ ...validInsight(), decisionIds: [] }] },
    context,
  );
  assertEqual(result.valid, false, "esperado inválido");
});

runTest("insight sem evidenceDecisionIds é rejeitado (nenhuma afirmação sem evidência)", () => {
  const result = validateEngineeringAdvisorSummary(
    { insights: [{ ...validInsight(), evidenceDecisionIds: [] }] },
    context,
  );
  assertEqual(result.valid, false, "esperado inválido");
});

runTest("qualquer validação inválida sinaliza fallback com motivo (contrato que route.ts usa para não persistir)", () => {
  const result = validateEngineeringAdvisorSummary({ insights: "not-an-array" }, context);
  assertEqual(result.valid, false, "esperado inválido");
  if (!result.valid) {
    assertEqual(typeof result.reason, "string", "reason deve ser string para logging/diagnóstico");
    assertEqual(result.reason.length > 0, true, "reason não pode ser vazio");
  }
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
