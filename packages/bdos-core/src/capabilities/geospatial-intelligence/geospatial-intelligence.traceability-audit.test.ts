import { DecisionImpact } from "../../domain/decision";
import { createWorkPackage, WorkPackageType, type WorkPackage } from "../../domain/work-package-management";
import { generateSpatialObjectsFromWorkPackages } from "../../domain/spatial-object";
import { spatialObjectFactsAdapter } from "../../domain/business-facts-generator/adapters/spatial-object";
import { buildDecisions } from "../../engines/decision/builder";
import { buildRecommendations } from "../../engines/decision/recommendation";
import { executeRulePack, type RulePack } from "../../engines/decision/rule-engine";
import { lowSpatialConfidenceRule } from "./rules/low-spatial-confidence-rule";
import type { Decision } from "../../domain/decision";

/**
 * Sprint 14 — PRINCIPLE 001 Traceability Audit (Release 2.6 — see
 * Roadmap Estratégico in `packages/bdos-core/docs/GEOSPATIAL_ENGINE.md`),
 * updated by Sprint 15 (Release 2.7) once Q7's gap was closed.
 *
 * Sprints 11 and 13 proved the chain *produces* a `Decision`. This file
 * asks a stricter question: does that `Decision`, once produced, truly
 * answer every one of PRINCIPLE 001's seven questions
 * (`packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md`) — O que
 * aconteceu? Onde? Quando? Por quê? Qual o impacto? Quais evidências?
 * Qual ação recomendada? When this file was first written (Sprint 14),
 * the seventh question was a real, asserted gap:
 * `engines/decision/recommendation/recommendation-builder.ts` was
 * hardcoded to a single scenario (`category === Financial &&
 * diagnosisType === "projected_cash_deficit"`, i.e. cash-intelligence's
 * own case). Sprint 15 generalized it — see `resolveRecommendationContent`
 * in `recommendation-builder.ts` — to also recognize
 * `category === Risk && diagnosisType === "low_spatial_confidence"`,
 * without touching the cash-intelligence branch. All seven questions
 * are answered honestly below.
 */
const organizationId = "org-lagoa-do-arroz";
const contractId = "contract-lagoa-do-arroz";
const projectId = "project-lagoa-do-arroz";
const correlationId = "geospatial-traceability-audit-001";
const generatedAt = "2026-07-06T09:00:00Z";
const actor = "planning-engineer-marcos";
const occurredAt = "2026-07-05T09:00:00Z";
const tenantId = "tenant-2f-engenharia";
const capability = "geospatial-intelligence";

const geospatialRulePack: RulePack = {
  id: "geospatial-intelligence-rule-pack",
  name: "Geospatial Intelligence",
  version: "1.0.0",
  capability,
  rules: [lowSpatialConfidenceRule],
  metadata: {},
};

function buildAuditedDecision(): { readonly decision: Decision; readonly frente: WorkPackage } {
  const frenteResult = createWorkPackage({
    id: "wp-frente-a",
    organizationId,
    contractId,
    projectId,
    code: "FR-A",
    name: "Frente A — Fundação da Comporta",
    description: "Frente de execução da fundação da comporta principal.",
    type: WorkPackageType.ExecutionFront,
    sequence: 1,
    correlationId,
    createdBy: "planning-app",
    sourceSystem: "planning-app",
  });
  if (!frenteResult.success) {
    throw new Error(`expected Frente A fixture success: ${JSON.stringify(frenteResult.errors)}`);
  }
  const frente = frenteResult.workPackage;

  const wpResult = generateSpatialObjectsFromWorkPackages({ workPackages: [frente], actor, occurredAt });
  if (!wpResult.success) {
    throw new Error(`expected WorkPackage -> SpatialObject success: ${JSON.stringify(wpResult.errors)}`);
  }

  const factsResult = spatialObjectFactsAdapter.generateFacts({
    source: spatialObjectFactsAdapter.supportedSource,
    generatedAt,
    correlationId,
    tenantId,
    organizationId,
    capability,
    spatialObjects: wpResult.spatialObjects,
    metadata: {},
  });
  if (!factsResult.success) {
    throw new Error("expected fact generation success");
  }

  const diagnoses = executeRulePack(geospatialRulePack, factsResult.facts);
  const decisions = buildDecisions(diagnoses);

  const decision = decisions[0];
  if (decision === undefined) {
    throw new Error("expected the fixture to produce exactly one Decision to audit");
  }

  return { decision, frente };
}

runTest("Q1 — O que aconteceu? the Decision names the situation, not a generic label", () => {
  const { decision } = buildAuditedDecision();

  assertEqual(decision.title, "Low spatial confidence", "expected a specific, non-generic title");
  assertEqual(
    decision.summary.includes("spatial confidence"),
    true,
    "expected the summary to actually describe what happened, not just repeat the title",
  );
});

runTest("Q2 — Onde aconteceu? traces back to the exact originating place, by identity", () => {
  const { decision, frente } = buildAuditedDecision();

  const expectedSpatialObjectId = `spatial-object:work-package:${frente.id}`;
  assertEqual(
    decision.evidence[0]?.sourceReference,
    expectedSpatialObjectId,
    "expected the Decision's evidence to trace back to the exact spatial object id",
  );

  // Honest limit, not overclaimed: this Decision only exists because
  // the spatial object has no real geometry yet (see PRINCIPLE 004 —
  // a well-geolocated object would score High/Verified and never
  // reach `lowSpatialConfidenceRule` at all). "Onde" resolves today to
  // organizational identity (which Frente/Trecho), not to a literal
  // coordinate — that arrives only once Execution/Evidence contribute
  // real geometry, at which point this specific Decision would stop
  // existing (see Sprint 13's "risk resolves" scenario).
  assertEqual(frente.code, "FR-A", "expected the place to resolve back to a real, named WorkPackage");
});

runTest("Q3 — Quando aconteceu? a real, traceable timestamp, honestly scoped", () => {
  const { decision } = buildAuditedDecision();

  // For a spatial object with no geometry yet, there is no real-world
  // "observed at" moment to report — `spatialObjectFactsAdapter` falls
  // back to the moment the evaluation ran (`generatedAt`), not the
  // moment the WorkPackage was conceived (`occurredAt`). Asserting the
  // literal value keeps this test honest about which of the two it
  // actually is.
  assertEqual(decision.createdAt, generatedAt, "expected createdAt to trace to the fact evaluation timestamp");
});

runTest("Q4 — Por que aconteceu? the specific reasons survive all the way to the Decision", () => {
  const { decision } = buildAuditedDecision();

  const diagnosisMetadata = decision.metadata.diagnosisMetadata as Record<string, unknown> | undefined;
  const warningCodes = diagnosisMetadata?.spatialConfidenceWarningCodes;

  assertEqual(Array.isArray(warningCodes), true, "expected spatialConfidenceWarningCodes to survive to the Decision");
  const codes = warningCodes as ReadonlyArray<string>;
  assertEqual(codes.length > 0, true, "expected at least one concrete reason, not an empty explanation");
  assertEqual(
    codes.includes("no_current_geometry"),
    true,
    "expected the specific reason (no geometry yet) to be traceable, not just a confidence score",
  );
});

runTest("Q5 — Qual o impacto? present and correctly derived, honestly scoped", () => {
  const { decision } = buildAuditedDecision();

  // Honest limit: this is a severity-derived categorical impact
  // (Medium), not yet a computed real-world consequence (e.g. "delays
  // measurement by N days") — that would require Measurement/Finance
  // correlation, out of scope for this Engine today.
  assertEqual(decision.impact, DecisionImpact.Medium, "expected impact to be derived from diagnosis severity");
});

runTest("Q6 — Quais evidências suportam? at least one, correctly attributed", () => {
  const { decision } = buildAuditedDecision();

  assertEqual(decision.evidence.length, 1, "expected exactly one piece of evidence");
  assertEqual(
    decision.evidence[0]?.source,
    "spatial-object.confidence",
    "expected the evidence to trace back to the spatial-object adapter, not a generic source",
  );
});

runTest(
  "Q7 — Qual ação recomendada? closed in Release 2.7 (Sprint 15) — now a real, traceable answer",
  () => {
    const { decision } = buildAuditedDecision();

    const recommendations = buildRecommendations([decision]);

    // Until Release 2.7, this was an EXPECTED GAP (recommendation-builder.ts
    // only recognized cash-intelligence's own case). It was generalized —
    // see `resolveRecommendationContent` in recommendation-builder.ts —
    // to also recognize category=Risk + diagnosisType="low_spatial_confidence",
    // without touching the cash-intelligence branch. All seven PRINCIPLE
    // 001 questions are now answered for this Decision, honestly.
    assertEqual(recommendations.length, 1, "expected exactly one recommendation now that the gap is closed");

    const recommendation = recommendations[0];
    assertEqual(
      recommendation?.summary,
      "Regularizar a base espacial da frente/trecho antes de avançar decisões dependentes de localização.",
      "expected the specific regularization recommendation",
    );
    assertEqual(
      recommendation?.traceability.decisionId,
      decision.id,
      "expected the recommendation to trace back to this exact Decision",
    );
  },
);

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
