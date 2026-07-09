import type { Recommendation } from "../../engines/decision/recommendation";
import type { EngineeringAdvisorContext } from "../advisor-context.types";
import type { EngineeringAdvisorHistoricalFacts } from "../advisor-historical-facts.types";
import { resolveCopilotApprovalTurn } from "./copilot-approval-orchestrator";

// Epic 16.7 — Workflow Handoff Approval Point
// (COPILOT_WORKFLOW_HANDOFF.md). Fixtures no mesmo formato de
// copilot-comparison-context.test.ts / execution-management-service.test.ts
// — Recommendation real (engines/decision), nunca a versão empobrecida
// de EngineeringAdvisorPromptContext.

function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: "recommendation-1",
    decisionId: "decision-1",
    title: "Regularizar geometria espacial do Bloco 3",
    summary: "A geometria do Bloco 3 precisa ser regularizada antes da próxima medição.",
    options: [
      {
        id: "recommendation-1:option:regularize_spatial_geometry",
        type: "regularize_spatial_geometry",
        title: "Regularizar geometria espacial",
        description: "Corrigir a geometria do SpatialObject associado ao Bloco 3."
      },
      {
        id: "recommendation-1:option:attach_spatial_evidence",
        type: "attach_spatial_evidence",
        title: "Anexar evidência espacial",
        description: "Anexar levantamento RTK atualizado como evidência."
      }
    ],
    traceability: {
      decisionId: "decision-1",
      diagnosisId: "diagnosis-1",
      capabilities: ["geospatial-intelligence"],
      evidenceReferences: ["spatial-confidence"],
      businessFactIds: ["fact-1"]
    },
    metadata: { recommendationType: "spatial_confidence", decisionPriority: "high" },
    createdAt: "2026-07-09T09:00:00.000Z",
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

const historicalFacts: EngineeringAdvisorHistoricalFacts = {
  previousDecisions: [],
  recommendationOpenSinceImportCountByRefId: {}
};

const baseArgs = {
  decisionSnapshotId: "snapshot-1",
  createdAt: "2026-07-09T10:00:00.000Z",
  correlationId: "conversation-1",
  createdBy: "user-1"
};

runTest("resolveCopilotApprovalTurn retorna recommendation_not_found quando o id não existe no contexto — nunca busca fora dele", () => {
  const ctx = context({ recommendations: [recommendation({ id: "recommendation-1" })] });
  const outcome = resolveCopilotApprovalTurn(
    ctx,
    historicalFacts,
    "recommendation-inexistente",
    baseArgs.decisionSnapshotId,
    baseArgs.createdAt,
    baseArgs.correlationId,
    baseArgs.createdBy
  );

  assertEqual(outcome.kind, "recommendation_not_found", "0 matches deve ser recommendation_not_found, nunca aprovar algo que não está no contexto");
});

runTest("resolveCopilotApprovalTurn retorna duplicate_recommendation quando 2+ Recommendations compartilham o mesmo id — .find() nunca é usado sem checar unicidade", () => {
  const ctx = context({
    recommendations: [recommendation({ id: "recommendation-1" }), recommendation({ id: "recommendation-1", title: "Duplicata defensiva" })]
  });
  const outcome = resolveCopilotApprovalTurn(
    ctx,
    historicalFacts,
    "recommendation-1",
    baseArgs.decisionSnapshotId,
    baseArgs.createdAt,
    baseArgs.correlationId,
    baseArgs.createdBy
  );

  assertEqual(outcome.kind, "duplicate_recommendation", "2+ matches é ambiguidade, nunca resolvida arbitrariamente para a primeira");
});

runTest("resolveCopilotApprovalTurn materializa ponta a ponta e devolve um assistant_turn quando exatamente 1 Recommendation resolve", () => {
  const ctx = context({ recommendations: [recommendation()] });
  const outcome = resolveCopilotApprovalTurn(
    ctx,
    historicalFacts,
    "recommendation-1",
    baseArgs.decisionSnapshotId,
    baseArgs.createdAt,
    baseArgs.correlationId,
    baseArgs.createdBy
  );

  assertEqual(outcome.kind, "assistant_turn", "1 match válido deve produzir um assistant_turn");
  if (outcome.kind !== "assistant_turn") {
    throw new Error("fixture inválida se isto falhar");
  }
  assertEqual(outcome.tasks.length, 2, "1 ExecutionTask por RecommendationOption — 2 options nesta fixture");
  assertEqual(outcome.turn.decisionSnapshotId, "snapshot-1", "decisionSnapshotId deve ser repassado ao turno");
  assertTrue(outcome.turn.content.includes(outcome.workflow.name), "o turno deve citar o nome real do workflow materializado");
});

runTest("resolveCopilotApprovalTurn é determinístico: mesma Recommendation produz sempre o mesmo workflow.id", () => {
  const ctx = context({ recommendations: [recommendation()] });
  const first = resolveCopilotApprovalTurn(ctx, historicalFacts, "recommendation-1", baseArgs.decisionSnapshotId, baseArgs.createdAt, baseArgs.correlationId, baseArgs.createdBy);
  const second = resolveCopilotApprovalTurn(ctx, historicalFacts, "recommendation-1", baseArgs.decisionSnapshotId, baseArgs.createdAt, baseArgs.correlationId, baseArgs.createdBy);

  if (first.kind !== "assistant_turn" || second.kind !== "assistant_turn") {
    throw new Error("fixture inválida se isto falhar");
  }
  assertEqual(first.workflow.id, second.workflow.id, "mesma Recommendation deve produzir o mesmo workflow.id em duas chamadas — é o que permite a rota tratar dupla aprovação como idempotente");
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
