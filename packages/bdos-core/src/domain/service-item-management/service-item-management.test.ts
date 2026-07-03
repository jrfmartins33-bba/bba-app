import {
  ServiceItemMeasurementType,
  ServiceItemStatus,
  advanceServiceItemStatus,
  createManagedServiceItem,
  type CreateManagedServiceItemInput,
  type ManagedServiceItem,
  type ServiceItemManagementResult,
} from "./index";

const serviceItemId = "service-item-excavation";
const organizationId = "organization-alpha-engenharia";
const clientId = "client-dnocs";
const contractId = "contract-lagoa-do-arroz-001";
const projectId = "project-lagoa-do-arroz";
const workPackageId = "work-package-earthworks";
const correlationId = "service-item-management-correlation-001";
const createdBy = "project-controls";
const sourceSystem = "engineering-os";

const validTransitions: ReadonlyArray<
  readonly [ServiceItemStatus, ServiceItemStatus]
> = [
  [ServiceItemStatus.Draft, ServiceItemStatus.Active],
  [ServiceItemStatus.Active, ServiceItemStatus.Suspended],
  [ServiceItemStatus.Suspended, ServiceItemStatus.Active],
  [ServiceItemStatus.Active, ServiceItemStatus.Completed],
  [ServiceItemStatus.Active, ServiceItemStatus.Cancelled],
  [ServiceItemStatus.Draft, ServiceItemStatus.Cancelled],
];

runTest("valid creation", () => {
  const result = createManagedServiceItem(createServiceItemInputFixture());

  assertServiceItemSuccess(result, "expected service item creation success");
  assertEqual(result.serviceItem.id, serviceItemId, "service item id mismatch");
  assertEqual(
    result.serviceItem.organizationId,
    organizationId,
    "organization id mismatch",
  );
  assertEqual(result.serviceItem.clientId, clientId, "client id mismatch");
  assertEqual(result.serviceItem.contractId, contractId, "contract id mismatch");
  assertEqual(result.serviceItem.projectId, projectId, "project id mismatch");
  assertEqual(
    result.serviceItem.workPackageId,
    workPackageId,
    "work package id mismatch",
  );
  assertEqual(result.serviceItem.code, "02.03.01", "code mismatch");
  assertEqual(
    result.serviceItem.description,
    "Escavacao mecanizada em solo de primeira categoria.",
    "description mismatch",
  );
  assertEqual(result.serviceItem.unit, "M3", "unit mismatch");
  assertEqual(result.serviceItem.contractQuantity, 1250.5, "quantity mismatch");
  assertEqual(result.serviceItem.unitPrice, 87.35, "unit price mismatch");
  assertEqual(
    result.serviceItem.measurementType,
    ServiceItemMeasurementType.Quantity,
    "measurement type mismatch",
  );
});

runTest("calculates contractValue", () => {
  const result = createManagedServiceItem(
    createServiceItemInputFixture({
      contractQuantity: 12.345,
      unitPrice: 67.89,
    }),
  );

  assertServiceItemSuccess(result, "expected service item creation success");
  assertEqual(
    result.serviceItem.contractValue,
    12.345 * 67.89,
    "contract value mismatch",
  );
});

runTest("calculates remainingQuantity", () => {
  const result = createManagedServiceItem(
    createServiceItemInputFixture({
      contractQuantity: 100,
      accumulatedQuantity: 37.25,
    }),
  );

  assertServiceItemSuccess(result, "expected service item creation success");
  assertEqual(
    result.serviceItem.remainingQuantity,
    62.75,
    "remaining quantity mismatch",
  );
});

runTest("does not truncate negative remainingQuantity", () => {
  const result = createManagedServiceItem(
    createServiceItemInputFixture({
      contractQuantity: 100,
      accumulatedQuantity: 125,
    }),
  );

  assertServiceItemSuccess(result, "expected service item creation success");
  assertEqual(
    result.serviceItem.remainingQuantity,
    -25,
    "remaining quantity should not be truncated",
  );
});

runTest("rejects missing organizationId", () => {
  const result = createManagedServiceItem(
    createServiceItemInputFixture({ organizationId: "" }),
  );

  assertServiceItemFailure(result, "expected missing organization failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_organization_id",
    "error code mismatch",
  );
});

runTest("rejects missing contractId", () => {
  const result = createManagedServiceItem(
    createServiceItemInputFixture({ contractId: "" }),
  );

  assertServiceItemFailure(result, "expected missing contract failure");
  assertEqual(result.errors[0]?.code, "missing_contract_id", "error code mismatch");
});

runTest("rejects missing projectId", () => {
  const result = createManagedServiceItem(
    createServiceItemInputFixture({ projectId: "" }),
  );

  assertServiceItemFailure(result, "expected missing project failure");
  assertEqual(result.errors[0]?.code, "missing_project_id", "error code mismatch");
});

runTest("rejects missing workPackageId", () => {
  const result = createManagedServiceItem(
    createServiceItemInputFixture({ workPackageId: "" }),
  );

  assertServiceItemFailure(result, "expected missing work package failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_work_package_id",
    "error code mismatch",
  );
});

runTest("rejects missing code", () => {
  const result = createManagedServiceItem(createServiceItemInputFixture({ code: "" }));

  assertServiceItemFailure(result, "expected missing code failure");
  assertEqual(result.errors[0]?.code, "missing_code", "error code mismatch");
});

runTest("rejects missing description", () => {
  const result = createManagedServiceItem(
    createServiceItemInputFixture({ description: "" }),
  );

  assertServiceItemFailure(result, "expected missing description failure");
  assertEqual(result.errors[0]?.code, "missing_description", "error code mismatch");
});

runTest("rejects missing unit", () => {
  const result = createManagedServiceItem(createServiceItemInputFixture({ unit: "" }));

  assertServiceItemFailure(result, "expected missing unit failure");
  assertEqual(result.errors[0]?.code, "missing_unit", "error code mismatch");
});

runTest("rejects negative contractQuantity", () => {
  const result = createManagedServiceItem(
    createServiceItemInputFixture({ contractQuantity: -1 }),
  );

  assertServiceItemFailure(result, "expected invalid contract quantity failure");
  assertEqual(
    result.errors[0]?.code,
    "invalid_contract_quantity",
    "error code mismatch",
  );
});

runTest("rejects negative unitPrice", () => {
  const result = createManagedServiceItem(
    createServiceItemInputFixture({ unitPrice: -1 }),
  );

  assertServiceItemFailure(result, "expected invalid unit price failure");
  assertEqual(result.errors[0]?.code, "invalid_unit_price", "error code mismatch");
});

runTest("rejects negative accumulatedQuantity", () => {
  const result = createManagedServiceItem(
    createServiceItemInputFixture({ accumulatedQuantity: -1 }),
  );

  assertServiceItemFailure(result, "expected invalid accumulated quantity failure");
  assertEqual(
    result.errors[0]?.code,
    "invalid_accumulated_quantity",
    "error code mismatch",
  );
});

runTest("rejects missing measurementType", () => {
  const result = createManagedServiceItem(
    createServiceItemInputFixture({ measurementType: null }),
  );

  assertServiceItemFailure(result, "expected missing measurement type failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_measurement_type",
    "error code mismatch",
  );
});

runTest("preserves optional clientId when informed", () => {
  const result = createManagedServiceItem(createServiceItemInputFixture());

  assertServiceItemSuccess(result, "expected service item creation success");
  assertEqual(result.serviceItem.clientId, clientId, "client id mismatch");
  assertEqual(result.serviceItem.metadata["clientId"], clientId, "metadata mismatch");
});

runTest("allows missing clientId", () => {
  const result = createManagedServiceItem(
    createServiceItemInputFixture({ clientId: null }),
  );

  assertServiceItemSuccess(result, "expected service item creation success");
  assertEqual(result.serviceItem.clientId, null, "client id should be null");
});

runTest("initial status is Draft", () => {
  const result = createManagedServiceItem(createServiceItemInputFixture());

  assertServiceItemSuccess(result, "expected service item creation success");
  assertEqual(
    result.serviceItem.status,
    ServiceItemStatus.Draft,
    "initial status mismatch",
  );
});

runTest("all valid status transitions", () => {
  validTransitions.forEach(([fromStatus, toStatus]) => {
    const result = advanceServiceItemStatus({
      serviceItem: createServiceItemFixture(fromStatus),
      toStatus,
      metadata: {
        actor: "project-controls",
      },
    });

    assertServiceItemSuccess(result, `expected ${fromStatus} to ${toStatus} success`);
    assertEqual(result.serviceItem.status, toStatus, "transition status mismatch");
    assertEqual(
      result.serviceItem.metadata["fromStatus"],
      fromStatus,
      "from status metadata mismatch",
    );
    assertEqual(
      result.serviceItem.metadata["toStatus"],
      toStatus,
      "to status metadata mismatch",
    );
  });
});

runTest("all invalid status transitions return structured errors", () => {
  const statuses = [
    ServiceItemStatus.Draft,
    ServiceItemStatus.Active,
    ServiceItemStatus.Suspended,
    ServiceItemStatus.Completed,
    ServiceItemStatus.Cancelled,
  ];
  let invalidTransitionCount = 0;

  statuses.forEach((fromStatus) => {
    statuses.forEach((toStatus) => {
      if (isValidTransition(fromStatus, toStatus)) {
        return;
      }

      invalidTransitionCount += 1;
      const result = advanceServiceItemStatus({
        serviceItem: createServiceItemFixture(fromStatus),
        toStatus,
      });

      assertServiceItemFailure(
        result,
        `expected ${fromStatus} to ${toStatus} failure`,
      );
      assertEqual(
        result.errors[0]?.code,
        "invalid_service_item_transition",
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
  const result = createManagedServiceItem(createServiceItemInputFixture());

  assertServiceItemSuccess(result, "expected service item creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(
    Object.isFrozen(result.serviceItem),
    true,
    "service item should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.serviceItem.metadata),
    true,
    "metadata should be frozen",
  );
  assertEqual(Object.isFrozen(result.errors), true, "errors should be frozen");
  assertEqual(Object.isFrozen(result.warnings), true, "warnings should be frozen");
});

runTest("deterministic output", () => {
  const input = createServiceItemInputFixture();
  const first = JSON.stringify(createManagedServiceItem(input));
  const second = JSON.stringify(createManagedServiceItem(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("preserves traceability", () => {
  const result = createManagedServiceItem(createServiceItemInputFixture());

  assertServiceItemSuccess(result, "expected service item creation success");
  assertEqual(
    result.serviceItem.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
  assertEqual(result.serviceItem.metadata["createdBy"], createdBy, "created by mismatch");
  assertEqual(
    result.serviceItem.metadata["sourceSystem"],
    sourceSystem,
    "source system mismatch",
  );
  assertEqual(
    result.serviceItem.metadata["serviceItemId"],
    serviceItemId,
    "service item metadata mismatch",
  );
  assertEqual(
    result.serviceItem.metadata["organizationId"],
    organizationId,
    "organization metadata mismatch",
  );
  assertEqual(
    result.serviceItem.metadata["contractId"],
    contractId,
    "contract metadata mismatch",
  );
  assertEqual(
    result.serviceItem.metadata["projectId"],
    projectId,
    "project metadata mismatch",
  );
  assertEqual(
    result.serviceItem.metadata["workPackageId"],
    workPackageId,
    "work package metadata mismatch",
  );
});

runTest("preserves metadata", () => {
  const result = createManagedServiceItem(
    createServiceItemInputFixture({
      metadata: {
        futureMeasurementEntryIntegration: "prepared",
        futureMeasurementEngineIntegration: "prepared",
        futureMeasurementCatalogIntegration: "prepared",
        futureCurveSIntegration: "prepared",
        futureDashboardIntegration: "prepared",
        futureExcelImportIntegration: "prepared",
      },
    }),
  );

  assertServiceItemSuccess(result, "expected service item creation success");
  assertEqual(
    result.serviceItem.metadata["futureMeasurementEntryIntegration"],
    "prepared",
    "measurement entry metadata mismatch",
  );
  assertEqual(
    result.serviceItem.metadata["futureMeasurementEngineIntegration"],
    "prepared",
    "measurement engine metadata mismatch",
  );
  assertEqual(
    result.serviceItem.metadata["futureMeasurementCatalogIntegration"],
    "prepared",
    "measurement catalog metadata mismatch",
  );
  assertEqual(
    result.serviceItem.metadata["futureCurveSIntegration"],
    "prepared",
    "curve s metadata mismatch",
  );
  assertEqual(
    result.serviceItem.metadata["futureDashboardIntegration"],
    "prepared",
    "dashboard metadata mismatch",
  );
  assertEqual(
    result.serviceItem.metadata["futureExcelImportIntegration"],
    "prepared",
    "excel import metadata mismatch",
  );
});

function createServiceItemFixture(
  status: ServiceItemStatus = ServiceItemStatus.Draft,
): ManagedServiceItem {
  const result = createManagedServiceItem(createServiceItemInputFixture());

  assertServiceItemSuccess(result, "expected service item fixture creation");

  return {
    ...result.serviceItem,
    status,
  };
}

function createServiceItemInputFixture(
  overrides: Partial<CreateManagedServiceItemInput> = {},
): CreateManagedServiceItemInput {
  return {
    id: overrides.id ?? serviceItemId,
    organizationId: overrides.organizationId ?? organizationId,
    clientId: overrides.clientId === undefined ? clientId : overrides.clientId,
    contractId: overrides.contractId ?? contractId,
    projectId: overrides.projectId ?? projectId,
    workPackageId: overrides.workPackageId ?? workPackageId,
    code: overrides.code ?? "02.03.01",
    description:
      overrides.description ??
      "Escavacao mecanizada em solo de primeira categoria.",
    unit: overrides.unit ?? "M3",
    contractQuantity: overrides.contractQuantity ?? 1250.5,
    unitPrice: overrides.unitPrice ?? 87.35,
    accumulatedQuantity: overrides.accumulatedQuantity ?? 275.25,
    measurementType:
      overrides.measurementType === undefined
        ? ServiceItemMeasurementType.Quantity
        : overrides.measurementType,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? {
      source: "service-item-management",
    },
  };
}

function isValidTransition(
  fromStatus: ServiceItemStatus,
  toStatus: ServiceItemStatus,
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

function assertServiceItemSuccess(
  result: ServiceItemManagementResult,
  message: string,
): asserts result is Extract<ServiceItemManagementResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertServiceItemFailure(
  result: ServiceItemManagementResult,
  message: string,
): asserts result is Extract<ServiceItemManagementResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
