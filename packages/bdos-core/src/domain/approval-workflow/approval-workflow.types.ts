export type ApprovalWorkflowMetadata = Readonly<Record<string, unknown>>;

export type ApprovalWorkflowId = string;

export type ApprovalWorkflowOrganizationId = string;

export type ApprovalWorkflowCorrelationId = string;

export type ApprovalWorkflowCreatedBy = string;

export type ApprovalWorkflowSourceSystem = string;

export type ApprovalWorkflowActor = string;

export type ApprovalWorkflowOccurredAt = string;

export type ApprovalWorkflowStepId = string;

export enum ApprovalWorkflowStatus {
  Draft = "Draft",
  Submitted = "Submitted",
  InReview = "InReview",
  ChangesRequested = "ChangesRequested",
  Approved = "Approved",
  Rejected = "Rejected",
  Cancelled = "Cancelled",
}

export enum ApprovalWorkflowReferenceType {
  MeasurementWorkspace = "measurement_workspace",
  Project = "project",
  Contract = "contract",
  WorkPackage = "work_package",
}

export interface ApprovalWorkflowReference {
  readonly type: ApprovalWorkflowReferenceType;
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly metadata: ApprovalWorkflowMetadata;
}

export enum ApprovalWorkflowStepStatus {
  Pending = "Pending",
  Approved = "Approved",
  Rejected = "Rejected",
  ChangesRequested = "ChangesRequested",
}

export interface ApprovalWorkflowStep {
  readonly id: ApprovalWorkflowStepId;
  readonly sequence: number;
  readonly name: string;
  readonly approverId: string;
  readonly approverName: string;
  readonly status: ApprovalWorkflowStepStatus;
  readonly metadata: ApprovalWorkflowMetadata;
}

export interface ApprovalWorkflowStepInput {
  readonly id: ApprovalWorkflowStepId;
  readonly sequence: number;
  readonly name: string;
  readonly approverId: string;
  readonly approverName: string;
  readonly metadata?: ApprovalWorkflowMetadata;
}

export enum ApprovalWorkflowDecisionType {
  Approved = "approved",
  Rejected = "rejected",
  ChangesRequested = "changes_requested",
}

export interface ApprovalWorkflowDecision {
  readonly stepId: ApprovalWorkflowStepId;
  readonly type: ApprovalWorkflowDecisionType;
  readonly actor: ApprovalWorkflowActor;
  readonly occurredAt: ApprovalWorkflowOccurredAt;
  readonly comment: string;
  readonly metadata: ApprovalWorkflowMetadata;
}

export interface ApprovalWorkflowTrace {
  readonly action: string;
  readonly actor: ApprovalWorkflowActor;
  readonly occurredAt: ApprovalWorkflowOccurredAt;
  readonly description: string;
  readonly metadata: ApprovalWorkflowMetadata;
}

export interface ApprovalWorkflowSummary {
  readonly totalSteps: number;
  readonly pendingSteps: number;
  readonly approvedSteps: number;
  readonly rejectedSteps: number;
  readonly changesRequestedSteps: number;
  readonly currentStepSequence: number | null;
}

export interface ApprovalWorkflow {
  readonly id: ApprovalWorkflowId;
  readonly organizationId: ApprovalWorkflowOrganizationId;
  readonly reference: ApprovalWorkflowReference;
  readonly status: ApprovalWorkflowStatus;
  readonly steps: ReadonlyArray<ApprovalWorkflowStep>;
  readonly decisions: ReadonlyArray<ApprovalWorkflowDecision>;
  readonly summary: ApprovalWorkflowSummary;
  readonly trace: ReadonlyArray<ApprovalWorkflowTrace>;
  readonly metadata: ApprovalWorkflowMetadata;
}

export interface CreateApprovalWorkflowInput {
  readonly id: ApprovalWorkflowId;
  readonly organizationId: ApprovalWorkflowOrganizationId;
  readonly reference: ApprovalWorkflowReference;
  readonly steps: ReadonlyArray<ApprovalWorkflowStepInput>;
  readonly actor: ApprovalWorkflowActor;
  readonly occurredAt: ApprovalWorkflowOccurredAt;
  readonly correlationId: ApprovalWorkflowCorrelationId;
  readonly createdBy: ApprovalWorkflowCreatedBy;
  readonly sourceSystem: ApprovalWorkflowSourceSystem;
  readonly metadata?: ApprovalWorkflowMetadata;
}

export interface SubmitApprovalWorkflowInput {
  readonly workflow: ApprovalWorkflow;
  readonly actor: ApprovalWorkflowActor;
  readonly occurredAt: ApprovalWorkflowOccurredAt;
  readonly metadata?: ApprovalWorkflowMetadata;
}

export interface ApproveApprovalWorkflowStepInput {
  readonly workflow: ApprovalWorkflow;
  readonly stepId: ApprovalWorkflowStepId;
  readonly actor: ApprovalWorkflowActor;
  readonly occurredAt: ApprovalWorkflowOccurredAt;
  readonly comment?: string;
  readonly metadata?: ApprovalWorkflowMetadata;
}

export interface RejectApprovalWorkflowStepInput {
  readonly workflow: ApprovalWorkflow;
  readonly stepId: ApprovalWorkflowStepId;
  readonly actor: ApprovalWorkflowActor;
  readonly occurredAt: ApprovalWorkflowOccurredAt;
  readonly comment?: string;
  readonly metadata?: ApprovalWorkflowMetadata;
}

export interface RequestChangesApprovalWorkflowStepInput {
  readonly workflow: ApprovalWorkflow;
  readonly stepId: ApprovalWorkflowStepId;
  readonly actor: ApprovalWorkflowActor;
  readonly occurredAt: ApprovalWorkflowOccurredAt;
  readonly comment?: string;
  readonly metadata?: ApprovalWorkflowMetadata;
}

export interface CancelApprovalWorkflowInput {
  readonly workflow: ApprovalWorkflow;
  readonly actor: ApprovalWorkflowActor;
  readonly occurredAt: ApprovalWorkflowOccurredAt;
  readonly reason?: string;
  readonly metadata?: ApprovalWorkflowMetadata;
}

export type ApprovalWorkflowErrorCode =
  | "missing_id"
  | "missing_organization_id"
  | "missing_reference"
  | "missing_reference_id"
  | "missing_steps"
  | "missing_step_id"
  | "missing_step_approver"
  | "duplicate_step_id"
  | "duplicate_step_sequence"
  | "invalid_step_sequence"
  | "workflow_terminal"
  | "workflow_not_submitted"
  | "invalid_workflow_status_transition"
  | "step_not_found"
  | "step_not_pending"
  | "step_out_of_order";

export interface ApprovalWorkflowError {
  readonly code: ApprovalWorkflowErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ApprovalWorkflowMetadata;
}

export type ApprovalWorkflowWarningCode = "none";

export interface ApprovalWorkflowWarning {
  readonly code: ApprovalWorkflowWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ApprovalWorkflowMetadata;
}

export interface ApprovalWorkflowSuccess {
  readonly success: true;
  readonly workflow: ApprovalWorkflow;
  readonly errors: ReadonlyArray<ApprovalWorkflowError>;
  readonly warnings: ReadonlyArray<ApprovalWorkflowWarning>;
  readonly metadata: ApprovalWorkflowMetadata;
}

export interface ApprovalWorkflowFailure {
  readonly success: false;
  readonly workflow: null;
  readonly errors: ReadonlyArray<ApprovalWorkflowError>;
  readonly warnings: ReadonlyArray<ApprovalWorkflowWarning>;
  readonly metadata: ApprovalWorkflowMetadata;
}

export type ApprovalWorkflowResult = ApprovalWorkflowSuccess | ApprovalWorkflowFailure;
