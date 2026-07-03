import type {
  AddEngineeringProjectMilestoneInput,
  AddEngineeringSegmentInput,
  AddEngineeringStructureInput,
  AddEngineeringWorkFrontInput,
  AdvanceEngineeringProjectContextStatusInput,
  CreateEngineeringProjectContextInput,
  EngineeringBaselineSchedule,
  EngineeringBaselineScheduleInput,
  EngineeringMilestone,
  EngineeringMilestoneInput,
  EngineeringProjectContext,
  EngineeringProjectContextError,
  EngineeringProjectContextFailure,
  EngineeringProjectContextMetadata,
  EngineeringProjectContextResult,
  EngineeringProjectContextSuccess,
  EngineeringProjectContextSummary,
  EngineeringProjectContextTrace,
  EngineeringProjectContextTimelineEvent,
  EngineeringProjectKpi,
  EngineeringProjectKpiInput,
  EngineeringSegment,
  EngineeringSegmentInput,
  EngineeringStructure,
  EngineeringStructureInput,
  EngineeringWorkFront,
  EngineeringWorkFrontInput,
} from "./engineering-project-context.types";
import {
  EngineeringKpiUnit,
  EngineeringMilestoneStatus,
  EngineeringProjectContextStatus,
  EngineeringWorkFrontStatus,
} from "./engineering-project-context.types";

export function createEngineeringProjectContext(
  input: CreateEngineeringProjectContextInput,
): EngineeringProjectContextResult {
  const metadata = createContextMetadata(input);
  const milestoneInputs = input.milestones ?? [];
  const workFrontInputs = input.workFronts ?? [];
  const segmentInputs = input.segments ?? [];
  const structureInputs = input.structures ?? [];
  const kpiInputs = input.kpis ?? [];

  const errors = [
    ...validateContextShell(input, metadata),
    ...validateMilestoneBatch(milestoneInputs, metadata),
    ...validateWorkFrontBatch(workFrontInputs, metadata),
    ...validateSegmentBatch(segmentInputs, workFrontInputs, metadata),
    ...validateStructureBatch(structureInputs, segmentInputs, metadata),
    ...validateKpiBatch(kpiInputs, metadata),
    ...validateBaselineSchedule(input.baselineSchedule, metadata),
  ];

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const projectContext: EngineeringProjectContext = {
    id: input.id,
    engineeringContractId: input.engineeringContractId,
    projectCode: input.projectCode,
    projectName: input.projectName,
    objectDescription: input.objectDescription,
    location: input.location ?? null,
    city: input.city,
    state: input.state,
    technicalDiscipline: input.technicalDiscipline ?? null,
    executionMethod: input.executionMethod ?? null,
    status: EngineeringProjectContextStatus.Draft,
    baselineSchedule: buildBaselineSchedule(input.baselineSchedule),
    scurveReference: input.scurveReference ?? null,
    milestones: buildMilestones(milestoneInputs),
    workFronts: buildWorkFronts(workFrontInputs),
    segments: buildSegments(segmentInputs),
    structures: buildStructures(structureInputs),
    kpis: buildKpis(kpiInputs),
    timeline: [
      createTimelineEvent(
        "project_context_created",
        input.occurredAt,
        `Engineering project context ${input.projectCode} created under contract ${input.engineeringContractId}.`,
        metadata,
      ),
    ],
    trace: [
      createTraceEntry(
        "project_context_created",
        input.actor,
        input.occurredAt,
        `Engineering project context ${input.id} created.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<EngineeringProjectContextSuccess>({
    success: true,
    projectContext,
    errors: [],
    warnings: [],
    metadata,
  });
}

export function advanceEngineeringProjectContextStatus(
  input: AdvanceEngineeringProjectContextStatusInput,
): EngineeringProjectContextResult {
  const metadata = createMutationMetadata(input.projectContext, input.metadata);
  const fromStatus = input.projectContext.status;

  if (isTerminalStatus(fromStatus)) {
    return failureResult(
      [
        createContextError(
          "project_context_terminal",
          "status",
          `Cannot transition project context from terminal status ${fromStatus}.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  if (!canAdvanceStatus(fromStatus, input.toStatus)) {
    return failureResult(
      [
        createContextError(
          "invalid_project_context_status_transition",
          "status",
          `Cannot transition project context from ${fromStatus} to ${input.toStatus}.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  return successWithUpdate(
    input.projectContext,
    { status: input.toStatus },
    createTimelineEvent(
      timelineEventTypeForStatus(input.toStatus),
      input.occurredAt,
      `Project context ${input.projectContext.projectCode} moved from ${fromStatus} to ${input.toStatus}.`,
      metadata,
    ),
    createTraceEntry(
      "project_context_status_advanced",
      input.actor,
      input.occurredAt,
      `Project context status advanced from ${fromStatus} to ${input.toStatus}.`,
      metadata,
    ),
    metadata,
  );
}

export function addEngineeringProjectMilestone(
  input: AddEngineeringProjectMilestoneInput,
): EngineeringProjectContextResult {
  const metadata = createMutationMetadata(input.projectContext, input.metadata);
  const errors = validateMutable(input.projectContext, metadata);

  errors.push(...validateSingleMilestone(input.milestone, metadata));

  if (input.projectContext.milestones.some((existing) => existing.id === input.milestone.id)) {
    errors.push(
      createContextError(
        "duplicate_milestone_id",
        "milestone.id",
        `Milestone id ${input.milestone.id} already exists in this project context.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const milestones = [...input.projectContext.milestones, buildMilestone(input.milestone)];

  return successWithUpdate(
    input.projectContext,
    { milestones },
    createTimelineEvent(
      "milestone_added",
      input.occurredAt,
      `Milestone "${input.milestone.name}" added to project context ${input.projectContext.projectCode}.`,
      metadata,
    ),
    createTraceEntry(
      "milestone_added",
      input.actor,
      input.occurredAt,
      `Milestone ${input.milestone.id} added.`,
      metadata,
    ),
    metadata,
  );
}

export function addEngineeringWorkFront(
  input: AddEngineeringWorkFrontInput,
): EngineeringProjectContextResult {
  const metadata = createMutationMetadata(input.projectContext, input.metadata);
  const errors = validateMutable(input.projectContext, metadata);

  errors.push(...validateSingleWorkFront(input.workFront, metadata));

  if (input.projectContext.workFronts.some((existing) => existing.id === input.workFront.id)) {
    errors.push(
      createContextError(
        "duplicate_work_front_id",
        "workFront.id",
        `Work front id ${input.workFront.id} already exists in this project context.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const workFronts = [...input.projectContext.workFronts, buildWorkFront(input.workFront)];

  return successWithUpdate(
    input.projectContext,
    { workFronts },
    null,
    createTraceEntry(
      "work_front_added",
      input.actor,
      input.occurredAt,
      `Work front ${input.workFront.id} added.`,
      metadata,
    ),
    metadata,
  );
}

export function addEngineeringSegment(
  input: AddEngineeringSegmentInput,
): EngineeringProjectContextResult {
  const metadata = createMutationMetadata(input.projectContext, input.metadata);
  const errors = validateMutable(input.projectContext, metadata);

  errors.push(...validateSingleSegment(input.segment, metadata));

  if (input.projectContext.segments.some((existing) => existing.id === input.segment.id)) {
    errors.push(
      createContextError(
        "duplicate_segment_id",
        "segment.id",
        `Segment id ${input.segment.id} already exists in this project context.`,
        metadata,
      ),
    );
  }

  const workFrontId = input.segment.workFrontId ?? null;
  if (
    workFrontId !== null &&
    !input.projectContext.workFronts.some((workFront) => workFront.id === workFrontId)
  ) {
    errors.push(
      createContextError(
        "unknown_work_front_reference",
        "segment.workFrontId",
        `Segment references unknown work front id ${workFrontId}.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const segments = [...input.projectContext.segments, buildSegment(input.segment)];

  return successWithUpdate(
    input.projectContext,
    { segments },
    null,
    createTraceEntry(
      "segment_added",
      input.actor,
      input.occurredAt,
      `Segment ${input.segment.id} added.`,
      metadata,
    ),
    metadata,
  );
}

export function addEngineeringStructure(
  input: AddEngineeringStructureInput,
): EngineeringProjectContextResult {
  const metadata = createMutationMetadata(input.projectContext, input.metadata);
  const errors = validateMutable(input.projectContext, metadata);

  errors.push(...validateSingleStructure(input.structure, metadata));

  if (input.projectContext.structures.some((existing) => existing.id === input.structure.id)) {
    errors.push(
      createContextError(
        "duplicate_structure_id",
        "structure.id",
        `Structure id ${input.structure.id} already exists in this project context.`,
        metadata,
      ),
    );
  }

  const segmentId = input.structure.segmentId ?? null;
  if (
    segmentId !== null &&
    !input.projectContext.segments.some((segment) => segment.id === segmentId)
  ) {
    errors.push(
      createContextError(
        "unknown_segment_reference",
        "structure.segmentId",
        `Structure references unknown segment id ${segmentId}.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const structures = [...input.projectContext.structures, buildStructure(input.structure)];

  return successWithUpdate(
    input.projectContext,
    { structures },
    null,
    createTraceEntry(
      "structure_added",
      input.actor,
      input.occurredAt,
      `Structure ${input.structure.id} added.`,
      metadata,
    ),
    metadata,
  );
}

export function summarizeEngineeringProjectContext(
  projectContext: EngineeringProjectContext,
): EngineeringProjectContextSummary {
  return {
    totalMilestones: projectContext.milestones.length,
    completedMilestones: projectContext.milestones.filter(
      (milestone) => milestone.status === EngineeringMilestoneStatus.Completed,
    ).length,
    delayedMilestones: projectContext.milestones.filter(
      (milestone) => milestone.status === EngineeringMilestoneStatus.Delayed,
    ).length,
    totalWorkFronts: projectContext.workFronts.length,
    totalSegments: projectContext.segments.length,
    totalStructures: projectContext.structures.length,
    totalKpis: projectContext.kpis.length,
  };
}

function isTerminalStatus(status: EngineeringProjectContextStatus): boolean {
  return (
    status === EngineeringProjectContextStatus.Completed ||
    status === EngineeringProjectContextStatus.Cancelled
  );
}

function canAdvanceStatus(
  fromStatus: EngineeringProjectContextStatus,
  toStatus: EngineeringProjectContextStatus,
): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

const allowedTransitions: Readonly<
  Record<EngineeringProjectContextStatus, ReadonlyArray<EngineeringProjectContextStatus>>
> = {
  [EngineeringProjectContextStatus.Draft]: [
    EngineeringProjectContextStatus.Planned,
    EngineeringProjectContextStatus.Cancelled,
  ],
  [EngineeringProjectContextStatus.Planned]: [
    EngineeringProjectContextStatus.InExecution,
    EngineeringProjectContextStatus.Cancelled,
  ],
  [EngineeringProjectContextStatus.InExecution]: [
    EngineeringProjectContextStatus.Suspended,
    EngineeringProjectContextStatus.Completed,
    EngineeringProjectContextStatus.Cancelled,
  ],
  [EngineeringProjectContextStatus.Suspended]: [
    EngineeringProjectContextStatus.InExecution,
    EngineeringProjectContextStatus.Cancelled,
  ],
  [EngineeringProjectContextStatus.Completed]: [],
  [EngineeringProjectContextStatus.Cancelled]: [],
};

const timelineEventTypeByStatus: Readonly<Record<EngineeringProjectContextStatus, string>> = {
  [EngineeringProjectContextStatus.Draft]: "project_context_created",
  [EngineeringProjectContextStatus.Planned]: "project_context_planned",
  [EngineeringProjectContextStatus.InExecution]: "execution_started",
  [EngineeringProjectContextStatus.Suspended]: "execution_suspended",
  [EngineeringProjectContextStatus.Completed]: "project_context_completed",
  [EngineeringProjectContextStatus.Cancelled]: "project_context_cancelled",
};

function timelineEventTypeForStatus(status: EngineeringProjectContextStatus): string {
  return timelineEventTypeByStatus[status];
}

function validateMutable(
  projectContext: EngineeringProjectContext,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextError[] {
  const errors: EngineeringProjectContextError[] = [];

  if (isTerminalStatus(projectContext.status)) {
    errors.push(
      createContextError(
        "project_context_terminal",
        "status",
        `Cannot mutate project context while status is terminal (${projectContext.status}).`,
        metadata,
      ),
    );
  }

  return errors;
}

function successWithUpdate(
  projectContext: EngineeringProjectContext,
  patch: Partial<EngineeringProjectContext>,
  timelineEvent: EngineeringProjectContextTimelineEvent | null,
  traceEntry: EngineeringProjectContextTrace,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextSuccess {
  return freezeDomainObject<EngineeringProjectContextSuccess>({
    success: true,
    projectContext: {
      ...projectContext,
      ...patch,
      timeline: timelineEvent ? [...projectContext.timeline, timelineEvent] : projectContext.timeline,
      trace: [...projectContext.trace, traceEntry],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

function validateContextShell(
  input: CreateEngineeringProjectContextInput,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextError[] {
  const errors: EngineeringProjectContextError[] = [];

  if (isBlank(input.id)) {
    errors.push(
      createContextError("missing_id", "id", "Project context id is required.", metadata),
    );
  }

  if (isBlank(input.engineeringContractId)) {
    errors.push(
      createContextError(
        "missing_engineering_contract_id",
        "engineeringContractId",
        "Engineering contract id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.projectCode)) {
    errors.push(
      createContextError(
        "missing_project_code",
        "projectCode",
        "Project code is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.projectName)) {
    errors.push(
      createContextError(
        "missing_project_name",
        "projectName",
        "Project name is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.objectDescription)) {
    errors.push(
      createContextError(
        "missing_object_description",
        "objectDescription",
        "Object description is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.city)) {
    errors.push(
      createContextError("missing_city", "city", "City is required.", metadata),
    );
  }

  if (isBlank(input.state)) {
    errors.push(
      createContextError("missing_state", "state", "State is required.", metadata),
    );
  }

  return errors;
}

function validateMilestoneBatch(
  milestones: ReadonlyArray<EngineeringMilestoneInput>,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextError[] {
  const errors: EngineeringProjectContextError[] = [];
  const seenIds = new Set<string>();

  milestones.forEach((milestone) => {
    errors.push(...validateSingleMilestone(milestone, metadata));

    if (!isBlank(milestone.id)) {
      if (seenIds.has(milestone.id)) {
        errors.push(
          createContextError(
            "duplicate_milestone_id",
            "milestones",
            `Milestone id ${milestone.id} is duplicated.`,
            metadata,
          ),
        );
      } else {
        seenIds.add(milestone.id);
      }
    }
  });

  return errors;
}

function validateSingleMilestone(
  milestone: EngineeringMilestoneInput,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextError[] {
  const errors: EngineeringProjectContextError[] = [];

  if (isBlank(milestone.id)) {
    errors.push(
      createContextError(
        "missing_milestone_id",
        "milestone.id",
        "Milestone id is required.",
        metadata,
      ),
    );
  }

  const status = milestone.status ?? EngineeringMilestoneStatus.Pending;
  const actualDate = milestone.actualDate ?? null;

  const isIncoherent =
    (status === EngineeringMilestoneStatus.Completed && actualDate === null) ||
    (status === EngineeringMilestoneStatus.Pending && actualDate !== null);

  if (isIncoherent) {
    errors.push(
      createContextError(
        "incoherent_milestone_date",
        "milestone.actualDate",
        `Milestone ${milestone.id} has an incoherent combination of status (${status}) and actualDate.`,
        metadata,
      ),
    );
  }

  return errors;
}

function validateWorkFrontBatch(
  workFronts: ReadonlyArray<EngineeringWorkFrontInput>,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextError[] {
  const errors: EngineeringProjectContextError[] = [];
  const seenIds = new Set<string>();

  workFronts.forEach((workFront) => {
    errors.push(...validateSingleWorkFront(workFront, metadata));

    if (!isBlank(workFront.id)) {
      if (seenIds.has(workFront.id)) {
        errors.push(
          createContextError(
            "duplicate_work_front_id",
            "workFronts",
            `Work front id ${workFront.id} is duplicated.`,
            metadata,
          ),
        );
      } else {
        seenIds.add(workFront.id);
      }
    }
  });

  return errors;
}

function validateSingleWorkFront(
  workFront: EngineeringWorkFrontInput,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextError[] {
  const errors: EngineeringProjectContextError[] = [];

  if (isBlank(workFront.id)) {
    errors.push(
      createContextError(
        "missing_work_front_id",
        "workFront.id",
        "Work front id is required.",
        metadata,
      ),
    );
  }

  return errors;
}

function validateSegmentBatch(
  segments: ReadonlyArray<EngineeringSegmentInput>,
  workFronts: ReadonlyArray<EngineeringWorkFrontInput>,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextError[] {
  const errors: EngineeringProjectContextError[] = [];
  const seenIds = new Set<string>();
  const workFrontIds = new Set(workFronts.map((workFront) => workFront.id));

  segments.forEach((segment) => {
    errors.push(...validateSingleSegment(segment, metadata));

    if (!isBlank(segment.id)) {
      if (seenIds.has(segment.id)) {
        errors.push(
          createContextError(
            "duplicate_segment_id",
            "segments",
            `Segment id ${segment.id} is duplicated.`,
            metadata,
          ),
        );
      } else {
        seenIds.add(segment.id);
      }
    }

    const workFrontId = segment.workFrontId ?? null;
    if (workFrontId !== null && !workFrontIds.has(workFrontId)) {
      errors.push(
        createContextError(
          "unknown_work_front_reference",
          "segment.workFrontId",
          `Segment ${segment.id} references unknown work front id ${workFrontId}.`,
          metadata,
        ),
      );
    }
  });

  return errors;
}

function validateSingleSegment(
  segment: EngineeringSegmentInput,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextError[] {
  const errors: EngineeringProjectContextError[] = [];

  if (isBlank(segment.id)) {
    errors.push(
      createContextError(
        "missing_segment_id",
        "segment.id",
        "Segment id is required.",
        metadata,
      ),
    );
  }

  return errors;
}

function validateStructureBatch(
  structures: ReadonlyArray<EngineeringStructureInput>,
  segments: ReadonlyArray<EngineeringSegmentInput>,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextError[] {
  const errors: EngineeringProjectContextError[] = [];
  const seenIds = new Set<string>();
  const segmentIds = new Set(segments.map((segment) => segment.id));

  structures.forEach((structure) => {
    errors.push(...validateSingleStructure(structure, metadata));

    if (!isBlank(structure.id)) {
      if (seenIds.has(structure.id)) {
        errors.push(
          createContextError(
            "duplicate_structure_id",
            "structures",
            `Structure id ${structure.id} is duplicated.`,
            metadata,
          ),
        );
      } else {
        seenIds.add(structure.id);
      }
    }

    const segmentId = structure.segmentId ?? null;
    if (segmentId !== null && !segmentIds.has(segmentId)) {
      errors.push(
        createContextError(
          "unknown_segment_reference",
          "structure.segmentId",
          `Structure ${structure.id} references unknown segment id ${segmentId}.`,
          metadata,
        ),
      );
    }
  });

  return errors;
}

function validateSingleStructure(
  structure: EngineeringStructureInput,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextError[] {
  const errors: EngineeringProjectContextError[] = [];

  if (isBlank(structure.id)) {
    errors.push(
      createContextError(
        "missing_structure_id",
        "structure.id",
        "Structure id is required.",
        metadata,
      ),
    );
  }

  return errors;
}

function validateKpiBatch(
  kpis: ReadonlyArray<EngineeringProjectKpiInput>,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextError[] {
  const errors: EngineeringProjectContextError[] = [];

  kpis.forEach((kpi) => {
    if (kpi.value < 0) {
      errors.push(
        createContextError(
          "negative_kpi_value",
          `kpi.${kpi.code}.value`,
          `KPI ${kpi.code} value cannot be negative.`,
          metadata,
        ),
      );
    }

    if (kpi.unit === EngineeringKpiUnit.Percentage && kpi.value > 100) {
      errors.push(
        createContextError(
          "invalid_kpi_percentage",
          `kpi.${kpi.code}.value`,
          `KPI ${kpi.code} is a percentage and must be between 0 and 100.`,
          metadata,
        ),
      );
    }
  });

  return errors;
}

function validateBaselineSchedule(
  baselineSchedule: EngineeringBaselineScheduleInput | null | undefined,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextError[] {
  if (baselineSchedule === undefined || baselineSchedule === null) {
    return [];
  }

  if (baselineSchedule.endDate < baselineSchedule.startDate) {
    return [
      createContextError(
        "incoherent_baseline_schedule",
        "baselineSchedule.endDate",
        `Baseline schedule endDate (${baselineSchedule.endDate}) cannot be earlier than startDate (${baselineSchedule.startDate}).`,
        metadata,
      ),
    ];
  }

  return [];
}

function buildMilestones(
  milestoneInputs: ReadonlyArray<EngineeringMilestoneInput>,
): ReadonlyArray<EngineeringMilestone> {
  return milestoneInputs.map((milestone) => buildMilestone(milestone));
}

function buildMilestone(milestone: EngineeringMilestoneInput): EngineeringMilestone {
  return {
    id: milestone.id,
    name: milestone.name,
    description: milestone.description,
    plannedDate: milestone.plannedDate,
    actualDate: milestone.actualDate ?? null,
    status: milestone.status ?? EngineeringMilestoneStatus.Pending,
    metadata: milestone.metadata ?? {},
  };
}

function buildWorkFronts(
  workFrontInputs: ReadonlyArray<EngineeringWorkFrontInput>,
): ReadonlyArray<EngineeringWorkFront> {
  return workFrontInputs.map((workFront) => buildWorkFront(workFront));
}

function buildWorkFront(workFront: EngineeringWorkFrontInput): EngineeringWorkFront {
  return {
    id: workFront.id,
    code: workFront.code,
    name: workFront.name,
    description: workFront.description,
    status: workFront.status ?? EngineeringWorkFrontStatus.NotStarted,
    metadata: workFront.metadata ?? {},
  };
}

function buildSegments(
  segmentInputs: ReadonlyArray<EngineeringSegmentInput>,
): ReadonlyArray<EngineeringSegment> {
  return segmentInputs.map((segment) => buildSegment(segment));
}

function buildSegment(segment: EngineeringSegmentInput): EngineeringSegment {
  return {
    id: segment.id,
    workFrontId: segment.workFrontId ?? null,
    code: segment.code,
    name: segment.name,
    startReference: segment.startReference,
    endReference: segment.endReference,
    extensionMeters: segment.extensionMeters ?? null,
    metadata: segment.metadata ?? {},
  };
}

function buildStructures(
  structureInputs: ReadonlyArray<EngineeringStructureInput>,
): ReadonlyArray<EngineeringStructure> {
  return structureInputs.map((structure) => buildStructure(structure));
}

function buildStructure(structure: EngineeringStructureInput): EngineeringStructure {
  return {
    id: structure.id,
    segmentId: structure.segmentId ?? null,
    code: structure.code,
    name: structure.name,
    structureType: structure.structureType,
    metadata: structure.metadata ?? {},
  };
}

function buildKpis(
  kpiInputs: ReadonlyArray<EngineeringProjectKpiInput>,
): ReadonlyArray<EngineeringProjectKpi> {
  return kpiInputs.map((kpi) => ({
    code: kpi.code,
    label: kpi.label,
    value: kpi.value,
    unit: kpi.unit,
    metadata: kpi.metadata ?? {},
  }));
}

function buildBaselineSchedule(
  baselineSchedule: EngineeringBaselineScheduleInput | null | undefined,
): EngineeringBaselineSchedule | null {
  if (baselineSchedule === undefined || baselineSchedule === null) {
    return null;
  }

  return {
    startDate: baselineSchedule.startDate,
    endDate: baselineSchedule.endDate,
    durationMonths: baselineSchedule.durationMonths ?? null,
    metadata: baselineSchedule.metadata ?? {},
  };
}

function failureResult(
  errors: ReadonlyArray<EngineeringProjectContextError>,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextFailure {
  return freezeDomainObject<EngineeringProjectContextFailure>({
    success: false,
    projectContext: null,
    errors,
    warnings: [],
    metadata,
  });
}

function createTimelineEvent(
  type: string,
  occurredAt: string,
  description: string,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextTimelineEvent {
  return {
    type,
    occurredAt,
    description,
    metadata,
  };
}

function createTraceEntry(
  action: string,
  actor: string,
  occurredAt: string,
  description: string,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextTrace {
  return {
    action,
    actor,
    occurredAt,
    description,
    metadata,
  };
}

function createContextError(
  code: EngineeringProjectContextError["code"],
  field: string,
  message: string,
  metadata: EngineeringProjectContextMetadata,
): EngineeringProjectContextError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createContextMetadata(
  input: CreateEngineeringProjectContextInput,
): EngineeringProjectContextMetadata {
  return {
    ...(input.metadata ?? {}),
    projectContextId: input.id,
    engineeringContractId: input.engineeringContractId,
    projectCode: input.projectCode,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createMutationMetadata(
  projectContext: EngineeringProjectContext,
  extraMetadata: EngineeringProjectContextMetadata | undefined,
): EngineeringProjectContextMetadata {
  return {
    ...projectContext.metadata,
    ...(extraMetadata ?? {}),
    projectContextId: projectContext.id,
    engineeringContractId: projectContext.engineeringContractId,
    projectCode: projectContext.projectCode,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

type FreezableRecord = Record<PropertyKey, unknown>;

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [
      key,
      cloneDomainValue(property),
    ]),
  ) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.values(value as FreezableRecord).forEach((property) => {
    freezeClonedDomainObject(property);
  });

  return Object.freeze(value);
}
