import {
  createContractBaseline,
  createMeasurementCatalog,
  createMeasurementMemory,
  createMeasurementPeriod,
  createServiceItem,
  createWorkPackage,
} from "./index";
import type {
  ContractBaseline,
  MeasurementCatalog,
  MeasurementMemory,
  MeasurementPeriod,
  ServiceItem,
  WorkPackage,
} from "./index";

const contractId = "contract-baseline-lagoa-do-arroz";
const workPackageId = "work-package-terraplenagem";
const serviceItemId = "service-item-escavacao";
const correlationId = "measurement-correlation-8";

runTest("creates contract baseline", () => {
  const contractBaseline = createContractBaselineFixture();

  assertEqual(contractBaseline.id, contractId, "contract id mismatch");
  assertEqual(contractBaseline.contractId, contractId, "trace contract id mismatch");
  assertEqual(contractBaseline.contractNumber, "22/2025", "contract number mismatch");
  assertEqual(contractBaseline.workPackages.length, 1, "work package count mismatch");
  assertEqual(contractBaseline.totalContractValue, 10000, "contract total mismatch");
});

runTest("creates work package", () => {
  const workPackage = createWorkPackageFixture();

  assertEqual(workPackage.id, workPackageId, "work package id mismatch");
  assertEqual(workPackage.contractId, contractId, "contract id mismatch");
  assertEqual(workPackage.code, "02.000.00", "work package code mismatch");
  assertEqual(workPackage.serviceItems.length, 1, "service item count mismatch");
});

runTest("creates service item", () => {
  const serviceItem = createServiceItemFixture();

  assertEqual(serviceItem.id, serviceItemId, "service item id mismatch");
  assertEqual(serviceItem.serviceItemId, serviceItemId, "trace service item id mismatch");
  assertEqual(serviceItem.code, "02.03.01", "service item code mismatch");
  assertEqual(serviceItem.unit, "M3", "service item unit mismatch");
});

runTest("calculates remaining quantity", () => {
  const serviceItem = createServiceItemFixture({
    contractQuantity: 100,
    accumulatedQuantity: 62.7,
  });

  assertEqual(serviceItem.remainingQuantity, 37.3, "remaining quantity mismatch");
});

runTest("calculates contract value", () => {
  const serviceItem = createServiceItemFixture({
    contractQuantity: 12.5,
    unitPrice: 80,
  });

  assertEqual(serviceItem.totalContractValue, 1000, "service item total mismatch");
});

runTest("detects replanilhamento requirement", () => {
  const serviceItem = createServiceItemFixture({
    contractQuantity: 100,
    accumulatedQuantity: 125,
  });

  assertEqual(serviceItem.remainingQuantity, -25, "remaining quantity mismatch");
  assertEqual(
    serviceItem.requiresReplanilhamento,
    true,
    "expected replanilhamento requirement",
  );
});

runTest("does not require replanilhamento inside contract quantity", () => {
  const serviceItem = createServiceItemFixture({
    contractQuantity: 100,
    accumulatedQuantity: 100,
  });

  assertEqual(
    serviceItem.requiresReplanilhamento,
    false,
    "unexpected replanilhamento requirement",
  );
});

runTest("creates measurement catalog", () => {
  const catalog = createMeasurementCatalogFixture();

  assertEqual(catalog.id, "measurement-catalog-1", "catalog id mismatch");
  assertEqual(catalog.contractBaselineId, contractId, "baseline id mismatch");
  assertEqual(catalog.contractId, contractId, "trace contract id mismatch");
  assertEqual(catalog.serviceItems.length, 1, "catalog service item count mismatch");
});

runTest("creates measurement memory", () => {
  const memory = createMeasurementMemoryFixture();

  assertEqual(memory.id, "measurement-memory-1", "memory id mismatch");
  assertEqual(memory.area?.value, 430.92, "area mismatch");
  assertEqual(memory.volume?.unit, "M3", "volume unit mismatch");
  assertEqual(memory.coordinates.length, 1, "coordinates mismatch");
  assertEqual(memory.evidenceReferences.length, 1, "evidence reference mismatch");
});

runTest("creates measurement period", () => {
  const period = createMeasurementPeriodFixture();

  assertEqual(period.id, "measurement-period-8", "period id mismatch");
  assertEqual(period.periodNumber, 8, "period number mismatch");
  assertEqual(period.startDate, "2026-06-01", "start date mismatch");
  assertEqual(period.endDate, "2026-06-30", "end date mismatch");
});

runTest("deterministic output", () => {
  const first = JSON.stringify(createContractBaselineFixture());
  const second = JSON.stringify(createContractBaselineFixture());

  assertEqual(first, second, "expected deterministic contract output");
});

runTest("preserves traceability", () => {
  const serviceItem = createServiceItemFixture();
  const memory = createMeasurementMemoryFixture();
  const period = createMeasurementPeriodFixture();

  assertEqual(serviceItem.contractId, contractId, "service item contract id mismatch");
  assertEqual(serviceItem.workPackageId, workPackageId, "service item work package id mismatch");
  assertEqual(serviceItem.serviceItemId, serviceItemId, "service item trace id mismatch");
  assertEqual(serviceItem.correlationId, correlationId, "service item correlation mismatch");
  assertEqual(memory.contractId, contractId, "memory contract id mismatch");
  assertEqual(memory.workPackageId, workPackageId, "memory work package id mismatch");
  assertEqual(memory.serviceItemId, serviceItemId, "memory service item id mismatch");
  assertEqual(period.contractId, contractId, "period contract id mismatch");
});

runTest("preserves metadata", () => {
  const serviceItem = createServiceItemFixture();
  const catalog = createMeasurementCatalogFixture();

  assertEqual(serviceItem.metadata["source"], "BM-08", "service metadata mismatch");
  assertEqual(catalog.metadata["source"], "measurement-catalog", "catalog metadata mismatch");
});

runTest("returns immutable objects", () => {
  const contractBaseline = createContractBaselineFixture();
  const workPackage = contractBaseline.workPackages[0];
  const serviceItem = workPackage?.serviceItems[0];

  assertExists(workPackage, "expected work package");
  assertExists(serviceItem, "expected service item");
  assertEqual(Object.isFrozen(contractBaseline), true, "contract should be frozen");
  assertEqual(Object.isFrozen(contractBaseline.workPackages), true, "workPackages should be frozen");
  assertEqual(Object.isFrozen(workPackage), true, "work package should be frozen");
  assertEqual(Object.isFrozen(workPackage.serviceItems), true, "serviceItems should be frozen");
  assertEqual(Object.isFrozen(serviceItem), true, "service item should be frozen");
});

function createContractBaselineFixture(): ContractBaseline {
  return createContractBaseline({
    id: contractId,
    contractNumber: "22/2025",
    contractName: "Recuperacao e modernizacao da Barragem Lagoa do Arroz",
    client: "DNOCS",
    contractor: "Consorcio Conjasf/Hidromec Lagoa do Arroz",
    startDate: "2025-11-11",
    endDate: "2026-08-10",
    workPackages: [createWorkPackageFixture()],
    correlationId,
    metadata: {
      source: "domain-discovery-7.9",
    },
  });
}

function createWorkPackageFixture(): WorkPackage {
  return createWorkPackage({
    id: workPackageId,
    contractId,
    code: "02.000.00",
    name: "Terraplenagem",
    description: "Terraplenagem e recuperacao de taludes",
    serviceItems: [createServiceItemFixture()],
    correlationId,
    metadata: {
      source: "RESUMO",
    },
  });
}

function createServiceItemFixture(
  overrides: Partial<{
    readonly contractQuantity: number;
    readonly accumulatedQuantity: number;
    readonly unitPrice: number;
  }> = {},
): ServiceItem {
  return createServiceItem({
    id: serviceItemId,
    contractId,
    workPackageId,
    code: "02.03.01",
    description: "Escavacao manual em material de primeira categoria",
    unit: "M3",
    contractQuantity: overrides.contractQuantity ?? 100,
    accumulatedQuantity: overrides.accumulatedQuantity ?? 40,
    unitPrice: overrides.unitPrice ?? 100,
    correlationId,
    metadata: {
      source: "BM-08",
    },
  });
}

function createMeasurementCatalogFixture(): MeasurementCatalog {
  return createMeasurementCatalog({
    id: "measurement-catalog-1",
    contractBaselineId: contractId,
    serviceItems: [createServiceItemFixture()],
    createdAt: "2026-07-02T00:00:00.000Z",
    correlationId,
    metadata: {
      source: "measurement-catalog",
    },
  });
}

function createMeasurementMemoryFixture(): MeasurementMemory {
  return createMeasurementMemory({
    id: "measurement-memory-1",
    contractId,
    workPackageId,
    serviceItemId,
    correlationId,
    area: {
      value: 430.92,
      unit: "M2",
      metadata: {
        source: "field-geometry",
      },
    },
    volume: {
      value: 2629.6,
      unit: "M3",
      metadata: {},
    },
    station: {
      initial: "0+0.00",
      final: "10+0.00",
      metadata: {},
    },
    coordinates: [
      {
        latitude: -6.8901,
        longitude: -38.5611,
        metadata: {},
      },
    ],
    geometry: {
      type: "stationed-section",
      description: "Talude measured by station and section area",
      dimensions: [
        {
          value: 20,
          unit: "M",
          metadata: {},
        },
      ],
      metadata: {},
    },
    calculationReference: {
      id: "calc-ref-1",
      description: "Area equals width multiplied by length",
      formula: "width * length",
      metadata: {},
    },
    evidenceReferences: [
      {
        id: "evidence-photo-1",
        type: "photo",
        description: "Field evidence",
        metadata: {},
      },
    ],
    metadata: {
      source: "measurement-memory",
    },
  });
}

function createMeasurementPeriodFixture(): MeasurementPeriod {
  return createMeasurementPeriod({
    id: "measurement-period-8",
    contractId,
    periodNumber: 8,
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    correlationId,
    metadata: {
      source: "BM-08",
    },
  });
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

function assertExists<T>(
  value: T | null | undefined,
  message: string,
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
}
