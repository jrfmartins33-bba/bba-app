import type {
  ActivateOfficialTemplateInput,
  AddOfficialTemplateFieldInput,
  AddOfficialTemplatePlaceholderInput,
  AddOfficialTemplateSectionInput,
  ArchiveOfficialTemplateInput,
  CreateOfficialTemplateInput,
  DeprecateOfficialTemplateInput,
  OfficialTemplate,
  OfficialTemplateError,
  OfficialTemplateFailure,
  OfficialTemplateField,
  OfficialTemplateFieldInput,
  OfficialTemplateMetadata,
  OfficialTemplatePlaceholder,
  OfficialTemplatePlaceholderInput,
  OfficialTemplateResult,
  OfficialTemplateSection,
  OfficialTemplateSectionInput,
  OfficialTemplateSuccess,
  OfficialTemplateSummary,
  OfficialTemplateValidationRule,
  OfficialTemplateValidationRuleInput,
  TemplateTimelineEntry,
  TemplateTraceEntry,
} from "./official-template-engine.types";
import { OfficialTemplateStatus, OfficialTemplateValidationRuleSeverity } from "./official-template-engine.types";
import { freezeDomainObject, isBlank } from "./official-template-shared";

export function createOfficialTemplate(input: CreateOfficialTemplateInput): OfficialTemplateResult {
  const metadata = createTemplateMetadata(input);
  const sectionInputs = input.sections ?? [];
  const fieldInputs = input.fields ?? [];
  const placeholderInputs = input.placeholders ?? [];
  const validationRuleInputs = input.validationRules ?? [];

  const errors = [
    ...validateTemplateShell(input, metadata),
    ...validateSectionBatch(sectionInputs, metadata),
    ...validateFieldBatch(fieldInputs, metadata),
    ...validatePlaceholderBatch(placeholderInputs, fieldInputs, metadata),
    ...validateValidationRuleBatch(validationRuleInputs, fieldInputs, metadata),
  ];

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const template: OfficialTemplate = {
    id: input.id,
    name: input.name,
    documentType: input.documentType,
    version: input.version,
    description: input.description ?? null,
    status: OfficialTemplateStatus.Draft,
    sections: buildSections(sectionInputs),
    fields: buildFields(fieldInputs),
    placeholders: buildPlaceholders(placeholderInputs),
    validationRules: buildValidationRules(validationRuleInputs),
    timeline: [
      createTimelineEntry(
        "template_created",
        input.occurredAt,
        `Official template ${input.name} (${input.documentType}) created.`,
        metadata,
      ),
    ],
    trace: [
      createTraceEntry(
        "template_created",
        input.actor,
        input.occurredAt,
        `Official template ${input.id} created.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<OfficialTemplateSuccess>({
    success: true,
    template,
    errors: [],
    warnings: [],
    metadata,
  });
}

export function activateOfficialTemplate(input: ActivateOfficialTemplateInput): OfficialTemplateResult {
  const metadata = createMutationMetadata(input.template, input.metadata);
  const transitionError = validateStatusTransition(input.template, OfficialTemplateStatus.Active, metadata);

  if (transitionError) {
    return failureResult([transitionError], metadata);
  }

  const errors: OfficialTemplateError[] = [];

  if (input.template.sections.length === 0) {
    errors.push(
      createTemplateError(
        "template_cannot_activate_without_section",
        "sections",
        "Cannot activate a template with no sections.",
        metadata,
      ),
    );
  }

  if (!input.template.fields.some((field) => field.required)) {
    errors.push(
      createTemplateError(
        "template_cannot_activate_without_required_field",
        "fields",
        "Cannot activate a template with no required field.",
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  return successWithUpdate(
    input.template,
    { status: OfficialTemplateStatus.Active },
    createTimelineEntry(
      "template_activated",
      input.occurredAt,
      `Template ${input.template.name} activated.`,
      metadata,
    ),
    createTraceEntry(
      "template_activated",
      input.actor,
      input.occurredAt,
      `Template ${input.template.id} activated.`,
      metadata,
    ),
    metadata,
  );
}

export function deprecateOfficialTemplate(input: DeprecateOfficialTemplateInput): OfficialTemplateResult {
  const metadata = createMutationMetadata(input.template, input.metadata);
  const transitionError = validateStatusTransition(input.template, OfficialTemplateStatus.Deprecated, metadata);

  if (transitionError) {
    return failureResult([transitionError], metadata);
  }

  return successWithUpdate(
    input.template,
    { status: OfficialTemplateStatus.Deprecated },
    createTimelineEntry(
      "template_deprecated",
      input.occurredAt,
      `Template ${input.template.name} deprecated.`,
      metadata,
    ),
    createTraceEntry(
      "template_deprecated",
      input.actor,
      input.occurredAt,
      `Template ${input.template.id} deprecated.`,
      metadata,
    ),
    metadata,
  );
}

export function archiveOfficialTemplate(input: ArchiveOfficialTemplateInput): OfficialTemplateResult {
  const metadata = createMutationMetadata(input.template, input.metadata);
  const transitionError = validateStatusTransition(input.template, OfficialTemplateStatus.Archived, metadata);

  if (transitionError) {
    return failureResult([transitionError], metadata);
  }

  return successWithUpdate(
    input.template,
    { status: OfficialTemplateStatus.Archived },
    createTimelineEntry(
      "template_archived",
      input.occurredAt,
      `Template ${input.template.name} archived.`,
      metadata,
    ),
    createTraceEntry(
      "template_archived",
      input.actor,
      input.occurredAt,
      `Template ${input.template.id} archived.`,
      metadata,
    ),
    metadata,
  );
}

export function addOfficialTemplateSection(input: AddOfficialTemplateSectionInput): OfficialTemplateResult {
  const metadata = createMutationMetadata(input.template, input.metadata);
  const errors = validateStructuralMutable(input.template, metadata);

  errors.push(...validateSingleSection(input.section, metadata));

  if (input.template.sections.some((existing) => existing.id === input.section.id)) {
    errors.push(
      createTemplateError(
        "duplicate_section_id",
        "section.id",
        `Section id ${input.section.id} already exists in this template.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const sections = [...input.template.sections, buildSection(input.section)];

  return successWithUpdate(
    input.template,
    { sections },
    null,
    createTraceEntry(
      "section_added",
      input.actor,
      input.occurredAt,
      `Section ${input.section.id} added.`,
      metadata,
    ),
    metadata,
  );
}

export function addOfficialTemplateField(input: AddOfficialTemplateFieldInput): OfficialTemplateResult {
  const metadata = createMutationMetadata(input.template, input.metadata);
  const errors = validateStructuralMutable(input.template, metadata);

  errors.push(...validateSingleField(input.field, metadata));

  if (input.template.fields.some((existing) => existing.id === input.field.id)) {
    errors.push(
      createTemplateError(
        "duplicate_field_id",
        "field.id",
        `Field id ${input.field.id} already exists in this template.`,
        metadata,
      ),
    );
  }

  if (input.template.fields.some((existing) => existing.key === input.field.key)) {
    errors.push(
      createTemplateError(
        "duplicate_field_key",
        "field.key",
        `Field key ${input.field.key} already exists in this template.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const fields = [...input.template.fields, buildField(input.field)];

  return successWithUpdate(
    input.template,
    { fields },
    null,
    createTraceEntry(
      "field_added",
      input.actor,
      input.occurredAt,
      `Field ${input.field.id} added.`,
      metadata,
    ),
    metadata,
  );
}

export function addOfficialTemplatePlaceholder(
  input: AddOfficialTemplatePlaceholderInput,
): OfficialTemplateResult {
  const metadata = createMutationMetadata(input.template, input.metadata);
  const errors = validateStructuralMutable(input.template, metadata);

  errors.push(...validateSinglePlaceholder(input.placeholder, metadata));

  if (input.template.placeholders.some((existing) => existing.key === input.placeholder.key)) {
    errors.push(
      createTemplateError(
        "duplicate_placeholder_key",
        "placeholder.key",
        `Placeholder key ${input.placeholder.key} already exists in this template.`,
        metadata,
      ),
    );
  }

  const fieldKey = input.placeholder.fieldKey ?? null;
  if (fieldKey !== null && !input.template.fields.some((field) => field.key === fieldKey)) {
    errors.push(
      createTemplateError(
        "unknown_field_reference",
        "placeholder.fieldKey",
        `Placeholder references unknown field key ${fieldKey}.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const placeholders = [...input.template.placeholders, buildPlaceholder(input.placeholder)];

  return successWithUpdate(
    input.template,
    { placeholders },
    null,
    createTraceEntry(
      "placeholder_added",
      input.actor,
      input.occurredAt,
      `Placeholder ${input.placeholder.key} added.`,
      metadata,
    ),
    metadata,
  );
}

export function summarizeOfficialTemplate(template: OfficialTemplate): OfficialTemplateSummary {
  return {
    totalSections: template.sections.length,
    totalFields: template.fields.length,
    requiredFields: template.fields.filter((field) => field.required).length,
    totalPlaceholders: template.placeholders.length,
    totalValidationRules: template.validationRules.length,
  };
}

function isTerminalStatus(status: OfficialTemplateStatus): boolean {
  return status === OfficialTemplateStatus.Archived;
}

function canAdvanceStatus(fromStatus: OfficialTemplateStatus, toStatus: OfficialTemplateStatus): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

const allowedTransitions: Readonly<Record<OfficialTemplateStatus, ReadonlyArray<OfficialTemplateStatus>>> = {
  [OfficialTemplateStatus.Draft]: [OfficialTemplateStatus.Active, OfficialTemplateStatus.Archived],
  [OfficialTemplateStatus.Active]: [OfficialTemplateStatus.Deprecated, OfficialTemplateStatus.Archived],
  [OfficialTemplateStatus.Deprecated]: [OfficialTemplateStatus.Archived],
  [OfficialTemplateStatus.Archived]: [],
};

function validateStatusTransition(
  template: OfficialTemplate,
  toStatus: OfficialTemplateStatus,
  metadata: OfficialTemplateMetadata,
): OfficialTemplateError | null {
  const fromStatus = template.status;

  if (isTerminalStatus(fromStatus)) {
    return createTemplateError(
      "template_terminal",
      "status",
      `Cannot transition template from terminal status ${fromStatus}.`,
      metadata,
    );
  }

  if (!canAdvanceStatus(fromStatus, toStatus)) {
    return createTemplateError(
      "invalid_official_template_status_transition",
      "status",
      `Cannot transition template from ${fromStatus} to ${toStatus}.`,
      metadata,
    );
  }

  return null;
}

function validateStructuralMutable(
  template: OfficialTemplate,
  metadata: OfficialTemplateMetadata,
): OfficialTemplateError[] {
  const errors: OfficialTemplateError[] = [];

  if (template.status === OfficialTemplateStatus.Deprecated || template.status === OfficialTemplateStatus.Archived) {
    errors.push(
      createTemplateError(
        "template_locked_for_structural_changes",
        "status",
        `Cannot add structural elements while template status is ${template.status}.`,
        metadata,
      ),
    );
  }

  return errors;
}

function successWithUpdate(
  template: OfficialTemplate,
  patch: Partial<OfficialTemplate>,
  timelineEntry: TemplateTimelineEntry | null,
  traceEntry: TemplateTraceEntry,
  metadata: OfficialTemplateMetadata,
): OfficialTemplateSuccess {
  return freezeDomainObject<OfficialTemplateSuccess>({
    success: true,
    template: {
      ...template,
      ...patch,
      timeline: timelineEntry ? [...template.timeline, timelineEntry] : template.timeline,
      trace: [...template.trace, traceEntry],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

function validateTemplateShell(
  input: CreateOfficialTemplateInput,
  metadata: OfficialTemplateMetadata,
): OfficialTemplateError[] {
  const errors: OfficialTemplateError[] = [];

  if (isBlank(input.id)) {
    errors.push(createTemplateError("missing_id", "id", "Template id is required.", metadata));
  }

  if (isBlank(input.name)) {
    errors.push(createTemplateError("missing_name", "name", "Template name is required.", metadata));
  }

  if (isBlank(input.documentType)) {
    errors.push(
      createTemplateError(
        "missing_document_type",
        "documentType",
        "Template document type is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.version)) {
    errors.push(
      createTemplateError("missing_version", "version", "Template version is required.", metadata),
    );
  }

  return errors;
}

function validateSectionBatch(
  sections: ReadonlyArray<OfficialTemplateSectionInput>,
  metadata: OfficialTemplateMetadata,
): OfficialTemplateError[] {
  const errors: OfficialTemplateError[] = [];
  const seenIds = new Set<string>();

  sections.forEach((section) => {
    errors.push(...validateSingleSection(section, metadata));

    if (!isBlank(section.id)) {
      if (seenIds.has(section.id)) {
        errors.push(
          createTemplateError(
            "duplicate_section_id",
            "sections",
            `Section id ${section.id} is duplicated.`,
            metadata,
          ),
        );
      } else {
        seenIds.add(section.id);
      }
    }
  });

  return errors;
}

function validateSingleSection(
  section: OfficialTemplateSectionInput,
  metadata: OfficialTemplateMetadata,
): OfficialTemplateError[] {
  const errors: OfficialTemplateError[] = [];

  if (isBlank(section.id)) {
    errors.push(
      createTemplateError("missing_section_id", "section.id", "Section id is required.", metadata),
    );
  }

  if (!Number.isInteger(section.order) || section.order <= 0) {
    errors.push(
      createTemplateError(
        "invalid_section_order",
        "section.order",
        `Section ${section.id} order must be a positive integer, got ${section.order}.`,
        metadata,
      ),
    );
  }

  return errors;
}

function validateFieldBatch(
  fields: ReadonlyArray<OfficialTemplateFieldInput>,
  metadata: OfficialTemplateMetadata,
): OfficialTemplateError[] {
  const errors: OfficialTemplateError[] = [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();

  fields.forEach((field) => {
    errors.push(...validateSingleField(field, metadata));

    if (!isBlank(field.id)) {
      if (seenIds.has(field.id)) {
        errors.push(
          createTemplateError(
            "duplicate_field_id",
            "fields",
            `Field id ${field.id} is duplicated.`,
            metadata,
          ),
        );
      } else {
        seenIds.add(field.id);
      }
    }

    if (!isBlank(field.key)) {
      if (seenKeys.has(field.key)) {
        errors.push(
          createTemplateError(
            "duplicate_field_key",
            "fields",
            `Field key ${field.key} is duplicated.`,
            metadata,
          ),
        );
      } else {
        seenKeys.add(field.key);
      }
    }
  });

  return errors;
}

function validateSingleField(
  field: OfficialTemplateFieldInput,
  metadata: OfficialTemplateMetadata,
): OfficialTemplateError[] {
  const errors: OfficialTemplateError[] = [];

  if (isBlank(field.id)) {
    errors.push(createTemplateError("missing_field_id", "field.id", "Field id is required.", metadata));
  }

  if (isBlank(field.key)) {
    errors.push(
      createTemplateError("missing_field_key", "field.key", "Field key is required.", metadata),
    );
  }

  return errors;
}

function validatePlaceholderBatch(
  placeholders: ReadonlyArray<OfficialTemplatePlaceholderInput>,
  fields: ReadonlyArray<OfficialTemplateFieldInput>,
  metadata: OfficialTemplateMetadata,
): OfficialTemplateError[] {
  const errors: OfficialTemplateError[] = [];
  const seenKeys = new Set<string>();
  const fieldKeys = new Set(fields.map((field) => field.key));

  placeholders.forEach((placeholder) => {
    errors.push(...validateSinglePlaceholder(placeholder, metadata));

    if (!isBlank(placeholder.key)) {
      if (seenKeys.has(placeholder.key)) {
        errors.push(
          createTemplateError(
            "duplicate_placeholder_key",
            "placeholders",
            `Placeholder key ${placeholder.key} is duplicated.`,
            metadata,
          ),
        );
      } else {
        seenKeys.add(placeholder.key);
      }
    }

    const fieldKey = placeholder.fieldKey ?? null;
    if (fieldKey !== null && !fieldKeys.has(fieldKey)) {
      errors.push(
        createTemplateError(
          "unknown_field_reference",
          "placeholder.fieldKey",
          `Placeholder ${placeholder.key} references unknown field key ${fieldKey}.`,
          metadata,
        ),
      );
    }
  });

  return errors;
}

function validateSinglePlaceholder(
  placeholder: OfficialTemplatePlaceholderInput,
  metadata: OfficialTemplateMetadata,
): OfficialTemplateError[] {
  const errors: OfficialTemplateError[] = [];

  if (isBlank(placeholder.key)) {
    errors.push(
      createTemplateError(
        "missing_placeholder_key",
        "placeholder.key",
        "Placeholder key is required.",
        metadata,
      ),
    );
  }

  return errors;
}

function validateValidationRuleBatch(
  validationRules: ReadonlyArray<OfficialTemplateValidationRuleInput>,
  fields: ReadonlyArray<OfficialTemplateFieldInput>,
  metadata: OfficialTemplateMetadata,
): OfficialTemplateError[] {
  const errors: OfficialTemplateError[] = [];
  const seenIds = new Set<string>();
  const fieldKeys = new Set(fields.map((field) => field.key));

  validationRules.forEach((rule) => {
    if (isBlank(rule.id)) {
      errors.push(
        createTemplateError(
          "missing_validation_rule_id",
          "validationRule.id",
          "Validation rule id is required.",
          metadata,
        ),
      );
    } else if (seenIds.has(rule.id)) {
      errors.push(
        createTemplateError(
          "duplicate_validation_rule_id",
          "validationRules",
          `Validation rule id ${rule.id} is duplicated.`,
          metadata,
        ),
      );
    } else {
      seenIds.add(rule.id);
    }

    const appliesToFieldKey = rule.appliesToFieldKey ?? null;
    if (appliesToFieldKey !== null && !fieldKeys.has(appliesToFieldKey)) {
      errors.push(
        createTemplateError(
          "unknown_field_reference",
          "validationRule.appliesToFieldKey",
          `Validation rule ${rule.id} references unknown field key ${appliesToFieldKey}.`,
          metadata,
        ),
      );
    }
  });

  return errors;
}

function buildSections(
  sectionInputs: ReadonlyArray<OfficialTemplateSectionInput>,
): ReadonlyArray<OfficialTemplateSection> {
  return sectionInputs.map((section) => buildSection(section));
}

function buildSection(section: OfficialTemplateSectionInput): OfficialTemplateSection {
  return {
    id: section.id,
    title: section.title,
    order: section.order,
    description: section.description ?? null,
    metadata: section.metadata ?? {},
  };
}

function buildFields(fieldInputs: ReadonlyArray<OfficialTemplateFieldInput>): ReadonlyArray<OfficialTemplateField> {
  return fieldInputs.map((field) => buildField(field));
}

function buildField(field: OfficialTemplateFieldInput): OfficialTemplateField {
  return {
    id: field.id,
    key: field.key,
    sectionId: field.sectionId ?? null,
    label: field.label,
    required: field.required ?? false,
    description: field.description ?? null,
    metadata: field.metadata ?? {},
  };
}

function buildPlaceholders(
  placeholderInputs: ReadonlyArray<OfficialTemplatePlaceholderInput>,
): ReadonlyArray<OfficialTemplatePlaceholder> {
  return placeholderInputs.map((placeholder) => buildPlaceholder(placeholder));
}

function buildPlaceholder(placeholder: OfficialTemplatePlaceholderInput): OfficialTemplatePlaceholder {
  return {
    key: placeholder.key,
    label: placeholder.label,
    fieldKey: placeholder.fieldKey ?? null,
    description: placeholder.description ?? null,
    metadata: placeholder.metadata ?? {},
  };
}

function buildValidationRules(
  validationRuleInputs: ReadonlyArray<OfficialTemplateValidationRuleInput>,
): ReadonlyArray<OfficialTemplateValidationRule> {
  return validationRuleInputs.map((rule) => ({
    id: rule.id,
    description: rule.description,
    appliesToFieldKey: rule.appliesToFieldKey ?? null,
    severity: rule.severity ?? OfficialTemplateValidationRuleSeverity.Error,
    metadata: rule.metadata ?? {},
  }));
}

function failureResult(
  errors: ReadonlyArray<OfficialTemplateError>,
  metadata: OfficialTemplateMetadata,
): OfficialTemplateFailure {
  return freezeDomainObject<OfficialTemplateFailure>({
    success: false,
    template: null,
    errors,
    warnings: [],
    metadata,
  });
}

function createTimelineEntry(
  type: string,
  occurredAt: string,
  description: string,
  metadata: OfficialTemplateMetadata,
): TemplateTimelineEntry {
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
  metadata: OfficialTemplateMetadata,
): TemplateTraceEntry {
  return {
    action,
    actor,
    occurredAt,
    description,
    metadata,
  };
}

function createTemplateError(
  code: OfficialTemplateError["code"],
  field: string,
  message: string,
  metadata: OfficialTemplateMetadata,
): OfficialTemplateError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createTemplateMetadata(input: CreateOfficialTemplateInput): OfficialTemplateMetadata {
  return {
    ...(input.metadata ?? {}),
    templateId: input.id,
    documentType: input.documentType,
    version: input.version,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createMutationMetadata(
  template: OfficialTemplate,
  extraMetadata: OfficialTemplateMetadata | undefined,
): OfficialTemplateMetadata {
  return {
    ...template.metadata,
    ...(extraMetadata ?? {}),
    templateId: template.id,
    documentType: template.documentType,
    version: template.version,
  };
}

