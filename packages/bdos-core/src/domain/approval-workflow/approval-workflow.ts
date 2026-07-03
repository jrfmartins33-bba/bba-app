import type {
  ApproveApprovalWorkflowStepInput,
  ApprovalWorkflow,
  ApprovalWorkflowDecision,
  ApprovalWorkflowError,
  ApprovalWorkflowFailure,
  ApprovalWorkflowMetadata,
  ApprovalWorkflowReference,
  ApprovalWorkflowResult,
  ApprovalWorkflowStep,
  ApprovalWorkflowStepInput,
  ApprovalWorkflowSuccess,
  ApprovalWorkflowSummary,
  ApprovalWorkflowTrace,
  CancelApprovalWorkflowInput,
  CreateApprovalWorkflowInput,
  RejectApprovalWorkflowStepInput,
  RequestChangesApprovalWorkflowStepInput,
  SubmitApprovalWorkflowInput,
} from "./approval-workflow.types";
import {
  ApprovalWorkflowDecisionType,
  ApprovalWorkflowStatus,
  ApprovalWorkflowStepStatus,
} from "./approval-workflow.types";

export function createApprovalWorkflow(
  input: CreateApprovalWorkflowInput,
): ApprovalWorkflowResult {
  const metadata = createWorkflowMetadata(input);
  const errors = [
    ...validateWorkflowShell(input, metadata),
    ...validateSteps(input.steps, metadata),
  ];

  if (errors.length > 0) {
    return freezeDomainObject<ApprovalWorkflowFailure>({
      success: false,
      workflow: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  const steps = buildSteps(input.steps);
  const summary = summarizeSteps(steps);

  const workflow: ApprovalWorkflow = {
    id: input.id,
    organizationId: input.organizationId,
    reference: cloneReference(input.reference),
    status: ApprovalWorkflowStatus.Draft,
    steps,
    decisions: [],
    summary,
    trace: [
      createTraceEntry(
        "workflow_created",
        input.actor,
        input.occurredAt,
        `Approval workflow created for reference ${input.reference.id}.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<ApprovalWorkflowSuccess>({
    success: true,
    workflow,
    errors: [],
    warnings: [],
    metadata,
  });
}

export function submitApprovalWorkflow(
  input: SubmitApprovalWorkflowInput,
): ApprovalWorkflowResult {
  const metadata = createMutationMetadata(input.workflow, input.metadata);
  const errors = validateNotTerminal(input.workflow, metadata);

  if (
    errors.length === 0 &&
    input.workflow.status !== ApprovalWorkflowStatus.Draft &&
    input.workflow.status !== ApprovalWorkflowStatus.ChangesRequested
  ) {
    errors.push(
      createWorkflowError(
        "invalid_workflow_status_transition",
        "status",
        `Cannot submit workflow from status ${input.workflow.status}.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const wasChangesRequested = input.workflow.status === ApprovalWorkflowStatus.ChangesRequested;
  const steps = wasChangesRequested
    ? input.workflow.steps.map((step) =>
        step.status === ApprovalWorkflowStepStatus.ChangesRequested
          ? { ...step, status: ApprovalWorkflowStepStatus.Pending }
          : step,
      )
    : input.workflow.steps;

  return successWithUpdate(
    input.workflow,
    {
      status: ApprovalWorkflowStatus.Submitted,
      steps,
      summary: summarizeSteps(steps),
    },
    createTraceEntry(
      "workflow_submitted",
      input.actor,
      input.occurredAt,
      "Approval workflow submitted for review.",
      metadata,
    ),
    metadata,
  );
}

export function approveApprovalWorkflowStep(
  input: ApproveApprovalWorkflowStepInput,
): ApprovalWorkflowResult {
  const metadata = createMutationMetadata(input.workflow, input.metadata);
  const errors = validateReviewable(input.workflow, metadata);
  const step = input.workflow.steps.find((candidate) => candidate.id === input.stepId);

  if (step === undefined) {
    errors.push(
      createWorkflowError(
        "step_not_found",
        "stepId",
        `Step ${input.stepId} was not found in this workflow.`,
        metadata,
      ),
    );
  } else if (step.status !== ApprovalWorkflowStepStatus.Pending) {
    errors.push(
      createWorkflowError(
        "step_not_pending",
        "stepId",
        `Step ${input.stepId} is not pending approval.`,
        metadata,
      ),
    );
  } else if (
    input.workflow.steps.some(
      (candidate) =>
        candidate.sequence < step.sequence &&
        candidate.status !== ApprovalWorkflowStepStatus.Approved,
    )
  ) {
    errors.push(
      createWorkflowError(
        "step_out_of_order",
        "stepId",
        `Step ${input.stepId} cannot be approved before earlier steps are approved.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const steps = input.workflow.steps.map((candidate) =>
    candidate.id === input.stepId
      ? { ...candidate, status: ApprovalWorkflowStepStatus.Approved }
      : candidate,
  );
  const decision = createDecision(
    input.stepId,
    ApprovalWorkflowDecisionType.Approved,
    input.actor,
    input.occurredAt,
    input.comment,
    metadata,
  );
  const allApproved = steps.every(
    (candidate) => candidate.status === ApprovalWorkflowStepStatus.Approved,
  );
  const nextStatus = allApproved
    ? ApprovalWorkflowStatus.Approved
    : ApprovalWorkflowStatus.InReview;

  return successWithUpdate(
    input.workflow,
    {
      status: nextStatus,
      steps,
      decisions: [...input.workflow.decisions, decision],
      summary: summarizeSteps(steps),
    },
    createTraceEntry(
      "step_approved",
      input.actor,
      input.occurredAt,
      allApproved
        ? `Step ${input.stepId} approved. All steps approved; workflow is now Approved.`
        : `Step ${input.stepId} approved.`,
      metadata,
    ),
    metadata,
  );
}

export function rejectApprovalWorkflowStep(
  input: RejectApprovalWorkflowStepInput,
): ApprovalWorkflowResult {
  const metadata = createMutationMetadata(input.workflow, input.metadata);
  const errors = validateReviewable(input.workflow, metadata);
  const step = input.workflow.steps.find((candidate) => candidate.id === input.stepId);

  if (step === undefined) {
    errors.push(
      createWorkflowError(
        "step_not_found",
        "stepId",
        `Step ${input.stepId} was not found in this workflow.`,
        metadata,
      ),
    );
  } else if (step.status !== ApprovalWorkflowStepStatus.Pending) {
    errors.push(
      createWorkflowError(
        "step_not_pending",
        "stepId",
        `Step ${input.stepId} is not pending approval.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const steps = input.workflow.steps.map((candidate) =>
    candidate.id === input.stepId
      ? { ...candidate, status: ApprovalWorkflowStepStatus.Rejected }
      : candidate,
  );
  const decision = createDecision(
    input.stepId,
    ApprovalWorkflowDecisionType.Rejected,
    input.actor,
    input.occurredAt,
    input.comment,
    metadata,
  );

  return successWithUpdate(
    input.workflow,
    {
      status: ApprovalWorkflowStatus.Rejected,
      steps,
      decisions: [...input.workflow.decisions, decision],
      summary: summarizeSteps(steps),
    },
    createTraceEntry(
      "step_rejected",
      input.actor,
      input.occurredAt,
      `Step ${input.stepId} rejected. Workflow is now Rejected.`,
      metadata,
    ),
    metadata,
  );
}

export function requestChangesApprovalWorkflowStep(
  input: RequestChangesApprovalWorkflowStepInput,
): ApprovalWorkflowResult {
  const metadata = createMutationMetadata(input.workflow, input.metadata);
  const errors = validateReviewable(input.workflow, metadata);
  const step = input.workflow.steps.find((candidate) => candidate.id === input.stepId);

  if (step === undefined) {
    errors.push(
      createWorkflowError(
        "step_not_found",
        "stepId",
        `Step ${input.stepId} was not found in this workflow.`,
        metadata,
      ),
    );
  } else if (step.status !== ApprovalWorkflowStepStatus.Pending) {
    errors.push(
      createWorkflowError(
        "step_not_pending",
        "stepId",
        `Step ${input.stepId} is not pending approval.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const steps = input.workflow.steps.map((candidate) =>
    candidate.id === input.stepId
      ? { ...candidate, status: ApprovalWorkflowStepStatus.ChangesRequested }
      : candidate,
  );
  const decision = createDecision(
    input.stepId,
    ApprovalWorkflowDecisionType.ChangesRequested,
    input.actor,
    input.occurredAt,
    input.comment,
    metadata,
  );

  return successWithUpdate(
    input.workflow,
    {
      status: ApprovalWorkflowStatus.ChangesRequested,
      steps,
      decisions: [...input.workflow.decisions, decision],
      summary: summarizeSteps(steps),
    },
    createTraceEntry(
      "changes_requested",
      input.actor,
      input.occurredAt,
      `Changes requested on step ${input.stepId}. Workflow is now ChangesRequested.`,
      metadata,
    ),
    metadata,
  );
}

export function cancelApprovalWorkflow(
  input: CancelApprovalWorkflowInput,
): ApprovalWorkflowResult {
  const metadata = createMutationMetadata(input.workflow, input.metadata);
  const errors = validateNotTerminal(input.workflow, metadata);

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  return successWithUpdate(
    input.workflow,
    {
      status: ApprovalWorkflowStatus.Cancelled,
    },
    createTraceEntry(
      "workflow_cancelled",
      input.actor,
      input.occurredAt,
      input.reason ?? "Approval workflow cancelled.",
      metadata,
    ),
    metadata,
  );
}

export function summarizeApprovalWorkflow(
  workflow: ApprovalWorkflow,
): ApprovalWorkflowSummary {
  return summarizeSteps(workflow.steps);
}

function validateNotTerminal(
  workflow: ApprovalWorkflow,
  metadata: ApprovalWorkflowMetadata,
): ApprovalWorkflowError[] {
  const errors: ApprovalWorkflowError[] = [];

  if (isTerminalStatus(workflow.status)) {
    errors.push(
      createWorkflowError(
        "workflow_terminal",
        "status",
        `Workflow status ${workflow.status} is terminal and cannot be mutated.`,
        metadata,
      ),
    );
  }

  return errors;
}

function validateReviewable(
  workflow: ApprovalWorkflow,
  metadata: ApprovalWorkflowMetadata,
): ApprovalWorkflowError[] {
  const errors: ApprovalWorkflowError[] = [];

  if (isTerminalStatus(workflow.status)) {
    errors.push(
      createWorkflowError(
        "workflow_terminal",
        "status",
        `Workflow status ${workflow.status} is terminal and cannot be mutated.`,
        metadata,
      ),
    );
  } else if (
    workflow.status !== ApprovalWorkflowStatus.Submitted &&
    workflow.status !== ApprovalWorkflowStatus.InReview
  ) {
    errors.push(
      createWorkflowError(
        "workflow_not_submitted",
        "status",
        `Workflow must be submitted before steps can be decided. Current status: ${workflow.status}.`,
        metadata,
      ),
    );
  }

  return errors;
}

function isTerminalStatus(status: ApprovalWorkflowStatus): boolean {
  return (
    status === ApprovalWorkflowStatus.Approved ||
    status === ApprovalWorkflowStatus.Rejected ||
    status === ApprovalWorkflowStatus.Cancelled
  );
}

function failureResult(
  errors: ReadonlyArray<ApprovalWorkflowError>,
  metadata: ApprovalWorkflowMetadata,
): ApprovalWorkflowFailure {
  return freezeDomainObject<ApprovalWorkflowFailure>({
    success: false,
    workflow: null,
    errors,
    warnings: [],
    metadata,
  });
}

function successWithUpdate(
  workflow: ApprovalWorkflow,
  patch: Partial<ApprovalWorkflow>,
  traceEntry: ApprovalWorkflowTrace,
  metadata: ApprovalWorkflowMetadata,
): ApprovalWorkflowSuccess {
  return freezeDomainObject<ApprovalWorkflowSuccess>({
    success: true,
    workflow: {
      ...workflow,
      ...patch,
      trace: [...workflow.trace, traceEntry],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

function validateWorkflowShell(
  input: CreateApprovalWorkflowInput,
  metadata: ApprovalWorkflowMetadata,
): ApprovalWorkflowError[] {
  const errors: ApprovalWorkflowError[] = [];

  if (isBlank(input.id)) {
    errors.push(
      createWorkflowError("missing_id", "id", "Workflow id is required.", metadata),
    );
  }

  if (isBlank(input.organizationId)) {
    errors.push(
      createWorkflowError(
        "missing_organization_id",
        "organizationId",
        "Organization id is required.",
        metadata,
      ),
    );
  }

  if (input.reference === undefined || input.reference === null) {
    errors.push(
      createWorkflowError(
        "missing_reference",
        "reference",
        "An operational reference is required.",
        metadata,
      ),
    );
  } else if (isBlank(input.reference.id)) {
    errors.push(
      createWorkflowError(
        "missing_reference_id",
        "reference.id",
        "Reference id is required.",
        metadata,
      ),
    );
  }

  return errors;
}

function validateSteps(
  steps: ReadonlyArray<ApprovalWorkflowStepInput> | null | undefined,
  metadata: ApprovalWorkflowMetadata,
): ApprovalWorkflowError[] {
  const errors: ApprovalWorkflowError[] = [];

  if (steps === undefined || steps === null || steps.length === 0) {
    errors.push(
      createWorkflowError(
        "missing_steps",
        "steps",
        "At least one approval step is required.",
        metadata,
      ),
    );
    return errors;
  }

  const seenIds = new Set<string>();
  const seenSequences = new Set<number>();

  steps.forEach((step, index) => {
    if (isBlank(step.id)) {
      errors.push(
        createWorkflowError(
          "missing_step_id",
          `steps.${index}.id`,
          "Step id is required.",
          metadata,
        ),
      );
    } else if (seenIds.has(step.id)) {
      errors.push(
        createWorkflowError(
          "duplicate_step_id",
          `steps.${index}.id`,
          `Step id ${step.id} is duplicated.`,
          metadata,
        ),
      );
    } else {
      seenIds.add(step.id);
    }

    if (!Number.isInteger(step.sequence) || step.sequence <= 0) {
      errors.push(
        createWorkflowError(
          "invalid_step_sequence",
          `steps.${index}.sequence`,
          "Step sequence must be a positive integer.",
          metadata,
        ),
      );
    } else if (seenSequences.has(step.sequence)) {
      errors.push(
        createWorkflowError(
          "duplicate_step_sequence",
          `steps.${index}.sequence`,
          `Step sequence ${step.sequence} is duplicated.`,
          metadata,
        ),
      );
    } else {
      seenSequences.add(step.sequence);
    }

    if (isBlank(step.approverId) || isBlank(step.approverName)) {
      errors.push(
        createWorkflowError(
          "missing_step_approver",
          `steps.${index}.approverId`,
          "Step approver id and name are required.",
          metadata,
        ),
      );
    }
  });

  return errors;
}

function buildSteps(
  stepInputs: ReadonlyArray<ApprovalWorkflowStepInput>,
): ReadonlyArray<ApprovalWorkflowStep> {
  return [...stepInputs]
    .sort((left, right) => left.sequence - right.sequence)
    .map((step) => ({
      id: step.id,
      sequence: step.sequence,
      name: step.name,
      approverId: step.approverId,
      approverName: step.approverName,
      status: ApprovalWorkflowStepStatus.Pending,
      metadata: step.metadata ?? {},
    }));
}

function summarizeSteps(
  steps: ReadonlyArray<ApprovalWorkflowStep>,
): ApprovalWorkflowSummary {
  const pendingStep = [...steps]
    .sort((left, right) => left.sequence - right.sequence)
    .find((step) => step.status === ApprovalWorkflowStepStatus.Pending);

  return {
    totalSteps: steps.length,
    pendingSteps: steps.filter(
      (step) => step.status === ApprovalWorkflowStepStatus.Pending,
    ).length,
    approvedSteps: steps.filter(
      (step) => step.status === ApprovalWorkflowStepStatus.Approved,
    ).length,
    rejectedSteps: steps.filter(
      (step) => step.status === ApprovalWorkflowStepStatus.Rejected,
    ).length,
    changesRequestedSteps: steps.filter(
      (step) => step.status === ApprovalWorkflowStepStatus.ChangesRequested,
    ).length,
    currentStepSequence: pendingStep?.sequence ?? null,
  };
}

function createDecision(
  stepId: string,
  type: ApprovalWorkflowDecisionType,
  actor: string,
  occurredAt: string,
  comment: string | undefined,
  metadata: ApprovalWorkflowMetadata,
): ApprovalWorkflowDecision {
  return {
    stepId,
    type,
    actor,
    occurredAt,
    comment: comment ?? "",
    metadata,
  };
}

function cloneReference(
  reference: ApprovalWorkflowReference,
): ApprovalWorkflowReference {
  return {
    type: reference.type,
    id: reference.id,
    code: reference.code,
    name: reference.name,
    metadata: reference.metadata,
  };
}

function createTraceEntry(
  action: string,
  actor: string,
  occurredAt: string,
  description: string,
  metadata: ApprovalWorkflowMetadata,
): ApprovalWorkflowTrace {
  return {
    action,
    actor,
    occurredAt,
    description,
    metadata,
  };
}

function createWorkflowError(
  code: ApprovalWorkflowError["code"],
  field: string,
  message: string,
  metadata: ApprovalWorkflowMetadata,
): ApprovalWorkflowError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createWorkflowMetadata(
  input: CreateApprovalWorkflowInput,
): ApprovalWorkflowMetadata {
  return {
    ...(input.metadata ?? {}),
    workflowId: input.id,
    organizationId: input.organizationId,
    referenceType: input.reference?.type ?? null,
    referenceId: input.reference?.id ?? null,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createMutationMetadata(
  workflow: ApprovalWorkflow,
  extraMetadata: ApprovalWorkflowMetadata | undefined,
): ApprovalWorkflowMetadata {
  return {
    ...workflow.metadata,
    ...(extraMetadata ?? {}),
    workflowId: workflow.id,
    organizationId: workflow.organizationId,
    referenceType: workflow.reference.type,
    referenceId: workflow.reference.id,
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
