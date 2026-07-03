import {
  ContractStatus,
  advanceContractStatus,
  createContract,
  type Contract,
  type ContractManagementResult,
  type CreateContractInput,
} from "./index";

const contractId = "contract-lagoa-do-arroz-001";
const contractNumber = "086/2026";
const contractName = "Barragem Lagoa do Arroz";
const projectId = "project-lagoa-do-arroz";
const organizationId = "organization-alpha-engenharia";
const processNumber = "process-2026-0008";
const seiReference = "sei-1234567";
const workOrderNumber = "os-2026-08";
const correlationId = "contract-management-correlation-001";
const createdBy = "admin-contracts";
const sourceSystem = "engineering-os";

const validTransitions: ReadonlyArray<
  readonly [ContractStatus, ContractStatus]
> = [
  [ContractStatus.Draft, ContractStatus.Active],
  [ContractStatus.Active, ContractStatus.Suspended],
  [ContractStatus.Suspended, ContractStatus.Active],
  [ContractStatus.Active, ContractStatus.Finished],
  [ContractStatus.Active, ContractStatus.Cancelled],
  [ContractStatus.Draft, ContractStatus.Cancelled],
];

runTest("valid creation", () => {
  const result = createContract(createContractInputFixture());

  assertContractSuccess(result, "expected contract creation success");
  assertEqual(result.contract.id, contractId, "contract id mismatch");
  assertEqual(result.contract.contractNumber, contractNumber, "contract number mismatch");
  assertEqual(result.contract.contractName, contractName, "contract name mismatch");
  assertEqual(result.contract.clientName, "Departamento Nacional de Obras", "client mismatch");
  assertEqual(result.contract.contractorName, "Alpha Engenharia Ltda.", "contractor mismatch");
  assertEqual(result.contract.contractValue.amount, 12500000, "contract value mismatch");
  assertEqual(result.contract.currency, "BRL", "currency mismatch");
  assertEqual(result.contract.projectId, projectId, "project id mismatch");
  assertEqual(result.contract.organizationId, organizationId, "organization mismatch");
  assertEqual(result.contract.processNumber, processNumber, "process number mismatch");
  assertEqual(result.contract.seiReference, seiReference, "sei reference mismatch");
  assertEqual(result.contract.workOrderNumber, workOrderNumber, "work order mismatch");
  assertEqual(result.contract.startDate, "2026-01-10", "start date mismatch");
  assertEqual(
    result.contract.expectedEndDate,
    "2026-12-20",
    "expected end date mismatch",
  );
});

runTest("rejects zero contract value", () => {
  const result = createContract(
    createContractInputFixture({
      contractValue: {
        amount: 0,
        currency: "BRL",
      },
    }),
  );

  assertContractFailure(result, "expected zero value failure");
  assertEqual(result.errors[0]?.code, "invalid_contract_value", "error code mismatch");
});

runTest("rejects negative contract value", () => {
  const result = createContract(
    createContractInputFixture({
      contractValue: {
        amount: -1,
        currency: "BRL",
      },
    }),
  );

  assertContractFailure(result, "expected negative value failure");
  assertEqual(result.errors[0]?.code, "invalid_contract_value", "error code mismatch");
});

runTest("rejects invalid dates", () => {
  const result = createContract(
    createContractInputFixture({
      period: {
        startDate: "2026-12-20",
        expectedEndDate: "2026-01-10",
      },
    }),
  );

  assertContractFailure(result, "expected invalid date failure");
  assertEqual(result.errors[0]?.code, "invalid_contract_period", "error code mismatch");
});

runTest("rejects missing start date", () => {
  const result = createContract(
    createContractInputFixture({
      period: {
        startDate: "",
        expectedEndDate: "2026-12-20",
      },
    }),
  );

  assertContractFailure(result, "expected missing start date failure");
  assertEqual(result.errors[0]?.code, "missing_start_date", "error code mismatch");
});

runTest("rejects missing expected end date", () => {
  const result = createContract(
    createContractInputFixture({
      period: {
        startDate: "2026-01-10",
        expectedEndDate: "",
      },
    }),
  );

  assertContractFailure(result, "expected missing expected end date failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_expected_end_date",
    "error code mismatch",
  );
});

runTest("rejects missing client", () => {
  const result = createContract(
    createContractInputFixture({
      client: {
        name: "",
        metadata: {},
      },
    }),
  );

  assertContractFailure(result, "expected missing client failure");
  assertEqual(result.errors[0]?.code, "missing_client", "error code mismatch");
});

runTest("rejects missing contractor", () => {
  const result = createContract(
    createContractInputFixture({
      contractor: {
        name: "",
        metadata: {},
      },
    }),
  );

  assertContractFailure(result, "expected missing contractor failure");
  assertEqual(result.errors[0]?.code, "missing_contractor", "error code mismatch");
});

runTest("rejects missing contract number", () => {
  const result = createContract(
    createContractInputFixture({
      contractNumber: "",
    }),
  );

  assertContractFailure(result, "expected missing contract number failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_contract_number",
    "error code mismatch",
  );
});

runTest("rejects missing contract name", () => {
  const result = createContract(
    createContractInputFixture({
      contractName: "",
    }),
  );

  assertContractFailure(result, "expected missing contract name failure");
  assertEqual(result.errors[0]?.code, "missing_contract_name", "error code mismatch");
});

runTest("rejects missing project id", () => {
  const result = createContract(
    createContractInputFixture({
      projectId: "",
    }),
  );

  assertContractFailure(result, "expected missing project id failure");
  assertEqual(result.errors[0]?.code, "missing_project_id", "error code mismatch");
});

runTest("rejects missing organization id", () => {
  const result = createContract(
    createContractInputFixture({
      organizationId: "",
    }),
  );

  assertContractFailure(result, "expected missing organization id failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_organization_id",
    "error code mismatch",
  );
});

runTest("initial status is Draft", () => {
  const result = createContract(createContractInputFixture());

  assertContractSuccess(result, "expected contract creation success");
  assertEqual(result.contract.status, ContractStatus.Draft, "initial status mismatch");
});

runTest("valid status transitions", () => {
  validTransitions.forEach(([fromStatus, toStatus]) => {
    const result = advanceContractStatus({
      contract: createContractFixture(fromStatus),
      toStatus,
      metadata: {
        actor: "contract-board",
      },
    });

    assertContractSuccess(result, `expected ${fromStatus} to ${toStatus} success`);
    assertEqual(result.contract.status, toStatus, "transition status mismatch");
    assertEqual(
      result.contract.metadata["fromStatus"],
      fromStatus,
      "from status metadata mismatch",
    );
    assertEqual(
      result.contract.metadata["toStatus"],
      toStatus,
      "to status metadata mismatch",
    );
  });
});

runTest("all invalid status transitions return structured errors", () => {
  const statuses = [
    ContractStatus.Draft,
    ContractStatus.Active,
    ContractStatus.Suspended,
    ContractStatus.Finished,
    ContractStatus.Cancelled,
  ];
  let invalidTransitionCount = 0;

  statuses.forEach((fromStatus) => {
    statuses.forEach((toStatus) => {
      if (isValidTransition(fromStatus, toStatus)) {
        return;
      }

      invalidTransitionCount += 1;
      const result = advanceContractStatus({
        contract: createContractFixture(fromStatus),
        toStatus,
      });

      assertContractFailure(result, `expected ${fromStatus} to ${toStatus} failure`);
      assertEqual(
        result.errors[0]?.code,
        "invalid_contract_transition",
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

runTest("deterministic output", () => {
  const input = createContractInputFixture();
  const first = JSON.stringify(createContract(input));
  const second = JSON.stringify(createContract(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("immutable output", () => {
  const result = createContract(createContractInputFixture());

  assertContractSuccess(result, "expected contract creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.contract), true, "contract should be frozen");
  assertEqual(
    Object.isFrozen(result.contract.contractValue),
    true,
    "contract value should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.contract.metadata),
    true,
    "metadata should be frozen",
  );
  assertEqual(Object.isFrozen(result.errors), true, "errors should be frozen");
  assertEqual(Object.isFrozen(result.warnings), true, "warnings should be frozen");
});

runTest("preserves traceability", () => {
  const result = createContract(createContractInputFixture());

  assertContractSuccess(result, "expected contract creation success");
  assertEqual(
    result.contract.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
  assertEqual(result.contract.metadata["createdBy"], createdBy, "created by mismatch");
  assertEqual(
    result.contract.metadata["sourceSystem"],
    sourceSystem,
    "source system mismatch",
  );
  assertEqual(result.contract.metadata["contractId"], contractId, "contract id mismatch");
  assertEqual(result.contract.metadata["projectId"], projectId, "project id mismatch");
  assertEqual(
    result.contract.metadata["organizationId"],
    organizationId,
    "organization id mismatch",
  );
});

runTest("preserves metadata", () => {
  const result = createContract(
    createContractInputFixture({
      metadata: {
        businessUnit: "heavy-civil",
        sourceDocument: "contract-register",
      },
    }),
  );

  assertContractSuccess(result, "expected contract creation success");
  assertEqual(
    result.contract.metadata["businessUnit"],
    "heavy-civil",
    "business unit mismatch",
  );
  assertEqual(
    result.contract.metadata["sourceDocument"],
    "contract-register",
    "source document mismatch",
  );
});

function createContractFixture(
  status: ContractStatus = ContractStatus.Draft,
): Contract {
  const result = createContract(createContractInputFixture({ status }));

  assertContractSuccess(result, "expected contract fixture creation");

  return result.contract;
}

function createContractInputFixture(
  overrides: Partial<CreateContractInput> = {},
): CreateContractInput {
  return {
    id: overrides.id ?? contractId,
    contractNumber: overrides.contractNumber ?? contractNumber,
    contractName: overrides.contractName ?? contractName,
    client: overrides.client ?? {
      name: "Departamento Nacional de Obras",
      metadata: {
        type: "public-client",
      },
    },
    contractor: overrides.contractor ?? {
      name: "Alpha Engenharia Ltda.",
      metadata: {
        type: "contractor",
      },
    },
    contractValue: overrides.contractValue ?? {
      amount: 12500000,
      currency: "BRL",
    },
    projectId: overrides.projectId ?? projectId,
    organizationId: overrides.organizationId ?? organizationId,
    processNumber: overrides.processNumber ?? processNumber,
    seiReference: overrides.seiReference ?? seiReference,
    workOrderNumber: overrides.workOrderNumber ?? workOrderNumber,
    period: overrides.period ?? {
      startDate: "2026-01-10",
      expectedEndDate: "2026-12-20",
    },
    status: overrides.status,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? {
      source: "contract-management",
    },
  };
}

function isValidTransition(
  fromStatus: ContractStatus,
  toStatus: ContractStatus,
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

function assertContractSuccess(
  result: ContractManagementResult,
  message: string,
): asserts result is Extract<ContractManagementResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertContractFailure(
  result: ContractManagementResult,
  message: string,
): asserts result is Extract<ContractManagementResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
