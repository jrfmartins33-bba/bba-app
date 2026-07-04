declare const process: { cwd(): string };

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  EvidenceBundleStatus,
  EvidenceClaimType,
  EvidenceConfidence,
  EvidenceReviewDecision,
  EvidenceReviewStatus,
  EvidenceReviewTargetType,
  EvidenceSource,
  EvidenceStatus,
  EvidenceType,
  EvidenceUnit,
  addEvidenceClaim,
  addEvidenceToBundle,
  approveEvidenceReview,
  approveFieldEvidence,
  archiveEvidenceBundle,
  archiveEvidenceReview,
  archiveFieldEvidence,
  classifyFieldEvidence,
  createEvidenceBundle,
  createEvidenceReview,
  createFieldEvidence,
  findEvidenceClaim,
  listEvidenceClaimsByType,
  openEvidenceBundle,
  rejectEvidenceReview,
  rejectEvidenceBundle,
  rejectFieldEvidence,
  removeEvidenceFromBundle,
  requestEvidenceReview,
  requestMoreEvidence,
  setPrimaryEvidence,
  startEvidenceReview,
  submitEvidenceBundleForReview,
  submitFieldEvidence,
  summarizeEvidenceBundle,
  summarizeEvidenceClaims,
  summarizeEvidenceReview,
  summarizeFieldEvidence,
  validateEvidenceBundle,
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

const evidenceId = "evidence-001";
const actor = "field-engineer-ana";
const occurredAt = "2026-07-03T14:00:00Z";
const correlationId = "field-evidence-correlation-001";
const createdBy = "field-app";
const sourceSystem = "field-capture-app";

const bundleId = "bundle-001";
const reviewId = "review-001";
const reviewer = "technical-engineer-camila";

runTest("valid creation", () => {
  const result = createFieldEvidence(createEvidenceInputFixture());

  assertSuccess(result, "expected evidence creation success");
  assertEqual(result.evidence.id, evidenceId, "id mismatch");
  assertEqual(result.evidence.source, EvidenceSource.FieldTeam, "source mismatch");
  assertEqual(result.evidence.type, EvidenceType.Photo, "type mismatch");
  assertEqual(result.evidence.status, EvidenceStatus.Draft, "initial status mismatch");
  assertEqual(result.evidence.confidence, EvidenceConfidence.Medium, "default confidence mismatch");
  assertEqual(result.evidence.captureReference, "capture-ref-0001", "captureReference mismatch");
  assertEqual(result.evidence.timeline.length, 1, "timeline count mismatch");
  assertEqual(result.evidence.timeline[0]?.type, "evidence_created", "timeline type mismatch");
  assertEqual(result.evidence.trace.length, 1, "trace count mismatch");
  assertEqual(result.evidence.trace[0]?.action, "evidence_created", "trace action mismatch");
});

runTest("captureDate defaults to null when omitted", () => {
  const result = createFieldEvidence(createEvidenceInputFixture());

  assertSuccess(result, "expected evidence creation success");
  assertEqual(result.evidence.captureDate, null, "expected captureDate to default to null");
});

runTest("confidence can be overridden at creation", () => {
  const result = createFieldEvidence(createEvidenceInputFixture({ confidence: EvidenceConfidence.High }));

  assertSuccess(result, "expected evidence creation success");
  assertEqual(result.evidence.confidence, EvidenceConfidence.High, "expected overridden confidence");
});

runTest("rejects missing id", () => {
  const result = createFieldEvidence(createEvidenceInputFixture({ id: "" }));

  assertFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejects missing description", () => {
  const result = createFieldEvidence(createEvidenceInputFixture({ description: "" }));

  assertFailure(result, "expected missing description failure");
  assertEqual(result.errors[0]?.code, "missing_description", "error code mismatch");
});

runTest("rejects missing source", () => {
  const result = createFieldEvidence(createEvidenceInputFixture({ source: "" as EvidenceSource }));

  assertFailure(result, "expected missing source failure");
  assertEqual(result.errors[0]?.code, "missing_source", "error code mismatch");
});

runTest("rejects missing type", () => {
  const result = createFieldEvidence(createEvidenceInputFixture({ type: "" as EvidenceType }));

  assertFailure(result, "expected missing type failure");
  assertEqual(result.errors[0]?.code, "missing_type", "error code mismatch");
});

runTest("rejects missing captureReference", () => {
  const result = createFieldEvidence(createEvidenceInputFixture({ captureReference: "" }));

  assertFailure(result, "expected missing captureReference failure");
  assertEqual(result.errors[0]?.code, "missing_capture_reference", "error code mismatch");
});

runTest("valid transition path: Draft -> Submitted -> Classified -> Approved -> Archived", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const submitted = submitFieldEvidence({ evidence: created.evidence, actor, occurredAt });
  assertSuccess(submitted, "expected submit success");
  assertEqual(submitted.evidence.status, EvidenceStatus.Submitted, "status after submit mismatch");

  const classified = classifyFieldEvidence({ evidence: submitted.evidence, actor, occurredAt });
  assertSuccess(classified, "expected classify success");
  assertEqual(classified.evidence.status, EvidenceStatus.Classified, "status after classify mismatch");

  const approved = approveFieldEvidence({ evidence: classified.evidence, actor, occurredAt });
  assertSuccess(approved, "expected approve success");
  assertEqual(approved.evidence.status, EvidenceStatus.Approved, "status after approve mismatch");

  const archived = archiveFieldEvidence({ evidence: approved.evidence, actor, occurredAt });
  assertSuccess(archived, "expected archive success");
  assertEqual(archived.evidence.status, EvidenceStatus.Archived, "status after archive mismatch");
});

runTest("valid rejection path: Draft -> Rejected -> Archived", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const rejected = rejectFieldEvidence({ evidence: created.evidence, actor, occurredAt });
  assertSuccess(rejected, "expected reject success");
  assertEqual(rejected.evidence.status, EvidenceStatus.Rejected, "status after reject mismatch");

  const archived = archiveFieldEvidence({ evidence: rejected.evidence, actor, occurredAt });
  assertSuccess(archived, "expected archive success");
  assertEqual(archived.evidence.status, EvidenceStatus.Archived, "status after archive mismatch");
});

runTest("rejects classifying evidence that skipped Submitted", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const result = classifyFieldEvidence({ evidence: created.evidence, actor, occurredAt });

  assertFailure(result, "expected invalid transition failure (Draft -> Classified)");
  assertEqual(result.errors[0]?.code, "invalid_evidence_status_transition", "error code mismatch");
});

runTest("rejects approving evidence that skipped Classified", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");
  const submitted = submitFieldEvidence({ evidence: created.evidence, actor, occurredAt });
  assertSuccess(submitted, "expected submit success");

  const result = approveFieldEvidence({ evidence: submitted.evidence, actor, occurredAt });

  assertFailure(result, "expected invalid transition failure (Submitted -> Approved)");
  assertEqual(result.errors[0]?.code, "invalid_evidence_status_transition", "error code mismatch");
});

runTest("rejects re-submitting already-submitted evidence", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");
  const submitted = submitFieldEvidence({ evidence: created.evidence, actor, occurredAt });
  assertSuccess(submitted, "expected submit success");

  const result = submitFieldEvidence({ evidence: submitted.evidence, actor, occurredAt });

  assertFailure(result, "expected invalid transition failure (Submitted -> Submitted)");
  assertEqual(result.errors[0]?.code, "invalid_evidence_status_transition", "error code mismatch");
});

runTest("rejects rejecting evidence that already left Draft", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");
  const submitted = submitFieldEvidence({ evidence: created.evidence, actor, occurredAt });
  assertSuccess(submitted, "expected submit success");

  const result = rejectFieldEvidence({ evidence: submitted.evidence, actor, occurredAt });

  assertFailure(result, "expected invalid transition failure (Submitted -> Rejected)");
  assertEqual(result.errors[0]?.code, "invalid_evidence_status_transition", "error code mismatch");
});

runTest("Approved is operationally terminal: cannot move back to earlier states", () => {
  const approved = buildApprovedEvidenceFixture();

  const backToClassify = classifyFieldEvidence({ evidence: approved, actor, occurredAt });
  assertFailure(backToClassify, "expected Approved -> Classified to be rejected");
  assertEqual(backToClassify.errors[0]?.code, "invalid_evidence_status_transition", "error code mismatch");

  const backToSubmit = submitFieldEvidence({ evidence: approved, actor, occurredAt });
  assertFailure(backToSubmit, "expected Approved -> Submitted to be rejected");
  assertEqual(backToSubmit.errors[0]?.code, "invalid_evidence_status_transition", "error code mismatch");

  const toReject = rejectFieldEvidence({ evidence: approved, actor, occurredAt });
  assertFailure(toReject, "expected Approved -> Rejected to be rejected");
  assertEqual(toReject.errors[0]?.code, "invalid_evidence_status_transition", "error code mismatch");
});

runTest("Approved can still move forward to Archived (not an absolute terminal)", () => {
  const approved = buildApprovedEvidenceFixture();

  const archived = archiveFieldEvidence({ evidence: approved, actor, occurredAt });

  assertSuccess(archived, "expected Approved -> Archived to succeed");
  assertEqual(archived.evidence.status, EvidenceStatus.Archived, "status mismatch");
});

runTest("Archived is an absolute terminal: blocks any further mutation", () => {
  const approved = buildApprovedEvidenceFixture();
  const archivedResult = archiveFieldEvidence({ evidence: approved, actor, occurredAt });
  assertSuccess(archivedResult, "expected archive success as setup step");
  const archived = archivedResult.evidence;

  [
    () => submitFieldEvidence({ evidence: archived, actor, occurredAt }),
    () => classifyFieldEvidence({ evidence: archived, actor, occurredAt }),
    () => approveFieldEvidence({ evidence: archived, actor, occurredAt }),
    () => rejectFieldEvidence({ evidence: archived, actor, occurredAt }),
    () => archiveFieldEvidence({ evidence: archived, actor, occurredAt }),
  ].forEach((attempt, index) => {
    const result = attempt();
    assertFailure(result, `expected terminal block on attempt #${index}`);
    assertEqual(result.errors[0]?.code, "evidence_terminal", `error code mismatch on attempt #${index}`);
  });
});

runTest("every mutation grows trace", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");
  assertEqual(created.evidence.trace.length, 1, "trace length after creation mismatch");

  const submitted = submitFieldEvidence({ evidence: created.evidence, actor, occurredAt });
  assertSuccess(submitted, "expected submit success");
  assertEqual(submitted.evidence.trace.length, 2, "trace length after submit mismatch");

  const classified = classifyFieldEvidence({ evidence: submitted.evidence, actor, occurredAt });
  assertSuccess(classified, "expected classify success");
  assertEqual(classified.evidence.trace.length, 3, "trace length after classify mismatch");
});

runTest("every status transition grows the timeline", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");
  assertEqual(created.evidence.timeline.length, 1, "timeline length after creation mismatch");

  const submitted = submitFieldEvidence({ evidence: created.evidence, actor, occurredAt });
  assertSuccess(submitted, "expected submit success");
  assertEqual(submitted.evidence.timeline.length, 2, "timeline length after submit mismatch");
  assertEqual(submitted.evidence.timeline[1]?.type, "evidence_submitted", "timeline type mismatch");
});

runTest("summarizeFieldEvidence matches evidence state", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const draftSummary = summarizeFieldEvidence(created.evidence);
  assertEqual(draftSummary.status, EvidenceStatus.Draft, "draft summary status mismatch");
  assertEqual(draftSummary.confidence, EvidenceConfidence.Medium, "draft summary confidence mismatch");
  assertEqual(draftSummary.totalTraceEntries, 1, "draft summary trace count mismatch");
  assertEqual(draftSummary.totalTimelineEntries, 1, "draft summary timeline count mismatch");
  assertEqual(draftSummary.isTerminal, false, "draft summary isTerminal mismatch");

  const approved = buildApprovedEvidenceFixture();
  const approvedSummary = summarizeFieldEvidence(approved);
  assertEqual(approvedSummary.isTerminal, false, "approved summary isTerminal mismatch (operational, not absolute)");

  const archivedResult = archiveFieldEvidence({ evidence: approved, actor, occurredAt });
  assertSuccess(archivedResult, "expected archive success as setup step");
  const archivedSummary = summarizeFieldEvidence(archivedResult.evidence);
  assertEqual(archivedSummary.isTerminal, true, "archived summary isTerminal mismatch");
});

runTest("immutable output", () => {
  const result = createFieldEvidence(createEvidenceInputFixture());

  assertSuccess(result, "expected creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.evidence), true, "evidence should be frozen");
  assertEqual(Object.isFrozen(result.evidence.timeline), true, "timeline should be frozen");
  assertEqual(Object.isFrozen(result.evidence.trace), true, "trace should be frozen");
  assertEqual(Object.isFrozen(result.evidence.metadata), true, "metadata should be frozen");

  const submitted = submitFieldEvidence({ evidence: result.evidence, actor, occurredAt });
  assertSuccess(submitted, "expected submit success");
  assertEqual(Object.isFrozen(submitted.evidence), true, "evidence after submit should be frozen");
  assertEqual(Object.isFrozen(submitted.evidence.timeline), true, "timeline after submit should be frozen");
});

runTest("deterministic output for identical input", () => {
  const input = createEvidenceInputFixture();
  const first = JSON.stringify(createFieldEvidence(input));
  const second = JSON.stringify(createFieldEvidence(input));

  assertEqual(first, second, "expected deterministic evidence creation output");
});

runTest("deterministic output across mutations", () => {
  const buildMutated = () => {
    const created = createFieldEvidence(createEvidenceInputFixture());
    assertSuccess(created, "expected creation success");
    const submitted = submitFieldEvidence({ evidence: created.evidence, actor, occurredAt });
    assertSuccess(submitted, "expected submit success");
    return submitted;
  };

  const first = JSON.stringify(buildMutated());
  const second = JSON.stringify(buildMutated());
  assertEqual(first, second, "expected deterministic mutation output");
});

runTest("preserves traceability (correlationId/createdBy/sourceSystem in metadata)", () => {
  const result = createFieldEvidence(createEvidenceInputFixture());

  assertSuccess(result, "expected creation success");
  assertEqual(result.evidence.metadata["correlationId"], correlationId, "correlation id mismatch");
  assertEqual(result.evidence.metadata["createdBy"], createdBy, "created by mismatch");
  assertEqual(result.evidence.metadata["sourceSystem"], sourceSystem, "source system mismatch");
  assertEqual(result.evidence.trace[0]?.actor, actor, "trace actor mismatch");
  assertEqual(result.evidence.trace[0]?.occurredAt, occurredAt, "trace occurredAt mismatch");
});

runTest("adds a valid claim", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addEvidenceClaim({
    evidence: created.evidence,
    claim: claimInputFixture(),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add claim success");
  assertEqual(result.evidence.claims.length, 1, "claims count mismatch");
  assertEqual(result.evidence.claims[0]?.id, "claim-001", "claim id mismatch");
  assertEqual(result.evidence.claims[0]?.type, EvidenceClaimType.ExecutedQuantity, "claim type mismatch");
  assertEqual(result.evidence.claims[0]?.quantity?.value, 126, "claim quantity value mismatch");
  assertEqual(result.evidence.claims[0]?.quantity?.unit, EvidenceUnit.CubicMeter, "claim quantity unit mismatch");
});

runTest("adds a claim with no quantity (qualitative observation)", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addEvidenceClaim({
    evidence: created.evidence,
    claim: {
      id: "claim-002",
      type: EvidenceClaimType.DailyReportEntry,
      subject: "Diario de obra registra ocorrencia de chuva forte.",
    },
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add claim success");
  assertEqual(result.evidence.claims[0]?.quantity, null, "expected quantity to default to null");
  assertEqual(result.evidence.claims[0]?.observedAt, null, "expected observedAt to default to null");
  assertEqual(result.evidence.claims[0]?.notes, null, "expected notes to default to null");
});

runTest("supports multiple claims on the same evidence", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const first = addEvidenceClaim({ evidence: created.evidence, claim: claimInputFixture(), actor, occurredAt });
  assertSuccess(first, "expected first claim add success");

  const second = addEvidenceClaim({
    evidence: first.evidence,
    claim: claimInputFixture({ id: "claim-002", type: EvidenceClaimType.MachineUsage, subject: "Escavadeira CAT 320" }),
    actor,
    occurredAt,
  });
  assertSuccess(second, "expected second claim add success");

  assertEqual(second.evidence.claims.length, 2, "expected two claims");
});

runTest("rejects a duplicate claim id", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");
  const first = addEvidenceClaim({ evidence: created.evidence, claim: claimInputFixture(), actor, occurredAt });
  assertSuccess(first, "expected first claim add success");

  const result = addEvidenceClaim({ evidence: first.evidence, claim: claimInputFixture(), actor, occurredAt });

  assertFailure(result, "expected duplicate claim id failure");
  assertEqual(result.errors[0]?.code, "duplicate_claim_id", "error code mismatch");
});

runTest("rejects a claim with a blank id", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addEvidenceClaim({
    evidence: created.evidence,
    claim: claimInputFixture({ id: "" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected missing claim id failure");
  assertEqual(result.errors[0]?.code, "missing_claim_id", "error code mismatch");
});

runTest("rejects a claim with a blank type", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addEvidenceClaim({
    evidence: created.evidence,
    claim: claimInputFixture({ type: "" as EvidenceClaimType }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected missing claim type failure");
  assertEqual(result.errors[0]?.code, "missing_claim_type", "error code mismatch");
});

runTest("rejects a claim with a blank subject", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addEvidenceClaim({
    evidence: created.evidence,
    claim: claimInputFixture({ subject: "" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected missing claim subject failure");
  assertEqual(result.errors[0]?.code, "missing_claim_subject", "error code mismatch");
});

runTest("rejects a claim quantity with a blank unit", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addEvidenceClaim({
    evidence: created.evidence,
    claim: claimInputFixture({ quantity: { value: 10, unit: "" as EvidenceUnit } }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected missing claim unit failure");
  assertEqual(result.errors[0]?.code, "missing_claim_unit", "error code mismatch");
});

runTest("rejects a negative claim quantity", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addEvidenceClaim({
    evidence: created.evidence,
    claim: claimInputFixture({ quantity: { value: -5, unit: EvidenceUnit.CubicMeter } }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected negative claim quantity failure");
  assertEqual(result.errors[0]?.code, "negative_claim_quantity", "error code mismatch");
});

runTest("rejects a percent quantity above 100", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addEvidenceClaim({
    evidence: created.evidence,
    claim: claimInputFixture({ quantity: { value: 150, unit: EvidenceUnit.Percent } }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected invalid claim percent failure");
  assertEqual(result.errors[0]?.code, "invalid_claim_percent", "error code mismatch");
});

runTest("accepts a percent quantity at the 0-100 boundaries", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const zero = addEvidenceClaim({
    evidence: created.evidence,
    claim: claimInputFixture({ quantity: { value: 0, unit: EvidenceUnit.Percent } }),
    actor,
    occurredAt,
  });
  assertSuccess(zero, "expected success at 0%");

  const hundred = addEvidenceClaim({
    evidence: created.evidence,
    claim: claimInputFixture({ id: "claim-003", quantity: { value: 100, unit: EvidenceUnit.Percent } }),
    actor,
    occurredAt,
  });
  assertSuccess(hundred, "expected success at 100%");
});

runTest("finds an existing claim by id", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");
  const added = addEvidenceClaim({ evidence: created.evidence, claim: claimInputFixture(), actor, occurredAt });
  assertSuccess(added, "expected add claim success");

  const found = findEvidenceClaim(added.evidence, "claim-001");
  assertEqual(found !== null, true, "expected to find the claim");
  assertEqual(found?.id, "claim-001", "found claim id mismatch");
});

runTest("returns null for an unknown claim id", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const found = findEvidenceClaim(created.evidence, "does-not-exist");
  assertEqual(found, null, "expected null for an unknown claim id");
});

runTest("listEvidenceClaimsByType filters correctly", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");
  const first = addEvidenceClaim({ evidence: created.evidence, claim: claimInputFixture(), actor, occurredAt });
  assertSuccess(first, "expected first claim add success");
  const second = addEvidenceClaim({
    evidence: first.evidence,
    claim: claimInputFixture({ id: "claim-002", type: EvidenceClaimType.MachineUsage, subject: "Escavadeira CAT 320" }),
    actor,
    occurredAt,
  });
  assertSuccess(second, "expected second claim add success");

  const executedQuantityClaims = listEvidenceClaimsByType(second.evidence, EvidenceClaimType.ExecutedQuantity);
  assertEqual(executedQuantityClaims.length, 1, "expected one executed_quantity claim");
  assertEqual(executedQuantityClaims[0]?.id, "claim-001", "filtered claim id mismatch");

  const machineUsageClaims = listEvidenceClaimsByType(second.evidence, EvidenceClaimType.MachineUsage);
  assertEqual(machineUsageClaims.length, 1, "expected one machine_usage claim");

  const noneClaims = listEvidenceClaimsByType(second.evidence, EvidenceClaimType.SafetyOccurrence);
  assertEqual(noneClaims.length, 0, "expected zero safety_occurrence claims");
  assertEqual(Object.isFrozen(noneClaims), true, "filtered result should be frozen even when empty");
});

runTest("summarizeEvidenceClaims matches evidence state", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");
  const first = addEvidenceClaim({ evidence: created.evidence, claim: claimInputFixture(), actor, occurredAt });
  assertSuccess(first, "expected first claim add success");
  const second = addEvidenceClaim({
    evidence: first.evidence,
    claim: {
      id: "claim-002",
      type: EvidenceClaimType.DailyReportEntry,
      subject: "Diario de obra registra ocorrencia.",
    },
    actor,
    occurredAt,
  });
  assertSuccess(second, "expected second claim add success");

  const summary = summarizeEvidenceClaims(second.evidence);
  assertEqual(summary.totalClaims, 2, "totalClaims mismatch");
  assertEqual(summary.claimsWithQuantity, 1, "claimsWithQuantity mismatch");
  assertEqual(summary.distinctClaimTypes, 2, "distinctClaimTypes mismatch");
});

runTest("blocks adding a claim while evidence is Approved", () => {
  const approved = buildApprovedEvidenceFixture();

  const result = addEvidenceClaim({ evidence: approved, claim: claimInputFixture(), actor, occurredAt });

  assertFailure(result, "expected claim add blocked while Approved");
  assertEqual(result.errors[0]?.code, "evidence_locked_for_claims", "error code mismatch");
});

runTest("blocks adding a claim while evidence is Archived", () => {
  const approved = buildApprovedEvidenceFixture();
  const archivedResult = archiveFieldEvidence({ evidence: approved, actor, occurredAt });
  assertSuccess(archivedResult, "expected archive success as setup step");

  const result = addEvidenceClaim({ evidence: archivedResult.evidence, claim: claimInputFixture(), actor, occurredAt });

  assertFailure(result, "expected claim add blocked while Archived");
  assertEqual(result.errors[0]?.code, "evidence_locked_for_claims", "error code mismatch");
});

runTest("adding a claim grows trace", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");
  assertEqual(created.evidence.trace.length, 1, "trace length after creation mismatch");

  const result = addEvidenceClaim({ evidence: created.evidence, claim: claimInputFixture(), actor, occurredAt });
  assertSuccess(result, "expected add claim success");
  assertEqual(result.evidence.trace.length, 2, "trace length after claim add mismatch");
  assertEqual(result.evidence.trace[1]?.action, "claim_added", "trace action mismatch");
});

runTest("adding a claim does not grow the timeline", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");
  assertEqual(created.evidence.timeline.length, 1, "timeline length after creation mismatch");

  const result = addEvidenceClaim({ evidence: created.evidence, claim: claimInputFixture(), actor, occurredAt });
  assertSuccess(result, "expected add claim success");
  assertEqual(result.evidence.timeline.length, 1, "timeline should not grow when a claim is added");
  assertEqual(result.evidence.status, EvidenceStatus.Draft, "status should not change when a claim is added");
});

runTest("claim addition output is deeply immutable", () => {
  const created = createFieldEvidence(createEvidenceInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addEvidenceClaim({ evidence: created.evidence, claim: claimInputFixture(), actor, occurredAt });

  assertSuccess(result, "expected add claim success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.evidence), true, "evidence should be frozen");
  assertEqual(Object.isFrozen(result.evidence.claims), true, "claims should be frozen");
  assertEqual(Object.isFrozen(result.evidence.claims[0]), true, "individual claim should be frozen");
  assertEqual(Object.isFrozen(result.evidence.claims[0]?.quantity), true, "claim quantity should be frozen");
});

runTest("claim addition is deterministic for identical input", () => {
  const buildWithClaim = () => {
    const created = createFieldEvidence(createEvidenceInputFixture());
    assertSuccess(created, "expected creation success");
    const result = addEvidenceClaim({ evidence: created.evidence, claim: claimInputFixture(), actor, occurredAt });
    assertSuccess(result, "expected add claim success");
    return result;
  };

  const first = JSON.stringify(buildWithClaim());
  const second = JSON.stringify(buildWithClaim());
  assertEqual(first, second, "expected deterministic claim addition output");
});

runTest("valid bundle creation", () => {
  const result = createEvidenceBundle(createBundleInputFixture());

  assertBundleSuccess(result, "expected bundle creation success");
  assertEqual(result.bundle.id, bundleId, "id mismatch");
  assertEqual(result.bundle.title, "Escavacao - Frente 03 - Dia 10/07/2026", "title mismatch");
  assertEqual(result.bundle.status, EvidenceBundleStatus.Draft, "initial status mismatch");
  assertEqual(result.bundle.evidenceIds.length, 0, "expected evidenceIds to start empty");
  assertEqual(result.bundle.primaryEvidenceId, null, "expected primaryEvidenceId to default to null");
  assertEqual(Array.isArray(result.bundle.tags), true, "tags must never be null");
  assertEqual(result.bundle.timeline.length, 1, "timeline count mismatch");
  assertEqual(result.bundle.timeline[0]?.type, "bundle_created", "timeline type mismatch");
  assertEqual(result.bundle.trace.length, 1, "trace count mismatch");
});

runTest("bundle creation accepts an explicit initial evidenceIds batch and primary", () => {
  const result = createEvidenceBundle(
    createBundleInputFixture({
      evidenceIds: ["evidence-001", "evidence-002"],
      primaryEvidenceId: "evidence-001",
    }),
  );

  assertBundleSuccess(result, "expected bundle creation success");
  assertEqual(result.bundle.evidenceIds.length, 2, "expected two seeded evidenceIds");
  assertEqual(result.bundle.primaryEvidenceId, "evidence-001", "primaryEvidenceId mismatch");
});

runTest("rejects missing bundle id", () => {
  const result = createEvidenceBundle(createBundleInputFixture({ id: "" }));

  assertBundleFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejects missing bundle title", () => {
  const result = createEvidenceBundle(createBundleInputFixture({ title: "" }));

  assertBundleFailure(result, "expected missing title failure");
  assertEqual(result.errors[0]?.code, "missing_title", "error code mismatch");
});

runTest("rejects missing bundle description", () => {
  const result = createEvidenceBundle(createBundleInputFixture({ description: "" }));

  assertBundleFailure(result, "expected missing description failure");
  assertEqual(result.errors[0]?.code, "missing_description", "error code mismatch");
});

runTest("rejects duplicated evidenceIds at creation", () => {
  const result = createEvidenceBundle(
    createBundleInputFixture({ evidenceIds: ["evidence-001", "evidence-001"] }),
  );

  assertBundleFailure(result, "expected duplicate evidence id failure");
  assertEqual(result.errors[0]?.code, "duplicate_evidence_id", "error code mismatch");
});

runTest("rejects a primaryEvidenceId not present in evidenceIds at creation", () => {
  const result = createEvidenceBundle(
    createBundleInputFixture({ evidenceIds: ["evidence-001"], primaryEvidenceId: "evidence-999" }),
  );

  assertBundleFailure(result, "expected unknown primary evidence reference failure");
  assertEqual(result.errors[0]?.code, "unknown_primary_evidence_reference", "error code mismatch");
});

runTest("adds evidence to a bundle", () => {
  const created = createEvidenceBundle(createBundleInputFixture());
  assertBundleSuccess(created, "expected bundle creation success");

  const result = addEvidenceToBundle({ bundle: created.bundle, evidenceId: "evidence-001", actor, occurredAt });

  assertBundleSuccess(result, "expected add evidence success");
  assertEqual(result.bundle.evidenceIds.length, 1, "evidenceIds count mismatch");
  assertEqual(result.bundle.evidenceIds[0], "evidence-001", "evidenceId mismatch");
});

runTest("rejects adding a duplicate evidenceId to a bundle", () => {
  const created = createEvidenceBundle(createBundleInputFixture());
  assertBundleSuccess(created, "expected bundle creation success");
  const first = addEvidenceToBundle({ bundle: created.bundle, evidenceId: "evidence-001", actor, occurredAt });
  assertBundleSuccess(first, "expected first add success");

  const result = addEvidenceToBundle({ bundle: first.bundle, evidenceId: "evidence-001", actor, occurredAt });

  assertBundleFailure(result, "expected duplicate evidence id failure");
  assertEqual(result.errors[0]?.code, "duplicate_evidence_id", "error code mismatch");
});

runTest("removes evidence from a bundle", () => {
  const created = createEvidenceBundle(createBundleInputFixture());
  assertBundleSuccess(created, "expected bundle creation success");
  const added = addEvidenceToBundle({ bundle: created.bundle, evidenceId: "evidence-001", actor, occurredAt });
  assertBundleSuccess(added, "expected add success");

  const result = removeEvidenceFromBundle({ bundle: added.bundle, evidenceId: "evidence-001", actor, occurredAt });

  assertBundleSuccess(result, "expected remove evidence success");
  assertEqual(result.bundle.evidenceIds.length, 0, "expected evidenceIds to be empty after removal");
});

runTest("rejects removing an evidenceId that is not present", () => {
  const created = createEvidenceBundle(createBundleInputFixture());
  assertBundleSuccess(created, "expected bundle creation success");

  const result = removeEvidenceFromBundle({ bundle: created.bundle, evidenceId: "does-not-exist", actor, occurredAt });

  assertBundleFailure(result, "expected evidence id not found failure");
  assertEqual(result.errors[0]?.code, "evidence_id_not_found", "error code mismatch");
});

runTest("blocks removing the primaryEvidenceId without clearing it first", () => {
  const created = createEvidenceBundle(
    createBundleInputFixture({ evidenceIds: ["evidence-001"], primaryEvidenceId: "evidence-001" }),
  );
  assertBundleSuccess(created, "expected bundle creation success");

  const result = removeEvidenceFromBundle({ bundle: created.bundle, evidenceId: "evidence-001", actor, occurredAt });

  assertBundleFailure(result, "expected cannot remove primary evidence failure");
  assertEqual(result.errors[0]?.code, "cannot_remove_primary_evidence", "error code mismatch");
});

runTest("allows removing a former primary after clearing it", () => {
  const created = createEvidenceBundle(
    createBundleInputFixture({ evidenceIds: ["evidence-001"], primaryEvidenceId: "evidence-001" }),
  );
  assertBundleSuccess(created, "expected bundle creation success");

  const cleared = setPrimaryEvidence({ bundle: created.bundle, evidenceId: null, actor, occurredAt });
  assertBundleSuccess(cleared, "expected clearing primary to succeed");
  assertEqual(cleared.bundle.primaryEvidenceId, null, "expected primary to be cleared");

  const result = removeEvidenceFromBundle({ bundle: cleared.bundle, evidenceId: "evidence-001", actor, occurredAt });
  assertBundleSuccess(result, "expected removal to succeed after clearing primary");
});

runTest("sets a valid primary evidence", () => {
  const created = createEvidenceBundle(createBundleInputFixture({ evidenceIds: ["evidence-001", "evidence-002"] }));
  assertBundleSuccess(created, "expected bundle creation success");

  const result = setPrimaryEvidence({ bundle: created.bundle, evidenceId: "evidence-002", actor, occurredAt });

  assertBundleSuccess(result, "expected set primary success");
  assertEqual(result.bundle.primaryEvidenceId, "evidence-002", "primaryEvidenceId mismatch");
});

runTest("rejects setting a primary evidence not present in evidenceIds", () => {
  const created = createEvidenceBundle(createBundleInputFixture({ evidenceIds: ["evidence-001"] }));
  assertBundleSuccess(created, "expected bundle creation success");

  const result = setPrimaryEvidence({ bundle: created.bundle, evidenceId: "evidence-999", actor, occurredAt });

  assertBundleFailure(result, "expected unknown primary evidence reference failure");
  assertEqual(result.errors[0]?.code, "unknown_primary_evidence_reference", "error code mismatch");
});

runTest("valid bundle transition path: Draft -> Open -> UnderReview -> Validated -> Archived", () => {
  const created = createEvidenceBundle(createBundleInputFixture());
  assertBundleSuccess(created, "expected bundle creation success");

  const opened = openEvidenceBundle({ bundle: created.bundle, actor, occurredAt });
  assertBundleSuccess(opened, "expected open success");
  assertEqual(opened.bundle.status, EvidenceBundleStatus.Open, "status after open mismatch");

  const underReview = submitEvidenceBundleForReview({ bundle: opened.bundle, actor, occurredAt });
  assertBundleSuccess(underReview, "expected submit for review success");
  assertEqual(underReview.bundle.status, EvidenceBundleStatus.UnderReview, "status after submit mismatch");

  const validated = validateEvidenceBundle({ bundle: underReview.bundle, actor, occurredAt });
  assertBundleSuccess(validated, "expected validate success");
  assertEqual(validated.bundle.status, EvidenceBundleStatus.Validated, "status after validate mismatch");

  const archived = archiveEvidenceBundle({ bundle: validated.bundle, actor, occurredAt });
  assertBundleSuccess(archived, "expected archive success");
  assertEqual(archived.bundle.status, EvidenceBundleStatus.Archived, "status after archive mismatch");
});

runTest("valid bundle rejection path: UnderReview -> Rejected -> Archived", () => {
  const created = createEvidenceBundle(createBundleInputFixture());
  assertBundleSuccess(created, "expected bundle creation success");
  const opened = openEvidenceBundle({ bundle: created.bundle, actor, occurredAt });
  assertBundleSuccess(opened, "expected open success");
  const underReview = submitEvidenceBundleForReview({ bundle: opened.bundle, actor, occurredAt });
  assertBundleSuccess(underReview, "expected submit for review success");

  const rejected = rejectEvidenceBundle({ bundle: underReview.bundle, actor, occurredAt });
  assertBundleSuccess(rejected, "expected reject success");
  assertEqual(rejected.bundle.status, EvidenceBundleStatus.Rejected, "status after reject mismatch");

  const archived = archiveEvidenceBundle({ bundle: rejected.bundle, actor, occurredAt });
  assertBundleSuccess(archived, "expected archive success");
  assertEqual(archived.bundle.status, EvidenceBundleStatus.Archived, "status after archive mismatch");
});

runTest("Draft and Open can archive directly", () => {
  const created = createEvidenceBundle(createBundleInputFixture());
  assertBundleSuccess(created, "expected bundle creation success");

  const archivedFromDraft = archiveEvidenceBundle({ bundle: created.bundle, actor, occurredAt });
  assertBundleSuccess(archivedFromDraft, "expected archive from Draft to succeed");

  const opened = openEvidenceBundle({ bundle: created.bundle, actor, occurredAt });
  assertBundleSuccess(opened, "expected open success");
  const archivedFromOpen = archiveEvidenceBundle({ bundle: opened.bundle, actor, occurredAt });
  assertBundleSuccess(archivedFromOpen, "expected archive from Open to succeed");
});

runTest("rejects invalid bundle status transitions", () => {
  const created = createEvidenceBundle(createBundleInputFixture());
  assertBundleSuccess(created, "expected bundle creation success");

  const result = submitEvidenceBundleForReview({ bundle: created.bundle, actor, occurredAt });

  assertBundleFailure(result, "expected invalid transition failure (Draft -> UnderReview)");
  assertEqual(result.errors[0]?.code, "invalid_evidence_bundle_status_transition", "error code mismatch");
});

runTest("Validated is operationally terminal: blocks new evidence membership changes but can still archive", () => {
  const validated = buildValidatedBundleFixture();

  const addResult = addEvidenceToBundle({ bundle: validated, evidenceId: "evidence-999", actor, occurredAt });
  assertBundleFailure(addResult, "expected add blocked while Validated");
  assertEqual(addResult.errors[0]?.code, "bundle_locked_for_evidence_changes", "error code mismatch");

  const backToReview = submitEvidenceBundleForReview({ bundle: validated, actor, occurredAt });
  assertBundleFailure(backToReview, "expected Validated -> UnderReview to be rejected");
  assertEqual(backToReview.errors[0]?.code, "invalid_evidence_bundle_status_transition", "error code mismatch");

  const archived = archiveEvidenceBundle({ bundle: validated, actor, occurredAt });
  assertBundleSuccess(archived, "expected Validated -> Archived to succeed");
});

runTest("Rejected is operationally terminal: blocks new evidence membership changes but can still archive", () => {
  const created = createEvidenceBundle(createBundleInputFixture());
  assertBundleSuccess(created, "expected bundle creation success");
  const opened = openEvidenceBundle({ bundle: created.bundle, actor, occurredAt });
  assertBundleSuccess(opened, "expected open success");
  const underReview = submitEvidenceBundleForReview({ bundle: opened.bundle, actor, occurredAt });
  assertBundleSuccess(underReview, "expected submit for review success");
  const rejectedResult = rejectEvidenceBundle({ bundle: underReview.bundle, actor, occurredAt });
  assertBundleSuccess(rejectedResult, "expected reject success");
  const rejected = rejectedResult.bundle;

  const addResult = addEvidenceToBundle({ bundle: rejected, evidenceId: "evidence-999", actor, occurredAt });
  assertBundleFailure(addResult, "expected add blocked while Rejected");
  assertEqual(addResult.errors[0]?.code, "bundle_locked_for_evidence_changes", "error code mismatch");

  const archived = archiveEvidenceBundle({ bundle: rejected, actor, occurredAt });
  assertBundleSuccess(archived, "expected Rejected -> Archived to succeed");
});

runTest("Archived is an absolute terminal: blocks any further mutation", () => {
  const validated = buildValidatedBundleFixture();
  const archivedResult = archiveEvidenceBundle({ bundle: validated, actor, occurredAt });
  assertBundleSuccess(archivedResult, "expected archive success as setup step");
  const archived = archivedResult.bundle;

  const statusAttempts: ReadonlyArray<() => EvidenceBundleResult> = [
    () => openEvidenceBundle({ bundle: archived, actor, occurredAt }),
    () => submitEvidenceBundleForReview({ bundle: archived, actor, occurredAt }),
    () => validateEvidenceBundle({ bundle: archived, actor, occurredAt }),
    () => rejectEvidenceBundle({ bundle: archived, actor, occurredAt }),
    () => archiveEvidenceBundle({ bundle: archived, actor, occurredAt }),
  ];

  statusAttempts.forEach((attempt, index) => {
    const result = attempt();
    assertBundleFailure(result, `expected terminal block on status attempt #${index}`);
    assertEqual(result.errors[0]?.code, "bundle_terminal", `error code mismatch on status attempt #${index}`);
  });

  const addResult = addEvidenceToBundle({ bundle: archived, evidenceId: "evidence-999", actor, occurredAt });
  assertBundleFailure(addResult, "expected add blocked while Archived");
  assertEqual(addResult.errors[0]?.code, "bundle_locked_for_evidence_changes", "error code mismatch");
});

runTest("every bundle mutation grows trace", () => {
  const created = createEvidenceBundle(createBundleInputFixture());
  assertBundleSuccess(created, "expected bundle creation success");
  assertEqual(created.bundle.trace.length, 1, "trace length after creation mismatch");

  const added = addEvidenceToBundle({ bundle: created.bundle, evidenceId: "evidence-001", actor, occurredAt });
  assertBundleSuccess(added, "expected add success");
  assertEqual(added.bundle.trace.length, 2, "trace length after add mismatch");

  const opened = openEvidenceBundle({ bundle: added.bundle, actor, occurredAt });
  assertBundleSuccess(opened, "expected open success");
  assertEqual(opened.bundle.trace.length, 3, "trace length after open mismatch");
});

runTest("only status transitions grow the timeline, not membership changes", () => {
  const created = createEvidenceBundle(createBundleInputFixture());
  assertBundleSuccess(created, "expected bundle creation success");
  assertEqual(created.bundle.timeline.length, 1, "timeline length after creation mismatch");

  const added = addEvidenceToBundle({ bundle: created.bundle, evidenceId: "evidence-001", actor, occurredAt });
  assertBundleSuccess(added, "expected add success");
  assertEqual(added.bundle.timeline.length, 1, "timeline should not grow when evidence is added");

  const primarySet = setPrimaryEvidence({ bundle: added.bundle, evidenceId: "evidence-001", actor, occurredAt });
  assertBundleSuccess(primarySet, "expected set primary success");
  assertEqual(primarySet.bundle.timeline.length, 1, "timeline should not grow when primary is set");

  const primaryCleared = setPrimaryEvidence({ bundle: primarySet.bundle, evidenceId: null, actor, occurredAt });
  assertBundleSuccess(primaryCleared, "expected clear primary success");
  assertEqual(primaryCleared.bundle.timeline.length, 1, "timeline should not grow when primary is cleared");

  const removed = removeEvidenceFromBundle({
    bundle: primaryCleared.bundle,
    evidenceId: "evidence-001",
    actor,
    occurredAt,
  });
  assertBundleSuccess(removed, "expected remove success");
  assertEqual(removed.bundle.timeline.length, 1, "timeline should not grow when evidence is removed");

  const opened = openEvidenceBundle({ bundle: added.bundle, actor, occurredAt });
  assertBundleSuccess(opened, "expected open success");
  assertEqual(opened.bundle.timeline.length, 2, "timeline should grow on a status transition");
});

runTest("summarizeEvidenceBundle matches bundle state", () => {
  const created = createEvidenceBundle(createBundleInputFixture({ evidenceIds: ["evidence-001"], primaryEvidenceId: "evidence-001" }));
  assertBundleSuccess(created, "expected bundle creation success");

  const summary = summarizeEvidenceBundle(created.bundle);
  assertEqual(summary.status, EvidenceBundleStatus.Draft, "status mismatch");
  assertEqual(summary.totalEvidenceIds, 1, "totalEvidenceIds mismatch");
  assertEqual(summary.hasPrimaryEvidence, true, "hasPrimaryEvidence mismatch");
  assertEqual(summary.totalTraceEntries, 1, "totalTraceEntries mismatch");
  assertEqual(summary.totalTimelineEntries, 1, "totalTimelineEntries mismatch");
  assertEqual(summary.isTerminal, false, "isTerminal mismatch");

  const validated = buildValidatedBundleFixture();
  assertEqual(summarizeEvidenceBundle(validated).isTerminal, false, "validated isTerminal mismatch (operational, not absolute)");

  const archivedResult = archiveEvidenceBundle({ bundle: validated, actor, occurredAt });
  assertBundleSuccess(archivedResult, "expected archive success as setup step");
  assertEqual(summarizeEvidenceBundle(archivedResult.bundle).isTerminal, true, "archived isTerminal mismatch");
});

runTest("bundle output is deeply immutable", () => {
  const result = createEvidenceBundle(createBundleInputFixture());

  assertBundleSuccess(result, "expected bundle creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.bundle), true, "bundle should be frozen");
  assertEqual(Object.isFrozen(result.bundle.evidenceIds), true, "evidenceIds should be frozen");
  assertEqual(Object.isFrozen(result.bundle.tags), true, "tags should be frozen");
  assertEqual(Object.isFrozen(result.bundle.trace), true, "trace should be frozen");
  assertEqual(Object.isFrozen(result.bundle.timeline), true, "timeline should be frozen");

  const added = addEvidenceToBundle({ bundle: result.bundle, evidenceId: "evidence-001", actor, occurredAt });
  assertBundleSuccess(added, "expected add success");
  assertEqual(Object.isFrozen(added.bundle), true, "bundle after add should be frozen");
  assertEqual(Object.isFrozen(added.bundle.evidenceIds), true, "evidenceIds after add should be frozen");
});

runTest("bundle creation is deterministic for identical input", () => {
  const input = createBundleInputFixture();
  const first = JSON.stringify(createEvidenceBundle(input));
  const second = JSON.stringify(createEvidenceBundle(input));

  assertEqual(first, second, "expected deterministic bundle creation output");
});

runTest("bundle mutation is deterministic across identical operations", () => {
  const buildMutated = () => {
    const created = createEvidenceBundle(createBundleInputFixture());
    assertBundleSuccess(created, "expected bundle creation success");
    const added = addEvidenceToBundle({ bundle: created.bundle, evidenceId: "evidence-001", actor, occurredAt });
    assertBundleSuccess(added, "expected add success");
    return added;
  };

  const first = JSON.stringify(buildMutated());
  const second = JSON.stringify(buildMutated());
  assertEqual(first, second, "expected deterministic bundle mutation output");
});

runTest("valid evidence review creation", () => {
  const result = createEvidenceReview(createReviewInputFixture());

  assertReviewSuccess(result, "expected review creation success");
  assertEqual(result.review.id, reviewId, "id mismatch");
  assertEqual(result.review.targetType, EvidenceReviewTargetType.FieldEvidence, "targetType mismatch");
  assertEqual(result.review.targetId, evidenceId, "targetId mismatch");
  assertEqual(result.review.reviewer, reviewer, "reviewer mismatch");
  assertEqual(result.review.status, EvidenceReviewStatus.Draft, "initial status mismatch");
  assertEqual(result.review.decision, EvidenceReviewDecision.None, "initial decision mismatch");
  assertEqual(result.review.comments, null, "comments should default to null");
  assertEqual(result.review.requestedAdditionalEvidence.length, 0, "requested evidence should start empty");
  assertEqual(Array.isArray(result.review.requestedAdditionalEvidence), true, "requested evidence must never be null");
  assertEqual(result.review.timeline.length, 1, "timeline count mismatch");
  assertEqual(result.review.timeline[0]?.type, "review_created", "timeline type mismatch");
  assertEqual(result.review.trace.length, 1, "trace count mismatch");
  assertEqual(result.review.trace[0]?.action, "review_created", "trace action mismatch");
});

runTest("rejects evidence review missing required fields", () => {
  [
    { overrides: { id: "" }, code: "missing_id" },
    { overrides: { targetType: "" as EvidenceReviewTargetType }, code: "missing_target_type" },
    { overrides: { targetId: "" }, code: "missing_target_id" },
    { overrides: { reviewer: "" }, code: "missing_reviewer" },
  ].forEach(({ overrides, code }) => {
    const result = createEvidenceReview(createReviewInputFixture(overrides));

    assertReviewFailure(result, `expected required field failure for ${code}`);
    assertEqual(result.errors[0]?.code, code, `error code mismatch for ${code}`);
  });
});

runTest("requests an evidence review", () => {
  const created = createEvidenceReview(createReviewInputFixture());
  assertReviewSuccess(created, "expected review creation success");

  const requested = requestEvidenceReview({ review: created.review, actor, occurredAt });

  assertReviewSuccess(requested, "expected request success");
  assertEqual(requested.review.status, EvidenceReviewStatus.Requested, "status after request mismatch");
  assertEqual(requested.review.decision, EvidenceReviewDecision.None, "decision after request mismatch");
});

runTest("starts an evidence review", () => {
  const created = createEvidenceReview(createReviewInputFixture());
  assertReviewSuccess(created, "expected review creation success");
  const requested = requestEvidenceReview({ review: created.review, actor, occurredAt });
  assertReviewSuccess(requested, "expected request success");

  const inReview = startEvidenceReview({ review: requested.review, actor, occurredAt });

  assertReviewSuccess(inReview, "expected start success");
  assertEqual(inReview.review.status, EvidenceReviewStatus.InReview, "status after start mismatch");
});

runTest("approves an evidence review with comments", () => {
  const inReview = buildInReviewFixture();

  const approved = approveEvidenceReview({
    review: inReview,
    actor,
    occurredAt,
    comments: "Evidencias tecnicamente suficientes.",
  });

  assertReviewSuccess(approved, "expected approve success");
  assertEqual(approved.review.status, EvidenceReviewStatus.Approved, "status after approve mismatch");
  assertEqual(approved.review.decision, EvidenceReviewDecision.Approved, "decision after approve mismatch");
  assertEqual(approved.review.comments, "Evidencias tecnicamente suficientes.", "comments mismatch");
});

runTest("approves an evidence review with an explicit decision and no comments", () => {
  const inReview = buildInReviewFixture();

  const approved = approveEvidenceReview({
    review: inReview,
    actor,
    occurredAt,
    decision: EvidenceReviewDecision.Approved,
  });

  assertReviewSuccess(approved, "expected approve success through explicit decision");
  assertEqual(approved.review.status, EvidenceReviewStatus.Approved, "status after approve mismatch");
  assertEqual(approved.review.comments, null, "comments should remain null");
});

runTest("rejects approving an evidence review without requirement", () => {
  const inReview = buildInReviewFixture();

  const approved = approveEvidenceReview({ review: inReview, actor, occurredAt });

  assertReviewFailure(approved, "expected approve without comments or explicit decision to fail");
  assertEqual(approved.errors[0]?.code, "missing_approval_requirement", "error code mismatch");
});

runTest("rejects an evidence review with comments", () => {
  const inReview = buildInReviewFixture();

  const rejected = rejectEvidenceReview({
    review: inReview,
    actor,
    occurredAt,
    comments: "Registro insuficiente para decisao tecnica.",
  });

  assertReviewSuccess(rejected, "expected reject success");
  assertEqual(rejected.review.status, EvidenceReviewStatus.Rejected, "status after reject mismatch");
  assertEqual(rejected.review.decision, EvidenceReviewDecision.Rejected, "decision after reject mismatch");
});

runTest("rejects rejecting an evidence review without comments", () => {
  const inReview = buildInReviewFixture();

  const rejected = rejectEvidenceReview({ review: inReview, actor, occurredAt });

  assertReviewFailure(rejected, "expected reject without comments to fail");
  assertEqual(rejected.errors[0]?.code, "missing_comments", "error code mismatch");
});

runTest("requests more evidence from an in-review evidence review", () => {
  const inReview = buildInReviewFixture();

  const result = requestMoreEvidence({
    review: inReview,
    actor,
    occurredAt,
    requestedAdditionalEvidence: ["Foto panoramica da frente executada"],
    comments: "Complementar o registro para fechar a decisao.",
  });

  assertReviewSuccess(result, "expected request more evidence success");
  assertEqual(result.review.status, EvidenceReviewStatus.NeedsMoreEvidence, "status mismatch");
  assertEqual(result.review.decision, EvidenceReviewDecision.NeedsMoreEvidence, "decision mismatch");
  assertEqual(result.review.requestedAdditionalEvidence.length, 1, "requested evidence count mismatch");
});

runTest("rejects requesting more evidence without items", () => {
  const inReview = buildInReviewFixture();

  const result = requestMoreEvidence({
    review: inReview,
    actor,
    occurredAt,
    requestedAdditionalEvidence: [],
  });

  assertReviewFailure(result, "expected empty requested evidence failure");
  assertEqual(result.errors[0]?.code, "missing_requested_additional_evidence", "error code mismatch");
});

runTest("valid evidence review transition path with more evidence", () => {
  const created = createEvidenceReview(createReviewInputFixture());
  assertReviewSuccess(created, "expected review creation success");

  const requested = requestEvidenceReview({ review: created.review, actor, occurredAt });
  assertReviewSuccess(requested, "expected request success");

  const inReview = startEvidenceReview({ review: requested.review, actor, occurredAt });
  assertReviewSuccess(inReview, "expected start success");

  const needsMore = requestMoreEvidence({
    review: inReview.review,
    actor,
    occurredAt,
    requestedAdditionalEvidence: ["Diario de obra do mesmo periodo"],
  });
  assertReviewSuccess(needsMore, "expected more evidence request success");

  const restarted = startEvidenceReview({ review: needsMore.review, actor, occurredAt });
  assertReviewSuccess(restarted, "expected restart success");

  const approved = approveEvidenceReview({
    review: restarted.review,
    actor,
    occurredAt,
    comments: "Complemento analisado e suficiente.",
  });
  assertReviewSuccess(approved, "expected approve success");

  const archived = archiveEvidenceReview({ review: approved.review, actor, occurredAt });
  assertReviewSuccess(archived, "expected archive success");
  assertEqual(archived.review.status, EvidenceReviewStatus.Archived, "archived status mismatch");
});

runTest("valid evidence review rejection transition path", () => {
  const inReview = buildInReviewFixture();

  const rejected = rejectEvidenceReview({
    review: inReview,
    actor,
    occurredAt,
    comments: "Evidencia nao sustenta a decisao tecnica.",
  });
  assertReviewSuccess(rejected, "expected reject success");

  const archived = archiveEvidenceReview({ review: rejected.review, actor, occurredAt });
  assertReviewSuccess(archived, "expected archive success");
  assertEqual(archived.review.status, EvidenceReviewStatus.Archived, "archived status mismatch");
});

runTest("rejects invalid evidence review transitions", () => {
  const created = createEvidenceReview(createReviewInputFixture());
  assertReviewSuccess(created, "expected review creation success");

  const startFromDraft = startEvidenceReview({ review: created.review, actor, occurredAt });
  assertReviewFailure(startFromDraft, "expected Draft -> InReview to fail");
  assertEqual(startFromDraft.errors[0]?.code, "invalid_evidence_review_status_transition", "error code mismatch");

  const requested = requestEvidenceReview({ review: created.review, actor, occurredAt });
  assertReviewSuccess(requested, "expected request success");

  const approveFromRequested = approveEvidenceReview({
    review: requested.review,
    actor,
    occurredAt,
    comments: "Tentativa invalida.",
  });
  assertReviewFailure(approveFromRequested, "expected Requested -> Approved to fail");
  assertEqual(approveFromRequested.errors[0]?.code, "invalid_evidence_review_status_transition", "error code mismatch");

  const inReview = startEvidenceReview({ review: requested.review, actor, occurredAt });
  assertReviewSuccess(inReview, "expected start success");

  const archiveFromInReview = archiveEvidenceReview({ review: inReview.review, actor, occurredAt });
  assertReviewFailure(archiveFromInReview, "expected InReview -> Archived to fail");
  assertEqual(archiveFromInReview.errors[0]?.code, "invalid_evidence_review_status_transition", "error code mismatch");
});

runTest("Approved evidence review is operationally terminal but can archive", () => {
  const approved = buildApprovedReviewFixture();

  const backToRequested = requestEvidenceReview({ review: approved, actor, occurredAt });
  assertReviewFailure(backToRequested, "expected Approved -> Requested to fail");
  assertEqual(backToRequested.errors[0]?.code, "invalid_evidence_review_status_transition", "error code mismatch");

  const backToReview = startEvidenceReview({ review: approved, actor, occurredAt });
  assertReviewFailure(backToReview, "expected Approved -> InReview to fail");
  assertEqual(backToReview.errors[0]?.code, "invalid_evidence_review_status_transition", "error code mismatch");

  const toMoreEvidence = requestMoreEvidence({
    review: approved,
    actor,
    occurredAt,
    requestedAdditionalEvidence: ["Item fora de fluxo"],
  });
  assertReviewFailure(toMoreEvidence, "expected Approved -> NeedsMoreEvidence to fail");
  assertEqual(toMoreEvidence.errors[0]?.code, "invalid_evidence_review_status_transition", "error code mismatch");

  const archived = archiveEvidenceReview({ review: approved, actor, occurredAt });
  assertReviewSuccess(archived, "expected Approved -> Archived to succeed");
});

runTest("Rejected evidence review is operationally terminal but can archive", () => {
  const rejected = buildRejectedReviewFixture();

  const backToReview = startEvidenceReview({ review: rejected, actor, occurredAt });
  assertReviewFailure(backToReview, "expected Rejected -> InReview to fail");
  assertEqual(backToReview.errors[0]?.code, "invalid_evidence_review_status_transition", "error code mismatch");

  const toApproved = approveEvidenceReview({
    review: rejected,
    actor,
    occurredAt,
    comments: "Tentativa invalida.",
  });
  assertReviewFailure(toApproved, "expected Rejected -> Approved to fail");
  assertEqual(toApproved.errors[0]?.code, "invalid_evidence_review_status_transition", "error code mismatch");

  const archived = archiveEvidenceReview({ review: rejected, actor, occurredAt });
  assertReviewSuccess(archived, "expected Rejected -> Archived to succeed");
});

runTest("Archived evidence review is an absolute terminal", () => {
  const archived = buildArchivedReviewFixture();

  const attempts: ReadonlyArray<() => EvidenceReviewResult> = [
    () => requestEvidenceReview({ review: archived, actor, occurredAt }),
    () => startEvidenceReview({ review: archived, actor, occurredAt }),
    () => approveEvidenceReview({ review: archived, actor, occurredAt, comments: "Tentativa invalida." }),
    () => rejectEvidenceReview({ review: archived, actor, occurredAt, comments: "Tentativa invalida." }),
    () =>
      requestMoreEvidence({
        review: archived,
        actor,
        occurredAt,
        requestedAdditionalEvidence: ["Item fora de fluxo"],
      }),
    () => archiveEvidenceReview({ review: archived, actor, occurredAt }),
  ];

  attempts.forEach((attempt, index) => {
    const result = attempt();
    assertReviewFailure(result, `expected archived review to block attempt #${index}`);
    assertEqual(result.errors[0]?.code, "review_terminal", `error code mismatch on attempt #${index}`);
  });
});

runTest("every evidence review mutation grows trace", () => {
  const created = createEvidenceReview(createReviewInputFixture());
  assertReviewSuccess(created, "expected review creation success");
  assertEqual(created.review.trace.length, 1, "trace length after creation mismatch");

  const requested = requestEvidenceReview({ review: created.review, actor, occurredAt });
  assertReviewSuccess(requested, "expected request success");
  assertEqual(requested.review.trace.length, 2, "trace length after request mismatch");

  const inReview = startEvidenceReview({ review: requested.review, actor, occurredAt });
  assertReviewSuccess(inReview, "expected start success");
  assertEqual(inReview.review.trace.length, 3, "trace length after start mismatch");

  const needsMore = requestMoreEvidence({
    review: inReview.review,
    actor,
    occurredAt,
    requestedAdditionalEvidence: ["Registro complementar"],
  });
  assertReviewSuccess(needsMore, "expected request more evidence success");
  assertEqual(needsMore.review.trace.length, 4, "trace length after more evidence mismatch");
});

runTest("evidence review timeline grows only on successful status changes", () => {
  const created = createEvidenceReview(createReviewInputFixture());
  assertReviewSuccess(created, "expected review creation success");
  assertEqual(created.review.timeline.length, 1, "timeline length after creation mismatch");

  const invalid = approveEvidenceReview({
    review: created.review,
    actor,
    occurredAt,
    comments: "Tentativa invalida.",
  });
  assertReviewFailure(invalid, "expected invalid approve failure");
  assertEqual(created.review.timeline.length, 1, "failed mutation must not change original timeline");

  const requested = requestEvidenceReview({ review: created.review, actor, occurredAt });
  assertReviewSuccess(requested, "expected request success");
  assertEqual(requested.review.timeline.length, 2, "timeline length after request mismatch");
  assertEqual(requested.review.timeline[1]?.type, "review_requested", "timeline type mismatch");
});

runTest("summarizeEvidenceReview matches review state", () => {
  const needsMoreResult = requestMoreEvidence({
    review: buildInReviewFixture(),
    actor,
    occurredAt,
    requestedAdditionalEvidence: ["Croqui complementar da area"],
  });
  assertReviewSuccess(needsMoreResult, "expected request more evidence success");

  const summary = summarizeEvidenceReview(needsMoreResult.review);

  assertEqual(summary.targetType, EvidenceReviewTargetType.FieldEvidence, "targetType mismatch");
  assertEqual(summary.targetId, evidenceId, "targetId mismatch");
  assertEqual(summary.status, EvidenceReviewStatus.NeedsMoreEvidence, "status mismatch");
  assertEqual(summary.decision, EvidenceReviewDecision.NeedsMoreEvidence, "decision mismatch");
  assertEqual(summary.totalRequestedAdditionalEvidence, 1, "requested evidence count mismatch");
  assertEqual(summary.totalTraceEntries, needsMoreResult.review.trace.length, "trace count mismatch");
  assertEqual(summary.totalTimelineEntries, needsMoreResult.review.timeline.length, "timeline count mismatch");
  assertEqual(summary.isTerminal, false, "isTerminal mismatch");
  assertEqual(summary.isOperationallyTerminal, false, "isOperationallyTerminal mismatch");

  const approved = buildApprovedReviewFixture();
  assertEqual(summarizeEvidenceReview(approved).isOperationallyTerminal, true, "approved operational terminal mismatch");

  const archived = buildArchivedReviewFixture();
  assertEqual(summarizeEvidenceReview(archived).isTerminal, true, "archived terminal mismatch");
});

runTest("evidence review output is deeply immutable", () => {
  const result = createEvidenceReview(createReviewInputFixture());

  assertReviewSuccess(result, "expected review creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.review), true, "review should be frozen");
  assertEqual(Object.isFrozen(result.review.requestedAdditionalEvidence), true, "requested evidence should be frozen");
  assertEqual(Object.isFrozen(result.review.trace), true, "trace should be frozen");
  assertEqual(Object.isFrozen(result.review.timeline), true, "timeline should be frozen");
  assertEqual(Object.isFrozen(result.review.metadata), true, "metadata should be frozen");

  const requested = requestEvidenceReview({ review: result.review, actor, occurredAt });
  assertReviewSuccess(requested, "expected request success");
  assertEqual(Object.isFrozen(requested.review), true, "review after request should be frozen");
  assertEqual(Object.isFrozen(requested.review.timeline), true, "timeline after request should be frozen");
});

runTest("evidence review creation is deterministic for identical input", () => {
  const input = createReviewInputFixture();
  const first = JSON.stringify(createEvidenceReview(input));
  const second = JSON.stringify(createEvidenceReview(input));

  assertEqual(first, second, "expected deterministic review creation output");
});

runTest("evidence review mutation is deterministic across identical operations", () => {
  const buildMutated = () => {
    const created = createEvidenceReview(createReviewInputFixture());
    assertReviewSuccess(created, "expected review creation success");
    const requested = requestEvidenceReview({ review: created.review, actor, occurredAt });
    assertReviewSuccess(requested, "expected request success");
    return requested;
  };

  const first = JSON.stringify(buildMutated());
  const second = JSON.stringify(buildMutated());
  assertEqual(first, second, "expected deterministic review mutation output");
});

runTest("evidence review source does not import target aggregates", () => {
  const sourceCode = readEvidenceReviewSourceFiles();
  const importStatements = sourceCode.match(/^import[\s\S]*?;$/gm)?.join("\n") ?? "";

  assertEqual(
    importStatements.includes("FieldEvidence"),
    false,
    "EvidenceReview source must not import FieldEvidence",
  );
  assertEqual(
    importStatements.includes("EvidenceBundle"),
    false,
    "EvidenceReview source must not import EvidenceBundle",
  );
  assertEqual(
    /from\s+["']\.\/field-evidence(?:\.types)?["']/.test(importStatements),
    false,
    "EvidenceReview source must not import field-evidence aggregate modules",
  );
});

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourceCode = readDomainSourceFiles();
  const lowerSourceCode = sourceCode.toLowerCase();

  [
    "date.now(",
    "math.random(",
    "crypto.randomuuid",
    "uuid()",
    "measurement-workspace",
    "approval-workflow",
    "bulletin-generator",
    "export-engine",
    "template-engine",
    "official-template",
    "business-fact",
    "decision-case",
    "engines/decision",
    "engineering-contract",
    "engineering-project-context",
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
  ].forEach((forbidden) => {
    assertEqual(
      lowerSourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in domain source: ${forbidden}`,
    );
  });
});

function buildInReviewFixture(): EvidenceReview {
  const created = createEvidenceReview(createReviewInputFixture());
  assertReviewSuccess(created, "expected review creation success");
  const requested = requestEvidenceReview({ review: created.review, actor, occurredAt });
  assertReviewSuccess(requested, "expected request success");
  const inReview = startEvidenceReview({ review: requested.review, actor, occurredAt });
  assertReviewSuccess(inReview, "expected start success");
  return inReview.review;
}

function buildApprovedReviewFixture(): EvidenceReview {
  const inReview = buildInReviewFixture();
  const approved = approveEvidenceReview({
    review: inReview,
    actor,
    occurredAt,
    comments: "Evidencia revisada e tecnicamente aprovada.",
  });
  assertReviewSuccess(approved, "expected approve success");
  return approved.review;
}

function buildRejectedReviewFixture(): EvidenceReview {
  const inReview = buildInReviewFixture();
  const rejected = rejectEvidenceReview({
    review: inReview,
    actor,
    occurredAt,
    comments: "Evidencia insuficiente para aprovacao tecnica.",
  });
  assertReviewSuccess(rejected, "expected reject success");
  return rejected.review;
}

function buildArchivedReviewFixture(): EvidenceReview {
  const approved = buildApprovedReviewFixture();
  const archived = archiveEvidenceReview({ review: approved, actor, occurredAt });
  assertReviewSuccess(archived, "expected archive success");
  return archived.review;
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

function createEvidenceInputFixture(
  overrides: Partial<CreateFieldEvidenceInput> = {},
): CreateFieldEvidenceInput {
  return {
    id: overrides.id ?? evidenceId,
    source: overrides.source ?? EvidenceSource.FieldTeam,
    type: overrides.type ?? EvidenceType.Photo,
    description: overrides.description ?? "Foto do avanco da fundacao do bloco B.",
    captureReference: overrides.captureReference ?? "capture-ref-0001",
    captureDate: overrides.captureDate,
    confidence: overrides.confidence,
    actor: overrides.actor ?? actor,
    occurredAt: overrides.occurredAt ?? occurredAt,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? { source: "field-evidence" },
  };
}

function claimInputFixture(overrides: Partial<EvidenceClaimInput> = {}): EvidenceClaimInput {
  return {
    id: overrides.id ?? "claim-001",
    type: overrides.type ?? EvidenceClaimType.ExecutedQuantity,
    subject: overrides.subject ?? "Escavacao executada",
    quantity:
      overrides.quantity === undefined
        ? { value: 126, unit: EvidenceUnit.CubicMeter }
        : overrides.quantity,
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
    metadata: overrides.metadata ?? { source: "field-evidence" },
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
    metadata: overrides.metadata ?? { source: "field-evidence-review" },
  };
}

function buildValidatedBundleFixture(): EvidenceBundle {
  const created = createEvidenceBundle(createBundleInputFixture());
  assertBundleSuccess(created, "expected bundle creation success");
  const opened = openEvidenceBundle({ bundle: created.bundle, actor, occurredAt });
  assertBundleSuccess(opened, "expected open success");
  const underReview = submitEvidenceBundleForReview({ bundle: opened.bundle, actor, occurredAt });
  assertBundleSuccess(underReview, "expected submit for review success");
  const validated = validateEvidenceBundle({ bundle: underReview.bundle, actor, occurredAt });
  assertBundleSuccess(validated, "expected validate success");
  return validated.bundle;
}

function readDomainSourceFiles(): string {
  const domainDir = resolve(process.cwd(), "src", "domain", "field-evidence");
  return listTsFiles(domainDir)
    .filter((file) => !file.endsWith(".test.ts"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

function readEvidenceReviewSourceFiles(): string {
  const domainDir = resolve(process.cwd(), "src", "domain", "field-evidence");
  return ["evidence-review.ts", "evidence-review.types.ts"]
    .map((file) => readFileSync(join(domainDir, file), "utf8"))
    .join("\n");
}

function listTsFiles(dir: string): ReadonlyArray<string> {
  let entries: ReadonlyArray<string>;

  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const files: string[] = [];

  entries.forEach((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listTsFiles(fullPath));
      return;
    }

    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  });

  return files;
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

function assertSuccess(
  result: FieldEvidenceResult,
  message: string,
): asserts result is Extract<FieldEvidenceResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertFailure(
  result: FieldEvidenceResult,
  message: string,
): asserts result is Extract<FieldEvidenceResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
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

function assertBundleFailure(
  result: EvidenceBundleResult,
  message: string,
): asserts result is Extract<EvidenceBundleResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
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

function assertReviewFailure(
  result: EvidenceReviewResult,
  message: string,
): asserts result is Extract<EvidenceReviewResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
