import {
  createEngineerWorkspace,
  type CreateEngineerWorkspaceInput,
  type EngineerWorkspacePeriod,
  type EngineerWorkspaceProject,
  type EngineerWorkspaceResult,
  type EngineerWorkspaceServiceItem,
  type EngineerWorkspaceWorkPackage,
} from "./index";

const workspaceId = "engineer-workspace-lagoa-do-arroz-2026-08";
const engineerId = "engineer-marcos";
const engineerName = "Marcos Ferreira";
const organizationId = "organization-alpha-engenharia";
const projectId = "project-lagoa-do-arroz";
const contractId = "contract-lagoa-do-arroz-001";
const measurementPeriodId = "measurement-period-8";
const correlationId = "engineer-workspace-correlation-001";
const createdBy = "field-office";
const sourceSystem = "engineering-os";

runTest("valid creation", () => {
  const result = createEngineerWorkspace(createWorkspaceInputFixture());

  assertWorkspaceSuccess(result, "expected workspace creation success");
  assertEqual(result.workspace.id, workspaceId, "workspace id mismatch");
  assertEqual(result.workspace.engineerId, engineerId, "engineer id mismatch");
  assertEqual(result.workspace.engineerName, engineerName, "engineer name mismatch");
  assertEqual(
    result.workspace.organizationId,
    organizationId,
    "organization id mismatch",
  );
  assertEqual(result.workspace.project.projectId, projectId, "project id mismatch");
  assertEqual(
    result.workspace.period.measurementPeriodId,
    measurementPeriodId,
    "period id mismatch",
  );
});

runTest("rejects missing id", () => {
  const result = createEngineerWorkspace(createWorkspaceInputFixture({ id: "" }));

  assertWorkspaceFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejects missing engineerId", () => {
  const result = createEngineerWorkspace(
    createWorkspaceInputFixture({ engineerId: "" }),
  );

  assertWorkspaceFailure(result, "expected missing engineer id failure");
  assertEqual(result.errors[0]?.code, "missing_engineer_id", "error code mismatch");
});

runTest("rejects missing engineerName", () => {
  const result = createEngineerWorkspace(
    createWorkspaceInputFixture({ engineerName: "" }),
  );

  assertWorkspaceFailure(result, "expected missing engineer name failure");
  assertEqual(result.errors[0]?.code, "missing_engineer_name", "error code mismatch");
});

runTest("rejects missing organizationId", () => {
  const result = createEngineerWorkspace(
    createWorkspaceInputFixture({ organizationId: "" }),
  );

  assertWorkspaceFailure(result, "expected missing organization failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_organization_id",
    "error code mismatch",
  );
});

runTest("rejects missing project", () => {
  const result = createEngineerWorkspace(
    createWorkspaceInputFixture({ project: null }),
  );

  assertWorkspaceFailure(result, "expected missing project failure");
  assertEqual(result.errors[0]?.code, "missing_project", "error code mismatch");
});

runTest("rejects missing period", () => {
  const result = createEngineerWorkspace(
    createWorkspaceInputFixture({ period: null }),
  );

  assertWorkspaceFailure(result, "expected missing period failure");
  assertEqual(result.errors[0]?.code, "missing_period", "error code mismatch");
});

runTest("rejects missing workPackages", () => {
  const result = createEngineerWorkspace(
    createWorkspaceInputFixture({ workPackages: null }),
  );

  assertWorkspaceFailure(result, "expected missing work packages failure");
  assertEqual(result.errors[0]?.code, "missing_work_packages", "error code mismatch");
});

runTest("sorts workPackages by sequence", () => {
  const result = createEngineerWorkspace(createWorkspaceInputFixture());

  assertWorkspaceSuccess(result, "expected workspace creation success");
  assertEqual(
    JSON.stringify(
      result.workspace.workPackages.map((workPackage) => workPackage.sequence),
    ),
    JSON.stringify([1, 2, 3]),
    "work package order mismatch",
  );
});

runTest("sorts serviceItems by code", () => {
  const result = createEngineerWorkspace(createWorkspaceInputFixture());

  assertWorkspaceSuccess(result, "expected workspace creation success");
  const firstWorkPackage = result.workspace.workPackages[0];
  assertEqual(
    JSON.stringify(firstWorkPackage?.serviceItems.map((item) => item.code)),
    JSON.stringify(["01.01.01", "01.01.02"]),
    "service item order mismatch",
  );
});

runTest("does not mutate original objects", () => {
  const workPackages = createWorkPackagesFixture();
  const originalWorkPackageOrder = JSON.stringify(
    workPackages.map((workPackage) => workPackage.sequence),
  );
  const originalServiceItemOrder = JSON.stringify(
    workPackages[2]?.serviceItems.map((item) => item.code),
  );

  createEngineerWorkspace(createWorkspaceInputFixture({ workPackages }));

  assertEqual(
    JSON.stringify(workPackages.map((workPackage) => workPackage.sequence)),
    originalWorkPackageOrder,
    "original work packages should not be mutated",
  );
  assertEqual(
    JSON.stringify(workPackages[2]?.serviceItems.map((item) => item.code)),
    originalServiceItemOrder,
    "original service items should not be mutated",
  );
});

runTest("summary totalWorkPackages", () => {
  const result = createEngineerWorkspace(createWorkspaceInputFixture());

  assertWorkspaceSuccess(result, "expected workspace creation success");
  assertEqual(result.workspace.summary.totalWorkPackages, 3, "total packages mismatch");
});

runTest("summary totalServiceItems", () => {
  const result = createEngineerWorkspace(createWorkspaceInputFixture());

  assertWorkspaceSuccess(result, "expected workspace creation success");
  assertEqual(result.workspace.summary.totalServiceItems, 5, "total items mismatch");
});

runTest("summary activeServiceItems", () => {
  const result = createEngineerWorkspace(createWorkspaceInputFixture());

  assertWorkspaceSuccess(result, "expected workspace creation success");
  assertEqual(result.workspace.summary.activeServiceItems, 3, "active items mismatch");
});

runTest("summary completedServiceItems", () => {
  const result = createEngineerWorkspace(createWorkspaceInputFixture());

  assertWorkspaceSuccess(result, "expected workspace creation success");
  assertEqual(
    result.workspace.summary.completedServiceItems,
    1,
    "completed items mismatch",
  );
});

runTest("summary itemsWithRemainingQuantity", () => {
  const result = createEngineerWorkspace(createWorkspaceInputFixture());

  assertWorkspaceSuccess(result, "expected workspace creation success");
  assertEqual(
    result.workspace.summary.itemsWithRemainingQuantity,
    3,
    "items with remaining quantity mismatch",
  );
});

runTest("summary itemsWithoutRemainingQuantity", () => {
  const result = createEngineerWorkspace(createWorkspaceInputFixture());

  assertWorkspaceSuccess(result, "expected workspace creation success");
  assertEqual(
    result.workspace.summary.itemsWithoutRemainingQuantity,
    2,
    "items without remaining quantity mismatch",
  );
});

runTest("immutable output", () => {
  const result = createEngineerWorkspace(createWorkspaceInputFixture());

  assertWorkspaceSuccess(result, "expected workspace creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.workspace), true, "workspace should be frozen");
  assertEqual(
    Object.isFrozen(result.workspace.project),
    true,
    "project should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.workspace.period),
    true,
    "period should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.workspace.workPackages),
    true,
    "work packages should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.workspace.workPackages[0]?.serviceItems),
    true,
    "service items should be frozen",
  );
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
  const first = JSON.stringify(createEngineerWorkspace(input));
  const second = JSON.stringify(createEngineerWorkspace(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("preserves traceability", () => {
  const result = createEngineerWorkspace(createWorkspaceInputFixture());

  assertWorkspaceSuccess(result, "expected workspace creation success");
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
  assertEqual(
    result.workspace.metadata["workspaceId"],
    workspaceId,
    "workspace metadata mismatch",
  );
  assertEqual(
    result.workspace.metadata["engineerId"],
    engineerId,
    "engineer metadata mismatch",
  );
  assertEqual(
    result.workspace.metadata["organizationId"],
    organizationId,
    "organization metadata mismatch",
  );
  assertEqual(
    result.workspace.metadata["projectId"],
    projectId,
    "project metadata mismatch",
  );
  assertEqual(
    result.workspace.metadata["measurementPeriodId"],
    measurementPeriodId,
    "period metadata mismatch",
  );
});

runTest("preserves metadata", () => {
  const result = createEngineerWorkspace(
    createWorkspaceInputFixture({
      metadata: {
        futureMeasurementEntryIntegration: "prepared",
        futureEvidenceCenterIntegration: "prepared",
        futureMobileAppIntegration: "prepared",
        futureFieldAppIntegration: "prepared",
      },
    }),
  );

  assertWorkspaceSuccess(result, "expected workspace creation success");
  assertEqual(
    result.workspace.metadata["futureMeasurementEntryIntegration"],
    "prepared",
    "measurement entry metadata mismatch",
  );
  assertEqual(
    result.workspace.metadata["futureEvidenceCenterIntegration"],
    "prepared",
    "evidence center metadata mismatch",
  );
  assertEqual(
    result.workspace.metadata["futureMobileAppIntegration"],
    "prepared",
    "mobile app metadata mismatch",
  );
  assertEqual(
    result.workspace.metadata["futureFieldAppIntegration"],
    "prepared",
    "field app metadata mismatch",
  );
});

runTest("does not create MeasurementEntry", () => {
  const result = createEngineerWorkspace(createWorkspaceInputFixture());

  assertWorkspaceSuccess(result, "expected workspace creation success");
  const serializedWorkspace = JSON.stringify(result.workspace).toLowerCase();

  assertEqual(
    serializedWorkspace.includes("measuremententry"),
    false,
    "unexpected MeasurementEntry concept",
  );
  assertEqual(
    serializedWorkspace.includes("measurement_entry"),
    false,
    "unexpected MeasurementEntry concept",
  );
});

function createWorkspaceInputFixture(
  overrides: Partial<CreateEngineerWorkspaceInput> = {},
): CreateEngineerWorkspaceInput {
  return {
    id: overrides.id ?? workspaceId,
    engineerId: overrides.engineerId ?? engineerId,
    engineerName: overrides.engineerName ?? engineerName,
    organizationId: overrides.organizationId ?? organizationId,
    project: overrides.project === undefined ? createProjectFixture() : overrides.project,
    period: overrides.period === undefined ? createPeriodFixture() : overrides.period,
    workPackages:
      overrides.workPackages === undefined
        ? createWorkPackagesFixture()
        : overrides.workPackages,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? {
      source: "engineer-workspace",
    },
  };
}

function createProjectFixture(): EngineerWorkspaceProject {
  return {
    projectId,
    projectCode: "LDA-2026",
    projectName: "Barragem Lagoa do Arroz",
    contractId,
    clientName: "Departamento Nacional de Obras",
    status: "Executing",
    location: "Lagoa do Arroz Dam Site",
    metadata: {
      source: "project-management",
    },
  };
}

function createPeriodFixture(): EngineerWorkspacePeriod {
  return {
    measurementPeriodId,
    periodNumber: 8,
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    status: "Open",
    metadata: {
      source: "measurement-period",
    },
  };
}

function createWorkPackagesFixture(): ReadonlyArray<EngineerWorkspaceWorkPackage> {
  return [
    createWorkPackageFixture("work-package-drainage", "03", "Drenagem", 3, [
      createServiceItemFixture("service-item-drainage", "03.01.01", "Active", 42),
    ]),
    createWorkPackageFixture("work-package-foundation", "01", "Fundacao", 1, [
      createServiceItemFixture("service-item-foundation-b", "01.01.02", "Completed", 0),
      createServiceItemFixture("service-item-foundation-a", "01.01.01", "Active", 100),
    ]),
    createWorkPackageFixture("work-package-earthworks", "02", "Terraplenagem", 2, [
      createServiceItemFixture("service-item-earthworks-b", "02.02.01", "Suspended", 0),
      createServiceItemFixture("service-item-earthworks-a", "02.01.01", "Active", 25),
    ]),
  ];
}

function createWorkPackageFixture(
  workPackageId: string,
  code: string,
  name: string,
  sequence: number,
  serviceItems: ReadonlyArray<EngineerWorkspaceServiceItem>,
): EngineerWorkspaceWorkPackage {
  return {
    workPackageId,
    code,
    name,
    type: "execution_front",
    sequence,
    serviceItems,
    metadata: {
      source: "work-package-management",
    },
  };
}

function createServiceItemFixture(
  serviceItemId: string,
  code: string,
  status: string,
  remainingQuantity: number,
): EngineerWorkspaceServiceItem {
  return {
    serviceItemId,
    code,
    description: `Service item ${code}`,
    unit: "M3",
    contractQuantity: 100,
    accumulatedQuantity: 100 - remainingQuantity,
    remainingQuantity,
    measurementType: "quantity",
    status,
    metadata: {
      source: "service-item-management",
    },
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

function assertWorkspaceSuccess(
  result: EngineerWorkspaceResult,
  message: string,
): asserts result is Extract<EngineerWorkspaceResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertWorkspaceFailure(
  result: EngineerWorkspaceResult,
  message: string,
): asserts result is Extract<EngineerWorkspaceResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
