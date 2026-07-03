import type {
  CreateExportPackageInput,
  ExportDocumentDescriptor,
  ExportDocumentRequest,
  ExportDocumentRequestInput,
  ExportPackage,
  ExportPackageError,
  ExportPackageFailure,
  ExportPackageMetadata,
  ExportPackageReference,
  ExportPackageResult,
  ExportPackageSuccess,
  ExportPackageSummary,
  ExportPackageTrace,
  ExportPackageValidationIssue,
  PrepareExportPackageInput,
  ValidateExportPackageInput,
} from "./export-engine.types";
import {
  ExportDocumentFormat,
  ExportDocumentType,
  ExportPackageReferenceType,
  ExportPackageStatus,
  ExportPackageValidationSeverity,
} from "./export-engine.types";

const allowedFormatsByType: Readonly<
  Record<ExportDocumentType, ReadonlyArray<ExportDocumentFormat>>
> = {
  [ExportDocumentType.OfficialMeasurementSpreadsheet]: [ExportDocumentFormat.Excel],
  [ExportDocumentType.OfficialMeasurementPdf]: [ExportDocumentFormat.Pdf],
  [ExportDocumentType.MeasurementBulletin]: [
    ExportDocumentFormat.Pdf,
    ExportDocumentFormat.Excel,
  ],
  [ExportDocumentType.Scurve]: [
    ExportDocumentFormat.Pdf,
    ExportDocumentFormat.Excel,
    ExportDocumentFormat.Csv,
  ],
  [ExportDocumentType.EvidencePack]: [
    ExportDocumentFormat.Pdf,
    ExportDocumentFormat.Csv,
    ExportDocumentFormat.Json,
  ],
  [ExportDocumentType.CustomDocument]: [
    ExportDocumentFormat.Excel,
    ExportDocumentFormat.Pdf,
    ExportDocumentFormat.Csv,
    ExportDocumentFormat.Json,
  ],
};

const extensionByFormat: Readonly<Record<ExportDocumentFormat, string>> = {
  [ExportDocumentFormat.Excel]: "xlsx",
  [ExportDocumentFormat.Pdf]: "pdf",
  [ExportDocumentFormat.Csv]: "csv",
  [ExportDocumentFormat.Json]: "json",
};

export function createExportPackage(
  input: CreateExportPackageInput,
): ExportPackageResult {
  const metadata = createPackageMetadata(input);
  const errors = [
    ...validatePackageShell(input, metadata),
    ...validateDocumentBatch(input.documents, metadata),
  ];

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const documents = buildDocuments(input.documents);

  const exportPackage: ExportPackage = {
    id: input.id,
    organizationId: input.organizationId,
    reference: cloneReference(input.reference),
    documents,
    descriptors: [],
    status: ExportPackageStatus.Draft,
    validationIssues: [],
    summary: summarizeDocuments(documents, []),
    trace: [
      createTraceEntry(
        "export_package_created",
        input.actor,
        input.occurredAt,
        `Export package created for reference ${input.reference.id}.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<ExportPackageSuccess>({
    success: true,
    exportPackage,
    errors: [],
    warnings: [],
    metadata,
  });
}

export function validateExportPackage(
  input: ValidateExportPackageInput,
): ExportPackageResult {
  const metadata = createMutationMetadata(input.exportPackage, input.metadata);

  if (isTerminalStatus(input.exportPackage.status)) {
    return failureResult(
      [
        createPackageError(
          "export_package_terminal",
          "status",
          `Export package status ${input.exportPackage.status} is terminal and cannot be validated.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  const validationIssues = computeValidationIssues(input.exportPackage, metadata);

  return freezeDomainObject<ExportPackageSuccess>({
    success: true,
    exportPackage: {
      ...input.exportPackage,
      status: ExportPackageStatus.Validated,
      validationIssues,
      trace: [
        ...input.exportPackage.trace,
        createTraceEntry(
          "export_package_validated",
          input.actor,
          input.occurredAt,
          `Export package validated with ${validationIssues.length} issue(s).`,
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

export function prepareExportPackage(
  input: PrepareExportPackageInput,
): ExportPackageResult {
  const metadata = createMutationMetadata(input.exportPackage, input.metadata);

  if (isTerminalStatus(input.exportPackage.status)) {
    return failureResult(
      [
        createPackageError(
          "export_package_terminal",
          "status",
          `Export package status ${input.exportPackage.status} is terminal and cannot be prepared.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  if (input.exportPackage.status !== ExportPackageStatus.Validated) {
    return failureResult(
      [
        createPackageError(
          "export_package_not_validated",
          "status",
          "Export package must be validated before it can be prepared.",
          metadata,
        ),
      ],
      metadata,
    );
  }

  const blockingIssues = input.exportPackage.validationIssues.filter(
    (issue) => issue.severity === ExportPackageValidationSeverity.Blocking,
  );

  if (blockingIssues.length > 0) {
    return failureResult(
      [
        createPackageError(
          "blocking_validation_issues",
          "validationIssues",
          `Export package has ${blockingIssues.length} blocking issue(s) and cannot be prepared.`,
          { ...metadata, blockingIssueCodes: blockingIssues.map((issue) => issue.code) },
        ),
      ],
      metadata,
    );
  }

  const descriptors = input.exportPackage.documents.map((document) =>
    buildDescriptor(document, input.exportPackage.reference),
  );

  return freezeDomainObject<ExportPackageSuccess>({
    success: true,
    exportPackage: {
      ...input.exportPackage,
      status: ExportPackageStatus.Prepared,
      descriptors,
      summary: summarizeDocuments(input.exportPackage.documents, descriptors),
      trace: [
        ...input.exportPackage.trace,
        createTraceEntry(
          "export_package_prepared",
          input.actor,
          input.occurredAt,
          `Export package prepared with ${descriptors.length} conceptual descriptor(s). This state is terminal.`,
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

export function summarizeExportPackage(
  exportPackage: ExportPackage,
): ExportPackageSummary {
  return summarizeDocuments(exportPackage.documents, exportPackage.descriptors);
}

function isTerminalStatus(status: ExportPackageStatus): boolean {
  return (
    status === ExportPackageStatus.Prepared ||
    status === ExportPackageStatus.Cancelled
  );
}

function computeValidationIssues(
  exportPackage: ExportPackage,
  metadata: ExportPackageMetadata,
): ReadonlyArray<ExportPackageValidationIssue> {
  const issues: ExportPackageValidationIssue[] = [];

  if (exportPackage.documents.length === 0) {
    issues.push(
      createValidationIssue(
        "no_documents_requested",
        ExportPackageValidationSeverity.Blocking,
        "documents",
        "At least one document must be requested.",
        metadata,
      ),
    );
  } else {
    const typeCounts = new Map<ExportDocumentType, number>();
    exportPackage.documents.forEach((document) => {
      typeCounts.set(document.type, (typeCounts.get(document.type) ?? 0) + 1);
    });

    [...typeCounts.entries()]
      .filter(([, count]) => count > 1)
      .forEach(([type]) => {
        issues.push(
          createValidationIssue(
            "duplicate_document_type",
            ExportPackageValidationSeverity.Blocking,
            `documents.type.${type}`,
            `Document type ${type} was requested more than once.`,
            metadata,
          ),
        );
      });

    exportPackage.documents.forEach((document) => {
      if (!allowedFormatsByType[document.type].includes(document.format)) {
        issues.push(
          createValidationIssue(
            "incompatible_document_format",
            ExportPackageValidationSeverity.Blocking,
            `documents.${document.id}.format`,
            `Format ${document.format} is not compatible with document type ${document.type}.`,
            metadata,
          ),
        );
      }
    });
  }

  if (
    exportPackage.reference.type === ExportPackageReferenceType.MeasurementBulletin &&
    exportPackage.reference.status !== "Finalized"
  ) {
    issues.push(
      createValidationIssue(
        "reference_not_finalized",
        ExportPackageValidationSeverity.Warning,
        "reference.status",
        `Referenced measurement bulletin is not finalized (status: ${exportPackage.reference.status}).`,
        metadata,
      ),
    );
  }

  return issues;
}

function validatePackageShell(
  input: CreateExportPackageInput,
  metadata: ExportPackageMetadata,
): ExportPackageError[] {
  const errors: ExportPackageError[] = [];

  if (isBlank(input.id)) {
    errors.push(
      createPackageError("missing_id", "id", "Export package id is required.", metadata),
    );
  }

  if (isBlank(input.organizationId)) {
    errors.push(
      createPackageError(
        "missing_organization_id",
        "organizationId",
        "Organization id is required.",
        metadata,
      ),
    );
  }

  if (input.reference === undefined || input.reference === null) {
    errors.push(
      createPackageError(
        "missing_reference",
        "reference",
        "An operational reference is required.",
        metadata,
      ),
    );
  } else if (isBlank(input.reference.id)) {
    errors.push(
      createPackageError(
        "missing_reference_id",
        "reference.id",
        "Reference id is required.",
        metadata,
      ),
    );
  }

  return errors;
}

function validateDocumentBatch(
  documents: ReadonlyArray<ExportDocumentRequestInput> | null | undefined,
  metadata: ExportPackageMetadata,
): ExportPackageError[] {
  const errors: ExportPackageError[] = [];

  if (documents === undefined || documents === null) {
    return errors;
  }

  const seenIds = new Set<string>();

  documents.forEach((document, index) => {
    if (isBlank(document.id)) {
      errors.push(
        createPackageError(
          "missing_document_id",
          `documents.${index}.id`,
          "Document id is required.",
          metadata,
        ),
      );
    } else if (seenIds.has(document.id)) {
      errors.push(
        createPackageError(
          "duplicate_document_id",
          `documents.${index}.id`,
          `Document id ${document.id} is duplicated.`,
          metadata,
        ),
      );
    } else {
      seenIds.add(document.id);
    }

    if (document.type === undefined || document.type === null) {
      errors.push(
        createPackageError(
          "missing_document_type",
          `documents.${index}.type`,
          "Document type is required.",
          metadata,
        ),
      );
    }

    if (document.format === undefined || document.format === null) {
      errors.push(
        createPackageError(
          "missing_document_format",
          `documents.${index}.format`,
          "Document format is required.",
          metadata,
        ),
      );
    }
  });

  return errors;
}

function buildDocuments(
  documentInputs: ReadonlyArray<ExportDocumentRequestInput>,
): ReadonlyArray<ExportDocumentRequest> {
  return documentInputs.map((document) => ({
    id: document.id,
    type: document.type,
    format: document.format,
    label: document.label,
    metadata: document.metadata ?? {},
  }));
}

function buildDescriptor(
  document: ExportDocumentRequest,
  reference: ExportPackageReference,
): ExportDocumentDescriptor {
  const extension = extensionByFormat[document.format];

  return {
    requestId: document.id,
    type: document.type,
    format: document.format,
    label: document.label,
    fileNameSuggestion: `${reference.code}-${document.type}.${extension}`,
    contentSummary: `Conceptual ${document.type} document (${document.format}) prepared for reference ${reference.id}. No physical file is generated in this sprint.`,
    metadata: document.metadata,
  };
}

function summarizeDocuments(
  documents: ReadonlyArray<ExportDocumentRequest>,
  descriptors: ReadonlyArray<ExportDocumentDescriptor>,
): ExportPackageSummary {
  return {
    totalDocumentsRequested: documents.length,
    totalDocumentsPrepared: descriptors.length,
    formatsRequested: uniqueSorted(documents.map((document) => document.format)),
    typesRequested: uniqueSorted(documents.map((document) => document.type)),
  };
}

function uniqueSorted<T extends string>(values: ReadonlyArray<T>): ReadonlyArray<T> {
  return [...new Set(values)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function failureResult(
  errors: ReadonlyArray<ExportPackageError>,
  metadata: ExportPackageMetadata,
): ExportPackageFailure {
  return freezeDomainObject<ExportPackageFailure>({
    success: false,
    exportPackage: null,
    errors,
    warnings: [],
    metadata,
  });
}

function cloneReference(reference: ExportPackageReference): ExportPackageReference {
  return {
    type: reference.type,
    id: reference.id,
    code: reference.code,
    name: reference.name,
    status: reference.status,
    metadata: reference.metadata,
  };
}

function createTraceEntry(
  action: string,
  actor: string,
  occurredAt: string,
  description: string,
  metadata: ExportPackageMetadata,
): ExportPackageTrace {
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
  severity: ExportPackageValidationSeverity,
  field: string,
  message: string,
  metadata: ExportPackageMetadata,
): ExportPackageValidationIssue {
  return {
    code,
    severity,
    field,
    message,
    metadata,
  };
}

function createPackageError(
  code: ExportPackageError["code"],
  field: string,
  message: string,
  metadata: ExportPackageMetadata,
): ExportPackageError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createPackageMetadata(
  input: CreateExportPackageInput,
): ExportPackageMetadata {
  return {
    ...(input.metadata ?? {}),
    exportPackageId: input.id,
    organizationId: input.organizationId,
    referenceType: input.reference?.type ?? null,
    referenceId: input.reference?.id ?? null,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createMutationMetadata(
  exportPackage: ExportPackage,
  extraMetadata: ExportPackageMetadata | undefined,
): ExportPackageMetadata {
  return {
    ...exportPackage.metadata,
    ...(extraMetadata ?? {}),
    exportPackageId: exportPackage.id,
    organizationId: exportPackage.organizationId,
    referenceType: exportPackage.reference.type,
    referenceId: exportPackage.reference.id,
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
