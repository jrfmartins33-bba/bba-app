import type {
  AddEvidenceClaimInput,
  AddEvidenceToBundleInput,
  ApproveFieldEvidenceInput,
  ArchiveEvidenceBundleInput,
  ArchiveFieldEvidenceInput,
  ClassifyFieldEvidenceInput,
  CreateEvidenceBundleInput,
  CreateFieldEvidenceInput,
  EvidenceBundle,
  EvidenceBundleError,
  EvidenceBundleFailure,
  EvidenceBundleResult,
  EvidenceBundleSuccess,
  EvidenceBundleSummary,
  EvidenceBundleTimelineEvent,
  EvidenceBundleTrace,
  EvidenceClaim,
  EvidenceClaimInput,
  EvidenceClaimSummary,
  FieldEvidence,
  FieldEvidenceError,
  FieldEvidenceFailure,
  FieldEvidenceMetadata,
  FieldEvidenceResult,
  FieldEvidenceSuccess,
  FieldEvidenceSummary,
  FieldEvidenceTimelineEvent,
  FieldEvidenceTrace,
  OpenEvidenceBundleInput,
  RejectEvidenceBundleInput,
  RejectFieldEvidenceInput,
  RemoveEvidenceFromBundleInput,
  SetPrimaryEvidenceInput,
  SubmitEvidenceBundleForReviewInput,
  SubmitFieldEvidenceInput,
  ValidateEvidenceBundleInput,
} from "./field-evidence.types";
import { EvidenceBundleStatus, EvidenceConfidence, EvidenceStatus, EvidenceUnit } from "./field-evidence.types";

export function createFieldEvidence(input: CreateFieldEvidenceInput): FieldEvidenceResult {
  const metadata = createEvidenceMetadata(input);
  const errors = validateEvidenceShell(input, metadata);

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const evidence: FieldEvidence = {
    id: input.id,
    source: input.source,
    type: input.type,
    status: EvidenceStatus.Draft,
    confidence: input.confidence ?? EvidenceConfidence.Medium,
    description: input.description,
    captureDate: input.captureDate ?? null,
    captureReference: input.captureReference,
    claims: [],
    timeline: [
      createTimelineEvent(
        "evidence_created",
        input.occurredAt,
        `Field evidence ${input.id} created from source ${input.source}.`,
        metadata,
      ),
    ],
    trace: [
      createTraceEntry(
        "evidence_created",
        input.actor,
        input.occurredAt,
        `Field evidence ${input.id} created.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<FieldEvidenceSuccess>({
    success: true,
    evidence,
    errors: [],
    warnings: [],
    metadata,
  });
}

export function submitFieldEvidence(input: SubmitFieldEvidenceInput): FieldEvidenceResult {
  return transitionEvidenceStatus(
    input.evidence,
    EvidenceStatus.Submitted,
    "evidence_submitted",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function classifyFieldEvidence(input: ClassifyFieldEvidenceInput): FieldEvidenceResult {
  return transitionEvidenceStatus(
    input.evidence,
    EvidenceStatus.Classified,
    "evidence_classified",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function approveFieldEvidence(input: ApproveFieldEvidenceInput): FieldEvidenceResult {
  return transitionEvidenceStatus(
    input.evidence,
    EvidenceStatus.Approved,
    "evidence_approved",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function rejectFieldEvidence(input: RejectFieldEvidenceInput): FieldEvidenceResult {
  return transitionEvidenceStatus(
    input.evidence,
    EvidenceStatus.Rejected,
    "evidence_rejected",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function archiveFieldEvidence(input: ArchiveFieldEvidenceInput): FieldEvidenceResult {
  return transitionEvidenceStatus(
    input.evidence,
    EvidenceStatus.Archived,
    "evidence_archived",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function addEvidenceClaim(input: AddEvidenceClaimInput): FieldEvidenceResult {
  const metadata = createMutationMetadata(input.evidence, input.metadata);
  const errors = validateClaimMutable(input.evidence, metadata);

  errors.push(...validateSingleClaim(input.claim, metadata));

  if (input.evidence.claims.some((existing) => existing.id === input.claim.id)) {
    errors.push(
      createEvidenceError(
        "duplicate_claim_id",
        "claim.id",
        `Claim id ${input.claim.id} already exists on this evidence.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const claims = [...input.evidence.claims, buildClaim(input.claim)];

  return freezeDomainObject<FieldEvidenceSuccess>({
    success: true,
    evidence: {
      ...input.evidence,
      claims,
      trace: [
        ...input.evidence.trace,
        createTraceEntry(
          "claim_added",
          input.actor,
          input.occurredAt,
          `Claim ${input.claim.id} added to evidence ${input.evidence.id}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function summarizeEvidenceClaims(evidence: FieldEvidence): EvidenceClaimSummary {
  return {
    totalClaims: evidence.claims.length,
    claimsWithQuantity: evidence.claims.filter((claim) => claim.quantity !== null).length,
    distinctClaimTypes: new Set(evidence.claims.map((claim) => claim.type)).size,
  };
}

export function findEvidenceClaim(evidence: FieldEvidence, claimId: string): EvidenceClaim | null {
  const claim = evidence.claims.find((candidate) => candidate.id === claimId);
  return claim ?? null;
}

export function listEvidenceClaimsByType(
  evidence: FieldEvidence,
  type: EvidenceClaim["type"],
): ReadonlyArray<EvidenceClaim> {
  return Object.freeze(evidence.claims.filter((claim) => claim.type === type));
}

export function summarizeFieldEvidence(evidence: FieldEvidence): FieldEvidenceSummary {
  return {
    status: evidence.status,
    confidence: evidence.confidence,
    totalTraceEntries: evidence.trace.length,
    totalTimelineEntries: evidence.timeline.length,
    isTerminal: isTerminalStatus(evidence.status),
  };
}

function isTerminalStatus(status: EvidenceStatus): boolean {
  return status === EvidenceStatus.Archived;
}

function canAdvanceStatus(fromStatus: EvidenceStatus, toStatus: EvidenceStatus): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

/**
 * `Linked` and `UnderReview` are deliberately left with no outgoing or
 * incoming edges this sprint — they exist in the `EvidenceStatus` enum
 * as forward-looking vocabulary for capabilities explicitly out of
 * scope for EPIC 12.1 (Evidence Correlation, Evidence Review), not as
 * reachable states of this aggregate yet.
 */
const allowedTransitions: Readonly<Record<EvidenceStatus, ReadonlyArray<EvidenceStatus>>> = {
  [EvidenceStatus.Draft]: [EvidenceStatus.Submitted, EvidenceStatus.Rejected],
  [EvidenceStatus.Submitted]: [EvidenceStatus.Classified],
  [EvidenceStatus.Classified]: [EvidenceStatus.Approved],
  [EvidenceStatus.Linked]: [],
  [EvidenceStatus.UnderReview]: [],
  [EvidenceStatus.Approved]: [EvidenceStatus.Archived],
  [EvidenceStatus.Rejected]: [EvidenceStatus.Archived],
  [EvidenceStatus.Archived]: [],
};

function transitionEvidenceStatus(
  evidence: FieldEvidence,
  toStatus: EvidenceStatus,
  timelineType: string,
  actor: string,
  occurredAt: string,
  extraMetadata: FieldEvidenceMetadata | undefined,
): FieldEvidenceResult {
  const metadata = createMutationMetadata(evidence, extraMetadata);
  const fromStatus = evidence.status;

  if (isTerminalStatus(fromStatus)) {
    return failureResult(
      [
        createEvidenceError(
          "evidence_terminal",
          "status",
          `Cannot transition evidence from terminal status ${fromStatus}.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  if (!canAdvanceStatus(fromStatus, toStatus)) {
    return failureResult(
      [
        createEvidenceError(
          "invalid_evidence_status_transition",
          "status",
          `Cannot transition evidence from ${fromStatus} to ${toStatus}.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  const updated: FieldEvidence = {
    ...evidence,
    status: toStatus,
    timeline: [
      ...evidence.timeline,
      createTimelineEvent(
        timelineType,
        occurredAt,
        `Field evidence ${evidence.id} moved from ${fromStatus} to ${toStatus}.`,
        metadata,
      ),
    ],
    trace: [
      ...evidence.trace,
      createTraceEntry(
        timelineType,
        actor,
        occurredAt,
        `Field evidence status advanced from ${fromStatus} to ${toStatus}.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<FieldEvidenceSuccess>({
    success: true,
    evidence: updated,
    errors: [],
    warnings: [],
    metadata,
  });
}

function validateEvidenceShell(
  input: CreateFieldEvidenceInput,
  metadata: FieldEvidenceMetadata,
): FieldEvidenceError[] {
  const errors: FieldEvidenceError[] = [];

  if (isBlank(input.id)) {
    errors.push(createEvidenceError("missing_id", "id", "Evidence id is required.", metadata));
  }

  if (isBlank(input.description)) {
    errors.push(
      createEvidenceError("missing_description", "description", "Evidence description is required.", metadata),
    );
  }

  if (isBlank(input.source)) {
    errors.push(createEvidenceError("missing_source", "source", "Evidence source is required.", metadata));
  }

  if (isBlank(input.type)) {
    errors.push(createEvidenceError("missing_type", "type", "Evidence type is required.", metadata));
  }

  if (isBlank(input.captureReference)) {
    errors.push(
      createEvidenceError(
        "missing_capture_reference",
        "captureReference",
        "Evidence capture reference is required.",
        metadata,
      ),
    );
  }

  return errors;
}

function validateClaimMutable(
  evidence: FieldEvidence,
  metadata: FieldEvidenceMetadata,
): FieldEvidenceError[] {
  const errors: FieldEvidenceError[] = [];

  if (evidence.status === EvidenceStatus.Approved || evidence.status === EvidenceStatus.Archived) {
    errors.push(
      createEvidenceError(
        "evidence_locked_for_claims",
        "status",
        `Cannot add a claim while evidence status is ${evidence.status}.`,
        metadata,
      ),
    );
  }

  return errors;
}

function validateSingleClaim(
  claim: EvidenceClaimInput,
  metadata: FieldEvidenceMetadata,
): FieldEvidenceError[] {
  const errors: FieldEvidenceError[] = [];

  if (isBlank(claim.id)) {
    errors.push(createEvidenceError("missing_claim_id", "claim.id", "Claim id is required.", metadata));
  }

  if (isBlank(claim.type)) {
    errors.push(createEvidenceError("missing_claim_type", "claim.type", "Claim type is required.", metadata));
  }

  if (isBlank(claim.subject)) {
    errors.push(
      createEvidenceError("missing_claim_subject", "claim.subject", "Claim subject is required.", metadata),
    );
  }

  const quantity = claim.quantity ?? null;

  if (quantity !== null) {
    if (isBlank(quantity.unit)) {
      errors.push(
        createEvidenceError(
          "missing_claim_unit",
          "claim.quantity.unit",
          "Claim quantity unit is required when a quantity is provided.",
          metadata,
        ),
      );
    }

    if (quantity.value < 0) {
      errors.push(
        createEvidenceError(
          "negative_claim_quantity",
          "claim.quantity.value",
          `Claim quantity value cannot be negative, got ${quantity.value}.`,
          metadata,
        ),
      );
    }

    if (quantity.unit === EvidenceUnit.Percent && quantity.value > 100) {
      errors.push(
        createEvidenceError(
          "invalid_claim_percent",
          "claim.quantity.value",
          `Claim quantity in percent cannot exceed 100, got ${quantity.value}.`,
          metadata,
        ),
      );
    }
  }

  return errors;
}

function buildClaim(claim: EvidenceClaimInput): EvidenceClaim {
  return {
    id: claim.id,
    type: claim.type,
    subject: claim.subject,
    quantity: claim.quantity ?? null,
    observedAt: claim.observedAt ?? null,
    notes: claim.notes ?? null,
    metadata: claim.metadata ?? {},
  };
}

function failureResult(
  errors: ReadonlyArray<FieldEvidenceError>,
  metadata: FieldEvidenceMetadata,
): FieldEvidenceFailure {
  return freezeDomainObject<FieldEvidenceFailure>({
    success: false,
    evidence: null,
    errors,
    warnings: [],
    metadata,
  });
}

function createTimelineEvent(
  type: string,
  occurredAt: string,
  description: string,
  metadata: FieldEvidenceMetadata,
): FieldEvidenceTimelineEvent {
  return {
    type,
    occurredAt,
    description,
    metadata,
  };
}

function createTraceEntry(
  action: string,
  actor: string,
  occurredAt: string,
  description: string,
  metadata: FieldEvidenceMetadata,
): FieldEvidenceTrace {
  return {
    action,
    actor,
    occurredAt,
    description,
    metadata,
  };
}

function createEvidenceError(
  code: FieldEvidenceError["code"],
  field: string,
  message: string,
  metadata: FieldEvidenceMetadata,
): FieldEvidenceError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createEvidenceMetadata(input: CreateFieldEvidenceInput): FieldEvidenceMetadata {
  return {
    ...(input.metadata ?? {}),
    evidenceId: input.id,
    source: input.source,
    type: input.type,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createMutationMetadata(
  evidence: FieldEvidence,
  extraMetadata: FieldEvidenceMetadata | undefined,
): FieldEvidenceMetadata {
  return {
    ...evidence.metadata,
    ...(extraMetadata ?? {}),
    evidenceId: evidence.id,
    source: evidence.source,
    type: evidence.type,
  };
}

export function createEvidenceBundle(input: CreateEvidenceBundleInput): EvidenceBundleResult {
  const metadata = createBundleMetadata(input);
  const evidenceIds = input.evidenceIds ?? [];
  const tags = input.tags ?? [];
  const errors = validateBundleShell(input, evidenceIds, metadata);

  if (errors.length > 0) {
    return bundleFailureResult(errors, metadata);
  }

  const bundle: EvidenceBundle = {
    id: input.id,
    title: input.title,
    description: input.description,
    status: EvidenceBundleStatus.Draft,
    evidenceIds: [...evidenceIds],
    primaryEvidenceId: input.primaryEvidenceId ?? null,
    tags: [...tags],
    timeline: [
      createBundleTimelineEvent(
        "bundle_created",
        input.occurredAt,
        `Evidence bundle ${input.id} created.`,
        metadata,
      ),
    ],
    trace: [
      createBundleTraceEntry(
        "bundle_created",
        input.actor,
        input.occurredAt,
        `Evidence bundle ${input.id} created.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<EvidenceBundleSuccess>({
    success: true,
    bundle,
    errors: [],
    warnings: [],
    metadata,
  });
}

export function openEvidenceBundle(input: OpenEvidenceBundleInput): EvidenceBundleResult {
  return transitionBundleStatus(
    input.bundle,
    EvidenceBundleStatus.Open,
    "bundle_opened",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function submitEvidenceBundleForReview(
  input: SubmitEvidenceBundleForReviewInput,
): EvidenceBundleResult {
  return transitionBundleStatus(
    input.bundle,
    EvidenceBundleStatus.UnderReview,
    "bundle_submitted_for_review",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function validateEvidenceBundle(input: ValidateEvidenceBundleInput): EvidenceBundleResult {
  return transitionBundleStatus(
    input.bundle,
    EvidenceBundleStatus.Validated,
    "bundle_validated",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function rejectEvidenceBundle(input: RejectEvidenceBundleInput): EvidenceBundleResult {
  return transitionBundleStatus(
    input.bundle,
    EvidenceBundleStatus.Rejected,
    "bundle_rejected",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function archiveEvidenceBundle(input: ArchiveEvidenceBundleInput): EvidenceBundleResult {
  return transitionBundleStatus(
    input.bundle,
    EvidenceBundleStatus.Archived,
    "bundle_archived",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function addEvidenceToBundle(input: AddEvidenceToBundleInput): EvidenceBundleResult {
  const metadata = createBundleMutationMetadata(input.bundle, input.metadata);
  const errors = validateBundleMembershipMutable(input.bundle, metadata);

  if (isBlank(input.evidenceId)) {
    errors.push(createBundleError("missing_evidence_id", "evidenceId", "Evidence id is required.", metadata));
  } else if (input.bundle.evidenceIds.includes(input.evidenceId)) {
    errors.push(
      createBundleError(
        "duplicate_evidence_id",
        "evidenceId",
        `Evidence id ${input.evidenceId} already exists in this bundle.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return bundleFailureResult(errors, metadata);
  }

  return freezeDomainObject<EvidenceBundleSuccess>({
    success: true,
    bundle: {
      ...input.bundle,
      evidenceIds: [...input.bundle.evidenceIds, input.evidenceId],
      trace: [
        ...input.bundle.trace,
        createBundleTraceEntry(
          "evidence_added_to_bundle",
          input.actor,
          input.occurredAt,
          `Evidence ${input.evidenceId} added to bundle ${input.bundle.id}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function removeEvidenceFromBundle(input: RemoveEvidenceFromBundleInput): EvidenceBundleResult {
  const metadata = createBundleMutationMetadata(input.bundle, input.metadata);
  const errors = validateBundleMembershipMutable(input.bundle, metadata);

  if (isBlank(input.evidenceId)) {
    errors.push(createBundleError("missing_evidence_id", "evidenceId", "Evidence id is required.", metadata));
  } else if (!input.bundle.evidenceIds.includes(input.evidenceId)) {
    errors.push(
      createBundleError(
        "evidence_id_not_found",
        "evidenceId",
        `Evidence id ${input.evidenceId} is not present in this bundle.`,
        metadata,
      ),
    );
  } else if (input.bundle.primaryEvidenceId === input.evidenceId) {
    errors.push(
      createBundleError(
        "cannot_remove_primary_evidence",
        "evidenceId",
        `Cannot remove evidence id ${input.evidenceId} while it is the primary evidence. Clear or change the primary first.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return bundleFailureResult(errors, metadata);
  }

  return freezeDomainObject<EvidenceBundleSuccess>({
    success: true,
    bundle: {
      ...input.bundle,
      evidenceIds: input.bundle.evidenceIds.filter((evidenceId) => evidenceId !== input.evidenceId),
      trace: [
        ...input.bundle.trace,
        createBundleTraceEntry(
          "evidence_removed_from_bundle",
          input.actor,
          input.occurredAt,
          `Evidence ${input.evidenceId} removed from bundle ${input.bundle.id}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function setPrimaryEvidence(input: SetPrimaryEvidenceInput): EvidenceBundleResult {
  const metadata = createBundleMutationMetadata(input.bundle, input.metadata);
  const errors = validateBundleMembershipMutable(input.bundle, metadata);

  if (input.evidenceId !== null) {
    if (isBlank(input.evidenceId)) {
      errors.push(createBundleError("missing_evidence_id", "evidenceId", "Evidence id is required.", metadata));
    } else if (!input.bundle.evidenceIds.includes(input.evidenceId)) {
      errors.push(
        createBundleError(
          "unknown_primary_evidence_reference",
          "evidenceId",
          `Evidence id ${input.evidenceId} is not present in evidenceIds.`,
          metadata,
        ),
      );
    }
  }

  if (errors.length > 0) {
    return bundleFailureResult(errors, metadata);
  }

  return freezeDomainObject<EvidenceBundleSuccess>({
    success: true,
    bundle: {
      ...input.bundle,
      primaryEvidenceId: input.evidenceId,
      trace: [
        ...input.bundle.trace,
        createBundleTraceEntry(
          "primary_evidence_set",
          input.actor,
          input.occurredAt,
          `Primary evidence for bundle ${input.bundle.id} set to ${input.evidenceId ?? "null"}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function summarizeEvidenceBundle(bundle: EvidenceBundle): EvidenceBundleSummary {
  return {
    status: bundle.status,
    totalEvidenceIds: bundle.evidenceIds.length,
    hasPrimaryEvidence: bundle.primaryEvidenceId !== null,
    totalTraceEntries: bundle.trace.length,
    totalTimelineEntries: bundle.timeline.length,
    isTerminal: isBundleTerminalStatus(bundle.status),
  };
}

function isBundleTerminalStatus(status: EvidenceBundleStatus): boolean {
  return status === EvidenceBundleStatus.Archived;
}

function canAdvanceBundleStatus(fromStatus: EvidenceBundleStatus, toStatus: EvidenceBundleStatus): boolean {
  return bundleAllowedTransitions[fromStatus].includes(toStatus);
}

const bundleAllowedTransitions: Readonly<Record<EvidenceBundleStatus, ReadonlyArray<EvidenceBundleStatus>>> = {
  [EvidenceBundleStatus.Draft]: [EvidenceBundleStatus.Open, EvidenceBundleStatus.Archived],
  [EvidenceBundleStatus.Open]: [EvidenceBundleStatus.UnderReview, EvidenceBundleStatus.Archived],
  [EvidenceBundleStatus.UnderReview]: [EvidenceBundleStatus.Validated, EvidenceBundleStatus.Rejected],
  [EvidenceBundleStatus.Validated]: [EvidenceBundleStatus.Archived],
  [EvidenceBundleStatus.Rejected]: [EvidenceBundleStatus.Archived],
  [EvidenceBundleStatus.Archived]: [],
};

function transitionBundleStatus(
  bundle: EvidenceBundle,
  toStatus: EvidenceBundleStatus,
  timelineType: string,
  actor: string,
  occurredAt: string,
  extraMetadata: FieldEvidenceMetadata | undefined,
): EvidenceBundleResult {
  const metadata = createBundleMutationMetadata(bundle, extraMetadata);
  const fromStatus = bundle.status;

  if (isBundleTerminalStatus(fromStatus)) {
    return bundleFailureResult(
      [
        createBundleError(
          "bundle_terminal",
          "status",
          `Cannot transition bundle from terminal status ${fromStatus}.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  if (!canAdvanceBundleStatus(fromStatus, toStatus)) {
    return bundleFailureResult(
      [
        createBundleError(
          "invalid_evidence_bundle_status_transition",
          "status",
          `Cannot transition bundle from ${fromStatus} to ${toStatus}.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  const updated: EvidenceBundle = {
    ...bundle,
    status: toStatus,
    timeline: [
      ...bundle.timeline,
      createBundleTimelineEvent(
        timelineType,
        occurredAt,
        `Evidence bundle ${bundle.id} moved from ${fromStatus} to ${toStatus}.`,
        metadata,
      ),
    ],
    trace: [
      ...bundle.trace,
      createBundleTraceEntry(
        timelineType,
        actor,
        occurredAt,
        `Evidence bundle status advanced from ${fromStatus} to ${toStatus}.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<EvidenceBundleSuccess>({
    success: true,
    bundle: updated,
    errors: [],
    warnings: [],
    metadata,
  });
}

function validateBundleShell(
  input: CreateEvidenceBundleInput,
  evidenceIds: ReadonlyArray<string>,
  metadata: FieldEvidenceMetadata,
): EvidenceBundleError[] {
  const errors: EvidenceBundleError[] = [];

  if (isBlank(input.id)) {
    errors.push(createBundleError("missing_id", "id", "Bundle id is required.", metadata));
  }

  if (isBlank(input.title)) {
    errors.push(createBundleError("missing_title", "title", "Bundle title is required.", metadata));
  }

  if (isBlank(input.description)) {
    errors.push(
      createBundleError("missing_description", "description", "Bundle description is required.", metadata),
    );
  }

  const seenEvidenceIds = new Set<string>();
  evidenceIds.forEach((evidenceId) => {
    if (seenEvidenceIds.has(evidenceId)) {
      errors.push(
        createBundleError(
          "duplicate_evidence_id",
          "evidenceIds",
          `Evidence id ${evidenceId} is duplicated.`,
          metadata,
        ),
      );
    } else {
      seenEvidenceIds.add(evidenceId);
    }
  });

  const primaryEvidenceId = input.primaryEvidenceId ?? null;
  if (primaryEvidenceId !== null && !evidenceIds.includes(primaryEvidenceId)) {
    errors.push(
      createBundleError(
        "unknown_primary_evidence_reference",
        "primaryEvidenceId",
        `Primary evidence id ${primaryEvidenceId} is not present in evidenceIds.`,
        metadata,
      ),
    );
  }

  return errors;
}

function validateBundleMembershipMutable(
  bundle: EvidenceBundle,
  metadata: FieldEvidenceMetadata,
): EvidenceBundleError[] {
  const errors: EvidenceBundleError[] = [];

  if (
    bundle.status === EvidenceBundleStatus.Validated ||
    bundle.status === EvidenceBundleStatus.Rejected ||
    bundle.status === EvidenceBundleStatus.Archived
  ) {
    errors.push(
      createBundleError(
        "bundle_locked_for_evidence_changes",
        "status",
        `Cannot change evidence membership while bundle status is ${bundle.status}.`,
        metadata,
      ),
    );
  }

  return errors;
}

function bundleFailureResult(
  errors: ReadonlyArray<EvidenceBundleError>,
  metadata: FieldEvidenceMetadata,
): EvidenceBundleFailure {
  return freezeDomainObject<EvidenceBundleFailure>({
    success: false,
    bundle: null,
    errors,
    warnings: [],
    metadata,
  });
}

function createBundleTimelineEvent(
  type: string,
  occurredAt: string,
  description: string,
  metadata: FieldEvidenceMetadata,
): EvidenceBundleTimelineEvent {
  return {
    type,
    occurredAt,
    description,
    metadata,
  };
}

function createBundleTraceEntry(
  action: string,
  actor: string,
  occurredAt: string,
  description: string,
  metadata: FieldEvidenceMetadata,
): EvidenceBundleTrace {
  return {
    action,
    actor,
    occurredAt,
    description,
    metadata,
  };
}

function createBundleError(
  code: EvidenceBundleError["code"],
  field: string,
  message: string,
  metadata: FieldEvidenceMetadata,
): EvidenceBundleError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createBundleMetadata(input: CreateEvidenceBundleInput): FieldEvidenceMetadata {
  return {
    ...(input.metadata ?? {}),
    bundleId: input.id,
    title: input.title,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createBundleMutationMetadata(
  bundle: EvidenceBundle,
  extraMetadata: FieldEvidenceMetadata | undefined,
): FieldEvidenceMetadata {
  return {
    ...bundle.metadata,
    ...(extraMetadata ?? {}),
    bundleId: bundle.id,
    title: bundle.title,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
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
