export type EvidenceReviewMetadata = Readonly<Record<string, unknown>>;

export type EvidenceReviewId = string;

export type EvidenceReviewTargetId = string;

export type EvidenceReviewReviewer = string;

export type EvidenceReviewActor = string;

export type EvidenceReviewOccurredAt = string;

export type EvidenceReviewCorrelationId = string;

export type EvidenceReviewCreatedBy = string;

export type EvidenceReviewSourceSystem = string;

export enum EvidenceReviewTargetType {
  FieldEvidence = "field_evidence",
  EvidenceBundle = "evidence_bundle",
}

export enum EvidenceReviewStatus {
  Draft = "Draft",
  Requested = "Requested",
  InReview = "InReview",
  Approved = "Approved",
  Rejected = "Rejected",
  NeedsMoreEvidence = "NeedsMoreEvidence",
  Archived = "Archived",
}

export enum EvidenceReviewDecision {
  None = "none",
  Approved = "approved",
  Rejected = "rejected",
  NeedsMoreEvidence = "needs_more_evidence",
}

export interface EvidenceReviewTimelineEvent {
  readonly type: string;
  readonly occurredAt: EvidenceReviewOccurredAt;
  readonly description: string;
  readonly metadata: EvidenceReviewMetadata;
}

export interface EvidenceReviewTrace {
  readonly action: string;
  readonly actor: EvidenceReviewActor;
  readonly occurredAt: EvidenceReviewOccurredAt;
  readonly description: string;
  readonly metadata: EvidenceReviewMetadata;
}

export interface EvidenceReviewSummary {
  readonly targetType: EvidenceReviewTargetType;
  readonly targetId: EvidenceReviewTargetId;
  readonly status: EvidenceReviewStatus;
  readonly reviewer: EvidenceReviewReviewer;
  readonly decision: EvidenceReviewDecision;
  readonly totalRequestedAdditionalEvidence: number;
  readonly totalTraceEntries: number;
  readonly totalTimelineEntries: number;
  readonly isTerminal: boolean;
  readonly isOperationallyTerminal: boolean;
}

export interface EvidenceReview {
  readonly id: EvidenceReviewId;
  readonly targetType: EvidenceReviewTargetType;
  readonly targetId: EvidenceReviewTargetId;
  readonly status: EvidenceReviewStatus;
  readonly reviewer: EvidenceReviewReviewer;
  readonly decision: EvidenceReviewDecision;
  readonly comments: string | null;
  readonly requestedAdditionalEvidence: ReadonlyArray<string>;
  readonly trace: ReadonlyArray<EvidenceReviewTrace>;
  readonly timeline: ReadonlyArray<EvidenceReviewTimelineEvent>;
  readonly metadata: EvidenceReviewMetadata;
}

export interface CreateEvidenceReviewInput {
  readonly id: EvidenceReviewId;
  readonly targetType: EvidenceReviewTargetType;
  readonly targetId: EvidenceReviewTargetId;
  readonly reviewer: EvidenceReviewReviewer;
  readonly occurredAt: EvidenceReviewOccurredAt;
  readonly actor?: EvidenceReviewActor;
  readonly comments?: string | null;
  readonly correlationId?: EvidenceReviewCorrelationId;
  readonly createdBy?: EvidenceReviewCreatedBy;
  readonly sourceSystem?: EvidenceReviewSourceSystem;
  readonly metadata?: EvidenceReviewMetadata;
}

export interface RequestEvidenceReviewInput {
  readonly review: EvidenceReview;
  readonly actor: EvidenceReviewActor;
  readonly occurredAt: EvidenceReviewOccurredAt;
  readonly metadata?: EvidenceReviewMetadata;
}

export interface StartEvidenceReviewInput {
  readonly review: EvidenceReview;
  readonly actor: EvidenceReviewActor;
  readonly occurredAt: EvidenceReviewOccurredAt;
  readonly metadata?: EvidenceReviewMetadata;
}

export interface ApproveEvidenceReviewInput {
  readonly review: EvidenceReview;
  readonly actor: EvidenceReviewActor;
  readonly occurredAt: EvidenceReviewOccurredAt;
  readonly comments?: string | null;
  readonly decision?: EvidenceReviewDecision.Approved;
  readonly metadata?: EvidenceReviewMetadata;
}

export interface RejectEvidenceReviewInput {
  readonly review: EvidenceReview;
  readonly actor: EvidenceReviewActor;
  readonly occurredAt: EvidenceReviewOccurredAt;
  readonly comments?: string | null;
  readonly metadata?: EvidenceReviewMetadata;
}

export interface RequestMoreEvidenceInput {
  readonly review: EvidenceReview;
  readonly actor: EvidenceReviewActor;
  readonly occurredAt: EvidenceReviewOccurredAt;
  readonly requestedAdditionalEvidence?: ReadonlyArray<string> | null;
  readonly comments?: string | null;
  readonly metadata?: EvidenceReviewMetadata;
}

export interface ArchiveEvidenceReviewInput {
  readonly review: EvidenceReview;
  readonly actor: EvidenceReviewActor;
  readonly occurredAt: EvidenceReviewOccurredAt;
  readonly metadata?: EvidenceReviewMetadata;
}

export type EvidenceReviewErrorCode =
  | "missing_id"
  | "missing_target_type"
  | "missing_target_id"
  | "missing_reviewer"
  | "missing_approval_requirement"
  | "missing_comments"
  | "missing_requested_additional_evidence"
  | "review_terminal"
  | "invalid_evidence_review_status_transition";

export interface EvidenceReviewError {
  readonly code: EvidenceReviewErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: EvidenceReviewMetadata;
}

export type EvidenceReviewWarningCode = "none";

export interface EvidenceReviewWarning {
  readonly code: EvidenceReviewWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: EvidenceReviewMetadata;
}

export interface EvidenceReviewSuccess {
  readonly success: true;
  readonly review: EvidenceReview;
  readonly errors: ReadonlyArray<EvidenceReviewError>;
  readonly warnings: ReadonlyArray<EvidenceReviewWarning>;
  readonly metadata: EvidenceReviewMetadata;
}

export interface EvidenceReviewFailure {
  readonly success: false;
  readonly review: null;
  readonly errors: ReadonlyArray<EvidenceReviewError>;
  readonly warnings: ReadonlyArray<EvidenceReviewWarning>;
  readonly metadata: EvidenceReviewMetadata;
}

export type EvidenceReviewResult = EvidenceReviewSuccess | EvidenceReviewFailure;
