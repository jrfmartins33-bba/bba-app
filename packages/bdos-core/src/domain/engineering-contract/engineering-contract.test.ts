import {
  EngineeringContractStatus,
  advanceEngineeringContractStatus,
  createEngineeringContract,
  type CreateEngineeringContractInput,
  type EngineeringContract,
  type EngineeringContractResult,
} from "./index";

const contractId = "contract-lagoa-do-arroz-001";
const publicOwner = "DEPARTAMENTO NACIONAL DE OBRAS CONTRA AS SECAS - DNOCS";
const contractNumber = "22/2025";
const administrativeProcess = "23/2025/DI";
const actor = "engineer-marcos";
const occurredAt = "2026-06-15T10:30:00Z";
const correlationId = "engineering-contract-correlation-001";
const createdBy = "field-office";
const sourceSystem = "engineering-os";

runTest("valid creation", () => {
  const result = createEngineeringContract(createContractInputFixture());

  assertSuccess(result, "expected contract creation success");
  assertEqual(result.contract.id, contractId, "id mismatch");
  assertEqual(result.contract.publicOwner, publicOwner, "publicOwner mismatch");
  assertEqual(result.contract.contractNumber, contractNumber, "contractNumber mismatch");
  assertEqual(
    result.contract.administrativeProcess,
    administrativeProcess,
    "administrativeProcess mismatch",
  );
  assertEqual(
    result.contract.status,
    EngineeringContractStatus.Draft,
    "initial status mismatch",
  );
  assertEqual(result.contract.contractor, "Consorcio Conjasf-Hidromec", "contractor mismatch");
  assertEqual(result.contract.consortium, "Conjasf-Hidromec", "consortium mismatch");
  assertEqual(result.contract.city, "Cajazeiras", "city mismatch");
  assertEqual(result.contract.state, "PB", "state mismatch");
});

runTest("rejects missing id", () => {
  const result = createEngineeringContract(createContractInputFixture({ id: "" }));

  assertFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejects missing public owner (orgao)", () => {
  const result = createEngineeringContract(createContractInputFixture({ publicOwner: "" }));

  assertFailure(result, "expected missing public owner failure");
  assertEqual(result.errors[0]?.code, "missing_public_owner", "error code mismatch");
});

runTest("rejects missing contract number", () => {
  const result = createEngineeringContract(
    createContractInputFixture({ contractNumber: "" }),
  );

  assertFailure(result, "expected missing contract number failure");
  assertEqual(result.errors[0]?.code, "missing_contract_number", "error code mismatch");
});

runTest("rejects missing administrative process", () => {
  const result = createEngineeringContract(
    createContractInputFixture({ administrativeProcess: "" }),
  );

  assertFailure(result, "expected missing administrative process failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_administrative_process",
    "error code mismatch",
  );
});

runTest("rejects missing object description", () => {
  const result = createEngineeringContract(
    createContractInputFixture({ objectDescription: "" }),
  );

  assertFailure(result, "expected missing object description failure");
  assertEqual(result.errors[0]?.code, "missing_object_description", "error code mismatch");
});

runTest("rejects missing city", () => {
  const result = createEngineeringContract(createContractInputFixture({ city: "" }));

  assertFailure(result, "expected missing city failure");
  assertEqual(result.errors[0]?.code, "missing_city", "error code mismatch");
});

runTest("rejects missing state", () => {
  const result = createEngineeringContract(createContractInputFixture({ state: "" }));

  assertFailure(result, "expected missing state failure");
  assertEqual(result.errors[0]?.code, "missing_state", "error code mismatch");
});

runTest("rejects negative contract value", () => {
  const result = createEngineeringContract(
    createContractInputFixture({ contractValue: -1 }),
  );

  assertFailure(result, "expected negative contract value failure");
  assertEqual(result.errors[0]?.code, "negative_contract_value", "error code mismatch");
});

runTest("rejects duplicate contract id when existing ids are supplied", () => {
  const result = createEngineeringContract(createContractInputFixture(), [
    "some-other-id",
    contractId,
  ]);

  assertFailure(result, "expected duplicate contract id failure");
  assertEqual(result.errors[0]?.code, "duplicate_contract_id", "error code mismatch");
});

runTest("accepts an id not present in the supplied existing ids", () => {
  const result = createEngineeringContract(createContractInputFixture(), [
    "some-other-id",
    "another-id",
  ]);

  assertSuccess(result, "expected creation success when id is not a duplicate");
});

runTest("accepts creation when no existing ids are supplied (pure, no persistence)", () => {
  const result = createEngineeringContract(createContractInputFixture());

  assertSuccess(result, "expected creation success without duplicate checking context");
});

runTest("optional fields default to null when not provided", () => {
  // Deliberately bypasses createContractInputFixture(): that helper
  // re-applies its own defaults whenever an override key is `undefined`,
  // which would mask the real "omitted by the caller" scenario this test
  // exercises. Build the minimal input object directly instead.
  const minimalInput: CreateEngineeringContractInput = {
    id: contractId,
    publicOwner,
    contractNumber,
    administrativeProcess,
    objectDescription: "Minimal object description.",
    city: "Cajazeiras",
    state: "PB",
    actor,
    occurredAt,
    correlationId,
    createdBy,
    sourceSystem,
  };

  const result = createEngineeringContract(minimalInput);

  assertSuccess(result, "expected contract creation success");
  assertEqual(result.contract.administrativeProcessSEI, null, "administrativeProcessSEI should default to null");
  assertEqual(result.contract.commitmentNumber, null, "commitmentNumber should default to null");
  assertEqual(result.contract.serviceOrder, null, "serviceOrder should default to null");
  assertEqual(result.contract.contractor, null, "contractor should default to null");
  assertEqual(result.contract.consortium, null, "consortium should default to null");
  assertEqual(result.contract.projectName, null, "projectName should default to null");
  assertEqual(result.contract.contractValue, null, "contractValue should default to null");
  assertEqual(result.contract.fundingSource, null, "fundingSource should default to null");
});

runTest("timeline records only curated contractual milestones through the full lifecycle", () => {
  const created = createContractFixture();
  assertEqual(created.timeline.length, 1, "expected one timeline entry on creation");
  assertEqual(created.timeline[0]?.type, "contract_created", "timeline entry type mismatch");

  const signed = advanceEngineeringContractStatus({
    contract: created,
    toStatus: EngineeringContractStatus.Signed,
    actor,
    occurredAt,
  });
  assertSuccess(signed, "expected signing success");
  assertEqual(signed.contract.timeline.length, 2, "timeline should grow after signing");
  assertEqual(signed.contract.timeline[1]?.type, "contract_signed", "timeline entry type mismatch");

  const executed = advanceEngineeringContractStatus({
    contract: signed.contract,
    toStatus: EngineeringContractStatus.Executed,
    actor,
    occurredAt,
  });
  assertSuccess(executed, "expected execution start success");
  assertEqual(executed.contract.timeline.length, 3, "timeline should grow after execution starts");
  assertEqual(
    executed.contract.timeline[2]?.type,
    "execution_started",
    "timeline entry type mismatch",
  );

  const completed = advanceEngineeringContractStatus({
    contract: executed.contract,
    toStatus: EngineeringContractStatus.Completed,
    actor,
    occurredAt,
  });
  assertSuccess(completed, "expected completion success");
  assertEqual(completed.contract.timeline.length, 4, "timeline should grow after completion");
  assertEqual(
    completed.contract.timeline[3]?.type,
    "contract_completed",
    "timeline entry type mismatch",
  );
});

runTest("trace records every technical action, growing in lockstep with mutations", () => {
  const created = createContractFixture();
  assertEqual(created.trace.length, 1, "expected one trace entry on creation");
  assertEqual(created.trace[0]?.action, "contract_created", "trace action mismatch");
  assertEqual(created.trace[0]?.actor, actor, "trace actor mismatch");
  assertEqual(created.trace[0]?.occurredAt, occurredAt, "trace occurredAt mismatch");

  const signed = advanceEngineeringContractStatus({
    contract: created,
    toStatus: EngineeringContractStatus.Signed,
    actor: "quality-office",
    occurredAt,
  });
  assertSuccess(signed, "expected signing success");
  assertEqual(signed.contract.trace.length, 2, "trace should grow after signing");
  assertEqual(
    signed.contract.trace[1]?.action,
    "contract_status_advanced",
    "trace action mismatch",
  );
  assertEqual(signed.contract.trace[1]?.actor, "quality-office", "trace actor mismatch");
});

runTest("all valid status transitions succeed", () => {
  const validTransitions: ReadonlyArray<
    readonly [EngineeringContractStatus, EngineeringContractStatus]
  > = [
    [EngineeringContractStatus.Draft, EngineeringContractStatus.Signed],
    [EngineeringContractStatus.Draft, EngineeringContractStatus.Cancelled],
    [EngineeringContractStatus.Signed, EngineeringContractStatus.Executed],
    [EngineeringContractStatus.Signed, EngineeringContractStatus.Cancelled],
    [EngineeringContractStatus.Executed, EngineeringContractStatus.Completed],
    [EngineeringContractStatus.Executed, EngineeringContractStatus.Cancelled],
  ];

  validTransitions.forEach(([fromStatus, toStatus]) => {
    const contract: EngineeringContract = { ...createContractFixture(), status: fromStatus };
    const result = advanceEngineeringContractStatus({ contract, toStatus, actor, occurredAt });

    assertSuccess(result, `expected ${fromStatus} to ${toStatus} success`);
    assertEqual(result.contract.status, toStatus, "transition status mismatch");
  });
});

runTest("rejects invalid status transitions", () => {
  const contract = createContractFixture();
  const result = advanceEngineeringContractStatus({
    contract,
    toStatus: EngineeringContractStatus.Completed,
    actor,
    occurredAt,
  });

  assertFailure(result, "expected invalid transition failure (Draft -> Completed)");
  assertEqual(
    result.errors[0]?.code,
    "invalid_contract_status_transition",
    "error code mismatch",
  );
});

runTest("blocks mutation on terminal statuses (Completed, Cancelled)", () => {
  const completed: EngineeringContract = {
    ...createContractFixture(),
    status: EngineeringContractStatus.Completed,
  };
  const cancelled: EngineeringContract = {
    ...createContractFixture(),
    status: EngineeringContractStatus.Cancelled,
  };

  const afterCompleted = advanceEngineeringContractStatus({
    contract: completed,
    toStatus: EngineeringContractStatus.Cancelled,
    actor,
    occurredAt,
  });
  assertFailure(afterCompleted, "expected terminal block after Completed");
  assertEqual(afterCompleted.errors[0]?.code, "contract_terminal", "error code mismatch");

  const afterCancelled = advanceEngineeringContractStatus({
    contract: cancelled,
    toStatus: EngineeringContractStatus.Signed,
    actor,
    occurredAt,
  });
  assertFailure(afterCancelled, "expected terminal block after Cancelled");
  assertEqual(afterCancelled.errors[0]?.code, "contract_terminal", "error code mismatch");
});

runTest("immutable output", () => {
  const result = createEngineeringContract(createContractInputFixture());

  assertSuccess(result, "expected contract creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.contract), true, "contract should be frozen");
  assertEqual(Object.isFrozen(result.contract.timeline), true, "timeline should be frozen");
  assertEqual(
    Object.isFrozen(result.contract.timeline[0]),
    true,
    "timeline entry should be frozen",
  );
  assertEqual(Object.isFrozen(result.contract.trace), true, "trace should be frozen");
  assertEqual(Object.isFrozen(result.contract.trace[0]), true, "trace entry should be frozen");
  assertEqual(Object.isFrozen(result.contract.metadata), true, "metadata should be frozen");
});

runTest("deterministic output for identical input", () => {
  const input = createContractInputFixture();
  const first = JSON.stringify(createEngineeringContract(input));
  const second = JSON.stringify(createEngineeringContract(input));

  assertEqual(first, second, "expected deterministic contract creation output");
});

runTest("deterministic output across status transitions", () => {
  const buildSignedContract = () => {
    const created = createContractFixture();
    const signed = advanceEngineeringContractStatus({
      contract: created,
      toStatus: EngineeringContractStatus.Signed,
      actor,
      occurredAt,
    });
    assertSuccess(signed, "expected signing success");
    return signed;
  };

  const first = JSON.stringify(buildSignedContract());
  const second = JSON.stringify(buildSignedContract());
  assertEqual(first, second, "expected deterministic status transition output");
});

runTest("preserves traceability (correlationId/createdBy/sourceSystem in metadata)", () => {
  const result = createEngineeringContract(createContractInputFixture());

  assertSuccess(result, "expected contract creation success");
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
});

function createContractFixture(): EngineeringContract {
  const result = createEngineeringContract(createContractInputFixture());
  assertSuccess(result, "expected contract fixture creation");
  return result.contract;
}

function createContractInputFixture(
  overrides: Partial<CreateEngineeringContractInput> = {},
): CreateEngineeringContractInput {
  return {
    id: overrides.id ?? contractId,
    publicOwner: overrides.publicOwner ?? publicOwner,
    contractNumber: overrides.contractNumber ?? contractNumber,
    administrativeProcess: overrides.administrativeProcess ?? administrativeProcess,
    administrativeProcessSEI:
      overrides.administrativeProcessSEI === undefined
        ? "SEI-23/2025/DI"
        : overrides.administrativeProcessSEI,
    commitmentNumber:
      overrides.commitmentNumber === undefined ? "EMP-2026-0451" : overrides.commitmentNumber,
    serviceOrder: overrides.serviceOrder === undefined ? "OS-23/2025/DI" : overrides.serviceOrder,
    contractor:
      overrides.contractor === undefined
        ? "Consorcio Conjasf-Hidromec"
        : overrides.contractor,
    consortium:
      overrides.consortium === undefined ? "Conjasf-Hidromec" : overrides.consortium,
    projectName:
      overrides.projectName === undefined
        ? "Recuperacao e Modernizacao da Barragem Lagoa do Arroz"
        : overrides.projectName,
    objectDescription:
      overrides.objectDescription ??
      "Recuperacao e modernizacao da barragem Lagoa do Arroz no municipio de Cajazeiras, no estado da Paraiba.",
    city: overrides.city ?? "Cajazeiras",
    state: overrides.state ?? "PB",
    contractValue: overrides.contractValue === undefined ? 12500000 : overrides.contractValue,
    fundingSource:
      overrides.fundingSource === undefined
        ? "Caixa Economica Federal"
        : overrides.fundingSource,
    actor: overrides.actor ?? actor,
    occurredAt: overrides.occurredAt ?? occurredAt,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? { source: "engineering-contract" },
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
  result: EngineeringContractResult,
  message: string,
): asserts result is Extract<EngineeringContractResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertFailure(
  result: EngineeringContractResult,
  message: string,
): asserts result is Extract<EngineeringContractResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
