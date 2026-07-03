import {
  MeasurementBulletinReferenceType,
  MeasurementBulletinStatus,
  MeasurementBulletinValidationSeverity,
  createMeasurementBulletin,
  finalizeMeasurementBulletin,
  summarizeMeasurementBulletin,
  validateMeasurementBulletin,
  type CreateMeasurementBulletinInput,
  type MeasurementBulletin,
  type MeasurementBulletinLineInput,
  type MeasurementBulletinResult,
} from "./index";

const bulletinId = "measurement-bulletin-lagoa-do-arroz-8";
const organizationId = "organization-alpha-engenharia";
const referenceId = "measurement-workspace-lagoa-do-arroz-8";
const contractId = "contract-lagoa-do-arroz-001";
const projectId = "project-lagoa-do-arroz";
const measurementPeriodId = "measurement-period-8";
const actor = "engineer-marcos";
const occurredAt = "2026-06-15T10:30:00Z";
const correlationId = "measurement-bulletin-correlation-001";
const createdBy = "field-office";
const sourceSystem = "engineering-os";

runTest("valid creation", () => {
  const result = createMeasurementBulletin(createBulletinInputFixture());

  assertSuccess(result, "expected bulletin creation success");
  assertEqual(result.bulletin.id, bulletinId, "bulletin id mismatch");
  assertEqual(result.bulletin.organizationId, organizationId, "organization mismatch");
  assertEqual(result.bulletin.reference.id, referenceId, "reference id mismatch");
  assertEqual(result.bulletin.header.contractId, contractId, "contract id mismatch");
  assertEqual(
    result.bulletin.status,
    MeasurementBulletinStatus.Draft,
    "initial status mismatch",
  );
  assertEqual(result.bulletin.lines.length, 1, "lines count mismatch");
  assertEqual(result.bulletin.validationIssues.length, 0, "issues should be empty pre-validation");
});

runTest("rejects missing id", () => {
  const result = createMeasurementBulletin(createBulletinInputFixture({ id: "" }));

  assertFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejects missing organizationId", () => {
  const result = createMeasurementBulletin(
    createBulletinInputFixture({ organizationId: "" }),
  );

  assertFailure(result, "expected missing organization failure");
  assertEqual(result.errors[0]?.code, "missing_organization_id", "error code mismatch");
});

runTest("rejects missing reference", () => {
  const input = createBulletinInputFixture();
  const result = createMeasurementBulletin({
    ...input,
    reference: null as unknown as CreateMeasurementBulletinInput["reference"],
  });

  assertFailure(result, "expected missing reference failure");
  assertEqual(result.errors[0]?.code, "missing_reference", "error code mismatch");
});

runTest("rejects missing reference id", () => {
  const input = createBulletinInputFixture();
  const result = createMeasurementBulletin({
    ...input,
    reference: { ...input.reference, id: "" },
  });

  assertFailure(result, "expected missing reference id failure");
  assertEqual(result.errors[0]?.code, "missing_reference_id", "error code mismatch");
});

runTest("rejects missing header", () => {
  const input = createBulletinInputFixture();
  const result = createMeasurementBulletin({
    ...input,
    header: null as unknown as CreateMeasurementBulletinInput["header"],
  });

  assertFailure(result, "expected missing header failure");
  assertEqual(result.errors[0]?.code, "missing_header", "error code mismatch");
});

runTest("rejects missing header contract id", () => {
  const input = createBulletinInputFixture();
  const result = createMeasurementBulletin({
    ...input,
    header: { ...input.header, contractId: "" },
  });

  assertFailure(result, "expected missing header contract id failure");
  assertEqual(result.errors[0]?.code, "missing_header_contract_id", "error code mismatch");
});

runTest("rejects missing header project id", () => {
  const input = createBulletinInputFixture();
  const result = createMeasurementBulletin({
    ...input,
    header: { ...input.header, projectId: "" },
  });

  assertFailure(result, "expected missing header project id failure");
  assertEqual(result.errors[0]?.code, "missing_header_project_id", "error code mismatch");
});

runTest("rejects missing header period id", () => {
  const input = createBulletinInputFixture();
  const result = createMeasurementBulletin({
    ...input,
    header: { ...input.header, measurementPeriodId: "" },
  });

  assertFailure(result, "expected missing header period id failure");
  assertEqual(result.errors[0]?.code, "missing_header_period_id", "error code mismatch");
});

runTest("rejects missing header technical responsible", () => {
  const input = createBulletinInputFixture();
  const result = createMeasurementBulletin({
    ...input,
    header: { ...input.header, technicalResponsibleId: "", technicalResponsibleName: "" },
  });

  assertFailure(result, "expected missing technical responsible failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_header_technical_responsible",
    "error code mismatch",
  );
});

runTest("rejects missing lines", () => {
  const result = createMeasurementBulletin(createBulletinInputFixture({ lines: [] }));

  assertFailure(result, "expected missing lines failure");
  assertEqual(result.errors[0]?.code, "missing_lines", "error code mismatch");
});

runTest("rejects duplicate line id", () => {
  const result = createMeasurementBulletin(
    createBulletinInputFixture({
      lines: [createLineInputFixture(), createLineInputFixture()],
    }),
  );

  assertFailure(result, "expected duplicate line id failure");
  assertEqual(result.errors[0]?.code, "duplicate_line_id", "error code mismatch");
});

runTest("rejects line without service item id", () => {
  const result = createMeasurementBulletin(
    createBulletinInputFixture({
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

runTest("rejects negative quantity", () => {
  const result = createMeasurementBulletin(
    createBulletinInputFixture({
      lines: [createLineInputFixture({ quantity: -1 })],
    }),
  );

  assertFailure(result, "expected negative quantity failure");
  assertEqual(result.errors[0]?.code, "negative_quantity", "error code mismatch");
});

runTest("rejects negative unit value", () => {
  const result = createMeasurementBulletin(
    createBulletinInputFixture({
      lines: [createLineInputFixture({ unitValue: -1 })],
    }),
  );

  assertFailure(result, "expected negative unit value failure");
  assertEqual(result.errors[0]?.code, "negative_unit_value", "error code mismatch");
});

runTest("computes deterministic line total value", () => {
  const result = createMeasurementBulletin(
    createBulletinInputFixture({
      lines: [createLineInputFixture({ quantity: 12, unitValue: 250.5 })],
    }),
  );

  assertSuccess(result, "expected bulletin creation success");
  assertEqual(result.bulletin.lines[0]?.totalValue, 3006, "total value mismatch");
});

runTest("computes deterministic totals across multiple lines", () => {
  const result = createMeasurementBulletin(
    createBulletinInputFixture({
      lines: [
        createLineInputFixture({ id: "line-001", quantity: 10, unitValue: 150 }),
        createLineInputFixture({ id: "line-002", quantity: 5, unitValue: 80 }),
      ],
    }),
  );

  assertSuccess(result, "expected bulletin creation success");
  assertEqual(result.bulletin.totals.totalLines, 2, "totalLines mismatch");
  assertEqual(result.bulletin.totals.totalQuantity, 15, "totalQuantity mismatch");
  assertEqual(result.bulletin.totals.totalValue, 1900, "totalValue mismatch");
});

runTest("validates without issues when bulletin content is sound", () => {
  const bulletin = createBulletinFixture();
  const result = validateMeasurementBulletin({ bulletin, actor, occurredAt });

  assertSuccess(result, "expected validation success");
  assertEqual(
    result.bulletin.status,
    MeasurementBulletinStatus.Validated,
    "status mismatch after validation",
  );
  assertEqual(result.bulletin.validationIssues.length, 0, "expected no validation issues");
});

runTest("validates with a warning issue for zero unit value lines", () => {
  const bulletin = createBulletinFixture({
    lines: [
      createLineInputFixture({ id: "line-001", quantity: 10, unitValue: 150 }),
      createLineInputFixture({ id: "line-002", quantity: 5, unitValue: 0 }),
    ],
  });
  const result = validateMeasurementBulletin({ bulletin, actor, occurredAt });

  assertSuccess(result, "expected validation success");
  assertEqual(result.bulletin.validationIssues.length, 1, "expected one issue");
  assertEqual(
    result.bulletin.validationIssues[0]?.code,
    "zero_unit_value_line",
    "issue code mismatch",
  );
  assertEqual(
    result.bulletin.validationIssues[0]?.severity,
    MeasurementBulletinValidationSeverity.Warning,
    "issue severity mismatch",
  );
});

runTest("validates with a blocking issue for zero quantity lines", () => {
  const bulletin = createBulletinFixture({
    lines: [createLineInputFixture({ quantity: 0, unitValue: 150 })],
  });
  const result = validateMeasurementBulletin({ bulletin, actor, occurredAt });

  assertSuccess(result, "expected validation success");
  const blockingIssue = result.bulletin.validationIssues.find(
    (issue) => issue.code === "zero_quantity_line",
  );
  assertEqual(blockingIssue !== undefined, true, "expected zero_quantity_line issue");
  assertEqual(
    blockingIssue?.severity,
    MeasurementBulletinValidationSeverity.Blocking,
    "issue severity mismatch",
  );
});

runTest("blocks finalization when blocking issues are present", () => {
  const bulletin = createBulletinFixture({
    lines: [createLineInputFixture({ quantity: 0, unitValue: 150 })],
  });
  const validated = validateMeasurementBulletin({ bulletin, actor, occurredAt });
  assertSuccess(validated, "expected validation success");

  const finalized = finalizeMeasurementBulletin({
    bulletin: validated.bulletin,
    actor,
    occurredAt,
  });

  assertFailure(finalized, "expected finalization to be blocked");
  assertEqual(
    finalized.errors[0]?.code,
    "blocking_validation_issues",
    "error code mismatch",
  );
});

runTest("blocks finalization before validation", () => {
  const bulletin = createBulletinFixture();
  const result = finalizeMeasurementBulletin({ bulletin, actor, occurredAt });

  assertFailure(result, "expected finalization to be blocked before validation");
  assertEqual(result.errors[0]?.code, "bulletin_not_validated", "error code mismatch");
});

runTest("finalizes a validated bulletin without blocking issues", () => {
  const bulletin = createBulletinFixture();
  const validated = validateMeasurementBulletin({ bulletin, actor, occurredAt });
  assertSuccess(validated, "expected validation success");

  const finalized = finalizeMeasurementBulletin({
    bulletin: validated.bulletin,
    actor,
    occurredAt,
  });

  assertSuccess(finalized, "expected finalization success");
  assertEqual(
    finalized.bulletin.status,
    MeasurementBulletinStatus.Finalized,
    "status mismatch after finalization",
  );
});

runTest("blocks mutation on a terminal (finalized) bulletin", () => {
  const bulletin = createBulletinFixture();
  const validated = validateMeasurementBulletin({ bulletin, actor, occurredAt });
  assertSuccess(validated, "expected validation success");
  const finalized = finalizeMeasurementBulletin({
    bulletin: validated.bulletin,
    actor,
    occurredAt,
  });
  assertSuccess(finalized, "expected finalization success");

  const revalidateAttempt = validateMeasurementBulletin({
    bulletin: finalized.bulletin,
    actor,
    occurredAt,
  });
  assertFailure(revalidateAttempt, "expected revalidation to be blocked on terminal bulletin");
  assertEqual(
    revalidateAttempt.errors[0]?.code,
    "bulletin_terminal",
    "error code mismatch",
  );

  const refinalizeAttempt = finalizeMeasurementBulletin({
    bulletin: finalized.bulletin,
    actor,
    occurredAt,
  });
  assertFailure(refinalizeAttempt, "expected refinalization to be blocked on terminal bulletin");
  assertEqual(
    refinalizeAttempt.errors[0]?.code,
    "bulletin_terminal",
    "error code mismatch",
  );
});

runTest("summarizeMeasurementBulletin is deterministic and matches stored totals", () => {
  const bulletin = createBulletinFixture();
  const summary = summarizeMeasurementBulletin(bulletin);

  assertEqual(summary.totalLines, bulletin.totals.totalLines, "totalLines mismatch");
  assertEqual(summary.totalQuantity, bulletin.totals.totalQuantity, "totalQuantity mismatch");
  assertEqual(summary.totalValue, bulletin.totals.totalValue, "totalValue mismatch");
});

runTest("immutable output", () => {
  const result = createMeasurementBulletin(createBulletinInputFixture());

  assertSuccess(result, "expected bulletin creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.bulletin), true, "bulletin should be frozen");
  assertEqual(Object.isFrozen(result.bulletin.lines), true, "lines should be frozen");
  assertEqual(Object.isFrozen(result.bulletin.lines[0]), true, "line should be frozen");
  assertEqual(Object.isFrozen(result.bulletin.totals), true, "totals should be frozen");
  assertEqual(Object.isFrozen(result.bulletin.trace), true, "trace should be frozen");
  assertEqual(
    Object.isFrozen(result.bulletin.validationIssues),
    true,
    "validationIssues should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.bulletin.metadata),
    true,
    "metadata should be frozen",
  );
});

runTest("deterministic output", () => {
  const input = createBulletinInputFixture();
  const first = JSON.stringify(createMeasurementBulletin(input));
  const second = JSON.stringify(createMeasurementBulletin(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("preserves traceability", () => {
  const result = createMeasurementBulletin(createBulletinInputFixture());
  assertSuccess(result, "expected bulletin creation success");
  assertEqual(
    result.bulletin.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
  assertEqual(result.bulletin.metadata["createdBy"], createdBy, "created by mismatch");
  assertEqual(
    result.bulletin.metadata["sourceSystem"],
    sourceSystem,
    "source system mismatch",
  );
  assertEqual(result.bulletin.trace.length, 1, "trace should record creation");
  assertEqual(result.bulletin.trace[0]?.action, "bulletin_created", "trace action mismatch");

  const validated = validateMeasurementBulletin({
    bulletin: result.bulletin,
    actor,
    occurredAt,
  });
  assertSuccess(validated, "expected validation success");
  assertEqual(validated.bulletin.trace.length, 2, "trace should grow after validation");
  assertEqual(
    validated.bulletin.trace[1]?.action,
    "bulletin_validated",
    "trace action mismatch after validation",
  );

  const finalized = finalizeMeasurementBulletin({
    bulletin: validated.bulletin,
    actor,
    occurredAt,
  });
  assertSuccess(finalized, "expected finalization success");
  assertEqual(finalized.bulletin.trace.length, 3, "trace should grow after finalization");
  assertEqual(
    finalized.bulletin.trace[2]?.action,
    "bulletin_finalized",
    "trace action mismatch after finalization",
  );
});

runTest(
  "does not reference decision engine, business facts, persistence, excel, pdf or file generation",
  () => {
    const bulletin = createBulletinFixture();
    const validated = validateMeasurementBulletin({ bulletin, actor, occurredAt });
    assertSuccess(validated, "expected validation success");
    const finalized = finalizeMeasurementBulletin({
      bulletin: validated.bulletin,
      actor,
      occurredAt,
    });
    assertSuccess(finalized, "expected finalization success");

    const serialized = JSON.stringify(finalized.bulletin).toLowerCase();

    [
      "pdf",
      "excel",
      "xlsx",
      "file",
      "decision",
      "businessfact",
      "business_fact",
      "cashflow",
      "cash_flow",
      "forecast",
      "revenueintelligence",
      "revenue_intelligence",
      "uuid",
      "database",
      "persist",
    ].forEach((forbidden) => {
      assertEqual(
        serialized.includes(forbidden),
        false,
        `unexpected concept in output: ${forbidden}`,
      );
    });
  },
);

function createBulletinFixture(
  overrides: Partial<CreateMeasurementBulletinInput> = {},
): MeasurementBulletin {
  const result = createMeasurementBulletin(createBulletinInputFixture(overrides));
  assertSuccess(result, "expected bulletin fixture creation");
  return result.bulletin;
}

function createBulletinInputFixture(
  overrides: Partial<CreateMeasurementBulletinInput> = {},
): CreateMeasurementBulletinInput {
  return {
    id: overrides.id ?? bulletinId,
    organizationId: overrides.organizationId ?? organizationId,
    reference:
      overrides.reference ??
      {
        type: MeasurementBulletinReferenceType.MeasurementWorkspace,
        id: referenceId,
        code: "MW-LAGOA-DO-ARROZ-8",
        name: "Medicao 8 - Lagoa do Arroz",
        metadata: { source: "measurement-workspace" },
      },
    header:
      overrides.header ??
      {
        contractId,
        contractNumber: "CT-2026-001",
        projectId,
        projectName: "Lagoa do Arroz",
        measurementPeriodId,
        periodNumber: 8,
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        technicalResponsibleId: "engineer-marcos",
        technicalResponsibleName: "Marcos Ferreira",
        metadata: { source: "engineer-workspace" },
      },
    lines: overrides.lines ?? [createLineInputFixture()],
    actor: overrides.actor ?? actor,
    occurredAt: overrides.occurredAt ?? occurredAt,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? { source: "bulletin-generator" },
  };
}

function createLineInputFixture(
  overrides: Partial<MeasurementBulletinLineInput> = {},
): MeasurementBulletinLineInput {
  return {
    id: overrides.id ?? "line-001",
    serviceItemId: overrides.serviceItemId ?? "service-item-excavation",
    serviceItemCode: overrides.serviceItemCode ?? "SI-001",
    description: overrides.description ?? "Escavacao mecanizada",
    unit: overrides.unit ?? "m3",
    quantity: overrides.quantity ?? 10,
    unitValue: overrides.unitValue ?? 150,
    metadata: overrides.metadata ?? { source: "measurement-workspace" },
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
  result: MeasurementBulletinResult,
  message: string,
): asserts result is Extract<MeasurementBulletinResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertFailure(
  result: MeasurementBulletinResult,
  message: string,
): asserts result is Extract<MeasurementBulletinResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
