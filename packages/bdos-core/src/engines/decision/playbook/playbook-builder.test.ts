import type { Recommendation } from "../recommendation";
import { buildPlaybooks } from "./playbook-builder";

const supportedRecommendation: Recommendation = {
  id: "recommendation:decision-1:cash-protection",
  decisionId: "decision-1",
  title: "Cash protection recommendation",
  summary: "Recommended action options to respond to a projected cash deficit.",
  options: [
    {
      id: "recommendation:decision-1:cash-protection:option:reduce_discretionary_spending",
      type: "reduce_discretionary_spending",
      title: "Reduce discretionary spending",
      description: "Review and reduce discretionary spending.",
    },
  ],
  traceability: {
    decisionId: "decision-1",
    diagnosisId: "diagnosis-1",
    capabilities: ["cash-intelligence"],
    evidenceReferences: ["cash-projection"],
    businessFactIds: ["fact-1"],
  },
  metadata: {
    recommendationType: "cash_protection",
  },
  createdAt: "2026-07-02T09:01:00.000Z",
};

// Fixture do caminho genérico (Epic 16.6A) — recommendationType fora
// de "cash_protection", com decisionPriority preenchido exatamente
// como recommendation-builder.ts já grava em toda Recommendation real
// (metadata.decisionPriority: decision.priority).
const genericRecommendation: Recommendation = {
  id: "recommendation:decision-2:spatial",
  decisionId: "decision-2",
  title: "Regularizar geometria espacial do Bloco 3",
  summary: "A geometria do Bloco 3 precisa ser regularizada antes da próxima medição.",
  options: [
    {
      id: "recommendation:decision-2:spatial:option:regularize_spatial_geometry",
      type: "regularize_spatial_geometry",
      title: "Regularizar geometria espacial",
      description: "Corrigir a geometria do SpatialObject associado ao Bloco 3.",
    },
    {
      id: "recommendation:decision-2:spatial:option:attach_spatial_evidence",
      type: "attach_spatial_evidence",
      title: "Anexar evidência espacial",
      description: "Anexar levantamento RTK atualizado como evidência.",
    },
  ],
  traceability: {
    decisionId: "decision-2",
    diagnosisId: "diagnosis-2",
    capabilities: ["geospatial-intelligence"],
    evidenceReferences: ["spatial-confidence"],
    businessFactIds: ["fact-2"],
  },
  metadata: {
    recommendationType: "spatial_confidence",
    decisionPriority: "high",
  },
  createdAt: "2026-07-02T09:02:00.000Z",
};

runTest("supported recommendation creates the curated cash protection playbook", () => {
  const playbooks = buildPlaybooks([supportedRecommendation]);

  assertEqual(playbooks.length, 1, "expected one playbook");
  assertEqual(playbooks[0]?.name, "Cash Protection Playbook", "name mismatch");
});

runTest("Epic 16.6A: unsupported recommendation now creates a generic playbook, never null/empty", () => {
  const playbooks = buildPlaybooks([genericRecommendation]);

  assertEqual(playbooks.length, 1, "toda Recommendation agora produz um Playbook, generalização do 16.6A");
  assertTrue(playbooks[0]?.id.includes(":generic"), "playbook genérico deve ter um id que o identifica como tal");
});

runTest("generic playbook cria exatamente 1 PlaybookStep por RecommendationOption, título/descrição sem invenção", () => {
  const playbook = buildPlaybooks([genericRecommendation])[0];

  assertExists(playbook, "expected playbook to exist");
  assertEqual(playbook.steps.length, genericRecommendation.options.length, "1 step por option, nem mais nem menos");
  assertEqual(playbook.steps[0]?.title, genericRecommendation.options[0]?.title, "título do step deve vir exatamente da option");
  assertEqual(playbook.steps[0]?.description, genericRecommendation.options[0]?.description, "descrição do step deve vir exatamente da option");
});

runTest("generic playbook nunca inventa kpis/risks/successCriteria — regra de honestidade", () => {
  const playbook = buildPlaybooks([genericRecommendation])[0];

  assertExists(playbook, "expected playbook to exist");
  assertEqual(playbook.kpis.length, 0, "kpis deve ficar vazio, nunca inventado");
  assertEqual(playbook.risks.length, 0, "risks deve ficar vazio, nunca inventado");
  assertEqual(playbook.successCriteria.length, 0, "successCriteria deve ficar vazio, nunca inventado");
});

runTest("generic playbook step nunca inventa estimatedImpact/estimatedEffort — regra de honestidade", () => {
  const playbook = buildPlaybooks([genericRecommendation])[0];

  assertExists(playbook, "expected playbook to exist");
  playbook.steps.forEach((step) => {
    assertEqual(step.estimatedImpact, undefined, "estimatedImpact nunca deve ser inventado no caminho genérico");
    assertEqual(step.estimatedEffort, undefined, "estimatedEffort nunca deve ser inventado no caminho genérico");
  });
});

runTest("generic playbook step priority vem de Recommendation.metadata.decisionPriority, propagado, não inventado", () => {
  const playbook = buildPlaybooks([genericRecommendation])[0];

  assertExists(playbook, "expected playbook to exist");
  playbook.steps.forEach((step) => {
    assertEqual(step.priority, "high", "priority deve refletir exatamente metadata.decisionPriority (propagado da Decision real)");
  });
});

runTest("curated cash protection playbook continua preenchendo estimatedImpact/estimatedEffort normalmente", () => {
  const playbook = buildPlaybooks([supportedRecommendation])[0];

  assertExists(playbook, "expected playbook to exist");
  assertTrue(
    playbook.steps.every((step) => step.estimatedImpact !== undefined && step.estimatedEffort !== undefined),
    "template curado deve continuar preenchendo os dois campos — só o caminho genérico os omite"
  );
});

runTest("generic playbook com Recommendation sem nenhuma option ainda produz um playbook válido, só sem steps", () => {
  const playbooks = buildPlaybooks([{ ...genericRecommendation, options: [] }]);

  assertEqual(playbooks.length, 1, "playbook ainda deve existir mesmo sem options");
  assertEqual(playbooks[0]?.steps.length, 0, "nenhum step deve ser inventado quando não há options");
});

runTest("deterministic output", () => {
  const first = JSON.stringify(buildPlaybooks([supportedRecommendation]));
  const second = JSON.stringify(buildPlaybooks([supportedRecommendation]));

  assertEqual(first, second, "expected deterministic output");
});

runTest("traceability preservation", () => {
  const playbook = buildPlaybooks([supportedRecommendation])[0];

  assertExists(playbook, "expected playbook to exist");
  assertEqual(
    playbook.recommendationId,
    supportedRecommendation.id,
    "recommendationId mismatch",
  );
  assertEqual(playbook.metadata["decisionId"], "decision-1", "decisionId mismatch");
  assertEqual(
    playbook.metadata["diagnosisId"],
    "diagnosis-1",
    "diagnosisId mismatch",
  );
  assertEqual(
    playbook.metadata["capability"],
    "cash-intelligence",
    "capability mismatch",
  );
});

runTest("playbook completeness", () => {
  const playbook = buildPlaybooks([supportedRecommendation])[0];

  assertExists(playbook, "expected playbook to exist");
  assertEqual(playbook.steps.length, 5, "steps count mismatch");
  assertEqual(playbook.kpis.length, 6, "kpis count mismatch");
  assertEqual(playbook.risks.length, 4, "risks count mismatch");
  assertEqual(
    playbook.successCriteria.length,
    5,
    "success criteria count mismatch",
  );
  assertIncludes(
    playbook.steps.map((step) => step.title),
    "Monitor daily cash position",
    "expected daily cash monitoring step",
  );
  assertIncludes(
    playbook.kpis,
    "Projected Cash",
    "expected projected cash KPI",
  );
  assertIncludes(
    playbook.successCriteria,
    "Minimum cash reserve maintained",
    "expected minimum cash reserve criterion",
  );
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

function assertExists<T>(
  value: T | null | undefined,
  message: string,
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertIncludes<T>(
  values: ReadonlyArray<T>,
  expected: T,
  message: string,
): void {
  if (!values.includes(expected)) {
    throw new Error(message);
  }
}
