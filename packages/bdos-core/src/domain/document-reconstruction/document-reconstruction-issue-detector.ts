import type {
  DocumentReconstruction,
  ReconstructionField,
  ReconstructionSection,
  ReconstructionSource,
} from "./document-reconstruction.types";
import { ReconstructionFieldStatus, ReconstructionSectionStatus } from "./document-reconstruction.types";
import type { ReconstructionCompletenessResult } from "./document-reconstruction-completeness";

/**
 * Pure Domain Service that identifies, classifies and consolidates the
 * problems already present on an existing `DocumentReconstruction`. It
 * never mutates the aggregate, never touches `status`, `timeline`,
 * `trace`, `summary` or `metadata`, never consults AI, text-recognition or other domains,
 * and never recomputes completeness — `ReconstructionCompletenessResult`
 * is always taken as an explicit input, exactly as produced by
 * `evaluateDocumentReconstructionCompleteness` (Epic 14.5).
 *
 * `category` reflects the level of the entity the issue is about:
 * `Document` for whole-aggregate absence checks (`referenceId` is always
 * `null`), `Section`/`Field` for a single offending section/field.
 * `Confidence` and `Consistency` are cross-cutting exceptions to that
 * rule — every confidence-threshold breach (field or source) is
 * `Confidence`, and every duplicate-invariant breach (section order,
 * field key) is `Consistency`, regardless of which entity it points to.
 * `Source` is reserved for a future source-specific check; none of the
 * mandatory detections in this Epic requires it.
 *
 * The duplicate checks exist purely as defense in depth: `addReconstructionSection`
 * and `addReconstructionField` (14.3/14.4) already reject duplicate
 * order/key values, so in practice these should never fire against an
 * aggregate built exclusively through this domain's own mutators.
 */

export enum ReconstructionIssueCategory {
  Document = "Document",
  Section = "Section",
  Field = "Field",
  Source = "Source",
  Confidence = "Confidence",
  Consistency = "Consistency",
}

export enum ReconstructionIssueSeverity {
  Info = "Info",
  Warning = "Warning",
  Error = "Error",
  Critical = "Critical",
}

export type ReconstructionIssueCode =
  | "document_without_sections"
  | "document_without_fields"
  | "document_without_sources"
  | "section_without_fields"
  | "section_not_completed"
  | "field_required_not_completed"
  | "field_without_source"
  | "field_confidence_below_threshold"
  | "source_confidence_below_threshold"
  | "duplicate_section_order"
  | "duplicate_field_key";

/**
 * `referenceId` points to the `ReconstructionSectionId`, `ReconstructionFieldId`
 * or `ReconstructionSourceId` the issue concerns, and is `null` when the
 * issue is about the document as a whole.
 */
export interface ReconstructionDetectedIssue {
  readonly id: string;
  readonly category: ReconstructionIssueCategory;
  readonly severity: ReconstructionIssueSeverity;
  readonly code: ReconstructionIssueCode;
  readonly title: string;
  readonly description: string;
  readonly referenceId: string | null;
}

export interface ReconstructionIssueCategoryCount {
  readonly category: ReconstructionIssueCategory;
  readonly total: number;
}

export interface ReconstructionIssueDetectionSummary {
  readonly totalIssues: number;
  readonly criticalIssues: number;
  readonly errorIssues: number;
  readonly warningIssues: number;
  readonly infoIssues: number;
  readonly issuesByCategory: ReadonlyArray<ReconstructionIssueCategoryCount>;
}

export interface ReconstructionIssueDetectionResult {
  readonly issues: ReadonlyArray<ReconstructionDetectedIssue>;
  readonly summary: ReconstructionIssueDetectionSummary;
  readonly readyForReview: boolean;
}

const LOW_CONFIDENCE_THRESHOLD = 0.8;

/**
 * `readyForReview` is `true` only when there are no `Critical` and no
 * `Error` issues, and the given `completeness.complete` is `true`.
 * `completeness` is never recalculated here — it is read verbatim from
 * the caller-supplied `ReconstructionCompletenessResult`.
 */
export function detectDocumentReconstructionIssues(
  documentReconstruction: DocumentReconstruction,
  completeness: ReconstructionCompletenessResult,
): ReconstructionIssueDetectionResult {
  const issues = buildDetectedIssues(documentReconstruction).sort(compareIssues);
  const summary = buildIssueSummary(issues);
  const readyForReview =
    summary.criticalIssues === 0 && summary.errorIssues === 0 && completeness.complete;

  return freezeDomainObject<ReconstructionIssueDetectionResult>({
    issues,
    summary,
    readyForReview,
  });
}

export function summarizeDetectedIssues(
  documentReconstruction: DocumentReconstruction,
  completeness: ReconstructionCompletenessResult,
): ReconstructionIssueDetectionSummary {
  return detectDocumentReconstructionIssues(documentReconstruction, completeness).summary;
}

export function isIssueDetectionReadyForReview(
  documentReconstruction: DocumentReconstruction,
  completeness: ReconstructionCompletenessResult,
): boolean {
  return detectDocumentReconstructionIssues(documentReconstruction, completeness).readyForReview;
}

function buildDetectedIssues(documentReconstruction: DocumentReconstruction): ReconstructionDetectedIssue[] {
  const { id: documentId, sections, fields, sources } = documentReconstruction;
  const issues: ReconstructionDetectedIssue[] = [];

  if (sections.length === 0) {
    issues.push(
      createIssue(
        ReconstructionIssueCategory.Document,
        ReconstructionIssueSeverity.Critical,
        "document_without_sections",
        "Document has no sections",
        `Document reconstruction "${documentId}" has no sections.`,
        null,
      ),
    );
  }

  if (fields.length === 0) {
    issues.push(
      createIssue(
        ReconstructionIssueCategory.Document,
        ReconstructionIssueSeverity.Critical,
        "document_without_fields",
        "Document has no fields",
        `Document reconstruction "${documentId}" has no fields.`,
        null,
      ),
    );
  }

  if (sources.length === 0) {
    issues.push(
      createIssue(
        ReconstructionIssueCategory.Document,
        ReconstructionIssueSeverity.Error,
        "document_without_sources",
        "Document has no sources",
        `Document reconstruction "${documentId}" has no sources.`,
        null,
      ),
    );
  }

  sections.forEach((section) => issues.push(...buildSectionIssues(section)));
  fields.forEach((field) => issues.push(...buildFieldIssues(field)));
  sources.forEach((source) => issues.push(...buildSourceIssues(source)));

  issues.push(...detectDuplicateSectionOrders(sections));
  issues.push(...detectDuplicateFieldKeys(fields));

  return issues;
}

function buildSectionIssues(section: ReconstructionSection): ReconstructionDetectedIssue[] {
  const issues: ReconstructionDetectedIssue[] = [];

  if (section.fields.length === 0) {
    issues.push(
      createIssue(
        ReconstructionIssueCategory.Section,
        ReconstructionIssueSeverity.Warning,
        "section_without_fields",
        "Section has no fields",
        `Section "${section.id}" has no fields.`,
        section.id,
      ),
    );
  }

  if (section.status !== ReconstructionSectionStatus.Completed) {
    issues.push(
      createIssue(
        ReconstructionIssueCategory.Section,
        ReconstructionIssueSeverity.Warning,
        "section_not_completed",
        "Section is not completed",
        `Section "${section.id}" is not Completed (current status: ${section.status}).`,
        section.id,
      ),
    );
  }

  return issues;
}

function buildFieldIssues(field: ReconstructionField): ReconstructionDetectedIssue[] {
  const issues: ReconstructionDetectedIssue[] = [];

  if (field.required && field.status !== ReconstructionFieldStatus.Completed) {
    issues.push(
      createIssue(
        ReconstructionIssueCategory.Field,
        ReconstructionIssueSeverity.Error,
        "field_required_not_completed",
        "Required field is not completed",
        `Required field "${field.id}" (key: ${field.key}) is not Completed (current status: ${field.status}).`,
        field.id,
      ),
    );
  }

  if (field.sourceIds.length === 0) {
    issues.push(
      createIssue(
        ReconstructionIssueCategory.Field,
        ReconstructionIssueSeverity.Warning,
        "field_without_source",
        "Field has no linked source",
        `Field "${field.id}" (key: ${field.key}) has no linked source.`,
        field.id,
      ),
    );
  }

  if (field.confidence < LOW_CONFIDENCE_THRESHOLD) {
    issues.push(
      createIssue(
        ReconstructionIssueCategory.Confidence,
        ReconstructionIssueSeverity.Info,
        "field_confidence_below_threshold",
        "Field confidence is below threshold",
        `Field "${field.id}" (key: ${field.key}) confidence ${field.confidence} is below the ${LOW_CONFIDENCE_THRESHOLD} threshold.`,
        field.id,
      ),
    );
  }

  return issues;
}

function buildSourceIssues(source: ReconstructionSource): ReconstructionDetectedIssue[] {
  const issues: ReconstructionDetectedIssue[] = [];

  if (source.confidence < LOW_CONFIDENCE_THRESHOLD) {
    issues.push(
      createIssue(
        ReconstructionIssueCategory.Confidence,
        ReconstructionIssueSeverity.Info,
        "source_confidence_below_threshold",
        "Source confidence is below threshold",
        `Source "${source.id}" confidence ${source.confidence} is below the ${LOW_CONFIDENCE_THRESHOLD} threshold.`,
        source.id,
      ),
    );
  }

  return issues;
}

/**
 * Flags every section beyond the first occurrence of a given `order`
 * value. Defense in depth only — `addReconstructionSection` (14.3)
 * already rejects a duplicate `order` before it can reach the aggregate.
 */
function detectDuplicateSectionOrders(
  sections: ReadonlyArray<ReconstructionSection>,
): ReconstructionDetectedIssue[] {
  const seenOrders = new Set<number>();
  const issues: ReconstructionDetectedIssue[] = [];

  sections.forEach((section) => {
    if (seenOrders.has(section.order)) {
      issues.push(
        createIssue(
          ReconstructionIssueCategory.Consistency,
          ReconstructionIssueSeverity.Critical,
          "duplicate_section_order",
          "Duplicate section order",
          `Section "${section.id}" shares order ${section.order} with another section.`,
          section.id,
        ),
      );
    } else {
      seenOrders.add(section.order);
    }
  });

  return issues;
}

/**
 * Flags every field beyond the first occurrence of a given (sectionId,
 * key) pair. Defense in depth only — `addReconstructionField` (14.4)
 * already rejects a duplicate key within the same section before it can
 * reach the aggregate.
 */
function detectDuplicateFieldKeys(fields: ReadonlyArray<ReconstructionField>): ReconstructionDetectedIssue[] {
  const seenKeys = new Set<string>();
  const issues: ReconstructionDetectedIssue[] = [];

  fields.forEach((field) => {
    const compositeKey = `${field.sectionId}::${field.key}`;

    if (seenKeys.has(compositeKey)) {
      issues.push(
        createIssue(
          ReconstructionIssueCategory.Consistency,
          ReconstructionIssueSeverity.Critical,
          "duplicate_field_key",
          "Duplicate field key in section",
          `Field "${field.id}" shares key "${field.key}" with another field in section "${field.sectionId}".`,
          field.id,
        ),
      );
    } else {
      seenKeys.add(compositeKey);
    }
  });

  return issues;
}

function createIssue(
  category: ReconstructionIssueCategory,
  severity: ReconstructionIssueSeverity,
  code: ReconstructionIssueCode,
  title: string,
  description: string,
  referenceId: string | null,
): ReconstructionDetectedIssue {
  return {
    id: buildIssueId(code, referenceId),
    category,
    severity,
    code,
    title,
    description,
    referenceId,
  };
}

function buildIssueId(code: ReconstructionIssueCode, referenceId: string | null): string {
  return referenceId === null ? code : `${code}:${referenceId}`;
}

function buildIssueSummary(
  issues: ReadonlyArray<ReconstructionDetectedIssue>,
): ReconstructionIssueDetectionSummary {
  const issuesByCategory: ReadonlyArray<ReconstructionIssueCategoryCount> = Object.values(ReconstructionIssueCategory)
    .map((category) => ({
      category,
      total: issues.filter((issue) => issue.category === category).length,
    }))
    .filter((entry) => entry.total > 0);

  return {
    totalIssues: issues.length,
    criticalIssues: issues.filter((issue) => issue.severity === ReconstructionIssueSeverity.Critical).length,
    errorIssues: issues.filter((issue) => issue.severity === ReconstructionIssueSeverity.Error).length,
    warningIssues: issues.filter((issue) => issue.severity === ReconstructionIssueSeverity.Warning).length,
    infoIssues: issues.filter((issue) => issue.severity === ReconstructionIssueSeverity.Info).length,
    issuesByCategory,
  };
}

const SEVERITY_RANK: Readonly<Record<ReconstructionIssueSeverity, number>> = {
  [ReconstructionIssueSeverity.Critical]: 0,
  [ReconstructionIssueSeverity.Error]: 1,
  [ReconstructionIssueSeverity.Warning]: 2,
  [ReconstructionIssueSeverity.Info]: 3,
};

const CATEGORY_RANK: Readonly<Record<ReconstructionIssueCategory, number>> = {
  [ReconstructionIssueCategory.Document]: 0,
  [ReconstructionIssueCategory.Section]: 1,
  [ReconstructionIssueCategory.Field]: 2,
  [ReconstructionIssueCategory.Source]: 3,
  [ReconstructionIssueCategory.Confidence]: 4,
  [ReconstructionIssueCategory.Consistency]: 5,
};

/**
 * Severity (Critical > Error > Warning > Info), then Category, then
 * Title. `id` is an explicit final tiebreaker so the order never depends
 * on `Array.prototype.sort` stability for issues sharing all three keys.
 */
function compareIssues(a: ReconstructionDetectedIssue, b: ReconstructionDetectedIssue): number {
  const severityDelta = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (severityDelta !== 0) {
    return severityDelta;
  }

  const categoryDelta = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
  if (categoryDelta !== 0) {
    return categoryDelta;
  }

  const titleDelta = compareOrdinal(a.title, b.title);
  if (titleDelta !== 0) {
    return titleDelta;
  }

  return compareOrdinal(a.id, b.id);
}

function compareOrdinal(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
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
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [key, cloneDomainValue(property)]),
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
