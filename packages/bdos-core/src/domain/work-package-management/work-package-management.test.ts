import {
  WorkPackageStatus,
  WorkPackageType,
  advanceWorkPackageStatus,
  createWorkPackage,
  type CreateWorkPackageInput,
  type WorkPackage,
  type WorkPackageManagementResult,
} from "./index";

const workPackageId = "work-package-earthworks";
const organizationId = "organization-alpha-engenharia";
const clientId = "client-dnocs";
const contractId = "contract-lagoa-do-arroz-001";
const projectId = "project-lagoa-do-arroz";
const parentWorkPackageId = "work-package-civil-works";
const correlationId = "work-package-management-correlation-001";
const createdBy = "project-controls";
const sourceSystem = "engineering-os";

const validTransitions: ReadonlyArray<
  readonly [WorkPackageStatus, WorkPackageStatus]
> = [
  [WorkPackageStatus.Draft, WorkPackageStatus.Active],
  [WorkPackageStatus.Active, WorkPackageStatus.Suspended],
  [WorkPackageStatus.Suspended, WorkPackageStatus.Active],
  [WorkPackageStatus.Active, WorkPackageStatus.Completed],
  [WorkPackageStatus.Active, WorkPackageStatus.Cancelled],
  [WorkPackageStatus.Draft, WorkPackageStatus.Cancelled],
];

runTest("valid creation", () => {
  const result = createWorkPackage(createWorkPackageInputFixture());

  assertWorkPackageSuccess(result, "expected work package creation success");
  assertEqual(result.workPackage.id, workPackageId, "work package id mismatch");
  assertEqual(
    result.workPackage.organizationId,
    organizationId,
    "organization id mismatch",
  );
  assertEqual(result.workPackage.clientId, clientId, "client id mismatch");
  assertEqual(result.workPackage.contractId, contractId, "contract id mismatch");
  assertEqual(result.workPackage.projectId, projectId, "project id mismatch");
  assertEqual(result.workPackage.code, "01.02", "code mismatch");
  assertEqual(result.workPackage.name, "Terraplenagem", "name mismatch");
  assertEqual(
    result.workPackage.description,
    "Frente operacional de terraplenagem da barragem.",
    "description mismatch",
  );
  assertEqual(
    result.workPackage.type,
    WorkPackageType.ExecutionFront,
    "type mismatch",
  );
  assertEqual(result.workPackage.sequence, 2, "sequence mismatch");
});

runTest("rejects missing organizationId", () => {
  const result = createWorkPackage(
    createWorkPackageInputFixture({ organizationId: "" }),
  );

  assertWorkPackageFailure(result, "expected missing organization failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_organization_id",
    "error code mismatch",
  );
});

runTest("rejects missing contractId", () => {
  const result = createWorkPackage(createWorkPackageInputFixture({ contractId: "" }));

  assertWorkPackageFailure(result, "expected missing contract failure");
  assertEqual(result.errors[0]?.code, "missing_contract_id", "error code mismatch");
});

runTest("rejects missing projectId", () => {
  const result = createWorkPackage(createWorkPackageInputFixture({ projectId: "" }));

  assertWorkPackageFailure(result, "expected missing project failure");
  assertEqual(result.errors[0]?.code, "missing_project_id", "error code mismatch");
});

runTest("rejects missing code", () => {
  const result = createWorkPackage(createWorkPackageInputFixture({ code: "" }));

  assertWorkPackageFailure(result, "expected missing code failure");
  assertEqual(result.errors[0]?.code, "missing_code", "error code mismatch");
});

runTest("rejects missing name", () => {
  const result = createWorkPackage(createWorkPackageInputFixture({ name: "" }));

  assertWorkPackageFailure(result, "expected missing name failure");
  assertEqual(result.errors[0]?.code, "missing_name", "error code mismatch");
});

runTest("rejects missing type", () => {
  const result = createWorkPackage(createWorkPackageInputFixture({ type: null }));

  assertWorkPackageFailure(result, "expected missing type failure");
  assertEqual(result.errors[0]?.code, "missing_type", "error code mismatch");
});

runTest("rejects negative sequence", () => {
  const result = createWorkPackage(createWorkPackageInputFixture({ sequence: -1 }));

  assertWorkPackageFailure(result, "expected invalid sequence failure");
  assertEqual(result.errors[0]?.code, "invalid_sequence", "error code mismatch");
});

runTest("preserves parentWorkPackageId", () => {
  const result = createWorkPackage(createWorkPackageInputFixture());

  assertWorkPackageSuccess(result, "expected work package creation success");
  assertEqual(
    result.workPackage.parentWorkPackageId,
    parentWorkPackageId,
    "parent work package id mismatch",
  );
  assertEqual(
    result.workPackage.metadata["parentWorkPackageId"],
    parentWorkPackageId,
    "parent metadata mismatch",
  );
});

runTest("allows null parentWorkPackageId", () => {
  const result = createWorkPackage(
    createWorkPackageInputFixture({ parentWorkPackageId: null }),
  );

  assertWorkPackageSuccess(result, "expected work package creation success");
  assertEqual(result.workPackage.parentWorkPackageId, null, "parent should be null");
});

runTest("preserves optional clientId when informed", () => {
  const result = createWorkPackage(createWorkPackageInputFixture());

  assertWorkPackageSuccess(result, "expected work package creation success");
  assertEqual(result.workPackage.clientId, clientId, "client id mismatch");
  assertEqual(result.workPackage.metadata["clientId"], clientId, "metadata mismatch");
});

runTest("allows missing clientId", () => {
  const result = createWorkPackage(
    createWorkPackageInputFixture({ clientId: null }),
  );

  assertWorkPackageSuccess(result, "expected work package creation success");
  assertEqual(result.workPackage.clientId, null, "client id should be null");
});

runTest("initial status is Draft", () => {
  const result = createWorkPackage(createWorkPackageInputFixture());

  assertWorkPackageSuccess(result, "expected work package creation success");
  assertEqual(
    result.workPackage.status,
    WorkPackageStatus.Draft,
    "initial status mismatch",
  );
});

runTest("all valid status transitions", () => {
  validTransitions.forEach(([fromStatus, toStatus]) => {
    const result = advanceWorkPackageStatus({
      workPackage: createWorkPackageFixture(fromStatus),
      toStatus,
      metadata: {
        actor: "project-controls",
      },
    });

    assertWorkPackageSuccess(result, `expected ${fromStatus} to ${toStatus} success`);
    assertEqual(result.workPackage.status, toStatus, "transition status mismatch");
    assertEqual(
      result.workPackage.metadata["fromStatus"],
      fromStatus,
      "from status metadata mismatch",
    );
    assertEqual(
      result.workPackage.metadata["toStatus"],
      toStatus,
      "to status metadata mismatch",
    );
  });
});

runTest("all invalid status transitions return structured errors", () => {
  const statuses = [
    WorkPackageStatus.Draft,
    WorkPackageStatus.Active,
    WorkPackageStatus.Suspended,
    WorkPackageStatus.Completed,
    WorkPackageStatus.Cancelled,
  ];
  let invalidTransitionCount = 0;

  statuses.forEach((fromStatus) => {
    statuses.forEach((toStatus) => {
      if (isValidTransition(fromStatus, toStatus)) {
        return;
      }

      invalidTransitionCount += 1;
      const result = advanceWorkPackageStatus({
        workPackage: createWorkPackageFixture(fromStatus),
        toStatus,
      });

      assertWorkPackageFailure(
        result,
        `expected ${fromStatus} to ${toStatus} failure`,
      );
      assertEqual(
        result.errors[0]?.code,
        "invalid_work_package_transition",
        "transition error code mismatch",
      );
      assertEqual(
        result.errors[0]?.metadata["fromStatus"],
        fromStatus,
        "from status metadata mismatch",
      );
      assertEqual(
        result.errors[0]?.metadata["toStatus"],
        toStatus,
        "to status metadata mismatch",
      );
    });
  });

  assertEqual(invalidTransitionCount, 19, "invalid transition count mismatch");
});

runTest("immutable output", () => {
  const result = createWorkPackage(createWorkPackageInputFixture());

  assertWorkPackageSuccess(result, "expected work package creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(
    Object.isFrozen(result.workPackage),
    true,
    "work package should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.workPackage.metadata),
    true,
    "metadata should be frozen",
  );
  assertEqual(Object.isFrozen(result.errors), true, "errors should be frozen");
  assertEqual(Object.isFrozen(result.warnings), true, "warnings should be frozen");
});

runTest("deterministic output", () => {
  const input = createWorkPackageInputFixture();
  const first = JSON.stringify(createWorkPackage(input));
  const second = JSON.stringify(createWorkPackage(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("preserves traceability", () => {
  const result = createWorkPackage(createWorkPackageInputFixture());

  assertWorkPackageSuccess(result, "expected work package creation success");
  assertEqual(
    result.workPackage.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
  assertEqual(result.workPackage.metadata["createdBy"], createdBy, "created by mismatch");
  assertEqual(
    result.workPackage.metadata["sourceSystem"],
    sourceSystem,
    "source system mismatch",
  );
  assertEqual(
    result.workPackage.metadata["workPackageId"],
    workPackageId,
    "work package metadata mismatch",
  );
  assertEqual(
    result.workPackage.metadata["organizationId"],
    organizationId,
    "organization metadata mismatch",
  );
  assertEqual(
    result.workPackage.metadata["contractId"],
    contractId,
    "contract metadata mismatch",
  );
  assertEqual(
    result.workPackage.metadata["projectId"],
    projectId,
    "project metadata mismatch",
  );
});

runTest("preserves metadata", () => {
  const result = createWorkPackage(
    createWorkPackageInputFixture({
      metadata: {
        futureServiceItemsIntegration: "prepared",
        futureMeasurementEntryIntegration: "prepared",
        futureCurveSIntegration: "prepared",
        futureDashboardIntegration: "prepared",
      },
    }),
  );

  assertWorkPackageSuccess(result, "expected work package creation success");
  assertEqual(
    result.workPackage.metadata["futureServiceItemsIntegration"],
    "prepared",
    "service items metadata mismatch",
  );
  assertEqual(
    result.workPackage.metadata["futureMeasurementEntryIntegration"],
    "prepared",
    "measurement entry metadata mismatch",
  );
  assertEqual(
    result.workPackage.metadata["futureCurveSIntegration"],
    "prepared",
    "curve s metadata mismatch",
  );
  assertEqual(
    result.workPackage.metadata["futureDashboardIntegration"],
    "prepared",
    "dashboard metadata mismatch",
  );
});

function createWorkPackageFixture(
  status: WorkPackageStatus = WorkPackageStatus.Draft,
): WorkPackage {
  const result = createWorkPackage(createWorkPackageInputFixture());

  assertWorkPackageSuccess(result, "expected work package fixture creation");

  return {
    ...result.workPackage,
    status,
  };
}

function createWorkPackageInputFixture(
  overrides: Partial<CreateWorkPackageInput> = {},
): CreateWorkPackageInput {
  return {
    id: overrides.id ?? workPackageId,
    organizationId: overrides.organizationId ?? organizationId,
    clientId: overrides.clientId === undefined ? clientId : overrides.clientId,
    contractId: overrides.contractId ?? contractId,
    projectId: overrides.projectId ?? projectId,
    code: overrides.code ?? "01.02",
    name: overrides.name ?? "Terraplenagem",
    description:
      overrides.description ??
      "Frente operacional de terraplenagem da barragem.",
    type:
      overrides.type === undefined
        ? WorkPackageType.ExecutionFront
        : overrides.type,
    parentWorkPackageId:
      overrides.parentWorkPackageId === undefined
        ? parentWorkPackageId
        : overrides.parentWorkPackageId,
    sequence: overrides.sequence ?? 2,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? {
      source: "work-package-management",
    },
  };
}

function isValidTransition(
  fromStatus: WorkPackageStatus,
  toStatus: WorkPackageStatus,
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

function assertWorkPackageSuccess(
  result: WorkPackageManagementResult,
  message: string,
): asserts result is Extract<WorkPackageManagementResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertWorkPackageFailure(
  result: WorkPackageManagementResult,
  message: string,
): asserts result is Extract<WorkPackageManagementResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
