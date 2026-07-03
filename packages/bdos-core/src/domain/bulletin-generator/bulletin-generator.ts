import type {
  CreateMeasurementBulletinInput,
  FinalizeMeasurementBulletinInput,
  MeasurementBulletin,
  MeasurementBulletinError,
  MeasurementBulletinFailure,
  MeasurementBulletinHeader,
  MeasurementBulletinLine,
  MeasurementBulletinLineInput,
  MeasurementBulletinMetadata,
  MeasurementBulletinReference,
  MeasurementBulletinResult,
  MeasurementBulletinSuccess,
  MeasurementBulletinTotals,
  MeasurementBulletinTrace,
  MeasurementBulletinValidationIssue,
  ValidateMeasurementBulletinInput,
} from "./bulletin-generator.types";
import {
  MeasurementBulletinStatus,
  MeasurementBulletinValidationSeverity,
} from "./bulletin-generator.types";

export function createMeasurementBulletin(
  input: CreateMeasurementBulletinInput,
): MeasurementBulletinResult {
  const metadata = createBulletinMetadata(input);
  const errors = [
    ...validateBulletinShell(input, metadata),
    ...validateLineBatch(input.lines, metadata),
  ];

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const lines = buildLines(input.lines);
  const totals = computeTotals(lines);

  const bulletin: MeasurementBulletin = {
    id: input.id,
    organizationId: input.organizationId,
    reference: cloneReference(input.reference),
    header: cloneHeader(input.header),
    lines,
    totals,
    status: MeasurementBulletinStatus.Draft,
    validationIssues: [],
    trace: [
      createTraceEntry(
        "bulletin_created",
        input.actor,
        input.occurredAt,
        `Measurement bulletin created for reference ${input.reference.id}.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<MeasurementBulletinSuccess>({
    success: true,
    bulletin,
    errors: [],
    warnings: [],
    metadata,
  });
}

export function validateMeasurementBulletin(
  input: ValidateMeasurementBulletinInput,
): MeasurementBulletinResult {
  const metadata = createMutationMetadata(input.bulletin, input.metadata);

  if (isTerminalStatus(input.bulletin.status)) {
    return failureResult(
      [
        createBulletinError(
          "bulletin_terminal",
          "status",
          `Bulletin status ${input.bulletin.status} is terminal and cannot be validated.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  const validationIssues = computeValidationIssues(input.bulletin, metadata);
  const hasBlockingIssues = validationIssues.some(
    (issue) => issue.severity === MeasurementBulletinValidationSeverity.Blocking,
  );

  return freezeDomainObject<MeasurementBulletinSuccess>({
    success: true,
    bulletin: {
      ...input.bulletin,
      status: MeasurementBulletinStatus.Validated,
      validationIssues,
      trace: [
        ...input.bulletin.trace,
        createTraceEntry(
          "bulletin_validated",
          input.actor,
          input.occurredAt,
          hasBlockingIssues
            ? `Bulletin validated with ${validationIssues.length} issue(s), including blocking issues.`
            : `Bulletin validated with ${validationIssues.length} issue(s).`,
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

export function finalizeMeasurementBulletin(
  input: FinalizeMeasurementBulletinInput,
): MeasurementBulletinResult {
  const metadata = createMutationMetadata(input.bulletin, input.metadata);

  if (isTerminalStatus(input.bulletin.status)) {
    return failureResult(
      [
        createBulletinError(
          "bulletin_terminal",
          "status",
          `Bulletin status ${input.bulletin.status} is terminal and cannot be finalized.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  if (input.bulletin.status !== MeasurementBulletinStatus.Validated) {
    return failureResult(
      [
        createBulletinError(
          "bulletin_not_validated",
          "status",
          "Bulletin must be validated before it can be finalized.",
          metadata,
        ),
      ],
      metadata,
    );
  }

  const blockingIssues = input.bulletin.validationIssues.filter(
    (issue) => issue.severity === MeasurementBulletinValidationSeverity.Blocking,
  );

  if (blockingIssues.length > 0) {
    return failureResult(
      [
        createBulletinError(
          "blocking_validation_issues",
          "validationIssues",
          `Bulletin has ${blockingIssues.length} blocking issue(s) and cannot be finalized.`,
          { ...metadata, blockingIssueCodes: blockingIssues.map((issue) => issue.code) },
        ),
      ],
      metadata,
    );
  }

  return freezeDomainObject<MeasurementBulletinSuccess>({
    success: true,
    bulletin: {
      ...input.bulletin,
      status: MeasurementBulletinStatus.Finalized,
      trace: [
        ...input.bulletin.trace,
        createTraceEntry(
          "bulletin_finalized",
          input.actor,
          input.occurredAt,
          "Bulletin finalized. This state is terminal.",
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

export function summarizeMeasurementBulletin(
  bulletin: MeasurementBulletin,
): MeasurementBulletinTotals {
  return computeTotals(bulletin.lines);
}

function isTerminalStatus(status: MeasurementBulletinStatus): boolean {
  return (
    status === MeasurementBulletinStatus.Finalized ||
    status === MeasurementBulletinStatus.Cancelled
  );
}

function computeValidationIssues(
  bulletin: MeasurementBulletin,
  metadata: MeasurementBulletinMetadata,
): ReadonlyArray<MeasurementBulletinValidationIssue> {
  const issues: MeasurementBulletinValidationIssue[] = [];

  if (bulletin.totals.totalValue <= 0) {
    issues.push(
      createValidationIssue(
        "non_positive_bulletin_value",
        MeasurementBulletinValidationSeverity.Blocking,
        "totals.totalValue",
        "Bulletin total value must be greater than zero.",
        metadata,
      ),
    );
  }

  bulletin.lines.forEach((line) => {
    if (line.quantity === 0) {
      issues.push(
        createValidationIssue(
          "zero_quantity_line",
          MeasurementBulletinValidationSeverity.Blocking,
          `lines.${line.id}.quantity`,
          `Line ${line.id} has zero quantity.`,
          metadata,
        ),
      );
    }

    if (line.unitValue === 0) {
      issues.push(
        createValidationIssue(
          "zero_unit_value_line",
          MeasurementBulletinValidationSeverity.Warning,
          `lines.${line.id}.unitValue`,
          `Line ${line.id} has zero unit value.`,
          metadata,
        ),
      );
    }
  });

  return issues;
}

function validateBulletinShell(
  input: CreateMeasurementBulletinInput,
  metadata: MeasurementBulletinMetadata,
): MeasurementBulletinError[] {
  const errors: MeasurementBulletinError[] = [];

  if (isBlank(input.id)) {
    errors.push(
      createBulletinError("missing_id", "id", "Bulletin id is required.", metadata),
    );
  }

  if (isBlank(input.organizationId)) {
    errors.push(
      createBulletinError(
        "missing_organization_id",
        "organizationId",
        "Organization id is required.",
        metadata,
      ),
    );
  }

  if (input.reference === undefined || input.reference === null) {
    errors.push(
      createBulletinError(
        "missing_reference",
        "reference",
        "An operational reference is required.",
        metadata,
      ),
    );
  } else if (isBlank(input.reference.id)) {
    errors.push(
      createBulletinError(
        "missing_reference_id",
        "reference.id",
        "Reference id is required.",
        metadata,
      ),
    );
  }

  if (input.header === undefined || input.header === null) {
    errors.push(
      createBulletinError(
        "missing_header",
        "header",
        "Bulletin header is required.",
        metadata,
      ),
    );
  } else {
    if (isBlank(input.header.contractId)) {
      errors.push(
        createBulletinError(
          "missing_header_contract_id",
          "header.contractId",
          "Header contract id is required.",
          metadata,
        ),
      );
    }

    if (isBlank(input.header.projectId)) {
      errors.push(
        createBulletinError(
          "missing_header_project_id",
          "header.projectId",
          "Header project id is required.",
          metadata,
        ),
      );
    }

    if (isBlank(input.header.measurementPeriodId)) {
      errors.push(
        createBulletinError(
          "missing_header_period_id",
          "header.measurementPeriodId",
          "Header measurement period id is required.",
          metadata,
        ),
      );
    }

    if (
      isBlank(input.header.technicalResponsibleId) ||
      isBlank(input.header.technicalResponsibleName)
    ) {
      errors.push(
        createBulletinError(
          "missing_header_technical_responsible",
          "header.technicalResponsibleId",
          "Header technical responsible id and name are required.",
          metadata,
        ),
      );
    }
  }

  return errors;
}

function validateLineBatch(
  lines: ReadonlyArray<MeasurementBulletinLineInput> | null | undefined,
  metadata: MeasurementBulletinMetadata,
): MeasurementBulletinError[] {
  const errors: MeasurementBulletinError[] = [];

  if (lines === undefined || lines === null || lines.length === 0) {
    errors.push(
      createBulletinError(
        "missing_lines",
        "lines",
        "At least one measurement line is required.",
        metadata,
      ),
    );
    return errors;
  }

  const seenIds = new Set<string>();

  lines.forEach((line, index) => {
    if (isBlank(line.id)) {
      errors.push(
        createBulletinError(
          "missing_line_id",
          `lines.${index}.id`,
          "Line id is required.",
          metadata,
        ),
      );
    } else if (seenIds.has(line.id)) {
      errors.push(
        createBulletinError(
          "duplicate_line_id",
          `lines.${index}.id`,
          `Line id ${line.id} is duplicated.`,
          metadata,
        ),
      );
    } else {
      seenIds.add(line.id);
    }

    if (isBlank(line.serviceItemId)) {
      errors.push(
        createBulletinError(
          "missing_line_service_item_id",
          `lines.${index}.serviceItemId`,
          "Line service item id is required.",
          metadata,
        ),
      );
    }

    if (line.quantity < 0) {
      errors.push(
        createBulletinError(
          "negative_quantity",
          `lines.${index}.quantity`,
          "Quantity cannot be negative.",
          metadata,
        ),
      );
    }

    if (line.unitValue < 0) {
      errors.push(
        createBulletinError(
          "negative_unit_value",
          `lines.${index}.unitValue`,
          "Unit value cannot be negative.",
          metadata,
        ),
      );
    }
  });

  return errors;
}

function buildLines(
  lineInputs: ReadonlyArray<MeasurementBulletinLineInput>,
): ReadonlyArray<MeasurementBulletinLine> {
  return lineInputs.map((line) => ({
    id: line.id,
    serviceItemId: line.serviceItemId,
    serviceItemCode: line.serviceItemCode,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    unitValue: line.unitValue,
    totalValue: computeTotalValue(line.quantity, line.unitValue),
    metadata: line.metadata ?? {},
  }));
}

function computeTotalValue(quantity: number, unitValue: number): number {
  return quantity * unitValue;
}

function computeTotals(
  lines: ReadonlyArray<MeasurementBulletinLine>,
): MeasurementBulletinTotals {
  return {
    totalLines: lines.length,
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    totalValue: lines.reduce((sum, line) => sum + line.totalValue, 0),
  };
}

function failureResult(
  errors: ReadonlyArray<MeasurementBulletinError>,
  metadata: MeasurementBulletinMetadata,
): MeasurementBulletinFailure {
  return freezeDomainObject<MeasurementBulletinFailure>({
    success: false,
    bulletin: null,
    errors,
    warnings: [],
    metadata,
  });
}

function cloneReference(
  reference: MeasurementBulletinReference,
): MeasurementBulletinReference {
  return {
    type: reference.type,
    id: reference.id,
    code: reference.code,
    name: reference.name,
    metadata: reference.metadata,
  };
}

function cloneHeader(header: MeasurementBulletinHeader): MeasurementBulletinHeader {
  return {
    contractId: header.contractId,
    contractNumber: header.contractNumber,
    projectId: header.projectId,
    projectName: header.projectName,
    measurementPeriodId: header.measurementPeriodId,
    periodNumber: header.periodNumber,
    startDate: header.startDate,
    endDate: header.endDate,
    technicalResponsibleId: header.technicalResponsibleId,
    technicalResponsibleName: header.technicalResponsibleName,
    metadata: header.metadata,
  };
}

function createTraceEntry(
  action: string,
  actor: string,
  occurredAt: string,
  description: string,
  metadata: MeasurementBulletinMetadata,
): MeasurementBulletinTrace {
  return {
    action,
    actor,
    occurredAt,
    description,
    metadata,
  };
}

function createValidationIssue(
  code: string,
  severity: MeasurementBulletinValidationSeverity,
  field: string,
  message: string,
  metadata: MeasurementBulletinMetadata,
): MeasurementBulletinValidationIssue {
  return {
    code,
    severity,
    field,
    message,
    metadata,
  };
}

function createBulletinError(
  code: MeasurementBulletinError["code"],
  field: string,
  message: string,
  metadata: MeasurementBulletinMetadata,
): MeasurementBulletinError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createBulletinMetadata(
  input: CreateMeasurementBulletinInput,
): MeasurementBulletinMetadata {
  return {
    ...(input.metadata ?? {}),
    bulletinId: input.id,
    organizationId: input.organizationId,
    referenceType: input.reference?.type ?? null,
    referenceId: input.reference?.id ?? null,
    contractId: input.header?.contractId ?? null,
    projectId: input.header?.projectId ?? null,
    measurementPeriodId: input.header?.measurementPeriodId ?? null,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createMutationMetadata(
  bulletin: MeasurementBulletin,
  extraMetadata: MeasurementBulletinMetadata | undefined,
): MeasurementBulletinMetadata {
  return {
    ...bulletin.metadata,
    ...(extraMetadata ?? {}),
    bulletinId: bulletin.id,
    organizationId: bulletin.organizationId,
    referenceType: bulletin.reference.type,
    referenceId: bulletin.reference.id,
    contractId: bulletin.header.contractId,
    projectId: bulletin.header.projectId,
    measurementPeriodId: bulletin.header.measurementPeriodId,
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
