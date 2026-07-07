import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BusinessFact } from "../../../business-fact";
import {
  attachedEvidenceFixture,
  approvedWorkflowFixture,
  closedMeasurementWorkspaceFixture,
  finalizedBulletinFixture,
  fixtureActor,
  fixtureCorrelationId,
  fixtureOccurredAt,
  fixtureOrganizationId,
  preparedExportPackageFixture,
} from "../../../business-facts-generator/adapters/engineering-application/engineering-application.fixtures";
import {
  createEngineeringApplicationSnapshot,
  generateEngineeringBusinessFactsFromSnapshot,
} from "../../../business-facts-generator/adapters/engineering-application";
import {
  createEngineeringDecisionCase,
  engineeringDecisionCaseAdapter,
  engineeringDecisionCaseAdapterId,
  engineeringDecisionCaseDefaultActor,
  generateEngineeringDecisionCases,
  summarizeEngineeringDecisionCase,
} from "./index";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(CURRENT_DIR, "../../../..");
const ADAPTER_DIR = resolve(CURRENT_DIR);
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

runTest("generates one decision case per supported engineering fact type", () => {
  const facts = fullEngineeringFactsFixture();
  const result = generateEngineeringDecisionCases({ facts });

  assertEqual(result.summary.totalFactsConsidered, facts.length, "totalFactsConsidered mismatch");
  assertEqual(result.summary.totalDecisionCasesGenerated, 5, "expected exactly 5 decision cases");
  assertEqual(result.summary.totalFactsSkipped, 0, "expected zero facts skipped");
  assertEqual(result.decisionCases.length, 5, "decisionCases length mismatch");

  const factTypes = result.decisionCases.map((snapshot) => snapshot.sourceFactType).sort();
  assertEqual(
    factTypes.join(","),
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

runTest("createEngineeringDecisionCase returns null for an unsupported fact type", () => {
  const fact = buildEngineeringFact({ type: "invoice_issued" });
  assertEqual(createEngineeringDecisionCase(fact), null, "expected null for unsupported type");
});

runTest(
  "createEngineeringDecisionCase returns null for a fact not sourced from engineering-application",
  () => {
    const fact = buildEngineeringFact({ source: "alpha-engenharia.measurement" });
    assertEqual(createEngineeringDecisionCase(fact), null, "expected null for foreign source");
  },
);

runTest("preserves correlationId from the fact into the decision case", () => {
  const fact = buildEngineeringFact({
    metadata: { correlationId: "custom-correlation-42", adapterId: "test" },
  });
  const snapshot = createEngineeringDecisionCase(fact);

  assertNotNull(snapshot, "expected a decision case snapshot");
  assertEqual(snapshot!.correlationId, "custom-correlation-42", "snapshot correlationId mismatch");
  assertEqual(
    snapshot!.decisionCase.metadata["correlationId"],
    "custom-correlation-42",
    "decision case metadata correlationId mismatch",
  );
});

runTest("preserves trace (both the bridge's own trace and the reused case timeline)", () => {
  const fact = buildEngineeringFact();
  const snapshot = createEngineeringDecisionCase(fact);

  assertNotNull(snapshot, "expected a decision case snapshot");
  assertEqual(snapshot!.trace.length, 1, "expected exactly one bridge trace entry");
  assertEqual(
    snapshot!.trace[0]?.action,
    "engineering_decision_case_created",
    "trace action mismatch",
  );
  assertEqual(snapshot!.trace[0]?.occurredAt, fact.observedAt, "trace occurredAt mismatch");
  assertEqual(
    snapshot!.decisionCase.timeline.length,
    1,
    "expected exactly one timeline event from createDecisionCase",
  );
  assertEqual(
    snapshot!.decisionCase.timeline[0]?.type,
    "decision_case_created",
    "timeline event type mismatch",
  );
});

runTest("default actor is deterministic when the caller supplies none", () => {
  const fact = buildEngineeringFact();
  const snapshot = createEngineeringDecisionCase(fact);

  assertNotNull(snapshot, "expected a decision case snapshot");
  assertEqual(
    snapshot!.trace[0]?.actor,
    engineeringDecisionCaseDefaultActor,
    "expected the fixed bridge actor",
  );
  assertEqual(
    snapshot!.decisionCase.timeline[0]?.actor,
    engineeringDecisionCaseDefaultActor,
    "expected the fixed bridge actor on the reused timeline event too",
  );
});

runTest("caller-supplied actor overrides the default", () => {
  const fact = buildEngineeringFact();
  const snapshot = createEngineeringDecisionCase(fact, { actor: "quality-office" });

  assertNotNull(snapshot, "expected a decision case snapshot");
  assertEqual(snapshot!.trace[0]?.actor, "quality-office", "actor override mismatch");
});

runTest("deterministic output for identical input", () => {
  const fact = buildEngineeringFact();
  const first = JSON.stringify(createEngineeringDecisionCase(fact));
  const second = JSON.stringify(createEngineeringDecisionCase(fact));

  assertEqual(first, second, "expected deterministic decision case output");
});

runTest("generateEngineeringDecisionCases tracks skipped facts alongside generated cases", () => {
  const facts = [
    buildEngineeringFact({ id: "fact-1", type: "measurement_finalized" }),
    buildEngineeringFact({
      id: "fact-2",
      type: "invoice_issued",
      source: "alpha-engenharia.invoice",
    }),
    buildEngineeringFact({ id: "fact-3", type: "approval_completed" }),
  ];
  const result = generateEngineeringDecisionCases({ facts });

  assertEqual(result.summary.totalFactsConsidered, 3, "totalFactsConsidered mismatch");
  assertEqual(result.summary.totalDecisionCasesGenerated, 2, "totalDecisionCasesGenerated mismatch");
  assertEqual(result.summary.totalFactsSkipped, 1, "totalFactsSkipped mismatch");
});

runTest("summarizeEngineeringDecisionCase recomputes the single-item summary", () => {
  const fact = buildEngineeringFact();
  const snapshot = createEngineeringDecisionCase(fact);
  assertNotNull(snapshot, "expected a decision case snapshot");

  const summary = summarizeEngineeringDecisionCase(snapshot!);

  assertEqual(summary.totalDecisionCasesGenerated, 1, "totalDecisionCasesGenerated mismatch");
  assertEqual(summary.totalFactsSkipped, 0, "totalFactsSkipped mismatch");
  assertEqual(
    summary.caseCountByFactType[snapshot!.sourceFactType],
    1,
    "caseCountByFactType mismatch",
  );
});

runTest("EngineeringDecisionCaseAdapter descriptor is wired to the generation function", () => {
  assertEqual(
    engineeringDecisionCaseAdapter.adapterId,
    engineeringDecisionCaseAdapterId,
    "adapterId mismatch",
  );
  assertEqual(
    engineeringDecisionCaseAdapter.generate,
    generateEngineeringDecisionCases,
    "adapter should route to generateEngineeringDecisionCases",
  );
  assertEqual(
    engineeringDecisionCaseAdapter.supportedFactTypes.includes("measurement_finalized"),
    true,
    "supportedFactTypes should include measurement_finalized",
  );
});

runTest(
  "does not reference the Decision Engine, Recommendation, Playbook or Action Plan generation",
  () => {
    const facts = fullEngineeringFactsFixture();
    const result = generateEngineeringDecisionCases({ facts });
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
        `unexpected concept in generated output: ${forbidden}`,
      );
      assertEqual(
        adapterSourceCode.toLowerCase().includes(forbidden),
        false,
        `unexpected concept in adapter source: ${forbidden}`,
      );
    });

    const result0 = result.decisionCases[0];
    assertNotNull(result0, "expected at least one decision case");
    assertEqual(result0!.decisionCase.artifacts.length, 0, "artifacts should always be empty");
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

runTest("Engineering (operational domains and the facts adapter) still does not import Decision", () => {
  const violations: string[] = [];
  const forbiddenMarkers = ["decision-case", "decision-portfolio", "/decision\"", "engines/decision"];

  const foldersToScan = [
    ...OPERATIONAL_DOMAINS.map((domain) => join(SRC_ROOT, "domain", domain)),
    join(SRC_ROOT, "domain", "business-facts-generator", "adapters", "engineering-application"),
  ];

  foldersToScan.forEach((folder) => {
    listTsFiles(folder)
      .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".fixtures.ts"))
      .forEach((file) => {
        const content = readFileSync(file, "utf8").toLowerCase();

        if (forbiddenMarkers.some((marker) => content.includes(marker))) {
          violations.push(file);
        }
      });
  });

  assertEqual(
    violations.length,
    0,
    `expected zero Decision references in Engineering, found: ${violations.join(", ")}`,
  );
});

function fullEngineeringFactsFixture(): ReadonlyArray<BusinessFact> {
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

  const result = generateEngineeringBusinessFactsFromSnapshot({
    source: "engineering-application.snapshot",
    generatedAt: "2026-06-21T09:00:00Z",
    correlationId: fixtureCorrelationId,
    metadata: {},
    snapshot,
    tenantId: "tenant-alpha-engenharia",
    organizationId: fixtureOrganizationId,
    capability: "engineering-application",
  });

  if (!result.success) {
    throw new Error(`fixture setup failed: ${JSON.stringify(result.errors)}`);
  }

  return result.facts;
}

function buildEngineeringFact(overrides: Partial<BusinessFact> = {}): BusinessFact {
  return {
    id:
      overrides.id ??
      "engineering-facts-correlation-001:measurement-finalized:measurement-workspace-fixture-1",
    tenantId: overrides.tenantId ?? "tenant-alpha-engenharia",
    organizationId: overrides.organizationId ?? fixtureOrganizationId,
    capability: overrides.capability ?? "engineering-application",
    source: overrides.source ?? "engineering-application.measurement-workspace",
    sourceReference: overrides.sourceReference ?? "measurement-workspace-fixture-1",
    category: overrides.category ?? "operational",
    type: overrides.type ?? "measurement_finalized",
    label: overrides.label ?? "Engineering measurement finalized",
    description:
      overrides.description ??
      "Measurement workspace closed with finalized quantities and value.",
    value: overrides.value ?? 1500,
    unit: overrides.unit ?? "currency",
    confidence: overrides.confidence ?? 100,
    observedAt: overrides.observedAt ?? fixtureOccurredAt,
    metadata:
      overrides.metadata ??
      {
        correlationId: fixtureCorrelationId,
        adapterId: "engineering-application-facts-adapter",
      },
    createdAt: overrides.createdAt ?? "2026-06-21T09:00:00Z",
  };
}

function readAdapterSourceFiles(): string {
  return listTsFiles(ADAPTER_DIR)
    .filter((file) => !file.endsWith(".test.ts"))
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

function assertNotNull<T>(value: T | null, message: string): void {
  if (value === null) {
    throw new Error(message);
  }
}
