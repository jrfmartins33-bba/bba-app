import type { ApprovalWorkflow } from "../../../approval-workflow";
import type { MeasurementBulletin } from "../../../bulletin-generator";
import type { EvidenceRecord } from "../../../evidence-center";
import type { ExportPackage } from "../../../export-engine";
import type { MeasurementWorkspace } from "../../../measurement-workspace";
import type {
  CreateEngineeringApplicationSnapshotInput,
  EngineeringApplicationSnapshot,
  EngineeringApplicationSnapshotMetadata,
  EngineeringApplicationSnapshotSummary,
  EngineeringApprovalSnapshot,
  EngineeringBulletinSnapshot,
  EngineeringEvidenceSnapshot,
  EngineeringExportSnapshot,
  EngineeringMeasurementSnapshot,
  EngineeringSnapshotTrace,
} from "./engineering-application-snapshot.types";

/**
 * Anti-Corruption Layer boundary: translates real EPIC 10 operational
 * entities into this adapter's own, minimal, decoupled snapshot shapes.
 * This function never validates business state (a workspace can be
 * captured in any status) — it only clones/projects. State gating
 * (Closed/Approved/Finalized/Prepared) happens in the fact generator,
 * which is the step that actually matters for Decision Engine input.
 */
export function createEngineeringApplicationSnapshot(
  input: CreateEngineeringApplicationSnapshotInput,
): EngineeringApplicationSnapshot {
  const metadata = createSnapshotMetadata(input);
  const measurement = input.measurementWorkspace
    ? toMeasurementSnapshot(input.measurementWorkspace)
    : null;
  const approval = input.approvalWorkflow ? toApprovalSnapshot(input.approvalWorkflow) : null;
  const bulletin = input.bulletin ? toBulletinSnapshot(input.bulletin) : null;
  const exportPackage = input.exportPackage
    ? toExportSnapshot(input.exportPackage)
    : null;
  const evidence = (input.evidenceRecords ?? []).map(toEvidenceSnapshot);

  return freezeDomainObject<EngineeringApplicationSnapshot>({
    organizationId: input.organizationId,
    correlationId: input.correlationId,
    measurement,
    approval,
    bulletin,
    exportPackage,
    evidence,
    trace: [
      createTraceEntry(
        "engineering_application_snapshot_created",
        input.actor,
        input.occurredAt,
        describeCapturedSources(measurement, approval, bulletin, exportPackage, evidence),
        metadata,
      ),
    ],
    metadata,
  });
}

export function summarizeEngineeringApplicationSnapshot(
  snapshot: EngineeringApplicationSnapshot,
): EngineeringApplicationSnapshotSummary {
  return {
    hasMeasurement: snapshot.measurement !== null,
    hasApproval: snapshot.approval !== null,
    hasBulletin: snapshot.bulletin !== null,
    hasExportPackage: snapshot.exportPackage !== null,
    totalEvidence: snapshot.evidence.length,
    attachedEvidence: snapshot.evidence.filter(
      (evidence) => evidence.status === "Attached" || evidence.status === "Verified",
    ).length,
  };
}

function toMeasurementSnapshot(
  workspace: MeasurementWorkspace,
): EngineeringMeasurementSnapshot {
  const lastTrace = workspace.trace[workspace.trace.length - 1];

  return {
    workspaceId: workspace.id,
    organizationId: workspace.organizationId,
    referenceId: workspace.reference.id,
    referenceType: workspace.reference.type,
    status: workspace.status,
    measurementPeriodId: workspace.period.measurementPeriodId,
    totalLines: workspace.summary.totalLines,
    totalQuantity: workspace.summary.totalQuantity,
    totalValue: workspace.summary.totalValue,
    actor: lastTrace?.actor ?? "",
    occurredAt: lastTrace?.occurredAt ?? "",
    metadata: { source: "measurement-workspace", workspaceId: workspace.id },
  };
}

function toApprovalSnapshot(workflow: ApprovalWorkflow): EngineeringApprovalSnapshot {
  const lastTrace = workflow.trace[workflow.trace.length - 1];

  return {
    workflowId: workflow.id,
    organizationId: workflow.organizationId,
    referenceId: workflow.reference.id,
    referenceType: workflow.reference.type,
    status: workflow.status,
    totalSteps: workflow.summary.totalSteps,
    approvedSteps: workflow.summary.approvedSteps,
    actor: lastTrace?.actor ?? "",
    occurredAt: lastTrace?.occurredAt ?? "",
    metadata: { source: "approval-workflow", workflowId: workflow.id },
  };
}

function toBulletinSnapshot(bulletin: MeasurementBulletin): EngineeringBulletinSnapshot {
  const lastTrace = bulletin.trace[bulletin.trace.length - 1];

  return {
    bulletinId: bulletin.id,
    organizationId: bulletin.organizationId,
    referenceId: bulletin.reference.id,
    referenceType: bulletin.reference.type,
    status: bulletin.status,
    contractId: bulletin.header.contractId,
    projectId: bulletin.header.projectId,
    totalLines: bulletin.totals.totalLines,
    totalQuantity: bulletin.totals.totalQuantity,
    totalValue: bulletin.totals.totalValue,
    actor: lastTrace?.actor ?? "",
    occurredAt: lastTrace?.occurredAt ?? "",
    metadata: { source: "bulletin-generator", bulletinId: bulletin.id },
  };
}

function toExportSnapshot(exportPackage: ExportPackage): EngineeringExportSnapshot {
  const lastTrace = exportPackage.trace[exportPackage.trace.length - 1];

  return {
    exportPackageId: exportPackage.id,
    organizationId: exportPackage.organizationId,
    referenceId: exportPackage.reference.id,
    referenceType: exportPackage.reference.type,
    status: exportPackage.status,
    totalDocumentsRequested: exportPackage.summary.totalDocumentsRequested,
    totalDocumentsPrepared: exportPackage.summary.totalDocumentsPrepared,
    actor: lastTrace?.actor ?? "",
    occurredAt: lastTrace?.occurredAt ?? "",
    metadata: { source: "export-engine", exportPackageId: exportPackage.id },
  };
}

function toEvidenceSnapshot(evidence: EvidenceRecord): EngineeringEvidenceSnapshot {
  return {
    evidenceId: evidence.id,
    organizationId: evidence.organizationId,
    contractId: evidence.contractId,
    projectId: evidence.projectId,
    status: evidence.status,
    evidenceType: evidence.type,
    title: evidence.title,
    capturedById: evidence.capturedById,
    capturedByName: evidence.capturedByName,
    occurredAt: evidence.capturedAt,
    metadata: { source: "evidence-center", evidenceId: evidence.id },
  };
}

function describeCapturedSources(
  measurement: EngineeringMeasurementSnapshot | null,
  approval: EngineeringApprovalSnapshot | null,
  bulletin: EngineeringBulletinSnapshot | null,
  exportPackage: EngineeringExportSnapshot | null,
  evidence: ReadonlyArray<EngineeringEvidenceSnapshot>,
): string {
  const captured: string[] = [];

  if (measurement !== null) {
    captured.push("measurement");
  }

  if (approval !== null) {
    captured.push("approval");
  }

  if (bulletin !== null) {
    captured.push("bulletin");
  }

  if (exportPackage !== null) {
    captured.push("export");
  }

  if (evidence.length > 0) {
    captured.push(`${evidence.length} evidence record(s)`);
  }

  return captured.length > 0
    ? `Engineering application snapshot captured: ${captured.join(", ")}.`
    : "Engineering application snapshot captured with no source data.";
}

function createTraceEntry(
  action: string,
  actor: string,
  occurredAt: string,
  description: string,
  metadata: EngineeringApplicationSnapshotMetadata,
): EngineeringSnapshotTrace {
  return {
    action,
    actor,
    occurredAt,
    description,
    metadata,
  };
}

function createSnapshotMetadata(
  input: CreateEngineeringApplicationSnapshotInput,
): EngineeringApplicationSnapshotMetadata {
  return {
    ...(input.metadata ?? {}),
    organizationId: input.organizationId,
    correlationId: input.correlationId,
  };
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
