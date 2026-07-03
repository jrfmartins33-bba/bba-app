import type {
  AdvanceEvidenceStatusInput,
  CreateEvidenceRecordInput,
  EvidenceCenterError,
  EvidenceCenterFailure,
  EvidenceCenterMetadata,
  EvidenceCenterResult,
  EvidenceCenterSuccess,
  EvidenceLink,
  EvidenceRecord,
} from "./evidence-center.types";
import { EvidenceStatus, type EvidenceType } from "./evidence-center.types";

export function createEvidenceRecord(
  input: CreateEvidenceRecordInput,
): EvidenceCenterResult {
  const metadata = createEvidenceMetadata(input);
  const errors = validateEvidenceRecord(input, metadata);

  if (errors.length > 0) {
    return freezeDomainObject<EvidenceCenterFailure>({
      success: false,
      evidence: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<EvidenceCenterSuccess>({
    success: true,
    evidence: createEvidenceEntity(input, metadata),
    errors: [],
    warnings: [],
    metadata,
  });
}

export function advanceEvidenceStatus(
  input: AdvanceEvidenceStatusInput,
): EvidenceCenterResult {
  const metadata = createTransitionMetadata(input);

  if (!canAdvanceEvidenceStatus(input.evidence.status, input.toStatus)) {
    return freezeDomainObject<EvidenceCenterFailure>({
      success: false,
      evidence: null,
      errors: [
        {
          code: "invalid_evidence_transition",
          field: "status",
          message: `Cannot transition evidence from ${input.evidence.status} to ${input.toStatus}.`,
          metadata,
        },
      ],
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<EvidenceCenterSuccess>({
    success: true,
    evidence: {
      ...input.evidence,
      status: input.toStatus,
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

function createEvidenceEntity(
  input: CreateEvidenceRecordInput,
  metadata: EvidenceCenterMetadata,
): EvidenceRecord {
  return {
    id: input.id,
    organizationId: input.organizationId,
    clientId: input.clientId ?? null,
    contractId: input.contractId,
    projectId: input.projectId,
    workPackageId: input.workPackageId ?? null,
    serviceItemId: input.serviceItemId ?? null,
    measurementPeriodId: input.measurementPeriodId ?? null,
    measurementEntryId: input.measurementEntryId ?? null,
    measurementCycleId: input.measurementCycleId ?? null,
    type: input.type as EvidenceType,
    title: input.title,
    description: input.description,
    capturedAt: input.capturedAt,
    capturedById: input.capturedById,
    capturedByName: input.capturedByName,
    location: input.location,
    links: cloneLinks(input.links ?? []),
    status: EvidenceStatus.Draft,
    metadata,
  };
}

function validateEvidenceRecord(
  input: CreateEvidenceRecordInput,
  metadata: EvidenceCenterMetadata,
): ReadonlyArray<EvidenceCenterError> {
  const errors: EvidenceCenterError[] = [];

  if (isBlank(input.id)) {
    errors.push(
      createEvidenceError("missing_id", "id", "Evidence id is required.", metadata),
    );
  }

  if (isBlank(input.organizationId)) {
    errors.push(
      createEvidenceError(
        "missing_organization_id",
        "organizationId",
        "Organization id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.contractId)) {
    errors.push(
      createEvidenceError(
        "missing_contract_id",
        "contractId",
        "Contract id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.projectId)) {
    errors.push(
      createEvidenceError(
        "missing_project_id",
        "projectId",
        "Project id is required.",
        metadata,
      ),
    );
  }

  if (input.type === undefined || input.type === null) {
    errors.push(
      createEvidenceError(
        "missing_type",
        "type",
        "Evidence type is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.title)) {
    errors.push(
      createEvidenceError(
        "missing_title",
        "title",
        "Evidence title is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.capturedAt)) {
    errors.push(
      createEvidenceError(
        "missing_captured_at",
        "capturedAt",
        "Captured at is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.capturedById) || isBlank(input.capturedByName)) {
    errors.push(
      createEvidenceError(
        "missing_captured_by",
        "capturedBy",
        "Captured by id and name are required.",
        metadata,
      ),
    );
  }

  validateLinks(input.links, metadata).forEach((error) => errors.push(error));

  return errors;
}

function validateLinks(
  links: ReadonlyArray<EvidenceLink> | null | undefined,
  metadata: EvidenceCenterMetadata,
): ReadonlyArray<EvidenceCenterError> {
  const errors: EvidenceCenterError[] = [];

  if (links === undefined || links === null || links.length === 0) {
    errors.push(
      createEvidenceError(
        "missing_links",
        "links",
        "At least one evidence link is required.",
        metadata,
      ),
    );
    return errors;
  }

  links.forEach((link, index) => {
    if (isBlank(link.id)) {
      errors.push(
        createEvidenceError(
          "missing_link_id",
          `links.${index}.id`,
          "Evidence link id is required.",
          metadata,
        ),
      );
    }

    if (isBlank(link.label)) {
      errors.push(
        createEvidenceError(
          "missing_link_label",
          `links.${index}.label`,
          "Evidence link label is required.",
          metadata,
        ),
      );
    }

    if (isBlank(link.uri)) {
      errors.push(
        createEvidenceError(
          "missing_link_uri",
          `links.${index}.uri`,
          "Evidence link uri is required.",
          metadata,
        ),
      );
    }
  });

  return errors;
}

function canAdvanceEvidenceStatus(
  fromStatus: EvidenceStatus,
  toStatus: EvidenceStatus,
): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

function cloneLinks(links: ReadonlyArray<EvidenceLink>): ReadonlyArray<EvidenceLink> {
  return links.map((link) => ({ ...link }));
}

function createEvidenceError(
  code: EvidenceCenterError["code"],
  field: string,
  message: string,
  metadata: EvidenceCenterMetadata,
): EvidenceCenterError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createEvidenceMetadata(
  input: CreateEvidenceRecordInput,
): EvidenceCenterMetadata {
  return {
    ...(input.metadata ?? {}),
    evidenceId: input.id,
    organizationId: input.organizationId,
    clientId: input.clientId ?? null,
    contractId: input.contractId,
    projectId: input.projectId,
    workPackageId: input.workPackageId ?? null,
    serviceItemId: input.serviceItemId ?? null,
    measurementPeriodId: input.measurementPeriodId ?? null,
    measurementEntryId: input.measurementEntryId ?? null,
    measurementCycleId: input.measurementCycleId ?? null,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createTransitionMetadata(
  input: AdvanceEvidenceStatusInput,
): EvidenceCenterMetadata {
  return {
    ...input.evidence.metadata,
    ...(input.metadata ?? {}),
    evidenceId: input.evidence.id,
    organizationId: input.evidence.organizationId,
    clientId: input.evidence.clientId,
    contractId: input.evidence.contractId,
    projectId: input.evidence.projectId,
    workPackageId: input.evidence.workPackageId,
    serviceItemId: input.evidence.serviceItemId,
    measurementEntryId: input.evidence.measurementEntryId,
    measurementCycleId: input.evidence.measurementCycleId,
    fromStatus: input.evidence.status,
    toStatus: input.toStatus,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

const allowedTransitions: Readonly<
  Record<EvidenceStatus, ReadonlyArray<EvidenceStatus>>
> = {
  [EvidenceStatus.Draft]: [EvidenceStatus.Attached, EvidenceStatus.Cancelled],
  [EvidenceStatus.Attached]: [
    EvidenceStatus.Verified,
    EvidenceStatus.Rejected,
    EvidenceStatus.Cancelled,
  ],
  [EvidenceStatus.Verified]: [EvidenceStatus.Cancelled],
  [EvidenceStatus.Rejected]: [EvidenceStatus.Attached],
  [EvidenceStatus.Cancelled]: [],
};

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
