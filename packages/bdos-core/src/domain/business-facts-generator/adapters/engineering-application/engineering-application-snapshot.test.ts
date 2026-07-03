import {
  attachedEvidenceFixture,
  approvedWorkflowFixture,
  closedMeasurementWorkspaceFixture,
  draftEvidenceFixture,
  finalizedBulletinFixture,
  fixtureActor,
  fixtureCorrelationId,
  fixtureOccurredAt,
  fixtureOrganizationId,
  preparedExportPackageFixture,
} from "./engineering-application.fixtures";
import {
  createEngineeringApplicationSnapshot,
  summarizeEngineeringApplicationSnapshot,
} from "./index";

runTest("valid snapshot captures all provided sources", () => {
  const snapshot = createEngineeringApplicationSnapshot({
    organizationId: fixtureOrganizationId,
    correlationId: fixtureCorrelationId,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    measurementWorkspace: closedMeasurementWorkspaceFixture(),
    approvalWorkflow: approvedWorkflowFixture(),
    bulletin: finalizedBulletinFixture(),
    exportPackage: preparedExportPackageFixture(),
    evidenceRecords: [attachedEvidenceFixture("evidence-1")],
  });

  assertEqual(snapshot.measurement !== null, true, "measurement should be captured");
  assertEqual(snapshot.approval !== null, true, "approval should be captured");
  assertEqual(snapshot.bulletin !== null, true, "bulletin should be captured");
  assertEqual(snapshot.exportPackage !== null, true, "export should be captured");
  assertEqual(snapshot.evidence.length, 1, "evidence should be captured");
  assertEqual(snapshot.measurement?.status, "Closed", "measurement status mismatch");
  assertEqual(snapshot.approval?.status, "Approved", "approval status mismatch");
  assertEqual(snapshot.bulletin?.status, "Finalized", "bulletin status mismatch");
  assertEqual(snapshot.exportPackage?.status, "Prepared", "export status mismatch");
});

runTest("snapshot accepts partial input (no rejection) — gating happens at fact generation", () => {
  const snapshot = createEngineeringApplicationSnapshot({
    organizationId: fixtureOrganizationId,
    correlationId: fixtureCorrelationId,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });

  assertEqual(snapshot.measurement, null, "measurement should be null");
  assertEqual(snapshot.approval, null, "approval should be null");
  assertEqual(snapshot.bulletin, null, "bulletin should be null");
  assertEqual(snapshot.exportPackage, null, "export should be null");
  assertEqual(snapshot.evidence.length, 0, "evidence should be empty");
});

runTest("summarizeEngineeringApplicationSnapshot is deterministic", () => {
  const snapshot = createEngineeringApplicationSnapshot({
    organizationId: fixtureOrganizationId,
    correlationId: fixtureCorrelationId,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    measurementWorkspace: closedMeasurementWorkspaceFixture(),
    evidenceRecords: [
      attachedEvidenceFixture("evidence-1"),
      draftEvidenceFixture("evidence-2"),
    ],
  });

  const summary = summarizeEngineeringApplicationSnapshot(snapshot);

  assertEqual(summary.hasMeasurement, true, "hasMeasurement mismatch");
  assertEqual(summary.hasApproval, false, "hasApproval mismatch");
  assertEqual(summary.totalEvidence, 2, "totalEvidence mismatch");
  assertEqual(summary.attachedEvidence, 1, "attachedEvidence mismatch");
});

runTest("preserves traceability from the source snapshot input, not internally generated", () => {
  const snapshot = createEngineeringApplicationSnapshot({
    organizationId: fixtureOrganizationId,
    correlationId: fixtureCorrelationId,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    measurementWorkspace: closedMeasurementWorkspaceFixture(),
  });

  assertEqual(snapshot.organizationId, fixtureOrganizationId, "organizationId mismatch");
  assertEqual(snapshot.correlationId, fixtureCorrelationId, "correlationId mismatch");
  assertEqual(snapshot.trace.length, 1, "trace should record the snapshot creation");
  assertEqual(snapshot.trace[0]?.actor, fixtureActor, "trace actor mismatch");
  assertEqual(snapshot.trace[0]?.occurredAt, fixtureOccurredAt, "trace occurredAt mismatch");
  assertEqual(
    snapshot.measurement?.occurredAt,
    fixtureOccurredAt,
    "measurement occurredAt should come from the workspace's own trace",
  );
});

runTest("immutable output", () => {
  const snapshot = createEngineeringApplicationSnapshot({
    organizationId: fixtureOrganizationId,
    correlationId: fixtureCorrelationId,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    measurementWorkspace: closedMeasurementWorkspaceFixture(),
    evidenceRecords: [attachedEvidenceFixture("evidence-1")],
  });

  assertEqual(Object.isFrozen(snapshot), true, "snapshot should be frozen");
  assertEqual(Object.isFrozen(snapshot.measurement), true, "measurement should be frozen");
  assertEqual(Object.isFrozen(snapshot.evidence), true, "evidence should be frozen");
  assertEqual(Object.isFrozen(snapshot.evidence[0]), true, "evidence item should be frozen");
  assertEqual(Object.isFrozen(snapshot.trace), true, "trace should be frozen");
  assertEqual(Object.isFrozen(snapshot.metadata), true, "metadata should be frozen");
});

runTest("deterministic output for identical input", () => {
  const buildInput = () => ({
    organizationId: fixtureOrganizationId,
    correlationId: fixtureCorrelationId,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    measurementWorkspace: closedMeasurementWorkspaceFixture(),
  });

  const first = JSON.stringify(createEngineeringApplicationSnapshot(buildInput()));
  const second = JSON.stringify(createEngineeringApplicationSnapshot(buildInput()));

  assertEqual(first, second, "expected deterministic snapshot output");
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
