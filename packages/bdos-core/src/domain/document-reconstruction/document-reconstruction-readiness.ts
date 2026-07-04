import type { DocumentReconstruction } from "./document-reconstruction.types";
import { DocumentReconstructionStatus } from "./document-reconstruction.types";
import type { ReconstructionCompletenessLevel } from "./document-reconstruction-completeness";
import { ReconstructionIssueSeverity } from "./document-reconstruction-issue-detector";
import type {
  DocumentReconstructionWorkspace,
  DocumentReconstructionWorkspaceSummary,
} from "./document-reconstruction-workspace";

/**
 * Pure Domain Service deciding whether a `DocumentReconstruction` may
 * proceed to review, a future approval step, a future export step, or
 * consumption by the wider BBA Platform. It reads only the already-built
 * `DocumentReconstructionWorkspace` (14.7) — `completeness`, `issues`,
 * `statusSummary`, `isComplete` and `isReadyForReview` are never
 * recalculated, only interpreted. This Epic does not approve, export,
 * render or mutate anything.
 *
 * `readyForReview`/`readyForExport` are warnings-agnostic gates (they
 * only ever look at Critical/Error issues, completeness and status),
 * matching the literal criteria given for this Epic. `level` is a
 * richer, UX-oriented classification layered on top: it can report
 * `NeedsAttention` even while `readyForReview` is `true`, whenever
 * `Warning`-severity issues exist or the completeness score sits below
 * this engine's own `86` threshold — a threshold that is deliberately
 * independent of `ReconstructionCompletenessLevel`'s own boundaries
 * (`High` tops out at 85, `Complete` starts above that), so a future
 * change to the completeness engine's scoring cannot silently change
 * this engine's own readiness bar. In today's codebase, `isComplete`
 * (`Complete` level, score > 85, i.e. 90 or 100 given the completeness
 * engine's 10-point buckets) always already sits above 86, and any
 * document with at least one field always carries the ever-present
 * `field_without_source` `Warning` (14.6) — no mutator populates
 * `field.sourceIds` yet (14.4) — so `NeedsAttention` is, in practice,
 * the highest level a document can reach today; `ReadyForReview` and
 * `ReadyForExport` levels are exercised in tests via a workspace with
 * its `warningIssues` count deliberately overridden to zero, proving the
 * engine's own logic rather than today's upstream data shape.
 */

export enum ReconstructionReadinessLevel {
  NotReady = "NotReady",
  NeedsAttention = "NeedsAttention",
  ReadyForReview = "ReadyForReview",
  ReadyForExport = "ReadyForExport",
}

export enum ReconstructionReadinessBlockerCode {
  DocumentArchived = "DocumentArchived",
  DocumentRejected = "DocumentRejected",
  DocumentNotComplete = "DocumentNotComplete",
  CriticalIssues = "CriticalIssues",
  ErrorIssues = "ErrorIssues",
  CompletenessBelowThreshold = "CompletenessBelowThreshold",
  NotReadyForReview = "NotReadyForReview",
}

export interface ReconstructionReadinessBlocker {
  readonly code: ReconstructionReadinessBlockerCode;
  readonly message: string;
  readonly severity: ReconstructionIssueSeverity;
}

export interface ReconstructionReadinessSummary {
  readonly documentStatus: DocumentReconstructionStatus;
  readonly completenessLevel: ReconstructionCompletenessLevel;
  readonly completenessScore: number;
  readonly totalIssues: number;
  readonly criticalIssues: number;
  readonly errorIssues: number;
  readonly warningIssues: number;
  readonly infoIssues: number;
}

export interface ReconstructionReadinessResult {
  readonly level: ReconstructionReadinessLevel;
  readonly readyForReview: boolean;
  readonly readyForExport: boolean;
  readonly blockers: ReadonlyArray<ReconstructionReadinessBlocker>;
  readonly summary: ReconstructionReadinessSummary;
}

const COMPLETENESS_SCORE_THRESHOLD = 86;

/**
 * `readyForReview` is `true` only when `workspace.isReadyForReview`,
 * `workspace.isComplete`, zero Critical issues and zero Error issues all
 * hold, and `document.status` is neither `Archived` nor `Rejected`.
 * `readyForExport` additionally requires `document.status` to already be
 * `ReadyForReview` — export itself does not exist yet; this flag only
 * states future logical eligibility.
 */
export function evaluateDocumentReconstructionReadiness(
  workspace: DocumentReconstructionWorkspace,
): ReconstructionReadinessResult {
  const { document, isComplete, statusSummary } = workspace;

  const readyForReview = computeReadyForReview(workspace);
  const readyForExport = computeReadyForExport(document, readyForReview);
  const level = computeLevel(document, statusSummary, isComplete, readyForReview, readyForExport);
  const blockers = buildBlockers(workspace).sort(compareBlockers);
  const summary = buildSummary(statusSummary);

  return freezeDomainObject<ReconstructionReadinessResult>({
    level,
    readyForReview,
    readyForExport,
    blockers,
    summary,
  });
}

export function summarizeDocumentReconstructionReadiness(
  workspace: DocumentReconstructionWorkspace,
): ReconstructionReadinessSummary {
  return evaluateDocumentReconstructionReadiness(workspace).summary;
}

export function isDocumentReconstructionReadyForReview(workspace: DocumentReconstructionWorkspace): boolean {
  return evaluateDocumentReconstructionReadiness(workspace).readyForReview;
}

export function isDocumentReconstructionReadyForExport(workspace: DocumentReconstructionWorkspace): boolean {
  return evaluateDocumentReconstructionReadiness(workspace).readyForExport;
}

function computeReadyForReview(workspace: DocumentReconstructionWorkspace): boolean {
  const { document, isComplete, isReadyForReview, statusSummary } = workspace;

  return (
    isReadyForReview === true &&
    isComplete === true &&
    statusSummary.criticalIssues === 0 &&
    statusSummary.errorIssues === 0 &&
    document.status !== DocumentReconstructionStatus.Archived &&
    document.status !== DocumentReconstructionStatus.Rejected
  );
}

function computeReadyForExport(document: DocumentReconstruction, readyForReview: boolean): boolean {
  return readyForReview === true && document.status === DocumentReconstructionStatus.ReadyForReview;
}

/**
 * Priority order matters: `NotReady` is checked first, then
 * `NeedsAttention` (Warnings or a below-threshold score can downgrade an
 * otherwise-ready document for reporting purposes), and only then
 * `ReadyForExport`/`ReadyForReview`. The final `NeedsAttention` return is
 * an unreachable-in-practice safety net for a workspace whose
 * `isReadyForReview` disagrees with the Critical/Error/complete signals
 * this function already checked (e.g. a hand-assembled or future
 * workspace) — see `NotReadyForReview` in `buildBlockers`.
 */
function computeLevel(
  document: DocumentReconstruction,
  statusSummary: DocumentReconstructionWorkspaceSummary,
  isComplete: boolean,
  readyForReview: boolean,
  readyForExport: boolean,
): ReconstructionReadinessLevel {
  const isNotReady =
    document.status === DocumentReconstructionStatus.Archived ||
    document.status === DocumentReconstructionStatus.Rejected ||
    statusSummary.criticalIssues > 0 ||
    statusSummary.errorIssues > 0 ||
    isComplete === false;

  if (isNotReady) {
    return ReconstructionReadinessLevel.NotReady;
  }

  if (statusSummary.warningIssues > 0 || statusSummary.completenessScore < COMPLETENESS_SCORE_THRESHOLD) {
    return ReconstructionReadinessLevel.NeedsAttention;
  }

  if (readyForExport) {
    return ReconstructionReadinessLevel.ReadyForExport;
  }

  if (readyForReview) {
    return ReconstructionReadinessLevel.ReadyForReview;
  }

  return ReconstructionReadinessLevel.NeedsAttention;
}

function buildBlockers(workspace: DocumentReconstructionWorkspace): ReconstructionReadinessBlocker[] {
  const { document, isComplete, isReadyForReview, statusSummary } = workspace;
  const blockers: ReconstructionReadinessBlocker[] = [];

  if (document.status === DocumentReconstructionStatus.Archived) {
    blockers.push(
      createBlocker(
        ReconstructionReadinessBlockerCode.DocumentArchived,
        ReconstructionIssueSeverity.Critical,
        `Document reconstruction "${document.id}" is Archived.`,
      ),
    );
  }

  if (document.status === DocumentReconstructionStatus.Rejected) {
    blockers.push(
      createBlocker(
        ReconstructionReadinessBlockerCode.DocumentRejected,
        ReconstructionIssueSeverity.Critical,
        `Document reconstruction "${document.id}" is Rejected.`,
      ),
    );
  }

  if (!isComplete) {
    blockers.push(
      createBlocker(
        ReconstructionReadinessBlockerCode.DocumentNotComplete,
        ReconstructionIssueSeverity.Error,
        `Document reconstruction "${document.id}" is not complete.`,
      ),
    );
  }

  if (statusSummary.criticalIssues > 0) {
    blockers.push(
      createBlocker(
        ReconstructionReadinessBlockerCode.CriticalIssues,
        ReconstructionIssueSeverity.Critical,
        `Document reconstruction "${document.id}" has ${statusSummary.criticalIssues} critical issue(s).`,
      ),
    );
  }

  if (statusSummary.errorIssues > 0) {
    blockers.push(
      createBlocker(
        ReconstructionReadinessBlockerCode.ErrorIssues,
        ReconstructionIssueSeverity.Error,
        `Document reconstruction "${document.id}" has ${statusSummary.errorIssues} error issue(s).`,
      ),
    );
  }

  if (statusSummary.completenessScore < COMPLETENESS_SCORE_THRESHOLD) {
    blockers.push(
      createBlocker(
        ReconstructionReadinessBlockerCode.CompletenessBelowThreshold,
        ReconstructionIssueSeverity.Warning,
        `Document reconstruction "${document.id}" completeness score ${statusSummary.completenessScore} is below the ${COMPLETENESS_SCORE_THRESHOLD} threshold.`,
      ),
    );
  }

  if (!isReadyForReview) {
    blockers.push(
      createBlocker(
        ReconstructionReadinessBlockerCode.NotReadyForReview,
        ReconstructionIssueSeverity.Error,
        `Document reconstruction "${document.id}" is not marked ready for review.`,
      ),
    );
  }

  return blockers;
}

function createBlocker(
  code: ReconstructionReadinessBlockerCode,
  severity: ReconstructionIssueSeverity,
  message: string,
): ReconstructionReadinessBlocker {
  return { code, message, severity };
}

function buildSummary(statusSummary: DocumentReconstructionWorkspaceSummary): ReconstructionReadinessSummary {
  return {
    documentStatus: statusSummary.documentStatus,
    completenessLevel: statusSummary.completenessLevel,
    completenessScore: statusSummary.completenessScore,
    totalIssues: statusSummary.totalIssues,
    criticalIssues: statusSummary.criticalIssues,
    errorIssues: statusSummary.errorIssues,
    warningIssues: statusSummary.warningIssues,
    infoIssues: statusSummary.infoIssues,
  };
}

const SEVERITY_RANK: Readonly<Record<ReconstructionIssueSeverity, number>> = {
  [ReconstructionIssueSeverity.Critical]: 0,
  [ReconstructionIssueSeverity.Error]: 1,
  [ReconstructionIssueSeverity.Warning]: 2,
  [ReconstructionIssueSeverity.Info]: 3,
};

function compareBlockers(a: ReconstructionReadinessBlocker, b: ReconstructionReadinessBlocker): number {
  const severityDelta = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (severityDelta !== 0) {
    return severityDelta;
  }

  return compareOrdinal(a.code, b.code);
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
