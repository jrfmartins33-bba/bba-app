import type { OfficialTemplate } from "./official-template-engine.types";
import { OfficialTemplateStatus } from "./official-template-engine.types";
import { freezeDomainObject, isBlank } from "./official-template-shared";

export enum ValidationSeverity {
  Error = "error",
  Warning = "warning",
}

export type ValidationCode =
  | "missing_id"
  | "missing_name"
  | "missing_document_type"
  | "missing_version"
  | "empty_template"
  | "missing_section"
  | "missing_field"
  | "missing_required_field"
  | "section_without_fields"
  | "duplicate_order"
  | "invalid_order"
  | "duplicate_field_key"
  | "duplicate_placeholder"
  | "missing_placeholder_reference"
  | "invalid_validation_rule"
  | "duplicate_validation_rule"
  | "inactive_template"
  | "deprecated_template"
  | "archived_template";

export interface OfficialTemplateValidationIssue {
  readonly code: ValidationCode;
  readonly severity: ValidationSeverity;
  readonly message: string;
  readonly path: string;
}

export interface OfficialTemplateValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<OfficialTemplateValidationIssue>;
  readonly warnings: ReadonlyArray<OfficialTemplateValidationIssue>;
}

export function validateOfficialTemplate(template: OfficialTemplate): OfficialTemplateValidationResult {
  const issues = [
    ...validateTemplateStructure(template),
    ...validateTemplateSections(template),
    ...validateTemplateFields(template),
    ...validateTemplatePlaceholders(template),
    ...validateTemplateValidationRules(template),
  ];

  const errors = issues.filter((issue) => issue.severity === ValidationSeverity.Error);
  const warnings = issues.filter((issue) => issue.severity === ValidationSeverity.Warning);

  return freezeDomainObject<OfficialTemplateValidationResult>({
    valid: errors.length === 0,
    errors,
    warnings,
  });
}

export function validateTemplateStructure(
  template: OfficialTemplate,
): ReadonlyArray<OfficialTemplateValidationIssue> {
  const issues: OfficialTemplateValidationIssue[] = [];

  if (isBlank(template.id)) {
    issues.push(createIssue("missing_id", ValidationSeverity.Error, "Template id is required.", "template.id"));
  }

  if (isBlank(template.name)) {
    issues.push(
      createIssue("missing_name", ValidationSeverity.Error, "Template name is required.", "template.name"),
    );
  }

  if (isBlank(template.documentType)) {
    issues.push(
      createIssue(
        "missing_document_type",
        ValidationSeverity.Error,
        "Template document type is required.",
        "template.documentType",
      ),
    );
  }

  if (isBlank(template.version)) {
    issues.push(
      createIssue(
        "missing_version",
        ValidationSeverity.Error,
        "Template version is required.",
        "template.version",
      ),
    );
  }

  if (template.sections.length === 0 && template.fields.length === 0) {
    issues.push(
      createIssue(
        "empty_template",
        ValidationSeverity.Error,
        "Template has no sections and no fields.",
        "template",
      ),
    );
  }

  if (template.status === OfficialTemplateStatus.Draft) {
    issues.push(
      createIssue(
        "inactive_template",
        ValidationSeverity.Warning,
        "Template is still in Draft status and has not been activated.",
        "template.status",
      ),
    );
  }

  if (template.status === OfficialTemplateStatus.Deprecated) {
    issues.push(
      createIssue(
        "deprecated_template",
        ValidationSeverity.Warning,
        "Template is deprecated.",
        "template.status",
      ),
    );
  }

  if (template.status === OfficialTemplateStatus.Archived) {
    issues.push(
      createIssue("archived_template", ValidationSeverity.Warning, "Template is archived.", "template.status"),
    );
  }

  return issues;
}

export function validateTemplateSections(
  template: OfficialTemplate,
): ReadonlyArray<OfficialTemplateValidationIssue> {
  const issues: OfficialTemplateValidationIssue[] = [];

  if (template.sections.length === 0) {
    issues.push(
      createIssue(
        "missing_section",
        ValidationSeverity.Error,
        "Template must have at least one section.",
        "template.sections",
      ),
    );
  }

  const seenOrders = new Map<number, string>();

  template.sections.forEach((section, index) => {
    const path = `sections[${index}]`;

    if (isBlank(section.title)) {
      issues.push(
        createIssue(
          "missing_name",
          ValidationSeverity.Error,
          `Section ${section.id} has no title.`,
          `${path}.title`,
        ),
      );
    }

    if (!Number.isInteger(section.order) || section.order <= 0) {
      issues.push(
        createIssue(
          "invalid_order",
          ValidationSeverity.Error,
          `Section ${section.id} order must be a positive integer, got ${section.order}.`,
          `${path}.order`,
        ),
      );
    } else if (seenOrders.has(section.order)) {
      issues.push(
        createIssue(
          "duplicate_order",
          ValidationSeverity.Error,
          `Section ${section.id} shares order ${section.order} with section ${seenOrders.get(section.order)}.`,
          `${path}.order`,
        ),
      );
    } else {
      seenOrders.set(section.order, section.id);
    }

    const hasFields = template.fields.some((field) => field.sectionId === section.id);
    if (!hasFields) {
      issues.push(
        createIssue(
          "section_without_fields",
          ValidationSeverity.Warning,
          `Section ${section.id} has no fields assigned to it.`,
          path,
        ),
      );
    }
  });

  return issues;
}

export function validateTemplateFields(
  template: OfficialTemplate,
): ReadonlyArray<OfficialTemplateValidationIssue> {
  const issues: OfficialTemplateValidationIssue[] = [];

  if (template.fields.length === 0) {
    issues.push(
      createIssue(
        "missing_field",
        ValidationSeverity.Error,
        "Template must have at least one field.",
        "template.fields",
      ),
    );
  }

  const seenKeys = new Set<string>();

  template.fields.forEach((field, index) => {
    const path = `fields[${index}]`;

    if (isBlank(field.label)) {
      issues.push(
        createIssue(
          "missing_name",
          ValidationSeverity.Error,
          `Field ${field.id} has no label.`,
          `${path}.label`,
        ),
      );
    }

    if (seenKeys.has(field.key)) {
      issues.push(
        createIssue(
          "duplicate_field_key",
          ValidationSeverity.Error,
          `Field key ${field.key} is duplicated.`,
          `${path}.key`,
        ),
      );
    } else {
      seenKeys.add(field.key);
    }
  });

  if (!template.fields.some((field) => field.required)) {
    issues.push(
      createIssue(
        "missing_required_field",
        ValidationSeverity.Error,
        "Template must have at least one required field.",
        "template.fields",
      ),
    );
  }

  return issues;
}

export function validateTemplatePlaceholders(
  template: OfficialTemplate,
): ReadonlyArray<OfficialTemplateValidationIssue> {
  const issues: OfficialTemplateValidationIssue[] = [];
  const fieldKeys = new Set(template.fields.map((field) => field.key));
  const seenKeys = new Set<string>();

  template.placeholders.forEach((placeholder, index) => {
    const path = `placeholders[${index}]`;

    if (seenKeys.has(placeholder.key)) {
      issues.push(
        createIssue(
          "duplicate_placeholder",
          ValidationSeverity.Error,
          `Placeholder key ${placeholder.key} is duplicated.`,
          `${path}.key`,
        ),
      );
    } else {
      seenKeys.add(placeholder.key);
    }

    if (placeholder.fieldKey !== null && !fieldKeys.has(placeholder.fieldKey)) {
      issues.push(
        createIssue(
          "missing_placeholder_reference",
          ValidationSeverity.Error,
          `Placeholder ${placeholder.key} references unknown field key ${placeholder.fieldKey}.`,
          `${path}.fieldKey`,
        ),
      );
    }
  });

  return issues;
}

export function validateTemplateValidationRules(
  template: OfficialTemplate,
): ReadonlyArray<OfficialTemplateValidationIssue> {
  const issues: OfficialTemplateValidationIssue[] = [];
  const fieldKeys = new Set(template.fields.map((field) => field.key));
  const seenIds = new Set<string>();

  template.validationRules.forEach((rule, index) => {
    const path = `validationRules[${index}]`;

    if (seenIds.has(rule.id)) {
      issues.push(
        createIssue(
          "duplicate_validation_rule",
          ValidationSeverity.Error,
          `Validation rule id ${rule.id} is duplicated.`,
          `${path}.id`,
        ),
      );
    } else {
      seenIds.add(rule.id);
    }

    if (rule.appliesToFieldKey !== null && !fieldKeys.has(rule.appliesToFieldKey)) {
      issues.push(
        createIssue(
          "invalid_validation_rule",
          ValidationSeverity.Error,
          `Validation rule ${rule.id} references unknown field key ${rule.appliesToFieldKey}.`,
          `${path}.appliesToFieldKey`,
        ),
      );
    }
  });

  return issues;
}

function createIssue(
  code: ValidationCode,
  severity: ValidationSeverity,
  message: string,
  path: string,
): OfficialTemplateValidationIssue {
  return { code, severity, message, path };
}

