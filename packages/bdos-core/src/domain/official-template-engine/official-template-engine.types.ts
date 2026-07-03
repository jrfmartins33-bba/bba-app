export type OfficialTemplateMetadata = Readonly<Record<string, unknown>>;

export type OfficialTemplateId = string;

export type OfficialTemplateActor = string;

export type OfficialTemplateOccurredAt = string;

export type OfficialTemplateCorrelationId = string;

export type OfficialTemplateCreatedBy = string;

export type OfficialTemplateSourceSystem = string;

export type OfficialTemplateSectionId = string;

export type OfficialTemplateFieldId = string;

export type OfficialTemplateFieldKey = string;

export type OfficialTemplatePlaceholderKey = string;

export type OfficialTemplateValidationRuleId = string;

export enum OfficialTemplateStatus {
  Draft = "Draft",
  Active = "Active",
  Deprecated = "Deprecated",
  Archived = "Archived",
}

/**
 * Generic catalog of official document kinds this engine can model a
 * template for. Deliberately org-agnostic — no DNOCS/Caixa/prefeitura/
 * ministerial rules are encoded here or anywhere in this domain.
 */
export enum OfficialDocumentType {
  MeasurementBulletin = "measurement_bulletin",
  PhotographicReport = "photographic_report",
  OfficialLetter = "official_letter",
  AcceptanceTerm = "acceptance_term",
  ServiceOrder = "service_order",
  TechnicalOpinion = "technical_opinion",
  ExecutionReport = "execution_report",
  Declaration = "declaration",
  ProcessCoverSheet = "process_cover_sheet",
  TechnicalAdministrativeDocument = "technical_administrative_document",
}

export interface OfficialTemplateSection {
  readonly id: OfficialTemplateSectionId;
  readonly title: string;
  readonly order: number;
  readonly description: string | null;
  readonly metadata: OfficialTemplateMetadata;
}

export interface OfficialTemplateSectionInput {
  readonly id: OfficialTemplateSectionId;
  readonly title: string;
  readonly order: number;
  readonly description?: string | null;
  readonly metadata?: OfficialTemplateMetadata;
}

export interface OfficialTemplateField {
  readonly id: OfficialTemplateFieldId;
  readonly key: OfficialTemplateFieldKey;
  readonly sectionId: OfficialTemplateSectionId | null;
  readonly label: string;
  readonly required: boolean;
  readonly description: string | null;
  readonly metadata: OfficialTemplateMetadata;
}

export interface OfficialTemplateFieldInput {
  readonly id: OfficialTemplateFieldId;
  readonly key: OfficialTemplateFieldKey;
  readonly sectionId?: OfficialTemplateSectionId | null;
  readonly label: string;
  readonly required?: boolean;
  readonly description?: string | null;
  readonly metadata?: OfficialTemplateMetadata;
}

/**
 * A placeholder marks where a field's value is meant to be filled into
 * the template. `fieldKey` is nullable because some placeholders are
 * purely structural (e.g. a static label) and are not bound to a field.
 */
export interface OfficialTemplatePlaceholder {
  readonly key: OfficialTemplatePlaceholderKey;
  readonly label: string;
  readonly fieldKey: OfficialTemplateFieldKey | null;
  readonly description: string | null;
  readonly metadata: OfficialTemplateMetadata;
}

export interface OfficialTemplatePlaceholderInput {
  readonly key: OfficialTemplatePlaceholderKey;
  readonly label: string;
  readonly fieldKey?: OfficialTemplateFieldKey | null;
  readonly description?: string | null;
  readonly metadata?: OfficialTemplateMetadata;
}

export enum OfficialTemplateValidationRuleSeverity {
  Error = "Error",
  Warning = "Warning",
  Info = "Info",
}

/**
 * A structural filling rule documented against the template — e.g. "field
 * X is required when field Y is present". This domain only models the
 * existence and shape of such rules; it does not evaluate or enforce them.
 */
export interface OfficialTemplateValidationRule {
  readonly id: OfficialTemplateValidationRuleId;
  readonly description: string;
  readonly appliesToFieldKey: OfficialTemplateFieldKey | null;
  readonly severity: OfficialTemplateValidationRuleSeverity;
  readonly metadata: OfficialTemplateMetadata;
}

export interface OfficialTemplateValidationRuleInput {
  readonly id: OfficialTemplateValidationRuleId;
  readonly description: string;
  readonly appliesToFieldKey?: OfficialTemplateFieldKey | null;
  readonly severity?: OfficialTemplateValidationRuleSeverity;
  readonly metadata?: OfficialTemplateMetadata;
}

/**
 * Curated, business-readable narrative of the template's own lifecycle
 * (creation, status transitions) — distinct from `trace`, which is the
 * full technical audit record of every mutation, including structural
 * additions of sections/fields/placeholders.
 */
export interface TemplateTimelineEntry {
  readonly type: string;
  readonly occurredAt: OfficialTemplateOccurredAt;
  readonly description: string;
  readonly metadata: OfficialTemplateMetadata;
}

export interface TemplateTraceEntry {
  readonly action: string;
  readonly actor: OfficialTemplateActor;
  readonly occurredAt: OfficialTemplateOccurredAt;
  readonly description: string;
  readonly metadata: OfficialTemplateMetadata;
}

export interface OfficialTemplateSummary {
  readonly totalSections: number;
  readonly totalFields: number;
  readonly requiredFields: number;
  readonly totalPlaceholders: number;
  readonly totalValidationRules: number;
}

/**
 * Aggregate root representing a reusable official document template
 * (e.g. Boletim de Medicao, Oficio, Termo de Recebimento). Models
 * structure only — sections, fields, placeholders and structural
 * filling/validation rules. Does not render PDF/DOCX/HTML, does not
 * generate final documents, does not embed any AI, and does not encode
 * rules specific to any public body.
 */
export interface OfficialTemplate {
  readonly id: OfficialTemplateId;
  readonly name: string;
  readonly documentType: OfficialDocumentType;
  readonly version: string;
  readonly description: string | null;
  readonly status: OfficialTemplateStatus;
  readonly sections: ReadonlyArray<OfficialTemplateSection>;
  readonly fields: ReadonlyArray<OfficialTemplateField>;
  readonly placeholders: ReadonlyArray<OfficialTemplatePlaceholder>;
  readonly validationRules: ReadonlyArray<OfficialTemplateValidationRule>;
  readonly timeline: ReadonlyArray<TemplateTimelineEntry>;
  readonly trace: ReadonlyArray<TemplateTraceEntry>;
  readonly metadata: OfficialTemplateMetadata;
}

export interface CreateOfficialTemplateInput {
  readonly id: OfficialTemplateId;
  readonly name: string;
  readonly documentType: OfficialDocumentType;
  readonly version: string;
  readonly description?: string | null;
  readonly sections?: ReadonlyArray<OfficialTemplateSectionInput> | null;
  readonly fields?: ReadonlyArray<OfficialTemplateFieldInput> | null;
  readonly placeholders?: ReadonlyArray<OfficialTemplatePlaceholderInput> | null;
  readonly validationRules?: ReadonlyArray<OfficialTemplateValidationRuleInput> | null;
  readonly actor: OfficialTemplateActor;
  readonly occurredAt: OfficialTemplateOccurredAt;
  readonly correlationId: OfficialTemplateCorrelationId;
  readonly createdBy: OfficialTemplateCreatedBy;
  readonly sourceSystem: OfficialTemplateSourceSystem;
  readonly metadata?: OfficialTemplateMetadata;
}

export interface ActivateOfficialTemplateInput {
  readonly template: OfficialTemplate;
  readonly actor: OfficialTemplateActor;
  readonly occurredAt: OfficialTemplateOccurredAt;
  readonly metadata?: OfficialTemplateMetadata;
}

export interface DeprecateOfficialTemplateInput {
  readonly template: OfficialTemplate;
  readonly actor: OfficialTemplateActor;
  readonly occurredAt: OfficialTemplateOccurredAt;
  readonly metadata?: OfficialTemplateMetadata;
}

export interface ArchiveOfficialTemplateInput {
  readonly template: OfficialTemplate;
  readonly actor: OfficialTemplateActor;
  readonly occurredAt: OfficialTemplateOccurredAt;
  readonly metadata?: OfficialTemplateMetadata;
}

export interface AddOfficialTemplateSectionInput {
  readonly template: OfficialTemplate;
  readonly section: OfficialTemplateSectionInput;
  readonly actor: OfficialTemplateActor;
  readonly occurredAt: OfficialTemplateOccurredAt;
  readonly metadata?: OfficialTemplateMetadata;
}

export interface AddOfficialTemplateFieldInput {
  readonly template: OfficialTemplate;
  readonly field: OfficialTemplateFieldInput;
  readonly actor: OfficialTemplateActor;
  readonly occurredAt: OfficialTemplateOccurredAt;
  readonly metadata?: OfficialTemplateMetadata;
}

export interface AddOfficialTemplatePlaceholderInput {
  readonly template: OfficialTemplate;
  readonly placeholder: OfficialTemplatePlaceholderInput;
  readonly actor: OfficialTemplateActor;
  readonly occurredAt: OfficialTemplateOccurredAt;
  readonly metadata?: OfficialTemplateMetadata;
}

export type OfficialTemplateErrorCode =
  | "missing_id"
  | "missing_name"
  | "missing_document_type"
  | "missing_version"
  | "missing_section_id"
  | "duplicate_section_id"
  | "invalid_section_order"
  | "missing_field_id"
  | "duplicate_field_id"
  | "missing_field_key"
  | "duplicate_field_key"
  | "missing_placeholder_key"
  | "duplicate_placeholder_key"
  | "unknown_field_reference"
  | "missing_validation_rule_id"
  | "duplicate_validation_rule_id"
  | "template_cannot_activate_without_section"
  | "template_cannot_activate_without_required_field"
  | "template_terminal"
  | "template_locked_for_structural_changes"
  | "invalid_official_template_status_transition";

export interface OfficialTemplateError {
  readonly code: OfficialTemplateErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: OfficialTemplateMetadata;
}

export type OfficialTemplateWarningCode = "none";

export interface OfficialTemplateWarning {
  readonly code: OfficialTemplateWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: OfficialTemplateMetadata;
}

export interface OfficialTemplateSuccess {
  readonly success: true;
  readonly template: OfficialTemplate;
  readonly errors: ReadonlyArray<OfficialTemplateError>;
  readonly warnings: ReadonlyArray<OfficialTemplateWarning>;
  readonly metadata: OfficialTemplateMetadata;
}

export interface OfficialTemplateFailure {
  readonly success: false;
  readonly template: null;
  readonly errors: ReadonlyArray<OfficialTemplateError>;
  readonly warnings: ReadonlyArray<OfficialTemplateWarning>;
  readonly metadata: OfficialTemplateMetadata;
}

export type OfficialTemplateResult = OfficialTemplateSuccess | OfficialTemplateFailure;
