import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
import {
  EngineeringKpiUnit,
  EngineeringMilestoneStatus,
  EngineeringProjectContextStatus,
  EngineeringWorkFrontStatus,
  addEngineeringProjectMilestone,
  addEngineeringSegment,
  addEngineeringStructure,
  addEngineeringWorkFront,
  advanceEngineeringProjectContextStatus,
  createEngineeringProjectContext,
  summarizeEngineeringProjectContext,
  type CreateEngineeringProjectContextInput,
  type EngineeringProjectContext,
  type EngineeringProjectContextResult,
} from "./index";

const projectContextId = "project-context-lagoa-do-arroz-001";
const engineeringContractId = "contract-lagoa-do-arroz-001";
const projectCode = "PRJ-LAGOA-DO-ARROZ";
const projectName = "Recuperacao e Modernizacao da Barragem Lagoa do Arroz";
const actor = "engineer-marcos";
const occurredAt = "2026-06-15T10:30:00Z";
const correlationId = "engineering-project-context-correlation-001";
const createdBy = "field-office";
const sourceSystem = "engineering-os";

runTest("valid creation", () => {
  const result = createEngineeringProjectContext(createProjectContextInputFixture());

  assertSuccess(result, "expected project context creation success");
  assertEqual(result.projectContext.id, projectContextId, "id mismatch");
  assertEqual(
    result.projectContext.engineeringContractId,
    engineeringContractId,
    "engineeringContractId mismatch",
  );
  assertEqual(result.projectContext.projectCode, projectCode, "projectCode mismatch");
  assertEqual(
    result.projectContext.status,
    EngineeringProjectContextStatus.Draft,
    "initial status mismatch",
  );
  assertEqual(result.projectContext.milestones.length, 1, "milestones count mismatch");
  assertEqual(result.projectContext.workFronts.length, 1, "workFronts count mismatch");
  assertEqual(result.projectContext.segments.length, 1, "segments count mismatch");
  assertEqual(result.projectContext.structures.length, 1, "structures count mismatch");
  assertEqual(result.projectContext.kpis.length, 1, "kpis count mismatch");
  assertEqual(
    result.projectContext.baselineSchedule?.startDate,
    "2026-06-01",
    "baselineSchedule startDate mismatch",
  );
  assertEqual(
    result.projectContext.scurveReference,
    "CURVA S_MED-08_R_00",
    "scurveReference mismatch",
  );
});

runTest("rejects missing id", () => {
  const result = createEngineeringProjectContext(createProjectContextInputFixture({ id: "" }));

  assertFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejects missing engineeringContractId", () => {
  const result = createEngineeringProjectContext(
    createProjectContextInputFixture({ engineeringContractId: "" }),
  );

  assertFailure(result, "expected missing engineeringContractId failure");
  assertEqual(
    result.errors[0]?.code,
    "missing_engineering_contract_id",
    "error code mismatch",
  );
});

runTest("rejects missing projectCode", () => {
  const result = createEngineeringProjectContext(
    createProjectContextInputFixture({ projectCode: "" }),
  );

  assertFailure(result, "expected missing projectCode failure");
  assertEqual(result.errors[0]?.code, "missing_project_code", "error code mismatch");
});

runTest("rejects missing projectName", () => {
  const result = createEngineeringProjectContext(
    createProjectContextInputFixture({ projectName: "" }),
  );

  assertFailure(result, "expected missing projectName failure");
  assertEqual(result.errors[0]?.code, "missing_project_name", "error code mismatch");
});

runTest("rejects missing objectDescription", () => {
  const result = createEngineeringProjectContext(
    createProjectContextInputFixture({ objectDescription: "" }),
  );

  assertFailure(result, "expected missing objectDescription failure");
  assertEqual(result.errors[0]?.code, "missing_object_description", "error code mismatch");
});

runTest("rejects missing city", () => {
  const result = createEngineeringProjectContext(createProjectContextInputFixture({ city: "" }));

  assertFailure(result, "expected missing city failure");
  assertEqual(result.errors[0]?.code, "missing_city", "error code mismatch");
});

runTest("rejects missing state", () => {
  const result = createEngineeringProjectContext(
    createProjectContextInputFixture({ state: "" }),
  );

  assertFailure(result, "expected missing state failure");
  assertEqual(result.errors[0]?.code, "missing_state", "error code mismatch");
});

runTest("rejects incoherent milestone date (Completed without actualDate)", () => {
  const result = createEngineeringProjectContext(
    createProjectContextInputFixture({
      milestones: [
        {
          id: "milestone-1",
          name: "Assinatura do contrato",
          description: "Marco de assinatura.",
          plannedDate: "2026-01-01",
          status: EngineeringMilestoneStatus.Completed,
          actualDate: null,
        },
      ],
    }),
  );

  assertFailure(result, "expected incoherent milestone date failure");
  assertEqual(result.errors[0]?.code, "incoherent_milestone_date", "error code mismatch");
});

runTest("rejects incoherent milestone date (Pending with actualDate)", () => {
  const result = createEngineeringProjectContext(
    createProjectContextInputFixture({
      milestones: [
        {
          id: "milestone-1",
          name: "Assinatura do contrato",
          description: "Marco de assinatura.",
          plannedDate: "2026-01-01",
          status: EngineeringMilestoneStatus.Pending,
          actualDate: "2026-01-05",
        },
      ],
    }),
  );

  assertFailure(result, "expected incoherent milestone date failure");
  assertEqual(result.errors[0]?.code, "incoherent_milestone_date", "error code mismatch");
});

runTest("rejects incoherent baseline schedule (endDate before startDate)", () => {
  const result = createEngineeringProjectContext(
    createProjectContextInputFixture({
      baselineSchedule: { startDate: "2026-12-01", endDate: "2026-01-01" },
    }),
  );

  assertFailure(result, "expected incoherent baseline schedule failure");
  assertEqual(result.errors[0]?.code, "incoherent_baseline_schedule", "error code mismatch");
});

runTest("rejects negative KPI value", () => {
  const result = createEngineeringProjectContext(
    createProjectContextInputFixture({
      kpis: [
        { code: "physical_advance", label: "Avanco fisico", value: -1, unit: EngineeringKpiUnit.Percentage },
      ],
    }),
  );

  assertFailure(result, "expected negative KPI value failure");
  assertEqual(result.errors[0]?.code, "negative_kpi_value", "error code mismatch");
});

runTest("rejects KPI percentage above 100", () => {
  const result = createEngineeringProjectContext(
    createProjectContextInputFixture({
      kpis: [
        { code: "physical_advance", label: "Avanco fisico", value: 150, unit: EngineeringKpiUnit.Percentage },
      ],
    }),
  );

  assertFailure(result, "expected invalid KPI percentage failure");
  assertEqual(result.errors[0]?.code, "invalid_kpi_percentage", "error code mismatch");
});

runTest("accepts a percentage KPI exactly at the 0-100 boundaries", () => {
  const zero = createEngineeringProjectContext(
    createProjectContextInputFixture({
      kpis: [{ code: "physical_advance", label: "Avanco fisico", value: 0, unit: EngineeringKpiUnit.Percentage }],
    }),
  );
  assertSuccess(zero, "expected success at 0%");

  const hundred = createEngineeringProjectContext(
    createProjectContextInputFixture({
      kpis: [{ code: "physical_advance", label: "Avanco fisico", value: 100, unit: EngineeringKpiUnit.Percentage }],
    }),
  );
  assertSuccess(hundred, "expected success at 100%");
});

runTest("rejects duplicate milestone id within the creation batch", () => {
  const result = createEngineeringProjectContext(
    createProjectContextInputFixture({
      milestones: [
        milestoneInputFixture({ id: "milestone-1" }),
        milestoneInputFixture({ id: "milestone-1" }),
      ],
    }),
  );

  assertFailure(result, "expected duplicate milestone id failure");
  assertEqual(result.errors[0]?.code, "duplicate_milestone_id", "error code mismatch");
});

runTest("rejects a segment referencing an unknown work front", () => {
  const result = createEngineeringProjectContext(
    createProjectContextInputFixture({
      workFronts: [],
      segments: [segmentInputFixture({ workFrontId: "unknown-work-front" })],
    }),
  );

  assertFailure(result, "expected unknown work front reference failure");
  assertEqual(result.errors[0]?.code, "unknown_work_front_reference", "error code mismatch");
});

runTest("rejects a structure referencing an unknown segment", () => {
  const result = createEngineeringProjectContext(
    createProjectContextInputFixture({
      segments: [],
      structures: [structureInputFixture({ segmentId: "unknown-segment" })],
    }),
  );

  assertFailure(result, "expected unknown segment reference failure");
  assertEqual(result.errors[0]?.code, "unknown_segment_reference", "error code mismatch");
});

runTest("adds a milestone and grows both timeline and trace", () => {
  const projectContext = createProjectContextFixture();
  const result = addEngineeringProjectMilestone({
    projectContext,
    milestone: milestoneInputFixture({ id: "milestone-2" }),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add milestone success");
  assertEqual(result.projectContext.milestones.length, 2, "milestones count mismatch after add");
  assertEqual(
    result.projectContext.timeline.length,
    2,
    "timeline should grow when a milestone is added",
  );
  assertEqual(result.projectContext.timeline[1]?.type, "milestone_added", "timeline type mismatch");
  assertEqual(
    result.projectContext.trace.length,
    2,
    "trace should grow when a milestone is added",
  );
});

runTest("rejects adding a duplicate milestone id", () => {
  const projectContext = createProjectContextFixture();
  const result = addEngineeringProjectMilestone({
    projectContext,
    milestone: milestoneInputFixture(),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate milestone id failure on add");
  assertEqual(result.errors[0]?.code, "duplicate_milestone_id", "error code mismatch");
});

runTest("adds a work front (grows trace, not timeline)", () => {
  const projectContext = createProjectContextFixture();
  const result = addEngineeringWorkFront({
    projectContext,
    workFront: workFrontInputFixture({ id: "work-front-2" }),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add work front success");
  assertEqual(result.projectContext.workFronts.length, 2, "workFronts count mismatch after add");
  assertEqual(
    result.projectContext.timeline.length,
    1,
    "timeline should not grow when a work front is added (structural change, not a temporal milestone)",
  );
  assertEqual(result.projectContext.trace.length, 2, "trace should grow when a work front is added");
});

runTest("rejects adding a duplicate work front id", () => {
  const projectContext = createProjectContextFixture();
  const result = addEngineeringWorkFront({
    projectContext,
    workFront: workFrontInputFixture(),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate work front id failure on add");
  assertEqual(result.errors[0]?.code, "duplicate_work_front_id", "error code mismatch");
});

runTest("adds a segment linked to an existing work front", () => {
  const projectContext = createProjectContextFixture();
  const result = addEngineeringSegment({
    projectContext,
    segment: segmentInputFixture({ id: "segment-2", workFrontId: "work-front-1" }),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add segment success");
  assertEqual(result.projectContext.segments.length, 2, "segments count mismatch after add");
  assertEqual(
    result.projectContext.segments[1]?.workFrontId,
    "work-front-1",
    "segment work front link mismatch",
  );
});

runTest("rejects adding a segment referencing an unknown work front", () => {
  const projectContext = createProjectContextFixture();
  const result = addEngineeringSegment({
    projectContext,
    segment: segmentInputFixture({ id: "segment-2", workFrontId: "unknown-work-front" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected unknown work front reference failure on add");
  assertEqual(result.errors[0]?.code, "unknown_work_front_reference", "error code mismatch");
});

runTest("rejects adding a duplicate segment id", () => {
  const projectContext = createProjectContextFixture();
  const result = addEngineeringSegment({
    projectContext,
    segment: segmentInputFixture(),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate segment id failure on add");
  assertEqual(result.errors[0]?.code, "duplicate_segment_id", "error code mismatch");
});

runTest("adds a structure linked to an existing segment", () => {
  const projectContext = createProjectContextFixture();
  const result = addEngineeringStructure({
    projectContext,
    structure: structureInputFixture({ id: "structure-2", segmentId: "segment-1" }),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add structure success");
  assertEqual(result.projectContext.structures.length, 2, "structures count mismatch after add");
});

runTest("rejects adding a structure referencing an unknown segment", () => {
  const projectContext = createProjectContextFixture();
  const result = addEngineeringStructure({
    projectContext,
    structure: structureInputFixture({ id: "structure-2", segmentId: "unknown-segment" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected unknown segment reference failure on add");
  assertEqual(result.errors[0]?.code, "unknown_segment_reference", "error code mismatch");
});

runTest("rejects adding a duplicate structure id", () => {
  const projectContext = createProjectContextFixture();
  const result = addEngineeringStructure({
    projectContext,
    structure: structureInputFixture(),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate structure id failure on add");
  assertEqual(result.errors[0]?.code, "duplicate_structure_id", "error code mismatch");
});

runTest("blocks mutation (add milestone) on a terminal project context", () => {
  const projectContext: EngineeringProjectContext = {
    ...createProjectContextFixture(),
    status: EngineeringProjectContextStatus.Completed,
  };

  const result = addEngineeringProjectMilestone({
    projectContext,
    milestone: milestoneInputFixture({ id: "milestone-2" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected terminal block on add milestone");
  assertEqual(result.errors[0]?.code, "project_context_terminal", "error code mismatch");
});

runTest("all valid status transitions succeed", () => {
  const validTransitions: ReadonlyArray<
    readonly [EngineeringProjectContextStatus, EngineeringProjectContextStatus]
  > = [
    [EngineeringProjectContextStatus.Draft, EngineeringProjectContextStatus.Planned],
    [EngineeringProjectContextStatus.Draft, EngineeringProjectContextStatus.Cancelled],
    [EngineeringProjectContextStatus.Planned, EngineeringProjectContextStatus.InExecution],
    [EngineeringProjectContextStatus.Planned, EngineeringProjectContextStatus.Cancelled],
    [EngineeringProjectContextStatus.InExecution, EngineeringProjectContextStatus.Suspended],
    [EngineeringProjectContextStatus.InExecution, EngineeringProjectContextStatus.Completed],
    [EngineeringProjectContextStatus.InExecution, EngineeringProjectContextStatus.Cancelled],
    [EngineeringProjectContextStatus.Suspended, EngineeringProjectContextStatus.InExecution],
    [EngineeringProjectContextStatus.Suspended, EngineeringProjectContextStatus.Cancelled],
  ];

  validTransitions.forEach(([fromStatus, toStatus]) => {
    const projectContext: EngineeringProjectContext = {
      ...createProjectContextFixture(),
      status: fromStatus,
    };
    const result = advanceEngineeringProjectContextStatus({
      projectContext,
      toStatus,
      actor,
      occurredAt,
    });

    assertSuccess(result, `expected ${fromStatus} to ${toStatus} success`);
    assertEqual(result.projectContext.status, toStatus, "transition status mismatch");
  });
});

runTest("rejects invalid status transitions", () => {
  const projectContext = createProjectContextFixture();
  const result = advanceEngineeringProjectContextStatus({
    projectContext,
    toStatus: EngineeringProjectContextStatus.Completed,
    actor,
    occurredAt,
  });

  assertFailure(result, "expected invalid transition failure (Draft -> Completed)");
  assertEqual(
    result.errors[0]?.code,
    "invalid_project_context_status_transition",
    "error code mismatch",
  );
});

runTest("blocks status transition from a terminal status", () => {
  const projectContext: EngineeringProjectContext = {
    ...createProjectContextFixture(),
    status: EngineeringProjectContextStatus.Cancelled,
  };
  const result = advanceEngineeringProjectContextStatus({
    projectContext,
    toStatus: EngineeringProjectContextStatus.Planned,
    actor,
    occurredAt,
  });

  assertFailure(result, "expected terminal block on status transition");
  assertEqual(result.errors[0]?.code, "project_context_terminal", "error code mismatch");
});

runTest("summarizeEngineeringProjectContext is deterministic and matches project state", () => {
  const projectContext = createProjectContextFixture();
  const summary = summarizeEngineeringProjectContext(projectContext);

  assertEqual(summary.totalMilestones, 1, "totalMilestones mismatch");
  assertEqual(summary.completedMilestones, 1, "completedMilestones mismatch");
  assertEqual(summary.delayedMilestones, 0, "delayedMilestones mismatch");
  assertEqual(summary.totalWorkFronts, 1, "totalWorkFronts mismatch");
  assertEqual(summary.totalSegments, 1, "totalSegments mismatch");
  assertEqual(summary.totalStructures, 1, "totalStructures mismatch");
  assertEqual(summary.totalKpis, 1, "totalKpis mismatch");
});

runTest("immutable output", () => {
  const result = createEngineeringProjectContext(createProjectContextInputFixture());

  assertSuccess(result, "expected project context creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.projectContext), true, "projectContext should be frozen");
  assertEqual(Object.isFrozen(result.projectContext.milestones), true, "milestones should be frozen");
  assertEqual(Object.isFrozen(result.projectContext.workFronts), true, "workFronts should be frozen");
  assertEqual(Object.isFrozen(result.projectContext.segments), true, "segments should be frozen");
  assertEqual(Object.isFrozen(result.projectContext.structures), true, "structures should be frozen");
  assertEqual(Object.isFrozen(result.projectContext.kpis), true, "kpis should be frozen");
  assertEqual(Object.isFrozen(result.projectContext.timeline), true, "timeline should be frozen");
  assertEqual(Object.isFrozen(result.projectContext.trace), true, "trace should be frozen");
  assertEqual(Object.isFrozen(result.projectContext.metadata), true, "metadata should be frozen");
});

runTest("deterministic output for identical input", () => {
  const input = createProjectContextInputFixture();
  const first = JSON.stringify(createEngineeringProjectContext(input));
  const second = JSON.stringify(createEngineeringProjectContext(input));

  assertEqual(first, second, "expected deterministic project context creation output");
});

runTest("deterministic output across mutations", () => {
  const buildMutated = () => {
    const projectContext = createProjectContextFixture();
    const withMilestone = addEngineeringProjectMilestone({
      projectContext,
      milestone: milestoneInputFixture({ id: "milestone-2" }),
      actor,
      occurredAt,
    });
    assertSuccess(withMilestone, "expected add milestone success");
    return withMilestone;
  };

  const first = JSON.stringify(buildMutated());
  const second = JSON.stringify(buildMutated());
  assertEqual(first, second, "expected deterministic mutation output");
});

runTest("preserves traceability (correlationId/createdBy/sourceSystem in metadata)", () => {
  const result = createEngineeringProjectContext(createProjectContextInputFixture());

  assertSuccess(result, "expected project context creation success");
  assertEqual(
    result.projectContext.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
  assertEqual(result.projectContext.metadata["createdBy"], createdBy, "created by mismatch");
  assertEqual(
    result.projectContext.metadata["sourceSystem"],
    sourceSystem,
    "source system mismatch",
  );
  assertEqual(result.projectContext.trace[0]?.actor, actor, "trace actor mismatch");
  assertEqual(result.projectContext.trace[0]?.occurredAt, occurredAt, "trace occurredAt mismatch");
});

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourceCode = readDomainSourceFiles();
  const lowerSourceCode = sourceCode.toLowerCase();

  [
    "date.now(",
    "math.random(",
    "crypto.randomuuid",
    "uuid()",
    "measurement-workspace",
    "approval-workflow",
    "bulletin-generator",
    "export-engine",
    "template-engine",
    "business-fact",
    "decision-case",
    "engines/decision",
    "\"fs\"",
    "'fs'",
    "node:fs",
    "\"path\"",
    "'path'",
    "node:path",
    "xlsx",
    "pdf-lib",
    "pdfkit",
  ].forEach((forbidden) => {
    assertEqual(
      lowerSourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in domain source: ${forbidden}`,
    );
  });
});

function createProjectContextFixture(): EngineeringProjectContext {
  const result = createEngineeringProjectContext(createProjectContextInputFixture());
  assertSuccess(result, "expected project context fixture creation");
  return result.projectContext;
}

function createProjectContextInputFixture(
  overrides: Partial<CreateEngineeringProjectContextInput> = {},
): CreateEngineeringProjectContextInput {
  return {
    id: overrides.id ?? projectContextId,
    engineeringContractId: overrides.engineeringContractId ?? engineeringContractId,
    projectCode: overrides.projectCode ?? projectCode,
    projectName: overrides.projectName ?? projectName,
    objectDescription:
      overrides.objectDescription ??
      "Recuperacao e modernizacao da barragem Lagoa do Arroz no municipio de Cajazeiras, no estado da Paraiba.",
    location: overrides.location === undefined ? "Margem direita do Rio Piancao" : overrides.location,
    city: overrides.city ?? "Cajazeiras",
    state: overrides.state ?? "PB",
    technicalDiscipline:
      overrides.technicalDiscipline === undefined
        ? "Barragens e Obras Hidraulicas"
        : overrides.technicalDiscipline,
    executionMethod:
      overrides.executionMethod === undefined
        ? "Empreitada por Preco Global"
        : overrides.executionMethod,
    baselineSchedule:
      overrides.baselineSchedule === undefined
        ? { startDate: "2026-06-01", endDate: "2026-12-31", durationMonths: 7 }
        : overrides.baselineSchedule,
    scurveReference:
      overrides.scurveReference === undefined ? "CURVA S_MED-08_R_00" : overrides.scurveReference,
    milestones: overrides.milestones ?? [milestoneInputFixture()],
    workFronts: overrides.workFronts ?? [workFrontInputFixture()],
    segments: overrides.segments ?? [segmentInputFixture()],
    structures: overrides.structures ?? [structureInputFixture()],
    kpis:
      overrides.kpis ??
      [{ code: "physical_advance", label: "Avanco fisico", value: 42.5, unit: EngineeringKpiUnit.Percentage }],
    actor: overrides.actor ?? actor,
    occurredAt: overrides.occurredAt ?? occurredAt,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? { source: "engineering-project-context" },
  };
}

function milestoneInputFixture(
  overrides: Partial<CreateEngineeringProjectContextInput["milestones"] extends ReadonlyArray<infer T> | null | undefined ? T : never> = {},
) {
  return {
    id: overrides.id ?? "milestone-1",
    name: overrides.name ?? "Assinatura do contrato",
    description: overrides.description ?? "Marco de assinatura do contrato administrativo.",
    plannedDate: overrides.plannedDate ?? "2026-01-01",
    actualDate: overrides.actualDate === undefined ? "2026-01-01" : overrides.actualDate,
    status: overrides.status ?? EngineeringMilestoneStatus.Completed,
    metadata: overrides.metadata ?? {},
  };
}

function workFrontInputFixture(
  overrides: Partial<CreateEngineeringProjectContextInput["workFronts"] extends ReadonlyArray<infer T> | null | undefined ? T : never> = {},
) {
  return {
    id: overrides.id ?? "work-front-1",
    code: overrides.code ?? "WF-01",
    name: overrides.name ?? "Terraplenagem",
    description: overrides.description ?? "Frente de terraplenagem da barragem.",
    status: overrides.status ?? EngineeringWorkFrontStatus.NotStarted,
    metadata: overrides.metadata ?? {},
  };
}

function segmentInputFixture(
  overrides: Partial<CreateEngineeringProjectContextInput["segments"] extends ReadonlyArray<infer T> | null | undefined ? T : never> = {},
) {
  return {
    id: overrides.id ?? "segment-1",
    workFrontId: overrides.workFrontId === undefined ? "work-front-1" : overrides.workFrontId,
    code: overrides.code ?? "TR-01",
    name: overrides.name ?? "Trecho principal da barragem",
    startReference: overrides.startReference ?? "eixo 0+000",
    endReference: overrides.endReference ?? "eixo 1+200",
    extensionMeters: overrides.extensionMeters === undefined ? 1200 : overrides.extensionMeters,
    metadata: overrides.metadata ?? {},
  };
}

function structureInputFixture(
  overrides: Partial<CreateEngineeringProjectContextInput["structures"] extends ReadonlyArray<infer T> | null | undefined ? T : never> = {},
) {
  return {
    id: overrides.id ?? "structure-1",
    segmentId: overrides.segmentId === undefined ? "segment-1" : overrides.segmentId,
    code: overrides.code ?? "EST-01",
    name: overrides.name ?? "Vertedouro",
    structureType: overrides.structureType ?? "vertedouro",
    metadata: overrides.metadata ?? {},
  };
}

function readDomainSourceFiles(): string {
  const domainDir = resolve(CURRENT_DIR);
  return listTsFiles(domainDir)
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

function assertSuccess(
  result: EngineeringProjectContextResult,
  message: string,
): asserts result is Extract<EngineeringProjectContextResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertFailure(
  result: EngineeringProjectContextResult,
  message: string,
): asserts result is Extract<EngineeringProjectContextResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
