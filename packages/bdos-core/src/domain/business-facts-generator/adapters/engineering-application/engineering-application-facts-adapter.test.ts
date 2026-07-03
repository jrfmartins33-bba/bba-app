import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { BusinessFact } from "../../../business-fact";
import {
  attachedEvidenceFixture,
  approvedWorkflowFixture,
  closedMeasurementWorkspaceFixture,
  draftBulletinFixture,
  draftEvidenceFixture,
  finalizedBulletinFixture,
  fixtureActor,
  fixtureCorrelationId,
  fixtureOccurredAt,
  fixtureOrganizationId,
  inProgressMeasurementWorkspaceFixture,
  preparedExportPackageFixture,
  submittedWorkflowFixture,
  validatedExportPackageFixture,
} from "./engineering-application.fixtures";
import {
  createEngineeringApplicationSnapshot,
  engineeringApplicationFactsAdapter,
  engineeringApplicationFactsSource,
  generateEngineeringBusinessFactsFromSnapshot,
  type EngineeringApplicationFactsGenerationInput,
} from "./index";
import type { EngineeringApplicationSnapshot } from "./engineering-application-snapshot.types";

const SRC_ROOT = resolve(__dirname, "../../../..");
const ADAPTER_DIR = resolve(__dirname);
const OPERATIONAL_DOMAINS = [
  "contract-management",
  "project-management",
  "work-package-management",
  "service-item-management",
  "engineer-workspace",
  "evidence-center",
  "measurement-workspace",
  "approval-workflow",
  "bulletin-generator",
  "export-engine",
];

const generatedAt = "2026-06-21T09:00:00Z";
const tenantId = "tenant-alpha-engenharia";
const capability = "engineering-application";

runTest("generates one fact per finalized/approved source in a fully populated snapshot", () => {
  const snapshot = fullSnapshotFixture();
  const result = generateEngineeringBusinessFactsFromSnapshot(inputFixture({ snapshot }));

  assertResultSuccess(result, "expected fact generation success");
  assertEqual(result.facts.length, 5, "expected exactly 5 facts");

  const types = result.facts.map((fact) => fact.type).sort();
  assertEqual(
    types.join(","),
    [
      "approval_completed",
      "bulletin_finalized",
      "evidence_attached",
      "export_prepared",
      "measurement_finalized",
    ].join(","),
    "unexpected fact type set",
  );
});

runTest("only attached/verified evidence produces facts, draft evidence is skipped", () => {
  const snapshot = createEngineeringApplicationSnapshot({
    organizationId: fixtureOrganizationId,
    correlationId: fixtureCorrelationId,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    evidenceRecords: [attachedEvidenceFixture("evidence-1"), draftEvidenceFixture("evidence-2")],
  });
  const result = generateEngineeringBusinessFactsFromSnapshot(inputFixture({ snapshot }));

  assertResultSuccess(result, "expected fact generation success");
  assertEqual(result.facts.length, 1, "expected exactly one evidence fact");
  assertEqual(result.facts[0]?.type, "evidence_attached", "unexpected fact type");
  assertEqual(result.facts[0]?.sourceReference, "evidence-1", "unexpected source reference");
});

runTest("rejects incomplete generation input", () => {
  const snapshot = fullSnapshotFixture();

  const missingTenant = generateEngineeringBusinessFactsFromSnapshot(
    inputFixture({ snapshot, tenantId: "" }),
  );
  assertResultFailure(missingTenant, "expected failure for missing tenantId");
  assertEqual(missingTenant.errors[0]?.code, "missing_required_data", "error code mismatch");

  const missingSnapshot = generateEngineeringBusinessFactsFromSnapshot(
    inputFixture({ snapshot: undefined }),
  );
  assertResultFailure(missingSnapshot, "expected failure for missing snapshot");
  assertEqual(missingSnapshot.errors[0]?.code, "missing_required_data", "error code mismatch");
});

runTest("rejects a measurement workspace that is not Closed", () => {
  const snapshot = createEngineeringApplicationSnapshot({
    organizationId: fixtureOrganizationId,
    correlationId: fixtureCorrelationId,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    measurementWorkspace: inProgressMeasurementWorkspaceFixture(),
  });
  const result = generateEngineeringBusinessFactsFromSnapshot(inputFixture({ snapshot }));

  assertResultFailure(result, "expected failure for non-closed measurement workspace");
  assertEqual(result.errors[0]?.code, "measurement_not_finalized", "error code mismatch");
});

runTest("rejects an approval workflow that is not Approved", () => {
  const snapshot = createEngineeringApplicationSnapshot({
    organizationId: fixtureOrganizationId,
    correlationId: fixtureCorrelationId,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    approvalWorkflow: submittedWorkflowFixture(),
  });
  const result = generateEngineeringBusinessFactsFromSnapshot(inputFixture({ snapshot }));

  assertResultFailure(result, "expected failure for non-approved workflow");
  assertEqual(result.errors[0]?.code, "approval_not_completed", "error code mismatch");
});

runTest("rejects a measurement bulletin that is not Finalized", () => {
  const snapshot = createEngineeringApplicationSnapshot({
    organizationId: fixtureOrganizationId,
    correlationId: fixtureCorrelationId,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    bulletin: draftBulletinFixture(),
  });
  const result = generateEngineeringBusinessFactsFromSnapshot(inputFixture({ snapshot }));

  assertResultFailure(result, "expected failure for non-finalized bulletin");
  assertEqual(result.errors[0]?.code, "bulletin_not_finalized", "error code mismatch");
});

runTest("rejects an export package that is not Prepared", () => {
  const snapshot = createEngineeringApplicationSnapshot({
    organizationId: fixtureOrganizationId,
    correlationId: fixtureCorrelationId,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    exportPackage: validatedExportPackageFixture(),
  });
  const result = generateEngineeringBusinessFactsFromSnapshot(inputFixture({ snapshot }));

  assertResultFailure(result, "expected failure for non-prepared export package");
  assertEqual(result.errors[0]?.code, "export_not_prepared", "error code mismatch");
});

runTest("rejects a snapshot with no source data at all", () => {
  const snapshot = createEngineeringApplicationSnapshot({
    organizationId: fixtureOrganizationId,
    correlationId: fixtureCorrelationId,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  const result = generateEngineeringBusinessFactsFromSnapshot(inputFixture({ snapshot }));

  assertResultFailure(result, "expected failure for empty snapshot");
  assertEqual(result.errors[0]?.code, "missing_snapshot_data", "error code mismatch");
});

runTest("generates deterministic facts for identical input", () => {
  const snapshot = fullSnapshotFixture();
  const first = JSON.stringify(
    generateEngineeringBusinessFactsFromSnapshot(inputFixture({ snapshot })),
  );
  const second = JSON.stringify(
    generateEngineeringBusinessFactsFromSnapshot(inputFixture({ snapshot })),
  );

  assertEqual(first, second, "expected deterministic fact generation");
});

runTest("preserves traceability from the snapshot into every generated fact", () => {
  const snapshot = fullSnapshotFixture();
  const result = generateEngineeringBusinessFactsFromSnapshot(inputFixture({ snapshot }));

  assertResultSuccess(result, "expected fact generation success");

  result.facts.forEach((fact) => {
    assertEqual(fact.metadata["correlationId"], fixtureCorrelationId, "fact correlationId mismatch");
    assertEqual(fact.createdAt, generatedAt, "fact createdAt should come from input.generatedAt");
    assertEqual(fact.observedAt.length > 0, true, "fact observedAt should be populated from the snapshot");
    assertEqual(fact.id.includes(fixtureCorrelationId), true, "fact id should be derived from correlationId");
  });

  const measurementFact = result.facts.find((fact) => fact.type === "measurement_finalized");
  assertEqual(
    measurementFact?.observedAt,
    snapshot.measurement?.occurredAt,
    "measurement fact observedAt should match the snapshot's measurement occurredAt",
  );
});

runTest("BusinessFactsAdapter contract: routes only its own supported source", () => {
  assertEqual(
    engineeringApplicationFactsAdapter.supportedSource,
    engineeringApplicationFactsSource,
    "adapter supportedSource mismatch",
  );
  assertEqual(
    engineeringApplicationFactsAdapter.generateFacts,
    generateEngineeringBusinessFactsFromSnapshot,
    "adapter should route to generateEngineeringBusinessFactsFromSnapshot",
  );
});

runTest(
  "does not reference Decision Engine, Recommendation, Playbook or Action Plan",
  () => {
    const snapshot = fullSnapshotFixture();
    const result = generateEngineeringBusinessFactsFromSnapshot(inputFixture({ snapshot }));
    assertResultSuccess(result, "expected fact generation success");

    const serializedOutput = JSON.stringify(result).toLowerCase();
    const adapterSourceCode = readAdapterSourceFiles();

    [
      "engines/decision",
      "decision-engine",
      "recommendation",
      "playbook",
      "actionplan",
      "action-plan",
      "action_plan",
    ].forEach((forbidden) => {
      assertEqual(
        serializedOutput.includes(forbidden),
        false,
        `unexpected concept in generated facts: ${forbidden}`,
      );
      assertEqual(
        adapterSourceCode.toLowerCase().includes(forbidden),
        false,
        `unexpected concept in adapter source: ${forbidden}`,
      );
    });
  },
);

runTest("does not use Date.now, Math.random or UUID generation anywhere in its own source", () => {
  const adapterSourceCode = readAdapterSourceFiles();

  ["date.now(", "math.random(", "crypto.randomuuid", "uuid()"].forEach((forbidden) => {
    assertEqual(
      adapterSourceCode.toLowerCase().includes(forbidden),
      false,
      `unexpected non-deterministic construct in adapter source: ${forbidden}`,
    );
  });
});

runTest("operational domains do not import this adapter", () => {
  const violations: string[] = [];

  OPERATIONAL_DOMAINS.forEach((domain) => {
    listTsFiles(join(SRC_ROOT, "domain", domain)).forEach((file) => {
      const content = readFileSync(file, "utf8");

      if (
        content.includes("business-facts-generator") ||
        content.includes("engineering-application")
      ) {
        violations.push(file);
      }
    });
  });

  assertEqual(
    violations.length,
    0,
    `expected zero operational-domain imports of the adapter, found: ${violations.join(", ")}`,
  );
});

function fullSnapshotFixture(): EngineeringApplicationSnapshot {
  return createEngineeringApplicationSnapshot({
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
}

function inputFixture(
  overrides: Partial<EngineeringApplicationFactsGenerationInput> = {},
): EngineeringApplicationFactsGenerationInput {
  return {
    source: overrides.source ?? engineeringApplicationFactsSource,
    generatedAt: overrides.generatedAt ?? generatedAt,
    correlationId: overrides.correlationId ?? fixtureCorrelationId,
    metadata: overrides.metadata ?? { origin: "engineering-application-facts-adapter.test" },
    snapshot: "snapshot" in overrides ? overrides.snapshot : fullSnapshotFixture(),
    tenantId: overrides.tenantId === undefined ? tenantId : overrides.tenantId,
    organizationId:
      overrides.organizationId === undefined ? fixtureOrganizationId : overrides.organizationId,
    capability: overrides.capability === undefined ? capability : overrides.capability,
  };
}

function readAdapterSourceFiles(): string {
  return listTsFiles(ADAPTER_DIR)
    .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".fixtures.ts"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

function listTsFiles(dir: string): ReadonlyArray<string> {
  let entries: ReadonlyArray<string>;

  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const files: string[] = [];

  entries.forEach((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listTsFiles(fullPath));
      return;
    }

    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  });

  return files;
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

function assertResultSuccess(
  result: { readonly success: boolean; readonly facts: ReadonlyArray<BusinessFact> },
  message: string,
): asserts result is { readonly success: true; readonly facts: ReadonlyArray<BusinessFact> } {
  if (!result.success) {
    throw new Error(message);
  }
}

function assertResultFailure(
  result: { readonly success: boolean; readonly errors: ReadonlyArray<{ readonly code: string }> },
  message: string,
): asserts result is {
  readonly success: false;
  readonly errors: ReadonlyArray<{ readonly code: string }>;
} {
  if (result.success) {
    throw new Error(message);
  }
}
