import { buildBbaProjectImportSnapshot } from "./index";

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<Project>
  <Tasks>
    <Task>
      <UID>0</UID>
      <Name>Barragem Lagoa do Arroz</Name>
      <OutlineLevel>0</OutlineLevel>
      <Start>2026-01-05T08:00:00</Start>
      <Finish>2026-02-10T17:00:00</Finish>
      <Duration>PT280H0M0S</Duration>
      <PercentComplete>10</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>1</Summary>
    </Task>
    <Task>
      <UID>1</UID>
      <Name>Fundação da Barragem</Name>
      <WBS>1</WBS>
      <OutlineLevel>1</OutlineLevel>
      <Start>2026-01-05T08:00:00</Start>
      <Finish>2026-02-10T17:00:00</Finish>
      <Duration>PT280H0M0S</Duration>
      <PercentComplete>20</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>1</Summary>
    </Task>
    <Task>
      <UID>2</UID>
      <Name>Concretagem do Bloco 3</Name>
      <WBS>1.1</WBS>
      <OutlineLevel>2</OutlineLevel>
      <Start>2026-01-13T08:00:00</Start>
      <Finish>2026-01-20T17:00:00</Finish>
      <Duration>PT56H0M0S</Duration>
      <PercentComplete>30</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>0</Summary>
    </Task>
  </Tasks>
</Project>`;

const baseInput = {
  xml: sampleXml,
  organizationId: "organization-alpha-engenharia",
  contractId: "contract-lagoa-do-arroz-001",
  projectId: "project-lagoa-do-arroz",
  tenantId: "tenant-alpha-engenharia",
  capability: "geospatial-intelligence",
  generatedAt: "2026-01-15T09:00:00.000Z",
  correlationId: "bba-project-import-correlation-001",
  actor: "project-controls",
  occurredAt: "2026-01-15T09:00:00.000Z",
  asOfDate: "2026-01-15",
};

runTest("produces schedule activities, critical path and s-curve from a real XML import", () => {
  const result = buildBbaProjectImportSnapshot(baseInput);

  assertEqual(result.activities.length, 2, "expected 2 activities (UID 0 project summary skipped)");
  assertEqual(result.criticalPath.activities.length, 1, "expected 1 leaf activity in the critical path (summary excluded)");
  assertEqual(result.sCurve.length > 0, true, "expected a non-empty s-curve");
});

runTest("every leaf activity produces a real SpatialObject (PRINCIPLE 005)", () => {
  const result = buildBbaProjectImportSnapshot(baseInput);

  assertEqual(result.spatialObjects.length, 1, "expected 1 spatial object (only the leaf, non-summary activity)");
  assertEqual(result.spatialObjects[0]?.label, "Concretagem do Bloco 3", "expected the spatial object to mirror the leaf activity name");
});

runTest("a freshly imported activity, with no field evidence yet, produces a real low-confidence decision", () => {
  const result = buildBbaProjectImportSnapshot(baseInput);

  assertEqual(result.decisions.length > 0, true, "expected at least one decision from the reused low-spatial-confidence rule");
  assertEqual(result.recommendations.length > 0, true, "expected at least one recommendation");
});

runTest("returns an empty, non-throwing snapshot for XML with no importable tasks", () => {
  const result = buildBbaProjectImportSnapshot({ ...baseInput, xml: "<Project><Tasks/></Project>" });

  assertEqual(result.success, false, "expected failure when nothing can be imported");
  assertEqual(result.activities.length, 0, "expected no activities");
  assertEqual(result.spatialObjects.length, 0, "expected no spatial objects");
  assertEqual(result.criticalPath.projectDurationDays, 0, "expected zero project duration");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
