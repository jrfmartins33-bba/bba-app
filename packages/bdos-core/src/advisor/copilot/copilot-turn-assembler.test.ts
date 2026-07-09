import {
  DecisionCategory,
  DecisionImpact,
  DecisionPriority,
  DecisionStatus,
  type Decision
} from "../../domain/decision";
import type { Recommendation } from "../../engines/decision/recommendation";
import type { EngineeringAdvisorContext } from "../advisor-context.types";
import type { EngineeringAdvisorHistoricalFacts } from "../advisor-historical-facts.types";
import { buildEngineeringAdvisorPromptContext } from "../advisor-prompt-context-builder";
import type { EngineeringAdvisorInsight } from "../advisor-summary.types";
import { computeContextHash } from "./context-hash";
import { assembleCopilotAssistantTurn } from "./copilot-turn-assembler";

const decisionA: Decision = {
  id: "decision-1",
  tenantId: "tenant-1",
  organizationId: "organization-1",
  evidence: [
    {
      source: "kpi",
      sourceReference: "schedule-variance",
      description: "Atividade de fundação com atraso de 18 dias frente ao planejado.",
      metadata: {}
    }
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
  metadata: {}
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
    businessFactIds: ["fact-1"]
  },
  metadata: { decisionPriority: "critical" },
  createdAt: "2026-07-01T09:05:00.000Z"
};

const context: EngineeringAdvisorContext = {
  snapshot: {
    engineeringProjectId: "project-1",
    engineeringProjectName: "Projeto Alpha",
    computedAt: "2026-07-08T10:00:00.000Z",
    healthScore: 62,
    previousHealthScore: 78
  },
  decisions: [decisionA],
  recommendations: [recommendationA],
  evidenceIndex: { "decision-1": decisionA.evidence },
  historySummary: "Health Score 78 → 62."
};

const historicalFacts: EngineeringAdvisorHistoricalFacts = {
  previousDecisions: [{ id: "decision-1", priority: "high" }],
  recommendationOpenSinceImportCountByRefId: {}
};

const insight: EngineeringAdvisorInsight = {
  title: "Por que o projeto está em risco?",
  summary: "A fundação está 18 dias atrasada, o que reduziu o Health Score de 78 para 62.",
  priority: "critical",
  decisionIds: ["decision-1"],
  recommendationIds: ["recommendation-1"],
  evidenceDecisionIds: ["decision-1"]
};

runTest("assembleCopilotAssistantTurn embute valores reais, não apenas ids", () => {
  const promptContext = buildEngineeringAdvisorPromptContext(context, historicalFacts);
  const turn = assembleCopilotAssistantTurn(insight, context, historicalFacts, promptContext, "snapshot-1", "claude-sonnet-5");

  assertEqual(turn.explainability.decisions[0]?.title, decisionA.title, "explainability precisa carregar o título real da Decision, não só o id");
  assertTrue(
    turn.reasoningChain.some((step) => step.description.includes(decisionA.title)),
    "reasoningChain precisa citar o título real da Decision na descrição"
  );
  assertEqual(turn.confidence.overall, "high", "insight totalmente citado deve produzir confidence alta");
  assertEqual(turn.decisionSnapshotId, "snapshot-1", "decisionSnapshotId deve ser repassado como recebido");
  assertEqual(turn.model, "claude-sonnet-5", "model deve ser repassado como recebido");
});

runTest("assembleCopilotAssistantTurn congela o context_snapshot — mutar o objeto original depois não afeta o turno já montado", () => {
  const promptContext = buildEngineeringAdvisorPromptContext(context, historicalFacts);
  const turn = assembleCopilotAssistantTurn(insight, context, historicalFacts, promptContext, null, "claude-sonnet-5");

  const originalHealthScore = turn.contextSnapshot.snapshot.healthScore;

  // Mutação deliberada do objeto original, DEPOIS de montado o turno —
  // se contextSnapshot fosse uma referência viva, isso vazaria para
  // turn.contextSnapshot e quebraria a garantia de "congelar, não
  // referenciar" que toda a Fase 1 depende (ver DECISION_COPILOT.md).
  (promptContext.snapshot as { healthScore: number }).healthScore = 999;

  assertEqual(turn.contextSnapshot.snapshot.healthScore, originalHealthScore, "contextSnapshot não pode refletir mutação do objeto original após a montagem do turno");
});

runTest("assembleCopilotAssistantTurn produz contextHash consistente com o contextSnapshot retornado", () => {
  const promptContext = buildEngineeringAdvisorPromptContext(context, historicalFacts);
  const turn = assembleCopilotAssistantTurn(insight, context, historicalFacts, promptContext, null, "claude-sonnet-5");

  assertEqual(turn.contextHash, computeContextHash(turn.contextSnapshot), "contextHash precisa corresponder ao contextSnapshot efetivamente retornado");
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
