declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EVIDENCE_CONFIDENCE_POINTS,
  EvidenceConfidence,
  EvidenceReviewTargetType,
  addEvidenceClaim,
  approveEvidenceReview,
  approveFieldEvidence,
  classifyFieldEvidence,
  createEvidenceBundle,
  createEvidenceReview,
  createFieldEvidence,
  evaluateEvidenceBundleConfidence,
  evaluateFieldEvidenceConfidence,
  rejectEvidenceReview,
  rejectFieldEvidence,
  requestEvidenceReview,
  requestMoreEvidence,
  resolveEvidenceConfidenceLevel,
  startEvidenceReview,
  submitFieldEvidence,
  summarizeEvidenceConfidence,
  EvidenceClaimType,
  EvidenceSource,
  EvidenceType,
  EvidenceUnit,
  type CreateEvidenceBundleInput,
  type CreateEvidenceReviewInput,
  type CreateFieldEvidenceInput,
  type EvidenceBundle,
  type EvidenceBundleResult,
  type EvidenceClaimInput,
  type EvidenceReview,
  type EvidenceReviewResult,
  type FieldEvidence,
  type FieldEvidenceResult,
} from "./index";

const evidenceId = "evidence-conf-001";
const secondaryEvidenceId = "evidence-conf-002";
const actor = "field-engineer-ana";
const occurredAt = "2026-07-03T14:00:00Z";
const correlationId = "field-evidence-confidence-correlation-001";
const createdBy = "field-app";
const sourceSystem = "field-capture-app";

const bundleId = "bundle-conf-001";
const reviewId = "review-conf-001";
const reviewer = "technical-engineer-camila";

// --- Level coverage: Low, Medium, High, Verified ---------------------------

runTest("field evidence with no claims and no approval scores Low", () => {
  const evidence = buildDraftEvidenceFixture();
  const result = evaluateFieldEvidenceConfidence({ evidence });

  assertEqual(result.score, 0, "expected minimum score");
  assertEqual(result.confidence, EvidenceConfidence.Low, "expected Low confidence");
});

runTest("approved field evidence without claims scores Medium", () => {
  const evidence = buildApprovedEvidenceFixture();
  const result = evaluateFieldEvidenceConfidence({ evidence });

  assertEqual(result.score, EVIDENCE_CONFIDENCE_POINTS.evidenceApproved, "expected approved-only score");
  assertEqual(result.confidence, EvidenceConfidence.Medium, "expected Medium confidence");
});

runTest("approved field evidence with claims and an approved review scores High", () => {
  const evidence = buildApprovedEvidenceWithClaimFixture();
  const review = buildApprovedReviewFixture(EvidenceReviewTargetType.FieldEvidence, evidence.id);

  const result = evaluateFieldEvidenceConfidence({ evidence, review });

  assertEqual(
    result.score,
    EVIDENCE_CONFIDENCE_POINTS.evidenceApproved +
      EVIDENCE_CONFIDENCE_POINTS.evidenceHasClaims +
      EVIDENCE_CONFIDENCE_POINTS.reviewApproved +
      EVIDENCE_CONFIDENCE_POINTS.noWarningsDetected,
    "expected full field-evidence-level score",
  );
  assertEqual(result.confidence, EvidenceConfidence.High, "expected High confidence");
});

runTest("field evidence alone never reaches Verified (bundle corroboration required)", () => {
  const evidence = buildApprovedEvidenceWithClaimFixture();
  const review = buildApprovedReviewFixture(EvidenceReviewTargetType.FieldEvidence, evidence.id);

  const result = evaluateFieldEvidenceConfidence({ evidence, review });

  assertEqual(result.score <= 85, true, "field-evidence-level score must cap at High");
  assertEqual(result.confidence !== EvidenceConfidence.Verified, true, "must not reach Verified alone");
});

runTest("bundle with approved corroborated primary evidence and approved review scores Verified", () => {
  const primary = buildApprovedEvidenceWithClaimFixture();
  const bundle = buildBundleFixture({
    evidenceIds: [primary.id, secondaryEvidenceId],
    primaryEvidenceId: primary.id,
  });
  const review = buildApprovedReviewFixture(EvidenceReviewTargetType.EvidenceBundle, bundle.id);

  const result = evaluateEvidenceBundleConfidence({ bundle, evidences: [primary], review });

  assertEqual(result.score, 100, "expected maximum score");
  assertEqual(result.confidence, EvidenceConfidence.Verified, "expected Verified confidence");
});

runTest("bundle with no primary evidence and a single evidence reference scores Low (score minimum)", () => {
  const bundle = buildBundleFixture({ evidenceIds: [], primaryEvidenceId: null });

  const result = evaluateEvidenceBundleConfidence({ bundle, evidences: [] });

  assertEqual(result.score, 0, "expected minimum bundle score");
  assertEqual(result.confidence, EvidenceConfidence.Low, "expected Low confidence");
});

runTest("bundle with approved corroborated primary but a single evidence reference scores Medium", () => {
  const primary = buildApprovedEvidenceWithClaimFixture();
  const bundle = buildBundleFixture({ evidenceIds: [primary.id], primaryEvidenceId: primary.id });

  const result = evaluateEvidenceBundleConfidence({ bundle, evidences: [primary] });

  assertEqual(
    result.score,
    EVIDENCE_CONFIDENCE_POINTS.bundleHasPrimaryEvidence +
      EVIDENCE_CONFIDENCE_POINTS.evidenceApproved +
      EVIDENCE_CONFIDENCE_POINTS.evidenceHasClaims,
    "expected partial bundle score",
  );
  assertEqual(result.confidence, EvidenceConfidence.Medium, "expected Medium confidence");
});

runTest("bundle with approved corroborated primary and multiple evidences (no review) scores High", () => {
  const primary = buildApprovedEvidenceWithClaimFixture();
  const bundle = buildBundleFixture({
    evidenceIds: [primary.id, secondaryEvidenceId],
    primaryEvidenceId: primary.id,
  });

  const result = evaluateEvidenceBundleConfidence({ bundle, evidences: [primary] });

  assertEqual(
    result.score,
    EVIDENCE_CONFIDENCE_POINTS.bundleHasPrimaryEvidence +
      EVIDENCE_CONFIDENCE_POINTS.evidenceApproved +
      EVIDENCE_CONFIDENCE_POINTS.evidenceHasClaims +
      EVIDENCE_CONFIDENCE_POINTS.bundleMultipleEvidences +
      EVIDENCE_CONFIDENCE_POINTS.noWarningsDetected,
    "expected high-band bundle score",
  );
  assertEqual(result.confidence, EvidenceConfidence.High, "expected High confidence");
});

// --- Score boundaries (faixas corretas) -------------------------------------

runTest("score-to-level mapping matches the fixed table exactly", () => {
  assertEqual(resolveEvidenceConfidenceLevel(0), EvidenceConfidence.Low, "0 -> Low");
  assertEqual(resolveEvidenceConfidenceLevel(25), EvidenceConfidence.Low, "25 -> Low");
  assertEqual(resolveEvidenceConfidenceLevel(26), EvidenceConfidence.Medium, "26 -> Medium");
  assertEqual(resolveEvidenceConfidenceLevel(60), EvidenceConfidence.Medium, "60 -> Medium");
  assertEqual(resolveEvidenceConfidenceLevel(61), EvidenceConfidence.High, "61 -> High");
  assertEqual(resolveEvidenceConfidenceLevel(85), EvidenceConfidence.High, "85 -> High");
  assertEqual(resolveEvidenceConfidenceLevel(86), EvidenceConfidence.Verified, "86 -> Verified");
  assertEqual(resolveEvidenceConfidenceLevel(100), EvidenceConfidence.Verified, "100 -> Verified");
});

runTest("scoring factors sum to exactly 100 (the maximum score)", () => {
  const total = Object.values(EVIDENCE_CONFIDENCE_POINTS).reduce((sum, points) => sum + points, 0);
  assertEqual(total, 100, "expected fixed factors to sum to the maximum score");
});

// --- Referential edge cases --------------------------------------------------

runTest("bundle primary evidence id not resolvable produces a warning and no approval/claims bonus", () => {
  const bundle = buildBundleFixture({
    evidenceIds: ["unresolvable-evidence"],
    primaryEvidenceId: "unresolvable-evidence",
  });

  const result = evaluateEvidenceBundleConfidence({ bundle, evidences: [] });

  assertEqual(
    result.warnings.some((warning) => warning.code === "primary_evidence_not_resolvable"),
    true,
    "expected unresolved primary evidence warning",
  );
  assertEqual(
    result.reasons.some((reason) => reason.code === "evidence_approved"),
    false,
    "unresolved primary must not grant the approved bonus",
  );
});

runTest("a review targeting a different evidence id is ignored", () => {
  const evidence = buildApprovedEvidenceWithClaimFixture();
  const unrelatedReview = buildApprovedReviewFixture(EvidenceReviewTargetType.FieldEvidence, "some-other-evidence");

  const result = evaluateFieldEvidenceConfidence({ evidence, review: unrelatedReview });

  assertEqual(
    result.reasons.some((reason) => reason.code === "review_approved"),
    false,
    "mismatched review must not contribute to the score",
  );
});

runTest("a rejected review contributes a warning and no bonus", () => {
  const evidence = buildApprovedEvidenceWithClaimFixture();
  const review = buildRejectedReviewFixture(EvidenceReviewTargetType.FieldEvidence, evidence.id);

  const result = evaluateFieldEvidenceConfidence({ evidence, review });

  assertEqual(
    result.warnings.some((warning) => warning.code === "review_rejected"),
    true,
    "expected review_rejected warning",
  );
});

runTest("a needs-more-evidence review contributes a warning and no bonus", () => {
  const evidence = buildApprovedEvidenceWithClaimFixture();
  const review = buildNeedsMoreEvidenceReviewFixture(EvidenceReviewTargetType.FieldEvidence, evidence.id);

  const result = evaluateFieldEvidenceConfidence({ evidence, review });

  assertEqual(
    result.warnings.some((warning) => warning.code === "review_needs_more_evidence"),
    true,
    "expected review_needs_more_evidence warning",
  );
});

// --- Determinism, immutability, no aggregate mutation ------------------------

runTest("evaluateFieldEvidenceConfidence is deterministic for identical input", () => {
  const evidence = buildApprovedEvidenceWithClaimFixture();
  const review = buildApprovedReviewFixture(EvidenceReviewTargetType.FieldEvidence, evidence.id);

  const first = JSON.stringify(evaluateFieldEvidenceConfidence({ evidence, review }));
  const second = JSON.stringify(evaluateFieldEvidenceConfidence({ evidence, review }));

  assertEqual(first, second, "expected deterministic field evidence confidence output");
});

runTest("evaluateEvidenceBundleConfidence is deterministic for identical input", () => {
  const primary = buildApprovedEvidenceWithClaimFixture();
  const bundle = buildBundleFixture({
    evidenceIds: [primary.id, secondaryEvidenceId],
    primaryEvidenceId: primary.id,
  });

  const first = JSON.stringify(evaluateEvidenceBundleConfidence({ bundle, evidences: [primary] }));
  const second = JSON.stringify(evaluateEvidenceBundleConfidence({ bundle, evidences: [primary] }));

  assertEqual(first, second, "expected deterministic bundle confidence output");
});

runTest("evaluateFieldEvidenceConfidence output is deeply immutable", () => {
  const evidence = buildApprovedEvidenceWithClaimFixture();
  const result = evaluateFieldEvidenceConfidence({ evidence });

  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.reasons), true, "reasons should be frozen");
  assertEqual(Object.isFrozen(result.reasons[0]), true, "individual reason should be frozen");
  assertEqual(Object.isFrozen(result.warnings), true, "warnings should be frozen");

  assertThrows(() => {
    (result as { score: number }).score = 999;
  }, "mutating a frozen result must throw in strict mode");
});

runTest("evaluateFieldEvidenceConfidence never mutates the FieldEvidence aggregate", () => {
  const evidence = buildApprovedEvidenceWithClaimFixture();
  const before = JSON.stringify(evidence);

  evaluateFieldEvidenceConfidence({ evidence });

  assertEqual(JSON.stringify(evidence), before, "evidence aggregate must remain unchanged");
});

runTest("evaluateEvidenceBundleConfidence never mutates the EvidenceBundle or FieldEvidence aggregates", () => {
  const primary = buildApprovedEvidenceWithClaimFixture();
  const bundle = buildBundleFixture({
    evidenceIds: [primary.id, secondaryEvidenceId],
    primaryEvidenceId: primary.id,
  });
  const beforeBundle = JSON.stringify(bundle);
  const beforeEvidence = JSON.stringify(primary);

  evaluateEvidenceBundleConfidence({ bundle, evidences: [primary] });

  assertEqual(JSON.stringify(bundle), beforeBundle, "bundle aggregate must remain unchanged");
  assertEqual(JSON.stringify(primary), beforeEvidence, "primary evidence aggregate must remain unchanged");
});

// --- summarizeEvidenceConfidence --------------------------------------------

runTest("summarizeEvidenceConfidence reflects the result", () => {
  const evidence = buildApprovedEvidenceWithClaimFixture();
  const review = buildApprovedReviewFixture(EvidenceReviewTargetType.FieldEvidence, evidence.id);
  const result = evaluateFieldEvidenceConfidence({ evidence, review });

  const summary = summarizeEvidenceConfidence(result);

  assertEqual(summary.confidence, result.confidence, "summary confidence mismatch");
  assertEqual(summary.score, result.score, "summary score mismatch");
  assertEqual(summary.totalReasons, result.reasons.length, "summary totalReasons mismatch");
  assertEqual(summary.totalWarnings, result.warnings.length, "summary totalWarnings mismatch");
  assertEqual(summary.hasWarnings, false, "expected no warnings on a fully-approved evidence");
});

runTest("summarizeEvidenceConfidence reports warnings when present", () => {
  const evidence = buildDraftEvidenceFixture();
  const result = evaluateFieldEvidenceConfidence({ evidence });
  const summary = summarizeEvidenceConfidence(result);

  assertEqual(summary.hasWarnings, true, "expected warnings on a draft evidence without claims");
  assertEqual(summary.totalWarnings > 0, true, "expected at least one warning");
});

// --- Forbidden imports / non-deterministic constructs -----------------------

runTest("evidence-confidence engine imports nothing forbidden and uses no non-deterministic constructs", () => {
  const sourceCode = readOwnSourceFile();
  const lowerSourceCode = sourceCode.toLowerCase();

  [
    "date.now(",
    "math.random(",
    "crypto.randomuuid",
    "uuid()",
    "react",
    "next",
    "supabase",
    "\"fs\"",
    "'fs'",
    "node:fs",
    "\"path\"",
    "'path'",
    "node:path",
    "xlsx",
    "pdf-lib",
    "pdfkit",
    "docx",
    "ocr",
    "gps.get",
    "whatsapp",
    "tensorflow",
    "openai",
    "fetch(",
    "xmlhttprequest",
  ].forEach((forbidden) => {
    assertEqual(
      lowerSourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in evidence-confidence source: ${forbidden}`,
    );
  });
});

// --- Fixtures ----------------------------------------------------------------

function buildDraftEvidenceFixture(): FieldEvidence {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");
  return created.evidence;
}

function buildApprovedEvidenceFixture(): FieldEvidence {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");
  const submitted = submitFieldEvidence({ evidence: created.evidence, actor, occurredAt });
  assertSuccess(submitted, "expected submit success");
  const classified = classifyFieldEvidence({ evidence: submitted.evidence, actor, occurredAt });
  assertSuccess(classified, "expected classify success");
  const approved = approveFieldEvidence({ evidence: classified.evidence, actor, occurredAt });
  assertSuccess(approved, "expected approve success");
  return approved.evidence;
}

function buildApprovedEvidenceWithClaimFixture(): FieldEvidence {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");
  const withClaim = addEvidenceClaim({ evidence: created.evidence, claim: claimInputFixture(), actor, occurredAt });
  assertSuccess(withClaim, "expected add claim success");
  const submitted = submitFieldEvidence({ evidence: withClaim.evidence, actor, occurredAt });
  assertSuccess(submitted, "expected submit success");
  const classified = classifyFieldEvidence({ evidence: submitted.evidence, actor, occurredAt });
  assertSuccess(classified, "expected classify success");
  const approved = approveFieldEvidence({ evidence: classified.evidence, actor, occurredAt });
  assertSuccess(approved, "expected approve success");
  return approved.evidence;
}

function buildBundleFixture(
  overrides: Partial<Pick<CreateEvidenceBundleInput, "evidenceIds" | "primaryEvidenceId">>,
): EvidenceBundle {
  const created = createEvidenceBundle(createBundleInputFixture(overrides));
  assertBundleSuccess(created, "expected bundle creation success");
  return created.bundle;
}

function buildApprovedReviewFixture(
  targetType: EvidenceReviewTargetType,
  targetId: string,
): EvidenceReview {
  const created = createEvidenceReview(createReviewInputFixture({ targetType, targetId }));
  assertReviewSuccess(created, "expected review creation success");
  const requested = requestEvidenceReview({ review: created.review, actor, occurredAt });
  assertReviewSuccess(requested, "expected request success");
  const inReview = startEvidenceReview({ review: requested.review, actor, occurredAt });
  assertReviewSuccess(inReview, "expected start success");
  const approved = approveEvidenceReview({
    review: inReview.review,
    actor,
    occurredAt,
    comments: "Evidencia validada em campo.",
  });
  assertReviewSuccess(approved, "expected approve success");
  return approved.review;
}

function buildRejectedReviewFixture(
  targetType: EvidenceReviewTargetType,
  targetId: string,
): EvidenceReview {
  const created = createEvidenceReview(createReviewInputFixture({ targetType, targetId }));
  assertReviewSuccess(created, "expected review creation success");
  const requested = requestEvidenceReview({ review: created.review, actor, occurredAt });
  assertReviewSuccess(requested, "expected request success");
  const inReview = startEvidenceReview({ review: requested.review, actor, occurredAt });
  assertReviewSuccess(inReview, "expected start success");
  const rejected = rejectEvidenceReview({
    review: inReview.review,
    actor,
    occurredAt,
    comments: "Evidencia insuficiente.",
  });
  assertReviewSuccess(rejected, "expected reject success");
  return rejected.review;
}

function buildNeedsMoreEvidenceReviewFixture(
  targetType: EvidenceReviewTargetType,
  targetId: string,
): EvidenceReview {
  const created = createEvidenceReview(createReviewInputFixture({ targetType, targetId }));
  assertReviewSuccess(created, "expected review creation success");
  const requested = requestEvidenceReview({ review: created.review, actor, occurredAt });
  assertReviewSuccess(requested, "expected request success");
  const inReview = startEvidenceReview({ review: requested.review, actor, occurredAt });
  assertReviewSuccess(inReview, "expected start success");
  const needsMore = requestMoreEvidence({
    review: inReview.review,
    actor,
    occurredAt,
    requestedAdditionalEvidence: ["foto adicional da frente de servico"],
  });
  assertReviewSuccess(needsMore, "expected request-more-evidence success");
  return needsMore.review;
}

function createEvidenceInputFixture(
  overrides: Partial<CreateFieldEvidenceInput> = {},
): CreateFieldEvidenceInput {
  return {
    id: overrides.id ?? evidenceId,
    source: overrides.source ?? EvidenceSource.FieldTeam,
    type: overrides.type ?? EvidenceType.Photo,
    description: overrides.description ?? "Foto do avanco da fundacao do bloco B.",
    captureReference: overrides.captureReference ?? "capture-ref-conf-0001",
    captureDate: overrides.captureDate,
    confidence: overrides.confidence,
    actor: overrides.actor ?? actor,
    occurredAt: overrides.occurredAt ?? occurredAt,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? { source: "field-evidence-confidence" },
  };
}

function claimInputFixture(overrides: Partial<EvidenceClaimInput> = {}): EvidenceClaimInput {
  return {
    id: overrides.id ?? "claim-conf-0001",
    type: overrides.type ?? EvidenceClaimType.ExecutedQuantity,
    subject: overrides.subject ?? "Escavacao executada",
    quantity: overrides.quantity ?? { value: 126, unit: EvidenceUnit.CubicMeter },
    observedAt: overrides.observedAt,
    notes: overrides.notes,
    metadata: overrides.metadata,
  };
}

function createBundleInputFixture(
  overrides: Partial<CreateEvidenceBundleInput> = {},
): CreateEvidenceBundleInput {
  return {
    id: overrides.id ?? bundleId,
    title: overrides.title ?? "Escavacao - Frente 03 - Dia 10/07/2026",
    description: overrides.description ?? "Conjunto de evidencias da escavacao da frente 03.",
    evidenceIds: overrides.evidenceIds,
    primaryEvidenceId: overrides.primaryEvidenceId,
    tags: overrides.tags,
    actor: overrides.actor ?? actor,
    occurredAt: overrides.occurredAt ?? occurredAt,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? { source: "field-evidence-confidence" },
  };
}

function createReviewInputFixture(
  overrides: Partial<CreateEvidenceReviewInput> = {},
): CreateEvidenceReviewInput {
  return {
    id: overrides.id ?? reviewId,
    targetType: overrides.targetType ?? EvidenceReviewTargetType.FieldEvidence,
    targetId: overrides.targetId ?? evidenceId,
    reviewer: overrides.reviewer ?? reviewer,
    occurredAt: overrides.occurredAt ?? occurredAt,
    actor: overrides.actor,
    comments: overrides.comments,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? { source: "field-evidence-confidence-review" },
  };
}

function readOwnSourceFile(): string {
  const filePath = resolve(process.cwd(), "src", "domain", "field-evidence", "evidence-confidence.ts");
  return readFileSync(filePath, "utf8");
}

// --- Test harness ------------------------------------------------------------

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertThrows(fn: () => void, message: string): void {
  let threw = false;

  try {
    fn();
  } catch {
    threw = true;
  }

  if (!threw) {
    throw new Error(message);
  }
}

function assertSuccess(
  result: FieldEvidenceResult,
  message: string,
): asserts result is Extract<FieldEvidenceResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertBundleSuccess(
  result: EvidenceBundleResult,
  message: string,
): asserts result is Extract<EvidenceBundleResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertReviewSuccess(
  result: EvidenceReviewResult,
  message: string,
): asserts result is Extract<EvidenceReviewResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}
