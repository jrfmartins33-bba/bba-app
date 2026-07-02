import type { AlphaEngenhariaId } from "./index";
import {
  alphaEngenhariaDigitalTwin,
  alphaEngenhariaDigitalTwinInput,
  createAlphaEngenhariaDigitalTwin,
} from "./index";

runTest("company and organization", () => {
  const twin = createAlphaEngenhariaDigitalTwin(alphaEngenhariaDigitalTwinInput);

  assertEqual(twin.company.legalName, "Alpha Engenharia Ltda.", "legalName mismatch");
  assertEqual(twin.company.industry, "Heavy Civil Construction", "industry mismatch");
  assertEqual(twin.company.currency, "BRL", "currency mismatch");
  assertEqual(twin.company.employees, 180, "employees mismatch");
  assertEqual(twin.organization.companyId, twin.company.id, "organization company mismatch");
  assertEqual(twin.organization.operatingUnits.length, 6, "operating unit count mismatch");
  assertExists(
    twin.organization.operatingUnits.find((unit) => unit.id === "alpha-unit-finance"),
    "expected finance unit",
  );
});

runTest("projects and contracts", () => {
  const twin = createAlphaEngenhariaDigitalTwin(alphaEngenhariaDigitalTwinInput);
  const serraAzulProject = findById(twin.projects, "alpha-project-serra-azul-dam");
  const serraAzulContract = findById(twin.contracts, "alpha-contract-serra-azul-dam");

  assertEqual(twin.projects.length, 3, "project count mismatch");
  assertEqual(twin.contracts.length, 3, "contract count mismatch");
  assertEqual(
    serraAzulProject.contractId,
    serraAzulContract.id,
    "project contract mismatch",
  );
  assertEqual(
    serraAzulContract.contractValue,
    18000000,
    "contract value mismatch",
  );
  assertEqual(
    serraAzulContract.paymentTerms.paymentDueDays,
    45,
    "payment term mismatch",
  );
});

runTest("physical progress and measurements", () => {
  const twin = createAlphaEngenhariaDigitalTwin(alphaEngenhariaDigitalTwinInput);
  const serraAzulProject = findById(twin.projects, "alpha-project-serra-azul-dam");
  const latestMeasurement = findById(
    twin.measurements,
    "alpha-measure-serra-azul-2026-03",
  );

  assertEqual(
    serraAzulProject.physicalProgress.plannedPercentage,
    32,
    "planned progress mismatch",
  );
  assertEqual(
    serraAzulProject.physicalProgress.actualPercentage,
    28,
    "actual progress mismatch",
  );
  assertEqual(
    serraAzulProject.physicalProgress.lastMeasurementId,
    latestMeasurement.id,
    "last measurement mismatch",
  );
  assertEqual(
    latestMeasurement.physicalProgressPercentage,
    27.5,
    "measurement progress mismatch",
  );
  assertEqual(
    latestMeasurement.invoiceReference,
    "alpha-invoice-serra-azul-003",
    "invoice reference mismatch",
  );
});

runTest("business events", () => {
  const twin = createAlphaEngenhariaDigitalTwin(alphaEngenhariaDigitalTwinInput);

  assertEqual(twin.businessEvents.length, 8, "event count mismatch");
  assertEqual(
    twin.businessEvents[0]?.title,
    "Serra Azul dam contract signed",
    "first event mismatch",
  );
  assertEqual(
    twin.businessEvents[3]?.title,
    "Client payment delayed",
    "payment delay event mismatch",
  );
  assertEqual(
    twin.businessEvents[7]?.financialImpact,
    2500000,
    "financing impact mismatch",
  );
});

runTest("deterministic output", () => {
  const first = JSON.stringify(
    createAlphaEngenhariaDigitalTwin(alphaEngenhariaDigitalTwinInput),
  );
  const second = JSON.stringify(
    createAlphaEngenhariaDigitalTwin(alphaEngenhariaDigitalTwinInput),
  );

  assertEqual(first, second, "expected deterministic output");
  assertEqual(
    JSON.stringify(alphaEngenhariaDigitalTwin),
    first,
    "exported digital twin mismatch",
  );
});

runTest("traceability", () => {
  const twin = createAlphaEngenhariaDigitalTwin(alphaEngenhariaDigitalTwinInput);
  const knownIds = [
    twin.company.id,
    twin.organization.id,
    ...twin.organization.operatingUnits.map((unit) => unit.id),
    ...twin.projects.map((project) => project.id),
    ...twin.contracts.map((contract) => contract.id),
    ...twin.measurements.map((measurement) => measurement.id),
  ];

  twin.projects.forEach((project) => {
    assertEqual(project.companyId, twin.company.id, "project company mismatch");
    assertArrayIncludes(knownIds, project.organizationUnitId, "project unit missing");
    assertArrayIncludes(knownIds, project.contractId, "project contract missing");
    assertArrayIncludes(
      knownIds,
      project.physicalProgress.lastMeasurementId,
      "last measurement missing",
    );
    assertEqual(project.metadata["traceId"], project.id, "project trace mismatch");
  });

  twin.contracts.forEach((contract) => {
    assertEqual(contract.companyId, twin.company.id, "contract company mismatch");
    assertArrayIncludes(knownIds, contract.projectId, "contract project missing");
    assertEqual(contract.metadata["traceId"], contract.id, "contract trace mismatch");
  });

  twin.measurements.forEach((measurement) => {
    assertArrayIncludes(knownIds, measurement.projectId, "measurement project missing");
    assertArrayIncludes(knownIds, measurement.contractId, "measurement contract missing");
    assertEqual(
      measurement.metadata["traceId"],
      measurement.id,
      "measurement trace mismatch",
    );
  });

  twin.businessEvents.forEach((event) => {
    assertArrayIncludes(knownIds, event.sourceObjectId, "event source missing");
    assertEqual(event.metadata["traceId"], event.id, "event trace mismatch");
  });
});

function findById<T extends { readonly id: AlphaEngenhariaId }>(
  values: ReadonlyArray<T>,
  id: AlphaEngenhariaId,
): T {
  const value = values.find((candidate) => candidate.id === id);

  assertExists(value, `expected ${id} to exist`);

  return value;
}

function assertArrayIncludes<T>(
  values: ReadonlyArray<T>,
  expected: T,
  message: string,
): void {
  if (!values.includes(expected)) {
    throw new Error(message);
  }
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
