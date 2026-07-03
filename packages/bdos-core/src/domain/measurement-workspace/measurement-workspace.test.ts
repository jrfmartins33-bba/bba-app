import {
  MeasurementWorkspaceReferenceType,
  MeasurementWorkspaceStatus,
  addMeasurementWorkspaceLine,
  advanceMeasurementWorkspaceStatus,
  createMeasurementWorkspace,
  removeMeasurementWorkspaceLine,
  summarizeMeasurementWorkspace,
  updateMeasurementWorkspaceLineQuantity,
  type CreateMeasurementWorkspaceInput,
  type MeasurementWorkspace,
  type MeasurementWorkspaceLineInput,
  type MeasurementWorkspaceResult,
} from "./index";

const workspaceId = "measurement-workspace-lagoa-do-arroz-8";
const organizationId = "organization-alpha-engenharia";
const referenceId = "project-lagoa-do-arroz";
const measurementPeriodId = "measurement-period-8";
const actor = "engineer-marcos";
const occurredAt = "2026-06-15T10:30:00Z";
const correlationId = "measurement-workspace-correlation-001";
const createdBy = "field-office";
const sourceSystem = "engineering-os";

const validTransitions: ReadonlyArray<
  readonly [MeasurementWorkspaceStatus, MeasurementWorkspaceStatus]
> = [
  [MeasurementWorkspaceStatus.Draft, MeasurementWorkspaceStatus.InProgress],
  [MeasurementWorkspaceStatus.Draft, MeasurementWorkspaceStatus.Cancelled],
  [MeasurementWorkspaceStatus.InProgress, MeasurementWorkspaceStatus.ReadyForReview],
  [MeasurementWorkspaceStatus.InProgress, MeasurementWorkspaceStatus.Cancelled],
  [MeasurementWorkspaceStatus.ReadyForReview, MeasurementWorkspaceStatus.InProgress],
  [MeasurementWorkspaceStatus.ReadyForReview, MeasurementWorkspaceStatus.Closed],
  [MeasurementWorkspaceStatus.ReadyForReview, MeasurementWorkspaceStatus.Cancelled],
];

runTest("valid creation", () => {
  const result = createMeasurementWorkspace(createWorkspaceInputFixture());

  assertSuccess(result, "expected workspace creation success");
  assertEqual(result.workspace.id, workspaceId, "workspace id mismatch");
  assertEqual(result.workspace.organizationId, organizationId, "organization mismatch");
  assertEqual(result.workspace.reference.id, referenceId, "reference id mismatch");
  assertEqual(
    result.workspace.period.measurementPeriodId,
    measurementPeriodId,
    "period id mismatch",
  );
  assertEqual(
    result.workspace.status,
    MeasurementWorkspaceStatus.Draft,
    "initial status mismatch",
  );
  assertEqual(result.workspace.lines.length, 1, "lines count mismatch");
});

runTest("rejects missing id", () => {
  const result = createMeasurementWorkspace(createWorkspaceInputFixture({ id: "" }));

  assertFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejects missing organizationId", () => {
  const result = createMeasurementWorkspace(
    createWorkspaceInputFixture({ organizationId: "" }),
  );

  assertFailure(result, "expected missing organization failure");
  assertEqual(result.errors[0]?.code, "missing_organization_id", "error code mismatch");
});

runTest("rejects missing reference", () => {
  const input = createWorkspaceInputFixture();
  const result = createMeasurementWorkspace({
    ...input,
    reference: null as unknown as CreateMeasurementWorkspaceInput["reference"],
  });

  assertFailure(result, "expected missing reference failure");
  assertEqual(result.errors[0]?.code, "missing_reference", "error code mismatch");
});

runTest("rejects missing reference id", () => {
  const input = createWorkspaceInputFixture();
  const result = createMeasurementWorkspace({
    ...input,
    reference: { ...input.reference, id: "" },
  });

  assertFailure(result, "expected missing reference id failure");
  assertEqual(result.errors[0]?.code, "missing_reference_id", "error code mismatch");
});

runTest("rejects missing period", () => {
  const input = createWorkspaceInputFixture();
  const result = createMeasurementWorkspace({
    ...input,
    period: null as unknown as CreateMeasurementWorkspaceInput["period"],
  });

  assertFailure(result, "expected missing period failure");
  assertEqual(result.errors[0]?.code, "missing_period", "error code mismatch");
});

runTest("rejects missing period id", () => {
  const input = createWorkspaceInputFixture();
  const result = createMeasurementWorkspace({
    ...input,
    period: { ...input.period, measurementPeriodId: "" },
  });

  assertFailure(result, "expected missing period id failure");
  assertEqual(result.errors[0]?.code, "missing_period_id", "error code mismatch");
});

runTest("rejects negative quantity on creation", () => {
  const result = createMeasurementWorkspace(
    createWorkspaceInputFixture({
      lines: [createLineInputFixture({ quantity: -1 })],
    }),
  );

  assertFailure(result, "expected negative quantity failure");
  assertEqual(result.errors[0]?.code, "negative_quantity", "error code mismatch");
});

runTest("rejects negative unit value on creation", () => {
  const result = createMeasurementWorkspace(
    createWorkspaceInputFixture({
      lines: [createLineInputFixture({ unitValue: -1 })],
    }),
  );

  assertFailure(result, "expected negative unit value failure");
  assertEqual(result.errors[0]?.code, "negative_unit_value", "error code mismatch");
});

runTest("rejects duplicate line id on creation", () => {
  const result = createMeasurementWorkspace(
    createWorkspaceInputFixture({
      lines: [createLineInputFixture(), createLineInputFixture()],
    }),
  );

  assertFailure(result, "expected duplicate line id failure");
  assertEqual(result.errors[0]?.code, "duplicate_line_id", "error code mismatch");
});

runTest("rejects line without service item id", () => {
  const result = createMeasurementWorkspace(
    createWorkspaceInputFixture({
      lines: [createLineInputFixture({ serviceItemId: "" })],
    }),
  );

  assertFailure(result, "expected missing service item id failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_line_service_item_id",
    "error code mismatch",
  );
});

runTest("computes deterministic line total value", () => {
  const result = createMeasurementWorkspace(
    createWorkspaceInputFixture({
      lines: [createLineInputFixture({ quantity: 12, unitValue: 250.5 })],
    }),
  );

  assertSuccess(result, "expected workspace creation success");
  assertEqual(result.workspace.lines[0]?.totalValue, 3006, "total value mismatch");
});

runTest("adds a line", () => {
  const workspace = createWorkspaceFixture();
  const result = addMeasurementWorkspaceLine({
    workspace,
    line: createLineInputFixture({ id: "line-002", serviceItemCode: "SI-002" }),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add line success");
  assertEqual(result.workspace.lines.length, 2, "lines count mismatch after add");
  assertEqual(
    result.workspace.summary.totalLines,
    2,
    "summary total lines mismatch after add",
  );
});

runTest("rejects adding a duplicate line id", () => {
  const workspace = createWorkspaceFixture();
  const result = addMeasurementWorkspaceLine({
    workspace,
    line: createLineInputFixture(),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate line id failure on add");
  assertEqual(result.errors[0]?.code, "duplicate_line_id", "error code mismatch");
});

runTest("rejects adding a line while workspace is not mutable", () => {
  const workspace = createWorkspaceFixture(MeasurementWorkspaceStatus.Closed);
  const result = addMeasurementWorkspaceLine({
    workspace,
    line: createLineInputFixture({ id: "line-002" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected workspace not mutable failure on add");
  assertEqual(result.errors[0]?.code, "workspace_not_mutable", "error code mismatch");
});

runTest("removes a line", () => {
  const workspace = createWorkspaceFixture();
  const result = removeMeasurementWorkspaceLine({
    workspace,
    lineId: "line-001",
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected remove line success");
  assertEqual(result.workspace.lines.length, 0, "lines count mismatch after remove");
  assertEqual(result.workspace.summary.totalValue, 0, "summary value mismatch after remove");
});

runTest("rejects removing an unknown line", () => {
  const workspace = createWorkspaceFixture();
  const result = removeMeasurementWorkspaceLine({
    workspace,
    lineId: "line-unknown",
    actor,
    occurredAt,
  });

  assertFailure(result, "expected line not found failure on remove");
  assertEqual(result.errors[0]?.code, "line_not_found", "error code mismatch");
});

runTest("updates a line quantity", () => {
  const workspace = createWorkspaceFixture();
  const result = updateMeasurementWorkspaceLineQuantity({
    workspace,
    lineId: "line-001",
    quantity: 20,
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected update quantity success");
  assertEqual(result.workspace.lines[0]?.quantity, 20, "quantity mismatch");
  assertEqual(
    result.workspace.lines[0]?.totalValue,
    result.workspace.lines[0]!.quantity * result.workspace.lines[0]!.unitValue,
    "total value not recomputed",
  );
});

runTest("rejects negative quantity on update", () => {
  const workspace = createWorkspaceFixture();
  const result = updateMeasurementWorkspaceLineQuantity({
    workspace,
    lineId: "line-001",
    quantity: -5,
    actor,
    occurredAt,
  });

  assertFailure(result, "expected negative quantity failure on update");
  assertEqual(result.errors[0]?.code, "negative_quantity", "error code mismatch");
});

runTest("rejects updating an unknown line", () => {
  const workspace = createWorkspaceFixture();
  const result = updateMeasurementWorkspaceLineQuantity({
    workspace,
    lineId: "line-unknown",
    quantity: 5,
    actor,
    occurredAt,
  });

  assertFailure(result, "expected line not found failure on update");
  assertEqual(result.errors[0]?.code, "line_not_found", "error code mismatch");
});

runTest("summarizeMeasurementWorkspace is deterministic and matches stored summary", () => {
  const workspace = createWorkspaceFixture();
  const summary = summarizeMeasurementWorkspace(workspace);

  assertEqual(summary.totalLines, workspace.summary.totalLines, "totalLines mismatch");
  assertEqual(
    summary.totalQuantity,
    workspace.summary.totalQuantity,
    "totalQuantity mismatch",
  );
  assertEqual(summary.totalValue, workspace.summary.totalValue, "totalValue mismatch");
});

runTest("all valid status transitions", () => {
  validTransitions.forEach(([fromStatus, toStatus]) => {
    const result = advanceMeasurementWorkspaceStatus({
      workspace: createWorkspaceFixture(fromStatus),
      toStatus,
      actor,
      occurredAt,
    });

    assertSuccess(result, `expected ${fromStatus} to ${toStatus} success`);
    assertEqual(result.workspace.status, toStatus, "transition status mismatch");
  });
});

runTest("all invalid status transitions return structured errors", () => {
  const statuses = [
    MeasurementWorkspaceStatus.Draft,
    MeasurementWorkspaceStatus.InProgress,
    MeasurementWorkspaceStatus.ReadyForReview,
    MeasurementWorkspaceStatus.Closed,
    MeasurementWorkspaceStatus.Cancelled,
  ];
  let invalidTransitionCount = 0;

  statuses.forEach((fromStatus) => {
    statuses.forEach((toStatus) => {
      if (isValidTransition(fromStatus, toStatus)) {
        return;
      }

      invalidTransitionCount += 1;
      const result = advanceMeasurementWorkspaceStatus({
        workspace: createWorkspaceFixture(fromStatus),
        toStatus,
        actor,
        occurredAt,
      });

      assertFailure(result, `expected ${fromStatus} to ${toStatus} failure`);
      assertEqual(
        result.errors[0]?.code,
        "invalid_workspace_status_transition",
        "transition error code mismatch",
      );
    });
  });

  assertEqual(invalidTransitionCount, 18, "invalid transition count mismatch");
});

runTest("cannot approve, export or generate bulletin in this sprint", () => {
  const statusValues = Object.values(MeasurementWorkspaceStatus).map((value) =>
    value.toLowerCase(),
  );

  statusValues.forEach((value) => {
    assertEqual(
      value.includes("approv") || value.includes("export") || value.includes("bulletin"),
      false,
      `unexpected status concept: ${value}`,
    );
  });
});

runTest("immutable output", () => {
  const result = createMeasurementWorkspace(createWorkspaceInputFixture());

  assertSuccess(result, "expected workspace creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.workspace), true, "workspace should be frozen");
  assertEqual(Object.isFrozen(result.workspace.lines), true, "lines should be frozen");
  assertEqual(Object.isFrozen(result.workspace.lines[0]), true, "line should be frozen");
  assertEqual(Object.isFrozen(result.workspace.trace), true, "trace should be frozen");
  assertEqual(
    Object.isFrozen(result.workspace.summary),
    true,
    "summary should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.workspace.metadata),
    true,
    "metadata should be frozen",
  );
});

runTest("deterministic output", () => {
  const input = createWorkspaceInputFixture();
  const first = JSON.stringify(createMeasurementWorkspace(input));
  const second = JSON.stringify(createMeasurementWorkspace(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("preserves traceability", () => {
  const result = createMeasurementWorkspace(createWorkspaceInputFixture());

  assertSuccess(result, "expected workspace creation success");
  assertEqual(
    result.workspace.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
  assertEqual(result.workspace.metadata["createdBy"], createdBy, "created by mismatch");
  assertEqual(
    result.workspace.metadata["sourceSystem"],
    sourceSystem,
    "source system mismatch",
  );
  assertEqual(result.workspace.trace.length, 1, "trace should record creation");
  assertEqual(
    result.workspace.trace[0]?.action,
    "workspace_created",
    "trace action mismatch",
  );
  assertEqual(result.workspace.trace[0]?.actor, actor, "trace actor mismatch");
  assertEqual(
    result.workspace.trace[0]?.occurredAt,
    occurredAt,
    "trace occurredAt mismatch",
  );
});

runTest("trace grows with each mutation", () => {
  const created = createMeasurementWorkspace(createWorkspaceInputFixture());
  assertSuccess(created, "expected workspace creation success");

  const added = addMeasurementWorkspaceLine({
    workspace: created.workspace,
    line: createLineInputFixture({ id: "line-002" }),
    actor,
    occurredAt,
  });
  assertSuccess(added, "expected add line success");
  assertEqual(added.workspace.trace.length, 2, "trace should grow after add");

  const advanced = advanceMeasurementWorkspaceStatus({
    workspace: added.workspace,
    toStatus: MeasurementWorkspaceStatus.InProgress,
    actor,
    occurredAt,
  });
  assertSuccess(advanced, "expected status advance success");
  assertEqual(advanced.workspace.trace.length, 3, "trace should grow after status change");
});

runTest("does not reference decision engine, business facts or forbidden operations", () => {
  const result = createMeasurementWorkspace(createWorkspaceInputFixture());
  assertSuccess(result, "expected workspace creation success");

  const serialized = JSON.stringify(result.workspace).toLowerCase();

  [
    "decision",
    "businessfact",
    "business_fact",
    "cashflow",
    "cash_flow",
    "forecast",
    "revenueintelligence",
    "revenue_intelligence",
    "approve",
    "export",
    "bulletin",
    "uuid",
  ].forEach((forbidden) => {
    assertEqual(
      serialized.includes(forbidden),
      false,
      `unexpected concept in output: ${forbidden}`,
    );
  });
});

function createWorkspaceFixture(
  status: MeasurementWorkspaceStatus = MeasurementWorkspaceStatus.Draft,
): MeasurementWorkspace {
  const result = createMeasurementWorkspace(createWorkspaceInputFixture());

  assertSuccess(result, "expected workspace fixture creation");

  return {
    ...result.workspace,
    status,
  };
}

function createWorkspaceInputFixture(
  overrides: Partial<CreateMeasurementWorkspaceInput> = {},
): CreateMeasurementWorkspaceInput {
  return {
    id: overrides.id ?? workspaceId,
    organizationId: overrides.organizationId ?? organizationId,
    reference:
      overrides.reference ??
      {
        type: MeasurementWorkspaceReferenceType.Project,
        id: referenceId,
        code: "PRJ-LAGOA-DO-ARROZ",
        name: "Lagoa do Arroz",
        metadata: { source: "project-management" },
      },
    period:
      overrides.period ??
      {
        measurementPeriodId,
        periodNumber: 8,
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        metadata: { source: "measurement" },
      },
    lines: overrides.lines ?? [createLineInputFixture()],
    actor: overrides.actor ?? actor,
    occurredAt: overrides.occurredAt ?? occurredAt,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? { source: "measurement-workspace" },
  };
}

function createLineInputFixture(
  overrides: Partial<MeasurementWorkspaceLineInput> = {},
): MeasurementWorkspaceLineInput {
  return {
    id: overrides.id ?? "line-001",
    serviceItemId: overrides.serviceItemId ?? "service-item-excavation",
    serviceItemCode: overrides.serviceItemCode ?? "SI-001",
    description: overrides.description ?? "Escavacao mecanizada",
    unit: overrides.unit ?? "m3",
    quantity: overrides.quantity ?? 10,
    unitValue: overrides.unitValue ?? 150,
    notes: overrides.notes ?? "",
    metadata: overrides.metadata ?? { source: "field-office" },
  };
}

function isValidTransition(
  fromStatus: MeasurementWorkspaceStatus,
  toStatus: MeasurementWorkspaceStatus,
): boolean {
  return validTransitions.some(
    ([validFromStatus, validToStatus]) =>
      validFromStatus === fromStatus && validToStatus === toStatus,
  );
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
  result: MeasurementWorkspaceResult,
  message: string,
): asserts result is Extract<MeasurementWorkspaceResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertFailure(
  result: MeasurementWorkspaceResult,
  message: string,
): asserts result is Extract<MeasurementWorkspaceResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
