import {
  ProjectStatus,
  advanceProjectStatus,
  createProject,
  type CreateProjectInput,
  type Project,
  type ProjectManagementResult,
} from "./index";

const projectId = "project-lagoa-do-arroz";
const projectCode = "LDA-2026";
const projectName = "Barragem Lagoa do Arroz";
const organizationId = "organization-alpha-engenharia";
const contractId = "contract-lagoa-do-arroz-001";
const projectManagerId = "manager-mariana";
const projectManagerName = "Mariana Duarte";
const correlationId = "project-management-correlation-001";
const createdBy = "project-office";
const sourceSystem = "engineering-os";

const validTransitions: ReadonlyArray<readonly [ProjectStatus, ProjectStatus]> = [
  [ProjectStatus.Draft, ProjectStatus.Planning],
  [ProjectStatus.Planning, ProjectStatus.Executing],
  [ProjectStatus.Executing, ProjectStatus.Suspended],
  [ProjectStatus.Suspended, ProjectStatus.Executing],
  [ProjectStatus.Executing, ProjectStatus.Completed],
  [ProjectStatus.Executing, ProjectStatus.Cancelled],
  [ProjectStatus.Planning, ProjectStatus.Cancelled],
  [ProjectStatus.Draft, ProjectStatus.Cancelled],
];

runTest("valid creation", () => {
  const result = createProject(createProjectInputFixture());

  assertProjectSuccess(result, "expected project creation success");
  assertEqual(result.project.id, projectId, "project id mismatch");
  assertEqual(result.project.projectCode, projectCode, "project code mismatch");
  assertEqual(result.project.projectName, projectName, "project name mismatch");
  assertEqual(result.project.organizationId, organizationId, "organization mismatch");
  assertEqual(result.project.contractId, contractId, "contract id mismatch");
  assertEqual(result.project.clientName, "Departamento Nacional de Obras", "client mismatch");
  assertEqual(result.project.location, "Lagoa do Arroz Dam Site", "location mismatch");
  assertEqual(result.project.city, "Cajazeiras", "city mismatch");
  assertEqual(result.project.state, "PB", "state mismatch");
  assertEqual(result.project.country, "Brazil", "country mismatch");
  assertEqual(result.project.latitude, -6.8902, "latitude mismatch");
  assertEqual(result.project.longitude, -38.5557, "longitude mismatch");
  assertEqual(
    result.project.projectManagerId,
    projectManagerId,
    "project manager id mismatch",
  );
  assertEqual(
    result.project.projectManagerName,
    projectManagerName,
    "project manager name mismatch",
  );
  assertEqual(result.project.inspectionAgency, "Fiscalizacao DNOCS", "agency mismatch");
  assertEqual(
    result.project.supervisingEngineer,
    "Eng. Roberto Almeida",
    "supervising engineer mismatch",
  );
  assertEqual(result.project.startDate, "2026-01-10", "start date mismatch");
  assertEqual(
    result.project.expectedEndDate,
    "2026-12-20",
    "expected end date mismatch",
  );
});

runTest("rejects missing project code", () => {
  const result = createProject(createProjectInputFixture({ projectCode: "" }));

  assertProjectFailure(result, "expected missing project code failure");
  assertEqual(result.errors[0]?.code, "missing_project_code", "error code mismatch");
});

runTest("rejects missing project name", () => {
  const result = createProject(createProjectInputFixture({ projectName: "" }));

  assertProjectFailure(result, "expected missing project name failure");
  assertEqual(result.errors[0]?.code, "missing_project_name", "error code mismatch");
});

runTest("rejects missing organization", () => {
  const result = createProject(createProjectInputFixture({ organizationId: "" }));

  assertProjectFailure(result, "expected missing organization failure");
  assertEqual(result.errors[0]?.code, "missing_organization_id", "error code mismatch");
});

runTest("rejects missing contract", () => {
  const result = createProject(createProjectInputFixture({ contractId: "" }));

  assertProjectFailure(result, "expected missing contract failure");
  assertEqual(result.errors[0]?.code, "missing_contract_id", "error code mismatch");
});

runTest("rejects missing city", () => {
  const result = createProject(
    createProjectInputFixture({
      location: {
        ...createLocationFixture(),
        city: "",
      },
    }),
  );

  assertProjectFailure(result, "expected missing city failure");
  assertEqual(result.errors[0]?.code, "missing_city", "error code mismatch");
});

runTest("rejects missing state", () => {
  const result = createProject(
    createProjectInputFixture({
      location: {
        ...createLocationFixture(),
        state: "",
      },
    }),
  );

  assertProjectFailure(result, "expected missing state failure");
  assertEqual(result.errors[0]?.code, "missing_state", "error code mismatch");
});

runTest("rejects missing country", () => {
  const result = createProject(
    createProjectInputFixture({
      location: {
        ...createLocationFixture(),
        country: "",
      },
    }),
  );

  assertProjectFailure(result, "expected missing country failure");
  assertEqual(result.errors[0]?.code, "missing_country", "error code mismatch");
});

runTest("rejects invalid dates", () => {
  const result = createProject(
    createProjectInputFixture({
      period: {
        startDate: "2026-12-20",
        expectedEndDate: "2026-01-10",
      },
    }),
  );

  assertProjectFailure(result, "expected invalid dates failure");
  assertEqual(result.errors[0]?.code, "invalid_project_period", "error code mismatch");
});

runTest("rejects missing start date", () => {
  const result = createProject(
    createProjectInputFixture({
      period: {
        startDate: "",
        expectedEndDate: "2026-12-20",
      },
    }),
  );

  assertProjectFailure(result, "expected missing start date failure");
  assertEqual(result.errors[0]?.code, "missing_start_date", "error code mismatch");
});

runTest("rejects missing expected end date", () => {
  const result = createProject(
    createProjectInputFixture({
      period: {
        startDate: "2026-01-10",
        expectedEndDate: "",
      },
    }),
  );

  assertProjectFailure(result, "expected missing expected end date failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_expected_end_date",
    "error code mismatch",
  );
});

runTest("rejects missing project manager", () => {
  const result = createProject(
    createProjectInputFixture({
      projectManagerId: "",
      projectManagerName: "",
    }),
  );

  assertProjectFailure(result, "expected missing project manager failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_project_manager",
    "error code mismatch",
  );
});

runTest("rejects missing client", () => {
  const result = createProject(
    createProjectInputFixture({
      owner: {
        clientName: "",
        metadata: {},
      },
    }),
  );

  assertProjectFailure(result, "expected missing client failure");
  assertEqual(result.errors[0]?.code, "missing_client", "error code mismatch");
});

runTest("initial status is Draft", () => {
  const result = createProject(createProjectInputFixture());

  assertProjectSuccess(result, "expected project creation success");
  assertEqual(result.project.status, ProjectStatus.Draft, "initial status mismatch");
});

runTest("all valid status transitions", () => {
  validTransitions.forEach(([fromStatus, toStatus]) => {
    const result = advanceProjectStatus({
      project: createProjectFixture(fromStatus),
      toStatus,
      metadata: {
        actor: "project-office",
      },
    });

    assertProjectSuccess(result, `expected ${fromStatus} to ${toStatus} success`);
    assertEqual(result.project.status, toStatus, "transition status mismatch");
    assertEqual(
      result.project.metadata["fromStatus"],
      fromStatus,
      "from status metadata mismatch",
    );
    assertEqual(
      result.project.metadata["toStatus"],
      toStatus,
      "to status metadata mismatch",
    );
  });
});

runTest("all invalid status transitions return structured errors", () => {
  const statuses = [
    ProjectStatus.Draft,
    ProjectStatus.Planning,
    ProjectStatus.Executing,
    ProjectStatus.Suspended,
    ProjectStatus.Completed,
    ProjectStatus.Cancelled,
  ];
  let invalidTransitionCount = 0;

  statuses.forEach((fromStatus) => {
    statuses.forEach((toStatus) => {
      if (isValidTransition(fromStatus, toStatus)) {
        return;
      }

      invalidTransitionCount += 1;
      const result = advanceProjectStatus({
        project: createProjectFixture(fromStatus),
        toStatus,
      });

      assertProjectFailure(result, `expected ${fromStatus} to ${toStatus} failure`);
      assertEqual(
        result.errors[0]?.code,
        "invalid_project_transition",
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

  assertEqual(invalidTransitionCount, 28, "invalid transition count mismatch");
});

runTest("immutable output", () => {
  const result = createProject(createProjectInputFixture());

  assertProjectSuccess(result, "expected project creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.project), true, "project should be frozen");
  assertEqual(
    Object.isFrozen(result.project.metadata),
    true,
    "metadata should be frozen",
  );
  assertEqual(Object.isFrozen(result.errors), true, "errors should be frozen");
  assertEqual(Object.isFrozen(result.warnings), true, "warnings should be frozen");
});

runTest("deterministic output", () => {
  const input = createProjectInputFixture();
  const first = JSON.stringify(createProject(input));
  const second = JSON.stringify(createProject(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("preserves traceability", () => {
  const result = createProject(createProjectInputFixture());

  assertProjectSuccess(result, "expected project creation success");
  assertEqual(
    result.project.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
  assertEqual(result.project.metadata["createdBy"], createdBy, "created by mismatch");
  assertEqual(
    result.project.metadata["sourceSystem"],
    sourceSystem,
    "source system mismatch",
  );
  assertEqual(result.project.metadata["projectId"], projectId, "project id mismatch");
  assertEqual(
    result.project.metadata["organizationId"],
    organizationId,
    "organization id mismatch",
  );
  assertEqual(result.project.metadata["contractId"], contractId, "contract id mismatch");
});

runTest("preserves metadata", () => {
  const result = createProject(
    createProjectInputFixture({
      metadata: {
        futureWorkPackagesIntegration: "prepared",
        futureMeasurementIntegration: "prepared",
        futureCurveSIntegration: "prepared",
      },
    }),
  );

  assertProjectSuccess(result, "expected project creation success");
  assertEqual(
    result.project.metadata["futureWorkPackagesIntegration"],
    "prepared",
    "work packages metadata mismatch",
  );
  assertEqual(
    result.project.metadata["futureMeasurementIntegration"],
    "prepared",
    "measurement metadata mismatch",
  );
  assertEqual(
    result.project.metadata["futureCurveSIntegration"],
    "prepared",
    "curve s metadata mismatch",
  );
});

function createProjectFixture(
  status: ProjectStatus = ProjectStatus.Draft,
): Project {
  const result = createProject(createProjectInputFixture({ status }));

  assertProjectSuccess(result, "expected project fixture creation");

  return result.project;
}

function createProjectInputFixture(
  overrides: Partial<CreateProjectInput> = {},
): CreateProjectInput {
  return {
    id: overrides.id ?? projectId,
    projectCode: overrides.projectCode ?? projectCode,
    projectName: overrides.projectName ?? projectName,
    organizationId: overrides.organizationId ?? organizationId,
    contractId: overrides.contractId ?? contractId,
    owner: overrides.owner ?? {
      clientName: "Departamento Nacional de Obras",
      metadata: {
        type: "public-client",
      },
    },
    location: overrides.location ?? createLocationFixture(),
    projectManagerId: overrides.projectManagerId ?? projectManagerId,
    projectManagerName: overrides.projectManagerName ?? projectManagerName,
    inspectionAgency: overrides.inspectionAgency ?? "Fiscalizacao DNOCS",
    supervisingEngineer:
      overrides.supervisingEngineer ?? "Eng. Roberto Almeida",
    period: overrides.period ?? {
      startDate: "2026-01-10",
      expectedEndDate: "2026-12-20",
    },
    status: overrides.status,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? {
      source: "project-management",
    },
  };
}

function createLocationFixture(): CreateProjectInput["location"] {
  return {
    location: "Lagoa do Arroz Dam Site",
    city: "Cajazeiras",
    state: "PB",
    country: "Brazil",
    latitude: -6.8902,
    longitude: -38.5557,
    metadata: {
      region: "Northeast",
    },
  };
}

function isValidTransition(
  fromStatus: ProjectStatus,
  toStatus: ProjectStatus,
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

function assertProjectSuccess(
  result: ProjectManagementResult,
  message: string,
): asserts result is Extract<ProjectManagementResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertProjectFailure(
  result: ProjectManagementResult,
  message: string,
): asserts result is Extract<ProjectManagementResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
