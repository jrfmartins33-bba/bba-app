import type { ExecutiveInsight } from "../executive-insight";
import { createExecutiveBrief } from "./index";

const generatedAt = "2026-07-02T13:00:00.000Z";

const executiveInsight: ExecutiveInsight = {
  id: "executive-insight-1",
  portfolioId: "decision-portfolio-1",
  generatedAt: "2026-07-02T12:00:00.000Z",
  topRisks: [
    {
      id: "executive-insight-1:risk:decision-case-critical",
      title: "Protect short-term cash",
      description:
        "Critical or high-priority case decision-case-critical requires executive review.",
      priority: "critical",
      score: 95,
      supportingDecisionCases: ["decision-case-critical"],
      supportingArtifacts: ["decision", "action-plan"],
      metadata: {
        title: "Protect short-term cash",
      },
    },
    {
      id: "executive-insight-1:risk:decision-case-high",
      title: "Resolve operating bottleneck",
      description:
        "Critical or high-priority case decision-case-high requires executive review.",
      priority: "high",
      score: 75,
      supportingDecisionCases: ["decision-case-high"],
      supportingArtifacts: ["decision", "recommendation"],
      metadata: {},
    },
  ],
  topOpportunities: [],
  attentionPoints: [
    {
      id: "executive-insight-1:attention:decision-case-medium",
      title: "Attention point from decision case decision-case-medium",
      description:
        "Medium-priority case decision-case-medium requires executive attention.",
      priority: "medium",
      score: 45,
      supportingDecisionCases: ["decision-case-medium"],
      supportingArtifacts: ["decision"],
      metadata: {},
    },
  ],
  positiveSignals: [],
  negativeSignals: [
    {
      id: "executive-insight-1:negative:decision-case-critical",
      title: "Protect short-term cash",
      description:
        "Critical or high-priority case decision-case-critical contributes a negative portfolio signal.",
      priority: "critical",
      score: 95,
      supportingDecisionCases: ["decision-case-critical"],
      supportingArtifacts: ["decision", "action-plan"],
      metadata: {},
    },
    {
      id: "executive-insight-1:negative:decision-case-high",
      title: "Resolve operating bottleneck",
      description:
        "Critical or high-priority case decision-case-high contributes a negative portfolio signal.",
      priority: "high",
      score: 75,
      supportingDecisionCases: ["decision-case-high"],
      supportingArtifacts: ["decision", "recommendation"],
      metadata: {},
    },
  ],
  confidence: 100,
  evidence: [
    {
      statement:
        "Critical or high-priority case decision-case-critical requires executive review.",
      supportingDecisionCases: ["decision-case-critical"],
      supportingArtifacts: ["decision", "action-plan"],
    },
    {
      statement:
        "Critical or high-priority case decision-case-high requires executive review.",
      supportingDecisionCases: ["decision-case-high"],
      supportingArtifacts: ["decision", "recommendation"],
    },
    {
      statement:
        "Medium-priority case decision-case-medium requires executive attention.",
      supportingDecisionCases: ["decision-case-medium"],
      supportingArtifacts: ["decision"],
    },
  ],
  metadata: {
    owner: "executive",
  },
};

runTest("createExecutiveBrief()", () => {
  const brief = createExecutiveBrief({
    executiveInsight,
    id: "executive-brief-1",
    generatedAt,
  });

  assertEqual(brief.id, "executive-brief-1", "id mismatch");
  assertEqual(
    brief.portfolioId,
    executiveInsight.portfolioId,
    "portfolioId mismatch",
  );
  assertEqual(brief.generatedAt, generatedAt, "generatedAt mismatch");
  assertEqual(brief.metadata["owner"], "executive", "metadata mismatch");
});

runTest("deterministic output", () => {
  const first = JSON.stringify(
    createExecutiveBrief({
      executiveInsight,
      id: "executive-brief-1",
      generatedAt,
    }),
  );
  const second = JSON.stringify(
    createExecutiveBrief({
      executiveInsight,
      id: "executive-brief-1",
      generatedAt,
    }),
  );

  assertEqual(first, second, "expected deterministic output");
});

runTest("headline generation", () => {
  const brief = createExecutiveBrief({
    executiveInsight,
    id: "executive-brief-1",
    generatedAt,
  });

  assertEqual(
    brief.headline,
    "Executive attention required: 2 risks across 3 supporting decision cases.",
    "headline mismatch",
  );
});

runTest("summary generation", () => {
  const brief = createExecutiveBrief({
    executiveInsight,
    id: "executive-brief-1",
    generatedAt,
  });

  assertIncludes(
    brief.executiveSummary,
    "The executive insight identifies 2 risks",
    "summary missing risk count",
  );
  assertIncludes(
    brief.executiveSummary,
    "The leading case is decision-case-critical",
    "summary missing top case",
  );
  assertEqual(
    countWords(brief.executiveSummary) <= 150,
    true,
    "summary should be at most 150 words",
  );
});

runTest("top decisions", () => {
  const brief = createExecutiveBrief({
    executiveInsight,
    id: "executive-brief-1",
    generatedAt,
  });

  assertEqual(brief.topDecisions.length, 3, "top decision count mismatch");
  assertEqual(
    brief.topDecisions[0]?.decisionCaseId,
    "decision-case-critical",
    "top decision id mismatch",
  );
  assertEqual(
    brief.topDecisions[0]?.title,
    "Protect short-term cash",
    "top decision title mismatch",
  );
  assertEqual(
    brief.topDecisions[2]?.title,
    "Attention point from decision case decision-case-medium",
    "fallback title mismatch",
  );
});

runTest("agenda generation", () => {
  const brief = createExecutiveBrief({
    executiveInsight,
    id: "executive-brief-1",
    generatedAt,
  });

  assertEqual(brief.executiveAgenda.length, 3, "agenda count mismatch");
  assertEqual(brief.executiveAgenda[0]?.sequence, 1, "sequence mismatch");
  assertEqual(
    brief.executiveAgenda[0]?.title,
    "Review Protect short-term cash",
    "agenda title mismatch",
  );
  assertIncludes(
    brief.executiveAgenda[0]?.description ?? "",
    "Priority: critical; score: 95.",
    "agenda description mismatch",
  );
});

runTest("confidence calculation", () => {
  const brief = createExecutiveBrief({
    executiveInsight,
    id: "executive-brief-1",
    generatedAt,
  });

  assertEqual(brief.confidence, 100, "confidence mismatch");
});

runTest("explanation generation", () => {
  const brief = createExecutiveBrief({
    executiveInsight,
    id: "executive-brief-1",
    generatedAt,
  });
  const headlineExplanation = brief.explanations[0];
  const firstRecommendationExplanation = brief.explanations[1];

  assertExists(headlineExplanation, "expected headline explanation");
  assertEqual(
    headlineExplanation.supportingDecisionCases.length,
    3,
    "headline support count mismatch",
  );
  assertIncludes(
    headlineExplanation.supportingDecisionCases,
    "decision-case-critical",
    "headline explanation missing decision case",
  );
  assertExists(
    firstRecommendationExplanation,
    "expected recommendation explanation",
  );
  assertEqual(
    firstRecommendationExplanation.supportingDecisionCases[0],
    "decision-case-critical",
    "recommendation support mismatch",
  );
});

runTest("empty portfolio", () => {
  const brief = createExecutiveBrief({
    executiveInsight: {
      id: "executive-insight-empty",
      portfolioId: "decision-portfolio-empty",
      generatedAt: "2026-07-02T12:00:00.000Z",
      topRisks: [],
      topOpportunities: [],
      attentionPoints: [],
      positiveSignals: [],
      negativeSignals: [],
      confidence: 0,
      evidence: [],
      metadata: {},
    },
    id: "executive-brief-empty",
    generatedAt,
  });

  assertEqual(
    brief.headline,
    "No executive insights available.",
    "empty headline mismatch",
  );
  assertEqual(brief.topDecisions.length, 0, "top decisions mismatch");
  assertEqual(brief.executiveAgenda.length, 0, "agenda mismatch");
  assertEqual(brief.confidence, 0, "confidence mismatch");
  assertEqual(
    brief.explanations[0]?.supportingDecisionCases.length,
    0,
    "empty explanation mismatch",
  );
});

runTest("traceability preservation", () => {
  const brief = createExecutiveBrief({
    executiveInsight,
    id: "executive-brief-1",
    generatedAt,
  });

  assertEqual(
    brief.topDecisions[0]?.decisionCaseId,
    "decision-case-critical",
    "top decision traceability mismatch",
  );
  assertIncludes(
    brief.explanations[0]?.supportingArtifacts ?? [],
    "action-plan",
    "supporting artifact mismatch",
  );
  assertEqual(
    brief.explanations[1]?.supportingDecisionCases[0],
    brief.topDecisions[0]?.decisionCaseId,
    "recommendation traceability mismatch",
  );
});

function countWords(value: string): number {
  return value.split(/\s+/).filter((word) => word.length > 0).length;
}

function assertIncludes<T>(
  values: ReadonlyArray<T> | string,
  expected: T,
  message: string,
): void {
  if (!values.includes(expected as never)) {
    throw new Error(message);
  }
}

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
