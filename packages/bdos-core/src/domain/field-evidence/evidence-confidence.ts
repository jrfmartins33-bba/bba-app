import type { EvidenceBundle, FieldEvidence } from "./field-evidence.types";
import { EvidenceConfidence, EvidenceStatus } from "./field-evidence.types";
import type { EvidenceReview } from "./evidence-review.types";
import { EvidenceReviewDecision, EvidenceReviewTargetType } from "./evidence-review.types";

/**
 * Reuses the `EvidenceConfidence` vocabulary already established in
 * Sprint 12.1 (Low/Medium/High/Verified) instead of duplicating it under a
 * new enum — this engine recomputes the same value that populates
 * `FieldEvidence.confidence`, it does not invent a parallel scale.
 */
export type EvidenceConfidenceLevel = EvidenceConfidence;

export type EvidenceConfidenceReasonCode =
  | "evidence_approved"
  | "evidence_has_claims"
  | "bundle_multiple_evidences"
  | "review_approved"
  | "bundle_has_primary_evidence"
  | "no_warnings_detected";

export type EvidenceConfidenceWarningCode =
  | "evidence_rejected"
  | "evidence_without_claims"
  | "review_rejected"
  | "review_needs_more_evidence"
  | "bundle_without_primary_evidence"
  | "bundle_single_evidence"
  | "primary_evidence_not_approved"
  | "primary_evidence_without_claims"
  | "primary_evidence_not_resolvable";

export interface EvidenceConfidenceReason {
  readonly code: EvidenceConfidenceReasonCode;
  readonly description: string;
}

export interface EvidenceConfidenceWarning {
  readonly code: EvidenceConfidenceWarningCode;
  readonly description: string;
}

export interface EvidenceConfidenceResult {
  readonly confidence: EvidenceConfidenceLevel;
  readonly score: number;
  readonly reasons: ReadonlyArray<EvidenceConfidenceReason>;
  readonly warnings: ReadonlyArray<EvidenceConfidenceWarning>;
}

export interface EvidenceConfidenceSummary {
  readonly confidence: EvidenceConfidenceLevel;
  readonly score: number;
  readonly totalReasons: number;
  readonly totalWarnings: number;
  readonly hasWarnings: boolean;
}

export interface EvaluateFieldEvidenceConfidenceInput {
  readonly evidence: FieldEvidence;
  readonly review?: EvidenceReview | null;
}

export interface EvaluateEvidenceBundleConfidenceInput {
  readonly bundle: EvidenceBundle;
  readonly evidences: ReadonlyArray<FieldEvidence>;
  readonly review?: EvidenceReview | null;
}

/**
 * Fixed point value contributed by each deterministic factor. Every factor
 * is all-or-nothing (no partial credit, no arbitrary weighting) and the six
 * values sum to exactly 100, matching the maximum reachable score.
 */
export const EVIDENCE_CONFIDENCE_POINTS = Object.freeze({
  evidenceApproved: 30,
  evidenceHasClaims: 15,
  bundleMultipleEvidences: 15,
  reviewApproved: 20,
  bundleHasPrimaryEvidence: 10,
  noWarningsDetected: 10,
} as const);

const LOW_MAX_SCORE = 25;
const MEDIUM_MAX_SCORE = 60;
const HIGH_MAX_SCORE = 85;

/**
 * Fixed score-to-level mapping table:
 *   0-25   -> Low
 *   26-60  -> Medium
 *   61-85  -> High
 *   86-100 -> Verified
 */
export function resolveEvidenceConfidenceLevel(score: number): EvidenceConfidenceLevel {
  if (score > HIGH_MAX_SCORE) {
    return EvidenceConfidence.Verified;
  }

  if (score > MEDIUM_MAX_SCORE) {
    return EvidenceConfidence.High;
  }

  if (score > LOW_MAX_SCORE) {
    return EvidenceConfidence.Medium;
  }

  return EvidenceConfidence.Low;
}

/**
 * Evaluates a single `FieldEvidence` (optionally alongside the
 * `EvidenceReview` targeting it) without mutating either aggregate. A lone
 * piece of evidence has no bundle context, so `bundleMultipleEvidences` and
 * `bundleHasPrimaryEvidence` never apply here — the maximum reachable score
 * at this level is 75 (High). Reaching Verified requires corroboration
 * captured only by `evaluateEvidenceBundleConfidence`.
 */
export function evaluateFieldEvidenceConfidence(
  input: EvaluateFieldEvidenceConfidenceInput,
): EvidenceConfidenceResult {
  const { evidence, review } = input;
  const reasons: EvidenceConfidenceReason[] = [];
  const warnings: EvidenceConfidenceWarning[] = [];
  let score = 0;

  if (evidence.status === EvidenceStatus.Approved) {
    score += EVIDENCE_CONFIDENCE_POINTS.evidenceApproved;
    reasons.push(createReason("evidence_approved", "Evidence status is Approved."));
  } else if (evidence.status === EvidenceStatus.Rejected) {
    warnings.push(createWarning("evidence_rejected", "Evidence status is Rejected."));
  }

  if (evidence.claims.length > 0) {
    score += EVIDENCE_CONFIDENCE_POINTS.evidenceHasClaims;
    reasons.push(createReason("evidence_has_claims", "Evidence has at least one structured claim."));
  } else {
    warnings.push(createWarning("evidence_without_claims", "Evidence has no structured claims."));
  }

  const matchingReview = resolveReviewForTarget(
    review,
    EvidenceReviewTargetType.FieldEvidence,
    evidence.id,
  );

  score += applyReviewDecision(matchingReview, reasons, warnings);

  if (warnings.length === 0) {
    score += EVIDENCE_CONFIDENCE_POINTS.noWarningsDetected;
    reasons.push(createReason("no_warnings_detected", "No deterministic warning conditions were detected."));
  }

  return buildResult(score, reasons, warnings);
}

/**
 * Evaluates an `EvidenceBundle` given the resolved `FieldEvidence` items it
 * references (the bundle itself only stores `evidenceId` references, never
 * the evidence objects — see `EvidenceBundle` in field-evidence.types.ts) and
 * optionally the `EvidenceReview` targeting the bundle. The bundle's
 * `primaryEvidenceId`, when resolvable, stands in for "the evidence" when
 * checking approval and claims. Does not mutate any input.
 */
export function evaluateEvidenceBundleConfidence(
  input: EvaluateEvidenceBundleConfidenceInput,
): EvidenceConfidenceResult {
  const { bundle, evidences, review } = input;
  const reasons: EvidenceConfidenceReason[] = [];
  const warnings: EvidenceConfidenceWarning[] = [];
  let score = 0;

  const primaryEvidence = resolvePrimaryEvidence(bundle, evidences);

  if (bundle.primaryEvidenceId !== null) {
    score += EVIDENCE_CONFIDENCE_POINTS.bundleHasPrimaryEvidence;
    reasons.push(createReason("bundle_has_primary_evidence", "Bundle has a primary evidence reference."));

    if (primaryEvidence === null) {
      warnings.push(
        createWarning(
          "primary_evidence_not_resolvable",
          "Primary evidence id is not present among the provided evidences.",
        ),
      );
    }
  } else {
    warnings.push(createWarning("bundle_without_primary_evidence", "Bundle has no primary evidence set."));
  }

  if (primaryEvidence !== null) {
    if (primaryEvidence.status === EvidenceStatus.Approved) {
      score += EVIDENCE_CONFIDENCE_POINTS.evidenceApproved;
      reasons.push(createReason("evidence_approved", "Primary evidence status is Approved."));
    } else if (primaryEvidence.status === EvidenceStatus.Rejected) {
      warnings.push(createWarning("primary_evidence_not_approved", "Primary evidence status is Rejected."));
    }

    if (primaryEvidence.claims.length > 0) {
      score += EVIDENCE_CONFIDENCE_POINTS.evidenceHasClaims;
      reasons.push(createReason("evidence_has_claims", "Primary evidence has at least one structured claim."));
    } else {
      warnings.push(createWarning("primary_evidence_without_claims", "Primary evidence has no structured claims."));
    }
  }

  if (bundle.evidenceIds.length >= 2) {
    score += EVIDENCE_CONFIDENCE_POINTS.bundleMultipleEvidences;
    reasons.push(createReason("bundle_multiple_evidences", "Bundle references two or more evidence items."));
  } else {
    warnings.push(createWarning("bundle_single_evidence", "Bundle references fewer than two evidence items."));
  }

  const matchingReview = resolveReviewForTarget(review, EvidenceReviewTargetType.EvidenceBundle, bundle.id);

  score += applyReviewDecision(matchingReview, reasons, warnings);

  if (warnings.length === 0) {
    score += EVIDENCE_CONFIDENCE_POINTS.noWarningsDetected;
    reasons.push(createReason("no_warnings_detected", "No deterministic warning conditions were detected."));
  }

  return buildResult(score, reasons, warnings);
}

export function summarizeEvidenceConfidence(result: EvidenceConfidenceResult): EvidenceConfidenceSummary {
  return {
    confidence: result.confidence,
    score: result.score,
    totalReasons: result.reasons.length,
    totalWarnings: result.warnings.length,
    hasWarnings: result.warnings.length > 0,
  };
}

function resolvePrimaryEvidence(
  bundle: EvidenceBundle,
  evidences: ReadonlyArray<FieldEvidence>,
): FieldEvidence | null {
  if (bundle.primaryEvidenceId === null) {
    return null;
  }

  return evidences.find((candidate) => candidate.id === bundle.primaryEvidenceId) ?? null;
}

function resolveReviewForTarget(
  review: EvidenceReview | null | undefined,
  targetType: EvidenceReviewTargetType,
  targetId: string,
): EvidenceReview | null {
  if (review == null) {
    return null;
  }

  return review.targetType === targetType && review.targetId === targetId ? review : null;
}

function applyReviewDecision(
  review: EvidenceReview | null,
  reasons: EvidenceConfidenceReason[],
  warnings: EvidenceConfidenceWarning[],
): number {
  if (review === null) {
    return 0;
  }

  if (review.decision === EvidenceReviewDecision.Approved) {
    reasons.push(createReason("review_approved", "Associated EvidenceReview decision is Approved."));
    return EVIDENCE_CONFIDENCE_POINTS.reviewApproved;
  }

  if (review.decision === EvidenceReviewDecision.Rejected) {
    warnings.push(createWarning("review_rejected", "Associated EvidenceReview decision is Rejected."));
    return 0;
  }

  if (review.decision === EvidenceReviewDecision.NeedsMoreEvidence) {
    warnings.push(
      createWarning("review_needs_more_evidence", "Associated EvidenceReview requested more evidence."),
    );
  }

  return 0;
}

function buildResult(
  score: number,
  reasons: ReadonlyArray<EvidenceConfidenceReason>,
  warnings: ReadonlyArray<EvidenceConfidenceWarning>,
): EvidenceConfidenceResult {
  return freezeDomainObject<EvidenceConfidenceResult>({
    confidence: resolveEvidenceConfidenceLevel(score),
    score,
    reasons,
    warnings,
  });
}

function createReason(code: EvidenceConfidenceReasonCode, description: string): EvidenceConfidenceReason {
  return { code, description };
}

function createWarning(code: EvidenceConfidenceWarningCode, description: string): EvidenceConfidenceWarning {
  return { code, description };
}

type FreezableRecord = Record<PropertyKey, unknown>;

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [
      key,
      cloneDomainValue(property),
    ]),
  ) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.values(value as FreezableRecord).forEach((property) => {
    freezeClonedDomainObject(property);
  });

  return Object.freeze(value);
}
