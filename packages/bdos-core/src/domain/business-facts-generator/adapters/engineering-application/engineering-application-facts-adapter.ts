import type { BusinessFact } from "../../../business-fact";
import { createBusinessFactsGenerationResult } from "../../business-facts-generator";
import type {
  BusinessFactGenerationError,
  BusinessFactsAdapter,
  BusinessFactsGenerationResult,
} from "../../business-facts-generator.types";
import type { EngineeringApplicationFactsGenerationInput } from "./engineering-application-facts-adapter.types";
import type {
  EngineeringApplicationSnapshot,
  EngineeringApprovalSnapshot,
  EngineeringBulletinSnapshot,
  EngineeringEvidenceSnapshot,
  EngineeringExportSnapshot,
  EngineeringMeasurementSnapshot,
} from "./engineering-application-snapshot.types";

export const engineeringApplicationFactsSource = "engineering-application.snapshot";

type ValidEngineeringApplicationFactsGenerationInput =
  EngineeringApplicationFactsGenerationInput & {
    readonly snapshot: EngineeringApplicationSnapshot;
    readonly tenantId: string;
    readonly organizationId: string;
    readonly capability: string;
  };

export const engineeringApplicationFactsAdapter: BusinessFactsAdapter<EngineeringApplicationFactsGenerationInput> =
  {
    adapterId: "engineering-application-facts-adapter",
    supportedSource: engineeringApplicationFactsSource,
    generateFacts: generateEngineeringBusinessFactsFromSnapshot,
  };

/**
 * The only function in this Sprint allowed to turn an operational snapshot
 * into BusinessFact[]. It stops at that single artifact — everything a
 * Decision Engine would derive from a fact is out of scope here and
 * belongs to later EPIC 11 sprints, downstream of BusinessFact.
 */
export function generateEngineeringBusinessFactsFromSnapshot(
  input: EngineeringApplicationFactsGenerationInput,
): BusinessFactsGenerationResult {
  const structuralErrors = validateRequiredInput(input);

  if (structuralErrors.length > 0) {
    return createBusinessFactsGenerationResult({
      errors: structuralErrors,
      metadata: createResultMetadata(input),
    });
  }

  const validInput = input as ValidEngineeringApplicationFactsGenerationInput;
  const stateErrors = validateSnapshotState(validInput);

  if (stateErrors.length > 0) {
    return createBusinessFactsGenerationResult({
      errors: stateErrors,
      metadata: createResultMetadata(validInput),
    });
  }

  return createBusinessFactsGenerationResult({
    facts: createFacts(validInput),
    metadata: createResultMetadata(validInput),
  });
}

function validateRequiredInput(
  input: EngineeringApplicationFactsGenerationInput,
): ReadonlyArray<BusinessFactGenerationError> {
  const errors: BusinessFactGenerationError[] = [];

  if (isMissing(input.tenantId)) {
    errors.push(createMissingFieldError(input, "tenantId"));
  }

  if (isMissing(input.organizationId)) {
    errors.push(createMissingFieldError(input, "organizationId"));
  }

  if (isMissing(input.capability)) {
    errors.push(createMissingFieldError(input, "capability"));
  }

  if (input.snapshot === undefined || input.snapshot === null) {
    errors.push(createMissingFieldError(input, "snapshot"));
  }

  return errors;
}

function validateSnapshotState(
  input: ValidEngineeringApplicationFactsGenerationInput,
): ReadonlyArray<BusinessFactGenerationError> {
  const errors: BusinessFactGenerationError[] = [];
  const { snapshot } = input;

  if (snapshot.measurement !== null && snapshot.measurement.status !== "Closed") {
    errors.push(
      createStateError(
        input,
        "measurement_not_finalized",
        snapshot.measurement.workspaceId,
        `Measurement workspace must be Closed to generate engineering.measurement.finalized facts (status: ${snapshot.measurement.status}).`,
      ),
    );
  }

  if (snapshot.approval !== null && snapshot.approval.status !== "Approved") {
    errors.push(
      createStateError(
        input,
        "approval_not_completed",
        snapshot.approval.workflowId,
        `Approval workflow must be Approved to generate engineering.approval.completed facts (status: ${snapshot.approval.status}).`,
      ),
    );
  }

  if (snapshot.bulletin !== null && snapshot.bulletin.status !== "Finalized") {
    errors.push(
      createStateError(
        input,
        "bulletin_not_finalized",
        snapshot.bulletin.bulletinId,
        `Measurement bulletin must be Finalized to generate engineering.bulletin.finalized facts (status: ${snapshot.bulletin.status}).`,
      ),
    );
  }

  if (snapshot.exportPackage !== null && snapshot.exportPackage.status !== "Prepared") {
    errors.push(
      createStateError(
        input,
        "export_not_prepared",
        snapshot.exportPackage.exportPackageId,
        `Export package must be Prepared to generate engineering.export.prepared facts (status: ${snapshot.exportPackage.status}).`,
      ),
    );
  }

  const hasAnySourceData =
    snapshot.measurement !== null ||
    snapshot.approval !== null ||
    snapshot.bulletin !== null ||
    snapshot.exportPackage !== null ||
    snapshot.evidence.length > 0;

  if (!hasAnySourceData) {
    errors.push(
      createStateError(
        input,
        "missing_snapshot_data",
        "snapshot",
        "Snapshot has no measurement, approval, bulletin, export or evidence data to generate facts from.",
      ),
    );
  }

  return errors;
}

function createFacts(
  input: ValidEngineeringApplicationFactsGenerationInput,
): ReadonlyArray<BusinessFact> {
  const { snapshot } = input;
  const facts: BusinessFact[] = [];

  if (snapshot.measurement !== null) {
    facts.push(createMeasurementFinalizedFact(input, snapshot.measurement));
  }

  if (snapshot.approval !== null) {
    facts.push(createApprovalCompletedFact(input, snapshot.approval));
  }

  if (snapshot.bulletin !== null) {
    facts.push(createBulletinFinalizedFact(input, snapshot.bulletin));
  }

  if (snapshot.exportPackage !== null) {
    facts.push(createExportPreparedFact(input, snapshot.exportPackage));
  }

  snapshot.evidence.forEach((evidence) => {
    if (evidence.status === "Attached" || evidence.status === "Verified") {
      facts.push(createEvidenceAttachedFact(input, evidence));
    }
  });

  return facts;
}

function createMeasurementFinalizedFact(
  input: ValidEngineeringApplicationFactsGenerationInput,
  measurement: EngineeringMeasurementSnapshot,
): BusinessFact {
  return {
    ...createBaseFact(input),
    id: createFactId(input, "measurement-finalized", measurement.workspaceId),
    source: "engineering-application.measurement-workspace",
    sourceReference: measurement.workspaceId,
    category: "operational",
    type: "measurement_finalized",
    label: "Engineering measurement finalized",
    description: "Measurement workspace closed with finalized quantities and value.",
    value: measurement.totalValue,
    unit: "currency",
    observedAt: measurement.occurredAt,
  };
}

function createApprovalCompletedFact(
  input: ValidEngineeringApplicationFactsGenerationInput,
  approval: EngineeringApprovalSnapshot,
): BusinessFact {
  return {
    ...createBaseFact(input),
    id: createFactId(input, "approval-completed", approval.workflowId),
    source: "engineering-application.approval-workflow",
    sourceReference: approval.workflowId,
    category: "operational",
    type: "approval_completed",
    label: "Engineering approval completed",
    description: "Approval workflow reached Approved with all steps approved.",
    value: approval.approvedSteps,
    unit: "count",
    observedAt: approval.occurredAt,
  };
}

function createBulletinFinalizedFact(
  input: ValidEngineeringApplicationFactsGenerationInput,
  bulletin: EngineeringBulletinSnapshot,
): BusinessFact {
  return {
    ...createBaseFact(input),
    id: createFactId(input, "bulletin-finalized", bulletin.bulletinId),
    source: "engineering-application.bulletin-generator",
    sourceReference: bulletin.bulletinId,
    category: "operational",
    type: "bulletin_finalized",
    label: "Engineering measurement bulletin finalized",
    description: "Measurement bulletin finalized with validated totals.",
    value: bulletin.totalValue,
    unit: "currency",
    observedAt: bulletin.occurredAt,
  };
}

function createExportPreparedFact(
  input: ValidEngineeringApplicationFactsGenerationInput,
  exportPackage: EngineeringExportSnapshot,
): BusinessFact {
  return {
    ...createBaseFact(input),
    id: createFactId(input, "export-prepared", exportPackage.exportPackageId),
    source: "engineering-application.export-engine",
    sourceReference: exportPackage.exportPackageId,
    category: "operational",
    type: "export_prepared",
    label: "Engineering export package prepared",
    description: "Export package prepared with conceptual document descriptors.",
    value: exportPackage.totalDocumentsPrepared,
    unit: "count",
    observedAt: exportPackage.occurredAt,
  };
}

function createEvidenceAttachedFact(
  input: ValidEngineeringApplicationFactsGenerationInput,
  evidence: EngineeringEvidenceSnapshot,
): BusinessFact {
  return {
    ...createBaseFact(input),
    id: createFactId(input, "evidence-attached", evidence.evidenceId),
    source: "engineering-application.evidence-center",
    sourceReference: evidence.evidenceId,
    category: "operational",
    type: "evidence_attached",
    label: "Engineering evidence attached",
    description: `Evidence "${evidence.title}" attached to the field record.`,
    value: 1,
    unit: "count",
    observedAt: evidence.occurredAt,
  };
}

function createBaseFact(
  input: ValidEngineeringApplicationFactsGenerationInput,
): Omit<
  BusinessFact,
  | "id"
  | "source"
  | "sourceReference"
  | "category"
  | "type"
  | "label"
  | "description"
  | "value"
  | "unit"
  | "observedAt"
> {
  return {
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    capability: input.capability,
    confidence: 100,
    metadata: createFactMetadata(input),
    createdAt: input.generatedAt,
  };
}

function createFactMetadata(input: ValidEngineeringApplicationFactsGenerationInput) {
  return {
    ...input.metadata,
    adapterId: engineeringApplicationFactsAdapter.adapterId,
    correlationId: input.correlationId,
    snapshotOrganizationId: input.snapshot.organizationId,
    snapshotCorrelationId: input.snapshot.correlationId,
  };
}

function createResultMetadata(input: EngineeringApplicationFactsGenerationInput) {
  return {
    ...input.metadata,
    adapterId: engineeringApplicationFactsAdapter.adapterId,
    correlationId: input.correlationId,
  };
}

function createFactId(
  input: ValidEngineeringApplicationFactsGenerationInput,
  factType: string,
  sourceId: string,
): string {
  return `${input.correlationId}:${factType}:${sourceId}`;
}

function createStateError(
  input: ValidEngineeringApplicationFactsGenerationInput,
  code: string,
  sourceId: string,
  message: string,
): BusinessFactGenerationError {
  return {
    code,
    message,
    sourceId,
    metadata: {
      ...input.metadata,
      adapterId: engineeringApplicationFactsAdapter.adapterId,
      correlationId: input.correlationId,
    },
  };
}

function createMissingFieldError(
  input: EngineeringApplicationFactsGenerationInput,
  field: string,
): BusinessFactGenerationError {
  return {
    code: "missing_required_data",
    message: `${field} is required.`,
    sourceId: input.correlationId,
    metadata: {
      ...input.metadata,
      adapterId: engineeringApplicationFactsAdapter.adapterId,
      field,
      correlationId: input.correlationId,
    },
  };
}

function isMissing(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0;
}
