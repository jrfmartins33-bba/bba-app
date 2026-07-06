import { importProjectXml } from "./index";

/**
 * Este fixture e as expectativas abaixo foram verificados de forma
 * independente (fora deste pacote, via `tsx`, antes deste teste ser
 * escrito) contra a implementação real de `importProjectXml` — não são
 * apenas uma suposição sobre o comportamento esperado.
 */
const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<Project>
  <Tasks>
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>Barragem Lagoa do Arroz</Name>
      <OutlineLevel>0</OutlineLevel>
      <Start>2026-01-05T08:00:00</Start>
      <Finish>2026-03-20T17:00:00</Finish>
      <Duration>PT560H0M0S</Duration>
      <PercentComplete>10</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>1</Summary>
    </Task>
    <Task>
      <UID>1</UID>
      <ID>1</ID>
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
      <ID>2</ID>
      <Name>Escavação</Name>
      <WBS>1.1</WBS>
      <OutlineLevel>2</OutlineLevel>
      <Start>2026-01-05T08:00:00</Start>
      <Finish>2026-01-12T17:00:00</Finish>
      <Duration>PT56H0M0S</Duration>
      <PercentComplete>100</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>0</Summary>
    </Task>
    <Task>
      <UID>3</UID>
      <ID>3</ID>
      <Name>Concretagem do Bloco 3</Name>
      <WBS>1.2</WBS>
      <OutlineLevel>2</OutlineLevel>
      <Start>2026-01-13T08:00:00</Start>
      <Finish>2026-01-20T17:00:00</Finish>
      <Duration>PT56H0M0S</Duration>
      <PercentComplete>30</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>0</Summary>
      <PredecessorLink>
        <PredecessorUID>2</PredecessorUID>
        <Type>1</Type>
        <LinkLag>0</LinkLag>
      </PredecessorLink>
    </Task>
    <Task>
      <UID>4</UID>
      <ID>4</ID>
      <Name>Marco: Fundação Concluída</Name>
      <WBS>1.3</WBS>
      <OutlineLevel>2</OutlineLevel>
      <Start>2026-02-10T08:00:00</Start>
      <Finish>2026-02-10T17:00:00</Finish>
      <Duration>PT0H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
      <Milestone>1</Milestone>
      <Summary>0</Summary>
      <PredecessorLink>
        <PredecessorUID>3</PredecessorUID>
        <Type>1</Type>
        <LinkLag>0</LinkLag>
      </PredecessorLink>
    </Task>
  </Tasks>
</Project>`;

const baseInput = {
  xml: sampleXml,
  projectId: "project-lagoa-do-arroz",
  organizationId: "organization-alpha-engenharia",
  contractId: "contract-lagoa-do-arroz-001",
  correlationId: "import-correlation-001",
  createdBy: "project-controls",
};

runTest("skips the UID=0 project summary task", () => {
  const result = importProjectXml(baseInput);

  assertEqual(result.success, true, "expected import success");
  assertEqual(result.activities.length, 4, "expected 4 activities (UID 0 skipped)");
  assertEqual(result.skipped[0]?.taskUid, "0", "expected UID 0 to be skipped");
  assertEqual(result.skipped[0]?.reason, "project_summary_task", "expected project summary reason");
});

runTest("derives hierarchy from OutlineLevel", () => {
  const result = importProjectXml(baseInput);

  const fundacao = result.activities.find((activity) => activity.id === "activity-1");
  const escavacao = result.activities.find((activity) => activity.id === "activity-2");

  assertEqual(fundacao?.parentActivityId, null, "top-level activity should have no parent");
  assertEqual(fundacao?.isSummary, true, "outline-level-1 task should be a summary row");
  assertEqual(escavacao?.parentActivityId, "activity-1", "leaf activity should point to its summary parent");
  assertEqual(escavacao?.isSummary, false, "leaf task should not be a summary row");
});

runTest("parses duration assuming an 8h workday", () => {
  const result = importProjectXml(baseInput);
  const bloco3 = result.activities.find((activity) => activity.id === "activity-3");

  assertEqual(bloco3?.durationDays, 7, "PT56H0M0S should be read as 7 days at 8h/day");
});

runTest("carries predecessor links as FinishToStart dependencies", () => {
  const result = importProjectXml(baseInput);
  const bloco3 = result.activities.find((activity) => activity.id === "activity-3");

  assertEqual(bloco3?.dependencies.length, 1, "expected one dependency");
  assertEqual(bloco3?.dependencies[0]?.predecessorId, "activity-2", "expected dependency on Escavação");
});

runTest("recognizes milestones with zero duration", () => {
  const result = importProjectXml(baseInput);
  const marco = result.activities.find((activity) => activity.id === "activity-4");

  assertEqual(marco?.isMilestone, true, "expected milestone flag");
  assertEqual(marco?.durationDays, 0, "expected zero duration for a milestone");
});

runTest("mirrors every activity into a WorkPackage with the same id (PRINCIPLE 005)", () => {
  const result = importProjectXml(baseInput);

  assertEqual(result.workPackages.length, 4, "expected 4 mirrored work packages");

  const escavacaoWorkPackage = result.workPackages.find((workPackage) => workPackage.id === "activity-2");
  assertEqual(escavacaoWorkPackage?.type, "execution_front", "leaf activities should become ExecutionFront work packages");

  const fundacaoWorkPackage = result.workPackages.find((workPackage) => workPackage.id === "activity-1");
  assertEqual(fundacaoWorkPackage?.type, "scope_group", "summary rows should become ScopeGroup work packages, never a spatial place");
});

runTest("infers actualStart from Start when PercentComplete > 0 but ActualStart is absent", () => {
  const result = importProjectXml(baseInput);

  const escavacao = result.activities.find((activity) => activity.id === "activity-2");
  const marco = result.activities.find((activity) => activity.id === "activity-4");

  assertEqual(escavacao?.percentComplete, 100, "expected Escavação at 100%");
  assertEqual(escavacao?.actualStart, "2026-01-05", "expected actualStart inferred from Start (no ActualStart in fixture)");
  assertEqual(marco?.actualStart, null, "0% activities should never get an actualStart");
});

runTest("rejects XML with no Task elements", () => {
  const result = importProjectXml({ ...baseInput, xml: "<Project><Tasks/></Project>" });

  assertEqual(result.success, false, "expected import failure");
  assertEqual(result.errors[0]?.stage, "xml_parsing", "expected an xml_parsing stage error");
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
