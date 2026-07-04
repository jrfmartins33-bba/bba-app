import type {
  ApproveEvidenceReviewInput,
  ArchiveEvidenceReviewInput,
  CreateEvidenceReviewInput,
  EvidenceReview,
  EvidenceReviewError,
  EvidenceReviewFailure,
  EvidenceReviewMetadata,
  EvidenceReviewResult,
  EvidenceReviewSuccess,
  EvidenceReviewSummary,
  EvidenceReviewTimelineEvent,
  EvidenceReviewTrace,
  RejectEvidenceReviewInput,
  RequestEvidenceReviewInput,
  RequestMoreEvidenceInput,
  StartEvidenceReviewInput,
} from "./evidence-review.types";
import { EvidenceReviewDecision, EvidenceReviewStatus } from "./evidence-review.types";

export function createEvidenceReview(input: CreateEvidenceReviewInput): EvidenceReviewResult {
  const metadata = createReviewMetadata(input);
  const errors = validateReviewShell(input, metadata);

  if (errors.length > 0) {
    return reviewFailureResult(errors, metadata);
  }

  const review: EvidenceReview = {
    id: input.id,
    targetType: input.targetType,
    targetId: input.targetId,
    status: EvidenceReviewStatus.Draft,
    reviewer: input.reviewer,
    decision: EvidenceReviewDecision.None,
    comments: normalizeOptionalText(input.comments),
    requestedAdditionalEvidence: [],
    timeline: [
      createReviewTimelineEvent(
        "review_created",
        input.occurredAt,
        `Evidence review ${input.id} created for ${input.targetType} ${input.targetId}.`,
        metadata,
      ),
    ],
    trace: [
      createReviewTraceEntry(
        "review_created",
        input.actor ?? input.reviewer,
        input.occurredAt,
        `Evidence review ${input.id} created.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<EvidenceReviewSuccess>({
    success: true,
    review,
    errors: [],
    warnings: [],
    metadata,
  });
}

export function requestEvidenceReview(input: RequestEvidenceReviewInput): EvidenceReviewResult {
  return transitionEvidenceReviewStatus(
    input.review,
    EvidenceReviewStatus.Requested,
    "review_requested",
    input.actor,
    input.occurredAt,
    input.metadata,
    {
      decision: EvidenceReviewDecision.None,
    },
  );
}

export function startEvidenceReview(input: StartEvidenceReviewInput): EvidenceReviewResult {
  return transitionEvidenceReviewStatus(
    input.review,
    EvidenceReviewStatus.InReview,
    "review_started",
    input.actor,
    input.occurredAt,
    input.metadata,
    {
      decision: EvidenceReviewDecision.None,
    },
  );
}

export function approveEvidenceReview(input: ApproveEvidenceReviewInput): EvidenceReviewResult {
  const metadata = createReviewMutationMetadata(input.review, input.metadata);
  const transitionErrors = validateReviewStatusTransition(
    input.review,
    EvidenceReviewStatus.Approved,
    metadata,
  );

  if (transitionErrors.length > 0) {
    return reviewFailureResult(transitionErrors, metadata);
  }

  const reviewComments = normalizeOptionalText(input.comments) ?? input.review.comments;
  const hasExplicitDecision = input.decision === EvidenceReviewDecision.Approved;

  if (!hasNonBlankText(reviewComments) && !hasExplicitDecision) {
    return reviewFailureResult(
      [
        createReviewError(
          "missing_approval_requirement",
          "comments",
          "Approval requires review comments or an explicit approved decision.",
          metadata,
        ),
      ],
      metadata,
    );
  }

  return transitionEvidenceReviewStatus(
    input.review,
    EvidenceReviewStatus.Approved,
    "review_approved",
    input.actor,
    input.occurredAt,
    input.metadata,
    {
      decision: EvidenceReviewDecision.Approved,
      comments: reviewComments,
    },
  );
}

export function rejectEvidenceReview(input: RejectEvidenceReviewInput): EvidenceReviewResult {
  const metadata = createReviewMutationMetadata(input.review, input.metadata);
  const transitionErrors = validateReviewStatusTransition(
    input.review,
    EvidenceReviewStatus.Rejected,
    metadata,
  );

  if (transitionErrors.length > 0) {
    return reviewFailureResult(transitionErrors, metadata);
  }

  const reviewComments = normalizeOptionalText(input.comments) ?? input.review.comments;

  if (!hasNonBlankText(reviewComments)) {
    return reviewFailureResult(
      [
        createReviewError(
          "missing_comments",
          "comments",
          "Rejection requires review comments.",
          metadata,
        ),
      ],
      metadata,
    );
  }

  return transitionEvidenceReviewStatus(
    input.review,
    EvidenceReviewStatus.Rejected,
    "review_rejected",
    input.actor,
    input.occurredAt,
    input.metadata,
    {
      decision: EvidenceReviewDecision.Rejected,
      comments: reviewComments,
    },
  );
}

export function requestMoreEvidence(input: RequestMoreEvidenceInput): EvidenceReviewResult {
  const metadata = createReviewMutationMetadata(input.review, input.metadata);
  const transitionErrors = validateReviewStatusTransition(
    input.review,
    EvidenceReviewStatus.NeedsMoreEvidence,
    metadata,
  );

  if (transitionErrors.length > 0) {
    return reviewFailureResult(transitionErrors, metadata);
  }

  const requestedAdditionalEvidence = normalizeRequestedAdditionalEvidence(
    input.requestedAdditionalEvidence,
  );

  if (requestedAdditionalEvidence.length === 0) {
    return reviewFailureResult(
      [
        createReviewError(
          "missing_requested_additional_evidence",
          "requestedAdditionalEvidence",
          "Requesting more evidence requires at least one requested evidence item.",
          metadata,
        ),
      ],
      metadata,
    );
  }

  return transitionEvidenceReviewStatus(
    input.review,
    EvidenceReviewStatus.NeedsMoreEvidence,
    "additional_evidence_requested",
    input.actor,
    input.occurredAt,
    input.metadata,
    {
      decision: EvidenceReviewDecision.NeedsMoreEvidence,
      comments: normalizeOptionalText(input.comments) ?? input.review.comments,
      requestedAdditionalEvidence: [
        ...input.review.requestedAdditionalEvidence,
        ...requestedAdditionalEvidence,
      ],
    },
  );
}

export function archiveEvidenceReview(input: ArchiveEvidenceReviewInput): EvidenceReviewResult {
  return transitionEvidenceReviewStatus(
    input.review,
    EvidenceReviewStatus.Archived,
    "review_archived",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function summarizeEvidenceReview(review: EvidenceReview): EvidenceReviewSummary {
  return {
    targetType: review.targetType,
    targetId: review.targetId,
    status: review.status,
    reviewer: review.reviewer,
    decision: review.decision,
    totalRequestedAdditionalEvidence: review.requestedAdditionalEvidence.length,
    totalTraceEntries: review.trace.length,
    totalTimelineEntries: review.timeline.length,
    isTerminal: isReviewTerminalStatus(review.status),
    isOperationallyTerminal: isReviewOperationallyTerminalStatus(review.status),
  };
}

function transitionEvidenceReviewStatus(
  review: EvidenceReview,
  toStatus: EvidenceReviewStatus,
  timelineType: string,
  actor: string,
  occurredAt: string,
  extraMetadata: EvidenceReviewMetadata | undefined,
  changes: Partial<EvidenceReview> = {},
): EvidenceReviewResult {
  const metadata = createReviewMutationMetadata(review, extraMetadata);
  const errors = validateReviewStatusTransition(review, toStatus, metadata);

  if (errors.length > 0) {
    return reviewFailureResult(errors, metadata);
  }

  const fromStatus = review.status;
  const updated: EvidenceReview = {
    ...review,
    ...changes,
    status: toStatus,
    timeline: [
      ...review.timeline,
      createReviewTimelineEvent(
        timelineType,
        occurredAt,
        `Evidence review ${review.id} moved from ${fromStatus} to ${toStatus}.`,
        metadata,
      ),
    ],
    trace: [
      ...review.trace,
      createReviewTraceEntry(
        timelineType,
        actor,
        occurredAt,
        `Evidence review status advanced from ${fromStatus} to ${toStatus}.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<EvidenceReviewSuccess>({
    success: true,
    review: updated,
    errors: [],
    warnings: [],
    metadata,
  });
}

function validateReviewStatusTransition(
  review: EvidenceReview,
  toStatus: EvidenceReviewStatus,
  metadata: EvidenceReviewMetadata,
): EvidenceReviewError[] {
  if (isReviewTerminalStatus(review.status)) {
    return [
      createReviewError(
        "review_terminal",
        "status",
        `Cannot transition review from terminal status ${review.status}.`,
        metadata,
      ),
    ];
  }

  if (!canAdvanceReviewStatus(review.status, toStatus)) {
    return [
      createReviewError(
        "invalid_evidence_review_status_transition",
        "status",
        `Cannot transition review from ${review.status} to ${toStatus}.`,
        metadata,
      ),
    ];
  }

  return [];
}

function isReviewTerminalStatus(status: EvidenceReviewStatus): boolean {
  return status === EvidenceReviewStatus.Archived;
}

function isReviewOperationallyTerminalStatus(status: EvidenceReviewStatus): boolean {
  return (
    status === EvidenceReviewStatus.Approved ||
    status === EvidenceReviewStatus.Rejected ||
    status === EvidenceReviewStatus.Archived
  );
}

function canAdvanceReviewStatus(
  fromStatus: EvidenceReviewStatus,
  toStatus: EvidenceReviewStatus,
): boolean {
  return reviewAllowedTransitions[fromStatus].includes(toStatus);
}

const reviewAllowedTransitions: Readonly<
  Record<EvidenceReviewStatus, ReadonlyArray<EvidenceReviewStatus>>
> = {
  [EvidenceReviewStatus.Draft]: [
    EvidenceReviewStatus.Requested,
    EvidenceReviewStatus.Archived,
  ],
  [EvidenceReviewStatus.Requested]: [
    EvidenceReviewStatus.InReview,
    EvidenceReviewStatus.Archived,
  ],
  [EvidenceReviewStatus.InReview]: [
    EvidenceReviewStatus.Approved,
    EvidenceReviewStatus.Rejected,
    EvidenceReviewStatus.NeedsMoreEvidence,
  ],
  [EvidenceReviewStatus.Approved]: [EvidenceReviewStatus.Archived],
  [EvidenceReviewStatus.Rejected]: [EvidenceReviewStatus.Archived],
  [EvidenceReviewStatus.NeedsMoreEvidence]: [
    EvidenceReviewStatus.InReview,
    EvidenceReviewStatus.Archived,
  ],
  [EvidenceReviewStatus.Archived]: [],
};

function validateReviewShell(
  input: CreateEvidenceReviewInput,
  metadata: EvidenceReviewMetadata,
): EvidenceReviewError[] {
  const errors: EvidenceReviewError[] = [];

  if (isBlank(input.id)) {
    errors.push(createReviewError("missing_id", "id", "Review id is required.", metadata));
  }

  if (isBlank(input.targetType)) {
    errors.push(
      createReviewError(
        "missing_target_type",
        "targetType",
        "Review target type is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.targetId)) {
    errors.push(
      createReviewError(
        "missing_target_id",
        "targetId",
        "Review target id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.reviewer)) {
    errors.push(
      createReviewError(
        "missing_reviewer",
        "reviewer",
        "Review reviewer is required.",
        metadata,
      ),
    );
  }

  return errors;
}

function reviewFailureResult(
  errors: ReadonlyArray<EvidenceReviewError>,
  metadata: EvidenceReviewMetadata,
): EvidenceReviewFailure {
  return freezeDomainObject<EvidenceReviewFailure>({
    success: false,
    review: null,
    errors,
    warnings: [],
    metadata,
  });
}

function createReviewTimelineEvent(
  type: string,
  occurredAt: string,
  description: string,
  metadata: EvidenceReviewMetadata,
): EvidenceReviewTimelineEvent {
  return {
    type,
    occurredAt,
    description,
    metadata,
  };
}

function createReviewTraceEntry(
  action: string,
  actor: string,
  occurredAt: string,
  description: string,
  metadata: EvidenceReviewMetadata,
): EvidenceReviewTrace {
  return {
    action,
    actor,
    occurredAt,
    description,
    metadata,
  };
}

function createReviewError(
  code: EvidenceReviewError["code"],
  field: string,
  message: string,
  metadata: EvidenceReviewMetadata,
): EvidenceReviewError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createReviewMetadata(input: CreateEvidenceReviewInput): EvidenceReviewMetadata {
  const metadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
    reviewId: input.id,
    targetType: input.targetType,
    targetId: input.targetId,
    reviewer: input.reviewer,
  };

  if (input.correlationId !== undefined) {
    metadata["correlationId"] = input.correlationId;
  }

  if (input.createdBy !== undefined) {
    metadata["createdBy"] = input.createdBy;
  }

  if (input.sourceSystem !== undefined) {
    metadata["sourceSystem"] = input.sourceSystem;
  }

  return metadata;
}

function createReviewMutationMetadata(
  review: EvidenceReview,
  extraMetadata: EvidenceReviewMetadata | undefined,
): EvidenceReviewMetadata {
  return {
    ...review.metadata,
    ...(extraMetadata ?? {}),
    reviewId: review.id,
    targetType: review.targetType,
    targetId: review.targetId,
    reviewer: review.reviewer,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function normalizeRequestedAdditionalEvidence(
  requestedAdditionalEvidence: ReadonlyArray<string> | null | undefined,
): ReadonlyArray<string> {
  return (requestedAdditionalEvidence ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function hasNonBlankText(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
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
