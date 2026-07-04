import type { DocumentReconstruction } from "./document-reconstruction.types";
import { ReconstructionFieldStatus, ReconstructionSectionStatus } from "./document-reconstruction.types";

/**
 * Pure Domain Service evaluating how complete an existing
 * `DocumentReconstruction` is. It never reconstructs anything, never
 * consults any other domain, and never mutates the aggregate it reads:
 * `sections`, `fields` and `sources` are read verbatim from the
 * aggregate already built by `addReconstructionSection` (14.3),
 * `addReconstructionField` (14.4) and `addReconstructionSource` (14.2)
 * — nothing here is recomputed or re-derived beyond simple counting and
 * averaging over data the aggregate already holds.
 */

export enum ReconstructionCompletenessLevel {
  Low = "Low",
  Medium = "Medium",
  High = "High",
  Complete = "Complete",
}

export enum ReconstructionCompletenessIssueCode {
  NoSections = "NoSections",
  NoFields = "NoFields",
  NoSources = "NoSources",
  RequiredFieldMissing = "RequiredFieldMissing",
  RequiredFieldIncomplete = "RequiredFieldIncomplete",
  FieldWithoutSource = "FieldWithoutSource",
  SectionWithoutFields = "SectionWithoutFields",
  SectionIncomplete = "SectionIncomplete",
  LowConfidence = "LowConfidence",
}

export enum ReconstructionCompletenessSeverity {
  Info = "Info",
  Warning = "Warning",
  Error = "Error",
}

export interface ReconstructionCompletenessIssue {
  readonly code: ReconstructionCompletenessIssueCode;
  readonly message: string;
  readonly severity: ReconstructionCompletenessSeverity;
}

export interface ReconstructionCompletenessSummary {
  readonly totalSections: number;
  readonly completedSections: number;
  readonly totalFields: number;
  readonly completedFields: number;
  readonly requiredFields: number;
  readonly completedRequiredFields: number;
  readonly totalSources: number;
  readonly averageConfidence: number;
}

export interface ReconstructionCompletenessResult {
  readonly level: ReconstructionCompletenessLevel;
  readonly score: number;
  readonly complete: boolean;
  readonly issues: ReadonlyArray<ReconstructionCompletenessIssue>;
  readonly summary: ReconstructionCompletenessSummary;
}

const LOW_CONFIDENCE_THRESHOLD = 0.8;

/**
 * Analyzes the aggregate only — never recalculates information already
 * held by it, never consults another domain, never mutates it. Same
 * aggregate in, same `ReconstructionCompletenessResult` out, always.
 */
export function evaluateDocumentReconstructionCompleteness(
  documentReconstruction: DocumentReconstruction,
): ReconstructionCompletenessResult {
  const summary = buildSummary(documentReconstruction);
  const score = computeScore(summary);
  const level = resolveLevel(score);
  const issues = buildIssues(documentReconstruction, summary);

  return freezeDomainObject<ReconstructionCompletenessResult>({
    level,
    score,
    complete: level === ReconstructionCompletenessLevel.Complete,
    issues,
    summary,
  });
}

export function summarizeDocumentReconstructionCompleteness(
  documentReconstruction: DocumentReconstruction,
): ReconstructionCompletenessSummary {
  return evaluateDocumentReconstructionCompleteness(documentReconstruction).summary;
}

export function isDocumentReconstructionComplete(documentReconstruction: DocumentReconstruction): boolean {
  return evaluateDocumentReconstructionCompleteness(documentReconstruction).complete;
}

/**
 * `averageConfidence` pools every `confidence` value already recorded in
 * the aggregate — both `ReconstructionSource.confidence` (traceability)
 * and `ReconstructionField.confidence` (reconstructed-data confidence)
 * — into one unified signal. Neither figure alone represents "how
 * confident is this reconstruction overall"; combined, they do.
 */
function buildSummary(documentReconstruction: DocumentReconstruction): ReconstructionCompletenessSummary {
  const { sections, fields, sources } = documentReconstruction;

  const completedSections = sections.filter(
    (section) => section.status === ReconstructionSectionStatus.Completed,
  ).length;
  const completedFields = fields.filter((field) => field.status === ReconstructionFieldStatus.Completed).length;
  const requiredFields = fields.filter((field) => field.required);
  const completedRequiredFields = requiredFields.filter(
    (field) => field.status === ReconstructionFieldStatus.Completed,
  ).length;

  const confidenceValues = [...sources.map((source) => source.confidence), ...fields.map((field) => field.confidence)];
  const averageConfidence =
    confidenceValues.length === 0
      ? 0
      : confidenceValues.reduce((sum, confidence) => sum + confidence, 0) / confidenceValues.length;

  return {
    totalSections: sections.length,
    completedSections,
    totalFields: fields.length,
    completedFields,
    requiredFields: requiredFields.length,
    completedRequiredFields,
    totalSources: sources.length,
    averageConfidence,
  };
}

/**
 * Six independent, all-or-nothing point buckets totalling 100: sections
 * exist (20), every section is Completed (20), fields exist (20), every
 * required field is Completed (20), sources exist (10), average
 * confidence >= 0.80 (10). There is no partial credit within a bucket.
 */
function computeScore(summary: ReconstructionCompletenessSummary): number {
  let score = 0;

  if (summary.totalSections > 0) {
    score += 20;
  }

  if (summary.totalSections > 0 && summary.completedSections === summary.totalSections) {
    score += 20;
  }

  if (summary.totalFields > 0) {
    score += 20;
  }

  if (summary.requiredFields > 0 && summary.completedRequiredFields === summary.requiredFields) {
    score += 20;
  }

  if (summary.totalSources > 0) {
    score += 10;
  }

  if (summary.averageConfidence >= LOW_CONFIDENCE_THRESHOLD) {
    score += 10;
  }

  return score;
}

function resolveLevel(score: number): ReconstructionCompletenessLevel {
  if (score <= 25) {
    return ReconstructionCompletenessLevel.Low;
  }
  if (score <= 60) {
    return ReconstructionCompletenessLevel.Medium;
  }
  if (score <= 85) {
    return ReconstructionCompletenessLevel.High;
  }
  return ReconstructionCompletenessLevel.Complete;
}

/**
 * Each issue code appears at most once, regardless of how many
 * offending sections/fields exist — `ReconstructionCompletenessIssue`
 * carries no entity id, so repeated instances of the same code would be
 * indistinguishable from one another; the message states the count
 * instead. `RequiredFieldMissing` (no required field defined at all)
 * and `RequiredFieldIncomplete` (required fields exist but not all
 * Completed) are mutually exclusive by construction.
 */
function buildIssues(
  documentReconstruction: DocumentReconstruction,
  summary: ReconstructionCompletenessSummary,
): ReadonlyArray<ReconstructionCompletenessIssue> {
  const { sections, fields } = documentReconstruction;
  const issues: ReconstructionCompletenessIssue[] = [];

  if (summary.totalSections === 0) {
    issues.push(
      createIssue(
        ReconstructionCompletenessIssueCode.NoSections,
        "Document reconstruction has no sections.",
        ReconstructionCompletenessSeverity.Error,
      ),
    );
  }

  if (summary.totalFields === 0) {
    issues.push(
      createIssue(
        ReconstructionCompletenessIssueCode.NoFields,
        "Document reconstruction has no fields.",
        ReconstructionCompletenessSeverity.Error,
      ),
    );
  }

  if (summary.totalSources === 0) {
    issues.push(
      createIssue(
        ReconstructionCompletenessIssueCode.NoSources,
        "Document reconstruction has no sources.",
        ReconstructionCompletenessSeverity.Warning,
      ),
    );
  }

  if (summary.requiredFields === 0) {
    issues.push(
      createIssue(
        ReconstructionCompletenessIssueCode.RequiredFieldMissing,
        "Document reconstruction has no required fields defined.",
        ReconstructionCompletenessSeverity.Error,
      ),
    );
  } else if (summary.completedRequiredFields < summary.requiredFields) {
    issues.push(
      createIssue(
        ReconstructionCompletenessIssueCode.RequiredFieldIncomplete,
        `${summary.requiredFields - summary.completedRequiredFields} of ${summary.requiredFields} required field(s) are not yet Completed.`,
        ReconstructionCompletenessSeverity.Warning,
      ),
    );
  }

  const fieldsWithoutSource = fields.filter((field) => field.sourceIds.length === 0).length;
  if (fieldsWithoutSource > 0) {
    issues.push(
      createIssue(
        ReconstructionCompletenessIssueCode.FieldWithoutSource,
        `${fieldsWithoutSource} field(s) have no linked source.`,
        ReconstructionCompletenessSeverity.Warning,
      ),
    );
  }

  const sectionsWithoutFields = sections.filter((section) => section.fields.length === 0).length;
  if (sectionsWithoutFields > 0) {
    issues.push(
      createIssue(
        ReconstructionCompletenessIssueCode.SectionWithoutFields,
        `${sectionsWithoutFields} section(s) have no fields.`,
        ReconstructionCompletenessSeverity.Warning,
      ),
    );
  }

  const incompleteSections = sections.filter(
    (section) => section.status !== ReconstructionSectionStatus.Completed,
  ).length;
  if (incompleteSections > 0) {
    issues.push(
      createIssue(
        ReconstructionCompletenessIssueCode.SectionIncomplete,
        `${incompleteSections} section(s) are not yet Completed.`,
        ReconstructionCompletenessSeverity.Warning,
      ),
    );
  }

  if (summary.averageConfidence < LOW_CONFIDENCE_THRESHOLD) {
    issues.push(
      createIssue(
        ReconstructionCompletenessIssueCode.LowConfidence,
        `Average confidence ${summary.averageConfidence} is below the ${LOW_CONFIDENCE_THRESHOLD} threshold.`,
        ReconstructionCompletenessSeverity.Info,
      ),
    );
  }

  return issues;
}

function createIssue(
  code: ReconstructionCompletenessIssueCode,
  message: string,
  severity: ReconstructionCompletenessSeverity,
): ReconstructionCompletenessIssue {
  return { code, message, severity };
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
