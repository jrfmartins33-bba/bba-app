import type { DocumentReconstruction, DocumentReconstructionStatus } from "./document-reconstruction.types";
import type {
  ReconstructionCompletenessLevel,
  ReconstructionCompletenessResult,
} from "./document-reconstruction-completeness";
import type { ReconstructionIssueDetectionResult } from "./document-reconstruction-issue-detector";

/**
 * Pure Domain Service composing the three artifacts already produced by
 * Epics 14.1-14.6 — the `DocumentReconstruction` aggregate, its
 * `ReconstructionCompletenessResult` (14.5) and its
 * `ReconstructionIssueDetectionResult` (14.6) — into one consolidated,
 * read-only workspace. It creates no new business rule: `statusSummary`,
 * `isComplete` and `isReadyForReview` are only ever copied from the
 * three inputs, never recomputed. Callers are responsible for producing
 * `completeness` (via `evaluateDocumentReconstructionCompleteness`) and
 * `issueDetection` (via `detectDocumentReconstructionIssues`, itself fed
 * that same `completeness`) before assembling a workspace.
 */

export interface DocumentReconstructionWorkspaceSummary {
  readonly documentStatus: DocumentReconstructionStatus;
  readonly completenessLevel: ReconstructionCompletenessLevel;
  readonly completenessScore: number;
  readonly totalIssues: number;
  readonly criticalIssues: number;
  readonly errorIssues: number;
  readonly warningIssues: number;
  readonly infoIssues: number;
}

export interface DocumentReconstructionWorkspace {
  readonly document: DocumentReconstruction;
  readonly completeness: ReconstructionCompletenessResult;
  readonly issues: ReconstructionIssueDetectionResult;
  readonly statusSummary: DocumentReconstructionWorkspaceSummary;
  readonly isComplete: boolean;
  readonly isReadyForReview: boolean;
}

export interface BuildDocumentReconstructionWorkspaceInput {
  readonly document: DocumentReconstruction;
  readonly completeness: ReconstructionCompletenessResult;
  readonly issueDetection: ReconstructionIssueDetectionResult;
}

/**
 * Assembles the three already-computed artifacts into one immutable
 * workspace. Every field is a direct reflection of its source — `document`,
 * `completeness` and `issues` are stored verbatim (deep-cloned and frozen,
 * never mutated or read differently), and `statusSummary`/`isComplete`/
 * `isReadyForReview` only ever copy values already present on `completeness`
 * and `issueDetection`.
 */
export function buildDocumentReconstructionWorkspace(
  input: BuildDocumentReconstructionWorkspaceInput,
): DocumentReconstructionWorkspace {
  const { document, completeness, issueDetection } = input;

  return freezeDomainObject<DocumentReconstructionWorkspace>({
    document,
    completeness,
    issues: issueDetection,
    statusSummary: buildStatusSummary(document, completeness, issueDetection),
    isComplete: completeness.complete,
    isReadyForReview: issueDetection.readyForReview,
  });
}

export function summarizeDocumentReconstructionWorkspace(
  workspace: DocumentReconstructionWorkspace,
): DocumentReconstructionWorkspaceSummary {
  return workspace.statusSummary;
}

export function isDocumentReconstructionWorkspaceReady(workspace: DocumentReconstructionWorkspace): boolean {
  return workspace.isReadyForReview;
}

function buildStatusSummary(
  document: DocumentReconstruction,
  completeness: ReconstructionCompletenessResult,
  issueDetection: ReconstructionIssueDetectionResult,
): DocumentReconstructionWorkspaceSummary {
  return {
    documentStatus: document.status,
    completenessLevel: completeness.level,
    completenessScore: completeness.score,
    totalIssues: issueDetection.summary.totalIssues,
    criticalIssues: issueDetection.summary.criticalIssues,
    errorIssues: issueDetection.summary.errorIssues,
    warningIssues: issueDetection.summary.warningIssues,
    infoIssues: issueDetection.summary.infoIssues,
  };
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
