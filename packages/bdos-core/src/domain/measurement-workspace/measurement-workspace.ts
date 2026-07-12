import type {
  AddMeasurementWorkspaceLineInput,
  AdvanceMeasurementWorkspaceStatusInput,
  CreateMeasurementWorkspaceInput,
  MeasurementWorkspace,
  MeasurementWorkspaceError,
  MeasurementWorkspaceFailure,
  MeasurementWorkspaceLine,
  MeasurementWorkspaceLineInput,
  MeasurementWorkspaceMetadata,
  MeasurementWorkspacePeriod,
  MeasurementWorkspaceReference,
  MeasurementWorkspaceResult,
  MeasurementWorkspaceSuccess,
  MeasurementWorkspaceSummary,
  MeasurementWorkspaceTrace,
  RemoveMeasurementWorkspaceLineInput,
  UpdateMeasurementWorkspaceLineQuantityInput,
} from "./measurement-workspace.types";
import { MeasurementWorkspaceStatus } from "./measurement-workspace.types";

export function createMeasurementWorkspace(
  input: CreateMeasurementWorkspaceInput,
): MeasurementWorkspaceResult {
  const metadata = createWorkspaceMetadata(input);
  const lineInputs = input.lines ?? [];
  const errors = [
    ...validateWorkspaceShell(input, metadata),
    ...validateLineBatch(lineInputs, metadata),
  ];

  if (errors.length > 0) {
    return freezeDomainObject<MeasurementWorkspaceFailure>({
      success: false,
      workspace: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  const lines = buildLines(lineInputs);
  const summary = summarizeLines(lines);

  const workspace: MeasurementWorkspace = {
    id: input.id,
    organizationId: input.organizationId,
    reference: cloneReference(input.reference),
    period: clonePeriod(input.period),
    status: MeasurementWorkspaceStatus.Draft,
    lines,
    summary,
    trace: [
      createTraceEntry(
        "workspace_created",
        input.actor,
        input.occurredAt,
        `Measurement workspace created for reference ${input.reference.id}.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<MeasurementWorkspaceSuccess>({
    success: true,
    workspace,
    errors: [],
    warnings: [],
    metadata,
  });
}

export function addMeasurementWorkspaceLine(
  input: AddMeasurementWorkspaceLineInput,
): MeasurementWorkspaceResult {
  const metadata = createMutationMetadata(input.workspace, input.metadata);
  const errors: MeasurementWorkspaceError[] = [];

  if (!isMutableStatus(input.workspace.status)) {
    errors.push(
      createWorkspaceError(
        "workspace_not_mutable",
        "status",
        `Cannot add a line while workspace status is ${input.workspace.status}.`,
        metadata,
      ),
    );
  }

  errors.push(...validateLineFields(input.line, "line", metadata));

  if (input.workspace.lines.some((existing) => existing.id === input.line.id)) {
    errors.push(
      createWorkspaceError(
        "duplicate_line_id",
        "line.id",
        `Line id ${input.line.id} already exists in this workspace.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return freezeDomainObject<MeasurementWorkspaceFailure>({
      success: false,
      workspace: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  const lines = [...input.workspace.lines, buildLine(input.line)];

  return successWithLines(
    input.workspace,
    lines,
    createTraceEntry(
      "line_added",
      input.actor,
      input.occurredAt,
      `Line ${input.line.id} added to workspace.`,
      metadata,
    ),
    metadata,
  );
}

export function removeMeasurementWorkspaceLine(
  input: RemoveMeasurementWorkspaceLineInput,
): MeasurementWorkspaceResult {
  const metadata = createMutationMetadata(input.workspace, input.metadata);
  const errors: MeasurementWorkspaceError[] = [];

  if (!isMutableStatus(input.workspace.status)) {
    errors.push(
      createWorkspaceError(
        "workspace_not_mutable",
        "status",
        `Cannot remove a line while workspace status is ${input.workspace.status}.`,
        metadata,
      ),
    );
  }

  const existingLine = input.workspace.lines.find((line) => line.id === input.lineId);

  if (existingLine === undefined) {
    errors.push(
      createWorkspaceError(
        "line_not_found",
        "lineId",
        `Line ${input.lineId} was not found in this workspace.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return freezeDomainObject<MeasurementWorkspaceFailure>({
      success: false,
      workspace: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  const lines = input.workspace.lines.filter((line) => line.id !== input.lineId);

  return successWithLines(
    input.workspace,
    lines,
    createTraceEntry(
      "line_removed",
      input.actor,
      input.occurredAt,
      `Line ${input.lineId} removed from workspace.`,
      metadata,
    ),
    metadata,
  );
}

export function updateMeasurementWorkspaceLineQuantity(
  input: UpdateMeasurementWorkspaceLineQuantityInput,
): MeasurementWorkspaceResult {
  const metadata = createMutationMetadata(input.workspace, input.metadata);
  const errors: MeasurementWorkspaceError[] = [];

  if (!isMutableStatus(input.workspace.status)) {
    errors.push(
      createWorkspaceError(
        "workspace_not_mutable",
        "status",
        `Cannot update a line while workspace status is ${input.workspace.status}.`,
        metadata,
      ),
    );
  }

  const existingLine = input.workspace.lines.find((line) => line.id === input.lineId);

  if (existingLine === undefined) {
    errors.push(
      createWorkspaceError(
        "line_not_found",
        "lineId",
        `Line ${input.lineId} was not found in this workspace.`,
        metadata,
      ),
    );
  }

  if (input.quantity < 0) {
    errors.push(
      createWorkspaceError(
        "negative_quantity",
        "quantity",
        "Quantity cannot be negative.",
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return freezeDomainObject<MeasurementWorkspaceFailure>({
      success: false,
      workspace: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  const lines = input.workspace.lines.map((line) =>
    line.id === input.lineId
      ? {
          ...line,
          quantity: input.quantity,
          totalValue: computeTotalValue(input.quantity, line.unitValue),
        }
      : line,
  );

  return successWithLines(
    input.workspace,
    lines,
    createTraceEntry(
      "line_quantity_updated",
      input.actor,
      input.occurredAt,
      `Line ${input.lineId} quantity updated to ${input.quantity}.`,
      metadata,
    ),
    metadata,
  );
}

export function advanceMeasurementWorkspaceStatus(
  input: AdvanceMeasurementWorkspaceStatusInput,
): MeasurementWorkspaceResult {
  const metadata = createMutationMetadata(input.workspace, input.metadata);
  const fromStatus = input.workspace.status;

  if (!canAdvanceStatus(fromStatus, input.toStatus)) {
    return freezeDomainObject<MeasurementWorkspaceFailure>({
      success: false,
      workspace: null,
      errors: [
        createWorkspaceError(
          "invalid_workspace_status_transition",
          "status",
          `Cannot transition workspace from ${fromStatus} to ${input.toStatus}.`,
          metadata,
        ),
      ],
      warnings: [],
      metadata,
    });
  }

  const workspace: MeasurementWorkspace = {
    ...input.workspace,
    status: input.toStatus,
    trace: [
      ...input.workspace.trace,
      createTraceEntry(
        "status_advanced",
        input.actor,
        input.occurredAt,
        `Workspace status advanced from ${fromStatus} to ${input.toStatus}.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<MeasurementWorkspaceSuccess>({
    success: true,
    workspace,
    errors: [],
    warnings: [],
    metadata,
  });
}

export function summarizeMeasurementWorkspace(
  workspace: MeasurementWorkspace,
): MeasurementWorkspaceSummary {
  return summarizeLines(workspace.lines);
}

function successWithLines(
  workspace: MeasurementWorkspace,
  lines: ReadonlyArray<MeasurementWorkspaceLine>,
  traceEntry: MeasurementWorkspaceTrace,
  metadata: MeasurementWorkspaceMetadata,
): MeasurementWorkspaceSuccess {
  return freezeDomainObject<MeasurementWorkspaceSuccess>({
    success: true,
    workspace: {
      ...workspace,
      lines,
      summary: summarizeLines(lines),
      trace: [...workspace.trace, traceEntry],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

function validateWorkspaceShell(
  input: CreateMeasurementWorkspaceInput,
  metadata: MeasurementWorkspaceMetadata,
): ReadonlyArray<MeasurementWorkspaceError> {
  const errors: MeasurementWorkspaceError[] = [];

  if (isBlank(input.id)) {
    errors.push(
      createWorkspaceError("missing_id", "id", "Workspace id is required.", metadata),
    );
  }

  if (isBlank(input.organizationId)) {
    errors.push(
      createWorkspaceError(
        "missing_organization_id",
        "organizationId",
        "Organization id is required.",
        metadata,
      ),
    );
  }

  if (input.reference === undefined || input.reference === null) {
    errors.push(
      createWorkspaceError(
        "missing_reference",
        "reference",
        "A project, contract or work package reference is required.",
        metadata,
      ),
    );
  } else if (isBlank(input.reference.id)) {
    errors.push(
      createWorkspaceError(
        "missing_reference_id",
        "reference.id",
        "Reference id is required.",
        metadata,
      ),
    );
  }

  if (input.period === undefined || input.period === null) {
    errors.push(
      createWorkspaceError(
        "missing_period",
        "period",
        "Measurement period is required.",
        metadata,
      ),
    );
  } else if (isBlank(input.period.measurementPeriodId)) {
    errors.push(
      createWorkspaceError(
        "missing_period_id",
        "period.measurementPeriodId",
        "Measurement period id is required.",
        metadata,
      ),
    );
  }

  return errors;
}

function validateLineBatch(
  lines: ReadonlyArray<MeasurementWorkspaceLineInput>,
  metadata: MeasurementWorkspaceMetadata,
): ReadonlyArray<MeasurementWorkspaceError> {
  const errors: MeasurementWorkspaceError[] = [];
  const seenIds = new Set<string>();

  lines.forEach((line, index) => {
    errors.push(...validateLineFields(line, `lines.${index}`, metadata));

    if (!isBlank(line.id)) {
      if (seenIds.has(line.id)) {
        errors.push(
          createWorkspaceError(
            "duplicate_line_id",
            `lines.${index}.id`,
            `Line id ${line.id} is duplicated.`,
            metadata,
          ),
        );
      } else {
        seenIds.add(line.id);
      }
    }
  });

  return errors;
}

function validateLineFields(
  line: MeasurementWorkspaceLineInput,
  fieldPrefix: string,
  metadata: MeasurementWorkspaceMetadata,
): ReadonlyArray<MeasurementWorkspaceError> {
  const errors: MeasurementWorkspaceError[] = [];

  if (isBlank(line.id)) {
    errors.push(
      createWorkspaceError(
        "missing_line_id",
        `${fieldPrefix}.id`,
        "Line id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(line.serviceItemId)) {
    errors.push(
      createWorkspaceError(
        "missing_line_service_item_id",
        `${fieldPrefix}.serviceItemId`,
        "Line service item id is required.",
        metadata,
      ),
    );
  }

  if (line.quantity < 0) {
    errors.push(
      createWorkspaceError(
        "negative_quantity",
        `${fieldPrefix}.quantity`,
        "Quantity cannot be negative.",
        metadata,
      ),
    );
  }

  if (line.unitValue < 0) {
    errors.push(
      createWorkspaceError(
        "negative_unit_value",
        `${fieldPrefix}.unitValue`,
        "Unit value cannot be negative.",
        metadata,
      ),
    );
  }

  return errors;
}

function buildLines(
  lineInputs: ReadonlyArray<MeasurementWorkspaceLineInput>,
): ReadonlyArray<MeasurementWorkspaceLine> {
  return lineInputs.map((line) => buildLine(line));
}

function buildLine(line: MeasurementWorkspaceLineInput): MeasurementWorkspaceLine {
  return {
    id: line.id,
    serviceItemId: line.serviceItemId,
    serviceItemCode: line.serviceItemCode,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    unitValue: line.unitValue,
    totalValue: computeTotalValue(line.quantity, line.unitValue),
    notes: line.notes ?? "",
    metadata: line.metadata ?? {},
  };
}

function computeTotalValue(quantity: number, unitValue: number): number {
  return quantity * unitValue;
}

function summarizeLines(
  lines: ReadonlyArray<MeasurementWorkspaceLine>,
): MeasurementWorkspaceSummary {
  return {
    totalLines: lines.length,
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    totalValue: lines.reduce((sum, line) => sum + line.totalValue, 0),
  };
}

function isMutableStatus(status: MeasurementWorkspaceStatus): boolean {
  return (
    status === MeasurementWorkspaceStatus.Draft ||
    status === MeasurementWorkspaceStatus.InProgress
  );
}

// Exportada (Sprint 4D.2) para que processMeasurementBulletinImport
// (apps/web) valide a transição Draft -> InProgress sem precisar
// reconstruir o aggregate rico que advanceMeasurementWorkspaceStatus
// exige (lines/summary/trace/reference/period -- shape incompatível
// com o modelo normalizado que measurement-repository.ts persiste).
// A tabela de transições continua sendo a única fonte de verdade;
// isto evita duplicar a regra como uma constante solta no Application
// Service.
export function canAdvanceStatus(
  fromStatus: MeasurementWorkspaceStatus,
  toStatus: MeasurementWorkspaceStatus,
): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

const allowedTransitions: Readonly<
  Record<MeasurementWorkspaceStatus, ReadonlyArray<MeasurementWorkspaceStatus>>
> = {
  [MeasurementWorkspaceStatus.Draft]: [
    MeasurementWorkspaceStatus.InProgress,
    MeasurementWorkspaceStatus.Cancelled,
  ],
  [MeasurementWorkspaceStatus.InProgress]: [
    MeasurementWorkspaceStatus.ReadyForReview,
    MeasurementWorkspaceStatus.Cancelled,
  ],
  [MeasurementWorkspaceStatus.ReadyForReview]: [
    MeasurementWorkspaceStatus.InProgress,
    MeasurementWorkspaceStatus.Closed,
    MeasurementWorkspaceStatus.Cancelled,
  ],
  [MeasurementWorkspaceStatus.Closed]: [],
  [MeasurementWorkspaceStatus.Cancelled]: [],
};

function cloneReference(
  reference: MeasurementWorkspaceReference,
): MeasurementWorkspaceReference {
  return {
    type: reference.type,
    id: reference.id,
    code: reference.code,
    name: reference.name,
    metadata: reference.metadata,
  };
}

function clonePeriod(period: MeasurementWorkspacePeriod): MeasurementWorkspacePeriod {
  return {
    measurementPeriodId: period.measurementPeriodId,
    periodNumber: period.periodNumber,
    startDate: period.startDate,
    endDate: period.endDate,
    metadata: period.metadata,
  };
}

function createTraceEntry(
  action: string,
  actor: string,
  occurredAt: string,
  description: string,
  metadata: MeasurementWorkspaceMetadata,
): MeasurementWorkspaceTrace {
  return {
    action,
    actor,
    occurredAt,
    description,
    metadata,
  };
}

function createWorkspaceError(
  code: MeasurementWorkspaceError["code"],
  field: string,
  message: string,
  metadata: MeasurementWorkspaceMetadata,
): MeasurementWorkspaceError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createWorkspaceMetadata(
  input: CreateMeasurementWorkspaceInput,
): MeasurementWorkspaceMetadata {
  return {
    ...(input.metadata ?? {}),
    workspaceId: input.id,
    organizationId: input.organizationId,
    referenceType: input.reference?.type ?? null,
    referenceId: input.reference?.id ?? null,
    measurementPeriodId: input.period?.measurementPeriodId ?? null,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createMutationMetadata(
  workspace: MeasurementWorkspace,
  extraMetadata: MeasurementWorkspaceMetadata | undefined,
): MeasurementWorkspaceMetadata {
  return {
    ...workspace.metadata,
    ...(extraMetadata ?? {}),
    workspaceId: workspace.id,
    organizationId: workspace.organizationId,
    referenceType: workspace.reference.type,
    referenceId: workspace.reference.id,
    measurementPeriodId: workspace.period.measurementPeriodId,
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
