import {
  ApprovalWorkflowReferenceType,
  ApprovalWorkflowStatus,
  ApprovalWorkflowStepStatus,
  approveApprovalWorkflowStep,
  cancelApprovalWorkflow,
  createApprovalWorkflow,
  rejectApprovalWorkflowStep,
  requestChangesApprovalWorkflowStep,
  submitApprovalWorkflow,
  summarizeApprovalWorkflow,
  type ApprovalWorkflow,
  type ApprovalWorkflowResult,
  type ApprovalWorkflowStepInput,
  type CreateApprovalWorkflowInput,
} from "./index";

const workflowId = "approval-workflow-lagoa-do-arroz-8";
const organizationId = "organization-alpha-engenharia";
const referenceId = "measurement-workspace-lagoa-do-arroz-8";
const actor = "engineer-marcos";
const occurredAt = "2026-06-15T10:30:00Z";
const correlationId = "approval-workflow-correlation-001";
const createdBy = "field-office";
const sourceSystem = "engineering-os";

runTest("valid creation", () => {
  const result = createApprovalWorkflow(createWorkflowInputFixture());

  assertSuccess(result, "expected workflow creation success");
  assertEqual(result.workflow.id, workflowId, "workflow id mismatch");
  assertEqual(result.workflow.organizationId, organizationId, "organization mismatch");
  assertEqual(result.workflow.reference.id, referenceId, "reference id mismatch");
  assertEqual(
    result.workflow.status,
    ApprovalWorkflowStatus.Draft,
    "initial status mismatch",
  );
  assertEqual(result.workflow.steps.length, 3, "steps count mismatch");
  assertEqual(result.workflow.steps[0]?.id, "step-1", "steps not sorted by sequence");
  assertEqual(result.workflow.summary.totalSteps, 3, "summary totalSteps mismatch");
  assertEqual(result.workflow.summary.pendingSteps, 3, "summary pendingSteps mismatch");
  assertEqual(
    result.workflow.summary.currentStepSequence,
    1,
    "summary currentStepSequence mismatch",
  );
});

runTest("rejects missing id", () => {
  const result = createApprovalWorkflow(createWorkflowInputFixture({ id: "" }));

  assertFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejects missing organizationId", () => {
  const result = createApprovalWorkflow(
    createWorkflowInputFixture({ organizationId: "" }),
  );

  assertFailure(result, "expected missing organization failure");
  assertEqual(result.errors[0]?.code, "missing_organization_id", "error code mismatch");
});

runTest("rejects missing reference", () => {
  const input = createWorkflowInputFixture();
  const result = createApprovalWorkflow({
    ...input,
    reference: null as unknown as CreateApprovalWorkflowInput["reference"],
  });

  assertFailure(result, "expected missing reference failure");
  assertEqual(result.errors[0]?.code, "missing_reference", "error code mismatch");
});

runTest("rejects missing reference id", () => {
  const input = createWorkflowInputFixture();
  const result = createApprovalWorkflow({
    ...input,
    reference: { ...input.reference, id: "" },
  });

  assertFailure(result, "expected missing reference id failure");
  assertEqual(result.errors[0]?.code, "missing_reference_id", "error code mismatch");
});

runTest("rejects missing steps", () => {
  const result = createApprovalWorkflow(createWorkflowInputFixture({ steps: [] }));

  assertFailure(result, "expected missing steps failure");
  assertEqual(result.errors[0]?.code, "missing_steps", "error code mismatch");
});

runTest("rejects duplicate step id", () => {
  const result = createApprovalWorkflow(
    createWorkflowInputFixture({
      steps: [
        createStepInputFixture({ id: "step-1", sequence: 1 }),
        createStepInputFixture({ id: "step-1", sequence: 2 }),
      ],
    }),
  );

  assertFailure(result, "expected duplicate step id failure");
  assertEqual(result.errors[0]?.code, "duplicate_step_id", "error code mismatch");
});

runTest("rejects duplicate step sequence", () => {
  const result = createApprovalWorkflow(
    createWorkflowInputFixture({
      steps: [
        createStepInputFixture({ id: "step-1", sequence: 1 }),
        createStepInputFixture({ id: "step-2", sequence: 1 }),
      ],
    }),
  );

  assertFailure(result, "expected duplicate step sequence failure");
  assertEqual(result.errors[0]?.code, "duplicate_step_sequence", "error code mismatch");
});

runTest("rejects invalid step sequence", () => {
  const result = createApprovalWorkflow(
    createWorkflowInputFixture({
      steps: [createStepInputFixture({ id: "step-1", sequence: 0 })],
    }),
  );

  assertFailure(result, "expected invalid step sequence failure");
  assertEqual(result.errors[0]?.code, "invalid_step_sequence", "error code mismatch");
});

runTest("rejects missing step approver", () => {
  const result = createApprovalWorkflow(
    createWorkflowInputFixture({
      steps: [createStepInputFixture({ approverId: "", approverName: "" })],
    }),
  );

  assertFailure(result, "expected missing step approver failure");
  assertEqual(result.errors[0]?.code, "missing_step_approver", "error code mismatch");
});

runTest("valid submission", () => {
  const workflow = createWorkflowFixture();
  const result = submitApprovalWorkflow({ workflow, actor, occurredAt });

  assertSuccess(result, "expected submission success");
  assertEqual(
    result.workflow.status,
    ApprovalWorkflowStatus.Submitted,
    "status mismatch after submission",
  );
});

runTest("rejects submission from an already submitted workflow", () => {
  const workflow = submitWorkflowFixture();
  const result = submitApprovalWorkflow({ workflow, actor, occurredAt });

  assertFailure(result, "expected invalid transition failure");
  assertEqual(
    result.errors[0]?.code,
    "invalid_workflow_status_transition",
    "error code mismatch",
  );
});

runTest("sequential approval of steps advances workflow to Approved", () => {
  const submitted = submitWorkflowFixture();

  const firstApproval = approveApprovalWorkflowStep({
    workflow: submitted,
    stepId: "step-1",
    actor,
    occurredAt,
  });
  assertSuccess(firstApproval, "expected first step approval success");
  assertEqual(
    firstApproval.workflow.status,
    ApprovalWorkflowStatus.InReview,
    "status should be InReview after first approval",
  );

  const secondApproval = approveApprovalWorkflowStep({
    workflow: firstApproval.workflow,
    stepId: "step-2",
    actor,
    occurredAt,
  });
  assertSuccess(secondApproval, "expected second step approval success");
  assertEqual(
    secondApproval.workflow.status,
    ApprovalWorkflowStatus.InReview,
    "status should remain InReview after second approval",
  );

  const thirdApproval = approveApprovalWorkflowStep({
    workflow: secondApproval.workflow,
    stepId: "step-3",
    actor,
    occurredAt,
  });
  assertSuccess(thirdApproval, "expected third step approval success");
  assertEqual(
    thirdApproval.workflow.status,
    ApprovalWorkflowStatus.Approved,
    "status should be Approved after all steps approved",
  );
  assertEqual(
    thirdApproval.workflow.summary.approvedSteps,
    3,
    "summary approvedSteps mismatch",
  );
  assertEqual(thirdApproval.workflow.decisions.length, 3, "decisions count mismatch");
});

runTest("blocks approval out of order", () => {
  const submitted = submitWorkflowFixture();
  const result = approveApprovalWorkflowStep({
    workflow: submitted,
    stepId: "step-2",
    actor,
    occurredAt,
  });

  assertFailure(result, "expected out of order failure");
  assertEqual(result.errors[0]?.code, "step_out_of_order", "error code mismatch");
});

runTest("rejection ends the flow as Rejected", () => {
  const submitted = submitWorkflowFixture();
  const afterFirstApproval = approveApprovalWorkflowStep({
    workflow: submitted,
    stepId: "step-1",
    actor,
    occurredAt,
  });
  assertSuccess(afterFirstApproval, "expected first step approval success");

  const rejected = rejectApprovalWorkflowStep({
    workflow: afterFirstApproval.workflow,
    stepId: "step-2",
    actor,
    occurredAt,
    comment: "Quantidades divergentes do relatorio de campo.",
  });

  assertSuccess(rejected, "expected rejection to succeed as a valid decision");
  assertEqual(
    rejected.workflow.status,
    ApprovalWorkflowStatus.Rejected,
    "workflow should be Rejected",
  );

  const furtherApproval = approveApprovalWorkflowStep({
    workflow: rejected.workflow,
    stepId: "step-3",
    actor,
    occurredAt,
  });
  assertFailure(furtherApproval, "expected terminal workflow to block further approval");
  assertEqual(
    furtherApproval.errors[0]?.code,
    "workflow_terminal",
    "error code mismatch for terminal workflow",
  );
});

runTest("request changes returns workflow to ChangesRequested", () => {
  const submitted = submitWorkflowFixture();
  const afterFirstApproval = approveApprovalWorkflowStep({
    workflow: submitted,
    stepId: "step-1",
    actor,
    occurredAt,
  });
  assertSuccess(afterFirstApproval, "expected first step approval success");

  const changesRequested = requestChangesApprovalWorkflowStep({
    workflow: afterFirstApproval.workflow,
    stepId: "step-2",
    actor,
    occurredAt,
    comment: "Anexar evidencia fotografica adicional.",
  });

  assertSuccess(changesRequested, "expected request changes success");
  assertEqual(
    changesRequested.workflow.status,
    ApprovalWorkflowStatus.ChangesRequested,
    "workflow should be ChangesRequested",
  );
  assertEqual(
    changesRequested.workflow.steps.find((step) => step.id === "step-2")?.status,
    ApprovalWorkflowStepStatus.ChangesRequested,
    "step-2 should be ChangesRequested",
  );

  const resubmitted = submitApprovalWorkflow({
    workflow: changesRequested.workflow,
    actor,
    occurredAt,
  });
  assertSuccess(resubmitted, "expected resubmission success");
  assertEqual(
    resubmitted.workflow.status,
    ApprovalWorkflowStatus.Submitted,
    "workflow should be Submitted again after resubmission",
  );
  assertEqual(
    resubmitted.workflow.steps.find((step) => step.id === "step-2")?.status,
    ApprovalWorkflowStepStatus.Pending,
    "step-2 should be reset to Pending after resubmission",
  );
  assertEqual(
    resubmitted.workflow.steps.find((step) => step.id === "step-1")?.status,
    ApprovalWorkflowStepStatus.Approved,
    "step-1 should remain Approved after resubmission",
  );
});

runTest("cancellation is allowed before a terminal state", () => {
  const workflow = createWorkflowFixture();
  const result = cancelApprovalWorkflow({
    workflow,
    actor,
    occurredAt,
    reason: "Obra suspensa temporariamente.",
  });

  assertSuccess(result, "expected cancellation success");
  assertEqual(
    result.workflow.status,
    ApprovalWorkflowStatus.Cancelled,
    "workflow should be Cancelled",
  );
});

runTest("blocks mutation on terminal states", () => {
  const cancelled = cancelWorkflowFixture();

  const submitAttempt = submitApprovalWorkflow({
    workflow: cancelled,
    actor,
    occurredAt,
  });
  assertFailure(submitAttempt, "expected submit to be blocked on terminal workflow");
  assertEqual(submitAttempt.errors[0]?.code, "workflow_terminal", "error code mismatch");

  const approveAttempt = approveApprovalWorkflowStep({
    workflow: cancelled,
    stepId: "step-1",
    actor,
    occurredAt,
  });
  assertFailure(approveAttempt, "expected approve to be blocked on terminal workflow");
  assertEqual(
    approveAttempt.errors[0]?.code,
    "workflow_terminal",
    "error code mismatch",
  );

  const rejectAttempt = rejectApprovalWorkflowStep({
    workflow: cancelled,
    stepId: "step-1",
    actor,
    occurredAt,
  });
  assertFailure(rejectAttempt, "expected reject to be blocked on terminal workflow");
  assertEqual(rejectAttempt.errors[0]?.code, "workflow_terminal", "error code mismatch");

  const changesAttempt = requestChangesApprovalWorkflowStep({
    workflow: cancelled,
    stepId: "step-1",
    actor,
    occurredAt,
  });
  assertFailure(changesAttempt, "expected request changes to be blocked on terminal workflow");
  assertEqual(
    changesAttempt.errors[0]?.code,
    "workflow_terminal",
    "error code mismatch",
  );

  const cancelAttempt = cancelApprovalWorkflow({
    workflow: cancelled,
    actor,
    occurredAt,
  });
  assertFailure(cancelAttempt, "expected cancel to be blocked on already-terminal workflow");
  assertEqual(cancelAttempt.errors[0]?.code, "workflow_terminal", "error code mismatch");
});

runTest("summarizeApprovalWorkflow is deterministic and matches stored summary", () => {
  const workflow = submitWorkflowFixture();
  const summary = summarizeApprovalWorkflow(workflow);

  assertEqual(summary.totalSteps, workflow.summary.totalSteps, "totalSteps mismatch");
  assertEqual(
    summary.pendingSteps,
    workflow.summary.pendingSteps,
    "pendingSteps mismatch",
  );
  assertEqual(
    summary.currentStepSequence,
    workflow.summary.currentStepSequence,
    "currentStepSequence mismatch",
  );
});

runTest("immutable output", () => {
  const result = createApprovalWorkflow(createWorkflowInputFixture());

  assertSuccess(result, "expected workflow creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.workflow), true, "workflow should be frozen");
  assertEqual(Object.isFrozen(result.workflow.steps), true, "steps should be frozen");
  assertEqual(Object.isFrozen(result.workflow.steps[0]), true, "step should be frozen");
  assertEqual(Object.isFrozen(result.workflow.trace), true, "trace should be frozen");
  assertEqual(
    Object.isFrozen(result.workflow.decisions),
    true,
    "decisions should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.workflow.summary),
    true,
    "summary should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.workflow.metadata),
    true,
    "metadata should be frozen",
  );
});

runTest("deterministic output", () => {
  const input = createWorkflowInputFixture();
  const first = JSON.stringify(createApprovalWorkflow(input));
  const second = JSON.stringify(createApprovalWorkflow(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("preserves traceability", () => {
  const result = createApprovalWorkflow(createWorkflowInputFixture());

  assertSuccess(result, "expected workflow creation success");
  assertEqual(
    result.workflow.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
  assertEqual(result.workflow.metadata["createdBy"], createdBy, "created by mismatch");
  assertEqual(
    result.workflow.metadata["sourceSystem"],
    sourceSystem,
    "source system mismatch",
  );
  assertEqual(result.workflow.trace.length, 1, "trace should record creation");
  assertEqual(
    result.workflow.trace[0]?.action,
    "workflow_created",
    "trace action mismatch",
  );

  const submitted = submitWorkflowFixture();
  const approved = approveApprovalWorkflowStep({
    workflow: submitted,
    stepId: "step-1",
    actor,
    occurredAt,
    comment: "Conforme medido em campo.",
  });
  assertSuccess(approved, "expected approval success");
  assertEqual(approved.workflow.trace.length, 3, "trace should grow with each action");
  assertEqual(approved.workflow.decisions.length, 1, "decisions should record the approval");
  assertEqual(
    approved.workflow.decisions[0]?.actor,
    actor,
    "decision actor mismatch",
  );
  assertEqual(
    approved.workflow.decisions[0]?.occurredAt,
    occurredAt,
    "decision occurredAt mismatch",
  );
  assertEqual(
    approved.workflow.decisions[0]?.comment,
    "Conforme medido em campo.",
    "decision comment mismatch",
  );
});

runTest(
  "does not reference decision engine, business facts, export or bulletin generation",
  () => {
    const submitted = submitWorkflowFixture();
    const approved = approveApprovalWorkflowStep({
      workflow: submitted,
      stepId: "step-1",
      actor,
      occurredAt,
    });
    assertSuccess(approved, "expected approval success");

    const serialized = JSON.stringify(approved.workflow).toLowerCase();

    [
      "bulletin",
      "boletim",
      "export",
      "pdf",
      "excel",
      "decisionengine",
      "decision_engine",
      "decision-engine",
      "businessfact",
      "business_fact",
      "cashflow",
      "cash_flow",
      "forecast",
      "revenueintelligence",
      "revenue_intelligence",
      "uuid",
    ].forEach((forbidden) => {
      assertEqual(
        serialized.includes(forbidden),
        false,
        `unexpected concept in output: ${forbidden}`,
      );
    });
  },
);

function createWorkflowFixture(): ApprovalWorkflow {
  const result = createApprovalWorkflow(createWorkflowInputFixture());
  assertSuccess(result, "expected workflow fixture creation");
  return result.workflow;
}

function submitWorkflowFixture(): ApprovalWorkflow {
  const result = submitApprovalWorkflow({
    workflow: createWorkflowFixture(),
    actor,
    occurredAt,
  });
  assertSuccess(result, "expected workflow submission fixture");
  return result.workflow;
}

function cancelWorkflowFixture(): ApprovalWorkflow {
  const result = cancelApprovalWorkflow({
    workflow: createWorkflowFixture(),
    actor,
    occurredAt,
  });
  assertSuccess(result, "expected workflow cancellation fixture");
  return result.workflow;
}

function createWorkflowInputFixture(
  overrides: Partial<CreateApprovalWorkflowInput> = {},
): CreateApprovalWorkflowInput {
  return {
    id: overrides.id ?? workflowId,
    organizationId: overrides.organizationId ?? organizationId,
    reference:
      overrides.reference ??
      {
        type: ApprovalWorkflowReferenceType.MeasurementWorkspace,
        id: referenceId,
        code: "MW-LAGOA-DO-ARROZ-8",
        name: "Medicao 8 - Lagoa do Arroz",
        metadata: { source: "measurement-workspace" },
      },
    steps:
      overrides.steps ??
      [
        createStepInputFixture({
          id: "step-1",
          sequence: 1,
          name: "Fiscal Review",
          approverId: "engineer-marcos",
          approverName: "Marcos Ferreira",
        }),
        createStepInputFixture({
          id: "step-2",
          sequence: 2,
          name: "Contract Manager Review",
          approverId: "manager-ana",
          approverName: "Ana Souza",
        }),
        createStepInputFixture({
          id: "step-3",
          sequence: 3,
          name: "Client Sign-off",
          approverId: "client-dnocs",
          approverName: "DNOCS",
        }),
      ],
    actor: overrides.actor ?? actor,
    occurredAt: overrides.occurredAt ?? occurredAt,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? { source: "approval-workflow" },
  };
}

function createStepInputFixture(
  overrides: Partial<ApprovalWorkflowStepInput> = {},
): ApprovalWorkflowStepInput {
  return {
    id: overrides.id ?? "step-1",
    sequence: overrides.sequence ?? 1,
    name: overrides.name ?? "Fiscal Review",
    approverId: overrides.approverId ?? "engineer-marcos",
    approverName: overrides.approverName ?? "Marcos Ferreira",
    metadata: overrides.metadata ?? { source: "approval-workflow" },
  };
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
  result: ApprovalWorkflowResult,
  message: string,
): asserts result is Extract<ApprovalWorkflowResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertFailure(
  result: ApprovalWorkflowResult,
  message: string,
): asserts result is Extract<ApprovalWorkflowResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
