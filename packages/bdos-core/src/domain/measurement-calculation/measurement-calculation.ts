import type {
  AddCalculationSourceEvidenceInput,
  AddMeasurementDimensionInput,
  ApproveCalculationMemoryInput,
  ArchiveCalculationMemoryInput,
  CalculationDimensionEvidenceLinkSummary,
  CalculationEvidenceLinksSummary,
  CalculationMemory,
  CalculationMemoryError,
  CalculationMemoryFailure,
  CalculationMemoryResult,
  CalculationMemorySuccess,
  CalculationMemorySummary,
  CalculationMemoryTimelineEvent,
  CalculationMemoryTrace,
  CreateCalculationMemoryInput,
  LinkEvidenceToDimensionInput,
  MarkCalculationMemoryCalculatedInput,
  MarkCalculationMemoryReadyInput,
  MarkCalculationMemoryReviewedInput,
  MeasurementCalculationMetadata,
  MeasurementDimension,
  MeasurementDimensionInput,
  RejectCalculationMemoryInput,
  RemoveCalculationSourceEvidenceInput,
  RemoveMeasurementDimensionInput,
  SetCalculationResultInput,
  UnlinkEvidenceFromDimensionInput,
} from "./measurement-calculation.types";
import { CalculationMemoryStatus } from "./measurement-calculation.types";
import { freezeDomainObject, isBlank } from "./measurement-calculation-shared";

/**
 * This sprint (Measurement Calculation Engine Core) only structures the
 * `CalculationMemory` aggregate. It deliberately does NOT execute any
 * `CalculationFormulaType`, does NOT derive `CalculationResult` from
 * `dimensions`, and does NOT resolve `sourceEvidenceIds` against the
 * Field Evidence domain — those are explicitly out-of-scope future
 * capabilities (Formula Catalog, Calculation Engine, Evidence Linkage).
 */

export function createCalculationMemory(input: CreateCalculationMemoryInput): CalculationMemoryResult {
  const metadata = createMemoryMetadata(input);
  const dimensionInputs = input.dimensions ?? [];
  const sourceEvidenceIds = input.sourceEvidenceIds ?? [];
  const errors = validateMemoryShell(input, dimensionInputs, sourceEvidenceIds, metadata);

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const memory: CalculationMemory = {
    id: input.id,
    title: input.title,
    description: input.description,
    formulaType: input.formulaType,
    status: CalculationMemoryStatus.Draft,
    dimensions: dimensionInputs.map((dimension) => buildDimension(dimension)),
    result: null,
    sourceEvidenceIds: [...sourceEvidenceIds],
    timeline: [
      createTimelineEvent(
        "calculation_memory_created",
        input.occurredAt,
        `Calculation memory ${input.id} created for formula ${input.formulaType}.`,
        metadata,
      ),
    ],
    trace: [
      createTraceEntry(
        "calculation_memory_created",
        input.actor,
        input.occurredAt,
        `Calculation memory ${input.id} created.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<CalculationMemorySuccess>({
    success: true,
    memory,
    errors: [],
    warnings: [],
    metadata,
  });
}

export function addMeasurementDimension(input: AddMeasurementDimensionInput): CalculationMemoryResult {
  const metadata = createMutationMetadata(input.memory, input.metadata);
  const errors = validateDimensionsMutable(input.memory, metadata);

  errors.push(...validateSingleDimension(input.dimension, metadata));

  if (input.memory.dimensions.some((existing) => existing.id === input.dimension.id)) {
    errors.push(
      createMemoryError(
        "duplicate_dimension_id",
        "dimension.id",
        `Dimension id ${input.dimension.id} already exists on this calculation memory.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const dimensions = [...input.memory.dimensions, buildDimension(input.dimension)];

  return freezeDomainObject<CalculationMemorySuccess>({
    success: true,
    memory: {
      ...input.memory,
      dimensions,
      trace: [
        ...input.memory.trace,
        createTraceEntry(
          "dimension_added",
          input.actor,
          input.occurredAt,
          `Dimension ${input.dimension.id} added to calculation memory ${input.memory.id}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function removeMeasurementDimension(input: RemoveMeasurementDimensionInput): CalculationMemoryResult {
  const metadata = createMutationMetadata(input.memory, input.metadata);
  const errors = validateDimensionsMutable(input.memory, metadata);

  if (!input.memory.dimensions.some((dimension) => dimension.id === input.dimensionId)) {
    errors.push(
      createMemoryError(
        "dimension_not_found",
        "dimensionId",
        `Dimension id ${input.dimensionId} is not present in this calculation memory.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  return freezeDomainObject<CalculationMemorySuccess>({
    success: true,
    memory: {
      ...input.memory,
      dimensions: input.memory.dimensions.filter((dimension) => dimension.id !== input.dimensionId),
      trace: [
        ...input.memory.trace,
        createTraceEntry(
          "dimension_removed",
          input.actor,
          input.occurredAt,
          `Dimension ${input.dimensionId} removed from calculation memory ${input.memory.id}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function setCalculationResult(input: SetCalculationResultInput): CalculationMemoryResult {
  const metadata = createMutationMetadata(input.memory, input.metadata);
  const errors: CalculationMemoryError[] = [];

  if (
    input.memory.status !== CalculationMemoryStatus.Ready &&
    input.memory.status !== CalculationMemoryStatus.Calculated
  ) {
    errors.push(
      createMemoryError(
        "result_not_allowed_in_current_status",
        "status",
        `Cannot set a calculation result while status is ${input.memory.status}. Result requires Ready or Calculated.`,
        metadata,
      ),
    );
  }

  if (input.value < 0) {
    errors.push(
      createMemoryError(
        "negative_result_value",
        "value",
        `Result value cannot be negative, got ${input.value}.`,
        metadata,
      ),
    );
  }

  if (isBlank(input.unit)) {
    errors.push(createMemoryError("missing_result_unit", "unit", "Result unit is required.", metadata));
  }

  if (!Number.isInteger(input.precision) || input.precision < 0) {
    errors.push(
      createMemoryError(
        "invalid_result_precision",
        "precision",
        `Result precision must be a non-negative integer, got ${input.precision}.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  return freezeDomainObject<CalculationMemorySuccess>({
    success: true,
    memory: {
      ...input.memory,
      result: {
        value: input.value,
        unit: input.unit,
        precision: input.precision,
        rounded: input.rounded,
      },
      trace: [
        ...input.memory.trace,
        createTraceEntry(
          "calculation_result_set",
          input.actor,
          input.occurredAt,
          `Calculation result set on calculation memory ${input.memory.id}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function markCalculationMemoryReady(input: MarkCalculationMemoryReadyInput): CalculationMemoryResult {
  return transitionMemoryStatus(
    input.memory,
    CalculationMemoryStatus.Ready,
    "calculation_memory_marked_ready",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function markCalculationMemoryCalculated(
  input: MarkCalculationMemoryCalculatedInput,
): CalculationMemoryResult {
  return transitionMemoryStatus(
    input.memory,
    CalculationMemoryStatus.Calculated,
    "calculation_memory_marked_calculated",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function markCalculationMemoryReviewed(
  input: MarkCalculationMemoryReviewedInput,
): CalculationMemoryResult {
  return transitionMemoryStatus(
    input.memory,
    CalculationMemoryStatus.Reviewed,
    "calculation_memory_marked_reviewed",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function approveCalculationMemory(input: ApproveCalculationMemoryInput): CalculationMemoryResult {
  return transitionMemoryStatus(
    input.memory,
    CalculationMemoryStatus.Approved,
    "calculation_memory_approved",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function rejectCalculationMemory(input: RejectCalculationMemoryInput): CalculationMemoryResult {
  return transitionMemoryStatus(
    input.memory,
    CalculationMemoryStatus.Rejected,
    "calculation_memory_rejected",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function archiveCalculationMemory(input: ArchiveCalculationMemoryInput): CalculationMemoryResult {
  return transitionMemoryStatus(
    input.memory,
    CalculationMemoryStatus.Archived,
    "calculation_memory_archived",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function addCalculationSourceEvidence(input: AddCalculationSourceEvidenceInput): CalculationMemoryResult {
  const metadata = createMutationMetadata(input.memory, input.metadata);
  const errors = validateEvidenceMutable(input.memory, metadata);

  if (isBlank(input.sourceEvidenceId)) {
    errors.push(
      createMemoryError("missing_source_evidence_id", "sourceEvidenceId", "Source evidence id is required.", metadata),
    );
  } else if (input.memory.sourceEvidenceIds.includes(input.sourceEvidenceId)) {
    errors.push(
      createMemoryError(
        "duplicate_source_evidence_id",
        "sourceEvidenceId",
        `Source evidence id ${input.sourceEvidenceId} already exists on this calculation memory.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  return freezeDomainObject<CalculationMemorySuccess>({
    success: true,
    memory: {
      ...input.memory,
      sourceEvidenceIds: [...input.memory.sourceEvidenceIds, input.sourceEvidenceId],
      trace: [
        ...input.memory.trace,
        createTraceEntry(
          "source_evidence_added",
          input.actor,
          input.occurredAt,
          `Source evidence ${input.sourceEvidenceId} added to calculation memory ${input.memory.id}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function removeCalculationSourceEvidence(
  input: RemoveCalculationSourceEvidenceInput,
): CalculationMemoryResult {
  const metadata = createMutationMetadata(input.memory, input.metadata);
  const errors = validateEvidenceMutable(input.memory, metadata);

  if (isBlank(input.sourceEvidenceId)) {
    errors.push(
      createMemoryError("missing_source_evidence_id", "sourceEvidenceId", "Source evidence id is required.", metadata),
    );
  } else if (!input.memory.sourceEvidenceIds.includes(input.sourceEvidenceId)) {
    errors.push(
      createMemoryError(
        "source_evidence_id_not_found",
        "sourceEvidenceId",
        `Source evidence id ${input.sourceEvidenceId} is not present on this calculation memory.`,
        metadata,
      ),
    );
  } else if (
    input.memory.dimensions.some((dimension) => dimension.sourceEvidenceIds.includes(input.sourceEvidenceId))
  ) {
    errors.push(
      createMemoryError(
        "source_evidence_still_linked",
        "sourceEvidenceId",
        `Cannot remove source evidence id ${input.sourceEvidenceId} while it is still linked to a dimension.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  return freezeDomainObject<CalculationMemorySuccess>({
    success: true,
    memory: {
      ...input.memory,
      sourceEvidenceIds: input.memory.sourceEvidenceIds.filter(
        (sourceEvidenceId) => sourceEvidenceId !== input.sourceEvidenceId,
      ),
      trace: [
        ...input.memory.trace,
        createTraceEntry(
          "source_evidence_removed",
          input.actor,
          input.occurredAt,
          `Source evidence ${input.sourceEvidenceId} removed from calculation memory ${input.memory.id}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function linkEvidenceToDimension(input: LinkEvidenceToDimensionInput): CalculationMemoryResult {
  const metadata = createMutationMetadata(input.memory, input.metadata);
  const errors = validateEvidenceMutable(input.memory, metadata);

  if (isBlank(input.sourceEvidenceId)) {
    errors.push(
      createMemoryError("missing_source_evidence_id", "sourceEvidenceId", "Source evidence id is required.", metadata),
    );
  }

  const dimension = input.memory.dimensions.find((candidate) => candidate.id === input.dimensionId);

  if (dimension === undefined) {
    errors.push(
      createMemoryError(
        "dimension_not_found",
        "dimensionId",
        `Dimension id ${input.dimensionId} is not present in this calculation memory.`,
        metadata,
      ),
    );
  } else if (errors.length === 0) {
    if (!input.memory.sourceEvidenceIds.includes(input.sourceEvidenceId)) {
      errors.push(
        createMemoryError(
          "unknown_source_evidence_reference",
          "sourceEvidenceId",
          `Source evidence id ${input.sourceEvidenceId} is not present on this calculation memory. Add it first with addCalculationSourceEvidence.`,
          metadata,
        ),
      );
    } else if (dimension.sourceEvidenceIds.includes(input.sourceEvidenceId)) {
      errors.push(
        createMemoryError(
          "duplicate_dimension_source_evidence_id",
          "dimensionId",
          `Source evidence id ${input.sourceEvidenceId} is already linked to dimension ${input.dimensionId}.`,
          metadata,
        ),
      );
    }
  }

  if (errors.length > 0 || dimension === undefined) {
    return failureResult(errors, metadata);
  }

  return freezeDomainObject<CalculationMemorySuccess>({
    success: true,
    memory: {
      ...input.memory,
      dimensions: input.memory.dimensions.map((candidate) =>
        candidate.id === input.dimensionId
          ? { ...candidate, sourceEvidenceIds: [...candidate.sourceEvidenceIds, input.sourceEvidenceId] }
          : candidate,
      ),
      trace: [
        ...input.memory.trace,
        createTraceEntry(
          "evidence_linked_to_dimension",
          input.actor,
          input.occurredAt,
          `Source evidence ${input.sourceEvidenceId} linked to dimension ${input.dimensionId}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function unlinkEvidenceFromDimension(input: UnlinkEvidenceFromDimensionInput): CalculationMemoryResult {
  const metadata = createMutationMetadata(input.memory, input.metadata);
  const errors = validateEvidenceMutable(input.memory, metadata);

  const dimension = input.memory.dimensions.find((candidate) => candidate.id === input.dimensionId);

  if (dimension === undefined) {
    errors.push(
      createMemoryError(
        "dimension_not_found",
        "dimensionId",
        `Dimension id ${input.dimensionId} is not present in this calculation memory.`,
        metadata,
      ),
    );
  } else if (!dimension.sourceEvidenceIds.includes(input.sourceEvidenceId)) {
    errors.push(
      createMemoryError(
        "dimension_source_evidence_id_not_found",
        "sourceEvidenceId",
        `Source evidence id ${input.sourceEvidenceId} is not linked to dimension ${input.dimensionId}.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0 || dimension === undefined) {
    return failureResult(errors, metadata);
  }

  return freezeDomainObject<CalculationMemorySuccess>({
    success: true,
    memory: {
      ...input.memory,
      dimensions: input.memory.dimensions.map((candidate) =>
        candidate.id === input.dimensionId
          ? {
              ...candidate,
              sourceEvidenceIds: candidate.sourceEvidenceIds.filter(
                (sourceEvidenceId) => sourceEvidenceId !== input.sourceEvidenceId,
              ),
            }
          : candidate,
      ),
      trace: [
        ...input.memory.trace,
        createTraceEntry(
          "evidence_unlinked_from_dimension",
          input.actor,
          input.occurredAt,
          `Source evidence ${input.sourceEvidenceId} unlinked from dimension ${input.dimensionId}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function summarizeCalculationEvidenceLinks(memory: CalculationMemory): CalculationEvidenceLinksSummary {
  const dimensionLinks: CalculationDimensionEvidenceLinkSummary[] = memory.dimensions.map((dimension) => ({
    dimensionId: dimension.id,
    totalLinkedEvidenceIds: dimension.sourceEvidenceIds.length,
  }));

  return {
    totalSourceEvidenceIds: memory.sourceEvidenceIds.length,
    totalLinkedDimensions: dimensionLinks.filter((link) => link.totalLinkedEvidenceIds > 0).length,
    totalDimensionEvidenceLinks: dimensionLinks.reduce((sum, link) => sum + link.totalLinkedEvidenceIds, 0),
    dimensionLinks,
  };
}

export function summarizeCalculationMemory(memory: CalculationMemory): CalculationMemorySummary {
  return {
    status: memory.status,
    formulaType: memory.formulaType,
    totalDimensions: memory.dimensions.length,
    hasResult: memory.result !== null,
    totalSourceEvidenceIds: memory.sourceEvidenceIds.length,
    totalTraceEntries: memory.trace.length,
    totalTimelineEntries: memory.timeline.length,
    isTerminal: isTerminalStatus(memory.status),
    isOperationallyTerminal: isOperationallyTerminalStatus(memory.status),
  };
}

function isTerminalStatus(status: CalculationMemoryStatus): boolean {
  return status === CalculationMemoryStatus.Archived;
}

function isOperationallyTerminalStatus(status: CalculationMemoryStatus): boolean {
  return (
    status === CalculationMemoryStatus.Approved ||
    status === CalculationMemoryStatus.Rejected ||
    status === CalculationMemoryStatus.Archived
  );
}

function canAdvanceStatus(fromStatus: CalculationMemoryStatus, toStatus: CalculationMemoryStatus): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

const allowedTransitions: Readonly<Record<CalculationMemoryStatus, ReadonlyArray<CalculationMemoryStatus>>> = {
  [CalculationMemoryStatus.Draft]: [CalculationMemoryStatus.Ready, CalculationMemoryStatus.Archived],
  [CalculationMemoryStatus.Ready]: [CalculationMemoryStatus.Calculated, CalculationMemoryStatus.Archived],
  [CalculationMemoryStatus.Calculated]: [CalculationMemoryStatus.Reviewed, CalculationMemoryStatus.Archived],
  [CalculationMemoryStatus.Reviewed]: [
    CalculationMemoryStatus.Approved,
    CalculationMemoryStatus.Rejected,
    CalculationMemoryStatus.Archived,
  ],
  [CalculationMemoryStatus.Approved]: [CalculationMemoryStatus.Archived],
  [CalculationMemoryStatus.Rejected]: [CalculationMemoryStatus.Archived],
  [CalculationMemoryStatus.Archived]: [],
};

function transitionMemoryStatus(
  memory: CalculationMemory,
  toStatus: CalculationMemoryStatus,
  timelineType: string,
  actor: string,
  occurredAt: string,
  extraMetadata: MeasurementCalculationMetadata | undefined,
): CalculationMemoryResult {
  const metadata = createMutationMetadata(memory, extraMetadata);
  const fromStatus = memory.status;

  if (isTerminalStatus(fromStatus)) {
    return failureResult(
      [
        createMemoryError(
          "memory_terminal",
          "status",
          `Cannot transition calculation memory from terminal status ${fromStatus}.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  if (!canAdvanceStatus(fromStatus, toStatus)) {
    return failureResult(
      [
        createMemoryError(
          "invalid_calculation_memory_status_transition",
          "status",
          `Cannot transition calculation memory from ${fromStatus} to ${toStatus}.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  const updated: CalculationMemory = {
    ...memory,
    status: toStatus,
    timeline: [
      ...memory.timeline,
      createTimelineEvent(
        timelineType,
        occurredAt,
        `Calculation memory ${memory.id} moved from ${fromStatus} to ${toStatus}.`,
        metadata,
      ),
    ],
    trace: [
      ...memory.trace,
      createTraceEntry(
        timelineType,
        actor,
        occurredAt,
        `Calculation memory status advanced from ${fromStatus} to ${toStatus}.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<CalculationMemorySuccess>({
    success: true,
    memory: updated,
    errors: [],
    warnings: [],
    metadata,
  });
}

function validateMemoryShell(
  input: CreateCalculationMemoryInput,
  dimensionInputs: ReadonlyArray<MeasurementDimensionInput>,
  sourceEvidenceIds: ReadonlyArray<string>,
  metadata: MeasurementCalculationMetadata,
): CalculationMemoryError[] {
  const errors: CalculationMemoryError[] = [];

  if (isBlank(input.id)) {
    errors.push(createMemoryError("missing_id", "id", "Calculation memory id is required.", metadata));
  }

  if (isBlank(input.title)) {
    errors.push(createMemoryError("missing_title", "title", "Calculation memory title is required.", metadata));
  }

  if (isBlank(input.description)) {
    errors.push(
      createMemoryError(
        "missing_description",
        "description",
        "Calculation memory description is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.formulaType)) {
    errors.push(
      createMemoryError("missing_formula_type", "formulaType", "Calculation memory formula type is required.", metadata),
    );
  }

  const seenDimensionIds = new Set<string>();
  dimensionInputs.forEach((dimension) => {
    errors.push(...validateSingleDimension(dimension, metadata));

    if (seenDimensionIds.has(dimension.id)) {
      errors.push(
        createMemoryError(
          "duplicate_dimension_id",
          "dimensions",
          `Dimension id ${dimension.id} is duplicated.`,
          metadata,
        ),
      );
    } else {
      seenDimensionIds.add(dimension.id);
    }
  });

  const seenSourceEvidenceIds = new Set<string>();
  sourceEvidenceIds.forEach((sourceEvidenceId) => {
    if (seenSourceEvidenceIds.has(sourceEvidenceId)) {
      errors.push(
        createMemoryError(
          "duplicate_source_evidence_id",
          "sourceEvidenceIds",
          `Source evidence id ${sourceEvidenceId} is duplicated.`,
          metadata,
        ),
      );
    } else {
      seenSourceEvidenceIds.add(sourceEvidenceId);
    }
  });

  return errors;
}

function validateSingleDimension(
  dimension: MeasurementDimensionInput,
  metadata: MeasurementCalculationMetadata,
): CalculationMemoryError[] {
  const errors: CalculationMemoryError[] = [];

  if (isBlank(dimension.id)) {
    errors.push(createMemoryError("missing_dimension_id", "dimension.id", "Dimension id is required.", metadata));
  }

  if (isBlank(dimension.name)) {
    errors.push(
      createMemoryError("missing_dimension_name", "dimension.name", "Dimension name is required.", metadata),
    );
  }

  if (dimension.value < 0) {
    errors.push(
      createMemoryError(
        "negative_dimension_value",
        "dimension.value",
        `Dimension value cannot be negative, got ${dimension.value}.`,
        metadata,
      ),
    );
  }

  if (isBlank(dimension.unit)) {
    errors.push(
      createMemoryError("missing_dimension_unit", "dimension.unit", "Dimension unit is required.", metadata),
    );
  }

  const seenDimensionSourceEvidenceIds = new Set<string>();
  (dimension.sourceEvidenceIds ?? []).forEach((sourceEvidenceId) => {
    if (seenDimensionSourceEvidenceIds.has(sourceEvidenceId)) {
      errors.push(
        createMemoryError(
          "duplicate_dimension_source_evidence_id",
          "dimension.sourceEvidenceIds",
          `Source evidence id ${sourceEvidenceId} is duplicated within dimension ${dimension.id}.`,
          metadata,
        ),
      );
    } else {
      seenDimensionSourceEvidenceIds.add(sourceEvidenceId);
    }
  });

  return errors;
}

function validateDimensionsMutable(
  memory: CalculationMemory,
  metadata: MeasurementCalculationMetadata,
): CalculationMemoryError[] {
  const errors: CalculationMemoryError[] = [];

  if (
    memory.status === CalculationMemoryStatus.Approved ||
    memory.status === CalculationMemoryStatus.Rejected ||
    memory.status === CalculationMemoryStatus.Archived
  ) {
    errors.push(
      createMemoryError(
        "memory_locked_for_dimension_changes",
        "status",
        `Cannot change dimensions while calculation memory status is ${memory.status}.`,
        metadata,
      ),
    );
  }

  return errors;
}

function validateEvidenceMutable(
  memory: CalculationMemory,
  metadata: MeasurementCalculationMetadata,
): CalculationMemoryError[] {
  const errors: CalculationMemoryError[] = [];

  if (
    memory.status === CalculationMemoryStatus.Approved ||
    memory.status === CalculationMemoryStatus.Rejected ||
    memory.status === CalculationMemoryStatus.Archived
  ) {
    errors.push(
      createMemoryError(
        "memory_locked_for_evidence_changes",
        "status",
        `Cannot change evidence links while calculation memory status is ${memory.status}.`,
        metadata,
      ),
    );
  }

  return errors;
}

function buildDimension(dimension: MeasurementDimensionInput): MeasurementDimension {
  return {
    id: dimension.id,
    name: dimension.name,
    value: dimension.value,
    unit: dimension.unit,
    notes: dimension.notes ?? null,
    sourceEvidenceIds: [...(dimension.sourceEvidenceIds ?? [])],
  };
}

function failureResult(
  errors: ReadonlyArray<CalculationMemoryError>,
  metadata: MeasurementCalculationMetadata,
): CalculationMemoryFailure {
  return freezeDomainObject<CalculationMemoryFailure>({
    success: false,
    memory: null,
    errors,
    warnings: [],
    metadata,
  });
}

function createTimelineEvent(
  type: string,
  occurredAt: string,
  description: string,
  metadata: MeasurementCalculationMetadata,
): CalculationMemoryTimelineEvent {
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
  metadata: MeasurementCalculationMetadata,
): CalculationMemoryTrace {
  return {
    action,
    actor,
    occurredAt,
    description,
    metadata,
  };
}

function createMemoryError(
  code: CalculationMemoryError["code"],
  field: string,
  message: string,
  metadata: MeasurementCalculationMetadata,
): CalculationMemoryError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createMemoryMetadata(input: CreateCalculationMemoryInput): MeasurementCalculationMetadata {
  return {
    ...(input.metadata ?? {}),
    calculationMemoryId: input.id,
    title: input.title,
    formulaType: input.formulaType,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createMutationMetadata(
  memory: CalculationMemory,
  extraMetadata: MeasurementCalculationMetadata | undefined,
): MeasurementCalculationMetadata {
  return {
    ...memory.metadata,
    ...(extraMetadata ?? {}),
    calculationMemoryId: memory.id,
    title: memory.title,
    formulaType: memory.formulaType,
  };
}

