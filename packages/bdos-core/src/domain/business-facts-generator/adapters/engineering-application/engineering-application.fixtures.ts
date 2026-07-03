/**
 * Shared, deterministic fixtures for this adapter's own test files only.
 * Not exported from `index.ts` — this is test support, not part of the
 * adapter's public surface. Builds real, valid operational entities via
 * each EPIC 10 domain's own pure functions (never hand-fabricated), so the
 * adapter is exercised against the same shapes it will see in practice.
 */
import {
  ApprovalWorkflowReferenceType,
  approveApprovalWorkflowStep,
  createApprovalWorkflow,
  submitApprovalWorkflow,
  type ApprovalWorkflow,
} from "../../../approval-workflow";
import {
  MeasurementBulletinReferenceType,
  createMeasurementBulletin,
  finalizeMeasurementBulletin,
  validateMeasurementBulletin,
  type MeasurementBulletin,
} from "../../../bulletin-generator";
import {
  EvidenceStatus,
  EvidenceType,
  advanceEvidenceStatus,
  createEvidenceRecord,
  type EvidenceRecord,
} from "../../../evidence-center";
import {
  ExportDocumentFormat,
  ExportDocumentType,
  ExportPackageReferenceType,
  createExportPackage,
  prepareExportPackage,
  validateExportPackage,
  type ExportPackage,
} from "../../../export-engine";
import {
  MeasurementWorkspaceReferenceType,
  MeasurementWorkspaceStatus,
  advanceMeasurementWorkspaceStatus,
  createMeasurementWorkspace,
  type MeasurementWorkspace,
} from "../../../measurement-workspace";

export const fixtureOrganizationId = "organization-alpha-engenharia";
export const fixtureCorrelationId = "engineering-facts-correlation-001";
export const fixtureActor = "engineer-marcos";
export const fixtureOccurredAt = "2026-06-20T12:00:00Z";
export const fixtureSourceSystem = "engineering-os";

export function closedMeasurementWorkspaceFixture(): MeasurementWorkspace {
  const created = createMeasurementWorkspace({
    id: "measurement-workspace-fixture-1",
    organizationId: fixtureOrganizationId,
    reference: {
      type: MeasurementWorkspaceReferenceType.Project,
      id: "project-fixture",
      code: "PRJ-FIX",
      name: "Fixture Project",
      metadata: {},
    },
    period: {
      measurementPeriodId: "measurement-period-8",
      periodNumber: 8,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      metadata: {},
    },
    lines: [
      {
        id: "line-1",
        serviceItemId: "service-item-1",
        serviceItemCode: "SI-1",
        description: "Escavacao mecanizada",
        unit: "m3",
        quantity: 10,
        unitValue: 150,
        notes: "",
        metadata: {},
      },
    ],
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    correlationId: fixtureCorrelationId,
    createdBy: fixtureActor,
    sourceSystem: fixtureSourceSystem,
    metadata: {},
  });
  assertFixtureSuccess(created.success, "measurement workspace creation");

  const inProgress = advanceMeasurementWorkspaceStatus({
    workspace: created.workspace!,
    toStatus: MeasurementWorkspaceStatus.InProgress,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertFixtureSuccess(inProgress.success, "measurement workspace -> InProgress");

  const readyForReview = advanceMeasurementWorkspaceStatus({
    workspace: inProgress.workspace!,
    toStatus: MeasurementWorkspaceStatus.ReadyForReview,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertFixtureSuccess(readyForReview.success, "measurement workspace -> ReadyForReview");

  const closed = advanceMeasurementWorkspaceStatus({
    workspace: readyForReview.workspace!,
    toStatus: MeasurementWorkspaceStatus.Closed,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertFixtureSuccess(closed.success, "measurement workspace -> Closed");

  return closed.workspace!;
}

export function inProgressMeasurementWorkspaceFixture(): MeasurementWorkspace {
  const created = createMeasurementWorkspace({
    id: "measurement-workspace-fixture-2",
    organizationId: fixtureOrganizationId,
    reference: {
      type: MeasurementWorkspaceReferenceType.Project,
      id: "project-fixture",
      code: "PRJ-FIX",
      name: "Fixture Project",
      metadata: {},
    },
    period: {
      measurementPeriodId: "measurement-period-9",
      periodNumber: 9,
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      metadata: {},
    },
    lines: [
      {
        id: "line-1",
        serviceItemId: "service-item-1",
        serviceItemCode: "SI-1",
        description: "Escavacao mecanizada",
        unit: "m3",
        quantity: 5,
        unitValue: 150,
        notes: "",
        metadata: {},
      },
    ],
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    correlationId: fixtureCorrelationId,
    createdBy: fixtureActor,
    sourceSystem: fixtureSourceSystem,
    metadata: {},
  });
  assertFixtureSuccess(created.success, "measurement workspace creation");

  const inProgress = advanceMeasurementWorkspaceStatus({
    workspace: created.workspace!,
    toStatus: MeasurementWorkspaceStatus.InProgress,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertFixtureSuccess(inProgress.success, "measurement workspace -> InProgress");

  return inProgress.workspace!;
}

export function approvedWorkflowFixture(): ApprovalWorkflow {
  const created = createApprovalWorkflow({
    id: "approval-workflow-fixture-1",
    organizationId: fixtureOrganizationId,
    reference: {
      type: ApprovalWorkflowReferenceType.MeasurementWorkspace,
      id: "measurement-workspace-fixture-1",
      code: "MW-FIX",
      name: "Fixture Workspace",
      metadata: {},
    },
    steps: [
      {
        id: "step-1",
        sequence: 1,
        name: "Fiscal Review",
        approverId: "engineer-marcos",
        approverName: "Marcos Ferreira",
        metadata: {},
      },
    ],
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    correlationId: fixtureCorrelationId,
    createdBy: fixtureActor,
    sourceSystem: fixtureSourceSystem,
    metadata: {},
  });
  assertFixtureSuccess(created.success, "approval workflow creation");

  const submitted = submitApprovalWorkflow({
    workflow: created.workflow!,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertFixtureSuccess(submitted.success, "approval workflow submission");

  const approved = approveApprovalWorkflowStep({
    workflow: submitted.workflow!,
    stepId: "step-1",
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertFixtureSuccess(approved.success, "approval workflow step approval");

  return approved.workflow!;
}

export function submittedWorkflowFixture(): ApprovalWorkflow {
  const created = createApprovalWorkflow({
    id: "approval-workflow-fixture-2",
    organizationId: fixtureOrganizationId,
    reference: {
      type: ApprovalWorkflowReferenceType.MeasurementWorkspace,
      id: "measurement-workspace-fixture-2",
      code: "MW-FIX-2",
      name: "Fixture Workspace 2",
      metadata: {},
    },
    steps: [
      {
        id: "step-1",
        sequence: 1,
        name: "Fiscal Review",
        approverId: "engineer-marcos",
        approverName: "Marcos Ferreira",
        metadata: {},
      },
    ],
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    correlationId: fixtureCorrelationId,
    createdBy: fixtureActor,
    sourceSystem: fixtureSourceSystem,
    metadata: {},
  });
  assertFixtureSuccess(created.success, "approval workflow creation");

  const submitted = submitApprovalWorkflow({
    workflow: created.workflow!,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertFixtureSuccess(submitted.success, "approval workflow submission");

  return submitted.workflow!;
}

export function finalizedBulletinFixture(): MeasurementBulletin {
  const created = createMeasurementBulletin({
    id: "measurement-bulletin-fixture-1",
    organizationId: fixtureOrganizationId,
    reference: {
      type: MeasurementBulletinReferenceType.MeasurementWorkspace,
      id: "measurement-workspace-fixture-1",
      code: "MW-FIX",
      name: "Fixture Workspace",
      metadata: {},
    },
    header: {
      contractId: "contract-fixture",
      contractNumber: "CT-FIX",
      projectId: "project-fixture",
      projectName: "Fixture Project",
      measurementPeriodId: "measurement-period-8",
      periodNumber: 8,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      technicalResponsibleId: "engineer-marcos",
      technicalResponsibleName: "Marcos Ferreira",
      metadata: {},
    },
    lines: [
      {
        id: "line-1",
        serviceItemId: "service-item-1",
        serviceItemCode: "SI-1",
        description: "Escavacao mecanizada",
        unit: "m3",
        quantity: 10,
        unitValue: 150,
        metadata: {},
      },
    ],
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    correlationId: fixtureCorrelationId,
    createdBy: fixtureActor,
    sourceSystem: fixtureSourceSystem,
    metadata: {},
  });
  assertFixtureSuccess(created.success, "bulletin creation");

  const validated = validateMeasurementBulletin({
    bulletin: created.bulletin!,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertFixtureSuccess(validated.success, "bulletin validation");

  const finalized = finalizeMeasurementBulletin({
    bulletin: validated.bulletin!,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertFixtureSuccess(finalized.success, "bulletin finalization");

  return finalized.bulletin!;
}

export function draftBulletinFixture(): MeasurementBulletin {
  const created = createMeasurementBulletin({
    id: "measurement-bulletin-fixture-2",
    organizationId: fixtureOrganizationId,
    reference: {
      type: MeasurementBulletinReferenceType.MeasurementWorkspace,
      id: "measurement-workspace-fixture-2",
      code: "MW-FIX-2",
      name: "Fixture Workspace 2",
      metadata: {},
    },
    header: {
      contractId: "contract-fixture",
      contractNumber: "CT-FIX",
      projectId: "project-fixture",
      projectName: "Fixture Project",
      measurementPeriodId: "measurement-period-9",
      periodNumber: 9,
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      technicalResponsibleId: "engineer-marcos",
      technicalResponsibleName: "Marcos Ferreira",
      metadata: {},
    },
    lines: [
      {
        id: "line-1",
        serviceItemId: "service-item-1",
        serviceItemCode: "SI-1",
        description: "Escavacao mecanizada",
        unit: "m3",
        quantity: 5,
        unitValue: 150,
        metadata: {},
      },
    ],
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    correlationId: fixtureCorrelationId,
    createdBy: fixtureActor,
    sourceSystem: fixtureSourceSystem,
    metadata: {},
  });
  assertFixtureSuccess(created.success, "bulletin creation");

  return created.bulletin!;
}

export function preparedExportPackageFixture(): ExportPackage {
  const created = createExportPackage({
    id: "export-package-fixture-1",
    organizationId: fixtureOrganizationId,
    reference: {
      type: ExportPackageReferenceType.MeasurementBulletin,
      id: "measurement-bulletin-fixture-1",
      code: "MB-FIX",
      name: "Fixture Bulletin",
      status: "Finalized",
      metadata: {},
    },
    documents: [
      {
        id: "doc-1",
        type: ExportDocumentType.OfficialMeasurementSpreadsheet,
        format: ExportDocumentFormat.Excel,
        label: "Planilha Oficial de Medicao",
        metadata: {},
      },
    ],
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    correlationId: fixtureCorrelationId,
    createdBy: fixtureActor,
    sourceSystem: fixtureSourceSystem,
    metadata: {},
  });
  assertFixtureSuccess(created.success, "export package creation");

  const validated = validateExportPackage({
    exportPackage: created.exportPackage!,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertFixtureSuccess(validated.success, "export package validation");

  const prepared = prepareExportPackage({
    exportPackage: validated.exportPackage!,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertFixtureSuccess(prepared.success, "export package preparation");

  return prepared.exportPackage!;
}

export function validatedExportPackageFixture(): ExportPackage {
  const created = createExportPackage({
    id: "export-package-fixture-2",
    organizationId: fixtureOrganizationId,
    reference: {
      type: ExportPackageReferenceType.MeasurementBulletin,
      id: "measurement-bulletin-fixture-2",
      code: "MB-FIX-2",
      name: "Fixture Bulletin 2",
      status: "Draft",
      metadata: {},
    },
    documents: [
      {
        id: "doc-1",
        type: ExportDocumentType.OfficialMeasurementSpreadsheet,
        format: ExportDocumentFormat.Excel,
        label: "Planilha Oficial de Medicao",
        metadata: {},
      },
    ],
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
    correlationId: fixtureCorrelationId,
    createdBy: fixtureActor,
    sourceSystem: fixtureSourceSystem,
    metadata: {},
  });
  assertFixtureSuccess(created.success, "export package creation");

  const validated = validateExportPackage({
    exportPackage: created.exportPackage!,
    actor: fixtureActor,
    occurredAt: fixtureOccurredAt,
  });
  assertFixtureSuccess(validated.success, "export package validation");

  return validated.exportPackage!;
}

export function attachedEvidenceFixture(id: string): EvidenceRecord {
  const record = draftEvidenceFixture(id);
  const attached = advanceEvidenceStatus({
    evidence: record,
    toStatus: EvidenceStatus.Attached,
  });
  assertFixtureSuccess(attached.success, "evidence -> Attached");

  return attached.evidence!;
}

export function draftEvidenceFixture(id: string): EvidenceRecord {
  const created = createEvidenceRecord({
    id,
    organizationId: fixtureOrganizationId,
    contractId: "contract-fixture",
    projectId: "project-fixture",
    type: EvidenceType.Photo,
    title: "Foto da frente de escavacao",
    description: "Registro fotografico da execucao medida em campo.",
    capturedAt: fixtureOccurredAt,
    capturedById: "engineer-marcos",
    capturedByName: "Marcos Ferreira",
    location: "Lagoa do Arroz - eixo principal",
    links: [
      {
        id: "link-1",
        label: "Foto frontal",
        uri: "evidence://field-photo-1",
        mimeType: "image/jpeg",
        sizeBytes: 2480000,
        checksum: "sha256-field-photo-1",
        metadata: {},
      },
    ],
    correlationId: fixtureCorrelationId,
    createdBy: fixtureActor,
    sourceSystem: fixtureSourceSystem,
    metadata: {},
  });
  assertFixtureSuccess(created.success, "evidence creation");

  return created.evidence!;
}

export function assertFixtureSuccess(success: boolean, message: string): void {
  if (!success) {
    throw new Error(`fixture setup failed: ${message}`);
  }
}
