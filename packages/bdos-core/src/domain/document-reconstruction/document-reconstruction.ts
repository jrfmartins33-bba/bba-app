import type {
  AddReconstructionFieldInput,
  AddReconstructionSectionInput,
  AddReconstructionSourceInput,
  AdvanceDocumentReconstructionStatusInput,
  CreateDocumentReconstructionInput,
  DocumentReconstruction,
  DocumentReconstructionDocumentType,
  DocumentReconstructionError,
  DocumentReconstructionErrorCode,
  DocumentReconstructionFailure,
  DocumentReconstructionIssue,
  DocumentReconstructionMetadata,
  DocumentReconstructionResult,
  DocumentReconstructionSuccess,
  DocumentReconstructionSummary,
  DocumentReconstructionTimelineEvent,
  DocumentReconstructionTrace,
  ReconstructionField,
  ReconstructionFieldId,
  ReconstructionFieldInput,
  ReconstructionFieldSummary,
  ReconstructionSection,
  ReconstructionSectionId,
  ReconstructionSectionInput,
  ReconstructionSectionSummary,
  ReconstructionSource,
  ReconstructionSourceId,
  ReconstructionSourceInput,
  ReconstructionSourceSummary,
  ReconstructionSourceTypeCount,
  RemoveReconstructionFieldInput,
  RemoveReconstructionSectionInput,
  RemoveReconstructionSourceInput,
  UpdateReconstructionFieldStatusInput,
  UpdateReconstructionFieldValueInput,
  UpdateReconstructionSectionStatusInput,
} from "./document-reconstruction.types";
import {
  DocumentReconstructionStatus,
  ReconstructionFieldStatus,
  ReconstructionSectionStatus,
  ReconstructionSourceType,
} from "./document-reconstruction.types";

/**
 * Inaugural Aggregate Root of Chapter IV (Document Reconstruction
 * Intelligence). Structures the logical reconstruction model of a
 * technical document only. It does not render a PDF, a Word document,
 * HTML, or a markup file, does not calculate anything, and does not integrate with
 * any other domain. `issues` is a structural placeholder that remains
 * empty; populating it is deferred to a future capability. `sources`
 * (Epic 14.2 — Reconstruction Sources) is the traceability layer: every
 * source is an opaque reference (`sourceType`/`sourceId`) to whatever
 * artifact informed the reconstruction. `sections` (Epic 14.3 —
 * Reconstruction Sections) is the hierarchical structure of the
 * reconstructed document; a section's `fields`/`issues` are opaque
 * string ids only — no `ReconstructionField` object exists yet — and
 * `sourceIds` references only `ReconstructionSource.id` values. This
 * domain never resolves, reads, or imports the bounded context any of
 * these opaque ids point to.
 */

export function createDocumentReconstruction(
  input: CreateDocumentReconstructionInput,
): DocumentReconstructionResult {
  const metadata = createShellMetadata(input);
  const errors = validateShell(input, metadata);

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const status = DocumentReconstructionStatus.Draft;
  const sections: ReadonlyArray<ReconstructionSection> = [];
  const sources: ReadonlyArray<ReconstructionSource> = [];
  const fields: ReadonlyArray<ReconstructionField> = [];
  const issues: ReadonlyArray<DocumentReconstructionIssue> = [];

  const documentReconstruction: DocumentReconstruction = {
    id: input.id,
    title: input.title,
    documentType: input.documentType,
    status,
    description: input.description ?? null,
    sections,
    sources,
    fields,
    issues,
    timeline: [
      createTimelineEvent(
        "document_reconstruction_created",
        input.occurredAt,
        `Document reconstruction ${input.id} (${input.documentType}) created.`,
        metadata,
      ),
    ],
    trace: [
      createTraceEntry(
        "document_reconstruction_created",
        input.actor,
        input.occurredAt,
        `Document reconstruction ${input.id} created.`,
        metadata,
      ),
    ],
    summary: buildSummary(status, input.documentType, sections, sources, fields, issues),
    metadata,
  };

  return freezeDomainObject<DocumentReconstructionSuccess>({
    success: true,
    documentReconstruction,
    errors: [],
    warnings: [],
    metadata,
  });
}

export function advanceDocumentReconstructionStatus(
  input: AdvanceDocumentReconstructionStatusInput,
): DocumentReconstructionResult {
  const { documentReconstruction, toStatus } = input;
  const metadata = createMutationMetadata(documentReconstruction, input.metadata);
  const fromStatus = documentReconstruction.status;

  if (isTerminalStatus(fromStatus)) {
    return failureResult(
      [
        createDocumentReconstructionError(
          "document_reconstruction_terminal",
          "status",
          `Cannot transition document reconstruction from terminal status ${fromStatus}.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  if (!canAdvanceStatus(fromStatus, toStatus)) {
    return failureResult(
      [
        createDocumentReconstructionError(
          "invalid_document_reconstruction_status_transition",
          "status",
          `Cannot transition document reconstruction from ${fromStatus} to ${toStatus}.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  const updated: DocumentReconstruction = {
    ...documentReconstruction,
    status: toStatus,
    timeline: [
      ...documentReconstruction.timeline,
      createTimelineEvent(
        "document_reconstruction_status_advanced",
        input.occurredAt,
        `Document reconstruction ${documentReconstruction.id} moved from ${fromStatus} to ${toStatus}.`,
        metadata,
      ),
    ],
    trace: [
      ...documentReconstruction.trace,
      createTraceEntry(
        "document_reconstruction_status_advanced",
        input.actor,
        input.occurredAt,
        `Document reconstruction status advanced from ${fromStatus} to ${toStatus}.`,
        metadata,
      ),
    ],
    summary: buildSummary(
      toStatus,
      documentReconstruction.documentType,
      documentReconstruction.sections,
      documentReconstruction.sources,
      documentReconstruction.fields,
      documentReconstruction.issues,
    ),
    metadata,
  };

  return freezeDomainObject<DocumentReconstructionSuccess>({
    success: true,
    documentReconstruction: updated,
    errors: [],
    warnings: [],
    metadata,
  });
}

export function summarizeDocumentReconstruction(
  documentReconstruction: DocumentReconstruction,
): DocumentReconstructionSummary {
  return documentReconstruction.summary;
}

/**
 * Records that a piece of information used to reconstruct the document
 * came from a known origin. Never resolves, reads, or validates the
 * artifact `source.sourceId` points to — it only remembers that it was
 * used. Locked once the reconstruction reaches Approved, Rejected or
 * Archived.
 */
export function addReconstructionSource(input: AddReconstructionSourceInput): DocumentReconstructionResult {
  const { documentReconstruction } = input;
  const metadata = createMutationMetadata(documentReconstruction, input.metadata);
  const errors = validateSourcesMutable(documentReconstruction, metadata);

  errors.push(...validateReconstructionSourceShell(input.source, metadata));

  if (documentReconstruction.sources.some((existing) => existing.id === input.source.id)) {
    errors.push(
      createDocumentReconstructionError(
        "duplicate_reconstruction_source_id",
        "source.id",
        `Reconstruction source id ${input.source.id} already exists on this document reconstruction.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const sources = [...documentReconstruction.sources, buildReconstructionSource(input.source)];

  return freezeDomainObject<DocumentReconstructionSuccess>({
    success: true,
    documentReconstruction: {
      ...documentReconstruction,
      sources,
      trace: [
        ...documentReconstruction.trace,
        createTraceEntry(
          "reconstruction_source_added",
          input.actor,
          input.occurredAt,
          `Reconstruction source ${input.source.id} added to document reconstruction ${documentReconstruction.id}.`,
          metadata,
        ),
      ],
      summary: buildSummary(
        documentReconstruction.status,
        documentReconstruction.documentType,
        documentReconstruction.sections,
        sources,
        documentReconstruction.fields,
        documentReconstruction.issues,
      ),
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Removes a previously recorded source by its own `id`. Locked once the
 * reconstruction reaches Approved, Rejected or Archived.
 */
export function removeReconstructionSource(input: RemoveReconstructionSourceInput): DocumentReconstructionResult {
  const { documentReconstruction } = input;
  const metadata = createMutationMetadata(documentReconstruction, input.metadata);
  const errors = validateSourcesMutable(documentReconstruction, metadata);

  if (!documentReconstruction.sources.some((existing) => existing.id === input.id)) {
    errors.push(
      createDocumentReconstructionError(
        "reconstruction_source_not_found",
        "id",
        `Reconstruction source id ${input.id} is not present on this document reconstruction.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const sources = documentReconstruction.sources.filter((existing) => existing.id !== input.id);

  return freezeDomainObject<DocumentReconstructionSuccess>({
    success: true,
    documentReconstruction: {
      ...documentReconstruction,
      sources,
      trace: [
        ...documentReconstruction.trace,
        createTraceEntry(
          "reconstruction_source_removed",
          input.actor,
          input.occurredAt,
          `Reconstruction source ${input.id} removed from document reconstruction ${documentReconstruction.id}.`,
          metadata,
        ),
      ],
      summary: buildSummary(
        documentReconstruction.status,
        documentReconstruction.documentType,
        documentReconstruction.sections,
        sources,
        documentReconstruction.fields,
        documentReconstruction.issues,
      ),
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function findReconstructionSource(
  documentReconstruction: DocumentReconstruction,
  id: ReconstructionSourceId,
): ReconstructionSource | null {
  return documentReconstruction.sources.find((source) => source.id === id) ?? null;
}

export function listReconstructionSources(
  documentReconstruction: DocumentReconstruction,
): ReadonlyArray<ReconstructionSource> {
  return documentReconstruction.sources;
}

export function summarizeReconstructionSources(
  documentReconstruction: DocumentReconstruction,
): ReconstructionSourceSummary {
  const sources = documentReconstruction.sources;

  const totalByType: ReadonlyArray<ReconstructionSourceTypeCount> = Object.values(ReconstructionSourceType)
    .map((sourceType) => ({
      sourceType,
      total: sources.filter((source) => source.sourceType === sourceType).length,
    }))
    .filter((entry) => entry.total > 0);

  const averageConfidence =
    sources.length === 0 ? 0 : sources.reduce((sum, source) => sum + source.confidence, 0) / sources.length;

  return {
    totalSources: sources.length,
    totalByType,
    distinctSourceTypes: totalByType.length,
    averageConfidence,
  };
}

/**
 * Structures a new section of the reconstructed document. Never fills
 * data, never creates fields, never reconstructs anything — `fields`
 * and `issues` start as empty opaque-string arrays and `sourceIds`
 * starts empty; populating them is out of scope for this Epic. Locked
 * once the reconstruction reaches Approved, Rejected or Archived.
 */
export function addReconstructionSection(input: AddReconstructionSectionInput): DocumentReconstructionResult {
  const { documentReconstruction } = input;
  const metadata = createMutationMetadata(documentReconstruction, input.metadata);
  const errors = validateSectionsMutable(documentReconstruction, metadata);

  errors.push(...validateReconstructionSectionShell(input.section, metadata));

  if (documentReconstruction.sections.some((existing) => existing.id === input.section.id)) {
    errors.push(
      createDocumentReconstructionError(
        "duplicate_reconstruction_section_id",
        "section.id",
        `Reconstruction section id ${input.section.id} already exists on this document reconstruction.`,
        metadata,
      ),
    );
  }

  if (documentReconstruction.sections.some((existing) => existing.order === input.section.order)) {
    errors.push(
      createDocumentReconstructionError(
        "duplicate_reconstruction_section_order",
        "section.order",
        `Reconstruction section order ${input.section.order} already exists on this document reconstruction.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const sections = [...documentReconstruction.sections, buildReconstructionSection(input.section)];

  return freezeDomainObject<DocumentReconstructionSuccess>({
    success: true,
    documentReconstruction: {
      ...documentReconstruction,
      sections,
      trace: [
        ...documentReconstruction.trace,
        createTraceEntry(
          "reconstruction_section_added",
          input.actor,
          input.occurredAt,
          `Reconstruction section ${input.section.id} added to document reconstruction ${documentReconstruction.id}.`,
          metadata,
        ),
      ],
      summary: buildSummary(
        documentReconstruction.status,
        documentReconstruction.documentType,
        sections,
        documentReconstruction.sources,
        documentReconstruction.fields,
        documentReconstruction.issues,
      ),
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Removes a previously structured section by its own `id`. Locked once
 * the reconstruction reaches Approved, Rejected or Archived.
 */
export function removeReconstructionSection(input: RemoveReconstructionSectionInput): DocumentReconstructionResult {
  const { documentReconstruction } = input;
  const metadata = createMutationMetadata(documentReconstruction, input.metadata);
  const errors = validateSectionsMutable(documentReconstruction, metadata);

  if (!documentReconstruction.sections.some((existing) => existing.id === input.id)) {
    errors.push(
      createDocumentReconstructionError(
        "reconstruction_section_not_found",
        "id",
        `Reconstruction section id ${input.id} is not present on this document reconstruction.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const sections = documentReconstruction.sections.filter((existing) => existing.id !== input.id);

  return freezeDomainObject<DocumentReconstructionSuccess>({
    success: true,
    documentReconstruction: {
      ...documentReconstruction,
      sections,
      trace: [
        ...documentReconstruction.trace,
        createTraceEntry(
          "reconstruction_section_removed",
          input.actor,
          input.occurredAt,
          `Reconstruction section ${input.id} removed from document reconstruction ${documentReconstruction.id}.`,
          metadata,
        ),
      ],
      summary: buildSummary(
        documentReconstruction.status,
        documentReconstruction.documentType,
        sections,
        documentReconstruction.sources,
        documentReconstruction.fields,
        documentReconstruction.issues,
      ),
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Advances a single section's own status. Never touches the Aggregate
 * Root's `timeline` — only a `DocumentReconstruction` status change
 * (`advanceDocumentReconstructionStatus`) does that; a section status
 * change only ever grows `trace`. Locked once the reconstruction
 * reaches Approved, Rejected or Archived.
 */
export function advanceReconstructionSectionStatus(
  input: UpdateReconstructionSectionStatusInput,
): DocumentReconstructionResult {
  const { documentReconstruction, toStatus } = input;
  const metadata = createMutationMetadata(documentReconstruction, input.metadata);
  const errors = validateSectionsMutable(documentReconstruction, metadata);

  const section = documentReconstruction.sections.find((existing) => existing.id === input.id);

  if (section === undefined) {
    errors.push(
      createDocumentReconstructionError(
        "reconstruction_section_not_found",
        "id",
        `Reconstruction section id ${input.id} is not present on this document reconstruction.`,
        metadata,
      ),
    );
  } else if (isSectionTerminalStatus(section.status)) {
    errors.push(
      createDocumentReconstructionError(
        "reconstruction_section_terminal",
        "status",
        `Cannot transition reconstruction section from terminal status ${section.status}.`,
        metadata,
      ),
    );
  } else if (!canAdvanceSectionStatus(section.status, toStatus)) {
    errors.push(
      createDocumentReconstructionError(
        "invalid_reconstruction_section_status_transition",
        "status",
        `Cannot transition reconstruction section from ${section.status} to ${toStatus}.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0 || section === undefined) {
    return failureResult(errors, metadata);
  }

  const fromStatus = section.status;
  const sections = documentReconstruction.sections.map((existing) =>
    existing.id === input.id ? { ...existing, status: toStatus } : existing,
  );

  return freezeDomainObject<DocumentReconstructionSuccess>({
    success: true,
    documentReconstruction: {
      ...documentReconstruction,
      sections,
      trace: [
        ...documentReconstruction.trace,
        createTraceEntry(
          "reconstruction_section_status_advanced",
          input.actor,
          input.occurredAt,
          `Reconstruction section ${input.id} moved from ${fromStatus} to ${toStatus}.`,
          metadata,
        ),
      ],
      summary: buildSummary(
        documentReconstruction.status,
        documentReconstruction.documentType,
        sections,
        documentReconstruction.sources,
        documentReconstruction.fields,
        documentReconstruction.issues,
      ),
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function findReconstructionSection(
  documentReconstruction: DocumentReconstruction,
  id: ReconstructionSectionId,
): ReconstructionSection | null {
  return documentReconstruction.sections.find((section) => section.id === id) ?? null;
}

/**
 * Always returns sections ordered by `order` ascending — never by
 * insertion order. `order` is unique per `DocumentReconstruction`
 * (enforced by `addReconstructionSection`), so this ordering is stable.
 */
export function listReconstructionSections(
  documentReconstruction: DocumentReconstruction,
): ReadonlyArray<ReconstructionSection> {
  return Object.freeze([...documentReconstruction.sections].sort((a, b) => a.order - b.order));
}

export function summarizeReconstructionSections(
  documentReconstruction: DocumentReconstruction,
): ReconstructionSectionSummary {
  const sections = documentReconstruction.sections;

  return {
    totalSections: sections.length,
    completedSections: sections.filter((section) => section.status === ReconstructionSectionStatus.Completed).length,
    incompleteSections: sections.filter((section) => section.status === ReconstructionSectionStatus.Incomplete).length,
    draftSections: sections.filter((section) => section.status === ReconstructionSectionStatus.Draft).length,
    buildingSections: sections.filter((section) => section.status === ReconstructionSectionStatus.Building).length,
    archivedSections: sections.filter((section) => section.status === ReconstructionSectionStatus.Archived).length,
  };
}

/**
 * Structures a new field — the smallest unit of information of a
 * reconstructed document — under an existing section. `field.sectionId`
 * must already exist on this `DocumentReconstruction`. `value` always
 * starts `null` and `sourceIds` always starts empty; this Epic does not
 * execute any automatic reconstruction. The owning section's own
 * `fields` array (Epic 14.3) is kept in sync with the new field's id.
 * Locked once the reconstruction reaches Approved, Rejected or Archived.
 */
export function addReconstructionField(input: AddReconstructionFieldInput): DocumentReconstructionResult {
  const { documentReconstruction } = input;
  const metadata = createMutationMetadata(documentReconstruction, input.metadata);
  const errors = validateFieldsMutable(documentReconstruction, metadata);

  errors.push(...validateReconstructionFieldShell(input.field, metadata));

  const section = documentReconstruction.sections.find((existing) => existing.id === input.field.sectionId);

  if (!isBlank(input.field.sectionId) && section === undefined) {
    errors.push(
      createDocumentReconstructionError(
        "reconstruction_field_section_not_found",
        "field.sectionId",
        `Reconstruction section id ${input.field.sectionId} is not present on this document reconstruction.`,
        metadata,
      ),
    );
  }

  if (documentReconstruction.fields.some((existing) => existing.id === input.field.id)) {
    errors.push(
      createDocumentReconstructionError(
        "duplicate_reconstruction_field_id",
        "field.id",
        `Reconstruction field id ${input.field.id} already exists on this document reconstruction.`,
        metadata,
      ),
    );
  }

  if (
    documentReconstruction.fields.some(
      (existing) => existing.sectionId === input.field.sectionId && existing.key === input.field.key,
    )
  ) {
    errors.push(
      createDocumentReconstructionError(
        "duplicate_reconstruction_field_key",
        "field.key",
        `Reconstruction field key ${input.field.key} already exists in section ${input.field.sectionId}.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0 || section === undefined) {
    return failureResult(errors, metadata);
  }

  const newField = buildReconstructionField(input.field);
  const fields = [...documentReconstruction.fields, newField];
  const sections = documentReconstruction.sections.map((existing) =>
    existing.id === section.id ? { ...existing, fields: [...existing.fields, newField.id] } : existing,
  );

  return freezeDomainObject<DocumentReconstructionSuccess>({
    success: true,
    documentReconstruction: {
      ...documentReconstruction,
      sections,
      fields,
      trace: [
        ...documentReconstruction.trace,
        createTraceEntry(
          "reconstruction_field_added",
          input.actor,
          input.occurredAt,
          `Reconstruction field ${input.field.id} added to section ${input.field.sectionId}.`,
          metadata,
        ),
      ],
      summary: buildSummary(
        documentReconstruction.status,
        documentReconstruction.documentType,
        sections,
        documentReconstruction.sources,
        fields,
        documentReconstruction.issues,
      ),
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Removes a previously structured field by its own `id`. Keeps the
 * owning section's `fields` array in sync by removing the same id.
 * Locked once the reconstruction reaches Approved, Rejected or Archived.
 */
export function removeReconstructionField(input: RemoveReconstructionFieldInput): DocumentReconstructionResult {
  const { documentReconstruction } = input;
  const metadata = createMutationMetadata(documentReconstruction, input.metadata);
  const errors = validateFieldsMutable(documentReconstruction, metadata);

  const field = documentReconstruction.fields.find((existing) => existing.id === input.id);

  if (field === undefined) {
    errors.push(
      createDocumentReconstructionError(
        "reconstruction_field_not_found",
        "id",
        `Reconstruction field id ${input.id} is not present on this document reconstruction.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0 || field === undefined) {
    return failureResult(errors, metadata);
  }

  const fields = documentReconstruction.fields.filter((existing) => existing.id !== input.id);
  const sections = documentReconstruction.sections.map((existing) =>
    existing.id === field.sectionId
      ? { ...existing, fields: existing.fields.filter((fieldId) => fieldId !== input.id) }
      : existing,
  );

  return freezeDomainObject<DocumentReconstructionSuccess>({
    success: true,
    documentReconstruction: {
      ...documentReconstruction,
      sections,
      fields,
      trace: [
        ...documentReconstruction.trace,
        createTraceEntry(
          "reconstruction_field_removed",
          input.actor,
          input.occurredAt,
          `Reconstruction field ${input.id} removed from document reconstruction ${documentReconstruction.id}.`,
          metadata,
        ),
      ],
      summary: buildSummary(
        documentReconstruction.status,
        documentReconstruction.documentType,
        sections,
        documentReconstruction.sources,
        fields,
        documentReconstruction.issues,
      ),
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Sets a field's stored `value`. Never validates it against `valueType`
 * — this domain does not reconstruct, compute, or interpret values, it
 * only stores whatever a caller provides. Locked once the reconstruction
 * reaches Approved, Rejected or Archived.
 */
export function updateReconstructionFieldValue(
  input: UpdateReconstructionFieldValueInput,
): DocumentReconstructionResult {
  const { documentReconstruction } = input;
  const metadata = createMutationMetadata(documentReconstruction, input.metadata);
  const errors = validateFieldsMutable(documentReconstruction, metadata);

  if (!documentReconstruction.fields.some((existing) => existing.id === input.id)) {
    errors.push(
      createDocumentReconstructionError(
        "reconstruction_field_not_found",
        "id",
        `Reconstruction field id ${input.id} is not present on this document reconstruction.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const fields = documentReconstruction.fields.map((existing) =>
    existing.id === input.id ? { ...existing, value: input.value } : existing,
  );

  return freezeDomainObject<DocumentReconstructionSuccess>({
    success: true,
    documentReconstruction: {
      ...documentReconstruction,
      fields,
      trace: [
        ...documentReconstruction.trace,
        createTraceEntry(
          "reconstruction_field_value_updated",
          input.actor,
          input.occurredAt,
          `Reconstruction field ${input.id} value updated.`,
          metadata,
        ),
      ],
      summary: buildSummary(
        documentReconstruction.status,
        documentReconstruction.documentType,
        documentReconstruction.sections,
        documentReconstruction.sources,
        fields,
        documentReconstruction.issues,
      ),
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Advances a single field's own status. Never touches the Aggregate
 * Root's `timeline` — only a `DocumentReconstruction` status change
 * (`advanceDocumentReconstructionStatus`) does that; a field status
 * change only ever grows `trace`. Locked once the reconstruction
 * reaches Approved, Rejected or Archived.
 */
export function advanceReconstructionFieldStatus(
  input: UpdateReconstructionFieldStatusInput,
): DocumentReconstructionResult {
  const { documentReconstruction, toStatus } = input;
  const metadata = createMutationMetadata(documentReconstruction, input.metadata);
  const errors = validateFieldsMutable(documentReconstruction, metadata);

  const field = documentReconstruction.fields.find((existing) => existing.id === input.id);

  if (field === undefined) {
    errors.push(
      createDocumentReconstructionError(
        "reconstruction_field_not_found",
        "id",
        `Reconstruction field id ${input.id} is not present on this document reconstruction.`,
        metadata,
      ),
    );
  } else if (isFieldTerminalStatus(field.status)) {
    errors.push(
      createDocumentReconstructionError(
        "reconstruction_field_terminal",
        "status",
        `Cannot transition reconstruction field from terminal status ${field.status}.`,
        metadata,
      ),
    );
  } else if (!canAdvanceFieldStatus(field.status, toStatus)) {
    errors.push(
      createDocumentReconstructionError(
        "invalid_reconstruction_field_status_transition",
        "status",
        `Cannot transition reconstruction field from ${field.status} to ${toStatus}.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0 || field === undefined) {
    return failureResult(errors, metadata);
  }

  const fromStatus = field.status;
  const fields = documentReconstruction.fields.map((existing) =>
    existing.id === input.id ? { ...existing, status: toStatus } : existing,
  );

  return freezeDomainObject<DocumentReconstructionSuccess>({
    success: true,
    documentReconstruction: {
      ...documentReconstruction,
      fields,
      trace: [
        ...documentReconstruction.trace,
        createTraceEntry(
          "reconstruction_field_status_advanced",
          input.actor,
          input.occurredAt,
          `Reconstruction field ${input.id} moved from ${fromStatus} to ${toStatus}.`,
          metadata,
        ),
      ],
      summary: buildSummary(
        documentReconstruction.status,
        documentReconstruction.documentType,
        documentReconstruction.sections,
        documentReconstruction.sources,
        fields,
        documentReconstruction.issues,
      ),
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function findReconstructionField(
  documentReconstruction: DocumentReconstruction,
  id: ReconstructionFieldId,
): ReconstructionField | null {
  return documentReconstruction.fields.find((field) => field.id === id) ?? null;
}

/**
 * Always returns every field ordered first by its owning section's
 * `order`, then by `key` (ordinal comparison, locale-independent) —
 * never by insertion order.
 */
export function listReconstructionFields(
  documentReconstruction: DocumentReconstruction,
): ReadonlyArray<ReconstructionField> {
  const sectionOrderById = new Map<ReconstructionSectionId, number>(
    documentReconstruction.sections.map((section) => [section.id, section.order]),
  );

  const sorted = [...documentReconstruction.fields].sort((a, b) => {
    const orderDelta = (sectionOrderById.get(a.sectionId) ?? 0) - (sectionOrderById.get(b.sectionId) ?? 0);
    return orderDelta !== 0 ? orderDelta : compareKeysOrdinal(a.key, b.key);
  });

  return Object.freeze(sorted);
}

/**
 * Returns only the fields belonging to `sectionId`, always ordered
 * alphabetically (ordinal comparison) by `key`.
 */
export function listFieldsBySection(
  documentReconstruction: DocumentReconstruction,
  sectionId: ReconstructionSectionId,
): ReadonlyArray<ReconstructionField> {
  const sectionFields = documentReconstruction.fields.filter((field) => field.sectionId === sectionId);
  return Object.freeze(sectionFields.sort((a, b) => compareKeysOrdinal(a.key, b.key)));
}

function compareKeysOrdinal(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

export function summarizeReconstructionFields(
  documentReconstruction: DocumentReconstruction,
): ReconstructionFieldSummary {
  const fields = documentReconstruction.fields;
  const requiredFields = fields.filter((field) => field.required);

  return {
    totalFields: fields.length,
    completedFields: fields.filter((field) => field.status === ReconstructionFieldStatus.Completed).length,
    incompleteFields: fields.filter((field) => field.status === ReconstructionFieldStatus.Incomplete).length,
    draftFields: fields.filter((field) => field.status === ReconstructionFieldStatus.Draft).length,
    buildingFields: fields.filter((field) => field.status === ReconstructionFieldStatus.Building).length,
    archivedFields: fields.filter((field) => field.status === ReconstructionFieldStatus.Archived).length,
    requiredFields: requiredFields.length,
    completedRequiredFields: requiredFields.filter((field) => field.status === ReconstructionFieldStatus.Completed)
      .length,
    averageConfidence: fields.length === 0 ? 0 : fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length,
  };
}

function isTerminalStatus(status: DocumentReconstructionStatus): boolean {
  return status === DocumentReconstructionStatus.Archived;
}

function canAdvanceStatus(
  fromStatus: DocumentReconstructionStatus,
  toStatus: DocumentReconstructionStatus,
): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

/**
 * `Reconstructing` deliberately has no direct path to `Archived`: once a
 * reconstruction is actively in progress it must first reach a decision
 * point (`Reconstructed` or `Incomplete`) before it can be archived.
 * Every other non-terminal status may archive directly.
 */
const allowedTransitions: Readonly<
  Record<DocumentReconstructionStatus, ReadonlyArray<DocumentReconstructionStatus>>
> = {
  [DocumentReconstructionStatus.Draft]: [
    DocumentReconstructionStatus.Reconstructing,
    DocumentReconstructionStatus.Archived,
  ],
  [DocumentReconstructionStatus.Reconstructing]: [
    DocumentReconstructionStatus.Reconstructed,
    DocumentReconstructionStatus.Incomplete,
  ],
  [DocumentReconstructionStatus.Reconstructed]: [
    DocumentReconstructionStatus.ReadyForReview,
    DocumentReconstructionStatus.Archived,
  ],
  [DocumentReconstructionStatus.Incomplete]: [
    DocumentReconstructionStatus.Reconstructing,
    DocumentReconstructionStatus.Archived,
  ],
  [DocumentReconstructionStatus.ReadyForReview]: [
    DocumentReconstructionStatus.Approved,
    DocumentReconstructionStatus.Rejected,
    DocumentReconstructionStatus.Archived,
  ],
  [DocumentReconstructionStatus.Approved]: [DocumentReconstructionStatus.Archived],
  [DocumentReconstructionStatus.Rejected]: [DocumentReconstructionStatus.Archived],
  [DocumentReconstructionStatus.Archived]: [],
};

function isSectionTerminalStatus(status: ReconstructionSectionStatus): boolean {
  return status === ReconstructionSectionStatus.Archived;
}

function canAdvanceSectionStatus(
  fromStatus: ReconstructionSectionStatus,
  toStatus: ReconstructionSectionStatus,
): boolean {
  return allowedSectionTransitions[fromStatus].includes(toStatus);
}

/**
 * `Building` mirrors the Aggregate Root's `Reconstructing`: no direct
 * path to `Archived` while a section is actively being built — it must
 * first reach a decision point (`Completed` or `Incomplete`).
 */
const allowedSectionTransitions: Readonly<
  Record<ReconstructionSectionStatus, ReadonlyArray<ReconstructionSectionStatus>>
> = {
  [ReconstructionSectionStatus.Draft]: [
    ReconstructionSectionStatus.Building,
    ReconstructionSectionStatus.Archived,
  ],
  [ReconstructionSectionStatus.Building]: [
    ReconstructionSectionStatus.Completed,
    ReconstructionSectionStatus.Incomplete,
  ],
  [ReconstructionSectionStatus.Completed]: [ReconstructionSectionStatus.Archived],
  [ReconstructionSectionStatus.Incomplete]: [
    ReconstructionSectionStatus.Building,
    ReconstructionSectionStatus.Archived,
  ],
  [ReconstructionSectionStatus.Archived]: [],
};

function isFieldTerminalStatus(status: ReconstructionFieldStatus): boolean {
  return status === ReconstructionFieldStatus.Archived;
}

function canAdvanceFieldStatus(
  fromStatus: ReconstructionFieldStatus,
  toStatus: ReconstructionFieldStatus,
): boolean {
  return allowedFieldTransitions[fromStatus].includes(toStatus);
}

/**
 * Mirrors `allowedSectionTransitions`: `Building` has no direct path to
 * `Archived` while a field is actively being built — it must first
 * reach a decision point (`Completed` or `Incomplete`).
 */
const allowedFieldTransitions: Readonly<
  Record<ReconstructionFieldStatus, ReadonlyArray<ReconstructionFieldStatus>>
> = {
  [ReconstructionFieldStatus.Draft]: [ReconstructionFieldStatus.Building, ReconstructionFieldStatus.Archived],
  [ReconstructionFieldStatus.Building]: [
    ReconstructionFieldStatus.Completed,
    ReconstructionFieldStatus.Incomplete,
  ],
  [ReconstructionFieldStatus.Completed]: [ReconstructionFieldStatus.Archived],
  [ReconstructionFieldStatus.Incomplete]: [
    ReconstructionFieldStatus.Building,
    ReconstructionFieldStatus.Archived,
  ],
  [ReconstructionFieldStatus.Archived]: [],
};

/**
 * A reconstruction is "complete" once it has left the in-progress
 * statuses (`Draft`, `Reconstructing`, `Incomplete`), regardless of the
 * later path it takes (review, approval, rejection or archival).
 */
const INCOMPLETE_STATUSES: ReadonlyArray<DocumentReconstructionStatus> = [
  DocumentReconstructionStatus.Draft,
  DocumentReconstructionStatus.Reconstructing,
  DocumentReconstructionStatus.Incomplete,
];

function buildSummary(
  status: DocumentReconstructionStatus,
  documentType: DocumentReconstructionDocumentType,
  sections: ReadonlyArray<ReconstructionSection>,
  sources: ReadonlyArray<ReconstructionSource>,
  fields: ReadonlyArray<ReconstructionField>,
  issues: ReadonlyArray<DocumentReconstructionIssue>,
): DocumentReconstructionSummary {
  return {
    totalSections: sections.length,
    totalIssues: issues.length,
    totalSources: sources.length,
    totalFields: fields.length,
    status,
    documentType,
    isComplete: !INCOMPLETE_STATUSES.includes(status),
  };
}

function validateShell(
  input: CreateDocumentReconstructionInput,
  metadata: DocumentReconstructionMetadata,
): DocumentReconstructionError[] {
  const errors: DocumentReconstructionError[] = [];

  if (isBlank(input.id)) {
    errors.push(
      createDocumentReconstructionError("missing_id", "id", "Document reconstruction id is required.", metadata),
    );
  }

  if (isBlank(input.title)) {
    errors.push(
      createDocumentReconstructionError(
        "missing_title",
        "title",
        "Document reconstruction title is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.documentType)) {
    errors.push(
      createDocumentReconstructionError(
        "missing_document_type",
        "documentType",
        "Document reconstruction document type is required.",
        metadata,
      ),
    );
  }

  return errors;
}

function validateSourcesMutable(
  documentReconstruction: DocumentReconstruction,
  metadata: DocumentReconstructionMetadata,
): DocumentReconstructionError[] {
  const errors: DocumentReconstructionError[] = [];

  if (
    documentReconstruction.status === DocumentReconstructionStatus.Approved ||
    documentReconstruction.status === DocumentReconstructionStatus.Rejected ||
    documentReconstruction.status === DocumentReconstructionStatus.Archived
  ) {
    errors.push(
      createDocumentReconstructionError(
        "document_reconstruction_locked_for_source_changes",
        "status",
        `Cannot change sources while document reconstruction status is ${documentReconstruction.status}.`,
        metadata,
      ),
    );
  }

  return errors;
}

function validateReconstructionSourceShell(
  source: ReconstructionSourceInput,
  metadata: DocumentReconstructionMetadata,
): DocumentReconstructionError[] {
  const errors: DocumentReconstructionError[] = [];

  if (isBlank(source.id)) {
    errors.push(
      createDocumentReconstructionError(
        "missing_reconstruction_source_id",
        "source.id",
        "Reconstruction source id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(source.sourceType)) {
    errors.push(
      createDocumentReconstructionError(
        "missing_reconstruction_source_type",
        "source.sourceType",
        "Reconstruction source type is required.",
        metadata,
      ),
    );
  }

  if (isBlank(source.sourceId)) {
    errors.push(
      createDocumentReconstructionError(
        "missing_reconstruction_source_reference_id",
        "source.sourceId",
        "Reconstruction source reference id is required.",
        metadata,
      ),
    );
  }

  if (!Number.isFinite(source.confidence) || source.confidence < 0 || source.confidence > 1) {
    errors.push(
      createDocumentReconstructionError(
        "invalid_reconstruction_source_confidence",
        "source.confidence",
        `Reconstruction source confidence must be a number between 0 and 1, got ${source.confidence}.`,
        metadata,
      ),
    );
  }

  return errors;
}

function buildReconstructionSource(source: ReconstructionSourceInput): ReconstructionSource {
  return {
    id: source.id,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    description: source.description ?? null,
    confidence: source.confidence,
    metadata: source.metadata ?? {},
  };
}

function validateSectionsMutable(
  documentReconstruction: DocumentReconstruction,
  metadata: DocumentReconstructionMetadata,
): DocumentReconstructionError[] {
  const errors: DocumentReconstructionError[] = [];

  if (
    documentReconstruction.status === DocumentReconstructionStatus.Approved ||
    documentReconstruction.status === DocumentReconstructionStatus.Rejected ||
    documentReconstruction.status === DocumentReconstructionStatus.Archived
  ) {
    errors.push(
      createDocumentReconstructionError(
        "document_reconstruction_locked_for_section_changes",
        "status",
        `Cannot change sections while document reconstruction status is ${documentReconstruction.status}.`,
        metadata,
      ),
    );
  }

  return errors;
}

function validateReconstructionSectionShell(
  section: ReconstructionSectionInput,
  metadata: DocumentReconstructionMetadata,
): DocumentReconstructionError[] {
  const errors: DocumentReconstructionError[] = [];

  if (isBlank(section.id)) {
    errors.push(
      createDocumentReconstructionError(
        "missing_reconstruction_section_id",
        "section.id",
        "Reconstruction section id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(section.title)) {
    errors.push(
      createDocumentReconstructionError(
        "missing_reconstruction_section_title",
        "section.title",
        "Reconstruction section title is required.",
        metadata,
      ),
    );
  }

  if (!Number.isInteger(section.order) || section.order <= 0) {
    errors.push(
      createDocumentReconstructionError(
        "invalid_reconstruction_section_order",
        "section.order",
        `Reconstruction section order must be a positive integer, got ${section.order}.`,
        metadata,
      ),
    );
  }

  return errors;
}

function buildReconstructionSection(section: ReconstructionSectionInput): ReconstructionSection {
  return {
    id: section.id,
    title: section.title,
    description: section.description ?? null,
    order: section.order,
    status: ReconstructionSectionStatus.Draft,
    fields: [],
    sourceIds: [],
    issues: [],
    metadata: section.metadata ?? {},
  };
}

function validateFieldsMutable(
  documentReconstruction: DocumentReconstruction,
  metadata: DocumentReconstructionMetadata,
): DocumentReconstructionError[] {
  const errors: DocumentReconstructionError[] = [];

  if (
    documentReconstruction.status === DocumentReconstructionStatus.Approved ||
    documentReconstruction.status === DocumentReconstructionStatus.Rejected ||
    documentReconstruction.status === DocumentReconstructionStatus.Archived
  ) {
    errors.push(
      createDocumentReconstructionError(
        "document_reconstruction_locked_for_field_changes",
        "status",
        `Cannot change fields while document reconstruction status is ${documentReconstruction.status}.`,
        metadata,
      ),
    );
  }

  return errors;
}

function validateReconstructionFieldShell(
  field: ReconstructionFieldInput,
  metadata: DocumentReconstructionMetadata,
): DocumentReconstructionError[] {
  const errors: DocumentReconstructionError[] = [];

  if (isBlank(field.id)) {
    errors.push(
      createDocumentReconstructionError(
        "missing_reconstruction_field_id",
        "field.id",
        "Reconstruction field id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(field.sectionId)) {
    errors.push(
      createDocumentReconstructionError(
        "missing_reconstruction_field_section_id",
        "field.sectionId",
        "Reconstruction field section id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(field.key)) {
    errors.push(
      createDocumentReconstructionError(
        "missing_reconstruction_field_key",
        "field.key",
        "Reconstruction field key is required.",
        metadata,
      ),
    );
  }

  if (isBlank(field.label)) {
    errors.push(
      createDocumentReconstructionError(
        "missing_reconstruction_field_label",
        "field.label",
        "Reconstruction field label is required.",
        metadata,
      ),
    );
  }

  if (isBlank(field.valueType)) {
    errors.push(
      createDocumentReconstructionError(
        "missing_reconstruction_field_value_type",
        "field.valueType",
        "Reconstruction field value type is required.",
        metadata,
      ),
    );
  }

  if (!Number.isFinite(field.confidence) || field.confidence < 0 || field.confidence > 1) {
    errors.push(
      createDocumentReconstructionError(
        "invalid_reconstruction_field_confidence",
        "field.confidence",
        `Reconstruction field confidence must be a number between 0 and 1, got ${field.confidence}.`,
        metadata,
      ),
    );
  }

  return errors;
}

function buildReconstructionField(field: ReconstructionFieldInput): ReconstructionField {
  return {
    id: field.id,
    sectionId: field.sectionId,
    key: field.key,
    label: field.label,
    value: null,
    valueType: field.valueType,
    status: ReconstructionFieldStatus.Draft,
    required: field.required,
    confidence: field.confidence,
    sourceIds: [],
    metadata: field.metadata ?? {},
  };
}

function failureResult(
  errors: ReadonlyArray<DocumentReconstructionError>,
  metadata: DocumentReconstructionMetadata,
): DocumentReconstructionFailure {
  return freezeDomainObject<DocumentReconstructionFailure>({
    success: false,
    documentReconstruction: null,
    errors,
    warnings: [],
    metadata,
  });
}

function createTimelineEvent(
  type: string,
  occurredAt: string,
  description: string,
  metadata: DocumentReconstructionMetadata,
): DocumentReconstructionTimelineEvent {
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
  metadata: DocumentReconstructionMetadata,
): DocumentReconstructionTrace {
  return {
    action,
    actor,
    occurredAt,
    description,
    metadata,
  };
}

function createDocumentReconstructionError(
  code: DocumentReconstructionErrorCode,
  field: string,
  message: string,
  metadata: DocumentReconstructionMetadata,
): DocumentReconstructionError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createShellMetadata(input: CreateDocumentReconstructionInput): DocumentReconstructionMetadata {
  return {
    ...(input.metadata ?? {}),
    documentReconstructionId: input.id,
    title: input.title,
    documentType: input.documentType,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createMutationMetadata(
  documentReconstruction: DocumentReconstruction,
  extraMetadata: DocumentReconstructionMetadata | undefined,
): DocumentReconstructionMetadata {
  return {
    ...documentReconstruction.metadata,
    ...(extraMetadata ?? {}),
    documentReconstructionId: documentReconstruction.id,
    title: documentReconstruction.title,
    documentType: documentReconstruction.documentType,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

type FreezableRecord = Record<PropertyKey, unknown>;

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
