import { buildBbaProjectImportSnapshot } from "./bba-project-import";
import { importPlanningSource } from "./planning-source-import";
import { buildXlsxFixture } from "../../domain/schedule-management/adapters/excel-import/xlsx-test-fixtures";

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<Project>
  <Tasks>
    <Task>
      <UID>0</UID>
      <Name>Projeto</Name>
      <OutlineLevel>0</OutlineLevel>
      <Start>2026-01-05T08:00:00</Start>
      <Finish>2026-01-20T17:00:00</Finish>
      <Duration>PT120H0M0S</Duration>
      <PercentComplete>10</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>1</Summary>
    </Task>
    <Task>
      <UID>1</UID>
      <Name>Concretagem do Bloco 3</Name>
      <WBS>1</WBS>
      <OutlineLevel>1</OutlineLevel>
      <Start>2026-01-05T08:00:00</Start>
      <Finish>2026-01-13T17:00:00</Finish>
      <Duration>PT56H0M0S</Duration>
      <PercentComplete>20</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>0</Summary>
    </Task>
  </Tasks>
</Project>`;

const baseInput = {
  organizationId: "organization-alpha-engenharia",
  contractId: "contract-lagoa-do-arroz-001",
  projectId: "project-lagoa-do-arroz",
  tenantId: "tenant-alpha-engenharia",
  capability: "geospatial-intelligence",
  generatedAt: "2026-01-15T09:00:00.000Z",
  correlationId: "planning-source-import-correlation-001",
  actor: "project-controls",
  occurredAt: "2026-01-15T09:00:00.000Z",
  asOfDate: "2026-01-15",
};

runTest("the XML path produces exactly the same result as buildBbaProjectImportSnapshot (Sprint Zero, unchanged)", () => {
  const direct = buildBbaProjectImportSnapshot({ ...baseInput, xml: sampleXml });
  const dispatched = importPlanningSource({ ...baseInput, sourceType: "ms-project-xml", xml: sampleXml, fileName: "cronograma.xml" });

  assertEqual(dispatched.activities.length, direct.activities.length, "activity count should match exactly");
  assertEqual(dispatched.criticalPath.projectDurationDays, direct.criticalPath.projectDurationDays, "critical path duration should match exactly");
  assertEqual(dispatched.spatialObjects.length, direct.spatialObjects.length, "spatial object count should match exactly");
  assertEqual(dispatched.decisions.length, direct.decisions.length, "decision count should match exactly");
  assertEqual(dispatched.recommendations.length, direct.recommendations.length, "recommendation count should match exactly");
  assertEqual(dispatched.sourceType, "ms-project-xml", "expected ms-project-xml source type");
  assertEqual(dispatched.detectedPlanningType, "cronograma", "expected cronograma detected type");
});

runTest("the Excel path produces real SpatialObjects/Decisions even without any dates (PRINCIPLE 005)", () => {
  const bytes = buildXlsxFixture([
    {
      name: "CRONOGRAMA FÍSICO-FINANCEIRO",
      rows: [
        ["", "ITEM", "DESCRIÇÃO", "", "", "VALOR TOTAL (R$)", "CONTROLE"],
        ["", "", "", "", "", "", "", "mês 1", "mês 2", "mês 3"],
        ["", "1.0", "Terraplenagem", "", "", 100000, "PREVISTO", 0.5, 0.5, null],
      ],
    },
  ]);

  const result = importPlanningSource({ ...baseInput, sourceType: "excel", excelBytes: bytes, fileName: "fisico-financeiro.xlsx" });

  assertEqual(result.sourceType, "excel", "expected excel source type");
  assertEqual(result.detectedPlanningType, "fisico-financeiro", "expected fisico-financeiro detected type");
  assertEqual(result.activities.length, 0, "no ScheduleActivity should exist without dates");
  assertEqual(result.spatialObjects.length, 1, "expected 1 real SpatialObject even without dates");
  assertEqual(result.decisions.length, 1, "expected 1 real Decision even without dates");
  assertEqual(result.recommendations.length, 1, "expected 1 real Recommendation even without dates");
  assertEqual(result.criticalPath.projectDurationDays, 0, "critical path should be empty without any scheduled activity");
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
