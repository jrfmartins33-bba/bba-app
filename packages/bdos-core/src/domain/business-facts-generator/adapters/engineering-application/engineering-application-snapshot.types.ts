import type { ApprovalWorkflow } from "../../../approval-workflow";
import type { MeasurementBulletin } from "../../../bulletin-generator";
import type { EvidenceRecord } from "../../../evidence-center";
import type { ExportPackage } from "../../../export-engine";
import type { MeasurementWorkspace } from "../../../measurement-workspace";

export type EngineeringApplicationSnapshotMetadata = Readonly<Record<string, unknown>>;

export interface EngineeringSnapshotTrace {
  readonly action: string;
  readonly actor: string;
  readonly occurredAt: string;
  readonly description: string;
  readonly metadata: EngineeringApplicationSnapshotMetadata;
}

export interface EngineeringMeasurementSnapshot {
  readonly workspaceId: string;
  readonly organizationId: string;
  readonly referenceId: string;
  readonly referenceType: string;
  readonly status: string;
  readonly measurementPeriodId: string;
  readonly totalLines: number;
  readonly totalQuantity: number;
  readonly totalValue: number;
  readonly actor: string;
  readonly occurredAt: string;
  readonly metadata: EngineeringApplicationSnapshotMetadata;
}

export interface EngineeringApprovalSnapshot {
  readonly workflowId: string;
  readonly organizationId: string;
  readonly referenceId: string;
  readonly referenceType: string;
  readonly status: string;
  readonly totalSteps: number;
  readonly approvedSteps: number;
  readonly actor: string;
  readonly occurredAt: string;
  readonly metadata: EngineeringApplicationSnapshotMetadata;
}

export interface EngineeringBulletinSnapshot {
  readonly bulletinId: string;
  readonly organizationId: string;
  readonly referenceId: string;
  readonly referenceType: string;
  readonly status: string;
  readonly contractId: string;
  readonly projectId: string;
  readonly totalLines: number;
  readonly totalQuantity: number;
  readonly totalValue: number;
  readonly actor: string;
  readonly occurredAt: string;
  readonly metadata: EngineeringApplicationSnapshotMetadata;
}

export interface EngineeringExportSnapshot {
  readonly exportPackageId: string;
  readonly organizationId: string;
  readonly referenceId: string;
  readonly referenceType: string;
  readonly status: string;
  readonly totalDocumentsRequested: number;
  readonly totalDocumentsPrepared: number;
  readonly actor: string;
  readonly occurredAt: string;
  readonly metadata: EngineeringApplicationSnapshotMetadata;
}

export interface EngineeringEvidenceSnapshot {
  readonly evidenceId: string;
  readonly organizationId: string;
  readonly contractId: string;
  readonly projectId: string;
  readonly status: string;
  readonly evidenceType: string;
  readonly title: string;
  readonly capturedById: string;
  readonly capturedByName: string;
  readonly occurredAt: string;
  readonly metadata: EngineeringApplicationSnapshotMetadata;
}

export interface EngineeringApplicationSnapshot {
  readonly organizationId: string;
  readonly correlationId: string;
  readonly measurement: EngineeringMeasurementSnapshot | null;
  readonly approval: EngineeringApprovalSnapshot | null;
  readonly bulletin: EngineeringBulletinSnapshot | null;
  readonly exportPackage: EngineeringExportSnapshot | null;
  readonly evidence: ReadonlyArray<EngineeringEvidenceSnapshot>;
  readonly trace: ReadonlyArray<EngineeringSnapshotTrace>;
  readonly metadata: EngineeringApplicationSnapshotMetadata;
}

export interface EngineeringApplicationSnapshotSummary {
  readonly hasMeasurement: boolean;
  readonly hasApproval: boolean;
  readonly hasBulletin: boolean;
  readonly hasExportPackage: boolean;
  readonly totalEvidence: number;
  readonly attachedEvidence: number;
}

/**
 * Input to the Anti-Corruption Layer translation step. These are the real
 * operational entities (already frozen, already in their own terminal or
 * in-progress state) — the adapter only reads them, never mutates them,
 * and never imports Decision Engine or Business Facts types into the
 * operational domains themselves.
 */
export interface CreateEngineeringApplicationSnapshotInput {
  readonly organizationId: string;
  readonly correlationId: string;
  readonly actor: string;
  readonly occurredAt: string;
  readonly measurementWorkspace?: MeasurementWorkspace | null;
  readonly approvalWorkflow?: ApprovalWorkflow | null;
  readonly bulletin?: MeasurementBulletin | null;
  readonly exportPackage?: ExportPackage | null;
  readonly evidenceRecords?: ReadonlyArray<EvidenceRecord> | null;
  readonly metadata?: EngineeringApplicationSnapshotMetadata;
}
