import {
  EvidenceStatus,
  EvidenceType,
  advanceEvidenceStatus,
  createEvidenceRecord,
  type CreateEvidenceRecordInput,
  type EvidenceCenterResult,
  type EvidenceLink,
  type EvidenceRecord,
} from "./index";

const evidenceId = "evidence-field-photo-001";
const organizationId = "organization-alpha-engenharia";
const clientId = "client-dnocs";
const contractId = "contract-lagoa-do-arroz-001";
const projectId = "project-lagoa-do-arroz";
const workPackageId = "work-package-earthworks";
const serviceItemId = "service-item-excavation";
const measurementPeriodId = "measurement-period-8";
const measurementEntryId = "measurement-entry-42";
const measurementCycleId = "measurement-cycle-8";
const capturedById = "engineer-marcos";
const capturedByName = "Marcos Ferreira";
const correlationId = "evidence-center-correlation-001";
const createdBy = "field-office";
const sourceSystem = "engineering-os";

const validTransitions: ReadonlyArray<readonly [EvidenceStatus, EvidenceStatus]> = [
  [EvidenceStatus.Draft, EvidenceStatus.Attached],
  [EvidenceStatus.Attached, EvidenceStatus.Verified],
  [EvidenceStatus.Attached, EvidenceStatus.Rejected],
  [EvidenceStatus.Rejected, EvidenceStatus.Attached],
  [EvidenceStatus.Verified, EvidenceStatus.Cancelled],
  [EvidenceStatus.Draft, EvidenceStatus.Cancelled],
  [EvidenceStatus.Attached, EvidenceStatus.Cancelled],
];

runTest("valid creation", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture());

  assertEvidenceSuccess(result, "expected evidence creation success");
  assertEqual(result.evidence.id, evidenceId, "evidence id mismatch");
  assertEqual(result.evidence.organizationId, organizationId, "organization mismatch");
  assertEqual(result.evidence.contractId, contractId, "contract mismatch");
  assertEqual(result.evidence.projectId, projectId, "project mismatch");
  assertEqual(result.evidence.type, EvidenceType.Photo, "type mismatch");
  assertEqual(result.evidence.title, "Foto da frente de escavacao", "title mismatch");
  assertEqual(result.evidence.capturedAt, "2026-06-15T10:30:00Z", "capturedAt mismatch");
  assertEqual(result.evidence.capturedById, capturedById, "captured by id mismatch");
  assertEqual(result.evidence.capturedByName, capturedByName, "captured by name mismatch");
  assertEqual(result.evidence.location, "Lagoa do Arroz - eixo principal", "location mismatch");
  assertEqual(result.evidence.links.length, 1, "links count mismatch");
});

runTest("rejects missing id", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture({ id: "" }));

  assertEvidenceFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejects missing organizationId", () => {
  const result = createEvidenceRecord(
    createEvidenceInputFixture({ organizationId: "" }),
  );

  assertEvidenceFailure(result, "expected missing organization failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_organization_id",
    "error code mismatch",
  );
});

runTest("rejects missing contractId", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture({ contractId: "" }));

  assertEvidenceFailure(result, "expected missing contract failure");
  assertEqual(result.errors[0]?.code, "missing_contract_id", "error code mismatch");
});

runTest("rejects missing projectId", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture({ projectId: "" }));

  assertEvidenceFailure(result, "expected missing project failure");
  assertEqual(result.errors[0]?.code, "missing_project_id", "error code mismatch");
});

runTest("rejects missing type", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture({ type: null }));

  assertEvidenceFailure(result, "expected missing type failure");
  assertEqual(result.errors[0]?.code, "missing_type", "error code mismatch");
});

runTest("rejects missing title", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture({ title: "" }));

  assertEvidenceFailure(result, "expected missing title failure");
  assertEqual(result.errors[0]?.code, "missing_title", "error code mismatch");
});

runTest("rejects missing capturedAt", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture({ capturedAt: "" }));

  assertEvidenceFailure(result, "expected missing capturedAt failure");
  assertEqual(result.errors[0]?.code, "missing_captured_at", "error code mismatch");
});

runTest("rejects missing capturedBy", () => {
  const result = createEvidenceRecord(
    createEvidenceInputFixture({
      capturedById: "",
      capturedByName: "",
    }),
  );

  assertEvidenceFailure(result, "expected missing capturedBy failure");
  assertEqual(result.errors[0]?.code, "missing_captured_by", "error code mismatch");
});

runTest("rejects missing links", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture({ links: [] }));

  assertEvidenceFailure(result, "expected missing links failure");
  assertEqual(result.errors[0]?.code, "missing_links", "error code mismatch");
});

runTest("rejects link without id", () => {
  const result = createEvidenceRecord(
    createEvidenceInputFixture({
      links: [createEvidenceLinkFixture({ id: "" })],
    }),
  );

  assertEvidenceFailure(result, "expected missing link id failure");
  assertEqual(result.errors[0]?.code, "missing_link_id", "error code mismatch");
});

runTest("rejects link without label", () => {
  const result = createEvidenceRecord(
    createEvidenceInputFixture({
      links: [createEvidenceLinkFixture({ label: "" })],
    }),
  );

  assertEvidenceFailure(result, "expected missing link label failure");
  assertEqual(result.errors[0]?.code, "missing_link_label", "error code mismatch");
});

runTest("rejects link without uri", () => {
  const result = createEvidenceRecord(
    createEvidenceInputFixture({
      links: [createEvidenceLinkFixture({ uri: "" })],
    }),
  );

  assertEvidenceFailure(result, "expected missing link uri failure");
  assertEqual(result.errors[0]?.code, "missing_link_uri", "error code mismatch");
});

runTest("preserves clientId", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture());

  assertEvidenceSuccess(result, "expected evidence creation success");
  assertEqual(result.evidence.clientId, clientId, "client id mismatch");
});

runTest("preserves workPackageId", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture());

  assertEvidenceSuccess(result, "expected evidence creation success");
  assertEqual(result.evidence.workPackageId, workPackageId, "work package id mismatch");
});

runTest("preserves serviceItemId", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture());

  assertEvidenceSuccess(result, "expected evidence creation success");
  assertEqual(result.evidence.serviceItemId, serviceItemId, "service item id mismatch");
});

runTest("preserves measurementEntryId", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture());

  assertEvidenceSuccess(result, "expected evidence creation success");
  assertEqual(
    result.evidence.measurementEntryId,
    measurementEntryId,
    "measurement entry id mismatch",
  );
});

runTest("preserves measurementCycleId", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture());

  assertEvidenceSuccess(result, "expected evidence creation success");
  assertEqual(
    result.evidence.measurementCycleId,
    measurementCycleId,
    "measurement cycle id mismatch",
  );
});

runTest("allows optional references to be null", () => {
  const result = createEvidenceRecord(
    createEvidenceInputFixture({
      clientId: null,
      workPackageId: null,
      serviceItemId: null,
      measurementPeriodId: null,
      measurementEntryId: null,
      measurementCycleId: null,
    }),
  );

  assertEvidenceSuccess(result, "expected evidence creation success");
  assertEqual(result.evidence.clientId, null, "client should be null");
  assertEqual(result.evidence.workPackageId, null, "work package should be null");
  assertEqual(result.evidence.serviceItemId, null, "service item should be null");
  assertEqual(result.evidence.measurementPeriodId, null, "period should be null");
  assertEqual(result.evidence.measurementEntryId, null, "entry should be null");
  assertEqual(result.evidence.measurementCycleId, null, "cycle should be null");
});

runTest("initial status is Draft", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture());

  assertEvidenceSuccess(result, "expected evidence creation success");
  assertEqual(result.evidence.status, EvidenceStatus.Draft, "initial status mismatch");
});

runTest("all valid status transitions", () => {
  validTransitions.forEach(([fromStatus, toStatus]) => {
    const result = advanceEvidenceStatus({
      evidence: createEvidenceFixture(fromStatus),
      toStatus,
      metadata: {
        actor: "quality-office",
      },
    });

    assertEvidenceSuccess(result, `expected ${fromStatus} to ${toStatus} success`);
    assertEqual(result.evidence.status, toStatus, "transition status mismatch");
    assertEqual(
      result.evidence.metadata["fromStatus"],
      fromStatus,
      "from status metadata mismatch",
    );
    assertEqual(
      result.evidence.metadata["toStatus"],
      toStatus,
      "to status metadata mismatch",
    );
  });
});

runTest("all invalid status transitions return structured errors", () => {
  const statuses = [
    EvidenceStatus.Draft,
    EvidenceStatus.Attached,
    EvidenceStatus.Verified,
    EvidenceStatus.Rejected,
    EvidenceStatus.Cancelled,
  ];
  let invalidTransitionCount = 0;

  statuses.forEach((fromStatus) => {
    statuses.forEach((toStatus) => {
      if (isValidTransition(fromStatus, toStatus)) {
        return;
      }

      invalidTransitionCount += 1;
      const result = advanceEvidenceStatus({
        evidence: createEvidenceFixture(fromStatus),
        toStatus,
      });

      assertEvidenceFailure(result, `expected ${fromStatus} to ${toStatus} failure`);
      assertEqual(
        result.errors[0]?.code,
        "invalid_evidence_transition",
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

  assertEqual(invalidTransitionCount, 18, "invalid transition count mismatch");
});

runTest("immutable output", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture());

  assertEvidenceSuccess(result, "expected evidence creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.evidence), true, "evidence should be frozen");
  assertEqual(Object.isFrozen(result.evidence.links), true, "links should be frozen");
  assertEqual(Object.isFrozen(result.evidence.links[0]), true, "link should be frozen");
  assertEqual(
    Object.isFrozen(result.evidence.metadata),
    true,
    "metadata should be frozen",
  );
  assertEqual(Object.isFrozen(result.errors), true, "errors should be frozen");
  assertEqual(Object.isFrozen(result.warnings), true, "warnings should be frozen");
});

runTest("deterministic output", () => {
  const input = createEvidenceInputFixture();
  const first = JSON.stringify(createEvidenceRecord(input));
  const second = JSON.stringify(createEvidenceRecord(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("preserves traceability", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture());

  assertEvidenceSuccess(result, "expected evidence creation success");
  assertEqual(
    result.evidence.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
  assertEqual(result.evidence.metadata["createdBy"], createdBy, "created by mismatch");
  assertEqual(
    result.evidence.metadata["sourceSystem"],
    sourceSystem,
    "source system mismatch",
  );
  assertEqual(
    result.evidence.metadata["evidenceId"],
    evidenceId,
    "evidence metadata mismatch",
  );
  assertEqual(
    result.evidence.metadata["organizationId"],
    organizationId,
    "organization metadata mismatch",
  );
  assertEqual(
    result.evidence.metadata["contractId"],
    contractId,
    "contract metadata mismatch",
  );
  assertEqual(
    result.evidence.metadata["projectId"],
    projectId,
    "project metadata mismatch",
  );
});

runTest("preserves metadata", () => {
  const result = createEvidenceRecord(
    createEvidenceInputFixture({
      metadata: {
        futureMeasurementEntryIntegration: "prepared",
        futureApprovalWorkflowIntegration: "prepared",
        futureDocumentGeneratorIntegration: "prepared",
        futureAuditTrailIntegration: "prepared",
      },
    }),
  );

  assertEvidenceSuccess(result, "expected evidence creation success");
  assertEqual(
    result.evidence.metadata["futureMeasurementEntryIntegration"],
    "prepared",
    "measurement entry metadata mismatch",
  );
  assertEqual(
    result.evidence.metadata["futureApprovalWorkflowIntegration"],
    "prepared",
    "approval workflow metadata mismatch",
  );
  assertEqual(
    result.evidence.metadata["futureDocumentGeneratorIntegration"],
    "prepared",
    "document generator metadata mismatch",
  );
  assertEqual(
    result.evidence.metadata["futureAuditTrailIntegration"],
    "prepared",
    "audit trail metadata mismatch",
  );
});

runTest("does not perform upload, storage, or fetch", () => {
  const result = createEvidenceRecord(createEvidenceInputFixture());

  assertEvidenceSuccess(result, "expected evidence creation success");
  const serializedEvidence = JSON.stringify(result.evidence).toLowerCase();

  assertEqual(serializedEvidence.includes("upload"), false, "unexpected upload concept");
  assertEqual(serializedEvidence.includes("storage"), false, "unexpected storage concept");
  assertEqual(serializedEvidence.includes("fetch"), false, "unexpected fetch concept");
});

function createEvidenceFixture(
  status: EvidenceStatus = EvidenceStatus.Draft,
): EvidenceRecord {
  const result = createEvidenceRecord(createEvidenceInputFixture());

  assertEvidenceSuccess(result, "expected evidence fixture creation");

  return {
    ...result.evidence,
    status,
  };
}

function createEvidenceInputFixture(
  overrides: Partial<CreateEvidenceRecordInput> = {},
): CreateEvidenceRecordInput {
  return {
    id: overrides.id ?? evidenceId,
    organizationId: overrides.organizationId ?? organizationId,
    clientId: overrides.clientId === undefined ? clientId : overrides.clientId,
    contractId: overrides.contractId ?? contractId,
    projectId: overrides.projectId ?? projectId,
    workPackageId:
      overrides.workPackageId === undefined
        ? workPackageId
        : overrides.workPackageId,
    serviceItemId:
      overrides.serviceItemId === undefined
        ? serviceItemId
        : overrides.serviceItemId,
    measurementPeriodId:
      overrides.measurementPeriodId === undefined
        ? measurementPeriodId
        : overrides.measurementPeriodId,
    measurementEntryId:
      overrides.measurementEntryId === undefined
        ? measurementEntryId
        : overrides.measurementEntryId,
    measurementCycleId:
      overrides.measurementCycleId === undefined
        ? measurementCycleId
        : overrides.measurementCycleId,
    type: overrides.type === undefined ? EvidenceType.Photo : overrides.type,
    title: overrides.title ?? "Foto da frente de escavacao",
    description:
      overrides.description ?? "Registro fotografico da execucao medida em campo.",
    capturedAt: overrides.capturedAt ?? "2026-06-15T10:30:00Z",
    capturedById: overrides.capturedById ?? capturedById,
    capturedByName: overrides.capturedByName ?? capturedByName,
    location: overrides.location ?? "Lagoa do Arroz - eixo principal",
    links: overrides.links ?? [createEvidenceLinkFixture()],
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? {
      source: "evidence-center",
    },
  };
}

function createEvidenceLinkFixture(
  overrides: Partial<EvidenceLink> = {},
): EvidenceLink {
  return {
    id: overrides.id ?? "evidence-link-001",
    label: overrides.label ?? "Foto frontal da escavacao",
    uri: overrides.uri ?? "evidence://field-photo-001",
    mimeType: overrides.mimeType ?? "image/jpeg",
    sizeBytes: overrides.sizeBytes ?? 2480000,
    checksum: overrides.checksum ?? "sha256-field-photo-001",
    metadata: overrides.metadata ?? {
      source: "field-device",
    },
  };
}

function isValidTransition(
  fromStatus: EvidenceStatus,
  toStatus: EvidenceStatus,
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

function assertEvidenceSuccess(
  result: EvidenceCenterResult,
  message: string,
): asserts result is Extract<EvidenceCenterResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertEvidenceFailure(
  result: EvidenceCenterResult,
  message: string,
): asserts result is Extract<EvidenceCenterResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
